/* PW1500G model: renderer, lighting, materials, part registry, section cut with solid caps, camera and picking.
   Every physical part is registered with an id, a parent, a label and its meshes, so it can later be cut, hidden,
   isolated, exploded or dragged on its own. Coordinates as in geo.js: metres, +x forward, y up, z engine right. */
(function () {
  const PW = window.PW = window.PW || {};
  const G = window.PWGeo;
  PW.parts = new Map();          // id -> part
  PW.spools = {};                // name -> { group, rpm100, dir }
  PW.anim = [];                  // per-frame callbacks (dt, t)

  /* ---------------- renderer, scene, lights ---------------- */
  PW.init = function (canvas) {
    const R = PW.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, stencil: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    R.outputEncoding = THREE.sRGBEncoding; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.0;
    R.physicallyCorrectLights = false; R.localClippingEnabled = true;
    R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
    const S = PW.scene = new THREE.Scene();
    S.background = new THREE.Color(0x1b2533);
    PW.camera = new THREE.PerspectiveCamera(32, 2, .05, 200);
    PW.root = new THREE.Group(); PW.root.name = 'engine'; S.add(PW.root);
    S.environment = PW.makeEnvironment(R);
    const hemi = new THREE.HemisphereLight(0xdfe8f4, 0x2a2f36, .35); S.add(hemi);
    const key = PW.key = new THREE.DirectionalLight(0xfff4e6, 1.6); key.position.set(3.5, 7, 5); key.castShadow = true;
    key.shadow.mapSize.set(4096, 4096); key.shadow.bias = -.0002; key.shadow.normalBias = .012;
    Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: .5, far: 25 }); S.add(key, key.target);
    const fill = new THREE.DirectionalLight(0xbcd2ff, .35); fill.position.set(-5, 2, -4); S.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, .5); rim.position.set(-2, 5, 6); S.add(rim);
    /* a soft light carried with the camera, like the work lights in a hangar, so open compartments and cut faces can be inspected */
    PW.headlight = new THREE.PointLight(0xfff8f0, .55, 0, 1.2); PW.camera.add(PW.headlight); PW.headlight.position.set(.3, .4, 0); S.add(PW.camera);
    /* hangar floor: catches the engine's shadow and a soft contact shade */
    const floor = PW.floor = new THREE.Mesh(new THREE.CircleGeometry(30, 64), new THREE.MeshStandardMaterial({ color: new THREE.Color(0x4a5058).convertSRGBToLinear(), roughness: .72, metalness: 0, envMapIntensity: .35 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -1.75; floor.receiveShadow = true; floor.userData.noPick = true; S.add(floor);
    S.fog = new THREE.Fog(0x1b2533, 11, 26);                                 // the floor fades into the backdrop
    PW.initCut(); PW.initControls(canvas);
    return PW;
  };
  /* a hangar-like light room rendered to a prefiltered environment map, so polished metal shows long light strips the
     way it does under hangar lighting, and painted surfaces get soft sky-like fill */
  PW.makeEnvironment = function (R) {
    /* walls kept fairly dark: dark paint (fan blades, spinner, fan case) must read dark, with the lamps giving the highlights */
    const env = new THREE.Scene(), box = new THREE.BoxGeometry();
    const wall = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: 0x3f454d, side: THREE.BackSide, roughness: 1 }));
    wall.scale.set(40, 16, 40); wall.position.y = 6; env.add(wall);
    const floorM = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: 0x2a2d31, roughness: 1 })); floorM.scale.set(40, .1, 40); floorM.position.y = -1.9; env.add(floorM);
    const lamp = (x, y, z, sx, sy, sz, I, col) => { const m = new THREE.MeshBasicMaterial({ color: col || 0xffffff }); m.color.multiplyScalar(I); const b = new THREE.Mesh(box, m); b.position.set(x, y, z); b.scale.set(sx, sy, sz); env.add(b); };
    for (let i = -2; i <= 2; i++) lamp(i * 3.2, 13.5, 0, .6, .1, 22, 9);              // ceiling strip lights running fore and aft
    lamp(0, 7, -19.8, 18, 6, .1, 2.2, 0xdfe9ff);                                         // open hangar door: cool daylight
    lamp(19.8, 5, 4, .1, 4, 10, 3.5, 0xfff1dc);                                          // a warm softbox on one side
    lamp(-19.8, 6, -3, .1, 5, 8, 1.6);
    const pm = new THREE.PMREMGenerator(R); const tex = pm.fromScene(env, .02).texture; pm.dispose();
    return tex;
  };

  /* ---------------- materials ----------------
     Real finishes; colours are sRGB hex. A part gets its own copy of each material it uses, so cutting, dimming or
     highlighting one part never touches another. */
  const tex = {};
  const canvasTex = (w, h, draw, opts) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; if (opts && opts.srgb) t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; return t; };
  /* value noise for roughness and bump maps */
  const noiseTex = (key, size, scale, lo, hi, stretch) => tex[key] || (tex[key] = canvasTex(size, size, (c, w, h) => {
    const img = c.createImageData(w, h), g = []; const n = 64; for (let i = 0; i < n * n; i++) g.push(Math.random());
    const at = (x, y) => g[((y % n + n) % n) * n + ((x % n + n) % n)];
    const smooth = (x, y) => { const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      return (at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx) * (1 - sy) + (at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx) * sy; };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let v = 0, a = .5, f = scale / w * n; for (let o = 0; o < 4; o++) { v += a * smooth(x * f * (stretch || 1), y * f); a *= .5; f *= 2; }
      const k = Math.round(255 * (lo + (hi - lo) * v)), i = (y * w + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = k; img.data[i + 3] = 255; }
    c.putImageData(img, 0, 0); }));
  /* perforated acoustic face sheet: a grid of small dark dots */
  const perfTex = () => tex.perf || (tex.perf = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#c8c8c8'; c.fillRect(0, 0, w, h); c.fillStyle = '#3a3a3a';
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { c.beginPath(); c.arc(x * 16 + 8 + (y % 2) * 8, y * 16 + 8, 2.6, 0, Math.PI * 2); c.fill(); } }));
  /* section-cut face: the cutaway red with fine hatching, as on a museum cutaway */
  const hatchTex = () => tex.hatch || (tex.hatch = canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#b8352a'; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(60,10,6,.55)'; c.lineWidth = 3; for (let i = -h; i < w; i += 16) { c.beginPath(); c.moveTo(i, h); c.lineTo(i + h, 0); c.stroke(); } }, { srgb: true }));
  PW.tex = { noise: noiseTex, perf: perfTex, hatch: hatchTex, canvas: canvasTex };

  const col = h => new THREE.Color(h);
  /* the library: name -> constructor arguments. Values are first estimates and are refined against photos. */
  PW.MAT = {
    nacellePaint: () => new THREE.MeshPhysicalMaterial({ color: col('#0b3ea3'), roughness: .38, metalness: .05, clearcoat: .7, clearcoatRoughness: .18 }),
    whitePaint:   () => new THREE.MeshPhysicalMaterial({ color: col('#e9ecef'), roughness: .42, metalness: .02, clearcoat: .5, clearcoatRoughness: .25 }),
    greyPrimer:   () => new THREE.MeshStandardMaterial({ color: col('#9aa29d'), roughness: .75, metalness: .05 }),
    lipAl:        () => new THREE.MeshStandardMaterial({ color: col('#cfd4d9'), roughness: .3, metalness: 1, roughnessMap: noiseTex('brushed', 256, 6, .5, 1, 8) }),
    liner:        () => new THREE.MeshStandardMaterial({ color: col('#6f7a80'), roughness: .7, metalness: .2, bumpMap: perfTex(), bumpScale: .0015, roughnessMap: perfTex() }),
    composite:    () => new THREE.MeshStandardMaterial({ color: col('#2c3035'), roughness: .55, metalness: .1, roughnessMap: noiseTex('weave', 256, 30, .6, 1) }),
    fanBlade:     () => new THREE.MeshStandardMaterial({ color: col('#9ea6ae'), roughness: .32, metalness: .85, roughnessMap: noiseTex('brushed', 256, 6, .5, 1, 8) }),
    spinner:      () => new THREE.MeshPhysicalMaterial({ color: col('#1c1f23'), roughness: .3, metalness: .2, clearcoat: .6, clearcoatRoughness: .2 }),
    titanium:     () => new THREE.MeshStandardMaterial({ color: col('#b9b4ad'), roughness: .3, metalness: .95, roughnessMap: noiseTex('fine', 256, 40, .6, 1) }),
    steel:        () => new THREE.MeshStandardMaterial({ color: col('#c9ced4'), roughness: .2, metalness: 1, roughnessMap: noiseTex('fine', 256, 40, .6, 1) }),
    shaft:        () => new THREE.MeshStandardMaterial({ color: col('#d8dce0'), roughness: .12, metalness: 1 }),
    gearSteel:    () => new THREE.MeshStandardMaterial({ color: col('#aeb3b8'), roughness: .22, metalness: 1 }),
    nickel:       () => new THREE.MeshStandardMaterial({ color: col('#9a9690'), roughness: .42, metalness: .9, roughnessMap: noiseTex('cast', 256, 14, .55, 1) }),
    hotCase:      () => new THREE.MeshStandardMaterial({ color: col('#8c7a68'), roughness: .5, metalness: .85, roughnessMap: noiseTex('cast', 256, 14, .55, 1), vertexColors: false }),
    tbc:          () => new THREE.MeshStandardMaterial({ color: col('#d8d2c3'), roughness: .75, metalness: .05 }),
    lptBlade:     () => new THREE.MeshStandardMaterial({ color: col('#8f8981'), roughness: .45, metalness: .85 }),
    combLiner:    () => new THREE.MeshStandardMaterial({ color: col('#c9c3b5'), roughness: .7, metalness: .2 }),
    castAl:       () => new THREE.MeshStandardMaterial({ color: col('#a4a8a6'), roughness: .62, metalness: .55, roughnessMap: noiseTex('cast', 256, 14, .55, 1), bumpMap: noiseTex('cast', 256, 14, .55, 1), bumpScale: .0008 }),
    accPaint:     () => new THREE.MeshStandardMaterial({ color: col('#7d8287'), roughness: .55, metalness: .3 }),
    darkBox:      () => new THREE.MeshStandardMaterial({ color: col('#2b2f34'), roughness: .5, metalness: .4 }),
    tube:         () => new THREE.MeshStandardMaterial({ color: col('#c6cbd0'), roughness: .25, metalness: 1 }),
    braid:        () => new THREE.MeshStandardMaterial({ color: col('#9fa4a8'), roughness: .5, metalness: .8, bumpMap: noiseTex('weave', 256, 30, .6, 1), bumpScale: .0006 }),
    harness:      () => new THREE.MeshStandardMaterial({ color: col('#2a2c2e'), roughness: .8, metalness: .1, bumpMap: noiseTex('weave', 256, 30, .6, 1), bumpScale: .0005 }),
    connector:    () => new THREE.MeshStandardMaterial({ color: col('#8f969d'), roughness: .35, metalness: .9 }),
    insulation:   () => new THREE.MeshStandardMaterial({ color: col('#c7c9c6'), roughness: .55, metalness: .6, bumpMap: noiseTex('cast', 256, 14, .55, 1), bumpScale: .0012 }),
    rubber:       () => new THREE.MeshStandardMaterial({ color: col('#1d1f21'), roughness: .9, metalness: 0 }),
    brass:        () => new THREE.MeshStandardMaterial({ color: col('#b8924a'), roughness: .35, metalness: 1 }),
    orange:       () => new THREE.MeshStandardMaterial({ color: col('#d8641e'), roughness: .5, metalness: .1 }),
    glass:        () => new THREE.MeshPhysicalMaterial({ color: col('#dfeef5'), roughness: .05, metalness: 0, transmission: .6, transparent: true, opacity: .55 }),
  };
  const libCache = {};
  /* three r128 takes colour values as linear, so an sRGB hex comes out far too light on screen: every library colour is converted once
     here (the explorer's nacelle blue had the same problem) */
  PW.baseMat = name => libCache[name] || (libCache[name] = (() => { const f = PW.MAT[name]; if (!f) throw new Error('no material ' + name);
    const m = f(); m.envMapIntensity = m.envMapIntensity === undefined ? 1 : m.envMapIntensity; m.side = THREE.FrontSide; m.shadowSide = THREE.FrontSide;
    if (m.color) m.color.convertSRGBToLinear(); if (m.emissive) m.emissive.convertSRGBToLinear(); return m; })());

  /* ---------------- part registry ---------------- */
  /* PW.part(id, { label, parent, info, sys, explode:[dx,dy,dz], anchor:[x,y,z] }) -> THREE.Group */
  PW.part = function (id, o) {
    if (PW.parts.has(id)) return PW.parts.get(id).obj;
    o = o || {};
    const obj = new THREE.Group(); obj.name = id; obj.userData.pid = id;
    const parent = o.parent ? PW.parts.get(o.parent) : null;
    /* attach wins over the parent: a rotor sits in its module in the parts tree but turns with its spool; a door's parts swing with its hinge */
    (o.attach || (parent ? parent.obj : PW.root)).add(obj);
    const p = { id, label: o.label || id, parent: o.parent || null, info: o.info || '', sys: o.sys || null, obj, meshes: [], mats: {}, children: [],
      explode: new THREE.Vector3(...(o.explode || [0, 0, 0])), base: new THREE.Vector3(), anchor: o.anchor ? new THREE.Vector3(...o.anchor) : null,
      cut: true, hidden: false, src: o.src || '', detached: false };
    if (o.attach && parent) { let q = o.attach; while (q && q !== parent.obj) q = q.parent; p.detached = !q; }   // hung outside the parent's own group
    if (parent) parent.children.push(id);
    PW.parts.set(id, p);
    return obj;
  };
  PW.partMat = function (id, name, over) {
    const p = PW.parts.get(id), key = name + (over ? JSON.stringify(over, (k, v) => (v && v.isTexture ? v.uuid : v)) : '');
    if (!p.mats[key]) { const m = PW.baseMat(name).clone(); if (over) for (const k in over) { if (m[k] && m[k].isColor) m[k].set(over[k]).convertSRGBToLinear(); else m[k] = over[k]; }
      m.userData.base = { color: m.color.clone(), emissive: m.emissive ? m.emissive.clone() : null, ei: m.emissiveIntensity || 0 }; p.mats[key] = m; }
    return p.mats[key];
  };
  /* add a mesh to a part. geo may be an InstancedMesh or Mesh already (then mat is taken from it unless given) */
  PW.add = function (id, geo, matName, opts) {
    opts = opts || {};
    const p = PW.parts.get(id); if (!p) throw new Error('no part ' + id);
    const mat = matName ? PW.partMat(id, matName, opts.mat) : null;
    let m;
    if (geo.isMesh) { m = geo; if (mat) m.material = mat; }
    else m = new THREE.Mesh(geo, mat);
    if (opts.pos) m.position.set(...opts.pos); if (opts.rot) m.rotation.set(...opts.rot); if (opts.scale) m.scale.set(...opts.scale);
    m.castShadow = opts.shadow !== false; m.receiveShadow = true;
    m.userData.pid = id; m.userData.solid = opts.solid !== undefined ? opts.solid : !!((m.geometry && m.geometry.userData.solid) || m.userData.solid);
    (opts.into || p.obj).add(m); p.meshes.push(m);
    return m;
  };
  PW.sub = (id) => [id].concat(...(PW.parts.get(id) || { children: [] }).children.map(PW.sub));   // a part and all its descendants
  PW.meshesOf = id => PW.sub(id).flatMap(k => PW.parts.get(k).meshes);

  /* spools: each rotating assembly is parented to a spool group that turns about x */
  PW.spool = function (name, o) {
    if (!PW.spools[name]) { const g = new THREE.Group(); g.name = 'spool-' + name; PW.root.add(g); PW.spools[name] = Object.assign({ group: g, rpm100: 0, dir: 1, angle: 0 }, o); }
    return PW.spools[name].group;
  };

  /* ---------------- section cut with solid caps ----------------
     Parts with cut = true are clipped by one plane. Watertight meshes in those parts also draw into the stencil buffer
     (back faces +1, front faces -1); a cap plane then fills wherever the count is non-zero, i.e. inside solid metal, so cut
     walls, discs and blades read as solid, hatched red faces instead of hollow shells. */
  PW.initCut = function () {
    const C = PW.cut = { on: false, plane: new THREE.Plane(new THREE.Vector3(0, -1, 0), 0), mode: 'top', offset: 0, helpers: [] };
    const capMat = new THREE.MeshStandardMaterial({ map: hatchTex(), color: 0xffffff, roughness: .6, metalness: .15, side: THREE.DoubleSide,
      stencilWrite: true, stencilRef: 0, stencilFunc: THREE.NotEqualStencilFunc, stencilFail: THREE.ReplaceStencilOp, stencilZFail: THREE.ReplaceStencilOp, stencilZPass: THREE.ReplaceStencilOp });
    hatchTex().repeat.set(40, 40);
    C.cap = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), capMat); C.cap.renderOrder = 2; C.cap.visible = false; C.cap.userData.noPick = true;
    C.cap.onAfterRender = r => r.clearStencil();
    PW.scene.add(C.cap);
    const sm = (side, op) => new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: false, side, clippingPlanes: [C.plane],
      stencilWrite: true, stencilFunc: THREE.AlwaysStencilFunc, stencilFail: op, stencilZFail: op, stencilZPass: op });
    C.backMat = sm(THREE.BackSide, THREE.IncrementWrapStencilOp); C.frontMat = sm(THREE.FrontSide, THREE.DecrementWrapStencilOp);
  };
  /* (re)build the stencil helpers and clip lists after parts change or the cut is toggled */
  PW.applyCut = function () {
    const C = PW.cut; C.helpers.forEach(h => h.parent && h.parent.remove(h)); C.helpers = [];
    for (const p of PW.parts.values()) {
      const on = C.on && p.cut && !p.hidden;
      /* clipShadows: the removed half must stop casting shadows too, or the inside of the cut is left in the dark */
      for (const k in p.mats) { const m = p.mats[k];
        if (m.userData.cutOn !== on) { m.userData.cutOn = on; m.clippingPlanes = on ? [C.plane] : []; m.clipShadows = true; m.side = on ? THREE.DoubleSide : THREE.FrontSide; m.needsUpdate = true; } }
      if (!on) continue;
      for (const m of p.meshes) { if (!m.userData.solid || !m.visible) continue;
        for (const hm of [C.backMat, C.frontMat]) {
          const h = m.isInstancedMesh ? new THREE.InstancedMesh(m.geometry, hm, m.count) : new THREE.Mesh(m.geometry, hm);
          if (m.isInstancedMesh) h.instanceMatrix = m.instanceMatrix;
          h.renderOrder = 1; h.raycast = () => {}; h.userData.noPick = true; h.frustumCulled = m.frustumCulled; m.add(h); C.helpers.push(h); } }
    }
    C.cap.visible = C.on;
    PW.placeCap();
  };
  PW.setCutPlane = function (mode, offset) {
    const C = PW.cut; C.mode = mode || C.mode; C.offset = offset === undefined ? C.offset : offset;
    const n = { top: [0, -1, 0], bottom: [0, 1, 0], left: [0, 0, 1], right: [0, 0, -1], front: [-1, 0, 0] }[C.mode];
    if (n) C.plane.normal.set(...n);
    C.plane.constant = C.offset;
    PW.placeCap();
  };
  PW.placeCap = function () {
    const C = PW.cut; if (!C.cap) return;
    const p = C.plane.coplanarPoint(new THREE.Vector3());
    C.cap.position.copy(p); C.cap.lookAt(p.clone().add(C.plane.normal));
  };
  /* the camera-facing mode keeps the cut square to the view as the engine turns */
  PW.followCamera = function () {
    const C = PW.cut; if (C.mode !== 'view') return;
    const v = PW.camera.position.clone().sub(PW.ctl.target); v.x = 0; if (v.lengthSq() < 1e-6) v.set(0, 1, 0); v.normalize();
    C.plane.normal.copy(v).negate(); C.plane.constant = C.offset; PW.placeCap();
  };

  /* ---------------- camera ---------------- */
  PW.initControls = function (cv) {
    const K = PW.ctl = { theta: 2.3, phi: 1.2, r: 8.5, target: new THREE.Vector3(-.6, 0, 0), want: null, damp: 10 };
    K.want = { theta: K.theta, phi: K.phi, r: K.r, target: K.target.clone() };
    let drag = null;
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY, b: e.button, shift: e.shiftKey, moved: false }; });
    cv.addEventListener('pointermove', e => {
      if (!drag) { PW.onHover && PW.onHover(e); return; }
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.hypot(dx, dy) > 3) drag.moved = true;
      drag.x = e.clientX; drag.y = e.clientY;
      if (PW.onDrag && PW.onDrag(e, dx, dy, drag)) return;
      if (drag.b === 2 || drag.b === 1 || drag.shift) {                // pan in the view plane
        const s = K.want.r * .0016, cam = PW.camera, right = new THREE.Vector3().setFromMatrixColumn(cam.matrix, 0), up = new THREE.Vector3().setFromMatrixColumn(cam.matrix, 1);
        K.want.target.addScaledVector(right, -dx * s).addScaledVector(up, dy * s);
      } else { K.want.theta += dx * .006; K.want.phi = Math.min(3.05, Math.max(.08, K.want.phi - dy * .006)); }
    });
    cv.addEventListener('pointerup', e => { const d = drag; drag = null; if (d && !d.moved && PW.onClick) PW.onClick(e); if (PW.onDragEnd) PW.onDragEnd(e); });
    cv.addEventListener('wheel', e => { e.preventDefault(); K.want.r = Math.min(30, Math.max(.4, K.want.r * Math.pow(1.0012, e.deltaY))); }, { passive: false });
  };
  PW.updateCamera = function (dt) {
    const K = PW.ctl, k = 1 - Math.exp(-K.damp * dt);
    K.theta += (K.want.theta - K.theta) * k; K.phi += (K.want.phi - K.phi) * k; K.r += (K.want.r - K.r) * k; K.target.lerp(K.want.target, k);
    const c = PW.camera;
    c.position.set(K.target.x + K.r * Math.sin(K.phi) * Math.cos(K.theta), K.target.y + K.r * Math.cos(K.phi), K.target.z + K.r * Math.sin(K.phi) * Math.sin(K.theta));
    c.lookAt(K.target);
  };
  PW.look = (theta, phi, r, target) => { const W = PW.ctl.want; W.theta = theta; W.phi = phi; W.r = r; if (target) W.target.set(...target); };
  /* jump straight to a view and draw one frame now (for review screenshots: a hidden browser pane throttles animation frames) */
  PW.snap = (theta, phi, r, target) => { PW.look(theta, phi, r, target); const K = PW.ctl; K.theta = theta; K.phi = phi; K.r = r; if (target) K.target.set(...target);
    PW.updateCamera(0); PW.followCamera(); PW.renderer.render(PW.scene, PW.camera); return 'ok'; };

  /* ---------------- picking and highlight ---------------- */
  const ray = new THREE.Raycaster();
  PW.pick = function (e) {
    const cv = PW.renderer.domElement, r = cv.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1), PW.camera);
    const hits = ray.intersectObjects(PW.root.children, true);
    for (const h of hits) {
      let o = h.object; if (o.userData.noPick || !o.visible) continue;
      while (o && !o.userData.pid) o = o.parent; if (!o) continue;
      const p = PW.parts.get(o.userData.pid); if (!p || p.hidden || p.ghost) continue;
      if (PW.cut.on && p.cut && PW.cut.plane.distanceToPoint(h.point) < -1e-4) continue;    // that bit has been cut away
      let vis = true; for (let q = o; q; q = q.parent) if (!q.visible) { vis = false; break; } if (!vis) continue;
      return { id: o.userData.pid, point: h.point, instanceId: h.instanceId };
    }
    return null;
  };
  /* tint a part and its children: 'sel', 'hover', 'dim' or null */
  PW.tint = function (id, how) {
    for (const k of PW.sub(id)) { const p = PW.parts.get(k); for (const key in p.mats) { const m = p.mats[key], b = m.userData.base;
      m.color.copy(b.color); if (m.emissive) { m.emissive.copy(b.emissive); m.emissiveIntensity = b.ei; }
      if (how === 'dim') m.color.lerp(new THREE.Color(0x253244), .7);
      else if (how === 'sel' && m.emissive) { m.emissive.setHex(0x2f8fdd); m.emissiveIntensity = .55; }
      else if (how === 'hover' && m.emissive) { m.emissive.setHex(0x3db5e6); m.emissiveIntensity = .3; } } }
  };
  PW.setHidden = (id, on) => { for (const k of PW.sub(id)) { const p = PW.parts.get(k); p.hidden = on; p.obj.visible = !on; } };
  /* ghost: a part drawn as faint glass, so what is inside shows without losing where the outside is */
  PW.setGhost = function (id, on) {
    for (const k of PW.sub(id)) { const p = PW.parts.get(k); p.ghost = on;
      for (const key in p.mats) { const m = p.mats[key]; m.transparent = on; m.opacity = on ? .12 : 1; m.depthWrite = !on; m.needsUpdate = true; }
      for (const m of p.meshes) m.castShadow = !on; }
  };

  /* ---------------- explode ---------------- */
  /* a part hung on a spool or hinge is not carried by its module's group, so it adds its ancestors' explode moves itself */
  /* Exploded, routed tubes, hoses and harnesses (meshes marked isLine) and parts marked explodeHide (sensors spread over several
     modules, links, loops) are put away, as on a module breakdown drawing; they come back when the engine is put together again */
  PW.setExplode = function (t) {
    PW.explodeT = t; const away = t > .02;
    for (const p of PW.parts.values()) {
      if (p.explodeHide) p.obj.visible = !p.hidden && !away;
      for (const m of p.meshes) if (m.userData.isLine) m.visible = !away;
      const v = p.explode.clone(); if (p.detached) for (let q = PW.parts.get(p.parent); q; q = q.parent && PW.parts.get(q.parent)) v.add(q.explode);
      if (!v.lengthSq() && !p.dragged) continue;
      p.obj.position.copy(p.base).addScaledVector(v, t); if (p.dragged) p.obj.position.add(p.dragged); }
  };
  /* builders can add toolbar controls: PW.addControl('Cowls', [{ label, on, apply }]) */
  PW.controls = [];
  PW.addControl = (label, buttons) => PW.controls.push({ label, buttons });

  /* ---------------- frame loop ---------------- */
  PW.start = function (onFrame) {
    let last = performance.now();
    const loop = now => {
      const dt = Math.min(.05, Math.max(.001, (now - last) / 1000)); last = now;
      const cv = PW.renderer.domElement, w = cv.clientWidth, h = cv.clientHeight, pr = PW.renderer.getPixelRatio();
      if (cv.width !== Math.round(w * pr) || cv.height !== Math.round(h * pr)) { PW.renderer.setSize(w, h, false); PW.camera.aspect = w / Math.max(1, h); PW.camera.updateProjectionMatrix(); }
      PW.updateCamera(dt);
      for (const name in PW.spools) { const s = PW.spools[name]; s.angle += dt * (PW.speed || 0) * s.vis * s.dir; s.group.rotation.x = s.angle; }
      for (const f of PW.anim) f(dt, now / 1000);
      PW.followCamera();
      onFrame && onFrame(dt, now / 1000);
      PW.renderer.render(PW.scene, PW.camera);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  };
})();
