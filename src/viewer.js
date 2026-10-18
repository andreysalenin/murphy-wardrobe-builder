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
  plastic: { color: 0xf3f2ee, rough: 0.45 }, indicator: { color: 0xe8541a, rough: 0.45, edges: false }, bronze: { color: 0xb88f57, rough: 0.4, metal: 0.4 },
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
  switchOf(id) { const m = this.openState; return m && m.has(id) ? m.get(id) : (this.opts.switches || 0); } // power points: 0 off, 1 on
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
    this.doors = []; this.flaps = []; this.tilts = []; this.drawers = []; this.rockers = [];
    this.dyns = [];
    const unitCyl = new THREE.CylinderGeometry(1, 1, 1, 20, 1); // along +y, centred
    for (const p of model.parts) {
      const style = KIND_STYLE[p.kind] || KIND_STYLE.carcass;
      if (p.dyn && (p.dyn.type === 'spring' || p.dyn.type === 'stay' || p.dyn.type === 'link')) {
        // tubes re-aimed every frame: socket, body, rod, socket for a spring; body and rod for a stay; two links
        const grp = new THREE.Group(), kinds = C.dynSegs(G, p.dyn, 0).map(sg => p.dyn.type === 'link' ? 'rod' : sg[3]);
        const meshes = kinds.map(() => new THREE.Mesh(unitCyl, this.mat(p.kind, style, false)));
        meshes.forEach(m => grp.add(m));
        this.root.add(grp);
        const rec = { part: p, mesh: meshes[0], meshes, kinds, grp, style, dyn: p.dyn };
        meshes.forEach(m => { m.userData.rec = rec; });
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
      } else if (p.anim && p.anim.type === 'tilt') { // tips out about a line along x at its foot (the headboard doors)
        const pv = new THREE.Group(); pv.position.set(0, p.anim.axis[0], p.anim.axis[1]); this.root.add(pv);
        grp.position.set(0, -p.anim.axis[0], -p.anim.axis[1]); pv.add(grp); rec.pv = pv; this.tilts.push(rec);
      } else if (p.anim && p.anim.type === 'rocker') { // a power point switch rocking about a line along x, at (y, z)
        const pv = new THREE.Group(); pv.position.set(0, p.anim.axis[0], p.anim.axis[1]); this.root.add(pv);
        grp.position.set(0, -p.anim.axis[0], -p.anim.axis[1]); pv.add(grp); rec.pv = pv; this.rockers.push(rec);
      } else { this.root.add(grp); if (p.anim && p.anim.type === 'drawer') this.drawers.push(rec); }
      this.recs.push(rec);
    }
    // fronts that open (the power point switches toggle on their own, outside 'open all')
    this.elements = [...new Set(model.parts.filter(p => p.anim && p.anim.id && p.anim.type !== 'rocker').map(p => p.anim.id))];
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
    // the headboard doors open only with the bed down: closed, the bed stands in front of them
    const bedDown = Math.max(0, Math.min(1, ((o.bed || 0) - 80) / 10));
    for (const r of this.tilts) r.pv.rotation.x = -T(r.part.anim.id) * bedDown * r.part.anim.deg * Math.PI / 180;
    for (const r of this.drawers) r.grp.position.y = T(r.part.anim.id) * r.part.anim.dist * (r.part.anim.k === undefined ? 1 : r.part.anim.k);
    for (const r of this.rockers) r.pv.rotation.x = r.part.anim.sign * this.switchOf(r.part.anim.id) * r.part.anim.deg * Math.PI / 180;
    const aim = (mesh, a, b, d) => {
      const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), dir = vb.clone().sub(va), L = dir.length();
      mesh.position.copy(va).addScaledVector(dir, 0.5);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      mesh.scale.set(d / 2, L, d / 2);
      mesh.userData.seg = [a, b, d]; // for the vector renderer
    };
    for (const r of this.dyns) {
      const state = r.dyn.type === 'spring' ? th : r.dyn.type === 'stay' ? T(r.dyn.id) * Math.PI / 2 * 0.92 : T(r.dyn.id);
      C.dynSegs(G, r.dyn, state).forEach((sg, i) => { if (r.meshes[i]) aim(r.meshes[i], sg[0], sg[1], sg[2]); });
    }
    for (const r of this.recs) if (r.part.dyn && r.part.dyn.type === 'pin') r.grp.position.z = (o.bed || 0) > 0.2 ? r.part.dyn.lift : 0;
    // slide bolts: pulled back before the bed moves at all
    for (const r of this.recs) if (r.part.dyn && r.part.dyn.type === 'bolt') r.grp.position.x = (o.bed || 0) > 0.001 ? r.part.dyn.dx : 0;
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
      if (r.meshes) r.meshes.forEach((mesh, i) => { const k = r.kinds[i]; mesh.material = k === 'rod' ? this.mat('chrome', KIND_STYLE.chrome, o.section) : k === 'end' ? this.mat('rubber', KIND_STYLE.rubber, o.section) : m; });
      else r.mesh.material = m;
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
    for (const r of this.recs) if (this.isVisible(r.grp)) for (const mesh of (r.meshes || [r.mesh])) b.expandByObject(mesh);
    return b;
  }
  isVisible(obj) { while (obj) { if (!obj.visible) return false; obj = obj.parent; } return true; }
  // what a ray hits first among the visible parts: an element id, 'bed', or null (carcass and fixed parts block the ray)
  pick(ray) {
    const meshes = [];
    for (const r of this.recs) if (this.isVisible(r.grp)) meshes.push(...(r.meshes || [r.mesh]));
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
      else this.openAnims.set(id, { from, to, t0: now, dur: id.startsWith('gpo-') ? 110 : 150 + 600 * Math.abs(to - from) });
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
        this.sph.r = Math.min(60000, Math.max(200, this.sph.r * pinch.d / Math.max(d, 1)));
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
    el.addEventListener('wheel', (e) => { e.preventDefault(); this.sph.r = Math.min(60000, Math.max(200, this.sph.r * Math.exp(e.deltaY * 0.0012))); this.dirty = true; }, { passive: false });
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

/* ------------------------------------------------------------------ vector renders for the PDF
   The same scene as the screen, drawn as flat-shaded polygons so the drawings stay vector: front faces only, put in
   exact back-to-front order by a BSP tree (faces are split where they cross another face's plane), faces wholly
   hidden behind others dropped with a small software buffer of fragment ids, and the hard edges (more than 28 deg
   between faces, as on screen) drawn as lines. No WebGL needed. */
const V_EPS = 1e-4, V_HARD = Math.cos(28 * Math.PI / 180);
const vdot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function vnorm(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
function newellN(pts) {
  let x = 0, y = 0, z = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    x += (a[1] - b[1]) * (a[2] + b[2]); y += (a[2] - b[2]) * (a[0] + b[0]); z += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const l = Math.hypot(x, y, z);
  return l > 1e-9 ? [x / l, y / l, z / l] : null;
}
function loopConvex(lp) {
  let sg = 0;
  for (let i = 0; i < lp.length; i++) {
    const a = lp[i], b = lp[(i + 1) % lp.length], c = lp[(i + 2) % lp.length];
    const cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (Math.abs(cr) < 1e-9) continue;
    if (!sg) sg = Math.sign(cr); else if (Math.sign(cr) !== sg) return false;
  }
  return true;
}
// faces of a prism in world space: { pts, hard: [edge i -> i+1 is a hard edge] }
function prismFaces(pr, tf) {
  const outer = C.loopPolyline(pr.loops[0], 12), holes = pr.loops.slice(1).map(l => C.loopPolyline(l, 12));
  const P = (q, w) => tf(C.to3(pr, q, w)), faces = [];
  const corner = (lp) => lp.map((q, i) => {
    const a = lp[(i - 1 + lp.length) % lp.length], c = lp[(i + 1) % lp.length];
    const d1 = [q[0] - a[0], q[1] - a[1]], d2 = [c[0] - q[0], c[1] - q[1]], l = Math.hypot(...d1) * Math.hypot(...d2) || 1;
    return (d1[0] * d2[0] + d1[1] * d2[1]) / l < V_HARD;
  });
  if (!holes.length && loopConvex(outer)) {
    const t = outer.map(q => P(q, pr.len)), b = outer.map(q => P(q, 0)).reverse();
    faces.push({ pts: t, hard: t.map(() => true) }, { pts: b, hard: b.map(() => true) });
  } else {
    const all = outer.concat(...holes), loops = [outer, ...holes], start = [];
    let o = 0; for (const lp of loops) { start.push(o); o += lp.length; }
    const loopOf = (k) => { let j = 0; while (j + 1 < start.length && k >= start[j + 1]) j++; return j; };
    const boundary = (i, k) => { const li = loopOf(i); if (li !== loopOf(k)) return false; const n = loops[li].length, a = i - start[li], b = k - start[li]; return (a + 1) % n === b || (b + 1) % n === a; };
    const tris = THREE.ShapeUtils.triangulateShape(outer.map(q => new THREE.Vector2(q[0], q[1])), holes.map(h => h.map(q => new THREE.Vector2(q[0], q[1]))));
    for (const tr of tris) {
      let [i, j, k] = tr;
      const cr = (all[j][0] - all[i][0]) * (all[k][1] - all[i][1]) - (all[j][1] - all[i][1]) * (all[k][0] - all[i][0]);
      if (cr < 0) [j, k] = [k, j];
      faces.push({ pts: [P(all[i], pr.len), P(all[j], pr.len), P(all[k], pr.len)], hard: [boundary(i, j), boundary(j, k), boundary(k, i)] });
      faces.push({ pts: [P(all[i], 0), P(all[k], 0), P(all[j], 0)], hard: [boundary(i, k), boundary(k, j), boundary(j, i)] });
    }
  }
  for (const lp of [outer, ...holes]) {
    const h = corner(lp);
    for (let i = 0; i < lp.length; i++) {
      const j = (i + 1) % lp.length;
      faces.push({ pts: [P(lp[i], 0), P(lp[j], 0), P(lp[j], pr.len), P(lp[i], pr.len)], hard: [true, h[j], true, h[i]] });
    }
  }
  return faces;
}
// split a convex polygon by the plane N.x = w; keeps the hard flags, the new edge along the plane is soft
function vsplit(poly, N, w) {
  const pts = poly.pts, n = pts.length, ds = pts.map(p => vdot(N, p) - w);
  let f = 0, b = 0;
  for (const x of ds) { if (x > V_EPS) f++; else if (x < -V_EPS) b++; }
  if (!f && !b) return { co: poly };
  if (!b) return { front: poly };
  if (!f) return { back: poly };
  const F = [], Fh = [], B = [], Bh = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, a = pts[i], c = pts[j], da = ds[i], dc = ds[j], h = poly.hard[i];
    const cross = (da > V_EPS && dc < -V_EPS) || (da < -V_EPS && dc > V_EPS);
    const x = cross ? (() => { const t = da / (da - dc); return [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t, a[2] + (c[2] - a[2]) * t]; })() : null;
    if (da >= -V_EPS) { F.push(a); Fh.push(dc >= -V_EPS || da > V_EPS ? h : false); }
    if (da <= V_EPS) { B.push(a); Bh.push(dc <= V_EPS || da < -V_EPS ? h : false); }
    if (cross) {
      if (da > V_EPS) { F.push(x); Fh.push(false); B.push(x); Bh.push(h); }
      else { B.push(x); Bh.push(false); F.push(x); Fh.push(h); }
    }
  }
  return { front: F.length >= 3 ? Object.assign({}, poly, { pts: F, hard: Fh }) : null, back: B.length >= 3 ? Object.assign({}, poly, { pts: B, hard: Bh }) : null };
}
function bspOrder(polys, d) {
  if (!polys.length) return [];
  const root = { list: polys }, stack = [root];
  while (stack.length) {
    const node = stack.pop(), list = node.list;
    node.list = null;
    let best = 0, bestScore = Infinity;
    const K = Math.min(list.length, 10), M = Math.min(list.length, 48);
    for (let k = 0; k < K && bestScore > 0; k++) {
      const i = Math.floor(k * list.length / K), c = list[i], w = vdot(c.n, c.pts[0]);
      let sp = 0;
      for (let jj = 0; jj < M; jj++) {
        const q = list[Math.floor(jj * list.length / M)];
        let f = 0, b = 0;
        for (const p of q.pts) { const x = vdot(c.n, p) - w; if (x > V_EPS) f++; else if (x < -V_EPS) b++; }
        if (f && b) sp++;
      }
      if (sp < bestScore) { bestScore = sp; best = i; }
    }
    const sp = list[best], N = sp.n, w = vdot(N, sp.pts[0]), co = [sp], F = [], B = [];
    for (let i = 0; i < list.length; i++) {
      if (i === best) continue;
      const r = vsplit(list[i], N, w);
      if (r.co) co.push(r.co);
      if (r.front) F.push(r.front);
      if (r.back) B.push(r.back);
    }
    Object.assign(node, { N, w, co });
    if (F.length) { node.front = { list: F }; stack.push(node.front); }
    if (B.length) { node.back = { list: B }; stack.push(node.back); }
  }
  const out = [], st = [root];
  while (st.length) {
    const t = st.pop();
    if (t.emit) { for (const p of t.emit) out.push(p); continue; }
    const camFront = vdot(t.N, d) > 0, first = camFront ? t.back : t.front, last = camFront ? t.front : t.back;
    if (last) st.push(last);
    st.push({ emit: t.co });
    if (first) st.push(first);
  }
  return out;
}
// ids of the convex polygons (screen px, back to front) that keep at least one pixel
function visibleIds(polys, W, H) {
  const buf = new Int32Array(W * H).fill(-1);
  polys.forEach((pg, id) => {
    const p = pg.s;
    let y0 = Infinity, y1 = -Infinity;
    for (const q of p) { if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; }
    const r0 = Math.max(0, Math.ceil(y0 - 0.5)), r1 = Math.min(H - 1, Math.floor(y1 - 0.5));
    for (let r = r0; r <= r1; r++) {
      const yc = r + 0.5;
      let xl = Infinity, xr = -Infinity;
      for (let i = 0; i < p.length; i++) {
        const a = p[i], b = p[(i + 1) % p.length];
        if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) {
          const x = a[0] + (yc - a[1]) / (b[1] - a[1]) * (b[0] - a[0]);
          if (x < xl) xl = x; if (x > xr) xr = x;
        }
      }
      const c0 = Math.max(0, Math.ceil(xl - 0.5)), c1 = Math.min(W - 1, Math.floor(xr - 0.5));
      for (let c = c0; c <= c1; c++) buf[r * W + c] = id;
    }
  });
  const vis = new Uint8Array(polys.length);
  for (let i = 0; i < buf.length; i++) if (buf[i] >= 0) vis[buf[i]] = 1;
  return vis;
}
const LIN2SRGB = (x) => { x = Math.max(0, Math.min(1, x)); return x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055; };

class VectorRenderer {
  constructor() { this.ms = new MurphyScene(); }
  setModel(model) { this.ms.setModel(model); }
  // same arguments as PrintRenderer.iso; returns { px: [w, h], polys: [{ p: [[x, y]...] (px, y down), f: [r, g, b], e: [[x1, y1, x2, y2]...] }] }
  iso(az, el, pxW, pxH, opts, margin) {
    const ms = this.ms;
    ms.opts = Object.assign({ fronts: true, open: 0, section: false, mattress: true, hw: true, bySheet: false, bed: 0, room: false }, opts || {});
    ms.apply();
    ms.root.updateMatrixWorld(true);
    const azr = az * Math.PI / 180, elr = el * Math.PI / 180;
    const d = [Math.cos(elr) * Math.sin(azr), Math.cos(elr) * Math.cos(azr), Math.sin(elr)];
    const right = vnorm([-d[1], d[0], 0]), up = [d[1] * right[2] - d[2] * right[1], d[2] * right[0] - d[0] * right[2], d[0] * right[1] - d[1] * right[0]];
    // lights as on screen: hemisphere, a key light from about the viewer, a fill from the right
    const keyD = vnorm([d[0] * 4000 - 1500, d[1] * 4000 + 1200, d[2] * 4000 + 3000]), fillD = vnorm([2500, 1500, 800]);
    const sky = [0.965, 0.953, 0.933], ground = [0.275, 0.259, 0.235];
    const shade = (col, metal, n) => {
      const t = 0.5 + 0.5 * n[2], k = 0.72 * Math.max(0, vdot(n, keyD)), f = 0.22 * Math.max(0, vdot(n, fillD));
      const dm = 1 - 0.45 * (metal || 0);
      return [0, 1, 2].map(i => Math.round(255 * LIN2SRGB(col[i] * dm * ((ground[i] + (sky[i] - ground[i]) * t) * 0.62 + k + f) + (metal ? 0.04 * k : 0))));
    };
    const polys = [], tmp = new THREE.Vector3();
    const addSolid = (pr, M, col, metal, edges, noFit) => {
      const tf = (p) => { tmp.set(p[0], p[1], p[2]).applyMatrix4(M); return [tmp.x, tmp.y, tmp.z]; };
      for (const fc of prismFaces(pr, tf)) {
        const n = newellN(fc.pts);
        if (!n || vdot(n, d) <= 1e-7) continue;
        fc.n = n; fc.fill = shade(col, metal, n); fc.edges = edges; fc.noFit = noFit;
        polys.push(fc);
      }
    };
    const I = new THREE.Matrix4();
    const all = [];
    for (const r of ms.recs) {
      const vis = ms.isVisible(r.grp);
      if (!vis && !(ms.opts.fitAll && !r.part.mattress)) continue;
      const meshes = r.meshes || [r.mesh];
      for (const mesh of meshes) {
        const mat = mesh.material, col = [mat.color.r, mat.color.g, mat.color.b];
        const sols = r.dyn ? (mesh.userData.seg ? [C.cyl(mesh.userData.seg[2], mesh.userData.seg[0], mesh.userData.seg[1])] : []) : r.part.solids;
        const M = r.dyn ? I : mesh.matrixWorld;
        if (!vis) { for (const pr of sols) for (const c of C.prismCorners(pr)) all.push(tmp.set(c[0], c[1], c[2]).applyMatrix4(M).clone()); continue; }
        for (const pr of sols) addSolid(pr, M, col, mat.metalness, r.style.edges !== false, !!(ms.opts.fitAll && r.part.mattress));
      }
    }
    const order = bspOrder(polys, d);
    // fit the frame
    const proj = (p) => [vdot(p, right), vdot(p, up)];
    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    const grow = (q) => { if (q[0] < xmin) xmin = q[0]; if (q[0] > xmax) xmax = q[0]; if (q[1] < ymin) ymin = q[1]; if (q[1] > ymax) ymax = q[1]; };
    for (const pg of order) { pg.s2 = pg.pts.map(proj); if (!pg.noFit) pg.s2.forEach(grow); }
    for (const v of all) grow(proj([v.x, v.y, v.z]));
    margin = margin || 1.04;
    const cx = (xmin + xmax) / 2, cy = (ymin + ymax) / 2;
    let hw = (xmax - xmin) / 2 * margin, hh = (ymax - ymin) / 2 * margin;
    if (hw / hh > pxW / pxH) hh = hw * pxH / pxW; else hw = hh * pxW / pxH;
    const k = pxW / (2 * hw), S = (q) => [pxW / 2 + (q[0] - cx) * k, pxH / 2 - (q[1] - cy) * k];
    for (const pg of order) pg.s = pg.s2.map(S);
    const vis = visibleIds(order, Math.round(pxW), Math.round(pxH));
    const out = [];
    order.forEach((pg, i) => {
      if (!vis[i]) return;
      const r1 = (x) => Math.round(x * 100) / 100, p = pg.s.map(q => [r1(q[0]), r1(q[1])]), e = [];
      if (pg.edges) pg.hard.forEach((h, j) => { if (h) { const a = p[j], b = p[(j + 1) % p.length]; e.push([a[0], a[1], b[0], b[1]]); } });
      out.push({ p, f: pg.fill, e });
    });
    return { px: [pxW, pxH], polys: out, faces: polys.length, fragments: order.length };
  }
  dispose() {}
}


/* ------------------------------------------------------------------ exploded views for the assembly sheets
   renderItems draws any list of faces (parts moved apart, fixings, hole marks) with the same exact ordering and
   hidden-face culling as the 3D views. Items: { faces: [{pts, hard}], fill: [r, g, b] (0-255), flat, edges, ink, lw }.
   d points from the subject toward the viewer. Returns polygons in the view plane (model mm, v up). */
const vcross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function perpPair(ax) { // unit u, v with u x v = ax
  const t = Math.abs(ax[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0], u = vnorm(vcross(ax, t));
  return [u, vcross(ax, u)];
}
// cone frustum from a (radius r0) to b (radius r1, 0 for a point); outward faces
function frustumFaces(a, b, r0, r1, n) {
  n = n || 10;
  const ax = vnorm([b[0] - a[0], b[1] - a[1], b[2] - a[2]]), [u, v] = perpPair(ax);
  const ring = (c, r) => Array.from({ length: n }, (_, i) => { const th = 2 * Math.PI * i / n, cs = Math.cos(th) * r, sn = Math.sin(th) * r; return [c[0] + u[0] * cs + v[0] * sn, c[1] + u[1] * cs + v[1] * sn, c[2] + u[2] * cs + v[2] * sn]; });
  const A = ring(a, r0), faces = [];
  if (r0 > 1e-6) faces.push({ pts: A.slice().reverse(), hard: A.map(() => true) });
  if (r1 > 1e-6) {
    const B = ring(b, r1);
    faces.push({ pts: B, hard: B.map(() => true) });
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; faces.push({ pts: [A[i], A[j], B[j], B[i]], hard: [true, false, true, false] }); }
  } else for (let i = 0; i < n; i++) { const j = (i + 1) % n; faces.push({ pts: [A[i], A[j], b.slice()], hard: [true, false, false] }); }
  return faces;
}
function cylFaces(a, b, r, n) { return frustumFaces(a, b, r, r, n); }
// flat disk (or stadium: half length `ext` along `along`) facing nrm
function diskFace(c, nrm, r, n, along, ext) {
  n = n || 12;
  let [u, v] = perpPair(vnorm(nrm));
  if (along) { u = vnorm(along); v = vcross(vnorm(nrm), u); }
  const pts = [];
  if (ext) {
    for (let i = 0; i <= n / 2; i++) { const th = -Math.PI / 2 + Math.PI * i / (n / 2); pts.push([0, 1, 2].map(k => c[k] + u[k] * (ext + r * Math.cos(th)) + v[k] * r * Math.sin(th))); }
    for (let i = 0; i <= n / 2; i++) { const th = Math.PI / 2 + Math.PI * i / (n / 2); pts.push([0, 1, 2].map(k => c[k] + u[k] * (-ext + r * Math.cos(th)) + v[k] * r * Math.sin(th))); }
  } else for (let i = 0; i < n; i++) { const th = 2 * Math.PI * i / n; pts.push([0, 1, 2].map(k => c[k] + u[k] * r * Math.cos(th) + v[k] * r * Math.sin(th))); }
  return { pts, hard: pts.map(() => true) };
}
// box with centre c, unit axes e1 e2 e3 (right handed) and half sizes h
function boxFaces(c, e1, e2, e3, h) {
  const P = (s1, s2, s3) => [0, 1, 2].map(k => c[k] + e1[k] * h[0] * s1 + e2[k] * h[1] * s2 + e3[k] * h[2] * s3);
  const q = (pts) => ({ pts, hard: [true, true, true, true] });
  return [q([P(-1, -1, 1), P(1, -1, 1), P(1, 1, 1), P(-1, 1, 1)]), q([P(-1, 1, -1), P(1, 1, -1), P(1, -1, -1), P(-1, -1, -1)]),
    q([P(-1, -1, -1), P(1, -1, -1), P(1, -1, 1), P(-1, -1, 1)]), q([P(1, 1, -1), P(-1, 1, -1), P(-1, 1, 1), P(1, 1, 1)]),
    q([P(1, -1, -1), P(1, 1, -1), P(1, 1, 1), P(1, -1, 1)]), q([P(-1, 1, -1), P(-1, -1, -1), P(-1, -1, 1), P(-1, 1, 1)])];
}
// a prism cut to the box lo..hi (bounds may be infinite). Prisms whose axes all lie along x, y and z are cut exactly
// (the cut faces close the solid); any other prism is kept whole if it reaches into the box.
function clip2(pts, r) { // Sutherland-Hodgman against u in [r0, r1], v in [r2, r3]
  const edges = [[0, r[0], 1], [0, r[1], -1], [1, r[2], 1], [1, r[3], -1]];
  let out = pts;
  for (const [k, c, sg] of edges) {
    if (!isFinite(c) || !out.length) continue;
    const inp = out; out = [];
    for (let i = 0; i < inp.length; i++) {
      const A = inp[i], B = inp[(i + 1) % inp.length], ia = (A[k] - c) * sg >= 0, ib = (B[k] - c) * sg >= 0;
      if (ia) out.push(A);
      if (ia !== ib) { const t = (c - A[k]) / (B[k] - A[k]); out.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t]); }
    }
  }
  const clean = [];
  for (const q of out) { const l = clean[clean.length - 1]; if (!l || Math.hypot(q[0] - l[0], q[1] - l[1]) > 1e-6) clean.push(q); }
  while (clean.length > 1 && Math.hypot(clean[0][0] - clean[clean.length - 1][0], clean[0][1] - clean[clean.length - 1][1]) < 1e-6) clean.pop();
  // drop points in the middle of straight runs
  const res = clean.filter((q, i) => { const a = clean[(i - 1 + clean.length) % clean.length], b = clean[(i + 1) % clean.length]; return Math.abs((q[0] - a[0]) * (b[1] - q[1]) - (q[1] - a[1]) * (b[0] - q[0])) > 1e-7; });
  return res.length >= 3 ? res : [];
}
function clipPrism(pr, lo, hi) {
  const b = C.prismBox(pr);
  if (b[3] < lo[0] || b[0] > hi[0] || b[4] < lo[1] || b[1] > hi[1] || b[5] < lo[2] || b[2] > hi[2]) return null;
  if (b[0] >= lo[0] && b[3] <= hi[0] && b[1] >= lo[1] && b[4] <= hi[1] && b[2] >= lo[2] && b[5] <= hi[2]) return pr;
  const ax = (v) => { for (let k = 0; k < 3; k++) if (Math.abs(Math.abs(v[k]) - 1) < 1e-9) return k; return -1; };
  const ku = ax(pr.u), kv = ax(pr.v), kn = ax(pr.n);
  if (ku < 0 || kv < 0 || kn < 0) return pr;
  const wl = (lo[kn] - pr.o[kn]) / pr.n[kn], wh = (hi[kn] - pr.o[kn]) / pr.n[kn];
  const w0 = Math.max(0, Math.min(wl, wh)), w1 = Math.min(pr.len, Math.max(wl, wh));
  if (!(w1 - w0 > 1e-6)) return null;
  const lim = (k, s) => { const a = (lo[k] - pr.o[k]) / s, c = (hi[k] - pr.o[k]) / s; return [Math.min(a, c), Math.max(a, c)]; };
  const ru = lim(ku, pr.u[ku]), rv = lim(kv, pr.v[kv]), rect = [ru[0], ru[1], rv[0], rv[1]];
  const outer = clip2(C.loopPolyline(pr.loops[0], 12), rect);
  if (!outer.length) return null;
  const holes = pr.loops.slice(1).map(l => C.loopPolyline(l, 12)).filter(h => h.every(q => q[0] > rect[0] && q[0] < rect[1] && q[1] > rect[2] && q[1] < rect[3]));
  const seg = (pts) => pts.map((a, i) => ({ t: 'L', a, b: pts[(i + 1) % pts.length] }));
  return { o: pr.o.map((x, k) => x + pr.n[k] * w0), u: pr.u, v: pr.v, n: pr.n, len: w1 - w0, loops: [seg(outer), ...holes.map(seg)] };
}
// faces of a prism, cut to the box lo..hi (optional), then moved by off
function partFaces(pr, off, lo, hi) {
  if (lo) { pr = clipPrism(pr, lo, hi); if (!pr) return []; }
  return prismFaces(pr, (p) => [p[0] + off[0], p[1] + off[1], p[2] + off[2]]);
}
// does the ray p + t d (t > eps) pass through the solid prism moved by off?
const POLY_CACHE = new WeakMap();
function pointInLoop(q, pts) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if ((a[1] > q[1]) !== (b[1] > q[1]) && q[0] < (b[0] - a[0]) * (q[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; }
  return c;
}
function rayHitsPrism(p, d, pr, off, eps) {
  const q = [p[0] - off[0] - pr.o[0], p[1] - off[1] - pr.o[1], p[2] - off[2] - pr.o[2]];
  const a0 = vdot(q, pr.u), b0 = vdot(q, pr.v), w0 = vdot(q, pr.n), da = vdot(d, pr.u), db = vdot(d, pr.v), dw = vdot(d, pr.n);
  let t0 = eps || 0.5, t1 = 1e6;
  if (Math.abs(dw) < 1e-12) { if (w0 < 0 || w0 > pr.len) return false; }
  else { let ta = -w0 / dw, tb = (pr.len - w0) / dw; if (ta > tb) [ta, tb] = [tb, ta]; t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t1 <= t0) return false; }
  let loops = POLY_CACHE.get(pr);
  if (!loops) { loops = pr.loops.map(l => C.loopPolyline(l, 12)); POLY_CACHE.set(pr, loops); }
  const P = [a0 + da * t0, b0 + db * t0], Q = [a0 + da * t1, b0 + db * t1];
  const inside = (r) => pointInLoop(r, loops[0]) && !loops.slice(1).some(h => pointInLoop(r, h));
  if (inside(P) || inside(Q)) return true;
  const cr = (u, v, w) => (v[0] - u[0]) * (w[1] - u[1]) - (v[1] - u[1]) * (w[0] - u[0]);
  for (const lp of loops) for (let i = 0; i < lp.length; i++) {
    const A = lp[i], B = lp[(i + 1) % lp.length];
    if ((cr(A, B, P) > 0) !== (cr(A, B, Q) > 0) && (cr(P, Q, A) > 0) !== (cr(P, Q, B) > 0)) return true;
  }
  return false;
}
// view basis: up follows `upHint` (z unless given), or right follows `rightHint`
function viewBasis(d, o) {
  o = o || {};
  if (o.rightHint) { const R = o.rightHint, k = vdot(R, d), right = vnorm([R[0] - k * d[0], R[1] - k * d[1], R[2] - k * d[2]]); return { right, up: vcross(d, right) }; }
  const U = o.upHint || [0, 0, 1], k = vdot(U, d), up = vnorm([U[0] - k * d[0], U[1] - k * d[1], U[2] - k * d[2]]);
  return { right: vcross(up, d), up };
}
function renderItems(items, d, pxPerUnit, basis) {
  d = vnorm(d);
  const { right, up } = viewBasis(d, basis);
  const keyD = vnorm([d[0] * 4000 - 1500, d[1] * 4000 + 1200, d[2] * 4000 + 3000]), fillD = vnorm([2500, 1500, 800]);
  const sky = [0.965, 0.953, 0.933], ground = [0.275, 0.259, 0.235], lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const polys = [];
  for (const it of items) {
    const base = it.fill.map(lin);
    for (const fc of it.faces) {
      const n = newellN(fc.pts);
      if (!n || vdot(n, d) <= 1e-7) continue;
      const t = 0.5 + 0.5 * n[2], k = 0.72 * Math.max(0, vdot(n, keyD)), f = 0.22 * Math.max(0, vdot(n, fillD));
      fc.n = n;
      fc.fill = it.flat ? it.fill.slice() : [0, 1, 2].map(i => Math.round(255 * LIN2SRGB(base[i] * ((ground[i] + (sky[i] - ground[i]) * t) * 0.62 + k + f))));
      fc.edges = it.edges !== false; fc.ink = it.ink; fc.lw = it.lw; fc.tag = it.tag;
      polys.push(fc);
    }
  }
  const order = bspOrder(polys, d), proj = (p) => [vdot(p, right), vdot(p, up)];
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const pg of order) { pg.s2 = pg.pts.map(proj); for (const q of pg.s2) { if (q[0] < u0) u0 = q[0]; if (q[0] > u1) u1 = q[0]; if (q[1] < v0) v0 = q[1]; if (q[1] > v1) v1 = q[1]; } }
  if (!order.length) return { polys: [], proj, box: [0, 0, 1, 1] };
  const W = Math.max(8, Math.min(4000, Math.ceil((u1 - u0) * pxPerUnit) + 2)), H = Math.max(8, Math.min(4000, Math.ceil((v1 - v0) * pxPerUnit) + 2));
  const kx = (W - 2) / Math.max(1e-6, u1 - u0), ky = (H - 2) / Math.max(1e-6, v1 - v0);
  for (const pg of order) pg.s = pg.s2.map(q => [1 + (q[0] - u0) * kx, H - 1 - (q[1] - v0) * ky]);
  const vis = visibleIds(order, W, H), out = [];
  order.forEach((pg, i) => {
    if (!vis[i]) return;
    const p = pg.s2, e = [];
    if (pg.edges) pg.hard.forEach((h, j) => { if (h) { const a = p[j], b = p[(j + 1) % p.length]; e.push([a[0], a[1], b[0], b[1]]); } });
    out.push({ p, f: pg.fill, e, ink: pg.ink, lw: pg.lw, tag: pg.tag });
  });
  return { polys: out, proj, box: [u0, v0, u1, v1], right, up };
}

root.MurphyViewer = { Viewer, PrintRenderer, VectorRenderer, MurphyScene, T_COL, renderItems, frustumFaces, cylFaces, diskFace, boxFaces, clipPrism, partFaces, rayHitsPrism, viewBasis };
})(typeof window !== 'undefined' ? window : globalThis);
