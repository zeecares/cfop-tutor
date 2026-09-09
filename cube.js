/* cube.js - 3x3 cube engine, geometrically derived.
   Faces U D F B L R, 9 stickers each, row-major as seen looking directly at
   that face from outside with U on top and F facing you:
     U: rows B->F, cols L->R.   D: rows F->B, cols L->R.
     F: rows U->D, cols L->R.   B: rows U->D, cols R->L (seen from behind).
     L: rows U->D, cols B->F.   R: rows U->D, cols F->B.
   Every sticker maps to (position, normal) in coords x:R+ y:U+ z:F+.
   A face turn = -90 deg rotation of that layer about the outward normal axis.
   Moves are computed, not hand-tabulated. */
(function (global) {
  'use strict';
  var FACES = ['U', 'D', 'F', 'B', 'L', 'R'];
  var SOLVED_COLORS = { U: 'w', D: 'y', F: 'g', B: 'b', L: 'o', R: 'r' };

  // index -> (pos, normal)
  var COORDS = [];
  function key(p, n) { return p.join(',') + '|' + n.join(','); }
  (function build() {
    var defs = {
      U: function (r, c) { return { p: [c - 1, 1, r - 1], n: [0, 1, 0] }; },
      D: function (r, c) { return { p: [c - 1, -1, 1 - r], n: [0, -1, 0] }; },
      F: function (r, c) { return { p: [c - 1, 1 - r, 1], n: [0, 0, 1] }; },
      B: function (r, c) { return { p: [1 - c, 1 - r, -1], n: [0, 0, -1] }; },
      L: function (r, c) { return { p: [-1, 1 - r, c - 1], n: [-1, 0, 0] }; },
      R: function (r, c) { return { p: [1, 1 - r, 1 - c], n: [1, 0, 0] }; }
    };
    FACES.forEach(function (f) {
      for (var i = 0; i < 9; i++) {
        COORDS.push(defs[f](Math.floor(i / 3), i % 3));
      }
    });
  })();
  var LOOKUP = {};
  COORDS.forEach(function (c, i) { LOOKUP[key(c.p, c.n)] = i; });

  function rot90(v, axis, sign) {
    // 90-degree rotation of vector v about unit axis ('x','y','z'), sign=+1 CCW
    // viewed from positive axis end (right-hand rule), sign=-1 CW.
    var x = v[0], y = v[1], z = v[2];
    if (axis === 'x') return sign > 0 ? [x, -z, y] : [x, z, -y];
    if (axis === 'y') return sign > 0 ? [z, y, -x] : [-z, y, x];
    return sign > 0 ? [-y, x, z] : [y, -x, z];
  }
  // move defs: layer test + rotation. CW from outside = sign -1 about outward normal.
  var MOVE_DEFS = {
    R: { axis: 'x', layer: 1, sign: -1 }, L: { axis: 'x', layer: -1, sign: 1 },
    U: { axis: 'y', layer: 1, sign: -1 }, D: { axis: 'y', layer: -1, sign: 1 },
    F: { axis: 'z', layer: 1, sign: -1 }, B: { axis: 'z', layer: -1, sign: 1 },
    M: { axis: 'x', layer: 0, sign: 1 },  // follows L
    E: { axis: 'y', layer: 0, sign: 1 },  // follows D
    S: { axis: 'z', layer: 0, sign: -1 }  // follows F
  };
  var AXIS_IDX = { x: 0, y: 1, z: 2 };
  // PERM[m][dest] = src index (sticker that moves INTO dest)
  var PERM = {};
  Object.keys(MOVE_DEFS).forEach(function (m) {
    var d = MOVE_DEFS[m], ai = AXIS_IDX[d.axis];
    var srcOf = new Array(54);
    for (var i = 0; i < 54; i++) {
      var c = COORDS[i];
      if (c.p[ai] !== d.layer) { srcOf[i] = i; continue; }
      var np = rot90(c.p, d.axis, d.sign), nn = rot90(c.n, d.axis, d.sign);
      var dest = LOOKUP[key(np, nn)];
      srcOf[dest] = i; // sticker i moves to dest
    }
    PERM[m] = srcOf;
  });

  function solvedState() {
    var s = {};
    FACES.forEach(function (f) {
      s[f] = [];
      for (var i = 0; i < 9; i++) s[f].push(SOLVED_COLORS[f]);
    });
    return s;
  }
  function clone(s) {
    var c = {};
    FACES.forEach(function (f) { c[f] = s[f].slice(); });
    return c;
  }
  function equals(a, b) {
    return FACES.every(function (f) {
      for (var i = 0; i < 9; i++) if (a[f][i] !== b[f][i]) return false;
      return true;
    });
  }
  function flat(s) {
    return FACES.reduce(function (acc, f) { return acc.concat(s[f]); }, []);
  }
  function unflat(arr) {
    var s = {};
    FACES.forEach(function (f, k) { s[f] = arr.slice(k * 9, k * 9 + 9); });
    return s;
  }
  function applyOnce(s, letter) {
    var p = PERM[letter], arr = flat(s), out = new Array(54);
    for (var d = 0; d < 54; d++) out[d] = arr[p[d]];
    var ns = unflat(out);
    FACES.forEach(function (f) { s[f] = ns[f]; });
  }
  function applyToken(s, tok) {
    var suffix = '';
    if (/[']$/.test(tok)) { suffix = "'"; tok = tok.slice(0, -1); }
    else if (/2$/.test(tok)) { suffix = '2'; tok = tok.slice(0, -1); }
    if (tok.length === 1 && 'rulfdb'.indexOf(tok) >= 0) tok = tok.toUpperCase() + 'w';
    var seq = [];
    if (tok.length === 2 && tok[1] === 'w') {
      var f = tok[0];
      if (f === 'R') seq = ['R', "M'"]; else if (f === 'L') seq = ['L', 'M'];
      else if (f === 'U') seq = ['U', "E'"]; else if (f === 'D') seq = ['D', 'E'];
      else if (f === 'F') seq = ['F', 'S']; else if (f === 'B') seq = ['B', "S'"];
      else throw new Error('bad wide ' + tok);
    } else if (tok === 'x') seq = ['R', "M'", "L'"];
    else if (tok === 'y') seq = ['U', "E'", "D'"];
    else if (tok === 'z') seq = ['F', 'S', "B'"];
    else if (tok.length === 1 && MOVE_DEFS[tok]) seq = [tok];
    else throw new Error('bad token ' + tok);
    var expanded = [];
    seq.forEach(function (sub) {
      var n = 1;
      if (/'$/.test(sub)) { n = 3; sub = sub.slice(0, -1); }
      else if (/2$/.test(sub)) { n = 2; sub = sub.slice(0, -1); }
      for (var i = 0; i < n; i++) expanded.push(sub);
    });
    var times = suffix === '2' ? 2 : (suffix === "'" ? 3 : 1);
    for (var t = 0; t < times; t++) expanded.forEach(function (m) { applyOnce(s, m); });
  }
  function applyAlg(s, alg) {
    alg.trim().split(/\s+/).forEach(function (tok) { if (tok) applyToken(s, tok); });
    return s;
  }
  function invertAlg(alg) {
    return alg.trim().split(/\s+/).reverse().map(function (tok) {
      if (/'$/.test(tok)) return tok.slice(0, -1);
      if (/2$/.test(tok)) return tok;
      return tok + "'";
    }).join(' ');
  }
  var api = {
    solvedState: solvedState, clone: clone, equals: equals,
    applyAlg: applyAlg, invertAlg: invertAlg, FACES: FACES,
    COLORS: SOLVED_COLORS
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.Cube = api;
})(typeof window !== 'undefined' ? window : globalThis);
