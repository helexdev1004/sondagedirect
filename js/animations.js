/* Scroll + entrance animation.
 *
 * Reveals are declared in the markup, not listed here: data-anim="mask" on an
 * element, data-anim-group on a parent to do its children, data-anim-delay and
 * data-anim-stagger for sequencing. New sections need nothing in this file.
 *
 * The tweens are timed and built paused, then driven by hand off the four
 * ScrollTrigger crossings (play in, reverse out, play again coming back).
 * Deliberately not scrubbed - scrubbing ties progress to the scrollbar and
 * leaves elements half-finished wherever you stop.
 *
 * Start state is in CSS behind html.sd-anim, added by an inline script in the
 * head and removed as soon as this runs. A 2.5s timeout drops it if this never
 * loads, so the page still renders.
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
  // only reveals/headings/counters are tracked. parallax is built once and left.
  var triggers = [];
  var tweens = [];

  /* helpers */

  var DIST = 46;
  var FROM = {
    up:    { y: DIST },
    down:  { y: -DIST },
    left:  { x: -DIST },
    right: { x: DIST },
    zoom:  { scale: 0.9 },
    fade:  {},
    // hinges on its own top edge so the card swings up out of the page
    tilt:  { y: 38, rotateX: -32, transformOrigin: '50% 0%' },

    // wiped in from its bottom edge. it's being uncovered, not moved into place,
    // hence the small inner shift.
    mask:  { yPercent: 6, clipPath: 'inset(100% 0% 0% 0%)' },
    // arrives out of focus and a bit too big, like a camera settling
    focus: { scale: 1.07, y: 26, filter: 'blur(16px)' },
    // turned on its vertical axis. rotated about the centre with no sideways offset
    // on purpose - hinging on the left edge throws the right edge toward the viewer and
    // perspective projects it wider than its column, which puts the last card in a row
    // over the edge of the page.
    flip:  { rotateY: -34, y: 24, transformOrigin: '50% 50%' },
    // dropped and rocked upright on its base
    swing: { rotate: -5, y: 54, scale: 0.94, transformOrigin: '50% 100%' },
    // struck. oversized, lands hard on its spot - same gesture as the headline
    // letters so the whole first screen is hit into place.
    stamp: { scale: 1.55, y: -14 }
  };

  // what each animated prop gets put back to. built from whatever the preset
  // actually touched, so adding a preset needs no change here.
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

  // narrow screens get the plain rise instead of anything sideways or 3d: a horizontal
  // offset pushes a full-width column off the edge, and perspective is wasted on a phone.
  // blur goes too, it's the most expensive of these to paint.
  function forWidth(name) {
    if (!narrow.matches) return name;
    if (name === 'left' || name === 'right' || name === 'tilt' ||
        name === 'flip' || name === 'focus') return 'up';
    return name;
  }

  // Built paused and driven from the four callbacks by hand. toggleActions on a .from()
  // tween won't resume once reversed and strands elements invisible. Anything already in
  // the viewport on load has a start position above the top of the document, so
  // ScrollTrigger never fires "enter" for it. After building, every active trigger gets
  // played manually.
  /* ScrollTrigger measures by jumping the document to the top, reading every
     trigger, and jumping back. html{scroll-behavior:smooth} makes both of those
     ANIMATE, so refresh measures mid-flight and every position comes back short
     by about the current scroll. Measured here: the closing band's trigger,
     really at 4671, came back as 284 - everything below the fold was then
     treated as long past, reversed to hidden and never shown again.

     So all refreshes go through here. Inline style beats the stylesheet, the
     measuring jumps are instant, smooth anchors go back on afterwards. */
  function safeRefresh() {
    var prev = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    ScrollTrigger.refresh();
    root.style.scrollBehavior = prev;
  }

  // Re-assert anything that should be visible. A refresh winds every tween back to
  // its start. Can't use isActive for this: right after ScrollTrigger.refresh() every
  // trigger reports inactive until something scrolls, so a refresh with the page sitting
  // still (opening an FAQ answer, a resize) found nothing and emptied the screen.
  // Falling back to "is it actually in the viewport" is what makes it safe.
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
    // anything on screen at load is choreography, not scrolling: play it once and keep it
    // out of ScrollTrigger. otherwise its start point sits above the top of the document
    // and every refresh (webfonts, resize) winds it back and empties the hero.
    var box = trigger.getBoundingClientRect();
    if (window.scrollY < 4 && box.top < window.innerHeight * 0.92) {
      tween.play();
      return;
    }

    // data-anim-once reveals the element once and then leaves it alone. the legal pages
    // use it throughout - a paragraph that faded itself out again as you scrolled past
    // would be fighting the reader.
    var once = !!(trigger.hasAttribute && trigger.hasAttribute('data-anim-once'));
    var play = function () { tween.play(); };

    tweens.push(tween);

    if (once) {
      // all four crossings reveal, none rewind. replaying a finished tween costs nothing,
      // and covering every crossing is what makes it safe: a short paragraph can be
      // crossed entirely between two frames on a fast scroll or a deep link, and
      // ScrollTrigger then reports only the leave.
      triggers.push(ScrollTrigger.create({
        trigger: trigger,
        // starts as the element clears the bottom edge rather than at 88%, so it's most of
        // the way in by the time your eye gets there. on a long document that's the
        // difference between a quick scroll finding text and finding blanks.
        start: start || 'top 99%',
        end: end || 'bottom top',
        onEnter: play,
        onEnterBack: play,
        onLeave: play,
        onLeaveBack: play
      }));
      // already scrolled past before this was built - reload partway down, or a deep link
      if (trigger.getBoundingClientRect().top < window.innerHeight * 0.99) tween.play();
      return;
    }

    triggers.push(ScrollTrigger.create({
      trigger: trigger,
      start: start || 'top 88%',
      // 'bottom top', not a percentage - short elements would rewind while still on screen
      end: end || 'bottom top',
      onEnter: play,
      onEnterBack: play,
      onLeave: function () { tween.reverse(); },
      onLeaveBack: function () { tween.reverse(); }
    }));
  }

  /* falling letters */

  // Each letter gets its own span, each word a box that hides overflow. The letters
  // start above their word and drop in one by one, so they come through the top edge of
  // the line instead of just fading on.
  //
  // Wrapping walks the existing nodes instead of rebuilding from plain text, so the line
  // break and the coloured run survive.
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
      // runs again on a language change. by then i18n has rewritten the heading so the
      // spans are gone and the new translation gets split. if they're somehow still
      // there, fall back to the markup stashed the first time rather than splitting a
      // split.
      if (el.querySelector('.word')) {
        el.innerHTML = el.getAttribute('data-split-src') || el.textContent;
      } else {
        el.setAttribute('data-split-src', el.innerHTML);
      }

      // a heading cut into single letters gets read out letter by letter, so put the whole
      // line on the element as a label and hide the pieces
      el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());

      var chars = [];
      wrapLetters(el, chars);
      if (!chars.length) return;
      Array.prototype.forEach.call(el.querySelectorAll('.word'), function (w) {
        w.setAttribute('aria-hidden', 'true');
      });

      // the heading carries no motion itself, only the letters do, so take it out of the
      // hidden start state by hand
      gsap.set(el, { autoAlpha: 1 });

      /* Stamped. Each letter comes in oversized, lands hard and stops dead.
         power4.in accelerates the whole way into the landing so it's fastest at
         the moment it arrives - an ease that slowed on approach, or an overshoot,
         reads as floating down instead of struck.

         Carries its own motion blur, which is what stops it looking like a letter
         that just got smaller: smeared while moving, snaps sharp on the hit. Only
         three or four in flight at a time so it costs nothing.

         Small random tilt on the way in, snapped to zero on impact, keeps the line
         from looking mechanical. */
      var tl = gsap.timeline({ paused: true });
      var STRIKE = 0.15;      // how long one letter takes to land
      var GAP = 0.034;        // and the gap before the next

      tl.fromTo(chars,
        {
          scale: 2.4,
          opacity: 0,
          filter: 'blur(13px)',
          rotate: function () { return gsap.utils.random(-11, 11); }
        },
        {
          scale: 1,
          opacity: 1,
          filter: 'blur(0px)',
          rotate: 0,
          duration: STRIKE,
          ease: 'power4.in',
          stagger: GAP,
          delay: parseFloat(el.getAttribute('data-anim-delay')) || 0.06
        });

      /* the coloured run is struck harder - starts larger and more smeared, so over
         the same time it comes in faster. */
      var accent = [].slice.call(el.querySelectorAll('.text-accent .char'));
      if (accent.length) {
        var at = (chars.length - accent.length) * GAP
               + (parseFloat(el.getAttribute('data-anim-delay')) || 0.06);
        tl.fromTo(accent,
          { scale: 3.2, filter: 'blur(20px)' },
          { scale: 1, filter: 'blur(0px)', duration: STRIKE, ease: 'power4.in', stagger: GAP },
          at);
      }

      var tween = tl;

      scrollPlay(tween, el);
    });
  }

  /* counting figures */

  // "100K+" -> 100 with a "K+" tail, "4,8/5" -> 4.8 with "/5" and the comma kept as the
  // decimal mark. anything with no number is left alone.
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
      // target is stashed on the element. without it a rebuild reads back the zero this
      // function wrote and animates 0 to 0 - which is what happens on load, since the
      // language engine announces its first pass after this has already run.
      var source = el.getAttribute('data-count-value');
      if (!source) {
        source = el.textContent.trim();
        el.setAttribute('data-count-value', source);
      }
      var figure = parseFigure(source);
      if (!figure) return;

      // the figure stays in the markup until the tween actually runs; its first frame
      // writes the zero. keeps the real value in the DOM for anything else reading it,
      // and a page with animations off just shows the number.
      var state = { n: 0 };
      var tween = gsap.to(state, {
        n: figure.value,
        // long enough to read as it climbs rather than be glimpsed. power1.out keeps most
        // of that in the middle of the run - a sharper ease spends it crawling the last
        // few units, which reads as a number that's stopped.
        duration: parseFloat(el.getAttribute('data-count-duration')) || 2.2,
        ease: 'power1.out',
        // held back so each figure starts as its own card arrives, not while three cards
        // are still on their way in
        delay: parseFloat(el.getAttribute('data-anim-delay')) || 0,
        paused: true,
        onUpdate: function () { el.textContent = renderFigure(figure, state.n); }
      });

      scrollPlay(tween, el.closest('.stat') || el);
    });
  }

  /* generic reveals */

  // per-preset duration and ease. the dimensional ones get longer and may overshoot;
  // a wipe gets none, because a mask that springs past its own edge tears.
  var SHAPE = {
    tilt:  { duration: 0.85, ease: 'power3.out' },
    flip:  { duration: 0.95, ease: 'power3.out' },
    swing: { duration: 0.9,  ease: 'back.out(1.4)' },
    focus: { duration: 0.85, ease: 'power2.out' },
    // front-loaded on purpose. an in-out ease looks better in isolation but holds the
    // element near-blank for its first third, which on a long document is exactly when a
    // fast scroll arrives at it.
    mask:  { duration: 0.68, ease: 'power2.out' },
    zoom:  { duration: 0.75, ease: 'back.out(1.2)' },
    // power4.in for the same reason the letters use it - fastest at the moment it
    // arrives. anything that slows on approach reads as landing, not being struck.
    stamp: { duration: 0.3, ease: 'power4.in' }
  };

  function initReveals() {
    document.querySelectorAll('[data-anim]').forEach(function (el) {
      var name = el.getAttribute('data-anim') || 'up';
      if (name === 'chars') return;   // initChars handles these, letter by letter
      name = forWidth(name);

      var delay = parseFloat(el.getAttribute('data-anim-delay')) || 0;
      // A child that animates itself is kept out of its parent's group. Two tweens on one
      // element each reset only the props their own preset touched, so the second to run
      // leaves the first's behind - a heading inside a 'mask' group that also asked for
      // 'up' came out fully clipped and stayed there, invisible at full opacity.
      var targets = el.hasAttribute('data-anim-group')
        ? Array.prototype.slice.call(el.children).filter(function (c) {
            return !c.hasAttribute('data-anim');
          })
        : [el];
      if (!targets.length) return;

      var shape = SHAPE[name] || { duration: 0.7, ease: 'power2.out' };
      var to = endVars(name);
      // data-anim-duration overrides the preset for one element, so a section can be given
      // longer without slowing every other use of the same preset
      to.duration = parseFloat(el.getAttribute('data-anim-duration')) || shape.duration;
      to.ease = shape.ease;
      to.delay = delay;
      to.paused = true;
      // a row of cards arrives one after another. data-anim-stagger tightens or loosens it
      // per group.
      to.stagger = targets.length > 1
        ? (parseFloat(el.getAttribute('data-anim-stagger')) || 0.1)
        : 0;

      gsap.killTweensOf(targets);   // this runs again on a language change
      var tween = gsap.fromTo(targets, startVars(name), to);

      scrollPlay(tween, el);
    });
  }

  /* depth layers */

  // data-parallax="-70" ties the drift to the scrollbar itself rather than a trigger that
  // fires once, so it keeps moving the whole time it's on screen.
  //
  // Don't put this on the same element as data-anim - both write y and the last one wins.
  // Reveal on a wrapper, drift on what's inside.
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

  /* the three steps */

  // Lights itself as you reach it: marker one fills, the line draws down to two, and so
  // on. All the look is in CSS - this only adds .is-on to each step in turn.
  //
  // once:true, no reverse. an indicator that un-completes itself when you scroll back up
  // is lying about where you've been, and reverse on triggers like this is what had the
  // page strobing earlier.
  function initSteps() {
    var steps = [].slice.call(document.querySelectorAll('.steps .step'));
    if (!steps.length) return;

    var light = function () {
      steps.forEach(function (step, i) {
        gsap.delayedCall(i * 0.45, function () { step.classList.add('is-on'); });
      });
    };

    // lit outright where motion isn't wanted, rather than lit instantly three times over
    if (reduced) {
      steps.forEach(function (step) { step.classList.add('is-on'); });
      return;
    }

    ScrollTrigger.create({
      trigger: '.steps',
      start: 'top 78%',
      once: true,
      onEnter: light
    });
  }

  /* magnetic buttons */

  // the main CTA leans toward the pointer and springs back. mouse only - there's no
  // hover to lean into on a touch screen.
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

  /* hero parallax */

  function initParallax() {
    if (!desktop.matches) return;

    // the photo drifts inside its frame, never the frame: the frame carries the mask
    // that dissolves it into the page, and moving that dragged the bottom fade below
    // the section and left a hard sliced edge.
    // 'top top' because the hero is already on screen at load.
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

  /* sliding FAQ answers */

  // <details> snaps. taking over the summary click lets the answer slide and lets a
  // closing panel finish before the element actually closes. main.js keeps the plain
  // version for when GSAP isn't here, so it stands down.
  function initFaq() {
    var items = Array.prototype.slice.call(document.querySelectorAll('.faq-item'));
    if (!items.length) return;
    window.__faqAnimated = true;

    function slide(item, open) {
      var body = item.querySelector('.faq-a');
      if (!body) { item.open = open; return; }

      var pad = parseFloat(window.getComputedStyle(body).paddingBottom) || 0;
      // the page just got taller or shorter, so every trigger below is measured against
      // the wrong position. that refresh is needed, but it recalculates all of them, and
      // doing it in the frame the tween finishes lands a hitch right on the end of the
      // movement. one frame later costs nothing.
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

        // measured here rather than handed to GSAP as height:'auto'. animating to 'auto'
        // makes GSAP set the element to auto for one frame to read it, which paints the
        // whole answer at full size and snaps it back - a one-frame flash of the
        // finished panel right at the start.
        gsap.set(body, { height: 'auto', paddingBottom: pad });
        var full = body.offsetHeight;

        gsap.fromTo(body,
          { height: 0, paddingBottom: 0, opacity: 0, overflow: 'hidden' },
          { height: full, opacity: 1, duration: 0.4, ease: 'power2.out', onComplete: settle });

        // padding gets its own much shorter tween. on one tween with the height it arrives
        // only as the panel finishes, so for most of the open the last line sits flush
        // against the bottom of the card and gets sliced by it.
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

  /* boot */

  function build() {
    initChars();
    initCounters();
    initReveals();
    initParallax();
    initDepth();
    initMagnets();
    initSteps();
    initFaq();

    root.classList.add('sd-anim-ready');
    root.classList.remove('sd-anim');
    safeRefresh();
    playActive();
  }

  build();

  // a refresh winds anything already in view back to its start, so re-assert those
  // afterwards or the hero empties itself when the webfonts land or the window resizes
  /* A refresh recalculates every trigger and winds every tween back to its start.
     Fine while scrolling - the next update fixes it - and wrong the rest of the
     time: opening an answer or resizing refreshes with the page standing still,
     and whatever was on screen is left hidden or replayed from nothing.

     Can't just play them again, because a reveal that already finished shouldn't
     run twice. So grab every tween's progress before the refresh and set it
     straight back after. A refresh then costs nothing visible. */
  var snapshot = null;

  ScrollTrigger.addEventListener('refreshInit', function () {
    snapshot = tweens.map(function (t) { return t ? t.progress() : -1; });
  });

  ScrollTrigger.addEventListener('refresh', function () {
    ScrollTrigger.update();   // isActive is stale until something updates
    if (snapshot) {
      tweens.forEach(function (t, i) {
        // only what had actually got somewhere. restoring a tween still at zero pins it to
        // its hidden start state and its trigger then has nothing left to announce when
        // you finally scroll to it.
        if (t && snapshot[i] > 0) t.progress(snapshot[i]);
      });
      snapshot = null;
    }
    playActive();
  });

  window.addEventListener('load', safeRefresh);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(safeRefresh);
})();
