/* Scroll and entrance animation.
 *
 * ONE SYSTEM. Everything on this page is built from four numbers and two
 * gestures, and that constraint is the whole design. What was here before had
 * six easing curves, eight durations, five stagger values and three different
 * hover behaviours, arrived at one section at a time — which is why no two
 * parts of the page felt like the same website.
 *
 * The four numbers are below. The two gestures are these, and which one a
 * thing gets is decided by what it IS, never by which section it lives in:
 *
 *   A SURFACE — a card, a tile, a badge, anything with an edge — opens from
 *   closed. It scales up into its own footprint and never moves. Nothing
 *   translating is what lets a grid of ten arrive as ten cards opening rather
 *   than as ten tiles at ten different offsets bubbling into line.
 *
 *   TEXT resolves. Opacity alone, no movement and no scale. Type that slides
 *   or swells draws the eye to the motion instead of to the words.
 *
 * Nothing overshoots. A bounce at the end of a reveal — back.out was doing
 * the arriving here on three different settings — is the single thing that
 * dates this kind of motion fastest.
 *
 * Nothing reverses either. Reveals fire once and the trigger retires with
 * them, so there is no line left to waver across: scrolling back and forth
 * near a boundary used to strobe a whole grid off and on.
 *
 * Scrub is reserved for the two things that genuinely are a function of
 * scroll position — the reading bar and the parallax layers. Those carry no
 * meaning, so a tween of theirs sitting part-way is a resting state rather
 * than a broken one.
 *
 * It fails visible twice: nothing runs unless gsap and ScrollTrigger both
 * loaded, and every reveal is registered with a backstop that finishes
 * anything still hidden once the page has settled.
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

  /* ---------- the four numbers ---------- */

  var EASE     = 'power3.out';   // one curve everywhere, and it does not overshoot
  var DURATION = 0.6;
  var STAGGER  = 0.06;
  var START    = 'top 86%';      // one trigger line for every reveal on the page
  var SCRUB    = 0.8;            // one catch-up for everything scroll-linked

  var pending = [];              // every reveal, for the backstop at the foot of the file

  /* ---------- the two gestures ---------- */

  var play = function (targets, vars, trigger) {
    if (!targets || targets.length === 0) return;
    pending.push(gsap.from(targets, Object.assign({
      duration: DURATION,
      ease: EASE,
      stagger: STAGGER,
      clearProps: 'transform',
      scrollTrigger: { trigger: trigger, start: START, once: true }
    }, vars)));
  };

  /* A surface opens from closed. */
  var surface = function (targets, trigger, vars) {
    play(targets, Object.assign({ scale: 0.94, opacity: 0 }, vars || {}), trigger);
  };

  /* Text simply resolves. */
  var text = function (targets, trigger, vars) {
    play(targets, Object.assign({ opacity: 0 }, vars || {}), trigger);
  };

  /* ---------- hero ---------- */

  /* The headline arrives a word at a time, each word rising out of its own
     clipped box. This is the one place anything translates, and it is
     deliberate: the hero is a single moment on load rather than one of a
     dozen reveals you meet while reading, so it is allowed a gesture of its
     own. Everything else in the hero resolves like the rest of the page.

     Two elements per word: an outer .word that clips and an inner .word-i
     that moves. Splitting only text nodes leaves the <br> and the accented
     span where the copy put them, so the line breaks survive. */
  var heading = document.querySelector('.hero-heading');
  var headingWords = [];

  var wrapWord = function (word) {
    var outer = document.createElement('span');
    var inner = document.createElement('span');
    outer.className = 'word';
    inner.className = 'word-i';
    inner.textContent = word;
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

  var tl = gsap.timeline({ defaults: { ease: EASE, duration: DURATION } });

  tl.from('.hero-copy-col .eyebrow', { opacity: 0 });

  if (headingWords.length) {
    tl.from(headingWords, {
      yPercent: 110, opacity: 0, duration: DURATION * 1.35, stagger: STAGGER * 0.8
    }, '-=0.3');
  }

  tl.from('.hero-sub', { opacity: 0 }, '-=0.45')
    .from('.hero-cta-row .btn', { opacity: 0 }, '-=0.35')
    .from('.hero-point', { opacity: 0 }, '-=0.3')
    .from('.hero-visual-col', { opacity: 0, duration: DURATION * 1.8 }, 0.15);

  /* The hero runs on load, so its from() tweens hide their targets the moment
     they are built. If the ticker ever stalls, the most important thing on
     the page would stay blank — so jump to the end if it has not finished
     long after it should have. A no-op normally. */
  window.setTimeout(function () {
    if (tl.progress() < 1) tl.progress(1);
  }, 4000);

  if (!hasST) return;

  /* ---------- the two scrubbed things ---------- */

  /* The bar IS how far down you are. */
  var bar = document.getElementById('scrollProgress');
  if (bar) {
    gsap.to(bar, {
      scaleX: 1, ease: 'none',
      scrollTrigger: { start: 0, end: 'max', scrub: SCRUB }
    });
  }

  /* Decorative layers drifting at their own rate as the page travels past.
     Safe to scrub because they carry no meaning: parked at an offset, they
     are simply at an offset. Kept small — this is depth, not a ride. */
  var drift = function (sel, from, to, trigger) {
    var el = document.querySelector(sel);
    if (!el) return;
    gsap.fromTo(el, from, Object.assign({
      ease: 'none',
      scrollTrigger: { trigger: trigger || sel, start: 'top bottom', end: 'bottom top', scrub: SCRUB }
    }, to));
  };

  /* The hero drifts the <img> inside its frame, never the frame: the frame
     carries the dissolve, and moving it dragged the bottom fade below the
     section's overflow and ended the photograph on a hard sliced edge. It
     starts at 'top top' because the hero is already on screen at load — a
     range beginning at the bottom of the viewport is half spent before the
     page has been scrolled at all. */
  var heroImg = document.querySelector('.hero-visual-img');
  if (heroImg) {
    gsap.fromTo(heroImg, { yPercent: 0 }, {
      yPercent: 5, ease: 'none',
      scrollTrigger: { trigger: '.hero-section', start: 'top top', end: 'bottom top', scrub: SCRUB }
    });
  }

  drift('.how-visual-col', { yPercent: 5 }, { yPercent: -5 }, '.how-section');

  [['.cta-shape-1', -5], ['.cta-shape-2', 3], ['.cta-shape-3', 7]].forEach(function (pair) {
    drift(pair[0], { xPercent: -pair[1] }, { xPercent: pair[1] }, '.cta-band');
  });

  /* ---------- everything that reveals ---------- */

  /* Headings, copy, list items — text, so they resolve. */
  q('.section-head').forEach(function (head) { text(head.children, head); });

  var howCopy = document.querySelector('.how-copy-col');
  if (howCopy) {
    text([howCopy.querySelector('.eyebrow'),
          howCopy.querySelector('.how-title'),
          howCopy.querySelector('.how-sub')].filter(Boolean), howCopy);
  }

  var ctaInner = document.querySelector('.cta-inner');
  if (ctaInner) text(ctaInner.children, '.cta-band');

  /* Cards and tiles — surfaces, so they open. Each grid is triggered on its
     container so a row arrives together rather than each card waiting for its
     own line to be crossed. */
  ['.reward-card', '.usecase-card', '.stat', '.testimonial-card', '.faq-item'].forEach(function (sel) {
    var items = q(sel);
    if (items.length) surface(items, items[0].parentNode);
  });

  /* A step is a numbered badge beside a line of copy: the badge is a surface,
     the copy is text. Same two gestures, no third one invented for this row. */
  q('.step').forEach(function (step, i) {
    text(step, step, { delay: i * STAGGER });
    var num = step.querySelector('.step-num');
    if (num) surface(num, step, { delay: i * STAGGER });
  });

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
      duration: DURATION * 2,
      ease: EASE,
      scrollTrigger: { trigger: el, start: START, once: true },
      onUpdate: function () { el.textContent = counter.n.toFixed(decimals) + suffix; },
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
            duration: DURATION * 0.7, ease: EASE, onComplete: settle });
      } else {
        gsap.to(body, {
          height: 0, paddingBottom: 0, opacity: 0, overflow: 'hidden',
          duration: DURATION * 0.5, ease: EASE,
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

  /* ---------- hover ---------- */

  /* There is no hover code here any more, and that is the point. Hover is one
     gesture — the hold in the stylesheet, scale(1.03) on every card alike —
     and the stylesheet is the right place for it.
     What was here was a 3D tilt writing rotateY/rotateX, a lift writing y,
     and magnetic buttons writing x/y, each on its own duration and curve, on
     top of CSS hovers that were also moving the same elements. Four systems
     moving three kinds of element in two different languages. */

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
