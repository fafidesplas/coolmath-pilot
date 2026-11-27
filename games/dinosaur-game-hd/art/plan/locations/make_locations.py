"""Location concept mockups: 5 non-desert passes at the game's art resolution
(320x180 art px = 640x360 logical), with the real sprites on top, saved at 4x."""
import math, random, sys
from PIL import Image, ImageDraw, ImageFilter, ImageChops

ROOT = sys.argv[1]
OUT = ROOT + "/art/plan/locations"
W, H, GY = 320, 180, 125           # art size, ground line
INK = (27, 35, 64)

def rgb(h): h = h.lstrip('#'); return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))
def frame(name, i, w, h):
    return Image.open(f"{ROOT}/assets/sprites/{name}.png").convert("RGBA").crop((i*w, 0, i*w+w, h))

def bands(img, cols, y0=0, y1=GY):
    n = len(cols); d = ImageDraw.Draw(img)
    for i, c in enumerate(cols):
        a = y0 + (y1-y0)*i//n; b = y0 + (y1-y0)*(i+1)//n
        d.rectangle((0, a, W, b), fill=rgb(c))

def layer(): return Image.new("RGBA", (W, H), (0, 0, 0, 0))
def outline(lay, col=INK):
    """Put a 1 art px outline around everything opaque on lay."""
    a = lay.split()[3].point(lambda v: 255 if v > 0 else 0)
    ring = ImageChops.subtract(a.filter(ImageFilter.MaxFilter(3)), a)
    out = Image.new("RGBA", (W, H), col + (255,)); out.putalpha(ring)
    res = layer(); res.alpha_composite(out); res.alpha_composite(lay); return res

def ridge(d, y, amp, step, col, seed, sharp=False):
    r = random.Random(seed); pts = [(0, H)]; x = 0
    while x <= W + step:
        hgt = y - r.randint(0, amp)
        pts.append((x, hgt)); x += step if sharp else r.randint(step//2, step)
    pts.append((W, H)); d.polygon(pts, fill=rgb(col))

def ground(img, top, body, speck, seed, edge=None):
    d = ImageDraw.Draw(img); r = random.Random(seed)
    d.rectangle((0, GY, W, H), fill=rgb(body))
    d.rectangle((0, GY, W, GY), fill=rgb(top))
    if edge: d.rectangle((0, GY+1, W, GY+2), fill=rgb(edge))
    for _ in range(160):
        x, y = r.randrange(W), r.randrange(GY+4, H)
        d.rectangle((x, y, x + r.choice((0, 1, 2)), y), fill=rgb(speck))

DIG = {"0": ["0110","1001","1001","1001","1001","0110"],
       "4": ["0010","0110","1010","1111","0010","0010"]}
def text(img, s, x, y, col=INK):
    d = ImageDraw.Draw(img)
    for ch in s:
        for j, row in enumerate(DIG[ch]):
            for i, b in enumerate(row):
                if b == "1": d.point((x+i, y+j), fill=col)
        x += 5

def hud_and_cast(img, egg_y_off=0, hud_col=INK, obstacles=None):
    # eggs: an arc over the big obstacle, like the run screenshot
    egg = frame("egg", 0, 7, 9)
    for ex, ey in [(266, 79), (281, 68), (296, 63), (311, 64)]:
        img.alpha_composite(egg, (ex, ey + egg_y_off))
    img.alpha_composite(frame("trex", 0, 30, 25), (24, GY - 25 + 1))
    img.alpha_composite(egg, (5, 6)); text(img, "0", 14, 7, hud_col)
    text(img, "00044", 147, 7, hud_col)
    img.alpha_composite(frame("ui-icons", 0, 12, 12), (304, 4))

def save(img, name):
    img.convert("RGB").resize((W*4, H*4), Image.NEAREST).save(f"{OUT}/{name}.png")

# ---------------------------------------------------------------- 1 jungle
def jungle():
    img = Image.new("RGBA", (W, H)); bands(img, ["#F6EDB5", "#E4EBB4", "#CDE5B0", "#B5DCAC", "#9DD0A6"])
    d = ImageDraw.Draw(img)
    r = random.Random(3)
    for x in range(-10, W, 14):  # far canopy
        d.ellipse((x, 70 + r.randint(0, 10), x + 26, 96 + r.randint(0, 6)), fill=rgb("#8CC09A"))
    d.rectangle((0, 92, W, GY), fill=rgb("#8CC09A"))
    # far cliff and waterfall
    d.polygon([(205, GY), (215, 62), (240, 55), (262, 60), (272, GY)], fill=rgb("#7FB59A"))
    d.rectangle((236, 60, 243, GY), fill=rgb("#E8F6F2")); d.rectangle((239, 60, 240, GY), fill=rgb("#FFFFFF"))
    for x in range(228, 252, 3): d.ellipse((x, 98 + (x % 5), x + 6, 104 + (x % 5)), fill=rgb("#E8F6F2"))
    # light shafts
    sh = layer(); s = ImageDraw.Draw(sh)
    for x in (40, 120, 180, 290): s.polygon([(x, 0), (x + 14, 0), (x - 26, GY), (x - 40, GY)], fill=(255, 250, 200, 60))
    img.alpha_composite(sh)
    # mid trunks, canopy, vines
    for x in (12, 70, 150, 228, 300):
        d.rectangle((x, 20, x + 8, GY), fill=rgb("#5C7A44")); d.rectangle((x + 6, 20, x + 8, GY), fill=rgb("#4A6538"))
    for x in range(-20, W, 22):
        d.ellipse((x, -14 + (x * 7) % 12, x + 40, 26 + (x * 7) % 12), fill=rgb("#3F8C50"))
        d.ellipse((x + 6, -10 + (x * 7) % 12, x + 30, 14 + (x * 7) % 12), fill=rgb("#57A862"))
    for x in range(8, W, 19):
        L = 20 + (x * 13) % 30; d.line((x, 18, x, 18 + L), fill=rgb("#3B7A44"))
        d.point((x - 1, 18 + L), fill=rgb("#57A862"))
    # near ferns
    for cx in range(-6, W, 18):
        base = GY; h = 12 + (cx * 5) % 9
        for k in range(-3, 4):
            d.line((cx, base, cx + k * 4, base - h + abs(k) * 2), fill=rgb("#2F7A3E"), width=2)
    ground(img, "#4E9A3C", "#6B4A2E", "#4E3420", 11, edge="#3F7F32")
    # obstacles: thorn bushes (small) and a fallen log on end (large)
    ob = layer(); o = ImageDraw.Draw(ob)
    def bush(x, w, h):
        o.ellipse((x, GY - h, x + w, GY + 2), fill=rgb("#2E6B34"))
        o.ellipse((x + 2, GY - h + 2, x + w - 3, GY - h // 2), fill=rgb("#3F8C44"))
        for t in range(x + 1, x + w, 3): o.point((t, GY - h - 1 + (t % 2)), fill=rgb("#F2E3B3"))
        o.point((x - 1, GY - h // 2), fill=rgb("#F2E3B3")); o.point((x + w, GY - h // 2 - 1), fill=rgb("#F2E3B3"))
    bush(4, 10, 18); bush(296, 10, 18)
    o.rectangle((157, GY - 26, 171, GY), fill=rgb("#8A5A34")); o.rectangle((166, GY - 26, 171, GY), fill=rgb("#6E4628"))
    o.ellipse((157, GY - 30, 171, GY - 22), fill=rgb("#C99A62")); o.ellipse((161, GY - 28, 167, GY - 24), fill=rgb("#A87A48"))
    o.rectangle((157, GY - 14, 162, GY - 12), fill=rgb("#57A862"))
    img.alpha_composite(outline(ob))
    hud_and_cast(img); save(img, "loc-jungle")

# ---------------------------------------------------------------- 2 volcano
def volcano():
    img = Image.new("RGBA", (W, H)); bands(img, ["#3A1E3A", "#4E2240", "#6B2A3A", "#8C3636", "#B04A30", "#D8693A"])
    d = ImageDraw.Draw(img)
    for i, (x, y, rr) in enumerate([(206, 30, 10), (196, 18, 13), (214, 8, 15), (226, -4, 18)]):  # smoke
        d.ellipse((x - rr, y - rr, x + rr, y + rr), fill=rgb("#5A3A4E" if i % 2 else "#4E3346"))
    d.polygon([(130, GY), (192, 44), (220, 44), (290, GY)], fill=rgb("#2A1E28"))
    d.rectangle((194, 42, 218, 45), fill=rgb("#FFC24A"))
    for pts in [[(200, 45), (196, 70), (186, 96), (180, GY)], [(212, 45), (220, 78), (234, 104), (240, GY)]]:
        d.line(pts, fill=rgb("#F08A24"), width=2); d.line(pts, fill=rgb("#FFC24A"))
    ridge(d, 100, 18, 16, "#3B2B33", 5, sharp=True)
    ridge(d, 114, 8, 10, "#4A3640", 9)
    ground(img, "#5A4650", "#2E2830", "#45383F", 21)
    for x0 in range(10, W, 46):  # glowing cracks
        d.line([(x0, GY + 8), (x0 + 6, GY + 14), (x0 + 3, GY + 22), (x0 + 10, GY + 30)], fill=rgb("#F08A24"))
    ob = layer(); o = ImageDraw.Draw(ob)
    def spikes(x, w, h, n):
        for k in range(n):
            sx = x + k * w // n; sw = w // n + 2; hh = h - (k % 2) * h // 3
            o.polygon([(sx, GY), (sx + sw // 2, GY - hh), (sx + sw, GY)], fill=rgb("#15121A"))
            o.line([(sx + sw // 2, GY - hh), (sx + sw, GY)], fill=rgb("#F08A24"))
    spikes(4, 10, 20, 2); spikes(156, 15, 27, 3); spikes(296, 10, 20, 2)
    img.alpha_composite(outline(ob, (10, 6, 12)))
    r = random.Random(7)
    for _ in range(40):
        x, y = r.randrange(W), r.randrange(10, GY)
        d.point((x, y), fill=rgb(r.choice(["#FFC24A", "#F08A24", "#FF6A3A"])))
    hud_and_cast(img, hud_col=rgb("#FFF6E0")); save(img, "loc-volcano")

# ---------------------------------------------------------------- 3 ice
def ice():
    img = Image.new("RGBA", (W, H)); bands(img, ["#B9C7EA", "#C6D3EE", "#D3DEF2", "#DEE7F5", "#E8EFF8"])
    au = layer(); a = ImageDraw.Draw(au)
    for x in range(W):
        y = 26 + int(8 * math.sin(x / 22)) + int(4 * math.sin(x / 7))
        a.line((x, y, x, y + 10 + int(4 * math.sin(x / 13))), fill=(130, 235, 200, 90))
        a.line((x, y + 2, x, y + 5), fill=(190, 255, 225, 110))
    img.alpha_composite(au)
    d = ImageDraw.Draw(img)
    for px, ph, pw in [(30, 52, 60), (110, 38, 70), (200, 48, 66), (280, 40, 60)]:
        d.polygon([(px - pw, GY), (px, ph), (px + pw, GY)], fill=rgb("#A9C4E4"))
        d.polygon([(px, ph), (px + pw, GY), (px + 6, GY)], fill=rgb("#93B0D6"))
        d.polygon([(px - 10, ph + 14), (px, ph), (px + 10, ph + 14), (px + 4, ph + 11), (px - 3, ph + 16)], fill=rgb("#F4F8FC"))
    ridge(d, 104, 6, 26, "#E6EEF8", 4)
    for x in range(6, W, 23):
        h = 18 + (x * 7) % 10
        for k in range(3):
            y = GY - 6 - k * h // 3
            d.polygon([(x - 7 + k * 2, y), (x, y - h // 2), (x + 7 - k * 2, y)], fill=rgb("#5D7FA3"))
            d.line([(x - 4 + k * 2, y - 2), (x, y - h // 2)], fill=rgb("#F4F8FC"))
        d.rectangle((x - 1, GY - 6, x, GY), fill=rgb("#6E5A6E"))
    ridge(d, 118, 4, 30, "#F4F8FC", 8)
    ground(img, "#B0C4E0", "#F4F8FC", "#C9D8EC", 31)
    ob = layer(); o = ImageDraw.Draw(ob)
    def crystal(x, w, h):
        o.polygon([(x, GY), (x + 2, GY - h * 2 // 3), (x + w // 2, GY - h), (x + w - 2, GY - h * 2 // 3), (x + w, GY)], fill=rgb("#9FD8F0"))
        o.polygon([(x + w // 2, GY - h), (x + w - 2, GY - h * 2 // 3), (x + w, GY), (x + w // 2, GY)], fill=rgb("#78BCE0"))
        o.line([(x + 3, GY - 3), (x + w // 2 - 1, GY - h + 3)], fill=rgb("#E8FAFF"))
    crystal(4, 10, 20); crystal(296, 10, 20); crystal(156, 9, 27); crystal(163, 8, 18)
    img.alpha_composite(outline(ob, rgb("#3A4E7A")))
    r = random.Random(2)
    for _ in range(50): d.point((r.randrange(W), r.randrange(0, GY)), fill=(255, 255, 255))
    hud_and_cast(img); save(img, "loc-ice")

# ---------------------------------------------------------------- 4 coast
def coast():
    img = Image.new("RGBA", (W, H)); bands(img, ["#7FCDEB", "#96D6EE", "#ADE0F1", "#C4E9F3", "#DAF1F3"], 0, 92)
    d = ImageDraw.Draw(img)
    for cx, cy in [(60, 22), (250, 30)]:
        for dx in (0, 10, 20): d.ellipse((cx + dx, cy - (dx % 20) // 3, cx + dx + 16, cy + 8), fill=rgb("#FFFFFF"))
    d.rectangle((0, 92, W, GY), fill=rgb("#3FB8C8"))
    for y in range(95, GY, 6):
        for x in range((y * 7) % 20, W, 20): d.line((x, y, x + 5, y), fill=rgb("#7AD6DE"))
    d.polygon([(230, 92), (250, 80), (270, 92)], fill=rgb("#8AB89A"))  # island
    for sx, sh, sw in [(96, 50, 12), (114, 66, 8), (300, 58, 14)]:  # sea stacks
        d.rectangle((sx, sh, sx + sw, 100), fill=rgb("#8A7A9A")); d.rectangle((sx + sw - 3, sh, sx + sw, 100), fill=rgb("#6E5E82"))
        d.rectangle((sx - 1, sh - 2, sx + sw + 1, sh + 1), fill=rgb("#5EA866"))
    d.line([(188, 92), (189, 84), (192, 78), (196, 76)], fill=rgb("#2E6A7A"), width=2)  # plesiosaur
    d.ellipse((182, 89, 192, 94), fill=rgb("#2E6A7A"))
    d.polygon([(0, GY), (0, 112), (60, 108), (140, 114), (220, 106), (320, 112), (320, GY)], fill=rgb("#F3E3C9"))
    for x in (40, 150, 262):  # cycad palms
        d.line([(x, GY - 4), (x + 2, 80), (x + 5, 70)], fill=rgb("#8A6A4A"), width=3)
        for ang in range(-150, 31, 30):
            ex = x + 5 + int(16 * math.cos(math.radians(ang))); ey = 70 + int(10 * math.sin(math.radians(ang))) + 5
            d.line([(x + 5, 70), (ex, ey)], fill=rgb("#3E8A4E"), width=2)
            d.point((ex, ey + 1), fill=rgb("#4EA55A"))
    ground(img, "#7AD6DE", "#E9DCD0", "#C9B8B0", 41, edge="#CFE9E6")
    for x in range(20, W, 70):  # tide pools and shells
        d.ellipse((x, GY + 18, x + 22, GY + 24), fill=rgb("#6FCAD6")); d.point((x + 30, GY + 40), fill=rgb("#F0787A"))
    ob = layer(); o = ImageDraw.Draw(ob)
    def coral(x, w, h):
        for k, (ox, hh) in enumerate([(0, h * 2 // 3), (w // 3, h), (w * 2 // 3, h * 3 // 4)]):
            o.rectangle((x + ox, GY - hh, x + ox + 3, GY), fill=rgb("#F0787A"))
            o.rectangle((x + ox - 1, GY - hh - 1, x + ox + 4, GY - hh + 1), fill=rgb("#FFB0A8"))
        o.rectangle((x, GY - 4, x + w, GY), fill=rgb("#D85E68"))
    coral(4, 10, 19); coral(296, 10, 19)
    for ox, hh in [(0, 18), (4, 27), (9, 22), (12, 14)]:
        o.rectangle((156 + ox, GY - hh, 158 + ox, GY), fill=rgb("#F59A3A"))
        o.point((155 + ox, GY - hh + 4), fill=rgb("#F59A3A")); o.point((159 + ox, GY - hh + 7), fill=rgb("#F59A3A"))
        o.point((157 + ox, GY - hh), fill=rgb("#FFD28A"))
    o.rectangle((155, GY - 5, 172, GY), fill=rgb("#C9762E"))
    img.alpha_composite(outline(ob))
    hud_and_cast(img); save(img, "loc-coast")

# ---------------------------------------------------------------- 5 swamp
def swamp():
    img = Image.new("RGBA", (W, H)); bands(img, ["#1B2340", "#232A52", "#2E2D5E", "#3E3468", "#523C72", "#6A4A7E"])
    d = ImageDraw.Draw(img)
    d.ellipse((250, 18, 274, 42), fill=rgb("#F2E6D0")); d.ellipse((256, 24, 262, 30), fill=rgb("#DCCDB4"))
    r = random.Random(5)
    for _ in range(40): d.point((r.randrange(W), r.randrange(0, 60)), fill=rgb("#FFF6E0"))
    for x in range(-10, W, 34):  # far mangroves
        d.ellipse((x, 60, x + 40, 86), fill=rgb("#2A2F4E"))
        for k in range(4): d.line([(x + 8 + k * 8, 84), (x + 4 + k * 10, 100)], fill=rgb("#2A2F4E"), width=2)
    d.rectangle((0, 98, W, 110), fill=rgb("#2E3A5E"))
    for x in range(0, W, 9): d.line((x, 101 + (x % 3) * 3, x + 4, 101 + (x % 3) * 3), fill=rgb("#46527E"))
    gl = layer(); g = ImageDraw.Draw(gl)
    for x, h, w, c in [(30, 40, 26, "#4FE0D8"), (120, 54, 34, "#F07AB8"), (210, 36, 22, "#4FE0D8"), (290, 48, 30, "#F07AB8")]:
        g.ellipse((x - w, GY - h - w // 2 - 8, x + w, GY - h + w // 2 + 8), fill=rgb(c) + (50,))
    img.alpha_composite(gl)
    for x, h, w, c in [(30, 40, 26, "#4FE0D8"), (120, 54, 34, "#F07AB8"), (210, 36, 22, "#4FE0D8"), (290, 48, 30, "#F07AB8")]:
        d.rectangle((x - 2, GY - h, x + 2, GY), fill=rgb("#CFC2E0")); d.rectangle((x + 1, GY - h, x + 2, GY), fill=rgb("#A898C4"))
        d.pieslice((x - w // 2, GY - h - w // 3, x + w // 2, GY - h + w // 3), 180, 360, fill=rgb(c))
        for k in range(-w // 3, w // 3 + 1, 5): d.point((x + k, GY - h - 3 - abs(k) // 4), fill=rgb("#FFF6E0"))
    ridge(d, 117, 5, 14, "#2E3A2E", 6)
    ground(img, "#4E6A3A", "#3A3A2E", "#2C2C22", 51, edge="#3E5230")
    ob = layer(); o = ImageDraw.Draw(ob)
    def cattails(x, w, h):
        o.polygon([(x - 1, GY), (x + w // 2, GY - 7), (x + w + 1, GY)], fill=rgb("#5E9A44"))
        for k, hh in enumerate([h, h - 5, h - 2]):
            sx = x + 1 + k * (w - 2) // 2
            o.line((sx + 1, GY - hh + 6, sx + 1, GY), fill=rgb("#6FB04E"))
            o.rectangle((sx, GY - hh, sx + 2, GY - hh + 6), fill=rgb("#B07848"))
    cattails(4, 10, 20); cattails(296, 10, 20)
    o.polygon([(155, GY), (158, GY - 18), (160, GY - 27), (163, GY - 14), (166, GY - 23), (168, GY - 12), (172, GY)], fill=rgb("#5E9A44"))
    o.line([(160, GY - 25), (161, GY - 4)], fill=rgb("#86C460"))
    for t in [(156, GY - 12), (163, GY - 20), (170, GY - 8), (159, GY - 6), (167, GY - 16)]: o.point(t, fill=rgb("#FF8AC8"))
    img.alpha_composite(outline(ob, (12, 14, 28)))
    for _ in range(26):
        x, y = r.randrange(W), r.randrange(40, GY - 2)
        d.point((x, y), fill=rgb("#FFF07A")); d.point((x + 1, y), fill=rgb("#B8A84A"))
    hud_and_cast(img, hud_col=rgb("#FFF6E0")); save(img, "loc-swamp")

for f in (jungle, volcano, ice, coast, swamp): f()
print("ok")
