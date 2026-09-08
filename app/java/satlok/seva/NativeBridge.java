package satlok.seva;

import android.app.Activity;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.Manifest;
import android.view.View;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Calendar;
import java.util.Map;
import org.json.JSONObject;

public class NativeBridge {
    private final Activity act;
    private final WebView web;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final CryptoStore crypto;
    private final Thread pool;

    public NativeBridge(Activity act, WebView web) {
        this.act = act;
        this.web = web;
        this.crypto = new CryptoStore(act);
        pool = new Thread();
    }

    /* ---------------- helpers ---------------- */
    private SharedPreferences prefs() { return act.getSharedPreferences("ssv", Context.MODE_PRIVATE); }
    public void postEvent(final String type, final JSONObject payload) {
        final String pj = payload == null ? "{}" : payload.toString();
        main.post(new Runnable() { public void run() {
            web.evaluateJavascript("window.onNativeEvent && window.onNativeEvent('" + type + "'," + jsonStr(pj) + ")", null);
        }});
    }
    private static String jsonStr(String s) {
        // embed as JS string literal
        return "'" + s.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n").replace("\r", "") + "'";
    }
    private void bg(final Runnable r) {
        new Thread(r).start();
    }
    private File webDir() { return new File(act.getFilesDir(), "web"); }
    private File backupDir() { return new File(act.getFilesDir(), "web_backup"); }
    private File stagingDir() { File f = new File(act.getFilesDir(), "staging"); if (!f.exists()) f.mkdirs(); return f; }
    private boolean safeRel(String rel) {
        if (rel == null || rel.length() == 0 || rel.length() > 400) return false;
        if (rel.contains("..")) return false;
        return true;
    }

    public byte[] resolveWebFile(String rel) {
        if (!safeRel(rel)) return null;
        File f = new File(webDir(), rel);
        if (f.exists() && f.isFile()) {
            try { return readAll(new FileInputStream(f)); } catch (Exception e) { return null; }
        }
        try {
            InputStream in = act.getAssets().open("web/" + rel);
            return readAll(in);
        } catch (Exception e) { return null; }
    }
    static byte[] readAll(InputStream in) throws Exception {
        ByteArrayOutputStream bo = new ByteArrayOutputStream();
        byte[] buf = new byte[8192]; int n;
        while ((n = in.read(buf)) > 0) bo.write(buf, 0, n);
        in.close();
        return bo.toByteArray();
    }
    public void onPageReady() { /* reserved */ }

    /* ---------------- info ---------------- */
    @JavascriptInterface
    public String getAppInfo() {
        try {
            JSONObject o = new JSONObject();
            o.put("versionName", MainActivity.VERSION_NAME);
            o.put("versionCode", MainActivity.VERSION_CODE);
            o.put("packageName", act.getPackageName());
            o.put("android", Build.VERSION.RELEASE);
            o.put("sdk", Build.VERSION.SDK_INT);
            o.put("native", true);
            return o.toString();
        } catch (Exception e) { return "{}"; }
    }

    /* ---------------- encrypted store ---------------- */
    @JavascriptInterface
    public boolean storeSave(String key, String b64plain) {
        try {
            byte[] plain = Base64.decode(b64plain, Base64.DEFAULT);
            byte[] packed = crypto.pack(plain);   // deflate + AES-256-GCM
            File f = new File(act.getFilesDir(), "store/" + key + ".dat");
            f.getParentFile().mkdirs();
            FileOutputStream fo = new FileOutputStream(f);
            fo.write(packed); fo.close();
            return true;
        } catch (Exception e) { return false; }
    }
    @JavascriptInterface
    public String storeLoad(String key) {
        try {
            File f = new File(act.getFilesDir(), "store/" + key + ".dat");
            if (!f.exists()) return "";
            byte[] packed = readAll(new FileInputStream(f));
            byte[] plain = crypto.unpack(packed);
            return Base64.encodeToString(plain, Base64.NO_WRAP);
        } catch (Exception e) { return ""; }
    }
    @JavascriptInterface
    public boolean storeDelete(String key) {
        return new File(act.getFilesDir(), "store/" + key + ".dat").delete();
    }
    @JavascriptInterface
    public String prefsGet(String key) { return prefs().getString(key, ""); }
    @JavascriptInterface
    public boolean prefsSet(String key, String val) { prefs().edit().putString(key, val).apply(); return true; }

    /* ---------------- notifications ---------------- */
    private void ensureChannels() {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) act.getSystemService(Context.NOTIFICATION_SERVICE);
        String[][] ch = { {"updates", "App updates", "2"}, {"events", "Events & notices", "3"}, {"reminder", "Seva reminder", "4"} };
        for (String[] c : ch) {
            if (nm.getNotificationChannel(c[0]) == null) {
                NotificationChannel n = new NotificationChannel(c[0], c[1], Integer.parseInt(c[2]));
                nm.createNotificationChannel(n);
            }
        }
    }
    @JavascriptInterface
    public String notificationPermission() {
        if (Build.VERSION.SDK_INT >= 33) {
            return act.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED ? "granted" : "denied";
        }
        return "granted";
    }
    @JavascriptInterface
    public void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33) {
            act.requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 4001);
        }
    }
    @JavascriptInterface
    public boolean postNotification(String title, String body, String channel) {
        ensureChannels();
        NotificationManager nm = (NotificationManager) act.getSystemService(Context.NOTIFICATION_SERVICE);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26
                ? new Notification.Builder(act, channel == null ? "events" : channel)
                : new Notification.Builder(act);
        b.setSmallIcon(act.getResources().getIdentifier("ic_launcher", "mipmap", act.getPackageName()))
         .setContentTitle(title).setContentText(body).setAutoCancel(true)
         .setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION));
        nm.notify((int) SystemClock.uptimeMillis(), b.build());
        return true;
    }
    @JavascriptInterface
    public boolean scheduleReminder(String id, String title, String body, int hour, int minute, boolean daily) {
        prefs().edit().putBoolean("rem_on", true).putInt("rem_h", hour).putInt("rem_m", minute)
               .putString("rem_title", title).putString("rem_body", body).apply();
        AlarmManager am = (AlarmManager) act.getSystemService(Context.ALARM_SERVICE);
        PendingIntent pi = reminderPi();
        Calendar c = Calendar.getInstance();
        c.set(Calendar.HOUR_OF_DAY, hour); c.set(Calendar.MINUTE, minute); c.set(Calendar.SECOND, 0);
        if (c.getTimeInMillis() <= System.currentTimeMillis()) c.add(Calendar.DAY_OF_YEAR, 1);
        am.setInexactRepeating(AlarmManager.RTC_WAKEUP, c.getTimeInMillis(), AlarmManager.INTERVAL_DAY, pi);
        return true;
    }
    @JavascriptInterface
    public boolean cancelReminder(String id) {
        prefs().edit().putBoolean("rem_on", false).apply();
        ((AlarmManager) act.getSystemService(Context.ALARM_SERVICE)).cancel(reminderPi());
        return true;
    }
    private PendingIntent reminderPi() {
        Intent i = new Intent(act, AlarmReceiver.class);
        return PendingIntent.getBroadcast(act, 9001, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /* ---------------- sharing ---------------- */
    @JavascriptInterface
    public boolean shareText(String text) {
        Intent i = new Intent(Intent.ACTION_SEND);
        i.setType("text/plain"); i.putExtra(Intent.EXTRA_TEXT, text);
        act.startActivity(Intent.createChooser(i, "Share"));
        return true;
    }
    @JavascriptInterface
    public boolean shareImage(String b64png, String name) {
        try {
            byte[] data = Base64.decode(b64png, Base64.DEFAULT);
            File f = new File(act.getCacheDir(), name);
            FileOutputStream fo = new FileOutputStream(f); fo.write(data); fo.close();
            Uri u = MyFileProvider.getUri(act, f);
            Intent i = new Intent(Intent.ACTION_SEND);
            i.setType("image/png"); i.putExtra(Intent.EXTRA_STREAM, u);
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            act.startActivity(Intent.createChooser(i, "Share"));
            return true;
        } catch (Exception e) { return false; }
    }

    /* ---------------- http + downloads ---------------- */
    @JavascriptInterface
    public void httpGet(final String id, final String url) {
        bg(new Runnable() { public void run() {
            JSONObject o = new JSONObject();
            try {
                HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
                c.setConnectTimeout(15000); c.setReadTimeout(20000);
                c.setRequestProperty("User-Agent", "SatlokSeva/" + MainActivity.VERSION_NAME);
                int code = c.getResponseCode();
                byte[] body = code >= 200 && code < 400 ? readAll(c.getInputStream()) : new byte[0];
                o.put("ok", code >= 200 && code < 400); o.put("status", code);
                o.put("b64", Base64.encodeToString(body, Base64.NO_WRAP));
            } catch (Exception e) { try { o.put("ok", false); o.put("status", 0); } catch (Exception ee) {} }
            postEvent("http." + id, o);
        }});
    }
    @JavascriptInterface
    public void downloadToFile(final String url, final String name) {
        bg(new Runnable() { public void run() {
            final File dest = new File(stagingDir(), sanitize(name));
            try {
                HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
                c.setConnectTimeout(20000); c.setReadTimeout(60000);
                c.setRequestProperty("User-Agent", "SatlokSeva/" + MainActivity.VERSION_NAME);
                if (c.getResponseCode() / 100 != 2) throw new Exception("http " + c.getResponseCode());
                int total = c.getContentLength();
                InputStream in = c.getInputStream();
                FileOutputStream fo = new FileOutputStream(dest);
                byte[] buf = new byte[16384]; int n; long done = 0; long lastEv = 0;
                while ((n = in.read(buf)) > 0) {
                    fo.write(buf, 0, n); done += n;
                    long now = SystemClock.uptimeMillis();
                    if (now - lastEv > 250) {
                        lastEv = now;
                        final long d = done, t = total;
                        JSONObject p = new JSONObject(); p.put("type", "progress"); p.put("done", d); p.put("total", t);
                        postEvent("dl." + sanitize(name), p);
                    }
                }
                fo.close(); in.close();
                JSONObject p = new JSONObject(); p.put("type", "done"); p.put("ok", true);
                postEvent("dl." + sanitize(name), p);
            } catch (Exception e) {
                JSONObject p = new JSONObject(); try { p.put("type", "error"); p.put("msg", String.valueOf(e.getMessage())); } catch (Exception ee) {}
                postEvent("dl." + sanitize(name), p);
            }
        }});
    }
    private static String sanitize(String n) { return n.replaceAll("[^A-Za-z0-9._\\-]", "_"); }

    @JavascriptInterface
    public String stagingSha256(String name) { return fileSha(new File(stagingDir(), sanitize(name))); }
    @JavascriptInterface
    public String readStagingB64(String name) {
        try { return Base64.encodeToString(readAll(new FileInputStream(new File(stagingDir(), sanitize(name)))), Base64.NO_WRAP); }
        catch (Exception e) { return ""; }
    }
    static String fileSha(File f) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            InputStream in = new FileInputStream(f);
            byte[] buf = new byte[16384]; int n;
            while ((n = in.read(buf)) > 0) md.update(buf, 0, n);
            in.close();
            StringBuilder sb = new StringBuilder();
            for (byte b : md.digest()) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) { return ""; }
    }

    /* ---------------- web patch application ---------------- */
    @JavascriptInterface
    public boolean applyStagedFile(String stagingName, String relPath) {
        if (!safeRel(relPath)) return false;
        File src = new File(stagingDir(), sanitize(stagingName));
        File dst = new File(webDir(), relPath);
        try {
            if (dst.exists()) {
                File bk = new File(backupDir(), relPath);
                bk.getParentFile().mkdirs();
                copy(dst, bk);
            }
            dst.getParentFile().mkdirs();
            copy(src, dst);
            src.delete();
            return true;
        } catch (Exception e) { return false; }
    }
    @JavascriptInterface
    public boolean deleteWebFile(String relPath) {
        if (!safeRel(relPath)) return false;
        return new File(webDir(), relPath).delete();
    }
    @JavascriptInterface
    public String webFileSha256(String relPath) {
        if (!safeRel(relPath)) return "";
        File f = new File(webDir(), relPath);
        if (f.exists()) return fileSha(f);
        byte[] a = resolveWebFile(relPath);
        if (a == null) return "";
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            StringBuilder sb = new StringBuilder();
            for (byte b : md.digest(a)) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) { return ""; }
    }
    @JavascriptInterface
    public String readWebFile(String relPath) {
        byte[] a = resolveWebFile(relPath);
        return a == null ? "" : Base64.encodeToString(a, Base64.NO_WRAP);
    }
    @JavascriptInterface
    public boolean writeWebFile(String relPath, String b64) {
        if (!safeRel(relPath)) return false;
        try {
            File dst = new File(webDir(), relPath);
            dst.getParentFile().mkdirs();
            FileOutputStream fo = new FileOutputStream(dst);
            fo.write(Base64.decode(b64, Base64.DEFAULT)); fo.close();
            return true;
        } catch (Exception e) { return false; }
    }
    @JavascriptInterface
    public boolean rollbackWeb() {
        File bk = backupDir();
        if (!bk.exists()) return false;
        copyTree(bk, webDir());
        return true;
    }
    @JavascriptInterface
    public void reloadWeb() {
        main.post(new Runnable() { public void run() { web.reload(); } });
    }
    static void copy(File a, File b) throws Exception {
        FileInputStream in = new FileInputStream(a);
        FileOutputStream fo = new FileOutputStream(b);
        byte[] buf = new byte[16384]; int n;
        while ((n = in.read(buf)) > 0) fo.write(buf, 0, n);
        fo.close(); in.close();
    }
    static void copyTree(File srcDir, File dstDir) {
        File[] fs = srcDir.listFiles();
        if (fs == null) return;
        for (File f : fs) {
            File d = new File(dstDir, f.getName());
            if (f.isDirectory()) { d.mkdirs(); copyTree(f, d); }
            else { try { copy(f, d); } catch (Exception e) {} }
        }
    }

    /* ---------------- APK install ---------------- */
    @JavascriptInterface
    public boolean installApk(String stagingName) {
        try {
            File f = new File(stagingDir(), sanitize(stagingName));
            Uri u = MyFileProvider.getUri(act, f);
            Intent i = new Intent(Intent.ACTION_VIEW);
            i.setDataAndType(u, "application/vnd.android.package-archive");
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            act.startActivity(i);
            return true;
        } catch (Exception e) { return false; }
    }

    /* ---------------- backup via SAF ---------------- */
    @JavascriptInterface
    public void exportBackup(String b64data) {
        try {
            byte[] plain = Base64.decode(b64data, Base64.DEFAULT);
            byte[] packed = crypto.pack(plain);
            prefs().edit().putString("pending_backup", Base64.encodeToString(packed, Base64.NO_WRAP)).apply();
            Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            i.setType("application/octet-stream");
            i.putExtra(Intent.EXTRA_TITLE, "satlok-seva-backup-" + System.currentTimeMillis() / 1000 + ".ssv");
            i.addCategory(Intent.CATEGORY_OPENABLE);
            act.startActivityForResult(i, MainActivity.REQ_BACKUP_CREATE);
        } catch (Exception e) {
            JSONObject o = new JSONObject(); try { o.put("ok", false); } catch (Exception ee) {}
            postEvent("backup.saved", o);
        }
    }
    @JavascriptInterface
    public void importBackup() {
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        i.setType("*/*"); i.addCategory(Intent.CATEGORY_OPENABLE);
        act.startActivityForResult(i, MainActivity.REQ_BACKUP_OPEN);
    }
    public void onActivityFileResult(int req, int res, Intent data) {
        final JSONObject o = new JSONObject();
        if (res != Activity.RESULT_OK || data == null || data.getData() == null) {
            try { o.put("ok", false); } catch (Exception e) {}
            postEvent(req == MainActivity.REQ_BACKUP_CREATE ? "backup.saved" : "backup.picked", o);
            return;
        }
        final Uri uri = data.getData();
        final int rq = req;
        bg(new Runnable() { public void run() {
            try {
                if (rq == MainActivity.REQ_BACKUP_CREATE) {
                    String b64 = prefs().getString("pending_backup", "");
                    OutputStream os = act.getContentResolver().openOutputStream(uri);
                    os.write(Base64.decode(b64, Base64.DEFAULT)); os.close();
                    o.put("ok", true);
                    postEvent("backup.saved", o);
                } else {
                    InputStream in = act.getContentResolver().openInputStream(uri);
                    byte[] packed = readAll(in);
                    byte[] plain = crypto.unpack(packed);
                    o.put("ok", true); o.put("b64", Base64.encodeToString(plain, Base64.NO_WRAP));
                    postEvent("backup.picked", o);
                }
            } catch (Exception e) {
                try { o.put("ok", false); } catch (Exception ee) {}
                postEvent(rq == MainActivity.REQ_BACKUP_CREATE ? "backup.saved" : "backup.picked", o);
            }
        }});
    }

    /* ---------------- misc ---------------- */
    @JavascriptInterface
    public void vibrate(int ms) {
        android.os.Vibrator v = (android.os.Vibrator) act.getSystemService(Context.VIBRATOR_SERVICE);
        if (v != null) v.vibrate(ms);
    }
    @JavascriptInterface
    public void setStatusBar(final boolean lightIconsOnDark_unused_darkText) {
        main.post(new Runnable() { public void run() {
            try {
                android.view.Window w = act.getWindow();
                if (Build.VERSION.SDK_INT >= 30) {
                    w.getInsetsController().setSystemBarsAppearance(
                        lightIconsOnDark_unused_darkText ? android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS : 0,
                        android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS);
                } else if (Build.VERSION.SDK_INT >= 23) {
                    View dec = w.getDecorView();
                    int f = dec.getSystemUiVisibility();
                    if (lightIconsOnDark_unused_darkText) f |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR; else f &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                    dec.setSystemUiVisibility(f);
                }
            } catch (Exception e) {}
        }});
    }
    @JavascriptInterface
    public void exitApp() {
        main.post(new Runnable() { public void run() { act.finishAffinity(); } });
    }
}
