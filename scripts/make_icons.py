"""Draw the app icons (run once): uv run --with pillow python scripts/make_icons.py

A navy-to-glacier tile with a rising white line chart and a small snowflake.
"""

import math
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "assets" / "icons"
TOP, BOTTOM = (14, 42, 69), (47, 111, 156)


def draw(size, maskable=False):
    s = size * 4  # supersample, then downscale for smooth edges
    img = Image.new("RGBA", (s, s))
    px = ImageDraw.Draw(img)
    for y in range(s):  # vertical gradient
        t = y / s
        px.line([(0, y), (s, y)], fill=tuple(int(a + (b - a) * t) for a, b in zip(TOP, BOTTOM)) + (255,))
    if not maskable:  # rounded corners
        mask = Image.new("L", (s, s), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * .22), fill=255)
        img.putalpha(mask)

    pad = s * (.26 if maskable else .18)
    w = s - 2 * pad
    pts = [(0, .78), (.22, .58), (.42, .66), (.64, .38), (1, .16)]
    xy = [(pad + x * w, pad + y * w) for x, y in pts]
    px.line(xy, fill=(255, 255, 255, 255), width=int(s * .055), joint="curve")
    r = s * .038
    for x, y in xy[1:]:
        px.ellipse([x - r, y - r, x + r, y + r], fill=(166, 219, 242, 255))

    # snowflake, upper left
    cx, cy, L = pad + w * .14, pad + w * .14, w * .13
    for k in range(6):
        a = math.pi / 3 * k
        ex, ey = cx + L * math.cos(a), cy + L * math.sin(a)
        px.line([(cx, cy), (ex, ey)], fill=(220, 240, 252, 255), width=int(s * .018))
    return img.resize((size, size), Image.LANCZOS)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    draw(192).save(OUT / "icon-192.png")
    draw(512).save(OUT / "icon-512.png")
    draw(512, maskable=True).save(OUT / "maskable-512.png")
    print("icons written to", OUT)
