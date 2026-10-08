"""Draws the bright blue backdrop behind the sign in / sign up glass.

This replaces the dark silk. The brief was bright, blue, sharp and artful,
and the word that changes the most is sharp — the silk was built entirely
out of gaussian blur, and nothing blurred can be sharp. So the construction
is the opposite of that one:

  * no filters at all. Every edge is the edge of a filled path, so it stays
    a clean line at any zoom and the file renders in a fraction of the time
    a stack of 46px blurs took.
  * the modulation that the blur used to provide comes from gradients along
    and across each band instead, and from the alpha compounding where
    bands cross. Three translucent sheets over one another make a colour
    none of them has on its own, which is what keeps it from reading as
    flat vector clip art.
  * hairlines. A few single-stroke curves following the big shapes are what
    actually sells "sharp" — the eye finds the thinnest crisp thing in the
    picture and judges the whole image by it.

The palette is bright: a pale sky at the top left falling to a saturated
brand blue at the bottom right, with white bands lifting it and deeper blue
bands giving it somewhere to fall to. It has to stay bright under a sheet
of white glass without the glass disappearing into it.

Writes assets/auth-sky.svg. Re-run after editing BANDS.
"""

import math

W, H = 1600, 1100

# (max half-width, base alpha, samples per segment, kind)
#   sheet  — the broad folds that carry the colour
#   blade  — narrower, brighter, crossing the sheets
#   line   — a single stroked curve, no width of its own
CLASS = {
    'sheet': (210, 0.17, 18, 'fill'),
    'blade': (64,  0.22, 30, 'fill'),
    'line':  (2.0, 0.42, 40, 'stroke'),
}

# Three inks. Named rather than per-band so the picture keeps to a palette.
INK = {
    'white': ('#FFFFFF', '#EAF5FF'),
    'cyan':  ('#5FD4FF', '#1FA8F0'),
    'deep':  ('#1F6FE0', '#0B46B4'),
}

# (class, ink, alpha multiplier, waypoints). Points run off every edge so
# nothing begins or ends inside the picture. Each curve turns back on itself
# somewhere, or the spline returns a straight line and the band reads as a
# stripe rather than a fold.
BANDS = [
    # the main fold, low left to high right
    ('sheet', 'white', 1.15, [(-300, 900), (170, 968), (640, 772), (1090, 462), (1500, 286), (1900, 320)]),
    ('blade', 'white', 1.30, [(-280, 962), (220, 1026), (690, 826), (1140, 508), (1545, 326)]),
    ('line',  'white', 1.00, [(-260, 1000), (260, 1060), (730, 858), (1180, 534), (1580, 348)]),

    # the counter-fold, high left to low right
    ('sheet', 'deep',  1.00, [(-300, 150), (160, 96), (630, 286), (1080, 596), (1480, 828), (1900, 892)]),
    ('blade', 'cyan',  1.05, [(-280, 212), (210, 156), (680, 346), (1125, 650), (1520, 874)]),
    ('line',  'white', 0.80, [(-260, 252), (250, 196), (720, 386), (1165, 686), (1560, 900)]),

    # top-left corner, a broad sheet turning in
    ('sheet', 'cyan',  0.90, [(-320, -160), (70, 56), (352, 312), (438, 618), (378, 968), (452, 1270)]),
    ('blade', 'white', 0.95, [(-280, -110), (122, 110), (400, 358), (486, 652), (430, 988)]),

    # bottom-right corner, the answer to it
    ('sheet', 'deep',  0.82, [(1160, 1270), (1288, 952), (1398, 638), (1522, 366), (1840, 112)]),
    ('line',  'white', 0.70, [(1232, 1270), (1356, 964), (1462, 656), (1584, 390)]),

    # a long shallow sheet across the upper third
    ('sheet', 'white', 0.70, [(-240, 392), (300, 300), (800, 372), (1270, 262), (1880, 312)]),
    ('blade', 'cyan',  0.70, [(-220, 440), (340, 348), (840, 420), (1310, 306)]),

    # and across the lower third, bending the other way
    ('sheet', 'deep',  0.62, [(-240, 724), (330, 822), (820, 736), (1300, 838), (1880, 768)]),
    ('blade', 'white', 0.80, [(-220, 772), (360, 868), (850, 782), (1330, 884)]),

    # two hairlines dropped through the middle, where the panel edge falls
    ('line',  'white', 0.95, [(250, -170), (536, 190), (716, 540), (772, 906), (710, 1280)]),
    ('line',  'cyan',  0.85, [(1402, -170), (1162, 232), (1022, 580), (1044, 928), (1168, 1280)]),

    # a last sheet holding the foot
    ('sheet', 'white', 0.55, [(-300, 1080), (310, 1136), (910, 1062), (1490, 1126), (1900, 1072)]),
]


def spline(points, steps):
    """Catmull-Rom through the waypoints, sampled evenly."""
    pts = [points[0]] + list(points) + [points[-1]]
    out = []
    for i in range(len(pts) - 3):
        p0, p1, p2, p3 = pts[i], pts[i + 1], pts[i + 2], pts[i + 3]
        for s in range(steps):
            t = s / steps
            t2, t3 = t * t, t * t * t
            x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t
                       + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2
                       + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3)
            y = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t
                       + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2
                       + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
            out.append((x, y))
    out.append(points[-1])
    return out


def taper(t):
    """Fat in the middle, a point at both ends, belly off centre."""
    return math.sin(math.pi * t) ** 0.58


def centre_path(points, steps):
    pts = spline(points, steps)
    d = ['M%.1f %.1f' % pts[0]]
    d += ['L%.1f %.1f' % p for p in pts[1:]]
    return ''.join(d)


def ribbon(points, half, steps):
    """The centreline offset either side by the tapering half-width. One
    decimal place, not zero: with no blur to hide it, integer rounding shows
    as faceting along the edge of a 200-unit sheet."""
    pts = spline(points, steps)
    n = len(pts) - 1
    top, bottom = [], []
    for i, (x, y) in enumerate(pts):
        t = i / n
        j = min(max(i, 1), n)
        dx = pts[j][0] - pts[j - 1][0]
        dy = pts[j][1] - pts[j - 1][1]
        L = math.hypot(dx, dy) or 1.0
        nx, ny = -dy / L, dx / L
        w = half * taper(t)
        top.append((x + nx * w, y + ny * w))
        bottom.append((x - nx * w, y - ny * w))
    d = ['M%.1f %.1f' % top[0]]
    d += ['L%.1f %.1f' % p for p in top[1:]]
    d += ['L%.1f %.1f' % p for p in reversed(bottom)]
    d.append('Z')
    return ''.join(d)


defs = ['<defs>']

# The ground: pale sky falling to brand blue, with two bright spots placed
# off the corners so the field is not an even ramp.
defs.append(
    '<linearGradient id="sky" x1="0" y1="0" x2="1" y2="1">'
    '<stop offset="0" stop-color="#E8F4FF"/>'
    '<stop offset="0.34" stop-color="#B9DBFF"/>'
    '<stop offset="0.68" stop-color="#7DB6F8"/>'
    '<stop offset="1" stop-color="#3C84E8"/>'
    '</linearGradient>')
defs.append(
    '<radialGradient id="lit-a" cx="0.18" cy="0.14" r="0.62">'
    '<stop offset="0" stop-color="#FFFFFF" stop-opacity="0.78"/>'
    '<stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>'
    '</radialGradient>')
defs.append(
    '<radialGradient id="lit-b" cx="0.86" cy="0.9" r="0.6">'
    '<stop offset="0" stop-color="#1BB6FF" stop-opacity="0.42"/>'
    '<stop offset="1" stop-color="#1BB6FF" stop-opacity="0"/>'
    '</radialGradient>')

body = []

for i, (cls, ink, mult, waypoints) in enumerate(BANDS):
    half, base, steps, kind = CLASS[cls]
    a = base * mult
    c1, c2 = INK[ink]
    x1, y1 = waypoints[0]
    x2, y2 = waypoints[-1]
    # Along the band: nothing at both tips, so it arrives and leaves rather
    # than starting. Two colours down its length so it is never one flat tint.
    defs.append(
        '<linearGradient id="b%d" gradientUnits="userSpaceOnUse" '
        'x1="%.0f" y1="%.0f" x2="%.0f" y2="%.0f">'
        '<stop offset="0" stop-color="%s" stop-opacity="0"/>'
        '<stop offset="0.16" stop-color="%s" stop-opacity="%.3f"/>'
        '<stop offset="0.5" stop-color="%s" stop-opacity="%.3f"/>'
        '<stop offset="0.84" stop-color="%s" stop-opacity="%.3f"/>'
        '<stop offset="1" stop-color="%s" stop-opacity="0"/>'
        '</linearGradient>'
        % (i, x1, y1, x2, y2, c1, c1, a * 0.72, c2, a, c1, a * 0.6, c2))

    if kind == 'stroke':
        body.append('<path d="%s" fill="none" stroke="url(#b%d)" stroke-width="%.1f" '
                    'stroke-linecap="round"/>' % (centre_path(waypoints, steps), i, half))
    else:
        body.append('<path d="%s" fill="url(#b%d)"/>' % (ribbon(waypoints, half, steps), i))

defs.append('</defs>')

parts = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d" '
         'preserveAspectRatio="xMidYMid slice">' % (W, H, W, H)]
parts.append('\n'.join(defs))
parts.append('<rect width="%d" height="%d" fill="url(#sky)"/>' % (W, H))
parts.append('<rect width="%d" height="%d" fill="url(#lit-a)"/>' % (W, H))
parts.append('<rect width="%d" height="%d" fill="url(#lit-b)"/>' % (W, H))
parts.append(''.join(body))
parts.append('</svg>')

out = '\n'.join(parts)
with open('assets/auth-sky.svg', 'w', encoding='utf-8') as f:
    f.write(out)

print('assets/auth-sky.svg  %.1f KB  %d bands, no filters' % (len(out) / 1024, len(BANDS)))
