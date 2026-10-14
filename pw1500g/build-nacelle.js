/* PW1500G model: the nacelle on the A220 (engine No. 2, right wing): inlet cowl, two fan cowl doors, two thrust reverser doors (C-ducts)
   with their inner fixed structure, translating sleeves, cascades and blocker doors, and the lower pylon.
   Stations from TTM ch. 01 Fig. 28 through PW.D.zsToX; layout from the Delta CH 70-80 manual p.8-49 and Brian's hangar photos.
   Clock positions are aft looking forward: right = +z. */
(function () {
  const PW = window.PW, G = window.PWGeo, D = PW.D, TAU = Math.PI * 2;
  (PW.builders = PW.builders || []).push(build);
  const deg = d => d * Math.PI / 180;

  /* woven stainless thermal blanket (the core side of the reverser doors in the photos): a fine basket weave, 16 strands to a 0.1 m tile.
     The IFS blanket's texture coordinates are in metres x 10 (see metricUV), so the weave repeats every 10 cm; until 2026-10-12 one
     diamond of an older quilt texture spanned the whole door */
  const quiltTex = () => PW.tex.weave || (PW.tex.weave = PW.tex.canvas(256, 256, (c, w, h) => {
    c.fillStyle = '#6e6e6e'; c.fillRect(0, 0, w, h);
    const n = 16, s = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const cx = (i + .5) * s, cy = (j + .5) * s, hor = (i + j) % 2 === 0;
      const g = c.createRadialGradient(cx, cy, 0, cx, cy, s * .62); g.addColorStop(0, '#d8d8d8'); g.addColorStop(.65, '#a4a4a4'); g.addColorStop(1, '#5a5a5a');
      c.fillStyle = g; c.beginPath(); c.ellipse(cx, cy, hor ? s * .56 : s * .34, hor ? s * .34 : s * .56, 0, 0, TAU); c.fill(); }
    for (let i = 0; i < 3000; i++) { c.fillStyle = `rgba(${Math.random() < .5 ? '255,255,255' : '0,0,0'},.07)`; c.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); }
  }));
  /* texture coordinates in metres x 10 on a revolved surface (arc length round the axis from t0, and x), turned 45 deg so the weave runs
     on the diagonal as in the photos */
  const metricUV = (g, t0) => { const p = g.attributes.position, uv = g.attributes.uv, k = Math.SQRT1_2;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), r = Math.hypot(y, z), th = ((Math.atan2(z, y) - t0) % TAU + TAU) % TAU;
      const u = th * r * 10, v = x * 10; uv.setXY(i, (u + v) * k, (v - u) * k); }
    uv.needsUpdate = true; return g; };
  Object.assign(PW.MAT, {
    cowlWhite: () => new THREE.MeshStandardMaterial({ color: new THREE.Color('#e3e6e8'), roughness: .55, metalness: .02 }),
    inletLining: () => new THREE.MeshStandardMaterial({ color: new THREE.Color('#2a2f31'), roughness: .6, metalness: .2, bumpMap: PW.tex.perf(), bumpScale: .0008 }),
    /* the woven stainless blanket in the core and exhaust photos: light silver with a strong weave and sheen, about 0.75 of the mint fan
       exit liner's brightness. At metalness .72 it mirrored the dark backdrop and rendered at 0.35; at .25 it was brighter but chalky.
       Now about 0.55, the weave in deeper relief */
    blanket: () => { const t = quiltTex(); return new THREE.MeshStandardMaterial({ color: new THREE.Color('#d3d5d6'), roughness: .52, metalness: .4, bumpMap: t, bumpScale: .0022, roughnessMap: t }); },
    siliconeSeal: () => new THREE.MeshStandardMaterial({ color: new THREE.Color('#9a4430'), roughness: .5, metalness: 0 }),         // the red-brown bulb fire seals (photos)
    gasketOrange: () => new THREE.MeshStandardMaterial({ color: new THREE.Color('#cf6a3e'), roughness: .55, metalness: 0 }),        // orange silicone gaskets round the IFS openings (photos)
    cascadeGrey: () => new THREE.MeshStandardMaterial({ color: new THREE.Color('#4b5056'), roughness: .5, metalness: .5 }),
    /* the IFS aft collar and the pylon's heat shield: dull satin metal. More metallic, it mirrored the dark backdrop and read near black
       from aft, where the rear photo shows the heat shield a mid grey (about 0.4 of the white paint's brightness) */
    bareCowl: () => new THREE.MeshStandardMaterial({ color: new THREE.Color('#a9a59b'), roughness: .55, metalness: .5, roughnessMap: PW.tex.noise('cast', 256, 14, .55, 1) }),
    horGrey: () => new THREE.MeshStandardMaterial({ color: new THREE.Color('#4b5157'), roughness: .42, metalness: .55 }),   // the dark grey hold-open rods (photos)
    horRed: () => new THREE.MeshStandardMaterial({ color: new THREE.Color('#c8261e'), roughness: .5, metalness: .1 }),       // a hold-open rod's collar band: unlocked
    horGreen: () => new THREE.MeshStandardMaterial({ color: new THREE.Color('#2f9a3c'), roughness: .5, metalness: .1 }),     // and locked (p.41)
  });

  /* ---- nacelle state, driven from the toolbar: fan cowls 0..1 (55 deg), reverser doors 0..1 (45 deg), sleeves 0..1 (deployed) ---- */
  const S = PW.nac = { fan: 0, tr: 0, sleeve: 0, want: { fan: 0, tr: 0, sleeve: 0 }, hinges: [], sleeves: [], blockers: [], struts: [], stroke: .54 };

  /* a closed slab between an outer and an inner face: P(u, v, s) with u in 0..1 along it, v in -1..1 across and s = 0 outer, 1 inner.
     Each face has its own vertices so the edges stay sharp; the winding is set from the parameter directions, then turned outward */
  function slab(nu, nv, P) {
    const faces = [], grid = (n0, n1, f, flip) => { const pos = [], idx = [];
      for (let i = 0; i <= n0; i++) for (let j = 0; j <= n1; j++) pos.push(...f(i / n0, j / n1));
      for (let i = 0; i < n0; i++) for (let j = 0; j < n1; j++) { const a = i * (n1 + 1) + j, b = a + n1 + 1; if (flip) idx.push(a, a + 1, b + 1, a, b + 1, b); else idx.push(a, b, b + 1, a, b + 1, a + 1); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); faces.push(g); };
    grid(nu, nv, (u, v) => P(u, v * 2 - 1, 0), true); grid(nu, nv, (u, v) => P(u, v * 2 - 1, 1), false);
    grid(nv, 1, (v, s) => P(0, v * 2 - 1, s), true); grid(nv, 1, (v, s) => P(1, v * 2 - 1, s), false);
    grid(nu, 1, (u, s) => P(u, -1, s), false); grid(nu, 1, (u, s) => P(u, 1, s), true);
    const g = G.orientOutward(G.merge(faces)); g.computeVertexNormals(); g.userData.solid = true; return g;
  }
  /* aim a blocker door's drag link from its IFS fitting to the bracket on the door, for sleeve travel u and door angle th, in the door's
     own (hinge) frame. The link's thin side faces round the engine, its chord along the flow */
  function aimLink(b, u, th) {
    const c = Math.cos(th), s = Math.sin(th), F = G.onRing(b.xF, b.rF, b.a), Aw = G.onRing(b.xh0 - u + b.lx * c - b.ly * s, b.rc + b.lx * s + b.ly * c, b.a);
    const yA = Aw.clone().sub(F).normalize(), zA = new THREE.Vector3(0, -Math.sin(b.a), Math.cos(b.a)), xA = new THREE.Vector3().crossVectors(yA, zA).normalize();
    zA.crossVectors(xA, yA); b.link.position.copy(F).add(Aw).multiplyScalar(.5); b.link.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xA, yA, zA));
  }
  /* a member between two ends that move with the doors (opening actuators, hold-open rods), built of pieces re-aimed every frame: each
     piece is anchored at end a (offset s along the member) or at end b (offset s back toward a), its geometry's own +y along the
     member. Tubes anchored at opposite ends slide over each other, so the member telescopes; fittings ride on either end. ends()
     returns both ends in the group's own frame */
  function member(pid, into, pieces, ends) {
    const g = new THREE.Group(), Y = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion(); into.add(g);
    for (const p of pieces) p.m = PW.add(pid, p.geo, p.mat, { into: g, solid: true });
    const st = { g, ms: pieces.map(p => p.m), ends, update() { const [a, b] = st.ends(), d = b.clone().sub(a), L = d.length() || 1; d.multiplyScalar(1 / L);
      q.setFromUnitVectors(Y, d);
      for (const p of pieces) { p.m.quaternion.copy(q); p.m.position.copy(p.at === 'b' ? b : a).addScaledVector(d, p.at === 'b' ? -(p.s || 0) : (p.s || 0)); }
      if (st.after) st.after(); } };
    S.struts.push(st); st.update(); return st;
  }
  const tubeY = (r, l) => new THREE.CylinderGeometry(r, r, l, 16), crossX = (r, l) => new THREE.CylinderGeometry(r, r, l, 10).rotateZ(Math.PI / 2);
  /* a telescopic hold-open rod (p.13, p.41, the hangar photos): dark grey outer and inner tubes with the extend/retract collar between
     them, lime-green end fittings, the pivot end at a and the quick-release fitting with its pin at the free end b. o.ls is its stowed
     (retracted) length. o.unlocked() true shows the collar's red band, otherwise the green one (p.41) */
  function hor(pid, into, ends, o) {
    const r = o.r || .0125, lo = o.ls * .96, li = o.ls * .9, pcs = [
      { geo: tubeY(r, lo), mat: 'horGrey', at: 'a', s: lo / 2 }, { geo: tubeY(r * .72, li), mat: 'horGrey', at: 'b', s: li / 2 },
      { geo: tubeY(r * 1.3, .036), mat: 'steel', at: 'a', s: lo - .018 },
      { geo: G.roundedBox(.026, .03, .024, .004), mat: 'lime', at: 'a', s: .002 }, { geo: crossX(.0045, .034), mat: 'steel', at: 'a', s: 0 },
      { geo: G.roundedBox(.026, .044, .022, .004), mat: 'lime', at: 'b', s: .018 }, { geo: crossX(.004, .036), mat: 'steel', at: 'b', s: .006 }];
    if (o.unlocked) pcs.push({ geo: tubeY(r * 1.36, .012), mat: 'horRed', at: 'a', s: lo - .044 }, { geo: tubeY(r * 1.36, .012), mat: 'horGreen', at: 'a', s: lo - .044 });
    const st = member(pid, into, pcs, ends);
    if (o.unlocked) st.after = () => { const u = !!o.unlocked(); pcs[pcs.length - 2].m.visible = u; pcs[pcs.length - 1].m.visible = !u; };
    st.update(); return st;
  }
  /* a point given in a door's closed position, turned with the door about its hinge line (y, z = h.py, h.pz), and back. Explode offsets
     are left out, so a member on the engine side stays with the engine when the doors lift away */
  const rotX = (v, ang, py, pz) => { const c = Math.cos(ang), s = Math.sin(ang), y = v.y - py, z = v.z - pz; return new THREE.Vector3(v.x, py + y * c - z * s, pz + y * s + z * c); };
  const doorOut = (h, p) => rotX(p, h.obj.rotation.x, h.py, h.pz), doorIn = (h, q) => rotX(q, -h.obj.rotation.x, h.py, h.pz);
  const ease01 = s => (s <= 0 ? 0 : s >= 1 ? 1 : s * s * (3 - 2 * s));
  /* where a hold-open rod's free end is at fraction w of fitting it, all in its door's frame: it swings off its stow clip about the pivot
     P toward the fitting F, the swing leading and the telescoping following, and arrives on F at w = 1 */
  const qSw = new THREE.Quaternion(), qPart = new THREE.Quaternion();
  function rodEnd(P, Sw, F, w) {
    if (!(w > 0)) return Sw.clone(); if (w >= 1) return F.clone();
    const ds = Sw.clone().sub(P), Ls = ds.length(), df = F.clone().sub(P), Ld = df.length(); ds.multiplyScalar(1 / Ls); df.multiplyScalar(1 / Ld);
    qSw.setFromUnitVectors(ds, df); qPart.identity().slerp(qSw, ease01(w / .75));
    return P.clone().addScaledVector(ds.applyQuaternion(qPart), Ls + (Ld - Ls) * ease01((w - .3) / .7));
  }
  /* the blocker door angle for sleeve travel u: the drag link keeps its length, so solve |door end - fitting| = L by bisection */
  function doorAngle(b, u) {
    if (u < 1e-5) return 0;
    const f = th => { const c = Math.cos(th), s = Math.sin(th); return Math.hypot(b.xh0 - u + b.lx * c - b.ly * s - b.xF, b.rc + b.lx * s + b.ly * c - b.rF) - b.L; };
    let lo = 0, hi = 1.6; for (let i = 0; i < 26; i++) { const m = (lo + hi) / 2; if (f(m) > 0) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }

  function build() {
    if (!D.GEN) return;
    const X = D.zsToX, Z = D.ZS, x = zs => X(zs);
    const nac = D.nacOuter();                                         // outer line [x, r], forward to aft
    const rOut = xx => G.interp(nac, xx);
    /* flush fastener heads in rows. On the composite cowls they are painted over with the skin and show only as faint dull dots where the
       paint dips into them (photos of A220 nacelles: no rows show from a few metres), so the heads take the paint a shade darker with a
       duller clear coat. One instanced mesh per call. A row is { x, a0, a1 } round the skin at station x, or { a, x0, x1 } along it at
       angle a (radians from 12 o'clock toward the right); d is how far inside the skin's outer line the head sits (0 on it), and
       o.xf(x, a) moves a head along the engine (the inlet's rake) */
    const PAINTED = { color: '#0a3283', clearcoatRoughness: .32 };
    const fasteners = (pid, into, rows, step, o) => { o = o || {}; const pts = [];
      for (const r of rows) { if (r.x !== undefined) { const n = Math.max(1, Math.round(Math.abs(r.a1 - r.a0) * rOut(r.x) / step)); for (let i = 0; i <= n; i++) pts.push([r.x, r.a0 + (r.a1 - r.a0) * i / n, r.d || 0]); }
        else { const n = Math.max(1, Math.round(Math.abs(r.x1 - r.x0) / step)); for (let i = 0; i <= n; i++) pts.push([r.x0 + (r.x1 - r.x0) * i / n, r.a, r.d || 0]); } }
      const m = new THREE.InstancedMesh(new THREE.CylinderGeometry(o.size || .0034, o.size || .0034, .0008, 10), null, pts.length), ob = new THREE.Object3D();
      pts.forEach(([xx, a, d], i) => { const r = (o.rAt || rOut)(xx) - d + .0002; ob.position.copy(G.onRing(o.xf ? o.xf(xx, a) : xx, r, a)); ob.rotation.set(a, 0, 0); ob.updateMatrix(); m.setMatrixAt(i, ob.matrix); });
      return PW.add(pid, m, o.mat || 'nacellePaint', { into, mat: o.over || (o.mat ? undefined : PAINTED), solid: false, shadow: false }); };
    /* a patch laid on the skin, centred at station x and angle a, w along the engine by h round it, carrying a texture with transparency:
       painted markings and the seams of flush panels. It reads upright from beside the engine (forward to aft on the left side) */
    const skinPatch = (pid, into, xx, a, w, h, map, o) => { o = o || {}; const s = Math.sin(a) < 0 ? -1 : 1, nu = 8, nv = 6, pos = [], uv = [], idx = [];
      for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { const u = i / nu, v = j / nv, px = xx + s * (u - .5) * w, aa = a - s * (v - .5) * h / rOut(px);
        const p = G.onRing(o.xf ? o.xf(px, aa) : px, rOut(px) + (o.lift || .0006), aa); pos.push(p.x, p.y, p.z); uv.push(u, v); }
      for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const k = j * (nu + 1) + i; idx.push(k, k + 1, k + nu + 2, k, k + nu + 2, k + nu + 1); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
      return PW.add(pid, g, 'nacellePaint', { into, solid: false, shadow: false, mat: { color: '#ffffff', map, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 } }); };
    /* flush access panels and doublers (p.11, p.13; photos, where they barely show): a fine seam round a rounded rectangle l along the
       engine by w round it, the skin itself being the panel, with a row of painted-over fasteners just inside the edge (o.step 0: none);
       o.holes are the sling's screw holes on a hoist doubler, [along, round] from its centre */
    const seamTex = (l, w, o) => PW.tex.canvas(512, Math.max(32, Math.min(512, Math.round(512 * w / l))), (c, W, H) => { if (!c || !c.fillRect) return;
      const k = W / l, lw = Math.max(1.5, (o.lw || .0011) * k), e = lw / 2 + 1, rr = Math.min((o.round || .012) * k, W / 2 - e, H / 2 - e);
      c.strokeStyle = o.seam || '#061c4c'; c.lineWidth = lw; c.beginPath(); c.moveTo(e + rr, e); c.arcTo(W - e, e, W - e, H - e, rr); c.arcTo(W - e, H - e, e, H - e, rr);
      c.arcTo(e, H - e, e, e, rr); c.arcTo(e, e, W - e, e, rr); c.closePath(); c.stroke();
      c.fillStyle = '#0c1118'; for (const [p, q] of o.holes || []) { c.beginPath(); c.arc(W / 2 + p * k, H / 2 - q * k, .0045 * k, 0, TAU); c.fill(); } }, { srgb: true });
    const flushPanel = (pid, into, xx, a, l, w, o) => { o = o || {}; const r = rOut(xx), e = .011, c = .024, da = (w / 2 - e) / r, dc = (w / 2 - c) / r;
      skinPatch(pid, into, xx, a, l + .003, w + .003, seamTex(l + .003, w + .003, o), o);
      if (o.step !== 0) fasteners(pid, into, [{ x: xx + l / 2 - e, a0: a - dc, a1: a + dc }, { x: xx - l / 2 + e, a0: a - dc, a1: a + dc },
        { a: a - da, x0: xx - l / 2 + c, x1: xx + l / 2 - c }, { a: a + da, x0: xx - l / 2 + c, x1: xx + l / 2 - c }], o.step || .034, { xf: o.xf }); };
    /* stencils and placards, placed from Brian's photo of a Breeze No. 2 engine in flight (its inboard side): white stencilled lettering
       on the inlet, the fan cowls and the reverser doors, and a pair of white placards with red print high on each fan cowl. The photo is
       too small to read them, so the print is drawn as unreadable letter strokes; words: the letters in each word, line by line */
    let seed = 7; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
    const STROKES = ['LTB', 'LTM', 'LRM', 'LB', 'TC', 'LRB', 'LTRB', 'LTMB', 'C', 'LRT', 'TMBR', 'LTMR'];
    const markTex = (words, ink, paper, aspect) => PW.tex.canvas(512, Math.max(24, Math.min(256, Math.round(512 / aspect))), (c, W, H) => { if (!c || !c.fillRect) return;
      if (paper) { c.fillStyle = paper; c.fillRect(0, 0, W, H); }
      const lh = H / words.length, ch = lh * .56, sw = Math.max(1.5, ch * .17), cw = ch * .64, m = W * (paper ? .06 : .02);
      c.fillStyle = ink;
      words.forEach((line, j) => { const len = line.reduce((s, n) => s + n * (cw + sw * 1.3), 0) + (line.length - 1) * cw * .8, k = Math.min(1, (W - 2 * m) / len), y = lh * j + (lh - ch) / 2;
        let xx = 0; c.save(); c.translate(m, 0); c.scale(k, 1);
        for (const n of line) { for (let i = 0; i < n; i++) { for (const s of STROKES[Math.floor(rnd() * STROKES.length)]) {
            if (s === 'L') c.fillRect(xx, y, sw, ch); if (s === 'R') c.fillRect(xx + cw - sw, y, sw, ch); if (s === 'C') c.fillRect(xx + (cw - sw) / 2, y, sw, ch);
            if (s === 'T') c.fillRect(xx, y, cw, sw); if (s === 'M') c.fillRect(xx, y + (ch - sw) / 2, cw * .9, sw); if (s === 'B') c.fillRect(xx, y + ch - sw, cw, sw); }
          xx += cw + sw * 1.3; } xx += cw * .8; }
        c.restore(); }); }, { srgb: true });
    const mark = (pid, into, xx, a, w, h, words, o) => { o = o || {}; return skinPatch(pid, into, xx, a, w, h, markTex(words, o.ink || '#eef1f4', o.paper, w / h), Object.assign({ lift: .0008 }, o)); };
    const PLACARD = { paper: '#f3f3ef', ink: '#c41e2a' };
    const xHL = x(Z.inletHighlight), xJ1 = x(Z.inletFanCowl), xJ2 = x(Z.fanCowlTR), xTE = x(Z.sleeveTE), xCN = D.GEN.nacelle.coreNozzleExit.x;
    const fA = D.GEN.flanges.find(f => /^A /.test(f.name));
    PW.NACELLE_IDS = ['inlet', 'fan-cowls', 'thrust-reverser', 'pylon'];
    PW.part('nacelle', { label: 'Nacelle and pylon', src: 'Delta CH 70-80 p.8-49; TTM ch. 01, 54, 71, 78',
      info: 'The nacelle is the inlet cowl, two fan cowl doors and two thrust reverser doors. The reverser doors also carry the inner fixed structure that encloses the core. The fan cowl doors and reverser doors hang from the pylon; the inlet cowl is bolted to the engine\'s front flange (flange A) at its attachment ring (p.10).\n\nUse the Cowls control to open the fan cowls and reverser doors as they are opened for maintenance.' });

    /* ============================== INLET ============================== */
    PW.part('inlet', { parent: 'nacelle', label: 'Inlet cowl', explode: [1.0, 0, 0], src: 'p.8-11; TTM ch. 01 Fig. 28; ch. 30; photos',
      info: 'Directs the airflow to the fan in all conditions and reduces noise (p.8, p.10). It is bolted to the front flange of the engine (fan case flange A) at its attachment ring. The inner barrel is titanium and composite with 360 degrees of acoustic treatment; the outer barrel is a two-piece composite structure from the lip skin to the leading edge of the fan cowl, with a copper screen in it for lightning strike protection. The lip is anti-iced from inside by HPC 6th-stage bleed air through two cowl anti-ice valves, and the air is exhausted through slots at the bottom of the cowl (p.10; TTM ch. 30). Its lower lip sits about 2 in aft of the upper lip (scarf).\n\nOn the outer barrel: the NACA scoop at 1 o\'clock for fan compartment cooling, the P2T2 access panel at 11 o\'clock, the cowl anti-ice duct access panel at 5 o\'clock, the hoist points on its joint lines for removing the cowl with the inlet cowl sling, and drain holes at the bottom; more drain holes in the core of the inner barrel let fluids out.' });
    {
      const rHL = 1.072, rTh = .942, rFF = G.interp(D.GEN.lines.fanCaseInner, fA.x);
      const lipTop = [[xHL, rHL]], k = 10;
      const rake = (xx, a) => xx - .0533 * (1 - Math.cos(a)) / 2 * Math.max(0, Math.min(1, 1 - (xHL - xx) / .9));   // where scarf() moves a point of the outer barrel at angle a
      /* lip: an elliptical nose from the throat round the highlight onto the outer barrel */
      const lipPts = []; for (let i = 0; i <= k; i++) { const a = -Math.PI / 2 + Math.PI * i / k, ex = .085, er = (rOut(xHL - .09) - rTh) / 2, cr = rTh + er;
        lipPts.push([xHL - ex + ex * Math.cos(a) * (a < 0 ? 1 : 1), cr + er * Math.sin(a)]); }
      // lip skin (bare metal), as a closed thin shell over the nose
      const lipOut = lipPts.map(([xx, r]) => [xx, r]), lipIn = lipPts.map(([xx, r]) => { const c = [xHL - .085, (lipPts[0][1] + lipPts[k][1]) / 2]; const d = Math.hypot(xx - c[0], r - c[1]); const s = (d - .004) / d; return [c[0] + (xx - c[0]) * s, c[1] + (r - c[1]) * s]; });
      PW.part('inlet-lip', { parent: 'inlet', label: 'Inlet lip', src: 'p.8-11; TTM ch. 30; photos',
        info: 'Bare metal lip skin over the D-duct, heated from inside by HPC 6th-stage bleed air (TTM ch. 30). Dents, erosion and bird strike damage are assessed against the AMP limits.' });
      PW.add('inlet-lip', scarf(G.revolve(lipOut.concat(lipIn.reverse()), { seg: 160, crease: 70 }), xHL), 'lipAl');
      /* on the outside the lip skin carries on aft over the anti-ice D-duct to about 0.18 m behind the highlight, where it meets the painted
         outer barrel: p.9 draws the joint there, and photos of Breeze aircraft show a bare metal band about that wide (p.11 draws it
         narrower) */
      const xLip = xHL - .18, lb = [[xHL - .085, rOut(xHL - .09)]]; for (let i = 1; i <= 6; i++) { const xx = xHL - .085 - .095 * i / 6; lb.push([xx, rOut(xx)]); }
      PW.add('inlet-lip', scarf(G.revolve(G.shellProfile(lb, lb.map(([xx, r]) => [xx, r - .004])), { seg: 160 }), xHL), 'lipAl');
      // outer barrel (painted), from the lip to the inlet / fan cowl joint
      const ob = []; for (let i = 0; i <= 20; i++) { const xx = xLip + (xJ1 - xLip) * i / 20; ob.push([xx, rOut(xx)]); }
      PW.part('inlet-outer-barrel', { parent: 'inlet', label: 'Inlet outer barrel', src: 'p.8-11; photos', info: 'Painted outer skin of the inlet cowl, Breeze blue on Breeze aircraft. It carries the NACA scoop, the P2T2 access panel, the cowl anti-ice access panel and exhaust slots, and the hoist points.' });
      PW.add('inlet-outer-barrel', scarf(G.revolve(G.shellProfile(ob, ob.map(([xx, r]) => [xx, r - .005])), { seg: 160 }), xHL), 'nacellePaint');
      // inner barrel: acoustic sandwich from the throat to flange A
      const ib = []; for (let i = 0; i <= 20; i++) { const t = i / 20, xx = (xHL - .085) + (fA.x - (xHL - .085)) * t; ib.push([xx, rTh + (rFF - rTh) * Math.pow(t, 1.4) - .006 * Math.sin(Math.PI * Math.min(1, t * 2.5))]); }
      PW.part('inlet-inner-barrel', { parent: 'inlet', label: 'Inlet inner barrel (acoustic panels)', src: 'p.10; photos', info: 'Acoustic panels lining the inlet between the lip and the fan case. The perforated face sheet absorbs fan noise. The P2T2 probe projects through it at 11 o\'clock.' });
      PW.add('inlet-inner-barrel', scarf(G.revolve(G.shellProfile(ib.map(([xx, r]) => [xx, r + .028]), ib), { seg: 160 }), xHL), 'inletLining');
      // bulkheads: forward (closes the anti-ice D-duct) and aft (the lime-green frame at the fan compartment)
      PW.add('inlet', scarf(G.ring(xHL - .13, xHL - .14, rTh + .03, rOut(xHL - .13) - .005, { seg: 160 }), xHL), 'greyPrimer');
      PW.add('inlet', G.ring(xJ1 + .012, xJ1, fA.r_in + .03, rOut(xJ1) - .006, { seg: 160 }), 'lime');
      PW.add('inlet', G.ring(fA.x + .02, fA.x + .004, fA.r_in + .02, fA.r_out, { seg: 160 }), 'lime');
      // anti-ice air ring in the D-duct (assumed: the manual and TTM ch. 30 say only that 6th-stage air heats the lip)
      PW.add('inlet', scarf(G.revolve([[xHL - .10, rHL - .052], [xHL - .115, rHL - .052], [xHL - .115, rHL - .037], [xHL - .10, rHL - .037]], { seg: 128 }), xHL), 'steel');
      /* the lip skin's joint with the outer barrel (p.9, p.11): a hairline, with the lip's countersunk fasteners in a row just forward of
         it, bare metal like the lip. Both follow the inlet's rake */
      { const xL = xLip, rL = rOut(xLip);
        PW.add('inlet-outer-barrel', scarf(G.revolve([[xL + .0015, rL + .0003], [xL - .0015, rL + .0003], [xL - .0015, rL - .002], [xL + .0015, rL - .002]], { seg: 160 }), xHL), 'darkBox');
        fasteners('inlet-lip', PW.parts.get('inlet-lip').obj, [{ x: xL + .012, a0: 0, a1: TAU - .001, d: .0004 }], .042, { xf: rake, size: .0028, mat: 'lipAl', over: { color: '#9aa0a7', roughness: .35 } }); }
      /* features on the outer barrel (clock positions ALF; p.10-11): access panels flush with the skin, a fine seam round them, the
         countersunk fasteners round the edge (p.11 draws twelve on the P2T2 panel) */
      const onBarrel = (pid, label, info, xx, h, w, l) => { PW.part(pid, { parent: 'inlet', label, info, src: 'p.10-11' });
        flushPanel(pid, PW.parts.get(pid).obj, xx, G.clock(h), l, w, { xf: rake, round: .01 }); };
      onBarrel('inlet-p2t2-panel', 'P2/T2 probe access panel', 'Access panel at 11 o\'clock over the P2/T2 probe, its sense line and its wiring harness (p.10).', xHL - .45, 11, .16, .22);
      onBarrel('inlet-cai-panel', 'Cowl anti-ice duct access panel', 'Access panel at 5 o\'clock over the cowl anti-ice duct where it enters the inlet.', xJ1 + .25, 5, .16, .24);
      { PW.part('inlet-naca', { parent: 'inlet', label: 'NACA scoop', src: 'p.10', info: 'Flush NACA-type air scoop at 1 o\'clock near the front of the outer barrel, used for fan compartment cooling (p.10).' });
        const a = G.clock(1), xx = xHL - .32, m = new THREE.Mesh(G.roundedBox(.16, .02, .07, .008)); m.position.copy(G.onRing(xx, rOut(xx) - .006, a)); m.rotation.x = a; PW.add('inlet-naca', m, 'darkBox', { solid: true }); }
      { PW.part('inlet-ai-exhaust', { parent: 'inlet', label: 'Cowl anti-ice exhaust louvers', src: 'p.10-11', info: 'A row of louvers in the bottom of the outer barrel, along the forward edge of the 5 o\'clock cowl anti-ice duct access panel (p.11), where the anti-ice air is exhausted after heating the lip.' });
        for (let i = 0; i < 5; i++) { const a = G.clock(4.75 + i * .125), xx = xJ1 + .25 + .14; const m = new THREE.Mesh(G.roundedBox(.07, .006, .018, .005)); m.position.copy(G.onRing(xx, rOut(xx) + .0005, a)); m.rotation.x = a; PW.add('inlet-ai-exhaust', m, 'darkBox', { solid: true }); } }
      /* p.10-11: drain holes in the bottom of the outer barrel beside the anti-ice access panel; the hoist points for the inlet cowl sling
         on the outer barrel's joint lines (it is a two-piece structure), at the forward and aft ends of each joint */
      { const Kt = PW.kit;
        for (const xx of [xJ1 + .2, xJ1 + .25, xJ1 + .3]) Kt.cyl('inlet-outer-barrel', Kt.frame('inlet-outer-barrel', xx, 5.62, rOut(xx)), [0, .0004, 0], 'y', .005, .0012, 'darkBox');
        for (const h of [2.0, 8.0]) { PW.add('inlet-outer-barrel', G.revolve([[xJ1 + .005, rOut(xJ1 + .005) + .0004], [xHL - .3, rOut(xHL - .3) + .0004], [xHL - .3, rOut(xHL - .3) - .001], [xJ1 + .005, rOut(xJ1 + .005) - .001]], { seg: 1, thetaStart: G.clock(h) - .0015, thetaLength: .003 }), 'darkBox');   // joint line
          for (const xx of [xJ1 + .03, xHL - .45])   // painted-over doubler, its edge showing faintly, and the sling's screw hole
            flushPanel('inlet-outer-barrel', PW.parts.get('inlet-outer-barrel').obj, xx, G.clock(h), .054, .034, { step: 0, seam: '#0a2a72', lw: .0008, round: .006, holes: [[0, 0]], xf: rake }); } }
      /* the stencils in the photo, either side of the crown about 0.4 m behind the lip: one line just right of it, two lines just left */
      { const io = PW.parts.get('inlet-outer-barrel').obj;
        mark('inlet-outer-barrel', io, .62, deg(8), .11, .013, [[4, 7]], { xf: rake });
        mark('inlet-outer-barrel', io, .627, deg(352.3), .085, .024, [[4, 7], [6, 2]], { xf: rake }); }
      { PW.part('inlet-p2t2', { parent: 'inlet', label: 'P2/T2 probe', src: 'p.10, p.102-105',
          info: 'Inlet probe on the inner barrel at 11 o\'clock, reached through the access panel above it. P2 is the inlet total pressure (single channel, to EEC channel B); T2 the inlet total temperature (dual channel, to both). The EEC uses them to check the aircraft air data and in its place when that is invalid; T2 replaces it on the ground below 60 kt.\n\nThe probe is heated from AC BUS 1 on the left engine and AC BUS 2 on the right, switched on by the EEC above idle below 9 deg C (48 deg F). A heater failure gives the 73 L(R) ENGINE FAULT - P2/T2 HEATER INOP info message. If the probe fails too, the EEC uses defaults: 14.7 psi, 17,000 ft pressure altitude and a synthesized inlet temperature.' });
        /* p.105: a rectangular four-bolt flange on the back of the acoustic barrel, the sensor body with its signal connector on top and
           the heater connector on its side, and the sensing strut reaching about 8 cm into the airflow, its foot facing forward. Its
           harness runs aft inside the inlet, through the aft bulkhead, to a disconnect over flange A */
        const Kt = PW.kit, xx = xHL - .45, rb = G.interp(ib, xx) + .028, f = Kt.frame('inlet-p2t2', xx, 11, rb);
        Kt.box('inlet-p2t2', f, [0, .003, 0], [.05, .006, .04], 'steel', { round: .004 });
        for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) Kt.hex('inlet-p2t2', f, [a * .019, .0075, b * .014], 'y', .0035, .003, 'steel');
        Kt.cyl('inlet-p2t2', f, [0, .03, 0], 'y', .016, .048, 'steel', { edge: .003 });
        Kt.connector('inlet-p2t2', f, [0, .054, 0], 'y', .009, { lead: '-x' }); Kt.connector('inlet-p2t2', f, [0, .036, .016], 'z', .008, { lead: '-x' });
        Kt.box('inlet-p2t2', f, [-.004, -.065, 0], [.022, .09, .012], 'steel', { round: .004 }); Kt.box('inlet-p2t2', f, [.004, -.106, 0], [.032, .012, .014], 'steel', { round: .004 });
        Kt.cyl('inlet-p2t2', f, [.0205, -.106, 0], 'x', .0045, .004, 'capBlack');                                            // total pressure port
        const P = (x, h, r) => G.onRing(x, r, G.clock(h)), lead = (pts, r) => { const g = G.tube(pts, r, { radial: 10, tension: .3 }), L = g.userData.curve.getLength(), uv = g.attributes.uv;
          if (uv) for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * L * 8); PW.add('inlet-p2t2', g, 'harness').userData.isLine = true; };
        lead([P(xx - .0162, 11, rb + .0711), P(xx - .05, 11.0, rb + .073), P(.62, 11.04, 1.034), P(.5, 11.07, 1.028), P(.42, 11.09, 1.02), P(.37, 11.1, 1.016)], .007);
        lead([P(xx - .0144, 11.06, rb + .036), P(xx - .04, 11.07, 1.012), P(.66, 11.05, 1.03), P(.62, 11.04, 1.034)], .005);
        const g = Kt.frame('inlet-p2t2', .35, 11.1, .97); Kt.cyl('inlet-p2t2', g, [0, .046, 0], 'x', .011, .02, 'connector', { edge: .002 });   // inlet half of the disconnect
        Kt.tube('inlet-p2t2', Kt.frame('inlet-p2t2', xJ1 + .006, 11.09, .97), [0, .05, 0], 'x', .0072, .013, .016, 'rubber'); }   // grommet in the aft bulkhead
    }

    /* ============================== FAN COWL DOORS ============================== */
    PW.part('fan-cowls', { parent: 'nacelle', label: 'Fan cowl doors', src: 'p.8-15; photos',
      info: 'Two carbon fibre (CFRP) doors between the inlet cowl and the thrust reverser, stiffened with radial stiffeners and longerons, with copper mesh in the laminate for lightning protection. Each hangs from the pylon\'s fan cowl support beam on three hinges, whose pins are held by retaining clips; pulling the pins frees the cowl for removal with the ground handling sling on its three hoist points. Wear strips keep the joints between the cowls smooth.\n\nThe cowls latch together at the bottom centreline with three flush latches, L1 forward to L3 aft, opened and closed in the order L1, L3, L2: push the trigger to release the handle, pull the handle down and lift the hook off the eye-bolt of its keeper. When they are properly closed the handles are flush and their red marks do not show; alignment pins beside the latches line the cowls up. An unlatched fan cowl can depart in flight.\n\nEach door weighs more than 100 lb (45 kg), so two people open it. Do not open a fan cowl in wind above 60 mph (96 km/h), and take care above 46 mph (74 km/h). Lifting it more than 55 degrees can damage the door or the pylon. Two hold-open rods on each door hold it open (p.12-15). With the cowl lifted and held, fit the forward rod into the forward HOR bracket on the fan case, then the aft rod onto the power door operating system (PDOS) bracket, each secured with its quick-release pin, and lower the cowl onto them. To close, lift the cowl off the rods, take the aft rod off first, then the forward rod, which goes back into its hold-open rod clip.' });
    const yh = 1.18;                                                   // hinge line height, just under the pylon
    for (const side of ['left', 'right']) {
      const sg = side === 'right' ? 1 : -1, pid = `fan-cowl-${side}`;
      PW.part(pid, { parent: 'fan-cowls', label: `${side === 'left' ? 'Left (inboard)' : 'Right (outboard)'} fan cowl`, src: 'p.12-15; photos',
        info: (side === 'left' ? 'Inboard fan cowl on this right-hand engine. It carries the removable strake, which decreases the turbulence from the airflow between the fan cowl and the fuselage (p.8; inboard cowls only). Its latches hook onto the keepers on the outboard cowl, and its two hold-open rods stow along its bottom.' : 'Outboard fan cowl on this right-hand engine. The panel high on its side is the pressure-relief door, which relieves high pressure in the fan compartment if a duct fails (p.12). It carries the latch keepers with their alignment pins, and its two hold-open rods stow low along its side, under the cowl anti-ice duct.') + ' The three plates are its hoist points, each with two screw holes for the ground handling sling, and the drain holes near the bottom split line let fluid out of the fan compartment. White inside with lime-green frames.' });
      const obj = PW.parts.get(pid).obj, hinge = new THREE.Group(); obj.add(hinge); obj.position.set(0, yh, sg * .21); hinge.position.set(0, -yh, -sg * .21);
      const hc = { obj, axis: 'fan', sign: -sg, max: deg(55), py: yh, pz: sg * .21 }; S.hinges.push(hc);
      const t0 = sg > 0 ? deg(10) : Math.PI + deg(1), tl = Math.PI - deg(11);
      const outer = [], inner = []; for (let i = 0; i <= 18; i++) { const xx = xJ1 - .002 + (xJ2 + .002 - xJ1) * i / 18; outer.push([xx, rOut(xx)]); inner.push([xx, rOut(xx) - .028]); }
      PW.add(pid, G.revolve(outer.concat(inner.slice().reverse()), { seg: 144, thetaStart: sg > 0 ? t0 : Math.PI + deg(.08), thetaLength: tl + deg(.92) }), 'nacellePaint', { into: hinge });   // the skins meet at the bottom split line
      /* the outer skin's fasteners (p.9, p.13): two staggered rows along the hinge line, a dense row along the forward and the aft edge,
         and round the mid stiffener frame on the lower part of the cowl only, where p.13 draws them */
      { const Ad = d => (sg > 0 ? deg(d) : TAU - deg(d));
        fasteners(pid, hinge, [{ a: Ad(12), x0: xJ1 - .04, x1: xJ2 + .04 }, { a: Ad(13.3), x0: xJ1 - .062, x1: xJ2 + .062 }], .045);
        fasteners(pid, hinge, [{ x: xJ1 - .018, a0: Ad(14), a1: Ad(177) }, { x: xJ2 + .018, a0: Ad(14), a1: Ad(177) }], .038);
        fasteners(pid, hinge, [{ x: (xJ1 + xJ2) / 2, a0: Ad(122), a1: Ad(176) }], .05); }
      PW.add(pid, G.revolve(inner.map(([xx, r]) => [xx, r]).concat(inner.map(([xx, r]) => [xx, r - .003]).reverse()), { seg: 72, thetaStart: t0, thetaLength: tl }), 'cowlWhite', { into: hinge });
      for (const xx of [xJ1 - .03, (xJ1 + xJ2) / 2, xJ2 + .03]) PW.add(pid, G.revolve([[xx + .015, rOut(xx) - .03], [xx - .015, rOut(xx) - .03], [xx - .015, rOut(xx) - .075], [xx + .015, rOut(xx) - .075]], { seg: 72, thetaStart: t0, thetaLength: tl }), 'cowlWhite', { into: hinge });   // stiffener frames, white like the skin inside (photos); only the fittings are lime green
      // three latches at the bottom edge (keepers on the right cowl, hooks on the left), three hinges at the top
      for (const f of [.2, .5, .8]) { const xx = xJ1 + (xJ2 - xJ1) * f, a = t0 + (sg > 0 ? tl : 0), m = new THREE.Mesh(G.roundedBox(.12, .024, .03, .005));
        m.position.copy(G.onRing(xx, rOut(xx) - .045, a)); m.rotation.x = a; PW.add(pid, m, sg < 0 ? 'darkBox' : 'steel', { solid: true, into: hinge });   // latch body / keeper inside the edge
        if (sg < 0) { const ah = a + deg(1.3);                                                                   // the flush handle in the left cowl's skin, as on the reverser
          for (const [w, t, l, dr, mat] of [[.156, .003, .04, -.0005, 'darkBox'], [.15, .003, .034, .0008, 'greyPrimer']]) { const hd = new THREE.Mesh(G.roundedBox(w, t, l, .0015)); hd.position.copy(G.onRing(xx, rOut(xx) + dr, ah)); hd.rotation.x = ah; PW.add(pid, hd, mat, { solid: true, into: hinge }); } }
        const hm = new THREE.Mesh(G.roundedBox(.08, .04, .022, .005)); hm.position.set(xx, yh - .05, sg * .221); PW.add(pid, hm, 'lime', { solid: true, into: hinge }); }   // hinge fitting, under the skin beside the pylon's keel
      /* two hold-open rods per cowl (p.12-15, the hangar photos). The forward rod pivots on a bracket about 30 deg up the cowl's side and
         is stowed hanging down and aft along it, its free end in the hold-open rod clip near the bottom edge (p.13). The aft rod pivots
         near the bottom edge at the aft end and is stowed forward along the bottom; the two cross, as p.15 view A draws them, the aft
         one deeper. With the cowl lifted, the forward rod goes on the forward HOR bracket on the fan case, then the aft rod on the door
         opening system (PDOS) bracket at the aft end of the case, each secured by its quick-release pin (p.14). Closing takes the aft
         rod off first. The deployed rods run almost level to the case, as in the photos of an engine with its cowls open */
      { const Kt = PW.kit, Pc = (xx, th, d) => G.onRing(xx, rOut(xx) - d, sg > 0 ? deg(th) : TAU - deg(th));
        /* [pivot, stowed free end, fan case fitting] */
        const RODS = [[Pc(.20, 148, .095), Pc(-.30, 176, .095), G.onRing(.30, .99, G.clock(sg > 0 ? 3.1 : 9.3))],
          [Pc(-.62, 168, .125), Pc(.12, 172, .125), G.onRing(-.84, 1.062, G.clock(sg > 0 ? 3.75 : 8.25))]];
        hc.w = [0, 0];
        RODS.forEach(([pv, sw, fit], k) => {
          for (const [p, nm] of [[pv, 'pivot'], [sw.clone().lerp(pv, .03), 'clip'], [pv.clone().lerp(sw, .55), 'pad']]) {
            const a = Math.atan2(p.z, p.y), r = Math.hypot(p.y, p.z), f = Kt.frame(pid, p.x, a / (Math.PI / 6), r, { into: hinge }), hgt = rOut(p.x) - .031 - r;
            Kt.box(pid, f, [0, hgt / 2 + .006, 0], nm === 'pivot' ? [.05, hgt - .012, .045] : [.024, hgt - .012, .03], 'lime', { round: .004 });   // pivot bracket, stow pad, the clip at the free end
            if (nm === 'clip') for (const s of [-1, 1]) Kt.box(pid, f, [0, -.006, s * .016], [.02, .026, .003], 'steel', { round: .001 }); }      // its snap spring jaws
          if (k === 0) { const f = Kt.frame('fan-case-shell', fit.x, Math.atan2(fit.z, fit.y) / (Math.PI / 6), .969);                         // the forward HOR bracket on the fan case
            Kt.box('fan-case-shell', f, [0, .011, 0], [.04, .022, .035], 'lime', { round: .004 }); Kt.cyl('fan-case-shell', f, [0, .021, 0], 'x', .006, .045, 'steel'); }
          hor(pid, hinge, () => [pv, rodEnd(pv, sw, doorIn(hc, fit), hc.w[k])], { ls: pv.distanceTo(sw) }); }); }
      /* p.12-13: three hoist points on each cowl, each a doubler with two screw holes for the ground handling sling (two on the side,
         forward and aft, one low and aft); drain holes near the bottom split line; on the outboard cowl the pressure-relief door, a third
         of the way down from the hinges and mid-length, between the stiffeners, which relieves the fan compartment if a duct fails; wear
         strips round the forward and aft edges; the hinge pins with their retaining clips; and on the keeper side the alignment pins that
         enter holes beside the latches as the cowls close (p.14-15) */
      { const Kt = PW.kit, hs = c => sg > 0 ? c : 12 - c, fx = f => xJ1 + (xJ2 - xJ1) * f;
        for (const [f, h] of [[.3, 3.9], [.7, 3.9], [.6, 5.3]])   // painted-over doubler with its edge showing faintly and the sling's two screw holes, as in photos
          flushPanel(pid, hinge, fx(f), G.clock(hs(h)), .048, .118, { step: 0, seam: '#0a2a72', lw: .0008, round: .007, holes: [[0, -.03], [0, .03]] });
        for (const f of [.22, .5, .78]) { const xx = fx(f), g = Kt.frame(pid, xx, hs(5.9), rOut(xx), { into: hinge });
          Kt.cyl(pid, g, [0, .0004, 0], 'y', .0045, .0012, 'darkBox'); }
        if (sg > 0) flushPanel(pid, hinge, fx(.45), G.clock(2.4), .26, .3, { seam: '#051640', lw: .0016, round: .02 });   // the door's gap, darker than a panel seam, and its frame's fasteners
        for (const xx of [xJ1 - .004, xJ2 + .004]) PW.add(pid, G.revolve([[xx + .012, rOut(xx) - .028], [xx - .012, rOut(xx) - .028], [xx - .012, rOut(xx) - .033], [xx + .012, rOut(xx) - .033]], { seg: 72, thetaStart: t0, thetaLength: tl }), 'rubber', { into: hinge });   // wear strips
        for (const f of [.2, .5, .8]) { const xx = fx(f);
          Kt.cyl(pid, Kt.frame(pid, xx, 0, 1, { into: hinge }), [0, yh - .05 - 1, sg * .221], 'x', .007, .1, 'steel');                    // hinge pin through the hinge
          if (sg > 0) { const g = Kt.frame(pid, xx + .075, hs(5.97), rOut(xx) - .045, { into: hinge }); Kt.cyl(pid, g, [0, 0, .006], 'z', .006, .024, 'steel'); Kt.cone(pid, g, [0, 0, .026], 'z', .002, .006, .016, 'steel'); } } }
      /* the placards and stencils in the photo, on the inboard cowl (the outboard one taken to carry the same): two white placards with red
         print a hand's width under the hinge line at mid-length, and two small stencils just below the strake's line, one ahead of it */
      { const Ad = d => (sg > 0 ? deg(d) : TAU - deg(d));
        mark(pid, hinge, -.36, Ad(14.4), .15, .026, [[5, 4, 7]], PLACARD);
        mark(pid, hinge, -.37, Ad(16), .16, .026, [[6, 3, 5]], PLACARD);
        mark(pid, hinge, .15, Ad(65), .06, .012, [[3, 4]]);
        mark(pid, hinge, -.66, Ad(65), .06, .012, [[5, 3]]); }
    }
    { /* strake on the inboard (left) cowl, about 30 deg above the horizontal (10 o'clock), about 36 in long. Its aft end is about 8 cm
         short of the reverser joint, as p.9 and the photo of a Breeze engine show. p.9 draws it rising from a sharp leading edge, its outer
         edge gently convex, to its full height of about 0.22 m at the square-cut aft end (until 2026-10-12 it sat 0.11 m further forward
         and was drawn 0.14 m high, tallest at the front) */
      const a = G.clock(10), xa = xJ1 - .36, xb = xa - .91, h = .22, p = PW.parts.get('fan-cowl-left').obj.children[0];
      const sh = new THREE.Shape(); sh.moveTo(0, 0); for (let i = 1; i <= 10; i++) { const t = i / 10; sh.lineTo(-.91 * t, h * (1 - Math.pow(1 - t, 1.6))); } sh.lineTo(-.91, 0); sh.lineTo(0, 0);
      const g = new THREE.ExtrudeGeometry(sh, { depth: .008, bevelEnabled: false }); g.translate(0, 0, -.004);
      const m = new THREE.Mesh(g); m.position.copy(G.onRing(xa, rOut(xa) - .002, a)); m.rotation.x = a; m.rotateZ(0); PW.add('fan-cowl-left', m, 'nacellePaint', { solid: true, into: p });
      /* p.13: its base flange, fastened to the cowl along both sides */
      const fl = new THREE.Mesh(G.roundedBox(.87, .002, .03, .001)); fl.position.copy(G.onRing(xa - .45, rOut(xa - .45) + .0008, a)); fl.rotation.x = a; PW.add('fan-cowl-left', fl, 'nacellePaint', { solid: true, into: p });
      fasteners('fan-cowl-left', p, [-1, 1].map(s => ({ a: a + s * .0095, x0: xa - .05, x1: xa - .86, d: -.0018 })), .075);
    }

    /* ============================== THRUST REVERSER DOORS ============================== */
    PW.part('thrust-reverser', { parent: 'nacelle', label: 'Thrust reverser doors', src: 'p.18-43, p.324-379; TTM ch. 78',
      info: 'Two C-duct doors, left and right, hinged at the pylon hinge beam and latched together at the bottom. Each carries its translating sleeve, eight carbon fibre cascade boxes, five blocker doors, two hydraulic actuators on the torque box at its forward end, and its half of the inner fixed structure (IFS) that encloses the core.\n\nThe actuation is electrically controlled and hydraulically worked (hydraulic system No. 1 for the left engine, No. 2 for the right). The EEC opens the isolation control unit (ICU) in the aft pylon and the directional control unit (DCU) in the forward pylon; the CDCs open the track lock valves. In reverse the sleeves move aft to uncover the cascades and the blocker doors swing into the fan duct, turning the fan air forward; the core stream is not reversed. A white REV icon shows in transit, green when deployed, amber for a fault.\n\nFor dispatch with a reverser inoperative, and for safety during maintenance, the manual inhibit lever on the ICU isolates the system and is locked by the inhibit pin stored on the ICU. For dispatch, a lockout pin from the latch access bay then pins each sleeve to its latch beam (p.372-375).' });
    const yhT = 1.0;
    /* the IFS outer line (inner wall of the fan duct) and the duct's outer wall (inside the T/R door) */
    const bi = D.GEN.lines.bypassInner, xI0 = bi[bi.length - 1][0], rI0 = bi[bi.length - 1][1];
    const IFS = [[xI0, rI0], [xI0 - .2, .555], [-1.35, .585], [-1.9, .588], [-2.2, .575], [xTE, .53], [xTE - .25, .47], [xCN + .004, .392]];
    const DUCT = [[-.92, .945], [-1.4, .955], [-1.981, .952], [-2.3, .94], [xTE, .93]];
    const rIFS = xx => G.interp(IFS, xx), rDuct = xx => G.interp(DUCT, xx);
    for (const side of ['left', 'right']) {
      const sg = side === 'right' ? 1 : -1, pid = `tr-${side}`;
      PW.part(pid, { parent: 'thrust-reverser', label: `${side === 'left' ? 'Left' : 'Right'} thrust reverser door`, explode: [0, .25, sg * .9], src: 'p.18-23; photos',
        info: `${side === 'left' ? 'Left' : 'Right'} C-duct: outer fixed cowl, translating sleeve, cascades, blocker doors and actuators outside, the IFS half inside. It hinges at the pylon and latches to the other door at the bottom.` + (side === 'right' ? ' The oil tank access door is on its IFS at about 2:30.' : ' Its IFS carries the air/oil cooler window and the IFS pressure-relief door at 9 o\'clock, and its latch beam carries the latch access door where the drain mast exits.') });
      const obj = PW.parts.get(pid).obj, hinge = new THREE.Group(); obj.add(hinge); obj.position.set(0, yhT + .2, sg * .2); hinge.position.set(0, -(yhT + .2), -sg * .2);
      /* max is the door at full extension of its single-stage locking actuator (p.41); it then settles back onto the lock (TR.hold). About
         31 deg, as the actuator's stroke allows and as the photo of an engine with all its cowls open shows */
      const hd = { obj, axis: 'tr', sign: -sg, max: deg(31), py: yhT + .2, pz: sg * .2 }; S.hinges.push(hd);
      const t0 = sg > 0 ? deg(10) : Math.PI + deg(1), tl = Math.PI - deg(11);
      /* inner structure (IFS, fan duct outer wall, forward frame) stops 6 deg either side of 6 o'clock for the lower bifurcation (it was 4 deg until 2026-10-07; p.31 and the photo from below show a bay about 0.2 m wide) */
      const it0 = sg > 0 ? t0 : Math.PI + deg(6), itl = Math.PI - deg(16);
      const rev = (prof, mat, o) => PW.add(o && o.pid || pid, G.revolve(prof, { seg: 72, thetaStart: o && o.inner ? it0 : t0, thetaLength: o && o.inner ? itl : tl }), mat, Object.assign({ into: hinge }, o || {}));
      /* door angles are given from 12 o'clock down this door's side, in degrees: A() turns one into the model's angle, span() into a
         revolve range, hOf() into a clock position */
      const A = th => sg > 0 ? deg(th) : TAU - deg(th), span = (th0, th1) => ({ thetaStart: sg > 0 ? deg(th0) : TAU - deg(th1), thetaLength: deg(th1 - th0) });
      const hOf = th => (sg > 0 ? th : 360 - th) / 30;
      /* p.19, p.29-31, p.331-333, TTM 78 fig. 2: the translating sleeve is the door's whole outer cowl, from the fan cowl at ZS 732 to the
         trailing edge. Under its forward part, directly behind the torque box, sit the cascades; its inner wall carries the blocker doors.
         (Until 2026-10-08 the model had a fixed outer cowl to ZS 772 with the cascades behind it, which the manual does not show.) A skin
         joint crosses the sleeve at ZS 771 (TTM 01 fig. 28, p.333). The sleeve stops 6 deg short of 6 o'clock, where the latch beam's
         fairing forms the bottom of the nacelle (p.29-31). Stations: torque box to xTB, cascades xC0 to xC1, the sleeve's inner wall from
         xSI, the aft wall of the sleeve's cascade cavity at xBH (where the actuator rods attach) */
      const xTB = xJ2 - .062, xC0 = xTB - .006, xC1 = xC0 - .46, xSI = xTB - .008, xBH = xTB - .758, xSk = x(Z.sleeveSeam), STROKE = S.stroke;
      /* the fan duct outer wall under the torque box, from the end of the fan case's duct ring at x -0.862 (it began at -0.93 until
         2026-10-12, leaving a 7 cm slot into the fan compartment), and the torque box itself: fixed */
      const dw = []; for (let i = 0; i <= 6; i++) { const xx = -.862 + (xTB + .003 + .862) * i / 6; dw.push([xx, rDuct(xx)]); }
      rev(G.shellProfile(dw.map(([xx, r]) => [xx, r + .012]), dw), 'cowlWhite', { inner: true });
      /* p.18, p.42, p.60: the forward frame's V-blade. A web rises from the duct wall behind the mount ring, a lip runs forward over the
         ring's aft edge, and the blade drops into the V-groove (flange D, x -0.833), which aligns and supports the closed door. It stops
         at 5:36 and 6:24, where the cowl anti-ice duct and the harnesses cross the flange into the lower bifurcation */
      PW.add(pid, G.revolve([[-.806, 1.008], [-.806, 1.0], [-.815, .982], [-.824, 1.0], [-.848, 1.0], [-.848, .958], [-.862, .958], [-.862, 1.008]],
        { seg: 72, thetaStart: sg > 0 ? it0 : deg(192), thetaLength: sg > 0 ? deg(168) - it0 : it0 + itl - deg(192) }), 'titanium', { into: hinge });
      rev([[xJ2 - .002, rDuct(xJ2) + .012], [xTB, rDuct(xJ2) + .012], [xTB, rOut(xJ2) - .025], [xJ2 - .002, rOut(xJ2) - .025]], 'lime', { inner: true });
      /* p.330-333: sixteen carbon fibre cascade boxes, eight per door, bolted between the torque box and the aft cascade ring. Each is a
         grid of curved vanes that turn the air forward, with strongbacks across them; gaps where the two actuators pass; a flow blocker
         at each end of the row, at the hinge beam and the latch beam */
      const cid = `${pid}-cascades`;
      PW.part(cid, { parent: pid, label: `${side === 'left' ? 'Left' : 'Right'} cascades, aft ring and flow blockers`, attach: hinge, src: 'p.18-19, p.330-333; TTM 78 fig. 2',
        info: 'Eight carbon fibre cascade boxes on this door, sixteen on the engine, fixed between the torque box and the aft cascade ring, directly behind the torque box. The stowed sleeve covers them; when it moves aft the fan air leaves through them, and their curved vanes turn it forward for reverse thrust and outward, away from the inlet, the fuselage and the flight controls.\n\nThe boxes are not interchangeable: each is designed for the airflow its position needs, and their fastener patterns make it impossible to fit one in the wrong place. The flow blockers at the hinge beam and the latch beam stop fan air leaking past the ends of the row. The gaps in the row are where the two sleeve actuators run aft from the torque box.' });
      { const ra = .965, rb = 1.035, nV = 16, frames = [], vanes = [];
        const BOX = [[14, 27.5], [27.5, 41], [49, 69.5], [69.5, 90], [90, 110.5], [110.5, 131], [139, 154.5], [154.5, 170]];
        const sp = (a0, a1, seg) => Object.assign({ seg: seg || Math.max(2, Math.round((a1 - a0) / 2)) }, span(a0, a1));
        for (const [b0, b1] of BOX) { const c0 = b0 + .2, c1 = b1 - .2, n = Math.max(2, Math.round((b1 - b0) / 5));
          frames.push(G.revolve([[xC0, ra], [xC0 - .012, ra], [xC0 - .012, rb], [xC0, rb]], sp(c0, c1)), G.revolve([[xC1 + .012, ra], [xC1, ra], [xC1, rb], [xC1 + .012, rb]], sp(c0, c1)));   // forward and aft rails
          for (let k = 0; k <= n; k++) { const t = c0 + (c1 - c0) * k / n, w = k === 0 || k === n ? .45 : .22;                                  // end walls and strongbacks
            frames.push(G.revolve([[xC0, ra], [xC1, ra], [xC1, rb], [xC0, rb]], sp(Math.max(c0, t - w), Math.min(c1, t + w), 1))); }
          for (let i = 1; i < nV; i++) { const xx = xC0 - .012 + (xC1 + .024 - xC0) * i / nV;                                                     // vanes, leaning forward at the outside
            vanes.push(G.revolve([[xx - .006, ra + .003], [xx - .001, (ra + rb) / 2], [xx + .009, rb - .003], [xx + .013, rb - .003], [xx + .003, (ra + rb) / 2], [xx - .002, ra + .003]], sp(c0, c1))); } }
        PW.add(cid, G.merge(frames), 'cascadeGrey'); PW.add(cid, G.merge(vanes), 'darkBox');
        PW.add(cid, G.revolve([[xC1, .962], [xC1 - .02, .962], [xC1 - .02, 1.05], [xC1, 1.05]], sp(10, 174, 72)), 'greyPrimer');                    // aft cascade ring
        for (const [f0, f1] of [[10, 14], [170, 174]]) PW.add(cid, G.revolve([[xC0, .962], [xC1, .962], [xC1, 1.042], [xC0, 1.042]], sp(f0, f1, 2)), 'greyPrimer'); }   // flow blockers
      /* the translating sleeve: its own group so it can slide aft. Outer skin over the cascade cavity, the solid aft body to the trailing
         edge, the cavity's aft wall, the inner wall facing the fan duct, the skin joint, the actuator access panels and the blocker doors */
      const sid = `${pid}-sleeve`;
      PW.part(sid, { parent: pid, label: `${side === 'left' ? 'Left' : 'Right'} translating sleeve and blocker doors`, attach: hinge, src: 'p.18-19, p.330-337, p.374-375; TTM 78 fig. 2 and 3',
        info: 'The whole outer cowl of the reverser door, from the fan cowl back to the trailing edge, which slides aft to deploy (about half a metre in the model; the manual gives no stroke). Stowed, it covers the cascades in a cavity in its forward part. Two hydraulic actuators on the torque box move it: the locking feedback actuator in the upper section, whose LVDT reports its position, and the locking actuator in the lower section, kept in step by a flexible drive shaft; their rod ends are reached through the two access panels on its skin. A track lock unit on the latch beam holds it stowed.\n\nIts inner wall carries five composite blocker doors, hinged at their forward edge on clevises in the wall. As the sleeve moves aft, each door\'s drag link pulls it down across the fan duct behind the cascades, so the fan air goes out through them. The upper and lower doors are unique to their positions; drain holes stop water collecting in them, and rest pads damp them when stowed.\n\nA small blanking plate on its lower edge near the front covers the hole for the reverser lockout pin.' });
      const sl = PW.parts.get(sid).obj; S.sleeves.push(sl);
      { const SP = Object.assign({ seg: 144 }, span(10, 174)), so = [], sa = [], sw = [];
        for (let i = 0; i <= 14; i++) { const xx = xJ2 - .002 + (xBH - xJ2 + .002) * i / 14; so.push([xx, rOut(xx)]); }
        PW.add(sid, G.revolve(G.shellProfile(so, so.map(([xx, r]) => [xx, r - .018])), SP), 'nacellePaint');                                       // outer skin over the cavity
        for (let i = 0; i <= 10; i++) { const xx = xBH + (xTE - xBH) * i / 10; sa.push([xx, rOut(xx)]); }
        PW.add(sid, G.revolve(G.shellProfile(sa, sa.map(([xx]) => [xx, rDuct(xx) + .004])), SP), 'nacellePaint');                                 // aft body to the trailing edge
        PW.add(sid, G.revolve([[xBH + .001, rDuct(xBH) + .004], [xBH - .009, rDuct(xBH) + .004], [xBH - .009, rOut(xBH) - .018], [xBH + .001, rOut(xBH) - .018]], SP), 'greyPrimer');   // cavity aft wall
        for (let i = 0; i <= 12; i++) { const xx = xSI + (xTE - xSI) * i / 12; sw.push([xx, rDuct(xx) + .004]); }
        PW.add(sid, G.revolve(G.shellProfile(sw, sw.map(([xx, r]) => [xx, r - .004])), SP), 'cowlWhite');                                         // inner wall: the duct's outer wall
        PW.add(sid, G.revolve([[xSk + .002, rOut(xSk) + .0004], [xSk - .002, rOut(xSk) + .0004], [xSk - .002, rOut(xSk) - .002], [xSk + .002, rOut(xSk) - .002]], SP), 'darkBox');   // skin joint, ZS 771
        fasteners(sid, PW.parts.get(sid).obj, [{ x: xSk + .011, a0: A(11), a1: A(173) }, { x: xSk - .011, a0: A(11), a1: A(173) }], .038);   // a row each side of the joint (p.9)
        /* TTM 78 fig. 3: an access panel over each actuator's rod end, its fasteners painted over */
        for (const th of [45, 135]) flushPanel(sid, sl, xBH + .04, A(th), .2, .14, { round: .02 });
        /* the photo's markings on the door: a small white placard and a stencil high up just aft of the fan cowl, two lines above the
           upper actuator access panel */
        mark(sid, sl, xJ2 - .065, A(13.5), .085, .022, [[3, 5], [4, 6]], { paper: '#f2f2ee', ink: '#30343a' });
        mark(sid, sl, xJ2 - .07, A(16.4), .045, .01, [[4, 2]]);
        mark(sid, sl, -1.62, A(33), .075, .02, [[5, 4], [3, 6]]); }
      /* five blocker doors (p.332-333): curved composite panels hinged on clevises in the sleeve's inner wall just aft of the torque box,
         flush with it when stowed; the split lines are measured off the p.333 deployed view. Each narrows toward its free edge, so that
         deployed the five close the duct like slices of a ring. As the sleeve moves aft, each door's fixed-length drag link, anchored on a
         fitting near the front of the IFS (p.23), pulls it down behind the cascades; the door angle is solved every frame from the link
         length (the nacelle animation below) */
      { const xh0 = xSI - .01, LD = .36, KN = .6, xF = -1.22, DOORS = [[10.5, 40.75], [41.25, 76.75], [77.25, 111.75], [112.25, 147.75], [148.25, 173.5]];
        const did = `${pid}-drag-links`;
        PW.part(did, { parent: pid, label: `${side === 'left' ? 'Left' : 'Right'} drag links and IFS fittings`, attach: hinge, src: 'p.23, p.332-333; TTM 78 fig. 2',
          info: 'Five drag links, one per blocker door: fixed-length aluminium rods with an airfoil cross-section, since they sit in the fan stream in forward thrust, and Teflon-coated spherical bearings at both ends. The inner end is on a drag link fitting near the front of the IFS (ten fittings on the engine); the outer end is on a housing bracket on the blocker door, whose leaf spring absorbs the link loads.\n\nAs the sleeve moves aft the links swing back, pulling the blocker doors down across the duct; deployed they lie almost along the IFS.' });
        for (const [d0, d1] of DOORS) { const a = A((d0 + d1) / 2), ph = deg((d1 - d0) / 2), rp = rDuct(xh0), rc = rp * Math.cos(ph);
          const piv = new THREE.Group(); piv.position.copy(G.onRing(xh0, rc, a)); piv.rotation.x = a; sl.add(piv);
          /* the door as a closed slab in the pivot frame (x forward, y out at its centre, z round): outer face flush with the wall */
          const P = (u, v, s) => { const rr = rDuct(xh0 - u * LD) - .002 - s * .016, f = v * ph * (1 - u * (1 - KN)); return [-u * LD, rr * Math.cos(f) - rc, rr * Math.sin(f)]; };
          PW.add(sid, slab(10, 8, P), 'cowlWhite', { into: piv });
          const fb = new THREE.Group(); fb.position.set(-.34, P(.944, 0, 1)[1] - .008, 0); piv.add(fb);                                          // drag link housing bracket
          PW.kit.box(sid, fb, [0, 0, 0], [.05, .016, .03], 'greyPrimer', { round: .004 });
          for (const s of [-1, 1]) { const zc = rp * Math.sin(ph * .8) * s, yc = rp * Math.cos(ph * .8) - rc;                                     // hinge fittings and the wall's clevises
            PW.kit.box(sid, piv, [-.012, yc - .012, zc], [.03, .016, .02], 'steel', { round: .003 });
            PW.kit.cyl(sid, piv, [0, yc - .006, zc], 'z', .005, .03, 'steel'); }
          const ly = P(.944, 0, 1)[1] - .016, lx = -.34;                                                                                       // the link's door end, in the pivot frame
          const rF = rIFS(xF) + .025, A0x = xh0 + lx, A0r = rc + ly, L = Math.hypot(A0x - xF, A0r - rF);
          const fi = PW.kit.frame(did, xF, hOf((d0 + d1) / 2), rIFS(xF));                                                                    // drag link fitting on the IFS
          PW.kit.box(did, fi, [0, .009, 0], [.05, .018, .036], 'greyPrimer', { round: .004 }); PW.kit.box(did, fi, [0, .02, 0], [.022, .014, .028], 'greyPrimer', { round: .003 });
          const link = new THREE.Group(); PW.parts.get(did).obj.add(link);
          PW.add(did, new THREE.CylinderGeometry(1, 1, L - .022, 12).scale(.012, 1, .0045), 'castAl', { into: link, solid: true });                    // airfoil-section rod
          for (const s of [-1, 1]) PW.add(did, new THREE.CylinderGeometry(.0085, .0085, .014, 14).rotateX(Math.PI / 2).translate(0, s * L / 2, 0), 'steel', { into: link, solid: true });   // spherical bearing eyes
          S.blockers.push({ piv, a, xh0, rc, lx, ly, xF, rF, L, link });
          aimLink(S.blockers[S.blockers.length - 1], 0, 0); } }
      /* p.374-375: the lockout pin hole in the sleeve's lower edge near its forward end, covered by a blanking plate unless the reverser
         is locked out; the pin then goes down through it into the lug on the latch beam */
      { const fb = PW.kit.frame(sid, xJ2 - .10, hOf(173.4), rOut(xJ2 - .10)), bp = PW.kit.sub(fb, [0, 0, 0]);
        PW.kit.box(sid, bp, [0, .0008, 0], [.036, .0016, .024], 'greyPrimer', { round: .008 });
        for (const s of [-1, 1]) PW.kit.hex(sid, bp, [s * .011, .0021, 0], 'y', .0024, .0012, 'steel');
        PW.kit.cyl(sid, fb, [0, .0002, 0], 'y', .0047, .0004, 'darkBox');                                                       // the pin hole under it
        const L = PW.lockout = PW.lockout || { on: 0 }; (L.groups = L.groups || []).push([bp, false]); }
      /* the IFS half: white composite wall facing the fan stream, quilted stainless blanket facing the core, bare metal aft core cowl */
      const iid = `${pid}-ifs`;
      PW.part(iid, { parent: pid, label: `${side === 'left' ? 'Left' : 'Right'} inner fixed structure (IFS)`, attach: hinge, src: 'p.18-23; photos',
        info: 'The half of the inner fixed structure carried by this door. Outside it is the inner wall of the fan duct; inside, facing the core, it is covered by quilted stainless thermal blankets with silicone fire seals along its edges, so the core compartment is a designated fire zone.' + (side === 'right' ? ' The oil tank access door (OTAD) at about 2:30 is the oil servicing point, with the precooler exhaust door aft of it.' : ' The air/oil cooler inlet and exhaust window and the IFS pressure-relief door are on this side at about 9 o\'clock; a relief door found open points to a bleed duct burst in the core compartment.') });
      /* the IFS halves stop 6 deg either side of 6 o'clock as far aft as the bifurcation walls go: the lower bifurcation between them
         (about 12 cm wide at the core, 20 cm at the duct wall) carries the ignition cables, the core harnesses, the cowl anti-ice duct and the drain mast across
         the fan duct. The outer cowl and sleeve still meet at the latch beam */
      const xB = xTE + .25;                                                                                   // aft end of the bifurcation walls
      for (const [xa, xb, a0, al, n] of [[xI0, xB, it0, itl, 20], [xB, xTE - .02, t0, tl, 6]]) {
        const ifo = []; for (let i = 0; i <= n; i++) { const xx = xa + (xb - xa) * i / n; ifo.push([xx, rIFS(xx)]); }
        PW.add(iid, G.revolve(G.shellProfile(ifo, ifo.map(([xx, r]) => [xx, r - .02])), { seg: 72, thetaStart: a0, thetaLength: al }), 'cowlWhite');
        PW.add(iid, metricUV(G.revolve(G.shellProfile(ifo.map(([xx, r]) => [xx, r - .02]), ifo.map(([xx, r]) => [xx, r - .032])), { seg: 72, thetaStart: a0 + deg(1), thetaLength: al - deg(2) }), a0), 'blanket'); }
      /* the core cowl's two fire detection elements (built below): [x, clock of the upper end, clock of the lower end, which way the
         lower end bends to its connectors: +1 forward, -1 aft], read off p.21 and Brian's photos from below; long one first */
      const fireEls = sg > 0 ? [[-2.12, 2.15, 4.2, 1], [-1.60, 3.9, 4.2, -1]] : [[-2.23, 10.25, 8.5, 1], [-1.81, 9.0, 8.55, -1]];   // on the right the short one clears the OCM's filter cover and the leads pass above the tank's supply tube
      const fireZones = fireEls.map(([xx, ha, hb]) => [xx + .02, xx - .02, Math.min(ha, hb) - .1, Math.max(ha, hb) + .1])
        .concat([[fireEls[1][0] + .02, fireEls[0][0] - .02, Math.min(fireEls[0][2], fireEls[1][2]) - .3, Math.max(fireEls[0][2], fireEls[1][2]) + .3]]);   // the bends, connectors and leads
      /* photos: the blanket is made up in panels with raised hems, held by round stainless studs (a washer with the stud's nut standing
         in the middle) along the hems and across the panels, about 0.19 m apart; none over the openings, the fire elements or the
         bifurcation edges. Hems run round the engine at every other stud row and fore and aft along every third stud column */
      { const holes = sg > 0 ? [[-1.79, -2.07, 2.15, 3.35], [-2.16, -2.46, 2.15, 3.1], [-1.53, -1.71, 1.9, 2.3]] : [[-1.42, -2.08, 9.0, 10.6], [-2.33, -2.55, 9.2, 10.0], [-2.095, -2.135, 9.05, 9.3]];
        const clk = th => (th / (Math.PI / 6) % 12 + 12) % 12, rB = xx => rIFS(xx) - .032;
        const inBox = (list, xx, th, pad) => list.some(([xa, xb, ha, hb]) => xx <= xa + pad && xx >= xb - pad && clk(th) >= ha - pad * 6 && clk(th) <= hb + pad * 6);
        const inHole = (xx, th, pad) => inBox(holes, xx, th, pad), inFire = (xx, th, pad) => inBox(fireZones, xx, th, pad);
        const btn = [], nut = [], hems = [], cols = []; for (let th = it0 + deg(9); th < it0 + itl - deg(8); th += .33) cols.push(th);
        /* a hem is a flat fold about 18 mm wide standing 3 mm off the blanket, broken where it would cross an opening or a fire element */
        const hem = pts => { let run = []; const flush = () => { if (run.length > 1) { const [xa, ta] = run[0], [xb, tb] = run[run.length - 1];
            if (xa === xb) { const r = rB(xa), lo = Math.min(ta, tb), hi = Math.max(ta, tb);
              hems.push(G.revolve([[xa + .009, r + .001], [xa + .005, r - .003], [xa - .005, r - .003], [xa - .009, r + .001]], { seg: Math.max(2, Math.round((hi - lo) / deg(2))), thetaStart: lo, thetaLength: hi - lo })); }
            else { const pr = run.map(([xx]) => [xx, rB(xx) - .003]).concat(run.map(([xx]) => [xx, rB(xx) + .001]).reverse()), dth = .014 / rB(xa);
              hems.push(G.revolve(pr, { seg: 2, thetaStart: ta - dth / 2, thetaLength: dth })); } } run = []; };
          for (const [xx, th] of pts) { if (inHole(xx, th, .03) || inFire(xx, th, .015)) flush(); else run.push([xx, th]); } flush(); };
        let row = 0;
        for (let xx = -1.06; xx > xTE - .02; xx -= .19, row++) {                                        // to the blanket's aft end (a row hung below the bare aft collar until 2026-10-14)
          for (const th of cols) { if (inHole(xx, th, 0) || inFire(xx, th, .025)) continue;
            const place = (g, dr) => g.rotateX(th).translate(...G.onRing(xx, rB(xx) - dr, th).toArray());
            btn.push(place(new THREE.CylinderGeometry(.019, .023, .004, 20), .002)); nut.push(place(new THREE.CylinderGeometry(.0062, .0062, .007, 6), .0075)); }
          if (row % 2) { const pts = []; for (let th = it0 + deg(4); th <= it0 + itl - deg(4); th += deg(2)) pts.push([xx, th]); hem(pts); } }
        for (let k = 2; k < cols.length - 1; k += 3) { const pts = []; for (let xx = -1.02; xx > xTE - .015; xx -= .02) pts.push([xx, cols[k]]); hem(pts); }
        PW.add(iid, G.merge(btn), 'plateAl', { solid: true }); PW.add(iid, G.merge(nut), 'steel', { solid: true }); PW.add(iid, metricUV(G.merge(hems), it0), 'blanket'); }
      /* p.21 and the photos: red-brown bulb fire seals along the IFS half's forward edge, where it closes against the firewall, and along
         its hinge beam edge */
      { const ha = sg > 0 ? it0 + deg(2) : it0 + itl - deg(2), along = [], gaps = sg > 0 ? [] : [8.2, 9.17];   // gaps where the VFG oil lines pass the firewall
        const a0 = it0 + deg(2), a1 = it0 + itl - deg(2), cuts = [a0];
        for (const g of gaps) cuts.push(G.clock(g - .12), G.clock(g + .12)); cuts.push(a1);
        for (let k = 0; k < cuts.length; k += 2) { const arc = [], n = Math.max(2, Math.round((cuts[k + 1] - cuts[k]) / deg(5)));
          for (let i = 0; i <= n; i++) arc.push(G.onRing(xI0 - .011, rIFS(xI0 - .011) - .028, cuts[k] + (cuts[k + 1] - cuts[k]) * i / n));
          PW.add(iid, G.tube(arc, .013, { radial: 12 }), 'siliconeSeal'); }
        for (let xx = -1.08; xx >= -2.15; xx -= .0825) along.push(G.onRing(xx, rIFS(xx) - .03, ha));             // aft of the fuel supply hose and forward of the thrust links
        PW.add(iid, G.tube(along, .013, { radial: 12 }), 'siliconeSeal'); }
      /* the openings and doors seen from the core side (photos from below and aft). On the left the air/oil cooler window shows as two
         openings side by side over the cooler's plenums: the forward (inlet) one framed by a thick orange silicone gasket, the aft
         (exhaust) one by a plain metal frame; the cooler carries the exhaust joint's gasket. On the right the oil tank access and
         precooler exhaust doors are closed panels, so only their raised outlines show, with the hinges and latch. Until 2026-10-12 all
         three had orange gaskets and the left one framed the whole cooler */
      { const frame = (x0, x1, h, half, mat, w, dr) => { const a = G.clock(h), ri = xx => rIFS(xx) - .033, ro = xx => rIFS(xx) - .033 - dr, n = 6;
          for (const xx of [x0, x1]) PW.add(iid, G.revolve([[xx + w / 2, ri(xx)], [xx - w / 2, ri(xx)], [xx - w / 2, ro(xx)], [xx + w / 2, ro(xx)]], { seg: 16, thetaStart: a - half - w / .55, thetaLength: 2 * half + 2 * w / .55 }), mat);
          for (const s of [-1, 1]) { const pr = []; for (let i = 0; i <= n; i++) { const xx = x0 + (x1 - x0) * i / n; pr.push([xx, ri(xx)]); } for (let i = n; i >= 0; i--) { const xx = x0 + (x1 - x0) * i / n; pr.push([xx, ro(xx)]); }
            PW.add(iid, G.revolve(pr, { seg: 2, thetaStart: s > 0 ? a + half : a - half - w / .55, thetaLength: w / .55 }), mat); } };
        const hole = (x0, x1, h, half) => { const a = G.clock(h), xs = []; for (let i = 0; i <= 6; i++) xs.push(x0 + (x1 - x0) * i / 6);
          PW.add(iid, G.revolve(xs.map(xx => [xx, rIFS(xx) - .0322]).concat(xs.map(xx => [xx, rIFS(xx) - .0332]).reverse()), { seg: 12, thetaStart: a - half, thetaLength: 2 * half }), 'darkBox'); };
        const fit = (xx, h, dr, l, w, t) => { const f = PW.kit.frame(iid, xx, h, rIFS(xx) - .032); PW.kit.box(iid, f, [0, -dr, 0], [l, t, w], 'steel', { round: Math.min(l, t, w) * .3 }); };
        /* p.21 and p.23 draw the precooler exhaust door the size of the oil tank access door and beside it in the same clock band (until
           2026-10-14 it was 0.2 x 0.18 m, lower and further forward) */
        if (sg > 0) { frame(-1.80, -2.06, 2.62, .21, 'blanket', .022, .005); frame(-2.18, -2.44, 2.62, .21, 'blanket', .022, .005);
          for (const [xx, h] of [[-1.86, 2.2], [-2.00, 2.2], [-2.24, 2.2], [-2.38, 2.2]]) fit(xx, h, .007, .04, .018, .01);             // hinges along the upper edges
          fit(-1.93, 3.03, .006, .05, .02, .008); fit(-2.31, 3.03, .006, .04, .02, .008);                                                 // latches on the lower edges
          /* the round port where the ACC duct from the scoop meets the door, its orange seal ring round the duct's end: level with the
             oil tank access door's upper edge, as p.21 and p.23 draw it (it was at 1:36 until 2026-10-14) */
          const a = G.clock(2.1), rP = rIFS(-1.62) - .032;
          PW.add(iid, new THREE.TorusGeometry(.046, .009, 10, 28).rotateX(a - Math.PI / 2).translate(...G.onRing(-1.62, rP - .009, a).toArray()), 'gasketOrange', { solid: true });
          PW.add(iid, new THREE.CylinderGeometry(.038, .038, .002, 24).rotateX(a).translate(...G.onRing(-1.62, rP - .0005, a).toArray()), 'darkBox'); }
        else { frame(-1.545, -1.645, 9.9, .26, 'gasketOrange', .03, .012); hole(-1.545, -1.645, 9.9, .26);                           // clear of the VFG oil line at x -1.51
          frame(-1.845, -1.945, 9.9, .26, 'plateAl', .016, .005); hole(-1.845, -1.945, 9.9, .26);
          frame(-2.35, -2.53, 9.6, .17, 'blanket', .022, .005);                                                                          // the pressure-relief door's outline
          /* p.298: the access hole for the starter air valve's 3/8 in square-drive manual override, over the valve's override funnel; p.21
             and p.23 draw a small hole just aft of the cooler window. A grommet inside, a flush plug outside */
          const a = G.clock(9.17), xh = -2.115;
          PW.add(iid, new THREE.TorusGeometry(.015, .004, 8, 20).rotateX(a - Math.PI / 2).translate(...G.onRing(xh, rIFS(xh) - .036, a).toArray()), 'rubber', { solid: true });
          PW.add(iid, new THREE.CylinderGeometry(.012, .012, .002, 20).rotateX(a).translate(...G.onRing(xh, rIFS(xh) - .0325, a).toArray()), 'darkBox');
          PW.add(iid, new THREE.CylinderGeometry(.016, .016, .003, 20).rotateX(a).translate(...G.onRing(xh, rIFS(xh) + .0005, a).toArray()), 'plateAl', { solid: true }); } }
      /* p.20-23: three core scoop vents on each IFS half, small scoops in the fan stream that ram air into the core compartment to
         ventilate it; positions measured off p.23 (fraction of the IFS length, clock) */
      { const L0 = xI0, L1 = xTE - .02;
        for (const [f, h] of sg > 0 ? [[.08, 2.53], [.12, 3.42], [.44, 3.27]] : [[.08, 9.0], [.07, 7.37], [.38, 7.25]]) {
          const xx = L0 + (L1 - L0) * f, fv = PW.kit.frame(iid, xx, h, rIFS(xx));
          PW.kit.box(iid, fv, [-.004, .006, 0], [.07, .012, .042], 'cowlWhite', { round: .006 });                                     // the hood
          PW.kit.box(iid, fv, [.031, .0065, 0], [.004, .008, .03], 'darkBox', { round: .002 }); } }                                  // its mouth, facing forward
      /* TTM 26-00: each fire loop, A and B, is five sensing elements in series to its FIDEX channel, one on the pylon and two on each
         core cowl. p.21 (the IFS halves from inside) and Brian's photos from below show each core cowl's two as a pair of tubes side by
         side in common clips, closed together at the upper end, their connectors at the lower end and a lead from the long pair to the
         short one. On the left the long pair runs down between the air/oil cooler window and the pressure-relief door, from level with
         the window's upper edge, and the short one stands under the window between its two openings; on the right the long pair runs
         down along the oil tank access door's aft edge, from level with its upper edge, and the short one stands under the ACC inlet
         port. Clocks are read off p.21's perspective (about +-0.2 h). Until 2026-10-14 each door had a forward and an aft pair running
         the whole arc, which neither source shows */
      if (PW.parts.has('fire')) { const fid = `fire-${side}`;
        PW.part(fid, { parent: 'fire', label: `Fire detection elements, ${side} core cowl`, attach: hinge, src: 'TTM ch. 26 (p.268-269); p.21; photos',
          info: (side === 'left' ? 'The two fire detection elements on the inside of the left core cowl: a long one running down between the air/oil cooler window and the pressure-relief door, and a short one under the window.'
            : 'The two fire detection elements on the inside of the right core cowl: a long one running down along the aft edge of the oil tank access door, and a short one under the ACC inlet port.') +
            ' In each, the loop A and loop B sensing tubes lie side by side in common clips, with their connectors at the lower end and a lead on to the next element. Each loop is five elements in series to its FIDEX control unit channel: two on each core cowl and one on the pylon. They are part of the reverser door and open with it.' });
        const ro = xx => rIFS(xx) - .039, at = (xx, h) => G.onRing(xx, ro(xx), G.clock(h)), dh = (xx, d) => d / ro(xx) / (Math.PI / 6);   // tubes 3.5 mm off the blanket; d metres along the clock, in hours
        const line = (pts, r) => { const g = G.tube(pts, r, { radial: 6 }); PW.add(fid, g, 'steel').userData.isLine = true; return g.userData.curve; };
        /* an element: its tubes 22 mm apart, closed together round the top; at the lower end the two turn the same way, the inner one
           tighter, so that their connectors sit one above the other. Returns the outer ends of the two connectors, inner first */
        const element = ([xx, hTop, hBot, b]) => { const s = Math.sign(hBot - hTop), H = (x, d) => hBot + s * dh(x, d), pts = [];
          const turn = inner => { const x0 = xx + (inner ? b : -b) * .011; return inner ? [[x0, 0], [x0 + b * .008, .02], [x0 + b * .03, .028], [x0 + b * .05, .028]]
            : [[x0, 0], [x0 + b * .012, .035], [x0 + b * .04, .05], [x0 + b * .072, .05]]; };
          const n = Math.max(3, Math.round(Math.abs(hBot - hTop) / .1)), legX = [xx - .011, xx + .011], inA = b < 0;   // the first leg is the inner one when the ends turn aft
          turn(inA).slice().reverse().forEach(([x, d]) => pts.push(at(x, H(x, d))));
          for (let i = 1; i <= n; i++) pts.push(at(legX[0], hBot + (hTop - hBot) * i / n));
          for (let k = 1; k < 6; k++) { const a = Math.PI * k / 6; pts.push(at(xx - .011 * Math.cos(a), hTop - s * dh(xx, .011 * Math.sin(a)))); }
          for (let i = 0; i < n; i++) pts.push(at(legX[1], hTop + (hBot - hTop) * i / n));
          turn(!inA).forEach(([x, d]) => pts.push(at(x, H(x, d))));
          const c = line(pts, .0035);
          const nc = Math.max(3, Math.round(Math.abs(hBot - hTop) / .3));                                       // clips about 15 cm apart, six on the long left one as p.21 draws
          for (let k = 0; k < nc; k++) { const f = PW.kit.frame(fid, xx, hBot + (hTop - hBot) * (k + .55) / nc, ro(xx)); PW.kit.box(fid, f, [0, 0, 0], [.035, .008, .012], 'steel', { round: .002 }); }
          const ends = [0, 1].map(t => { const p = c.getPointAt(t), d = c.getTangentAt(t).multiplyScalar(t ? 1 : -1); return { p, d }; });
          const cg = G.merge(ends.map(({ p, d }) => { const body = new THREE.CylinderGeometry(.0055, .0055, .022, 12), nut = new THREE.CylinderGeometry(.0072, .0072, .007, 6);   // connector and its coupling nut
            body.translate(0, .006, 0); nut.translate(0, .02, 0); const g = G.merge([body, nut]);
            g.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d))); g.translate(p.x, p.y, p.z); return g; }));
          cg.userData.solid = true; PW.add(fid, cg, 'steel');
          const tip = ends.map(({ p, d }) => p.clone().addScaledVector(d, .024));
          return inA ? tip : [tip[1], tip[0]]; };
        const [l0, l1] = element(fireEls[0]), [s0, s1] = element(fireEls[1]);
        /* the leads from the long element's connectors to the short one's, inner to inner, outer to outer */
        for (const [a, z] of [[l0, s0], [l1, s1]]) { const pts = [a]; for (let i = 1; i < 6; i++) pts.push(a.clone().lerp(z, i / 6)); pts.push(z);
          line(pts.map((p, i) => { if (i === 0 || i === pts.length - 1) return p; const r = Math.hypot(p.y, p.z), want = ro(p.x); return new THREE.Vector3(p.x, p.y * want / r, p.z * want / r); }), .003); } }
      const ac = []; for (let i = 0; i <= 10; i++) { const xx = xTE - .02 + (xCN + .004 - (xTE - .02)) * i / 10; ac.push([xx, rIFS(xx)]); }
      PW.add(iid, G.revolve(G.shellProfile(ac, ac.map(([xx, r]) => [xx, r - .008])), { seg: 72, thetaStart: t0, thetaLength: tl }), 'bareCowl');
      // bifurcation half-walls at the top (hinge beam) and bottom (latch beam)
      for (const [aEdge, top] of [[it0, sg > 0], [it0 + itl, sg < 0]]) {
        const isTop = top, wall = new THREE.Shape(), xs = [xI0 - .05, xTE + .25], r0 = .56, r1 = .94;
        wall.moveTo(xs[0], r0); wall.lineTo(xs[1], r0 - .02); wall.lineTo(xs[1], r1 - .02); wall.lineTo(xs[0], r1); wall.lineTo(xs[0], r0);
        const g = new THREE.ExtrudeGeometry(wall, { depth: .012, bevelEnabled: false }); g.translate(0, 0, -.006);
        const m = new THREE.Mesh(g); m.rotation.x = aEdge - Math.PI / 2 * 0; m.position.set(0, 0, 0);
        // the wall lies in the plane of angle aEdge: rotate the x-y extrusion plane (y = radius) onto that angle
        m.rotation.set(aEdge, 0, 0); PW.add(pid, m, isTop ? 'cowlWhite' : 'lime', { solid: true, into: hinge });
      }
      /* the latch beam at the bottom (p.24-31): each door's web from the fan duct outer wall to the outer skin, its five latches (hooks
         with flush handles on the left door, keepers on the right; No. 2 and 3 sit inside the bay behind the latch access door), the
         bifurcation latch system between the IFS halves, the bumpers on the IFS edges, and the closure assist stowed in the bay */
      { const Kt = PW.kit, lb = `${pid}-latch-beam`, aB = sg > 0 ? t0 + tl : t0, hB = aB / (Math.PI / 6), hI = (sg > 0 ? it0 + itl : it0) / (Math.PI / 6);
        PW.part(lb, { parent: pid, attach: hinge, label: sg > 0 ? 'Right latch beam: latch keepers, BLS receiver, rod and handle, closure assist, bumpers' : 'Left latch beam: latches, BLS pin, bumpers', src: 'p.24-31',
          info: sg > 0 ? 'The bottom edge of the right door: the keepers for latches 1 to 5; the receiver for the bifurcation latch pin on the IFS edge, with the rod that locks the pin running down to the red BLS handle in the bay; the closure assist stowed on its web; the lower bumpers that align the IFS halves as the doors close; and the lug for the reverser lockout pin under the sleeve\'s forward end. The upper bumpers are at the other end of the IFS halves, at the top by the upper bifurcation, with a compression strut for the wider gap there (p.24).'
            : 'The bottom edge of the left door. Latches 1 to 5 hook onto the right door: open them 5, 4, 3, 2, 1 and close them 1 to 5, using the closure assist assembly to pull the doors together first. Latches 2 and 3 are inside the bay behind the latch access door, and latch 5 joins the two halves of the aft core cowl just aft of the sleeves.\n\nThe bifurcation latch system (BLS) pins the two IFS halves together at the bottom to limit IFS deflection if an air duct bursts: the pin is on this door\'s IFS edge, and the receiver, the locking rod and its red handle are on the right door\'s. The handle is worked through the latch access door; if it is not locked, or latches 2 and 3 are not secured, the latch access door cannot be closed (p.24, p.28). Open the BLS before the latches and close it last.\n\nThe two reverser lockout pins are stowed in sockets in the same bay. To lock the reversers out for MEL dispatch, first pin the ICU\'s inhibit lever, then fit a pin down through each sleeve\'s lower edge into the lug on its latch beam, and stow the sleeves\' blanking plates here in their place (p.372-375). For maintenance alone the ICU inhibit is enough.' });
        /* the web, 1.6 deg in from the door's bottom edge, from just aft of the bifurcation pass-through panel to the sleeve; the drain
           mast passes down between the two webs */
        const aW = aB - sg * deg(.6), hW = aW / (Math.PI / 6), web = new THREE.Shape(), xa = -1.10, xb = xTE - .05, n = 8, pts = [];
        for (let i = 0; i <= n; i++) { const xx = xa + (xb - xa) * i / n; pts.push([xx, rDuct(xx) + .012]); } for (let i = n; i >= 0; i--) { const xx = xa + (xb - xa) * i / n; pts.push([xx, rOut(xx) - .022]); }
        web.moveTo(...pts[0]); pts.slice(1).forEach(p => web.lineTo(...p)); const wg = new THREE.ExtrudeGeometry(web, { depth: .008, bevelEnabled: false }); wg.translate(0, 0, -.004);
        const wm = new THREE.Mesh(wg); wm.rotation.set(aW, 0, 0); PW.add(lb, wm, 'lime', { solid: true });
        /* the latch beam's fairing, the bottom of the nacelle between the two sleeves' lower edges, 6 deg either side of 6 o'clock
           (p.29-31, TTM 01 fig. 28): the flush handles of latches 1, 4 and 5 and the latch access door are in the left one */
        { const skin = (xa, xb, th0, th1) => { const fs = []; for (let i = 0; i <= 12; i++) { const xx = xa + (xb - xa) * i / 12; fs.push([xx, rOut(xx)]); }
            PW.add(lb, G.revolve(G.shellProfile(fs, fs.map(([xx, r]) => [xx, r - .02])), Object.assign({ seg: 3 }, span(th0, th1))), 'nacellePaint'); };
          /* open 45 mm round the drain mast, which comes out through the latch access door's grommet at x -1.50, under the mast's end
             plate (until 2026-10-14 the mast's tubes ran through solid skin) */
          skin(xJ2 - .002, -1.455, 174, 180); skin(-1.455, -1.545, 174, 177.76); skin(-1.545, xTE - .028, 174, 180); }
        /* latches 1 to 4 on the beam: [x, radius, has an outer handle]; the hooks on the left web reach across onto the keepers on the
           right. p.29 and p.31 put latch 4 near the sleeves' trailing edge and latch 5 aft of it, on the aft core cowl's bottom split;
           until 2026-10-14 latches 4 and 5 were at x -1.81 and -2.09 on the beam */
        for (const [xx, rr, outside] of [[-.99, rOut(-.99) - .035, true], [-1.22, rOut(-1.22) - .06, false], [-1.40, rDuct(-1.40) + .05, false], [-2.26, rOut(-2.26) - .035, true]]) {
          const f = Kt.frame(lb, xx, xx < -1.1 ? hW : hB, rr);
          if (sg < 0) { Kt.box(lb, f, [0, 0, -.017], [.1, .03, .03], 'steel', { round: .004 }); Kt.box(lb, f, [.05, 0, -.036], [.016, .01, .014], 'steel', { round: .003 });   // hook body and hook
            if (outside) { const g = Kt.frame(lb, xx, hB + .04, rOut(xx)); Kt.box(lb, g, [0, -.0005, 0], [.156, .003, .04], 'darkBox', { round: .0015 }); Kt.box(lb, g, [0, .0008, 0], [.15, .003, .034], 'greyPrimer', { round: .004 }); } }
          else { Kt.box(lb, f, [0, 0, .015], [.06, .034, .03], 'steel', { round: .004 }); Kt.cyl(lb, f, [.0, 0, .022], 'x', .005, .07, 'steel'); } }                  // keeper bracket and pin
        /* latch 5: hook and keeper inside the aft core cowl's two halves where they meet at 6 o'clock, its flush handle on the left half */
        { const x5 = -2.62, rC = rIFS(x5), hE = (sg > 0 ? t0 + tl : t0) / (Math.PI / 6), f = Kt.frame(lb, x5, hE - sg * .06, rC - .026);
          if (sg < 0) { Kt.box(lb, f, [0, 0, -.004], [.08, .024, .024], 'steel', { round: .004 }); Kt.box(lb, f, [.04, 0, -.02], [.014, .009, .012], 'steel', { round: .003 });
            const g = Kt.frame(lb, x5, hE + .1, rC); Kt.box(lb, g, [0, -.0005, 0], [.13, .003, .036], 'darkBox', { round: .0015 }); Kt.box(lb, g, [0, .0008, 0], [.124, .003, .03], 'greyPrimer', { round: .004 }); }
          else { Kt.box(lb, f, [0, 0, .004], [.05, .028, .024], 'steel', { round: .004 }); Kt.cyl(lb, f, [0, 0, .012], 'x', .0045, .06, 'steel'); } }
        /* bifurcation latch system at x -1.36 (p.21, p.24-27, p.31): the fitting and pin on the left IFS edge; on the right the receiver,
           with the rod that is pushed up through the pin's cross bore running down to the red handle in the bay, just right of its
           centreline. The rod and handle were on the left door until 2026-10-12 */
        const fI = Kt.frame(lb, -1.36, hI, rIFS(-1.36) - .025);
        Kt.box(lb, fI, [0, -.01, sg * .012], [.05, .036, .028], 'steel', { round: .005 });
        if (sg < 0) Kt.cyl(lb, fI, [0, -.012, -.04], 'z', .0065, .04, 'steel');
        else { Kt.tube(lb, fI, [0, -.012, .028], 'z', .0068, .013, .016, 'steel');
          PW.add(lb, G.rod(G.onRing(-1.36, rIFS(-1.36) - .01, G.clock(hI + .02)), G.onRing(-1.36, rOut(-1.36) - .05, G.clock(hB - .05)), .006), 'steel');
          const fh = Kt.frame(lb, -1.36, hB - .05, rOut(-1.36) - .05);
          Kt.box(lb, fh, [0, -.008, 0], [.014, .016, .014], 'steel', { round: .003, mat: { color: '#b3191f', metalness: .15, roughness: .5 } });
          Kt.box(lb, fh, [.035, -.008, 0], [.07, .012, .014], 'steel', { round: .004, mat: { color: '#b3191f', metalness: .15, roughness: .5 } }); }   // the red L-handle
        /* bumpers: lower on the bottom IFS edge, upper on the top edge (where the compression strut bridges the wider gap). p.21: the
           lower aft pair sits well forward of the upper aft pair, at about 45% of the IFS's length against 59% */
        const hT = (sg > 0 ? it0 : it0 + itl) / (Math.PI / 6);
        for (const [xx, h] of [[-1.08, hI], [-1.70, hI], [-1.08, hT], [-1.86, hT]]) { const f = Kt.frame(lb, xx, h, rIFS(xx) - .03), tw = h === hI ? (sg > 0 ? 'z' : '-z') : (sg > 0 ? '-z' : 'z');
          Kt.box(lb, f, [0, 0, 0], [.04, .024, .02], 'steel', { round: .004 }); Kt.cyl(lb, f, [0, 0, Kt.dir(tw).z * .016], tw, .011, .012, 'rubber', { edge: .003 }); }
        /* closure assist assembly, stowed along the right web in the bay (p.29 view A, p.31): a turnbuckle with a hook at its forward
           end, which hooks onto the other door's fixed panel support (p.30), a lug on the left web. It was stowed on the left until
           2026-10-12 */
        if (sg > 0) { const fc = Kt.frame(lb, -1.34, hB - .08, rOut(-1.34) - .09);
          Kt.cyl(lb, fc, [0, 0, 0], 'x', .009, .16, 'steel', { edge: .002 }); for (const s of [-1, 1]) Kt.hex(lb, fc, [s * .088, 0, 0], 'x', .011, .016, 'steel');
          Kt.box(lb, fc, [.11, .006, 0], [.03, .012, .008], 'steel', { round: .003 }); }
        else { const fk = Kt.frame(lb, -1.24, hB + .06, rOut(-1.24) - .09); Kt.box(lb, fk, [0, 0, 0], [.024, .03, .012], 'steel', { round: .003 }); Kt.cyl(lb, fk, [0, .004, 0], 'z', .004, .018, 'steel'); }   // its hook lug
        /* p.372-375: reverser lockout, for MEL dispatch or maintenance. With the ICU's inhibit lever pinned, a lockout pin goes down
           through the stowed sleeve's lower edge into this lug, so the sleeve cannot deploy. The two pins live in sockets in the bay at
           the latch access panel; when they are fitted, the sleeves' blanking plates are stowed there instead */
        const LG = (PW.lockout = PW.lockout || { on: 0 }).groups = PW.lockout.groups || [];
        { const fu = Kt.frame(lb, xJ2 - .10, hOf(173.4), rOut(xJ2 - .10) - .035);
          Kt.box(lb, fu, [0, 0, 0], [.03, .024, .028], 'steel', { round: .004 }); Kt.cyl(lb, fu, [0, .0125, 0], 'y', .0055, .002, 'darkBox');
          const pin = Kt.sub(fu, [0, 0, 0]); pin.visible = false; LG.push([pin, true]);                                         // fitted: down through the sleeve into the lug
          Kt.cyl(lb, pin, [0, .015, 0], 'y', .0045, .04, 'steel'); Kt.box(lb, pin, [0, .0368, .007], [.014, .003, .03], 'steel', { round: .006 }); }
        if (sg < 0) for (const dx of [0, .032]) { const fp = Kt.frame(lb, -1.45 - dx, hB + .07, rOut(-1.46) - .06);
          Kt.box(lb, fp, [0, .005, 0], [.024, .01, .024], 'steel', { round: .003 });                                                 // stowage socket
          const stow = Kt.sub(fp, [0, 0, 0]); LG.push([stow, false]);                                                              // the pin and its teardrop head
          Kt.cyl(lb, stow, [0, .03, 0], 'y', .0045, .042, 'steel'); Kt.box(lb, stow, [0, .053, .007], [.014, .004, .03], 'steel', { round: .006 });
          const plate = Kt.sub(fp, [0, .014, .03]); plate.visible = false; LG.push([plate, true]);                               // a sleeve's blanking plate, stowed here while its pin is fitted
          Kt.box(lb, plate, [0, 0, 0], [.036, .0016, .024], 'greyPrimer', { round: .008 }); }
        }
      /* the latch access door in the bottom of the left door, across the bay at 6 o'clock and hinged on its left edge (p.21, p.29-31),
         from about 15% to 44% of the IFS's length; the drain mast passes through an oval grommet in it (p.21, p.50-51). Until 2026-10-12
         it was 0.1 m wide, left of centre and ahead of the mast */
      if (sg < 0) { PW.part('tr-latch-access-door', { parent: pid, attach: hinge, label: 'Latch access door', src: 'p.21, p.24, p.29-31, p.50-51',
          info: 'Door in the bottom of the left reverser door, across the bay at 6 o\'clock and hinged on its left edge; the drain mast comes out through a grommet in it. Behind it are latches 2 and 3, the red bifurcation latch system handle and the closure assist assembly. It will not close unless latches 2 and 3 are secured and the BLS handle is locked, so a latch access door that will not close means latch 2, latch 3 or the BLS is not latched (p.24, p.28). The drain map placard is inside it.' });
        const K = PW.kit, dd = 'tr-latch-access-door', f = K.frame(dd, -1.43, 6.0, rOut(-1.43));
        /* the skin in four pieces round the grommet (local z points to the engine's left here) */
        for (const [cx, lx, cz, lz] of [[.117, .226, 0, .2], [-.187, .086, 0, .2], [-.07, .148, .087, .026], [-.07, .148, -.087, .026]]) {
          K.box(dd, f, [cx, .0002, cz], [lx + .006, .003, lz + .006], 'darkBox', { round: .002 }); K.box(dd, f, [cx, .0016, cz], [lx, .004, lz], 'nacellePaint', { round: .005 }); }
        K.tube(dd, f, [-.07, .002, 0], 'y', .066, .074, .006, 'silicone');                                                          // the drain mast's grommet
        for (const s of [-1, 1]) K.box(dd, f, [s * .15, .0036, .088], [.026, .002, .016], 'greyPrimer', { round: .003 }); }        // hinges on its left edge
      { /* the hinge beam along the door's top edge, just inside its skin, which follows the nacelle's taper (until 2026-10-12 a straight
           bar whose aft end stood out of the skin once the pylon no longer covered it) */
        const a = sg > 0 ? t0 + deg(1.6) : t0 + tl - deg(1.6), pts = []; for (let i = 0; i <= 10; i++) { const xx = -1.0 - 1.45 * i / 10; pts.push(G.onRing(xx, rOut(xx) - .036, a)); }
        PW.add(pid, G.tube(pts, .015, { radial: 10 }), 'nickel', { solid: false, into: hinge }); }
      /* actuation (p.334-351, p.347): on the torque box at the forward end of the door, the locking feedback actuator in the upper section
         and the locking actuator in the lower one, joined round the ring by the flexible drive shaft and the deploy tube, with the stow,
         deploy and return lines coming down from the hinge beam. The bodies run aft between the cascade boxes; the rods belong to the
         sleeve and slide with it (0.54 m stroke, still inside the bodies at full deploy), their rod ends on the aft wall of the sleeve's
         cascade cavity. The track lock valves are on the torque box at about 5 and 7 o'clock (p.352), the track lock units on the latch
         beams (p.354) */
      { const Kt = PW.kit, aid = `${pid}-actuators`, xm = xJ2 - .075, ra = 1.06, hU = sg > 0 ? 1.5 : 10.5, hL = sg > 0 ? 4.5 : 7.5, hBot = (sg > 0 ? t0 + tl : t0) / (Math.PI / 6);
        PW.part(aid, { parent: pid, attach: hinge, label: `${side === 'left' ? 'Left' : 'Right'} sleeve actuators, drive shaft and track lock`, src: 'p.326-357',
          info: 'Two hydraulic actuators on the torque box move this door\'s translating sleeve, their bodies running aft between the cascade boxes and their rod ends on the sleeve. The locking feedback actuator in the upper section carries the LVDT on its forward end that reports sleeve position to the EEC; the locking actuator in the lower section carries the manual drive unit. Each has an internal lock released by hydraulic pressure, a proximity sensor on the lock and a manual lock lever. The flexible drive shaft runs inside the deploy tube between the two heads: it keeps them in step while the tube carries deploy pressure to the locking actuator. Stow pressure reaches each actuator\'s rod end through the stow tube along its body.\n\nThe track lock unit on the latch beam pushes a spring-loaded bolt into the sleeve\'s path, so the sleeve cannot deploy even if the actuators do; two proximity sensors report the bolt to the EEC. Its track lock valve, on the torque box next to the locking actuator, takes stow pressure from that actuator\'s head, so it is pressurized as soon as the isolation control valve opens and the actuators overstow. The CDC then opens it to pull the bolt back, before the directional control valve opens; it stays open until the reverser is stowed again.\n\nTo move a sleeve by hand: unlock the track lock unit (manual lock to unlock, unlock pin in the lockout hole) and the manual locks on both actuators, with their pins; remove the manual drive unit\'s cover and turn it with a square drive, at no more than 120 rpm (p.376). Its torque limiter protects the actuators.' });
        for (const [h, feedback] of [[hU, true], [hL, false]]) {
          const f = Kt.frame(aid, xm, h, ra);
          /* p.349, p.351, p.377: the cast head, with the gimbal ring behind it whose two trunnions sit in a yoke on the torque box; the
             lock proximity sensor and the manual lock lever on top of the head; the body with four clamp bands holding the stow tube; the
             larger housing at the rod end carrying the stow port; the rod gland */
          const zs = -sg;                                                                                                         // the side away from the LVDT harness
          Kt.box(aid, f, [.0025, 0, 0], [.085, .07, .07], 'castAl', { round: .01 });                                              // head
          Kt.tube(aid, f, [-.047, 0, 0], 'x', .034, .056, .01, 'castAl');                                                         // gimbal ring
          for (const s of [-1, 1]) { Kt.cyl(aid, f, [-.047, 0, s * .062], 'z', .011, .014, 'steel'); Kt.box(aid, f, [-.047, -.012, s * .076], [.03, .05, .012], 'greyPrimer', { round: .003 }); }   // trunnions and yoke
          Kt.cyl(aid, f, [-.33, 0, 0], 'x', .033, .62, 'steel', { edge: .006 }); Kt.cyl(aid, f, [-.61, 0, 0], 'x', .041, .07, 'steel', { edge: .006 }); Kt.cyl(aid, f, [-.66, 0, 0], 'x', .027, .03, 'steel');   // body, rod-end housing and gland
          for (const xr of [-.13, -.27, -.41, -.54]) Kt.tube(aid, f, [xr, 0, 0], 'x', .033, .037, .012, 'steel');                // clamp bands
          if (feedback) { Kt.cyl(aid, f, [.0, .04, -.015 * zs], 'y', .009, .012, 'steel'); Kt.connector(aid, f, [.0, .047, -.015 * zs], 'y', .007, { lead: 'x' }); }   // lock proximity sensor on the head (p.349)
          else { Kt.cyl(aid, f, [-.1, .038, 0], 'y', .009, .02, 'steel'); Kt.connector(aid, f, [-.1, .048, 0], 'y', .007, { lead: 'x' }); }   // on the locking actuator, just behind the head (p.351)
          Kt.box(aid, f, [.028, .04, .02 * zs], [.035, .006, .01], 'steel', { round: .002, mat: { color: '#c0262b', metalness: .2, roughness: .5 } });   // manual lock lever, its hook and pin hole
          Kt.box(aid, f, [.043, .046, .02 * zs], [.008, .014, .01], 'steel', { round: .002, mat: { color: '#c0262b', metalness: .2, roughness: .5 } });
          /* ports on the hinge side: on the locking feedback actuator the deploy inlet and the stow union at the head, on the locking
             actuator the stow union, which also feeds the track lock valve (p.358-359); on both the stow port on the rod-end housing */
          for (const xr of feedback ? [-.06, -.085, -.60] : [-.06, -.60]) Kt.fitting(aid, f, [xr, .028, -.03 * sg], 'y', .008);
          /* the hex coupling of the flexible drive shaft and deploy tube: on the upper head's side toward the lower actuator, on the lower
             head's side toward the upper one (p.349, p.351) */
          Kt.hex(aid, f, [-.012, 0, (feedback ? .041 : -.041) * sg], [0, 0, feedback ? sg : -sg], .013, .012, 'steel');
          if (feedback) { Kt.cyl(aid, f, [.085, 0, 0], 'x', .016, .1, 'steel'); Kt.connector(aid, f, [.135, 0, 0], 'x', .009, { lead: 'y' }); }   // LVDT
          else { /* the manual drive unit on the head's forward face (p.351, p.377): a Goodrich can with a three-lobed plate round the square
                    drive and a knurled cover on a lanyard */
            Kt.cyl(aid, f, [.06, .022, 0], 'x', .022, .03, 'castAl', { edge: .003 }); Kt.plate(aid, f, [.06, .022, .0226], 'z', 'x', .024, .018, 'GOODRICH');
            Kt.cyl(aid, f, [.0765, .022, 0], 'x', .017, .003, 'steel'); for (let k = 0; k < 3; k++) { const a = k * TAU / 3; Kt.hex(aid, f, [.079, .022 + .013 * Math.cos(a), .013 * Math.sin(a)], 'x', .0025, .002, 'steel'); }
            Kt.cyl(aid, f, [.0815, .022, 0], 'x', .011, .007, 'capBlack', { edge: .002 }); Kt.rod(aid, f, [.08, .011, 0], [.07, .0, .008], .0008, 'steel'); }
          const g = Kt.frame(sid, xm, h, ra); Kt.cyl(sid, g, [-.39, 0, 0], 'x', .016, .62, 'steel'); Kt.box(sid, g, [-.72, 0, 0], [.04, .05, .05], 'steel', { round: .006 });   // rod and rod end on the sleeve
          Kt.box(sid, g, [-.748, 0, 0], [.014, .07, .06], 'greyPrimer', { round: .004 }); }                                         // its clevis on the cavity's aft wall
        const arc = (h0, h1, r, dx) => { const pts = [], n = Math.max(1, Math.ceil(Math.abs(h1 - h0) / .2)); for (let i = 0; i <= n; i++) pts.push(G.onRing(xm + dx, r, G.clock(h0 + (h1 - h0) * i / n))); return pts; };
        /* a routed line on this door, tagged for the connection audit like build-external's (hydraulic tube or braided harness) */
        const tube = (pts, r, mat, kind) => { const tg = G.tube(pts, r, { radial: 8, tension: .3 }), harn = kind === 'harness';
          if (harn && tg.attributes.uv) { const L = tg.userData.curve.getLength(), uv = tg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * L * 8); }
          const m = PW.add(aid, tg, mat); m.userData.isLine = true; m.userData.lineKind = kind || 'tube'; return m; };
        const hm = c => sg > 0 ? c : 12 - c, zh = -sg;                                                                          // clocks mirrored to this door; local z toward the hinge
        /* a point in a unit's frame on the case (x0, clock h, radius r0) given in that frame's axes: x forward, y radially out, z toward
           increasing clock */
        const loc = (x0, h, r0, lx, ly, lz) => { const a = G.clock(h); return new THREE.Vector3(x0 + lx, (r0 + ly) * Math.cos(a) - lz * Math.sin(a), (r0 + ly) * Math.sin(a) + lz * Math.cos(a)); };
        const U = (lx, ly, lz) => loc(xm, hU, ra, lx, ly, lz), Lw = (lx, ly, lz) => loc(xm, hL, ra, lx, ly, lz);
        const hV = hOf(150), hT = hBot - sg * .1, V = (lx, ly, lz) => loc(xm - .025, hV, 1.075, lx, ly, lz), T = (lx, ly, lz) => loc(-1.93, hT, 1.0, lx, ly, lz);
        /* p.347-351: the flexible drive shaft that keeps the two actuators in step runs inside the deploy tube, one rigid tube from the
           upper head's hex coupling down the torque box into the lower head's */
        tube([U(-.012, 0, -.047 * zh), U(-.012, .002, -.065 * zh), U(-.022, .016, -.088 * zh)].concat(arc(hU + .12 * sg, hL - .15 * sg, ra + .03, -.03), [Lw(-.022, .016, .088 * zh), Lw(-.012, .002, .065 * zh), Lw(-.012, 0, .047 * zh)]), .008, 'stainless');
        /* stow, deploy and return lines from the DCU come down from the hinge beam (p.347): deploy into the upper actuator's head; stow
           into its stow union, from which its stow tube runs along the body to the rod end and a line runs on down the torque box beside
           the deploy tube to the locking actuator's stow union, which feeds that actuator's stow tube and the track lock valve. The
           valve so has pressure as soon as the actuators overstow, before the directional control valve opens (p.358-359). Return runs
           down the torque box to the track lock valve */
        tube(arc(hm(.35), hm(1.30), ra + .05, -.084).concat([U(-.09, .05, .065 * zh), U(-.085, .045, .036 * zh), U(-.085, .0396, .03 * zh)]), .006, 'tube');   // stow, under the harness, into the upper stow union
        tube(arc(hm(.35), hm(1.36), ra + .038, -.072).concat([U(-.07, .05, .05 * zh), U(-.06, .045, .035 * zh), U(-.06, .0396, .03 * zh)]), .006, 'tube');   // deploy
        for (const [W, x0] of [[U, -.085], [Lw, -.06]]) tube([W(x0, .0396, .03 * zh), W(x0 - .02, .047, .05 * zh), W(-.30, .045, .05 * zh), W(-.56, .042, .048 * zh), W(-.60, .042, .035 * zh), W(-.60, .0396, .03 * zh)], .006, 'tube');   // each actuator's stow tube, head to rod end
        tube([U(-.085, .0396, .03 * zh), U(-.092, .05, .012 * zh), U(-.098, .052, -.025 * zh), U(-.098, .042, -.058 * zh), U(-.09, .03, -.085 * zh)].concat(arc(hU + .16 * sg, hL - .19 * sg, ra + .03, -.085), [Lw(-.08, .04, .085 * zh), Lw(-.07, .05, .05 * zh), Lw(-.06, .045, .035 * zh), Lw(-.06, .0396, .03 * zh)]), .006, 'tube');   // stow on down the torque box
        tube(arc(hm(.35), hm(1.2), ra + .02, -.06).concat([G.onRing(-1.09, 1.12, G.clock(hm(1.3)))], arc(hm(1.4), hm(4.75), ra + .085, -.04), [V(0, .03, .075 * zh), V(0, .008, .075 * zh), V(0, .008, .0337 * zh)]), .006, 'tube');   // return, the upper union
        tube([Lw(-.06, .0396, .03 * zh), Lw(-.055, .07, 0), Lw(-.05, .065, -.07 * zh), loc(xm - .035, hOf(143), 1.09, 0, 0, 0), V(0, -.022, .075 * zh), V(0, -.008, .075 * zh), V(0, -.008, .0337 * zh)], .006, 'tube');   // stow pressure to the track lock valve, the lower union
        /* the track lock valve's two lines aft along the latch beam to the track lock unit, side by side: unlock pressure and return.
           Low in the latch beam, under the closure assist and the stowed lockout pins and outboard of the BLS rod; they reach the unit's
           ports from forward, under the harness */
        for (const [z, th] of [[.012, 175.6], [-.012, 176.2]]) {
          const zz = z * zh, s = Math.sign(zz) * sg;                                                                             // s: which side of the pair, in door angle
          tube([V(-.0337, 0, zz), V(-.07, 0, zz), G.onRing(-1.16, 1.08, A(154.5 + s * 1.6)), G.onRing(-1.20, 1.07, A(164 + s * 1.5)), G.onRing(-1.26, 1.058, A(172 + s * .8)), G.onRing(-1.32, 1.04, A(th)), G.onRing(-1.45, 1.035, A(th)),
            G.onRing(-1.80, 1.035, A(th)), T(.075, .045, zz), T(.025, .05, zz), T(.025, .0337, zz)], .0045, 'tube'); }
        /* the reverser harness (EEC and CDC circuits, p.336) down the torque box from the hinge beam: LVDT and lock sensor on the upper
           actuator, lock sensor on the lower, the track lock valve solenoid, then along the latch beam to the two track lock unit sensors */
        const tk = arc(hm(.36), hm(4.6), ra + .07, -.13).concat([G.onRing(-1.20, 1.125, G.clock(hm(5.0))), G.onRing(-1.30, 1.11, G.clock(hm(5.75))), G.onRing(-1.55, 1.09, G.clock(hm(5.83))), G.onRing(-1.70, 1.085, G.clock(hm(5.86))), G.onRing(-1.84, 1.075, G.clock(hT)), T(.02, .068, .012), T(-.0094, .0583, .012)]);
        tube(tk, .005, 'harness', 'harness');
        tube([T(-.0094, .0583, -.012), T(.02, .068, -.008), G.onRing(-1.84, 1.075, G.clock(hT))], .004, 'harness', 'harness');                  // the second track lock unit sensor
        const onTk = h => G.onRing(xm - .13, ra + .07, G.clock(hm(h)));
        { const lc = tube([U(.1521, .0162, 0), U(.1521, .03, 0), U(.12, .05, .025 * zh), U(.04, .058, .04 * zh), U(-.05, .068, .045 * zh), onTk(1.4)], .004, 'harness', 'harness').geometry.userData.curve;   // LVDT, over the deploy line
          let tb = 0, best = Infinity; for (let i = 0; i <= 200; i++) { const d = Math.abs(lc.getPointAt(i / 200).x + .996); if (d < best) { best = d; tb = i / 200; } }
          PW.add(aid, G.alongCurve(lc, [tb], () => new THREE.CylinderGeometry(.009, .009, .05, 12)), 'silicone').userData.isLine = true; }   // grommet through the torque box's forward frame (x -0.967 to -1.025)
        tube([U(.0126, .0603, -.015 * zh), U(.026, .068, -.016 * zh), U(.01, .072, -.018 * zh), U(-.05, .071, -.012 * zh), U(-.09, .072, 0), onTk(1.47)], .004, 'harness', 'harness');   // lock sensor, from the top of the head, under the return line
        tube([Lw(-.0874, .0613, 0), Lw(-.07, .072, 0), Lw(-.085, .076, .02 * zh), onTk(4.47)], .004, 'harness', 'harness');           // the locking actuator's lock sensor
        tube([V(-.0126, .0583, 0), V(-.05, .075, 0), G.onRing(-1.20, 1.125, G.clock(hm(5.0)))], .004, 'harness', 'harness');            // track lock valve solenoid
        /* the track lock unit on the latch beam (p.354-355, p.377): block on a pad, the bolt's boss facing aft, two proximity sensors and the
           two hydraulic ports on top */
        const ft = Kt.frame(aid, -1.93, hT, 1.0);
        Kt.box(aid, ft, [0, 0, 0], [.09, .05, .045], 'steel', { round: .006 });
        Kt.box(aid, ft, [0, -.027, 0], [.11, .006, .07], 'steel', { round: .004 });                                             // mounting pad, bolted to the latch beam
        for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) Kt.hex(aid, ft, [a * .046, -.022, b * .029], 'y', .004, .004, 'steel');
        Kt.cyl(aid, ft, [-.05, 0, 0], 'x', .016, .012, 'steel'); Kt.box(aid, ft, [-.07, 0, 0], [.03, .008, .018], 'steel', { round: .002 });   // the track lock blade on its boss
        for (const z of [-.012, .012]) { Kt.cyl(aid, ft, [-.022, .035, z], 'y', .007, .02, 'steel'); Kt.connector(aid, ft, [-.022, .045, z], 'y', .007, { lead: 'x' }); Kt.fitting(aid, ft, [.025, .025, z], 'y', .006); }   // sensors aft, hydraulic ports forward
        /* p.355, p.377: the unlocking bolt and position indicator on one side, under a lockwire; on the other, the Goodrich TRACK LOCK
           plate with the manual unlock pinning hole, and the manual lock lever, turned a quarter turn to unlock; the fluid placard on top */
        Kt.box(aid, ft, [.02, 0, .0235], [.03, .03, .002], 'steel', { round: .002 }); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) Kt.hex(aid, ft, [.02 + a * .011, b * .011, .0248], 'z', .0022, .002, 'steel');
        Kt.hex(aid, ft, [.02, 0, .0285], 'z', .006, .008, 'steel'); Kt.rod(aid, ft, [.02, .006, .033], [.033, .013, .026], .0007, 'steel'); Kt.rod(aid, ft, [.033, .013, .026], [.031, .011, .0245], .0007, 'steel');
        Kt.plate(aid, ft, [-.018, -.006, -.0228], '-z', 'y', .036, .026, 'TRACK LOCK'); Kt.cyl(aid, ft, [-.041, .012, -.0228], '-z', .0035, .001, 'darkBox');
        Kt.hex(aid, ft, [.026, .006, -.0245], '-z', .005, .004, 'steel'); Kt.box(aid, ft, [.036, .006, -.0262], [.022, .006, .003], 'steel', { round: .0015 });
        Kt.label(aid, ft, [.002, .0252, 0], 'y', 'x', .016, .012, 'white');
        /* the track lock valve on the torque box (p.352-353): block body with its solenoid and connector on top, the supply from the
           locking actuator and the return to the aircraft on the side toward the actuator, the lines to the track lock unit aft */
        const fv = Kt.frame(aid, xm - .025, hV, 1.075);
        Kt.box(aid, fv, [0, 0, 0], [.05, .036, .05], 'castAl', { round: .005 }); Kt.cyl(aid, fv, [0, .028, 0], 'y', .012, .022, 'darkBox'); Kt.connector(aid, fv, [0, .045, 0], 'y', .007, { lead: '-x' });
        Kt.box(aid, fv, [0, .022, 0], [.03, .01, .03], 'castAl', { round: .003 });                                               // square solenoid housing
        for (const [x, z] of [[.032, -.018], [.032, .018], [-.032, 0]]) { Kt.box(aid, fv, [x, -.015, z], [.016, .005, .014], 'castAl', { round: .004 }); Kt.cyl(aid, fv, [x, -.015, z], 'y', .003, .0052, 'darkBox'); }   // three mounting lugs
        Kt.decal(aid, fv, [0, 0, -.0256 * zh], zh > 0 ? '-z' : 'z', 'y', .04, .02, 'PHOSPHATE ESTER', 'castAl');                  // fluid placard (p.353)
        for (const y of [.008, -.008]) Kt.fitting(aid, fv, [0, y, .025 * zh], zh > 0 ? 'z' : '-z', .006);
        for (const z of [-.012, .012]) Kt.fitting(aid, fv, [-.025, 0, z], '-x', .006); }
      /* the door opening (PDOS) locking actuator (p.32, p.36, p.41, p.43): connected between the fan case and the torque box, it lies
         along the aft end of the fan case, retracted, from its bearing end on a bracket at 3:45 (8:15) up to its rod end on a lug on the
         torque box's forward face, centred on 3 (9) o'clock. It extends to lift the door and its internal lock holds it open. The
         powerpack's line reaches it at the quick-disconnect by the bearing end. p.41 draws it single-stage: a cylinder from the bearing
         end, the mechanical lock pin and the manual bleed port on its head, and a chromed rod out to the rod end. Its stroke (about 0.6 m
         on a 0.72 m actuator) is what limits the door to about 31 deg */
      { const Kt = PW.kit, hF = sg > 0 ? 3.75 : 8.25, Af = G.onRing(-.86, 1.06, G.clock(hF)), Ad = G.onRing(-.955, 1.08, A(73.5));
        const fl = Kt.frame('pdos', -.86, hF, .968);
        Kt.box('pdos', fl, [0, .05, 0], [.03, .1, .045], 'lime', { round: .004 }); Kt.fitting('pdos', fl, [.015, .055, 0], 'x', .009);       // bracket on the fan case's aft ring, and the quick-disconnect
        const fd = Kt.frame(pid, -.957, hOf(73.5), 1.08, { into: hinge }); Kt.box(pid, fd, [0, 0, 0], [.02, .05, .045], 'lime', { round: .004 });   // lug on the torque box
        const Lc = .68, Lr = .69, eye = () => new THREE.SphereGeometry(.02, 14, 10);
        member('pdos', PW.parts.get('pdos').obj, [
          { geo: eye(), mat: 'steel', at: 'a', s: 0 }, { geo: tubeY(.03, Lc), mat: 'accPaint', at: 'a', s: .012 + Lc / 2 },          // bearing end, cylinder
          { geo: tubeY(.034, .05), mat: 'accPaint', at: 'a', s: Lc - .02 }, { geo: crossX(.009, .085), mat: 'steel', at: 'a', s: Lc - .02 },   // head, mechanical lock pin
          { geo: G.roundedBox(.024, .022, .03, .004), mat: 'accPaint', at: 'a', s: .07 },                                         // quick-disconnect boss by the bearing end
          { geo: tubeY(.016, Lr), mat: 'shaft', at: 'b', s: .012 + Lr / 2 }, { geo: eye(), mat: 'steel', at: 'b', s: 0 }],      // rod, rod end
          () => [Af, doorOut(hd, Ad)]);
        /* the door's telescopic hold-open rod (p.40-43): pivoted on the torque box's forward face, stowed up along it with its top end in
           the stow bracket; with the door open and locked, it goes to the HOR open fitting on the fan case just below the actuator's
           bracket. Its collar band is red while it is unlocked and being extended, green when locked (p.41) */
        const hid = `${pid}-hor`, Pv = G.onRing(-.955, 1.12, A(129)), Sw = G.onRing(-.955, 1.14, A(97.5)), Ft = G.onRing(-.86, 1.03, G.clock(sg > 0 ? 4.0 : 8.0));
        PW.part(hid, { parent: 'pdos', attach: hinge, label: `${side === 'left' ? 'Left' : 'Right'} reverser door hold-open rod`, src: 'p.32, p.36-43',
          info: 'Telescopic hold-open rod for this reverser door. When not in use it is stowed on the door\'s torque box, its top end in the stow bracket. With the door opened by the locking actuator, release the top end and fit it to the HOR open fitting on the fan case. The actuator carries 100 % of the load in normal operation; the rod is the failsafe.\n\nLock collars extend and retract it: a red band shows when it is unlocked, green when it is locked. Do not go between the engine and an open reverser door until the rod is installed: if the power door operating system fails, the heavy door can close quickly.' });
        for (const [p, sz] of [[Pv, [.03, .045, .05]], [Sw, [.025, .03, .03]]]) { const a = Math.atan2(p.z, p.y), f = Kt.frame(hid, p.x - .012, a / (Math.PI / 6), Math.hypot(p.y, p.z), { into: hinge });
          Kt.box(hid, f, [0, 0, 0], sz, 'lime', { round: .004 }); }                                                                         // pivot and stow brackets
        const ff = Kt.frame('pdos', -.86, sg > 0 ? 4.0 : 8.0, .968); Kt.box('pdos', ff, [0, .03, 0], [.03, .06, .04], 'lime', { round: .004 }); Kt.cyl('pdos', ff, [0, .062, 0], 'x', .006, .04, 'steel');   // HOR open fitting and its pin
        hd.w = 0;
        hor(hid, hinge, () => [Pv, rodEnd(Pv, Sw, doorIn(hd, Ft), hd.w)], { ls: Pv.distanceTo(Sw), r: .016, unlocked: () => hd.w > 0 && hd.w < 1 }); }
    }
    /* IFS features: oil tank access door and precooler exhaust door (right, 2:30), AOC window and pressure-relief door (left, 9:30), ACC
       scoop (right, 2 o'clock) */
    /* a door or opening in an IFS half: a patch curved to the skin (its taper and its round), just proud of it, over a slightly larger
       dark seam. Until 2026-10-14 these were flat plates, which stood off the curved skin at their corners */
    const ifsPanel = (pid, parentDoor, label, info, xx, h, l, w, mat) => { PW.part(pid, { parent: parentDoor, label, info, src: 'p.20-23', attach: PW.parts.get(parentDoor).obj.children[0] });
      const a = G.clock(h), patch = (ll, ww, r0, r1, m) => { const xs = []; for (let i = 0; i <= 8; i++) xs.push(xx + ll / 2 - ll * i / 8); const half = ww / 2 / rIFS(xx);
        PW.add(pid, G.revolve(xs.map(x => [x, rIFS(x) + r0]).concat(xs.map(x => [x, rIFS(x) + r1]).reverse()), { seg: Math.max(4, Math.round(half * 40)), thetaStart: a - half, thetaLength: 2 * half }), m); };
      patch(l + .008, w + .008, -.001, .001, 'darkBox'); patch(l, w, -.0005, .0025, mat || 'cowlWhite'); };
    ifsPanel('ifs-otad', 'tr-right', 'Oil tank access door (OTAD)', 'Door in the right IFS at about 2:30, over the oil tank, that gives access to its fill port and sight glass without opening the reverser door (p.21, p.223-224). Wait at least 5 minutes after shutdown before servicing, and check the level between 5 and 60 minutes after shutdown.', -1.93, 2.62, .28, .27, 'cowlWhite');
    /* p.21 and p.23: the same size as the oil tank access door and beside it, aft (it was 0.2 x 0.18 m at 2:24 until 2026-10-14) */
    ifsPanel('ifs-pce', 'tr-right', 'Precooler exhaust (PCE) door', 'Door in the right IFS aft of the oil tank access door, about the same size (p.21, p.23). The EEC can exercise it through the aircraft\'s onboard maintenance system: the PCE door test is one of the EEC tests listed on p.182.', -2.31, 2.62, .28, .26, 'cowlWhite');
    /* the AOC window sits over the air/oil cooler: ZS 748-779 and 9 to 10:30 o'clock on p.5, mid-length of the IFS on p.23. Curved to the IFS, in three sections */
    { PW.part('ifs-aoc-window', { parent: 'tr-left', label: 'Air/oil cooler window', src: 'p.5, p.20-23', attach: PW.parts.get('tr-left').obj.children[0],
        info: 'Opening in the left IFS at about 9:30 o\'clock (ZS 748 to 779), over the air/oil cooler, in three sections. Fan air enters through the forward section, passes aft through the cooler and leaves through the aft section. The IFS pressure-relief door is aft of it.' });
      const x0 = -1.44, x1 = -2.06, a = G.clock(9.7), half = .33, at = xx => rIFS(xx) + .002;
      PW.add('ifs-aoc-window', G.revolve([[x0, at(x0)], [x1, at(x1)], [x1, at(x1) + .004], [x0, at(x0) + .004]], { seg: 14, thetaStart: a - half, thetaLength: 2 * half }), 'darkBox');
      for (const t of [1 / 3, 2 / 3]) { const xx = x0 + (x1 - x0) * t;
        PW.add('ifs-aoc-window', G.revolve([[xx + .008, at(xx)], [xx - .008, at(xx)], [xx - .008, at(xx) + .008], [xx + .008, at(xx) + .008]], { seg: 14, thetaStart: a - half, thetaLength: 2 * half }), 'cowlWhite'); } }
    /* the manual's text puts the pressure-relief door "at the 9 o'clock position", behind the AOC exhaust; p.21, p.5's upper panel and
       Brian's photo from below show it level with the cooler window, so it sits at 9:36 (it was at 9:00 until 2026-10-14) */
    ifsPanel('ifs-prd', 'tr-left', 'IFS pressure-relief door', 'Spring-latched door in the left IFS just aft of the air/oil cooler window and level with it, at about 9:30 (ZS 786 to 794), that opens at 3.5 psi core compartment overpressure, as after a bleed duct burst. Found open on the walkaround: find out why before flight.', -2.44, 9.6, .2, .2, 'cowlWhite');
    /* level with the oil tank access door's upper edge (p.21, p.23); it was at 1:30 until 2026-10-14 */
    ifsPanel('ifs-acc-scoop', 'tr-right', 'Active clearance control (ACC) inlet', 'Scoop on the right IFS at about 2 o\'clock, level with the top of the oil tank access door (p.21, p.23), that takes fan air for the turbine active clearance control. Its mouth faces forward into the fan stream; inside the IFS a duct takes the air to the inlet ring of the ACC air valve, and the joint parts when the reverser door is opened.', -1.62, 2.05, .18, .07, 'darkBox');
    { const f = PW.kit.frame('ifs-acc-scoop', -1.62, 2.05, rIFS(-1.62) + .004);                                               // the raised hood, open forward
      PW.kit.box('ifs-acc-scoop', f, [-.012, .014, 0], [.15, .026, .074], 'cowlWhite', { round: .011 });
      PW.kit.box('ifs-acc-scoop', f, [.064, .014, 0], [.004, .02, .062], 'darkBox', { round: .003 }); }

    /* ============================== PYLON (lower part) ============================== */
    PW.part('pylon', { parent: 'nacelle', label: 'Pylon (lower part)', src: 'TTM ch. 01 Fig. 28, ch. 54 Fig. 1-3; p.9, p.44-49; photos',
      info: 'The pylon hangs the engine from the wing on the forward and aft engine mounts, carries the fan cowl hinges and the reverser hinge beams, and routes the fuel, hydraulic, bleed and electrical services. Fairings enclose it (ch. 54). Ahead of the wing a rounded spine runs from the inlet joint along the top of the nacelle, and the fan cowls and reverser doors close flush against its sides; a blue panel fills between the fan cowls round its nose. Behind the reverser the aft fairing is a slim fin under the wing that flares at the bottom into a saddle over the core cowl and the exhaust, covered by the heat shield; it encloses the aft engine mount, and the deployed reverser sleeves slide past its narrow middle. The isolation control unit sits in its upper part behind access panels on both sides. Only the lower part is shown: the wing is not drawn.' });
    /* TTM ch. 01 Fig. 28 draws the pylon in side view with its stations: the fore tip at ZS 679.1 on the inlet joint, the top rising over
       the fan cowls to ZS 731.7 and on to the wing's leading edge notch at ZS 795.2, the aft fairing's lower forward corner at ZS 806.7, the
       aft tip at ZS 910.8. ch. 54 Fig. 1 and 3, p.9 and photos of Breeze aircraft show the forward fairing as a rounded spine whose base is
       the fan cowl and reverser door hinge line (10 deg either side of the crown), so the cowls and doors meet it flush, with a blue panel
       between the fan cowls round its tapered white nose (photo). A photo of an A220 engine from straight aft shows the aft fairing: a
       slim fin flaring at the bottom into the heat shield, which sits right on the core nozzle. The drawing's heights cannot be used as
       they stand (its aft fairing would reach into the core), so the wing's lower surface stays at the explorer's y 1.66; the saddle's
       width is the explorer's, measured from below (aircraft X = model x + 5.984). Until 2026-10-12 the whole pylon was one boxy loft
       0.42-0.50 m wide sitting on the nacelle, which left gaps at its nose and along the reverser doors and clashed with the deployed
       sleeves, and its aft fairing hung 0.1 m higher over the exhaust (the explorer's depth table). */
    { const sh = 5.9844, WID = [[.478, .012], [.6, .03], [.9, .06], [1.245, .10], [1.5, .15], [1.77, .21], [2.15, .29], [2.53, .37], [2.8, .43], [3.05, .48], [3.44, .50], [4.0, .47], [5.0, .46], [6.0, .42], [6.2, .34], [6.3, .24], [6.363, .10]].map(([X, w]) => [X - sh, w]);
      const yWing = 1.66;
      /* the white spine's rounded nose starts about 0.17 m behind the inlet joint (the photo); ahead of it, from the pylon's fore tip at
         the joint (Fig. 28), the blue panel fills between the fan cowls */
      const SIN = Math.sin(deg(10)), xTip = xJ1 - .17, xFull = -.06, xLE = x(795.2), KEEL = .155;
      const ss = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
      /* a smooth (monotone cubic) curve through [x, y] points, so the gloss runs clean along the spine */
      const mono = pts => { const P = pts.slice().sort((a, b) => a[0] - b[0]), n = P.length, d = [], m = [];
        for (let i = 0; i < n - 1; i++) d.push((P[i + 1][1] - P[i][1]) / (P[i + 1][0] - P[i][0]));
        m.push(d[0]); for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2); m.push(d[n - 2]);
        for (let i = 0; i < n - 1; i++) { if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; } const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
          if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; } }
        return xx => { if (xx <= P[0][0]) return P[0][1]; if (xx >= P[n - 1][0]) return P[n - 1][1]; let i = 0; while (xx > P[i + 1][0]) i++;
          const h = P[i + 1][0] - P[i][0], t = (xx - P[i][0]) / h, t2 = t * t, t3 = t2 * t;
          return (2 * t3 - 3 * t2 + 1) * P[i][1] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * P[i + 1][1] + (t3 - t2) * h * m[i + 1]; }; };
      /* the top line: Fig. 28's quick rise over the fan cowls, then steadily up to the wing at the leading edge notch; high enough over
         the reverser for the DCU-to-ICU lines that run along the top inside */
      const TOPF = mono([[xTip, 1.209], [xTip - .015, 1.232], [xTip - .05, 1.258], [.10, 1.285], [0, 1.315], [-.4, 1.385], [-.96, 1.47], [-1.25, 1.507], [-1.6, 1.545], [-2.2, 1.613], [xLE, yWing], [-5.6, yWing]]);
      /* underside of the keel inside the nacelle: 1.125 over the fan case, where the forward mount's beam sits between the mount ring
         and the pylon (p.45-47); 1.02 over the core */
      const bot = xx => (xx > -.95 ? 1.125 : xx > -1.05 ? 1.02 + .105 * (xx + 1.05) / .1 : 1.02);
      /* the spine's section at station xx: base yc on the cowl and door hinge line (the outer skin), half-width hw there, top yt,
         superellipse power n, the nose tapering ahead of xFull. Just behind the reverser it narrows into the aft fairing's fin */
      const sec = xx => { const xs = Math.max(xx, xTE), yt = TOPF(xx), n = 2.6 + 3.4 * ss((-2.2 - xx) / .45), r = rOut(Math.min(xs, xJ1));
        const hw = Math.max(.02, r * SIN * (xs >= xTip ? 0 : xs <= xFull ? 1 : Math.sqrt(1 - Math.pow((xs - xFull) / (xTip - xFull), 2))));
        return { yc: Math.sqrt(r * r - hw * hw), hw, yt, n }; };
      /* a point on the body's arch at parameter t (-1 at the left base corner, 0 on top, 1 at the right) */
      const arch = (s, t) => { const f = (1 - Math.min(1, Math.abs(t))) * Math.PI / 2, c = Math.cos(f), sn = Math.sin(f);
        return [s.yc + (s.yt - s.yc) * Math.pow(sn, 2 / s.n), Math.sign(t) * s.hw * Math.pow(c, 2 / s.n)]; };
      /* a closed loft through sections that each carry an open ring of [y, z] points (all the same length), closed underneath by a flat
         strip with its own vertices, so the shading stays clean at the base corners */
      const loftArch = (secs, NA) => { const pos = [], idx = [], rings = secs.map(s => { const R = []; for (let i = 0; i <= NA; i++) R.push(arch(s, -1 + 2 * i / NA)); return R; }), n = NA + 1;
        rings.forEach((R, k) => R.forEach(([y, z]) => pos.push(secs[k].x, y, z)));
        for (let k = 0; k < secs.length - 1; k++) for (let i = 0; i < NA; i++) { const a = k * n + i, b = a + 1, c = a + n, d = b + n; idx.push(a, c, b, b, c, d); }
        const top = new THREE.BufferGeometry(); top.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); top.setIndex(idx); top.computeVertexNormals();
        const p2 = [], i2 = [];   // underside strip and the two end caps (fans from the base's mid point)
        secs.forEach(s => { p2.push(s.x, s.yc, -s.hw, s.x, s.yc, 0, s.x, s.yc, s.hw); });                     // its mid line matches the caps' fans
        for (let k = 0; k < secs.length - 1; k++) for (let j = 0; j < 2; j++) { const a = 3 * k + j, b = a + 1, c = a + 3, d = a + 4; i2.push(a, b, c, b, d, c); }
        for (const [k, flip] of [[0, false], [secs.length - 1, true]]) { const base = p2.length / 3, s = secs[k]; p2.push(s.x, s.yc, 0); rings[k].forEach(([y, z]) => p2.push(s.x, y, z));
          for (let i = 0; i < NA; i++) flip ? i2.push(base, base + 2 + i, base + 1 + i) : i2.push(base, base + 1 + i, base + 2 + i); }
        const bottom = new THREE.BufferGeometry(); bottom.setAttribute('position', new THREE.Float32BufferAttribute(p2, 3)); bottom.setIndex(i2); bottom.computeVertexNormals();
        const g = G.merge([top, bottom]); G.orientOutward(g); g.computeVertexNormals(); g.userData.solid = true; return g; };
      const XS = []; for (let i = 0; i <= 56; i++) XS.push(xTip - (xTip - (xTE - .03)) * Math.pow(i / 56, 1.15));   // denser at the nose
      PW.add('pylon', loftArch(XS.map(xx => Object.assign({ x: xx }, sec(xx))), 40), 'whitePaint');
      /* the keel under it inside the nacelle: the fan cowl support beam and the reverser hinge beams, to the end of the upper bifurcation */
      const xB = xTE + .25;
      const kb = xx => Math.min(bot(xx), sec(xx).yc - .05), kt = xx => Math.min(sec(xx).yc + .012, Math.sqrt(Math.pow(rOut(xx) - .025, 2) - KEEL * KEEL));
      const KS = []; for (let i = 0; i <= 44; i++) { const xx = (xJ1 - .01) - (xJ1 - .01 - (xB + .05)) * i / 44; KS.push({ x: xx, yb: kb(xx), yt: kt(xx), hw: KEEL }); }
      PW.add('pylon', G.loft(KS, { n: 32, exp: 8 }), 'whitePaint');
      /* a closed loft through sections whose outline is made of faces (polylines of [y, z] points, the same length in every section),
         each lofted with its own vertices so the edges between faces stay crisp, and closed at the ends by fans. The outline runs up the
         left (-z) side, over the top and down the right, so every face points outward */
      const loftFaces = (secs, caps) => { const parts = [];
        secs[0].faces.forEach((_, f) => { const n = secs[0].faces[f].length, pos = [], idx = [];
          secs.forEach(s => s.faces[f].forEach(([y, z]) => pos.push(s.x, y, z)));
          for (let k = 0; k < secs.length - 1; k++) for (let i = 0; i < n - 1; i++) { const a = k * n + i, b = a + 1, c = a + n, d = b + n; idx.push(a, c, b, b, c, d); }
          const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); parts.push(g); });
        if (caps !== false) for (const [k, front] of [[0, true], [secs.length - 1, false]]) { const s = secs[k], out = [].concat(...s.faces.map(fc => fc.slice(0, -1))), N = out.length;
          const pos = [s.x, out.reduce((a, p) => a + p[0], 0) / N, out.reduce((a, p) => a + p[1], 0) / N], idx = [];
          out.forEach(([y, z]) => pos.push(s.x, y, z)); for (let i = 0; i < N; i++) front ? idx.push(0, 1 + i, 1 + (i + 1) % N) : idx.push(0, 1 + (i + 1) % N, 1 + i);
          const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); parts.push(g); }
        const g = G.merge(parts); g.userData.solid = caps !== false; return g; };
      /* the aft fairing behind the reverser, from where the upper bifurcation ends (Fig. 28, p.9, a photo of an A220 engine from straight
         aft): a fin under the wing, 0.31 m wide (0.33 m round the ICU), standing on a base that widens in a full curve onto the core cowl
         and the core nozzle. Between the reverser's trailing edge and Fig. 28's lower forward corner of the aft fairing (ZS 806.7) the base
         is tall, enclosing the aft mount (p.49), and narrows to the fin's width below the deployed sleeves' upper edges, which pass either
         side; aft of that corner it is a low skirt over the core exhaust whose underside stays just over it and curves up into the sloping
         trailing edge (Fig. 28's lower edge, lowest about ZS 830-845). The base is as wide as the explorer measured the pylon from below.
         Only the skirt's lower part is the bare-metal heat shield (Fig. 28's unriveted lower panel). Until 2026-10-12 a box hung here, as
         wide at the top as at the bottom, its heat shield 0.5 m up its sides */
      const rbA = mono([[xCN, rIFS(xCN + .004) + .004], [-3.45, .41], [-3.8, .45], [-4.21, .55], [x(880.6), .79], [-5.2, 1.3], [-5.5, 1.645]]);
      const rb = xx => xx > xCN + .004 ? rIFS(xx) + .004 : rbA(xx);                        // the base's underside, a circle round the engine axis
      const xC6 = x(806.7), xHS = x(880.6), HS = .17;                                       // the heat shield runs between them, HS up the skirt
      const aft = xx => { const W2 = G.interp(WID, xx) / 2, ws = xx > xTE + .02 ? G.lerp(.13, G.interp(WID, xTE + .02) / 2, ss((xB - xx) / (xB - xTE - .02))) : W2;
        const r = rb(xx), ysd = Math.sqrt(Math.max(0, r * r - ws * ws)), yTop = TOPF(xx), yt = xx > xTE ? sec(xx).yc + .01 : yTop;
        const hT = Math.min(G.lerp(Math.max(.1, Math.min(.45, .86 - ysd)), .26, ss((xC6 + .03 - xx) / .12)), (yTop - ysd) * .5), yF = ysd + hT;
        const tf = Math.max(.04, Math.min(1, G.lerp(1, .62, ss((-3.15 - xx) / .7)), W2 / .1));
        const ICU = ss((-2.62 - xx) / .1) * (1 - ss((-3.12 - xx) / .1)), wLo = .155 * tf, wHi = G.lerp(sec(xTE).hw, .155 + .01 * ICU, ss((xTE - xx) / .3)) * tf;   // as wide as the spine at the reverser's trailing edge
        const wFin = y => Math.min(wHi, Math.max(wLo, (.1763 * y - .006) * tf));   // the deployed sleeves' top edges run up the 10 deg line (0.176 y out): just inside it
        const w = y => { const wf = wFin(y); if (y >= yF) return wf; return wf + (ws - wf) * Math.pow(Math.max(0, 1 - (y - ysd) / hT), .75); };
        return { ws, ysd, yt, yTop, yF, hT, w, r }; };
      /* its outline at station xx: the left side up, a rounded cap over the top, the right side down, the underside back across */
      const aftFaces = (xx, off) => { const A = aft(xx), o = off || 0, M = 18, cap = Math.min(.06, (A.yt - A.ysd) * .25), yC = A.yt - cap, side = [], top = [], arc = [];
        for (let j = 0; j <= M; j++) { const y = A.ysd + (yC - A.ysd) * Math.pow(j / M, 1.5); side.push([y, A.w(y) + o]); }
        const wC = A.w(yC) + o; for (let j = 0; j <= 12; j++) { const t = -1 + j / 6, f = (1 - Math.abs(t)) * Math.PI / 2; top.push([yC + (cap + o) * Math.pow(Math.sin(f), .8), Math.sign(t) * wC * Math.pow(Math.cos(f), .8)]); }
        for (let j = 0; j <= 12; j++) { const z = (A.ws + o) * (1 - 2 * j / 12); arc.push([Math.sqrt(Math.max(0, Math.pow(A.r - o, 2) - z * z)), z]); }
        return { A, left: side.map(([y, z]) => [y, -z]), top, right: side.slice().reverse(), arc }; };
      const AX = []; for (let i = 0; i <= 72; i++) AX.push((xB + .03) - (xB + .03 + 5.48) * Math.pow(i / 72, 1.25));
      PW.add('pylon', loftFaces(AX.map(xx => { const F = aftFaces(xx); return { x: xx, faces: [F.left, F.top, F.right, F.arc] }; })), 'whitePaint');
      /* the heat shield: the underside and the lower HS of the skirt, 2 mm proud of the fairing */
      { const HX = [], o = .002; for (let i = 0; i <= 40; i++) HX.push(xC6 - (xC6 - xHS) * i / 40);
        PW.add('pylon', loftFaces(HX.map(xx => { const A = aft(xx), yE = Math.sqrt(Math.max(0, Math.pow(A.r - o, 2) - Math.pow(A.ws + o, 2))), up = [], arc = [];
          for (let j = 0; j <= 8; j++) { const y = j ? A.ysd + Math.min(HS, A.hT) * j / 8 : yE; up.push([y, A.w(Math.max(y, A.ysd)) + o]); }
          for (let j = 0; j <= 12; j++) { const z = (A.ws + o) * (1 - 2 * j / 12); arc.push([Math.sqrt(Math.max(0, Math.pow(A.r - o, 2) - z * z)), z]); }
          return { x: xx, faces: [up.map(([y, z]) => [y, -z]), up.slice().reverse(), arc] }; }), false), 'bareCowl', { solid: false }); }
      /* panel joints and fastener rows, as Fig. 28 and p.9 draw them: flush heads in the white paint along the spine's base, a row midway
         up its panels over the reverser and double rows at its joints (ZS 731.7, 749.2, 767.4); on the aft fairing a row under the wing,
         one above the heat shield and double rows at its joints (ZS 813.4, 836.0, 857.8, 873.8), and a row of bare heads along the heat
         shield's top edge. Each joint is also a fine seam */
      { const R = [], RH = [], SEAMS = [], at = (s, t) => { const p = arch(s, t), e = .004, a = arch(s, Math.max(-1, t - e)), b = arch(s, Math.min(1, t + e)), dy = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dy, dz) || 1;
          let ny = dz / L, nz = -dy / L; if (ny * (p[0] - s.yc + .05) + nz * p[1] < 0) { ny = -ny; nz = -nz; } return [p[0], p[1], ny, nz]; };
        const tAt = (s, y, side) => { const u = Math.max(0, Math.min(1, (y - s.yc) / (s.yt - s.yc))), f = Math.asin(Math.pow(u, s.n / 2)); return side * (1 - f / (Math.PI / 2)); };
        const onAft = (xx, y, side) => { const A = aft(xx), e = .005, z = A.w(y), d = (A.w(y + e) - A.w(y - e)) / (2 * e), L = Math.hypot(1, d); return [xx, y, side * z, -d / L, side / L]; };
        for (let xx = xTip - .05; xx >= xTE + .02; xx -= .045) { const s = sec(xx); if (s.yt - s.yc < .03) continue; for (const sd of [-1, 1]) { const p = at(s, tAt(s, s.yc + .016, sd)); R.push([xx, ...p]); } }
        for (let xx = -.97; xx >= xTE + .03; xx -= .05) { const s = sec(xx); for (const sd of [-1, 1]) { const p = at(s, tAt(s, s.yc + .5 * (s.yt - s.yc), sd)); R.push([xx, ...p]); } }
        for (const zs of [731.7, 749.2, 767.4]) { const xj = x(zs); SEAMS.push(['spine', xj]); for (const dx of [-.012, .012]) { const s = sec(xj + dx); for (let t = -.96; t <= .961; t += .055) R.push([xj + dx, ...at(s, t)]); } }
        for (let xx = xTE - .05; xx >= -5.15; xx -= .05) { const A = aft(xx); if (A.yTop - A.ysd < .2) continue; for (const sd of [-1, 1]) R.push(onAft(xx, A.yTop - .075, sd)); }
        for (let xx = xC6 - .02; xx >= xHS + .03; xx -= .05) { const A = aft(xx); for (const sd of [-1, 1]) { R.push(onAft(xx, A.ysd + HS + .025, sd)); RH.push(onAft(xx, A.ysd + HS - .015, sd)); } }
        SEAMS.push(['aft', xTE - .03]);                                                     // where the aft fairing meets the spine
        for (const zs of [813.4, 836.0, 857.8, 873.8]) { const xj = x(zs); SEAMS.push(['aft', xj]); for (const dx of [-.012, .012]) { const A = aft(xj + dx);
          for (let y = A.ysd + HS + .03; y <= A.yTop - .08; y += .045) for (const sd of [-1, 1]) R.push(onAft(xj + dx, y, sd)); } }
        const heads = (pts, mat, over) => { const m = new THREE.InstancedMesh(new THREE.CylinderGeometry(.0027, .0027, .0008, 10), null, pts.length), ob = new THREE.Object3D(), up = new THREE.Vector3(0, 1, 0);
          pts.forEach(([xx, y, z, ny, nz], i) => { const nv = new THREE.Vector3(0, ny, nz).normalize(); ob.position.set(xx, y + ny * .0003, z + nz * .0003); ob.quaternion.setFromUnitVectors(up, nv); ob.updateMatrix(); m.setMatrixAt(i, ob.matrix); });
          return PW.add('pylon', m, mat, { mat: over, solid: false, shadow: false }); };
        heads(R, 'whitePaint', { color: '#d3d7dc', clearcoatRoughness: .3 }); heads(RH, 'bareCowl', { color: '#8d8f90' });
        /* the seams: a 1.5 mm grey line round the section at each joint, just proud of the skin */
        const seamG = []; for (const [kind, xj] of SEAMS) { const ring = [];
          if (kind === 'spine') { const s = sec(xj); for (let t = -1; t <= 1.0001; t += .05) ring.push(at(s, t)); }
          else { const A = aft(xj); for (let j = 0; j <= 20; j++) { const y = A.ysd + HS + (A.yTop - .03 - A.ysd - HS) * j / 20; ring.push([y, -A.w(y), 0, -1]); } for (let j = 20; j >= 0; j--) { const y = A.ysd + HS + (A.yTop - .03 - A.ysd - HS) * j / 20; ring.push([y, A.w(y), 0, 1]); } }
          const pos = [], idx = []; ring.forEach(([y, z, ny, nz]) => { for (const dx of [-.0011, .0011]) pos.push(xj + dx, y + ny * .0008, z + nz * .0008); });
          for (let i = 0; i < ring.length - 1; i++) { const a = 2 * i; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
          const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); seamG.push(g); }
        PW.add('pylon', G.merge(seamG), 'whitePaint', { mat: { color: '#6f767d', side: THREE.DoubleSide, clearcoat: 0, roughness: .8 }, solid: false, shadow: false }); }
      /* the blue panel between the fan cowls from the inlet joint, round and under the spine's nose (photo of a Breeze No. 2 engine) */
      { const fp = []; for (let i = 0; i <= 8; i++) { const xx = (xJ1 - .002) - (xJ1 - .002 - xFull + .01) * i / 8; fp.push([xx, rOut(xx)]); }
        PW.add('pylon', G.revolve(G.shellProfile(fp, fp.map(([xx, r]) => [xx, r - .02])), { seg: 12, thetaStart: TAU - deg(9.92), thetaLength: deg(19.84) }), 'nacellePaint'); }
      PW.pylon = { sec, arch, aft, KEEL, kb };                                             // for the audit scripts
      /* the aft mount fitting: pylon structure from the aft mount's main beam (r 0.64) up into the pylon box (p.45, p.49) */
      { const xa = D.GEN.nacelle.engineAftMountPlane.x, f = PW.kit.frame('pylon', xa, 12, .40); PW.kit.box('pylon', f, [0, .43, 0], [.11, .38, .15], 'greyPrimer', { round: .012 }); }
      /* the access panels on both sides of the aft pylon over the thrust reverser isolation control unit (p.344), each laid on the
         side skin (the section's upper part is a superellipse) and tilted to its slope */
      { const xx = -2.9, yc = 1.40, side = aft(xx).w, tilt = Math.atan((side(yc + .01) - side(yc - .01)) / .02);
        for (const sg of [-1, 1]) { const f = PW.kit.frame('pylon', xx, 12, yc); f.position.z = sg * side(yc); f.rotateX(sg * tilt);
          PW.kit.box('pylon', f, [0, 0, sg * .0005], [.266, .206, .003], 'darkBox', { round: .002 }); PW.kit.box('pylon', f, [0, 0, sg * .0018], [.26, .2, .003], 'whitePaint', { round: .012 }); } }
    }

    /* the door sequences, as the manual gives them. Fan cowls (p.14): lift the cowl to 55 deg, fit the forward hold-open rod, then the
       aft one. Reverser doors (p.40-42): the locking actuator extends fully, the door settles back onto the actuator's mechanical lock,
       then the hold-open rod goes on. Closing runs each backward, rods first; the reverser door rises to full extension again to free
       the lock before it comes down. S.fan and S.tr run 0..1 through their sequence at a steady rate; a reverser door opens only once
       the fan cowls are open, the fan cowls close only once the doors are shut, and the sleeves move only with the doors shut */
    const FAN = { lift: .42, rods: [[.42, .71], [.71, 1]] }, TR = { up: .5, lock: .6, max: deg(31), hold: deg(29.5) };
    S.angle = { fan: p => deg(55) * ease01(p / FAN.lift), tr: p => p < TR.up ? TR.max * ease01(p / TR.up) : TR.max - (TR.max - TR.hold) * ease01((p - TR.up) / (TR.lock - TR.up)) };
    /* pose everything for the current S (ex: how far the explode slider swings the doors open) */
    S.apply = ex => {
      for (const h of S.hinges) { h.obj.rotation.x = h.sign * Math.max(S.angle[h.axis](S[h.axis]), (ex || 0) * h.max);
        if (h.axis === 'fan') h.w = FAN.rods.map(([a, b]) => ease01((S.fan - a) / (b - a))); else h.w = ease01((S.tr - TR.lock) / (1 - TR.lock)); }
      const u = S.stroke * S.sleeve;
      for (const sl of S.sleeves) sl.position.x = -u;
      for (const b of S.blockers) { const th = doorAngle(b, u); b.piv.rotation.set(b.a, 0, 0); b.piv.rotateZ(th); aimLink(b, u, th); }
      for (const st of S.struts) st.update(); };
    /* the first part of the explode slider swings the fan cowls and reverser doors open as well, before they lift away */
    PW.anim.push(dt => { const k = 1 - Math.exp(-3.5 * dt), s = Math.min(1, Math.max(0, (PW.explodeT || 0) / .12)), ex = s * s * (3 - 2 * s), step = dt / 5.5;
      const go = key => { S[key] += Math.max(-step, Math.min(step, S.want[key] - S[key])); };
      if (S.want.fan > S.fan || S.tr <= 0) go('fan');
      if (S.want.tr < S.tr || S.fan >= 1) go('tr');
      if (S.tr <= 0) S.sleeve += (S.want.sleeve - S.sleeve) * k;
      S.apply(ex);
    });
    PW.addControl && PW.addControl('Cowls', [
      { label: 'Closed', on: true, apply: () => { S.want.fan = 0; S.want.tr = 0; } },
      { label: 'Fan cowls open', apply: () => { S.want.fan = 1; S.want.tr = 0; } },
      { label: 'All open', apply: () => { S.want.fan = 1; S.want.tr = 1; S.want.sleeve = 0; } }]);
    /* p.372-375, MEL dispatch lockout: the ICU's inhibit lever pinned in INHIBIT (built with the ICU) and a lockout pin down through each
       stowed sleeve into its latch beam lug, the sleeves' blanking plates stowed where the pins were */
    const LO = PW.lockout = PW.lockout || { on: 0 };
    PW.anim.push(() => { const on = !!LO.on; if (LO.nac === on) return; LO.nac = on; for (const [g, whenOn] of LO.groups || []) g.visible = whenOn === on; });
    PW.addControl && PW.addControl('Reverser', [
      { label: 'Stowed', on: true, apply: () => { S.want.sleeve = 0; LO.on = 0; } },
      { label: 'Deployed', apply: () => { S.want.sleeve = 1; S.want.tr = 0; LO.on = 0; } },
      { label: 'Locked out', apply: () => { S.want.sleeve = 0; S.want.tr = 0; LO.on = 1; } }]);
  }

  /* ---- the exploded view, from the outside in ----
     Runs after every builder. The slider opens the engine in four overlapping layers, and nothing is put away:
     1 (0 to 0.24) the nacelle: inlet forward, fan cowls and reverser doors swung open on their hinges (the nacelle animation does
       that over the first 0.12) and lifted clear, and the pylon lifted with what it carries (precooler, ICU and DCU, the fire element
       on its underside); the mounts rise halfway, between it and the engine.
     2 (0.18 to 0.45) the dressing lifts off the cases: the EEC, PHMU and exciter out from the fan case; harnesses, tubes, ducts,
       sensors, borescope plugs, drains and igniters out from the core, each away from the side it sits on.
     3 (0.40 to 0.68) the accessories: the gearboxes and the units on them drop below; the oil tank and coolers move out sideways.
     4 (0.62 to 1) the core comes apart as in the manual's module breakdown (p.54-55). Each module's real length is measured and the
       modules are spaced in order with even gaps: forward of the fan case the FDGS, the fan rotor and the inlet cone; aft of it the
       FIC, LPC, CIC, HPC, diffuser and combustor, HPT, TIC, LPT, TEC and exhaust. Each bearing goes with the case that carries it,
       the shafts drop below, and the dressing and accessories follow the module they sit on. */
  PW.builders.push(function explodePlan() {
    const P = id => PW.parts.get(id), V3 = (x, y, z) => new THREE.Vector3(x, y, z);
    const S1 = [0, .22], S1d = [.08, .24], S2 = [.18, .45], S3 = [.40, .68], S4 = [.62, 1];   // S1d: the doors lift once they have swung open
    const stage = (id, v, [a, b]) => { const p = P(id); if (p && (v[0] || v[1] || v[2])) p.moves.push({ v: V3(...v), a, b }); };
    for (const p of PW.parts.values()) { p.moves = []; p.explode.set(0, 0, 0); }
    PW.root.updateMatrixWorld(true);
    const bounds = (id, own) => { const b = new THREE.Box3(); for (const m of own ? P(id).meshes : PW.meshesOf(id)) b.expandByObject(m); return b; };
    const xr = ids => { const b = new THREE.Box3(); for (const id of ids) b.union(bounds(id)); return [b.min.x, b.max.x]; };
    /* L metres straight out from the engine axis, toward clock h, or away from the side the part sits on (straight up if it rings
       the engine) */
    const radial = (id, L, h) => { let y = 1, z = 0;
      if (h !== undefined) { y = Math.cos(G.clock(h)); z = Math.sin(G.clock(h)); }
      else { const c = bounds(id).getCenter(V3()), r = Math.hypot(c.y, c.z); if (r > .08) { y = c.y / r; z = c.z / r; } }
      return [0, L * y, L * z]; };

    /* layer 4, worked out first because the others follow it: the module chain */
    const GAP = .25, off = {}, span = {}, fc = xr(['fan-case']);
    const chain = ['fic', 'lpc', 'cic', 'hpc', 'combustor', 'hpt', 'tic', 'lpt', 'tec', 'exhaust'].filter(P);
    let cur = fc[0] - GAP;
    for (const id of chain) { const [a, b] = xr([id]); off[id] = cur - b; cur = a + off[id] - GAP; span[id] = [a, b]; stage(id, [off[id], 0, 0], S4); }
    /* forward: FDGS, then the fan rotor (blades and hub), then the inlet cone, which hangs on the rotor */
    cur = fc[1] + GAP;
    { const [a, b] = xr(['fdgs']); off.fdgs = cur - a; cur = b + off.fdgs + GAP; stage('fdgs', [off.fdgs, 0, 0], S4); }
    { const [a, b] = xr(['fan-blades', 'fan-hub']); off.fan = cur - a; cur = b + off.fan + GAP; stage('fan-rotor', [off.fan, 0, 0], S4); }
    { const [a, b] = xr(['inlet-cone']); const o = cur - a; cur = b + o + GAP; stage('inlet-cone', [o - off.fan, 0, 0], S4); }
    for (const [b, m] of [['bearing-1', 'fdgs'], ['bearing-1-5', 'fdgs'], ['bearing-2', 'lpc'], ['bearing-3', 'cic'], ['bearing-4', 'tic'], ['bearing-5', 'lpt'], ['bearing-6', 'tec']]) stage(b, [off[m] || 0, 0, 0], S4);
    stage('shafts', [off.hpc, -.6, 0], S4);
    /* the module an outside part sits on: the one whose length covers the middle of the part */
    const carrier = id => { const c = bounds(id, P(id).meshes.length > 0).getCenter(V3()); let best = chain[0], bd = Infinity;
      for (const m of chain) { const [a, b] = span[m], d = c.x < a ? a - c.x : c.x > b ? c.x - b : 0; if (d < bd) { bd = d; best = m; } }
      return off[best]; };

    /* layer 1: the nacelle */
    { const [a] = xr(['inlet']), all = cur + .2 - a; stage('inlet', [1.6, 0, 0], S1); stage('inlet', [all - 1.6, 0, 0], S4); }
    /* The doors lift more than they spread, so from the usual three-quarter view they sit above the core rather than in front of it.
       Until 2026-10-14 they went 4 to 4.5 m out and the pylon 3 m up, off the screen (Brian: "some stuff separates too much") */
    stage('fan-cowl-left', [0, 1.5, -.95], S1d); stage('fan-cowl-right', [0, 1.5, .95], S1d);
    stage('fan-cowl-left', [0, .5, -.25], S4); stage('fan-cowl-right', [0, .5, .25], S4);                  // a little higher once the core spreads out
    for (const [id, s] of [['tr-left', -1], ['tr-right', 1]]) { stage(id, [-.3, 1.6, 1.1 * s], S1d); stage(id, [off.hpc * .6 + .3, .9, .35 * s], S4); }
    for (const id of ['pylon', 'precooler', 'tras-control', 'fire']) stage(id, [0, 2.3, 0], S1);
    for (const id of ['fire-left', 'fire-right']) stage(id, [0, -2.3, 0], S1);                     // the core cowl elements stay on their doors
    stage('mounts', [0, 1.15, 0], S1);

    /* layer 2: the dressing */
    stage('eec', radial('eec', .5, 9), S2); stage('phmu', radial('phmu', .5, 9), S2); stage('pdos', radial('pdos', .4, 3), S2);
    const ign = radial('ignition', .45, 8), igs = radial('igniters', .3, 4.5);
    stage('ignition', ign, S2); stage('igniters', [0, igs[1] - ign[1], igs[2] - ign[2]], S2);    // the plugs leave the core, not the fan case
    stage('harnesses', [0, .25, -.3], S2); stage('drain-mast', [0, -.35, 0], S2); stage('fuel', radial('fuel', .3), S2);
    for (const id of ['hpc-bleed-valve', 'bleed-hp', 'buffer-air', 'hpt-cooling', 'tic-cooling', 'tacc', 'cai']) stage(id, radial(id, .3), S2);
    for (const id of P('sensors').children) stage(id, radial(id, .3), S2);
    for (const id of P('borescope').children) stage(id, radial(id, .25), S2);

    /* layer 3: the accessories (the gearbox dropped 1.1 m until 2026-10-14) */
    stage('gearboxes', [0, -.85, 0], S3);
    stage('oil-tank', radial('oil-tank', .75, 3), S3); stage('aoc', radial('aoc', .8, 10.5), S3);
    stage('vfgoohx', radial('vfgoohx', .65, 9), S3); stage('fohe', radial('fohe', .6, 11.5), S3);
    stage('oil-front', [0, -.85, 0], S3);                                                          // the front oil tubes are on the gearbox's front face

    /* layer 4: dressing and accessories follow the module they sit on; the anti-ice duct and fan case units stay. The harnesses run
       over many modules, so they lift clear of the spread core as one bundle instead of tangling through it (Brian: "not everything
       separates") */
    stage('gearboxes', [off.hpc, 0, 0], S4); stage('oil', [off.combustor, 0, 0], S4); stage('fuel', [off.combustor, 0, 0], S4); stage('igniters', [off.combustor, 0, 0], S4);
    stage('oil-front', [off.hpc - off.combustor, 0, 0], S4);                                        // with the gearbox, not the oil system
    stage('vfg-aohx', [-off.combustor, 0, 0], S4);                                                  // the VFG air/oil cooler stays in the fan exit liner, on the fan case
    stage('harnesses', [0, 1.1, 0], S4);
    stage('n1-target', [off.lpc, 0, 0], S4);                                                        // the N1 target is the No. 2 bearing's coupling nut: with that bearing
    for (const id of ['hpc-sva', 'lpc-sva', 'bleed-25', 'hpc-bleed-valve', 'bleed-hp', 'buffer-air', 'hpt-cooling', 'tic-cooling', 'tacc', 'drain-mast'].concat(P('sensors').children, P('borescope').children))
      stage(id, [id === 'nf-probe' ? off.fdgs : carrier(id), 0, 0], S4);                         // the fan speed probe sits in the No. 1 bearing support, on the FDGS
    PW.EXPLODE_SPAN = cur;
  });

  /* the inlet's scarf: the lower lip sits 2.1 in aft of the upper (ZS 647.1 top, 649.2 bottom); shift vertices near the lip by angle */
  function scarf(g, xHL) {
    const p = g.attributes.position, d = .0533;
    for (let i = 0; i < p.count; i++) { const xx = p.getX(i), y = p.getY(i), z = p.getZ(i), r = Math.hypot(y, z) || 1;
      const w = Math.max(0, Math.min(1, 1 - (xHL - xx) / .9)), down = (1 - y / r) / 2; p.setX(i, xx - d * down * w); }
    p.needsUpdate = true; return g;
  }
})();
