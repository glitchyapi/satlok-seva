package satlok.seva;

import android.content.Context;
import android.provider.Settings;
import java.io.ByteArrayOutputStream;
import java.security.SecureRandom;
import java.util.zip.Deflater;
import java.util.zip.Inflater;
import javax.crypto.Cipher;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;

/**
 * AES-256-GCM encryption + raw DEFLATE compression for on-device data.
 * File layout: "SSV1" | iv(12) | ciphertext(+auth tag)
 * Key: PBKDF2-HMAC-SHA256 ( device material + app pepper )
 */
public class CryptoStore {
    private static final byte[] MAGIC = { 'S', 'S', 'V', '1' };
    private static final String PEPPER = "satlok-seva::sant-rampal-ji::v1";
    private final byte[] key;

    public CryptoStore(Context ctx) {
        String material;
        try {
            material = Settings.Secure.getString(ctx.getContentResolver(), Settings.Secure.ANDROID_ID);
        } catch (Exception e) { material = "fallback-device"; }
        if (material == null) material = "fallback-device";
        material = material + "|" + ctx.getPackageName();
        try {
            PBEKeySpec spec = new PBEKeySpec((material + PEPPER).toCharArray(),
                    (PEPPER + material).getBytes("UTF-8"), 60000, 256);
            SecretKeyFactory f = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256");
            key = f.generateSecret(spec).getEncoded();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    public byte[] pack(byte[] plain) throws Exception {
        // 1) deflate (level 9, raw)
        Deflater d = new Deflater(Deflater.BEST_COMPRESSION, true);
        d.setInput(plain); d.finish();
        ByteArrayOutputStream co = new ByteArrayOutputStream(plain.length / 2 + 64);
        byte[] buf = new byte[8192];
        while (!d.finished()) co.write(buf, 0, d.deflate(buf));
        d.end();
        byte[] compressed = co.toByteArray();
        // 2) AES-256-GCM
        byte[] iv = new byte[12];
        new SecureRandom().nextBytes(iv);
        Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(128, iv));
        byte[] ct = c.doFinal(compressed);
        byte[] out = new byte[4 + 12 + ct.length];
        System.arraycopy(MAGIC, 0, out, 0, 4);
        System.arraycopy(iv, 0, out, 4, 12);
        System.arraycopy(ct, 0, out, 16, ct.length);
        return out;
    }

    public byte[] unpack(byte[] packed) throws Exception {
        if (packed.length < 17 || packed[0] != MAGIC[0] || packed[1] != MAGIC[1] || packed[2] != MAGIC[2] || packed[3] != MAGIC[3])
            throw new Exception("bad magic");
        byte[] iv = new byte[12];
        System.arraycopy(packed, 4, iv, 0, 12);
        Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.DECRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(128, iv));
        byte[] compressed = c.doFinal(packed, 16, packed.length - 16);
        Inflater in = new Inflater(true);
        in.setInput(compressed);
        ByteArrayOutputStream bo = new ByteArrayOutputStream(compressed.length * 3);
        byte[] buf = new byte[8192];
        while (!in.finished()) {
            int n = in.inflate(buf);
            if (n <= 0) { if (in.needsInput()) break; }
            else bo.write(buf, 0, n);
        }
        in.end();
        return bo.toByteArray();
    }
}
