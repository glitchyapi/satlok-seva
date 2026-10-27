package org.satlok.seva;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileNotFoundException;

/**
 * Hand-rolled FileProvider (no AndroidX dependency, keeps the APK tiny).
 * Only serves files inside filesDir/share and filesDir/updates, and only with an
 * explicit per-URI grant, which is exactly what the package installer needs.
 */
public class ShareProvider extends ContentProvider {

    @Override public boolean onCreate() { return true; }

    private File resolve(Uri uri) throws FileNotFoundException {
        String rel = uri.getPath();
        if (rel == null) throw new FileNotFoundException();
        if (rel.startsWith("/")) rel = rel.substring(1);
        if (rel.contains("..")) throw new FileNotFoundException();
        File root = getContext().getFilesDir();
        File f = new File(root, rel);
        if (!f.isFile()) throw new FileNotFoundException(rel);
        String canon;
        try { canon = f.getCanonicalPath(); } catch (Exception e) { throw new FileNotFoundException(); }
        if (!canon.startsWith(root.getAbsolutePath())) throw new FileNotFoundException();
        return f;
    }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        return ParcelFileDescriptor.open(resolve(uri), ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override
    public String getType(Uri uri) {
        String p = uri.getPath();
        if (p == null) return "application/octet-stream";
        if (p.endsWith(".apk")) return "application/vnd.android.package-archive";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
        if (p.endsWith(".ssvb")) return "application/octet-stream";
        if (p.endsWith(".json")) return "application/json";
        return "application/octet-stream";
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String sel, String[] args, String order) {
        File f;
        try { f = resolve(uri); } catch (FileNotFoundException e) { return null; }
        String[] cols = projection != null ? projection
                : new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE};
        MatrixCursor c = new MatrixCursor(cols, 1);
        Object[] row = new Object[cols.length];
        for (int i = 0; i < cols.length; i++) {
            if (OpenableColumns.DISPLAY_NAME.equals(cols[i])) row[i] = f.getName();
            else if (OpenableColumns.SIZE.equals(cols[i])) row[i] = f.length();
            else row[i] = null;
        }
        c.addRow(row);
        return c;
    }

    @Override public Uri insert(Uri uri, ContentValues values) { return null; }
    @Override public int delete(Uri uri, String s, String[] a) { return 0; }
    @Override public int update(Uri uri, ContentValues v, String s, String[] a) { return 0; }
}
