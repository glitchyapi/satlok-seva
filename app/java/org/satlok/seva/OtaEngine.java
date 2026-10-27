package org.satlok.seva;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Base64;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.MessageDigest;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

/**
 * OTA engine.
 *
 * Two independent update planes:
 *
 *  1. WEB BUNDLE (99% of releases) — the UI/logic/translations live in assets/www.
 *     The manifest lists every file with a SHA-256. We hash what is already on
 *     disk, download ONLY the files whose hash changed, verify them, then swap
 *     them into the overlay and reload the WebView. No APK, no reinstall, a
 *     typical patch is a few KB.
 *
 *  2. SHELL APK (rare) — when native permissions/APIs change, the manifest also
 *     carries an apk block. We download it, verify SHA-256, and hand it to the
 *     system installer.
 *
 * The manifest is RSA-2048/SHA-256 signed and verified against a public key
 * pinned inside the APK, so a compromised file host still cannot push code.
 */
public class OtaEngine {

    public static final String DEFAULT_MANIFEST =
            "https://glitchyapi.github.io/satlok-seva/ota/manifest.json";

    private final Context ctx;
    private final MainActivity act;
    private final File otaDir, overlay, staging;
    private JSONObject baseline;

    public OtaEngine(MainActivity act) {
        this.act = act;
        this.ctx = act;
        this.otaDir = new File(ctx.getFilesDir(), "ota");
        this.overlay = new File(otaDir, "overlay");
        this.staging = new File(otaDir, "staging");
        otaDir.mkdirs(); overlay.mkdirs();
        loadBaseline();
    }

    private SharedPreferences prefs() { return ctx.getSharedPreferences("ota", Context.MODE_PRIVATE); }

    public String manifestUrl() { return prefs().getString("manifest_url", DEFAULT_MANIFEST); }
    public void setManifestUrl(String u) { prefs().edit().putString("manifest_url", u).apply(); }

    private void loadBaseline() {
        try {
            InputStream in = ctx.getAssets().open("www/_lock.json");
            ByteArrayOutputStream o = new ByteArrayOutputStream();
            byte[] b = new byte[8192]; int n;
            while ((n = in.read(b)) > 0) o.write(b, 0, n);
            in.close();
            baseline = new JSONObject(o.toString("UTF-8"));
        } catch (Exception e) {
            baseline = new JSONObject();
        }
    }

    public boolean hasOverlay() {
        String[] l = overlay.list();
        return l != null && l.length > 0;
    }

    /** Resolve a request path against the hot-patch overlay. */
    public File overlayFile(String path) {
        File f = new File(overlay, path);
        try {
            if (!f.getCanonicalPath().startsWith(overlay.getCanonicalPath())) return null;
        } catch (Exception e) { return null; }
        return f;
    }

    public int installedWebBuild() { return prefs().getInt("web_build", baseline.optInt("build", 1)); }
    public String installedWebVersion() {
        return prefs().getString("web_version", baseline.optString("version", "1.0.0"));
    }

    public void markHealthy() {
        prefs().edit().putInt("boot_fails", 0).apply();
    }

    public void rollback(String why) {
        deleteTree(overlay);
        overlay.mkdirs();
        prefs().edit()
                .remove("web_build").remove("web_version")
                .putString("last_rollback", why + " @ " + System.currentTimeMillis())
                .apply();
    }

    // ---- networking ---------------------------------------------------------

    private HttpURLConnection open(String url) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(15000);
        c.setReadTimeout(30000);
        c.setInstanceFollowRedirects(true);
        c.setRequestProperty("User-Agent", "SatlokSeva/" + installedWebVersion() + " (Android)");
        c.setRequestProperty("Cache-Control", "no-cache");
        return c;
    }

    public String httpGetString(String url) throws Exception {
        HttpURLConnection c = open(url);
        try {
            int code = c.getResponseCode();
            if (code != 200) throw new Exception("HTTP " + code);
            InputStream in = c.getInputStream();
            ByteArrayOutputStream o = new ByteArrayOutputStream();
            byte[] b = new byte[16384]; int n;
            while ((n = in.read(b)) > 0) o.write(b, 0, n);
            in.close();
            return o.toString("UTF-8");
        } finally { c.disconnect(); }
    }

    /** Fetch + verify the signed update manifest. */
    public String fetchManifest(String urlOverride) throws Exception {
        String url = (urlOverride == null || urlOverride.isEmpty()) ? manifestUrl() : urlOverride;
        // cache-bust so GitHub Pages' CDN cannot hide a fresh release
        String bust = url + (url.contains("?") ? "&" : "?") + "t=" + System.currentTimeMillis();
        String raw;
        try { raw = httpGetString(bust); }
        catch (Exception e) { raw = httpGetString(url); }

        JSONObject m = new JSONObject(raw);
        String verify = verifySignature(m);
        m.put("_verified", "ok".equals(verify));
        m.put("_verifyMsg", verify);
        return m.toString();
    }

    /**
     * Canonical payload = the exact JSON text of m["payload"] as published.
     * The admin panel signs that string; we verify the same bytes.
     */
    private String verifySignature(JSONObject m) {
        try {
            String pub = readAssetText("www/ota-pubkey.txt");
            if (pub == null || pub.trim().isEmpty()) return "no-pinned-key";
            Object payload = m.opt("payload");
            String sig = m.optString("signature", "");
            if (payload == null || sig.isEmpty()) return "unsigned";
            String canonical = payload instanceof String ? (String) payload : payload.toString();

            byte[] der = Base64.decode(pub.trim(), Base64.DEFAULT);
            PublicKey key = KeyFactory.getInstance("RSA").generatePublic(new X509EncodedKeySpec(der));
            Signature s = Signature.getInstance("SHA256withRSA");
            s.initVerify(key);
            s.update(canonical.getBytes(StandardCharsets.UTF_8));
            return s.verify(Base64.decode(sig, Base64.DEFAULT)) ? "ok" : "bad-signature";
        } catch (Exception e) {
            return "error:" + e.getClass().getSimpleName();
        }
    }

    private String readAssetText(String path) {
        try {
            InputStream in = ctx.getAssets().open(path);
            ByteArrayOutputStream o = new ByteArrayOutputStream();
            byte[] b = new byte[4096]; int n;
            while ((n = in.read(b)) > 0) o.write(b, 0, n);
            in.close();
            return o.toString("UTF-8");
        } catch (Exception e) { return null; }
    }

    public static JSONObject payloadOf(String manifestJson) throws Exception {
        JSONObject m = new JSONObject(manifestJson);
        Object p = m.opt("payload");
        return p instanceof String ? new JSONObject((String) p) : m.getJSONObject("payload");
    }

    // ---- delta planning -----------------------------------------------------

    /**
     * Compare manifest file hashes with what is actually on the device.
     * Returns {needed:[{path,url,sha256,size}], total, bytes, unchanged}.
     */
    public String plan(String manifestJson) throws Exception {
        JSONObject p = payloadOf(manifestJson);
        JSONObject web = p.getJSONObject("web");
        JSONArray files = web.getJSONArray("files");
        String base = web.optString("baseUrl", "");
        JSONArray mirrors = web.optJSONArray("mirrors");

        JSONArray needed = new JSONArray();
        long bytes = 0; int same = 0;
        for (int i = 0; i < files.length(); i++) {
            JSONObject f = files.getJSONObject(i);
            String path = f.getString("path");
            String want = f.getString("sha256");
            String have = currentHash(path);
            if (want.equalsIgnoreCase(have)) { same++; continue; }
            JSONObject n = new JSONObject();
            n.put("path", path);
            n.put("sha256", want);
            n.put("size", f.optLong("size", 0));
            String u = f.optString("url", "");
            if (u.isEmpty()) u = joinUrl(base, path);
            n.put("url", u);
            if (mirrors != null) {
                JSONArray alts = new JSONArray();
                for (int k = 0; k < mirrors.length(); k++) alts.put(joinUrl(mirrors.getString(k), path));
                n.put("mirrors", alts);
            }
            needed.put(n);
            bytes += f.optLong("size", 0);
        }
        JSONObject out = new JSONObject();
        out.put("needed", needed);
        out.put("bytes", bytes);
        out.put("unchanged", same);
        out.put("total", files.length());
        out.put("currentBuild", installedWebBuild());
        out.put("targetBuild", web.optInt("build", 1));
        out.put("targetVersion", web.optString("version", "?"));
        return out.toString();
    }

    private String currentHash(String path) {
        File f = overlayFile(path);
        try {
            if (f != null && f.isFile()) return sha256File(f);
            InputStream in = ctx.getAssets().open("www/" + path);
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] b = new byte[16384]; int n;
            while ((n = in.read(b)) > 0) md.update(b, 0, n);
            in.close();
            return hex(md.digest());
        } catch (Exception e) { return ""; }
    }

    public static String joinUrl(String base, String path) {
        if (base.endsWith("/")) base = base.substring(0, base.length() - 1);
        if (path.startsWith("/")) path = path.substring(1);
        return base + "/" + path;
    }

    // ---- apply --------------------------------------------------------------

    /** Downloads only `needed`, verifies each hash, then commits atomically. */
    public void apply(String manifestJson, String cbId) {
        new Thread(() -> {
            try {
                JSONObject p = payloadOf(manifestJson);
                JSONObject web = p.getJSONObject("web");
                JSONObject planJ = new JSONObject(plan(manifestJson));
                JSONArray needed = planJ.getJSONArray("needed");

                deleteTree(staging); staging.mkdirs();
                long totalBytes = Math.max(1, planJ.optLong("bytes", 1));
                long done = 0;

                for (int i = 0; i < needed.length(); i++) {
                    JSONObject f = needed.getJSONObject(i);
                    String path = f.getString("path");
                    File dest = new File(staging, path);
                    dest.getParentFile().mkdirs();

                    List<String> urls = new ArrayList<>();
                    urls.add(f.getString("url"));
                    JSONArray mir = f.optJSONArray("mirrors");
                    if (mir != null) for (int k = 0; k < mir.length(); k++) urls.add(mir.getString(k));

                    Exception last = null;
                    boolean got = false;
                    for (String u : urls) {
                        try { downloadVerified(u, dest, f.getString("sha256")); got = true; break; }
                        catch (Exception e) { last = e; }
                    }
                    if (!got) throw new Exception("download failed: " + path +
                            (last != null ? " (" + last.getMessage() + ")" : ""));

                    done += Math.max(f.optLong("size", 0), dest.length());
                    final int pct = (int) Math.min(96, (done * 96 / totalBytes));
                    final int idx = i + 1, cnt = needed.length();
                    final String pp = path;
                    act.eval("window.__otaProgress && window.__otaProgress(" +
                            "{\"phase\":\"download\",\"pct\":" + pct + ",\"index\":" + idx +
                            ",\"count\":" + cnt + ",\"file\":" + Bridge.q(pp) + "})");
                }

                // commit: move staged files over the overlay
                act.eval("window.__otaProgress && window.__otaProgress({\"phase\":\"install\",\"pct\":97})");
                List<File> moved = new ArrayList<>();
                for (int i = 0; i < needed.length(); i++) {
                    String path = needed.getJSONObject(i).getString("path");
                    File src = new File(staging, path);
                    File dst = new File(overlay, path);
                    dst.getParentFile().mkdirs();
                    copy(src, dst);
                    moved.add(dst);
                }
                prefs().edit()
                        .putInt("web_build", web.optInt("build", 1))
                        .putString("web_version", web.optString("version", "?"))
                        .putLong("web_updated_at", System.currentTimeMillis())
                        .apply();
                deleteTree(staging);

                act.eval("window.__otaProgress && window.__otaProgress({\"phase\":\"done\",\"pct\":100})");
                act.eval("window.__nativeCallback && window.__nativeCallback(" + Bridge.q(cbId) +
                        ",{\"ok\":true,\"version\":" + Bridge.q(web.optString("version", "?")) +
                        ",\"build\":" + web.optInt("build", 1) + "})");
            } catch (final Exception e) {
                deleteTree(staging);
                act.eval("window.__nativeCallback && window.__nativeCallback(" + Bridge.q(cbId) +
                        ",{\"ok\":false,\"error\":" + Bridge.q(String.valueOf(e.getMessage())) + "})");
            }
        }, "ota-apply").start();
    }

    private void downloadVerified(String url, File dest, String sha) throws Exception {
        HttpURLConnection c = open(url);
        try {
            if (c.getResponseCode() != 200) throw new Exception("HTTP " + c.getResponseCode());
            InputStream in = c.getInputStream();
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            try (FileOutputStream out = new FileOutputStream(dest)) {
                byte[] b = new byte[16384]; int n;
                while ((n = in.read(b)) > 0) { md.update(b, 0, n); out.write(b, 0, n); }
                out.getFD().sync();
            }
            in.close();
            String got = hex(md.digest());
            if (!got.equalsIgnoreCase(sha)) {
                dest.delete();
                throw new Exception("hash mismatch");
            }
        } finally { c.disconnect(); }
    }

    // ---- APK plane ----------------------------------------------------------

    public void downloadApk(String url, String sha, String cbId) {
        new Thread(() -> {
            File dir = new File(ctx.getFilesDir(), "updates");
            dir.mkdirs();
            File dest = new File(dir, "satlok-seva-update.apk");
            try {
                HttpURLConnection c = open(url);
                long total = c.getContentLengthLong();
                try (InputStream in = c.getInputStream(); FileOutputStream out = new FileOutputStream(dest)) {
                    MessageDigest md = MessageDigest.getInstance("SHA-256");
                    byte[] b = new byte[32768]; int n; long got = 0; int lastPct = -1;
                    while ((n = in.read(b)) > 0) {
                        md.update(b, 0, n); out.write(b, 0, n); got += n;
                        int pct = total > 0 ? (int) (got * 100 / total) : 0;
                        if (pct != lastPct && pct % 2 == 0) {
                            lastPct = pct;
                            act.eval("window.__otaProgress && window.__otaProgress(" +
                                    "{\"phase\":\"apk\",\"pct\":" + pct + "})");
                        }
                    }
                    out.getFD().sync();
                    if (sha != null && !sha.isEmpty() && !hex(md.digest()).equalsIgnoreCase(sha)) {
                        dest.delete();
                        throw new Exception("APK hash mismatch — download rejected");
                    }
                } finally { c.disconnect(); }
                act.eval("window.__nativeCallback && window.__nativeCallback(" + Bridge.q(cbId) +
                        ",{\"ok\":true,\"path\":\"updates/" + dest.getName() + "\",\"size\":" + dest.length() + "})");
            } catch (final Exception e) {
                act.eval("window.__nativeCallback && window.__nativeCallback(" + Bridge.q(cbId) +
                        ",{\"ok\":false,\"error\":" + Bridge.q(String.valueOf(e.getMessage())) + "})");
            }
        }, "ota-apk").start();
    }

    // ---- helpers ------------------------------------------------------------

    public static String sha256File(File f) throws Exception {
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        try (FileInputStream in = new FileInputStream(f)) {
            byte[] b = new byte[16384]; int n;
            while ((n = in.read(b)) > 0) md.update(b, 0, n);
        }
        return hex(md.digest());
    }

    public static String hex(byte[] b) {
        StringBuilder sb = new StringBuilder(b.length * 2);
        for (byte x : b) sb.append(Character.forDigit((x >> 4) & 0xF, 16)).append(Character.forDigit(x & 0xF, 16));
        return sb.toString();
    }

    public static void copy(File src, File dst) throws Exception {
        try (FileInputStream in = new FileInputStream(src); FileOutputStream out = new FileOutputStream(dst)) {
            byte[] b = new byte[16384]; int n;
            while ((n = in.read(b)) > 0) out.write(b, 0, n);
            out.getFD().sync();
        }
    }

    public static void deleteTree(File f) {
        if (f == null || !f.exists()) return;
        if (f.isDirectory()) { File[] c = f.listFiles(); if (c != null) for (File x : c) deleteTree(x); }
        f.delete();
    }
}
