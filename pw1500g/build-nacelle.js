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
  /* rods between a door and the engine that follow the door (opening actuators, hold-open rods): straight sections re-aimed every frame
     between two ends, telescoping as the distance changes; the first section starts at end a, the last finishes at end b. ends()
     returns both ends in the group's own frame. Optional eyes: a ball of that radius at each end */
  function strut(pid, into, secs, ends, eyes) {
    const g = new THREE.Group(), Y = new THREE.Vector3(0, 1, 0); into.add(g);
    const ms = secs.map(([r, len, mat]) => { const m = PW.add(pid, new THREE.CylinderGeometry(r, r, len, 14), mat, { into: g, solid: true }); m.userData.len = len; return m; });
    const es = eyes ? [0, 1].map(() => PW.add(pid, new THREE.SphereGeometry(eyes, 14, 10), 'steel', { into: g, solid: true })) : [];
    const st = { g, ms, ends, update() { const [a, b] = st.ends(), d = b.clone().sub(a), L = d.length() || 1; d.multiplyScalar(1 / L);
      const q = new THREE.Quaternion().setFromUnitVectors(Y, d), n = ms.length;
      ms.forEach((m, i) => { const l = m.userData.len, t = n === 1 ? .5 : i / (n - 1); m.position.copy(a).addScaledVector(d, l / 2 + (L - l) * t); m.quaternion.copy(q); });
      if (es.length) { es[0].position.copy(a); es[1].position.copy(b); } } };
    S.struts.push(st); st.update(); return st;
  }
  /* a point given in a door's closed position, turned with the door about its hinge line (y, z = h.py, h.pz), and back. Explode offsets
     are left out, so a strut on the engine side stays with the engine when the doors lift away */
  const rotX = (v, ang, py, pz) => { const c = Math.cos(ang), s = Math.sin(ang), y = v.y - py, z = v.z - pz; return new THREE.Vector3(v.x, py + y * c - z * s, pz + y * s + z * c); };
  const doorOut = (h, p) => rotX(p, h.obj.rotation.x, h.py, h.pz), doorIn = (h, q) => rotX(q, -h.obj.rotation.x, h.py, h.pz);
  const opened = h => Math.max(0, Math.min(1, h.obj.rotation.x / (h.sign * h.max)));
  const ease01 = s => (s <= 0 ? 0 : s >= 1 ? 1 : s * s * (3 - 2 * s));
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
    const xHL = x(Z.inletHighlight), xJ1 = x(Z.inletFanCowl), xJ2 = x(Z.fanCowlTR), xTE = x(Z.sleeveTE), xCN = D.GEN.nacelle.coreNozzleExit.x;
    const fA = D.GEN.flanges.find(f => /^A /.test(f.name));
    PW.NACELLE_IDS = ['inlet', 'fan-cowls', 'thrust-reverser', 'pylon'];
    PW.part('nacelle', { label: 'Nacelle and pylon', src: 'Delta CH 70-80 p.8-49; TTM ch. 01, 54, 71, 78',
      info: 'The nacelle is the inlet cowl, two fan cowl doors and two thrust reverser doors. The reverser doors also carry the inner fixed structure that encloses the core. All hang from the pylon.\n\nUse the Cowls control to open the fan cowls and reverser doors as they are opened for maintenance.' });

    /* ============================== INLET ============================== */
    PW.part('inlet', { parent: 'nacelle', label: 'Inlet cowl', explode: [1.0, 0, 0], src: 'p.8-11; TTM ch. 01 Fig. 28; ch. 30; photos',
      info: 'Directs the airflow to the fan in all conditions and reduces noise (p.8, p.10). It is bolted to the front flange of the engine (fan case flange A) at its attachment ring. The inner barrel is titanium and composite with 360 degrees of acoustic treatment; the outer barrel is a two-piece composite structure from the lip skin to the leading edge of the fan cowl, with a copper screen in it for lightning strike protection. The lip is anti-iced by bleed air from a piccolo tube inside it, and the air is exhausted through slots at the bottom of the cowl. Its lower lip sits about 2 in aft of the upper lip (scarf).\n\nOn the outer barrel: the NACA scoop at 1 o\'clock for fan compartment cooling, the P2T2 access panel at 11 o\'clock, the cowl anti-ice duct access panel at 5 o\'clock, the hoist points on its joint lines for removing the cowl with the inlet cowl sling, and drain holes at the bottom; more drain holes in the core of the inner barrel let fluids out.' });
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
      { PW.part('inlet-naca', { parent: 'inlet', label: 'NACA scoop', src: 'p.10', info: 'Flush NACA-type air scoop at 1 o\'clock near the front of the outer barrel, used for fan compartment cooling (p.10).' });
        const a = G.clock(1), xx = xHL - .32, m = new THREE.Mesh(G.roundedBox(.16, .02, .07, .008)); m.position.copy(G.onRing(xx, rOut(xx) - .006, a)); m.rotation.x = a; PW.add('inlet-naca', m, 'darkBox', { solid: true }); }
      { PW.part('inlet-ai-exhaust', { parent: 'inlet', label: 'Cowl anti-ice exhaust louvers', src: 'p.10-11', info: 'A row of louvers in the bottom of the outer barrel, along the forward edge of the 5 o\'clock cowl anti-ice duct access panel (p.11), where the anti-ice air is exhausted after heating the lip.' });
        for (let i = 0; i < 5; i++) { const a = G.clock(4.75 + i * .125), xx = xJ1 + .25 + .14; const m = new THREE.Mesh(G.roundedBox(.07, .006, .018, .005)); m.position.copy(G.onRing(xx, rOut(xx) + .0005, a)); m.rotation.x = a; PW.add('inlet-ai-exhaust', m, 'darkBox', { solid: true }); } }
      /* p.10-11: drain holes in the bottom of the outer barrel beside the anti-ice access panel; the hoist points for the inlet cowl sling
         on the outer barrel's joint lines (it is a two-piece structure), at the forward and aft ends of each joint */
      { const Kt = PW.kit;
        for (const xx of [xJ1 + .2, xJ1 + .25, xJ1 + .3]) Kt.cyl('inlet-outer-barrel', Kt.frame('inlet-outer-barrel', xx, 5.62, rOut(xx)), [0, .0004, 0], 'y', .005, .0012, 'darkBox');
        for (const h of [2.0, 8.0]) { PW.add('inlet-outer-barrel', G.revolve([[xJ1 + .005, rOut(xJ1 + .005) + .0004], [xHL - .3, rOut(xHL - .3) + .0004], [xHL - .3, rOut(xHL - .3) - .001], [xJ1 + .005, rOut(xJ1 + .005) - .001]], { seg: 1, thetaStart: G.clock(h) - .0015, thetaLength: .003 }), 'darkBox');   // joint line
          for (const xx of [xJ1 + .03, xHL - .45]) { const f = Kt.frame('inlet-outer-barrel', xx, h, rOut(xx));
            Kt.box('inlet-outer-barrel', f, [0, .0004, 0], [.05, .0012, .03], 'greyPrimer', { round: .005 }); Kt.cyl('inlet-outer-barrel', f, [0, .0012, 0], 'y', .006, .0012, 'darkBox'); } } }
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
      info: 'Two carbon fibre (CFRP) doors between the inlet cowl and the thrust reverser, stiffened with radial stiffeners and longerons, with copper mesh in the laminate for lightning protection. Each hangs from the pylon\'s fan cowl support beam on three hinges, whose pins are held by retaining clips; pulling the pins frees the cowl for removal with the ground handling sling on its three hoist points. Wear strips keep the joints between the cowls smooth.\n\nThe cowls latch together at the bottom centreline with three flush latches, L1 forward to L3 aft, opened and closed in the order L1, L3, L2: push the trigger to release the handle, pull the handle down and lift the hook off the eye-bolt of its keeper. When they are properly closed the handles are flush and their red marks do not show; alignment pins beside the latches line the cowls up. An unlatched fan cowl can depart in flight.\n\nEach door weighs more than 100 lb (45 kg), so two people open it. Do not open a fan cowl in wind above 60 mph (96 km/h), and take care above 46 mph (74 km/h). Lifting it more than 55 degrees can damage the door or the pylon. Two hold-open rods on each door hold it open: the forward rod goes to the forward HOR bracket on the fan case, the aft rod to the door opening system (PDOS) bracket (p.12-15).' });
    const yh = 1.18;                                                   // hinge line height, just under the pylon
    for (const side of ['left', 'right']) {
      const sg = side === 'right' ? 1 : -1, pid = `fan-cowl-${side}`;
      PW.part(pid, { parent: 'fan-cowls', label: `${side === 'left' ? 'Left (inboard)' : 'Right (outboard)'} fan cowl`, src: 'p.12-15; photos',
        info: (side === 'left' ? 'Inboard fan cowl on this right-hand engine. It carries the removable strake, which decreases the turbulence from the airflow between the fan cowl and the fuselage (p.8; inboard cowls only). Its latches hook onto the keepers on the outboard cowl, and its two hold-open rods stow along its bottom.' : 'Outboard fan cowl on this right-hand engine. The panel high on its side is the pressure-relief door, which relieves high pressure in the fan compartment if a duct fails (p.12). It carries the latch keepers with their alignment pins, and its two hold-open rods stow low along its side, under the cowl anti-ice duct.') + ' The three plates are its hoist points, each with two screw holes for the ground handling sling, and the drain holes near the bottom split line let fluid out of the fan compartment. White inside with lime-green frames.' });
      const obj = PW.parts.get(pid).obj, hinge = new THREE.Group(); obj.add(hinge); obj.position.set(0, yh, sg * .21); hinge.position.set(0, -yh, -sg * .21);
      const hc = { obj, axis: 'fan', sign: -sg, max: deg(55), py: yh, pz: sg * .21 }; S.hinges.push(hc);
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
      /* two hold-open rods per cowl (p.12-15). Each pivots on a bracket near the cowl's lower edge; with the cowl shut it lies in stow
         brackets along the inside of the cowl's lower part, as p.15 view A draws them, the one with its free end forward resting in the
         hold-open rod clip. As the cowl comes up past about 60 % of its travel they go on their fittings on the fan case: the forward HOR
         bracket, and the door opening system (PDOS) bracket at the aft end of the case (p.14). The model draws them as two-diameter
         telescopic rods (the p.13 detail shows two diameters), stowed in the forward part of the cowl clear of the ignition cables and
         harnesses that cross the bottom of the fan case near its aft end. (p.13 draws the outboard cowl's rods rising up its side, but on
         this No. 2 engine the cowl anti-ice duct runs along the fan case at 5 o'clock under that cowl, so here they lie low, below it) */
      { const Kt = PW.kit, rr = xx => rOut(xx) - .095, Pc = (xx, th) => G.onRing(xx, rr(xx), sg > 0 ? deg(th) : TAU - deg(th));
        const full = p => rotX(p, hc.sign * hc.max, hc.py, hc.pz);
        /* [pivot, stowed free end, fan case fitting] */
        const RODS = sg > 0 ? [[Pc(.30, 168.5), Pc(-.45, 166), G.onRing(.30, .99, G.clock(3.1))], [Pc(-.62, 163), Pc(.20, 160), G.onRing(-.84, 1.062, G.clock(3.75))]]
          : [[Pc(.30, 167.5), Pc(-.45, 167), G.onRing(.30, .99, G.clock(9.3))], [Pc(-.62, 164.5), Pc(.20, 164), G.onRing(-.84, 1.062, G.clock(8.25))]];
        RODS.forEach(([pv, sw, fit], k) => {
          const Ls = pv.distanceTo(sw), Ld = full(pv).distanceTo(fit), n = 2 * Ls * .96 >= Ld + .06 ? 2 : 3, l = Math.min(Ls * .96, (Ld + .08) / n + .04);
          for (const [p, nm] of [[pv, 'pivot'], [sw.clone().lerp(pv, .04), 'stow'], [pv.clone().lerp(sw, .5), 'mid']]) {
            const a = Math.atan2(p.z, p.y), r = Math.hypot(p.y, p.z), f = Kt.frame(pid, p.x, a / (Math.PI / 6), r, { into: hinge }), hgt = rOut(p.x) - .031 - r;
            Kt.box(pid, f, [0, hgt / 2, 0], nm === 'pivot' ? [.05, hgt, .045] : [.026, hgt, .03], k === 1 && nm === 'stow' ? 'darkBox' : 'greyPrimer', { round: .004 }); }   // pivot bracket, stow brackets (the clip at the forward free end)
          if (k === 0) { const f = Kt.frame('fan-case-shell', fit.x, Math.atan2(fit.z, fit.y) / (Math.PI / 6), .969);                         // the forward HOR bracket on the fan case
            Kt.box('fan-case-shell', f, [0, .011, 0], [.04, .022, .035], 'darkBox', { round: .004 }); Kt.cyl('fan-case-shell', f, [0, .021, 0], 'x', .006, .045, 'steel'); }
          strut(pid, hinge, [[.013, l, 'steel'], [.0105, l, 'steel'], [.008, l, 'steel']].slice(0, n), () => { const w = ease01((opened(hc) - .6) / .4); return [pv, w > 0 ? sw.clone().lerp(doorIn(hc, fit), w) : sw]; }, .016); }); }
      /* p.12-13: three hoist points on each cowl, each a doubler with two screw holes for the ground handling sling (two on the side,
         forward and aft, one low and aft); drain holes near the bottom split line; on the outboard cowl the pressure-relief door, a third
         of the way down from the hinges and mid-length, between the stiffeners, which relieves the fan compartment if a duct fails; wear
         strips round the forward and aft edges; the hinge pins with their retaining clips; and on the keeper side the alignment pins that
         enter holes beside the latches as the cowls close (p.14-15) */
      { const Kt = PW.kit, hs = c => sg > 0 ? c : 12 - c, fx = f => xJ1 + (xJ2 - xJ1) * f;
        for (const [f, h] of [[.3, 3.9], [.7, 3.9], [.6, 5.3]]) { const xx = fx(f), g = Kt.frame(pid, xx, hs(h), rOut(xx), { into: hinge });
          Kt.box(pid, g, [0, .0004, 0], [.046, .0012, .116], 'darkBox', { round: .006 }); Kt.box(pid, g, [0, .0011, 0], [.04, .0012, .11], 'greyPrimer', { round: .006 });
          for (const s of [-1, 1]) Kt.cyl(pid, g, [0, .0016, s * .03], 'y', .0065, .0012, 'darkBox'); }
        for (const f of [.22, .5, .78]) { const xx = fx(f), g = Kt.frame(pid, xx, hs(5.9), rOut(xx), { into: hinge });
          Kt.cyl(pid, g, [0, .0004, 0], 'y', .0045, .0012, 'darkBox'); }
        if (sg > 0) { const xx = fx(.45), g = Kt.frame(pid, xx, 2.4, rOut(xx), { into: hinge });
          Kt.box(pid, g, [0, .0004, 0], [.266, .0012, .306], 'darkBox', { round: .02 }); Kt.box(pid, g, [0, .0011, 0], [.26, .0012, .3], 'nacellePaint', { round: .02 });
          for (let i = 0; i < 22; i++) { const t = i / 22 * TAU, c = Math.cos(t), s = Math.sin(t);
            Kt.hex(pid, g, [Math.sign(c) * Math.min(1, Math.abs(c) * 1.5) * .118, .0017, Math.sign(s) * Math.min(1, Math.abs(s) * 1.5) * .138], 'y', .003, .001, 'steel'); } }
        for (const xx of [xJ1 - .004, xJ2 + .004]) PW.add(pid, G.revolve([[xx + .012, rOut(xx) - .028], [xx - .012, rOut(xx) - .028], [xx - .012, rOut(xx) - .033], [xx + .012, rOut(xx) - .033]], { seg: 72, thetaStart: t0, thetaLength: tl }), 'rubber', { into: hinge });   // wear strips
        for (const f of [.2, .5, .8]) { const xx = fx(f);
          Kt.cyl(pid, Kt.frame(pid, xx, 0, 1, { into: hinge }), [0, yh - .02 - 1, sg * .22], 'x', .007, .1, 'steel');                     // hinge pin through the hinge
          if (sg > 0) { const g = Kt.frame(pid, xx + .075, hs(5.97), rOut(xx) - .045, { into: hinge }); Kt.cyl(pid, g, [0, 0, .006], 'z', .006, .024, 'steel'); Kt.cone(pid, g, [0, 0, .026], 'z', .002, .006, .016, 'steel'); } } }
    }
    { // strake on the inboard (left) cowl, about 30 deg above the horizontal (10 o'clock), about 36 in long
      const a = G.clock(10), xa = xJ1 - .25, xb = xa - .91, h = .14, p = PW.parts.get('fan-cowl-left').obj.children[0];
      const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(-.91, 0); sh.lineTo(-.82, h * .55); sh.lineTo(-.12, h); sh.lineTo(0, 0);
      const g = new THREE.ExtrudeGeometry(sh, { depth: .008, bevelEnabled: false }); g.translate(0, 0, -.004);
      const m = new THREE.Mesh(g); m.position.copy(G.onRing(xa, rOut(xa) - .002, a)); m.rotation.x = a; m.rotateZ(0); PW.add('fan-cowl-left', m, 'nacellePaint', { solid: true, into: p });
    }

    /* ============================== THRUST REVERSER DOORS ============================== */
    PW.part('thrust-reverser', { parent: 'nacelle', label: 'Thrust reverser doors', src: 'p.18-43, p.324-379; TTM ch. 78',
      info: 'Two C-duct doors, left and right, hinged at the pylon hinge beam and latched together at the bottom. Each carries its translating sleeve, eight carbon fibre cascade boxes, five blocker doors, two hydraulic actuators on the torque box at its forward end, and its half of the inner fixed structure (IFS) that encloses the core.\n\nThe actuation is electrically controlled and hydraulically worked (from hydraulic system No. 1 on the left engine). The EEC opens the isolation control unit (ICU) in the aft pylon and the directional control unit (DCU) in the forward pylon; the CDCs open the track lock valves. In reverse the sleeves move aft to uncover the cascades and the blocker doors swing into the fan duct, turning the fan air forward; the core stream is not reversed. A white REV icon shows in transit, green when deployed, amber for a fault.\n\nFor dispatch with a reverser inoperative, and for safety during maintenance, the manual inhibit lever on the ICU isolates the system and is locked by the inhibit pin stored on the ICU. For dispatch, a lockout pin from the latch access bay then pins each sleeve to its latch beam (p.372-375).' });
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
      const hd = { obj, axis: 'tr', sign: -sg, max: deg(45), py: yhT + .2, pz: sg * .2 }; S.hinges.push(hd);
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
      /* the fan duct outer wall under the torque box, and the torque box itself (the forward frame with the V-blade): fixed */
      const dw = []; for (let i = 0; i <= 4; i++) { const xx = -.93 + (xTB + .003 + .93) * i / 4; dw.push([xx, rDuct(xx)]); }
      rev(G.shellProfile(dw.map(([xx, r]) => [xx, r + .012]), dw), 'cowlWhite', { inner: true });
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
        info: 'The whole outer cowl of the reverser door, from the fan cowl back to the trailing edge, which slides 0.53 m aft to deploy. Stowed, it covers the cascades in a cavity in its forward part. Two hydraulic actuators on the torque box move it: the locking feedback actuator in the upper section, whose LVDT reports its position, and the locking actuator in the lower section, kept in step by a flexible drive shaft; their rod ends are reached through the two access panels on its skin. A track lock unit on the latch beam holds it stowed.\n\nIts inner wall carries five composite blocker doors, hinged at their forward edge on clevises in the wall. As the sleeve moves aft, each door\'s drag link pulls it down across the fan duct behind the cascades, so the fan air goes out through them. The upper and lower doors are unique to their positions; drain holes stop water collecting in them, and rest pads damp them when stowed.\n\nA small blanking plate on its lower edge near the front covers the hole for the reverser lockout pin.' });
      const sl = PW.parts.get(sid).obj; S.sleeves.push(sl);
      { const SP = Object.assign({ seg: 72 }, span(10, 174)), so = [], sa = [], sw = [];
        for (let i = 0; i <= 14; i++) { const xx = xJ2 - .002 + (xBH - xJ2 + .002) * i / 14; so.push([xx, rOut(xx)]); }
        PW.add(sid, G.revolve(G.shellProfile(so, so.map(([xx, r]) => [xx, r - .018])), SP), 'nacellePaint');                                       // outer skin over the cavity
        for (let i = 0; i <= 10; i++) { const xx = xBH + (xTE - xBH) * i / 10; sa.push([xx, rOut(xx)]); }
        PW.add(sid, G.revolve(G.shellProfile(sa, sa.map(([xx]) => [xx, rDuct(xx) + .004])), SP), 'nacellePaint');                                 // aft body to the trailing edge
        PW.add(sid, G.revolve([[xBH + .001, rDuct(xBH) + .004], [xBH - .009, rDuct(xBH) + .004], [xBH - .009, rOut(xBH) - .018], [xBH + .001, rOut(xBH) - .018]], SP), 'greyPrimer');   // cavity aft wall
        for (let i = 0; i <= 12; i++) { const xx = xSI + (xTE - xSI) * i / 12; sw.push([xx, rDuct(xx) + .004]); }
        PW.add(sid, G.revolve(G.shellProfile(sw, sw.map(([xx, r]) => [xx, r - .004])), SP), 'cowlWhite');                                         // inner wall: the duct's outer wall
        PW.add(sid, G.revolve([[xSk + .002, rOut(xSk) + .0004], [xSk - .002, rOut(xSk) + .0004], [xSk - .002, rOut(xSk) - .002], [xSk + .002, rOut(xSk) - .002]], SP), 'darkBox');   // skin joint, ZS 771
        /* TTM 78 fig. 3: an access panel over each actuator's rod end */
        for (const th of [45, 135]) { const xx = xBH + .04, f = PW.kit.frame(sid, xx, hOf(th), rOut(xx));
          PW.kit.box(sid, f, [0, .0004, 0], [.206, .0012, .146], 'darkBox', { round: .02 }); PW.kit.box(sid, f, [0, .0011, 0], [.2, .0012, .14], 'nacellePaint', { round: .02 });
          for (let i = 0; i < 12; i++) { const t = i / 12 * TAU, c = Math.cos(t), s = Math.sin(t);
            PW.kit.hex(sid, f, [Math.sign(c) * Math.min(1, Math.abs(c) * 1.6) * .088, .0017, Math.sign(s) * Math.min(1, Math.abs(s) * 1.6) * .058], 'y', .0028, .001, 'steel'); } } }
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
      { const fb = PW.kit.frame(sid, xJ2 - .10, hOf(173.4), rOut(xJ2 - .10));
        PW.kit.box(sid, fb, [0, .0008, 0], [.036, .0016, .024], 'greyPrimer', { round: .008 });
        for (const s of [-1, 1]) PW.kit.hex(sid, fb, [s * .011, .0021, 0], 'y', .0024, .0012, 'steel'); }
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
      /* p.20-23: three core scoop vents on each IFS half, small scoops in the fan stream that ram air into the core compartment to
         ventilate it; positions measured off p.23 (fraction of the IFS length, clock) */
      { const L0 = xI0, L1 = xTE - .02;
        for (const [f, h] of sg > 0 ? [[.08, 2.53], [.12, 3.42], [.44, 3.27]] : [[.08, 9.0], [.07, 7.37], [.38, 7.25]]) {
          const xx = L0 + (L1 - L0) * f, fv = PW.kit.frame(iid, xx, h, rIFS(xx));
          PW.kit.box(iid, fv, [-.004, .006, 0], [.07, .012, .042], 'cowlWhite', { round: .006 });                                     // the hood
          PW.kit.box(iid, fv, [.031, .0065, 0], [.004, .008, .03], 'darkBox', { round: .002 }); } }                                  // its mouth, facing forward
      /* TTM p.268-269: two fire detection elements on each core cowl, forward and aft, each a pair of sensing tubes (loops A and B)
         clipped to the blanket and running round the core; they open with the door. On the right the aft pair runs just aft of the oil
         tank, clear of the oil tank access door */
      if (PW.parts.has('fire')) { const fid = `fire-${side}`;
        PW.part(fid, { parent: 'fire', label: `Fire detection elements, ${side} core cowl`, attach: hinge, src: 'TTM ch. 26 (p.268-269)',
          info: 'Two sensing elements of fire loops A and B on the inside of this core cowl, one forward and one aft, each a pair of tubes running round the core on clips. They are part of the reverser door and open with it.' });
        for (const xx of [-1.43, side === 'right' ? -2.115 : -1.98]) for (const dx of [-.011, .011]) { const pts = []; for (let i = 0; i <= 18; i++) pts.push(G.onRing(xx + dx, rIFS(xx) - .042, it0 + deg(6) + (itl - deg(12)) * i / 18));
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
          info: sg > 0 ? 'The bottom edge of the right door: the keepers for latches 1 to 5, the receiver for the bifurcation latch pin on the IFS edge, the upper and lower bumpers that align the IFS halves as the doors close, and the lug for the reverser lockout pin under the sleeve\'s forward end. The upper bumper has a compression strut for the wider gap at the top.'
            : 'The bottom edge of the left door. Latches 1 to 5 hook onto the right door: open them 5, 4, 3, 2, 1 and close them 1 to 5, using the closure assist assembly to pull the doors together first. Latches 2 and 3 are inside the bay behind the latch access door.\n\nThe bifurcation latch system (BLS) pins the two IFS halves together at the bottom to limit IFS deflection if an air duct bursts. Its handle is painted red and is worked through the latch access door; if it is not locked, the latch access door cannot be closed. Open the BLS before the latches and close it last.\n\nThe two reverser lockout pins are stowed in sockets in the same bay. To lock the reversers out for MEL dispatch, first pin the ICU\'s inhibit lever, then fit a pin down through each sleeve\'s lower edge into the lug on its latch beam, and stow the sleeves\' blanking plates here in their place (p.372-375). For maintenance alone the ICU inhibit is enough.' });
        /* the web, 1.6 deg in from the door's bottom edge, from just aft of the bifurcation pass-through panel to the sleeve; the drain
           mast passes down between the two webs */
        const aW = aB - sg * deg(.6), hW = aW / (Math.PI / 6), web = new THREE.Shape(), xa = -1.10, xb = xTE - .05, n = 8, pts = [];
        for (let i = 0; i <= n; i++) { const xx = xa + (xb - xa) * i / n; pts.push([xx, rDuct(xx) + .012]); } for (let i = n; i >= 0; i--) { const xx = xa + (xb - xa) * i / n; pts.push([xx, rOut(xx) - .022]); }
        web.moveTo(...pts[0]); pts.slice(1).forEach(p => web.lineTo(...p)); const wg = new THREE.ExtrudeGeometry(web, { depth: .008, bevelEnabled: false }); wg.translate(0, 0, -.004);
        const wm = new THREE.Mesh(wg); wm.rotation.set(aW, 0, 0); PW.add(lb, wm, 'lime', { solid: true });
        /* the latch beam's fairing, the bottom of the nacelle between the two sleeves' lower edges, 6 deg either side of 6 o'clock
           (p.29-31, TTM 01 fig. 28): the flush handles of latches 1, 4 and 5 and the latch access door are in the left one */
        { const fs = []; for (let i = 0; i <= 12; i++) { const xx = xJ2 - .002 + (xTE - .028 - xJ2 + .002) * i / 12; fs.push([xx, rOut(xx)]); }
          PW.add(lb, G.revolve(G.shellProfile(fs, fs.map(([xx, r]) => [xx, r - .02])), Object.assign({ seg: 3 }, span(174, 180))), 'nacellePaint'); }
        /* latches: [x, radius, has an outer handle]; the hooks on the left web reach across onto the keepers on the right */
        for (const [xx, rr, outside] of [[-.99, rOut(-.99) - .035, true], [-1.22, rOut(-1.22) - .06, false], [-1.40, rDuct(-1.40) + .05, false], [-1.81, rOut(-1.81) - .035, true], [-2.09, rOut(-2.09) - .035, true]]) {
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
        /* p.372-375: reverser lockout, for MEL dispatch or maintenance. With the ICU's inhibit lever pinned, a lockout pin goes down
           through the stowed sleeve's lower edge into this lug, so the sleeve cannot deploy. The two pins live in sockets in the bay at
           the latch access panel; when they are fitted, the sleeves' blanking plates are stowed there instead */
        { const fu = Kt.frame(lb, xJ2 - .10, hOf(173.4), rOut(xJ2 - .10) - .035);
          Kt.box(lb, fu, [0, 0, 0], [.03, .024, .028], 'steel', { round: .004 }); Kt.cyl(lb, fu, [0, .0125, 0], 'y', .0055, .002, 'darkBox'); }
        if (sg < 0) for (const dx of [0, .032]) { const fp = Kt.frame(lb, -1.45 - dx, hB + .07, rOut(-1.46) - .06);
          Kt.box(lb, fp, [0, .005, 0], [.024, .01, .024], 'steel', { round: .003 });                                                 // stowage socket
          Kt.cyl(lb, fp, [0, .03, 0], 'y', .0045, .042, 'steel'); Kt.box(lb, fp, [0, .053, .007], [.014, .004, .03], 'steel', { round: .006 }); }   // the pin and its teardrop head
        }
      /* the latch access door on the bottom of the left door, ahead of the drain mast (p.31) */
      if (sg < 0) { PW.part('tr-latch-access-door', { parent: pid, attach: hinge, label: 'Latch access door', src: 'p.24, p.30-31, p.50',
          info: 'Door in the bottom of the left reverser door, ahead of the drain mast. Behind it are latches 2 and 3, the red bifurcation latch system handle and the closure assist assembly. It will not close unless the BLS handle is locked, so a latch access door that will not close means the BLS is not latched. The drain mast exits next to it, and the drain map placard is inside it.' });
        const f = PW.kit.frame('tr-latch-access-door', -1.34, 6.1, rOut(-1.34));
        PW.kit.box('tr-latch-access-door', f, [0, .0002, 0], [.326, .003, .1], 'darkBox', { round: .002 }); PW.kit.box('tr-latch-access-door', f, [0, .0016, 0], [.32, .004, .094], 'nacellePaint', { round: .008 });
        for (const s of [-1, 1]) PW.kit.box('tr-latch-access-door', f, [s * .12, .0036, .03], [.026, .002, .016], 'greyPrimer', { round: .003 }); }
      { const a = sg > 0 ? t0 : t0 + tl, m = new THREE.Mesh(G.roundedBox(1.5, .05, .04, .01)); m.position.copy(G.onRing(-1.75, yhT + .03, a)); m.rotation.x = a; PW.add(pid, m, 'nickel', { solid: true, into: hinge }); }
      /* actuation (p.334-351, p.347): on the torque box at the forward end of the door, the locking feedback actuator in the upper section
         and the locking actuator in the lower one, joined round the ring by the flexible drive shaft and the deploy tube, with the stow,
         deploy and return lines coming down from the hinge beam. The bodies run aft between the cascade boxes; the rods belong to the
         sleeve and slide with it (0.54 m stroke, still inside the bodies at full deploy), their rod ends on the aft wall of the sleeve's
         cascade cavity. The track lock valves are on the torque box at about 5 and 7 o'clock (p.352), the track lock units on the latch
         beams (p.354) */
      { const Kt = PW.kit, aid = `${pid}-actuators`, xm = xJ2 - .075, ra = 1.06, hU = sg > 0 ? 1.5 : 10.5, hL = sg > 0 ? 4.5 : 7.5, hBot = (sg > 0 ? t0 + tl : t0) / (Math.PI / 6);
        PW.part(aid, { parent: pid, attach: hinge, label: `${side === 'left' ? 'Left' : 'Right'} sleeve actuators, drive shaft and track lock`, src: 'p.326-357',
          info: 'Two hydraulic actuators on the torque box move this door\'s translating sleeve, their bodies running aft between the cascade boxes and their rod ends on the sleeve. The locking feedback actuator in the upper section carries the LVDT on its forward end that reports sleeve position to the EEC; the locking actuator in the lower section carries the manual drive unit. Each has an internal lock released by hydraulic pressure, a proximity sensor on the lock and a manual lock lever. The flexible drive shaft keeps the two in step and the deploy tube feeds the locking actuator.\n\nThe track lock unit on the latch beam pushes a spring-loaded bolt into the sleeve\'s path, so the sleeve cannot deploy even if the actuators do; two proximity sensors report the bolt to the EEC. Its track lock valve, on the torque box next to the locking actuator, takes pressure from that actuator\'s head and is opened by the CDC to pull the bolt back; it stays open until the reverser is stowed again. To move a sleeve by hand, release the manual locks and turn the manual drive unit; its torque limiter protects the actuators.' });
        for (const [h, feedback] of [[hU, true], [hL, false]]) {
          const f = Kt.frame(aid, xm, h, ra);
          Kt.box(aid, f, [.02, 0, 0], [.05, .075, .075], 'steel', { round: .008 });                                              // gimbal mount on the torque box
          Kt.cyl(aid, f, [-.33, 0, 0], 'x', .033, .62, 'steel', { edge: .006 }); Kt.cyl(aid, f, [-.655, 0, 0], 'x', .027, .03, 'steel');   // body and rod gland
          for (const xr of [-.15, -.45]) Kt.tube(aid, f, [xr, 0, 0], 'x', .033, .037, .012, 'steel');
          Kt.cyl(aid, f, [-.1, .038, 0], 'y', .009, .02, 'steel'); Kt.connector(aid, f, [-.1, .048, 0], 'y', .007, { lead: 'x' });    // lock proximity sensor
          Kt.box(aid, f, [-.18, .036, .02], [.05, .01, .012], 'steel', { round: .003, mat: { color: '#c0262b', metalness: .2, roughness: .5 } });   // manual lock lever
          for (const xr of [-.06, -.60]) Kt.fitting(aid, f, [xr, .028, -.03 * sg], 'y', .008);                                      // deploy (head) and stow (rod end) ports, on the hinge side
          if (feedback) { Kt.cyl(aid, f, [.085, 0, 0], 'x', .016, .1, 'steel'); Kt.connector(aid, f, [.135, 0, 0], 'x', .009, { lead: 'y' }); }   // LVDT
          else { Kt.cyl(aid, f, [.035, .04, 0], 'y', .015, .03, 'steel'); Kt.hex(aid, f, [.035, .06, 0], 'y', .011, .01, 'steel'); Kt.cyl(aid, f, [.035, .068, 0], 'y', .008, .006, 'capBlack'); }   // manual drive unit
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
        tube(arc(hU, hL, ra + .048, -.002), .009, 'blackHose');                                                                  // flexible drive shaft
        /* p.347-349: the deploy tube leaves the upper actuator's head and runs down the torque box into the lower actuator's head */
        tube([U(-.03, .02, -.03 * zh), U(-.03, .03, -.06 * zh)].concat(arc(hU + .12 * sg, hL - .15 * sg, ra + .03, -.03), [Lw(-.04, .045, .05 * zh), Lw(-.06, .0396, .03 * zh)]), .006, 'tube');
        /* stow, deploy and return lines from the DCU come down from the hinge beam (p.347): deploy into the upper actuator's head, stow
           along its body (the stow tube) to its rod end and on down the torque box to the lower actuator's rod end; return down the
           torque box to the track lock valve, which takes its pressure from the lower actuator's head and feeds the track lock unit */
        tube(arc(hm(.35), hm(1.30), ra + .05, -.084).concat([U(-.10, .05, .07 * zh), U(-.30, .045, .05 * zh), U(-.56, .042, .048 * zh), U(-.60, .042, .035 * zh), U(-.60, .0396, .03 * zh)]), .006, 'tube');   // stow, under the harness
        tube(arc(hm(.35), hm(1.36), ra + .038, -.072).concat([U(-.07, .05, .05 * zh), U(-.06, .045, .035 * zh), U(-.06, .0396, .03 * zh)]), .006, 'tube');   // deploy
        tube([U(-.60, .0396, .03 * zh), U(-.615, .045, .02 * zh), U(-.625, .045, -.03 * zh), U(-.63, .04, -.07 * zh)].concat(arc(hU + .25 * sg, hL - .25 * sg, ra + .036, -.63), [Lw(-.63, .04, .07 * zh), Lw(-.615, .042, .045 * zh), Lw(-.60, .0396, .03 * zh)]), .006, 'tube');   // stow on to the lower actuator
        tube(arc(hm(.35), hm(1.2), ra + .02, -.06).concat([G.onRing(-1.09, 1.12, G.clock(hm(1.3)))], arc(hm(1.4), hm(4.75), ra + .085, -.04), [V(0, .03, .075 * zh), V(0, .008, .075 * zh), V(0, .008, .0337 * zh)]), .006, 'tube');   // return, the upper union
        tube([Lw(-.06, .0396, .03 * zh), Lw(-.055, .07, 0), Lw(-.05, .065, -.07 * zh), loc(xm - .035, hOf(143), 1.09, 0, 0, 0), V(0, -.022, .075 * zh), V(0, -.008, .075 * zh), V(0, -.008, .0337 * zh)], .006, 'tube');   // track lock pressure, the lower
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
        for (const [W, h] of [[U, 1.47], [Lw, 4.47]]) tube([W(-.0874, .0613, 0), W(-.07, .072, 0), W(-.085, .076, .02 * zh), onTk(h)], .004, 'harness', 'harness');   // lock sensors
        tube([V(-.0126, .0583, 0), V(-.05, .075, 0), G.onRing(-1.20, 1.125, G.clock(hm(5.0)))], .004, 'harness', 'harness');            // track lock valve solenoid
        /* the track lock unit on the latch beam (p.354-355, p.377): block on a pad, the bolt's boss facing aft, two proximity sensors and the
           two hydraulic ports on top */
        const ft = Kt.frame(aid, -1.93, hT, 1.0);
        Kt.box(aid, ft, [0, 0, 0], [.09, .05, .045], 'steel', { round: .006 }); Kt.cyl(aid, ft, [-.06, 0, 0], 'x', .008, .03, 'steel');
        for (const z of [-.012, .012]) { Kt.cyl(aid, ft, [-.022, .035, z], 'y', .007, .02, 'steel'); Kt.connector(aid, ft, [-.022, .045, z], 'y', .007, { lead: 'x' }); Kt.fitting(aid, ft, [.025, .025, z], 'y', .006); }   // sensors aft, hydraulic ports forward
        /* the track lock valve on the torque box (p.352-353): block body with its solenoid and connector on top, the supply from the
           locking actuator and the return to the aircraft on the side toward the actuator, the lines to the track lock unit aft */
        const fv = Kt.frame(aid, xm - .025, hV, 1.075);
        Kt.box(aid, fv, [0, 0, 0], [.05, .036, .05], 'castAl', { round: .005 }); Kt.cyl(aid, fv, [0, .028, 0], 'y', .012, .022, 'darkBox'); Kt.connector(aid, fv, [0, .045, 0], 'y', .007, { lead: '-x' });
        for (const y of [.008, -.008]) Kt.fitting(aid, fv, [0, y, .025 * zh], zh > 0 ? 'z' : '-z', .006);
        for (const z of [-.012, .012]) Kt.fitting(aid, fv, [-.025, 0, z], '-x', .006); }
      /* the door opening (PDOS) locking actuator (p.32, p.36, p.41, p.43): connected between the fan case and the torque box, it lies
         along the aft end of the fan case, retracted, from its bearing end on a bracket at 3:45 (8:15) up to its rod end on a lug on the
         torque box's forward face, centred on 3 (9) o'clock. It extends to lift the door and its internal lock holds it open. The
         powerpack's line reaches it at the quick-disconnect by the bearing end */
      { const Kt = PW.kit, hF = sg > 0 ? 3.75 : 8.25, Af = G.onRing(-.86, 1.06, G.clock(hF)), Ad = G.onRing(-.955, 1.08, A(73.5));
        const fl = Kt.frame('pdos', -.86, hF, .968);
        Kt.box('pdos', fl, [0, .05, 0], [.03, .1, .045], 'lime', { round: .004 }); Kt.fitting('pdos', fl, [.015, .055, 0], 'x', .009);       // bracket on the fan case's aft ring, and the quick-disconnect
        const fd = Kt.frame(pid, -.957, hOf(73.5), 1.08, { into: hinge }); Kt.box(pid, fd, [0, 0, 0], [.02, .05, .045], 'lime', { round: .004 });   // lug on the torque box
        strut('pdos', PW.parts.get('pdos').obj, [[.03, .62, 'steel'], [.022, .6, 'steel'], [.015, .58, 'steel']], () => [Af, doorOut(hd, Ad)], .02);
        /* the door's telescopic hold-open rod (p.40-43): pivoted on the torque box's forward face, stowed up along it with its top end in
           the stow bracket; with the door open it goes to the HOR open fitting on the fan case just below the actuator's bracket. A
           red band shows when its lock collar is unlocked, green when locked */
        const hid = `${pid}-hor`, Pv = G.onRing(-.955, 1.12, A(129)), Sw = G.onRing(-.955, 1.14, A(97.5)), Ft = G.onRing(-.86, 1.03, G.clock(sg > 0 ? 4.0 : 8.0));
        PW.part(hid, { parent: 'pdos', attach: hinge, label: `${side === 'left' ? 'Left' : 'Right'} reverser door hold-open rod`, src: 'p.32, p.36-43',
          info: 'Telescopic hold-open rod for this reverser door. When not in use it is stowed on the door\'s torque box, its top end in the stow bracket. With the door opened by the locking actuator, release the top end and fit it to the HOR open fitting on the fan case. The actuator carries 100 % of the load in normal operation; the rod is the failsafe.\n\nLock collars extend and retract it: a red band shows when it is unlocked, green when it is locked. Do not go between the engine and an open reverser door until the rod is installed: if the door opening system fails, the heavy door can close quickly.' });
        for (const [p, sz] of [[Pv, [.03, .045, .05]], [Sw, [.025, .03, .03]]]) { const a = Math.atan2(p.z, p.y), f = Kt.frame(hid, p.x - .012, a / (Math.PI / 6), Math.hypot(p.y, p.z), { into: hinge });
          Kt.box(hid, f, [0, 0, 0], sz, 'greyPrimer', { round: .004 }); }                                                                  // pivot and stow brackets
        const ff = Kt.frame('pdos', -.86, sg > 0 ? 4.0 : 8.0, .968); Kt.box('pdos', ff, [0, .03, 0], [.03, .06, .04], 'darkBox', { round: .004 }); Kt.cyl('pdos', ff, [0, .062, 0], 'x', .006, .04, 'steel');   // HOR open fitting
        const ln = Pv.distanceTo(Sw);
        strut(hid, hinge, [[.016, ln * .9, 'steel'], [.013, ln * .9, 'steel'], [.0105, ln * .9, 'steel']], () => { const w = ease01((opened(hd) - .6) / .4); return [Pv, w > 0 ? Sw.clone().lerp(doorIn(hd, Ft), w) : Sw]; }, .018); }
    }
    /* IFS features: oil tank access door (right, 3 o'clock), AOC window and pressure-relief door (left, 9 o'clock), ACC scoop (right, 1:30) */
    const ifsPanel = (pid, parentDoor, label, info, xx, h, l, w, mat) => { PW.part(pid, { parent: parentDoor, label, info, src: 'p.20-23', attach: PW.parts.get(parentDoor).obj.children[0] }); const a = G.clock(h);
      const m = new THREE.Mesh(G.roundedBox(l, .008, w, .012)); m.position.copy(G.onRing(xx, rIFS(xx) + .002, a)); m.rotation.x = a;
      PW.add(pid, m, mat || 'cowlWhite', { solid: true }); };
    ifsPanel('ifs-otad', 'tr-right', 'Oil tank access door (OTAD)', 'Door in the right IFS at about 2:30, over the oil tank, that gives access to its fill port and sight glass without opening the reverser door (p.21, p.223-224). Wait at least 5 minutes after shutdown before servicing, and check the level between 5 and 60 minutes after shutdown.', -1.93, 2.62, .28, .27, 'cowlWhite');
    ifsPanel('ifs-pce', 'tr-right', 'Precooler exhaust (PCE) door', 'Door aft of the oil tank access door on the right IFS (p.21).', -2.30, 2.4, .2, .18, 'cowlWhite');
    /* the AOC window sits over the air/oil cooler: ZS 748-779 and 9 to 10:30 o'clock on p.5, mid-length of the IFS on p.23. Curved to the IFS, in three sections */
    { PW.part('ifs-aoc-window', { parent: 'tr-left', label: 'Air/oil cooler window', src: 'p.5, p.20-23', attach: PW.parts.get('tr-left').obj.children[0],
        info: 'Opening in the left IFS at about 9:30 o\'clock (ZS 748 to 779), over the air/oil cooler, in three sections. Fan air enters through the forward section, passes aft through the cooler and leaves through the aft section. The IFS pressure-relief door is aft of it.' });
      const x0 = -1.44, x1 = -2.06, a = G.clock(9.7), half = .33, at = xx => rIFS(xx) + .002;
      PW.add('ifs-aoc-window', G.revolve([[x0, at(x0)], [x1, at(x1)], [x1, at(x1) + .004], [x0, at(x0) + .004]], { seg: 14, thetaStart: a - half, thetaLength: 2 * half }), 'darkBox');
      for (const t of [1 / 3, 2 / 3]) { const xx = x0 + (x1 - x0) * t;
        PW.add('ifs-aoc-window', G.revolve([[xx + .008, at(xx)], [xx - .008, at(xx)], [xx - .008, at(xx) + .008], [xx + .008, at(xx) + .008]], { seg: 14, thetaStart: a - half, thetaLength: 2 * half }), 'cowlWhite'); } }
    ifsPanel('ifs-prd', 'tr-left', 'IFS pressure-relief door', 'Spring-latched door at 9 o\'clock (ZS 795 to 803) that opens at 3.5 psi core compartment overpressure, as after a bleed duct burst. Found open on the walkaround: find out why before flight.', -2.44, 9, .2, .2, 'cowlWhite');
    ifsPanel('ifs-acc-scoop', 'tr-right', 'ACC air scoop', 'Scoop on the right IFS at about 1:30 that takes fan air for the turbine active clearance control. Its mouth faces forward into the fan stream; inside the IFS a duct takes the air to the inlet ring of the ACC air valve, and the joint parts when the reverser door is opened.', -1.62, 1.5, .18, .07, 'darkBox');
    { const f = PW.kit.frame('ifs-acc-scoop', -1.62, 1.5, rIFS(-1.62) + .004);                                                // the raised hood, open forward
      PW.kit.box('ifs-acc-scoop', f, [-.012, .014, 0], [.15, .026, .074], 'cowlWhite', { round: .011 });
      PW.kit.box('ifs-acc-scoop', f, [.064, .014, 0], [.004, .02, .062], 'darkBox', { round: .003 }); }

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
      /* the access panels on both sides of the aft pylon over the thrust reverser isolation control unit (p.344), each laid on the
         side skin (the loft's section is a superellipse of power 6) and tilted to its slope */
      { const xx = -2.9, yt = G.interp(TOP, xx), yb = Math.min(bot(xx), yt - .03), cy = (yb + yt) / 2, hh = (yt - yb) / 2, hw = G.interp(WID, xx) / 2, yc = 1.40;
        const side = y => hw * Math.pow(1 - Math.pow(Math.abs((y - cy) / hh), 6), 1 / 6), tilt = Math.atan((side(yc + .01) - side(yc - .01)) / .02);
        for (const s of [-1, 1]) { const f = PW.kit.frame('pylon', xx, 12, yc); f.position.z = s * side(yc); f.rotateX(s * tilt);
          PW.kit.box('pylon', f, [0, 0, s * .0005], [.266, .206, .003], 'darkBox', { round: .002 }); PW.kit.box('pylon', f, [0, 0, s * .0018], [.26, .2, .003], 'whitePaint', { round: .012 }); } }
    }

    /* the nacelle animation: hinges, sleeves and blocker doors follow the toolbar state; the first part of the explode slider swings
       the fan cowls and reverser doors open as well, before they lift away */
    PW.anim.push(dt => { const k = 1 - Math.exp(-3.5 * dt), s = Math.min(1, Math.max(0, (PW.explodeT || 0) / .12)), ex = s * s * (3 - 2 * s);
      for (const key of ['fan', 'tr', 'sleeve']) S[key] += (S.want[key] - S[key]) * k;
      for (const h of S.hinges) h.obj.rotation.x = h.sign * h.max * Math.max(S[h.axis], ex);
      const u = S.stroke * S.sleeve;
      for (const sl of S.sleeves) sl.position.x = -u;
      for (const b of S.blockers) { const th = doorAngle(b, u); b.piv.rotation.set(b.a, 0, 0); b.piv.rotateZ(th); aimLink(b, u, th); }
      for (const st of S.struts) st.update();
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
