/* PW1500G model: page wiring. Builds the engine, the parts tree, the info card and the toolbar. */
(function () {
  const PW = window.PW;
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  PW.init(document.getElementById('gl'));
  for (const b of PW.builders || []) b();
  for (const p of PW.parts.values()) p.base.copy(p.obj.position);
  PW.applyCut();

  /* ---- selection: one part (its card shows), or several, added with Ctrl or Shift-click or a Select area box ---- */
  let sel = null, hover = null;
  const selSet = new Set(), tinted = new Set();
  const info = document.getElementById('info');
  const label = id => (PW.parts.get(id) || {}).label || id;
  const path = id => { const out = []; for (let p = PW.parts.get(id); p; p = p.parent && PW.parts.get(p.parent)) out.unshift(p.label); return out; };
  const selIds = () => [...selSet];
  let areaHidden = [];                                   // hidden parts inside the last Select area box, offered back
  function retint() { for (const id of tinted) PW.tint(id, null); tinted.clear();
    for (const id of selSet) { PW.tint(id, 'sel'); tinted.add(id); }
    if (hover && !selSet.has(hover)) { PW.tint(hover, 'hover'); tinted.add(hover); } }
  const note = () => areaHidden.length ? `<div class="note">${areaHidden.length} hidden part${areaHidden.length > 1 ? 's' : ''} in that area <button class="b" id="iShowArea">Show ${areaHidden.length > 1 ? 'them' : 'it'}</button></div>` : '';
  function showInfo() {
    if (!selSet.size) { info.innerHTML = `${note()}<h2>PW1500G geared turbofan</h2><div class="sub">A220-300 &middot; drag to turn, right-drag to pan, scroll to zoom &middot; <kbd>?</kbd> for keys</div>
      <p>Click any part, or pick it from the list, to see what it is, where it sits and what maintenance does with it. Ctrl or Shift-click adds more parts; Select area picks every part inside a box you drag. Use Section to cut the engine open and Explode to pull the modules apart.</p>
      <p>To look inside a part, select it and press Inspect (<kbd>I</kbd>): it is shown on its own and cut in half facing you. Back, or <kbd>Esc</kbd>, returns to the whole engine; Home resets everything. With Move parts on, drag any part out of the engine; select a module in the list first to move it whole.</p>
      <p>Run at Idle or Takeoff to see the ground run hazard areas on the floor: the intake suction and exhaust danger areas for that power, and at idle the entry corridor for approaching a running engine.</p>`; wireNote(); return; }
    if (selSet.size > 1) { const ids = selIds();
      info.innerHTML = `${note()}<h2>${ids.length} parts selected</h2><div class="sub">Ctrl or Shift-click a part to add it or take it out</div>
        <p>${ids.slice(0, 14).map(id => esc(label(id))).join(', ')}${ids.length > 14 ? `, and ${ids.length - 14} more` : ''}</p>
        <div class="acts"><button class="b" id="iInspect" title="Show these on their own, cut in half facing you (I)">Inspect</button><button class="b" id="iIso" title="Show only these (X)">Show only these</button><button class="b" id="iHide" title="H">Hide</button><button class="b" id="iFocus" title="F">Zoom to</button><button class="b" id="iClear" title="Esc">Clear selection</button><button class="b" id="iAll" title="A">Show all</button></div>`;
      wireNote(); wireActs(); return; }
    const p = PW.parts.get(sel), solo = cutSolo && cutSolo.length === 1 && cutSolo[0] === sel, moved = PW.isDragged(sel);
    info.innerHTML = `${note()}<h2>${esc(p.label)}</h2><div class="sub">${esc(path(sel).slice(0, -1).join(' › '))}</div>${(p.info || '').split('\n\n').map(t => `<p>${esc(t)}</p>`).join('')}
      <div class="acts"><button class="b" id="iInspect" title="Show this part on its own, cut in half facing you (I)">Inspect</button><button class="b" id="iCut" aria-pressed="${solo}" title="Cut only this part, through its middle (C)">${solo ? 'Whole again' : 'Cut in half'}</button><button class="b" id="iIso" title="Show only this part (X)">Isolate</button><button class="b" id="iHide" title="H">Hide</button><button class="b" id="iFocus" title="F">Zoom to</button>${moved ? '<button class="b" id="iBack">Put back</button>' : ''}<button class="b" id="iAll" title="A">Show all</button></div>
      ${p.src ? `<div class="src">Source: ${esc(p.src)}</div>` : ''}`;
    wireNote(); wireActs();
    info.querySelector('#iCut').onclick = () => toggleCut();
    if (moved) info.querySelector('#iBack').onclick = () => PW.putBack([sel]);
  }
  function wireNote() { const b = info.querySelector('#iShowArea'); if (b) b.onclick = () => { showParts(areaHidden); areaHidden = []; showInfo(); }; }
  function wireActs() { const on = (id, f) => { const b = info.querySelector(id); if (b) b.onclick = f; };
    on('#iInspect', inspect); on('#iIso', () => isolate(selIds())); on('#iHide', hideSelected); on('#iFocus', () => focus(selIds()));
    on('#iClear', () => select(null)); on('#iAll', showAll); }

  /* ---- cutting part of the engine on its own: only those parts (and what belongs to them) are clipped, by a plane through their middle ---- */
  let cutSolo = null;                                      // the ids cut on their own
  const boxOf = ids => { const box = new THREE.Box3(); for (const id of ids) for (const m of PW.meshesOf(id)) if (m.visible) box.expandByObject(m); return box; };
  function cutPart(ids, mode) { ids = [].concat(ids);
    const keep = new Set(ids.flatMap(PW.sub)), box = boxOf(ids);
    for (const p of PW.parts.values()) p.cut = keep.has(p.id);
    PW.cut.pivot.copy(box.isEmpty() ? new THREE.Vector3() : box.getCenter(new THREE.Vector3()));
    const m = mode || (PW.cut.on ? PW.cut.mode : 'view');
    PW.cut.on = true; PW.setCutPlane(m, 0); document.getElementById('cutOff').value = 0;
    press('[data-cut]', document.querySelector(`[data-cut="${m}"]`)); PW.applyCut(); cutSolo = ids; showInfo();
  }
  function wholeAgain() {
    for (const p of PW.parts.values()) p.cut = true; PW.cut.pivot.set(0, 0, 0); PW.cut.on = false; PW.setCutPlane(null, 0);
    document.getElementById('cutOff').value = 0; press('[data-cut]', document.querySelector('[data-cut="off"]')); PW.applyCut(); cutSolo = null; showInfo();
  }
  function toggleCut() { if (!sel) return; if (cutSolo && cutSolo.length === 1 && cutSolo[0] === sel) wholeAgain(); else cutPart(sel); }

  function select(id, add) {
    if (add && id) { if (selSet.has(id)) selSet.delete(id); else selSet.add(id); sel = selSet.has(id) ? id : (selIds().pop() || null); }
    else { selSet.clear(); if (id) selSet.add(id); sel = id || null; }
    retint(); syncTreeSel();
    if (sel && selSet.size === 1) { const el = document.querySelector(`#tree .nm[data-id="${CSS.escape(sel)}"]`); if (el) { for (let k = el.closest('.kids'); k; k = k.parentElement.closest('.kids')) k.hidden = false; el.scrollIntoView({ block: 'nearest' }); } }
    showInfo();
  }
  function selectMany(ids, add) { if (!add) selSet.clear(); for (const id of ids) selSet.add(id); sel = selIds().pop() || null; retint(); syncTreeSel(); showInfo(); }
  const syncTreeSel = () => document.querySelectorAll('#tree .nm').forEach(b => b.setAttribute('aria-pressed', String(selSet.has(b.dataset.id))));

  /* ---- Show only and Inspect, and the way back: the state before is kept, and Back (or Esc) puts it back exactly ---- */
  let saved = null;
  const modeEl = document.getElementById('mode');
  function saveState(text) {
    if (!saved) { const W = PW.ctl.want;
      saved = { hidden: new Map([...PW.parts.values()].map(p => [p.id, [p.hidden, p.obj.visible]])), cam: { theta: W.theta, phi: W.phi, r: W.r, target: W.target.clone() },
        cut: { on: PW.cut.on, mode: PW.cut.mode, offset: PW.cut.offset, pivot: PW.cut.pivot.clone(), solo: cutSolo, flags: new Map([...PW.parts.values()].map(p => [p.id, p.cut])) } }; }
    document.getElementById('modeText').textContent = text; modeEl.hidden = false;
  }
  /* the pieces of a shown part's ancestors that Show only hid (their own meshes); only these are turned back on, so meshes the model
     hides itself (the lockout pins and plates, for one) stay as they were */
  const isoHidden = new Set();
  const unIso = () => { for (const m of isoHidden) m.visible = true; isoHidden.clear(); };
  function restoreState() {
    if (!saved) return; const s = saved; saved = null; modeEl.hidden = true; unIso();
    for (const p of PW.parts.values()) { const h = s.hidden.get(p.id); if (h) { p.hidden = h[0]; p.obj.visible = h[1]; } p.cut = s.cut.flags.get(p.id) !== false; }
    PW.cut.on = s.cut.on; PW.cut.pivot.copy(s.cut.pivot); PW.setCutPlane(s.cut.mode, s.cut.offset); cutSolo = s.cut.solo;
    document.getElementById('cutOff').value = s.cut.offset; press('[data-cut]', document.querySelector(`[data-cut="${s.cut.on ? s.cut.mode : 'off'}"]`));
    PW.look(s.cam.theta, s.cam.phi, s.cam.r, s.cam.target.toArray());
    syncTree(); PW.applyCut(); showInfo();
  }
  const describe = ids => ids.length === 1 ? label(ids[0]) : `${ids.length} parts`;
  function isolate(ids, text) { ids = [].concat(ids).filter(Boolean); if (!ids.length) return;
    saveState(text || `Showing only ${describe(ids)}`); unIso();
    const keep = new Set(ids.flatMap(PW.sub)), up = new Set();
    for (const id of ids) for (let p = PW.parts.get(id); p && p.parent; p = PW.parts.get(p.parent)) up.add(p.parent);
    for (const p of PW.parts.values()) { const k = keep.has(p.id); p.hidden = !k; p.obj.visible = k || up.has(p.id);
      if (!k && up.has(p.id)) for (const m of p.meshes) if (m.visible) { m.visible = false; isoHidden.add(m); } }   // an ancestor carries the part but shows none of its own pieces
    syncTree(); PW.applyCut(); focus(ids); }
  function inspect() { const ids = selIds(); if (!ids.length) return; isolate(ids, `Inspecting ${describe(ids)}`); cutPart(ids, 'view'); }
  function showParts(ids) { for (const id of ids) { const p = PW.parts.get(id); if (!p) continue; p.hidden = false; p.obj.visible = true;
      for (const m of p.meshes) if (isoHidden.has(m)) { m.visible = true; isoHidden.delete(m); }
      for (let q = p.parent && PW.parts.get(p.parent); q; q = q.parent && PW.parts.get(q.parent)) q.obj.visible = true; }
    syncTree(); PW.applyCut(); }
  function showAll() {
    if (saved) { saved = null; modeEl.hidden = true; }
    unIso(); if (cutSolo) wholeAgain();
    for (const p of PW.parts.values()) { p.hidden = false; p.obj.visible = true; }
    hideStack.length = 0; areaHidden = []; setNacelle(nacMode); syncTree(); PW.applyCut(); showInfo(); }
  document.getElementById('modeBack').onclick = restoreState;
  /* hiding: H hides the selection, U shows the last hidden parts again */
  const hideStack = [];
  function hideSelected() { const ids = selIds(); if (!ids.length) return; for (const id of ids) PW.setHidden(id, true); hideStack.push(ids); syncTree(); PW.applyCut(); select(null); }
  function unhideLast() { const ids = hideStack.pop(); if (!ids) return; for (const id of ids) PW.setHidden(id, false); syncTree(); PW.applyCut(); selectMany(ids); }
  function focus(ids) { const box = boxOf([].concat(ids).filter(Boolean));
    if (box.isEmpty()) return; const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3()).length();
    PW.ctl.want.target.copy(c); PW.ctl.want.r = Math.max(.6, s * 1.6); }

  /* ---- tree ---- */
  const tree = document.getElementById('tree');
  function node(id) {
    const p = PW.parts.get(id), wrap = document.createElement('div'), row = document.createElement('div'); row.className = 'node';
    const tw = document.createElement('button'); tw.className = 'tw'; tw.textContent = p.children.length ? '▸' : '';
    const nm = document.createElement('button'); nm.className = 'nm'; nm.textContent = p.label; nm.dataset.id = id; nm.title = p.label;
    const eye = document.createElement('button'); eye.className = 'eye'; eye.textContent = '●'; eye.title = 'Show or hide'; eye.dataset.id = id;
    row.append(tw, nm, eye); wrap.append(row);
    nm.onclick = e => { const add = e.ctrlKey || e.metaKey || e.shiftKey; select(!add && sel === id && selSet.size === 1 ? null : id, add); };
    nm.ondblclick = () => focus([id]);
    nm.onmouseenter = () => setHover(id); nm.onmouseleave = () => setHover(null);
    eye.onclick = () => { const h = !p.hidden; PW.setHidden(id, h); if (h) hideStack.push([id]); syncTree(); PW.applyCut(); };
    if (p.children.length) { const kids = document.createElement('div'); kids.className = 'kids'; kids.hidden = true;
      p.children.forEach(k => kids.append(node(k))); wrap.append(kids);
      tw.onclick = () => { kids.hidden = !kids.hidden; tw.textContent = kids.hidden ? '▸' : '▾'; }; }
    return wrap;
  }
  [...PW.parts.values()].filter(p => !p.parent).forEach(p => tree.append(node(p.id)));
  function syncTree() { tree.querySelectorAll('.eye').forEach(e => e.classList.toggle('off', PW.parts.get(e.dataset.id).hidden)); }
  document.getElementById('find').addEventListener('input', e => { const q = e.target.value.trim().toLowerCase();
    tree.querySelectorAll('.node').forEach(r => { const id = r.querySelector('.nm').dataset.id, hit = !q || label(id).toLowerCase().includes(q) || id.includes(q);
      r.style.display = hit || [...r.parentElement.querySelectorAll('.nm')].some(b => label(b.dataset.id).toLowerCase().includes(q)) ? '' : 'none'; });
    if (q) tree.querySelectorAll('.kids').forEach(k => k.hidden = false); });

  /* ---- canvas picking ---- */
  function setHover(id) { if (hover === id) return; hover = id; retint(); }
  let hoverT = 0, tool = 'turn';
  const cursorFor = h => tool === 'area' ? 'crosshair' : h ? (tool === 'move' ? 'move' : 'pointer') : 'grab';
  PW.onHover = e => { const now = performance.now(); if (now - hoverT < 50) return; hoverT = now; const h = tool === 'area' ? null : PW.pick(e); setHover(h && h.id); PW.renderer.domElement.style.cursor = cursorFor(h); };
  PW.onClick = e => { const h = PW.pick(e), add = e.ctrlKey || e.metaKey || e.shiftKey;
    if (tool === 'move') { if (!h) select(null); return; }
    if (!h) { if (!add) { areaHidden = []; select(null); } return; }
    select(!add && sel === h.id && selSet.size === 1 ? null : h.id, add); };
  PW.onDblClick = e => { const h = PW.pick(e); if (h) { if (!selSet.has(h.id)) select(h.id); focus([h.id]); } };

  /* ---- Move parts: press on a part and drag it out of the engine, in the plane facing the camera. Pressing on any piece of the
     selected part moves the whole of it, so a module picked in the list moves as one; anywhere else picks the piece under the pointer.
     Dragging empty space still turns the view, and right-drag still pans.
     Select area: drag a box; every visible part whose middle is inside it is selected (Shift or Ctrl adds to the selection), and any
     hidden parts there are offered back ---- */
  const dragPlane = new THREE.Plane(), rc = new THREE.Raycaster(), hitV = new THREE.Vector3(), marquee = document.getElementById('marquee');
  const rayAt = e => { const r = PW.renderer.domElement.getBoundingClientRect(); rc.setFromCamera(new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1), PW.camera); return rc.ray; };
  let area = null;
  PW.onDown = (e, drag) => {
    if (e.button !== 0) return;
    if (tool === 'area') { area = { x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY, add: e.shiftKey || e.ctrlKey || e.metaKey }; drag.area = true; return; }
    if (tool !== 'move' || e.shiftKey) return;
    const h = PW.pick(e); if (!h) return;
    const id = sel && PW.sub(sel).includes(h.id) ? sel : h.id; if (id !== sel || selSet.size > 1) select(id);
    dragPlane.setFromNormalAndCoplanarPoint(PW.camera.getWorldDirection(new THREE.Vector3()), h.point);
    drag.grab = { id, last: h.point.clone() };
  };
  PW.onDrag = (e, dx, dy, drag) => {
    if (drag.area && area) { area.x1 = e.clientX; area.y1 = e.clientY;
      Object.assign(marquee.style, { display: 'block', left: Math.min(area.x0, area.x1) + 'px', top: Math.min(area.y0, area.y1) + 'px', width: Math.abs(area.x1 - area.x0) + 'px', height: Math.abs(area.y1 - area.y0) + 'px' });
      return true; }
    if (!drag.grab) return false;
    if (rayAt(e).intersectPlane(dragPlane, hitV)) { const step = hitV.clone().sub(drag.grab.last); PW.dragPart(drag.grab.id, step); drag.grab.last.copy(hitV);
      if (cutSolo && cutSolo.some(c => PW.sub(drag.grab.id).includes(c))) { PW.cut.pivot.add(step); PW.setCutPlane(null); } }          // a part cut on its own takes its cut with it
    return true;
  };
  PW.onDragEnd = (e, d) => {
    if (area) { const a = area; area = null; marquee.style.display = 'none';
      if (d && d.moved) { const inBox = partsInBox(a); areaHidden = inBox.hidden; selectMany(inBox.shown, a.add); } return; }
    if (sel) showInfo(); };
  /* what a screen box holds: the parts you can see in it (drawn once more with each part in its own flat colour, and the box's pixels
     read back, so parts behind others are left out), and the hidden parts whose middle lies inside it */
  const shownNow = p => { for (let o = p.obj; o && o !== PW.root; o = o.parent) if (!o.visible) return false; return true; };
  let pickRT = null; const pickMats = new Map();
  function visibleInBox(xa, ya, xb, yb) {
    const R = PW.renderer, cv = R.domElement, r = cv.getBoundingClientRect(), W = cv.width, H = cv.height, sx = W / r.width, sy = H / r.height;
    if (!pickRT || pickRT.width !== W || pickRT.height !== H) { if (pickRT) pickRT.dispose(); pickRT = new THREE.WebGLRenderTarget(W, H); }
    const ids = [...PW.parts.keys()], num = new Map(ids.map((id, i) => [id, i + 1])), swaps = [], hz = [], S = PW.scene;
    const keep = { bg: S.background, fog: S.fog };
    /* every visible piece of the engine takes its part's colour; anything that is not a part's (helpers, ghosts, labels) sits this out */
    PW.root.traverse(o => { if (!o.visible) return;
      if (o.isLine || o.isPoints || o.isSprite) { hz.push(o); return; }
      if (!o.isMesh) return;
      let q = o; while (q && !q.userData.pid) q = q.parent; const p = q && PW.parts.get(q.userData.pid);
      if (!p || p.ghost || o.userData.noPick || !o.material || Array.isArray(o.material)) { hz.push(o); return; }
      const om = o.material, n = num.get(p.id), key = n + (om.clippingPlanes && om.clippingPlanes.length ? 'c' : '') + om.side;
      if (!pickMats.has(key)) pickMats.set(key, new THREE.MeshBasicMaterial({ color: new THREE.Color((n & 255) / 255, (n >> 8 & 255) / 255, 0), toneMapped: false, fog: false, side: om.side, clippingPlanes: om.clippingPlanes || [] }));
      swaps.push([o, om]); o.material = pickMats.get(key); });
    for (const o of hz) o.visible = false;
    S.background = new THREE.Color(0, 0, 0); S.fog = null;
    for (const o of S.children) if (o !== PW.root && o.visible && o !== PW.camera && !o.isLight) { hz.push(o); o.visible = false; }   // the floor, the cut cap, the hazard areas
    R.setRenderTarget(pickRT); R.clear(); R.render(S, PW.camera); R.setRenderTarget(null);
    const x0 = Math.max(0, Math.floor((xa - r.left) * sx)), x1 = Math.min(W, Math.ceil((xb - r.left) * sx)), y0 = Math.max(0, Math.floor((r.bottom - yb) * sy)), y1 = Math.min(H, Math.ceil((r.bottom - ya) * sy));
    const out = new Set();
    if (x1 > x0 && y1 > y0) { const buf = new Uint8Array((x1 - x0) * (y1 - y0) * 4); R.readRenderTargetPixels(pickRT, x0, y0, x1 - x0, y1 - y0, buf);
      for (let k = 0; k < buf.length; k += 4) { const n = buf[k] + buf[k + 1] * 256; if (n) out.add(ids[n - 1]); } }
    for (const [m, om] of swaps) m.material = om;
    for (const o of hz) o.visible = true;
    S.background = keep.bg; S.fog = keep.fog;
    return [...out];
  }
  function partsInBox(a) {
    const r = PW.renderer.domElement.getBoundingClientRect(), xa = Math.min(a.x0, a.x1), xb = Math.max(a.x0, a.x1), ya = Math.min(a.y0, a.y1), yb = Math.max(a.y0, a.y1);
    const out = { shown: visibleInBox(xa, ya, xb, yb), hidden: [] }, c = new THREE.Vector3(); PW.root.updateMatrixWorld(true);
    for (const p of PW.parts.values()) {
      if (!p.meshes.length || p.ghost || (!p.hidden && shownNow(p))) continue;
      const box = new THREE.Box3(); for (const m of p.meshes) box.expandByObject(m); if (box.isEmpty()) continue;
      box.getCenter(c).project(PW.camera); if (c.z < -1 || c.z > 1) continue;
      const px = r.left + (c.x + 1) / 2 * r.width, py = r.top + (1 - c.y) / 2 * r.height;
      if (px >= xa && px <= xb && py >= ya && py <= yb) out.hidden.push(p.id); }
    return out;
  }

  /* ---- toolbar ---- */
  const press = (sel0, el) => document.querySelectorAll(sel0).forEach(b => b.setAttribute('aria-pressed', String(b === el)));
  const VIEWS = { left: [-Math.PI / 2, 1.45, 8.5], right: [Math.PI / 2, 1.45, 8.5], front: [0, 1.45, 8.5], rear: [Math.PI, 1.45, 8.5], top: [-Math.PI / 2, .12, 8.5], below: [-Math.PI / 2, 3.0, 8.5] };
  const goView = name => { const v = VIEWS[name]; PW.look(v[0], v[1], v[2], [PW.CENTER_X || -.8, 0, 0]); };
  document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => goView(b.dataset.view));
  /* the toolbar Section cuts the whole engine about its axis; it clears a part cut on its own */
  document.querySelectorAll('[data-cut]').forEach(b => b.onclick = () => { press('[data-cut]', b); const m = b.dataset.cut;
    if (cutSolo) { for (const p of PW.parts.values()) p.cut = true; PW.cut.pivot.set(0, 0, 0); cutSolo = null; showInfo(); }
    PW.cut.on = m !== 'off'; if (PW.cut.on) PW.setCutPlane(m, +document.getElementById('cutOff').value); PW.applyCut(); });
  const setTool = t => { tool = t; press('[data-tool]', document.querySelector(`[data-tool="${t}"]`)); PW.renderer.domElement.style.cursor = cursorFor(null); };
  document.querySelectorAll('[data-tool]').forEach(b => b.onclick = () => setTool(b.dataset.tool));
  document.getElementById('putBack').onclick = () => PW.putBack([...PW.parts.keys()]);
  PW.onPutBack = () => { recentreCut(); showInfo(); };                          // when the parts have slid home
  function recentreCut() { if (!cutSolo) return; PW.root.updateMatrixWorld(true); const box = boxOf(cutSolo);
    if (!box.isEmpty()) { box.getCenter(PW.cut.pivot); PW.setCutPlane(null); } }
  document.getElementById('cutOff').oninput = e => PW.setCutPlane(null, +e.target.value);
  /* exploding opens the engine in layers and finally spreads it over about 11 m: pull the camera back as each layer opens so the
     whole breakdown stays in view (the stretches match the layers in build-nacelle.js) */
  let lastT = 0;
  const ease = s => (s <= 0 ? 0 : s >= 1 ? 1 : s * s * (3 - 2 * s));
  const reach = t => 6 + 2 * ease(t / .22) + 1 * ease((t - .18) / .27) + 1 * ease((t - .4) / .28) + 5.5 * ease((t - .62) / .38);
  const explodeEl = document.getElementById('explode');
  function setExplode(t) { PW.setExplode(t); explodeEl.value = t;
    if (t > lastT) { const W = PW.ctl.want; W.r = Math.max(W.r, reach(t)); W.target.x = W.target.x + ((-1.3 - 1.3 * ease((t - .62) / .38)) - W.target.x) * .5; }
    lastT = t; }
  explodeEl.oninput = e => setExplode(+e.target.value);
  let nacMode = 'on';
  function setNacelle(m) { nacMode = m; const ids = PW.NACELLE_IDS || []; for (const id of ids) { PW.setHidden(id, m === 'off'); PW.setGhost(id, m === 'ghost'); } syncTree(); PW.applyCut(); }
  document.querySelectorAll('[data-nac]').forEach(b => b.onclick = () => { press('[data-nac]', b); setNacelle(b.dataset.nac); });
  /* Home: back to the start, everything shown, nothing cut, exploded or moved, nothing selected, the opening view */
  function home() {
    saved = null; modeEl.hidden = true; unIso(); if (cutSolo || PW.cut.on) wholeAgain();
    setExplode(0); lastT = 0; PW.putBack([...PW.parts.keys()]);
    for (const p of PW.parts.values()) { p.hidden = false; p.obj.visible = true; }
    hideStack.length = 0; areaHidden = []; setNacelle(nacMode); syncTree(); PW.applyCut(); setTool('turn'); select(null);
    PW.look(-.8, 1.32, 9.6, [-1.0, .1, 0]); }
  document.getElementById('home').onclick = home;
  const keysEl = document.getElementById('keys'), keysBtn = document.getElementById('keysBtn');
  const toggleKeys = on => { keysEl.hidden = on === undefined ? !keysEl.hidden : !on; keysBtn.setAttribute('aria-pressed', String(!keysEl.hidden)); };
  keysBtn.onclick = () => toggleKeys();
  /* p.6-7: the engine ground run hazard areas, laid on the floor while the engine runs. The intake suction danger area reaches 2.74 m
     (9 ft) round the inlet and 0.91 m (3 ft) back along the nacelle at ground idle, 6.10 m (20 ft) and 1.83 m (6 ft) at takeoff power;
     the exhaust danger area is a 30 deg wedge aft of the exhaust nozzle, 61 m (200 ft) long at idle and 183 m (600 ft) at takeoff
     (it runs on into the fog). At idle the entry corridor shows the way in: between the intake area and the wing leading edge,
     drawn on this (right) engine's outboard side, the wing's sweep taken from the figure */
  const hazards = (() => {
    const D = PW.D, xHL = D.zsToX(D.ZS.inletHighlight), xN = D.zsToX(D.ZS.sleeveTE), yF = PW.floor ? PW.floor.position.y : -1.75, TAU = Math.PI * 2;
    const root = new THREE.Group(); root.visible = false; PW.scene.add(root);
    const lin = c => new THREE.Color(c).convertSRGBToLinear();
    const mat = (c, o) => new THREE.MeshBasicMaterial({ color: lin(c), transparent: true, opacity: o, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, toneMapped: false });   // the figure's colours, not the scene's tone curve
    /* a flat region on the floor from [x, z] points (x forward, z to the engine's right), with its outline */
    const flat = (grp, pts, c, o, dy) => { const s = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z))), g = new THREE.ShapeGeometry(s); g.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(g, mat(c, o)); m.position.y = yF + dy; m.renderOrder = 2; m.userData.noPick = true; grp.add(m);
      const lg = new THREE.BufferGeometry().setFromPoints(pts.concat([pts[0]]).map(([x, z]) => new THREE.Vector3(x, yF + dy + .002, z)));
      const ln = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: lin(c), transparent: true, opacity: .95 })); ln.userData.noPick = true; grp.add(ln); };
    /* a label that always faces the viewer, a little above the floor; each line is shrunk to fit if it would run past the edge */
    const label = (grp, lines, x, z, w) => { const cv = document.createElement('canvas'); cv.width = 640; cv.height = 60 * lines.length + 20; const c = cv.getContext('2d');
      c.fillStyle = 'rgba(16,22,30,.8)'; c.fillRect(0, 0, cv.width, cv.height); c.textAlign = 'center';
      lines.forEach((t, i) => { let px = i ? 30 : 34; c.font = (i ? '' : 'bold ') + px + 'px Arial, sans-serif';
        const tw = c.measureText(t).width; if (tw > cv.width - 40) { px = Math.floor(px * (cv.width - 40) / tw); c.font = (i ? '' : 'bold ') + px + 'px Arial, sans-serif'; }
        c.fillStyle = i ? '#e8edf3' : '#ffb347'; c.fillText(t, cv.width / 2, 48 + i * 58); });
      const tx = new THREE.CanvasTexture(cv); tx.encoding = THREE.sRGBEncoding;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true, fog: false, depthWrite: false })); sp.scale.set(w, w * cv.height / cv.width, 1);
      sp.position.set(x, yF + .06 + sp.scale.y / 2, z); sp.userData.noPick = true; sp.renderOrder = 3; grp.add(sp); };
    const make = (R, d, L, run) => { const grp = new THREE.Group(); root.add(grp);
      const inlet = [[xHL - d, -R]]; for (let i = 0; i <= 32; i++) { const a = -Math.PI / 2 + Math.PI * i / 32; inlet.push([xHL + R * Math.cos(a), R * Math.sin(a)]); } inlet.push([xHL - d, R]);
      flat(grp, inlet, 0xf28a1e, .78, .004);                                            // p.7's colours, nearly solid on the light hangar floor
      const w0 = .85, a0 = w0 / Math.tan(Math.PI / 12), ex = [[xN, w0]]; for (let i = 0; i <= 24; i++) { const t = Math.PI / 12 - Math.PI / 6 * i / 24; ex.push([xN + a0 - (L + a0) * Math.cos(t), (L + a0) * Math.sin(t)]); } ex.push([xN, -w0]);
      flat(grp, ex, 0xfcbf4f, .68, .003);
      const ft = Math.round(R / .3048), fd = Math.round(d / .3048), fL = Math.round(L / .3048);
      label(grp, ['INTAKE SUCTION DANGER AREA', `${R.toFixed(2)} m (${ft} ft) at ${run}`, `and ${d.toFixed(2)} m (${fd} ft) back along the nacelle`], xHL + R * .55, -R * .35 - .4, 2.2);
      label(grp, ['EXHAUST DANGER AREA', `aft of the nozzle, 30 deg wide`, `${Math.round(L)} m (${fL} ft) at ${run}`], xN - 7, 0, 2.6);
      return grp; };
    const idle = make(2.74, .91, 61, 'ground idle'), to = make(6.10, 1.83, 183, 'takeoff power');
    /* the entry corridor at idle: aft of the intake area, forward of the wing's leading edge (x = -0.9 - 0.6 z on this side) */
    const zIn = (-.9 - (xHL - .91)) / .6, zOut = 13;
    flat(idle, [[xHL - .91, zIn], [xHL - .91, zOut], [-.9 - .6 * zOut, zOut]], 0x737980, .5, .002);
    label(idle, ['ENTRY CORRIDOR', 'approach a running engine here'], xHL - 2.2, 6.0, 2.2);
    return s => { root.visible = s > 0; idle.visible = s > 0 && s < .5; to.visible = s >= .5; };
  })();
  document.querySelectorAll('[data-run]').forEach(b => { if (+b.dataset.run > 0) b.title = 'Also shows the ground run hazard areas for this power (p.6-7)';
    b.onclick = () => { press('[data-run]', b); PW.speed = +b.dataset.run; hazards(PW.speed); }; });
  PW.speed = 0;
  /* controls the builders asked for (cowls, reverser) */
  for (const c of PW.controls || []) {
    const g = document.createElement('div'); g.className = 'grp'; g.innerHTML = `<label>${esc(c.label)}</label>`;
    c.buttons.forEach((b, i) => { const el = document.createElement('button'); el.className = 'b'; el.textContent = b.label; el.setAttribute('aria-pressed', String(!!b.on));
      el.onclick = () => { g.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === el))); b.apply(); }; g.append(el); });
    document.querySelector('header.top').append(g);
  }

  /* ---- keyboard ---- */
  addEventListener('keydown', e => {
    const t = e.target; if (t && t.closest && t.closest('input, textarea, select')) { if (e.key === 'Escape') t.blur(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const act = {
      h: hideSelected, u: unhideLast, a: showAll, i: inspect, x: () => isolate(selIds()), f: () => focus(selIds()), c: toggleCut,
      t: () => setTool('turn'), b: () => setTool(tool === 'area' ? 'turn' : 'area'), m: () => setTool(tool === 'move' ? 'turn' : 'move'),
      '1': () => goView('left'), '2': () => goView('right'), '3': () => goView('front'), '4': () => goView('rear'), '5': () => goView('top'), '6': () => goView('below'),
      '?': () => toggleKeys(), '/': () => toggleKeys(), Home: home,
      Escape: () => { if (!keysEl.hidden) toggleKeys(false); else if (saved) restoreState(); else if (area) { area = null; marquee.style.display = 'none'; } else if (selSet.size || areaHidden.length) { areaHidden = []; select(null); } } }[k];
    if (act) { e.preventDefault(); act(); }
  });

  /* ---- labels: name the selected and hovered part ---- */
  const tags = document.getElementById('tags'), tagEl = document.createElement('div'); tagEl.className = 'tag'; tags.append(tagEl); tagEl.style.display = 'none';
  const v = new THREE.Vector3();
  PW.start(() => {
    const id = hover || sel, p = id && PW.parts.get(id);
    if (!p) { tagEl.style.display = 'none'; return; }
    /* the anchor is kept in the part's own frame, so the label follows it when it is exploded, swung open or turned with its spool */
    if (!p.anchorLocal) { const box = new THREE.Box3(); for (const m of PW.meshesOf(id)) if (m.visible) box.expandByObject(m); if (box.isEmpty()) { tagEl.style.display = 'none'; return; }
      box.getCenter(v); p.obj.updateMatrixWorld(true); p.anchorLocal = p.obj.worldToLocal(v.clone()); }
    v.copy(p.anchorLocal); p.obj.localToWorld(v);
    const q = v.clone().project(PW.camera); if (q.z > 1) { tagEl.style.display = 'none'; return; }
    tagEl.textContent = p.label; tagEl.style.display = 'block';
    tagEl.style.left = ((q.x + 1) / 2 * innerWidth) + 'px'; tagEl.style.top = ((1 - q.y) / 2 * innerHeight) + 'px';
  });
  /* the toolbar wraps on narrow windows: keep the parts list below it */
  const fitList = () => { const hb = document.querySelector('header.top').getBoundingClientRect().bottom; document.getElementById('list').style.top = (hb + 8) + 'px';
    modeEl.style.top = (hb + 8) + 'px'; keysEl.style.top = (hb + 8) + 'px'; };
  addEventListener('resize', fitList); fitList();
  showInfo();
  PW.look(-.8, 1.32, 9.6, [-1.0, .1, 0]);                                       // front three-quarter view from the left
  window.PWUI = { select, selectMany, isolate, inspect, showAll, focus, setNacelle, cutPart, wholeAgain, home, restoreState, partsInBox, setTool };
  /* URL options for review and testing: ?part=<id> isolates and selects a part, ?cut=top|left|right|view, ?view=left|right|front|rear|top|below,
     ?nacelle=off|ghost, ?run=0..1, ?explode=0..1 */
  const Q = new URLSearchParams(location.search);
  if (Q.get('nacelle')) { setNacelle(Q.get('nacelle')); press('[data-nac]', document.querySelector(`[data-nac="${Q.get('nacelle')}"]`)); }
  if (Q.get('view') && VIEWS[Q.get('view')]) goView(Q.get('view'));
  if (Q.get('cut')) { PW.cut.on = true; PW.setCutPlane(Q.get('cut'), 0); PW.applyCut(); press('[data-cut]', document.querySelector(`[data-cut="${Q.get('cut')}"]`)); }
  if (Q.get('run')) { PW.speed = +Q.get('run'); hazards(PW.speed); }
  if (Q.get('explode')) { PW.setExplode(+Q.get('explode')); explodeEl.value = Q.get('explode'); }
  if (Q.get('part') && PW.parts.has(Q.get('part'))) { select(Q.get('part')); isolate([Q.get('part')]); }
})();
