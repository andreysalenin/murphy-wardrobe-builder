/* A3 drawing set (jsPDF). Paper coordinates are mm with y UP from the bottom-left
   corner of the sheet; the helpers flip to jsPDF's y-down. Views are drawn as vectors
   from the part solids (painter's order with opaque fills), so they stay crisp. */
(function (root) {
'use strict';
const C = root.MurphyCore, V = root.MurphyViewer;
const PW = 420, PH = 297;
const INK = [27, 29, 33], GREY = [107, 114, 128], LIGHT = [205, 208, 212], FAINT = [240, 238, 233], WHITE = [255, 255, 255];
const ACC = [176, 98, 10], BAD = [176, 40, 31], CABLE = [36, 104, 170];
const FILL = {
  carcass: [244, 236, 221], front: [252, 249, 243], frame: [235, 220, 196], deck: [240, 228, 207], drawer: [248, 241, 228], back: [236, 228, 214],
  plinth: [230, 220, 203], packer: [222, 199, 166], ledge: [244, 236, 221], mattress: [238, 240, 242], metal: [74, 78, 84], chrome: [190, 194, 199], zinc: [178, 184, 192],
  block: [181, 136, 92], rubber: [40, 40, 42], strap: [70, 86, 124], plastic: [244, 244, 240], indicator: [232, 84, 26], bronze: [196, 156, 104],
};
const CUT = [214, 190, 152], CUT_FRONT = [226, 206, 172];
const T_RGB = { 6: [123, 92, 196], 12: [19, 138, 126], 18: [196, 122, 18] };
const LW_VIS = 0.25, LW_THIN = 0.13, LW_DIM = 0.12, LW_CUT = 0.35;
const f0 = (v) => String(Math.round(v));
const fh = (v) => { const r = Math.round(v * 2) / 2; return Number.isInteger(r) ? String(r) : r.toFixed(1); }; // to 0.5 mm, for drilling positions
const mix = (c, k) => c.map(x => Math.round(255 - (255 - x) * k));

/* ------------------------------------------------------------------ sheet */
let CUR = null;
function Sheet(doc, num, total, title, scale, info) {
  const s = { doc, num };
  const Y = (y) => PH - y;
  s.color = (c, kind) => { if (kind === 'fill') doc.setFillColor(c[0], c[1], c[2]); else if (kind === 'text') doc.setTextColor(c[0], c[1], c[2]); else doc.setDrawColor(c[0], c[1], c[2]); };
  s.dash = (on) => { if (doc.setLineDashPattern) doc.setLineDashPattern(on || [], 0); };
  s.font = (size, weight) => { doc.setFont('helvetica', weight === 'bold' ? 'bold' : weight === 'italic' ? 'oblique' : 'normal'); doc.setFontSize(size); };
  s.tw = (str, size, weight) => { s.font(size, weight); return doc.getTextWidth(String(str)); };
  s.text = (x, y, str, o) => {
    o = o || {};
    s.font(o.size || 7, o.weight);
    if (o.box) {
      const w = doc.getTextWidth(String(str)), h = (o.size || 7) / 2.835 * 0.8;
      const x0 = o.ha === 'right' ? x - w : o.ha === 'center' ? x - w / 2 : x;
      const yc = o.va === 'middle' ? y : y + h / 2;
      s.rect(x0 - 0.8, yc - h / 2 - 0.7, w + 1.6, h + 1.4, { fill: o.boxFill || WHITE, lw: 0 });
      s.font(o.size || 7, o.weight);
    }
    s.color(o.color || INK, 'text');
    const opt = { align: o.ha || 'left', baseline: o.va || 'alphabetic' };
    if (o.angle) opt.angle = o.angle;
    doc.text(String(str), x, Y(y), opt);
  };
  s.vtext = (x, y, str, o) => { o = o || {}; s.font(o.size || 7, o.weight); s.color(o.color || INK, 'text'); const w = doc.getTextWidth(String(str)); doc.text(String(str), x, Y(y - w / 2), { angle: 90 }); };
  s.line = (xs, ys, o) => {
    o = o || {};
    doc.setLineWidth(o.lw === undefined ? LW_THIN : o.lw);
    s.color(o.color || INK); s.dash(o.dash);
    for (let i = 0; i < xs.length - 1; i++) doc.line(xs[i], Y(ys[i]), xs[i + 1], Y(ys[i + 1]));
    if (o.dash) s.dash(null);
  };
  s.poly = (pts, o) => s.line(pts.map(p => p[0]), pts.map(p => p[1]), o);
  s.polyFill = (pts, o) => {
    o = o || {};
    if (pts.length < 2) return;
    const segs = [];
    for (let i = 1; i < pts.length; i++) segs.push([pts[i][0] - pts[i - 1][0], -(pts[i][1] - pts[i - 1][1])]);
    const st = o.fill && o.lw === 0 ? 'F' : o.fill ? 'FD' : 'S';
    if (o.fill) s.color(o.fill, 'fill');
    doc.setLineWidth(o.lw === undefined || o.lw === 0 ? (o.lw === 0 ? 0.01 : LW_VIS) : o.lw);
    s.color(o.color || INK); s.dash(o.dash);
    doc.lines(segs, pts[0][0], Y(pts[0][1]), [1, 1], st, true);
    if (o.dash) s.dash(null);
  };
  s.rect = (x, y, w, h, o) => {
    o = o || {};
    const st = o.fill && (o.lw === 0 || o.noStroke) ? 'F' : o.fill ? 'FD' : 'S';
    if (o.fill) s.color(o.fill, 'fill');
    doc.setLineWidth(o.lw === undefined || o.lw === 0 ? (o.lw === 0 ? 0.01 : LW_THIN) : o.lw);
    s.color(o.color || INK);
    if (o.dash) s.dash(o.dash);
    doc.rect(x, Y(y + h), w, h, st);
    if (o.dash) s.dash(null);
  };
  s.circle = (x, y, r, o) => { o = o || {}; if (o.fill) s.color(o.fill, 'fill'); doc.setLineWidth(o.lw === undefined ? LW_THIN : (o.lw || 0.01)); s.color(o.color || INK); if (o.dash) s.dash(o.dash); doc.circle(x, Y(y), r, o.fill ? (o.lw === 0 ? 'F' : 'FD') : 'S'); if (o.dash) s.dash(null); };
  s.image = (url, x, y, w, h) => doc.addImage(url, 'JPEG', x, Y(y + h), w, h, undefined, 'FAST');
  // a vector render (VectorRenderer.iso) into the box x, y (bottom left), w x h: filled faces back to front, then edges
  s.vimage = (img, x, y, w, h) => {
    if (!img || !img.polys) return;
    const kx = w / img.px[0], ky = h / img.px[1], y0 = Y(y + h), lwE = Math.max(0.035, Math.min(0.09, w / 2500));
    for (const pg of img.polys) {
      const p = pg.p, f = pg.f, segs = [];
      for (let i = 1; i < p.length; i++) segs.push([(p[i][0] - p[i - 1][0]) * kx, (p[i][1] - p[i - 1][1]) * ky]);
      doc.setFillColor(f[0], f[1], f[2]); doc.setDrawColor(f[0], f[1], f[2]); doc.setLineWidth(0.04);
      doc.lines(segs, x + p[0][0] * kx, y0 + p[0][1] * ky, [1, 1], 'FD', true);
      if (pg.e.length) {
        doc.setDrawColor(72, 68, 62); doc.setLineWidth(lwE);
        for (const e of pg.e) doc.line(x + e[0] * kx, y0 + e[1] * ky, x + e[2] * kx, y0 + e[3] * ky);
      }
    }
  };
  s.arrow = (tip, dir, o) => {
    o = o || {};
    const L = o.L || 2.2, W = o.W || 0.62;
    const l = Math.hypot(dir[0], dir[1]), d = [dir[0] / l, dir[1] / l], n = [-d[1], d[0]];
    const b = [tip[0] - d[0] * L, tip[1] - d[1] * L];
    s.color(o.color || INK, 'fill'); s.color(o.color || INK);
    doc.setLineWidth(0.01);
    doc.triangle(tip[0], Y(tip[1]), b[0] + n[0] * W, Y(b[1] + n[1] * W), b[0] - n[0] * W, Y(b[1] - n[1] * W), 'F');
  };
  s.dim = (p1, p2, at, orient, text, o) => {
    o = o || {};
    const size = o.size || 6.4, col = o.color || INK, gap = 1.2, over = 1.6;
    const tw = s.tw(text, size) + 1.2;
    if (orient === 'h') {
      const [a, b] = p1[0] <= p2[0] ? [p1, p2] : [p2, p1];
      for (const p of [a, b]) { if (o.noExt) continue; const sg = Math.sign(at - p[1]) || 1; s.line([p[0], p[0]], [p[1] + sg * gap, at + sg * over], { lw: LW_DIM, color: col }); }
      s.line([a[0], b[0]], [at, at], { lw: LW_DIM, color: col });
      const L = b[0] - a[0];
      if (L > 5.4) { s.arrow([a[0], at], [-1, 0], { color: col }); s.arrow([b[0], at], [1, 0], { color: col }); }
      else { s.arrow([a[0], at], [1, 0], { color: col }); s.arrow([b[0], at], [-1, 0], { color: col }); s.line([a[0] - 3.5, a[0]], [at, at], { lw: LW_DIM, color: col }); s.line([b[0], b[0] + 3.5], [at, at], { lw: LW_DIM, color: col }); }
      if (L >= tw + 1 && o.side !== 'over2') s.text((a[0] + b[0]) / 2, at + 0.75, text, { size, ha: 'center', color: col });
      else if (o.side === 'start') s.text(a[0] - (L > 5.4 ? 1.5 : 4.2), at - 0.2, text, { size, va: 'middle', ha: 'right', color: col });
      else if (o.side === 'over' || o.side === 'over2') s.text((a[0] + b[0]) / 2, at + 2.4, text, { size, ha: 'center', color: col });
      else s.text(b[0] + (L > 5.4 ? 1.5 : 4.2), at - 0.2, text, { size, va: 'middle', color: col });
    } else {
      const [a, b] = p1[1] <= p2[1] ? [p1, p2] : [p2, p1];
      for (const p of [a, b]) { if (o.noExt) continue; const sg = Math.sign(at - p[0]) || 1; s.line([p[0] + sg * gap, at + sg * over], [p[1], p[1]], { lw: LW_DIM, color: col }); }
      s.line([at, at], [a[1], b[1]], { lw: LW_DIM, color: col });
      const L = b[1] - a[1];
      if (L > 5.4) { s.arrow([at, a[1]], [0, -1], { color: col }); s.arrow([at, b[1]], [0, 1], { color: col }); }
      else { s.arrow([at, a[1]], [0, 1], { color: col }); s.arrow([at, b[1]], [0, -1], { color: col }); s.line([at, at], [a[1] - 3.5, a[1]], { lw: LW_DIM, color: col }); s.line([at, at], [b[1], b[1] + 3.5], { lw: LW_DIM, color: col }); }
      if (L >= tw + 1) s.vtext(at - 0.75, (a[1] + b[1]) / 2, text, { size, color: col });
      else if (o.side === 'start') s.vtext(at - 0.75, a[1] - 3.5 - tw / 2, text, { size, color: col });
      else if (o.side === 'over') s.vtext(at - 2.4, (a[1] + b[1]) / 2, text, { size, color: col });
      else s.vtext(at - 0.75, b[1] + 3.5 + tw / 2, text, { size, color: col });
    }
  };
  s.leader = (target, at, text, o) => {
    o = o || {};
    const size = o.size || 6.2, col = o.color || INK;
    const ha = o.ha || (at[0] >= target[0] ? 'left' : 'right');
    const land = o.landing === undefined ? 2.5 : o.landing;
    const end = [at[0] + (ha === 'left' ? land : -land), at[1]];
    s.poly([target, at, end], { lw: LW_DIM, color: col });
    s.circle(target[0], target[1], 0.45, { fill: col, lw: 0 });
    s.text(end[0] + (ha === 'left' ? 0.8 : -0.8), end[1], text, { size, va: 'middle', ha, color: col, box: o.box, weight: o.weight });
  };
  s.wrap = (str, width, size, weight) => {
    const words = String(str).split(/\s+/); const out = []; let cur = '';
    for (const w of words) { const t = cur ? cur + ' ' + w : w; if (s.tw(t, size, weight) > width && cur) { out.push(cur); cur = w; } else cur = t; }
    if (cur) out.push(cur);
    return out;
  };
  s.para = (x, y, lines, o) => {
    o = o || {};
    const size = o.size || 6.4, lead = (o.lead || 1.42) * size / 2.835;
    for (const ln of lines) { s.text(x, y, ln, { size, color: o.color || INK, weight: o.weight }); y -= lead; }
    return y;
  };
  s.numbered = (x, y, items, width, o) => { // items: [title, text]
    o = o || {};
    const size = o.size || 6.2, lead = 1.42 * size / 2.835;
    items.forEach((it, i) => {
      const [t, body] = Array.isArray(it) ? it : ['', it];
      s.text(x, y, String(i + 1 + (o.start || 0)), { size, color: o.numColor || ACC, weight: 'bold' });
      const head = t ? t + '. ' : '';
      const lines = s.wrap(head + body, width - 5, size);
      lines.forEach((ln, k) => {
        if (k === 0 && head) {
          s.text(x + 5, y, t + '.', { size, weight: 'bold' });
          s.text(x + 5 + s.tw(t + '. ', size, 'bold'), y, ln.slice(head.length), { size });
        } else s.text(x + 5, y, ln, { size });
        y -= lead;
      });
      y -= lead * 0.35;
    });
    return y;
  };
  s.table = (x, y, cols, rows, o) => {
    o = o || {};
    const rh = o.rowH || 4.5, size = o.size || 6.2, hsize = o.hsize || 5.8;
    const tw = cols.reduce((a, c) => a + c[1], 0);
    let yy = y;
    if (o.header !== false) {
      s.rect(x, yy - rh, tw, rh, { fill: INK, lw: 0 });
      let cx = x;
      for (const [t, w, al] of cols) { const tx = cx + (al === 'left' ? 1.6 : al === 'right' ? w - 1.6 : w / 2); s.text(tx, yy - rh / 2, t, { size: hsize, color: WHITE, ha: al, va: 'middle', weight: 'bold' }); cx += w; }
      yy -= rh;
    }
    rows.forEach((r, i) => {
      if (i % 2 === 1) s.rect(x, yy - rh, tw, rh, { fill: FAINT, lw: 0 });
      let cx = x;
      cols.forEach(([t, w, al], j) => {
        const val = r[j];
        if (o.chipCol === j) { if (val) s.rect(cx + w / 2 - 1.6, yy - rh / 2 - 1.2, 3.2, 2.4, { fill: val, lw: 0 }); }
        else {
          const tx = cx + (al === 'left' ? 1.6 : al === 'right' ? w - 1.6 : w / 2);
          let str = val === undefined || val === null ? '' : String(val);
          while (str.length > 3 && s.tw(str, size) > w - 2.4) str = str.slice(0, -2) + '.';
          s.text(tx, yy - rh / 2, str, { size, ha: al, va: 'middle', weight: o.boldCol === j ? 'bold' : null });
        }
        cx += w;
      });
      yy -= rh;
    });
    s.line([x, x + tw], [yy, yy], { lw: LW_THIN });
    return yy;
  };
  s.viewLabel = (x, y, t, sub) => { s.text(x, y, t, { size: 8.5, weight: 'bold', ha: 'center' }); if (sub) s.text(x, y - 3.8, sub, { size: 6.1, color: GREY, ha: 'center' }); };
  s.heading = (x, y, t, sub) => { s.text(x, y, t, { size: 8.5, weight: 'bold' }); if (sub) s.text(x, y - 3.8, sub, { size: 6.1, color: GREY }); };
  s.titleBlock = () => {
    const x0 = 262, y0 = 8, w = 150, h = 30;
    s.rect(x0, y0, w, h, { fill: WHITE, lw: 0.5 });
    s.line([x0, x0 + w], [y0 + 12, y0 + 12], { lw: LW_THIN });
    const xs = [x0, x0 + 30, x0 + 60, x0 + 85, x0 + 120];
    for (const xx of xs.slice(1)) s.line([xx, xx], [y0, y0 + 12], { lw: LW_THIN });
    s.text(x0 + 3, y0 + h - 6.2, info.project, { size: 9.5, weight: 'bold' });
    s.text(x0 + 3, y0 + h - 12.6, title, { size: 8.2 });
    const cells = [['SHEET', `${num} of ${total}`], ['SCALE', scale], ['UNITS', 'mm'], ['DATE', info.date], ['REV', 'A']];
    cells.forEach(([lab, val], i) => { s.text(xs[i] + 2, y0 + 8.3, lab, { size: 5.2, color: GREY }); s.text(xs[i] + 2, y0 + 2.7, val, { size: 7.4 }); });
  };
  s.finish = () => { doc.setLineWidth(0.5); s.color(INK); doc.rect(8, 8, PW - 16, PH - 16, 'S'); s.titleBlock(); };
  if (num > 1) doc.addPage('a3', 'landscape');
  CUR = s;
  return s;
}

/* ------------------------------------------------------------------ projections
   front: from the room (looking -Y); you see +X on your LEFT, so u = -x.
   side:  from +X (the left side as you face it), u = y (room to the right).
   top:   from above, room at the bottom of the page, u = -x, v = -y.
   back:  from behind (looking +Y), u = x. */
const PROJ = {
  front: { uv: (p) => [-p[0], p[2]], depth: (p) => p[1] },
  side: { uv: (p) => [p[1], p[2]], depth: (p) => p[0] },
  top: { uv: (p) => [-p[0], -p[1]], depth: (p) => p[2] },
  back: { uv: (p) => [p[0], p[2]], depth: (p) => -p[1] },
};
function hull(pts) {
  const P = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 1e-9) lo.pop(); lo.push(p); }
  for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 1e-9) up.pop(); up.push(p); }
  up.pop(); lo.pop();
  return lo.concat(up);
}
function clipPoly(poly, w) { // Sutherland-Hodgman against [u0, u1, v0, v1]
  let out = poly;
  const edges = [[(p) => p[0] >= w[0], (a, b) => { const t = (w[0] - a[0]) / (b[0] - a[0]); return [w[0], a[1] + t * (b[1] - a[1])]; }],
    [(p) => p[0] <= w[1], (a, b) => { const t = (w[1] - a[0]) / (b[0] - a[0]); return [w[1], a[1] + t * (b[1] - a[1])]; }],
    [(p) => p[1] >= w[2], (a, b) => { const t = (w[2] - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), w[2]]; }],
    [(p) => p[1] <= w[3], (a, b) => { const t = (w[3] - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), w[3]]; }]];
  for (const [inside, cut] of edges) {
    const inp = out; out = [];
    for (let i = 0; i < inp.length; i++) {
      const a = inp[(i + inp.length - 1) % inp.length], b = inp[i];
      if (inside(b)) { if (!inside(a)) out.push(cut(a, b)); out.push(b); }
      else if (inside(a)) out.push(cut(a, b));
    }
    if (!out.length) break;
  }
  return out;
}
function View(s, view, scale, paperXY, refUV) {
  const k = 1 / scale, pr = PROJ[view];
  const v = { s, view, scale, k };
  v.uv = pr.uv;
  v.Puv = (q) => [paperXY[0] + (q[0] - refUV[0]) * k, paperXY[1] + (q[1] - refUV[1]) * k];
  v.P = (p) => v.Puv(pr.uv(p));
  v.dim = (p1, p2, off, orient, text, o) => {
    const a = v.P(p1), b = v.P(p2);
    if (text === undefined || text === null) text = f0(Math.abs(orient === 'h' ? b[0] - a[0] : b[1] - a[1]) * scale);
    s.dim(a, b, (orient === 'h' ? a[1] : a[0]) + off, orient, text, o);
  };
  v.dimAt = (p1, p2, at, orient, text, o) => { // at = absolute paper coordinate of the dimension line
    const a = v.P(p1), b = v.P(p2);
    if (text === undefined || text === null) text = f0(Math.abs(orient === 'h' ? b[0] - a[0] : b[1] - a[1]) * scale);
    s.dim(a, b, at, orient, text, o);
  };
  // draw parts, painter's order. o.cut = depth of a section plane (parts nearer than it are removed)
  v.parts = (parts, o) => {
    o = o || {};
    const items = [];
    for (const p of parts) {
      if (o.filter && !o.filter(p)) continue;
      for (const sol of (p.draw || p.solids)) {
        const cs = C.prismCorners(sol);
        let dmin = Infinity, dmax = -Infinity;
        const uv = cs.map(c => { const d = pr.depth(c); if (d < dmin) dmin = d; if (d > dmax) dmax = d; return pr.uv(c); });
        if (o.cut !== undefined && dmin > o.cut + 0.01) continue;
        const cut = o.cut !== undefined && dmax > o.cut + 0.01;
        let poly = hull(uv);
        if (o.window) { poly = clipPoly(poly, o.window); if (poly.length < 3) continue; }
        items.push({ p, poly, dmax: cut ? Infinity : dmax, cut });
      }
    }
    items.sort((a, b) => (a.dmax - b.dmax) || ((a.p.hw ? 1 : 0) - (b.p.hw ? 1 : 0)));
    for (const it of items) {
      const pts = it.poly.map(v.Puv);
      let fill = (o.fill && o.fill(it.p, it.cut)) || (it.cut ? (it.p.kind === 'front' ? CUT_FRONT : it.p.kind === 'mattress' ? [226, 230, 234] : it.p.hw ? (FILL[it.p.kind] || FILL.metal) : CUT) : (FILL[it.p.kind] || FILL.carcass));
      const st = o.style ? o.style(it.p, it.cut) : null;
      s.polyFill(pts.concat([pts[0]]), Object.assign({ fill, lw: it.cut ? LW_CUT : LW_VIS, color: it.p.hw ? [40, 42, 46] : INK }, st || {}));
    }
    return items;
  };
  v.outline = (parts, o) => { // outlines only (for ghosts of the open bed)
    o = o || {};
    for (const p of parts) {
      if (o.filter && !o.filter(p)) continue;
      for (const sol of (p.draw || p.solids)) {
        const cs = C.prismCorners(sol);
        if (o.cut !== undefined) { const ds = cs.map(pr.depth); if (Math.min(...ds) > o.cut + 0.01 || Math.max(...ds) < o.cut - 0.01) continue; }
        let poly = hull(cs.map(pr.uv));
        if (o.window) { poly = clipPoly(poly, o.window); if (poly.length < 3) continue; }
        const pts = poly.map(v.Puv);
        s.polyFill(pts.concat([pts[0]]), Object.assign({ lw: LW_THIN, color: ACC, dash: [1.2, 0.8] }, o.st || {}));
      }
    }
  };
  // ordinate levels: tick + value at each z
  v.levels = (at, zs, o) => {
    o = o || {};
    const size = o.size || 5.8, side = o.side || 1, min = 2.6;
    const ys = zs.map(z => v.Puv([0, z])[1]).sort((a, b) => a - b);
    const placed = [];
    for (const y of ys) {
      let ty = y;
      if (placed.length && ty - placed[placed.length - 1] < min) ty = placed[placed.length - 1] + min;
      placed.push(ty);
      s.line([at, at + side * 2], [y, y], { lw: LW_DIM });
      s.line([at + side * 2, at + side * 3.2], [y, ty], { lw: LW_DIM });
      const val = f0((y - paperXY[1]) * scale + refUV[1] - (o.base || 0));
      s.text(at + side * 3.8, ty, val, { size, va: 'middle', ha: side > 0 ? 'left' : 'right' });
    }
    s.line([at, at], [ys[0], ys[ys.length - 1]], { lw: LW_DIM });
  };
  return v;
}

/* ------------------------------------------------------------------ pages */
function partLabel(s, v, p, text, size) {
  const b = C.prismBox(p.solids[0]);
  const c = v.P([(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2]);
  const lines = String(text).split('\n');
  const w = Math.abs(v.P([b[3], 0, 0])[0] - v.P([b[0], 0, 0])[0]), h = Math.abs(v.P([0, 0, b[5]])[1] - v.P([0, 0, b[2]])[1]);
  let sz = size || 5.6;
  while (sz > 3.6 && (Math.max(...lines.map(l => s.tw(l, sz))) > w - 1 || lines.length * sz * 0.42 > h - 0.6)) sz -= 0.4;
  if (sz <= 3.6) return;
  lines.forEach((ln, i) => s.text(c[0], c[1] + ((lines.length - 1) / 2 - i) * sz * 0.42, ln, { size: sz, ha: 'center', va: 'middle', weight: i === 0 ? 'bold' : null }));
}

function pageOverview(doc, M, S, I, info) {
  const { P, G } = M;
  const s = Sheet(doc, 1, info.total, 'OVERVIEW', 'NTS', info);
  const hw = 200, hh = hw * I.hero.px[1] / I.hero.px[0];
  s.vimage(I.hero, 14, 289 - 6 - hh, hw, hh);
  s.text(16, 289 - 9, 'Closed, from the front left', { size: 6, color: GREY });
  const ow = 132, oh = ow * I.open.px[1] / I.open.px[0];
  s.vimage(I.open, 14, 12, ow, oh);
  s.text(16, 12 + oh + 2, 'Bed down, fronts open', { size: 6, color: GREY });
  const tw = 108, th = tw * I.thick.px[1] / I.thick.px[0];
  s.vimage(I.thick, 150, 12, tw, th);
  s.text(152, 12 + th + 2, 'Fronts off, coloured by sheet thickness', { size: 6, color: GREY });
  [[6, '6 mm'], [12, '12 mm'], [18, '18 mm']].forEach(([t, l], i) => { s.rect(153 + i * 18, 15, 3, 3, { fill: T_RGB[t], lw: 0 }); s.text(157.5 + i * 18, 15.6, l, { size: 5.6 }); });
  const x0 = 232;
  s.text(x0, 274, 'Murphy wardrobe', { size: 21, weight: 'bold' });
  s.text(x0, 265.5, `${f0(P.W)} x ${f0(P.H)} x ${f0(P.D)} cavity, Create-A-Bed vertical queen`, { size: 9.5, color: GREY });
  const desc = `Two plywood towers either side of a fold-down queen bed. Each tower has ${P.drawers.length} drawers, a ${f0(G.hangClear)} hanging space and a top compartment${P.topShelf ? ' with an adjustable shelf' : ''}, behind outside-hinged doors. Above the bed, two lift-up flaps close a ${f0(G.antClear)} high shelf space. The bed turns about the kit's pivots, ${f0(G.pivot[1])} above the floor.`;
  let y = s.para(x0, 257, s.wrap(desc, 172, 7), { size: 7 });
  const st = S.sheets;
  const rows = [
    ['Cavity (W x H x D)', `${f0(P.W)} x ${f0(P.H)} x ${f0(P.D)}`],
    ['Mattress', `${f0(P.mW)} x ${f0(P.mL)} x ${f0(P.mT)}`],
    ['Bed bay, clear', `${f0(G.bayIn)} between the bed-cabinet sides`],
    ['Bed frame', `${f0(G.frameW)} x ${f0(G.frameL)}; face panel ${P.T} mm in two halves, ${f0(2 * (G.xFo + P.faceOverhang))} wide${P.faceOverhang ? `, ${f0(P.faceOverhang)} past the rails` : ''}`],
    ['Pivot', `${f0(G.pivot[1])} above the floor, ${f0(G.pivotBehindFace)} behind the face`],
    ['Bed down', `reaches ${f0(G.clear.open.reach)} from the wall, mattress top ${f0(G.clear.open.mattTop)}`],
    ['Tower, inside', `${f0(G.towerIn)} wide x ${G.cDd === G.cDs ? f0(G.cDd) : f0(G.cDd) + ' (drawers) / ' + f0(G.cDs) + ' (doors)'} deep`],
    ['Drawers', `${P.drawers.length} per tower, fronts ${P.drawers.map(f0).join(' / ')}, ${G.runner} runners`],
    ['Hanging / top', `${f0(G.hangClear)} / ${f0(G.topClear)} clear`],
    ['Fronts', `drawers ${G.tf.drawer}, tower doors ${G.tf.side}, flaps ${G.tf.top}, bed face ${G.tf.bed} mm, faces flush; ${f0(P.gap)} mm reveals, ${f0(G.doorOverlay)} overlay at the hinges; one-piece kick and header`],
    ['Plywood', st.filter(q => q.used).map(q => `${q.T} mm: ${isFinite(q.need) ? q.need : '?'} of ${q.have}`).join(', ')],
    ['Plywood mass', `about ${S.massPly.toFixed(0)} kg (bed frame ${S.massBed.toFixed(0)} kg)`],
  ];
  y -= 2;
  const yb = s.table(x0, y, [['KEY DATA', 46, 'left'], ['', 126, 'left']], rows, { rowH: 4.6, size: 6.4, hsize: 6 });
  let yy = yb - 8;
  s.text(x0, yy, 'IN THIS SET', { size: 7.5, weight: 'bold' });
  yy = s.para(x0, yy - 5, [`1 Overview   2 Elevations and plans   3 Sections and the bed swing   4 Bed frame`,
    `5 Hardware positions   6 Clearances   7 Cut list   ${info.plansFrom}-${info.plansTo} Cutting plans   ${info.seqFrom}-${info.seqFrom + 1} Build sequence`,
    `${info.detFrom}-${info.detFrom + info.nDet - 1} Assembly details and fixings key   ${info.fixAt} Fixings schedule   ${info.total} Design review`], { size: 6.2 });
  s.text(x0, yy - 3, 'READ FIRST', { size: 7.5, weight: 'bold', color: ACC });
  const bads = M.checks.filter(c => c.level !== 'info');
  const rf = ['Measure the cavity at the studs before cutting: width, height and depth drive every part.',
    'The Create-A-Bed positions come from the Deluxe Queen Vertical plan. Drill the bed-cabinet sides from sheet 5, not from the kit booklet: the bed face stands proud of the carcass here, so the depths differ.',
    'Anchor the bed cabinet to the studs through the wall rails before the bed is fitted. The gas springs pull it forward.'];
  for (const c of bads) rf.push(`${c.title}: ${c.text}`);
  const yEnd = s.numbered(x0, yy - 8.5, rf, 172, { size: 6.2 });
  if (I.cut) {
    const top = yEnd - 6, bottom = 42, h = top - bottom;
    if (h > 45) {
      const w = Math.min(176, h * I.cut.px[0] / I.cut.px[1]), hh2 = w * I.cut.px[1] / I.cut.px[0];
      s.vimage(I.cut, x0 + (176 - w) / 2, bottom + (h - hh2) / 2, w, hh2);
      s.text(x0, bottom + (h + hh2) / 2 - 2, 'Bed halfway down', { size: 6, color: GREY });
    }
  }
  s.finish();
}

function pageElevations(doc, M, S, I, info) {
  const { P, G } = M, sc = 20;
  const s = Sheet(doc, 2, info.total, 'ELEVATIONS AND PLANS', '1:20', info);
  const parts = M.parts.filter(p => !p.mattress && !(p.hw && p.mark !== 'HD' && p.mark !== 'HR'));
  // 1. front elevation, fronts on
  const ox = 30, oz = 134;
  const v1 = View(s, 'front', sc, [ox + P.W / 2 / sc, oz], [0, 0]);
  v1.parts(parts, { filter: (p) => !p.leg });
  // labels on the fronts
  for (const p of M.parts) if (p.kind === 'front' && !p.hw && (p.mark[0] === 'D' || p.mark === 'F1')) {
    const txt = p.mark === 'F1' ? (p.name.endsWith('(L)') ? `F1  bed face\n${f0(2 * (G.xFo + P.faceOverhang))} x ${f0(G.faceL)}` : null) : `${p.mark}\n${f0(p.W)} x ${f0(p.L)}`;
    if (txt) partLabel(s, v1, p, txt, 5.4);
  }
  // reveal line at the joint between the face panels
  s.viewLabel(ox + P.W / 2 / sc, 280, 'FRONT ELEVATION', 'fronts closed; reveals ' + f0(P.gap) + ' mm');
  // heights of the fronts on the right (your right is -x)
  const xr = v1.P([-P.W / 2, 0, 0])[0] + 4;
  const zsF = [[0, G.kickH]].concat(G.fronts.map(f => [f.z0, f.z1]), [G.midDoor, G.topDoor, [G.zTop, P.H]]);
  zsF.forEach(([a, b], i) => v1.dimAt([-P.W / 2, 0, a], [-P.W / 2, 0, b], xr, 'v', null, Object.assign({ size: 5.4, noExt: true }, i === 0 ? { side: 'start' } : {})));
  v1.dimAt([-P.W / 2, 0, 0], [-P.W / 2, 0, P.H], xr + 7, 'v', f0(P.H), { size: 6 });
  // bed face and flaps on the left
  const xl = v1.P([P.W / 2, 0, 0])[0] - 4;
  [[G.zF0, G.zF1], [G.flapZ[0], G.flapZ[1]]].forEach(([a, b]) => v1.dimAt([P.W / 2, 0, a], [P.W / 2, 0, b], xl, 'v', null, { size: 5.4, noExt: true }));
  v1.dimAt([P.W / 2, 0, 0], [P.W / 2, 0, G.zF0], xl, 'v', null, { size: 5.2, noExt: true, side: 'start' });
  // widths below
  const yb = v1.P([0, 0, 0])[1] - 4;
  [[G.doorX[0], G.doorX[1]], [G.flapX[0], G.flapX[1]], [-G.flapX[1], -G.flapX[0]], [-G.doorX[1], -G.doorX[0]]].forEach(([a, b]) => v1.dimAt([a, 0, 0], [b, 0, 0], yb, 'h', null, { size: 5.4, noExt: true }));
  v1.dimAt([-P.W / 2, 0, 0], [P.W / 2, 0, 0], yb - 6, 'h', f0(P.W), { size: 6 });
  v1.dimAt([-(G.xFo + P.faceOverhang), 0, 0], [G.xFo + P.faceOverhang, 0, 0], yb - 12, 'h', `${f0(2 * (G.xFo + P.faceOverhang))} bed face`, { size: 5.6 });

  // 2. carcass elevation, fronts off
  const ox2 = 196;
  const v2 = View(s, 'front', sc, [ox2 + P.W / 2 / sc, oz], [0, 0]);
  v2.parts(parts, { filter: (p) => !(p.kind === 'front') && !p.leg && p.mark !== 'HD' });
  // marks on carcass parts
  const tagged = new Set();
  for (const p of M.parts) {
    if (['T1', 'T2', 'B1', 'B2', 'B3', 'B4', 'T4', 'T3', 'B8', 'F7'].includes(p.mark) && !tagged.has(p.mark + p.name.slice(-3))) {
      if (p.mark === 'T4' || p.mark === 'T3') { if (!p.name.endsWith('(R)')) continue; }
      tagged.add(p.mark + p.name.slice(-3));
      if (['T1', 'T2', 'B1', 'B8'].includes(p.mark)) continue; // too thin to label
      partLabel(s, v2, p, p.mark, 5.2);
    }
  }
  s.viewLabel(ox2 + P.W / 2 / sc, 280, 'CARCASS ELEVATION', 'fronts off, bed frame closed');
  const xr2 = v2.P([-P.W / 2, 0, 0])[0] + 3;
  v2.levels(xr2, [0, G.zPl, G.zPl + P.T, G.zS1b, G.zS1t, G.zRail, G.zS2b, G.zS2t, G.zTopB, G.zTop, P.H]);
  const xl2 = v2.P([P.W / 2, 0, 0])[0] - 3;
  v2.levels(xl2, [G.zF0, G.pivot[1], G.zF1, G.zBm0, G.zBm1], { side: -1 });
  s.text(xl2 - 3, v2.P([0, 0, G.pivot[1]])[1] + 2.4, 'pivot', { size: 5.2, color: ACC, ha: 'right' });

  // 3. plan sections
  const pz = 1300, pb = 92;
  const v3 = View(s, 'top', sc, [ox + P.W / 2 / sc, pb], [0, 0]);
  v3.parts(M.parts.filter(p => !p.leg), { cut: pz, filter: (p) => !(p.hw && p.mark !== 'MP' && !p.mattress) });
  s.viewLabel(ox + P.W / 2 / sc, pb + 14, `PLAN AT ${pz}`, 'cut through the hanging space; room at the bottom');
  const yb3 = v3.P([0, P.D, 0])[1] - 4;
  v3.dimAt([-G.xOi, P.D, 0], [-G.xT2, P.D, 0], yb3, 'h', null, { size: 5.4 });
  v3.dimAt([G.xT2, P.D, 0], [G.xOi, P.D, 0], yb3, 'h', null, { size: 5.4 });
  v3.dimAt([-G.xB, P.D, 0], [G.xB, P.D, 0], yb3, 'h', `${f0(G.bayIn)} bed bay`, { size: 5.4 });
  v3.dimAt([-P.mW / 2, P.D, 0], [P.mW / 2, P.D, 0], yb3 - 5.5, 'h', `${f0(P.mW)} mattress`, { size: 5.4 });
  v3.dimAt([-G.xA, P.D, 0], [G.xA, P.D, 0], yb3 - 11, 'h', null, { size: 5.6 });
  const xd = v3.P([G.xA, 0, 0])[0] - 3;
  v3.dimAt([G.xA, G.yB1, 0], [G.xA, G.yCs, 0], xd, 'v', null, { size: 5.2 });
  v3.dimAt([G.xA, 0, 0], [G.xA, P.D, 0], xd - 5, 'v', null, { size: 5.2 });
  s.text(ox, pb - 48, `Depth: ${f0(P.backGap)} to the wall, ${f0(P.Tback)} back, then carcass and front: ${[['drawers', 'drawer'], ['tower doors', 'side'], ['flaps', 'top'], ['bed face', 'bed']].map(([n, k]) => `${n} ${f0(G.yFbOf[k] - P.frontGap - G.yB1)} + ${f0(P.frontGap)} + ${f0(G.tf[k])}`).join(', ')}; every front's face in one plane.`, { size: 5.6, color: GREY });
  const pz2 = (G.zBm1 + G.zTopB) / 2;
  const v4 = View(s, 'top', sc, [ox2 + P.W / 2 / sc, pb], [0, 0]);
  v4.parts(M.parts.filter(p => !p.leg && !p.mattress), { cut: pz2, filter: (p) => !(p.hw && !['FS', 'LP', 'PL'].includes(p.mark)) });
  s.viewLabel(ox2 + P.W / 2 / sc, pb + 14, `PLAN AT ${f0(pz2)}`, 'cut through the shelf space above the bed');
  const yb4 = v4.P([0, P.D, 0])[1] - 4;
  v4.dimAt([-G.xJ, P.D, 0], [-P.T / 2, P.D, 0], yb4, 'h', null, { size: 5.4 });
  v4.dimAt([P.T / 2, P.D, 0], [G.xJ, P.D, 0], yb4, 'h', null, { size: 5.4 });
  v4.dimAt([-G.xJ, P.D, 0], [G.xJ, P.D, 0], yb4 - 5.5, 'h', null, { size: 5.6 });

  // fronts schedule
  const tx = 375;
  s.heading(tx - 30, 248, 'FRONTS', `drawers ${G.tf.drawer}, doors ${G.tf.side}, flaps ${G.tf.top}, bed face ${G.tf.bed} mm; ${f0(G.doorOverlay)} overlay at the hinges`);
  const fr = S.cut.filter(r => r.mark[0] === 'D' || r.mark === 'F1' || r.mark[0] === 'K');
  const rows = fr.map(r => [r.mark, f0(r.L) + ' x ' + f0(r.W), r.qty, r.mark.startsWith('D1') || r.mark.startsWith('D2') ? (P.doorHinge === 'outer' ? 'wall edge' : 'bed edge') : r.mark.startsWith('D4') ? 'top edge' : '']);
  s.table(tx - 30, 238, [['MARK', 12, 'left'], ['H x W', 24, 'left'], ['QTY', 9, 'right'], ['HINGED', 20, 'left']], rows, { rowH: 4.3, size: 5.8, hsize: 5.4 });
  s.finish();
}

// the headboard box in section between the ribs, 1:9: the lean, the doors and their mitre, the room for a wall outlet
function headboardDetail(s, M, ox, oy) {
  const { P, G } = M, H = G.head, sc = 9, D = H.doors;
  const xc = H.gpos && H.gpos.length ? H.gpos[0].x + 20 : -(G.xB / 4) - 100; // through the power point, or between ribs
  const win = [-25, Math.max(H.capY, D ? H.y0 + 110 : 0) + 30, (G.ledge ? G.ledge.top - 60 : H.z0 - 40), H.top + P.Thead + 30];
  const v = View(s, 'side', sc, [ox, oy], [win[0], win[2]]);
  v.parts(M.parts.filter(p => !p.bed && !p.mattress), { cut: xc, window: win, filter: (p) => /^H[1-9]$/.test(p.mark) || p.mark === 'PP' || (p.mark === 'PL' && /Headboard/.test(p.name)) });
  const a = v.Puv([win[0], win[2]]), b = v.Puv([win[1], win[3]]);
  const w0 = v.Puv([0, win[2]]), w1 = v.Puv([0, win[3]]);
  s.line([w0[0], w1[0]], [w0[1], w1[1]], { lw: 0.45 });
  s.text(w0[0] - 1.5, w0[1] + 2, 'wall', { size: 5, ha: 'right', color: GREY });
  // a wall outlet and its plug: the clear depth wanted, at the top of the box
  { // the double power point in the shelf: plate on top, mechanism below, in the clear depth wanted
    const g = (H.gpos && H.gpos[0]) || { y: (G.yB1 + H.clear) / 2, body: 32 }, top = H.top + P.Thead;
    const o0 = v.Puv([g.y - P.headClear / 2, H.top - g.body]), o1 = v.Puv([g.y + P.headClear / 2, top + 8]);
    s.rect(o0[0], o0[1], o1[0] - o0[0], o1[1] - o0[1], { lw: 0.25, dash: [0.8, 0.5], color: H.clear >= P.headClear ? [92, 150, 104] : BAD });
    s.leader([(o0[0] + o1[0]) / 2, o0[1]], [o0[0] + 2, o0[1] - 14], `double power point, ${f0(P.headClear)} deep`, { size: 4.6, ha: 'left', color: GREY });
  }
  v.dimAt([0, 0, H.top - 60], [0, H.clear, H.top - 60], v.P([0, 0, H.top - 60])[1] - 3, 'h', `${f0(H.clear)} clear`, { size: 5, color: H.clear >= P.headClear ? INK : BAD });
  v.dimAt([0, 0, H.top + P.Thead], [0, H.capY, H.top + P.Thead], v.P([0, 0, H.top + P.Thead])[1] + 4, 'h', null, { size: 5 });
  if (D) {
    // the door's top edge tipping forward about its foot, as far as the window shows
    const th = (D.open) * Math.PI / 180, ax = D.axis;
    const rot = (q, t) => { const dy = q[0] - ax[0], dz = q[1] - ax[1]; return [ax[0] + dy * Math.cos(t) + dz * Math.sin(t), ax[1] - dy * Math.sin(t) + dz * Math.cos(t)]; };
    const arc = [];
    for (let k = 0; k <= 60; k++) { const q = rot(D.Od, th * k / 60); if (q[0] > win[1] - 3) break; arc.push(v.Puv(q)); }
    if (arc.length > 1) s.poly(arc, { lw: 0.25, dash: [1.2, 0.7], color: ACC, closed: false });
    const tq = arc[arc.length - 1] || v.Puv(D.Od);
    s.text(b[0] + 3, tq[1] - 2, `tips forward ${f0(D.open)} deg${D.open >= 90 + P.headAngle - 0.5 ? ', onto the mattress' : D.open >= D.rest - 0.5 ? ', onto the mattress edge' : ''}`, { size: 4.8, color: ACC, ha: 'left', va: 'middle' });
    const hq = v.Puv(ax); s.circle(hq[0], hq[1], 0.7, { fill: ACC, lw: 0 });
    s.text(hq[0] + 1.5, hq[1] - 2.5, D.hinge.front ? 'piano hinge, knuckle to the front' : 'piano hinge, hidden behind the foot', { size: 4.6, color: GREY });
    const mq = v.Puv([(D.O[0] + D.I[0]) / 2, (D.O[1] + D.I[1]) / 2]);
    s.leader(mq, [b[0] + 3, mq[1] + 6], `mitre ${(Math.round(D.mitre * 10) / 10)} deg, ${D.gap} gap`, { size: 4.8, ha: 'left' });
  }
  s.rect(a[0], a[1], b[0] - a[0], b[1] - a[1], { lw: 0.2, dash: [2, 0.8, 0.4, 0.8] });
  s.text(a[0], b[1] + 15, `HEADBOARD ${D ? 'BOX' : 'SHELF'}  1:${sc}`, { size: 7.5, weight: 'bold' });
  s.text(a[0], b[1] + 11, `cut through the services zone and its power point; leaning ${P.headAngle} deg, ${H.maxAngle.toFixed(1)} at most for ${f0(P.headClear)} clear at the top`, { size: 5, color: GREY });
  let yPara = b[1] - 14;
  if (D) yPara = s.para(b[0] + 3, b[1] - 14, s.wrap(`Services zone ${f0(H.zone)} at each tower behind a removable panel, then three ${f0(H.compW)} compartments behind three ${f0(D.W)} x ${f0(D.H)} doors, ${D.reveal} mm reveals over the supports (${P.T} mm between doors, ${P.Thead} at the ends). ${D.hinge.front ? 'Each door stands on the box floor on a stainless piano hinge, knuckle along its front bottom edge at mattress height,' : 'Each door turns on a stainless piano hinge hidden in the corner behind its foot'} and leans back closed under its own weight. Press the top: a TIP-ON under the shelf pushes it ${D.pop} mm proud, and that is the pull. It tips forward about the pin ${f0(D.open)} deg, ${D.hinge.front ? 'face down onto the mattress' : 'onto the mattress\'s head edge'}. Doors and shelf are both cut at ${(Math.round(D.mitre * 10) / 10)} deg (tilt the saw ${(Math.round((90 - D.mitre) * 10) / 10)}) and meet in a ${D.gap} mm line.`, 36, 5), { size: 5, color: GREY });
  // the piano hinge at the foot of a door, full size, cut through the middle door: closed, and tipping (dashed);
  // to the right of the notes
  if (D && D.hinge) {
    const hg = D.hinge, K = hg.K, w1 = hg.front ? [K[0] - 22, K[0] + 8, K[1] - 12, K[1] + 17] : [K[0] - 11, K[0] + 21, K[1] - 14, K[1] + 15];
    const o1 = [b[0] + 44, b[1] - 20 - (w1[3] - w1[2])];
    const v1 = View(s, 'side', 1, o1, [w1[0], w1[2]]);
    v1.parts(M.parts.filter(p => !p.bed && !p.mattress), { cut: 0.5, window: w1, filter: (p) => ['H1', 'H4', 'HT', 'H5'].includes(p.mark) });
    const q0 = v1.Puv([w1[0], w1[2]]), q1 = v1.Puv([w1[1], w1[3]]);
    s.rect(q0[0], q0[1], q1[0] - q0[0], q1[1] - q0[1], { lw: 0.2, dash: [2, 0.8, 0.4, 0.8] });
    // the door's foot tipped 35 deg about the pin
    const th = 35 * Math.PI / 180, rot = (q) => { const dy = q[0] - K[0], dz = q[1] - K[1]; return [K[0] + dy * Math.cos(th) + dz * Math.sin(th), K[1] - dy * Math.sin(th) + dz * Math.cos(th)]; };
    const up = (q, h) => [q[0] - h * Math.sin(H.a * Math.PI / 180), q[1] + h * Math.cos(H.a * Math.PI / 180)];
    const gh = [up(D.Bb, 7), D.Bb, D.Fb, up(D.Fb, 7)].map(rot).map(q => v1.Puv(q));
    s.poly(gh, { lw: 0.25, dash: [1, 0.6], color: ACC });
    const kq = v1.Puv(K); s.circle(kq[0], kq[1], 0.45, { fill: ACC, lw: 0 });
    s.leader(kq, [b[0] + 3, q0[1] - 5], hg.front ? `the pin, at mattress height: 30 x ${hg.t} stainless piano hinge` : `the pin, inside behind the foot: 30 x ${hg.t} stainless piano hinge`, { size: 4.2, ha: 'left', color: GREY });
    const fq = hg.front ? v1.Puv([K[0] - 5, K[1] - 8]) : v1.Puv([K[0] - 8, K[1] - 6]); s.leader(fq, [b[0] + 3, q0[1] - 9], hg.front ? 'box floor bevelled 10 underneath, clear of the swing' : 'box floor stops behind the doors; their feet swing past it', { size: 4.2, ha: 'left', color: GREY });
    s.text(q0[0], q1[1] + 4, 'PIANO HINGE AT THE FOOT  1:1', { size: 6, weight: 'bold' });
    s.text(q0[0], q1[1] + 1.2, 'cut through a door; tipping 35 deg dashed', { size: 4.4, color: GREY });
  }
}

function pageSections(doc, M, M90, M45, S, info) {
  const { P, G } = M, sc = 15;
  const s = Sheet(doc, 3, info.total, 'SECTIONS AND THE BED SWING', '1:15', info);
  const xs = Math.round(G.xFi - 120);
  const ox = 26, oz = 54;
  const v = View(s, 'side', sc, [ox, oz], [0, 0]);
  const keep = (p) => !(p.hw && !p.mattress && !['PV', 'LG', 'HD', 'GS', 'BS', 'ST', 'SP', 'FS', 'FH', 'LP', 'PL', 'SF'].includes(p.mark));
  v.parts(M.parts, { cut: xs, filter: keep });
  // the bed at 45 and 90 deg as ghosts
  const bedCut = (p) => p.bed && (p.kind !== 'metal');
  v.outline(M45.parts, { cut: xs, filter: bedCut, st: { color: GREY, dash: [0.5, 0.7], lw: 0.1 } });
  v.outline(M90.parts, { cut: xs, filter: bedCut });
  v.outline(M90.parts, { filter: (p) => p.leg || p.mark === 'GS', st: { color: ACC, lw: 0.2 } });
  // floor and wall
  s.line([ox - 6, v.P([0, 2600, 0])[0]], [oz, oz], { lw: 0.4 });
  s.line([ox, ox], [oz - 3, v.P([0, 0, P.H])[1] + 3], { lw: 0.4 });
  for (let i = 0; i < 26; i++) { const x = ox - 4 + i * 6.5; s.line([x, x - 2.5], [oz, oz - 2.5], { lw: 0.1, color: GREY }); }
  s.line([v.P([0, 0, P.H])[0] - 4, v.P([0, P.D + 40, P.H])[0]], [v.P([0, 0, P.H])[1], v.P([0, 0, P.H])[1]], { lw: 0.4 });
  // swing arcs
  const key = [[[G.yF, G.zF0], 'face panel, bottom front'], [[G.yM0, G.zM0], 'mattress, head corner'], [[G.yM0, G.zM1], 'mattress, foot corner'], [[G.yF, G.zF1], 'foot of the bed']];
  for (const [kp] of key) {
    const pts = []; for (let i = 0; i <= 60; i++) { const q = C.rot2(kp, G.pivot, (i / 60) * Math.PI / 2); pts.push(v.Puv(q)); }
    s.poly(pts, { lw: 0.18, color: ACC, dash: [1.4, 0.8] });
  }
  const pv = v.Puv(G.pivot);
  s.circle(pv[0], pv[1], 1.2, { fill: ACC, lw: 0 });
  s.line([pv[0] - 3, pv[0] + 3], [pv[1], pv[1]], { lw: 0.15, color: ACC }); s.line([pv[0], pv[0]], [pv[1] - 3, pv[1] + 3], { lw: 0.15, color: ACC });
  // pivot dims
  v.dimAt([G.pivot[0], 0, 0], [G.pivot[0], 0, G.pivot[1]], pv[0] - 6, 'v', null, { size: 5.6, color: ACC });
  v.dimAt([0, G.pivot[0], G.pivot[1]], [0, G.yF, G.pivot[1]], pv[1] + 4, 'h', null, { size: 5.6, color: ACC, side: 'over' });
  s.leader(pv, [pv[0] + 40, pv[1] + 22], `PIVOT  ${f0(G.pivot[1])} up, ${f0(G.pivot[0])} from the wall`, { size: 6, color: ACC, weight: 'bold' });
  // depth along the top
  const zt = v.P([0, 0, P.H])[1] + 6;
  v.dimAt([0, 0, P.H], [0, P.D, P.H], zt, 'h', null, { size: 6 });
  // open-bed numbers
  const O = G.clear.open;
  const yOpen = v.P([0, O.reach, 0])[0];
  v.dimAt([0, 0, 0], [0, O.reach, 0], oz - 15, 'h', `${f0(O.reach)} bed down`, { size: 6 });
  v.dimAt([0, O.reach, 0], [0, O.reach, O.mattTop], yOpen + 4, 'v', `${f0(O.mattTop)} top`, { size: 5.4, side: 'end' });
  v.dimAt([0, O.reach, 0], [0, O.reach, O.faceUnder], yOpen + 11, 'v', `${f0(O.faceUnder)} under`, { size: 5.4, side: 'end' });
  // ledge
  if (G.ledge && !G.ledge.skipped) {
    v.dimAt([0, G.yB1, G.ledge.top], [0, G.ledge.y, G.ledge.top], v.P([0, 0, G.ledge.top])[1] + 4, 'h', null, { size: 5.4, side: 'over' });
    s.leader(v.P([0, G.ledge.y / 2, G.ledge.top - 60]), [v.P([0, 0, 0])[0] + 30, v.P([0, 0, 760])[1]], `headboard ledge, top at ${f0(G.ledge.top)}`, { size: 5.6, box: true });
  }
  if (G.head && !G.head.skipped) {
    const hb = v.P([0, G.head.F1[0], G.head.F1[1]]);
    s.leader(hb, [hb[0] + 26, hb[1] + 10], `backrest, ${P.headAngle} deg, shelf at ${f0(G.head.top + P.Thead)}`, { size: 5.6, box: true });
    v.dimAt([0, 0, G.head.z0], [0, G.head.y0, G.head.z0], v.P([0, 0, G.head.z0])[1] - 4, 'h', null, { size: 5.4 });
  }
  // lowest point and clearance notes
  const low = v.P([0, G.pivot[0], G.clear.minZ]);
  s.leader(low, [low[0] + 18, oz - 6], `lowest point ${f0(G.clear.minZ)} off the floor`, { size: 5.6, box: true });
  s.leader(v.P([0, G.yFb - 20, G.zF1]), [v.P([0, 0, 0])[0] + 70, v.P([0, 0, G.zF1 + 140])[1]], `${f0(P.gapHolder)} under the shelf${G.steel ? `, ${f0(Math.max(0, G.steel.z0 - G.zF1))} under the steel flat in its front edge` : ''}; the bed top rises ${Math.max(0, G.clear.maxZ - G.zF1).toFixed(1)} as it turns`, { size: 5.6, box: true, ha: 'left' });
  s.viewLabel(ox + 76, 278, `SECTION A-A`, `through the bed bay at ${xs} from the centre line, looking at the left side; bed closed, at 45 deg and down`);

  // tower section
  const tx = -Math.round(G.xT2 + G.towerIn / 2);
  const ox2 = 212;
  const v2 = View(s, 'side', sc, [ox2, oz], [0, 0]);
  v2.parts(M.parts, { cut: tx, filter: (p) => !p.bed && (!p.hw || ['HR', 'RN'].includes(p.mark)) });
  s.line([ox2 - 4, ox2 + P.D / sc + 4], [oz, oz], { lw: 0.4 });
  s.line([ox2, ox2], [oz - 3, v2.P([0, 0, P.H])[1] + 3], { lw: 0.4 });
  s.viewLabel(ox2 + 20, 278, 'SECTION B-B', 'through a tower');
  const ztt = v2.P([0, 0, P.H])[1] + 5;
  [[0, G.yB0], [G.yB0, G.yB1], [G.yB1, G.yCs], [G.yCs, G.yFbOf.side], [G.yFbOf.side, G.yF]].forEach(([a, b], i) => v2.dimAt([0, a, P.H], [0, b, P.H], ztt, 'h', null, { size: 5, side: i === 0 ? 'start' : i >= 3 ? 'end' : undefined }));
  const f1 = G.fronts[0];
  v2.dimAt([0, G.yCd - G.runner, f1.z0], [0, G.yCd, f1.z0], v2.P([0, 0, f1.z0])[1] - 3, 'h', `${G.runner} runners`, { size: 5 });
  v2.levels(v2.P([0, P.D, 0])[0] + 4, [G.zPl + P.T, G.zS1b, G.zS1t, G.zRail, G.zS2b, G.zS2t, G.zTopB], { size: 5.4 });
  s.text(v2.P([0, (G.yB1 + G.yCs) / 2, G.zRail])[0], v2.P([0, 0, G.zRail])[1] - 4, 'rail', { size: 5, ha: 'center', color: GREY });

  // clearance table
  const cx = 292;
  s.heading(cx, 262, 'SWING CLEARANCES', 'closest approach while the bed turns 0 to 90 deg; all of them on sheet 6');
  const rows = G.clear.list.filter(r => r.name !== 'back wall' && r.min < 60).sort((a, b) => a.min - b.min).map(r => [r.name, r.part, f0(r.angle) + ' deg', (r.min < 0 ? 'CLASH ' : '') + f0(r.min)]);
  let y = s.table(cx, 252, [['FIXED PART', 40, 'left'], ['MOVING PART', 32, 'left'], ['AT', 14, 'right'], ['CLEAR', 16, 'right']], rows, { rowH: 4.4, size: 5.8, hsize: 5.4 });
  y -= 7;
  s.heading(cx, y, 'BED DOWN');
  y = s.table(cx, y - 3, [['', 60, 'left'], ['', 42, 'right']], [
    ['Reaches from the back wall', f0(O.reach)], ['Into the room past the fronts', f0(O.reach - P.D)], ['Mattress top above the floor', f0(O.mattTop)],
    ['Face panel underside', f0(O.faceUnder)], ['Mattress head from the wall', f0(O.mattHead)], ['Leg pivot height (legs reach)', f0(G.legPost)]], { header: false, rowH: 4.4, size: 5.8 });
  y -= 7;
  s.heading(cx, y, 'NOTES');
  s.numbered(cx, y - 6, [
    `Section A-A is cut ${xs} from the centre, inside the side rail, so the rail on the far side shows the pivot, the gas spring (dashed when the bed is down) and the folded legs.`,
    'Dashed amber: paths of the face panel, the mattress corners and the foot of the bed, and the bed at 90 deg. Grey dots: the bed at 45 deg.',
    `The ledge is sized from the swing: its front is ${P.ledgeClear} mm clear of the mattress's head corner at its furthest back, at pivot height. Above the mattress nothing swings back, so the backrest steps out to ${P.headGap} mm behind the open mattress.`,
    'The mattress is drawn as a block. A pillow top or a mattress that bulges takes up the clearances shown; keep the straps tight.',
  ], 112, { size: 5.8 });
  if (G.head && !G.head.skipped) headboardDetail(s, M, 286, 42);
  s.finish();
}

function pageBed(doc, M, S, info) {
  const { P, G } = M;
  const s = Sheet(doc, 4, info.total, 'BED FRAME', '1:15, 1:5, 1:2.5', info);
  // 1. frame from behind (mattress and support off)
  const sc = 15, ox = 30, oz = 60;
  const v = View(s, 'back', sc, [ox + G.xFo / sc, oz], [0, G.zF0]);
  void 0;
  v.parts(M.parts, { filter: (p) => p.bed && !p.mattress && p.mark !== 'F7' && p.mark !== 'HD' });
  for (const p of M.parts) if (p.bed && ['F3', 'F4'].includes(p.mark)) partLabel(s, v, p, p.mark, 5);
  const fr = M.parts.find(p => p.mark === 'F1');
  partLabel(s, v, Object.assign({}, fr, { solids: [M.parts.find(p => p.mark === 'F6').solids[0]] }), 'F6', 4.6);
  s.viewLabel(ox + G.xFo / sc, 262, 'BED FRAME FROM BEHIND', 'mattress and its support off; head end at the bottom');
  const yb = v.P([0, 0, G.zF0])[1] - 4;
  v.dimAt([-G.xFo, 0, G.zF0], [G.xFo, 0, G.zF0], yb - 5, 'h', null, { size: 6 });
  v.dimAt([-G.xFi, 0, G.zF0], [G.xFi, 0, G.zF0], yb, 'h', null, { size: 5.6 });
  const xr = v.P([G.xFo, 0, 0])[0] + 4;
  v.dimAt([G.xFo, 0, G.zF0], [G.xFo, 0, G.zF1], xr + 6, 'v', null, { size: 6 });
  v.levels(xr, [G.zF0, G.pivot[1], G.legPivot[1], G.zF1], { size: 5.4, base: G.zF0 });
  s.text(xr + 4, v.P([0, 0, G.pivot[1]])[1] - 3, 'pivot', { size: 5, color: ACC });
  s.text(xr + 4, v.P([0, 0, G.legPivot[1]])[1] - 3, 'leg pivot', { size: 5, color: ACC });
  s.text(ox - 2, oz - 18, `Levels measured from the frame's head end (bottom when closed). Struts ${f0(P.ladderW)} wide, ${P.struts} evenly spaced.`, { size: 5.6, color: GREY });

  // 2. side rail details at 1:5 (the rail on your right, seen from inside the bed)
  const sc5 = 5;
  const railView = (x0, y0, z0, z1) => {
    const vv = View(s, 'side', sc5, [x0, y0], [G.yRail - 20, z0]);
    const win = [G.yRail - 20, G.yF + 8, z0, z1];
    vv.parts(M.parts, { filter: (p) => p.bed && ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'BS'].includes(p.mark) && (!p.hw || p.name.indexOf('(R)') >= 0), cut: -G.xFi + 1, window: win });
    const a0 = vv.Puv([win[0], win[2]]), a1 = vv.Puv([win[1], win[3]]);
    s.line([a0[0] - 1, a1[0] + 1], [a1[1], a1[1]], { lw: 0.2, dash: [2, 0.8, 0.4, 0.8] });
    if (z0 > G.zF0) s.line([a0[0] - 1, a1[0] + 1], [a0[1], a0[1]], { lw: 0.2, dash: [2, 0.8, 0.4, 0.8] });
    return vv;
  };
  const hx = 176, hy = 150;
  const vh = railView(hx, hy, G.zF0 - 10, G.zF0 + 400);
  const pv = vh.Puv(G.pivot);
  s.circle(pv[0], pv[1], 25.4 / 2 / sc5, { lw: 0.3, fill: WHITE });
  s.line([pv[0] - 4, pv[0] + 4], [pv[1], pv[1]], { lw: 0.1, color: ACC }); s.line([pv[0], pv[0]], [pv[1] - 4, pv[1] + 4], { lw: 0.1, color: ACC });
  vh.dimAt([0, G.pivot[0], G.zF0], [0, G.pivot[0], G.pivot[1]], vh.P([0, G.yRail, 0])[0] - 5, 'v', `${f0(P.pivotAboveHead)} (9 in)`, { size: 5.4, color: ACC });
  vh.dimAt([0, G.pivot[0], G.pivot[1]], [0, G.yFb, G.pivot[1]], pv[1] + 9, 'h', `${f0(P.pivotFromRail)}`, { size: 5.4, color: ACC });
  const bsp = vh.Puv(G.springBed);
  s.circle(bsp[0], bsp[1], 6 / sc5, { lw: 0.3, fill: [70, 74, 80] });
  vh.dimAt([0, G.springBed[0], G.zF0], [0, G.springBed[0], G.springBed[1]], bsp[0] - 4, 'v', null, { size: 5, side: 'end' });
  s.leader(bsp, [bsp[0] - 14, bsp[1] + 24], 'lower ball stud, plate overhangs end 1/4 in', { size: 5.2, ha: 'right', box: true });
  vh.dimAt([0, G.yRail, G.zF0], [0, G.yFb, G.zF0], hy - 5, 'h', null, { size: 5.6 });
  s.text(hx - 6, hy + 88, 'SIDE RAIL, HEAD END  1:5', { size: 7, weight: 'bold' });
  s.text(hx - 6, hy + 84, '1 in pivot hole 9 in from the end, 4 in from the face edge (plan p.15)', { size: 5.4, color: GREY });
  const fx = 176, fy = 52;
  const vf = railView(fx, fy, G.zF1 - 230, G.zF1 + 10);
  const lp = vf.Puv(G.legPivot);
  s.circle(lp[0], lp[1], 16 / 2 / sc5, { lw: 0.3, fill: WHITE });
  vf.dimAt([0, G.legPivot[0], G.legPivot[1]], [0, G.legPivot[0], G.zF1], vf.P([0, G.yRail, 0])[0] - 5, 'v', null, { size: 5.6, color: ACC });
  vf.dimAt([0, G.yRail, G.legPivot[1]], [0, G.legPivot[0], G.legPivot[1]], lp[1] - 7, 'h', null, { size: 5.6, color: ACC, side: 'start' });
  vf.dimAt([0, G.yFb - P.footRailD, G.zF1], [0, G.yFb, G.zF1], vf.P([0, 0, G.zF1])[1] + 5, 'h', null, { size: 5.6 });
  if (P.railR > 0) s.leader(vf.Puv([G.yRail + P.railR * 0.29, G.zF1 - P.railR * 0.29]), [fx - 4, fy + 46], `R${f0(P.railR)} (2-7/8 in)`, { size: 5.4, ha: 'right' });
  s.text(fx - 6, fy + 64, 'SIDE RAIL, FOOT END  1:5', { size: 7, weight: 'bold' });
  s.text(fx - 6, fy + 60, '5/8 in leg pivot hole 3-1/8 in from the end, 2-1/2 in from the top (p.10)', { size: 5.4, color: GREY });

  // 3. plan detail at the pivot, 1:2.5 (side on your right, x < 0)
  const sc2 = 2.5, dx0 = 268, dy0 = 150;
  const win = [G.xFi - 45, G.xT2 + 25, -(G.yF + 6), -(G.pivot[0] - 150)];
  const vd = View(s, 'top', sc2, [dx0, dy0], [win[0], win[2]]);
  drawSection(s, vd, sectionAt(M.parts.filter(p => !p.leg && p.name.indexOf('(L)') < 0), G.pivot[1]), win);
  const a0 = vd.Puv([win[0], win[2]]), a1 = vd.Puv([win[1], win[3]]);
  s.rect(a0[0], a0[1], a1[0] - a0[0], a1[1] - a0[1], { lw: 0.2, dash: [2, 0.8, 0.4, 0.8] });
  const D = (X, y) => [-X, y, 0];
  const xsD = [P.mW / 2, G.xFi, G.xFo, G.xB - (P.packer ? P.Tpacker : 0), G.xB, G.xJ, G.xT2];
  const ydd = a0[1] - 4;
  for (let i = 0; i < xsD.length - 1; i++) vd.dimAt(D(xsD[i], G.yF), D(xsD[i + 1], G.yF), ydd, 'h', null, { size: 5.4 });
  const tags = [[(P.mW / 2 + G.xFi) / 2, 'gap'], [(G.xFi + G.xFo) / 2, 'rail'], [(G.xFo + xsD[3]) / 2, 'pivot'], [(xsD[3] + G.xB) / 2, P.packer ? 'packer' : ''], [(G.xB + G.xJ) / 2, 'B1'], [(G.xJ + G.xT2) / 2, 'T2']];
  for (const [x, t] of tags) if (t) { const q = vd.P(D(x, G.yF)); s.text(q[0], ydd - 5.5, t, { size: 4.8, ha: 'center', color: GREY }); }
  const pq = vd.P(D((G.xFo + xsD[3]) / 2, G.pivot[0]));
  s.circle(pq[0], pq[1], 0.9, { fill: ACC, lw: 0 });
  vd.dimAt(D(G.xT2 + 25, G.pivot[0]), D(G.xT2 + 25, G.yF), a1[0] + 4, 'v', null, { size: 5.4, color: ACC });
  {
    const [ea, eb] = C.springEnds(G, { xCab: G.springCabX, xBed: G.springBedX, cab: G.springCab, bed: G.springBed }, 0);
    const t = (ea[2] - G.pivot[1]) / (ea[2] - eb[2]), q = vd.P(D(ea[0] + (eb[0] - ea[0]) * t, ea[1] + (eb[1] - ea[1]) * t));
    s.leader(q, [a0[0] - 3, q[1] + 10], 'gas spring rod, behind the rail', { size: 5, ha: 'right' });
  }
  s.text(a0[0], a1[1] + 7, 'PLAN AT THE PIVOT  1:2.5', { size: 7, weight: 'bold' });
  s.text(a0[0], a1[1] + 3, `rail to the mounting face ${f0(G.effGap)}; kit ${P.pinGap}`, { size: 5.6, color: GREY });

  // 4. assumptions table
  const tx = 266, ty = 120;
  s.heading(tx, ty, 'CREATE-A-BED NUMBERS USED', 'from the Deluxe Queen Vertical plan');
  const rows = C.HW_ASSUMPTIONS.map(([k, name, imp, src]) => [name, (Math.round(P[k] * 10) / 10).toString(), imp, src]);
  s.table(tx, ty - 7, [['', 46, 'left'], ['USED mm', 14, 'right'], ['KIT', 22, 'left'], ['WHERE', 58, 'left']], rows, { rowH: 4.1, size: 5.3, hsize: 5.1 });
  s.finish();
}

function pageHardware(doc, M, S, info) {
  const { P, G } = M;
  const s = Sheet(doc, 5, info.total, 'HARDWARE POSITIONS', '1:10, 1:12, 1:2', info);
  const R = (p) => p.name.indexOf('(R)') >= 0;
  // 1. bed-cabinet side from inside the bay (the side on your right)
  const sc = 10, ox = 34, oz = 40;
  const v = View(s, 'side', sc, [ox, oz], [G.yB1, 0]);
  v.parts(M.parts, { cut: -(G.xFo + 1), filter: (p) => (['B1', 'B8', 'B9'].includes(p.mark) && R(p)) || (['PV', 'BS', 'ST'].includes(p.mark) && R(p) && !p.bed) });
  v.outline(M.parts, { filter: (p) => p.mark === 'F2' && R(p), st: { color: GREY, dash: [1, 0.8], lw: 0.12 } });
  v.outline(M.parts, { filter: (p) => p.mark === 'GS' && R(p), st: { color: ACC, lw: 0.2 } });
  const yE = G.yC; // B1 front edge
  const pts = [['pivot', G.pivot, '11-3/4 in, 4-3/4 in'], ['upper ball stud', G.springCab, '30-3/4 in, 10 in'], ['bed stop', G.stop, P.stopFront > 0 ? '6 in below the 87-1/8 in top, 7-3/8 in; drill after a trial closing' : '6 in below the top; set back so the bed closes plumb; drill after a trial closing']];
  const xR = v.P([0, yE, 0])[0] + 6;
  pts.forEach(([name, q], i) => {
    const pq = v.Puv([q[0], q[1]]);
    s.circle(pq[0], pq[1], 1.3, { fill: ACC, lw: 0 });
    v.dimAt([0, q[0], q[1]], [0, yE, q[1]], pq[1] + (i === 2 ? -7.5 : 7.5), 'h', fh(yE - q[0]), { size: 5.4, color: ACC });
    v.dimAt([0, G.yB1, 0], [0, G.yB1, q[1]], v.P([0, G.yB1, 0])[0] - 5 - i * 6, 'v', fh(q[1]), { size: 5.4, color: ACC });
    s.text(xR, pq[1], name, { size: 5.6, va: 'middle', weight: 'bold' });
    s.para(xR, pq[1] - 3.8, s.wrap(`kit: ${pts[i][2]}`, Math.max(30, 142 - xR), 5), { size: 5, color: GREY });
  });
  v.dimAt([0, G.yB1, G.zBm0], [0, yE, G.zBm0], v.P([0, 0, G.zBm0])[1] + 4, 'h', null, { size: 5.4 });
  if (G.bolt) {
    const pq = v.Puv([G.bolt.y, G.bolt.z]);
    s.circle(pq[0], pq[1], G.bolt.holeB / 2 / sc, { lw: 0.3, color: INK, fill: WHITE });
    v.dimAt([0, G.bolt.y, G.bolt.z], [0, yE, G.bolt.z], pq[1] - 4, 'h', fh(yE - G.bolt.y), { size: 5.4 });
    s.text(xR, pq[1] + 6.5, `safety bolt, ${G.bolt.holeB} through, ${fh(G.bolt.z)} up`, { size: 5.6, va: 'middle', weight: 'bold' });
    s.text(xR, pq[1] + 3.5, 'tower side and this side; detail at the bottom right', { size: 5, va: 'middle', color: GREY });
  }
  // cable holes through this side (20 mm), dimensioned from the back edge
  (G.cables || []).filter(q => q.S === 'R' && q.axis === 'x' && q.parts.some(n => /^Bed-cabinet side \(R\)/.test(n))).forEach((q, i) => {
    const [y, z] = q.c, pq = v.Puv([y, z]);
    s.circle(pq[0], pq[1], 10 / sc, { lw: 0.25, color: CABLE, fill: WHITE });
    v.dimAt([0, G.yB1, z], [0, y, z], pq[1] - 4, 'h', fh(y - G.yB1), { size: 5.4, color: CABLE });
    v.dimAt([0, G.yB1, 0], [0, G.yB1, z], v.P([0, G.yB1, 0])[0] - 5 - (3 + i) * 6, 'v', fh(z), { size: 5.4, color: CABLE });
    s.text(xR, pq[1] + 6.5, `cable hole ${q.id}, 20`, { size: 5.6, va: 'middle', weight: 'bold', color: CABLE });
    s.text(xR, pq[1] + 3.5, q.what + ' (sheet 7)', { size: 5, va: 'middle', color: GREY });
  });
  {
    const X = C.gapFacts(P, G), need = X.nut < 2;
    for (const off of need ? [-10, 10] : [0]) s.poly(nutPath(G, v, off), { lw: need ? 0.25 : 0.15, color: need ? BAD : GREY, dash: need ? null : [1, 0.7] });
    const mid = nutPath(G, v, 0)[22];
    s.leader(mid, [ox + 4, oz - 9], need ? `relief for the lower stud nuts, if yours need it: ${f0(Math.max(1, Math.ceil(2 - X.nut)))} deep, 20 wide, R${f0(G.springArm)} about the pivot hole` : `path of the lower stud's nut, R${f0(G.springArm)} about the pivot`, { size: 5, ha: 'left', color: need ? BAD : GREY });
  }
  s.text(ox - 18, 276, 'BED-CABINET SIDE B1  1:10', { size: 7.5, weight: 'bold' });
  s.para(ox - 18, 272, s.wrap(`From inside the bay; front edge on the right. Heights from the floor. Depths from B1's front edge, not the kit's numbers: the bed face stands ${fh(G.yF - yE)} mm proud of the carcass here. ${P.packer ? 'Plates screw to ' + fh(P.Tpacker) + ' mm pads (shaded); the lower ball-stud nuts sweep the side between them.' : ''}`, 92, 5.4), { size: 5.4, color: GREY });

  // 2. tower door, inside face: hinge cups
  const dx = 150, sd = 10, dy = 250 - Math.max(G.midDoor[1] - G.midDoor[0], G.topDoor[1] - G.topDoor[0]) / sd;
  // thin fronts: the boss centre sits 2 mm clear inside the side panel's inner face (as modelled), so from the hinge edge:
  const hingeOffThin = Math.abs((P.doorHinge === 'inner' ? G.doorX[0] : G.doorX[1]) - ((P.doorHinge === 'inner' ? G.xT2 : G.xOi) + (P.doorHinge === 'inner' ? 1 : -1) * (C.HINGE_THIN.boss.d / 2 + 2)));
  const door = (z0, z1, x0, label, mk) => {
    const w = G.doorW / sd, h = (z1 - z0) / sd, inner = P.doorHinge === 'inner';
    s.rect(x0, dy, w, h, { fill: FILL.front, lw: LW_VIS });
    const ex = inner ? x0 + w : x0; // seen from inside, the hinge edge flips
    const pd = M.parts.find(p => p.mark === mk && p.name.endsWith('(R)')), hz = pd && pd.hinges ? pd.hinges : C.hingeZs([z0, z1], G.thin.side);
    const cxd = G.thin.side ? hingeOffThin : G.hingeDoor.cup, cx = inner ? ex - cxd / sd : ex + cxd / sd;
    for (const z of hz) {
      const cy = dy + (z - z0) / sd;
      if (G.thin.side) { // EXPANDO T: two 10 mm dowel holes, 32 apart, under the boss (dashed)
        const B = C.HINGE_THIN.boss, dw = C.HINGE_THIN.dowels;
        s.rect(cx - B.flange[1] / 2 / sd, cy - B.flange[0] / 2 / sd, B.flange[1] / sd, B.flange[0] / sd, { lw: 0.12, dash: [0.8, 0.5], color: GREY });
        for (const dz of [-dw[2] / 2, dw[2] / 2]) s.circle(cx, cy + dz / sd, dw[0] / 2 / sd, { lw: 0.25, fill: WHITE });
        s.line([cx - 2.6, cx + 2.6], [cy, cy], { lw: 0.08 });
      } else { s.circle(cx, cy, 17.5 / sd, { lw: 0.25, fill: WHITE }); s.line([cx - 2.6, cx + 2.6], [cy, cy], { lw: 0.08 }); }
    }
    s.dim([ex, dy + (hz[0] - z0) / sd], [cx, dy + (hz[0] - z0) / sd], dy - 4, 'h', fh(cxd), { size: 5 });
    let prev = z0;
    hz.concat([z1]).forEach((z, k) => { s.dim([x0 + w, dy + (prev - z0) / sd], [x0 + w, dy + (z - z0) / sd], inner ? x0 - 4 : x0 + w + 4, 'v', fh(z - prev), { size: 5 }); prev = z; });
    s.text(x0 + w / 2, dy + h + 3, label, { size: 6, ha: 'center', weight: 'bold' });
  };
  door(G.midDoor[0], G.midDoor[1], dx, `D2  ${fh(G.doorW)} x ${fh(G.midDoor[1] - G.midDoor[0])}`, 'D2');
  door(G.topDoor[0], G.topDoor[1], dx + 58, `D1  ${fh(G.doorW)} x ${fh(G.topDoor[1] - G.topDoor[0])}`, 'D1');
  s.text(dx - 6, 276, 'TOWER DOORS, INSIDE FACE  1:10', { size: 7.5, weight: 'bold' });
  const HD = G.hingeDoor, HF = G.hingeFlap;
  const hz0 = (zr) => { const pd = M.parts.find(p => (p.mark === 'D1' || p.mark === 'D2') && p.name.endsWith('(R)') && Math.abs(p.L - (zr[1] - zr[0])) < 0.5); return pd && pd.hinges ? pd.hinges.length : C.hingeZs(zr, G.thin.side).length; };
  const edgeW = P.doorHinge === 'outer' ? 'wall' : 'bed';
  const doorTxt = G.thin.side
    ? `${P.TfSide} mm doors: ${C.HINGE_THIN.short} (EXPANDO T, no cup), two 10 mm dowel holes 32 apart centred ${fh(hingeOffThin)} from the ${edgeW}-side edge; ${hz0(G.midDoor)} on D2, ${hz0(G.topDoor)} on D1, one more than an 18 mm door to keep it flat.`
    : `${P.TfSide} mm doors: ${C.HINGE_HW.short || C.HINGE_HW.name}, 35 mm cups 13 deep, centres ${fh(HD.cup)} from the ${edgeW}-side edge (${fh(HD.B)} boring distance).`;
  const flapTxt = G.thin.top ? `Flaps (${P.TfTop} mm): ${C.HINGE_FLAP_THIN.short}, ${G.flapHw.hinges.length} per flap` : `Flaps (${P.TfTop} mm): 70T3550 unsprung, cups ${fh(HF.cup)} below the top edge`;
  s.para(dx - 6, 272, s.wrap(`${doorTxt} ${HD.H} mm plates (${HD.code}) 37 back on the side panel: ${fh(HD.overlay)} overlay. ${flapTxt}, on ${HF.H} mm plates (${HF.code}) under the top. Right-hand tower shown.`, 104, 5.4), { size: 5.4, color: GREY });

  // 3. runner lines on a tower side, from inside (front edge on the right)
  {
    const sr = 10, rx = dx + 8, rz = 40, NL = G.runner, holes = C.runnerHoles(NL), zIn = G.zPl + P.T, zs = G.runnerZ || [];
    const vr = View(s, 'side', sr, [rx, rz], [G.yB1, zIn]);
    const [p0, p1] = [vr.Puv([G.yB1, zIn]), vr.Puv([G.yCd, G.zS1b])];
    s.rect(p0[0], p0[1], p1[0] - p0[0], p1[1] - p0[1], { fill: FILL.carcass, lw: LW_VIS });
    for (const z of zs) {
      const a = vr.Puv([G.yCd - NL, z - C.RUNNER_HW.h / 2]), b = vr.Puv([G.yCd, z + C.RUNNER_HW.h / 2]);
      s.rect(a[0], a[1], b[0] - a[0], b[1] - a[1], { fill: FILL.zinc, lw: 0.12, color: [40, 42, 46] });
      for (const h of holes) { const q = vr.Puv([G.yCd - h, z]); s.circle(q[0], q[1], 0.35, { fill: INK, lw: 0 }); }
    }
    let prev = zIn;
    zs.forEach((z, i) => { vr.dimAt([0, G.yB1, prev], [0, G.yB1, z], p0[0] - 4, 'v', fh(z - prev), { size: 4.8 }); prev = z; });
    if (zs.length) {
      const zb = zs[0];
      vr.dimAt([0, G.yCd - holes[0], zb], [0, G.yCd, zb], p0[1] - 4, 'h', fh(holes[0]), { size: 4.6, side: 'over' });
      vr.dimAt([0, G.yCd - holes[holes.length - 1], zb], [0, G.yCd, zb], p0[1] - 9, 'h', fh(holes[holes.length - 1]), { size: 4.8 });
      vr.dimAt([0, G.yCd - NL, zb], [0, G.yCd, zb], p0[1] - 14, 'h', `${fh(NL)} runner`, { size: 4.8 });
    }
    s.text(dx - 6, 134, `DRAWER RUNNERS, TOWER SIDE FROM INSIDE  1:${sr}`, { size: 7.5, weight: 'bold' });
    s.para(dx - 6, 130, s.wrap(`${C.RUNNER_HW.name} ${NL}, full extension, ${C.RUNNER_HW.load} kg, ${C.RUNNER_HW.h} x ${C.RUNNER_HW.w}, a pair per drawer, cabinet members flush with the front edge on the centre lines shown (heights above the tower bottom). Holes from the front edge: ${holes.join(', ')}; screw at least the first, a middle one and the last. Needs ${NL + C.RUNNER_HW.kt} inside the carcase (${fh(G.cDd)} here, behind ${P.TfDrawer} mm fronts) and ${C.RUNNER_HW.w} each side of the box.`, 104, 5.4), { size: 5.4, color: GREY });
  }

  // 3. shelf over the bed from above: pins, latches, stays, flap hinges
  const sp = 12, px0 = 258, py0 = 250;
  const vp = View(s, 'top', sp, [px0 + G.xJ / sp, py0], [0, 0]);
  vp.parts(M.parts.filter(p => !p.leg && !p.mattress && !p.bed), { cut: G.zBm1 + 70, filter: (p) => ['B2', 'B4', 'B5', 'B10', 'B11', 'T2', 'LP', 'PL', 'FS', 'D4', 'SF'].includes(p.mark) || (p.mark === 'FH' && p.name.endsWith('plate')) });
  const yB = vp.P([0, G.yCt, 0])[1] - 6;
  if (P.lockType === 'twin') {
    const hs = P.twinSpacing / 2;
    vp.dimAt([-hs, G.pinY, 0], [hs, G.pinY, 0], yB, 'h', `${fh(2 * hs)} pins`, { size: 5.4 });
    vp.dimAt([-hs, G.pinY, 0], [-hs, G.yCt, 0], vp.P([-hs, 0, 0])[0] + 6, 'v', fh(G.yCt - G.pinY), { size: 5 });
  }
  if (P.lockType === 'pins') {
    vp.dimAt([-P.lockPinX, G.pinY, 0], [P.lockPinX, G.pinY, 0], yB, 'h', `${fh(2 * P.lockPinX)} pins`, { size: 5.4 });
    vp.dimAt([-P.lockPinX, G.pinY, 0], [-P.lockPinX, G.yCt, 0], vp.P([-P.lockPinX, 0, 0])[0] + 6, 'v', fh(G.yCt - G.pinY), { size: 5 });
  }
  vp.dimAt([-G.flapHw.latch, G.yCt, 0], [G.flapHw.latch, G.yCt, 0], yB - 6, 'h', `${fh(2 * G.flapHw.latch)} latches`, { size: 5.4 });
  s.text(px0 - 4, 276, 'SHELF OVER THE BED, FROM ABOVE  1:12', { size: 7.5, weight: 'bold' });
  s.para(px0 - 4, 272, s.wrap(`${P.lockType === 'twin' ? 'Twin-pin block (hardwood) in the divider\'s front notch. ' : P.lockType === 'pins' ? 'Safety-pin blocks (hardwood) near the front. ' : ''}Push latches drilled ${P.edgeSteel ? 'through the steel flat into the shelf edge' : P.upstand >= 25 ? 'into the lip' : 'into the shelf edge'}, gas stays on the side panels and the divider. Flap hinge plates go under the top at the same x as the cups.`, 140, 5.4), { size: 5.4, color: GREY });

  // 4. twin pin detail: section through one pin and a cut across both, at the pins
  if (P.lockType === 'twin' && G.twin) {
    const sd2 = 2, qx = 258, qy = 52, hs = P.twinSpacing / 2, tw = G.twin;
    const zTop = G.zBm1 + tw.block[2] + tw.bar[2] + tw.knob[1] + 14;
    const win = [G.yFb - 120, G.yF + 6, G.zF1 - 40, zTop];
    const keepL = (p) => ['B2', 'B4', 'D4', 'F1', 'F4', 'F2', 'F6', 'F7', 'LP', 'SF'].includes(p.mark);
    const vq = View(s, 'side', sd2, [qx, qy], [win[0], win[2]]);
    vq.parts(M.parts, { cut: hs + 0.5, window: win, filter: keepL });
    const a = vq.Puv([win[0], win[2]]), b = vq.Puv([win[1], win[3]]);
    s.rect(a[0], a[1], b[0] - a[0], b[1] - a[1], { lw: 0.2, dash: [2, 0.8, 0.4, 0.8] });
    const pinX = vq.P([0, G.pinY, 0])[0];
    vq.dimAt([0, G.pinY, G.zF1 - P.lockDepth], [0, G.pinY, G.zF1], pinX - 10, 'v', fh(P.lockDepth), { size: 5.4 });
    vq.dimAt([0, G.pinY, G.zF1], [0, G.pinY, G.zBm0], pinX - 10, 'v', fh(P.gapHolder), { size: 5.4, side: 'end' });
    vq.dimAt([0, G.pinY, G.zBm1], [0, G.yCt, G.zBm1], vq.P([0, 0, G.zBm1 + tw.block[2] + 10])[1], 'h', fh(G.yCt - G.pinY), { size: 5.4 });
    s.text(qx, b[1] + 8, 'TWIN PIN  1:2', { size: 7.5, weight: 'bold' });
    s.text(qx, b[1] + 4, `section through one pin; room on the right${G.steel ? `; steel flat ${fh(P.steelH)} x ${fh(P.steelT)} in the shelf edge (dark)` : ''}`, { size: 5.2, color: GREY });
    // cut across both pins, looking at the wall
    const fx = qx + (b[0] - a[0]) + 14;
    const winF = [-60, 60, win[2], win[3]];
    const vf = View(s, 'front', sd2, [fx + 60 / sd2, qy], [0, win[2]]);
    vf.parts(M.parts, { cut: G.pinY + 0.5, window: winF, filter: keepL });
    const fa = vf.Puv([winF[0], winF[2]]), fb = vf.Puv([winF[1], winF[3]]);
    s.rect(fa[0], fa[1], fb[0] - fa[0], fb[1] - fa[1], { lw: 0.2, dash: [2, 0.8, 0.4, 0.8] });
    vf.dimAt([-hs, 0, win[2] + 6], [hs, 0, win[2] + 6], vf.P([0, 0, win[2] + 6])[1], 'h', fh(2 * hs), { size: 5.4 });
    vf.dimAt([tw.block[0] / 2, 0, G.zBm1 + tw.block[2] + tw.bar[2]], [tw.block[0] / 2, 0, G.zBm1 + tw.block[2] + tw.bar[2] + tw.lift], vf.P([tw.block[0] / 2, 0, 0])[0] - 4, 'v', `lift ${fh(tw.lift)}`, { size: 5, color: ACC });
    s.text(fx, b[1] + 4, 'cut across both pins', { size: 5.2, color: GREY });
    s.para(qx, a[1] - 5, s.wrap(`Two 10 mm mild-steel pins, ${fh(2 * hs)} apart, nutted through a ${tw.bar.join(' x ')} bar, run in steel bushes through a ${tw.block.join(' x ')} hardwood block and the shelf, ${P.lockDepth} mm into the foot rail (drill it through, 12 mm, with a strike plate). The divider is notched ${tw.notchD} x ${tw.notchH} at its front foot. Lift ${fh(tw.lift)} through either flap before lowering the bed; a spring ball plunger holds it up.${P.lockTab ? ' The 2 mm tab on the bar comes out through the flap joint.' : ''}`, 150, 5), { size: 5, color: GREY });
  }
  if (P.lockType === 'bolts' && G.bolt) {
    const b = G.bolt, sc2 = 2, qx = 266, qy = 60, D = (X, y) => [-X, y, 0];
    const win = [G.xFi - 25, G.xT2 + 52, -(G.yF + 6), -(G.yRail - 6)];
    const vb = View(s, 'top', sc2, [qx, qy], [win[0], win[2]]);
    drawSection(s, vb, sectionAt(M.parts.filter(p => !p.leg && !p.mattress && p.name.indexOf('(L)') < 0), b.z), win);
    const a0 = vb.Puv([win[0], win[2]]), a1 = vb.Puv([win[1], win[3]]);
    s.rect(a0[0], a0[1], a1[0] - a0[0], a1[1] - a0[1], { lw: 0.2, dash: [2, 0.8, 0.4, 0.8] });
    // pulled back (dashed): rod, sleeve and knob moved out by the travel
    const tr = b.travel, rect = (x0, x1, d, o) => { const p0 = vb.P(D(x0, b.y + d / 2)), p1 = vb.P(D(x1, b.y - d / 2)); s.rect(Math.min(p0[0], p1[0]), Math.min(p0[1], p1[1]), Math.abs(p1[0] - p0[0]), Math.abs(p1[1] - p0[1]), Object.assign({ lw: 0.22, dash: [1, 0.6], color: ACC }, o || {})); };
    rect(b.tip + tr, b.knobX + tr, b.rod); rect(b.tip + tr, b.tip + tr + b.sleeve[1], b.sleeve[0]); rect(b.knobX + tr + 4, b.knobX + tr + b.knob[1] - 3, b.knob[0]);
    const yd = a0[1] - 4;
    for (const [x0, x1] of [[b.tip, G.xFo], [G.xFo, G.xB], [G.xB, G.xJ], [G.xJ, G.xT2], [G.xT2, G.xT2 + b.proud]]) vb.dimAt(D(x0, G.yF), D(x1, G.yF), yd, 'h', null, { size: 5.2 });
    vb.dimAt(D(b.tip, b.y), D(b.tip + tr, b.y), vb.P(D(0, b.y - 16))[1], 'h', f0(tr), { size: 5, color: ACC });
    vb.dimAt(D(G.xT2 + 40, b.y), D(G.xT2 + 40, b.z < G.zStep ? G.yCd : G.yCs), a1[0] + 4, 'v', null, { size: 5.2 });
    for (const [x, t] of [[G.xFo - 9, 'rail'], [(G.xFo + G.xB) / 2, 'gap'], [(G.xB + G.xJ) / 2, 'B1'], [(G.xJ + G.xT2) / 2, 'T2'], [G.xT2 + 10, 'knob']]) { const q = vb.P(D(x, G.yF)); s.text(q[0], yd - 5.5, t, { size: 4.8, ha: 'center', color: GREY }); }
    s.text(a0[0], a1[1] + 8, `SAFETY BOLT, PLAN AT ${f0(b.z)}  1:2`, { size: 7.5, weight: 'bold' });
    s.text(a0[0], a1[1] + 4, 'right-hand side, bed closed, bolt in; pulled back 25 dashed', { size: 5.2, color: GREY });
    s.para(a0[0], yd - 11, s.wrap(`Captive slide bolt from stock parts: ${b.rod} mm 316 rod ${f0(b.rodL)} long, a 14 x 2 brass sleeve ${b.sleeve[1]} long glued on the tip, a stainless knob on an M4 stud. Flanged bronze bush 10 x ${b.bush[0]} x ${b.bush[1]} in T2 (${b.holeT} hole); 16 x 0.5 brass liner through B1 and ${b.into} deep in the rail (${b.holeB} holes, the rail's ${b.rxDepth} deep). A 9 x 2.5 O-ring at the joint gives drag and stops the sleeve. In: knob on the flange, ${b.proud} proud. Pulled ${f0(tr)}: tip ${f0(b.inside)} inside B1. Rod goes in from the gap side, then the knob.`, 132, 5.2), { size: 5.2, color: GREY });
  }
  if (P.lockType === 'pins') {
    const sd2 = 2, qx = 262, qy = 52;
    const win = [G.yFb - 120, G.yF + 6, G.zF1 - 50, G.zBm1 + 75];
    const vq = View(s, 'side', sd2, [qx, qy], [win[0], win[2]]);
    vq.parts(M.parts, { cut: P.lockPinX + 0.5, window: win, filter: (p) => ['B2', 'B5', 'D4', 'F1', 'F4', 'F2', 'F5', 'F6', 'F7', 'LP', 'B4'].includes(p.mark) && (!p.hw || p.name.indexOf('(L)') >= 0) });
    const a = vq.Puv([win[0], win[2]]), b = vq.Puv([win[1], win[3]]);
    s.rect(a[0], a[1], b[0] - a[0], b[1] - a[1], { lw: 0.2, dash: [2, 0.8, 0.4, 0.8] });
    const pinX = vq.P([0, G.pinY, 0])[0];
    vq.dimAt([0, G.pinY, G.zF1 - P.lockDepth], [0, G.pinY, G.zF1], pinX + 12, 'v', fh(P.lockDepth), { size: 5.4 });
    vq.dimAt([0, G.pinY, G.zF1], [0, G.pinY, G.zBm0], pinX + 12, 'v', fh(P.gapHolder), { size: 5.4, side: 'end' });
    vq.dimAt([0, G.pinY, G.zBm1], [0, G.yCt, G.zBm1], vq.P([0, 0, G.zBm1 + 60])[1], 'h', fh(G.yCt - G.pinY), { size: 5.4 });
    s.text(qx, b[1] + 8, 'SAFETY PIN  1:2', { size: 7.5, weight: 'bold' });
    s.para(qx, b[1] + 4, s.wrap(`10 mm pin through a bush in the shelf and a hardwood block, ${P.lockDepth} mm into a steel bush in the foot rail. Lift both pins (behind the flaps) before lowering the bed.`, 130, 5.2), { size: 5.2, color: GREY });
  }
  s.finish();
}

/* ------------------------------------------------------------------ clearances
   The model's clearance schedule, and three plan sections through the gap beside the bed at the kit's hardware,
   drawn as true sections of the parts (the side on your right, bed closed). */
function sectionAt(parts, z, filter) { // convex solids cut by the plane at height z, in top-view (u, v) = (-x, -y)
  const out = [];
  for (const p of parts) {
    if (filter && !filter(p)) continue;
    for (const sol of (p.draw || p.solids)) {
      const pts = [];
      for (const loop of sol.loops) {
        const pl = C.loopPolyline(loop, 16), a = pl.map(q => C.to3(sol, q, 0)), b = pl.map(q => C.to3(sol, q, sol.len));
        const cut = (A, B) => { const d1 = A[2] - z, d2 = B[2] - z; if (d1 === 0) pts.push(A); if (d1 * d2 < 0) { const t = d1 / (d1 - d2); pts.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t]); } };
        for (let i = 0; i < pl.length; i++) { const j = (i + 1) % pl.length; cut(a[i], a[j]); cut(b[i], b[j]); cut(a[i], b[i]); }
      }
      if (pts.length >= 3) { const h = hull(pts.map(q => [-q[0], -q[1]])); if (h.length >= 3) out.push({ p, poly: h }); }
    }
  }
  return out;
}
function drawSection(s, v, items, win) { // true sections from sectionAt: plywood first, hardware on top
  items.sort((a, b) => (a.p.hw && !a.p.mattress ? 1 : 0) - (b.p.hw && !b.p.mattress ? 1 : 0));
  for (const it of items) {
    const poly = clipPoly(it.poly, win); if (poly.length < 3) continue;
    const pts = poly.map(v.Puv), hw = it.p.hw && !it.p.mattress;
    const fill = it.p.mark === 'GS' ? [120, 126, 134] : hw ? (FILL[it.p.kind] || FILL.metal) : it.p.kind === 'front' ? CUT_FRONT : it.p.mattress ? FILL.mattress : CUT;
    s.polyFill(pts.concat([pts[0]]), { fill, lw: hw ? 0.12 : LW_CUT, color: hw ? [30, 32, 36] : INK });
  }
}
// the path the lower ball stud's nut sweeps on the bed-cabinet side, about the pivot, at radius springArm + off
function nutPath(G, v, off) {
  const t0 = Math.min(0, G.closedTh, G.fitTh) - 5 * Math.PI / 180, t1 = 95 * Math.PI / 180, pts = [];
  const k = (G.springArm + (off || 0)) / G.springArm;
  for (let i = 0; i <= 40; i++) { const q = C.rot2(G.springBed, G.pivot, t0 + (t1 - t0) * i / 40); pts.push(v.Puv([G.pivot[0] + (q[0] - G.pivot[0]) * k, G.pivot[1] + (q[1] - G.pivot[1]) * k])); }
  return pts;
}
function pageClearances(doc, M, M45, M90, S, info) {
  const { P, G } = M, K = C.KIT_HW;
  const s = Sheet(doc, 6, info.total, 'CLEARANCES', '1:1, 1:7.5', info);
  const SCH = C.clearanceSchedule(M);
  const ST = { ok: [92, 150, 104], tight: ACC, clash: BAD, info: null };
  const f1 = (v) => { const r = Math.round(v * 10) / 10; return Number.isInteger(r) ? String(r) : r.toFixed(1); };
  // 1. plan sections through the gap at 1:1, left (the side on your right: |x| grows to the right, room at the bottom)
  const X = (v) => -v;
  const section = (ox, oy, z, xr, yr, title, sub) => {
    const win = [xr[0], xr[1], -yr[1], -yr[0]];
    const v = View(s, 'top', 1, [ox, oy], [win[0], win[2]]);
    drawSection(s, v, sectionAt(M.parts.filter(p => !p.leg && p.name.indexOf('(L)') < 0), z), win);
    const a0 = v.Puv([win[0], win[2]]), a1 = v.Puv([win[1], win[3]]);
    s.rect(a0[0], a0[1], a1[0] - a0[0], a1[1] - a0[1], { lw: 0.2, dash: [2, 0.8, 0.4, 0.8] });
    s.text(a0[0], a1[1] + 15.5, title, { size: 7.2, weight: 'bold' });
    s.text(a0[0], a1[1] + 12, sub, { size: 5.4, color: GREY });
    const chain = (xs, y, lvl, o) => { for (let i = 0; i < xs.length - 1; i++) v.dimAt([X(xs[i]), y, z], [X(xs[i + 1]), y, z], a1[1] + 2.5 + lvl * 5, 'h', f1(xs[i + 1] - xs[i]), Object.assign({ size: 5 }, (o && o[i]) || {})); };
    return { v, a0, a1, chain, p: (x, y) => v.P([X(x), y, z]) };
  };
  const xr = [G.xFi - 26, G.xJ + 6];
  // (a) at the lower ball stud
  const yb = G.springBed[0];
  const A = section(22, 196, G.springBed[1], xr, [G.yRail - 42, G.yRail + 26], 'AT THE LOWER BALL STUD  1:1', `bed closed, ${f0(G.springBed[1])} above the floor; the nut sweeps the side on a ${f0(G.springArm)} radius as the bed turns`);
  A.chain([G.xFo, G.xFo + P.plateT, G.nutX, G.xB], yb, 0, [{ side: 'start' }, { side: 'over' }, { side: 'end', color: ACC }]);
  A.chain([G.springBedX, G.xFo, G.xB], yb, 1, [{}, { side: 'end' }]);
  A.v.dimAt([X(G.xFi - 20), G.yRail, 0], [X(G.xFi - 20), yb, 0], A.a0[0] - 4, 'v', f1(G.yRail - yb), { size: 5 });
  s.text(A.a0[0] - 6.5, (A.a0[1] + A.a1[1]) / 2 + 22, "ball above the rail's top edge", { size: 4.6, color: GREY, angle: 90 });
  for (const [lbl, yy, dir] of [['WALL', A.a1[1] - 3, 1], ['ROOM', A.a0[1] + 3, -1]]) { const xa = A.a0[0] + 3; s.arrow([xa, yy + dir * 3], [0, dir], { L: 1.6, W: 0.5, color: GREY }); s.line([xa, xa], [yy, yy + dir * 2], { lw: 0.15, color: GREY }); s.text(xa + 1.6, yy + dir * 1.2, lbl, { size: 4.6, color: GREY, va: 'middle' }); }
  s.leader(A.p(G.springBedX - 4, yb + 4), [A.a0[0] + 6, A.a0[1] - 6], 'ball, in the spring\'s socket, 5/16 in over the rail', { size: 5, ha: 'left' });
  s.leader(A.p((G.xFo + P.plateT + G.nutX) / 2, yb + 3), [A.a1[0] + 5, A.a1[1] - 14], 'nut and stud end', { size: 5, ha: 'left' });
  s.leader(A.p(G.xFo + P.plateT / 2, G.yRail - 20), [A.a1[0] + 5, A.a1[1] - 22], 'lower ball-stud plate, its tab past the rail', { size: 5, ha: 'left' });
  s.leader(A.p((G.xFi + G.xFo) / 2, G.yRail + 14), [A.a1[0] + 5, A.a0[1] + 8], 'side rail', { size: 5, ha: 'left' });
  s.leader(A.p((G.xB + G.xJ) / 2, G.yRail + 14), [A.a1[0] + 5, A.a0[1] + 3], 'bed-cabinet side', { size: 5, ha: 'left' });
  // (b) at the pivot
  const yp = G.pivot[0];
  const B = section(22, 108, G.pivot[1], xr, [yp - 26, yp + 26], 'AT THE PIVOT  1:1', `${f0(G.pivot[1])} above the floor`);
  B.chain([G.xFi - P.plateT, G.xFi, G.xFo, G.xMount - P.plateT, G.xMount, G.xMount + K.barIn], yp, 0, [{ side: 'start' }, {}, { side: 'over' }, { side: 'over2' }, { side: 'end' }]);
  B.chain([G.xFo, G.xMount], yp, 1, [{ color: ACC }]);
  s.leader(B.p(G.xFo + 3, yp + 13), [B.a1[0] + 5, B.a0[1] + 12], 'plastic spacer on the bar', { size: 5, ha: 'left' });
  s.leader(B.p(G.xMount - P.plateT / 2, yp + 20), [B.a1[0] + 5, B.a0[1] + 6], `male plate${P.packer ? ' on its pad' : ''}; bar 1/2 in into the side`, { size: 5, ha: 'left' });
  s.leader(B.p(G.xFi - P.plateT / 2, yp - 20), [B.a1[0] + 5, B.a1[1] - 6], 'female plate, bush through the rail', { size: 5, ha: 'left' });
  // (c) through the top of the gas spring
  const zC = G.springCab[1] - 32;
  const [ea, eb] = C.springEnds(G, { xCab: G.springCabX, xBed: G.springBedX, cab: G.springCab, bed: G.springBed }, 0);
  const t = (ea[2] - zC) / (ea[2] - eb[2]), xc = ea[0] + (eb[0] - ea[0]) * t, yc = ea[1] + (eb[1] - ea[1]) * t, edge = xc + P.springD / 2;
  const Cc = section(22, 30, zC, xr, [yc - 24, yc + 24], 'AT THE TOP OF THE GAS SPRING  1:1', `bed closed, ${f0(zC)} above the floor, just under the upper ball stud`);
  Cc.chain([edge, G.xMount - P.plateT, G.xMount], yc, 0, [{ side: 'start', color: ACC }, { side: 'end' }]);
  Cc.chain([xc, edge, G.xB], yc, 1, [{}, { side: 'end' }]);
  for (const xx of [G.xFi, G.xFo]) { const q0 = Cc.p(xx, yc + 24), q1 = Cc.p(xx, yc - 24); s.line([q0[0], q1[0]], [q0[1], q1[1]], { lw: 0.15, dash: [1.2, 0.8], color: GREY }); }
  s.text(Cc.p((G.xFi + G.xFo) / 2, yc + 24)[0], Cc.a0[1] - 4, `side rail's line; the rail is ${f0(G.yRail - yc)} nearer the room here`, { size: 5, color: GREY, ha: 'center' });
  s.leader(Cc.p(xc - 6, yc + 6), [Cc.a1[0] + 5, Cc.a0[1] + 10], `gas spring body, ${f0(P.springD)}`, { size: 5, ha: 'left' });
  s.leader(Cc.p(G.xMount - P.plateT / 2, yc - 15), [Cc.a1[0] + 5, Cc.a1[1] - 8], `upper ball-stud plate${P.packer ? ' on its pad' : ''}`, { size: 5, ha: 'left' });

  // what is in the gap, and what to measure
  const nx = 152, ny = 268;
  s.heading(nx, ny, 'WHERE THE GAS SPRINGS RUN');
  let yy = s.para(nx, ny - 6, s.wrap(`Not in the ${f1(P.gapHydr)} mm gap. Both ball studs point in: the lower one through a tab on its plate that reaches past the rail's top edge, the upper one off the bed-cabinet side${P.packer ? ' (on its pad)' : ''}. So each spring runs along the top edge of its rail, behind it with the bed closed, ${f1(SCH.groups[0].rows[2].here)} from the side. The gap holds the pivot spacer and plates, the bed stops and the lower stud's nut.`, 96, 5.6), { size: 5.6 });
  const nutRow = SCH.groups[0].rows[1];
  yy = s.para(nx, yy - 2, s.wrap(nutRow.st === 'ok' ? `The lower stud's nut clears the side by ${f1(nutRow.here)} (A2).` : `The lower stud's nut passes the side ${f1(nutRow.here)} away (A2). Measure yours from the plate's face against the rail to the end of the stud: up to ${f1(G.nutX - G.xFo + nutRow.here - 1)} passes with 1 to spare. More needs a relief routed ${f0(Math.max(1, Math.ceil(2 - nutRow.here)))} deep and 20 wide in each bed-cabinet side, on a ${f0(G.springArm)} radius about the pivot hole (drawn on sheet 5), before the sides go in; or a wider gap with pads under the plates.`, 96, 5.6), { size: 5.6, color: nutRow.st === 'ok' ? INK : BAD });
  s.heading(nx, yy - 6, 'KIT SIZES USED: MEASURE YOURS', 'the booklet gives positions, not sizes; enter yours under Create-A-Bed hardware');
  s.table(nx, yy - 13, [['', 66, 'left'], ['USED', 18, 'right'], ['ROWS', 14, 'left']], SCH.measure.map(([, what, used, rows]) => [what, used, rows]), { rowH: 4.2, size: 5.2, hsize: 5 });

  // the springs through the swing, side view from inside the bay, cut just short of the bed-cabinet side
  {
    const se = 7.5, ex = 158, ez = 22;
    const ve = View(s, 'side', se, [ex, ez], [G.yB1 - 6, 0]);
    const cutX = G.xB - 0.5, band = (p) => p.name.indexOf('(R)') < 0;
    const fixedK = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'K1'];
    ve.parts(M.parts, { cut: cutX, filter: (p) => band(p) && ((!p.bed && (fixedK.includes(p.mark) || ['PV', 'BS', 'ST', 'B8', 'B9'].includes(p.mark))) || (p.bed && ['F2', 'F3', 'BS', 'PV'].includes(p.mark)) || p.mark === 'GS'), window: [G.yB1 - 6, G.yFb + 10, 0, G.springCab[1] + 70] });
    for (const [Mx, st] of [[M45, { color: GREY, dash: [0.6, 0.6], lw: 0.12 }], [M90, { color: ACC, lw: 0.18 }]]) {
      ve.outline(Mx.parts, { filter: (p) => band(p) && ((p.bed && ['F2', 'F3', 'BS'].includes(p.mark)) || p.mark === 'GS'), st, window: [G.yB1 - 6, G.yFb + 10, 0, G.springCab[1] + 70] });
    }
    const w0 = ve.Puv([G.yB1 - 6, 0]), w1 = ve.Puv([G.yFb + 10, G.springCab[1] + 70]);
    s.line([w0[0], w1[0]], [w0[1], w0[1]], { lw: 0.35 });
    const lo = (Mx, th) => ve.Puv(C.rot2(G.springBed, G.pivot, th));
    s.leader(lo(M, 0), [w1[0] + 2, lo(M, 0)[1] + 6], 'closed', { size: 5, ha: 'left' });
    s.leader(lo(M45, Math.PI / 4), [w1[0] + 2, lo(M45, Math.PI / 4)[1] + 14], '45 deg', { size: 5, ha: 'left', color: GREY });
    s.leader(lo(M90, Math.PI / 2), [w1[0] + 2, lo(M90, Math.PI / 2)[1] + 22], 'down', { size: 5, ha: 'left', color: ACC });
    s.poly(nutPath(G, ve, 0), { lw: 0.15, color: BAD, dash: [1, 0.7] });
    const nm = nutPath(G, ve, 0)[30];
    s.leader(nm, [w0[0] + 2, w0[1] - 5], `path of the lower stud's nut, R${f0(G.springArm)} about the pivot`, { size: 4.8, ha: 'left', color: BAD });
    s.text(ex, w1[1] + 9.5, 'THE GAS SPRINGS THROUGH THE SWING  1:7.5', { size: 7.2, weight: 'bold' });
    s.text(ex, w1[1] + 6, `from inside the bay, cut at the bed-cabinet side; closed, 45 deg (grey), down (amber)`, { size: 5.2, color: GREY });
  }

  // 2. the schedule, right
  const x0 = 258;
  s.heading(x0, 280, 'CLEARANCE SCHEDULE', 'every clearance the build depends on, from this design; mm');
  const cols = [['', 4.5, 'center'], ['', 8, 'left'], ['CLEARANCE', 87, 'left'], ['NEEDS', 25, 'right'], ['HERE', 29.5, 'right']];
  const tw = cols.reduce((a, c) => a + c[1], 0);
  let y = s.table(x0, 273, cols, [], { rowH: 4.2, size: 5.4, hsize: 5 });
  const n = SCH.groups.reduce((a, g) => a + g.rows.length, 0), rh = Math.min(4.2, (y - 47 - SCH.groups.length * 5.6) / n);
  for (const g of SCH.groups) {
    s.text(x0 + 1.4, y - 3.9, g.title, { size: 5.8, weight: 'bold' });
    y = s.table(x0, y - 5.6, cols, g.rows.map(r => [ST[r.st], r.id, r.what, r.need, typeof r.here === 'number' && /^at \d/.test(r.note) ? `${f1(r.here)}, ${r.note.slice(3)} deg`.replace(' deg deg', ' deg') : typeof r.here === 'number' ? f1(r.here) : r.here]), { header: false, rowH: rh, size: 5.2, chipCol: 0, boldCol: 1 });
  }
  let lx = x0 + 1;
  for (const [tt, c] of [['OK', ST.ok], ['LESS THAN IT NEEDS', ST.tight], ['PARTS MEET', ST.clash]]) { s.rect(lx, y - 5, 3, 2.2, { fill: c, lw: 0 }); s.text(lx + 4.2, y - 3.9, tt, { size: 5, va: 'middle' }); lx += 6.5 + s.tw(tt, 5); }
  s.text(x0, y - 8.6, 'Swing rows: the closest approach while the bed turns, and the angle; parts only count when they share a band across the bed.', { size: 4.8, color: GREY });
  void tw;
  s.finish();
}

// the 20 mm cable holes, one row per hole (the left-hand side mirrors the right), positions per part as drilled
function cableTable(s, M, x0, y0) {
  const { P, G } = M, W = 104;
  const byName = new Map(M.parts.map(p => [p.name, p]));
  const rows = G.cables.filter(q => q.S === 'R').map(q => {
    const pos = q.parts.map(n => {
      const p = byName.get(n), b = C.prismBox(p.solids[0]), mk = p.mark;
      if (q.axis === 'x') return `${mk} ${fh(q.c[1] - b[2])} up`;
      return `${mk} ${fh(Math.min(q.c[0] - b[0], b[3] - q.c[0]))} from the ${mk === 'H6' ? 'end' : 'bed side'}`;
    });
    const back = q.axis === 'x' ? q.c[0] - G.yB1 : q.c[1] - G.yB1;
    return [q.id, q.what, `${pos.join(', ')}; ${fh(back)} from the back edge`];
  });
  s.heading(x0, y0, 'CABLE HOLES, 20 mm', 'right-hand side; the left is its mirror image');
  let y = s.table(x0, y0 - 6, [['', 6, 'center'], ['FOR', 34, 'left'], ['WHERE, FROM EACH PART\'S EDGES', 64, 'left']], rows, { rowH: 6.2, size: 5.2, hsize: 5, boldCol: 0 });
  const h = G.head && !G.head.skipped;
  const notes = [
    `Heights from the part's bottom edge as it stands; ${fh(G.cables[0].c[0] - G.yB1)} from the back clears the screw rows 35 in from the edges.`,
    h ? 'Power: a wall outlet in the space behind the backrest (an electrician\'s job), ' + (G.head.gpos && G.head.gpos.length ? `${G.head.gpos.length === 2 ? 'a double power point each side' : 'a double power point'} flush in the bedside shelf (104 x 54 cut-out, ${Math.abs(G.head.gpos[0].x)} from centre, ${G.head.gpos[0].y} from the wall), wired from it.` : 'no power points at the bed.') + (G.head.doors ? ' Open the headboard doors to reach the wiring.' : '') : 'Power: an outlet near the bed bay, by an electrician.',
    `Light: one 24 V supply in that space; strips under the shelf over the hanging space and under the tower tops at the front, under the wall rail below the shelf over the bed (wall wash), and under the top of the box over the bed at least 80 back from the front.`,
    `Keep everything behind the closed mattress: no more than ${f0(G.yM0 - 30)} from the wall above about ${f0(G.pivot[1] + 300)}.`,
  ];
  y = s.numbered(x0, y - 5, notes, W, { size: 5.2 });
  return y;
}

// the mattress support pieces from behind, at 1:30: their cut, the seam and the vent holes (length across the page)
function supportPlan(s, M, x0, y0) {
  const { P, G } = M, sc = 30, F7 = M.parts.filter(p => p.mark === 'F7');
  if (!F7.length) return;
  const z0 = Math.min(...F7.map(p => C.prismBox(p.solids[0])[2])), xm = Math.max(...F7.map(p => C.prismBox(p.solids[0])[3]));
  const X = (z) => x0 + (z - z0) / sc, Y = (x) => y0 + (xm - x) / sc;
  for (const p of F7) {
    const pr = p.solids[0], pts = C.loopPolyline(pr.loops[0], 4);
    const zs = pts.map(q => q[0]), xs = pts.map(q => q[1]), za = Math.min(...zs), zb = Math.max(...zs), xa = Math.min(...xs), xb = Math.max(...xs);
    s.rect(X(za), Y(xb), (zb - za) / sc, (xb - xa) / sc, { fill: FILL.deck || FAINT, lw: 0.25 });
    for (const lp of pr.loops.slice(1)) { const c = lp[0].c; if (c) s.circle(X(c[0]), Y(c[1]), lp[0].r / sc, { lw: 0.1, fill: WHITE }); }
    s.text(X(zb) + 2, Y((xa + xb) / 2), `${p.name.replace('Mattress support', '').replace(/^[ ,]+/, '') || 'F7'}, ${Math.round(xb - xa)} x ${Math.round(zb - za)}`, { size: 5, va: 'middle', color: GREY });
  }
  const top = Y(-xm) + 4;
  s.text(x0, top + 4, 'MATTRESS SUPPORT F7  1:30', { size: 7, weight: 'bold' });
  s.text(x0, top, `from behind, head end on the left; ${G.vents ? G.vents.n + ' vent holes of ' + G.vents.d + ' mm, ' : ''}between the struts`, { size: 5, color: GREY });
}

function pageCutList(doc, M, S, info) {
  const { P } = M;
  const s = Sheet(doc, 7, info.total, 'CUT LIST', '-', info);
  s.heading(14, 280, 'CUT LIST', `lengths along the grain where it matters; kerf ${P.kerf}, ${P.trim} trimmed off each sheet edge`);
  const rows = S.cut.map(r => [T_RGB[r.T] || GREY, r.mark, r.name, r.qty, r.T, f0(r.L), f0(r.W), r.grain ? 'yes' : '', r.band ? (r.band / 1000).toFixed(1) : '']);
  const cols = [['', 6, 'center'], ['MARK', 13, 'left'], ['PART', 70, 'left'], ['QTY', 10, 'right'], ['T', 9, 'right'], ['LENGTH', 16, 'right'], ['WIDTH', 16, 'right'], ['GRAIN', 12, 'center'], ['BAND m', 14, 'right']];
  const half = Math.ceil(rows.length / 2);
  const rh = Math.min(4.6, 230 / half);
  s.table(14, 270, cols, rows.slice(0, half), { rowH: rh, size: 5.8, hsize: 5.4, chipCol: 0, boldCol: 1 });
  s.table(14 + 172, 270, cols, rows.slice(half), { rowH: rh, size: 5.8, hsize: 5.4, chipCol: 0, boldCol: 1 });
  // sheets and hardware
  const x2 = 14;
  let y = 270 - (half + 1) * rh - 10;
  s.heading(x2, y, 'SHEETS', 'parts nested by thickness onto the sheets you have');
  y = s.table(x2, y - 6, [['THICK', 14, 'right'], ['ON HAND', 18, 'right'], ['NEEDED', 16, 'right'], ['PARTS m²', 18, 'right'], ['USE', 14, 'right']],
    S.sheets.map(q => [q.T, q.have, isFinite(q.need) ? q.need : 'too big', (q.area / 1e6).toFixed(2), q.sheetArea ? Math.round(q.area / q.sheetArea * 100) + '%' : '-']), { rowH: 4.4, size: 5.8 });
  s.text(x2, y - 5, `Edge banding about ${S.bandM.toFixed(0)} m. Plywood about ${S.massPly.toFixed(0)} kg.`, { size: 6 });
  const hx = 120;
  let hy = 270 - (half + 1) * rh - 10;
  s.heading(hx, hy, 'HARDWARE');
  s.table(hx, hy - 6, [['ITEM', 70, 'left'], ['QTY', 14, 'right'], ['NOTE', 90, 'left']], S.hardware, { rowH: 4.4, size: 5.6 });
  if (M.G.cables && M.G.cables.length) cableTable(s, M, 302, hy);
  supportPlan(s, M, 14, 14);
  s.finish();
}

function pagesPlans(doc, M, S, info, startNum) {
  const per = 8, sc = 20;
  const all = [];
  for (const q of S.sheets) q.bins.forEach((b, i) => all.push({ T: q.T, i, b, n: q.bins.length }));
  let num = startNum;
  for (let k = 0; k < all.length; k += per) {
    const s = Sheet(doc, num, info.total, `CUTTING PLANS ${Math.floor(k / per) + 1}`, '1:20', info);
    all.slice(k, k + per).forEach((it, j) => {
      const col = j % 3, row = Math.floor(j / 3);
      const W = it.b.L / sc, H = it.b.W / sc;
      const x0 = 16 + col * 132, y0 = 270 - row * 82 - H;
      s.text(x0, y0 + H + 3, `${it.T} mm   sheet ${it.i + 1} of ${it.n}`, { size: 7, weight: 'bold' });
      s.text(x0 + W, y0 + H + 3, `${it.b.L} x ${it.b.W}`, { size: 6, ha: 'right', color: GREY });
      s.rect(x0, y0, W, H, { fill: FAINT, lw: 0.3 });
      const colr = mix(T_RGB[it.T] || GREY, 0.22);
      for (const p of it.b.items) {
        const x = x0 + p.x / sc, y = y0 + (it.b.W - p.y - p.h) / sc, w = p.w / sc, h = p.h / sc;
        s.rect(x, y, w, h, { fill: colr, lw: 0.2 });
        const lab = p.mark, dimt = `${f0(p.L)} x ${f0(p.W)}`;
        let sz = 6;
        while (sz > 3.4 && (s.tw(lab, sz, 'bold') > w - 0.8 || sz * 0.36 > h - 0.4)) sz -= 0.4;
        if (sz > 3.4) {
          const two = h > sz * 0.8 && s.tw(dimt, sz * 0.8) < w - 1;
          s.text(x + w / 2, y + h / 2 + (two ? sz * 0.18 : 0), lab, { size: sz, ha: 'center', va: 'middle', weight: 'bold' });
          if (two) s.text(x + w / 2, y + h / 2 - sz * 0.26, dimt, { size: sz * 0.78, ha: 'center', va: 'middle', color: [60, 60, 60] });
        }
      }
      const used = it.b.items.reduce((a, p) => a + p.w * p.h, 0) / (it.b.L * it.b.W);
      s.text(x0, y0 - 3, `${it.b.items.length} pieces, ${Math.round(used * 100)}% used${it.b.items.some(p => p.rot) ? '; some turned (no grain rule)' : ''}`, { size: 5.4, color: GREY });
    });
    s.text(16, 12, 'Cut the long through-cuts first: every layout here can be cut with straight saw passes edge to edge.', { size: 6, color: GREY });
    s.finish();
    num += 1;
  }
  return num;
}

function pageReview(doc, M, S, info) {
  const s = Sheet(doc, info.total, info.total, 'DESIGN REVIEW', '-', info);
  const R = C.reviewNotes(M, S);
  s.text(14, 276, 'Design review', { size: 16, weight: 'bold' });
  s.text(14, 269, 'What changed from murphy_bed.tikz, and what still needs checking. The page re-runs these checks whenever a size changes.', { size: 7.5, color: GREY });
  s.heading(14, 258, 'EDITS MADE TO THE TIKZ DESIGN');
  s.numbered(14, 251, R.edits, 190, { size: 7.4 });
  s.heading(214, 258, 'STILL TO CHECK');
  let y = s.numbered(214, 251, R.open, 190, { size: 7.4 });
  const live = M.checks.filter(c => c.level !== 'info' && !['hardware', 'fronts'].includes(c.tag));
  if (live.length) {
    y -= 4;
    s.heading(214, y, 'FLAGGED BY THE CHECKS NOW');
    y = s.numbered(214, y - 6, live.map(c => [c.title, c.text]), 190, { size: 7.4, numColor: BAD });
  }
  // sources under the right-hand column, in one or two columns, clear of the title block (top at 40)
  const n = C.SOURCES.length, room = y - 4 - 6 - 40, cols = n * 7.2 <= room ? 1 : 2, rows = Math.ceil(n / cols), cw = 190 / cols - 4;
  const pitch = Math.min(7.2, Math.max(5.6, room / rows));
  let yy = y - 4;
  s.heading(214, yy, 'SOURCES');
  yy -= 6;
  C.SOURCES.forEach(([t, u], k) => {
    const x = 214 + Math.floor(k / rows) * (cw + 4), yk = yy - (k % rows) * pitch;
    let su = 5.6; while (su > 4 && s.tw(u, su) > cw) su -= 0.2;
    let uu = u; if (s.tw(uu, su) > cw) { while (uu.length > 20 && s.tw(uu + '...', su) > cw) uu = uu.slice(0, -1); uu += '...'; }
    let st = 6.4; while (st > 5 && s.tw(t, st) > cw) st -= 0.2;
    s.text(x, yk, t, { size: st }); s.text(x, yk - 2.8, uu, { size: su, color: GREY });
  });
  s.finish();
}

/* ------------------------------------------------------------------ build sequence: timeline and step cards */
const FIX_SHORT = {
  s50: '8g x 50 screws', s30: '8g x 30 screws', s25: '8g x 25 pan heads', s20: '8g x 20 pan heads', b25: '6g x 25 screws', r10: '3.5 x 10 pan heads',
  h15: '3.5 x 15 hardware screws', d8: '8 x 30 dowels', w75: '14g x 75 into studs', kit: 'kit machine screws', m4: 'M4 x 25 handle bolts', m4s: 'M4 x 20 handle bolts',
  pin: '5 mm shelf pins',
};
const PREP = [215, 210, 202];
function seqCard(s, B, I, i, x, yTop, cw, ch, tw) {
  const st = B.steps[i];
  s.rect(x, yTop - ch, cw, ch, { lw: 0.2, color: LIGHT });
  s.text(x + 2.4, yTop - 6.2, String(i + 1), { size: 12, weight: 'bold', color: ACC });
  s.text(x + 10.5, yTop - 4.9, st.title.toUpperCase(), { size: 6.8, weight: 'bold' });
  const when = st.day0 === st.day1 ? `day ${st.day0}` : `days ${st.day0}-${st.day1}`;
  s.text(x + 10.5, yTop - 8.4, `${when}, ${st.h} h${st.people === 2 ? ', two people' : ''}${st.overnight ? ', then overnight' : ''}`, { size: 5.3, color: GREY });
  if (st.joinery && B.detSheet && B.detSheet[st.joinery]) s.text(x + cw - 2.4, yTop - 4.9, `DETAILS: SHEET ${B.detSheet[st.joinery]}`, { size: 5.2, weight: 'bold', color: ACC, ha: 'right' });
  const img = I.steps && I.steps[i];
  tw = tw || 43;
  const tTop = yTop - 11;
  // fixings, from the bottom up
  const fx = st.fix.map(([k, n]) => `${n} x ${FIX_SHORT[k] || k}`);
  const rows = Math.ceil(fx.length / 2), fy0 = yTop - ch + 2.2, fTop = fy0 + rows * 2.7 + 3.2;
  let th = img ? tw * img.px[1] / img.px[0] : 0;
  if (img && th > tTop - fTop - 1.5) { th = tTop - fTop - 1.5; tw = th * img.px[0] / img.px[1]; }
  if (img) { s.rect(x + 1.6, tTop - th, tw, th, { fill: WHITE, lw: 0 }); s.vimage(img, x + 1.6, tTop - th, tw, th); s.rect(x + 1.6, tTop - th, tw, th, { lw: 0.1, color: LIGHT }); }
  if (fx.length) {
    s.text(x + 2.4, fTop - 1.6, 'FIXINGS', { size: 4.9, weight: 'bold', color: GREY });
    fx.forEach((t, k) => s.text(x + 2.4 + (k % 2) * (cw / 2 - 1), fy0 + (rows - 1 - Math.floor(k / 2)) * 2.7 + 0.6, t, { size: 5.2 }));
  }
  // text beside the picture, then full width under it
  const size = 5.5, lead = 1.42 * size / 2.835, xN = img ? x + tw + 3.6 : x + 2.4, wN = img ? cw - tw - 5.4 : cw - 4.8;
  let y = tTop - 1.6;
  let lines = s.wrap(st.text, wN, size), k = 0;
  const yPic = tTop - th - 1;
  while (k < lines.length && (!img || y > yPic)) { s.text(xN, y, lines[k], { size }); y -= lead; k++; }
  if (k < lines.length) {
    y = Math.min(y, yPic - 1.4);
    for (const ln of s.wrap(lines.slice(k).join(' '), cw - 4.8, size)) { s.text(x + 2.4, y, ln, { size }); y -= lead; }
  }
  if (fx.length && y < fTop + 1) console.warn('card text overlaps the fixings', i + 1);
}
function pageSequence(doc, M, S, I, info, part) {
  const { P, G } = M, B = S.build, s = Sheet(doc, info.seqFrom + part, info.total, part ? 'BUILD SEQUENCE, CONTINUED' : 'BUILD SEQUENCE', part ? '1:1, 1:5' : 'NTS', info);
  B.detSheet = info.detSheet;
  const cw = 96.6, gx = 2.7, X = (k) => 14 + (k % 4) * (cw + gx);
  if (!part) {
    s.text(14, 276, 'Build sequence', { size: 16, weight: 'bold' });
    s.text(14, 269.5, `About ${Math.round(B.hours)} hours over ${B.days} working days of six hours, for one person with a second pair of hands where marked. Each step lists its fixings; the steps that join plywood are drawn joint by joint on sheets ${info.detFrom}-${info.detFrom + info.nDet - 1}, and totals, drill sizes and glue are on sheet ${info.fixAt}.`, { size: 7.4, color: GREY });
    // timeline
    const x0 = 14, lw = 56, w = 392, rh = 2.75, gTop = 262, dw = (w - lw) / B.days, n = B.steps.length;
    for (let d = 0; d < B.days; d++) {
      const xd = x0 + lw + d * dw;
      if (d % 2 === 0) s.rect(xd, gTop - n * rh, dw, n * rh, { fill: FAINT, lw: 0 });
      s.text(xd + dw / 2, gTop + 1.6, `DAY ${d + 1}`, { size: 5.2, ha: 'center', weight: 'bold', color: GREY });
    }
    B.steps.forEach((st, i) => {
      const y = gTop - (i + 1) * rh, ym = y + rh / 2;
      s.text(x0, ym, String(i + 1), { size: 5.3, va: 'middle', weight: 'bold', color: ACC });
      s.text(x0 + 5, ym, st.title, { size: 5.3, va: 'middle' });
      const xa = x0 + lw + ((st.day0 - 1) + st.t0 / 6) * dw, xb = x0 + lw + ((st.day1 - 1) + st.t1 / 6) * dw;
      s.rect(xa, y + 0.45, Math.max(0.8, xb - xa), rh - 0.9, { fill: i < 4 ? PREP : ACC, lw: 0 });
      const tags = [st.people === 2 ? 'two people' : '', st.overnight ? 'dry overnight' : ''].filter(Boolean).join(', ');
      if (tags) s.text(xb + 1.2, ym, tags, { size: 4.7, va: 'middle', color: GREY });
    });
    s.line([x0, x0 + w], [gTop - n * rh, gTop - n * rh], { lw: 0.1, color: LIGHT });
    // the four preparation steps (no picture), then two rows of assembly steps
    let top = gTop - n * rh - 6;
    const chP = 30;
    [0, 1, 2, 3].forEach(k => seqCard(s, B, I, k, X(k), top, cw, chP));
    top -= chP + 3;
    const ch = (top - 41 - 3) / 2;
    [4, 5, 6, 7, 8, 9, 10, 11].forEach((i, k) => seqCard(s, B, I, i, X(k), top - Math.floor(k / 4) * (ch + 3), cw, ch, 47));
  } else {
    const rest = B.steps.map((_, i) => i).slice(12), top = 280, ch = 74;
    rest.forEach((i, k) => seqCard(s, B, I, i, X(k), top - Math.floor(k / 4) * (ch + 3), cw, ch, 50));
    const k = rest.length;
    if (k < 8) {
      const x = X(k), yT = top - Math.floor(k / 4) * (ch + 3);
      s.rect(x, yT - ch, cw, ch, { lw: 0.2, color: LIGHT, fill: FAINT });
      s.text(x + 2.4, yT - 5.2, 'GOOD PRACTICE', { size: 6.8, weight: 'bold' });
      s.numbered(x + 2.4, yT - 10, [
        'Pre-drill every screw: a clearance hole in the part being fixed, a pilot in the part behind, and a countersink so the head sits just below the face. Plywood edges split without a pilot.',
        'Screws 50 from the ends of a joint, about 200 apart and centred in the 18 mm edge; dowels between them. Clamp while the glue grabs.',
        'PVA (D3, water resistant) on every permanent joint; wipe the squeeze-out before it skins, or the finish won\'t take.',
        'Scan the walls before drilling. Cables run straight up and down from switches and power points: keep clear of those lines.',
        'Gas springs are loaded. Fit and remove them only with the bed down, as the kit says, and anchor the cabinet first.',
      ], cw - 5, { size: 5.4 });
    }
    jointDetail(s, M, B, top - 2 * (ch + 3) - 4);
  }
  s.finish();
}
// typical carcass joint: section at 1:1 and the spacing along a joint at 1:5
function jointDetail(s, M, B, jy) {
  const { P, G } = M, T = P.T;
  s.heading(14, jy, 'TYPICAL CARCASS JOINT  1:1', 'a fixed shelf into a side: screw and dowel drawn in one plane');
  const ox = 30, oy = jy - 76, cl = oy + 30;
  s.rect(ox, oy, T, 62, { fill: FILL.carcass, lw: LW_VIS });
  s.rect(ox + T, cl - T / 2, 70, T, { fill: FILL.carcass, lw: LW_VIS });
  const sy = cl + 4; // screw: 4.5 clearance through the side, pilot 3 x 35 in the edge, 50 long, countersunk
  s.rect(ox, sy - 2.25, T, 4.5, { fill: WHITE, lw: 0.1 });
  s.rect(ox + T, sy - 1.5, 35, 3, { fill: WHITE, lw: 0.1 });
  s.polyFill([[ox, sy - 4], [ox + 2.4, sy - 2], [ox + 50, sy - 2], [ox + 50, sy + 2], [ox + 2.4, sy + 2], [ox, sy + 4], [ox, sy - 4]], { fill: [120, 124, 130], lw: 0.15 });
  const dy = cl - 4.5; // dowel 8 x 30: 12 into the side, 19 deep hole in the edge
  s.rect(ox + T - 12, dy - 4, 31, 8, { fill: WHITE, lw: 0.1 });
  s.rect(ox + T - 12, dy - 4, 30, 8, { fill: [200, 160, 110], lw: 0.15 });
  const lab = (x, y, t) => s.text(x, y, t, { size: 5.8, va: 'middle' }), lx = ox + 96;
  s.line([ox + 50, lx - 1], [sy, sy + 10], { lw: 0.1 }); lab(lx, sy + 10, '8g x 50 countersunk screw');
  s.line([ox + T + 30, lx - 1], [sy - 1.5, sy + 4], { lw: 0.1 }); lab(lx, sy + 4, 'pilot 3, 35 deep, in the edge');
  s.line([ox + 6, lx - 1], [sy + 2.25, sy + 16], { lw: 0.1 }); lab(lx, sy + 16, '4.5 clearance and countersink in the side');
  s.line([ox + T + 12, lx - 1], [dy - 4, dy - 10], { lw: 0.1 }); lab(lx, dy - 10, '8 x 30 dowel, glued: holes 12 deep in the face, 19 in the edge');
  s.dim([ox + T - 12, dy - 4], [ox + T, dy - 4], dy - 8, 'h', '12', { size: 5 });
  s.dim([ox + T, dy - 4], [ox + T + 19, dy - 4], dy - 8, 'h', '19', { size: 5 });
  s.dim([ox, oy], [ox + T, oy], oy - 4, 'h', String(T), { size: 5 });
  s.text(ox + T / 2, oy + 64, 'side', { size: 5.8, ha: 'center', color: GREY });
  s.text(ox + T + 66, cl, 'shelf', { size: 5.8, ha: 'right', va: 'middle', color: GREY });
  // spacing along the joint
  const L = G.cDtow, k5 = 1 / 5, ex = 196, ey = jy - 30;
  const nS = Math.max(2, Math.ceil(Math.max(0, L - 100) / 200) + 1), sp = (L - 100) / (nS - 1);
  const scr = Array.from({ length: nS }, (_, i) => 50 + i * sp), dw = scr.slice(1).map((v, i) => (v + scr[i]) / 2);
  s.heading(ex, jy, 'ALONG THE JOINT  1:5', `a ${f0(L)} deep tower joint: ${nS} screws and ${dw.length} dowels`);
  s.rect(ex, ey, L * k5, T * k5 * 2, { fill: FILL.carcass, lw: LW_VIS });
  for (const v of scr) s.line([ex + v * k5, ex + v * k5], [ey - 1.5, ey + T * k5 * 2 + 1.5], { lw: 0.35, color: INK });
  for (const v of dw) s.circle(ex + v * k5, ey + T * k5, 0.8, { fill: [200, 160, 110], lw: 0.1 });
  s.dim([ex, ey], [ex + 50 * k5, ey], ey - 5, 'h', '50', { size: 5, side: 'start' });
  s.dim([ex + 50 * k5, ey], [ex + (50 + sp) * k5, ey], ey - 5, 'h', f0(sp), { size: 5 });
  s.dim([ex, ey], [ex + L * k5, ey], ey - 10, 'h', f0(L), { size: 5 });
  s.text(ex, ey + T * k5 * 2 + 4, 'lines: screws, dots: dowels (2 mm hole, shown 2:1 thick)', { size: 5.4, color: GREY });
  s.para(ex, ey - 17, s.wrap('Same pattern for the tops, bottoms and fixed shelves. Where a head would show (the inner tower side meets the bed-cabinet side, the shelf over the bed is seen from below), sink it flush and fill.', 58, 5.8), { size: 5.8, color: GREY });
}

/* ------------------------------------------------------------------ fixings schedule */
function pageFixings(doc, M, S, info) {
  const { P, G } = M, B = S.build;
  const s = Sheet(doc, info.fixAt, info.total, 'FIXINGS SCHEDULE', '-', info);
  s.text(14, 276, 'Fixings schedule', { size: 16, weight: 'bold' });
  s.text(14, 269.5, `Counted from this design for the steps on sheets ${info.seqFrom} and ${info.seqFrom + 1}; KEY is the tag in the assembly details (sheets ${info.detFrom}-${info.detFrom + info.nDet - 1}). BUY adds 10 % and two spare. Australian gauges with the metric size in brackets: any cabinet or chipboard screw with a sharp (Type 17) point suits plywood. Wall counts assume studs ${B.studs} apart.`, { size: 7.4, color: GREY });
  const rows = B.fixings.map(f => [f.tag || '', String(f.qty), String(f.buy), f.item, f.bore, f.where]);
  const yb = s.table(14, 262, [['KEY', 10, 'center'], ['QTY', 12, 'right'], ['BUY', 12, 'right'], ['FIXING', 84, 'left'], ['DRILLING', 124, 'left'], ['WHERE (STEP)', 150, 'left']], rows, { rowH: 4.6, size: 5.9, hsize: 5.4, boldCol: 0 });

  // notes
  const nx = 14, ny = yb - 12, wN = 124;
  s.heading(nx, ny, 'DRILL BITS AND TOOLS');
  let y = s.numbered(nx, ny - 6, [
    'Pilots 2, 2.5 and 3; clearance 3.5, 4.5 and 6.5; 5 for shelf pins and handle bolts; 6 through the drawer box fronts; 10 for the push latches; HSS bits for the steel flat.',
    '8 brad-point with a depth stop and a dowel jig (every wooden joint is 8 mm dowels: no Domino or biscuit joiner); 35 Forstner for the hinge cups, 13 deep, on a stand or hinge jig; a countersink; a 32 mm shelf-pin jig.',
    'Driver bits: T15 for every 3.5 mm screw, T20 for every 4.0 mm one, T30 for the wall screws. Buy all of them in one brand and finish (zinc-plated or black) so the heads match where they show.',
    'Track saw, drill-driver, four 600 and two 1200 clamps, a 1200 level or a laser, a stud finder, an edge-banding iron and trimmer.',
  ], wN, { size: 5.8 });
  const mx = nx + wN + 10;
  s.heading(mx, ny, 'GLUE');
  s.numbered(mx, ny - 6, [
    'PVA wood glue, D3 water resistant, on every dowel and carcass joint and the backs.',
    'Epoxy or PU construction adhesive under the steel flat; a high-grab hybrid polymer adhesive (CT1 or similar) behind the kick board, which has no fixings in its face.',
    'No glue on runners, hinges, plates or the kit hardware: they have to come off.',
  ], 100, { size: 5.8 });
  const wx = mx + 110;
  s.heading(wx, ny, 'WALL FIXINGS');
  s.numbered(wx, ny - 6, [
    `Timber studs: 14g x 75 batten screws, two per stud through each wall rail, the headboard cleat and the towers' outer sides (through the packers). Pre-drill 4 into hardwood studs.`,
    'Brick or block: 8 x 65 sleeve anchors in 10 holes. Steel studs: 12g tek screws into the stud flanges, or add noggings first. Plasterboard alone will not hold a fold-down bed.',
    'The kit asks for four 3 in (75) screws into studs through its header rail for a queen: the rails here carry more than that.',
  ], 146, { size: 5.8 });
  // which parts go in at each step
  const py = Math.min(y, ny - 30) - 10, rowsP = [];
  B.steps.forEach((st, i) => {
    const c = new Map();
    for (const p of M.parts) if (!p.hw && B.stepOf(p) === i) c.set(p.mark, (c.get(p.mark) || 0) + 1);
    if (c.size) rowsP.push([String(i + 1), st.title, [...c.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([m, n]) => n > 1 ? `${m} x${n}` : m).join(', ')]);
  });
  s.heading(14, py, 'PARTS BY STEP', 'plywood parts by their marks in the cut list');
  s.table(14, py - 8, [['STEP', 12, 'left'], ['', 62, 'left'], ['PARTS', 160, 'left']], rowsP, { rowH: 4.3, size: 5.8, hsize: 5.4 });
  // consumables
  const area = M.parts.filter(p => !p.hw && p.L && p.W).reduce((a, p) => a + 2 * p.L * p.W, 0) / 1e6;
  const cx = 262, cy = py;
  s.heading(cx, cy, 'CONSUMABLES', 'roughly, for this design');
  s.numbered(cx, cy - 9, [
    `Edge banding: ${Math.ceil(S.bandM * 1.1)} m (the cut list's ${S.bandM.toFixed(0)} m and 10 %), 22 mm wide for 18 mm ply.`,
    `Finish: about ${area.toFixed(0)} square metres of faces; two coats of a water-based polyurethane at about 12 square metres a litre is ${Math.ceil(area * 2 / 12)} L.`,
    'PVA: 1 L. Construction adhesive: one tube. Epoxy or PU adhesive: a small pack, for the steel flat.',
    'Double-sided tape and 6 mm spacers for setting the fronts; 2 to 5 mm plastic packers for levelling and the side walls.',
  ], 146, { size: 5.8 });
  s.finish();
}

/* ------------------------------------------------------------------ assembly details
   A half page for every step that joins plywood. Each operation gets an exploded view, all at one standard scale:
   the parts going on are pulled back along their joint, each screw floats off its head side with a dashed line from
   its tip through its clearance hole to where it lands, and dowels float in the gap. Under the views,
   set-out strips give every line of holes with its distances from a named edge. Tags name the fixings (the key is
   drawn full size on the first half page); numbered circles give the driving order. */
const STD_SCALES = [2, 2.5, 5, 7.5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100];
const SEQ_RGB = [null, [214, 110, 12], [35, 99, 172], [46, 125, 50], [123, 63, 160], [0, 128, 128]];
const FXD = { // [length, shank, head, kind, pilot, clearance]
  s50: [50, 4, 8.2, 'csk', 3, 4.5], s40: [40, 4, 8.2, 'csk', 3, 4.5], s30: [30, 4, 8.2, 'csk', 2.5, 4.5], s35: [35, 4, 8.2, 'csk', 3, 4.5], s25: [25, 4, 8.5, 'pan', 2.5, 6], s20: [20, 4, 8.5, 'pan', 2.5, 6],
  b30: [30, 3.5, 7, 'csk', 2, 3.5], b25: [25, 3.5, 7, 'csk', 2, 3.5], b20: [20, 3.5, 7, 'csk', 2, 3.5], b16: [16, 3.5, 7, 'csk', 2, 3.5],
  r10: [10, 3.5, 7, 'pan', 2, 3.5], r14: [14, 4, 8, 'pan', 2.5, 4], h15: [15, 3.5, 7, 'csk', 2, 3.5], h17: [17, 3.5, 7, 'csk', 2, 3.5], m4: [25, 4, 7, 'pan', 5, 5], m4s: [20, 4, 7, 'pan', 5, 5],
  brad: [40, 1.6, 2.6, 'brad', 0, 0], br30: [30, 1.6, 2.6, 'brad', 0, 0], w75: [75, 6, 12, 'csk', 4, 6.5],
  d8: [30, 8, 8, 'dowel', 8, 8], dom: [40, 8, 22, 'dom', 8, 8],
};
const FX_SIZE = { s50: '8g × 50', s40: '8g × 40', s30: '8g × 30', s35: '8g × 35', s25: '8g × 25 pan', s20: '8g × 20 pan', b30: '6g × 30', b25: '6g × 25', b20: '6g × 20', b16: '6g × 16',
  r10: '3.5 × 10 pan', r14: '4 × 14 pan', h15: '3.5 × 15', h17: '3.5 × 17', m4: 'M4 × 25', m4s: 'M4 × 20', brad: '40 brad', br30: '30 brad', w75: '14g × 75', d8: 'dowel 8 × 30', dom: 'Domino 8 × 40' };
const PART_NEW = [242, 196, 140], PART_OLD = [233, 228, 219], PART_CTX = [246, 246, 244], STEEL = [84, 89, 98], WOOD_FX = [184, 128, 64], HOLE = [58, 52, 46];
const D2R = Math.PI / 180;
const v3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len: (a) => Math.hypot(a[0], a[1], a[2]),
  norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
};
const fxD = (key) => FXD[key] || [30, 4, 8, 'csk', 3, 4.5];
const isWood = (key) => ['dowel', 'dom'].includes(fxD(key)[3]);
const BOXES = new WeakMap();
function partBox(p) {
  let b = BOXES.get(p);
  if (!b) { b = p.solids.map(C.prismBox).reduce((a, q) => [Math.min(a[0], q[0]), Math.min(a[1], q[1]), Math.min(a[2], q[2]), Math.max(a[3], q[3]), Math.max(a[4], q[4]), Math.max(a[5], q[5])]); BOXES.set(p, b); }
  return b;
}
const partName = (p) => { const n = p.name.replace(/ \((R|L)\)$/, '').split(',')[0]; return n.charAt(0).toLowerCase() + n.slice(1); };

// a solid of revolution along `dir` from `p0`: profile [[t, r], ...]
function latheFaces(p0, dir, prof, n) {
  n = n || 10;
  const ax = v3.norm(dir), t = Math.abs(ax[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0], u = v3.norm(v3.cross(ax, t)), v = v3.cross(ax, u);
  const rings = prof.map(([tt, r]) => Array.from({ length: n }, (_, i) => { const th = 2 * Math.PI * i / n; return [0, 1, 2].map(k => p0[k] + ax[k] * tt + (u[k] * Math.cos(th) + v[k] * Math.sin(th)) * r); }));
  const bend = prof.map((q, i) => {
    if (i === 0 || i === prof.length - 1) return true;
    const a = [q[0] - prof[i - 1][0], q[1] - prof[i - 1][1]], b = [prof[i + 1][0] - q[0], prof[i + 1][1] - q[1]];
    return (a[0] * b[0] + a[1] * b[1]) / ((Math.hypot(...a) * Math.hypot(...b)) || 1) < Math.cos(28 * D2R);
  });
  const faces = [], L = prof.length - 1;
  if (prof[0][1] > 1e-6) faces.push({ pts: rings[0].slice().reverse(), hard: rings[0].map(() => true) });
  if (prof[L][1] > 1e-6) faces.push({ pts: rings[L].slice(), hard: rings[L].map(() => true) });
  for (let i = 0; i < L; i++) {
    const A = rings[i], B = rings[i + 1], ra = prof[i][1] > 1e-6, rb = prof[i + 1][1] > 1e-6;
    if (Math.abs(prof[i + 1][0] - prof[i][0]) < 1e-9 && Math.abs(prof[i + 1][1] - prof[i][1]) < 1e-9) continue;
    for (let jj = 0; jj < n; jj++) {
      const k = (jj + 1) % n;
      if (ra && rb) faces.push({ pts: [A[jj], A[k], B[k], B[jj]], hard: [bend[i], false, bend[i + 1], false] });
      else if (ra) faces.push({ pts: [A[jj], A[k], B[0]], hard: [bend[i], false, false] });
      else if (rb) faces.push({ pts: [A[0], B[k], B[jj]], hard: [false, bend[i + 1], false] });
    }
  }
  return faces;
}
// a fixing in 3D. Screws: `ref` is where the shank meets the face (the top of a countersunk head); k thickens it
function fixFaces(key, ref, dir, k, c, along) {
  const [len, ds, dh, kind] = fxD(key), rs = ds / 2 * k, rh = dh / 2 * k;
  if (kind === 'csk') { const hc = Math.max(0.5, rh - rs), tp = Math.min(len * 0.3, 2.2 * rs); return latheFaces(ref, dir, [[0, rh], [hc, rs], [len - tp, rs], [len, rs * 0.12]], 10); }
  if (kind === 'pan') { const hh = Math.max(1.2, dh * 0.38 * k), tp = Math.min(len * 0.35, 2.2 * rs); return latheFaces(ref, dir, [[-hh, rh * 0.8], [-hh * 0.6, rh], [0, rh], [0, rs], [len - tp, rs], [len, rs * 0.12]], 10); }
  if (kind === 'brad') return latheFaces(ref, dir, [[-0.8 * k, rh], [0, rh], [0, rs], [len - 3 * rs, rs], [len, 0]], 6);
  if (kind === 'dowel') { const r = 4 * k, ch = Math.min(1, r * 0.25); return latheFaces(v3.add(c, v3.mul(dir, -15)), dir, [[0, r - ch], [ch, r], [30 - ch, r], [30, r - ch]], 12); }
  if (kind === 'dom') { const e1 = v3.norm(dir), e2 = v3.norm(along || [0, 1, 0]), e3 = v3.cross(e1, e2); return V.boxFaces(c, e1, e2, e3, [20, 11, 4 * k]); }
  return [];
}

// paper occupancy, for placing labels and order marks clear of the drawing
function Occ(x0, y0, x1, y1, res) {
  this.x0 = x0; this.y0 = y0; this.r = res || 0.5;
  this.w = Math.max(1, Math.ceil((x1 - x0) / this.r)); this.h = Math.max(1, Math.ceil((y1 - y0) / this.r));
  this.a = new Uint8Array(this.w * this.h);
}
Occ.prototype.poly = function (pts) {
  const r = this.r, ys = pts.map(p => (p[1] - this.y0) / r), xs = pts.map(p => (p[0] - this.x0) / r);
  const j0 = Math.max(0, Math.floor(Math.min(...ys))), j1 = Math.min(this.h - 1, Math.ceil(Math.max(...ys)));
  for (let j = j0; j <= j1; j++) {
    const yc = j + 0.5;
    let xl = Infinity, xr = -Infinity;
    for (let i = 0; i < pts.length; i++) {
      const k = (i + 1) % pts.length, ya = ys[i], yb = ys[k];
      if ((ya <= yc && yb > yc) || (yb <= yc && ya > yc)) { const x = xs[i] + (yc - ya) / (yb - ya) * (xs[k] - xs[i]); if (x < xl) xl = x; if (x > xr) xr = x; }
    }
    if (xl > xr) {
      const near = xs.filter((x, i) => Math.abs(ys[i] - yc) < 0.75);
      if (!near.length) continue;
      xl = Math.min(...near); xr = Math.max(...near);
    }
    for (let i = Math.max(0, Math.floor(xl)); i <= Math.min(this.w - 1, Math.floor(xr)); i++) this.a[j * this.w + i] = 1;
  }
};
Occ.prototype.rect = function (x0, y0, x1, y1) {
  const r = this.r, i0 = Math.max(0, Math.floor((x0 - this.x0) / r)), i1 = Math.min(this.w - 1, Math.floor((x1 - this.x0) / r));
  const j0 = Math.max(0, Math.floor((y0 - this.y0) / r)), j1 = Math.min(this.h - 1, Math.floor((y1 - this.y0) / r));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) this.a[j * this.w + i] = 1;
};
Occ.prototype.seg = function (a, b, rad) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / (this.r * 0.7)));
  for (let i = 0; i <= n; i++) { const x = a[0] + (b[0] - a[0]) * i / n, y = a[1] + (b[1] - a[1]) * i / n; this.rect(x - rad, y - rad, x + rad, y + rad); }
};
Occ.prototype.cost = function (x0, y0, x1, y1) {
  const r = this.r, i0 = Math.floor((x0 - this.x0) / r), i1 = Math.floor((x1 - this.x0) / r), j0 = Math.floor((y0 - this.y0) / r), j1 = Math.floor((y1 - this.y0) / r);
  let c = 0;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) c += (i < 0 || j < 0 || i >= this.w || j >= this.h) ? 4 : this.a[j * this.w + i];
  return c;
};

// prefix sums of the occupancy, for finding room for a box of a given size
Occ.prototype.clone = function () { const o = Object.create(Occ.prototype); Object.assign(o, this); o.a = this.a.slice(); o.S = null; return o; };
Occ.prototype.sums = function () {
  const W = this.w + 1, S = new Int32Array(W * (this.h + 1));
  for (let j = 0; j < this.h; j++) { let row = 0; for (let i = 0; i < this.w; i++) { row += this.a[j * this.w + i]; S[(j + 1) * W + i + 1] = S[j * W + i + 1] + row; } }
  this.S = S;
};
Occ.prototype.used = function (x0, y0, x1, y1) {
  const r = this.r, W = this.w + 1, cl = (v, n) => Math.max(0, Math.min(n, v));
  const i0 = cl(Math.floor((x0 - this.x0) / r), this.w), i1 = cl(Math.ceil((x1 - this.x0) / r), this.w), j0 = cl(Math.floor((y0 - this.y0) / r), this.h), j1 = cl(Math.ceil((y1 - this.y0) / r), this.h);
  const S = this.S;
  return S[j1 * W + i1] - S[j0 * W + i1] - S[j1 * W + i0] + S[j0 * W + i0];
};
// a free spot for a w x h box inside the region, kept `pad` clear of what is drawn; nearest to `near` first
function findRoom(occ, region, w, h, pad, near) {
  const [x0, y0, x1, y1] = region;
  let best = null;
  for (let y = y1 - h; y >= y0; y -= 1) for (let x = x0; x + w <= x1; x += 1) {
    if (occ.used(x - pad, y - pad, x + w + pad, y + h + pad)) continue;
    const d = near ? Math.hypot(x + w / 2 - near[0], y + h / 2 - near[1]) : (y1 - y - h) * 3 + (x - x0);
    if (!best || d < best.d) best = { x, y, d };
  }
  return best;
}

// the parts in an operation's view. On the bench only what is being joined; in place, the earlier parts and, where
// the step asks for it, the neighbours for reference
function opParts(inst, oi) {
  const op = inst.ops[oi], addP = op.add.map(([p]) => p), refs = op.fast.flatMap(f => [f.through, f.into]);
  const uniq = (a) => a.filter((p, i) => p && a.indexOf(p) === i);
  let present;
  if (op.bench && !inst.bench) present = uniq(refs).filter(p => addP.indexOf(p) < 0);
  else present = uniq([...inst.base, ...inst.ops.slice(0, oi).flatMap(o => o.add.map(([p]) => p)), ...refs]).filter(p => addP.indexOf(p) < 0);
  const ctx = op.ctx && !op.bench ? (inst.context || []).filter(p => addP.indexOf(p) < 0 && present.indexOf(p) < 0) : [];
  return { present, addP, ctx, refs: new Set(refs) };
}
// everything one operation needs, in model space, for a given drawing scale
function opScene(inst, oi, scale) {
  const op = inst.ops[oi], Z0 = [0, 0, 0], { present, addP, ctx, refs } = opParts(inst, oi);
  const hasD = op.fast.some(f => f.key === 'd8'), hasM = op.fast.some(f => f.key === 'dom');
  // a face screwed to a face (a side to a side, a back, a front) is pulled further back, so the gap shows
  let face = false;
  if (op.fast.length) {
    const dir = v3.norm(op.fast[0].dir), pts = op.fast.flatMap(f => f.pts), kd = [0, 1, 2].reduce((b, a) => Math.abs(dir[a]) > Math.abs(dir[b]) ? a : b, 0);
    face = [0, 1, 2].filter(a => a !== kd).every(a => Math.max(...pts.map(p => p[a])) - Math.min(...pts.map(p => p[a])) > 100);
  }
  const E = Math.min(450, Math.max(25, hasM ? 40 + 6 * scale : hasD ? 30 + 6 * scale : 5 * scale, face ? Math.min(200, 6 * scale) : 0));
  const g = Math.max(8, 3 * scale), kMin = 0.15 * scale; // fixings at least 0.3 mm thick on paper
  const off = new Map();
  for (const [p, o] of op.add) off.set(p, v3.mul(o, E));
  const offOf = (p) => off.get(p) || Z0;
  const lo = op.clip ? [-Infinity, -Infinity, op.clip[0]] : null, hi = op.clip ? [Infinity, Infinity, op.clip[1]] : null;
  const parts = [...present.map(p => ({ p, kind: 'old' })), ...addP.map(p => ({ p, kind: 'new' })), ...ctx.map(p => ({ p, kind: 'ctx' }))]
    .map(it => Object.assign(it, { off: offOf(it.p), ref: refs.has(it.p), solids: it.p.solids.map(pr => lo ? V.clipPrism(pr, lo, hi) : pr).filter(Boolean) }))
    .filter(it => it.solids.length);
  const fx = [];
  for (const f of op.fast) {
    const D = fxD(f.key), Dt = offOf(f.through), Di = offOf(f.into), dir = v3.norm(f.dir), at = (p, t) => v3.add(p, v3.mul(dir, t));
    f.pts.forEach((pt, i) => {
      const o = { f, i, key: f.key, kind: D[3], dir, seq: f.seq ? f.seq[i] : 0 };
      if (isWood(f.key)) {
        const moved = v3.len(v3.sub(Dt, Di)) > 1;
        o.c = moved ? v3.add(pt, v3.mul(v3.add(Dt, Di), 0.5)) : at(v3.add(pt, Dt), D[3] === 'dowel' ? 3 : 0);
        o.a = at(o.c, -D[0] / 2); o.b = at(o.c, D[0] / 2);
        o.holeT = v3.add(pt, Dt); o.holeI = v3.add(pt, Di); o.land = o.holeI;
        o.paths = moved ? [[o.holeT, o.a], [o.b, o.holeI]] : [];
        o.along = f.along;
      } else {
        o.entry = at(v3.add(pt, Dt), -f.thru);
        o.tip = at(o.entry, -g); o.ref = at(o.tip, -D[0]);
        o.land = v3.add(pt, Di);
        o.paths = [[o.tip, v3.add(pt, Dt), o.land]];
      }
      fx.push(o);
    });
  }
  return { inst, op, oi, scale, E, g, kMin, parts, fx, offOf };
}
// parts between a floating fixing and the viewer that are not being joined here: left out of the view
function blockers(sc, d) {
  const hit = new Set();
  for (const o of sc.fx) {
    const probes = o.ref ? [o.ref, v3.mul(v3.add(o.ref, o.tip), 0.5), o.tip] : [o.c];
    for (const it of sc.parts) {
      if (it.ref || it.kind === 'new' || hit.has(it.p)) continue;
      if (probes.some(q => it.solids.some(pr => V.rayHitsPrism(q, d, pr, it.off, 0.5)))) hit.add(it.p);
    }
  }
  return hit;
}
// share of the landing points (and floating dowels) the viewer can see
function landVisible(sc, d, omit) {
  if (!sc.fx.length) return 1;
  let n = 0;
  const parts = sc.parts.filter(it => !omit.has(it.p));
  for (const o of sc.fx) {
    const q = o.ref ? v3.add(o.land, v3.mul(o.dir, -0.6)) : o.c;
    if (!parts.some(it => it.solids.some(pr => V.rayHitsPrism(q, d, pr, it.off, 0.5)))) n++;
  }
  return n / sc.fx.length;
}
function viewBasisFor(d) { return Math.abs(d[2]) > 0.93 ? { upHint: [0, -1, 0] } : {}; }
// the view: from the side the screws go in, where the landing points can be seen, near the preferred direction
function chooseView(inst, oi, pref, prevD) { return chooseViewScene(opScene(inst, oi, 15), pref, prevD); }
function chooseViewScene(sc, pref, prevD) {
  const op = sc.op, groupsIn = new Map();
  for (const o of sc.fx) groupsIn.set(o.f, (groupsIn.get(o.f) || 0) + 1);
  const offs = op.add.map(([, o]) => o).filter(o => v3.len(o) > 0.1);
  // a long thin assembly reads best square to the page
  let lb = null;
  for (const it of sc.parts) { const b = partBox(it.p); lb = lb ? [0, 1, 2].map(i => Math.min(lb[i], b[i])).concat([3, 4, 5].map(i => Math.max(lb[i], b[i]))) : b.slice(); }
  const ext = lb ? [lb[3] - lb[0], lb[4] - lb[1], lb[5] - lb[2]] : [1, 1, 1], ord = [0, 1, 2].sort((a, b) => ext[b] - ext[a]);
  const longAx = ext[ord[0]] > 2.5 * ext[ord[1]] ? [0, 1, 2].map(i => i === ord[0] ? 1 : 0) : null;
  const cands = [];
  for (let el = -70; el <= 75; el += 5) for (let az = -180; az < 180; az += 7.5) {
    const ce = Math.cos(el * D2R), d = [ce * Math.sin(az * D2R), ce * Math.cos(az * D2R), Math.sin(el * D2R)];
    let sum = 0, n = 0;
    for (const [f, cnt] of groupsIn) {
      const c = v3.dot(d, v3.norm(f.dir)), b = Math.sqrt(Math.max(0, 1 - c * c)), a = -c;
      const v = isWood(f.key) ? Math.min(1, b / 0.6) : (a >= 0.3 ? 1 : a >= 0 ? a / 0.3 : 2.5 * a / 0.3) * Math.min(1, b / 0.55);
      sum += v * cnt; n += cnt;
    }
    let s = n ? sum / n : 0;
    for (const o of offs) { const c = v3.dot(d, v3.norm(o)); s += 0.3 * Math.min(1, Math.sqrt(Math.max(0, 1 - c * c)) / 0.6); }
    s += 0.45 * v3.dot(d, pref) + (prevD ? 0.15 * v3.dot(d, prevD) : 0);
    if (op.view === 'below' && d[2] > -0.15) s -= 0.6;
    if (op.front && (d[1] < 0.55 || d[2] < 0.25)) s -= 0.6;
    if (longAx) {
      const { right, up } = V.viewBasis(d, viewBasisFor(d)), pu = v3.dot(longAx, right), pv = v3.dot(longAx, up), l2 = pu * pu + pv * pv;
      if (l2 > 1e-6) s -= 0.2 * Math.abs(2 * pu * pv / l2);
    }
    cands.push({ s, d });
  }
  cands.sort((a, b) => b.s - a.s);
  // panels going on should show a face, not an edge, unless that face is hidden anyway
  const panels = sc.parts.filter(it => it.kind === 'new').map(it => {
    const b = partBox(it.p), e = [b[3] - b[0], b[4] - b[1], b[5] - b[2]], o = [0, 1, 2].sort((x, y) => e[x] - e[y]);
    return e[o[0]] < 0.3 * e[o[1]] ? { it, a: o[0], c: [(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2], t: e[o[0]] } : null;
  }).filter(Boolean);
  let best = null;
  for (const c of cands.slice(0, 48)) {
    const omit = blockers(sc, c.d), vis = landVisible(sc, c.d, omit), live = sc.parts.filter(it => !omit.has(it.p));
    let pf = 0;
    for (const q of panels) {
      const sg = Math.sign(c.d[q.a]) || 1, ctr = v3.add(v3.add(q.c, q.it.off), [0, 1, 2].map(i => i === q.a ? sg * (q.t / 2 + 0.5) : 0));
      const seen = !live.some(it => it.solids.some(pr => V.rayHitsPrism(ctr, c.d, pr, it.off, 0.5)));
      pf += seen ? Math.min(1, Math.abs(c.d[q.a]) / 0.3) : 0.5;
    }
    const s = c.s + 0.3 * vis + (panels.length ? 0.35 * pf / panels.length : 0) - 0.04 * omit.size;
    if (!best || s > best.s) best = { s, d: c.d };
  }
  return best ? best.d : [-0.5, 0.75, 0.43];
}
// a close-up of one joint: the end of the operation's main line of screws, with what lies round it, cut out of the
// exploded scene at a larger scale
function closeupScene(inst, oi, scale, pick) {
  const sc = opScene(inst, oi, scale), groups = sc.op.fast.filter(f => !isWood(f.key));
  if (!groups.length) return null;
  const f = pick || groups.reduce((a, b) => b.pts.length > a.pts.length ? b : a), dir = v3.norm(f.dir);
  const kd = [0, 1, 2].reduce((b, a) => Math.abs(dir[a]) > Math.abs(dir[b]) ? a : b, 0), inPl = [0, 1, 2].filter(a => a !== kd);
  const spr = (a) => { const v = f.pts.map(p => p[a]); return Math.max(...v) - Math.min(...v); };
  const k = spr(inPl[0]) >= spr(inPl[1]) ? inPl[0] : inPl[1];
  const mine = sc.fx.filter(o => o.f === f).sort((a, b) => a.f.pts[a.i][k] - b.f.pts[b.i][k]);
  const tb = partBox(f.through), Dt = sc.offOf(f.through);
  // start at the end of the line where the first screw of a numbered order goes, else the end nearer an edge
  const ends = [mine[0], mine[mine.length - 1]], dEnd = ends.map((o, q) => q ? tb[k + 3] - o.f.pts[o.i][k] : o.f.pts[o.i][k] - tb[k]);
  const near = (o0) => mine.filter(o => Math.abs(o.f.pts[o.i][k] - o0.f.pts[o0.i][k]) <= 200);
  const firstSeq = (l) => Math.min(...l.map(o => o.seq || 99));
  const subs = ends.map(near), from = firstSeq(subs[1]) < firstSeq(subs[0]) ? 1 : firstSeq(subs[0]) < firstSeq(subs[1]) ? 0 : dEnd[1] < dEnd[0] ? 1 : 0;
  const sub = subs[from];
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  const grow = (p) => { for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], p[a]); hi[a] = Math.max(hi[a], p[a]); } };
  for (const o of sub) { grow(o.ref); grow(o.tip); grow(o.land); grow(o.entry); }
  const m = 30;
  for (let a = 0; a < 3; a++) { lo[a] -= m; hi[a] += m; }
  if (from === 0) lo[k] = Math.min(lo[k], tb[k] + Dt[k] - 12); else hi[k] = Math.max(hi[k], tb[k + 3] + Dt[k] + 12);
  const inside = (p) => p.every((v, a) => v >= lo[a] - 0.5 && v <= hi[a] + 0.5);
  const parts = sc.parts.map(it => {
    const solids = it.solids.map(pr => {
      const moved = Object.assign({}, pr, { o: v3.add(pr.o, it.off) }), c = V.clipPrism(moved, lo, hi);
      if (!c) return null;
      const b = C.prismBox(c);
      return b[0] < lo[0] - m || b[1] < lo[1] - m || b[2] < lo[2] - m || b[3] > hi[0] + m || b[4] > hi[1] + m || b[5] > hi[2] + m ? null : c;
    }).filter(Boolean);
    return Object.assign({}, it, { solids, off: [0, 0, 0] });
  }).filter(it => it.solids.length);
  const fx = sc.fx.filter(o => o.ref ? inside(o.entry) && inside(o.land) : inside(o.c));
  return Object.assign({}, sc, { parts, fx, focus: sub, lo, hi, main: f });
}
// projected extent (model mm) of an operation's view
function opExtent(sc, d, omit) {
  const { right, up } = V.viewBasis(d, viewBasisFor(d));
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  const grow = (p) => { const u = v3.dot(p, right), v = v3.dot(p, up); if (u < u0) u0 = u; if (u > u1) u1 = u; if (v < v0) v0 = v; if (v > v1) v1 = v; };
  for (const it of sc.parts) { if (omit.has(it.p)) continue; for (const pr of it.solids) for (const c of C.prismCorners(pr)) grow(v3.add(c, it.off)); }
  for (const o of sc.fx) { if (o.ref) { grow(o.ref); grow(o.tip); } else { grow(o.a); grow(o.b); } }
  return [u0, v0, u1, v1];
}
// the operation views of an instance at a scale (directions chosen once, in `dirs`)
function stepViews(inst, scale, dirs) {
  return inst.ops.map((op, oi) => {
    const sc = opScene(inst, oi, scale), d = dirs[oi], omit = blockers(sc, d), box = opExtent(sc, d, omit);
    return { sc, d, omit, box, w: (box[2] - box[0]) / scale, h: (box[3] - box[1]) / scale };
  });
}

function drawLabelChip(s, x, y, tag, size) {
  const w = s.tw(tag, size, 'bold') + 1.4, h = size * 0.42;
  s.rect(x, y - h / 2, w, h, { fill: INK, lw: 0 });
  s.text(x + w / 2, y - 0.05, tag, { size, weight: 'bold', color: WHITE, ha: 'center', va: 'middle' });
  return w;
}
function seqDot(s, x, y, q, col) {
  s.circle(x, y, 1.0, { fill: col || SEQ_RGB[q] || ACC, lw: 0 });
  s.text(x, y - 0.05, String(q), { size: q > 9 ? 4.3 : 5, weight: 'bold', color: WHITE, ha: 'center', va: 'middle' });
}

// one operation's view, centred in the box (x0, y0, w, h): faces, edges, fixing paths and arrows. Labels go on in a
// second pass, once every view on the half page is in the occupancy map.
function drawOpView(s, V0, scale, x0, y0, w, h, occ) {
  const { sc, d, omit } = V0, doc = s.doc, YP = (y) => PH - y;
  const items = [];
  for (const it of sc.parts) {
    if (omit.has(it.p)) continue;
    const faces = [];
    for (const pr of it.solids) faces.push(...V.partFaces(pr, it.off));
    if (!faces.length) continue;
    items.push({ faces, fill: it.kind === 'new' ? PART_NEW : it.kind === 'ctx' ? PART_CTX : PART_OLD, ink: it.kind === 'ctx' ? [158, 156, 150] : [74, 68, 60], lw: it.kind === 'ctx' ? 0.06 : 0.1 });
  }
  const maxSeq = Math.max(0, ...sc.fx.map(o => o.seq || 0));
  for (const o of sc.fx) {
    const D = fxD(o.key), k = Math.max(1, sc.kMin / (D[1] / 2));
    if (o.ref) {
      items.push({ faces: fixFaces(o.key, o.ref, o.dir, k), fill: o.seq && maxSeq <= 5 ? SEQ_RGB[o.seq] : STEEL, edges: false });
      const rH = Math.max(D[2] / 2, 0.2 * scale), rP = Math.max((D[4] || 1.6) / 2, 0.14 * scale);
      items.push({ faces: [V.diskFace(v3.add(o.entry, v3.mul(o.dir, -0.3)), v3.mul(o.dir, -1), rH, 12)], fill: HOLE, flat: true, edges: false });
      items.push({ faces: [V.diskFace(v3.add(o.land, v3.mul(o.dir, -0.3)), v3.mul(o.dir, -1), rP, 10)], fill: HOLE, flat: true, edges: false });
    } else {
      items.push({ faces: fixFaces(o.key, null, o.dir, Math.max(1, sc.kMin / 4), o.c, o.along), fill: WOOD_FX, edges: scale <= 7.5, ink: [110, 70, 30], lw: 0.06 });
      const r = Math.max(4, 0.14 * scale), ext = o.kind === 'dom' ? 7 : 0;
      items.push({ faces: [V.diskFace(v3.add(o.holeI, v3.mul(o.dir, -0.3)), v3.mul(o.dir, -1), r, 12, ext ? o.along : null, ext)], fill: HOLE, flat: true, edges: false });
      items.push({ faces: [V.diskFace(v3.add(o.holeT, v3.mul(o.dir, 0.3)), o.dir, r, 12, ext ? o.along : null, ext)], fill: HOLE, flat: true, edges: false });
    }
  }
  const R = V.renderItems(items, d, 12 / scale, viewBasisFor(d));
  const bw = (R.box[2] - R.box[0]) / scale, bh = (R.box[3] - R.box[1]) / scale;
  const ox = x0 + (w - bw) / 2, oy = y0 + (h - bh) / 2;
  const P = (q) => [ox + (q[0] - R.box[0]) / scale, oy + (q[1] - R.box[1]) / scale], P3 = (p) => P(R.proj(p));
  for (const pg of R.polys) {
    const pts = pg.p.map(P), segs = [];
    for (let i = 1; i < pts.length; i++) segs.push([pts[i][0] - pts[i - 1][0], -(pts[i][1] - pts[i - 1][1])]);
    doc.setFillColor(pg.f[0], pg.f[1], pg.f[2]); doc.setDrawColor(pg.f[0], pg.f[1], pg.f[2]); doc.setLineWidth(0.03);
    doc.lines(segs, pts[0][0], YP(pts[0][1]), [1, 1], 'FD', true);
    if (pg.e.length) {
      const ink = pg.ink || [74, 68, 60];
      doc.setDrawColor(ink[0], ink[1], ink[2]); doc.setLineWidth(pg.lw || 0.1);
      for (const e of pg.e) { const a = P([e[0], e[1]]), b = P([e[2], e[3]]); doc.line(a[0], YP(a[1]), b[0], YP(b[1])); }
    }
    occ.poly(pts);
  }
  // the paths of the fixings, and a ring where a landing point is hidden
  const parts = sc.parts.filter(it => !omit.has(it.p));
  s.color([60, 60, 62]); doc.setLineWidth(0.1); s.dash([0.75, 0.5]);
  for (const o of sc.fx) for (const path of o.paths) {
    const q = path.map(P3);
    for (let i = 0; i < q.length - 1; i++) { if (Math.hypot(q[i + 1][0] - q[i][0], q[i + 1][1] - q[i][1]) < 0.05) continue; doc.line(q[i][0], YP(q[i][1]), q[i + 1][0], YP(q[i + 1][1])); occ.seg(q[i], q[i + 1], 0.25); }
  }
  s.dash(null);
  for (const o of sc.fx) {
    if (!o.ref) continue;
    const q = v3.add(o.land, v3.mul(o.dir, -0.6));
    if (parts.some(it => it.solids.some(pr => V.rayHitsPrism(q, d, pr, it.off, 0.5)))) { const c = P3(o.land); s.circle(c[0], c[1], 0.42, { lw: 0.1, color: [60, 60, 62] }); }
  }
  // arrows for parts that slide in (not in close-ups: their ends lie outside the cut-out)
  if (sc.op.arrow && !V0.close) {
    let a, b;
    if (Array.isArray(sc.op.arrow)) { a = P3(sc.op.arrow[0]); b = P3(sc.op.arrow[1]); }
    else {
      const [p, o] = sc.op.add[0], bb = partBox(p), c = [(bb[0] + bb[3]) / 2, (bb[1] + bb[4]) / 2, (bb[2] + bb[5]) / 2], u = v3.norm(o);
      const half = Math.abs(u[0]) * (bb[3] - bb[0]) / 2 + Math.abs(u[1]) * (bb[4] - bb[1]) / 2 + Math.abs(u[2]) * (bb[5] - bb[2]) / 2;
      a = P3(v3.add(c, v3.mul(u, sc.E + half + Math.max(60, 1.2 * sc.E)))); b = P3(v3.add(c, v3.mul(u, sc.E + half + 8)));
    }
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const d3 = Array.isArray(sc.op.arrow) ? v3.norm(v3.sub(sc.op.arrow[1], sc.op.arrow[0])) : [0, 0, 1];
    const misleading = Math.abs(d3[2]) < 0.3 && Math.abs(b[0] - a[0]) < 0.5 * L;
    if (L > 6 && !misleading) {
      s.line([a[0], b[0] - (b[0] - a[0]) / L * 2], [a[1], b[1] - (b[1] - a[1]) / L * 2], { lw: 0.6, color: ACC });
      s.arrow(b, [b[0] - a[0], b[1] - a[1]], { color: ACC, L: 3, W: 1.2 });
      occ.seg(a, b, 1);
    }
  }
  return { sc, P3, scale, maxSeq, d, close: !!V0.close, cell: [x0, y0, w, h], bbox: [ox, oy, ox + bw, oy + bh] };
}
// order marks beside the heads, and a tag for each kind of fixing with leaders to (up to three of) its groups
function annotateOpView(s, A, occ) {
  const { sc, P3, scale, maxSeq } = A, [x0, y0, w, h] = A.cell;
  const marks = [];
  for (const o of sc.fx) {
    if (!o.seq || !o.ref) continue;
    const hd = P3(o.ref), tp = P3(o.tip), ax = [tp[0] - hd[0], tp[1] - hd[1]], L = Math.hypot(ax[0], ax[1]) || 1, n = [-ax[1] / L, ax[0] / L];
    const D = fxD(o.key), rh = Math.max(D[2] / 2, sc.kMin * D[2] / D[1]) / scale, dd = rh + 1.25;
    const base = [hd[0] + ax[0] / L * Math.min(L * 0.3, 1.2), hd[1] + ax[1] / L * Math.min(L * 0.3, 1.2)];
    const cands = [[base[0] + n[0] * dd, base[1] + n[1] * dd], [base[0] - n[0] * dd, base[1] - n[1] * dd], [hd[0] - ax[0] / L * dd, hd[1] - ax[1] / L * dd]];
    let bestC = cands[0], bc = Infinity;
    for (const c of cands) { const cost = occ.cost(c[0] - 1, c[1] - 1, c[0] + 1, c[1] + 1) + marks.filter(m => Math.hypot(m[0] - c[0], m[1] - c[1]) < 2.1).length * 10; if (cost < bc) { bc = cost; bestC = c; } }
    marks.push(bestC);
    seqDot(s, bestC[0], bestC[1], o.seq, maxSeq <= 5 ? null : ACC);
    occ.rect(bestC[0] - 1.1, bestC[1] - 1.1, bestC[0] + 1.1, bestC[1] + 1.1);
  }
  const byKey = new Map();
  for (const o of sc.fx) { if (!byKey.has(o.key)) byKey.set(o.key, []); byKey.get(o.key).push(o); }
  for (const [key, list] of byKey) {
    const tag = C.TAGS[key] || key, txt = `×${list.length}`, size = 6;
    const wChip = s.tw(tag, size, 'bold') + 1.4, wl = wChip + 0.8 + s.tw(txt, size), hl = 2.9;
    const groups = [...new Set(list.map(o => o.f))].sort((a, b) => b.pts.length - a.pts.length);
    const reps = [];
    for (const f of groups) {
      const os = list.filter(o => o.f === f), o = os[Math.floor((os.length - 1) / 2)];
      const pt = o.ref ? P3(o.ref) : P3(o.c);
      if (reps.every(r => Math.hypot(r.pt[0] - pt[0], r.pt[1] - pt[1]) > 12)) reps.push({ o, pt });
      if (reps.length >= 3) break;
    }
    const r0 = reps[0], o0 = r0.o;
    let pdir;
    if (o0.ref) { const a = P3(o0.tip), b = P3(o0.ref); pdir = [b[0] - a[0], b[1] - a[1]]; }
    else { const a = P3(o0.a), b = P3(o0.b); pdir = [-(b[1] - a[1]), b[0] - a[0]]; }
    const pl = Math.hypot(pdir[0], pdir[1]); pdir = pl > 0.2 ? [pdir[0] / pl, pdir[1] / pl] : [1, 0];
    let best = null;
    for (const r of [3, 4.5, 6, 8, 10.5, 13, 16, 20, 25, 31]) for (const da of [0, 25, -25, 50, -50, 75, -75, 100, -100, 130, -130, 180]) {
      const c = Math.cos(da * D2R), sn = Math.sin(da * D2R), dv = [pdir[0] * c - pdir[1] * sn, pdir[0] * sn + pdir[1] * c];
      const cx = r0.pt[0] + dv[0] * r, cy = r0.pt[1] + dv[1] * r;
      const bx = dv[0] >= 0 ? cx : cx - wl, by = cy - hl / 2;
      let cost = occ.cost(bx - 0.6, by - 0.5, bx + wl + 0.6, by + hl + 0.5) * 3 + r * 0.6 + Math.abs(da) * 0.01;
      cost += occ.cost(Math.min(cx, r0.pt[0]), Math.min(cy, r0.pt[1]), Math.max(cx, r0.pt[0]), Math.max(cy, r0.pt[1])) * 0.02;
      if (bx < x0 || bx + wl > x0 + w || by < y0 - 1 || by + hl > y0 + h + 1) cost += 400;
      if (!best || cost < best.cost) best = { cost, bx, by };
    }
    const { bx, by } = best, ym = by + hl / 2;
    for (const r of reps) {
      const inX = r.pt[0] >= bx && r.pt[0] <= bx + wl;
      const ex = inX ? r.pt[0] : r.pt[0] < bx ? bx - 0.3 : bx + wl + 0.3, ey = inX ? (r.pt[1] < by ? by - 0.3 : by + hl + 0.3) : ym;
      s.line([ex, r.pt[0]], [ey, r.pt[1]], { lw: 0.1, color: INK });
      s.circle(r.pt[0], r.pt[1], 0.32, { fill: INK, lw: 0 });
      occ.seg([ex, ey], r.pt, 0.2);
    }
    drawLabelChip(s, bx, ym, tag, size);
    s.text(bx + wChip + 0.8, ym - 0.05, txt, { size, va: 'middle' });
    occ.rect(bx - 0.5, by - 0.4, bx + wl + 0.5, by + hl + 0.4);
  }
}

/* set-out strips: every straight line of holes on a part's face, as drilled, with the distance of each hole from a
   named edge. Lines that repeat (both shelves, both halves) are drawn once and counted. */
const EDGE = [['right-hand end', 'left-hand end'], ['back edge', 'front edge'], ['bottom edge', 'top edge']];
function setoutPatterns(inst) {
  const lines = [];
  inst.ops.forEach((op, oi) => {
    for (const f of op.fast) {
      const dir = v3.norm(f.dir), kd = [0, 1, 2].reduce((b, a) => Math.abs(dir[a]) > Math.abs(dir[b]) ? a : b, 0);
      if (Math.abs(dir[kd]) < 0.999) continue; // a slanted joint (the backrest) is set out from its own drawing
      const tb = partBox(f.through), inPl = [0, 1, 2].filter(a => a !== kd);
      const spr = (a) => { const v = f.pts.map(p => p[a]); return Math.max(...v) - Math.min(...v); };
      let k = spr(inPl[0]) >= spr(inPl[1]) ? inPl[0] : inPl[1];
      if (spr(k) < 0.5) k = (tb[inPl[0] + 3] - tb[inPl[0]]) >= (tb[inPl[1] + 3] - tb[inPl[1]]) ? inPl[0] : inPl[1];
      const j = inPl[0] === k ? inPl[1] : inPl[0];
      const byJ = [];
      f.pts.forEach((p, i) => { let L = byJ.find(q => Math.abs(q.jv - p[j]) < 1); if (!L) { L = { jv: p[j], idx: [] }; byJ.push(L); } L.idx.push(i); });
      for (const L of byJ) {
        const holes = L.idx.map(i => ({ pos: f.pts[i][k], key: f.key, seq: f.seq ? f.seq[i] : 0 }));
        let m = lines.find(q => q.through === f.through && q.k === k && q.kd === kd && Math.abs(q.jv - L.jv) < 1);
        if (m) { m.holes.push(...holes); if (m.into.indexOf(f.into) < 0) m.into.push(f.into); if (m.ops.indexOf(oi) < 0) m.ops.push(oi); }
        else lines.push({ through: f.through, into: [f.into], kd, k, j, jv: L.jv, holes, ops: [oi], dir });
      }
    }
  });
  const pats = [];
  const same = (A, rel, B) => A.k === B.k && A.kd === B.kd && Math.abs(A.len - B.len) < 1 && rel.length === B.rel.length && rel.every((h, i) => h.key === B.rel[i].key && Math.abs(h.r - B.rel[i].r) <= 1);
  for (const L of lines) {
    const tb = partBox(L.through);
    L.len = tb[L.k + 3] - tb[L.k];
    L.rel = L.holes.map(h => Object.assign({}, h, { r: Math.round((h.pos - tb[L.k]) * 2) / 2 })).sort((a, b) => a.r - b.r || (isWood(a.key) ? 1 : -1));
    const mir = L.rel.map(h => Object.assign({}, h, { r: L.len - h.r })).sort((a, b) => a.r - b.r || (isWood(a.key) ? 1 : -1));
    let p = pats.find(q => same(L, L.rel, q.lines[0]));
    if (!p) { p = pats.find(q => same(L, mir, q.lines[0])); if (p) L.mirror = true; }
    if (p) { p.lines.push(L); for (const o of L.ops) if (p.ops.indexOf(o) < 0) p.ops.push(o); }
    else pats.push({ lines: [L], ops: L.ops.slice() });
  }
  pats.forEach(p => p.ops.sort((a, b) => a - b));
  return pats.sort((a, b) => a.ops[0] - b.ops[0]);
}
function setoutScale(len, wMax) { for (const sc of [2.5, 5, 7.5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100]) if (len / sc <= wMax) return sc; return 100; }
// where the lines sit across their parts, in words
function lineWhere(pat) {
  const centred = pat.lines.every(L => {
    const ib = partBox(L.into[0]), c = (ib[L.j] + ib[L.j + 3]) / 2;
    return L.into.length === 1 && Math.abs(L.jv - c) < 0.6 && ib[L.j + 3] - ib[L.j] < 60;
  });
  if (centred) { const ns = [...new Set(pat.lines.map(L => partName(L.into[0])))]; return ns.length === 1 ? `centred on the ${ns[0]}` : 'centred on each joint'; }
  const L = pat.lines[0], tb = partBox(L.through), j = L.j;
  if (pat.lines.every(l => { const t = partBox(l.through); return Math.abs(l.jv - (t[j] + t[j + 3]) / 2) < 0.6; })) return 'on its centre line';
  const near0 = L.jv - tb[j] <= tb[j + 3] - L.jv;
  const ds = [...new Set(pat.lines.map(l => { const t = partBox(l.through); return fh(near0 ? l.jv - t[j] : t[j + 3] - l.jv); }))];
  const list = ds.length <= 4 ? (ds.length > 1 ? ds.slice(0, -1).join(', ') + ' and ' + ds[ds.length - 1] : ds[0]) : `${ds.length} lines`;
  return `${list} from the ${EDGE[j][near0 ? 0 : 1]}`;
}
function setoutHead(pat) {
  const names = [...new Set(pat.lines.map(l => `${l.through.mark} ${partName(l.through).replace(/ \d+$/, '')}`))];
  const n = pat.lines.length, nm = pat.lines.filter(l => l.mirror).length;
  return `${names.join(' and ')}${n > 1 ? ` (×${n}${nm ? `, ${nm} mirrored` : ''})` : ''}, ${lineWhere(pat)}`;
}
const SO = { lab: 5.1, ord: 4.4, edge: 4.4 };
function setoutGeom(s, pat, wMax) {
  const L = pat.lines[0], tb = partBox(L.through), k = L.k, j = L.j, sc = setoutScale(L.len, wMax - 4);
  const D0 = Math.max(...L.rel.map(h => fxD(h.key)[2])), hb = Math.max(D0 / 2 + 4, 1.6 * sc);
  const j0 = Math.max(tb[j], L.jv - hb), j1 = Math.min(tb[j + 3], L.jv + hb);
  const bandH = Math.max(0.6, (j1 - j0) / sc);
  const txtW = Math.max(s.tw('0', SO.ord), ...L.rel.map(h => s.tw(fh(h.r), SO.ord)));
  const hasSeq = L.rel.some(h => h.seq);
  const head = setoutHead(pat), headW = pat.ops.length * 2.8 + 0.8 + s.tw(head, SO.lab, 'bold') + 1 + s.tw(`1:${sc}`, 4.7);
  const wBand = L.len / sc + 4;
  return { L, tb, k, j, sc, j0, j1, bandH, txtW, hasSeq, head, wBand, w: Math.max(wBand, Math.min(headW, wMax)), h: 2.9 + (hasSeq ? 2.4 : 0) + 0.7 + txtW + 0.9 + bandH + 2.6 };
}
function drawSetout(s, G, pat, x, yTop) {
  const { L, tb, k, j, sc, j0, j1, bandH, txtW } = G;
  const X = (v) => x + 2 + (v - tb[k]) / sc, yb = yTop - G.h + 2.6, Yj = (v) => yb + (v - j0) / sc;
  // heading: the operations, the part, where the line runs, the scale
  let hx = x;
  pat.ops.forEach(oi => { s.circle(hx + 1.15, yTop - 1.2, 1.15, { fill: INK, lw: 0 }); s.text(hx + 1.15, yTop - 1.25, String(oi + 1), { size: 4.5, weight: 'bold', color: WHITE, ha: 'center', va: 'middle' }); hx += 2.8; });
  hx += 0.8;
  let ht = G.head;
  const room = G.w - (hx - x) - s.tw(`1:${sc}`, 4.7) - 1;
  if (s.tw(ht, SO.lab, 'bold') > room) { while (ht.length > 8 && s.tw(ht + '…', SO.lab, 'bold') > room) ht = ht.slice(0, -1); ht = ht.replace(/[ ,(]*$/, '') + '…'; }
  s.text(hx, yTop - 1.25, ht, { size: SO.lab, weight: 'bold', va: 'middle' });
  s.text(hx + s.tw(ht, SO.lab, 'bold') + 1, yTop - 1.25, `1:${sc}`, { size: 4.7, color: GREY, va: 'middle' });
  // the band of the part along the line, broken where the part goes on beyond it
  const xa = X(tb[k]), xb = X(tb[k + 3]), ya = Yj(j0), yt = Yj(j1);
  s.rect(xa, ya, xb - xa, yt - ya, { fill: PART_OLD, lw: 0 });
  s.line([xa, xa], [ya, yt], { lw: 0.2 }); s.line([xb, xb], [ya, yt], { lw: 0.2 });
  const edgeLine = (yy, real) => {
    if (real) { s.line([xa, xb], [yy, yy], { lw: 0.2 }); return; }
    const pts = [];
    for (let xx = xa, i = 0; xx < xb + 0.8; xx += 0.8, i++) pts.push([Math.min(xx, xb), yy + (i % 2 ? 0.3 : -0.3) * (xx > xa + 0.1 && xx < xb - 0.1 ? 1 : 0)]);
    s.poly(pts, { lw: 0.1, color: GREY });
  };
  edgeLine(ya, Math.abs(j0 - tb[j]) < 0.5); edgeLine(yt, Math.abs(j1 - tb[j + 3]) < 0.5);
  // the parts behind, where the fixings land, dashed
  for (const ip of L.into) {
    const ib = partBox(ip), ka = Math.max(ib[k], tb[k]), kb = Math.min(ib[k + 3], tb[k + 3]), ja = Math.max(ib[j], j0), jb = Math.min(ib[j + 3], j1);
    if (kb - ka > 0.5 && jb - ja > 0.2) s.rect(X(ka), Yj(ja), (kb - ka) / sc, (jb - ja) / sc, { lw: 0.1, color: GREY, dash: [0.6, 0.4] });
  }
  // holes from the head side: clearance and countersink for screws; dowel holes, in the far face, dashed
  const yL = Yj(L.jv), maxSeq = Math.max(0, ...L.rel.map(h => h.seq || 0));
  for (const h of L.rel) {
    const D = fxD(h.key), cx = X(tb[k] + h.r);
    if (D[3] === 'dowel') s.circle(cx, yL, Math.max(0.35, 4 / sc), { lw: 0.12, color: [130, 84, 36], dash: [0.4, 0.3] });
    else if (D[3] === 'dom') { const hw = 11 / sc, hh = Math.max(0.3, 4 / sc); s.rect(cx - hw, yL - hh, 2 * hw, 2 * hh, { lw: 0.12, color: [130, 84, 36], dash: [0.4, 0.3] }); }
    else {
      if (D[2] / 2 / sc > 0.45) s.circle(cx, yL, D[2] / 2 / sc, { lw: 0.08, color: INK });
      s.circle(cx, yL, Math.max(0.3, (D[5] || D[1]) / 2 / sc), { fill: HOLE, lw: 0 });
    }
  }
  // ordinates from the named edge, above the band
  const yT0 = Math.max(yt, yL) + 0.9;
  if (!L.rel.length || X(tb[k] + L.rel[0].r) - xa > 2.2) s.text(xa + 0.75, yT0 + 0.2, '0', { size: SO.ord, angle: 90 }); // the edge itself; left off where the first hole crowds it
  const done = [];
  for (const h of L.rel) {
    if (done.some(r => Math.abs(r - h.r) < 0.25)) continue;
    done.push(h.r);
    const cx = X(tb[k] + h.r), wood = isWood(h.key);
    s.line([cx, cx], [yL + 0.45, yT0], { lw: 0.06, color: wood ? [150, 106, 60] : GREY });
    s.text(cx + 0.75, yT0 + 0.2, fh(h.r), { size: SO.ord, angle: 90, color: wood ? [130, 84, 36] : INK, weight: wood ? null : 'bold' });
    if (h.seq) seqDot(s, cx, yT0 + txtW + 1.6, h.seq, maxSeq <= 5 ? null : ACC);
  }
  s.text(xa, yb - 2.1, EDGE[k][0], { size: SO.edge, color: GREY });
  s.text(xb, yb - 2.1, EDGE[k][1], { size: SO.edge, color: GREY, ha: 'right' });
  if (xb - xa > 34) s.text((xa + xb) / 2, yb - 2.1, `${fh(L.len)} long`, { size: SO.edge, color: GREY, ha: 'center' });
}
function setoutFlow(s, pats, W) {
  const items = pats.map(p => { const third = setoutGeom(s, p, (W - 8) / 3), half = setoutGeom(s, p, (W - 4) / 2), full = setoutGeom(s, p, W); return third.sc <= 40 ? third : half.sc <= 40 ? half : full; });
  const rows = [];
  let cur = null;
  for (const it of items) {
    if (cur && cur.w + 4 + it.w <= W) { cur.items.push(it); cur.w += 4 + it.w; cur.h = Math.max(cur.h, it.h); }
    else { cur = { items: [it], w: it.w, h: it.h }; rows.push(cur); }
  }
  return { items, rows, h: rows.reduce((a, r) => a + r.h + 1.8, 0) };
}

/* dimensions on the views: for every line of holes, a chain from the edge of the part it is drilled through, hole
   centre to hole centre, to the far edge, with equal gaps written once ("3 × 155"); and a chain across the face
   locating the lines from its edges. Lines and faces that repeat are dimensioned once. */
const DIM_RGB = [44, 62, 88];
// lines of holes in a scene, in the frame of the face they are drilled from: a along the line, c across it
function holeLines(sc) {
  const byF = new Map();
  for (const o of sc.fx) { if (!byF.has(o.f)) byF.set(o.f, []); byF.get(o.f).push(o); }
  const lines = [];
  for (const [f, os] of byF) {
    const dir = v3.norm(f.dir), kd = [0, 1, 2].reduce((b, q) => Math.abs(dir[q]) > Math.abs(dir[b]) ? q : b, 0);
    let a = null;
    if (Math.abs(dir[kd]) > 0.999) {
      const inPl = [0, 1, 2].filter(q => q !== kd), spr = (q) => { const v = f.pts.map(p => p[q]); return Math.max(...v) - Math.min(...v); };
      let k = spr(inPl[0]) >= spr(inPl[1]) ? inPl[0] : inPl[1];
      if (spr(k) < 0.5) { const tb = partBox(f.through); k = (tb[inPl[0] + 3] - tb[inPl[0]]) >= (tb[inPl[1] + 3] - tb[inPl[1]]) ? inPl[0] : inPl[1]; }
      a = [0, 1, 2].map(q => q === k ? 1 : 0);
    } else { // a slanted joint: along the run of its points
      let best = 0;
      for (let i = 0; i < f.pts.length; i++) for (let j = i + 1; j < f.pts.length; j++) { const dv = v3.sub(f.pts[j], f.pts[i]), l = v3.len(dv); if (l > best) { best = l; a = dv; } }
      if (!a) continue;
      a = v3.norm(v3.sub(a, v3.mul(dir, v3.dot(a, dir))));
      const big = [0, 1, 2].reduce((b, q) => Math.abs(a[q]) > Math.abs(a[b]) ? q : b, 0);
      if (a[big] < 0) a = v3.mul(a, -1);
    }
    const c = v3.norm(v3.cross(dir, a));
    for (const o of os) {
      const pt = f.pts[o.i], sv = v3.dot(pt, a), tv = v3.dot(pt, c);
      let L = lines.find(l => l.through === f.through && v3.dot(l.dir, dir) > 0.999 && v3.dot(l.a, a) > 0.999 && Math.abs(l.t - tv) < 1);
      if (!L) { L = { through: f.through, dir, a, c, t: tv, holes: [] }; lines.push(L); }
      L.holes.push({ s: sv, key: f.key, seq: o.seq, wood: isWood(f.key) });
    }
  }
  for (const L of lines) L.holes.sort((p, q) => p.s - q.s);
  return lines;
}
// the face a line is drilled from: its extents along a and c, and the plane of the face the fixings enter
function faceFrame(through, dir, a, c) {
  const cs = through.solids.flatMap(pr => C.prismCorners(pr));
  const pa = cs.map(p => v3.dot(p, a)), pc = cs.map(p => v3.dot(p, c)), pd = cs.map(p => v3.dot(p, dir));
  return { s0: Math.min(...pa), s1: Math.max(...pa), t0: Math.min(...pc), t1: Math.max(...pc), d0: Math.min(...pd) };
}
const r05v = (v) => Math.round(v * 2) / 2;
// one chain of dimensions. base(v): the 3D point at chain value v; u: the 3D direction the dimension line stands off in
function drawChain(s, occ, P3, base, u, delta, vals, kinds) {
  if (vals.length < 2) return;
  const b2 = vals.map(v => P3(base(v))), d2 = vals.map(v => P3(v3.add(base(v), v3.mul(u, delta))));
  const ex = [d2[d2.length - 1][0] - d2[0][0], d2[d2.length - 1][1] - d2[0][1]], el = Math.hypot(ex[0], ex[1]);
  if (el < 1.2) return;
  const e = [ex[0] / el, ex[1] / el];
  let n = [-e[1], e[0]];
  const off = [d2[0][0] - b2[0][0], d2[0][1] - b2[0][1]];
  if (n[0] * off[0] + n[1] * off[1] < 0) n = [-n[0], -n[1]];
  const doc = s.doc, YP = (y) => PH - y;
  doc.setLineWidth(0.08); s.color(DIM_RGB);
  vals.forEach((v, i) => {
    const b = b2[i], dd = d2[i], w = [dd[0] - b[0], dd[1] - b[1]], wl = Math.hypot(w[0], w[1]);
    if (wl > 1.2) { const st = [b[0] + w[0] / wl * 0.6, b[1] + w[1] / wl * 0.6]; doc.line(st[0], YP(st[1]), dd[0] + n[0] * 0.7, YP(dd[1] + n[1] * 0.7)); occ.seg(st, dd, 0.15); }
  });
  doc.setLineWidth(0.1);
  doc.line(d2[0][0], YP(d2[0][1]), d2[d2.length - 1][0], YP(d2[d2.length - 1][1]));
  occ.seg(d2[0], d2[d2.length - 1], 0.25);
  doc.setLineWidth(0.18);
  const tk = [(e[0] + n[0]) * 0.5, (e[1] + n[1]) * 0.5];
  for (const dd of d2) doc.line(dd[0] - tk[0], YP(dd[1] - tk[1]), dd[0] + tk[0], YP(dd[1] + tk[1]));
  // equal gaps run together
  const gaps = vals.slice(1).map((v, i) => r05v(v - vals[i])), groups = [];
  gaps.forEach((g, i) => { const last = groups[groups.length - 1]; if (last && Math.abs(last.g - g) < 0.01 && !(kinds && kinds[i] !== kinds[last.i0])) { last.i1 = i + 1; last.n++; } else groups.push({ g, i0: i, i1: i + 1, n: 1 }); });
  const size = 4.5, hh = 1.45, labels = [];
  let clean = true;
  groups.forEach((G, gi) => {
    const txt = G.n > 1 ? `${G.n} × ${fh(G.g)}` : fh(G.g), tw = s.tw(txt, size) + 0.5;
    const A0 = d2[G.i0], A1 = d2[G.i1], L = Math.hypot(A1[0] - A0[0], A1[1] - A0[1]), mid = [(A0[0] + A1[0]) / 2, (A0[1] + A1[1]) / 2];
    // the room the text needs along the dimension line (its projection on e)
    const along = Math.abs(e[0]) * tw + Math.abs(e[1]) * hh, across = Math.abs(n[0]) * tw + Math.abs(n[1]) * hh, out = 0.5 + across / 2;
    const cands = [];
    if (L >= along + 0.6) cands.push({ c: [mid[0] + n[0] * out, mid[1] + n[1] * out], ext: null });
    if (gi === 0) { const q = 0.9 + along / 2; cands.push({ c: [A0[0] - e[0] * q, A0[1] - e[1] * q], ext: A0 }); }
    if (gi === groups.length - 1) { const q = 0.9 + along / 2; cands.push({ c: [A1[0] + e[0] * q, A1[1] + e[1] * q], ext: A1 }); }
    let best = null;
    for (const cd of cands) {
      const box = [cd.c[0] - tw / 2, cd.c[1] - hh / 2, cd.c[0] + tw / 2, cd.c[1] + hh / 2];
      const cost = occ.cost(box[0], box[1], box[2], box[3]) + labels.filter(p => !(box[2] < p.box[0] || box[0] > p.box[2] || box[3] < p.box[1] || box[1] > p.box[3])).length * 50;
      if (!best || cost < best.cost) best = { cost, box, cd, txt, tw };
    }
    if (!best || best.cost > 2 || el < 26) clean = false; // a short chain reads better as one label
    if (best) labels.push(best);
  });
  const ink = () => { doc.setLineWidth(0.08); s.color(DIM_RGB); };
  if (clean) {
    for (const l of labels) {
      if (l.cd.ext) { ink(); const far = [l.cd.c[0] - (l.cd.c[0] - l.cd.ext[0]) * 0.15, l.cd.c[1] - (l.cd.c[1] - l.cd.ext[1]) * 0.15]; doc.line(l.cd.ext[0], YP(l.cd.ext[1]), far[0], YP(far[1])); }
      s.text(l.cd.c[0], l.cd.c[1] - 0.05, l.txt, { size, ha: 'center', va: 'middle', color: DIM_RGB, box: true });
      occ.rect(l.box[0] - 0.2, l.box[1] - 0.2, l.box[2] + 0.2, l.box[3] + 0.2);
    }
    return;
  }
  // no room for a figure on each gap: the chain's figures in one label, in the order they read on the page
  const rev = (Math.abs(e[0]) >= Math.abs(e[1]) && e[0] < 0) || (Math.abs(e[0]) < Math.abs(e[1]) && e[1] > 0);
  const parts = groups.map(G => G.n > 1 ? `${G.n} × ${fh(G.g)}` : fh(G.g));
  const txt = (rev ? parts.reverse() : parts).join('  ·  '), tw = s.tw(txt, size) + 0.6;
  const mid = [(d2[0][0] + d2[d2.length - 1][0]) / 2, (d2[0][1] + d2[d2.length - 1][1]) / 2], across = Math.abs(n[0]) * tw + Math.abs(n[1]) * hh;
  let best = null;
  for (const k of [0, 1, 2, 3, -1]) for (const sl of [0, -0.3, 0.3, -0.6, 0.6]) {
    const dist = k >= 0 ? 0.5 + across / 2 + k * (hh + 0.6) : -(0.5 + across / 2), c = [mid[0] + n[0] * dist + e[0] * el * sl * 0.5, mid[1] + n[1] * dist + e[1] * el * sl * 0.5];
    const box = [c[0] - tw / 2, c[1] - hh / 2, c[0] + tw / 2, c[1] + hh / 2];
    const cost = occ.cost(box[0], box[1], box[2], box[3]) + Math.abs(k) * 1.5 + Math.abs(sl) * 2;
    if (!best || cost < best.cost) best = { cost, c, box };
  }
  // a short leader when the label had to move off the line
  const foot = [best.c[0] - n[0] * (Math.abs(n[0]) * tw + Math.abs(n[1]) * hh) / 2, best.c[1] - n[1] * (Math.abs(n[0]) * tw + Math.abs(n[1]) * hh) / 2];
  const onLine = [mid[0] + e[0] * ((best.c[0] - mid[0]) * e[0] + (best.c[1] - mid[1]) * e[1]), mid[1] + e[1] * ((best.c[0] - mid[0]) * e[0] + (best.c[1] - mid[1]) * e[1])];
  if (Math.hypot(foot[0] - onLine[0], foot[1] - onLine[1]) > 1.6) { ink(); doc.line(onLine[0], YP(onLine[1]), foot[0], YP(foot[1])); }
  s.text(best.c[0], best.c[1] - 0.05, txt, { size, ha: 'center', va: 'middle', color: DIM_RGB, box: true });
  occ.rect(best.box[0] - 0.2, best.box[1] - 0.2, best.box[2] + 0.2, best.box[3] + 0.2);
}
// all the dimensions for one drawn view
function viewDims(s, A, occ) {
  const { sc, P3, scale } = A, d = A.d, lines = holeLines(sc);
  if (!lines.length) return;
  const proj2 = (v) => { const p0 = P3([0, 0, 0]), p1 = P3(v); return [(p1[0] - p0[0]) * scale, (p1[1] - p0[1]) * scale]; }; // paper direction per model mm, x scale
  // the window the view shows: the operation's cut, or the close-up's box
  const lo = A.close ? sc.lo : (sc.op.clip ? [-Infinity, -Infinity, sc.op.clip[0]] : [-Infinity, -Infinity, -Infinity]);
  const hi = A.close ? sc.hi : (sc.op.clip ? [Infinity, Infinity, sc.op.clip[1]] : [Infinity, Infinity, Infinity]);
  // faces: lines on one part, drilled from one side
  const faces = [];
  for (const L of lines) {
    let F = faces.find(q => q.through === L.through && v3.dot(q.dir, L.dir) > 0.999);
    if (!F) { F = { through: L.through, dir: L.dir, lines: [], Dt: sc.offOf(L.through) }; faces.push(F); }
    F.lines.push(L);
  }
  // a face whose lines repeat another face's (the other half, the next strut) is not dimensioned again
  const sig = (F, mir) => F.lines.map(L => { const fr = faceFrame(F.through, L.dir, L.a, L.c); return L.holes.map(h => `${h.key}@${Math.round(mir ? fr.s1 - h.s : h.s - fr.s0)}`).sort().join(',') + `|${Math.round(L.t - fr.t0)}`; }).sort().join(';');
  const done = [];
  for (const F of faces) {
    const sg = sig(F, false), sm = sig(F, true);
    if (done.some(q => q.mark === F.through.mark && (q.sg === sg || q.sg === sm))) continue;
    done.push({ mark: F.through.mark, sg });
    const facing = -v3.dot(d, F.dir);
    if (facing < -0.15) continue; // drilled from the far side in this view
    // lines grouped by direction
    const dirs = [];
    for (const L of F.lines) { let g = dirs.find(q => v3.dot(q.a, L.a) > 0.999); if (!g) { g = { a: L.a, c: L.c, lines: [] }; dirs.push(g); } g.lines.push(L); }
    for (const g of dirs) {
      const fr = faceFrame(F.through, F.dir, g.a, g.c), Dt = F.Dt;
      const X = (sv, tv) => v3.add(v3.add(v3.add(v3.mul(g.a, sv), v3.mul(g.c, tv)), v3.mul(F.dir, fr.d0)), Dt);
      const inside = (p) => p.every((v, q) => v >= lo[q] - 0.5 && v <= hi[q] + 0.5);
      const aP = proj2(g.a), cP = proj2(g.c), nP = proj2(v3.mul(F.dir, -1));
      if (Math.hypot(...aP) < 0.25) continue; // the line runs at the viewer
      const perp = (w) => { const el = Math.hypot(...aP), e = [aP[0] / el, aP[1] / el]; return Math.abs(w[0] * -e[1] + w[1] * e[0]); };
      // lines alike are dimensioned once: the first of each pattern
      const pats = [];
      for (const L of g.lines.slice().sort((p, q) => p.t - q.t)) {
        const key = L.holes.map(h => `${h.key}@${Math.round(h.s - fr.s0)}`).join(',');
        if (!pats.some(p => p.key === key)) pats.push({ key, L });
      }
      const ts = [...new Set(g.lines.map(L => r05v(L.t)))].sort((p, q) => p - q);
      pats.forEach(({ L }) => {
        // chain along the line: the real edges in view, and the holes
        const vals = [], kinds = [];
        const e0 = inside(X(fr.s0, L.t)), e1 = inside(X(fr.s1, L.t));
        if (e0) vals.push(fr.s0);
        for (const h of L.holes) if (!vals.some(v => Math.abs(v - h.s) < 0.25)) vals.push(h.s);
        if (e1) vals.push(fr.s1);
        if (vals.length < 2) return;
        // stand-off: across the face toward its larger side, or square off the face where the face is edge-on
        const roomP = fr.t1 - L.t, roomN = L.t - fr.t0, cands = [];
        cands.push({ u: roomP >= roomN ? g.c : v3.mul(g.c, -1), w: perp(roomP >= roomN ? cP : [-cP[0], -cP[1]]) * 1.15 });
        cands.push({ u: roomP >= roomN ? v3.mul(g.c, -1) : g.c, w: perp(cP) * 0.8 });
        cands.push({ u: v3.mul(F.dir, -1), w: perp(nP) * 0.9 });
        const pick = cands.reduce((p, q) => q.w > p.w ? q : p);
        if (pick.w < 0.15) return;
        // clear of the floating screws and their marks on the main views; tight on a close-up
        const delta = (A.close ? 4 : 6) * scale / Math.max(0.2, pick.w);
        drawChain(s, occ, P3, (v) => X(v, L.t), pick.u, delta, vals);
      });
      // chain across the face, locating the lines, at the edge it starts from
      if (A.close) continue;
      const tvals = [], f0 = inside(X(fr.s0, fr.t0)) || inside(X(fr.s1, fr.t0)), f1 = inside(X(fr.s0, fr.t1)) || inside(X(fr.s1, fr.t1));
      if (f0) tvals.push(fr.t0);
      for (const t of ts) if (!tvals.some(v => Math.abs(v - t) < 0.25)) tvals.push(t);
      if (f1) tvals.push(fr.t1);
      if (tvals.length < 2 || (fr.t1 - fr.t0) / scale < 5) continue;
      if (tvals.length === 3 && Math.abs(tvals[1] - (fr.t0 + fr.t1) / 2) < 0.6 && (fr.t1 - fr.t0) < 60) continue; // one line down the middle of a narrow part
      if (Math.hypot(...cP) < 0.25) continue;
      // at an end of the face, standing off beyond that end, or square off the face where the face is edge-on
      const perpC = (w) => { const el = Math.hypot(...cP), e = [cP[0] / el, cP[1] / el]; return Math.abs(w[0] * -e[1] + w[1] * e[0]); };
      const opts = [{ sE: fr.s0, u: v3.mul(g.a, -1), w: perpC(aP) * 1.1 }, { sE: fr.s1, u: g.a, w: perpC(aP) }, { sE: fr.s0, u: v3.mul(F.dir, -1), w: perpC(nP) * 0.9 }]
        .filter(o => inside(X(o.sE, (fr.t0 + fr.t1) / 2)) || A.close === false);
      const o = opts.reduce((p, q) => q.w > p.w ? q : p, opts[0]);
      if (!o || o.w < 0.15) continue;
      drawChain(s, occ, P3, (v) => X(o.sE, v), o.u, 4.5 * scale / Math.max(0.2, o.w), tvals);
    }
  }
}

// the steps that join plywood, in build order, with their half pages
function detailHalves(M, S) {
  const B = S.build, J = B.joinery, out = [{ kind: 'key' }];
  B.steps.forEach((st, i) => { if (st.joinery && (J.steps[st.joinery] || []).length) out.push({ kind: 'step', key: st.joinery, no: i + 1, st }); });
  return out;
}
const HALVES = [[14, 12, 205, 283], [215, 42, 406, 283]];
function halfHeader(s, x0, yTop, w, no, title, sub) {
  s.circle(x0 + 3.6, yTop - 3.6, 3.6, { fill: ACC, lw: 0 });
  s.text(x0 + 3.6, yTop - 3.7, String(no), { size: no > 9 ? 9 : 10, weight: 'bold', color: WHITE, ha: 'center', va: 'middle' });
  s.text(x0 + 9.5, yTop - 2.9, title.toUpperCase(), { size: 9, weight: 'bold' });
  let y = yTop - 6.6;
  for (const ln of s.wrap(sub, w - 10, 5.9)) { s.text(x0 + 9.5, y, ln, { size: 5.9, color: GREY }); y -= 2.6; }
  return y - 1.2;
}
function halfStep(s, M, S, hv, region) {
  const [X0, Y0, X1, Y1] = region, W = X1 - X0, B = S.build, J = B.joinery, FX = B.FX;
  const insts = J.steps[hv.key], inst = insts.find(i => i.show) || insts[0];
  const sideSg = inst.side === 'L' ? 1 : -1, pref = v3.norm([0.5 * sideSg, 0.78, 0.42]), nI = insts.length;
  const what = { plinth: 'plinth', carcass: 'tower', towerPlinth: 'tower', bedSide: 'bed-cabinet side', drawers: 'drawer box', fronts: 'drawer front' }[hv.key];
  let copies = '';
  if (hv.key === 'drawers' || hv.key === 'fronts') copies = `The right tower's top drawer is shown; ${nI} in all, built the same way, with the screws at the same distances from the box edges.`;
  else if (inst.side) copies = `The right-hand ${what} is shown; the left-hand one is its mirror image.`;
  const keys = [], cnt = {}, all = J.count(hv.key);
  for (const op of inst.ops) for (const f of op.fast) { if (!cnt[f.key]) { cnt[f.key] = 0; keys.push(f.key); } cnt[f.key] += f.pts.length; }
  const hasSeq = inst.ops.some(op => op.fast.some(f => f.seq));
  const legH = keys.length ? 4.4 + keys.length * 3.3 + (hasSeq ? 3.4 : 0) + 2.5 : 0;
  // directions once per operation, then the largest standard scale at which the views and set-out strips fit
  const dirs = [];
  inst.ops.forEach((op, oi) => dirs.push(chooseView(inst, oi, pref, oi ? dirs[oi - 1] : null)));
  const nOp = inst.ops.length, textLines = (op, cw, om) => 1 + Math.min(4, s.wrap((op.setout || '') + (om && om.size ? ' Not shown: ' + [...om].map(partName).join(', ') : ''), cw - 2, 5.1).length);
  const pats = [], flow = null; // set-out strips are replaced by the dimensions on the views
  const sub = (scale) => `${copies ? copies + ' ' : ''}Views at 1:${scale}, in the order of work: the parts going on are orange, pulled back along their joint, and a dashed line runs from each fixing to where it lands. Dimensions run from the edge of the part a fixing goes through, centre to centre: equal gaps are written once (3 × 155), and lines that repeat are dimensioned once.`;
  const headH = 3 + s.wrap(sub(25), W - 10, 5.9).length * 2.6 + 6.6, H = Y1 - Y0;
  const fit = (views, room) => {
    let bestC = null;
    for (let cols = 1; cols <= Math.min(nOp, 5); cols++) {
      const rows = Math.ceil(nOp / cols), gapX = 4, cw = (W - (cols - 1) * gapX) / cols;
      let ok = true, tot = 0;
      for (let r = 0; r < rows && ok; r++) {
        let rh = 0, th = 0;
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c; if (i >= nOp) break;
          if (views[i].w + 14 > cw) ok = false;
          rh = Math.max(rh, views[i].h + 10); th = Math.max(th, textLines(inst.ops[i], cw, views[i].omit) * 2.35 + 3.4);
        }
        tot += rh + th + 3;
      }
      if (ok && tot <= room && (!bestC || tot < bestC.tot)) bestC = { cols, rows, cw, gapX, tot };
    }
    return bestC;
  };
  // the views first, as large as they go; then the strips, if they fit at that scale or one step smaller
  let plan = null;
  for (const sc of STD_SCALES) { const views = stepViews(inst, sc, dirs), c = fit(views, H - headH - legH); if (c) { plan = Object.assign(c, { scale: sc, views, strips: false }); break; } }
  if (!plan) { const sc = 100, views = stepViews(inst, sc, dirs), cols = Math.min(nOp, 3); plan = { cols, rows: Math.ceil(nOp / cols), cw: (W - (cols - 1) * 4) / cols, gapX: 4, scale: sc, views, strips: false, tot: 0 }; }
  if (flow) {
    const i0 = STD_SCALES.indexOf(plan.scale);
    for (const sc of STD_SCALES.slice(Math.max(0, i0), i0 + 3).filter(v => v <= Math.max(50, plan.scale))) {
      const views = sc === plan.scale ? plan.views : stepViews(inst, sc, dirs), c = fit(views, H - headH - legH - flow.h - 5);
      if (c) { plan = Object.assign(c, { scale: sc, views, strips: true }); break; }
    }
  }
  const { scale, views, cols, cw, gapX } = plan;
  let y = halfHeader(s, X0, Y1, W, hv.no, hv.st.title, sub(scale));
  const occ = new Occ(X0 - 8, Y0 - 4, X1 + 8, Y1 + 4, 0.5);
  occ.rect(X0 - 8, y, X1 + 8, Y1 + 4);
  // spare height goes between the rows
  const spare = Math.max(0, (y - Y0) - legH - (plan.strips ? flow.h + 5 : 0) - plan.tot);
  const drawn = [], viewsTop = y;
  for (let r = 0; r < plan.rows; r++) {
    const idx = []; for (let c = 0; c < cols; c++) { const i = r * cols + c; if (i < nOp) idx.push(i); }
    const rh = Math.max(...idx.map(i => views[i].h + 10)) + spare / plan.rows * 0.8;
    const th = Math.max(...idx.map(i => textLines(inst.ops[i], cw, views[i].omit) * 2.35 + 3.4));
    idx.forEach((i, c) => {
      const op = inst.ops[i], x = X0 + c * (cw + gapX);
      s.circle(x + 1.9, y - 1.9, 1.9, { fill: INK, lw: 0 });
      s.text(x + 1.9, y - 1.95, String(i + 1), { size: 6.5, weight: 'bold', color: WHITE, ha: 'center', va: 'middle' });
      const tl = s.wrap(op.title, cw - 6, 6.4, 'bold');
      tl.forEach((ln, k) => s.text(x + 5, y - 1.95 - k * 2.7, ln, { size: 6.4, weight: 'bold', va: 'middle' }));
      const ty = y - 1.95 - (tl.length - 1) * 2.7 - 3.3;
      const om = [...views[i].omit].map(partName).filter((v, k, a) => a.indexOf(v) === k);
      const note = (op.setout ? op.setout.charAt(0).toUpperCase() + op.setout.slice(1) + '.' : '') + (om.length ? ` Not shown: ${om.join(', ')}.` : '');
      s.wrap(note.trim(), cw - 2, 5.1).slice(0, 4).forEach((ln, k) => s.text(x + 1, ty - k * 2.35, ln, { size: 5.1, color: GREY }));
      occ.rect(x, y - th, x + cw, y + 0.5);
      const A = drawOpView(s, views[i], scale, x, y - th - rh, cw, rh, occ);
      viewDims(s, A, occ);
      drawn.push(A);
    });
    y -= th + rh + 3 + spare / plan.rows * 0.2;
  }
  // close-ups of a joint from each operation, at a larger scale, in the room the views leave
  const close = [];
  if (scale >= 5) {
    // close-ups go in clear space: not inside another view's outline either
    const keep = occ.clone();
    for (const A of drawn) keep.rect(A.bbox[0] - 1, A.bbox[1] - 1, A.bbox[2] + 1, A.bbox[3] + 1);
    // one joint for each operation first (those with dowels and several kinds of fixing before the others), then a
    // second joint of a different kind where there is still room
    const cands = [];
    inst.ops.forEach((op, oi) => {
      const seen = new Set(), gs = op.fast.filter(f => !isWood(f.key)).slice().sort((a, b) => b.pts.length - a.pts.length);
      const wood = op.fast.some(f => isWood(f.key)) ? 1 : 0, kinds = new Set(op.fast.map(f => f.key)).size;
      let k = 0;
      for (const f of gs) {
        const sig = `${f.through.mark}|${f.key}`; // the same fixing through the same part looks the same again
        if (seen.has(sig)) continue;
        seen.add(sig);
        cands.push({ oi, f, rank: k++, wood, kinds });
        if (k >= 2) break;
      }
    });
    cands.sort((a, b) => (a.rank - b.rank) || (b.wood - a.wood) || (b.kinds - a.kinds) || (a.oi - b.oi));
    for (const c of cands) {
      if (close.length >= 5) break;
      keep.sums();
      let tries = [2.5, 5, 7.5, 10].filter(v => v <= scale / 2);
      { const cs5 = closeupScene(inst, c.oi, 5, c.f); if (cs5 && cs5.fx.length) { const b5 = opExtent(cs5, dirs[c.oi], new Set()); if ((b5[2] - b5[0]) / 5 >= 32 || (b5[3] - b5[1]) / 5 >= 26) tries = tries.filter(v => v >= 5); } }
      for (const csc of tries) {
        const cs = closeupScene(inst, c.oi, csc, c.f);
        if (!cs || !cs.fx.length) break;
        const d = chooseViewScene(cs, v3.norm(v3.add(pref, dirs[c.oi])), dirs[c.oi]), omit = blockers(cs, d), bx = opExtent(cs, d, omit);
        const w = Math.max(40, (bx[2] - bx[0]) / csc + 20), h = (bx[3] - bx[1]) / csc + 16;
        const cell = drawn[c.oi].cell, spot = findRoom(keep, [X0, y + 2, X1, viewsTop], w, h, 2.2, [cell[0] + cell[2] / 2, cell[1] + cell[3] / 2]);
        if (!spot) continue;
        const letter = String.fromCharCode(97 + close.length);
        s.circle(spot.x + 1.6, spot.y + h - 1.6, 1.6, { lw: 0.2, color: ACC });
        s.text(spot.x + 1.6, spot.y + h - 1.7, letter, { size: 6, weight: 'bold', color: ACC, ha: 'center', va: 'middle' });
        s.text(spot.x + 4.2, spot.y + h - 1.7, `DETAIL OF VIEW ${c.oi + 1}`, { size: 5.4, weight: 'bold', va: 'middle' });
        s.text(spot.x + 4.9 + s.tw(`DETAIL OF VIEW ${c.oi + 1}`, 5.4, 'bold'), spot.y + h - 1.7, `1:${csc}`, { size: 5, color: GREY, va: 'middle' });
        occ.rect(spot.x, spot.y + h - 3.4, spot.x + w, spot.y + h);
        keep.rect(spot.x, spot.y, spot.x + w, spot.y + h);
        const A = drawOpView(s, { sc: cs, d, omit, close: true }, csc, spot.x, spot.y, w, h - 4, occ);
        viewDims(s, A, occ);
        close.push(A);
        // the same joint ringed in the operation's view
        const M0 = drawn[c.oi], pts = [];
        for (const o of cs.focus) { const q = M0.sc.fx.find(x => x.f === o.f && x.i === o.i); if (q) { pts.push(M0.P3(q.ref), M0.P3(q.land)); } }
        if (pts.length) {
          const cx = pts.reduce((a, q) => a + q[0], 0) / pts.length, cy = pts.reduce((a, q) => a + q[1], 0) / pts.length;
          const r = Math.max(2.2, ...pts.map(q => Math.hypot(q[0] - cx, q[1] - cy))) + 1.2;
          s.circle(cx, cy, r, { lw: 0.2, color: ACC, dash: [1, 0.6] });
          const bx2 = cx + r * 0.72 + 1.3, by2 = cy + r * 0.72 + 1.3;
          s.circle(bx2, by2, 1.4, { fill: WHITE, lw: 0.2, color: ACC });
          s.text(bx2, by2 - 0.1, letter, { size: 5.6, weight: 'bold', color: ACC, ha: 'center', va: 'middle' });
          occ.rect(bx2 - 1.5, by2 - 1.5, bx2 + 1.5, by2 + 1.5);
        }
        break;
      }
    }
  }
  for (const A of drawn) annotateOpView(s, A, occ);
  for (const A of close) annotateOpView(s, A, occ);
  // set-out strips
  if (plan.strips) {
    y -= 0.5;
    s.line([X0, X1], [y + 1.4, y + 1.4], { lw: 0.1, color: LIGHT });
    s.text(X0, y - 1, 'SET-OUT', { size: 5.2, weight: 'bold', color: GREY });
    s.text(X0 + 10.5, y - 1, 'Each line of holes as drilled, seen from the head side, with each distance from the edge named at the left, to 0.5 mm.', { size: 4.8, color: GREY });
    s.text(X0 + 10.5, y - 3.2, 'Dark: screw holes and countersinks. Dashed brown: dowel holes in the face against the joint. Dashed grey: the part behind.', { size: 4.8, color: GREY });
    y -= 5.6;
    for (const row of flow.rows) {
      let x = X0;
      for (const it of row.items) { drawSetout(s, it, pats[flow.items.indexOf(it)], x, y); x += it.w + 4; }
      y -= row.h + 1.8;
    }
  }
  // legend
  if (keys.length) {
    let ly = Y0 + legH - 2;
    s.line([X0, X1], [ly + 1.2, ly + 1.2], { lw: 0.1, color: LIGHT });
    s.text(X0, ly - 1.3, 'FIXINGS IN THIS STEP', { size: 5.2, weight: 'bold', color: GREY });
    s.text(X1 - 22, ly - 1.3, 'SHOWN', { size: 5.2, weight: 'bold', color: GREY, ha: 'right' });
    s.text(X1, ly - 1.3, nI > 1 ? `ALL ${nI}` : 'IN ALL', { size: 5.2, weight: 'bold', color: GREY, ha: 'right' });
    ly -= 4.4;
    for (const k of keys) {
      const fx = FX[k] || [k, ''];
      drawLabelChip(s, X0, ly, C.TAGS[k] || k, 5.8);
      let t = `${fx[0]}. ${fx[1].charAt(0).toUpperCase() + fx[1].slice(1)}.`;
      if (s.tw(t, 5.4) > W - 42) { while (t.length > 10 && s.tw(t + '…', 5.4) > W - 42) t = t.slice(0, -1); t = t.replace(/[ ,;.]*$/, '') + '…'; }
      s.text(X0 + 7.5, ly - 0.05, t, { size: 5.4, va: 'middle' });
      s.text(X1 - 22, ly - 0.05, String(cnt[k]), { size: 5.6, va: 'middle', ha: 'right', weight: 'bold' });
      s.text(X1, ly - 0.05, String(all[k] || cnt[k]), { size: 5.6, va: 'middle', ha: 'right' });
      ly -= 3.3;
    }
    if (hasSeq) {
      let x = X0;
      s.text(x, ly - 0.2, 'ORDER', { size: 5.2, weight: 'bold', color: GREY, va: 'middle' }); x += 9;
      for (let q = 1; q <= 2; q++) { seqDot(s, x + 1, ly - 0.2, q); x += 3; }
      s.text(x, ly - 0.2, 'Fixings of one kind go in by their numbers: every 1 first, then the 2s. Glue and dowels go in before the screws.', { size: 5.3, va: 'middle' });
    }
  }
  if (hv.key === 'frame') s.text(X1, Y1 - 3, 'Frame joinery: this design, not the kit plan. Kit plates per the kit.', { size: 5, color: GREY, ha: 'right' });
}
// the fixings drawn full size
function drawFixing2D(s, key, x, yTop) { // head at yTop, pointing down
  const [len, ds, dh, kind] = fxD(key), col = [196, 200, 206], lw = 0.14;
  const rs = ds / 2, rh = dh / 2;
  if (kind === 'csk' || kind === 'pan' || kind === 'brad') {
    let y0 = yTop;
    if (kind === 'csk') { const hc = rh - rs; s.polyFill([[x - rh, yTop], [x + rh, yTop], [x + rs, yTop - hc], [x - rs, yTop - hc], [x - rh, yTop]], { fill: col, lw }); s.line([x - rh * 0.45, x + rh * 0.45], [yTop - 0.35, yTop - 0.35], { lw: 0.25, color: GREY }); y0 = yTop - hc; }
    else if (kind === 'pan') { const hh = dh * 0.38; s.polyFill([[x - rh * 0.8, yTop + hh], [x + rh * 0.8, yTop + hh], [x + rh, yTop + hh * 0.4], [x + rh, yTop], [x - rh, yTop], [x - rh, yTop + hh * 0.4], [x - rh * 0.8, yTop + hh]], { fill: col, lw }); }
    else { s.rect(x - rh, yTop, dh, 0.8, { fill: col, lw }); }
    const tp = kind === 'brad' ? 3 * rs : Math.min(len * 0.3, 2.2 * rs), yt = yTop - len;
    s.polyFill([[x - rs, y0], [x + rs, y0], [x + rs, yt + tp], [x, yt], [x - rs, yt + tp], [x - rs, y0]], { fill: col, lw });
    if (kind !== 'brad') {
      const pitch = ds * 0.42;
      for (let yy = y0 - 1.2; yy > yt + tp * 0.4; yy -= pitch) { const ww = yy < yt + tp ? rs * (yy - yt) / tp : rs; s.line([x - ww, x + ww], [yy, yy - pitch * 0.45], { lw: 0.08, color: GREY }); }
    }
    return;
  }
  if (kind === 'dowel') {
    const r = 4, ch = 0.8;
    s.polyFill([[x - r + ch, yTop], [x + r - ch, yTop], [x + r, yTop - ch], [x + r, yTop - 30 + ch], [x + r - ch, yTop - 30], [x - r + ch, yTop - 30], [x - r, yTop - 30 + ch], [x - r, yTop - ch], [x - r + ch, yTop]], { fill: [214, 170, 112], lw });
    for (const dx of [-2.2, 0, 2.2]) s.line([x + dx, x + dx], [yTop - 1.4, yTop - 28.6], { lw: 0.08, color: [140, 96, 50] });
    return;
  }
  if (kind === 'dom') {
    s.rect(x - 11, yTop - 40, 22, 40, { fill: [214, 170, 112], lw });
    for (let yy = yTop - 3; yy > yTop - 39; yy -= 3) s.line([x - 10.2, x + 10.2], [yy, yy], { lw: 0.06, color: [150, 106, 60] });
  }
}
function halfKey(s, M, S, region, hv, info) {
  const [X0, Y0, X1, Y1] = region, W = X1 - X0, B = S.build, J = B.joinery;
  const inDet = new Set();
  for (const k of Object.keys(J.steps)) for (const i of J.steps[k]) for (const op of i.ops) for (const f of op.fast) inDet.add(f.key);
  const order = ['s50', 's30', 's25', 's20', 'b25', 'h15', 'r10', 'w75', 'm4', 'm4s', 'd8'];
  const used = order.filter(k => B.fixings.some(f => f.key === k));
  s.text(X0, Y1 - 3.5, 'FIXINGS KEY, FULL SIZE', { size: 9, weight: 'bold' });
  s.para(X0, Y1 - 8, s.wrap(`Every fixing in this design at 1:1, with the tag used in the assembly details on sheets ${info.detFrom}-${info.detFrom + info.nDet - 1}. Lay a screw on its outline to check it. Counts are for the whole build; the schedule on sheet ${info.fixAt} adds spares.`, W, 6), { size: 6, color: GREY });
  const rowA = used.filter(k => ['csk', 'pan'].includes(fxD(k)[3])), rowB = used.filter(k => !['csk', 'pan'].includes(fxD(k)[3]));
  const drawRow = (keys, yTop, maxLen) => {
    const ws = keys.map(k => Math.max(fxD(k)[3] === 'dom' ? 24 : fxD(k)[2] + 2, s.tw(FX_SIZE[k] || k, 5.4) + 1.5));
    const tot = ws.reduce((a, b) => a + b, 0), gap = keys.length > 1 ? Math.min(6, (W - tot) / (keys.length - 1)) : 0;
    let x = X0;
    keys.forEach((k, i) => {
      const cx = x + ws[i] / 2, D = fxD(k), headUp = D[3] === 'pan' ? D[2] * 0.38 : D[3] === 'brad' ? 0.8 : 0;
      drawFixing2D(s, k, cx, yTop - headUp);
      const yl = yTop - maxLen - 4;
      drawLabelChip(s, cx - (s.tw(C.TAGS[k] || k, 6.4, 'bold') + 1.4) / 2, yl, C.TAGS[k] || k, 6.4);
      s.text(cx, yl - 3.6, FX_SIZE[k] || k, { size: 5.4, ha: 'center' });
      const q = (B.fixings.find(f => f.key === k) || {}).qty;
      if (q) s.text(cx, yl - 6.1, `${q} in all`, { size: 5, ha: 'center', color: GREY });
      if (!inDet.has(k)) s.text(cx, yl - 8.4, { w75: 'into the studs', h15: 'all hardware', m4: 'handles', m4s: 'handles, 12 mm' }[k] || 'hardware', { size: 4.6, ha: 'center', color: GREY });
      x += ws[i] + gap;
    });
  };
  const lenA = Math.max(...rowA.map(k => fxD(k)[0] + (fxD(k)[3] === 'pan' ? fxD(k)[2] * 0.38 : 0)), 10);
  let y = Y1 - 18;
  if (rowA.length) { drawRow(rowA, y, lenA); y -= lenA + 16; }
  const lenB = Math.max(...rowB.map(k => fxD(k)[0]), 10);
  if (rowB.length) { drawRow(rowB, y, lenB); y -= lenB + 16; }
  s.text(X0, y, 'READING THE ASSEMBLY DETAILS', { size: 7, weight: 'bold' });
  y -= 5;
  const sw = (yy, draw, txt) => { draw(X0 + 6, yy); const ls = s.wrap(txt, W - 16, 5.8); ls.forEach((ln, k) => s.text(X0 + 14, yy - k * 2.6, ln, { size: 5.8, va: 'middle' })); return yy - Math.max(1, ls.length) * 2.6 - 1.6; };
  y = sw(y, (x, yy) => { s.rect(x - 5, yy - 1.5, 4.5, 3, { fill: PART_NEW, lw: 0.1 }); s.rect(x, yy - 1.5, 4.5, 3, { fill: PART_OLD, lw: 0.1 }); }, 'Orange: the parts going on in that view, pulled back along their joint. Light: parts already fixed. Grey outline: neighbouring parts, for reference. A part that would hide the screws is left out and named under the view.');
  y = sw(y, (x, yy) => { s.line([x - 5, x + 3.6], [yy, yy], { lw: 0.1, dash: [0.75, 0.5] }); s.circle(x + 4.4, yy, 0.45, { fill: HOLE, lw: 0 }); }, 'Dashed: the line a fixing travels, from its tip through the clearance hole to its pilot hole in the next part. Dark dots: holes, at their true positions; a ring marks one hidden behind a part.');
  y = sw(y, (x, yy) => { [1, 2, 3].forEach((q, k) => seqDot(s, x - 3.5 + k * 3, yy, q)); }, 'Numbers: the order for fixings of one kind: all the 1s, then the 2s. The screws are coloured to match. A run numbered 1 to 12 goes in in that order.');
  y = sw(y, (x, yy) => { drawLabelChip(s, x - 4.5, yy, 'A', 6); s.text(x - 0.6, yy - 0.05, '×8', { size: 6, va: 'middle' }); }, 'Tags: the fixing (key above) and how many go in, in that view, on the copy drawn.');
  y = sw(y, (x, yy) => {
    const xs = [x - 5, x - 2.4, x + 0.2, x + 2.8, x + 4.6];
    s.line([xs[0], xs[4]], [yy - 0.8, yy - 0.8], { lw: 0.1, color: DIM_RGB });
    for (const xx of xs) s.line([xx - 0.35, xx + 0.35], [yy - 1.15, yy - 0.45], { lw: 0.18, color: DIM_RGB });
    s.text(x - 0.3, yy + 0.7, '3 × 26', { size: 4.5, ha: 'center', va: 'middle', color: DIM_RGB });
  }, 'Dimensions: a chain along each line of holes, from the edge of the part the fixing goes through, centre to centre, to the other edge; equal gaps are written once (3 × 155 is three gaps of 155). A second chain across the face places each line from the edges. Lines and parts that repeat are dimensioned once. All to 0.5 mm.');
  sw(y, () => {}, 'Every view is to the scale on its half page and every hole is where the design puts it. Fixings are drawn at their true length; at small scales their thickness is drawn up to 0.3 mm on paper so they stay visible.');
}
function pagesDetails(doc, M, S, info) {
  const halves = info.halves;
  for (let k = 0; k < info.nDet; k++) {
    const s = Sheet(doc, info.detFrom + k, info.total, `ASSEMBLY DETAILS ${k + 1}`, 'as noted', info);
    s.line([210, 210], [12, 285], { lw: 0.15, color: LIGHT });
    for (let h = 0; h < 2; h++) {
      const hv = halves[2 * k + h];
      if (!hv) continue;
      if (hv.kind === 'key') halfKey(s, M, S, HALVES[h], hv, info);
      else halfStep(s, M, S, hv, HALVES[h]);
    }
    s.finish();
  }
}

/* ------------------------------------------------------------------ make */
async function make(model, summary, progress) {
  progress = progress || (() => {});
  const { jsPDF } = root.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3', compress: true });
  const P = model.P;
  const nPlans = Math.ceil(summary.sheets.reduce((a, q) => a + q.bins.length, 0) / 8) || 0;
  const halves = detailHalves(model, summary), nDet = Math.ceil(halves.length / 2);
  const info = { project: 'Murphy wardrobe', date: new Date().toISOString().slice(0, 10), total: 11 + nPlans + nDet, plansFrom: 8, plansTo: 7 + nPlans, seqFrom: 8 + nPlans,
    detFrom: 10 + nPlans, nDet, halves, fixAt: 10 + nPlans + nDet, detSheet: {} };
  halves.forEach((hv, i) => { if (hv.key) info.detSheet[hv.key] = info.detFrom + Math.floor(i / 2); });
  const tick = () => new Promise(r => setTimeout(r, 15));
  progress('Rendering views...', 0.1); await tick();
  const I = {};
  let R = null;
  try {
    R = new V.VectorRenderer();
    R.setModel(model);
    I.hero = R.iso(-28, 14, 1400, 1400 * 0.82, { bed: 0 });
    progress('Rendering views...', 0.2); await tick();
    I.open = R.iso(-35, 20, 1100, 760, { bed: 90, open: 1, mattress: true });
    await tick();
    I.thick = R.iso(-28, 14, 1000, 760, { bed: 0, fronts: false, bySheet: true, mattress: false, hw: false });
    await tick();
    I.cut = R.iso(-40, 12, 1400, 900, { bed: 50 });
    await tick();
    // build sequence: everything fitted so far, this step's parts in the accent colour
    const B = summary.build;
    I.steps = [];
    for (let i = 0; i < B.steps.length; i++) {
      const st = B.steps[i];
      if (i < 4) { I.steps.push(null); continue; }
      const isNew = (p) => B.stepOf(p) === i || (st.hl && st.hl(p));
      I.steps.push(R.iso(-30, 16, 600, 500, { bed: st.bed || 0, open: st.open || 0, mattress: true, hw: true, fitAll: true,
        only: (p) => B.stepOf(p) <= i,
        colourOverride: (p, ms) => isNew(p) ? ms.mat(p.hw ? 'step-new-hw' : 'step-new', { color: p.hw ? 0x8a4a06 : 0xe0954a, rough: 0.7 })
          : p.hw ? null : ms.mat('step-old', { color: 0xe4dfd6, rough: 0.9 }) }, 1.02));
      progress('Rendering the build steps...', 0.2 + 0.12 * i / B.steps.length); await tick();
    }
  } catch (e) {
    console.warn('3D renders unavailable', e);
    const blank = (w, h) => ({ px: [w, h], polys: [] });
    I.hero = blank(1400, 1148); I.open = blank(1100, 760); I.thick = blank(1000, 760); I.cut = null;
  }
  if (R) R.dispose();
  // the plans fit 8 per page (the 9th slot is under the title block)
  progress('Drawing sheet 1...', 0.35); await tick();
  pageOverview(doc, model, summary, I, info);
  progress('Drawing elevations...', 0.45); await tick();
  pageElevations(doc, model, summary, I, info);
  progress('Drawing sections...', 0.55); await tick();
  const M90 = C.build(P, { bedAngle: 90 }), M45 = C.build(P, { bedAngle: 45 });
  pageSections(doc, model, M90, M45, summary, info);
  progress('Drawing the bed frame...', 0.65); await tick();
  pageBed(doc, model, summary, info);
  progress('Hardware positions...', 0.7); await tick();
  pageHardware(doc, model, summary, info);
  progress('Clearances...', 0.74); await tick();
  pageClearances(doc, model, M45, M90, summary, info);
  progress('Cut list...', 0.78); await tick();
  pageCutList(doc, model, summary, info);
  progress('Cutting plans...', 0.85); await tick();
  pagesPlans(doc, model, summary, info, 8);
  progress('Build sequence...', 0.9); await tick();
  pageSequence(doc, model, summary, I, info, 0);
  pageSequence(doc, model, summary, I, info, 1);
  progress('Assembly details...', 0.92); await tick();
  pagesDetails(doc, model, summary, info);
  pageFixings(doc, model, summary, info);
  progress('Design review...', 0.95); await tick();
  pageReview(doc, model, summary, info);
  doc.setProperties({ title: 'Murphy wardrobe drawings', subject: `${P.W} x ${P.H} x ${P.D} cavity`, creator: 'Murphy Wardrobe Builder' });
  return doc;
}

root.MurphyDrawings = { make };
})(typeof window !== 'undefined' ? window : globalThis);
