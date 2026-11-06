"""Small vector-geometry toolkit used to draw the botanical gold-foil artwork.

All artwork is built from *filled* shapes (tapered calligraphic strokes are
converted to outlines).  This matters for print: foil plates and
clipping-based metallic fills need closed areas, not hairline strokes.
Units: millimetres, y down.
"""
import math

# ---------------------------------------------------------------- bezier utils

def cubic(p0, p1, p2, p3, t):
    u = 1 - t
    a, b, c, d = u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t
    return (a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
            a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1])


def bez_points(segs, n_per=40):
    """segs: list of (p0,p1,p2,p3). Returns densely sampled polyline."""
    pts = []
    for k, (p0, p1, p2, p3) in enumerate(segs):
        for i in range(n_per + 1):
            if k and i == 0:
                continue
            pts.append(cubic(p0, p1, p2, p3, i / n_per))
    return pts


def chain(*pts_and_handles):
    """Build a smooth bezier chain from a list of (point, handle_out_vector, handle_in_vector).
    Each item: (x, y, hx, hy) meaning tangent handle (hx,hy) at that point
    (outgoing = +h, incoming = -h)."""
    segs = []
    for a, b in zip(pts_and_handles[:-1], pts_and_handles[1:]):
        p0 = (a[0], a[1])
        p3 = (b[0], b[1])
        p1 = (a[0] + a[2], a[1] + a[3])
        p2 = (b[0] - b[2], b[1] - b[3])
        segs.append((p0, p1, p2, p3))
    return segs


def resample(pts, step):
    """Resample polyline to (roughly) uniform arc-length spacing."""
    out = [pts[0]]
    acc = 0.0
    for a, b in zip(pts[:-1], pts[1:]):
        seg = math.dist(a, b)
        if seg == 0:
            continue
        pos = step - acc
        while pos <= seg:
            t = pos / seg
            out.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
            pos += step
        acc = seg - (pos - step)
    if math.dist(out[-1], pts[-1]) > step * 0.25:
        out.append(pts[-1])
    else:
        out[-1] = pts[-1]
    return out


def length(pts):
    return sum(math.dist(a, b) for a, b in zip(pts[:-1], pts[1:]))

# ------------------------------------------------------------------ outlines

def smooth_closed(pts):
    """Closed polygon -> smooth cubic path ops via Catmull-Rom."""
    n = len(pts)
    ops = [('M', pts[0][0], pts[0][1])]
    for i in range(n):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        ops.append(('C', c1[0], c1[1], c2[0], c2[1], p2[0], p2[1]))
    ops.append(('Z',))
    return ops


def profile_taper(t, a=0.18, b=0.30, pw=0.75):
    """Calligraphic width profile: swell from 0 at start, 1 in body, thin at end."""
    if t < a:
        x = t / a
        return math.sin(x * math.pi / 2) ** pw
    if t > 1 - b:
        x = (1 - t) / b
        return math.sin(x * math.pi / 2) ** pw
    return 1.0


def stroke(pts, w, profile=None, step=0.06, tip=0.012, wfun=None):
    """Variable width stroke along polyline pts -> filled closed outline ops.
    w: max width (mm). profile(t)->0..1. wfun(t) overrides (absolute width)."""
    pts = resample(pts, step)
    n = len(pts)
    if n < 3:
        return []
    profile = profile or profile_taper
    left, right = [], []
    for i, p in enumerate(pts):
        a = pts[max(i - 1, 0)]
        b = pts[min(i + 1, n - 1)]
        dx, dy = b[0] - a[0], b[1] - a[1]
        L = math.hypot(dx, dy) or 1
        nx, ny = -dy / L, dx / L
        t = i / (n - 1)
        hw = (wfun(t) if wfun else w * profile(t)) / 2
        hw = max(hw, tip / 2)
        left.append((p[0] + nx * hw, p[1] + ny * hw))
        right.append((p[0] - nx * hw, p[1] - ny * hw))
    poly = left + right[::-1]
    # thin out for compactness (every 2nd pt is plenty after smoothing)
    poly = poly[::2] if len(poly) > 60 else poly
    return smooth_closed(poly)


def polygon_ops(pts):
    ops = [('M',) + tuple(pts[0])]
    ops += [('L',) + tuple(p) for p in pts[1:]]
    ops.append(('Z',))
    return ops


def circle_ops(cx, cy, r):
    k = 0.5522847498 * r
    return [('M', cx + r, cy),
            ('C', cx + r, cy + k, cx + k, cy + r, cx, cy + r),
            ('C', cx - k, cy + r, cx - r, cy + k, cx - r, cy),
            ('C', cx - r, cy - k, cx - k, cy - r, cx, cy - r),
            ('C', cx + k, cy - r, cx + r, cy - k, cx + r, cy),
            ('Z',)]


def circle_ccw(cx, cy, r):
    """Reverse-wound circle (for rings with nonzero fill)."""
    k = 0.5522847498 * r
    return [('M', cx + r, cy),
            ('C', cx + r, cy - k, cx + k, cy - r, cx, cy - r),
            ('C', cx - k, cy - r, cx - r, cy - k, cx - r, cy),
            ('C', cx - r, cy + k, cx - k, cy + r, cx, cy + r),
            ('C', cx + k, cy + r, cx + r, cy + k, cx + r, cy),
            ('Z',)]


def ring_ops(cx, cy, r, w):
    return circle_ops(cx, cy, r + w / 2) + circle_ccw(cx, cy, r - w / 2)


def rrect_ops(x, y, w, h, r, ccw=False):
    k = 0.5522847498 * r
    pts = [('M', x + r, y), ('L', x + w - r, y),
           ('C', x + w - r + k, y, x + w, y + r - k, x + w, y + r),
           ('L', x + w, y + h - r),
           ('C', x + w, y + h - r + k, x + w - r + k, y + h, x + w - r, y + h),
           ('L', x + r, y + h),
           ('C', x + r - k, y + h, x, y + h - r + k, x, y + h - r),
           ('L', x, y + r),
           ('C', x, y + r - k, x + r - k, y, x + r, y), ('Z',)]
    if not ccw:
        return pts
    return reverse_ops(pts)


def reverse_ops(ops):
    """Reverse a single closed subpath made of M/L/C/Z."""
    nodes = []  # list of (end point, segment description)
    cur = None
    segs = []
    for o in ops:
        if o[0] == 'M':
            start = cur = (o[1], o[2])
        elif o[0] == 'L':
            segs.append(('L', cur, (o[1], o[2])))
            cur = (o[1], o[2])
        elif o[0] == 'C':
            segs.append(('C', cur, (o[1], o[2]), (o[3], o[4]), (o[5], o[6])))
            cur = (o[5], o[6])
    out = [('M',) + segs[-1][-1]]
    for s in reversed(segs):
        if s[0] == 'L':
            out.append(('L',) + s[1])
        else:
            out.append(('C',) + s[3] + s[2] + s[1])
    out.append(('Z',))
    return out


def rrect_frame_ops(x, y, w, h, r, lw):
    """Hairline rounded-rectangle frame as a filled ring (outer CW, inner CCW)."""
    return (rrect_ops(x - lw / 2, y - lw / 2, w + lw, h + lw, r + lw / 2) +
            rrect_ops(x + lw / 2, y + lw / 2, w - lw, h - lw, max(r - lw / 2, 0.01), ccw=True))

# --------------------------------------------------------------- transforms

def xform(ops, a=1, b=0, c=0, d=1, e=0, f=0):
    out = []
    for o in ops:
        if o[0] == 'Z':
            out.append(o)
            continue
        v = list(o[1:])
        for i in range(0, len(v), 2):
            x, y = v[i], v[i + 1]
            v[i], v[i + 1] = a * x + c * y + e, b * x + d * y + f
        out.append((o[0],) + tuple(v))
    return out


def place(ops, x=0, y=0, rot=0, s=1, mirror=False):
    r = math.radians(rot)
    ca, sa = math.cos(r) * s, math.sin(r) * s
    mx = -1 if mirror else 1
    # scale+mirror, rotate, translate
    return xform(ops, ca * mx, sa * mx, -sa, ca, x, y)


def place_pt(p, x=0, y=0, rot=0, s=1, mirror=False):
    r = math.radians(rot)
    px = p[0] * (-1 if mirror else 1) * s
    py = p[1] * s
    return (px * math.cos(r) - py * math.sin(r) + x, px * math.sin(r) + py * math.cos(r) + y)


def to_d(ops, prec=3):
    out = []
    fmt = f'{{:.{prec}f}}'
    for o in ops:
        if o[0] == 'Z':
            out.append('Z')
        else:
            out.append(o[0] + ' '.join(fmt.format(v).rstrip('0').rstrip('.') if '.' in fmt.format(v) else fmt.format(v) for v in o[1:]))
    return ''.join(out)


def ops_bbox(ops):
    xs, ys = [], []
    for o in ops:
        v = o[1:]
        xs += v[0::2]
        ys += v[1::2]
    return (min(xs), min(ys), max(xs), max(ys)) if xs else (0, 0, 0, 0)
