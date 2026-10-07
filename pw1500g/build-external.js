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
  /* a routed line with clamps: kind 'tube' | 'hose' | 'harness' | 'duct' */
  function line(pid, pts, r, kind, o) { o = o || {};
    const mat = { tube: 'tube', hose: 'fireSleeve', harness: 'harness', duct: 'insulation', black: 'blackHose' }[kind] || 'tube';
    const g = G.tube(pts.map(p => (p.isVector3 ? p : V(...p))), r, { radial: kind === 'duct' ? 16 : 10, tension: o.tension === undefined ? .25 : o.tension });
    const tubeMesh = PW.add(pid, g, mat); tubeMesh.userData.isLine = true;
    const curve = g.userData.curve, n = o.clamps === undefined ? Math.max(1, Math.round(curve.getLength() / (kind === 'duct' ? .35 : .25))) : o.clamps;
    if (n > 0) { const ts = []; for (let i = 1; i <= n; i++) ts.push(i / (n + 1));
      /* clamps are thin bands: orange cushioned P-clamps on small lines, steel V-band couplings on large ducts */
      const big = kind === 'duct' || r > .03, band = Math.min(r * 1.6, big ? .022 : .016);
      PW.add(pid, G.alongCurve(curve, ts, () => new THREE.CylinderGeometry(r + Math.min(.008, r * .35), r + Math.min(.008, r * .35), band, 16)), big ? 'steel' : kind === 'harness' ? 'connector' : 'clampOrange', { shadow: false }).userData.isLine = true; }
    if (o.ends !== false && kind !== 'duct') PW.add(pid, G.alongCurve(curve, [0.012, .988], () => new THREE.CylinderGeometry(r * 1.6, r * 1.6, r * 2.2, 6)), kind === 'harness' ? 'connector' : 'steel', { shadow: false }).userData.isLine = true;
    return curve;
  }

  function build() {
    if (!D.GEN) return;
    const GB = D.GEN.gearboxParts, NC = D.GEN.nacelle;

    /* ============================== GEARBOXES ============================== */
    PW.part('gearboxes', { label: 'Angle and main gearboxes', explode: [0, -.55, 0], src: 'p.66-69; TTM ch. 72',
      info: 'The N2 rotor drives a towershaft to the angle gearbox on the CIC at 8 o\'clock. A layshaft runs aft from there to the main gearbox, a crescent-shaped casting slung under the core from about 4:30 to 9 o\'clock. Accessories mount on its forward and aft faces.\n\nThe gearboxes turn at N2 speed, which is why the starter cranks the core through them and why the generators and the hydraulic pump stop when the engine does. Chip collectors and core drain plugs are on the main gearbox.' });
    PW.part('agb', { parent: 'gearboxes', label: 'Angle gearbox (AGB)', src: 'p.66-67; p.53',
      info: 'Bevel gearbox on the compressor intermediate case at 8 o\'clock. It turns the towershaft drive from the N2 rotor through an angle into the layshaft that runs aft to the main gearbox.' });
    { const ag = GB.angleGearboxBody, xm = (ag.x_from + ag.x_to) / 2, rm = (ag.r_in + ag.r_out) / 2;
      box('agb', xm, 8, rm, ag.x_from - ag.x_to, ag.r_out - ag.r_in, .16, 'gearboxCast', { tilt: deg(-12) });
      const t = GB.towershaftHousing; line('agb', [P(t[0][0], 8, t[0][1]), P(t[1][0], 8, t[1][1])], .035, 'tube', { clamps: 0, ends: false });
      for (const dz of [-.06, .06]) PW.add('agb', G.boltCircle(PW.partMat('agb', 'steel'), xm + .085, rm, 8, .006, { phase: dz }), null); }
    PW.part('layshaft', { parent: 'gearboxes', label: 'Layshaft and covers', src: 'p.66-67',
      info: 'Drive shaft from the angle gearbox aft to the main gearbox input pad, inside two concentric tubular covers. It runs parallel to the axis at 8 o\'clock, close to the HPC case and under the IFPC and fuel/oil manifold, into the top layer of the main gearbox.' });
    { const ls = GB.layshaft; line('layshaft', [P(ls.x_from, 8, ls.r_axis), P((ls.x_from + ls.x_to) / 2, 8, ls.r_axis), P(ls.x_to, 8, ls.r_axis)], .032, 'tube', { clamps: 2, tension: 0 }); }   // p.53: r .29 to .35
    PW.part('mgb', { parent: 'gearboxes', label: 'Main gearbox (MGB)', src: 'p.66-69; p.53',
      info: 'Crescent-shaped aluminium casting under the core, from about 4:30 to 9 o\'clock, with machined drive pads on both faces. Forward face: IFPC on the fuel/oil manifold (8 o\'clock), layshaft input, hydraulic pump and the lube and scavenge oil pump (5 o\'clock). Aft face: air turbine starter, PMAG (7 o\'clock), VFG and the oil control module.\n\nIts carbon seals at each pad, the N2 cranking pad for hand-turning the core during a borescope, and the core drain plugs are serviced here.' });
    const mg = GB.mainGearboxBody, mx0 = mg.x_from, mx1 = mg.x_to, mr0 = .335, mr1 = .43, xm = (mx0 + mx1) / 2;
    { const th0 = G.clock(4.5), th1 = G.clock(9);
      PW.add('mgb', G.revolve([[mx0, mr0], [mx1, mr0], [mx1 - .01, mr1], [mx0 + .01, mr1]], { seg: 40, thetaStart: th0, thetaLength: th1 - th0 }), 'gearboxCast');
      for (let i = 0; i <= 8; i++) { const a = th0 + (th1 - th0) * i / 8; PW.add('mgb', G.revolve([[mx0 - .02, mr1 - .005], [mx1 + .02, mr1 - .005], [mx1 + .02, mr1 + .012], [mx0 - .02, mr1 + .012]], { seg: 2, thetaStart: a - .02, thetaLength: .04 }), 'gearboxCast'); }   // ribs underneath
      for (const h of [4.5, 9]) box('mgb', xm, h, .31, mx0 - mx1, .07, .09, 'gearboxCast');                                    // ends turned up toward the core
      for (const [h, s] of [[5.2, 1], [8.75, -1]]) { const a = P(xm, h, .34), b = P(xm + .03 * s, h + .4 * s, .22); line('mgb', [a, b], .012, 'tube', { clamps: 0 }); }   // left and right mounting links to the core
      for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(G.can(.012, .03)); m.geometry.rotateZ(Math.PI / 2); m.position.copy(P(mx1 + .02, 7.4 + i * .15, mr1 - .01)); m.rotation.x = 0; PW.add('mgb', m, 'steel', { solid: true }); }   // core drain plugs
    }
    /* accessories on the MGB faces (p.69 layout; clocks from p.112, 170, 226, 296) */
    const acc = (pid, label, info, src) => PW.part(pid, { parent: 'gearboxes', label, info, src });
    const pad = (pid, x, h, r, rad) => { PW.add(pid, G.ring(x + .006, x - .006, rad * .7, rad * 1.18, { seg: 32 }), 'steel'); PW.add(pid, G.boltCircle(PW.partMat(pid, 'steel'), x + .007, rad, 8, .004), null).position.copy(P(0, h, r)); };
    // forward face
    acc('ifpc', 'Integrated fuel pump and control (IFPC)', 'Engine fuel pump and metering unit, mounted on the fuel/oil manifold on the MGB front face at 8 o\'clock and driven by the gearbox. Inside: a centrifugal boost pump; the high-pressure gear pump, which also supplies servo fuel to the vane and bleed actuators; a motive flow pump that returns motive flow to the aircraft fuel system; and the metering section, with the fuel metering valve the EEC commands, its pressure-regulating valve, the windmill bypass valve, the minimum pressure-shutoff valve and flow divider, and the dual-coil overspeed shutdown solenoid that shuts off metered flow.\n\nIf the fuel temperature sensor fails, the EEC meters with a default of 75 deg C. Its carbon-sealed drive pad is on the MGB; fuel leaks there show at the drain mast.', 'p.162-171, p.69');
    /* p.171: the IFPC hangs on the forward face of the fuel/oil manifold, which stands upright against the left end of the MGB front
       face from about 7 to 9:30 o'clock, with the fuel flow meter at its upper end and the fuel filter at its lower end */
    { box('ifpc', mx0 + .16, 8.05, .44, .20, .14, .16, 'accGrey'); can('ifpc', mx0 + .27, 8.05, .46, .055, .10, 'steel');               // clear of the layshaft below
      box('ifpc', mx0 + .10, 8.35, .47, .12, .10, .12, 'darkBox');                                             // metering head
      connector('ifpc', P(mx0 + .265, 8.25, .48), V(1, 0, 0)); }
    acc('fom', 'Fuel/oil manifold (FOM), fuel flow meter and fuel filter', 'Upright manifold block against the left end of the MGB front face, from about 7 to 9:30 o\'clock. It carries the IFPC on its forward face at 8 o\'clock, the fuel flow meter above it at 9 o\'clock and the fuel filter below it, and routes the boost-pump fuel to and from the fuel/oil heat exchanger, which keeps it above 0 deg C at the filter inlet.\n\nFuel filter: a disposable canister in a housing with a drain plug. Its differential pressure sensor, at 7:30 on the manifold, reports to both EEC channels. Above 22 psid: L(R) ENG FUEL FILTER advisory with an IMPENDING BYPASS info message. At 25 psid the bypass valve opens (BYPASS info message). Both engines in bypass gives the L-R ENG FUEL FILTER caution: suspect fuel contamination.\n\nFuel flow meter: measures the metered fuel going to the nozzles. Its signal goes to EEC channel A, and to channel B over the CAN bus.', 'p.162-179, p.69');
    { const t0 = G.clock(7.1), t1 = G.clock(9.35);
      PW.add('fom', G.revolve([[mx0 + .055, .37], [mx0 + .004, .37], [mx0 + .004, .46], [mx0 + .055, .46]], { seg: 20, thetaStart: t0, thetaLength: t1 - t0 }), 'castAl');
      can('fom', mx0 + .10, 9.15, .435, .045, .09, 'accGrey'); connector('fom', P(mx0 + .10, 9.15, .49), P(0, 9.15, 1).normalize());     // fuel flow meter
      can('fom', mx0 + .11, 7.35, .45, .05, .11, 'steel', { edge: .012 }); can('fom', mx0 + .175, 7.35, .45, .035, .025, 'darkBox');      // fuel filter housing and its cap
      box('fom', mx0 + .07, 7.5, .47, .04, .03, .04, 'darkBox'); }                                                                        // filter differential pressure sensor (7:30, p.178)
    acc('edp', 'Hydraulic engine-driven pump (EDP)', 'Variable-displacement hydraulic pump on the MGB forward face, supplying the aircraft hydraulic system on its side. It has a quick-disconnect drive and case drain; its fluid lines and the depressurising solenoid connect through the pylon.', 'p.66-69; TTM ch. 29');
    { can('edp', mx0 + .12, 5.8, .40, .065, .18, 'steel'); can('edp', mx0 + .23, 5.8, .40, .05, .06, 'accGrey'); pad('edp', mx0 + .012, 5.8, .40, .07);
      /* its pressure and suction hoses run up the right of the core, aft of the vane and bleed actuators, into the pylon */
      for (const dx of [0, -.035]) line('edp', [P(mx0 + .16 + dx, 5.6, .47), P(-1.26 + dx, 5.2, .505), P(-1.25 + dx, 4.4, .51), P(-1.25 + dx, 3.2, .51), P(-1.26 + dx, 1.8, .51), P(-1.27 + dx, .6, .51), P(-1.28 + dx, .15, .58), V(-1.30 + dx, .78, .02)], .012, 'hose', { clamps: 5 }); }
    acc('lsop', 'Lubrication and scavenge oil pump (LSOP)', 'Seven-stage pump at the right end of the MGB forward face, 5 o\'clock: one pressure stage and six scavenge stages, each scavenge return with its own chip collector. A low oil pressure indication with normal quantity often points here or to the oil control module.', 'p.212-235, p.69');
    { can('lsop', mx0 + .14, 4.85, .40, .055, .24, 'accGrey'); for (let i = 0; i < 3; i++) can('lsop', mx0 + .07 + i * .07, 4.6, .44, .014, .03, 'steel');
      box('lsop', mx0 + .26, 4.85, .40, .06, .12, .1, 'accGrey'); }
    // aft face
    acc('ats', 'Air turbine starter (ATS)', 'Pneumatic starter at the left end of the MGB aft face, on a quick attach/detach (QAD) ring. Bleed air from the APU, ground cart or the other engine, admitted by the starter air valve, spins its turbine; it cranks the N2 rotor through the gearboxes and disengages above cutout speed.\n\nIt carries its own oil, with a sight glass and drain plug; check the oil level as part of starter troubleshooting.', 'p.286-301, p.69');
    { const ax = mx1 - .15, ah = 8.4, ar = .40; can('ats', ax, ah, ar, .115, .27, 'accGrey', { edge: .03 });
      PW.add('ats', G.ring(mx1 - .008, mx1 - .02, .10, .13, { seg: 40 }), 'steel').position.copy(P(0, ah, ar));                   // QAD ring
      for (let i = 0; i < 18; i++) { const a = i / 18 * TAU, m = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, .004, 8)); m.geometry.rotateZ(Math.PI / 2); m.position.copy(P(ax - .135, ah, ar).add(V(0, Math.cos(a) * .07, Math.sin(a) * .07))); PW.add('ats', m, 'darkBox', { solid: true }); }   // exhaust holes in the end cap
      /* starter air valve on the duct coming down from the pylon (left side) */
      acc('sav', 'Starter air valve (SAV)', 'Pneumatically operated butterfly valve in the starter duct, spring-loaded closed, with a regulator that holds 30 psi downstream. The EEC opens it through a dual-coil torque motor and confirms it open from starter speed and N2. A cooling shroud, fed by a hose from the air/oil cooler, protects it from core heat; its line-replaceable filter is under the shroud.\n\nA 3/8 in square-drive manual override can be reached through an access hole in the left thrust reverser door. The 2017 manual carries a warning that a manual override start is not an approved procedure, because of the motor-to-start logic that prevents starting with a bowed rotor: follow the current AMM and MEL.', 'p.290-299; p.298 warning');
      /* p.297: the starter duct comes down from the pylon along the left of the core, through the valve at 9 o'clock, then turns forward
         and down into the aft end of the starter. It runs just aft of the HPT, over the turbine intermediate case: further aft the gap
         between the LPT case and the IFS is too small for it */
      const top = P(-2.19, 11.85, .66), sv = P(-2.07, 9.1, .45), st = P(ax - .15, ah, ar);
      line('sav', [top, P(-2.16, 11.85, .56), P(-2.13, 11.4, .50), P(-2.10, 10.0, .475), sv], .045, 'duct', { clamps: 2 }); line('sav', [sv, P(-2.03, 8.75, .42), st], .045, 'duct', { clamps: 1 });
      can('sav', -2.07, 9.1, .45, .06, .1, 'steel'); box('sav', -2.07, 8.85, .505, .09, .07, .1, 'darkBox'); }
    acc('pmag', 'Permanent magnet alternator/generator (PMAG)', 'Small alternator on the MGB aft face at 7 o\'clock with a separate winding for each EEC channel. Above 45 percent N2 it powers the EEC; below that, or if both its channels fail, the EEC runs on aircraft 28 V DC. Its frequency is also the N2 speed signal.', 'p.96-101, p.112, p.69');
    { can('pmag', mx1 - .08, 7.15, .40, .05, .13, 'accGrey'); connector('pmag', P(mx1 - .14, 7.15, .45), V(-.4, -1, -.3)); }
    acc('vfg', 'Variable frequency generator (VFG)', 'The engine\'s main AC generator on the MGB aft face: 115/200 V AC, 75 kVA, 380 to 760 Hz, the frequency following N2. It has its own oil, cooled through the VFG oil/oil heat exchanger and a VFG air/oil cooler.\n\nThe crew can disconnect it from the gearbox with the L or R DISC switch on the electrical panel, which also shows its oil cautions (TTM ch. 24). Reconnection is done on the ground, following the AMM.', 'p.66-69; TTM ch. 24');
    { const vr = .385; can('vfg', mx1 - .17, 6.15, vr, .13, .32, 'accGrey', { edge: .02 }); for (let i = 0; i < 7; i++) PW.add('vfg', G.ring(mx1 - .05 - i * .035, mx1 - .062 - i * .035, .13, .137, { seg: 40 }), 'accGrey').position.copy(P(0, 6.15, vr));
      box('vfg', mx1 - .30, 6.15, vr + .1, .1, .04, .14, 'labelBlue', { round: .006 }); connector('vfg', P(mx1 - .25, 5.75, vr + .09), V(-.3, -1, .6)); connector('vfg', P(mx1 - .18, 6.55, vr + .09), V(-.3, -1, -.6)); }
    acc('ocm', 'Oil control module (OCM)', 'Cast module at the right end of the MGB aft face carrying the main oil filter with its delta-P sensor, the oil pressure and temperature sensors and the oil debris monitor. It also holds the fuel/oil cooler bypass logic. A filter bypass or debris message is worked from here.', 'p.226-249, p.69');
    { box('ocm', mx1 - .12, 4.9, .40, .2, .13, .17, 'accGrey'); can('ocm', mx1 - .10, 4.62, .41, .05, .14, 'steel'); for (let i = 0; i < 4; i++) connector('ocm', P(mx1 - .07 - i * .04, 5.1, .46), V(0, -.6, .8)); }
    acc('deoiler', 'Deoiler', 'Self-contained centrifugal deoiler on the right of the MGB. It separates oil from the breather air of the bearing compartments and vents the air overboard.', 'p.67, p.226');
    { can('deoiler', xm, 4.35, .36, .045, .08, 'gearboxCast'); line('deoiler', [P(xm, 4.35, .41), P(-1.62, 4.25, .45), P(-1.75, 4.2, .50), P(-1.80, 4.2, .545)], .018, 'tube', { clamps: 1 }); }

    /* ============================== OIL SYSTEM ============================== */
    PW.part('oil', { label: 'Oil system', explode: [0, 0, .45], src: 'p.212-255; TTM ch. 79',
      info: 'Dry-sump system: the tank on the right of the core feeds the pressure stage of the lube and scavenge pump, the oil control module filters and monitors it, and part of the flow is cooled in the fuel/oil heat exchanger and the air/oil cooler before going to the bearings, gearboxes and the FDGS journals. Six scavenge stages return it to the tank through chip collectors.' });
    PW.part('oil-tank', { parent: 'oil', label: 'Oil tank', src: 'p.222-225; TTM ch. 79; photos',
      info: 'Engine-mounted tank on the right side of the core, 27.3 L (28.8 qt), with a de-aerator inside. Service it through the oil tank access door on the right reverser door at about 2:30: check the level on the sight glass, then fill through the filler cap. Do it within the AMM time after shutdown so the level is meaningful.\n\nA scupper round the filler drains spills to the drain mast.' });
    /* p.223: a tall upright tank on the right of the core over the diffuser and HPT, curved to the core, with the fill port on top, the
       sight glass at its upper aft corner, and a conical sump down to the drain plug; the OTAD on the right IFS opens onto it */
    { const tx = -1.93, len = .30, a0 = G.clock(1.45), a1 = G.clock(4.0), a2 = G.clock(4.75);
      PW.add('oil-tank', G.revolve([[tx + len / 2, .41], [tx - len / 2, .41], [tx - len / 2 + .015, .515], [tx + len / 2 - .015, .515]], { seg: 28, thetaStart: a0, thetaLength: a1 - a0 }), 'accGrey');
      PW.add('oil-tank', G.revolve([[tx + .10, .42], [tx - .10, .42], [tx - .09, .50], [tx + .09, .50]], { seg: 10, thetaStart: a1 - .02, thetaLength: a2 - a1 }), 'accGrey');   // conical sump
      { const m = new THREE.Mesh(G.can(.016, .03)); m.geometry.rotateZ(Math.PI / 2); G.aim(m, P(tx, 4.8, .46), P(0, 4.8, 1).normalize()); PW.add('oil-tank', m, 'steel', { solid: true }); }   // drain plug
      /* fill port with hinged cap and scupper on the top outboard face, sight glass at the upper aft corner */
      const fp = new THREE.Mesh(G.roundedBox(.08, .025, .08, .02)); fp.position.copy(P(tx + .03, 1.9, .52)); fp.rotation.x = G.clock(1.9); PW.add('oil-tank', fp, 'darkBox', { solid: true });
      const cap = new THREE.Mesh(G.can(.026, .012)); cap.geometry.rotateZ(Math.PI / 2); G.aim(cap, P(tx + .03, 1.9, .535), P(0, 1.9, 1).normalize()); PW.add('oil-tank', cap, 'steel', { solid: true });
      const sg = new THREE.Mesh(G.roundedBox(.05, .008, .11, .006)); sg.position.copy(P(tx - .10, 2.35, .517)); sg.rotation.x = G.clock(2.35); PW.add('oil-tank', sg, 'glass', { solid: true });
      /* tank outlet over the oil control module and the end of the MGB to the pump; scavenge return beside it; vent under the sump
         forward to the deoiler */
      line('oil-tank', [P(tx + .025, 4.62, .47), P(-1.89, 4.45, .52), P(-1.75, 4.42, .52), P(-1.60, 4.42, .51), P(-1.49, 4.6, .48), P(-1.46, 4.8, .465)], .016, 'tube', { clamps: 3 });   // to the lube and scavenge pump
      line('oil-tank', [P(mx0 + .07, 4.6, .45), P(-1.50, 4.2, .47), P(-1.62, 3.7, .47), P(-1.74, 3.5, .465), P(tx + .14, 3.5, .46)], .014, 'tube', { clamps: 2 });                                     // scavenge return
      line('oil-tank', [P(tx - .12, 4.3, .46), P(-2.06, 4.2, .40), P(-1.95, 4.2, .37), P(-1.75, 4.25, .365), P(-1.62, 4.3, .375), P(xm, 4.35, .37)], .012, 'tube', { clamps: 2 }); }   // vent to the deoiler
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
      line('vfgoohx', [P(vx, 9.72, .43), P(-1.45, 9.1, .52), P(-1.57, 8.0, .50), P(-1.70, 6.7, .52), P(mx1 - .1, 6.5, .49)], .014, 'tube', { clamps: 3 }); }   // VFG oil to and from the generator
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
    line('fuel', [P(-1.02, 12, .64), P(-1.03, 11.9, .49), P(-1.05, 11.2, .47), P(-1.10, 10.3, .48), P(-1.20, 9.4, .50), P(-1.25, 8.6, .51)], .02, 'hose', { clamps: 3 });   // supply from the pylon to the IFPC
    for (const [o, r1] of [[0, 0], [.12, .022]]) {                                                                                               // boost fuel to and from the FOHX
      line('fuel', [P(-1.12, 11.55 + o, .43), P(-1.18, 10.9 + o, .49), P(-1.30, 9.9 + o, .47 + r1), P(-1.40, 9.4 + o * .4, .465 + r1 * .4), P(-1.44, 9.3, .44)], .012, 'tube', { clamps: 2 }); }
    /* metered fuel: two tubes leave the FOM's aft face above the end of the MGB and run aft under the AOHX to the primary and secondary manifolds */
    line('fuel', [P(-1.488, 9.2, .39), P(-1.515, 9.22, .372), P(-1.62, 9.35, .345), P(-1.69, 9.55, .315), P(-1.725, 9.8, .305)], .012, 'tube', { clamps: 2 });
    line('fuel', [P(-1.488, 9.32, .40), P(-1.515, 9.35, .37), P(-1.62, 9.5, .35), P(-1.69, 9.75, .335), P(-1.716, 10.0, .327)], .012, 'tube', { clamps: 2 });
    for (const [dr, nm] of [[.0, 'primary'], [.022, 'secondary']]) {
      const xr = -1.725 + dr * .4, rr = .305 + dr; PW.add('fuel', G.revolve([[xr + .008, rr - .008], [xr - .008, rr - .008], [xr - .008, rr + .008], [xr + .008, rr + .008]], { seg: 96 }), 'steel');
      for (let i = 0; i < 16; i++) { const a = i / 16 * TAU + TAU / 32; PW.add('fuel', G.rod(G.onRing(xr, rr, a), G.onRing(-1.761, .284, a), .004), 'steel'); } }

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
      box('hpc-sva', x3 - .04, 4.25, rCase(x3) + .05, .05, .09, .035, 'steel'); }                                                           // bellcrank
    PW.part('lpc-sva', { parent: 'air', label: 'LPC stator vane actuator and synchronizing ring', src: 'p.258-261',
      info: 'Fuel-powered actuator at 5 o\'clock on the CIC firewall. Its rod runs forward through the firewall to a bellcrank on the synchronizing ring round the LPC inlet, which turns the LPC inlet guide vanes together. The EEC positions it on N1 through a dual-coil torque motor and servovalve, with a dual-coil LVDT reporting to each channel.\n\nThe manual\'s text has the vanes moving toward closed for start and idle, modulating in transients and open above idle (its table differs for the start case). With no power the actuator drives the vanes open.' });
    { const rw = D.GEN.rows.find(r => r.name.startsWith('LPC variable')); const xx = (rw.x_le + rw.x_te) / 2, rr = .392;
      PW.add('lpc-sva', G.revolve([[xx + .007, rr], [xx - .007, rr], [xx - .007, rr + .014], [xx + .007, rr + .014]], { seg: 128 }), 'steel');
      PW.add('lpc-sva', G.ringInstances(new THREE.BoxGeometry(.03, .022, .009).translate(-.004, rr - .005, 0), PW.partMat('lpc-sva', 'darkBox'), 40, { x: xx + .006 }), null);
      can('lpc-sva', -1.12, 5.0, .455, .028, .18, 'steel'); box('lpc-sva', -1.15, 5.15, .468, .08, .04, .05, 'darkBox');
      line('lpc-sva', [P(-1.03, 5.0, .455), P(-.95, 5.0, .466), P(-.80, 5.0, .468), P(xx - .02, 5.0, .43)], .007, 'tube', { clamps: 0, ends: false });
      box('lpc-sva', xx - .025, 5.0, .425, .04, .06, .03, 'steel'); }                                                                       // bellcrank on the ring
    PW.part('bleed-25', { parent: 'air', label: '2.5 bleed valve and actuator', src: 'p.264-267',
      info: 'Ring valve round the LPC case just forward of the CIC, at station 2.5. Opened, it dumps LPC exit air into the fan stream, giving the LPC surge margin during starts, low power and transients and throwing out dirt, rain and ice on the ground. Its actuator is horizontal on the right side, on the aft face of the CIC firewall, and works the ring through a bellcrank. It runs on IFPC servo fuel through an integral torque motor.\n\nThe EEC schedules it on N1, biased with altitude and Mach: open for start and idle, modulating in transients, closed at takeoff. It fails open. On a surge the EEC opens it, selects continuous ignition on both igniters and resets the variable vanes.' });
    { PW.add('bleed-25', G.ring(-.895, -.93, .425, .455, { seg: 128 }), 'nickel'); PW.add('bleed-25', G.boltCircle(PW.partMat('bleed-25', 'steel'), -.893, .44, 48, .004), null);
      can('bleed-25', -1.12, 3.0, .455, .03, .18, 'steel'); box('bleed-25', -1.15, 2.85, .47, .08, .04, .05, 'darkBox');                   // actuator with its torque motor
      line('bleed-25', [P(-1.03, 3.0, .455), P(-.95, 3.0, .462), P(-.86, 3.0, .466)], .007, 'tube', { clamps: 0, ends: false });
      box('bleed-25', -.85, 3.0, .468, .05, .05, .03, 'steel'); }                                                                            // bellcrank ahead of the ring
    PW.part('hpc-bleed-valve', { parent: 'air', label: 'HPC bleed valve and pressure sensor', src: 'p.264-267',
      info: 'Two-position poppet valve on top of the HPC at the 6th-stage bleed port. It is spring-loaded open for the start, dumping 6th-stage air into the core compartment, and HPC pressure (station 2.9) closes it; it is fully closed by idle. The cowl anti-ice valves open during the start as well, adding bleed through the anti-ice ducting.\n\nA sense line runs forward over the case to the pressure sensor on the CIC firewall, upper right. The EEC uses it to detect a valve that fails open after the start, putting hot air into the core compartment, or one that stays closed during the start, which can stall the HPC.' });
    { const xb = -1.53, rb = Math.max(rCase(xb), .235);
      can('hpc-bleed-valve', xb, 12, rb + .045, .035, .09, 'steel', { rot: [G.clock(12), 0, Math.PI / 2] }); box('hpc-bleed-valve', xb, 12, rb + .105, .07, .03, .07, 'darkBox');
      line('hpc-bleed-valve', [P(xb, 12, rb + .12), P(-1.45, 12.25, .335), P(-1.34, 12.35, .33), P(-1.20, 12.7, .34), P(-1.08, 1.3, .39), P(-1.005, 1.75, .45)], .005, 'tube', { clamps: 4 });
      box('hpc-bleed-valve', -1.005, 1.8, rFire(-1.005) + .02, .05, .04, .045, 'steel'); }                                                    // pressure sensor
    PW.part('bleed-hp', { parent: 'air', label: 'Bleed ports and ducts (4th and 8th stage)', src: 'p.264; TTM ch. 36; photos',
      info: 'Customer bleed is taken from the HPC case at the 4th stage, or from the 8th stage through the high-pressure valve when 4th-stage pressure is too low. Insulated ducts carry it up into the pylon, where the precooler and the pressure-regulating shutoff valve sit. A duct leak in the core compartment is detected by the overheat loops and can open the IFS pressure-relief door.' });
    { const r4 = D.GEN.rows.find(r => r.name.startsWith('HPC rotor 4')), r8 = D.GEN.rows.find(r => r.name.startsWith('HPC rotor 8'));
      const x4 = (r4.x_le + r4.x_te) / 2, x8 = (r8.x_le + r8.x_te) / 2;
      PW.add('bleed-hp', G.revolve([[x4 + .03, rCase(x4)], [x4 - .03, rCase(x4)], [x4 - .03, rCase(x4) + .035], [x4 + .03, rCase(x4) + .035]], { seg: 96 }), 'nickel');     // 4th-stage manifold collar
      line('bleed-hp', [P(x4, 11.6, rCase(x4) + .03), P(x4 - .05, 11.8, .45), P(-1.5, 12, .62), P(-1.7, 12, .78)], .045, 'duct', { clamps: 2 });
      line('bleed-hp', [P(x8, .4, rCase(x8) + .02), P(x8 + .02, .2, .42), P(-1.55, .1, .62)], .035, 'duct', { clamps: 2 });
      can('bleed-hp', -1.58, 12, .60, .06, .12, 'steel'); box('bleed-hp', -1.58, 12, .68, .1, .08, .09, 'darkBox');               // high-pressure valve
      /* p.297: the precooler sits above the core at 12 o'clock in the upper bifurcation, fed with fan air by a corrugated duct from the
         precooler duct inlet behind the FEGVs; hot bleed enters from below */
      PW.part('precooler', { parent: 'air', label: 'Precooler', src: 'p.60, p.297; TTM ch. 36',
        info: 'Air-to-air heat exchanger above the core at 12 o\'clock in the upper bifurcation, downstream of the pressure-regulating shutoff valve. Fan air from the precooler duct inlet cools the engine bleed to a temperature the aircraft ducts can take; the fan air valve modulates that flow on the bleed temperature sensor downstream. The spent cooling air is dumped into the core compartment and vents overboard through the precooler exhaust door on the right IFS.' });
      const pcx = -1.90, pcy = .74; { const m = new THREE.Mesh(G.roundedBox(.40, .46, .24, .03)); m.position.set(pcx, pcy, 0); PW.add('precooler', m, 'steel', { solid: true });
        for (let i = 0; i < 9; i++) { const f = new THREE.Mesh(G.roundedBox(.36, .42, .004, .001)); f.position.set(pcx, pcy, -.1 + i * .025); PW.add('precooler', f, 'nickel', { solid: true, shadow: false }); } }
      line('precooler', [V(-1.05, .97, 0), V(-1.30, .925, 0), V(-1.55, .86, 0), V(pcx + .2, .80, 0)], .07, 'tube', { clamps: 5, ends: false });
      /* TTM ch. 36: the spent cooling air is discharged into the core compartment and vents overboard (precooler exhaust door, right IFS) */
      line('precooler', [V(pcx - .17, .60, .04), V(-2.12, .55, .045), V(-2.17, .50, .04)], .045, 'duct', { clamps: 0 }); }
    PW.part('tacc', { parent: 'air', label: 'Turbine active clearance control', src: 'p.270-277',
      info: 'Fan air taken through the scoop on the right IFS at about 1:30 passes the ACC valve and is sprayed onto the HPT and LPT cases from ring manifolds. Shrinking the cases closes the blade tip clearances in cruise, saving fuel; the valve is closed for takeoff and most of the climb.' });
    { for (const xx of [-1.93, -2.0, -2.25, -2.32, -2.39]) { const rr = Math.max(rCase(xx), .24) + .025; PW.add('tacc', G.revolve([[xx + .012, rr - .012], [xx - .012, rr - .012], [xx - .012, rr + .012], [xx + .012, rr + .012]], { seg: 128, crease: 80 }), 'steel'); }
      const xT = D.GEN.externals.lptCaseTorus; PW.add('tacc', G.revolve(circ(xT.x, xT.r_centre, xT.tube_od / 2, 10), { seg: 128 }), 'steel');
      line('tacc', [P(-1.62, 1.5, .55), P(-1.72, 1.25, .45), P(-1.88, 1.2, .35), P(-1.95, 1.35, .32)], .03, 'tube', { clamps: 1 });
      line('tacc', [P(-1.95, 1.35, .32), P(-2.15, 1.4, .42), P(-2.30, 1.5, .50)], .03, 'tube', { clamps: 1 });
      box('tacc', -1.95, 1.35, .33, .1, .07, .09, 'darkBox'); }
    PW.part('cai', { parent: 'air', label: 'Cowl anti-ice duct and valves', src: 'p.10-11; TTM ch. 30; photos',
      info: 'HPC 6th-stage bleed for the inlet lip. It passes two cowl anti-ice valves in series (two for redundancy), controlled and monitored by the EEC from the L and R COWL switches (OFF, AUTO, ON), crosses the fan duct in the lower bifurcation and runs forward along the bottom right of the fan case into the inlet at 5 o\'clock, where its access panel is. The air leaves through the exhaust louvres at the bottom of the inlet. The valves also open during the start to help the HPC bleed valve unload the compressor.\n\nThe black hose with orange fittings along the fan case in the photos.' });
    { /* 6th-stage port on the right of the HPC, the two valves on the right of the core, down into the lower bifurcation at 6 o'clock,
         forward under the reverser to the fan case and along it at 5 o'clock */
      const pts = [P(-1.53, 3.3, .265), P(-1.50, 3.4, .34), P(-1.42, 3.55, .44), P(-1.36, 3.9, .49), P(-1.36, 4.6, .50), P(-1.30, 5.3, .50), P(-1.16, 5.8, .47), P(-1.11, 5.98, .52), P(-1.10, 6.0, .60),
        P(-1.10, 6.0, .80), P(-1.06, 6.0, .99), P(-.95, 6.0, .995), P(-.86, 5.85, 1.03), P(-.78, 5.55, 1.055), P(-.62, 5.1, 1.035), P(-.55, 5.0, 1.03), P(.20, 5.0, 1.0), P(.34, 5.0, 1.03)];
      const c = line('cai', pts, .03, 'black', { clamps: 6 });
      PW.add('cai', G.alongCurve(c, [.085, .16], () => new THREE.CylinderGeometry(.045, .045, .085, 20)), 'steel');                         // the two cowl anti-ice valves, in series
      for (const p of [P(-.62, 5.1, 1.035), P(.20, 5.0, 1.0)]) { const m = new THREE.Mesh(G.can(.042, .09)); m.position.copy(p); PW.add('cai', m, 'clampOrange', { solid: true }); } }

    /* ============================== ELECTRICAL AND CONTROL ============================== */
    PW.part('eec', { label: 'Electronic engine control (EEC)', explode: [0, 0, -.6], src: 'p.74-95, p.104-105; photos',
      info: 'Dual-channel FADEC computer on the left side of the fan case at 9 o\'clock, on four vibration isolators, cooled by fan compartment air. Each channel has a control and a protection processor. It sets thrust, schedules fuel, vanes, bleeds and clearance control, runs starts and the reverser logic, and stores faults.\n\nThe data storage unit plugged into it holds the engine rating and trim data; it stays with the engine if the EEC is changed. Eight connectors: check them seated and locked after any EEC work.' });
    /* p.105: on the left of the fan case about a third of the way aft, standing upright, connectors on its upper and lower faces */
    { const ex = -.08, eh = 9, er = 1.045, b = box('eec', ex, eh, er, .44, .10, .38, 'eecGrey', { round: .012 });
      for (let i = 0; i < 4; i++) { connector('eec', P(ex + .16 - i * .1, eh + .62, er + .015), V(.15, .6, 1).normalize()); connector('eec', P(ex + .16 - i * .1, eh - .62, er + .015), V(.15, -.6, 1).normalize()); }
      for (const dx of [-.18, .18]) for (const dh of [-.5, .5]) { const iso = new THREE.Mesh(G.can(.018, .03)); iso.geometry.rotateZ(Math.PI / 2); iso.position.copy(P(ex + dx, eh + dh, er - .065)); iso.rotation.x = G.clock(eh + dh); PW.add('eec', iso, 'rubber', { solid: true }); }
      box('eec', ex + .1, eh + .12, er + .053, .07, .004, .07, 'darkBox', { round: .004 }); box('eec', ex - .02, eh + .12, er + .053, .05, .004, .07, 'whitePaint', { round: .003 });   // "THIS SIDE UP" plates
      PW.part('dsu', { parent: 'eec', label: 'Data storage unit (DSU)', src: 'p.90-91, p.104-105',
        info: 'Small memory module plugged into the EEC that holds the engine serial number, rating and trim data. It stays with the engine: when an EEC is changed, the new one reads the engine\'s data from the DSU.' });
      box('dsu', ex - .25, eh + .2, er + .01, .07, .06, .08, 'darkBox'); }
    PW.part('harnesses', { label: 'Engine harnesses', explode: [0, .25, 0], src: 'p.102-107; photos',
      info: 'Braided harnesses from the EEC to every sensor, valve and actuator, clipped to the fan case on lime-green stand-offs. WF01 and WF02 bring the aircraft connections down from the pylon to the EEC; W03 and W04 run from the EEC along the bottom of the fan case into the core; WC05 rings the turbine exhaust for the EGT probes and WC08 runs over the HPC (p.105, p.107). Chafe at clamps and connector security are the usual findings.' });
    /* p.105 / p.107: WF01 and WF02 come down from the pylon interface at 12 o'clock to the EEC; W03 and W04 leave its lower face, run
       down to 6 o'clock, aft along the bottom of the fan case and up into the core at the gearbox; the core harnesses (WC05 round the
       turbine exhaust for the EGT probes, WC08 over the HPC) branch from there */
    { const r = 1.0, arc = (x0, x1, h0, h1, n) => { const pts = []; for (let i = 0; i <= n; i++) { const t = i / n; pts.push(P(x0 + (x1 - x0) * t, h0 + (h1 - h0) * t, r + .012)); } return pts; };
      const runs = [arc(.12, .03, 12, 9.75, 10), arc(.08, -.01, 12, 9.85, 10), arc(-.12, -.32, 8.3, 6.05, 10), arc(-.04, -.40, 8.3, 6.0, 10), arc(.0, -.45, 12, 15.0, 12)];
      for (const pts of runs) { line('harnesses', pts, .014, 'harness', { clamps: 6, tension: .3 });
        for (let i = 1; i < pts.length - 1; i += 2) { const so = new THREE.Mesh(G.roundedBox(.03, .02, .02, .004)); so.position.copy(pts[i]).multiplyScalar(.995); PW.add('harnesses', so, 'lime', { solid: true }); } }
      /* W03 and W04 aft from the fan case under the reverser, outboard of the ignition cables and the anti-ice duct, down the lower
         bifurcation at x -1.29 and into the core */
      for (const [dz, dh] of [[-.03, .05], [.03, -.05]]) line('harnesses', [P(-.36, 6.0, r + .012).add(V(0, 0, dz)), P(-.70, 6.0, r + .01).add(V(0, 0, dz)), P(-.82, 6 + dh, 1.09), P(-1.20, 6 + dh, 1.09), P(-1.28, 6 + dh, .95), P(-1.29, 6 + dh, .75), P(-1.30, 6 + dh * .8, .58), P(-1.33, 6.3 + dh * .5, .50), P(-1.35, 6.9, .42)], .016, 'harness', { clamps: 5 });
      for (const [x, h] of [[.12, 12], [.08, 11.85]]) { const c = new THREE.Mesh(G.can(.024, .05)); c.geometry.rotateZ(Math.PI / 2); G.aim(c, P(x, h, 1.035), P(0, h, 1).normalize()); PW.add('harnesses', c, 'connector', { solid: true }); }
      /* WC08 up the left of the core forward of the IFPC, over the layshaft, and over the HPC to the top; WC05 branches from it and runs
         aft along the top in the pylon gap, over the clearance control manifolds, to the EGT harness ring behind the LPT */
      line('harnesses', [P(-1.35, 6.9, .42), P(-1.19, 7.4, .38), P(-1.19, 8.2, .375), P(-1.25, 9.5, .325), P(-1.4, 11.2, .31), P(-1.68, 12.15, .31)], .012, 'harness', { clamps: 4 });
      line('harnesses', [P(-1.66, 12.1, .32), P(-1.75, 12.05, .37), P(-1.95, 12.1, .42), P(-2.13, 12.15, .47), P(-2.24, 12.08, .555), P(-2.40, 12.0, .56), P(-2.48, 12.05, .50), P(-2.505, 12.2, .445)], .012, 'harness', { clamps: 4 }); }
    PW.part('ignition', { label: 'Ignition system', explode: [0, 0, -.35], src: 'p.306-323; TTM ch. 74',
      info: 'One exciter on the left of the fan case at 8 o\'clock, cooled by fan compartment air, with two independent capacitor-discharge circuits: system A run by EEC channel A, system B by channel B. Each fires its own igniter at 5 kV, 1 to 3 sparks a second, through a braided steel cable that runs under the engine to the diffuser case: igniter A at 4 o\'clock, igniter B at 5 o\'clock. On this (right) engine the circuits are powered from DC ESS BUS 2 and 3; the left engine uses DC ESS BUS 1 and 3.\n\nAn automatic start uses one igniter, alternating each start: on at 20.4 to 23.5 percent N2, off at 49.3 to 53.3 percent. If the first attempt fails, the EEC dry motors the engine and tries again on both. The EEC selects both igniters continuously after a flameout in flight or on the takeoff roll above 60 kt, an in-flight surge, or for an in-flight start.\n\nWait at least 5 minutes after the ignition last operated before removing a plug or cable: the voltage can injure.' });
    { box('ignition', -.53, 8.0, 1.06, .21, .09, .10, 'darkBox'); box('ignition', -.635, 8.0, 1.06, .02, .09, .10, 'steel');                   // the exciter, with its output end plate aft
      PW.part('igniters', { parent: 'ignition', label: 'Igniter plugs (2)', src: 'p.314, p.318-319',
        info: 'Two igniter plugs through the diffuser case into the combustion chamber: A at 4 o\'clock, B at 5 o\'clock. Each sits in a mounting boss over classified spacers that set its immersion depth; the boss and spacers stay on the case when a plug is changed. The cables are interchangeable, with ceramic-insulated terminals at the plug end.' });
      /* p.314: the cables run aft along the bottom of the fan case and under the reverser, down the lower bifurcation at x -1.2 and aft
         under the core, clear of the drain mast, VFG and oil control module, to the plugs just aft of the fuel nozzles */
      for (const [h0, dh, hp] of [[7.95, .03, 4.05], [8.05, -.03, 5.25]]) {
        const run = [P(-.645, h0, 1.05), P(-.74, 7.0 + dh, 1.055), P(-.82, 6.3 + dh, 1.06), P(-.90, 6.0 + dh, 1.055), P(-1.12, 6.0 + dh, 1.05), P(-1.19, 6.0 + dh, .95), P(-1.20, 6.0 + dh, .75),
          P(-1.21, 5.97 + dh, .58), P(-1.30, 5.9 + dh, .52), P(-1.50, 5.85 + dh, .525), P(-1.75, 5.78 + dh, .53)];
        const tail = hp < 4.5 ? [P(-1.80, 5.2, .505), P(-1.80, 4.8, .495), P(-1.80, 4.5, .49), P(-1.79, 4.25, .43), P(-1.78, hp, .33)] : [P(-1.79, 5.45, .45), P(-1.785, 5.36, .35), P(-1.78, hp, .32)];
        line('ignition', run.concat(tail), .009, 'tube', { clamps: 6 });
        can('igniters', -1.78, hp, .278, .013, .055, 'steel', { rot: [G.clock(hp), 0, Math.PI / 2] }); box('igniters', -1.78, hp, .258, .05, .02, .05, 'steel'); } }   // plug in its mounting boss
    PW.part('sensors', { label: 'Engine sensors', explode: [0, .2, .2], src: 'p.102-161',
      info: 'Speed probes for N1 (station 2.5 at 4:30 on the CIC) and fan speed (No. 1 bearing support at 1 o\'clock), PMAG for N2, T3 and P3 at the HPC exit, the EGT thermocouple harness behind the LPT at station 5, two vibration sensors, and the oil sensors on the OCM. Their signals go to the EEC; vibration and oil debris also go to the PHMU.' });
    { for (let i = 0; i < 8; i++) { const a = G.clock(i * 1.5 + .75), xx = -2.47; PW.add('sensors', G.rod(G.onRing(xx, .40, a), G.onRing(xx, .30, a), .007), 'steel'); }        // EGT probes at station 5
      PW.add('sensors', G.revolve(circ(-2.47, .405, .006, 8), { seg: 96 }), 'steel');
      PW.add('sensors', G.revolve(circ(-2.505, .43, .009, 8), { seg: 96 }), 'harness');                                                      // WC05 harness ring round the turbine exhaust (p.107)
      box('sensors', -1.05, 4.5, .43, .05, .06, .05, 'darkBox');                                                                                // N1 speed probe, station 2.5 at 4:30 (p.112)
      box('sensors', -.94, 2.5, .44, .05, .07, .05, 'steel'); can('sensors', -.94, 2.5, .40, .012, .06, 'steel', { rot: [G.clock(2.5), 0, Math.PI / 2] });   // P2.5/T2.5 probe on the CIC (p.107)
      box('sensors', -1.74, 2.6, .33, .06, .04, .07, 'steel');                                                                                  // T3 probe on the diffuser case (p.107)
      can('sensors', -1.35, 10.6, .36, .016, .09, 'steel', { rot: [G.clock(10.6), 0, Math.PI / 2] });                                          // burner pressure (PB) sensor (p.105)
      box('sensors', -.86, 10.5, 1.0, .07, .04, .06, 'darkBox'); box('sensors', -2.5, 10.5, .48, .07, .04, .06, 'darkBox'); }               // vibration sensors
    PW.part('phmu', { label: 'Prognostics and health management unit (PHMU)', explode: [0, .3, .3], src: 'p.92-95', info: 'Box on the fan case that records vibration and oil debris data for trend monitoring and fan trim balance solutions. It talks to the EEC over a CAN bus.' });
    box('phmu', -.40, 10.3, 1.04, .26, .08, .16, 'eecGrey');
    PW.part('pdos', { label: 'Power door opening system', explode: [0, .3, .4], src: 'p.32-43',
      info: 'Hydraulic powerpack on the fan case at about 2 o\'clock and one opening actuator per reverser door, which lifts the door to the hold-open rod position. A hand pump can be connected at the quick-disconnect instead; the TTM notes that newer production aircraft have no powerpack and use the hand pump only. Never stand under a door held only by its actuator: install the hold-open rods.' });
    { box('pdos', -.70, 2.0, 1.04, .24, .1, .14, 'accGrey'); for (const h of [4, 8]) line('pdos', [P(-.80, h, 1.0), P(-1.0, h, 1.05)], .022, 'tube', { clamps: 0 }); }

    /* ============================== FIRE PROTECTION ============================== */
    PW.part('fire', { label: 'Fire detection and extinguishing', explode: [0, .15, -.2], src: 'TTM ch. 26 (p.262-269)',
      info: 'Two detection loops, A and B, each of five sensing elements in series: one on the pylon above the core and two on each core cowl (the inner fixed structure halves), so the cowl elements open with the reverser doors. The FIDEX control unit, with two identical cards, monitors the loops, the bottle cartridges and pressure switches, and drives the L or R ENG FIRE lights, the FIRE light on the ENGINE panel, the CAS message and the aural warning. A manual test is run from the flight deck.\n\nTwo bottles on the aft spar just forward of the main gear bay, each with two discharge heads, can discharge into either engine. The discharge line comes down the pylon to a nozzle with two outlets at the top of the core compartment.' });
    /* TTM p.268: the pylon element (loops A and B side by side) along the underside of the pylon, in the gap between the IFS halves;
       the core cowl elements are built with the reverser doors in build-nacelle.js */
    { for (const dz of [-.04, -.062]) line('fire', [V(-1.10, .60, dz), V(-1.25, .60, dz), V(-1.45, .60, dz)], .0035, 'tube', { clamps: 3, tension: 0 });
      /* TTM ch. 26: the discharge line comes down from the pylon to a nozzle with two outlets at the top of the core compartment */
      line('fire', [V(-1.24, .80, 0), V(-1.24, .62, 0), V(-1.24, .535, 0)], .008, 'tube', { clamps: 1, tension: 0 });
      box('fire', -1.24, 12, .52, .03, .025, .07, 'steel'); }

    /* ============================== MOUNTS ============================== */
    PW.part('mounts', { label: 'Engine mounts', explode: [0, .5, 0], src: 'p.44-49; TTM ch. 71',
      info: 'Forward mount at 12 o\'clock on the fan case mount ring; aft mount at 12 o\'clock on the turbine exhaust case. Two thrust links run from the CIC to the aft mount balance beam and carry the thrust into the pylon. Each mount has a fail-safe link that only takes load if a primary link fails.' });
    { const xf = NC.engineForwardMountPlane.x, xa = NC.engineAftMountPlane.x;
      box('mounts', xf, 12, 1.09, .12, .09, .30, 'steel');
      for (const s of [-1, 1]) line('mounts', [V(xf, 1.04, .1 * s), V(xf, 1.12, .2 * s)], .014, 'tube', { clamps: 0 });
      box('mounts', xa, 12, .56, .14, .08, .36, 'steel');
      for (const s of [-1, 1]) { line('mounts', [P(xa, s > 0 ? 1 : 11, .49), V(xa, .56, .14 * s)], .016, 'tube', { clamps: 0 });
        /* thrust links: inside the core compartment until they rise into the pylon gap between the IFS halves (within 10 deg of top) */
        line('mounts', [P(-1.0, s > 0 ? 1.6 : 10.4, .44), P(-1.25, s > 0 ? 1.5 : 10.5, .49), P(-1.8, s > 0 ? .7 : 11.3, .52), P(-2.15, s > 0 ? .55 : 11.45, .52), P(-2.32, s > 0 ? .25 : 11.75, .555), V(xa + .07, .56, .09 * s)], .022, 'tube', { clamps: 0, tension: 0 }); } }

    /* ============================== DRAINS ============================== */
    PW.part('drain-mast', { label: 'Drain lines and drain mast', explode: [0, -.5, 0], src: 'p.50-51',
      info: 'Eight drain lines from the LPC and HPC vane actuators, the 2.5 bleed valve, the IFPC and FOM, the hydraulic pump, the VFG, the oil tank scupper and the starter run to the drain mast, which exits through the latch access door at 6 o\'clock. A drain map placard inside the door identifies each tube, so the source of a leak can be found from which tube drips.' });
    /* p.50: each drain runs from its source to the collector under the core at 6 o'clock; the mast carries them down the lower
       bifurcation and through the reverser to the latch access panel at the bottom of the nacelle */
    { const xm2 = -1.48, runs = [
        [P(-1.21, 5.0, .455), P(-1.23, 5.4, .48), P(-1.30, 6.0, .50)],                                                              // LPC stator vane actuator
        [P(-1.21, 3.0, .455), P(-1.22, 3.5, .47), P(-1.22, 4.5, .485), P(-1.24, 5.4, .49), P(-1.31, 6.0, .505)],                   // 2.5 bleed valve actuator
        [P(-1.30, 4.05, .37), P(-1.23, 4.2, .46), P(-1.225, 4.5, .49), P(-1.245, 5.4, .49), P(-1.32, 5.98, .50)],                // HPC stator vane actuator
        [P(-1.40, 5.95, .455), P(-1.42, 6.0, .50)],                                                                                // hydraulic pump
        [P(-1.40, 7.15, .46), P(-1.40, 6.6, .50), P(-1.42, 6.1, .51)],                                                              // fuel/oil manifold and IFPC
        [P(-1.85, 7.93, .45), P(-1.80, 7.5, .47), P(-1.68, 7.0, .465), P(-1.56, 6.6, .47), P(-1.47, 6.2, .52)],                     // starter
        [P(-1.70, 6.05, .515), P(-1.60, 6.03, .53), P(-1.50, 6.02, .55)],                                                           // VFG
        [P(-1.92, 2.0, .535), P(-1.92, 3.0, .54), P(-1.92, 4.0, .54), P(-1.92, 4.8, .54), P(-1.88, 5.5, .545), P(-1.75, 5.95, .545), P(-1.55, 6.0, .55)]];   // oil tank scupper
      runs.forEach((pts, i) => { const a = (i - 3.5) * .01; line('drain-mast', pts.concat([P(xm2 + .03, 6 + a, .56), P(xm2, 6 + a, .62)]), .004, 'tube', { clamps: 1, ends: false }); });
      line('drain-mast', [P(xm2, 6, .60), P(xm2, 6, .85), P(xm2 - .01, 6, 1.13)], .016, 'tube', { clamps: 2, tension: 0 });            // the mast, down the bifurcation and through the reverser
      box('drain-mast', xm2 - .01, 6, 1.155, .07, .04, .045, 'steel'); }                                                             // its outlet, standing just proud of the latch access panel
  }
  /* a small circle profile (tori for manifolds) */
  function circ(x, r, rad, n) { const out = []; for (let i = 0; i < n; i++) { const a = i / n * TAU; out.push([x + rad * Math.cos(a), r + rad * Math.sin(a)]); } return out; }
})();
