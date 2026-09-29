/* Scroll and entrance animation.
 *
 * Everything here is additive. Each effect is written with gsap.from(), so the
 * start state is only ever applied at the moment the animation runs — if the
 * CDN is blocked, the script bails out below and the page renders exactly as
 * it does with animation switched off. Nothing is hidden in the stylesheet
 * waiting to be revealed.
 */
(function () {
  'use strict';

  if (typeof window.gsap === 'undefined') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var hasScrollTrigger = typeof window.ScrollTrigger !== 'undefined';
  if (hasScrollTrigger) gsap.registerPlugin(ScrollTrigger);

  var EASE = 'power2.out';

  var q = function (sel, root) {
    return [].slice.call((root || document).querySelectorAll(sel));
  };

  /* gsap.from() paired with ScrollTrigger normally applies its start state the
     moment the tween is built, and only clears it when the trigger fires. That
     trades a guaranteed-invisible failure mode for a cosmetic one, which is the
     wrong way round on a live page: hold the start state back instead, so a
     trigger that never fires leaves the content on screen rather than blank. */
  var reveal = function (targets, vars, trigger, start) {
    if (!targets || (targets.length === 0)) return;
    vars.immediateRender = false;
    vars.scrollTrigger = { trigger: trigger, start: start || 'top 85%', once: true };
    gsap.from(targets, vars);
  };

  /* ---------- hero: one timeline, played on load ---------- */

  var heroBits = [
    '.hero-copy-col .eyebrow',
    '.hero-heading',
    '.hero-sub',
    '.hero-cta-row',
    '.hero-points'
  ].map(function (s) { return document.querySelector(s); }).filter(Boolean);

  if (heroBits.length) {
    gsap.timeline({ defaults: { ease: EASE } })
      .from(heroBits, { y: 24, opacity: 0, duration: 0.7, stagger: 0.09 })
      .from('.hero-visual-col', { x: 40, opacity: 0, duration: 1.1 }, 0.15);
  }

  if (!hasScrollTrigger) return;

  /* The photograph drifts a little slower than the page. Small on purpose —
     enough to feel like depth, not enough to notice as an effect. */
  var heroVisual = document.querySelector('.hero-visual-col');
  if (heroVisual) {
    gsap.to(heroVisual, {
      y: 52,
      ease: 'none',
      scrollTrigger: {
        trigger: '.hero-section',
        start: 'top top',
        end: 'bottom top',
        scrub: 0.6
      }
    });
  }

  /* ---------- a section heading lifts as it arrives ---------- */

  q('.section-head').forEach(function (head) {
    reveal(head.children, { y: 22, opacity: 0, duration: 0.6, stagger: 0.08, ease: EASE },
           head, 'top 82%');
  });

  /* ---------- grids arrive one tile at a time ---------- */

  var grids = [
    { items: '.reward-card',     from: { y: 20, opacity: 0, scale: 0.97 }, stagger: 0.045 },
    { items: '.usecase-card',    from: { y: 26, opacity: 0 },              stagger: 0.09 },
    { items: '.stat',            from: { y: 26, opacity: 0 },              stagger: 0.09 },
    { items: '.testimonial-card',from: { y: 26, opacity: 0 },              stagger: 0.11 },
    { items: '.faq-item',        from: { y: 16, opacity: 0 },              stagger: 0.06 },
    { items: '.step',            from: { x: -18, opacity: 0 },             stagger: 0.12 }
  ];

  grids.forEach(function (g) {
    var items = q(g.items);
    if (!items.length) return;
    reveal(items, Object.assign({}, g.from, {
      duration: 0.6, ease: EASE, stagger: g.stagger
    }), items[0].parentNode);
  });

  /* ---------- how it works: copy and illustration meet in the middle ---------- */

  var howCopy = document.querySelector('.how-copy-col');
  var howVisual = document.querySelector('.how-visual-col');

  if (howCopy && howVisual) {
    reveal(
      [howCopy.querySelector('.eyebrow'), howCopy.querySelector('.how-title'), howCopy.querySelector('.how-sub')].filter(Boolean),
      { y: 22, opacity: 0, duration: 0.6, stagger: 0.08, ease: EASE },
      howCopy, 'top 80%'
    );
    reveal(howVisual, { x: 44, opacity: 0, duration: 0.9, ease: EASE }, howVisual);
  }

  /* ---------- the figures count up ---------- */

  q('.stat-value').forEach(function (el) {
    var raw = el.textContent.trim();
    var match = raw.match(/^([\d.]+)(.*)$/);
    if (!match) return;

    var target = parseFloat(match[1]);
    var suffix = match[2];
    var decimals = (match[1].split('.')[1] || '').length;
    var counter = { n: 0 };

    gsap.to(counter, {
      n: target,
      duration: 1.2,
      ease: 'power1.out',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      onUpdate: function () {
        el.textContent = counter.n.toFixed(decimals) + suffix;
      },
      // never leave a rounding artefact on screen
      onComplete: function () { el.textContent = raw; }
    });
  });

  /* ---------- closing band ---------- */

  var ctaInner = document.querySelector('.cta-inner');
  if (ctaInner) {
    reveal(ctaInner.children, { y: 24, opacity: 0, duration: 0.65, stagger: 0.1, ease: EASE },
           '.cta-band');
  }

  /* Cards and images settle after the webfont swaps and the photographs
     decode, either of which changes how tall things are. */
  window.addEventListener('load', function () { ScrollTrigger.refresh(); });
})();
