package satlok.seva;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebSettings;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends Activity {
    public static final int VERSION_CODE = 6;
    public static final String VERSION_NAME = "1.0.5";
    private WebView web;
    private NativeBridge bridge;

    /* SAF result codes */
    public static final int REQ_BACKUP_CREATE = 71;
    public static final int REQ_BACKUP_OPEN = 72;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Window w = getWindow();
        w.setStatusBarColor(Color.parseColor("#FAF6F0"));
        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setSupportZoom(false);
        s.setUseWideViewPort(false);
        s.setLoadWithOverviewMode(true);
        s.setTextZoom(100);
        web.setBackgroundColor(Color.parseColor("#FAF6F0"));
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        bridge = new NativeBridge(this, web);
        web.addJavascriptInterface(bridge, "SatlokNative");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                String url = req.getUrl().toString();
                if (url.startsWith("app://web/")) {
                    String rel = url.substring("app://web/".length());
                    int q = rel.indexOf('?'); if (q >= 0) rel = rel.substring(0, q);
                    if (rel.isEmpty()) rel = "index.html";
                    byte[] data = bridge.resolveWebFile(rel);
                    if (data != null) {
                        Map<String, String> headers = new HashMap<String, String>();
                        headers.put("Cache-Control", rel.endsWith(".html") ? "no-cache" : "max-age=0");
                        return new WebResourceResponse(mime(rel), "utf-8", 200, "OK", headers, new ByteArrayInputStream(data));
                    }
                    return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", null, new ByteArrayInputStream(new byte[0]));
                }
                return super.shouldInterceptRequest(view, req);
            }
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                bridge.onPageReady();
            }
        });
        setContentView(web);
        web.loadUrl("app://web/index.html");
    }

    public static String mime(String p) {
        p = p.toLowerCase();
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".js")) return "application/javascript";
        if (p.endsWith(".json")) return "application/json";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
        if (p.endsWith(".webp")) return "image/webp";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".woff2")) return "font/woff2";
        if (p.endsWith(".ico")) return "image/x-icon";
        return "application/octet-stream";
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript("document.dispatchEvent(new Event('backbutton'))", null);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        bridge.onActivityFileResult(requestCode, resultCode, data);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (bridge != null) bridge.resumePendingInstall();
    }

    @Override
    protected void onDestroy() {
        if (web != null) web.destroy();
        super.onDestroy();
    }

    public WebView getWeb() { return web; }
}
