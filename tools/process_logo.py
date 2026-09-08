#!/usr/bin/env python3
"""Build circular + adaptive launcher icons, splash & web logo from uploads/Screenshot_20260712_183357.jpg"""
import os
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "brand", "src", "logo_src.jpg")
img = Image.open(SRC).convert("RGBA")
W, H = img.size

# focus-crop: face + blessing hand, exclude punch-hole artifact (top) and SEVA/APP text (bottom)
side = min(W, int(H * 0.68))
cx = int(W * 0.50)
left = max(0, min(W - side, cx - side // 2))
top = int(H * 0.02)
box = (left, top, left + side, top + side)
sq = img.crop(box)

def circle_cut(im, ring_frac=0.0, ring_color=(217, 164, 65, 255)):
    """anti-aliased circular crop with optional thin ring"""
    s = im.size[0] * 4
    up = im.resize((s, s), Image.LANCZOS)
    mask = Image.new("L", (s, s), 0)
    d = ImageDraw.Draw(mask)
    d.ellipse([0, 0, s - 1, s - 1], fill=255)
    out = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    out.paste(up, (0, 0), mask)
    if ring_frac:
        rw = int(s * ring_frac)
        ov = Image.new("RGBA", (s, s), (0, 0, 0, 0))
        do = ImageDraw.Draw(ov)
        do.ellipse([rw // 2, rw // 2, s - 1 - rw // 2, s - 1 - rw // 2], outline=ring_color, width=rw)
        out = Image.alpha_composite(out, ov)
    return out.resize(im.size, Image.LANCZOS)

def save(im, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, "PNG")
    print("wrote", path, im.size)

# legacy launcher: circular photo, transparent corners
for d, px in {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}.items():
    save(circle_cut(sq.resize((px, px), Image.LANCZOS), 0.045),
         os.path.join(ROOT, "app", "res", f"mipmap-{d}", "ic_launcher.png"))

# adaptive: foreground = circular medallion w/ gold ring on transparency; background = deep maroon
fg = circle_cut(sq.resize((300, 300), Image.LANCZOS), 0.05)
canvas = Image.new("RGBA", (432, 432), (0, 0, 0, 0))
canvas.paste(fg, (66, 66), fg)
save(canvas, os.path.join(ROOT, "app", "res", "mipmap-anydpi-v26", "ic_launcher_foreground.png"))
save(Image.new("RGBA", (432, 432), (58, 22, 10, 255)),
     os.path.join(ROOT, "app", "res", "mipmap-anydpi-v26", "ic_launcher_background.png"))

# web / splash / brand: circular with alpha
web = circle_cut(sq.resize((512, 512), Image.LANCZOS), 0.035)
save(web, os.path.join(ROOT, "app", "assets", "web", "img", "logo.png"))
save(web, os.path.join(ROOT, "assets", "brand", "icon_512.png"))
save(circle_cut(sq.resize((192, 192), Image.LANCZOS), 0.04), os.path.join(ROOT, "assets", "brand", "icon_192.png"))
sp = Image.new("RGBA", (480, 480), (0, 0, 0, 0))
lg = circle_cut(sq.resize((300, 300), Image.LANCZOS), 0.045)
sp.paste(lg, (90, 90), lg)
save(sp, os.path.join(ROOT, "app", "res", "drawable", "splash_logo.png"))
print("OK")
