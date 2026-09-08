/* ============ App bootstrap: splash → lock → shell, routing, OTA boot check ============ */
(function (g) {
  var el = UI.el, t = UI.t, $ = UI.$;
  var current = "home";
  var ctaWrap = null;

  function applyTheme() {
    var th = Store.settings().theme || "system";
    var dark = th === "dark" || (th === "system" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = dark ? "#161009" : "#FAF6F0";
    $("#themeBtn").textContent = dark ? "☀️" : "🌙";
    if (Bridge.setStatusBar) Bridge.setStatusBar(!dark);
  }
  function applyI18n() {
    document.documentElement.lang = I18N.getLang();
    I18N.applyDom(document);
    $("#tbTitle").textContent = t("app_name");
    $("#tbSub").textContent = t("app_tag");
    $("#langPill").textContent = { hi: "हि", en: "EN", pa: "ਪੰ" }[I18N.getLang()];
    renderCurrent();
  }

  function setCta(label, fn) {
    if (!ctaWrap) {
      ctaWrap = el("div", { class: "fab-cta" });
      document.body.appendChild(ctaWrap);
    }
    ctaWrap.innerHTML = "";
    var b = el("button", { class: "btn btn-primary", text: "＋ " + label, onclick: fn });
    ctaWrap.appendChild(b);
  }
  function hideCta() { if (ctaWrap) ctaWrap.innerHTML = ""; }

  function go(page) {
    current = page;
    UI.$$(".nb-item").forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-nav") === page); });
    UI.$$(".page").forEach(function (p) { p.classList.toggle("on", p.getAttribute("data-page") === page); });
    renderCurrent();
    $("#pages").scrollTop = 0;
  }
  function renderCurrent() { renderPage(current); }
  function renderPage(page) {
    var sec = $('.page[data-page="' + page + '"]');
    hideCta();
    if (page === "home") Screens.renderHome(sec);
    else if (page === "seva") Screens.renderSeva(sec);
    else if (page === "bhandara") Screens.renderBhandara(sec);
    else if (page === "stats") Screens.renderStats(sec);
    else if (page === "more") Screens2.renderMore(sec);
  }
  function refresh() { renderCurrent(); }
  function refreshSoft() { renderCurrent(); }

  /* ---------- PIN pad ---------- */
  function showLock(onSuccess) {
    var ls = $("#lockscreen"); ls.classList.remove("hidden");
    var pin = "";
    var dots = UI.$$("#pinDots b");
    var pad = $("#pinPad"); pad.innerHTML = "";
    function draw() { dots.forEach(function (d, i) { d.classList.toggle("on", i < pin.length); }); }
    function push(ch) {
      if (pin.length >= 4) return;
      pin += ch; draw(); Bridge.vibrate(15);
      if (pin.length === 4) {
        setTimeout(function () {
          if (Store.checkPin(pin)) { ls.classList.add("hidden"); onSuccess && onSuccess(); }
          else {
            $("#pinDots").classList.add("err"); UI.toast(t("lock_wrong"));
            setTimeout(function () { pin = ""; draw(); $("#pinDots").classList.remove("err"); }, 450);
          }
        }, 120);
      }
    }
    ["1", "2", "3", "4", "5", "6", "7", "8", "9"].forEach(function (n) {
      pad.appendChild(el("button", { text: n, onclick: function () { push(n); } }));
    });
    pad.appendChild(el("button", { text: "⌫", onclick: function () { pin = pin.slice(0, -1); draw(); } }));
    pad.appendChild(el("button", { text: "0", onclick: function () { push("0"); } }));
    pad.appendChild(el("button", { text: "✔", onclick: function () {} }));
    $("#lockForgot").classList.remove("hidden");
    $("#lockForgot").onclick = function () {
      UI.confirm(t("lock_forgot"), t("wipe_q"), function () { Store.removePin(); Store.wipe(); ls.classList.add("hidden"); onSuccess && onSuccess(); }, t("yes"), true);
    };
    draw();
  }

  /* ---------- notice banner ---------- */
  function showNotice(n) {
    if (!n || !n.title) return;
    var seen = Bridge.prefsGet("noticeSeen", "");
    if (seen === String(n.ts)) return;
    $("#nbTitle").textContent = n.title; $("#nbBody").textContent = n.body || "";
    $("#noticeBanner").classList.remove("hidden");
    $("#nbClose").onclick = function () { Bridge.prefsSet("noticeSeen", String(n.ts)); $("#noticeBanner").classList.add("hidden"); };
    Bridge.postNotification(n.title, n.body || "", "events");
  }

  /* ---------- boot ---------- */
  function boot() {
    var info = Bridge.info();
    var lang = Bridge.prefsGet("lang", "");
    I18N.setLang(lang || "hi");
    Store.load();
    if (!lang) { Bridge.prefsSet("lang", Store.settings().lang || "hi"); I18N.setLang(Store.settings().lang || "hi"); }
    else { I18N.setLang(lang); Store.settings().lang = lang; }
    var th = Bridge.prefsGet("theme", "");
    if (th) Store.settings().theme = th;
    applyTheme();

    /* nav wiring */
    UI.$$(".nb-item").forEach(function (b) {
      b.addEventListener("click", function () {
        var nav = b.getAttribute("data-nav");
        if (nav === "add") { Screens.openSevaForm(null, null); return; }
        go(nav);
      });
    });
    $("#themeBtn").addEventListener("click", function () {
      var s = Store.settings();
      s.theme = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      Bridge.prefsSet("theme", s.theme); Store.save(); applyTheme();
    });
    $("#langPill").addEventListener("click", function () {
      var order = ["hi", "en", "pa"];
      var next = order[(order.indexOf(I18N.getLang()) + 1) % order.length];
      Store.settings().lang = next; I18N.setLang(next); Bridge.prefsSet("lang", next); Store.save(); applyI18n();
    });
    $("#modalBack").addEventListener("click", UI.closeSheet);
    $("#updateLaterBtn").addEventListener("click", function () { Screens2.hideUpdate(); });

    var finish = function () {
      applyI18n();
      go("home");
      $("#app").classList.remove("hidden");
      setTimeout(function () {
        $("#splash").classList.add("out");
        setTimeout(function () { $("#splash").style.display = "none"; }, 600);
      }, 900);
      silentUpdateCheck();
    };

    if (Store.hasPin()) showLock(finish); else finish();
  }

  function silentUpdateCheck() {
    Updater.check(function (m, err) {
      if (!m) return;
      if (Updater.hasUpdate()) {
        Bridge.postNotification(t("update_notif"), (m.version || "") + " · " + Updater.state.diff.length + " " + t("upd_files"), "updates");
        showNotice({ title: t("update_avail"), body: m.version + " · " + Updater.state.diff.length + " " + t("upd_files"), ts: "upd" + m.versionCode });
        if (current === "home") renderCurrent();
        var force = !!m.forceWeb || Updater.state.apkRequired;
        if (force) App.showUpdateScreen(true);
      } else if (Updater.notice()) showNotice(Updater.notice());
    });
  }

  g.App = {
    go: go, refresh: refresh, refreshSoft: refreshSoft, setCta: setCta, hideCta: hideCta,
    applyTheme: applyTheme, applyI18n: applyI18n, boot: boot, showLock: showLock,
    showUpdateScreen: function (force) { Screens2.showUpdate(force); },
    renderCurrent: renderCurrent
  };

  document.addEventListener("DOMContentLoaded", function () { boot(); });
  document.addEventListener("backbutton", function (e) {
    if (!$("#modalRoot").classList.contains("hidden")) { UI.closeSheet(); return; }
    if (current !== "home") { go("home"); return; }
    Bridge.exitApp();
  }, false);
})(window);
