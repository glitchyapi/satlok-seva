package org.satlok.seva;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.StatFs;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.MediaStore;
import android.provider.Settings;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/** The single JS ⇄ Java surface. Everything the web bundle can ask the OS for. */
public class Bridge {

    private final MainActivity a;
    private final SecureStore vault;
    private String pendingExport = null;

    public Bridge(MainActivity a) { this.a = a; this.vault = new SecureStore(a); }

    // ---- helpers ------------------------------------------------------------

    /** Safe JS string literal. */
    public static String q(String s) {
        if (s == null) return "null";
        StringBuilder b = new StringBuilder("\"");
        for (char c : s.toCharArray()) {
            switch (c) {
                case '"': b.append("\\\""); break;
                case '\\': b.append("\\\\"); break;
                case '\n': b.append("\\n"); break;
                case '\r': b.append("\\r"); break;
                case '\t': b.append("\\t"); break;
                case '<': b.append("\\u003c"); break;
                case '>': b.append("\\u003e"); break;
                case '&': b.append("\\u0026"); break;
                case '\u2028': b.append("\\u2028"); break;
                case '\u2029': b.append("\\u2029"); break;
                default:
                    if (c < 0x20) b.append(String.format("\\u%04x", (int) c));
                    else b.append(c);
            }
        }
        return b.append('"').toString();
    }

    private static String err(Exception e) {
        return "{\"ok\":false,\"error\":" + q(String.valueOf(e.getMessage())) + "}";
    }

    // ---- lifecycle / info ---------------------------------------------------

    @JavascriptInterface public void bootOk() { a.confirmBoot(); }

    @JavascriptInterface public String info() {
        try {
            PackageInfo pi = a.getPackageManager().getPackageInfo(a.getPackageName(), 0);
            JSONObject o = new JSONObject();
            o.put("shellCode", Build.VERSION.SDK_INT >= 28 ? pi.getLongVersionCode() : pi.versionCode);
            o.put("shellName", pi.versionName);
            o.put("webVersion", a.ota.installedWebVersion());
            o.put("webBuild", a.ota.installedWebBuild());
            o.put("sdk", Build.VERSION.SDK_INT);
            o.put("release", Build.VERSION.RELEASE);
            o.put("brand", Build.BRAND);
            o.put("model", Build.MODEL);
            o.put("device", Build.DEVICE);
            o.put("locale", Locale.getDefault().toString());
            o.put("notifAllowed", Notify.allowed(a));
            o.put("canInstall", canInstall());
            o.put("manifestUrl", a.ota.manifestUrl());
            o.put("overlay", a.ota.hasOverlay());
            o.put("freeBytes", new StatFs(a.getFilesDir().getAbsolutePath()).getAvailableBytes());
            o.put("exactAlarms", exactAlarms());
            return o.toString();
        } catch (Exception e) { return err(e); }
    }

    @JavascriptInterface public boolean online() {
        try {
            ConnectivityManager cm = (ConnectivityManager) a.getSystemService(Context.CONNECTIVITY_SERVICE);
            NetworkInfo ni = cm.getActiveNetworkInfo();
            return ni != null && ni.isConnected();
        } catch (Exception e) { return true; }
    }

    @JavascriptInterface public void setTheme(final boolean dark) { a.applySystemBars(dark); }
    @JavascriptInterface public void keepAwake(final boolean on) { a.keepScreenOn(on); }
    @JavascriptInterface public void exit() { a.runOnUiThread(() -> a.finish()); }

    @JavascriptInterface public void toast(final String msg) {
        a.runOnUiThread(() -> Toast.makeText(a, msg, Toast.LENGTH_SHORT).show());
    }

    @JavascriptInterface public void vibrate(int ms) {
        try {
            Vibrator v = (Vibrator) a.getSystemService(Context.VIBRATOR_SERVICE);
            if (v == null || !v.hasVibrator()) return;
            if (Build.VERSION.SDK_INT >= 26)
                v.vibrate(VibrationEffect.createOneShot(Math.min(ms, 400), VibrationEffect.DEFAULT_AMPLITUDE));
            else v.vibrate(Math.min(ms, 400));
        } catch (Exception ignored) { }
    }

    @JavascriptInterface public void openUrl(String url) {
        try { a.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); }
        catch (Exception e) { toast("No app can open this link"); }
    }

    // ---- encrypted vault ----------------------------------------------------

    @JavascriptInterface public String vaultWrite(String name, String json) {
        try { return "{\"ok\":true," + vault.write(name, json).substring(1); }
        catch (Exception e) { return err(e); }
    }

    @JavascriptInterface public String vaultRead(String name) {
        try {
            String v = vault.read(name);
            if (v == null) return "{\"ok\":true,\"data\":null}";
            return "{\"ok\":true,\"data\":" + q(v) + "}";
        } catch (Exception e) { return err(e); }
    }

    @JavascriptInterface public String vaultDelete(String name) {
        return "{\"ok\":" + vault.delete(name) + "}";
    }

    @JavascriptInterface public String vaultList() {
        return "{\"ok\":true,\"keys\":" + vault.list() + "}";
    }

    /** Portable, PIN-encrypted backup blob produced by the JS layer. */
    @JavascriptInterface public String vaultWriteRaw(String name, String b64) {
        try {
            File dir = new File(a.getFilesDir(), "vault");
            dir.mkdirs();
            File f = new File(dir, name.replaceAll("[^a-zA-Z0-9_.-]", "_") + ".ssvb");
            try (FileOutputStream o = new FileOutputStream(f)) { o.write(Base64.decode(b64, Base64.NO_WRAP)); }
            return "{\"ok\":true,\"size\":" + f.length() + "}";
        } catch (Exception e) { return err(e); }
    }

    // ---- notifications ------------------------------------------------------

    @JavascriptInterface public boolean notifAllowed() { return Notify.allowed(a); }

    @JavascriptInterface public void notify(int id, String channel, String title, String body, String tab) {
        Notify.show(a, id, channel, title, body, tab);
    }

    @JavascriptInterface public String scheduleReminders(String json) {
        try { Notify.scheduleAll(a, json); return "{\"ok\":true}"; }
        catch (Exception e) { return err(e); }
    }

    @JavascriptInterface public void openNotifSettings() {
        try {
            Intent i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                    .putExtra(Settings.EXTRA_APP_PACKAGE, a.getPackageName());
            a.startActivity(i);
        } catch (Exception e) { openAppSettings(); }
    }

    @JavascriptInterface public void openAppSettings() {
        try {
            a.startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                    Uri.parse("package:" + a.getPackageName())));
        } catch (Exception ignored) { }
    }

    @JavascriptInterface public boolean exactAlarms() {
        if (Build.VERSION.SDK_INT >= 31) {
            try {
                android.app.AlarmManager am = (android.app.AlarmManager) a.getSystemService(Context.ALARM_SERVICE);
                return am.canScheduleExactAlarms();
            } catch (Throwable t) { return false; }
        }
        return true;
    }

    @JavascriptInterface public void openAlarmSettings() {
        if (Build.VERSION.SDK_INT >= 31) {
            try {
                a.startActivity(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
                        Uri.parse("package:" + a.getPackageName())));
            } catch (Exception e) { openAppSettings(); }
        }
    }

    /** perms is a JSON array of short names: notifications, storage, photos */
    @JavascriptInterface public void requestPerms(String json, String cbId) {
        try {
            org.json.JSONArray in = new org.json.JSONArray(json);
            java.util.List<String> p = new java.util.ArrayList<>();
            for (int i = 0; i < in.length(); i++) {
                String n = in.getString(i);
                if ("notifications".equals(n) && Build.VERSION.SDK_INT >= 33)
                    p.add("android.permission.POST_NOTIFICATIONS");
                else if ("photos".equals(n) && Build.VERSION.SDK_INT >= 33)
                    p.add("android.permission.READ_MEDIA_IMAGES");
                else if ("storage".equals(n) && Build.VERSION.SDK_INT <= 28) {
                    p.add("android.permission.WRITE_EXTERNAL_STORAGE");
                    p.add("android.permission.READ_EXTERNAL_STORAGE");
                }
            }
            if (p.isEmpty()) {
                a.eval("window.__nativeCallback && window.__nativeCallback(" + q(cbId) + ",{\"granted\":true})");
                return;
            }
            a.runOnUiThread(() -> a.requestPerms(p.toArray(new String[0]), cbId));
        } catch (Exception e) {
            a.eval("window.__nativeCallback && window.__nativeCallback(" + q(cbId) + "," + err(e) + ")");
        }
    }

    @JavascriptInterface public boolean hasPerm(String name) {
        if (Build.VERSION.SDK_INT < 23) return true;
        String p;
        switch (name) {
            case "notifications":
                if (Build.VERSION.SDK_INT < 33) return Notify.allowed(a);
                p = "android.permission.POST_NOTIFICATIONS"; break;
            case "photos":
                p = Build.VERSION.SDK_INT >= 33 ? "android.permission.READ_MEDIA_IMAGES"
                        : "android.permission.READ_EXTERNAL_STORAGE"; break;
            case "storage":
                if (Build.VERSION.SDK_INT > 28) return true; // scoped storage: no permission needed
                p = "android.permission.WRITE_EXTERNAL_STORAGE"; break;
            default: return false;
        }
        return a.checkSelfPermission(p) == android.content.pm.PackageManager.PERMISSION_GRANTED;
    }

    // ---- share / save -------------------------------------------------------

    private File writeShareFile(String dataUrl, String filename) throws Exception {
        File dir = new File(a.getFilesDir(), "share");
        dir.mkdirs();
        File f = new File(dir, filename.replaceAll("[^a-zA-Z0-9_.-]", "_"));
        byte[] data;
        int comma = dataUrl.indexOf(',');
        if (dataUrl.startsWith("data:") && comma > 0) data = Base64.decode(dataUrl.substring(comma + 1), Base64.DEFAULT);
        else data = dataUrl.getBytes("UTF-8");
        try (FileOutputStream o = new FileOutputStream(f)) { o.write(data); }
        return f;
    }

    private Uri shareUri(File f) {
        String rel = f.getAbsolutePath().substring(a.getFilesDir().getAbsolutePath().length() + 1);
        return Uri.parse("content://org.satlok.seva.files/" + rel);
    }

    @JavascriptInterface public String shareImage(String dataUrl, String filename, String text) {
        try {
            File f = writeShareFile(dataUrl, filename);
            Intent i = new Intent(Intent.ACTION_SEND);
            i.setType(filename.endsWith(".jpg") ? "image/jpeg" : "image/png");
            i.putExtra(Intent.EXTRA_STREAM, shareUri(f));
            if (text != null && !text.isEmpty()) i.putExtra(Intent.EXTRA_TEXT, text);
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            a.startActivity(Intent.createChooser(i, "Share"));
            return "{\"ok\":true}";
        } catch (Exception e) { return err(e); }
    }

    @JavascriptInterface public void shareText(String text) {
        try {
            Intent i = new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text);
            a.startActivity(Intent.createChooser(i, "Share"));
        } catch (Exception e) { toast("Share failed"); }
    }

    /** Saves a banner into the public gallery (MediaStore, no legacy permission on 10+). */
    @JavascriptInterface public String saveImage(String dataUrl, String filename) {
        try {
            int comma = dataUrl.indexOf(',');
            byte[] data = Base64.decode(comma > 0 ? dataUrl.substring(comma + 1) : dataUrl, Base64.DEFAULT);
            String mime = filename.endsWith(".jpg") || filename.endsWith(".jpeg") ? "image/jpeg" : "image/png";
            if (Build.VERSION.SDK_INT >= 29) {
                ContentValues cv = new ContentValues();
                cv.put(MediaStore.Images.Media.DISPLAY_NAME, filename);
                cv.put(MediaStore.Images.Media.MIME_TYPE, mime);
                cv.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/Satlok Seva");
                cv.put(MediaStore.Images.Media.IS_PENDING, 1);
                Uri uri = a.getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, cv);
                if (uri == null) throw new Exception("MediaStore insert failed");
                try (OutputStream o = a.getContentResolver().openOutputStream(uri)) { o.write(data); }
                cv.clear(); cv.put(MediaStore.Images.Media.IS_PENDING, 0);
                a.getContentResolver().update(uri, cv, null, null);
            } else {
                File dir = new File(Environment.getExternalStoragePublicDirectory(
                        Environment.DIRECTORY_PICTURES), "Satlok Seva");
                dir.mkdirs();
                File f = new File(dir, filename);
                try (FileOutputStream o = new FileOutputStream(f)) { o.write(data); }
                a.sendBroadcast(new Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE, Uri.fromFile(f)));
            }
            return "{\"ok\":true}";
        } catch (Exception e) { return err(e); }
    }

    // ---- encrypted backup via Storage Access Framework ----------------------

    @JavascriptInterface public String exportBackup(String b64, String filename) {
        pendingExport = b64;
        try {
            Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT)
                    .addCategory(Intent.CATEGORY_OPENABLE)
                    .setType("application/octet-stream")
                    .putExtra(Intent.EXTRA_TITLE, filename);
            a.runOnUiThread(() -> {
                try { a.startActivityForResult(i, MainActivity.REQ_EXPORT); }
                catch (Exception e) { toast("Cannot open file picker"); }
            });
            return "{\"ok\":true,\"pending\":true}";
        } catch (Exception e) { return err(e); }
    }

    public void finishExport(Uri uri) {
        if (pendingExport == null) return;
        try (OutputStream o = a.getContentResolver().openOutputStream(uri)) {
            o.write(Base64.decode(pendingExport, Base64.NO_WRAP));
            a.eval("window.__safResult && window.__safResult(" + MainActivity.REQ_EXPORT + ",true,'saved')");
        } catch (Exception e) {
            a.eval("window.__safResult && window.__safResult(" + MainActivity.REQ_EXPORT + ",false," +
                    q(String.valueOf(e.getMessage())) + ")");
        } finally { pendingExport = null; }
    }

    @JavascriptInterface public void importBackup() {
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT)
                .addCategory(Intent.CATEGORY_OPENABLE).setType("*/*");
        a.runOnUiThread(() -> {
            try { a.startActivityForResult(i, MainActivity.REQ_IMPORT); }
            catch (Exception e) { toast("Cannot open file picker"); }
        });
    }

    public void finishImport(Uri uri) {
        new Thread(() -> {
            try (InputStream in = a.getContentResolver().openInputStream(uri)) {
                java.io.ByteArrayOutputStream o = new java.io.ByteArrayOutputStream();
                byte[] b = new byte[8192]; int n; long total = 0;
                while ((n = in.read(b)) > 0) { total += n; if (total > 64L * 1024 * 1024) throw new Exception("file too large"); o.write(b, 0, n); }
                String b64 = Base64.encodeToString(o.toByteArray(), Base64.NO_WRAP);
                a.eval("window.__safResult && window.__safResult(" + MainActivity.REQ_IMPORT + ",true," + q(b64) + ")");
            } catch (Exception e) {
                a.eval("window.__safResult && window.__safResult(" + MainActivity.REQ_IMPORT + ",false," +
                        q(String.valueOf(e.getMessage())) + ")");
            }
        }).start();
    }

    // ---- OTA ----------------------------------------------------------------

    @JavascriptInterface public void setManifestUrl(String url) { a.ota.setManifestUrl(url); }

    /** Native fetch: sidesteps CORS entirely and works with any file host. */
    @JavascriptInterface public void httpGet(String url, String cbId) {
        new Thread(() -> {
            try {
                String body = a.ota.httpGetString(url);
                a.eval("window.__nativeCallback && window.__nativeCallback(" + q(cbId) +
                        ",{\"ok\":true,\"body\":" + q(body) + "})");
            } catch (Exception e) {
                a.eval("window.__nativeCallback && window.__nativeCallback(" + q(cbId) + "," + err(e) + ")");
            }
        }).start();
    }

    @JavascriptInterface public void otaCheck(String url, String cbId) {
        new Thread(() -> {
            try {
                String m = a.ota.fetchManifest(url);
                a.eval("window.__nativeCallback && window.__nativeCallback(" + q(cbId) +
                        ",{\"ok\":true,\"manifest\":" + q(m) + "})");
            } catch (Exception e) {
                a.eval("window.__nativeCallback && window.__nativeCallback(" + q(cbId) + "," + err(e) + ")");
            }
        }).start();
    }

    @JavascriptInterface public String otaPlan(String manifestJson) {
        try { return "{\"ok\":true,\"plan\":" + a.ota.plan(manifestJson) + "}"; }
        catch (Exception e) { return err(e); }
    }

    @JavascriptInterface public void otaApply(String manifestJson, String cbId) { a.ota.apply(manifestJson, cbId); }

    @JavascriptInterface public String otaRollback() {
        a.ota.rollback("manual");
        return "{\"ok\":true}";
    }

    @JavascriptInterface public void reload() {
        a.runOnUiThread(() -> a.web.loadUrl(MainActivity.ORIGIN + "index.html"));
    }

    @JavascriptInterface public void otaDownloadApk(String url, String sha, String cbId) {
        a.ota.downloadApk(url, sha, cbId);
    }

    @JavascriptInterface public boolean canInstall() {
        if (Build.VERSION.SDK_INT >= 26) return a.getPackageManager().canRequestPackageInstalls();
        return true;
    }

    @JavascriptInterface public void openInstallSettings() {
        if (Build.VERSION.SDK_INT >= 26) {
            try {
                a.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + a.getPackageName())));
            } catch (Exception e) { openAppSettings(); }
        }
    }

    @JavascriptInterface public String installApk(String relPath) {
        try {
            if (!canInstall()) { openInstallSettings(); return "{\"ok\":false,\"needPermission\":true}"; }
            File f = new File(a.getFilesDir(), relPath);
            if (!f.isFile()) return "{\"ok\":false,\"error\":\"APK missing\"}";
            Uri uri = Uri.parse("content://org.satlok.seva.files/" + relPath);
            Intent i = new Intent(Intent.ACTION_VIEW);
            i.setDataAndType(uri, "application/vnd.android.package-archive");
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            a.startActivity(i);
            return "{\"ok\":true}";
        } catch (Exception e) { return err(e); }
    }

    @JavascriptInterface public String now() {
        return new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).format(new Date());
    }
}
