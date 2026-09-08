#!/usr/bin/env python3
"""Satlok Seva OTA publisher — pushes web patches + manifest to the GitHub-hosted update channel.
Usage:
  GH_TOKEN=*** python3 tools/publish.py --version 1.0.1 --code 2 --changelog "Fix X|Add Y"
  python3 tools/publish.py --apk dist/SatlokSeva-v1.1.0.apk --apk-version 1.1.0 --apk-code 2
"""
import argparse, base64, hashlib, json, os, sys, urllib.request, mimetypes

GH = "https://api.github.com"

def api(path, token, data=None, method=None, raw=None, ctype="application/json"):
    url = GH + path if path.startswith("/") else path
    req = urllib.request.Request(url, method=method or ("POST" if (data is not None or raw is not None) else "GET"))
    req.add_header("Accept", "application/vnd.github+json")
    req.add_header("User-Agent", "satlok-seva-publisher")
    if token: req.add_header("Authorization", "Bearer " + token)
    body = None
    if raw is not None:
        body = raw; req.add_header("Content-Type", ctype)
    elif data is not None:
        body = json.dumps(data).encode(); req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, body) as r:
            return json.loads(r.read().decode() or "null")
    except urllib.error.HTTPError as e:
        raise SystemExit("HTTP %s on %s: %s" % (e.code, url, e.read().decode()[:400]))

def sha256(b): return hashlib.sha256(b).hexdigest()

def get_manifest(repo):
    url = "https://raw.githubusercontent.com/%s/main/updates/manifest.json" % repo
    try:
        with urllib.request.urlopen(url) as r: return json.loads(r.read().decode())
    except Exception: return None

def put_file(repo, token, path, content_bytes, message):
    cur = None
    try:
        cur = api("/repos/%s/contents/%s" % (repo, path), token)
    except SystemExit:
        cur = None
    body = {"message": message, "content": base64.b64encode(content_bytes).decode(), "branch": "main"}
    if cur and cur.get("sha"): body["sha"] = cur["sha"]
    return api("/repos/%s/contents/%s" % (repo, path), token, data=body)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", default=os.environ.get("SSV_REPO", "glitchyapi/satlok-seva"))
    ap.add_argument("--token", default=os.environ.get("GH_TOKEN", ""))
    ap.add_argument("--web", default="app/assets/web")
    ap.add_argument("--version")
    ap.add_argument("--code", type=int)
    ap.add_argument("--changelog", default="")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--apk")
    ap.add_argument("--apk-version")
    ap.add_argument("--apk-code", type=int)
    ap.add_argument("--min-shell", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    token = a.token
    if not token and not a.dry_run: raise SystemExit("GH_TOKEN required")

    owner, name = a.repo.split("/")
    pages = "https://%s.github.io/%s/" % (owner, name)
    m = get_manifest(a.repo) or {}
    old_files = m.get("files", {})

    # ---- scan web dir
    local = {}
    for root, _, fs in os.walk(a.web):
        for f in fs:
            p = os.path.join(root, f)
            rel = os.path.relpath(p, a.web).replace(os.sep, "/")
            b = open(p, "rb").read()
            local[rel] = {"sha256": sha256(b), "size": len(b), "bytes": b}
    changed = [p for p in local if old_files.get(p, {}).get("sha256") != local[p]["sha256"]]
    print("scanned %d files, %d changed" % (len(local), len(changed)))

    newm = dict(m)
    if a.apk:
        b = open(a.apk, "rb").read()
        rel = api("/repos/%s/releases" % a.repo, token, data={
            "tag_name": "apk-v" + a.apk_version, "name": "Satlok Seva APK v" + a.apk_version,
            "body": a.changelog.replace("|", "\n"), "draft": False, "prerelease": False})
        up = rel["upload_url"].replace("{?name,label}", "?name=%s" % os.path.basename(a.apk))
        api(up, token, raw=b, ctype="application/vnd.android.package-archive")
        newm["apk"] = {"versionName": a.apk_version, "versionCode": a.apk_code,
                       "url": rel["html_url"] + "/download/" + os.path.basename(a.apk) if False else
                             "https://github.com/%s/releases/download/apk-v%s/%s" % (a.repo, a.apk_version, os.path.basename(a.apk)),
                       "sha256": sha256(b), "size": len(b)}
        if a.min_shell: newm["minShell"] = a.apk_code
        print("apk release published:", newm["apk"]["url"])

    if a.version:
        for p in changed:
            print("upload updates/files/" + p)
            if not a.dry_run:
                put_file(a.repo, token, "updates/files/" + p, local[p]["bytes"], "update v%s: %s" % (a.code, p))
        newm.update({
            "app": "satlok-seva", "version": a.version, "versionCode": a.code,
            "minShell": newm.get("minShell", 1),
            "changelog": [x for x in a.changelog.split("|") if x.strip()],
            "forceWeb": a.force,
            "baseUrl": pages + "updates/files/",
            "mirrors": newm.get("mirrors", {}), "manifestMirrors": newm.get("manifestMirrors", []),
            "files": {p: {"sha256": local[p]["sha256"], "size": local[p]["size"]} for p in local},
            "ts": int(__import__("time").time() * 1000),
        })
        if not a.dry_run:
            put_file(a.repo, token, "updates/manifest.json", json.dumps(newm, indent=1).encode(), "publish v%s (%s)" % (a.version, a.code))
            hist = []
            try:
                with urllib.request.urlopen("https://raw.githubusercontent.com/%s/main/updates/history.json" % a.repo) as r:
                    hist = json.loads(r.read().decode())
            except Exception: pass
            hist.insert(0, {"version": a.version, "versionCode": a.code, "ts": newm["ts"], "files": len(changed)})
            put_file(a.repo, token, "updates/history.json", json.dumps(hist[:40], indent=1).encode(), "history v%s" % a.version)
        print("published v%s (%s) — %d changed files" % (a.version, a.code, len(changed)))
    print("manifest:", pages + "updates/manifest.json")

if __name__ == "__main__":
    main()
