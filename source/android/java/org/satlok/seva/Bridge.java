package org.satlok.seva;

import android.Manifest;
import android.app.Activity;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.os.Vibrator;
import android.provider.MediaStore;
import android.provider.Settings;
import android.util.Base64;
import android.util.Log;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.Charset;
import java.util.HashMap;
import java.util.Map;

/** The single JS ⇄ native surface. Injected as `SatlokNative`. */
public final class Bridge {
    private static final String TAG = "Bridge";
    private static final Charset UTF8 = Charset.forName("UTF-8");
    static final int REQ_PICK_FILE = 4101;
    static final int REQ_CREATE_FILE = 4102;
    static final int REQ_NOTIF = 4103;
    static final int REQ_LEGACY_WRITE = 4104;

    private final MainActivity act;
    private final SecureStore store;
    private final OtaManager ota;
    private final Notifier notifier;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private final Map<String, Object[]> tasks = new HashMap<String, Object[]>();

    // pending SAF operations
    String pendingSaveContent, pendingSaveName, pendingSaveMime, pendingSaveReq;
    String pendingPickReq;

    Bridge(MainActivity a, SecureStore s, OtaManager o, Notifier n) {
        this.act = a; this.store = s; this.ota = o; this.notifier = n;
    }

    /* ═══════════ app info ═══════════ */
    @JavascriptInterface public String getAppInfo() {
        try {
            JSONObject o = new JSONObject();
            PackageInfo pi = act.getPackageManager().getPackageInfo(act.getPackageName(), 0);
            o.put("versionName", pi.versionName);
            o.put("versionCode", Build.VERSION.SDK_INT >= 28 ? pi.getLongVersionCode() : pi.versionCode);
            o.put("packageName", act.getPackageName());
            o.put("sdk", Build.VERSION.SDK_INT);
            o.put("androidVersion", Build.VERSION.RELEASE);
            o.put("device", Build.MANUFACTURER + " " + Build.MODEL);
            o.put("abi", Build.SUPPORTED_ABIS.length > 0 ? Build.SUPPORTED_ABIS[0] : "unknown");
            o.put("webviewVersion", MainActivity.webviewVersion(act));
            o.put("hardwareCrypto", store.isHardwareBacked());
            o.put("debug", MainActivity.IS_DEBUG);
            return o.toString();
        } catch (Exception e) { return "{\"versionName\":\"1.0.0\",\"versionCode\":1}"; }
    }

    /* ═══════════ secure storage ═══════════ */
    @JavascriptInterface public String secureRead()  { return store.read(); }
    @JavascriptInterface public String secureWrite(String json) { return store.write(json); }
    @JavascriptInterface public void   secureWipe()  { store.wipe(); }

    /* ═══════════ notifications ═══════════ */
    @JavascriptInterface public void notify(int id, String title, String body, String tag) {
        notifier.show(id, title, body, tag);
    }
    @JavascriptInterface public boolean hasNotifPermission() { return notifier.enabled(); }
    @JavascriptInterface public void requestNotifPermission() {
        ui.post(new Runnable() { public void run() {
            if (Build.VERSION.SDK_INT >= 33) {
                if (act.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
                    act.requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIF);
            } else if (!notifier.enabled()) {
                openSettings("notification");
            }
        }});
    }
    @JavascriptInterface public void cancelNotification(String tag) { notifier.cancel(tag); }

    @JavascriptInterface public void scheduleReminder(final int h, final int m, final boolean on) {
        final String title = pick("notif.remTitle", "Time for seva 🪔");
        final String body  = pick("notif.remBody", "Don't forget to log today's seva. Sat Sahib Ji 🙏");
        ReminderReceiver.schedule(act, h, m, on, title, body);
    }
    @JavascriptInterface public void scheduleEvent(String id, double ts, String title, String body) {
        ReminderReceiver.scheduleEvent(act, id, (long) ts, title, body);
    }
    @JavascriptInterface public void cancelEvent(String id) { ReminderReceiver.cancelEvent(act, id); }

    private String pick(String k, String def) { return def; }

    /* ═══════════ permissions ═══════════ */
    @JavascriptInterface public String getPermissions() {
        try {
            JSONObject o = new JSONObject();
            o.put("notif", notifier.enabled());
            o.put("install", canInstall());
            boolean storage = true;
            if (Build.VERSION.SDK_INT < 29)
                storage = act.checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED;
            o.put("storage", storage);
            boolean alarm = true;
            if (Build.VERSION.SDK_INT >= 31) {
                android.app.AlarmManager am = (android.app.AlarmManager) act.getSystemService(Context.ALARM_SERVICE);
                try { alarm = am != null && am.canScheduleExactAlarms(); } catch (Throwable ignored) {}
            }
            o.put("exactAlarm", alarm);
            o.put("sdk", Build.VERSION.SDK_INT);
            return o.toString();
        } catch (Exception e) { return "{}"; }
    }

    @JavascriptInterface public void requestPermission(final String kind) {
        ui.post(new Runnable() { public void run() {
            try {
                if ("notif".equals(kind)) { requestNotifPermission(); }
                else if ("install".equals(kind)) {
                    if (Build.VERSION.SDK_INT >= 26) {
                        Intent i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                                Uri.parse("package:" + act.getPackageName()));
                        act.startActivity(i);
                    }
                }
                else if ("storage".equals(kind)) {
                    if (Build.VERSION.SDK_INT < 29)
                        act.requestPermissions(new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, REQ_LEGACY_WRITE);
                    else openSettings("app");
                }
                else if ("alarm".equals(kind)) {
                    if (Build.VERSION.SDK_INT >= 31) {
                        try { act.startActivity(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
                                Uri.parse("package:" + act.getPackageName()))); }
                        catch (Throwable t) { openSettings("app"); }
                    }
                }
            } catch (Throwable t) { Log.w(TAG, "requestPermission " + kind, t); openSettings("app"); }
        }});
    }

    @JavascriptInterface public void openSettings(final String kind) {
        ui.post(new Runnable() { public void run() {
            try {
                Intent i;
                if ("notification".equals(kind) && Build.VERSION.SDK_INT >= 26) {
                    i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                    i.putExtra(Settings.EXTRA_APP_PACKAGE, act.getPackageName());
                } else {
                    i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                    i.setData(Uri.parse("package:" + act.getPackageName()));
                }
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                act.startActivity(i);
            } catch (Throwable t) { Log.w(TAG, "openSettings", t); }
        }});
    }

    /* ═══════════ files & sharing ═══════════ */
    @JavascriptInterface public String saveImage(String b64, String filename) {
        try {
            byte[] data = Base64.decode(b64, Base64.DEFAULT);
            if (Build.VERSION.SDK_INT >= 29) {
                ContentValues cv = new ContentValues();
                cv.put(MediaStore.Images.Media.DISPLAY_NAME, filename);
                cv.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
                cv.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/Satlok Seva");
                cv.put(MediaStore.Images.Media.IS_PENDING, 1);
                Uri uri = act.getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, cv);
                if (uri == null) throw new Exception("MediaStore insert failed");
                OutputStream os = act.getContentResolver().openOutputStream(uri);
                if (os == null) throw new Exception("no output stream");
                os.write(data); os.close();
                cv.clear(); cv.put(MediaStore.Images.Media.IS_PENDING, 0);
                act.getContentResolver().update(uri, cv, null, null);
                return "{\"ok\":true,\"path\":" + SecureStore.quote("Pictures/Satlok Seva/" + filename) + "}";
            } else {
                if (act.checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                    requestPermission("storage");
                    return "{\"ok\":false,\"error\":\"storage permission needed\"}";
                }
                File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), "Satlok Seva");
                if (!dir.exists()) dir.mkdirs();
                File f = new File(dir, filename);
                SecureStore.writeAtomic(f, data);
                act.sendBroadcast(new Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE, Uri.fromFile(f)));
                return "{\"ok\":true,\"path\":" + SecureStore.quote(f.getAbsolutePath()) + "}";
            }
        } catch (Throwable t) {
            Log.e(TAG, "saveImage", t);
            return OtaManager.err(t.getMessage());
        }
    }

    @JavascriptInterface public String shareImage(String b64, final String filename, final String text) {
        try {
            byte[] data = Base64.decode(b64, Base64.DEFAULT);
            File dir = new File(act.getCacheDir(), "share");
            if (!dir.exists()) dir.mkdirs();
            // keep the share dir small
            File[] old = dir.listFiles();
            if (old != null && old.length > 12) for (File o : old) o.delete();
            final File f = new File(dir, filename);
            SecureStore.writeAtomic(f, data);
            final Uri uri = Uri.parse("content://org.satlok.seva.files/share/" + filename);
            ui.post(new Runnable() { public void run() {
                try {
                    Intent i = new Intent(Intent.ACTION_SEND);
                    i.setType("image/png");
                    i.putExtra(Intent.EXTRA_STREAM, uri);
                    if (text != null && text.length() > 0) i.putExtra(Intent.EXTRA_TEXT, text);
                    i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    i.setClipData(android.content.ClipData.newRawUri("banner", uri));
                    act.startActivity(Intent.createChooser(i, "Share"));
                } catch (Throwable t) { Log.e(TAG, "shareImage", t); }
            }});
            return "{\"ok\":true}";
        } catch (Throwable t) { return OtaManager.err(t.getMessage()); }
    }

    @JavascriptInterface public String saveText(String content, String filename, String mime) {
        pendingSaveContent = content; pendingSaveName = filename;
        pendingSaveMime = mime == null ? "application/octet-stream" : mime;
        pendingSaveReq = "save";
        ui.post(new Runnable() { public void run() {
            try {
                Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("*/*");
                i.putExtra(Intent.EXTRA_TITLE, pendingSaveName);
                act.startActivityForResult(i, REQ_CREATE_FILE);
            } catch (Throwable t) {
                Log.e(TAG, "saveText", t);
                emit("fileSaved", "{\"ok\":false,\"error\":" + SecureStore.quote(t.getMessage()) + "}");
            }
        }});
        return "{\"ok\":true,\"pending\":true}";
    }

    @JavascriptInterface public void shareText(final String text) {
        ui.post(new Runnable() { public void run() {
            try {
                Intent i = new Intent(Intent.ACTION_SEND);
                i.setType("text/plain");
                i.putExtra(Intent.EXTRA_TEXT, text);
                act.startActivity(Intent.createChooser(i, "Share"));
            } catch (Throwable t) { Log.w(TAG, "shareText", t); }
        }});
    }

    @JavascriptInterface public void pickFile(String reqId) {
        pendingPickReq = reqId;
        ui.post(new Runnable() { public void run() {
            try {
                Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("*/*");
                act.startActivityForResult(i, REQ_PICK_FILE);
            } catch (Throwable t) { Log.e(TAG, "pickFile", t); }
        }});
    }

    /* ═══════════ networking ═══════════ */
    @JavascriptInterface public String httpGet(String url) {
        Http.Result r = Http.getText(url);
        JSONObject o = new JSONObject();
        try {
            o.put("status", r.status);
            o.put("body", r.body == null ? "" : r.body);
            if (r.error != null) o.put("error", r.error);
        } catch (Exception ignored) {}
        return o.toString();
    }

    @JavascriptInterface public boolean canInstall() {
        if (Build.VERSION.SDK_INT < 26) return true;
        try { return act.getPackageManager().canRequestPackageInstalls(); }
        catch (Throwable t) { return false; }
    }

    /** Async task runner — keeps the JS thread free so progress can render. */
    @JavascriptInterface public String startTask(final String reqId, final String op, final String argsJson) {
        final JSONObject args;
        try { args = new JSONObject(argsJson == null ? "{}" : argsJson); }
        catch (Exception e) { return OtaManager.err("bad args"); }
        new Thread(new Runnable() { public void run() {
            String result;
            try {
                if ("otaFetch".equals(op)) {
                    result = ota.fetch(args.getString("url"), args.getString("path"), args.optString("sha", ""));
                } else if ("downloadApk".equals(op)) {
                    result = downloadApkInternal(args.getString("url"), args.optString("sha", ""), reqId);
                } else {
                    result = OtaManager.err("unknown op: " + op);
                }
            } catch (Throwable t) { result = OtaManager.err(t.getMessage()); }
            try {
                JSONObject env = new JSONObject(result);
                env.put("reqId", reqId);
                emit("task", env.toString());
            } catch (Exception e) {
                emit("task", "{\"reqId\":" + SecureStore.quote(reqId) + ",\"ok\":false,\"error\":\"bad result\"}");
            }
        }}, "task-" + op).start();
        return "{\"ok\":true,\"started\":true}";
    }

    private String downloadApkInternal(String url, String sha, final String reqId) {
        try {
            File dir = new File(act.getFilesDir(), "update");
            if (!dir.exists()) dir.mkdirs();
            File[] old = dir.listFiles();
            if (old != null) for (File o : old) o.delete();
            final File f = new File(dir, "satlok-seva-update.apk");
            Http.Result r = Http.download(url, f, new Http.Progress() {
                public void on(long read, long total) {
                    emit("downloadProgress", "{\"reqId\":" + SecureStore.quote(reqId) +
                            ",\"read\":" + read + ",\"total\":" + total + "}");
                }
            });
            if (r.status < 200 || r.status >= 300 || r.error != null) {
                f.delete();
                return OtaManager.err(r.error == null ? ("HTTP " + r.status) : r.error);
            }
            String got = OtaManager.sha256(f);
            boolean verified = true;
            if (sha != null && sha.length() == 64) {
                verified = sha.equalsIgnoreCase(got);
                if (!verified) { f.delete(); return "{\"ok\":false,\"verified\":false,\"error\":\"sha256 mismatch\"}"; }
            }
            JSONObject o = new JSONObject();
            o.put("ok", true).put("path", f.getAbsolutePath()).put("size", f.length())
             .put("sha256", got).put("verified", verified);
            return o.toString();
        } catch (Throwable t) { return OtaManager.err(t.getMessage()); }
    }

    @JavascriptInterface public void installApk(final String path) {
        ui.post(new Runnable() { public void run() {
            try {
                File f = (path == null || path.length() == 0)
                        ? new File(new File(act.getFilesDir(), "update"), "satlok-seva-update.apk")
                        : new File(path);
                if (!f.exists()) { emit("installResult", "{\"ok\":false,\"error\":\"file missing\"}"); return; }
                if (!canInstall()) { requestPermission("install"); emit("installResult", "{\"ok\":false,\"error\":\"permission\"}"); return; }
                Uri uri = Uri.parse("content://org.satlok.seva.files/update/" + f.getName());
                Intent i = new Intent(Intent.ACTION_INSTALL_PACKAGE);
                i.setDataAndType(uri, "application/vnd.android.package-archive");
                i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                i.putExtra(Intent.EXTRA_RETURN_RESULT, false);
                i.setClipData(android.content.ClipData.newRawUri("apk", uri));
                act.startActivity(i);
                emit("installResult", "{\"ok\":true}");
            } catch (Throwable t) {
                Log.e(TAG, "installApk", t);
                emit("installResult", "{\"ok\":false,\"error\":" + SecureStore.quote(t.getMessage()) + "}");
            }
        }});
    }

    /* ═══════════ OTA ═══════════ */
    @JavascriptInterface public String otaState() { return ota.state(); }
    @JavascriptInterface public String otaBegin(String v) { return ota.begin(v); }
    @JavascriptInterface public String otaFetch(String url, String path, String sha) { return ota.fetch(url, path, sha); }
    @JavascriptInterface public String otaCommit(String v, String manifest) { return ota.commit(v, manifest); }
    @JavascriptInterface public String otaRollback() { return ota.rollback(); }
    @JavascriptInterface public void   otaConfirmBoot() { ota.confirmBoot(); }
    @JavascriptInterface public String otaReset() { return ota.reset(); }

    /* ═══════════ misc ═══════════ */
    @JavascriptInterface public void vibrate(final int ms) {
        ui.post(new Runnable() { public void run() {
            try {
                Vibrator v = (Vibrator) act.getSystemService(Context.VIBRATOR_SERVICE);
                if (v == null || !v.hasVibrator()) return;
                if (Build.VERSION.SDK_INT >= 26)
                    v.vibrate(android.os.VibrationEffect.createOneShot(Math.min(ms, 400), android.os.VibrationEffect.DEFAULT_AMPLITUDE));
                else v.vibrate(Math.min(ms, 400));
            } catch (Throwable ignored) {}
        }});
    }

    @JavascriptInterface public void restartApp() {
        ui.post(new Runnable() { public void run() { act.restartWebView(); }});
    }
    @JavascriptInterface public void exitApp() {
        ui.post(new Runnable() { public void run() { act.finish(); }});
    }
    @JavascriptInterface public void log(String tag, String msg) { Log.i("JS:" + tag, msg); }

    @JavascriptInterface public void setStatusBar(final String hex, final boolean lightContent) {
        ui.post(new Runnable() { public void run() {
            try {
                int color = android.graphics.Color.parseColor(hex);
                act.getWindow().setStatusBarColor(color);
                if (Build.VERSION.SDK_INT >= 30) {
                    act.getWindow().getInsetsController().setSystemBarsAppearance(
                            lightContent ? 0 : android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS,
                            android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS);
                } else if (Build.VERSION.SDK_INT >= 23) {
                    View d = act.getWindow().getDecorView();
                    int f = d.getSystemUiVisibility();
                    if (lightContent) d.setSystemUiVisibility(f & ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
                    else d.setSystemUiVisibility(f | View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
                }
            } catch (Throwable ignored) {}
        }});
    }

    @JavascriptInterface public void keepAwake(final boolean on) {
        ui.post(new Runnable() { public void run() {
            if (on) act.getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            else act.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        }});
    }

    /* ═══════════ event emit ═══════════ */
    void emit(final String name, final String jsonPayload) {
        final String js = "window.SatlokEvent && window.SatlokEvent(" +
                SecureStore.quote(name) + "," + SecureStore.quote(jsonPayload) + ");";
        ui.post(new Runnable() { public void run() { act.evalJs(js); }});
    }
}
