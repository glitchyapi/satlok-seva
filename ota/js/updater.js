/* ============================================================================
   Updater — reads a universal signed JSON manifest from any static host
   (GitHub Pages by default; raw.githack / jsDelivr / OnlyFiles-style direct
   links work as mirrors), diffs SHA-256 per file, and applies only the delta.
   ========================================================================== */
window.Updater = (function () {

  const DEFAULT_URL = "https://glitchyapi.github.io/satlok-seva/ota/manifest.json";
  const HIST_KEY = "ss_upd_hist";

  let state = {
    checking: false, lastCheck: 0, manifest: null, payload: null,
    plan: null, available: false, apkAvailable: false, error: null, verified: false
  };
  let listeners = [];

  function url() {
    try { return localStorage.getItem("ss_manifest_url") || DEFAULT_URL; } catch (e) { return DEFAULT_URL; }
  }
  function setUrl(u) {
    try { localStorage.setItem("ss_manifest_url", u); } catch (e) {}
    Bridge.setManifestUrl(u);
  }
  function history() {
    try { return JSON.parse(localStorage.getItem(HIST_KEY) || "[]"); } catch (e) { return []; }
  }
  function pushHistory(h) {
    const list = history();
    list.unshift(Object.assign({ at: Date.now() }, h));
    try { localStorage.setItem(HIST_KEY, JSON.stringify(list.slice(0, 25))); } catch (e) {}
  }
  function emit() { listeners.forEach(f => { try { f(state); } catch (e) {} }); }

  function fmtBytes(n) {
    if (!n) return "0 KB";
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(n < 10240 ? 1 : 0) + " KB";
    return (n / 1048576).toFixed(2) + " MB";
  }

  async function check(opts) {
    opts = opts || {};
    if (state.checking) return state;
    state.checking = true; state.error = null; emit();

    if (!Bridge.online()) {
      state.checking = false; state.error = "offline"; emit();
      return state;
    }
    const r = await Bridge.otaCheck(url());
    state.checking = false;
    state.lastCheck = Date.now();
    try { localStorage.setItem("ss_upd_last", String(state.lastCheck)); } catch (e) {}

    if (!r.ok) { state.error = r.error || "failed"; emit(); return state; }

    let m;
    try { m = JSON.parse(r.manifest); } catch (e) { state.error = "bad-json"; emit(); return state; }
    state.manifest = m;
    state.verified = !!m._verified;
    let p = m.payload;
    if (typeof p === "string") { try { p = JSON.parse(p); } catch (e) { p = null; } }
    if (!p) { state.error = "bad-payload"; emit(); return state; }
    state.payload = p;

    // refuse to install code that is not signed by the pinned release key
    if (!state.verified && p.requireSignature !== false) {
      state.error = "unsigned";
      state.available = false;
      emit();
      return state;
    }

    const info = Bridge.info();
    const planR = Bridge.otaPlan(r.manifest);
    state.plan = planR.ok ? planR.plan : null;

    const web = p.web || {};
    const shell = p.shell || null;
    state.available = !!(state.plan && state.plan.needed && state.plan.needed.length > 0) ||
                      (web.build && web.build > info.webBuild);
    state.apkAvailable = !!(shell && shell.versionCode > info.shellCode);
    state.mandatory = !!web.mandatory || !!(shell && shell.mandatory) ||
                      (web.minShell && web.minShell > info.shellCode);
    emit();

    if ((state.available || state.apkAvailable) && !opts.quiet) notifyAvailable();
    return state;
  }

  function notifyAvailable() {
    const p = state.payload || {};
    const v = (p.web && p.web.version) || (p.shell && p.shell.versionName) || "";
    const seen = localStorage.getItem("ss_upd_notified");
    if (seen === v) return;
    try { localStorage.setItem("ss_upd_notified", v); } catch (e) {}
    Bridge.notify(9001, "app_update", t("up_notify_title"), t("up_notify_body", { v }), "more");
  }

  function notes(lang) {
    const p = state.payload || {};
    const src = (p.web && p.web.notes) || (p.shell && p.shell.notes) || p.notes || {};
    if (typeof src === "string") return [src];
    const val = src[lang] || src.en || src.hi || [];
    return Array.isArray(val) ? val : [String(val)];
  }

  // ---- UI -----------------------------------------------------------------

  function versionSheet() {
    const info = Bridge.info();
    const p = state.payload || {};
    const web = p.web || {};
    const shell = p.shell || {};
    const st = state;
    const last = Number(localStorage.getItem("ss_upd_last") || 0);

    const badge = st.checking ? `<span class="tag info">${t("up_checking")}</span>`
      : st.error ? `<span class="tag bad">${t("up_failed")}</span>`
      : (st.available || st.apkAvailable) ? `<span class="tag accent">${t("up_available")}</span>`
      : `<span class="tag good">${t("up_uptodate")}</span>`;

    let errBlock = "";
    if (st.error) {
      const map = {
        offline: [t("up_offline"), t("up_offline_sub")],
        unsigned: [t("up_unverified"), "The manifest signature did not match the release key pinned in this app. Nothing was installed."],
        "bad-json": ["Bad manifest", "The update file is not valid JSON."],
        "bad-payload": ["Bad manifest", "The update payload is missing."]
      };
      const e = map[st.error] || [t("up_failed"), String(st.error)];
      errBlock = `<div class="card mt14" style="background:var(--bad-soft);border-color:transparent">
        <b class="small" style="color:var(--bad)">${esc(e[0])}</b>
        <div class="xs mt6" style="color:var(--bad);opacity:.85">${esc(e[1])}</div></div>`;
    }

    let availBlock = "";
    if (st.available || st.apkAvailable) {
      const pl = st.plan || { needed: [], bytes: 0, unchanged: 0, total: 0 };
      const fullSize = (web.fullSize || pl.bytes * 4 || 0);
      const saved = fullSize > pl.bytes && fullSize > 0 ? Math.round(100 - pl.bytes * 100 / fullSize) : 0;
      availBlock = `
      <div class="up-hero mt14">
        <div class="k">${t("up_available")}</div>
        <div class="v">${esc(web.version || shell.versionName || "")}</div>
        <p>${esc(t("up_delta_note", { n: pl.needed.length, size: fmtBytes(pl.bytes) }))}</p>
        <div class="prog on-dark mt14"><i id="upProg" style="width:0%"></i></div>
        <div class="between mt10" style="font-size:12px;opacity:.92">
          <span id="upPhase">${saved > 0 ? t("up_bytes_saved", { p: saved }) : fmtBytes(pl.bytes)}</span>
          <span id="upPct">0%</span>
        </div>
      </div>
      <div class="card mt14">
        <b class="small">${t("up_whatsnew")}</b>
        <div class="notes mt10"><ul>${notes(Lang.code).map(n => `<li>${esc(n)}</li>`).join("")}</ul></div>
      </div>
      ${pl.needed.length ? `<div class="card mt14">
        <div class="between mb8"><b class="small">${t("up_files")}</b><span class="tag">${pl.needed.length}/${pl.total}</span></div>
        <div class="filelist">${pl.needed.slice(0, 12).map(f =>
          `<div>${esc(f.path)}<span>${fmtBytes(f.size)}</span></div>`).join("")}
          ${pl.needed.length > 12 ? `<div>…<span>+${pl.needed.length - 12}</span></div>` : ""}</div>
      </div>` : ""}
      ${st.apkAvailable ? `<div class="card mt14" style="background:var(--warn-soft);border-color:transparent">
        <b class="small" style="color:var(--warn)">${t("up_shell")} ${esc(shell.versionName || "")}</b>
        <div class="xs mt6" style="color:var(--warn)">${esc(t("up_apk_note"))}</div></div>` : ""}
      <button class="btn accent block mt18" id="upGo">${t("up_now")}</button>
      ${st.mandatory ? `<div class="xs muted center mt10">${t("up_required_sub")}</div>` : ""}`;
    }

    const body = `
      <div class="between"><h3>${t("up_title")}</h3>${badge}</div>
      <div class="sub">${t("up_channel")}: ${esc(p.channel || "stable")}</div>

      <div class="ver-grid">
        <div class="ver-box"><div class="k">${t("up_bundle")} · ${t("up_current")}</div><div class="v">${esc(info.webVersion)}</div>
          <div class="xs muted">build ${info.webBuild}</div></div>
        <div class="ver-box"><div class="k">${t("up_shell")} · ${t("up_current")}</div><div class="v">${esc(info.shellName)}</div>
          <div class="xs muted">code ${info.shellCode}</div></div>
      </div>

      ${errBlock}
      ${availBlock}

      <div class="card mt14">
        <div class="between"><span class="small">${t("up_signature")}</span>
          <span class="tag ${st.verified ? "good" : "warn"}">${st.verified ? t("up_verified") : t("up_unverified")}</span></div>
        <div class="between mt10"><span class="small">${t("up_lastcheck")}</span>
          <span class="small muted">${last ? new Date(last).toLocaleString() : t("up_never")}</span></div>
      </div>

      <button class="btn ghost block mt14" id="upCheck" ${st.checking ? "disabled" : ""}>${t("up_check")}</button>

      <div class="mt18">
        <button class="between w100" id="upAdvToggle" style="padding:6px 0">
          <span class="small bold">${t("up_advanced")}</span><span class="muted">›</span>
        </button>
        <div id="upAdv" hidden class="mt10">
          <div class="field">
            <label>${t("up_source")}</label>
            <input class="inp" id="upUrl" value="${esc(url())}" spellcheck="false">
            <div class="hint">${t("up_source_sub")}</div>
          </div>
          <button class="btn ghost sm block" id="upSaveUrl">${t("save")}</button>
          ${info.overlay ? `<button class="btn danger sm block mt10" id="upRollback">${t("up_rollback")}</button>` : ""}
          ${history().length ? `<div class="mt18"><b class="small">${t("up_history")}</b>
            <div class="filelist mt10">${history().slice(0, 8).map(h =>
              `<div>${esc(h.version || "?")} · ${esc(h.kind || "")}<span>${new Date(h.at).toLocaleDateString()}</span></div>`).join("")}</div></div>` : ""}
        </div>
      </div>`;

    UI.sheet(body, () => {
      const go = document.getElementById("upGo");
      if (go) go.onclick = () => apply();
      const ck = document.getElementById("upCheck");
      if (ck) ck.onclick = async () => { UI.closeSheet(); await check({ quiet: true }); versionSheet(); };
      const at = document.getElementById("upAdvToggle");
      if (at) at.onclick = () => { const el = document.getElementById("upAdv"); el.hidden = !el.hidden; };
      const su = document.getElementById("upSaveUrl");
      if (su) su.onclick = () => {
        setUrl(document.getElementById("upUrl").value.trim());
        UI.toast(t("updated_ok"), "good"); UI.closeSheet();
      };
      const rb = document.getElementById("upRollback");
      if (rb) rb.onclick = () => {
        Bridge.otaRollback(); UI.toast(t("up_rolledback"));
        setTimeout(() => Bridge.reload(), 700);
      };
    });
  }

  async function apply() {
    const st = state;
    if (!st.manifest) return;

    if (st.apkAvailable) {
      if (!Bridge.canInstall()) {
        UI.modal(`<h3>${t("up_allow_install")}</h3><div class="sub">${t("up_allow_install_sub")}</div>
          <button class="btn accent block" id="gi">${t("p_open")}</button>
          <button class="btn ghost block mt10" id="gc">${t("cancel")}</button>`, () => {
          document.getElementById("gi").onclick = () => { UI.closeModal(); Bridge.openInstallSettings(); };
          document.getElementById("gc").onclick = () => UI.closeModal();
        });
        return;
      }
    }

    const pl = st.plan || { needed: [] };
    UI.sheet(`<h3>${t("up_downloading")}</h3>
      <div class="sub" id="apSub">${esc(t("up_delta_note", { n: pl.needed.length, size: fmtBytes(pl.bytes) }))}</div>
      <div class="prog mt14"><i id="apBar" style="width:0%"></i></div>
      <div class="between mt10"><span class="small muted" id="apFile">—</span><b class="small" id="apPct">0%</b></div>
      <div class="card mt18 center" id="apDone" hidden></div>`, null, true);

    const bar = document.getElementById("apBar");
    const pct = document.getElementById("apPct");
    const file = document.getElementById("apFile");
    const onProg = (p) => {
      if (bar) bar.style.width = (p.pct || 0) + "%";
      if (pct) pct.textContent = (p.pct || 0) + "%";
      if (file) file.textContent = p.phase === "install" ? t("up_installing")
        : p.phase === "apk" ? t("up_shell") : (p.file || "");
    };
    Bridge.onProgress(onProg);

    let ok = true, err = "";
    if (pl.needed.length > 0) {
      const r = await Bridge.otaApply(st.manifest);
      ok = r.ok; err = r.error;
    }

    if (ok && st.apkAvailable) {
      const shell = st.payload.shell;
      const r = await Bridge.otaDownloadApk(shell.apkUrl, shell.sha256);
      if (r.ok) {
        Bridge.offProgress(onProg);
        pushHistory({ version: shell.versionName, kind: "apk" });
        document.getElementById("apDone").hidden = false;
        document.getElementById("apDone").innerHTML =
          `<b>${t("up_done")}</b><div class="xs muted mt6">${fmtBytes(r.size)}</div>
           <button class="btn accent block mt14" id="apInstall">${t("up_restart")}</button>`;
        document.getElementById("apInstall").onclick = () => Bridge.installApk(r.path);
        return;
      }
      ok = false; err = r.error;
    }

    Bridge.offProgress(onProg);

    if (!ok) {
      document.getElementById("apDone").hidden = false;
      document.getElementById("apDone").innerHTML =
        `<b style="color:var(--bad)">${t("up_failed")}</b>
         <div class="xs muted mt6">${esc(err || "")}</div>
         <button class="btn ghost block mt14" id="apRetry">${t("retry")}</button>`;
      document.getElementById("apRetry").onclick = () => apply();
      return;
    }

    pushHistory({ version: st.payload.web.version, kind: "delta", files: pl.needed.length, bytes: pl.bytes });
    if (bar) bar.style.width = "100%";
    if (pct) pct.textContent = "100%";
    document.getElementById("apDone").hidden = false;
    document.getElementById("apDone").innerHTML =
      `<div class="empty" style="padding:8px 0">
        <div class="ic" style="background:var(--good-soft);color:var(--good)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M20 6L9 17l-5-5"/></svg>
        </div>
        <h4>${t("up_done")}</h4><p>${esc(st.payload.web.version)}</p>
        <button class="btn accent block mt18" id="apReload">${t("up_restart")}</button></div>`;
    document.getElementById("apReload").onclick = () => Bridge.reload();
    Bridge.notify(9002, "app_update", t("up_done"), st.payload.web.version, "more");
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // ---- broadcast announcements -------------------------------------------
  function maybeAnnounce() {
    const p = state.payload || {};
    const a = p.announcement;
    if (!a || !a.id) return false;
    let seen = [];
    try { seen = JSON.parse(localStorage.getItem("ss_ann_seen") || "[]"); } catch (e) {}
    if (seen.indexOf(a.id) >= 0) return false;
    seen.push(a.id);
    try { localStorage.setItem("ss_ann_seen", JSON.stringify(seen.slice(-40))); } catch (e) {}

    if (a.notify) Bridge.notify(9100 + (Math.abs(hashCode(a.id)) % 800), "bhandara",
      a.title, a.body || "", "bhandara");

    const tone = a.level === "urgent" ? "var(--bad)" : a.level === "event" ? "var(--accent)" : "var(--info)";
    const soft = a.level === "urgent" ? "var(--bad-soft)" : a.level === "event" ? "var(--accent-soft)" : "var(--info-soft)";
    UI.modal(`<div class="center">
        <div class="empty" style="padding:4px 0 0">
          <div class="ic" style="background:${soft};color:${tone}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 11v3l14 5V6z"/><path d="M17 9a3 3 0 0 1 0 6"/></svg>
          </div>
          <h4 style="font-size:18px">${esc(a.title)}</h4>
          <p style="margin-top:8px;white-space:pre-wrap">${esc(a.body || "")}</p>
        </div></div>
      ${a.url ? `<button class="btn accent block mt18" id="annOpen">${esc(t("next"))}</button>` : ""}
      <button class="btn ghost block mt10" id="annClose">${esc(t("close"))}</button>`, () => {
      const o = document.getElementById("annOpen");
      if (o) o.onclick = () => { UI.closeModal(); Bridge.openUrl(a.url); };
      document.getElementById("annClose").onclick = () => UI.closeModal();
    });
    return true;
  }
  function hashCode(s) { let h = 0; for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return h; }

  /** Called once at boot: silent check a few seconds after first paint. */
  function boot() {
    Bridge.setManifestUrl(url());
    try { state.lastCheck = Number(localStorage.getItem("ss_upd_last") || 0); } catch (e) {}
    setTimeout(async () => {
      if (!Bridge.online()) return;
      await check({ quiet: false });
      if (maybeAnnounce()) return;
      if ((state.available || state.apkAvailable) && state.mandatory) versionSheet();
    }, 4200);
  }

  return {
    DEFAULT_URL, check, apply, versionSheet, boot, url, setUrl, history, fmtBytes, notes, maybeAnnounce,
    get state() { return state; },
    onChange(f) { listeners.push(f); }
  };
})();
