# SondageDirect

Static front end for SondageDirect, a paid-survey platform. Marketing pages plus
the signed-in screens. No build step, no framework.

## Stack

- HTML5, CSS3, vanilla JS
- Bootstrap 5.3 and GSAP 3.12 (both from CDN)
- Inter via Google Fonts

## Running it

Serve over HTTP rather than opening the files directly, or the relative paths
won't resolve:

```bash
python -m http.server 8123
```

Then <http://localhost:8123>.

## Pages

```
index.html              marketing homepage
signin.html             log in
signup.html             create an account
dashboard.html          available surveys, balance, activity
wallet.html             balance, progress to the payout minimum, ledger
payout-methods.html     gift cards / PayPal / virtual card
invite.html             referral link and how it works
profile.html            account details, editable in a dialog
terms-conditions.html   legal
privacy-policy.html     legal
```

## Files

```
css/style.css   shared: tokens, header, footer, marketing sections, legal pages
css/app.css     signed-in screens only, loaded after style.css
css/auth.css    signin + signup only, loaded after style.css
js/main.js      header, nav marking, sliding pill, review dots, FAQ
js/animations.js  scroll and entrance animation (GSAP + ScrollTrigger)
js/app.js       segmented controls, wallet arc, copy, modals, profile editing
js/auth.js      password toggle, region cascade, form validation
assets/         images, icons, brand marks, generated backgrounds
assets/@why/    original full-resolution reference images
tools-*.py      one-off generators for the SVG backgrounds (not used at runtime)
```

Colours, radii, shadows and buttons are all CSS custom properties declared at
the top of `style.css`. `app.css` and `auth.css` build on those rather than
declaring their own, so changing `--blue` moves the whole site.

## Notes

- There is no back end. Forms validate and report success, but nothing is sent
  and nothing is stored.
- Designed against a 1440px reference. Breakpoints at 1200, 992, 768 and 576;
  the container widens above 1500 so the page scales instead of stranding a
  fixed column.
- Animation is declared in the markup with `data-anim` attributes, not listed
  in the script. The start state is CSS behind `html.sd-anim`, which an inline
  script in each `<head>` adds and `animations.js` removes. A 2.5s failsafe
  drops it if GSAP never loads, so the pages render without it.
- Icons are an inlined Lucide sprite. `stroke-width` is set in CSS, not on the
  symbols, so it can scale with the rendered size.
- `tools-draw-auth-sky.py` and `tools-draw-cta-waves.py` generate the two
  background SVGs. Re-run them only if you edit the shape data inside.
