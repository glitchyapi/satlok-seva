package org.satlok.seva;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import android.util.Log;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.Charset;
import java.security.KeyStore;
import java.security.SecureRandom;
import java.util.zip.Deflater;
import java.util.zip.Inflater;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

/**
 * Encrypted + compressed vault.
 *
 *   JSON --DEFLATE(9, raw)--> AES-256-GCM --> files/vault.slk
 *
 * The AES key lives in the Android Keystore (TEE / StrongBox backed where the
 * device supports it) and never leaves it — the raw key material is not
 * exportable. A device-bound fallback key is used only if the Keystore is
 * unavailable on that handset.
 *
 * Layout: [1B algo][12B IV][ciphertext||16B tag]
 *   algo 0 = stored, 1 = raw DEFLATE
 */
final class SecureStore {
    private static final String TAG = "SecureStore";
    private static final String ALIAS = "satlok_vault_aes_v1";
    private static final String VAULT = "vault.slk";
    private static final String VAULT_BAK = "vault.slk.bak";
    private static final Charset UTF8 = Charset.forName("UTF-8");

    private final Context ctx;
    private SecretKey key;
    private boolean keystoreBacked;

    SecureStore(Context c) { this.ctx = c.getApplicationContext(); }

    /* ─────────── key management ─────────── */
    private synchronized SecretKey key() throws Exception {
        if (key != null) return key;
        if (Build.VERSION.SDK_INT >= 23) {
            try {
                KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
                ks.load(null);
                if (!ks.containsAlias(ALIAS)) {
                    KeyGenerator kg = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
                    KeyGenParameterSpec.Builder b = new KeyGenParameterSpec.Builder(
                            ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                            .setKeySize(256)
                            .setRandomizedEncryptionRequired(true);
                    if (Build.VERSION.SDK_INT >= 28) {
                        try { b.setUnlockedDeviceRequired(false); } catch (Throwable ignored) {}
                    }
                    kg.init(b.build());
                    kg.generateKey();
                }
                KeyStore.Entry e = ks.getEntry(ALIAS, null);
                if (e instanceof KeyStore.SecretKeyEntry) {
                    key = ((KeyStore.SecretKeyEntry) e).getSecretKey();
                    keystoreBacked = true;
                    return key;
                }
            } catch (Throwable t) {
                Log.w(TAG, "Keystore unavailable, using device-bound fallback", t);
            }
        }
        // Fallback: random 256-bit key in app-private prefs (still sandboxed).
        SharedPreferences sp = ctx.getSharedPreferences("satlok.k", Context.MODE_PRIVATE);
        String enc = sp.getString("fk", null);
        byte[] raw;
        if (enc == null) {
            raw = new byte[32];
            new SecureRandom().nextBytes(raw);
            sp.edit().putString("fk", Base64.encodeToString(raw, Base64.NO_WRAP)).apply();
        } else {
            raw = Base64.decode(enc, Base64.NO_WRAP);
        }
        key = new SecretKeySpec(raw, "AES");
        keystoreBacked = false;
        return key;
    }

    boolean isHardwareBacked() {
        try { key(); } catch (Exception ignored) {}
        if (!keystoreBacked) return false;
        if (Build.VERSION.SDK_INT >= 31) {
            try {
                javax.crypto.SecretKeyFactory f =
                        javax.crypto.SecretKeyFactory.getInstance(key.getAlgorithm(), "AndroidKeyStore");
                android.security.keystore.KeyInfo info = (android.security.keystore.KeyInfo)
                        f.getKeySpec(key, android.security.keystore.KeyInfo.class);
                return info.getSecurityLevel() != KeyProperties.SECURITY_LEVEL_SOFTWARE;
            } catch (Throwable ignored) { return true; }
        }
        return true;
    }

    /* ─────────── write ─────────── */
    synchronized String write(String json) {
        try {
            byte[] plain = json.getBytes(UTF8);
            byte[] comp = deflate(plain);
            int algo = 0;
            byte[] payload = plain;
            if (comp != null && comp.length < plain.length) { payload = comp; algo = 1; }

            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.ENCRYPT_MODE, key());
            byte[] iv = c.getIV();
            byte[] ct = c.doFinal(payload);

            byte[] out = new byte[1 + iv.length + ct.length];
            out[0] = (byte) algo;
            System.arraycopy(iv, 0, out, 1, iv.length);
            System.arraycopy(ct, 0, out, 1 + iv.length, ct.length);

            File f = new File(ctx.getFilesDir(), VAULT);
            File bak = new File(ctx.getFilesDir(), VAULT_BAK);
            File tmp = new File(ctx.getFilesDir(), VAULT + ".tmp");
            writeAtomic(tmp, out);
            if (f.exists()) { copy(f, bak); }
            if (!tmp.renameTo(f)) { writeAtomic(f, out); tmp.delete(); }

            return "{\"ok\":true,\"raw\":" + plain.length + ",\"stored\":" + out.length + "}";
        } catch (Throwable t) {
            Log.e(TAG, "write failed", t);
            return "{\"ok\":false,\"error\":" + quote(String.valueOf(t.getMessage())) + "}";
        }
    }

    /* ─────────── read ─────────── */
    synchronized String read() {
        String r = readFrom(new File(ctx.getFilesDir(), VAULT));
        if (r != null) return r;
        File bak = new File(ctx.getFilesDir(), VAULT_BAK);
        if (bak.exists()) {
            Log.w(TAG, "primary vault unreadable — restoring backup");
            r = readFrom(bak);
            if (r != null) {
                try { copy(bak, new File(ctx.getFilesDir(), VAULT)); } catch (Exception ignored) {}
                return r.replaceFirst("\\{", "{\"recovered\":true,");
            }
        }
        return "";
    }

    private String readFrom(File f) {
        if (!f.exists() || f.length() < 14) return null;
        try {
            byte[] all = readAll(f);
            int algo = all[0] & 0xff;
            byte[] iv = new byte[12];
            System.arraycopy(all, 1, iv, 0, 12);
            byte[] ct = new byte[all.length - 13];
            System.arraycopy(all, 13, ct, 0, ct.length);

            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, iv));
            byte[] payload = c.doFinal(ct);
            byte[] plain = (algo == 1) ? inflate(payload) : payload;
            String json = new String(plain, UTF8);
            return "{\"json\":" + quote(json) + ",\"raw\":" + plain.length + ",\"stored\":" + all.length + "}";
        } catch (Throwable t) {
            Log.w(TAG, "read failed for " + f.getName() + ": " + t);
            return null;
        }
    }

    synchronized void wipe() {
        new File(ctx.getFilesDir(), VAULT).delete();
        new File(ctx.getFilesDir(), VAULT_BAK).delete();
        new File(ctx.getFilesDir(), VAULT + ".tmp").delete();
    }

    /* ─────────── codec ─────────── */
    static byte[] deflate(byte[] src) {
        Deflater d = new Deflater(Deflater.BEST_COMPRESSION, true);
        try {
            d.setInput(src); d.finish();
            ByteArrayOutputStream bo = new ByteArrayOutputStream(Math.max(64, src.length / 4));
            byte[] buf = new byte[8192];
            while (!d.finished()) { int n = d.deflate(buf); if (n == 0) break; bo.write(buf, 0, n); }
            return bo.toByteArray();
        } catch (Throwable t) { return null; } finally { d.end(); }
    }

    static byte[] inflate(byte[] src) throws Exception {
        Inflater inf = new Inflater(true);
        try {
            inf.setInput(src);
            ByteArrayOutputStream bo = new ByteArrayOutputStream(src.length * 4);
            byte[] buf = new byte[8192];
            while (!inf.finished()) {
                int n = inf.inflate(buf);
                if (n == 0) { if (inf.needsInput() || inf.needsDictionary()) break; }
                else bo.write(buf, 0, n);
            }
            return bo.toByteArray();
        } finally { inf.end(); }
    }

    /* ─────────── io helpers ─────────── */
    static void writeAtomic(File f, byte[] data) throws Exception {
        FileOutputStream fo = new FileOutputStream(f);
        try { fo.write(data); fo.getFD().sync(); } finally { fo.close(); }
    }
    static byte[] readAll(File f) throws Exception {
        FileInputStream fi = new FileInputStream(f);
        try {
            ByteArrayOutputStream bo = new ByteArrayOutputStream((int) f.length());
            byte[] b = new byte[8192]; int n;
            while ((n = fi.read(b)) > 0) bo.write(b, 0, n);
            return bo.toByteArray();
        } finally { fi.close(); }
    }
    static void copy(File a, File b) throws Exception { writeAtomic(b, readAll(a)); }

    static String quote(String s) {
        if (s == null) return "null";
        StringBuilder sb = new StringBuilder(s.length() + 16).append('"');
        for (int i = 0; i < s.length(); i++) {
            char ch = s.charAt(i);
            switch (ch) {
                case '"':  sb.append("\\\""); break;
                case '\\': sb.append("\\\\"); break;
                case '\n': sb.append("\\n"); break;
                case '\r': sb.append("\\r"); break;
                case '\t': sb.append("\\t"); break;
                case '\b': sb.append("\\b"); break;
                case '\f': sb.append("\\f"); break;
                default:
                    if (ch < 0x20 || (ch >= 0x7f && ch <= 0x9f) || ch == 0x2028 || ch == 0x2029)
                        sb.append(String.format("\\u%04x", (int) ch));
                    else sb.append(ch);
            }
        }
        return sb.append('"').toString();
    }
}
