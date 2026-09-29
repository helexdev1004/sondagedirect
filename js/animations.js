/* Scroll and entrance animation.
 *
 * Everything is additive and fails visible. gsap.from() paired with
 * ScrollTrigger normally applies its start state as soon as the tween is
 * built and only clears it when the trigger fires, so anything that stops the
 * trigger firing leaves the content blank. Every reveal below goes through
 * reveal(), which holds that start state back until the animation actually
 * begins — if GSAP never loads or a trigger never fires, the page just sits
 * there fully rendered.
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

  /* Plays coming down, rewinds going back up, and plays again on the next
     pass — so the page keeps its life however you move through it. */
  var reveal = function (targets, vars, trigger, start) {
    if (!targets || targets.length === 0) return;
    if (!hasST) return;
    vars.immediateRender = false;
    vars.scrollTrigger = {
      trigger: trigger,
      start: start || 'top 86%',
      toggleActions: 'play none none reverse'
    };
    gsap.from(targets, vars);
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

    /* The accented span is already one word — give it the same two layers by
       moving its contents into an inner element. */
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
      yPercent: 110, opacity: 0, duration: 0.8, stagger: 0.055, ease: 'power4.out'
    }, '-=0.25');
  }

  tl.from('.hero-sub', { y: 18, opacity: 0, duration: 0.6 }, '-=0.45')
    .from('.hero-cta-row .btn', { y: 18, opacity: 0, duration: 0.5, stagger: 0.1 }, '-=0.35')
    .from('.hero-point', { y: 14, opacity: 0, duration: 0.45, stagger: 0.08 }, '-=0.3')
    .from('.hero-visual-col', { xPercent: 6, opacity: 0, duration: 1.1, ease: 'power2.out' }, 0.1);

  /* The hero is the one timeline that starts on load rather than on scroll, so
     its from() tweens hide their targets the moment they are built. That is
     fine while the ticker is running, but the hero is the worst thing on the
     page to leave blank — so if it has not finished long after it should have,
     jump it to the end. A no-op in the normal case. */
  window.setTimeout(function () {
    if (tl.progress() < 1) tl.progress(1);
  }, 4000);

  if (!hasST) return;

  /* ---------- reading position ---------- */

  var bar = document.getElementById('scrollProgress');
  if (bar) {
    gsap.to(bar, {
      scaleX: 1, ease: 'none',
      scrollTrigger: { start: 0, end: 'max', scrub: 0.3 }
    });
  }

  /* ---------- scroll-linked drift ---------- */

  gsap.utils.toArray('.hero-visual-col').forEach(function (el) {
    gsap.to(el, {
      yPercent: 9, ease: 'none',
      scrollTrigger: { trigger: '.hero-section', start: 'top top', end: 'bottom top', scrub: 0.7 }
    });
  });

  var howVisual = document.querySelector('.how-visual-col');
  if (howVisual) {
    gsap.fromTo(howVisual, { y: 42 }, {
      y: -42, ease: 'none',
      scrollTrigger: { trigger: '.how-section', start: 'top bottom', end: 'bottom top', scrub: 0.8 }
    });
  }

  /* The closing band's wave layers slide at different rates. */
  [['.cta-shape-1', -70], ['.cta-shape-2', 45], ['.cta-shape-3', 90]].forEach(function (pair) {
    var el = document.querySelector(pair[0]);
    if (!el) return;
    gsap.fromTo(el, { xPercent: -pair[1] / 12 }, {
      xPercent: pair[1] / 12, ease: 'none',
      scrollTrigger: { trigger: '.cta-band', start: 'top bottom', end: 'bottom top', scrub: 1 }
    });
  });

  /* ---------- section headings ---------- */

  q('.section-head').forEach(function (head) {
    reveal(head.children, { y: 26, opacity: 0, duration: 0.65, stagger: 0.09, ease: 'power3.out' },
           head, 'top 84%');
  });

  /* ---------- grids ---------- */

  var grids = [
    { sel: '.reward-card',      vars: { y: 26, opacity: 0, scale: 0.9, ease: 'back.out(1.7)' }, stagger: 0.05 },
    { sel: '.usecase-card',     vars: { y: 40, opacity: 0, ease: 'power3.out' },                stagger: 0.1 },
    { sel: '.stat',             vars: { y: 34, opacity: 0, scale: 0.95, ease: 'back.out(1.4)' },stagger: 0.09 },
    { sel: '.testimonial-card', vars: { y: 40, opacity: 0, ease: 'power3.out' },                stagger: 0.12 },
    { sel: '.faq-item',         vars: { y: 18, opacity: 0, ease: 'power2.out' },                stagger: 0.07 }
  ];

  grids.forEach(function (g) {
    var items = q(g.sel);
    if (!items.length) return;
    reveal(items, Object.assign({ duration: 0.7, stagger: g.stagger }, g.vars), items[0].parentNode);
  });

  /* ---------- how it works ---------- */

  var howCopy = document.querySelector('.how-copy-col');
  if (howCopy) {
    reveal(
      [howCopy.querySelector('.eyebrow'), howCopy.querySelector('.how-title'), howCopy.querySelector('.how-sub')].filter(Boolean),
      { y: 26, opacity: 0, duration: 0.6, stagger: 0.09, ease: 'power3.out' },
      howCopy, 'top 82%'
    );
  }

  q('.step').forEach(function (step, i) {
    reveal(step, { x: -26, opacity: 0, duration: 0.6, ease: 'power3.out', delay: i * 0.1 }, step, 'top 90%');
    var num = step.querySelector('.step-num');
    if (num) {
      reveal(num, { scale: 0, rotate: -120, duration: 0.6, ease: 'back.out(2)', delay: i * 0.1 }, step, 'top 90%');
    }
  });

  /* ---------- the figures, counting both ways ---------- */

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
      duration: 1.1,
      ease: 'power1.out',
      immediateRender: false,
      scrollTrigger: { trigger: el, start: 'top 90%', toggleActions: 'play none none reverse' },
      onUpdate: function () { el.textContent = counter.n.toFixed(decimals) + suffix; },
      onComplete: function () { el.textContent = raw; }   // never leave a rounding artefact
    });
  });

  /* ---------- closing band ---------- */

  var ctaInner = document.querySelector('.cta-inner');
  if (ctaInner) {
    reveal(ctaInner.children, { y: 30, opacity: 0, duration: 0.7, stagger: 0.1, ease: 'power3.out' },
           '.cta-band', 'top 88%');
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

  /* Cards tilt very slightly towards the cursor. Capped at a couple of
     degrees — enough to feel alive, not enough to read as a gimmick. */
  var canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  if (canHover) {
    q('.reward-card, .stat, .usecase-card').forEach(function (card) {
      var move = gsap.quickTo(card, 'rotateY', { duration: 0.5, ease: 'power2.out' });
      var moveX = gsap.quickTo(card, 'rotateX', { duration: 0.5, ease: 'power2.out' });
      var lift = gsap.quickTo(card, 'y', { duration: 0.4, ease: 'power2.out' });

      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        move(((e.clientX - r.left) / r.width - 0.5) * 5);
        moveX(((e.clientY - r.top) / r.height - 0.5) * -5);
      });
      card.addEventListener('pointerenter', function () { lift(-5); });
      card.addEventListener('pointerleave', function () { move(0); moveX(0); lift(0); });
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
