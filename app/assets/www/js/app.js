/* ============================================================================
   Satlok Seva — application
   ========================================================================== */
(function () {
"use strict";

const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------- icons -------------------------------------------------------- */
const P = (d, extra) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${extra || ""}>${d}</svg>`;
const ICON = {
  beads:  P('<circle cx="12" cy="12" r="8.5" stroke-dasharray="2.6 3.4"/><circle cx="12" cy="12" r="3"/>'),
  book:   P('<path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2z"/><path d="M8 7h7M8 11h7"/>'),
  pot:    P('<path d="M3 10h18l-1.5 9a2 2 0 0 1-2 1.7H6.5a2 2 0 0 1-2-1.7z"/><path d="M7 10V6a5 5 0 0 1 10 0v4"/>'),
  bowl:   P('<path d="M3 11h18a9 9 0 0 1-18 0z"/><path d="M12 3v4M8 5v2M16 5v2"/>'),
  mega:   P('<path d="M3 11v3l14 5V6z"/><path d="M17 9a3 3 0 0 1 0 6"/><path d="M6 14v4a2 2 0 0 0 4 0v-3"/>'),
  broom:  P('<path d="M14 3l7 7"/><path d="M13 8l-8 8-2 5 5-2 8-8z"/><path d="M6 16l2 2"/>'),
  heart:  P('<path d="M20.8 6.6a5 5 0 0 0-7.1 0L12 8.3l-1.7-1.7a5 5 0 1 0-7.1 7.1L12 22l8.8-8.3a5 5 0 0 0 0-7.1z"/>'),
  scroll: P('<path d="M6 3h12v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z"/><path d="M9 7h6M9 11h6M9 15h3"/>'),
  music:  P('<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>'),
  star:   P('<path d="M12 3l2.6 5.6 6.1.8-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.4l6.1-.8z"/>'),
  flame:  P('<path d="M12 22c4 0 7-2.7 7-6.5 0-4.5-4-6-4-10.5-3 1.5-4 4-4 6-1 0-2-1-2-2.5C7 10 5 12 5 15.5 5 19.3 8 22 12 22z"/>'),
  clock:  P('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  cal:    P('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>'),
  pin:    P('<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="2.6"/>'),
  chart:  P('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  check:  P('<path d="M20 6L9 17l-5-5"/>', ''),
  plus:   P('<path d="M12 5v14M5 12h14"/>'),
  chev:   P('<path d="M9 6l6 6-6 6"/>'),
  share:  P('<path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v14"/>'),
  down:   P('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/>'),
  trash:  P('<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>'),
  edit:   P('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
  bell:   P('<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>'),
  lock:   P('<rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'),
  image:  P('<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.6"/><path d="M21 15l-5-5L5 21"/>'),
  users:  P('<path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/>'),
  phone:  P('<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2 4.2 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.2-1.1a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7A2 2 0 0 1 22 16.9z"/>'),
  info:   P('<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>'),
  globe:  P('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18"/>'),
  moon:   P('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
  refresh:P('<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/>'),
  shield: P('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'),
  spark:  P('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/>')
};
const icon = (n) => ICON[n] || ICON.star;

const QUOTES = {
  hi: [
    "भक्ति का मार्ग त्याग और सेवा से प्रशस्त होता है।",
    "सतभक्ति करने से मनुष्य का जीवन सफल हो जाता है।",
    "नाम जप में जो नियमित रहता है, उसे परमात्मा अवश्य मिलता है।",
    "गुरु के वचन ही जीवन का सच्चा प्रकाश हैं।",
    "सेवा वही सच्ची है जो निष्काम भाव से की जाए।",
    "सत्संग से मन निर्मल होता है और बुद्धि जागृत।",
    "अहंकार त्यागो, प्रेम बाँटो — यही संतों की शिक्षा है।"
  ],
  en: [
    "The path of devotion is paved with surrender and service.",
    "True devotion makes a human life fruitful.",
    "One who is steady in naam jaap surely meets the Divine.",
    "The words of the Guru are the true light of life.",
    "That service alone is true which is offered without desire.",
    "Satsang cleanses the mind and awakens the intellect.",
    "Drop the ego, share love — this is the teaching of the saints."
  ],
  pa: [
    "ਭਗਤੀ ਦਾ ਰਾਹ ਤਿਆਗ ਤੇ ਸੇਵਾ ਨਾਲ ਸੁਖਾਲਾ ਹੁੰਦਾ ਹੈ।",
    "ਸੱਚੀ ਭਗਤੀ ਨਾਲ ਮਨੁੱਖਾ ਜੀਵਨ ਸਫਲ ਹੋ ਜਾਂਦਾ ਹੈ।",
    "ਜੋ ਨਾਮ ਜਾਪ ਵਿੱਚ ਪੱਕਾ ਰਹਿੰਦਾ ਹੈ, ਉਸਨੂੰ ਪਰਮਾਤਮਾ ਮਿਲਦਾ ਹੈ।",
    "ਗੁਰੂ ਦੇ ਬਚਨ ਹੀ ਜੀਵਨ ਦਾ ਸੱਚਾ ਚਾਨਣ ਹਨ।",
    "ਸੇਵਾ ਉਹੀ ਸੱਚੀ ਹੈ ਜੋ ਨਿਸ਼ਕਾਮ ਭਾਵ ਨਾਲ ਕੀਤੀ ਜਾਵੇ।",
    "ਸਤਿਸੰਗ ਨਾਲ ਮਨ ਨਿਰਮਲ ਤੇ ਬੁੱਧੀ ਜਾਗ੍ਰਿਤ ਹੁੰਦੀ ਹੈ।",
    "ਹਉਮੈ ਛੱਡੋ, ਪਿਆਰ ਵੰਡੋ — ਇਹੀ ਸੰਤਾਂ ਦੀ ਸਿੱਖਿਆ ਹੈ।"
  ],
  hr: [
    "भक्ति का राह त्याग अर सेवा तै सोहणा बणै सै।",
    "सच्ची भक्ति तै मनै का जीवण सफल हो जावै सै।",
    "जो नाम जाप में पक्का रैवै सै, उसनै परमात्मा जरूर मिलै सै।",
    "गुरु के बचन ई जीवण का सच्चा उजाला सैं।",
    "सेवा उही सच्ची जो बिना किसी लालच तै की जावै।",
    "सत्संग तै मन निरमल अर अक्ल जाग जावै सै।",
    "घमंड छोड़ो, प्रेम बाँटो — यही संतां की सीख सै।"
  ]
};

/* ---------- UI primitives ------------------------------------------------ */
let sheetLocked = false;
const UI = {
  toast(msg, kind) {
    const wrap = $("#toasts");
    const el = document.createElement("div");
    el.className = "toast " + (kind || "");
    el.innerHTML = (kind === "good" ? icon("check") : kind === "bad" ? icon("info") : "") + "<span>" + esc(msg) + "</span>";
    wrap.appendChild(el);
    setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 300); }, 2400);
  },
  sheet(html, after, locked) {
    sheetLocked = !!locked;
    $("#sheetBody").innerHTML = html;
    $("#scrim").classList.add("on");
    $("#sheet").classList.add("on");
    $("#sheet").scrollTop = 0;
    if (after) setTimeout(after, 20);
  },
  closeSheet() {
    if (sheetLocked) return;
    $("#sheet").classList.remove("on");
    if (!$("#modal").classList.contains("on")) $("#scrim").classList.remove("on");
  },
  forceCloseSheet() { sheetLocked = false; UI.closeSheet(); },
  modal(html, after) {
    $("#modalBody").innerHTML = html;
    $("#scrim").classList.add("on");
    $("#modal").classList.add("on");
    if (after) setTimeout(after, 20);
  },
  closeModal() {
    $("#modal").classList.remove("on");
    if (!$("#sheet").classList.contains("on")) $("#scrim").classList.remove("on");
  },
  confirm(title, sub, yes, onYes, danger) {
    UI.modal(`<h3>${esc(title)}</h3><div class="sub">${esc(sub || "")}</div>
      <button class="btn ${danger ? "danger" : "accent"} block" id="cfY">${esc(yes)}</button>
      <button class="btn ghost block mt10" id="cfN">${esc(t("cancel"))}</button>`, () => {
      $("#cfY").onclick = () => { UI.closeModal(); onYes && onYes(); };
      $("#cfN").onclick = () => UI.closeModal();
    });
  }
};
window.UI = UI;
window.esc = esc;

$("#scrim").onclick = () => { UI.closeSheet(); UI.closeModal(); };

/* ---------- router ------------------------------------------------------- */
const TABS = ["home", "seva", "jaap", "bhandara", "stats", "more"];
let tab = "home";
const history = [];

function go(name, push) {
  if (!TABS.includes(name)) name = "home";
  if (push !== false && name !== tab) history.push(tab);
  tab = name;
  $$(".screen").forEach(s => s.classList.remove("active", "enter"));
  const el = $("#s-" + name);
  el.classList.add("active", "enter");
  el.scrollTop = 0;
  $$("#dock button").forEach(b => b.classList.toggle("on", b.dataset.go === name));
  Bridge.vibrate(8);
  render(name);
}
window.__openTab = (n) => go(n);

window.__backButton = function () {
  if ($("#modal").classList.contains("on")) { UI.closeModal(); return; }
  if ($("#sheet").classList.contains("on")) { UI.forceCloseSheet(); return; }
  if (tab !== "home") { const prev = history.pop() || "home"; go(prev, false); return; }
  UI.confirm(t("exit_ask"), "", t("exit_yes"), () => Bridge.exit());
};

$$("#dock button").forEach(b => b.onclick = () => go(b.dataset.go));
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-go]");
  if (el && !el.closest("#dock")) go(el.dataset.go);
});

/* ---------- shared render helpers ---------------------------------------- */
function typeOf(id) { return Store.TYPES.find(x => x.id === id) || Store.TYPES[9]; }

function statCard(ico, value, label, colour) {
  const c = colour || "var(--accent)";
  return `<div class="stat">
    <div class="ico" style="background:${c}1A;color:${c}">${icon(ico)}</div>
    <div class="v">${value}</div><div class="k">${esc(label)}</div></div>`;
}

function entryRow(e) {
  const ty = typeOf(e.type);
  return `<div class="row" data-entry="${e.id}">
    <div class="tile" style="background:${ty.colour}18;color:${ty.colour}">${icon(ty.icon)}</div>
    <div class="main">
      <div class="t">${esc(t("type_" + e.type))}</div>
      <div class="s">${esc(fmtDate(e.date))} · ${esc(e.time || "")}${e.place ? " · " + esc(e.place) : ""}</div>
    </div>
    <div class="end"><div class="n">${fmtNum(e.qty)}</div><div class="u">${esc(t("unit_" + e.unit))}</div></div>
  </div>`;
}

function fmtNum(n) {
  n = Number(n) || 0;
  if (n >= 100000) return (n / 1000).toFixed(0) + "k";
  if (n >= 10000) return (n / 1000).toFixed(1) + "k";
  return String(Math.round(n * 10) / 10);
}
function fmtDate(d) {
  if (!d) return "";
  const today = Store.today();
  if (d === today) return t("r_today");
  const y = new Date(); y.setDate(y.getDate() - 1);
  if (d === Store.today(y)) return t("yesterday");
  const dt = new Date(d + "T00:00:00");
  const m = t("months");
  return dt.getDate() + " " + (Array.isArray(m) ? m[dt.getMonth()] : "");
}
function fmtDateFull(d) {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  const m = t("months");
  return dt.getDate() + " " + (Array.isArray(m) ? m[dt.getMonth()] : "") + " " + dt.getFullYear();
}
function emptyBlock(ico, title, sub, btn) {
  return `<div class="empty"><div class="ic">${icon(ico)}</div>
    <h4>${esc(title)}</h4><p>${esc(sub || "")}</p>${btn || ""}</div>`;
}

/* ---------- HOME --------------------------------------------------------- */
function renderHome() {
  const db = Store.db;
  const tot = Store.totals();
  const todayTot = Store.totals(db.entries.filter(e => e.date === Store.today()));
  const st = Store.streak();
  const now = new Date();
  const wd = t("weekdays");

  $("#hDate").textContent = (Array.isArray(wd) ? wd[now.getDay()] : "") + ", " + fmtDateFull(Store.today());
  $("#hGreet").textContent = t("greeting");
  $("#hName").textContent = db.profile.name ? db.profile.name + (db.profile.place ? " · " + db.profile.place : "") : t("app_for");
  $("#btnProfile").textContent = (db.profile.name || "भ").trim().charAt(0).toUpperCase();

  $("#heroKicker").textContent = t("today_seva");
  $("#heroTitle").textContent = todayTot.count ? todayTot.count + " " + t("stat_sevas") : t("no_seva_today");
  $("#heroSub").textContent = todayTot.count
    ? (todayTot.jaap ? fmtNum(todayTot.jaap) + " " + t("stat_jaap") + " · " : "") + (todayTot.hours ? todayTot.hours + " " + t("unit_hours") : t("today_seva_sub"))
    : t("start_now");

  $("#homeStats").innerHTML =
    statCard("flame", st.cur, t("stat_streak"), "#E8730C") +
    statCard("beads", fmtNum(tot.jaap), t("stat_jaap"), "#8B44C8") +
    statCard("clock", tot.hours, t("stat_hours"), "#128A5A");

  const goal = db.profile.goal || 108;
  const doneJaap = todayTot.jaap + (db.jaap.day === Store.today() ? db.jaap.count : 0);
  const pct = Math.min(100, Math.round(doneJaap * 100 / goal));
  $("#goalTag").textContent = t("goal_daily");
  $("#goalPct").textContent = pct + "%";
  $("#goalBar").style.width = pct + "%";
  $("#goalText").textContent = t("goal_of", { a: fmtNum(doneJaap), b: fmtNum(goal) });
  $("#btnQuickJaap").textContent = t("add_jaap");

  $("#t-quick").textContent = t("quick");
  $("#quickGrid").innerHTML = [
    { ty: "jaap", img: "img/hero_jaap-sm.jpg" },
    { ty: "satsang", img: "img/hero_satsang-sm.jpg" },
    { ty: "bhandara", img: "img/hero_seva-sm.jpg" },
    { ty: "langar", img: "img/hero_seva-sm.jpg" }
  ].map(q => `<button class="mini" data-quick="${q.ty}">
      <img src="${q.img}" alt=""><div class="veil"></div>
      <div class="save">${icon("plus")}</div>
      <div class="cap"><b>${esc(t("type_" + q.ty))}</b><span>${esc(t("add_seva"))}</span></div>
    </button>`).join("");
  $$("[data-quick]").forEach(b => b.onclick = () => sevaSheet(null, b.dataset.quick));

  $("#t-recent").textContent = t("recent");
  $("#t-seeall").textContent = t("seeall");
  const recent = Store.entries().slice(0, 4);
  $("#recentList").innerHTML = recent.length ? recent.map(entryRow).join("")
    : emptyBlock("scroll", t("empty_list"), t("start_now"));
  bindEntryRows($("#recentList"));

  $("#t-vichar").textContent = t("vichar");
  const qs = QUOTES[Lang.code] || QUOTES.hi;
  const dayIdx = Math.floor(Date.now() / 86400000) % qs.length;
  $("#quoteText").textContent = "“" + qs[dayIdx] + "”";
  $("#quoteBy").textContent = t("quote_by");

  const u = Updater.state;
  const old = $("#btnUpd .badge-dot"); if (old) old.remove();
  if (u.available || u.apkAvailable) {
    const d = document.createElement("span"); d.className = "badge-dot"; d.textContent = "!";
    $("#btnUpd").appendChild(d);
  }
}

/* ---------- SEVA --------------------------------------------------------- */
let sevaRange = "today", sevaType = "all", sevaQuery = "";

function renderSeva() {
  $("#t-seva-eyebrow").textContent = t("seva_eyebrow");
  $("#t-seva-title").textContent = t("seva_title");
  $("#sevaSearch").placeholder = t("search_seva");
  $("#t-r-today").textContent = t("r_today"); $("#t-r-week").textContent = t("r_week");
  $("#t-r-month").textContent = t("r_month"); $("#t-r-all").textContent = t("r_all");
  $("#t-entries").textContent = t("entries");

  $("#sevaChips").innerHTML = [`<button class="chip accent ${sevaType === "all" ? "on" : ""}" data-ty="all">${esc(t("all_types"))}</button>`]
    .concat(Store.TYPES.map(ty =>
      `<button class="chip accent ${sevaType === ty.id ? "on" : ""}" data-ty="${ty.id}">${esc(t("type_" + ty.id))}</button>`)).join("");
  $$("#sevaChips .chip").forEach(c => c.onclick = () => { sevaType = c.dataset.ty; renderSeva(); });

  const list = Store.entries({ range: sevaRange, type: sevaType, q: sevaQuery });
  const tot = Store.totals(list);
  $("#sevaStats").innerHTML =
    statCard("scroll", tot.count, t("entries"), "#2F6BD8") +
    statCard("beads", fmtNum(tot.jaap), t("stat_jaap"), "#8B44C8") +
    statCard("clock", tot.hours, t("stat_hours"), "#128A5A");
  $("#sevaCount").textContent = list.length;
  $("#sevaList").innerHTML = list.length ? list.map(entryRow).join("")
    : emptyBlock("scroll", t("empty_list"), t("start_now"),
        `<button class="btn accent mt18" id="emptyAdd">${t("add_seva")}</button>`);
  const ea = $("#emptyAdd"); if (ea) ea.onclick = () => sevaSheet();
  bindEntryRows($("#sevaList"));
}

function bindEntryRows(root) {
  $$("[data-entry]", root).forEach(r => r.onclick = () => entrySheet(r.dataset.entry));
}

$$("#sevaRange button").forEach(b => b.onclick = () => {
  sevaRange = b.dataset.range;
  $$("#sevaRange button").forEach(x => x.classList.toggle("on", x === b));
  renderSeva();
});
$("#sevaSearch").oninput = (e) => { sevaQuery = e.target.value; renderSeva(); };
$("#btnAddSeva").onclick = () => sevaSheet();
$("#btnFilter").onclick = () => {
  UI.sheet(`<h3>${t("f_type")}</h3><div class="sub">${t("entries")}</div>
    <div class="chips wrap" style="padding:0">${Store.TYPES.map(ty =>
      `<button class="chip accent ${sevaType === ty.id ? "on" : ""}" data-f="${ty.id}">${esc(t("type_" + ty.id))}</button>`).join("")}
      <button class="chip ${sevaType === "all" ? "on" : ""}" data-f="all">${esc(t("all_types"))}</button></div>`, () => {
    $$("[data-f]").forEach(b => b.onclick = () => { sevaType = b.dataset.f; UI.closeSheet(); renderSeva(); });
  });
};

/* ---------- seva add / edit ---------------------------------------------- */
function sevaSheet(id, presetType) {
  const e = id ? Store.db.entries.find(x => x.id === id) : null;
  const ty = e ? e.type : (presetType || "jaap");
  const cur = typeOf(ty);
  const html = `
    <h3>${esc(e ? t("edit_seva") : t("add_seva"))}</h3>
    <div class="sub">${esc(t("today_seva_sub"))}</div>
    <div class="field"><label>${esc(t("f_type"))}</label>
      <div class="chips wrap" style="padding:0" id="fTypes">${Store.TYPES.map(x =>
        `<button class="chip accent ${x.id === ty ? "on" : ""}" data-t="${x.id}">${esc(t("type_" + x.id))}</button>`).join("")}</div>
    </div>
    <div class="inp-group">
      <div class="field"><label>${esc(t("f_qty"))}</label>
        <input class="inp" id="fQty" type="number" inputmode="decimal" min="0" step="any" value="${e ? e.qty : ""}" placeholder="0"></div>
      <div class="field"><label>${esc(t("f_unit"))}</label>
        <select class="inp" id="fUnit">${["count","mala","hours","minutes","times","people","km"].map(u =>
          `<option value="${u}" ${((e && e.unit) || cur.unit) === u ? "selected" : ""}>${esc(t("unit_" + u))}</option>`).join("")}</select></div>
    </div>
    <div class="inp-group">
      <div class="field"><label>${esc(t("f_date"))}</label>
        <input class="inp" id="fDate" type="date" value="${(e && e.date) || Store.today()}"></div>
      <div class="field"><label>${esc(t("f_time"))}</label>
        <input class="inp" id="fTime" type="time" value="${(e && e.time) || new Date().toTimeString().slice(0,5)}"></div>
    </div>
    <div class="field"><label>${esc(t("f_place"))}</label>
      <input class="inp" id="fPlace" value="${esc(e ? e.place : "")}" placeholder="${esc(t("f_place_ph"))}"></div>
    <div class="field"><label>${esc(t("f_notes"))}</label>
      <textarea class="ta" id="fNotes" placeholder="${esc(t("f_notes_ph"))}">${esc(e ? e.notes : "")}</textarea></div>
    <button class="btn accent block" id="fSave">${esc(t("save"))}</button>
    ${e ? `<button class="btn danger block mt10" id="fDel">${esc(t("delete"))}</button>` : ""}`;

  UI.sheet(html, () => {
    let sel = ty;
    $$("#fTypes .chip").forEach(c => c.onclick = () => {
      sel = c.dataset.t;
      $$("#fTypes .chip").forEach(x => x.classList.toggle("on", x === c));
      const unit = typeOf(sel).unit;
      $("#fUnit").value = unit;
    });
    $("#fSave").onclick = () => {
      const qty = Number($("#fQty").value);
      if (!qty || qty <= 0) { UI.toast(t("qty_needed"), "bad"); $("#fQty").focus(); return; }
      const data = { type: sel, qty, unit: $("#fUnit").value, date: $("#fDate").value,
        time: $("#fTime").value, place: $("#fPlace").value, notes: $("#fNotes").value };
      if (e) Store.updateEntry(e.id, data); else Store.addEntry(data);
      Bridge.vibrate(18);
      UI.forceCloseSheet(); UI.toast(t("saved_ok"), "good"); render(tab);
    };
    const del = $("#fDel");
    if (del) del.onclick = () => UI.confirm(t("delete_ask"), t("delete_ask_sub"), t("delete"), () => {
      Store.removeEntry(e.id); UI.forceCloseSheet(); UI.toast(t("deleted_ok")); render(tab);
    }, true);
  });
}

function entrySheet(id) {
  const e = Store.db.entries.find(x => x.id === id);
  if (!e) return;
  const ty = typeOf(e.type);
  UI.sheet(`
    <div class="flex gap12 mb12">
      <div class="tile" style="width:52px;height:52px;border-radius:16px;display:grid;place-items:center;background:${ty.colour}18;color:${ty.colour}">${icon(ty.icon)}</div>
      <div><h3 style="margin:0">${esc(t("type_" + e.type))}</h3>
        <div class="small muted">${esc(fmtDateFull(e.date))} · ${esc(e.time || "")}</div></div>
    </div>
    <div class="card center" style="background:var(--surface-2)">
      <div style="font-size:38px;font-weight:800;letter-spacing:-.04em">${fmtNum(e.qty)}</div>
      <div class="small muted">${esc(t("unit_" + e.unit))}</div>
    </div>
    ${e.place ? `<div class="row mt14"><div class="tile">${icon("pin")}</div><div class="main"><div class="s">${esc(t("f_place"))}</div><div class="t">${esc(e.place)}</div></div></div>` : ""}
    ${e.notes ? `<div class="card mt14"><div class="xs muted bold mb8">${esc(t("f_notes"))}</div><div class="small">${esc(e.notes)}</div></div>` : ""}
    <div class="flex gap10 mt18">
      <button class="btn ghost" style="flex:1" id="eEdit">${icon("edit")}${esc(t("edit"))}</button>
      <button class="btn danger" style="flex:1" id="eDel">${icon("trash")}${esc(t("delete"))}</button>
    </div>`, () => {
    $("#eEdit").onclick = () => { UI.forceCloseSheet(); setTimeout(() => sevaSheet(id), 220); };
    $("#eDel").onclick = () => UI.confirm(t("delete_ask"), t("delete_ask_sub"), t("delete"), () => {
      Store.removeEntry(id); UI.forceCloseSheet(); UI.toast(t("deleted_ok")); render(tab);
    }, true);
  });
}

/* ---------- JAAP --------------------------------------------------------- */
function renderJaap() {
  const db = Store.db;
  $("#t-jaap-eyebrow").textContent = t("jaap_eyebrow");
  $("#t-jaap-title").textContent = t("jaap_title");
  $("#t-tap").textContent = t("tap_count");
  $("#jaapReset").textContent = t("reset");
  $("#jaapSave").textContent = t("save_seva");
  $("#t-jaap-hist").textContent = t("jaap_hist");

  $("#mantraChips").innerHTML = Store.MANTRAS.map(m =>
    `<button class="chip sm ${db.settings.mantra === m.id ? "on" : ""}" data-m="${m.id}">${esc(m.label)}</button>`).join("");
  $$("[data-m]").forEach(b => b.onclick = () => { Store.setting("mantra", b.dataset.m); renderJaap(); });

  const per = db.settings.perMala || 108;
  const c = db.jaap.count;
  $("#jaapNum").textContent = c;
  $("#jaapMalas").textContent = Math.floor(c / per) + " " + t("malas") + " · " + (c % per) + "/" + per;
  const circ = 2 * Math.PI * 47;
  $("#ringFg").setAttribute("stroke-dashoffset", String(circ - (circ * (c % per) / per)));

  const tot = Store.totals();
  const todayJaap = Store.totals(db.entries.filter(e => e.date === Store.today() && e.type === "jaap")).jaap;
  $("#jaapStats").innerHTML =
    statCard("beads", fmtNum(todayJaap), t("r_today"), "#E8730C") +
    statCard("spark", fmtNum(tot.malas), t("stat_malas"), "#8B44C8") +
    statCard("chart", fmtNum(tot.jaap), t("total_label"), "#128A5A");

  const hist = Store.entries({ type: "jaap" }).slice(0, 10);
  $("#jaapHist").innerHTML = hist.length ? hist.map(entryRow).join("")
    : emptyBlock("beads", t("empty_list"), t("start_now"));
  bindEntryRows($("#jaapHist"));
}

$("#counter").onclick = () => {
  const n = Store.jaapTap(1);
  const el = $("#counter");
  el.classList.remove("pulse"); void el.offsetWidth; el.classList.add("pulse");
  const per = Store.db.settings.perMala || 108;
  Bridge.vibrate(n % per === 0 ? 60 : 10);
  $("#jaapNum").textContent = n;
  $("#jaapMalas").textContent = Math.floor(n / per) + " " + t("malas") + " · " + (n % per) + "/" + per;
  const circ = 2 * Math.PI * 47;
  $("#ringFg").setAttribute("stroke-dashoffset", String(circ - (circ * (n % per) / per)));
  if (n % per === 0 && n > 0) UI.toast("🙏 " + (n / per) + " " + t("malas"), "good");
};
$("#jaapUndo").onclick = () => { Store.jaapTap(-1); renderJaap(); };
$("#jaapReset").onclick = () => UI.confirm(t("reset_ask"), "", t("reset"), () => { Store.jaapReset(); renderJaap(); });
$("#jaapSave").onclick = () => {
  const e = Store.jaapCommit();
  if (!e) { UI.toast(t("qty_needed"), "bad"); return; }
  Bridge.vibrate(30);
  UI.toast(t("jaap_saved", { n: e.qty }), "good");
  renderJaap();
};
$("#btnJaapSettings").onclick = () => {
  const s = Store.db.settings;
  UI.sheet(`<h3>${t("jaap_title")}</h3><div class="sub">${t("per_mala")}</div>
    <div class="field"><label>${t("per_mala")}</label>
      <input class="inp" id="jPer" type="number" inputmode="numeric" value="${s.perMala}"></div>
    <div class="setting card flat" style="padding:12px 0">
      <div class="main"><div class="t">${t("on")} — ${t("vibration")}</div></div>
      <div class="switch ${s.jaapVibrate ? "on" : ""}" id="jVib"></div></div>
    <button class="btn accent block mt18" id="jSave">${t("save")}</button>`, () => {
    $("#jVib").onclick = (ev) => ev.currentTarget.classList.toggle("on");
    $("#jSave").onclick = () => {
      Store.setting("perMala", Math.max(1, Number($("#jPer").value) || 108));
      Store.setting("jaapVibrate", $("#jVib").classList.contains("on"));
      UI.closeSheet(); renderJaap(); UI.toast(t("updated_ok"), "good");
    };
  });
};

/* ---------- BHANDARA ----------------------------------------------------- */
let bhTab = "events";
function renderBhandara() {
  $("#t-bh-eyebrow").textContent = t("bh_eyebrow");
  $("#t-bh-title").textContent = t("bh_title");
  $("#t-bh-events").textContent = t("bh_events");
  $("#t-bh-banners").textContent = t("bh_banners");
  $("#t-bh-seva").textContent = t("bh_seva");
  $("#t-upcoming").textContent = t("upcoming");
  $("#btnAddEvent").textContent = t("add_event");
  $("#t-studio").textContent = t("studio");
  $("#t-makebanner").textContent = t("make_banner");
  $("#btnStudio").textContent = t("create_banner");
  $("#t-saved-banners").textContent = t("saved_banners");
  $("#t-bh-seva-head").textContent = t("bh_seva_head");

  ["events", "banners", "seva"].forEach(k => { $("#bh-" + k).hidden = k !== bhTab; });
  $$("#bhSeg button").forEach(b => b.classList.toggle("on", b.dataset.tab === bhTab));

  const evs = Store.upcomingEvents();
  $("#eventList").innerHTML = evs.length ? evs.map(eventCard).join("")
    : emptyBlock("pot", t("no_events"), t("no_events_sub"));
  $$("[data-event]").forEach(c => c.onclick = () => eventSheet(c.dataset.event));

  const bs = Store.db.banners;
  $("#bannerCount").textContent = bs.length;
  $("#bannerGrid").innerHTML = bs.length ? bs.map(b => `
    <button class="mini" data-banner="${b.id}">
      ${b.thumb ? `<img src="${b.thumb}" alt="">` : `<img src="img/hero_satsang-sm.jpg" alt="">`}
      <div class="veil"></div>
      <div class="cap"><b>${esc(b.title || t("bn_default_title"))}</b><span>${esc(fmtDateFull(b.date))}</span></div>
    </button>`).join("")
    : `<div style="grid-column:1/-1">${emptyBlock("image", t("no_banners"), t("no_banners_sub"))}</div>`;
  $$("[data-banner]").forEach(b => b.onclick = () => {
    const bn = Store.db.banners.find(x => x.id === b.dataset.banner);
    if (bn) studioSheet(bn);
  });

  const bhEntries = Store.entries({ type: "bhandara" }).concat(Store.entries({ type: "langar" }))
    .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20);
  $("#bhSevaList").innerHTML = bhEntries.length ? bhEntries.map(entryRow).join("")
    : emptyBlock("bowl", t("empty_list"), t("start_now"));
  bindEntryRows($("#bhSevaList"));
}

function eventCard(ev) {
  const days = Math.round((new Date(ev.date + "T00:00:00") - new Date(Store.today() + "T00:00:00")) / 86400000);
  const when = days < 0 ? t("ev_past") : days === 0 ? t("ev_today") : days === 1 ? t("ev_tomorrow") : t("ev_in", { n: days });
  const cls = days < 0 ? "" : days <= 1 ? "accent" : "info";
  return `<button class="card tap w100" data-event="${ev.id}" style="text-align:left">
    <div class="between mb8">
      <span class="tag ${cls}">${esc(when)}</span>
      <span class="xs muted">${esc(ev.time || "")}</span>
    </div>
    <div style="font-size:17px;font-weight:730;letter-spacing:-.02em">${esc(ev.title)}</div>
    <div class="small muted mt6">${icon("pin").replace("<svg", '<svg style="width:13px;height:13px;vertical-align:-2px"')} ${esc(ev.venue || "—")}</div>
    <div class="xs muted mt6">${esc(fmtDateFull(ev.date))}${ev.org ? " · " + esc(ev.org) : ""}</div>
  </button>`;
}

$$("#bhSeg button").forEach(b => b.onclick = () => { bhTab = b.dataset.tab; renderBhandara(); });
$("#btnAddEvent").onclick = () => eventForm();
$("#btnNewBanner").onclick = () => studioSheet();
$("#btnStudio").onclick = () => studioSheet();
$("#bannerPromo").onclick = () => studioSheet();

function eventForm(id) {
  const ev = id ? Store.db.events.find(x => x.id === id) : null;
  UI.sheet(`<h3>${esc(ev ? t("ev_edit") : t("ev_add"))}</h3><div class="sub">${esc(t("bh_eyebrow"))}</div>
    <div class="field"><label>${esc(t("ev_title"))}</label>
      <input class="inp" id="eTitle" value="${esc(ev ? ev.title : "")}" placeholder="${esc(t("ev_title_ph"))}"></div>
    <div class="inp-group">
      <div class="field"><label>${esc(t("ev_date"))}</label><input class="inp" id="eDate" type="date" value="${(ev && ev.date) || Store.today()}"></div>
      <div class="field"><label>${esc(t("ev_time"))}</label><input class="inp" id="eTime" type="time" value="${(ev && ev.time) || "10:00"}"></div>
    </div>
    <div class="field"><label>${esc(t("ev_venue"))}</label>
      <input class="inp" id="eVenue" value="${esc(ev ? ev.venue : "")}" placeholder="${esc(t("ev_venue_ph"))}"></div>
    <div class="inp-group">
      <div class="field"><label>${esc(t("ev_org"))}</label><input class="inp" id="eOrg" value="${esc(ev ? ev.org : "")}" placeholder="${esc(t("ev_org_ph"))}"></div>
      <div class="field"><label>${esc(t("ev_phone"))}</label><input class="inp" id="ePhone" type="tel" value="${esc(ev ? ev.phone : "")}"></div>
    </div>
    <div class="field"><label>${esc(t("ev_notes"))}</label><textarea class="ta" id="eNotes">${esc(ev ? ev.notes : "")}</textarea></div>
    <div class="setting card flat" style="padding:10px 0">
      <div class="main"><div class="t">${esc(t("ev_remind"))}</div></div>
      <div class="switch ${!ev || ev.remind ? "on" : ""}" id="eRem"></div></div>
    <button class="btn accent block mt18" id="eSave">${esc(t("save"))}</button>
    ${ev ? `<button class="btn danger block mt10" id="eDel2">${esc(t("delete"))}</button>` : ""}`, () => {
    $("#eRem").onclick = (e) => e.currentTarget.classList.toggle("on");
    $("#eSave").onclick = () => {
      const title = $("#eTitle").value.trim();
      if (!title) { UI.toast(t("ev_title"), "bad"); return; }
      const data = { title, date: $("#eDate").value, time: $("#eTime").value,
        venue: $("#eVenue").value.trim(), org: $("#eOrg").value.trim(),
        phone: $("#ePhone").value.trim(), notes: $("#eNotes").value.trim(),
        remind: $("#eRem").classList.contains("on") };
      if (ev) Store.updateEvent(ev.id, data); else Store.addEvent(data);
      scheduleEventReminders();
      UI.forceCloseSheet(); UI.toast(t("ev_saved"), "good"); renderBhandara();
    };
    const d = $("#eDel2");
    if (d) d.onclick = () => UI.confirm(t("delete_ask"), "", t("delete"), () => {
      Store.removeEvent(ev.id); scheduleEventReminders(); UI.forceCloseSheet(); renderBhandara();
    }, true);
  });
}

function eventSheet(id) {
  const ev = Store.db.events.find(x => x.id === id);
  if (!ev) return;
  UI.sheet(`<h3>${esc(ev.title)}</h3><div class="sub">${esc(fmtDateFull(ev.date))} · ${esc(ev.time || "")}</div>
    ${ev.venue ? `<div class="row"><div class="tile">${icon("pin")}</div><div class="main"><div class="s">${esc(t("ev_venue"))}</div><div class="t">${esc(ev.venue)}</div></div></div>` : ""}
    ${ev.org ? `<div class="row mt10"><div class="tile">${icon("users")}</div><div class="main"><div class="s">${esc(t("ev_org"))}</div><div class="t">${esc(ev.org)}</div></div></div>` : ""}
    ${ev.phone ? `<div class="row mt10"><div class="tile">${icon("phone")}</div><div class="main"><div class="s">${esc(t("ev_phone"))}</div><div class="t">${esc(ev.phone)}</div></div></div>` : ""}
    ${ev.notes ? `<div class="card mt14"><div class="small">${esc(ev.notes)}</div></div>` : ""}
    <button class="btn accent block mt18" id="evBanner">${icon("image")}${esc(t("make_from_event"))}</button>
    <div class="flex gap10 mt10">
      <button class="btn ghost" style="flex:1" id="evShare">${icon("share")}${esc(t("bn_share"))}</button>
      <button class="btn ghost" style="flex:1" id="evEdit">${icon("edit")}${esc(t("edit"))}</button>
    </div>`, () => {
    $("#evBanner").onclick = () => { UI.forceCloseSheet(); setTimeout(() => studioSheet({
      title: ev.title, sub: t("bn_default_sub"), date: fmtDateFull(ev.date) + (ev.time ? " · " + ev.time : ""),
      venue: ev.venue, org: ev.org, contact: ev.phone }), 240); };
    $("#evShare").onclick = () => Bridge.shareText(
      `॥ ${t("greeting")} ॥\n${ev.title}\n${fmtDateFull(ev.date)} ${ev.time || ""}\n${ev.venue || ""}\n${ev.org || ""} ${ev.phone || ""}\n\n${t("bn_invite")}`);
    $("#evEdit").onclick = () => { UI.forceCloseSheet(); setTimeout(() => eventForm(id), 220); };
  });
}

/* ---------- banner studio ------------------------------------------------ */
let studioCfg = null;
function studioSheet(seed) {
  studioCfg = Object.assign({
    title: t("bn_default_title"), sub: t("bn_default_sub"),
    date: fmtDateFull(Store.today()), venue: "", org: "", contact: "",
    template: "photo", theme: "saffron", photo: Banners.PHOTOS[0], size: "portrait"
  }, seed || {});

  UI.sheet(`<h3>${esc(t("studio"))}</h3><div class="sub">${esc(t("make_banner"))}</div>
    <div class="canvas-wrap"><canvas id="bnCanvas"></canvas></div>
    <div class="field mt14"><label>${esc(t("bn_template"))}</label>
      <div class="seg" id="bnTpl">${Banners.TEMPLATES.map(x =>
        `<button data-tpl="${x.id}" class="${studioCfg.template === x.id ? "on" : ""}">${esc(x.name)}</button>`).join("")}</div></div>
    <div class="field"><label>${esc(t("bn_colour"))}</label>
      <div class="swatches" id="bnSw">${Banners.THEMES.map(x =>
        `<button class="sw ${studioCfg.theme === x.id ? "on" : ""}" data-th="${x.id}" style="background:linear-gradient(135deg,${x.a},${x.b})"></button>`).join("")}</div></div>
    <div class="field"><label>${esc(t("bn_photo"))}</label>
      <div class="chips" style="padding:0" id="bnPh">${Banners.PHOTOS.map((p, i) =>
        `<button class="chip sm ${studioCfg.photo === p ? "on" : ""}" data-ph="${p}">${i + 1}</button>`).join("")}</div></div>
    <div class="field"><label>${esc(t("bn_size"))}</label>
      <div class="seg" id="bnSize">
        <button data-sz="portrait" class="on">4:5</button>
        <button data-sz="square">1:1</button>
        <button data-sz="story">9:16</button></div></div>
    <div class="field"><label>${esc(t("bn_title"))}</label><input class="inp" id="bnTitle" value="${esc(studioCfg.title)}"></div>
    <div class="field"><label>${esc(t("bn_sub"))}</label><input class="inp" id="bnSub" value="${esc(studioCfg.sub)}"></div>
    <div class="field"><label>${esc(t("bn_date"))}</label><input class="inp" id="bnDate" value="${esc(studioCfg.date)}"></div>
    <div class="field"><label>${esc(t("bn_venue"))}</label><input class="inp" id="bnVenue" value="${esc(studioCfg.venue)}"></div>
    <div class="inp-group">
      <div class="field"><label>${esc(t("ev_org"))}</label><input class="inp" id="bnOrg" value="${esc(studioCfg.org)}"></div>
      <div class="field"><label>${esc(t("bn_contact"))}</label><input class="inp" id="bnContact" value="${esc(studioCfg.contact)}"></div>
    </div>
    <div class="flex gap10 mt10">
      <button class="btn ghost" style="flex:1" id="bnSaveImg">${icon("down")}${esc(t("bn_gallery"))}</button>
      <button class="btn accent" style="flex:1" id="bnShare">${icon("share")}${esc(t("bn_share"))}</button>
    </div>`, () => {
    const cv = $("#bnCanvas");
    let tmr = null;
    const draw = () => { clearTimeout(tmr); tmr = setTimeout(() => Banners.render(cv, studioCfg), 90); };
    const bindInp = (id, key) => { const el = $(id); el.oninput = () => { studioCfg[key] = el.value; draw(); }; };
    bindInp("#bnTitle", "title"); bindInp("#bnSub", "sub"); bindInp("#bnDate", "date");
    bindInp("#bnVenue", "venue"); bindInp("#bnOrg", "org"); bindInp("#bnContact", "contact");
    $$("#bnTpl button").forEach(b => b.onclick = () => {
      studioCfg.template = b.dataset.tpl;
      $$("#bnTpl button").forEach(x => x.classList.toggle("on", x === b)); draw();
    });
    $$("#bnSw .sw").forEach(b => b.onclick = () => {
      studioCfg.theme = b.dataset.th;
      $$("#bnSw .sw").forEach(x => x.classList.toggle("on", x === b)); draw();
    });
    $$("#bnPh .chip").forEach(b => b.onclick = () => {
      studioCfg.photo = b.dataset.ph;
      $$("#bnPh .chip").forEach(x => x.classList.toggle("on", x === b)); draw();
    });
    $$("#bnSize button").forEach(b => b.onclick = () => {
      studioCfg.size = b.dataset.sz;
      $$("#bnSize button").forEach(x => x.classList.toggle("on", x === b)); draw();
    });
    $("#bnSaveImg").onclick = async () => {
      await Banners.render(cv, studioCfg);
      const url = Banners.dataUrl(cv, 0.92);
      if (!Bridge.hasPerm("photos") && Bridge.isNative) await Bridge.requestPerms(["photos", "storage"]);
      const r = Bridge.saveImage(url, "bhandara-" + Date.now() + ".jpg");
      if (r.ok) {
        const th = document.createElement("canvas");
        th.width = 240; th.height = Math.round(240 * cv.height / cv.width);
        th.getContext("2d").drawImage(cv, 0, 0, th.width, th.height);
        Store.addBanner(Object.assign({}, studioCfg, { thumb: th.toDataURL("image/jpeg", 0.6) }));
        UI.toast(t("bn_saved"), "good"); renderBhandara();
      } else UI.toast(r.error || t("error"), "bad");
    };
    $("#bnShare").onclick = async () => {
      await Banners.render(cv, studioCfg);
      const url = Banners.dataUrl(cv, 0.92);
      const r = Bridge.shareImage(url, "bhandara-" + Date.now() + ".jpg",
        `॥ ${t("greeting")} ॥\n${studioCfg.title}\n${studioCfg.date}\n${studioCfg.venue}`);
      if (!r.ok) UI.toast(t("error"), "bad");
    };
    draw();
  });
}

/* ---------- STATS -------------------------------------------------------- */
function renderStats() {
  $("#t-st-eyebrow").textContent = t("st_eyebrow");
  $("#t-st-title").textContent = t("st_title");
  $("#t-streak").textContent = t("streak");
  $("#t-best").textContent = t("best");
  $("#t-90days").textContent = t("days90");
  $("#t-weekly").textContent = t("weekly");
  $("#t-split").textContent = t("split");

  const st = Store.streak();
  $("#stStreak").textContent = st.cur;
  $("#stBest").textContent = st.best;
  $("#stActiveDays").textContent = t("active_days", { n: st.activeDays });

  $("#heat").innerHTML = Store.heatmap(90).map(d => {
    const l = d.n === 0 ? "" : d.n === 1 ? "l1" : d.n === 2 ? "l2" : d.n <= 4 ? "l3" : "l4";
    return `<i class="${l}" title="${d.date}"></i>`;
  }).join("");

  const wk = Store.week();
  const max = Math.max(1, ...wk.map(w => w.score));
  const wd = t("weekdays_short");
  $("#weekBars").innerHTML = wk.map(w =>
    `<div class="b ${w.score >= max * .7 && w.score > 0 ? "hi" : ""}">
      <i style="height:${Math.max(4, w.score / max * 100)}%"></i>
      <span>${Array.isArray(wd) ? wd[w.dow] : ""}</span></div>`).join("");
  $("#weekTotal").textContent = wk.reduce((s, w) => s + w.n, 0);

  const tot = Store.totals();
  const parts = Object.entries(tot.byType).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const sum = parts.reduce((s, p) => s + p[1], 0) || 1;
  let off = 0;
  $("#donut").innerHTML = `<circle cx="21" cy="21" r="15.9" stroke="var(--bg-2)"/>` + parts.map(([id, v]) => {
    const ty = typeOf(id); const frac = v / sum * 100;
    const c = `<circle cx="21" cy="21" r="15.9" stroke="${ty.colour}" stroke-dasharray="${frac} ${100 - frac}" stroke-dashoffset="${-off}"/>`;
    off += frac; return c;
  }).join("");
  $("#donutLegend").innerHTML = parts.map(([id, v]) => {
    const ty = typeOf(id);
    return `<div><i style="background:${ty.colour}"></i>${esc(t("type_" + id))}<b>${fmtNum(v)}</b></div>`;
  }).join("") || `<div class="muted small">${esc(t("empty_list"))}</div>`;

  $("#lifeStats").innerHTML =
    statCard("scroll", tot.count, t("stat_sevas"), "#2F6BD8") +
    statCard("cal", st.activeDays, t("stat_days"), "#128A5A") +
    statCard("pot", Store.db.events.length, t("stat_events"), "#B8730A");
}

$("#btnExportStats").onclick = () => {
  const tot = Store.totals(); const st = Store.streak();
  const lines = [
    t("app_name") + " — " + t("st_title"),
    fmtDateFull(Store.today()),
    "",
    t("stat_sevas") + ": " + tot.count,
    t("stat_jaap") + ": " + tot.jaap,
    t("stat_malas") + ": " + tot.malas,
    t("stat_hours") + ": " + tot.hours,
    t("stat_days") + ": " + st.activeDays,
    t("streak") + ": " + st.cur,
    "", ...Object.entries(tot.byType).map(([k, v]) => t("type_" + k) + ": " + v)
  ];
  Bridge.shareText(lines.join("\n"));
};

/* ---------- MORE --------------------------------------------------------- */
function renderMore() {
  const db = Store.db, info = Bridge.info();
  $("#t-more-eyebrow").textContent = t("more_eyebrow");
  $("#t-more-title").textContent = t("more_title");
  $("#t-appupdate").textContent = t("app_update");
  $("#t-language").textContent = t("language");
  $("#t-theme").textContent = t("theme");
  $("#t-reminders").textContent = t("reminders");
  $("#t-vault").textContent = t("vault");
  $("#t-backup").textContent = t("backup");
  $("#t-backup-sub").textContent = t("backup_sub");
  $("#t-perms").textContent = t("perms");
  $("#t-about").textContent = t("about");
  $("#t-about-sub").textContent = t("about_sub");

  $("#profileCard").innerHTML = `<div class="setting" data-act="profile">
    <div class="avatar">${esc((db.profile.name || "भ").charAt(0).toUpperCase())}</div>
    <div class="main"><div class="t">${esc(db.profile.name || t("ob_name"))}</div>
      <div class="s">${esc(db.profile.place || t("ob_place"))}</div></div>
    <span class="chev muted">›</span></div>`;

  const u = Updater.state;
  $("#verLine").textContent = "v" + info.webVersion + " · build " + info.webBuild;
  const tag = $("#updTag");
  if (u.available || u.apkAvailable) { tag.className = "tag accent"; tag.textContent = t("up_available"); }
  else { tag.className = "tag good"; tag.textContent = t("up_uptodate"); }

  $("#langLine").textContent = window.I18N[Lang.code]._name;
  $("#themeLine").textContent = t("theme_" + (db.settings.theme || "auto"));
  const on = db.reminders.filter(r => r.enabled);
  $("#remLine").textContent = on.length
    ? on.map(r => t("daily_at", { t: String(r.hour).padStart(2, "0") + ":" + String(r.minute).padStart(2, "0") })).join(" · ")
    : t("off");
  const s = Store.stats;
  $("#vaultLine").textContent = t("v_algo_v") + (s.ratio ? " · −" + s.ratio + "%" : "");
  const permOk = Bridge.notifAllowed();
  $("#permsLine").textContent = permOk ? t("p_granted") : t("p_denied");
  $("#footNote").innerHTML = esc(t("app_name")) + " v" + esc(info.webVersion) + "<br>" + esc(t("a_credit"));

  $$("[data-act]").forEach(el => el.onclick = () => {
    const a = el.dataset.act;
    if (a === "version") Updater.versionSheet();
    else if (a === "language") languageSheet();
    else if (a === "theme") themeSheet();
    else if (a === "reminders") remindersSheet();
    else if (a === "vault") vaultSheet();
    else if (a === "backup") backupSheet();
    else if (a === "perms") permsSheet();
    else if (a === "about") aboutSheet();
    else if (a === "profile") profileSheet();
  });
}

function languageSheet() {
  UI.sheet(`<h3>${esc(t("language"))}</h3><div class="sub">${esc(t("ob_lang"))}</div>
    ${Lang.available.map(c => `<button class="row w100 mb8" data-lang="${c}" style="text-align:left">
      <div class="tile" style="background:${Lang.code === c ? "var(--accent)" : "var(--bg-2)"};color:${Lang.code === c ? "#fff" : "var(--ink-2)"};font-weight:800;font-size:13px">${esc(window.I18N[c]._flag)}</div>
      <div class="main"><div class="t">${esc(window.I18N[c]._name)}</div></div>
      ${Lang.code === c ? `<span style="color:var(--accent)">${icon("check")}</span>` : ""}
    </button>`).join("")}`, () => {
    $$("[data-lang]").forEach(b => b.onclick = () => {
      Lang.set(b.dataset.lang); applyStatic(); UI.closeSheet(); render(tab); UI.toast(t("updated_ok"), "good");
    });
  });
}

function themeSheet() {
  const cur = Store.db.settings.theme;
  UI.sheet(`<h3>${esc(t("theme"))}</h3><div class="sub">&nbsp;</div>
    ${["light", "dark", "auto"].map(k => `<button class="row w100 mb8" data-theme-opt="${k}" style="text-align:left">
      <div class="tile">${icon(k === "light" ? "spark" : k === "dark" ? "moon" : "globe")}</div>
      <div class="main"><div class="t">${esc(t("theme_" + k))}</div></div>
      ${cur === k ? `<span style="color:var(--accent)">${icon("check")}</span>` : ""}</button>`).join("")}`, () => {
    $$("[data-theme-opt]").forEach(b => b.onclick = () => {
      Store.setting("theme", b.dataset.themeOpt); applyTheme(); UI.closeSheet(); renderMore();
    });
  });
}

function profileSheet() {
  const p = Store.db.profile;
  UI.sheet(`<h3>${esc(t("ob_name"))}</h3><div class="sub">${esc(t("greeting"))}</div>
    <div class="field"><label>${esc(t("ob_name"))}</label><input class="inp" id="pName" value="${esc(p.name)}" placeholder="${esc(t("ob_name_ph"))}"></div>
    <div class="field"><label>${esc(t("ob_place"))}</label><input class="inp" id="pPlace" value="${esc(p.place)}" placeholder="${esc(t("ob_place_ph"))}"></div>
    <div class="field"><label>${esc(t("ob_goal"))}</label><input class="inp" id="pGoal" type="number" inputmode="numeric" value="${p.goal}"></div>
    <button class="btn accent block" id="pSave">${esc(t("save"))}</button>`, () => {
    $("#pSave").onclick = () => {
      Store.profile({ name: $("#pName").value.trim(), place: $("#pPlace").value.trim(),
        goal: Math.max(1, Number($("#pGoal").value) || 108) });
      UI.closeSheet(); render(tab); UI.toast(t("updated_ok"), "good");
    };
  });
}

function remindersSheet() {
  const list = Store.db.reminders;
  UI.sheet(`<h3>${esc(t("rem_title"))}</h3><div class="sub">${esc(t("rem_sub"))}</div>
    ${list.map((r, i) => `<div class="card mb12">
      <div class="between">
        <b class="small">${esc(t(r.titleKey))}</b>
        <div class="switch ${r.enabled ? "on" : ""}" data-rem="${i}"></div>
      </div>
      <div class="field mt14" style="margin-bottom:0"><label>${esc(t("rem_time"))}</label>
        <input class="inp" type="time" data-remtime="${i}" value="${String(r.hour).padStart(2,"0")}:${String(r.minute).padStart(2,"0")}"></div>
    </div>`).join("")}
    ${!Bridge.notifAllowed() ? `<div class="card" style="background:var(--warn-soft);border-color:transparent">
      <div class="small" style="color:var(--warn)">${esc(t("rem_need_perm"))}</div>
      <button class="btn sm ghost block mt10" id="remPerm">${esc(t("p_grant"))}</button></div>` : ""}
    <button class="btn accent block mt14" id="remSave">${esc(t("save"))}</button>`, () => {
    $$("[data-rem]").forEach(sw => sw.onclick = () => sw.classList.toggle("on"));
    const rp = $("#remPerm");
    if (rp) rp.onclick = async () => { await Bridge.requestPerms(["notifications"]); UI.forceCloseSheet(); remindersSheet(); };
    $("#remSave").onclick = async () => {
      if (!Bridge.notifAllowed()) await Bridge.requestPerms(["notifications"]);
      const out = list.map((r, i) => {
        const v = ($(`[data-remtime="${i}"]`).value || "20:00").split(":");
        return { id: r.id, titleKey: r.titleKey, hour: Number(v[0]) || 0, minute: Number(v[1]) || 0,
          enabled: $(`[data-rem="${i}"]`).classList.contains("on"),
          title: t("notif_rem_title"), body: t("notif_rem_body"), tab: "jaap" };
      });
      Store.reminders(out);
      Bridge.scheduleReminders(out);
      if (Bridge.isNative && !Bridge.exactAlarms()) Bridge.openAlarmSettings();
      UI.forceCloseSheet(); renderMore(); UI.toast(t("rem_saved"), "good");
    };
  });
}

function scheduleEventReminders() {
  const base = Store.db.reminders.map(r => Object.assign({}, r, {
    title: t("notif_rem_title"), body: t("notif_rem_body"), tab: "jaap" }));
  const evs = Store.db.events.filter(e => e.remind && e.date >= Store.today()).slice(0, 12).map((e, i) => ({
    id: 100 + i, hour: 19, minute: 0, enabled: true, tab: "bhandara",
    title: t("notif_ev_title", { t: e.title }),
    body: t("notif_ev_body", { v: e.venue || "", d: fmtDateFull(e.date) })
  }));
  Bridge.scheduleReminders(base.concat(evs));
}

function vaultSheet() {
  const s = Store.stats || {};
  const kb = (n) => Updater.fmtBytes(n || 0);
  UI.sheet(`<h3>${esc(t("v_title"))}</h3><div class="sub">${esc(t("v_sub"))}</div>
    <div class="card" style="background:var(--good-soft);border-color:transparent">
      <div class="flex gap10"><span style="color:var(--good)">${icon("shield")}</span>
        <b class="small" style="color:var(--good)">${esc(t("v_integrity_ok"))}</b></div>
      <div class="xs mt10" style="color:var(--good);opacity:.9;line-height:1.6">${esc(t("v_note"))}</div>
    </div>
    <div class="ver-grid mt14">
      <div class="ver-box"><div class="k">${esc(t("v_raw"))}</div><div class="v">${kb(s.raw)}</div></div>
      <div class="ver-box"><div class="k">${esc(t("v_packed"))}</div><div class="v">${kb(s.packed)}</div></div>
    </div>
    <div class="card mt14">
      ${[[t("v_algo"), t("v_algo_v")], [t("v_key"), t("v_key_v")], [t("v_compress"), t("v_compress_v")],
         [t("v_saved"), (s.ratio || 0) + "%"], [t("v_entries"), Store.db.entries.length]]
        .map(([k, v]) => `<div class="between" style="padding:7px 0"><span class="small muted">${esc(k)}</span><b class="small">${esc(v)}</b></div>`).join("")}
    </div>
    <div class="card mt14" style="padding:0">
      <div class="setting">
        <div class="tile">${icon("lock")}</div>
        <div class="main"><div class="t">${esc(t("v_lock"))}</div><div class="s">${esc(t("v_lock_sub"))}</div></div>
        <div class="switch ${Store.hasPin() ? "on" : ""}" id="vLock"></div>
      </div>
    </div>
    <button class="btn ghost block mt14" id="vBackup">${esc(t("backup"))}</button>`, () => {
    $("#vLock").onclick = () => {
      if (Store.hasPin()) {
        UI.confirm(t("v_removepin"), "", t("v_removepin"), () => {
          Store.removePin(); UI.forceCloseSheet(); UI.toast(t("v_pinremoved"));
        }, true);
      } else pinSetup(() => { UI.forceCloseSheet(); vaultSheet(); });
    };
    $("#vBackup").onclick = () => { UI.forceCloseSheet(); setTimeout(backupSheet, 220); };
  });
}

function pinSetup(done) {
  let first = "";
  UI.modal(`<h3>${esc(t("v_setpin"))}</h3><div class="sub" id="pinSub">${esc(t("v_newpin"))}</div>
    <div class="pin-dots" id="pinDots">${"<i></i>".repeat(6)}</div>
    <div class="keypad" id="pinPad">${[1,2,3,4,5,6,7,8,9].map(n => `<button data-k="${n}">${n}</button>`).join("")}
      <button class="fn" data-k="cancel">${esc(t("cancel"))}</button>
      <button data-k="0">0</button><button class="fn" data-k="del">⌫</button></div>`, () => {
    let val = "";
    const paint = () => $$("#pinDots i").forEach((d, i) => d.classList.toggle("on", i < val.length));
    $$("#pinPad button").forEach(b => b.onclick = async () => {
      const k = b.dataset.k;
      if (k === "cancel") { UI.closeModal(); return; }
      if (k === "del") { val = val.slice(0, -1); paint(); return; }
      if (val.length >= 6) return;
      val += k; paint(); Bridge.vibrate(8);
      if (val.length >= 4) {
        if (!first) {
          setTimeout(() => { first = val; val = ""; paint(); $("#pinSub").textContent = t("v_confirmpin"); }, 200);
        } else if (val === first) {
          await Store.setPin(val); UI.closeModal(); UI.toast(t("v_pinset"), "good"); done && done();
        } else if (val.length >= first.length) {
          val = ""; paint(); UI.toast(t("v_pinmismatch"), "bad");
        }
      }
    });
    // allow finishing a 4/5-digit PIN by tapping the check on second entry
    const pad = $("#pinPad");
    const ok = document.createElement("button");
    ok.className = "btn accent block mt18"; ok.textContent = t("confirm");
    ok.onclick = async () => {
      if (val.length < 4) return;
      if (!first) { first = val; val = ""; paint(); $("#pinSub").textContent = t("v_confirmpin"); }
      else if (val === first) { await Store.setPin(val); UI.closeModal(); UI.toast(t("v_pinset"), "good"); done && done(); }
      else { val = ""; paint(); UI.toast(t("v_pinmismatch"), "bad"); }
    };
    pad.parentNode.appendChild(ok);
  });
}

function lockScreen() {
  let val = "";
  const paint = () => $$("#lockDots i").forEach((d, i) => d.classList.toggle("on", i < val.length));
  UI.modal(`<div class="center">
      <div class="sp-mark" style="width:66px;height:66px;border-radius:20px;margin:0 auto 16px">
        <img src="img/glyph.png" style="width:42px;height:42px"></div>
      <h3>${esc(t("v_enterpin"))}</h3><div class="sub">${esc(t("app_name"))}</div></div>
    <div class="pin-dots" id="lockDots">${"<i></i>".repeat(6)}</div>
    <div class="keypad" id="lockPad">${[1,2,3,4,5,6,7,8,9].map(n => `<button data-k="${n}">${n}</button>`).join("")}
      <button class="fn" data-k="none"></button><button data-k="0">0</button>
      <button class="fn" data-k="del">⌫</button></div>
    <button class="btn accent block mt18" id="lockGo">${esc(t("v_unlock"))}</button>`, () => {
    const tryUnlock = async () => {
      if (await Store.checkPin(val)) { UI.closeModal(); $("#scrim").classList.remove("on"); revealApp(); }
      else { val = ""; paint(); UI.toast(t("v_wrongpin"), "bad"); Bridge.vibrate(80); }
    };
    $$("#lockPad button").forEach(b => b.onclick = async () => {
      const k = b.dataset.k;
      if (k === "del") { val = val.slice(0, -1); paint(); return; }
      if (k === "none" || val.length >= 6) return;
      val += k; paint(); Bridge.vibrate(8);
      if (val.length === 6) tryUnlock();
    });
    $("#lockGo").onclick = tryUnlock;
  });
}

function backupSheet() {
  UI.sheet(`<h3>${esc(t("b_title"))}</h3><div class="sub">${esc(t("b_export_sub"))}</div>
    <div class="card">
      <b class="small">${esc(t("b_export"))}</b>
      <div class="field mt14"><label>${esc(t("b_pin"))}</label>
        <input class="inp" id="bkPin" type="password" inputmode="numeric" placeholder="${esc(t("b_pin_ph"))}"></div>
      <button class="btn accent block" id="bkExp">${icon("down")}${esc(t("b_export"))}</button>
    </div>
    <div class="card mt14">
      <b class="small">${esc(t("b_import"))}</b>
      <div class="xs muted mt6">${esc(t("b_import_sub"))}</div>
      <button class="btn ghost block mt14" id="bkImp">${esc(t("b_import"))}</button>
    </div>`, () => {
    $("#bkExp").onclick = async () => {
      const pin = $("#bkPin").value.trim();
      if (pin.length < 4) { UI.toast(t("b_needpin"), "bad"); return; }
      const blob = await Store.backupBlob(pin);
      const name = "satlok-seva-" + Store.today() + ".ssvb";
      Bridge.onSaf(4102, (ok, msg) => {
        if (ok) UI.toast(t("b_exported") + " · " + Updater.fmtBytes(blob.size), "good");
        else if (msg !== "cancelled") UI.toast(String(msg), "bad");
      });
      const r = Bridge.exportBackup(blob.b64, name);
      if (!r.ok) UI.toast(r.error || t("error"), "bad");
    };
    $("#bkImp").onclick = () => {
      UI.modal(`<h3>${esc(t("b_import"))}</h3><div class="sub">${esc(t("b_import_sub"))}</div>
        <div class="field"><label>${esc(t("b_pin"))}</label>
          <input class="inp" id="imPin" type="password" inputmode="numeric"></div>
        <div class="seg mb12" id="imMode"><button class="on" data-m="merge">${esc(t("b_merge"))}</button>
          <button data-m="replace">${esc(t("b_replace"))}</button></div>
        <button class="btn accent block" id="imPick">${esc(t("b_import"))}</button>
        <button class="btn ghost block mt10" id="imCancel">${esc(t("cancel"))}</button>`, () => {
        let mode = "merge";
        $$("#imMode button").forEach(b => b.onclick = () => {
          mode = b.dataset.m; $$("#imMode button").forEach(x => x.classList.toggle("on", x === b));
        });
        $("#imCancel").onclick = () => UI.closeModal();
        $("#imPick").onclick = () => {
          const pin = $("#imPin").value.trim();
          if (pin.length < 4) { UI.toast(t("b_needpin"), "bad"); return; }
          Bridge.onSaf(4103, async (ok, data) => {
            if (!ok) { if (data !== "cancelled") UI.toast(String(data), "bad"); return; }
            try {
              await Store.restoreBlob(data, pin, mode);
              UI.closeModal(); UI.forceCloseSheet(); UI.toast(t("b_imported"), "good");
              applyStatic(); render(tab);
            } catch (e) { UI.toast(t("b_badpin"), "bad"); }
          });
          Bridge.importBackup();
        };
      });
    };
  });
}

function permsSheet() {
  const rows = [
    { k: "notif", ico: "bell", ok: Bridge.notifAllowed(), act: async () => {
        const r = await Bridge.requestPerms(["notifications"]);
        if (r && r.granted === false) Bridge.openNotifSettings(); } },
    { k: "storage", ico: "image", ok: Bridge.hasPerm("photos") || Bridge.hasPerm("storage"), act: async () => {
        await Bridge.requestPerms(["photos", "storage"]); } },
    { k: "install", ico: "down", ok: Bridge.canInstall(), act: () => Bridge.openInstallSettings() },
    { k: "alarm", ico: "clock", ok: Bridge.exactAlarms(), act: () => Bridge.openAlarmSettings() }
  ];
  UI.sheet(`<h3>${esc(t("p_title"))}</h3><div class="sub">${esc(t("p_sub"))}</div>
    ${rows.map((r, i) => `<div class="card mb12">
      <div class="flex gap12">
        <div class="tile" style="width:38px;height:38px;border-radius:12px;display:grid;place-items:center;background:var(--bg-2)">${icon(r.ico)}</div>
        <div style="flex:1"><div class="t bold small">${esc(t("p_" + r.k))}</div>
          <div class="xs muted mt6">${esc(t("p_" + r.k + "_sub"))}</div></div>
        <span class="tag ${r.ok ? "good" : "warn"}">${esc(r.ok ? t("p_granted") : t("p_denied"))}</span>
      </div>
      ${!r.ok ? `<button class="btn soft sm block mt12" data-perm="${i}">${esc(t("p_grant"))}</button>` : ""}
    </div>`).join("")}
    <div class="card" style="background:var(--accent-soft);border-color:transparent">
      <div class="xs" style="color:var(--accent-ink);line-height:1.6">${esc(t("p_why"))}</div></div>`, () => {
    $$("[data-perm]").forEach(b => b.onclick = async () => {
      await rows[Number(b.dataset.perm)].act();
      UI.forceCloseSheet(); setTimeout(permsSheet, 400);
    });
  });
}

function aboutSheet() {
  const info = Bridge.info();
  UI.sheet(`<div class="center">
      <div class="sp-mark" style="width:76px;height:76px;border-radius:23px;margin:0 auto 14px">
        <img src="img/glyph.png" style="width:48px;height:48px"></div>
      <h3>${esc(t("app_name"))}</h3><div class="sub">${esc(t("app_for"))}</div></div>
    <div class="ver-grid">
      <div class="ver-box"><div class="k">${esc(t("a_version"))}</div><div class="v">${esc(info.webVersion)}</div></div>
      <div class="ver-box"><div class="k">${esc(t("a_built"))}</div><div class="v">${esc(info.webBuild)}</div></div>
    </div>
    <div class="card mt14"><div class="small" style="line-height:1.7">${esc(t("a_purpose"))}</div></div>
    <div class="card mt14" style="background:var(--good-soft);border-color:transparent">
      <div class="flex gap10"><span style="color:var(--good)">${icon("shield")}</span>
        <b class="small" style="color:var(--good)">${esc(t("a_nodata"))}</b></div>
      <div class="xs mt10" style="color:var(--good);opacity:.9;line-height:1.6">${esc(t("a_nodata_sub"))}</div>
    </div>
    <div class="card mt14">
      <div class="between" style="padding:5px 0"><span class="small muted">${esc(t("up_shell"))}</span><b class="small">${esc(info.shellName)} (${esc(info.shellCode)})</b></div>
      <div class="between" style="padding:5px 0"><span class="small muted">Android</span><b class="small">${esc(info.release)} · API ${esc(info.sdk)}</b></div>
      <div class="between" style="padding:5px 0"><span class="small muted">${esc(t("a_offline"))}</span><b class="small">✓</b></div>
    </div>
    <button class="btn ghost block mt14" id="abShare">${icon("share")}${esc(t("a_rate"))}</button>
    <div class="center xs muted mt18">${esc(t("a_credit"))}</div>`, () => {
    $("#abShare").onclick = () => Bridge.shareText(t("app_name") + " — " + t("app_for") + "\n" + Updater.url().replace("/ota/manifest.json", "/"));
  });
}

/* ---------- onboarding --------------------------------------------------- */
function onboarding(done) {
  UI.sheet(`<div class="center">
      <div class="sp-mark" style="width:74px;height:74px;border-radius:22px;margin:0 auto 14px">
        <img src="img/glyph.png" style="width:46px;height:46px"></div>
      <h3>${esc(t("onboard_hi"))}</h3><div class="sub">${esc(t("onboard_sub"))}</div></div>
    <div class="field"><label>${esc(t("ob_lang"))}</label>
      <div class="chips wrap" style="padding:0" id="obLang">${Lang.available.map(c =>
        `<button class="chip ${Lang.code === c ? "on" : ""}" data-l="${c}">${esc(window.I18N[c]._name)}</button>`).join("")}</div></div>
    <div class="field"><label>${esc(t("ob_name"))}</label>
      <input class="inp" id="obName" placeholder="${esc(t("ob_name_ph"))}"></div>
    <div class="field"><label>${esc(t("ob_place"))}</label>
      <input class="inp" id="obPlace" placeholder="${esc(t("ob_place_ph"))}"></div>
    <div class="field"><label>${esc(t("ob_goal"))}</label>
      <div class="chips wrap" style="padding:0" id="obGoal">
        ${[108, 216, 540, 1080].map((g, i) => `<button class="chip ${i === 0 ? "on" : ""}" data-g="${g}">${g}</button>`).join("")}</div></div>
    <button class="btn accent block mt10" id="obGo">${esc(t("ob_start"))}</button>
    <button class="btn ghost block mt10" id="obSkip">${esc(t("ob_skip"))}</button>`, () => {
    let goal = 108;
    $$("#obLang .chip").forEach(b => b.onclick = () => {
      Lang.set(b.dataset.l);
      $$("#obLang .chip").forEach(x => x.classList.toggle("on", x === b));
      onboardingRefresh();
    });
    $$("#obGoal .chip").forEach(b => b.onclick = () => {
      goal = Number(b.dataset.g);
      $$("#obGoal .chip").forEach(x => x.classList.toggle("on", x === b));
    });
    $("#obGo").onclick = async () => {
      Store.profile({ name: $("#obName").value.trim(), place: $("#obPlace").value.trim(), goal, onboarded: true });
      UI.forceCloseSheet();
      if (!Bridge.notifAllowed()) await Bridge.requestPerms(["notifications"]);
      UI.toast(t("welcome", { n: Store.db.profile.name || t("greeting") }), "good");
      done && done();
    };
    $("#obSkip").onclick = () => { Store.profile({ onboarded: true }); UI.forceCloseSheet(); done && done(); };
  }, true);
}
function onboardingRefresh() {
  const map = { ob_lang: "ob_lang", ob_name: "ob_name", ob_place: "ob_place", ob_goal: "ob_goal" };
  $$("label").forEach(l => {});
  const labels = $$("#sheetBody .field label");
  const keys = ["ob_lang", "ob_name", "ob_place", "ob_goal"];
  labels.forEach((l, i) => { if (keys[i]) l.textContent = t(keys[i]); });
  $("#obName").placeholder = t("ob_name_ph");
  $("#obPlace").placeholder = t("ob_place_ph");
  $("#obGo").textContent = t("ob_start");
  $("#obSkip").textContent = t("ob_skip");
  $("#sheetBody h3").textContent = t("onboard_hi");
  $("#sheetBody .sub").textContent = t("onboard_sub");
}

/* ---------- theme + static text ------------------------------------------ */
function applyTheme() {
  const mode = Store.db.settings.theme || "auto";
  const dark = mode === "dark" || (mode === "auto" &&
    window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? "#121014" : "#FBF8F5");
  Bridge.setTheme(dark);
}

function applyStatic() {
  document.title = t("app_name");
  const spTag = $("#spTag"); if (spTag) spTag.textContent = t("splash_tag");
  const spName = $(".sp-name"); if (spName) spName.textContent = t("app_name");
  const hero = $("#homeHero"); if (hero) hero.querySelector("img").src = "img/hero_seva.jpg";
  render(tab);
}

function render(name) {
  if (name === "home") renderHome();
  else if (name === "seva") renderSeva();
  else if (name === "jaap") renderJaap();
  else if (name === "bhandara") renderBhandara();
  else if (name === "stats") renderStats();
  else if (name === "more") renderMore();
}

/* ---------- boot --------------------------------------------------------- */
let revealed = false;
function revealApp() {
  if (revealed) return;
  revealed = true;
  $("#app").hidden = false;
  go("home", false);
  const sp = $("#splash");
  sp.classList.add("gone");
  setTimeout(() => sp.remove(), 620);
  Bridge.bootOk();
  if (!Store.db.profile.onboarded) setTimeout(() => onboarding(() => { applyStatic(); }), 900);
  Updater.boot();
  scheduleEventReminders();
}

let booted = false;
function boot() {
  if (booted) return; booted = true;
  Lang.load();
  Store.load();
  applyTheme();
  const info = Bridge.info();
  const setTxt = (sel, v) => { const el = $(sel); if (el) el.textContent = v; };
  setTxt("#spVer", "v" + info.webVersion);
  setTxt("#spTag", t("splash_tag"));
  setTxt(".sp-name", t("app_name"));
  const foot = $(".sp-foot"); if (foot) foot.innerHTML = esc(t("app_for")) + "<br><span id='spVer'>v" + esc(info.webVersion) + "</span>";
  applyStatic();

  Updater.onChange(() => { if (tab === "home") renderHome(); if (tab === "more") renderMore(); });
  if (window.matchMedia) {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    if (mq.addEventListener) mq.addEventListener("change", () => { if (Store.db.settings.theme === "auto") applyTheme(); });
  }

  const minSplash = 1250;
  const start = Date.now();
  setTimeout(() => {
    if (Store.hasPin()) { $("#app").hidden = false; go("home", false); lockScreen();
      const sp = $("#splash"); sp.classList.add("gone"); setTimeout(() => sp.remove(), 620); Bridge.bootOk(); }
    else revealApp();
  }, Math.max(0, minSplash - (Date.now() - start)));
}

$("#btnUpd").onclick = () => Updater.versionSheet();
$("#btnProfile").onclick = () => profileSheet();
$("#btnQuickJaap").onclick = () => go("jaap");
$("#heroShare").onclick = (e) => {
  e.stopPropagation();
  const tot = Store.totals(Store.db.entries.filter(x => x.date === Store.today()));
  Bridge.shareText(`॥ ${t("greeting")} ॥\n${t("today_seva")}: ${tot.count} ${t("stat_sevas")}\n${t("stat_jaap")}: ${tot.jaap}\n— ${t("app_name")}`);
};

document.addEventListener("DOMContentLoaded", boot);
if (document.readyState !== "loading") boot();

})();
