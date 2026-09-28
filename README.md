# SondageDirect — homepage

Static marketing homepage for SondageDirect, a survey platform. Built to match an
approved design reference.

## Stack

- HTML5, CSS3, vanilla JavaScript
- Bootstrap 5.3 (CDN)
- Inter via Google Fonts

No build step. Everything is hand-authored.

## Running locally

The page must be served over HTTP rather than opened from the filesystem, so the
relative asset paths resolve:

```bash
python -m http.server 8123
```

Then open <http://localhost:8123>.

## Layout

```
index.html          markup for every section
css/style.css       all styling, mobile-first with desktop overrides
js/main.js          sticky header, mobile nav, testimonial carousel, newsletter
assets/             images, icons and brand marks used by the page
assets/@why/        original full-resolution source images
```

## Sections

Header · hero · trusted-by logos · features · how it works · use cases ·
impact metrics · testimonials · closing CTA · footer.

## Notes

- Designed against a 1440px desktop reference; the shared container widens above
  1500px so the page scales rather than stranding a fixed column.
- Breakpoints at 1200px, 992px, 768px and 576px.
- Images in `assets/` are optimized web copies; the originals live in
  `assets/@why/`. Each is sized to stay sharp at 2× device pixel ratio.
- Testimonials become a swipeable carousel below 992px, where the dots
  become active controls.
