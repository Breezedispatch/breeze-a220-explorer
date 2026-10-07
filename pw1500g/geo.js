/* PW1500G model: geometry helpers.
   Units are metres. The engine axis is x with +x FORWARD; y is up; z is the engine's RIGHT side seen aft looking forward,
   so a clock position h (ALF) sits at angle h * 30 deg from +y toward +z. */
(function () {
  const G = window.PWGeo = {};
  const TAU = Math.PI * 2;
  G.TAU = TAU;
  G.clock = h => h * Math.PI / 6;                                   // clock hour (aft looking forward) -> angle from +y toward +z
  G.onRing = (x, r, a) => new THREE.Vector3(x, r * Math.cos(a), r * Math.sin(a));
  G.lerp = (a, b, t) => a + (b - a) * t;
  /* piecewise-linear lookup in a table of [x, v] pairs (x in any order) */
  G.interp = (tab, x) => {
    const T = tab[0][0] > tab[tab.length - 1][0] ? tab : tab.slice().reverse();      // descending x
    if (x >= T[0][0]) return T[0][1];
    for (let i = 1; i < T.length; i++) if (x >= T[i][0]) { const [x0, v0] = T[i - 1], [x1, v1] = T[i]; return v0 + (v1 - v0) * (x0 - x) / ((x0 - x1) || 1); }
    return T[T.length - 1][1];
  };

  /* ---- revolve a profile of [x, r] points about the x axis ----
     A closed profile makes a watertight ring solid (needed for the section-cut caps); an open one makes a surface.
     Normals are smooth across profile vertices that turn less than the crease angle, and hard at sharper corners. */
  G.revolve = function (pts, opts) {
    opts = opts || {};
    const seg = opts.seg || 96, crease = (opts.crease === undefined ? 35 : opts.crease) * Math.PI / 180;
    const closed = !opts.open && pts.length > 2, t0 = opts.thetaStart || 0, tl = opts.thetaLength || TAU;
    let P = pts.map(p => [p[0], Math.max(0, p[1])]);
    if (closed) { let a = 0; for (let i = 0; i < P.length; i++) { const [x0, r0] = P[i], [x1, r1] = P[(i + 1) % P.length]; a += x0 * r1 - x1 * r0; } if (a < 0) P = P.reverse(); }
    else if (opts.flip) P = P.slice().reverse();
    const n = P.length, sc = closed ? n : n - 1;
    const sn = []; for (let i = 0; i < sc; i++) { const [x0, r0] = P[i], [x1, r1] = P[(i + 1) % n]; const dx = x1 - x0, dr = r1 - r0, L = Math.hypot(dx, dr) || 1; sn.push([dr / L, -dx / L]); }
    const cc = Math.cos(crease);
    const endN = (i, end) => {
      const a = sn[i]; let j = end ? i + 1 : i - 1;
      if (closed) j = (j + sc) % sc; else if (j < 0 || j >= sc) return a;
      const b = sn[j]; if (a[0] * b[0] + a[1] * b[1] < cc) return a;
      const m = [a[0] + b[0], a[1] + b[1]], L = Math.hypot(m[0], m[1]) || 1; return [m[0] / L, m[1] / L]; };
    const acc = [0]; for (let i = 0; i < sc; i++) { const [x0, r0] = P[i], [x1, r1] = P[(i + 1) % n]; acc.push(acc[i] + Math.hypot(x1 - x0, r1 - r0)); }
    const pos = [], nor = [], uv = [], idx = [];
    for (let i = 0; i < sc; i++) {
      const A = P[i], B = P[(i + 1) % n], nA = endN(i, 0), nB = endN(i, 1), base = pos.length / 3;
      for (let j = 0; j <= seg; j++) {
        const th = t0 + tl * j / seg, c = Math.cos(th), s = Math.sin(th);
        pos.push(A[0], A[1] * c, A[1] * s, B[0], B[1] * c, B[1] * s);
        nor.push(nA[0], nA[1] * c, nA[1] * s, nB[0], nB[1] * c, nB[1] * s);
        uv.push(j / seg, acc[i], j / seg, acc[i + 1]);
      }
      for (let j = 0; j < seg; j++) { const a = base + j * 2, b = a + 1, a1 = a + 2, b1 = a + 3; idx.push(a, b, a1, a1, b, b1); }
    }
    if (closed && tl < TAU - 1e-6 && opts.caps !== false) {                  // a part-revolution (a cowl door, a sector): close its two ends
      const contour = P.map(p => new THREE.Vector2(p[0], p[1])), tris = THREE.ShapeUtils.triangulateShape(contour, []);
      for (const [th, sgn] of [[t0, -1], [t0 + tl, 1]]) {
        const c = Math.cos(th), s = Math.sin(th), nx = 0, ny = -Math.sin(th) * sgn, nz = Math.cos(th) * sgn, base = pos.length / 3;
        for (const p of P) { pos.push(p[0], p[1] * c, p[1] * s); nor.push(nx, ny, nz); uv.push(p[0], p[1]); }
        for (const t of tris) sgn > 0 ? idx.push(base + t[0], base + t[1], base + t[2]) : idx.push(base + t[0], base + t[2], base + t[1]);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.userData.solid = closed;
    return g;
  };
  /* a wall of thickness between an outer and an inner line, both given forward to aft as [x, r] */
  G.shellProfile = (outer, inner) => outer.concat(inner.slice().reverse());
  /* a ring of rectangular section: flanges, lands, bands */
  G.ring = (x0, x1, r0, r1, opts) => G.revolve([[x0, r0], [x1, r0], [x1, r1], [x0, r1]], Object.assign({ crease: 30 }, opts));
  /* a thin-walled cone or cylinder frustum with real thickness, x0 forward */
  G.frustum = (x0, x1, rOut0, rOut1, t, opts) => G.revolve([[x0, rOut0], [x1, rOut1], [x1, rOut1 - t], [x0, rOut0 - t]], Object.assign({ crease: 30 }, opts));

  /* ---- aerofoil blades ----
     A section is a cambered aerofoil (NACA-style thickness) laid on the cylinder of its radius. Each section gives:
     r (m), xle (axial position of the leading edge, m), chord (m), stagger (rad, chord angle from the engine axis; positive turns
     the trailing edge toward +theta), camber (fraction of chord), thick (t/c), lean (tangential shift of the leading edge, m).
     The blade is built at theta = 0 (the +y axis); instancing rotates it round the ring. */
  const thk = u => 0.2969 * Math.sqrt(u) - 0.1260 * u - 0.3516 * u * u + 0.2843 * u * u * u - 0.1036 * u * u * u * u;   // closed trailing edge
  G.blade = function (sections, opts) {
    opts = opts || {};
    /* opts.uMax < 1 builds only the forward part of the chord (a leading-edge sheath), opts.inflate thickens it so it sits proud */
    const m = opts.chordPts || 18, dir = opts.dir || 1, uMax = opts.uMax || 1, partial = uMax < 1, inflate = opts.inflate || 1;
    const us = []; for (let i = 0; i <= m; i++) { const t = i / m; us.push(partial ? uMax * (1 - Math.cos(Math.PI * t / 2)) : (1 - Math.cos(Math.PI * t)) / 2); }   // cosine spacing: fine at LE and TE
    const ring = s => {                                                     // closed loop: TE -> suction side -> LE -> pressure side -> TE
      const out = [], c = s.chord, g = s.stagger * dir, e1 = [-Math.cos(g), Math.sin(g)], e2 = [Math.sin(g), Math.cos(g)];
      const pt = (u, v) => { const ax = s.xle + (u * e1[0] + v * e2[0]) * c, w = (s.lean || 0) + (u * e1[1] + v * e2[1]) * c, a = w / s.r;
        return [ax, s.r * Math.cos(a), s.r * Math.sin(a)]; };
      const half = u => (s.thick || .08) * 5 * thk(u) * inflate;            // NACA half-thickness as a fraction of chord (thick = t/c)
      const cam = u => (s.camber || 0) * 4 * u * (1 - u) * dir;
      for (let i = m; i >= 0; i--) out.push(pt(us[i], cam(us[i]) + half(us[i])));
      for (let i = 1; i < (partial ? m + 1 : m); i++) out.push(pt(us[i], cam(us[i]) - half(us[i])));
      return out; };
    const rings = sections.map(ring), L = rings[0].length, pos = [], idx = [];
    for (const R of rings) for (const p of R) pos.push(p[0], p[1], p[2]);
    for (let k = 0; k < rings.length - 1; k++) for (let i = 0; i < L; i++) {
      const a = k * L + i, b = k * L + (i + 1) % L, c = a + L, d = b + L; idx.push(a, c, b, b, c, d); }
    const cap = (R, flip) => {                                              // strip between the two sides, with its own vertices (flat)
      const base = pos.length / 3; for (const p of R) pos.push(p[0], p[1], p[2]);
      // upper side indices 0..m (TE..LE), lower side m+1..2m-1 (after LE back to TE); pair upper[i] with lower
      const up = i => i, lo = i => (i === 0 && !partial ? 0 : i === m ? m : 2 * m - i);   // lower point at the same chord station as upper[i]
      for (let i = 0; i < m; i++) {
        const a = base + up(i), b = base + up(i + 1), c = base + lo(i), d = base + lo(i + 1);
        if (c !== a) flip ? idx.push(a, c, b) : idx.push(a, b, c);
        if (d !== b) flip ? idx.push(b, c, d) : idx.push(b, d, c);
      } };
    cap(rings[0], false); cap(rings[rings.length - 1], true);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    G.orientOutward(g); g.computeVertexNormals(); g.userData.solid = true;
    return g;
  };
  /* make a closed mesh's triangles face outward (positive signed volume) */
  G.orientOutward = g => {
    const p = g.attributes.position.array, ix = g.index.array; let v = 0;
    for (let i = 0; i < ix.length; i += 3) { const a = ix[i] * 3, b = ix[i + 1] * 3, c = ix[i + 2] * 3;
      v += p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) - p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c]) + p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c]); }
    if (v < 0) { for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } g.index.needsUpdate = true; }
    return g;
  };
  /* make a flat cap's triangles face along d */
  G.orientCap = (g, d) => {
    const p = g.attributes.position.array, ix = g.index.array, A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
    for (let i = 0; i < ix.length; i += 3) { A.fromArray(p, ix[i] * 3); B.fromArray(p, ix[i + 1] * 3).sub(A); C.fromArray(p, ix[i + 2] * 3).sub(A);
      if (B.cross(C).dot(d) < 0) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } }
    return g;
  };
  /* blade sections from simple root/tip values, linearly blended (with optional per-station overrides) */
  G.sections = (o) => {
    const n = o.n || 8, out = [];
    for (let k = 0; k <= n; k++) { const t = k / n, f = (a, b) => (typeof a === 'function' ? a(t) : a + (b - a) * t);
      out.push({ r: f(o.rHub, o.rTip), xle: f(o.xleHub, o.xleTip), chord: f(o.cHub, o.cTip), stagger: f(o.gHub, o.gTip),
        camber: f(o.camHub || 0, o.camTip || 0), thick: f(o.tHub || .09, o.tTip || .05), lean: f(o.leanHub || 0, o.leanTip || 0) }); }
    return out;
  };
  /* N copies of a geometry round the axis, as one instanced mesh (cheap to draw, raycastable per instance) */
  G.ringInstances = (geo, mat, n, opts) => {
    opts = opts || {};
    /* an axial offset is baked into the geometry (rotations about x leave x alone), so the mesh's bounding box sits where the ring is */
    if (opts.x) { const s = geo.userData.solid; geo = geo.clone(); geo.translate(opts.x, 0, 0); geo.userData.solid = s; }
    const im = new THREE.InstancedMesh(geo, mat, n), q = new THREE.Quaternion(), m4 = new THREE.Matrix4(), ax = new THREE.Vector3(1, 0, 0), one = new THREE.Vector3(1, 1, 1), off = new THREE.Vector3(0, 0, 0);
    for (let i = 0; i < n; i++) { q.setFromAxisAngle(ax, (opts.phase || 0) + i / n * TAU); m4.compose(off, q, one); im.setMatrixAt(i, m4); }
    im.instanceMatrix.needsUpdate = true; im.userData.solid = !!geo.userData.solid;
    return im;
  };

  /* ---- tubes, hoses and harnesses routed through points ----
     Waypoints are [x, y, z]. A tube is closed at both ends so it stays watertight for the section caps. */
  G.curve = (pts, tension) => new THREE.CatmullRomCurve3(pts.map(p => (p.isVector3 ? p : new THREE.Vector3(p[0], p[1], p[2]))), false, 'catmullrom', tension === undefined ? .2 : tension);
  G.tube = function (pts, r, opts) {
    opts = opts || {};
    const curve = pts.getPointAt ? pts : G.curve(pts, opts.tension), L = curve.getLength();
    const ts = opts.seg || Math.max(8, Math.ceil(L / .03)), rs = opts.radial || 12;
    const tg = new THREE.TubeGeometry(curve, ts, r, rs, false), TP = tg.attributes.position.array;
    /* end caps fanned from the tube's own end rings, so the seam is closed exactly */
    const caps = [0, 1].map(t => { const ring = t ? ts : 0, p = curve.getPointAt(t), d = curve.getTangentAt(t).multiplyScalar(t ? 1 : -1), pos = [p.x, p.y, p.z], nor = [d.x, d.y, d.z], ix = [];
      for (let j = 0; j <= rs; j++) { const k = (ring * (rs + 1) + j) * 3; pos.push(TP[k], TP[k + 1], TP[k + 2]); nor.push(d.x, d.y, d.z); }
      for (let j = 1; j <= rs; j++) ix.push(0, j, j + 1);
      const c = new THREE.BufferGeometry(); c.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); c.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); c.setIndex(ix);
      c.userData.solid = true; return G.orientCap(c, d); });
    const g = G.merge([tg, caps[0], caps[1]]); g.userData.solid = true; g.userData.curve = curve;
    return g;
  };
  /* rings spaced along a curve (clamps, braid ferrules, B-nuts) */
  G.alongCurve = (curve, ts, makeGeo) => G.merge(ts.map(t => { const g = makeGeo(t), p = curve.getPointAt(t), d = curve.getTangentAt(t);
    g.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d))); g.translate(p.x, p.y, p.z); return g; }));
  /* a cylinder between two points (struts, links, rods) */
  G.rod = (a, b, r, opts) => { opts = opts || {}; a = a.isVector3 ? a : new THREE.Vector3(...a); b = b.isVector3 ? b : new THREE.Vector3(...b);
    const L = a.distanceTo(b), g = new THREE.CylinderGeometry(opts.r1 === undefined ? r : opts.r1, r, L, opts.radial || 12, 1, false);
    g.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())));
    g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); g.userData.solid = true; return g; };

  /* ---- a fairing lofted through rounded-box sections along x (pylons, bifurcations) ----
     sections: [{ x, yb, yt, hw }] (bottom, top, half-width); each section is a superellipse, closed at both ends */
  G.loft = (sections, opts) => {
    opts = opts || {}; const n = opts.n || 36, ex = opts.exp || 5, pos = [], idx = [];
    const ring = s => { const out = [], cy = (s.yb + s.yt) / 2, hh = Math.max(1e-4, (s.yt - s.yb) / 2);
      for (let i = 0; i < n; i++) { const a = i / n * TAU, c = Math.cos(a), sn = Math.sin(a);
        out.push([s.x, cy + hh * Math.sign(sn) * Math.pow(Math.abs(sn), 2 / ex), s.hw * Math.sign(c) * Math.pow(Math.abs(c), 2 / ex)]); } return out; };
    sections.forEach(s => ring(s).forEach(p => pos.push(...p)));
    for (let k = 0; k < sections.length - 1; k++) for (let i = 0; i < n; i++) { const a = k * n + i, b = k * n + (i + 1) % n, c = a + n, d = b + n; idx.push(a, c, b, b, c, d); }
    for (const [k, flip] of [[0, false], [sections.length - 1, true]]) { const s = sections[k], base = pos.length / 3; pos.push(s.x, (s.yb + s.yt) / 2, 0);
      for (let i = 0; i < n; i++) flip ? idx.push(base, k * n + i, k * n + (i + 1) % n) : idx.push(base, k * n + (i + 1) % n, k * n + i); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    G.orientOutward(g); g.computeVertexNormals(); g.userData.solid = true; return g;
  };

  /* ---- boxes with rounded edges (castings, LRU housings, brackets) ---- */
  G.roundedBox = (w, h, d, r, seg) => {
    r = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4); seg = seg || 3;
    const s = new THREE.Shape(), x = -w / 2 + r, y = -h / 2 + r, W = w - 2 * r, H = h - 2 * r;
    s.moveTo(x, -h / 2); s.lineTo(x + W, -h / 2); s.absarc(x + W, y, r, -Math.PI / 2, 0); s.lineTo(w / 2, y + H); s.absarc(x + W, y + H, r, 0, Math.PI / 2);
    s.lineTo(x, h / 2); s.absarc(x, y + H, r, Math.PI / 2, Math.PI); s.lineTo(-w / 2, y); s.absarc(x, y, r, Math.PI, Math.PI * 1.5);
    const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(1e-4, d - 2 * r), bevelEnabled: true, bevelThickness: r, bevelSize: r * .999, bevelSegments: seg, curveSegments: seg * 2 });
    g.translate(0, 0, -(d - 2 * r) / 2);
    /* the bevel grows the outline by r all round: scale back so the box is exactly w x h x d (until 2026-10-07 every rounded box came out 2r too big) */
    g.computeBoundingBox(); const bb = g.boundingBox; g.scale(w / (bb.max.x - bb.min.x), h / (bb.max.y - bb.min.y), d / (bb.max.z - bb.min.z));
    g.computeVertexNormals(); const out = G.merge([g]); out.userData.solid = true; return out;
  };
  /* a cylinder along x with rounded or chamfered ends (pumps, generators, filter bowls); r and length in metres */
  G.can = (r, len, opts) => { opts = opts || {}; const e = Math.min(opts.edge === undefined ? r * .12 : opts.edge, len / 2.2), x0 = len / 2, x1 = -len / 2;
    const pts = [[x0, 0], [x0, r - e], [x0 - e * .3, r - e * .3], [x0 - e, r], [x1 + e, r], [x1 + e * .3, r - e * .3], [x1, r - e], [x1, 0]];
    return G.revolve(pts, { seg: opts.seg || 32, crease: 50 }); };

  /* hexagon bolt heads round a flange: one instanced mesh. Bolts point along +x (axial) unless radial is set. */
  G.boltGeo = (s) => { const g = new THREE.CylinderGeometry(s, s, s * .7, 6); g.rotateZ(-Math.PI / 2); g.userData.solid = true; return g; };
  G.boltCircle = (mat, x, r, n, size, opts) => {
    /* the bolt's own turn and the axial position are baked into the geometry, so instances only turn about x and the bounding box is true */
    opts = opts || {}; const geo = (opts.geo || G.boltGeo(size || .006)).clone(); if (opts.radial) geo.rotateZ(Math.PI / 2); geo.translate(x, 0, 0); geo.userData.solid = true;
    const im = new THREE.InstancedMesh(geo, mat, n), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < n; i++) { const a = (opts.phase || 0) + i / n * TAU;
      e.set(a, 0, 0); q.setFromEuler(e); m4.compose(new THREE.Vector3(0, r * Math.cos(a), r * Math.sin(a)), q, one); im.setMatrixAt(i, m4); }
    im.instanceMatrix.needsUpdate = true; im.userData.solid = true; return im;
  };

  /* merge geometries with the same layout (position, normal, uv); missing normals or uvs are generated */
  G.merge = list => {
    const parts = list.filter(Boolean).map(g => { g = g.index ? g : G.indexed(g); if (!g.attributes.normal) g.computeVertexNormals();
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); return g; });
    let nv = 0, ni = 0; for (const g of parts) { nv += g.attributes.position.count; ni += g.index.count; }
    const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), U = new Float32Array(nv * 2), I = new Uint32Array(ni);
    let ov = 0, oi = 0;
    for (const g of parts) { P.set(g.attributes.position.array, ov * 3); N.set(g.attributes.normal.array, ov * 3); U.set(g.attributes.uv.array, ov * 2);
      const ix = g.index.array; for (let i = 0; i < ix.length; i++) I[oi + i] = ix[i] + ov; ov += g.attributes.position.count; oi += ix.length; }
    const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    out.setAttribute('uv', new THREE.BufferAttribute(U, 2)); out.setIndex(new THREE.BufferAttribute(I, 1));
    out.userData.solid = parts.every(g => g.userData.solid !== false);
    return out;
  };
  G.indexed = g => { const n = g.attributes.position.count, ix = new Array(n); for (let i = 0; i < n; i++) ix[i] = i; g.setIndex(ix); return g; };
  /* bake a transform into a geometry */
  G.place = (g, opts) => { const o = new THREE.Object3D(); if (opts.pos) o.position.set(...opts.pos); if (opts.rot) o.rotation.set(...opts.rot);
    if (opts.scale) o.scale.set(...(Array.isArray(opts.scale) ? opts.scale : [opts.scale, opts.scale, opts.scale])); o.updateMatrix(); g.applyMatrix4(o.matrix); return g; };
  /* orient an object so its local +y points along dir, at position p */
  G.aim = (obj, p, dir) => { obj.position.copy(p); obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()); return obj; };
})();
