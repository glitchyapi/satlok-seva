/* ============ Native bridge with graceful browser fallback ============ */
(function (g) {
  var NB = null; // native object injected by addJavascriptInterface
  function nativeObj() {
    if (NB) return NB;
    if (window.SatlokNative) NB = window.SatlokNative;
    return NB;
  }
  var listeners = {};
  g.NativeEvent = {
    on: function (type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    fire: function (type, payload) { (listeners[type] || []).forEach(function (f) { try { f(payload); } catch (e) {} }); }
  };
  // called from Java
  g.onNativeEvent = function (type, payloadJson) {
    var p = null; try { p = JSON.parse(payloadJson || "{}"); } catch (e) {}
    NativeEvent.fire(type, p);
  };

  var has = function () { return !!nativeObj(); };

  /* ---------- browser fallback storage (preview only) ---------- */
  var mem = {};
  var lsGet = function (k) { try { return localStorage.getItem("ssv." + k); } catch (e) { return mem["ssv." + k] || null; } };
  var lsSet = function (k, v) { try { localStorage.setItem("ssv." + k, v); } catch (e) { mem["ssv." + k] = v; } };

  function b64encode(str) { return btoa(unescape(encodeURIComponent(str))); }
  function b64decode(b64) { return decodeURIComponent(escape(atob(b64))); }

  var Bridge = {
    isNative: has,
    info: function () {
      if (has()) { try { return JSON.parse(nativeObj().getAppInfo()); } catch (e) {} }
      return { versionName: "1.0.0-web", versionCode: 1, packageName: "web.preview", android: "browser", native: false };
    },
    /* encrypted+compressed store */
    storeSave: function (key, plainText) {
      if (has()) return nativeObj().storeSave(key, b64encode(plainText));
      lsSet("store." + key, b64encode(plainText)); return true;
    },
    storeLoad: function (key) {
      if (has()) { var r = nativeObj().storeLoad(key); return r ? b64decode(r) : null; }
      var v = lsGet("store." + key); return v ? b64decode(v) : null;
    },
    storeDelete: function (key) {
      if (has()) return nativeObj().storeDelete(key);
      try { localStorage.removeItem("ssv.store." + key); } catch (e) { delete mem["ssv.store." + key]; }
      return true;
    },
    prefsGet: function (key, dflt) {
      if (has()) { var r = nativeObj().prefsGet(key); return r === null || r === "" ? dflt : r; }
      var v = lsGet("pref." + key); return v === null ? dflt : v;
    },
    prefsSet: function (key, val) {
      if (has()) return nativeObj().prefsSet(key, String(val));
      lsSet("pref." + key, String(val)); return true;
    },
    /* notifications */
    notifPermission: function () {
      if (has()) return nativeObj().notificationPermission(); // "granted"|"denied"|"unsupported"
      return ("Notification" in window && Notification.permission === "granted") ? "granted" : "denied";
    },
    requestNotif: function (cb) {
      if (has()) { nativeObj().requestNotificationPermission(); if (cb) cb(); return; }
      if ("Notification" in window) Notification.requestPermission().then(function () { cb && cb(); });
      else cb && cb();
    },
    postNotification: function (title, body, channel) {
      if (has()) return nativeObj().postNotification(title, body, channel || "events");
      if ("Notification" in window && Notification.permission === "granted") { try { new Notification(title, { body: body }); } catch (e) {} }
    },
    scheduleReminder: function (id, title, body, hour, minute, daily) {
      if (has()) return nativeObj().scheduleReminder(id, title, body, hour, minute, daily !== false);
      return true;
    },
    cancelReminder: function (id) { if (has()) return nativeObj().cancelReminder(id); return true; },

    /* sharing */
    shareText: function (text) { if (has()) return nativeObj().shareText(text); return false; },
    shareImage: function (b64png, name) { if (has()) return nativeObj().shareImage(b64png, name || "bhandara-banner.png"); return false; },

    /* updater */
    fetchUrl: function (url, cb) {
      // native fetch avoids CORS issues for arbitrary mirrors
      if (has() && nativeObj().httpGet) {
        var id = "req" + Math.random().toString(36).slice(2);
        NativeEvent.on("http." + id, function (p) { cb(p); });
        nativeObj().httpGet(id, url);
        return;
      }
      var x = new XMLHttpRequest();
      x.open("GET", url, true); x.responseType = "arraybuffer";
      x.onload = function () {
        var u8 = new Uint8Array(x.response);
        cb({ ok: x.status >= 200 && x.status < 400, status: x.status, b64: u8ToB64(u8) });
      };
      x.onerror = function () { cb({ ok: false, status: 0 }); };
      x.send();
    },
    downloadToFile: function (url, stagingName, cb) {
      if (has()) {
        NativeEvent.on("dl." + stagingName, function (p) { cb(p); });
        nativeObj().downloadToFile(url, stagingName);
        return;
      }
      Bridge.fetchUrl(url, function (r) { cb({ type: "done", ok: r.ok, staging: stagingName }); });
    },
    stagingSha256: function (name, cb) {
      if (has()) { cb(nativeObj().stagingSha256(name)); return; }
      Bridge.readStaging(name, function (b64) { cb(SHA256.hexBytes(b64ToU8(b64))); });
    },
    readStaging: function (name, cb) {
      if (has()) { cb(nativeObj().readStagingB64(name)); return; }
      cb(lsGet("staging." + name) || "");
    },
    applyStaged: function (name, relPath) {
      if (has()) return nativeObj().applyStagedFile(name, relPath);
      lsSet("webfile." + relPath, lsGet("staging." + name) || ""); return true;
    },
    webFileSha: function (relPath, cb) {
      if (has()) { cb(nativeObj().webFileSha256(relPath)); return; }
      var v = lsGet("webfile." + relPath);
      cb(v ? SHA256.hexBytes(b64ToU8(v)) : "");
    },
    currentWebManifest: function () {
      if (has()) { var r = nativeObj().readWebFile("version.json"); return r ? JSON.parse(b64decode(r)) : null; }
      var v = lsGet("webfile.version.json"); return v ? JSON.parse(b64decode(v)) : null;
    },
    writeWebManifest: function (obj) {
      if (has()) return nativeObj().writeWebFile("version.json", b64encode(JSON.stringify(obj)));
      lsSet("webfile.version.json", b64encode(JSON.stringify(obj))); return true;
    },
    rollbackWeb: function () { if (has()) return nativeObj().rollbackWeb(); return false; },
    deleteWebFile: function (p) { if (has()) return nativeObj().deleteWebFile(p); try { localStorage.removeItem("ssv.webfile." + p); } catch (e) {} return true; },
    reloadWeb: function () { if (has()) nativeObj().reloadWeb(); else location.reload(); },
    installApk: function (stagingName) { if (has()) return nativeObj().installApk(stagingName); return false; },
    /* backup */
    exportBackup: function (b64data, cb) { if (has()) { NativeEvent.on("backup.saved", function (p) { cb(p); }); nativeObj().exportBackup(b64data); } else cb({ ok: false }); },
    importBackup: function (cb) { if (has()) { NativeEvent.on("backup.picked", function (p) { cb(p); }); nativeObj().importBackup(); } else cb({ ok: false }); },
    /* misc */
    vibrate: function (ms) { if (has()) nativeObj().vibrate(ms || 30); else if (navigator.vibrate) navigator.vibrate(ms || 30); },
    setStatusBar: function (dark) { if (has()) nativeObj().setStatusBar(dark); },
    exitApp: function () { if (has()) nativeObj().exitApp(); }
  };

  function u8ToB64(u8) {
    var s = "", CH = 0x8000;
    for (var i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
    return btoa(s);
  }
  function b64ToU8(b64) {
    var s = atob(b64), u = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
    return u;
  }
  Bridge.u8ToB64 = u8ToB64; Bridge.b64ToU8 = b64ToU8;
  g.Bridge = Bridge;
})(window);
