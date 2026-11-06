#!/usr/bin/env python3
"""Generate the vector ornaments of the site (original artwork, drawn in code).

    python3 tools/make_assets.py          # every ornament
    python3 tools/make_assets.py seal     # only the wax seal + favicon (after changing INITIALS)

Outputs into assets/img/: seal.svg, favicon.svg, sprig.svg, divider.svg, corner.svg
Requires: shapely, fonttools, uharfbuzz (see README).
"""
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(HERE, 'lib'))

from shapely.geometry import Point, Polygon  # noqa: E402
from shapely.ops import unary_union  # noqa: E402
from shapely import affinity  # noqa: E402

import geom as G  # noqa: E402
import pearl_art as A  # noqa: E402
from linework import to_ops, transform  # noqa: E402
from textpath import load, Run, bbox  # noqa: E402

OUT = os.path.join(ROOT, 'assets', 'img')
os.makedirs(OUT, exist_ok=True)
GOLD = ['#6E5328', '#A88348', '#C6A66B', '#E9D7AE', '#C6A66B', '#A88348', '#8A6A35']
# The couple's initials pressed into the wax seal: (groom — right side, bride — left side), RTL.
INITIALS = ('د', 'ب')


def d_of(g, scale=1.0, simplify=0.003):
    return G.to_d(to_ops(g, scale=scale, simplify=simplify))


def gold_grad(id_, x1=0, y1=0, x2=1, y2=1, units='objectBoundingBox'):
    stops = ''.join(f'<stop offset="{i / (len(GOLD) - 1):.3f}" stop-color="{c}"/>' for i, c in enumerate(GOLD))
    return f'<linearGradient id="{id_}" x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" gradientUnits="{units}">{stops}</linearGradient>'


def write(name, svg):
    with open(os.path.join(OUT, name), 'w', encoding='utf-8') as f:
        f.write(svg)
    print('wrote', name, len(svg), 'bytes')


# ------------------------------------------------------------------ wax seal

def glyph_geom(fnt, text, size, cx, cy, features=None):
    run = Run(fnt, text, size, features)
    ops = run.ops(0, 0)
    bb = bbox(ops)
    ops = run.ops(cx - (bb[0] + bb[2]) / 2, cy - (bb[1] + bb[3]) / 2)
    return ops


def seal(small=False):
    """Original wax seal: irregular wax blob, pressed disc, laurel wreath, the couple's Arabic initials."""
    c = 100.0
    pts = []
    for i in range(240):
        t = i / 240 * 2 * math.pi
        r = 90 + 3.2 * math.sin(7 * t + 0.6) + 1.8 * math.sin(13 * t + 1.9) + 1.2 * math.sin(23 * t)
        pts.append((c + r * math.cos(t), c + r * math.sin(t)))
    blob = Polygon(pts)
    wreath = []
    for side in (-1, 1):
        for i in range(8):
            a = math.radians(98 + i * 17.5) if side < 0 else math.radians(82 - i * 17.5)
            p = (c + 57 * math.cos(a), c + 57 * math.sin(a))
            tang = math.degrees(a) + (90 if side < 0 else -90)
            for k, tilt in ((0, 34), (1, -20)):
                lf, _ = A.leaf(p, tang + (tilt if side < 0 else -tilt), L=11 - i * 0.45, W=4.2 - i * 0.15,
                               w=0.9, veins=0, bend=0.4)
                wreath.append(lf['gold'][0])
        wreath.append(A.mono_line([(c + 57 * math.cos(math.radians(a)), c + 57 * math.sin(math.radians(a)))
                                   for a in (range(98, 228, 4) if side < 0 else range(82, -48, -4))], 1.2,
                                  taper=(0.05, 0.4)))
    wreath.append(Point(c, c + 57).buffer(2.4))
    wreath = unary_union(wreath)
    f = load(os.path.join(HERE, 'fonts-src', 'ArefRuqaa-700.ttf'))
    first = glyph_geom(f, INITIALS[0], 60, c + 19, c - 4)
    second = glyph_geom(f, INITIALS[1], 60, c - 21, c + 1)
    amp = glyph_geom(load(os.path.join(HERE, 'fonts-src', 'Amiri-700.ttf')), '&', 20, c, c + 33)
    mono = G.to_d(first, prec=2) + G.to_d(second, prec=2) + G.to_d(amp, prec=2)
    wr = d_of(wreath, simplify=0.06)
    blob_d = d_of(blob, simplify=0.05)
    if small:   # favicon: no wreath (illegible at 32px), simpler
        wr = ''
    size = 'width="64" height="64"' if small else 'width="200" height="200"'
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" {size} role="img" aria-label="ختم العروسين">
<defs>
<radialGradient id="wax" cx="38%" cy="32%" r="78%"><stop offset="0" stop-color="#F3E5C0"/><stop offset=".28" stop-color="#D8BC82"/>
<stop offset=".6" stop-color="#B8925A"/><stop offset=".86" stop-color="#8A6A35"/><stop offset="1" stop-color="#5E4522"/></radialGradient>
<radialGradient id="disc" cx="60%" cy="65%" r="70%"><stop offset="0" stop-color="#C9AA70"/><stop offset=".7" stop-color="#A88348"/><stop offset="1" stop-color="#8A6A35"/></radialGradient>
{gold_grad('emb', 0, 0, 1, 1)}
</defs>
<path d="{blob_d}" fill="url(#wax)"/>
<circle cx="{c}" cy="{c}" r="72" fill="url(#disc)"/>
<circle cx="{c}" cy="{c}" r="72" fill="none" stroke="#F6E9C8" stroke-opacity=".55" stroke-width="1.6" transform="translate(-1 -1.2)"/>
<circle cx="{c}" cy="{c}" r="72" fill="none" stroke="#4E3A1C" stroke-opacity=".45" stroke-width="1.6" transform="translate(1 1.4)"/>
<g transform="translate(1.1 1.5)" fill="#4E3A1C" fill-opacity=".5"><path d="{wr}" fill-rule="evenodd"/><path d="{mono}"/></g>
<g transform="translate(-.8 -1)" fill="#FBF0D2" fill-opacity=".55"><path d="{wr}" fill-rule="evenodd"/><path d="{mono}"/></g>
<g fill="url(#emb)"><path d="{wr}" fill-rule="evenodd"/><path d="{mono}"/></g>
<ellipse cx="72" cy="58" rx="26" ry="11" fill="#FFF8E6" opacity=".28" transform="rotate(-32 72 58)"/>
</svg>'''


# ------------------------------------------------------------------ sprig

def sprig():
    """Delicate horizontal gold branch with leaves and a few pearls (mm units)."""
    ctrl = [(2, 12), (14, 10.2), (28, 9.6), (42, 10.4), (55, 9.0), (66, 7.4)]
    parts = A.vine(ctrl, 'LlPLlPLlLPlL', size=(1.1, 0.72), leaf_L=8.0, leaf_W=2.5, sprig_len=3.8, lean=36,
                   outer_lean=32, stem_w=0.28, seed=7, inner_side=1, tip='L')
    r = A.resolve(parts)
    allg = unary_union(r['gold'] + r['leaf'] + r['pearl'])
    x0, y0, x1, y1 = allg.bounds
    pad = 0.6
    shift = (-x0 + pad, -y0 + pad)
    r = {k: [affinity.translate(g, *shift) for g in v] for k, v in r.items()}
    W, H = round(x1 - x0 + 2 * pad, 2), round(y1 - y0 + 2 * pad, 2)
    gold = unary_union(r['gold'])
    leaf = unary_union(r['leaf'])
    pearls = ''.join(f'<path d="{d_of(p)}" fill="url(#pearl)"/>' for p in r['pearl'])
    shade = d_of(unary_union(r['shade'])) if r['shade'] else ''
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W * 6}" height="{H * 6}" aria-hidden="true">
<defs>{gold_grad('g', 0, 0, W, H, 'userSpaceOnUse')}
<radialGradient id="pearl" cx="36%" cy="32%" r="75%"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".5" stop-color="#F7F0E6"/><stop offset="1" stop-color="#E2D3BF"/></radialGradient>
<linearGradient id="lf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F6EAD2"/><stop offset="1" stop-color="#E9D7AE"/></linearGradient></defs>
<path d="{d_of(leaf, simplify=0.01)}" fill="url(#lf)" fill-rule="evenodd"/>{pearls}<path d="{shade}" fill="#E2D0C0" fill-rule="evenodd"/>
<path d="{d_of(gold, simplify=0.008)}" fill="url(#g)" fill-rule="evenodd"/></svg>'''


def divider():
    dv = A.divider(40, 5, half=38, s=1.2, line_w=0.16)
    g = unary_union(dv['gold'])
    pearl = unary_union(dv['pearl'])
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 10" width="320" height="40" aria-hidden="true">
<defs>{gold_grad('g', 0, 0, 80, 10, 'userSpaceOnUse')}</defs>
<path d="{d_of(pearl)}" fill="#F6EEE2"/><path d="{d_of(g)}" fill="url(#g)" fill-rule="evenodd"/></svg>'''


def corner():
    """Corner ornament (top-right in RTL reading terms is irrelevant: mirrored in CSS)."""
    lines = unary_union([
        A.mono_line([(1, 40), (1, 6), (2.6, 2.6), (6, 1), (40, 1)], 0.5, taper=(0.25, 0.25), step=0.05),
        A.mono_line([(4.2, 28), (4.2, 7.5), (5.2, 5.2), (7.5, 4.2), (28, 4.2)], 0.28, taper=(0.3, 0.3), step=0.05),
    ])
    lf1, _ = A.leaf((7.4, 7.4), 45 - 24, L=8.0, W=2.5, w=0.35, veins=5)
    lf2, _ = A.leaf((7.4, 7.4), 45 + 24, L=8.0, W=2.5, w=0.35, veins=5)
    dot = Point(7.4, 7.4).buffer(1.1)
    g = unary_union([lines, lf1['gold'][0], lf2['gold'][0], dot])
    fills = unary_union([lf1['leaf'][0], lf2['leaf'][0]])
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 42 42" width="84" height="84" aria-hidden="true">
<defs>{gold_grad('g', 0, 0, 42, 42, 'userSpaceOnUse')}</defs>
<path d="{d_of(fills)}" fill="#F3E7CF"/><path d="{d_of(g)}" fill="url(#g)" fill-rule="evenodd"/></svg>'''


if __name__ == '__main__':
    write('seal.svg', seal())
    write('favicon.svg', seal(small=True))
    if sys.argv[1:] == ['seal']:
        sys.exit(0)
    write('sprig.svg', sprig())
    write('divider.svg', divider())
    write('corner.svg', corner())
