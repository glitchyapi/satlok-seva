#!/usr/bin/env python3
"""Generate all launcher/splash/web icon densities from assets/brand/logo_raw.png"""
import os, sys
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "brand", "logo_raw.png")
img = Image.open(SRC).convert("RGBA")

def rounded(im, radius_frac=0.24):
    w, h = im.size
    r = int(w * radius_frac)
    mask = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, 0, w - 1, h - 1], radius=r, fill=255)
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    out.paste(im, (0, 0), mask)
    return out

def save(im, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, "PNG")
    print("wrote", path, im.size)

# 1) legacy launcher icons (rounded squares)
dens = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
for d, px in dens.items():
    ic = rounded(img.resize((px, px), Image.LANCZOS))
    save(ic, os.path.join(ROOT, "app", "res", f"mipmap-{d}", "ic_launcher.png"))

# 2) adaptive icon layers (432x432 full-bleed)
fg = img.resize((432, 432), Image.LANCZOS)
save(fg, os.path.join(ROOT, "app", "res", "mipmap-anydpi-v26", "ic_launcher_foreground.png"))
bg = Image.new("RGBA", (432, 432), (46, 17, 8, 255))
save(bg, os.path.join(ROOT, "app", "res", "mipmap-anydpi-v26", "ic_launcher_background.png"))

# 3) splash / web logo (transparent-ish keep square)
save(img.resize((512, 512), Image.LANCZOS), os.path.join(ROOT, "app", "assets", "web", "img", "logo.png"))
save(rounded(img.resize((512, 512), Image.LANCZOS), 0.22), os.path.join(ROOT, "assets", "brand", "icon_512.png"))
save(rounded(img.resize((192, 192), Image.LANCZOS), 0.22), os.path.join(ROOT, "assets", "brand", "icon_192.png"))
# splash drawable bitmap (centered, 60% size on transparent)
sp = Image.new("RGBA", (480, 480), (0, 0, 0, 0))
sp.paste(img.resize((300, 300), Image.LANCZOS), (90, 90))
save(sp, os.path.join(ROOT, "app", "res", "drawable", "splash_logo.png"))
print("OK")
