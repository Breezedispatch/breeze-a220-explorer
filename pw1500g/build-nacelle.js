/* PW1500G model: the nacelle on the A220 (engine No. 2, right wing): inlet cowl, two fan cowl doors, two thrust reverser doors (C-ducts)
   with their inner fixed structure, translating sleeves, cascades and blocker doors, and the lower pylon.
   Stations from TTM ch. 01 Fig. 28 through PW.D.zsToX; layout from the Delta CH 70-80 manual p.8-49 and Brian's hangar photos.
   Clock positions are aft looking forward: right = +z. */
(function () {
  const PW = window.PW, G = window.PWGeo, D = PW.D, TAU = Math.PI * 2;
  (PW.builders = PW.builders || []).push(build);
  const deg = d => d * Math.PI / 180;

  /* quilted stainless thermal blanket (the core side of the reverser doors in the photos): diamond quilting with stud dots */
  const quiltTex = () => PW.tex.quilt || (PW.tex.quilt = PW.tex.canvas(256, 256, (c, w, h) => {
    c.fillStyle = '#9a9a9a'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 4000; i++) { c.fillStyle = `rgba(${Math.random() < .5 ? '255,255,255' : '0,0,0'},.05)`; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    c.strokeStyle = '#4a4a4a'; c.lineWidth = 3;
    for (let k = -1; k <= 2; k++) { c.beginPath(); c.moveTo(k * w / 2, 0); c.lineTo(k * w / 2 + w, h); c.stroke(); c.beginPath(); c.moveTo(k * w / 2 + w, 0); c.lineTo(k * w / 2, h); c.stroke(); }
    c.fillStyle = '#3a3a3a'; for (const [x, y] of [[0, 0], [w / 2, h / 2], [w, 0], [0, h], [w, h]]) { c.beginPath(); c.arc(x, y, 7, 0, TAU); c.fill(); }
  }));
  Object.assign(PW.MAT, {
    cowlWhite: () => new THREE.MeshStandardMaterial({ color: new THREE.Color('#e3e6e8'), roughness: .55, metalness: .02 }),
    inletLining: () => new THREE.MeshStandardMaterial({ color: new THREE.Color('#2a2f31'), roughness: .6, metalness: .2, bumpMap: PW.tex.perf(), bumpScale: .0008 }),
    blanket: () => { const t = quiltTex(); return new THREE.MeshStandardMaterial({ color: new THREE.Color('#c9cacb'), roughness: .42, metalness: .85, bumpMap: t, bumpScale: .004, roughnessMap: t }); },
    siliconeSeal: () => new THREE.MeshStandardMaterial({ color: new THREE.Color('#b8553a'), roughness: .7, metalness: 0 }),
    cascadeGrey: () => new THREE.MeshStandardMaterial({ color: new THREE.Color('#4b5056'), roughness: .5, metalness: .5 }),
    bareCowl: () => new THREE.MeshStandardMaterial({ color: new THREE.Color('#a9a59b'), roughness: .45, metalness: .85, roughnessMap: PW.tex.noise('cast', 256, 14, .55, 1) }),
  });

  /* ---- nacelle state, driven from the toolbar: fan cowls 0..1 (55 deg), reverser doors 0..1 (45 deg), sleeves 0..1 (deployed) ---- */
  const S = PW.nac = { fan: 0, tr: 0, sleeve: 0, want: { fan: 0, tr: 0, sleeve: 0 }, hinges: [], sleeves: [], blockers: [] };

  function build() {
    if (!D.GEN) return;
    const X = D.zsToX, Z = D.ZS, x = zs => X(zs);
    const nac = D.nacOuter();                                         // outer line [x, r], forward to aft
    const rOut = xx => G.interp(nac, xx);
    const xHL = x(Z.inletHighlight), xJ1 = x(Z.inletFanCowl), xJ2 = x(Z.fanCowlTR), xSF = x(Z.sleeveFwd), xTE = x(Z.sleeveTE), xCN = D.GEN.nacelle.coreNozzleExit.x;
    const fA = D.GEN.flanges.find(f => /^A /.test(f.name));
    PW.NACELLE_IDS = ['inlet', 'fan-cowls', 'thrust-reverser', 'pylon'];
    PW.part('nacelle', { label: 'Nacelle and pylon', src: 'Delta CH 70-80 p.8-49; TTM ch. 01, 54, 71, 78',
      info: 'The nacelle is the inlet cowl, two fan cowl doors and two thrust reverser doors. The reverser doors also carry the inner fixed structure that encloses the core. All hang from the pylon.\n\nUse the Cowls control to open the fan cowls and reverser doors as they are opened for maintenance.' });

    /* ============================== INLET ============================== */
    PW.part('inlet', { parent: 'nacelle', label: 'Inlet cowl', explode: [1.0, 0, 0], src: 'p.8-11; TTM ch. 01 Fig. 28; ch. 30; photos',
      info: 'Bolted to fan case flange A. The lip is anti-iced by bleed air from a piccolo tube inside it, and the inner barrel is lined with acoustic panels. Its lower lip sits about 2 in aft of the upper lip (scarf).\n\nOn the outer barrel: the NACA scoop at 1 o\'clock, the P2T2 probe access panel at 11 o\'clock, the cowl anti-ice duct access panel at 5 o\'clock with the anti-ice exhaust slots near it, and drain holes at the bottom. Check the lip and inner barrel for dents, erosion and damage on every walkaround.' });
    {
      const rHL = 1.072, rTh = .942, rFF = G.interp(D.GEN.lines.fanCaseInner, fA.x);
      const lipTop = [[xHL, rHL]], k = 10;
      /* lip: an elliptical nose from the throat round the highlight onto the outer barrel */
      const lipPts = []; for (let i = 0; i <= k; i++) { const a = -Math.PI / 2 + Math.PI * i / k, ex = .085, er = (rOut(xHL - .09) - rTh) / 2, cr = rTh + er;
        lipPts.push([xHL - ex + ex * Math.cos(a) * (a < 0 ? 1 : 1), cr + er * Math.sin(a)]); }
      // lip skin (bare metal), as a closed thin shell over the nose
      const lipOut = lipPts.map(([xx, r]) => [xx, r]), lipIn = lipPts.map(([xx, r]) => { const c = [xHL - .085, (lipPts[0][1] + lipPts[k][1]) / 2]; const d = Math.hypot(xx - c[0], r - c[1]); const s = (d - .004) / d; return [c[0] + (xx - c[0]) * s, c[1] + (r - c[1]) * s]; });
      PW.part('inlet-lip', { parent: 'inlet', label: 'Inlet lip', src: 'p.8-11; TTM ch. 30; photos',
        info: 'Aluminium lip skin, anti-iced from inside by hot bleed air sprayed from a piccolo tube in the D-duct behind it. Dents, erosion and bird strike damage are assessed against the AMM limits.' });
      PW.add('inlet-lip', scarf(G.revolve(lipOut.concat(lipIn.reverse()), { seg: 160, crease: 70 }), xHL), 'lipAl');
      // outer barrel (painted), from the lip to the inlet / fan cowl joint
      const ob = []; for (let i = 0; i <= 20; i++) { const xx = (xHL - .085) + (xJ1 - (xHL - .085)) * i / 20; ob.push([xx, rOut(xx)]); }
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
      // piccolo tube in the D-duct
      PW.add('inlet', scarf(G.revolve([[xHL - .10, rHL - .052], [xHL - .115, rHL - .052], [xHL - .115, rHL - .037], [xHL - .10, rHL - .037]], { seg: 128 }), xHL), 'steel');
      // features on the outer barrel (clock positions ALF; p.10-11)
      const onBarrel = (pid, label, info, xx, h, w, l, mat) => { PW.part(pid, { parent: 'inlet', label, info, src: 'p.10-11' }); const a = G.clock(h);
        const m = new THREE.Mesh(G.roundedBox(l, .006, w, .01)); m.position.copy(G.onRing(xx, rOut(xx) + .001, a)); m.rotation.x = a; PW.add(pid, m, 'nacellePaint', { mat: { color: '#123f97' }, solid: true }); return m; };
      onBarrel('inlet-p2t2-panel', 'P2/T2 probe access panel', 'Access panel at 11 o\'clock over the P2/T2 probe, its harness and its heater lead.', xHL - .45, 11, .16, .22);
      onBarrel('inlet-cai-panel', 'Cowl anti-ice duct access panel', 'Access panel at 5 o\'clock over the cowl anti-ice duct where it enters the inlet.', xJ1 + .25, 5, .16, .24);
      { PW.part('inlet-naca', { parent: 'inlet', label: 'NACA scoop', src: 'p.10', info: 'Flush NACA-type air scoop at 1 o\'clock near the front of the outer barrel, ventilating the space inside the inlet cowl.' });
        const a = G.clock(1), xx = xHL - .32, m = new THREE.Mesh(G.roundedBox(.16, .02, .07, .008)); m.position.copy(G.onRing(xx, rOut(xx) - .006, a)); m.rotation.x = a; PW.add('inlet-naca', m, 'darkBox', { solid: true }); }
      { PW.part('inlet-ai-exhaust', { parent: 'inlet', label: 'Cowl anti-ice exhaust slots', src: 'p.10-11', info: 'Slots at the bottom of the outer barrel, near the 5 o\'clock access panel, where the anti-ice air leaves the lip D-duct.' });
        for (let i = 0; i < 6; i++) { const a = G.clock(5.4) + i * .045, xx = xHL - .26; const m = new THREE.Mesh(G.roundedBox(.11, .006, .016, .004)); m.position.copy(G.onRing(xx, rOut(xx) + .0005, a)); m.rotation.x = a; PW.add('inlet-ai-exhaust', m, 'darkBox', { solid: true }); } }
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
      info: 'Two composite doors from the inlet to the thrust reverser, each hung on three hinges from the pylon and latched at the bottom by three flush latches (L1, L2, L3). They open up to 55 degrees on two hold-open rods each; above that the hinges can be damaged.\n\nThe inboard cowl carries the strake. Never open the fan cowls in winds above the AMM limit, and always check all three latches closed and flush after maintenance: an unlatched fan cowl can depart in flight.' });
    const yh = 1.18;                                                   // hinge line height, just under the pylon
    for (const side of ['left', 'right']) {
      const sg = side === 'right' ? 1 : -1, pid = `fan-cowl-${side}`;
      PW.part(pid, { parent: 'fan-cowls', label: `${side === 'left' ? 'Left (inboard)' : 'Right (outboard)'} fan cowl`, src: 'p.12-15; photos',
        info: side === 'left' ? 'Inboard fan cowl on this right-hand engine. It carries the strake, the vortex fin that improves flow over the wing at high angle of attack. White inside with lime-green frames.' : 'Outboard fan cowl on this right-hand engine, with the fan compartment pressure-relief door. White inside with lime-green frames.' });
      const obj = PW.parts.get(pid).obj, hinge = new THREE.Group(); obj.add(hinge); obj.position.set(0, yh, sg * .21); hinge.position.set(0, -yh, -sg * .21);
      S.hinges.push({ obj, axis: 'fan', sign: -sg, max: deg(55) });
      const t0 = sg > 0 ? deg(10) : Math.PI + deg(1), tl = Math.PI - deg(11);
      const outer = [], inner = []; for (let i = 0; i <= 18; i++) { const xx = xJ1 - .002 + (xJ2 + .002 - xJ1) * i / 18; outer.push([xx, rOut(xx)]); inner.push([xx, rOut(xx) - .028]); }
      PW.add(pid, G.revolve(outer.concat(inner.slice().reverse()), { seg: 72, thetaStart: sg > 0 ? t0 : Math.PI + deg(.08), thetaLength: tl + deg(.92) }), 'nacellePaint', { into: hinge });   // the skins meet at the bottom split line
      PW.add(pid, G.revolve(inner.map(([xx, r]) => [xx, r]).concat(inner.map(([xx, r]) => [xx, r - .003]).reverse()), { seg: 72, thetaStart: t0, thetaLength: tl }), 'cowlWhite', { into: hinge });
      for (const xx of [xJ1 - .03, (xJ1 + xJ2) / 2, xJ2 + .03]) PW.add(pid, G.revolve([[xx + .015, rOut(xx) - .03], [xx - .015, rOut(xx) - .03], [xx - .015, rOut(xx) - .075], [xx + .015, rOut(xx) - .075]], { seg: 72, thetaStart: t0, thetaLength: tl }), 'lime', { into: hinge });   // frames
      // three latches at the bottom edge (keepers on the right cowl, hooks on the left), three hinges at the top
      for (const f of [.2, .5, .8]) { const xx = xJ1 + (xJ2 - xJ1) * f, a = t0 + (sg > 0 ? tl : 0), m = new THREE.Mesh(G.roundedBox(.12, .024, .03, .005));
        m.position.copy(G.onRing(xx, rOut(xx) - .045, a)); m.rotation.x = a; PW.add(pid, m, sg < 0 ? 'darkBox' : 'steel', { solid: true, into: hinge });   // latch body / keeper inside the edge
        if (sg < 0) { const ah = a + deg(1.3);                                                                   // the flush handle in the left cowl's skin, as on the reverser
          for (const [w, t, l, dr, mat] of [[.156, .003, .04, -.0005, 'darkBox'], [.15, .003, .034, .0008, 'greyPrimer']]) { const hd = new THREE.Mesh(G.roundedBox(w, t, l, .0015)); hd.position.copy(G.onRing(xx, rOut(xx) + dr, ah)); hd.rotation.x = ah; PW.add(pid, hd, mat, { solid: true, into: hinge }); } }
        const hm = new THREE.Mesh(G.roundedBox(.08, .06, .03, .006)); hm.position.set(xx, yh - .02, sg * .22); PW.add(pid, hm, 'lime', { solid: true, into: hinge }); }
      // two hold-open rods per cowl, stowed along the inside of the door (deployed when the cowl is open)
      for (const f of [.3, .72]) { const xx = xJ1 + (xJ2 - xJ1) * f, a0 = G.clock(sg > 0 ? 3.2 : 8.8);
        const r = new THREE.Mesh(G.rod(G.onRing(xx, 1.0, a0), G.onRing(xx - .02, 1.16, G.clock(sg > 0 ? 1.6 : 10.4)), .011)); PW.add(pid, r, 'darkBox', { into: hinge }); }
    }
    { // strake on the inboard (left) cowl, about 30 deg above the horizontal (10 o'clock), about 36 in long
      const a = G.clock(10), xa = xJ1 - .25, xb = xa - .91, h = .14, p = PW.parts.get('fan-cowl-left').obj.children[0];
      const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(-.91, 0); sh.lineTo(-.82, h * .55); sh.lineTo(-.12, h); sh.lineTo(0, 0);
      const g = new THREE.ExtrudeGeometry(sh, { depth: .008, bevelEnabled: false }); g.translate(0, 0, -.004);
      const m = new THREE.Mesh(g); m.position.copy(G.onRing(xa, rOut(xa) - .002, a)); m.rotation.x = a; m.rotateZ(0); PW.add('fan-cowl-left', m, 'nacellePaint', { solid: true, into: p });
    }

    /* ============================== THRUST REVERSER DOORS ============================== */
    PW.part('thrust-reverser', { parent: 'nacelle', label: 'Thrust reverser doors', src: 'p.18-43, p.324-379; TTM ch. 78',
      info: 'Two C-duct doors, left and right, hinged at the pylon hinge beam and latched together at the bottom. Each carries its translating sleeve, eight carbon fibre cascade boxes, five blocker doors, two hydraulic actuators on the torque box at its forward end, and its half of the inner fixed structure (IFS) that encloses the core.\n\nThe actuation is electrically controlled and hydraulically worked (from hydraulic system No. 1 on the left engine). The EEC opens the isolation control unit (ICU) in the aft pylon and the directional control unit (DCU) in the forward pylon; the CDCs open the track lock valves. In reverse the sleeves move aft to uncover the cascades and the blocker doors swing into the fan duct, turning the fan air forward; the core stream is not reversed. A white REV icon shows in transit, green when deployed, amber for a fault.\n\nFor dispatch with a reverser inoperative, and for safety during maintenance, the manual inhibit lever on the ICU isolates the system and is locked by the inhibit pin stored on the ICU.' });
    const yhT = 1.0;
    /* the IFS outer line (inner wall of the fan duct) and the duct's outer wall (inside the T/R door) */
    const bi = D.GEN.lines.bypassInner, xI0 = bi[bi.length - 1][0], rI0 = bi[bi.length - 1][1];
    const IFS = [[xI0, rI0], [xI0 - .2, .555], [-1.35, .585], [-1.9, .588], [-2.2, .575], [xTE, .53], [xTE - .25, .47], [xCN + .004, .392]];
    const DUCT = [[-.92, .945], [-1.4, .955], [xSF, .952], [-2.3, .94], [xTE, .93]];
    const rIFS = xx => G.interp(IFS, xx), rDuct = xx => G.interp(DUCT, xx);
    for (const side of ['left', 'right']) {
      const sg = side === 'right' ? 1 : -1, pid = `tr-${side}`;
      PW.part(pid, { parent: 'thrust-reverser', label: `${side === 'left' ? 'Left' : 'Right'} thrust reverser door`, explode: [0, .25, sg * .9], src: 'p.18-23; photos',
        info: `${side === 'left' ? 'Left' : 'Right'} C-duct: outer fixed cowl, translating sleeve, cascades, blocker doors and actuators outside, the IFS half inside. It hinges at the pylon and latches to the other door at the bottom.` + (side === 'right' ? ' The oil tank access door is on its IFS at about 2:30.' : ' Its IFS carries the air/oil cooler window and the IFS pressure-relief door at 9 o\'clock, and its latch beam carries the latch access door where the drain mast exits.') });
      const obj = PW.parts.get(pid).obj, hinge = new THREE.Group(); obj.add(hinge); obj.position.set(0, yhT + .2, sg * .2); hinge.position.set(0, -(yhT + .2), -sg * .2);
      S.hinges.push({ obj, axis: 'tr', sign: -sg, max: deg(45) });
      const t0 = sg > 0 ? deg(10) : Math.PI + deg(1), tl = Math.PI - deg(11);
      /* inner structure (IFS, fan duct outer wall, forward frame) stops 6 deg either side of 6 o'clock for the lower bifurcation (it was 4 deg until 2026-10-07; p.31 and the photo from below show a bay about 0.2 m wide) */
      const it0 = sg > 0 ? t0 : Math.PI + deg(6), itl = Math.PI - deg(16);
      const rev = (prof, mat, o) => PW.add(o && o.pid || pid, G.revolve(prof, { seg: 72, thetaStart: o && o.inner ? it0 : t0, thetaLength: o && o.inner ? itl : tl }), mat, Object.assign({ into: hinge }, o || {}));
      /* outer fixed cowl (ZS 732 to 772) */
      const fo = []; for (let i = 0; i <= 10; i++) { const xx = xJ2 - .002 + (xSF - xJ2 + .002) * i / 10; fo.push([xx, rOut(xx)]); }
      PW.add(pid, G.revolve(G.shellProfile(fo, fo.map(([xx, r]) => [xx, r - .02])), { seg: 72, thetaStart: sg > 0 ? t0 : Math.PI + deg(.08), thetaLength: tl + deg(.92) }), 'nacellePaint', { into: hinge });   // outer skin, meeting the other door's at the latch line
      /* the fan duct outer wall and the torque box / forward frame joining them */
      const dw = []; for (let i = 0; i <= 10; i++) { const xx = -.93 + (xSF + .02 - -.93) * i / 10; dw.push([xx, rDuct(xx)]); }
      rev(G.shellProfile(dw.map(([xx, r]) => [xx, r + .012]), dw), 'cowlWhite', { inner: true });
      rev([[xJ2 - .002, rDuct(xJ2) + .012], [xJ2 - .06, rDuct(xJ2) + .012], [xJ2 - .06, rOut(xJ2) - .02], [xJ2 - .002, rOut(xJ2) - .02]], 'lime', { inner: true });      // forward frame with the V-blade
      /* cascades: fixed segments under the stowed sleeve (ZS ~773 to 791), uncovered when the sleeve moves aft */
      const cid = `${pid}-cascades`;
      PW.part(cid, { parent: pid, label: `${side === 'left' ? 'Left' : 'Right'} cascade segments`, attach: hinge, src: 'p.18-19',
        info: 'Fixed cascade segments: rows of curved vanes that turn the fan air forward when the sleeve has moved aft. None at the hinge and latch beams.' });
      const xc0 = x(773.5), xc1 = x(791), rc = .975;
      PW.add(cid, G.revolve([[xc0, rc - .03], [xc1, rc - .03], [xc1, rc + .03], [xc0, rc + .03]], { seg: 60, thetaStart: t0 + deg(8), thetaLength: tl - deg(16) }), 'cascadeGrey');
      for (let i = 0; i <= 14; i++) { const xx = xc0 + (xc1 - xc0) * i / 14; PW.add(cid, G.revolve([[xx + .004, rc - .028], [xx - .004, rc - .028], [xx - .016, rc + .028], [xx - .008, rc + .028]], { seg: 60, thetaStart: t0 + deg(8), thetaLength: tl - deg(16) }), 'darkBox'); }
      /* translating sleeve (ZS 772 to 794): its own group so it can slide aft; blocker doors in its inner wall */
      const sid = `${pid}-sleeve`;
      PW.part(sid, { parent: pid, label: `${side === 'left' ? 'Left' : 'Right'} translating sleeve`, attach: hinge, src: 'p.18-19, p.332-337; TTM ch. 78',
        info: 'The outer aft cowl of the door. Two hydraulic actuators move it aft to uncover the cascades: the locking feedback actuator in the upper section, whose LVDT reports its position, and the locking actuator in the lower section, kept in step by a flexible drive shaft. A track lock unit on the latch beam holds it stowed. Its inner wall carries five composite blocker doors that the drag links pull into the fan duct as it moves aft; the upper and lower blocker doors are unique to their positions.' });
      const sl = PW.parts.get(sid).obj; S.sleeves.push(sl);
      const so = []; for (let i = 0; i <= 10; i++) { const xx = xSF + (xTE - xSF) * i / 10; so.push([xx, rOut(xx)]); }
      const si = so.map(([xx, r]) => [xx, Math.min(r - .015, rDuct(xx) + .055 * (1 - Math.pow((xx - xSF) / (xTE - xSF), 1.6)))]);
      PW.add(sid, G.revolve(G.shellProfile(so, si), { seg: 72, thetaStart: sg > 0 ? t0 : Math.PI + deg(.08), thetaLength: tl + deg(.92) }), 'nacellePaint');
      PW.add(sid, G.revolve(G.shellProfile(si, si.map(([xx, r]) => [xx, r - .004])), { seg: 72, thetaStart: t0, thetaLength: tl }), 'cowlWhite');
      // five blocker doors per side: stowed flush in the sleeve's inner wall, they swing down into the duct on drag links
      for (let i = 0; i < 5; i++) { const a = t0 + deg(12) + (tl - deg(24)) * (i + .5) / 5, piv = new THREE.Group(), xp = xSF - .02;
        piv.position.copy(G.onRing(xp, rDuct(xp) + .005, a)); piv.rotation.x = a; piv.userData.a = a; sl.add(piv);
        const bd = new THREE.Mesh(G.roundedBox(.34, .018, .26, .01)); bd.position.set(-.17, 0, 0); bd.userData.pid = sid; piv.add(bd); PW.add(sid, bd, 'cowlWhite', { solid: true, into: piv });
        S.blockers.push(piv); }
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
        PW.add(iid, G.revolve(G.shellProfile(ifo.map(([xx, r]) => [xx, r - .02]), ifo.map(([xx, r]) => [xx, r - .032])), { seg: 72, thetaStart: a0 + deg(1), thetaLength: al - deg(2) }), 'blanket', { mat: { bumpMap: quiltTex(), roughnessMap: quiltTex() } }); }
      /* TTM p.268-269: two fire detection elements on each core cowl, forward and aft, each a pair of sensing tubes (loops A and B)
         clipped to the blanket and running round the core; they open with the door */
      if (PW.parts.has('fire')) { const fid = `fire-${side}`;
        PW.part(fid, { parent: 'fire', label: `Fire detection elements, ${side} core cowl`, attach: hinge, src: 'TTM ch. 26 (p.268-269)',
          info: 'Two sensing elements of fire loops A and B on the inside of this core cowl, one forward and one aft, each a pair of tubes running round the core on clips. They are part of the reverser door and open with it.' });
        for (const xx of [-1.43, -1.98]) for (const dx of [-.011, .011]) { const pts = []; for (let i = 0; i <= 18; i++) pts.push(G.onRing(xx + dx, rIFS(xx) - .042, it0 + deg(6) + (itl - deg(12)) * i / 18));
          const g = G.tube(pts, .0035, { radial: 6 }), m = PW.add(fid, g, 'steel'); m.userData.isLine = true;
          if (dx < 0) { const c = PW.add(fid, G.alongCurve(g.userData.curve, [.1, .3, .5, .7, .9], () => new THREE.BoxGeometry(.035, .008, .012)), 'steel'); c.userData.isLine = true; } } }
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
        PW.part(lb, { parent: pid, attach: hinge, label: sg > 0 ? 'Right latch beam: latch keepers, BLS receiver, bumpers' : 'Left latch beam: latches, BLS handle, closure assist, bumpers', src: 'p.24-31',
          info: sg > 0 ? 'The bottom edge of the right door: the keepers for latches 1 to 5, the receiver for the bifurcation latch pin on the IFS edge, and the upper and lower bumpers that align the IFS halves as the doors close. The upper bumper has a compression strut for the wider gap at the top.'
            : 'The bottom edge of the left door. Latches 1 to 5 hook onto the right door: open them 5, 4, 3, 2, 1 and close them 1 to 5, using the closure assist assembly to pull the doors together first. Latches 2 and 3 are inside the bay behind the latch access door.\n\nThe bifurcation latch system (BLS) pins the two IFS halves together at the bottom to limit IFS deflection if an air duct bursts. Its handle is painted red and is worked through the latch access door; if it is not locked, the latch access door cannot be closed. Open the BLS before the latches and close it last.' });
        /* the web, 1.6 deg in from the door's bottom edge, from just aft of the bifurcation pass-through panel to the sleeve; the drain
           mast passes down between the two webs */
        const aW = aB - sg * deg(.6), hW = aW / (Math.PI / 6), web = new THREE.Shape(), xa = -1.10, xb = xSF, n = 8, pts = [];
        for (let i = 0; i <= n; i++) { const xx = xa + (xb - xa) * i / n; pts.push([xx, rDuct(xx) + .012]); } for (let i = n; i >= 0; i--) { const xx = xa + (xb - xa) * i / n; pts.push([xx, rOut(xx) - .022]); }
        web.moveTo(...pts[0]); pts.slice(1).forEach(p => web.lineTo(...p)); const wg = new THREE.ExtrudeGeometry(web, { depth: .008, bevelEnabled: false }); wg.translate(0, 0, -.004);
        const wm = new THREE.Mesh(wg); wm.rotation.set(aW, 0, 0); PW.add(lb, wm, 'lime', { solid: true });
        /* latches: [x, radius, has an outer handle]; the hooks on the left web reach across onto the keepers on the right */
        for (const [xx, rr, outside] of [[-.99, rOut(-.99) - .035, true], [-1.22, rOut(-1.22) - .06, false], [-1.40, rDuct(-1.40) + .05, false], [-1.62, rOut(-1.62) - .035, true], [-1.88, rOut(-1.88) - .035, true]]) {
          const f = Kt.frame(lb, xx, xx < -1.1 ? hW : hB, rr);
          if (sg < 0) { Kt.box(lb, f, [0, 0, -.017], [.1, .03, .03], 'steel', { round: .004 }); Kt.box(lb, f, [.05, 0, -.036], [.016, .01, .014], 'steel', { round: .003 });   // hook body and hook
            if (outside) { const g = Kt.frame(lb, xx, hB + .04, rOut(xx)); Kt.box(lb, g, [0, -.0005, 0], [.156, .003, .04], 'darkBox', { round: .0015 }); Kt.box(lb, g, [0, .0008, 0], [.15, .003, .034], 'greyPrimer', { round: .004 }); } }
          else { Kt.box(lb, f, [0, 0, .015], [.06, .034, .03], 'steel', { round: .004 }); Kt.cyl(lb, f, [.0, 0, .022], 'x', .005, .07, 'steel'); } }                  // keeper bracket and pin
        /* bifurcation latch system at x -1.36: the fitting and pin on the left IFS edge, the receiver on the right, the rod down to the
           red handle in the bay */
        const fI = Kt.frame(lb, -1.36, hI, rIFS(-1.36) - .025);
        Kt.box(lb, fI, [0, -.01, sg * .012], [.05, .036, .028], 'steel', { round: .005 });
        if (sg < 0) { Kt.cyl(lb, fI, [0, -.012, -.04], 'z', .0065, .04, 'steel');
          PW.add(lb, G.rod(G.onRing(-1.36, rIFS(-1.36) - .01, G.clock(hI - .02)), G.onRing(-1.36, rOut(-1.36) - .05, G.clock(hB + .05)), .006), 'steel');
          const fh = Kt.frame(lb, -1.36, hB + .05, rOut(-1.36) - .05);
          Kt.box(lb, fh, [0, -.008, 0], [.014, .016, .014], 'steel', { round: .003, mat: { color: '#b3191f', metalness: .15, roughness: .5 } });
          Kt.box(lb, fh, [.035, -.008, 0], [.07, .012, .014], 'steel', { round: .004, mat: { color: '#b3191f', metalness: .15, roughness: .5 } }); }   // the red L-handle
        else Kt.tube(lb, fI, [0, -.012, .028], 'z', .0068, .013, .016, 'steel');
        /* bumpers: lower on the bottom IFS edge, upper on the top edge (where the compression strut bridges the wider gap) */
        const hT = (sg > 0 ? it0 : it0 + itl) / (Math.PI / 6);
        for (const [xx, h] of [[-1.08, hI], [-1.86, hI], [-1.08, hT], [-1.86, hT]]) { const f = Kt.frame(lb, xx, h, rIFS(xx) - .03), tw = h === hI ? (sg > 0 ? 'z' : '-z') : (sg > 0 ? '-z' : 'z');
          Kt.box(lb, f, [0, 0, 0], [.04, .024, .02], 'steel', { round: .004 }); Kt.cyl(lb, f, [0, 0, Kt.dir(tw).z * .016], tw, .011, .012, 'rubber', { edge: .003 }); }
        /* closure assist assembly, stowed along the left web in the bay: a turnbuckle with a hook at its forward end */
        if (sg < 0) { const fc = Kt.frame(lb, -1.34, hB + .08, rOut(-1.34) - .09);
          Kt.cyl(lb, fc, [0, 0, 0], 'x', .009, .16, 'steel', { edge: .002 }); for (const s of [-1, 1]) Kt.hex(lb, fc, [s * .088, 0, 0], 'x', .011, .016, 'steel');
          Kt.box(lb, fc, [.11, .006, 0], [.03, .012, .008], 'steel', { round: .003 }); }
        }
      /* the latch access door on the bottom of the left door, ahead of the drain mast (p.31) */
      if (sg < 0) { PW.part('tr-latch-access-door', { parent: pid, attach: hinge, label: 'Latch access door', src: 'p.24, p.30-31, p.50',
          info: 'Door in the bottom of the left reverser door, ahead of the drain mast. Behind it are latches 2 and 3, the red bifurcation latch system handle and the closure assist assembly. It will not close unless the BLS handle is locked, so a latch access door that will not close means the BLS is not latched. The drain mast exits next to it, and the drain map placard is inside it.' });
        const f = PW.kit.frame('tr-latch-access-door', -1.34, 6.2, rOut(-1.34));
        PW.kit.box('tr-latch-access-door', f, [0, .0002, 0], [.326, .003, .146], 'darkBox', { round: .002 }); PW.kit.box('tr-latch-access-door', f, [0, .0016, 0], [.32, .004, .14], 'nacellePaint', { round: .008 });
        for (const s of [-1, 1]) PW.kit.box('tr-latch-access-door', f, [s * .12, .0036, .05], [.026, .002, .016], 'greyPrimer', { round: .003 }); }
      { const a = sg > 0 ? t0 : t0 + tl, m = new THREE.Mesh(G.roundedBox(1.5, .05, .04, .01)); m.position.copy(G.onRing(-1.75, yhT + .03, a)); m.rotation.x = a; PW.add(pid, m, 'nickel', { solid: true, into: hinge }); }
      /* actuation (p.334-351, p.347): on the torque box at the forward end of the door, the locking feedback actuator in the upper section
         and the locking actuator in the lower one, joined round the ring by the flexible drive shaft and the deploy tube, with the stow,
         deploy and return lines coming down from the hinge beam. The rods belong to the sleeve and slide with it (0.48 m stroke, still
         inside the bodies at full deploy). The track lock unit sits on the latch beam at the sleeve's forward end, its valve nearby */
      { const Kt = PW.kit, aid = `${pid}-actuators`, xm = xJ2 - .075, ra = 1.06, hU = sg > 0 ? 1.5 : 10.5, hL = sg > 0 ? 4.5 : 7.5, hBot = (sg > 0 ? t0 + tl : t0) / (Math.PI / 6);
        PW.part(aid, { parent: pid, attach: hinge, label: `${side === 'left' ? 'Left' : 'Right'} sleeve actuators, drive shaft and track lock`, src: 'p.326-351',
          info: 'Two hydraulic jackscrew actuators move this door\'s translating sleeve. The locking feedback actuator in the upper section carries the LVDT on its forward end that reports sleeve position to the EEC; the locking actuator in the lower section carries the manual drive unit. Each has an internal lock released by hydraulic pressure, a proximity sensor on the lock and a manual lock lever. The flexible drive shaft keeps the two in step and the deploy tube feeds the locking actuator.\n\nThe track lock unit on the latch beam, worked by its track lock valve, locks the stowed sleeve: with the actuator locks it gives mechanical protection against an inadvertent deploy. To move a sleeve by hand, release the manual locks and turn the manual drive unit; its torque limiter protects the actuators.' });
        for (const [h, feedback] of [[hU, true], [hL, false]]) {
          const f = Kt.frame(aid, xm, h, ra);
          Kt.box(aid, f, [.02, 0, 0], [.05, .075, .075], 'steel', { round: .008 });                                              // gimbal mount on the torque box
          Kt.cyl(aid, f, [-.27, 0, 0], 'x', .033, .5, 'steel', { edge: .006 }); Kt.cyl(aid, f, [-.525, 0, 0], 'x', .027, .03, 'steel');   // body and rod gland
          for (const xr of [-.12, -.36]) Kt.tube(aid, f, [xr, 0, 0], 'x', .033, .037, .012, 'steel');
          Kt.cyl(aid, f, [-.1, .038, 0], 'y', .009, .02, 'steel'); Kt.connector(aid, f, [-.1, .048, 0], 'y', .007, { lead: 'x' });    // lock proximity sensor
          Kt.box(aid, f, [-.18, .036, .02], [.05, .01, .012], 'steel', { round: .003, mat: { color: '#c0262b', metalness: .2, roughness: .5 } });   // manual lock lever
          for (const xr of [-.06, -.44]) Kt.fitting(aid, f, [xr, .028, -.03], 'y', .008);                                           // stow and deploy ports
          if (feedback) { Kt.cyl(aid, f, [.085, 0, 0], 'x', .016, .1, 'steel'); Kt.connector(aid, f, [.135, 0, 0], 'x', .009, { lead: 'y' }); }   // LVDT
          else { Kt.cyl(aid, f, [.035, .04, 0], 'y', .015, .03, 'steel'); Kt.hex(aid, f, [.035, .06, 0], 'y', .011, .01, 'steel'); Kt.cyl(aid, f, [.035, .068, 0], 'y', .008, .006, 'capBlack'); }   // manual drive unit
          const g = Kt.frame(sid, xm, h, ra); Kt.cyl(sid, g, [-.49, 0, 0], 'x', .016, .94, 'steel'); Kt.box(sid, g, [-.96, 0, 0], [.04, .05, .05], 'steel', { round: .006 }); }   // rod and rod end on the sleeve
        const arc = (h0, h1, r, dx) => { const pts = [], n = Math.ceil(Math.abs(h1 - h0) / .2); for (let i = 0; i <= n; i++) pts.push(G.onRing(xm + dx, r, G.clock(h0 + (h1 - h0) * i / n))); return pts; };
        const tube = (pts, r, mat) => { const tg = G.tube(pts, r, { radial: 8, tension: .3 }); PW.add(aid, tg, mat).userData.isLine = true; };
        tube(arc(hU, hL, ra + .048, -.002), .009, 'blackHose'); tube(arc(hU, hL, ra + .03, -.03), .006, 'tube');                // flexible drive shaft and deploy tube
        for (const [k, dr] of [[0, .0], [1, .018], [2, .036]]) tube(arc(sg > 0 ? .35 : 11.65, hU, ra + .02 + dr, -.06 - k * .012), .006, 'tube');   // stow, deploy and return lines from the hinge beam
        const ft = Kt.frame(aid, -1.93, hBot - sg * .1, 1.08);                                                                  // track lock unit on the latch beam
        Kt.box(aid, ft, [0, 0, 0], [.09, .05, .045], 'steel', { round: .006 }); Kt.cyl(aid, ft, [-.06, 0, 0], 'x', .008, .03, 'steel');
        Kt.cyl(aid, ft, [.02, .035, 0], 'y', .009, .02, 'steel'); Kt.connector(aid, ft, [.02, .045, 0], 'y', .007, { lead: 'x' });
        const fv = Kt.frame(aid, -1.72, hBot - sg * .18, 1.07);                                                                 // track lock valve
        Kt.box(aid, fv, [0, 0, 0], [.06, .04, .04], 'castAl', { round: .005 }); Kt.cyl(aid, fv, [0, .03, 0], 'y', .012, .025, 'darkBox'); Kt.connector(aid, fv, [0, .043, 0], 'y', .007, { lead: 'x' });
        for (const z of [-.012, .012]) Kt.fitting(aid, fv, [-.03, 0, z], '-x', .006); }
    }
    /* IFS features: oil tank access door (right, 3 o'clock), AOC window and pressure-relief door (left, 9 o'clock), ACC scoop (right, 1:30) */
    const ifsPanel = (pid, parentDoor, label, info, xx, h, l, w, mat) => { PW.part(pid, { parent: parentDoor, label, info, src: 'p.20-23', attach: PW.parts.get(parentDoor).obj.children[0] }); const a = G.clock(h);
      const m = new THREE.Mesh(G.roundedBox(l, .008, w, .012)); m.position.copy(G.onRing(xx, rIFS(xx) + .002, a)); m.rotation.x = a;
      PW.add(pid, m, mat || 'cowlWhite', { solid: true }); };
    ifsPanel('ifs-otad', 'tr-right', 'Oil tank access door (OTAD)', 'Door in the right IFS at about 2:30, over the oil tank, that gives access to its fill port and sight glass without opening the reverser door (p.21, p.223). Service within the AMM time after shutdown and check the level in the sight glass.', -1.92, 2.4, .26, .22, 'cowlWhite');
    ifsPanel('ifs-pce', 'tr-right', 'Precooler exhaust (PCE) door', 'Door aft of the oil tank access door on the right IFS (p.21).', -2.30, 2.4, .2, .18, 'cowlWhite');
    /* the AOC window sits over the air/oil cooler: ZS 748-779 and 9 to 10:30 o'clock on p.5, mid-length of the IFS on p.23. Curved to the IFS, in three sections */
    { PW.part('ifs-aoc-window', { parent: 'tr-left', label: 'Air/oil cooler window', src: 'p.5, p.20-23', attach: PW.parts.get('tr-left').obj.children[0],
        info: 'Opening in the left IFS at about 9:30 o\'clock (ZS 748 to 779), over the air/oil cooler, in three sections. Fan air enters through the forward section, passes aft through the cooler and leaves through the aft section. The IFS pressure-relief door is aft of it.' });
      const x0 = -1.44, x1 = -2.06, a = G.clock(9.7), half = .33, at = xx => rIFS(xx) + .002;
      PW.add('ifs-aoc-window', G.revolve([[x0, at(x0)], [x1, at(x1)], [x1, at(x1) + .004], [x0, at(x0) + .004]], { seg: 14, thetaStart: a - half, thetaLength: 2 * half }), 'darkBox');
      for (const t of [1 / 3, 2 / 3]) { const xx = x0 + (x1 - x0) * t;
        PW.add('ifs-aoc-window', G.revolve([[xx + .008, at(xx)], [xx - .008, at(xx)], [xx - .008, at(xx) + .008], [xx + .008, at(xx) + .008]], { seg: 14, thetaStart: a - half, thetaLength: 2 * half }), 'cowlWhite'); } }
    ifsPanel('ifs-prd', 'tr-left', 'IFS pressure-relief door', 'Spring-latched door at 9 o\'clock (ZS 795 to 803) that opens at 3.5 psi core compartment overpressure, as after a bleed duct burst. Found open on the walkaround: find out why before flight.', -2.44, 9, .2, .2, 'cowlWhite');
    ifsPanel('ifs-acc-scoop', 'tr-right', 'ACC air scoop', 'Scoop on the right IFS at about 1:30 that takes fan air for the turbine active clearance control.', -1.62, 1.5, .18, .07, 'darkBox');

    /* ============================== PYLON (lower part) ============================== */
    PW.part('pylon', { parent: 'nacelle', label: 'Pylon (lower part)', src: 'TTM ch. 01 Fig. 28, ch. 54; p.44-49',
      info: 'The pylon hangs the engine from the wing on the forward and aft engine mounts, carries the fan cowl hinges and the reverser hinge beams, and routes the fuel, hydraulic, bleed and electrical services. Only its lower part is shown here.' });
    /* widths from the explorer's pylon (measured off a photo from directly below, aircraft X = model x + 5.984), top line from TTM Fig. 28
       and Fig. 23, aft fairing depth below the wing from the explorer's DEP table; the wing itself is not drawn, so the pylon stops at its
       lower surface (about y 1.65 here) */
    { const sh = 5.9844, WID = [[.478, .012], [.6, .03], [.9, .06], [1.245, .10], [1.5, .15], [1.77, .21], [2.15, .29], [2.53, .37], [2.8, .43], [3.05, .48], [3.44, .50], [4.0, .47], [5.0, .46], [6.0, .42], [6.2, .34], [6.3, .24], [6.363, .10]].map(([X, w]) => [X - sh, w]);
      const DEP = [[.478, 0], [1.245, .87], [1.77, 1.08], [2.53, 1.15], [3.05, 1.10]].map(([X, d]) => [X - sh, d]), yWing = 1.66;
      const TOP = [[.379, 1.265], [.016, 1.365], [-.957, 1.475], [-2.48, yWing], [-5.6, yWing]];
      /* underside: 1.125 over the fan case, where the forward mount's beam sits between the mount ring and the pylon (p.45-47); 1.02
         over the core; then the aft fairing down over the exhaust */
      const bot = xx => (xx > -.95 ? 1.125 : xx > -1.05 ? 1.02 + .105 * (xx + 1.05) / .1 : xx > -2.62 ? 1.02 : Math.min(yWing - .01, yWing - G.interp(DEP, xx)));
      const secs = []; for (let i = 0; i <= 60; i++) { const xx = .379 - (5.48 + .379) * Math.pow(i / 60, 1.05);
        secs.push({ x: xx, yb: Math.min(bot(xx), G.interp(TOP, xx) - .03), yt: G.interp(TOP, xx), hw: Math.max(.006, G.interp(WID, xx) / 2) }); }
      PW.add('pylon', G.loft(secs, { n: 40, exp: 6 }), 'whitePaint');
      // aft fairing heat shield: bare metal on the underside over the hot core, about 0.55 m wide (photos)
      const hsSecs = []; for (let i = 0; i <= 24; i++) { const xx = -2.66 - 1.9 * i / 24; hsSecs.push({ x: xx, yb: bot(xx) - .012, yt: bot(xx) + .05, hw: Math.min(.275, G.interp(WID, xx) / 2 + .015) }); }
      PW.add('pylon', G.loft(hsSecs, { n: 32, exp: 8 }), 'bareCowl');
      /* the aft mount fitting: pylon structure from the aft mount's main beam (r 0.64) up into the pylon box (p.45, p.49) */
      { const xa = D.GEN.nacelle.engineAftMountPlane.x, f = PW.kit.frame('pylon', xa, 12, .40); PW.kit.box('pylon', f, [0, .43, 0], [.11, .38, .15], 'greyPrimer', { round: .012 }); }
      /* the access panels on both sides of the aft pylon over the thrust reverser isolation control unit (p.344) */
      for (const s of [-1, 1]) { const hw = G.interp(WID, -2.9) / 2, f = PW.kit.frame('pylon', -2.9, 12, 1.25);
        PW.kit.box('pylon', f, [0, 0, s * (hw + .0005)], [.266, .206, .003], 'darkBox', { round: .002 }); PW.kit.box('pylon', f, [0, 0, s * (hw + .0018)], [.26, .2, .003], 'whitePaint', { round: .012 }); }
    }

    /* the nacelle animation: hinges, sleeves and blocker doors follow the toolbar state; the first part of the explode slider swings
       the fan cowls and reverser doors open as well, before they lift away */
    PW.anim.push(dt => { const k = 1 - Math.exp(-3.5 * dt), s = Math.min(1, Math.max(0, (PW.explodeT || 0) / .12)), ex = s * s * (3 - 2 * s);
      for (const key of ['fan', 'tr', 'sleeve']) S[key] += (S.want[key] - S[key]) * k;
      for (const h of S.hinges) h.obj.rotation.x = h.sign * h.max * Math.max(S[h.axis], ex);
      for (const sl of S.sleeves) sl.position.x = -.48 * S.sleeve;
      S.blockers.forEach(p => { p.rotation.set(p.userData.a, 0, 0); p.rotateZ(deg(62) * S.sleeve); });
    });
    PW.addControl && PW.addControl('Cowls', [
      { label: 'Closed', on: true, apply: () => { S.want.fan = 0; S.want.tr = 0; } },
      { label: 'Fan cowls open', apply: () => { S.want.fan = 1; S.want.tr = 0; } },
      { label: 'All open', apply: () => { S.want.fan = 1; S.want.tr = 1; S.want.sleeve = 0; } }]);
    PW.addControl && PW.addControl('Reverser', [
      { label: 'Stowed', on: true, apply: () => { S.want.sleeve = 0; } },
      { label: 'Deployed', apply: () => { S.want.sleeve = 1; S.want.tr = 0; } }]);
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
    stage('shafts', [off.hpc, -1.0, 0], S4);
    /* the module an outside part sits on: the one whose length covers the middle of the part */
    const carrier = id => { const c = bounds(id, P(id).meshes.length > 0).getCenter(V3()); let best = chain[0], bd = Infinity;
      for (const m of chain) { const [a, b] = span[m], d = c.x < a ? a - c.x : c.x > b ? c.x - b : 0; if (d < bd) { bd = d; best = m; } }
      return off[best]; };

    /* layer 1: the nacelle */
    { const [a] = xr(['inlet']), all = cur + .2 - a; stage('inlet', [1.6, 0, 0], S1); stage('inlet', [all - 1.6, 0, 0], S4); }
    stage('fan-cowl-left', [0, 2.1, -1.5], S1d); stage('fan-cowl-right', [0, 2.1, 1.5], S1d);
    stage('fan-cowl-left', [0, 1.2, -.8], S4); stage('fan-cowl-right', [0, 1.2, .8], S4);                 // higher still once the core spreads out
    for (const [id, s] of [['tr-left', -1], ['tr-right', 1]]) { stage(id, [-.3, 2.0, 2.0 * s], S1d); stage(id, [off.hpc * .6 + .3, 1.2, .8 * s], S4); }
    for (const id of ['pylon', 'precooler', 'tras-control', 'fire']) stage(id, [0, 3.0, 0], S1);
    for (const id of ['fire-left', 'fire-right']) stage(id, [0, -3.0, 0], S1);                     // the core cowl elements stay on their doors
    stage('mounts', [0, 1.5, 0], S1);

    /* layer 2: the dressing */
    stage('eec', radial('eec', .5, 9), S2); stage('phmu', radial('phmu', .5, 9), S2); stage('pdos', radial('pdos', .4, 3), S2);
    const ign = radial('ignition', .45, 8), igs = radial('igniters', .3, 4.5);
    stage('ignition', ign, S2); stage('igniters', [0, igs[1] - ign[1], igs[2] - ign[2]], S2);    // the plugs leave the core, not the fan case
    stage('harnesses', [0, .25, -.3], S2); stage('drain-mast', [0, -.35, 0], S2); stage('fuel', radial('fuel', .3), S2);
    for (const id of ['hpc-bleed-valve', 'bleed-hp', 'buffer-air', 'hpt-cooling', 'tic-cooling', 'tacc', 'cai']) stage(id, radial(id, .3), S2);
    for (const id of P('sensors').children) stage(id, radial(id, .3), S2);
    for (const id of P('borescope').children) stage(id, radial(id, .25), S2);

    /* layer 3: the accessories */
    stage('gearboxes', [0, -1.1, 0], S3);
    stage('oil-tank', radial('oil-tank', .75, 3), S3); stage('aoc', radial('aoc', .8, 10.5), S3);
    stage('vfgoohx', radial('vfgoohx', .65, 9), S3); stage('fohe', radial('fohe', .6, 11.5), S3);

    /* layer 4: dressing and accessories follow the module they sit on; the anti-ice duct, harnesses and fan case units stay */
    stage('gearboxes', [off.hpc, 0, 0], S4); stage('oil', [off.combustor, 0, 0], S4); stage('fuel', [off.combustor, 0, 0], S4); stage('igniters', [off.combustor, 0, 0], S4);
    for (const id of ['hpc-sva', 'lpc-sva', 'bleed-25', 'hpc-bleed-valve', 'bleed-hp', 'buffer-air', 'hpt-cooling', 'tic-cooling', 'tacc', 'drain-mast'].concat(P('sensors').children, P('borescope').children))
      stage(id, [carrier(id), 0, 0], S4);
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
