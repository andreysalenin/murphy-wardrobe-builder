// Consistency checks: cut sizes vs solids, and part-to-part interference in the closed model.
const C = require('../src/core.js');
function run(params, label) {
  const m = C.build(params), S = C.summary(m);
  let bad = 0;
  const parts = m.parts.filter(p => !p.hw);
  for (const p of parts) {
    const b = C.prismBox(p.solids[0]);
    const d = [b[3] - b[0], b[4] - b[1], b[5] - b[2]].map(x => Math.round(x * 10) / 10).sort((a, c) => a - c);
    const e = [p.T, p.L, p.W].map(x => Math.round(x * 10) / 10).sort((a, c) => a - c);
    if (d.some((x, i) => Math.abs(x - e[i]) > 0.15)) { bad++; console.log(label, 'SIZE', p.mark, p.name, 'solid', d.join('x'), 'cut', e.join('x')); }
  }
  // interference: AABB overlap volume between solids (all parts are boxes except the radiused rails)
  const boxes = m.parts.filter(p => !p.mattress && !p.leg && !p.hw).map(p => ({ p, b: C.prismBox(p.solids[0]) }));
  const hits = [];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i].b, c = boxes[j].b;
    const ox = Math.min(a[3], c[3]) - Math.max(a[0], c[0]), oy = Math.min(a[4], c[4]) - Math.max(a[1], c[1]), oz = Math.min(a[5], c[5]) - Math.max(a[2], c[2]);
    if (ox > 0.3 && oy > 0.3 && oz > 0.3 && boxes[i].p.mark !== 'X3' && boxes[j].p.mark !== 'X3') hits.push(`${boxes[i].p.mark} ${boxes[i].p.name}  x  ${boxes[j].p.mark} ${boxes[j].p.name}  (${ox.toFixed(1)} x ${oy.toFixed(1)} x ${oz.toFixed(1)})`);
  }
  // pieces placed = pieces listed
  const listed = S.cut.reduce((a, r) => a + r.qty, 0), placed = S.sheets.reduce((a, s) => a + s.bins.reduce((q, b) => q + b.items.length, 0) + s.unplaced.length, 0);
  // placements inside the sheet and not overlapping
  let ov = 0;
  for (const s of S.sheets) for (const b of s.bins) {
    for (const it of b.items) if (it.x < m.P.trim - 0.01 || it.y < m.P.trim - 0.01 || it.x + it.w > b.L - m.P.trim + 0.01 || it.y + it.h > b.W - m.P.trim + 0.01) { ov++; console.log(label, 'OUTSIDE', s.T, it.mark); }
    for (let i = 0; i < b.items.length; i++) for (let j = i + 1; j < b.items.length; j++) {
      const A = b.items[i], B = b.items[j];
      const ox = Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x), oy = Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y);
      if (ox > -m.P.kerf + 0.01 && oy > -m.P.kerf + 0.01) { ov++; console.log(label, 'OVERLAP/KERF', s.T, A.mark, B.mark, ox.toFixed(2), oy.toFixed(2)); }
    }
  }
  console.log(`${label}: parts ${m.parts.length}, size mismatches ${bad}, interferences ${hits.length}, pieces ${listed}/${placed}, layout problems ${ov}, sheets ${S.sheets.map(s => s.T + ':' + s.need + '/' + s.have).join(' ')}, checks ${m.checks.map(c => c.level[0]).join('')}`);
  hits.slice(0, 30).forEach(h => console.log('   ', h));
}
run({}, 'default');
run({ W: 2600, H: 2400, D: 560, drawers: [150, 150, 200, 250, 250], hangClear: 900, sideClear: 0 }, 'variant');
run({ mT: 305, gapHydr: 25, kickCentre: 'full', topShelf: false, ledge: false, packer: false }, 'edge');

// hardware vs plywood overlaps (expected: cups in doors, pins through the shelf, plates on faces)
const m = C.build({});
const ply = m.parts.filter(p => !p.hw && !(p.solids[0].loops[0].length !== 4));
const hw = m.parts.filter(p => p.hw && !p.mattress);
const seen = new Map();
for (const h of hw) for (const sol of h.solids) {
  const a = C.prismBox(sol);
  for (const q of ply) { const c = C.prismBox(q.solids[0]);
    const ox = Math.min(a[3], c[3]) - Math.max(a[0], c[0]), oy = Math.min(a[4], c[4]) - Math.max(a[1], c[1]), oz = Math.min(a[5], c[5]) - Math.max(a[2], c[2]);
    if (ox > 0.5 && oy > 0.5 && oz > 0.5) { const k = h.mark + ' x ' + q.mark; seen.set(k, (seen.get(k) || 0) + 1); } }
}
console.log('hardware overlaps (bounding boxes):', [...seen.entries()].map(([k, v]) => k + ' ' + v).join(' | '));
