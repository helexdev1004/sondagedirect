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

  // Which nav link is lit. This was Bootstrap's ScrollSpy and it never worked
  // here: it stayed on the first link at every scroll position, and its
  // smoothScroll option stopped the links scrolling at all — clicking one left
  // the page exactly where it was.
  //
  // The marking failed because the nav is not in the page's order. Rewards
  // sits above How it works in the document but second in the menu, and
  // ScrollSpy compares each section against the one it saw last, so the two
  // orders disagreeing is enough to pin it. Sorting by document position is
  // most of what this does differently.
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

  // Back to the top, once there is a page behind you.
  var toTop = document.getElementById('toTop');

  if (toTop) {
    var toggleToTop = function () {
      toTop.classList.toggle('is-shown', window.scrollY > 900);
    };
    toggleToTop();
    window.addEventListener('scroll', toggleToTop, { passive: true });
    toTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
