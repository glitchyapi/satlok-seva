# Architecture

## 1. Layers
```
┌────────────────────────────────────────────────────────────┐
│  Web app (HTML/CSS/JS, no frameworks)   app/assets/web     │
│  screens · i18n · store · updater · banner canvas          │
├────────────────────────────────────────────────────────────┤
│  JS bridge (js/bridge.js)  window.SatlokNative             │
├────────────────────────────────────────────────────────────┤
│  Native shell (Java, zero dependencies)                    │
│  MainActivity · NativeBridge · CryptoStore · FileProvider  │
│  AlarmReceiver · BootReceiver                              │
├────────────────────────────────────────────────────────────┤
│  Android (API 23…34)                                       │
└────────────────────────────────────────────────────────────┘
```

## 2. Serving the web app
The WebView never touches `file://`. It loads **`app://web/index.html`** and every
sub-resource goes through `WebViewClient.shouldInterceptRequest`, resolved in this order:
1. `filesDir/web/<path>` — the *writable, OTA-patched* copy
2. `assets/web/<path>` — the *factory* copy baked into the APK
This is what makes hot file-to-file updates possible without reinstalling the APK.

## 3. On-device data security
`CryptoStore.pack()`: JSON → **DEFLATE (level 9, raw)** → **AES-256-GCM** (12-byte IV,
128-bit tag). Key = PBKDF2-HMAC-SHA256(60k) over `ANDROID_ID + package + pepper`.
File: `filesDir/store/db.dat` = `"SSV1" | iv | ciphertext`.
Backups reuse the same container and leave the device only through SAF
(`ACTION_CREATE_DOCUMENT`) — the app holds **no** broad storage permission.
Optional 4-digit PIN gates the UI (lock screen) — hash stored in SharedPreferences.

## 4. OTA update protocol
`updates/manifest.json` (the *universal URL*; mirrors allowed via `manifestMirrors`):
```jsonc
{
  "app":"satlok-seva", "version":"1.0.1", "versionCode":2, "minShell":1,
  "apk": {"versionName":"1.1.0","versionCode":2,"url":"…/releases/download/…/app.apk",
          "sha256":"…","size":1234567},
  "notice": {"title":"…","body":"…","ts":173…},
  "changelog":["…"], "forceWeb":false,
  "baseUrl":"https://…/updates/files/",
  "mirrors": {"js/app.js":["https://direct.host/x.js"]},
  "files": {"js/app.js":{"sha256":"…","size":7440}, …},
  "ts":173…
}
```
Client flow on every launch:
1. GET manifest (Pages → raw → manifestMirrors fallback chain, cache-busted).
2. `shell.versionCode < apk.versionCode` → **APK update screen** (download → sha256 → `ACTION_VIEW` install via own FileProvider).
3. Else diff `manifest.files[*].sha256` against local `version.json` (bundled in assets as factory baseline).
4. Download **only changed files** to `filesDir/staging/` (mirror-first, GitHub fallback), verify SHA-256 (pure-JS impl, no secure-context dependency).
5. `applyStagedFile` copies staging → `filesDir/web/<path>`, keeping the replaced file in `filesDir/web_backup/` (one-tap rollback).
6. Write new `version.json`, log to history, post notification, reload WebView.
`forceWeb:true` or a shell gap makes the update screen non-dismissable.

## 5. Notifications
Channels: `updates` (new version), `events` (notices/bhandara), `reminder` (daily seva).
Daily reminder = `AlarmManager.setInexactRepeating(RTC_WAKEUP, …, INTERVAL_DAY)` →
`AlarmReceiver`; re-armed after reboot/app-update by `BootReceiver`
(`BOOT_COMPLETED` + `MY_PACKAGE_REPLACED`). POST_NOTIFICATIONS requested at runtime on API 33+.

## 6. APK build (no Gradle)
`aapt2 compile/link` (manifest+res+assets) → `javac -source 8` against `android.jar` →
`d8` (min-api 23) → inject `classes.dex` → `zipalign -p 4` → `apksigner` (v1+v2+v3).
Hard guards in the script fail the build if classes or the dex go missing —
the exact failure mode that produces "tiny broken APKs".

## 7. Admin cPanel
Static single-file app on GitHub Pages (`admin/index.html`). Authenticates with the
operator's PAT held in **sessionStorage only**; talks to:
- `GET /user` (session check)
- `PUT /repos/{o}/{r}/contents/…` (upload patches + manifest + history)
- `POST /repos/{o}/{r}/releases` + asset upload (APK channel)
Diffing happens **in the browser** (WebCrypto SHA-256) so unchanged files never upload.
`tools/publish.py` is the headless twin of the same pipeline.
