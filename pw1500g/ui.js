/* PW1500G model: page wiring. Builds the engine, the parts tree, the info card and the toolbar. */
(function () {
  const PW = window.PW;
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  PW.init(document.getElementById('gl'));
  for (const b of PW.builders || []) b();
  for (const p of PW.parts.values()) p.base.copy(p.obj.position);
  PW.applyCut();

  /* ---- selection ---- */
  let sel = null, hover = null;
  const info = document.getElementById('info');
  const label = id => (PW.parts.get(id) || {}).label || id;
  const path = id => { const out = []; for (let p = PW.parts.get(id); p; p = p.parent && PW.parts.get(p.parent)) out.unshift(p.label); return out; };
  function showInfo() {
    if (!sel) { info.innerHTML = `<h2>PW1500G geared turbofan</h2><div class="sub">A220-300 &middot; drag to turn, right-drag to pan, scroll to zoom</div>
      <p>Click any part, or pick it from the list, to see what it is, where it sits and what maintenance does with it. Use Section to cut the engine open and Explode to pull the modules apart.</p>`; return; }
    const p = PW.parts.get(sel);
    info.innerHTML = `<h2>${esc(p.label)}</h2><div class="sub">${esc(path(sel).slice(0, -1).join(' › '))}</div>${(p.info || '').split('\n\n').map(t => `<p>${esc(t)}</p>`).join('')}
      <div class="acts"><button class="b" id="iIso">Isolate</button><button class="b" id="iHide">Hide</button><button class="b" id="iCut" aria-pressed="${p.cut}">Cut with section</button><button class="b" id="iFocus">Zoom to</button><button class="b" id="iAll">Show all</button></div>
      ${p.src ? `<div class="src">Source: ${esc(p.src)}</div>` : ''}`;
    info.querySelector('#iIso').onclick = () => isolate(sel);
    info.querySelector('#iHide').onclick = () => { PW.setHidden(sel, true); syncTree(); select(null); };
    info.querySelector('#iCut').onclick = e => { for (const k of PW.sub(sel)) PW.parts.get(k).cut = !p.cut; e.currentTarget.setAttribute('aria-pressed', String(p.cut)); PW.applyCut(); };
    info.querySelector('#iFocus').onclick = () => focus(sel);
    info.querySelector('#iAll').onclick = showAll;
  }
  function select(id) {
    if (sel) PW.tint(sel, null); sel = id; if (sel) PW.tint(sel, 'sel');
    document.querySelectorAll('#tree .nm').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === sel)));
    if (sel) { const el = document.querySelector(`#tree .nm[data-id="${CSS.escape(sel)}"]`); if (el) { for (let k = el.closest('.kids'); k; k = k.parentElement.closest('.kids')) k.hidden = false; el.scrollIntoView({ block: 'nearest' }); } }
    showInfo();
  }
  function isolate(id) { const keep = new Set(PW.sub(id)); for (let p = PW.parts.get(id); p && p.parent; p = PW.parts.get(p.parent)) keep.add(p.parent);
    for (const p of PW.parts.values()) { p.hidden = !keep.has(p.id); p.obj.visible = !p.hidden || [...keep].some(k => PW.sub(p.id).includes(k)); }
    for (const k of PW.sub(id)) { const p = PW.parts.get(k); p.hidden = false; p.obj.visible = true; }
    syncTree(); PW.applyCut(); focus(id); }
  function showAll() { for (const p of PW.parts.values()) { p.hidden = false; p.obj.visible = true; } setNacelle(nacMode); syncTree(); PW.applyCut(); }
  function focus(id) { const box = new THREE.Box3(); for (const m of PW.meshesOf(id)) if (m.visible) box.expandByObject(m);
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
    nm.onclick = () => select(sel === id ? null : id);
    nm.onmouseenter = () => setHover(id); nm.onmouseleave = () => setHover(null);
    eye.onclick = () => { PW.setHidden(id, !p.hidden); syncTree(); PW.applyCut(); };
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
  function setHover(id) { if (hover === id) return; if (hover && hover !== sel) PW.tint(hover, null); hover = id; if (hover && hover !== sel) PW.tint(hover, 'hover'); }
  let hoverT = 0;
  PW.onHover = e => { const now = performance.now(); if (now - hoverT < 50) return; hoverT = now; const h = PW.pick(e); setHover(h && h.id); PW.renderer.domElement.style.cursor = h ? 'pointer' : 'grab'; };
  PW.onClick = e => { const h = PW.pick(e); select(h ? (sel === h.id ? null : h.id) : null); };

  /* ---- toolbar ---- */
  const press = (sel0, el) => document.querySelectorAll(sel0).forEach(b => b.setAttribute('aria-pressed', String(b === el)));
  const VIEWS = { left: [-Math.PI / 2, 1.45, 8.5], right: [Math.PI / 2, 1.45, 8.5], front: [0, 1.45, 8.5], rear: [Math.PI, 1.45, 8.5], top: [-Math.PI / 2, .12, 8.5], below: [-Math.PI / 2, 3.0, 8.5] };
  document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => { const v = VIEWS[b.dataset.view]; PW.look(v[0], v[1], v[2], [PW.CENTER_X || -.8, 0, 0]); });
  document.querySelectorAll('[data-cut]').forEach(b => b.onclick = () => { press('[data-cut]', b); const m = b.dataset.cut;
    PW.cut.on = m !== 'off'; if (PW.cut.on) PW.setCutPlane(m, +document.getElementById('cutOff').value); PW.applyCut(); });
  document.getElementById('cutOff').oninput = e => PW.setCutPlane(null, +e.target.value);
  document.getElementById('explode').oninput = e => PW.setExplode(+e.target.value);
  let nacMode = 'on';
  function setNacelle(m) { nacMode = m; const ids = PW.NACELLE_IDS || []; for (const id of ids) { PW.setHidden(id, m === 'off'); PW.setGhost(id, m === 'ghost'); } syncTree(); PW.applyCut(); }
  document.querySelectorAll('[data-nac]').forEach(b => b.onclick = () => { press('[data-nac]', b); setNacelle(b.dataset.nac); });
  document.querySelectorAll('[data-run]').forEach(b => b.onclick = () => { press('[data-run]', b); PW.speed = +b.dataset.run; });
  PW.speed = 0;
  /* controls the builders asked for (cowls, reverser) */
  for (const c of PW.controls || []) {
    const g = document.createElement('div'); g.className = 'grp'; g.innerHTML = `<label>${esc(c.label)}</label>`;
    c.buttons.forEach((b, i) => { const el = document.createElement('button'); el.className = 'b'; el.textContent = b.label; el.setAttribute('aria-pressed', String(!!b.on));
      el.onclick = () => { g.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === el))); b.apply(); }; g.append(el); });
    document.querySelector('header.top').append(g);
  }

  /* ---- labels: name the selected and hovered part ---- */
  const tags = document.getElementById('tags'), tagEl = document.createElement('div'); tagEl.className = 'tag'; tags.append(tagEl); tagEl.style.display = 'none';
  const v = new THREE.Vector3();
  PW.start(() => {
    const id = hover || sel, p = id && PW.parts.get(id);
    if (!p) { tagEl.style.display = 'none'; return; }
    if (p.anchor) v.copy(p.anchor); else { const box = new THREE.Box3(); for (const m of PW.meshesOf(id)) box.expandByObject(m); if (box.isEmpty()) { tagEl.style.display = 'none'; return; } box.getCenter(v); p.anchor = v.clone(); }
    const q = v.clone().project(PW.camera); if (q.z > 1) { tagEl.style.display = 'none'; return; }
    tagEl.textContent = p.label; tagEl.style.display = 'block';
    tagEl.style.left = ((q.x + 1) / 2 * innerWidth) + 'px'; tagEl.style.top = ((1 - q.y) / 2 * innerHeight) + 'px';
  });
  /* the toolbar wraps on narrow windows: keep the parts list below it */
  const fitList = () => { const hb = document.querySelector('header.top').getBoundingClientRect().bottom; document.getElementById('list').style.top = (hb + 8) + 'px'; };
  addEventListener('resize', fitList); fitList();
  showInfo();
  PW.look(-2.2, 1.25, 8.5, [PW.CENTER_X || -.8, 0, 0]);
  window.PWUI = { select, isolate, showAll, focus, setNacelle };
  /* URL options for review and testing: ?part=<id> isolates and selects a part, ?cut=top|left|right|view, ?view=left|right|front|rear|top|below,
     ?nacelle=off|ghost, ?run=0..1, ?explode=0..1 */
  const Q = new URLSearchParams(location.search);
  if (Q.get('nacelle')) { setNacelle(Q.get('nacelle')); press('[data-nac]', document.querySelector(`[data-nac="${Q.get('nacelle')}"]`)); }
  if (Q.get('view') && VIEWS[Q.get('view')]) { const v = VIEWS[Q.get('view')]; PW.look(v[0], v[1], v[2], [PW.CENTER_X || -.8, 0, 0]); }
  if (Q.get('cut')) { PW.cut.on = true; PW.setCutPlane(Q.get('cut'), 0); PW.applyCut(); press('[data-cut]', document.querySelector(`[data-cut="${Q.get('cut')}"]`)); }
  if (Q.get('run')) PW.speed = +Q.get('run');
  if (Q.get('explode')) { PW.setExplode(+Q.get('explode')); document.getElementById('explode').value = Q.get('explode'); }
  if (Q.get('part') && PW.parts.has(Q.get('part'))) { isolate(Q.get('part')); select(Q.get('part')); }
})();
