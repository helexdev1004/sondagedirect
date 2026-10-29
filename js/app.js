/* Signed-in app.
 *
 * Everything is wired off data- attributes, so adding a segmented control or a
 * copy button is a markup change, nothing to register here.
 *
 * Each block bails out if its elements aren't on the page, so one file can load
 * on all of them.
 */
(function () {
  'use strict';

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* segmented control */

  // Tabs with a sliding pill, same idea as the nav but smaller.
  //
  // Panes toggle with the hidden property rather than a class - takes them out
  // of the a11y tree too, which display:none only does by accident.
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
      // + scrollLeft: the bar scrolls sideways when the segments don't fit
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
      // arrow keys move between tabs (expected on a tablist)
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
    // no transition on the first placement or the pill flies in from the left
    requestAnimationFrame(function () { bar.classList.add('pill-ready'); });

    // Inter loads after first paint and every label changes width
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(settle);
    window.addEventListener('resize', settle);
    bar.addEventListener('scroll', settle, { passive: true });
  });

  /* wallet arc */

  // Markup already holds the real dash offset so the ring is right with no JS.
  // Wind it back to empty, hand it straight back, CSS transition draws it.
  var arcs = [].slice.call(document.querySelectorAll('.arc .fill[data-arc]'));

  if (arcs.length && !reduced) {
    arcs.forEach(function (arc) {
      var to = arc.getAttribute('data-arc');
      var full = arc.getAttribute('stroke-dasharray');
      arc.style.strokeDashoffset = full;
      // two frames: the first one is the paint that makes "empty" the start value
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { arc.style.strokeDashoffset = to; });
      });
    });
  }

  /* copy to clipboard */

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

    // Old select-and-execCommand route. Still works where the clipboard API
    // doesn't: plain http, file://, permission denied. Either way the text ends up
    // selected so there's something to copy by hand.
    var fallback = function () {
      select(src);
      try { return document.execCommand('copy'); } catch (e) { return false; }
    };

    btn.addEventListener('click', function () {
      var text = src.textContent.trim();
      // clipboard API needs a secure context and can still be refused. both paths
      // end at the same fallback - an earlier version selected the text on reject
      // but never reported it, which looked identical to the button doing nothing.
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

  /* show more / less */

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

  /* payout method picker */

  var payoutModal = document.getElementById('confirmPayout');

  if (payoutModal && typeof window.bootstrap !== 'undefined') {
    var modal = new bootstrap.Modal(payoutModal);
    var panes = {
      confirm: payoutModal.querySelector('[data-pane="confirm"]'),
      done: payoutModal.querySelector('[data-pane="done"]')
    };
    var names = [].slice.call(payoutModal.querySelectorAll('[data-reward-name]'));
    var opener = null;

    // Focus has to move with the pane. Hiding the pane the focused button is in
    // drops focus to <body>, outside the dialog, and Bootstrap listens for Escape
    // on the modal - so Escape stopped closing it and you were stuck.
    var pane = function (which) {
      panes.confirm.hidden = which !== 'confirm';
      panes.done.hidden = which !== 'done';
      // only once the dialog is actually shown. focusing inside a modal that isn't
      // up yet scrolls the page to it behind the backdrop.
      if (!payoutModal.classList.contains('show')) return;
      var first = panes[which].querySelector('a, button');
      if (first) first.focus();
    };

    document.querySelectorAll('[data-reward]').forEach(function (opt) {
      opt.addEventListener('click', function () {
        opener = opt;
        // innerHTML not textContent - the names carry entities (McDonald's, Assaí)
        // and as text you'd see the entity instead of the character
        names.forEach(function (n) { n.innerHTML = opt.getAttribute('data-reward'); });
        pane('confirm');
        modal.show();
      });
    });

    var confirmBtn = payoutModal.querySelector('[data-confirm-payout]');
    if (confirmBtn) confirmBtn.addEventListener('click', function () { pane('done'); });

    // reset to the first pane and put focus back on the opener, otherwise it's
    // left on <body> and you tab from the top again
    payoutModal.addEventListener('hidden.bs.modal', function () {
      pane('confirm');
      if (opener) opener.focus();
    });
  }

  /* edit a profile detail */

  // One dialog for all eight fields. Bootstrap does open/Escape/backdrop/focus
  // trap; this handles what it can't know - which control a field needs and what
  // the row should read afterwards.
  //
  // Nothing is sent anywhere. Saving updates the row and that's it.
  var editBox = document.getElementById('editField');

  if (editBox && typeof window.bootstrap !== 'undefined') {
    var editModal = bootstrap.Modal.getOrCreateInstance(editBox);
    var eTitle = editBox.querySelector('[data-edit-title]');
    var eSub   = editBox.querySelector('[data-edit-sub]');
    var eLabel = editBox.querySelector('[data-edit-label]');
    var eSlot  = editBox.querySelector('[data-edit-control]');
    var eHint  = editBox.querySelector('[data-edit-hint]');
    var eForm  = editBox.querySelector('[data-edit-form]');
    var openRow = null;
    var editOpener = null;

    var COUNTRIES = ['Belgium', 'France', 'Germany', 'Italy', 'Netherlands', 'Portugal', 'Spain'];

    // enough to make the dependency real. a country with no list still gets one
    // option so the menu is never empty.
    var REGIONS = {
      Belgium:     ['Antwerp', 'East Flanders', 'Flemish Brabant', 'Hainaut', 'Liège', 'Limburg', 'Namur', 'West Flanders'],
      France:      ['Auvergne-Rhône-Alpes', 'Brittany', 'Grand Est', 'Hauts-de-France', 'Île-de-France', 'Normandy', 'Nouvelle-Aquitaine', 'Occitanie'],
      Germany:     ['Baden-Württemberg', 'Bavaria', 'Berlin', 'Hamburg', 'Hesse', 'Lower Saxony', 'North Rhine-Westphalia', 'Saxony'],
      Italy:       ['Campania', 'Emilia-Romagna', 'Lazio', 'Lombardy', 'Piedmont', 'Sicily', 'Tuscany', 'Veneto'],
      Netherlands: ['Drenthe', 'Flevoland', 'Friesland', 'Gelderland', 'Groningen', 'Limburg', 'Noord-Brabant', 'Noord-Holland', 'Overijssel', 'Utrecht', 'Zeeland', 'Zuid-Holland'],
      Portugal:    ['Aveiro', 'Braga', 'Coimbra', 'Faro', 'Lisbon', 'Porto', 'Setúbal'],
      Spain:       ['Andalusia', 'Aragon', 'Basque Country', 'Catalonia', 'Galicia', 'Madrid', 'Valencia']
    };

    var rowFor = function (field) {
      return document.querySelector('[data-edit][data-field="' + field + '"]');
    };

    // "14 March 1994" for the row, ISO for the input. data-value keeps the ISO one.
    var readable = function (iso) {
      var p = String(iso).split('-');
      if (p.length !== 3) return iso;
      var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
    };

    var makeSelect = function (list, current) {
      var el = document.createElement('select');
      el.className = 'detail-input';
      el.id = 'editInput';
      list.forEach(function (o) {
        var opt = document.createElement('option');
        opt.textContent = o;
        if (o === current) opt.selected = true;
        el.appendChild(opt);
      });
      return el;
    };

    var makeInput = function (type, value, attrs) {
      var el = document.createElement('input');
      el.className = 'detail-input';
      el.id = 'editInput';
      el.type = type;
      el.value = value;
      Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, attrs[k]); });
      return el;
    };

    var control = function (kind, value, row) {
      if (kind === 'choice') {
        return makeSelect((row.getAttribute('data-options') || '').split('|').filter(Boolean), value);
      }
      if (kind === 'country') return makeSelect(COUNTRIES, value);
      if (kind === 'region') {
        // whatever the country row says now, not what it said on load
        var c = rowFor('country');
        return makeSelect(REGIONS[c ? c.getAttribute('data-value') : ''] || ['Not applicable'], value);
      }
      if (kind === 'date') {
        // a birth date in the future is a typo
        return makeInput('date', value, { max: new Date().toISOString().slice(0, 10) });
      }
      if (kind === 'password') {
        return makeInput('password', '', { placeholder: 'New password', autocomplete: 'new-password' });
      }
      return makeInput('text', value, { maxlength: '60', autocomplete: 'off' });
    };

    document.querySelectorAll('[data-edit]').forEach(function (row) {
      var btn = row.querySelector('.detail-edit');
      if (!btn) return;
      btn.addEventListener('click', function () {
        openRow = row;
        editOpener = btn;
        var kind = row.getAttribute('data-kind');
        var label = row.getAttribute('data-label');

        eTitle.textContent = label;
        eSub.textContent = kind === 'password'
          ? 'Pick something you do not use anywhere else.'
          : 'Change the ' + label.toLowerCase() + ' we hold for you.';
        eLabel.textContent = kind === 'password' ? 'New password' : label;

        var hint = row.getAttribute('data-hint');
        eHint.textContent = hint || '';
        eHint.hidden = !hint;

        eSlot.innerHTML = '';
        eSlot.appendChild(control(kind, row.getAttribute('data-value') || '', row));
        editModal.show();
      });
    });

    editBox.addEventListener('shown.bs.modal', function () {
      var field = eSlot.querySelector('.detail-input');
      if (!field) return;
      field.focus();
      if (field.select && field.type === 'text') field.select();
    });

    eForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!openRow) return;
      var field = eSlot.querySelector('.detail-input');
      var kind = openRow.getAttribute('data-kind');
      var shown = openRow.querySelector('[data-value-text]');
      var value = field ? field.value : '';

      if (kind === 'password') {
        // never echoed back into the page - the row keeps its dots
        if (!value) { editModal.hide(); return; }
      } else {
        openRow.setAttribute('data-value', value);
        if (shown) shown.textContent = kind === 'date' ? readable(value) : value;
      }

      // changing country can leave the region saying something that country doesn't
      // have, so move it to the first one that it does
      if (openRow.getAttribute('data-field') === 'country') {
        var r = rowFor('region');
        var list = REGIONS[value] || ['Not applicable'];
        if (r && list.indexOf(r.getAttribute('data-value')) === -1) {
          r.setAttribute('data-value', list[0]);
          var rt = r.querySelector('[data-value-text]');
          if (rt) rt.textContent = list[0];
        }
      }

      editModal.hide();
    });

    // focus back to the opener or you're left on <body>
    editBox.addEventListener('hidden.bs.modal', function () {
      eSlot.innerHTML = '';
      if (editOpener) editOpener.focus();
      openRow = null;
    });
  }

  /* profiling survey */

  // Three questions, one page, no back end. Submitting checks the two that
  // have to be answered, then swaps the form for the confirmation.
  (function () {
    var quiz = document.querySelector('[data-quiz]');
    if (!quiz) return;

    var done = document.querySelector('[data-quiz-done]');

    // "None of these" clears the others and any other answer clears it -
    // otherwise people tick it on top of an answer and the row says two
    // things at once.
    [].slice.call(quiz.querySelectorAll('[data-group]')).forEach(function (box) {
      box.addEventListener('change', function () {
        if (!box.checked) return;
        var peers = [].slice.call(quiz.querySelectorAll('[data-group="' + box.getAttribute('data-group') + '"]'));
        var exclusive = box.hasAttribute('data-exclusive');
        peers.forEach(function (p) {
          if (p === box) return;
          if (exclusive || p.hasAttribute('data-exclusive')) p.checked = false;
        });
      });
    });

    // How much room is left, and only once it starts to matter - a counter
    // sitting at 0/500 from the start is noise.
    var open = quiz.querySelector('[data-count-max]');
    var now  = quiz.querySelector('[data-count-now]');
    if (open && now) {
      var max = parseInt(open.getAttribute('data-count-max'), 10);
      open.addEventListener('input', function () {
        now.textContent = open.value.length;
        now.parentNode.classList.toggle('is-near', open.value.length > max * 0.9);
      });
    }

    var answered = function (q) {
      var ins = [].slice.call(q.querySelectorAll('[data-required]'));
      if (!ins.length) return true;
      return ins.some(function (i) { return i.checked; });
    };

    quiz.addEventListener('submit', function (e) {
      e.preventDefault();

      var bad = [].slice.call(quiz.querySelectorAll('[data-question]')).filter(function (q) {
        var ok = answered(q);
        q.classList.toggle('is-bad', !ok);
        return !ok;
      });

      if (bad.length) {
        // to the first one that is wrong, not the top of the page
        bad[0].scrollIntoView({ block: 'center', behavior: 'smooth' });
        var first = bad[0].querySelector('[data-required]');
        if (first) first.focus();
        return;
      }

      quiz.hidden = true;
      if (done) {
        done.hidden = false;
        // The form it replaced was taller, so everything measured below it is
        // now wrong. Same reason the FAQ refreshes after it slides.
        if (window.ScrollTrigger) window.requestAnimationFrame(function () { window.ScrollTrigger.refresh(); });
        // Focus moves to the confirmation or a screen reader is left on a
        // button that no longer exists and says nothing happened.
        done.focus();
        done.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    });

    // Clearing the red the moment it is put right, rather than at the next
    // submit, which is when it stops being useful.
    quiz.addEventListener('change', function (e) {
      var q = e.target.closest('[data-question]');
      if (q && q.classList.contains('is-bad') && answered(q)) q.classList.remove('is-bad');
    });
  })();

  /* delete account */

  // button stays dead until the word is typed. one click is too easy to hit by
  // accident for the only action with no way back.
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
