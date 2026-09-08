# 🪔 Satlok Seva — सेवा डायरी
**Seva diary + bhandara banner studio for Sant Rampal Ji Maharaj bhakts**, with a self-hosted OTA update channel (file-to-file patches), an admin cPanel on GitHub Pages, and a from-scratch Android shell (no Gradle, no bloat).

| | |
|---|---|
| App package | `io.satlok.seva` |
| Shell (native) | WebView + JS bridge, AES-256-GCM + DEFLATE on-device store |
| Min / target SDK | 23 (Android 6.0) / 34 |
| Update channel | `https://glitchyapi.github.io/satlok-seva/updates/manifest.json` (universal URL, JSON storage) |
| Admin cPanel | `https://glitchyapi.github.io/satlok-seva/admin/` |
| Languages | हिन्दी · English · ਪੰਜਾਬੀ |

---

## Features
- **Dashboard** — today's seva ring, day streak, month count, next-bhandara card, quick-add tiles, day-timeline cards (reference UX).
- **Seva diary** — log Naam Jaap / Satsang / Bhandara Seva / Prachar / Daan / Padhna with count, unit, note, date; filter chips + search; edit/delete.
- **Bhandara studio** — events with date/place/time/contact; **3 canvas banner templates** (Maroon Utsav / Saffron Dawn / Minimal Cream) rendered at 1080×1350 and shareable as PNG; text-invite sharing.
- **Stats** — 7-day bars, per-type breakdown, streaks, averages.
- **Security** — all data encrypted on device: **AES-256-GCM** after **raw DEFLATE level-9** compression (key = PBKDF2-SHA256 of device material), optional 4-digit app-lock PIN, encrypted `.ssv` backups via Storage Access Framework (no broad storage permission needed).
- **Notifications** — daily seva reminder (AlarmManager, survives reboot), bhandara/update/notice channels, runtime POST_NOTIFICATIONS flow.
- **OTA updates** — on every app open: fetch universal manifest → SHA-256 diff → download **only changed files** (mirrors supported, hash-verified) → apply to writable web root → reload. Native-shell updates download the signed APK from GitHub Releases and hand it to the package installer.
- **In-app translations** — full hi/en/pa dictionaries, switchable live.
- **Update-required UI** — progress bar, per-file log, changelog, force mode, rollback to previous version.

## Repository layout
```
app/                  Android shell (Java) + web app assets
  AndroidManifest.xml
  java/satlok/seva/   MainActivity, NativeBridge, CryptoStore, MyFileProvider, receivers
  assets/web/         the whole app UI (html/css/js) — this is what OTA updates patch
  res/                icons (adaptive), splash, theme
admin/index.html      cPanel (GitHub Pages) — publish web updates / APKs / notices / mirrors
updates/              THE update channel (manifest.json + files/) — written via GitHub API
tools/
  build-apk.sh        from-scratch APK build: aapt2 → javac → d8 → zipalign → apksigner
  fetch-tools.sh      downloads JDK17 + build-tools 34 + platform 34
  publish.py          CLI publisher (same pipeline as the cPanel)
  process_logo.py     regenerates all icon densities from assets/brand/logo_raw.png
docs/                 architecture + admin guide
```

## Build the APK (any Linux box)
```bash
bash tools/fetch-tools.sh        # ~320 MB toolchain into /var/tmp/at
bash tools/build-apk.sh          # → dist/SatlokSeva-vX.Y.Z.apk (signed)
```
Signing key: `keystore/seva.jks` (created on first build — **back it up privately; every future APK must use it**).

## Publish an update
**From the cPanel** (recommended): open `…/admin/`, sign in with a PAT (contents permission), pick the `app/assets/web` folder → *Scan & diff* → *Publish*. Only changed files upload; devices pick them up on next open.
**From CLI**:
```bash
GH_TOKEN=*** python3 tools/publish.py --version 1.0.1 --code 2 --changelog "Faster dashboard|New banner"
GH_TOKEN=*** python3 tools/publish.py --apk dist/SatlokSeva-v1.1.0.apk --apk-version 1.1.0 --apk-code 2
```

## Mirrors (HeOnlyFiles or any direct-link host)
The manifest supports per-file mirror URLs and extra manifest URLs. Upload changed files to your host, paste `path URL` lines in the cPanel *Mirrors* tab. Devices try mirrors first, then GitHub, and **verify SHA-256 of every byte** before applying.

> ⚠️ Security note: rotate the GitHub PAT used during setup once the project goes live; the cPanel only ever keeps your token in browser sessionStorage.
