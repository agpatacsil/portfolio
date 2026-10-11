// Password-protected case studies.
// The real content lives in an encrypted file (made by tools/lock.py). It's only readable
// after the visitor enters the password: the browser derives the key from it and decrypts
// the page locally. Nothing readable is published, and the password isn't stored in the code.

(function () {
  var main = document.querySelector('main[data-locked]');
  if (!main) return;

  var ITERATIONS = 310000;           // must match tools/lock.py
  var STORE_KEY = 'case-study-pass'; // remembered for this tab only, so other locked pages open too
  var form = document.getElementById('lock-form');
  var input = document.getElementById('lock-password');
  var error = document.getElementById('lock-error');
  var button = form.querySelector('button');
  var bundle = null;

  function fail(message) {
    error.textContent = message;
    button.disabled = false;
    button.textContent = 'View';
    input.focus();
    input.select();
  }

  function load() {
    if (!bundle) {
      bundle = fetch(main.dataset.locked).then(function (res) {
        if (!res.ok) throw new Error('missing');
        return res.arrayBuffer();
      });
    }
    return bundle;
  }

  // openssl enc -aes-256-cbc -pbkdf2 -md sha256: "Salted__" + 8-byte salt + ciphertext,
  // key + iv both come from one PBKDF2 run.
  function decrypt(buffer, password) {
    var bytes = new Uint8Array(buffer);
    var salt = bytes.slice(8, 16);
    var data = bytes.slice(16);
    return crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
      .then(function (base) {
        return crypto.subtle.deriveBits({ name: 'PBKDF2', salt: salt, iterations: ITERATIONS, hash: 'SHA-256' }, base, 384);
      })
      .then(function (bits) {
        bits = new Uint8Array(bits);
        return crypto.subtle.importKey('raw', bits.slice(0, 32), 'AES-CBC', false, ['decrypt'])
          .then(function (key) { return crypto.subtle.decrypt({ name: 'AES-CBC', iv: bits.slice(32, 48) }, key, data); });
      })
      .then(function (plain) {
        var page = JSON.parse(new TextDecoder().decode(plain));
        if (page.check !== 'unlocked') throw new Error('wrong');
        return page;
      });
  }

  function reveal(page) {
    main.innerHTML = page.html;
    main.querySelectorAll('[data-asset]').forEach(function (img) {
      var asset = page.assets[img.dataset.asset];
      if (!asset) return;
      var raw = atob(asset.data);
      var arr = new Uint8Array(raw.length);
      for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
      img.src = URL.createObjectURL(new Blob([arr], { type: asset.type }));
      img.removeAttribute('data-asset');
    });
    document.title = page.title + ' · Allison Patacsil';
    window.scrollTo(0, 0);
    document.dispatchEvent(new Event('casestudy:ready'));
  }

  function attempt(password, remembered) {
    if (!window.crypto || !crypto.subtle) {
      fail('This page needs a secure (https) connection to unlock.');
      return;
    }
    button.disabled = true;
    button.textContent = 'Unlocking…';
    error.textContent = '';
    load()
      .then(function (buffer) { return decrypt(buffer, password); })
      .then(function (page) {
        try { sessionStorage.setItem(STORE_KEY, password); } catch (e) {}
        reveal(page);
      })
      .catch(function (err) {
        if (remembered) {
          try { sessionStorage.removeItem(STORE_KEY); } catch (e) {}
          button.disabled = false;
          button.textContent = 'View';
          return;
        }
        fail(err && err.message === 'missing'
          ? 'Couldn’t load this case study. Please try again later.'
          : 'Oops! Wrong password. Please try again.');
      });
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (input.value) attempt(input.value, false);
  });

  var saved = null;
  try { saved = sessionStorage.getItem(STORE_KEY); } catch (e) {}
  if (saved) attempt(saved, true);
})();
