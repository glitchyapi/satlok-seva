/* ============ Satlok Seva icon set — inline SVG (stroke style), no emoji ============
   IC.html(name,size,cls) → svg markup string
   IC.el(name,size,cls)   → element
   IC.draw(ctx,name,x,y,size,color,lw) → canvas vector draw (banner templates)   */
(function (g) {
  function mala() {
    var d = [], cx = 12, cy = 11.3, R = 6.9, n = 10, r = 1.5;
    for (var i = 0; i < n; i++) {
      var a = -Math.PI / 2 + i * 2 * Math.PI / n;
      var x = +(cx + R * Math.cos(a)).toFixed(2), y = +(cy + R * Math.sin(a)).toFixed(2);
      d.push("M" + (x + r) + " " + y + "a" + r + " " + r + " 0 1 0 -" + (2 * r) + " 0a" + r + " " + r + " 0 1 0 " + (2 * r) + " 0z");
    }
    d.push("M12 18.2v2.1", "M12 20.3l-1.3 1.7", "M12 20.3l1.3 1.7");
    return d;
  }
  var ICONS = {
    home: ["M3 10.5L12 3l9 7.5", "M5 9.5V21h14V9.5", "M9 21v-6h6v6"],
    mala: mala(),
    users: ["M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2", "M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M23 21v-2a4 4 0 0 0-3-3.87", "M16 3.13a4 4 0 0 1 0 7.75"],
    bowl: ["M4 11h16a8 8 0 0 1-16 0z", "M8 21h8", "M12 19v2", "M9.5 7.5c0-1.5 1-1.5 1-3", "M14 7.5c0-1.5 1-1.5 1-3"],
    mega: ["M3 10v4a1 1 0 0 0 1 1h3l5 4V5L7 9H4a1 1 0 0 0-1 1z", "M16.5 8.5a5 5 0 0 1 0 7", "M19 6a8.5 8.5 0 0 1 0 12"],
    heart: ["M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"],
    book: ["M2 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2z", "M22 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7z"],
    lotus: ["M12 4c-1.8 2.6-1.8 6.4 0 9 1.8-2.6 1.8-6.4 0-9z", "M6.5 7.5c-.3 3 1.6 5.9 4.5 7", "M17.5 7.5c.3 3-1.6 5.9-4.5 7", "M3 12c1.5 4 5 6.5 9 6.5s7.5-2.5 9-6.5", "M7.5 18.5h9"],
    chart: ["M18 20V10", "M12 20V4", "M6 20v-6"],
    sliders: ["M4 21v-7", "M4 10V3", "M12 21v-9", "M12 8V3", "M20 21v-5", "M20 12V3", "M1 14h6", "M9 8h6", "M17 16h6"],
    plus: ["M12 5v14", "M5 12h14"],
    flame: ["M12 3c-3 4-5 6.2-5 10a5 5 0 0 0 10 0c0-3.8-2-6-5-10z", "M12 10.5c-1.2 1.6-1.8 2.7-1.8 3.9a1.8 1.8 0 0 0 3.6 0c0-1.2-.6-2.3-1.8-3.9z"],
    bell: ["M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9", "M13.7 21a2 2 0 0 1-3.4 0"],
    clock: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M12 6v6l4 2"],
    cal: ["M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z", "M16 2v4", "M8 2v4", "M3 10h18"],
    pin: ["M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z", "M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"],
    phone: ["M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2z"],
    share: ["M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "M6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "M18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "M8.6 13.5l6.8 4", "M15.4 6.5l-6.8 4"],
    edit: ["M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"],
    trash: ["M3 6h18", "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6", "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2", "M10 11v6", "M14 11v6"],
    download: ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "M7 10l5 5 5-5", "M12 15V3"],
    refresh: ["M23 4v6h-6", "M1 20v-6h6", "M3.5 9a9 9 0 0 1 14.9-3.4L23 10", "M1 14l4.6 4.4A9 9 0 0 0 20.5 15"],
    lock: ["M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z", "M8 11V7a4 4 0 0 1 8 0v4"],
    shield: ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"],
    save: ["M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z", "M17 21v-8H7v8", "M7 3v5h8"],
    history: ["M3 3v5h5", "M3.05 13A9 9 0 1 0 6 5.3L3 8", "M12 7v5l4 2"],
    globe: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M2 12h20", "M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"],
    moon: ["M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"],
    sun: ["M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z", "M12 1v2", "M12 21v2", "M4.2 4.2l1.4 1.4", "M18.4 18.4l1.4 1.4", "M1 12h2", "M21 12h2", "M4.2 19.8l1.4-1.4", "M18.4 5.6l1.4-1.4"],
    check: ["M20 6L9 17l-5-5"],
    x: ["M18 6L6 18", "M6 6l12 12"],
    search: ["M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z", "M21 21l-4.3-4.3"],
    chevR: ["M9 18l6-6-6-6"],
    image: ["M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z", "M8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z", "M21 15l-5-5L5 21"],
    msg: ["M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.8-.9L3 21l2-4.9a8.4 8.4 0 1 1 16-4.6z"],
    info: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M12 16v-4", "M12 8h.01"],
    note: ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", "M14 2v6h6", "M16 13H8", "M16 17H8", "M10 9H8"],
    backspace: ["M22 3H7a2 2 0 0 0-1.6.8l-4 5.4a1.4 1.4 0 0 0 0 1.6l4 5.4A2 2 0 0 0 7 17h15a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z", "M18 9l-6 6", "M12 9l6 6"],
    diya: ["M4 13h16a8 8 0 0 1-16 0z", "M12 13c-2-2.5-2-4.5 0-7 2 2.5 2 4.5 0 7z", "M8 21h8"],
    rupee: ["M7 4h10", "M7 8h10", "M13 4c3 0 5 1.3 5 4s-2 4-5 4H7l8 8"]
  };
  function paths(name) { return ICONS[name] || ICONS.info; }
  function html(name, size, cls) {
    size = size || 20;
    return '<svg class="ic' + (cls ? " " + cls : "") + '" width="' + size + '" height="' + size +
      '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      paths(name).map(function (d) { return '<path d="' + d + '"/>'; }).join("") + "</svg>";
  }
  function el(name, size, cls) {
    var s = document.createElement("span");
    s.className = "ic-w" + (cls ? " " + cls : "");
    s.innerHTML = html(name, size, cls);
    return s;
  }
  function draw(ctx, name, x, y, size, color, lw) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size / 24, size / 24);
    ctx.strokeStyle = color || "#000";
    ctx.lineWidth = lw || 1.8;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    paths(name).forEach(function (d) { ctx.stroke(new Path2D(d)); });
    ctx.restore();
  }
  /* centered icon+text line helper for canvas banners */
  function drawIconText(ctx, name, text, cx, y, size, gap, color) {
    var w = ctx.measureText(text).width;
    var total = size + gap + w;
    var sx = cx - total / 2;
    draw(ctx, name, sx, y - size * 0.82, size, color);
    var ta = ctx.textAlign;
    ctx.textAlign = "left";
    ctx.fillText(text, sx + size + gap, y);
    ctx.textAlign = ta;
  }
  g.IC = { html: html, el: el, draw: draw, drawIconText: drawIconText, has: function (n) { return !!ICONS[n]; } };
})(window);
