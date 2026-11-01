package org.satlok.seva;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.nio.charset.Charset;
import java.util.HashMap;
import java.util.Map;

public final class MainActivity extends Activity {

    private static final String TAG = "MainActivity";
    static final boolean IS_DEBUG = false;

    /** Virtual HTTPS origin — gives the bundle a real secure context so
     *  WebCrypto, service-worker-free storage and same-origin rules all work,
     *  while every byte is served locally (no network). */
    private static final String HOST = "appassets.androidplatform.net";
    private static final String ROOT = "https://" + HOST + "/";
    private static final String ENTRY = ROOT + "index.html";
    private static final Charset UTF8 = Charset.forName("UTF-8");

    private WebView web;
    private FrameLayout rootLayout;
    private SecureStore store;
    private OtaManager ota;
    private Notifier notifier;
    private Bridge bridge;
    private long lastBack;

    @SuppressLint("SetJavaScriptEnabled")
    @Override protected void onCreate(Bundle savedInstanceState) {
        // Android 12+ system splash → our window theme
        setTheme(R.style.AppTheme);
        super.onCreate(savedInstanceState);

        if (Build.VERSION.SDK_INT >= 28) {
            try { WindowManager.LayoutParams lp = getWindow().getAttributes();
                  lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
                  getWindow().setAttributes(lp); } catch (Throwable ignored) {}
        }
        getWindow().setStatusBarColor(Color.parseColor("#F4F5F7"));
        getWindow().setNavigationBarColor(Color.parseColor("#F4F5F7"));
        if (Build.VERSION.SDK_INT >= 23)
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);

        store = new SecureStore(this);
        ota = new OtaManager(this);
        notifier = new Notifier(this);

        // If a previously installed OTA bundle never confirmed a healthy boot,
        // roll it back before we load anything.
        ota.checkPendingRollback();

        rootLayout = new FrameLayout(this);
        rootLayout.setLayoutParams(new ViewGroup.LayoutParams(-1, -1));
        rootLayout.setBackgroundColor(Color.parseColor("#F4F5F7"));
        setContentView(rootLayout);

        web = new WebView(this);
        web.setLayoutParams(new FrameLayout.LayoutParams(-1, -1));
        web.setBackgroundColor(Color.parseColor("#F4F5F7"));
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        rootLayout.addView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setAllowFileAccessFromFileURLs(false);
        s.setAllowUniversalAccessFromFileURLs(false);
        s.setGeolocationEnabled(false);
        s.setSavePassword(false);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setTextZoom(100);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        if (Build.VERSION.SDK_INT >= 26) s.setSafeBrowsingEnabled(true);
        s.setUserAgentString(s.getUserAgentString() + " SatlokSeva/1.0");

        bridge = new Bridge(this, store, ota, notifier);
        web.addJavascriptInterface(bridge, "SatlokNative");

        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
                return handleUrl(req.getUrl().toString());
            }
            @SuppressWarnings("deprecation")
            @Override public boolean shouldOverrideUrlLoading(WebView v, String url) { return handleUrl(url); }

            @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest req) {
                return serve(req.getUrl());
            }
            @SuppressWarnings("deprecation")
            @Override public WebResourceResponse shouldInterceptRequest(WebView v, String url) {
                return serve(Uri.parse(url));
            }

            @Override public void onPageFinished(WebView v, String url) {
                rootLayout.setBackgroundColor(Color.parseColor("#F4F5F7"));
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onConsoleMessage(ConsoleMessage m) {
                if (IS_DEBUG || m.messageLevel() == ConsoleMessage.MessageLevel.ERROR)
                    Log.d("JS", m.message() + " @" + m.sourceId() + ":" + m.lineNumber());
                return true;
            }
        });

        if (IS_DEBUG) WebView.setWebContentsDebuggingEnabled(true);

        web.loadUrl(ENTRY);
        handleIntent(getIntent());
    }

    /* ─────────── URL policy ─────────── */
    private boolean handleUrl(String url) {
        if (url == null) return false;
        if (url.startsWith(ROOT) || url.startsWith("about:")) return false;
        // Anything else leaves the app — never expose the bridge to it.
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
        } catch (Throwable t) { Log.w(TAG, "cannot open " + url); }
        return true;
    }

    /* ─────────── local asset server ───────────
       OTA bundle wins; APK assets are the immutable fallback. */
    private WebResourceResponse serve(Uri uri) {
        if (uri == null || !HOST.equals(uri.getHost())) return null;
        String path = uri.getPath();
        if (path == null || path.equals("/") || path.isEmpty()) path = "/index.html";
        while (path.startsWith("/")) path = path.substring(1);
        if (path.contains("..")) return notFound();

        String mime = mimeFor(path);
        Map<String, String> headers = new HashMap<String, String>();
        headers.put("Access-Control-Allow-Origin", "*");
        headers.put("Cache-Control", "no-cache");
        headers.put("X-Content-Type-Options", "nosniff");

        // 1) hot-updated bundle
        try {
            File f = new File(ota.activeDir(), path);
            if (f.exists() && f.isFile() && f.getCanonicalPath().startsWith(ota.activeDir().getCanonicalPath())) {
                return new WebResourceResponse(mime, "UTF-8", 200, "OK", headers, new FileInputStream(f));
            }
        } catch (Exception ignored) {}

        // 2) bundled assets
        try {
            InputStream in = getAssets().open("www/" + path);
            return new WebResourceResponse(mime, "UTF-8", 200, "OK", headers, in);
        } catch (Exception e) {
            return notFound();
        }
    }

    private WebResourceResponse notFound() {
        Map<String, String> h = new HashMap<String, String>();
        h.put("Cache-Control", "no-store");
        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", h,
                new ByteArrayInputStream("not found".getBytes(UTF8)));
    }

    private static String mimeFor(String p) {
        String l = p.toLowerCase();
        if (l.endsWith(".html")) return "text/html";
        if (l.endsWith(".js"))   return "application/javascript";
        if (l.endsWith(".css"))  return "text/css";
        if (l.endsWith(".json")) return "application/json";
        if (l.endsWith(".svg"))  return "image/svg+xml";
        if (l.endsWith(".png"))  return "image/png";
        if (l.endsWith(".jpg") || l.endsWith(".jpeg")) return "image/jpeg";
        if (l.endsWith(".webp")) return "image/webp";
        if (l.endsWith(".woff2")) return "font/woff2";
        if (l.endsWith(".woff"))  return "font/woff";
        if (l.endsWith(".ttf"))   return "font/ttf";
        if (l.endsWith(".ico"))   return "image/x-icon";
        return "application/octet-stream";
    }

    /* ─────────── helpers used by Bridge ─────────── */
    void evalJs(String js) {
        if (web == null) return;
        if (Build.VERSION.SDK_INT >= 19) web.evaluateJavascript(js, null);
        else web.loadUrl("javascript:" + js);
    }

    void restartWebView() {
        runOnUiThread(new Runnable() { public void run() {
            try {
                web.clearCache(false);
                web.loadUrl(ENTRY + "?r=" + System.currentTimeMillis());
            } catch (Throwable t) { Log.e(TAG, "restart", t); }
        }});
    }

    static String webviewVersion(Activity a) {
        try {
            if (Build.VERSION.SDK_INT >= 26) {
                Object p = WebView.getCurrentWebViewPackage();
                if (p != null) return ((PackageInfo) p).versionName;
            }
            PackageInfo pi = a.getPackageManager().getPackageInfo("com.google.android.webview", 0);
            return pi.versionName;
        } catch (Throwable t) { return "unknown"; }
    }

    /* ─────────── SAF results ─────────── */
    @Override protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (res != RESULT_OK || data == null || data.getData() == null) {
            if (req == Bridge.REQ_CREATE_FILE) bridge.emit("fileSaved", "{\"ok\":false,\"cancelled\":true}");
            return;
        }
        Uri uri = data.getData();
        if (req == Bridge.REQ_CREATE_FILE) {
            try {
                java.io.OutputStream os = getContentResolver().openOutputStream(uri);
                if (os == null) throw new Exception("no stream");
                os.write(bridge.pendingSaveContent.getBytes(UTF8));
                os.flush(); os.close();
                bridge.emit("fileSaved", "{\"ok\":true,\"path\":" + SecureStore.quote(String.valueOf(uri)) + "}");
            } catch (Throwable t) {
                bridge.emit("fileSaved", "{\"ok\":false,\"error\":" + SecureStore.quote(t.getMessage()) + "}");
            }
            bridge.pendingSaveContent = null;
        } else if (req == Bridge.REQ_PICK_FILE) {
            try {
                InputStream in = getContentResolver().openInputStream(uri);
                if (in == null) throw new Exception("no stream");
                java.io.ByteArrayOutputStream bo = new java.io.ByteArrayOutputStream();
                byte[] b = new byte[8192]; int n; long total = 0;
                while ((n = in.read(b)) > 0) { total += n; if (total > 32L*1024*1024) throw new Exception("file too large"); bo.write(b, 0, n); }
                in.close();
                JSONObject o = new JSONObject();
                o.put("reqId", bridge.pendingPickReq == null ? "" : bridge.pendingPickReq);
                o.put("content", bo.toString("UTF-8"));
                o.put("name", uri.getLastPathSegment());
                bridge.emit("filePicked", o.toString());
            } catch (Throwable t) {
                bridge.emit("filePicked", "{\"reqId\":\"\",\"error\":" + SecureStore.quote(t.getMessage()) + "}");
            }
        }
    }

    @Override public void onRequestPermissionsResult(int req, String[] perms, int[] results) {
        super.onRequestPermissionsResult(req, perms, results);
        bridge.emit("permissionChanged", bridge.getPermissions());
    }

    /* ─────────── lifecycle ─────────── */
    @Override protected void onNewIntent(Intent i) { super.onNewIntent(i); setIntent(i); handleIntent(i); }

    private void handleIntent(Intent i) {
        if (i == null) return;
        final String tag = i.getStringExtra("notif_tag");
        if (tag == null) return;
        rootLayout.postDelayed(new Runnable() { public void run() {
            bridge.emit("notificationOpened", "{\"tag\":" + SecureStore.quote(tag) + "}");
        }}, 1600);
    }

    @SuppressWarnings("deprecation")
    @Override public void onBackPressed() {
        if (web == null) { super.onBackPressed(); return; }
        // let the web layer close sheets / navigate first
        web.evaluateJavascript("(window.SatlokBack && window.SatlokBack())===true", new android.webkit.ValueCallback<String>() {
            @Override public void onReceiveValue(String v) {
                if (!"true".equals(v)) {
                    long now = System.currentTimeMillis();
                    if (now - lastBack < 1800) { finish(); }
                    else {
                        lastBack = now;
                        evalJs("window.toast && window.toast('Press back again to exit');");
                    }
                }
            }
        });
    }

    @Override protected void onPause()  { if (web != null) web.onPause(); super.onPause(); }
    @Override protected void onResume() { super.onResume(); if (web != null) web.onResume(); }
    @Override protected void onDestroy() {
        if (web != null) {
            rootLayout.removeView(web);
            web.removeJavascriptInterface("SatlokNative");
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
