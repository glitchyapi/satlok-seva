package org.satlok.seva;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.res.AssetManager;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Enumeration;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

/**
 * File-level OTA for the web bundle.
 *
 *   files/www          active bundle (overrides APK assets)
 *   files/www_staging  in-progress download
 *   files/www_prev     previous bundle, kept for rollback
 *
 * Commit builds a COMPLETE bundle in staging (changed files downloaded,
 * unchanged files copied forward), then swaps directories atomically.
 * The new bundle stays "pending" until the JS layer confirms a healthy
 * boot; if the app is killed/restarted before that, we roll back.
 */
final class OtaManager {
    private static final String TAG = "OtaManager";
    private static final String PREF = "satlok.ota";
    private static final String ACTIVE = "www";
    private static final String STAGING = "www_staging";
    private static final String PREV = "www_prev";

    private final Context ctx;
    private final SharedPreferences sp;

    OtaManager(Context c) {
        this.ctx = c.getApplicationContext();
        this.sp = ctx.getSharedPreferences(PREF, Context.MODE_PRIVATE);
    }

    File activeDir()  { return new File(ctx.getFilesDir(), ACTIVE); }
    File stagingDir() { return new File(ctx.getFilesDir(), STAGING); }
    File prevDir()    { return new File(ctx.getFilesDir(), PREV); }

    int webVersion() { return sp.getInt("webVersion", 0); }
    boolean hasActive() { return new File(activeDir(), "index.html").exists(); }

    /* ─────────── crash-safe boot ─────────── */
    /** Called on every launch BEFORE the WebView loads. */
    void checkPendingRollback() {
        if (!sp.getBoolean("pending", false)) return;
        int fails = sp.getInt("bootFails", 0) + 1;
        Log.w(TAG, "previous bundle never confirmed boot (attempt " + fails + ")");
        if (fails >= 2) {
            Log.w(TAG, "rolling back to previous bundle");
            rollbackToPrev();
            sp.edit().putBoolean("pending", false).putInt("bootFails", 0).apply();
        } else {
            sp.edit().putInt("bootFails", fails).apply();
        }
    }

    void confirmBoot() {
        sp.edit().putBoolean("pending", false).putInt("bootFails", 0).apply();
    }

    /* ─────────── state for JS ─────────── */
    String state() {
        try {
            JSONObject o = new JSONObject();
            o.put("webVersion", webVersion());
            o.put("source", hasActive() ? "ota" : "assets");
            o.put("pending", sp.getBoolean("pending", false));
            o.put("bootFails", sp.getInt("bootFails", 0));
            String m = sp.getString("manifest", null);
            if (m != null) o.put("manifest", new JSONObject(m));
            return o.toString();
        } catch (Exception e) { return "{\"webVersion\":0,\"source\":\"assets\"}"; }
    }

    /* ─────────── staging ─────────── */
    String begin(String version) {
        try {
            File st = stagingDir();
            deleteRecursive(st);
            if (!st.mkdirs()) throw new Exception("cannot create staging");
            sp.edit().putString("stagingVersion", version).apply();
            return "{\"ok\":true,\"dir\":" + SecureStore.quote(st.getAbsolutePath()) + "}";
        } catch (Exception e) {
            return err(e.getMessage());
        }
    }

    /** Download one file into staging and verify its SHA-256. */
    String fetch(String url, String relPath, String expectedSha) {
        File dest = null;
        try {
            String safe = safePath(relPath);
            dest = new File(stagingDir(), safe);
            File parent = dest.getParentFile();
            if (parent != null && !parent.exists() && !parent.mkdirs()) throw new Exception("mkdir failed");

            Http.Result r = Http.download(url, dest, null);
            if (r.status < 200 || r.status >= 300) { dest.delete(); throw new Exception("HTTP " + r.status); }

            String sha = sha256(dest);
            boolean verified = true;
            if (expectedSha != null && expectedSha.length() == 64) {
                verified = expectedSha.equalsIgnoreCase(sha);
                if (!verified) { dest.delete(); return "{\"ok\":false,\"verified\":false,\"error\":\"sha256 mismatch\"}"; }
            }
            JSONObject o = new JSONObject();
            o.put("ok", true).put("size", dest.length()).put("sha256", sha).put("verified", verified);
            return o.toString();
        } catch (Exception e) {
            if (dest != null) dest.delete();
            return err(e.getMessage());
        }
    }

    /**
     * Complete the bundle then swap it in.
     * Unchanged files are copied from the active bundle, or extracted from
     * the APK's own assets when this is the first OTA the device receives.
     */
    String commit(String version, String manifestJson) {
        try {
            File st = stagingDir();
            if (!st.isDirectory()) throw new Exception("no staging directory");

            JSONObject man = new JSONObject(manifestJson);
            JSONArray files = man.optJSONArray("files");
            if (files == null) throw new Exception("manifest has no files[]");

            File act = activeDir();
            int copied = 0, extracted = 0;
            for (int i = 0; i < files.length(); i++) {
                JSONObject f = files.getJSONObject(i);
                String p = safePath(f.getString("path"));
                File target = new File(st, p);
                if (target.exists()) {
                    String want = f.optString("sha256", "");
                    if (want.length() == 64 && !want.equalsIgnoreCase(sha256(target)))
                        throw new Exception("staging hash mismatch: " + p);
                    continue;
                }
                File fromActive = new File(act, p);
                File parent = target.getParentFile();
                if (parent != null && !parent.exists()) parent.mkdirs();
                if (fromActive.exists()) { SecureStore.copy(fromActive, target); copied++; }
                else if (extractAsset("www/" + p, target)) { extracted++; }
                else throw new Exception("missing unchanged file: " + p);
            }

            if (!new File(st, "index.html").exists()) throw new Exception("bundle has no index.html");

            // prune files no longer in the manifest
            Set<String> keep = new HashSet<String>();
            for (int i = 0; i < files.length(); i++) keep.add(safePath(files.getJSONObject(i).getString("path")));
            prune(st, "", keep);

            SecureStore.writeAtomic(new File(st, "manifest.json"), manifestJson.getBytes("UTF-8"));

            // ── atomic-ish swap ──
            File prev = prevDir();
            deleteRecursive(prev);
            if (act.exists() && !act.renameTo(prev)) { copyTree(act, prev); deleteRecursive(act); }
            if (!st.renameTo(act)) { copyTree(st, act); deleteRecursive(st); }

            int v;
            try { v = Integer.parseInt(version.replaceAll("[^0-9]", "")); } catch (Exception e) { v = webVersion() + 1; }
            sp.edit().putInt("webVersion", v).putString("manifest", manifestJson)
              .putBoolean("pending", true).putInt("bootFails", 0).apply();

            JSONObject o = new JSONObject();
            o.put("ok", true).put("webVersion", v).put("copied", copied).put("extracted", extracted);
            return o.toString();
        } catch (Exception e) {
            Log.e(TAG, "commit failed", e);
            return err(e.getMessage());
        }
    }

    String rollback() { deleteRecursive(stagingDir()); return "{\"ok\":true}"; }

    private void rollbackToPrev() {
        try {
            File prev = prevDir(), act = activeDir();
            if (prev.isDirectory() && new File(prev, "index.html").exists()) {
                deleteRecursive(act);
                prev.renameTo(act);
                String m = sp.getString("prevManifest", null);
                sp.edit().putInt("webVersion", sp.getInt("prevWebVersion", 0)).apply();
            } else {
                deleteRecursive(act);
                sp.edit().putInt("webVersion", 0).remove("manifest").apply();
            }
        } catch (Exception e) { Log.e(TAG, "rollback failed", e); }
    }

    String reset() {
        deleteRecursive(activeDir()); deleteRecursive(stagingDir()); deleteRecursive(prevDir());
        sp.edit().clear().apply();
        return "{\"ok\":true}";
    }

    /* ─────────── asset extraction ─────────── */
    private boolean extractAsset(String assetPath, File dest) {
        InputStream in = null;
        try {
            in = ctx.getAssets().open(assetPath);
            FileOutputStream fo = new FileOutputStream(dest);
            try {
                byte[] b = new byte[8192]; int n;
                while ((n = in.read(b)) > 0) fo.write(b, 0, n);
                fo.getFD().sync();
            } finally { fo.close(); }
            return true;
        } catch (Exception e) { return false; }
        finally { if (in != null) try { in.close(); } catch (Exception ignored) {} }
    }

    /* ─────────── fs utils ─────────── */
    static String safePath(String p) throws Exception {
        String s = p.replace('\\', '/');
        while (s.startsWith("/")) s = s.substring(1);
        if (s.contains("..") || s.contains(":") || s.length() == 0) throw new Exception("unsafe path: " + p);
        return s;
    }
    static void deleteRecursive(File f) {
        if (f == null || !f.exists()) return;
        if (f.isDirectory()) { File[] kids = f.listFiles(); if (kids != null) for (File k : kids) deleteRecursive(k); }
        f.delete();
    }
    static void copyTree(File from, File to) throws Exception {
        if (!from.exists()) return;
        if (from.isDirectory()) {
            if (!to.exists()) to.mkdirs();
            File[] kids = from.listFiles();
            if (kids != null) for (File k : kids) copyTree(k, new File(to, k.getName()));
        } else SecureStore.copy(from, to);
    }
    private void prune(File dir, String prefix, Set<String> keep) {
        File[] kids = dir.listFiles();
        if (kids == null) return;
        for (File k : kids) {
            String rel = prefix.isEmpty() ? k.getName() : prefix + "/" + k.getName();
            if (k.isDirectory()) { prune(k, rel, keep); if (k.listFiles() != null && k.listFiles().length == 0) k.delete(); }
            else if (!keep.contains(rel) && !rel.equals("manifest.json")) k.delete();
        }
    }
    static String sha256(File f) throws Exception {
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        java.io.FileInputStream fi = new java.io.FileInputStream(f);
        try { byte[] b = new byte[16384]; int n; while ((n = fi.read(b)) > 0) md.update(b, 0, n); }
        finally { fi.close(); }
        return hex(md.digest());
    }
    static String hex(byte[] b) {
        StringBuilder sb = new StringBuilder(b.length * 2);
        for (byte x : b) sb.append(Character.forDigit((x >> 4) & 0xf, 16)).append(Character.forDigit(x & 0xf, 16));
        return sb.toString();
    }
    static String err(String m) { return "{\"ok\":false,\"error\":" + SecureStore.quote(m == null ? "unknown" : m) + "}"; }
}
