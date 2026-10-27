package org.satlok.seva;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.MimeTypeMap;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

/**
 * Satlok Seva — native shell.
 *
 * The whole product UI is a local web bundle. It is served from a virtual HTTPS
 * origin (app.satlok.local) so the page gets a *secure context*: WebCrypto,
 * localStorage, IndexedDB and service-worker-grade APIs all work offline.
 *
 * Request resolution order for every asset:
 *   1. active OTA overlay      filesDir/ota/active/<path>   (hot patch, no reinstall)
 *   2. bundled APK asset       assets/www/<path>           (factory baseline)
 *
 * That single indirection is what makes "download only updated files" work.
 */
public class MainActivity extends Activity {

    public static final String HOST = "app.satlok.local";
    public static final String ORIGIN = "https://" + HOST + "/";
    public static final int REQ_PERMS = 4101;
    public static final int REQ_EXPORT = 4102;
    public static final int REQ_IMPORT = 4103;

    public WebView web;
    public FrameLayout root;
    public Bridge bridge;
    public OtaEngine ota;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private boolean bootConfirmed = false;
    private String pendingPermCallback = null;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setTheme(R.style.AppTheme);

        root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#FFF7F0"));
        setContentView(root);

        web = new WebView(this);
        web.setLayoutParams(new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        web.setBackgroundColor(Color.parseColor("#FFF7F0"));
        root.addView(web);

        ota = new OtaEngine(this);
        bridge = new Bridge(this);
        Notify.ensureChannels(this);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setTextZoom(100);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        if (Build.VERSION.SDK_INT >= 26) s.setSafeBrowsingEnabled(true);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        web.addJavascriptInterface(bridge, "Native");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                return resolve(req.getUrl());
            }

            @SuppressWarnings("deprecation")
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, String url) {
                return resolve(Uri.parse(url));
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (HOST.equals(u.getHost())) return false;
                // Anything external opens in the real browser, never inside the vault UI.
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, u));
                } catch (Exception ignored) {
                }
                return true;
            }
        });

        applySystemBars(false);
        web.loadUrl(ORIGIN + "index.html");

        // Watchdog: if the JS bundle never confirms boot, roll the overlay back to
        // the bundled baseline so a bad patch can never brick the app.
        ui.postDelayed(() -> {
            if (!bootConfirmed && ota.hasOverlay()) {
                ota.rollback("boot-timeout");
                web.loadUrl(ORIGIN + "index.html");
            }
        }, 12000);

        handleDeepLink(getIntent());
    }

    /** Called from JS once the first screen has painted. */
    public void confirmBoot() {
        bootConfirmed = true;
        ota.markHealthy();
    }

    private WebResourceResponse resolve(Uri u) {
        if (!HOST.equals(u.getHost())) return null;
        String path = u.getPath();
        if (path == null || path.equals("/")) path = "/index.html";
        if (path.startsWith("/")) path = path.substring(1);
        if (path.contains("..")) return plain(403, "Forbidden");

        String mime = mimeFor(path);
        Map<String, String> headers = new HashMap<>();
        headers.put("Access-Control-Allow-Origin", "*");
        headers.put("Cache-Control", "no-cache");

        // 1. hot-patched overlay
        File f = ota.overlayFile(path);
        if (f != null && f.isFile()) {
            try {
                return new WebResourceResponse(mime, "UTF-8", 200, "OK", headers,
                        new FileInputStream(f));
            } catch (Exception ignored) {
            }
        }
        // 2. factory bundle inside the APK
        try {
            InputStream in = getAssets().open("www/" + path);
            return new WebResourceResponse(mime, "UTF-8", 200, "OK", headers, in);
        } catch (Exception e) {
            return plain(404, "Not found: " + path);
        }
    }

    private WebResourceResponse plain(int code, String msg) {
        Map<String, String> h = new HashMap<>();
        return new WebResourceResponse("text/plain", "UTF-8", code, msg, h,
                new ByteArrayInputStream(msg.getBytes()));
    }

    public static String mimeFor(String path) {
        String ext = MimeTypeMap.getFileExtensionFromUrl(path);
        if (ext == null) ext = "";
        switch (ext.toLowerCase()) {
            case "html": return "text/html";
            case "js":   return "application/javascript";
            case "mjs":  return "application/javascript";
            case "css":  return "text/css";
            case "json": return "application/json";
            case "svg":  return "image/svg+xml";
            case "png":  return "image/png";
            case "jpg":
            case "jpeg": return "image/jpeg";
            case "webp": return "image/webp";
            case "woff2":return "font/woff2";
            case "woff": return "font/woff";
            case "ttf":  return "font/ttf";
            case "ico":  return "image/x-icon";
            default:     return "application/octet-stream";
        }
    }

    /** Light/dark status + navigation bars, driven by the in-app theme toggle. */
    public void applySystemBars(boolean dark) {
        runOnUiThread(() -> {
            int bg = dark ? Color.parseColor("#121014") : Color.parseColor("#FFF7F0");
            getWindow().setStatusBarColor(bg);
            getWindow().setNavigationBarColor(bg);
            if (Build.VERSION.SDK_INT >= 26) {
                int flags = View.SYSTEM_UI_FLAG_LAYOUT_STABLE;
                if (!dark && Build.VERSION.SDK_INT >= 23) flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                if (!dark && Build.VERSION.SDK_INT >= 26) flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                getWindow().getDecorView().setSystemUiVisibility(flags);
            }
            root.setBackgroundColor(bg);
        });
    }

    public void keepScreenOn(boolean on) {
        runOnUiThread(() -> {
            if (on) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        });
    }

    public void eval(final String js) {
        ui.post(() -> {
            if (web != null) web.evaluateJavascript(js, null);
        });
    }

    // ---- runtime permissions -------------------------------------------------

    public void requestPerms(String[] perms, String callbackId) {
        pendingPermCallback = callbackId;
        if (Build.VERSION.SDK_INT >= 23) requestPermissions(perms, REQ_PERMS);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_PERMS && pendingPermCallback != null) {
            StringBuilder sb = new StringBuilder("{");
            for (int i = 0; i < permissions.length; i++) {
                if (i > 0) sb.append(',');
                sb.append('"').append(permissions[i]).append("\":")
                  .append(grantResults.length > i && grantResults[i] == PackageManager.PERMISSION_GRANTED);
            }
            sb.append('}');
            eval("window.__nativeCallback && window.__nativeCallback(" +
                    Bridge.q(pendingPermCallback) + "," + sb + ")");
            pendingPermCallback = null;
        }
    }

    // ---- Storage Access Framework (encrypted backup in/out) ------------------

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (resultCode != RESULT_OK || data == null || data.getData() == null) {
            if (requestCode == REQ_EXPORT || requestCode == REQ_IMPORT) {
                eval("window.__safResult && window.__safResult(" + requestCode + ",false,'cancelled')");
            }
            return;
        }
        Uri uri = data.getData();
        if (requestCode == REQ_EXPORT) bridge.finishExport(uri);
        else if (requestCode == REQ_IMPORT) bridge.finishImport(uri);
    }

    private void handleDeepLink(Intent i) {
        if (i == null || i.getData() == null) return;
        final String url = i.getData().toString();
        ui.postDelayed(() -> eval("window.__deepLink && window.__deepLink(" + Bridge.q(url) + ")"), 1500);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleDeepLink(intent);
        if (intent != null && intent.hasExtra("open_tab")) {
            final String tab = intent.getStringExtra("open_tab");
            ui.postDelayed(() -> eval("window.__openTab && window.__openTab(" + Bridge.q(tab) + ")"), 400);
        }
    }

    @Override
    public void onBackPressed() {
        // Let the SPA own its navigation stack; it asks us to exit when at root.
        eval("window.__backButton ? window.__backButton() : null");
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.removeJavascriptInterface("Native");
            web.destroy();
        }
        super.onDestroy();
    }
}
