/* ============ Screens: more/settings + update flow UI ============ */
(function (g) {
  var el = UI.el, t = UI.t, $ = UI.$;

  function setItem(icon, title, sub, valOrNode, onclick) {
    var it = el("div", { class: "set-item" });
    var icw = el("div", { class: "si-ic" }); icw.appendChild(IC.el(icon, 20)); it.appendChild(icw);
    it.appendChild(el("div", { class: "si-tx" }, [el("b", { text: title }), sub ? el("span", { text: sub }) : null]));
    if (typeof valOrNode === "string") it.appendChild(el("div", { class: "si-val", text: valOrNode }));
    else if (valOrNode) it.appendChild(valOrNode);
    if (onclick) it.addEventListener("click", onclick);
    it.style.cursor = onclick ? "pointer" : "default";
    return it;
  }
  function toggle(on, cb) {
    var s = el("div", { class: "switch" + (on ? " on" : "") }); s.appendChild(el("i"));
    s.addEventListener("click", function (e) {
      e.stopPropagation();
      var now = !s.classList.contains("on");
      s.classList.toggle("on", now); cb(now);
    });
    return s;
  }

  function renderMore(page) {
    page.innerHTML = "";
    var S = Store.settings();
    var info = Bridge.info();

    page.appendChild(el("h3", { style: "margin:6px 2px 10px", text: t("settings") }));

    /* language */
    var langCard = el("div", { class: "card" });
    langCard.appendChild(el("h3", {}, [document.createTextNode(t("language"))]));
    var lr = el("div", { class: "chip-row", style: "margin:0;padding-left:0" });
    I18N.langs.forEach(function (L) {
      var c = el("button", { class: "chip" + (I18N.getLang() === L.id ? " on" : ""), text: L.label });
      c.addEventListener("click", function () {
        S.lang = L.id; I18N.setLang(L.id); Bridge.prefsSet("lang", L.id); Store.save(); App.refresh(); App.applyI18n();
      });
      lr.appendChild(c);
    });
    langCard.appendChild(lr);
    page.appendChild(langCard);

    /* theme + reminder + notif */
    var c1 = el("div", { class: "card" });
    c1.appendChild(el("h3", {}, [document.createTextNode(t("theme"))]));
    var tr = el("div", { class: "chip-row", style: "margin:0;padding-left:0;margin-bottom:6px" });
    [["light", t("theme_light")], ["dark", t("theme_dark")], ["system", t("theme_sys")]].forEach(function (x) {
      var c = el("button", { class: "chip" + (S.theme === x[0] ? " on" : ""), text: x[1] });
      c.addEventListener("click", function () { S.theme = x[0]; Bridge.prefsSet("theme", x[0]); Store.save(); App.applyTheme(); App.refresh(); });
      tr.appendChild(c);
    });
    c1.appendChild(tr);
    c1.appendChild(setItem("clock", t("reminder"), t("reminder_sub"), toggle(S.reminder.on, function (on) {
      S.reminder.on = on; Store.save();
      if (on) {
        Bridge.requestNotif(function () {
          Bridge.scheduleReminder("daily", t("app_name"), t("reminder_notif"), S.reminder.h, S.reminder.m, true);
          UI.toast(t("reminder_set"));
        });
      } else { Bridge.cancelReminder("daily"); UI.toast(t("reminder_off")); }
    })));
    c1.appendChild(setItem("bell", t("notif_perm"), "", el("span", { class: "si-val", text: Bridge.notifPermission() === "granted" ? t("notif_granted") : t("notif_denied") }), function () {
      Bridge.requestNotif(function () { App.refresh(); });
    }));
    c1.appendChild(setItem("clock", t("reminder") + " — " + t("time"), "", ("0" + S.reminder.h).slice(-2) + ":" + ("0" + S.reminder.m).slice(-2), function () {
      UI.sheet(t("reminder"), function (body, close) {
        var ti = el("input", { type: "time", value: ("0" + S.reminder.h).slice(-2) + ":" + ("0" + S.reminder.m).slice(-2) });
        body.appendChild(ti);
        body.appendChild(el("div", { class: "modal-actions" }, [
          el("button", { class: "btn btn-ghost", text: t("cancel"), onclick: close }),
          el("button", { class: "btn btn-primary", text: t("save"), onclick: function () {
            var p = ti.value.split(":"); S.reminder.h = +p[0]; S.reminder.m = +p[1]; Store.save();
            if (S.reminder.on) Bridge.scheduleReminder("daily", t("app_name"), t("reminder_notif"), S.reminder.h, S.reminder.m, true);
            close(); App.refresh();
          } })
        ]));
      });
    }));
    page.appendChild(c1);

    /* security */
    var c2 = el("div", { class: "card" });
    c2.appendChild(el("h3", {}, [document.createTextNode(t("security"))]));
    c2.appendChild(el("div", { class: "pill-note", style: "margin-bottom:8px" }, [IC.el("shield", 14), document.createTextNode(t("encrypted_note"))]));
    c2.appendChild(setItem("lock", t("app_lock"), t("app_lock_sub"), Store.hasPin() ? "••••" : "—", function () { pinFlow(); }));
    c2.appendChild(setItem("save", t("backup"), t("export_fmt"), "", function () {
      Bridge.exportBackup(Store.exportBlob(), function (p) { UI.toast(p.ok ? t("backup_done") : t("upd_fail")); });
    }));
    c2.appendChild(setItem("history", t("restore"), "", "", function () {
      Bridge.importBackup(function (p) {
        if (p.ok && p.b64) { if (Store.importBlob(p.b64)) { UI.toast(t("restore_done")); App.refresh(); } else UI.toast(t("upd_fail")); }
        else UI.toast(t("upd_fail"));
      });
    }));
    c2.appendChild(setItem("trash", t("wipe"), "", "", function () {
      UI.confirm(t("wipe"), t("wipe_q"), function () { Store.wipe(); App.refresh(); UI.toast(t("deleted")); }, t("yes"), true);
    }));
    page.appendChild(c2);

    /* updates */
    var c3 = el("div", { class: "card" });
    c3.appendChild(el("h3", {}, [document.createTextNode(t("updates")), el("span", { class: "ver-badge", text: "v" + info.versionName })]));
    c3.appendChild(setItem("download", t("check_update"), Updater.state.manifest ? t("version") + " " + Updater.state.manifest.version : "", Updater.hasUpdate() ? t("update_avail") : t("up_to_date"), function () {
      App.showUpdateScreen(false);
    }));
    var log = Store.db().updateLog;
    if (log.length) {
      c3.appendChild(el("div", { class: "divider" }));
      log.slice(0, 5).forEach(function (l) {
        c3.appendChild(el("div", { class: "tiny", style: "padding:3px 0", text: "• v" + l.version + " · " + l.files + " " + t("upd_files") + " · " + new Date(l.ts).toLocaleDateString() }));
      });
    }
    page.appendChild(c3);

    /* about */
    var c4 = el("div", { class: "card" });
    c4.appendChild(el("div", { class: "row", style: "gap:14px" }, [
      (function () { var im = el("img", { src: "img/logo.png", style: "width:56px;height:56px;border-radius:50%;box-shadow:var(--shadow-sm)" }); return im; })(),
      el("div", {}, [
        el("b", { style: "font-size:16px", text: t("app_name") }),
        el("div", { class: "tiny", text: t("app_tag") }),
        el("div", { class: "tiny", style: "margin-top:4px", text: t("shell_ver") + " " + info.versionCode + " · " + info.packageName })
      ])
    ]));
    c4.appendChild(el("div", { class: "divider" }));
    c4.appendChild(el("div", { class: "tiny", style: "text-align:center", text: t("made_with") + " · " + t("community") }));
    page.appendChild(c4);
  }

  function pinFlow() {
    var has = Store.hasPin();
    UI.sheet(has ? t("change_pin") : t("set_pin"), function (body, close) {
      var grid = el("div", { class: "form-grid" });
      var oldIn = null;
      if (has) { oldIn = UI.input({ type: "password", inputmode: "numeric", maxlength: "4", placeholder: t("lock_sub") }); grid.appendChild(UI.field(t("lock_title"), oldIn)); }
      var p1 = UI.input({ type: "password", inputmode: "numeric", maxlength: "4", placeholder: t("new_pin") });
      var p2 = UI.input({ type: "password", inputmode: "numeric", maxlength: "4", placeholder: t("confirm_pin") });
      grid.appendChild(UI.field(t("new_pin"), p1));
      grid.appendChild(UI.field(t("confirm_pin"), p2));
      body.appendChild(grid);
      if (has) body.appendChild(el("button", { class: "link-btn", style: "align-self:flex-start;margin-top:10px", text: t("remove_pin"), onclick: function () {
        Store.removePin(); close(); UI.toast(t("pin_removed")); App.refresh();
      } }));
      body.appendChild(el("div", { class: "modal-actions" }, [
        el("button", { class: "btn btn-ghost", text: t("cancel"), onclick: close }),
        el("button", { class: "btn btn-primary", text: t("save"), onclick: function () {
          if (has && !Store.checkPin(oldIn.value)) { UI.toast(t("lock_wrong")); return; }
          if (!/^\d{4}$/.test(p1.value) || p1.value !== p2.value) { UI.toast(t("pin_mismatch")); return; }
          Store.setPin(p1.value); close(); UI.toast(t("pin_set")); App.refresh();
        } })
      ]));
    });
  }

  /* ---------- update required screen ---------- */
  function showUpdate(force) {
    var scr = $("#updateScreen"), m = Updater.state.manifest || {};
    scr.classList.remove("hidden");
    $("#updateVer").textContent = t("version") + " " + (m.version || "?") + " · " + Updater.state.diff.length + " " + t("upd_files") + " · " + UI.fmtBytes(Updater.diffSize());
    var cl = $("#updateChangelog");
    cl.textContent = (m.changelog || []).map(function (x) { return "• " + x; }).join("\n") || t("only_changed");
    $("#updateLaterBtn").classList.toggle("hidden", !!force || Updater.state.apkRequired);
    var bar = $("#updateBar"), st = $("#updateStatus"), fl = $("#updateFiles");
    fl.innerHTML = "";
    st.textContent = t("only_changed");
    $("#updateNowBtn").onclick = function () {
      if (Updater.state.apkRequired && !Updater.state.diff.length) { apkFlow(); return; }
      $("#updateNowBtn").disabled = true;
      Updater.apply({
        file: function (item, d, tot) { st.textContent = t("upd_downloading") + " " + (d + 1) + "/" + tot + " — " + item.path; },
        prog: function (item, d, tot) { bar.style.width = Math.round(d / Math.max(1, tot) * 100) + "%"; },
        after: function (item, d, tot) {
          bar.style.width = Math.round(d / tot * 100) + "%";
          fl.appendChild(el("div", {}, [IC.el("check", 12), document.createTextNode(" " + item.path + " (" + UI.fmtBytes(item.size) + ")")]));
        },
        done: function () { st.textContent = t("upd_done"); bar.style.width = "100%"; },
        fail: function (f) { st.textContent = t("upd_fail") + " (" + f + ")"; $("#updateNowBtn").disabled = false; }
      });
    };
    if (Updater.state.apkRequired) {
      st.textContent = t("upd_apk_sub");
      $("#updateNowBtn").innerHTML = IC.html("download", 18) + t("upd_install");
    }
    function apkFlow() {
      st.textContent = t("upd_downloading") + "…";
      Updater.downloadApk({
        prog: function (d, tot) { bar.style.width = Math.round(d / Math.max(1, tot) * 100) + "%"; st.textContent = t("upd_downloading") + " " + UI.fmtBytes(d) + " / " + UI.fmtBytes(tot); },
        done: function (name) { st.textContent = t("upd_install") + "…"; Updater.installApk(name); },
        fail: function () { st.textContent = t("upd_fail"); }
      });
    }
  }
  function hideUpdate() { $("#updateScreen").classList.add("hidden"); }

  g.Screens2 = { renderMore: renderMore, showUpdate: showUpdate, hideUpdate: hideUpdate };
})(window);
