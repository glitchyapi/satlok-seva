package satlok.seva;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

public class AlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context ctx, Intent intent) {
        SharedPreferences p = ctx.getSharedPreferences("ssv", Context.MODE_PRIVATE);
        if (!p.getBoolean("rem_on", false)) return;
        String title = p.getString("rem_title", "Satlok Seva");
        String body = p.getString("rem_body", "Log today's seva");
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel("reminder") == null) {
            nm.createNotificationChannel(new NotificationChannel("reminder", "Seva reminder", 4));
        }
        Notification.Builder b = Build.VERSION.SDK_INT >= 26
                ? new Notification.Builder(ctx, "reminder") : new Notification.Builder(ctx);
        b.setSmallIcon(ctx.getResources().getIdentifier("ic_launcher", "mipmap", ctx.getPackageName()))
         .setContentTitle(title).setContentText(body).setAutoCancel(true);
        Intent open = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        if (open != null) {
            b.setContentIntent(android.app.PendingIntent.getActivity(ctx, 100, open,
                    PendingIntent_FLAG()));
        }
        nm.notify(777, b.build());
    }
    private static int PendingIntent_FLAG() {
        return android.app.PendingIntent.FLAG_UPDATE_CURRENT | android.app.PendingIntent.FLAG_IMMUTABLE;
    }
}
