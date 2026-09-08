# Admin cPanel — operating guide

URL: **https://glitchyapi.github.io/satlok-seva/admin/**

## One-time setup
1. Create a GitHub PAT: *Settings → Developer settings → Tokens (classic)* with **`repo`** scope
   (fine-grained: Contents = Read & write on this repo only).
2. Open the cPanel, paste the token, repo = `glitchyapi/satlok-seva`, **Connect**.
3. The token never leaves your browser tab (sessionStorage) and never touches our servers.

## Publish a web (in-app) update — most common task
1. Tab **Publish web update** → choose the `app/assets/web` **folder** (Chrome/Edge: folder picker keeps sub-folders).
2. Version name/code auto-suggest (code = live + 1). Write changelog lines.
3. **1 · Scan & diff** → shows exactly which files changed (SHA-256 compare against the live manifest).
4. **2 · Publish update** → uploads only the changed files to `updates/files/…`, then atomically swaps `manifest.json` and prepends `history.json`.
5. Devices pick it up on their next open: silent notification + in-app banner; user taps *Update now* → per-file progress → auto reload. Tick **force** for must-install updates.

## Publish a native APK
Needed only when Java/manifest/resources change (the shell). Build with `tools/build-apk.sh`,
then tab **Publish APK** → pick `.apk`, set version name/code → publish.
Creates a GitHub Release, uploads the asset, writes `manifest.apk` (+ optional *minimum shell*).
Old shells then show the “install APK” screen with hash-verified download.

## Push a notice
Tab **Notice** → title/body → push. Every device shows an in-app banner + system notification
on next launch (e.g. bhandara announcements). *Clear notice* removes it.

## Mirrors (HeOnlyFiles / any direct-link host)
1. Upload the changed files to your host, copy the **direct download** links.
2. Tab **Mirrors** → one `path URL` per line → save. Clients try mirrors first and fall back to
   GitHub; every file is SHA-256 verified either way.
3. You can also add whole-manifest mirrors (`manifestMirrors`) if GitHub is ever blocked.

## Rollback
Devices: *More → Updates → Restore previous version* (local backup of replaced files).
Channel: re-publish the previous folder state (scan & diff makes this a no-op check).

## Safety
- Rotate the setup PAT after go-live; the cPanel works with any operator's own token.
- The signing keystore (`keystore/seva.jks`) lives **outside** this repo by design — guard it;
  APK updates must be signed with the same key or Android will refuse the install.
