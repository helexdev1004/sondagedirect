(function () {
  'use strict';

  var header = document.getElementById('siteHeader');
  var nav = document.getElementById('primaryNav');

  if (header) {
    var onScroll = function () {
      header.classList.toggle('is-stuck', window.scrollY > 8);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  if (nav) {
    nav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        if (nav.classList.contains('show')) {
          bootstrap.Collapse.getOrCreateInstance(nav).hide();
        }
      });
    });
  }

  var hasBootstrap = typeof window.bootstrap !== 'undefined';

  // prefers-reduced-motion only kills scrolls the browser starts, not ones we
  // ask for with behavior:'smooth'. so check it here too.
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var glide = reduced ? 'auto' : 'smooth';

  // Highlight the current nav link.
  //
  // Was Bootstrap ScrollSpy, which never worked here - stuck on the first link
  // and its smoothScroll option stopped the anchors scrolling at all.
  // It compares each section against the last one it saw, so the nav being in a
  // different order from the document was enough to pin it. Nav is in document
  // order now, but the sort stays so it can't break again.
  //
  // Scrolling itself is left to the browser: href to an id, scroll-behavior in
  // the CSS, and scroll-margin-top to clear the sticky bar.
  var navLinks = [].slice.call(document.querySelectorAll('.primary-nav .nav-link[href^="#"]'));

  var spied = navLinks
    .map(function (link) {
      var id = link.getAttribute('href');
      var el = id && id.length > 1 ? document.querySelector(id) : null;
      return el ? { link: link, el: el } : null;
    })
    .filter(Boolean)
    .sort(function (a, b) {
      return (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1;
    });

  if (spied.length) {
    var markNav = function () {
      // a third of the way down, not right under the bar. any higher and the nav
      // lags a whole section behind whatever fills the screen.
      var bar = header ? header.getBoundingClientRect().height : 0;
      var line = Math.max(bar + 28, window.innerHeight * 0.32);
      var current = null;

      spied.forEach(function (s) {
        if (s.el.getBoundingClientRect().top <= line) current = s;
      });

      // last section is usually too short to reach that line, so it wins at the bottom
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
        current = spied[spied.length - 1];
      }

      navLinks.forEach(function (link) {
        link.classList.toggle('active', !!current && link === current.link);
      });
    };

    markNav();
    window.addEventListener('scroll', markNav, { passive: true });
    window.addEventListener('resize', markNav);
  }

  // Sliding pill under the nav. Sits on the current link, follows the hover.
  //
  // Built in JS so there's no stray element in the markup for a no-script page.
  // <li> because the parent is a <ul>.
  //
  // Works off .active, whoever set it: markNav moves it on the homepage, the app
  // pages hardcode it. One implementation, both cases.
  var navList = document.querySelector('.primary-nav');
  var pillLinks = [].slice.call(document.querySelectorAll('.primary-nav .nav-link'));

  if (navList && pillLinks.length) {
    var pill = document.createElement('li');
    pill.className = 'nav-pill';
    pill.setAttribute('aria-hidden', 'true');
    navList.appendChild(pill);

    var sitOn = function (link) {
      if (!link) { pill.style.opacity = '0'; return; }
      var r = link.getBoundingClientRect();
      var base = navList.getBoundingClientRect();
      pill.style.width = r.width + 'px';
      pill.style.height = r.height + 'px';
      pill.style.transform =
        'translate(' + (r.left - base.left) + 'px,' + (r.top - base.top) + 'px)';
      pill.style.opacity = '1';
    };

    // back to the current link. might be none at the very top of the page.
    var settle = function () {
      var current = null;
      pillLinks.forEach(function (l) { if (l.classList.contains('active')) current = l; });
      sitOn(current);
    };

    pillLinks.forEach(function (link) {
      link.addEventListener('mouseenter', function () { sitOn(link); });
      link.addEventListener('focus', function () { sitOn(link); });
    });
    navList.addEventListener('mouseleave', settle);
    navList.addEventListener('focusout', settle);

    settle();
    // transitions off for the first placement or it flies in from the corner
    requestAnimationFrame(function () { navList.classList.add('pill-ready'); });

    // Inter loads after first paint (display:swap) and every link changes width.
    // without this the pill keeps the fallback metrics and sits off its link.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(settle);
    }

    window.addEventListener('resize', settle);
    // markNav moves .active on scroll, pill needs to follow
    window.addEventListener('scroll', settle, { passive: true });
  }

  // Reward cards only have the brand name in the mark's aria-label, so pointer
  // users get a tooltip. Screen readers already read it. Not interactive, so no
  // tabindex and no focus handler.
  if (hasBootstrap) {
    document.querySelectorAll('.reward-card').forEach(function (card) {
      var mark = card.querySelector('[aria-label]');
      if (!mark) return;
      new bootstrap.Tooltip(card, {
        title: mark.getAttribute('aria-label'),
        placement: 'top',
        trigger: 'hover',
        container: 'body'      // outside the grid so nothing can clip it
      });
    });
  }

  // Dots for the reviews. They're a swipe track under 992px with the scrollbar
  // hidden, so otherwise nothing tells you the other two are there.
  //
  // Built in JS so the count can't drift from the number of reviews.
  //
  // Measured with getBoundingClientRect and scrolled by a delta - offsetLeft is
  // relative to the nearest positioned ancestor, which isn't the track.
  var track = document.getElementById('testimonialTrack');
  var dotsBox = document.getElementById('testimonialDots');

  if (track && dotsBox) {
    var cards = [].slice.call(track.querySelectorAll('.testimonial-card'));
    var mid = function (el) {
      var r = el.getBoundingClientRect();
      return (r.left + r.right) / 2;
    };

    var dots = cards.map(function (card, i) {
      var dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'testimonial-dot';
      dot.setAttribute('aria-label', 'Review ' + (i + 1) + ' of ' + cards.length);
      dot.addEventListener('click', function () {
        // scrollBy on the track, not scrollIntoView - that drags the whole page
        track.scrollBy({ left: mid(card) - mid(track), behavior: glide });
      });
      dotsBox.appendChild(dot);
      return dot;
    });

    var markDots = function () {
      var centre = mid(track);
      var near = 0;
      var best = Infinity;
      cards.forEach(function (card, i) {
        var d = Math.abs(mid(card) - centre);
        if (d < best) { best = d; near = i; }
      });
      dots.forEach(function (dot, i) {
        dot.setAttribute('aria-current', i === near ? 'true' : 'false');
      });
    };

    markDots();
    track.addEventListener('scroll', markDots, { passive: true });
    window.addEventListener('resize', markDots);
  }

  // back-to-top, once there's something above you
  var toTop = document.getElementById('toTop');

  if (toTop) {
    var toggleToTop = function () {
      toTop.classList.toggle('is-shown', window.scrollY > 900);
    };
    toggleToTop();
    window.addEventListener('scroll', toggleToTop, { passive: true });
    toTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: glide });
    });
  }

  // one answer open at a time. if animations.js loaded it drives the accordion
  // itself and this keeps out of the way.
  var faqItems = [].slice.call(document.querySelectorAll('.faq-item'));

  faqItems.forEach(function (item) {
    item.addEventListener('toggle', function () {
      if (window.__faqAnimated) return;
      if (!item.open) return;
      faqItems.forEach(function (other) {
        if (other !== item) other.open = false;
      });
    });
  });

})();
