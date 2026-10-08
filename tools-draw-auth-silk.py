"""Draws the silk behind the sign in / sign up glass.

Same idea as the closing band's backdrop and the same machinery, but for a
different job, which changes three things:

  * the canvas is 1600x1100 rather than 1600x400, and the strands run corner
    to corner instead of along a band. A wide band's strands are near enough
    horizontal; stretched up a full viewport they looked like a barcode.
  * nothing is kept clear in the middle. The glass panel sits there and blurs
    whatever is behind it, so the middle is exactly where there should be
    something worth blurring — an empty centre blurs to a flat grey panel.
  * the strands are brighter. They are read through 30px of backdrop blur at
    something like a third of their contrast, and the band's settings, which
    are right on their own ground, came through the glass as nothing at all.

Writes assets/auth-silk.svg. Re-run after editing STRANDS.
"""

import math

W, H = 1600, 1100

# (max half-width, blur, base alpha, samples per segment).
CLASS = {
    'wash': (190, 46, 0.130, 14),
    'mid':  (62,  20, 0.165, 26),
    'fine': (15,  6,  0.205, 40),
}

# (class, alpha multiplier, waypoints). Points run off every edge so no strand
# begins or ends inside the picture.
#
# Each one turns back on itself somewhere: waypoints that only climb or only
# fall give the spline nothing to bend around and it comes back a straight
# line, which reads as a searchlight rather than a fold of cloth.
STRANDS = [
    # the main diagonal fold, low left to high right
    ('wash', 1.00, [(-280, 880), (180, 940), (640, 760), (1080, 470), (1480, 300), (1880, 330)]),
    ('mid',  0.80, [(-260, 930), (220, 986), (680, 806), (1120, 512), (1520, 338)]),
    ('fine', 0.62, [(-240, 962), (260, 1014), (720, 836), (1160, 540), (1560, 364)]),

    # the counter-fold crossing it, high left to low right
    ('wash', 0.92, [(-280, 180), (160, 120), (620, 300), (1060, 600), (1460, 820), (1880, 880)]),
    ('mid',  0.74, [(-260, 230), (200, 168), (660, 348), (1100, 646), (1500, 862)]),
    ('fine', 0.58, [(-240, 262), (240, 200), (700, 380), (1140, 676), (1540, 888)]),

    # top left corner, a broad soft fold turning in
    ('wash', 1.25, [(-300, -140), (60, 60), (340, 300), (430, 600), (380, 940), (460, 1240)]),
    ('mid',  0.85, [(-260, -100), (110, 104), (390, 342), (478, 636), (424, 966)]),

    # bottom right corner, the answering one
    ('wash', 1.10, [(1180, 1240), (1300, 940), (1402, 640), (1520, 380), (1820, 140)]),
    ('fine', 0.70, [(1240, 1240), (1356, 952), (1456, 656), (1572, 398)]),

    # a slow undulation across the upper third
    ('mid',  0.62, [(-200, 420), (300, 338), (780, 404), (1240, 300), (1820, 346)]),
    ('fine', 0.48, [(-180, 462), (340, 378), (820, 444), (1280, 338)]),

    # and one across the lower third, bending the other way
    ('mid',  0.58, [(-200, 700), (320, 790), (800, 712), (1280, 806), (1820, 742)]),

    # two fine threads to catch the light where the panel edge will fall
    ('fine', 0.80, [(240, -160), (520, 180), (700, 520), (760, 880), (700, 1260)]),
    ('fine', 0.66, [(1420, -160), (1180, 220), (1040, 560), (1060, 900), (1180, 1260)]),

    # a faint wash holding the foot so the bottom edge is not flat
    ('wash', 0.58, [(-280, 1060), (300, 1116), (900, 1046), (1480, 1108), (1880, 1058)]),
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
    """Fat in the middle, a point at both ends, belly pushed off centre so
    every strand is not the same leaf."""
    return math.sin(math.pi * t) ** 0.62


def ribbon(points, half, steps):
    """The centreline offset either side by the tapering half-width, as one
    closed path."""
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

    d = ['M%.0f %.0f' % top[0]]
    d += ['L%.0f %.0f' % p for p in top[1:]]
    d += ['L%.0f %.0f' % p for p in reversed(bottom)]
    d.append('Z')
    return ''.join(d)


parts = []
defs = ['<defs>']

# One blur per class, in user space with a wide margin — per-shape filter
# regions clip the blur and give every strand a seam.
for name, (_, blur, _, _) in CLASS.items():
    defs.append(
        '<filter id="b-%s" filterUnits="userSpaceOnUse" x="-500" y="-500" '
        'width="%d" height="%d"><feGaussianBlur stdDeviation="%s"/></filter>'
        % (name, W + 1000, H + 1000, blur))

bodies = {k: [] for k in CLASS}

# Cool at the top, warmer blue low down, so the silk is not one flat white.
for i, (cls, mult, waypoints) in enumerate(STRANDS):
    half, _, base, steps = CLASS[cls]
    a = base * mult
    x1, y1 = waypoints[0]
    x2, y2 = waypoints[-1]
    defs.append(
        '<linearGradient id="g%d" gradientUnits="userSpaceOnUse" '
        'x1="%.0f" y1="%.0f" x2="%.0f" y2="%.0f">'
        '<stop offset="0" stop-color="#9FD0FF" stop-opacity="0"/>'
        '<stop offset="0.18" stop-color="#BFE0FF" stop-opacity="%.3f"/>'
        '<stop offset="0.48" stop-color="#FFFFFF" stop-opacity="%.3f"/>'
        '<stop offset="0.78" stop-color="#A9CCFF" stop-opacity="%.3f"/>'
        '<stop offset="1" stop-color="#8FBFFF" stop-opacity="0"/>'
        '</linearGradient>'
        % (i, x1, y1, x2, y2, a * 0.62, a, a * 0.54))
    bodies[cls].append('<path d="%s" fill="url(#g%d)"/>' % (ribbon(waypoints, half, steps), i))

defs.append('</defs>')

parts.append('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" '
             'width="%d" height="%d" preserveAspectRatio="xMidYMid slice">' % (W, H, W, H))
parts.append('\n'.join(defs))
for cls in ('wash', 'mid', 'fine'):
    parts.append('<g filter="url(#b-%s)">%s</g>' % (cls, ''.join(bodies[cls])))
parts.append('</svg>')

out = '\n'.join(parts)
with open('assets/auth-silk.svg', 'w', encoding='utf-8') as f:
    f.write(out)

print('assets/auth-silk.svg  %.1f KB  %d strands' % (len(out) / 1024, len(STRANDS)))
