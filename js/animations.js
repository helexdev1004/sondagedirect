/* Scroll and entrance animation.
 *
 * Bidirectional: what arrives on the way down leaves again on the way back
 * up, so the page reads the same travelling in either direction rather than
 * being a one-way trip that is spent after a single pass.
 *
 * There are two kinds of motion here, and deciding which kind a thing gets is
 * the whole design. Both directions come out of that split.
 *
 *   TIMED, played and reversed on a trigger — every content reveal. The tween
 *   owns its own clock, so once it is let go it always reaches an end. Stop
 *   the wheel wherever you like and every card is fully in or fully out,
 *   never stranded partway. This matters: a previous version scrubbed these,
 *   which ties progress to scroll position, and a scrubbed tween has no
 *   notion of being finished — parking mid-range left cards at 94% scale and
 *   45px down indefinitely, out of line with everything beside them.
 *
 *   SCRUBBED, tied frame-for-frame to the wheel — the progress bar, the
 *   parallax layers, the hero's drift. These are values where part-way is a
 *   legitimate resting state: a layer parked at some offset is just a layer
 *   at an offset, and the bar is meant to read as "this far down". Nothing
 *   here can look stuck, because there is no destination to be stuck short of.
 *
 * It fails visible twice over. Nothing runs unless gsap and ScrollTrigger
 * both loaded, so a dead CDN leaves plain fully-rendered HTML. And because a
 * from() hides its target as it is built, every reveal is registered with a
 * backstop that finishes anything still hidden once the page has settled — a
 * trigger that never fires then costs some motion, never the content.
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

  /* Every reveal lands here so the backstop at the foot of the file can find
     anything that never got its trigger. */
  var pending = [];

  /* ---------- hero ---------- */

  /* The headline arrives a word at a time, each word rising out of its own
     clipped box. That needs two elements per word: an outer .word that does the
     clipping and an inner .word-i that moves. Splitting only text nodes leaves
     the <br> and the accented span where the copy put them, so the line breaks
     survive. */
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

  /* The one timeline that runs on load rather than on a trigger. */
  var tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

  tl.from('.hero-copy-col .eyebrow', { y: 16, opacity: 0, duration: 0.5 });

  if (headingWords.length) {
    tl.from(headingWords, {
      yPercent: 112, opacity: 0, duration: 0.85, stagger: 0.055, ease: 'power4.out'
    }, '-=0.25');
  }

  tl.from('.hero-sub', { y: 18, opacity: 0, duration: 0.55 }, '-=0.45')
    .from('.hero-cta-row .btn', { y: 20, opacity: 0, duration: 0.5, stagger: 0.09 }, '-=0.35')
    .from('.hero-point', { y: 14, opacity: 0, duration: 0.45, stagger: 0.07 }, '-=0.3')
    /* The visual settles out of a slight overscale rather than sliding in —
       it reads as the photograph coming to rest instead of arriving. */
    .from('.hero-visual-col', {
      scale: 1.06, opacity: 0, duration: 1.2, ease: 'power2.out'
    }, 0.15);

  /* If the ticker ever stalls, the most important thing on the page would stay
     blank — so jump the timeline to the end if it has not finished long after
     it should have. A no-op normally. */
  window.setTimeout(function () {
    if (tl.progress() < 1) tl.progress(1);
  }, 4000);

  if (!hasST) return;

  /* ---------- the reveal ---------- */

  /* Timed, and triggered both ways: play entering, reverse leaving backwards.
     Because the tween owns its clock it always completes, so the reversal is a
     real animation out rather than a jump — that is what makes going back up
     read as the same page running in rewind instead of content blinking off.

     start is 'top 88%': far enough down that the element is properly on screen
     when it goes, close enough to the edge that the reversal happens as it
     leaves rather than in the middle of the screen. */
  var reveal = function (targets, vars, trigger, opts) {
    if (!targets) return;
    if (targets.length === 0) return;
    opts = opts || {};

    pending.push(gsap.from(targets, Object.assign({
      duration: 0.8,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: trigger,
        start: opts.start || 'top 88%',
        toggleActions: 'play none none reverse'
      }
    }, vars)));
  };

  /* ---------- reading position ---------- */

  /* Scrubbed, and the plainest case for it: the bar IS how far down you are,
     so it tracks the wheel exactly and runs backwards without being asked. */
  var bar = document.getElementById('scrollProgress');
  if (bar) {
    gsap.to(bar, {
      scaleX: 1, ease: 'none',
      scrollTrigger: { start: 0, end: 'max', scrub: 0.3 }
    });
  }

  /* ---------- parallax ---------- */

  /* Layers moving at their own rate as the page travels past. Scrubbed, so
     they are pinned to the wheel in both directions, and the one family of
     motion where a tween sitting part-way is meaningless. Kept small — this
     is depth, not a ride. */
  var drift = function (sel, fromVars, toVars, trigger, scrub) {
    var el = document.querySelector(sel);
    if (!el) return;
    gsap.fromTo(el, fromVars, Object.assign({
      ease: 'none',
      scrollTrigger: {
        trigger: trigger || sel,
        start: 'top bottom',
        end: 'bottom top',
        scrub: scrub === undefined ? 0.8 : scrub
      }
    }, toVars));
  };

  drift('.hero-visual-col', { yPercent: 0 }, { yPercent: 8 }, '.hero-section');
  drift('.how-visual-col', { yPercent: 6 }, { yPercent: -6 }, '.how-section');

  /* The closing band's wave layers, each at its own rate. */
  [['.cta-shape-1', -5], ['.cta-shape-2', 3], ['.cta-shape-3', 7]].forEach(function (pair) {
    drift(pair[0], { xPercent: -pair[1] }, { xPercent: pair[1] }, '.cta-band', 1);
  });

  /* The hero copy eases away as you leave it, so the fold hands over rather
     than simply scrolling off. Scrubbed for the same reason — any point in it
     is a valid place to stop. */
  var heroCopy = document.querySelector('.hero-copy-col');
  if (heroCopy) {
    gsap.to(heroCopy, {
      y: -40, opacity: 0.25, ease: 'none',
      scrollTrigger: {
        trigger: '.hero-section',
        start: 'center center',
        end: 'bottom top',
        scrub: 0.6
      }
    });
  }

  /* ---------- section headings ---------- */

  q('.section-head').forEach(function (head) {
    reveal(head.children, { y: 30, opacity: 0, stagger: 0.09 }, head);
  });

  /* ---------- grids ---------- */

  /* Cards lean up out of the page as they arrive — rotateX against the
     perspective the stylesheet puts on each grid. Triggered on the container
     so a row comes in together rather than each card waiting for its own line
     to be crossed, and reversed as a group on the way back. */
  var grids = [
    { sel: '.reward-card',      vars: { y: 34, rotateX: -14, opacity: 0, scale: 0.96, stagger: 0.055 } },
    { sel: '.usecase-card',     vars: { y: 40, rotateX: -10, opacity: 0, stagger: 0.08 } },
    { sel: '.stat',             vars: { y: 30, rotateX: -12, opacity: 0, scale: 0.97, stagger: 0.07 } },
    { sel: '.testimonial-card', vars: { y: 38, rotateX: -8, opacity: 0, stagger: 0.09 } },
    { sel: '.faq-item',         vars: { y: 18, opacity: 0, stagger: 0.05, duration: 0.6 } }
  ];

  grids.forEach(function (g) {
    var items = q(g.sel);
    if (!items.length) return;
    reveal(items, g.vars, items[0].parentNode);
  });

  /* ---------- how it works ---------- */

  var howCopy = document.querySelector('.how-copy-col');
  if (howCopy) {
    reveal(
      [howCopy.querySelector('.eyebrow'), howCopy.querySelector('.how-title'), howCopy.querySelector('.how-sub')].filter(Boolean),
      { y: 28, opacity: 0, stagger: 0.09 },
      howCopy
    );
  }

  q('.step').forEach(function (step, i) {
    reveal(step, { x: -30, opacity: 0, delay: i * 0.08 }, step, { start: 'top 90%' });
    var num = step.querySelector('.step-num');
    if (num) {
      reveal(num, {
        scale: 0.3, rotate: -60, opacity: 0,
        duration: 0.6, delay: i * 0.08 + 0.12, ease: 'back.out(2)'
      }, step, { start: 'top 90%' });
    }
  });

  /* ---------- the figures, counting both ways ---------- */

  /* A timed count, played and reversed like every other reveal — so the
     figures run back down to zero if you scroll up past them and count again
     on the next pass. The text is seeded to zero at build so a figure never
     sits at its real value and then snaps back to zero when the trigger fires;
     the backstop below restores the real value if the trigger never comes. */
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
      duration: 1.25,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: el,
        start: 'top 88%',
        toggleActions: 'play none none reverse'
      },
      onUpdate: function () {
        // Write the original string back at the top so no rounding artefact
        // survives, and so "10K+" keeps its shape rather than "10.0K+".
        el.textContent = Math.abs(counter.n - target) < 0.005
          ? raw
          : counter.n.toFixed(decimals) + suffix;
      }
    }));
  });

  /* ---------- closing band ---------- */

  var ctaInner = document.querySelector('.cta-inner');
  if (ctaInner) {
    reveal(ctaInner.children, { y: 32, opacity: 0, stagger: 0.1 }, '.cta-band');
  }

  /* ---------- the answers, sliding ---------- */

  /* <details> snaps. Taking over the summary click lets the answer slide, and
     lets a closing panel finish its animation before the element actually
     closes. main.js keeps the plain version for when GSAP is not here, so it
     is told to stand down. */
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

        faqItems.forEach(function (other) {   // one answer at a time
          if (other !== item && other.open) slide(other, false);
        });

        slide(item, !wasOpen);
      });
    });
  }

  /* ---------- pointer play ---------- */

  /* Cards tilt very slightly towards the cursor. Capped at a few degrees —
     enough to feel alive, not enough to read as a gimmick. quickTo writes
     rotateY/rotateX/y continuously, so it is left to settle to zero on leave
     rather than fighting the reveal for the same properties. */
  var canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  if (canHover) {
    q('.reward-card, .stat, .usecase-card').forEach(function (card) {
      var rotY = gsap.quickTo(card, 'rotateY', { duration: 0.5, ease: 'power2.out' });
      var rotX = gsap.quickTo(card, 'rotateX', { duration: 0.5, ease: 'power2.out' });
      var lift = gsap.quickTo(card, 'y', { duration: 0.45, ease: 'power2.out' });

      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        rotY(((e.clientX - r.left) / r.width - 0.5) * 6);
        rotX(((e.clientY - r.top) / r.height - 0.5) * -6);
      });
      card.addEventListener('pointerenter', function () { lift(-6); });
      card.addEventListener('pointerleave', function () { rotY(0); rotX(0); lift(0); });
    });

    /* Primary buttons lean towards the pointer. */
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

    /* Then, once everything has had its chance: anything still holding its
       start state while sitting in or above the viewport never got its
       trigger and would otherwise stay invisible. Finish it. Normally this
       finds nothing. */
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
