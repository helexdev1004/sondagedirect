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

  // Mark the nav link for whichever section is currently in view.
  var navLinks = [].slice.call(document.querySelectorAll('.primary-nav .nav-link'));
  var sections = navLinks
    .map(function (link) { return document.querySelector(link.getAttribute('href')); })
    .filter(Boolean);

  if (sections.length && 'IntersectionObserver' in window) {
    var setCurrent = function (id) {
      navLinks.forEach(function (link) {
        link.classList.toggle('is-current', link.getAttribute('href') === '#' + id);
      });
    };

    // Track what is on screen rather than reacting to entries alone: a callback
    // only carries the sections whose status changed, so a fast jump can deliver
    // nothing but departures and leave the highlight stranded.
    var onScreen = [];

    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var at = onScreen.indexOf(entry.target);
        if (entry.isIntersecting && at === -1) onScreen.push(entry.target);
        if (!entry.isIntersecting && at !== -1) onScreen.splice(at, 1);
      });

      // sections is in document order, so the first still on screen is the topmost.
      var top = sections.filter(function (s) { return onScreen.indexOf(s) !== -1; })[0];
      setCurrent(top ? top.id : null);
    }, { rootMargin: '-88px 0px -45% 0px', threshold: 0 });

    sections.forEach(function (section) { spy.observe(section); });
  }

  var track = document.getElementById('testimonialTrack');
  var dotWrap = document.getElementById('testimonialDots');

  if (track && dotWrap) {
    var dots = [].slice.call(dotWrap.querySelectorAll('.dot'));
    var cards = [].slice.call(track.children);

    var activeIndex = function () {
      var middle = track.scrollLeft + track.clientWidth / 2;
      var best = 0;
      var bestGap = Infinity;
      cards.forEach(function (card, i) {
        var gap = Math.abs(card.offsetLeft + card.offsetWidth / 2 - middle);
        if (gap < bestGap) { bestGap = gap; best = i; }
      });
      return best;
    };

    var syncDots = function () {
      var i = activeIndex();
      dots.forEach(function (dot, n) { dot.classList.toggle('is-active', n === i); });
    };

    dots.forEach(function (dot, i) {
      dot.addEventListener('click', function () {
        var card = cards[i];
        track.scrollTo({
          left: card.offsetLeft - (track.clientWidth - card.offsetWidth) / 2,
          behavior: 'smooth'
        });
      });
    });

    track.addEventListener('scroll', function () {
      window.clearTimeout(track._t);
      track._t = window.setTimeout(syncDots, 80);
    }, { passive: true });

    syncDots();
  }

  // Only one answer open at a time, so the list never runs away down the page.
  var faqItems = [].slice.call(document.querySelectorAll('.faq-item'));

  faqItems.forEach(function (item) {
    item.addEventListener('toggle', function () {
      if (!item.open) return;
      faqItems.forEach(function (other) {
        if (other !== item) other.open = false;
      });
    });
  });

  var form = document.querySelector('.newsletter-form');

  if (form) {
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var input = form.querySelector('.newsletter-input');
      var message = document.querySelector('.newsletter-msg');
      if (!message) return;

      if (input.checkValidity()) {
        message.textContent = 'Thanks — check your inbox to confirm.';
        form.reset();
      } else {
        message.textContent = 'Please enter a valid email address.';
      }
    });
  }
})();
