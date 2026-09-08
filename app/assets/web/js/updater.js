/* ============ OTA update engine ============
   • Universal manifest URL (JSON storage on GitHub Pages / raw / any mirror)
   • File-to-file diff: only changed files download (sha256 compare)
   • Mirror support (HeOnlyFiles / any direct-link host) with automatic fallback
   • Native-shell (APK) updates when minShell > installed shell                */
(function (g) {
  var MANIFEST_URLS = [
    "https://glitchyapi.github.io/satlok-seva/updates/manifest.json",
    "https://raw.githubusercontent.com/glitchyapi/satlok-seva/main/updates/manifest.json"
  ];
  var state = { checking: false, manifest: null, diff: [], pending: false, apkRequired: false, lastError: "" };

  function urls() {
    var extra = Bridge.prefsGet("manifestUrl", "");
    var list = extra ? [extra].concat(MANIFEST_URLS) : MANIFEST_URLS.slice();
    var m = state.manifest;
    if (m && m.manifestMirrors) list = list.concat(m.manifestMirrors);
    return list;
  }

  function fetchJson(url, cb) {
    Bridge.fetchUrl(url + (url.indexOf("?") >= 0 ? "&" : "?") + "_t=" + Date.now(), function (r) {
      if (!r.ok) { cb(null); return; }
      try {
        var txt = decodeURIComponent(escape(atob(r.b64)));
        cb(JSON.parse(txt));
      } catch (e) { cb(null); }
    });
  }

  function localManifest() {
    var m = Bridge.currentWebManifest();
    if (m) return m;
    return { version: Bridge.info().versionName, versionCode: 0, files: {} };
  }

  function computeDiff(remote, local) {
    var diff = [];
    for (var p in remote.files) {
      var f = remote.files[p];
      var lsha = local.files && local.files[p];
      if (lsha !== f.sha256) diff.push({ path: p, sha256: f.sha256, size: f.size || 0 });
    }
    return diff;
  }

  function fileUrls(manifest, path) {
    var list = [];
    if (manifest.mirrors && manifest.mirrors[path]) list = list.concat(manifest.mirrors[path]);
    var base = manifest.baseUrl || (MANIFEST_URLS[0].replace("manifest.json", "files/"));
    list.push(base + path);
    return list;
  }

  function downloadOne(manifest, item, onProg, cb) {
    var candidates = fileUrls(manifest, item.path);
    var idx = 0;
    var stagingName = item.path.replace(/[\/\\]/g, "__");
    function tryNext() {
      if (idx >= candidates.length) { cb(false); return; }
      var url = candidates[idx++];
      Bridge.downloadToFile(url, stagingName, function (ev) {
        if (ev.type === "progress") { onProg(ev.done, ev.total); return; }
        if (ev.type === "done" && ev.ok) {
          Bridge.stagingSha256(stagingName, function (sha) {
            if (sha === item.sha256) cb(true);
            else tryNext(); // hash mismatch -> try mirror
          });
        } else tryNext();
      });
    }
    tryNext();
  }

  var Updater = {
    state: state,
    check: function (cb) {
      if (state.checking) { cb && cb(null, "busy"); return; }
      state.checking = true; state.lastError = "";
      var list = urls(), i = 0;
      (function next() {
        if (i >= list.length) {
          state.checking = false; state.lastError = "no-source";
          cb && cb(null, "no-source"); return;
        }
        fetchJson(list[i++], function (m) {
          if (!m || !m.files) { next(); return; }
          state.checking = false;
          state.manifest = m;
          var info = Bridge.info();
          var local = localManifest();
          state.apkRequired = !!(m.apk && m.apk.versionCode > info.versionCode);
          state.diff = computeDiff(m, local);
          state.pending = state.diff.length > 0 || (m.versionCode > local.versionCode);
          cb && cb(m, null);
        });
      })();
    },
    hasUpdate: function () { return state.pending || state.apkRequired; },
    diffSize: function () {
      return state.diff.reduce(function (a, b) { return a + (b.size || 0); }, 0);
    },
    apply: function (hooks) {
      hooks = hooks || {};
      var diff = state.diff.slice();
      var total = diff.length, done = 0, failed = null;
      var manifest = state.manifest;
      function finish(ok) {
        if (!ok) { hooks.fail && hooks.fail(failed); return; }
        // remove files no longer in manifest
        var local = localManifest();
        if (local.files) for (var p in local.files) if (!manifest.files[p]) { if (Bridge.deleteWebFile) Bridge.deleteWebFile(p); }
        var newLocal = { version: manifest.version, versionCode: manifest.versionCode, files: {} };
        for (var q in manifest.files) newLocal.files[q] = manifest.files[q].sha256;
        Bridge.writeWebManifest(newLocal);
        Store.logUpdate({ ts: Date.now(), version: manifest.version, files: total });
        hooks.done && hooks.done();
        setTimeout(function () { Bridge.reloadWeb(); }, 700);
      }
      (function step() {
        if (!diff.length) { finish(true); return; }
        var item = diff.shift();
        hooks.file && hooks.file(item, done, total);
        downloadOne(manifest, item, function (d, t) { hooks.prog && hooks.prog(item, d, t); }, function (ok) {
          if (!ok) { failed = item.path; finish(false); return; }
          Bridge.applyStaged(item.path.replace(/[\/\\]/g, "__"), item.path);
          done++;
          hooks.after && hooks.after(item, done, total);
          step();
        });
      })();
    },
    apkInfo: function () { return state.manifest && state.manifest.apk; },
    downloadApk: function (hooks) {
      var apk = Updater.apkInfo(); if (!apk) { hooks.fail && hooks.fail(); return; }
      var name = "satlok-seva-" + apk.versionName + ".apk";
      Bridge.downloadToFile(apk.url, name, function (ev) {
        if (ev.type === "progress") { hooks.prog && hooks.prog(ev.done, ev.total); return; }
        if (ev.type === "done" && ev.ok) {
          Bridge.stagingSha256(name, function (sha) {
            if (!apk.sha256 || sha === apk.sha256) hooks.done && hooks.done(name);
            else hooks.fail && hooks.fail("hash");
          });
        } else hooks.fail && hooks.fail("net");
      });
    },
    installApk: function (name) { return Bridge.installApk(name); },
    rollback: function () { Bridge.rollbackWeb(); setTimeout(function () { Bridge.reloadWeb(); }, 400); },
    notice: function () { return state.manifest && state.manifest.notice; }
  };
  g.Updater = Updater;
})(window);
