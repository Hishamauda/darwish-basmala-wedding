"""Arabic-aware text -> vector outlines.

Shaping is done by HarfBuzz (uharfbuzz), glyph outlines come from fontTools.
Every glyph is emitted as a filled path, so the printed result never depends
on the font being installed on the printer's RIP, and Arabic joining /
direction is exactly what HarfBuzz produced (verified separately).
Coordinates are in millimetres, y axis pointing DOWN (SVG convention).
"""
from functools import lru_cache
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.pens.basePen import BasePen

PT = 25.4 / 72.0  # 1 pt in mm


class _Recorder(BasePen):
    """Records glyph outlines as M/L/C/Z ops (quadratics promoted to cubics)."""

    def __init__(self, glyphset, sx, sy, dx, dy):
        super().__init__(glyphset)
        self.ops = []
        self.sx, self.sy, self.dx, self.dy = sx, sy, dx, dy
        self._cur = None

    def _t(self, p):
        return (self.dx + p[0] * self.sx, self.dy + p[1] * self.sy)

    def _moveTo(self, p):
        self.ops.append(('M',) + self._t(p))
        self._cur = p

    def _lineTo(self, p):
        self.ops.append(('L',) + self._t(p))
        self._cur = p

    def _curveToOne(self, p1, p2, p3):
        self.ops.append(('C',) + self._t(p1) + self._t(p2) + self._t(p3))
        self._cur = p3

    def _qCurveToOne(self, p1, p2):
        p0 = self._cur
        c1 = (p0[0] + 2 / 3 * (p1[0] - p0[0]), p0[1] + 2 / 3 * (p1[1] - p0[1]))
        c2 = (p2[0] + 2 / 3 * (p1[0] - p2[0]), p2[1] + 2 / 3 * (p1[1] - p2[1]))
        self._curveToOne(c1, c2, p2)

    def _closePath(self):
        self.ops.append(('Z',))

    _endPath = _closePath


class Font:
    def __init__(self, path):
        self.path = path
        blob = hb.Blob.from_file_path(path)
        self.face = hb.Face(blob)
        self.hb = hb.Font(self.face)
        self.tt = TTFont(path)
        self.upm = self.tt['head'].unitsPerEm
        self.hb.scale = (self.upm, self.upm)
        self.gs = self.tt.getGlyphSet()
        self.order = self.tt.getGlyphOrder()
        hhea = self.tt['hhea']
        self.ascent, self.descent = hhea.ascent, hhea.descent

    def shape(self, text, features=None, direction=None):
        buf = hb.Buffer()
        buf.add_str(text)
        buf.guess_segment_properties()
        if direction:
            buf.direction = direction
        hb.shape(self.hb, buf, features or {})
        return buf.glyph_infos, buf.glyph_positions, buf.direction

    def glyph_names(self, text, features=None):
        infos, _, _ = self.shape(text, features)
        return [self.order[i.codepoint] for i in infos]


class Run:
    """A shaped run of text laid out horizontally (visual order, left to right)."""

    def __init__(self, font, text, size_mm, features=None, tracking=0.0,
                 direction=None, glyph_tweaks=None):
        self.font, self.text, self.size = font, text, size_mm
        infos, poss, self.direction = font.shape(text, features, direction)
        s = size_mm / font.upm
        self.glyphs = []  # (glyph name, x_mm, y_mm) relative to run origin (baseline-left)
        x = 0.0
        for k, (i, p) in enumerate(zip(infos, poss)):
            name = font.order[i.codepoint]
            gx, gy = x + p.x_offset * s, -p.y_offset * s
            if glyph_tweaks and k in glyph_tweaks:
                tx, ty = glyph_tweaks[k]
                gx += tx
                gy += ty
            self.glyphs.append((name, gx, gy, i.cluster))
            x += p.x_advance * s + (tracking if p.x_advance else 0)
        self.width = x

    def ops(self, x0, y0, scale_x=1.0):
        """Outline ops for the run with its baseline-left at (x0, y0)."""
        s = self.size / self.font.upm
        out = []
        for name, gx, gy, _ in self.glyphs:
            rec = _Recorder(self.font.gs, s * scale_x, -s, x0 + gx * scale_x, y0 + gy)
            self.font.gs[name].draw(rec)
            out.extend(rec.ops)
        return out


def bbox(ops):
    xs, ys = [], []
    for op in ops:
        pts = op[1:]
        xs.extend(pts[0::2])
        ys.extend(pts[1::2])
    if not xs:
        return (0, 0, 0, 0)
    return (min(xs), min(ys), max(xs), max(ys))


@lru_cache(None)
def load(path):
    return Font(path)
