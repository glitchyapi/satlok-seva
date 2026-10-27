#!/usr/bin/env python3
"""
Publish the current build to GitHub Pages as a signed OTA release.

  python3 scripts/publish.py --notes "…" --notes "…" [--apk] [--bump patch]

* hashes every file in app/assets/www
* uploads ONLY files whose hash differs from the live manifest
* signs the manifest with keys/manifest-private.pem (RSA-2048 / SHA-256)
* writes everything in ONE atomic commit via the Git Data API
* optionally uploads the freshly built APK and updates the shell block
"""
import argparse, base64, hashlib, json, os, sys, time, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CFG = json.load(open(os.path.join(ROOT, "build.json")))
TOKEN = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
if not TOKEN:
    tf = os.path.join(ROOT, "keys", "gh_token")
    if os.path.isfile(tf):
        TOKEN = open(tf).read().strip()
if not TOKEN:
    sys.exit("Set GH_TOKEN or write keys/gh_token")

OWNER, REPO, BRANCH = CFG["owner"], CFG["repo"], "main"
API = "https://api.github.com"
PAGES = f"https://{OWNER}.github.io/{REPO}/"


def gh(path, method="GET", body=None):
    req = urllib.request.Request(API + path, method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": "Bearer " + TOKEN,
                 "Accept": "application/vnd.github+json",
                 "X-GitHub-Api-Version": "2022-11-28",
                 "Content-Type": "application/json",
                 "User-Agent": "satlok-seva-publisher"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            raw = r.read().decode()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        sys.exit(f"GitHub {method} {path} -> {e.code}\n{e.read().decode()[:600]}")


def fetch_live():
    try:
        req = urllib.request.Request(PAGES + "ota/manifest.json",
                                     headers={"User-Agent": "satlok-seva-publisher"})
        with urllib.request.urlopen(req, timeout=30) as r:
            m = json.loads(r.read().decode())
        p = m["payload"]
        if isinstance(p, str):
            p = json.loads(p)
        return m, p
    except Exception:
        return None, {}


def sign(payload_str):
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding
    key = serialization.load_pem_private_key(
        open(os.path.join(ROOT, "keys", "manifest-private.pem"), "rb").read(), password=None)
    sig = key.sign(payload_str.encode(), padding.PKCS1v15(), hashes.SHA256())
    return base64.b64encode(sig).decode()


def commit(files, message):
    ref = gh(f"/repos/{OWNER}/{REPO}/git/ref/heads/{BRANCH}")
    base_sha = ref["object"]["sha"]
    base = gh(f"/repos/{OWNER}/{REPO}/git/commits/{base_sha}")
    tree = []
    for i, (path, data) in enumerate(files, 1):
        blob = gh(f"/repos/{OWNER}/{REPO}/git/blobs", "POST",
                  {"content": base64.b64encode(data).decode(), "encoding": "base64"})
        tree.append({"path": path, "mode": "100644", "type": "blob", "sha": blob["sha"]})
        print(f"  [{i}/{len(files)}] {path}  ({len(data)/1024:.1f} KB)")
    nt = gh(f"/repos/{OWNER}/{REPO}/git/trees", "POST",
            {"base_tree": base["tree"]["sha"], "tree": tree})
    c = gh(f"/repos/{OWNER}/{REPO}/git/commits", "POST",
           {"message": message, "tree": nt["sha"], "parents": [base_sha]})
    gh(f"/repos/{OWNER}/{REPO}/git/refs/heads/{BRANCH}", "PATCH", {"sha": c["sha"], "force": False})
    print(f"  → commit {c['sha'][:7]}")
    return c


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--notes", action="append", default=[])
    ap.add_argument("--apk", action="store_true", help="also publish the built APK as a shell update")
    ap.add_argument("--channel", default=CFG.get("channel", "stable"))
    ap.add_argument("--mandatory", action="store_true")
    ap.add_argument("--mirror", action="append", default=[])
    ap.add_argument("--apk-url", default=None, help="external direct APK link (e.g. a file host)")
    args = ap.parse_args()

    www = os.path.join(ROOT, "app", "assets", "www")
    live_manifest, payload = fetch_live()
    old_files = {f["path"]: f["sha256"] for f in payload.get("web", {}).get("files", [])}

    files_now, upload = {}, []
    for dp, dn, fn in os.walk(www):
        for f in sorted(fn):
            full = os.path.join(dp, f)
            rel = os.path.relpath(full, www).replace(os.sep, "/")
            data = open(full, "rb").read()
            sha = hashlib.sha256(data).hexdigest()
            files_now[rel] = {"path": rel, "sha256": sha, "size": len(data)}
            if old_files.get(rel) != sha:
                upload.append(("ota/" + rel, data))

    file_list = [files_now[k] for k in sorted(files_now)]
    total = sum(f["size"] for f in file_list)
    delta = sum(len(d) for _, d in upload)
    print(f"▸ {len(file_list)} files, {total/1024:.1f} KB total")
    print(f"▸ delta: {len(upload)} changed files, {delta/1024:.1f} KB")

    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    payload = dict(payload)
    payload.update({"schema": 1, "app": "satlok-seva", "channel": args.channel,
                    "requireSignature": True, "updatedAt": now})
    notes = args.notes or ["First production release"]
    mirrors = args.mirror or [f"https://cdn.jsdelivr.net/gh/{OWNER}/{REPO}@{BRANCH}/ota/"]
    payload["web"] = {
        "version": CFG["webVersion"], "build": CFG["webBuild"], "releasedAt": now,
        "baseUrl": PAGES + "ota/", "mirrors": mirrors, "files": file_list,
        "fullSize": total, "mandatory": args.mandatory,
        "minShell": CFG["versionCode"],
        "notes": {"hi": notes, "en": notes, "pa": notes, "hr": notes},
    }

    info_path = os.path.join(ROOT, "dist", "build-info.json")
    if args.apk:
        info = json.load(open(info_path))
        apk_path = os.path.join(ROOT, "dist", info["apk"])
        apk_data = open(apk_path, "rb").read()
        remote = f"ota/apk/{info['apk']}"
        upload.append((remote, apk_data))
        upload.append(("release/" + info["apk"], apk_data))
        payload["shell"] = {
            "versionName": info["versionName"], "versionCode": info["versionCode"],
            "apkUrl": args.apk_url or (PAGES + remote),
            "sha256": info["sha256"], "size": info["size"], "releasedAt": now,
            "mandatory": False, "notes": {"hi": notes, "en": notes, "pa": notes, "hr": notes},
        }
        upload.append(("release/latest.json", json.dumps({
            "versionName": info["versionName"], "versionCode": info["versionCode"],
            "url": payload["shell"]["apkUrl"], "sha256": info["sha256"],
            "size": info["size"], "releasedAt": now,
            "downloadPage": PAGES}, indent=1).encode()))
        print(f"▸ APK {info['versionName']} ({info['size']/1024:.0f} KB)")

    payload_str = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
    manifest = {"schema": 1, "app": "satlok-seva", "publishedAt": now,
                "payload": payload_str, "signature": sign(payload_str)}
    raw = json.dumps(manifest, indent=1, ensure_ascii=False).encode()
    upload.append(("ota/manifest.json", raw))
    if live_manifest:
        upload.append(("ota/manifest.previous.json",
                       json.dumps(live_manifest, indent=1, ensure_ascii=False).encode()))
    upload.append(("ota/version.json", json.dumps({
        "version": CFG["webVersion"], "build": CFG["webBuild"], "channel": args.channel,
        "updatedAt": now, "apk": payload.get("shell")}, indent=1).encode()))
    upload.append(("ota/_lock.json", json.dumps(
        {"version": CFG["webVersion"], "build": CFG["webBuild"], "files": files_now}, indent=1).encode()))

    print(f"▸ publishing {len(upload)} objects in one atomic commit")
    commit(upload, f"release: {CFG['webVersion']} ({CFG['webBuild']})" +
                   (" + APK" if args.apk else ""))
    print(f"\n✅ live in ~30–60s → {PAGES}ota/manifest.json")


if __name__ == "__main__":
    main()
