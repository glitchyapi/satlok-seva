package org.satlok.seva;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import org.json.JSONArray;
import org.json.JSONObject;

public class ReminderReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent i) {
        int id = i.getIntExtra("id", 1);
        Notify.show(c, 1000 + id, Notify.CH_REMINDER,
                i.getStringExtra("title"), i.getStringExtra("body"), i.getStringExtra("tab"));
        // Re-arm for tomorrow (exact alarms are one-shot by design).
        String json = Notify.prefs(c).getString("items", "[]");
        try {
            JSONArray arr = new JSONArray(json);
            for (int k = 0; k < arr.length(); k++) {
                JSONObject o = arr.getJSONObject(k);
                if (o.optInt("id") == id) {
                    Notify.scheduleAll(c, arr.toString());
                    break;
                }
            }
        } catch (Exception ignored) { }
    }
}
