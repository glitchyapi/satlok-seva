/* ============================================================================
   Store — the single source of truth.
   Everything is persisted through the native AES-256-GCM + DEFLATE vault.
   A debounced writer keeps typing/counting instant while still hitting disk.
   ========================================================================== */
window.Store = (function () {
  const KEY = "seva_db";
  const META = "seva_meta";

  const TYPES = [
    { id: "jaap",     icon: "beads",  unit: "count",   colour: "#E8730C" },
    { id: "satsang",  icon: "book",   unit: "hours",   colour: "#2F6BD8" },
    { id: "bhandara", icon: "pot",    unit: "hours",   colour: "#128A5A" },
    { id: "langar",   icon: "bowl",   unit: "hours",   colour: "#B8730A" },
    { id: "prachar",  icon: "mega",   unit: "hours",   colour: "#8B44C8" },
    { id: "cleaning", icon: "broom",  unit: "hours",   colour: "#0E8E8E" },
    { id: "daan",     icon: "heart",  unit: "count",   colour: "#C6362F" },
    { id: "path",     icon: "scroll", unit: "times",   colour: "#5A6472" },
    { id: "kirtan",   icon: "music",  unit: "minutes", colour: "#D6417E" },
    { id: "other",    icon: "star",   unit: "hours",   colour: "#7A6A55" }
  ];

  const MANTRAS = [
    { id: "sat_sahib", label: "ॐ सत साहिब जी", perMala: 108 },
    { id: "satnam",    label: "सतनाम",          perMala: 108 },
    { id: "sar",       label: "सारशब्द",        perMala: 108 },
    { id: "custom",    label: "अन्य",           perMala: 108 }
  ];

  let db = null;
  let stats = { raw: 0, packed: 0, ratio: 0 };
  let timer = null;
  let listeners = [];

  function blank() {
    return {
      v: 3,
      profile: { name: "", place: "", goal: 108, joined: today(), onboarded: false },
      settings: { theme: "auto", jaapVibrate: true, jaapSound: false, perMala: 108, mantra: "sat_sahib", lockPin: null },
      entries: [],
      events: [],
      banners: [],
      reminders: [
        { id: 1, hour: 6,  minute: 0, titleKey: "rem_morning", enabled: false },
        { id: 2, hour: 20, minute: 0, titleKey: "rem_evening", enabled: false }
      ],
      jaap: { count: 0, day: today(), totalToday: 0 },
      meta: { created: Date.now(), updated: Date.now() }
    };
  }

  function today(d) {
    const x = d ? new Date(d) : new Date();
    return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0");
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  function load() {
    const got = Bridge.vaultRead(KEY);
    if (got && typeof got === "object" && got.v) {
      db = Object.assign(blank(), got);
      db.profile = Object.assign(blank().profile, got.profile || {});
      db.settings = Object.assign(blank().settings, got.settings || {});
      db.jaap = Object.assign(blank().jaap, got.jaap || {});
    } else {
      db = blank();
    }
    const m = Bridge.vaultRead(META);
    if (m && m.raw) stats = m;
    rolloverJaap();
    return db;
  }

  function rolloverJaap() {
    if (db.jaap.day !== today()) {
      db.jaap.day = today();
      db.jaap.count = 0;
      db.jaap.totalToday = 0;
    }
  }

  function flush() {
    timer = null;
    db.meta.updated = Date.now();
    const r = Bridge.vaultWrite(KEY, db);
    if (r && r.ok) {
      stats = { raw: r.raw, packed: r.packed, ratio: r.ratio, entries: db.entries.length, at: Date.now() };
      Bridge.vaultWrite(META, stats);
    }
    listeners.forEach(f => { try { f(db); } catch (e) {} });
  }

  function save(immediate) {
    if (timer) clearTimeout(timer);
    if (immediate) flush(); else timer = setTimeout(flush, 260);
  }

  // ---- entries ------------------------------------------------------------

  function addEntry(e) {
    const t = TYPES.find(x => x.id === e.type) || TYPES[9];
    const entry = {
      id: uid(), type: t.id, qty: Number(e.qty) || 0, unit: e.unit || t.unit,
      date: e.date || today(), time: e.time || new Date().toTimeString().slice(0, 5),
      place: (e.place || "").trim(), notes: (e.notes || "").trim(),
      eventId: e.eventId || null, at: Date.now()
    };
    db.entries.push(entry);
    save(true);
    return entry;
  }
  function updateEntry(id, patch) {
    const e = db.entries.find(x => x.id === id);
    if (!e) return null;
    Object.assign(e, patch, { qty: Number(patch.qty !== undefined ? patch.qty : e.qty) });
    save(true);
    return e;
  }
  function removeEntry(id) {
    const i = db.entries.findIndex(x => x.id === id);
    if (i >= 0) { db.entries.splice(i, 1); save(true); return true; }
    return false;
  }
  function entries(filter) {
    let list = db.entries.slice().sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
    if (!filter) return list;
    if (filter.type && filter.type !== "all") list = list.filter(e => e.type === filter.type);
    if (filter.range && filter.range !== "all") {
      const from = rangeStart(filter.range);
      list = list.filter(e => e.date >= from);
    }
    if (filter.q) {
      const q = filter.q.toLowerCase();
      list = list.filter(e =>
        (e.notes || "").toLowerCase().includes(q) ||
        (e.place || "").toLowerCase().includes(q) ||
        t("type_" + e.type).toLowerCase().includes(q));
    }
    return list;
  }
  function rangeStart(range) {
    const d = new Date();
    if (range === "today") return today();
    if (range === "week") d.setDate(d.getDate() - 6);
    if (range === "month") d.setDate(d.getDate() - 29);
    return today(d);
  }

  // ---- aggregates ---------------------------------------------------------

  function totals(list) {
    const src = list || db.entries;
    let jaap = 0, hours = 0, minutes = 0;
    const byType = {};
    src.forEach(e => {
      byType[e.type] = (byType[e.type] || 0) + e.qty;
      if (e.type === "jaap") jaap += e.qty;
      if (e.unit === "hours") hours += e.qty;
      else if (e.unit === "minutes") minutes += e.qty;
    });
    hours += minutes / 60;
    const days = new Set(src.map(e => e.date)).size;
    return { count: src.length, jaap, hours: Math.round(hours * 10) / 10, days, byType,
             malas: Math.floor(jaap / (db.settings.perMala || 108)) };
  }

  function streak() {
    const days = new Set(db.entries.map(e => e.date));
    let cur = 0, best = 0, run = 0;
    const all = Array.from(days).sort();
    let prev = null;
    all.forEach(d => {
      if (prev && (new Date(d) - new Date(prev)) === 86400000) run++; else run = 1;
      best = Math.max(best, run); prev = d;
    });
    let d = new Date();
    if (!days.has(today(d))) d.setDate(d.getDate() - 1);
    while (days.has(today(d))) { cur++; d.setDate(d.getDate() - 1); }
    return { cur, best, activeDays: days.size };
  }

  function heatmap(n) {
    const byDay = {};
    db.entries.forEach(e => { byDay[e.date] = (byDay[e.date] || 0) + 1; });
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const k = today(d);
      out.push({ date: k, n: byDay[k] || 0 });
    }
    return out;
  }

  function week() {
    const out = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const k = today(d);
      const list = db.entries.filter(e => e.date === k);
      out.push({ date: k, dow: d.getDay(), n: list.length,
                 score: list.reduce((s, e) => s + (e.type === "jaap" ? e.qty / 108 : e.qty), 0) });
    }
    return out;
  }

  // ---- jaap counter -------------------------------------------------------

  function jaapTap(n) {
    rolloverJaap();
    db.jaap.count = Math.max(0, db.jaap.count + (n || 1));
    db.jaap.totalToday = Math.max(0, (db.jaap.totalToday || 0) + (n || 1));
    save();
    return db.jaap.count;
  }
  function jaapCommit() {
    rolloverJaap();
    const n = db.jaap.count;
    if (n <= 0) return null;
    const e = addEntry({ type: "jaap", qty: n, unit: "count", notes: t("type_jaap") });
    db.jaap.count = 0;
    save(true);
    return e;
  }
  function jaapReset() { db.jaap.count = 0; save(true); }

  // ---- events / banners ---------------------------------------------------

  function addEvent(ev) {
    const e = Object.assign({ id: uid(), remind: true, at: Date.now() }, ev);
    db.events.push(e); save(true); return e;
  }
  function updateEvent(id, patch) {
    const e = db.events.find(x => x.id === id);
    if (e) { Object.assign(e, patch); save(true); }
    return e;
  }
  function removeEvent(id) {
    const i = db.events.findIndex(x => x.id === id);
    if (i >= 0) { db.events.splice(i, 1); save(true); }
  }
  function upcomingEvents() {
    return db.events.slice().sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));
  }
  function addBanner(b) {
    const x = Object.assign({ id: uid(), at: Date.now() }, b);
    db.banners.unshift(x);
    if (db.banners.length > 40) db.banners.length = 40;
    save(true); return x;
  }
  function removeBanner(id) {
    const i = db.banners.findIndex(x => x.id === id);
    if (i >= 0) { db.banners.splice(i, 1); save(true); }
  }

  // ---- PIN lock (second, user-owned layer over the keystore vault) --------

  async function hashPin(pin, salt) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt: enc.encode(salt), iterations: 150000, hash: "SHA-256" }, key, 256);
    return Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, "0")).join("");
  }
  async function setPin(pin) {
    const salt = uid() + uid();
    db.settings.lockPin = { salt, hash: await hashPin(pin, salt) };
    save(true);
  }
  async function checkPin(pin) {
    const p = db.settings.lockPin;
    if (!p) return true;
    return (await hashPin(pin, p.salt)) === p.hash;
  }
  function removePin() { db.settings.lockPin = null; save(true); }
  function hasPin() { return !!db.settings.lockPin; }

  // ---- portable encrypted backup (PIN-owned key, not device-bound) --------

  async function backupBlob(pin) {
    const enc = new TextEncoder();
    const json = JSON.stringify(db);
    // compress in JS when available, else ship raw (native vault still deflates)
    let body = enc.encode(json), compressed = 0;
    if (window.CompressionStream) {
      try {
        const cs = new CompressionStream("deflate-raw");
        const stream = new Blob([body]).stream().pipeThrough(cs);
        body = new Uint8Array(await new Response(stream).arrayBuffer());
        compressed = 1;
      } catch (e) { body = enc.encode(json); compressed = 0; }
    }
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const km = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveKey"]);
    const key = await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: 210000, hash: "SHA-256" },
      km, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, tagLength: 128 }, key, body));

    const head = enc.encode("SSVB1");
    const out = new Uint8Array(5 + 1 + 16 + 12 + ct.length);
    out.set(head, 0); out[5] = compressed; out.set(salt, 6); out.set(iv, 22); out.set(ct, 34);
    let bin = ""; for (let i = 0; i < out.length; i++) bin += String.fromCharCode(out[i]);
    return { b64: btoa(bin), size: out.length, raw: json.length };
  }

  async function restoreBlob(b64, pin, mode) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const magic = new TextDecoder().decode(bytes.slice(0, 5));
    if (magic !== "SSVB1") throw new Error("bad-format");
    const compressed = bytes[5];
    const salt = bytes.slice(6, 22), iv = bytes.slice(22, 34), ct = bytes.slice(34);
    const km = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveKey"]);
    const key = await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: 210000, hash: "SHA-256" },
      km, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    let body = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv, tagLength: 128 }, key, ct));
    if (compressed && window.DecompressionStream) {
      const ds = new DecompressionStream("deflate-raw");
      body = new Uint8Array(await new Response(new Blob([body]).stream().pipeThrough(ds)).arrayBuffer());
    }
    const data = JSON.parse(new TextDecoder().decode(body));
    if (!data || !data.v) throw new Error("bad-data");
    if (mode === "merge") {
      const seen = new Set(db.entries.map(e => e.id));
      (data.entries || []).forEach(e => { if (!seen.has(e.id)) db.entries.push(e); });
      const evSeen = new Set(db.events.map(e => e.id));
      (data.events || []).forEach(e => { if (!evSeen.has(e.id)) db.events.push(e); });
    } else {
      const keepPin = db.settings.lockPin;
      db = Object.assign(blank(), data);
      db.settings.lockPin = keepPin;
    }
    save(true);
    return db;
  }

  return {
    TYPES, MANTRAS, today, uid,
    load, save, get db() { return db; }, get stats() { return stats; },
    onChange(f) { listeners.push(f); },
    addEntry, updateEntry, removeEntry, entries, totals, streak, heatmap, week,
    jaapTap, jaapCommit, jaapReset,
    addEvent, updateEvent, removeEvent, upcomingEvents, addBanner, removeBanner,
    setPin, checkPin, removePin, hasPin, backupBlob, restoreBlob,
    profile(p) { Object.assign(db.profile, p); save(true); },
    setting(k, v) { db.settings[k] = v; save(true); },
    reminders(list) { db.reminders = list; save(true); },
    wipe() { db = blank(); save(true); }
  };
})();
