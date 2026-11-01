#!/usr/bin/env python3
"""Assemble the GitHub Pages site + release manifest and publish.

Produces:
  site/index.html            download / landing page
  site/admin/                release console
  site/assets/               logo + screenshots
  site/apk/<name>.apk        the signed APK
  site/web/<v>/…             versioned web bundle (OTA source)
  site/manifest.json         the universal update URL

Everything is verified before it is written, so a broken/absent APK can
never be advertised in the manifest again.
"""
import argparse, hashlib, json, os, shutil, subprocess, sys, datetime, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(ROOT, 'site')

p = argparse.ArgumentParser()
p.add_argument('--owner', default='glitchyapi')
p.add_argument('--repo', default='satlok-seva')
p.add_argument('--version-name', default='1.0.0')
p.add_argument('--version-code', type=int, default=11)
p.add_argument('--web-version', type=int, default=1)
p.add_argument('--push', action='store_true')
a = p.parse_args()

base = f'https://{a.owner}.github.io/{a.repo}/'
apk_src = os.path.join(ROOT, 'dist', f'SatlokSeva-v{a.version_name}.apk')
if not os.path.exists(apk_src):
    sys.exit(f'✖ APK not found: {apk_src} — run build.sh first')

# ── verify the APK really is an APK ────────────────────────────────
raw = open(apk_src, 'rb').read()
if not raw.startswith(b'PK\x03\x04'):
    sys.exit('✖ APK does not start with ZIP magic — refusing to publish')
z = zipfile.ZipFile(apk_src)
names = set(z.namelist())
for req in ('AndroidManifest.xml', 'classes.dex', 'resources.arsc', 'assets/www/index.html'):
    if req not in names:
        sys.exit(f'✖ APK missing {req} — refusing to publish')
if not any(n.startswith('META-INF/') and n.endswith(('.RSA', '.DSA', '.EC')) for n in names):
    sys.exit('✖ APK is not signed — refusing to publish')
apk_sha = hashlib.sha256(raw).hexdigest()
print(f'✓ APK verified · {len(raw):,} bytes · sha256 {apk_sha[:16]}…')

# ── assets ─────────────────────────────────────────────────────────
os.makedirs(os.path.join(SITE, 'assets'), exist_ok=True)
os.makedirs(os.path.join(SITE, 'apk'), exist_ok=True)
for f in ('logo-192.png', 'logo-512.png'):
    shutil.copy2(os.path.join(ROOT, 'assets/www/img', f), os.path.join(SITE, 'assets', f))
shots = os.path.join(ROOT, 'test-shots')
if os.path.isdir(shots):
    for f in os.listdir(shots):
        if f.endswith('.png'):
            shutil.copy2(os.path.join(shots, f), os.path.join(SITE, 'assets', f))

# ── APK (versioned + stable "latest" alias) ────────────────────────
apk_name = f'SatlokSeva-{a.version_name}-{a.version_code}.apk'
shutil.copy2(apk_src, os.path.join(SITE, 'apk', apk_name))
shutil.copy2(apk_src, os.path.join(SITE, 'apk', 'SatlokSeva-latest.apk'))

# ── versioned web bundle ───────────────────────────────────────────
webdir = os.path.join(SITE, 'web', str(a.web_version))
os.makedirs(webdir, exist_ok=True)
www = os.path.join(ROOT, 'assets/www')
files = []
for r, dirs, ns in os.walk(www):
    dirs[:] = [d for d in dirs if not d.startswith('.')]
    for n in sorted(ns):
        if n.startswith('.'):
            continue
        full = os.path.join(r, n)
        rel = os.path.relpath(full, www).replace(os.sep, '/')
        dest = os.path.join(webdir, rel)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        shutil.copy2(full, dest)
        data = open(full, 'rb').read()
        files.append({'path': rel, 'sha256': hashlib.sha256(data).hexdigest(), 'size': len(data)})
files.sort(key=lambda f: f['path'])
total = sum(f['size'] for f in files)
web = {'version': a.web_version, 'entry': 'index.html', 'baseUrl': base + f'web/{a.web_version}/',
       'generatedAt': datetime.datetime.utcnow().isoformat() + 'Z',
       'fileCount': len(files), 'totalBytes': total, 'files': files}
json.dump(web, open(os.path.join(SITE, 'web', 'latest.json'), 'w'), indent=2, ensure_ascii=False)
print(f'✓ web bundle v{a.web_version} · {len(files)} files · {total/1024:.1f} KB')

# ── the universal manifest ─────────────────────────────────────────
prev = {}
mp = os.path.join(SITE, 'manifest.json')
if os.path.exists(mp):
    try: prev = json.load(open(mp))
    except Exception: prev = {}
now = datetime.datetime.utcnow().isoformat() + 'Z'
manifest = {
    'schema': 1,
    'app': 'satlok-seva',
    'channel': prev.get('channel', 'stable'),
    'minVersionCode': prev.get('minVersionCode', 0),
    'updatedAt': now,
    'latest': {
        'versionName': a.version_name,
        'versionCode': a.version_code,
        'releasedAt': now,
        'mandatory': False,
        'notes': prev.get('latest', {}).get('notes', {
            'hi': ['पहला स्थिर संस्करण — सेवा डायरी, भंडारा बैनर, एन्क्रिप्टेड स्टोरेज',
                   'फ़ाइल-दर-फ़ाइल डेल्टा अपडेट', 'हिन्दी · English · ਪੰਜਾਬੀ'],
            'en': ['First stable release — seva diary, Bhandara banners, encrypted storage',
                   'File-level delta updates', 'Hindi · English · Punjabi'],
            'pa': ['ਪਹਿਲਾ ਸਥਿਰ ਸੰਸਕਰਣ — ਸੇਵਾ ਡਾਇਰੀ, ਭੰਡਾਰਾ ਬੈਨਰ, ਐਨਕ੍ਰਿਪਟਿਡ ਸਟੋਰੇਜ',
                   'ਫ਼ਾਈਲ-ਦਰ-ਫ਼ਾਈਲ ਡੈਲਟਾ ਅਪਡੇਟ', 'ਹਿੰਦੀ · English · ਪੰਜਾਬੀ'],
        }),
        'apk': {'url': base + 'apk/' + apk_name, 'sha256': apk_sha, 'size': len(raw),
                'path': 'apk/' + apk_name, 'releasedAt': now},
        'web': web,
    },
    'broadcast': prev.get('broadcast', {'enabled': False}),
    'mirrors': [f'https://cdn.jsdelivr.net/gh/{a.owner}/{a.repo}@main/site/'],
}
json.dump(manifest, open(mp, 'w'), indent=2, ensure_ascii=False)
open(os.path.join(SITE, '.nojekyll'), 'w').close()
print(f'✓ manifest → {base}manifest.json')

# ── publish ────────────────────────────────────────────────────────
if not a.push:
    print('\n(assemble only — pass --push to publish)')
    sys.exit(0)

token = os.environ.get('GH_TOKEN')
if not token:
    sys.exit('✖ GH_TOKEN not set')

work = os.path.join(ROOT, 'build', 'publish-repo')
if os.path.isdir(work):
    shutil.rmtree(work)
url = f'https://x-access-token:{token}@github.com/{a.owner}/{a.repo}.git'
subprocess.run(['git', 'clone', '--quiet', url, work], check=True)
subprocess.run(['git', 'remote', 'set-url', 'origin',
                f'https://github.com/{a.owner}/{a.repo}.git'], cwd=work, check=True)

# wipe the old Pages content but keep history intact
for entry in os.listdir(work):
    if entry == '.git':
        continue
    fp = os.path.join(work, entry)
    shutil.rmtree(fp) if os.path.isdir(fp) else os.remove(fp)

for entry in os.listdir(SITE):
    s, d = os.path.join(SITE, entry), os.path.join(work, entry)
    shutil.copytree(s, d) if os.path.isdir(s) else shutil.copy2(s, d)

# source lives alongside so the project is reproducible
src = os.path.join(work, 'source')
os.makedirs(src, exist_ok=True)
for entry in ('android', 'assets', 'scripts', 'build.sh', 'README.md'):
    s, d = os.path.join(ROOT, entry), os.path.join(src, entry)
    if not os.path.exists(s):
        continue
    shutil.copytree(s, d, dirs_exist_ok=True) if os.path.isdir(s) else shutil.copy2(s, d)
shutil.copy2(os.path.join(ROOT, '.gitignore'), os.path.join(work, '.gitignore'))

subprocess.run(['git', 'add', '-A'], cwd=work, check=True)
subprocess.run(['git', '-c', 'user.name=Satlok Seva Release', '-c', 'user.email=release@satlok.local',
                'commit', '-q', '-m',
                f'release: {a.version_name} ({a.version_code}) — verified APK + web v{a.web_version}'],
               cwd=work, check=True)
push_url = f'https://x-access-token:{token}@github.com/{a.owner}/{a.repo}.git'
r = subprocess.run(['git', 'push', '--quiet', push_url, 'HEAD:main'], cwd=work)
if r.returncode != 0:
    sys.exit('✖ push failed')
print(f'\n✅ Published → {base}')
print(f'   manifest : {base}manifest.json')
print(f'   console  : {base}admin/')
print(f'   apk      : {base}apk/{apk_name}')
