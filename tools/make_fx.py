# =====================================================================
#  VolleyStars pixel effects generator.
#  Run:  python3 tools/make_fx.py   (needs Pillow)  -> writes assets/fx/*.png
#  Every effect is a horizontal sprite sheet (frames side by side) drawn on
#  the same 2-pixel grid as the creature art (the game scales them up crisply).
# =====================================================================
import math, random, os
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "fx")
os.makedirs(OUT, exist_ok=True)

# 5-color palettes, dark edge -> hot center
PAL = {
    "fire":    ["#7a160c", "#d4301b", "#ff7a1a", "#ffc83a", "#fff4c2"],
    "hot":     ["#d4301b", "#ff7a1a", "#ffc83a", "#fff4c2", "#ffffff"],
    "shadow":  ["#2a0a4a", "#5a1a9a", "#8b3fe0", "#c58bff", "#f0dcff"],
    "tidal":   ["#0a3a8a", "#1a6aff", "#3fa8ff", "#8fd8ff", "#e8f8ff"],
    "toxic":   ["#3a0a5a", "#7a2ad8", "#4fc93a", "#9dff5a", "#eaffc4"],
    "seed":    ["#1f5a1f", "#2e9e3a", "#5fd35f", "#b6ff9c", "#f0ffe0"],
    "lantern": ["#6a1a00", "#d45a00", "#ff8c1a", "#ffc84a", "#fff2c0"],
    "dust":    ["#5a4028", "#8a6440", "#b08a5a", "#d8b888", "#f2e2c4"],
    "gold":    ["#8a5a00", "#d49a00", "#ffcc33", "#ffe88a", "#ffffff"],
    "ice":     ["#1a3a6a", "#3f7fd0", "#8fd0ff", "#dff4ff", "#ffffff"],
    "volt":    ["#2a2a8a", "#3f7bff", "#7ad8ff", "#fff27a", "#ffffff"],
}
SMOKE = {
    "gray":   ((150, 138, 136, 255), (104, 94, 94, 255), (58, 50, 52, 255)),
    "purple": ((140, 90, 190, 255), (90, 50, 140, 255), (40, 18, 70, 255)),
    "dust":   ((216, 184, 136, 255), (176, 138, 90, 255), (110, 80, 50, 255)),
}

def rgb(h): return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,)

def hsh(x, y, k, s=0):
    v = math.sin(x * 12.9898 + y * 78.233 + k * 37.719 + s * 11.13) * 43758.5453
    return v - math.floor(v)

def quant(heat, pal, cut=0.12):
    if heat < cut: return None
    idx = 0
    for i, t in enumerate([0.12, 0.3, 0.5, 0.72, 0.9]):
        if heat >= t: idx = i
    return rgb(pal[idx])

def sheet(frames, w, h=None):
    return Image.new("RGBA", (w * frames, h or w), (0, 0, 0, 0))

# ---------------------------------------------------------------- flame ring
def flame_ring(pal, size, length, frames=8, rb=11.5, seed=1):
    rnd = random.Random(seed)
    sh = sheet(frames, size)
    c = (size - 1) / 2
    sparks = [(rnd.uniform(0, 2 * math.pi), rnd.uniform(0, 1)) for _ in range(7)]
    for f in range(frames):
        ph = 2 * math.pi * f / frames
        im = Image.new("RGBA", (size, size)); px = im.load()
        for y in range(size):
            for x in range(size):
                dx, dy = x - c, y - c
                r = math.hypot(dx, dy)
                if r < rb - 1.5: continue
                th = math.atan2(dy, dx)
                up = max(0.0, -math.sin(th))
                L = (length + 3.4 * (0.5 + 0.5 * math.sin(5 * th + ph)) + 1.8 * (0.5 + 0.5 * math.sin(8 * th - 2 * ph + 1.3))
                     + 1.2 * (0.5 + 0.5 * math.sin(3 * th + 3 * ph + 2.1))) * (1 + 0.9 * up)
                v = 1 - (r - (rb - 1.5)) / L
                col = quant(v + (hsh(x, y, f) - 0.5) * 0.07, pal)
                if col: px[x, y] = col
        for i, (a, off) in enumerate(sparks):
            t = (f / frames + off) % 1
            sx = int(round(c + math.cos(a) * (rb + 2) + math.sin(t * 6 + i) * 1.5))
            sy = int(round(c - (rb + 3) - t * (length + 5)))
            if 0 <= sx < size and 0 <= sy < size and t < 0.85:
                px[sx, sy] = rgb(pal[4 if t < 0.4 else 3])
        sh.paste(im, (f * size, 0))
    return sh

# ---------------------------------------------------------------- explosions
def draw_puff(px, size, cx, cy, r, light, dark, outline):
    for y in range(int(cy - r - 2), int(cy + r + 2)):
        for x in range(int(cx - r - 2), int(cx + r + 2)):
            if not (0 <= x < size and 0 <= y < size): continue
            d = math.hypot(x - cx, y - cy)
            if d <= r:
                px[x, y] = light if (x - cx) + (y - cy) < -r * 0.3 else dark
            elif d <= r + 1 and px[x, y][3] == 0:
                px[x, y] = outline

def burst(pal, size=64, frames=10, seed=3, smoke="gray", ember_pal=None, scale=1.0, n_embers=16, n_puffs=7):
    rnd = random.Random(seed)
    sh = sheet(frames, size)
    c = (size - 1) / 2
    ph = [rnd.uniform(0, 6.28) for _ in range(2)]
    R = [r * scale for r in [5, 10, 15, 19, 21, 20, 17, 13, 8, 0]]
    T = [1.35, 1.3, 1.15, 1.0, 0.85, 0.7, 0.55, 0.45, 0.35, 0]
    ember_pal = ember_pal or pal
    embers = [(rnd.uniform(0, 2 * math.pi), rnd.uniform(0.9, 1.6)) for _ in range(n_embers)]
    puffs = [(rnd.uniform(0, 2 * math.pi), rnd.uniform(6, 13) * scale, rnd.uniform(3.5, 5.5) * max(0.6, scale)) for _ in range(n_puffs)]
    for f in range(frames):
        im = Image.new("RGBA", (size, size)); px = im.load()
        cy = c + 4 * scale - f * 0.8 * scale
        if smoke and f >= 4:
            k = (f - 4) / (frames - 4)
            for a, dist, r0 in puffs:
                r = r0 * (0.7 + 0.8 * math.sin(math.pi * min(1, k * 1.1)))
                if f == frames - 1: r *= 0.6
                draw_puff(px, size, c + math.cos(a) * dist * (1 + k * 0.6), cy + math.sin(a) * dist * (0.6 + k * 0.4) - k * 8 * scale, r, *SMOKE[smoke])
        if R[f] > 0:
            for y in range(size):
                for x in range(size):
                    dx, dy = x - c, y - cy
                    d = math.hypot(dx, dy)
                    th = math.atan2(dy, dx)
                    rr = R[f] * (1 + 0.2 * math.sin(5 * th + ph[0]) + 0.1 * math.sin(9 * th + ph[1] + f * 0.7) + 0.3 * max(0, -math.sin(th)))
                    if d > rr: continue
                    v = 1 - d / rr
                    col = quant((v * 0.85 + 0.2) * T[f] + (hsh(x, y, f, 7) - 0.5) * 0.06, pal)
                    if col: px[x, y] = col
        for a, sp in embers:
            dist = 4 * scale + f * 3.2 * sp * scale
            ex = int(round(c + math.cos(a) * dist))
            ey = int(round(cy + math.sin(a) * dist + 0.15 * f * f * scale))
            if 0 <= ex < size and 0 <= ey < size and 1 <= f < frames - 1:
                px[ex, ey] = rgb(ember_pal[4 if f < 4 else 3 if f < 7 else 2])
                if f < 5 and ey + 1 < size: px[ex, ey + 1] = rgb(ember_pal[2])
        sh.paste(im, (f * size, 0))
    return sh

# ---------------------------------------------------------------- water splash
def splash(size=64, frames=10, seed=5, scale=1.0):
    pal = PAL["tidal"]
    rnd = random.Random(seed)
    sh = sheet(frames, size)
    c = (size - 1) / 2
    base = c + 14 * scale
    drops = [(rnd.uniform(-1, 1), rnd.uniform(1.6, 3.2)) for _ in range(22)]
    for f in range(frames):
        im = Image.new("RGBA", (size, size)); px = im.load()
        t = f / (frames - 1)
        # crown: a burst of water that rises then collapses
        h = 30 * scale * math.sin(math.pi * min(1, t * 1.3))
        w = (9 + 13 * t) * scale
        for y in range(size):
            for x in range(size):
                dx = (x - c) / max(1, w)
                dy = (base - y) / max(1, h) if h > 0.5 else 9
                if 0 <= dy <= 1 and abs(dx) <= 1:
                    edge = abs(dx) ** 2 + (dy ** 3) * 0.8
                    if edge <= 1:
                        heat = 1 - edge + (hsh(x, y, f, 3) - 0.5) * 0.08
                        col = quant(heat * (1.2 - 0.6 * t), pal)
                        if col: px[x, y] = col
        # flat ring on the floor
        rr = (6 + 22 * t) * scale
        for x in range(size):
            for y in range(size):
                e = ((x - c) / rr) ** 2 + ((y - base) / (rr * 0.33)) ** 2
                if 0.75 <= e <= 1.0 and t < 0.95:
                    px[x, y] = rgb(pal[3 if t < 0.5 else 2])
        # droplets arcing out and falling
        for vx, vy in drops:
            tt = t * 3
            dxp = c + vx * 18 * scale * tt
            dyp = base - (vy * 9 * tt - 4.5 * tt * tt) * scale
            ix, iy = int(round(dxp)), int(round(dyp))
            if 0 <= ix < size - 1 and 0 <= iy < size - 1 and iy <= base and 0 < f < frames - 1:
                px[ix, iy] = px[ix + 1, iy] = rgb(pal[4])
                px[ix, iy + 1] = px[ix + 1, iy + 1] = rgb(pal[2])
        sh.paste(im, (f * size, 0))
    return sh

# ---------------------------------------------------------------- floor shockwave
def wave(color, w=64, h=24, frames=6):
    sh = Image.new("RGBA", (w * frames, h))
    cx, cy = (w - 1) / 2, (h - 1) / 2
    for f in range(frames):
        im = Image.new("RGBA", (w, h)); px = im.load()
        t = (f + 1) / frames
        rx, ry = (w / 2 - 1) * t, (h / 2 - 1) * t
        thick = 0.22 if f < 3 else 0.14
        for y in range(h):
            for x in range(w):
                e = math.hypot((x - cx) / max(rx, 1), (y - cy) / max(ry, 1))
                if 1 - thick <= e <= 1:
                    if f < frames - 1 or (x + y) % 2 == 0:
                        px[x, y] = rgb(color)
        sh.paste(im, (f * w, 0))
    return sh

# ---------------------------------------------------------------- horn wall shield
def shield(w=14, h=44, frames=4):
    sh = Image.new("RGBA", (w * frames, h))
    pal = ["#8a4a00", "#d48a1a", "#ffcf7a", "#fff0c4"]
    for f in range(frames):
        im = Image.new("RGBA", (w, h)); px = im.load()
        for y in range(h):
            for x in range(w):
                e = ((x - (w - 1) / 2) / (w / 2)) ** 2 + ((y - (h - 1) / 2) / (h / 2)) ** 2
                if e > 1: continue
                if e > 0.78: px[x, y] = rgb(pal[1])
                else:
                    band = (y + f * 3) % 12
                    if band < 2: px[x, y] = rgb(pal[3])
                    elif (x + y) % 3 == 0: px[x, y] = rgb(pal[2])[:3] + (170,)
                    else: px[x, y] = rgb(pal[2])[:3] + (90,)
        sh.paste(im, (f * w, 0))
    return sh

# ---------------------------------------------------------------- spark star
def sparkle(size=24, frames=6):
    pal = PAL["gold"]
    sh = sheet(frames, size)
    c = (size - 1) / 2
    for f in range(frames):
        im = Image.new("RGBA", (size, size)); px = im.load()
        L = [3, 7, 10, 11, 9, 5][f]
        for i in range(-L, L + 1):
            for (x, y) in [(c + i, c), (c, c + i)]:
                col = pal[4] if abs(i) < 2 else pal[3] if abs(i) < L * 0.6 else pal[2]
                px[int(x), int(y)] = rgb(col)
            if abs(i) < L * 0.55:
                for (x, y) in [(c + i, c + i), (c + i, c - i)]:
                    px[int(x), int(y)] = rgb(pal[2])
        sh.paste(im, (f * size, 0))
    return sh

# ---------------------------------------------------------------- one small flickering flame
def small_flame(pal, w=14, h=20, frames=6):
    sh = Image.new("RGBA", (w * frames, h))
    cx = (w - 1) / 2
    for f in range(frames):
        ph = 2 * math.pi * f / frames
        im = Image.new("RGBA", (w, h)); px = im.load()
        top = 2 + 2 * (0.5 + 0.5 * math.sin(ph))
        sway = 1.4 * math.sin(ph + 1)
        for y in range(h):
            for x in range(w):
                ty = (y - top) / (h - 1 - top)            # 0 at the tip, 1 at the base
                if ty < 0: continue
                half = (w / 2 - 1) * (math.sin(ty * math.pi * 0.62) ** 1.3)
                if ty > 0.8: half *= 1 - ((ty - 0.8) / 0.2) ** 2 * 0.55  # rounded bottom
                dx = x - (cx + sway * (1 - ty))
                if abs(dx) > half: continue
                heat = (1 - abs(dx) / max(half, 0.5)) * 0.7 + ty * 0.45
                col = quant(heat + (hsh(x, y, f) - 0.5) * 0.05, pal, cut=0.1)
                if col: px[x, y] = col
        sh.paste(im, (f * w, 0))
    return sh

def save(img, name): img.save(os.path.join(OUT, name + ".png"))

if __name__ == "__main__":
    # flame rings: one per ability color, 3 sizes (momentum tiers)
    for name in ["fire", "hot", "shadow", "tidal", "toxic", "seed", "lantern", "ice", "volt"]:
        for tier, (size, length) in enumerate([(48, 3.2), (60, 6.0), (72, 8.6)], start=1):
            save(flame_ring(PAL[name], size, length, seed=tier), f"ring_{name}_{tier}")
    # big impacts
    save(burst(PAL["fire"], smoke="gray"), "boom_fire")
    save(burst(PAL["shadow"], smoke="purple", seed=7), "boom_shadow")
    save(burst(PAL["toxic"], smoke="purple", ember_pal=PAL["toxic"], seed=11), "boom_toxic")
    save(burst(PAL["seed"], smoke=None, seed=13, n_embers=24), "boom_seed")
    save(burst(PAL["lantern"], smoke="purple", ember_pal=PAL["shadow"], seed=17), "boom_lantern")
    save(splash(), "boom_tidal")
    save(burst(PAL["ice"], smoke=None, ember_pal=PAL["ice"], seed=23, n_embers=22), "boom_ice")
    save(burst(PAL["volt"], smoke=None, ember_pal=PAL["volt"], seed=29, n_embers=26), "boom_volt")
    save(sparkle(), "sparkle")
    # small bursts for ability activations, digs and blocks (32px)
    for name, pal, smk in [("fire", "fire", "gray"), ("shadow", "shadow", "purple"), ("toxic", "toxic", "purple"),
                           ("seed", "seed", None), ("lantern", "lantern", None), ("ghost", "shadow", None),
                           ("dust", "dust", "dust"), ("gold", "gold", None), ("ice", "ice", None), ("volt", "volt", None)]:
        save(burst(PAL[pal], size=32, scale=0.5, smoke=smk, n_embers=8, n_puffs=4, seed=21), f"puff_{name}")
    save(splash(size=32, scale=0.5), "puff_tidal")
    # floor shockwaves
    for name, col in [("white", "#ffffff"), ("gold", "#ffcc33"), ("orange", "#ff7a1a"), ("purple", "#b14dff"),
                      ("blue", "#4fc3ff"), ("green", "#5fd35f"), ("toxic", "#9dff5a")]:
        save(wave(col), f"wave_{name}")
    save(shield(), "shield")
    for name in ["fire", "shadow", "tidal", "toxic", "seed", "lantern", "gold", "ice", "volt"]:
        save(small_flame(PAL[name]), f"flame_{name}")
    print("done", len(os.listdir(OUT)), "files")
