/* Scroll and entrance animation.
 *
 * One rule, learned the hard way: nothing that carries meaning is ever partly
 * or conditionally invisible. Text, figures and cards either have arrived or
 * are still below the fold — there is no third state.
 *
 * Three earlier versions each broke that rule a different way.
 *
 *   Scrubbing reveals tied their progress to the scroll position, so stopping
 *   mid-range left cards at 94% scale and 45px down for as long as you stopped
 *   there. A scrubbed tween has no notion of being finished.
 *
 *   Reversing them on the way back up — play none none reverse — looked fine
 *   in a clean sweep and was unusable in practice: six small nudges of the
 *   wheel near a trigger line produced twelve visibility flips, a whole grid
 *   of cards strobing while you read.
 *
 *   Scrubbing the hero copy's opacity left the headline sitting at 0.48 of
 *   full wherever you happened to stop.
 *
 * So reveals here fire once, run on their own clock, and stay. The trigger
 * retires the moment it fires, which is what makes jitter a non-event: there
 * is no line left to waver across.
 *
 * Motion that genuinely does run both ways is still here — the progress bar
 * and the parallax layers are scrubbed frame-for-frame to the wheel. Those are
 * safe to scrub precisely because they carry no meaning: a decorative layer
 * parked at some offset is just a layer at an offset, and the bar is supposed
 * to read as "this far down".
 *
 * It fails visible twice. Nothing runs unless gsap and ScrollTrigger both
 * loaded, so a dead CDN leaves plain, fully rendered HTML. And since a from()
 * hides its target as it is built, every reveal is registered with a backstop
 * that finishes anything still hidden once the page has settled.
 */
(function () {
  'use strict';

  if (typeof window.gsap === 'undefined') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var hasST = typeof window.ScrollTrigger !== 'undefined';
  if (hasST) gsap.registerPlugin(ScrollTrigger);

  var q = function (sel, root) {
    return [].slice.call((root || document).querySelectorAll(sel));
  };

  var pending = [];        // every reveal, for the backstop at the foot of the file

  /* ---------- hero ---------- */

  /* The headline arrives a word at a time, each word rising out of its own
     clipped box. That needs two elements per word: an outer .word that clips
     and an inner .word-i that moves. Splitting only text nodes leaves the <br>
     and the accented span where the copy put them, so the line breaks survive. */
  var heading = document.querySelector('.hero-heading');
  var headingWords = [];

  var wrapWord = function (text) {
    var outer = document.createElement('span');
    var inner = document.createElement('span');
    outer.className = 'word';
    inner.className = 'word-i';
    inner.textContent = text;
    outer.appendChild(inner);
    headingWords.push(inner);
    return outer;
  };

  if (heading) {
    [].slice.call(heading.childNodes).forEach(function (node) {
      if (node.nodeType !== 3) return;                       // text nodes only
      if (!node.textContent.trim()) return;
      var frag = document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach(function (chunk) {
        frag.appendChild(chunk.trim() ? wrapWord(chunk) : document.createTextNode(chunk));
      });
      node.parentNode.replaceChild(frag, node);
    });

    var accent = heading.querySelector('.text-accent');
    if (accent) {
      var inner = document.createElement('span');
      inner.className = 'word-i';
      while (accent.firstChild) inner.appendChild(accent.firstChild);
      accent.appendChild(inner);
      accent.classList.add('word');
      headingWords.push(inner);
    }

    headingWords.sort(function (a, b) {
      return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });
  }

  var tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

  tl.from('.hero-copy-col .eyebrow', { y: 16, opacity: 0, duration: 0.5 });

  if (headingWords.length) {
    tl.from(headingWords, {
      yPercent: 110, opacity: 0, duration: 0.8, stagger: 0.05, ease: 'power4.out'
    }, '-=0.25');
  }

  tl.from('.hero-sub', { y: 18, opacity: 0, duration: 0.55 }, '-=0.45')
    .from('.hero-cta-row .btn', { y: 18, opacity: 0, duration: 0.5, stagger: 0.08 }, '-=0.35')
    .from('.hero-point', { y: 14, opacity: 0, duration: 0.45, stagger: 0.07 }, '-=0.3')
    .from('.hero-visual-col', { scale: 1.05, opacity: 0, duration: 1.1, ease: 'power2.out' }, 0.15);

  /* The hero runs on load, so its from() tweens hide their targets the moment
     they are built. If the ticker ever stalls, the most important thing on the
     page would stay blank — so jump to the end if it has not finished long
     after it should have. A no-op normally. */
  window.setTimeout(function () {
    if (tl.progress() < 1) tl.progress(1);
  }, 4000);

  if (!hasST) return;

  /* ---------- the reveal ---------- */

  /* Timed, so it always reaches an end, and once, so the trigger retires as it
     fires. Nothing to waver across afterwards, nothing to strobe.

     start is 'top 86%' — low enough that the element is properly on screen
     when it goes, high enough that you are not watching a gap wait for it. */
  var reveal = function (targets, vars, trigger) {
    if (!targets || targets.length === 0) return;

    pending.push(gsap.from(targets, Object.assign({
      y: 28,
      opacity: 0,
      duration: 0.7,
      ease: 'power3.out',
      clearProps: 'transform',
      scrollTrigger: { trigger: trigger, start: 'top 86%', once: true }
    }, vars)));
  };

  /* ---------- the two things that do run both ways ---------- */

  /* The bar IS how far down you are, so it is scrubbed straight off the
     scrollbar and tracks the wheel in either direction. */
  var bar = document.getElementById('scrollProgress');
  if (bar) {
    gsap.to(bar, {
      scaleX: 1, ease: 'none',
      scrollTrigger: { start: 0, end: 'max', scrub: 0.3 }
    });
  }

  /* Decorative layers drifting at their own rate as the page travels past,
     also scrubbed and also bidirectional. Safe to scrub because they carry no
     meaning — parked at an offset, they are simply at an offset. Kept small:
     this is depth, not a ride. */
  var drift = function (sel, from, to, trigger) {
    var el = document.querySelector(sel);
    if (!el) return;
    gsap.fromTo(el, from, Object.assign({
      ease: 'none',
      scrollTrigger: { trigger: trigger || sel, start: 'top bottom', end: 'bottom top', scrub: 0.8 }
    }, to));
  };

  drift('.hero-visual-col', { yPercent: 0 }, { yPercent: 7 }, '.hero-section');
  drift('.how-visual-col', { yPercent: 5 }, { yPercent: -5 }, '.how-section');

  [['.cta-shape-1', -5], ['.cta-shape-2', 3], ['.cta-shape-3', 7]].forEach(function (pair) {
    drift(pair[0], { xPercent: -pair[1] }, { xPercent: pair[1] }, '.cta-band');
  });

  /* ---------- everything that reveals ---------- */

  q('.section-head').forEach(function (head) {
    reveal(head.children, { stagger: 0.08 }, head);
  });

  /* Each grid goes as one group, triggered on its container, so a row arrives
     together rather than each card waiting for its own line. */
  [
    ['.reward-card',      { y: 26, scale: 0.97, stagger: 0.05, ease: 'back.out(1.3)' }],
    ['.usecase-card',     { y: 30, stagger: 0.08 }],
    ['.stat',             { y: 26, scale: 0.97, stagger: 0.07, ease: 'back.out(1.3)' }],
    ['.testimonial-card', { y: 28, stagger: 0.09 }],
    ['.faq-item',         { y: 16, stagger: 0.05, duration: 0.55 }]
  ].forEach(function (pair) {
    var items = q(pair[0]);
    if (!items.length) return;
    reveal(items, pair[1], items[0].parentNode);
  });

  var howCopy = document.querySelector('.how-copy-col');
  if (howCopy) {
    reveal(
      [howCopy.querySelector('.eyebrow'), howCopy.querySelector('.how-title'), howCopy.querySelector('.how-sub')].filter(Boolean),
      { stagger: 0.08 },
      howCopy
    );
  }

  q('.step').forEach(function (step, i) {
    reveal(step, { x: -26, y: 0, delay: i * 0.08 }, step);
    var num = step.querySelector('.step-num');
    if (num) {
      reveal(num, { y: 0, scale: 0.4, duration: 0.55, delay: i * 0.08 + 0.1, ease: 'back.out(2)' }, step);
    }
  });

  var ctaInner = document.querySelector('.cta-inner');
  if (ctaInner) reveal(ctaInner.children, { stagger: 0.09 }, '.cta-band');

  /* ---------- the figures ---------- */

  /* Counts up once, on its own duration. Seeded to zero at build so a figure
     never shows its real value and then snaps back to zero when the trigger
     fires; the backstop restores the real value if the trigger never comes. */
  q('.stat-value').forEach(function (el) {
    var raw = el.textContent.trim();
    var match = raw.match(/^([\d.]+)(.*)$/);
    if (!match) return;

    var target = parseFloat(match[1]);
    var suffix = match[2];
    var decimals = (match[1].split('.')[1] || '').length;
    var counter = { n: 0 };

    el.textContent = (0).toFixed(decimals) + suffix;

    pending.push(gsap.to(counter, {
      n: target,
      duration: 1.2,
      ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 86%', once: true },
      onUpdate: function () {
        el.textContent = counter.n.toFixed(decimals) + suffix;
      },
      onComplete: function () { el.textContent = raw; }   // never a rounding artefact
    }));
  });

  /* ---------- the answers, sliding ---------- */

  /* <details> snaps. Taking over the summary click lets the answer slide, and
     lets a closing panel finish before the element actually closes. main.js
     keeps the plain version for when GSAP is not here, so it stands down. */
  var faqItems = q('.faq-item');

  if (faqItems.length) {
    window.__faqAnimated = true;

    var slide = function (item, open) {
      var body = item.querySelector('.faq-a');
      if (!body) { item.open = open; return; }

      var pad = parseFloat(window.getComputedStyle(body).paddingBottom) || 0;
      var settle = function () {
        gsap.set(body, { clearProps: 'height,paddingBottom,opacity,overflow' });
        ScrollTrigger.refresh();     // the page just got taller or shorter
      };

      gsap.killTweensOf(body);

      if (open) {
        item.open = true;
        gsap.fromTo(body,
          { height: 0, paddingBottom: 0, opacity: 0, overflow: 'hidden' },
          { height: 'auto', paddingBottom: pad, opacity: 1,
            duration: 0.4, ease: 'power2.out', onComplete: settle });
      } else {
        gsap.to(body, {
          height: 0, paddingBottom: 0, opacity: 0, overflow: 'hidden',
          duration: 0.3, ease: 'power2.in',
          onComplete: function () { item.open = false; settle(); }
        });
      }
    };

    faqItems.forEach(function (item) {
      var summary = item.querySelector('.faq-q');
      if (!summary) return;

      summary.addEventListener('click', function (event) {
        event.preventDefault();               // we drive the open state
        var wasOpen = item.open;

        faqItems.forEach(function (other) {
          if (other !== item && other.open) slide(other, false);
        });

        slide(item, !wasOpen);
      });
    });
  }

  /* ---------- pointer play ---------- */

  /* Cards tilt very slightly towards the cursor — a few degrees, enough to
     feel alive and not enough to read as a gimmick. */
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    q('.reward-card, .stat, .usecase-card').forEach(function (card) {
      var rotY = gsap.quickTo(card, 'rotateY', { duration: 0.5, ease: 'power2.out' });
      var rotX = gsap.quickTo(card, 'rotateX', { duration: 0.5, ease: 'power2.out' });
      var lift = gsap.quickTo(card, 'y', { duration: 0.45, ease: 'power2.out' });

      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        rotY(((e.clientX - r.left) / r.width - 0.5) * 5);
        rotX(((e.clientY - r.top) / r.height - 0.5) * -5);
      });
      card.addEventListener('pointerenter', function () { lift(-5); });
      card.addEventListener('pointerleave', function () { rotY(0); rotX(0); lift(0); });
    });

    q('.btn-brand, .btn-white-cta').forEach(function (btn) {
      var x = gsap.quickTo(btn, 'x', { duration: 0.4, ease: 'power3.out' });
      var y = gsap.quickTo(btn, 'y', { duration: 0.4, ease: 'power3.out' });

      btn.addEventListener('pointermove', function (e) {
        var r = btn.getBoundingClientRect();
        x((e.clientX - r.left - r.width / 2) * 0.2);
        y((e.clientY - r.top - r.height / 2) * 0.28);
      });
      btn.addEventListener('pointerleave', function () { x(0); y(0); });
    });
  }

  /* ---------- the backstop ---------- */

  window.addEventListener('load', function () {
    /* Layout shifts once the webfont swaps and the photographs decode, so the
       trigger positions measured a moment ago are stale. */
    ScrollTrigger.refresh();

    /* Then: anything still holding its start state while sitting in or above
       the viewport never got its trigger and would otherwise stay invisible.
       Finish it. Normally this finds nothing. */
    window.setTimeout(function () {
      pending.forEach(function (tween) {
        if (tween.progress() > 0) return;
        var trigger = tween.scrollTrigger && tween.scrollTrigger.trigger;
        if (!trigger) return;
        if (trigger.getBoundingClientRect().top > window.innerHeight) return;
        tween.progress(1);
      });
    }, 2500);
  });
})();
