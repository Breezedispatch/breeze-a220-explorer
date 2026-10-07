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
      onBarrel('inlet-p2t2-panel', 'P2T2 probe access panel', 'Access panel at 11 o\'clock over the P2T2 probe, its sense line and harness.', xHL - .45, 11, .16, .22);
      onBarrel('inlet-cai-panel', 'Cowl anti-ice duct access panel', 'Access panel at 5 o\'clock over the cowl anti-ice duct where it enters the inlet.', xJ1 + .25, 5, .16, .24);
      { PW.part('inlet-naca', { parent: 'inlet', label: 'NACA scoop', src: 'p.10', info: 'Flush NACA-type air scoop at 1 o\'clock near the front of the outer barrel, ventilating the space inside the inlet cowl.' });
        const a = G.clock(1), xx = xHL - .32, m = new THREE.Mesh(G.roundedBox(.16, .02, .07, .008)); m.position.copy(G.onRing(xx, rOut(xx) - .006, a)); m.rotation.x = a; PW.add('inlet-naca', m, 'darkBox', { solid: true }); }
      { PW.part('inlet-ai-exhaust', { parent: 'inlet', label: 'Cowl anti-ice exhaust slots', src: 'p.10-11', info: 'Slots at the bottom of the outer barrel, near the 5 o\'clock access panel, where the anti-ice air leaves the lip D-duct.' });
        for (let i = 0; i < 6; i++) { const a = G.clock(5.4) + i * .045, xx = xHL - .26; const m = new THREE.Mesh(G.roundedBox(.11, .006, .016, .004)); m.position.copy(G.onRing(xx, rOut(xx) + .0005, a)); m.rotation.x = a; PW.add('inlet-ai-exhaust', m, 'darkBox', { solid: true }); } }
      { PW.part('inlet-p2t2', { parent: 'inlet', label: 'P2T2 probe', src: 'p.10, p.102-107', info: 'Fan inlet pressure and temperature probe on the inner barrel at 11 o\'clock. The EEC uses it for thrust setting and the probe is heated.' });
        const a = G.clock(11), xx = xHL - .45, m = new THREE.Mesh(G.roundedBox(.04, .07, .02, .006)); m.position.copy(G.onRing(xx, G.interp(ib, xx) - .03, a)); m.rotation.x = a; PW.add('inlet-p2t2', m, 'steel', { solid: true }); }
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
      PW.add(pid, G.revolve(outer.concat(inner.slice().reverse()), { seg: 72, thetaStart: t0, thetaLength: tl }), 'nacellePaint', { into: hinge });
      PW.add(pid, G.revolve(inner.map(([xx, r]) => [xx, r]).concat(inner.map(([xx, r]) => [xx, r - .003]).reverse()), { seg: 72, thetaStart: t0, thetaLength: tl }), 'cowlWhite', { into: hinge });
      for (const xx of [xJ1 - .03, (xJ1 + xJ2) / 2, xJ2 + .03]) PW.add(pid, G.revolve([[xx + .015, rOut(xx) - .03], [xx - .015, rOut(xx) - .03], [xx - .015, rOut(xx) - .075], [xx + .015, rOut(xx) - .075]], { seg: 72, thetaStart: t0, thetaLength: tl }), 'lime', { into: hinge });   // frames
      // three latches at the bottom edge (keepers on the right cowl, hooks on the left), three hinges at the top
      for (const f of [.2, .5, .8]) { const xx = xJ1 + (xJ2 - xJ1) * f, a = t0 + (sg > 0 ? tl : 0), m = new THREE.Mesh(G.roundedBox(.12, .02, .03, .005));
        m.position.copy(G.onRing(xx, rOut(xx) - .012, a)); m.rotation.x = a; PW.add(pid, m, sg < 0 ? 'darkBox' : 'steel', { solid: true, into: hinge });
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
      info: 'Two C-duct doors, left and right, hinged at the pylon hinge beam and latched together at the bottom. Each door carries its translating sleeve, fixed cascade segments, blocker doors and three hydraulic actuators, and its half of the inner fixed structure (IFS) that encloses the core.\n\nIn reverse the sleeves move aft to uncover the cascades and the blocker doors swing into the fan duct, turning the fan air forward. The core stream is not reversed. The doors are opened for core access with the power door opening system or a hand pump; an inoperative reverser can be locked out for dispatch under the MEL.' });
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
      /* inner structure (IFS, fan duct outer wall, forward frame) stops 4 deg either side of 6 o'clock for the lower bifurcation */
      const it0 = sg > 0 ? t0 : Math.PI + deg(4), itl = Math.PI - deg(14);
      const rev = (prof, mat, o) => PW.add(o && o.pid || pid, G.revolve(prof, { seg: 72, thetaStart: o && o.inner ? it0 : t0, thetaLength: o && o.inner ? itl : tl }), mat, Object.assign({ into: hinge }, o || {}));
      /* outer fixed cowl (ZS 732 to 772) */
      const fo = []; for (let i = 0; i <= 10; i++) { const xx = xJ2 - .002 + (xSF - xJ2 + .002) * i / 10; fo.push([xx, rOut(xx)]); }
      rev(G.shellProfile(fo, fo.map(([xx, r]) => [xx, r - .02])), 'nacellePaint');
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
        info: 'The outer aft cowl of the door. Three hydraulic actuators (the upper one locking, with feedback) move it aft to uncover the cascades; a flexible shaft keeps them in step and a track lock holds it stowed. Its inner wall carries the blocker doors.' });
      const sl = PW.parts.get(sid).obj; S.sleeves.push(sl);
      const so = []; for (let i = 0; i <= 10; i++) { const xx = xSF + (xTE - xSF) * i / 10; so.push([xx, rOut(xx)]); }
      const si = so.map(([xx, r]) => [xx, Math.min(r - .015, rDuct(xx) + .055 * (1 - Math.pow((xx - xSF) / (xTE - xSF), 1.6)))]);
      PW.add(sid, G.revolve(G.shellProfile(so, si), { seg: 72, thetaStart: t0, thetaLength: tl }), 'nacellePaint');
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
      /* the IFS halves stop 4 deg either side of 6 o'clock as far aft as the bifurcation walls go: the lower bifurcation between them
         (about 8 cm wide at the core) carries the ignition cables, the core harnesses, the cowl anti-ice duct and the drain mast across
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
      // latch beam latches (5) at the bottom, hinge beam at the top
      for (let i = 0; i < 5; i++) { const xx = -1.05 - i * .32, a = sg > 0 ? t0 + tl : t0, m = new THREE.Mesh(G.roundedBox(.10, .03, .03, .006)); m.position.copy(G.onRing(xx, rOut(xx) - .03, a)); m.rotation.x = a; PW.add(pid, m, 'steel', { solid: true, into: hinge }); }
      { const a = sg > 0 ? t0 : t0 + tl, m = new THREE.Mesh(G.roundedBox(1.5, .05, .04, .01)); m.position.copy(G.onRing(-1.75, yhT + .03, a)); m.rotation.x = a; PW.add(pid, m, 'nickel', { solid: true, into: hinge }); }
      // three actuators on the forward frame: upper locking actuator and two lower ones, with the flexible synchronising shaft
      for (const h of [1.6, 3.0, 4.4]) { const a = sg > 0 ? G.clock(h) : G.clock(12 - h), act = G.rod(G.onRing(xJ2 - .07, 1.04, a), G.onRing(xSF - .02, 1.04, a), .02);
        PW.add(pid, act, 'steel', { into: hinge }); }
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
      const bot = xx => (xx > -2.62 ? 1.02 : Math.min(yWing - .01, yWing - G.interp(DEP, xx)));
      const secs = []; for (let i = 0; i <= 60; i++) { const xx = .379 - (5.48 + .379) * Math.pow(i / 60, 1.05);
        secs.push({ x: xx, yb: Math.min(bot(xx), G.interp(TOP, xx) - .03), yt: G.interp(TOP, xx), hw: Math.max(.006, G.interp(WID, xx) / 2) }); }
      PW.add('pylon', G.loft(secs, { n: 40, exp: 6 }), 'whitePaint');
      // aft fairing heat shield: bare metal on the underside over the hot core, about 0.55 m wide (photos)
      const hsSecs = []; for (let i = 0; i <= 24; i++) { const xx = -2.66 - 1.9 * i / 24; hsSecs.push({ x: xx, yb: bot(xx) - .012, yt: bot(xx) + .05, hw: Math.min(.275, G.interp(WID, xx) / 2 + .015) }); }
      PW.add('pylon', G.loft(hsSecs, { n: 32, exp: 8 }), 'bareCowl');
    }

    /* the nacelle animation: hinges, sleeves and blocker doors follow the toolbar state */
    PW.anim.push(dt => { const k = 1 - Math.exp(-3.5 * dt);
      for (const key of ['fan', 'tr', 'sleeve']) S[key] += (S.want[key] - S[key]) * k;
      for (const h of S.hinges) h.obj.rotation.x = h.sign * h.max * S[h.axis];
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

  /* ---- the exploded view: the manual's module breakdown (p.54-55) laid out along the axis ----
     Runs after every builder. Each module's real length is measured and the modules are spaced in order with even gaps: forward of
     the fan case the FDGS, the fan rotor and the inlet cone; aft of it the FIC, LPC, CIC, HPC, diffuser and combustor, HPT, TIC,
     LPT, TEC and exhaust. Gearboxes drop below, the oil system moves out to the right, the nacelle opens out round the engine, and
     dressing that spans modules is put away. */
  PW.builders.push(function explodePlan() {
    const P = id => PW.parts.get(id), set = (id, v, hide) => { const p = P(id); if (!p) return; if (v) p.explode.set(...v); if (hide) p.explodeHide = true; };
    const xr = ids => { const b = new THREE.Box3(); PW.root.updateMatrixWorld(true); for (const id of ids) for (const m of PW.meshesOf(id)) b.expandByObject(m); return [b.min.x, b.max.x]; };
    const GAP = .25, off = {}; set('fan-case', [0, 0, 0]);
    const fc = xr(['fan-case']);
    /* aft chain */
    let cur = fc[0] - GAP;
    for (const id of ['fic', 'lpc', 'cic', 'hpc', 'combustor', 'hpt', 'tic', 'lpt', 'tec', 'exhaust']) { if (!P(id)) continue;
      const [a, b] = xr([id]); off[id] = cur - b; cur = a + off[id] - GAP; set(id, [off[id], 0, 0]); }
    /* forward chain: FDGS, then the fan rotor (blades and hub), then the inlet cone, which hangs on the rotor */
    cur = fc[1] + GAP;
    { const [a, b] = xr(['fdgs']); off.fdgs = cur - a; cur = b + off.fdgs + GAP; set('fdgs', [off.fdgs, 0, 0]); }
    { const [a, b] = xr(['fan-blades', 'fan-hub']); off.fan = cur - a; cur = b + off.fan + GAP; set('fan-rotor', [off.fan, 0, 0]); }
    { const [a, b] = xr(['inlet-cone']); const o = cur - a; cur = b + o + GAP; set('inlet-cone', [o - off.fan, 0, 0]); }
    /* the nacelle opens out: inlet ahead of everything, fan cowls up and out, reverser doors out beside the core, pylon up */
    { const [a] = xr(['inlet']); set('inlet', [cur + .2 - a, 0, 0]); }
    set('fan-cowl-left', [0, .6, -1.5]); set('fan-cowl-right', [0, .6, 1.5]);
    set('tr-left', [off.hpc * .6, .35, -1.8]); set('tr-right', [off.hpc * .6, .35, 1.8]); set('pylon', [0, 1.9, 0]);
    /* each bearing with the case that carries it; the shafts below the line */
    for (const [b, m] of [['bearing-1', 'fdgs'], ['bearing-1-5', 'fdgs'], ['bearing-2', 'lpc'], ['bearing-3', 'cic'], ['bearing-4', 'tic'], ['bearing-5', 'lpt'], ['bearing-6', 'tec']]) set(b, [off[m] || 0, 0, 0]);
    set('shafts', [off.hpc, -1.0, 0]);
    /* gearboxes and accessories below; oil system out to the right with the air/oil cooler kept on the left */
    set('gearboxes', [off.hpc, -1.3, 0]); set('oil', [off.combustor, 0, 1.15]); set('aoc', [0, 0, -2.3]);
    set('fuel', [off.combustor, 0, 0]); set('igniters', [off.combustor, 0, .35]);
    /* air system parts stay with their cases; the precooler rises with the pylon */
    set('air', [0, 0, 0]); set('hpc-sva', [off.hpc, 0, 0]); set('lpc-sva', [off.lpc, 0, 0]); set('bleed-25', [off.cic, 0, 0]); set('bleed-hp', [off.hpc, 0, 0]);
    set('precooler', [off.hpc, 1.4, 0]); set('tacc', null, true); set('cai', null, true);
    /* units on the fan case move out from it a little */
    set('eec', [0, 0, -.45]); set('phmu', [0, .25, -.25]); set('ignition', [0, 0, -.35]); set('pdos', [0, .25, .3]);
    for (const id of ['harnesses', 'sensors', 'fire', 'fire-left', 'fire-right', 'mounts', 'drain-mast']) set(id, [0, 0, 0], true);
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
