/* app.js - SVG cube rendering + page wiring. Requires cube.js (global Cube). */
(function () {
  'use strict';
  var COLORS = { w: '#f8f8f8', y: '#ffd500', g: '#009b48', b: '#0046ad', o: '#ff5800', r: '#b71234' };
  var INK = '#20242b';
  function mix(hex, other, t) {
    function p(h){return [parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];}
    var a=p(hex), c=p(other);
    return 'rgb('+a.map(function(v,i){return Math.round(v+(c[i]-v)*t);}).join(',')+')';
  }
  function stickerFill(ch, dimmed) {
    var base = COLORS[ch] || '#ccc';
    return dimmed ? mix(base, '#e9e9ee', 0.72) : base;
  }
  function poly(points, fill, stroke) {
    return '<polygon points="' + points.map(function(p){return p[0].toFixed(1)+','+p[1].toFixed(1);}).join(' ') +
      '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.4" stroke-linejoin="round"/>';
  }
  /* ---------- flat net ---------- */
  function netSVG(state, opts) {
    opts = opts || {};
    var S = opts.tile || 22, G = 3, FG = 9;
    var faceAt = { U: [1, 0], L: [0, 1], F: [1, 1], R: [2, 1], B: [3, 1], D: [1, 2] };
    var fw = 3 * S + 2 * G;
    var W = 4 * fw + 5 * FG, H = 3 * fw + 4 * FG;
    var parts = [];
    Object.keys(faceAt).forEach(function (f) {
      var ox = FG + faceAt[f][0] * (fw + FG), oy = FG + faceAt[f][1] * (fw + FG);
      for (var i = 0; i < 9; i++) {
        var r = Math.floor(i / 3), c = i % 3;
        var x = ox + c * (S + G), y = oy + r * (S + G);
        var dim = opts.dim && opts.dim(f, i);
        parts.push('<rect x="' + x + '" y="' + y + '" width="' + S + '" height="' + S + '" rx="3" fill="' +
          stickerFill(state[f][i], dim) + '" stroke="' + INK + '" stroke-width="1.2"/>');
      }
      if (opts.labels) {
        parts.push('<text x="' + (ox + fw / 2) + '" y="' + (oy + fw / 2 + 4) + '" text-anchor="middle" font-size="12" font-weight="700" fill="rgba(20,20,30,.42)" font-family="inherit">' + f + '</text>');
      }
    });
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="cubesvg net" role="img">' + parts.join('') + '</svg>';
  }
  /* ---------- isometric U/F/R ---------- */
  var S = 24, DX = S * 0.55, DY = -S * 0.46;
  function isoGeom() {
    var m = 8;
    var fx = m, fy = m + 3 * (-DY);
    return { m: m, fx: fx, fy: fy, w: 3 * S + 3 * DX + 2 * m, h: 3 * S + 3 * (-DY) + 2 * m };
  }
  function isoTilePts(f, i) {
    var g = isoGeom(), r = Math.floor(i / 3), c = i % 3;
    if (f === 'F') {
      var x = g.fx + c * S, y = g.fy + r * S;
      return [[x, y], [x + S, y], [x + S, y + S], [x, y + S]];
    }
    if (f === 'U') {
      var ax = g.fx + c * S + (2 - r) * DX, ay = g.fy + (2 - r) * DY;
      return [[ax, ay], [ax + S, ay], [ax + S + DX, ay + DY], [ax + DX, ay + DY]];
    }
    if (f === 'R') {
      var bx = g.fx + 3 * S + c * DX, by = g.fy + r * S + c * DY;
      return [[bx, by], [bx + DX, by + DY], [bx + DX, by + DY + S], [bx, by + S]];
    }
    return null;
  }
  var ISO_CENTERS = {
    F: function () { var g = isoGeom(); return { c: [g.fx + 1.5 * S, g.fy + 1.5 * S], eu: [S, 0], ev: [0, S] }; },
    U: function () { var g = isoGeom(); return { c: [g.fx + 1.5 * S + 1.5 * DX, g.fy + 1.5 * DY], eu: [S, 0], ev: [-DX, -DY] }; },
    R: function () { var g = isoGeom(); return { c: [g.fx + 3 * S + 1.5 * DX, g.fy + 1.5 * S + 1.5 * DY], eu: [DX, DY], ev: [0, S] }; }
  };
  function arrowSVG(face, dir) {
    var def = ISO_CENTERS[face]();
    var rad = 2.05, pts = [], a0 = -115, a1 = 130, steps = 40, k;
    var span = (a1 - a0) * (dir === 'ccw' ? -1 : 1);
    for (k = 0; k <= steps; k++) {
      var th = (a0 + span * k / steps) * Math.PI / 180;
      pts.push([def.c[0] + rad * (Math.cos(th) * def.eu[0] + Math.sin(th) * def.ev[0]),
                def.c[1] + rad * (Math.cos(th) * def.eu[1] + Math.sin(th) * def.ev[1])]);
    }
    var path = 'M' + pts.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' L');
    var e = pts[pts.length - 1], p = pts[pts.length - 4];
    var dx = e[0] - p[0], dy = e[1] - p[1], len = Math.hypot(dx, dy);
    dx /= len; dy /= len;
    var hl = 11, ang = 0.55;
    function wing(sign) {
      var ca = Math.cos(sign * ang), sa = Math.sin(sign * ang);
      return [e[0] - hl * (dx * ca - dy * sa), e[1] - hl * (dx * sa + dy * ca)];
    }
    var w1 = wing(1), w2 = wing(-1);
    return '<path d="' + path + '" fill="none" stroke="' + INK + '" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M' + w1[0].toFixed(1) + ' ' + w1[1].toFixed(1) + ' L' + e[0].toFixed(1) + ' ' + e[1].toFixed(1) +
      ' L' + w2[0].toFixed(1) + ' ' + w2[1].toFixed(1) + '" fill="none" stroke="' + INK + '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>';
  }
  function isoSVG(state, opts) {
    opts = opts || {};
    var g = isoGeom(), parts = [];
    ['U', 'F', 'R'].forEach(function (f) {
      for (var i = 0; i < 9; i++) {
        var dim = opts.dim && opts.dim(f, i);
        parts.push(poly(isoTilePts(f, i), stickerFill(state[f][i], dim), INK));
      }
    });
    if (opts.arrow) parts.push(arrowSVG(opts.arrow.face, opts.arrow.dir));
    return '<svg viewBox="0 0 ' + g.w.toFixed(0) + ' ' + g.h.toFixed(0) + '" class="cubesvg iso" role="img">' + parts.join('') + '</svg>';
  }
  /* ---------- state helpers ---------- */
  function llBase() { var s = Cube.solvedState(); Cube.applyAlg(s, 'x2'); return s; }
  function buildState(el) {
    var base = el.getAttribute('data-base') === 'll' ? llBase() : Cube.solvedState();
    var apply = el.getAttribute('data-apply');
    var invert = el.getAttribute('data-invert') === '1';
    if (apply) Cube.applyAlg(base, invert ? Cube.invertAlg(apply) : apply);
    return base;
  }
  var DIMS = {
    'centers-only': function (f, i) { return i !== 4; },
    'edges-only': function (f, i) { return [1,3,5,7].indexOf(i) < 0; },
    oll: function (f, i) { // only U face + top rows matter
      if (f === 'U') return false;
      if ('FRBL'.indexOf(f) >= 0) return Math.floor(i / 3) !== 0;
      return true;
    },
    llSide: function (f, i) { // iso: U face + top rows of F,R
      if (f === 'U') return false;
      return Math.floor(i / 3) !== 0;
    }
  };
  function layerDim(move) {
    var ALL = [0,1,2,3,4,5,6,7,8];
    var layers = {
      R: { R: ALL, U: [2,5,8], F: [2,5,8], D: [2,5,8], B: [0,3,6] },
      L: { L: ALL, U: [0,3,6], F: [0,3,6], D: [0,3,6], B: [2,5,8] },
      U: { U: ALL, F: [0,1,2], R: [0,1,2], B: [0,1,2], L: [0,1,2] },
      D: { D: ALL, F: [6,7,8], R: [6,7,8], B: [6,7,8], L: [6,7,8] },
      F: { F: ALL, U: [6,7,8], R: [0,3,6], D: [0,1,2], L: [2,5,8] },
      B: { B: ALL, U: [0,1,2], R: [2,5,8], D: [6,7,8], L: [0,3,6] },
      Rw: { R: ALL, U: [1,2,4,5,7,8], F: [1,2,4,5,7,8], D: [1,2,4,5,7,8], B: [0,1,3,4,6,7] },
      M: { U: [1,4,7], F: [1,4,7], D: [1,4,7], B: [1,4,7] },
      E: { F: [3,4,5], R: [3,4,5], B: [3,4,5], L: [3,4,5] },
      S: { U: [3,4,5], R: [1,4,7], D: [3,4,5], L: [1,4,7] },
      x: { R: ALL, U: ALL, F: ALL, D: ALL, B: ALL, L: ALL },
      y: { R: ALL, U: ALL, F: ALL, D: ALL, B: ALL, L: ALL },
      z: { R: ALL, U: ALL, F: ALL, D: ALL, B: ALL, L: ALL }
    };
    var keep = layers[move] || {};
    return function (f, i) { return !(keep[f] && keep[f].indexOf(i) >= 0); };
  }
  /* ---------- hydrate ---------- */
  function hydrate() {
    document.querySelectorAll('[data-cube]').forEach(function (el) {
      var view = el.getAttribute('data-cube');
      var state = buildState(el);
      var opts = {};
      var dimName = el.getAttribute('data-dim');
      if (dimName) opts.dim = DIMS[dimName] || layerDim(dimName);
      if (el.getAttribute('data-labels') === '1') opts.labels = true;
      if (view === 'iso') {
        var arrow = el.getAttribute('data-arrow');
        if (arrow) {
          var dir = /'$/.test(arrow) ? 'ccw' : 'cw';
          var face = arrow.replace(/[w2']/g, '');
          if (face === 'x') face = 'R';
          if (face === 'y') face = 'U';
          if (face === 'M' || face === 'Rw') face = 'R';
          opts.arrow = { face: face, dir: dir };
        }
        el.innerHTML = isoSVG(state, opts);
      } else {
        el.innerHTML = netSVG(state, opts);
      }
    });
    // before/after pairs
    document.querySelectorAll('[data-pair]').forEach(function (el) {
      var alg = el.getAttribute('data-pair');
      var before = buildState(el);
      var after = Cube.clone(before);
      Cube.applyAlg(after, alg);
      var dimName = el.getAttribute('data-dim');
      var opts = {};
      if (dimName) opts.dim = DIMS[dimName] || layerDim(dimName);
      var view = el.getAttribute('data-view') || 'iso';
      var mk = view === 'net' ? netSVG : isoSVG;
      el.innerHTML =
        '<div class="pair"><figure>' + mk(before, opts) + '<figcaption>before</figcaption></figure>' +
        '<div class="pairarrow">&#8594;</div>' +
        '<figure>' + mk(after, opts) + '<figcaption>after ' + alg + '</figcaption></figure></div>';
    });
    // glossary filter
    var gf = document.getElementById('glossary-filter');
    if (gf) {
      gf.addEventListener('input', function () {
        var q = gf.value.trim().toLowerCase();
        document.querySelectorAll('#glossary dt').forEach(function (dt) {
          var dd = dt.nextElementSibling;
          var hit = !q || (dt.textContent + ' ' + (dd ? dd.textContent : '')).toLowerCase().indexOf(q) >= 0;
          dt.style.display = hit ? '' : 'none';
          if (dd && dd.tagName === 'DD') dd.style.display = hit ? '' : 'none';
        });
      });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hydrate);
  else hydrate();
})();
