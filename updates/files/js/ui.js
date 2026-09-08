/* ============ UI helpers: dom, toast, modal, nav ============ */
(function (g) {
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === "class") n.className = attrs[k];
      else if (k === "html") n.innerHTML = attrs[k];
      else if (k === "text") n.textContent = attrs[k];
      else if (k.indexOf("on") === 0) n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return n;
  }
  var t = function (k, v) { return I18N.t(k, v); };

  var toastTimer = null;
  function toast(msg) {
    var elx = $("#toast");
    elx.textContent = msg; elx.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { elx.classList.add("hidden"); }, 2200);
  }

  function sheet(title, buildFn, opts) {
    opts = opts || {};
    var root = $("#modalRoot"), sh = $("#modalSheet");
    sh.innerHTML = "";
    sh.appendChild(el("h3", { text: title }));
    var body = el("div", { class: "sheet-body" });
    sh.appendChild(body);
    buildFn(body, function close() { root.classList.add("hidden"); });
    root.classList.remove("hidden");
    return function () { root.classList.add("hidden"); };
  }
  function closeSheet() { $("#modalRoot").classList.add("hidden"); }

  function confirm(title, msg, onYes, yesLabel, danger) {
    sheet(title, function (body, close) {
      body.appendChild(el("p", { class: "muted", text: msg, style: "margin-bottom:6px" }));
      var acts = el("div", { class: "modal-actions" });
      acts.appendChild(el("button", { class: "btn btn-ghost", text: t("cancel"), onclick: close }));
      acts.appendChild(el("button", {
        class: "btn " + (danger ? "btn-danger" : "btn-primary"), text: yesLabel || t("yes"),
        onclick: function () { close(); onYes && onYes(); }
      }));
      body.appendChild(acts);
    });
  }

  /* form helper */
  function field(label, input) {
    var l = el("label"); l.appendChild(document.createTextNode(label)); l.appendChild(input);
    return l;
  }
  function input(attrs) { return el("input", attrs); }

  function fmtDate(ds, withDay) {
    var p = ds.split("-"); var d = new Date(+p[0], +p[1] - 1, +p[2]);
    var s = (+p[2]) + " " + t("months")[+p[1] - 1] + " " + p[0];
    if (withDay) s = t("day_names")[d.getDay()] + ", " + s;
    return s;
  }
  function fmtBytes(n) {
    if (n < 1024) return n + " B";
    if (n < 1048576) return (n / 1024).toFixed(1) + " KB";
    return (n / 1048576).toFixed(2) + " MB";
  }
  var TYPE_ICON = { jaap: "mala", satsang: "users", bhandara: "bowl", prachar: "mega", daan: "heart", padhna: "book", other: "lotus" };

  g.UI = {
    $: $, $$: $$, el: el, ic: IC.el, icHTML: IC.html, toast: toast, sheet: sheet, closeSheet: closeSheet, confirm: confirm,
    field: field, input: input, fmtDate: fmtDate, fmtBytes: fmtBytes, TYPE_ICON: TYPE_ICON, t: t,
    sevLabel: function (type) { return t("types." + type) || type; },
    unitLabel: function (u) { return t("units." + u) || u; }
  };
})(window);
