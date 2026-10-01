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
  // Only the reveals, headings and counters are tracked here. The parallax is
  // built once and left alone.
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
    swing: { rotate: -5, y: 54, scale: 0.94, transformOrigin: '50% 100%' },
    // Struck. Arrives oversized and lands hard on its own spot — the same
    // gesture the headline's letters use, so the whole first screen is hit
    // into place rather than half of it being hit and half drifting in.
    stamp: { scale: 1.55, y: -14 }
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

      /* Stamped. Each letter comes in oversized and lands hard on its own
         spot, one after another, and stops dead — power4.in accelerates the
         whole way into the landing, so the speed is highest at the moment it
         arrives. An ease that slowed on approach, or an overshoot that let it
         wobble afterwards, would read as floating down rather than struck.

         It carries its own motion blur, which is what keeps this from looking
         like a letter that simply got smaller: it is smeared while it is
         moving and snaps sharp on the hit. Only three or four are ever in
         flight at once, so the blur costs almost nothing.

         A small random tilt on the way in that snaps to zero on impact keeps
         the line from looking mechanical — each letter set slightly
         differently, the way a hand-set one would be. */
      var tl = gsap.timeline({ paused: true });
      var STRIKE = 0.15;      // how long one letter takes to land
      var GAP = 0.034;        // and how long before the next one does

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

      /* The coloured run is struck harder: it starts larger and more smeared,
         so over the same time it comes in faster and hits with more behind
         it. */
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
    zoom:  { duration: 0.75, ease: 'back.out(1.2)' },
    // power4.in for the same reason the letters use it: it accelerates the
    // whole way in, so the thing is moving fastest at the moment it arrives.
    // Anything that slows on approach reads as landing, not as being struck.
    stamp: { duration: 0.3, ease: 'power4.in' }
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

  /* ----------------------------------------------------------- the three steps */

  // The route lights itself once you reach it: marker one fills, the line
  // draws down to two, two fills, and so on. Everything it looks like is in
  // CSS — this only adds .is-on to each step in turn, and the transitions
  // there do the rest.
  //
  // once: true, and no reverse. An indicator that un-completes itself when you
  // scroll back up is reporting something untrue about where you have been,
  // and it was reverse on triggers like this one that had the whole page
  // strobing earlier.
  function initSteps() {
    var steps = [].slice.call(document.querySelectorAll('.steps .step'));
    if (!steps.length) return;

    var light = function () {
      steps.forEach(function (step, i) {
        gsap.delayedCall(i * 0.45, function () { step.classList.add('is-on'); });
      });
    };

    // Lit outright where motion is unwelcome, rather than lit instantly three
    // times over — the delayedCalls would still be a sequence, just a fast one.
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
