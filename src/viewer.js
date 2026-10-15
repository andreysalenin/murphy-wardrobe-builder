/* three.js viewer + offscreen renders for the drawing set. Needs THREE (r128) and MurphyCore. */
(function (root) {
'use strict';
const THREE = root.THREE;
const C = root.MurphyCore;

function srgb(hex) { const c = new THREE.Color(hex); c.convertSRGBToLinear(); return c; }
const KIND_STYLE = {
  carcass: { color: 0xd9c19a, rough: 0.82 }, front: { color: 0xe8d7b6, rough: 0.78 }, frame: { color: 0xcaa774, rough: 0.82 },
  deck: { color: 0xd7b98c, rough: 0.85 }, drawer: { color: 0xe2cfa9, rough: 0.82 }, back: { color: 0xcdb48c, rough: 0.85 },
  plinth: { color: 0xbba07a, rough: 0.85 }, packer: { color: 0xb58d5b, rough: 0.85 }, ledge: { color: 0xd9c19a, rough: 0.82 },
  mattress: { color: 0xeeeeea, rough: 0.95, edges: false }, metal: { color: 0x2f3236, rough: 0.45, metal: 0.4 },
  chrome: { color: 0xc9ccd0, rough: 0.38, metal: 0.35 }, zinc: { color: 0xc4ccd6, rough: 0.32, metal: 0.25 },
  block: { color: 0x8c6239, rough: 0.7 }, rubber: { color: 0x1c1c1e, rough: 0.9, edges: false }, strap: { color: 0x3d4c70, rough: 0.9, edges: false },
};
const T_COL = { 6: 0x7b5cc4, 12: 0x138a7e, 18: 0xc47a12 };

/* prism -> BufferGeometry (flat-shaded caps and sides) */
function prismGeometry(pr) {
  const pos = [], nor = [];
  const P3 = (p, w) => C.to3(pr, p, w);
  const outer = C.loopPolyline(pr.loops[0], 12);
  const holes = pr.loops.slice(1).map(l => C.loopPolyline(l, 12));
  const contour = outer.map(p => new THREE.Vector2(p[0], p[1]));
  const hv = holes.map(h => h.map(p => new THREE.Vector2(p[0], p[1])));
  const tris = THREE.ShapeUtils.triangulateShape(contour, hv);
  const all = outer.concat(...holes);
  const n = pr.n, nn = [-n[0], -n[1], -n[2]];
  for (const t of tris) {
    // bottom (normal -n), reversed winding
    for (const k of [t[0], t[2], t[1]]) { pos.push(...P3(all[k], 0)); nor.push(...nn); }
    for (const k of [t[0], t[1], t[2]]) { pos.push(...P3(all[k], pr.len)); nor.push(...n); }
  }
  const side = (loop, flip) => {
    for (let i = 0; i < loop.length; i++) {
      const a = loop[i], b = loop[(i + 1) % loop.length];
      const d = [b[0] - a[0], b[1] - a[1]], l = Math.hypot(d[0], d[1]) || 1;
      const n2 = [d[1] / l, -d[0] / l];
      const nw = [pr.u[0] * n2[0] + pr.v[0] * n2[1], pr.u[1] * n2[0] + pr.v[1] * n2[1], pr.u[2] * n2[0] + pr.v[2] * n2[1]].map(x => flip ? -x : x);
      const a0 = P3(a, 0), b0 = P3(b, 0), a1 = P3(a, pr.len), b1 = P3(b, pr.len);
      for (const p of [a0, b0, b1, a0, b1, a1]) { pos.push(...p); nor.push(...nw); }
    }
  };
  side(outer, false);
  for (const h of holes) side(h, false);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}
function mergeGeoms(list) {
  if (list.length === 1) return list[0];
  let n = 0; for (const g of list) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  let o = 0;
  for (const g of list) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; g.dispose(); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return g;
}

class MurphyScene {
  constructor() {
    this.scene = new THREE.Scene();
    this.root = new THREE.Group();
    this.scene.add(this.root);
    const hemi = new THREE.HemisphereLight(0xf6f3ee, 0x46423c, 0.62);
    hemi.position.set(0, 0, 1);
    this.scene.add(hemi);
    this.key = new THREE.DirectionalLight(0xffffff, 0.72);
    this.key.position.set(-1500, 4000, 3000);
    this.scene.add(this.key);
    this.fill = new THREE.DirectionalLight(0xffffff, 0.22);
    this.fill.position.set(2500, 1500, 800);
    this.scene.add(this.fill);
    this.materials = {};
    this.edgeMat = new THREE.LineBasicMaterial({ color: 0x24211d, transparent: true, opacity: 0.5 });
    this.arcMat = new THREE.LineDashedMaterial({ color: 0xa8620a, dashSize: 30, gapSize: 18 });
    this.clip = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
    this.opts = { fronts: true, open: 0, section: false, mattress: true, hw: true, bySheet: false, bed: 0, room: true };
    this.recs = [];
    this.openState = null; // Map element id -> 0..1 (the interactive viewer); null: every element at opts.open
    this.elements = [];
  }
  openOf(id) { const m = this.openState; return m && m.has(id) ? m.get(id) : (this.opts.open || 0); }
  mat(key, style, clipped) {
    const k = key + (clipped ? '-c' : '');
    if (!this.materials[k]) {
      this.materials[k] = new THREE.MeshStandardMaterial({ color: srgb(style.color), roughness: style.rough === undefined ? 0.8 : style.rough, metalness: style.metal || 0,
        side: THREE.DoubleSide, clippingPlanes: clipped ? [this.clip] : null, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    }
    return this.materials[k];
  }
  clear() {
    for (const r of this.recs) { if (!r.dyn) r.mesh.geometry.dispose(); if (r.edges) r.edges.geometry.dispose(); }
    this.root.clear();
    this.recs = [];
  }
  setModel(model) {
    this.clear();
    this.model = model;
    const { G } = model;
    // pivot groups
    this.bedPivot = new THREE.Group(); this.bedPivot.position.set(0, G.pivot[0], G.pivot[1]); this.root.add(this.bedPivot);
    this.bedInner = new THREE.Group(); this.bedInner.position.set(0, -G.pivot[0], -G.pivot[1]); this.bedPivot.add(this.bedInner);
    this.legPivot = new THREE.Group(); this.legPivot.position.set(0, G.legPivot[0], G.legPivot[1]); this.bedInner.add(this.legPivot);
    this.legInner = new THREE.Group(); this.legInner.position.set(0, -G.legPivot[0], -G.legPivot[1]); this.legPivot.add(this.legInner);
    this.doors = []; this.flaps = []; this.drawers = [];
    this.dyns = [];
    const unitCyl = new THREE.CylinderGeometry(1, 1, 1, 20, 1); // along +y, centred
    for (const p of model.parts) {
      const style = KIND_STYLE[p.kind] || KIND_STYLE.carcass;
      if (p.dyn && (p.dyn.type === 'spring' || p.dyn.type === 'stay' || p.dyn.type === 'link')) {
        // two tubes re-aimed every frame
        const grp = new THREE.Group();
        const body = new THREE.Mesh(unitCyl, this.mat(p.kind, style, false)), rod = new THREE.Mesh(unitCyl, this.mat('chrome', KIND_STYLE.chrome, false));
        if (p.dyn.type === 'link') { body.material = rod.material; }
        grp.add(body); grp.add(rod);
        this.root.add(grp);
        const rec = { part: p, mesh: body, rod, grp, style, dyn: p.dyn };
        body.userData.rec = rod.userData.rec = rec;
        this.recs.push(rec); this.dyns.push(rec);
        continue;
      }
      const geom = mergeGeoms(p.solids.map(prismGeometry));
      const mesh = new THREE.Mesh(geom, this.mat(p.kind, style, false));
      let edges = null;
      if (style.edges !== false) { edges = new THREE.LineSegments(new THREE.EdgesGeometry(geom, 28), this.edgeMat); }
      const grp = new THREE.Group(); grp.add(mesh); if (edges) grp.add(edges);
      const rec = { part: p, mesh, edges, grp, style };
      mesh.userData.rec = rec;
      if (p.leg) this.legInner.add(grp);
      else if (p.bed) this.bedInner.add(grp);
      else if (p.anim && p.anim.type === 'door') {
        const pv = new THREE.Group(); pv.position.set(p.anim.axis[0], p.anim.axis[1], 0); this.root.add(pv);
        grp.position.set(-p.anim.axis[0], -p.anim.axis[1], 0); pv.add(grp); rec.pv = pv; this.doors.push(rec);
      } else if (p.anim && p.anim.type === 'flap') {
        const pv = new THREE.Group(); pv.position.set(0, p.anim.axis[0], p.anim.axis[1]); this.root.add(pv);
        grp.position.set(0, -p.anim.axis[0], -p.anim.axis[1]); pv.add(grp); rec.pv = pv; this.flaps.push(rec);
      } else { this.root.add(grp); if (p.anim && p.anim.type === 'drawer') this.drawers.push(rec); }
      this.recs.push(rec);
    }
    this.elements = [...new Set(model.parts.filter(p => p.anim && p.anim.id).map(p => p.anim.id))];
    // floor and walls of the cavity (context)
    this.room = new THREE.Group();
    const P = model.P;
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(P.W + 1600, 3200), new THREE.MeshStandardMaterial({ color: srgb(0xb9b2a6), roughness: 1, transparent: true, opacity: 0.35, depthWrite: false }));
    fl.position.set(0, 1300, -0.5); fl.userData.noFit = true; this.room.add(fl);
    const lines = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-P.W / 2, P.D, 0), new THREE.Vector3(-P.W / 2, 0, 0), new THREE.Vector3(-P.W / 2, 0, 0), new THREE.Vector3(P.W / 2, 0, 0),
      new THREE.Vector3(P.W / 2, 0, 0), new THREE.Vector3(P.W / 2, P.D, 0), new THREE.Vector3(-P.W / 2, 0, P.H), new THREE.Vector3(P.W / 2, 0, P.H),
      new THREE.Vector3(-P.W / 2, 0, 0), new THREE.Vector3(-P.W / 2, 0, P.H), new THREE.Vector3(P.W / 2, 0, 0), new THREE.Vector3(P.W / 2, 0, P.H),
      new THREE.Vector3(-P.W / 2, P.D, P.H), new THREE.Vector3(-P.W / 2, 0, P.H), new THREE.Vector3(P.W / 2, P.D, P.H), new THREE.Vector3(P.W / 2, 0, P.H),
    ]);
    const rl = new THREE.LineSegments(lines, new THREE.LineBasicMaterial({ color: 0x8a8378, transparent: true, opacity: 0.6 }));
    rl.userData.noFit = true; this.room.add(rl);
    this.root.add(this.room);
    // swing arcs at the section plane
    this.arcs = new THREE.Group();
    const xs = G.xFi - 120;
    const keyPts = [[G.yF, G.zF0], [G.yFb, G.zF0], [G.yM0, G.zM0], [G.yM0, G.zM1], [G.yF, G.zF1], [G.yRail, G.zF1]];
    for (const kp of keyPts) {
      const pts = [];
      for (let i = 0; i <= 45; i++) { const q = C.rot2(kp, G.pivot, (i / 45) * Math.PI / 2); pts.push(new THREE.Vector3(xs + 2, q[0], q[1])); }
      const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), this.arcMat);
      ln.computeLineDistances(); this.arcs.add(ln);
    }
    const piv = new THREE.Mesh(new THREE.SphereGeometry(14, 16, 10), new THREE.MeshBasicMaterial({ color: 0xa8620a }));
    piv.position.set(xs + 2, G.pivot[0], G.pivot[1]); this.arcs.add(piv);
    this.arcs.userData.noFit = true;
    this.root.add(this.arcs);
    this.clip.constant = xs;
    this.apply();
  }
  set(o) { Object.assign(this.opts, o); this.apply(); }
  apply() {
    if (!this.model) return;
    const o = this.opts, G = this.model.G;
    const th = (o.bed || 0) * Math.PI / 180;
    this.bedPivot.rotation.x = -th;
    this.legPivot.rotation.x = (C.legPsi(o.bed || 0) - 180) * Math.PI / 180;
    const T = (id) => this.openOf(id);
    for (const r of this.doors) r.pv.rotation.z = -r.part.anim.sign * T(r.part.anim.id) * Math.PI / 2 * 0.95;
    for (const r of this.flaps) r.pv.rotation.x = T(r.part.anim.id) * Math.PI / 2 * 0.92;
    for (const r of this.drawers) r.grp.position.y = T(r.part.anim.id) * r.part.anim.dist * (r.part.anim.k === undefined ? 1 : r.part.anim.k);
    const aim = (mesh, a, b, d) => {
      const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), dir = vb.clone().sub(va), L = dir.length();
      mesh.position.copy(va).addScaledVector(dir, 0.5);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      mesh.scale.set(d / 2, L, d / 2);
    };
    for (const r of this.dyns) {
      if (r.dyn.type === 'link') { const [l1, l2] = C.linkEnds(r.dyn, T(r.dyn.id)); aim(r.mesh, l1[0], l1[1], 5); aim(r.rod, l2[0], l2[1], 5); continue; }
      const [a, b] = r.dyn.type === 'spring' ? C.springEnds(G, r.dyn, th) : C.stayEnds(r.dyn, T(r.dyn.id) * Math.PI / 2 * 0.92);
      const bodyLen = r.dyn.type === 'spring' ? 390 : 150;
      const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(...d), k = Math.min(bodyLen, L - 40) / L;
      const m = [a[0] + d[0] * k, a[1] + d[1] * k, a[2] + d[2] * k];
      aim(r.mesh, a, m, r.dyn.type === 'spring' ? 14 : 15); aim(r.rod, m, b, r.dyn.type === 'spring' ? 8 : 6);
    }
    for (const r of this.recs) if (r.part.dyn && r.part.dyn.type === 'pin') r.grp.position.z = (o.bed || 0) > 0.2 ? r.part.dyn.lift : 0;
    for (const r of this.recs) {
      const p = r.part;
      let vis = true;
      if (!o.fronts && p.kind === 'front' && !p.bed) vis = false;
      if (!o.mattress && p.mattress) vis = false;
      if (!o.hw && p.hw && !p.mattress) vis = false;
      if (o.only && !o.only(p)) vis = false;
      r.grp.visible = vis;
      let m;
      if (o.colourOverride) m = o.colourOverride(p, this);
      if (!m) {
        if (o.bySheet && !p.hw) m = this.mat('t' + p.T, { color: T_COL[p.T] || 0x8a8f96, rough: 0.8 }, o.section);
        else m = this.mat(p.kind, r.style, o.section);
      }
      r.mesh.material = m;
      if (r.rod) r.rod.material = this.mat('chrome', KIND_STYLE.chrome, o.section);
      if (r.edges) r.edges.material = o.section ? this.edgeMatClip() : this.edgeMat;
    }
    this.arcs.visible = !!o.section;
    this.room.visible = o.room !== false;
    void G;
  }
  edgeMatClip() {
    if (!this.edgeMatC) this.edgeMatC = new THREE.LineBasicMaterial({ color: 0x24211d, transparent: true, opacity: 0.5, clippingPlanes: [this.clip] });
    return this.edgeMatC;
  }
  bounds() {
    const b = new THREE.Box3();
    this.root.updateMatrixWorld(true);
    for (const r of this.recs) if (this.isVisible(r.grp)) b.expandByObject(r.mesh);
    return b;
  }
  isVisible(obj) { while (obj) { if (!obj.visible) return false; obj = obj.parent; } return true; }
  // what a ray hits first among the visible parts: an element id, 'bed', or null (carcass and fixed parts block the ray)
  pick(ray) {
    const meshes = [];
    for (const r of this.recs) if (this.isVisible(r.grp)) { meshes.push(r.mesh); if (r.rod) meshes.push(r.rod); }
    this.scene.updateMatrixWorld(true);
    for (const h of ray.intersectObjects(meshes, false)) {
      if (this.opts.section && this.clip.distanceToPoint(h.point) < 0) continue;
      const p = h.object.userData.rec.part;
      if (p.bed) return 'bed';
      return (p.anim && p.anim.id) || (p.dyn && p.dyn.id) || p.pick || null;
    }
    return null;
  }
}

/* ------------------------------------------------------------------ interactive viewer */
class Viewer {
  constructor(container) {
    this.container = container;
    this.ms = new MurphyScene();
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.localClippingEnabled = true;
    this.renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, 2));
    container.insertBefore(this.renderer.domElement, container.firstChild);
    this.persp = new THREE.PerspectiveCamera(30, 1, 20, 80000);
    this.persp.up.set(0, 0, 1);
    this.ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 10, 200000);
    this.ortho.up.set(0, 0, 1);
    this.camera = this.persp;
    this.target = new THREE.Vector3(0, 300, 1277);
    this.sph = { theta: 1.1, phi: 1.22, r: 9000 };
    this.renderer.setClearColor(0xe4e2dc, 1);
    this.ms.openState = new Map(); // each door, flap and drawer opens on its own
    this.openTarget = new Map(); this.openAnims = new Map();
    this.ray = new THREE.Raycaster();
    this._bindControls();
    root.addEventListener('resize', () => this.resize());
    if (root.ResizeObserver) { this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(container); }
    this.resize();
    this.dirty = true;
    const loop = () => {
      if (this.openAnims.size) this._stepOpen(root.performance.now());
      if (this.dirty) { this.render(); this.dirty = false; }
      this.raf = root.requestAnimationFrame(loop);
    };
    loop();
  }
  setBackground(hex) { this.renderer.setClearColor(hex, 1); this.dirty = true; }
  setModel(model, keepView) { this.ms.setModel(model); if (!keepView) this.fit(); this.dirty = true; this._openChanged(); }
  set(o) {
    o = Object.assign({}, o);
    if (o.open !== undefined) { // every element at once, no animation
      for (const id of this.ms.elements) { this.ms.openState.set(id, o.open); this.openTarget.set(id, o.open > 0.5 ? 1 : 0); }
      this.openAnims.clear(); delete o.open; this._openChanged();
    }
    this.ms.set(o); this.dirty = true;
  }
  // open or close elements (ids from ms.elements) with an eased swing
  animateOpen(ids, to) {
    const now = root.performance.now(), reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    for (const id of ids) {
      this.openTarget.set(id, to);
      const from = this.ms.openOf(id);
      if (reduce || Math.abs(from - to) < 1e-6) { this.ms.openState.set(id, to); this.openAnims.delete(id); }
      else this.openAnims.set(id, { from, to, t0: now, dur: 150 + 600 * Math.abs(to - from) });
    }
    this.ms.apply(); this.dirty = true; this._openChanged();
  }
  toggle(id) { this.animateOpen([id], (this.openTarget.get(id) || 0) > 0.5 ? 0 : 1); }
  setAllOpen(on) { this.animateOpen(this.ms.elements, on ? 1 : 0); }
  openCount() { return this.ms.elements.filter(id => (this.openTarget.get(id) || 0) > 0.5).length; }
  _openChanged() { if (this.onOpenChange) this.onOpenChange(this.openCount(), this.ms.elements.length); }
  _stepOpen(now) {
    for (const [id, a] of this.openAnims) {
      const k = Math.min(1, (now - a.t0) / a.dur), e = 1 - Math.pow(1 - k, 3);
      this.ms.openState.set(id, a.from + (a.to - a.from) * e);
      if (k >= 1) this.openAnims.delete(id);
    }
    this.ms.apply(); this.dirty = true;
  }
  // element under a screen point (client coordinates)
  pickAt(cx, cy) {
    const rc = this.renderer.domElement.getBoundingClientRect();
    if (!rc.width || !rc.height) return null;
    this.ray.setFromCamera(new THREE.Vector2((cx - rc.left) / rc.width * 2 - 1, -(cy - rc.top) / rc.height * 2 + 1), this.camera);
    return this.ms.pick(this.ray);
  }
  _click(cx, cy) {
    const id = this.pickAt(cx, cy);
    if (id === 'bed') { if (this.onPickBed) this.onPickBed(); }
    else if (id) this.toggle(id);
  }
  fit() {
    const b = this.ms.bounds();
    if (b.isEmpty()) return;
    const c = b.getCenter(new THREE.Vector3());
    this.target.copy(c);
    const s = this.sph, sp = Math.sin(s.phi);
    const back = new THREE.Vector3(sp * Math.cos(s.theta), sp * Math.sin(s.theta), Math.cos(s.phi)).normalize();
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 0, 1), back);
    if (right.lengthSq() < 1e-12) right.set(-Math.sin(s.theta), Math.cos(s.theta), 0);
    right.normalize();
    const up = new THREE.Vector3().crossVectors(back, right).normalize();
    const H = this.container.clientHeight || 300;
    let inset = 0;
    for (const el of this.container.querySelectorAll('.tools, .vbar')) {
      const r0 = el.getBoundingClientRect(), rc = this.container.getBoundingClientRect();
      inset = Math.max(inset, r0.top - rc.top < H / 2 ? r0.bottom - rc.top : rc.bottom - r0.top);
    }
    const use = Math.max(0.35, (H - 2 * inset - 20) / H);
    const ty = Math.tan(THREE.MathUtils.degToRad(this.persp.fov) / 2) * use, tx = Math.tan(THREE.MathUtils.degToRad(this.persp.fov) / 2) * (this.persp.aspect || 1) * 0.94;
    let r = 0;
    for (let i = 0; i < 8; i++) {
      const p = new THREE.Vector3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).sub(c);
      const z = p.dot(back);
      r = Math.max(r, z + Math.abs(p.dot(right)) / tx, z + Math.abs(p.dot(up)) / ty);
    }
    s.r = Math.min(60000, Math.max(500, r * 1.04));
    // orthographic views: half height that frames the same box
    let hu = 0, hr = 0;
    for (let i = 0; i < 8; i++) {
      const p = new THREE.Vector3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).sub(c);
      hu = Math.max(hu, Math.abs(p.dot(up))); hr = Math.max(hr, Math.abs(p.dot(right)));
    }
    this.orthoH = Math.max(hu / use, hr / ((this.aspect || 1) * 0.94)) * 1.04;
    this.orthoR = s.r;
    this.dirty = true;
  }
  view(name) {
    const v = { iso: [1.1, 1.22], front: [Math.PI / 2, Math.PI / 2 - 0.001], side: [0.0001, Math.PI / 2 - 0.001], top: [Math.PI / 2, 0.001] }[name] || [1.1, 1.22];
    this.sph.theta = v[0]; this.sph.phi = v[1];
    this.camera = name === 'iso' ? this.persp : this.ortho;
    this.fit();
  }
  resize() {
    const w = this.container.clientWidth || 300, h = this.container.clientHeight || 300;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.persp.aspect = w / h;
    this.persp.updateProjectionMatrix();
    this.aspect = w / h;
    this.dirty = true;
  }
  render() {
    const s = this.sph, sp = Math.sin(s.phi);
    if (this.camera === this.ortho) {
      const hh = (this.orthoH || 1500) * (s.r / (this.orthoR || s.r)), hw = hh * (this.aspect || 1);
      Object.assign(this.ortho, { left: -hw, right: hw, top: hh, bottom: -hh });
      this.ortho.updateProjectionMatrix();
    }
    const dist = this.camera === this.ortho ? 40000 : s.r;
    this.camera.position.set(this.target.x + dist * sp * Math.cos(s.theta), this.target.y + dist * sp * Math.sin(s.theta), this.target.z + dist * Math.cos(s.phi));
    this.camera.lookAt(this.target);
    this.ms.key.position.copy(this.camera.position).add(new THREE.Vector3(-1500, 600, 3000));
    this.renderer.render(this.ms.scene, this.camera);
    if (this.onOrient) {
      const dx = Math.cos(s.theta), dy = Math.sin(s.theta);
      let t;
      if (s.phi < 0.3) t = 'Looking down from above';
      else {
        const w = [];
        if (dy > 0.38) w.push('front'); else if (dy < -0.38) w.push('back');
        if (dx < -0.38) w.push('right side'); else if (dx > 0.38) w.push('left side');
        t = 'Looking at the ' + w.join(' and ');
      }
      if (t !== this._orient) { this._orient = t; this.onOrient(t); }
    }
  }
  _bindControls() {
    const el = this.renderer.domElement;
    el.style.touchAction = 'none';
    const pts = new Map();
    let last = null, mode = null, pinch = null;
    const pan = (dx, dy) => {
      const r = this.sph.r * 0.0009;
      const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);
      this.target.addScaledVector(right, -dx * r).addScaledVector(up, dy * r);
    };
    let down = null, hoverEv = null, hoverRaf = 0;
    const hover = () => {
      hoverRaf = 0;
      if (!hoverEv || pts.size) return;
      el.style.cursor = this.pickAt(hoverEv.clientX, hoverEv.clientY) ? 'pointer' : '';
    };
    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      down = pts.size === 1 && e.button === 0 && !e.shiftKey ? { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 } : null;
      last = [e.clientX, e.clientY];
      mode = (e.button === 2 || e.shiftKey) ? 'pan' : 'rot';
      if (pts.size === 2) { const v = [...pts.values()]; pinch = { d: Math.hypot(v[0][0] - v[1][0], v[0][1] - v[1][1]), c: [(v[0][0] + v[1][0]) / 2, (v[0][1] + v[1][1]) / 2] }; }
    });
    el.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) {
        if (e.pointerType === 'mouse') { hoverEv = e; if (!hoverRaf) hoverRaf = root.requestAnimationFrame(hover); }
        return;
      }
      if (down && down.id === e.pointerId) down.moved = Math.max(down.moved, Math.hypot(e.clientX - down.x, e.clientY - down.y));
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 2 && pinch) {
        const v = [...pts.values()];
        const d = Math.hypot(v[0][0] - v[1][0], v[0][1] - v[1][1]), c = [(v[0][0] + v[1][0]) / 2, (v[0][1] + v[1][1]) / 2];
        this.sph.r = Math.min(60000, Math.max(500, this.sph.r * pinch.d / Math.max(d, 1)));
        pan(c[0] - pinch.c[0], c[1] - pinch.c[1]);
        pinch = { d, c }; this.dirty = true; return;
      }
      const dx = e.clientX - last[0], dy = e.clientY - last[1];
      last = [e.clientX, e.clientY];
      if (mode === 'pan') pan(dx, dy);
      else { this.sph.theta -= dx * 0.0085; this.sph.phi = Math.min(Math.PI - 0.05, Math.max(0.02, this.sph.phi - dy * 0.0085)); }
      this.dirty = true;
    });
    const end = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (pts.size === 1) { last = [...pts.values()][0]; mode = 'rot'; } };
    el.addEventListener('pointerup', (e) => {
      // a click (not a drag) opens or closes what is under the pointer
      const click = down && down.id === e.pointerId && down.moved < 5 && pts.size === 1;
      down = null; end(e);
      if (click) this._click(e.clientX, e.clientY);
    });
    el.addEventListener('pointercancel', (e) => { down = null; end(e); });
    el.addEventListener('pointerleave', () => { hoverEv = null; });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('wheel', (e) => { e.preventDefault(); this.sph.r = Math.min(60000, Math.max(500, this.sph.r * Math.exp(e.deltaY * 0.0012))); this.dirty = true; }, { passive: false });
  }
}

/* ------------------------------------------------------------------ offscreen renders for the PDF */
class PrintRenderer {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false });
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.localClippingEnabled = true;
    this.renderer.setPixelRatio(1);
    this.renderer.setClearColor(0xffffff, 1);
    this.ms = new MurphyScene();
    this.ms.edgeMat.opacity = 0.7;
  }
  setModel(model) { this.ms.setModel(model); }
  // orthographic view from azimuth/elevation (deg), fitted to the visible parts
  iso(az, el, pxW, pxH, opts, margin) {
    this.ms.opts = Object.assign({ fronts: true, open: 0, section: false, mattress: true, hw: true, bySheet: false, bed: 0, room: false }, opts || {});
    this.ms.apply();
    const azr = az * Math.PI / 180, elr = el * Math.PI / 180;
    const d = new THREE.Vector3(Math.cos(elr) * Math.sin(azr), Math.cos(elr) * Math.cos(azr), Math.sin(elr));
    const box = this.ms.bounds(), center = box.getCenter(new THREE.Vector3());
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 80000);
    cam.up.set(0, 0, 1);
    cam.position.copy(center).addScaledVector(d, 30000);
    cam.lookAt(center);
    cam.updateMatrixWorld(true);
    const inv = cam.matrixWorldInverse;
    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    this.ms.root.updateMatrixWorld(true);
    const tmp = new THREE.Vector3();
    for (const r of this.ms.recs) {
      if (!this.ms.opts.fitAll && !this.ms.isVisible(r.grp)) continue;
      if (this.ms.opts.fitAll && r.part.mattress) continue;
      const pos = r.mesh.geometry.attributes.position, mw = r.mesh.matrixWorld;
      const step = Math.max(1, Math.floor(pos.count / 200));
      for (let i = 0; i < pos.count; i += step) {
        tmp.fromBufferAttribute(pos, i).applyMatrix4(mw).applyMatrix4(inv);
        xmin = Math.min(xmin, tmp.x); xmax = Math.max(xmax, tmp.x); ymin = Math.min(ymin, tmp.y); ymax = Math.max(ymax, tmp.y);
      }
    }
    margin = margin || 1.04;
    const cx = (xmin + xmax) / 2, cy = (ymin + ymax) / 2;
    let hw = (xmax - xmin) / 2 * margin, hh = (ymax - ymin) / 2 * margin;
    if (hw / hh > pxW / pxH) hh = hw * pxH / pxW; else hw = hh * pxW / pxH;
    cam.left = cx - hw; cam.right = cx + hw; cam.top = cy + hh; cam.bottom = cy - hh;
    cam.updateProjectionMatrix();
    this.ms.key.position.copy(d).multiplyScalar(4000).add(new THREE.Vector3(-1500, 1200, 3000));
    this.renderer.setSize(pxW, pxH, false);
    this.renderer.render(this.ms.scene, cam);
    return { url: this.renderer.domElement.toDataURL('image/jpeg', 0.9), px: [pxW, pxH] };
  }
  dispose() { this.renderer.dispose(); }
}

root.MurphyViewer = { Viewer, PrintRenderer, MurphyScene, T_COL };
})(typeof window !== 'undefined' ? window : globalThis);
