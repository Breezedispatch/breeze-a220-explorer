/* PW1500G model: everything on the outside of the cases. Angle and main gearboxes with their accessories, the oil tank and coolers,
   the EEC and harnesses, fuel, bleed, anti-ice and clearance control plumbing, variable vane actuation, ignition, engine mounts and
   the drain mast. Positions are clock (aft looking forward) and radius on the case they sit on, from the Delta CH 70-80 manual
   (p.44-73, 94-107, 162-183, 212-255, 256-323) and Brian's hangar photos. Sizes not given in the manual are scaled off its figures. */
(function () {
  const PW = window.PW, G = window.PWGeo, D = PW.D, TAU = Math.PI * 2;
  (PW.builders = PW.builders || []).push(build);
  const deg = d => d * Math.PI / 180, V = (x, y, z) => new THREE.Vector3(x, y, z);
  /* a heat-shrink identification sleeve: two lines of small dark print running along the hose on a light ground */
  const printTex = bg => { const k = 'print' + bg; return PW.tex[k] || (PW.tex[k] = PW.tex.canvas(128, 128, (c, w, h) => {
    c.fillStyle = bg; c.fillRect(0, 0, w, h); c.fillStyle = '#1e1e22';
    for (const u of [.22, .72]) for (let y = 14; y < h - 14; y += 9) if ((y * 7) % 5 !== 0) c.fillRect(u * w + ((y * 13) % 3), y, 5 + (y * 11) % 4, 6); }, { srgb: true })); };

  Object.assign(PW.MAT, {
    gearboxCast: () => new THREE.MeshStandardMaterial({ color: new THREE.Color('#a69e8b'), roughness: .62, metalness: .5, roughnessMap: PW.tex.noise('cast', 256, 14, .55, 1), bumpMap: PW.tex.noise('cast', 256, 14, .55, 1), bumpScale: .0008 }),
    accGrey: () => new THREE.MeshStandardMaterial({ color: new THREE.Color('#8b9197'), roughness: .5, metalness: .35 }),
    eecGrey: () => new THREE.MeshStandardMaterial({ color: new THREE.Color('#9aa0a6'), roughness: .55, metalness: .2 }),
    fireSleeve: () => new THREE.MeshStandardMaterial({ color: new THREE.Color('#5e3238'), roughness: .85, metalness: 0, bumpMap: PW.tex.noise('weave', 256, 30, .6, 1), bumpScale: .0008 }),   // the dark maroon fire sleeves on the core hoses (photos; brick red until 2026-10-12)
    labelWhite: () => new THREE.MeshStandardMaterial({ color: new THREE.Color('#ffffff'), map: printTex('#ecebe6'), roughness: .6, metalness: 0 }),        // printed identification sleeves on the hoses (photos)
    labelPrintBlue: () => new THREE.MeshStandardMaterial({ color: new THREE.Color('#ffffff'), map: printTex('#7fa3cf'), roughness: .55, metalness: 0 }),
    blackHose: () => new THREE.MeshStandardMaterial({ color: new THREE.Color('#222426'), roughness: .8, metalness: .05, bumpMap: PW.tex.noise('weave', 256, 30, .6, 1), bumpScale: .0008 }),
    clampOrange: () => new THREE.MeshStandardMaterial({ color: new THREE.Color('#c8642c'), roughness: .6, metalness: .1 }),
    labelBlue: () => new THREE.MeshStandardMaterial({ color: new THREE.Color('#2f62b8'), roughness: .5, metalness: .1 }),
    stainless: () => new THREE.MeshStandardMaterial({ color: new THREE.Color('#c4c7c9'), roughness: .36, metalness: .8, roughnessMap: PW.tex.noise('fine', 256, 40, .6, 1) }),   // the bleed ducts' brushed finish (photos)
    bareSheet: () => new THREE.MeshStandardMaterial({ color: new THREE.Color('#bfc3c5'), roughness: .5, metalness: .35, roughnessMap: PW.tex.noise('fine', 256, 40, .6, 1) }),   // light satin bare sheet: the VFG air/oil cooler's hood (photos)
    chromate: () => new THREE.MeshStandardMaterial({ color: new THREE.Color('#a08a40'), roughness: .45, metalness: .4 }),         // the olive-gold conversion coat on the VFG air/oil cooler's grille (photo)
  });

  /* ---------------- helpers ---------------- */
  const P = (x, h, r) => G.onRing(x, r, G.clock(h));                      // a point at clock h, radius r
  const rCase = x => G.interp(D.GEN.lines.outer, x);                      // outside of the core cases at x
  /* a cylindrical unit along x (pumps, generators): centred at (x, clock h, radius r) */
  function can(pid, x, h, r, rad, len, mat, o) { o = o || {}; const g = G.can(rad, len, { edge: o.edge }); const m = PW.add(pid, g, mat || 'accGrey');
    m.position.copy(P(x, h, r)); if (o.rot) m.rotation.set(...o.rot); return m; }
  /* a box unit oriented to the case: l along x, h radial, w tangential */
  function box(pid, x, h, r, l, hh, w, mat, o) { o = o || {}; const m = new THREE.Mesh(G.roundedBox(l, hh, w, o.round || Math.min(l, hh, w) * .15));
    m.position.copy(P(x, h, r)); m.rotation.x = G.clock(h); if (o.tilt) m.rotateZ(o.tilt); PW.add(pid, m, mat || 'accGrey', { solid: true }); return m; }
  /* a local frame on the case at (x, clock h, radius r) for flat units: x along the engine axis, y radially out, z toward increasing clock */
  function frame(pid, x, h, r) { const f = new THREE.Group(); f.position.copy(P(x, h, r)); f.rotation.x = G.clock(h); PW.parts.get(pid).obj.add(f); return f; }
  const fbox = (pid, f, x, y, z, l, hh, w, mat, round) => PW.add(pid, new THREE.Mesh(G.roundedBox(l, hh, w, round === undefined ? Math.min(l, hh, w) * .15 : round)), mat, { solid: true, into: f, pos: [x, y, z] });
  /* a solid swept round the engine axis from angle a0 to a1, like G.revolve, but with a closed [x, r] section that changes with the
     angle: sec(a) gives the same number of points at every angle. Each section edge is its own strip, so its corners stay sharp */
  function sweepSections(sec, a0, a1, n) {
    const S = []; for (let j = 0; j <= n; j++) { const a = a0 + (a1 - a0) * j / n; S.push([a, sec(a).map(p => [p[0], Math.max(0, p[1])])]); }
    const area = s => { let A = 0; for (let i = 0; i < s.length; i++) { const [x0, r0] = s[i], [x1, r1] = s[(i + 1) % s.length]; A += x0 * r1 - x1 * r0; } return A; };
    if (area(S[0][1]) < 0) for (const e of S) e[1] = e[1].slice().reverse();                                     // counter-clockwise, so the faces point out
    const m = S[0][1].length, pos = [], uv = [], idx = [];
    for (let i = 0; i < m; i++) { const base = pos.length / 3;
      for (let j = 0; j <= n; j++) { const [a, s] = S[j], c = Math.cos(a), sn = Math.sin(a), A = s[i], B = s[(i + 1) % m];
        pos.push(A[0], A[1] * c, A[1] * sn, B[0], B[1] * c, B[1] * sn); uv.push(j / n, i, j / n, i + 1); }
      for (let j = 0; j < n; j++) { const a = base + j * 2, b = a + 1, a1 = a + 2, b1 = a + 3; idx.push(a, b, a1, a1, b, b1); } }
    for (const [j, sgn] of [[0, -1], [n, 1]]) { const [a, s] = S[j], c = Math.cos(a), sn = Math.sin(a), base = pos.length / 3;   // the two end caps
      const tris = THREE.ShapeUtils.triangulateShape(s.map(p => new THREE.Vector2(p[0], p[1])), []);
      for (const p of s) { pos.push(p[0], p[1] * c, p[1] * sn); uv.push(p[0], p[1]); }
      for (const t of tris) sgn > 0 ? idx.push(base + t[0], base + t[1], base + t[2]) : idx.push(base + t[0], base + t[2], base + t[1]); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals(); g.userData.solid = true; return g; }
  /* an electrical connector with its backshell, pointing along dir */
  function connector(pid, at, dir) { const c = new THREE.Mesh(G.can(.022, .05)); c.geometry.rotateZ(Math.PI / 2); G.aim(c, at, dir); PW.add(pid, c, 'connector', { solid: true });
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(.026, .026, .012, 16)); ring.geometry.userData.solid = true; G.aim(ring, at.clone().addScaledVector(dir.clone().normalize(), .018), dir); PW.add(pid, ring, 'orange', { solid: true }); }
  /* a routed line with clamps: kind 'tube' | 'hose' | 'harness' | 'duct'. The tube and its clamps, end nuts and bands share a
     lineId, so the connection audit can tell a line's own end fittings from whatever it plugs into */
  let lineSeq = 0;
  function line(pid, pts, r, kind, o) { o = o || {};
    const inCore = pts.reduce((s, p) => s + (p.isVector3 ? p.x : p[0]), 0) / pts.length < -.95;                    // aft of the fan case, in the core compartment
    const mat = o.mat || { tube: 'tube', hose: 'fireSleeve', harness: inCore ? 'harnessCore' : 'harness', duct: 'insulation', black: 'blackHose', cable: 'braidSteel' }[kind] || 'tube', lid = ++lineSeq;
    const tag = m => { m.userData.isLine = true; m.userData.lineId = lid; m.userData.lineKind = kind; return m; };
    const g = G.tube(pts.map(p => (p.isVector3 ? p : V(...p))), r, { radial: kind === 'duct' ? 16 : 10, tension: o.tension === undefined ? .25 : o.tension });
    if ((kind === 'harness' || kind === 'cable') && g.attributes.uv) { const L = g.userData.curve.getLength(), uv = g.attributes.uv, k = kind === 'cable' ? 16 : 8; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * L * k); }   // braid repeats along its length
    tag(PW.add(pid, g, mat));
    const curve = g.userData.curve, n = o.clamps === undefined ? Math.max(1, Math.round(curve.getLength() / (kind === 'duct' ? .35 : .25))) : o.clamps;
    if (n > 0) { const ts = []; for (let i = 1; i <= n; i++) ts.push(i / (n + 1));
      /* clamps are thin bands: orange cushioned P-clamps on small lines, steel V-band couplings on large ducts */
      const big = kind === 'duct' || r > .03, band = Math.min(r * 1.6, big ? .022 : .016);
      tag(PW.add(pid, G.alongCurve(curve, ts, () => new THREE.CylinderGeometry(r + Math.min(.008, r * .35), r + Math.min(.008, r * .35), band, 16)), big ? 'steel' : kind === 'harness' ? 'connector' : 'clampOrange', { shadow: false })); }
    if (o.ends !== false && kind !== 'duct') tag(PW.add(pid, G.alongCurve(curve, [0.012, .988], () => new THREE.CylinderGeometry(r * 1.6, r * 1.6, r * 2.2, 6)), kind === 'harness' ? 'connector' : 'steel', { shadow: false }));
    if (o.bands) tag(PW.add(pid, G.alongCurve(curve, o.bands, () => new THREE.CylinderGeometry(r + .0018, r + .0018, .012, 14)), 'clampOrange', { shadow: false }));   // orange identification sleeves (photos)
    if (o.labels) for (const [t, m] of o.labels) tag(PW.add(pid, G.alongCurve(curve, [t], () => new THREE.CylinderGeometry(r + .0015, r + .0015, Math.max(.035, r * 3.2), 20)), m || 'labelWhite', { shadow: false }));   // printed ID sleeves (photos: white and blue on the core hoses)
    return curve;
  }
  /* where along a routed line (0..1 by length) it reaches station x: for sleeves and boots where it passes through a panel */
  function tAt(curve, x) { let tb = 0, best = Infinity; for (let i = 0; i <= 400; i++) { const d = Math.abs(curve.getPointAt(i / 400).x - x); if (d < best) { best = d; tb = i / 400; } } return tb; }

  function build() {
    if (!D.GEN) return;
    const GB = D.GEN.gearboxParts, NC = D.GEN.nacelle;

    /* ============================== GEARBOXES ============================== */
    /* Shapes from the manual's renders (p.65-69, 99-101, 164-173, 222-237, 296-301) and the finishes from Brian's photos: tan castings,
       natural aluminium accessories, the VFG grey-blue with its white terminal cover, black chip collector caps. Each unit is built in
       its own frame on the case (PW.kit): x forward, y radially out, z toward increasing clock */
    const Kt = PW.kit;
    PW.part('gearboxes', { label: 'Angle and main gearboxes', explode: [0, -.55, 0], src: 'p.66-69; TTM ch. 72',
      info: 'The N2 rotor drives a towershaft to the angle gearbox on the CIC at 8 o\'clock. A layshaft runs aft from there to the main gearbox, a cast aluminium housing slung under the core from about 4:30 to 9 o\'clock. Accessories mount on its forward and aft faces.\n\nThe gearboxes are driven by the N2 rotor, which is why the starter cranks the core through them and why the generators and the hydraulic pump stop when the engine does.' });
    /* "driven by the N2 rotor" rather than "at N2 speed": p.66 says the N2 speed is reduced before the MGB input, TTM ch. 72 says the MGB
       is driven at N2 speed. Flagged to Brian on 2026-10-14 */
    PW.part('agb', { parent: 'gearboxes', label: 'Angle gearbox (AGB)', src: 'p.66-67, p.69; p.53, p.214',
      info: 'Bevel gearbox bolted to the outside of the compressor intermediate case (CIC) at the lower left, beside the IFPC (p.66: 8 o\'clock). The towershaft from the N2 rotor comes up through the CIC into its square flange on the case, and its bevel gears turn the drive aft into the layshaft to the main gearbox. The N2 speed is reduced on the way, so the MGB input turns in its proper speed range.\n\nIts oil comes from the MGB through a last-chance strainer, and its scavenge has its own stage and chip collector (AGB) on the lube and scavenge pump.' });
    /* p.66: installed on the CIC at 8 o'clock, the layshaft's forward cover secured to it and the rear cover to the MGB, the two sliding
       over each other for the thermal growth between them; p.53 draws the towershaft rising aft from the N2 rotor through the CIC; p.67
       and p.69 show the layshaft entering the MGB between the IFPC and hydraulic pump pads. Built at 7:18, beside the IFPC (7:42 to
       8:24), bolted face-on to the outside of the CIC's aft cone where the towershaft comes out of it, so nothing cuts into the case.
       Until 2026-10-08 it sat a few cm further forward, at p.53's drawn station, sunk into a pocket cut in the cone */
    const FLa = (x0, h0, r0, rz) => { const c = Math.cos(rz || 0), s = Math.sin(rz || 0), a = G.clock(h0);
      return (lx, ly, lz) => { const X = lx * c - ly * s, Y = r0 + lx * s + ly * c; return V(x0 + X, Y * Math.cos(a) - lz * Math.sin(a), Y * Math.sin(a) + lz * Math.cos(a)); }; };
    const lsR = .328, lsX = -1.178;                                                                                   // the layshaft's radius and its front end in the gearbox
    { const xe = -1.0912, re = .345, rz = Math.atan2(-.21, .253), L = FLa(xe, 7.3, re, rz);                           // on the cone where the towershaft leaves it; local x into the case
      const f = Kt.frame('agb', xe, 7.3, re, { rz });
      Kt.box('agb', f, [-.0035, 0, 0], [.009, .15, .14], 'castTan', { round: .004 });                                  // square towershaft flange on the case
      for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) Kt.hex('agb', f, [-.0095, a * .066, b * .061], '-x', .005, .005, 'steel');
      Kt.box('agb', f, [-.048, .004, 0], [.08, .12, .11], 'castTan', { round: .016 });                                  // gear housing
      Kt.cyl('agb', f, [-.035, .02, .062], 'z', .011, .012, 'steel', { edge: .002 }); Kt.hex('agb', f, [-.035, .02, .072], 'z', .012, .008, 'steel');   // last-chance strainer in the oil feed
      Kt.fitting('agb', f, [-.035, .02, .076], 'z', .007); Kt.fitting('agb', f, [-.06, -.03, -.055], '-z', .007);         // oil feed in (8 o'clock side) and scavenge out
      /* the towershaft housing, from the N2 rotor's bevel gear (p.53) up through the CIC into the flange: hidden inside the case */
      const t = GB.towershaftHousing; line('agb', [P(t[0][0], 7.3, t[0][1]), L(.004, 0, 0)], .03, 'tube', { clamps: 0, ends: false });
      /* p.213: oil feed from a boss on the MGB front face under the fuel/oil manifold, forward under the IFPC into the strainer on the
         gearbox's 8 o'clock side; scavenge from its 7 o'clock side aft beside the layshaft cover, under the servo fuel lines, to its boss */
      const fp = L(-.035, .02, .076 + .007 * 1.45), sp = L(-.06, -.03, -.055 - .007 * 1.45);
      line('agb', [fp, L(-.035, .02, .1), P(-1.145, 7.95, .378), P(-1.19, 8.15, .344), P(-1.24, 8.35, .341), P(-1.29, 8.45, .344), P(-1.35, 8.45, .345), P(-1.45, 8.45, .335), P(-1.483, 8.45, .333)], .006, 'tube', { clamps: 2 });   // feed, under the left core harness
      line('agb', [sp, L(-.06, -.03, -.08), P(-1.17, 6.9, .352), P(-1.26, 6.88, .347), P(-1.35, 6.9, .345), P(-1.45, 6.9, .335), P(-1.483, 6.9, .333)], .007, 'tube', { clamps: 2 }); }   // scavenge
    PW.part('layshaft', { parent: 'gearboxes', label: 'Layshaft and covers', src: 'p.66-67; p.53',
      info: 'Drive shaft from the angle gearbox aft to the main gearbox\'s layshaft drive pad, between the IFPC and hydraulic pump pads (p.67). It runs inside two tubular covers: the forward one secured to the angle gearbox, the rear one to the MGB. They slide over each other at the flanged joint in the middle to take the thermal growth between the compressor case and the gearbox (p.66). It is the MGB\'s only drive: when the starter turns the MGB, the layshaft and angle gearbox turn the HPC.' });
    { const m0 = GB.mainGearboxBody.x_from, xj = (lsX + m0) / 2, f = Kt.frame('layshaft', 0, 7.3, lsR);
      Kt.cyl('layshaft', f, [(lsX + xj) / 2, 0, 0], 'x', .034, lsX - xj, 'tube', { edge: .004 });                        // forward cover, from the gearbox
      Kt.cyl('layshaft', f, [(xj + m0 - .02) / 2, 0, 0], 'x', .030, xj - m0 + .02, 'tube', { edge: .004 });             // rear cover, sliding into it, into the MGB pad
      Kt.flange('layshaft', f, [xj, 0, 0], 'x', .034, .046, .01, 6, 'steel'); Kt.flange('layshaft', f, [lsX - .008, 0, 0], '-x', .034, .05, .01, 6, 'castTan'); }   // the joint; the forward cover's flange on the gearbox

    PW.part('mgb', { parent: 'gearboxes', label: 'Main gearbox (MGB)', src: 'p.66-69; p.53; p.237; photos',
      info: 'Cast aluminium housing under the core, from about 4:30 to 9 o\'clock, with machined pads on both faces. Forward face: the fuel/oil manifold with the IFPC (8 o\'clock), the layshaft input, the hydraulic pump and the lube and scavenge oil pump (5 o\'clock). Aft face: the air turbine starter, the PMAG (7 o\'clock) and the VFG. The oil control module is on its right side (p.226) and the deoiler in its right arm.\n\nTwo mounting links hang it from the diffuser case and a rod link from its aft face to the turbine intermediate case takes the axial load. A heat shield over its top keeps the core\'s radiant heat off it, and a centering puck on top lines it up during installation. Replaceable carbon seals at each pad, the N2 cranking pad for turning the core by hand during a borescope, and the core drain plugs are serviced here.' });
    const mg = GB.mainGearboxBody, mx0 = mg.x_from, mx1 = mg.x_to, xm = (mx0 + mx1) / 2;
    /* the axes of the starter (8:00) and the VFG (6:09) on the gearbox's aft face. Both hang lower than the gearbox's mid-depth, so their
       bodies clear the diffuser case and the fuel nozzle heads behind it: p.297 puts the starter axis about 8 in below the engine axis,
       16-17 in out from it, and the TTM (p.878) puts the starter at 8 o'clock. Until 2026-10-12 they were at r 0.385 and 0.365 and cut
       into the case; the starter was at 8:24 until 2026-10-14 */
    const ATS_R = .43, VFG_R = .435, ATS_H = 8.0;
    /* the pads on the housing's walls, [clock, axis radius, radius the casting must reach round it]: aft, the starter, PMAG and VFG
       pads (flanges r 0.118, 0.066, 0.118, plus a casting margin); forward, the hydraulic pump's round pad and the LSOP's square one */
    const PADS_AFT = [[ATS_H, ATS_R, .126], [7.15, .40, .074], [6.15, VFG_R, .126]], PADS_FWD = [[5.8, .40, .083], [4.85, .40, .084]];
    /* how far out from the engine axis a wall must reach at angle a to back every pad on it: the pad circles, in the wall's plane */
    const padReach = (pads, a) => pads.reduce((m, [h, r, R]) => { const d = a - G.clock(h), s = r * Math.sin(d);
      return Math.abs(s) < R ? Math.max(m, r * Math.cos(d) + Math.sqrt(R * R - s * s)) : m; }, 0);
    { const th0 = G.clock(4.4), th1 = G.clock(9.1);
      /* section from the p.53 outline (drawn at 6 o'clock): bottom about 0.47; the top at r 0.285 under the heat shield leaves the
         5 cm gap to the core (it was 0.27 until 2026-10-07; the gap was made for the deoiler vent duct, read from p.237 as crossing
         there, which runs aft to the TEC instead since 2026-10-12).
         p.67's views of the two faces show the walls following the pads: the aft wall drops round the starter pad on the left arm and
         round the VFG pad, whose rim is the housing's lower edge there, and the underside rises from it toward the drain plugs; the
         forward wall reaches down round the hydraulic pump and LSOP pads. So the section changes with the clock: each wall reaches
         to the pad circles behind it, and the underside slopes from the aft wall's lower edge to the p.53 depth at mid-length. p.53 is
         a simplified section and leaves out the aft-face accessories. Until 2026-10-14 the section was the same all round, and the
         starter and VFG flanges, which reach r 0.55, hung half off an aft face that ended at r 0.44 (Brian) */
      const section = a => { const ra = Math.max(.44, padReach(PADS_AFT, a)), rf = Math.max(.445, padReach(PADS_FWD, a));
        return [[mx0 + .008, .29], [mx0 + .008, rf], [mx0 - .008, Math.max(.462, rf + .006)], [xm, .472], [mx1 + .02, Math.max(.458, ra - .004)], [mx1 - .008, ra],
          [mx1 - .008, .305], [mx1 + .01, .287], [mx0 - .01, .285]]; };
      PW.add('mgb', sweepSections(section, th0, th1, 140), 'castTan');
      /* the underside's radius at station x and angle a, for the drain plugs */
      const under = (x, a) => { const s = section(a), pts = [s[2], s[3], s[4]]; for (let i = 0; i < 2; i++) { const [x0, r0] = pts[i], [x1, r1] = pts[i + 1];
        if (x <= x0 && x >= x1) return r0 + (r1 - r0) * (x - x0) / (x1 - x0); } return s[3][1]; };
      for (const [a0, a1] of [[G.clock(3.95), th0], [th1, G.clock(9.55)]])                                            // the arms rising up the sides of the core
        PW.add('mgb', G.revolve([[mx0 - .005, .30], [mx0 - .005, .41], [mx1 + .005, .41], [mx1 + .005, .30]], { seg: 6, thetaStart: a0, thetaLength: a1 - a0 }), 'castTan');
      /* ribs round the underside, following it over the pad lobes (p.67 and the photo from below show them running round the casting;
         there were eleven fore-and-aft ribs here until 2026-10-14). The forward one clears the drain plugs */
      for (const xr of [mx0 - .02, mx1 + .03]) PW.add('mgb', sweepSections(a => { const u = under(xr, a); return [[xr + .006, u - .004], [xr - .006, u - .004], [xr - .006, u + .009], [xr + .006, u + .009]]; },
        th0 + .05, th1 - .05, 140), 'castTan');
      /* heat shield over the top, centering puck through it */
      PW.add('mgb', G.revolve([[mx0 - .004, .277], [mx1 + .004, .277], [mx1 + .004, .2805], [mx0 - .004, .2805]], { seg: 44, thetaStart: th0 + .04, thetaLength: th1 - th0 - .08 }), 'insulation');
      { const f = Kt.frame('mgb', xm - .02, 6.3, .275); Kt.cyl('mgb', f, [0, -.006, 0], 'y', .026, .016, 'steel'); Kt.bolts('mgb', f, [0, .003, 0], '-y', .036, 4, .004); }
      /* aft face pads: starter, PMAG, VFG (the N2 cranking pad's cover, inboard of the PMAG, is its own part; it was a round cover at
         7:45 between the starter and the PMAG until 2026-10-14) */
      /* the pad faces on the aft wall, bolt holes as p.67 draws them: 16 round the starter pad, 12 round the rim of the VFG's */
      for (const [h, r, r0, r1, n] of [[ATS_H, ATS_R, .085, .118, 16], [7.15, .40, .042, .066, 6], [6.15, VFG_R, .1, .118, 12]]) {
        const f = Kt.frame('mgb', mx1, h, r); Kt.flange('mgb', f, [-.006, 0, 0], '-x', r0, r1, .012, n, 'castTan'); }
      /* p.67, p.99 and the photo from below: four core drain plugs in an axial row on the bottom of the housing, pointing down, at the
         stations p.53 gives (data.js drivePads); there were five on the aft face until 2026-10-12. Each sits on the underside where it
         is at that station, which rises forward from the VFG pad's lobe */
      for (const dp of GB.drivePads) { const f = Kt.frame('mgb', dp.x, 6.55, under(dp.x, G.clock(6.55))); Kt.plug('mgb', f, [0, 0, 0], 'y', .0075); }
      /* forward face: the angle gearbox layshaft drive pad, between the IFPC and hydraulic pump pads (p.67), where the layshaft enters */
      { const f = Kt.frame('mgb', mx0, 7.3, .328); Kt.flange('mgb', f, [.006, 0, 0], 'x', .03, .046, .012, 6, 'castTan'); }
      /* hung from the diffuser case on two mounting links; the rod link to the TIC takes the axial load (p.66-67) */
      for (const [h, h2] of [[4.05, 3.75], [9.45, 9.85]]) {
        const a = P(xm, h, .33), b = P(-1.665, h2, .258); line('mgb', [a, b], .011, 'tube', { clamps: 0, ends: false });   // to the diffuser case just aft of the H flange
        for (const p of [a, b]) { const m = new THREE.Mesh(G.roundedBox(.035, .03, .028, .006)); m.position.copy(p); m.rotation.x = G.clock(h); PW.add('mgb', m, 'steel', { solid: true }); } }
      /* p.67's aft view: the rod link's lower clevis is between the PMAG and VFG pads; it was between the PMAG and the starter, at 7:33,
         until 2026-10-14. Here it runs aft at 6:45 just clear of the generator's side, over the fuel manifolds, to the TIC */
      { const a = P(mx1 - .01, 6.75, .35), b = P(-2.10, 6.72, .372); line('mgb', [a, P(-1.72, 6.74, .362), b], .012, 'tube', { clamps: 0, ends: false, tension: 0 });
        const f = Kt.frame('mgb', -1.88, 6.73, .366); Kt.hex('mgb', f, [0, 0, 0], 'x', .015, .03, 'steel');                     // turnbuckle
        for (const p of [a, b]) { const m = new THREE.Mesh(new THREE.SphereGeometry(.016, 14, 10)); m.position.copy(p); PW.add('mgb', m, 'steel', { solid: true }); } }
    }
    /* accessories on the MGB faces (p.69 layout; clocks from p.112, 170, 226, 296) */
    const acc = (pid, label, info, src) => PW.part(pid, { parent: 'gearboxes', label, info, src });
    // forward face
    acc('ifpc', 'Integrated fuel pump and control (IFPC)', 'Engine fuel pump and metering unit, mounted on the fuel/oil manifold on the MGB front face at 8 o\'clock and driven by the gearbox. Inside: a centrifugal boost pump; the high-pressure gear pump, which also supplies servo fuel to the vane and bleed actuators and the turbine active clearance control valve (p.166); a motive flow pump that returns motive flow to the aircraft fuel system; and the metering section, with the fuel metering valve the EEC commands, its pressure-regulating valve, the windmill bypass valve, the minimum pressure-shutoff valve, and the dual-coil overspeed shutdown solenoid that works them to shut off metered flow.\n\nThe flow divider valve keeps the secondary manifold shut until the pressure between the manifolds passes 100 psi. When the start is complete the EEC energizes the equalization bypass valve solenoid: the EBV then feeds the secondary manifold and equalizes the flow between the two, and the flow divider closes. The INFO message 73 L (R) ENGINE FAULT - FUEL EQUAL INOP means no working EEC channel can command that solenoid (p.207). If the fuel temperature sensor fails, the EEC meters with a default of 75 deg C. Its carbon-sealed drive pad is on the MGB; fuel leaks there show at the drain mast.', 'p.162-171, p.69');
    /* p.165: a pump housing with a square drive flange, a control section of valve bodies on top, the metering valve's conical torque
       motor housing, connectors and fittings, all natural cast aluminium */
    { const f = Kt.frame('ifpc', mx0 + .16, 8.05, .44);
      Kt.box('ifpc', f, [0, -.015, 0], [.18, .11, .15], 'castAl', { round: .018 });                                       // pump housing
      Kt.box('ifpc', f, [-.096, -.02, 0], [.018, .12, .12], 'castAl', { round: .006 });                                    // square drive flange, bolted to the manifold face
      Kt.cyl('ifpc', f, [.03, .055, -.03], 'x', .03, .1, 'castAl'); Kt.cyl('ifpc', f, [-.01, .055, .035], 'x', .026, .09, 'castAl');   // metering and pressure-regulating valve bodies
      Kt.cyl('ifpc', f, [.04, .025, .085], 'z', .022, .05, 'castAl'); Kt.cyl('ifpc', f, [-.04, .04, -.085], '-z', .02, .045, 'castAl');
      Kt.cone('ifpc', f, [.115, .055, -.03], 'x', .012, .03, .05, 'castAl');                                              // fuel metering valve torque motor / LVDT
      Kt.box('ifpc', f, [-.02, .075, -.005], [.07, .02, .05], 'darkBox', { round: .005 });                                // overspeed shutdown solenoid
      Kt.connector('ifpc', f, [.08, .055, .03], 'x', .012, { lead: '-y' }); Kt.connector('ifpc', f, [-.055, .075, -.005], '-x', .009, { lead: '-z' });   // the solenoid's on its aft end, under the IFS
      Kt.fitting('ifpc', f, [.06, -.04, .075], 'z', .018);                                                                // boost pump inlet, from the aircraft
      Kt.fitting('ifpc', f, [.09, .02, .065], 'x', .008);                                                                 // metered fuel out, up to the flow meter (A Nahas photo)
      Kt.fitting('ifpc', f, [-.03, -.05, .075], 'z', .008); Kt.fitting('ifpc', f, [.07, .0, -.075], '-z', .008);               // motive flow out; servo fuel supply to the vane, bleed and clearance control actuators (p.167)
      Kt.plate('ifpc', f, [.03, -.035, .0761], 'z', 'y', .05, .025); }
    acc('fom', 'Fuel/oil manifold (FOM), fuel flow meter and fuel filter', 'Upright manifold block against the left end of the MGB front face, from about 7 to 9:30 o\'clock, with the VFG oil/oil heat exchanger on a tower on its top end. It carries the IFPC on its forward face at 8 o\'clock, the fuel flow meter above it at 9 o\'clock and the fuel filter below it, and routes the boost-pump fuel to and from the fuel/oil heat exchanger, which keeps it above 0 deg C at the filter inlet.\n\nIt is also the hub of the cooled-path oil (p.215). Oil from the oil control module comes in through the MGB and goes up to the FOHX bypass valve. The valve\'s air/oil cooler share comes back and goes on to the air/oil cooler through the short tube from the tower. The oil from the FOHX and from the VFG oil/oil heat exchanger joins inside the manifold on its way back to the oil control module.\n\nFuel filter: a disposable canister in a housing screwed into the filter head on the manifold face. The head carries the bypass valve, the lockwired housing drain and the differential pressure sensor; the housing is turned off by the hex in its end. The sensor plugs into the head beside the housing at 7:30, connector forward, and reports to both EEC channels. Above 22 psid: L(R) ENG FUEL FILTER advisory with an IMPENDING BYPASS info message. At 25 psid the bypass valve opens (BYPASS info message). Both engines in bypass gives the L-R ENG FUEL FILTER caution: suspect fuel contamination.\n\nFuel flow meter: on the manifold just above the IFPC, measuring the metered fuel going to the nozzles. Metered fuel comes up a U-tube from the IFPC to the inlet on its forward end. From the meter it goes back through the manifold into the IFPC\'s minimum pressure-shutoff valve (MPSOV) and flow divider valve (FDV), which send it out through the manifold to the primary and secondary tubes (p.166-167). Its signal goes to EEC channel A, and to channel B over the CAN bus.', 'p.162-179, p.69; TTM 73-00; A Nahas photos');
    { const t0 = G.clock(7.1), t1 = G.clock(9.35);
      PW.add('fom', G.revolve([[mx0 + .055, .37], [mx0 + .004, .37], [mx0 + .004, .465], [mx0 + .055, .465]], { seg: 20, thetaStart: t0, thetaLength: t1 - t0, crease: 30 }), 'castAl');
      { const f = Kt.frame('fom', mx0 + .03, 7.9, .468); Kt.fitting('fom', f, [0, .004, 0], 'y', .009); }   // servo fuel return in (motive flow leaves the IFPC itself, TTM 73-00 fig. 2)
      /* on the top end face, outboard: boost fuel to and from the FOHX. The metered fuel for the primary and secondary manifolds leaves
         the inner face just below it (it left the top face until 2026-10-14, where the oil tower now stands) */
      for (const [x, r] of [[-1.444, .43], [-1.472, .455]]) Kt.fitting('fom', Kt.frame('fom', x, 9.35, r), [0, 0, 0], 'z', .009);
      for (const [x, h] of [[-1.472, 9.25], [-1.444, 9.12]]) Kt.fitting('fom', Kt.frame('fom', x, h, .37), [0, 0, 0], '-y', .008);
      /* the oil side (p.215, p.217): the manifold is the hub of the cooled-path oil. Oil from the oil control module comes into it through
         the MGB and goes out to the FOHX bypass valve; the bypass valve's air/oil cooler share comes back into it and on to the air/oil
         cooler; the FOHX and VFG oil/oil cooler outlets join inside it on the way back to the module. p.171, p.215 and the A Nahas photo
         (p.18) put the VFG oil/oil cooler on its top end, under the aft end of the FOHX: here it stands on a tower on the top face, its
         engine oil passing through the tower. The tubes to and from the bypass valve leave the outer face, the FOHX return comes into
         the forward face and the air/oil cooler feed leaves the tower's aft face. The tube routes are assumed */
      PW.add('fom', G.revolve([[-1.4505, .373], [-1.479, .373], [-1.479, .414], [-1.4505, .414]], { seg: 6, thetaStart: G.clock(9.35), thetaLength: G.clock(9.725) - G.clock(9.35) }), 'castAl');
      for (const [x, h] of [[-1.446, 9.28], [-1.47, 9.16]]) Kt.fitting('fom', Kt.frame('fom', x, h, .465), [0, 0, 0], 'y', .01);   // oil out to the FOHX bypass valve; its air/oil cooler share back
      Kt.fitting('fom', Kt.frame('fom', mx0 + .055, 9.28, .41), [0, 0, 0], 'x', .011);                                            // FOHX return
      Kt.fitting('fom', Kt.frame('fom', -1.479, 9.63, .394), [0, 0, 0], '-x', .01);                                               // on to the air/oil cooler
      /* fuel flow meter (p.171, p.179 view A, A Nahas photo): just above the IFPC at about 9 o'clock, lying fore and aft. A flange bolted
         to the manifold face, a cast body, the flow tube with the metered fuel inlet on its forward end, and the electronics housing
         along its top with the connector facing forward */
      { const f = Kt.frame('fom', mx0 + .055, 8.85, .43);
        Kt.box('fom', f, [.008, 0, -.002], [.016, .086, .088], 'castAl', { round: .006 });                                   // mounting flange
        for (const [y, z] of [[-.036, -.038], [.036, -.038], [-.036, .034], [.036, .034]]) Kt.hex('fom', f, [.0185, y, z], 'x', .0048, .005, 'steel');
        Kt.box('fom', f, [.04, -.003, -.003], [.05, .056, .058], 'castAl', { round: .014 });                                // body
        Kt.cyl('fom', f, [.09, -.004, -.008], 'x', .025, .07, 'castAl', { edge: .006 });                                     // flow tube
        Kt.box('fom', f, [.077, 0, .025], [.07, .04, .022], 'castAl', { round: .006 });                                      // electronics housing
        Kt.fitting('fom', f, [.127, -.004, -.008], 'x', .01);                                                                // metered fuel in
        Kt.connector('fom', f, [.111, 0, .025], 'x', .009, { lead: 'x' });
        Kt.plate('fom', f, [.04, .0256, -.003], 'y', 'z', .036, .02); }
      /* fuel filter (p.173): the head on the manifold face carries the bypass valve, the lockwired housing drain and the differential
         pressure sensor; the housing screws into it and is turned off by the hex in its end */
      { const f = Kt.frame('fom', mx0 + .055, 7.25, .46);
        Kt.box('fom', f, [.022, .002, .019], [.044, .112, .15], 'castAl', { round: .014 });                                  // filter head
        Kt.cyl('fom', f, [.096, 0, 0], 'x', .048, .104, 'castAl', { edge: .01 }); Kt.tube('fom', f, [.047, 0, 0], 'x', .047, .051, .006, 'darkBox');   // housing, seal
        Kt.hex('fom', f, [.153, 0, 0], 'x', .024, .01, 'castAl'); Kt.box('fom', f, [.1585, 0, 0], [.002, .012, .012], 'darkBox', { round: .0008 });
        Kt.cyl('fom', f, [.052, .04, .048], 'x', .013, .016, 'castAl'); Kt.hex('fom', f, [.063, .04, .048], 'x', .008, .006, 'steel');   // bypass valve, beside the sensor
        Kt.plug('fom', f, [.03, .053, -.05], [0, .777, -.629], .007);                                                        // housing drain
        /* differential pressure sensor (7:30, p.178-179 view B): plugged into the head beside the housing, held by a slotted tab, its
           connector facing forward */
        Kt.cyl('fom', f, [.078, -.016, .08], 'x', .014, .062, 'castAl', { edge: .003 }); Kt.box('fom', f, [.047, -.016, .074], [.004, .022, .03], 'castAl', { round: .002 });
        Kt.connector('fom', f, [.108, -.016, .08], 'x', .008, { lead: 'y' }); } }
    acc('edp', 'Hydraulic engine-driven pump (EDP)', 'Engine-driven hydraulic pump 2A (EDP 2A) on the MGB forward face, the primary pressure source for hydraulic system No. 2 (3000 psi). The left engine\'s EDP 1A supplies system No. 1; system No. 2\'s backup is AC motor pump 2B (TTM ch. 29). A firewall shutoff valve in its suction line stops the fluid to it after an engine fire or a fluid overheat; the ENG FIRE PBA closes it (p.198; TTM ch. 29). During an in-flight start the EEC depressurizes the pump to unload the engine (p.294). Its suction, pressure and case drain lines run up the right of the core into the pylon.', 'p.66-69, p.198, p.294; TTM ch. 29');
    { const f = Kt.frame('edp', mx0, 5.8, .40);
      Kt.flange('edp', f, [.007, 0, 0], 'x', .045, .075, .012, 8, 'castAl');
      Kt.prof('edp', f, [.11, 0, 0], 'x', [[.09, 0], [.09, .05], [.07, .062], [-.075, .062], [-.085, .07], [-.095, .07], [-.095, 0]], 'castAl');   // pump body
      Kt.cyl('edp', f, [.21, 0, 0], 'x', .045, .05, 'castAl'); Kt.box('edp', f, [.21, .0, .055], [.04, .035, .03], 'darkBox', { round: .004 });   // compensator and depressurising solenoid
      Kt.connector('edp', f, [.21, .0, .072], 'z', .009, { lead: 'x' });
      Kt.fitting('edp', f, [.13, .06, .03], 'y', .014); Kt.fitting('edp', f, [.13, .06, -.03], 'y', .011); Kt.fitting('edp', f, [.07, -.02, -.065], '-z', .008);   // suction, pressure, case drain
      Kt.plate('edp', f, [.11, .0, -.063], '-z', 'x', .05, .025);
      /* its pressure and suction hoses run up the right of the core, aft of the vane and bleed actuators, into the pylon beside the
         precooler supply duct: under the cowl anti-ice duct where they cross it low on the right, then over the PRSOV and the right
         thrust link at 1:30, just inside the IFS */
      for (const dx of [0, -.035]) line('edp', (dx ? [P(-1.358, 5.68, .482), P(-1.355, 5.6, .47)] : [P(-1.358, 5.92, .484), P(-1.35, 5.84, .49), P(-1.325, 5.66, .488)]).concat([P(-1.30 + dx, 5.42, .45), P(-1.275 + dx, 5.15, .462), P(-1.265 + dx, 4.95, .49), P(-1.258 + dx, 4.75, .505), P(-1.25 + dx, 4.4, .51), P(-1.25 + dx, 3.2, .51),
        P(-1.26 + dx, 1.9, .512), P(-1.264 + dx, 1.62, .515), P(-1.27 + dx, 1.35, .515), P(-1.29 + dx, 1.05, .51), P(-1.35 + dx, .6, .51), P(-1.39 + dx, .3, .52), P(-1.398 + dx, .15, .555), V(-1.40 + dx, .62, .08), V(-1.405 + dx, .70, .101),
        V(-1.41 + dx, .76, .108), V(-1.415 + dx, .85, .12), V(-1.42 + dx, 1.03, .125)]), .012, 'hose', { clamps: 5, labels: [[.1, 'labelWhite']] }); }   // suction (forward) and pressure (aft) hoses, up between the fan-air duct and the right bifurcation wall, aft of the fan air valve
    /* its case drain to the aircraft's hydraulic return, beside the two hoses all the way to the pylon: it crosses under the cowl anti-ice
       duct at 5 o'clock, where the gap between the duct and the LSOP's chip collectors is widest */
    line('edp', [P(-1.418, 5.42, .388), P(-1.405, 5.36, .40), P(-1.385, 5.3, .425), P(-1.35, 5.2, .455), P(-1.326, 5.05, .463), P(-1.322, 4.85, .482), P(-1.324, 4.7, .50), P(-1.32, 4.4, .51), P(-1.32, 3.2, .51), P(-1.33, 1.9, .512),
      P(-1.333, 1.62, .515), P(-1.337, 1.35, .515), P(-1.36, 1.05, .505), P(-1.42, .6, .51), P(-1.46, .3, .52), P(-1.468, .15, .555), V(-1.47, .62, .078), V(-1.475, .70, .097), V(-1.48, .76, .107), V(-1.485, .85, .12), V(-1.49, 1.03, .125)], .006, 'hose', { clamps: 4 });
    acc('lsop', 'Lubrication and scavenge oil pump (LSOP)', 'Seven-stage pump at the right end of the MGB forward face, 5 o\'clock: one pressure stage and six scavenge stages. It slides onto the gearbox pad on two guide pins and is held by captive bolts. Each scavenge return has its own chip collector with a black bayonet cap along the pump body, so a debris message can be traced to the bearing compartment it came from. The No. 4 and No. 5/6 scavenge tubes come forward under the gearbox into the two fittings on its 6 o\'clock side. A low oil pressure indication with normal quantity often points here or to the oil control module.', 'p.212-235, p.231, p.69; photos');
    { const f = Kt.frame('lsop', mx0, 4.85, .40);
      Kt.box('lsop', f, [.008, 0, 0], [.016, .13, .13], 'castTan', { round: .008 });                                       // square mounting flange
      for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) Kt.hex('lsop', f, [.019, a * .052, b * .052], 'x', .006, .006, 'steel');   // captive bolts
      Kt.box('lsop', f, [.13, 0, 0], [.23, .1, .11], 'castTan', { round: .03 });                                           // pump body
      Kt.box('lsop', f, [.12, -.005, .062], [.18, .07, .014], 'castTan', { round: .005 });                                // manifold plate
      for (let i = 0; i < 6; i++) Kt.chip('lsop', f, [.05 + i * .033, .052, (i % 2 ? -.025 : .02)], 'y', .01);           // the six scavenge chip collectors
      /* the No. 4 (outer) and No. 5/6 scavenge inlets at the aft end of the manifold plate, their tubes coming forward under the gearbox
         (p.214-215). The front compartments' and the gearboxes' stages are fed through the gearbox casting and are not drawn */
      for (const y of [.02, -.02]) Kt.fitting('lsop', f, [.04, y, .07], 'z', .01); }
    // aft face
    acc('ats', 'Air turbine starter (ATS)', 'Pneumatic starter at the left end of the MGB aft face, at 8 o\'clock, held on its pad by a V-band clamp. Bleed air from the APU, ground cart or the other engine, admitted by the starter air valve, enters through the cone at its aft end and spins its turbine; it cranks the N2 rotor through the gearboxes and disengages above cutout speed. A speed sensor reports to the EEC, and a halo tube round its gearbox end blows cooling air on it.\n\nDuty limits: the STARTER TIME EXCEEDED caution comes on when the starter has run for 4 minutes, or after 30 seconds above 44% N2. After three start attempts or 4 minutes of continuous cranking it needs 30 minutes to cool (p.294, p.302).\n\nIt has its own oil: check the level on the sight glass between FULL and ADD, fill through the FILL port until oil comes out of the overfill port, and drain through the drain port. The magnetic plug at the bottom collects debris: check it in starter troubleshooting.', 'p.286-301, p.69');
    { const ax = mx1, ah = ATS_H, ar = ATS_R, f = Kt.frame('ats', ax, ah, ar);
      /* p.301, from the pad aft: V-band, gearbox and oil sump, bolted mid flange, grooved turbine housing, inlet cone to the duct */
      Kt.vband('ats', f, [-.012, 0, 0], '-x', .095, { phase: 2.4 });
      Kt.prof('ats', f, [0, 0, 0], '-x', [[.02, 0], [.02, .092], [.03, .1], [.125, .1], [.13, .12], [.145, .12], [.15, .116], [.212, .116], [.272, .062], [.285, .062], [.285, 0]], 'castAl', { seg: 56 });
      Kt.bolts('ats', f, [-.149, 0, 0], '-x', .113, 20, .005);
      for (const g of [.165, .18, .195]) Kt.tube('ats', f, [-g, 0, 0], 'x', .113, .12, .004, 'castAl');                   // turbine housing grooves
      Kt.fins('ats', f, [-.235, 0, 0], '-x', .085, 18, .006, .004, .006, 'darkBox');                                       // exhaust slots round the cone
      Kt.vband('ats', f, [-.282, 0, 0], '-x', .062, { phase: 1 });
      /* oil: sight glass and FILL boss on the outboard side, overfill and drain ports and the magnetic plug at the bottom */
      Kt.sight('ats', f, [-.072, .1, .0], 'y', 'x', .022, .048);
      Kt.box('ats', f, [-.04, .096, .055], [.03, .012, .03], 'castAl', { round: .005 }); Kt.hex('ats', f, [-.04, .105, .055], 'y', .011, .008, 'steel');   // FILL port and plug
      Kt.decal('ats', f, [-.1, .1005, .05], 'y', 'z', .045, .016, 'FILL');
      const dn = [0, .31, -.95]; for (const [x, k] of [[-.05, 'plug'], [-.075, 'plug'], [-.1, 'chip']]) { const p = Kt.at([x, 0, 0], Kt.dir(dn), .1); if (k === 'chip') Kt.chip('ats', f, p, dn, .009); else Kt.plug('ats', f, p, dn, .008); }
      /* speed sensor on top with its lead, and the halo cooling air tube */
      const upv = [0, -.31, .95], sp = Kt.at([-.06, 0, 0], Kt.dir(upv), .1); Kt.cyl('ats', f, sp, upv, .011, .03, 'steel'); Kt.connector('ats', f, Kt.at(sp, Kt.dir(upv), .015), upv, .008, { lead: '-x' });
      Kt.prof('ats', f, [-.03, 0, 0], 'x', (() => { const o = []; for (let i = 0; i <= 12; i++) { const a = i / 12 * TAU; o.push([.009 * Math.cos(a), .108 + .009 * Math.sin(a)]); } return o; })(), 'tube', { seg: 48 });
      /* p.300-301, TTM p.879: the halo cooling air supply tube takes fan air from the inlet plenum of the air/oil cooler down to the ring
         round the starter's forward flange, held by a P-clamp on a lug on the gearbox housing */
      line('ats', [P(-1.595, 9.13, .472), P(-1.60, 8.95, .487), P(-1.62, 8.6, .497), P(-1.648, 8.45, .52), FLa(ax, ah, ar)(-.03, .083, .083)], .011, 'tube', { clamps: 1 });   // over the starter pad's flange
      { const g = Kt.frame('ats', -1.62, 8.6, .452); Kt.box('ats', g, [0, .018, 0], [.02, .036, .03], 'castAl', { round: .003 }); }   // its clamp lug on the gearbox
      /* starter air valve on the duct coming down from the pylon (left side) */
      acc('sav', 'Starter air valve (SAV)', 'Pneumatically operated butterfly valve in the starter duct, spring-loaded closed, with a regulator that holds 30 psi downstream. The EEC opens it through a dual-coil torque motor and confirms it open from starter speed and N2. It sits inside a cooling shroud fed by a tube from the air/oil cooler; its line-replaceable filter is under the cover on top.\n\nA 3/8 in square-drive manual override can be reached through an access hole in the left thrust reverser door. The 2017 manual carries a warning that a manual override start is not an approved procedure, because of the motor-to-start logic that prevents starting with a bowed rotor: follow the current AMP and MEL.', 'p.290-299; p.298 warning');
      /* p.297: the starter duct branches down from the precooler's outlet tee (the starter takes cooled bleed, TTM p.579), comes down the
         left of the core through the valve at 9 o'clock, then turns forward and down into the aft end of the starter. It runs just aft of
         the HPT, over the turbine intermediate case: further aft the gap between the LPT case and the IFS is too small for it. It drops
         straight down under the tee and turns left low, under the precooler's strut and the left thrust link */
      const sv = P(-2.07, 9.1, .45), st = P(ax - .29, ah, ar);                                                        // into the starter's inlet cone
      line('sav', [V(-2.14, .685, 0), V(-2.125, .60, 0), V(-2.10, .50, .005), V(-2.09, .445, -.01), P(-2.088, 11.7, .42), P(-2.083, 11.2, .43), P(-2.077, 10.5, .435), P(-2.07, 9.7, .445), sv], .045, 'duct', { clamps: 2 });
      const lowDuct = line('sav', [sv, P(-2.03, 8.45, .42), P(-1.985, 8.05, .428), st], .045, 'duct', { clamps: 1 });
      /* p.299: butterfly body in the duct, actuator and regulator on its side, filter cover on top, the override access funnel, the
         connector; the whole valve sits in a quilted cooling shroud fed by its cooling tube */
      { const g = Kt.frame('sav', -2.07, 9.1, .45);
        Kt.cyl('sav', g, [0, 0, 0], 'z', .052, .075, 'castAl', { edge: .006 }); for (const s of [-1, 1]) Kt.vband('sav', g, [0, 0, s * .042], 'z', .046, { phase: 1.5 });
        Kt.box('sav', g, [0, .045, 0], [.12, .075, .09], 'quilt', { round: .028 });                                         // cooling shroud
        Kt.cyl('sav', g, [0, .088, .0], 'y', .022, .012, 'castAl'); Kt.cone('sav', g, [-.045, .088, .02], 'y', .02, .01, .012, 'castAl');   // filter cover and override funnel, under the IFS (r 0.549 here)
        Kt.connector('sav', g, [.0, .06, -.05], '-z', .01, { lead: 'y' }); Kt.fitting('sav', g, [.04, .06, .045], 'z', .007);    // torque motor connector on the shroud's lower side, clear of the IFS fire element
        /* p.299: the pneumatic control line from its fitting beside the connector, down the duct to a B-nut boss on the lower duct
           toward the starter's inlet elbow (the regulator's downstream sense; the manual names the line, not what it senses) */
        Kt.fitting('sav', g, [.034, .052, -.048], '-z', .006);
        const dp = lowDuct.getPointAt(.62), da = Math.atan2(dp.z, dp.y), fb = Kt.frame('sav', dp.x, da / (Math.PI / 6), Math.hypot(dp.y, dp.z) + .044);
        Kt.cyl('sav', fb, [0, .002, 0], 'y', .008, .008, 'castAl'); Kt.fitting('sav', fb, [0, .008, 0], 'y', .006);
        const S = FLa(-2.07, 9.1, .45, 0), B = FLa(dp.x, da / (Math.PI / 6), Math.hypot(dp.y, dp.z) + .044, 0);
        line('sav', [S(.034, .052, -.0567), S(.034, .05, -.075), P(-2.035, 8.8, .5), P(-2.015, 8.7, .49), B(.0, .04, 0), B(0, .0167, 0)], .004, 'tube', { clamps: 1 }); }
      line('sav', [P(-1.95, 9.8, .45), P(-1.975, 9.7, .455), P(-2.0, 9.55, .47), P(-2.022, 9.43, .503), P(-2.03, 9.335, .513)], .006, 'tube', { clamps: 1 }); }   // cooling tube from the aft face of the air/oil cooler
    acc('pmag', 'Permanent magnet alternator/generator (PMAG)', 'Oil-cooled alternator on the MGB aft face at 7 o\'clock. The stator and its windings are held to the gearbox by captive bolts; the rotor stays on the gearbox shaft when the stator is removed. It has a power winding for each EEC channel, dual N2 speed windings, and a separate generator winding that powers the aircraft fly-by-wire controller.\n\nAbove 45 percent N2 it gives each EEC channel 28 to 34 V. If one channel fails, that EEC channel moves to aircraft 28 V DC and a maintenance message is sent; control is unaffected. Below 45 percent N2, or with both channels failed, the EEC runs on aircraft 28 V DC: channel A from DC ESS BUS 3, channel B from DC ESS BUS 2 on this (right) engine and DC ESS BUS 1 on the left.', 'p.96-101, p.112, p.69');
    /* p.97 and p.99: a smooth can whose flange is held by three captive bolts on lugs; on its end face two small connectors (one per
       EEC channel), a small boss in the middle and a larger connector for the aircraft's generator winding. Until 2026-10-14 it was
       finned, with two connectors */
    { const f = Kt.frame('pmag', mx1, 7.15, .40);
      Kt.flange('pmag', f, [-.006, 0, 0], '-x', .03, .062, .01, 0, 'castAl');
      for (const a of [Math.PI / 2, 7 * Math.PI / 6, 11 * Math.PI / 6]) { const c = Math.cos(a), s = Math.sin(a);
        Kt.box('pmag', f, [-.006, .066 * c, .066 * s], [.012, .022, .018], 'castAl', { round: .004, rot: [a, 0, 0] });                 // lug
        Kt.hex('pmag', f, [-.015, .068 * c, .068 * s], '-x', .0045, .006, 'steel'); }                                                   // its captive bolt
      Kt.prof('pmag', f, [0, 0, 0], '-x', [[.012, 0], [.012, .052], [.018, .055], [.118, .055], [.127, .05], [.13, .046], [.13, 0]], 'castAl');
      Kt.cyl('pmag', f, [-.132, 0, 0], '-x', .005, .004, 'steel');                                                                      // the boss
      Kt.connector('pmag', f, [-.13, .02, -.016], '-x', .009, { lead: '-z' }); Kt.connector('pmag', f, [-.13, -.02, -.016], '-x', .009, { lead: '-z' });   // EEC channels A and B, backshells toward 6 o'clock where their harness runs
      Kt.connector('pmag', f, [-.13, 0, .024], '-x', .013, { lead: 'y' }); }                                                           // the aircraft's generator winding
    /* p.67, p.99: the N2 hand cranking pad inboard of the PMAG, a diamond-shaped cover on two bolts with a round plug in the middle, over
       the drive used to turn the N2 rotor for borescope work (a square four-bolt cover until 2026-10-14) */
    PW.part('n2-crank', { parent: 'gearboxes', label: 'N2 hand cranking pad', src: 'p.67, p.99',
      info: 'Diamond-shaped cover on two bolts on the MGB aft face, inboard of the PMAG, with a round plug in the middle. With the cover off, a drive tool turns the N2 rotor by hand through the gearbox, for borescope inspections of the HPC and HPT.' });
    { const f = Kt.frame('n2-crank', mx1, 7.32, .328);
      Kt.box('n2-crank', f, [-.004, 0, 0], [.008, .036, .036], 'castAl', { round: .006, rot: [Math.PI / 4, 0, 0] });
      Kt.bolts('n2-crank', f, [-.009, 0, 0], '-x', .02, 2, .0035, { phase: Math.PI / 2 });
      Kt.cyl('n2-crank', f, [-.01, 0, 0], '-x', .0095, .004, 'castAl', { edge: .0015 }); Kt.hex('n2-crank', f, [-.0135, 0, 0], '-x', .005, .004, 'steel'); }
    acc('vfg', 'Variable frequency generator (VFG)', 'The engine\'s main AC generator on the MGB aft face: 115/200 V AC, 75 kVA, 380 to 760 Hz, the frequency following N2. Its grey-blue housing is in two bolted sections, with a round blue cap and a capped port underneath; its pad seal drains to the drain mast (tube 4, DR61). It has its own oil, cooled through the VFG oil/oil heat exchanger and a VFG air/oil cooler.\n\nThe crew can disconnect it from the gearbox with the L or R DISC switch on the electrical panel, which also shows its oil cautions (TTM ch. 24). Reconnection is done on the ground, following the AMP.', 'p.66-69; TTM ch. 24; photos');
    { const f = Kt.frame('vfg', mx1, 6.15, VFG_R);
      /* Brian's photos from below: a grey-blue housing, boxy with rounded corners rather than a finned drum, in two bolted sections, with
         a round blue cap and a capped port on its underside. The white disc of tube ends near it in the same photos is the drain mast's
         end plate, not part of the VFG: until 2026-10-08 the model put it here as a feeder terminal cover. It hangs low enough to clear
         the diffuser case and the fuel nozzle heads behind the gearbox (until 2026-10-12 it was at r 0.365 and cut into the case) */
      Kt.cyl('vfg', f, [-.012, 0, 0], 'x', .1, .024, 'vfgGrey', { edge: .004 }); Kt.vband('vfg', f, [-.014, 0, 0], '-x', .102, { phase: 2.6 });   // adapter on the pad
      Kt.box('vfg', f, [-.115, 0, 0], [.17, .2, .18], 'vfgGrey', { round: .035 });                                          // forward section
      Kt.box('vfg', f, [-.2, 0, 0], [.014, .208, .188], 'vfgGrey', { round: .036 });                                        // the bolted joint
      Kt.box('vfg', f, [-.255, 0, 0], [.1, .19, .17], 'vfgGrey', { round: .032 });                                          // aft section
      for (const [y, z] of [[.091, -.06], [.091, 0], [.091, .06], [-.091, -.06], [-.091, 0], [-.091, .06], [-.05, .084], [.05, .084], [-.05, -.084], [.05, -.084]])
        Kt.hex('vfg', f, [-.208, y, z], '-x', .0045, .004, 'steel');
      Kt.cyl('vfg', f, [-.12, .102, .025], 'y', .017, .006, 'labelBlue'); Kt.hex('vfg', f, [-.12, .108, .025], 'y', .006, .006, 'steel');   // the disconnect solenoid reset, under its round blue cap
      Kt.cyl('vfg', f, [-.26, .097, -.035], 'y', .016, .012, 'castAl'); Kt.cyl('vfg', f, [-.26, .106, -.035], 'y', .013, .006, 'capBlack');   // its oil filter
      Kt.box('vfg', f, [-.24, .02, .093], [.08, .03, .006], 'labelBlue', { round: .003 });                                   // the blue data label
      for (const y of [0, .06]) Kt.connector('vfg', f, [-.16, y, .09], 'z', .012, { lead: '-x' });                         // J1 above J2, both on the left face (A Nahas photo, p.18)
      Kt.fitting('vfg', f, [-.04, .06, .095], [0, .53, .85], .009); Kt.fitting('vfg', f, [-.11, .065, .09], [0, .53, .85], .009);   // oil to and from its oil/oil cooler, both toward it
      Kt.fitting('vfg', f, [-.05, .1, -.03], 'y', .006); }                                                                         // pad seal drain, to the drain mast
    acc('ocm', 'Oil control module (OCM)', 'Cast module on the right side of the main gearbox, just forward of the oil tank. The round quilted thermal blanket on its outboard face covers the main oil filter: a primary and a secondary element behind a bolted cover with a vent plug and a drain plug, with a bypass valve that opens at 55 psid. Forward of the filter are the filter differential pressure sensor and the oil debris monitor, with the main oil pressure sensor further forward and low; the variable oil reduction valve and the journal oil shuttle valve for the FDGS are in the body along its bottom, and the active oil damper valve lies along its top, above the filter. The oil temperature probe on top also takes the EGT harness: the EGT probe junctions are compensated there.\n\nThe scavenge oil from the pump also passes through it, past the temperature probe, on its way back to the tank: the return and the pressure tube to the No. 4 and No. 5/6 bearings leave its underside at the aft end. A filter impending-bypass or debris message is worked from here.', 'p.126-129, p.214-215, p.226-249, p.229, p.235; TTM 79-00 fig. 3; A Nahas photos');
    /* p.226: on the right side of the main gearbox. p.223 (a right-side view, scaled on the tank) and the A Nahas photo of the core's
       right side put it just forward of the tank with the round filter cover facing outboard; p.229 is a view from the right: filter
       differential pressure sensor and oil debris monitor forward of the cover, main oil pressure sensor further forward and low, the
       VORV/JOSV along the bottom. Until 2026-10-12 it sat on the gearbox's aft face at 4:54, facing down. The anti-ice duct passes under
       it and the 6th-stage cooling tube under that */
    { const f = Kt.frame('ocm', -1.575, 3.5, .40);
      Kt.box('ocm', f, [-.04, .05, 0], [.21, .10, .19], 'castAl', { round: .015 });                                          // filter housing
      Kt.box('ocm', f, [.10, .045, .01], [.09, .09, .15], 'castAl', { round: .012 });                                         // sensor and valve block, forward
      /* main oil filter: the bolted cover and the flat quilted thermal blanket over it (p.235; A Nahas p.19 inset) */
      Kt.cyl('ocm', f, [-.04, .104, 0], 'y', .088, .008, 'castAl'); Kt.bolts('ocm', f, [-.04, .108, 0], 'y', .082, 10, .005);
      Kt.prof('ocm', f, [-.04, .108, 0], 'y', [[.03, 0], [.03, .084], [.024, .092], [0, .092], [0, 0]], 'quilt', { seg: 48 });   // [height, radius]: a flat quilted disc
      Kt.plug('ocm', f, [-.125, .1, .075], 'y', .007);                                                                        // lubrication trim orifice, low and aft of the cover (p.229)
      /* forward of the cover: OFDP high, the ODM (a square cover on four bolts round its connector) in the middle, MOP forward and low */
      Kt.cyl('ocm', f, [.085, .105, -.04], 'y', .014, .03, 'castAl'); Kt.connector('ocm', f, [.085, .12, -.04], 'y', .008, { lead: 'z' });
      Kt.box('ocm', f, [.105, .093, .02], [.045, .006, .045], 'castAl', { round: .005 });
      for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) Kt.hex('ocm', f, [.105 + a * .017, .097, .02 + b * .017], 'y', .0035, .003, 'steel');
      Kt.connector('ocm', f, [.105, .096, .02], 'y', .008, { lead: 'z' });
      Kt.cyl('ocm', f, [.13, .095, .062], 'y', .011, .02, 'steel'); Kt.hex('ocm', f, [.13, .104, .062], 'y', .011, .006, 'steel');
      Kt.connector('ocm', f, [.13, .107, .062], 'y', .008, { lead: 'z' });
      /* the VORV/JOSV body along the bottom with its connector forward */
      Kt.cyl('ocm', f, [0, .04, .115], 'x', .025, .2, 'castAl'); Kt.connector('ocm', f, [.10, .04, .115], 'x', .009, { lead: 'z' });
      /* the active oil damper valve along the top, above the filter cover (p.229; A Nahas p.19): a fore-and-aft body on a bolted
         mounting block at the aft end, its connector facing aft and a union forward. Until 2026-10-14 it sat low on the inboard side */
      Kt.box('ocm', f, [-.075, .06, -.107], [.045, .04, .028], 'castAl', { round: .006 });
      for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) Kt.hex('ocm', f, [-.075 + a * .015, .06 + b * .014, -.122], '-z', .0035, .003, 'steel');
      Kt.cyl('ocm', f, [-.012, .06, -.111], 'x', .016, .08, 'steel', { edge: .003 }); Kt.hex('ocm', f, [.033, .06, -.111], 'x', .014, .01, 'steel');
      Kt.box('ocm', f, [.05, .06, -.108], [.025, .028, .026], 'castAl', { round: .004 }); Kt.hex('ocm', f, [.066, .06, -.11], 'x', .008, .008, 'steel');
      Kt.connector('ocm', f, [-.098, .06, -.108], '-x', .008, { lead: '-x' });
      /* the oil temperature probe on top at the forward end (p.129 C): a two-bolt flange and a round receptacle facing up, where the EGT
         harness from the probe junctions plugs in */
      Kt.box('ocm', f, [.10, .045, -.068], [.03, .045, .006], 'steel', { round: .003 }); for (const s of [-1, 1]) Kt.hex('ocm', f, [.10, .045 + s * .018, -.072], '-z', .0035, .003, 'steel');
      Kt.cyl('ocm', f, [.10, .045, -.08], '-z', .011, .018, 'steel'); Kt.connector('ocm', f, [.10, .045, -.09], '-z', .009, { lead: '-z' });
      /* the scavenge return to the tank (outboard) and the pressure tube to the No. 4 and No. 5/6 bearings leave the underside, aft */
      Kt.fitting('ocm', f, [-.125, .05, .095], 'z', .011); Kt.fitting('ocm', f, [-.125, .012, .095], 'z', .009); }
    acc('deoiler', 'Deoiler', 'Self-contained centrifugal deoiler in the right arm of the MGB, on its aft face, driven by a gear. It takes breather air from the gearbox, the No. 3 bearing compartment and the oil tank\'s deaerator, spins the oil out of it back into the gearbox, and vents the air overboard through the deoiler vent duct. The duct runs aft under the oil tank and along the bottom of the turbine cases to a flattened outlet at 6 o\'clock just forward of the turbine exhaust case, between the No. 5/6 bearing oil tubes, where the air leaves with the core compartment\'s exhaust flow. Its drive oil seal is line-replaceable.', 'p.66-67, p.236-237; A Nahas p.20 (overboard breather) and photo from below');
    /* p.237: a drum on the aft face of the right arm, the vent duct leaving its aft end. The A Nahas CAD (p.20, both sides) and the photo
       from below show where it goes: aft under the oil tank and along the bottom of the turbine cases to a flattened outlet pointing aft
       at 6 o'clock just forward of the TEC, between the No. 5/6 oil fittings. Until 2026-10-12 the model ran it over the top of the
       gearbox to an outlet at its left end, inside the core compartment */
    { const f = Kt.frame('deoiler', mx1, 4.2, .34), Ld = FLa(mx1, 4.2, .34);
      Kt.flange('deoiler', f, [-.008, 0, 0], '-x', .03, .06, .012, 8, 'castTan'); Kt.cyl('deoiler', f, [-.025, 0, 0], 'x', .032, .025, 'castAl');
      Kt.flange('deoiler', f, [-.039, 0, .017], '-x', .012, .022, .006, 4, 'steel');                                            // the duct's bolted flange, low on the aft end
      line('deoiler', [Ld(-.042, 0, .017), Ld(-.055, .006, .02), P(-1.74, 4.38, .356), P(-1.80, 4.46, .356), P(-1.87, 4.55, .352), P(-1.925, 4.75, .348), P(-1.945, 5.0, .345), P(-1.955, 5.25, .34),
        P(-1.965, 5.5, .342), P(-1.98, 5.72, .355), P(-2.0, 5.88, .37), P(-2.04, 5.97, .41), P(-2.09, 6.0, .458), P(-2.14, 6.0, .494), P(-2.20, 6.0, .516), P(-2.25, 6.0, .523), P(-2.32, 6.0, .523),
        P(-2.38, 6.0, .516), P(-2.415, 6.0, .50)], .015, 'tube', { clamps: 4, ends: false });
      /* the flattened outlet, 5 cm wide, its mouth facing aft */
      const g = Kt.frame('deoiler', -2.44, 6.0, .492); Kt.box('deoiler', g, [0, 0, 0], [.05, .018, .05], 'tube', { round: .006 }); Kt.box('deoiler', g, [-.0245, 0, 0], [.002, .01, .04], 'darkBox', { round: .002 }); }

    /* ============================== OIL SYSTEM ============================== */
    PW.part('oil', { label: 'Oil system', explode: [0, 0, .45], src: 'p.212-255; TTM ch. 79',
      info: 'Dry-sump system: the tank on the right of the core feeds the pressure stage of the lube and scavenge pump, the oil control module filters and monitors it, and part of the flow is cooled in the fuel/oil heat exchanger and the air/oil cooler before going to the bearings, gearboxes and the FDGS journals. Six scavenge stages return it through chip collectors and back through the oil control module to the tank.' });
    PW.part('oil-tank', { parent: 'oil', label: 'Oil tank', src: 'p.222-225, p.249; TTM 79-00 fig. 2 and 4; photos',
      info: 'Aluminium tank on the right of the core, just forward of the turbine intermediate case, curved to the core from its lid at about 2:20 o\'clock down to a cone and the outlet at 5 o\'clock. It holds 27.3 L (28.8 qt): 21.8 L (23 qt) fully serviced, 9.3 L (9.8 qt) minimum. A stainless steel heat shield held together by springs wraps the body. On the lid are the quantity sensor (to the EEC), the pressure-regulating valve (PRV), which holds about 12 psi head pressure in the tank and vents the excess to the deoiler, and the inlet to the swirl de-aerator.\n\nService it through the oil tank access door on the right IFS. Wait at least 5 minutes after shutdown before opening the cap, and read the level between 5 and 60 minutes after shutdown; outside that window the sight glass is not accurate. The sight glass reads in quarts and litres below full (FULL, 1, 2, 3, LOW), so it shows how much to add. Under the hinged cap a strainer keeps debris out and a flapper valve limits the oil lost if the cap is not closed properly (p.222); if the flapper is stuck shut, hold it open with a small screwdriver through a hole in the screen. Fill until no more oil can be added without it overflowing into the scupper, which drains to the drain mast (p.224). Then close the cap fully and lock its handle: a cap that is not properly closed and locked can let oil out of the tank in flight and cause an in-flight shutdown (p.224 caution). The drain plug is at the bottom of the cone.' });
    /* p.223, 225, 249 and TTM 79-00 fig. 2 and 4, with Brian's photo from aft on the right: a tall tank curved to the core just forward of
       the turbine intermediate case. Its flat lid, with a rim proud of the body, is at about 2:20 o'clock; the forward side starts to
       taper into the cone below 3:30 and the cone ends in the outlet boss at 5 o'clock, nearer the aft side. The fill port (upper aft) and
       the sight glass (upper forward) are on the outboard face under the access door; the quantity sensor, the pressurization valve and
       the de-aerator inlet are on the lid. The body wears the embossed stainless heat shield; the lid and the castings are bare */
    { const xa = -2.08, xf = -1.755, sec = (h, a, f, ri, ro, n) => ({ h, x: (a + f) / 2, w: f - a, ri, ro, n });
      Kt.arcLoft('oil-tank', [sec(2.345, xa, xf, .375, .527, 4), sec(3.5, xa, xf, .375, .527, 4), sec(3.75, xa, -1.765, .375, .527, 4), sec(4.0, xa, -1.80, .376, .526, 3.8),
        sec(4.3, xa, -1.86, .385, .522, 3.4), sec(4.6, -2.076, -1.93, .40, .512, 3), sec(4.85, -2.064, -1.975, .418, .498, 2.6), sec(5.0, -2.05, -1.995, .43, .487, 2.3),
        sec(5.1, -2.04, -2.004, .44, .476, 2)], 'heatShield', { seg: 48, uv: 1 / .06 });
      Kt.arcLoft('oil-tank', [sec(2.29, xa - .006, xf + .006, .37, .532, 5), sec(2.35, xa - .006, xf + .006, .37, .532, 5)], 'tankAl', { seg: 48 });   // the lid
      const lid = (x, r) => Kt.frame('oil-tank', x, 2.29, r);                                                                       // on the lid, local -z is up out of the tank
      /* quantity sensor (p.249): the probe hangs inside nearly the full height; on the lid, its five-bolt flange and the connector */
      { const f = lid(-1.86, .435); Kt.box('oil-tank', f, [0, 0, -.004], [.064, .056, .008], 'castAl', { round: .008 }); Kt.bolts('oil-tank', f, [0, 0, -.008], '-z', .025, 5, .0035);
        Kt.cyl('oil-tank', f, [0, 0, -.02], '-z', .016, .025, 'castAl'); Kt.connector('oil-tank', f, [0, 0, -.036], '-z', .009, { lead: 'x' }); }
      /* pressurization valve (p.222-223): the round valve on the lid at the aft side, under the elbow that turns its vent aft into the
         breather tube */
      { const f = lid(-2.035, .405); Kt.box('oil-tank', f, [0, 0, -.003], [.056, .03, .006], 'castAl', { round: .004 });
        for (const s of [-1, 1]) Kt.hex('oil-tank', f, [s * .021, 0, -.0065], '-z', .0035, .003, 'steel');
        Kt.cyl('oil-tank', f, [0, 0, -.012], '-z', .019, .012, 'castAl', { edge: .002 }); Kt.cyl('oil-tank', f, [-.004, 0, -.022], 'x', .013, .03, 'castAl');
        Kt.fitting('oil-tank', f, [-.022, 0, -.022], '-x', .012); }
      /* the de-aerator inlet on the lid: a block on a four-bolt cross flange, the scavenge return coming in from aft */
      { const f = lid(-1.975, .49); Kt.box('oil-tank', f, [0, 0, -.004], [.072, .02, .008], 'castAl', { round: .003 }); Kt.box('oil-tank', f, [0, 0, -.004], [.02, .058, .008], 'castAl', { round: .003 });
        for (const [a, b] of [[-.03, 0], [.03, 0], [0, -.023], [0, .023]]) Kt.hex('oil-tank', f, [a, b, -.0085], '-z', .0035, .003, 'steel');
        Kt.box('oil-tank', f, [0, 0, -.021], [.04, .032, .026], 'castAl', { round: .005 }); Kt.fitting('oil-tank', f, [-.022, 0, -.024], '-x', .014); }
      /* fill port (p.223, 225; photo): the casting sits down in a pocket cut in the heat shield, whose edge stands proud round it; the
         hinged cap marked OIL with the spring-loaded lock across it, the strainer and flapper valve under the cap, and the scupper drain
         fitting at the bottom of the pocket */
      { const f = Kt.frame('oil-tank', -1.99, 2.57, .526);
        Kt.prof('oil-tank', f, [0, -.003, 0], 'y', [[0, .051], [0, .064], [.011, .064], [.011, .051]], 'heatShield', { seg: 8 });       // the shield's raised edge
        Kt.cyl('oil-tank', f, [0, -.003, 0], 'y', .052, .003, 'darkBox');                                                           // floor of the pocket
        Kt.box('oil-tank', f, [0, -.001, -.012], [.088, .007, .044], 'accGrey', { round: .003 }); Kt.cyl('oil-tank', f, [0, -.001, .008], 'y', .041, .007, 'accGrey', { edge: .002 });   // casting
        Kt.cyl('oil-tank', f, [0, .0055, .0], 'y', .031, .006, 'castAl', { edge: .002 }); Kt.decal('oil-tank', f, [.004, .0087, .009], 'y', '-z', .026, .012, 'OIL');   // hinged cap
        Kt.cyl('oil-tank', f, [-.034, .006, 0], 'z', .004, .022, 'steel');                                                       // hinge
        Kt.box('oil-tank', f, [.004, .0105, -.006], [.052, .003, .01], 'steel', { round: .0012 }); Kt.cyl('oil-tank', f, [.004, .013, -.006], 'y', .004, .006, 'steel');   // lock bar and its T-handle
        for (const [a, b] of [[-.038, -.028], [.038, -.028], [-.026, .036], [.026, .036]]) Kt.hex('oil-tank', f, [a, .003, b], 'y', .0032, .0025, 'steel');
        Kt.fitting('oil-tank', f, [0, .004, .05], 'z', .007); }                                                                       // scupper drain
      /* sight glass (p.225; photo): QTS and LTS scales in a raised stadium boss on the forward part of the outboard face */
      { const f = Kt.frame('oil-tank', -1.842, 2.71, .526);
        Kt.box('oil-tank', f, [0, -.002, 0], [.064, .01, .09], 'castAl', { round: .004 }); for (const s of [-1, 1]) Kt.cyl('oil-tank', f, [0, -.002, s * .045], 'y', .032, .01, 'castAl');
        Kt.sight('oil-tank', f, [0, .003, 0], 'y', '-z', .034, .12, 'qtsLts'); }
      /* outlet boss at the apex: the supply leaves forward to the LSOP; the drain plug is in the bottom */
      { const f = Kt.frame('oil-tank', -2.022, 5.1, .458); Kt.cyl('oil-tank', f, [0, 0, .011], 'z', .021, .022, 'castAl', { edge: .003 });
        Kt.plug('oil-tank', f, [-.004, 0, .023], 'z', .009); Kt.fitting('oil-tank', f, [.019, 0, .011], 'x', .016); }
      /* two brackets from the aft face to the turbine intermediate case flange, between the breather and the scavenge return */
      for (const h of [2.85, 3.85]) { const f = Kt.frame('oil-tank', -2.105, h, .44); Kt.box('oil-tank', f, [0, 0, 0], [.052, .022, .03], 'steel', { round: .003 });
        Kt.cyl('oil-tank', f, [-.02, 0, 0], 'z', .005, .04, 'steel'); }
      /* p.223: the breather leaves the valve's elbow aft over the lid, runs down the aft face and forward under the tank, over the TIC
         cooling tube where it lies lowest, into the aft end of the deoiler, clear of igniter A */
      line('oil-tank', [P(-2.0744, 2.186, .405), P(-2.094, 2.19, .405), P(-2.106, 2.29, .405), P(-2.106, 2.8, .405), P(-2.106, 3.4, .40), P(-2.10, 3.62, .385), P(-2.07, 3.72, .36),
        P(-2.0, 3.78, .35), P(-1.90, 3.8, .35), P(-1.81, 3.82, .352), P(-1.74, 3.95, .35), P(-1.71, 4.06, .345), P(-1.695, 4.11, .341), P(mx1 - .033, 4.12, .338)], .012, 'tube', { clamps: 3 });
      /* p.214-215 and TTM 79-00 fig. 3: the scavenge oil goes from the pump back through the oil control module (past its temperature
         probe) to the tank, so the return leaves the OCM's underside, runs aft down the tank's forward side, in under the tip of the cone,
         up the aft face and in over the lid to the de-aerator (p.223). Until 2026-10-08 it was drawn from the pump */
      const Lo = FLa(-1.575, 3.5, .40);                                                                                       // the OCM's frame
      line('oil-tank', [Lo(-.125, .05, .11095), Lo(-.125, .05, .13), P(-1.715, 4.14, .465), P(-1.745, 4.3, .458), P(-1.775, 4.47, .447), P(-1.80, 4.62, .44), P(-1.84, 4.8, .437),
        P(-1.88, 4.95, .43), P(-1.94, 4.99, .408), P(-1.99, 4.99, .40), P(-2.05, 4.99, .398), P(-2.095, 4.86, .41),
        P(-2.104, 4.6, .45), P(-2.104, 4.3, .48), P(-2.104, 4.0, .49), P(-2.104, 3.2, .49),
        P(-2.104, 2.5, .49), P(-2.104, 2.32, .49), P(-2.09, 2.2, .49), P(-2.05, 2.196, .49), P(-2.0173, 2.1965, .49)], .014, 'tube', { clamps: 3 });
      /* p.223: the supply leaves the outlet boss forward, up the cone's forward side, over igniter A's lead and on to the pump inlet */
      line('oil-tank', [P(-1.98, 5.146, .458), P(-1.96, 5.13, .468), P(-1.93, 5.0, .50), P(-1.90, 4.76, .522), P(-1.87, 4.56, .527), P(-1.80, 4.45, .525), P(-1.75, 4.42, .52),
        P(-1.60, 4.44, .512), P(-1.50, 4.55, .505), P(-1.455, 4.68, .49), P(-1.43, 4.75, .44)], .016, 'tube', { clamps: 3 }); }
    /* p.214-215: the OCM sends pressure oil to the No. 4 and No. 5/6 bearing compartments in one tube that tees for the two, each branch
       entering through a last-chance strainer; each compartment's scavenge comes back in its own tube to its stage of the LSOP (chip
       collectors BC4 and BC5, p.230). The manual gives the circuit, not the routes. Here the scavenge tubes run aft under the gearbox at
       5:20 and 5:30 and pass between the ignition cables where those turn up to the igniters (under A, over B). No. 4 is served through
       two pads on the forward face of the TIC, as the TIC cooling air tubes are; No. 5/6 through two flanged fittings on the TEC's
       barrel either side of 6 o'clock (below), its tubes running along the bottom of the LPT case through the gap left between the
       ends of the clearance control spray rings */
    PW.part('oil-rear', { parent: 'oil', label: 'No. 4 and No. 5/6 bearing oil tubes', src: 'p.212-215, p.230; TTM 79-00 fig. 3',
      info: 'Pressure oil for the turbine bearings leaves the underside of the oil control module in one tube, which runs down behind the gearbox\'s right arm and tees aft of it. One branch feeds the No. 4 bearing compartment through a pad on the forward face of the turbine intermediate case; the other runs aft along the bottom of the LPT case to the No. 5 and 6 bearing compartment in the turbine exhaust case. Each branch enters through a last-chance strainer, which stops any particle that got past the main oil filter from blocking the bearing oil jets.\n\nEach compartment\'s scavenge oil comes back forward in its own tube, under the gearbox, to its own stage of the lube and scavenge pump, where the BC4 or BC5 chip collector catches bearing debris: a chip found there points to that compartment.\n\nThe manual gives this circuit but not the tube routes; the routes here are drawn through the space the other units leave.' });
    { /* world point of a local point in a frame at (x0, clock h0, r0) turned by rz, as Kt.frame builds it */
      const FL = (x0, h0, r0, rz) => { const c = Math.cos(rz || 0), s = Math.sin(rz || 0), a = G.clock(h0);
        return (lx, ly, lz) => { const X = lx * c - ly * s, Y = r0 + lx * s + ly * c; return V(x0 + X, Y * Math.cos(a) - lz * Math.sin(a), Y * Math.sin(a) + lz * Math.cos(a)); }; };
      /* a bolted pad on a forward-facing case face, turned by rz to sit on it, carrying a last-chance strainer housing with the tube's
         fitting on its end, or the fitting alone; returns the tube's last two points, along the fitting's axis */
      const pad = (x, h, r, rz, screen) => { const g = Kt.frame('oil-rear', x, h, r, { rz }), L = FL(x, h, r, rz); let e;
        Kt.box('oil-rear', g, [0, .004, 0], [.03, .008, .03], 'nickel', { round: .004 }); Kt.bolts('oil-rear', g, [0, .0095, 0], 'y', .0135, 4, .0028, { phase: Math.PI / 4 });
        if (screen) { Kt.cyl('oil-rear', g, [0, .016, 0], 'y', .0115, .016, 'steel', { edge: .002 }); Kt.hex('oil-rear', g, [0, .029, 0], 'y', .013, .01, 'steel');
          Kt.fitting('oil-rear', g, [0, .034, 0], 'y', .008); e = .034 + .008 * 1.45; }
        else { Kt.fitting('oil-rear', g, [0, .008, 0], 'y', .009); e = .008 + .009 * 1.45; }
        return [L(0, e + .022, 0), L(0, e, 0)]; };
      const n4p = pad(-2.13, 5.15, .385, -1.4, true), n4s = pad(-2.13, 5.45, .385, -1.4, false);          // No. 4: pressure through its strainer, scavenge
      /* No. 5/6 (Brian's photo from below and A Nahas p.18, scaled on the TEC's flanges): each tube's two-bolt flange sits on a boss
         halfway along the barrel, about 16 deg either side of 6 o'clock, and its fitting body lies along the case, angled forward and in
         toward the bottom, where the tubes run on forward either side of the deoiler vent's outlet. Supply on the left, through its
         last-chance strainer; scavenge on the right. s is +1 left of 6 o'clock, -1 right. Until 2026-10-14 the pads stood on the old
         cone at 6:09 and 5:51 */
      const tecPad = (h, s, screen) => { const x = -2.57, rT = PW.tecR(x), sl = Math.atan((PW.tecR(x + .025) - PW.tecR(x - .025)) / .05);
        const b = Kt.frame('oil-rear', x, h, rT, { rz: sl });                                                // boss and flange, square to the barrel
        Kt.box('oil-rear', b, [0, .003, 0], [.05, .009, .026], 'nickel', { round: .004 });
        Kt.box('oil-rear', b, [0, .0095, 0], [.058, .004, .02], 'steel', { round: .007 });
        for (const dx of [-.021, .021]) Kt.hex('oil-rear', b, [dx, .0132, 0], 'y', .0036, .0035, 'steel');
        const f = Kt.frame('oil-rear', x, h, rT, { ry: s * .68, rz: sl * Math.cos(.68) }), xf = screen ? .08 : .07;   // the body, along the case
        Kt.box('oil-rear', f, [.004, .0165, 0], [.026, .013, .02], 'steel', { round: .004 });                  // elbow off the flange
        Kt.cyl('oil-rear', f, [.041, .017, 0], 'x', screen ? .0105 : .0085, .05, 'steel', { edge: .002 });
        if (screen) Kt.hex('oil-rear', f, [.071, .017, 0], 'x', .0115, .01, 'steel');                           // the strainer's cap
        Kt.fitting('oil-rear', f, [xf, .017, 0], 'x', .008);
        f.updateMatrixWorld(true); const L = a => f.localToWorld(V(a, .017, 0)), e = xf + .008 * 1.45;
        return [L(e + .022), L(e)]; };
      const n5p = tecPad(6.55, 1, true), n5s = tecPad(5.47, -1, false);
      const Ls = FL(mx0, 4.85, .40), Lo = FLa(-1.575, 3.5, .40);                                            // the LSOP's and OCM's frames
      /* the tee aft of the gearbox: a forged body on the pressure tube, its branch toward 6 o'clock. The tube comes from the OCM's
         underside down behind the gearbox's right arm, aft of the deoiler and forward of igniter A */
      const T = FL(-1.875, 5.2, .368), tg = Kt.frame('oil-rear', -1.875, 5.2, .368);
      Kt.cyl('oil-rear', tg, [0, 0, 0], 'x', .0085, .036, 'steel', { edge: .002 }); Kt.cyl('oil-rear', tg, [0, 0, .011], 'z', .0075, .022, 'steel', { edge: .002 });
      line('oil-rear', [Lo(-.125, .012, .10805), Lo(-.125, .012, .125), P(-1.715, 4.2, .42), P(-1.74, 4.4, .405), P(-1.765, 4.62, .39), P(-1.79, 4.9, .372), P(-1.81, 5.125, .3635),
        P(-1.835, 5.18, .366), T(.015, 0, 0)], .005, 'tube', { clamps: 1 });
      line('oil-rear', [T(-.015, 0, 0), P(-1.93, 5.19, .372), P(-1.99, 5.165, .385), P(-2.03, 5.15, .395)].concat(n4p), .005, 'tube', { clamps: 1 });   // to No. 4, under the tank's outlet
      line('oil-rear', [T(0, 0, .019), P(-1.878, 5.36, .369), P(-1.90, 5.42, .37), P(-1.95, 5.51, .374), P(-2.0, 5.6, .38), P(-2.05, 5.7, .39), P(-2.09, 5.78, .41), P(-2.12, 5.9, .44),
        P(-2.15, 6.02, .463), P(-2.18, 6.1, .485), P(-2.21, 6.14, .5), P(-2.25, 6.15, .515), P(-2.32, 6.15, .512), P(-2.39, 6.15, .504), P(-2.45, 6.16, .487)].concat(n5p), .005, 'tube', { clamps: 4 });   // to No. 5/6, crossing under the scavenge tube and the vent duct
      /* scavenge: No. 4 from the pump's outer fitting, No. 5/6 from its inner one, out round the hydraulic pump's flange, aft under the
         gearbox and the oil control module's harness, between the ignition cables, then down under the oil tank */
      line('oil-rear', [Ls(.04, .02, .0845), Ls(.04, .021, .108), P(-1.452, 5.35, .465), P(-1.462, 5.355, .498), P(-1.50, 5.355, .51), P(-1.60, 5.355, .512), P(-1.70, 5.355, .512),
        P(-1.77, 5.355, .507), P(-1.817, 5.36, .50), P(-1.86, 5.37, .493), P(-1.92, 5.385, .478), P(-1.98, 5.405, .455), P(-2.03, 5.425, .428)].concat(n4s), .007, 'tube', { clamps: 3 });
      line('oil-rear', [Ls(.04, -.02, .0845), Ls(.04, -.019, .118), P(-1.45, 5.47, .435), P(-1.462, 5.475, .49), P(-1.50, 5.475, .513), P(-1.60, 5.475, .516), P(-1.70, 5.475, .516),
        P(-1.77, 5.478, .51), P(-1.808, 5.49, .505), P(-1.835, 5.5, .503), P(-1.88, 5.52, .498), P(-1.94, 5.55, .495), P(-2.0, 5.64, .492), P(-2.06, 5.76, .488), P(-2.11, 5.81, .492),
        P(-2.16, 5.84, .499), P(-2.20, 5.85, .507), P(-2.25, 5.85, .515), P(-2.32, 5.85, .512), P(-2.39, 5.85, .504), P(-2.45, 5.84, .488)].concat(n5s), .007, 'tube', { clamps: 5 }); }
    /* p.214-219: the front bearing compartment (FDGS, No. 1, 1.5 and 2) and No. 3 are served by tubes running forward under the HPC
       from the gearbox's front face to bosses on the CIC cone; passages through the case and its struts carry the oil on in. The
       manual gives the circuit, not the routes: here nine tubes side by side at r 0.318, 5:55 to 6:49, under the core harnesses and over
       the HPC vane levers. The auxiliary oil pressure sensor is up on the fire seal cone at 5 o'clock (p.248) */
    PW.part('oil-front', { parent: 'oil', label: 'Front compartment and No. 3 oil and breather tubes, aux oil pressure sensor', src: 'p.212-221, p.230, p.240',
      info: 'Nine tubes run forward under the HPC from the gearbox\'s front face to the compressor intermediate case, where passages through its struts carry the oil to the front bearing compartment (the fan drive gear system and the No. 1, 1.5 and 2 bearings) and the No. 3 bearing (p.215). From the 6 o\'clock side: the No. 3 bearing compartment\'s breather, the largest, taking its air back to the deoiler in the gearbox (p.212); the front compartment\'s scavenge to its pump stage (chip collector FBC); the main oil to the No. 1, 1.5 and 2 bearings; the gear teeth supply, metered by the VORV; the journal bearing supply from the JOSV; the fan oil pump\'s output to the JOSV; the No. 3 supply, a branch of the main oil; the active oil damper valve\'s feed to the No. 3 bearing damper; and the No. 3 scavenge (chip collector BC3). Last-chance strainers in the supply lines guard the oil jets.\n\nThe fan drive gear system has its own fan-driven oil pump: if main oil pressure falls (windmilling, negative g), the journal oil shuttle valve switches the journal bearings to it. The auxiliary oil pressure sensor, at 5 o\'clock on the fan intermediate case by the pump\'s outlet (p.248), proves the pump and the shuttle valve work on every flight; a pump or JOSV failure shows at the next engine start, and a failed sensor gives the AUX OIL PRESS MON INOP info message (p.218, 240). The PHMU monitors it.\n\nThe manual gives the circuit; the tube routes here are inferred.' });
    { const rb = .318, xb = -.95 - (.515 - rb) * .83, m0 = GB.mainGearboxBody.x_from;
      /* [clock, tube radius], as listed in the info. p.215 draws eight lines; until 2026-10-14 there were six, with the VORV's gear teeth
         supply and the active oil damper valve's feed left out. The first is the No. 3 bearing breather: p.212, "An external tube sends
         no. 3 bearing breather air" to the deoiler in the gearbox; p.213 and p.215 draw it. Its route is not shown: it is assumed to run
         with the No. 3 oil tubes, larger in bore, into the gearbox's front face (the deoiler is inside the gearbox) */
      const tubes = [[5.91, .0085], [6.04, .007], [6.15, .006], [6.26, .006], [6.37, .006], [6.48, .006], [6.59, .005], [6.70, .005], [6.81, .006]];
      tubes.forEach(([h, tr]) => { const s = tr + .001;
        const fc = Kt.frame('oil-front', xb, h, rb); Kt.cyl('oil-front', fc, [.007, 0, 0], 'x', s * 1.6, .046, 'nickel', { edge: .003 }); Kt.fitting('oil-front', fc, [-.016, 0, 0], '-x', s);
        const fm = Kt.frame('oil-front', m0 + .005, h, rb); Kt.cyl('oil-front', fm, [.002, 0, 0], 'x', s * 1.6, .014, 'castTan', { edge: .002 }); Kt.fitting('oil-front', fm, [.008, 0, 0], 'x', s);
        line('oil-front', [P(m0 + .013 + s * 1.45, h, rb), P(-1.42, h, rb), P(-1.30, h, rb), P(-1.20, h, rb), P(xb - .016 - s * 1.45, h, rb)], tr, 'tube', { clamps: 0 }); });
      /* multi-tube clamp blocks holding the nine together */
      for (const xx of [-1.21, -1.36]) { const f = Kt.frame('oil-front', xx, 6.36, rb); Kt.box('oil-front', f, [0, 0, 0], [.018, .026, .172], 'clampOrange', { round: .006 }); }
      /* the auxiliary oil pressure sensor "at the 5 o'clock position on the fan intermediate case" (p.248): on the fire seal cone near its
         rim, by the fan oil pump's outlet (its drive gear is at 5:20, p.239); a body on a two-ear flange (p.249 D). Its lead runs down
         the cone into WC08. Until 2026-10-12 it sat on a tee in the pump's return tube under the HPC */
      const fa = Kt.frame('oil-front', -1.01, 5.33, .443, { rz: .88 }), La = FLa(-1.01, 5.33, .443, .88);                   // as near the rim as the IFS, 3 cm off the cone here, allows
      Kt.box('oil-front', fa, [0, .003, 0], [.022, .006, .05], 'steel', { round: .004 }); for (const s of [-1, 1]) Kt.hex('oil-front', fa, [0, .0075, s * .019], 'y', .0035, .003, 'steel');
      Kt.cyl('oil-front', fa, [0, .022, 0], 'y', .012, .032, 'steel', { edge: .002 }); Kt.cyl('oil-front', fa, [0, .04, 0], 'y', .009, .006, 'steel');
      Kt.connector('oil-front', fa, [0, .044, 0], 'y', .007, { lead: '-x' });
      line('oil-front', [La(-.0126, .0573, 0), La(-.03, .052, 0), P(-1.08, 5.31, .42), P(-1.095, 5.3, .38), P(-1.108, 5.3, .352), P(-1.115, 5.31, .34)], .004, 'harness', { clamps: 0, ends: false }); }
    /* thermal management (p.212-217, 232-233): three heat exchangers on the upper left of the core. The EEC's bypass valve splits the
       cooled oil between the fuel/oil and air/oil coolers on fuel temperature, normally about 75 / 25 */
    /* p.233, measured against the HPC vane lever rows: FOHX x -1.05 to -1.41 with its bypass valve at the forward end, VFGOOHX -1.43 to
       -1.51, AOHX -1.53 to -1.96 standing about 0.35 m tall on the left. The AOHX is built in its own flat frame on the case */
    PW.part('aoc', { parent: 'oil', label: 'Air/oil heat exchanger (AOHX)', src: 'p.212-217, p.232-233; p.20-23',
      info: 'Plate-fin cooler standing on the left of the core at about 10 o\'clock, over the rear HPC and diffuser, with the starter below it. Fan air comes in through the forward half of the window in the left IFS, turns aft through the finned matrix between the two plenums and leaves through the aft half. It takes part of the cooled-path oil, at least about 25 percent and up to nearly all of it when the fuel cannot take more heat. The oil is the FOHX bypass valve\'s share, passed on by the fuel/oil manifold through the short tube low on the front of the inlet plenum. It leaves from the top of the plenum for the VFG oil/oil heat exchanger (p.215). If the cooler clogs, a relief valve sends the oil straight to the VFG oil/oil heat exchanger.' });
    { const ax = -1.745, ah = 9.9, f = frame('aoc', ax, ah, .44);
      fbox('aoc', f, 0, -.002, 0, .17, .08, .32, 'darkBox', .004);                                                                          // finned matrix
      for (let i = 0; i < 22; i++) fbox('aoc', f, 0, 0, -.152 + i * .304 / 21, .17, .086, .003, 'nickel', .0005);
      const fins = [];
      for (const s of [1, -1]) { fbox('aoc', f, s * .15, 0, 0, .13, .12, .34, 'steel', .025); fbox('aoc', f, s * .15, .057, 0, .09, .012, .27, 'darkBox', .01);   // inlet and exhaust plenums with their openings
        for (let i = 0; i < 13; i++) fins.push(G.roundedBox(.0012, .012, .25, .0003).translate(s * .15 - .039 + i * .0065, .0578, 0)); }
      PW.add('aoc', G.merge(fins), 'chromate', { solid: true, into: f });                                                  // the matrix's olive-gold fins seen through each opening (photo)
      /* the photos: a thick orange silicone gasket round the exhaust plenum's opening seals it against the IFS window's plain aft frame
         when the door is closed; the inlet joint's gasket is on the door */
      for (const [dx, dz, w, d] of [[0, .145, .11, .02], [0, -.145, .11, .02], [.055, 0, .02, .29], [-.055, 0, .02, .29]])
        fbox('aoc', f, -.15 + dx, .066, dz, w, .01, d, 'gasketOrange', .004);
      for (const dx of [.12, -.12]) PW.add('aoc', G.rod(P(ax + dx, 10.6, .46), P(ax + dx, 11.0, .30), .006), 'steel');                        // support rods to the case
      line('aoc', [P(-1.60, 10.35, .44), P(-1.55, 10.3, .43), P(-1.515, 10.15, .41)], .016, 'tube', { clamps: 0 });                          // oil on to the VFG oil/oil cooler
      /* oil in (p.215): the bypass valve's share, from the tower on the fuel/oil manifold just forward of the inlet plenum, through a short
         transfer tube above the MGB's left arm */
      Kt.fitting('aoc', Kt.frame('aoc', -1.53, 9.63, .41), [0, 0, 0], 'x', .01);
      line('aoc', [P(-1.479 - .0145, 9.63, .394), P(-1.50, 9.63, .397), P(-1.508, 9.63, .405), P(-1.53 + .0145, 9.63, .41)], .011, 'tube', { clamps: 0 }); }
    PW.part('vfgoohx', { parent: 'oil', label: 'VFG oil/oil heat exchanger (VFGOOHX)', src: 'p.212-217, p.232-233',
      info: 'Small plate-fin cooler on the left of the core at about 10 o\'clock. It is bolted to a tower on top of the fuel/oil manifold, under the aft end of the fuel/oil cooler and just forward of the air/oil cooler (p.171, p.232-233; A Nahas photo). Engine oil from the air/oil cooler takes heat from the generator\'s own oil. It then goes down through the tower into the fuel/oil manifold and joins the FOHX return on its way to the oil control module (p.215). The VFG oil then passes a separate VFG air/oil cooler before returning to the generator.' });
    { const vx = -1.46, vh = 10.0; box('vfgoohx', vx, vh, .40, .085, .07, .11, 'steel'); for (const dx of [.05, -.05]) box('vfgoohx', vx + dx, vh, .405, .025, .09, .12, 'castAl', { round: .008 });
      /* its mounting plate, bolted to the oil tower on top of the fuel/oil manifold: the engine oil comes in and out through it (p.215) */
      { const f = frame('vfgoohx', vx, vh, .40); fbox('vfgoohx', f, -.005, -.0125, -.058, .05, .045, .006, 'castAl', .002);
        for (const [x, y] of [[-.025, -.03], [.015, -.03], [-.025, .005], [.015, .005]]) Kt.hex('vfgoohx', f, [x, y, -.063], '-z', .0042, .004, 'steel'); }
      /* VFG oil on from here forward along the left of the core, under the fuel supply hose and through the compressor intermediate
         case's outer cone (a bulkhead nut where it passes), to the VFG air/oil cooler under the fan exit liner */
      { const c = line('vfgoohx', [P(vx, 9.72, .43), P(-1.40, 9.72, .44), P(-1.30, 9.55, .43), P(-1.20, 9.38, .424), P(-1.10, 9.28, .444), P(-1.03, 9.28, .468), P(-.995, 9.22, .462), P(-.975, 9.12, .444), P(-.965, 8.85, .446), P(-.958, 8.55, .452), FLa(-.936, 8.4, .462)(-.01595, 0, 0)], .011, 'hose', { clamps: 3, labels: [[.3, 'labelWhite']] });   // above the forward vibration sensor
        PW.add('vfgoohx', G.alongCurve(c, [tAt(c, -.99)], () => new THREE.CylinderGeometry(.018, .018, .016, 6)), 'steel').userData.isLine = true; }
      /* and back (p.213 draws the VFG oil circuit as a pair, to and from the VFG): beside the first, aft of and outboard of it, between the fuel/oil manifold and the air/oil cooler's plenum */
      line('vfgoohx', [P(vx - .045, 9.74, .44), P(-1.512, 9.62, .485), P(-1.515, 9.5, .525), P(-1.515, 9.3, .53), P(-1.51, 9.1, .53), P(-1.545, 8.55, .512), P(-1.585, 8.05, .512), P(-1.597, 7.75, .518), P(-1.615, 7.52, .522), P(-1.665, 7.40, .522), P(-1.69, 7.25, .519), P(-1.712, 7.0, .518), P(-1.745, 6.78, .532), FLa(mx1, 6.15, VFG_R)(-.11, .0825, .1181), FLa(mx1, 6.15, VFG_R)(-.11, .07192, .10109)], .014, 'tube', { clamps: 3 }); }
    /* the VFG air/oil cooler. p.215 and p.217 put it in the VFG oil loop but the manual never shows where it is; the A Nahas location
       photos (p.18) and Brian's photo from the opened left reverser show it: under a fairing on the fan exit liner, low on the left, its
       matrix (yellow slats) open to the fan stream behind a raised hood. Its return line runs aft through the compressor intermediate
       case's outer cone, under the fuel supply hose, round the outside of the fuel/oil manifold and down the left of the gearbox,
       between the PMAG and the generator, to the fitting on the VFG's 7 o'clock side */
    PW.part('vfg-aohx', { parent: 'oil', label: 'VFG air/oil cooler', src: 'p.215, p.217; A Nahas location photos p.18; photos',
      info: 'The last cooler in the generator\'s own oil loop: VFG, VFG oil/oil heat exchanger, this air/oil cooler, and back to the VFG (p.215, p.217). It sits under a fairing on the fan exit liner, low on the left side, its matrix open to the fan stream through the grille behind the fairing\'s hood. To reach it, remove the fan exit case fairing and then the cooler\'s own fairing.\n\nThe manual shows it only in the oil schematics; its place comes from the location photos.' });
    { /* As Brian's Core_LH photo and the A Nahas photo (p.18, "A/O HX FAIRING") show it: a bare metal hood rises out of the liner
         just aft of the FEGVs and wraps the forward edge and both ends of a band running round the case, from about 7:25 to 8:40 below
         the 9 o'clock liner joint, back to the liner's aft edge. In the band the cooler's matrix shows as long olive-gold slats running
         round the case, eight across, in four groups between gold cross-members, each with a pale clip at the hood's lip. The fan exit
         case fairing round it, which comes off first, is outlined by its fasteners. Until 2026-10-14 this was a raised mint block with
         a thin hood strip and a grid of short slats (Brian: "very inaccurate") */
      const rLin = x => G.interp(D.GEN.lines.bypassInner, x), deg = Math.PI / 180;
      const AO = PW.AOHX_OPENING, a0 = G.clock(AO.h0), a1 = G.clock(AO.h1), e = G.clock(.08), xF = -.628, xL = AO.xL, xB = AO.xB;   // the liner opening (build-core.js); hood overlap and front
      const hgt = a => { const t = (a - (a0 - e)) / (a1 - a0 + 2 * e), u = Math.min(1, Math.min(t, 1 - t) / .1); return .1 + .9 * u * u * (3 - 2 * u); };
      PW.add('vfg-aohx', sweepSections(a => { const h = hgt(a), xf = xF - .045 * (1 - h), inBand = a >= a0 && a <= a1, xl = inBand ? xL : xB + .002;
        return [[xf, rLin(xf) - .003], [xf - .022, rLin(xf - .022) + .006 * h], [xf - .06, rLin(xf - .06) + .015 * h], [xl + .03, rLin(xl + .03) + .022 * h],
          [xl + .007, rLin(xl + .007) + .024 * h], [xl, rLin(xl) + .019 * h], [xl + .004, rLin(xl) - .003]]; }, a0 - e, a1 + e, 110), 'bareSheet');   // the hood
      /* the matrix in the liner's opening: a dark tub under it, the slats standing in it with their tops just below the liner surface,
         the cross-members and their clips */
      const band = (xa, xb, lo, hi, ta, tb, mat) => { const pts = []; for (let i = 0; i <= 8; i++) pts.push(xa + (xb - xa) * i / 8);
        PW.add('vfg-aohx', G.revolve(pts.map(x => [x, rLin(x) + lo]).concat(pts.map(x => [x, rLin(x) + hi]).reverse()), { seg: Math.max(2, Math.round((tb - ta) / (1.5 * deg))), thetaStart: ta, thetaLength: tb - ta }), mat); };
      band(xL, xB, -.026, -.024, a0, a1, 'darkBox'); band(xL + .001, xL - .001, -.026, -.006, a0, a1, 'darkBox'); band(xB + .001, xB - .001, -.026, -.006, a0, a1, 'darkBox');
      band(xL, xB, -.026, -.006, a0 - .002, a0, 'darkBox'); band(xL, xB, -.026, -.006, a1, a1 + .002, 'darkBox');
      const cut = [0, 1, 2, 3, 4].map(j => a0 + (a1 - a0) * j / 4), cw = .006 / .505;                            // group edges; half a cross-member's width
      for (let j = 0; j < 4; j++) for (let i = 0; i < 8; i++) { const xc = xL - .014 - i * (xL - .014 - xB - .008) / 7, rc = rLin(xc);
        band(xc + .003, xc - .003, -.024, -.003, cut[j] + (j ? cw : .002), cut[j + 1] - (j < 3 ? cw : .002), 'chromate'); }   // eight slats across each group
      for (let j = 1; j < 4; j++) { const a = cut[j];
        band(xL, xB, -.024, .001, a - cw, a + cw, 'chromate');                                                           // cross-member
        const f = Kt.frame('vfg-aohx', xL - .016, a / (Math.PI / 6), rLin(xL - .016) + .001); Kt.box('vfg-aohx', f, [0, .002, 0], [.026, .004, .02], 'plateAl', { round: .0015 }); }   // its clip
      /* the fan exit case fairing's fasteners, round its forward edge and along its top and bottom */
      { const fx = [], put = (x, a) => fx.push(new THREE.CylinderGeometry(.0028, .0028, .0012, 8).rotateX(a).translate(...G.onRing(x, rLin(x) + .0003, a).toArray()));
        const p0 = a0 - e - G.clock(.12), p1 = a1 + e + G.clock(.12), xs = xF + .022;
        for (let a = p0; a <= p1 + 1e-6; a += .036 / .495) put(xs, a);
        for (let x = xs - .036; x > xB - .004; x -= .036) { put(x, p0); put(x, p1); }
        PW.add('vfg-aohx', G.merge(fx), 'steel'); }
      Kt.arcLoft('vfg-aohx', [{ h: AO.h0 + .03, x: (xL + xB) / 2, w: xL - xB - .004, ri: .45, ro: .474, n: 6 }, { h: AO.h1 - .03, x: (xL + xB) / 2, w: xL - xB - .004, ri: .45, ro: .474, n: 6 }], 'castAl');   // its body, under the opening
      for (const h of [8.0, 8.4]) Kt.fitting('vfg-aohx', Kt.frame('vfg-aohx', xB + .002, h, .462), [0, 0, 0], '-x', .011);     // oil out (8:00) and in (8:24), on its aft face
      const c = line('vfg-aohx', [FLa(xB + .002, 8.0, .462)(-.01595, 0, 0), P(-.962, 8.07, .463), P(-.98, 8.2, .468), P(-1.03, 8.33, .462), P(-1.10, 8.42, .48), P(-1.15, 8.45, .492), P(-1.20, 8.48, .502), P(-1.25, 8.51, .508),
        P(-1.30, 8.53, .512), P(-1.35, 8.55, .513), P(-1.40, 8.57, .513), P(-1.46, 8.57, .51), P(-1.51, 8.5, .512), P(-1.555, 8.05, .505), P(-1.568, 7.75, .508), P(-1.59, 7.45, .512), P(-1.64, 7.25, .514), P(-1.675, 7.0, .515), P(-1.69, 6.78, .528), FLa(mx1, 6.15, VFG_R)(-.04, .0775, .1231), FLa(mx1, 6.15, VFG_R)(-.04, .06692, .10609)], .011, 'hose', { clamps: 4 });
      PW.add('vfg-aohx', G.alongCurve(c, [tAt(c, -.976)], () => new THREE.CylinderGeometry(.018, .018, .016, 6)), 'steel').userData.isLine = true; }
    PW.part('fohe', { parent: 'oil', label: 'Fuel/oil heat exchanger (FOHX) and bypass valve', src: 'p.162-170, p.212-217, p.232-233',
      info: 'Fuel-cooled oil cooler on the upper left of the core at 11 o\'clock, over the front HPC. Its bypass valve (FOHXBV) sits at its forward end on the compressor intermediate case near 12 o\'clock, on the dark FOC manifold block. Boost-pump fuel from the fuel/oil manifold takes heat from the oil and goes back to the manifold, keeping the fuel above 0 deg C at the fuel filter inlet.\n\nOil from the fuel/oil manifold comes up behind the cooler and over its top to the bypass valve (p.215, p.217). The valve splits it. The FOHX share runs through the cooler and out of its aft end, back down to the manifold. The air/oil cooler share leaves the block and runs back down beside the supply to the manifold, which passes it on to the air/oil cooler.\n\nThe EEC modulates the bypass valve on the fuel temperature sensor, opening it as the fuel gets colder to send more hot oil through. Normally about 75 percent of the cooled-path oil comes here and 25 percent goes to the air/oil cooler, which always gets at least 25 percent. If the fuel side blocks, a bypass valve sends the fuel round it (p.166); the FOHX also has integral pressure-relief valves on its fuel and oil sides (p.212).' });
    { const fx = -1.26, f = frame('fohe', fx, 11.0, .39);
      for (const z of [-.055, .055]) PW.add('fohe', G.can(.05, .30), 'steel', { into: f, pos: [0, 0, z] });                                   // the two long headers
      fbox('fohe', f, 0, -.01, 0, .26, .07, .06, 'steel'); fbox('fohe', f, -.165, 0, 0, .035, .12, .2, 'castAl', .01);                          // core and aft end plate
      box('fohe', -1.12, 11.7, .435, .07, .09, .12, 'darkBox');                                                                             // FOC manifold
      can('fohe', -1.115, 11.95, .44, .03, .06, 'accGrey'); box('fohe', -1.11, 12.0, .475, .04, .03, .05, 'darkBox');                           // bypass valve and its torque motor
      line('fohe', [P(-1.135, 11.45, .42), P(-1.15, 11.36, .415), P(-1.16, 11.27, .41)], .014, 'tube', { clamps: 0 });                        // oil from the valve into the cooler
      /* p.215: the oil comes from the fuel/oil manifold into the FOC manifold block to the bypass valve. The valve's FOHX share goes
         through the cooler and out of its far (aft) end, back to the fuel/oil manifold; its air/oil cooler share leaves the block and goes
         back to the fuel/oil manifold too, which sends it on to the air/oil cooler. The renders on p.163 and p.233 show large tubes arching
         over the top of the FOHX from its forward block to its aft end. Here the supply and the air/oil cooler share run over the top, cross
         outboard of the left thrust link behind the FOHX, and come down outboard of the VFG oil/oil cooler to the manifold's outer face.
         The return leaves the aft end plate's lower edge and comes down forward of the VFG oil/oil cooler to the manifold's forward face.
         Until 2026-10-14 the return ran into the VFG oil/oil cooler, and the supply and the bypass oil were not drawn */
      Kt.fitting('fohe', Kt.frame('fohe', -1.155, 11.78, .455), [0, 0, 0], '-x', .012);                                              // oil in
      Kt.fitting('fohe', Kt.frame('fohe', -1.155, 11.90, .42), [0, 0, 0], '-x', .011);                                               // the air/oil cooler share out
      Kt.fitting('fohe', f, [-.165, .01, -.1], '-z', .012);                                                                            // cooled oil out
      line('fohe', [P(-1.446, 9.28, .465 + .0145), P(-1.446, 9.28, .492), P(-1.446, 9.38, .505), P(-1.446, 9.55, .512), P(-1.446, 9.8, .50), P(-1.446, 10.1, .49), P(-1.446, 10.45, .505), P(-1.446, 10.8, .524),
        P(-1.446, 11.1, .505), P(-1.44, 11.35, .484), P(-1.42, 11.52, .48), P(-1.37, 11.66, .467), P(-1.30, 11.72, .459), P(-1.23, 11.77, .456), P(-1.19, 11.78, .455), P(-1.155 - .0174, 11.78, .455)], .012, 'tube', { clamps: 3 });   // oil in, from the fuel/oil manifold
      line('fohe', [P(-1.155 - .01595, 11.90, .42), P(-1.19, 11.90, .425), P(-1.25, 11.88, .435), P(-1.34, 11.84, .445), P(-1.43, 11.76, .46), P(-1.468, 11.55, .475), P(-1.47, 11.25, .495),
        P(-1.47, 10.9, .524), P(-1.47, 10.6, .515), P(-1.47, 10.3, .497), P(-1.47, 10.0, .495), P(-1.47, 9.7, .505), P(-1.47, 9.45, .512), P(-1.47, 9.26, .505), P(-1.47, 9.16, .492), P(-1.47, 9.16, .465 + .0145)], .011, 'tube', { clamps: 3 });   // the air/oil cooler share
      { const o = new THREE.Vector3(-.165, .01, -.1 - .012 * 1.45); f.updateMatrixWorld(true); f.localToWorld(o);
        line('fohe', [o, P(-1.41, 10.40, .415), P(-1.385, 10.33, .412), P(-1.373, 10.15, .405), P(-1.37, 9.85, .40), P(-1.372, 9.6, .40), P(-1.385, 9.42, .405), P(-1.40, 9.32, .41), P(mx0 + .055 + .011 * 1.45, 9.28, .41)], .012, 'tube', { clamps: 1 }); } }   // the cooled oil back to the manifold

    /* ============================== FUEL ============================== */
    PW.part('fuel', { label: 'Fuel system lines', explode: [0, 0, -.45], src: 'p.162-183; TTM ch. 73',
      info: 'Fuel comes down from the pylon to the IFPC on the MGB. Its boost pump sends the fuel through the fuel/oil manifold to the fuel/oil heat exchanger and back, then through the filter to the high-pressure pump. Metered fuel passes the flow meter and leaves the manifold in two tubes for the primary and secondary manifolds round the combustor, which feed the 16 nozzles: 10 duplex and 6 simplex (secondary only), in a pattern of 4 duplex, 4 simplex, 6 duplex, 2 simplex. Every nozzle has check valves that keep the manifolds full after shutdown.\n\nServo fuel from the high-pressure pump drives the vane and bleed actuators and the turbine active clearance control valve, and returns upstream of the filter (p.166). The IFPC\'s motive flow pump sends fuel back up a small tube beside the supply to the aircraft: it drives the engine feed ejector pump in the collector tank, which normally feeds the engine. If an ejector pump fails, both AC boost pumps run instead (TTM 28-00).' });
    /* the supply crosses under the left thrust link close to its CIC end, where it is lowest; the FOHX boost lines cross over it */
    line('fuel', [P(-1.03, 11.8, 1.06), P(-1.035, 11.8, .90), P(-1.04, 11.79, .70), P(-1.042, 11.74, .50), P(-1.045, 11.55, .455), P(-1.048, 11.2, .455), P(-1.06, 10.75, .43), P(-1.078, 10.43, .397), P(-1.10, 10.05, .452),
      P(-1.16, 9.4, .47), P(-1.25, 8.75, .49), P(-1.262, 8.58, .44), P(-1.267, 8.505, .416)], .02, 'hose', { clamps: 4, labels: [[.36, 'labelWhite'], [.44, 'labelPrintBlue']] });   // supply from the pylon, beside the precooler duct, into the IFPC's boost pump inlet
    /* motive flow (TTM 73-00 fig. 2): from the port beside the IFPC's fuel inlet back up to the pylon, following the supply aft of it:
       under the left thrust link with it, between it and the fuel/oil cooler, over the FOC manifold and up the upper bifurcation */
    line('fuel', [P(-1.358, 8.467, .3995), P(-1.358, 8.576, .405), P(-1.345, 8.66, .43), P(-1.315, 8.76, .465), P(-1.27, 8.9, .50), P(-1.22, 9.3, .495), P(-1.19, 9.6, .478), P(-1.16, 9.95, .458),
      P(-1.138, 10.15, .445), P(-1.112, 10.45, .41), P(-1.10, 10.6, .42), P(-1.095, 10.75, .43), P(-1.088, 11.2, .462), P(-1.10, 11.45, .493), P(-1.11, 11.6, .496), P(-1.114, 11.69, .499), P(-1.117, 11.735, .53),
      P(-1.118, 11.755, .60), P(-1.118, 11.755, .80), P(-1.118, 11.755, 1.04)], .005, 'tube', { clamps: 4 });
    for (const [o, r1] of [[0, 0], [.12, .03]]) {                                                                                               // boost fuel to and from the FOHX
      line('fuel', [P(-1.12 - o * .25, 11.55 + o, .43), P(-1.115 - o * .25, 11.2, .475), P(-1.125 - o * .25, 10.8, .49), P(-1.13 - o * .25, 10.45, .497 + o * .025), P(-1.16 - o * .28, 10.1 + o * .6, .49), P(-1.25, 9.9 + o * .8, .49 + r1 * .5),
        P(-1.32, 9.75 + o * .8, .475 + r1), P(-1.40, 9.4 + o * .67, .465 + r1 * .83), P(-1.432 - o * .233, 9.47 + o * .25, .44 + o * .2), P(-1.444 - o * .233, 9.407, .43 + o * .208)], .012, 'tube', { clamps: 2 }); }
    /* metered fuel: two tubes leave the inner face of the FOM near its top end, run up in front of the MGB's left arm under the oil
       tower and the VFG oil/oil cooler, and aft above the arm, under the AOHX, to the primary and secondary manifolds */
    /* p.162-163, p.174-175: the two manifold rings round the diffuser case. The secondary, the larger bore with a forged tee at every
       nozzle, feeds all 16 nozzles; the primary feeds only the 10 duplex ones. The manual draws the rings aft of the nozzle heads, toward
       flange M. Here the starter and generator hang from the main gearbox close behind the heads at 6 to 9 o'clock, so the rings run just
       forward of the heads instead, the secondary furthest forward, and the heads' inlets point forward to them */
    const xS = -1.705, rS = .31, xPm = -1.722, rPm = .3215;
    line('fuel', [P(-1.472, 9.25, .37 - .0116), P(-1.472, 9.25, .348), P(-1.472, 9.4, .343), P(-1.475, 9.55, .341), P(-1.50, 9.66, .343), P(-1.60, 9.66, .343), P(-1.67, 9.70, .34), P(-1.70, 9.76, .338), P(-1.716, 9.79, .333), P(-1.722, 9.8, .3255)], .008, 'tube', { clamps: 2 });   // to the primary
    line('fuel', [P(-1.444, 9.12, .37 - .0116), P(-1.444, 9.12, .348), P(-1.444, 9.3, .342), P(-1.444, 9.5, .34), P(-1.445, 9.75, .339), P(-1.46, 9.86, .338), P(-1.55, 9.87, .338), P(-1.65, 9.9, .336), P(-1.685, 9.96, .332), P(-1.70, 10.0, .325), P(-1.705, 10.0, .3165)], .008, 'tube', { clamps: 2 });   // to the secondary
    /* metered fuel from the IFPC's upper forward corner round in a U to the flow meter's inlet (A Nahas photo); the meter returns it
       through its flange into the manifold */
    { const I = FLa(mx0 + .16, 8.05, .44), M = FLa(mx0 + .055, 8.85, .43);
      line('fuel', [I(.1016, .02, .065), I(.112, .021, .066), I(.122, .022, .078), I(.127, .015, .11), I(.124, -.008, .145), I(.112, -.03, .163), I(.09, -.045, .1665), M(.1415, -.004, -.008)], .005, 'tube', { clamps: 0 }); }
    { const torus = (x, r, t) => { const o = []; for (let k = 0; k <= 16; k++) { const q = k / 16 * TAU; o.push([x + t * Math.cos(q), r + t * Math.sin(q)]); } return o; };
      PW.add('fuel', G.revolve(torus(xS, rS, .0065), { seg: 160 }), 'steel', { solid: true });                               // secondary manifold
      PW.add('fuel', G.revolve(torus(xPm, rPm, .0045), { seg: 160 }), 'steel', { solid: true });                             // primary manifold
      for (let i = 0; i < 16; i++) { const a = i / 16 * TAU + TAU / 32, h = a / (TAU / 12), N = FLa(-1.761, h, .289);
        const t = new THREE.Mesh(G.roundedBox(.014, .016, .016, .003)); t.position.copy(P(xS, h, rS)); t.rotation.x = a; PW.add('fuel', t, 'steel', { solid: true });   // the tee
        line('fuel', [N(.0257, .016, 0), N(.034, .0165, 0), N(.042, .019, 0), N(.049, .021, 0)], .004, 'tube', { clamps: 0, ends: false });   // secondary transfer tube
        if (D.fuelDuplex.includes(i)) { const b = new THREE.Mesh(G.roundedBox(.008, .012, .01, .002)); b.position.copy(P(xPm - .002, h, rPm)); b.rotation.x = a; PW.add('fuel', b, 'steel', { solid: true });
          line('fuel', [N(.0215, .03, 0), N(.027, .031, 0), N(.0325, .0325, 0)], .0035, 'tube', { clamps: 0, ends: false }); } } }   // primary transfer tube
    /* p.167: servo fuel from the IFPC's servo pressure regulator to the four fuel-powered actuators (turbine ACC air valve, HPC and LPC
       vane actuators, 2.5 bleed valve) and back to the fuel/oil manifold ahead of the filter. The supply and return run as a pair round
       the right of the core just aft of WC08 and the CIC fire seal, under the actuators, with a branch up to each one's ports, then aft
       to the ACC valve, low under the bleed duct's elbow and beside the PRSOV, rising to the valve aft of the 4th-stage tee */
    { const arcP = (x, r, h0, h1, n) => Array.from({ length: n + 1 }, (_, i) => P(x, h0 + (h1 - h0) * i / n, r));
      line('fuel', [P(-1.258, 7.68, .448), P(-1.255, 7.5, .44), P(-1.24, 7.25, .435), P(-1.19, 7.0, .42), P(-1.168, 6.8, .395), P(-1.165, 6.6, .385)].concat(arcP(-1.165, .385, 6.45, 1.85, 16),
        [P(-1.19, 1.74, .36), P(-1.225, 1.6, .322), P(-1.30, 1.42, .31), P(-1.40, 1.38, .31), P(-1.44, 1.36, .34), P(-1.47, 1.28, .40), P(-1.50, 1.2, .43), P(-1.53, 1.12, .44), P(-1.57, 1.10, .455),
         P(-1.585, 1.13, .465), P(-1.594, 1.157, .47)]), .006, 'tube', { clamps: 6, ends: false });   // supply
      line('fuel', [P(-1.458, 7.9, .485), P(-1.458, 7.84, .503), P(-1.458, 7.5, .505), P(-1.455, 7.15, .503), P(-1.44, 7.0, .50), P(-1.35, 6.98, .50), P(-1.25, 6.98, .495), P(-1.20, 6.93, .46), P(-1.185, 6.75, .43), P(-1.18, 6.55, .405)].concat(arcP(-1.18, .40, 6.45, 1.9, 16),
        [P(-1.205, 1.8, .375), P(-1.24, 1.7, .33), P(-1.30, 1.56, .312), P(-1.40, 1.52, .312), P(-1.45, 1.5, .33), P(-1.48, 1.45, .39), P(-1.51, 1.38, .45), P(-1.53, 1.29, .50), P(-1.575, 1.258, .485),
         P(-1.587, 1.258, .475), P(-1.594, 1.258, .47)]), .006, 'tube', { clamps: 6, ends: false });   // return, leaving the manifold aft of the fuel filter
      for (const pts of [
        [P(-1.165, 2.62, .385), P(-1.16, 2.6, .43), P(-1.148, 2.64, .465), P(-1.145, 2.69, .471)], [P(-1.18, 2.58, .40), P(-1.183, 2.57, .44), P(-1.185, 2.64, .467), P(-1.185, 2.69, .471)],   // 2.5 bleed valve actuator
        [P(-1.165, 5.40, .385), P(-1.16, 5.42, .43), P(-1.148, 5.36, .465), P(-1.145, 5.31, .469)], [P(-1.18, 5.44, .40), P(-1.183, 5.45, .44), P(-1.185, 5.36, .466), P(-1.185, 5.31, .469)],   // LPC vane actuator
        [P(-1.165, 3.86, .385), P(-1.185, 3.87, .412), P(-1.21, 3.9, .425), P(-1.222, 3.93, .412)], [P(-1.18, 4.14, .40), P(-1.198, 4.13, .425), P(-1.215, 4.1, .43), P(-1.222, 4.07, .412)]])   // HPC vane actuator
        line('fuel', pts, .005, 'tube', { clamps: 0, ends: false }); }

    /* ============================== AIR SYSTEMS ============================== */
    PW.part('air', { label: 'Engine air systems', explode: [0, .4, 0], src: 'p.256-285; TTM ch. 75',
      info: 'Variable vanes on the LPC and HPC, the 2.5 and HPC bleed valves that keep the compressors stable during starts and transients, turbine active clearance control, and buffer air for the bearing compartment seals. The vane actuators, the 2.5 bleed valve actuator and the turbine ACC air valve are scheduled by the EEC and moved by IFPC servo fuel (p.166). The HPC bleed valve is spring-loaded open for the start and closed by HPC (station 2.9) air as the pressure rises, fully closed at idle (p.264). The buffer air shutoff valve is opened when the EEC energizes its solenoid at low power (p.278).' });
    /* p.258-267. The CIC firewall is the cone from the fan duct inner wall down to the HPC case (r .515 at x -.95 to .262 at -1.16).
       The 2.5 bleed and LPC vane actuators sit on its aft face in the core compartment, with their rods running forward through it */
    const rFire = x => .515 - (-.95 - x) / .21 * .253;
    /* a unit's own frame at pos: x along its axis, y toward `up` (squared to x), z across */
    const vframe = (pid, pos, ax, up) => { const X = ax.clone().normalize(), Y = up.clone().addScaledVector(X, -up.dot(X)).normalize(), Z = new THREE.Vector3().crossVectors(X, Y);
      const g = new THREE.Group(); g.position.copy(pos); g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z)); PW.parts.get(pid).obj.add(g); g.updateMatrixWorld(true); return g; };
    const lastPort = () => { const p = PW.ports[PW.ports.length - 1]; p.f.updateMatrixWorld(true); return p.f.localToWorld(V(...p.end)); };   // the end of the fitting or connector just built
    const radAt = p => V(0, p.y, p.z).normalize(), tanAt = p => V(0, -p.z, p.y).normalize();                                // radially out, and toward increasing clock
    const actDrain = {};                                                                                                // the actuators' drain fittings, for the drain mast
    /* WC08 runs round the right of the core at x -1.115, r .34, just aft of the fire seal (harnesses below): the actuators' torque
       motor and LVDT leads drop into it */
    const toWC08 = (pid, pts) => line(pid, pts, .005, 'harness', { clamps: 0, ends: false });
    /* the fire-seal actuators (2.5 bleed, LPC vanes), from p.267's render, p.261 and Brian's photo of the 2.5 bleed actuator: a long grey
       casting lying fore and aft on the seal's aft face, bolted to it by a square flange on spacers, its rod housing passing forward
       through the seal; a stepped body with a collar by the flange and the LVDT's domed cap aft; on its side (toward 12 o'clock on the
       2.5 bleed actuator) the servo valve housing with the servo fuel fittings and the torque motor canister; the torque motor and LVDT
       connectors underneath, wired down into WC08; a data plate on top and the drain fitting under the cap */
    const sealAct = (pid, h, hs, rs, side) => { const g = Kt.frame(pid, -1.12, h, .455), A = FLa(-1.12, h, .455);
      Kt.prof(pid, g, [0, 0, 0], 'x', [[.078, 0], [.078, .028], [.074, .035], [.06, .038], [.058, .042], [.044, .042], [.042, .038], [-.062, .038], [-.065, .033], [-.08, .033], [-.08, 0]], 'castAl', { seg: 40 });
      Kt.prof(pid, g, [-.08, 0, 0], '-x', [[.02, 0], [.02, .013], [.016, .021], [.008, .027], [0, .029], [0, 0]], 'castAl', { seg: 32 });   // LVDT cap
      Kt.box(pid, g, [.064, 0, 0], [.01, .088, .088], 'castAl', { round: .008 }); Kt.bolts(pid, g, [.0695, 0, 0], 'x', .044, 4, .004, { phase: Math.PI / 4 });   // mounting flange
      Kt.cyl(pid, g, [.1, 0, 0], 'x', .02, .06, 'castAl');                                                                        // rod housing through the seal
      Kt.box(pid, g, [.105, 0, 0], [.07, .07, .07], 'castAl', { round: .01 });                                                   // the seal's mounting boss
      Kt.plate(pid, g, [-.012, .0385, .012 * side], 'y', 'x', .03, .02);                                                           // data plate
      for (const x of [-.045, .03]) Kt.hex(pid, g, [x, .02, .033 * side], [0, .5, .866 * side], .006, .006, 'steel');                 // plugged ports
      const f2 = Kt.frame(pid, -1.15, hs, rs);                                                                                    // the servo side, where the fittings always were
      Kt.box(pid, f2, [-.022, -.006, .004 * side], [.105, .048, .042], 'castAl', { round: .008 });                                // servo valve housing
      for (const x of [-.035, .005]) Kt.fitting(pid, f2, [x, 0, .025 * side], side > 0 ? 'z' : '-z', .006);                      // servo fuel in and out (p.167)
      Kt.cyl(pid, f2, [-.058, .026, .006 * side], [-.45, .55, .70 * side], .019, .048, 'castAl', { edge: .004 });                 // torque motor canister
      Kt.hex(pid, f2, [.022, .019, -.004 * side], 'y', .006, .006, 'steel');                                                      // servo filter plug
      Kt.connector(pid, g, [.03, -.036, 0], '-y', .008, { lead: 'x' }); toWC08(pid, [lastPort(), A(.03, -.07, 0), A(.008, -.098, 0)]);           // torque motor
      Kt.connector(pid, g, [-.02, -.036, 0], '-y', .008, { lead: 'x' }); toWC08(pid, [lastPort(), A(-.002, -.075, .004), A(.004, -.099, .006)]);   // LVDT
      Kt.fitting(pid, g, [-.09, -.025, 0], '-y', .005); return lastPort(); };                                                      // drain
    PW.part('hpc-sva', { parent: 'air', label: 'HPC stator vane actuator and synchronizing rings', src: 'p.258-261',
      info: 'Fuel-powered actuator on the HPC case on the right side at 4 o\'clock. Through a bellcrank it turns four synchronizing rings, which move the HPC inlet guide vanes and the first three stator rows together. The EEC positions it on N2 from the PMAG through a dual-coil torque motor and servovalve, and reads the piston back from a dual-coil LVDT.\n\nThe vanes are closed for start and idle and fully open at takeoff. With no power the actuator drives the vanes open, for maximum airflow. It needs no rigging when it is installed.' });
    { const rows = ['HPC variable inlet guide vane', 'HPC stator 1', 'HPC stator 2', 'HPC stator 3'].map(n => D.GEN.rows.find(r => r.name.startsWith(n)));
      /* p.261: each synchronizing ring carries a dense row of dark levers, one per vane trunnion */
      rows.forEach(rw => { if (!rw) return; const xx = (rw.x_le + rw.x_te) / 2, rr = Math.max(rCase(xx), .245) + .016;
        PW.add('hpc-sva', G.revolve([[xx + .007, rr], [xx - .007, rr], [xx - .007, rr + .014], [xx + .007, rr + .014]], { seg: 128 }), 'steel');
        PW.add('hpc-sva', G.ringInstances(new THREE.BoxGeometry(.034, .026, .010).translate(-.004, rr - .006, 0), PW.partMat('hpc-sva', 'darkBox'), 44, { x: xx + .006 }), null); });
      const xs = rows.map(rw => rw ? (rw.x_le + rw.x_te) / 2 : null), x0 = xs[0] || -1.15, x3 = xs[3] || -1.39, xa = (x0 + x3) / 2 - .02, ra = rCase(xa) + .08, W = PW.parts.get('hpc-sva').obj;
      /* the actuator (p.261, A Nahas photo): a stepped grey body lying fore and aft over the vane rings at 4 o'clock, its rod forward to
         the bellcrank, the LVDT cap aft; on top the servo valve and torque motor housing with the servo fuel fittings (p.167), the drain
         fitting on one side and the torque motor connector on the other, wired forward under the servo fuel rings into WC08 */
      const g = Kt.frame('hpc-sva', xa, 4.0, ra), t = Kt.frame('hpc-sva', xa, 4.0, ra + .045);
      Kt.prof('hpc-sva', g, [0, 0, 0], 'x', [[.125, 0], [.125, .016], [.12, .026], [.105, .033], [.1, .036], [-.1, .036], [-.104, .031], [-.122, .031], [-.122, 0]], 'castAl', { seg: 40 });
      Kt.prof('hpc-sva', g, [-.122, 0, 0], '-x', [[.026, 0], [.026, .014], [.02, .022], [.01, .026], [0, .026], [0, 0]], 'castAl', { seg: 32 });   // LVDT cap
      Kt.box('hpc-sva', t, [0, 0, 0], [.17, .04, .07], 'castAl', { round: .008 });                                                   // servo valve and torque motor housing
      Kt.box('hpc-sva', t, [-.02, .0215, 0], [.1, .003, .055], 'castAl', { round: .002 });                                           // its cover
      for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) Kt.hex('hpc-sva', t, [-.02 + a * .044, .024, b * .022], 'y', .003, .003, 'steel');
      for (const z of [-.015, .015]) Kt.fitting('hpc-sva', t, [.07, .02, z], 'y', .006);                                            // servo fuel in and out (p.167)
      Kt.plate('hpc-sva', g, [-.06, 0, .0365], 'z', 'x', .03, .02);                                                                 // data plate
      Kt.fitting('hpc-sva', t, [-.02, 0, .035], 'z', .005); actDrain.hpc = lastPort();                                              // drain
      Kt.connector('hpc-sva', t, [.03, 0, -.035], '-z', .008, { lead: 'x' });                                                       // torque motor
      toWC08('hpc-sva', [lastPort(), P(-1.22, 3.72, .375), P(-1.17, 3.72, .355), P(-1.13, 3.75, .35), P(-1.118, 3.78, .352)]);
      Kt.connector('hpc-sva', g, [-.13, 0, -.02], '-z', .007, { lead: 'x' });                                                       // LVDT, into the torque motor's lead
      toWC08('hpc-sva', [lastPort(), P(-1.40, 3.72, .345), P(-1.32, 3.7, .35), P(-1.26, 3.72, .37)]);
      /* the bellcrank (p.261): a shaft along the rings at 4:30 on two brackets from the case, an arm and a link to a clevis on each ring,
         and a crank at its forward end taking the actuator's rod */
      const hb = 4.5, rb = .318, xf = x0 + .012, xr = x3 - .012;
      Kt.cyl('hpc-sva', W, P((xf + xr) / 2, hb, rb).toArray(), 'x', .008, xf - xr, 'steel');
      for (const xb of [-1.2, (xs[2] + xs[3]) / 2]) { const rc = rCase(xb); Kt.box('hpc-sva', Kt.frame('hpc-sva', xb, hb, (rc + rb) / 2), [0, 0, 0], [.012, rb - rc + .008, .022], 'castAl', { round: .003 }); }
      xs.forEach(xx => { if (xx == null) return; const rr = Math.max(rCase(xx), .245) + .016;
        Kt.box('hpc-sva', Kt.frame('hpc-sva', xx, hb, rb), [0, 0, -.017], [.01, .014, .04], 'steel', { round: .003 });            // arm
        Kt.rod('hpc-sva', W, FLa(xx, hb, rb)(0, 0, -.034).toArray(), P(xx, hb - .2, rr + .018).toArray(), .004, 'steel');         // link
        Kt.box('hpc-sva', Kt.frame('hpc-sva', xx, hb - .2, rr + .017), [0, 0, 0], [.012, .01, .016], 'steel', { round: .002 }); });   // clevis on the ring
      Kt.box('hpc-sva', Kt.frame('hpc-sva', xf - .004, 4.28, .326), [0, 0, 0], [.012, .014, .056], 'steel', { round: .003 });      // crank
      Kt.rod('hpc-sva', W, P(xa + .118, 4.0, ra).toArray(), P(xf - .004, 4.1, .328).toArray(), .006, 'steel'); }                   // actuator rod
    PW.part('lpc-sva', { parent: 'air', label: 'LPC stator vane actuator and synchronizing ring', src: 'p.258-261',
      info: 'Fuel-powered actuator at 5 o\'clock on the CIC firewall. Its rod runs forward through the firewall to a bellcrank on the synchronizing ring round the LPC inlet, which turns the LPC inlet guide vanes together. The EEC positions it on N1 through a dual-coil torque motor and servovalve, with a dual-coil LVDT reporting to each channel.\n\nThe manual\'s text has the vanes moving toward closed for start and idle, modulating in transients and open above idle (its table differs for the start case). With no power the actuator drives the vanes open.' });
    { const rw = D.GEN.rows.find(r => r.name.startsWith('LPC variable')); const xx = (rw.x_le + rw.x_te) / 2, rr = .392;
      PW.add('lpc-sva', G.revolve([[xx + .007, rr], [xx - .007, rr], [xx - .007, rr + .014], [xx + .007, rr + .014]], { seg: 128 }), 'steel');
      PW.add('lpc-sva', G.ringInstances(new THREE.BoxGeometry(.03, .022, .009).translate(-.004, rr - .005, 0), PW.partMat('lpc-sva', 'darkBox'), 40, { x: xx + .006 }), null);
      actDrain.lpc = sealAct('lpc-sva', 5.0, 5.15, .468, 1);
      line('lpc-sva', [P(-1.03, 5.0, .455), P(-.95, 5.0, .466), P(-.80, 5.0, .468), P(xx - .02, 5.0, .43)], .007, 'tube', { clamps: 0, ends: false });
      box('lpc-sva', xx - .025, 5.0, .425, .04, .06, .03, 'steel'); }                                                                       // bellcrank on the ring
    PW.part('bleed-25', { parent: 'air', label: '2.5 bleed valve and actuator', src: 'p.264-267',
      info: 'Ring valve round the LPC case just forward of the CIC, at station 2.5. Opened, it dumps LPC exit air into the fan stream, giving the LPC surge margin during starts, low power and transients and throwing out dirt, rain and ice on the ground. Its actuator is horizontal on the right side, on the aft face of the CIC firewall, and works the ring through a bellcrank. It runs on IFPC servo fuel through an integral torque motor.\n\nThe EEC schedules it on N1, biased with altitude and Mach: open for start and idle, modulating in transients, closed at takeoff. It fails open. On a surge the EEC opens it, selects continuous ignition on both igniters and resets the variable vanes.' });
    { PW.add('bleed-25', G.ring(-.895, -.93, .425, .455, { seg: 128 }), 'nickel'); PW.add('bleed-25', G.boltCircle(PW.partMat('bleed-25', 'steel'), -.893, .44, 48, .004), null);
      actDrain.b25 = sealAct('bleed-25', 3.0, 2.85, .47, -1);
      line('bleed-25', [P(-1.03, 3.0, .455), P(-.95, 3.0, .462), P(-.866, 3.0, .466)], .007, 'tube', { clamps: 0, ends: false });
      /* p.267: the rod's clevis on the upper arm of a triangular bellcrank pivoting on a bracket ahead of the ring; its lower arm's link
         runs back to a clevis on the ring */
      { const f = Kt.frame('bleed-25', -.852, 3.0, .45);
        Kt.box('bleed-25', f, [0, .016, 0], [.03, .022, .014], 'steel', { round: .004 }); Kt.box('bleed-25', f, [-.01, -.004, 0], [.026, .03, .014], 'steel', { round: .004 });   // the two arms
        Kt.cyl('bleed-25', f, [0, 0, 0], 'z', .009, .03, 'steel'); Kt.box('bleed-25', f, [.008, -.012, 0], [.02, .02, .036], 'castAl', { round: .003 });   // pivot and its bracket
        Kt.rod('bleed-25', PW.parts.get('bleed-25').obj, FLa(-.852, 3.0, .45)(-.016, -.014, 0).toArray(), P(-.888, 3.0, .452).toArray(), .004, 'steel');   // link to the ring
        Kt.box('bleed-25', Kt.frame('bleed-25', -.892, 3.0, .458), [0, 0, 0], [.012, .008, .016], 'steel', { round: .002 }); } }   // its clevis
    PW.part('hpc-bleed-valve', { parent: 'air', label: 'HPC bleed valve and pressure sensor', src: 'p.264-267',
      info: 'Two-position poppet valve on the HPC case at 1 o\'clock, on the 6th-stage bleed port. It is spring-loaded open for the start, dumping 6th-stage air through the slots round its base into the core compartment, and HPC pressure (station 2.9) closes it; it is fully closed by idle. The cowl anti-ice valves open during the start as well, adding bleed through the anti-ice ducting.\n\nA sense line from its cap runs forward over the vane rings to the pressure sensor on the CIC fire seal at 2 o\'clock. The EEC uses the sensor to detect a valve that fails open after the start, putting hot air into the core compartment, or one that stays closed during the start, which can stall the HPC.' });
    /* p.266: "on the HPC case at the 1 o'clock position"; p.267 draws it on a pad on the rear HPC case: a slotted discharge body, a
       narrower spring housing and a round cap with the sense line leaving its top, forward over the vane rings and down to the sensor
       on the fire seal. Here it stands at 1:18 on the 6th stage, between the T3 harness branch and the 6th-stage HPT cooling tube at
       1:36, under the turbine ACC valve's inlet elbow. It was on top at 12 o'clock until 2026-10-12 */
    { const xb = -1.537, hb = 1.3, rb = rCase(xb), f = Kt.frame('hpc-bleed-valve', xb, hb, rb), L = FLa(xb, hb, rb);
      Kt.box('hpc-bleed-valve', f, [0, .005, 0], [.058, .01, .058], 'nickel', { round: .006 });                                  // pad on the 6th-stage port
      Kt.bolts('hpc-bleed-valve', f, [0, .011, 0], 'y', .029, 4, .0035, { phase: Math.PI / 4 });
      Kt.cyl('hpc-bleed-valve', f, [0, .03, 0], 'y', .026, .04, 'nickel', { edge: .003 });                                       // discharge body
      Kt.fins('hpc-bleed-valve', f, [0, .03, 0], 'y', .0255, 12, .0012, .005, .026, 'capBlack');                                // its discharge slots
      Kt.flange('hpc-bleed-valve', f, [0, .052, 0], 'y', .014, .03, .005, 6, 'nickel');
      Kt.cyl('hpc-bleed-valve', f, [0, .068, 0], 'y', .02, .028, 'castAl', { edge: .003 });                                      // spring housing
      Kt.cyl('hpc-bleed-valve', f, [0, .066, .021], 'z', .008, .012, 'castAl');                                                   // side boss
      Kt.cyl('hpc-bleed-valve', f, [0, .089, 0], 'y', .015, .016, 'castAl', { edge: .003 });                                      // cap
      Kt.fitting('hpc-bleed-valve', f, [0, .097, 0], 'y', .005);
      /* the sensor (p.267): a transducer on a bracket on the fire seal, the sense line into its aft side, its connector on top, wired into
         the buffer air pressure sensor's lead where that comes through the seal */
      const g = Kt.frame('hpc-bleed-valve', -1.008, 2.15, rFire(-1.008)), S = FLa(-1.008, 2.15, rFire(-1.008));
      Kt.box('hpc-bleed-valve', g, [0, .006, 0], [.036, .012, .046], 'steel', { round: .003 });
      Kt.cyl('hpc-bleed-valve', g, [0, .03, 0], 'y', .012, .036, 'steel', { edge: .002 }); Kt.hex('hpc-bleed-valve', g, [0, .016, 0], 'y', .013, .007, 'steel');
      Kt.fitting('hpc-bleed-valve', g, [-.0118, .018, 0], '-x', .005);
      Kt.connector('hpc-bleed-valve', g, [0, .048, 0], 'y', .008, { lead: '-x' });
      line('hpc-bleed-valve', [L(0, .1043, 0), L(0, .114, 0), P(-1.52, 1.27, .353), P(-1.48, 1.2, .343), P(-1.40, 1.2, .335), P(-1.30, 1.21, .325), P(-1.22, 1.24, .322), P(-1.16, 1.3, .33),
        P(-1.125, 1.42, .362), P(-1.10, 1.55, .38), P(-1.075, 1.75, .408), P(-1.045, 2.03, .44), S(-.03, .02, 0), S(-.019, .018, 0)], .005, 'tube', { clamps: 4 });   // over WC08's end, then up the fire seal
      line('hpc-bleed-valve', [S(-.0144, .0632, 0), S(-.026, .0634, -.002), P(-1.036, 2.08, .49), P(-1.03, 2.02, .462), P(-1.022, 2.0, .446)], .004, 'harness', { clamps: 0, ends: false }); }
    /* ---- engine bleed, TTM ch. 36 (p.576-579): 4th-stage air through a check valve, or 8th-stage air through the high-pressure valve,
       joins, passes the bleed monitoring pressure sensor and the pressure-regulating shutoff valve, and enters the precooler; the bleed
       temperature sensor is on the precooler's outlet, where the starter duct branches off. The precooler, its fan-air duct and fan air
       valve, the outlet duct with the temperature sensor and the starter branch are placed from the manual's starting figure (p.297, a
       left side view, scaled off the fan case at about 2.47 mm a pixel at 150 dpi, engine centreline at pixel row 590).
       The valves are placed from the A Nahas photo of the core's right side (location photos p.19, "ENG CORE - RH"), which labels the
       PRSOV and the HPV, and its CAD side view (p.20), which calls them the ECS valves: they sit on the right of the core, not on top,
       where the model had them until 2026-10-12. The HPV is in a duct that rises forward from the 8th-stage port at the back of the HPC
       to a tee over the 4th stage; the PRSOV carries on forward from the tee, and its outlet elbow turns up. Measured in the photo
       against the turbine ACC valve, the 2.5 bleed and vane actuators and the oil tank, the tee is over the 4th stage and the PRSOV's
       centre near x -1.30. The check valve (on the 4th-stage port under the tee) and the pressure sensor (between the tee and the PRSOV)
       are hidden in the photo and follow the TTM's order. So is the duct beyond the elbow: here it passes under the right thrust link,
       crosses the top of the HPC and runs aft into the precooler's inlet, which p.297 draws pointing forward */
    PW.part('bleed-hp', { parent: 'air', label: 'Bleed ports and ducts (4th and 8th stage)', src: 'p.264; p.53; TTM ch. 36 (p.576-579); A Nahas location photos p.19-20',
      info: 'Customer bleed for the aircraft (air conditioning packs, wing anti-ice, fuel tank inerting and engine starting). It is taken from the HPC at the 4th stage through a check valve, or from the 8th stage through the high-pressure valve (HPV) when 4th-stage pressure is too low for the demand; the check valve keeps the 8th-stage air out of the 4th stage. The two meet at a tee on the right of the core at about 2 o\'clock, over the 4th stage, with the HPV in the duct rising forward to it from the 8th-stage port at the rear of the HPC. Forward of the tee the air passes the bleed monitoring pressure sensor and the pressure-regulating shutoff valve (PRSOV); the duct then turns up under the right thrust link, crosses the top of the core and runs aft into the precooler.\n\nA rupture of these ducts in the core compartment opens the pressure-relief door on the left inner fixed structure (p.20-23). The valve positions come from a labelled photo of the core\'s right side; the check valve, the pressure sensor and the duct\'s route over the core are hidden there and follow the TTM\'s order.' });
    const rowX = n => { const rw = D.GEN.rows.find(r => r.name.startsWith(n)); return (rw.x_le + rw.x_te) / 2; };
    const BL = (() => { const x4 = rowX('HPC rotor 4'), TE = P(x4, 1.9, .395), Pout = P(-1.255, 1.62, .40), E2 = P(-1.570, 2.57, .392), B5 = P(-1.45, .46, .405), M = V(-1.665, .395, 0);
      return { x4, TE, dP: Pout.clone().sub(TE).normalize(), dH: E2.clone().sub(TE).normalize(), E2, B5, M, dM: B5.clone().sub(M).normalize() }; })();   // the tee, the PRSOV and HPV axes, the precooler inlet
    { const { x4, TE, dP, dH, E2, B5, M, dM } = BL, W = PW.parts.get('bleed-hp').obj, rc4 = rCase(x4) + .035, leads = {};
      PW.add('bleed-hp', G.revolve([[x4 + .03, rCase(x4)], [x4 - .03, rCase(x4)], [x4 - .03, rc4], [x4 + .03, rc4]], { seg: 96 }), 'nickel');     // 4th-stage manifold collar
      /* the tee: a cast body with three branches, down to the 4th-stage port, aft to the HPV and forward to the PRSOV */
      Kt.ball('bleed-hp', W, TE.toArray(), .046, 'nickel');
      for (const d of [dP, dH]) { Kt.cyl('bleed-hp', W, TE.clone().addScaledVector(d, .034).toArray(), d, .042, .03, 'nickel'); Kt.vband('bleed-hp', W, TE.clone().addScaledVector(d, .05).toArray(), d, .042, { phase: Math.PI / 2 }); }
      /* the 4th-stage riser under it, from its boss on the collar through the check valve */
      { const g = Kt.frame('bleed-hp', x4, 1.9, rc4);
        Kt.box('bleed-hp', g, [0, .004, 0], [.06, .008, .06], 'nickel', { round: .006 }); Kt.bolts('bleed-hp', g, [0, .009, 0], 'y', .029, 4, .0035, { phase: Math.PI / 4 });
        Kt.cyl('bleed-hp', g, [0, .017, 0], 'y', .036, .018, 'nickel'); Kt.cyl('bleed-hp', g, [0, .057, 0], 'y', .036, .024, 'nickel'); }
      PW.part('bleed-cv', { parent: 'bleed-hp', label: '4th-stage bleed check valve', src: 'TTM ch. 36 (p.576-579)',
        info: 'Flapper check valve on the 4th-stage bleed port, under the tee where the 8th-stage air joins. When the high-pressure valve is open, the higher 8th-stage pressure closes it, so 8th-stage air cannot flow back into the 4th stage. It is hidden under the ducts in the photo of the core: its place follows the TTM\'s order.' });
      { const g = Kt.frame('bleed-cv', x4, 1.9, rc4 + .037);
        Kt.cyl('bleed-cv', g, [0, 0, 0], 'y', .044, .02, 'castAl', { edge: .003 });
        for (const s of [-1, 1]) Kt.flange('bleed-cv', g, [0, s * .0135, 0], s > 0 ? 'y' : '-y', .034, .046, .006, 8, 'steel');
        Kt.decal('bleed-cv', g, [.0447, 0, 0], 'x', 'z', .03, .012, 'FLOW >'); }                                      // on its forward face, reading outward with the flow
      /* the HPV branch: from the tee aft and down to the 8th-stage port at the back of the HPC, the valve in its straight run with the
         actuator on the outboard side (the photo) */
      line('bleed-hp', [TE.clone().addScaledVector(dH, .05), TE.clone().addScaledVector(dH, .084)], .038, 'tube', { clamps: 0, ends: false, mat: 'stainless' });   // tee to the valve's forward flange
      line('bleed-hp', [TE.clone().addScaledVector(dH, .146), TE.clone().addScaledVector(dH, .17), E2, P(-1.583, 2.6, .375), P(-1.587, 2.61, .345), P(-1.587, 2.61, .30), P(-1.587, 2.61, rCase(-1.587) + .012)], .038, 'tube', { clamps: 0, ends: false, tension: .15, mat: 'stainless' });
      { const g = Kt.frame('bleed-hp', -1.587, 2.61, rCase(-1.587)); Kt.box('bleed-hp', g, [0, .006, 0], [.062, .012, .062], 'nickel', { round: .006 }); Kt.bolts('bleed-hp', g, [0, .0125, 0], 'y', .03, 4, .0035, { phase: Math.PI / 4 }); }   // 8th-stage port boss
      Kt.vband('bleed-hp', W, P(-1.587, 2.61, .29).toArray(), radAt(P(0, 2.61, 1)), .038, { phase: 0 });
      PW.part('hpv', { parent: 'bleed-hp', label: 'High-pressure valve (HPV)', src: 'TTM ch. 36 (p.576-579); p.186-187; A Nahas location photos p.19',
        info: 'Butterfly valve in the 8th-stage bleed duct on the right of the core, between the 8th-stage port at the rear of the HPC and the tee over the 4th stage (the photo of the core\'s right side labels it). The integrated air system controllers (IASCs) open it when 4th-stage pressure is too low for the demand, and the bleed then comes from the 8th stage; otherwise it stays closed and the bleed comes from the 4th stage. Its open or closed state goes to the EEC, which uses it in setting idle (p.186-187).\n\nIts pneumatic actuator is on the outboard side, with the position indicator under the cover, the solenoid and connector at its forward end and a small tube from its aft end to the 8th-stage elbow.' });
      { const c = TE.clone().addScaledVector(dH, .115), g = vframe('hpv', c, dH, radAt(c).multiplyScalar(.75).addScaledVector(tanAt(c), .66)), Hw = (a, b, d) => g.localToWorld(V(a, b, d));
        Kt.cyl('hpv', g, [0, 0, 0], 'x', .046, .058, 'castAl', { edge: .005 });                                          // body
        for (const s of [-1, 1]) Kt.flange('hpv', g, [s * .033, 0, 0], s > 0 ? 'x' : '-x', .038, .052, .007, 8, 'steel');
        Kt.cyl('hpv', g, [0, .052, 0], 'y', .013, .016, 'castAl');                                                         // shaft boss
        Kt.box('hpv', g, [.004, .083, 0], [.07, .046, .064], 'castAl', { round: .008 });                                   // actuator housing
        Kt.box('hpv', g, [.004, .1075, 0], [.056, .004, .05], 'castAl', { round: .002 });                                  // its cover
        for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) Kt.hex('hpv', g, [.004 + a * .023, .11, b * .019], 'y', .0035, .003, 'steel');
        Kt.cyl('hpv', g, [.004, .083, .033], 'z', .013, .003, 'plateAl'); Kt.box('hpv', g, [.004, .086, .0348], [.0015, .016, .0015], 'capBlack', { round: .0005 });   // position indicator
        Kt.cyl('hpv', g, [-.046, .08, 0], '-x', .016, .024, 'castAl', { edge: .003 });                                     // solenoid on its forward end
        Kt.connector('hpv', g, [-.058, .08, 0], '-x', .008, { lead: 'z' }); leads.hpv = lastPort();
        /* the pneumatic line from the actuator's aft end down to a tap on the forward side of the 8th-stage elbow (photo) */
        Kt.fitting('hpv', g, [.039, .075, 0], 'x', .005); const pa = lastPort();
        const tf = Kt.frame('bleed-hp', -1.547, 2.61, .33); Kt.cyl('bleed-hp', tf, [0, 0, 0], 'x', .008, .008, 'nickel'); Kt.fitting('bleed-hp', tf, [.004, 0, 0], 'x', .005); const pb = lastPort();   // the tap is on the elbow
        line('hpv', [pa, Hw(.058, .078, 0), P(-1.525, 2.75, .44), P(-1.522, 2.78, .38), P(-1.528, 2.7, .345), P(-1.533, 2.64, .332), pb], .004, 'tube', { clamps: 1 }); }
      /* forward of the tee: a spool with the bleed monitoring pressure sensor, then the PRSOV */
      Kt.cyl('bleed-hp', W, TE.clone().addScaledVector(dP, .069).toArray(), dP, .042, .038, 'stainless');
      PW.part('bmps', { parent: 'bleed-hp', label: 'Bleed monitoring pressure sensor (BMPS)', src: 'TTM ch. 36 (p.576-579)',
        info: 'Pressure sensor on the bleed duct just forward of the tee where the 4th and 8th-stage air meet, ahead of the pressure-regulating shutoff valve. The IASCs use it to control the high-pressure valve. It is hidden in the photo of the core: its place follows the TTM\'s order.' });
      { const c = TE.clone().addScaledVector(dP, .069), g = vframe('bmps', c, dP, radAt(c).multiplyScalar(.6).addScaledVector(tanAt(c), -.8));
        Kt.cyl('bmps', g, [0, .047, 0], 'y', .011, .012, 'nickel'); Kt.hex('bmps', g, [0, .056, 0], 'y', .01, .007, 'steel');
        Kt.cyl('bmps', g, [0, .071, 0], 'y', .0095, .022, 'steel', { edge: .002 }); Kt.connector('bmps', g, [0, .082, 0], 'y', .007, { lead: '-x' }); leads.bmps = lastPort(); }
      PW.part('prsov', { parent: 'bleed-hp', label: 'Pressure-regulating shutoff valve (PRSOV)', src: 'TTM ch. 36 (p.576-579); p.198; A Nahas location photos p.19',
        info: 'Butterfly valve in the bleed duct forward of the tee, on the right of the core at about 2 o\'clock over the forward HPC (the photo of the core\'s right side labels it). It regulates the pressure of the bleed delivered to the aircraft and shuts the engine\'s bleed off. The integrated air system controllers (IASCs) control and monitor it, and it is also controlled from the L (R) BLEED button on the AIR panel. Pressing the ENG FIRE button closes it, through the IASC, with the fan air valve (p.198).\n\nThe actuator is on its outboard side, with the position indicator, a manual override nut, the pressure regulator and the torque motor and connector. Its outlet elbow turns up under the right thrust link toward the precooler.' });
      { const c = TE.clone().addScaledVector(dP, .13), g = vframe('prsov', c, dP, radAt(c).multiplyScalar(.25).addScaledVector(tanAt(c), .97));
        Kt.cyl('prsov', g, [0, 0, 0], 'x', .052, .07, 'castAl', { edge: .006 });                                         // body
        for (const s of [-1, 1]) { Kt.cyl('prsov', g, [s * .039, 0, 0], 'x', .045, .008, 'castAl'); Kt.vband('prsov', g, [s * .041, 0, 0], 'x', .045, { phase: Math.PI }); }
        Kt.cyl('prsov', g, [0, .057, 0], 'y', .014, .018, 'castAl');                                                        // shaft neck
        Kt.cyl('prsov', g, [0, .083, 0], 'y', .036, .036, 'castAl', { edge: .006 });                                        // actuator
        Kt.cyl('prsov', g, [0, .1025, 0], 'y', .028, .003, 'plateAl'); Kt.box('prsov', g, [0, .1045, .006], [.003, .0015, .018], 'capBlack', { round: .0005 });   // position indicator
        Kt.hex('prsov', g, [.018, .104, -.016], 'y', .007, .007, 'steel');                                                   // manual override nut
        Kt.box('prsov', g, [.038, .08, 0], [.026, .03, .03], 'castAl', { round: .005 });                                     // pressure regulator
        Kt.cyl('prsov', g, [-.045, .083, 0], '-x', .015, .022, 'darkBox');                                                    // torque motor
        Kt.connector('prsov', g, [-.058, .083, 0], '-x', .009, { lead: '-z' }); leads.prsov = lastPort(); }
      /* on from the PRSOV: the elbow turns up under the right thrust link, the duct crosses the top of the HPC and runs aft, straight for
         its last part, into the precooler's inlet (built with the precooler) */
      const dc = line('bleed-hp', [TE.clone().addScaledVector(dP, .172), P(-1.222, 1.45, .388), P(-1.232, 1.22, .392), P(-1.265, 1.0, .41), P(-1.34, .74, .41), B5, M.clone().addScaledVector(dM, .12), M.clone().addScaledVector(dM, .07)], .042, 'tube', { clamps: 0, ends: false, tension: .15, mat: 'stainless' });
      { const t = tAt(dc, -1.30); Kt.vband('bleed-hp', W, dc.getPointAt(t).toArray(), dc.getTangentAt(t), .042, { phase: 0 }); }
      /* the IASC wiring, down from the pylon on the right of the fan-air duct, over the duct and under the thrust link to a junction
         beside the tee, where the leads from the PRSOV's torque motor, the pressure sensor and the HPV's solenoid join it */
      const J1 = P(-1.43, 1.3, .44);
      line('bleed-hp', [V(-1.55, 1.017, .12), V(-1.55, .90, .125), V(-1.55, .78, .108), V(-1.55, .70, .10), V(-1.548, .635, .085), V(-1.542, .56, .078), P(-1.535, .3, .50), P(-1.50, .6, .47), P(-1.465, .95, .453), J1], .007, 'harness', { clamps: 2, ends: false });
      line('prsov', [leads.prsov, P(-1.36, 2.02, .468), P(-1.40, 1.78, .47), P(-1.42, 1.55, .455), J1], .005, 'harness', { clamps: 0, ends: false });
      line('bmps', [leads.bmps, P(-1.405, 1.55, .462), P(-1.414, 1.585, .459)], .004, 'harness', { clamps: 0, ends: false });   // into the PRSOV's lead
      line('hpv', [leads.hpv, P(-1.43, 2.0, .482), P(-1.43, 1.8, .48), P(-1.415, 1.67, .468)], .005, 'harness', { clamps: 0, ends: false }); }   // into the PRSOV's lead

    /* p.297: the precooler hangs in the upper bifurcation just above the core, from x -1.69 to -2.08, pitched about 17 deg nose-up. Fan
       air comes aft from the precooler duct inlet casting through a bellows and the fan air valve, opens out into its forward face and
       leaves through the aft face into the core compartment. Bleed comes into the lower header through the inlet the figure shows
       pointing forward, and leaves the upper header aft, where the outlet duct rises into the pylon and the starter duct drops
       away. A lug on top hangs it from the pylon and a strut braces its lower corner to the aft mount fitting. The bifurcation walls
       are only 0.18 m apart at its lower edge, so it is built 0.16 m wide */
    PW.part('precooler', { parent: 'air', label: 'Precooler', src: 'p.297; p.60; TTM ch. 36 (p.576-579)',
      info: 'Air-to-air heat exchanger above the core at 12 o\'clock, in the upper bifurcation between the thrust reverser halves. It hangs from the pylon on a lug on top and a strut braces its lower corner to the aft mount fitting.\n\nFan air from the precooler duct inlet at the top of the fan case comes aft through a flexible bellows and the fan air valve, into its forward face, and leaves through the aft face into the core compartment, venting overboard through the precooler exhaust door on the right IFS. Engine bleed from the pressure-regulating shutoff valve enters the lower header, crosses the core and leaves the upper header aft, cooled to a temperature the aircraft ducts can take: up into the pylon to the aircraft, with the starter duct branching down to the starter air valve. The bleed temperature sensor on the outlet tells the IASCs how far to open the fan air valve.\n\nLayout from the manual\'s starting figure (p.297); the flow paths inside are inferred.' });
    { const W = PW.parts.get('precooler').obj, PC = V(-1.85, .645, 0), PA = deg(17), zA = V(0, 0, 1);
      const pcW = (lx, ly, lz) => V(lx, ly, lz || 0).applyAxisAngle(zA, PA).add(PC);                              // precooler frame to engine
      const pf = new THREE.Group(); pf.position.copy(PC); pf.rotation.z = PA; W.add(pf);
      Kt.box('precooler', pf, [0, 0, 0], [.24, .29, .16], 'nickel', { round: .006 });                                 // the core
      for (const s of [-1, 1]) { Kt.box('precooler', pf, [0, 0, s * .0815], [.244, .294, .004], 'plateAl', { round: .002 });   // side plates
        Kt.box('precooler', pf, [-.085, 0, s * .0838], [.045, .28, .002], 'accGrey', { round: .001 });                     // doubler along the aft edge
        for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1]]) Kt.hex('precooler', pf, [a * .11, b * .135, s * .0855], s > 0 ? 'z' : '-z', .005, .004, 'steel'); }
      for (let i = 0; i < 15; i++) Kt.box('precooler', pf, [-.1205, 0, -.07 + i * .01], [.002, .27, .0012], 'steel', { round: 0, shadow: false });   // fins on the open aft face
      Kt.box('precooler', pf, [-.005, .172, 0], [.23, .055, .14], 'castAl', { round: .024 });                         // upper (outlet) header
      Kt.box('precooler', pf, [.01, -.198, 0], [.22, .11, .14], 'castAl', { round: .028 });                           // lower (inlet) header
      /* the bleed inlet: a stub out of the lower header's forward corner, pointing forward and to the right, where the duct from the
         PRSOV joins it on a V-band */
      { const { M, dM } = BL, a = M.clone().addScaledVector(dM, -.05), b = M.clone().addScaledVector(dM, .07);
        Kt.cone('precooler', W, a.clone().add(b).multiplyScalar(.5).toArray(), dM, .046, .054, a.distanceTo(b), 'nickel');
        Kt.vband('precooler', W, b.clone().addScaledVector(dM, -.006).toArray(), dM, .046, { phase: Math.PI / 2 }); }
      /* the hanging lug, its link up to the pylon, and the strut from the lower corner to the aft mount fitting */
      { const lug = pcW(.10, .2); Kt.box('precooler', W, lug.toArray(), [.05, .03, .04], 'steel', { round: .006 });
        const top = V(-1.80, 1.012, 0); Kt.rod('precooler', W, [lug.x, lug.y + .012, 0], top.toArray(), .009, 'steel'); Kt.box('precooler', W, [top.x, 1.006, 0], [.05, .016, .05], 'steel', { round: .004 }); }
      { const a = pcW(-.09, -.25, -.075), b = V(-2.522, .76, -.062);
        Kt.box('precooler', W, pcW(-.09, -.245, -.072).toArray(), [.04, .03, .012], 'steel', { round: .004 });
        Kt.rod('precooler', W, a.toArray(), b.toArray(), .012, 'steel'); for (const p of [a, b]) Kt.ball('precooler', W, p.toArray(), .017, 'steel');
        Kt.box('precooler', W, [-2.526, .76, -.062], [.012, .05, .03], 'steel', { round: .003 }); }
      /* fan-air side (Brian, from the aircraft): the bellows on the inlet casting, the fan air valve at the front of the duct right behind
         it, then the plain duct, hung from the pylon on two straps, and the diffuser into the forward face */
      const aD = V(-.9879, -.1554, 0), onA = x => V(x, .768 + (x + 1.148) * .1573, 0);                                // duct axis, falling aft
      const fC = onA(-1.315), fIn = fC.clone().addScaledVector(aD, -.0435), fOut = fC.clone().addScaledVector(aD, .0435), fav1 = V(-1.6685, .6857, 0);   // valve centre and faces; the diffuser's mouth
      line('precooler', [V(-1.148, .768, 0), onA(-1.21), fIn], .085, 'tube', { clamps: 0, ends: false, tension: .1, mat: 'plateAl' });
      line('precooler', [fOut, onA(-1.45), onA(-1.56), fav1], .085, 'tube', { clamps: 0, ends: false, tension: .1, mat: 'plateAl' });
      { const bf = Kt.frame('precooler', -1.205, 12, .759, { rz: .156 }), cv = [[.042, 0], [.042, .087]];
        for (let i = 0; i <= 48; i++) cv.push([.038 - .076 * i / 48, .0915 + .0055 * Math.cos(i / 48 * TAU * 6)]);
        cv.push([-.042, .087], [-.042, 0]); Kt.prof('precooler', bf, [0, 0, 0], 'x', cv, 'steel', { seg: 40 });
        for (const s of [-1, 1]) Kt.vband('precooler', bf, [s * .046, 0, 0], 'x', .086, { phase: 0 }); }
      for (const xx of [-1.53, -1.62]) { const yc = .768 + (1.148 + xx) * .1585, g = Kt.frame('precooler', xx, 12, yc, { rz: .156 });   // straps, each hung from the pylon on a rod
        Kt.vband('precooler', g, [0, 0, 0], 'x', .086, { phase: 0, width: .022 }); Kt.rod('precooler', W, [xx - .017, yc + .11, 0], [xx - .017, 1.012, 0], .005, 'steel'); }
      Kt.vband('precooler', Kt.frame('precooler', fav1.x, 12, fav1.y, { rz: .156 }), [.006, 0, 0], 'x', .086, { phase: 0 });   // the duct's joint with the diffuser
      { const up2 = V(-.1554, .9879, 0), uB = V(-.2924, .9563, 0), cB = pcW(.118, 0), N = 40, R = 9, pos = [], idx = [];
        for (let k = 0; k <= R; k++) { const t = k / R, s = t * t * (3 - 2 * t);
          for (let i = 0; i < N; i++) { const th = i / N * TAU, c = Math.cos(th), sn = Math.sin(th);
            const a = fav1.clone().addScaledVector(aD, -.004).addScaledVector(up2, .086 * c).addScaledVector(zA, .086 * sn);
            const b = cB.clone().addScaledVector(uB, .14 * Math.sign(c) * Math.pow(Math.abs(c), 2 / 3)).addScaledVector(zA, .077 * Math.sign(sn) * Math.pow(Math.abs(sn), 2 / 3));
            const p = a.lerp(b, s); pos.push(p.x, p.y, p.z); } }
        for (let k = 0; k < R; k++) for (let i = 0; i < N; i++) { const a = k * N + i, b = k * N + (i + 1) % N, c = a + N, d = b + N; idx.push(a, b, c, b, d, c); }
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
        PW.add('precooler', g, 'plateAl'); }                                                                         // the inlet diffuser
      /* bleed outlet: the upper header turns aft into a tee; the duct rises into the pylon (to the aircraft) and the starter duct drops */
      const T = V(-2.14, .745, 0);
      line('precooler', [pcW(-.10, .175), pcW(-.13, .178), V(-2.06, .757, 0), V(-2.095, .752, 0)], .062, 'tube', { clamps: 0, ends: false });
      Kt.ball('precooler', W, T.toArray(), .068, 'steel');
      line('precooler', [T, V(-2.20, .82, 0), V(-2.29, .925, 0), V(-2.36, 1.0, 0), V(-2.385, 1.035, 0)], .06, 'tube', { clamps: 0, ends: false });
      Kt.cyl('precooler', W, [-2.245, .8725, 0], [-.09, .105, 0], .067, .1, 'blanket');                                 // insulating sleeve (p.297)
      Kt.vband('precooler', W, [-2.372, 1.016, 0], [-.025, .035, 0], .061, { phase: 0 });                              // the joint with the pylon's bleed duct

      PW.part('fav', { parent: 'precooler', label: 'Fan air valve (FAV)', src: 'TTM ch. 36 (p.578-579); p.198; Breeze maintenance',
        info: 'Butterfly valve at the front of the precooler\'s fan-air duct, just aft of the bellows on the precooler duct inlet. The integrated air system controllers (IASCs) modulate it to hold the bleed temperature measured by the bleed temperature sensor on the precooler outlet: more fan air through the precooler, cooler bleed. Pressing the ENG FIRE button closes it, through the IASC, together with the pressure-regulating shutoff valve (p.198).\n\nThe round actuator on top has a position indicator on its face, with the electrical control head above it and a small tube aft along the duct to a tap on the precooler.' });
      /* placed at the front of the duct from Breeze maintenance; the manual's starting figure (p.297) draws an unlabelled valve further
         aft, just ahead of the precooler */
      { const f = Kt.frame('fav', fC.x, 12, fC.y, { rz: .156 });
        Kt.cyl('fav', f, [0, 0, 0], 'x', .089, .066, 'castAl', { edge: .004 });                                         // butterfly valve body
        for (const s of [-1, 1]) { Kt.flange('fav', f, [s * .037, 0, 0], s > 0 ? 'x' : '-x', .085, .1, .008, 12, 'castAl'); Kt.vband('fav', f, [s * .05, 0, 0], 'x', .086, { phase: 0 }); }
        Kt.cyl('fav', f, [0, .1, 0], 'y', .016, .024, 'castAl');                                                        // shaft boss
        Kt.box('fav', f, [0, .121, 0], [.06, .022, .05], 'castAl', { round: .006 });                                    // actuator bracket
        Kt.cyl('fav', f, [.005, .153, -.004], 'z', .048, .052, 'castAl', { edge: .007 });                                 // actuator
        Kt.cyl('fav', f, [.005, .153, -.0315], '-z', .039, .004, 'plateAl');                                              // position indicator face
        Kt.box('fav', f, [.012, .159, -.0345], [.03, .004, .002], 'capBlack', { round: .001, rot: [0, 0, .6] });         // its pointer
        Kt.box('fav', f, [.058, .153, -.004], [.016, .02, .03], 'castAl', { round: .004 }); Kt.hex('fav', f, [.058, .153, -.022], '-z', .006, .005, 'steel');   // mounting ear
        Kt.box('fav', f, [.03, .207, 0], [.05, .03, .036], 'darkBox', { round: .005 });                                  // electrical control head
        Kt.connector('fav', f, [.05, .224, 0], 'y', .01);
        Kt.fitting('fav', f, [-.045, .153, -.004], '-x', .007); }
      Kt.fitting('precooler', pf, [.10, .045, .0835], 'z', .006);                                                       // tap for the valve's tube, on the right side plate
      /* the valve's pressure sense line: aft over the top of the duct and down its right side to the tap on the precooler (the A Nahas
         photo of the core's right side labels it there; it ran down the left until 2026-10-12) */
      line('fav', [V(-1.393, .8842, -.004), V(-1.41, .882, .005), V(-1.47, .868, .03), V(-1.57, .842, .058), V(-1.67, .806, .085), V(-1.735, .77, .099), V(-1.757, .74, .098),
        V(-1.765, .725, .097), V(-1.7676, .7172, .0922)], .005, 'tube', { clamps: 3 });
      line('fav', [V(-1.306, 1.0072, 0), V(-1.3058, 1.012, .002), V(-1.3055, 1.017, .004)], .006, 'harness', { clamps: 0, ends: false });   // up into the pylon

      PW.part('bts', { parent: 'precooler', label: 'Bleed temperature sensor (BTS)', src: 'TTM ch. 36 (p.576-579); p.297',
        info: 'Temperature probe in the bleed duct just downstream of the precooler, where the starter duct branches off. The IASCs modulate the fan air valve on it, holding the temperature of the bleed delivered to the aircraft. The manual\'s starting figure (p.297) draws it on the outlet duct but does not label it.' });
      { const g = new THREE.Group(); g.position.set(-2.156, .87, 0); PW.parts.get('bts').obj.add(g);
        Kt.cyl('bts', g, [-.002, 0, 0], 'x', .013, .008, 'steel'); Kt.hex('bts', g, [.009, 0, 0], 'x', .011, .01, 'steel');
        Kt.cyl('bts', g, [.026, 0, 0], 'x', .0085, .024, 'steel'); Kt.connector('bts', g, [.038, 0, 0], 'x', .008, { lead: 'y' });
        line('bts', [V(-2.1028, .8844, 0), V(-2.108, .95, .008), V(-2.105, 1.017, .012)], .005, 'harness', { clamps: 0, ends: false }); } }
    PW.part('tacc', { parent: 'air', label: 'Turbine active clearance control', src: 'p.270-277',
      info: 'Fan air taken through the scoop on the right IFS at about 1:30 passes the ACC valve and is sprayed onto the HPT and LPT cases from ring manifolds. Shrinking the cases closes the blade tip clearances in cruise, saving fuel; the valve is closed for takeoff and most of the climb.' });
    /* p.270-273: the ACC air valve at 1 o'clock near the rear of the HPC (it was over the HPT until 2026-10-07), fed from the scoop on the
       right IFS; the HPT manifold a shroud band on the HPT case, the LPT manifold a band of spray tubes on the LPT case */
    { /* the HPT manifold band and its spray tubes stop either side of the AP-HPT 1 borescope port at 9 o'clock */
      const bs = { thetaStart: G.clock(9.25), thetaLength: TAU - (G.clock(9.25) - G.clock(8.75)) };
      PW.add('tacc', G.revolve([[-1.915, .258], [-2.015, .262], [-2.015, .286], [-1.915, .282]], { seg: 128, crease: 60, ...bs }), 'nickel');                // HPT manifold
      for (const xx of [-1.93, -1.965, -2.0]) PW.add('tacc', G.revolve(circ(xx, .29, .006, 8), { seg: 128, ...bs }), 'nickel');
      /* the LPT spray rings stop either side of 6 o'clock, their ends closed, leaving the gap the No. 5/6 bearing oil tubes and the
         deoiler vent duct run through (the gap is inferred: the manual's render shows only the top of the manifolds) */
      /* the photos from below show them as round polished tubes, with orange sleeves on their ends; they were square bars until
         2026-10-14 */
      { const ga = G.clock(5.72), gb = G.clock(6.28), sl = [];
        for (const xx of [-2.25, -2.32, -2.39]) { const rr = Math.max(rCase(xx), .24) + .025;
          PW.add('tacc', G.revolve(circ(xx, rr, .011, 10), { seg: 128, thetaStart: gb, thetaLength: TAU - (gb - ga) }), 'stainless');
          for (const a of [ga - .09, gb + .09]) sl.push(G.revolve(circ(xx, rr, .0135, 10), { seg: 6, thetaStart: a - .05, thetaLength: .1 })); }
        PW.add('tacc', G.merge(sl), 'clampOrange', { solid: true }); }
      { const band = []; for (let i = 0; i <= 8; i++) { const xx = -2.236 - .168 * i / 8; band.push([xx, rCase(xx) + .004]); }                         // the band under the LPT spray tubes
        PW.add('tacc', G.revolve(G.shellProfile(band.map(([xx, r]) => [xx, r + .005]), band), { seg: 128 }), 'nickel'); }
      const xT = D.GEN.externals.lptCaseTorus; PW.add('tacc', G.revolve(circ(xT.x, xT.r_centre, xT.tube_od / 2, 10), { seg: 128 }), 'steel');
      /* the valve, from p.273's render: a cast butterfly body bolted between flanges; at its forward end an elbow turns out to a large
         flanged inlet ring facing the IFS scoop; on top the fuel-powered servo valve and torque motor housing, with the servo fuel
         ports from the IFPC, the torque motor connector and the single-channel LVDT to EEC channel A beside it. Aft, a short duct drops
         into a plenum sitting on the HPT manifold, which feeds it directly, and a smaller tube with a flexible bellows section carries
         on aft to the LPT manifold */
      const f = Kt.frame('tacc', -1.64, 1.2, .40);
      Kt.cyl('tacc', f, [0, 0, 0], 'x', .046, .11, 'castAl', { edge: .006 });                                                 // butterfly body
      for (const s of [-1, 1]) Kt.flange('tacc', f, [s * .058, 0, 0], s > 0 ? 'x' : '-x', .03, .058, .01, 10, 'castAl');     // bolted end flanges
      Kt.cyl('tacc', f, [0, -.046, 0], 'y', .012, .012, 'castAl'); Kt.hex('tacc', f, [0, -.054, 0], '-y', .006, .005, 'steel');   // butterfly shaft boss underneath
      /* inlet elbow and its ring, turned outward toward the scoop at 1:30 */
      f.updateMatrixWorld(true); const L = (x, y, z) => f.localToWorld(V(x, y, z));
      const inD = V(-.1, .55, .83).normalize(), ringC = V(.088, .05, .07), onIn = s => ringC.clone().addScaledVector(inD, s);   // clear of the right thrust link at 1 o'clock
      line('tacc', [L(.063, 0, 0), L(.08, .006, .008), L(.088, .025, .035), L(...onIn(-.01).toArray())], .036, 'tube', { clamps: 0, ends: false, mat: 'castAl' });
      Kt.tube('tacc', f, ringC.toArray(), inD, .036, .056, .012, 'castAl'); Kt.bolts('tacc', f, onIn(.008).toArray(), inD, .047, 10, .004);
      Kt.tube('tacc', f, onIn(-.003).toArray(), inD, .056, .061, .009, 'gasketOrange');                                     // the orange silicone seal band on the ring (photo)
      /* servo valve and torque motor housing on top, with its bolted cover */
      Kt.box('tacc', f, [-.005, .056, .015], [.085, .04, .065], 'castAl', { round: .008 });
      for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) Kt.hex('tacc', f, [-.005 + a * .034, .077, .015 + b * .025], 'y', .0035, .003, 'steel');
      Kt.cyl('tacc', f, [-.012, .084, .02], 'y', .019, .018, 'darkBox', { edge: .003 });                                     // torque motor
      Kt.connector('tacc', f, [-.012, .094, .02], 'y', .008, { lead: '-x' });                                                 // its connector, backshell aft, away from the thrust link and the scoop tube
      Kt.cyl('tacc', f, [-.02, .05, -.035], 'x', .012, .06, 'steel'); Kt.cyl('tacc', f, [-.052, .05, -.035], 'x', .008, .006, 'steel');   // LVDT
      Kt.connector('tacc', f, [.015, .05, -.035], 'x', .008, { lead: '-z' });
      for (const z of [-.01, .012]) Kt.fitting('tacc', f, [.037, .07, z], 'x', .006);                                          // servo fuel in and out, high enough to clear the inlet flange and elbow
      Kt.plate('tacc', f, [-.01, .056, .0476], 'z', 'y', .04, .025);
      line('tacc', [P(-1.62, 1.6, .545), P(-1.60, 1.62, .51), L(...onIn(.045).toArray()), L(...onIn(.007).toArray())], .036, 'tube', { clamps: 0, ends: false, mat: 'castAl' });   // from the IFS scoop to the inlet ring
      /* outlet: duct to the plenum on the HPT manifold, between the 6th-stage HPT cooling tubes at 0:51 and 1:36 */
      line('tacc', [P(-1.702, 1.2, .40), P(-1.77, 1.2, .385), P(-1.84, 1.22, .36), P(-1.885, 1.225, .345)], .033, 'tube', { clamps: 1, ends: false });
      { const g = Kt.frame('tacc', -1.93, 1.225, .307); Kt.box('tacc', g, [0, 0, 0], [.07, .04, .075], 'nickel', { round: .012 });
        Kt.flange('tacc', g, [.03, .012, 0], 'x', .022, .036, .008, 6, 'nickel'); }
      const lp = line('tacc', [P(-1.965, 1.25, .32), P(-2.02, 1.29, .38), P(-2.08, 1.33, .45), P(-2.15, 1.4, .50), P(-2.21, 1.44, .515), P(-2.245, 1.45, .516)], .026, 'tube', { clamps: 1, ends: false });   // to the LPT manifold
      { const t0 = tAt(lp, -2.06); PW.add('tacc', G.alongCurve(lp, [0, 1, 2, 3, 4, 5, 6].map(k => t0 + k * .012), () => new THREE.TorusGeometry(.028, .005, 6, 20).rotateX(Math.PI / 2)), 'steel').userData.isLine = true; } }   // flexible bellows
    /* p.278-281: the split buffer system. Each unit sits at the position the manual gives (p.280); the ducts follow p.279's flow and
       p.281's render, their routes picked through the gaps at the top of the core */
    PW.part('buffer-air', { parent: 'air', label: 'Buffer air system', src: 'p.278-283',
      info: 'Cooling and pressurizing air for the bearing compartment seals. At high power, 2.5 (LPC exit) air feeds the front compartment (No. 1, 1.5 and 2 bearings), No. 3 and No. 5/6 through the buffer air check valve (BACV). Below 75 percent N1 the 2.5 air is too weak, so the EEC energizes the buffer air valve solenoid (BAVS), which opens the buffer air shutoff valve (BASOV) and sends 4th-stage HPC air instead; the BACV then closes so the 4th-stage air cannot flow back. The No. 4 bearing compartment always gets 4th-stage air, cooled by 2.5 air in the buffer air heat exchanger (BAHX). The buffer air pressure sensor (BAPS) downstream of the BASOV tells both EEC channels whether the valve is where it should be for the power setting.\n\nPositions: BAHX on the fan intermediate case in the 2.5 bleed cavity at 12 o\'clock, BACV at 12 o\'clock on the FIC, BAPS below the BAHX at 2 o\'clock, BASOV at the rear of the HPC at 11 o\'clock, BAVS on the right of the HPC case at 1 o\'clock.\n\nDucts: the BASOV\'s outlet runs forward over the HPC into the case to the buffer manifold at the BACV, where the BAPS reads it; a tube from the 4th-stage collar feeds the BAHX, and the cooled air comes back aft along the top of the core to the No. 4 bearing compartment at the turbine intermediate case. The BAHX and BACV sit inside the 2.5 bleed cavity, under the fan exit liner.' });
    { const f = Kt.frame('buffer-air', -.80, 12, .40);                                                                        // BAHX: plate-fin core in a cast frame, data plate on top
      Kt.box('buffer-air', f, [0, 0, 0], [.12, .07, .18], 'castAl', { round: .008 }); Kt.box('buffer-air', f, [0, .0, .0], [.09, .072, .15], 'darkBox', { round: .002 });
      for (let i = 0; i < 12; i++) Kt.box('buffer-air', f, [-.045 + i * .0082, .0365, 0], [.0025, .002, .14], 'nickel', { round: .0005 });
      Kt.plate('buffer-air', f, [.0, .036, .062], 'y', 'x', .05, .025);
      for (const s of [-1, 1]) { Kt.cyl('buffer-air', f, [-.07, .01, s * .05], 'x', .016, .02, 'castAl'); Kt.flange('buffer-air', f, [-.082, .01, s * .05], '-x', .016, .026, .005, 4, 'castAl'); } }   // 4th-stage air in (left) and out (right), both on the aft face
    { const f = Kt.frame('buffer-air', -.70, 12, .385);                                                                       // BACV: flanged check valve on its elbow
      Kt.cyl('buffer-air', f, [0, .012, 0], 'y', .03, .024, 'castAl'); Kt.flange('buffer-air', f, [0, .027, 0], 'y', .03, .045, .006, 6, 'castAl'); Kt.cyl('buffer-air', f, [0, .034, 0], 'y', .036, .006, 'nickel'); }
    { const f = Kt.frame('buffer-air', -.80, 1.9, .40);                                                                       // BAPS
      Kt.box('buffer-air', f, [0, .008, 0], [.03, .016, .03], 'steel', { round: .004 }); Kt.cyl('buffer-air', f, [0, .026, 0], 'y', .011, .022, 'steel'); Kt.connector('buffer-air', f, [0, .038, 0], 'y', .008, { lead: '-x' }); Kt.fitting('buffer-air', f, [.02, .008, 0], 'x', .006); }
    { const f = Kt.frame('buffer-air', -1.25, .85, .30);                                                                       // BAVS: solenoid on its mounting base, pilot air ports
      Kt.box('buffer-air', f, [0, .008, 0], [.06, .016, .045], 'steel', { round: .004 }); Kt.cyl('buffer-air', f, [-.01, .03, 0], 'x', .014, .06, 'steel', { edge: .003 });
      Kt.connector('buffer-air', f, [-.045, .03, 0], '-x', .008, { lead: 'y' }); for (const z of [-.012, .012]) Kt.fitting('buffer-air', f, [.03, .02, z], 'x', .006); }
    { const f = Kt.frame('buffer-air', -1.47, 11.03, .248);                                                                    // BASOV (p.281): upright on the rear HPC case, V-bands top and bottom
      Kt.box('buffer-air', f, [0, .006, 0], [.03, .012, .036], 'castAl', { round: .004 });                                      // mounting pad
      Kt.cyl('buffer-air', f, [0, .046, 0], 'y', .021, .066, 'castAl', { edge: .005 }); for (const y of [.018, .078]) Kt.vband('buffer-air', f, [0, y, 0], 'y', .017, { phase: Math.PI });
      Kt.fitting('buffer-air', f, [-.023, .05, 0], '-x', .006);                                                                  // pilot port from the solenoid
      Kt.cyl('buffer-air', f, [0, .1, 0], 'y', .017, .03, 'castAl'); Kt.flange('buffer-air', f, [0, .116, 0], 'y', .017, .027, .005, 4, 'castAl'); }   // outlet stub and flange
    /* p.281: the solenoid valve (BAVS) takes pilot air from the 4th-stage collar and, when the EEC energizes it, sends it over the top of
       the HPC to the BASOV's pilot port; the pressure sensor (BAPS) reads the buffer manifold at the BACV, downstream of the BASOV
       (p.278-279) */
    line('buffer-air', [P(-1.211, .78, .32), P(-1.195, .74, .322), P(-1.19, .5, .315), P(-1.19, 12.0, .312), P(-1.19, 11.7, .31), P(-1.30, 11.7, .305), P(-1.42, 11.7, .30), P(-1.46, 11.45, .335), P(-1.50, 11.25, .355), P(-1.53, 11.12, .365), P(-1.552, 10.96, .345), P(-1.55, 10.88, .315), P(-1.53, 10.9, .30), P(-1.515, 10.97, .298), P(-1.505, 11.03, .298)], .004, 'tube', { clamps: 3 });   // pilot to the BASOV: over the top, across the left core harness aft of the fuel/oil cooler, then over the HPT cooling tube beside the valve and into its aft-facing port
    line('buffer-air', [P(-1.211, .92, .32), P(-1.195, .95, .325), P(-1.25, .98, .328), P(-1.33, .98, .305), P(-1.395, .96, .287)], .004, 'tube', { clamps: 0 });   // pilot supply from the 4th-stage collar
    line('buffer-air', [P(-.771, 1.9, .408), P(-.752, 1.9, .41), P(-.735, 1.5, .418), P(-.725, 1.0, .42), P(-.72, .55, .418), P(-.71, .3, .405), P(-.70, .15, .399)], .004, 'tube', { clamps: 1 });   // BAPS sense line, to the BACV
    /* p.279 and p.281: three ducts join the core compartment to the 2.5 cavity, where the BAHX and the buffer manifold at the BACV sit.
       They enter it through bosses low on the CIC's aft cone, under the fuel/oil cooler's forward end; their passages through the case
       to the BAHX and the manifold are hidden. The BASOV's outlet turns forward from its top flange, over the pilot line and the left
       core harness, and runs forward at 11:41 under the cooler. A boss on the 4th-stage collar at 11:58 feeds the BAHX. Its cooled
       outlet runs aft low on the right of the top, under the engine bleed duct where that crosses over to the precooler, past the
       precooler's lower header and over WC05, down to a boss on the TIC over the No. 4 bearing compartment */
    { const boss = (h, rb, s) => { const xb = -.95 - (.515 - rb) * .83, f = Kt.frame('buffer-air', xb, h, rb);                    // on the cone's aft face, the port facing aft
        Kt.cyl('buffer-air', f, [.007, 0, 0], 'x', s * 1.6, .046, 'nickel', { edge: .003 }); Kt.fitting('buffer-air', f, [-.016, 0, 0], '-x', s); };
      boss(11.68, .36, .025); boss(11.97, .36, .02); boss(.6, .37, .02);
      const fc = Kt.frame('buffer-air', -1.44, 11.97, .282); Kt.box('buffer-air', fc, [0, .003, 0], [.034, .006, .034], 'nickel', { round: .004 }); Kt.fitting('buffer-air', fc, [0, .004, 0], 'y', .02);
      const ft = Kt.frame('buffer-air', -2.10, .13, .338); Kt.box('buffer-air', ft, [0, .003, 0], [.034, .006, .034], 'nickel', { round: .004 }); Kt.fitting('buffer-air', ft, [0, .004, 0], 'y', .02); }
    line('buffer-air', [P(-1.47, 11.03, .367), P(-1.47, 11.03, .392), P(-1.475, 11.25, .41), P(-1.47, 11.5, .40), P(-1.45, 11.66, .385), P(-1.40, 11.68, .366), P(-1.30, 11.68, .362),
      P(-1.20, 11.68, .36), P(-1.16, 11.68, .36), P(-1.1307, 11.68, .36)], .02, 'tube', { clamps: 2 });   // BASOV outlet into the case, to the buffer manifold
    line('buffer-air', [P(-1.44, 11.97, .315), P(-1.43, 11.97, .33), P(-1.38, 11.97, .345), P(-1.25, 11.97, .355), P(-1.16, 11.97, .36), P(-1.1237, 11.97, .36)], .015, 'tube', { clamps: 1 });   // 4th stage to the BAHX
    line('buffer-air', [P(-1.1154, .6, .37), P(-1.15, .58, .366), P(-1.20, .5, .352), P(-1.30, .45, .337), P(-1.42, .42, .332), P(-1.53, .42, .333), P(-1.60, .45, .345), P(-1.66, .55, .375),
      P(-1.72, .63, .41), P(-1.80, .6, .43), P(-1.85, .55, .44), P(-1.95, .40, .44), P(-2.02, .27, .42), P(-2.07, .17, .388), P(-2.10, .13, .371)], .015, 'tube', { clamps: 4 });   // BAHX to the No. 4 compartment, under the engine bleed duct
    /* p.276-277: four tubes take 6th-stage HPC air to the HPT 2nd stage vanes and blade attachments, two on each side, arching over the
       case from the 6th-stage ports to the HPT case just ahead of the clearance control manifold, metered by plates at the case */
    PW.part('hpt-cooling', { parent: 'air', label: 'HPT cooling air tubes (6th stage)', src: 'p.276-277',
      info: 'Four tubes carry 6th-stage HPC air to the HPT 2nd stage vanes and blade attachments. Metering plates between the tubes and the HPT case set the flow; the air passes through the hollow vanes and leaves at their trailing edges. The 4th-stage air that cools the TIC fairings, the LPT case and the LPT rotor and blade attachments goes through its own tubes (TIC and LPT cooling air tubes).' });
    /* p.277 draws one tube high and one low on each side. The right low one leaves its 6th-stage port at 3:49, between the cowl anti-ice
       boss, the borescope port and the gearbox's right arm, and runs aft under the oil control module, over the fuel manifolds, to the
       HPT case at 3:36 (it was the second high tube at 0:51 until 2026-10-14). The left low one would have to pass through the gearbox
       and its heat shield here, so it stays high at 10:27 */
    const boss = (xx, h, rr, s) => { s = s || .04; const g = Kt.frame('hpt-cooling', xx, h, rr); Kt.box('hpt-cooling', g, [0, .006, 0], [s, .012, s], 'nickel', { round: .006 }); Kt.bolts('hpt-cooling', g, [0, .013, 0], 'y', s * .5, 4, .0035, { phase: Math.PI / 4 }); };
    for (const h of [10.45, 11.15, 1.6]) {
      line('hpt-cooling', [P(-1.515, h, .251), P(-1.53, h, .30), P(-1.56, h, .345), P(-1.70, h, .357), P(-1.85, h, .357), P(-1.88, h, .32), P(-1.893, h, .27), P(-1.895, h, .245)], .015, 'tube', { clamps: 2, ends: false });
      boss(-1.515, h, .251); boss(-1.895, h, .245); }
    line('hpt-cooling', [P(-1.515, 3.80, .251), P(-1.53, 3.83, .30), P(-1.56, 3.79, .343), P(-1.62, 3.74, .351), P(-1.68, 3.70, .351), P(-1.72, 3.67, .354), P(-1.76, 3.64, .354), P(-1.83, 3.6, .345),
      P(-1.87, 3.6, .315), P(-1.89, 3.6, .27), P(-1.895, 3.6, .245)], .015, 'tube', { clamps: 2, ends: false });
    boss(-1.515, 3.80, .251, .03); boss(-1.895, 3.6, .245);                                                        // a smaller plate at the port, between the bosses either side
    /* p.276-277: 4th-stage air for the TIC fairings and transition ducts, the LPT case and the LPT rotor. Four supply tubes leave bolted
       bosses on the 4th-stage collar, two each side, and run aft through the gaps the gearbox, starter, coolers and oil tank leave to
       bosses on the TIC's forward face; two jumpers run round the TIC's aft cone, and four short ones arch over the TIC/LPT flange onto
       the LPT case. The figure's lower left tube is routed high on the left here, beside the upper one and under the air/oil cooler,
       since the gearbox arm, its mount link and the fuel feeds fill the space lower down; it drops to its TIC boss behind the starter
       air valve, where the figure has it */
    PW.part('tic-cooling', { parent: 'air', label: 'TIC and LPT cooling air tubes (4th stage)', src: 'p.276-277',
      info: 'HPC 4th-stage air cools the turbine intermediate case (TIC) fairings and its inner and outer walls (the transition ducts), the LPT case, and the LPT rotor and blade attachments. Four supply tubes take it from the 4th-stage ports to the TIC. Three jumper tubes carry it on through the TIC fairings to the LPT rotor and blade attachments, and three more feed the space between the LPT case and the 2nd stage vanes.\n\nThe manual\'s figure shows two supply tubes on each side; their exact clock positions here are approximate, routed through the space the accessories leave.' });
    { const r4 = D.GEN.rows.find(r => r.name.startsWith('HPC rotor 4')), x4 = (r4.x_le + r4.x_te) / 2, rc = rCase(x4) + .035;
      /* a bolted boss: s square, on the surface at (x, clock h, radius r), turned by rz to sit on a cone */
      const pad = (xx, h, rr, rz, s) => { s = s || .03; const g = Kt.frame('tic-cooling', xx, h, rr, { rz }); Kt.box('tic-cooling', g, [0, .004, 0], [s, .008, s], 'nickel', { round: .004 });
        Kt.bolts('tic-cooling', g, [0, .0095, 0], 'y', s * .45, 4, .0028, { phase: Math.PI / 4 }); };
      /* supply tubes: [clock at the collar, the route, clock at the TIC] */
      for (const [h0, mid, h1] of [
        [10.6, [P(x4 - .05, 10.68, .312), P(-1.53, 10.7, .32), P(-1.60, 10.7, .32), P(-1.66, 10.7, .33), P(-1.72, 10.7, .352), P(-1.78, 10.7, .345), P(-1.84, 10.7, .325), P(-1.92, 10.72, .325),
          P(-2.02, 10.77, .335), P(-2.06, 10.78, .352), P(-2.09, 10.8, .366)], 10.8],
        [10.25, [P(x4 - .048, 10.27, .30), P(-1.53, 10.25, .315), P(-1.62, 10.27, .33), P(-1.72, 10.3, .352), P(-1.80, 10.3, .345), P(-1.88, 10.25, .33), P(-1.94, 10.0, .32), P(-1.99, 9.4, .32),
          P(-2.03, 8.8, .32), P(-2.065, 8.4, .352), P(-2.09, 8.22, .372)], 8.2],
        [2.3, [P(x4 - .05, 2.28, .31), P(-1.55, 2.25, .322), P(-1.64, 2.22, .335), P(-1.72, 2.18, .352), P(-1.76, 2.16, .335), P(-1.80, 2.14, .322), P(-1.86, 2.12, .318), P(-1.92, 2.08, .32), P(-2.02, 1.92, .335),
          P(-2.075, 1.8, .368)], 1.8],
        [3.0, [P(x4 - .05, 3.0, .305), P(-1.55, 3.0, .318), P(-1.64, 3.0, .335), P(-1.72, 3.02, .352), P(-1.76, 3.04, .335), P(-1.80, 3.06, .32), P(-1.86, 3.15, .316), P(-1.92, 3.3, .315), P(-1.99, 3.8, .318),
          P(-2.04, 4.25, .338), P(-2.085, 4.55, .37)], 4.6]]) {
        pad(x4, h0, rc, 0);
        line('tic-cooling', [P(x4, h0, rc + .006), P(x4 - .012, h0 + (h0 > 10 ? .03 : 0), rc + .02)].concat(mid, [P(-2.106, h1, .374), P(-2.116, h1, .379)]), .010, 'tube', { clamps: 2, ends: false });
        pad(-2.1225, h1, .372, -.93); }
      /* the jumpers, from bosses on the TIC's aft cone */
      const xt = -2.165, rt = .463;
      for (const [ha, hb] of [[2.3, 4.3], [7.9, 9.6]]) { pad(xt, ha, rt, -.72, .024); pad(xt, hb, rt, -.72, .024);
        const pts = [P(xt + .006, ha, rt + .01), P(xt + .003, ha + (hb - ha) * .05, .484)]; for (let i = 1; i < 8; i++) pts.push(P(xt, ha + (hb - ha) * i / 8, .489));
        pts.push(P(xt + .003, hb - (hb - ha) * .05, .484), P(xt + .006, hb, rt + .01)); line('tic-cooling', pts, .007, 'tube', { clamps: 1, ends: false }); }
      for (const h of [.9, 5.1, 6.9, 11.1]) { pad(xt, h, rt, -.72, .024); pad(-2.224, h, .49, 0, .02);
        line('tic-cooling', [P(xt + .006, h, rt + .01), P(-2.166, h, .495), P(-2.19, h, .513), P(-2.214, h, .51), P(-2.224, h, .499)], .007, 'tube', { clamps: 0, ends: false }); } }
    PW.part('cai', { parent: 'air', label: 'Cowl anti-ice duct and valves', src: 'p.10-11, p.264; TTM ch. 30; A Nahas photos',
      info: 'HPC 6th-stage bleed for the inlet lip. From its 6th-stage port on the right of the HPC it runs round the right of the core and turns down into the lower bifurcation, where it passes the upper and lower cowl anti-ice valves in series (two for redundancy), just aft of the LPC vane actuator. Each valve is controlled and monitored by the EEC from the L and R COWL switches (OFF, AUTO, ON). The duct crosses the fan duct in the bifurcation and runs forward along the bottom right of the fan case into the inlet at 5 o\'clock, where its access panel is. The air leaves through the exhaust louvres at the bottom of the inlet. The valves also open during the start to help the HPC bleed valve unload the compressor.\n\nThe black hose with orange fittings along the fan case in the photos.' });
    { /* 6th-stage port on the right of the HPC, round the right of the core and down into the lower bifurcation at 6 o'clock through the
         two valves, forward under the reverser to the fan case and along it at 5 o'clock */
      /* it passes over the hydraulic pump hoses and the actuator drain lines where they cross under it on the right of the core, and
         through the bifurcation panel low and in the middle, under the W04 harness and igniter cable A */
      /* from the port it runs forward under the oil control module before rising in front of it */
      const pts = [P(-1.53, 3.4, .262), P(-1.528, 3.4, .30), P(-1.51, 3.41, .34), P(-1.47, 3.42, .355), P(-1.42, 3.44, .355), P(-1.385, 3.5, .385), P(-1.365, 3.62, .44), P(-1.36, 3.78, .47), P(-1.362, 3.95, .487), P(-1.38, 4.6, .508), P(-1.32, 5.3, .505), P(-1.22, 5.6, .497), P(-1.15, 5.85, .485), P(-1.11, 5.98, .52), P(-1.10, 6.0, .60),
        P(-1.08, 6.0, .76), P(-1.05, 6.0, .90), P(-1.03, 6.0, .975), P(-.985, 6.0, .995), P(-.93, 5.96, 1.0), P(-.88, 5.86, 1.008), P(-.833, 5.7, 1.04), P(-.78, 5.52, 1.055), P(-.62, 5.1, 1.035), P(-.55, 5.0, 1.03), P(.20, 5.0, 1.0), P(.34, 5.0, 1.03)];
      const c = line('cai', pts, .03, 'black', { clamps: 6 });
      PW.add('cai', G.alongCurve(c, [tAt(c, -.985)], () => new THREE.CylinderGeometry(.036, .036, .07, 20)), 'rubber', { mat: { color: '#9cc6e8' } }).userData.isLine = true;   // light blue sleeve where it passes the bifurcation panel (photo)
      { const pb = Kt.frame('cai', -1.53, 3.4, .247); Kt.box('cai', pb, [0, .006, 0], [.07, .012, .07], 'castAl', { round: .006 }); Kt.bolts('cai', pb, [0, .013, 0], 'y', .03, 4, .004, { phase: Math.PI / 4 }); }   // 6th-stage port boss
      /* the upper and lower valves (A Nahas photo of the core's right side): in series where the duct turns down into the lower
         bifurcation, just aft of the LPC vane actuator, the upper one first in the flow (TTM 30 fig. 4 is only a schematic). Each is a
         butterfly valve between bolted flanges, with its actuator, position indicator and solenoid. The bifurcation is only about 11 cm
         wide there, so they face forward, the solenoids on opposite sides; the leads go up into WC08 */
      const atR = rr => { let best = 0, bd = 9; for (let k = 0; k <= 800; k++) { const p = c.getPointAt(k / 800); if (p.x < -1.13 || p.x > -1.04) continue; const d = Math.abs(Math.hypot(p.y, p.z) - rr); if (d < bd) { bd = d; best = k / 800; } } return best; };
      const Lv = [];
      for (const [i, rr, zs] of [[1, .585, .032], [2, .705, -.032]]) {
        const t = atR(rr), O = c.getPointAt(t), Y = c.getTangentAt(t).normalize(), X = new THREE.Vector3().crossVectors(Y, V(0, 0, 1)).normalize(), Z = new THREE.Vector3().crossVectors(X, Y);
        const f = new THREE.Group(); f.position.copy(O); f.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z)); PW.parts.get('cai').obj.add(f);   // x aft, y down the duct, z to the right
        Kt.cyl('cai', f, [0, 0, 0], 'y', .036, .05, 'castAl', { edge: .004 });                                                  // valve body
        for (const s of [-1, 1]) Kt.flange('cai', f, [0, s * .029, 0], s > 0 ? 'y' : '-y', .03, .046, .007, 8, 'castAl');
        Kt.cyl('cai', f, [-.042, 0, 0], '-x', .011, .016, 'castAl');                                                            // shaft boss
        Kt.cyl('cai', f, [-.066, 0, 0], '-x', .021, .034, 'castAl', { edge: .004 });                                             // actuator
        Kt.cyl('cai', f, [-.0845, 0, 0], '-x', .016, .003, 'plateAl'); Kt.box('cai', f, [-.0865, .004, 0], [.0015, .02, .003], 'capBlack', { round: .0008, rot: [i * .8, 0, 0] });   // position indicator
        Kt.box('cai', f, [-.064, 0, zs], [.03, .026, .022], 'darkBox', { round: .004 });                                        // solenoid
        Kt.connector('cai', f, [-.079, 0, zs], '-x', .007, { lead: '-y' });
        Lv.push((a, b, d) => O.clone().addScaledVector(X, a).addScaledVector(Y, b).addScaledVector(Z, d)); }
      line('cai', [Lv[0](-.0923, -.0126, .032), Lv[0](-.0923, -.035, .032), Lv[0](-.09, -.06, .03), P(-1.04, 5.95, .47), P(-1.075, 5.97, .40), P(-1.105, 5.99, .36), P(-1.124, 5.995, .348)], .005, 'harness', { clamps: 0, ends: false });   // upper valve into WC08
      line('cai', [Lv[1](-.0923, -.0126, -.032), Lv[1](-.0923, -.04, -.034), Lv[0](-.092, 0, -.036), Lv[0](-.09, -.06, -.034), P(-1.04, 6.05, .47), P(-1.075, 6.03, .40), P(-1.108, 6.012, .358), P(-1.126, 6.005, .347)], .005, 'harness', { clamps: 0, ends: false });   // lower valve, up past the upper one
      for (const p of [P(-.62, 5.1, 1.035), P(.20, 5.0, 1.0)]) { const m = new THREE.Mesh(G.can(.042, .09)); m.position.copy(p); PW.add('cai', m, 'clampOrange', { solid: true }); } }

    /* ============================== ELECTRICAL AND CONTROL ============================== */
    PW.part('eec', { label: 'Electronic engine control (EEC)', explode: [0, 0, -.6], src: 'p.74-95, p.104-105; photos',
      info: 'Dual-channel FADEC computer on the left side of the fan case at 9 o\'clock, on four vibration isolators, cooled by fan compartment air. Each channel has a control and a protection processor. It sets thrust, schedules fuel, vanes, bleeds and clearance control, runs starts and the reverser logic, and stores faults.\n\nThe data storage unit plugged into it holds the engine rating and trim data; it stays with the engine if the EEC is changed. Eight connectors: check them seated and locked after any EEC work. After a new EEC is installed, the EEC SYSTEM TEST must be run through the OMS, one channel at a time, and checked through both channels (p.182).' });
    /* p.105, p.91 and Brian's photo: a grey box about 0.6 m long fore and aft on the left of the fan case, about a third of the way aft,
       on four isolator feet; four connectors on its upper face and four on its lower, with stainless backshells and braided harnesses;
       a THIS SIDE UP placard, a black data plate and a white label; two pressure sense fittings at its forward end; the DSU in J99.
       The separate box right behind it is the PHMU */
    { const ex = -.08, eh = 9, er = 1.045, f = Kt.frame('eec', ex, eh, er);
      Kt.box('eec', f, [.03, 0, 0], [.46, .095, .22], 'eecGrey', { round: .012 });
      for (const [ax, az] of [[.285, .085], [.285, -.085], [-.23, .085], [-.23, -.085]]) { Kt.box('eec', f, [ax, -.036, az], [.06, .012, .045], 'eecGrey', { round: .004 });
        Kt.cyl('eec', f, [ax + Math.sign(ax) * .012, -.026, az], 'y', .016, .02, 'eecGrey'); Kt.hex('eec', f, [ax + Math.sign(ax) * .012, -.014, az], 'y', .006, .006, 'steel');
        /* the channel bracket each foot's isolator stands on, bonded to the composite case (r 0.97) */
        Kt.box('eec', f, [ax, -.075, az], [.06, .008, .05], 'lime', { round: .002 }); Kt.box('eec', f, [ax, -.0435, az], [.06, .003, .05], 'lime', { round: .001 });
        for (const s of [-1, 1]) Kt.box('eec', f, [ax + s * .022, -.057, az], [.004, .03, .045], 'lime', { round: .001 }); }
      for (const x of [.18, .1, -.02, -.1]) for (const s of [1, -1]) Kt.connector('eec', f, [x, 0, s * .11], s > 0 ? 'z' : '-z', .017);
      Kt.placard('eec', f, [.02, .0485, 0], 'y', 'z', .06, .07, 'thisSideUp');
      Kt.label('eec', f, [.19, .0479, -.02], 'y', 'z', .05, .03, 'dataBlack'); Kt.label('eec', f, [.12, .0479, -.02], 'y', 'z', .04, .045, 'white');   // black data plate and white label (photo)
      /* p.94-95, p.102 and the A Nahas photo: the two pneumatic ports on the EEC's lower edge. The P2 port, under the forward pair of
         lower connectors, takes the P2 sense line from the inlet's P2/T2 probe; the ambient pressure port, under the aft pair, is a
         small oval boss with a screen and no line, feeding the Pamb sensor inside (channel A) */
      Kt.fitting('eec', f, [.14, -.03, -.11], '-z', .007);
      Kt.box('eec', f, [-.06, -.03, -.112], [.016, .01, .006], 'eecGrey', { round: .003 }); Kt.cyl('eec', f, [-.06, -.03, -.1155], '-z', .0035, .001, 'darkBox');
      PW.part('dsu', { parent: 'eec', label: 'Data storage unit (DSU)', src: 'p.90-91, p.104-105',
        info: 'Small round plug, a Hamilton Sundstrand DSU1230-1, in connector J99 on the face of the EEC, on a lanyard. It holds the engine serial number and the rating and trim data in flash memory, read by both channels\' protection processors. It stays with the engine: when an EEC is changed, the new EEC reads the engine\'s data from it. With no DSU fitted the EEC will not allow an engine start on the ground; if it disconnects in flight, the EEC carries on with the programming in its own memory (p.90). An incorrectly installed DSU can affect engine operation (p.94 caution).' });
      const g = Kt.frame('dsu', ex, eh, er); Kt.cyl('dsu', g, [-.07, .052, .07], 'y', .021, .012, 'steel', { edge: .003 }); Kt.cyl('dsu', g, [-.07, .061, .07], 'y', .018, .008, 'capBlack', { edge: .002 });
      /* its lanyard, over the EEC's face to the support rail (p.91, p.95) */
      const ly = [[-.07, .057, .05], [-.15, .056, .045], [-.215, .045, .035], [-.25, .01, .03], [-.263, -.022, .027]];
      for (let i = 1; i < ly.length; i++) Kt.rod('dsu', g, ly[i - 1], ly[i], .0013, 'steel');
      /* the EEC/PHMU support rail (p.91, p.95, p.105; Brian's photo): a lime bracket standing on the case between the EEC's aft isolators
         (on its forward side) and the PHMU's forward ones (on its aft side), with a row of oval cutouts and three finger-type harness
         comb clamps along its top */
      Kt.arcLoft('eec', [{ h: 8.7, x: -.347, w: .008, ri: .97, ro: 1.02, n: 6 }, { h: 9.3, x: -.347, w: .008, ri: .97, ro: 1.02, n: 6 }], 'lime');
      Kt.arcLoft('eec', [{ h: 8.7, x: -.347, w: .04, ri: .97, ro: .975, n: 6 }, { h: 9.3, x: -.347, w: .04, ri: .97, ro: .975, n: 6 }], 'lime');   // its foot on the case
      for (let i = 0; i < 5; i++) { const fo = Kt.frame('eec', -.3515, 8.78 + i * .11, .996); Kt.box('eec', fo, [0, 0, 0], [.001, .018, .03], 'darkBox', { round: .008 }); }   // oval cutouts
      for (const h of [8.82, 9.0, 9.18]) { const fc = Kt.frame('eec', -.347, h, 1.02);
        Kt.box('eec', fc, [0, .004, 0], [.014, .008, .028], 'lime', { round: .002 }); for (const s of [-1, 0, 1]) Kt.box('eec', fc, [0, .016, s * .011], [.01, .018, .004], 'lime', { round: .0015 }); } }
    PW.part('harnesses', { label: 'Engine harnesses', explode: [0, .25, 0], src: 'p.102-107; photos',
      info: 'Braided harnesses from the EEC to every sensor, valve and actuator, clipped to the fan case on lime-green stand-offs. WF01 and WF02 bring the aircraft connections down from the pylon to the EEC; W03 and W04 run from the EEC along the bottom of the fan case into the core; WC05 rings the turbine exhaust for the EGT probes and WC08 runs over the HPC (p.105, p.107). Chafe at clamps and connector security are the usual findings.' });
    /* p.105 (traced at 300 dpi) and the photos. Five connectors on a bracket at 12 o'clock form the aircraft interface. WF02 and WF01
       come down the left of the case from the first four, held by a ladder of three clamp brackets, and split to the EEC's forward and
       aft pairs of upper connectors. W04 leaves the forward pair of lower connectors and runs down the forward part of the case to the
       bottom; W03 leaves the aft pair and runs diagonally down and aft; both go aft along the bottom, lift over the mount ring, cross
       under the reverser, go down the lower bifurcation at x -1.29 and into the core, where WC08 and WC05 branch off. The PHMU's upper
       connector ties into WF01 and its lower one into W03; the ignition exciter's power comes off W03 too. The fifth interface
       connector feeds a run down the right of the case to the door opening powerpack. Orange sleeves identify each run near its
       connectors. The harnesses ride 27 mm off the composite case (r 0.97) */
    { const rc = .97, rh = .999, eT = 9.3135, eB = 8.6865, eR = 1.0592;                     // the EEC backshell ends, upper and lower
      const harn = (pts, r, o) => line('harnesses', pts, r, 'harness', Object.assign({ clamps: 0, ends: false, tension: .3 }, o || {}));
      const standoff = (x, h, d, rr) => { const f = Kt.frame('harnesses', x, h, rc), y = (rr || .014) + .013;
        Kt.box('harnesses', f, [0, .006, 0], [.026, .012, .02], 'lime', { round: .003 }); Kt.box('harnesses', f, [0, y * .55, 0], [.006, y * .8, .016], 'lime', { round: .001 });
        Kt.tube('harnesses', f, [0, y, 0], d, (rr || .014) + .0005, (rr || .014) + .0045, .012, 'lime'); };
      /* stand-offs at every other point of a run's on-case stretch (points given as [x, clock]) */
      const stands = (xh, rr) => { for (let i = 1; i < xh.length - 1; i += 2) standoff(xh[i][0], xh[i][1], [xh[i + 1][0] - xh[i - 1][0], 0, rh * G.clock(xh[i + 1][1] - xh[i - 1][1])], rr); };
      const onCase = xh => xh.map(([x, h]) => P(x, h, rh));
      /* the aircraft interface: five connectors on a bracket at 12 o'clock, backshells turned down the sides */
      { const f = Kt.frame('harnesses', .02, 12, rc); Kt.box('harnesses', f, [-.005, .004, 0], [.29, .008, .05], 'lime', { round: .003 });
        for (const xi of [.11, .05, 0, -.06]) Kt.connector('harnesses', f, [xi, .008, 0], 'y', .014, { lead: '-z' });
        Kt.connector('harnesses', f, [-.12, .008, 0], 'y', .014, { lead: 'z' }); }
      const iT = 11.952, iR = 1.005;                                                                   // their backshell ends
      /* WF02 and WF01: legs from the interface, the trunks down the case, legs into the EEC */
      for (const [xa, xb, xt, xe1, xe2] of [[.13, .07, .10, .10, .02], [.02, -.04, -.10, -.10, -.18]]) {
        for (const xi of [xa, xb]) harn([P(xi, iT, iR), P(xi + (xt - xi) * .2, 11.9, 1.0), P(xi + (xt - xi) * .7, 11.83, rh), P(xt, 11.78, rh)], .012, { bands: [.35] });
        const trunk = [[xt, 11.78], [xt, 11.4], [xt, 11.0], [xt, 10.6], [xt, 10.2], [xt, 9.85]]; harn(onCase(trunk), .016);
        for (const xe of [xe1, xe2]) harn([P(xt, 9.85, rh), P(xt + (xe - xt) * .6, 9.6, 1.01), P(xe, 9.42, 1.04), P(xe, eT, eR)], .012, { bands: [.7] }); }
      /* the ladder: three lime-green brackets across both trunks, a cushioned loop round each */
      for (const h of [11.2, 10.6, 10.0]) { const f = Kt.frame('harnesses', 0, h, rc);
        Kt.box('harnesses', f, [0, .008, 0], [.27, .006, .018], 'lime', { round: .002 }); for (const s of [-1, 1]) Kt.box('harnesses', f, [s * .125, .0025, 0], [.02, .005, .024], 'lime', { round: .001 });
        for (const xt of [.10, -.10]) Kt.tube('harnesses', f, [xt, .029, 0], 'z', .0165, .0205, .014, 'lime'); }
      /* W04 from the forward lower pair, W03 from the aft lower pair; on the bottom W04 runs right of 6 o'clock and W03 left of it */
      const w04 = [[.065, 8.15], [.06, 7.7], [.04, 7.2], [.0, 6.75], [-.06, 6.4], [-.15, 6.12], [-.28, 5.96], [-.45, 5.94], [-.58, 5.94]];
      const w03 = [[-.135, 8.2], [-.19, 7.9], [-.25, 7.55], [-.31, 7.15], [-.37, 6.75], [-.43, 6.4], [-.49, 6.15], [-.55, 6.06], [-.6, 6.06]];
      for (const [xe, xm, hb] of [[.10, .065, 8.15], [.02, .065, 8.15], [-.10, -.135, 8.2], [-.18, -.135, 8.2]])
        harn([P(xe, eB, eR), P(xe, 8.58, 1.04), P(xe + (xm - xe) * .5, 8.4, 1.01), P(xm, hb, rh)], .012, { bands: [.3] });
      /* over the mount ring, forward through the bifurcation panel at x -0.985 (orange boots), down inside the bifurcation to the core */
      for (const [run, dh] of [[w04, -.05], [w03, .05]]) { const h6 = 6 + dh * 1.15;
        const c = harn(onCase(run).concat([P(-.66, h6, 1.025), P(-.74, 6 + dh * 1.3, 1.045), P(-.86, 6 + dh * 2.6, 1.068), P(-.985, 6 + dh * 3.2, 1.056), P(-1.06, 6 + dh * 2.9, 1.045), P(-1.12, 6 + dh * 2.8, 1.0),
          P(-1.18, 6 + dh * 2.8, .9), P(-1.24, 6 + dh * 2.4, .76), P(-1.29, 6 + dh * 1.6, .62), P(-1.31, 6.08 + dh * .6, .535), P(-1.335, 6.35 + dh * .5, .49), P(-1.35, 6.9, .42)]), .016, { clamps: 4 });
        PW.add('harnesses', G.alongCurve(c, [tAt(c, -.985)], () => new THREE.CylinderGeometry(.024, .024, .036, 16)), 'silicone').userData.isLine = true;
        stands(run, .016); }
      /* the fixed panel closing the forward end of the lower bifurcation (photo from below): engine-mounted, so it stays when the
         reverser doors open */
      PW.part('bif-panel', { parent: 'harnesses', label: 'Lower bifurcation pass-through panel', src: 'p.24, p.50; photos',
        info: 'Stainless panel closing the forward end of the lower bifurcation. It is fixed to the engine, so it stays in place when the reverser doors open. The cowl anti-ice duct (with its light blue sleeve), the two ignition cables and the W03 and W04 harnesses pass forward through it from the core to the fan case, the cables and harnesses in orange silicone boots.' });
      PW.add('bif-panel', G.revolve([[-.982, .955], [-.988, .955], [-.988, 1.075], [-.982, 1.075]], { seg: 10, thetaStart: Math.PI - .115, thetaLength: .23 }), 'nickel');
      PW.add('bif-panel', G.revolve([[-.978, 1.065], [-.992, 1.065], [-.992, 1.077], [-.978, 1.077]], { seg: 10, thetaStart: Math.PI - .115, thetaLength: .23 }), 'nickel');
      for (const h of [5.785, 5.955, 6.045, 6.215]) { const f = Kt.frame('bif-panel', -.98, h, 1.071); Kt.hex('bif-panel', f, [.002, 0, 0], 'x', .004, .004, 'steel'); }   // fasteners clear of the boots
      /* the PHMU's two connectors (backshell ends at 9.277 and 8.723 o'clock, r 1.056), the exciter's power lead */
      harn([P(-.50, 9.277, 1.056), P(-.50, 9.42, 1.03), P(-.45, 9.75, 1.0), P(-.33, 10.05, rh), P(-.2, 10.25, rh), P(-.115, 10.3, rh)], .01, { bands: [.12] });
      harn([P(-.50, 8.723, 1.056), P(-.49, 8.58, 1.03), P(-.42, 8.36, 1.0), P(-.33, 8.25, rh), P(-.24, 8.05, rh), P(-.19, 7.93, rh)], .01, { bands: [.12] });
      /* down the right of the case to the door opening powerpack's motor connector */
      { const run = []; for (let i = 0; i <= 10; i++) run.push([-.12 - .28 * i / 10, 12.2 + 1.8 * i / 10]);
        harn([P(-.10, 12.048, iR), P(-.115, 12.12, 1.0)].concat(onCase(run), [P(-.44, 14.06, 1.02), P(-.464, 14.094, 1.041)]), .012, { bands: [.04, .97] }); stands(run); }
      /* the P2/T2 probe harness from the inlet's disconnect at flange A to WF02 (the inlet side is built with the probe) */
      { const g = Kt.frame('harnesses', .33, 11.1, rc); Kt.cyl('harnesses', g, [0, .046, 0], 'x', .011, .02, 'connector', { edge: .002 }); }
      harn([P(.32, 11.1, 1.016), P(.29, 11.1, 1.01), P(.22, 11.15, rh), P(.14, 11.25, rh), P(.105, 11.3, rh)], .008, { bands: [.1] });
      /* the P2 sense line from the probe's pneumatic disconnect beside it at flange A (p.102): a bare tube down the case just aft of the
         forward flange, then a braided flexible line aft and up under the EEC to its P2 port (the photos) */
      { const g = Kt.frame('harnesses', .33, 10.95, rc); Kt.cyl('harnesses', g, [0, .046, 0], 'x', .007, .018, 'steel'); Kt.hex('harnesses', g, [-.01, .046, 0], 'x', .007, .006, 'steel'); }
      { const E = FLa(-.08, 9, 1.045);
        line('harnesses', [P(.322, 10.95, 1.016), P(.315, 10.7, 1.015), P(.305, 10.25, 1.015), P(.30, 9.7, 1.015), P(.295, 9.2, 1.015), P(.29, 8.75, 1.015), P(.28, 8.55, 1.015)], .004, 'tube', { clamps: 3 });
        line('harnesses', [P(.28, 8.55, 1.015), P(.24, 8.52, 1.018), P(.19, 8.55, 1.02), E(.14, -.03, -.165), E(.14, -.03, -.135), E(.14, -.03, -.12015)], .0045, 'hose', { clamps: 0, ends: true, mat: 'braid' }); }
      /* the powerpack's second connector into the run that serves its motor connector */
      harn([P(-.491, 2.26, 1.11), P(-.47, 2.26, 1.11), P(-.45, 2.15, 1.07), P(-.43, 2.06, 1.025)], .006);
      /* the left core harness from the junction at the bottom (p.105): up the left forward of the IFPC, over the layshaft, past the Pb
         sensor and over the HPC to the top; WC05 branches from it and runs aft along the top in the pylon gap, over the clearance control
         manifolds, to the EGT probe junctions behind the LPT */
      line('harnesses', [P(-1.35, 6.9, .42), P(-1.215, 7.4, .38), P(-1.21, 8.2, .375), P(-1.25, 9.5, .325), P(-1.30, 10.1, .325), P(-1.35, 10.65, .315), P(-1.40, 11.1, .305), P(-1.445, 11.2, .305), P(-1.50, 11.42, .31), P(-1.58, 11.6, .31), P(-1.65, 11.9, .31), P(-1.68, 12.15, .31)], .012, 'harness', { clamps: 4 });   // under the FOHX end plate, left of the 4th-stage bleed duct
      line('harnesses', [P(-1.0606, 10.16, .413), P(-1.09, 10.1, .385), P(-1.13, 10.0, .375), P(-1.18, 9.8, .345), P(-1.22, 9.62, .33), P(-1.245, 9.55, .326)], .006, 'harness', { clamps: 0, ends: false });   // Pb sensor
      /* WC08 (p.107) up the right of the core along the CIC fire seal, under the 2.5 bleed and LPC vane actuators and behind the N1
         probe, to 1 o'clock; branches to the N1 probe's two connectors, the P2.5/T2.5 probe and, aft over the HPC, the T3 probe */
      line('harnesses', [P(-1.35, 6.9, .42), P(-1.3, 6.7, .40), P(-1.2, 6.3, .36), P(-1.13, 6.0, .349), P(-1.115, 5.5, .342), P(-1.115, 5.0, .34), P(-1.115, 4.5, .34), P(-1.115, 4.0, .34),
        P(-1.115, 3.5, .34), P(-1.115, 3.0, .34), P(-1.115, 2.5, .34), P(-1.115, 2.0, .34), P(-1.115, 1.5, .34), P(-1.115, 1.2, .34)], .011, 'harness', { clamps: 5, ends: false, bands: [.03] });
      for (const dx of [-.009, .009]) line('harnesses', [P(-1.065 + dx, 4.8, .41), P(-1.09 + dx * .5, 4.86, .38), P(-1.112, 4.92, .345)], .005, 'harness', { clamps: 0, ends: false });   // N1 probe
      line('harnesses', [P(-1.0355, 1.19, .486), P(-1.05, 1.22, .47), P(-1.09, 1.22, .40), P(-1.115, 1.2, .35)], .006, 'harness', { clamps: 0, ends: false });                  // P2.5/T2.5 probe
      line('harnesses', [P(-1.115, 1.2, .34), P(-1.2, 1.1, .33), P(-1.35, 1.05, .327), P(-1.5, 1.02, .31), P(-1.6, 1.0, .295), P(-1.645, 1.0, .287)], .007, 'harness', { clamps: 3, ends: false });   // T3 probe
      /* the gearbox units (p.107 draws a cluster of branches round the gearbox; the photos from below show braided runs along its aft
         side). A trunk leaves W03/W04 where they come up from the bifurcation and runs aft under the MGB at about 6:30 to its aft face.
         There one branch takes the PMAG's two connectors and the VFG's left connector; one goes up the left of the starter to its speed
         sensor and on aft to the starter air valve; one crosses back under the VFG and up behind the right arm to the oil control module's connectors and the
         VFG's right connector. The VFG and hydraulic pump circuits belong to the aircraft (generator control unit, hydraulic system)
         and are assumed to join the bundle here. The VFG's feeder studs are left bare, as in the photo from below */
      { const leg = (pts, r) => line('harnesses', pts, r || .006, 'harness', { clamps: 0, ends: false });
        const T1 = P(-1.70, 6.64, .50), T2 = P(-1.80, 6.72, .49), T4 = P(-1.97, 8.2, .52), T6 = P(-1.70, 5.45, .48), T8 = P(-1.70, 4.4, .478), O = FLa(-1.575, 3.5, .40);   // O: the OCM's frame
        const vfgL = FLa(mx1, 6.15, VFG_R), atsL = FLa(mx1, ATS_H, ATS_R);                                                // points in the VFG's and starter's frames
        line('harnesses', [P(-1.35, 6.9, .42), P(-1.40, 6.82, .445), P(-1.47, 6.68, .495), P(-1.57, 6.62, .503), P(-1.62, 6.68, .505), P(-1.66, 6.68, .502), T1], .011, 'harness', { clamps: 3, ends: false });
        leg([T1, P(-1.76, 6.68, .498), T2], .009);
        const pmL = FLa(mx1, 7.15, .40);                                                                                  // points in the PMAG's frame
        leg([pmL(-.1471, .02, -.0322), pmL(-.1475, .022, -.055), P(-1.812, 6.82, .46), T2], .007);                             // PMAG, EEC channel A
        leg([pmL(-.1471, -.02, -.0322), pmL(-.148, -.02, -.055), P(-1.818, 6.86, .40), P(-1.82, 6.78, .45), P(-1.81, 6.74, .48), T2], .007);   // PMAG, channel B
        leg([pmL(-.1547, .0234, .024), pmL(-.1547, .045, .024), pmL(-.152, .06, 0), P(-1.81, 6.84, .47), T2], .008);        // PMAG generator winding, to the aircraft's fly-by-wire controller
        leg([vfgL(-.1816, 0, .1128), P(-1.852, 6.66, .452), P(-1.85, 6.74, .47), P(-1.83, 6.75, .484), T2]);                     // VFG J1
        leg([vfgL(-.1816, .06, .1128), P(-1.852, 6.6, .51), P(-1.85, 6.69, .508), P(-1.83, 6.73, .498), T2]);                   // VFG J2
        leg([T2, P(-1.83, 6.85, .50), P(-1.85, 7.3, .515), P(-1.90, 7.75, .53), P(-1.945, 8.05, .527), T4], .008);              // aft of the starter, clear of its housing
        const sTap = P(-2.05, 8.7, .526);
        leg([T4, P(-2.0, 8.45, .525), sTap, P(-2.068, 8.82, .53), P(-2.07, 8.85, .532)]);                                        // starter air valve torque motor
        leg([sTap, P(-2.0, 8.88, .52), P(-1.90, 8.9, .52), P(-1.80, 8.82, .51), P(-1.77, 8.7, .47), P(-1.75, 8.6, .43), atsL(-.0744, -.04035, .12369)]);   // starter speed sensor, up its far side
        leg([P(-1.57, 6.55, .502), P(-1.565, 6.2, .49), P(-1.565, 5.85, .49), P(-1.58, 5.62, .488), P(-1.64, 5.52, .485), T6], .009);   // forward of the VFG pad's lobe, then aft beyond it
        /* the oil control module, on the gearbox's right side: up behind the right arm to a run along the module's lower outboard edge,
           with a leg from each connector on its outboard face and the VORV's at its forward end; the active oil damper valve's from the
           top, down the module's aft end. The oil temperature probe on top takes the EGT harness (WC05) instead */
        leg([T6, P(-1.70, 5.1, .48), P(-1.70, 4.75, .478), T8], .009);
        leg([T8, P(-1.71, 4.15, .50), O(-.14, .09, .11), O(-.06, .09, .11), O(.03, .09, .11), O(.12, .09, .11), O(.135, .085, .093)], .008);
        leg([O(.1171, .04, .1312), O(.118, .06, .126), O(.118, .082, .113)]);                                                   // VORV/JOSV
        leg([O(.13, .1222, .0764), O(.13, .118, .095), O(.128, .096, .109)]);                                                   // MOP sensor
        leg([O(.105, .1112, .0344), O(.098, .108, .06), O(.095, .098, .09), O(.095, .092, .108)]);                              // oil debris monitor
        leg([O(.085, .1352, -.0256), O(.075, .13, -.005), O(.066, .118, .035), O(.066, .105, .08), O(.07, .093, .108)]);        // OFDP sensor
        leg([O(-.1276, .06, -.108), O(-.145, .061, -.107), O(-.162, .065, -.085), O(-.166, .072, -.03), O(-.163, .08, .05), O(-.152, .088, .1), O(-.14, .09, .11)]);   // active oil damper valve, down the aft end
        leg([P(-1.8438, 2.057, .435), P(-1.82, 2.05, .44), P(-1.765, 2.15, .45), P(-1.735, 2.4, .455), P(-1.736, 3.0, .462), P(-1.7375, 3.5, .47), P(-1.7375, 3.75, .48), O(-.14, .09, .11)]); }   // oil quantity sensor, down between the tank and the OCM
      line('harnesses', [P(-1.262, 6.22, .41), P(-1.24, 6.22, .405), P(-1.215, 6.27, .375), P(-1.20, 6.3, .36)], .006, 'harness', { clamps: 0, ends: false });   // hydraulic pump depressurising solenoid, into WC08
      /* the fuel units on the MGB front face into the left core harness as it passes forward of them: the IFPC's metering valve and
         overspeed solenoid, the fuel filter delta-P sensor at 7:30 and the flow meter at 9 o'clock (p.105, p.170) */
      { const leg = (pts, r) => line('harnesses', pts, r || .006, 'harness', { clamps: 0, ends: false }), J8 = P(-1.30, 7.7, .495);
        const Fh = FLa(mx0 + .055, 7.25, .46), I = FLa(mx0 + .16, 8.05, .44), M = FLa(mx0 + .055, 8.85, .43);
        leg([P(-1.40, 7.97, .515), P(-1.395, 7.86, .522), P(-1.36, 7.72, .523), P(-1.32, 7.66, .51), J8]);                                              // overspeed shutdown solenoid
        leg([Fh(.1232, -.0016, .08), Fh(.1232, .01, .08), P(-1.305, 7.64, .486), J8]);                                          // fuel filter delta-P, from its forward end
        leg([J8, P(-1.255, 7.62, .478), P(-1.228, 7.52, .45), P(-1.222, 7.46, .405), P(-1.215, 7.42, .385)], .008);
        leg([I(.1028, .0334, .03), I(.106, .015, .03), I(.112, -.015, .032), I(.117, -.045, .034), P(-1.21, 8.22, .378)]);       // fuel metering valve, under the metered fuel tube
        leg([M(.1443, 0, .025), M(.156, 0, .025), P(-1.268, 8.99, .428), P(-1.257, 9.1, .41), P(-1.252, 9.28, .375), P(-1.25, 9.5, .33)]); }   // fuel flow meter
      /* buffer air (p.278-283): the valve solenoid into the T3 branch beside it; the pressure sensor, ahead of the CIC fire seal, through
         a grommet in the seal to WC08 */
      line('harnesses', [P(-1.31, .85, .344), P(-1.312, .86, .36), P(-1.33, .95, .345), P(-1.35, 1.03, .33)], .005, 'harness', { clamps: 0, ends: false });
      { const c = line('harnesses', [P(-.8144, 1.9, .4532), P(-.84, 1.9, .462), P(-.87, 1.92, .472), P(-.93, 1.95, .47), P(-.97, 1.97, .44), P(-1.0, 1.99, .418), P(-1.02, 2.0, .443), P(-1.06, 2.0, .40), P(-1.09, 2.0, .365), P(-1.115, 2.0, .34)], .005, 'harness', { clamps: 1, ends: false });
        PW.add('harnesses', G.alongCurve(c, [tAt(c, -1.01)], () => new THREE.CylinderGeometry(.011, .011, .02, 12)), 'silicone').userData.isLine = true; }
      /* turbine clearance control valve: the torque motor aft and down the valve's far side, the LVDT down its near side under the
         right thrust link, both into the T3 branch */
      line('harnesses', [P(-1.666, 1.27, .51), P(-1.69, 1.29, .505), P(-1.71, 1.4, .465), P(-1.72, 1.47, .40), P(-1.695, 1.42, .34), P(-1.67, 1.2, .31), P(-1.645, 1.06, .298), P(-1.62, 1.02, .295)], .005, 'harness', { clamps: 0, ends: false });
      line('harnesses', [P(-1.595, .99, .45), P(-1.575, .99, .445), P(-1.555, 1.0, .41), P(-1.545, 1.0, .36), P(-1.54, 1.0, .325), P(-1.53, 1.015, .307)], .005, 'harness', { clamps: 0, ends: false });
      /* WC05 aft over the fuel manifolds, under the right edge of the precooler and over the clearance control manifolds (the precooler
         sits low enough over the combustor that it can no longer run along 12 o'clock) */
      line('harnesses', [P(-1.67, 12.05, .305), P(-1.684, 12.35, .32), P(-1.697, 12.45, .345), P(-1.712, 12.45, .356), P(-1.75, 12.45, .356), P(-1.80, 12.45, .34), P(-1.95, 12.45, .325), P(-2.05, 12.4, .345), P(-2.10, 12.35, .385), P(-2.14, 12.3, .47), P(-2.20, 12.18, .51), P(-2.24, 12.08, .555), P(-2.40, 12.0, .56), P(-2.45, 12.0, .52), P(-2.465, 12.0, .4835)], .012, 'harness', { clamps: 4 });
      /* p.107 and the A Nahas photo of the core's right side ("EGT T5/T3 HARNESS" over the oil control module): a WC05 branch from over
         the TIC down the right of the HPT case, over the oil tank's lid and the OCM to the oil temperature probe on top of it, where the
         EGT probe junctions are compensated (p.126-129). The model had WC05 only over the top until 2026-10-12 */
      { const O = FLa(-1.575, 3.5, .40);
        line('harnesses', [P(-2.10, 12.35, .385), P(-2.06, .55, .40), P(-2.02, .95, .425), P(-2.005, 1.3, .44), P(-2.005, 1.65, .45), P(-1.99, 1.95, .455), P(-1.88, 2.0, .465), P(-1.80, 2.08, .48),
          P(-1.765, 2.18, .495), P(-1.728, 2.3, .495), P(-1.725, 2.55, .495), P(-1.70, 2.82, .49), O(-.03, .055, -.165), O(.05, .05, -.16), O(.095, .045, -.15), O(.10, .045, -.14), O(.10, .045, -.1233)], .01, 'harness', { clamps: 3, ends: false }); }   // over the active oil damper valve and down onto the probe forward of it (A Nahas p.19)
      /* WC05 then rings the LPT's aft flange both ways to the EGT probe junctions at 3 and 9 o'clock (p.107, p.129) */
      for (const [h0, h1] of [[12, 15], [12, 9]]) { const pts = [], rr = PW.tecR(-2.465) + .016; for (let i = 0; i <= 15; i++) pts.push(P(-2.465, h0 + (h1 - h0) * i / 15, rr));
        line('harnesses', pts, .009, 'harness', { clamps: 5, ends: false });
        const J = FLa(-2.512, h1, PW.tecR(-2.512), .1);                                                                       // the probe junction's connector (EGT, above)
        line('harnesses', [P(-2.465, h1, rr), P(-2.485, h1, rr + .008), J(.024, .046, 0), J(.0135, .04225, 0)], .006, 'harness', { clamps: 0, ends: false }); } }
    PW.part('ignition', { label: 'Ignition system', explode: [0, 0, -.35], src: 'p.306-323; TTM ch. 74',
      info: 'One exciter, the black box with the red-orange HIGH VOLTAGE label low on the left of the fan case at 8 o\'clock, cooled by fan compartment air, with two independent capacitor-discharge circuits: system A run by EEC channel A, system B by channel B. Each fires its own igniter at 5 kV, 1 to 3 sparks a second, through a braided steel cable that runs under the engine to the diffuser case: igniter A at 4 o\'clock, igniter B at 5 o\'clock. On this (right) engine the circuits are powered from DC ESS BUS 2 and 3; the left engine uses DC ESS BUS 1 and 3.\n\nAn automatic start uses one igniter, alternating each start: on at 20.4 to 23.5 percent N2, off at 49.3 to 53.3 percent. If the first attempt fails, the EEC dry motors the engine and tries again on both. The EEC selects both igniters continuously after a flameout in flight or on the takeoff roll above 60 kt, an in-flight surge, or for an in-flight start.\n\nWait at least 5 minutes after the ignition last operated before removing a plug or cable: the voltage can injure.' });
    /* the exciter (p.317, and Brian's photo from below the EEC): a black box with a red-orange high-voltage label and a small yellow
       label, on a bracket carried by four isolator mounts on the case (r 0.97). The aircraft power connector is on its forward end; the
       two output connectors, B above A, are on the darker aft end plate, their braided steel cables turning down the case */
    { const f = Kt.frame('ignition', -.51, 8.0, .968);
      for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const ax = a * .125, az = b * .065;
        Kt.box('ignition', f, [ax, .002, az], [.034, .006, .034], 'steel', { round: .004, rot: [0, Math.PI / 4, 0] });       // isolator mount flange
        Kt.cyl('ignition', f, [ax, .012, az], 'y', .011, .014, 'blackHose'); Kt.hex('ignition', f, [ax, .0225, az], 'y', .0055, .005, 'steel'); }
      Kt.box('ignition', f, [0, .022, 0], [.29, .006, .165], 'accGrey', { round: .003 });                                    // bracket
      Kt.box('ignition', f, [0, .072, 0], [.24, .09, .105], 'exciterBlack', { round: .008 });
      Kt.box('ignition', f, [-.124, .072, 0], [.01, .084, .1], 'capBlack', { round: .004 });                                  // output end plate
      for (const s of [1, -1]) { Kt.cyl('ignition', f, [-.1315, .072, s * .026], 'x', .0145, .005, 'steel');                 // receptacle flange, coupling nut, cable ferrule
        Kt.hex('ignition', f, [-.141, .072, s * .026], 'x', .0125, .012, 'steel'); Kt.cyl('ignition', f, [-.155, .072, s * .026], 'x', .0095, .016, 'steel'); }
      Kt.connector('ignition', f, [.12, .072, 0], 'x', .012, { lead: 'z', boot: true });                                     // aircraft power in
      Kt.label('ignition', f, [-.045, .1172, -.012], 'y', 'z', .075, .036, 'hv'); Kt.label('ignition', f, [-.098, .1172, .032], 'y', 'z', .022, .018, 'caution');
      Kt.plate('ignition', f, [.055, .1172, .01], 'y', 'z', .05, .03);
      line('ignition', [P(-.367, 8.057, 1.0405), P(-.345, 8.12, 1.022), P(-.30, 8.1, 1.0), P(-.24, 7.95, .999), P(-.21, 7.8, .999)], .007, 'harness', { clamps: 0, ends: false });   // power in, off W03
      PW.part('igniters', { parent: 'ignition', label: 'Igniter plugs (2)', src: 'p.314, p.318-319',
        info: 'Two igniter plugs through the diffuser case into the combustion chamber: A at 4 o\'clock, B at 5 o\'clock. Each sits in a mounting boss over classified spacers that set its immersion depth; the boss and spacers stay on the case when a plug is changed. The cables are interchangeable, with ceramic-insulated terminals at the plug end.' });
      /* p.314-315: the cables run aft along the bottom of the fan case and under the reverser, down the lower bifurcation at x -1.2 and
         aft under the core, clear of the drain mast, VFG and oil control module, up to the plugs just aft of the fuel nozzles. A keeps to
         the right of B all the way, so they never cross; both ride over the W03 harness where they cross it ahead of the panel */
      for (const [h0, dh, hp] of [[7.952, -.03, 4.05], [8.048, .03, 5.0]]) {
        const k = dh > 0 ? .03 : 0, da = dh < 0 ? dh * 1.6 : dh, run = [P(-.673, h0, 1.0403), P(-.70 - k, h0 - .05, 1.04), P(-.735 - k, 7.6 + dh, 1.045), P(-.765 - k, 7.0 + dh, 1.07), P(-.82 - k * .5, 6.4 + dh * 1.5, 1.10), P(-.88, 6.15 + dh * 2.5, 1.10), P(-.94, 6.0 + 3 * dh, 1.09), P(-.985, 6.0 + 3 * dh, 1.06),
          P(-1.05, 6.0 + 3 * dh, 1.03), P(-1.11, 6.0 + 3 * dh, .99), P(-1.15, 6.0 + 2.5 * dh, .86), P(-1.18, 6.0 + 2 * dh, .72), P(-1.21, 5.97 + da, .58), P(-1.30, 5.875 + da, .52), P(-1.50, 5.76 + da, .525), P(-1.75, 5.62 + dh * 1.5, .53)];
        /* A turns up behind the gearbox's right arm, over the No. 4 and No. 5/6 scavenge tubes and aft of the oil tubes from the OCM */
        const tail = hp < 4.5 ? [P(-1.812, 5.45, .532), P(-1.825, 5.2, .515), P(-1.83, 4.9, .495), P(-1.83, 4.6, .475), P(-1.83, 4.35, .43), P(-1.825, 4.15, .39), P(-1.815, 4.05, .365), P(-1.81, hp, .347)]
          : [P(-1.80, 5.6, .51), P(-1.83, 5.52, .478), P(-1.835, 5.45, .465), P(-1.835, 5.15, .42), P(-1.82, 5.03, .385), P(-1.81, hp, .347)];   // B keeps aft of the OCM's sensor harness, under the No. 5/6 oil tube
        const ic = line('ignition', run.concat(tail), .0085, 'cable', { clamps: 6, ends: false });
        PW.add('ignition', G.alongCurve(ic, [tAt(ic, -.985)], () => new THREE.CylinderGeometry(.015, .015, .03, 14)), 'silicone').userData.isLine = true;   // orange boot through the bifurcation panel
        /* p.319, from the case out: classified spacer, mounting boss (diamond flange, two bolts, collar), the plug's seating hex, body,
           large hex and terminal shell, then the cable's coupling nut and ferrule; the electrode tip goes through into the liner */
        const g = Kt.frame('igniters', -1.81, hp, .245);
        Kt.tube('igniters', g, [0, .0015, 0], 'y', .011, .019, .003, 'steel');
        Kt.box('igniters', g, [0, .007, 0], [.046, .008, .046], 'steel', { round: .006, rot: [0, Math.PI / 4, 0] });
        for (const s of [-1, 1]) Kt.hex('igniters', g, [s * .024, .0125, 0], 'y', .0042, .004, 'steel');
        Kt.cyl('igniters', g, [0, .019, 0], 'y', .0165, .016, 'steel', { edge: .002 });
        Kt.hex('igniters', g, [0, .031, 0], 'y', .0135, .008, 'steel'); Kt.cyl('igniters', g, [0, .044, 0], 'y', .0105, .018, 'nickel');
        Kt.hex('igniters', g, [0, .058, 0], 'y', .015, .01, 'steel'); Kt.cyl('igniters', g, [0, .07, 0], 'y', .0115, .014, 'steel', { edge: .002 });
        Kt.hex('igniters', g, [0, .083, 0], 'y', .0135, .012, 'steel'); Kt.cyl('igniters', g, [0, .096, 0], 'y', .0095, .014, 'steel');
        Kt.cyl('igniters', g, [0, -.0225, 0], 'y', .0055, .043, 'nickel');                                                      // the tip, through the case and the liner into the chamber (p.318)
        Kt.tube('igniters', g, [0, -.036, 0], 'y', .0058, .0095, .008, 'nickel'); } }                                             // the liner's igniter ferrule
    PW.part('sensors', { label: 'Engine sensors', explode: [0, .2, .2], src: 'p.102-161',
      info: 'Speed probes for N1 (station 2.5 at 4:30 on the CIC) and fan speed (inside the No. 1 bearing support at 1 o\'clock) and the PMAG\'s coils for N2; P2/T2 in the inlet, P2.5/T2.5 on the CIC at 1 o\'clock, T3 at the HPC exit and the burner pressure (Pb) sensor on the CIC fire seal at 10 o\'clock; the EGT probes at station 5 on the turbine exhaust case; two vibration sensors; and the oil sensors on the OCM. Most of their signals go to the EEC. The two vibration sensors, the oil debris monitor, the FDGS auxiliary oil pressure sensor and the P2.5 pressure go to the PHMU instead, which processes them and sends the results to the EEC over the CAN bus (p.92, p.102, p.240).' });
    { /* EGT (p.126-129): two semi-rigid probe and cable assemblies of four probes each on the forward cone of the turbine exhaust case,
         just aft of the LPT flange: right probes at 0:45 to 5:15 with their probe junction at 3 o'clock, left ones at 6:45 to 11:15 with
         theirs at 9. Each probe stands normal to the cone (25 deg), its sheath reaching forward and in to the gas path; the cable runs
         round just aft of the flange with a stub into each probe head */
      PW.part('egt', { parent: 'sensors', label: 'EGT probe and cable assemblies (2)', src: 'p.126-133',
        info: 'Exhaust gas temperature at station 5: two probe and cable assemblies, left and right, each of four thermocouple probes on a semi-rigid cable round the turbine exhaust case. The probes are not replaceable on their own: the whole assembly is changed. The four signals of each assembly are averaged at its probe junction (3 and 9 o\'clock) and compensated at the oil temperature probe on the OCM; the left assembly goes to EEC channel A, the right to channel B.\n\nOne failed assembly gives an L(R) ENGINE FAULT advisory. Limits: 1054 deg C for start and takeoff, 1006 deg C maximum continuous (p.131).' });
      /* on the TEC's barrel (PW.tecR; the probes sat on the old cone at r 0.41, tilted 0.444, until 2026-10-14), the sheaths long enough
         to keep the tips as deep in the gas path as before */
      const xe = -2.52, re = PW.tecR(xe), tilt = .1, dL = re - .41;
      for (const [hs, hj] of [[[.75, 2.25, 3.75, 5.25], 3], [[6.75, 8.25, 9.75, 11.25], 9]]) {
        for (const h of hs) { const f = Kt.frame('egt', xe, h, re, { rz: tilt });
          Kt.box('egt', f, [0, .002, 0], [.026, .004, .016], 'steel', { round: .002 }); for (const s of [-1, 1]) Kt.hex('egt', f, [s * .01, .0055, 0], 'y', .0032, .003, 'steel');   // two-bolt flange
          Kt.box('egt', f, [0, .013, 0], [.016, .018, .018], 'steel', { round: .003 });                                        // terminal head
          Kt.cyl('egt', f, [.02, .016, 0], 'x', .0028, .026, 'steel');                                                        // stub to the cable
          Kt.cyl('egt', f, [0, -.04 - dL / 2, 0], 'y', .0042, .08 + dL, 'nickel'); Kt.cyl('egt', f, [0, -.083 - dL, 0], 'y', .0055, .012, 'nickel'); }   // sheath and tip shield
        const xs = xe + .033 * Math.cos(tilt) - .016 * Math.sin(tilt), rs = re + .033 * Math.sin(tilt) + .016 * Math.cos(tilt);   // through the probes' cable stubs
        const run = (a, b) => { const pts = [], n = Math.max(2, Math.ceil(Math.abs(b - a) / .2)); for (let i = 0; i <= n; i++) pts.push(P(xs, a + (b - a) * i / n, rs)); return pts; };
        line('egt', run(hs[0], hj - .09), .0028, 'tube', { clamps: 0, ends: false }); line('egt', run(hs[3], hj + .09), .0028, 'tube', { clamps: 0, ends: false });
        const g = Kt.frame('egt', -2.512, hj, PW.tecR(-2.512), { rz: tilt });                                                  // probe junction
        Kt.box('egt', g, [0, .014, 0], [.03, .028, .045], 'steel', { round: .004 }); Kt.connector('egt', g, [0, .028, 0], 'y', .0075, { lead: 'x' }); }
      /* N1 speed probe (p.112-115): on the CIC's conical aft face at 4:30, normal to it; a flat head with one bolted ear and its two
         connectors side by side pointing down; the 20 cm shank reaches forward and in to the No. 2 bearing coupling nut */
      PW.part('n1-probe', { parent: 'sensors', label: 'N1 speed probe', src: 'p.108-115',
        info: 'Dual probe at station 2.5, on the aft face of the compressor intermediate case at 4:30. Its tip reads the teeth of the No. 2 bearing coupling nut on the LPC; two isolated coils, one per EEC channel, each with its own connector. 100 percent N1 is 10,600 rpm.\n\nLosing one of the two N1 signals gives an L(R) ENGINE FAULT advisory that affects dispatch. With both lost, the EEC computes N1 from fan speed. The probe is about 20 cm long: support its tip during removal and installation.' });
      { const f = Kt.frame('n1-probe', -1.05, 4.5, .395, { rz: .88 });
        Kt.box('n1-probe', f, [0, .004, 0], [.05, .008, .032], 'steel', { round: .003 }); Kt.box('n1-probe', f, [0, .004, -.027], [.022, .006, .024], 'steel', { round: .008 });
        Kt.hex('n1-probe', f, [0, .0095, -.033], 'y', .005, .004, 'steel');
        Kt.box('n1-probe', f, [0, .02, .006], [.056, .024, .036], 'castAl', { round: .006 });
        for (const s of [-1, 1]) Kt.connector('n1-probe', f, [s * .014, .02, .025], 'z', .0085, { lead: 'z', boot: true });
        Kt.plate('n1-probe', f, [0, .0322, .0], 'y', 'z', .04, .018);
        /* the stem, about 20 cm (p.114), slopes forward and in through the case and the gas path to sit over the coupling nut's teeth
           behind the third LPC rotor (x -0.897, r 0.245) */
        const sd = [-.085, -.996, 0]; Kt.cyl('n1-probe', f, [0, -.012, 0], 'y', .0095, .024, 'steel');
        Kt.cyl('n1-probe', f, [-.0094, -.11, 0], sd, .0055, .18, 'steel'); Kt.cyl('n1-probe', f, [-.0179, -.2102, 0], sd, .0045, .022, 'steel'); }
      /* p.108-113: the fan speed (Nf) probe, on the No. 1 and No. 1.5 bearing support housing at 1 o'clock, its tip over the toothed front
         shaft gear on the FDGS gearbox shaft. Its semi-rigid lead (p.109, p.113) runs aft over the support's flange and the FIC hub, out
         through a core inlet strut, aft between the LPC case and the fan exit liner, over the 2.5 bleed valve, to a bulkhead receptacle on
         the CIC cone at 1:30, where a branch of WC08 takes the signal on to the EEC from the core compartment side. (p.113's top view draws
         the probe nearer 11:30; the text says 1 o'clock, which is followed here) */
      PW.part('nf-probe', { parent: 'sensors', label: 'Fan speed (Nf) probe', src: 'p.108-113, p.134',
        info: 'Reads fan speed from the toothed front shaft gear of the FDGS gearbox shaft, inside the No. 1 bearing support housing at 1 o\'clock. One signal goes to both EEC channels. Nf is not displayed: the EEC uses it to work out N1 if both N1 signals are lost, and the PHMU uses it, with the forward vibration sensor, for fan vibration and the fan trim balance solutions.\n\nIt is deep inside the front of the core, so it is reached only with the fan and FDGS area opened up. Its semi-rigid lead runs aft through a core inlet strut and along the LPC case to a bulkhead receptacle on the compressor intermediate case, where the core harness WC08 picks it up.' });
      { const xp = -.26, rcn = .153 + .112 * ((-.19 - xp) / .18), f = Kt.frame('nf-probe', xp, 1.0, rcn);                       // on the support cone's outer surface
        Kt.cyl('nf-probe', f, [0, -.035, 0], 'y', .0085, .07, 'steel');                                                            // probe body, tip 6 mm off the gear teeth
        Kt.cyl('nf-probe', f, [0, .003, 0], 'y', .019, .006, 'steel'); Kt.bolts('nf-probe', f, [0, .007, 0], 'y', .014, 2, .003);   // mounting flange
        Kt.cyl('nf-probe', f, [0, .018, 0], 'y', .012, .024, 'steel');                                                             // head
        const hr = 1.3, fr = Kt.frame('nf-probe', -1.0, hr, .455, { rz: .88 }), R = FLa(-1.0, hr, .455, .88);                   // bulkhead receptacle on the CIC cone, beside the thrust link lug
        Kt.cyl('nf-probe', fr, [0, -.008, 0], 'y', .011, .05, 'steel'); Kt.box('nf-probe', fr, [0, .006, 0], [.034, .004, .034], 'steel', { round: .004 });
        Kt.connector('nf-probe', fr, [0, -.03, 0], '-y', .008, { lead: '-y' }); Kt.connector('nf-probe', fr, [0, .02, 0], 'y', .008, { lead: '-x' });
        line('nf-probe', [P(xp, 1.0, rcn + .03), P(xp - .006, 1.0, rcn + .045), P(-.29, 1.04, .262), P(-.33, 1.1, .285), P(-.37, 1.0, .305), P(-.40, 1.0, .309), P(-.44, 1.0, .293),
          P(-.48, 1.0, .291), P(-.50, 1.0, .33), P(-.505, 1.0, .40), P(-.512, 1.05, .44), P(-.56, 1.15, .438), P(-.65, 1.25, .435), P(-.78, 1.28, .438), P(-.86, 1.29, .462), P(-.90, hr, .475),
          P(-.93, hr, .47), R(0, -.075, 0), R(0, -.0596, 0)], .004, 'cable', { clamps: 4, ends: false, mat: 'steel' });          // the semi-rigid lead: wires in a steel tube
        line('harnesses', [R(-.0144, .0352, 0), R(-.035, .036, 0), P(-1.07, 1.27, .43), P(-1.09, 1.22, .40)], .005, 'harness', { clamps: 0, ends: false }); }   // into the P2.5/T2.5 probe's branch of WC08
      /* vibration sensors (p.138-141): forward, an accelerometer on a three-bolt bracket on the intermediate case at 9 o'clock, its lead
         down the cone into WC08; aft, a block sensor on the LPT case at 3 o'clock, behind the clearance control rings, into WC05 */
      PW.part('vib-sensors', { parent: 'sensors', label: 'Vibration sensors (2)', src: 'p.134-141',
        info: 'Two accelerometers feeding the PHMU. The forward one is on the intermediate case at 9 o\'clock; with fan speed it gives fan vibration and the fan trim balance solutions. The aft one is on the LPT case at 3 o\'clock.\n\nThe PHMU works out fan, N1 and N2 vibration and sends it to the EEC for EICAS: an amber VIB flag on N1 above 0.52 in/s and next to N2 above 1.2 in/s; FAN VIB in units from 0 to 8, where 4.0 is 100 percent of its 1.2 in/s threshold. Exceedances give the ENGINE VIBRATION caution (p.143).' });
      { const f = Kt.frame('vib-sensors', -1.0, 9, .455, { rz: .88 });
        Kt.box('vib-sensors', f, [0, .003, 0], [.05, .006, .042], 'steel', { round: .004 });
        for (const [a, b] of [[-.017, .014], [.017, .014], [0, -.015]]) Kt.hex('vib-sensors', f, [a, .0075, b], 'y', .0042, .004, 'steel');
        Kt.box('vib-sensors', f, [0, .015, .0], [.03, .018, .022], 'steel', { round: .004 });
        Kt.cyl('vib-sensors', f, [0, .02, -.012], 'z', .012, .034, 'steel', { edge: .003 });
        Kt.connector('vib-sensors', f, [0, .02, -.03], '-z', .0085, { lead: '-z' });
        line('vib-sensors', [P(-1.012, 8.82, .468), P(-1.02, 8.74, .46), P(-1.05, 8.62, .43), P(-1.09, 8.52, .385), P(-1.15, 8.43, .37), P(-1.19, 8.36, .375)], .005, 'harness', { clamps: 0, ends: false }); }
      { const xa = -2.425, f = Kt.frame('vib-sensors', xa, 3, rCase(xa));
        Kt.box('vib-sensors', f, [0, .007, 0], [.026, .014, .026], 'steel', { round: .003 });
        Kt.cyl('vib-sensors', f, [0, .009, .019], 'z', .012, .012, 'steel', { edge: .002 }); Kt.cyl('vib-sensors', f, [0, .021, 0], 'y', .009, .014, 'steel');
        Kt.connector('vib-sensors', f, [0, .028, 0], 'y', .0075, { lead: '-x' });
        line('vib-sensors', [P(xa - .014, 3.0, rCase(xa) + .042), P(xa - .03, 3.04, rCase(xa) + .036), P(-2.462, 3.12, .476)], .005, 'harness', { clamps: 0, ends: false }); }
      /* p.104-107: P2.5/T2.5 on the CIC at 1 o'clock (it was at 2:30), T3 on the diffuser case forward of the fuel nozzles at about
         1 o'clock (it was at 2:36 behind them), Pb on the CIC fire seal at 10 o'clock (it was on the HPC at 10:36) */
      PW.part('p25-probe', { parent: 'sensors', label: 'P2.5/T2.5 probe', src: 'p.102, p.106-107',
        info: 'Pressure and temperature probe at the LPC exit (station 2.5), on the compressor intermediate case at 1 o\'clock. The pressure probe is excited by the PHMU and the temperature sensor by EEC channel A (channel B gets T2.5 over the CAN bus). Both are used to monitor LPC and HPC health.' });
      { const f = Kt.frame('p25-probe', -1.0, 1.0, .455, { rz: .88 });                                                        // normal to the CIC's conical aft face
        Kt.box('p25-probe', f, [0, .004, 0], [.038, .008, .03], 'steel', { round: .004 }); for (const s of [-1, 1]) Kt.hex('p25-probe', f, [s * .014, .0095, 0], 'y', .0035, .003, 'steel');
        Kt.cyl('p25-probe', f, [0, .019, 0], 'y', .011, .022, 'steel'); Kt.box('p25-probe', f, [0, .043, 0], [.034, .03, .034], 'steel', { round: .004 });
        Kt.connector('p25-probe', f, [0, .046, .017], 'z', .0085, { lead: 'z' }); Kt.cyl('p25-probe', f, [0, -.035, 0], 'y', .006, .07, 'nickel'); }
      PW.part('t3-probe', { parent: 'sensors', label: 'T3 probe', src: 'p.102, p.106-107',
        info: 'Thermocouple at the HPC exit, on the diffuser case forward of the fuel nozzles at about 1 o\'clock. A single output to EEC channel B, used to assess engine performance and compressor health.' });
      /* p.107: two terminal posts on a block, a flange with two slotted ears. On the diffuser case's forward cone, square to it (p.106);
         until 2026-10-14 its flange straddled the H flange at x -1.655 */
      { const f = Kt.frame('t3-probe', -1.68, 1.0, .253, { rz: -.9 });
        Kt.box('t3-probe', f, [0, .003, 0], [.03, .006, .072], 'steel', { round: .004 }); for (const s of [-1, 1]) Kt.hex('t3-probe', f, [0, .0075, s * .03], 'y', .0035, .003, 'steel');
        Kt.box('t3-probe', f, [0, .016, 0], [.028, .02, .046], 'steel', { round: .003 });
        for (const s of [-1, 1]) { Kt.cyl('t3-probe', f, [0, .032, s * .011], 'y', .0055, .014, 'steel'); Kt.hex('t3-probe', f, [0, .036, s * .011], 'y', .0065, .004, 'steel'); }
        Kt.cyl('t3-probe', f, [0, -.0175, 0], 'y', .004, .035, 'nickel'); }                                                     // the sheath, into the gas path at the HPC exit, not across it
      PW.part('pb-sensor', { parent: 'sensors', label: 'Burner pressure (Pb) sensor', src: 'p.102, p.104-105',
        info: 'Dual channel pressure sensor on the CIC fire seal at 10 o\'clock, fed by a sense line from the diffuser case. Each channel has a low and a high range transducer, excited by the EEC. Pb is used for fuel scheduling, stall detection, the autostart logic and shaft shear detection.' });
      { const f = Kt.frame('pb-sensor', -1.04, 10, .4066, { rz: .88 });                                                        // p.105: a body with a bolted ear, the connector on its side, the elbow to the sense line
        Kt.box('pb-sensor', f, [0, .006, 0], [.05, .008, .03], 'steel', { round: .003 });
        Kt.cyl('pb-sensor', f, [0, .02, 0], 'x', .016, .06, 'steel', { edge: .003 });
        Kt.box('pb-sensor', f, [.038, .02, 0], [.016, .006, .024], 'steel', { round: .008 }); Kt.hex('pb-sensor', f, [.041, .025, 0], 'y', .0045, .004, 'steel');
        Kt.connector('pb-sensor', f, [.008, .02, .018], 'z', .009, { lead: '-x' });
        Kt.cyl('pb-sensor', f, [-.035, .02, 0], 'x', .007, .012, 'steel'); Kt.hex('pb-sensor', f, [-.044, .02, 0], 'x', .0075, .006, 'steel');
        /* the sense line aft along 10 o'clock, between the core harness and the coolers, to a boss on the diffuser case */
        line('pb-sensor', [P(-1.084, 10, .385), P(-1.12, 10.0, .36), P(-1.20, 10.0, .345), P(-1.30, 10.0, .345), P(-1.40, 10.0, .345), P(-1.52, 10.02, .345), P(-1.60, 10.05, .345), P(-1.63, 10.15, .30), P(-1.643, 10.2, rCase(-1.645) + .016), P(-1.645, 10.2, rCase(-1.645) + .0135)], .004, 'tube', { clamps: 3 });
        { const g = Kt.frame('pb-sensor', -1.645, 10.2, rCase(-1.645)); Kt.box('pb-sensor', g, [0, .003, 0], [.018, .006, .018], 'castAl', { round: .003 }); Kt.fitting('pb-sensor', g, [0, .006, 0], 'y', .005); } }   // the tapping on the case
    }
    /* ============================== THRUST REVERSER CONTROL UNITS ============================== */
    /* p.344-345: the ICU in the aft pylon behind access panels on both sides, the DCU in the forward pylon above the core. They are
       inside the pylon, so they show with the nacelle ghosted or off */
    PW.part('tras-control', { label: 'Thrust reverser control units (ICU, DCU)', explode: [0, .35, 0], src: 'p.326-345, p.356-369',
      info: 'The thrust reverser actuation system is electrically controlled and hydraulically worked, on aircraft hydraulic system 1 for the left engine and system 2 for the right. Aircraft pressure goes through the isolation control unit (ICU) in the aft pylon to the directional control unit (DCU) in the forward pylon, and from the DCU a stow line and a deploy line go down to both reverser doors. On each door they feed the two sleeve actuators, and the stow line feeds the track lock valve. The return comes back through the DCU and ICU to the aircraft.\n\nThe EEC opens the ICU and then the DCU; the CDC opens the track lock valves. Thrust reverse needs the aircraft on the ground (weight on wheels or wheel spin-up), no manual inhibit, no reverser fault and the engine running. Once the sleeves pass 85 percent of travel the thrust levers can go to maximum reverse; an inadvertent deploy brings the engine to idle.\n\nReverser > Locked out shows the MEL dispatch lockout (p.372-375): the ICU\'s manual inhibit lever turned to inhibit and locked with its pin and streamer, then a lockout pin from the latch access panel down through each sleeve into its latch beam lug, with the sleeves\' blanking plates stowed in the pins\' place. For maintenance, the AMP needs only the ICU deactivated.' });
    PW.part('tras-icu', { parent: 'tras-control', label: 'Isolation control unit (ICU)', src: 'p.344-345, p.356-373',
      info: 'In the aft pylon, reached through access panels on both sides of the pylon. It isolates the thrust reverser actuation system from the aircraft hydraulic system until either EEC channel energizes its dual-channel solenoid, which works the isolation control valve onto the isolation spool valve. It has four ports: A/C SUPPLY in from the aircraft through an inlet screen and A/C RETURN back to it on one face, SUPPLY out to the DCU and RETURN from it on the other.\n\nThe manual inhibit lever on its end stops the isolation spool valve from operating. It is used to dispatch with a reverser inoperative (with the lockout pins on the latch beams as well) and to make the system safe for maintenance, where the AMP needs only the ICU deactivated: move the lever to inhibit and lock it with the inhibit pin, which is stowed on the ICU. Dual-channel proximity sensors report the lever position to the EEC, and the flight deck shows the L (R) REVERSER INHIBIT status message.' });
    /* p.345, p.373: a block hung from an H-shaped mounting plate on top. The SUPPLY and RETURN ports to and from the DCU are on one face,
       the A/C SUPPLY and A/C RETURN ports on the other, each name cast beside its port. The dual-channel solenoid sticks out of one end;
       the manual inhibit lever hangs from a pivot at the top of the other end, over a lower housing that carries the two inhibit
       proximity sensors (pointing back along the unit) and the inhibit pin's stowage hole beside A/C RETURN. The manual does not say
       which way the unit faces in the pylon: with the SUPPLY and RETURN face toward the DCU, as here, the renders put the lever at the
       engine-left end */
    { const f = Kt.frame('tras-icu', -2.9, 12, 1.47), C = 'castAl', I = 'tras-icu'; f.position.z -= .02;                     // 2 cm to the left, so its solenoid end clears the pylon's 0.33 m fin
      Kt.box(I, f, [0, 0, 0], [.085, .075, .15], C, { round: .008 });                                                         // body
      Kt.box(I, f, [0, .0435, 0], [.045, .012, .17], C, { round: .004 });                                                     // mounting plate
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { Kt.box(I, f, [sx * .045, .0435, sz * .07], [.05, .012, .03], C, { round: .006 });
        Kt.hex(I, f, [sx * .055, .0525, sz * .07], 'y', .0065, .006, 'steel'); }                                               // its four lugs, bolted up to the pylon
      Kt.box(I, f, [0, -.058, -.034], [.078, .05, .082], C, { round: .014 });                                                 // lower housing under the lever end
      /* the dual-channel solenoid: flange with four screws, the coil can, and its square-flanged connector */
      Kt.box(I, f, [0, .008, .079], [.048, .048, .008], C, { round: .004 });
      for (const a of [-1, 1]) for (const b of [-1, 1]) Kt.cyl(I, f, [a * .018, .008 + b * .018, .0845], 'z', .0035, .003, 'steel');
      Kt.cyl(I, f, [0, .008, .108], 'z', .019, .05, C, { edge: .003 }); Kt.cone(I, f, [0, .008, .14], 'z', .013, .019, .014, C);
      Kt.box(I, f, [0, .008, .149], [.034, .034, .004], C, { round: .003 }); Kt.connector(I, f, [0, .008, .151], 'z', .011, { lead: 'y' });
      /* ports: SUPPLY and RETURN forward to and from the DCU, A/C SUPPLY (inlet screen inside) and A/C RETURN aft to the aircraft */
      for (const [z, name] of [[.03, 'SUPPLY'], [-.03, 'RETURN']]) { Kt.fitting(I, f, [.0425, .004, z], 'x', .011); Kt.decal(I, f, [.0428, .0225, z], 'x', 'y', .028, .012, name, C); }
      Kt.fitting(I, f, [-.0425, .006, .035], '-x', .011); Kt.fitting(I, f, [-.039, -.062, -.012], '-x', .011);
      for (const [y, z, w, name] of [[.013, .058, .018, 'A/C'], [.002, .058, .018, 'SUPPLY'], [-.05, -.036, .02, 'A/C'], [-.061, -.036, .02, 'RETURN']])
        Kt.decal(I, f, [z > 0 ? -.0428 : -.0393, y, z], '-x', 'y', w, .009, name, C);
      Kt.plate(I, f, [-.0428, .008, -.035], '-x', 'y', .045, .024);
      /* the two inhibit proximity sensors out of the lower housing, toward the solenoid end */
      for (const [x, y] of [[.012, -.047], [-.012, -.07]]) { Kt.cyl(I, f, [x, y, .02], 'z', .0068, .026, 'steel'); Kt.hex(I, f, [x, y, .012], 'z', .0085, .005, 'steel');
        Kt.connector(I, f, [x, y, .033], 'z', .0062, { lead: 'x' }); }
      /* the manual inhibit lever on its pivot, INHIBIT cast along it: hanging with its pad swung aft while the reverser is operational,
         turned under the pivot and pinned when it is locked out (p.373; the Reverser > Locked out button) */
      Kt.cyl(I, f, [0, .018, -.079], 'z', .013, .008, C);
      const lv = Kt.sub(f, [0, .018, -.087]); lv.rotation.z = -.26;
      Kt.box(I, lv, [0, 0, 0], [.03, .03, .006], C, { round: .01 }); Kt.box(I, lv, [.002, -.062, 0], [.016, .1, .006], C, { round: .003 });
      Kt.box(I, lv, [.004, -.122, -.001], [.03, .028, .009], C, { round: .004 }); Kt.hex(I, lv, [0, 0, -.005], '-z', .006, .004, 'steel');
      Kt.cyl(I, lv, [0, -.02, -.0031], 'z', .003, .0004, 'darkBox'); Kt.decal(I, lv, [.002, -.068, -.0031], '-z', 'x', .07, .012, 'INHIBIT', C);
      /* the inhibit pin: stowed in its hole on a lanyard, or through the turned lever's hole into the ICU, a REMOVE BEFORE FLIGHT
         streamer hanging from its ring */
      const pinS = Kt.sub(f, [0, 0, 0]), pinI = Kt.sub(f, [.004, -.0016, -.087]); pinI.visible = false;
      Kt.cyl(I, pinS, [-.0405, -.062, -.06], '-x', .0075, .003, 'steel'); Kt.cyl(I, pinS, [-.047, -.062, -.06], '-x', .0045, .01, 'steel');
      Kt.rod(I, pinS, [-.044, -.068, -.06], [-.046, -.09, -.07], .0009, 'steel'); Kt.rod(I, pinS, [-.046, -.09, -.07], [-.042, -.07, -.076], .0009, 'steel');
      Kt.cyl(I, pinI, [0, 0, .004], 'z', .0045, .016, 'steel'); Kt.cyl(I, pinI, [0, 0, -.0075], 'z', .0075, .003, 'steel');
      Kt.rod(I, pinI, [0, -.004, -.009], [0, -.013, -.011], .001, 'steel'); Kt.label(I, pinI, [0, -.075, -.011], '-z', 'x', .12, .022, 'rbf');
      const L = PW.lockout = PW.lockout || { on: 0 };
      PW.anim.push(() => { const on = !!L.on; if (L.icu === on) return; L.icu = on; lv.rotation.z = on ? .2 : -.26; pinS.visible = !on; pinI.visible = on; }); }
    PW.part('tras-dcu', { parent: 'tras-control', label: 'Directional control unit (DCU)', src: 'p.344-345, p.356-369; TTM p.931',
      info: 'In the forward pylon, on top of the pylon structure under its upper fairing. Its dual-channel solenoid, worked by either EEC channel, operates the directional control valve onto the directional spool valve. Pressure from the ICU comes in past the dual-channel pressure proximity sensor, which tells each EEC channel that the ICU has opened (and, after a stow, that the pressure is gone).\n\nThe stow line has pressure whenever the ICU is open. To deploy, the spool sends pressure to the deploy line as well, and the larger piston area on the deploy side drives the actuators out; to stow, it connects the deploy line to return. The two side ports feed the stow and deploy lines to both reverser doors; the return goes back to the ICU, and each door\'s track lock return joins it on the way.' });
    /* p.345, TTM p.931: a long manifold block with the solenoid and the pressure sensor's boss at one end and a round end cap at the
       other, two ports on top (the dash-dot lines in p.345 join them to the ICU), two on the side, two mounting lugs, a nameplate and a
       data-matrix label on top */
    { const g = Kt.frame('tras-dcu', -1.2, 12, 1.40), C = 'castAl', D = 'tras-dcu';
      Kt.box(D, g, [0, 0, 0], [.24, .062, .08], C, { round: .009 });
      Kt.box(D, g, [.124, .008, .018], [.008, .042, .042], C, { round: .004 }); Kt.cyl(D, g, [.152, .008, .018], 'x', .017, .048, C, { edge: .003 });   // the solenoid
      Kt.cone(D, g, [.183, .008, .018], 'x', .012, .017, .014, C); Kt.box(D, g, [.192, .008, .018], [.004, .03, .03], C, { round: .003 });
      Kt.connector(D, g, [.194, .008, .018], 'x', .01, { lead: 'y' });
      Kt.box(D, g, [.13, -.008, -.02], [.03, .04, .04], C, { round: .006 });                                                  // the pressure proximity sensor's boss
      for (const [y, z] of [[0, -.012], [-.02, -.028]]) { Kt.cyl(D, g, [.158, y, z], 'x', .0065, .026, 'steel'); Kt.connector(D, g, [.171, y, z], 'x', .006, { lead: 'y' }); }
      Kt.cyl(D, g, [-.131, -.004, 0], 'x', .028, .022, C, { edge: .004 }); Kt.hex(D, g, [-.145, -.004, 0], 'x', .01, .006, 'steel');   // end cap
      Kt.box(D, g, [.095, .027, .055], [.035, .008, .03], C, { round: .004 }); Kt.hex(D, g, [.095, .034, .058], 'y', .006, .005, 'steel');   // mounting lugs
      Kt.box(D, g, [-.10, -.045, -.034], [.03, .03, .008], C, { round: .004 }); Kt.hex(D, g, [-.10, -.05, -.04], '-z', .006, .005, 'steel');
      Kt.fitting(D, g, [-.03, .031, .028], 'y', .01); Kt.fitting(D, g, [-.095, .031, -.025], 'y', .01);                           // inlet from the ICU, return to it
      Kt.fitting(D, g, [-.05, -.01, -.04], '-z', .01); Kt.fitting(D, g, [.03, -.01, -.04], '-z', .01);                           // stow, deploy
      Kt.plate(D, g, [0, .0315, -.012], 'y', 'x', .045, .022); Kt.label(D, g, [.06, .0313, -.015], 'y', 'x', .02, .02, 'white'); }
    /* the lines in the pylon (they show with the nacelle ghosted), as the p.357 schematic joins them: the aircraft supply and return
       down to the ICU; the ICU's SUPPLY forward to the DCU's inlet and the DCU's return back to the ICU's RETURN, along the top of the
       pylon; the DCU's stow and deploy ports down to a tee each and on to both doors' lines at the hinge beam; and each door's return
       (its track lock valve's return to the aircraft) up into the DCU-to-ICU return. The door ends are built with the doors, from 0:21
       or 11:39 o'clock. The hinge crossing is a short flexible hose in the aircraft; here the door's half swings away with the door */
    { const xm = -1.0406, ra = 1.06, tube = (pid, pts, r) => line(pid, pts, r || .007, 'tube', { clamps: 0, ends: false });
      const door = (k, s) => { const [dr, dx] = [[.02, -.06], [.038, -.072], [.056, -.084]][k], h = s > 0 ? .35 : 11.65;          // k: return, deploy, stow
        return [P(xm + dx - .06, h - s * .05, ra + dr), P(xm + dx, h, ra + dr)]; };
      tube('tras-icu', [V(-2.9585, 1.476, .015), V(-2.99, 1.476, .015), V(-3.02, 1.50, .022), V(-3.04, 1.56, .03), V(-3.05, 1.63, .035), V(-3.05, 1.66, .035)], .008);   // aircraft supply
      tube('tras-icu', [V(-2.955, 1.408, -.032), V(-2.98, 1.408, -.032), V(-3.03, 1.43, -.045), V(-3.07, 1.52, -.055), V(-3.09, 1.62, -.06), V(-3.09, 1.66, -.06)], .008);   // aircraft return
      tube('tras-icu', [V(-2.8415, 1.474, .01), V(-2.80, 1.476, .01), V(-2.60, 1.48, .022), V(-2.40, 1.482, .03), V(-1.60, 1.482, .03), V(-1.30, 1.478, .029), V(-1.245, 1.474, .028), V(-1.231, 1.462, .028), V(-1.23, 1.4455, .028)]);   // ICU SUPPLY to the DCU
      tube('tras-dcu', [V(-1.295, 1.4455, -.025), V(-1.296, 1.46, -.025), V(-1.315, 1.472, -.026), V(-1.40, 1.474, -.028), V(-2.40, 1.474, -.03), V(-2.60, 1.474, -.038), V(-2.80, 1.474, -.05), V(-2.8415, 1.474, -.05)]);   // DCU return to the ICU
      for (const [k, xp, yt] of [[2, -1.25, 1.30], [1, -1.17, 1.32]]) { const T = V(xp, yt, -.08);                          // stow, deploy
        tube('tras-dcu', [V(xp, 1.39, -.0545), V(xp, 1.39, -.068), V(xp, 1.375, -.078), V(xp, yt + .03, -.08), T], .006);
        tube('tras-dcu', [T, V(xp + .005, yt - .03, -.10), V(xp + .03, yt - .10, -.135), V(-1.20 + (k - 2) * -.04, 1.14, -.165)].concat(door(k, -1)), .006);
        tube('tras-dcu', [T, V(xp, yt - .01, -.04), V(xp + .01, yt - .03, .04), V(xp + .03, yt - .10, .13), V(-1.20 + (k - 2) * -.04, 1.14, .165)].concat(door(k, 1)), .006); }
      for (const s of [-1, 1]) tube('tras-dcu', door(0, s).reverse().concat([V(-1.21, 1.075, s * .16), V(-1.32, 1.15, s * .135), V(-1.40 - (s + 1) * .01, 1.30, s * .09 - (s > 0 ? .01 : 0)),
        s < 0 ? V(-1.42, 1.42, -.045) : V(-1.47, 1.40, .02), s < 0 ? V(-1.42, 1.45, -.032) : V(-1.48, 1.445, -.015), V(s < 0 ? -1.42 : -1.48, 1.474, -.028)]), .006);   // each door's return
      /* wiring: the ICU's solenoid and inhibit sensors and the DCU's solenoid and pressure sensor, up into the pylon's wiring */
      const harn = pts => line('tras-icu', pts, .0045, 'harness', { clamps: 0, ends: false });
      const sol = line('tras-icu', [V(-2.9, 1.4978, .1519), V(-2.9, 1.515, .148), V(-2.885, 1.55, .13), V(-2.86, 1.60, .10)], .005, 'harness', { clamps: 0, ends: false });
      harn([V(-2.8768, 1.423, .0248), V(-2.865, 1.423, .04), V(-2.85, 1.43, .075), V(-2.85, 1.47, .085), V(-2.86, 1.50, .10), sol.getPointAt(.45)]);   // inhibit sensors, into the solenoid's lead
      harn([V(-2.9008, 1.40, .0248), V(-2.88, 1.40, .045), V(-2.844, 1.41, .09), V(-2.844, 1.47, .099), V(-2.85, 1.51, .11), sol.getPointAt(.6)]);
      for (const pts of [[V(-.987, 1.426, .018), V(-.987, 1.44, .018), V(-.975, 1.452, .01), V(-.96, 1.458, 0)], [V(-1.0176, 1.4108, -.012), V(-1.0176, 1.425, -.012), V(-1.0, 1.442, -.01), V(-.975, 1.452, -.006)],
        [V(-1.0176, 1.3908, -.028), V(-1.0176, 1.425, -.028), V(-1.0, 1.445, -.024), V(-.975, 1.455, -.018)]]) line('tras-dcu', pts, .0045, 'harness', { clamps: 0, ends: false }); }

    /* ============================== BORESCOPE PORTS ============================== */
    /* p.70-73: every port with its clock position and what it looks at. Each sits in the gap behind the first row it names, as a plugged
       boss on the case; radii from the model's case surfaces */
    PW.part('borescope', { label: 'Borescope access ports', src: 'p.70-73',
      info: 'Plugged ports for a borescope probe to inspect the gas path for damage, cracks, wear and missing material without disassembly. Some blade and stator damage can be blended through them (borescope blending): the AMP gives the damage and blend limits.\n\nLeft side: AP-LPC 3, AP-DIFF 1, AP-HPT 1, AP-LPT 1 and 2. Right side: AP-LPC 1 and 2, AP-HPC 1 to 8, AP-TIC 1. The igniter plug ports are used too: the borescope table puts them at 3:30 and 4:00, but the manual\'s ignition section puts igniters A and B at 4 and 5 o\'clock, which is what the model follows.' });
    for (const [id, x, h, r, sees] of [
      ['AP-LPC 1', -.62, 3.5, .370, 'the LPC variable inlet stator vanes and the 1st stage IBR airfoils'], ['AP-LPC 2', -.732, 4, .363, 'the LPC 1st stage stator vanes and the 2nd stage IBR airfoils'],
      ['AP-LPC 3', -.826, 9.5, .351, 'the LPC 2nd stage stator vanes and the 3rd stage IBR blades'],
      ['AP-HPC 1', -1.178, 4, .242, 'the HPC variable inlet guide vanes and the 1st stage IBR airfoils'], ['AP-HPC 2', -1.279, 4, .248, 'the HPC 1st stage variable stator vanes and the 2nd stage IBR airfoils'],
      ['AP-HPC 3', -1.353, 3.5, .255, 'the HPC 2nd stage variable stator vanes and the 3rd stage IBR airfoils'], ['AP-HPC 4', -1.4075, 4, .282, 'the HPC 3rd stage variable stator vanes and the 4th stage IBR airfoils, through the 4th-stage bleed collar'],
      ['AP-HPC 5', -1.46, 4, .247, 'the HPC 4th stage stator and the 5th stage IBR airfoils'], ['AP-HPC 6', -1.5055, 4, .251, 'the HPC 5th stage stator and the 6th stage IBR airfoils, under the gearbox\'s right arm'],
      ['AP-HPC 7', -1.547, 2, .233, 'the HPC 6th stage stator and the 7th stage IBR airfoils'], ['AP-HPC 8', -1.59, 2, .254, 'the HPC 7th stage stator and the 8th stage rotor blades'],
      ['AP-DIFF 1', -1.78, 11, .287, 'the combustion chamber inner and outer liners, the bulkhead and fuel nozzles, and the HPT 1st stage vanes and rotor blades'],
      ['AP-HPT 1', -1.944, 9, .252, 'the HPT 1st stage rotor blades, 2nd stage vanes and 2nd stage rotor blades'], ['AP-TIC 1', -2.15, 1.5, .455, 'the HPT 2nd stage rotor blades and the LPT 1st stage rotor blades'],
      ['AP-LPT 1', -2.272, 8.5, .491, 'the LPT 1st stage rotor blades, 1st stage vanes and 2nd stage rotor blades'], ['AP-LPT 2', -2.348, 8.5, .473, 'the LPT 2nd stage rotor blades, 2nd stage vanes and 3rd stage rotor blades']]) {
      const pid = 'bs-' + id.toLowerCase().replace(/[^a-z0-9]+/g, '-'), hh = Math.floor(h), mm = Math.round((h - hh) * 60);
      PW.part(pid, { parent: 'borescope', label: `Borescope port ${id}`, src: 'p.70-73', info: `Borescope port ${id} at ${hh}:${String(mm).padStart(2, '0')} o'clock. Through it the borescope sees ${sees}.` });
      const f = Kt.frame(pid, x, h, r);
      Kt.cyl(pid, f, [0, .005, 0], 'y', .0105, .01, 'nickel', { edge: .002 }); Kt.hex(pid, f, [0, .014, 0], 'y', .0085, .008, 'steel');   // boss and plug
      Kt.box(pid, f, [.011, .012, 0], [.007, .002, .004], 'steel', { round: .001 }); }                                                    // lockwire tab
    PW.part('phmu', { label: 'Prognostics and health monitoring unit (PHMU)', explode: [0, .3, .3], src: 'p.92-95, p.134-139; photos',
      info: 'Grey box on the left of the fan case at 9 o\'clock, immediately aft of the EEC, with its own THIS SIDE UP placard. It takes the two vibration sensors, the oil debris monitor, the FDGS auxiliary oil pressure sensor and the P2.5 signal from the P2.5/T2.5 probe directly, and N1, N2, fan speed and the other engine data from the EEC over the CAN bus. It works out fan, N1 and N2 vibration for EICAS, compares the streaming engine data with stored gas path models for health monitoring, checks the FDGS oil supply, and records the data for trend monitoring and the fan trim balance solutions; its reports go through the EEC to the OMS and the HMU. Powered from DC BUS 1 (p.92; the figure on p.93 shows the left engine).' });
    /* p.139 and Brian's photo: a separate grey box just aft of the EEC (until 2026-10-07 the model had it as a cross-braced module of the
       EEC, with a second box at 10:30), a connector at each aft corner; built in the EEC's frame */
    { const f = Kt.frame('phmu', -.08, 9, 1.045), xc = -.36;
      Kt.box('phmu', f, [xc, -.002, 0], [.19, .085, .21], 'eecGrey', { round: .01 });
      for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) Kt.box('phmu', f, [xc + a * .07, -.0615, b * .07], [.03, .034, .03], 'lime', { round: .003 });
      Kt.placard('phmu', f, [xc, .0408, .045], 'y', 'z', .045, .05, 'thisSideUp');
      Kt.label('phmu', f, [xc, .0408, -.02], 'y', 'z', .04, .03, 'white'); Kt.label('phmu', f, [xc, .0408, -.065], 'y', 'z', .03, .02, 'dataBlack');
      for (const s of [-1, 1]) Kt.connector('phmu', f, [xc - .06, 0, s * .105], s > 0 ? 'z' : '-z', .013, { lead: s > 0 ? 'z' : '-z' }); }
    PW.part('pdos', { label: 'Power door operating system (PDOS)', explode: [0, .3, .4], src: 'p.32-43',
      info: 'Opens the thrust reverser doors, one at a time, and supports them open (p.32-43). An electrohydraulic powerpack on the fan case, an AC motor driving a gear pump, makes 2300 psi for two locking actuators, one per door, each connected between the fan case and its door\'s torque box. It works only on the ground with the engine shut down (weight on wheels and the EEC\'s engine-off signal, through the CDC): the left engine\'s motor runs on AC BUS 1 with control from DC BUS 1, the right engine\'s on AC BUS 2 and DC BUS 2. A thermal switch stops an overheating motor.\n\nTo open a door, hold its T/R door switch on the fan case until the actuator is fully extended and for 5 seconds more; the pressure-relief valve opens, and on release the actuator settles onto its internal mechanical lock. Then fit the hold-open rod, the failsafe. To close, refit the rod in its stow bracket, hold the switch until the actuator is fully extended and for at least 5 seconds more, then release it: the pressure-relief valve closes, the lock disengages, and the door\'s weight closes it, slowed by an internal restrictor (p.34, p.42). Make sure the V-groove blade and the alignment pins engage. Without power, a hand pump on the actuator\'s quick-disconnect opens the door; the TTM notes that newer aircraft have the hand pump only.\n\nThe powerpack is serviced with engine oil: dipstick under the filler cap, L 0.74 L, N 0.82 L, H 0.89 L, with the doors closed. Cautions: the inboard reverser doors can hit the slats if they are extended, and pumping by hand can overflow the reservoir.' });
    /* p.33-35: the powerpack at the aft end of the fan case on the right: an AC motor driving a gear pump, a reservoir and manifold
       with the solenoid valve, and the hydraulic line down to the right door's locking actuator */
    { const f = Kt.frame('pdos', -.555, 2.2, .97);
      Kt.box('pdos', f, [0, .004, 0], [.22, .008, .16], 'lime', { round: .003 });                                             // mounting bracket
      Kt.box('pdos', f, [.01, .055, .018], [.17, .09, .1], 'accGrey', { round: .012 });                                      // reservoir and manifold
      Kt.cyl('pdos', f, [-.005, .05, -.058], 'x', .04, .15, 'accGrey', { edge: .006 }); Kt.fins('pdos', f, [-.02, .05, -.058], 'x', .04, 12, .004, .003, .09, 'accGrey');   // motor
      Kt.connector('pdos', f, [.07, .05, -.058], 'x', .011, { lead: 'y' });
      Kt.cyl('pdos', f, [.05, .108, .035], 'y', .016, .03, 'darkBox'); Kt.connector('pdos', f, [.05, .124, .035], 'y', .008, { lead: 'x' });   // solenoid valve
      Kt.cyl('pdos', f, [-.04, .104, .035], 'y', .013, .01, 'capBlack', { edge: .002 });                                    // reservoir filler cap
      Kt.fitting('pdos', f, [-.075, .03, .05], '-x', .009); Kt.fitting('pdos', f, [-.075, .03, .022], '-x', .008);
      Kt.plate('pdos', f, [.01, .055, .0685], 'z', 'y', .05, .03);
      /* p.32-37: a hydraulic line with a quick-disconnect at the far end to each door's locking actuator, the right one short, the left
         one down the aft flange and round the bottom of the fan case on its aft mount ring (p.37), under the cowl anti-ice duct, the
         W03 and W04 harnesses and the ignition cables where they lift over the ring */
      line('pdos', [P(-.655, 2.3, 1.0), P(-.70, 2.6, 1.04), P(-.76, 3.1, 1.05), P(-.80, 3.55, 1.05), P(-.818, 3.72, 1.026), P(-.832, 3.75, 1.023)], .007, 'black', { clamps: 1 });
      { const ring = []; for (let h = 3.4; h < 8.3; h += .4) ring.push(P(h < 4.2 ? -.72 - (h - 3.4) * .0625 : h > 7.6 ? -.77 + (h - 7.6) * .05 : -.77, h, 1.008));
        line('pdos', [P(-.6416, 2.242, 1.0), P(-.665, 2.26, 1.005), P(-.69, 2.5, 1.008), P(-.705, 2.9, 1.008)].concat(ring, [P(-.775, 8.22, 1.025), P(-.815, 8.245, 1.025), P(-.832, 8.25, 1.023)]), .005, 'black', { clamps: 6 }); } }
    /* the door locking actuators themselves (p.32, p.36, p.41: between the fan case at 3:45 and 8:15 and the torque boxes, centred on 3
       and 9 o'clock) are built with the reverser doors in build-nacelle.js, since they follow the doors open; these lines end at their
       quick-disconnects */
    /* p.32-37: one door switch per door on the aft fan case (p.36: 4 and 8 o'clock; the left one sits at 7:42, below the ignition
       exciter, which fills 8 o'clock), a guarded push switch in a small housing on a bracket. Their leads go to the powerpack's harness:
       the right one up the case, the left one round the bottom of the case just ahead of the mount ring, under the cowl anti-ice duct
       and W03/W04 */
    { const ports = [];
      for (const h of [4.0, 7.7]) { const f = Kt.frame('pdos', -.62, h, .964), L = FLa(-.62, h, .964);
        Kt.box('pdos', f, [0, .004, 0], [.07, .008, .06], 'lime', { round: .003 });                                             // bracket on the case
        Kt.box('pdos', f, [0, .026, 0], [.05, .036, .045], 'accGrey', { round: .006 });                                         // switch housing
        Kt.cyl('pdos', f, [.006, .047, 0], 'y', .009, .008, 'darkBox', { edge: .002 });                                         // push button
        for (const s of [-1, 1]) Kt.box('pdos', f, [.006, .052, s * .013], [.024, .016, .003], 'steel', { round: .001 });      // its guard
        Kt.plate('pdos', f, [-.0145, .0441, 0], 'y', 'x', .03, .015, 'T/R DOOR');
        Kt.connector('pdos', f, [0, .026, -.0225], '-z', .007, { lead: '-x' });                                                 // on the side toward 6 o'clock or up the case
        ports.push(L(-.0126, .026, -.0225 - .0133)); }
      line('pdos', [ports[0], P(-.645, 3.85, .99), P(-.648, 3.6, .99), P(-.648, 3.2, .992), P(-.645, 2.85, .995), P(-.62, 2.64, 1.0), P(-.52, 2.57, 1.0), P(-.45, 2.47, 1.0),
        P(-.425, 2.2, 1.01), P(-.43, 2.07, 1.025)], .004, 'harness', { clamps: 3, ends: false });                                 // right switch, up to the powerpack's run
      const ring = []; for (let h = 7.4; h > 4.2; h -= .4) ring.push(P(-.645, h, .985));
      line('pdos', [ports[1], P(-.645, 7.55, .985)].concat(ring, [P(-.646, 4.05, .988), P(-.647, 3.9, .99)]), .004, 'harness', { clamps: 5, ends: false }); }   // left switch, round the bottom into the right one's lead

    /* ============================== FIRE PROTECTION ============================== */
    PW.part('fire', { label: 'Fire detection and extinguishing', explode: [0, .15, -.2], src: 'TTM ch. 26 (p.262-269)',
      info: 'Two detection loops, A and B, each of five sensing elements in series: one on the pylon above the core and two on each core cowl (the inner fixed structure halves), so the cowl elements open with the reverser doors. The FIDEX control unit, with two identical cards, monitors the loops, the bottle cartridges and pressure switches, and drives the L or R ENG FIRE lights, the FIRE light on the ENGINE panel, the CAS message and the aural warning. A manual test is run from the flight deck.\n\nTwo bottles on the aft spar just forward of the main gear bay, each with two discharge heads, can discharge into either engine. The discharge line comes down the pylon to a nozzle with two outlets at the top of the core compartment.' });
    /* TTM p.268: the pylon element (loops A and B side by side) along the underside of the pylon, in the gap between the IFS halves;
       the core cowl elements are built with the reverser doors in build-nacelle.js */
    { for (const dz of [-.10, -.122]) line('fire', [V(-1.10, 1.0135, dz), V(-1.25, 1.0135, dz), V(-1.45, 1.0135, dz)], .0035, 'tube', { clamps: 3, tension: 0 });   // clipped to the pylon, left of the precooler duct
      /* TTM ch. 26: the discharge line comes down from the pylon, past the precooler supply duct, to a nozzle with two outlets at the
         top of the core compartment */
      line('fire', [V(-1.42, 1.03, -.075), V(-1.42, .86, -.09), V(-1.42, .744, -.105), V(-1.42, .64, -.08), V(-1.42, .58, -.052), P(-1.42, 11.84, .535)], .008, 'tube', { clamps: 2 });   // down the left of the precooler's fan-air duct
      box('fire', -1.42, 11.84, .52, .03, .025, .07, 'steel'); }

    /* ============================== MOUNTS ============================== */
    PW.part('mounts', { label: 'Engine mounts', explode: [0, .5, 0], src: 'p.44-49; TTM ch. 71',
      info: 'The mounts carry all the engine loads into the pylon; the nacelle carries no significant structural load. Forward mount on the fan case mount ring, aft mount on the turbine exhaust case, both at 12 o\'clock; two thrust links from the CIC to the aft mount carry the thrust and keep it from bending the core. Every mount is fail-safe: the secondary load paths have clearance and only take load if a primary one fails. The mounts are disconnected to remove the engine.' });
    { const xf = NC.engineForwardMountPlane.x, xa = NC.engineAftMountPlane.x;
      /* forward mount (p.46-47): main beam bolted under the pylon, a side link at each end down to lugs on the mount ring, the fail-safe
         bolt through the beam's centre clevis and the two centre lugs */
      PW.part('mount-fwd', { parent: 'mounts', label: 'Forward engine mount', src: 'p.44-47',
        info: 'On the titanium mount ring at 12 o\'clock. The main beam bolts to the pylon with four bolts in captive barrel nuts, located by two shear pins. A side link at each end carries the side and vertical loads from the mount ring into the beam, each on two bolts. The fail-safe bolt through the centre has clearance and only takes load if a side link fails.' });
      { const f = Kt.frame('mount-fwd', xf, 12, .97);
        Kt.box('mount-fwd', f, [0, .145, 0], [.10, .03, .44], 'titanium', { round: .008 }); Kt.box('mount-fwd', f, [0, .113, 0], [.09, .04, .14], 'titanium', { round: .01 });
        for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) Kt.hex('mount-fwd', f, [a * .03, .127, b * .155], '-y', .009, .008, 'steel');        // the four mount bolts
        for (const s of [-1, 1]) { Kt.box('mount-fwd', f, [0, .055, s * .18], [.06, .06, .03], 'titanium', { round: .008 });                               // lug on the ring
          Kt.box('mount-fwd', f, [.035, .1, s * .18], [.014, .11, .045], 'titanium', { round: .01 }); Kt.box('mount-fwd', f, [-.035, .1, s * .18], [.014, .11, .045], 'titanium', { round: .01 });   // side link
          for (const y of [.065, .14]) { Kt.cyl('mount-fwd', f, [0, y, s * .18], 'x', .007, .1, 'steel'); for (const e of [-1, 1]) Kt.hex('mount-fwd', f, [e * .05, y, s * .18], 'x', .011, .007, 'steel'); } }
        /* p.47: the fail-safe bolt runs fore and aft, its head facing the same way as the side link bolts, through the beam's centre
           clevis and a centre lug on the ring; the two shear pins stand on the beam's top face to locate it in the pylon */
        Kt.box('mount-fwd', f, [0, .07, 0], [.05, .06, .035], 'titanium', { round: .008 });                                          // centre lug on the ring
        for (const s of [-1, 1]) Kt.box('mount-fwd', f, [s * .034, .098, 0], [.012, .05, .05], 'titanium', { round: .005 });         // the clevis cheeks under the beam
        Kt.cyl('mount-fwd', f, [0, .085, 0], 'x', .009, .1, 'steel'); for (const e of [-1, 1]) Kt.hex('mount-fwd', f, [e * .052, .085, 0], 'x', .013, .008, 'steel');   // fail-safe bolt
        for (const z of [-.09, .05]) { Kt.cyl('mount-fwd', f, [0, .17, z], 'y', .008, .02, 'steel'); Kt.cone('mount-fwd', f, [0, .185, z], 'y', .003, .008, .01, 'steel'); } }   // shear pins
      /* aft mount (p.48-49): main beam under the pylon's aft fitting, two outer links down to lugs on the turbine exhaust case, the centre
         fail-safe link, and the balance beam ahead of it carrying the thrust links */
      PW.part('mount-aft', { parent: 'mounts', label: 'Aft engine mount and balance beam', src: 'p.44-45, p.48-49',
        info: 'On the turbine exhaust case at 12 o\'clock, reacting fore-aft, side, vertical and roll loads. The main beam bolts to the pylon with four bolts, located by two shear pins. Two outer links run down to the case, each held to it by one shear bolt; the centre fail-safe link and its two bolts only take load if an outer link fails. The balance beam on its forward face pivots at its centre and takes the two thrust links, evening out the load between them.' });
      { const f = Kt.frame('mount-aft', xa, 12, .40);
        Kt.box('mount-aft', f, [0, .22, 0], [.12, .04, .38], 'titanium', { round: .008 });
        for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) Kt.hex('mount-aft', f, [a * .035, .244, b * .14], 'y', .009, .007, 'steel');
        for (const z of [-.07, .07]) { Kt.cyl('mount-aft', f, [0, .25, z], 'y', .008, .02, 'steel'); Kt.cone('mount-aft', f, [0, .265, z], 'y', .003, .008, .01, 'steel'); }   // the two shear pins (p.48-49)
        const rT = PW.tecR(xa);                                                                                             // the TEC's barrel here (r 0.40, the old cone, until 2026-10-14)
        for (const s of [-1, 1]) { const ly = rT * Math.cos(.49) - .4, lz = rT * Math.sin(.49);                                                       // case lugs at 28 deg either side
          const g = Kt.frame('mount-aft', xa, 12 + s * .936, rT); Kt.box('mount-aft', g, [0, .02, 0], [.05, .04, .03], 'nickel', { round: .006 });
          Kt.rod('mount-aft', f, [0, .205, s * .165], [0, ly + .035, s * lz], .015, 'titanium');                                                         // outer link
          for (const p of [[0, .205, s * .165], [0, ly + .035, s * lz]]) { Kt.cyl('mount-aft', f, p, 'x', .007, .075, 'steel'); for (const e of [-1, 1]) Kt.hex('mount-aft', f, [e * .04, p[1], p[2]], 'x', .011, .007, 'steel'); } }
        for (const dx of [.027, -.027]) Kt.box('mount-aft', f, [dx, (rT - .4 + .091) / 2, 0], [.01, .091 - (rT - .4), .07], 'nickel', { round: .004 });   // the case's centre lugs (p.53), up from the barrel
        Kt.box('mount-aft', f, [0, .15, 0], [.034, .1, .04], 'titanium', { round: .008 });                                                              // fail-safe link
        for (const y of [.075, .195]) { Kt.cyl('mount-aft', f, [0, y, 0], 'x', .008, .085, 'steel'); for (const e of [-1, 1]) Kt.hex('mount-aft', f, [e * .045, y, 0], 'x', .012, .007, 'steel'); }
        Kt.box('mount-aft', f, [.07, .16, 0], [.035, .032, .24], 'titanium', { round: .008 }); Kt.cyl('mount-aft', f, [.07, .19, 0], 'y', .014, .04, 'steel');   // balance beam and its pivot
        for (const s of [-1, 1]) { Kt.cyl('mount-aft', f, [.07, .16, s * .09], 'y', .008, .05, 'steel'); Kt.hex('mount-aft', f, [.07, .188, s * .09], 'y', .011, .006, 'steel'); } }
      /* thrust links (p.48-49): rod-end eyes at the CIC clevises and on the balance beam. Real links are straight; the model's simplified
         inner fixed structure leaves no straight path, so these bend into the gap between the IFS halves */
      PW.part('thrust-links', { parent: 'mounts', label: 'Thrust links (2)', src: 'p.44-45, p.48-49',
        info: 'Two links from the compressor intermediate case (CIC) to the aft mount\'s balance beam. They carry the engine thrust aft into the aft mount and keep it from bending the core. If any link of the aft mount fails, including a thrust link, the load moves to a secondary path.\n\nThe real links are straight rods; the model bends them to fit its simplified inner fixed structure.' });
      for (const s of [-1, 1]) { const h0 = s > 0 ? 1.6 : 10.4;
        const g = Kt.frame('thrust-links', -1.0, h0, .455, { rz: .88 }); Kt.box('thrust-links', g, [0, .012, 0], [.05, .024, .06], 'titanium', { round: .006 });   // clevis on the CIC
        const c = line('thrust-links', [P(-1.0, h0, .44), P(-1.25, s > 0 ? 1.5 : 10.5, .47), P(-1.8, s > 0 ? .7 : 11.3, .512), P(-2.15, s > 0 ? .55 : 11.45, .512), P(-2.32, s > 0 ? .25 : 11.75, .555), V(xa + .07, .56, .09 * s)], .022, 'tube', { clamps: 0, tension: 0, ends: false });
        PW.add('thrust-links', G.alongCurve(c, [.012, .988], () => new THREE.CylinderGeometry(.029, .029, .06, 18)), 'steel').userData.isLine = true; } }   // swaged rod-end housings

    /* ============================== DRAINS ============================== */
    PW.part('drain-mast', { label: 'Drain lines and drain mast', explode: [0, -.5, 0], src: 'p.50-51',
      info: 'Eight drain lines, from the 2.5 bleed valve actuator, the HPC and LPC vane actuators, the VFG, the starter, the fuel/oil manifold and IFPC, the oil tank scupper and the hydraulic pump, gather into the drain mast. The mast drops between the reverser doors at 6 o\'clock and ends in a round plate of tube ends at the latch access panel. The drain tube map inside the panel numbers them: 1 DR11 2.5 bleed, 2 DR21 HPC SVA, 3 DR01 LPC SVA, 4 DR61 VFG, 5 DR91 starter, 6 DR41 FOM fuel, 7 DR71 oil tank, 8 DR51 hydraulic pump. On the plate the tube ends sit in a shield-shaped block in rows of 1, 2, 3 and 2: tube 1 at the narrow end, toward the right of the engine. Which tube drips points to the leaking unit. The nacelle also drains through the gaps round the latch access panel and through holes in the lower bifurcation panels.' });
    /* p.50: each drain runs from its source to the top of the mast under the core at 6 o'clock; the mast carries them down the lower
       bifurcation and through the reverser to the latch access panel at the bottom of the nacelle */
    { const xm2 = -1.48, runs = [
        /* the three actuator drains cross under the cowl anti-ice duct on their way down the right side */
        [actDrain.lpc, P(-1.23, 5.1, .418), P(-1.235, 5.35, .44), P(-1.255, 5.7, .46), P(-1.29, 6.0, .50)],                       // LPC stator vane actuator
        [actDrain.b25, P(-1.228, 3.2, .425), P(-1.225, 3.5, .465), P(-1.215, 4.5, .485), P(-1.232, 5.0, .46), P(-1.24, 5.35, .448), P(-1.27, 5.7, .462), P(-1.31, 6.0, .505)],   // 2.5 bleed valve actuator
        [actDrain.hpc, P(-1.29, 4.26, .41), P(-1.245, 4.3, .455), P(-1.232, 4.5, .478), P(-1.246, 5.0, .458), P(-1.256, 5.35, .448), P(-1.285, 5.7, .464), P(-1.33, 5.98, .50)],   // HPC stator vane actuator
        [P(-1.40, 5.95, .455), P(-1.41, 6.0, .50)],                                                                               // hydraulic pump
        [P(-1.40, 7.15, .46), P(-1.40, 6.6, .50), P(-1.43, 6.1, .515)],                                                             // fuel/oil manifold and IFPC
        [P(-1.685, 7.55, .43), P(-1.72, 7.45, .47), P(-1.74, 7.3, .52), P(-1.70, 7.1, .545), P(-1.60, 6.8, .545), P(-1.52, 6.45, .54), P(-1.47, 6.2, .535)],   // starter pad seal, under the gearbox and the VFG oil line
        /* the VFG and oil tank drains come forward from aft into the back of the collector */
        [FLa(mx1, 6.15, VFG_R)(-.05, .1087, -.03), P(-1.70, 6.05, .56), P(-1.62, 6.08, .575), P(-1.55, 6.09, .595), P(-1.515, 6.09, .612)],          // VFG pad seal
        [P(-1.99, 2.787, .530), P(-1.99, 2.88, .537), P(-1.993, 3.4, .537), P(-2.0, 3.9, .536), P(-2.01, 4.3, .533), P(-2.022, 4.6, .526), P(-2.03, 4.85, .513), P(-2.03, 5.08, .50), P(-2.0, 5.3, .512), P(-1.95, 5.45, .53), P(-1.88, 5.55, .545), P(-1.75, 5.95, .545), P(-1.70, 5.98, .556),
          P(-1.66, 6.0, .568), P(-1.62, 6.02, .574), P(-1.54, 6.03, .59), P(-1.515, 6.03, .612)]];                                                        // oil tank scupper, from the fitting at the bottom of the fill port pocket, down the outboard face and round the cone
      /* the six forward drains keep their own lanes, 1 cm apart, into the top of the collector block on the mast, all to the left of the
         igniter cables; the right-side drains take the lanes in the order they arrive, so none crosses another */
      const lanes = [6.025, 5.99, 5.955, 6.055, 6.105, 6.145];
      /* p.51: the tubes gather into the mast, a bundle held in clamp blocks, and end in a round end plate at the latch access panel, each
         in its place on the drain tube map (1 DR11 2.5 bleed, 2 DR21 HPC SVA, 3 DR01 LPC SVA, 4 DR61 VFG, 5 DR91 starter, 6 DR41 FOM,
         7 DR71 oil tank, 8 DR51 hydraulic pump). Brian's photo from below, reverser doors open, shows the plate end-on as a white disc
         with the tube ends in one brown shield-shaped block: rows of 1, 2, 3 and 2 stacked across the engine, each row running fore and
         aft, tube 1 at the narrow end toward the engine's right and 7 and 8 at the wide end toward its left. The order along each row
         takes the map as drawn seen from below (3, 6 and 8 forward); the photo cannot show it. Until 2026-10-14 the pattern was turned
         90 deg, tube 1 forward. The bundle drops between the reverser doors' latch beams, which leave a 50 mm gap at 6 o'clock, so it
         is packed four tubes across there (map) and spreads to the plate's pattern (plate) just below them */
      const rP = 1.155, map = [[.012, .01], [.03, 0], [.012, -.01], [-.028, .009], [-.008, .015], [-.008, 0], [-.008, -.015], [-.028, -.009]];   // by run: LPC, 2.5, HPC, pump, FOM, starter, VFG, oil tank
      const plate = [[.01, -.012], [0, -.03], [-.01, -.012], [.009, .028], [.015, .008], [0, .008], [-.015, .008], [-.009, .028]];   // same order: [forward, toward the engine's left]
      const xB = xm2 - .02, inB = (i, r, k) => { const [a, t] = map[i]; return P(xB + a * k, 6 + t * k / r / (Math.PI / 6), r); };   // aft of the reverser latch at x -1.40
      const onP = (i, r) => { const [a, t] = plate[i]; return P(xB + a, 6 + t / r / (Math.PI / 6), r); };
      runs.forEach((pts, i) => { let lead = pts;
        /* the three actuator drains stay low until x -1.40, under W04 and clear of ignition cable B, then rise into the collector */
        if (i <= 5) { const h = lanes[i], q = pts[pts.length - 1]; pts[pts.length - 1] = P(q.x, h, Math.hypot(q.y, q.z));
          lead = pts.concat(q.x > -1.38 ? [P(-1.40, h, .503)] : [], [P(xm2 + .03, h, .56), P(xm2 + .01, h, .604)]); }
        line('drain-mast', lead.concat([inB(i, .66, .6), inB(i, .80, .9), inB(i, .95, 1), inB(i, rP - .03, 1), onP(i, rP - .004)]), .004, 'tube', { clamps: 0, ends: false }); });
      for (const r of [.76, .935]) box('drain-mast', xB - .002, 6, r, .08, .02, .06, 'steel');                                     // clamp blocks round the bundle
      /* the end plate, facing down: a white disc about 2.6 times the block's width in the photo, filling the latch access door's
         grommet (r 0.066); it was r 0.046 until 2026-10-14 */
      { const g = Kt.frame('drain-mast', xB, 6, rP);
        Kt.cyl('drain-mast', g, [0, .001, 0], 'y', .064, .014, 'termWhite', { edge: .004 });
        /* the brown block, drawn as [forward, -toward the left] so that turned into the plate it reads [forward, toward the left] */
        const sh = new THREE.Shape(), outline = [[-.008, .04], [.008, .04], [.02, .024], [.02, .004], [.025, .004], [.025, -.018], [.019, -.018], [.019, -.038],
          [-.019, -.038], [-.019, -.018], [-.025, -.018], [-.025, .004], [-.02, .004], [-.02, .024]];
        sh.moveTo(...outline[0]); outline.slice(1).forEach(p => sh.lineTo(...p)); sh.closePath();
        const blk = new THREE.ExtrudeGeometry(sh, { depth: .006, bevelEnabled: true, bevelThickness: .0008, bevelSize: .0008, bevelSegments: 1 });
        blk.rotateX(-Math.PI / 2); blk.translate(0, .008, 0); blk.userData.solid = true; PW.add('drain-mast', blk, 'phenolic', { into: g });
        plate.forEach(([a, t]) => { Kt.cyl('drain-mast', g, [a, .015, t], 'y', .0043, .005, 'brass'); Kt.cyl('drain-mast', g, [a, .0177, t], 'y', .0027, .0008, 'darkBox'); }); } }
  }
  /* a small circle profile (tori for manifolds) */
  function circ(x, r, rad, n) { const out = []; for (let i = 0; i < n; i++) { const a = i / n * TAU; out.push([x + rad * Math.cos(a), r + rad * Math.sin(a)]); } return out; }
})();
