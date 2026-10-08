/* Sign in and sign up.
 *
 * Nothing is sent anywhere. There is no back end behind these yet, so a form
 * that passes says so and stops — it does not pretend an account was made.
 *
 * The validation is written out rather than left to the browser because the
 * built-in messages cannot be styled, appear one at a time in a bubble that
 * vanishes, and say things like "Please match the requested format".
 */
(function () {
  'use strict';

  /* ----------------------------------------------------------- the eye */

  document.querySelectorAll('[data-eye]').forEach(function (btn) {
    var field = document.getElementById(btn.getAttribute('data-eye'));
    if (!field) return;

    btn.addEventListener('click', function () {
      var show = field.type === 'password';
      field.type = show ? 'text' : 'password';
      btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      btn.setAttribute('aria-pressed', String(show));
      btn.querySelector('use').setAttribute('href', show ? '#i-eye-off' : '#i-eye');
      // Back to the field, at the end of what is written there. Clicking the
      // eye otherwise takes the caret away mid-word.
      field.focus();
      var at = field.value.length;
      if (field.setSelectionRange && field.type !== 'date') field.setSelectionRange(at, at);
    });
  });

  /* ------------------------------------------------------ region by country */

  // The same table the profile screen uses. Duplicated rather than shared
  // because app.js does not load here and loading it for one object would
  // bring the whole signed-in app with it.
  var REGIONS = {
    Belgium:     ['Antwerp', 'East Flanders', 'Flemish Brabant', 'Hainaut', 'Liège', 'Limburg', 'Namur', 'West Flanders'],
    France:      ['Auvergne-Rhône-Alpes', 'Brittany', 'Grand Est', 'Hauts-de-France', 'Île-de-France', 'Normandy', 'Nouvelle-Aquitaine', 'Occitanie'],
    Germany:     ['Baden-Württemberg', 'Bavaria', 'Berlin', 'Hamburg', 'Hesse', 'Lower Saxony', 'North Rhine-Westphalia', 'Saxony'],
    Italy:       ['Campania', 'Emilia-Romagna', 'Lazio', 'Lombardy', 'Piedmont', 'Sicily', 'Tuscany', 'Veneto'],
    Netherlands: ['Drenthe', 'Flevoland', 'Friesland', 'Gelderland', 'Groningen', 'Limburg', 'Noord-Brabant', 'Noord-Holland', 'Overijssel', 'Utrecht', 'Zeeland', 'Zuid-Holland'],
    Portugal:    ['Aveiro', 'Braga', 'Coimbra', 'Faro', 'Lisbon', 'Porto', 'Setúbal'],
    Spain:       ['Andalusia', 'Aragon', 'Basque Country', 'Catalonia', 'Galicia', 'Madrid', 'Valencia']
  };

  var country = document.querySelector('[data-country]');
  var region = document.querySelector('[data-region]');

  if (country && region) {
    // Disabled until a country is chosen, because a region menu with nothing
    // in it is a worse answer than one that says why.
    country.addEventListener('change', function () {
      var list = REGIONS[country.value] || [];
      region.innerHTML = '';

      var first = document.createElement('option');
      first.value = '';
      first.disabled = true;
      first.selected = true;
      first.textContent = list.length ? 'Choose your region' : 'Not applicable';
      region.appendChild(first);

      list.forEach(function (r) {
        var o = document.createElement('option');
        o.textContent = r;
        region.appendChild(o);
      });

      region.disabled = false;
      clear(region.closest('[data-field]'));
    });
  }

  /* -------------------------------------------------------------- checking */

  var RULES = {
    required: function (v) { return v.trim() !== ''; },

    // Deliberately loose. The only honest test of an address is sending to
    // it, and every tighter pattern rejects something real — plus-addressing,
    // long new top-level domains, apostrophes in a name.
    email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()); },

    // Length alone. Composition rules push people toward Passw0rd! and away
    // from the long ordinary phrases that are actually harder to guess.
    password: function (v) { return v.length >= 10; },

    age16: function (v) {
      if (!v) return false;
      var born = new Date(v + 'T00:00:00Z');
      if (isNaN(born.getTime())) return false;
      var now = new Date();
      var cutoff = new Date(Date.UTC(now.getUTCFullYear() - 16, now.getUTCMonth(), now.getUTCDate()));
      return born <= cutoff;
    }
  };

  function mark(field) { if (field) field.classList.add('is-bad'); }
  function clear(field) { if (field) field.classList.remove('is-bad'); }

  function checkOne(input) {
    var field = input.closest('[data-field]');
    var rule = RULES[input.getAttribute('data-rule')] || RULES.required;
    var ok = rule(input.value);
    if (ok) clear(field); else mark(field);
    return ok;
  }

  document.querySelectorAll('[data-auth-form]').forEach(function (form) {
    var inputs = [].slice.call(form.querySelectorAll('[data-rule]'));
    var consents = [].slice.call(form.querySelectorAll('[data-consent]'));
    var done = form.querySelector('[data-done]');
    var touched = false;

    inputs.forEach(function (input) {
      // Nothing is marked red until the form has been submitted once. Telling
      // someone their email is invalid while they are still typing the @ is
      // not help, it is nagging — but once they have been told, correcting it
      // as they fix it is exactly what they want.
      var live = function () { if (touched) checkOne(input); };
      input.addEventListener('blur', live);
      input.addEventListener('input', live);
      input.addEventListener('change', live);
    });

    consents.forEach(function (c) {
      c.querySelector('input').addEventListener('change', function () {
        if (touched) c.classList.toggle('is-bad', !c.querySelector('input').checked);
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      touched = true;
      if (done) done.classList.remove('is-shown');

      var bad = inputs.filter(function (i) { return !checkOne(i); });

      consents.forEach(function (c) {
        var on = c.querySelector('input').checked;
        c.classList.toggle('is-bad', !on);
        if (!on) bad.push(c.querySelector('input'));
      });

      if (bad.length) {
        // To the first thing that is wrong, not the top of the form. On
        // sign-up the first bad field can be six rows down.
        bad[0].focus();
        if (bad[0].scrollIntoView) bad[0].scrollIntoView({ block: 'center', behavior: 'smooth' });
        return;
      }

      if (done) {
        done.classList.add('is-shown');
        done.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    });
  });

})();
