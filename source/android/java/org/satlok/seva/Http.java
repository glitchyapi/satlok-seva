package org.satlok.seva;

import android.util.Log;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.zip.GZIPInputStream;

/** Small HTTPS helper — native networking sidesteps WebView CORS entirely. */
final class Http {
    private static final String TAG = "Http";
    private static final int CONNECT_MS = 15000;
    private static final int READ_MS = 30000;
    private static final int MAX_REDIRECTS = 5;
    private static final long MAX_TEXT = 8L * 1024 * 1024;
    private static final long MAX_BINARY = 256L * 1024 * 1024;

    interface Progress { void on(long read, long total); }

    static final class Result {
        int status; String body; long size; String error;
    }

    private static HttpURLConnection open(String url) throws Exception {
        String current = url;
        for (int i = 0; i < MAX_REDIRECTS; i++) {
            URL u = new URL(current);
            if (!"https".equalsIgnoreCase(u.getProtocol()) && !"http".equalsIgnoreCase(u.getProtocol()))
                throw new Exception("unsupported scheme");
            HttpURLConnection c = (HttpURLConnection) u.openConnection();
            c.setConnectTimeout(CONNECT_MS);
            c.setReadTimeout(READ_MS);
            c.setInstanceFollowRedirects(false);
            c.setRequestProperty("User-Agent", "SatlokSeva/1.0 (Android)");
            c.setRequestProperty("Accept-Encoding", "gzip");
            c.setRequestProperty("Cache-Control", "no-cache");
            int code = c.getResponseCode();
            if (code == 301 || code == 302 || code == 303 || code == 307 || code == 308) {
                String loc = c.getHeaderField("Location");
                c.disconnect();
                if (loc == null) throw new Exception("redirect without Location");
                current = new URL(new URL(current), loc).toString();
                continue;
            }
            return c;
        }
        throw new Exception("too many redirects");
    }

    private static InputStream stream(HttpURLConnection c) throws Exception {
        InputStream in = c.getInputStream();
        if ("gzip".equalsIgnoreCase(c.getContentEncoding())) in = new GZIPInputStream(in);
        return in;
    }

    static Result getText(String url) {
        Result r = new Result();
        HttpURLConnection c = null;
        try {
            c = open(url);
            r.status = c.getResponseCode();
            InputStream in = (r.status >= 400) ? c.getErrorStream() : stream(c);
            if (in == null) { r.body = ""; return r; }
            ByteArrayOutputStream bo = new ByteArrayOutputStream();
            byte[] buf = new byte[8192]; int n; long total = 0;
            while ((n = in.read(buf)) > 0) {
                total += n;
                if (total > MAX_TEXT) throw new Exception("response too large");
                bo.write(buf, 0, n);
            }
            in.close();
            r.body = bo.toString("UTF-8");
            r.size = total;
        } catch (Throwable t) {
            r.error = String.valueOf(t.getMessage());
            if (r.status == 0) r.status = -1;
            Log.w(TAG, "getText " + url + " → " + r.error);
        } finally { if (c != null) c.disconnect(); }
        return r;
    }

    private static long contentLength(HttpURLConnection c) {
        try { String v = c.getHeaderField("Content-Length"); return v == null ? -1L : Long.parseLong(v.trim()); }
        catch (Throwable t) { return -1L; }
    }

    static Result download(String url, File dest, Progress p) {
        Result r = new Result();
        HttpURLConnection c = null;
        FileOutputStream fo = null;
        try {
            c = open(url);
            r.status = c.getResponseCode();
            if (r.status < 200 || r.status >= 300) throw new Exception("HTTP " + r.status);
            long total = contentLength(c);
            InputStream in = stream(c);
            fo = new FileOutputStream(dest);
            byte[] buf = new byte[32768]; int n; long read = 0; long lastTick = 0;
            while ((n = in.read(buf)) > 0) {
                read += n;
                if (read > MAX_BINARY) throw new Exception("file too large");
                fo.write(buf, 0, n);
                if (p != null) {
                    long now = System.currentTimeMillis();
                    if (now - lastTick > 120 || (total > 0 && read >= total)) { p.on(read, total); lastTick = now; }
                }
            }
            fo.flush(); fo.getFD().sync();
            in.close();
            r.size = read;
            if (total > 0 && read != total) throw new Exception("incomplete download");
        } catch (Throwable t) {
            r.error = String.valueOf(t.getMessage());
            if (r.status == 0) r.status = -1;
            Log.w(TAG, "download " + url + " → " + r.error);
        } finally {
            if (fo != null) try { fo.close(); } catch (Exception ignored) {}
            if (c != null) c.disconnect();
        }
        return r;
    }
}
