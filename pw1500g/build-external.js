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
  /* an electrical connector with its backshell, pointing along dir */
  function connector(pid, at, dir) { const c = new THREE.Mesh(G.can(.022, .05)); c.geometry.rotateZ(Math.PI / 2); G.aim(c, at, dir); PW.add(pid, c, 'connector', { solid: true });
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(.026, .026, .012, 16)); ring.geometry.userData.solid = true; G.aim(ring, at.clone().addScaledVector(dir.clone().normalize(), .018), dir); PW.add(pid, ring, 'orange', { solid: true }); }
  /* a routed line with clamps: kind 'tube' | 'hose' | 'harness' | 'duct' */
  function line(pid, pts, r, kind, o) { o = o || {};
    const mat = { tube: 'tube', hose: 'fireSleeve', harness: 'harness', duct: 'insulation', black: 'blackHose' }[kind] || 'tube';
    const g = G.tube(pts.map(p => (p.isVector3 ? p : V(...p))), r, { radial: kind === 'duct' ? 16 : 10, tension: o.tension === undefined ? .25 : o.tension });
    PW.add(pid, g, mat);
    const curve = g.userData.curve, n = o.clamps === undefined ? Math.max(1, Math.round(curve.getLength() / (kind === 'duct' ? .35 : .25))) : o.clamps;
    if (n > 0) { const ts = []; for (let i = 1; i <= n; i++) ts.push(i / (n + 1));
      /* clamps are thin bands: orange cushioned P-clamps on small lines, steel V-band couplings on large ducts */
      const big = kind === 'duct' || r > .03, band = Math.min(r * 1.6, big ? .022 : .016);
      PW.add(pid, G.alongCurve(curve, ts, () => new THREE.CylinderGeometry(r + Math.min(.008, r * .35), r + Math.min(.008, r * .35), band, 16)), big ? 'steel' : kind === 'harness' ? 'connector' : 'clampOrange', { shadow: false }); }
    if (o.ends !== false && kind !== 'duct') PW.add(pid, G.alongCurve(curve, [0.012, .988], () => new THREE.CylinderGeometry(r * 1.6, r * 1.6, r * 2.2, 6)), kind === 'harness' ? 'connector' : 'steel', { shadow: false });
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
      info: 'Drive shaft from the angle gearbox aft to the main gearbox input pad, inside two concentric tubular covers. It runs close to the core, nearly parallel to the axis.' });
    { const ls = GB.layshaft; line('layshaft', [P(ls.x_from, 8, ls.r_axis + .02), P((ls.x_from + ls.x_to) / 2, 7.6, ls.r_axis + .03), P(-1.49, 7.1, .40)], .032, 'tube', { clamps: 2, tension: .1 }); }
    PW.part('mgb', { parent: 'gearboxes', label: 'Main gearbox (MGB)', src: 'p.66-69; p.53',
      info: 'Crescent-shaped aluminium casting under the core, from about 4:30 to 9 o\'clock, with machined drive pads on both faces. Forward face: IFPC on the fuel/oil manifold (8 o\'clock), layshaft input, hydraulic pump and the lube and scavenge oil pump (5 o\'clock). Aft face: air turbine starter, PMAG (7 o\'clock), VFG and the oil control module.\n\nIts carbon seals at each pad, the N2 cranking pad for hand-turning the core during a borescope, and the core drain plugs are serviced here.' });
    const mg = GB.mainGearboxBody, mx0 = mg.x_from, mx1 = mg.x_to, mr0 = .335, mr1 = .43, xm = (mx0 + mx1) / 2;
    { const th0 = G.clock(4.5), th1 = G.clock(9);
      PW.add('mgb', G.revolve([[mx0, mr0], [mx1, mr0], [mx1 - .01, mr1], [mx0 + .01, mr1]], { seg: 40, thetaStart: th0, thetaLength: th1 - th0 }), 'gearboxCast');
      for (let i = 0; i <= 8; i++) { const a = th0 + (th1 - th0) * i / 8; PW.add('mgb', G.revolve([[mx0 - .02, mr1 - .005], [mx1 + .02, mr1 - .005], [mx1 + .02, mr1 + .012], [mx0 - .02, mr1 + .012]], { seg: 2, thetaStart: a - .02, thetaLength: .04 }), 'gearboxCast'); }   // ribs underneath
      for (const h of [4.5, 9]) box('mgb', xm, h, .31, mx0 - mx1, .07, .09, 'gearboxCast');                                    // ends turned up toward the core
      for (const [h, s] of [[5.2, 1], [8.3, -1]]) { const a = P(xm, h, .34), b = P(xm + .03 * s, h + .4 * s, .22); line('mgb', [a, b], .012, 'tube', { clamps: 0 }); }   // left and right mounting links to the core
      for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(G.can(.012, .03)); m.geometry.rotateZ(Math.PI / 2); m.position.copy(P(mx1 + .02, 7.4 + i * .15, mr1 - .01)); m.rotation.x = 0; PW.add('mgb', m, 'steel', { solid: true }); }   // core drain plugs
    }
    /* accessories on the MGB faces (p.69 layout; clocks from p.112, 170, 226, 296) */
    const acc = (pid, label, info, src) => PW.part(pid, { parent: 'gearboxes', label, info, src });
    const pad = (pid, x, h, r, rad) => { PW.add(pid, G.ring(x + .006, x - .006, rad * .7, rad * 1.18, { seg: 32 }), 'steel'); PW.add(pid, G.boltCircle(PW.partMat(pid, 'steel'), x + .007, rad, 8, .004), null).position.copy(P(0, h, r)); };
    // forward face
    acc('ifpc', 'Integrated fuel pump and control (IFPC)', 'Engine fuel pump and metering unit on the fuel/oil manifold at the left end of the MGB forward face, 8 o\'clock. A boost stage, a high-pressure gear stage and the fuel metering valve the EEC commands, plus the overspeed shutdown solenoid and the minimum pressure and shutoff valve.\n\nIts carbon-sealed drive pad is on the MGB. Fuel leaks here show at the drain mast.', 'p.162-171, p.69');
    { box('ifpc', mx0 + .14, 8.05, .40, .20, .17, .16, 'accGrey'); can('ifpc', mx0 + .25, 8.05, .38, .055, .10, 'steel');
      box('ifpc', mx0 + .08, 8.35, .43, .12, .10, .12, 'darkBox');                                             // metering head
      connector('ifpc', P(mx0 + .16, 8.0, .50), V(0, -.3, -1)); }
    acc('fom', 'Fuel/oil manifold (FOM) and fuel flow meter', 'Manifold block on the MGB forward face that carries the IFPC, the fuel/oil heat exchanger connections and the fuel filter. The fuel flow meter sits on it at 9 o\'clock and feeds the fuel used and fuel flow indications.', 'p.164-179, p.69');
    { box('fom', mx0 + .06, 8.8, .40, .12, .16, .22, 'accGrey'); can('fom', mx0 + .12, 9.1, .39, .045, .12, 'steel');
      can('fom', mx0 + .14, 8.6, .48, .05, .14, 'steel', { rot: [0, 0, 0] }); }                                 // fuel filter bowl
    acc('edp', 'Hydraulic engine-driven pump (EDP)', 'Variable-displacement hydraulic pump on the MGB forward face, supplying the aircraft hydraulic system on its side. It has a quick-disconnect drive and case drain; its fluid lines and the depressurising solenoid connect through the pylon.', 'p.66-69; TTM ch. 29');
    { can('edp', mx0 + .12, 5.8, .40, .065, .18, 'steel'); can('edp', mx0 + .23, 5.8, .40, .05, .06, 'accGrey'); pad('edp', mx0 + .012, 5.8, .40, .07);
      line('edp', [P(mx0 + .16, 5.6, .47), P(mx0 + .3, 5.0, .52), P(-.98, 3.8, .55)], .012, 'hose', { clamps: 2 }); }
    acc('lsop', 'Lubrication and scavenge oil pump (LSOP)', 'Seven-stage pump at the right end of the MGB forward face, 5 o\'clock: one pressure stage and six scavenge stages, each scavenge return with its own chip collector. A low oil pressure indication with normal quantity often points here or to the oil control module.', 'p.212-235, p.69');
    { can('lsop', mx0 + .14, 4.85, .40, .055, .24, 'accGrey'); for (let i = 0; i < 3; i++) can('lsop', mx0 + .07 + i * .07, 4.6, .44, .014, .03, 'steel');
      box('lsop', mx0 + .26, 4.85, .40, .06, .12, .1, 'accGrey'); }
    // aft face
    acc('ats', 'Air turbine starter (ATS)', 'Pneumatic starter at the left end of the MGB aft face, on a quick attach/detach (QAD) ring. Bleed air from the APU, ground cart or the other engine, admitted by the starter air valve, spins its turbine; it cranks the N2 rotor through the gearboxes and disengages above cutout speed.\n\nIt carries its own oil, with a sight glass and drain plug; check the oil level as part of starter troubleshooting.', 'p.286-301, p.69');
    { const ax = mx1 - .15, ah = 8.4, ar = .40; can('ats', ax, ah, ar, .115, .27, 'accGrey', { edge: .03 });
      PW.add('ats', G.ring(mx1 - .008, mx1 - .02, .10, .13, { seg: 40 }), 'steel').position.copy(P(0, ah, ar));                   // QAD ring
      for (let i = 0; i < 18; i++) { const a = i / 18 * TAU, m = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, .004, 8)); m.geometry.rotateZ(Math.PI / 2); m.position.copy(P(ax - .135, ah, ar).add(V(0, Math.cos(a) * .07, Math.sin(a) * .07))); PW.add('ats', m, 'darkBox', { solid: true }); }   // exhaust holes in the end cap
      /* starter air valve on the duct coming down from the pylon (left side) */
      acc('sav', 'Starter air valve (SAV)', 'Electrically controlled, pneumatically operated valve in the starter duct. The EEC opens it for a start and closes it at starter cutout. If it fails closed it can be opened by hand with a square drive through an access in the left reverser door, under the MEL procedure with a second person on the interphone.', 'p.290-299');
      /* p.297: the starter duct comes down from the pylon along the left of the core over the HPT, through the valve at 9 o'clock,
         then turns forward and down into the aft end of the starter */
      const top = P(-2.42, 11.4, .66), sv = P(-2.24, 9.0, .49), st = P(ax - .15, ah, ar);
      line('sav', [top, P(-2.38, 10.6, .56), P(-2.30, 9.6, .50), sv], .045, 'duct', { clamps: 2 }); line('sav', [sv, P(-2.10, 8.7, .46), P(-2.0, 8.45, .42), st], .045, 'duct', { clamps: 1 });
      can('sav', -2.24, 9.0, .49, .06, .1, 'steel'); box('sav', -2.24, 8.75, .55, .09, .08, .1, 'darkBox'); }
    acc('pmag', 'Permanent magnet alternator/generator (PMAG)', 'Small alternator on the MGB aft face at 7 o\'clock. It powers the EEC once N2 is above about 10 to 15 percent and its frequency is the N2 speed signal.', 'p.96-101, p.112, p.69');
    { can('pmag', mx1 - .08, 7.15, .40, .05, .13, 'accGrey'); connector('pmag', P(mx1 - .14, 7.15, .45), V(-.4, -1, -.3)); }
    acc('vfg', 'Variable frequency generator (VFG)', 'The engine\'s main AC generator, 75 kVA at 360 to 800 Hz (frequency follows N2), on the MGB aft face. Oil-cooled from the engine oil system. A disconnect lets the crew decouple it; it can only be reconnected on the ground.\n\nAn inoperative VFG is an MEL item with the APU generator as the replacement source.', 'p.66-69; TTM ch. 24');
    { const vr = .385; can('vfg', mx1 - .17, 6.15, vr, .13, .32, 'accGrey', { edge: .02 }); for (let i = 0; i < 7; i++) PW.add('vfg', G.ring(mx1 - .05 - i * .035, mx1 - .062 - i * .035, .13, .137, { seg: 40 }), 'accGrey').position.copy(P(0, 6.15, vr));
      box('vfg', mx1 - .30, 6.15, vr + .1, .1, .04, .14, 'labelBlue', { round: .006 }); connector('vfg', P(mx1 - .25, 5.75, vr + .09), V(-.3, -1, .6)); connector('vfg', P(mx1 - .18, 6.55, vr + .09), V(-.3, -1, -.6)); }
    acc('ocm', 'Oil control module (OCM)', 'Cast module at the right end of the MGB aft face carrying the main oil filter with its delta-P sensor, the oil pressure and temperature sensors and the oil debris monitor. It also holds the fuel/oil cooler bypass logic. A filter bypass or debris message is worked from here.', 'p.226-249, p.69');
    { box('ocm', mx1 - .12, 4.9, .40, .2, .15, .17, 'accGrey'); can('ocm', mx1 - .10, 4.62, .44, .05, .14, 'steel'); for (let i = 0; i < 4; i++) connector('ocm', P(mx1 - .07 - i * .04, 5.1, .46), V(0, -.6, .8)); }
    acc('deoiler', 'Deoiler', 'Self-contained centrifugal deoiler on the right of the MGB. It separates oil from the breather air of the bearing compartments and vents the air overboard.', 'p.67, p.226');
    { can('deoiler', xm, 4.35, .36, .045, .08, 'gearboxCast'); line('deoiler', [P(xm, 4.35, .41), P(xm - .2, 4.2, .5), P(-1.98, 4.4, .56)], .018, 'tube', { clamps: 1 }); }

    /* ============================== OIL SYSTEM ============================== */
    PW.part('oil', { label: 'Oil system', explode: [0, 0, .45], src: 'p.212-255; TTM ch. 79',
      info: 'Dry-sump system: the tank on the right of the core feeds the pressure stage of the lube and scavenge pump, the oil control module filters and monitors it, and part of the flow is cooled in the fuel/oil heat exchanger and the air/oil cooler before going to the bearings, gearboxes and the FDGS journals. Six scavenge stages return it to the tank through chip collectors.' });
    PW.part('oil-tank', { parent: 'oil', label: 'Oil tank', src: 'p.222-225; TTM ch. 79; photos',
      info: 'Engine-mounted tank on the right side of the core, 27.3 L (28.8 qt), with a de-aerator inside. Service it through the oil tank access door on the right reverser door at about 3 o\'clock: check the level on the sight glass, then fill through the filler cap. Do it within the AMM time after shutdown so the level is meaningful.\n\nA scupper round the filler drains spills to the drain mast.' });
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
      line('oil-tank', [P(tx + .06, 4.7, .44), P(-1.65, 4.9, .44), P(mx0 + .2, 4.85, .43)], .016, 'tube', { clamps: 2 });          // to the lube and scavenge pump
      line('oil-tank', [P(mx0 + .12, 4.6, .45), P(-1.70, 4.3, .48), P(tx + .12, 4.2, .47)], .014, 'tube', { clamps: 1 });          // scavenge return
      line('oil-tank', [P(tx - .12, 4.3, .46), P(-2.0, 4.5, .45), P(xm, 4.4, .40)], .012, 'tube', { clamps: 1 }); }                 // vent to the deoiler
    PW.part('aoc', { parent: 'oil', label: 'Air/oil cooler (AOC)', src: 'p.232-233',
      info: 'Plate-fin air/oil heat exchanger on the left of the core at about 10 o\'clock, cooled by fan air through the window in the left IFS. It cools oil returning from the VFG and the FDGS.' });
    { box('aoc', -1.54, 9.8, .50, .5, .1, .16, 'steel'); for (let i = 0; i < 14; i++) box('aoc', -1.54, 9.8, .555, .48, .012, .002, 'darkBox').position.add(V(0, 0, 0)).copy(P(-1.54, 9.8 + (i - 6.5) * .016, .555));
      line('aoc', [P(-1.30, 9.5, .48), P(-1.25, 8.9, .44), P(mx0 + .1, 8.6, .44)], .016, 'tube', { clamps: 1 }); }
    PW.part('fohe', { parent: 'oil', label: 'Fuel/oil heat exchanger (FOHE)', src: 'p.164-171, p.232',
      info: 'Fuel-cooled oil cooler on the fuel/oil manifold. Engine fuel takes heat from the oil, which also warms the fuel ahead of the filter so ice crystals do not block it.' });
    { can('fohe', mx0 + .18, 8.9, .50, .06, .26, 'steel'); for (let i = 0; i < 6; i++) PW.add('fohe', G.ring(mx0 + .08 + i * .04, mx0 + .075 + i * .04, .06, .066, { seg: 24 }), 'darkBox').position.copy(P(0, 8.9, .50)); }

    /* ============================== FUEL ============================== */
    PW.part('fuel', { label: 'Fuel system lines', explode: [0, 0, -.45], src: 'p.162-183; TTM ch. 73',
      info: 'Fuel comes down from the pylon to the IFPC on the MGB. Metered fuel goes through the flow meter and the fuel/oil heat exchanger to the primary and secondary manifolds round the diffuser case, which feed the 16 nozzles. Servo fuel drives the vane, bleed and clearance control actuators.' });
    line('fuel', [P(-1.0, 11.2, .64), P(-1.25, 10.2, .56), P(-1.45, 9.3, .50), P(mx0 + .16, 8.3, .46)], .02, 'hose', { clamps: 3 });          // supply from the pylon
    line('fuel', [P(mx0 + .12, 9.2, .44), P(-1.62, 9.6, .36), P(-1.70, 10, .33)], .014, 'tube', { clamps: 2 });                                  // metered fuel up to the manifolds
    for (const [dr, nm] of [[.0, 'primary'], [.022, 'secondary']]) {
      const xr = -1.725 + dr * .4, rr = .305 + dr; PW.add('fuel', G.revolve([[xr + .008, rr - .008], [xr - .008, rr - .008], [xr - .008, rr + .008], [xr + .008, rr + .008]], { seg: 96 }), 'steel');
      for (let i = 0; i < 16; i++) { const a = i / 16 * TAU + TAU / 32; PW.add('fuel', G.rod(G.onRing(xr, rr, a), G.onRing(-1.761, .284, a), .004), 'steel'); } }

    /* ============================== AIR SYSTEMS ============================== */
    PW.part('air', { label: 'Engine air systems', explode: [0, .4, 0], src: 'p.256-285; TTM ch. 75',
      info: 'Variable vanes on the LPC and HPC, the 2.5 and HPC bleed valves that keep the compressors stable during starts and transients, turbine active clearance control, and buffer air for the bearing compartment seals. All are scheduled by the EEC and moved by fuel-powered actuators.' });
    PW.part('hpc-sva', { parent: 'air', label: 'HPC stator vane actuator and unison rings', src: 'p.258-263',
      info: 'Fuel-powered actuator on the right of the HPC case at about 4 o\'clock. Through a bellcrank it turns four unison rings, which move the HPC inlet guide vanes and the first three stator rows together with N2. Closed at start and idle, open at high power.' });
    { const rows = ['HPC variable inlet guide vane', 'HPC stator 1', 'HPC stator 2', 'HPC stator 3'].map(n => D.GEN.rows.find(r => r.name.startsWith(n)));
      rows.forEach(rw => { if (!rw) return; const xx = (rw.x_le + rw.x_te) / 2, rr = Math.max(rCase(xx), .245) + .012;
        PW.add('hpc-sva', G.revolve([[xx + .006, rr], [xx - .006, rr], [xx - .006, rr + .012], [xx + .006, rr + .012]], { seg: 128 }), 'steel');
        PW.add('hpc-sva', G.ringInstances(new THREE.BoxGeometry(.03, .018, .006).translate(0, rr - .004, 0), PW.partMat('hpc-sva', 'steel'), 48, { x: xx + .006 }), null); });
      const x0 = rows[0] ? (rows[0].x_le + rows[0].x_te) / 2 : -1.15, x3 = rows[3] ? (rows[3].x_le + rows[3].x_te) / 2 : -1.39;
      can('hpc-sva', (x0 + x3) / 2, 4, rCase((x0 + x3) / 2) + .07, .028, .22, 'steel'); box('hpc-sva', x3 - .04, 4, rCase(x3) + .05, .04, .08, .03, 'steel'); }
    PW.part('lpc-sva', { parent: 'air', label: 'LPC inlet guide vane actuator', src: 'p.258-261', info: 'Fuel-powered actuator that sets the LPC variable inlet guide vanes through their unison ring, scheduled by the EEC with N1.' });
    { const rw = D.GEN.rows.find(r => r.name.startsWith('LPC variable')); const xx = (rw.x_le + rw.x_te) / 2;
      PW.add('lpc-sva', G.revolve([[xx + .006, .392], [xx - .006, .392], [xx - .006, .404], [xx + .006, .404]], { seg: 128 }), 'steel'); can('lpc-sva', xx - .12, 3.6, .44, .025, .2, 'steel'); }
    PW.part('bleed-25', { parent: 'air', label: '2.5 bleed valve', src: 'p.264-267', info: 'Bleed valve on the CIC that dumps LPC exit air into the fan duct through the louvres in the fan exit liner, to keep the LPC out of stall during starts, low power and transients. Scheduled by the EEC.' });
    box('bleed-25', -.98, 4.5, .44, .12, .07, .14, 'steel');
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
        info: 'Air-to-air heat exchanger above the core at 12 o\'clock in the upper bifurcation. Fan air from the precooler duct inlet cools the engine bleed to a temperature the aircraft ducts can take, and leaves through the precooler exhaust door on the right IFS. Its fan air valve is modulated to hold the bleed temperature.' });
      const pcx = -1.90, pcy = .74; { const m = new THREE.Mesh(G.roundedBox(.40, .46, .24, .03)); m.position.set(pcx, pcy, 0); PW.add('precooler', m, 'steel', { solid: true });
        for (let i = 0; i < 9; i++) { const f = new THREE.Mesh(G.roundedBox(.36, .42, .004, .001)); f.position.set(pcx, pcy, -.1 + i * .025); PW.add('precooler', f, 'darkBox', { solid: true, shadow: false }); } }
      line('precooler', [V(-1.05, .99, 0), V(-1.30, .93, 0), V(-1.55, .86, 0), V(pcx + .2, .80, 0)], .07, 'tube', { clamps: 5, ends: false });
      line('precooler', [V(pcx - .2, .74, -.05), V(-2.2, .74, -.15), V(-2.35, .66, -.25)], .05, 'duct', { clamps: 1 }); }
    PW.part('tacc', { parent: 'air', label: 'Turbine active clearance control', src: 'p.270-277',
      info: 'Fan air taken through the scoop on the right IFS at about 1:30 passes the ACC valve and is sprayed onto the HPT and LPT cases from ring manifolds. Shrinking the cases closes the blade tip clearances in cruise, saving fuel; the valve is closed for takeoff and most of the climb.' });
    { for (const xx of [-1.93, -2.0, -2.25, -2.32, -2.39]) { const rr = Math.max(rCase(xx), .24) + .025; PW.add('tacc', G.revolve([[xx + .012, rr - .012], [xx - .012, rr - .012], [xx - .012, rr + .012], [xx + .012, rr + .012]], { seg: 128, crease: 80 }), 'steel'); }
      const xT = D.GEN.externals.lptCaseTorus; PW.add('tacc', G.revolve(circ(xT.x, xT.r_centre, xT.tube_od / 2, 10), { seg: 128 }), 'steel');
      line('tacc', [P(-1.62, 1.5, .55), P(-1.75, 1.6, .42), P(-1.95, 1.7, .32)], .03, 'tube', { clamps: 1 });
      line('tacc', [P(-1.95, 1.7, .32), P(-2.15, 1.6, .42), P(-2.30, 1.5, .50)], .03, 'tube', { clamps: 1 });
      box('tacc', -1.95, 1.7, .33, .1, .07, .09, 'darkBox'); }
    PW.part('cai', { parent: 'air', label: 'Cowl anti-ice duct and valves', src: 'p.10-11; TTM ch. 30; photos',
      info: 'Bleed air for the inlet lip passes two cowl anti-ice valves in series and runs forward along the bottom right of the fan case in a fire-sleeved duct into the inlet at 5 o\'clock. The black hose with orange fittings along the fan case in the photos.' });
    { const p0 = P(-1.1, 4.3, .48), p1 = P(-.9, 4.9, .80), p2 = P(-.55, 5.0, 1.005), p3 = P(.20, 5.0, 1.0), p4 = P(.34, 5.0, 1.03);
      line('cai', [p0, p1, p2, p3, p4], .03, 'black', { clamps: 4 }); for (const p of [p1, p3]) { const m = new THREE.Mesh(G.can(.042, .09)); m.position.copy(p); PW.add('cai', m, 'clampOrange', { solid: true }); } }

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
      info: 'Braided harnesses from the EEC to every sensor, valve and actuator, clipped to the fan case on lime-green stand-offs and run down to the core through the bifurcations. Each EEC channel has its own harness, so a chafed or open harness usually affects one channel only.' });
    /* p.105 / p.107: WF01 and WF02 come down from the pylon interface at 12 o'clock to the EEC; W03 and W04 leave its lower face, run
       down to 6 o'clock, aft along the bottom of the fan case and up into the core at the gearbox; the core harnesses (WC05 round the
       turbine exhaust for the EGT probes, WC08 over the HPC) branch from there */
    { const r = 1.0, arc = (x0, x1, h0, h1, n) => { const pts = []; for (let i = 0; i <= n; i++) { const t = i / n; pts.push(P(x0 + (x1 - x0) * t, h0 + (h1 - h0) * t, r + .012)); } return pts; };
      const runs = [arc(.12, .03, 12, 9.75, 10), arc(.08, -.01, 12, 9.85, 10), arc(-.12, -.32, 8.3, 6.05, 10), arc(-.04, -.40, 8.3, 6.0, 10), arc(.0, -.45, 12, 3.0, 12)];
      for (const pts of runs) { line('harnesses', pts, .014, 'harness', { clamps: 6, tension: .3 });
        for (let i = 1; i < pts.length - 1; i += 2) { const so = new THREE.Mesh(G.roundedBox(.03, .02, .02, .004)); so.position.copy(pts[i]).multiplyScalar(.995); PW.add('harnesses', so, 'lime', { solid: true }); } }
      for (const dz of [-.03, .03]) line('harnesses', [P(-.36, 6.0, r + .012).add(V(0, 0, dz)), P(-.70, 6.0, r + .01).add(V(0, 0, dz)), P(-.92, 6.2, .80), P(-1.15, 6.5, .50), P(-1.35, 6.9, .42)], .016, 'harness', { clamps: 4 });
      for (const [x, h] of [[.12, 12], [.08, 11.85]]) { const c = new THREE.Mesh(G.can(.024, .05)); c.geometry.rotateZ(Math.PI / 2); G.aim(c, P(x, h, 1.035), P(0, h, 1).normalize()); PW.add('harnesses', c, 'connector', { solid: true }); }
      line('harnesses', [P(-1.35, 6.9, .42), P(-1.5, 8.5, .36), P(-1.75, 10.5, .33), P(-2.2, 11.5, .40), P(-2.42, 12.5, .42)], .012, 'harness', { clamps: 4 });
      line('harnesses', [P(-1.2, 7.5, .38), P(-1.25, 9.5, .32), P(-1.4, 11.2, .30), P(-1.7, 12.2, .30)], .012, 'harness', { clamps: 3 }); }
    PW.part('ignition', { label: 'Ignition system', explode: [0, 0, -.35], src: 'p.306-323; TTM ch. 74',
      info: 'Two ignition exciters on the fan case, each feeding one igniter plug in the diffuser case through a shielded lead. The EEC fires one or both; they alternate between starts so a failed system shows up.\n\nThe exciter output is lethal: wait the AMM time after power is removed before disconnecting a lead.' });
    { for (const [h, dx] of [[8.0, 0], [7.3, -.16]]) { box('ignition', -.55 + dx, h, 1.02, .22, .09, .11, 'darkBox'); }
      for (const [h, hh] of [[8.0, 3.6], [7.3, 2.6]]) { const a0 = P(-.62, h, 1.0), a1 = P(-.95, h - .4, .72), a2 = P(-1.45, h - .7, .45), a3 = P(-1.72, hh > 3 ? 8.2 : 7.6, .30);
        line('ignition', [a0, a1, a2, a3], .009, 'tube', { clamps: 3 }); can('ignition', -1.72, hh > 3 ? 8.2 : 7.6, .29, .012, .07, 'steel', { rot: [G.clock(hh > 3 ? 8.2 : 7.6), 0, Math.PI / 2] }); } }
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
      info: 'Hydraulic powerpack on the fan case at about 2 o\'clock and one opening actuator per reverser door. Run from a hand pump or the electric pump, it lifts each door to the hold-open rod position. Never stand under a door that is held only by the actuator: install the hold-open rods.' });
    { box('pdos', -.70, 2.0, 1.04, .24, .1, .14, 'accGrey'); for (const h of [4, 8]) line('pdos', [P(-.80, h, 1.0), P(-1.0, h, 1.05)], .022, 'tube', { clamps: 0 }); }

    /* ============================== FIRE PROTECTION ============================== */
    PW.part('fire', { label: 'Fire and overheat detection', explode: [0, .15, -.2], src: 'p.18-23; TTM ch. 26',
      info: 'Dual-loop detectors in the fan and core compartments, routed on brackets round the cases; either loop alone can give the fire warning. A single discharge nozzle in the core compartment takes agent from either of the two bottles on the wing aft spar.' });
    { for (const [xx, r] of [[-.60, 1.03], [-1.3, .52], [-2.1, .50]]) { const pts = []; for (let i = 0; i <= 20; i++) { const h = 7.5 + 9 * i / 20; pts.push(P(xx + .02 * Math.sin(i), h, r)); }
        line('fire', pts, .006, 'tube', { clamps: 6 }); }
      can('fire', -1.25, 11.5, .52, .02, .06, 'steel'); }

    /* ============================== MOUNTS ============================== */
    PW.part('mounts', { label: 'Engine mounts', explode: [0, .5, 0], src: 'p.44-49; TTM ch. 71',
      info: 'Forward mount at 12 o\'clock on the fan case mount ring; aft mount at 12 o\'clock on the turbine exhaust case. Two thrust links run from the CIC to the aft mount balance beam and carry the thrust into the pylon. Each mount has a fail-safe link that only takes load if a primary link fails.' });
    { const xf = NC.engineForwardMountPlane.x, xa = NC.engineAftMountPlane.x;
      box('mounts', xf, 12, 1.09, .12, .09, .30, 'steel');
      for (const s of [-1, 1]) line('mounts', [V(xf, 1.04, .1 * s), V(xf, 1.12, .2 * s)], .014, 'tube', { clamps: 0 });
      box('mounts', xa, 12, .56, .14, .08, .36, 'steel');
      for (const s of [-1, 1]) { line('mounts', [P(xa, s > 0 ? 1 : 11, .49), V(xa, .56, .14 * s)], .016, 'tube', { clamps: 0 });
        line('mounts', [P(-1.0, s > 0 ? 1.6 : 10.4, .44), P(-1.8, s > 0 ? 1.0 : 11.0, .55), V(xa + .07, .58, .16 * s)], .022, 'tube', { clamps: 0, tension: 0 }); } }   // thrust links

    /* ============================== DRAINS ============================== */
    PW.part('drain-mast', { label: 'Drain lines and drain mast', explode: [0, -.5, 0], src: 'p.50-51',
      info: 'Eight drain lines from the LPC and HPC vane actuators, the 2.5 bleed valve, the IFPC and FOM, the hydraulic pump, the VFG, the oil tank scupper and the starter run to the drain mast, which exits through the latch access door at 6 o\'clock. A drain map placard inside the door identifies each tube, so the source of a leak can be found from which tube drips.' });
    { const xm2 = -1.48; for (let i = 0; i < 8; i++) { const a = (i - 3.5) * .012, src = P(-1.1 - i * .07, 5 + (i % 4) * 1.0, .45);
        line('drain-mast', [src, P(xm2 + .05, 6 + a, .55), P(xm2, 6 + a, .64)], .004, 'tube', { clamps: 1, ends: false }); }
      box('drain-mast', xm2, 6, .66, .06, .05, .06, 'steel'); }
  }
  /* a small circle profile (tori for manifolds) */
  function circ(x, r, rad, n) { const out = []; for (let i = 0; i < n; i++) { const a = i / n * TAU; out.push([x + rad * Math.cos(a), r + rad * Math.sin(a)]); } return out; }
})();
