/* The signed-in app.
 *
 * Everything here is driven off data- attributes in the markup, so a screen
 * that wants a segmented control or a copy button gets one by writing the
 * markup — there is nothing to register in this file.
 *
 * Each block checks for its own elements and leaves if there are none, so the
 * same file loads on every app page without any of them needing to know which
 * page they are on.
 */
(function () {
  'use strict';

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------- segmented control */

  // Tabs, with the menu's travelling indicator at a smaller size — one pill
  // that slides rather than a background appearing and disappearing on each
  // button, so the two controls read as the same gesture.
  //
  // The panes are switched with the hidden property rather than a class: it
  // takes the pane out of the accessibility tree as well as off the screen,
  // which display:none in a stylesheet would do only by accident of the rule
  // still being there.
  [].slice.call(document.querySelectorAll('.segments')).forEach(function (bar) {
    var segs = [].slice.call(bar.querySelectorAll('.segment'));
    if (!segs.length) return;

    var pill = document.createElement('span');
    pill.className = 'segment-pill';
    pill.setAttribute('aria-hidden', 'true');
    bar.insertBefore(pill, bar.firstChild);

    var sitOn = function (seg) {
      var r = seg.getBoundingClientRect();
      var base = bar.getBoundingClientRect();
      pill.style.width = r.width + 'px';
      // bar.scrollLeft, because the control scrolls sideways when the segments
      // do not fit and the pill is positioned against the scrolled content.
      pill.style.transform = 'translateX(' + (r.left - base.left + bar.scrollLeft) + 'px)';
      pill.style.opacity = '1';
    };

    var settle = function () {
      var on = segs.filter(function (s) { return s.classList.contains('is-on'); })[0] || segs[0];
      sitOn(on);
    };

    var show = function (seg) {
      segs.forEach(function (s) {
        var on = s === seg;
        s.classList.toggle('is-on', on);
        s.setAttribute('aria-selected', on ? 'true' : 'false');
        var pane = document.getElementById(s.getAttribute('aria-controls'));
        if (pane) pane.hidden = !on;
      });
      sitOn(seg);
    };

    segs.forEach(function (seg) {
      seg.addEventListener('click', function () { show(seg); });
      // Left and right move between tabs, which is what a tablist is expected
      // to do and what arrow keys do nothing at all for otherwise.
      seg.addEventListener('keydown', function (e) {
        var i = segs.indexOf(seg);
        var next = e.key === 'ArrowRight' ? segs[i + 1] : e.key === 'ArrowLeft' ? segs[i - 1] : null;
        if (!next) return;
        e.preventDefault();
        show(next);
        next.focus();
      });
    });

    settle();
    // Not animated into place on load — the pill would be seen flying in from
    // the left edge. The class turns the transition on afterwards.
    requestAnimationFrame(function () { bar.classList.add('pill-ready'); });

    // Inter arrives after first paint and every label changes width with it.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(settle);
    window.addEventListener('resize', settle);
    bar.addEventListener('scroll', settle, { passive: true });
  });

  /* --------------------------------------------------------------- the arc */

  // The markup already carries the true dash offset, so the ring is correct
  // and still with no script at all. This winds it back to empty and hands it
  // straight back, and the CSS transition on stroke-dashoffset draws it.
  var arcs = [].slice.call(document.querySelectorAll('.arc .fill[data-arc]'));

  if (arcs.length && !reduced) {
    arcs.forEach(function (arc) {
      var to = arc.getAttribute('data-arc');
      var full = arc.getAttribute('stroke-dasharray');
      arc.style.strokeDashoffset = full;
      // Two frames, not one: the first is the paint that establishes "empty"
      // as the value being transitioned away from.
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { arc.style.strokeDashoffset = to; });
      });
    });
  }

  /* ----------------------------------------------------------- copy a link */

  [].slice.call(document.querySelectorAll('[data-copy]')).forEach(function (btn) {
    var src = document.getElementById(btn.getAttribute('data-copy'));
    var label = btn.querySelector('[data-copy-label]');
    if (!src) return;

    var done = function () {
      btn.classList.add('is-done');
      if (label) label.textContent = 'Copied';
      window.setTimeout(function () {
        btn.classList.remove('is-done');
        if (label) label.textContent = 'Copy';
      }, 2000);
    };

    // Selecting the text and asking the document to copy it. This is the old
    // way and it still works where the clipboard API does not: over plain
    // http, from a file, and when the permission is refused. Either way the
    // text ends up selected, so there is something to copy by hand even if
    // nothing else works.
    var fallback = function () {
      select(src);
      try { return document.execCommand('copy'); } catch (e) { return false; }
    };

    btn.addEventListener('click', function () {
      var text = src.textContent.trim();
      // The clipboard API needs a secure context, and even in one it can be
      // refused. Both paths end at the same fallback — an earlier version
      // selected the text on rejection but never said so, which looked from
      // the outside exactly like the button doing nothing at all.
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(done, function () {
          if (fallback()) done();
        });
      } else if (fallback()) {
        done();
      }
    });
  });

  function select(el) {
    var range = document.createRange();
    range.selectNodeContents(el);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  /* ------------------------------------------------------- show more / less */

  [].slice.call(document.querySelectorAll('[data-more]')).forEach(function (btn) {
    var box = document.getElementById(btn.getAttribute('data-more'));
    var label = btn.querySelector('[data-more-label]');
    if (!box) return;

    var shut = label ? label.textContent : '';
    btn.addEventListener('click', function () {
      var open = box.hidden;
      box.hidden = !open;
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (label) label.textContent = open ? 'Show less' : shut;
    });
  });

  /* ------------------------------------------------------ choosing a reward */

  var payoutModal = document.getElementById('confirmPayout');

  if (payoutModal && typeof window.bootstrap !== 'undefined') {
    var modal = new bootstrap.Modal(payoutModal);
    var panes = {
      confirm: payoutModal.querySelector('[data-pane="confirm"]'),
      done: payoutModal.querySelector('[data-pane="done"]')
    };
    var names = [].slice.call(payoutModal.querySelectorAll('[data-reward-name]'));
    var opener = null;

    // Switching pane has to take the focus with it. Hiding the pane the
    // focused button lives in drops focus onto <body>, which is outside the
    // dialog — and Bootstrap listens for Escape on the modal element, so from
    // there Escape stopped closing it and a keyboard user was shut in with
    // nothing to tab to. Moving focus to the new pane fixes the trap and the
    // reading order at once.
    var pane = function (which) {
      panes.confirm.hidden = which !== 'confirm';
      panes.done.hidden = which !== 'done';
      // Only once the dialog is actually up. Focusing something inside a
      // modal that has not been shown yet scrolls the page to it behind the
      // backdrop, and the reset on close focuses the opener instead.
      if (!payoutModal.classList.contains('show')) return;
      var first = panes[which].querySelector('a, button');
      if (first) first.focus();
    };

    document.querySelectorAll('[data-reward]').forEach(function (opt) {
      opt.addEventListener('click', function () {
        opener = opt;
        // innerHTML, not textContent: the names carry entities — the
        // apostrophe in McDonald's, the accent in Assaí — and setting them as
        // text would print the entity rather than the character.
        names.forEach(function (n) { n.innerHTML = opt.getAttribute('data-reward'); });
        pane('confirm');
        modal.show();
      });
    });

    var confirmBtn = payoutModal.querySelector('[data-confirm-payout]');
    if (confirmBtn) confirmBtn.addEventListener('click', function () { pane('done'); });

    // Back to the first pane for the next time, and focus back where it came
    // from — otherwise it is left on <body> and a keyboard user has to tab
    // from the top of the page again.
    payoutModal.addEventListener('hidden.bs.modal', function () {
      pane('confirm');
      if (opener) opener.focus();
    });
  }

  /* ----------------------------------------------------- editing a detail */

  // Each row opens in place. One at a time, because two rows open at once is
  // two sets of Save buttons and no way to tell which one Enter belongs to.
  var details = [].slice.call(document.querySelectorAll('.detail'));

  function closeDetail(row) {
    var form = row.querySelector('.detail-form');
    var edit = row.querySelector('.detail-edit');
    if (!form) return;
    form.hidden = true;
    if (edit) { edit.hidden = false; }
  }

  details.forEach(function (row) {
    var form = row.querySelector('.detail-form');
    var edit = row.querySelector('.detail-edit');
    var value = row.querySelector('[data-value]');
    if (!form || !edit) return;

    var field = form.querySelector('.detail-input');
    var was = field ? field.value : '';

    edit.addEventListener('click', function () {
      details.forEach(function (other) { if (other !== row) closeDetail(other); });
      form.hidden = false;
      edit.hidden = true;
      if (field) { field.focus(); if (field.select) field.select(); }
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (field && value) {
        // A password is never echoed back into the page. The row keeps its
        // dots and says nothing about what the new one is.
        if (field.type !== 'password') {
          value.textContent = field.value;
        }
        was = field.value;
      }
      closeDetail(row);
      edit.focus();
    });

    form.addEventListener('reset', function () { closeDetail(row); });

    var cancel = form.querySelector('[data-cancel]');
    if (cancel) {
      cancel.addEventListener('click', function () {
        if (field) field.value = was;   // put back what was there, not what was typed
        closeDetail(row);
        edit.focus();
      });
    }

    // Escape closes the row the same way Cancel does. Without it the only way
    // out of an open field is to find a small button with the mouse.
    form.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      if (field) field.value = was;
      closeDetail(row);
      edit.focus();
    });
  });

  /* -------------------------------------------------- deleting an account */

  // The button stays dead until the word is typed. A single click is too easy
  // to reach by accident for the one action in the app with no way back.
  var word = document.querySelector('[data-confirm-word]');
  var go = document.querySelector('[data-confirm-delete]');

  if (word && go) {
    var wanted = word.getAttribute('data-confirm-word');
    var check = function () {
      go.disabled = word.value.trim().toUpperCase() !== wanted;
    };
    word.addEventListener('input', check);
    check();

    var box = word.closest('.modal');
    if (box) {
      box.addEventListener('hidden.bs.modal', function () { word.value = ''; check(); });
      box.addEventListener('shown.bs.modal', function () { word.focus(); });
    }
  }

})();
