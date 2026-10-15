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
    PW.ao = PW.makeAO(R);
    return PW;
  };
  /* a hangar-like light room rendered to a prefiltered environment map, so polished metal shows long light strips the
     way it does under hangar lighting, and painted surfaces get soft sky-like fill */
  PW.makeEnvironment = function (R) {
    /* walls kept fairly dark: dark paint (fan blades, spinner, fan case) must read dark, with the lamps giving the highlights.
       The walls and floor use a lit material and this scene has no lights, so they render black: only the lamps show in the
       reflections. That is deliberate. Lit grey walls (tried on 2026-10-15) filled every surface with reflected light and washed
       the core compartment out (Brian: "less realistic"), and the metal finishes are set for this dark surround */
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

  /* ---------------- ambient occlusion ----------------
     Shade where surfaces crowd each other, as in the A220 explorer's aircraft view (index.html): after the normal render the visible
     engine alone is drawn into a half-size normal and depth buffer, a 16-sample hemisphere test finds what is occluded within about
     15 cm, a depth-aware blur smooths it, and the frame is multiplied by the result. Without it the sky light and the camera's work light
     reach every surface in the packed core compartment alike, so it looked flat and too light (Brian, 2026-10-15: "add some shadowing").
     On the left core view it takes the mean brightness from 120 to 104 of 255; about 4 ms a frame here, and only while the view moves.
     It is recomputed when the view or the scene changes; if that makes frames slow, it waits until the view settles and fades in. It
     is left off while a section cut is on, since it cannot see the clipped faces and their caps. */
  PW.makeAO = function (R) {
    const KS = 16, kernel = []; let seed = 20261015;
    const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;                    // a fixed kernel, the same on every load
    for (let i = 0; i < KS; i++) { const v = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd()).normalize(); let s = i / KS; s = .1 + .9 * s * s; kernel.push(v.multiplyScalar(s * (.4 + .6 * rnd()))); }
    const nt = new THREE.WebGLRenderTarget(2, 2, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter }); nt.depthTexture = new THREE.DepthTexture(); nt.depthTexture.type = THREE.UnsignedIntType;
    const at = new THREE.WebGLRenderTarget(2, 2), bt = new THREE.WebGLRenderTarget(2, 2);
    const normM = new THREE.MeshNormalMaterial({ side: THREE.DoubleSide });
    const quadVS = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
    const aoM = new THREE.ShaderMaterial({ depthTest: false, depthWrite: false,
      uniforms: { tNormal: { value: nt.texture }, tDepth: { value: nt.depthTexture }, proj: { value: new THREE.Matrix4() }, invProj: { value: new THREE.Matrix4() }, kernel: { value: kernel }, radius: { value: .15 }, bias: { value: .0025 } },
      vertexShader: quadVS, fragmentShader: `uniform sampler2D tNormal, tDepth; uniform mat4 proj, invProj; uniform vec3 kernel[${KS}]; uniform float radius, bias; varying vec2 vUv;
        vec3 viewPos(vec2 uv, float d) { vec4 v = invProj * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); return v.xyz / v.w; }
        void main() { float d = texture2D(tDepth, vUv).x; if (d >= 1.0) { gl_FragColor = vec4(1.0); return; }
          vec3 P = viewPos(vUv, d), N = normalize(texture2D(tNormal, vUv).xyz * 2.0 - 1.0);
          vec2 cell = mod(floor(gl_FragCoord.xy), 4.0); float a = (cell.x + 4.0 * cell.y + .5) / 16.0 * 6.2831853;   /* 16 rotations in a 4 x 4 tile, which the 4 x 4 blur averages out */
          vec3 r = vec3(cos(a), sin(a), 0.0), T = normalize(r - N * dot(r, N)), B = cross(N, T); mat3 TBN = mat3(T, B, N);
          float occ = 0.0;
          for (int i = 0; i < ${KS}; i++) { vec3 S = P + TBN * kernel[i] * radius; vec4 o = proj * vec4(S, 1.0); vec2 su = o.xy / o.w * .5 + .5;
            vec3 SP = viewPos(su, texture2D(tDepth, su).x); occ += (SP.z >= S.z + bias * (1.0 - P.z * .2) ? 1.0 : 0.0) * smoothstep(0.0, 1.0, radius / abs(P.z - SP.z)); }
          occ *= smoothstep(.12, .4, dot(N, normalize(-P)));   /* a surface seen edge-on samples its own depth and comes out in dark dashes */
          gl_FragColor = vec4(vec3(1.0 - occ / float(${KS})), 1.0); }` });
    const blurM = new THREE.ShaderMaterial({ depthTest: false, depthWrite: false, uniforms: { tAO: { value: at.texture }, tDepth: { value: nt.depthTexture }, invProj: aoM.uniforms.invProj, texel: { value: new THREE.Vector2() } }, vertexShader: quadVS,
      fragmentShader: `uniform sampler2D tAO, tDepth; uniform mat4 invProj; uniform vec2 texel; varying vec2 vUv;
        float vz(vec2 uv) { vec4 v = invProj * vec4(uv * 2.0 - 1.0, texture2D(tDepth, uv).x * 2.0 - 1.0, 1.0); return v.z / v.w; }
        void main() { float zc = vz(vUv), s = 0.0, w = 0.0;   /* depth-aware: only neighbours at about the same depth, so a crease's shade does not spread across an edge */
          for (int x = -2; x < 2; x++) for (int y = -2; y < 2; y++) { vec2 uv = vUv + (vec2(float(x), float(y)) + .5) * texel; float k = exp(-abs(vz(uv) - zc) * 60.0); s += texture2D(tAO, uv).r * k; w += k; }
          gl_FragColor = vec4(vec3(w > 0.0 ? s / w : 1.0), 1.0); }` });
    const mulM = new THREE.ShaderMaterial({ depthTest: false, depthWrite: false, transparent: true, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
      blendSrc: THREE.ZeroFactor, blendDst: THREE.SrcColorFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,   // the frame times the occlusion
      uniforms: { tAO: { value: bt.texture }, strength: { value: 1 } }, vertexShader: quadVS,
      fragmentShader: 'uniform sampler2D tAO; uniform float strength; varying vec2 vUv; void main() { gl_FragColor = vec4(vec3(mix(1.0, texture2D(tAO, vUv).r, strength)), 1.0); }' });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)), qScene = new THREE.Scene(), qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); quad.frustumCulled = false; qScene.add(quad);
    const pass = (mat, to) => { quad.material = mat; R.setRenderTarget(to); R.render(qScene, qCam); };
    const lastView = new THREE.Matrix4(), lastProj = new THREE.Matrix4(); let lastSig = '', ok = true, checked = false, slow = 0, settle = false, still = 0, fade = 0, have = false, since = 0;
    /* what else changes the picture: running spools, explode, doors, hidden and ghosted parts, dragging */
    const sig = () => { let v = 0, g = 0; for (const p of PW.parts.values()) { if (p.obj.visible) v++; if (p.ghost) g++; }
      const N = PW.nac; return [PW.speed || 0, PW.explodeT || 0, N ? N.fan + ',' + N.tr : '', v, g, PW.anyDrag ? 1 : 0].join('|'); };
    const compute = () => { const S = PW.scene, cam = PW.camera, W = Math.max(2, Math.round(R.domElement.width / 2)), H = Math.max(2, Math.round(R.domElement.height / 2));
      if (nt.width !== W || nt.height !== H) { nt.setSize(W, H); at.setSize(W, H); bt.setSize(W, H); blurM.uniforms.texel.value.set(1 / W, 1 / H); }
      const off = [];                                                                                        // the floor, hazard areas, cut cap and ghosted parts sit this out
      for (const o of S.children) if (o !== PW.root && o.visible && o !== cam && !o.isLight) { off.push(o); o.visible = false; }
      for (const p of PW.parts.values()) if (p.ghost) for (const m of p.meshes) if (m.visible) { off.push(m); m.visible = false; }
      const bg = S.background, cc = R.getClearColor(new THREE.Color()), ca = R.getClearAlpha(), su = R.shadowMap.autoUpdate; S.background = null; S.overrideMaterial = normM; R.setClearColor(0x000000, 0);
      R.shadowMap.autoUpdate = false;                                                                         // the frame just drew the shadow map; this pass needs none
      R.setRenderTarget(nt); R.clear(); R.render(S, cam); S.overrideMaterial = null; S.background = bg; R.setClearColor(cc, ca); R.shadowMap.autoUpdate = su; for (const o of off) o.visible = true;
      aoM.uniforms.proj.value.copy(cam.projectionMatrix); aoM.uniforms.invProj.value.copy(cam.projectionMatrixInverse); pass(aoM, at); pass(blurM, bt); R.setRenderTarget(null);
      if (!checked) { checked = true; const px = new Uint8Array(4 * 16); R.readRenderTargetPixels(bt, Math.floor(W / 2) - 2, Math.floor(H / 2) - 2, 4, 4, px);   // a shader that failed to compile leaves it black, which would black out the frame
        let s = 0; for (let i = 0; i < px.length; i += 4) s += px[i]; if (s / 16 < 12) { ok = false; console.warn('Ambient occlusion off: its buffer came out black'); return false; } }
      have = true; return true; };
    return { get enabled() { return ok; }, set enabled(v) { ok = !!v; have = false; },
      get strength() { return mulM.uniforms.strength.value; }, set strength(v) { mulM.uniforms.strength.value = v; },
      get radius() { return aoM.uniforms.radius.value; }, set radius(v) { aoM.uniforms.radius.value = v; have = false; },
      /* after the frame is drawn: dt in seconds; force recomputes now and applies it in full (single frames for review) */
      render(dt, force) {
        if (!ok || (PW.cut && PW.cut.on)) { have = false; return; }
        const cam = PW.camera, s = sig(), moved = force || !have || !lastView.equals(cam.matrixWorldInverse) || !lastProj.equals(cam.projectionMatrix) || s !== lastSig || (PW.speed || 0) > 0;
        lastView.copy(cam.matrixWorldInverse); lastProj.copy(cam.projectionMatrix); lastSig = s; since += dt;
        if (force) { if (!compute()) return; fade = 1; }
        else if (moved) { still = 0;
          if (!settle) { if (!compute()) return; fade = 1; if (dt > .028) { if (++slow > 60) { settle = true; console.info('Ambient occlusion: frames slow, now applied once the view settles'); } } else slow = Math.max(0, slow - 2); }
          else { fade = 0; have = false; return; } }
        else if (settle) { still += dt; if (!have) { if (still < .15) return; if (!compute()) return; fade = 0; } fade = Math.min(1, fade + dt / .25); }
        else if (since > 1) { since = 0; compute(); }                                                     // a quiet refresh, for anything that moved unseen
        if (!have || fade <= 0) return;
        const k = mulM.uniforms.strength.value; mulM.uniforms.strength.value = k * fade;
        const ac = R.autoClear; R.autoClear = false; pass(mulM, null); R.autoClear = ac; mulM.uniforms.strength.value = k; } };
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
  /* braided harness overbraid: black with a tracer yarn spiralling along it; u runs along the harness (8 repeats a metre). Light green
     on the fan case harnesses, blue and white on the core's (photos) */
  const braidTex = (key, tracers) => { key = key || 'braid'; tracers = tracers || ['#a6c96a'];
    return tex[key] || (tex[key] = canvasTex(64, 64, (c, w, h) => { c.fillStyle = '#1f2123'; c.fillRect(0, 0, w, h); c.strokeStyle = '#34373a'; c.lineWidth = 2;
      for (let i = -h; i < w + h; i += 6) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + h, h); c.stroke(); c.beginPath(); c.moveTo(i + h, 0); c.lineTo(i, h); c.stroke(); }
      for (let k = 0; k < 4; k++) { c.fillStyle = tracers[k % tracers.length]; c.fillRect(k * 16 + 2, (k * 16 + 4) % h, 6, 3); } }, { srgb: true })); };
  PW.tex = { noise: noiseTex, perf: perfTex, hatch: hatchTex, canvas: canvasTex, braid: braidTex };

  const col = h => new THREE.Color(h);
  /* the library: name -> constructor arguments. Values are first estimates and are refined against photos. */
  PW.MAT = {
    /* gloss polyurethane topcoat: a full clear coat that mirrors the hangar's strip lights, over a softer base colour */
    nacellePaint: () => new THREE.MeshPhysicalMaterial({ color: col('#0b3ea3'), roughness: .42, metalness: 0, clearcoat: 1, clearcoatRoughness: .06 }),
    whitePaint:   () => new THREE.MeshPhysicalMaterial({ color: col('#e9ecef'), roughness: .45, metalness: 0, clearcoat: .9, clearcoatRoughness: .1 }),
    greyPrimer:   () => new THREE.MeshStandardMaterial({ color: col('#9aa29d'), roughness: .75, metalness: .05 }),
    lipAl:        () => new THREE.MeshStandardMaterial({ color: col('#c8ccd0'), roughness: .55, metalness: .55, roughnessMap: noiseTex('brushed', 256, 6, .5, 1, 8) }),   // satin light grey in the photos, not a mirror
    liner:        () => new THREE.MeshStandardMaterial({ color: col('#6f7a80'), roughness: .7, metalness: .2, bumpMap: perfTex(), bumpScale: .0015, roughnessMap: perfTex() }),
    composite:    () => new THREE.MeshStandardMaterial({ color: col('#2c3035'), roughness: .55, metalness: .1, roughnessMap: noiseTex('weave', 256, 30, .6, 1) }),
    fanBlade:     () => new THREE.MeshStandardMaterial({ color: col('#9ea6ae'), roughness: .32, metalness: .85, roughnessMap: noiseTex('brushed', 256, 6, .5, 1, 8) }),
    spinner:      () => new THREE.MeshPhysicalMaterial({ color: col('#1c1f23'), roughness: .3, metalness: .2, clearcoat: .6, clearcoatRoughness: .2 }),
    titanium:     () => new THREE.MeshStandardMaterial({ color: col('#b9b4ad'), roughness: .3, metalness: .95, roughnessMap: noiseTex('fine', 256, 40, .6, 1) }),
    /* steel and tube: satin stainless. In the core photos the tubes and fittings are a light satin grey about 0.8 to 1.0 times as bright
       as the mint fan exit liner; as mirrors (metalness 1) they reflected the dark backdrop and most fitting faces rendered near black */
    steel:        () => new THREE.MeshStandardMaterial({ color: col('#c9ced4'), roughness: .35, metalness: .65, roughnessMap: noiseTex('fine', 256, 40, .6, 1) }),
    shaft:        () => new THREE.MeshStandardMaterial({ color: col('#d8dce0'), roughness: .12, metalness: 1 }),
    gearSteel:    () => new THREE.MeshStandardMaterial({ color: col('#aeb3b8'), roughness: .22, metalness: 1 }),
    nickel:       () => new THREE.MeshStandardMaterial({ color: col('#9a9690'), roughness: .42, metalness: .9, roughnessMap: noiseTex('cast', 256, 14, .55, 1) }),
    hotCase:      () => new THREE.MeshStandardMaterial({ color: col('#8c7a68'), roughness: .5, metalness: .85, roughnessMap: noiseTex('cast', 256, 14, .55, 1), vertexColors: false }),
    tbc:          () => new THREE.MeshStandardMaterial({ color: col('#d8d2c3'), roughness: .75, metalness: .05 }),
    lptBlade:     () => new THREE.MeshStandardMaterial({ color: col('#4f4a45'), roughness: .55, metalness: .8, envMapIntensity: .35 }),   // oxidised: the last stage reads near black from aft (rear photos)
    combLiner:    () => new THREE.MeshStandardMaterial({ color: col('#c9c3b5'), roughness: .7, metalness: .2 }),
    castAl:       () => new THREE.MeshStandardMaterial({ color: col('#a4a8a6'), roughness: .62, metalness: .55, roughnessMap: noiseTex('cast', 256, 14, .55, 1), bumpMap: noiseTex('cast', 256, 14, .55, 1), bumpScale: .0008 }),
    accPaint:     () => new THREE.MeshStandardMaterial({ color: col('#7d8287'), roughness: .55, metalness: .3 }),
    darkBox:      () => new THREE.MeshStandardMaterial({ color: col('#2b2f34'), roughness: .5, metalness: .4 }),
    tube:         () => new THREE.MeshStandardMaterial({ color: col('#c6cbd0'), roughness: .3, metalness: .8 }),
    braid:        () => new THREE.MeshStandardMaterial({ color: col('#9fa4a8'), roughness: .5, metalness: .8, bumpMap: noiseTex('weave', 256, 30, .6, 1), bumpScale: .0006 }),
    harness:      () => new THREE.MeshStandardMaterial({ color: col('#ffffff'), map: braidTex(), roughness: .78, metalness: .1, bumpMap: braidTex(), bumpScale: .0006 }),   // black overbraid, light green tracer (photos)
    harnessCore:  () => new THREE.MeshStandardMaterial({ color: col('#ffffff'), map: braidTex('braidCore', ['#4f86d6', '#d8dde3']), roughness: .78, metalness: .1, bumpMap: braidTex(), bumpScale: .0006 }),   // the core compartment's, blue and white tracer (photos)
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
    /* pivot: a point the plane passes through at offset 0 (the axis for the whole engine, a part's centre when one part is cut) */
    const C = PW.cut = { on: false, plane: new THREE.Plane(new THREE.Vector3(0, -1, 0), 0), mode: 'top', offset: 0, pivot: new THREE.Vector3(), helpers: [] };
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
    C.plane.constant = C.offset - C.plane.normal.dot(C.pivot);
    PW.placeCap();
  };
  PW.placeCap = function () {
    const C = PW.cut; if (!C.cap) return;
    /* the cap sits where the plane meets the pivot's line of sight, so it covers a part cut away from the engine axis */
    const p = C.plane.projectPoint(C.pivot, new THREE.Vector3());
    C.cap.position.copy(p); C.cap.lookAt(p.clone().add(C.plane.normal));
  };
  /* the camera-facing mode keeps the cut square to the view as the engine turns */
  PW.followCamera = function () {
    const C = PW.cut; if (C.mode !== 'view') return;
    const v = PW.camera.position.clone().sub(PW.ctl.target); v.x = 0; if (v.lengthSq() < 1e-6) v.set(0, 1, 0); v.normalize();
    C.plane.normal.copy(v).negate(); C.plane.constant = C.offset - C.plane.normal.dot(C.pivot); PW.placeCap();
  };

  /* ---------------- camera ---------------- */
  PW.initControls = function (cv) {
    const K = PW.ctl = { theta: 2.3, phi: 1.2, r: 8.5, target: new THREE.Vector3(-.6, 0, 0), want: null, damp: 10 };
    K.want = { theta: K.theta, phi: K.phi, r: K.r, target: K.target.clone() };
    let drag = null;
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY, b: e.button, shift: e.shiftKey, moved: false }; if (PW.onDown) PW.onDown(e, drag); });
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
    cv.addEventListener('pointerup', e => { const d = drag; drag = null; if (d && !d.moved && PW.onClick) PW.onClick(e); if (PW.onDragEnd) PW.onDragEnd(e, d); });
    cv.addEventListener('dblclick', e => { if (PW.onDblClick) PW.onDblClick(e); });
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
    PW.updateCamera(0); PW.followCamera(); PW.renderer.render(PW.scene, PW.camera); if (PW.ao) PW.ao.render(0, true); return 'ok'; };

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
      for (const key in p.mats) { const m = p.mats[key], o = m.userData.ghost0 || (m.userData.ghost0 = { transparent: m.transparent, opacity: m.opacity, depthWrite: m.depthWrite });   // decals and placards are transparent of their own
        m.transparent = on || o.transparent; m.opacity = on ? .12 * o.opacity : o.opacity; m.depthWrite = on ? false : o.depthWrite; m.needsUpdate = true; }
      for (const m of p.meshes) { if (m.userData.cast0 === undefined) m.userData.cast0 = m.castShadow; m.castShadow = on ? false : m.userData.cast0; } }   // back to its own setting: decals and fasteners cast none
  };

  /* ---------------- explode ---------------- */
  /* The engine opens from the outside in. Each part's explode is a list of staged moves, p.moves = [{ v, a, b }]: move v eased in
     over its own stretch a..b of the slider, so the nacelle comes off first, then the dressing, the accessories, and last the core
     modules. A part with no staged moves uses p.explode over the whole slider. Nothing is put away: tubes and harnesses travel with
     their parts. A part hung on a spool or hinge is not carried by its module's group, so it adds its ancestors' moves itself */
  /* Parts pulled out with the Move tool keep their offset in world space (p.dragW). It is turned into the frame of whatever the part
     hangs from each time, so a dragged rotor stays put while its spool turns and a part on a door keeps its place as the door swings */
  /* A part hung from a spool (shafts, rotors) takes its explode offset in world space as well: applied in the spool's own frame, a
     sideways offset would swing round the engine axis as the spool turns. Such offsets are re-applied every frame while the engine runs */
  const qInv = new THREE.Quaternion(), wv = new THREE.Vector3(), anc = new THREE.Vector3();
  const ease = s => (s <= 0 ? 0 : s >= 1 ? 1 : s * s * (3 - 2 * s));
  PW.explodeAt = function (p, t, out) { out.set(0, 0, 0);
    if (p.moves && p.moves.length) { for (const m of p.moves) out.addScaledVector(m.v, ease((t - m.a) / Math.max(1e-6, m.b - m.a))); }
    else out.addScaledVector(p.explode, t);
    return out; };
  const hasMove = p => (p.moves && p.moves.length) || p.explode.lengthSq() > 0;
  PW.setExplode = function (t) {
    PW.explodeT = t; let any = false, spin = false;
    for (const p of PW.parts.values()) {
      const v = PW.explodeAt(p, t, new THREE.Vector3()); wv.set(0, 0, 0); if (p.dragW) wv.add(p.dragW);
      let staged = hasMove(p);
      if (p.detached) { for (let q = PW.parts.get(p.parent); q; q = q.parent && PW.parts.get(q.parent)) { v.add(PW.explodeAt(q, t, anc)); staged = staged || hasMove(q); if (q.dragW) wv.add(q.dragW); }
        wv.add(v); v.set(0, 0, 0); if (t > 0 && staged) spin = true; }
      if (p.dragW) any = true;
      const moved = wv.lengthSq() > 0;
      if (!staged && !moved && !p.wasDragged) continue;
      p.obj.position.copy(p.base).add(v);
      if (moved) { p.obj.parent.getWorldQuaternion(qInv).invert(); p.obj.position.add(wv.clone().applyQuaternion(qInv)); }
      p.wasDragged = moved; }
    PW.anyDrag = any; PW.explodeSpin = spin;
  };
  /* put moved parts back by sliding them home over about 0.7 s, so the eye can follow where each one goes */
  PW.putBack = function (ids, dur) {
    dur = dur || .7; const items = [];
    for (const id of ids) for (const k of PW.sub(id)) { const p = PW.parts.get(k); if (p && p.dragW && !items.some(it => it.p === p)) items.push({ p, from: p.dragW.clone() }); }
    if (!items.length) { if (PW.onPutBack) PW.onPutBack(); return; }
    let s = 0;
    const step = dt => { s = Math.min(1, s + dt / dur); const e = s < .5 ? 4 * s * s * s : 1 - Math.pow(-2 * s + 2, 3) / 2;
      for (const it of items) it.p.dragW = s < 1 ? it.from.clone().multiplyScalar(1 - e) : null;
      PW.setExplode(PW.explodeT || 0);
      if (s >= 1) { PW.anim = PW.anim.filter(f => f !== step); if (PW.onPutBack) PW.onPutBack(); } };
    PW.anim.push(step);
  };
  /* drag a part (and everything carried with it) by a world-space step; null puts it back */
  PW.dragPart = function (id, step) {
    for (const k of step ? [id] : PW.sub(id)) { const p = PW.parts.get(k); if (!p) continue;
      if (!step) { p.dragW = null; continue; } p.dragW = (p.dragW || new THREE.Vector3()).add(step); }
    PW.setExplode(PW.explodeT || 0);
  };
  PW.isDragged = id => PW.sub(id).some(k => PW.parts.get(k).dragW);
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
      if (PW.anyDrag || (PW.explodeSpin && PW.speed)) { PW.root.updateMatrixWorld(true); PW.setExplode(PW.explodeT || 0); }   // keep moved and exploded parts in place as spools turn and doors swing
      PW.followCamera();
      onFrame && onFrame(dt, now / 1000);
      PW.renderer.render(PW.scene, PW.camera);
      if (PW.ao) PW.ao.render(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  };
})();
