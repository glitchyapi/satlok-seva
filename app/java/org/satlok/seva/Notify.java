package org.satlok.seva;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.BitmapFactory;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Calendar;

/**
 * Local notifications + daily seva reminders.
 *
 * Deliberately no Firebase / no push server: reminders and update alerts are
 * scheduled on-device, so the app stays fully offline-first and no bhagat's data
 * ever leaves the phone. "Notify all users" is achieved by every device reading
 * the universal update manifest and raising the notification itself.
 */
public class Notify {

    public static final String CH_REMINDER = "seva_reminder";
    public static final String CH_UPDATE = "app_update";
    public static final String CH_BHANDARA = "bhandara";
    private static final String PREFS = "reminders";

    public static void ensureChannels(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null) return;
        mk(nm, CH_REMINDER, "Seva reminders", "Daily nudge to log your naam jaap and seva",
                NotificationManager.IMPORTANCE_DEFAULT);
        mk(nm, CH_UPDATE, "App updates", "New version available and download progress",
                NotificationManager.IMPORTANCE_HIGH);
        mk(nm, CH_BHANDARA, "Bhandara", "Upcoming bhandara and satsang alerts",
                NotificationManager.IMPORTANCE_DEFAULT);
    }

    private static void mk(NotificationManager nm, String id, String title, String desc, int imp) {
        NotificationChannel ch = new NotificationChannel(id, title, imp);
        ch.setDescription(desc);
        ch.enableVibration(true);
        nm.createNotificationChannel(ch);
    }

    public static boolean allowed(Context c) {
        if (Build.VERSION.SDK_INT >= 33) {
            return c.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)
                    == android.content.pm.PackageManager.PERMISSION_GRANTED;
        }
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        return nm == null || nm.areNotificationsEnabled();
    }

    public static void show(Context c, int id, String channel, String title, String body, String tab) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null || !allowed(c)) return;

        Intent open = new Intent(c, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (tab != null) open.putExtra("open_tab", tab);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) flags |= PendingIntent.FLAG_IMMUTABLE;
        PendingIntent pi = PendingIntent.getActivity(c, id, open, flags);

        Notification.Builder b = Build.VERSION.SDK_INT >= 26
                ? new Notification.Builder(c, channel)
                : new Notification.Builder(c);
        b.setSmallIcon(R.drawable.ic_stat_seva)
         .setContentTitle(title)
         .setContentText(body)
         .setStyle(new Notification.BigTextStyle().bigText(body))
         .setContentIntent(pi)
         .setAutoCancel(true)
         .setColor(0xFFE8730C)
         .setShowWhen(true);
        if (Build.VERSION.SDK_INT >= 26) b.setBadgeIconType(Notification.BADGE_ICON_SMALL);
        try {
            b.setLargeIcon(BitmapFactory.decodeResource(c.getResources(), R.mipmap.ic_launcher));
        } catch (Exception ignored) { }
        nm.notify(id, b.build());
    }

    // ---- reminders ----------------------------------------------------------

    public static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /** items = [{id, hour, minute, title, body, enabled}] */
    public static void scheduleAll(Context c, String json) throws Exception {
        JSONArray arr = new JSONArray(json);
        prefs(c).edit().putString("items", json).apply();
        for (int i = 0; i < arr.length(); i++) schedule(c, arr.getJSONObject(i));
    }

    public static void rescheduleAll(Context c) {
        String json = prefs(c).getString("items", "[]");
        try {
            JSONArray arr = new JSONArray(json);
            for (int i = 0; i < arr.length(); i++) schedule(c, arr.getJSONObject(i));
        } catch (Exception ignored) { }
    }

    private static void schedule(Context c, JSONObject o) {
        int id = o.optInt("id", 1);
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        PendingIntent pi = intent(c, id, o.optString("title", "Seva reminder"),
                o.optString("body", "Log today's seva."), o.optString("tab", "seva"));
        if (!o.optBoolean("enabled", true)) { am.cancel(pi); return; }

        Calendar cal = Calendar.getInstance();
        cal.set(Calendar.HOUR_OF_DAY, o.optInt("hour", 20));
        cal.set(Calendar.MINUTE, o.optInt("minute", 0));
        cal.set(Calendar.SECOND, 0);
        if (cal.getTimeInMillis() <= System.currentTimeMillis()) cal.add(Calendar.DAY_OF_YEAR, 1);

        boolean exact = false;
        if (Build.VERSION.SDK_INT >= 31) {
            try { exact = am.canScheduleExactAlarms(); } catch (Throwable t) { exact = false; }
        } else if (Build.VERSION.SDK_INT >= 23) exact = true;

        try {
            if (exact) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cal.getTimeInMillis(), pi);
            } else {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cal.getTimeInMillis(), pi);
            }
        } catch (SecurityException se) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cal.getTimeInMillis(), pi);
        }
    }

    public static PendingIntent intent(Context c, int id, String title, String body, String tab) {
        Intent i = new Intent(c, ReminderReceiver.class);
        i.setAction("org.satlok.seva.REMIND");
        i.putExtra("id", id);
        i.putExtra("title", title);
        i.putExtra("body", body);
        i.putExtra("tab", tab);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) flags |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getBroadcast(c, id, i, flags);
    }
}
