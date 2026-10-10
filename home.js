// home page: theme toggle, nav shadow on scroll, scroll reveal

(function () {
  var root = document.documentElement;

  // iced (light) / hot (dark) toggle
  var toggle = document.getElementById('theme-toggle');
  var themeColor = document.querySelector('meta[name="theme-color"]');

  function applyTheme(theme) {
    if (theme === 'dark') {
      root.dataset.theme = 'dark';
    } else {
      delete root.dataset.theme;
    }
    toggle.setAttribute('aria-checked', theme === 'dark' ? 'true' : 'false');
    if (themeColor) themeColor.setAttribute('content', theme === 'dark' ? '#17181B' : '#FAF8F3');
  }

  applyTheme(root.dataset.theme === 'dark' ? 'dark' : 'light');

  toggle.addEventListener('click', function () {
    var next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try { localStorage.setItem('theme', next); } catch (e) {}
  });

  // nav gets a hairline once you scroll
  var header = document.getElementById('header');
  function onScroll() {
    header.classList.toggle('is-scrolled', window.scrollY > 8);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // fade sections in as they scroll into view
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting || entry.boundingClientRect.top < 0) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('is-in'); });
  }

  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  // about page: draw the race route through the checkpoints.
  // wide screens: it runs left to right and draws itself once in view;
  // narrower screens: it runs top to bottom and is revealed as you scroll.
  var route = document.getElementById('route');
  if (route) {
    var routePath = document.getElementById('route-path');
    var maskPath = document.getElementById('route-mask-path');
    var leaders = document.getElementById('route-leaders');
    var stages = Array.prototype.slice.call(route.querySelectorAll('.stage'));
    var course = stages.filter(function (st) { return !st.classList.contains('stage-station'); });
    var stations = stages.filter(function (st) { return st.classList.contains('stage-station'); });
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var wide = window.matchMedia('(min-width: 961px)');
    var narrow = window.matchMedia('(max-width: 700px)');
    var drawnAcross = false;
    var stageY = [];
    // hand-tuned bends between markers, so the course meanders instead of zig-zagging evenly
    var bends = [1, -.8, 1.1, -.9, 1.2, -.85, 1];

    function center(el, box) {
      var r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top };
    }

    function setReveal(amount) {
      maskPath.style.strokeDashoffset = String(1 - amount);
    }

    // smooth curve through every point (catmull-rom -> cubic bezier)
    function smoothPath(p) {
      var d = 'M' + p[0].x + ' ' + p[0].y;
      for (var i = 0; i < p.length - 1; i++) {
        var p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
        d += 'C' + (p1.x + (p2.x - p0.x) / 6) + ' ' + (p1.y + (p2.y - p0.y) / 6) + ' ' +
             (p2.x - (p3.x - p1.x) / 6) + ' ' + (p2.y - (p3.y - p1.y) / 6) + ' ' + p2.x + ' ' + p2.y;
      }
      return d;
    }

    function buildRoute() {
      var box = route.getBoundingClientRect();
      var marks = course.map(function (st) { return center(st.querySelector('.stage-marker'), box); });
      var amp = wide.matches ? 34 : (narrow.matches ? 12 : 26);

      // add a bend halfway between each pair of markers, pushed off to one side
      var pts = [marks[0]];
      for (var i = 1; i < marks.length; i++) {
        var a = marks[i - 1], b = marks[i];
        var tx = b.x - a.x, ty = b.y - a.y, len = Math.hypot(tx, ty) || 1;
        var nx = -ty / len, ny = tx / len, k = bends[(i - 1) % bends.length];
        var mid = { x: (a.x + b.x) / 2 + nx * amp * k, y: (a.y + b.y) / 2 + ny * amp * k };
        pts.push(mid, b);
      }
      var d = smoothPath(pts);
      routePath.setAttribute('d', d);
      maskPath.setAttribute('d', d);

      // stations: find a spot just off the line that doesn't touch any label or marker,
      // then connect it to the course with a short dotted leader (like a race-map symbol)
      leaders.innerHTML = '';
      var samples = [];
      var total = routePath.getTotalLength();
      for (var l = 0; l <= total; l += 5) samples.push(routePath.getPointAtLength(l));
      var blocks = course.map(function (st) {
        return [st.querySelector('.stage-marker'), st.querySelector('.stage-label')];
      }).reduce(function (all, pair) { return all.concat(pair); }, []).filter(Boolean).map(function (el) {
        var r = el.getBoundingClientRect();
        return { l: r.left - box.left, t: r.top - box.top, r: r.right - box.left, b: r.bottom - box.top };
      });
      var R = 20, GAP = 20;

      function nearest(x, y) {
        var best = null, bd = Infinity;
        samples.forEach(function (p) {
          var dd = Math.hypot(p.x - x, p.y - y);
          if (dd < bd) { bd = dd; best = p; }
        });
        return { p: best, d: bd };
      }

      stations.forEach(function (st) {
        st._leader = null;
        if (!wide.matches) { st.style.left = st.style.top = ''; return; }
        var k = Number(st.dataset.after), a = marks[k], b = marks[k + 1];
        if (!a || !b) return;
        var pick = null, pickScore = -Infinity;
        for (var fx = .2; fx <= .81; fx += .05) {
          for (var dy = -90; dy <= 90; dy += 4) {
            var x = a.x + (b.x - a.x) * fx, y = (a.y + b.y) / 2 + dy;
            var hit = blocks.some(function (r) {
              return x > r.l - R - 8 && x < r.r + R + 8 && y > r.t - R - 8 && y < r.b + R + 8;
            });
            if (hit) continue;
            var n = nearest(x, y), clear = n.d - R;
            if (clear < 8) continue;
            var score = -Math.abs(clear - GAP) - Math.abs(fx - .5) * 20;
            if (score > pickScore) { pickScore = score; pick = { x: x, y: y, near: n.p }; }
          }
        }
        if (!pick) return;
        st.style.left = pick.x + 'px';
        st.style.top = pick.y + 'px';
        var ux = pick.x - pick.near.x, uy = pick.y - pick.near.y, ul = Math.hypot(ux, uy) || 1;
        ux /= ul; uy /= ul;
        var leader = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        leader.setAttribute('d', 'M' + (pick.near.x + ux * 5) + ' ' + (pick.near.y + uy * 5) +
          'L' + (pick.x - ux * (R + 2)) + ' ' + (pick.y - uy * (R + 2)));
        leader.setAttribute('class', 'route-leader' + (st.classList.contains('is-reached') ? ' is-on' : ''));
        leaders.appendChild(leader);
        st._leader = leader;
      });

      stageY = stages.map(function (st) { return center(st.querySelector('.stage-marker'), box).y; });
      updateRoute();
    }

    function reach(st) {
      st.classList.add('is-reached');
      if (st._leader) st._leader.classList.add('is-on');
    }

    function reachAll() {
      stages.forEach(reach);
    }

    function drawAcross() {
      drawnAcross = true;
      var box = route.getBoundingClientRect();
      maskPath.style.transition = 'stroke-dashoffset 2.6s cubic-bezier(.45, .05, .35, 1)';
      requestAnimationFrame(function () { setReveal(1); });
      stages.forEach(function (st) {
        var frac = center(st.querySelector('.stage-marker'), box).x / box.width;
        setTimeout(function () { reach(st); }, 150 + frac * 2400);
      });
    }

    function updateRoute() {
      if (reduceMotion) { setReveal(1); reachAll(); return; }
      var box = route.getBoundingClientRect();
      if (wide.matches) {
        if (drawnAcross) { setReveal(1); return; }
        setReveal(0);
        if (box.top < window.innerHeight * 0.7) drawAcross();
        return;
      }
      maskPath.style.transition = '';
      var progress = Math.min(1, Math.max(0, (window.innerHeight * 0.75 - box.top) / box.height));
      setReveal(drawnAcross ? 1 : progress);
      var reachedY = progress * box.height + 24;
      stages.forEach(function (st, i) {
        if (drawnAcross || stageY[i] <= reachedY) reach(st);
      });
    }

    if (!reduceMotion) route.classList.add('is-animated');
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { updateRoute(); ticking = false; });
    }, { passive: true });
    window.addEventListener('resize', buildRoute);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(buildRoute);
    window.addEventListener('load', buildRoute);
    buildRoute();
  }
})();
