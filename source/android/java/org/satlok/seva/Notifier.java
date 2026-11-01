package org.satlok.seva;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.os.Build;

final class Notifier {
    static final String CH_REMINDER = "seva_reminder";
    static final String CH_EVENTS   = "bhandara_events";
    static final String CH_UPDATE   = "app_update";

    private final Context ctx;
    private final NotificationManager nm;

    Notifier(Context c) {
        this.ctx = c.getApplicationContext();
        this.nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        createChannels();
    }

    private void createChannels() {
        if (Build.VERSION.SDK_INT < 26 || nm == null) return;
        mk(CH_REMINDER, ctx.getString(R.string.ch_reminder), ctx.getString(R.string.ch_reminder_desc), NotificationManager.IMPORTANCE_DEFAULT);
        mk(CH_EVENTS,   ctx.getString(R.string.ch_events),   ctx.getString(R.string.ch_events_desc),   NotificationManager.IMPORTANCE_HIGH);
        mk(CH_UPDATE,   ctx.getString(R.string.ch_update),   ctx.getString(R.string.ch_update_desc),   NotificationManager.IMPORTANCE_DEFAULT);
    }
    private void mk(String id, String name, String desc, int imp) {
        NotificationChannel ch = new NotificationChannel(id, name, imp);
        ch.setDescription(desc);
        ch.enableLights(true);
        ch.setLightColor(Color.parseColor("#F97316"));
        ch.enableVibration(true);
        if (nm != null) nm.createNotificationChannel(ch);
    }

    boolean enabled() {
        if (nm == null) return false;
        if (Build.VERSION.SDK_INT >= 24) return nm.areNotificationsEnabled();
        return true;
    }

    void show(int id, String title, String body, String tag) {
        if (nm == null || !enabled()) return;
        String channel = CH_UPDATE;
        if ("reminder".equals(tag)) channel = CH_REMINDER;
        else if ("event".equals(tag)) channel = CH_EVENTS;

        Intent i = new Intent(ctx, MainActivity.class);
        i.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        i.putExtra("notif_tag", tag);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        PendingIntent pi = PendingIntent.getActivity(ctx, id, i, flags);

        Notification.Builder b = Build.VERSION.SDK_INT >= 26
                ? new Notification.Builder(ctx, channel)
                : new Notification.Builder(ctx);
        b.setContentTitle(title)
         .setContentText(body)
         .setSmallIcon(R.drawable.ic_notification)
         .setColor(Color.parseColor("#F97316"))
         .setAutoCancel(true)
         .setContentIntent(pi)
         .setStyle(new Notification.BigTextStyle().bigText(body));
        if (Build.VERSION.SDK_INT >= 21) b.setCategory(Notification.CATEGORY_REMINDER);
        if (Build.VERSION.SDK_INT < 26) b.setPriority(Notification.PRIORITY_DEFAULT);

        try { nm.notify(tag == null ? "general" : tag, id, b.build()); } catch (Throwable ignored) {}
    }

    void cancel(String tag) { if (nm != null) nm.cancel(tag, 9001); }
}
