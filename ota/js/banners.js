/* ============================================================================
   Banner Studio — share-ready bhandara / satsang posters, rendered on canvas.
   1080px wide so WhatsApp does not re-compress them into mush.
   ========================================================================== */
window.Banners = (function () {

  const THEMES = [
    { id: "saffron", name: "केसरिया", a: "#FF9436", b: "#E8730C", c: "#A34806", ink: "#2A1607", paper: "#FFF7EC" },
    { id: "marigold", name: "गेंदा",  a: "#FFC24D", b: "#F59A0B", c: "#B06A02", ink: "#2C1D05", paper: "#FFFAF0" },
    { id: "crimson", name: "सिंदूरी", a: "#F0685C", b: "#C6362F", c: "#8C1F1A", ink: "#2B0C09", paper: "#FFF3F1" },
    { id: "indigo",  name: "नीलम",   a: "#6E8FE8", b: "#2F4FB8", c: "#1B2F78", ink: "#0C1330", paper: "#F2F5FF" },
    { id: "forest",  name: "तुलसी",  a: "#4FB98A", b: "#128A5A", c: "#0A5C3C", ink: "#052015", paper: "#F0FAF5" },
    { id: "royal",   name: "शाही",   a: "#B07BE8", b: "#7A3FC0", c: "#4E2380", ink: "#1B0B2E", paper: "#F8F3FF" }
  ];

  const TEMPLATES = [
    { id: "photo",   name: "चित्र" },
    { id: "royal",   name: "शाही" },
    { id: "minimal", name: "सादा" },
    { id: "poster",  name: "पोस्टर" }
  ];

  const PHOTOS = ["img/hero_seva.jpg", "img/hero_satsang.jpg", "img/hero_jaap.jpg"];

  const cache = {};
  function loadImg(src) {
    if (cache[src]) return cache[src];
    cache[src] = new Promise((res) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => res(null);
      im.src = src;
    });
    return cache[src];
  }

  function font(px, weight) {
    return (weight || 700) + " " + px + 'px system-ui, -apple-system, "Noto Sans Devanagari", "Noto Sans Gurmukhi", Roboto, sans-serif';
  }

  function wrap(ctx, text, maxW) {
    const words = String(text || "").split(/\s+/);
    const lines = []; let line = "";
    words.forEach(w => {
      const test = line ? line + " " + w : w;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
      else line = test;
    });
    if (line) lines.push(line);
    return lines;
  }

  function fitText(ctx, text, maxW, start, min, weight) {
    let size = start;
    while (size > min) {
      ctx.font = font(size, weight);
      if (ctx.measureText(text).width <= maxW) break;
      size -= 2;
    }
    ctx.font = font(size, weight);
    return size;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function ornament(ctx, cx, cy, s, colour, alpha) {
    // simple lotus + rays motif
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.strokeStyle = colour; ctx.fillStyle = colour;
    ctx.lineWidth = s * 0.045; ctx.lineCap = "round";
    for (let i = -2; i <= 2; i++) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(i * 0.38);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-s * 0.19, -s * 0.42, 0, -s * 0.72);
      ctx.quadraticCurveTo(s * 0.19, -s * 0.42, 0, 0);
      ctx.stroke();
      ctx.restore();
    }
    ctx.beginPath(); ctx.arc(cx, cy + s * 0.1, s * 0.075, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function divider(ctx, cx, y, w, colour) {
    ctx.save();
    ctx.strokeStyle = colour; ctx.lineWidth = 2; ctx.globalAlpha = .55;
    ctx.beginPath(); ctx.moveTo(cx - w / 2, y); ctx.lineTo(cx - 14, y);
    ctx.moveTo(cx + 14, y); ctx.lineTo(cx + w / 2, y); ctx.stroke();
    ctx.globalAlpha = 1; ctx.fillStyle = colour;
    ctx.beginPath(); ctx.arc(cx, y, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  /**
   * cfg = {title, sub, date, venue, contact, org, template, theme, photo, size}
   * size: "portrait" (1080x1350) | "square" (1080x1080) | "story" (1080x1920)
   */
  async function render(canvas, cfg) {
    const th = THEMES.find(x => x.id === cfg.theme) || THEMES[0];
    const W = 1080;
    const H = cfg.size === "square" ? 1080 : cfg.size === "story" ? 1920 : 1350;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    ctx.textBaseline = "alphabetic";
    ctx.clearRect(0, 0, W, H);

    const photo = await loadImg(cfg.photo || PHOTOS[0]);
    const tpl = cfg.template || "photo";
    const title = cfg.title || t("bn_default_title");
    const sub = cfg.sub || t("bn_default_sub");
    const cx = W / 2;

    // ---------- background ----------
    if (tpl === "photo" && photo) {
      const ph = Math.round(H * (cfg.size === "story" ? 0.32 : 0.38));
      const scale = Math.max(W / photo.width, ph / photo.height);
      const dw = photo.width * scale, dh = photo.height * scale;
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, ph); ctx.clip();
      ctx.drawImage(photo, (W - dw) / 2, (ph - dh) / 2, dw, dh);
      const g = ctx.createLinearGradient(0, ph * 0.35, 0, ph);
      g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, th.paper);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, ph);
      ctx.restore();
      ctx.fillStyle = th.paper; ctx.fillRect(0, ph, W, H - ph);
    } else if (tpl === "royal") {
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, th.a); g.addColorStop(.55, th.b); g.addColorStop(1, th.c);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.globalAlpha = .10;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath(); ctx.arc(W * 0.92, H * 0.06, 130 + i * 90, 0, Math.PI * 2);
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.5; ctx.stroke();
      }
      ctx.restore();
    } else if (tpl === "minimal") {
      ctx.fillStyle = th.paper; ctx.fillRect(0, 0, W, H);
      const g = ctx.createLinearGradient(0, 0, W, 0);
      g.addColorStop(0, th.a); g.addColorStop(1, th.b);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, 26);
      ctx.fillRect(0, H - 26, W, 26);
      ctx.save(); ctx.globalAlpha = .06; ctx.fillStyle = th.b;
      ctx.beginPath(); ctx.arc(cx, H * 0.30, 300, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    } else { // poster
      ctx.fillStyle = th.paper; ctx.fillRect(0, 0, W, H);
      const g = ctx.createLinearGradient(0, 0, 0, H * 0.42);
      g.addColorStop(0, th.a); g.addColorStop(1, th.b);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W, 0); ctx.lineTo(W, H * 0.33);
      ctx.quadraticCurveTo(cx, H * 0.46, 0, H * 0.33); ctx.closePath(); ctx.fill();
      if (photo) {
        ctx.save(); ctx.globalAlpha = .22;
        const scale = Math.max(W / photo.width, (H * .4) / photo.height);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W, 0); ctx.lineTo(W, H * 0.33);
        ctx.quadraticCurveTo(cx, H * 0.46, 0, H * 0.33); ctx.closePath(); ctx.clip();
        ctx.drawImage(photo, (W - photo.width * scale) / 2, 0, photo.width * scale, photo.height * scale);
        ctx.restore();
      }
    }

    const dark = tpl === "royal";
    const ink = dark ? "#FFFFFF" : th.ink;
    const soft = dark ? "rgba(255,255,255,.86)" : "rgba(0,0,0,.62)";
    const accent = dark ? "#FFFFFF" : th.b;

    // ---------- frame ----------
    if (tpl === "royal" || tpl === "poster") {
      ctx.save();
      ctx.strokeStyle = dark ? "rgba(255,255,255,.5)" : th.b;
      ctx.lineWidth = 3; ctx.globalAlpha = dark ? .8 : .35;
      roundRect(ctx, 34, 34, W - 68, H - 68, 28); ctx.stroke();
      ctx.restore();
    }

    // ---------- measured, scale-to-fit layout ------------------------------
    // Everything below is laid out from real measurements so no two blocks can
    // ever collide, whatever the language, title length or canvas ratio.
    const topStart = tpl === "photo" ? Math.round(H * (cfg.size === "story" ? 0.32 : 0.38)) + 52 : (tpl === "poster" ? 118 : 116);
    const BOTTOM = 208;                       // invite + divider + footer zone
    const detailRows = [];
    if (cfg.date) detailRows.push({ k: t("bn_date"), v: cfg.date, big: true });
    if (cfg.venue) detailRows.push({ k: t("bn_venue"), v: cfg.venue });
    if (cfg.org) detailRows.push({ k: t("ev_org"), v: cfg.org });
    if (cfg.contact) detailRows.push({ k: t("bn_contact"), v: cfg.contact });

    // measure() mirrors the draw code exactly, so the fit test is truthful.
    function measure(k) {
      let ts = Math.round(84 * k);
      ctx.font = font(ts, 800);
      while (ts > Math.round(40 * k) && ctx.measureText(title).width > W - 150) {
        ts -= 2; ctx.font = font(ts, 800);
      }
      const tLines = wrap(ctx, title, W - 150).slice(0, 3);
      const headerH = 74 + Math.round(268 * k) + (tLines.length - 1) * (ts + 12);
      const rows = detailRows.map(r => {
        ctx.font = font(Math.round((r.big ? 44 : 33) * k), r.big ? 750 : 650);
        return { r, lines: wrap(ctx, r.v, W - 260).slice(0, 2),
                 lh: Math.round((r.big ? 50 : 40) * k),
                 off: Math.round((r.big ? 46 : 38) * k) };
      });
      const cardH = Math.round(30 * k) + rows.reduce((sum, m) =>
        sum + Math.round(22 * k) + m.off + (m.lines.length - 1) * m.lh + Math.round(10 * k), 0);
      const gap = Math.round(46 * k);
      return { k, ts, tLines, headerH, rows, cardH, gap, total: headerH + gap + cardH };
    }

    const avail = (H - BOTTOM) - topStart;
    let M = measure(1);
    for (let i = 0; i < 12 && M.total > avail; i++) {
      M = measure(Math.max(0.5, M.k * (avail / M.total) * 0.985));
    }
    const k = M.k;
    const slack = Math.max(0, avail - M.total);
    const contentTop = topStart + (tpl === "photo" ? Math.min(slack, 20) : Math.round(slack * 0.42));
    ctx.textAlign = "center";

    // ---- header ----
    let y = contentTop;
    ornament(ctx, cx, y + 68 * k, 92 * k, dark ? "rgba(255,255,255,.95)" : th.b, dark ? .95 : .9);
    y += 74 + Math.round(58 * k);
    ctx.font = font(Math.round(30 * k), 700);
    ctx.fillStyle = accent;
    ctx.fillText("॥ " + t("greeting") + " ॥", cx, y);
    y += Math.round(40 * k);
    ctx.font = font(Math.round(25 * k), 600);
    ctx.fillStyle = soft;
    ctx.fillText(t("bn_bless"), cx, y);

    y += Math.round(70 * k);
    ctx.fillStyle = ink;
    M.tLines.forEach((ln, i) => { ctx.font = font(M.ts, 800); ctx.fillText(ln, cx, y + i * (M.ts + 12)); });
    y += (M.tLines.length - 1) * (M.ts + 12);

    y += Math.round(52 * k);
    const subPx = Math.round(31 * k);
    ctx.font = font(subPx, 650);
    const sw = Math.min(W - 170, ctx.measureText(sub).width + 68);
    ctx.save();
    if (dark) ctx.fillStyle = "rgba(255,255,255,.18)";
    else { ctx.fillStyle = th.b; ctx.globalAlpha = .12; }
    roundRect(ctx, cx - sw / 2, y - subPx - 8, sw, subPx + 28, (subPx + 28) / 2); ctx.fill();
    ctx.restore();
    ctx.fillStyle = dark ? "#fff" : th.c;
    ctx.fillText(sub, cx, y);

    y += Math.round(48 * k);
    divider(ctx, cx, y, 420, dark ? "rgba(255,255,255,.75)" : th.b);

    // ---- details card ----
    const cardTop = y + M.gap;
    ctx.save();
    ctx.fillStyle = dark ? "rgba(255,255,255,.14)" : "#FFFFFF";
    if (!dark) { ctx.shadowColor = "rgba(0,0,0,.08)"; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8; }
    roundRect(ctx, 88, cardTop, W - 176, M.cardH, 30); ctx.fill();
    ctx.restore();

    let iy = cardTop + Math.round(10 * k);
    M.rows.forEach(({ r, lines, lh, off }) => {
      iy += Math.round(22 * k);
      ctx.font = font(Math.round(22 * k), 700);
      ctx.fillStyle = dark ? "rgba(255,255,255,.72)" : th.c;
      ctx.fillText(r.k.toUpperCase(), cx, iy);
      iy += off;
      ctx.font = font(Math.round((r.big ? 44 : 33) * k), r.big ? 750 : 650);
      ctx.fillStyle = dark ? "#fff" : th.ink;
      lines.forEach((ln, i) => ctx.fillText(ln, cx, iy + i * lh));
      iy += (lines.length - 1) * lh + Math.round(10 * k);
    });

    // ---------- bottom zone (fixed anchors, never overlaps) ----------------
    const inviteY = H - 172;
    ctx.font = font(32, 700);
    ctx.fillStyle = ink;
    ctx.fillText(t("bn_invite"), cx, inviteY);

    divider(ctx, cx, H - 118, 360, dark ? "rgba(255,255,255,.6)" : th.b);

    ctx.font = font(23, 650);
    ctx.fillStyle = soft;
    ctx.fillText(t("sadguru"), cx, H - 80);
    ctx.font = font(20, 600);
    ctx.globalAlpha = .75;
    ctx.fillText(t("app_name"), cx, H - 48);
    ctx.globalAlpha = 1;

    return canvas;
  }

  function dataUrl(canvas, quality) {
    return canvas.toDataURL("image/jpeg", quality || 0.92);
  }

  return { THEMES, TEMPLATES, PHOTOS, render, dataUrl };
})();
