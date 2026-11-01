# सतलोक सेवा · Satlok Seva

Daily seva diary, Bhandara banner maker and encrypted offline storage for the
Sant Rampal Ji Maharaj sangat. Native Android shell + hot-updatable web UI.

**Download & release console:** https://glitchyapi.github.io/satlok-seva/

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│ APK  (native Java, zero third-party dependencies)         │
│  MainActivity   WebView host + local HTTPS asset server   │
│  Bridge         JS ⇄ native surface                       │
│  SecureStore    Android Keystore · AES-256-GCM · DEFLATE  │
│  OtaManager     staging → SHA-256 verify → atomic swap    │
│  Notifier       channels · exact alarms · boot restore    │
│  ShareProvider  content:// URIs for APK install & sharing │
└──────────────────────────────────────────────────────────┘
                    ▲ serves
┌──────────────────────────────────────────────────────────┐
│ Web bundle  (HTML/CSS/JS — the whole UI)                  │
│  assets/www/  →  files/www/ (OTA overlay wins)            │
└──────────────────────────────────────────────────────────┘
                    ▲ reads
┌──────────────────────────────────────────────────────────┐
│ Universal URL   …/manifest.json                           │
│  latest.apk  → versionCode bump → download + install      │
│  latest.web  → webVersion bump  → file-level delta        │
│  broadcast   → device notification, no update needed      │
└──────────────────────────────────────────────────────────┘
```

The UI is served from the virtual origin `https://appassets.androidplatform.net/`
by intercepting requests in `shouldInterceptRequest`. That gives a genuine
secure context (WebCrypto works), keeps same-origin rules intact, and lets a
hot-updated file transparently override the copy baked into the APK. No bytes
touch the network to render the app.

## Two independent update tracks

| Track | Trigger | What the user gets |
|---|---|---|
| **Web** | `latest.web.version` increases | Only files whose SHA-256 changed are downloaded. Applied instantly, app restarts itself. No reinstall. |
| **APK** | `latest.versionCode` increases | Signed APK downloaded, hash-verified, handed to the system installer. Needed only when native code changes. |

**Safety:** every file is SHA-256 verified before it is committed. The commit
swaps directories atomically and stays *pending* until the JS layer calls
`otaConfirmBoot()`. If the new bundle crashes before confirming, the shell
rolls back to the previous bundle on the next launch.

## Storage

`JSON → DEFLATE(9, raw) → AES-256-GCM → files/vault.slk`

The key lives in the Android Keystore (TEE/StrongBox where available) and is
never exportable. A `.bak` of the previous vault is kept, so a corrupted write
recovers instead of wiping the user's data. Backups are separately encrypted
with PBKDF2-SHA256 (210 000 iterations) when a password is supplied.

Measured on a 250-entry dataset: **23 778 B → 2 324 B (90.2 % smaller)**, encrypted.

## Build

No Gradle, no Android Studio, no third-party libraries.

```bash
./build.sh                                   # → dist/SatlokSeva-v1.0.0.apk
VERSION_CODE=12 VERSION_NAME=1.1.0 ./build.sh
```

Pipeline: `aapt2 compile → aapt2 link → javac → d8 → zipalign → apksigner (v1+v2+v3)`.

The build **fails hard** on any javac error and then structurally verifies the
finished APK (manifest, dex, resource table, all expected classes, size floor).
This is deliberately strict: a partially-compiled APK is exactly what produces
the "app is only a few KB / error parsing package" failure.

## Publish

```bash
GH_TOKEN=… python3 scripts/publish.py --push \
  --version-name 1.0.0 --version-code 11 --web-version 1
```

Refuses to publish unless the APK has ZIP magic, `AndroidManifest.xml`,
`classes.dex`, `resources.arsc` and a signature block.

## Release console

`site/admin/` — a static page that talks directly to `api.github.com`.

* Token is held in `sessionStorage` only, never committed.
* Releases are published as **one atomic commit** via the Git Data API.
* Web uploads are hashed in-browser; only changed files are sent.
* APK uploads are parsed (ZIP central directory) before upload — an HTML 404
  page can never be shipped as an `.apk`.
* **Health check** re-fetches the live URLs as a device would and verifies
  every hash.

## Tests

```bash
python3 -m http.server 8080 --directory assets/www
python3 scripts/test_ui.py     # Playwright: onboarding → seva → banner → i18n → persistence
```

## Privacy

No ads, no analytics, no accounts, no server-side data. Confidential
naam/mantra is never entered or displayed in the app.

सत साहिब जी 🙏
