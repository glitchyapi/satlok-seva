#!/usr/bin/env python3
"""Derive every Android icon/splash asset from the single generated emblem."""
from PIL import Image, ImageDraw, ImageFilter
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(os.path.dirname(ROOT), "assets_src", "logo_emblem.png")
RES = os.path.join(ROOT, "app", "res")
WEB = os.path.join(ROOT, "app", "assets", "www", "img")
os.makedirs(WEB, exist_ok=True)

SAFFRON = (232, 115, 12)
DEEP = (194, 90, 5)
CREAM = (255, 248, 235)

src = Image.open(SRC).convert("RGB")
W, H = src.size
# The emblem is cream on orange: blue channel separates them cleanly.
px = src.load()
mask = Image.new("L", (W, H), 0)
mp = mask.load()
for y in range(H):
    for x in range(W):
        r, g, b = px[x, y]
        # cream => high blue; orange bg => blue < 60
        v = 0 if b < 90 else min(255, int((b - 90) * 255 / 110))
        mp[x, y] = v
# tighten the bounding box of the glyph
bbox = mask.getbbox()
glyph = mask.crop(bbox)

def glyph_layer(size, ratio, color=CREAM):
    """White emblem centred in a size×size transparent canvas at `ratio` width."""
    gw = int(size * ratio)
    gh = int(glyph.height * gw / glyph.width)
    if gh > int(size * ratio):
        gh = int(size * ratio); gw = int(glyph.width * gh / glyph.height)
    g = glyph.resize((gw, gh), Image.LANCZOS)
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    solid = Image.new("RGBA", (gw, gh), color + (255,))
    layer.paste(solid, ((size - gw) // 2, (size - gh) // 2), g)
    return layer

# --- adaptive foreground: 108dp canvas, glyph inside the 72dp safe zone -------
fg = glyph_layer(432, 0.56)
fg.save(os.path.join(RES, "drawable", "ic_launcher_foreground.png"))
for d, s in [("mdpi", 108), ("hdpi", 162), ("xhdpi", 216), ("xxhdpi", 324), ("xxxhdpi", 432)]:
    p = os.path.join(RES, "drawable-" + d)
    os.makedirs(p, exist_ok=True)
    fg.resize((s, s), Image.LANCZOS).save(os.path.join(p, "ic_launcher_foreground.png"))

# --- legacy launcher icons (API 23–25) ---------------------------------------
def rounded_bg(size, radius_ratio=0.22, circle=False):
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # vertical saffron gradient
    grad = Image.new("RGBA", (size, size))
    gd = ImageDraw.Draw(grad)
    for y in range(size):
        t = y / max(1, size - 1)
        c = tuple(int(SAFFRON[i] + (DEEP[i] - SAFFRON[i]) * t) for i in range(3)) + (255,)
        gd.line([(0, y), (size, y)], fill=c)
    m = Image.new("L", (size, size), 0)
    md = ImageDraw.Draw(m)
    if circle:
        md.ellipse([0, 0, size - 1, size - 1], fill=255)
    else:
        md.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * radius_ratio), fill=255)
    im.paste(grad, (0, 0), m)
    return im

for d, s in [("mdpi", 48), ("hdpi", 72), ("xhdpi", 96), ("xxhdpi", 144), ("xxxhdpi", 192)]:
    p = os.path.join(RES, "mipmap-" + d)
    os.makedirs(p, exist_ok=True)
    for name, circle in [("ic_launcher.png", False), ("ic_launcher_round.png", True)]:
        base = rounded_bg(s, circle=circle)
        g = glyph_layer(s, 0.62)
        base.alpha_composite(g)
        base.save(os.path.join(p, name))

# --- notification small icon: pure white silhouette, 24dp --------------------
for d, s in [("mdpi", 24), ("hdpi", 36), ("xhdpi", 48), ("xxhdpi", 72), ("xxxhdpi", 96)]:
    p = os.path.join(RES, "drawable-" + d)
    os.makedirs(p, exist_ok=True)
    glyph_layer(s, 0.86, (255, 255, 255)).save(os.path.join(p, "ic_stat_seva.png"))
glyph_layer(24, 0.86, (255, 255, 255)).save(os.path.join(RES, "drawable", "ic_stat_seva.png"))

# --- splash logo -------------------------------------------------------------
sp = rounded_bg(512, radius_ratio=0.26)
sp.alpha_composite(glyph_layer(512, 0.62))
os.makedirs(os.path.join(RES, "drawable-nodpi"), exist_ok=True)
sp.save(os.path.join(RES, "drawable-nodpi", "splash_logo.png"))

# --- web-bundle copies -------------------------------------------------------
sp.resize((256, 256), Image.LANCZOS).save(os.path.join(WEB, "logo.png"), optimize=True)
glyph_layer(256, 0.78, CREAM).save(os.path.join(WEB, "glyph.png"), optimize=True)
glyph_layer(192, 0.80, (232, 115, 12)).save(os.path.join(WEB, "glyph-saffron.png"), optimize=True)

# hero photos -> compact jpg
for name in ["hero_seva", "hero_satsang", "hero_jaap"]:
    src_p = os.path.join(os.path.dirname(ROOT), "assets_src", name + ".jpg")
    if not os.path.exists(src_p):
        continue
    im = Image.open(src_p).convert("RGB")
    im.thumbnail((1000, 1000), Image.LANCZOS)
    im.save(os.path.join(WEB, name + ".jpg"), quality=76, optimize=True, progressive=True)
    t = im.copy(); t.thumbnail((360, 360), Image.LANCZOS)
    t.save(os.path.join(WEB, name + "-sm.jpg"), quality=72, optimize=True)

print("icons + splash + web images written")
for root, dirs, files in os.walk(RES):
    for f in files:
        if f.endswith(".png"):
            print(" ", os.path.relpath(os.path.join(root, f), RES))
