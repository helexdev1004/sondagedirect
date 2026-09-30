/* Scroll and entrance animation.
 *
 * BIDIRECTIONAL and scrubbed: a reveal's progress IS the scroll position, so
 * it runs forward going down and backward coming up, joined to the wheel.
 *
 * The thing that took longest to get right was not the mechanism but WHERE on
 * the screen the change happens, and it is worth writing down because every
 * earlier version failed on it.
 *
 * A scrub can only be watched in the part of the screen you are looking at.
 * The previous range ran to 'top 55%' on a front-loaded curve, which sounds
 * generous and was not: power3.out crams most of the change into the start of
 * the range, so 70% of every fade was finished before the element had cleared
 * the bottom 15% of the screen, and only 30% of it was left for the whole
 * comfortable viewing band. That is why it read as no animation at all. It
 * was animating perfectly, just nowhere anyone was looking.
 *
 * So the range is 'top 92%' to 'top 45%' and the curve is LINEAR. Change is
 * spread evenly — about 11% of the fade for every 5% of screen the element
 * travels — across the middle of the viewport, where it can be seen. 85% of
 * each reveal now happens in the band between 40% and 85% of the screen,
 * against 30% before.
 *
 * That means things ARE partly revealed higher up the screen, which earlier
 * versions treated as a defect. It is not, and the distinction matters: what
 * looked broken before was a card stranded at 94% scale and 45px out of
 * place, because a wrong SIZE or POSITION reads as broken layout against the
 * neighbour beside it. A wrong OPACITY does not — a half-faded card reads as
 * arriving. So nothing here animates size or position. Opacity and blur only,
 * both of which leave the box exactly where the grid put it, and both of
 * which look deliberate at every value in between.
 *
 * Blur is also what makes it feel like something rather than a plain fade:
 * type and tiles come into focus as they climb the page.
 *
 * Triggers are per element, so cards sharing a row share a height and resolve
 * together; the sequence down the page comes from the layout rather than from
 * a stagger value. Jitter cannot strobe, because a scrub maps a position
 * rather than crossing a line.
 *
 * Hover is separate and lives in the stylesheet: one hold, scale(1.03).
 *
 * It fails visible: nothing runs unless gsap and ScrollTrigger both loaded,
 * and a backstop finishes anything still hidden once the page has settled.
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
  var DURATION = 0.6;            // the hero, which runs on load rather than on scroll
  var STAGGER  = 0.06;

  /* The reveal range, and the curve that spreads change across it. LINEAR is
     deliberate: an eased scrub front-loads the change into the bottom of the
     screen where nobody is looking. Flat means roughly a ninth of the fade
     for every 5% of screen the element climbs, all the way up. */
  /* clamp() keeps both ends inside the page's own scroll range. Without it
     anything near the bottom — the closing band, and the last of the answers
     — can never finish, because the page runs out of scroll before those
     elements climb to 45% of the viewport, and they sit part-faded for good.
     The longer the range, the further up an element has to travel, so a range
     wide enough to be watchable is exactly the one that needs this. */
  var FROM       = 'clamp(top 92%)';
  var TO         = 'clamp(top 45%)';
  var SCRUB_EASE = 'none';

  var SCRUB    = 0.5;            // tight enough to feel joined to the wheel

  /* Coming into focus is what makes this read as an effect rather than a
     plain fade. Blur is not free — it is the one thing here that costs
     frames — so the surface radius is kept low, where it buys the look
     without the cost. */
  var BLUR_SURFACE = 5;
  var BLUR_TEXT    = 8;

  var pending = [];              // every reveal, for the backstop at the foot of the file

  /* ---------- the two gestures ---------- */

  var play = function (el, from, to) {
    if (!el) return;
    pending.push(gsap.fromTo(el, from, Object.assign({
      ease: SCRUB_EASE,
      scrollTrigger: {
        trigger: el,          // its own position, so a row arrives as a row
        start: FROM,
        end: TO,
        scrub: SCRUB
      }
    }, to)));
  };

  var each = function (targets, fn) {
    if (!targets) return;
    (targets.length === undefined ? [targets] : [].slice.call(targets)).forEach(fn);
  };

  /* A surface comes into focus. No scale and no movement: a box at the wrong
     SIZE or in the wrong PLACE reads as broken layout beside a neighbour that
     has finished, which is what made an earlier version look stranded. A box
     at the wrong opacity simply reads as arriving. */
  var surface = function (targets) {
    each(targets, function (el) {
      play(el,
        { opacity: 0, filter: 'blur(' + BLUR_SURFACE + 'px)' },
        { opacity: 1, filter: 'blur(0px)' });
    });
  };

  /* Text comes into focus and nothing else. */
  var text = function (targets) {
    each(targets, function (el) {
      play(el,
        { opacity: 0, filter: 'blur(' + BLUR_TEXT + 'px)' },
        { opacity: 1, filter: 'blur(0px)' });
    });
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
  q('.section-head').forEach(function (head) { text(head.children); });

  var howCopy = document.querySelector('.how-copy-col');
  if (howCopy) {
    text([howCopy.querySelector('.eyebrow'),
          howCopy.querySelector('.how-title'),
          howCopy.querySelector('.how-sub')].filter(Boolean));
  }

  var ctaInner = document.querySelector('.cta-inner');
  if (ctaInner) text(ctaInner.children);

  /* Cards and tiles — surfaces, so they open. Each is triggered on itself, so
     the ones sharing a row share a height and arrive together; the sequence
     down the page falls out of the layout rather than a stagger value. */
  ['.reward-card', '.usecase-card', '.stat', '.testimonial-card', '.faq-item'].forEach(function (sel) {
    surface(q(sel));
  });

  /* A step is a numbered badge beside a line of copy: the badge is a surface,
     the copy is text. Same two gestures, no third one invented for this row. */
  q('.step').forEach(function (step) {
    text(step);
    var num = step.querySelector('.step-num');
    if (num) surface(num);
  });

  /* ---------- the figures ---------- */

  /* Counts with the wheel, like everything else: scrubbed over the same range,
     so it runs up as the figure arrives and back down if you scroll away. It
     reaches its real value while the tile is still low on the screen, so the
     number you read is always the true one. Seeded to zero at build so it
     never shows the real figure and then snaps back to zero. */
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
      ease: EASE,
      scrollTrigger: { trigger: el, start: FROM, end: TO, scrub: SCRUB },
      onUpdate: function () {
        /* Write the original string back at the top so no rounding artefact
           can survive, and so "10K+" keeps its shape rather than "10.0K+". */
        el.textContent = Math.abs(counter.n - target) < 0.005
          ? raw
          : counter.n.toFixed(decimals) + suffix;
      }
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

    /* Then the safety net, which has to be narrower than it looks. The risk
       is ScrollTrigger failing to compute at all and leaving from()-hidden
       elements invisible for good. The temptation is to finish anything
       sitting at zero inside the viewport — but with a scrub, zero inside the
       viewport is a perfectly legitimate state: it is an element that has
       just entered and not started climbing yet. Forcing those wrecks the
       reveal for anyone who scrolls in the first few seconds.
       So this only finishes what the scroll position says should ALREADY be
       finished: past its own end, yet still unrendered. Normally none. */
    window.setTimeout(function () {
      pending.forEach(function (tween) {
        var st = tween.scrollTrigger;
        if (!st) return;
        if (tween.progress() >= 1) return;
        if (window.scrollY < st.end) return;
        tween.progress(1);
      });
    }, 2500);
  });
})();
