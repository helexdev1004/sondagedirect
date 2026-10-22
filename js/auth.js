/* Sign in / sign up forms.
 *
 * No back end yet, so a valid submit just says so and stops.
 * Validation is hand-rolled because the built-in messages can't be styled
 * and say things like "Please match the requested format".
 */
(function () {
  'use strict';

  /* password show/hide */

  document.querySelectorAll('[data-eye]').forEach(function (btn) {
    var field = document.getElementById(btn.getAttribute('data-eye'));
    if (!field) return;

    btn.addEventListener('click', function () {
      var show = field.type === 'password';
      field.type = show ? 'text' : 'password';
      btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      btn.setAttribute('aria-pressed', String(show));
      btn.querySelector('use').setAttribute('href', show ? '#i-eye-off' : '#i-eye');
      // put the caret back at the end, otherwise clicking the eye drops it mid-word
      field.focus();
      var at = field.value.length;
      if (field.setSelectionRange && field.type !== 'date') field.setSelectionRange(at, at);
    });
  });

  /* region list follows country */

  // same list the profile screen uses. copied rather than shared because app.js
  // isn't loaded on these pages.
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
    // stays disabled until a country is picked - an empty region menu is worse
    // than one that says why
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

  /* validation */

  var RULES = {
    required: function (v) { return v.trim() !== ''; },

    // loose on purpose. tighter patterns reject real addresses: plus-addressing,
    // the newer long TLDs, apostrophes.
    email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()); },

    // length only. composition rules just get you Passw0rd!
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

    // skip disabled controls. region is disabled until a country is chosen, and
    // without this an empty submit flagged it with an error you couldn't clear.
    if (input.disabled) { clear(field); return true; }

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
      // nothing goes red until the first submit. after that, validate as they type.
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
        // jump to the first bad field, not the top - on signup it can be six rows down
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
