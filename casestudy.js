// Newer case study pages: contents rail highlighting + click to zoom.
// Locked pages fill in their content after the password, so this also runs
// again on the "casestudy:ready" event that lock.js sends.

(function () {
  var observer = null;

  function setupToc() {
    var links = document.querySelectorAll('.cs-toc a[href^="#"]');
    if (!links.length || !('IntersectionObserver' in window)) return;
    if (observer) observer.disconnect();

    var byId = {};
    links.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });

    observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (a) { a.classList.remove('is-active'); });
        var link = byId[entry.target.id];
        if (link) link.classList.add('is-active');
      });
    }, { rootMargin: '-20% 0px -70% 0px' });

    Object.keys(byId).forEach(function (id) {
      var section = document.getElementById(id);
      if (section) observer.observe(section);
    });
  }

  function openLightbox(src, alt) {
    var box = document.createElement('div');
    box.className = 'cs-lightbox';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'Enlarged image');
    box.tabIndex = -1;
    var img = document.createElement('img');
    img.src = src;
    img.alt = alt || '';
    box.appendChild(img);

    var last = document.activeElement;
    function close() {
      box.remove();
      document.removeEventListener('keydown', onKey);
      if (last && last.focus) last.focus();
    }
    function onKey(e) { if (e.key === 'Escape') close(); }

    box.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    document.body.appendChild(box);
    box.focus();
  }

  // one listener for the whole page, so it works for content added later
  document.addEventListener('click', function (e) {
    var img = e.target.closest('.cs img.cs-zoom');
    if (img) {
      openLightbox(img.currentSrc || img.src, img.alt);
      return;
    }
    // replay: restart the live loading states in this canvas from the top
    var replay = e.target.closest('.cs [data-replay]');
    if (replay) {
      var canvas = replay.closest('.cs-canvas') || document;
      canvas.querySelectorAll('.cs-live').forEach(function (el) {
        el.classList.remove('is-drawn');
        void el.offsetWidth;
        el.classList.add('is-drawn');
      });
      return;
    }
    var more = e.target.closest('.cs [data-zoom-target]');
    if (more) {
      var target = document.getElementById(more.dataset.zoomTarget);
      if (target) openLightbox(target.currentSrc || target.src, target.alt);
    }
  });

  // crayon doodles + highlights draw themselves in once they're on screen.
  // they're only hidden beforehand once this script has loaded (.cs-anim),
  // so an old cached copy can never leave them invisible
  document.documentElement.classList.add('cs-anim');

  function setupDoodles() {
    var doodles = document.querySelectorAll('.cs-doodle:not(.is-drawn), .cs-highlight:not(.is-drawn), .cs-slider:not(.is-drawn), .cs-live:not(.is-drawn)');
    if (!('IntersectionObserver' in window)) {
      doodles.forEach(function (d) { d.classList.add('is-drawn'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-drawn');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -15% 0px' });
    doodles.forEach(function (d) { io.observe(d); });
  }

  // final design: the happy path plays on a loop. Each tap dot lands ~0.2s before
  // the screen reacts, like a real tap.
  function setupLoop() {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.querySelectorAll('[data-loop]').forEach(function (loop) {
      if (loop.dataset.ready) return;
      loop.dataset.ready = '1';
      var phone = loop.querySelector('.cs-loop-phone');
      var dot = loop.querySelector('.cs-tap');
      var label = loop.querySelector('.cs-loop-label');
      var pages = {
        loading: loop.querySelector('.p-loading'),
        rec: loop.querySelector('.p-rec'),
        ai: loop.querySelector('.p-ai')
      };
      var timers = [];

      function later(ms, fn) { timers.push(setTimeout(fn, ms)); }
      function stop() { timers.forEach(clearTimeout); timers = []; }
      function setLabel(n, text) {
        if (!label) return;
        label.style.opacity = 0;
        later(180, function () { label.innerHTML = '<span>0' + n + '</span> ' + text; label.style.opacity = 1; });
      }
      function page(name) {
        Object.keys(pages).forEach(function (k) {
          var el = pages[k];
          if (k === name) { el.classList.remove('is-prev'); el.classList.add('is-cur'); }
          else if (el.classList.contains('is-cur')) {
            el.classList.remove('is-cur'); el.classList.add('is-prev');
            later(380, function () { el.classList.remove('is-prev'); });
          }
        });
      }
      function reset() {
        Object.keys(pages).forEach(function (k) { pages[k].classList.remove('is-cur', 'is-prev'); });
        pages.loading.classList.add('is-cur');
        phone.dataset.ai = '0';
      }
      function tap(x, y) {
        dot.style.setProperty('--tx', x + '%');
        dot.style.setProperty('--ty', y + '%');
        dot.classList.remove('is-tapping');
        void dot.offsetWidth;
        dot.classList.add('is-tapping');
      }

      function run() {
        stop();
        // snap back to home instantly, so a restart never shows the sheet sliding away mid-swap
        phone.classList.add('is-resetting');
        phone.dataset.state = 'home';
        reset();
        void phone.offsetWidth;
        phone.classList.remove('is-resetting');
        setLabel(1, 'Entry point');
        var t = 1500;
        later(t, function () { tap(50, 94.2); });                    // Get an account recommendation
        t += 200;
        later(t, function () { phone.dataset.state = 'sheet'; setLabel(2, 'Loading'); });
        t += 3000;
        later(t, function () { page('rec'); setLabel(3, 'Recommendation'); });
        t += 1800;
        later(t, function () { tap(50, 66.9); });                    // Why recommend this account?
        t += 200;
        later(t, function () { page('ai'); phone.dataset.ai = '1'; setLabel(4, 'AI loading'); });
        t += 1900;
        later(t, function () { phone.dataset.ai = '2'; setLabel(5, 'AI explanation'); });
        t += 4700;
        later(t, function () { tap(92.8, 9.6); });                   // close
        t += 200;
        later(t, function () { phone.dataset.state = 'home'; setLabel(1, 'Entry point'); });
        t += 700;
        later(t, run);
      }

      if (reduce) {                                                  // still frame: the recommendation
        phone.dataset.state = 'sheet';
        page('rec');
        if (label) label.innerHTML = '<span>03</span> Recommendation';
        return;
      }
      if (!('IntersectionObserver' in window)) { run(); return; }
      new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) run(); else stop();
      }, { threshold: 0.35 }).observe(loop);
    });
  }

  // final design: tabbed slider of design choices. Auto-advances while it's on screen,
  // until the reader touches it (tab, arrow, swipe, scroll or key).
  function setupTabs() {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.querySelectorAll('[data-tabs]').forEach(function (box) {
      if (box.dataset.ready) return;
      box.dataset.ready = '1';
      var track = box.querySelector('.cs-slides');
      var slides = box.querySelectorAll('.cs-slide');
      var tabs = box.querySelectorAll('.cs-tab');
      var count = box.querySelector('.cs-slide-count');
      var texts = box.querySelectorAll('.cs-slide-text');
      var n = slides.length, cur = 0, touched = reduce, visible = false, timer = null, settle = null;

      function mark(i) {
        cur = i;
        tabs.forEach(function (t, k) { t.setAttribute('aria-pressed', k === i ? 'true' : 'false'); });
        texts.forEach(function (t, k) { t.classList.toggle('is-on', k === i); });
        if (count) count.textContent = (i + 1) + ' / ' + n;
        var tab = tabs[i], row = tab && tab.parentNode;
        if (row && row.scrollWidth > row.clientWidth) {
          // bring the active tab into view inside the (scrollable) tab row
          var left = row.scrollLeft + tab.getBoundingClientRect().left - row.getBoundingClientRect().left;
          row.scrollTo({ left: i === 0 ? 0 : left - 8, behavior: reduce ? 'auto' : 'smooth' });
        }
      }
      function go(i) {
        i = (i + n) % n;
        track.scrollTo({ left: i * track.clientWidth, behavior: reduce ? 'auto' : 'smooth' });
        mark(i);
      }
      function stopAuto() { touched = true; clearTimeout(timer); }
      function schedule() {
        clearTimeout(timer);
        if (touched || !visible) return;
        timer = setTimeout(function () { go(cur + 1); schedule(); }, 4500);
      }

      tabs.forEach(function (t) {
        t.addEventListener('click', function () { stopAuto(); go(Number(t.dataset.i)); });
      });
      box.querySelectorAll('.cs-slide-btn').forEach(function (b) {
        b.addEventListener('click', function () { stopAuto(); go(cur + Number(b.dataset.step)); });
      });
      ['pointerdown', 'touchstart'].forEach(function (ev) {
        track.addEventListener(ev, stopAuto, { passive: true });
      });
      track.addEventListener('wheel', function (e) {
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) stopAuto();
      }, { passive: true });
      track.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight') { stopAuto(); go(cur + 1); e.preventDefault(); }
        if (e.key === 'ArrowLeft') { stopAuto(); go(cur - 1); e.preventDefault(); }
      });
      // keep tabs and counter in step with swipes
      track.addEventListener('scroll', function () {
        clearTimeout(settle);
        settle = setTimeout(function () {
          var i = Math.round(track.scrollLeft / track.clientWidth);
          if (i !== cur) mark(i);
        }, 80);
      }, { passive: true });

      mark(0);
      if (!('IntersectionObserver' in window)) { visible = true; schedule(); return; }
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible) schedule(); else clearTimeout(timer);
      }, { threshold: 0.5 }).observe(box);
    });
  }

  // final design: the user flow scrolls sideways on narrow screens; show a hint when it does
  function setupFlow() {
    var maps = document.querySelectorAll('.cs-flowchart.is-map');
    function check() {
      maps.forEach(function (box) {
        var scroller = box.querySelector('.fl-scroll');
        box.classList.toggle('is-scrollable', scroller.scrollWidth > scroller.clientWidth + 1);
      });
    }
    check();
    if (!window.__csFlowResize) {
      window.__csFlowResize = true;
      window.addEventListener('resize', function () { setupFlow(); });
    }
  }

  function setup() {
    setupToc();
    setupDoodles();
    setupLoop();
    setupTabs();
    setupFlow();
  }

  setup();
  document.addEventListener('casestudy:ready', setup);
})();
