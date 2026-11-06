"""Hand-authored botanical line art with true occlusion (painter's algorithm
done with vector boolean ops), rendered as broad-nib calligraphic strokes.

Petals are authored as closed Catmull-Rom curves through control points in a
100x100 design box.  Lines of a petal are drawn, then every petal that sits
in front of it is subtracted, so the final art is clean, non-overlapping
vector line work - exactly what a foil die or a vector plate needs.
"""
import math
from shapely.geometry import Polygon, LineString, MultiPolygon, Point
from shapely.ops import unary_union
from shapely import affinity


def catmull(pts, closed=False, n=16):
    P = list(pts)
    if closed:
        P = [P[-1]] + P + [P[0], P[1]]
    else:
        P = [P[0]] + P + [P[-1]]
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for k in range(n):
            t = k / n
            t2, t3 = t * t, t * t * t
            x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3)
            y = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
            out.append((x, y))
    if not closed:
        out.append(P[-2])
    return out


def _resample(pts, step):
    out = [pts[0]]
    carry = 0.0
    for a, b in zip(pts[:-1], pts[1:]):
        seg = math.dist(a, b)
        if seg == 0:
            continue
        pos = step - carry
        while pos <= seg:
            t = pos / seg
            out.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
            pos += step
        carry = seg - (pos - step)
    out.append(pts[-1])
    return out


def nib_stroke(pts, wmax, wmin=None, nib=35.0, taper=(0.12, 0.2), step=0.25, closed=False):
    """Broad-nib pen stroke polygon along polyline pts (design units).
    Width depends on travel direction vs. nib angle (thick/thin contrast)
    and tapers to fine points at the ends (unless closed)."""
    if wmin is None:
        wmin = wmax * 0.32
    pts = _resample(pts, step)
    n = len(pts)
    if n < 3:
        return Polygon()
    nibr = math.radians(nib)
    L, R = [], []
    for i, p in enumerate(pts):
        a = pts[(i - 1) % n] if closed else pts[max(i - 1, 0)]
        b = pts[(i + 1) % n] if closed else pts[min(i + 1, n - 1)]
        dx, dy = b[0] - a[0], b[1] - a[1]
        ln = math.hypot(dx, dy) or 1
        th = math.atan2(dy, dx)
        w = wmin + (wmax - wmin) * abs(math.sin(th - nibr))
        if not closed:
            t = i / (n - 1)
            a0, a1 = taper
            if t < a0:
                w *= math.sin(t / a0 * math.pi / 2) ** 0.8
            elif t > 1 - a1:
                w *= math.sin((1 - t) / a1 * math.pi / 2) ** 0.8
        w = max(w, wmin * 0.18)
        nx, ny = -dy / ln, dx / ln
        L.append((p[0] + nx * w / 2, p[1] + ny * w / 2))
        R.append((p[0] - nx * w / 2, p[1] - ny * w / 2))
    if closed:
        g = Polygon(L).buffer(0).symmetric_difference(Polygon(R).buffer(0))
        return g.buffer(0)
    return Polygon(L + R[::-1]).buffer(0)


class Drawing:
    """Accumulates layered shapes back-to-front with occlusion."""

    def __init__(self):
        self.items = []  # (kind, geom_line, geom_fill, tint)

    def petal(self, pts, w=1.3, wmin=None, nib=35, draw=True, edge_from=None, edge_to=None,
              tint=1.0, extra=()):
        """Closed petal through pts. Optionally only draw the outline between
        fractions edge_from..edge_to of its perimeter (others hidden)."""
        ring = catmull(pts, closed=True, n=18)
        fill = Polygon(ring).buffer(0)
        line = None
        if draw:
            if edge_from is not None:
                m = len(ring)
                i0, i1 = int(edge_from * m), int(edge_to * m)
                seg = ring[i0:i1] if i1 > i0 else ring[i0:] + ring[:i1]
                line = nib_stroke(seg, w, wmin, nib)
            else:
                line = nib_stroke(ring + ring[:1], w, wmin, nib, closed=False, taper=(0.0001, 0.0001))
        lines = [line] if line is not None else []
        for e in extra:
            lines.append(e)
        self.items.append(dict(fill=fill, line=unary_union(lines) if lines else None, tint=tint))
        return self

    def curve(self, pts, w=1.0, wmin=None, nib=35, taper=(0.15, 0.25), clip_to_last=False, tint=None):
        """Open stroke (vein / fold / curl), lives on the current front-most layer."""
        line = nib_stroke(catmull(pts, n=16), w, wmin, nib, taper)
        if clip_to_last and self.items:
            line = line.intersection(self.items[-1]['fill'].buffer(0.2))
        self.items.append(dict(fill=None, line=line, tint=tint))
        return self

    def result(self):
        """Resolve occlusion: each item's line minus all fills in front of it."""
        lines, tints = [], []
        front = Polygon()
        for it in reversed(self.items):
            if it['line'] is not None and not it['line'].is_empty:
                vis = it['line'].difference(front) if not front.is_empty else it['line']
                lines.append(vis)
            if it['fill'] is not None:
                if it.get('tint'):
                    tints.append((it['fill'].difference(front) if not front.is_empty else it['fill'], it['tint']))
                front = unary_union([front, it['fill']])
        return unary_union(lines), tints, front


def to_ops(geom, scale=1.0, dx=0.0, dy=0.0, simplify=0.0):
    """Shapely (Multi)Polygon -> path ops (polylines), even-odd ready."""
    if geom is None or geom.is_empty:
        return []
    if simplify:
        geom = geom.simplify(simplify, preserve_topology=True)
    polys = getattr(geom, 'geoms', [geom])
    ops = []
    for p in polys:
        if p.is_empty or p.geom_type != 'Polygon':
            if hasattr(p, 'geoms'):
                ops += to_ops(p, scale, dx, dy)
            continue
        for ring in [p.exterior] + list(p.interiors):
            c = list(ring.coords)
            ops.append(('M', dx + c[0][0] * scale, dy + c[0][1] * scale))
            for x, y in c[1:-1]:
                ops.append(('L', dx + x * scale, dy + y * scale))
            ops.append(('Z',))
    return ops


def transform(geom, x=0, y=0, rot=0, s=1, mirror=False, origin=(0, 0)):
    g = affinity.translate(geom, -origin[0], -origin[1])
    if mirror:
        g = affinity.scale(g, -1, 1, origin=(0, 0))
    g = affinity.scale(g, s, s, origin=(0, 0))
    g = affinity.rotate(g, rot, origin=(0, 0))
    return affinity.translate(g, x, y)
