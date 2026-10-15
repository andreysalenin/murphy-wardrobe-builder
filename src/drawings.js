/* A3 drawing set (jsPDF). Paper coordinates are mm with y UP from the bottom-left
   corner of the sheet; the helpers flip to jsPDF's y-down. Views are drawn as vectors
   from the part solids (painter's order with opaque fills), so they stay crisp. */
(function (root) {
'use strict';
const C = root.MurphyCore, V = root.MurphyViewer;
const PW = 420, PH = 297;
const INK = [27, 29, 33], GREY = [107, 114, 128], LIGHT = [205, 208, 212], FAINT = [240, 238, 233], WHITE = [255, 255, 255];
const ACC = [176, 98, 10], BAD = [176, 40, 31];
const FILL = {
  carcass: [244, 236, 221], front: [252, 249, 243], frame: [235, 220, 196], deck: [240, 228, 207], drawer: [248, 241, 228], back: [236, 228, 214],
  plinth: [230, 220, 203], packer: [222, 199, 166], ledge: [244, 236, 221], mattress: [238, 240, 242], metal: [74, 78, 84], chrome: [190, 194, 199], zinc: [178, 184, 192],
  block: [181, 136, 92], rubber: [40, 40, 42], strap: [70, 86, 124],
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
        const pts = hull(cs.map(pr.uv)).map(v.Puv);
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
  s.image(I.hero.url, 14, 289 - 6 - hh, hw, hh);
  s.text(16, 289 - 9, 'Closed, from the front left', { size: 6, color: GREY });
  const ow = 132, oh = ow * I.open.px[1] / I.open.px[0];
  s.image(I.open.url, 14, 12, ow, oh);
  s.text(16, 12 + oh + 2, 'Bed down, fronts open', { size: 6, color: GREY });
  const tw = 108, th = tw * I.thick.px[1] / I.thick.px[0];
  s.image(I.thick.url, 150, 12, tw, th);
  s.text(152, 12 + th + 2, 'Fronts off, coloured by sheet thickness', { size: 6, color: GREY });
  [[6, '6 mm'], [12, '12 mm'], [18, '18 mm']].forEach(([t, l], i) => { s.rect(153 + i * 18, 15, 3, 3, { fill: T_RGB[t], lw: 0 }); s.text(157.5 + i * 18, 15.6, l, { size: 5.6 }); });
  const x0 = 232;
  s.text(x0, 274, 'Murphy wardrobe', { size: 21, weight: 'bold' });
  s.text(x0, 265.5, `${f0(P.W)} x ${f0(P.H)} x ${f0(P.D)} cavity, Create-A-Bed vertical queen`, { size: 9.5, color: GREY });
  const desc = `Two plywood towers either side of a fold-down queen bed. Each tower has ${P.drawers.length} drawers, a ${f0(P.hangClear)} hanging space and a top compartment${P.topShelf ? ' with an adjustable shelf' : ''}, behind outside-hinged doors. Above the bed, two lift-up flaps close a ${f0(G.antClear)} high shelf space. The bed turns about the kit's pivots, ${f0(G.pivot[1])} above the floor.`;
  let y = s.para(x0, 257, s.wrap(desc, 172, 7), { size: 7 });
  const st = S.sheets;
  const rows = [
    ['Cavity (W x H x D)', `${f0(P.W)} x ${f0(P.H)} x ${f0(P.D)}`],
    ['Mattress', `${f0(P.mW)} x ${f0(P.mL)} x ${f0(P.mT)}`],
    ['Bed bay, clear', `${f0(G.bayIn)} between the bed-cabinet sides`],
    ['Bed frame', `${f0(G.frameW)} x ${f0(G.frameL)}, face panel ${P.T} mm in two halves`],
    ['Pivot', `${f0(G.pivot[1])} above the floor, ${f0(G.pivotBehindFace)} behind the face`],
    ['Bed down', `reaches ${f0(G.clear.open.reach)} from the wall, mattress top ${f0(G.clear.open.mattTop)}`],
    ['Tower, inside', `${f0(G.towerIn)} wide x ${f0(G.cD)} deep`],
    ['Drawers', `${P.drawers.length} per tower, fronts ${P.drawers.map(f0).join(' / ')}, ${G.runner} runners`],
    ['Hanging / top', `${f0(P.hangClear)} / ${f0(G.topClear)} clear`],
    ['Fronts', `${P.T} mm, ${f0(P.gap)} mm reveals, overlay ${f0(P.T - P.gap)} on the sides`],
    ['Plywood', st.filter(q => q.used).map(q => `${q.T} mm: ${isFinite(q.need) ? q.need : '?'} of ${q.have}`).join(', ')],
    ['Plywood mass', `about ${S.massPly.toFixed(0)} kg (bed frame ${S.massBed.toFixed(0)} kg)`],
  ];
  y -= 2;
  const yb = s.table(x0, y, [['KEY DATA', 46, 'left'], ['', 126, 'left']], rows, { rowH: 4.6, size: 6.4, hsize: 6 });
  let yy = yb - 8;
  s.text(x0, yy, 'IN THIS SET', { size: 7.5, weight: 'bold' });
  yy = s.para(x0, yy - 5, [`1 Overview   2 Elevations and plans   3 Sections and the bed swing   4 Bed frame`,
    `5 Hardware positions   6 Cut list   ${info.plansFrom}-${info.plansTo} Cutting plans   ${info.total} Design review`], { size: 6.2 });
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
      s.image(I.cut.url, x0 + (176 - w) / 2, bottom + (h - hh2) / 2, w, hh2);
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
    const txt = p.mark === 'F1' ? (p.name.endsWith('(L)') ? `F1  bed face\n${f0(G.frameW)} x ${f0(G.faceL)}` : null) : `${p.mark}\n${f0(p.W)} x ${f0(p.L)}`;
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
  v1.dimAt([-G.xFo, 0, 0], [G.xFo, 0, 0], yb - 12, 'h', `${f0(G.frameW)} bed face`, { size: 5.6 });

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
  v3.dimAt([G.xA, G.yB1, 0], [G.xA, G.yC, 0], xd, 'v', null, { size: 5.2 });
  v3.dimAt([G.xA, 0, 0], [G.xA, P.D, 0], xd - 5, 'v', null, { size: 5.2 });
  s.text(ox, pb - 48, `Depth: ${f0(P.backGap)} to the wall, ${f0(P.Tback)} back, ${f0(G.cD)} carcass, ${f0(P.frontGap)} + ${f0(P.T)} front.`, { size: 5.6, color: GREY });
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
  s.heading(tx - 30, 248, 'FRONTS', `${P.T} mm, ${f0(P.T - P.gap)} overlay`);
  const fr = S.cut.filter(r => r.mark[0] === 'D' || r.mark === 'F1' || r.mark[0] === 'K');
  const rows = fr.map(r => [r.mark, f0(r.L) + ' x ' + f0(r.W), r.qty, r.mark.startsWith('D1') || r.mark.startsWith('D2') ? (P.doorHinge === 'outer' ? 'wall edge' : 'bed edge') : r.mark.startsWith('D4') ? 'top edge' : '']);
  s.table(tx - 30, 238, [['MARK', 12, 'left'], ['H x W', 24, 'left'], ['QTY', 9, 'right'], ['HINGED', 20, 'left']], rows, { rowH: 4.3, size: 5.8, hsize: 5.4 });
  s.finish();
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
  s.leader(v.P([0, G.yFb - 20, G.zF1]), [v.P([0, 0, 0])[0] + 70, v.P([0, 0, G.zF1 + 140])[1]], `${f0(P.gapHolder)} under the shelf${G.steel ? `, ${f0(G.zF1 - (G.zBm1 - P.steelH) < 0 ? 0 : G.steel.z0 - G.zF1)} under the steel flat in its front edge` : ''}; the bed top rises ${Math.max(0, G.clear.maxZ - G.zF1).toFixed(1)} as it turns`, { size: 5.6, box: true, ha: 'left' });
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
  [[0, G.yB0], [G.yB0, G.yB1], [G.yB1, G.yC], [G.yC, G.yFb], [G.yFb, G.yF]].forEach(([a, b], i) => v2.dimAt([0, a, P.H], [0, b, P.H], ztt, 'h', null, { size: 5, side: i === 0 ? 'start' : i >= 3 ? 'end' : undefined }));
  const f1 = G.fronts[0];
  v2.dimAt([0, G.yC - G.runner, f1.z0], [0, G.yC, f1.z0], v2.P([0, 0, f1.z0])[1] - 3, 'h', `${G.runner} runners`, { size: 5 });
  v2.levels(v2.P([0, P.D, 0])[0] + 4, [G.zPl + P.T, G.zS1b, G.zS1t, G.zRail, G.zS2b, G.zS2t, G.zTopB], { size: 5.4 });
  s.text(v2.P([0, (G.yB1 + G.yC) / 2, G.zRail])[0], v2.P([0, 0, G.zRail])[1] - 4, 'rail', { size: 5, ha: 'center', color: GREY });

  // clearance table
  const cx = 292;
  s.heading(cx, 262, 'SWING CLEARANCES', 'closest approach while the bed turns 0 to 90 deg');
  const rows = G.clear.list.filter(r => r.name !== 'back wall').map(r => [r.name, r.part, f0(r.angle) + ' deg', (r.min < 0 ? 'CLASH ' : '') + f0(r.min)]);
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
  vd.parts(M.parts.filter(p => !p.leg), { cut: G.pivot[1], filter: (p) => !p.hw || p.mattress || ['PV', 'BS', 'GS'].includes(p.mark), window: win });
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
  const pts = [['pivot', G.pivot, '11-3/4 in, 4-3/4 in'], ['upper ball stud', G.springCab, '30-3/4 in, 10 in'], ['bed stop', G.stop, '6 in below the 87-1/8 in top, 7-3/8 in']];
  const xR = v.P([0, yE, 0])[0] + 6;
  pts.forEach(([name, q], i) => {
    const pq = v.Puv([q[0], q[1]]);
    s.circle(pq[0], pq[1], 1.3, { fill: ACC, lw: 0 });
    v.dimAt([0, q[0], q[1]], [0, yE, q[1]], pq[1] + (i === 2 ? -7.5 : 7.5), 'h', fh(yE - q[0]), { size: 5.4, color: ACC });
    v.dimAt([0, G.yB1, 0], [0, G.yB1, q[1]], v.P([0, G.yB1, 0])[0] - 5 - i * 6, 'v', fh(q[1]), { size: 5.4, color: ACC });
    s.text(xR, pq[1], name, { size: 5.6, va: 'middle', weight: 'bold' });
    s.text(xR, pq[1] - 3, `kit: ${pts[i][2]}`, { size: 5, va: 'middle', color: GREY });
  });
  v.dimAt([0, G.yB1, G.zBm0], [0, yE, G.zBm0], v.P([0, 0, G.zBm0])[1] + 4, 'h', null, { size: 5.4 });
  s.text(ox - 18, 276, 'BED-CABINET SIDE B1  1:10', { size: 7.5, weight: 'bold' });
  s.para(ox - 18, 272, s.wrap(`From inside the bay; front edge on the right. Heights from the floor. Depths from B1's front edge, not the kit's numbers: the bed face stands ${fh(G.yF - yE)} mm proud of the carcass here. ${P.packer ? 'Plates screw to the ' + fh(P.Tpacker) + ' mm packers (shaded).' : ''}`, 92, 5.4), { size: 5.4, color: GREY });

  // 2. tower door, inside face: hinge cups
  const dx = 150, sd = 10, dy = 250 - Math.max(G.midDoor[1] - G.midDoor[0], G.topDoor[1] - G.topDoor[0]) / sd;
  const door = (z0, z1, x0, label) => {
    const w = G.doorW / sd, h = (z1 - z0) / sd, inner = P.doorHinge === 'inner';
    s.rect(x0, dy, w, h, { fill: FILL.front, lw: LW_VIS });
    const ex = inner ? x0 + w : x0; // seen from inside, the hinge edge flips
    const cx = inner ? ex - G.hingeDoor.cup / sd : ex + G.hingeDoor.cup / sd;
    for (const z of C.hingeZs([z0, z1])) { const cy = dy + (z - z0) / sd; s.circle(cx, cy, 17.5 / sd, { lw: 0.25, fill: WHITE }); s.line([cx - 2.6, cx + 2.6], [cy, cy], { lw: 0.08 }); }
    const hz = C.hingeZs([z0, z1]);
    s.dim([ex, dy + (hz[0] - z0) / sd], [cx, dy + (hz[0] - z0) / sd], dy - 4, 'h', fh(G.hingeDoor.cup), { size: 5 });
    let prev = z0;
    hz.concat([z1]).forEach((z, k) => { s.dim([x0 + w, dy + (prev - z0) / sd], [x0 + w, dy + (z - z0) / sd], inner ? x0 - 4 : x0 + w + 4, 'v', fh(z - prev), { size: 5 }); prev = z; });
    s.text(x0 + w / 2, dy + h + 3, label, { size: 6, ha: 'center', weight: 'bold' });
  };
  door(G.midDoor[0], G.midDoor[1], dx, `D2  ${fh(G.doorW)} x ${fh(G.midDoor[1] - G.midDoor[0])}`);
  door(G.topDoor[0], G.topDoor[1], dx + 58, `D1  ${fh(G.doorW)} x ${fh(G.topDoor[1] - G.topDoor[0])}`);
  s.text(dx - 6, 276, 'TOWER DOORS, INSIDE FACE  1:10', { size: 7.5, weight: 'bold' });
  const HD = G.hingeDoor, HF = G.hingeFlap;
  s.para(dx - 6, 272, s.wrap(`${C.HINGE_HW.name}. 35 mm cups bored 13 deep, centres ${fh(HD.cup)} from the ${P.doorHinge === 'outer' ? 'wall' : 'bed'}-side edge (${fh(HD.B)} mm boring distance), screw holes 45 apart and 9.5 further in. ${HD.H} mm CLIP cruciform plates (${HD.code}) on the side panel, holes 37 back from its front edge and 32 apart, at the cup heights: ${fh(HD.overlay)} overlay. Flaps: ${HF.H} mm plates (${HF.code}) under the top, cups ${fh(HF.cup)} below the top edge. Right-hand tower shown; the left is a mirror image.`, 104, 5.4), { size: 5.4, color: GREY });

  // 3. runner lines on a tower side, from inside (front edge on the right)
  {
    const sr = 10, rx = dx + 8, rz = 40, NL = G.runner, holes = C.runnerHoles(NL), zIn = G.zPl + P.T, zs = G.runnerZ || [];
    const vr = View(s, 'side', sr, [rx, rz], [G.yB1, zIn]);
    const [p0, p1] = [vr.Puv([G.yB1, zIn]), vr.Puv([G.yC, G.zS1b])];
    s.rect(p0[0], p0[1], p1[0] - p0[0], p1[1] - p0[1], { fill: FILL.carcass, lw: LW_VIS });
    for (const z of zs) {
      const a = vr.Puv([G.yC - NL, z - C.RUNNER_HW.h / 2]), b = vr.Puv([G.yC, z + C.RUNNER_HW.h / 2]);
      s.rect(a[0], a[1], b[0] - a[0], b[1] - a[1], { fill: FILL.zinc, lw: 0.12, color: [40, 42, 46] });
      for (const h of holes) { const q = vr.Puv([G.yC - h, z]); s.circle(q[0], q[1], 0.35, { fill: INK, lw: 0 }); }
    }
    let prev = zIn;
    zs.forEach((z, i) => { vr.dimAt([0, G.yB1, prev], [0, G.yB1, z], p0[0] - 4, 'v', fh(z - prev), { size: 4.8 }); prev = z; });
    if (zs.length) {
      const zb = zs[0];
      vr.dimAt([0, G.yC - holes[0], zb], [0, G.yC, zb], p0[1] - 4, 'h', fh(holes[0]), { size: 4.6, side: 'over' });
      vr.dimAt([0, G.yC - holes[holes.length - 1], zb], [0, G.yC, zb], p0[1] - 9, 'h', fh(holes[holes.length - 1]), { size: 4.8 });
      vr.dimAt([0, G.yC - NL, zb], [0, G.yC, zb], p0[1] - 14, 'h', `${fh(NL)} runner`, { size: 4.8 });
    }
    s.text(dx - 6, 134, `DRAWER RUNNERS, TOWER SIDE FROM INSIDE  1:${sr}`, { size: 7.5, weight: 'bold' });
    s.para(dx - 6, 130, s.wrap(`${C.RUNNER_HW.name} ${NL}, full extension, ${C.RUNNER_HW.load} kg, ${C.RUNNER_HW.h} x ${C.RUNNER_HW.w}, a pair per drawer, cabinet members flush with the front edge on the centre lines shown (heights above the tower bottom). Holes from the front edge: ${holes.join(', ')}; screw at least the first, a middle one and the last. Needs ${NL + C.RUNNER_HW.kt} inside the carcase (${fh(G.cD)} here) and ${C.RUNNER_HW.w} each side of the box.`, 104, 5.4), { size: 5.4, color: GREY });
  }

  // 3. shelf over the bed from above: pins, latches, stays, flap hinges
  const sp = 12, px0 = 258, py0 = 250;
  const vp = View(s, 'top', sp, [px0 + G.xJ / sp, py0], [0, 0]);
  vp.parts(M.parts.filter(p => !p.leg && !p.mattress && !p.bed), { cut: G.zBm1 + 70, filter: (p) => ['B2', 'B4', 'B5', 'T2', 'LP', 'PL', 'FS', 'D4', 'SF'].includes(p.mark) || (p.mark === 'FH' && p.name.endsWith('plate')) });
  const yB = vp.P([0, G.yC, 0])[1] - 6;
  if (P.lockType === 'twin') {
    const hs = P.twinSpacing / 2;
    vp.dimAt([-hs, G.pinY, 0], [hs, G.pinY, 0], yB, 'h', `${fh(2 * hs)} pins`, { size: 5.4 });
    vp.dimAt([-hs, G.pinY, 0], [-hs, G.yC, 0], vp.P([-hs, 0, 0])[0] + 6, 'v', fh(G.yC - G.pinY), { size: 5 });
  }
  if (P.lockType === 'pins') {
    vp.dimAt([-P.lockPinX, G.pinY, 0], [P.lockPinX, G.pinY, 0], yB, 'h', `${fh(2 * P.lockPinX)} pins`, { size: 5.4 });
    vp.dimAt([-P.lockPinX, G.pinY, 0], [-P.lockPinX, G.yC, 0], vp.P([-P.lockPinX, 0, 0])[0] + 6, 'v', fh(G.yC - G.pinY), { size: 5 });
  }
  vp.dimAt([-G.flapHw.latch, G.yC, 0], [G.flapHw.latch, G.yC, 0], yB - 6, 'h', `${fh(2 * G.flapHw.latch)} latches`, { size: 5.4 });
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
    vq.dimAt([0, G.pinY, G.zBm1], [0, G.yC, G.zBm1], vq.P([0, 0, G.zBm1 + tw.block[2] + 10])[1], 'h', fh(G.yC - G.pinY), { size: 5.4 });
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
    vq.dimAt([0, G.pinY, G.zBm1], [0, G.yC, G.zBm1], vq.P([0, 0, G.zBm1 + 60])[1], 'h', fh(G.yC - G.pinY), { size: 5.4 });
    s.text(qx, b[1] + 8, 'SAFETY PIN  1:2', { size: 7.5, weight: 'bold' });
    s.para(qx, b[1] + 4, s.wrap(`10 mm pin through a bush in the shelf and a hardwood block, ${P.lockDepth} mm into a steel bush in the foot rail. Lift both pins (behind the flaps) before lowering the bed.`, 130, 5.2), { size: 5.2, color: GREY });
  }
  s.finish();
}

function pageCutList(doc, M, S, info) {
  const { P } = M;
  const s = Sheet(doc, 6, info.total, 'CUT LIST', '-', info);
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
  let yy = Math.max(70, 22 + C.SOURCES.length * 7.2);
  s.heading(14, yy, 'SOURCES');
  yy -= 6;
  for (const [t, u] of C.SOURCES) { s.text(14, yy, t, { size: 6.4 }); s.text(14, yy - 3, u, { size: 5.6, color: GREY }); yy -= 7.2; }
  s.finish();
}

/* ------------------------------------------------------------------ make */
async function make(model, summary, progress) {
  progress = progress || (() => {});
  const { jsPDF } = root.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3', compress: true });
  const P = model.P;
  const nPlans = Math.ceil(summary.sheets.reduce((a, q) => a + q.bins.length, 0) / 8) || 0;
  const info = { project: 'Murphy wardrobe', date: new Date().toISOString().slice(0, 10), total: 7 + nPlans, plansFrom: 7, plansTo: 6 + nPlans };
  const tick = () => new Promise(r => setTimeout(r, 15));
  progress('Rendering views...', 0.1); await tick();
  const I = {};
  let R = null;
  try {
    R = new V.PrintRenderer();
    R.setModel(model);
    I.hero = R.iso(-28, 14, 1400, 1400 * 0.82, { bed: 0 });
    progress('Rendering views...', 0.2); await tick();
    I.open = R.iso(-35, 20, 1100, 760, { bed: 90, open: 1, mattress: true });
    I.thick = R.iso(-28, 14, 1000, 760, { bed: 0, fronts: false, bySheet: true, mattress: false, hw: false });
    I.cut = R.iso(-40, 12, 1400, 900, { bed: 50 });
  } catch (e) {
    console.warn('3D renders unavailable', e);
    const blank = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.fillStyle = '#999'; g.font = '28px sans-serif'; g.fillText('3D view not available in this browser', 40, 60); return { url: c.toDataURL('image/jpeg', 0.9), px: [w, h] }; };
    I.hero = blank(1500, 1080); I.open = blank(1100, 760); I.thick = blank(1000, 760);
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
  progress('Cut list...', 0.78); await tick();
  pageCutList(doc, model, summary, info);
  progress('Cutting plans...', 0.85); await tick();
  pagesPlans(doc, model, summary, info, 7);
  progress('Design review...', 0.95); await tick();
  pageReview(doc, model, summary, info);
  doc.setProperties({ title: 'Murphy wardrobe drawings', subject: `${P.W} x ${P.H} x ${P.D} cavity`, creator: 'Murphy Wardrobe Builder' });
  return doc;
}

root.MurphyDrawings = { make };
})(typeof window !== 'undefined' ? window : globalThis);
