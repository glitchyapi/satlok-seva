package org.satlok.seva;

import android.content.Context;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.SecureRandom;
import java.util.zip.Deflater;
import java.util.zip.Inflater;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * Seva Vault — compress-then-encrypt at rest.
 *
 *   plaintext JSON --DEFLATE(9)--> AES-256-GCM --> file
 *
 * The AES key lives in the hardware-backed AndroidKeyStore and never leaves the
 * secure element, so copying the file off the device yields nothing. GCM adds a
 * 16-byte auth tag, so tampering is detected before a single byte is parsed.
 *
 * Container layout:  "SSV1" | flags(1) | iv(12) | ciphertext+tag
 * flags bit0 = deflated.
 */
public class SecureStore {

    private static final String ALIAS = "satlok_seva_vault_v1";
    private static final byte[] MAGIC = {'S', 'S', 'V', '1'};
    private final File dir;
    private final Context ctx;

    public SecureStore(Context ctx) {
        this.ctx = ctx;
        this.dir = new File(ctx.getFilesDir(), "vault");
        if (!dir.exists()) dir.mkdirs();
    }

    private SecretKey key() throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);
        if (ks.containsAlias(ALIAS)) {
            return (SecretKey) ks.getKey(ALIAS, null);
        }
        KeyGenerator kg = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        KeyGenParameterSpec.Builder b = new KeyGenParameterSpec.Builder(
                ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .setRandomizedEncryptionRequired(true);
        kg.init(b.build());
        return kg.generateKey();
    }

    private static String safe(String name) {
        return name.replaceAll("[^a-zA-Z0-9_.-]", "_");
    }

    /** Returns {raw, packed, ratio} so the UI can show real compression numbers. */
    public String write(String name, String json) throws Exception {
        byte[] raw = json.getBytes(StandardCharsets.UTF_8);
        byte[] body = deflate(raw);
        byte flags = 1;
        if (body.length >= raw.length) { body = raw; flags = 0; }

        byte[] iv = new byte[12];
        new SecureRandom().nextBytes(iv);
        Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.ENCRYPT_MODE, key(), new GCMParameterSpec(128, iv));
        c.updateAAD(MAGIC);
        byte[] ct = c.doFinal(body);

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write(MAGIC); out.write(flags); out.write(iv); out.write(ct);
        byte[] all = out.toByteArray();

        File f = new File(dir, safe(name) + ".ssv");
        File tmp = new File(dir, safe(name) + ".ssv.tmp");
        try (FileOutputStream fos = new FileOutputStream(tmp)) {
            fos.write(all);
            fos.getFD().sync();
        }
        if (f.exists() && !f.delete()) throw new IllegalStateException("replace failed");
        if (!tmp.renameTo(f)) throw new IllegalStateException("rename failed");

        return "{\"raw\":" + raw.length + ",\"packed\":" + all.length +
               ",\"ratio\":" + (raw.length == 0 ? 0 : (100 - (all.length * 100 / raw.length))) + "}";
    }

    public String read(String name) throws Exception {
        File f = new File(dir, safe(name) + ".ssv");
        if (!f.isFile()) return null;
        byte[] all;
        try (FileInputStream in = new FileInputStream(f)) { all = readAll(in); }
        if (all.length < 17) throw new IllegalStateException("truncated vault");
        for (int i = 0; i < 4; i++) if (all[i] != MAGIC[i]) throw new IllegalStateException("bad magic");
        byte flags = all[4];
        byte[] iv = new byte[12];
        System.arraycopy(all, 5, iv, 0, 12);
        Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, iv));
        c.updateAAD(MAGIC);
        byte[] body = c.doFinal(all, 17, all.length - 17);
        byte[] raw = (flags & 1) != 0 ? inflate(body) : body;
        return new String(raw, StandardCharsets.UTF_8);
    }

    public boolean delete(String name) {
        File f = new File(dir, safe(name) + ".ssv");
        return !f.exists() || f.delete();
    }

    public String list() {
        StringBuilder sb = new StringBuilder("[");
        File[] fs = dir.listFiles();
        boolean first = true;
        if (fs != null) for (File f : fs) {
            String n = f.getName();
            if (!n.endsWith(".ssv")) continue;
            if (!first) sb.append(',');
            first = false;
            sb.append('"').append(n, 0, n.length() - 4).append('"');
        }
        return sb.append(']').toString();
    }

    // Portable backup envelope: same container, key supplied by the user's PIN
    // instead of the device keystore (handled in JS with WebCrypto). Native side
    // only needs to hand the raw bytes over.
    public byte[] readRaw(String name) throws Exception {
        File f = new File(dir, safe(name) + ".ssv");
        if (!f.isFile()) return new byte[0];
        try (FileInputStream in = new FileInputStream(f)) { return readAll(in); }
    }

    public static byte[] deflate(byte[] in) {
        Deflater d = new Deflater(Deflater.BEST_COMPRESSION, true);
        d.setInput(in);
        d.finish();
        ByteArrayOutputStream out = new ByteArrayOutputStream(Math.max(64, in.length / 3));
        byte[] buf = new byte[8192];
        while (!d.finished()) { int n = d.deflate(buf); out.write(buf, 0, n); }
        d.end();
        return out.toByteArray();
    }

    public static byte[] inflate(byte[] in) throws Exception {
        Inflater inf = new Inflater(true);
        inf.setInput(in);
        ByteArrayOutputStream out = new ByteArrayOutputStream(in.length * 3);
        byte[] buf = new byte[8192];
        while (!inf.finished()) {
            int n = inf.inflate(buf);
            if (n == 0) { if (inf.needsInput() || inf.needsDictionary()) break; }
            out.write(buf, 0, n);
        }
        inf.end();
        return out.toByteArray();
    }

    public static byte[] readAll(FileInputStream in) throws Exception {
        ByteArrayOutputStream o = new ByteArrayOutputStream();
        byte[] b = new byte[8192];
        int n;
        while ((n = in.read(b)) > 0) o.write(b, 0, n);
        return o.toByteArray();
    }

    public static String b64(byte[] b) { return Base64.encodeToString(b, Base64.NO_WRAP); }
    public static byte[] unb64(String s) { return Base64.decode(s, Base64.NO_WRAP); }
}
