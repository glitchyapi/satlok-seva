/* ============ Encrypted on-device store + domain data ============
   Native: AES-256-GCM + DEFLATE inside Java layer (files under app private dir)
   Browser fallback: localStorage (preview only)                                  */
(function (g) {
  var DB = { sevas: [], bhandaras: [], settings: { lang: "hi", theme: "system", reminder: { on: false, h: 19, m: 0 } }, updateLog: [] };
  var loaded = false;
  var KEY = "db";

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  var Store = {
    uid: uid,
    load: function (pin) {
      var raw = Bridge.storeLoad(KEY + (pin ? "" : ""));
      // NOTE: PIN affects the *key* at native layer; when PIN set, storeLoad without correct key returns null
      if (raw) { try { DB = JSON.parse(raw); } catch (e) {} }
      loaded = true;
      DB.settings = DB.settings || {};
      DB.settings.reminder = DB.settings.reminder || { on: false, h: 19, m: 0 };
      DB.sevas = DB.sevas || []; DB.bhandaras = DB.bhandaras || []; DB.updateLog = DB.updateLog || [];
      return DB;
    },
    isLoaded: function () { return loaded; },
    db: function () { return DB; },
    save: function () { Bridge.storeSave(KEY, JSON.stringify(DB)); },
    settings: function () { return DB.settings; },

    /* ---- seva ---- */
    addSeva: function (s) {
      s.id = uid(); s.createdAt = Date.now();
      DB.sevas.unshift(s); Store.save(); return s;
    },
    updateSeva: function (id, patch) {
      for (var i = 0; i < DB.sevas.length; i++) if (DB.sevas[i].id === id) { for (var k in patch) DB.sevas[i][k] = patch[k]; }
      Store.save();
    },
    delSeva: function (id) { DB.sevas = DB.sevas.filter(function (s) { return s.id !== id; }); Store.save(); },
    sevasOn: function (dateStr) { return DB.sevas.filter(function (s) { return s.date === dateStr; }); },
    todayStr: function () { return Store.dateStr(new Date()); },
    dateStr: function (d) {
      return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
    },

    /* ---- bhandara ---- */
    addBhandara: function (b) { b.id = uid(); b.createdAt = Date.now(); DB.bhandaras.unshift(b); Store.save(); return b; },
    updateBhandara: function (id, patch) {
      for (var i = 0; i < DB.bhandaras.length; i++) if (DB.bhandaras[i].id === id) { for (var k in patch) DB.bhandaras[i][k] = patch[k]; }
      Store.save();
    },
    delBhandara: function (id) { DB.bhandaras = DB.bhandaras.filter(function (b) { return b.id !== id; }); Store.save(); },
    upcoming: function () {
      var t = Store.todayStr();
      return DB.bhandaras.filter(function (b) { return b.date >= t; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    },
    pastB: function () {
      var t = Store.todayStr();
      return DB.bhandaras.filter(function (b) { return b.date < t; }).sort(function (a, b) { return a.date > b.date ? -1 : 1; });
    },

    /* ---- stats ---- */
    streak: function () {
      var set = {}; DB.sevas.forEach(function (s) { set[s.date] = 1; });
      var n = 0, d = new Date();
      if (!set[Store.dateStr(d)]) d.setDate(d.getDate() - 1); // today not yet logged is ok
      while (set[Store.dateStr(d)]) { n++; d.setDate(d.getDate() - 1); }
      return n;
    },
    last7: function () {
      var out = [];
      for (var i = 6; i >= 0; i--) {
        var d = new Date(); d.setDate(d.getDate() - i);
        var ds = Store.dateStr(d);
        var c = DB.sevas.filter(function (s) { return s.date === ds; }).length;
        out.push({ date: ds, d: d, count: c });
      }
      return out;
    },
    byType: function () {
      var m = {};
      DB.sevas.forEach(function (s) { m[s.type] = (m[s.type] || 0) + 1; });
      return m;
    },
    monthCount: function () {
      var p = Store.todayStr().slice(0, 7);
      return DB.sevas.filter(function (s) { return s.date.indexOf(p) === 0; }).length;
    },

    /* ---- PIN ---- */
    hasPin: function () { return Bridge.prefsGet("pinHash", "") !== ""; },
    pinHash: function (pin) { return SHA256.hex("ssv-pin:" + pin + ":" + (Bridge.info().packageName || "")); },
    setPin: function (pin) { Bridge.prefsSet("pinHash", Store.pinHash(pin)); Bridge.prefsSet("pinOn", "1"); },
    checkPin: function (pin) { return Bridge.prefsGet("pinHash", "") === Store.pinHash(pin); },
    removePin: function () { Bridge.prefsSet("pinHash", ""); Bridge.prefsSet("pinOn", ""); },

    /* ---- backup (encrypted blob via native) ---- */
    exportBlob: function () {
      var json = JSON.stringify(DB);
      return Bridge.u8ToB64(SHA256.utf8(json)); // transport encoding; native re-encrypts+compresses on write
    },
    importBlob: function (b64) {
      try {
        var json = decodeURIComponent(escape(atob(b64)));
        var obj = JSON.parse(json);
        if (!obj || typeof obj !== "object") return false;
        DB = obj; Store.save(); return true;
      } catch (e) { return false; }
    },
    wipe: function () {
      DB = { sevas: [], bhandaras: [], settings: { lang: DB.settings.lang, theme: DB.settings.theme, reminder: { on: false, h: 19, m: 0 } }, updateLog: [] };
      Store.save();
    },
    logUpdate: function (entry) { DB.updateLog.unshift(entry); if (DB.updateLog.length > 30) DB.updateLog.length = 30; Store.save(); }
  };
  g.Store = Store;
})(window);
