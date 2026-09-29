/* Scroll and entrance animation.
 *
 * The motion here is scroll-linked rather than triggered. A trigger that plays
 * on the way down and rewinds on the way up makes content vanish the moment
 * you nudge the wheel backwards, which reads as flicker. Everything below is
 * scrubbed instead: the tween's position is the scroll position, so it tracks
 * the wheel continuously in both directions and never jumps.
 *
 * It is additive and fails visible, but through the guard at the top rather
 * than through immediateRender. Nothing below runs unless both gsap and
 * ScrollTrigger are actually present, so if either script fails to load no
 * element is ever hidden and the page renders as plain HTML.
 *
 * Holding the start state back with immediateRender:false — the obvious way
 * to fail visible — is wrong specifically for scrubbed tweens. The start
 * state then lands on the tween's first render, and scrub defers that by its
 * own catch-up time, so the element blinks from its natural state to its
 * hidden one a few hundred pixels after it is already on screen. Applying it
 * up front is what makes the reveal continuous.
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

  /* ---------- smooth scrolling ---------- */

  /* A wheel notch is a jump, not a glide, and scrubbed animation driven
     straight off it looks stepped. Lenis interpolates the scroll position and
     GSAP's ticker drives it, so one clock runs both. Optional: without it
     everything below still works, just on raw wheel steps. */
  var lenis = null;

  if (typeof window.Lenis !== 'undefined' && hasST) {
    lenis = new Lenis({
      duration: 1.05,
      easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
      smoothWheel: true,
      touchMultiplier: 1.6
    });

    // Published so main.js can send the back-to-top button through Lenis
    // instead of a native scrollTo, which would fight it for the position.
    window.__lenis = lenis;

    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);

    /* Lenis owns the scroll position, so anchors cannot be left to the
       browser. No offset here on purpose: Lenis reads the same
       [id]{scroll-margin-top} the stylesheet uses for the no-Lenis path, so
       both routes land in the same place. Passing the header height again
       would subtract it twice. */
    q('a[href^="#"]').forEach(function (link) {
      var href = link.getAttribute('href');
      if (href === '#') return;
      var target = document.querySelector(href);
      if (!target) return;
      link.addEventListener('click', function (event) {
        event.preventDefault();
        lenis.scrollTo(target);
      });
    });
  }

  /* ---------- the reveal ---------- */

  /* Scrubbed over a range that ends well above the middle of the screen, so a
     reveal is finished long before you are actually reading it. Scrolling back
     up unwinds it at exactly the rate you scroll.

     The range starts at 'top bottom', so the element is already at its hidden
     state before it can be seen and every pixel of the reveal happens on
     screen. Only how far up it finishes is worth varying, so opts carries
     end, not start.

     Note the absent immediateRender:false — see the header. from() applies
     the start state as it is built, which is exactly what a scrubbed reveal
     needs. */
  var reveal = function (targets, vars, trigger, opts) {
    if (!hasST || !targets) return;
    if (targets.length === 0) return;
    opts = opts || {};

    gsap.from(targets, Object.assign({
      ease: 'power2.out',
      scrollTrigger: {
        trigger: trigger,
        start: 'top bottom',
        end: opts.end || 'top 62%',
        scrub: opts.scrub === undefined ? 0.8 : opts.scrub
      }
    }, vars));
  };

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

  /* The hero is an entrance, not a scroll effect, so it stays a timeline. */
  var tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

  tl.from('.hero-copy-col .eyebrow', { y: 16, opacity: 0, duration: 0.5 });

  if (headingWords.length) {
    tl.from(headingWords, {
      yPercent: 115, opacity: 0, duration: 0.9, stagger: 0.06, ease: 'power4.out'
    }, '-=0.25');
  }

  tl.from('.hero-sub', { y: 18, opacity: 0, duration: 0.6 }, '-=0.5')
    .from('.hero-cta-row .btn', { y: 20, opacity: 0, duration: 0.55, stagger: 0.09 }, '-=0.4')
    .from('.hero-point', { y: 14, opacity: 0, duration: 0.45, stagger: 0.07 }, '-=0.35')
    .from('.hero-visual-col', { xPercent: 5, opacity: 0, duration: 1.2, ease: 'power2.out' }, 0.1);

  /* The hero is the one timeline that starts on load rather than on scroll, so
     its from() tweens hide their targets the moment they are built. If the
     ticker ever stalls, the most important thing on the page would stay blank —
     so jump it to the end if it has not finished long after it should have.
     A no-op in the normal case. */
  window.setTimeout(function () {
    if (tl.progress() < 1) tl.progress(1);
  }, 4000);

  if (!hasST) return;

  /* ---------- reading position ---------- */

  var bar = document.getElementById('scrollProgress');
  if (bar) {
    gsap.to(bar, {
      scaleX: 1, ease: 'none',
      scrollTrigger: { start: 0, end: 'max', scrub: 0.25 }
    });
  }

  /* ---------- parallax ---------- */

  /* Layers that move at their own rate as the page goes past. All scrubbed,
     so they are pinned to the wheel rather than playing on their own clock. */
  var drift = function (sel, from, to, trigger, scrub) {
    var el = document.querySelector(sel);
    if (!el) return;
    gsap.fromTo(el, from, Object.assign({
      ease: 'none',
      scrollTrigger: {
        trigger: trigger || sel,
        start: 'top bottom',
        end: 'bottom top',
        scrub: scrub === undefined ? 0.9 : scrub
      }
    }, to));
  };

  drift('.hero-visual-col', { yPercent: 0 }, { yPercent: 10 }, '.hero-section', 0.7);
  drift('.how-visual-col', { yPercent: 7 }, { yPercent: -7 }, '.how-section', 0.9);

  /* The closing band's wave layers, each at a different rate. */
  [['.cta-shape-1', -6], ['.cta-shape-2', 4], ['.cta-shape-3', 8]].forEach(function (pair) {
    drift(pair[0], { xPercent: -pair[1] }, { xPercent: pair[1] }, '.cta-band', 1);
  });

  /* ---------- section headings ---------- */

  q('.section-head').forEach(function (head) {
    reveal(head.children, { y: 34, opacity: 0, stagger: 0.12 }, head, { end: 'top 64%' });
  });

  /* ---------- grids ---------- */

  /* Cards reveal on yPercent, never y. The pointer lift below writes y, and
     GSAP sums the two rather than letting them overwrite each other — the old
     version used y for both, so hovering a card mid-scroll made it jump. */
  var grids = [
    { sel: '.reward-card',      vars: { yPercent: 32, opacity: 0, scale: 0.94, stagger: 0.06 } },
    { sel: '.usecase-card',     vars: { yPercent: 26, opacity: 0, stagger: 0.09 } },
    { sel: '.stat',             vars: { yPercent: 30, opacity: 0, scale: 0.96, stagger: 0.08 } },
    { sel: '.testimonial-card', vars: { yPercent: 24, opacity: 0, stagger: 0.1 } },
    { sel: '.faq-item',         vars: { y: 22, opacity: 0, stagger: 0.06 } }
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
      { y: 30, opacity: 0, stagger: 0.1 },
      howCopy, { end: 'top 60%' }
    );
  }

  q('.step').forEach(function (step) {
    reveal(step, { x: -34, opacity: 0 }, step, { end: 'top 70%' });
    var num = step.querySelector('.step-num');
    if (num) {
      reveal(num, { scale: 0.2, rotate: -90, opacity: 0 }, step, { end: 'top 72%' });
    }
  });

  /* ---------- the figures, counting with the wheel ---------- */

  q('.stat-value').forEach(function (el) {
    var raw = el.textContent.trim();
    var match = raw.match(/^([\d.]+)(.*)$/);
    if (!match) return;

    var target = parseFloat(match[1]);
    var suffix = match[2];
    var decimals = (match[1].split('.')[1] || '').length;
    var counter = { n: target };

    gsap.fromTo(counter, { n: 0 }, {
      n: target,
      ease: 'none',
      // Rendered up front like the reveals, so the figure reads zero from the
      // start rather than dropping to it once the counter is already in view.
      scrollTrigger: { trigger: el, start: 'top bottom', end: 'top 68%', scrub: 0.6 },
      onUpdate: function () {
        // Write the original string back at the top so no rounding artefact
        // can survive, and so "10K+" keeps its shape rather than "10.0K+".
        el.textContent = Math.abs(counter.n - target) < 0.005
          ? raw
          : counter.n.toFixed(decimals) + suffix;
      }
    });
  });

  /* ---------- closing band ---------- */

  var ctaInner = document.querySelector('.cta-inner');
  if (ctaInner) {
    reveal(ctaInner.children, { y: 36, opacity: 0, stagger: 0.12 }, '.cta-band',
           { end: 'top 58%' });
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
            duration: 0.42, ease: 'power2.out', onComplete: settle });
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

  var canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  if (canHover) {
    /* Cards lean towards the cursor. The lift uses y while the scroll reveal
       above uses yPercent, so the two compose instead of overwriting. */
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
        x((e.clientX - r.left - r.width / 2) * 0.22);
        y((e.clientY - r.top - r.height / 2) * 0.3);
      });
      btn.addEventListener('pointerleave', function () { x(0); y(0); });
    });
  }

  /* Layout shifts once the webfont swaps and the photographs decode. */
  window.addEventListener('load', function () { ScrollTrigger.refresh(); });
})();
