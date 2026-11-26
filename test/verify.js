// Consistency checks: cut sizes vs solids, and part-to-part interference in the closed model.
const C = require('../src/core.js');
const W0 = C.DEFAULTS.W;   // the default cavity width: the cavity tests work from it
function run(params, label) {
  const m = C.build(params), S = C.summary(m);
  let bad = 0;
  const parts = m.parts.filter(p => !p.hw);
  for (const p of parts) {
    const b = C.prismBox(p.solids[0]);
    const d = [b[3] - b[0], b[4] - b[1], b[5] - b[2]].map(x => Math.round(x * 10) / 10).sort((a, c) => a - c);
    const e = [p.T, p.L, p.W].map(x => Math.round(x * 10) / 10).sort((a, c) => a - c);
    if (p.slant) { // leaning or mitred: the blank's volume against the solid's
      const v = p.solids.reduce((acc, pr) => acc + C.prismVolume(pr), 0), r = v / (p.T * p.L * p.W);
      if (r < 0.85 || r > 1.02) { bad++; console.log(label, 'SIZE', p.mark, p.name, 'volume ratio', r.toFixed(3)); }
      continue;
    }
    if (d.some((x, i) => Math.abs(x - e[i]) > 0.15)) { bad++; console.log(label, 'SIZE', p.mark, p.name, 'solid', d.join('x'), 'cut', e.join('x')); }
  }
  // leaning, mitred and tapered parts: sample one part's solids and look for points well inside the other
  const inLoopP = (pt, lp) => { let c = false; for (let i = 0, j = lp.length - 1; i < lp.length; j = i++) { const a = lp[i], b = lp[j]; if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
  const insideP = (pr, q, m) => { const d = [q[0] - pr.o[0], q[1] - pr.o[1], q[2] - pr.o[2]], w = d[0] * pr.n[0] + d[1] * pr.n[1] + d[2] * pr.n[2]; if (w < m || w > pr.len - m) return false;
    const uv = [d[0] * pr.u[0] + d[1] * pr.u[1] + d[2] * pr.u[2], d[0] * pr.v[0] + d[1] * pr.v[1] + d[2] * pr.v[2]], lps = pr.loops.map(l => C.loopPolyline(l, 8));
    if (!inLoopP(uv, lps[0]) || lps.slice(1).some(l => inLoopP(uv, l))) return false;
    for (const [du, dv] of [[m, 0], [-m, 0], [0, m], [0, -m]]) if (!inLoopP([uv[0] + du, uv[1] + dv], lps[0])) return false; return true; };
  const solidsMeet = (A, B) => { for (const pa of A.solids) { const b = C.prismBox(pa); for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) for (let k = 0; k <= 8; k++) {
    const q = [b[0] + (b[3] - b[0]) * i / 8, b[1] + (b[4] - b[1]) * j / 8, b[2] + (b[5] - b[2]) * k / 8];
    if (A.solids.some(pr => insideP(pr, q, 0.3)) && B.solids.some(pr => insideP(pr, q, 0.3))) return true; } } return false; };
  // interference: AABB overlap volume between solids (all parts are boxes except the radiused rails)
  const boxes = m.parts.filter(p => !p.mattress && !p.leg && !p.hw).map(p => ({ p, b: C.prismBox(p.solids[0]) }));
  const hits = [];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i].b, c = boxes[j].b;
    const ox = Math.min(a[3], c[3]) - Math.max(a[0], c[0]), oy = Math.min(a[4], c[4]) - Math.max(a[1], c[1]), oz = Math.min(a[5], c[5]) - Math.max(a[2], c[2]);
    if (ox > 0.3 && oy > 0.3 && oz > 0.3 && (boxes[i].p.slant || boxes[j].p.slant || boxes[i].p.mark === 'H5' || boxes[j].p.mark === 'H5') && !solidsMeet(boxes[i].p, boxes[j].p)) continue;
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
  for (const q of S.sheets) if (isFinite(q.need) && q.need > q.have) { console.log(label, 'STOCK', `${q.T} mm: ${q.need} sheets needed, ${q.have} on hand`); if (label === 'default') process.exitCode = 1; }
  console.log(`${label}: parts ${m.parts.length}, size mismatches ${bad}, interferences ${hits.length}, pieces ${listed}/${placed}, layout problems ${ov}, sheets ${S.sheets.map(s => s.T + ':' + s.need + '/' + s.have).join(' ')}, checks ${m.checks.map(c => c.level[0]).join('')}`);
  hits.slice(0, 30).forEach(h => console.log('   ', h));
}
run({}, 'default');
run({ W: 2600, H: 2400, D: 560, drawers: [150, 150, 200, 250, 250], hangClear: 900, packFL: 0, packFR: 0 }, 'variant');
run({ mT: 305, gapHydr: 25, kickCentre: 'full', topShelf: false, ledge: false, packer: false }, 'edge');
run({ wallStudL: 25, wallStudR: 27, packFL: 41, packFR: 43, Wback: W0 - 1, packBL: 40 }, 'studs, out of square');
run({ skinT: 12, gapAbove: 134 }, 'skins 12 + 18');
run({ kickTower: 100 }, 'kick 100 under the towers');
run({ kickTower: 100, skinT: 12, skinZ0: 100 }, 'tower kick under the skins');
run({ skinT: 18, skinZ0: 45, gapAbove: 89, doorHinge: 'inner', packFL: 0, packFR: 3, packBL: -4 }, 'skins 18 + 18 on the kick');
run({ skinT: 18, skinZ1: 3000, gapAbove: 54, H: 2400 }, 'skins to the ceiling');

// ---------- the sections sheet (sheet 4 and the page's Section view): it draws, and its clear sizes are the model's
{
  globalThis.MurphyCore = C;
  try { globalThis.jspdf = require('jspdf'); } catch (e) { /* widths fall back to an estimate */ }
  require('../src/drawings.js');
  const Dw = globalThis.MurphyDrawings, probs = [];
  const sets = [['default', {}], ['studs', { wallStudL: 25, wallStudR: 27, packFL: 41, packFR: 43, Wback: W0 - 2, packBL: 39 }], ['skins', { skinT: 12, gapAbove: 134 }], ['kick 100', { kickTower: 100 }], ['wide', { W: 2900, H: 2700 }],
    ['no headboard', { headStore: false, doorHinge: 'inner', headWell: 0 }], ['thin, 5 drawers', { TfDrawer: 12, TfSide: 12, TfTop: 12, drawers: [160, 160, 200, 220, 240], topShelf: false }]];
  for (const [label, q] of sets) {
    try {
      const m = C.build(q), S = C.summary(m), svg = Dw.openingsSVG(m, S), D = Dw.openingsData(m), G = m.G;
      for (const t of ['SECTION A-A', 'SECTION B-B', 'SECTION C-C', 'SECTION D-D', 'CLEAR OPENINGS', `${Math.round(G.bayIn)} x ${Math.round(G.zBm0)}`])
        if (!svg.includes(t)) probs.push(`${label}: "${t}" missing from the sheet`);
      const z = D.zones.find(x => x.key === 'drawers'), h = D.zones.find(x => x.key === 'hang'), tp = D.zones.find(x => x.key === 'top');
      if (Math.abs(z.z1 - z.z0 - G.drawerZoneClear) > 0.5 || Math.abs(h.z1 - h.z0 - G.hangClear) > 0.5 || Math.abs(tp.z1 - tp.z0 - G.topClear) > 0.5) probs.push(`${label}: tower spaces do not match the model`);
      if (Math.abs(2 * D.boxW + 2 * (G.xB - D.boxW) - 2 * G.xB) > 0.01 || D.boxW < 100) probs.push(`${label}: box over the bed ${D.boxW}`);
      if (D.hb && Math.abs(D.hb.comps.reduce((a, g) => a + g.w, 0) + D.hb.serv.reduce((a, g) => a + g.w, 0) + G.head.supT.reduce((a, t) => a + t, 0) - 2 * G.xB) > 0.01) probs.push(`${label}: headboard widths do not add up to the bay`);
      if (D.box && (D.box.w <= 0 || D.box.w >= G.towerIn - 20)) probs.push(`${label}: drawer box inside ${D.box.w}`);
      if (/NaN|undefined|Infinity/.test(svg)) probs.push(`${label}: NaN, undefined or Infinity in the drawing`);
    } catch (e) { probs.push(`${label}: ${e.message}`); }
  }
  console.log(`sections sheet: ${sets.length} designs, ${probs.length} problems`); probs.forEach(p => console.log('   ' + p));
  if (probs.length) process.exitCode = 1;
}

// ---------- the cavity: packing at four corners, planing, studs, the opening
{
  const probs = [], has = (m, lvl, re) => m.checks.some(c => c.level === lvl && re.test(c.title));
  const legacy = C.normParams({ sideClear: 7 });
  if (legacy.packFL !== 7 || legacy.packFR !== 7 || 'sideClear' in legacy) probs.push('an old sideClear does not become the front packing');
  let m = C.build({});
  if (Math.abs(m.G.cw * 2 + m.P.packFL + m.P.packFR - m.P.W) > 1e-9) probs.push('carcass + front packing is not the front width');
  if (!has(m, 'info', /^Symmetric about the opening/)) probs.push('default is not reported symmetric');
  m = C.build({ Wback: W0 - 3, packBL: 3 });
  if (Math.abs(m.G.pack.BR - 4) > 1e-9 || Math.abs(m.G.pack.backSum - (W0 - 3)) > 1e-9) probs.push(`back-right blank should take what is left (got ${m.G.pack.BR})`);
  m = C.build({ Wback: W0 - 3, packBL: 3, packBR: 6 });
  if (!has(m, 'bad', /does not add up/)) probs.push('back that does not add up is not flagged');
  m = C.build({ packFL: 0, packFR: 0, packBL: -2, packBR: 0, Wback: W0 - 2 });
  if (!has(m, 'info', /planed to the walls/) || has(m, 'bad', /Too much to plane/) || has(m, 'bad', /does not add up/)) probs.push('2 mm planed is not listed cleanly');
  if (has(m, 'warn', /No room to scribe/) && m.checks.find(c => /No room to scribe/.test(c.title)).text.includes('left')) probs.push('a planed side is also called unscribable');
  m = C.build({ packFL: 0, packFR: 0, packBL: -10 });
  if (!has(m, 'bad', /Too much to plane/)) probs.push('planing past half the board is not flagged');
  m = C.build({ wallStudL: 25, wallStudR: 27 });
  if (!has(m, 'bad', /left tower runs into the stud/) || !has(m, 'bad', /right tower runs into the stud/)) probs.push('towers into unpacked studs not flagged');
  if (!has(m, 'info', /^Not symmetric about the opening/) || Math.abs(m.G.openOff - 1) > 1e-9) probs.push(`25/27 studs should put the opening 1 mm left (got ${m.G.openOff})`);
  const fix = C.centreOnOpening({ wallStudL: 25, wallStudR: 27, packFL: 40, packFR: 43 });
  m = C.build({ wallStudL: 25, wallStudR: 27, packFL: 40, packFR: 43, ...fix });
  if (Math.abs(m.G.openOff) > 0.05) probs.push('centre on the opening does not centre it');
  m = C.build({ wallStudL: 25, wallStudR: 27, packFL: 41, packFR: 43 });
  if (m.checks.some(c => c.level === 'bad') || !has(m, 'info', /^Symmetric about the opening/) || Math.abs(m.G.xA - (W0 - 84) / 2) > 1e-9) probs.push('41 / 43 packing against 25 / 27 studs should fit, symmetric, 1187 each side');
  if (m.parts.filter(p => p.mark === 'WS').length !== 4) probs.push('expected a stud and its cladding each side');
  const step = C.writeSTEP ? C.writeSTEP(m) : '';
  if (step && /Stud/.test(step)) probs.push('the studs went into the STEP file');
  m = C.build({ wallStudL: 25, wallStudR: 27, packFL: 41, packFR: 43, wallStudFronts: false });
  if (!has(m, 'bad', /door runs into the clad stud/)) probs.push('doors past the clad studs not flagged');
  // skins: the carcass narrows by them, the fronts stop at them, the walls stay where they are
  m = C.build({ skinT: 12, gapAbove: 134 });
  const G = m.G, sk = m.parts.filter(p => p.mark === 'T7');
  if (Math.abs(2 * G.cwo + 10 - W0) > 1e-9 || Math.abs(G.cwo - G.cw - 12) > 1e-9) probs.push('skins: carcass plus skins plus packing is not the width');
  if (sk.length !== 2 || sk.some(p => Math.abs(p.L - (G.zTop - 0)) > 0.5 || p.T !== 12)) probs.push(`skins: expected two 12 mm skins floor to carcass top (got ${sk.map(p => p.T + ' x ' + p.L)})`);
  if (Math.abs(G.xA - G.cw) > 1e-9 || G.doorX[1] > G.cw - C.DEFAULTS.gap + 1e-6) probs.push('skins: the fronts do not stop at the skins');
  if (m.checks.some(c => c.level === 'bad')) probs.push('skins 12 with a 134 header should have no bad checks: ' + m.checks.filter(c => c.level === 'bad').map(c => c.title));
  if (!has(C.build({ skinT: 12 }), 'bad', /Skins longer than your sheets/)) probs.push('skins: over-long skins not flagged');
  if (!has(C.build({ skinT: 15 }), 'bad', /No 15 mm sheets/)) probs.push('skins: a thickness with no sheets not flagged');
  if (!has(C.build({ skinT: 18, skinZ0: 20 }), 'bad', /Skins and the kick board overlap/)) probs.push('skins: overlap with the kick not flagged');
  if (!has(C.build({ skinT: 12, packFL: 0, packFR: 0, packBL: -7 }), 'bad', /Too much to plane off a tower skin/)) probs.push('skins: planing over half the skin not flagged');
  // kick board and header: halves when a sheet is too short, one piece when it is not
  const kh = (q) => C.build(q).parts.filter(p => /^K[13]$/.test(p.mark)).map(p => p.name).sort().join(', ');
  if (kh({}) !== 'Header filler (L half), Header filler (R half), Kick board (L half), Kick board (R half)') probs.push('planks: default should be halves, got ' + kh({}));
  if (kh({ W: 2400 }) !== 'Header filler, one piece, Kick board, one piece') probs.push('planks: a 2400 cavity should be one piece each, got ' + kh({ W: 2400 }));
  // the towers' own kick height: the drawers sit a reveal above it, the bed keeps the height its swing allows
  m = C.build({ kickTower: 100 });
  { const G = m.G, k = m.parts.filter(p => p.mark === 'K1');
    if (!G.kickStep || G.zPl !== 100 + C.DEFAULTS.gap || G.fronts[0].z0 !== G.zPl) probs.push(`tower kick: drawers should start at ${100 + C.DEFAULTS.gap} (got ${G.fronts[0].z0})`);
    if (k.length !== 3 || k.filter(p => p.W === 100).length !== 2 || k.filter(p => p.W === G.kickC).length !== 1) probs.push('tower kick: expected two 100 kicks and one under the bed, got ' + k.map(p => p.name + ' ' + p.W));
    if (m.checks.some(c => c.level === 'bad')) probs.push('tower kick 100: bad checks ' + m.checks.filter(c => c.level === 'bad').map(c => c.title)); }
  m = C.build({ kickTower: 100, skinT: 12, skinZ0: 50 });
  if (!has(m, 'bad', /Skins and the kick board overlap/)) probs.push('tower kick: skins starting inside the towers\' kick not flagged');
  console.log(`cavity: ${probs.length} problems`); probs.forEach(p => console.log('   ' + p));
  if (probs.length) process.exitCode = 1;
}

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

// ---------- joinery: every fastener inside what it joins, clear of the faces, reachable, not clashing
function checkJoinery(params, label) {
  const m = C.build(params), S = C.summary(m), B = S.build, J = B.joinery;
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const addv = (a, b, k) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
  const inLoop = (pt, lp) => { let c = false; for (let i = 0, j = lp.length - 1; i < lp.length; j = i++) { const a = lp[i], b = lp[j]; if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
  const inPrism = (pr, p, tol) => { const d = sub(p, pr.o), w = dot(d, pr.n); if (w < -tol || w > pr.len + tol) return false; return inLoop([dot(d, pr.u), dot(d, pr.v)], C.loopPolyline(pr.loops[0], 12)); };
  const inPart = (part, p, tol) => part.solids.some(pr => inPrism(pr, p, tol || 0));
  const perp = (dir) => { const a = Math.abs(dir[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]; const u = [dir[1] * a[2] - dir[2] * a[1], dir[2] * a[0] - dir[0] * a[2], dir[0] * a[1] - dir[1] * a[0]]; const l = Math.hypot(...u); const u1 = u.map(x => x / l); const v = [dir[1] * u1[2] - dir[2] * u1[1], dir[2] * u1[0] - dir[0] * u1[2], dir[0] * u1[1] - dir[1] * u1[0]]; return [u1, v]; };
  const stepIdx = (p) => B.stepOf(p);
  const problems = [], segs = [];
  let n = 0;
  for (const key of Object.keys(J.steps)) {
    const si = B.steps.findIndex(s => s.joinery === key);
    for (const inst of J.steps[key]) {
      const present = new Set(inst.base);
      for (const op of inst.ops) {
        for (const g of op.fast) {
          const [len, dia] = C.FAST[g.key], dir = g.dir, [u, v] = perp(dir);
          const into = g.into, thr = g.through;
          g.pts.forEach((pt) => {
            n++;
            const dowel = g.key === 'd8';
            const a = dowel ? addv(pt, dir, -12) : addv(pt, dir, -g.thru), tip = dowel ? addv(pt, dir, 18) : addv(a, dir, len);
            const r = g.key === 'dom' ? 3.5 : dia / 2 - 0.6;
            // shank in the part it holds into, with its radius clear of the faces
            for (let t = 0.6; t <= 0.98; t += 0.05) {
              const q = addv(pt, sub(tip, pt), t);
              for (const off of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]]) {
                const qq = addv(addv(q, u, off[0]), v, off[1]);
                if (!inPart(into, qq, 0.01)) { problems.push(`${label} ${key} "${op.title}" ${g.key} at ${pt.map(Math.round)}: leaves ${into.name}`); return; }
              }
            }
            // through part along the clearance hole
            if (!dowel && g.thru > 2) for (let t = 0.2; t <= 0.8; t += 0.3) { const q = addv(a, dir, g.thru * t); if (!inPart(thr, q, 0.01) && !(g.via || []).some(vp => inPart(vp, q, 0.01))) { problems.push(`${label} ${key} "${op.title}" ${g.key} at ${pt.map(Math.round)}: misses ${thr.name}`); return; } }
            // nothing else in the way of the fixing or of the driver (parts fitted by then)
            const bench = inst.bench || op.bench;
            const others = m.parts.filter(p => p !== into && p !== thr && !(g.via || []).includes(p) && !p.mattress && (present.has(p) || (!bench && stepIdx(p) < si)) && !(op.add || []).some(x => x[0] === p) && (p.hw ? !/links|^Gas|stay/i.test(p.name) : true));
            const probe = [];
            for (let t = 0.05; t <= 0.98; t += 0.08) probe.push(addv(a, sub(tip, a), t));
            if (!dowel) for (let k = 1; k <= 25; k += 4) probe.push(addv(a, dir, -k));
            for (const q of probe) { const hit = others.find(p => inPart(p, q, -0.01)); if (hit) { problems.push(`${label} ${key} "${op.title}" ${g.key} at ${pt.map(Math.round)}: runs into ${hit.name}`); return; } }
            segs.push({ a: dowel ? addv(pt, dir, -12) : a, b: tip, r: g.key === 'dom' ? 4 : dia / 2, where: `${key} ${g.key} ${pt.map(Math.round)}` });
          });
        }
        for (const [p] of op.add || []) present.add(p);
      }
    }
  }
  // fixings clashing with each other
  const segDist = (p1, q1, p2, q2) => { // closest distance between segments
    const d1 = sub(q1, p1), d2 = sub(q2, p2), r = sub(p1, p2), a = dot(d1, d1), e = dot(d2, d2), f = dot(d2, r);
    let s, t; const c = dot(d1, r), b = dot(d1, d2), den = a * e - b * b;
    s = den > 1e-9 ? Math.min(1, Math.max(0, (b * f - c * e) / den)) : 0;
    t = (b * s + f) / e; if (t < 0) { t = 0; s = Math.min(1, Math.max(0, -c / a)); } else if (t > 1) { t = 1; s = Math.min(1, Math.max(0, (b - c) / a)); }
    return Math.hypot(...sub(addv(p1, d1, s), addv(p2, d2, t)));
  };
  for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
    const A = segs[i], Bq = segs[j];
    if (Math.min(A.a[0], A.b[0]) - 60 > Math.max(Bq.a[0], Bq.b[0]) || Math.min(Bq.a[0], Bq.b[0]) - 60 > Math.max(A.a[0], A.b[0])) continue;
    if (segDist(A.a, A.b, Bq.a, Bq.b) < A.r + Bq.r + 1.5) problems.push(`${label} clash: ${A.where} and ${Bq.where}`);
  }
  // cable holes: clear of every fixing and of the hardware, and each one through every part it is meant to pass
  for (const q of (m.G.cables || []).concat(m.G.boltHoles || [])) {
    const holeR = (q.d || 20) / 2;
    const A = q.axis === 'x' ? [q.x[0], q.c[0], q.c[1]] : [q.c[0], q.c[1], q.z[0]], Bq = q.axis === 'x' ? [q.x[1], q.c[0], q.c[1]] : [q.c[0], q.c[1], q.z[1]];
    for (const g of segs) { const d = segDist(A, Bq, g.a, g.b); if (d < holeR + g.r + 1.5) problems.push(`${label} cable hole ${q.id} ${q.S} meets ${g.where} (${d.toFixed(1)})`); }
    const lo = A.map((v, k) => Math.min(v, Bq[k]) - holeR), hi = A.map((v, k) => Math.max(v, Bq[k]) + holeR);
    if (q.axis === 'x') { lo[0] += holeR; hi[0] -= holeR; } else { lo[2] += holeR; hi[2] -= holeR; }
    for (const p of m.parts.filter(p => p.hw && !p.mattress && !p.bed && !(q.id === 'bolt' && p.mark === 'SB'))) for (const pr of p.solids) {
      const b = C.prismBox(pr);
      if (b[0] < hi[0] && b[3] > lo[0] && b[1] < hi[1] && b[4] > lo[1] && b[2] < hi[2] && b[5] > lo[2]) problems.push(`${label} cable hole ${q.id} ${q.S} meets ${p.name}`);
    }
    if (!q.parts.length) problems.push(`${label} cable hole ${q.id} ${q.S} goes through nothing`);
  }
  console.log(`${label}: ${n} fixings checked, ${(m.G.cables || []).length + (m.G.boltHoles || []).length} holes, ${problems.length} problems`);
  for (const p of problems.slice(0, 40)) console.log('   ' + p);
  return problems.length;
}
let jp = checkJoinery({}, 'joinery default');
jp += checkJoinery({ W: 2600, H: 2400, D: 560, drawers: [150, 150, 200, 250, 250], hangClear: 900, packFL: 0, packFR: 0, doorHinge: 'inner' }, 'joinery variant');
jp += checkJoinery({ mT: 305, gapHydr: 25, kickCentre: 'none', topShelf: false, ledge: false, packer: false, edgeSteel: false, lockType: 'pins', upstand: 40, drawers: [150, 200, 250] }, 'joinery edge');
jp += checkJoinery({ gapHydr: 30, packer: true, Tpacker: 18 }, 'joinery pads');
jp += checkJoinery({ lockType: 'bolts', supportOffset: true, faceReveal: true, doorHinge: 'inner', headAngle: 12, headLip: 20 }, 'joinery options');
jp += checkJoinery({ headHinge: 'front' }, 'joinery front hinges');
jp += checkJoinery({ TfDrawer: 18, TfSide: 12, TfTop: 18 }, 'joinery fronts 18/12/18');
jp += checkJoinery({ TfDrawer: 12, TfSide: 18, TfTop: 12, edgeSteel: true }, 'joinery fronts 12/18/12');
jp += checkJoinery({ TfDrawer: 12, TfSide: 12, TfTop: 12 }, 'joinery fronts all 12');
jp += checkJoinery({ headWell: 150 }, 'joinery well 150');
jp += checkJoinery({ headWell: 0 }, 'joinery no well');
jp += checkJoinery({ headWell: 50, headHinge: 'front' }, 'joinery well 50, front hinges');
jp += checkJoinery({ headStore: false, headAngle: 0 }, 'joinery plain headboard');
jp += checkJoinery({ wallStudL: 25, wallStudR: 27, packFL: 41, packFR: 43, Wback: W0 - 1, packBL: 40 }, 'joinery studs');
jp += checkJoinery({ skinT: 12, gapAbove: 134 }, 'joinery skins 12');
jp += checkJoinery({ kickTower: 100, skinT: 12, gapAbove: 134 }, 'joinery tower kick 100');
jp += checkJoinery({ skinT: 18, skinZ0: 45, gapAbove: 89, doorHinge: 'inner' }, 'joinery skins 18 on the kick');
jp += checkJoinery({ packFL: 0, packFR: 0, packBL: -2 }, 'joinery planed');
if (jp) process.exitCode = 1;

// ---------- solid overlaps (sampled points, not bounding boxes): hardware against plywood and against other hardware,
// bed closed, half open and down. Hardware that sits in a hole or a pocket, or touches by design, is listed as allowed.
{
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const inPoly = (p, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
  const segD = (p, a, b) => { const ab = [b[0] - a[0], b[1] - a[1]], L2 = ab[0] * ab[0] + ab[1] * ab[1], t = L2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1]) / L2)) : 0; return Math.hypot(p[0] - a[0] - ab[0] * t, p[1] - a[1] - ab[1] * t); };
  const depthIn = (q, p) => { const d = sub(p, q.s.o), w = dot(d, q.s.n); if (w < 0 || w > q.s.len) return null; const uv = [dot(d, q.s.u), dot(d, q.s.v)]; if (!inPoly(uv, q.polys[0])) return null;
    for (let i = 1; i < q.polys.length; i++) if (inPoly(uv, q.polys[i])) return null; let dd = Math.min(w, q.s.len - w); for (const pl of q.polys) for (let i = 0; i < pl.length; i++) dd = Math.min(dd, segD(uv, pl[i], pl[(i + 1) % pl.length])); return dd; };
  const sample = (q) => { const pts = [], poly = q.polys[0]; let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity; for (const p of poly) { u0 = Math.min(u0, p[0]); u1 = Math.max(u1, p[0]); v0 = Math.min(v0, p[1]); v1 = Math.max(v1, p[1]); }
    const su = Math.max(1.5, (u1 - u0) / 30), sv = Math.max(1.5, (v1 - v0) / 30), sw = Math.max(1.5, q.s.len / 40);
    for (let u = u0 + su / 2; u < u1; u += su) for (let v = v0 + sv / 2; v < v1; v += sv) if (inPoly([u, v], poly)) for (let w = sw / 2; w < q.s.len; w += sw) pts.push(C.to3(q.s, [u, v], w));
    for (const p of poly) { pts.push(C.to3(q.s, p, 0.01)); pts.push(C.to3(q.s, p, q.s.len - 0.01)); } return pts; };
  // [hardware mark, other mark]: cups in doors, pins through block, shelf and foot rail, latches drilled in, the pivot bar
  // in its pocket and bush, the bush through the rail, the upper stud's nut in its hole, balls in the spring sockets,
  // the legs and their rail, the rail closing onto the stop domes
  const ALLOW = new Set(['HG D1', 'HG D2', 'HG HG', 'FH D4', 'FH FH', 'LP LP', 'LP B2', 'LP F4', 'PL B2', 'PL SF', 'PV B1', 'PV F2', 'PV PV', 'PV B8', 'BS B1', 'BS B8', 'BS GS', 'GS BS', 'LG LG', 'ST F2', 'SF PL', 'SB SB', 'SR SB', 'SB SR', 'PP PP']);  // SB, SR: the safety bolt's parts are concentric; PP: the switches sit in pockets in the plate (bores are not seen by the box test)
  let bad = 0;
  const sets = [['default', {}], ['pads', { gapHydr: 30, packer: true, Tpacker: 18 }], ['options', { lockType: 'bolts', supportOffset: true, faceReveal: true }], ['front hinges', { headHinge: 'front' }], ['fronts 18/12/18', { TfDrawer: 18, TfSide: 12, TfTop: 18 }], ['fronts 12/18/12', { TfDrawer: 12, TfSide: 18, TfTop: 12, edgeSteel: true, doorHinge: 'inner' }], ['fronts all 12', { TfDrawer: 12, TfSide: 12, TfTop: 12 }], ['well 150', { headWell: 150 }], ['no well', { headWell: 0 }], ['well 50 front', { headWell: 50, headHinge: 'front' }], ['studs', { wallStudL: 25, wallStudR: 27, packFL: 41, packFR: 43 }], ['planed', { packFL: 0, packFR: 0, packBL: -2 }]].concat(process.env.OVERLAP_PROBE ? [['probe', JSON.parse(process.env.OVERLAP_PROBE)]] : []);
  for (const [label, params] of sets) for (const ang of [0, 45, 90]) {
    const m = C.build(params, { bedAngle: ang }), all = [];
    for (const p of m.parts) if (!p.mattress) p.solids.forEach((sl) => all.push({ p, s: sl, box: C.prismBox(sl), polys: sl.loops.map(l => C.loopPolyline(l, 16)) }));
    const hw = all.filter(q => q.p.hw), found = new Map();
    for (const A of hw) for (const B of all) {
      if (A.p === B.p || (ALLOW.has(A.p.mark + ' ' + B.p.mark) && !(/^Lower ball-stud/.test(A.p.name) && /^B[18] /.test(B.p.mark + ' ')))) continue;
      const a = A.box, b = B.box; if (Math.min(a[3], b[3]) - Math.max(a[0], b[0]) < -0.2 || Math.min(a[4], b[4]) - Math.max(a[1], b[1]) < -0.2 || Math.min(a[5], b[5]) - Math.max(a[2], b[2]) < -0.2) continue;
      let dmax = 0; for (const pt of sample(A)) { const d = depthIn(B, pt); if (d !== null && d > dmax) dmax = d; }
      if (dmax > 0.1) { const k = `${A.p.mark} ${A.p.name}  x  ${B.p.mark} ${B.p.name}`; if (!found.has(k) || found.get(k) < dmax) found.set(k, dmax); }
    }
    console.log(`solid overlaps ${label} at ${ang} deg: ${found.size} not allowed`);
    for (const [k, d] of found) console.log(`   ${d.toFixed(1)} mm  ${k}`);
    bad += found.size;
  }
  if (bad) process.exitCode = 1;
}
