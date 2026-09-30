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

  // Bootstrap's own ScrollSpy marks the nav link for the section in view. It
  // handles the cases a hand-rolled observer gets wrong — resize, refresh,
  // and the last section being too short to ever reach the trigger line.
  if (hasBootstrap && document.querySelector('.primary-nav')) {
    new bootstrap.ScrollSpy(document.body, {
      target: '.primary-nav',
      rootMargin: '-88px 0px -40%',   // clear the sticky header, aim above the fold
      smoothScroll: true
    });
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
