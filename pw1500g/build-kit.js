/* PW1500G model: a kit of small parts for dressing accessories the way they really look: bolted flanges, V-band clamps, B-nut
   fittings, hex plugs and chip collectors, sight glasses, data plates, electrical connectors with backshells, cast ribs and
   cooling fins. Everything goes into a local frame from K.frame(): x along the engine axis (forward), y radially out from the case,
   z toward increasing clock. Directions are 'x', '-x', 'y', '-y', 'z', '-z' or [x, y, z]. Sizes are metres.
   No builder lives here: build-external.js uses the kit when the builders run. */
(function () {
  const PW = window.PW, G = window.PWGeo, TAU = Math.PI * 2;
  const K = PW.kit = {};
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const AX = { x: V(1, 0, 0), '-x': V(-1, 0, 0), y: V(0, 1, 0), '-y': V(0, -1, 0), z: V(0, 0, 1), '-z': V(0, 0, -1) };
  const dir = d => (typeof d === 'string' ? AX[d] : Array.isArray(d) ? V(...d) : d).clone().normalize();
  const add = (a, b, s) => [a[0] + b.x * s, a[1] + b.y * s, a[2] + b.z * s];
  K.dir = dir; K.at = add;

  /* finishes seen on the real accessories (Brian's photos): tan gearbox castings, natural cast aluminium, the VFG's grey-blue,
     its white terminal cover with brass studs on a brown phenolic block, black chip collector caps, aluminium data plates */
  const col = h => new THREE.Color(h);
  Object.assign(PW.MAT, {
    castTan:    () => new THREE.MeshStandardMaterial({ color: col('#a69f80'), roughness: .72, metalness: .35, roughnessMap: PW.tex.noise('cast', 256, 14, .55, 1), bumpMap: PW.tex.noise('cast', 256, 14, .55, 1), bumpScale: .0009 }),
    vfgGrey:    () => new THREE.MeshStandardMaterial({ color: col('#7d879b'), roughness: .5, metalness: .35, roughnessMap: PW.tex.noise('cast', 256, 14, .55, 1) }),
    termWhite:  () => new THREE.MeshStandardMaterial({ color: col('#e4e0d2'), roughness: .65, metalness: 0 }),
    phenolic:   () => new THREE.MeshStandardMaterial({ color: col('#6b3a1f'), roughness: .55, metalness: 0 }),
    capBlack:   () => new THREE.MeshStandardMaterial({ color: col('#1c1d1f'), roughness: .45, metalness: .25 }),
    plateAl:    () => new THREE.MeshStandardMaterial({ color: col('#cfd2d4'), roughness: .4, metalness: .6 }),
    oilGlass:   () => new THREE.MeshPhysicalMaterial({ color: col('#7a6a3a'), roughness: .08, metalness: 0, clearcoat: 1, clearcoatRoughness: .05 }),
    quilt:      () => new THREE.MeshStandardMaterial({ color: col('#c9cbc8'), roughness: .42, metalness: .75, bumpMap: quiltTex(), bumpScale: .002, roughnessMap: quiltTex() }),
    silicone:   () => new THREE.MeshStandardMaterial({ color: col('#c9531f'), roughness: .6, metalness: 0 }),
    tankAl:     () => new THREE.MeshStandardMaterial({ color: col('#c6cacb'), roughness: .5, metalness: .32, roughnessMap: PW.tex.noise('fine', 256, 40, .6, 1) }),   // formed and welded aluminium (oil tank)
    heatShield: () => new THREE.MeshStandardMaterial({ color: col('#c3c6c7'), roughness: .36, metalness: .72, bumpMap: shieldTex(), bumpScale: .0012, roughnessMap: shieldTex() }),   // embossed stainless heat shield round the oil tank (photo)
    exciterBlack: () => new THREE.MeshStandardMaterial({ color: col('#17181a'), roughness: .62, metalness: .2 }),                 // ignition exciter case (photo)
    braidSteel: () => new THREE.MeshStandardMaterial({ color: col('#ffffff'), map: steelBraidTex(), roughness: .38, metalness: .8, bumpMap: steelBraidTex(), bumpScale: .0004 }),   // ignition cable overbraid
  });
  /* flexible braided stainless overbraid: u runs along the cable (repeated by the line's length) */
  let sbTex; function steelBraidTex() { return sbTex || (sbTex = PW.tex.canvas(64, 64, (c, w, h) => { c.fillStyle = '#868c90'; c.fillRect(0, 0, w, h);
    for (const [s, lw] of [['#5c6266', 3], ['#c8cdd0', 1.5]]) { c.strokeStyle = s; c.lineWidth = lw;
      for (let i = -h; i < w + h; i += 5) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + h, h); c.stroke(); c.beginPath(); c.moveTo(i + h, 0); c.lineTo(i, h); c.stroke(); } } }, { srgb: true })); }
  /* quilted stainless thermal blanket */
  function quiltTex() { return PW.tex.canvas(128, 128, (c, w, h) => { c.fillStyle = '#9a9a9a'; c.fillRect(0, 0, w, h); c.strokeStyle = '#4a4a4a'; c.lineWidth = 3;
    for (let i = 0; i <= 4; i++) { c.beginPath(); c.moveTo(0, i * 32); c.lineTo(w, i * 32); c.stroke(); c.beginPath(); c.moveTo(i * 32, 0); c.lineTo(i * 32, h); c.stroke(); }
    c.fillStyle = '#d8d8d8'; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { c.beginPath(); c.arc(x * 32 + 16, y * 32 + 16, 9, 0, TAU); c.fill(); } }); }
  K.quiltTex = quiltTex;
  /* embossed stainless foil of the oil tank's heat shield: a fine diamond quilting, about 15 mm cells at the arc loft's 1/0.06 m tiling */
  let shTex; function shieldTex() { return shTex || (shTex = PW.tex.canvas(64, 64, (c, w, h) => { c.fillStyle = '#bdbdbd'; c.fillRect(0, 0, w, h); c.strokeStyle = '#575757'; c.lineWidth = 2.5;
    for (let i = -w; i <= 2 * w; i += 16) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + h, h); c.stroke(); c.beginPath(); c.moveTo(i, 0); c.lineTo(i - h, h); c.stroke(); } })); }

  /* ---------------- frames ---------------- */
  /* a frame on the case at (x, clock h, radius r), optionally turned about its own axes (radians) */
  K.frame = (pid, x, h, r, o) => { o = o || {}; const f = new THREE.Group(); f.position.copy(G.onRing(x, r, G.clock(h))); f.rotation.x = G.clock(h);
    if (o.ry) f.rotateY(o.ry); if (o.rz) f.rotateZ(o.rz); if (o.rx) f.rotateX(o.rx);
    (o.into || PW.parts.get(pid).obj).add(f); return f; };
  /* a sub-frame at pos in frame f whose own +x points along axis */
  K.sub = (f, pos, axis, o) => { o = o || {}; const s = new THREE.Group(); s.position.set(...pos); if (axis) s.quaternion.setFromUnitVectors(AX.x, dir(axis));
    if (o.spin) s.rotateX(o.spin); f.add(s); return s; };

  /* place a geometry whose own axis is `base`, turned so that axis points along d, at pos in frame f */
  const put = (pid, f, g, mat, pos, d, base, o) => { o = o || {}; const m = new THREE.Mesh(g); if (d) m.quaternion.setFromUnitVectors(base, dir(d)); if (o.spin) m.rotateOnAxis(base, o.spin);
    m.position.set(...pos); return PW.add(pid, m, mat, { solid: o.solid !== false, into: f, shadow: o.shadow, mat: o.mat }); };

  /* ---------------- solids ---------------- */
  K.box = (pid, f, pos, size, mat, o) => { o = o || {}; const m = new THREE.Mesh(G.roundedBox(size[0], size[1], size[2], o.round === undefined ? Math.min(...size) * .15 : o.round));
    m.position.set(...pos); if (o.rot) m.rotation.set(...o.rot); return PW.add(pid, m, mat, { solid: true, into: f, mat: o.mat, shadow: o.shadow }); };
  K.cyl = (pid, f, pos, d, r, len, mat, o) => put(pid, f, G.can(r, len, { edge: o && o.edge, seg: o && o.seg }), mat, pos, d, AX.x, o);       // capped cylinder along d, centred on pos
  K.tube = (pid, f, pos, d, r0, r1, len, mat, o) => put(pid, f, G.ring(len / 2, -len / 2, r0, r1, { seg: (o && o.seg) || 40 }), mat, pos, d, AX.x, o);   // annulus along d
  /* any turned profile, [[distance along d, radius], ...] from the far end round to the near end, closed on the axis */
  K.prof = (pid, f, pos, d, prof, mat, o) => put(pid, f, G.revolve(prof, { seg: (o && o.seg) || 48, crease: (o && o.crease) || 40 }), mat, pos, d, AX.x, o);
  K.cone = (pid, f, pos, d, ra, rb, len, mat, o) => K.prof(pid, f, pos, d, [[len / 2, 0], [len / 2, ra], [-len / 2, rb], [-len / 2, 0]], mat, o);   // ra at the +d end
  K.hex = (pid, f, pos, d, s, len, mat, o) => { const g = new THREE.CylinderGeometry(s, s, len, 6); g.userData.solid = true; return put(pid, f, g, mat, pos, d, AX.y, o); };
  K.ball = (pid, f, pos, r, mat) => { const g = new THREE.SphereGeometry(r, 16, 12); g.userData.solid = true; const m = new THREE.Mesh(g); m.position.set(...pos); return PW.add(pid, m, mat, { solid: true, into: f }); };
  K.rod = (pid, f, a, b, r, mat) => PW.add(pid, G.rod(V(...a), V(...b), r), mat, { into: f });
  /* thin plates fanned round an axis: cooling fins on a generator, ribs on a casting */
  K.fins = (pid, f, pos, d, r, n, h, t, len, mat, o) => { o = o || {}; const q = new THREE.Quaternion().setFromUnitVectors(AX.x, dir(d)), gs = [];
    for (let i = 0; i < n; i++) { const a = (o.phase || 0) + (o.span || TAU) * (o.span ? i / Math.max(1, n - 1) : i / n), g = new THREE.BoxGeometry(len, h, t);
      g.translate(0, r + h / 2, 0); g.rotateX(a); gs.push(g); }
    const geo = G.merge(gs); geo.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(q)); geo.translate(...pos); geo.userData.solid = true;
    return PW.add(pid, geo, mat, { into: f }); };

  /* a body swept round the engine axis, for tanks and ducts shaped to the core: each section is a rounded rectangle in the (x, r)
     plane, { h: clock, x: centre, w: axial width, ri, ro: inner and outer radius, n: squareness (2 round .. 6 square) }, joined in
     order and capped at both ends. Built in the part's own frame (engine coordinates). Sections are filled in every o.step hours of
     clock (default 0.06) so the surface follows the arc between them instead of cutting straight across; texture coordinates run in
     metres times o.uv (tiles per metre) round each section and along the arc */
  K.arcLoft = (pid, secs, mat, o) => { o = o || {}; const M = o.seg || 28, step = o.step || .06, U = o.uv || 1, pos = [], uv = [], idx = [], R = M + 1;
    const all = []; secs.forEach((s, k) => { if (k) { const p = secs[k - 1], m = Math.ceil(Math.abs(s.h - p.h) / step);
        for (let j = 1; j < m; j++) { const t = j / m, q = { n: (p.n || 4) + ((s.n || 4) - (p.n || 4)) * t }; for (const key of ['h', 'x', 'w', 'ri', 'ro']) q[key] = p[key] + (s[key] - p[key]) * t; all.push(q); } }
      all.push(s); });
    const ring = s => { const out = [], n = s.n || 4, a = s.w / 2, b = (s.ro - s.ri) / 2, rc = (s.ro + s.ri) / 2, th = G.clock(s.h);
      for (let i = 0; i <= M; i++) { const t = i / M * TAU, c = Math.cos(t), sn = Math.sin(t), px = s.x + a * Math.sign(c) * Math.pow(Math.abs(c), 2 / n), pr = rc + b * Math.sign(sn) * Math.pow(Math.abs(sn), 2 / n);
        out.push([px, pr * Math.cos(th), pr * Math.sin(th)]); } return out; };   // M + 1 points: the last repeats the first, for the texture seam
    const rings = all.map(ring); let v = 0;
    rings.forEach((r, k) => { if (k) { const s0 = all[k - 1], s1 = all[k]; v += Math.abs(G.clock(s1.h) - G.clock(s0.h)) * (s0.ri + s0.ro + s1.ri + s1.ro) / 4; }
      let u = 0; r.forEach((p, i) => { if (i) u += Math.hypot(p[0] - r[i - 1][0], p[1] - r[i - 1][1], p[2] - r[i - 1][2]); pos.push(...p); uv.push(u * U, v * U); }); });
    for (let k = 0; k < rings.length - 1; k++) for (let i = 0; i < M; i++) { const a = k * R + i, b = a + 1, c = a + R, d = c + 1; idx.push(a, c, b, b, c, d); }
    for (const [k, flip] of [[0, true], [rings.length - 1, false]]) { const s = all[k], th = G.clock(s.h), rc = (s.ro + s.ri) / 2, ci = pos.length / 3; pos.push(s.x, rc * Math.cos(th), rc * Math.sin(th)); uv.push(0, 0);
      const base = pos.length / 3; for (let i = 0; i < M; i++) { const p = rings[k][i]; pos.push(...p); uv.push((p[0] - s.x) * U, (Math.hypot(p[1], p[2]) - rc) * U); }
      for (let i = 0; i < M; i++) { const a = base + i, b = base + (i + 1) % M; if (flip) idx.push(ci, b, a); else idx.push(ci, a, b); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    G.orientOutward && G.orientOutward(g); g.computeVertexNormals();
    const nr = g.attributes.normal; for (let k = 0; k < rings.length; k++) { const a = k * R, b = a + M, x = nr.getX(a) + nr.getX(b), y = nr.getY(a) + nr.getY(b), z = nr.getZ(a) + nr.getZ(b), l = Math.hypot(x, y, z) || 1;
      nr.setXYZ(a, x / l, y / l, z / l); nr.setXYZ(b, x / l, y / l, z / l); }   // smooth across the seam
    g.userData.solid = true;
    return PW.add(pid, g, mat, { solid: true, into: o.into }); };

  /* ---------------- fasteners and fittings ---------------- */
  /* hex bolt heads on a circle of radius r round axis d, heads pointing along d */
  K.bolts = (pid, f, pos, d, r, n, size, o) => { o = o || {}; const q = new THREE.Quaternion().setFromUnitVectors(AX.x, dir(d)), gs = [];
    for (let i = 0; i < n; i++) { const a = (o.phase || 0) + i / n * TAU, b = G.boltGeo(size || .005).clone(); b.translate(0, r * Math.cos(a), r * Math.sin(a)); gs.push(b); }
    const geo = G.merge(gs); geo.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(q)); geo.translate(...pos); geo.userData.solid = true;
    return PW.add(pid, geo, o.mat || 'steel', { into: f, shadow: false }); };
  /* a bolted flange ring (or pad) facing along d */
  K.flange = (pid, f, pos, d, r0, r1, t, n, mat, o) => { o = o || {}; K.tube(pid, f, pos, d, r0, r1, t, mat || 'castAl');
    if (n) K.bolts(pid, f, add(pos, dir(d), t / 2 + .002), d, o.boltR || (r0 + r1) / 2, n, o.boltSize || Math.min(.006, (r1 - r0) * .32), { phase: o.phase }); };
  /* V-band coupling round a joint of radius r: the band and its T-bolt latch */
  K.vband = (pid, f, pos, d, r, o) => { o = o || {}; const w = o.width || .018, D = dir(d);
    K.prof(pid, f, pos, d, [[w / 2, r], [w / 2, r + .006], [w / 4, r + .011], [-w / 4, r + .011], [-w / 2, r + .006], [-w / 2, r]], 'steel', { seg: 48 });
    const up = Math.abs(D.y) > .9 ? AX.x : AX.y, side = new THREE.Vector3().crossVectors(D, up).normalize(), rad = new THREE.Vector3().crossVectors(side, D).normalize();
    const a = o.phase || 0, out = rad.clone().multiplyScalar(Math.cos(a)).addScaledVector(side, Math.sin(a));
    const p = add(pos, out, r + .016); K.box(pid, f, p, [w * .9, .014, .03], 'steel', { round: .003, rot: rotFor(D, out) });
    K.cyl(pid, f, add(p, out, .002), side, .0035, .045, 'steel'); };                                   // the T-bolt
  function rotFor(D, out) { const m = new THREE.Matrix4().makeBasis(D, out, new THREE.Vector3().crossVectors(D, out)); return new THREE.Euler().setFromRotationMatrix(m).toArray().slice(0, 3); }
  /* every fitting and connector registers its outer end as a port (frame, local end point, direction), so the connection audit
     can list ports with nothing attached; `o.plugged` marks a port that is capped or tested only on the ground */
  PW.ports = PW.ports || [];
  const port = (pid, f, kind, end, D, size, o) => PW.ports.push({ pid, f, kind, end: end.slice(), dir: [D.x, D.y, D.z], size, plugged: !!(o && o.plugged) });
  /* B-nut fitting: hex nut on a short nipple, pointing along d (the tube leaves from its far end) */
  K.fitting = (pid, f, pos, d, s, o) => { s = s || .009; const D = dir(d); K.cyl(pid, f, add(pos, D, -s * .3), d, s * .75, s * 1.2, 'steel');
    K.hex(pid, f, add(pos, D, s * .8), d, s, s * 1.3, 'steel'); if (o && o.stub) K.cyl(pid, f, add(pos, D, s * 1.6 + o.stub / 2), d, s * .45, o.stub, 'tube');
    port(pid, f, 'fitting', add(pos, D, s * 1.45 + (o && o.stub ? o.stub + s * .15 : 0)), D, s, o); };
  /* hex-head plug (drain, overfill, core drain) */
  K.plug = (pid, f, pos, d, s, mat) => { const D = dir(d); K.cyl(pid, f, pos, d, s * 1.05, s * .3, 'steel'); K.hex(pid, f, add(pos, D, s * .55), d, s * .8, s * .8, mat || 'steel'); };
  /* chip collector / magnetic plug: hex body with a black bayonet cap and a lockwire tab */
  K.chip = (pid, f, pos, d, s) => { s = s || .011; const D = dir(d); K.hex(pid, f, pos, d, s, s * .9, 'steel');
    K.cyl(pid, f, add(pos, D, s * .95), d, s * .95, s * .9, 'capBlack', { edge: s * .25 }); K.cyl(pid, f, add(pos, D, s * 1.55), d, s * .35, s * .4, 'capBlack'); };
  /* circular MS connector with coupling nut and a backshell turning the harness away along `lead` */
  K.connector = (pid, f, pos, d, r, o) => { o = o || {}; r = r || .016; const D = dir(d);
    K.cyl(pid, f, add(pos, D, r * .4), d, r * 1.15, r * .8, 'steel', { edge: r * .15 });                       // receptacle flange
    K.cyl(pid, f, add(pos, D, r * 1.3), d, r * 1.05, r * 1.1, o.nut || 'connector', { edge: r * .2 });           // coupling nut
    const L = o.lead ? dir(o.lead) : D, e = add(pos, D, r * 1.9);
    K.cyl(pid, f, add(e, L, r * .9), L, r * .78, r * 1.8, 'steel', { edge: r * .2 });                           // backshell
    if (o.boot) K.cyl(pid, f, add(e, L, r * 2.1), L, r * .72, r * .9, 'silicone', { edge: r * .25 });
    port(pid, f, 'connector', add(e, L, r * (o.boot ? 2.55 : 1.8)), L, r, o); };

  /* ---------------- labels and gauges ----------------
     Each is a thin backing piece with its printing on a flat quad in front (a box's own UVs do not map a picture onto a face) */
  const plateTex = (key, draw, W, H) => (K._t = K._t || {})[key] || (K._t[key] = PW.tex.canvas(W || 256, H || 128, (c, w, h) => { if (!c || !c.fillRect) return; draw(c, w, h); }, { srgb: true }));
  const faceQuad = (pid, f, pos, n, up, w, h, matName, over) => { const N = dir(n), U = dir(up), R = U.clone().cross(N);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h)); m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(R, U, N)); m.position.set(...pos);
    return PW.add(pid, m, matName, { solid: false, into: f, shadow: false, mat: over }); };
  const backing = (pid, f, pos, n, up, w, t, h, mat, round) => { const N = dir(n), U = dir(up), S = N.clone().cross(U);
    const m = K.box(pid, f, pos, [w, t, h], mat, { round }); m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(S, N, U)); return m; };
  /* identification plate: aluminium with black lettering rows; `title` is printed large if given */
  K.plate = (pid, f, pos, n, up, w, h, title) => {
    const t = plateTex('plate-' + (title || ''), (c, W, H) => { c.fillStyle = '#d4d6d8'; c.fillRect(0, 0, W, H); c.strokeStyle = '#333'; c.lineWidth = 6; c.strokeRect(5, 5, W - 10, H - 10);
      c.fillStyle = '#222'; if (title) { c.font = 'bold 34px Arial'; c.fillText(title, 18, 46); } for (let i = 0; i < 5; i++) c.fillRect(18, (title ? 62 : 22) + i * 12, 120 + (i * 37) % 90, 5); });
    backing(pid, f, pos, n, up, w, .002, h, 'plateAl', .0006);
    return faceQuad(pid, f, add(pos, dir(n), .00105), n, up, w * .97, h * .95, 'plateAl', { map: t, color: '#ffffff' }); };
  /* oil sight glass: bolted frame, glass window and level marks. style 'atsFull' (starter: FULL and ADD) or 'qtsLts' (engine oil tank:
     quarts and litres below FULL, 1, 2, 3 and LOW, on an oval window) */
  K.sight = (pid, f, pos, n, up, w, h, style) => {
    const oval = style === 'qtsLts', t = plateTex('sight-' + (style || 'atsFull'), (c, W, H) => {
      c.fillStyle = '#2e2a1c'; c.fillRect(0, 0, W, H); c.fillStyle = '#b39a4d'; c.fillRect(0, H * .25, W, H * .75); c.fillStyle = '#f2f2f2'; c.textAlign = 'left';
      if (!oval) { c.font = 'bold 30px Arial'; c.fillText('FULL', 10, 40); c.fillText('ADD', 10, H - 18); c.fillRect(W * .55, 26, W * .4, 5); c.fillRect(W * .55, H - 34, W * .4, 5); return; }
      c.font = 'bold 22px Arial'; c.fillText('QTS', 8, 30); c.fillText('LTS', W - 52, 30); c.fillText('FULL', 8, 58); c.fillText('FULL', W - 62, 58);
      for (let i = 1; i <= 3; i++) { const y = 60 + i * 42; c.fillRect(8, y, W * .3, 4); c.fillRect(W * .7 - 8, y, W * .3, 4); c.fillText(String(i), W * .3 + 14, y + 8); c.fillText(String(i), W * .7 - 26, y + 8); }
      c.textAlign = 'center'; c.fillText('LOW', W / 2, H - 14); c.fillStyle = '#d8d8d8'; c.fillRect(W / 2 - 6, 40, 12, H - 90); }, oval ? 192 : 128, oval ? 384 : 256);
    const N = dir(n);
    backing(pid, f, pos, n, up, w + .018, .006, h + .018, 'steel', oval ? Math.min(w, h) / 2 + .0085 : .002);
    backing(pid, f, add(pos, N, .0035), n, up, w, .002, h, 'oilGlass', oval ? Math.min(w, h) / 2 - .0005 : .0008);
    faceQuad(pid, f, add(pos, N, .00465), n, up, w * (oval ? .82 : .96), h * (oval ? .9 : .96), 'oilGlass', { map: t, color: '#ffffff' });
    const U = dir(up), S = U.clone().cross(N), corners = oval ? [[-1, -.7], [1, -.7], [-1, .7], [1, .7], [-1, 0], [1, 0]] : [[-1, -1], [1, -1], [-1, 1], [1, 1]];
    for (const [a, b] of corners) K.hex(pid, f, add(add(add(pos, S, a * (w / 2 + .005)), U, b * (h / 2 + .002)), N, .004), n, .0035, .003, 'steel'); };
  /* placards: 'thisSideUp' (black, white arrow and lettering, as on the EEC), 'noStep' (white lettering on a dark band) */
  K.placard = (pid, f, pos, n, up, w, h, kind) => {
    const t = plateTex('placard-' + kind, (c, W, H) => { c.fillStyle = '#151515'; c.fillRect(0, 0, W, H); c.fillStyle = '#f4f4f4'; c.textAlign = 'center';
      if (kind === 'thisSideUp') { const m = W / 2; c.beginPath(); c.moveTo(m, 14); c.lineTo(m + 46, 74); c.lineTo(m + 16, 74); c.lineTo(m + 16, 140); c.lineTo(m - 16, 140); c.lineTo(m - 16, 74); c.lineTo(m - 46, 74); c.closePath(); c.fill();
        c.font = 'bold 30px Arial'; c.fillText('THIS SIDE UP', m, H - 28); }
      else { c.font = 'bold 52px Arial'; c.fillText(kind === 'noStep' ? 'NO STEP' : kind, W / 2, H * .6); } }, 256, kind === 'thisSideUp' ? 220 : 128);
    backing(pid, f, pos, n, up, w, .0012, h, 'darkBox', .0004);
    return faceQuad(pid, f, add(pos, dir(n), .00065), n, up, w * .96, h * .96, 'darkBox', { map: t, color: '#ffffff' }); };
  /* printed adhesive label: 'hv' (red-orange high-voltage warning, as on the ignition exciter in the photos), 'caution' (yellow),
     'white' (white part label with black print) or 'dataBlack' (black data plate with white print, as on the EEC and PHMU) */
  K.label = (pid, f, pos, n, up, w, h, style) => {
    const bg = { hv: '#e2552c', caution: '#efc41a', white: '#f1f1ee', dataBlack: '#1a1a1a' }[style] || '#f1f1ee', ink = style === 'hv' || style === 'dataBlack' ? '#ffffff' : '#141414';
    const t = plateTex('label-' + style, (c, W, H) => { c.fillStyle = bg; c.fillRect(0, 0, W, H); c.fillStyle = ink; c.textAlign = 'center';
      if (style === 'hv') { c.font = 'bold 40px Arial'; c.fillText('WARNING', W / 2, 46); c.font = 'bold 27px Arial'; c.fillText('HIGH VOLTAGE', W / 2, 82); c.font = '15px Arial'; c.fillText('WAIT 5 MINUTES AFTER IGNITION', W / 2, 108); }
      else if (style === 'caution') { c.font = 'bold 30px Arial'; c.fillText('CAUTION', W / 2, 40); for (let i = 0; i < 4; i++) c.fillRect(24, 58 + i * 15, W - 48 - (i * 29) % 60, 6); }
      else { if (style === 'dataBlack') { c.strokeStyle = ink; c.lineWidth = 4; c.strokeRect(8, 8, W - 16, H - 16); }
        for (let i = 0; i < 6; i++) c.fillRect(22, 20 + i * 17, (W - 44) * (.45 + ((i * 37) % 50) / 100), 7); } }, 256, 128);
    backing(pid, f, pos, n, up, w, .0008, h, style === 'hv' ? 'clampOrange' : style === 'caution' ? 'lime' : 'darkBox', .0003);
    return faceQuad(pid, f, add(pos, dir(n), .00045), n, up, w * .98, h * .98, 'plateAl', { map: t, color: '#ffffff', metalness: 0, roughness: .6 }); };
  /* raised cast lettering (FILL, OIL...) on a part's own surface: a bump-mapped quad in the surface colour */
  K.decal = (pid, f, pos, n, up, w, h, text, mat) => {
    const t = plateTex('decal-' + text, (c, W, H) => { c.fillStyle = '#000000'; c.fillRect(0, 0, W, H); c.fillStyle = '#ffffff'; c.font = 'bold 84px Arial'; c.textAlign = 'center'; c.fillText(text, W / 2, H * .78); });
    return faceQuad(pid, f, pos, n, up, w, h, mat || 'castAl', { bumpMap: t, bumpScale: .0015, transparent: true, alphaMap: t }); };
})();

