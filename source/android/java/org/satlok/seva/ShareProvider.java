package org.satlok.seva;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import android.webkit.MimeTypeMap;

import java.io.File;
import java.io.FileNotFoundException;

/**
 * Zero-dependency content provider. Serves files from app-private storage as
 * content:// URIs so the system installer (APK) and share targets (banners)
 * can read them without any broad storage permission.
 *
 * Only two roots are exposed, and path traversal is rejected.
 */
public final class ShareProvider extends ContentProvider {

    @Override public boolean onCreate() { return true; }

    private File resolve(Uri uri) throws FileNotFoundException {
        if (getContext() == null) throw new FileNotFoundException("no context");
        String root = uri.getPathSegments().size() > 0 ? uri.getPathSegments().get(0) : "";
        StringBuilder rel = new StringBuilder();
        for (int i = 1; i < uri.getPathSegments().size(); i++) {
            if (rel.length() > 0) rel.append('/');
            rel.append(uri.getPathSegments().get(i));
        }
        String name = rel.toString();
        if (name.contains("..") || name.length() == 0) throw new FileNotFoundException("bad path");

        File base;
        if ("share".equals(root)) base = new File(getContext().getCacheDir(), "share");
        else if ("update".equals(root)) base = new File(getContext().getFilesDir(), "update");
        else throw new FileNotFoundException("unknown root");

        File f = new File(base, name);
        if (!f.exists() || !f.isFile()) throw new FileNotFoundException(name);
        // canonical containment check
        try {
            if (!f.getCanonicalPath().startsWith(base.getCanonicalPath() + File.separator))
                throw new FileNotFoundException("escape attempt");
        } catch (Exception e) { throw new FileNotFoundException("bad path"); }
        return f;
    }

    @Override public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        if (mode != null && !mode.equals("r")) throw new FileNotFoundException("read-only provider");
        return ParcelFileDescriptor.open(resolve(uri), ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override public String getType(Uri uri) {
        String n = uri.getLastPathSegment();
        if (n != null && n.endsWith(".apk")) return "application/vnd.android.package-archive";
        String ext = MimeTypeMap.getFileExtensionFromUrl(n == null ? "" : n);
        String m = ext == null ? null : MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);
        return m == null ? "application/octet-stream" : m;
    }

    @Override public Cursor query(Uri uri, String[] projection, String sel, String[] args, String sort) {
        File f;
        try { f = resolve(uri); } catch (FileNotFoundException e) { return null; }
        String[] cols = projection != null ? projection : new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE};
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
