import numpy as np
from PIL import Image

SRC = 'assets/@why/main-hero.png'
DST = 'assets/hero-main.jpg'

# The violet the sweater sits on (270-280) and the magenta fringe where hair
# meets it (300-340) both have to land in blue. A flat hue shift cannot do
# that: -50deg moves the fringe to 250-290, which is still violet. So the
# whole violet-to-magenta band is REMAPPED onto the blue band instead, which
# collapses it rather than sliding it.
IN_LO,  IN_HI  = 245.0, 330.0     # violet .. magenta
OUT_LO, OUT_HI = 208.0, 238.0     # brand blue band; 275 lands on ~219
EDGE           = 10.0             # feather either end so the band has no seam
MIN_SAT        = 0.06

a = np.asarray(Image.open(SRC).convert('RGB'), dtype=np.float32) / 255.0
r, g, b = a[..., 0], a[..., 1], a[..., 2]
mx = a.max(axis=2); mn = a.min(axis=2); df = mx - mn
safe = np.where(df == 0, 1.0, df)

h = np.zeros_like(mx)
h = np.where(mx == r, (60.0 * ((g - b) / safe) + 360.0) % 360.0, h)
h = np.where(mx == g,  60.0 * ((b - r) / safe) + 120.0, h)
h = np.where(mx == b,  60.0 * ((r - g) / safe) + 240.0, h)
h = np.where(df == 0, 0.0, h)
s = np.where(mx == 0, 0.0, df / np.where(mx == 0, 1.0, mx))
v = mx

# membership of the violet..magenta band, feathered at both ends
w = np.clip((h - (IN_LO - EDGE)) / EDGE, 0.0, 1.0) * np.clip(((IN_HI + EDGE) - h) / EDGE, 0.0, 1.0)
w = w * w * (3.0 - 2.0 * w)
w = np.where(s >= MIN_SAT, w, 0.0)

t = np.clip((h - IN_LO) / (IN_HI - IN_LO), 0.0, 1.0)
h_target = OUT_LO + t * (OUT_HI - OUT_LO)
h = h * (1.0 - w) + h_target * w

# the fringe is an artefact, not a garment: take some saturation out of the
# part of the band that was magenta so it reads as hair rather than colour
fringe = np.clip((h_target - 228.0) / 6.0, 0.0, 1.0) * w
s = s * (1.0 - 0.45 * fringe)

i = np.floor(h / 60.0) % 6
f = h / 60.0 - np.floor(h / 60.0)
p = v * (1 - s); q = v * (1 - f * s); t2 = v * (1 - (1 - f) * s)
out = np.zeros_like(a)
for k, (rr, gg, bb) in enumerate([(v,t2,p),(q,v,p),(p,v,t2),(p,q,v),(t2,p,v),(v,p,q)]):
    m = (i == k)
    out[..., 0] = np.where(m, rr, out[..., 0])
    out[..., 1] = np.where(m, gg, out[..., 1])
    out[..., 2] = np.where(m, bb, out[..., 2])

Image.fromarray(np.clip(out * 255.0, 0, 255).astype(np.uint8)).save(
    DST, quality=88, optimize=True, progressive=True)
print('remapped ->', DST, '| pixels touched: %.1f%%' % (100.0 * (w > 0.01).sum() / w.size))
