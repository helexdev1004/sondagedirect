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

  // A portrait that hasn't been supplied yet drops out so the tinted panel
  // behind it shows instead of a broken-image icon.
  document.querySelectorAll('.portrait-photo').forEach(function (img) {
    var drop = function () { img.remove(); };
    if (img.complete && img.naturalWidth === 0) drop();
    img.addEventListener('error', drop);
  });

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
