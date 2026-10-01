"""Draws the closing band's backdrop: strands of light, as in the reference.

The look wanted is silk, not waves — long strands that taper to nothing at both
ends, cross each other, and have no edge anywhere. Three things make that:

  * each strand is a filled shape, not a stroke, so its width can swell in the
    middle and come to a point at both ends. A stroke is one width end to end
    and always reads as a drawn line.
  * a gradient down its length takes it to fully transparent at both tips, so
    it arrives and leaves rather than starting.
  * a gaussian blur per weight class. The broad washes are blurred far more
    than the fine threads, which is what separates "haze" from "filament".

The centre is left clear on purpose. The heading and the button sit there, and
the strands are placed around them, which is also how the reference is built.

Writes assets/cta-waves.svg. Re-run after editing STRANDS.
"""

import math

W, H = 1600, 400

# Weight classes: (max half-width, blur, base alpha, samples per segment). The
# blur is what makes a class read as haze or thread; the widths alone do not.
#
# The sample count is set by the blur, not by the curve. A wash blurred by 30px
# cannot show faceting however coarsely it is walked, so it is walked coarsely —
# sampling all three classes alike put most of the file into points that get
# smeared away.
#
# The widths matter as much as the blur. A half-width of 5 at high alpha does
# not read as a filament of silk, it reads as a laser — the reference has
# almost no hairlines in it. What it has is folds: broad, soft, and only a
# little brighter than the ground. So every class is wider and dimmer than the
# obvious choice, and the brightest thing in the picture is still barely
# brighter than what it sits on.
CLASS = {
    'wash': (132, 34, 0.105, 14),
    'mid':  (48,  16, 0.142, 26),
    'fine': (12,  5,  0.178, 40),
}

# (class, alpha multiplier, waypoints). Points run off both edges so nothing
# starts or stops inside the band.
#
# Every one of these turns back on itself somewhere. Waypoints that only climb
# or only fall give a Catmull-Rom nothing to bend around and it returns what is
# effectively a straight line, which is what makes a strand read as a
# searchlight beam instead of a fold of cloth. The S is the whole effect.
STRANDS = [
    # the long fold across the whole band: down into the left, up through the
    # middle, flattening off at the right
    ('wash', 0.95, [(-240, 262), (170, 366), (620, 344), (1060, 224), (1480, 168), (1860, 206)]),
    ('mid',  0.70, [(-220, 286), (200, 388), (640, 366), (1080, 246), (1500, 192)]),

    # bottom left: the arc out of the left edge, bending twice
    ('wash', 1.70, [(-240, 150), (60, 278), (330, 390), (660, 436), (1020, 408), (1340, 430)]),
    ('mid',  1.45, [(-220, 182), (90, 306), (360, 410), (690, 452), (1040, 426)]),
    ('fine', 1.30, [(-220, 200), (110, 320), (380, 420), (700, 460)]),
    ('mid',  0.80, [(-220, 120), (70, 250), (320, 364), (640, 416), (980, 392)]),

    # right side: the crossing pair, each curving the opposite way
    ('mid',  1.15, [(820, 452), (1080, 384), (1300, 268), (1540, 196), (1860, 212)]),
    ('fine', 0.85, [(850, 462), (1110, 394), (1330, 276), (1570, 202)]),
    ('mid',  1.00, [(900, 132), (1140, 236), (1360, 300), (1560, 392), (1860, 430)]),
    ('fine', 0.75, [(940, 126), (1180, 232), (1400, 298), (1600, 390)]),

    # top right: the arc coming down out of the corner and turning in
    ('wash', 1.20, [(1020, -140), (1290, -30), (1510, 110), (1590, 258), (1640, 420)]),
    ('fine', 0.90, [(1090, -130), (1340, -14), (1546, 120), (1618, 262)]),

    # right edge: a soft fold holding the corner, dipping in the middle
    ('wash', 0.80, [(1200, 176), (1440, 232), (1680, 194), (1880, 230)]),

    # a faint thread high across the whole width, rising then easing
    ('fine', 0.50, [(-140, 310), (280, 338), (720, 268), (1160, 184), (1800, 158)]),

    # upper left, barely there — keeps that corner from going flat
    ('wash', 0.60, [(-240, 64), (160, 142), (520, 112), (900, 176)]),

    # along the foot, a slow undulation
    ('mid',  0.50, [(240, 440), (660, 466), (1080, 428), (1480, 462), (1820, 440)]),
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
    """Fat in the middle, a point at both ends — but not symmetrically, or
    every strand looks like the same leaf. The power pushes the belly off
    centre."""
    return math.sin(math.pi * t) ** 0.62


def ribbon(points, half, steps):
    """The centreline offset either side by the tapering half-width, as one
    closed path."""
    pts = spline(points, steps)
    n = len(pts) - 1
    top, bottom = [], []
    for i, (x, y) in enumerate(pts):
        t = i / n
        # normal from the local tangent
        j = min(max(i, 1), n)
        dx = pts[j][0] - pts[j - 1][0]
        dy = pts[j][1] - pts[j - 1][1]
        L = math.hypot(dx, dy) or 1.0
        nx, ny = -dy / L, dx / L
        w = half * taper(t)
        top.append((x + nx * w, y + ny * w))
        bottom.append((x - nx * w, y - ny * w))

    d = ['M%.0f %.0f' % top[0]]
    d += ['L%.0f %.0f' % p for p in top[1:]]
    d += ['L%.0f %.0f' % p for p in reversed(bottom)]
    d.append('Z')
    return ''.join(d)


parts = []
defs = ['<defs>']

# One blur per weight class rather than per strand, so strands in a class are
# rasterised together. userSpaceOnUse with a wide margin, or the blur is
# clipped at the edge of each shape's own box and every strand gets a seam.
for name, (_, blur, _, _) in CLASS.items():
    defs.append(
        '<filter id="b-%s" filterUnits="userSpaceOnUse" x="-400" y="-400" '
        'width="%d" height="%d"><feGaussianBlur stdDeviation="%s"/></filter>'
        % (name, W + 800, H + 800, blur))

# The bright patch the reference has above the centre. It lifts the ground the
# heading sits on as well as matching the picture.
defs.append(
    '<radialGradient id="glow" cx="0.58" cy="0.30" r="0.62">'
    '<stop offset="0" stop-color="#CFE4FF" stop-opacity="0.20"/>'
    '<stop offset="0.55" stop-color="#CFE4FF" stop-opacity="0.07"/>'
    '<stop offset="1" stop-color="#CFE4FF" stop-opacity="0"/>'
    '</radialGradient>')

bodies = {k: [] for k in CLASS}

for i, (cls, mult, waypoints) in enumerate(STRANDS):
    half, _, base, steps = CLASS[cls]
    a = base * mult
    x1, y1 = waypoints[0]
    x2, y2 = waypoints[-1]
    defs.append(
        '<linearGradient id="g%d" gradientUnits="userSpaceOnUse" '
        'x1="%.0f" y1="%.0f" x2="%.0f" y2="%.0f">'
        '<stop offset="0" stop-color="#fff" stop-opacity="0"/>'
        '<stop offset="0.18" stop-color="#EAF3FF" stop-opacity="%.3f"/>'
        '<stop offset="0.48" stop-color="#fff" stop-opacity="%.3f"/>'
        '<stop offset="0.78" stop-color="#DCEBFF" stop-opacity="%.3f"/>'
        '<stop offset="1" stop-color="#fff" stop-opacity="0"/>'
        '</linearGradient>'
        % (i, x1, y1, x2, y2, a * 0.62, a, a * 0.52))
    bodies[cls].append('<path d="%s" fill="url(#g%d)"/>' % (ribbon(waypoints, half, steps), i))

defs.append('</defs>')

parts.append('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" '
             'width="%d" height="%d" preserveAspectRatio="xMidYMid slice">' % (W, H, W, H))
parts.append('\n'.join(defs))
parts.append('<rect width="%d" height="%d" fill="url(#glow)"/>' % (W, H))
# washes first, threads last, so the fine highlights sit on top of the haze
for cls in ('wash', 'mid', 'fine'):
    parts.append('<g filter="url(#b-%s)">%s</g>' % (cls, ''.join(bodies[cls])))
parts.append('</svg>')

out = '\n'.join(parts)
with open('assets/cta-waves.svg', 'w', encoding='utf-8') as f:
    f.write(out)

print('assets/cta-waves.svg  %.1f KB  %d strands' % (len(out) / 1024, len(STRANDS)))
