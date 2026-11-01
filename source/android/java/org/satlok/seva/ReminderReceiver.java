package org.satlok.seva;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

import org.json.JSONObject;

import java.util.Calendar;

public final class ReminderReceiver extends BroadcastReceiver {
    private static final String TAG = "ReminderReceiver";
    static final String PREF = "satlok.rem";
    static final String ACTION_DAILY = "org.satlok.seva.DAILY";
    static final String ACTION_EVENT = "org.satlok.seva.EVENT";

    @Override public void onReceive(Context ctx, Intent intent) {
        String action = intent.getAction();
        SharedPreferences sp = ctx.getSharedPreferences(PREF, Context.MODE_PRIVATE);
        Notifier n = new Notifier(ctx);
        try {
            if (ACTION_EVENT.equals(action)) {
                String id = intent.getStringExtra("id");
                String title = intent.getStringExtra("title");
                String body = intent.getStringExtra("body");
                n.show(hash(id), title == null ? "Bhandara" : title, body == null ? "" : body, "event");
                sp.edit().remove("ev_" + id).apply();
            } else {
                String title = intent.getStringExtra("title");
                String body = intent.getStringExtra("body");
                n.show(1001,
                        title == null ? "Time for seva 🪔" : title,
                        body == null ? "Don't forget to log today's seva. Sat Sahib Ji 🙏" : body,
                        "reminder");
                // re-arm for tomorrow (setExactAndAllowWhileIdle is one-shot)
                if (sp.getBoolean("daily", false)) {
                    schedule(ctx, sp.getInt("hour", 20), sp.getInt("min", 0), true, title, body);
                }
            }
        } catch (Throwable t) { Log.e(TAG, "onReceive", t); }
    }

    /* ─────────── daily reminder ─────────── */
    static void schedule(Context ctx, int hour, int minute, boolean on, String title, String body) {
        SharedPreferences sp = ctx.getSharedPreferences(PREF, Context.MODE_PRIVATE);
        sp.edit().putBoolean("daily", on).putInt("hour", hour).putInt("min", minute)
          .putString("title", title == null ? "" : title)
          .putString("body", body == null ? "" : body).apply();

        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        PendingIntent pi = dailyIntent(ctx, sp.getString("title", ""), sp.getString("body", ""));
        if (!on) { am.cancel(pi); return; }

        Calendar c = Calendar.getInstance();
        c.set(Calendar.HOUR_OF_DAY, hour);
        c.set(Calendar.MINUTE, minute);
        c.set(Calendar.SECOND, 0);
        c.set(Calendar.MILLISECOND, 0);
        if (c.getTimeInMillis() <= System.currentTimeMillis()) c.add(Calendar.DAY_OF_YEAR, 1);
        setAlarm(ctx, am, c.getTimeInMillis(), pi);
    }

    /** Re-arm everything after reboot / package replace / time change. */
    static void restoreAll(Context ctx) {
        SharedPreferences sp = ctx.getSharedPreferences(PREF, Context.MODE_PRIVATE);
        if (sp.getBoolean("daily", false)) {
            schedule(ctx, sp.getInt("hour", 20), sp.getInt("min", 0), true,
                     sp.getString("title", ""), sp.getString("body", ""));
        }
        long now = System.currentTimeMillis();
        for (String k : sp.getAll().keySet()) {
            if (!k.startsWith("ev_")) continue;
            try {
                JSONObject o = new JSONObject(sp.getString(k, "{}"));
                long ts = o.getLong("ts");
                if (ts <= now) { sp.edit().remove(k).apply(); continue; }
                scheduleEvent(ctx, o.getString("id"), ts, o.getString("title"), o.getString("body"));
            } catch (Exception ignored) {}
        }
    }

    private static PendingIntent dailyIntent(Context ctx, String title, String body) {
        Intent i = new Intent(ctx, ReminderReceiver.class).setAction(ACTION_DAILY);
        i.putExtra("title", title); i.putExtra("body", body);
        int f = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        return PendingIntent.getBroadcast(ctx, 7001, i, f);
    }

    /* ─────────── one-off event reminder ─────────── */
    static void scheduleEvent(Context ctx, String id, long ts, String title, String body) {
        SharedPreferences sp = ctx.getSharedPreferences(PREF, Context.MODE_PRIVATE);
        try {
            JSONObject o = new JSONObject();
            o.put("id", id).put("ts", ts).put("title", title).put("body", body);
            sp.edit().putString("ev_" + id, o.toString()).apply();
        } catch (Exception ignored) {}
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        setAlarm(ctx, am, ts, eventIntent(ctx, id, title, body));
    }

    static void cancelEvent(Context ctx, String id) {
        ctx.getSharedPreferences(PREF, Context.MODE_PRIVATE).edit().remove("ev_" + id).apply();
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.cancel(eventIntent(ctx, id, "", ""));
    }

    private static PendingIntent eventIntent(Context ctx, String id, String title, String body) {
        Intent i = new Intent(ctx, ReminderReceiver.class).setAction(ACTION_EVENT);
        i.putExtra("id", id); i.putExtra("title", title); i.putExtra("body", body);
        int f = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        return PendingIntent.getBroadcast(ctx, hash(id), i, f);
    }

    private static void setAlarm(Context ctx, AlarmManager am, long ts, PendingIntent pi) {
        try {
            boolean exactOk = true;
            if (Build.VERSION.SDK_INT >= 31) {
                try { exactOk = am.canScheduleExactAlarms(); } catch (Throwable ignored) {}
            }
            if (Build.VERSION.SDK_INT >= 23 && exactOk) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, ts, pi);
            else if (Build.VERSION.SDK_INT >= 19) am.setWindow(AlarmManager.RTC_WAKEUP, ts, 10 * 60 * 1000, pi);
            else am.set(AlarmManager.RTC_WAKEUP, ts, pi);
        } catch (SecurityException se) {
            try { am.setWindow(AlarmManager.RTC_WAKEUP, ts, 10 * 60 * 1000, pi); } catch (Throwable ignored) {}
        } catch (Throwable t) { Log.w(TAG, "setAlarm", t); }
    }

    private static int hash(String s) { return s == null ? 8000 : (8000 + (Math.abs(s.hashCode()) % 100000)); }
}
