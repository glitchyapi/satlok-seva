/* ============ Screens: home / seva / bhandara / stats ============ */
(function (g) {
  var el = UI.el, t = UI.t, $ = UI.$;
  var TYPES = ["jaap", "satsang", "bhandara", "prachar", "daan", "padhna", "other"];
  var UNITS = { jaap: "mala", satsang: "ghanta", bhandara: "plate", prachar: "logo", daan: "rupye", padhna: "page", other: "any" };

  /* ---------------- HOME ---------------- */
  function renderHome(page) {
    page.innerHTML = "";
    var d = new Date(), h = d.getHours();
    var greet = h < 12 ? t("greet_morn") : h < 17 ? t("greet_noon") : h < 21 ? t("greet_eve") : t("greet_night");
    var todays = Store.sevasOn(Store.todayStr());
    var goal = 3;
    var pct = Math.min(100, Math.round(todays.length / goal * 100));
    var up = Store.upcoming();

    var hero = el("div", { class: "card hero" });
    hero.appendChild(el("div", { class: "h-top" }, [
      el("div", {}, [
        el("div", { class: "h-date", text: UI.fmtDate(Store.todayStr(), true) }),
        el("div", { class: "h-greet", text: greet })
      ]),
      (function () {
        var wrap = el("div", { class: "h-ring" });
        var r = 31, c = 2 * Math.PI * r;
        wrap.innerHTML = '<svg width="74" height="74"><circle cx="37" cy="37" r="' + r + '" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="7"/>' +
          '<circle cx="37" cy="37" r="' + r + '" fill="none" stroke="#F59E42" stroke-width="7" stroke-linecap="round" stroke-dasharray="' + c + '" stroke-dashoffset="' + (c - c * pct / 100) + '"/></svg>';
        wrap.appendChild(el("b", { text: pct + "%" }));
        return wrap;
      })()
    ]));
    var hs = el("div", { class: "h-stats" });
    [[String(todays.length), t("today_seva")], [String(Store.streak()), t("streak")], [String(Store.monthCount()), t("this_month")]].forEach(function (x) {
      hs.appendChild(el("div", { class: "h-stat" }, [el("b", { text: x[0] }), el("span", { text: x[1] })]));
    });
    hero.appendChild(hs);
    page.appendChild(hero);

    /* notice card (update available etc.) */
    if (Updater.hasUpdate()) {
      var nc = el("div", { class: "card", style: "border-left:4px solid var(--saffron);cursor:pointer" });
      nc.appendChild(el("div", { class: "row spread" }, [
        el("div", { class: "row" }, [
          el("span", { style: "font-size:20px", text: "⬇️" }),
          el("div", {}, [el("b", { text: t("update_avail"), style: "font-size:14px" }),
            el("div", { class: "tiny", text: (Updater.state.manifest ? Updater.state.manifest.version : "") + " · " + Updater.state.diff.length + " " + t("upd_files") + " · " + UI.fmtBytes(Updater.diffSize()) })])
        ]),
        el("span", { text: "›", style: "font-size:22px;color:var(--ink3)" })
      ]));
      nc.addEventListener("click", function () { App.showUpdateScreen(false); });
      page.appendChild(nc);
    }

    /* quick add */
    page.appendChild(el("div", { class: "card flat" }, [
      el("h3", {}, [document.createTextNode(t("quick_add"))]),
      (function () {
        var gr = el("div", { class: "qgrid" });
        TYPES.slice(0, 4).concat(["daan"]).forEach(function (ty) {});
        ["jaap", "satsang", "bhandara", "prachar"].forEach(function (ty) {
          gr.appendChild(el("button", { class: "qitem", onclick: function () { openSevaForm(null, ty); } }, [
            el("span", { text: UI.TYPE_ICON[ty] || "🙏" }), document.createTextNode(UI.sevLabel(ty))
          ]));
        });
        return gr;
      })()
    ]));

    /* next bhandara */
    if (up.length) {
      var b = up[0];
      var bc = el("div", { class: "card bh-card" });
      bc.appendChild(el("div", { class: "bh-strip" }));
      bc.appendChild(el("div", { class: "row spread" }, [
        el("div", {}, [el("div", { class: "bh-title", text: b.title }),
          el("div", { class: "tiny", text: (b.place || "") })]),
        el("span", { class: "tag", text: UI.fmtDate(b.date) })
      ]));
      var daysLeft = Math.max(0, Math.round((new Date(b.date) - new Date(Store.todayStr())) / 86400000));
      bc.appendChild(el("div", { class: "muted", style: "margin-top:6px", text: daysLeft + " " + t("days") + " · " + t("bhandara_next") }));
      page.appendChild(bc);
    }

    /* recent timeline */
    page.appendChild(el("div", { class: "card flat" }, [
      el("h3", {}, [document.createTextNode(t("recent")), el("span", { class: "h3x", text: t("view_all"), onclick: function () { App.go("seva"); } })]),
      recentTimeline()
    ]));

    /* floating CTA */
    App.setCta(t("add_seva"), function () { openSevaForm(null, null); });
  }

  function recentTimeline() {
    var wrap = el("div", { class: "tl" });
    var days = {};
    Store.db().sevas.slice(0, 40).forEach(function (s) { (days[s.date] = days[s.date] || []).push(s); });
    var keys = Object.keys(days).sort().reverse().slice(0, 4);
    if (!keys.length) {
      return el("div", { class: "empty" }, [el("span", { text: "🪷" }), el("p", { text: t("no_seva") }), el("p", { class: "tiny", text: t("no_seva_sub") })]);
    }
    keys.forEach(function (k, i) {
      var day = el("div", { class: "tl-day" + (i > 0 ? " past" : "") });
      day.appendChild(el("div", { class: "tl-head" }, [
        el("b", { text: k === Store.todayStr() ? t("today") : UI.fmtDate(k) }),
        el("span", { text: days[k].length + " " + t("entries") })
      ]));
      days[k].slice(0, 3).forEach(function (s) { day.appendChild(sevaRow(s)); });
      wrap.appendChild(day);
    });
    return wrap;
  }

  function sevaRow(s) {
    var row = el("div", { class: "seva-item", onclick: function () { openSevaForm(s); } });
    row.appendChild(el("div", { class: "seva-ico", text: UI.TYPE_ICON[s.type] || "🙏" }));
    row.appendChild(el("div", { class: "seva-main" }, [
      el("b", { text: UI.sevLabel(s.type) }),
      el("span", { text: s.note || UI.fmtDate(s.date) })
    ]));
    row.appendChild(el("div", { class: "seva-cnt" }, [
      el("b", { text: String(s.count) }),
      el("span", { text: UI.unitLabel(s.unit) })
    ]));
    return row;
  }

  /* ---------------- SEVA FORM ---------------- */
  function openSevaForm(existing, presetType) {
    var s = existing || { type: presetType || "jaap", count: 1, unit: UNITS[presetType || "jaap"], note: "", date: Store.todayStr() };
    UI.sheet(existing ? t("edit") : t("add_seva"), function (body, close) {
      var grid = el("div", { class: "form-grid" });
      var typeSel = UI.input({});
      var sel = el("select");
      TYPES.forEach(function (ty) {
        var o = el("option", { value: ty, text: UI.sevLabel(ty) }); if (ty === s.type) o.selected = true; sel.appendChild(o);
      });
      sel.addEventListener("change", function () { unitSel.value = UNITS[sel.value] || "any"; });
      grid.appendChild(UI.field(t("seva_type"), sel));
      var f2 = el("div", { class: "form-2" });
      var countIn = UI.input({ type: "number", inputmode: "decimal", value: String(s.count), min: "0", step: "any" });
      var unitSel = el("select");
      Object.keys(UI_UNIT_KEYS()).forEach(function (u) {
        var o = el("option", { value: u, text: UI.unitLabel(u) || "—" }); if (u === s.unit) o.selected = true; unitSel.appendChild(o);
      });
      f2.appendChild(UI.field(t("count"), countIn));
      f2.appendChild(UI.field(t("unit"), unitSel));
      grid.appendChild(f2);
      var dateIn = UI.input({ type: "date", value: s.date });
      grid.appendChild(UI.field(t("date"), dateIn));
      var noteIn = UI.input({ type: "text", value: s.note || "", placeholder: t("note") });
      grid.appendChild(UI.field(t("note"), noteIn));
      body.appendChild(grid);
      var acts = el("div", { class: "modal-actions" });
      if (existing) {
        acts.appendChild(el("button", {
          class: "btn btn-danger", text: t("delete"), onclick: function () {
            UI.confirm(t("delete"), t("confirm_del"), function () { Store.delSeva(existing.id); UI.toast(t("deleted")); App.refresh(); });
          }
        }));
      }
      acts.appendChild(el("button", { class: "btn btn-ghost", text: t("cancel"), onclick: close }));
      acts.appendChild(el("button", {
        class: "btn btn-primary", text: t("save"), onclick: function () {
          var val = { type: sel.value, count: parseFloat(countIn.value) || 0, unit: unitSel.value, note: noteIn.value.trim(), date: dateIn.value || Store.todayStr() };
          if (existing) Store.updateSeva(existing.id, val); else Store.addSeva(val);
          Bridge.vibrate(25); close(); UI.toast(t("saved")); App.refresh();
        }
      }));
      body.appendChild(acts);
    });
  }
  function UI_UNIT_KEYS() { return { mala: 1, ghanta: 1, plate: 1, logo: 1, rupye: 1, page: 1, any: 1 }; }

  /* ---------------- SEVA LIST ---------------- */
  var sevaFilter = "all", sevaQuery = "";
  function renderSeva(page) {
    page.innerHTML = "";
    page.appendChild(el("h3", { style: "margin:6px 2px 10px", text: t("seva_log") }));
    var chips = el("div", { class: "chip-row" });
    [["all", t("filter_all")]].concat(TYPES.map(function (x) { return [x, UI.sevLabel(x)]; })).forEach(function (c) {
      var b = el("button", { class: "chip" + (sevaFilter === c[0] ? " on" : ""), text: c[1] });
      b.addEventListener("click", function () { sevaFilter = c[0]; App.refresh(); });
      chips.appendChild(b);
    });
    page.appendChild(chips);
    var q = UI.input({ type: "search", placeholder: t("search"), value: sevaQuery, style: "margin-bottom:12px" });
    q.addEventListener("input", function () { sevaQuery = q.value; App.refreshSoft("seva"); });
    page.appendChild(q);

    var list = Store.db().sevas.filter(function (s) {
      if (sevaFilter !== "all" && s.type !== sevaFilter) return false;
      if (sevaQuery && (s.note || "").toLowerCase().indexOf(sevaQuery.toLowerCase()) < 0 && UI.sevLabel(s.type).toLowerCase().indexOf(sevaQuery.toLowerCase()) < 0) return false;
      return true;
    });
    if (!list.length) { page.appendChild(el("div", { class: "empty" }, [el("span", { text: "📿" }), el("p", { text: t("no_seva") }), el("p", { class: "tiny", text: t("no_seva_sub") })])); return; }
    var days = {};
    list.forEach(function (s) { (days[s.date] = days[s.date] || []).push(s); });
    var tl = el("div", { class: "tl" });
    Object.keys(days).sort().reverse().forEach(function (k, i) {
      var day = el("div", { class: "tl-day" + (i > 0 ? " past" : "") });
      var sum = days[k].reduce(function (a, b) { return a + (+b.count || 0); }, 0);
      day.appendChild(el("div", { class: "tl-head" }, [
        el("b", { text: k === Store.todayStr() ? t("today") : UI.fmtDate(k, true) }),
        el("span", { text: days[k].length + " " + t("entries") }),
        el("span", { class: "tl-sum", text: "Σ " + sum })
      ]));
      days[k].forEach(function (s) { day.appendChild(sevaRow(s)); });
      tl.appendChild(day);
    });
    page.appendChild(tl);
    App.setCta(t("add_seva"), function () { openSevaForm(null, null); });
  }

  /* ---------------- BHANDARA ---------------- */
  function renderBhandara(page) {
    page.innerHTML = "";
    page.appendChild(el("h3", { style: "margin:6px 2px 10px", text: t("bhandara_title") }));
    var up = Store.upcoming(), past = Store.pastB();
    if (!up.length && !past.length) {
      page.appendChild(el("div", { class: "empty" }, [el("span", { text: "🍲" }), el("p", { text: t("bhandara_title") }), el("p", { class: "tiny", text: "＋" })]));
    }
    if (up.length) page.appendChild(el("div", { class: "pill-note", style: "margin-bottom:10px", text: t("upcoming") + " (" + up.length + ")" }));
    up.forEach(function (b) { page.appendChild(bhCard(b, false)); });
    if (past.length) page.appendChild(el("div", { class: "pill-note", style: "margin:14px 0 10px", text: t("past") + " (" + past.length + ")" }));
    past.slice(0, 10).forEach(function (b) { page.appendChild(bhCard(b, true)); });
    App.setCta(t("new_bhandara"), function () { openBhandaraForm(null); });
  }

  function bhCard(b, isPast) {
    var c = el("div", { class: "card bh-card" + (isPast ? " flat" : "") });
    c.appendChild(el("div", { class: "bh-strip" }));
    c.appendChild(el("div", { class: "row spread" }, [
      el("div", { style: "min-width:0" }, [
        el("div", { class: "bh-title", text: b.title }),
        el("div", { class: "muted", text: b.place || "" })
      ]),
      el("span", { class: "tag" + (isPast ? " gray" : ""), text: UI.fmtDate(b.date) })
    ]));
    var meta = el("div", { class: "bh-meta" });
    if (b.time) meta.appendChild(el("span", { class: "tag gray", text: "🕒 " + b.time }));
    if (b.contact) meta.appendChild(el("span", { class: "tag gray", text: "📞 " + b.contact }));
    if (b.note) meta.appendChild(el("span", { class: "tag gray", text: b.note }));
    c.appendChild(meta);
    var acts = el("div", { class: "bh-actions" });
    acts.appendChild(el("button", { class: "btn btn-primary", text: "🎨 " + t("make_banner"), onclick: function () { openBannerEditor(b); } }));
    acts.appendChild(el("button", { class: "btn btn-ghost", text: "💬 " + t("share_text"), onclick: function () { shareInvite(b); } }));
    acts.appendChild(el("button", {
      class: "btn btn-ghost", text: "✏️", onclick: function () { openBhandaraForm(b); }
    }));
    c.appendChild(acts);
    return c;
  }

  function openBhandaraForm(existing) {
    var b = existing || { title: "", date: Store.todayStr(), time: "", place: "", contact: "", note: "" };
    UI.sheet(existing ? t("edit") : t("new_bhandara"), function (body, close) {
      var grid = el("div", { class: "form-grid" });
      var ti = UI.input({ value: b.title, placeholder: t("event_name") });
      grid.appendChild(UI.field(t("event_name"), ti));
      var f2 = el("div", { class: "form-2" });
      var da = UI.input({ type: "date", value: b.date });
      var tm = UI.input({ type: "time", value: b.time || "" });
      f2.appendChild(UI.field(t("date"), da)); f2.appendChild(UI.field(t("time"), tm));
      grid.appendChild(f2);
      var pl = UI.input({ value: b.place || "", placeholder: t("place") });
      grid.appendChild(UI.field(t("place"), pl));
      var co = UI.input({ value: b.contact || "", placeholder: t("contact"), type: "tel" });
      grid.appendChild(UI.field(t("contact"), co));
      var no = UI.input({ value: b.note || "", placeholder: t("notes") });
      grid.appendChild(UI.field(t("notes"), no));
      body.appendChild(grid);
      var acts = el("div", { class: "modal-actions" });
      if (existing) acts.appendChild(el("button", { class: "btn btn-danger", text: t("delete"), onclick: function () { Store.delBhandara(existing.id); close(); App.refresh(); } }));
      acts.appendChild(el("button", { class: "btn btn-ghost", text: t("cancel"), onclick: close }));
      acts.appendChild(el("button", {
        class: "btn btn-primary", text: t("save"), onclick: function () {
          var v = { title: ti.value.trim() || t("bhandara_title"), date: da.value || Store.todayStr(), time: tm.value, place: pl.value.trim(), contact: co.value.trim(), note: no.value.trim() };
          if (existing) Store.updateBhandara(existing.id, v); else Store.addBhandara(v);
          close(); UI.toast(t("saved")); App.refresh();
        }
      }));
      body.appendChild(acts);
    });
  }

  function shareInvite(b) {
    var txt = t("invite_txt") + "\n\n🪔 " + b.title +
      "\n📅 " + UI.fmtDate(b.date, true) + (b.time ? " · " + b.time : "") +
      "\n📍 " + (b.place || "") +
      (b.contact ? "\n📞 " + b.contact : "") +
      (b.note ? "\n📝 " + b.note : "") +
      "\n\n— " + t("blessing") + " 🙏";
    if (Bridge.shareText(txt)) UI.toast(t("shared"));
    else if (navigator.share) navigator.share({ text: txt });
    else { UI.sheet(t("share_text"), function (body, close) {
      var ta = el("textarea", { rows: 8 }); ta.value = txt; body.appendChild(ta);
      body.appendChild(el("div", { class: "modal-actions" }, [el("button", { class: "btn btn-primary", text: t("close"), onclick: close })]));
    }); }
  }

  /* ---------------- BANNER EDITOR (canvas) ---------------- */
  var LOGO_IMG = null;
  function logoImg(cb) {
    if (LOGO_IMG) { cb(LOGO_IMG); return; }
    var im = new Image();
    im.onload = function () { LOGO_IMG = im; cb(im); };
    im.onerror = function () { cb(null); };
    im.src = "img/logo.png";
  }

  function openBannerEditor(b) {
    var style = 0;
    UI.sheet(t("make_banner"), function (body, close) {
      var thumbs = el("div", { class: "ban-thumbs" });
      var preview = el("canvas", { class: "ban-preview", width: "1080", height: "1350" });
      body.appendChild(thumbs);
      body.appendChild(preview);
      var acts = el("div", { class: "modal-actions" });
      acts.appendChild(el("button", { class: "btn btn-ghost", text: t("close"), onclick: close }));
      acts.appendChild(el("button", {
        class: "btn btn-primary", text: "📤 " + t("share"), onclick: function () {
          var b64 = preview.toDataURL("image/png").split(",")[1];
          if (Bridge.shareImage(b64, "bhandara-" + b.date + ".png")) UI.toast(t("shared"));
          else UI.toast(t("banner_ready"));
        }
      }));
      body.appendChild(acts);
      [0, 1, 2].forEach(function (i) {
        var th = el("canvas", { width: "1080", height: "1350" });
        drawBanner(th.getContext("2d"), b, i);
        th.addEventListener("click", function () {
          style = i;
          UI.$$("canvas", thumbs).forEach(function (c) { c.classList.remove("on"); });
          th.classList.add("on");
          drawBanner(preview.getContext("2d"), b, i);
        });
        if (i === 0) th.classList.add("on");
        thumbs.appendChild(th);
      });
      logoImg(function () { drawBanner(preview.getContext("2d"), b, 0); UI.$$("canvas", thumbs).forEach(function (c, i2) { if (i2 === 0) drawBanner(c.getContext("2d"), b, 0); }); });
    });
  }

  function wrapText(ctx, text, x, y, maxW, lh) {
    var words = String(text || "").split(/\s+/), line = "", yy = y;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i] + " ";
      if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, yy); line = words[i] + " "; yy += lh; }
      else line = test;
    }
    ctx.fillText(line, x, yy);
    return yy + lh;
  }

  function drawBanner(ctx, b, style) {
    var W = 1080, H = 1350;
    ctx.clearRect(0, 0, W, H);
    var fonts = '"Noto Sans Devanagari","Noto Sans Gurmukhi",sans-serif';
    if (style === 0) { /* Maroon Utsav */
      var g0 = ctx.createLinearGradient(0, 0, W, H);
      g0.addColorStop(0, "#4A1A0C"); g0.addColorStop(1, "#6B2A12");
      ctx.fillStyle = g0; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(217,164,65,.55)"; ctx.lineWidth = 5;
      ctx.strokeRect(46, 46, W - 92, H - 92);
      ctx.strokeStyle = "rgba(217,164,65,.25)"; ctx.lineWidth = 2;
      ctx.strokeRect(66, 66, W - 132, H - 132);
      ctx.fillStyle = "#D9A441"; ctx.textAlign = "center";
      ctx.font = "600 44px " + fonts; ctx.fillText("॥ ਸ਼੍ਰੀ ਗੁਰੂ ਦੇਵ ਨਮਹ ॥", W / 2, 170);
      ctx.font = "700 64px " + fonts; ctx.fillStyle = "#F7E7CE";
      ctx.fillText(t("bhandara_title"), W / 2, 268);
      if (LOGO_IMG) ctx.drawImage(LOGO_IMG, W / 2 - 150, 320, 300, 300);
      ctx.fillStyle = "#F59E42"; ctx.font = "800 78px " + fonts;
      wrapText(ctx, b.title, W / 2, 720, W - 220, 92);
      ctx.fillStyle = "#F7E7CE"; ctx.font = "600 46px " + fonts;
      ctx.fillText("📅 " + UI.fmtDate(b.date, true), W / 2, 900);
      if (b.time) ctx.fillText("🕒 " + b.time, W / 2, 968);
      ctx.fillStyle = "#EAD9BC"; ctx.font = "500 44px " + fonts;
      wrapText(ctx, "📍 " + (b.place || ""), W / 2, 1040, W - 240, 58);
      ctx.fillStyle = "#D9A441"; ctx.font = "600 40px " + fonts;
      if (b.contact) ctx.fillText("📞 " + b.contact, W / 2, 1180);
      ctx.fillStyle = "rgba(247,231,206,.75)"; ctx.font = "500 34px " + fonts;
      ctx.fillText(t("blessing"), W / 2, 1262);
    } else if (style === 1) { /* Saffron Dawn */
      var g1 = ctx.createLinearGradient(0, 0, 0, H);
      g1.addColorStop(0, "#F59E42"); g1.addColorStop(.55, "#E86A17"); g1.addColorStop(1, "#B4470E");
      ctx.fillStyle = g1; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(255,255,255,.14)";
      ctx.beginPath(); ctx.arc(W / 2, 330, 260, 0, 7); ctx.fill();
      if (LOGO_IMG) {
        ctx.save(); ctx.beginPath(); ctx.arc(W / 2, 330, 190, 0, 7); ctx.clip();
        ctx.drawImage(LOGO_IMG, W / 2 - 190, 140, 380, 380); ctx.restore();
      }
      ctx.fillStyle = "#FFFFFF"; ctx.textAlign = "center";
      ctx.font = "800 84px " + fonts; wrapText(ctx, b.title, W / 2, 660, W - 180, 100);
      rr(ctx, 140, 760, W - 280, 380, 40); ctx.fillStyle = "rgba(255,255,255,.95)"; ctx.fill();
      ctx.fillStyle = "#5A2412"; ctx.font = "700 52px " + fonts;
      ctx.fillText(UI.fmtDate(b.date, true), W / 2, 860);
      ctx.font = "600 46px " + fonts; ctx.fillStyle = "#7A3418";
      if (b.time) ctx.fillText("🕒 " + b.time, W / 2, 935);
      ctx.font = "500 42px " + fonts; ctx.fillStyle = "#6E5D4F";
      wrapText(ctx, "📍 " + (b.place || ""), W / 2, 1010, W - 340, 56);
      ctx.fillStyle = "#FFF3E0"; ctx.font = "700 44px " + fonts;
      if (b.contact) ctx.fillText("📞 " + b.contact, W / 2, 1210);
      ctx.font = "500 34px " + fonts; ctx.fillStyle = "rgba(255,243,224,.85)";
      ctx.fillText(t("blessing") + " 🙏", W / 2, 1290);
    } else { /* Minimal Cream */
      ctx.fillStyle = "#FAF6F0"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#5A2412"; ctx.fillRect(0, 0, W, 14);
      ctx.fillRect(0, H - 14, W, 14);
      ctx.textAlign = "center";
      if (LOGO_IMG) ctx.drawImage(LOGO_IMG, W / 2 - 110, 110, 220, 220);
      ctx.fillStyle = "#E86A17"; ctx.font = "700 40px " + fonts;
      ctx.fillText("— " + t("invite_txt").replace(/🙏/g, "").trim() + " —", W / 2, 420);
      ctx.fillStyle = "#241A12"; ctx.font = "800 82px " + fonts;
      wrapText(ctx, b.title, W / 2, 530, W - 200, 98);
      ctx.strokeStyle = "#D9A441"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(W / 2 - 160, 640); ctx.lineTo(W / 2 + 160, 640); ctx.stroke();
      ctx.fillStyle = "#5A2412"; ctx.font = "700 56px " + fonts;
      ctx.fillText(UI.fmtDate(b.date, true), W / 2, 740);
      ctx.fillStyle = "#6E5D4F"; ctx.font = "500 46px " + fonts;
      var yy = 810;
      if (b.time) { ctx.fillText("🕒 " + b.time, W / 2, yy); yy += 70; }
      yy = wrapText(ctx, "📍 " + (b.place || ""), W / 2, yy + 10, W - 260, 60);
      if (b.contact) { ctx.fillStyle = "#E86A17"; ctx.font = "700 46px " + fonts; ctx.fillText("📞 " + b.contact, W / 2, yy + 50); }
      ctx.fillStyle = "#9C8B7C"; ctx.font = "500 34px " + fonts;
      ctx.fillText(t("blessing"), W / 2, H - 90);
    }
  }
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  /* ---------------- STATS ---------------- */
  function renderStats(page) {
    page.innerHTML = "";
    page.appendChild(el("h3", { style: "margin:6px 2px 10px", text: t("nav_stats") }));
    var grid = el("div", { class: "stat-grid" });
    var all = Store.db().sevas.length;
    var sum7 = Store.last7().reduce(function (a, b) { return a + b.count; }, 0);
    [[String(all), t("stats_total")], [String(Store.streak()) + " " + t("days"), t("streak")],
     [String(Store.monthCount()), t("this_month")], [(sum7 / 7).toFixed(1), t("avg_day")]].forEach(function (x) {
      grid.appendChild(el("div", { class: "stat-tile" }, [el("b", { text: x[0] }), el("span", { text: x[1] })]));
    });
    page.appendChild(grid);

    var card = el("div", { class: "card", style: "margin-top:14px" });
    card.appendChild(el("h3", {}, [document.createTextNode(t("stats_7d"))]));
    var l7 = Store.last7(); var max = Math.max(1, Math.max.apply(null, l7.map(function (x) { return x.count; })));
    var bars = el("div", { class: "bars" });
    l7.forEach(function (x) {
      var col = el("div", { class: "bar-col" });
      col.appendChild(el("b", { text: x.count || "" }));
      col.appendChild(el("i", { style: "height:" + Math.round(x.count / max * 78) + "%" }));
      col.appendChild(el("span", { text: t("day_names")[x.d.getDay()] }));
      bars.appendChild(col);
    });
    card.appendChild(bars);
    page.appendChild(card);

    var bt = Store.byType();
    var keys = Object.keys(bt).sort(function (a, b) { return bt[b] - bt[a]; });
    if (keys.length) {
      var c2 = el("div", { class: "card" });
      c2.appendChild(el("h3", {}, [document.createTextNode(t("stats_type"))]));
      var colors = ["#E86A17", "#D9A441", "#2E7D4F", "#7A3418", "#C0392B", "#5A7DB0", "#9C8B7C"];
      var leg = el("div", { class: "legend" });
      keys.forEach(function (k, i) {
        leg.appendChild(el("div", { class: "row" }, [
          el("span", { class: "dot", style: "background:" + colors[i % colors.length] }),
          el("span", { text: (UI.TYPE_ICON[k] || "") + " " + UI.sevLabel(k) }),
          el("b", { text: String(bt[k]) })
        ]));
      });
      c2.appendChild(leg);
      page.appendChild(c2);
    }
  }

  g.Screens = { renderHome: renderHome, renderSeva: renderSeva, renderBhandara: renderBhandara, renderStats: renderStats, openSevaForm: openSevaForm, openBannerEditor: openBannerEditor, drawBanner: drawBanner, logoImg: logoImg };
})(window);
