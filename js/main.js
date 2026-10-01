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

  // The stylesheet drops scroll-behavior to auto under prefers-reduced-motion,
  // but that only governs scrolls the browser starts. A scroll asked for in
  // script with behavior:'smooth' glides anyway, so the two scripted ones here
  // have to check for themselves.
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var glide = reduced ? 'auto' : 'smooth';

  // Which nav link is lit. This was Bootstrap's ScrollSpy and it never worked
  // here: it stayed on the first link at every scroll position, and its
  // smoothScroll option stopped the links scrolling at all — clicking one left
  // the page exactly where it was.
  //
  // The marking failed because the nav was not in the page's order: Rewards
  // sat above How it works in the document but second in the menu, and
  // ScrollSpy compares each section against the one it saw last, so the two
  // orders disagreeing was enough to pin it. The menu has since been put in
  // document order, but the sort below stays — it is what makes the marking
  // independent of how the links happen to be written.
  //
  // Scrolling is left to the browser: an href to an id already scrolls, the
  // stylesheet's scroll-behavior makes it glide, and [id]{scroll-margin-top}
  // keeps the landing clear of the sticky bar.
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
      // About a third of the way down, not just under the sticky bar. Put the
      // line right below the bar and a section only counts once its top has
      // gone past it, so the menu lags a whole section behind what fills the
      // screen. A third down, it lights as the section takes over the view.
      var bar = header ? header.getBoundingClientRect().height : 0;
      var line = Math.max(bar + 28, window.innerHeight * 0.32);
      var current = null;

      spied.forEach(function (s) {
        if (s.el.getBoundingClientRect().top <= line) current = s;
      });

      // The last section is usually too short to ever reach that line, so at
      // the foot of the page it is the one that counts.
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

  // The indicator that follows the menu. It rests under whichever link is
  // current and travels to whatever you point at, returning when you leave.
  //
  // Built here rather than written into the markup so a page with no script
  // has no stray element to explain. It is an <li> because its parent is a
  // <ul>, which may take nothing else.
  //
  // Every link in the menu, not just the ones pointing at a section of this
  // page. On the homepage .active is moved by markNav above as you scroll; in
  // the app it is written into the markup, because there "current" means the
  // page you are on. The pill follows .active and does not care which put it
  // there, which is what lets one implementation serve both.
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

    // Back to whichever link is current — which may be none of them, at the
    // very top of the page, and then the pill has nowhere to be.
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
    // Only now may it animate: the first placement would otherwise be seen as
    // a flight in from the corner.
    requestAnimationFrame(function () { navList.classList.add('pill-ready'); });

    // Inter arrives after first paint (the stylesheet asks for display:swap),
    // and every link changes width when it does. Without this the pill keeps
    // the fallback font's measurements and sits visibly off its link.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(settle);
    }

    window.addEventListener('resize', settle);
    // markNav moves .active as you scroll; the pill has to follow it there too.
    window.addEventListener('scroll', settle, { passive: true });
  }

  // A reward card shows a logo and the words "Gift card", so the brand name is
  // only in the mark's aria-label. Sighted pointer users are the ones missing
  // it — screen readers already read the label, and the cards are not
  // interactive, so no tabindex and no focus trigger.
  if (hasBootstrap) {
    document.querySelectorAll('.reward-card').forEach(function (card) {
      var mark = card.querySelector('[aria-label]');
      if (!mark) return;
      new bootstrap.Tooltip(card, {
        title: mark.getAttribute('aria-label'),
        placement: 'top',
        trigger: 'hover',
        container: 'body'      // out of the grid, so no ancestor can clip it
      });
    });
  }

  // The reviews sit side by side on a desktop and become a swipe track under
  // 992px, where the scrollbar is hidden — so nothing says the other two are
  // there. These mark which one you are on and jump to the rest.
  //
  // Built here rather than written into the markup so the count cannot drift
  // from the number of reviews, and so a page with no script still swipes.
  //
  // Everything is measured off bounding rects and scrolled by a delta.
  // offsetLeft would be the obvious way and it is relative to the nearest
  // positioned ancestor, which is not the track — the numbers would only
  // agree with scrollLeft by accident.
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
        // scrollBy on the track, not scrollIntoView, which would take the
        // whole page with it.
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

  // Back to the top, once there is a page behind you.
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

  // Only one answer open at a time, so the list never runs away down the page.
  // If the animation layer loaded it drives the accordion itself, sliding the
  // panels rather than snapping them, and this stays out of the way.
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
