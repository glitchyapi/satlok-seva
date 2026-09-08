package satlok.seva;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import java.io.File;

/** Minimal read-only FileProvider for cache/staging files (APK install, image share). */
public class MyFileProvider extends ContentProvider {
    public static final String AUTH = "io.satlok.seva.fileprovider";

    public static Uri getUri(Context ctx, File f) {
        return Uri.parse("content://" + AUTH + Uri.encode(f.getAbsolutePath(), "/"));
    }

    @Override public boolean onCreate() { return true; }
    @Override public String getType(Uri uri) { return "application/octet-stream"; }
    @Override public Cursor query(Uri uri, String[] p, String s, String[] a, String o) { return null; }
    @Override public Uri insert(Uri uri, ContentValues v) { return null; }
    @Override public int delete(Uri uri, String s, String[] a) { return 0; }
    @Override public int update(Uri uri, ContentValues v, String s, String[] a) { return 0; }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws java.io.FileNotFoundException {
        try {
            File base = new File(Uri.decode(uri.getPath()));
            String cp = base.getCanonicalPath();
            Context c = getContext();
            String cache = c.getCacheDir().getCanonicalPath();
            String files = c.getFilesDir().getCanonicalPath();
            if (!cp.startsWith(cache) && !cp.startsWith(files)) throw new java.io.FileNotFoundException("outside sandbox");
            File f = new File(cp);
            if (!f.exists()) throw new java.io.FileNotFoundException("missing");
            return ParcelFileDescriptor.open(f, ParcelFileDescriptor.MODE_READ_ONLY);
        } catch (java.io.IOException e) {
            throw new java.io.FileNotFoundException(e.getMessage());
        }
    }
}
