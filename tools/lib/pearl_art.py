"""Motifs of the reference design, redrawn as clean vectors (units: mm, y down).

  * lanceolate gold leaves with a midrib and fine feather veins
  * pearl sprigs: hair-thin gold stalks, tiny gold calyx, layered pearl
  * the fleur ornament used in the dividers
  * the two interlocked hearts with the long calligraphic swash

Each function returns a dict of shapely geometries keyed by paint role:
    'gold'   -> gold line work / solids
    'leaf'   -> pale gold-tinted leaf fill
    'pearl'  -> list of pearl discs (each kept separate for per-pearl gradients)
    'shade'  -> pearl shading crescents
    'hi'     -> pearl highlights (paper white)
"""
import math
import random

from shapely.geometry import Point, Polygon, box
from shapely.ops import unary_union
from shapely import affinity

from linework import catmull, nib_stroke


def _empty():
    return dict(gold=[], leaf=[], pearl=[], shade=[], hi=[])


def merge(*parts):
    out = _empty()
    for p in parts:
        for k in out:
            out[k] += p.get(k, [])
    return out


def mono_line(pts, w, taper=(0.04, 0.5), wmin=None, step=0.03):
    """Near-monoline gold hairline (nib at 90deg keeps width ~constant)."""
    return nib_stroke(pts, w, w * 0.85 if wmin is None else wmin, nib=90, taper=taper, step=step)


# ------------------------------------------------------------------ leaf

def leaf(base, angle, L=7.0, W=1.9, w=0.15, veins=9, bend=0.25, vein_w=0.065):
    """Lanceolate leaf from `base` pointing at `angle` degrees (y-down, 0 = +x)."""
    a = math.radians(angle)
    ca, sa = math.cos(a), math.sin(a)

    def P(x, y):  # local (along, across) -> world
        return (base[0] + x * ca - y * sa, base[1] + x * sa + y * ca)

    def mid(t):
        return (L * t, -bend * L * 0.12 * math.sin(math.pi * t * 0.9))

    def width(t):  # widest ~ 35%, long acuminate tip
        return W / 2 * (math.sin(math.pi * min(t, 0.999) ** 0.72) ** 1.05)

    def tangent(t):
        p0, p1 = mid(max(t - 1e-3, 0)), mid(min(t + 1e-3, 1))
        dx, dy = p1[0] - p0[0], p1[1] - p0[1]
        n = math.hypot(dx, dy)
        return dx / n, dy / n

    def edge(sgn):
        pts = []
        for i in range(101):
            t = i / 100
            m = mid(t)
            tx, ty = tangent(t)
            pts.append(P(m[0] - ty * width(t) * sgn, m[1] + tx * width(t) * sgn))
        return pts
    e1, e2 = edge(1), edge(-1)
    fill = Polygon(e1 + e2[::-1]).buffer(0)
    g = [nib_stroke(e1, w, w * 0.35, nib=30, taper=(0.04, 0.12), step=0.03),
         nib_stroke(e2, w * 0.9, w * 0.35, nib=30, taper=(0.04, 0.12), step=0.03)]
    mpts = [P(*mid(i / 60 * 0.95)) for i in range(61)]
    g.append(mono_line(mpts, w * 0.75, taper=(0.02, 0.6)))
    # feather veins sweeping toward the tip
    for k in range(veins):
        t = 0.12 + 0.74 * k / max(veins - 1, 1)
        for sgn in (1, -1):
            t2 = min(t + 0.10, 0.97)
            m0, m2 = mid(t), mid(t2)
            tx, ty = tangent(t2)
            r = width(t2) * 0.86
            p0 = P(*m0)
            p2 = P(m2[0] - ty * r * sgn, m2[1] + tx * r * sgn)
            m1 = ((p0[0] + p2[0]) / 2, (p0[1] + p2[1]) / 2)
            g.append(mono_line([p0, m1, p2], vein_w, taper=(0.05, 0.6), step=0.02))
    return dict(gold=[unary_union(g)], leaf=[fill], pearl=[], shade=[], hi=[]), fill


# ------------------------------------------------------------------ pearls

def pearl(c, r):
    """Layered pearl: base disc, soft shading crescent (lower right), highlight."""
    disc = Point(c).buffer(r, resolution=32)
    shade = disc.difference(Point(c[0] - r * 0.28, c[1] - r * 0.30).buffer(r * 0.92, resolution=32))
    hi = affinity.rotate(Point(c[0] - r * 0.36, c[1] - r * 0.38).buffer(r * 0.24, resolution=16),
                         -35, origin=(c[0] - r * 0.36, c[1] - r * 0.38))
    hi = affinity.scale(hi, 1.0, 0.7)
    rim = disc.difference(Point(c).buffer(r - 0.045, resolution=32))  # hair-fine gold rim
    return dict(gold=[rim], leaf=[], pearl=[disc], shade=[shade], hi=[hi])


def pearl_on_stalk(p0, ang, length, r, w=0.09):
    a = math.radians(ang)
    c = (p0[0] + math.cos(a) * (length + r * 0.85), p0[1] + math.sin(a) * (length + r * 0.85))
    end = (p0[0] + math.cos(a) * (length + 0.05), p0[1] + math.sin(a) * (length + 0.05))
    mid = ((p0[0] + end[0]) / 2 + math.sin(a) * 0.12, (p0[1] + end[1]) / 2 - math.cos(a) * 0.12)
    stalk = mono_line(catmull([p0, mid, end], n=10), w, taper=(0.0, 0.0), step=0.02)
    # tiny gold calyx where the stalk meets the pearl
    cal = Polygon([(end[0] + math.cos(a + 1.9) * r * 0.42, end[1] + math.sin(a + 1.9) * r * 0.42),
                   (end[0] - math.cos(a) * 0.18, end[1] - math.sin(a) * 0.18),
                   (end[0] + math.cos(a - 1.9) * r * 0.42, end[1] + math.sin(a - 1.9) * r * 0.42),
                   (c[0] - math.cos(a) * r * 0.55, c[1] - math.sin(a) * r * 0.55)]).buffer(0.02)
    pr = pearl(c, r)
    pr['gold'] += [stalk, cal]
    return pr, c


def pearl_sprig(pts, n, r=(0.55, 0.78), stalk=(0.7, 1.5), side_ang=(38, 62), w=0.11, seed=1,
                terminal=True, start=0.18):
    """Branch through `pts` with alternating pearls on short stalks."""
    rnd = random.Random(seed)
    line = catmull(pts, n=20)
    parts = [dict(gold=[mono_line(line, w, taper=(0.02, 0.15))], leaf=[], pearl=[], shade=[], hi=[])]
    L = len(line)
    for k in range(n):
        t = start + (1 - start) * (k + 0.5) / n
        i = min(int(t * (L - 1)), L - 2)
        p, q = line[i], line[i + 1]
        heading = math.degrees(math.atan2(q[1] - p[1], q[0] - p[0]))
        sgn = 1 if k % 2 == 0 else -1
        ang = heading + sgn * rnd.uniform(*side_ang)
        pr, _ = pearl_on_stalk(p, ang, rnd.uniform(*stalk), rnd.uniform(*r))
        parts.append(pr)
    if terminal:
        p, q = line[-2], line[-1]
        heading = math.degrees(math.atan2(q[1] - p[1], q[0] - p[0]))
        pr, _ = pearl_on_stalk(q, heading, 0.35, r[1])
        parts.append(pr)
    return merge(*parts)


# ------------------------------------------------------------------ assembly with occlusion

def resolve(parts_front_to_back, pad=0.06):
    """Painter's algorithm on the composite parts: pearls/leaves in front hide what's behind."""
    front = Polygon()
    out = _empty()
    for p in parts_front_to_back:
        def cut(gs):
            return [g.difference(front) if not front.is_empty else g for g in gs]
        out['gold'] += cut(p['gold'])
        out['leaf'] += cut(p['leaf'])
        out['shade'] += cut(p['shade'])
        out['hi'] += cut(p['hi'])
        out['pearl'] += [g.difference(front) if not front.is_empty else g for g in p['pearl']]
        sil = unary_union(p['pearl'] + p['leaf'])
        if not sil.is_empty:
            front = unary_union([front, sil.buffer(pad)])
    return out


# ------------------------------------------------------------------ ornaments

def fleur(cx, cy, s=1.0, w=0.12):
    """Small fleur ornament (centre petal up, two curled side petals, drop below)."""
    def T(pts):
        return [(cx + x * s, cy + y * s) for x, y in pts]
    centre = Polygon(catmull(T([(0, 0.15), (-0.62, -0.55), (-0.42, -1.45), (0, -2.25),
                                (0.42, -1.45), (0.62, -0.55)]), closed=True, n=12)).buffer(0)
    left = Polygon(catmull(T([(-0.22, 0.10), (-0.95, -0.55), (-1.85, -0.35), (-2.2, 0.35),
                              (-1.6, 0.55), (-0.85, 0.42)]), closed=True, n=12)).buffer(0)
    right = affinity.scale(left, -1, 1, origin=(cx, cy))
    drop = Polygon(catmull(T([(0, 0.45), (-0.42, 1.0), (0, 1.95), (0.42, 1.0)]), closed=True, n=12)).buffer(0)
    band = affinity.scale(Point(cx, cy + 0.28 * s).buffer(0.55 * s, resolution=24), 1.0, 0.42)
    petals = [left, right, centre, drop]
    fills = unary_union(petals)
    gold = [p.boundary.buffer(w / 2) for p in petals] + [band]
    # fine centre vein on the main petal
    gold.append(mono_line(T([(0, -0.25), (0, -1.0), (0, -1.75)]), w * 0.55, taper=(0.1, 0.6)))
    shade = [p.difference(affinity.translate(p, -0.18 * s, -0.22 * s)) for p in petals]
    return dict(gold=[unary_union(gold)], leaf=[], pearl=[fills], shade=[unary_union(shade).difference(unary_union(gold))],
                hi=[]), fills


def sparkle(cx, cy, r=0.75, w=0.18):
    pts = []
    for i in range(8):
        a = math.pi / 4 * i
        rr = r if i % 2 == 0 else r * 0.22
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    return Polygon(pts)


def divider(cx, cy, half=17.0, s=1.0, inner=3.0, line_w=0.13):
    """— ✦ ❦ ✦ — divider."""
    fl, _ = fleur(cx, cy, s)
    g = list(fl['gold'])
    for sgn in (-1, 1):
        sx = cx + sgn * inner * s
        g.append(sparkle(sx, cy, r=0.72 * s))
        x0 = sx + sgn * 0.9 * s
        x1 = cx + sgn * half
        pts = [(x0 + (x1 - x0) * i / 40, cy) for i in range(41)]
        g.append(nib_stroke(pts, line_w, line_w * 0.9, nib=90, taper=(0.02, 0.85), step=0.03))
    fl['gold'] = [unary_union(g)]
    return fl


def heart_curve(cx, cy, s=1.0, tail=0.0):
    """Points of an elegant heart outline starting & ending at the bottom tip."""
    P = [(0, 2.35), (-1.3, 1.15), (-2.25, -0.1), (-2.2, -1.35), (-1.25, -2.05), (-0.25, -1.55),
         (0, -1.05), (0.25, -1.55), (1.25, -2.05), (2.2, -1.35), (2.25, -0.1), (1.3, 1.15), (0.05, 2.3)]
    return [(cx + x * s, cy + y * s) for x, y in P]


def hearts_and_swash(cx, cy, s=1.0, w=0.22, left_x=None, right_x=None, base_y=None):
    """Two interlocked outline hearts whose tips flow into one long swash line."""
    hA = catmull(heart_curve(cx - 1.25 * s, cy, 0.92 * s), n=18)
    hB = catmull(heart_curve(cx + 1.35 * s, cy - 0.35 * s, 1.0 * s), n=18)
    A = nib_stroke(hA, w, w * 0.32, nib=35, taper=(0.03, 0.06), step=0.025)
    B = nib_stroke(hB, w, w * 0.32, nib=35, taper=(0.03, 0.06), step=0.025)
    # interlock: A over B at the upper crossing, B over A at the lower one
    gap = w * 0.75
    Ab = A.buffer(gap)
    Bb = B.buffer(gap)
    up = box(cx - 6 * s, cy - 6 * s, cx + 6 * s, cy - 0.2 * s)
    lo = box(cx - 6 * s, cy - 0.2 * s, cx + 6 * s, cy + 6 * s)
    B = B.difference(Ab.intersection(up).difference(A))
    A = A.difference(Bb.intersection(lo).difference(B))
    hearts = unary_union([A, B])
    # swash: from far left (curl) -> under the bride's name -> up to the hearts' tips -> down
    # under the groom's name -> curl up at the far right
    by = base_y if base_y is not None else cy + 4.6 * s
    lx = left_x if left_x is not None else cx - 23 * s
    rx = right_x if right_x is not None else cx + 24 * s
    tip = (cx, cy + 2.6 * s)
    tA = (cx - 1.25 * s, cy + 2.2 * s)   # tips of the two hearts
    tB = (cx + 1.35 * s, cy + 2.0 * s)
    left = [(lx + 1.6, by - 1.7), (lx + 0.4, by - 1.2), (lx + 0.7, by - 0.2), (lx + 3.6, by + 0.5),
            (lx + 9.5, by + 0.4), (cx - 8.5, by - 0.05), (cx - 4.6, by - 0.45), (tA[0] - 1.1, tA[1] + 0.75),
            (tA[0] + 0.05, tA[1] + 0.05)]
    right = [(tB[0] - 0.05, tB[1] + 0.05), (tB[0] + 1.1, tB[1] + 0.8), (cx + 4.9, by - 0.4), (cx + 10.5, by + 0.4),
             (rx - 6.5, by + 0.45), (rx - 2.0, by - 0.3), (rx - 0.2, by - 1.4), (rx - 0.6, by - 2.4),
             (rx - 1.6, by - 2.2)]
    sl = nib_stroke(catmull(left, n=24), w * 0.95, w * 0.22, nib=20, taper=(0.10, 0.12), step=0.025)
    sr = nib_stroke(catmull(right, n=24), w * 0.95, w * 0.22, nib=20, taper=(0.12, 0.10), step=0.025)
    return unary_union([hearts, sl, sr])


def pearl_cluster(p0, heading, length=5.0, n_sub=3, per=3, r=(0.50, 0.68), seed=1, bend=0.6, w=0.1,
                  spread=48, stalk=(0.42, 0.85), sub_max=2.6, along=3):
    """Dense gypsophila-like pearl cluster: a curved branch with alternating
    sub-branches, each crowned by a few pearls on hair-thin stalks."""
    rnd = random.Random(seed)
    h = math.radians(heading)
    pts = []
    for i in range(30):
        t = i / 29
        a = h + math.radians(bend * 40) * t
        pts.append((p0[0] + math.cos(a) * length * t, p0[1] + math.sin(a) * length * t))
    parts = [dict(gold=[mono_line(pts, w * 1.15, taper=(0.02, 0.2))], leaf=[], pearl=[], shade=[], hi=[])]
    for k in range(n_sub):
        t = 0.30 + 0.62 * k / max(n_sub - 1, 1)
        i = int(t * 29)
        p, q = pts[i], pts[min(i + 1, 29)]
        hd = math.degrees(math.atan2(q[1] - p[1], q[0] - p[0]))
        sgn = 1 if k % 2 == 0 else -1
        sa = math.radians(hd + sgn * rnd.uniform(spread - 12, spread + 8))
        sl = min(length * rnd.uniform(0.26, 0.38), sub_max)
        end = (p[0] + math.cos(sa) * sl, p[1] + math.sin(sa) * sl)
        mid = ((p[0] + end[0]) / 2 - math.sin(sa) * 0.15 * sgn, (p[1] + end[1]) / 2 + math.cos(sa) * 0.15 * sgn)
        parts.append(dict(gold=[mono_line(catmull([p, mid, end], n=10), w, taper=(0.0, 0.2))],
                          leaf=[], pearl=[], shade=[], hi=[]))
        sd = math.degrees(sa)
        for j in range(per):
            ang = sd + (j - (per - 1) / 2) * rnd.uniform(54, 66)
            pr, _ = pearl_on_stalk(end, ang, rnd.uniform(*stalk), rnd.uniform(*r), w=w * 0.85)
            parts.append(pr)
    # pearls along the main branch + terminal pearl
    for k in range(along):
        t = 0.18 + 0.68 * k / max(along - 1, 1)
        i = int(t * 29)
        p, q = pts[i], pts[i + 1]
        hd = math.degrees(math.atan2(q[1] - p[1], q[0] - p[0]))
        sgn = -1 if k % 2 == 0 else 1
        pr, _ = pearl_on_stalk(p, hd + sgn * 55, rnd.uniform(*stalk), rnd.uniform(*r), w=w * 0.85)
        parts.append(pr)
    pr, _ = pearl_on_stalk(pts[-1], math.degrees(h) + bend * 40, 0.4, r[1], w=w * 0.85)
    parts.append(pr)
    return merge(*parts)


def vine(ctrl, pattern, size=(1.0, 0.6), leaf_L=6.6, leaf_W=2.1, sprig_len=4.2, start=0.10, end=0.97,
         lean=42, outer_lean=18, stem_w=0.22, seed=1, inner_side=1, tip='P', tip_len=None):
    """Botanical garland along a smooth path.

    ctrl    : control points of the stem (base -> tip)
    pattern : one char per node, alternating sides is handled by case:
              'L' leaf on the inner side   'l' small leaf on the outer side
              'P' pearl sprig inner side   'p' small pearl sprig outer side   '.' nothing
    size    : scale of elements at the base and at the tip (they taper)
    """
    rnd = random.Random(seed)
    path = catmull(ctrl, n=30)
    # arc-length table
    acc = [0.0]
    for a, b in zip(path[:-1], path[1:]):
        acc.append(acc[-1] + math.dist(a, b))
    total = acc[-1]

    def at(t):
        d = t * total
        for i in range(1, len(acc)):
            if acc[i] >= d:
                p, q = path[i - 1], path[i]
                u = (d - acc[i - 1]) / max(acc[i] - acc[i - 1], 1e-9)
                return (p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u), \
                    math.degrees(math.atan2(q[1] - p[1], q[0] - p[0]))
        p, q = path[-2], path[-1]
        return q, math.degrees(math.atan2(q[1] - p[1], q[0] - p[0]))
    parts = []
    n = len(pattern)
    for k, ch in enumerate(pattern):
        if ch == '.':
            continue
        t = start + (end - start) * k / max(n - 1, 1)
        sc = size[0] + (size[1] - size[0]) * t
        p, hd = at(t)
        inner = ch.isupper()
        side = inner_side if inner else -inner_side
        if ch in 'Ll':
            la = lean if inner else outer_lean
            L = leaf_L * sc * (1 if inner else 0.72)
            Wd = leaf_W * sc * (1 if inner else 0.78)
            lf, _ = leaf(p, hd + side * la + rnd.uniform(-5, 5), L=L, W=Wd, veins=max(6, int(12 * sc)),
                         vein_w=0.072)
            parts.append(lf)
        else:
            la = lean + 8 if inner else outer_lean + 6
            ln = sprig_len * sc * (1 if inner else 0.7)
            parts.append(pearl_cluster(p, hd + side * la, length=ln, n_sub=2 if ln < 3.6 else 3,
                                       per=2, seed=rnd.randint(1, 9999), bend=0.25 * side,
                                       sub_max=max(1.1, ln * 0.36), along=2, r=(0.46 * max(sc, 0.8), 0.64 * max(sc, 0.8))))
    tp, hd = at(1.0)
    if tip == 'P':
        parts.insert(0, pearl_cluster(tp, hd, length=tip_len or sprig_len * size[1] * 1.1, n_sub=3, per=2,
                                      seed=seed + 77, bend=0.2 * inner_side, sub_max=1.6, along=2))
    elif tip == 'L':
        lf, _ = leaf(tp, hd, L=leaf_L * size[1], W=leaf_W * size[1], veins=8)
        parts.insert(0, lf)
    stem = mono_line(path, stem_w, taper=(0.03, 0.18), wmin=stem_w * 0.55)
    parts.append(dict(gold=[stem], leaf=[], pearl=[], shade=[], hi=[]))
    return parts
