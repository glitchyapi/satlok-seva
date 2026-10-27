/* ============================================================================
   Native bridge wrapper.
   In the APK, window.Native is the Java @JavascriptInterface. In a plain
   browser (admin preview / development) we transparently fall back to a
   localStorage + WebCrypto shim so the exact same bundle runs in both places.
   ========================================================================== */
(function () {
  const N = window.Native || null;
  const isNative = !!N;
  const callbacks = new Map();
  let seq = 0;

  window.__nativeCallback = function (id, payload) {
    const cb = callbacks.get(id);
    if (!cb) return;
    callbacks.delete(id);
    cb(payload);
  };

  function callAsync(method, args) {
    return new Promise((resolve) => {
      const id = "cb" + (++seq) + "_" + Date.now();
      callbacks.set(id, resolve);
      try {
        N[method](...args, id);
      } catch (e) {
        callbacks.delete(id);
        resolve({ ok: false, error: String(e && e.message || e) });
      }
      setTimeout(() => {
        if (callbacks.has(id)) { callbacks.delete(id); resolve({ ok: false, error: "timeout" }); }
      }, 180000);
    });
  }

  function jparse(s, fallback) {
    try { return typeof s === "string" ? JSON.parse(s) : (s || fallback); }
    catch (e) { return fallback; }
  }

  // ---- browser shim vault (dev only; the APK always uses the Java vault) ----
  const shim = {
    info() {
      return {
        shellCode: 1, shellName: "web-preview", webVersion: window.APP_VERSION || "1.0.0",
        webBuild: window.APP_BUILD || 1, sdk: 0, release: "browser", brand: "browser",
        model: navigator.userAgent.slice(0, 24), locale: navigator.language,
        notifAllowed: (window.Notification && Notification.permission === "granted"),
        canInstall: false, manifestUrl: "", overlay: false, freeBytes: 0, exactAlarms: true
      };
    },
    vaultWrite(k, v) {
      const raw = v.length;
      localStorage.setItem("ssv_" + k, v);
      return { ok: true, raw, packed: raw, ratio: 0 };
    },
    vaultRead(k) { const v = localStorage.getItem("ssv_" + k); return { ok: true, data: v }; },
    vaultDelete(k) { localStorage.removeItem("ssv_" + k); return { ok: true }; },
    vaultList() {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k.startsWith("ssv_")) keys.push(k.slice(4));
      }
      return { ok: true, keys };
    }
  };

  const B = {
    isNative,
    info() { return isNative ? jparse(N.info(), shim.info()) : shim.info(); },
    online() { return isNative ? N.online() : navigator.onLine; },
    bootOk() { if (isNative) N.bootOk(); },
    setTheme(dark) { if (isNative) N.setTheme(dark); },
    keepAwake(on) { if (isNative) N.keepAwake(on); },
    exit() { if (isNative) N.exit(); },
    vibrate(ms) { if (isNative) N.vibrate(ms); else if (navigator.vibrate) navigator.vibrate(ms); },
    openUrl(u) { if (isNative) N.openUrl(u); else window.open(u, "_blank"); },
    toast(m) { if (isNative) N.toast(m); },

    vaultWrite(k, obj) {
      const s = typeof obj === "string" ? obj : JSON.stringify(obj);
      return isNative ? jparse(N.vaultWrite(k, s), { ok: false }) : shim.vaultWrite(k, s);
    },
    vaultRead(k) {
      const r = isNative ? jparse(N.vaultRead(k), { ok: false }) : shim.vaultRead(k);
      if (!r.ok || r.data == null) return r.ok ? null : undefined;
      return jparse(r.data, null);
    },
    vaultDelete(k) { return isNative ? jparse(N.vaultDelete(k), {}) : shim.vaultDelete(k); },
    vaultList() { return isNative ? jparse(N.vaultList(), { keys: [] }) : shim.vaultList(); },
    vaultWriteRaw(k, b64) { return isNative ? jparse(N.vaultWriteRaw(k, b64), {}) : { ok: false }; },

    notify(id, ch, title, body, tab) { if (isNative) N.notify(id, ch, title, body, tab || ""); },
    notifAllowed() { return isNative ? N.notifAllowed() : false; },
    scheduleReminders(items) {
      return isNative ? jparse(N.scheduleReminders(JSON.stringify(items)), {}) : { ok: true };
    },
    openNotifSettings() { if (isNative) N.openNotifSettings(); },
    openAppSettings() { if (isNative) N.openAppSettings(); },
    exactAlarms() { return isNative ? N.exactAlarms() : true; },
    openAlarmSettings() { if (isNative) N.openAlarmSettings(); },
    hasPerm(n) { return isNative ? N.hasPerm(n) : false; },
    requestPerms(list) { return isNative ? callAsync("requestPerms", [JSON.stringify(list)]) : Promise.resolve({ granted: false }); },

    shareText(text) {
      if (isNative) N.shareText(text);
      else if (navigator.share) navigator.share({ text }).catch(() => {});
    },
    shareImage(dataUrl, filename, text) {
      return isNative ? jparse(N.shareImage(dataUrl, filename, text || ""), {}) : { ok: false, error: "web" };
    },
    saveImage(dataUrl, filename) {
      if (isNative) return jparse(N.saveImage(dataUrl, filename), {});
      const a = document.createElement("a"); a.href = dataUrl; a.download = filename; a.click();
      return { ok: true };
    },
    exportBackup(b64, filename) {
      if (isNative) return jparse(N.exportBackup(b64, filename), {});
      const a = document.createElement("a");
      a.href = "data:application/octet-stream;base64," + b64; a.download = filename; a.click();
      return { ok: true };
    },
    importBackup() {
      if (isNative) { N.importBackup(); return; }
      const inp = document.createElement("input");
      inp.type = "file"; inp.accept = ".ssvb,application/octet-stream";
      inp.onchange = () => {
        const f = inp.files[0]; if (!f) return;
        const r = new FileReader();
        r.onload = () => {
          const b64 = String(r.result).split(",")[1];
          window.__safResult && window.__safResult(4103, true, b64);
        };
        r.readAsDataURL(f);
      };
      inp.click();
    },

    httpGet(url) { return isNative ? callAsync("httpGet", [url]) : fetch(url).then(r => r.text()).then(body => ({ ok: true, body })).catch(e => ({ ok: false, error: String(e) })); },
    setManifestUrl(u) { if (isNative) N.setManifestUrl(u); },
    otaCheck(url) { return isNative ? callAsync("otaCheck", [url || ""]) : Promise.resolve({ ok: false, error: "web" }); },
    otaPlan(m) { return isNative ? jparse(N.otaPlan(typeof m === "string" ? m : JSON.stringify(m)), {}) : { ok: false }; },
    otaApply(m) { return isNative ? callAsync("otaApply", [typeof m === "string" ? m : JSON.stringify(m)]) : Promise.resolve({ ok: false }); },
    otaRollback() { return isNative ? jparse(N.otaRollback(), {}) : { ok: false }; },
    reload() { if (isNative) N.reload(); else location.reload(); },
    otaDownloadApk(url, sha) { return isNative ? callAsync("otaDownloadApk", [url, sha || ""]) : Promise.resolve({ ok: false }); },
    canInstall() { return isNative ? N.canInstall() : false; },
    openInstallSettings() { if (isNative) N.openInstallSettings(); },
    installApk(p) { return isNative ? jparse(N.installApk(p), {}) : { ok: false }; }
  };

  window.Bridge = B;

  // progress + SAF plumbing
  window.__otaProgressHandlers = [];
  window.__otaProgress = function (p) { window.__otaProgressHandlers.forEach(f => { try { f(p); } catch (e) {} }); };
  window.__safHandlers = {};
  window.__safResult = function (code, ok, data) {
    const h = window.__safHandlers[code];
    if (h) { delete window.__safHandlers[code]; h(ok, data); }
  };
  B.onSaf = (code, fn) => { window.__safHandlers[code] = fn; };
  B.onProgress = (fn) => { window.__otaProgressHandlers.push(fn); };
  B.offProgress = (fn) => {
    const i = window.__otaProgressHandlers.indexOf(fn);
    if (i >= 0) window.__otaProgressHandlers.splice(i, 1);
  };
})();
