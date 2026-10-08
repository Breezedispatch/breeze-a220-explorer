/* PW1500G model: everything on the outside of the cases. Angle and main gearboxes with their accessories, the oil tank and coolers,
   the EEC and harnesses, fuel, bleed, anti-ice and clearance control plumbing, variable vane actuation, ignition, engine mounts and
   the drain mast. Positions are clock (aft looking forward) and radius on the case they sit on, from the Delta CH 70-80 manual
   (p.44-73, 94-107, 162-183, 212-255, 256-323) and Brian's hangar photos. Sizes not given in the manual are scaled off its figures. */
(function () {
  const PW = window.PW, G = window.PWGeo, D = PW.D, TAU = Math.PI * 2;
  (PW.builders = PW.builders || []).push(build);
  const deg = d => d * Math.PI / 180, V = (x, y, z) => new THREE.Vector3(x, y, z);

  Object.assign(PW.MAT, {
    gearboxCast: () => new THREE.MeshStandardMaterial({ color: new THREE.Color('#a69e8b'), roughness: .62, metalness: .5, roughnessMap: PW.tex.noise('cast', 256, 14, .55, 1), bumpMap: PW.tex.noise('cast', 256, 14, .55, 1), bumpScale: .0008 }),
    accGrey: () => new THREE.MeshStandardMaterial({ color: new THREE.Color('#8b9197'), roughness: .5, metalness: .35 }),
    eecGrey: () => new THREE.MeshStandardMaterial({ color: new THREE.Color('#9aa0a6'), roughness: .55, metalness: .2 }),
    fireSleeve: () => new THREE.MeshStandardMaterial({ color: new THREE.Color('#6a2c26'), roughness: .85, metalness: 0, bumpMap: PW.tex.noise('weave', 256, 30, .6, 1), bumpScale: .0008 }),
    blackHose: () => new THREE.MeshStandardMaterial({ color: new THREE.Color('#222426'), roughness: .8, metalness: .05, bumpMap: PW.tex.noise('weave', 256, 30, .6, 1), bumpScale: .0008 }),
    clampOrange: () => new THREE.MeshStandardMaterial({ color: new THREE.Color('#c8642c'), roughness: .6, metalness: .1 }),
    labelBlue: () => new THREE.MeshStandardMaterial({ color: new THREE.Color('#2f62b8'), roughness: .5, metalness: .1 }),
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
  /* an electrical connector with its backshell, pointing along dir */
  function connector(pid, at, dir) { const c = new THREE.Mesh(G.can(.022, .05)); c.geometry.rotateZ(Math.PI / 2); G.aim(c, at, dir); PW.add(pid, c, 'connector', { solid: true });
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(.026, .026, .012, 16)); ring.geometry.userData.solid = true; G.aim(ring, at.clone().addScaledVector(dir.clone().normalize(), .018), dir); PW.add(pid, ring, 'orange', { solid: true }); }
  /* a routed line with clamps: kind 'tube' | 'hose' | 'harness' | 'duct'. The tube and its clamps, end nuts and bands share a
     lineId, so the connection audit can tell a line's own end fittings from whatever it plugs into */
  let lineSeq = 0;
  function line(pid, pts, r, kind, o) { o = o || {};
    const mat = o.mat || { tube: 'tube', hose: 'fireSleeve', harness: 'harness', duct: 'insulation', black: 'blackHose', cable: 'braidSteel' }[kind] || 'tube', lid = ++lineSeq;
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
      info: 'The N2 rotor drives a towershaft to the angle gearbox on the CIC at 8 o\'clock. A layshaft runs aft from there to the main gearbox, a cast aluminium housing slung under the core from about 4:30 to 9 o\'clock. Accessories mount on its forward and aft faces.\n\nThe gearboxes turn at N2 speed, which is why the starter cranks the core through them and why the generators and the hydraulic pump stop when the engine does.' });
    PW.part('agb', { parent: 'gearboxes', label: 'Angle gearbox (AGB)', src: 'p.66-67; p.53',
      info: 'Bevel gearbox on the compressor intermediate case at 8 o\'clock. The towershaft from the N2 rotor comes into it through the square flange on top, and its bevel gears turn the drive aft into the layshaft to the main gearbox.' });
    { const ag = GB.angleGearboxBody, xa = (ag.x_from + ag.x_to) / 2, ra = (ag.r_in + ag.r_out) / 2, L = ag.x_from - ag.x_to, H = ag.r_out - ag.r_in;
      const f = Kt.frame('agb', xa, 8, ra, { rz: deg(-12) });                                                          // leans aft with radius (p.53)
      Kt.box('agb', f, [0, 0, 0], [L * .92, H * .85, .14], 'castTan', { round: .02 });
      Kt.box('agb', f, [.01, -H * .45, 0], [.11, .014, .11], 'castTan', { round: .004 });                              // square towershaft flange toward the core
      for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) Kt.hex('agb', f, [.01 + a * .045, -H * .45 - .009, b * .045], '-y', .005, .004, 'steel');
      Kt.flange('agb', f, [-L * .46, -.01, 0], '-x', .028, .05, .012, 6, 'castTan');                                   // layshaft cover flange on the aft face
      Kt.fitting('agb', f, [.02, H * .2, .07], 'z', .007); Kt.fitting('agb', f, [-.03, H * .3, -.07], '-z', .007);       // oil feed and scavenge
      Kt.chip('agb', f, [.0, H * .43, .03], 'y', .009);
      const t = GB.towershaftHousing; line('agb', [P(t[0][0], 8, t[0][1]), P(t[1][0], 8, t[1][1])], .035, 'tube', { clamps: 0, ends: false });
      /* p.213: the angle gearbox's oil feed from the MGB and its scavenge back, two tubes aft beside the layshaft cover to bosses on the
         MGB front face under the fuel/oil manifold, passing over the left core harness */
      line('agb', [P(-1.045, 8.39, .391), P(-1.05, 8.47, .395), P(-1.15, 8.47, .40), P(-1.19, 8.47, .405), P(-1.26, 8.47, .37), P(-1.35, 8.45, .345), P(-1.45, 8.45, .335), P(-1.483, 8.45, .333)], .006, 'tube', { clamps: 2 });   // feed
      line('agb', [P(-1.092, 7.63, .412), P(-1.10, 7.56, .415), P(-1.19, 7.56, .405), P(-1.26, 7.58, .37), P(-1.35, 7.6, .345), P(-1.45, 7.6, .335), P(-1.483, 7.6, .333)], .007, 'tube', { clamps: 2 }); }   // scavenge
    PW.part('layshaft', { parent: 'gearboxes', label: 'Layshaft and covers', src: 'p.66-67; p.53',
      info: 'Drive shaft from the angle gearbox aft to the main gearbox input, inside two concentric tubular covers that slide together at a flanged joint. It runs parallel to the axis at 8 o\'clock, close to the HPC case and under the IFPC and fuel/oil manifold, into the top layer of the main gearbox.' });
    { const ls = GB.layshaft, xmid = (ls.x_from + ls.x_to) / 2, f = Kt.frame('layshaft', 0, 8, ls.r_axis);
      Kt.cyl('layshaft', f, [(ls.x_from + xmid) / 2, 0, 0], 'x', .034, ls.x_from - xmid, 'tube', { edge: .004 });        // forward cover
      Kt.cyl('layshaft', f, [(xmid + ls.x_to) / 2, 0, 0], 'x', .030, xmid - ls.x_to, 'tube', { edge: .004 });           // aft cover, sliding into it
      Kt.flange('layshaft', f, [xmid, 0, 0], 'x', .034, .046, .01, 6, 'steel'); Kt.vband('layshaft', f, [ls.x_from - .03, 0, 0], 'x', .034, { phase: 1.2 }); }

    PW.part('mgb', { parent: 'gearboxes', label: 'Main gearbox (MGB)', src: 'p.66-69; p.53; p.237; photos',
      info: 'Cast aluminium housing under the core, from about 4:30 to 9 o\'clock, with machined pads on both faces. Forward face: the fuel/oil manifold with the IFPC (8 o\'clock), the layshaft input, the hydraulic pump and the lube and scavenge oil pump (5 o\'clock). Aft face: the air turbine starter, the PMAG (7 o\'clock), the VFG and the oil control module; the deoiler is in its right arm.\n\nTwo mounting links hang it from the diffuser case and a rod link from its aft face to the turbine intermediate case takes the axial load. A heat shield over its top keeps the core\'s radiant heat off it, and a centering puck on top lines it up during installation. Replaceable carbon seals at each pad, the N2 cranking pad for turning the core by hand during a borescope, and the core drain plugs are serviced here.' });
    const mg = GB.mainGearboxBody, mx0 = mg.x_from, mx1 = mg.x_to, xm = (mx0 + mx1) / 2;
    { const th0 = G.clock(4.4), th1 = G.clock(9.1);
      /* section from the p.53 outline (drawn at 6 o'clock): bottom about 0.47; the top at r 0.285 under the heat shield leaves the
         5 cm gap to the core that p.237 shows the deoiler vent duct crossing in (it was 0.27 until 2026-10-07, with no room for it) */
      const sec = [[mx0 + .008, .29], [mx0 + .008, .445], [mx0 - .008, .462], [xm, .472], [mx1 + .01, .458], [mx1 - .008, .44], [mx1 - .008, .305], [mx1 + .01, .287], [mx0 - .01, .285]];
      PW.add('mgb', G.revolve(sec, { seg: 44, thetaStart: th0, thetaLength: th1 - th0, crease: 35 }), 'castTan');
      for (const [a0, a1] of [[G.clock(3.95), th0], [th1, G.clock(9.55)]])                                            // the arms rising up the sides of the core
        PW.add('mgb', G.revolve([[mx0 - .005, .30], [mx0 - .005, .41], [mx1 + .005, .41], [mx1 + .005, .30]], { seg: 6, thetaStart: a0, thetaLength: a1 - a0 }), 'castTan');
      for (let i = 0; i <= 10; i++) { const a = th0 + (th1 - th0) * i / 10;                                                // ribs under the casting
        PW.add('mgb', G.revolve([[mx0 - .015, .455], [mx1 + .015, .455], [mx1 + .015, .48], [mx0 - .015, .48]], { seg: 2, thetaStart: a - .012, thetaLength: .024 }), 'castTan'); }
      for (const xr of [mx0 - .03, mx1 + .03]) PW.add('mgb', G.revolve([[xr + .006, .468], [xr - .006, .468], [xr - .006, .48], [xr + .006, .48]], { seg: 44, thetaStart: th0 + .05, thetaLength: th1 - th0 - .1 }), 'castTan');
      /* heat shield over the top, centering puck through it */
      PW.add('mgb', G.revolve([[mx0 - .004, .277], [mx1 + .004, .277], [mx1 + .004, .2805], [mx0 - .004, .2805]], { seg: 44, thetaStart: th0 + .04, thetaLength: th1 - th0 - .08 }), 'insulation');
      { const f = Kt.frame('mgb', xm - .02, 6.3, .275); Kt.cyl('mgb', f, [0, -.006, 0], 'y', .026, .016, 'steel'); Kt.bolts('mgb', f, [0, .003, 0], '-y', .036, 4, .004); }
      /* aft face pads: starter, PMAG, VFG; the N2 cranking pad cover; the core drain plugs in a row near the bottom (p.67) */
      for (const [h, r, r0, r1, n] of [[8.4, .385, .085, .125, 16], [7.15, .40, .042, .066, 6], [6.15, .365, .1, .132, 16]]) {
        const f = Kt.frame('mgb', mx1, h, r); Kt.flange('mgb', f, [-.006, 0, 0], '-x', r0, r1, .012, n, 'castTan'); }
      { const f = Kt.frame('mgb', mx1, 7.75, .40); Kt.cyl('mgb', f, [-.008, 0, 0], 'x', .032, .014, 'castTan'); Kt.bolts('mgb', f, [-.016, 0, 0], '-x', .024, 2, .005, { phase: Math.PI / 2 }); }
      for (let i = 0; i < 5; i++) { const f = Kt.frame('mgb', mx1, 6.95 + i * .13, .445); Kt.plug('mgb', f, [-.008, 0, 0], '-x', .009); }
      /* forward face: layshaft input boss */
      { const f = Kt.frame('mgb', mx0, 8, .32); Kt.flange('mgb', f, [.006, 0, 0], 'x', .03, .052, .012, 6, 'castTan'); }
      /* hung from the diffuser case on two mounting links; the rod link to the TIC takes the axial load (p.66-67) */
      for (const [h, h2] of [[4.05, 3.75], [9.45, 9.85]]) {
        const a = P(xm, h, .33), b = P(-1.665, h2, .258); line('mgb', [a, b], .011, 'tube', { clamps: 0, ends: false });   // to the diffuser case just aft of the H flange
        for (const p of [a, b]) { const m = new THREE.Mesh(G.roundedBox(.035, .03, .028, .006)); m.position.copy(p); m.rotation.x = G.clock(h); PW.add('mgb', m, 'steel', { solid: true }); } }
      { const a = P(mx1 - .01, 7.55, .35), b = P(-2.10, 7.6, .372); line('mgb', [a, P(-1.72, 7.57, .362), b], .012, 'tube', { clamps: 0, ends: false, tension: 0 });   // between the PMAG and the starter, over the fuel manifolds
        const f = Kt.frame('mgb', -1.88, 7.585, .366); Kt.hex('mgb', f, [0, 0, 0], 'x', .015, .03, 'steel');                    // turnbuckle
        for (const p of [a, b]) { const m = new THREE.Mesh(new THREE.SphereGeometry(.016, 14, 10)); m.position.copy(p); PW.add('mgb', m, 'steel', { solid: true }); } }
    }
    /* accessories on the MGB faces (p.69 layout; clocks from p.112, 170, 226, 296) */
    const acc = (pid, label, info, src) => PW.part(pid, { parent: 'gearboxes', label, info, src });
    // forward face
    acc('ifpc', 'Integrated fuel pump and control (IFPC)', 'Engine fuel pump and metering unit, mounted on the fuel/oil manifold on the MGB front face at 8 o\'clock and driven by the gearbox. Inside: a centrifugal boost pump; the high-pressure gear pump, which also supplies servo fuel to the vane and bleed actuators; a motive flow pump that returns motive flow to the aircraft fuel system; and the metering section, with the fuel metering valve the EEC commands, its pressure-regulating valve, the windmill bypass valve, the minimum pressure-shutoff valve and flow divider, and the dual-coil overspeed shutdown solenoid that shuts off metered flow.\n\nIf the fuel temperature sensor fails, the EEC meters with a default of 75 deg C. Its carbon-sealed drive pad is on the MGB; fuel leaks there show at the drain mast.', 'p.162-171, p.69');
    /* p.165: a pump housing with a square drive flange, a control section of valve bodies on top, the metering valve's conical torque
       motor housing, connectors and fittings, all natural cast aluminium */
    { const f = Kt.frame('ifpc', mx0 + .16, 8.05, .44);
      Kt.box('ifpc', f, [0, -.015, 0], [.18, .11, .15], 'castAl', { round: .018 });                                       // pump housing
      Kt.box('ifpc', f, [-.085, -.02, 0], [.016, .12, .12], 'castAl', { round: .006 });                                    // square drive flange on the manifold
      Kt.cyl('ifpc', f, [.03, .055, -.03], 'x', .03, .1, 'castAl'); Kt.cyl('ifpc', f, [-.01, .055, .035], 'x', .026, .09, 'castAl');   // metering and pressure-regulating valve bodies
      Kt.cyl('ifpc', f, [.04, .025, .085], 'z', .022, .05, 'castAl'); Kt.cyl('ifpc', f, [-.04, .04, -.085], '-z', .02, .045, 'castAl');
      Kt.cone('ifpc', f, [.115, .055, -.03], 'x', .012, .03, .05, 'castAl');                                              // fuel metering valve torque motor / LVDT
      Kt.box('ifpc', f, [-.02, .075, -.005], [.07, .02, .05], 'darkBox', { round: .005 });                                // overspeed shutdown solenoid
      Kt.connector('ifpc', f, [.08, .055, .03], 'x', .012, { lead: 'z' }); Kt.connector('ifpc', f, [-.055, .075, -.005], '-x', .009, { lead: '-z' });   // the solenoid's on its aft end, under the IFS
      Kt.fitting('ifpc', f, [.06, -.04, .075], 'z', .018);                                                                // boost pump inlet, from the aircraft
      Kt.fitting('ifpc', f, [-.03, -.05, .075], 'z', .008); Kt.fitting('ifpc', f, [.07, .0, -.075], '-z', .008);               // motive flow out; servo fuel supply to the vane, bleed and clearance control actuators (p.167)
      Kt.plate('ifpc', f, [.03, -.035, .0761], 'z', 'y', .05, .025); }
    acc('fom', 'Fuel/oil manifold (FOM), fuel flow meter and fuel filter', 'Upright manifold block against the left end of the MGB front face, from about 7 to 9:30 o\'clock. It carries the IFPC on its forward face at 8 o\'clock, the fuel flow meter above it at 9 o\'clock and the fuel filter below it, and routes the boost-pump fuel to and from the fuel/oil heat exchanger, which keeps it above 0 deg C at the filter inlet.\n\nFuel filter: a disposable canister in a housing with a drain plug; the housing is turned off by the hex in its end. Its differential pressure sensor, at 7:30 on the manifold, reports to both EEC channels. Above 22 psid: L(R) ENG FUEL FILTER advisory with an IMPENDING BYPASS info message. At 25 psid the bypass valve opens (BYPASS info message). Both engines in bypass gives the L-R ENG FUEL FILTER caution: suspect fuel contamination.\n\nFuel flow meter: measures the metered fuel going to the nozzles. Its signal goes to EEC channel A, and to channel B over the CAN bus.', 'p.162-179, p.69');
    { const t0 = G.clock(7.1), t1 = G.clock(9.35);
      PW.add('fom', G.revolve([[mx0 + .055, .37], [mx0 + .004, .37], [mx0 + .004, .465], [mx0 + .055, .465]], { seg: 20, thetaStart: t0, thetaLength: t1 - t0, crease: 30 }), 'castAl');
      for (const h of [7.9, 8.6]) { const f = Kt.frame('fom', mx0 + .03, h, .468); Kt.fitting('fom', f, [0, .004, 0], 'y', .009); }   // servo fuel return in, motive flow out
      /* on the top end face: boost fuel to and from the FOHX, metered fuel to the primary and secondary manifolds */
      for (const [x, r] of [[-1.444, .43], [-1.472, .455], [-1.472, .38], [-1.444, .395]]) Kt.fitting('fom', Kt.frame('fom', x, 9.35, r), [0, 0, 0], 'z', .009);
      /* fuel flow meter at 9 o'clock: a body with its connector */
      { const f = Kt.frame('fom', mx0 + .09, 9.15, .43); Kt.cyl('fom', f, [0, 0, 0], 'x', .042, .085, 'castAl', { edge: .008 }); Kt.flange('fom', f, [-.04, 0, 0], 'x', .03, .05, .008, 4, 'castAl');
        Kt.connector('fom', f, [.0, .045, 0], 'y', .011, { lead: 'x' }); Kt.plate('fom', f, [.0, .0, .043], 'z', 'x', .04, .02); }
      /* fuel filter (p.173): housing with the hex in its end, collar, bypass valve boss and the lockwired drain */
      { const f = Kt.frame('fom', mx0 + .12, 7.35, .45);
        Kt.cyl('fom', f, [0, 0, 0], 'x', .05, .12, 'castAl', { edge: .01 }); Kt.tube('fom', f, [-.055, 0, 0], 'x', .05, .056, .012, 'darkBox');
        Kt.hex('fom', f, [.061, 0, 0], 'x', .022, .006, 'castAl'); Kt.box('fom', f, [.0645, 0, 0], [.004, .012, .012], 'steel', { round: .001 });
        Kt.cyl('fom', f, [-.045, -.02, .052], 'z', .014, .02, 'castAl'); Kt.hex('fom', f, [-.045, -.02, .066], 'z', .007, .006, 'steel');   // bypass valve
        Kt.plug('fom', f, [-.05, .052, -.01], 'y', .007); }                                                                  // housing drain
      { const f = Kt.frame('fom', mx0 + .07, 7.5, .47); Kt.cyl('fom', f, [0, .006, 0], 'y', .017, .03, 'castAl'); Kt.connector('fom', f, [0, .022, 0], 'y', .009, { lead: 'x' }); } }   // filter differential pressure sensor (7:30, p.178)
    acc('edp', 'Hydraulic engine-driven pump (EDP)', 'Variable-displacement hydraulic pump on the MGB forward face, supplying the aircraft hydraulic system on its side. It has a quick-disconnect drive and case drain; its fluid lines and the depressurising solenoid connect through the pylon.', 'p.66-69; TTM ch. 29');
    { const f = Kt.frame('edp', mx0, 5.8, .40);
      Kt.flange('edp', f, [.007, 0, 0], 'x', .045, .075, .012, 8, 'castAl');
      Kt.prof('edp', f, [.11, 0, 0], 'x', [[.09, 0], [.09, .05], [.07, .062], [-.075, .062], [-.085, .07], [-.095, .07], [-.095, 0]], 'castAl');   // pump body
      Kt.cyl('edp', f, [.21, 0, 0], 'x', .045, .05, 'castAl'); Kt.box('edp', f, [.21, .0, .055], [.04, .035, .03], 'darkBox', { round: .004 });   // compensator and depressurising solenoid
      Kt.connector('edp', f, [.21, .0, .072], 'z', .009, { lead: 'x' });
      Kt.fitting('edp', f, [.13, .06, .03], 'y', .014); Kt.fitting('edp', f, [.13, .06, -.03], 'y', .011); Kt.fitting('edp', f, [.07, -.02, -.065], '-z', .008);   // suction, pressure, case drain
      Kt.plate('edp', f, [.11, .0, -.063], '-z', 'x', .05, .025);
      /* its pressure and suction hoses run up the right of the core, aft of the vane and bleed actuators, into the pylon beside the
         precooler supply duct: under the cowl
         anti-ice duct where they cross it low on the right, and under the right thrust link at 1:30 */
      for (const dx of [0, -.035]) line('edp', (dx ? [P(-1.358, 5.68, .482), P(-1.355, 5.6, .47)] : [P(-1.358, 5.92, .484), P(-1.35, 5.84, .49), P(-1.325, 5.66, .488)]).concat([P(-1.30 + dx, 5.42, .45), P(-1.275 + dx, 5.15, .462), P(-1.265 + dx, 4.95, .49), P(-1.258 + dx, 4.75, .505), P(-1.25 + dx, 4.4, .51), P(-1.25 + dx, 3.2, .51),
        P(-1.26 + dx, 1.9, .51), P(-1.262 + dx, 1.65, .44), P(-1.265 + dx, 1.35, .43), P(-1.27 + dx, 1.05, .495), P(-1.27 + dx, .6, .51), P(-1.275 + dx, .3, .52), P(-1.278 + dx, .15, .555), V(-1.28 + dx, .62, .078), V(-1.285 + dx, .70, .097),
        V(-1.29 + dx, .76, .107), V(-1.295 + dx, .85, .12), V(-1.30 + dx, 1.03, .125)]), .012, 'hose', { clamps: 5 }); }   // suction (forward) and pressure (aft) hoses, up between the fan-air duct and the right bifurcation wall
    /* its case drain to the aircraft's hydraulic return, beside the two hoses all the way to the pylon: it crosses under the cowl anti-ice
       duct at 5 o'clock, where the gap between the duct and the LSOP's chip collectors is widest */
    line('edp', [P(-1.418, 5.42, .388), P(-1.405, 5.36, .40), P(-1.385, 5.3, .425), P(-1.35, 5.2, .455), P(-1.326, 5.05, .463), P(-1.322, 4.85, .482), P(-1.324, 4.7, .50), P(-1.32, 4.4, .51), P(-1.32, 3.2, .51), P(-1.33, 1.9, .51),
      P(-1.332, 1.65, .44), P(-1.335, 1.35, .43), P(-1.34, 1.05, .495), P(-1.34, .6, .51), P(-1.345, .3, .52), P(-1.348, .15, .555), V(-1.35, .62, .078), V(-1.355, .70, .097), V(-1.36, .76, .107), V(-1.365, .85, .12), V(-1.37, 1.03, .125)], .006, 'hose', { clamps: 4 });
    acc('lsop', 'Lubrication and scavenge oil pump (LSOP)', 'Seven-stage pump at the right end of the MGB forward face, 5 o\'clock: one pressure stage and six scavenge stages. It slides onto the gearbox pad on two guide pins and is held by captive bolts. Each scavenge return has its own chip collector with a black bayonet cap along the pump body, so a debris message can be traced to the bearing compartment it came from. A low oil pressure indication with normal quantity often points here or to the oil control module.', 'p.212-235, p.231, p.69; photos');
    { const f = Kt.frame('lsop', mx0, 4.85, .40);
      Kt.box('lsop', f, [.008, 0, 0], [.016, .13, .13], 'castTan', { round: .008 });                                       // square mounting flange
      for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) Kt.hex('lsop', f, [.019, a * .052, b * .052], 'x', .006, .006, 'steel');   // captive bolts
      Kt.box('lsop', f, [.13, 0, 0], [.23, .1, .11], 'castTan', { round: .03 });                                           // pump body
      Kt.box('lsop', f, [.12, -.005, .062], [.18, .07, .014], 'castTan', { round: .005 });                                // manifold plate
      for (let i = 0; i < 6; i++) Kt.chip('lsop', f, [.05 + i * .033, .052, (i % 2 ? -.025 : .02)], 'y', .01);           // the six scavenge chip collectors
      for (const p of [[.22, -.02, .07], [.15, .02, .07]]) Kt.fitting('lsop', f, p, 'z', .01); Kt.fitting('lsop', f, [.245, 0, 0], 'x', .012); }
    // aft face
    acc('ats', 'Air turbine starter (ATS)', 'Pneumatic starter at the left end of the MGB aft face, held on its pad by a V-band clamp. Bleed air from the APU, ground cart or the other engine, admitted by the starter air valve, enters through the cone at its aft end and spins its turbine; it cranks the N2 rotor through the gearboxes and disengages above cutout speed. A speed sensor reports to the EEC, and a halo tube round its gearbox end blows cooling air on it.\n\nIt has its own oil: check the level on the sight glass between FULL and ADD, fill through the FILL port until oil comes out of the overfill port, and drain through the drain port. The magnetic plug at the bottom collects debris: check it in starter troubleshooting.', 'p.286-301, p.69');
    { const ax = mx1, ah = 8.4, ar = .385, f = Kt.frame('ats', ax, ah, ar);
      /* p.301, from the pad aft: V-band, gearbox and oil sump, bolted mid flange, grooved turbine housing, inlet cone to the duct */
      Kt.vband('ats', f, [-.012, 0, 0], '-x', .095, { phase: 2.4 });
      Kt.prof('ats', f, [0, 0, 0], '-x', [[.02, 0], [.02, .092], [.03, .1], [.125, .1], [.13, .126], [.145, .126], [.15, .116], [.212, .116], [.272, .062], [.285, .062], [.285, 0]], 'castAl', { seg: 56 });
      Kt.bolts('ats', f, [-.149, 0, 0], '-x', .118, 20, .005);
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
      Kt.prof('ats', f, [-.03, 0, 0], 'x', (() => { const o = []; for (let i = 0; i <= 12; i++) { const a = i / 12 * TAU; o.push([.006 * Math.cos(a), .108 + .006 * Math.sin(a)]); } return o; })(), 'tube', { seg: 48 });
      /* starter air valve on the duct coming down from the pylon (left side) */
      acc('sav', 'Starter air valve (SAV)', 'Pneumatically operated butterfly valve in the starter duct, spring-loaded closed, with a regulator that holds 30 psi downstream. The EEC opens it through a dual-coil torque motor and confirms it open from starter speed and N2. It sits inside a cooling shroud fed by a tube from the air/oil cooler; its line-replaceable filter is under the cover on top.\n\nA 3/8 in square-drive manual override can be reached through an access hole in the left thrust reverser door. The 2017 manual carries a warning that a manual override start is not an approved procedure, because of the motor-to-start logic that prevents starting with a bowed rotor: follow the current AMM and MEL.', 'p.290-299; p.298 warning');
      /* p.297: the starter duct branches down from the precooler's outlet tee (the starter takes cooled bleed, TTM p.579), comes down the
         left of the core through the valve at 9 o'clock, then turns forward and down into the aft end of the starter. It runs just aft of
         the HPT, over the turbine intermediate case: further aft the gap between the LPT case and the IFS is too small for it. It drops
         straight down under the tee and turns left low, under the precooler's strut and the left thrust link */
      const sv = P(-2.07, 9.1, .45), st = P(ax - .29, ah, ar);                                                        // into the starter's inlet cone
      line('sav', [V(-2.14, .685, 0), V(-2.125, .60, 0), V(-2.10, .50, .005), V(-2.09, .445, -.01), P(-2.088, 11.7, .42), P(-2.083, 11.2, .43), P(-2.077, 10.5, .435), P(-2.07, 9.7, .445), sv], .045, 'duct', { clamps: 2 }); line('sav', [sv, P(-2.03, 8.75, .42), st], .045, 'duct', { clamps: 1 });
      /* p.299: butterfly body in the duct, actuator and regulator on its side, filter cover on top, the override access funnel, the
         connector; the whole valve sits in a quilted cooling shroud fed by its cooling tube */
      { const g = Kt.frame('sav', -2.07, 9.1, .45);
        Kt.cyl('sav', g, [0, 0, 0], 'z', .052, .075, 'castAl', { edge: .006 }); for (const s of [-1, 1]) Kt.vband('sav', g, [0, 0, s * .042], 'z', .046, { phase: 1.5 });
        Kt.box('sav', g, [0, .05, 0], [.12, .085, .09], 'quilt', { round: .03 });                                           // cooling shroud
        Kt.cyl('sav', g, [0, .1, .0], 'y', .022, .03, 'castAl'); Kt.cone('sav', g, [-.045, .1, .02], 'y', .02, .008, .025, 'castAl');   // filter cover, override funnel
        Kt.connector('sav', g, [.0, .06, -.05], '-z', .01, { lead: 'y' }); Kt.fitting('sav', g, [.04, .06, .045], 'z', .007); }   // torque motor connector on the shroud's lower side, clear of the IFS fire element
      line('sav', [P(-1.95, 9.8, .45), P(-1.975, 9.7, .455), P(-2.0, 9.55, .47), P(-2.022, 9.43, .503), P(-2.03, 9.335, .513)], .006, 'tube', { clamps: 1 }); }   // cooling tube from the aft face of the air/oil cooler
    acc('pmag', 'Permanent magnet alternator/generator (PMAG)', 'Oil-cooled alternator on the MGB aft face at 7 o\'clock. The stator and its windings are held to the gearbox by captive bolts; the rotor stays on the gearbox shaft when the stator is removed. It has a power winding for each EEC channel, dual N2 speed windings, and a separate generator winding that powers the aircraft fly-by-wire controller.\n\nAbove 45 percent N2 it gives each EEC channel 28 to 34 V. If one channel fails, that EEC channel moves to aircraft 28 V DC and a maintenance message is sent; control is unaffected. Below 45 percent N2, or with both channels failed, the EEC runs on aircraft 28 V DC: channel A from DC ESS BUS 3, channel B from DC ESS BUS 2 on this (right) engine and DC ESS BUS 1 on the left.', 'p.96-101, p.112, p.69');
    { const f = Kt.frame('pmag', mx1, 7.15, .40);
      Kt.flange('pmag', f, [-.006, 0, 0], '-x', .03, .062, .01, 6, 'castAl');
      Kt.prof('pmag', f, [0, 0, 0], '-x', [[.012, 0], [.012, .05], [.02, .054], [.11, .054], [.125, .045], [.13, 0]], 'castAl');
      Kt.fins('pmag', f, [-.065, 0, 0], '-x', .052, 10, .005, .003, .08, 'castAl');
      Kt.connector('pmag', f, [-.13, .02, .0], '-x', .011, { lead: '-z' }); Kt.connector('pmag', f, [-.13, -.02, .0], '-x', .011, { lead: '-z' }); }   // backshells toward 6 o'clock, where their harness runs
    acc('vfg', 'Variable frequency generator (VFG)', 'The engine\'s main AC generator on the MGB aft face: 115/200 V AC, 75 kVA, 380 to 760 Hz, the frequency following N2. Its grey-blue housing is in two bolted sections, with a round blue cap and a capped port underneath; its pad seal drains to the drain mast (tube 4, DR61). It has its own oil, cooled through the VFG oil/oil heat exchanger and a VFG air/oil cooler.\n\nThe crew can disconnect it from the gearbox with the L or R DISC switch on the electrical panel, which also shows its oil cautions (TTM ch. 24). Reconnection is done on the ground, following the AMM.', 'p.66-69; TTM ch. 24; photos');
    { const vr = .365, f = Kt.frame('vfg', mx1, 6.15, vr);
      /* Brian's photos from below: a grey-blue housing, boxy with rounded corners rather than a finned drum, in two bolted sections, with
         a round blue cap and a capped port on its underside. The white disc of tube ends near it in the same photos is the drain mast's
         end plate, not part of the VFG: until 2026-10-08 the model put it here as a feeder terminal cover */
      Kt.cyl('vfg', f, [-.012, 0, 0], 'x', .1, .024, 'vfgGrey', { edge: .004 }); Kt.vband('vfg', f, [-.014, 0, 0], '-x', .102, { phase: 2.6 });   // adapter on the pad
      Kt.box('vfg', f, [-.115, 0, 0], [.17, .21, .18], 'vfgGrey', { round: .035 });                                         // forward section
      Kt.box('vfg', f, [-.2, 0, 0], [.014, .218, .188], 'vfgGrey', { round: .036 });                                        // the bolted joint
      Kt.box('vfg', f, [-.255, 0, 0], [.1, .2, .17], 'vfgGrey', { round: .032 });                                           // aft section
      for (const [y, z] of [[.096, -.06], [.096, 0], [.096, .06], [-.096, -.06], [-.096, 0], [-.096, .06], [-.05, .084], [.05, .084], [-.05, -.084], [.05, -.084]])
        Kt.hex('vfg', f, [-.208, y, z], '-x', .0045, .004, 'steel');
      Kt.cyl('vfg', f, [-.12, .107, .025], 'y', .017, .006, 'labelBlue'); Kt.hex('vfg', f, [-.12, .113, .025], 'y', .006, .006, 'steel');   // round blue cap
      Kt.cyl('vfg', f, [-.26, .102, -.035], 'y', .016, .012, 'castAl'); Kt.cyl('vfg', f, [-.26, .111, -.035], 'y', .013, .006, 'capBlack');   // capped port
      Kt.box('vfg', f, [-.24, .02, .093], [.08, .03, .006], 'labelBlue', { round: .003 });                                   // the blue data label
      Kt.connector('vfg', f, [-.1, .07, .085], [0, .6, .8], .012, { lead: '-x' }); Kt.connector('vfg', f, [-.1, .07, -.085], [0, .6, -.8], .012, { lead: '-x' });
      Kt.fitting('vfg', f, [-.04, .06, .095], [0, .53, .85], .009); Kt.fitting('vfg', f, [-.11, .065, .09], [0, .53, .85], .009);   // oil to and from its oil/oil cooler, both toward it
      Kt.fitting('vfg', f, [-.05, .105, -.03], 'y', .006); }                                                                       // pad seal drain, to the drain mast
    acc('ocm', 'Oil control module (OCM)', 'Cast module at the right end of the MGB aft face. Under the round thermal blanket cap on its outboard face is the main oil filter: a primary and a secondary element behind a bolted cover with a vent plug and a drain plug, with a bypass valve that opens at 55 psid. It also carries the filter differential pressure sensor, the oil debris monitor, the main oil pressure and temperature sensors, the active oil damper valve and the variable oil reduction valve with the journal oil shuttle valve for the FDGS.\n\nA filter impending-bypass or debris message is worked from here.', 'p.226-249, p.229, p.235; photos');
    { const f = Kt.frame('ocm', mx1, 4.9, .40);
      Kt.box('ocm', f, [-.06, 0, 0], [.12, .13, .17], 'castAl', { round: .015 });
      /* main oil filter bore along y, its scalloped bolted cover, and the quilted thermal blanket cap over it (p.235; the dome in the photos) */
      Kt.cyl('ocm', f, [-.06, .07, 0], 'y', .072, .02, 'castAl'); Kt.bolts('ocm', f, [-.06, .081, 0], 'y', .078, 10, .005);
      Kt.prof('ocm', f, [-.06, .08, 0], 'y', [[.045, 0], [.045, .05], [.035, .07], [.02, .08], [0, .082], [0, 0]], 'quilt', { seg: 40 });
      /* p.229, read as a view from aft: the active oil damper valve on the inboard side with its connector at the aft end, the filter
         differential pressure sensor and the oil debris monitor (a square cover on four bolts round a central connector) on the aft
         face toward 4 o'clock, the main oil pressure sensor on the 4 o'clock side, the main oil temperature sensor low on the 6 o'clock
         side and the VORV/JOSV body there too. Each connector's backshell turns toward the harness that serves them, which comes round
         the aft face to the 6 o'clock side */
      Kt.box('ocm', f, [-.1215, .005, -.052], [.006, .045, .045], 'castAl', { round: .005 });                                   // oil debris monitor (ODM)
      for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) Kt.hex('ocm', f, [-.1255, .005 + a * .017, -.052 + b * .017], '-x', .0035, .003, 'steel');
      Kt.connector('ocm', f, [-.124, .005, -.052], '-x', .008, { lead: 'z' });
      Kt.cyl('ocm', f, [-.124, -.04, -.06], '-x', .016, .01, 'castAl'); Kt.connector('ocm', f, [-.129, -.04, -.06], '-x', .008, { lead: 'z' });   // oil filter differential pressure (OFDP) sensor
      Kt.cyl('ocm', f, [-.06, -.02, .1], 'z', .025, .07, 'castAl'); Kt.connector('ocm', f, [-.06, -.02, .135], 'z', .009, { lead: 'x' });   // variable oil reduction / journal oil shuttle valve
      Kt.cyl('ocm', f, [-.06, -.07, -.03], 'y', .02, .03, 'castAl'); Kt.connector('ocm', f, [-.083, -.07, -.03], '-x', .008, { lead: 'z' });  // active oil damper valve
      Kt.cyl('ocm', f, [-.035, .025, -.097], '-z', .013, .024, 'steel'); Kt.hex('ocm', f, [-.035, .025, -.087], '-z', .011, .006, 'steel');   // main oil pressure (MOP) sensor
      Kt.connector('ocm', f, [-.035, .025, -.109], '-z', .008, { lead: '-x' });
      Kt.cyl('ocm', f, [-.095, .045, .092], [0, .5, .866], .009, .02, 'steel'); Kt.connector('ocm', f, [-.095, .055, .11], [0, .5, .866], .007, { lead: '-x' });   // main oil temperature (MOT) sensor
      Kt.fitting('ocm', f, [-.12, -.04, .04], '-x', .011); Kt.fitting('ocm', f, [-.12, .04, .02], '-x', .011); }
    acc('deoiler', 'Deoiler', 'Self-contained centrifugal deoiler in the right arm of the MGB, on its aft face, driven by a gear. It takes breather air from the gearbox, the No. 3 bearing compartment and the oil tank\'s deaerator, spins the oil out of it back into the gearbox, and vents the air overboard through the deoiler vent duct, which crosses over the top of the gearbox, between it and the core, to its flattened outlet at the left end. Its drive oil seal is line-replaceable.', 'p.66-67, p.236-237');
    /* p.237: a drum on the aft face of the right arm; the vent duct leaves its aft end, turns in over the top of the gearbox (between
       the heat shield and the core) and runs across to the left end, where it ends in a flattened outlet */
    { const f = Kt.frame('deoiler', mx1, 4.2, .34);
      Kt.flange('deoiler', f, [-.008, 0, 0], '-x', .03, .06, .012, 8, 'castTan'); Kt.cyl('deoiler', f, [-.025, 0, 0], 'x', .032, .025, 'castAl');
      Kt.flange('deoiler', f, [-.04, 0, 0], '-x', .011, .022, .006, 4, 'steel');                                                 // the duct's bolted flange
      line('deoiler', [P(-1.693, 4.2, .34), P(-1.70, 4.25, .322), P(-1.688, 4.37, .298), P(-1.668, 4.55, .27), P(-1.644, 4.85, .261), P(-1.641, 5.4, .261), P(-1.641, 6.0, .261), P(-1.641, 6.6, .261),
        P(-1.641, 7.2, .261), P(-1.641, 7.8, .261), P(-1.641, 8.4, .261), P(-1.646, 8.85, .263), P(-1.67, 9.12, .276), P(-1.684, 9.3, .296)], .011, 'tube', { clamps: 3, ends: false });
      const g = Kt.frame('deoiler', -1.685, 9.35, .30); Kt.box('deoiler', g, [0, .013, 0], [.02, .026, .05], 'tube', { round: .005 }); }   // flattened outlet

    /* ============================== OIL SYSTEM ============================== */
    PW.part('oil', { label: 'Oil system', explode: [0, 0, .45], src: 'p.212-255; TTM ch. 79',
      info: 'Dry-sump system: the tank on the right of the core feeds the pressure stage of the lube and scavenge pump, the oil control module filters and monitors it, and part of the flow is cooled in the fuel/oil heat exchanger and the air/oil cooler before going to the bearings, gearboxes and the FDGS journals. Six scavenge stages return it to the tank through chip collectors.' });
    PW.part('oil-tank', { parent: 'oil', label: 'Oil tank', src: 'p.222-225, p.249; TTM 79-00 fig. 2 and 4; photos',
      info: 'Aluminium tank on the right of the core, just forward of the turbine intermediate case, curved to the core from its lid at about 2:20 o\'clock down to a cone and the outlet at 5 o\'clock. It holds 27.3 L (28.8 qt): 21.8 L (23 qt) fully serviced, 9.3 L (9.8 qt) minimum. A stainless steel heat shield held together by springs wraps the body. On the lid are the quantity sensor (to the EEC), the pressurization valve, which holds about 12 psi in the tank and vents the excess to the deoiler, and the inlet to the swirl de-aerator.\n\nService it through the oil tank access door on the right IFS. Wait at least 5 minutes after shutdown before opening the cap, and read the level between 5 and 60 minutes after shutdown; outside that window the sight glass is not accurate. The sight glass reads in quarts and litres below full (FULL, 1, 2, 3, LOW), so it shows how much to add. Under the hinged cap a strainer keeps debris out and a flapper valve stops the oil being lost if the cap is left open; if the flapper is stuck shut, hold it open with a small screwdriver through a hole in the screen. Fill until oil starts to run into the scupper, which drains to the drain mast. The drain plug is at the bottom of the cone.' });
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
      /* p.223: the scavenge return comes aft from the pump past the tank's forward face, in under the tip of the cone, up the aft face and
         in over the lid to the de-aerator */
      line('oil-tank', [P(mx0 + .07, 4.6, .45), P(-1.50, 4.2, .47), P(-1.58, 4.05, .478), P(-1.70, 4.0, .487), P(-1.79, 4.08, .487), P(-1.83, 4.3, .48), P(-1.885, 4.55, .465),
        P(-1.935, 4.78, .44), P(-1.99, 4.97, .40), P(-2.05, 4.99, .398), P(-2.095, 4.86, .41), P(-2.104, 4.6, .45), P(-2.104, 4.3, .48), P(-2.104, 4.0, .49), P(-2.104, 3.2, .49),
        P(-2.104, 2.5, .49), P(-2.104, 2.32, .49), P(-2.09, 2.2, .49), P(-2.05, 2.196, .49), P(-2.0173, 2.1965, .49)], .014, 'tube', { clamps: 3 });
      /* p.223: the supply leaves the outlet boss forward, up the cone's forward side, over igniter A's lead and on to the pump inlet */
      line('oil-tank', [P(-1.98, 5.146, .458), P(-1.96, 5.13, .468), P(-1.93, 5.0, .50), P(-1.90, 4.76, .522), P(-1.87, 4.56, .527), P(-1.80, 4.45, .525), P(-1.75, 4.42, .52),
        P(-1.60, 4.44, .512), P(-1.50, 4.55, .505), P(-1.455, 4.68, .49), P(-1.43, 4.75, .44)], .016, 'tube', { clamps: 3 }); }
    /* thermal management (p.212-217, 232-233): three heat exchangers on the upper left of the core. The EEC's bypass valve splits the
       cooled oil between the fuel/oil and air/oil coolers on fuel temperature, normally about 75 / 25 */
    /* p.233, measured against the HPC vane lever rows: FOHX x -1.05 to -1.41 with its bypass valve at the forward end, VFGOOHX -1.43 to
       -1.51, AOHX -1.53 to -1.96 standing about 0.35 m tall on the left. The AOHX is built in its own flat frame on the case */
    PW.part('aoc', { parent: 'oil', label: 'Air/oil heat exchanger (AOHX)', src: 'p.212-217, p.232-233; p.20-23',
      info: 'Plate-fin cooler standing on the left of the core at about 10 o\'clock, over the rear HPC and diffuser, with the starter below it. Fan air comes in through the forward half of the window in the left IFS, turns aft through the finned matrix between the two plenums and leaves through the aft half. It takes part of the cooled-path oil, at least about 25 percent and up to nearly all of it when the fuel cannot take more heat. If it clogs, a relief valve sends the oil straight to the VFG oil/oil cooler.' });
    { const ax = -1.745, ah = 9.9, f = frame('aoc', ax, ah, .44);
      fbox('aoc', f, 0, -.002, 0, .17, .08, .32, 'darkBox', .004);                                                                          // finned matrix
      for (let i = 0; i < 22; i++) fbox('aoc', f, 0, 0, -.152 + i * .304 / 21, .17, .086, .003, 'nickel', .0005);
      for (const s of [1, -1]) { fbox('aoc', f, s * .15, 0, 0, .13, .12, .34, 'steel', .025); fbox('aoc', f, s * .15, .057, 0, .09, .012, .27, 'darkBox', .01); }   // inlet and exhaust plenums with their openings
      for (const dx of [.12, -.12]) PW.add('aoc', G.rod(P(ax + dx, 10.6, .46), P(ax + dx, 11.0, .30), .006), 'steel');                        // support rods to the case
      line('aoc', [P(-1.60, 10.35, .44), P(-1.55, 10.3, .43), P(-1.515, 10.15, .41)], .016, 'tube', { clamps: 0 }); }                         // oil on to the VFG oil/oil cooler
    PW.part('vfgoohx', { parent: 'oil', label: 'VFG oil/oil heat exchanger (VFGOOHX)', src: 'p.212-217, p.232-233',
      info: 'Small plate-fin cooler on the left of the core at about 10 o\'clock, between the fuel/oil and air/oil coolers. Cooled engine oil takes heat from the generator\'s own oil; the VFG oil then passes a separate VFG air/oil cooler before returning to the generator.' });
    { const vx = -1.46, vh = 10.0; box('vfgoohx', vx, vh, .40, .085, .07, .11, 'steel'); for (const dx of [.05, -.05]) box('vfgoohx', vx + dx, vh, .405, .025, .09, .12, 'castAl', { round: .008 });
      /* VFG oil down the left of the gearbox, between the PMAG and the generator, to the fitting on the VFG's 7 o'clock side
         (points closer than 0.6 h apart, so the run does not cut in across the curve of the casting) */
      line('vfgoohx', [P(vx, 9.72, .43), P(-1.475, 9.68, .47), P(-1.485, 9.5, .495), P(-1.485, 9.3, .51), P(-1.47, 9.1, .525), P(-1.51, 8.55, .512), P(-1.57, 8.0, .505), P(-1.635, 7.45, .508), P(-1.68, 7.0, .505), P(-1.69, 6.78, .48), P(-1.694, 6.65, .455)], .014, 'tube', { clamps: 3 });
      /* and back (p.213 draws the VFG oil circuit as a pair, to and from the VFG): beside the first, aft of and outboard of it, between the fuel/oil manifold and the air/oil cooler's plenum */
      line('vfgoohx', [P(vx - .045, 9.74, .44), P(-1.512, 9.62, .485), P(-1.515, 9.5, .525), P(-1.515, 9.3, .53), P(-1.51, 9.1, .53), P(-1.545, 8.55, .512), P(-1.605, 8.0, .505), P(-1.67, 7.45, .508), P(-1.715, 7.0, .505), P(-1.735, 6.8, .48), P(-1.755, 6.66, .458), P(-1.764, 6.585, .443)], .014, 'tube', { clamps: 3 }); }
    PW.part('fohe', { parent: 'oil', label: 'Fuel/oil heat exchanger (FOHX) and bypass valve', src: 'p.162-170, p.212-217, p.232-233',
      info: 'Fuel-cooled oil cooler on the upper left of the core at 11 o\'clock, over the front HPC. Its bypass valve (FOHXBV) sits at its forward end on the compressor intermediate case near 12 o\'clock, on the dark FOC manifold block. Boost-pump fuel from the fuel/oil manifold takes heat from the oil and goes back to the manifold, keeping the fuel above 0 deg C at the fuel filter inlet.\n\nThe EEC modulates the bypass valve on the fuel temperature sensor, opening it as the fuel gets colder to send more hot oil through. Normally about 75 percent of the cooled-path oil comes here and 25 percent goes to the air/oil cooler. If the fuel side blocks, a bypass valve sends the fuel round it; the oil side has a relief valve.' });
    { const fx = -1.26, f = frame('fohe', fx, 11.0, .39);
      for (const z of [-.055, .055]) PW.add('fohe', G.can(.05, .30), 'steel', { into: f, pos: [0, 0, z] });                                   // the two long headers
      fbox('fohe', f, 0, -.01, 0, .26, .07, .06, 'steel'); fbox('fohe', f, -.165, 0, 0, .035, .12, .2, 'castAl', .01);                          // core and aft end plate
      box('fohe', -1.12, 11.7, .435, .07, .09, .12, 'darkBox');                                                                             // FOC manifold
      can('fohe', -1.115, 11.95, .44, .03, .06, 'accGrey'); box('fohe', -1.11, 12.0, .475, .04, .03, .05, 'darkBox');                           // bypass valve and its torque motor
      line('fohe', [P(-1.135, 11.45, .42), P(-1.15, 11.36, .415), P(-1.16, 11.27, .41)], .014, 'tube', { clamps: 0 });                        // oil from the valve into the cooler
      line('fohe', [P(fx - .15, 10.75, .40), P(-1.43, 10.5, .42), P(-1.42, 10.2, .41)], .014, 'tube', { clamps: 1 }); }                     // oil on to the VFG oil/oil cooler

    /* ============================== FUEL ============================== */
    PW.part('fuel', { label: 'Fuel system lines', explode: [0, 0, -.45], src: 'p.162-183; TTM ch. 73',
      info: 'Fuel comes down from the pylon to the IFPC on the MGB. Its boost pump sends the fuel through the fuel/oil manifold to the fuel/oil heat exchanger and back, then through the filter to the high-pressure pump. Metered fuel passes the flow meter and leaves the manifold in two tubes for the primary and secondary manifolds round the combustor, which feed the 16 nozzles: 10 duplex and 6 simplex (secondary only), in a pattern of 4 duplex, 4 simplex, 6 duplex, 2 simplex. Every nozzle has check valves that keep the manifolds full after shutdown.\n\nServo fuel from the high-pressure pump drives the vane and bleed actuators and returns upstream of the filter.' });
    /* the supply crosses under the left thrust link close to its CIC end, where it is lowest; the FOHX boost lines cross over it */
    line('fuel', [P(-1.03, 11.8, 1.06), P(-1.035, 11.8, .90), P(-1.04, 11.79, .70), P(-1.042, 11.74, .50), P(-1.045, 11.55, .455), P(-1.048, 11.2, .455), P(-1.06, 10.75, .43), P(-1.07, 10.43, .40), P(-1.10, 10.05, .455),
      P(-1.16, 9.4, .47), P(-1.25, 8.75, .49), P(-1.262, 8.58, .44), P(-1.267, 8.505, .416)], .02, 'hose', { clamps: 4 });   // supply from the pylon, beside the precooler duct, into the IFPC's boost pump inlet   // supply from the pylon to the IFPC
    for (const [o, r1] of [[0, 0], [.12, .03]]) {                                                                                               // boost fuel to and from the FOHX
      line('fuel', [P(-1.12 - o * .25, 11.55 + o, .43), P(-1.115 - o * .25, 11.2, .475), P(-1.125 - o * .25, 10.8, .49), P(-1.13 - o * .25, 10.45, .497 + o * .025), P(-1.16 - o * .28, 10.1 + o * .6, .49), P(-1.25, 9.9 + o * .8, .49 + r1 * .5),
        P(-1.32, 9.75 + o * .8, .475 + r1), P(-1.40, 9.4 + o * .67, .465 + r1 * .83), P(-1.432 - o * .233, 9.47 + o * .25, .44 + o * .2), P(-1.444 - o * .233, 9.407, .43 + o * .208)], .012, 'tube', { clamps: 2 }); }
    /* metered fuel: two tubes leave the top end of the FOM, turn up in front of the MGB's left arm, pass under the VFG oil/oil cooler
       and run aft above the arm, under the AOHX, to the primary and secondary manifolds */
    line('fuel', [P(-1.472, 9.415, .38), P(-1.47, 9.5, .368), P(-1.47, 9.58, .352), P(-1.50, 9.66, .345), P(-1.60, 9.66, .343), P(-1.67, 9.7, .325), P(-1.70, 9.76, .31), P(-1.725, 9.8, .305)], .012, 'tube', { clamps: 2 });
    line('fuel', [P(-1.444, 9.413, .395), P(-1.445, 9.5, .39), P(-1.44, 9.6, .365), P(-1.445, 9.75, .342), P(-1.46, 9.86, .338), P(-1.55, 9.87, .338), P(-1.65, 9.9, .335), P(-1.69, 9.95, .33), P(-1.716, 10.0, .327)], .012, 'tube', { clamps: 2 });
    for (const [dr, nm] of [[.0, 'primary'], [.022, 'secondary']]) {
      const xr = -1.725 + dr * .4, rr = .305 + dr; PW.add('fuel', G.revolve([[xr + .008, rr - .008], [xr - .008, rr - .008], [xr - .008, rr + .008], [xr + .008, rr + .008]], { seg: 96 }), 'steel');
      for (let i = 0; i < 16; i++) { const a = i / 16 * TAU + TAU / 32; PW.add('fuel', G.rod(G.onRing(xr, rr, a), G.onRing(-1.761, .284, a), .004), 'steel'); } }
    /* p.167: servo fuel from the IFPC's servo pressure regulator to the four fuel-powered actuators (turbine ACC air valve, HPC and LPC
       vane actuators, 2.5 bleed valve) and back to the fuel/oil manifold ahead of the filter. The supply and return run as a pair round
       the right of the core just aft of WC08 and the CIC fire seal, under the actuators, with a branch up to each one's ports, then aft
       to the ACC valve */
    { const arcP = (x, r, h0, h1, n) => Array.from({ length: n + 1 }, (_, i) => P(x, h0 + (h1 - h0) * i / n, r));
      line('fuel', [P(-1.258, 7.68, .448), P(-1.255, 7.5, .44), P(-1.24, 7.25, .435), P(-1.19, 7.0, .42), P(-1.168, 6.8, .395), P(-1.165, 6.6, .385)].concat(arcP(-1.165, .385, 6.45, 1.85, 16),
        [P(-1.25, 1.68, .395), P(-1.42, 1.45, .405), P(-1.48, 1.25, .42), P(-1.53, 1.12, .44), P(-1.57, 1.10, .455), P(-1.585, 1.13, .465), P(-1.594, 1.157, .47)]), .006, 'tube', { clamps: 6, ends: false });   // supply
      line('fuel', [P(-1.458, 7.9, .485), P(-1.458, 7.84, .503), P(-1.458, 7.5, .505), P(-1.455, 7.15, .503), P(-1.44, 7.0, .50), P(-1.35, 6.98, .50), P(-1.25, 6.98, .495), P(-1.20, 6.93, .46), P(-1.185, 6.75, .43), P(-1.18, 6.55, .405)].concat(arcP(-1.18, .40, 6.45, 1.9, 16),
        [P(-1.27, 1.72, .41), P(-1.43, 1.52, .42), P(-1.48, 1.38, .465), P(-1.53, 1.29, .50), P(-1.575, 1.258, .485), P(-1.587, 1.258, .475), P(-1.594, 1.258, .47)]), .006, 'tube', { clamps: 6, ends: false });   // return, leaving the manifold aft of the fuel filter
      for (const pts of [
        [P(-1.165, 2.62, .385), P(-1.16, 2.6, .43), P(-1.148, 2.64, .465), P(-1.145, 2.69, .471)], [P(-1.18, 2.58, .40), P(-1.183, 2.57, .44), P(-1.185, 2.64, .467), P(-1.185, 2.69, .471)],   // 2.5 bleed valve actuator
        [P(-1.165, 5.40, .385), P(-1.16, 5.42, .43), P(-1.148, 5.36, .465), P(-1.145, 5.31, .469)], [P(-1.18, 5.44, .40), P(-1.183, 5.45, .44), P(-1.185, 5.36, .466), P(-1.185, 5.31, .469)],   // LPC vane actuator
        [P(-1.165, 3.86, .385), P(-1.185, 3.87, .412), P(-1.21, 3.9, .425), P(-1.222, 3.93, .412)], [P(-1.18, 4.14, .40), P(-1.198, 4.13, .425), P(-1.215, 4.1, .43), P(-1.222, 4.07, .412)]])   // HPC vane actuator
        line('fuel', pts, .005, 'tube', { clamps: 0, ends: false }); }

    /* ============================== AIR SYSTEMS ============================== */
    PW.part('air', { label: 'Engine air systems', explode: [0, .4, 0], src: 'p.256-285; TTM ch. 75',
      info: 'Variable vanes on the LPC and HPC, the 2.5 and HPC bleed valves that keep the compressors stable during starts and transients, turbine active clearance control, and buffer air for the bearing compartment seals. All are scheduled by the EEC and moved by fuel-powered actuators.' });
    /* p.258-267. The CIC firewall is the cone from the fan duct inner wall down to the HPC case (r .515 at x -.95 to .262 at -1.16).
       The 2.5 bleed and LPC vane actuators sit on its aft face in the core compartment, with their rods running forward through it */
    const rFire = x => .515 - (-.95 - x) / .21 * .253;
    PW.part('hpc-sva', { parent: 'air', label: 'HPC stator vane actuator and synchronizing rings', src: 'p.258-261',
      info: 'Fuel-powered actuator on the HPC case on the right side at 4 o\'clock. Through a bellcrank it turns four synchronizing rings, which move the HPC inlet guide vanes and the first three stator rows together. The EEC positions it on N2 from the PMAG through a dual-coil torque motor and servovalve, and reads the piston back from a dual-coil LVDT.\n\nThe vanes are closed for start and idle and fully open at takeoff. With no power the actuator drives the vanes open, for maximum airflow. It needs no rigging when it is installed.' });
    { const rows = ['HPC variable inlet guide vane', 'HPC stator 1', 'HPC stator 2', 'HPC stator 3'].map(n => D.GEN.rows.find(r => r.name.startsWith(n)));
      /* p.261: each synchronizing ring carries a dense row of dark levers, one per vane trunnion */
      rows.forEach(rw => { if (!rw) return; const xx = (rw.x_le + rw.x_te) / 2, rr = Math.max(rCase(xx), .245) + .016;
        PW.add('hpc-sva', G.revolve([[xx + .007, rr], [xx - .007, rr], [xx - .007, rr + .014], [xx + .007, rr + .014]], { seg: 128 }), 'steel');
        PW.add('hpc-sva', G.ringInstances(new THREE.BoxGeometry(.034, .026, .010).translate(-.004, rr - .006, 0), PW.partMat('hpc-sva', 'darkBox'), 44, { x: xx + .006 }), null); });
      const x0 = rows[0] ? (rows[0].x_le + rows[0].x_te) / 2 : -1.15, x3 = rows[3] ? (rows[3].x_le + rows[3].x_te) / 2 : -1.39, xa = (x0 + x3) / 2 - .02;
      can('hpc-sva', xa, 4.0, rCase(xa) + .08, .032, .26, 'steel'); box('hpc-sva', xa, 4.0, rCase(xa) + .125, .2, .04, .08, 'darkBox');    // actuator and its torque motor/LVDT housing
      { const g = Kt.frame('hpc-sva', xa, 4.0, rCase(xa) + .125); for (const z of [-.015, .015]) Kt.fitting('hpc-sva', g, [.07, .02, z], 'y', .006); }   // servo fuel in and out (p.167)
      box('hpc-sva', x3 - .04, 4.25, rCase(x3) + .05, .05, .09, .035, 'steel'); }                                                           // bellcrank
    PW.part('lpc-sva', { parent: 'air', label: 'LPC stator vane actuator and synchronizing ring', src: 'p.258-261',
      info: 'Fuel-powered actuator at 5 o\'clock on the CIC firewall. Its rod runs forward through the firewall to a bellcrank on the synchronizing ring round the LPC inlet, which turns the LPC inlet guide vanes together. The EEC positions it on N1 through a dual-coil torque motor and servovalve, with a dual-coil LVDT reporting to each channel.\n\nThe manual\'s text has the vanes moving toward closed for start and idle, modulating in transients and open above idle (its table differs for the start case). With no power the actuator drives the vanes open.' });
    { const rw = D.GEN.rows.find(r => r.name.startsWith('LPC variable')); const xx = (rw.x_le + rw.x_te) / 2, rr = .392;
      PW.add('lpc-sva', G.revolve([[xx + .007, rr], [xx - .007, rr], [xx - .007, rr + .014], [xx + .007, rr + .014]], { seg: 128 }), 'steel');
      PW.add('lpc-sva', G.ringInstances(new THREE.BoxGeometry(.03, .022, .009).translate(-.004, rr - .005, 0), PW.partMat('lpc-sva', 'darkBox'), 40, { x: xx + .006 }), null);
      can('lpc-sva', -1.12, 5.0, .455, .028, .18, 'steel'); box('lpc-sva', -1.15, 5.15, .468, .08, .04, .05, 'darkBox');
      { const g = Kt.frame('lpc-sva', -1.15, 5.15, .468); for (const x of [-.035, .005]) Kt.fitting('lpc-sva', g, [x, 0, .025], 'z', .006); }   // servo fuel in and out (p.167), on the side away from the actuator body
      line('lpc-sva', [P(-1.03, 5.0, .455), P(-.95, 5.0, .466), P(-.80, 5.0, .468), P(xx - .02, 5.0, .43)], .007, 'tube', { clamps: 0, ends: false });
      box('lpc-sva', xx - .025, 5.0, .425, .04, .06, .03, 'steel'); }                                                                       // bellcrank on the ring
    PW.part('bleed-25', { parent: 'air', label: '2.5 bleed valve and actuator', src: 'p.264-267',
      info: 'Ring valve round the LPC case just forward of the CIC, at station 2.5. Opened, it dumps LPC exit air into the fan stream, giving the LPC surge margin during starts, low power and transients and throwing out dirt, rain and ice on the ground. Its actuator is horizontal on the right side, on the aft face of the CIC firewall, and works the ring through a bellcrank. It runs on IFPC servo fuel through an integral torque motor.\n\nThe EEC schedules it on N1, biased with altitude and Mach: open for start and idle, modulating in transients, closed at takeoff. It fails open. On a surge the EEC opens it, selects continuous ignition on both igniters and resets the variable vanes.' });
    { PW.add('bleed-25', G.ring(-.895, -.93, .425, .455, { seg: 128 }), 'nickel'); PW.add('bleed-25', G.boltCircle(PW.partMat('bleed-25', 'steel'), -.893, .44, 48, .004), null);
      can('bleed-25', -1.12, 3.0, .455, .03, .18, 'steel'); box('bleed-25', -1.15, 2.85, .47, .08, .04, .05, 'darkBox');                   // actuator with its torque motor
      { const g = Kt.frame('bleed-25', -1.15, 2.85, .47); for (const x of [-.035, .005]) Kt.fitting('bleed-25', g, [x, 0, -.025], '-z', .006); }   // servo fuel in and out (p.167), on the side away from the actuator body
      line('bleed-25', [P(-1.03, 3.0, .455), P(-.95, 3.0, .462), P(-.86, 3.0, .466)], .007, 'tube', { clamps: 0, ends: false });
      box('bleed-25', -.85, 3.0, .468, .05, .05, .03, 'steel'); }                                                                            // bellcrank ahead of the ring
    PW.part('hpc-bleed-valve', { parent: 'air', label: 'HPC bleed valve and pressure sensor', src: 'p.264-267',
      info: 'Two-position poppet valve on top of the HPC at the 6th-stage bleed port. It is spring-loaded open for the start, dumping 6th-stage air into the core compartment, and HPC pressure (station 2.9) closes it; it is fully closed by idle. The cowl anti-ice valves open during the start as well, adding bleed through the anti-ice ducting.\n\nA sense line runs forward over the case to the pressure sensor on the CIC firewall, upper right. The EEC uses it to detect a valve that fails open after the start, putting hot air into the core compartment, or one that stays closed during the start, which can stall the HPC.' });
    { const xb = -1.53, rb = Math.max(rCase(xb), .235);
      can('hpc-bleed-valve', xb, 12, rb + .045, .035, .09, 'steel', { rot: [G.clock(12), 0, Math.PI / 2] }); box('hpc-bleed-valve', xb, 12, rb + .105, .07, .03, .07, 'darkBox');
      line('hpc-bleed-valve', [P(xb, 12, rb + .12), P(-1.45, 12.15, .335), P(-1.34, 12.35, .33), P(-1.20, 12.7, .345), P(-1.13, 1.2, .37), P(-1.08, 1.75, .405), P(-1.04, 2.05, .445), P(-1.02, 2.12, .455)], .005, 'tube', { clamps: 4 });
      box('hpc-bleed-valve', -1.005, 2.15, rFire(-1.005) + .02, .05, .04, .045, 'steel'); }                                                    // pressure sensor, clear of the right thrust link's clevis
    /* ---- engine bleed, TTM ch. 36 (p.576-579): 4th-stage air through a check valve, or 8th-stage air through the high-pressure valve,
       joins, passes the bleed monitoring pressure sensor and the pressure-regulating shutoff valve, and enters the precooler; the bleed
       temperature sensor is on the precooler's outlet, where the starter duct branches off. The TTM gives that order, not where the
       units sit. The precooler, its fan-air duct and fan air valve, the outlet duct with the temperature sensor and the starter branch
       are placed from the manual's starting figure (p.297, a left side view, scaled off the fan case at about 2.47 mm a pixel at 150
       dpi, engine centreline at pixel row 590); the bleed ports from the HPC stages (p.53). The check valve, HPV, pressure sensor and
       PRSOV are ASSUMED positions, packed above the rear of the HPC to the right of the 6th-stage bleed valve, inside the HPT cooling
       tubes, where p.297's precooler inlet points */
    PW.part('bleed-hp', { parent: 'air', label: 'Bleed ports and ducts (4th and 8th stage)', src: 'p.264; p.53; TTM ch. 36 (p.576-579)',
      info: 'Customer bleed for the aircraft (air conditioning packs, wing anti-ice, fuel tank inerting and engine starting) is taken from the HPC case at the 4th stage, through a check valve, or from the 8th stage through the high-pressure valve when 4th-stage pressure is too low for the demand. A check valve keeps 8th-stage air from flowing back into the 4th stage. The joined duct passes the bleed monitoring pressure sensor and the pressure-regulating shutoff valve into the precooler above the core.\n\nA duct leak in the core compartment is detected by the overheat loops and can open the IFS pressure-relief door. The positions of the valves and the sensor along the duct are assumed: the manuals give their order, not where they sit.' });
    const hB = 12.45;                                                                                                // clock of the bleed duct over the rear HPC
    const r8 = D.GEN.rows.find(r => r.name.startsWith('HPC rotor 8')), x8 = (r8.x_le + r8.x_te) / 2, J = P(x8, hB, .35);   // the junction, over the 8th-stage port
    { const r4 = D.GEN.rows.find(r => r.name.startsWith('HPC rotor 4')), x4 = (r4.x_le + r4.x_te) / 2;
      PW.add('bleed-hp', G.revolve([[x4 + .03, rCase(x4)], [x4 - .03, rCase(x4)], [x4 - .03, rCase(x4) + .035], [x4 + .03, rCase(x4) + .035]], { seg: 96 }), 'nickel');     // 4th-stage manifold collar
      line('bleed-hp', [P(x4, hB, rCase(x4) + .033), P(x4 - .012, hB, .318), P(-1.445, hB, .345), P(-1.464, hB, .347)], .035, 'duct', { clamps: 0 });   // to the check valve
      line('bleed-hp', [P(-1.486, hB, .347), P(-1.52, hB, .35), P(-1.565, hB, .35), J], .035, 'duct', { clamps: 0 });                               // on to the junction
      Kt.ball('bleed-hp', PW.parts.get('bleed-hp').obj, J.toArray(), .041, 'nickel');                                                               // the junction tee
      PW.part('bleed-cv', { parent: 'bleed-hp', label: '4th-stage bleed check valve', src: 'TTM ch. 36 (p.576-579)',
        info: 'Flapper check valve in the 4th-stage bleed duct, ahead of the junction with the 8th-stage air. When the high-pressure valve is open, the higher 8th-stage pressure closes it, so 8th-stage air cannot flow back into the 4th stage. Its position on the duct is assumed.' });
      { const g = Kt.frame('bleed-cv', -1.475, hB, .347);
        Kt.cyl('bleed-cv', g, [0, 0, 0], 'x', .043, .02, 'castAl', { edge: .003 });
        for (const s of [-1, 1]) Kt.flange('bleed-cv', g, [s * .0135, 0, 0], s > 0 ? 'x' : '-x', .035, .047, .006, 8, 'steel');
        Kt.decal('bleed-cv', g, [0, .0435, 0], 'y', 'z', .03, .012, 'FLOW >'); }                                      // reads aft, with the flow
      PW.part('hpv', { parent: 'bleed-hp', label: 'High-pressure valve (HPV)', src: 'TTM ch. 36 (p.576-579); p.186-187',
        info: 'Valve on the 8th-stage bleed port. The integrated air system controllers (IASCs) open it when 4th-stage pressure is too low for the demand, and the bleed then comes from the 8th stage; otherwise it stays closed and the bleed comes from the 4th stage. Its open or closed state goes to the EEC, which uses it in setting idle (p.186-187).\n\nThe actuator with its position indicator is on the forward side. Its position over the port is assumed.' });
      { const g = Kt.frame('hpv', x8, hB, rCase(x8));
        Kt.cyl('hpv', g, [0, .004, 0], 'y', .038, .008, 'nickel');                                                    // port boss on the case
        for (const y of [.011, .047]) Kt.flange('hpv', g, [0, y, 0], 'y', .024, .039, .005, 6, 'steel');
        Kt.cyl('hpv', g, [0, .029, 0], 'y', .033, .03, 'castAl', { edge: .004 });                                     // butterfly body
        Kt.cyl('hpv', g, [.022, .028, 0], 'x', .009, .014, 'castAl'); Kt.box('hpv', g, [.042, .028, 0], [.034, .028, .042], 'castAl', { round: .006 });   // shaft housing and actuator
        Kt.cyl('hpv', g, [.042, .028, .0215], 'z', .012, .003, 'plateAl');                                            // position indicator
        Kt.connector('hpv', g, [.06, .03, .012], 'x', .008); }
      PW.part('bmps', { parent: 'bleed-hp', label: 'Bleed monitoring pressure sensor (BMPS)', src: 'TTM ch. 36 (p.576-579)',
        info: 'Pressure sensor on the bleed duct after the junction of the 4th and 8th-stage air, ahead of the pressure-regulating shutoff valve. The IASCs use it to control the high-pressure valve. Its position is assumed.' });
      { const g = Kt.frame('bmps', -1.585, hB, .383);
        Kt.cyl('bmps', g, [0, .002, 0], 'y', .012, .01, 'steel'); Kt.hex('bmps', g, [0, .012, 0], 'y', .01, .008, 'steel');
        Kt.cyl('bmps', g, [0, .024, 0], 'y', .0095, .018, 'steel'); Kt.connector('bmps', g, [0, .034, 0], 'y', .007, { lead: 'z' }); } }

    /* p.297: the precooler hangs in the upper bifurcation just above the core, from x -1.69 to -2.08, pitched about 17 deg nose-up. Fan
       air comes aft from the precooler duct inlet casting through a bellows and the fan air valve, opens out into its forward face and
       leaves through the aft face into the core compartment. Bleed comes up into the lower header through the inlet the figure shows
       pointing forward and down, and leaves the upper header aft, where the outlet duct rises into the pylon and the starter duct drops
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
      /* the bleed inlet: from the PRSOV's outlet flange up into the lower header */
      const M = V(-1.665, .395, 0), dJM = M.clone().sub(J).normalize(), s0 = J.clone().addScaledVector(dJM, .094), s1 = M.clone().addScaledVector(dJM, .075);
      Kt.cone('precooler', W, s0.clone().add(s1).multiplyScalar(.5).toArray(), dJM, .057, .05, s0.distanceTo(s1), 'nickel');
      /* the hanging lug, its link up to the pylon, and the strut from the lower corner to the aft mount fitting */
      { const lug = pcW(.10, .2); Kt.box('precooler', W, lug.toArray(), [.05, .03, .04], 'steel', { round: .006 });
        const top = V(-1.80, 1.012, 0); Kt.rod('precooler', W, [lug.x, lug.y + .012, 0], top.toArray(), .009, 'steel'); Kt.box('precooler', W, [top.x, 1.006, 0], [.05, .016, .05], 'steel', { round: .004 }); }
      { const a = pcW(-.09, -.25, -.075), b = V(-2.522, .76, -.062);
        Kt.box('precooler', W, pcW(-.09, -.245, -.072).toArray(), [.04, .03, .012], 'steel', { round: .004 });
        Kt.rod('precooler', W, a.toArray(), b.toArray(), .012, 'steel'); for (const p of [a, b]) Kt.ball('precooler', W, p.toArray(), .017, 'steel');
        Kt.box('precooler', W, [-2.526, .76, -.062], [.012, .05, .03], 'steel', { round: .003 }); }
      /* fan-air side: the duct from the inlet casting, its bellows and the diffuser from the fan air valve into the forward face */
      const fav0 = V(-1.5815, .6993, 0), fav1 = V(-1.6685, .6857, 0), aD = V(-.9879, -.1554, 0);                    // valve inlet and outlet faces, duct axis aft
      line('precooler', [V(-1.148, .768, 0), V(-1.30, .7443, 0), V(-1.45, .7206, 0), fav0], .085, 'tube', { clamps: 0, ends: false, tension: .1, mat: 'plateAl' });
      { const bf = Kt.frame('precooler', -1.205, 12, .759, { rz: .156 }), cv = [[.042, 0], [.042, .087]];
        for (let i = 0; i <= 48; i++) cv.push([.038 - .076 * i / 48, .0915 + .0055 * Math.cos(i / 48 * TAU * 6)]);
        cv.push([-.042, .087], [-.042, 0]); Kt.prof('precooler', bf, [0, 0, 0], 'x', cv, 'steel', { seg: 40 });
        for (const s of [-1, 1]) Kt.vband('precooler', bf, [s * .046, 0, 0], 'x', .086, { phase: 0 }); }
      for (const xx of [-1.37, -1.50]) { const yc = .768 + (1.148 + xx) * .1585, g = Kt.frame('precooler', xx, 12, yc, { rz: .156 });   // straps, each hung from the pylon on a rod
        Kt.vband('precooler', g, [0, 0, 0], 'x', .086, { phase: 0, width: .022 }); Kt.rod('precooler', W, [xx - .017, yc + .11, 0], [xx - .017, 1.012, 0], .005, 'steel'); }
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
      /* wiring to the IASCs: down from the pylon on the right of the fan-air duct to a breakout over the PRSOV */
      const bk = V(-1.565, .52, .075);
      line('precooler', [V(-1.55, 1.017, .12), V(-1.55, .90, .125), V(-1.55, .78, .108), V(-1.55, .70, .10), V(-1.55, .63, .085), V(-1.555, .57, .07), bk], .006, 'harness', { clamps: 2, ends: false });
      line('precooler', [V(-1.5084, .2821, .080), V(-1.502, .295, .105), V(-1.507, .33, .13), V(-1.512, .39, .126), V(-1.53, .45, .106), V(-1.55, .50, .085), bk], .005, 'harness', { clamps: 0, ends: false });   // HPV
      line('precooler', [V(-1.585, .4116, .1117), V(-1.578, .43, .108), V(-1.57, .48, .09), bk], .004, 'harness', { clamps: 0, ends: false });   // BMPS

      PW.part('fav', { parent: 'precooler', label: 'Fan air valve (FAV)', src: 'TTM ch. 36 (p.578-579); p.198; p.297',
        info: 'Butterfly valve in the fan-air duct, bolted to the precooler\'s inlet diffuser. The integrated air system controllers (IASCs) modulate it to hold the bleed temperature measured by the bleed temperature sensor on the precooler outlet: more fan air through the precooler, cooler bleed. Pressing the ENG FIRE button closes it, through the IASC, together with the pressure-regulating shutoff valve (p.198).\n\nThe round actuator on top has a position indicator on its face, with the electrical control head above it and a small tube from a tap on the precooler. The manual\'s starting figure (p.297) draws the valve here but does not label it.' });
      { const f = Kt.frame('fav', -1.625, 12, .6925, { rz: .156 });
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
      Kt.fitting('precooler', pf, [.10, .045, -.0835], '-z', .006);                                                     // tap for the valve's tube
      line('fav', [V(-1.7065, .8333, -.004), V(-1.722, .826, -.035), V(-1.742, .80, -.088), V(-1.755, .76, -.099), V(-1.765, .725, -.097), V(-1.7676, .7172, -.0922)], .005, 'tube', { clamps: 1 });
      line('fav', [V(-1.622, .958, 0), V(-1.621, .99, .004), V(-1.62, 1.017, .006)], .006, 'harness', { clamps: 0, ends: false });

      PW.part('prsov', { parent: 'precooler', label: 'Pressure-regulating shutoff valve (PRSOV)', src: 'TTM ch. 36 (p.576-579); p.198',
        info: 'Butterfly valve between the bleed sources and the precooler. It regulates the pressure of the bleed air delivered to the aircraft and shuts the engine\'s bleed off. The integrated air system controllers (IASCs) control and monitor it, and it is also controlled from the L (R) BLEED button on the AIR panel. Pressing the ENG FIRE button closes it, through the IASC, with the fan air valve (p.198).\n\nThe actuator on top has a position indicator and a manual override nut. Its position is assumed: the TTM places it after the junction of the 4th and 8th-stage air and before the precooler; here it is bolted to the precooler\'s bleed inlet.' });
      { const P2 = PW.parts.get('prsov').obj, a = J.clone().addScaledVector(dJM, .028), b = J.clone().addScaledVector(dJM, .09), c = a.clone().add(b).multiplyScalar(.5);
        Kt.cyl('prsov', P2, c.toArray(), dJM, .046, .058, 'castAl', { edge: .005 });
        for (const [p, s] of [[a, -1], [b, 1]]) Kt.flange('prsov', P2, p.toArray(), dJM.clone().multiplyScalar(s), .04, .052, .007, 8, 'steel');
        const up = V(0, 1, 0).addScaledVector(dJM, -dJM.y).normalize(), ac = c.clone().addScaledVector(up, .078);
        Kt.cyl('prsov', P2, c.clone().addScaledVector(up, .05).toArray(), up, .014, .022, 'castAl');                     // shaft neck
        Kt.cyl('prsov', P2, ac.toArray(), up, .036, .046, 'castAl', { edge: .006 });                                      // actuator
        Kt.cyl('prsov', P2, ac.clone().addScaledVector(up, .0245).toArray(), up, .028, .004, 'plateAl');                  // position indicator
        Kt.hex('prsov', P2, ac.clone().addScaledVector(up, .03).toArray(), up, .007, .008, 'steel');                      // manual override nut
        Kt.cyl('prsov', P2, ac.clone().add(V(0, 0, .043)).toArray(), 'z', .016, .03, 'darkBox');                          // torque motor
        Kt.connector('prsov', P2, ac.clone().add(V(0, 0, .058)).toArray(), 'z', .009, { lead: 'y' });
        const pe = ac.clone().add(V(0, .0162, .0751));
        line('prsov', [pe, V(pe.x + .01, pe.y + .03, pe.z - .02), V(-1.58, .50, .095), bk], .005, 'harness', { clamps: 0, ends: false }); }

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
    { PW.add('tacc', G.revolve([[-1.915, .258], [-2.015, .262], [-2.015, .286], [-1.915, .282]], { seg: 128, crease: 60 }), 'nickel');                // HPT manifold
      for (const xx of [-1.93, -1.965, -2.0]) PW.add('tacc', G.revolve(circ(xx, .29, .006, 8), { seg: 128 }), 'nickel');
      for (const xx of [-2.25, -2.32, -2.39]) { const rr = Math.max(rCase(xx), .24) + .025; PW.add('tacc', G.revolve([[xx + .012, rr - .012], [xx - .012, rr - .012], [xx - .012, rr + .012], [xx + .012, rr + .012]], { seg: 128, crease: 80 }), 'steel'); }
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
    /* p.278-281: the split buffer system. Each unit sits at the position the manual gives; the ducts between them are only stubs */
    PW.part('buffer-air', { parent: 'air', label: 'Buffer air system', src: 'p.278-283',
      info: 'Cooling and pressurizing air for the bearing compartment seals. At high power, 2.5 (LPC exit) air feeds the front compartment (No. 1, 1.5 and 2 bearings), No. 3 and No. 5/6 through the buffer air check valve (BACV). Below 75 percent N1 the 2.5 air is too weak, so the EEC energizes the buffer air valve solenoid (BAVS), which opens the buffer air shutoff valve (BASOV) and sends 4th-stage HPC air instead; the BACV then closes so the 4th-stage air cannot flow back. The No. 4 bearing compartment always gets 4th-stage air, cooled by 2.5 air in the buffer air heat exchanger (BAHX). The buffer air pressure sensor (BAPS) downstream of the BASOV tells both EEC channels whether the valve is where it should be for the power setting.\n\nPositions: BAHX on the fan intermediate case in the 2.5 bleed cavity at 12 o\'clock, BACV at 12 o\'clock on the FIC, BAPS below the BAHX at 2 o\'clock, BASOV at the rear of the HPC at 11 o\'clock, BAVS on the right of the HPC case at 1 o\'clock. The ducts joining them are not drawn yet.' });
    { const f = Kt.frame('buffer-air', -.80, 12, .40);                                                                        // BAHX: plate-fin core in a cast frame, data plate on top
      Kt.box('buffer-air', f, [0, 0, 0], [.12, .07, .18], 'castAl', { round: .008 }); Kt.box('buffer-air', f, [0, .0, .0], [.09, .072, .15], 'darkBox', { round: .002 });
      for (let i = 0; i < 12; i++) Kt.box('buffer-air', f, [-.045 + i * .0082, .0365, 0], [.0025, .002, .14], 'nickel', { round: .0005 });
      Kt.plate('buffer-air', f, [.0, .036, .062], 'y', 'x', .05, .025);
      for (const s of [-1, 1]) { Kt.cyl('buffer-air', f, [s * .07, .01, s * .05], 'x', .016, .02, 'castAl'); Kt.flange('buffer-air', f, [s * .082, .01, s * .05], s > 0 ? 'x' : '-x', .016, .026, .005, 4, 'castAl'); } }
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
       the HPC to the BASOV's pilot port; the pressure sensor (BAPS) reads the buffer air at the heat exchanger's outlet */
    line('buffer-air', [P(-1.211, .78, .32), P(-1.195, .74, .322), P(-1.19, .5, .315), P(-1.19, 12.0, .312), P(-1.19, 11.7, .31), P(-1.30, 11.7, .305), P(-1.42, 11.7, .30), P(-1.46, 11.45, .335), P(-1.50, 11.25, .355), P(-1.53, 11.12, .365), P(-1.552, 10.96, .345), P(-1.55, 10.88, .315), P(-1.53, 10.9, .30), P(-1.515, 10.97, .298), P(-1.505, 11.03, .298)], .004, 'tube', { clamps: 3 });   // pilot to the BASOV: over the top, across the left core harness aft of the fuel/oil cooler, then over the HPT cooling tube beside the valve and into its aft-facing port
    line('buffer-air', [P(-1.211, .92, .32), P(-1.195, .95, .325), P(-1.25, .98, .328), P(-1.33, .98, .305), P(-1.395, .96, .287)], .004, 'tube', { clamps: 0 });   // pilot supply from the 4th-stage collar
    line('buffer-air', [P(-.771, 1.9, .408), P(-.752, 1.9, .41), P(-.735, 1.5, .418), P(-.725, 1.0, .42), P(-.72, .55, .418), P(-.718, .28, .41)], .004, 'tube', { clamps: 1 });   // BAPS sense line
    /* p.276-277: four tubes take 6th-stage HPC air to the HPT 2nd stage vanes and blade attachments, two on each side, arching over the
       case from the 6th-stage ports to the HPT case just ahead of the clearance control manifold, metered by plates at the case */
    PW.part('hpt-cooling', { parent: 'air', label: 'HPT cooling air tubes (6th stage)', src: 'p.276-277',
      info: 'Four tubes carry 6th-stage HPC air to the HPT 2nd stage vanes and blade attachments. Metering plates between the tubes and the HPT case set the flow; the air passes through the hollow vanes and leaves at their trailing edges. The 4th-stage air that cools the TIC fairings, the LPT case and the LPT rotor and blade attachments goes through its own tubes (TIC and LPT cooling air tubes).' });
    for (const h of [10.45, 11.15, .85, 1.6]) {
      line('hpt-cooling', [P(-1.515, h, .251), P(-1.53, h, .30), P(-1.56, h, .345), P(-1.70, h, .357), P(-1.85, h, .357), P(-1.88, h, .32), P(-1.893, h, .27), P(-1.895, h, .245)], .015, 'tube', { clamps: 2, ends: false });
      for (const [xx, rr] of [[-1.515, .251], [-1.895, .245]]) { const g = Kt.frame('hpt-cooling', xx, h, rr); Kt.box('hpt-cooling', g, [0, .006, 0], [.04, .012, .04], 'nickel', { round: .006 }); Kt.bolts('hpt-cooling', g, [0, .013, 0], 'y', .02, 4, .0035, { phase: Math.PI / 4 }); } }
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
    PW.part('cai', { parent: 'air', label: 'Cowl anti-ice duct and valves', src: 'p.10-11; TTM ch. 30; photos',
      info: 'HPC 6th-stage bleed for the inlet lip. It passes two cowl anti-ice valves in series (two for redundancy), controlled and monitored by the EEC from the L and R COWL switches (OFF, AUTO, ON), crosses the fan duct in the lower bifurcation and runs forward along the bottom right of the fan case into the inlet at 5 o\'clock, where its access panel is. The air leaves through the exhaust louvres at the bottom of the inlet. The valves also open during the start to help the HPC bleed valve unload the compressor.\n\nThe black hose with orange fittings along the fan case in the photos.' });
    { /* 6th-stage port on the right of the HPC, the two valves on the right of the core, down into the lower bifurcation at 6 o'clock,
         forward under the reverser to the fan case and along it at 5 o'clock */
      /* it passes over the hydraulic pump hoses and the actuator drain lines where they cross under it on the right of the core, and
         through the bifurcation panel low and in the middle, under the W04 harness and igniter cable A */
      const pts = [P(-1.53, 3.3, .265), P(-1.50, 3.4, .34), P(-1.42, 3.55, .44), P(-1.36, 3.9, .49), P(-1.38, 4.6, .508), P(-1.32, 5.3, .505), P(-1.22, 5.6, .497), P(-1.15, 5.85, .485), P(-1.11, 5.98, .52), P(-1.10, 6.0, .60),
        P(-1.08, 6.0, .76), P(-1.05, 6.0, .90), P(-1.03, 6.0, .975), P(-.985, 6.0, .995), P(-.93, 5.96, 1.0), P(-.88, 5.86, 1.008), P(-.833, 5.7, 1.04), P(-.78, 5.52, 1.055), P(-.62, 5.1, 1.035), P(-.55, 5.0, 1.03), P(.20, 5.0, 1.0), P(.34, 5.0, 1.03)];
      const c = line('cai', pts, .03, 'black', { clamps: 6 });
      PW.add('cai', G.alongCurve(c, [tAt(c, -.985)], () => new THREE.CylinderGeometry(.036, .036, .07, 20)), 'rubber', { mat: { color: '#9cc6e8' } }).userData.isLine = true;   // light blue sleeve where it passes the bifurcation panel (photo)
      PW.add('cai', G.alongCurve(c, [.085, .16], () => new THREE.CylinderGeometry(.045, .045, .085, 20)), 'steel');                         // the two cowl anti-ice valves, in series
      for (const p of [P(-.62, 5.1, 1.035), P(.20, 5.0, 1.0)]) { const m = new THREE.Mesh(G.can(.042, .09)); m.position.copy(p); PW.add('cai', m, 'clampOrange', { solid: true }); } }

    /* ============================== ELECTRICAL AND CONTROL ============================== */
    PW.part('eec', { label: 'Electronic engine control (EEC)', explode: [0, 0, -.6], src: 'p.74-95, p.104-105; photos',
      info: 'Dual-channel FADEC computer on the left side of the fan case at 9 o\'clock, on four vibration isolators, cooled by fan compartment air. Each channel has a control and a protection processor. It sets thrust, schedules fuel, vanes, bleeds and clearance control, runs starts and the reverser logic, and stores faults.\n\nThe data storage unit plugged into it holds the engine rating and trim data; it stays with the engine if the EEC is changed. Eight connectors: check them seated and locked after any EEC work.' });
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
      /* p.102: the Pamb sensor reads ambient pressure through a port on the EEC (screened, no line); the other port takes the P2 sense
         line from the inlet's P2/T2 probe */
      Kt.fitting('eec', f, [.262, 0, .04], 'x', .008); Kt.fitting('eec', f, [.262, 0, -.03], 'x', .008, { plugged: true }); Kt.cyl('eec', f, [.278, 0, -.03], 'x', .0075, .006, 'darkBox');
      PW.part('dsu', { parent: 'eec', label: 'Data storage unit (DSU)', src: 'p.90-91, p.104-105',
        info: 'Small round plug, a Hamilton Sundstrand DSU1230-1, in connector J99 on the face of the EEC, on a lanyard. It holds the engine serial number and the rating and trim data in flash memory, read by both channels\' protection processors. It stays with the engine: when an EEC is changed, the new EEC reads the engine\'s data from it.' });
      const g = Kt.frame('dsu', ex, eh, er); Kt.cyl('dsu', g, [-.07, .052, .07], 'y', .021, .012, 'steel', { edge: .003 }); Kt.cyl('dsu', g, [-.07, .061, .07], 'y', .018, .008, 'capBlack', { edge: .002 });
      Kt.rod('dsu', g, [-.07, .057, .05], [-.03, .05, .035], .0015, 'steel'); }
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
      /* the P2 sense line from the probe's pneumatic disconnect beside it at flange A down the case to the EEC's P2 port (p.102) */
      { const g = Kt.frame('harnesses', .33, 10.95, rc); Kt.cyl('harnesses', g, [0, .046, 0], 'x', .007, .018, 'steel'); Kt.hex('harnesses', g, [-.01, .046, 0], 'x', .007, .006, 'steel'); }
      line('harnesses', [P(.322, 10.95, 1.016), P(.315, 10.7, 1.015), P(.30, 10.25, 1.015), P(.275, 9.7, 1.022), P(.245, 9.25, 1.035), P(.215, 9.07, 1.046), P(.194, 9.07, 1.046)], .004, 'tube', { clamps: 2 });
      /* the powerpack's second connector into the run that serves its motor connector */
      harn([P(-.491, 2.26, 1.11), P(-.47, 2.26, 1.11), P(-.45, 2.15, 1.07), P(-.43, 2.06, 1.025)], .006);
      /* the left core harness from the junction at the bottom (p.105): up the left forward of the IFPC, over the layshaft, past the Pb
         sensor and over the HPC to the top; WC05 branches from it and runs aft along the top in the pylon gap, over the clearance control
         manifolds, to the EGT probe junctions behind the LPT */
      line('harnesses', [P(-1.35, 6.9, .42), P(-1.19, 7.4, .38), P(-1.19, 8.2, .375), P(-1.25, 9.5, .325), P(-1.30, 10.1, .325), P(-1.35, 10.65, .315), P(-1.40, 11.1, .305), P(-1.445, 11.2, .305), P(-1.50, 11.42, .31), P(-1.58, 11.6, .31), P(-1.65, 11.9, .31), P(-1.68, 12.15, .31)], .012, 'harness', { clamps: 4 });   // under the FOHX end plate, left of the 4th-stage bleed duct
      line('harnesses', [P(-1.0606, 10.16, .413), P(-1.09, 10.1, .385), P(-1.13, 10.0, .375), P(-1.18, 9.8, .345), P(-1.22, 9.62, .33), P(-1.245, 9.55, .326)], .006, 'harness', { clamps: 0, ends: false });   // Pb sensor
      /* WC08 (p.107) up the right of the core along the CIC fire seal, under the 2.5 bleed and LPC vane actuators and behind the N1
         probe, to 1 o'clock; branches to the N1 probe's two connectors, the P2.5/T2.5 probe and, aft over the HPC, the T3 probe */
      line('harnesses', [P(-1.35, 6.9, .42), P(-1.3, 6.7, .40), P(-1.2, 6.3, .36), P(-1.13, 6.0, .345), P(-1.115, 5.5, .34), P(-1.115, 5.0, .34), P(-1.115, 4.5, .34), P(-1.115, 4.0, .34),
        P(-1.115, 3.5, .34), P(-1.115, 3.0, .34), P(-1.115, 2.5, .34), P(-1.115, 2.0, .34), P(-1.115, 1.5, .34), P(-1.115, 1.2, .34)], .011, 'harness', { clamps: 5, ends: false, bands: [.03] });
      for (const dx of [-.009, .009]) line('harnesses', [P(-1.065 + dx, 4.8, .41), P(-1.09 + dx * .5, 4.86, .38), P(-1.112, 4.92, .345)], .005, 'harness', { clamps: 0, ends: false });   // N1 probe
      line('harnesses', [P(-1.0355, 1.19, .486), P(-1.05, 1.22, .47), P(-1.09, 1.22, .40), P(-1.115, 1.2, .35)], .006, 'harness', { clamps: 0, ends: false });                  // P2.5/T2.5 probe
      line('harnesses', [P(-1.115, 1.2, .34), P(-1.2, 1.1, .33), P(-1.35, 1.05, .327), P(-1.5, 1.02, .31), P(-1.6, 1.0, .295), P(-1.645, 1.0, .287)], .007, 'harness', { clamps: 3, ends: false });   // T3 probe
      /* the gearbox units (p.107 draws a cluster of branches round the gearbox; the photos from below show braided runs along its aft
         side). A trunk leaves W03/W04 where they come up from the bifurcation and runs aft under the MGB at about 6:30 to its aft face.
         There one branch takes the PMAG's two connectors and the VFG's left connector; one goes up the left of the starter to its speed
         sensor and on aft to the starter air valve; one crosses back under the VFG to the oil control module's six connectors and the
         VFG's right connector. The VFG and hydraulic pump circuits belong to the aircraft (generator control unit, hydraulic system)
         and are assumed to join the bundle here. The VFG's feeder studs are left bare, as in the photo from below */
      { const leg = (pts, r) => line('harnesses', pts, r || .006, 'harness', { clamps: 0, ends: false });
        const T1 = P(-1.70, 6.64, .50), T2 = P(-1.80, 6.72, .49), T4 = P(-1.86, 8.2, .523), T6 = P(-1.70, 5.45, .48), T7 = P(-1.79, 5.1, .40);
        line('harnesses', [P(-1.35, 6.9, .42), P(-1.40, 6.82, .445), P(-1.47, 6.68, .495), P(-1.57, 6.55, .502), P(-1.65, 6.56, .50), T1], .011, 'harness', { clamps: 3, ends: false });
        leg([T1, P(-1.76, 6.68, .498), T2], .009);
        leg([P(-1.8052, 7.06, .42), P(-1.813, 6.95, .435), P(-1.81, 6.8, .47), T2], .007);                                     // PMAG, EEC channel A
        leg([P(-1.8052, 7.05, .38), P(-1.818, 6.93, .40), P(-1.82, 6.8, .45), P(-1.81, 6.74, .48), T2], .007);                 // PMAG, channel B
        leg([P(-1.776, 6.58, .46), P(-1.795, 6.6, .468), P(-1.805, 6.66, .482), T2]);                                           // VFG, left
        leg([T2, P(-1.83, 6.85, .50), P(-1.85, 7.3, .515), P(-1.86, 7.8, .52), T4], .008);
        leg([T4, P(-1.84, 8.6, .524), P(-1.80, 8.95, .51), P(-1.77, 9.1, .45), P(-1.745, 9.08, .39), P(-1.729, 9.06, .366)]);   // starter speed sensor
        leg([T4, P(-1.92, 8.3, .524), P(-2.0, 8.5, .525), P(-2.05, 8.7, .526), P(-2.068, 8.82, .53), P(-2.07, 8.85, .532)]);      // starter air valve torque motor
        leg([P(-1.57, 6.55, .502), P(-1.60, 6.2, .49), P(-1.62, 5.85, .49), P(-1.66, 5.55, .49), T6], .009);
        leg([P(-1.776, 5.72, .46), P(-1.79, 5.72, .455), P(-1.785, 5.6, .44), P(-1.75, 5.5, .445), P(-1.72, 5.46, .46), T6]);   // VFG, right
        leg([P(-1.698, 5.63, .409), P(-1.69, 5.55, .43), P(-1.695, 5.48, .46), T6]);                                           // VORV/JOSV
        leg([P(-1.762, 5.40, .477), P(-1.735, 5.43, .48), T6]);                                                                 // MOT sensor
        leg([T7, P(-1.795, 5.25, .41), P(-1.775, 5.5, .43), P(-1.735, 5.5, .455), T6], .008);
        leg([P(-1.704, 4.34, .443), P(-1.74, 4.4, .45), P(-1.785, 4.55, .45), P(-1.797, 4.8, .435), P(-1.795, 5.0, .415), T7]);   // MOP sensor
        leg([P(-1.8438, 2.057, .435), P(-1.82, 2.05, .44), P(-1.765, 2.15, .45), P(-1.737, 2.4, .455), P(-1.735, 3.0, .455), P(-1.736, 3.6, .455), P(-1.738, 4.0, .454), P(-1.74, 4.25, .452), P(-1.742, 4.385, .45)]);   // oil quantity sensor, down the tank's forward face into the MOP leg
        leg([P(-1.7525, 4.81, .33), P(-1.78, 4.88, .345), P(-1.79, 5.0, .375), T7]);                                           // active oil damper valve
        leg([P(-1.7985, 4.66, .36), P(-1.80, 4.8, .37), P(-1.797, 4.95, .385), T7]);                                           // OFDP sensor
        leg([P(-1.7935, 4.72, .405), P(-1.797, 4.9, .41), T7]); }                                                               // oil debris monitor
      line('harnesses', [P(-1.262, 6.22, .41), P(-1.24, 6.22, .405), P(-1.215, 6.27, .375), P(-1.20, 6.3, .36)], .006, 'harness', { clamps: 0, ends: false });   // hydraulic pump depressurising solenoid, into WC08
      /* the fuel units on the MGB front face into the left core harness as it passes forward of them: the IFPC's metering valve and
         overspeed solenoid, the fuel filter delta-P sensor at 7:30 and the flow meter at 9 o'clock (p.105, p.170) */
      { const leg = (pts, r) => line('harnesses', pts, r || .006, 'harness', { clamps: 0, ends: false }), J8 = P(-1.30, 7.7, .495);
        leg([P(-1.40, 7.97, .515), P(-1.395, 7.86, .522), P(-1.36, 7.72, .523), P(-1.32, 7.66, .51), J8]);                                              // overspeed shutdown solenoid
        leg([P(-1.402, 7.50, .509), P(-1.38, 7.52, .508), P(-1.34, 7.58, .505), J8]);                                            // fuel filter delta-P
        leg([J8, P(-1.25, 7.6, .46), P(-1.21, 7.48, .41), P(-1.19, 7.42, .385)], .008);
        leg([P(-1.225, 8.25, .498), P(-1.215, 8.36, .495), P(-1.20, 8.4, .45), P(-1.19, 8.3, .40), P(-1.19, 8.22, .378)]);       // fuel metering valve
        leg([P(-1.378, 9.15, .496), P(-1.35, 9.15, .495), P(-1.30, 9.25, .46), P(-1.26, 9.4, .38), P(-1.25, 9.5, .33)]); }       // fuel flow meter
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
      line('harnesses', [P(-1.67, 12.05, .305), P(-1.684, 12.35, .31), P(-1.697, 12.45, .34), P(-1.712, 12.45, .356), P(-1.75, 12.45, .356), P(-1.80, 12.45, .34), P(-1.95, 12.45, .325), P(-2.05, 12.4, .345), P(-2.10, 12.35, .385), P(-2.14, 12.3, .47), P(-2.20, 12.18, .51), P(-2.24, 12.08, .555), P(-2.40, 12.0, .56), P(-2.45, 12.0, .52), P(-2.465, 12.0, .478)], .012, 'harness', { clamps: 4 });
      /* WC05 then rings the LPT's aft flange both ways to the EGT probe junctions at 3 and 9 o'clock (p.107, p.129) */
      for (const [h0, h1] of [[12, 15], [12, 9]]) { const pts = []; for (let i = 0; i <= 15; i++) pts.push(P(-2.465, h0 + (h1 - h0) * i / 15, .474));
        line('harnesses', pts, .009, 'harness', { clamps: 5, ends: false });
        line('harnesses', [P(-2.465, h1, .474), P(-2.49, h1, .474), P(-2.51, h1, .468), P(-2.518, h1, .462)], .006, 'harness', { clamps: 0, ends: false }); } }
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
          P(-1.05, 6.0 + 3 * dh, 1.03), P(-1.11, 6.0 + 3 * dh, .99), P(-1.15, 6.0 + 2.5 * dh, .86), P(-1.18, 6.0 + 2 * dh, .72), P(-1.21, 5.97 + da, .58), P(-1.30, 5.9 + da, .52), P(-1.50, 5.85 + da, .525), P(-1.75, 5.78 + dh * 1.5, .53)];
        const tail = hp < 4.5 ? [P(-1.82, 5.2, .505), P(-1.82, 4.8, .50), P(-1.815, 4.5, .49), P(-1.79, 4.3, .45), P(-1.80, 4.15, .40), P(-1.81, 4.06, .37), P(-1.81, hp, .347)]
          : [P(-1.835, 5.45, .47), P(-1.835, 5.15, .42), P(-1.82, 5.03, .385), P(-1.81, hp, .347)];   // B keeps aft of the OCM's sensor harness
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
        Kt.cyl('igniters', g, [0, -.012, 0], 'y', .0055, .022, 'nickel'); } }
    PW.part('sensors', { label: 'Engine sensors', explode: [0, .2, .2], src: 'p.102-161',
      info: 'Speed probes for N1 (station 2.5 at 4:30 on the CIC) and fan speed (inside the No. 1 bearing support at 1 o\'clock), the PMAG\'s coils for N2, T3 and P3 at the HPC exit, the EGT probes at station 5 on the turbine exhaust case, two vibration sensors, and the oil sensors on the OCM. Their signals go to the EEC; vibration and oil debris also go to the PHMU.' });
    { /* EGT (p.126-129): two semi-rigid probe and cable assemblies of four probes each on the forward cone of the turbine exhaust case,
         just aft of the LPT flange: right probes at 0:45 to 5:15 with their probe junction at 3 o'clock, left ones at 6:45 to 11:15 with
         theirs at 9. Each probe stands normal to the cone (25 deg), its sheath reaching forward and in to the gas path; the cable runs
         round just aft of the flange with a stub into each probe head */
      PW.part('egt', { parent: 'sensors', label: 'EGT probe and cable assemblies (2)', src: 'p.126-133',
        info: 'Exhaust gas temperature at station 5: two probe and cable assemblies, left and right, each of four thermocouple probes on a semi-rigid cable round the turbine exhaust case. The probes are not replaceable on their own: the whole assembly is changed. The four signals of each assembly are averaged at its probe junction (3 and 9 o\'clock) and compensated at the oil temperature probe on the OCM; the left assembly goes to EEC channel A, the right to channel B.\n\nOne failed assembly gives an L(R) ENGINE FAULT advisory. Limits: 1054 deg C for start and takeoff, 1006 deg C maximum continuous (p.131).' });
      const xe = -2.52, re = .41, tilt = .444;
      for (const [hs, hj] of [[[.75, 2.25, 3.75, 5.25], 3], [[6.75, 8.25, 9.75, 11.25], 9]]) {
        for (const h of hs) { const f = Kt.frame('egt', xe, h, re, { rz: tilt });
          Kt.box('egt', f, [0, .002, 0], [.026, .004, .016], 'steel', { round: .002 }); for (const s of [-1, 1]) Kt.hex('egt', f, [s * .01, .0055, 0], 'y', .0032, .003, 'steel');   // two-bolt flange
          Kt.box('egt', f, [0, .013, 0], [.016, .018, .018], 'steel', { round: .003 });                                        // terminal head
          Kt.cyl('egt', f, [.02, .016, 0], 'x', .0028, .026, 'steel');                                                        // stub to the cable
          Kt.cyl('egt', f, [0, -.04, 0], 'y', .0042, .08, 'nickel'); Kt.cyl('egt', f, [0, -.083, 0], 'y', .0055, .012, 'nickel'); }   // sheath and tip shield
        const run = (a, b) => { const pts = [], n = Math.max(2, Math.ceil(Math.abs(b - a) / .2)); for (let i = 0; i <= n; i++) pts.push(P(-2.497, a + (b - a) * i / n, .438)); return pts; };
        line('egt', run(hs[0], hj - .09), .0028, 'tube', { clamps: 0, ends: false }); line('egt', run(hs[3], hj + .09), .0028, 'tube', { clamps: 0, ends: false });
        const g = Kt.frame('egt', -2.512, hj, .418, { rz: tilt });                                                             // probe junction
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
        Kt.cyl('n1-probe', f, [0, -.012, 0], 'y', .0095, .024, 'steel'); Kt.cyl('n1-probe', f, [0, -.1, 0], 'y', .0055, .16, 'steel'); Kt.cyl('n1-probe', f, [0, -.185, 0], 'y', .0045, .012, 'steel'); }
      /* vibration sensors (p.138-141): forward, an accelerometer on a three-bolt bracket on the intermediate case at 9 o'clock, its lead
         down the cone into WC08; aft, a block sensor on the LPT case at 3 o'clock, behind the clearance control rings, into WC05 */
      PW.part('vib-sensors', { parent: 'sensors', label: 'Vibration sensors (2)', src: 'p.134-141',
        info: 'Two accelerometers feeding the PHMU. The forward one is on the intermediate case at 9 o\'clock; with fan speed it gives fan vibration and the fan trim balance solutions. The aft one is on the LPT case at 3 o\'clock.\n\nThe PHMU works out fan, N1 and N2 vibration and sends it to the EEC for EICAS: an amber VIB flag on N1 above 0.52 in/s and next to N2 above 1.2 in/s; FAN VIB in units from 0 to 8, where 4.0 is 100 percent of its 1.2 in/s threshold. Exceedances give the ENG VIBRATION caution.' });
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
      { const f = Kt.frame('t3-probe', -1.655, 1.0, .245);                                                                      // p.107: two terminal posts on a block, a flange with two slotted ears
        Kt.box('t3-probe', f, [0, .003, 0], [.03, .006, .072], 'steel', { round: .004 }); for (const s of [-1, 1]) Kt.hex('t3-probe', f, [0, .0075, s * .03], 'y', .0035, .003, 'steel');
        Kt.box('t3-probe', f, [0, .016, 0], [.028, .02, .046], 'steel', { round: .003 });
        for (const s of [-1, 1]) { Kt.cyl('t3-probe', f, [0, .032, s * .011], 'y', .0055, .014, 'steel'); Kt.hex('t3-probe', f, [0, .036, s * .011], 'y', .0065, .004, 'steel'); }
        Kt.cyl('t3-probe', f, [0, -.03, 0], 'y', .004, .06, 'nickel'); }
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
    PW.part('tras-control', { label: 'Thrust reverser control units (ICU, DCU)', explode: [0, .35, 0], src: 'p.326-345',
      info: 'The thrust reverser actuation system is electrically controlled and hydraulically worked. The EEC opens the isolation control unit to let aircraft hydraulic pressure into the system and the directional control unit to unlock, deploy, stow and lock the sleeves; the CDCs work the track lock valves. Thrust reverse needs the aircraft on the ground (weight on wheels or wheel spin-up), no manual inhibit, no reverser fault and the engine running. Once the sleeves pass 85 percent of travel the thrust levers can go to maximum reverse; an inadvertent deploy brings the engine to idle.' });
    PW.part('tras-icu', { parent: 'tras-control', label: 'Isolation control unit (ICU)', src: 'p.334-345',
      info: 'In the aft pylon, reached through access panels on both sides of the pylon. It isolates the thrust reverser actuation system from the aircraft hydraulic system until either EEC channel energizes its dual-channel solenoid, which works a pilot valve onto the isolation spool valve.\n\nThe manual inhibit lever on its side stops the isolation spool valve from operating: it is used to dispatch with a reverser inoperative and to make the system safe for maintenance, it is locked by the inhibit pin stored on the ICU, and dual-channel proximity sensors report its position.' });
    { const f = Kt.frame('tras-icu', -2.9, 12, 1.25);
      Kt.box('tras-icu', f, [0, 0, 0], [.16, .1, .12], 'castAl', { round: .012 }); Kt.box('tras-icu', f, [-.03, .065, 0], [.08, .03, .14], 'castAl', { round: .006 });   // body and mounting flange
      Kt.cyl('tras-icu', f, [.11, .02, -.02], 'x', .022, .07, 'castAl'); Kt.connector('tras-icu', f, [.145, .02, -.02], 'x', .011, { lead: 'y' });   // dual-channel solenoid
      for (const s of [-1, 1]) Kt.fitting('tras-icu', f, [s * .035, -.05, -.02], '-y', .012);                                    // pressure in, return
      Kt.box('tras-icu', f, [-.03, -.01, .068], [.03, .12, .008], 'steel', { round: .004, mat: { color: '#c0262b', metalness: .2, roughness: .5 } });   // manual inhibit lever
      Kt.cyl('tras-icu', f, [.02, .03, .07], 'z', .0055, .03, 'steel'); Kt.rod('tras-icu', f, [.02, .03, .085], [-.01, .045, .07], .0012, 'steel');   // inhibit pin on its lanyard
      for (const y of [-.02, .02]) { Kt.cyl('tras-icu', f, [-.07, y, .065], 'z', .007, .02, 'steel'); }                       // inhibit proximity sensors
      Kt.plate('tras-icu', f, [.03, .02, .0605], 'z', 'y', .05, .03); }
    PW.part('tras-dcu', { parent: 'tras-control', label: 'Directional control unit (DCU)', src: 'p.334-345',
      info: 'In the forward pylon, above the engine core. Its dual-channel solenoid, worked by either EEC channel, operates the directional control valve onto the directional spool valve, which sends hydraulic pressure to the actuators and the track lock valves to unlock, deploy, stow and lock the sleeves. A dual-channel pressure proximity sensor tells each EEC channel when there is pressure at the ICU outlet.' });
    { const f = Kt.frame('tras-dcu', -1.35, 12, 1.12);
      Kt.box('tras-dcu', f, [0, 0, 0], [.22, .07, .08], 'castAl', { round: .01 }); Kt.cyl('tras-dcu', f, [.13, 0, 0], 'x', .02, .05, 'castAl'); Kt.connector('tras-dcu', f, [.16, 0, 0], 'x', .01, { lead: 'y' });
      for (const z of [-.015, .015]) Kt.connector('tras-dcu', f, [-.06, .035, z], 'y', .007, { lead: '-x' });                 // pressure proximity sensor, two channels
      for (const xr of [-.08, -.03, .02, .07]) Kt.fitting('tras-dcu', f, [xr, -.035, 0], '-y', .01);                          // pressure, return, deploy, stow
      Kt.plate('tras-dcu', f, [0, 0, .0405], 'z', 'y', .05, .03); }
    /* the lines inside the pylon (they show with the nacelle ghosted): the DCU's return, deploy and stow ports out to each door's
       lines at the hinge beam (the door ends are built with the doors, from 0:21 or 11:39 o'clock); the ICU's outlet forward to the
       DCU's pressure port; the ICU's supply from the aircraft system above; and the units' connectors into the pylon's wiring. The
       hinge crossing is a short flexible hose in the aircraft; here the door's half swings away with the door */
    { const xm = -1.0406, ra = 1.06;
      for (const [xp, dr, dx] of [[-1.38, .02, -.06], [-1.33, .038, -.072], [-1.28, .056, -.084]]) for (const h of [.35, 11.65]) {   // return, deploy, stow
        const s = h < 6 ? 1 : -1;
        line('tras-dcu', [P(xp, 12, 1.0705), P(xp, 12, 1.055), P(xp + .06, 12 + s * .12, 1.06), P(xm + dx - .06, h - s * .05, ra + dr), P(xm + dx, h, ra + dr)], .006, 'tube', { clamps: 0, ends: false }); }
      line('tras-icu', [P(-2.935, 11.99, 1.1826), P(-2.935, 11.99, 1.15), P(-2.6, 12, 1.135), P(-2.25, 12, 1.13), P(-1.9, 12, 1.08), P(-1.5, 12, 1.055), P(-1.43, 12, 1.056), P(-1.43, 12, 1.0705)], .007, 'tube', { clamps: 0, ends: false });   // ICU outlet to the DCU pressure port
      line('tras-icu', [P(-2.865, 11.99, 1.1826), P(-2.865, 11.99, 1.16), P(-2.80, 12, 1.40)], .007, 'tube', { clamps: 0, ends: false });   // supply from the aircraft hydraulic system
      for (const [pid, pts] of [['tras-dcu', [P(-1.171, 12, 1.138), P(-1.16, 12, 1.16), P(-1.10, 12, 1.25)]], ['tras-dcu', [P(-1.423, 11.98, 1.168), P(-1.40, 11.97, 1.20), P(-1.30, 11.97, 1.27)]],
        ['tras-dcu', [P(-1.423, .02, 1.168), P(-1.40, .03, 1.20), P(-1.30, .03, 1.27)]], ['tras-icu', [P(-2.734, 11.97, 1.29), P(-2.70, 11.97, 1.33), P(-2.60, 11.97, 1.40)]]])
        line(pid, pts, .005, 'harness', { clamps: 0, ends: false }); }

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
      info: 'Grey box on the left of the fan case at 9 o\'clock, immediately aft of the EEC, with its own THIS SIDE UP placard. It takes the two vibration sensors and the oil debris monitor, and N1, N2 and fan speed from the EEC over the CAN bus, works out fan, N1 and N2 vibration for EICAS, and records the data for trend monitoring and the fan trim balance solutions. Powered from DC BUS 1.' });
    /* p.139 and Brian's photo: a separate grey box just aft of the EEC (until 2026-10-07 the model had it as a cross-braced module of the
       EEC, with a second box at 10:30), a connector at each aft corner; built in the EEC's frame */
    { const f = Kt.frame('phmu', -.08, 9, 1.045), xc = -.36;
      Kt.box('phmu', f, [xc, -.002, 0], [.19, .085, .21], 'eecGrey', { round: .01 });
      for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) Kt.box('phmu', f, [xc + a * .07, -.0615, b * .07], [.03, .034, .03], 'lime', { round: .003 });
      Kt.placard('phmu', f, [xc, .0408, .045], 'y', 'z', .045, .05, 'thisSideUp');
      Kt.label('phmu', f, [xc, .0408, -.02], 'y', 'z', .04, .03, 'white'); Kt.label('phmu', f, [xc, .0408, -.065], 'y', 'z', .03, .02, 'dataBlack');
      for (const s of [-1, 1]) Kt.connector('phmu', f, [xc - .06, 0, s * .105], s > 0 ? 'z' : '-z', .013, { lead: s > 0 ? 'z' : '-z' }); }
    PW.part('pdos', { label: 'Power door opening system', explode: [0, .3, .4], src: 'p.32-43',
      info: 'Hydraulic powerpack on the fan case at about 2 o\'clock and one opening actuator per reverser door, which lifts the door to the hold-open rod position. A hand pump can be connected at the quick-disconnect instead; the TTM notes that newer production aircraft have no powerpack and use the hand pump only. Never stand under a door held only by its actuator: install the hold-open rods.' });
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
      line('pdos', [P(-.655, 2.3, 1.0), P(-.70, 2.6, 1.03), P(-.75, 3.2, 1.03), P(-.79, 3.8, 1.01), P(-.80, 4.0, 1.0)], .007, 'black', { clamps: 2 }); }
    for (const h of [4, 8]) line('pdos', [P(-.80, h, 1.0), P(-1.0, h, 1.05)], .022, 'tube', { clamps: 0 });                  // the door locking actuators

    /* ============================== FIRE PROTECTION ============================== */
    PW.part('fire', { label: 'Fire detection and extinguishing', explode: [0, .15, -.2], src: 'TTM ch. 26 (p.262-269)',
      info: 'Two detection loops, A and B, each of five sensing elements in series: one on the pylon above the core and two on each core cowl (the inner fixed structure halves), so the cowl elements open with the reverser doors. The FIDEX control unit, with two identical cards, monitors the loops, the bottle cartridges and pressure switches, and drives the L or R ENG FIRE lights, the FIRE light on the ENGINE panel, the CAS message and the aural warning. A manual test is run from the flight deck.\n\nTwo bottles on the aft spar just forward of the main gear bay, each with two discharge heads, can discharge into either engine. The discharge line comes down the pylon to a nozzle with two outlets at the top of the core compartment.' });
    /* TTM p.268: the pylon element (loops A and B side by side) along the underside of the pylon, in the gap between the IFS halves;
       the core cowl elements are built with the reverser doors in build-nacelle.js */
    { for (const dz of [-.10, -.122]) line('fire', [V(-1.10, 1.0135, dz), V(-1.25, 1.0135, dz), V(-1.45, 1.0135, dz)], .0035, 'tube', { clamps: 3, tension: 0 });   // clipped to the pylon, left of the precooler duct
      /* TTM ch. 26: the discharge line comes down from the pylon, past the precooler supply duct, to a nozzle with two outlets at the
         top of the core compartment */
      line('fire', [V(-1.30, 1.03, -.075), V(-1.30, .86, -.09), V(-1.30, .744, -.105), V(-1.30, .64, -.08), V(-1.30, .58, -.052), P(-1.30, 11.84, .535)], .008, 'tube', { clamps: 2 });   // down the left of the precooler's fan-air duct
      box('fire', -1.30, 11.84, .52, .03, .025, .07, 'steel'); }

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
        Kt.cyl('mount-fwd', f, [0, .085, 0], 'z', .009, .17, 'steel'); for (const e of [-1, 1]) Kt.hex('mount-fwd', f, [0, .085, e * .088], 'z', .013, .008, 'steel'); }   // fail-safe bolt
      /* aft mount (p.48-49): main beam under the pylon's aft fitting, two outer links down to lugs on the turbine exhaust case, the centre
         fail-safe link, and the balance beam ahead of it carrying the thrust links */
      PW.part('mount-aft', { parent: 'mounts', label: 'Aft engine mount and balance beam', src: 'p.44-45, p.48-49',
        info: 'On the turbine exhaust case at 12 o\'clock, reacting fore-aft, side, vertical and roll loads. The main beam bolts to the pylon with four bolts, located by two shear pins. Two outer links run down to the case, each held to it by one shear bolt; the centre fail-safe link and its two bolts only take load if an outer link fails. The balance beam on its forward face pivots at its centre and takes the two thrust links, evening out the load between them.' });
      { const f = Kt.frame('mount-aft', xa, 12, .40);
        Kt.box('mount-aft', f, [0, .22, 0], [.12, .04, .38], 'titanium', { round: .008 });
        for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) Kt.hex('mount-aft', f, [a * .035, .244, b * .14], 'y', .009, .007, 'steel');
        for (const s of [-1, 1]) { const ly = .4 * Math.cos(.49) - .4, lz = .4 * Math.sin(.49);                                                       // case lugs at 28 deg either side
          const g = Kt.frame('mount-aft', xa, 12 + s * .936, .40); Kt.box('mount-aft', g, [0, .02, 0], [.05, .04, .03], 'nickel', { round: .006 });
          Kt.rod('mount-aft', f, [0, .205, s * .165], [0, ly + .035, s * lz], .015, 'titanium');                                                         // outer link
          for (const p of [[0, .205, s * .165], [0, ly + .035, s * lz]]) { Kt.cyl('mount-aft', f, p, 'x', .007, .075, 'steel'); for (const e of [-1, 1]) Kt.hex('mount-aft', f, [e * .04, p[1], p[2]], 'x', .011, .007, 'steel'); } }
        for (const dx of [.027, -.027]) Kt.box('mount-aft', f, [dx, .045, 0], [.01, .092, .07], 'nickel', { round: .004 });                           // the case's centre lugs (p.53)
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
      info: 'Eight drain lines, from the 2.5 bleed valve actuator, the HPC and LPC vane actuators, the VFG, the starter, the fuel/oil manifold and IFPC, the oil tank scupper and the hydraulic pump, gather into the drain mast. The mast drops between the reverser doors at 6 o\'clock and ends in a round plate of tube ends at the latch access panel. The drain tube map inside the panel numbers them: 1 DR11 2.5 bleed, 2 DR21 HPC SVA, 3 DR01 LPC SVA, 4 DR61 VFG, 5 DR91 starter, 6 DR41 FOM fuel, 7 DR71 oil tank, 8 DR51 hydraulic pump. Which tube drips points to the leaking unit. The nacelle also drains through the gaps round the latch access panel and through holes in the lower bifurcation panels.' });
    /* p.50: each drain runs from its source to the top of the mast under the core at 6 o'clock; the mast carries them down the lower
       bifurcation and through the reverser to the latch access panel at the bottom of the nacelle */
    { const xm2 = -1.48, runs = [
        /* the three actuator drains cross under the cowl anti-ice duct on their way down the right side */
        [P(-1.21, 5.0, .455), P(-1.222, 5.35, .448), P(-1.255, 5.7, .46), P(-1.29, 6.0, .50)],                                    // LPC stator vane actuator
        [P(-1.21, 3.0, .455), P(-1.22, 3.5, .47), P(-1.215, 4.5, .485), P(-1.232, 5.0, .46), P(-1.24, 5.35, .448), P(-1.27, 5.7, .462), P(-1.31, 6.0, .505)],   // 2.5 bleed valve actuator
        [P(-1.30, 4.05, .37), P(-1.23, 4.2, .46), P(-1.232, 4.5, .478), P(-1.246, 5.0, .458), P(-1.256, 5.35, .448), P(-1.285, 5.7, .464), P(-1.33, 5.98, .50)],   // HPC stator vane actuator
        [P(-1.40, 5.95, .455), P(-1.41, 6.0, .50)],                                                                               // hydraulic pump
        [P(-1.40, 7.15, .46), P(-1.40, 6.6, .50), P(-1.43, 6.1, .515)],                                                             // fuel/oil manifold and IFPC
        [P(-1.685, 7.95, .43), P(-1.70, 7.75, .47), P(-1.72, 7.45, .52), P(-1.68, 7.1, .545), P(-1.60, 6.8, .545), P(-1.52, 6.45, .54), P(-1.47, 6.2, .535)],   // starter pad seal, under the gearbox and the VFG oil line
        /* the VFG and oil tank drains come forward from aft into the back of the collector */
        [P(-1.704, 6.03, .479), P(-1.69, 6.05, .515), P(-1.60, 6.08, .54), P(-1.54, 6.09, .58), P(-1.515, 6.09, .612)],          // VFG pad seal
        [P(-1.99, 2.787, .530), P(-1.99, 2.88, .537), P(-1.993, 3.4, .537), P(-2.0, 3.9, .536), P(-2.01, 4.3, .533), P(-2.022, 4.6, .526), P(-2.03, 4.85, .513), P(-2.03, 5.08, .50), P(-2.0, 5.3, .512), P(-1.95, 5.45, .53), P(-1.88, 5.55, .545), P(-1.75, 5.95, .545),
          P(-1.62, 6.02, .56), P(-1.54, 6.03, .59), P(-1.515, 6.03, .612)]];                                                        // oil tank scupper, from the fitting at the bottom of the fill port pocket, down the outboard face and round the cone
      /* the six forward drains keep their own lanes, 1 cm apart, into the top of the collector block on the mast, all to the left of the
         igniter cables; the right-side drains take the lanes in the order they arrive, so none crosses another */
      const lanes = [6.025, 5.99, 5.955, 6.055, 6.105, 6.145];
      /* p.51: the tubes gather into the mast, a bundle held in clamp blocks, and end side by side in a round end plate at the latch
         access panel, each in its place on the drain tube map (1 DR11 2.5 bleed, 2 DR21 HPC SVA, 3 DR01 LPC SVA, 4 DR61 VFG, 5 DR91
         starter, 6 DR41 FOM, 7 DR71 oil tank, 8 DR51 hydraulic pump; tube 1 taken as forward). Brian's photos from below, reverser doors
         open, show the plate as the white disc of tube ends under the core. The bundle drops between the reverser doors' latch beams,
         which leave a 50 mm gap at 6 o'clock, so it is packed four tubes across there and the plate hangs just below them */
      const rP = 1.15, map = [[.012, .01], [.03, 0], [.012, -.01], [-.028, .009], [-.008, .015], [-.008, 0], [-.008, -.015], [-.028, -.009]];   // by run: LPC, 2.5, HPC, pump, FOM, starter, VFG, oil tank
      const xB = xm2 - .02, inB = (i, r, k) => { const [a, t] = map[i]; return P(xB + a * k, 6 + t * k / r / (Math.PI / 6), r); };   // aft of the reverser latch at x -1.40
      runs.forEach((pts, i) => { let lead = pts;
        if (i <= 5) { const h = lanes[i], q = pts[pts.length - 1]; pts[pts.length - 1] = P(q.x, h, Math.hypot(q.y, q.z)); lead = pts.concat([P(xm2 + .03, h, .56), P(xm2 + .01, h, .604)]); }
        line('drain-mast', lead.concat([inB(i, .66, .6), inB(i, .80, .9), inB(i, .95, 1), inB(i, rP - .03, 1), inB(i, rP - .006, 1)]), .004, 'tube', { clamps: 0, ends: false }); });
      for (const r of [.76, .935]) box('drain-mast', xB - .002, 6, r, .08, .02, .06, 'steel');                                     // clamp blocks round the bundle
      { const g = Kt.frame('drain-mast', xB, 6, rP);                                                                               // the end plate, facing down
        Kt.cyl('drain-mast', g, [0, -.002, 0], 'y', .046, .014, 'termWhite', { edge: .004 });
        map.forEach(([a, t]) => { Kt.cyl('drain-mast', g, [a, .0065, t], 'y', .0062, .007, 'phenolic'); Kt.cyl('drain-mast', g, [a, .012, t], 'y', .0043, .005, 'brass'); }); } }
  }
  /* a small circle profile (tori for manifolds) */
  function circ(x, r, rad, n) { const out = []; for (let i = 0; i < n; i++) { const a = i / n * TAU; out.push([x + rad * Math.cos(a), r + rad * Math.sin(a)]); } return out; }
})();
