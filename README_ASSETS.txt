SondageDirect - assets
======================

/assets

  Raster images were prepared from the approved full-page reference so the
  visual language matches it. Each is sized to stay sharp at 2x DPR.

  The brand marks (brand-*.svg, social-*.svg) are lightweight stand-ins drawn
  to the right proportions. Swap them for official artwork before launch if the
  client has it.

  logo-mark.png has a transparent background - it sits directly on whatever is
  behind it, including the blue on the sign-in and sign-up pages.

  auth-sky.svg and cta-waves.svg are generated, not drawn by hand. The scripts
  that produce them are tools-draw-auth-sky.py and tools-draw-cta-waves.py in
  the project root. Only re-run those if you edit the shape data inside them.

  auth-illustration.svg and auth-reward.svg are not currently referenced by any
  page. They were drawn for an earlier version of the auth screens and are kept
  in case they're wanted again.

/assets/@why

  Original full-resolution reference images. Not loaded by any page - working
  copies only. Safe to leave out of a deployment.
