/* Scroll and entrance animation.
 *
 * One rule decides everything below: an entrance plays once, on its own
 * clock, and finishes.
 *
 * That is a correction. The previous version scrubbed its reveals — it tied
 * each one's progress to the scroll position. A scrubbed tween has no notion
 * of being finished, so stopping the wheel halfway through a reveal left the
 * card exactly where it was: shrunk to 94%, pushed 45px down, out of line
 * with the cards beside it, and it stayed there. Readers stop constantly, so
 * the page sat permanently mid-animation and looked broken rather than alive.
 * Reverse-on-scroll-up, the version before that, had the opposite fault:
 * content vanished when you nudged the wheel backwards. Playing once and
 * staying put is the answer to both — nothing ever un-reveals, and nothing is
 * ever left half-revealed.
 *
 * Scrub survives in exactly two places, the reading bar and the parallax
 * layers, because there the scroll position genuinely is the value being
 * animated. They have no finished state to be stranded short of.
 *
 * It fails visible, two ways. Nothing runs unless gsap and ScrollTrigger both
 * loaded, so a dead CDN leaves plain fully-rendered HTML. And since a from()
 * hides its target the moment it is built, every reveal is registered with a
 * backstop that force-finishes anything still hidden once the page has
 * settled — so a trigger that never fires costs a little motion, never the
 * content itself.
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

  /* Every reveal tween lands here so the backstop at the end of the file can
     find anything that never got its trigger. */
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
    .from('.hero-visual-col', { xPercent: 4, opacity: 0, duration: 1, ease: 'power2.out' }, 0.1);

  /* The hero runs on load rather than on scroll, so its from() tweens hide
     their targets the moment they are built. If the ticker ever stalls, the
     most important thing on the page would stay blank — so jump it to the end
     if it has not finished long after it should have. A no-op normally. */
  window.setTimeout(function () {
    if (tl.progress() < 1) tl.progress(1);
  }, 4000);

  if (!hasST) return;

  /* ---------- the reveal ---------- */

  /* Triggered once, then the trigger kills itself. The tween runs on its own
     duration from there, so it always reaches the end no matter what the
     scroll does — stop, reverse, fling, it finishes and stays finished.

     start is 'top 88%': far enough down that the element is properly on
     screen when it goes, close enough to the edge that you are not watching
     an empty gap wait for it.

     clearProps drops the inline transform at the end so the pointer tilt
     further down starts from a clean base instead of composing with leftovers
     — which is what the old yPercent-versus-y juggling was working around. */
  var reveal = function (targets, vars, trigger, start) {
    if (!targets) return;
    if (targets.length === 0) return;

    pending.push(gsap.from(targets, Object.assign({
      duration: 0.7,
      ease: 'power3.out',
      clearProps: 'transform',
      scrollTrigger: {
        trigger: trigger,
        start: start || 'top 88%',
        once: true
      }
    }, vars)));
  };

  /* ---------- reading position ---------- */

  /* Genuinely scroll-linked: the bar IS how far down you are. */
  var bar = document.getElementById('scrollProgress');
  if (bar) {
    gsap.to(bar, {
      scaleX: 1, ease: 'none',
      scrollTrigger: { start: 0, end: 'max', scrub: 0.3 }
    });
  }

  /* ---------- parallax ---------- */

  /* Also genuinely scroll-linked, and the one place a tween being "unfinished"
     is meaningless — a layer parked at some offset is just a layer at an
     offset. Kept small; this is depth, not a ride. */
  var drift = function (sel, fromVars, toVars, trigger) {
    var el = document.querySelector(sel);
    if (!el) return;
    gsap.fromTo(el, fromVars, Object.assign({
      ease: 'none',
      scrollTrigger: {
        trigger: trigger || sel,
        start: 'top bottom',
        end: 'bottom top',
        scrub: 0.8
      }
    }, toVars));
  };

  drift('.hero-visual-col', { yPercent: 0 }, { yPercent: 7 }, '.hero-section');
  drift('.how-visual-col', { yPercent: 5 }, { yPercent: -5 }, '.how-section');

  [['.cta-shape-1', -5], ['.cta-shape-2', 3], ['.cta-shape-3', 6]].forEach(function (pair) {
    drift(pair[0], { xPercent: -pair[1] }, { xPercent: pair[1] }, '.cta-band');
  });

  /* ---------- section headings ---------- */

  q('.section-head').forEach(function (head) {
    reveal(head.children, { y: 24, opacity: 0, stagger: 0.08 }, head);
  });

  /* ---------- grids ---------- */

  /* Each grid goes as one group, triggered on its container, so a row comes in
     together instead of each card waiting for its own line to be crossed. */
  var grids = [
    { sel: '.reward-card',      vars: { y: 28, opacity: 0, scale: 0.96, stagger: 0.05, ease: 'back.out(1.4)' } },
    { sel: '.usecase-card',     vars: { y: 32, opacity: 0, stagger: 0.08 } },
    { sel: '.stat',             vars: { y: 26, opacity: 0, scale: 0.97, stagger: 0.07, ease: 'back.out(1.3)' } },
    { sel: '.testimonial-card', vars: { y: 30, opacity: 0, stagger: 0.09 } },
    { sel: '.faq-item',         vars: { y: 16, opacity: 0, stagger: 0.05, duration: 0.55 } }
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
      { y: 24, opacity: 0, stagger: 0.08 },
      howCopy
    );
  }

  q('.step').forEach(function (step, i) {
    reveal(step, { x: -24, opacity: 0, delay: i * 0.08 }, step, 'top 90%');
    var num = step.querySelector('.step-num');
    if (num) {
      reveal(num, {
        scale: 0.4, opacity: 0, duration: 0.5, delay: i * 0.08 + 0.1, ease: 'back.out(2)'
      }, step, 'top 90%');
    }
  });

  /* ---------- the figures ---------- */

  /* Counts up once when it arrives, on a fixed duration. The text is seeded to
     zero at build so the figure does not sit at its real value and then snap
     back to zero the moment the trigger fires. The backstop below restores the
     real value if the trigger never comes. */
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
      duration: 1.3,
      ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      onUpdate: function () {
        el.textContent = counter.n.toFixed(decimals) + suffix;
      },
      onComplete: function () { el.textContent = raw; }   // never a rounding artefact
    }));
  });

  /* ---------- closing band ---------- */

  var ctaInner = document.querySelector('.cta-inner');
  if (ctaInner) {
    reveal(ctaInner.children, { y: 26, opacity: 0, stagger: 0.09 }, '.cta-band');
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
     enough to feel alive, not enough to read as a gimmick. The reveal has
     cleared its transform by the time any of this can matter. */
  var canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  if (canHover) {
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
       trigger, and would otherwise stay invisible. Finish it. Normally this
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
