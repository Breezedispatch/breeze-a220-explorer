/* PW1500G model: the core gas path. Fan rotor and inlet cone, fan case, FEGVs, splitter and fan exit liner, FDGS, LPC, CIC,
   HPC, diffuser and combustor, HPT, TIC, LPT, TEC, core nozzle and plug, shafts and bearings.
   Dimensions come from PW.D.GEN (the p.53 cross-section, calibrated to the 73 in fan), in model metres (+x forward). */
(function () {
  const PW = window.PW, G = window.PWGeo, D = PW.D, IN = .0254, TAU = Math.PI * 2;
  (PW.builders = PW.builders || []).push(build);

  /* spools: true speed ratio fan : N1 : N2 = 3,461 : 10,600 : 24,470 rpm at 100% (FDGS 3.0625:1; p.192). Viewed aft looking forward
     the fan and the N2 rotor turn clockwise and the N1 rotor counter-clockwise (p.63 view B; TTM ch. 71). +rotation.x = clockwise ALF. */
  const SPOOL = { fan: { vis: 1.6, dir: 1 }, n1: { vis: 4.9, dir: -1 }, n2: { vis: 11.3, dir: 1 } };

  /* materials for this module (real finishes from the photos in PHOTOS-LOCAL.md) */
  Object.assign(PW.MAT, {
    fanBladePU:  () => new THREE.MeshPhysicalMaterial({ color: new THREE.Color('#151a22'), roughness: .52, metalness: .12, clearcoat: .15, clearcoatRoughness: .5 }),   // black polyurethane erosion paint (p.58)
    tiSheath:    () => new THREE.MeshStandardMaterial({ color: new THREE.Color('#b9c2bb'), roughness: .42, metalness: .55 }),   // matte sage-grey titanium sheath (photos)
    coneGrey:    () => new THREE.MeshPhysicalMaterial({ color: new THREE.Color('#33363a'), roughness: .58, metalness: .05, clearcoat: .12, clearcoatRoughness: .5 }),
    fanCaseOlive:() => new THREE.MeshStandardMaterial({ color: new THREE.Color('#5f5f45'), roughness: .62, metalness: .08 }),
    rubTeal:     () => new THREE.MeshStandardMaterial({ color: new THREE.Color('#6fae98'), roughness: .7, metalness: .05 }),
    linerDark:   () => new THREE.MeshStandardMaterial({ color: new THREE.Color('#25282b'), roughness: .62, metalness: .2 }),
    fegvDark:    () => new THREE.MeshStandardMaterial({ color: new THREE.Color('#1d222a'), roughness: .45, metalness: .35 }),
    mint:        () => new THREE.MeshStandardMaterial({ color: new THREE.Color('#9fd3bb'), roughness: .55, metalness: .05 }),
    lime:        () => new THREE.MeshStandardMaterial({ color: new THREE.Color('#a4c64a'), roughness: .55, metalness: .05 }),
    hotNozzle:   () => new THREE.MeshStandardMaterial({ color: new THREE.Color('#a39274'), roughness: .38, metalness: .9 }),
    plugDark:    () => new THREE.MeshStandardMaterial({ color: new THREE.Color('#6d655b'), roughness: .42, metalness: .85 }),
  });

  /* ---------------- helpers ---------------- */
  const L = () => D.GEN.lines;
  const seg = (name, xf, xa, n) => { const a = L()[name]; if (!a) return []; const out = []; n = n || 24;
    for (let i = 0; i <= n; i++) { const x = xf + (xa - xf) * i / n; out.push([x, G.interp(a, x)]); } return out; };      // samples forward to aft
  const rAt = (name, x) => G.interp(L()[name], x);
  const rowBy = re => D.GEN.rows.filter(r => re.test(r.name));
  const deg = d => d * Math.PI / 180;

  /* a blade row from a row record: blades instanced round the ring. Stagger and camber are set per kind; counts not published are
     estimated from the row's radius and chord at a typical solidity and flagged as representative */
  /* o.role: 'rotor' | 'stator' | 'ngv' (turbine vane) | 'tblade' (turbine blade); o.s: turning direction of the spool doing the work
     (+1 clockwise ALF). Compressor rotors lean their trailing edge against the rotation and stators with it; turbine vanes throw the gas
     with the rotation and turbine blades turn it back, both with camber the other way round. Magnitudes in o.gHub / o.gTip (deg). */
  function bladeRow(id, row, o) {
    o = o || {};
    const s = o.s || 1, role = o.role || 'rotor';
    o.dir = role === 'rotor' || role === 'tblade' ? -s : s;
    if (role === 'ngv' || role === 'tblade') { o.camHub = -(o.camHub || .05); o.camTip = -(o.camTip || .03); }
    const ax = Math.max(.004, row.x_le - row.x_te);
    /* the four measured corners give each section its own leading and trailing edge (sweep and lean in side view) */
    const hasC = row.x_le_hub !== undefined && row.x_le_tip !== undefined && row.x_te_hub !== undefined && row.x_te_tip !== undefined;
    const xl = t => (hasC ? row.x_le_hub + (row.x_le_tip - row.x_le_hub) * t : row.x_le), xt = t => (hasC ? row.x_te_hub + (row.x_te_tip - row.x_te_hub) * t : row.x_te);
    const rh = (row.r_hub_le + row.r_hub_te) / 2 + (o.hubIn || 0), rt = (row.r_tip_le + row.r_tip_te) / 2 - (o.tipGap === undefined ? .0008 : o.tipGap);
    const gh = deg(o.gHub), gt = deg(o.gTip), n = o.span || 6, secs = [];
    for (let k = 0; k <= n; k++) { const t = k / n, g = gh + (gt - gh) * t, r = rh + (rt - rh) * t, axk = Math.max(.004, xl(t) - xt(t));
      secs.push({ r, xle: xl(t), chord: axk / Math.max(.2, Math.cos(g)), stagger: g, camber: (o.camHub || .05) + ((o.camTip || .03) - (o.camHub || .05)) * t,
        thick: (o.tHub || .08) + ((o.tTip || .05) - (o.tHub || .08)) * t, lean: (o.lean || 0) * t * t }); }
    const geo = G.blade(secs, { chordPts: o.cp || 10, dir: o.dir || 1 });
    const gm = (gh + gt) / 2, cMid = ax / Math.max(.2, Math.cos(gm)), rm = (rh + rt) / 2;
    const count = o.count || Math.max(8, Math.round(TAU * rm * (o.sigma || 1.3) / cMid));
    const im = G.ringInstances(geo, PW.partMat(id, o.mat || 'titanium', o.matOver), count, { phase: o.phase || 0 });
    PW.add(id, im, null, { solid: true });
    return { count, rh, rt };
  }
  /* a rotor disc under a blade row: rim, web and bore, as one closed revolved section */
  function disk(id, xf, xa, rRim, rBore, o) {
    o = o || {}; const w = xf - xa, xc = (xf + xa) / 2, rim = o.rim || Math.min(.02, (rRim - rBore) * .2), web = o.web || Math.max(.006, w * .28),
      bw = o.bore || Math.max(.012, w * .7), bh = o.boreH || Math.min(.03, (rRim - rBore) * .22), f = Math.min(.01, (rRim - rBore) * .06);
    const p = [[xf, rRim], [xa, rRim], [xa, rRim - rim], [xc - web / 2 - f, rRim - rim], [xc - web / 2, rRim - rim - f], [xc - web / 2, rBore + bh + f],
      [xc - bw / 2, rBore + bh], [xc - bw / 2, rBore], [xc + bw / 2, rBore], [xc + bw / 2, rBore + bh], [xc + web / 2, rBore + bh + f],
      [xc + web / 2, rRim - rim - f], [xc + web / 2 + f, rRim - rim], [xf, rRim - rim]];
    return PW.add(id, G.revolve(p, { seg: o.seg || 96, crease: 40 }), o.mat || 'titanium', { mat: o.matOver });
  }
  /* a case wall along a line: inner surface on the line, thickness t outward (or inward with t < 0) */
  function wall(id, line, xf, xa, t, mat, o) {
    o = o || {}; const inner = seg(line, xf, xa, o.n || 24), outer = inner.map(([x, r]) => [x, r + t]);
    const prof = t > 0 ? G.shellProfile(outer, inner) : G.shellProfile(inner, outer);
    return PW.add(id, G.revolve(prof, { seg: o.seg || 128, crease: 28 }), mat, { mat: o.matOver });
  }
  /* a bolted flange ring with its bolt circle */
  function flange(id, x, r0, r1, w, n, mat) {
    PW.add(id, G.ring(x + w / 2, x - w / 2, r0, r1, { seg: 128 }), mat || 'nickel');
    if (n) PW.add(id, G.boltCircle(PW.partMat(id, 'steel'), x + w / 2 + .002, (r0 + r1) / 2 + (r1 - r0) * .2, n, .0045), null);
  }
  /* a stator ring: vanes plus inner and outer bands */
  function statorRow(id, row, o) {
    const r = bladeRow(id, row, Object.assign({ tipGap: 0, hubIn: 0 }, o));
    if (o.bands !== false) {
      const xf = row.x_le + .002, xa = row.x_te - .002;
      PW.add(id, G.ring(xf, xa, r.rh - .004, r.rh + .0005, { seg: 96 }), o.bandMat || o.mat || 'nickel');
      if (o.outerBand !== false) PW.add(id, G.ring(xf, xa, r.rt - .0005, r.rt + .004, { seg: 96 }), o.bandMat || o.mat || 'nickel');
    }
    return r;
  }

  function build() {
    if (!D.GEN) return;
    const SP = {}; for (const k in SPOOL) SP[k] = PW.spool(k, SPOOL[k]);
    const R = name => rowBy(new RegExp(name))[0];

    /* =========================== FAN ROTOR =========================== */
    PW.part('fan-rotor', { label: 'Fan rotor', attach: SP.fan, explode: [1.6, 0, 0], src: 'Delta CH 70-80 p.52-59; TTM ch. 72',
      info: 'Single-stage fan of 18 hollow aluminium wide-chord blades on a titanium hub, driven by the fan drive gear system at about a third of LP turbine speed. It turns clockwise seen from behind.\n\nThe fan moves most of the engine\'s air and gives most of its thrust. Blades are numbered from the No. 1 slot, marked "1" on the hub lands either side, counting in the direction of rotation.' });
    /* inlet cone: composite, a shell ahead of the hub (p.58-59). Dark grey with the single white teardrop P&W paints so the ground crew can see the fan turn */
    PW.part('inlet-cone', { parent: 'fan-rotor', label: 'Inlet cone (spinner)', src: 'p.58-59; photos',
      info: 'Composite cone bolted to the fan hub\'s inlet cone flange. It smooths the air into the fan root. The cover in its nose gives access to the cone retaining hardware.\n\nThe white teardrop is painted so a turning fan is easy to see on the ramp. Check the cone for erosion, cracks and missing fasteners on the walkaround.' });
    {
      const sp = L().spinner, xEnd = .006;                                     // the cone runs from the nose to just ahead of the blade root
      const outer = sp.filter(p => p[0] >= xEnd).sort((a, b) => b[0] - a[0]);
      const inner = outer.filter(p => p[1] > .03).map(([x, r]) => [x - .004, Math.max(0, r - .007)]);
      const prof = outer.concat(inner.reverse()); prof.unshift([outer[0][0], 0]);
      const g = G.revolve(prof, { seg: 96, crease: 50 });
      const cone = PW.add('inlet-cone', g, 'coneGrey', { mat: { map: coneTexture(outer), color: '#ffffff' } });
      cone.userData.solid = true;
      /* six fasteners round the cone, as in the front photos */
      const ring = outer.find(p => p[1] > .085) || outer[3];
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + .3, b = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, .004, 10));
        G.aim(b, G.onRing(ring[0] + .001, ring[1] + .001, a), new THREE.Vector3(.5, Math.cos(a), Math.sin(a)).normalize()); PW.add('inlet-cone', b, 'steel', { solid: true }); }
    }
    /* fan blades: from the measured leading and trailing edge curves (p.53), hub to tip */
    PW.part('fan-blades', { parent: 'fan-rotor', label: 'Fan blades (18)', src: 'p.53, p.58-59; photos',
      info: 'Eighteen hollow aluminium blades with a titanium leading edge and black polyurethane erosion paint. Each dovetail root slides into a hub slot with a spacer under it and composite wear strips on its sides.\n\nInspect for leading-edge nicks, dents and erosion against the AMM limits, and for paint loss. A bird strike or FOD finding here usually leads to a borescope of the core.' });
    PW.part('fan-hub', { parent: 'fan-rotor', label: 'Fan hub, fairings and lock ring', src: 'p.58-59',
      info: 'The hub carries the 18 blades in dovetail slots. Composite fairings between the blades form the inner flow path, each held by a pin through lugs on the hub. A front lock ring holds the blades axially.\n\nTrim balance weights bolt to the hub front flange; the OMS gives the balance solution after a vibration survey.' });
    {
      const le = L().fanLE.map(([x, r]) => [r, x]), te = L().fanTE.map(([x, r]) => [r, x]);   // tables r -> x
      const rh = .286, rt = .925, n = 12, secs = [], sheath = [];
      for (let k = 0; k <= n; k++) { const t = k / n, r = rh + (rt - rh) * Math.pow(t, .9);
        const xl = G.interp(le, r), xt = G.interp(te, r), ax = Math.max(.12, xl - xt);
        const g = deg(26 + 34 * Math.pow(t, .85));                             // stagger from the axis: about 26 deg at the root to 60 deg at the tip
        const s = { r, xle: xl, chord: ax / Math.cos(g), stagger: g, camber: .075 - .05 * t, thick: .11 - .08 * t, lean: -.10 * t * t };
        secs.push(s); sheath.push(Object.assign({}, s)); }
      const blade = G.blade(secs, { chordPts: 16, dir: -1 }), lead = G.blade(sheath, { chordPts: 6, dir: -1, uMax: .045, inflate: 1.18 });
      PW.add('fan-blades', G.ringInstances(blade, PW.partMat('fan-blades', 'fanBladePU'), 18), null);
      PW.add('fan-blades', G.ringInstances(lead, PW.partMat('fan-blades', 'tiSheath'), 18), null);
      /* hub: fairing ring under the blades (flow path), the disc with its dovetail rim, and the drum aft to the fan shaft */
      const fl = (L().fanPlatform || []).slice().sort((a, b) => b[0] - a[0]);
      PW.add('fan-hub', G.revolve(G.shellProfile(fl, fl.map(([x, r]) => [x, r - .012])), { seg: 128 }), 'composite', { mat: { color: '#2b2f33' } });
      disk('fan-hub', .0, -.235, .262, .115, { rim: .05, web: .05, bore: .14, boreH: .03, mat: 'titanium' });
      PW.add('fan-hub', G.ring(-.235, -.40, .30, .315, { seg: 96 }), 'titanium');            // aft drum to the FDGS output
      PW.add('fan-hub', G.frustum(-.38, -.42, .31, .16, .02, { seg: 96 }), 'titanium');      // cone down to the fan shaft
      PW.add('fan-hub', G.boltCircle(PW.partMat('fan-hub', 'steel'), .004, .245, 36, .004), null);   // trim balance weight flange holes
    }

    /* =========================== FAN CASE =========================== */
    PW.part('fan-case', { label: 'Fan case', explode: [.5, 0, 0], src: 'p.60-61; photos',
      info: 'One-piece composite case with a Kevlar containment wrap, carrying the inlet at flange A and the titanium mount ring at its aft end. Inside are the forward acoustic panels, the fan blade rub strip, the ice liners and the rear acoustic liner segments.\n\nThe rub strip is abradable: blades cut into it as they stretch under power, which keeps the tip clearance tight. It can be refurbished after heavy rubbing.' });
    {
      const co = L().fanCaseOuter, skin = L().fanCaseInnerSkin;
      const FL = D.GEN.flanges, fA = FL.find(f => /^A /.test(f.name)), fD = FL.find(f => /^D /.test(f.name));
      const xA = fA.x, xD = fD.x;                                               // flange A (inlet cowl attach) and flange D (mount ring V-groove)
      /* the structural shell: the case's outer surface outside, its inner skin inside (the liners fill between the skin and the flow path) */
      const outer = seg('fanCaseOuter', xA - .006, xD + .012, 48), inner = seg('fanCaseInnerSkin', xA - .006, xD + .012, 48).map(([x, r], i) => [x, Math.min(r, outer[i][1] - .008)]);
      PW.part('fan-case-shell', { parent: 'fan-case', label: 'Fan case shell (composite)', src: 'p.60',
        info: 'One-piece composite shell, olive drab on the outside. It is the structural link between the inlet cowl and the core, and it contains a released blade. Harness runs, brackets and the EEC are mounted on its outside.' });
      PW.add('fan-case-shell', G.revolve(G.shellProfile(outer, inner), { seg: 160 }), 'fanCaseOlive');
      flange('fan-case-shell', xA - .004, fA.r_in, fA.r_out, .008, 72, 'lime');           // flange A: the inlet cowl bolts here
      /* faint tape seams on the composite, as in the photo from below (circumferential bands and a few axial lines) */
      for (const x of [.21, .02, -.17, -.36, -.55]) PW.add('fan-case-shell', G.ring(x + .007, x - .007, G.interp(co, x) - .001, G.interp(co, x) + .0012, { seg: 160 }), 'fanCaseOlive', { mat: { color: '#6e6c51' }, shadow: false });
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + .2, sm = seg('fanCaseOuter', xA - .02, -.62, 12).map(([x, r]) => G.onRing(x, r + .0008, a));
        PW.add('fan-case-shell', G.tube(sm, .0035, { radial: 6 }), 'fanCaseOlive', { mat: { color: '#6e6c51' }, shadow: false }); }
      /* liners on the flow path, front to rear (p.60; zones measured on p.53), each between the flow path and the inner skin */
      const LZ = D.GEN.linerZones;
      const liner = (pid, label, info, xf, xa, mat) => { PW.part(pid, { parent: 'fan-case', label, info, src: 'p.53, p.60-61' });
        const a = seg('fanCaseInner', xf, xa, 16), b = a.map(([x, r]) => [x, Math.max(r + .006, G.interp(skin, x) - .001)]);
        PW.add(pid, G.revolve(G.shellProfile(b, a), { seg: 160 }), mat); };
      liner('fan-acoustic-fwd', 'Forward acoustic panels', 'Perforated acoustic panels ahead of the fan blades that absorb fan noise. Check for delamination, dents and blocked perforations.', LZ.frontAcousticPanels.x_from - .006, LZ.frontAcousticPanels.x_to, 'linerDark');
      liner('fan-ice-liner', 'Ice liners', 'Replaceable liners just aft of the fan that protect the case from ice shed by the blades.', LZ.iceLiner.x_from, LZ.iceLiner.x_to, 'linerDark');
      liner('fan-rear-liner', 'Rear acoustic liner segments', 'Acoustic liner segments between the fan and the exit guide vanes.', LZ.rearAcousticLiner.x_from, LZ.rearAcousticLiner.x_to, 'linerDark');
      /* the rub strip: its measured outline is a closed wedge over the blade tips (p.53), the pale teal band in the front photos */
      PW.part('fan-rub-strip', { parent: 'fan-case', label: 'Fan blade rub strip', src: 'p.53, p.60; photos',
        info: 'Abradable liner over the blade tips, the pale green band you see round the fan from the front. The blades rub into it as they lengthen under centrifugal load, holding a tight tip clearance. Heavy rubbing is repaired by refurbishing the strip.' });
      PW.add('fan-rub-strip', G.revolve(L().rubStrip, { seg: 160, crease: 25 }), 'rubTeal');
      /* titanium mount ring with the thrust reverser V-groove (flange D), and the forward mount lugs at 12 o'clock */
      PW.part('mount-ring', { parent: 'fan-case', label: 'Titanium mount ring and V-groove (flange D)', src: 'p.60-61; TTM ch. 72',
        info: 'Titanium ring round the aft end of the fan case. It carries the forward engine mount lugs at 12 o\'clock, and its V-groove takes the V-blade on each thrust reverser door, which aligns and supports the doors when they are closed and latched.' });
      const rM = G.interp(co, -.72);
      PW.add('mount-ring', G.revolve([[-.66, rM - .004], [-.66, rM + .016], [xD + .03, rM + .016], [xD + .018, rM + .004], [xD + .006, rM + .022], [xD - .006, rM + .022], [xD - .006, rM - .004]], { seg: 160, crease: 30 }), 'titanium');
      const ml = D.GEN.externals.forwardMountLugs12oclock;
      for (const dz of [-.06, .06]) { const lug = new THREE.Mesh(G.roundedBox(ml.x_from - ml.x_to + .02, ml.r_top - ml.r_base + .02, .035, .008));
        lug.position.set((ml.x_from + ml.x_to) / 2, (ml.r_top + ml.r_base) / 2, dz); PW.add('mount-ring', lug, 'titanium', { solid: true }); }
      /* precooler duct inlet: four-piece titanium casting at 12 o'clock behind the FEGVs, taking fan air up into the pylon precooler (p.60) */
      PW.part('precooler-inlet', { parent: 'fan-case', label: 'Precooler duct inlet', src: 'p.60-61; p.53',
        info: 'Four-piece titanium casting at the top of the fan case, behind the exit guide vanes. It takes fan air into the precooler in the pylon and gives the seal lands for the thrust reverser door fire seals at the upper bifurcation.' });
      const pc = D.GEN.externals.precoolerDuctInletBox12oclock;
      /* p.45 shows it as an inverted U of duct rising from the FIC to the fan case top at 12 o'clock */
      { const xf = pc.x_from - .02, xa = pc.x_to + .03, rb = pc.r_in + .02, rt = pc.r_out - .03;
        PW.add('precooler-inlet', G.tube([[xf, rb, 0], [xf, rt - .08, 0], [xf - .03, rt, 0], [xa + .03, rt, 0], [xa, rt - .08, 0], [xa, rb, 0]], .042, { radial: 14, tension: .15 }), 'titanium');
        PW.add('precooler-inlet', G.tube([[(xf + xa) / 2, rt, 0], [(xf + xa) / 2, pc.r_out + .06, 0]], .05, { radial: 14 }), 'titanium'); }
      /* fan exit guide vanes: 44, swept, hollow aluminium with a dark polyurethane coat (p.60; photos), from the measured hub and tip corners */
      PW.part('fegv', { parent: 'fan-case', label: 'Fan exit guide vanes (44)', src: 'p.60-61, p.53; photos',
        info: '44 hollow aluminium vanes behind the fan that take the swirl out of the fan air and carry structural load between the fan intermediate case and the fan case. Polyurethane coated against erosion.\n\nInspect from the bypass exit with the reversers open: look for FOD damage, coating loss and cracks at the platforms.' });
      bladeRow('fegv', R('FEGV'), { role: 'stator', s: 1, count: 44, gHub: 18, gTip: 12, camHub: .08, camTip: .06, tHub: .08, tTip: .07, tipGap: 0, span: 8, mat: 'fegvDark' });
    }

    /* =========================== FAN INTERMEDIATE CASE AND SPLITTER =========================== */
    PW.part('fic', { label: 'Fan intermediate case (FIC)', explode: [.25, 0, 0], src: 'p.53-55, p.60; TTM ch. 72',
      info: 'Structural case behind the fan. Its splitter divides fan air into the bypass and core streams, the FEGV inner ends attach to it, and it carries the No. 1, 1.5 and 2 bearing supports and the FDGS torque frame.\n\nThe six fan exit liner segments on its outer wall have louvres where 2.5 bleed air leaves into the fan stream; each segment comes off on its own for access to the lines behind it.' });
    {
      const bi = L().bypassInner;
      const xs = bi[0][0];                                                     // splitter lip
      /* splitter: a solid nose that opens into the bypass liner (outside) and the core casing (inside) */
      const outerS = seg('bypassInner', xs, xs - .05, 6), innerS = seg('coreCase', xs + .01, xs - .05, 6);
      PW.add('fic', G.revolve(outerS.concat(innerS.reverse()), { seg: 128, crease: 40 }), 'titanium');
      PW.part('fan-exit-liner', { parent: 'fic', label: 'Fan exit liner segments (6)', src: 'p.60-61; photos',
        info: 'Six removable panels forming the inner wall of the bypass duct behind the FEGVs. Louvres in them let 2.5 bleed air out into the fan stream. Painted pale green on this engine.' });
      const xe = bi[bi.length - 1][0];
      for (let i = 0; i < 6; i++) { const a = seg('bypassInner', xs - .05, xe, 20);
        PW.add('fan-exit-liner', G.revolve(G.shellProfile(a, a.map(([x, r]) => [x, r - .008])), { seg: 24, thetaStart: i / 6 * TAU + .004, thetaLength: TAU / 6 - .008 }), 'mint'); }
      /* louvred grilles: 2.5 bleed exits (two per side, p.61; photos) */
      for (const c of [2.2, 3.8, 8.2, 9.8]) { const a = G.clock(c), xg = -.79, rg = rAt('bypassInner', xg) + .002;
        for (let k = 0; k < 7; k++) { const sl = new THREE.Mesh(G.roundedBox(.11, .004, .012, .0015));
          sl.position.copy(G.onRing(xg, rg, a + (k - 3) * .022)); sl.rotation.x = a + (k - 3) * .022; sl.rotateZ(.35); PW.add('fan-exit-liner', sl, 'darkBox', { solid: true }); } }
      /* the core casing behind the splitter, to the LPC */
      wall('fic', 'coreCase', xs + .005, -.50, .012, 'nickel', { n: 12 });
      /* core inlet struts and the second strut row (p.53) */
      for (const re of ['FIC core-inlet strut', 'FIC strut']) { const r = R(re); if (r) statorRow('fic', Object.assign({}, r, { x_le: r.x_le + .004, x_te: r.x_te - .012 }), { count: 12, gHub: 0, gTip: 0, camHub: 0, camTip: 0, tHub: .16, tTip: .16, mat: 'titanium', bands: false }); }
    }

    /* =========================== FAN DRIVE GEAR SYSTEM =========================== */
    buildFDGS(SP);

    /* =========================== LPC (N1) =========================== */
    PW.part('lpc', { label: 'Low-pressure compressor (LPC)', explode: [-.1, 0, 0], src: 'p.52-55; TTM ch. 72',
      info: 'Three-stage booster on the N1 spool, with variable inlet guide vanes set by the EEC. Its rotors are integrally bladed (blades and disc in one piece), so blade damage is blended in place or the whole rotor is replaced.\n\nN1, the primary thrust parameter, is the LPC speed: 100% is 10,600 rpm.' });
    {
      const igv = R('LPC variable inlet guide vane');
      PW.part('lpc-igv', { parent: 'lpc', label: 'LPC variable inlet guide vanes', src: 'p.52, p.258-261',
        info: 'Variable vanes at the LPC inlet, turned together by a unison ring and a fuel-powered actuator on EEC command. Closed at low power, opening with N1. Vane count is representative.' });
      statorRow('lpc-igv', igv, { role: 'stator', s: -1, gHub: 6, gTip: 10, camHub: .04, camTip: .03, tHub: .1, tTip: .08, mat: 'titanium', sigma: .9 });
      for (let i = 1; i <= 3; i++) {
        const rr = R(`LPC rotor ${i}`), pid = `lpc-rotor-${i}`;
        PW.part(pid, { parent: 'lpc', label: `LPC stage ${i} rotor (IBR)`, attach: SP.n1, src: 'p.53, p.55',
          info: `Stage ${i} integrally bladed rotor of the low-pressure compressor, on the N1 spool. Blade count is representative; the manual does not give it.` });
        bladeRow(pid, rr, { role: 'rotor', s: -1, gHub: 40, gTip: 55, camHub: .07, camTip: .04, tHub: .08, tTip: .045, mat: 'titanium' });
        const rh = (rr.r_hub_le + rr.r_hub_te) / 2;
        disk(pid, rr.x_le + .004, rr.x_te - .004, rh, .045, { mat: 'titanium' });
        const st = R(i < 3 ? `LPC stator ${i}` : 'LPC exit guide vane');
        if (st) { const sid = i < 3 ? `lpc-stator-${i}` : 'lpc-egv';
          PW.part(sid, { parent: 'lpc', label: i < 3 ? `LPC stage ${i} stator` : 'LPC exit guide vanes', src: 'p.53', info: 'Fixed vane row that turns the rotor\'s swirl into pressure before the next stage. Count is representative.' });
          statorRow(sid, st, { role: 'stator', s: -1, gHub: 30, gTip: 34, camHub: .08, camTip: .07, tHub: .08, tTip: .07, mat: 'steel' }); }
      }
      /* LP drum joining the three IBRs */
      const r1 = R('LPC rotor 1'), r3 = R('LPC rotor 3');
      PW.add('lpc-rotor-2', G.ring(r1.x_te, r3.x_le, .225, .232, { seg: 96 }), 'titanium');
      PW.part('lpc-case', { parent: 'lpc', label: 'LPC case', src: 'p.53', info: 'Split case round the booster carrying its stator rows and the variable vane actuation.' });
      wall('lpc-case', 'coreCase', -.50, -.90, .014, 'nickel', { n: 20 });
    }

    /* =========================== CIC =========================== */
    PW.part('cic', { label: 'Compressor intermediate case (CIC)', explode: [-.35, 0, 0], src: 'p.53-55, p.112; TTM ch. 72',
      info: 'Structural case between the LPC and HPC. The gooseneck duct through it carries LPC air down to the HPC inlet; the No. 3 bearing sits under it and the angle gearbox towershaft passes through one of its struts. The 2.5 bleed valve dumps LPC exit air from here into the fan stream during starts and transients.\n\nThe N1 speed probe is at station 2.5 at the rear of the CIC, about 4:30.' });
    {
      wall('cic', 'coreCase', -.90, -1.17, .012, 'nickel', { n: 16 });
      wall('cic', 'coreHub', -.88, -1.17, -.012, 'nickel', { n: 16 });
      /* the CIC's outer wall: a conical disc from the bypass inner wall down to the HPC case (p.55 render) */
      PW.add('cic', G.revolve([[-.95, .515], [-1.16, .262], [-1.17, .262], [-1.17, .245], [-1.155, .245], [-.94, .50]], { seg: 128 }), 'nickel');
      for (const re of ['LPC exit guide vane', 'CIC strut', 'CIC rear vane']) { const r = R(re); if (r && !/exit guide/.test(re)) statorRow('cic', r, { role: 'stator', s: 1, count: re === 'CIC strut' ? 10 : 0, gHub: re === 'CIC strut' ? 0 : 20, gTip: re === 'CIC strut' ? 0 : 24, camHub: re === 'CIC strut' ? 0 : .08, camTip: .06, tHub: re === 'CIC strut' ? .25 : .1, tTip: re === 'CIC strut' ? .25 : .08, mat: 'nickel', bands: re !== 'CIC strut' }); }
    }

    /* =========================== HPC (N2) =========================== */
    PW.part('hpc', { label: 'High-pressure compressor (HPC)', explode: [-.8, 0, 0], src: 'p.52-55, p.258-263; TTM ch. 72',
      info: 'Eight-stage compressor on the N2 spool. Stages 1 to 7 are integrally bladed rotors and stage 8 is a bladed disc. The inlet guide vanes and the first three stator rows are variable, moved by a fuel-powered actuator on EEC command.\n\n4th-stage air is the normal bleed source; 8th-stage air is added through the high-pressure valve when 4th-stage pressure is low. Borescope ports on the case give access to every stage. 100% N2 is 24,470 rpm.' });
    {
      const igv = R('HPC variable inlet guide vane');
      PW.part('hpc-igv', { parent: 'hpc', label: 'HPC variable inlet guide vanes', src: 'p.52, p.258-261', info: 'Variable inlet guide vanes of the HPC, scheduled by the EEC with N2. Count representative.' });
      statorRow('hpc-igv', igv, { role: 'stator', s: 1, gHub: 10, gTip: 14, camHub: .05, camTip: .04, mat: 'steel', sigma: 1.1 });
      for (let i = 1; i <= 8; i++) {
        const rr = R(`HPC rotor ${i}`), pid = `hpc-rotor-${i}`;
        PW.part(pid, { parent: 'hpc', label: `HPC stage ${i} rotor${i < 8 ? ' (IBR)' : ''}`, attach: SP.n2, src: 'p.53, p.55',
          info: i < 8 ? `Stage ${i} integrally bladed rotor of the HPC on the N2 spool. Blade count is representative.` : 'Stage 8 is a conventional bladed disc, the only HPC stage with removable blades. Blade count is representative.' });
        bladeRow(pid, rr, { role: 'rotor', s: 1, gHub: 38, gTip: 48, camHub: .06, camTip: .04, tHub: .07, tTip: .045, mat: i <= 4 ? 'titanium' : 'nickel', sigma: 1.5 });
        const rh = (rr.r_hub_le + rr.r_hub_te) / 2;
        disk(pid, rr.x_le + .003, rr.x_te - .003, rh, .045 + .004 * i, { mat: i <= 4 ? 'titanium' : 'nickel' });
        const st = R(`HPC stator ${i}$`) || R(`HPC stator ${i} `);
        if (st) { const sid = `hpc-stator-${i}`;
          PW.part(sid, { parent: 'hpc', label: `HPC stage ${i} stator${i <= 3 ? ' (variable)' : ''}`, src: 'p.53, p.258-261',
            info: i <= 3 ? `Variable stator row ${i}: each vane turns on a trunnion through the case, driven by a lever on a unison ring.` : `Fixed stator row ${i} of the HPC.` });
          statorRow(sid, st, { role: 'stator', s: 1, gHub: 32, gTip: 36, camHub: .08, camTip: .07, tHub: .08, tTip: .07, mat: 'nickel', sigma: 1.5 }); }
      }
      const eg = R('HPC exit guide vane'); if (eg) { PW.part('hpc-egv', { parent: 'hpc', label: 'HPC exit guide vanes', src: 'p.53', info: 'Final vane row that straightens the air into the diffuser. Count representative.' });
        statorRow('hpc-egv', eg, { role: 'stator', s: 1, gHub: 2, gTip: 2, camHub: .03, camTip: .03, mat: 'nickel', count: 120 }); }
      /* N2 drum: spacer arms between the disc rims */
      const r1 = R('HPC rotor 1'), r8 = R('HPC rotor 8');
      PW.add('hpc-rotor-4', G.revolve(seg('coreHub', r1.x_te, r8.x_le, 30).map(([x, r]) => [x, r - .022]).concat(seg('coreHub', r1.x_te, r8.x_le, 30).map(([x, r]) => [x, r - .028]).reverse()), { seg: 96 }), 'nickel');
      /* the HPC case: inner flow-path shroud and the outer structural case with flanges E (front) and H (rear) */
      PW.part('hpc-case', { parent: 'hpc', label: 'HPC case', src: 'p.53, p.55, p.258-261',
        info: 'Double-walled case: an inner flow-path shroud carrying the stator rows and an outer structural case between flanges E and H. The variable vane unison rings and the 4th and 8th-stage bleed ports are on the outside.' });
      wall('hpc-case', 'coreCase', -1.16, -1.66, .006, 'nickel', { n: 30 });
      PW.add('hpc-case', G.revolve(G.shellProfile(seg('outer', -1.165, -1.66, 30).map(([x, r]) => [x, Math.max(r, rAt('coreCase', x) + .02)]), seg('outer', -1.165, -1.66, 30).map(([x, r]) => [x, Math.max(r, rAt('coreCase', x) + .02) - .006])), { seg: 128 }), 'nickel');
    }

    /* =========================== DIFFUSER AND COMBUSTOR =========================== */
    buildCombustor();
    /* =========================== TURBINES =========================== */
    buildTurbines(SP);
    /* =========================== EXHAUST =========================== */
    buildExhaust();
    /* =========================== SHAFTS AND BEARINGS =========================== */
    buildShafts(SP);
    const owner = n => /^D /.test(n) || /^A /.test(n) ? null : /aft step/.test(n) ? 'fic' : /LPC case rear/.test(n) ? 'lpc-case' : /CIC front/.test(n) ? 'cic' : /^E /.test(n) || /^H /.test(n) ? 'hpc-case'
      : /^M /.test(n) ? 'diffuser-case' : /HPT case rear/.test(n) ? 'hpt-case' : /^N /.test(n) ? 'tic' : /^N1 /.test(n) || /^P /.test(n) ? 'lpt-case' : /^T[oi] /.test(n) ? 'exhaust' : null;
    for (const f of D.GEN.flanges) { const pid = owner(f.name); if (!pid || !PW.parts.has(pid)) continue;
      const hot = /hpt|tic|lpt|exhaust|diffuser/.test(pid), n = Math.max(24, Math.round(TAU * f.r_out / .045 / 4) * 4);
      flange(pid, f.x, f.r_in, f.r_out, .009, /^Ti /.test(f.name) ? 0 : n, hot ? 'hotCase' : 'nickel'); }
    PW.CENTER_X = -1.1;
  }

  /* ---- the cone's paint: dark grey with one white teardrop, drawn in the cone's own (angle, length) coordinates so it is not stretched ---- */
  function coneTexture(prof) {
    const W = 1024, H = 512, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
    if (!c || !c.fillRect) return null;
    /* uv.v is the surface length from the nose in metres (texture row = 1 - v). Matte dark grey, with the slightly lighter inlet cone
       cover in the nose (out to about 0.11 m along the surface). The white teardrop sits on the cover: round end at the centre, point
       outward, at angle 0 (12 o'clock with the fan at rest). That is how it is painted on the A220s in Brian's photos; on some
       operators' engines the drop is the other way round. */
    c.fillStyle = '#34373b'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#44484c'; c.fillRect(0, H * (1 - .11), W, H * .11);
    c.fillStyle = '#26282b'; c.fillRect(0, H * (1 - .113), W, 2);                    // the cover's edge
    const acc = [0]; for (let i = 1; i < prof.length; i++) acc.push(acc[i - 1] + Math.hypot(prof[i][0] - prof[i - 1][0], prof[i][1] - prof[i - 1][1]));
    c.fillStyle = '#eef0f2';
    for (let y = 0; y < H; y++) { const s = 1 - (y + .5) / H; let r = .05; for (let i = 1; i < acc.length; i++) if (acc[i] >= s) { r = prof[i][1]; break; }
      const f = (s - .018) / .085; if (f < 0 || f > 1) continue;
      const f0 = .3, Rm = .015, halfW = f < f0 ? Rm * Math.sqrt(Math.max(0, 1 - Math.pow((f0 - f) / f0, 2))) : Rm * Math.pow(1 - (f - f0) / (1 - f0), 1.15);
      const du = Math.min(W / 2, halfW / (TAU * Math.max(.012, r)) * W);
      c.fillRect(0, y, du, 1); c.fillRect(W - du, y, du, 1); }
    const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; return t;
  }

  /* ---- FDGS: sun on the LP shaft, five star gears on a fixed carrier, ring gear driving the fan; herringbone teeth (p.62-65) ---- */
  function buildFDGS(SP) {
    PW.part('fdgs', { label: 'Fan drive gear system (FDGS)', explode: [.95, -.0, 0], src: 'p.62-65; TTM ch. 72',
      info: 'Star gearbox that lets the fan turn at about a third of LP spool speed (3.06:1). The sun gear on the LP shaft drives five star gears on a fixed carrier; the stars drive the ring gear, which turns the fan the opposite way to the LP spool.\n\nThe gears run on journal bearings fed by the main oil system, with an auxiliary oil supply that keeps them lubricated while windmilling and under negative g. The FDGS is not a line-replaceable item.' });
    const xc = -.37, w = .10;                                                  // gear face centre and width (p.53 FDGS block x 10-19 in aft of the fan LE)
    const gear = (pid, rPitch, nT, inward, mat, x) => { const g = herringbone(rPitch, nT, w, inward); g.translate(x || xc, 0, 0); return PW.add(pid, g, mat || 'gearSteel'); };
    PW.part('fdgs-sun', { parent: 'fdgs', label: 'Sun gear (LP input)', attach: SP.n1, src: 'p.63', info: 'Input gear splined to the LP shaft through a flexible coupling. It turns with N1.' });
    gear('fdgs-sun', .062, 30);
    PW.add('fdgs-sun', G.ring(xc + .06, xc - .25, .025, .045, { seg: 48 }), 'shaft');
    PW.part('fdgs-ring', { parent: 'fdgs', label: 'Ring gear (fan output)', attach: SP.fan, src: 'p.63', info: 'Internally toothed ring gear driven by the five star gears. It drives the fan shaft and turns the fan clockwise, opposite to the sun.' });
    gear('fdgs-ring', .19, 92, true);
    PW.add('fdgs-ring', G.revolve([[xc + .055, .19], [xc + .055, .215], [xc + .10, .24], [xc + .14, .30], [xc + .15, .30], [xc + .11, .23], [xc + .06, .205], [xc - .055, .205], [xc - .055, .19]], { seg: 128 }), 'gearSteel');
    PW.part('fdgs-stars', { parent: 'fdgs', label: 'Star gears (5) and carrier', src: 'p.63-64',
      info: 'Five star gears on journal bearings in a carrier that does not turn: it is tied to the FIC through the torque frame and a flexible support. Each star turns on its own axis, opposite to the sun.' });
    const stars = new THREE.Group(); PW.parts.get('fdgs-stars').obj.add(stars);
    const rs = .064, rc = .062 + rs;
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU, g = new THREE.Group(); g.position.copy(G.onRing(0, rc, a)); stars.add(g);
      const m = gear('fdgs-stars', rs, 31, false, 'gearSteel', xc); g.add(m); m.position.set(0, 0, 0); m.geometry.translate(0, 0, 0);
      const pin = PW.add('fdgs-stars', G.ring(xc + .07, xc - .07, .0, .024, { seg: 32 }), 'shaft'); g.add(pin);
      g.userData.spin = true; }
    /* carrier: two side plates joined round the stars */
    for (const dx of [.062, -.062]) PW.add('fdgs-stars', G.ring(xc + dx + .008, xc + dx - .008, .05, .205, { seg: 96 }), 'steel');
    PW.add('fdgs-stars', G.frustum(xc - .07, xc - .17, .205, .30, .01, { seg: 96 }), 'steel');           // torque frame to the FIC
    /* the stars turn on their axes: opposite to the sun, at sun speed x (sun teeth / star teeth) */
    const sun = PW.spools.n1;
    PW.anim.push(dt => { const w = (PW.speed || 0) * sun.vis * sun.dir * (30 / 31); stars.children.forEach(g => { g.rotation.x -= w * dt; }); });
  }
  /* double-helical (herringbone) gear: each tooth is a prism along the face width whose two halves lean opposite ways (a chevron),
     as on the GTF's star gearbox; inward = internal teeth (the ring gear) */
  function herringbone(rp, nT, w, inward) {
    const m = rp * 2 / nT, h = m * 1.1, helix = deg(28), tw = Math.PI * rp / nT * .92;
    const tooth = new THREE.Shape();
    tooth.moveTo(-tw / 2, 0); tooth.lineTo(-tw * .2, h); tooth.lineTo(tw * .2, h); tooth.lineTo(tw / 2, 0); tooth.lineTo(-tw / 2, 0);
    const one = new THREE.ExtrudeGeometry(tooth, { depth: w, bevelEnabled: false, steps: 8, curveSegments: 1 });
    one.translate(0, 0, -w / 2);
    const pos = one.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setX(i, pos.getX(i) + Math.tan(helix) * Math.abs(pos.getZ(i)));   // the chevron
    one.computeVertexNormals();
    one.rotateY(Math.PI / 2);                                                // face width along x, tooth flank tangential (z)
    const teeth = [];
    for (let i = 0; i < nT; i++) { const g = one.clone(), a = i / nT * TAU, r0 = inward ? rp + h * .5 : rp - h * .5;
      if (inward) g.rotateX(Math.PI); g.translate(0, r0, 0); g.rotateX(a); teeth.push(g); }
    const body = inward ? G.ring(w / 2, -w / 2, rp + h * .45, rp + h * 1.6, { seg: nT * 2 }) : G.ring(w / 2, -w / 2, rp * .55, rp - h * .45, { seg: nT * 2 });
    const out = G.merge([body].concat(teeth)); out.userData.solid = true; return out;
  }

  function buildCombustor() {
    PW.part('combustor', { label: 'Diffuser and combustor', explode: [-1.05, 0, 0], src: 'p.53-55, p.162-175; TTM ch. 72-73',
      info: 'HPC exit air slows in the diffuser and enters the annular combustor, where fuel from 16 nozzles burns continuously. The liner walls are film-cooled by air that flows round them inside the diffuser case.\n\nStation 3 (HPC exit) and station 4 (combustor exit) are here. The liner and the fuel nozzle tips are borescoped through ports in the diffuser case; hot streaks or burnt liner panels show up as an EGT spread.' });
    const xf = -1.66, xa = -1.89;
    PW.part('diffuser-case', { parent: 'combustor', label: 'Diffuser case', src: 'p.53, p.55', info: 'Pressure case round the combustor between flanges H and M. It carries the 16 fuel nozzle mounting pads, the two igniter bosses and borescope ports.' });
    PW.add('diffuser-case', G.revolve(G.shellProfile(seg('outer', xf, xa, 20).map(([x, r]) => [x, Math.max(r, .245)]), seg('outer', xf, xa, 20).map(([x, r]) => [x, Math.max(r, .245) - .007])), { seg: 128 }), 'nickel');
    if (L().combustorInnerCase) wall('diffuser-case', 'combustorInnerCase', -1.68, -1.86, -.006, 'nickel', { n: 12 });
    PW.part('combustor-liner', { parent: 'combustor', label: 'Combustor liner', src: 'p.53; TTM ch. 72',
      info: 'Annular liner with outer and inner walls and a dome at the front where the fuel nozzles enter. Rows of cooling and dilution holes hold the gas temperature to what the HPT can take.' });
    if (L().combustorOuterLiner) wall('combustor-liner', 'combustorOuterLiner', -1.735, -1.875, .004, 'combLiner', { n: 12 });
    if (L().combustorInnerLiner) wall('combustor-liner', 'combustorInnerLiner', -1.75, -1.875, -.004, 'combLiner', { n: 12 });
    { const dm = L().combustorDome; PW.add('combustor-liner', G.revolve(G.shellProfile(dm.map(([x, r]) => [x + .006, r]), dm), { seg: 96 }), 'combLiner'); }   // dome bulkhead (p.53)
    /* 16 fuel nozzles through the case, with their swirler cups at the dome (TTM: 16) */
    PW.part('fuel-nozzles', { parent: 'combustor', label: 'Fuel nozzles (16)', src: 'p.164-175; TTM ch. 73',
      info: 'Sixteen nozzles fed by the primary and secondary manifolds, each held by a mounting flange on the diffuser case with its tip in a swirler at the combustor dome. Some positions are duplex (primary and secondary), others simplex.\n\nA streaky or uneven EGT pattern can point to a coked or leaking nozzle.' });
    const fnPath = L().fuelNozzle;
    for (let i = 0; i < 16; i++) { const a = i / 16 * TAU + TAU / 32;                       // 16 nozzles; two straddle 12 o'clock at +/-11.25 deg (p.164-165)
      const pts = fnPath.map(([x, r]) => G.onRing(x, r, a)); PW.add('fuel-nozzles', G.tube(pts, .0065, { radial: 10, tension: .1 }), 'steel');
      const pad = new THREE.Mesh(G.roundedBox(.032, .012, .036, .003)); pad.position.copy(G.onRing(fnPath[0][0], fnPath[0][1] + .004, a)); pad.rotation.x = a; PW.add('fuel-nozzles', pad, 'steel', { solid: true });
      const tip = new THREE.Mesh(new THREE.CylinderGeometry(.009, .012, .016, 12)); tip.geometry.userData.solid = true; G.aim(tip, G.onRing(fnPath[fnPath.length - 1][0] - .006, fnPath[fnPath.length - 1][1], a), new THREE.Vector3(-1, 0, 0)); PW.add('fuel-nozzles', tip, 'steel', { solid: true }); }
  }

  function buildTurbines(SP) {
    PW.part('hpt', { label: 'High-pressure turbine (HPT)', explode: [-1.3, 0, 0], src: 'p.52-55; TTM ch. 72',
      info: 'Two-stage turbine on the N2 spool that drives the HPC and, through the towershaft, the gearboxes. Blades and vanes are cooled internally and coated with a ceramic thermal barrier. It is the hottest part of the engine and the main reason for EGT limits.\n\nBlade and vane distress is found by borescope; findings are tracked against the AMM limits and drive many removals.' });
    const tbc = 'tbc';
    const rowsT = [['HPT vane 1', 'hpt-ngv-1', 'HPT stage 1 nozzle guide vanes', false], ['HPT blade 1', 'hpt-rotor-1', 'HPT stage 1 rotor', true],
                   ['HPT vane 2', 'hpt-ngv-2', 'HPT stage 2 vanes', false], ['HPT blade 2', 'hpt-rotor-2', 'HPT stage 2 rotor', true]];
    for (const [nm, pid, label, rot] of rowsT) { const rr = rowBy(new RegExp(nm))[0]; if (!rr) continue;
      PW.part(pid, { parent: 'hpt', label, attach: rot ? SP.n2 : null, src: 'p.53', info: rot ? `${label}: cooled single-crystal blades with a thermal barrier coat, on a disc in the N2 rotor. Blade count is representative.` : `${label}: cooled vanes that turn the hot gas onto the next rotor. Count representative.` });
      if (rot) { bladeRow(pid, rr, { role: 'tblade', s: 1, gHub: 22, gTip: 30, camHub: .22, camTip: .18, tHub: .2, tTip: .12, mat: tbc, sigma: 1.3 });
        disk(pid, rr.x_le + .004, rr.x_te - .006, (rr.r_hub_le + rr.r_hub_te) / 2, .05, { mat: 'nickel', web: .012, bore: .03 }); }
      else statorRow(pid, rr, { role: 'ngv', s: 1, gHub: 55, gTip: 58, camHub: .2, camTip: .18, tHub: .22, tTip: .2, mat: tbc, bandMat: 'nickel', sigma: 1.1 }); }
    PW.part('hpt-case', { parent: 'hpt', label: 'HPT case', src: 'p.53', info: 'Case between flanges M and N. The active clearance control manifolds outside it shrink it in cruise to close the blade tip gaps.' });
    PW.add('hpt-case', G.revolve(G.shellProfile(seg('outer', -1.89, -2.05, 12).map(([x, r]) => [x, Math.max(r, .225)]), seg('outer', -1.89, -2.05, 12).map(([x, r]) => [x, Math.max(r, .225) - .008])), { seg: 128 }), 'hotCase');
    wall('hpt-case', 'coreCase', -1.88, -2.04, .005, 'hotCase', { n: 12 });

    PW.part('tic', { label: 'Turbine intermediate case (TIC)', explode: [-1.55, 0, 0], src: 'p.53-55; TTM ch. 72',
      info: 'Structural frame between the HPT and LPT. Its struts carry the No. 4 bearing and pass cooling air and service lines; the turning vanes behind them set up the flow for the first LPT stage. Station 4.5 is at its inlet.' });
    const ts = rowBy(/TIC strut/)[0], tv = rowBy(/TIC turning vane/)[0];
    if (ts) statorRow('tic', ts, { count: 8, gHub: 0, gTip: 0, camHub: 0, camTip: 0, tHub: .3, tTip: .3, mat: 'hotCase', bands: false });
    if (tv) statorRow('tic', tv, { role: 'ngv', s: -1, gHub: 50, gTip: 52, camHub: .18, camTip: .16, tHub: .16, tTip: .14, mat: 'nickel', sigma: 1.1 });
    wall('tic', 'coreCase', -2.05, -2.20, .006, 'hotCase', { n: 14 });
    wall('tic', 'coreHub', -2.05, -2.20, -.006, 'hotCase', { n: 14 });
    PW.add('tic', G.revolve(G.shellProfile(seg('outer', -2.05, -2.20, 14), seg('outer', -2.05, -2.20, 14).map(([x, r]) => [x, r - .008])), { seg: 128 }), 'hotCase');

    PW.part('lpt', { label: 'Low-pressure turbine (LPT)', explode: [-1.85, 0, 0], src: 'p.52-55; TTM ch. 72',
      info: 'Three-stage turbine on the N1 spool. It drives the LPC directly and the fan through the FDGS, so it runs fast and small for its work. Its blades have interlocking tip shrouds.\n\nThe EGT probes sit behind it. Clearance control air is sprayed on its case from the ring manifolds in cruise.' });
    const lp = [['LPT blade 1', 'lpt-rotor-1', true], ['LPT vane 1', 'lpt-vane-2', false], ['LPT blade 2', 'lpt-rotor-2', true], ['LPT vane 2', 'lpt-vane-3', false], ['LPT blade 3', 'lpt-rotor-3', true]];
    for (const [nm, pid, rot] of lp) { const rr = rowBy(new RegExp(nm + '$'))[0] || rowBy(new RegExp(nm))[0]; if (!rr) continue;
      const k = pid.slice(-1);
      PW.part(pid, { parent: 'lpt', label: rot ? `LPT stage ${k} rotor` : `LPT stage ${k} vanes`, attach: rot ? SP.n1 : null, src: 'p.53',
        info: rot ? `Stage ${k} of the LPT on the N1 spool: shrouded blades on a disc. Count representative.` : `Stage ${k} LPT vane ring. Count representative.` });
      if (rot) { const r = bladeRow(pid, rr, { role: 'tblade', s: -1, gHub: 22, gTip: 30, camHub: .2, camTip: .14, tHub: .14, tTip: .08, mat: 'lptBlade', sigma: 1.25 });
        PW.add(pid, G.ring(rr.x_le - .002, rr.x_te + .002, r.rt, r.rt + .006, { seg: 128 }), 'lptBlade');      // interlocking tip shrouds
        disk(pid, rr.x_le, rr.x_te, r.rh, .06, { mat: 'nickel', web: .01, bore: .025 }); }
      else statorRow(pid, rr, { role: 'ngv', s: -1, gHub: 48, gTip: 52, camHub: .18, camTip: .15, tHub: .14, tTip: .12, mat: 'nickel', sigma: 1.1 }); }
    PW.part('lpt-case', { parent: 'lpt', label: 'LPT case', src: 'p.53', info: 'Case between flanges N1 and P carrying the LPT vane rings, with the clearance control ring manifolds round it.' });
    PW.add('lpt-case', G.revolve(G.shellProfile(seg('outer', -2.20, -2.47, 20), seg('outer', -2.20, -2.47, 20).map(([x, r]) => [x, r - .008])), { seg: 160 }), 'hotCase');
    wall('lpt-case', 'coreCase', -2.20, -2.47, .005, 'hotCase', { n: 20 });

    PW.part('tec', { label: 'Turbine exhaust case (TEC)', explode: [-2.15, 0, 0], src: 'p.53-55, p.44-49; TTM ch. 72',
      info: 'The last structural case. Its struts carry the No. 5 and 6 bearing housing, its outer ring carries the aft engine mount lugs at the top, and the core nozzle and plug bolt to its rear flanges (To and Ti). Station 5 is at its exit.' });
    const tec = rowBy(/TEC strut/)[0];
    if (tec) statorRow('tec', tec, { count: 10, gHub: 0, gTip: 0, camHub: 0, camTip: 0, tHub: .14, tTip: .14, mat: 'hotCase', bands: false });
    wall('tec', 'coreCase', -2.47, -2.71, .006, 'hotCase', { n: 16 });
    wall('tec', 'coreHub', -2.47, -2.71, -.006, 'hotCase', { n: 16 });
    PW.add('tec', G.revolve(G.shellProfile(seg('outer', -2.47, -2.71, 16), seg('outer', -2.47, -2.71, 16).map(([x, r]) => [x, r - .008])), { seg: 128 }), 'hotCase');
    if (L().tecCentreBody) { const cb = L().tecCentreBody.slice().sort((a, b) => b[0] - a[0]); const prof = cb.concat([[cb[cb.length - 1][0], 0], [cb[0][0], 0]]);
      PW.add('tec', G.revolve(prof, { seg: 96, crease: 40 }), 'hotCase'); }
    for (const dz of [-.07, .07]) { const lug = new THREE.Mesh(G.roundedBox(.07, .06, .025, .006)); lug.position.set(-2.58, .43, dz); PW.add('tec', lug, 'hotCase', { solid: true }); }   // aft mount lugs at 12 o'clock
  }

  function buildExhaust() {
    /* core nozzle (exhaust sleeve) and plug: from the nacelle stations, TEC flange To to ZS 816.2 and the plug tip at ZS 833.3 */
    PW.part('exhaust', { label: 'Core nozzle and exhaust plug', explode: [-2.6, 0, 0], src: 'TTM ch. 01 Fig. 28, ch. 78; photos',
      info: 'The core nozzle (exhaust sleeve) bolts to the TEC outer flange and the plug to its inner flange. Both are bare heat-resisting metal, straw to bronze with heat. The core stream leaves here; it is never reversed.\n\nOn the walkaround look into the nozzle for metal on the plug or turbine exit, which would mean internal damage.' });
    const NC = D.GEN.nacelle, xTo = D.GEN.flanges.find(f => /^To /.test(f.name)).x, xN = NC.coreNozzleExit.x, xP = NC.plugTip.x;
    const rTo = rAt('outer', -2.70), rN = .385;
    const nozOut = [[xTo, rTo + .004], [xTo - .25, rTo - .015], [xN, rN + .004]], nozIn = [[xTo, rTo - .006], [xTo - .25, rTo - .024], [xN, rN - .002]];
    PW.add('exhaust', G.revolve(G.shellProfile(nozOut, nozIn), { seg: 128, crease: 20 }), 'hotNozzle');
    /* plug: bolts to flange Ti at the TEC hub (about 0.22 m radius), about 0.33 m across at the nozzle exit (TTM Fig. 28), then a long
       cone to a small rounded tip at ZS 833.3, as in the rear photos */
    /* a sheet-metal shell (it reads hollow in a section cut), with a small closed tip */
    const rTi = (D.GEN.flanges.find(f => /^Ti /.test(f.name)).r_in + .01), plug = [], n = 18;
    for (let i = 0; i <= n; i++) { const t = i / n, x = xTo + (xN - xTo) * t; plug.push([x, rTi - (rTi - .165) * Math.pow(t, 1.3)]); }
    for (let i = 1; i <= n; i++) { const t = i / n, x = xN + (xP - xN) * t; plug.push([x, Math.max(.006, .165 * Math.pow(1 - t, 1.08) + .006 * t)]); }
    const inner = plug.filter(p => p[1] > .03).map(([x, r]) => [x - .002, r - .004]);
    PW.add('exhaust', G.revolve(plug.concat([[xP - .006, 0], [inner[inner.length - 1][0] + .01, 0]]).concat(inner.reverse()), { seg: 96, crease: 30 }), 'plugDark');
  }

  function buildShafts(SP) {
    PW.part('shafts', { label: 'Shafts', src: 'p.53; TTM ch. 72', info: 'The LP shaft runs inside the hollow N2 rotor from the LPT to the FDGS sun gear. The N2 rotor\'s front and rear stub shafts carry it on the No. 3 and No. 4 bearings.' });
    PW.part('lp-shaft', { parent: 'shafts', label: 'LP (N1) shaft', attach: SP.n1, src: 'p.53', info: 'Hollow shaft joining the LPT to the LPC and, through a flexible coupling, to the FDGS sun gear. A shaft shear is detected by the EEC and shuts the engine down through the overspeed solenoid.' });
    PW.add('lp-shaft', G.ring(-.40, -2.68, .024, .032, { seg: 48 }), 'shaft');
    PW.part('hp-shaft', { parent: 'shafts', label: 'N2 rotor stub shafts', attach: SP.n2, src: 'p.53', info: 'Front and rear stub shafts of the N2 rotor. The front one drives the towershaft bevel gear to the angle gearbox.' });
    PW.add('hp-shaft', G.ring(-1.08, -1.20, .040, .046, { seg: 48 }), 'shaft');
    PW.add('hp-shaft', G.ring(-2.02, -2.20, .040, .046, { seg: 48 }), 'shaft');
    /* main bearings (p.56-57): 1 and 1.5 tapered roller, 2 and 3 ball, 4, 5 and 6 roller */
    PW.part('bearings', { label: 'Main bearings', src: 'p.56-57; TTM ch. 72',
      info: 'Seven main bearings in four compartments: No. 1 and 1.5 tapered rollers for the fan and FDGS, No. 2 and 3 ball thrust bearings at the front of the N1 and N2 rotors, and No. 4, 5 and 6 rollers at the rear. Most are oil-damped. Each compartment has carbon seals and its own scavenge, and chip collectors on the scavenge lines catch bearing debris.' });
    const B = D.GEN.bearings.map(b => [b.no, b.x, Math.min(b.r, b.no === '1' || b.no === '1.5' ? .105 : b.no === '2' || b.no === '3' ? .07 : .055), b.type, b.supports + (b.damped ? ', oil-damped' : '')]);
    for (const [no, x, r, type, what] of B) { const pid = 'bearing-' + no.replace('.', '-');
      PW.part(pid, { parent: 'bearings', label: `No. ${no} bearing (${type})`, src: 'p.56-57', info: `${type[0].toUpperCase() + type.slice(1)} bearing supporting the ${what}.` });
      PW.add(pid, G.ring(x + .018, x - .018, r - .006, r, { seg: 64 }), 'steel'); PW.add(pid, G.ring(x + .018, x - .018, r + .018, r + .026, { seg: 64 }), 'steel');
      const el = type === 'ball' ? new THREE.SphereGeometry(.011, 12, 8) : new THREE.CylinderGeometry(.009, type === 'tapered roller' ? .007 : .009, .03, 12).rotateZ(Math.PI / 2);
      el.translate(0, r + .01, 0); el.userData.solid = true; PW.add(pid, G.ringInstances(el, PW.partMat(pid, 'gearSteel'), Math.round(TAU * (r + .01) / .026), { x }), null); }
  }
})();
