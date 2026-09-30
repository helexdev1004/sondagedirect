/* Scroll and entrance animation.
 *
 * The VivaPoll engine, ported so the two sites move the same way. Same
 * vocabulary, same mechanics, adapted to this page's markup and sections.
 *
 * Reveals are declared in the HTML rather than listed here: data-anim="mask"
 * on an element, data-anim-group on a parent to animate its children instead,
 * plus data-anim-delay and data-anim-stagger for sequencing. Adding a section
 * to the page needs nothing in this file.
 *
 * They are TIMED tweens, built paused and driven by hand from the four
 * ScrollTrigger crossings: play going in, reverse going out, play again coming
 * back. That is what bidirectional means here — a reveal runs on its own clock
 * so it always lands, and un-runs when the element leaves. It is deliberately
 * NOT scrubbed: scrubbing ties progress to the scrollbar, which smears a
 * reveal out and leaves elements part-finished wherever you stop, which is
 * what every earlier attempt on this page got wrong.
 *
 * The start state lives in CSS behind html.sd-anim, added by a small script in
 * the head and removed the instant this file takes over — and dropped by a
 * 2.5s failsafe if it never does, so the page renders normally either way.
 */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!window.gsap || !window.ScrollTrigger || reduced) {
    root.classList.remove('sd-anim');
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  var narrow = window.matchMedia('(max-width: 767.98px)');
  var desktop = window.matchMedia('(min-width: 992px)');
  // Only the reveals, headings and counters are tracked here. The parallax and the
  // progress rail are built once and left alone, since a language change does not
  // affect them.
  var triggers = [];
  var tweens = [];

  /* ---------------------------------------------------------------- helpers */

  var DIST = 46;
  var FROM = {
    up:    { y: DIST },
    down:  { y: -DIST },
    left:  { x: -DIST },
    right: { x: DIST },
    zoom:  { scale: 0.9 },
    fade:  {},
    // Hinged along its own top edge, so the card swings up out of the page.
    tilt:  { y: 38, rotateX: -32, transformOrigin: '50% 0%' },

    // Wiped in from its own bottom edge. The element is not moving into place behind a
    // hole in the page - it is being uncovered, which is why the inner shift is small.
    mask:  { yPercent: 6, clipPath: 'inset(100% 0% 0% 0%)' },
    // Arrives out of focus and slightly too large, the way a camera settles onto it.
    focus: { scale: 1.07, y: 26, filter: 'blur(16px)' },
    // Turned on its own vertical axis, seen at an angle. Rotated about its centre and
    // with no sideways offset on purpose: hinging on the left edge swings the right edge
    // toward the viewer, and perspective then projects it wider than its own column -
    // which puts the last card in a row over the edge of the page.
    flip:  { rotateY: -34, y: 24, transformOrigin: '50% 50%' },
    // Dropped and rocked upright on its base.
    swing: { rotate: -5, y: 54, scale: 0.94, transformOrigin: '50% 100%' }
  };

  // What each animated property has to be put back to. `to` is built from whatever the
  // preset actually touched, so a new preset needs no changes anywhere else.
  var NEUTRAL = {
    x: 0, y: 0, yPercent: 0, xPercent: 0,
    scale: 1, rotate: 0, rotateX: 0, rotateY: 0,
    clipPath: 'inset(0% 0% 0% 0%)',
    filter: 'blur(0px)'
  };

  function startVars(name) {
    var preset = FROM[name] || FROM.up;
    var vars = { autoAlpha: 0 };
    for (var k in preset) vars[k] = preset[k];
    return vars;
  }

  function endVars(name) {
    var preset = FROM[name] || FROM.up;
    var vars = { autoAlpha: 1 };
    for (var k in preset) {
      if (k === 'transformOrigin') continue;      // carried over, not reset
      if (k in NEUTRAL) vars[k] = NEUTRAL[k];
    }
    return vars;
  }

  // Narrow screens get the plain rise instead of anything sideways or three-dimensional:
  // a horizontal offset pushes a full-width column off the edge, and perspective effects
  // are wasted on a phone. Blur is dropped too - it is the most expensive of these to
  // paint, and least worth it at that size.
  function forWidth(name) {
    if (!narrow.matches) return name;
    if (name === 'left' || name === 'right' || name === 'tilt' ||
        name === 'flip' || name === 'focus') return 'up';
    return name;
  }

  // Built paused and driven from the four callbacks by hand. `toggleActions` on a
  // `.from()` tween would not resume once reversed, stranding elements invisible.
  // Anything sitting in the viewport when the page loads has a start position above the
  // top of the document, so ScrollTrigger never sees an "enter" transition for it and
  // the tween would sit at its start state forever. After building, every trigger that
  // is already active is played by hand.
  /* ScrollTrigger measures by scrolling the document to the top, reading every
     trigger's position, and scrolling back. The stylesheet sets
     html{scroll-behavior:smooth} so anchor links glide — which makes both of
     those jumps ANIMATE. Refresh then measures while the page is still on its
     way, and every position comes out short by roughly the current scroll.
     Measured on this page: the closing band's trigger, correctly at 4671,
     came back as 284. Everything below the fold was then treated as long
     since passed, reversed to hidden, and never announced again — which is
     how opening an answer emptied the closing band.

     Every refresh goes through here instead. Inline style beats the rule in
     the stylesheet, so the measuring jumps are instant, and smooth anchor
     scrolling is handed straight back afterwards. */
  function safeRefresh() {
    var prev = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    ScrollTrigger.refresh();
    root.style.scrollBehavior = prev;
  }

  // Re-asserts anything that should be showing. A refresh winds every tween
  // back to its start, so this has to put them back — and it cannot trust
  // isActive to do it: immediately after ScrollTrigger.refresh() every trigger
  // reports inactive until something scrolls, so a refresh with the page
  // sitting still (opening an answer, a resize) found nothing to re-assert and
  // emptied whatever was on screen. Falling back to "is the element actually
  // in the viewport" is what makes it safe.
  function playActive() {
    triggers.forEach(function (trigger, i) {
      if (!tweens[i]) return;
      if (trigger.isActive) { tweens[i].play(); return; }
      var el = trigger.trigger;
      if (!el) return;
      var box = el.getBoundingClientRect();
      if (box.bottom > 0 && box.top < window.innerHeight) tweens[i].play();
    });
  }

  function scrollPlay(tween, trigger, start, end) {
    // Anything already on screen when the page opens is choreography, not scrolling:
    // play it once and keep it out of ScrollTrigger entirely. Otherwise its start point
    // sits above the top of the document, where every refresh - webfonts arriving, a
    // resize - winds it back and the hero empties itself.
    var box = trigger.getBoundingClientRect();
    if (window.scrollY < 4 && box.top < window.innerHeight * 0.92) {
      tween.play();
      return;
    }

    // `data-anim-once` reveals the element a single time and then leaves it alone. The
    // legal pages use it throughout: a paragraph that faded itself out again as the
    // reader scrolled past would be fighting them, not helping.
    var once = !!(trigger.hasAttribute && trigger.hasAttribute('data-anim-once'));
    var play = function () { tween.play(); };

    tweens.push(tween);

    if (once) {
      // All four crossings reveal it, and none of them rewind. Replaying a tween that
      // has already finished costs nothing, and covering every crossing is what makes
      // this safe: a short paragraph can be cleared entirely between two frames when
      // somebody scrolls quickly or follows a link into the middle of the document, and
      // ScrollTrigger then reports only the leave. Waiting for `onEnter` alone left
      // those sections blank until something else happened to nudge them.
      triggers.push(ScrollTrigger.create({
        trigger: trigger,
        // Started as the element clears the bottom edge rather than at 88%, so it is
        // already most of the way in by the time the reader's eye reaches it. On a long
        // document that difference is what stops a quick scroll finding empty blocks.
        start: start || 'top 99%',
        end: end || 'bottom top',
        onEnter: play,
        onEnterBack: play,
        onLeave: play,
        onLeaveBack: play
      }));
      // Already scrolled past before this was even built - a reload partway down the
      // page, or a deep link.
      if (trigger.getBoundingClientRect().top < window.innerHeight * 0.99) tween.play();
      return;
    }

    triggers.push(ScrollTrigger.create({
      trigger: trigger,
      start: start || 'top 88%',
      // `bottom top` and not a percentage: short elements would otherwise rewind while
      // still on screen.
      end: end || 'bottom top',
      onEnter: play,
      onEnterBack: play,
      onLeave: function () { tween.reverse(); },
      onLeaveBack: function () { tween.reverse(); }
    }));
  }

  /* ------------------------------------------------------ falling letters */

  // Each letter is wrapped in its own span, and each word in a box that hides whatever
  // overflows it. The letters start above their word and drop in one after another, so
  // they arrive through the top edge of the line rather than simply fading on.
  //
  // The wrapping walks the existing nodes rather than rebuilding from plain text, so the
  // structure the markup relies on - the line break, the blue run - survives intact.
  function wrapLetters(node, out) {
    Array.prototype.slice.call(node.childNodes).forEach(function (child) {
      if (child.nodeType === 1) { wrapLetters(child, out); return; }
      if (child.nodeType !== 3) return;

      child.nodeValue.split(/(\s+)/).forEach(function (piece) {
        if (!piece) return;
        if (/^\s+$/.test(piece)) {
          node.insertBefore(document.createTextNode(' '), child);
          return;
        }
        var word = document.createElement('span');
        word.className = 'word';
        for (var i = 0; i < piece.length; i++) {
          var ch = document.createElement('span');
          ch.className = 'char';
          ch.textContent = piece.charAt(i);
          word.appendChild(ch);
          out.push(ch);
        }
        node.insertBefore(word, child);
      });
      node.removeChild(child);
    });
  }

  function initChars() {
    document.querySelectorAll('[data-anim="chars"]').forEach(function (el) {
      // This runs again on a language change. By then i18n has rewritten the heading, so
      // the spans are already gone and the fresh translation is what gets split. If they
      // are somehow still there, fall back to the markup stashed the first time round
      // rather than splitting a split.
      if (el.querySelector('.word')) {
        el.innerHTML = el.getAttribute('data-split-src') || el.textContent;
      } else {
        el.setAttribute('data-split-src', el.innerHTML);
      }

      // A heading cut into single letters is read out letter by letter, so the whole
      // line goes on the element as a label and the pieces are hidden from the tree.
      el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());

      var chars = [];
      wrapLetters(el, chars);
      if (!chars.length) return;
      Array.prototype.forEach.call(el.querySelectorAll('.word'), function (w) {
        w.setAttribute('aria-hidden', 'true');
      });

      // The heading itself carries no motion - only the letters inside it do - so it has
      // to be taken out of the hidden start state by hand.
      gsap.set(el, { autoAlpha: 1 });

      var tween = gsap.fromTo(chars,
        { yPercent: -128, rotate: -7, opacity: 0 },
        {
          yPercent: 0,
          rotate: 0,
          opacity: 1,
          duration: 0.78,
          // Overshoots a touch and settles, so each letter lands rather than slides.
          ease: 'back.out(1.5)',
          delay: parseFloat(el.getAttribute('data-anim-delay')) || 0.06,
          stagger: 0.028,
          paused: true
        });

      scrollPlay(tween, el);
    });
  }

  /* ------------------------------------------------------- counting figures */

  // "100K+" -> 100 with a "K+" tail, "4,8/5" -> 4.8 with a "/5" tail and a comma kept as
  // the decimal mark. Anything with no number in it is left alone.
  function parseFigure(text) {
    var m = text.match(/^(\D*?)(\d+(?:[.,]\d+)?)(.*)$/);
    if (!m) return null;
    var raw = m[2];
    var sep = raw.indexOf(',') > -1 ? ',' : '.';
    var decimals = raw.split(/[.,]/)[1] ? raw.split(/[.,]/)[1].length : 0;
    return { head: m[1], tail: m[3], value: parseFloat(raw.replace(',', '.')), sep: sep, decimals: decimals };
  }

  function renderFigure(figure, n) {
    return figure.head + n.toFixed(figure.decimals).replace('.', figure.sep) + figure.tail;
  }

  function initCounters() {
    document.querySelectorAll('[data-count]').forEach(function (el) {
      // The figure to count TO is remembered on the element. Without this a rebuild
      // would read back the zero this function itself wrote and animate 0 to 0 - which
      // is exactly what happens on load, because the language engine announces its
      // first pass after this file has already run once.
      var source = el.getAttribute('data-count-value');
      if (!source) {
        source = el.textContent.trim();
        el.setAttribute('data-count-value', source);
      }
      var figure = parseFigure(source);
      if (!figure) return;

      // The figure stays in the markup until the tween actually runs - its first frame
      // writes the zero. That keeps the real value in the DOM for anything else reading
      // it, and means a page with the animations disabled just shows the number.
      var state = { n: 0 };
      var tween = gsap.to(state, {
        n: figure.value,
        // Long enough to be read as it climbs rather than glimpsed. `power1.out` keeps
        // most of that time in the middle of the run; a sharper ease spends it all
        // crawling the last few units, which just reads as a number that has stopped.
        duration: parseFloat(el.getAttribute('data-count-duration')) || 2.2,
        ease: 'power1.out',
        // Held back so each figure starts as its own card arrives, instead of all of
        // them running while three of the cards are still on their way in.
        delay: parseFloat(el.getAttribute('data-anim-delay')) || 0,
        paused: true,
        onUpdate: function () { el.textContent = renderFigure(figure, state.n); }
      });

      scrollPlay(tween, el.closest('.stat') || el);
    });
  }

  /* -------------------------------------------------------- generic reveals */

  // How long each one wants to take, and how it should feel arriving. The dimensional
  // ones are given longer and allowed to overshoot; a wipe is given none, because a mask
  // that springs past its own edge tears.
  var SHAPE = {
    tilt:  { duration: 0.85, ease: 'power3.out' },
    flip:  { duration: 0.95, ease: 'power3.out' },
    swing: { duration: 0.9,  ease: 'back.out(1.4)' },
    focus: { duration: 0.85, ease: 'power2.out' },
    // Front-loaded on purpose. An in-out ease looks better in isolation but holds the
    // element near-blank for its first third, and on a long document that is exactly
    // when a fast scroll arrives at it - the reader meets an empty block. Easing out
    // puts most of the reveal in the first few frames.
    mask:  { duration: 0.68, ease: 'power2.out' },
    zoom:  { duration: 0.75, ease: 'back.out(1.2)' }
  };

  function initReveals() {
    document.querySelectorAll('[data-anim]').forEach(function (el) {
      var name = el.getAttribute('data-anim') || 'up';
      if (name === 'chars') return;   // initChars handles these, letter by letter
      name = forWidth(name);

      var delay = parseFloat(el.getAttribute('data-anim-delay')) || 0;
      // A child that animates itself is left out of its parent's group. Two tweens on one
      // element each reset only the properties their own preset touched, so the second to
      // run leaves the first's behind - a heading inside a `mask` group that also asked
      // for `up` came out fully clipped and stayed that way, invisible but at full
      // opacity. Whichever reveal the child asked for by name wins.
      var targets = el.hasAttribute('data-anim-group')
        ? Array.prototype.slice.call(el.children).filter(function (c) {
            return !c.hasAttribute('data-anim');
          })
        : [el];
      if (!targets.length) return;

      var shape = SHAPE[name] || { duration: 0.7, ease: 'power2.out' };
      var to = endVars(name);
      // `data-anim-duration` overrides the preset for one element, so a single section can
      // be given longer without slowing every other use of the same preset.
      to.duration = parseFloat(el.getAttribute('data-anim-duration')) || shape.duration;
      to.ease = shape.ease;
      to.delay = delay;
      to.paused = true;
      // A row of cards arrives one after another rather than all at once. `data-anim-stagger`
      // overrides the gap where a particular group wants to be tighter or looser.
      to.stagger = targets.length > 1
        ? (parseFloat(el.getAttribute('data-anim-stagger')) || 0.1)
        : 0;

      gsap.killTweensOf(targets);   // this function runs again on a language change
      var tween = gsap.fromTo(targets, startVars(name), to);

      scrollPlay(tween, el);
    });
  }

  /* ------------------------------------------------------------- depth layers */

  // `data-parallax="-70"` ties an element's drift to the scrollbar itself rather than to
  // a trigger that fires once, so it keeps moving the whole time it is on screen. That
  // continuous link to the scroll is what separates this from a reveal.
  //
  // Never put this on the same element as `data-anim` - both write `y`, and the last one
  // to run wins. Put the reveal on a wrapper and the drift on what is inside it.
  function initDepth() {
    if (narrow.matches) return;
    document.querySelectorAll('[data-parallax]').forEach(function (el) {
      var dist = parseFloat(el.getAttribute('data-parallax'));
      if (!dist) return;
      gsap.to(el, {
        y: dist,
        ease: 'none',
        scrollTrigger: {
          trigger: el.closest('section') || el,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 0.8
        }
      });
    });
  }

  /* ------------------------------------------------------------ magnetic keys */

  // The main call to action leans toward the pointer as it comes near, and springs back
  // when it leaves. Mouse only - there is no hover on a touch screen to lean into.
  function initMagnets() {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    document.querySelectorAll('.btn-brand, .btn-white-cta').forEach(function (el) {
      var pull = 0.28;
      el.addEventListener('mousemove', function (e) {
        var b = el.getBoundingClientRect();
        gsap.to(el, {
          x: (e.clientX - (b.left + b.width / 2)) * pull,
          y: (e.clientY - (b.top + b.height / 2)) * pull,
          duration: 0.4,
          ease: 'power3.out',
          overwrite: 'auto'
        });
      });
      el.addEventListener('mouseleave', function () {
        gsap.to(el, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1, 0.4)', overwrite: 'auto' });
      });
    });
  }

  /* -------------------------------------------------------------- parallax */

  function initParallax() {
    if (!desktop.matches) return;

    // The photograph drifts inside its frame, never the frame itself: the
    // frame carries the mask that dissolves it into the page, and moving that
    // dragged the bottom fade below the section and left a hard sliced edge.
    // 'top top' because the hero is already on screen when the page loads.
    var heroImg = document.querySelector('.hero-visual-img');
    if (heroImg) {
      gsap.fromTo(heroImg, { yPercent: 0 }, {
        yPercent: 5, ease: 'none',
        scrollTrigger: { trigger: '.hero-section', start: 'top top', end: 'bottom top', scrub: 0.8 }
      });
    }

    var howVisual = document.querySelector('.how-visual-col');
    if (howVisual) {
      gsap.fromTo(howVisual, { yPercent: 5 }, {
        yPercent: -5, ease: 'none',
        scrollTrigger: { trigger: '.how-section', start: 'top bottom', end: 'bottom top', scrub: 0.8 }
      });
    }

  }

  /* ------------------------------------------------------------ closing band */

  /* The waves behind the closing band. Four things move them, each on its own
     property so none can overwrite another — GSAP keeps px and percent offsets
     apart, which is what lets two of them share an axis:

       xPercent   the -50% that centres each wave, plus the scroll drift
       x, y       a long swell of its own, running whether or not you scroll
       scaleY     that same swell breathing the wave taller and shorter
       yPercent   the pointer, pushing each layer by a different amount

     The centring has to live here rather than in the stylesheet: a CSS
     transform would be thrown away by the first of these to be written. */
  function initCtaBand() {
    var band = document.querySelector('.cta-band');
    if (!band) return;

    var layer = band.querySelector('.cta-shapes');
    var shapes = [].slice.call(band.querySelectorAll('.cta-shape'));
    if (!shapes.length) return;

    gsap.set(shapes, { xPercent: -50 });

    /* Each wave swells on its own, deliberately mismatched — different
       distances, different periods, none a multiple of another — so the three
       never come back into step and repeat as a pulse.

       Translation only, no scaling. Moving a layer is handed to the compositor
       and costs nothing; scaling one forces the browser to redraw it, and
       these are three and a half thousand pixels wide. Breathing their heights
       looked better and spent a third of the frame budget doing it. */
    var SWELL = [
      { x:  58, y:  26, time: 13 },
      { x: -74, y: -20, time: 17 },
      { x:  44, y:  34, time: 21 }
    ];
    shapes.forEach(function (el, i) {
      var m = SWELL[i % SWELL.length];
      gsap.to(el, {
        x: m.x, y: m.y,
        duration: m.time,
        ease: 'sine.inOut',
        repeat: -1, yoyo: true,
        delay: i * 1.7
      });
    });

    /* The scroll drift, added to the centring rather than replacing it. */
    [-3.5, 2, 4].forEach(function (amt, i) {
      if (!shapes[i]) return;
      gsap.fromTo(shapes[i], { xPercent: -50 - amt }, {
        xPercent: -50 + amt, ease: 'none',
        scrollTrigger: { trigger: band, start: 'top bottom', end: 'bottom top', scrub: 1 }
      });
    });

    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    /* The pointer moves the waves rather than lighting them. The whole layer
       leans after the cursor, and on top of that each wave is pushed a
       different distance — the front one nearly three times the back one — so
       moving across the band opens the gaps between them and closes them
       again. Depth you cause, rather than a highlight you drag around. */
    var leanX = layer ? gsap.quickTo(layer, 'x', { duration: 1, ease: 'power3.out' }) : null;
    var leanY = layer ? gsap.quickTo(layer, 'y', { duration: 1, ease: 'power3.out' }) : null;
    var DEPTH = [1.6, 3.2, 4.6];
    var push = shapes.map(function (el) {
      return gsap.quickTo(el, 'yPercent', { duration: 1.1, ease: 'power3.out' });
    });

    /* The band's box is measured when it changes, not on every mouse move.
       Reading it inside the handler forces a layout on each event, and a
       pointer sweep fires those faster than a frame — which was costing about
       a fifth of the frames outright. */
    var box = null;
    function measure() { box = band.getBoundingClientRect(); }
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, { passive: true });
    ScrollTrigger.addEventListener('refresh', measure);

    band.addEventListener('pointermove', function (e) {
      if (!box || !box.width) return;
      var px = (e.clientX - box.left) / box.width - 0.5;
      var py = (e.clientY - box.top) / box.height - 0.5;
      if (leanX) { leanX(px * -36); leanY(py * -26); }
      push.forEach(function (set, i) { set(py * (DEPTH[i % DEPTH.length]) * -1); });
    });

    band.addEventListener('pointerleave', function () {
      if (leanX) { leanX(0); leanY(0); }
      push.forEach(function (set) { set(0); });
    });
  }

  /* --------------------------------------------------------- progress rail */

  function initProgress() {
    var bar = document.getElementById('scrollProgress');
    if (!bar) return;
    gsap.to(bar, {
      scaleX: 1, ease: 'none',
      scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: 0.3 }
    });
  }

  /* ---------------------------------------------------- the answers, sliding */

  // <details> snaps. Taking over the summary click lets the answer slide, and
  // lets a closing panel finish before the element actually closes. main.js
  // keeps the plain version for when GSAP is not here, so it stands down.
  function initFaq() {
    var items = Array.prototype.slice.call(document.querySelectorAll('.faq-item'));
    if (!items.length) return;
    window.__faqAnimated = true;

    function slide(item, open) {
      var body = item.querySelector('.faq-a');
      if (!body) { item.open = open; return; }

      var pad = parseFloat(window.getComputedStyle(body).paddingBottom) || 0;
      // The page just got taller or shorter, so every trigger below this
      // answer is now measured against the wrong position. That refresh is
      // needed — but it recalculates all of them, and doing it in the same
      // frame the tween finishes lands a hitch right on the end of the
      // movement, which is what made the toggle feel rough. One frame later
      // costs nothing and the animation reads clean.
      function settle() {
        gsap.set(body, { clearProps: 'height,paddingBottom,opacity,overflow' });
        requestAnimationFrame(function () {
          safeRefresh();
          ScrollTrigger.update();
        });
      }

      gsap.killTweensOf(body);

      if (open) {
        item.open = true;

        // Measured here rather than handed to GSAP as height:'auto'. Animating
        // to 'auto' makes GSAP set the element to auto for one frame to read
        // it, which paints the whole answer at full size and then snaps it
        // back to nothing — a single-frame flash of the finished panel right
        // at the start. Measuring it ourselves and animating to a number
        // never shows that frame.
        gsap.set(body, { height: 'auto', paddingBottom: pad });
        var full = body.offsetHeight;

        gsap.fromTo(body,
          { height: 0, paddingBottom: 0, opacity: 0, overflow: 'hidden' },
          { height: full, opacity: 1, duration: 0.4, ease: 'power2.out', onComplete: settle });

        // The padding is given its own, much shorter tween. On one tween with
        // the height it arrives only as the panel finishes, so for most of the
        // open the last line of the answer sits flush against the bottom of
        // the card and is sliced by it. Front-loading it puts the gap there
        // before the text ever reaches the edge.
        gsap.fromTo(body, { paddingBottom: 0 },
          { paddingBottom: pad, duration: 0.16, ease: 'power2.out' });
      } else {
        gsap.to(body, {
          height: 0, paddingBottom: 0, opacity: 0, overflow: 'hidden',
          duration: 0.3, ease: 'power2.in',
          onComplete: function () { item.open = false; settle(); }
        });
      }
    }

    items.forEach(function (item) {
      var summary = item.querySelector('.faq-q');
      if (!summary) return;
      summary.addEventListener('click', function (event) {
        event.preventDefault();                 // we drive the open state
        var wasOpen = item.open;
        items.forEach(function (other) {
          if (other !== item && other.open) slide(other, false);
        });
        slide(item, !wasOpen);
      });
    });
  }

  /* ------------------------------------------------------------------ boot */

  function build() {
    initChars();
    initCounters();
    initReveals();
    initParallax();
    initCtaBand();
    initDepth();
    initMagnets();
    initProgress();
    initFaq();

    root.classList.add('sd-anim-ready');
    root.classList.remove('sd-anim');
    safeRefresh();
    playActive();
  }

  build();

  // A refresh re-evaluates every trigger, and in doing so winds anything
  // already in view back to its start. Re-assert those afterwards, or the hero
  // would empty itself the moment the webfonts land or the window is resized.
  /* A refresh recalculates every trigger and, in doing so, winds every tween
     back to its start. That is fine when the page is scrolling — the next
     update puts things right — and wrong the rest of the time: opening an
     answer or resizing the window refreshes with the page standing still, and
     whatever was on screen is left hidden, or replayed from nothing over its
     full duration, which is the flicker at the end of opening a question.

     Playing them again is not the answer, because a reveal that had already
     finished should not run a second time. So the progress of every tween is
     taken before the refresh and put straight back afterwards — set, not
     animated. A refresh then costs nothing visible at all. */
  var snapshot = null;

  ScrollTrigger.addEventListener('refreshInit', function () {
    snapshot = tweens.map(function (t) { return t ? t.progress() : -1; });
  });

  ScrollTrigger.addEventListener('refresh', function () {
    ScrollTrigger.update();   // isActive is stale until something updates
    if (snapshot) {
      tweens.forEach(function (t, i) {
        // Only what had actually got somewhere. Restoring a tween that was
        // still at zero pins it to its hidden start state, and its trigger
        // then has nothing left to announce when you finally scroll to it —
        // which is how clicking a question left the closing band empty.
        if (t && snapshot[i] > 0) t.progress(snapshot[i]);
      });
      snapshot = null;
    }
    playActive();
  });

  window.addEventListener('load', safeRefresh);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(safeRefresh);
})();
