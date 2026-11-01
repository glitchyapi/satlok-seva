package org.satlok.seva;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

/** Re-arms reminders after reboot, app update, or clock/timezone change. */
public final class BootReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context ctx, Intent intent) {
        String a = intent == null ? null : intent.getAction();
        Log.i("BootReceiver", "received " + a);
        try { ReminderReceiver.restoreAll(ctx.getApplicationContext()); }
        catch (Throwable t) { Log.e("BootReceiver", "restore failed", t); }
    }
}
