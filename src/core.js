/* Murphy wardrobe core: parameters, derived geometry, parts, swing clearances,
   cut list, sheet nesting, STEP (AP214) and ZIP writers. Pure JS, no DOM.
   Units mm. Axes: X across the cavity (0 = centre line, the design is symmetric),
   Y depth (0 = back wall, +Y toward the room), Z up (0 = floor). */
(function (root) {
'use strict';

/* ------------------------------------------------------------------ defaults
   Names in comments are the macros in murphy_bed.tikz (metres there, mm here). */
const DEFAULTS = {
  // cavity
  W: 2458,            // aperturew
  H: 2554,            // apertureh
  D: 600,             // cavity depth once the top is opened (510 + 90)
  sideClear: 5,       // carcass to cavity side wall, each side (scribe / packing room)
  backGap: 10,        // carcass back to wall
  frontSetback: 0,    // front faces behind the cavity mouth
  frontGap: 1,        // fronts off the carcass edge (bumpers)
  // mattress and bed
  mW: 1530,           // mattressw
  mL: 2030,           // mattressh
  mT: 250,            // mattress thickness (Create-A-Bed: 8 to 12 in)
  gapMx: 30,          // gapmattressx: mattress to frame side rail
  gapMy: 2,           // gapmattressy: mattress to head and foot rails (2 makes the side rails the kit's 81-1/2 in)
  gapHolder: 12,      // gapholder: frame top to the shelf above the bed
  gapHydr: 11,        // gaphydr: frame side rail to bed-cabinet side. 11 is the kit's 7/16 in; your TikZ had 30
  gapBelow: 60,       // gapbelow: floor to the bottom of the face panel and the first drawer
  faceBelowFrame: 10, // face panel runs this far past the frame's head end (kit: about 1/4 in); puts the pivot at the kit's 11-3/4 in
  // side towers
  drawers: [180, 180, 180, 180], // botdrawersize x 4 (bottom first)
  hangClear: 972,     // clear hanging height (midcompartment - plythicka)
  topShelf: true,     // extra adjustable shelf halfway up the top compartment
  railDrop: 50,       // hanging rail centre below the shelf above it
  // fronts
  gap: 6,             // gapdraw: reveal between fronts
  gapAbove: 54,       // gapabove: header filler height
  kickCentre: 'auto', // kick board under the bed: auto (lowered to clear the swing) | full | none
  // plywood
  T: 18,              // plythicka: carcass, fronts, bed frame
  Tb: 12,             // plythickb: drawer boxes
  Tback: 6,           // tower backs, drawer bottoms
  Tsup: 6,            // mattress support panel
  Tladder: 12,        // bed deck struts
  Tplinth: 18,
  Tpacker: 18,        // packers under the kit's cabinet plates, only when gapHydr is wider than the kit's 11 mm
  Tledge: 18,
  // drawers
  runnerClear: 12.7,  // side-mount ball-bearing runners, each side
  runnerLen: 0,       // 0 = longest standard length that fits
  boxLess: 50,        // drawer box this much lower than its front
  // bed frame (Create-A-Bed Deluxe Queen Vertical plan)
  railD: 149.2,       // side rails B, 5-7/8 in (p.6)
  headRailD: 200,     // head rail D, 7-7/8 in: stands 2 in above the side rails, a lip at the pillows (p.6, p.18)
  footRailD: 76.2,    // foot rail C, 3 in: the legs swing past it (p.6)
  railR: 73,          // side rails: 2-7/8 in radius on the foot-end top corner (p.10)
  faceOverhang: 0,    // face panel past the side rails, each side (kit: 1/4 in)
  ladderW: 45,        // deck strut width (kit: 1-1/2 in solid wood)
  struts: 10,
  // Create-A-Bed hardware, from the plan (pages in brackets)
  pivotFromRail: 101.6, // pivot hole 4 in from the rail's face-panel edge, 1-7/8 in from its top edge (p.15)
  pivotAboveHead: 228.6,// pivot hole 9 in from the rail's head end (p.15)
  cabPivotZ: 298.5,     // male pivot plate 11-3/4 in above the floor in the kit's cabinet (p.22); the legs suit this
  pinGap: 11,           // rail to cabinet side in the kit, 7/16 in (p.6: 64-3/8 in inside, rails 62 in + 2 x 3/4)
  legFromFoot: 79.4,    // leg pivot 3-1/8 in from the foot end (p.10)
  legFromTop: 63.5,     // ... 2-1/2 in down from the rail's top edge (p.10)
  springLowAlong: 190.5,// lower ball stud 7-1/2 in from the pivot toward the head end (p.15)
  springLowOut: 15,     // ... about 5/8 in beyond the rail's top edge (plate overhangs, p.15, p.18)
  springUpFront: 254,   // upper ball stud 10 in back from the front (p.22)
  springUpZ: 781,       // ... 30-3/4 in above the floor in the kit's cabinet (p.22)
  stopFront: 187.3,     // bed stop 7-3/8 in back from the front (p.22)
  stopBelowTop: 79.4,   // ... 6 in below the top of the 87-1/8 in vertical = 3-1/8 in below the frame top
  packer: false,
  packerH: 950,
  packerDepth: 300,
  // around the bed
  ledge: true,          // headboard ledge at the back of the bed bay
  ledgeClear: 15,       // ledge front to the bed's swept envelope
  headboard: true,      // reclined backrest stepping out over the swing, just behind the pillows
  headAngle: 5,         // backrest lean, deg from vertical
  headH: 600,           // backrest height
  headGap: 12,          // backrest to the open mattress's head end
  Thead: 12,            // backrest, ribs and cap shelf
  upstand: 0,           // optional lip on the front edge of the shelf above the bed (0 = flat shelf)
  edgeSteel: true,      // steel flat on edge let into the shelf's front edge, hidden behind the flaps
  steelH: 20,           // ... its height (2 mm more than the shelf: it sits 2 mm proud underneath)
  steelT: 10,           // ... its thickness
  lockType: 'twin',     // 'twin': two pins on one bar straddling the divider; 'pins': two separate pins mid-bay; 'none'
  lockTab: false,       // twin pin: a 2 mm tab out through the joint between the flaps
  twinSpacing: 60,      // twin pin: pin centres
  lockPinX: 300,        // 'pins': pins this far either side of the centre
  lockDepth: 15,        // pins go this deep into the foot rail
  wallRail: 90,         // wall rails screwed to studs
  doorHinge: 'outer',   // tower doors hinged on the wall side (outer) or the bed side (inner)
  // cutting
  kerf: 3.2,
  trim: 5,              // trimmed off each sheet edge
  grain: true,          // visible parts keep their grain along the sheet length
  sheets: [
    { T: 6, L: 2440, W: 1220, n: 5 },
    { T: 12, L: 2440, W: 1220, n: 3 },
    { T: 18, L: 2440, W: 1220, n: 8 },
  ],
};
/* ------------------------------------------------------------------ bought-in hardware, as sold in Australia
   Drawer runners: Hettich KA 5632, full extension, 45 kg, side mount, 46 high and 12.7 wide (Hettich KA brochure;
   stocked in Australia, e.g. Kitchen Library). Nominal length NL = drawer length, 250 to 700 in 50s; the carcase needs
   NL + 4 inside. The cabinet member's first hole is 37 from the front edge, then b1, b2... and the last hole C behind
   the first (C = NL - 58). */
const RUNNER_HW = {
  name: 'Hettich KA 5632', load: 45, h: 46, w: 12.7, kt: 4, front: 37,
  holes: { 250: [96], 300: [96], 350: [96], 400: [96, 96], 450: [96, 128], 500: [96, 128, 64], 550: [96, 128, 64, 32, 32],
    600: [96, 128, 96, 32, 32], 650: [96, 128, 160, 32, 32], 700: [96, 128, 192, 32, 32] },
};
const RUNNER_STD = [250, 300, 350, 400, 450, 500, 550, 600, 650, 700];
// hole positions on the cabinet member, from its front end (= the carcase's front edge for overlay fronts)
function runnerHoles(NL) {
  const b = RUNNER_HW.holes[NL] || [96], out = [RUNNER_HW.front];
  for (const d of b) { const n = out[out.length - 1] + d; if (n < NL - 40) out.push(n); }
  out.push(RUNNER_HW.front + NL - 58);
  return out;
}
// three nested galvanised channels in (u, w): u from the cabinet side toward the drawer (0 to 12.7), w up from the
// runner's centre line (46 high). Curled lips carry the ball tracks; the ball cages ride in the gaps between them.
const RUNNER_PROFILE = {
  outer: [[0, -23], [9.6, -23], [9.6, -17.6], [8.4, -17.6], [8.4, -21.8], [1.2, -21.8], [1.2, 21.8], [8.4, 21.8], [8.4, 17.6], [9.6, 17.6], [9.6, 23], [0, 23]],
  mid: [[2.4, -16.4], [10.6, -16.4], [10.6, -11.9], [9.6, -11.9], [9.6, -15.4], [3.4, -15.4], [3.4, 15.4], [9.6, 15.4], [9.6, 11.9], [10.6, 11.9], [10.6, 16.4], [2.4, 16.4]],
  inner: [[5.2, -10.2], [12.7, -10.2], [12.7, 10.2], [5.2, 10.2], [5.2, 9], [11.5, 9], [11.5, -9], [5.2, -9]],
};
/* Hinges: Blum CLIP top BLUMOTION 110 deg, full overlay, screw-on (71B3550), on CLIP cruciform plates 37/32
   (173L6100 0 mm, 173L6130 3 mm), sold in Australia through Blum stockists (e.g. Kitchen Library). From Blum's spec
   sheet: 35 cup bored 13 deep, flange 57 x 22 x 3.2, screw holes 45 apart and 9.5 off the cup centre, boring distance
   B 3 to 7, overlay = 11 + B - plate, arm 21.5 off the panel (+ plate), 1.5 gap as set. Plates are 8.5 high (+ plate). */
const HINGE_HW = {
  name: 'Blum CLIP top BLUMOTION 110\u00b0 full overlay, 71B3550', short: 'Blum 71B3550', cup: 35, bore: 13, flange: [57, 22, 3.2], screws: [45, 9.5],
  X: 11, B: [3, 7], S: 21.5, line: 37, pitch: 32,
  plates: [{ H: 0, code: '173L6100', h: 8.5 }, { H: 3, code: '173L6130', h: 11.5 }],
};
// plate and boring distance for an overlay: the plate that puts B nearest 5 mm
function hingeFit(overlay) {
  let best = null;
  for (const pl of HINGE_HW.plates) {
    const B = overlay - HINGE_HW.X + pl.H, Bc = Math.min(HINGE_HW.B[1], Math.max(HINGE_HW.B[0], B));
    const sc = Math.abs(B - Bc) * 10 + Math.abs(Bc - 5) + pl.H * 0.01;
    if (!best || sc < best.sc) best = { sc, H: pl.H, code: pl.code, h: pl.h, B: Bc, ok: Math.abs(B - Bc) < 0.01, overlay };
  }
  best.S = HINGE_HW.S + best.H; best.cup = best.B + HINGE_HW.cup / 2;
  return best;
}
const PLY_DENSITY = 6.2e-7; // kg/mm3, birch-faced structural ply about 620 kg/m3

function clone(o) { return JSON.parse(JSON.stringify(o)); }

function normParams(p) {
  const P = Object.assign(clone(DEFAULTS), p ? clone(p) : {});
  const num = (k, lo, hi) => { let v = Number(P[k]); if (!isFinite(v)) v = DEFAULTS[k]; P[k] = Math.min(hi, Math.max(lo, v)); };
  num('W', 1800, 4000); num('H', 2100, 3200); num('D', 400, 900);
  num('sideClear', 0, 40); num('backGap', 0, 60); num('frontSetback', 0, 100); num('frontGap', 0, 5);
  num('mW', 800, 2000); num('mL', 1800, 2200); num('mT', 120, 400);
  num('gapMx', 5, 80); num('gapMy', 0, 40); num('gapHolder', 0, 80); num('gapHydr', 5, 80); num('gapBelow', 0, 200); num('faceBelowFrame', 0, 60);
  num('hangClear', 300, 2000); num('railDrop', 25, 150);
  num('gap', 1, 12); num('gapAbove', 0, 300);
  for (const k of ['T', 'Tb', 'Tback', 'Tsup', 'Tladder', 'Tplinth', 'Tpacker', 'Tledge', 'Thead']) num(k, 3, 40);
  num('runnerClear', 0, 30); num('runnerLen', 0, 900); num('boxLess', 10, 150);
  num('railD', 60, 300); num('headRailD', 18, 300); num('footRailD', 18, 300); num('railR', 0, 140); num('faceOverhang', 0, 40);
  num('ladderW', 20, 120); num('struts', 2, 20); P.struts = Math.round(P.struts);
  num('pivotFromRail', 10, 300); num('pivotAboveHead', 30, 600); num('pinGap', 0, 60); num('cabPivotZ', 50, 600);
  num('legFromFoot', 20, 300); num('legFromTop', 10, 250);
  num('springLowAlong', 20, 600); num('springLowOut', -100, 100); num('springUpFront', 50, 600); num('springUpZ', 200, 1500);
  num('stopFront', 50, 600); num('stopBelowTop', 10, 600);
  num('headAngle', 0, 20); num('headH', 150, 1200); num('headGap', 0, 80); num('lockPinX', 50, 800); num('lockDepth', 5, 40);
  num('packerH', 200, 2000); num('packerDepth', 80, 600);
  num('ledgeClear', 0, 100); num('upstand', 0, 200); num('wallRail', 40, 200);
  num('steelH', 10, 40); num('steelT', 5, 20); num('twinSpacing', 40, 90);
  num('kerf', 0, 8); num('trim', 0, 30);
  if (!Array.isArray(P.drawers) || !P.drawers.length) P.drawers = DEFAULTS.drawers.slice();
  P.drawers = P.drawers.slice(0, 10).map(h => { const v = Number(h); return isFinite(v) ? Math.min(600, Math.max(80, v)) : 180; });
  if (!['auto', 'full', 'none'].includes(P.kickCentre)) P.kickCentre = 'auto';
  P.topShelf = !!P.topShelf; P.packer = !!P.packer; P.ledge = !!P.ledge; P.grain = !!P.grain; P.headboard = !!P.headboard; P.edgeSteel = !!P.edgeSteel; P.lockTab = !!P.lockTab;
  if (p && p.lockPins === false && !p.lockType) P.lockType = 'none';
  if (!['twin', 'pins', 'none'].includes(P.lockType)) P.lockType = 'twin';
  delete P.lockPins;
  if (!['outer', 'inner'].includes(P.doorHinge)) P.doorHinge = 'outer';
  delete P.pivotBehindFace;
  if (!Array.isArray(P.sheets)) P.sheets = clone(DEFAULTS.sheets);
  P.sheets = P.sheets.map(s => ({ T: Math.max(1, Number(s.T) || 18), L: Math.max(300, Number(s.L) || 2440), W: Math.max(200, Number(s.W) || 1220), n: Math.max(0, Math.round(Number(s.n) || 0)) }));
  return P;
}

/* ------------------------------------------------------------------ vectors */
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };
const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];

/* ------------------------------------------------------------------ 2D loops
   A loop is a closed list of segments. Line {t:'L',a,b}; arc {t:'A',a,b,c,r,ccw}
   with sweep <= 180 deg. Outer loops run CCW in the prism's (u,v) frame. */
function L2(a, b) { return { t: 'L', a, b }; }
function A2(a, b, c, r, ccw) { return { t: 'A', a, b, c, r, ccw }; }
function rectLoop(u0, v0, u1, v1) {
  const p = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
  return [L2(p[0], p[1]), L2(p[1], p[2]), L2(p[2], p[3]), L2(p[3], p[0])];
}
function reverseLoop(loop) { return loop.slice().reverse().map(s => s.t === 'L' ? L2(s.b, s.a) : A2(s.b, s.a, s.c, s.r, !s.ccw)); }
function circleLoop(cu, cv, r) { const a = [cu + r, cv], b = [cu - r, cv]; return [A2(a, b, [cu, cv], r, true), A2(b, a, [cu, cv], r, true)]; }
function arcSweep(s) {
  const a0 = Math.atan2(s.a[1] - s.c[1], s.a[0] - s.c[0]), a1 = Math.atan2(s.b[1] - s.c[1], s.b[0] - s.c[0]);
  let d = s.ccw ? a1 - a0 : a0 - a1;
  while (d <= 1e-12) d += 2 * Math.PI;
  return d;
}
function arcPoints(s, n) {
  const a0 = Math.atan2(s.a[1] - s.c[1], s.a[0] - s.c[0]), sw = arcSweep(s) * (s.ccw ? 1 : -1), out = [];
  for (let i = 0; i <= n; i++) { const a = a0 + sw * i / n; out.push([s.c[0] + s.r * Math.cos(a), s.c[1] + s.r * Math.sin(a)]); }
  out[0] = s.a; out[n] = s.b;
  return out;
}
function loopPolyline(loop, arcN) {
  arcN = arcN || 12;
  const pts = [];
  for (const s of loop) {
    if (s.t === 'L') pts.push(s.a);
    else { const p = arcPoints(s, arcN); for (let i = 0; i < arcN; i++) pts.push(p[i]); }
  }
  return pts;
}
function loopArea(loop) {
  const pts = loop.map(s => s.a);
  let a = 0;
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; }
  a /= 2;
  for (const s of loop) if (s.t === 'A') { const th = arcSweep(s); const seg = s.r * s.r * (th - Math.sin(th)) / 2; a += s.ccw ? seg : -seg; }
  return a;
}
function polyLoop(pts) { // CCW polygon
  const out = [];
  for (let i = 0; i < pts.length; i++) out.push(L2(pts[i], pts[(i + 1) % pts.length]));
  return out;
}
function ccwLoop(pts) { // polygon of either winding, returned CCW
  let a = 0;
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; }
  return polyLoop(a < 0 ? pts.slice().reverse() : pts);
}
// rectangle u0..u1, v0..v1 (CCW) with the (u0,v1) corner rounded to radius r
function rectLoopR01(u0, v0, u1, v1, r) {
  if (r <= 0.01) return rectLoop(u0, v0, u1, v1);
  r = Math.min(r, (u1 - u0) - 1, (v1 - v0) - 1);
  return [L2([u0, v0], [u1, v0]), L2([u1, v0], [u1, v1]), L2([u1, v1], [u0 + r, v1]),
    A2([u0 + r, v1], [u0, v1 - r], [u0 + r, v1 - r], r, true), L2([u0, v1 - r], [u0, v0])];
}
// rectangle u0..u1, v0..v1 (CCW) with the (u0,v0) corner rounded to radius r
function rectLoopR00(u0, v0, u1, v1, r) {
  if (r <= 0.01) return rectLoop(u0, v0, u1, v1);
  r = Math.min(r, (u1 - u0) - 1, (v1 - v0) - 1);
  return [L2([u0 + r, v0], [u1, v0]), L2([u1, v0], [u1, v1]), L2([u1, v1], [u0, v1]), L2([u0, v1], [u0, v0 + r]),
    A2([u0, v0 + r], [u0 + r, v0], [u0 + r, v0 + r], r, true)];
}

/* ------------------------------------------------------------------ prisms
   prism = {o, u, v, n, len, loops}; point = o + a*u + b*v + w*n, n = u x v. */
function prism(o, u, v, len, loops) { return { o, u, v, n: cross(u, v), len, loops }; }
function box(x0, x1, y0, y1, z0, z1) {
  const xa = Math.min(x0, x1), xb = Math.max(x0, x1), ya = Math.min(y0, y1), yb = Math.max(y0, y1), za = Math.min(z0, z1), zb = Math.max(z0, z1);
  return prism([0, 0, za], X, Y, zb - za, [rectLoop(xa, ya, xb, yb)]);
}
// profile drawn in the (y, z) plane, extruded along +x from x0 to x1
function yzPrism(x0, x1, loop) { return prism([Math.min(x0, x1), 0, 0], Y, Z, Math.abs(x1 - x0), [loop]); }
// cylinder from p0 to p1
function cyl(d, p0, p1) {
  const ax = sub(p1, p0), L = Math.hypot(ax[0], ax[1], ax[2]), n = norm(ax);
  let u = Math.abs(n[2]) < 0.9 ? norm(cross(Z, n)) : norm(cross(X, n));
  const v = cross(n, u);
  return prism(p0, u, v, L, [circleLoop(0, 0, d / 2)]);
}
function to3(pr, p, w) { return add(add(add(pr.o, mul(pr.u, p[0])), mul(pr.v, p[1])), mul(pr.n, w || 0)); }
function prismVolume(pr) { let a = 0; for (const l of pr.loops) a += loopArea(l); return a * pr.len; }
function prismCorners(pr) {
  const out = [];
  for (const l of pr.loops) for (const p of loopPolyline(l, 6)) { out.push(to3(pr, p, 0)); out.push(to3(pr, p, pr.len)); }
  return out;
}
function prismBox(pr) {
  const c = prismCorners(pr), b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const p of c) for (let i = 0; i < 3; i++) { b[i] = Math.min(b[i], p[i]); b[i + 3] = Math.max(b[i + 3], p[i]); }
  return b;
}
// rotation about an axis parallel to X through (y=c[0], z=c[1]); positive = the top moves toward +Y (the bed opening)
function rotYZ(p, c, th) {
  const cs = Math.cos(th), sn = Math.sin(th), y = p[1] - c[0], z = p[2] - c[1];
  return [p[0], c[0] + y * cs + z * sn, c[1] - y * sn + z * cs];
}
function rotDir(d, th) { const cs = Math.cos(th), sn = Math.sin(th); return [d[0], d[1] * cs + d[2] * sn, -d[1] * sn + d[2] * cs]; }
function rotatePrism(pr, c, th) {
  const u = rotDir(pr.u, th), v = rotDir(pr.v, th);
  return Object.assign({}, pr, { o: rotYZ(pr.o, c, th), u, v, n: cross(u, v) });
}
function rotZ180(pr) {
  const f = (a) => [-a[0], -a[1], a[2]];
  const u = f(pr.u), v = f(pr.v);
  return Object.assign({}, pr, { o: f(pr.o), u, v, n: cross(u, v) });
}
function rot2(p, c, th) { // 2D (y,z) version of rotYZ
  const cs = Math.cos(th), sn = Math.sin(th), y = p[0] - c[0], z = p[1] - c[1];
  return [c[0] + y * cs + z * sn, c[1] - y * sn + z * cs];
}

/* ------------------------------------------------------------------ derived dimensions */
function runnerFor(P, depth) {
  if (P.runnerLen > 0) return P.runnerLen;
  let best = RUNNER_STD[0];
  for (const r of RUNNER_STD) if (r + RUNNER_HW.kt <= depth) best = r;
  return best;
}

function derived(P) {
  const T = P.T, g = P.gap, G = {};
  G.T = T;
  G.xA = P.W / 2;                              // cavity half width
  G.xFi = P.mW / 2 + P.gapMx;                  // frame side rail, inner face
  G.xFo = G.xFi + T;                           // frame side rail, outer face (= face panel edge, sideofmattressholder)
  G.xB = G.xFo + P.gapHydr;                    // bed-cabinet side, inner face
  G.xJ = G.xB + T;                             // joint between the bed-cabinet side and the tower side (the doubled 36)
  G.xT2 = G.xJ + T;                            // tower inner side, face toward the drawers
  G.xOo = G.xA - P.sideClear;                  // tower outer side, outer face
  G.xOi = G.xOo - T;                           // tower outer side, inner face
  G.towerIn = G.xOi - G.xT2;                   // clear width inside a tower (borderspacex)
  G.towerW = G.xOo - G.xJ;                     // tower outside width
  G.bayIn = 2 * G.xB;                          // between the bed-cabinet sides
  G.yF = P.D - P.frontSetback;                 // front face of all fronts
  G.yFb = G.yF - T;                            // back face of the fronts
  G.yC = G.yFb - P.frontGap;                   // carcass front edge
  G.yB0 = P.backGap;                           // tower back panel, rear face
  G.yB1 = P.backGap + P.Tback;                 // carcass rear edge
  G.cD = G.yC - G.yB1;                         // carcass depth
  G.zTop = P.H - P.gapAbove;                   // carcass top surface (header filler above)
  G.zTopB = G.zTop - T;
  // bed frame (closed). The face panel starts at gapBelow; the frame's head end sits faceBelowFrame higher.
  G.zFace0 = P.gapBelow;
  G.zF0 = P.gapBelow + P.faceBelowFrame;
  G.zF1 = G.zF0 + P.mL + 2 * P.gapMy + 2 * T;                 // topofmattressholder
  G.frameL = G.zF1 - G.zF0;                                   // side rail length
  G.faceL = G.zF1 - G.zFace0;                                 // mattresspanely
  G.frameW = 2 * G.xFo;                                       // mattresspanelx
  G.zBm0 = G.zF1 + P.gapHolder; G.zBm1 = G.zBm0 + T;          // shelf above the bed (topofmattressframe)
  G.antClear = G.zTopB - G.zBm1;                              // clear height in the space above the bed
  G.flapZ = [G.zBm0 - g, G.zTop - g];
  G.flapX = [g / 2, G.xJ - g];
  G.doorX = [G.xJ + g, G.xA - g];
  G.doorOverlay = P.doorHinge === 'inner' ? G.xT2 - G.doorX[0] : G.doorX[1] - G.xOi;
  G.hingeDoor = hingeFit(G.doorOverlay);          // flap overlay: its top edge over the top's front edge
  G.hingeFlap = hingeFit(G.flapZ[1] - G.zTopB);
  G.doorW = G.doorX[1] - G.doorX[0];                          // outerpanelx
  G.flapW = G.flapX[1] - G.flapX[0];                          // innerpanelx
  G.flapH = G.flapZ[1] - G.flapZ[0];                          // topinnerpanely
  // depth stack of the bed
  G.yRail = G.yFb - P.railD;                                  // side rails' top edge (toward the wall when closed)
  G.ySup1 = G.yFb - P.Tladder; G.ySup0 = G.ySup1 - P.Tsup;   // mattress support panel
  G.yM1 = G.ySup0; G.yM0 = G.yM1 - P.mT;                      // mattress
  G.zM0 = G.zF0 + T + P.gapMy; G.zM1 = G.zF1 - T - P.gapMy;
  G.pivot = [G.yFb - P.pivotFromRail, G.zF0 + P.pivotAboveHead]; // (y, z)
  G.pivotBehindFace = G.yF - G.pivot[0];
  G.deckDelta = G.pivot[1] - P.cabPivotZ;
  // kick board: one plank right across, as tall as clears the face panel's swing (its bottom edge sweeps a circle
  // about the pivot); the towers' drawers and plinths drop to sit on it, and the drop goes to the hanging space.
  const kickFull = P.gapBelow - g;
  const rMax = Math.max(Math.hypot(G.yFb - G.pivot[0], G.zFace0 - G.pivot[1]), Math.hypot(G.yF - G.pivot[0], G.zFace0 - G.pivot[1]));
  const dyK = Math.max(0, G.yFb - G.pivot[0], G.pivot[0] - G.yF);
  G.kickMax = G.pivot[1] - Math.sqrt(Math.max(0, (rMax + 6) * (rMax + 6) - dyK * dyK));
  G.kickC = P.kickCentre === 'none' ? 0 : P.kickCentre === 'auto' ? Math.min(kickFull, Math.floor(G.kickMax)) : kickFull;
  if (G.kickC < 15) G.kickC = 0;
  G.kickH = G.kickC || kickFull;                 // kick height in front of the towers
  // one-piece planks: as long as the fronts span, or as long as the longest sheet gives
  G.plankMax = Math.max(0, ...P.sheets.filter(q => q.T === T).map(q => Math.max(q.L, q.W) - 2 * P.trim));
  G.plankSpan = 2 * (G.xA - g);
  G.plankL = G.plankMax ? Math.min(G.plankSpan, Math.floor(G.plankMax)) : G.plankSpan;
  G.plankEnd = (P.W - G.plankL) / 2;             // gap from each cavity wall to the planks' ends
  const zD0 = G.kickH + g;                      // first drawer front
  G.drawerDrop = P.gapBelow - zD0;
  G.zPl = zD0;                                  // tower bottom panel, underside (plinth top)
  // drawer fronts, bottom up
  G.fronts = [];
  let z = zD0;
  P.drawers.forEach((h, i) => { G.fronts.push({ z0: z, z1: z + h, h, i }); z += h + g; });
  G.topFronts = z - g;
  G.zS1b = G.topFronts - g; G.zS1t = G.zS1b + T;              // shelf over the drawers (topofdrawersy)
  G.hangClear = P.hangClear + G.drawerDrop;
  G.zS2b = G.zS1t + G.hangClear; G.zS2t = G.zS2b + T;         // shelf over the hanging space
  G.midDoor = [G.topFronts + g, G.zS2t - 2 * g];
  G.topDoor = [G.zS2t - g, G.zTop - g];
  G.topFront = G.topDoor[1] - G.topDoor[0];                  // 700 in the TikZ (topcompartment)
  G.topClear = G.zTopB - G.zS2t;                             // clear inside the top compartment
  G.midClear = G.zS2b - G.zS1t;
  G.drawerZoneClear = G.zS1b - (G.zPl + T);
  G.effGap = P.gapHydr - (P.packer ? P.Tpacker : 0);
  G.xMount = G.xB - (P.packer ? P.Tpacker : 0);               // face the kit's cabinet-side plates screw to
  // kit hardware in this cabinet (y from the wall, z from the floor). The kit's cabinet front = face-panel front.
  G.springCab = [G.yF - P.springUpFront, G.pivot[1] + (P.springUpZ - P.cabPivotZ)];
  G.springBed = [G.yRail - P.springLowOut, G.pivot[1] - P.springLowAlong]; // on the frame (closed)
  G.stop = [G.yF - P.stopFront, G.zF1 - P.stopBelowTop];
  // legs: pivot on the side rail near the foot end
  G.legPivot = [G.yRail + P.legFromTop, G.zF1 - P.legFromFoot];
  G.legArm = (G.zF1 + 20) - G.legPivot[1];
  G.legPost = G.pivot[1] - (G.legPivot[0] - G.pivot[0]);       // height of the leg pivot once the bed is down
  G.legPostCab = P.cabPivotZ - (G.legPivot[0] - G.pivot[0]);
  // drawers
  G.runner = runnerFor(P, G.cD);
  G.boxW = G.towerIn - 2 * P.runnerClear;
  G.zRail = G.zS2b - P.railDrop;
  // tower backs stop short top and bottom so they come out of one sheet length
  const backL = Math.max(0, ...P.sheets.filter(q => q.T === P.Tback).map(q => q.L - 2 * P.trim));
  G.backInset = Math.max(3, backL ? Math.ceil(((G.zTop - G.zPl) - backL) / 2) + 1 : 3);
  return G;
}

/* ------------------------------------------------------------------ model */
const COLORS = { // RGB 0..1 for STEP; the viewer has matching styles
  carcass: [0.86, 0.76, 0.59], front: [0.91, 0.84, 0.70], frame: [0.80, 0.66, 0.46], deck: [0.84, 0.72, 0.53],
  drawer: [0.89, 0.80, 0.64], back: [0.80, 0.71, 0.55], plinth: [0.74, 0.63, 0.47], packer: [0.70, 0.55, 0.36],
  ledge: [0.86, 0.76, 0.59], mattress: [0.93, 0.93, 0.91], metal: [0.20, 0.21, 0.23], chrome: [0.78, 0.79, 0.81], zinc: [0.70, 0.73, 0.77],
  block: [0.55, 0.38, 0.22], rubber: [0.10, 0.10, 0.11], strap: [0.24, 0.30, 0.44],
};

function build(params, opts) {
  opts = opts || {};
  const P = normParams(params), G = derived(P), T = P.T, g = P.gap;
  const parts = [];
  const bedTh = (opts.bedAngle || 0) * Math.PI / 180;
  // part: {mark, name, grp, kind, T, L, W, grain, band, solids, anim, hw}
  const put = (o) => { parts.push(Object.assign({ grain: false, band: 0 }, o)); return o; };
  const sides = [['R', -1], ['L', 1]]; // facing the wall from the room, -x is on your right
  const sx = (s, x0, x1) => s < 0 ? [-x1, -x0] : [x0, x1];
  // Blum CLIP top BLUMOTION 110 deg (71B3550) on a CLIP cruciform plate. The cup, its flange and screws go with the
  // door; the plate (37 back, holes 32 apart) and the arm stay on the side panel; two links, re-aimed as the door
  // opens, join the arm's knuckle to the cup. edge: |x| of the door's hinge edge, face: |x| of the side panel's inner
  // face, dir: +1 when the cabinet's inside is toward larger |x|. F: plate and boring distance from hingeFit.
  // Arm outline in (k, v): k off the panel, v from the carcase front edge; the plate is ph high, the arm S at most.
  const hingeArm = (F) => {
    const ph = F.h, S = F.S;
    return [[ph - 0.5, -64], [S - 3.5, -64], [S, -56], [S, -12], [S - 4.5, -1], [5 + F.H, -1], [5 + F.H, -22], [ph - 0.5, -26]];
  };
  const cupHinge = (s, edge, face, dir, z, name, anim) => {
    const F = G.hingeDoor, hw = HINGE_HW, mx = (x) => s * x, xr = (a, b) => sx(s, Math.min(a, b), Math.max(a, b));
    const cx = edge + dir * F.cup, fx = cx + dir * hw.screws[1], d = (k) => face + dir * k;
    const yp = G.yC - hw.line, fl = hw.flange, sc = hw.screws[0] / 2;
    put({ mark: 'HG', name, grp: 'hardware', kind: 'chrome', hw: true, anim,
      solids: [cyl(hw.cup, [mx(cx), G.yFb + hw.bore - 0.5, z], [mx(cx), G.yFb - 0.8, z]), // cup, rim 0.8 proud over the panel edge
        box(...xr(fx - fl[1] / 2, fx + fl[1] / 2), G.yFb - fl[2], G.yFb, z - fl[0] / 2, z + fl[0] / 2),
        cyl(8, [mx(fx), G.yFb - fl[2], z - sc], [mx(fx), G.yFb - fl[2] - 1.2, z - sc]), cyl(8, [mx(fx), G.yFb - fl[2], z + sc], [mx(fx), G.yFb - fl[2] - 1.2, z + sc])] });
    put({ mark: 'HG', name: `${name} arm and ${F.H} mm plate`, grp: 'hardware', kind: 'chrome', hw: true,
      solids: [box(...xr(d(0), d(2)), yp - 5.75, yp + 5.75, z - 25, z + 25), box(...xr(d(0), d(F.h)), yp - 18, yp + 10, z - 7, z + 7),
        prism([0, 0, z - 10], X, Y, 20, [ccwLoop(hingeArm(F).map(([k, v]) => [mx(d(k)), G.yC + v]))]),
        cyl(8, [mx(d(2)), yp, z - hw.pitch / 2], [mx(d(3.2)), yp, z - hw.pitch / 2]), cyl(8, [mx(d(2)), yp, z + hw.pitch / 2], [mx(d(3.2)), yp, z + hw.pitch / 2]),
        cyl(7, [mx(d(F.S)), G.yC - 20, z], [mx(d(F.S + 1)), G.yC - 20, z]), cyl(7, [mx(d(F.S)), G.yC - 44, z], [mx(d(F.S + 1)), G.yC - 44, z])] });
    const kx = mx(d(8 + F.H)), dyn = { type: 'link', move: 'door', id: anim.id, axis: anim.axis, sign: anim.sign,
      links: [-4.5, 4.5].map(dz => [[kx, G.yC - 3, z + dz], [mx(cx), G.yFb + 2, z + dz]]) };
    put({ mark: 'HG', name: name + ' links', grp: 'hardware', kind: 'chrome', hw: true, dyn, solids: linkSolids(dyn, 0) });
  };
  // the same hinge on a top-hinged flap: plate and arm under the top, cup below the flap's top edge
  const flapHinge = (c, S, k, anim) => {
    const F = G.hingeFlap, hw = HINGE_HW, zf = G.zTopB, cz = G.flapZ[1] - F.cup, fz = cz - hw.screws[1];
    const yp = G.yC - hw.line, fl = hw.flange, sc = hw.screws[0] / 2, nm = `Flap hinge (${S}) ${k + 1}`;
    put({ mark: 'FH', name: nm, grp: 'hardware', kind: 'chrome', hw: true, anim,
      solids: [cyl(hw.cup, [c, G.yFb + hw.bore - 0.5, cz], [c, G.yFb - 0.8, cz]),
        box(c - fl[0] / 2, c + fl[0] / 2, G.yFb - fl[2], G.yFb, fz - fl[1] / 2, fz + fl[1] / 2),
        cyl(8, [c - sc, G.yFb - fl[2], fz], [c - sc, G.yFb - fl[2] - 1.2, fz]), cyl(8, [c + sc, G.yFb - fl[2], fz], [c + sc, G.yFb - fl[2] - 1.2, fz])] });
    put({ mark: 'FH', name: `${nm} arm and ${F.H} mm plate`, grp: 'hardware', kind: 'chrome', hw: true,
      solids: [box(c - 25, c + 25, yp - 5.75, yp + 5.75, zf - 2, zf), box(c - 7, c + 7, yp - 18, yp + 10, zf - F.h, zf),
        yzPrism(c - 10, c + 10, ccwLoop(hingeArm(F).map(([kk, v]) => [G.yC + v, zf - kk]))),
        cyl(8, [c - hw.pitch / 2, yp, zf - 2], [c - hw.pitch / 2, yp, zf - 3.2]), cyl(8, [c + hw.pitch / 2, yp, zf - 2], [c + hw.pitch / 2, yp, zf - 3.2]),
        cyl(7, [c, G.yC - 20, zf - F.S], [c, G.yC - 20, zf - F.S - 1]), cyl(7, [c, G.yC - 44, zf - F.S], [c, G.yC - 44, zf - F.S - 1])] });
    const dyn = { type: 'link', move: 'flap', id: anim.id, axis: anim.axis, links: [-4.5, 4.5].map(dx => [[c + dx, G.yC - 3, zf - 8 - F.H], [c + dx, G.yFb + 2, cz]]) };
    put({ mark: 'FH', name: nm + ' links', grp: 'hardware', kind: 'chrome', hw: true, dyn, solids: linkSolids(dyn, 0) });
  };

  // ---------------- towers (left and right are mirror images)
  for (const [S, s] of sides) {
    const grp = 'tower-' + S, nm = (t) => `${t} (${S})`;
    const zIn0 = G.zPl + T, zIn1 = G.zTopB;
    const [ox0, ox1] = sx(s, G.xOi, G.xOo);
    put({ mark: 'T1', name: nm('Tower outer side'), grp, kind: 'carcass', T, L: zIn1 - zIn0, W: G.cD, grain: true, band: zIn1 - zIn0,
      solids: [box(ox0, ox1, G.yB1, G.yC, zIn0, zIn1)] });
    const [ix0, ix1] = sx(s, G.xJ, G.xT2);
    put({ mark: 'T2', name: nm('Tower inner side'), grp, kind: 'carcass', T, L: zIn1 - zIn0, W: G.cD, grain: true, band: zIn1 - zIn0,
      solids: [box(ix0, ix1, G.yB1, G.yC, zIn0, zIn1)] });
    const [tx0, tx1] = sx(s, G.xJ, G.xOo);
    put({ mark: 'T3', name: nm('Tower bottom'), cutName: 'Tower top / bottom', grp, kind: 'carcass', T, L: G.towerW, W: G.cD, band: G.towerW, solids: [box(tx0, tx1, G.yB1, G.yC, G.zPl, G.zPl + T)] });
    put({ mark: 'T3', name: nm('Tower top'), cutName: 'Tower top / bottom', grp, kind: 'carcass', T, L: G.towerW, W: G.cD, band: G.towerW, solids: [box(tx0, tx1, G.yB1, G.yC, G.zTopB, G.zTop)] });
    const [hx0, hx1] = sx(s, G.xT2, G.xOi);
    put({ mark: 'T4', name: nm('Fixed shelf over drawers'), cutName: 'Fixed shelf', grp, kind: 'carcass', T, L: G.towerIn, W: G.cD, band: G.towerIn, solids: [box(hx0, hx1, G.yB1, G.yC, G.zS1b, G.zS1t)] });
    put({ mark: 'T4', name: nm('Fixed shelf over hanging'), cutName: 'Fixed shelf', grp, kind: 'carcass', T, L: G.towerIn, W: G.cD, band: G.towerIn, solids: [box(hx0, hx1, G.yB1, G.yC, G.zS2b, G.zS2t)] });
    if (P.topShelf) {
      const zc = (G.zS2t + G.zTopB) / 2;
      const [ax0, ax1] = sx(s, G.xT2 + 1, G.xOi - 1);
      put({ mark: 'T5', name: nm('Adjustable shelf, top compartment'), grp, kind: 'carcass', T, L: G.towerIn - 2, W: G.cD - 20, band: G.towerIn - 2,
        solids: [box(ax0, ax1, G.yB1, G.yC - 20, zc - T / 2, zc + T / 2)] });
    }
    const [bx0, bx1] = sx(s, G.xJ, G.xOo);
    const bIn = G.backInset;
    put({ mark: 'T6', name: nm('Tower back'), grp, kind: 'back', T: P.Tback, L: (G.zTop - G.zPl) - 2 * bIn, W: G.towerW, grain: false,
      solids: [box(bx0, bx1, G.yB0, G.yB1, G.zPl + bIn, G.zTop - bIn)] });
    // plinth ladder under the tower
    const Tp = P.Tplinth;
    put({ mark: 'P1', name: nm('Plinth front'), cutName: 'Plinth front / back', grp, kind: 'plinth', T: Tp, L: G.towerW, W: G.zPl, solids: [box(tx0, tx1, G.yC - Tp, G.yC, 0, G.zPl)] });
    put({ mark: 'P1', name: nm('Plinth back'), cutName: 'Plinth front / back', grp, kind: 'plinth', T: Tp, L: G.towerW, W: G.zPl, solids: [box(tx0, tx1, G.yB1, G.yB1 + Tp, 0, G.zPl)] });
    const pl = G.cD - 2 * Tp;
    const [p1a, p1b] = sx(s, G.xOo - Tp, G.xOo), [p2a, p2b] = sx(s, G.xJ, G.xJ + Tp);
    put({ mark: 'P2', name: nm('Plinth end, outer'), cutName: 'Plinth end', grp, kind: 'plinth', T: Tp, L: pl, W: G.zPl, solids: [box(p1a, p1b, G.yB1 + Tp, G.yC - Tp, 0, G.zPl)] });
    put({ mark: 'P2', name: nm('Plinth end, inner'), cutName: 'Plinth end', grp, kind: 'plinth', T: Tp, L: pl, W: G.zPl, solids: [box(p2a, p2b, G.yB1 + Tp, G.yC - Tp, 0, G.zPl)] });
    // hanging rail (hardware)
    const [rx0, rx1] = sx(s, G.xT2 + 2, G.xOi - 2);
    put({ mark: 'HR', name: nm('Hanging rail, 25 dia.'), grp, kind: 'chrome', hw: true, solids: [cyl(25, [rx0, (G.yB1 + G.yC) / 2, G.zRail], [rx1, (G.yB1 + G.yC) / 2, G.zRail])] });
    // drawers: fronts, boxes, runners
    const boxD = G.runner, Tb = P.Tb;
    G.fronts.forEach((f, i) => {
      const [fx0, fx1] = sx(s, G.doorX[0], G.doorX[1]);
      const dgrp = 'drawers-' + S, anim = { type: 'drawer', id: `drawer-${S}-${i + 1}`, dist: boxD }; // full extension
      put({ mark: 'D3', name: nm(`Drawer front ${i + 1}`), grp: 'fronts-' + S, kind: 'front', T, L: f.h, W: G.doorW, grain: true, band: 2 * (f.h + G.doorW), hgt: f.h,
        solids: [box(fx0, fx1, G.yFb, G.yF, f.z0, f.z1)], anim });
      const bh = f.h - P.boxLess, bz0 = f.z0 + P.boxLess / 2, by0 = G.yC - boxD;
      const [b0, b1] = sx(s, G.xT2 + P.runnerClear, G.xOi - P.runnerClear);
      const xa = Math.min(b0, b1), xb = Math.max(b0, b1);
      put({ mark: 'X1', name: nm(`Drawer ${i + 1} side`), grp: dgrp, kind: 'drawer', T: Tb, L: boxD, W: bh, grain: false, hgt: bh, solids: [box(xa, xa + Tb, by0, G.yC, bz0, bz0 + bh)], anim });
      put({ mark: 'X1', name: nm(`Drawer ${i + 1} side`), grp: dgrp, kind: 'drawer', T: Tb, L: boxD, W: bh, grain: false, hgt: bh, solids: [box(xb - Tb, xb, by0, G.yC, bz0, bz0 + bh)], anim });
      put({ mark: 'X2', name: nm(`Drawer ${i + 1} front/back`), grp: dgrp, kind: 'drawer', T: Tb, L: G.boxW - 2 * Tb, W: bh, grain: false, hgt: bh, solids: [box(xa + Tb, xb - Tb, G.yC - Tb, G.yC, bz0, bz0 + bh)], anim });
      put({ mark: 'X2', name: nm(`Drawer ${i + 1} front/back`), grp: dgrp, kind: 'drawer', T: Tb, L: G.boxW - 2 * Tb, W: bh, grain: false, hgt: bh, solids: [box(xa + Tb, xb - Tb, by0, by0 + Tb, bz0, bz0 + bh)], anim });
      const gr = Math.min(6, Tb / 2);
      put({ mark: 'X3', name: nm(`Drawer ${i + 1} bottom`), grp: dgrp, kind: 'back', T: P.Tback, L: boxD - 2 * Tb + 2 * gr, W: G.boxW - 2 * Tb + 2 * gr, grain: false,
        solids: [box(xa + Tb - gr, xb - Tb + gr, by0 + Tb - gr, G.yC - Tb + gr, bz0 + 8, bz0 + 8 + P.Tback)], anim });
      // runners (Hettich KA 5632): three nested steel channels each side, flush with the carcase's front edge. The
      // cabinet member is screwed to the side panel through its system holes, the intermediate member travels half
      // as far as the drawer, and the drawer member is screwed to the box side.
      const zc = bz0 + bh / 2, ku = Math.max(P.runnerClear, 3) / RUNNER_HW.w, half = Object.assign({}, anim, { k: 0.5 });
      G.runnerZ = G.runnerZ || []; if (s > 0) G.runnerZ[i] = zc;
      const member = (face, dir, prof, y0, y1) => prism([0, y0, 0], Z, X, y1 - y0, [ccwLoop(prof.map(([u, w]) => [zc + w, face + dir * u * ku]))]);
      const holes = runnerHoles(boxD), use = holes.length > 3 ? [holes[0], holes[1], holes[2], holes[holes.length - 1]] : holes;
      for (const [face, dir, where] of [[s * G.xT2, s, 'bed side'], [s * G.xOi, -s, 'wall side']]) {
        const rn = (t) => nm(`Drawer ${i + 1} runner, ${RUNNER_HW.name} ${boxD}, ${where}, ${t}`);
        const screw = (y) => cyl(8, [face + dir * 1.2 * ku, y, zc], [face + dir * 2.3 * ku, y, zc]);
        put({ mark: 'RN', name: rn('cabinet member'), grp: dgrp, kind: 'zinc', hw: true, pick: anim.id,
          solids: [member(face, dir, RUNNER_PROFILE.outer, G.yC - boxD, G.yC), ...use.map(h => screw(G.yC - h))] });
        put({ mark: 'RN', name: rn('intermediate member'), grp: dgrp, kind: 'zinc', hw: true, anim: half,
          solids: [member(face, dir, RUNNER_PROFILE.mid, G.yC - boxD + 6, G.yC - 3)] });
        put({ mark: 'RN', name: rn('drawer member'), grp: dgrp, kind: 'zinc', hw: true, anim,
          solids: [member(face, dir, RUNNER_PROFILE.inner, G.yC - boxD + 10, G.yC)] });
      }
    });
    // doors, hinged on the wall side (outer) or the bed side (inner)
    const [dx0, dx1] = sx(s, G.doorX[0], G.doorX[1]);
    const inner = P.doorHinge === 'inner';
    const hingeEdge = inner ? G.doorX[0] : G.doorX[1];
    const sideFace = inner ? G.xT2 : G.xOi;
    for (const [mk, nmD, zr] of [['D2', 'Hanging-space door', G.midDoor], ['D1', 'Top door', G.topDoor]]) {
      const anim = { type: 'door', id: `door-${S}-${mk}`, axis: [s * hingeEdge, G.yF], sign: inner ? -s : s };
      const hz = hingeZs(zr);
      put({ mark: mk, name: nm(nmD), grp: 'fronts-' + S, kind: 'front', T, L: zr[1] - zr[0], W: G.doorW, grain: true,
        band: 2 * (zr[1] - zr[0] + G.doorW), solids: [box(dx0, dx1, G.yFb, G.yF, zr[0], zr[1])], anim, hinges: hz, hingeEdge });
      hz.forEach((z, k) => cupHinge(s, hingeEdge, sideFace, inner ? 1 : -1, z, nm(`${nmD} hinge ${k + 1}`), anim));
    }
    // kick board and header filler in front of the tower
    if (!G.kickC) put({ mark: 'K1', name: nm('Kick board'), grp: 'fronts-' + S, kind: 'front', T, L: G.doorW, W: G.kickH, grain: false, band: G.doorW,
      solids: [box(dx0, dx1, G.yFb, G.yF, 0, G.kickH)] });
  }

  // ---------------- bed cabinet
  const bgrp = 'bed-cabinet';
  for (const [S, s] of sides) {
    const [x0, x1] = sx(s, G.xB, G.xJ);
    put({ mark: 'B1', name: `Bed-cabinet side (${S})`, grp: bgrp, kind: 'carcass', T, L: G.zBm0, W: G.cD, grain: true, band: G.zBm0,
      solids: [box(x0, x1, G.yB1, G.yC, 0, G.zBm0)] });
    if (P.packer) {
      const [k0, k1] = sx(s, G.xB - P.Tpacker, G.xB);
      put({ mark: 'B8', name: `Pivot packer (${S})`, grp: bgrp, kind: 'packer', T: P.Tpacker, L: P.packerH, W: P.packerDepth, grain: false,
        solids: [box(k0, k1, G.yC - P.packerDepth, G.yC, 0, P.packerH)] });
      put({ mark: 'B9', name: `Bed-stop packer (${S})`, grp: bgrp, kind: 'packer', T: P.Tpacker, L: 140, W: 100, grain: false,
        solids: [box(k0, k1, G.stop[0] - 50, G.stop[0] + 50, G.stop[1] - 70, G.stop[1] + 70)] });
    }
  }
  const stT = P.edgeSteel ? P.steelT : 0;
  G.steel = P.edgeSteel ? { x: G.xB, y0: G.yC - stT, y1: G.yC, z0: G.zBm1 - P.steelH, z1: G.zBm1 } : null;
  put({ mark: 'B2', name: P.edgeSteel ? 'Shelf over the bed, front notched for the steel flat' : 'Shelf over the bed', grp: bgrp, kind: 'carcass', T, L: 2 * G.xJ, W: G.cD, grain: true, band: 2 * G.xJ,
    solids: [P.edgeSteel ? prism([0, 0, G.zBm0], X, Y, T, [polyLoop([[-G.xJ, G.yB1], [G.xJ, G.yB1], [G.xJ, G.yC], [G.xB, G.yC], [G.xB, G.yC - stT], [-G.xB, G.yC - stT], [-G.xB, G.yC], [-G.xJ, G.yC]])])
      : box(-G.xJ, G.xJ, G.yB1, G.yC, G.zBm0, G.zBm1)],
    draw: P.edgeSteel ? [box(-G.xJ, G.xJ, G.yB1, G.yC - stT, G.zBm0, G.zBm1), box(G.xB, G.xJ, G.yC - stT, G.yC, G.zBm0, G.zBm1), box(-G.xJ, -G.xB, G.yC - stT, G.yC, G.zBm0, G.zBm1)] : null });
  if (P.edgeSteel) put({ mark: 'SF', name: `Steel flat ${Math.round(P.steelH)} x ${Math.round(P.steelT)} in the shelf's front edge`, grp: 'hardware', kind: 'metal', hw: true,
    solids: [box(-G.xB, G.xB, G.yC - stT, G.yC, G.zBm1 - P.steelH, G.zBm1)] });
  put({ mark: 'B3', name: 'Top over the bed', grp: bgrp, kind: 'carcass', T, L: 2 * G.xJ, W: G.cD, grain: true, band: 2 * G.xJ,
    solids: [box(-G.xJ, G.xJ, G.yB1, G.yC, G.zTopB, G.zTop)] });
  G.twin = P.lockType === 'twin' ? { notchD: 72, notchH: 130, block: [100, 50, 40], bar: [100, 30, 6], knob: [30, 22], lift: P.lockDepth + P.gapHolder + 3 } : null;
  const divLoop = G.twin ? polyLoop([[G.yB1, G.zBm1], [G.yC - G.twin.notchD, G.zBm1], [G.yC - G.twin.notchD, G.zBm1 + G.twin.notchH], [G.yC, G.zBm1 + G.twin.notchH], [G.yC, G.zTopB], [G.yB1, G.zTopB]])
    : rectLoop(G.yB1, G.zBm1, G.yC, G.zTopB);
  put({ mark: 'B4', name: G.twin ? 'Centre divider, notched at its front foot' : 'Centre divider', grp: bgrp, kind: 'carcass', T, L: G.zTopB - G.zBm1, W: G.cD, grain: true, band: G.zTopB - G.zBm1,
    solids: [yzPrism(-T / 2, T / 2, divLoop)],
    draw: G.twin ? [box(-T / 2, T / 2, G.yB1, G.yC - G.twin.notchD, G.zBm1, G.zBm1 + G.twin.notchH), box(-T / 2, T / 2, G.yB1, G.yC, G.zBm1 + G.twin.notchH, G.zTopB)] : null });
  // upper bed-cabinet sides between the shelf and the top: the doubled 2 x 18 sides run the full height, broken only
  // by the shelf (and its steel flat) passing through, so shelf, sides, divider and top make one box
  for (const [S, s] of sides) {
    const [x0, x1] = sx(s, G.xB, G.xJ);
    put({ mark: 'B10', name: `Bed-cabinet side, upper (${S})`, grp: bgrp, kind: 'carcass', T, L: G.antClear, W: G.cD, grain: true, band: G.antClear,
      solids: [box(x0, x1, G.yB1, G.yC, G.zBm1, G.zTopB)] });
  }
  // 6 mm back over the shelf space: on the back edges of the shelf, upper sides, divider and top, tying the box
  put({ mark: 'B11', name: 'Back over the bed, 6 mm', grp: bgrp, kind: 'back', T: P.Tback, L: 2 * G.xJ, W: G.zTop - G.zBm0 - 4, grain: false,
    solids: [box(-G.xJ, G.xJ, G.yB0, G.yB1, G.zBm0 + 2, G.zTop - 2)] });
  if (P.upstand > 0) for (const [S, s] of sides) {
    const [x0, x1] = sx(s, T / 2, G.xJ);
    put({ mark: 'B5', name: `Shelf stiffener, front (${S})`, grp: bgrp, kind: 'carcass', T, L: G.xJ - T / 2, W: P.upstand, grain: false, band: G.xJ - T / 2,
      solids: [box(x0, x1, G.yC - T, G.yC, G.zBm1, G.zBm1 + P.upstand)] });
  }
  put({ mark: 'B6', name: 'Wall rail under the shelf', grp: bgrp, kind: 'carcass', T, L: 2 * G.xB, W: P.wallRail, grain: false,
    solids: [box(-G.xB, G.xB, G.yB1, G.yB1 + T, G.zBm0 - P.wallRail, G.zBm0)] });
  for (const [S, s] of sides) {
    const [x0, x1] = sx(s, T / 2, G.xB);
    put({ mark: 'B7', name: `Wall rail under the top (${S})`, grp: bgrp, kind: 'carcass', T, L: G.xB - T / 2, W: P.wallRail, grain: false,
      solids: [box(x0, x1, G.yB1, G.yB1 + T, G.zTopB - P.wallRail, G.zTopB)] });
  }
  // flaps above the bed: hinged at the top edge, gas stays each side, a push latch, and the safety pins behind them
  const flapAxis = [G.yF, G.flapZ[1]];
  G.flapHw = { hinges: [G.flapX[0] + 90, G.flapX[1] - 90], stays: [G.xB - 12, T / 2 + 12], latch: Math.min(G.flapX[1] - 160, Math.max(G.flapX[0] + 160, (G.flapX[0] + G.flapX[1]) / 2 + 170)) };
  G.pinY = Math.min(G.yFb - P.footRailD / 2, G.yC - (P.upstand > 0 ? T : 0) - 27);
  for (const [S, s] of sides) {
    const [x0, x1] = sx(s, G.flapX[0], G.flapX[1]);
    const anim = { type: 'flap', id: `flap-${S}`, axis: flapAxis };
    put({ mark: 'D4', name: `Lift-up flap (${S})`, grp: 'fronts-C', kind: 'front', T, L: G.flapH, W: G.flapW, grain: true, band: 2 * (G.flapH + G.flapW),
      solids: [box(x0, x1, G.yFb, G.yF, G.flapZ[0], G.flapZ[1])], anim });
    G.flapHw.hinges.forEach((hx, k) => { const [c] = sx(s, hx, hx); flapHinge(c, S, k, anim); });
    G.flapHw.stays.forEach((hx, k) => {
      const [c] = sx(s, hx, hx);
      const dyn = { type: 'stay', id: anim.id, x: c, fixed: [G.yC - 250, G.zBm1 + 50], flap: [G.yFb - 10, G.flapZ[1] - 150], axis: flapAxis };
      put({ mark: 'FS', name: `Flap gas stay (${S}) ${k + 1}`, grp: 'hardware', kind: 'metal', hw: true, dyn, solids: staySolids(dyn, 0) });
    });
    const [lx] = sx(s, G.flapHw.latch, G.flapHw.latch);
    if (P.upstand >= 25) put({ mark: 'PL', name: `Push latch (${S})`, grp: 'hardware', kind: 'metal', hw: true,
      solids: [cyl(20, [lx, G.yC - 40, G.zBm1 + P.upstand / 2], [lx, G.yC + 0.5, G.zBm1 + P.upstand / 2])] });
    else put({ mark: 'PL', name: `Push latch (${S}), drilled into the shelf edge`, grp: 'hardware', kind: 'metal', hw: true,
      solids: [cyl(10, [lx, G.yC - 30, (G.zBm0 + G.zBm1) / 2], [lx, G.yC + 0.5, (G.zBm0 + G.zBm1) / 2])] });
    if (P.lockType === 'pins') {
      const [px] = sx(s, P.lockPinX, P.lockPinX);
      const zb = G.zBm1, top = zb + 45;
      put({ mark: 'LP', name: `Safety pin block (${S}), hardwood`, grp: 'hardware', kind: 'block', hw: true,
        solids: [box(px - 25, px + 25, G.pinY - 25, G.pinY + 25, zb, top)] });
      const dyn = { type: 'pin', lift: P.lockDepth + P.gapHolder + 8 };
      put({ mark: 'LP', name: `Safety pin (${S}), 10 dia.`, grp: 'hardware', kind: 'chrome', hw: true, dyn,
        solids: [cyl(10, [px, G.pinY, top + 12], [px, G.pinY, G.zF1 - P.lockDepth]), cyl(26, [px, G.pinY, top + 12], [px, G.pinY, top + 24])] });
    }
  }
  if (G.twin) {
    // twin pin: two 10 mm pins nutted through one bar, straddling the divider in its front notch
    const tw = G.twin, hs = P.twinSpacing / 2, zb = G.zBm1, bt = zb + tw.block[2], y = G.pinY;
    put({ mark: 'LP', name: 'Twin-pin guide block, hardwood', grp: 'hardware', kind: 'block', hw: true,
      solids: [box(-tw.block[0] / 2, tw.block[0] / 2, y - tw.block[1] / 2, y + tw.block[1] / 2, zb, bt)] });
    const dyn = { type: 'pin', lift: tw.lift };
    put({ mark: 'LP', name: 'Twin pin, 2 x 10 dia. on a steel bar', grp: 'hardware', kind: 'chrome', hw: true, dyn,
      solids: [-hs, hs].map(x => cyl(10, [x, y, bt + tw.bar[2] + 5], [x, y, G.zF1 - P.lockDepth])) });
    put({ mark: 'LP', name: 'Twin-pin bar and nuts', grp: 'hardware', kind: 'metal', hw: true, dyn,
      solids: [box(-tw.bar[0] / 2, tw.bar[0] / 2, y - tw.bar[1] / 2, y + tw.bar[1] / 2, bt, bt + tw.bar[2])].concat([-hs, hs].map(x => cyl(17, [x, y, bt + tw.bar[2]], [x, y, bt + tw.bar[2] + 5]))) });
    put({ mark: 'LP', name: 'Twin-pin knob', grp: 'hardware', kind: 'block', hw: true, dyn,
      solids: [cyl(tw.knob[0], [0, y, bt + tw.bar[2]], [0, y, bt + tw.bar[2] + tw.knob[1]])] });
    if (P.lockTab) put({ mark: 'LP', name: 'Twin-pin tab, 2 mm, out through the flap joint', grp: 'hardware', kind: 'metal', hw: true, dyn,
      solids: [box(-1, 1, y + 18, G.yF + 15, bt + tw.bar[2], bt + tw.bar[2] + 20)] });
  }
  // header filler: one plank right across, scribed to the ceiling
  if (P.gapAbove > 0) put({ mark: 'K3', name: 'Header filler, one piece', grp: 'fronts-C', kind: 'front', T, L: G.plankL, W: P.gapAbove, grain: false, band: G.plankL,
    solids: [box(-G.plankL / 2, G.plankL / 2, G.yFb, G.yF, G.zTop, P.H)] });
  // battens glued behind the header's bottom edge, sitting on the tops: screwed up through the tops from inside
  if (P.gapAbove >= T + 10) {
    const bw = 30, xe = Math.min(G.xOo, G.plankL / 2);
    for (const [nmB, x0, x1] of [['Header batten (R)', -xe, -G.xJ], ['Header batten, centre', -G.xJ, G.xJ], ['Header batten (L)', G.xJ, xe]])
      put({ mark: 'B12', name: nmB, cutName: 'Header batten', grp: 'fronts-C', kind: 'carcass', T, L: x1 - x0, W: bw, grain: false,
        solids: [box(x0, x1, G.yFb - bw, G.yFb, G.zTop, G.zTop + T)] });
  }

  // ---------------- bed frame (built closed, then turned about the pivot)
  const fput = (o) => { o.bed = true; put(o); return o; };
  if (G.twin) fput({ mark: 'LP', name: 'Strike plate in the foot rail', grp: 'hardware', kind: 'chrome', hw: true,
    solids: [box(-P.twinSpacing / 2 - 15, P.twinSpacing / 2 + 15, G.pinY - 12, G.pinY + 12, G.zF1 - 3, G.zF1)] });
  const ov = P.faceOverhang;
  fput({ mark: 'F1', name: 'Bed face panel (R)', grp: 'bed-frame', kind: 'front', T, L: G.faceL, W: G.xFo + ov, grain: true, band: G.faceL + 2 * (G.xFo + ov),
    solids: [box(-(G.xFo + ov), 0, G.yFb, G.yF, G.zFace0, G.zF1)] });
  fput({ mark: 'F1', name: 'Bed face panel (L)', grp: 'bed-frame', kind: 'front', T, L: G.faceL, W: G.xFo + ov, grain: true, band: G.faceL + 2 * (G.xFo + ov),
    solids: [box(0, G.xFo + ov, G.yFb, G.yF, G.zFace0, G.zF1)] });
  for (const [S, s] of sides) {
    const [x0, x1] = sx(s, G.xFi, G.xFo);
    fput({ mark: 'F2', name: `Side rail (${S})`, grp: 'bed-frame', kind: 'frame', T, L: G.frameL, W: P.railD, grain: false,
      solids: [yzPrism(x0, x1, rectLoopR01(G.yRail, G.zF0, G.yFb, G.zF1, P.railR))] });
  }
  fput({ mark: 'F3', name: 'Head rail', grp: 'bed-frame', kind: 'frame', T, L: 2 * G.xFi, W: P.headRailD, solids: [box(-G.xFi, G.xFi, G.yFb - P.headRailD, G.yFb, G.zF0, G.zF0 + T)] });
  fput({ mark: 'F4', name: 'Foot rail', grp: 'bed-frame', kind: 'frame', T, L: 2 * G.xFi, W: P.footRailD, solids: [box(-G.xFi, G.xFi, G.yFb - P.footRailD, G.yFb, G.zF1 - T, G.zF1)] });
  const Tl = P.Tladder, lw = P.ladderW, zi0 = G.zF0 + T, zi1 = G.zF1 - T;
  for (const [S, s] of sides) {
    const [x0, x1] = sx(s, G.xFi - lw, G.xFi);
    fput({ mark: 'F5', name: `Deck long strut (${S})`, grp: 'bed-frame', kind: 'deck', T: Tl, L: zi1 - zi0, W: lw, solids: [box(x0, x1, G.ySup1, G.yFb, zi0, zi1)] });
  }
  for (let i = 0; i < P.struts; i++) {
    const zc = zi0 + i * (zi1 - zi0 - lw) / (P.struts - 1);
    fput({ mark: 'F6', name: `Deck cross strut ${i + 1}`, grp: 'bed-frame', kind: 'deck', T: Tl, L: 2 * (G.xFi - lw), W: lw, solids: [box(-(G.xFi - lw), G.xFi - lw, G.ySup1, G.yFb, zc, zc + lw)] });
  }
  for (const [S, s] of sides) {
    const [x0, x1] = sx(s, 0, G.xFi);
    fput({ mark: 'F7', name: `Mattress support (${S})`, grp: 'bed-frame', kind: 'deck', T: P.Tsup, L: zi1 - zi0, W: G.xFi, grain: false, solids: [box(x0, x1, G.ySup0, G.ySup1, zi0, zi1)] });
  }
  fput({ mark: 'MT', name: `Mattress ${P.mW} x ${P.mL} x ${P.mT}`, grp: 'mattress', kind: 'mattress', hw: true, mattress: true,
    solids: [box(-P.mW / 2, P.mW / 2, G.yM0, G.yM1, G.zM0, G.zM1)] });
  // straps (kit supplies two), schematic
  for (const zs of [G.zM1 - 406, G.zM0 + 406]) fput({ mark: 'SP', name: 'Mattress strap', grp: 'hardware', kind: 'strap', hw: true,
    solids: [box(-P.mW / 2 - 3, P.mW / 2 + 3, G.yM0 - 3, G.yM0, zs - 20, zs + 20)] });
  // handles: the kit puts two handles on the face panel between 5 and 6 ft up
  const hz = Math.min(G.zF1 - 150, Math.max(G.zF0 + 600, 1676));
  for (const hxv of [-70, 70]) fput({ mark: 'HD', name: 'Bed handle', grp: 'hardware', kind: 'metal', hw: true,
    solids: [cyl(12, [hxv, G.yF + 30, hz - 100], [hxv, G.yF + 30, hz + 100]), cyl(10, [hxv, G.yF, hz - 90], [hxv, G.yF + 30, hz - 90]), cyl(10, [hxv, G.yF, hz + 90], [hxv, G.yF + 30, hz + 90])] });
  const [yp, zp] = G.pivot;
  for (const [S, s] of sides) {
    // pivot: female plate inside the side rail (bush through a 1 in hole), male plate and bar on the cabinet side
    fput({ mark: 'PV', name: `Female pivot plate (${S})`, grp: 'hardware', kind: 'metal', hw: true,
      solids: [box(...sx(s, G.xFi - 4, G.xFi), yp - 38, yp + 38, zp - 38, zp + 38)] });
    put({ mark: 'PV', name: `Male pivot plate and bar (${S})`, grp: 'hardware', kind: 'metal', hw: true,
      solids: [box(...sx(s, G.xMount - 4, G.xMount), yp - 38, yp + 38, zp - 50, zp + 50), cyl(16, [s * (G.xMount - 4), yp, zp], [s * (G.xFi - 2), yp, zp])] });
    // gas spring: lower ball stud plate on the outside of the rail (overhangs the head end 1/4 in), upper plate on the cabinet side
    const [bs0, bs1] = sx(s, G.xFo, G.xFo + 3);
    fput({ mark: 'BS', name: `Lower ball stud plate (${S})`, grp: 'hardware', kind: 'metal', hw: true,
      solids: [box(bs0, bs1, G.springBed[0] - 20, G.springBed[0] + 55, G.zF0 - 6.4, G.zF0 + 76), cyl(12, [s * (G.xFo + 3), G.springBed[0], G.springBed[1]], [s * (G.xFo + 9), G.springBed[0], G.springBed[1]])] });
    put({ mark: 'BS', name: `Upper ball stud plate (${S})`, grp: 'hardware', kind: 'metal', hw: true,
      solids: [box(...sx(s, G.xMount - 4, G.xMount), G.springCab[0] - 32, G.springCab[0] + 32, G.springCab[1] - 45, G.springCab[1] + 45), cyl(12, [s * (G.xMount - 4), G.springCab[0], G.springCab[1]], [s * (G.xMount - 10), G.springCab[0], G.springCab[1]])] });
    const sdyn = { type: 'spring', x: s * (G.xFo + G.effGap / 2 - 1), cab: G.springCab, bed: G.springBed };
    put({ mark: 'GS', name: `Gas spring (${S})`, grp: 'hardware', kind: 'metal', hw: true, dyn: sdyn, solids: springSolids(G, sdyn, bedTh) });
    // bed stop: a pin with a bumper reaching across the gap behind the rail's top edge
    put({ mark: 'ST', name: `Bed stop (${S})`, grp: 'hardware', kind: 'rubber', hw: true,
      solids: [cyl(28, [s * G.xMount, G.stop[0], G.stop[1]], [s * (G.xFo - 13), G.stop[0], G.stop[1]])] });
    // legs: L-shaped tube on a plate inside the rail, schematic
    fput({ mark: 'LG', name: `Leg pivot plate (${S})`, grp: 'hardware', kind: 'metal', hw: true,
      solids: [box(...sx(s, G.xFi - 3, G.xFi), G.legPivot[0] - 19, G.legPivot[0] + 19, G.legPivot[1] - 32, G.legPivot[1] + 32)] });
    fput({ mark: 'LG', name: `Fold-out leg (${S})`, grp: 'hardware', kind: 'metal', hw: true, leg: true, solids: legSolids(G, s * (G.xFi - 14), 0) });
  }

  // ---------------- swing clearances, then the headboard ledge, backrest and the kick under the bed
  const C = clearances(P, G);
  G.clear = C;
  if (P.ledge) {
    const yL = Math.floor(C.minY - P.ledgeClear);
    const top = Math.round(C.open.mattTop);
    G.ledge = { y: yL, top };
    if (yL - G.yB1 >= 60 && top > 150) {
      const Tg = P.Tledge;
      put({ mark: 'H1', name: 'Headboard ledge top', grp: bgrp, kind: 'ledge', T: Tg, L: 2 * G.xB, W: yL - G.yB1, grain: false, band: 2 * G.xB,
        solids: [box(-G.xB, G.xB, G.yB1, yL, top - Tg, top)] });
      put({ mark: 'H2', name: 'Headboard ledge front', grp: bgrp, kind: 'ledge', T: Tg, L: 2 * G.xB, W: top - Tg, grain: false,
        solids: [box(-G.xB, G.xB, yL - Tg, yL, 0, top - Tg)] });
      put({ mark: 'H3', name: 'Headboard ledge wall cleat', grp: bgrp, kind: 'ledge', T: Tg, L: 2 * G.xB, W: 90, grain: false,
        solids: [box(-G.xB, G.xB, G.yB1, G.yB1 + Tg, top - Tg - 90, top - Tg)] });
    } else G.ledge.skipped = true;
  }
  if (P.headboard) {
    const a = P.headAngle * Math.PI / 180, Th = P.Thead, H = P.headH;
    const z0 = G.ledge && !G.ledge.skipped ? G.ledge.top : Math.round(C.open.mattTop);
    const y0 = Math.floor(C.open.mattHead - P.headGap);
    const n = [-Math.cos(a), -Math.sin(a)];
    const F0 = [y0, z0], F1 = [y0 - H * Math.sin(a), z0 + H * Math.cos(a)];
    const B0 = [F0[0] + Th * n[0], F0[1] + Th * n[1]], B1 = [F1[0] + Th * n[0], F1[1] + Th * n[1]];
    const yb = (z) => B0[0] - (z - B0[1]) * Math.tan(a);
    const zr0 = z0, zr1 = F1[1];
    G.head = { y0, z0, F1, B0, B1, top: zr1, capY: F1[0] + 12, a: P.headAngle };
    if (y0 - Th - G.yB1 > 60) {
      put({ mark: 'H4', name: 'Headboard backrest', grp: bgrp, kind: 'ledge', T: Th, L: 2 * G.xB, W: H, grain: false, band: 2 * G.xB,
        solids: [yzPrism(-G.xB, G.xB, polyLoop([B0, F0, F1, B1]))] });
      const rib = polyLoop([[G.yB1, zr0], [yb(zr0), zr0], [yb(zr1), zr1], [G.yB1, zr1]]);
      for (const [x0, x1, nm2] of [[-G.xB, -G.xB + Th, 'right'], [-Th / 2, Th / 2, 'centre'], [G.xB - Th, G.xB, 'left']])
        put({ mark: 'H5', name: `Backrest rib (${nm2}), tapered`, grp: bgrp, kind: 'ledge', T: Th, L: zr1 - zr0, W: Math.round(yb(zr0) - G.yB1), grain: false,
          solids: [yzPrism(x0, x1, rib)] });
      put({ mark: 'H6', name: 'Bedside shelf on the backrest', grp: bgrp, kind: 'ledge', T: Th, L: 2 * G.xB, W: Math.round((G.head.capY - G.yB1) * 10) / 10, grain: false, band: 2 * G.xB,
        solids: [box(-G.xB, G.xB, G.yB1, G.head.capY, zr1, zr1 + Th)] });
    } else G.head.skipped = true;
  }
  // kick board: one plank across the towers and under the bed (none under the bed: a kick board per tower)
  if (G.kickC) put({ mark: 'K1', name: 'Kick board, one piece', grp: 'fronts-C', kind: 'front', T, L: G.plankL, W: G.kickC, grain: false, band: G.plankL,
    solids: [box(-G.plankL / 2, G.plankL / 2, G.yFb, G.yF, 0, G.kickC)] });
  // re-run the checks with the ledge, backrest and kick in place (they are obstacles now)
  G.clear = clearances(P, G, true);

  // turn the bed to the requested angle (for STEP export of an open bed)
  if (bedTh) for (const p of parts) {
    if (p.bed) p.solids = p.leg ? legSolids(G, p.solids[0].o[0], bedTh, true) : p.solids.map(q => rotatePrism(q, G.pivot, bedTh));
    else if (p.dyn && p.dyn.type === 'pin') p.solids = p.solids.map(q => Object.assign({}, q, { o: add(q.o, [0, 0, p.dyn.lift]) }));
  }
  const model = { P, G, parts, bedAngle: opts.bedAngle || 0 };
  model.checks = checks(model);
  return model;
}

function hingeZs(r) { const h = r[1] - r[0]; const zs = [r[0] + 100, r[1] - 100]; if (h > 900) zs.splice(1, 0, (r[0] + r[1]) / 2); if (h > 1600) zs.splice(2, 0, r[0] + (h * 2) / 3); return zs; }

// leg: arm from the leg pivot past the foot end, then a post to the floor. psi = 180 stowed, 0 deployed (frame coordinates)
function legGeom(G, psiDeg) {
  const psi = psiDeg * Math.PI / 180, c = Math.cos(psi), s = Math.sin(psi);
  const R = (d) => [d[0] * c - d[1] * s, d[0] * s + d[1] * c]; // CCW in (y,z)
  const p0 = G.legPivot, arm = R([0, G.legArm]), post = R([G.legPost, 0]);
  const p1 = [p0[0] + arm[0], p0[1] + arm[1]], p2 = [p1[0] + post[0], p1[1] + post[1]];
  return [p0, p1, p2];
}
function legPsi(bedDeg) { // legs swing out over the last third of the opening
  const t = Math.min(1, Math.max(0, (bedDeg - 60) / 28));
  return 180 * (1 - t);
}
function legSolids(G, x, th, rotated) {
  const deg = th * 180 / Math.PI;
  const [p0, p1, p2] = legGeom(G, legPsi(deg));
  const q = (p) => { const w = [x, p[0], p[1]]; return th ? rotYZ(w, G.pivot, th) : w; };
  const out = [cyl(25, q(p0), q(p1)), cyl(25, q(p1), q(p2))];
  const t = (G.legPost - 14) / G.legPost, pb = [p1[0] + (p2[0] - p1[0]) * t, p1[1] + (p2[1] - p1[1]) * t];
  if (x > 0) out.push(cyl(19, q(pb), [-x, ...q(pb).slice(1)])); // the leg support rail, carried by the right-hand leg
  void rotated;
  return out;
}
// gas spring between the cabinet stud (fixed) and the bed stud (turns with the bed): body at the cabinet end ("mount this end up")
function springEnds(G, dyn, th) {
  const b = rot2(dyn.bed, G.pivot, th);
  return [[dyn.x, dyn.cab[0], dyn.cab[1]], [dyn.x, b[0], b[1]]];
}
function tubeSolids(a, b, bodyLen, dBody, dRod) {
  const d = sub(b, a), L = Math.hypot(d[0], d[1], d[2]), u = mul(d, 1 / L);
  const m = add(a, mul(u, Math.min(bodyLen, L - 40)));
  return [cyl(dBody, a, m), cyl(dRod, m, b)];
}
function springSolids(G, dyn, th) { const [a, b] = springEnds(G, dyn, th); return tubeSolids(a, b, 390, 14, 8); }
// flap gas stay: fixed end on the side panel, moving end on the flap (flap opens about axis [y, z], positive = up and out)
function stayEnds(dyn, phi) {
  const [ay, az] = dyn.axis, c = Math.cos(phi), s = Math.sin(phi);
  const y = dyn.flap[0] - ay, z = dyn.flap[1] - az;
  return [[dyn.x, dyn.fixed[0], dyn.fixed[1]], [dyn.x, ay + y * c - z * s, az + y * s + z * c]];
}
// hinge links: a = fixed knuckle on the arm, b = point on the cup (door or flap closed); t = 0..1 open
function linkEnds(dyn, t) {
  return dyn.links.map(([a, b]) => {
    if (dyn.move === 'door') {
      const ang = -dyn.sign * t * Math.PI / 2 * 0.95, c = Math.cos(ang), sn = Math.sin(ang), dx = b[0] - dyn.axis[0], dy = b[1] - dyn.axis[1];
      return [a, [dyn.axis[0] + dx * c - dy * sn, dyn.axis[1] + dx * sn + dy * c, b[2]]];
    }
    const ang = t * Math.PI / 2 * 0.92, c = Math.cos(ang), sn = Math.sin(ang), dy = b[1] - dyn.axis[0], dz = b[2] - dyn.axis[1];
    return [a, [b[0], dyn.axis[0] + dy * c - dz * sn, dyn.axis[1] + dy * sn + dz * c]];
  });
}
function linkSolids(dyn, t) { return linkEnds(dyn, t).map(([a, b]) => cyl(5, a, b)); }
function staySolids(dyn, phi) { const [a, b] = stayEnds(dyn, phi); return tubeSolids(a, b, 150, 15, 6); }

/* ------------------------------------------------------------------ swing clearances
   Everything in the (y, z) side profile within the bed's width. The bed turns
   through 0..90 deg about the pivot; sampled points are checked against the fixed
   obstacles. Negative clearance = collision. */
function bedProfile(P, G) {
  const sh = [];
  const rect = (name, y0, y1, z0, z1, soft) => sh.push({ name, soft: !!soft, pts: [[y0, z0], [y1, z0], [y1, z1], [y0, z1]] });
  rect('face panel', G.yFb, G.yF, G.zFace0, G.zF1);
  sh.push({ name: 'side rail', pts: loopPolyline(rectLoopR01(G.yRail, G.zF0, G.yFb, G.zF1, P.railR), 10) });
  rect('head rail', G.yFb - P.headRailD, G.yFb, G.zF0, G.zF0 + P.T);
  rect('foot rail', G.yFb - P.footRailD, G.yFb, G.zF1 - P.T, G.zF1);
  rect('mattress support', G.ySup0, G.ySup1, G.zF0 + P.T, G.zF1 - P.T);
  rect('mattress', G.yM0, G.yM1, G.zM0, G.zM1, true);
  sh.push({ name: 'stowed legs', open: true, pts: legGeom(G, 180) });
  return sh;
}
function samplePoly(pts, step, closed) {
  const out = [];
  const n = pts.length, m = closed === false ? n - 1 : n;
  for (let i = 0; i < m; i++) {
    const a = pts[i], b = pts[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.max(1, Math.ceil(L / step));
    for (let j = 0; j < k; j++) out.push([a[0] + (b[0] - a[0]) * j / k, a[1] + (b[1] - a[1]) * j / k]);
  }
  if (closed === false) out.push(pts[n - 1]);
  return out;
}
function rectDist(p, r) { // signed distance, positive outside; r = [y0, y1, z0, z1]
  const dy = Math.max(r[0] - p[0], 0, p[0] - r[1]), dz = Math.max(r[2] - p[1], 0, p[1] - r[3]);
  if (dy > 0 || dz > 0) return Math.hypot(dy, dz);
  return -Math.min(p[0] - r[0], r[1] - p[0], p[1] - r[2], r[3] - p[1]);
}
function obstacles(P, G, withAdded) {
  const ob = [];
  ob.push({ name: 'floor', rect: [-1e5, 1e5, -1e5, 0] });
  ob.push({ name: 'back wall', rect: [-1e5, 0, -1e5, 1e5] });
  ob.push({ name: 'shelf over the bed', rect: [G.yB1, G.yC, G.zBm0, G.zBm1] });
  if (G.steel) ob.push({ name: 'steel flat under the shelf edge', rect: [G.steel.y0, G.steel.y1, G.steel.z0, G.steel.z1] });
  ob.push({ name: 'wall rail under the shelf', rect: [G.yB1, G.yB1 + P.T, G.zBm0 - P.wallRail, G.zBm0] });
  ob.push({ name: 'flaps', rect: [G.yFb, G.yF, G.flapZ[0], G.flapZ[1]] });
  if (withAdded) {
    if (G.kickC >= 15) ob.push({ name: 'kick board under the bed', rect: [G.yFb, G.yF, 0, G.kickC] });
    if (G.ledge && !G.ledge.skipped) ob.push({ name: 'headboard ledge', rect: [G.yB1, G.ledge.y, 0, G.ledge.top] });
    if (G.head && !G.head.skipped) {
      ob.push({ name: 'headboard backrest', rect: [Math.min(G.head.B1[0], G.head.B0[0]), G.head.y0, G.head.B0[1], G.head.top] });
      ob.push({ name: 'bedside shelf', rect: [G.yB1, G.head.capY, G.head.top, G.head.top + P.Thead] });
    }
  }
  return ob;
}
function segRectDist(a, b, r) { // a, b points; r = [y0, y1, z0, z1]; negative when the segment enters the rectangle
  const da = rectDist(a, r), db = rectDist(b, r);
  if (da <= 0 || db <= 0) return Math.min(da, db, -0.1);
  // Liang-Barsky: does the segment cross the rectangle?
  let t0 = 0, t1 = 1;
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const clip = (p, q) => { if (Math.abs(p) < 1e-12) return q >= 0; const t = q / p; if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; } return true; };
  if (clip(-dx, a[0] - r[0]) && clip(dx, r[1] - a[0]) && clip(-dz, a[1] - r[2]) && clip(dz, r[3] - a[1]) && t0 <= t1) return -0.1;
  let d = Math.min(da, db);
  const L2 = dx * dx + dz * dz;
  for (const c of [[r[0], r[2]], [r[1], r[2]], [r[0], r[3]], [r[1], r[3]]]) {
    if (!isFinite(c[0]) || !isFinite(c[1]) || Math.abs(c[0]) > 1e4 || Math.abs(c[1]) > 1e4) continue;
    const t = Math.max(0, Math.min(1, ((c[0] - a[0]) * dx + (c[1] - a[1]) * dz) / (L2 || 1)));
    d = Math.min(d, Math.hypot(a[0] + t * dx - c[0], a[1] + t * dz - c[1]));
  }
  return d;
}
function clearances(P, G, withAdded) {
  const shapes = bedProfile(P, G);
  const ob = obstacles(P, G, withAdded);
  const res = ob.map(o => ({ name: o.name, min: Infinity, part: '', angle: 0 }));
  const thO = Math.PI / 2;
  const openOf = (name) => shapes.find(q => q.name === name).pts.map(p => rot2(p, G.pivot, thO));
  const mo = openOf('mattress'), fo = openOf('face panel');
  const open = {
    mattTop: Math.max(...mo.map(p => p[1])),
    mattHead: Math.min(...mo.map(p => p[0])),
    faceUnder: Math.min(...fo.map(p => p[1])),
    reach: Math.max(...fo.map(p => p[0])),
  };
  const lowZ = open.mattTop + 60;
  let minY = Infinity, maxZ = -Infinity, minZ = Infinity;
  const steps = 180;
  for (let i = 0; i <= steps; i++) {
    const th = (i / steps) * Math.PI / 2;
    for (const sh of shapes) {
      const q = sh.pts.map(p => rot2(p, G.pivot, th));
      for (const p of q) { if (p[1] < lowZ && p[0] < minY) minY = p[0]; if (p[1] > maxZ) maxZ = p[1]; if (p[1] < minZ) minZ = p[1]; }
      const n = q.length, m = sh.open ? n - 1 : n;
      for (let e = 0; e < m; e++) {
        const a = q[e], b = q[(e + 1) % n];
        for (let k = 0; k < ob.length; k++) {
          const d = segRectDist(a, b, ob[k].rect);
          if (d < res[k].min) { res[k].min = d; res[k].part = sh.name; res[k].angle = i * 90 / steps; }
        }
      }
    }
  }
  // tallest kick board under the bed that stays outside the circle swept by the face panel's bottom edge
  const rMax = Math.max(Math.hypot(G.yFb - G.pivot[0], G.zFace0 - G.pivot[1]), Math.hypot(G.yF - G.pivot[0], G.zFace0 - G.pivot[1]));
  const dy = Math.max(0, G.yFb - G.pivot[0], G.pivot[0] - G.yF);
  const kickMax = G.pivot[1] - Math.sqrt(Math.max(0, (rMax + 6) * (rMax + 6) - dy * dy));
  return { list: res, minY, maxZ, minZ, kickMax, open };
}

/* ------------------------------------------------------------------ checks (design review, live) */
const h5 = (x) => String(Math.round(x * 2) / 2);
function checks(model) {
  const { P, G } = model, out = [];
  const w = (level, title, text, tag) => out.push({ level, title, text, tag: tag || '' });
  const f0 = (v) => String(Math.round(v));
  const C = G.clear;
  // swing
  for (const r of C.list) {
    if (r.name === 'back wall') continue;
    if (r.min < 0) w('bad', `Bed hits the ${r.name}`, `The ${r.part} passes ${f0(-r.min)} mm into the ${r.name} at about ${f0(r.angle)} deg of opening.`, 'swing');
    else if (r.min < 5) w('warn', `Tight past the ${r.name}`, `The ${r.part} clears the ${r.name} by only ${r.min.toFixed(0)} mm (at ${f0(r.angle)} deg).`, 'swing');
  }
  const wallR = C.list.find(r => r.name === 'back wall');
  if (wallR && wallR.min < 0) w('bad', 'Bed reaches the back wall', `The ${wallR.part} swings ${f0(-wallR.min)} mm past the wall line.`, 'swing');
  if (G.kickC && G.drawerDrop > 0) w('info', `One-piece kick board, ${f0(G.kickC)} high`, `The bottom edge of the face panel sweeps down to ${f0(C.minZ)} mm above the floor as the bed turns, so the kick board that runs right across is ${f0(G.kickC)} high. The drawers start ${f0(G.drawerDrop)} lower, at ${f0(G.zPl)}, on lower plinths, and the hanging space gains the ${f0(G.drawerDrop)}: ${f0(G.hangClear)} clear.`, 'swing');
  if ((G.kickC || P.gapAbove > 0) && G.plankL < G.plankSpan - 0.5) w('info', `Kick board and header end ${f0(G.plankEnd)} from the walls`, `In one piece they can be ${f0(G.plankL)} long at most (your longest ${P.T} mm sheet less the trim), ${f0(G.plankSpan - G.plankL)} short of the ${f0(G.plankSpan)} the doors span. A sheet ${f0(G.plankSpan + 2 * P.trim)} or longer runs them to ${P.gap} mm off the walls like the doors.`, 'layout');
  if (G.ledge && G.ledge.skipped) w('info', 'No room for a headboard ledge', 'The bed sweeps too close to the wall for a ledge behind the pillows.', 'swing');
  // hardware gap
  const gapNow = G.effGap;
  if (Math.abs(gapNow - P.pinGap) > 2.5) w('warn', 'Pivot gap differs from the kit', `Side rail to the pivot mounting face is ${f0(gapNow)} mm; the Create-A-Bed queen plan works out to ${P.pinGap} mm (7/16 in). ${P.packer ? 'Change the packer thickness' : 'Add a packer under the cabinet-side plates'} so the pivot pins engage fully.`, 'hardware');
  if (P.faceOverhang > 0 && P.faceOverhang > gapNow - 5) w('bad', 'Face panel rubs the pivot packer', `Overhang ${P.faceOverhang} mm leaves ${f0(gapNow - P.faceOverhang)} mm to the packer and plates.`, 'hardware');
  if (Math.abs(G.deckDelta) > 3) w('warn', G.deckDelta > 0 ? `Legs ${f0(G.deckDelta)} mm short` : `Legs ${f0(-G.deckDelta)} mm long`,
    `The pivot sits ${f0(G.pivot[1])} above the floor; the kit's legs suit ${f0(P.cabPivotZ)} (11-3/4 in). Set "face panel past the frame's head end" to ${(P.faceBelowFrame - G.deckDelta).toFixed(0)} to put the frame where the kit has it${G.deckDelta > 0 ? ', or pad the leg feet' : ''}.`, 'hardware');
  if (G.pinY < G.yFb - P.footRailD + 5 || G.pinY > G.yFb - 5) w('warn', 'Safety pins miss the foot rail', `Pins at ${f0(G.yF - G.pinY)} from the front; the foot rail is ${f0(P.footRailD)} deep.`, 'hardware');
  if (G.head && !G.head.skipped) w('info', `Backrest face ${f0(G.head.y0)} from the wall`, `It starts at mattress height (${f0(G.head.z0)}) ${P.headGap} mm behind the open mattress and leans back ${P.headAngle} deg to a bedside shelf at ${f0(G.head.top + P.Thead)}. Below mattress height the bed swings back to ${f0(G.clear.minY)} from the wall, so the ledge under it stays at ${G.ledge ? f0(G.ledge.y) : '-'}.`, 'layout');
  // shelf over the bed: worst case is one bay loaded, the other empty. The divider (glued and screwed, its back held by
  // the shelf and top screwed to their rails) carries the shelf, so each bay spans divider to side. Calibrated against the
  // grillage plate model in study/cases.py: 3.0 mm for a plain 18 mm shelf and 1.4 mm with a 20 x 10 steel flat, 100 kg/m2, creep x1.8.
  { const a = G.xB + P.T / 2, Es = 200000;
    const EIp = 1.10e9 * (P.T / 18) ** 3;
    let EIe = P.edgeSteel ? Es * P.steelT * P.steelH ** 3 / 12 : 0;
    if (P.upstand > 0) { const bf = 150, t = P.T, h = P.upstand, A1 = bf * t, A2 = t * h, y1 = t / 2, y2 = t + h / 2, yc = (A1 * y1 + A2 * y2) / (A1 + A2);
      EIe += 8000 * (A1 * (y1 - yc) ** 2 + t * h ** 3 / 12 + A2 * (y2 - yc) ** 2); }
    const dead = PLY_DENSITY * 9.81 * P.T, sag = (kg) => 3.23 * (kg * 9.81e-6 + dead) * 1.8 * a ** 4 / (EIp + EIe);
    G.shelfSag = sag(100); G.shelfSagLight = sag(40);
    const room = P.gapHolder - (P.edgeSteel ? P.steelH - P.T : 0);
    if (G.shelfSag > 3) w(G.shelfSag > room * 0.8 ? 'bad' : 'warn', 'Shelf above the bed may sag toward it',
      `About ${G.shelfSag.toFixed(1)} mm over time with one bay holding 100 kg a square metre (${G.shelfSagLight.toFixed(1)} mm at 40 kg); ${f0(room)} mm to the bed. ${P.edgeSteel ? 'Use a deeper steel flat or a thicker shelf.' : 'Turn on the steel flat in the front edge.'}`, 'layout'); }
  if (P.mT < 203 || P.mT > 305) w('warn', 'Mattress outside the kit range', `Create-A-Bed lists 8 to 12 in (203 to 305 mm) including any pillow top; this one is ${P.mT}.`, 'hardware');
  if (P.mW > 1524 + 1) w('info', 'Mattress is wider than a US queen', `${P.mW} vs 1524 (60 in). The frame is sized from your mattress, so it fits; keep within the kit's 65 to 80 lb (29 to 36 kg) queen mattress weight.`, 'hardware');
  // structure and stock
  if (G.topClear < 150) w('bad', 'Top compartment too small', `Only ${f0(G.topClear)} clear under the tower top.`, 'layout');
  if (P.topShelf && G.topClear < 2 * 120 + P.T) w('warn', 'Top shelf split is cramped', `${f0(G.topClear)} clear gives two spaces of ${f0((G.topClear - P.T) / 2)}.`, 'layout');
  if (G.zBm1 >= G.zTopB - 100) w('bad', 'No room above the bed', `The shelf over the bed (${f0(G.zBm1)}) is within 100 of the top.`, 'layout');
  if (G.drawerZoneClear < 60) w('bad', 'Drawers do not fit', 'The drawer fronts leave no room for boxes.', 'layout');
  if (G.cD < 520) w('warn', 'Shallow for hangers', `Inside depth ${f0(G.cD)}: coat hangers want about 520 to 560.`, 'layout');
  if (G.hangClear < 1000) w('info', `${f0(G.hangClear)} hanging height`, 'Enough for shirts and jackets folded at the hanger (about 950 with the hook); not for long coats or dresses (1400 to 1600).', 'layout');
  if (G.towerIn < G.boxW + 2 * P.runnerClear - 0.1 || G.boxW < 150) w('bad', 'Drawer boxes too narrow', `Box width ${f0(G.boxW)}.`, 'layout');
  for (const [F, what] of [[G.hingeDoor, 'tower doors'], [G.hingeFlap, 'flaps']]) if (!F.ok) w('warn', `Hinge overlay for the ${what}`, `${f0(F.overlay)} mm overlay is outside what ${HINGE_HW.short} covers on 0 or 3 mm plates (11 to 18). Change the reveals, or use a half-overlay hinge.`, 'hardware');
  if (P.runnerClear < 12.5 || P.runnerClear > 13.2) w('warn', 'Runner clearance', `${RUNNER_HW.name} needs ${RUNNER_HW.w} each side of the drawer box (up to about 13); it is ${P.runnerClear}.`, 'hardware');
  if (G.runner + RUNNER_HW.kt > G.cD + 0.1) w('bad', 'Runners too long', `${G.runner} runners need ${G.runner + RUNNER_HW.kt} inside the tower; it has ${f0(G.cD)}.`, 'layout');
  else if (!RUNNER_STD.includes(G.runner)) w('warn', 'Runner length', `${RUNNER_HW.name} comes in 250 to 700 in 50s; ${G.runner} is not one of them.`, 'hardware');
  if (P.doorHinge === 'outer' && P.gap < 10 && P.sideClear + P.gap < 15) w('warn', 'Doors next to the cavity walls', `Each tower door is hinged ${f0(P.gap + 0)} mm from the cavity wall with its face flush with the room wall, so it stops at about 90 deg. Use zero-protrusion hinges, or add 20 mm scribe fillers at the walls.`, 'fronts');
  const sideLen = G.zTopB - G.zPl - P.T;
  const maxL = Math.max(...P.sheets.filter(s => s.T === P.T).map(s => s.L - 2 * P.trim), 0);
  if (sideLen > maxL) w('bad', 'Tower sides longer than the sheets', `${f0(sideLen)} needed, ${f0(maxL)} usable.`, 'stock');
  // standing a tower up in the cavity: its diagonal has to clear the ceiling
  const towerH = G.zTop - G.zPl, diag = Math.hypot(towerH, G.cD + P.Tback);
  if (diag > P.H) w('bad', 'Towers cannot be stood up in the cavity', `A tower is ${f0(towerH)} tall and ${f0(G.cD + P.Tback)} deep: its diagonal ${f0(diag)} is more than the ${f0(P.H)} ceiling. Build it in place or in two parts.`, 'install');
  else if (diag > P.H - G.zPl) w('info', 'Stand the towers up on the floor, then lift onto the plinth', `Diagonal ${f0(diag)}: it clears the ceiling (${f0(P.H)}) only from the floor, not from the top of a ${f0(G.zPl)} plinth.`, 'install');
  if (G.antClear < 200) w('warn', 'Little room for the flap fittings', `Only ${f0(G.antClear)} clear behind the flaps; most lift fittings and gas stays want 200 or more.`, 'fronts');
  // flap lift
  const flapKg = G.flapW * G.flapH * P.T * PLY_DENSITY;
  w('info', `Flaps ${f0(G.flapW)} x ${f0(G.flapH)}, about ${flapKg.toFixed(1)} kg`, `Lift-mechanism power factor (height x weight) about ${f0(G.flapH * flapKg)}. Pick the gas stay or lift fitting from its chart for this, and a push latch that out-pushes the stay. ${f0(G.antClear)} clear behind the flaps for the fittings.`, 'fronts');
  return out;
}

/* ------------------------------------------------------------------ design review (static notes with live numbers) */
function reviewNotes(model, S) {
  const { P, G } = model, f0 = (v) => String(Math.round(v));
  const st18 = S ? S.sheets.find(q => q.T === P.T) : null;
  const edits = [
    ['Modules that fit the sheets', `Full-height sides of ${f0(P.H)} do not come out of a 2440 sheet. The wardrobe is two towers on plinths plus a bed cabinet: tower sides ${f0(G.zTopB - G.zPl - P.T)} between a top and bottom, bed-cabinet sides ${f0(G.zBm0)} from the floor to the shelf above the bed and ${f0(G.antClear)} from the shelf to the top. The doubled ${2 * P.T} mm sides of the TikZ stay doubled the full height, one tower side screwed to the bed-cabinet sides, broken only where the shelf and its steel flat pass through; a 6 mm back over the shelf space ties the box together like the towers' backs.`],
    ['Room to fit and scribe', `${P.sideClear} mm each side and ${P.backGap} mm at the back for packers into the studs; the doors still finish ${P.gap} mm off the walls as drawn. The ${f0(P.gapAbove)} header filler is scribed to the ceiling.`],
    ['Bed frame where the kit puts it', `The plan puts the pivot 9 in from the rail's head end and 11-3/4 in off the floor, so the kit's frame sits 2-3/4 in (70) up. Here the face panel still starts at ${f0(P.gapBelow)} in line with the drawers, but the frame starts ${f0(P.faceBelowFrame)} higher, behind it, and the mattress end gaps are ${P.gapMy} mm, not 7. The pivot lands at ${f0(G.pivot[1])}, the legs reach the floor as supplied, and the side rails come out at ${f0(G.frameL)} (kit: 81-1/2 in = 2070).`],
    ['Side rail to cabinet side', P.packer ? `${f0(P.gapHydr)} mm between the bed frame's side rail and the bed-cabinet side, wider than the 7/16 in (11 mm) the Create-A-Bed hardware is built for, so ${f0(P.Tpacker)} mm packers go under the kit's cabinet plates (pivots, upper ball studs, bed stops) to bring them to ${f0(G.effGap)} mm. Use machine screws ${f0(P.Tpacker)} mm longer than the kit's. Closing the gap to 11 mm needs no packers and gives each tower ${f0(Math.max(0, P.gapHydr - P.pinGap))} mm.` : `${f0(P.gapHydr)} mm between the bed frame's side rail and the bed-cabinet side${Math.abs(P.gapHydr - P.pinGap) < 2.5 ? ", the 7/16 in (11 mm) the Create-A-Bed hardware is built for: the kit's cabinet plates screw straight to the side with the screws supplied, and no packers are needed" : `; the kit is built for 7/16 in (11 mm), so the pivots may not engage properly without packers`}. The gas springs run in this gap, as in the kit.`],
    ['Plinths and kick boards', `Each tower sits on a ${f0(G.zPl)} high ladder plinth so it can be levelled; the bed-cabinet sides go to the floor like the kit's verticals. ${G.kickC ? `One kick board runs right across, ${f0(G.kickC)} high because the face panel's bottom edge sweeps down to ${f0(G.clear.minZ)} mm off the floor as the bed turns; the drawers and tower plinths sit ${f0(G.drawerDrop)} lower to match, and the header filler is one piece too.` : 'There is no kick board under the bed, so each tower has its own.'}`],
    ['Headboard', G.head && !G.head.skipped ? `The bed's swing bulges furthest back at pivot height (${f0(G.clear.minY)} from the wall)${G.ledge && !G.ledge.skipped ? `, so the ledge stays below mattress height at ${f0(G.ledge.y)}` : ', so nothing stands below mattress height'}. Above the mattress nothing swings back, so a ${f0(P.headH)} backrest steps out to ${P.headGap} mm behind the open mattress and leans back ${P.headAngle} deg, on three tapered ribs, with a ${f0(G.head.capY - G.yB1)} deep bedside shelf on top at ${f0(G.head.top + P.Thead)}.` : G.ledge && !G.ledge.skipped ? `A ${f0(G.ledge.y - G.yB1)} deep ledge at mattress height fills the gap behind the open mattress.` : 'Turned off: pillows can fall behind the head of the open bed.'],
    ['Shelf above the bed', `It spans ${f0(2 * G.xB)} only ${f0(P.gapHolder)} mm above the closed bed. The centre divider carries it: glued and screwed to the shelf and the top, it turns the shelf into two ${f0(G.xB + P.T / 2)} mm bays held on three sides. ${P.edgeSteel ? `A ${f0(P.steelH)} x ${f0(P.steelT)} steel flat let into the front edge, ${f0(P.steelH - P.T)} mm proud underneath and hidden by the flaps, stiffens the free edge and takes the push latches.` : ''} ${P.upstand > 0 ? `A ${f0(P.upstand)} mm lip runs along the front edge.` : 'The top is flat to the front edge, so boxes slide straight in.'} Worst case, one bay holding 100 kg a square metre: about ${G.shelfSag.toFixed(1)} mm over time.`],
    ['Shelf fixings', 'The divider only works if it cannot rack: glue it with Dominos or biscuits and screws along each edge (no deep housing). Make the shelf, upper sides, divider, top, wall rails and the 6 mm back up as one box on the floor, slide it in onto the bed-cabinet sides, screw it down and through the tower sides, and screw the rails into the studs; the build sequence sheets have the steps and screws.'],
    ['Safety lock', P.lockType === 'twin' ? `A twin pin straddles the centre divider behind the flap joint: two 10 mm pins ${f0(P.twinSpacing)} apart, nutted through one steel bar, run through a hardwood block in the divider's front notch and go ${P.lockDepth} mm into the foot rail. One pull through either flap lifts both 30 mm; a spring ball plunger holds them up while the bed is down.${P.lockTab ? ' A 2 mm tab on the bar pokes out through the flap joint, so it can be lifted without opening a flap, and shows whether it is locked.' : ''}`
      : P.lockType === 'pins' ? `Two 10 mm drop pins, ${f0(P.lockPinX)} either side of centre behind the flaps, go down through the shelf and ${P.lockDepth} mm into the foot rail. Lift both before lowering the bed.` : 'Turned off.'],
    ['Wall anchoring', `The gas springs pull the cabinet forward as the bed comes down. ${f0(P.wallRail)} mm wall rails under the shelf and under the top take screws into the studs (the kit asks for four 3 in screws through its header rear rail for a queen).`],
    ['Bed deck as the kit builds it', `Face panel in two ${f0(G.xFo)} halves (a sheet is 1220 wide), ${P.struts} cross struts and a ${P.Tsup} mm mattress support. Side rails ${f0(P.railD)} deep with the 2-7/8 in radius at the foot end, head rail ${f0(P.headRailD)} so it stands proud as a lip behind the pillows, foot rail ${f0(P.footRailD)} so the legs can swing past it.`],
    ['Tower backs', `${P.Tback} mm backs square the towers and stop them racking; they stop ${f0(G.backInset)} mm short top and bottom so each comes out of one sheet. The bed bay has no back.`],
    ['Thicknesses that fit your stock', st18 ? `Deck struts in ${P.Tladder} mm, drawer boxes in ${P.Tb} mm and the backrest in ${P.Thead} mm leave the ${P.T} mm parts on ${st18.need} of your ${st18.have} sheets.` : ''],
  ].filter(e => e[1]);
  const open = [
    ['Hardware positions', `Heights on the bed-cabinet sides match the kit's (pivot ${h5(G.pivot[1])}, upper ball stud ${h5(G.springCab[1])}, stop ${h5(G.stop[1])}), but measure depths from the carcass edge, not the kit's 4-3/4, 10 and 7-3/8 in: here the face stands ${h5(G.yF - G.yC)} mm proud, so they are ${h5(G.yC - G.pivot[0])}, ${h5(G.yC - G.springCab[0])} and ${h5(G.yC - G.stop[0])}. Sheet 5 has them.`],
    ['Ventilation', 'A mattress stood on end in a closed bay needs air. Drill the mattress support (for example 25 mm holes at 150) and leave the side gaps open.'],
    ['Tower doors', P.doorHinge === 'outer' ? `Hinged on the wall side, ${P.gap} mm from the cavity wall with their faces flush with the room wall: they open to about 90 deg. That keeps them clear of the bed when it is down. Zero-protrusion hinges or a 20 mm scribe filler would let them open further.` : `Hinged on the bed side: they open past 90 deg, but an open door stands ${f0(G.doorX[0] - G.xFo)} mm from the edge of the lowered bed.`],
    ['Lift-up flaps', `About ${(G.flapW * G.flapH * P.T * PLY_DENSITY).toFixed(1)} kg each. Choose the gas stays from their force chart and a push latch strong enough to open against them. ${f0(G.antClear)} clear behind the flaps.`],
    ['Hanging height', `${f0(G.hangClear)} clear suits shirts and jackets, not long coats. Raising the shelf over the hanging space takes height from the ${f0(G.topClear)} top compartment.`],
    ['Mattress', `${P.mW} x ${P.mL} x ${P.mT}. The queen kit is set up for 60 x 80 in (1524 x 2032), at most 12 in thick, 65 to 80 lb (29 to 36 kg); set the spring plates from the booklet's chart for your mattress weight.`],
    ['Clear floor', `The open bed reaches ${f0(G.clear.open.reach)} from the back wall, ${f0(G.clear.open.reach - P.D)} into the room.`],
    ['Skirting and floor', 'The bed-cabinet sides stand on the floor: notch them over any skirting at the back (the kit plan shows the same notch) and check the floor is flat across the bay.'],
    ['Services', 'Run any reading-light or USB cable to the bedside shelf through the ribs before the backrest goes on.'],
    ['Edge banding', S ? `About ${S.bandM.toFixed(0)} m for the fronts and the visible carcass edges, if you band them.` : ''],
  ].filter(e => e[1]);
  return { edits, open };
}
const SOURCES = [
  ['Create-A-Bed Deluxe Queen Vertical plan', 'https://cdn.shopify.com/s/files/1/0590/2263/9270/files/UPDATED_Deluxe_Queen.pdf'],
  ['Create-A-Bed: plans and instructions', 'https://createabed.com/pages/instructions'],
  ['Create-A-Bed: vertical or horizontal (cabinet sizes)', 'https://createabed.com/blogs/news/should-you-build-a-vertical-or-a-horizontal-murphy-bed'],
  ['Create-A-Bed: FAQ (mattress limits)', 'https://createabed.com/pages/faq'],
  ['Hettich KA ball-bearing runners (KA 5632 lengths and holes)', 'https://web.hettich.com/fileadmin/Company_website/HUS/Media/HUS_KA_Slides_Brochure_0422_update.pdf'],
  ['Hettich KA 5632, Kitchen Library (Australia)', 'https://kitchenlibrary.au/products/hettich-ka-5632-ball-bearing-runner-standard-45kg'],
  ['Blum 71B3550 spec sheet', 'https://s1.img-b.com/build.com/mediabase/specifications/blum/316646/blum-71b3550-specification-sheet.pdf'],
  ['Blum CLIP top BLUMOTION overlay table', 'https://downloads.cabinetparts.com/auto/110-clip-top-blumotion.pdf'],
  ['Blum CLIP top BLUMOTION, Kitchen Library (Australia)', 'https://kitchenlibrary.au/collections/hinges/products/blum-clip-top-blumotion-standard-soft-close-hinge-110-degree'],
];
// [param, name, kit value, where in the Deluxe Queen plan]
const HW_ASSUMPTIONS = [
  ['pivotFromRail', 'Pivot hole from the rail\'s face edge', '4 in', 'p.15: 4 in and 1-7/8 in across the rail'],
  ['pivotAboveHead', 'Pivot hole from the rail\'s head end', '9 in', 'p.15'],
  ['cabPivotZ', 'Male pivot plate height', '11-3/4 in', 'p.22, 4-3/4 in from the front'],
  ['springLowAlong', 'Lower ball stud, pivot to head end', '7-1/2 in', 'p.15, plate overhangs the end 1/4 in'],
  ['springUpZ', 'Upper ball stud height', '30-3/4 in', 'p.22, 10 in from the front'],
  ['stopBelowTop', 'Bed stop below the frame top', '3-1/8 in', 'p.22: 6 in below the vertical, 7-3/8 in back'],
  ['legFromFoot', 'Leg pivot from the foot end', '3-1/8 in', 'p.10, p.11'],
  ['legFromTop', 'Leg pivot from the rail top', '2-1/2 in', 'p.10, p.11'],
  ['railR', 'Side rail radius, foot end', '2-7/8 in', 'p.10, top corner'],
  ['railD', 'Side rails', '5-7/8 x 81-1/2', 'p.6, part B'],
  ['headRailD', 'Head rail', '7-7/8 in', 'p.6, part D'],
  ['footRailD', 'Foot rail', '3 in', 'p.6, part C'],
  ['pinGap', 'Side rail to cabinet side', '7/16 in', 'p.6: 64-3/8 in inside, 62 + 2 x 3/4 frame'],
];

/* ------------------------------------------------------------------ quantities */
function cutList(model) {
  const { P } = model;
  const rows = new Map();
  for (const p of model.parts) {
    if (p.hw) continue;
    const L = Math.round(p.L * 10) / 10, W = Math.round(p.W * 10) / 10;
    const key = [p.mark, p.T, L, W].join('|');
    if (!rows.has(key)) rows.set(key, { mark: p.mark, name: p.cutName || baseName(p.name), T: p.T, L, W, qty: 0, grain: !!p.grain && P.grain, band: 0, kind: p.kind, grp: p.grp });
    const r = rows.get(key);
    r.qty += 1; r.band += p.band || 0;
  }
  // keep marks unique per size: suffix .1 .2 when one mark has several sizes
  const list = [...rows.values()];
  const byMark = new Map();
  for (const r of list) { if (!byMark.has(r.mark)) byMark.set(r.mark, []); byMark.get(r.mark).push(r); }
  for (const [m, rs] of byMark) if (rs.length > 1) { rs.sort((a, b) => b.L - a.L || b.W - a.W); rs.forEach((r, i) => { r.mark = `${m}.${i + 1}`; }); }
  const order = ['T', 'P', 'B', 'H', 'F', 'D', 'K', 'X'];
  list.sort((a, b) => order.indexOf(a.mark[0]) - order.indexOf(b.mark[0]) || a.mark.localeCompare(b.mark, undefined, { numeric: true }));
  return list;
}
function baseName(n) {
  return n.replace(/ \((L|R|C)\)$/, '').replace(/^Drawer \d+ /, 'Drawer ').replace(/Drawer front \d+/, 'Drawer front').replace(/Deck cross strut \d+/, 'Deck cross strut');
}
function hardwareList(model) {
  const { P, G } = model, f0 = (v) => String(Math.round(v));
  const nDr = P.drawers.length * 2;
  const hinges = model.parts.filter(p => p.hinges).reduce((a, p) => a + p.hinges.length, 0);
  return [
    ['Create-A-Bed Deluxe queen vertical kit', '1 set', 'pivots, gas springs, ball studs, legs, stops, straps (supplied)'],
    [`Drawer runners, ${RUNNER_HW.name}, ${G.runner} mm`, `${nDr} pairs`, `full extension, ${RUNNER_HW.load} kg, ${RUNNER_HW.h} x ${RUNNER_HW.w}; holes ${runnerHoles(G.runner).join(', ')} from the front`],
    [`Hinges, ${HINGE_HW.name}`, `${hinges}`, `tower doors, ${P.doorHinge === 'outer' ? 'wall' : 'bed'} side; ${f0(G.hingeDoor.overlay)} overlay, cups ${G.hingeDoor.B} from the edge`],
    [`Blum CLIP cruciform plates 37/32, ${G.hingeDoor.H} mm, ${G.hingeDoor.code}`, `${hinges}`, 'on the tower sides, holes 37 back from the front edge'],
    [`Hinges for the flaps, ${HINGE_HW.short}`, '4', `two per flap; ${f0(G.hingeFlap.overlay)} overlay, cups ${G.hingeFlap.B} from the top edge`],
    [`Blum CLIP cruciform plates 37/32, ${G.hingeFlap.H} mm, ${G.hingeFlap.code}`, '4', 'under the top over the bed'],
    ['Gas stays for the flaps', '4', 'two per flap; size from the flap weight'],
    ['Push latches, 10 mm drill-in', '2', P.upstand >= 25 ? 'drilled into the shelf lip' : P.edgeSteel ? 'drilled through the steel flat into the shelf edge' : 'drilled into the shelf edge'],
    ...(P.edgeSteel ? [[`Bright steel flat ${f0(P.steelH)} x ${f0(P.steelT)}`, '1', `${f0(2 * G.xB)} long, glued and screwed on edge into the shelf's front edge`]] : []),
    ...(P.lockType === 'twin' ? [
      ['Twin pin: 2 mild-steel pins 10 mm, 100 x 30 x 6 bar, 4 M10 nuts, knob', '1 set', `pins ${f0(P.twinSpacing)} apart, threaded at the top; not free-cutting bar`],
      ['Steel bushes 10 mm, strike plate, M8 spring ball plunger', '4 + 1 + 1', 'bushes in the guide block and shelf; plate let into the foot rail'],
      ...(P.lockTab ? [['Steel tab, 2 mm', '1', 'screwed to the bar, out through the flap joint']] : [])]
      : P.lockType === 'pins' ? [['Drop pins, 10 mm, with hardwood blocks', '2', `into steel bushes in the foot rail, ${P.lockDepth} mm deep`]] : []),
    ['Hanging rail 25 mm + end brackets', '2', `${Math.round(G.towerIn - 4)} long`],
    ['Handles or pulls', `${nDr + 4 + 2}`, 'drawers, doors, two on the bed face (kit: 5 to 6 ft up)'],
    ['Screws, dowels, wall fixings, glue', '-', 'see the fixings schedule with the build sequence'],
  ];
}

/* ------------------------------------------------------------------ build sequence and fixings
   Usual cabinetmaking practice for 18 mm plywood: glue every permanent joint (PVA), pre-drill every screw, keep
   screws 50 from the ends of a joint and no more than 200 apart, centred in the 18 mm edge; dowels for alignment
   in the butt joints; anchor to the studs. Quantities are counted from the model; studs assumed 450 apart. */
/* ------------------------------------------------------------------ joinery
   Every screw, dowel, Domino and brad in the plywood joints, placed, so the assembly drawings, the step cards and the
   fixings schedule all count the same things. Rules: screws 50 from the ends of a joint and no more than 200 apart
   (150 on the 6 mm backs, 250 to 300 on the bed deck), centred in the edge they go into; dowels midway between the
   screws; all of them moved clear of hardware and of anything that would stop the driver. Each step is a list of
   operations in working order; each operation adds parts and drives one set of fixings. */
// drawn sizes: length, shank, head (mm); a Domino is length x thickness x width
const FAST = {
  s50: [50, 4, 8], s40: [40, 4, 8], s30: [30, 4, 8], s35: [35, 4, 8], s25: [25, 4, 8.5], b30: [30, 3.5, 7], b25: [25, 3.5, 7],
  b20: [20, 3.5, 7], b16: [16, 3.5, 7], r10: [10, 3.5, 7], brad: [40, 1.6, 2.6], br30: [30, 1.6, 2.6], w75: [75, 6, 12], d8: [30, 8, 8], dom: [40, 8, 22],
};
// short names for the fixings, used on the drawings and the schedule
const TAGS = { s50: 'A', s40: 'B', s30: 'C', s35: 'D', s25: 'E', b30: 'F', b25: 'G', b20: 'H', b16: 'J', r14: 'P', r10: 'Q',
  h15: 'U', h17: 'V', brad: 'N', br30: 'W', d8: 'DW', dom: 'DM', w75: 'K', kit: 'KM', m4: 'M4', pin: 'SP' };
function joinery(model) {
  const { P, G, parts } = model, T = P.T;
  const byName = new Map();
  for (const p of parts) { if (!byName.has(p.name)) byName.set(p.name, []); byName.get(p.name).push(p); }
  const one = (n) => (byName.get(n) || [])[0] || null;
  const all = (n) => byName.get(n) || [];
  const mk = (m) => parts.filter(p => p.mark === m);
  const bb = (p) => p.solids.map(prismBox).reduce((a, q) => [Math.min(a[0], q[0]), Math.min(a[1], q[1]), Math.min(a[2], q[2]), Math.max(a[3], q[3]), Math.max(a[4], q[4]), Math.max(a[5], q[5])]);
  const r05 = (v) => Math.round(v * 2) / 2;
  const mid = (xs) => xs.slice(1).map((v, i) => r05((v + xs[i]) / 2));
  // positions along [a, b]: e from the ends, at most `pitch` apart, then moved off the `avoid` intervals
  const spread = (a, b, e, pitch, avoid, gap) => {
    if (b < a) [a, b] = [b, a];
    const L = b - a;
    let xs;
    if (L <= 2 * e + 1) xs = [(a + b) / 2];
    else {
      // a whole-millimetre pitch, the run centred: chains of dimensions then read "e, n x pitch, e"
      const n = Math.max(2, Math.ceil((L - 2 * e) / pitch) + 1), p = Math.floor((L - 2 * e) / (n - 1)), x0 = a + r05((L - (n - 1) * p) / 2);
      xs = Array.from({ length: n }, (_, i) => x0 + i * p);
    }
    const lo = a + Math.min(e, L / 2) * 0.5, hi = b - Math.min(e, L / 2) * 0.5, out = [];
    for (let x of xs) {
      for (const [p, q] of avoid || []) if (x > p && x < q) {
        const c = [p, q].filter(v => v >= lo && v <= hi).sort((u, v) => Math.abs(u - x) - Math.abs(v - x));
        x = c.length ? c[0] : NaN;
      }
      if (isNaN(x) || (avoid || []).some(([p, q]) => x > p + 0.01 && x < q - 0.01)) continue;
      if (out.some(o => Math.abs(o - x) < (gap || 25))) continue;
      out.push(r05(x));
    }
    return out.sort((u, v) => u - v);
  };
  // a set of fixings: `through` is the part the fixing passes through (or the face side of a dowel), `into` the part
  // it holds in; pts are where it crosses from one to the other; dir points from the head to the tip
  const F = (key, through, into, dir, thru, pts, o) => Object.assign({ key, through, into, dir, thru, pts: pts.map(p => p.map(r05)) }, o || {});
  const dowels = (through, into, dir, pts) => F('d8', through, into, dir, 12, pts);
  const sides = [['R', -1], ['L', 1]];
  const steps = {};
  const inst = (key, i) => { (steps[key] = steps[key] || []).push(i); return i; };
  const cD = [G.yB1, G.yC], ys = spread(G.yB1, G.yC, 50, 200), yd = mid(ys);
  const E = 1; // explode distances are set by the drawing; offsets here are unit directions

  for (const [S, s] of sides) {
    // ---------- plinth ladder
    const pf = one(`Plinth front (${S})`), pb = one(`Plinth back (${S})`), eo = one(`Plinth end, outer (${S})`), ei = one(`Plinth end, inner (${S})`);
    if (pf && pb && eo && ei) {
      const Tp = P.Tplinth, h = G.zPl, zs = spread(0, h, Math.min(13, h / 4), 60);
      const xo = s * (G.xOo - Tp / 2), xi = s * (G.xJ + Tp / 2);
      inst('plinth', { show: S === 'R', side: S, bench: true, base: [eo, ei], ops: [{
        title: 'Front and back onto the ends', add: [[pf, [0, E, 0]], [pb, [0, -E, 0]]],
        fast: [F('s40', pf, eo, [0, -1, 0], Tp, zs.map(z => [xo, G.yC - Tp, z])), F('s40', pf, ei, [0, -1, 0], Tp, zs.map(z => [xi, G.yC - Tp, z])),
          F('s40', pb, eo, [0, 1, 0], Tp, zs.map(z => [xo, G.yB1 + Tp, z])), F('s40', pb, ei, [0, 1, 0], Tp, zs.map(z => [xi, G.yB1 + Tp, z]))],
        setout: `two a corner, ${zs.map(r05).join(' and ')} up, centred on the ends` }] });
    }
    // ---------- tower carcass
    const T1 = one(`Tower outer side (${S})`), T2 = one(`Tower inner side (${S})`), Tb = one(`Tower bottom (${S})`), Tt = one(`Tower top (${S})`);
    const sh = [one(`Fixed shelf over drawers (${S})`), one(`Fixed shelf over hanging (${S})`)], bk = one(`Tower back (${S})`);
    if (T1 && T2 && Tb && Tt && sh[0] && sh[1]) {
      const zsh = [(G.zS1b + G.zS1t) / 2, (G.zS2b + G.zS2t) / 2], xo = s * (G.xOo - T / 2), xi = s * (G.xJ + T / 2);
      const ops = [];
      const frontFirst = { seq: ys.map((_, i) => i === ys.length - 1 ? 1 : 2) }; // the front screw of a joint first keeps the front edges flush
      ops.push({ title: 'Shelves to the outer side', add: [[T1, [s * E, 0, 0]]],
        fast: sh.flatMap((p, k) => [dowels(T1, p, [-s, 0, 0], yd.map(y => [s * G.xOi, y, zsh[k]])), F('s50', T1, p, [-s, 0, 0], T, ys.map(y => [s * G.xOi, y, zsh[k]]), frontFirst)]),
        setout: 'dowels glued into the shelf ends first; then the front screw of each joint (1) with the front edges flush, then the rest (2)' });
      ops.push({ title: 'Inner side, heads sunk flush', add: [[T2, [-s * E, 0, 0]]],
        fast: sh.flatMap((p, k) => [dowels(T2, p, [s, 0, 0], yd.map(y => [s * G.xT2, y, zsh[k]])), F('s50', T2, p, [s, 0, 0], T, ys.map(y => [s * G.xT2, y, zsh[k]]), frontFirst)]),
        setout: 'front screw first (1), then the rest (2); this face goes against the bed-cabinet side, so sink every head just below the surface' });
      ops.push({ title: 'Bottom under the sides', add: [[Tb, [0, 0, -E]]],
        fast: [T1, T2].flatMap((p, k) => { const x = k ? xi : xo; return [dowels(Tb, p, [0, 0, 1], yd.map(y => [x, y, G.zPl + T])), F('s50', Tb, p, [0, 0, 1], T, ys.map(y => [x, y, G.zPl + T]), frontFirst)]; }),
        setout: 'the bottom fits under the sides, flush at the front: front screws first (1), then the rest (2)' });
      ops.push({ title: 'Top over the sides', add: [[Tt, [0, 0, E]]],
        fast: [T1, T2].flatMap((p, k) => { const x = k ? xi : xo; return [dowels(Tt, p, [0, 0, -1], yd.map(y => [x, y, G.zTopB])), F('s50', Tt, p, [0, 0, -1], T, ys.map(y => [x, y, G.zTopB]), frontFirst)]; }),
        setout: 'the same at the top: front screws first (1), then the rest (2)' });
      if (bk) {
        const b = bb(bk), z0 = Math.max(G.zPl + T, b[2]), z1 = Math.min(G.zTopB, b[5]);
        const zsS = spread(z0, z1, 25, 150), xsS = spread(s * G.xOi, s * G.xT2, 25, 150);
        const f = [F('b20', bk, T1, [0, 1, 0], P.Tback, zsS.map(z => [xo, G.yB1, z])), F('b20', bk, T2, [0, 1, 0], P.Tback, zsS.map(z => [xi, G.yB1, z])),
          ...sh.map((p, k) => F('b20', bk, p, [0, 1, 0], P.Tback, xsS.map(x => [x, G.yB1, zsh[k]])))];
        f[0].seq = f[0].pts.map((_, i, a) => i === 0 || i === a.length - 1 ? 1 : 2); f[1].seq = f[0].seq.slice();
        ops.push({ title: 'Back on, square', add: [[bk, [0, -E, 0]]], fast: f, setout: 'the four corner screws first (1), check the diagonals, then the rest (2)' });
      }
      inst('carcass', { show: S === 'R', side: S, bench: true, base: sh, ops });
      // ---------- tower onto its plinth: from inside the tower, between the sides
      const tower = [T1, T2, Tb, Tt, ...sh, bk, one(`Adjustable shelf, top compartment (${S})`)].filter(Boolean);
      if (pf && pb) {
        const xs = spread(s * G.xOi, s * G.xT2, 40, 200), Tp = P.Tplinth;
        inst('towerPlinth', { show: S === 'R', side: S, base: [pf, pb, eo, ei].filter(Boolean), ops: [{
          title: 'Tower onto its plinth', add: tower.map(p => [p, [0, 0, E]]), clip: [-1, 620],
          fast: [F('s40', Tb, pf, [0, 0, -1], T, xs.map(x => [x, G.yC - Tp / 2, G.zPl])), F('s40', Tb, pb, [0, 0, -1], T, xs.map(x => [x, G.yB1 + Tp / 2, G.zPl]))],
          setout: 'down through the bottom, over the plinth front and back, between the sides' }] });
      }
      // ---------- bed-cabinet side, packers, onto the tower
      const B1 = one(`Bed-cabinet side (${S})`), pk = one(`Pivot packer (${S})`), ps = one(`Bed-stop packer (${S})`);
      if (B1) {
        const ops2 = [];
        const plates = parts.filter(p => !p.bed && ['PV', 'BS', 'ST'].includes(p.mark) && p.name.indexOf(`(${S})`) >= 0).map(bb);
        const clear2 = (pts) => pts.map(([y, z]) => {
          for (const q of plates) if (y > q[1] - 14 && y < q[4] + 14 && z > q[2] - 14 && z < q[5] + 14) z = (z - (q[2] - 14) < (q[5] + 14) - z) ? q[2] - 14 : q[5] + 14;
          return [y, z];
        });
        const pkPts = [];
        if (pk || ps) {
          const f = [];
          if (pk) {
            const b = bb(pk), yy = [b[4] - 40, b[1] + 40], zs = spread(b[2], b[5], 40, 250);
            const pts = clear2(yy.flatMap(y => zs.map(z => [y, z]))).filter(([y, z]) => z > b[2] + 20 && z < b[5] - 20);
            f.push(F('s30', pk, B1, [s, 0, 0], P.Tpacker, pts.map(([y, z]) => [s * G.xB, y, z]))); pkPts.push(...pts);
          }
          if (ps) {
            const b = bb(ps), pts = clear2([[b[1] + 20, b[2] + 20], [b[4] - 20, b[2] + 20], [b[1] + 20, b[5] - 20], [b[4] - 20, b[5] - 20]]);
            f.push(F('s30', ps, B1, [s, 0, 0], P.Tpacker, pts.map(([y, z]) => [s * G.xB, y, z]))); pkPts.push(...pts);
          }
          ops2.push({ title: 'Packers onto the bed-cabinet side', bench: true, add: [pk, ps].filter(Boolean).map(p => [p, [-s * E, 0, 0]]), fast: f,
            setout: 'glued; screws clear of the kit plates, which bolt through packer and side' });
        }
        const avoidZ = [[G.zPl, G.zPl + T + 28], [G.zS1b - 16, G.zS1t + 16], [G.zS2b - 16, G.zS2t + 16], ...(G.runnerZ || []).map(z => [z - 31, z + 31])];
        const rows = [G.yB1 + 35, G.yC - 35]; // off the lines of the carcass screws in the side's ends
        const hingeAvoid = P.doorHinge === 'inner' ? parts.filter(p => p.hinges && p.name.indexOf(`(${S})`) >= 0).flatMap(p => p.hinges.map(z => [z - 40, z + 40])) : [];
        // each row also steps around the packer screws that meet it inside the side
        const pts = rows.flatMap(y => spread(G.zPl + T + 30, G.zBm0 - 40, 0, 300,
          avoidZ.concat(y > G.yC - 80 ? hingeAvoid : [], pkPts.filter(([py]) => Math.abs(py - y) < 14).map(([, pz]) => [pz - 13, pz + 13])), 60).map(z => [s * G.xJ, y, z]));
        ops2.push({ title: 'Bed-cabinet side against the tower', add: [B1, pk, ps].filter(Boolean).map(p => [p, [-s * E, 0, 0]]),
          fast: [F('s30', T2, B1, [-s, 0, 0], T, pts)], ctx: true,
          setout: `from inside the tower, two rows 35 in from the front and back edges, clear of the runners and shelves` });
        inst('bedSide', { show: S === 'R', side: S, base: [], context: [...tower, pf, pb, eo, ei].filter(Boolean), ops: ops2 });
      }
    }
  }

  // ---------- the shelf box over the bed
  const B2 = mk('B2')[0], B3 = mk('B3')[0], B4 = mk('B4')[0], U = sides.map(([S]) => one(`Bed-cabinet side, upper (${S})`)), B6 = mk('B6')[0];
  const B7 = sides.map(([S]) => one(`Wall rail under the top (${S})`)), B11 = mk('B11')[0], SF = mk('SF')[0], B5 = mk('B5');
  if (B2 && B3 && B4 && U[0] && U[1]) {
    const ops = [], zShelf = (G.zBm0 + G.zBm1) / 2;
    if (SF) {
      const tw = G.twin ? P.twinSpacing / 2 : P.lockType === 'pins' ? P.lockPinX : null;
      const avoid = [[G.flapHw.latch - 16, G.flapHw.latch + 16], [-G.flapHw.latch - 16, -G.flapHw.latch + 16], ...(tw !== null ? [[tw - 14, tw + 14], [-tw - 14, -tw + 14]] : [])];
      const xs = spread(-G.xB, G.xB, 50, 150, avoid);
      const order = xs.map((x, i) => i).sort((a, b) => Math.abs(xs[a]) - Math.abs(xs[b]) || xs[a] - xs[b]), seq = xs.map(() => 0);
      order.forEach((i, k) => { seq[i] = k + 1; });
      ops.push({ title: 'Steel flat into the shelf', add: [[SF, [0, E, 0]]], fast: [F('s35', SF, B2, [0, -1, 0], P.steelT, xs.map(x => [x, G.yC - P.steelT, zShelf]), { seq })],
        setout: 'bedded in epoxy; drive them in the numbered order, from the middle out, so the flat pulls straight' });
    }
    const xBack = spread(-G.xJ, G.xJ, 25, 150); // the back's screws in the shelf's rear edge
    if (B6) ops.push({ title: 'Wall rail under the shelf', add: [[B6, [0, 0, -E]]],
      fast: [F('s50', B2, B6, [0, 0, -1], T, spread(-G.xB, G.xB, 50, 200, xBack.map(x => [x - 9, x + 9])).map(x => [x, G.yB1 + T / 2, G.zBm0]))] });
    const xu = [-(G.xJ - T / 2), G.xJ - T / 2], nd = G.twin ? G.twin.notchD : 0;
    const ys4 = spread(G.yB1, G.yC - nd, 50, 200);
    // the divider's top edge runs the full depth unless its front notch is as tall as the space
    const ysTop = G.twin && G.zBm1 + G.twin.notchH >= G.zTopB - 30 ? ys4 : ys;
    const f3 = [...U.flatMap((p, k) => [dowels(B2, p, [0, 0, 1], yd.map(y => [xu[k], y, G.zBm1])), F('s50', B2, p, [0, 0, 1], T, ys.map(y => [xu[k], y, G.zBm1]))]),
      F('dom', B2, B4, [0, 0, 1], 20, mid(ys4).map(y => [0, y, G.zBm1]), { along: [0, 1, 0] }), F('s50', B2, B4, [0, 0, 1], T, ys4.map(y => [0, y, G.zBm1]))];
    for (const p of B5) { const b = bb(p); f3.push(F('s50', B2, p, [0, 0, 1], T, spread(b[0], b[3], 50, 200).map(x => [x, (b[1] + b[4]) / 2, G.zBm1]))); }
    ops.push({ title: 'Upper sides and divider onto the shelf', add: [...U, B4, ...B5].map(p => [p, [0, 0, E]]), fast: f3, view: 'below',
      setout: 'seen from below; on the bench the box lies on its back' });
    const f4 = [...U.flatMap((p, k) => [dowels(B3, p, [0, 0, -1], yd.map(y => [xu[k], y, G.zTopB])), F('s50', B3, p, [0, 0, -1], T, ys.map(y => [xu[k], y, G.zTopB]))]),
      F('dom', B3, B4, [0, 0, -1], 20, mid(ysTop).map(y => [0, y, G.zTopB]), { along: [0, 1, 0] }), F('s50', B3, B4, [0, 0, -1], T, ysTop.map(y => [0, y, G.zTopB])),
      ...B7.filter(Boolean).map(p => { const b = bb(p); return F('s50', B3, p, [0, 0, -1], T, spread(b[0], b[3], 50, 200).map(x => [x, G.yB1 + T / 2, G.zTopB])); })];
    ops.push({ title: 'Top on, with its wall rails', add: [[B3, [0, 0, E]], ...B7.filter(Boolean).map(p => [p, [0, 0, 0]])], fast: f4 });
    if (B11) {
      const b = bb(B11), xL = xBack, zU = spread(G.zBm1, G.zTopB, 25, 150);
      const f = [F('b20', B11, B2, [0, 1, 0], P.Tback, xL.map(x => [x, G.yB1, (Math.max(G.zBm0, b[2]) + G.zBm1) / 2])),
        F('b20', B11, B3, [0, 1, 0], P.Tback, xL.map(x => [x, G.yB1, (G.zTopB + Math.min(G.zTop, b[5])) / 2])),
        ...U.map((p, k) => F('b20', B11, p, [0, 1, 0], P.Tback, zU.map(z => [xu[k], G.yB1, z]))), F('b20', B11, B4, [0, 1, 0], P.Tback, zU.map(z => [0, G.yB1, z])),
        ...B7.filter(Boolean).map(p => { const q = bb(p); return F('b20', B11, p, [0, 1, 0], P.Tback, spread(q[0], q[3], 25, 150, [[-30, 30]]).map(x => [x, G.yB1, (q[2] + q[5]) / 2])); })];
      f[0].seq = f[0].pts.map((_, i, a) => i === 0 || i === a.length - 1 ? 1 : 2); f[1].seq = f[0].seq.slice();
      ops.push({ title: 'Back on, square', add: [[B11, [0, -E, 0]]], fast: f, setout: 'the four corner screws first (1), check the diagonals, then the rest (2)' });
    }
    inst('shelfBox', { show: true, bench: true, base: [B2], ops });
    // ---------- the box between the towers
    const box = [B2, B3, B4, ...U, B6, ...B7, B11, SF, ...B5].filter(Boolean), f = [];
    for (const [S, s] of sides) {
      const T2 = one(`Tower inner side (${S})`), u = one(`Bed-cabinet side, upper (${S})`);
      const hingeAvoid = P.doorHinge === 'inner' ? parts.filter(p => p.hinges && p.name.indexOf(`(${S})`) >= 0).flatMap(p => p.hinges.map(z => [z - 40, z + 40])) : [];
      const zs = spread(G.zBm1, G.zTopB, 50, 200, hingeAvoid);
      f.push(F('s30', T2, u, [-s, 0, 0], T, [G.yB1 + 35, G.yC - 35].flatMap(y => zs.map(z => [s * G.xJ, y, z]))));
      // into the shelf's end, between the screws and dowels that come up through it into the upper side
      f.push(F('s50', T2, B2, [-s, 0, 0], T, spread(G.yB1, G.yC, 50, 200, ys.concat(yd).map(y => [y - 10, y + 10])).map(y => [s * G.xJ, y, zShelf])));
    }
    const ctx = parts.filter(p => !p.hw && !p.bed && /^(T[1-6]|B1|B8|B9)$/.test(p.mark));
    inst('fitBox', { show: true, base: [], context: ctx, ops: [{ title: 'Slide the box in, fix it from inside the towers', add: box.map(p => [p, [0, 0, 0]]), fast: f, front: true, ctx: true, clip: [G.zS2b - 60, P.H],
      arrow: [[0, G.yC + 700, (G.zBm1 + G.zTopB) / 2], [0, G.yC + 120, (G.zBm1 + G.zTopB) / 2]],
      setout: 'through the tower sides from inside the top compartments: into the upper sides (C) and the shelf ends (A)' }] });
  }

  // ---------- bed frame (closed geometry; the frame is built face down)
  const F1 = sides.map(([S]) => one(`Bed face panel (${S})`)), F2 = sides.map(([S]) => one(`Side rail (${S})`)), F3 = one('Head rail'), F4 = one('Foot rail');
  const F5 = sides.map(([S]) => one(`Deck long strut (${S})`)), F6 = mk('F6'), F7 = sides.map(([S]) => one(`Mattress support (${S})`));
  if (F1[0] && F1[1] && F2[0] && F2[1] && F3 && F4) {
    const b3 = bb(F3), b4 = bb(F4), ops = [];
    const corner = F2.flatMap((r, k) => {
      const b = bb(r), s = k ? 1 : -1, x = s > 0 ? b3[3] : b3[0], dir = [s > 0 ? -1 : 1, 0, 0];
      return [F('s50', r, F3, dir, T, spread(Math.max(b[1], b3[1]), Math.min(b[4], b3[4]), 25, 60).map(y => [x, y, (b3[2] + b3[5]) / 2])),
        F('s50', r, F4, dir, T, spread(Math.max(b[1], b4[1]), Math.min(b[4], b4[4]), 20, 60).map(y => [x, y, (b4[2] + b4[5]) / 2]))];
    });
    ops.push({ title: 'Side rails to the head and foot rails', add: F2.map((p, k) => [p, [k ? E : -E, 0, 0]]), fast: corner });
    const strike = parts.filter(p => p.bed && p.mark === 'LP').map(bb);
    const avoidX = strike.map(q => [q[0] - 14, q[3] + 14]);
    // each half square first: a screw at each of its four corners (1), then the rest (2)
    const ends = (xs) => xs.map((_, i, a) => i === 0 || i === a.length - 1 ? 1 : 2), nearMid = (xs) => { const m = xs.reduce((b, x, i) => Math.abs(x) < Math.abs(xs[b]) ? i : b, 0); return xs.map((_, i) => i === m ? 1 : 2); };
    const face = F1.flatMap((fp, k) => {
      const s = k ? 1 : -1, r = bb(F2[k]), xr = (r[0] + r[3]) / 2, half = s > 0 ? [0, b3[3]] : [b3[0], 0];
      const zs = spread(r[2], r[5], 50, 200), x3 = spread(half[0], half[1], 50, 200), x4 = spread(half[0], half[1], 50, 200, avoidX);
      return [F('s40', fp, F2[k], [0, -1, 0], T, zs.map(z => [xr, G.yFb, z]), { seq: ends(zs) }),
        F('s40', fp, F3, [0, -1, 0], T, x3.map(x => [x, G.yFb, (b3[2] + b3[5]) / 2]), { seq: nearMid(x3) }),
        F('s40', fp, F4, [0, -1, 0], T, x4.map(x => [x, G.yFb, (b4[2] + b4[5]) / 2]), { seq: nearMid(x4) })];
    });
    ops.push({ title: 'Face panel onto the rails', add: F1.map(p => [p, [0, E, 0]]), fast: face,
      setout: 'each half: its four corner screws first (1), check the diagonals, then the rest (2); sink the heads 2 below the face and fill before finishing' });
    const strutPts = new Map();
    if (F5[0] && F6.length) {
      const f = [];
      F5.forEach((p, k) => { const b = bb(p), zs = spread(b[2], b[5], 50, 300); strutPts.set(p, zs); f.push(F('b25', p, F1[k], [0, 1, 0], P.Tladder, zs.map(z => [(b[0] + b[3]) / 2, G.yFb, z]))); });
      for (const p of F6) {
        const b = bb(p), zc = (b[2] + b[5]) / 2;
        F1.forEach((fp, k) => { const xs = k ? spread(0, b[3], 40, 250) : spread(b[0], 0, 40, 250); strutPts.set(p.name + k, xs); f.push(F('b25', p, fp, [0, 1, 0], P.Tladder, xs.map(x => [x, G.yFb, zc]))); });
      }
      ops.push({ title: 'Deck struts onto the face panel', add: [...F5, ...F6].map(p => [p, [0, -E, 0]]), fast: f, setout: 'glued; the cross struts bridge the joint between the face halves, a screw 40 each side of it' });
    }
    if (F7[0] && F5[0] && F6.length) {
      const f = [];
      F7.forEach((sp, k) => {
        const zs = strutPts.get(F5[k]), b5 = bb(F5[k]);
        f.push(F('b16', sp, F5[k], [0, 1, 0], P.Tsup, mid(zs).map(z => [(b5[0] + b5[3]) / 2, G.ySup1, z])));
        for (const p of F6) { const b = bb(p); f.push(F('b16', sp, p, [0, 1, 0], P.Tsup, mid(strutPts.get(p.name + k)).map(x => [x, G.ySup1, (b[2] + b[5]) / 2]))); }
      });
      ops.push({ title: 'Mattress support onto the struts', add: F7.map(p => [p, [0, -E, 0]]), fast: f, setout: 'between the strut screws' });
    }
    inst('frame', { show: true, bench: true, base: [F3, F4], ops });
  }

  // ---------- headboard ledge and backrest
  const H1 = mk('H1')[0], H2 = mk('H2')[0], H3 = mk('H3')[0], H4 = mk('H4')[0], H6 = mk('H6')[0], ribs = mk('H5');
  if (H1 && H2 && H3) {
    const ops = [], b1 = bb(H1), Tg = P.Tledge;
    const ribX = ribs.map(p => { const b = bb(p); return (b[0] + b[3]) / 2; }), ribAvoid = ribX.map(x => [x - 22, x + 22]);
    if (ribs.length) ops.push({ title: 'Ribs onto the ledge top, from below', bench: true, add: ribs.map(p => [p, [0, 0, E]]), view: 'below',
      fast: ribs.map((p, k) => F('b30', H1, p, [0, 0, 1], Tg, spread(b1[1], Math.min(b1[4], bb(p)[4]), 40, 120).map(y => [ribX[k], y, b1[5]]))),
      setout: 'with the ledge top upside down on the bench' });
    const b2 = bb(H2), b3 = bb(H3);
    ops.push({ title: 'Ledge top onto its front and wall cleat', add: [H1, ...ribs].map(p => [p, [0, 0, E]]),
      fast: [F('s50', H1, H2, [0, 0, -1], Tg, spread(-G.xB, G.xB, 50, 200, ribAvoid).map(x => [x, (b2[1] + b2[4]) / 2, b2[5]])),
        F('s50', H1, H3, [0, 0, -1], Tg, spread(-G.xB, G.xB, 50, 200, ribAvoid).map(x => [x, (b3[1] + b3[4]) / 2, b3[5]]))],
      setout: 'the wall cleat is screwed into the studs first (K, two at each stud)' });
    if (H4 && ribs.length && G.head) {
      const a = G.head.a * Math.PI / 180, B0 = G.head.B0, B1p = G.head.B1, Th = P.Thead;
      const L = Math.hypot(B1p[0] - B0[0], B1p[1] - B0[1]), ss = spread(0, L, 50, 200), nrm = [0, Math.cos(a), Math.sin(a)];
      ops.push({ title: 'Backrest onto the ribs', add: [[H4, nrm.map(v => v * E)]],
        fast: ribs.map((p, k) => F('b30', H4, p, nrm.map(v => -v), Th, ss.map(t => [ribX[k], B0[0] + (B1p[0] - B0[0]) * t / L, B0[1] + (B1p[1] - B0[1]) * t / L]))) });
      if (H6) {
        const zt = G.head.top, yE = (G.head.B1[0] + G.head.F1[0]) / 2;
        ops.push({ title: 'Bedside shelf on top', add: [[H6, [0, 0, E]]],
          fast: [...ribs.map((p, k) => F('b30', H6, p, [0, 0, -1], Th, spread(G.yB1, G.head.B1[0], 35, 200).map(y => [ribX[k], y, zt]))),
            F('b30', H6, H4, [0, 0, -1], Th, spread(-G.xB, G.xB, 50, 200, ribAvoid).map(x => [x, yE, zt]))] });
      }
    }
    inst('ledge', { show: true, base: [H2, H3], ops });
  }

  // ---------- drawer boxes and fronts
  for (const [S, s] of sides) G.fronts.forEach((fr, i) => {
    const sd = all(`Drawer ${i + 1} side (${S})`).slice().sort((p, q) => Math.abs(bb(q)[0] + bb(q)[3]) - Math.abs(bb(p)[0] + bb(p)[3]));
    const fb = all(`Drawer ${i + 1} front/back (${S})`).slice().sort((p, q) => bb(q)[1] - bb(p)[1]);
    const bot = one(`Drawer ${i + 1} bottom (${S})`), D3 = one(`Drawer front ${i + 1} (${S})`);
    if (sd.length < 2 || fb.length < 2 || !bot) return;
    const [so, si] = sd, [bf, bkk] = fb, b = bb(so), bt = bb(bot), zc = (b[2] + b[5]) / 2, Tb = P.Tb;
    // two zones clear of the bottom groove and of the runner's drawer member: one screw (or two) in each
    const free = [], cut = [[b[2], bt[5] + 8], [zc - 16.5, zc + 16.5], [b[5] - 12, b[5]]].sort((p, q) => p[0] - q[0]);
    let z0 = b[2];
    for (const [p, q] of cut) { if (p - z0 >= 16) free.push([z0, p]); z0 = Math.max(z0, q); }
    if (b[5] - z0 >= 16) free.push([z0, b[5]]);
    const zs = free.flatMap(([p, q]) => q - p >= 70 ? [p + (q - p) / 3, p + 2 * (q - p) / 3] : [(p + q) / 2]);
    const yf = (bb(bf)[1] + bb(bf)[4]) / 2, yb = (bb(bkk)[1] + bb(bkk)[4]) / 2, xo = s > 0 ? bb(so)[0] : bb(so)[3], xi2 = s > 0 ? bb(si)[3] : bb(si)[0];
    const members = parts.filter(p => p.mark === 'RN' && p.anim && !p.anim.k && p.name.startsWith(`Drawer ${i + 1} runner`) && p.name.endsWith(`(${S})`));
    const ops = [
      { title: 'Front and back into the first side', add: [[so, [s * E, 0, 0]]],
        fast: [bf, bkk].map((p, k) => F('b30', so, p, [-s, 0, 0], Tb, zs.map(z => [xo, k ? yb : yf, z]))), setout: 'glued; clear of the bottom groove and of the runner' },
      { title: 'Slide the bottom into the grooves', add: [[bot, [-s * E, 0, 0]]], fast: [], arrow: 'add' },
      { title: 'Close with the second side', add: [[si, [-s * E, 0, 0]]],
        fast: [bf, bkk].map((p, k) => F('b30', si, p, [s, 0, 0], Tb, zs.map(z => [xi2, k ? yb : yf, z]))), setout: 'check the diagonals before the glue grabs' }];
    if (members.length) {
      const cx = (p) => { const q = bb(p); return (q[0] + q[3]) / 2; };
      const att = members.map(p => { const side = Math.abs(cx(p) - cx(so)) < Math.abs(cx(p) - cx(si)) ? so : si, out = Math.sign(cx(p) - cx(side)); return { p, side, out }; });
      ops.push({ title: "Runners' drawer members onto the sides", add: att.map(a => [a.p, [a.out * E, 0, 0]]),
        fast: att.map(({ p, side, out }) => { const q = bb(p), xf = out > 0 ? bb(side)[3] : bb(side)[0]; return F('r10', p, side, [-out, 0, 0], 1.2, spread(q[1] + 30, q[4] - 30, 0, 250).map(y => [xf, y, zc])); }),
        setout: 'short screws: the box sides are only 12 thick' });
    }
    inst('drawers', { show: S === 'R' && i === 0, side: S, bench: true, base: [bf, bkk], ops });
    if (D3) {
      const fbx = bb(bf), xs = [fbx[0] + 50, fbx[3] - 50], zz = [bt[5] + 20, b[5] - 25];
      const pts = [[xs[0], zz[1]], [xs[1], zz[0]], [xs[0], zz[0]], [xs[1], zz[1]]];
      inst('fronts', { show: S === 'R' && i === 0, side: S, base: [so, si, bf, bkk, bot], ops: [{ title: 'Front onto the box, from inside', add: [[D3, [0, E, 0]]],
        fast: [F('s25', bf, D3, [0, 1, 0], Tb + P.frontGap, pts.map(([x, z]) => [x, G.yFb, z]), { seq: [1, 1, 2, 2] })],
        setout: `${P.gap} spacers and double-sided tape hold it; 6 holes in the box front; the diagonal pair (1) first, check, then the others (2)` }] });
    }
  });

  // ---------- kick board and header
  const K3 = mk('K3')[0], bat = mk('B12'), K1s = mk('K1');
  const ops = [];
  if (K3 && bat.length) {
    const bradX = new Map(bat.map(p => { const q = bb(p); return [p, spread(q[0], q[3], 30, 200)]; }));
    const offBrads = (p) => (bradX.get(p) || []).map(x => [x - 9, x + 9]);
    ops.push({ title: 'Battens onto the back of the header', bench: true, add: bat.map(p => [p, [0, -E, 0]]),
      fast: bat.map(p => { const q = bb(p); return F('brad', p, K3, [0, 1, 0], q[4] - q[1], bradX.get(p).map(x => [x, G.yFb, (q[2] + q[5]) / 2])); }),
      setout: 'glued and pinned' });
    const f = [];
    for (const [S, s] of sides) {
      const top = one(`Tower top (${S})`), bt2 = bat.find(p => { const q = bb(p); return Math.sign(q[0] + q[3]) === s && Math.abs(q[0] + q[3]) > 10; });
      if (top && bt2) {
        const q = bb(bt2), lo = Math.max(Math.min(s * G.xOi, s * G.xT2), q[0] + 15), hi = Math.min(Math.max(s * G.xOi, s * G.xT2), q[3] - 15);
        if (hi > lo) f.push(F('s30', top, bt2, [0, 0, 1], T, spread(lo, hi, 15, 150, offBrads(bt2)).map(x => [x, G.yFb - 15, G.zTop])));
      }
    }
    const cb = bat.find(p => { const q = bb(p); return Math.abs(q[0] + q[3]) < 10; });
    if (cb && B3) {
      const hz = G.flapHw.hinges.flatMap(h => [[h - 38, h + 38], [-h - 38, -h + 38]]).concat([[-24, 24]]);
      f.push(F('s30', B3, cb, [0, 0, 1], T, spread(-G.xB, G.xB, 50, 250, hz.concat(offBrads(cb))).map(x => [x, G.yFb - 15, G.zTop])));
    }
    ops.push({ title: 'Header onto the tops, scribed to the ceiling', add: [K3, ...bat].map(p => [p, [0, 0, E]]), fast: f, view: 'below', ctx: true, clip: [G.zS2b + 200, P.H + 400],
      setout: 'up through the tops from inside the top compartments and through the flaps' });
  }
  if (K1s.length) {
    const f = [];
    for (const k1 of K1s) {
      const q = bb(k1), zk = (q[2] + q[5]) / 2;
      for (const [S, s] of sides) {
        const pf = one(`Plinth front (${S})`), B1 = one(`Bed-cabinet side (${S})`);
        if (pf) { const b = bb(pf); const xs = [b[0] + 50, b[3] - 50].filter(x => x > q[0] + 20 && x < q[3] - 20); if (xs.length) f.push(F('br30', k1, pf, [0, -1, 0], T + P.frontGap, xs.map(x => [x, G.yC, Math.min(zk, b[5] / 2)]))); }
        if (B1 && q[0] < s * G.xB && q[3] > s * G.xB) f.push(F('br30', k1, B1, [0, -1, 0], T + P.frontGap, [12, q[5] - 12].map(z => [s * (G.xB + T / 2), G.yC, z])));
      }
    }
    ops.push({ title: 'Kick board', add: K1s.map(p => [p, [0, E, 0]]), fast: f, ctx: true, clip: [-1, 420], setout: 'construction adhesive on the plinth fronts and side edges; punch the brads and fill' });
  }
  if (ops.length) inst('kickHeader', { show: true, base: K3 && bat.length ? [K3] : [], context: parts.filter(p => !p.hw && !p.bed && /^(T[1-6]|P[12]|B[1-4]|B1[01])$/.test(p.mark)), ops });

  // counts per fixing over every copy (both towers, every drawer)
  const count = (key) => {
    const c = {};
    for (const i of steps[key] || []) for (const op of i.ops) for (const f of op.fast) c[f.key] = (c[f.key] || 0) + f.pts.length;
    return c;
  };
  return { steps, count, FAST, TAGS };
}

const STUDS = 450;
function assembly(model, sheets) {
  const { P, G, parts } = model, T = P.T, f0 = (v) => String(Math.round(v));
  const nS = (L, e = 50, p = 200) => Math.max(2, Math.ceil(Math.max(0, L - 2 * e) / p) + 1);
  const nD = (L) => Math.max(2, Math.ceil(Math.max(0, L - 120) / 250) + 1);
  const studs = (L) => Math.max(2, Math.floor(L / STUDS) + 1);
  const has = (mk) => parts.some(p => p.mark === mk);
  const FX = {
    s50: ['Cabinet screw 8g x 50 (4.0 x 50), countersunk', 'pilot 3 x 35 deep in the edge; 4.5 clearance + countersink in the face'],
    s40: ['Cabinet screw 8g x 40 (4.0 x 40), countersunk', 'pilot 3; 4.5 clearance + countersink'],
    s30: ['Cabinet screw 8g x 30 (4.0 x 30), countersunk', 'pilot 2.5 in the face; 4.5 clearance + countersink'],
    s35: ['Countersunk screw 8g x 35, through the steel flat', '4.5 + countersink in the steel (HSS bit); pilot 3 in the shelf edge'],
    s25: ['Pan-head screw 8g x 25 (4.0 x 25), drawer fronts', '6 through the box front (room to adjust); pilot 2.5 x 10 in the front'],
    b30: ['Countersunk screw 6g x 30 (3.5 x 30), drawer boxes', 'pilot 2 in the 12 mm edge; 3.5 clearance + countersink'],
    b25: ['Countersunk screw 6g x 25 (3.5 x 25), deck struts', 'pilot 2 in the face panel, 10 deep; 3.5 clearance + countersink'],
    b20: ['Countersunk screw 6g x 20 (3.5 x 20), backs, brackets', 'pilot 2'],
    b16: ['Countersunk screw 6g x 16 (3.5 x 16), mattress support', 'pilot 2 in the struts; 3.5 clearance + countersink'],
    r14: ['Pan-head chipboard screw 4 x 14, runners\' cabinet members', 'pilot 2.5 x 8 (or a Vix bit) through the runner holes'],
    r10: ['Pan-head chipboard screw 3.5 x 10, runners\' drawer members', 'pilot 2 x 6: the box sides are only 12 thick'],
    h15: ['Chipboard screw 3.5 x 15, hinge cups and stays', 'pilot 2 x 8; cups bored 35 x 13 deep'],
    h17: ['Chipboard screw 3.5 x 17, hinge plates', 'pilot 2 x 10 on the 37 / 32 holes (or 6.3 system screws in 5 mm holes)'],
    d8: ['Fluted beech dowel 8 x 30, glued', '8 mm: 12 deep in the face (depth stop), 19 deep in the edge'],
    dom: ['Domino 8 x 40 (or No. 20 biscuit), glued', 'divider to the shelf and the top'],
    w75: ['Batten screw 14g x 75 (6.0 x 75), into timber studs', '6.5 clearance in the rail or panel; brick: 8 x 65 sleeve anchors in 10 mm holes'],
    kit: [`Machine screw for the kit plates, ${P.packer ? f0(P.Tpacker) + ' longer than supplied' : 'as supplied'}`, 'through the side' + (P.packer ? ' and its packer' : '') + ', as the kit plates'],
    m4: ['Handle bolt M4 x 25 (18 mm fronts)', '5 through the front'],
    pin: ['Shelf pin 5 mm', '5 x 10 deep holes, 32 apart, 37 in from front and back'],
    brad: ['Brad 40 mm, 16 gauge, glued: header battens', 'no pilot'],
    br30: ['Brad 30 mm, 16 gauge, with construction adhesive: kick board', 'punch and fill'],
  };
  const qty = {}, steps = [];
  const step = (o) => { o.fix = []; steps.push(o); return o; };
  const add = (st, key, n) => { n = Math.round(n); if (!n) return; qty[key] = (qty[key] || 0) + n; const e = st.fix.find(f => f[0] === key); if (e) e[1] += n; else st.fix.push([key, n]); };
  const nDr = P.drawers.length * 2, nTow = 2;
  const sideL = G.zTopB - G.zPl - T, backL = (G.zTop - G.zPl) - 2 * G.backInset;
  const holes = runnerHoles(G.runner), useR = holes.length > 3 ? 4 : holes.length;
  const doorHinges = parts.filter(p => p.hinges).reduce((a, p) => a + p.hinges.length, 0);
  const B7L = G.xB - T / 2, backH = G.zTop - G.zBm0 - 4;
  const usedSheets = (sheets || []).reduce((a, q) => a + (q.used || 0), 0);
  const band = parts.filter(p => !p.hw).reduce((a, p) => a + (p.band || 0), 0) / 1000;
  const isPlate = (p) => /arm and \d+ mm plate$/.test(p.name);
  const J = joinery(model);
  const addJ = (st, key) => { st.joinery = key; const c = J.count(key); for (const k of Object.keys(c)) add(st, k, c[k]); };

  let st = step({ title: 'Measure and mark out', h: 1.5, parts: () => false,
    text: `Check the width, height and depth at three heights against the ${f0(P.W)} x ${f0(P.H)} x ${f0(P.D)} drawn. Find the studs on the back and side walls with a detector (usually ${STUDS} or 600 apart) and mark their centres, and any cables or pipes. Find the floor's high point: the plinths and bed-cabinet sides are levelled from it.` });
  st = step({ title: 'Cut the parts', h: Math.round((1 + 0.45 * usedSheets) * 2) / 2, parts: () => false,
    text: `${usedSheets} sheets from the cutting plans with a track saw: rip the long parts first and label each part with its mark as it comes off. The kick board and header are full-length rips, ${f0(G.plankL)} long; cut them before anything else from their sheet.` });
  st = step({ title: 'Edge band, sand, pre-finish', h: Math.round((2 + band * 0.08) * 2) / 2, overnight: true, parts: () => false,
    text: `${band.toFixed(0)} m of banding on the edges the cut list marks. Sand to 180 and put two coats on the insides of the towers, the drawer boxes and the backs of the fronts while they lie flat. Leave it overnight.` });
  st = step({ title: 'Drill everything on the flat', h: 3, parts: () => false,
    text: `Runner holes on the tower sides (${holes.join(', ')} from the front edge, on the centre lines on sheet 5); hinge-plate holes 37 back and 32 apart at the cup heights; 35 x 13 cups ${G.hingeDoor.cup} in from the door edges and ${G.hingeFlap.cup} below the flaps' top edges; shelf-pin holes; the dowel holes with a jig and the screw clearance holes, from the set-out strips in the assembly details; the kit plates on the bed-cabinet sides from sheet 5.` });

  st = step({ title: 'Build the plinths', h: 1, parts: (p) => p.mark === 'P1' || p.mark === 'P2',
    text: `Glue and screw each ladder (two screws a corner), check the diagonals, then set it ${f0(P.sideClear)} off the side wall and ${f0(P.backGap)} off the back and level it from the floor's high point with packers under its members.` });
  addJ(st, 'plinth');
  st = step({ title: 'Assemble the tower carcasses', h: 3, parts: (p) => ['T1', 'T2', 'T3', 'T4', 'T6'].includes(p.mark),
    text: `Each tower on its back: glue, dowel and screw the two fixed shelves between the sides (through the sides) and the top and bottom over them (through the top and bottom into the sides). Sink the heads on the inner side flush: it goes against the bed-cabinet side. Square it up and glue and screw the back on, every 150.` });
  addJ(st, 'carcass');
  st = step({ title: 'Fit out the towers', h: 1.5, parts: (p) => p.mark === 'HR' || (p.mark === 'RN' && p.pick) || (p.mark === 'HG' && isPlate(p)) || p.mark === 'T5',
    text: `While they lie on their backs: the runners' cabinet members flush with the front edge on their centre lines, the hinge plates (${G.hingeDoor.H} mm, ${G.hingeDoor.code}), the hanging-rail brackets${P.topShelf ? ' and the shelf pins' : ''}.` });
  add(st, 'r14', nDr * 2 * useR); add(st, 'h17', doorHinges * 2); add(st, 'b20', nTow * 2 * 3); if (P.topShelf) add(st, 'pin', nTow * 4);
  st = step({ title: 'Stand the towers in place', h: 1.5, people: 2, parts: () => false, hl: (p) => /^(T[1-6]|P[12])$/.test(p.mark),
    text: `Stand each tower up on the floor (its diagonal is ${f0(Math.hypot(G.zTop - G.zPl, G.cD + P.Tback))}), lift it onto its plinth and screw down through the bottom into the plinth from inside. Plumb it, pack the outer side off the wall and screw through the packers into the side-wall studs.` });
  addJ(st, 'towerPlinth'); add(st, 'w75', nTow * 3);
  st = step({ title: 'Bed-cabinet sides and kit plates', h: 2, parts: (p) => ['B1', 'B8', 'B9'].includes(p.mark) || (!p.bed && ['PV', 'BS', 'ST'].includes(p.mark)),
    text: `${P.packer ? 'Glue and screw the packers to the bed-cabinet sides, then' : 'First'} fit the kit's cabinet plates (pivots, upper ball studs, bed stops) from sheet 5 while the sides are loose. Stand each side against its tower, plumb, and screw through the tower side into it from inside the tower, two rows every 300.` });
  addJ(st, 'bedSide'); add(st, 'kit', 8);
  const boxParts = ['B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B10', 'B11', 'SF'];
  st = step({ title: 'Make up the shelf box', h: 3, people: 2, parts: (p) => boxParts.includes(p.mark),
    text: `On the floor: ${P.edgeSteel ? `bed the steel flat in epoxy or PU adhesive in the shelf's front notch and screw it every 150; ` : ''}screw the wall rail under the shelf through the shelf. Glue, dowel and screw the two upper sides between the shelf and the top (through the shelf and the top into their edges), the divider in the middle with Dominos, and the top's wall rails. Square it, then glue and screw the 6 mm back onto the back edges every 150: it ties the two sides together.` });
  addJ(st, 'shelfBox');
  st = step({ title: 'Fit the shelf box', h: 1.5, people: 2, parts: () => false, hl: (p) => boxParts.includes(p.mark),
    text: `Slide the box in from the front onto the bed-cabinet sides, so the upper sides stand on the lower ones with the shelf between. Screw down through the shelf into the lower sides and, from inside the towers, through the tower sides into the upper sides, two rows. Screw the three wall rails through the back into the studs.` });
  addJ(st, 'fitBox');
  add(st, 'w75', 2 * studs(2 * G.xB) + 2 * 2 * studs(B7L));
  st = step({ title: 'Flaps, stays, latches' + (G.twin ? ' and twin pin' : ''), h: 2, parts: (p) => ['D4', 'FH', 'FS', 'PL'].includes(p.mark) || (p.mark === 'LP' && !p.bed),
    text: `Hinge plates under the top (${G.hingeFlap.H} mm, ${G.hingeFlap.code}), hinges in the flaps, then hang them and set the reveals. Gas stays on the upper sides and the divider, push latches drilled 10 into the shelf edge.${G.twin ? ' Glue and screw the twin-pin block into the divider\'s notch, press the bushes in and try the pins.' : ''}` });
  add(st, 'h17', 4 * 2); add(st, 'h15', 4 * 2 + 4 * 4); if (G.twin) add(st, 's50', 4);
  const nStrut = parts.filter(p => p.mark === 'F6').length;
  st = step({ title: 'Bed frame and gas springs', h: 4, people: 2, parts: (p) => (p.bed && !p.mattress && p.mark !== 'HD' && p.mark !== 'SP') || p.mark === 'GS', bed: 70,
    text: `Build the frame to the Create-A-Bed plan: rails, deck struts, mattress support and the face panel in two halves, glued and screwed. Fit the frame plates, legs and lower ball studs, hang the frame on the pivots, and fit the gas springs last with the bed down, as the kit says. Swing it slowly and check the clearances on sheet 3.` });
  addJ(st, 'frame');
  if (has('H1') || has('H4')) {
    st = step({ title: 'Headboard ledge and backrest', h: 1.5, parts: (p) => /^H[1-6]$/.test(p.mark), bed: 70,
      text: `With the bed down: the ledge's wall cleat into the studs, then its front and top, glued and screwed.${has('H4') ? ' The backrest on its ribs, leaning back over the swing, and the bedside shelf on top.' : ''}` });
    addJ(st, 'ledge');
    if (has('H1')) add(st, 'w75', 2 * studs(2 * G.xB));
  }
  st = step({ title: 'Drawer boxes', h: Math.round(nDr * 0.4 * 2) / 2, parts: (p) => ['X1', 'X2', 'X3'].includes(p.mark) || (p.mark === 'RN' && !p.pick), open: 1,
    text: `Glue and screw the fronts and backs between the sides with the bottoms slid into their grooves, and check the diagonals. Screw the runners' drawer members to the box sides, flush with the box fronts.` });
  addJ(st, 'drawers');
  st = step({ title: 'Hang the drawers, fit the fronts', h: Math.round(nDr * 0.25 * 2) / 2, parts: (p) => p.mark === 'D3', open: 1,
    text: `Clip the boxes onto the runners. Hold each front in place with double-sided tape and ${f0(P.gap)} spacers, then drill 6 through the box front from inside and screw the front on from inside.` });
  addJ(st, 'fronts');
  st = step({ title: 'Hang the doors', h: Math.round(parts.filter(p => p.mark === 'D1' || p.mark === 'D2').length * 0.4 * 2) / 2, parts: (p) => p.mark === 'D1' || p.mark === 'D2' || (p.mark === 'HG' && !isPlate(p)),
    text: `Screw the hinges into the cups, clip them onto the plates and adjust: side ±2, depth +3/-2, height ±2 for even ${f0(P.gap)} reveals.` });
  add(st, 'h15', doorHinges * 2);
  st = step({ title: 'Kick board and header', h: 1.5, parts: (p) => /^K[1-4]$/.test(p.mark) || p.mark === 'B12',
    text: `Glue and pin the battens to the back of the header at its bottom edge, scribe the header to the ceiling, then screw up through the tops into the battens from inside the top compartments and through the flaps. Kick board: construction adhesive on the plinth fronts and the bed-cabinet sides' front edges, and two brads at each.` });
  addJ(st, 'kickHeader');
  st = step({ title: 'Handles, adjust, final checks', h: 1.5, parts: () => true, bed: 0,
    text: `Handles on the drawers, doors and the bed face. Check the reveals, the runners' stops, the flap stays and the twin pin, re-tighten every wall screw, and swing the bed down once more, slowly, with the mattress on.` });
  add(st, 'm4', 2 * (nDr + parts.filter(p => p.mark === 'D1' || p.mark === 'D2').length + 2));

  // timeline: 6 working hours a day, glue and finish left overnight where marked
  let day = 1, used = 0;
  for (const s of steps) {
    s.day0 = day; s.t0 = used;
    let h = s.h;
    while (used + h > 6.01) { h -= 6 - used; day += 1; used = 0; }
    used += h; s.day1 = day; s.t1 = used;
    if (s.overnight) { day += 1; used = 0; }
  }
  const stepOf = (p) => { const i = steps.findIndex(s => s.parts(p)); return i < 0 ? steps.length - 1 : i; };
  const fixings = Object.keys(FX).filter(k => qty[k]).map(k => ({ key: k, item: FX[k][0], bore: FX[k][1], qty: qty[k], buy: Math.ceil(qty[k] * 1.1 + 2) }));
  const where = {};
  steps.forEach((s, i) => s.fix.forEach(([k, n]) => { (where[k] = where[k] || []).push(`${n} step ${i + 1}`); }));
  fixings.forEach(f => { f.where = where[f.key].join(', '); });
  fixings.forEach(f => { f.tag = TAGS[f.key] || ''; });
  return { steps, fixings, FX, stepOf, days: day, hours: steps.reduce((a, s) => a + s.h, 0), studs: STUDS, joinery: J };
}

/* ------------------------------------------------------------------ sheet nesting (guillotine, cuttable with a track saw) */
function nest(model, cut) {
  const { P } = model;
  const pieces = [];
  for (const r of cut) for (let i = 0; i < r.qty; i++) pieces.push({ mark: r.mark, name: r.name, T: r.T, L: r.L, W: r.W, grain: r.grain, kind: r.kind });
  const byT = new Map();
  for (const p of pieces) { if (!byT.has(p.T)) byT.set(p.T, []); byT.get(p.T).push(p); }
  const result = [];
  for (const [Tk, list] of [...byT.entries()].sort((a, b) => a[0] - b[0])) {
    const stock = [];
    for (const s of P.sheets) if (s.T === Tk) for (let i = 0; i < s.n; i++) stock.push({ L: s.L, W: s.W });
    const run = packBest(list, stock, P.kerf, P.trim);
    // how many would be needed if stock were unlimited (first sheet size, or 2440 x 1220)
    let need = run.bins.length;
    if (run.unplaced.length) {
      const base = stock[0] || { L: 2440, W: 1220 };
      const inf = []; for (let i = 0; i < 60; i++) inf.push({ L: base.L, W: base.W });
      const r2 = packBest(list, inf, P.kerf, P.trim);
      need = r2.unplaced.length ? NaN : r2.bins.length;
    }
    const area = list.reduce((a, p) => a + p.L * p.W, 0);
    result.push({ T: Tk, have: stock.length, used: run.bins.length, need, bins: run.bins, unplaced: run.unplaced, area,
      sheetArea: run.bins.reduce((a, b) => a + b.L * b.W, 0) });
  }
  // sheets in the library that no part uses
  for (const s of P.sheets) if (!result.find(r => r.T === s.T)) result.push({ T: s.T, have: s.n, used: 0, need: 0, bins: [], unplaced: [], area: 0, sheetArea: 0 });
  result.sort((a, b) => a.T - b.T);
  return result;
}
function packBest(list, stock, kerf, trim) {
  const sorts = [
    (a, b) => b.L * b.W - a.L * a.W,
    (a, b) => Math.max(b.L, b.W) - Math.max(a.L, a.W) || b.L * b.W - a.L * a.W,
    (a, b) => b.L - a.L || b.W - a.W,
    (a, b) => b.W - a.W || b.L - a.L,
    (a, b) => (b.L + b.W) - (a.L + a.W),
  ];
  let best = null;
  for (const so of sorts) for (const fit of ['baf', 'bssf', 'blsf']) for (const split of ['sas', 'las', 'minas', 'maxas']) {
    const r = packGuillotine(list.slice().sort(so), stock, kerf, trim, fit, split);
    const score = [r.unplaced.length, r.bins.length, r.lastFill];
    if (!best || score[0] < best.score[0] || (score[0] === best.score[0] && (score[1] < best.score[1] || (score[1] === best.score[1] && score[2] < best.score[2])))) best = Object.assign(r, { score });
  }
  // still parts over: try perturbed orders (seeded, so the same design always nests the same way)
  if (best.unplaced.length) {
    let seed = 12345;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const fits = ['baf', 'bssf', 'blsf'], splits = ['sas', 'las', 'minas', 'maxas'];
    for (let it = 0; it < 400 && best.unplaced.length; it++) {
      const jit = 0.15 + 0.35 * rnd(), keyed = list.map(p => [p, Math.max(p.L, p.W) * (1 + jit * (rnd() - 0.5)) + (rnd() < 0.5 ? p.L * p.W / 1e4 : 0)]);
      keyed.sort((a, b) => b[1] - a[1]);
      const r = packGuillotine(keyed.map(k => k[0]), stock, kerf, trim, fits[Math.floor(rnd() * 3)], splits[Math.floor(rnd() * 4)]);
      const score = [r.unplaced.length, r.bins.length, r.lastFill];
      if (score[0] < best.score[0] || (score[0] === best.score[0] && (score[1] < best.score[1] || (score[1] === best.score[1] && score[2] < best.score[2])))) best = Object.assign(r, { score });
    }
  }
  return best;
}
function packGuillotine(list, stock, kerf, trim, fit, split) {
  const bins = [], unplaced = [], remaining = stock.slice();
  for (const p of list) {
    let bestS = null;
    const tryBin = (bi) => {
      const b = bins[bi];
      b.free.forEach((fr, fi) => {
        const ors = p.grain ? [[p.L, p.W, false]] : [[p.L, p.W, false], [p.W, p.L, true]];
        for (const [w, h, rot] of ors) {
          const W = w + kerf, H = h + kerf;
          if (W <= fr.w + 1e-6 && H <= fr.h + 1e-6) {
            const dw = fr.w - W, dh = fr.h - H;
            const sc = fit === 'baf' ? fr.w * fr.h - W * H : fit === 'bssf' ? Math.min(dw, dh) : Math.max(dw, dh);
            if (!bestS || sc < bestS.sc) bestS = { sc, bi, fi, w, h, W, H, rot };
          }
        }
      });
    };
    for (let bi = 0; bi < bins.length; bi++) tryBin(bi);
    if (!bestS) {
      const fitsSheet = (st) => { const UL = st.L - 2 * trim, UW = st.W - 2 * trim; return (p.L <= UL && p.W <= UW) || (!p.grain && p.W <= UL && p.L <= UW); };
      const j = remaining.findIndex(fitsSheet);
      if (j >= 0) {
        const st = remaining.splice(j, 1)[0];
        bins.push({ L: st.L, W: st.W, free: [{ x: 0, y: 0, w: st.L - 2 * trim + kerf, h: st.W - 2 * trim + kerf }], items: [] });
        tryBin(bins.length - 1);
      }
    }
    if (!bestS) { unplaced.push(p); continue; }
    const b = bins[bestS.bi], fr = b.free[bestS.fi];
    b.items.push({ mark: p.mark, name: p.name, x: fr.x + trim, y: fr.y + trim, w: bestS.w, h: bestS.h, rot: bestS.rot, kind: p.kind, L: p.L, W: p.W });
    b.free.splice(bestS.fi, 1);
    const dw = fr.w - bestS.W, dh = fr.h - bestS.H;
    let horiz; // true: the cut runs along x (full width strip on top)
    if (split === 'sas') horiz = dw <= dh; else if (split === 'las') horiz = dw > dh;
    else if (split === 'minas') horiz = bestS.W * dh <= dw * bestS.H; else horiz = bestS.W * dh > dw * bestS.H;
    const A = horiz ? { x: fr.x + bestS.W, y: fr.y, w: dw, h: bestS.H } : { x: fr.x + bestS.W, y: fr.y, w: dw, h: fr.h };
    const B = horiz ? { x: fr.x, y: fr.y + bestS.H, w: fr.w, h: dh } : { x: fr.x, y: fr.y + bestS.H, w: bestS.W, h: dh };
    for (const r of [A, B]) if (r.w > kerf + 1 && r.h > kerf + 1) b.free.push(r);
  }
  // remove empty bins that were opened but not used
  const used = bins.filter(b => b.items.length);
  const last = used[used.length - 1];
  const lastFill = last ? last.items.reduce((a, it) => a + it.w * it.h, 0) / (last.L * last.W) : 0;
  return { bins: used, unplaced, lastFill };
}

/* ------------------------------------------------------------------ summary */
function summary(model) {
  const cut = cutList(model);
  const sheets = nest(model, cut);
  const vol = model.parts.filter(p => !p.hw).reduce((a, p) => a + p.solids.reduce((s, q) => s + prismVolume(q), 0), 0);
  const bedVol = model.parts.filter(p => p.bed && !p.hw).reduce((a, p) => a + p.solids.reduce((s, q) => s + prismVolume(q), 0), 0);
  const band = cut.reduce((a, r) => a + r.band, 0);
  return { cut, sheets, massPly: vol * PLY_DENSITY, massBed: bedVol * PLY_DENSITY, bandM: band / 1000, hardware: hardwareList(model), build: assembly(model, sheets) };
}

/* ------------------------------------------------------------------ STEP AP214 */
function fmtR(x) {
  if (Math.abs(x) < 5e-10) return '0.';
  let s = x.toFixed(6);
  if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '');
  return s;
}
function stepString(s) { return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "''").replace(/[^\x20-\x7e]/g, '_') + "'"; }
function writeSTEP(model, opts) {
  opts = opts || {};
  const lines = [];
  let id = 0;
  const E = (txt) => { id += 1; lines.push(`#${id} = ${txt};`); return `#${id}`; };
  const dirCache = new Map();
  const D3 = (d) => { const k = d.map(fmtR).join(','); if (!dirCache.has(k)) dirCache.set(k, E(`DIRECTION('',(${k}))`)); return dirCache.get(k); };
  const P3 = (p) => E(`CARTESIAN_POINT('',(${p.map(fmtR).join(',')}))`);
  const AX = (p, axis, ref) => E(`AXIS2_PLACEMENT_3D('',${P3(p)},${D3(axis)},${D3(ref)})`);
  const appCtx = E(`APPLICATION_CONTEXT('core data for automotive mechanical design processes')`);
  E(`APPLICATION_PROTOCOL_DEFINITION('international standard','automotive_design',2000,${appCtx})`);
  const mm = E(`( LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT(.MILLI.,.METRE.) )`);
  const rad = E(`( NAMED_UNIT(*) PLANE_ANGLE_UNIT() SI_UNIT($,.RADIAN.) )`);
  const sr = E(`( NAMED_UNIT(*) SI_UNIT($,.STERADIAN.) SOLID_ANGLE_UNIT() )`);
  const unc = E(`UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(1.E-05),${mm},'distance_accuracy_value','confusion accuracy')`);
  const ctx = E(`( GEOMETRIC_REPRESENTATION_CONTEXT(3) GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((${unc})) GLOBAL_UNIT_ASSIGNED_CONTEXT((${mm},${rad},${sr})) REPRESENTATION_CONTEXT('Context #1','3D Context with UNIT and UNCERTAINTY') )`);
  const pctx = E(`PRODUCT_CONTEXT('',${appCtx},'mechanical')`);
  const pdctx = E(`PRODUCT_DEFINITION_CONTEXT('part definition',${appCtx},'design')`);
  const origin = AX([0, 0, 0], [0, 0, 1], [1, 0, 0]);
  function product(name, desc) {
    const pr = E(`PRODUCT(${stepString(name)},${stepString(name)},${stepString(desc || '')},(${pctx}))`);
    E(`PRODUCT_RELATED_PRODUCT_CATEGORY('part',$,(${pr}))`);
    const pdf = E(`PRODUCT_DEFINITION_FORMATION('','',${pr})`);
    const pd = E(`PRODUCT_DEFINITION('design','',${pdf},${pdctx})`);
    const pds = E(`PRODUCT_DEFINITION_SHAPE('','',${pd})`);
    return { pd, pds, extraItems: [], links: [] };
  }
  let nauoId = 0;
  function link(parent, child, name) {
    const place = AX([0, 0, 0], [0, 0, 1], [1, 0, 0]);
    parent.extraItems.push(place);
    const idt = E(`ITEM_DEFINED_TRANSFORMATION('','',${origin},${place})`);
    nauoId += 1;
    const nauo = E(`NEXT_ASSEMBLY_USAGE_OCCURRENCE('${nauoId}',${stepString(name)},'',${parent.pd},${child.pd},$)`);
    const pds = E(`PRODUCT_DEFINITION_SHAPE('Placement','Placement of an item',${nauo})`);
    parent.links.push({ child, idt, pds });
  }
  function rightNormal2(s) { const d = [s.b[0] - s.a[0], s.b[1] - s.a[1]], l = Math.hypot(d[0], d[1]); return [d[1] / l, -d[0] / l]; }
  const dir3 = (pr, d) => add(mul(pr.u, d[0]), mul(pr.v, d[1]));
  function solid(pr, name) {
    const L = pr.len, n = pr.n;
    const loopsE = pr.loops.map((loop) => {
      const K = loop.length, vb = [], vt = [];
      for (let k = 0; k < K; k++) { vb.push(E(`VERTEX_POINT('',${P3(to3(pr, loop[k].a, 0))})`)); vt.push(E(`VERTEX_POINT('',${P3(to3(pr, loop[k].a, L))})`)); }
      const eb = [], et = [], ev = [];
      for (let k = 0; k < K; k++) {
        const s = loop[k], k1 = (k + 1) % K;
        for (const [arr, w, va, vb_] of [[eb, 0, vb[k], vb[k1]], [et, L, vt[k], vt[k1]]]) {
          let curve, sense = '.T.';
          if (s.t === 'L') {
            const d3 = dir3(pr, [s.b[0] - s.a[0], s.b[1] - s.a[1]]), len = Math.hypot(...d3);
            curve = E(`LINE('',${P3(to3(pr, s.a, w))},${E(`VECTOR('',${D3(norm(d3))},${fmtR(len)})`)})`);
          } else {
            const ref = norm(dir3(pr, [s.a[0] - s.c[0], s.a[1] - s.c[1]]));
            curve = E(`CIRCLE('',${AX(to3(pr, s.c, w), n, ref)},${fmtR(s.r)})`);
            sense = s.ccw ? '.T.' : '.F.';
          }
          arr.push(E(`EDGE_CURVE('',${va},${vb_},${curve},${sense})`));
        }
        ev.push(E(`EDGE_CURVE('',${vb[k]},${vt[k]},${E(`LINE('',${P3(to3(pr, loop[k].a, 0))},${E(`VECTOR('',${D3(n)},${fmtR(L)})`)})`)},.T.)`));
      }
      return { K, eb, et, ev };
    });
    const faces = [];
    const OE = (e, o) => E(`ORIENTED_EDGE('',*,*,${e},${o ? '.T.' : '.F.'})`);
    pr.loops.forEach((loop, li) => {
      const { K, eb, et, ev } = loopsE[li];
      for (let k = 0; k < K; k++) {
        const s = loop[k], k1 = (k + 1) % K;
        const lp = E(`EDGE_LOOP('',(${OE(eb[k], 1)},${OE(ev[k1], 1)},${OE(et[k], 0)},${OE(ev[k], 0)}))`);
        let surf, sense = '.T.';
        if (s.t === 'L') {
          const d3 = norm(dir3(pr, [s.b[0] - s.a[0], s.b[1] - s.a[1]])), nrm = dir3(pr, rightNormal2(s));
          surf = E(`PLANE('',${AX(to3(pr, s.a, 0), nrm, d3)})`);
        } else {
          const ref = norm(dir3(pr, [s.a[0] - s.c[0], s.a[1] - s.c[1]]));
          surf = E(`CYLINDRICAL_SURFACE('',${AX(to3(pr, s.c, 0), n, ref)},${fmtR(s.r)})`);
          sense = s.ccw ? '.T.' : '.F.';
        }
        faces.push(E(`ADVANCED_FACE('',(${E(`FACE_OUTER_BOUND('',${lp},.T.)`)}),${surf},${sense})`));
      }
    });
    const botB = [], topB = [];
    pr.loops.forEach((loop, li) => {
      const { K, eb, et } = loopsE[li], rb = [], rt = [];
      for (let k = K - 1; k >= 0; k--) rb.push(OE(eb[k], 0));
      for (let k = 0; k < K; k++) rt.push(OE(et[k], 1));
      const kind = li === 0 ? 'FACE_OUTER_BOUND' : 'FACE_BOUND';
      botB.push(E(`${kind}('',${E(`EDGE_LOOP('',(${rb.join(',')}))`)},.T.)`));
      topB.push(E(`${kind}('',${E(`EDGE_LOOP('',(${rt.join(',')}))`)},.T.)`));
    });
    faces.push(E(`ADVANCED_FACE('',(${botB.join(',')}),${E(`PLANE('',${AX(pr.o, mul(n, -1), pr.u)})`)},.T.)`));
    faces.push(E(`ADVANCED_FACE('',(${topB.join(',')}),${E(`PLANE('',${AX(add(pr.o, mul(n, L)), n, pr.u)})`)},.T.)`));
    const shell = E(`CLOSED_SHELL('',(${faces.join(',')}))`);
    return E(`MANIFOLD_SOLID_BREP(${stepString(name)},${shell})`);
  }
  const colourCache = new Map();
  function styleFor(rgb) {
    const k = rgb.join(',');
    if (!colourCache.has(k)) {
      const col = E(`COLOUR_RGB('',${rgb.map(fmtR).join(',')})`);
      const fas = E(`FILL_AREA_STYLE('',(${E(`FILL_AREA_STYLE_COLOUR('',${col})`)}))`);
      const sss = E(`SURFACE_SIDE_STYLE('',(${E(`SURFACE_STYLE_FILL_AREA(${fas})`)}))`);
      colourCache.set(k, E(`SURFACE_STYLE_USAGE(.BOTH.,${sss})`));
    }
    return colourCache.get(k);
  }
  const GROUP_NAMES = { 'tower-L': 'LEFT_TOWER', 'tower-R': 'RIGHT_TOWER', 'drawers-L': 'LEFT_DRAWERS', 'drawers-R': 'RIGHT_DRAWERS', 'bed-cabinet': 'BED_CABINET',
    'bed-frame': 'BED_FRAME', 'fronts-L': 'LEFT_FRONTS', 'fronts-R': 'RIGHT_FRONTS', 'fronts-C': 'CENTRE_FRONTS', hardware: 'HARDWARE_SCHEMATIC', mattress: 'MATTRESS' };
  const rootName = opts.name || 'MURPHY_WARDROBE';
  const rootNode = product(rootName, `${model.P.W} x ${model.P.H} x ${model.P.D} cavity`);
  const groups = new Map();
  for (const p of model.parts) {
    if (p.hw && opts.hardware === false && !p.mattress) continue;
    if (p.mattress && opts.mattress === false) continue;
    const g = GROUP_NAMES[p.grp] || p.grp.toUpperCase();
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(p);
  }
  const styled = [], gnodes = [], used = new Set();
  for (const [gname, plist] of groups) {
    const gNode = product(gname);
    link(rootNode, gNode, gname);
    for (const p of plist) {
      let nm = (p.mark + '_' + p.name).replace(/[(),]/g, '').replace(/[^A-Za-z0-9_.-]+/g, '_');
      const base = nm; let k = 2;
      while (used.has(nm)) nm = `${base}_${k++}`;
      used.add(nm);
      const desc = p.hw ? 'hardware (schematic)' : `${p.T} mm plywood, ${Math.round(p.L)} x ${Math.round(p.W)}`;
      const pNode = product(nm, desc);
      const sol = opts.cadFront === false ? p.solids : p.solids.map(rotZ180);
      const breps = sol.map((s, si) => solid(s, p.solids.length > 1 ? `${nm}_${si + 1}` : nm));
      const rep = E(`ADVANCED_BREP_SHAPE_REPRESENTATION('',(${[origin].concat(breps).join(',')}),${ctx})`);
      E(`SHAPE_DEFINITION_REPRESENTATION(${pNode.pds},${rep})`);
      pNode.rep = rep;
      const ssu = styleFor(COLORS[p.kind] || [0.7, 0.7, 0.7]);
      for (const b of breps) styled.push(E(`STYLED_ITEM('color',(${E(`PRESENTATION_STYLE_ASSIGNMENT((${ssu}))`)}),${b})`));
      link(gNode, pNode, nm);
    }
    gnodes.push(gNode);
  }
  const finish = (node) => { const rep = E(`SHAPE_REPRESENTATION('',(${[origin].concat(node.extraItems).join(',')}),${ctx})`); E(`SHAPE_DEFINITION_REPRESENTATION(${node.pds},${rep})`); node.rep = rep; };
  for (const gN of gnodes) finish(gN);
  finish(rootNode);
  const writeLinks = (node) => { for (const lk of node.links) { const rel = E(`( REPRESENTATION_RELATIONSHIP('','',${lk.child.rep},${node.rep}) REPRESENTATION_RELATIONSHIP_WITH_TRANSFORMATION(${lk.idt}) SHAPE_REPRESENTATION_RELATIONSHIP() )`); E(`CONTEXT_DEPENDENT_SHAPE_REPRESENTATION(${rel},${lk.pds})`); } };
  writeLinks(rootNode);
  for (const gN of gnodes) writeLinks(gN);
  if (styled.length) E(`MECHANICAL_DESIGN_GEOMETRIC_PRESENTATION_REPRESENTATION('',(${styled.join(',')}),${ctx})`);
  const ts = opts.timestamp || new Date().toISOString().slice(0, 19);
  const head = ['ISO-10303-21;', 'HEADER;', "FILE_DESCRIPTION(('Murphy bed wardrobe, parametric'),'2;1');",
    `FILE_NAME(${stepString(rootName + '.step')},'${ts}',('Murphy wardrobe configurator'),(''),'murphy-step-writer 1.0','murphy-step-writer 1.0','');`,
    "FILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'));", 'ENDSEC;', 'DATA;'];
  return head.concat(lines, ['ENDSEC;', 'END-ISO-10303-21;']).join('\n') + '\n';
}

/* ------------------------------------------------------------------ zip (stored, no compression) */
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(bytes) { let c = 0xFFFFFFFF; for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function makeZip(files) { // files: [{name, data: Uint8Array}]
  const enc = (s) => new TextEncoder().encode(s);
  const chunks = [], central = [];
  let off = 0;
  const d = new Date(), dt = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xFFFF, dd = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF;
  for (const f of files) {
    const name = enc(f.name), data = f.data, crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
    h.setUint16(10, dt, true); h.setUint16(12, dd, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true);
    h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
    chunks.push(new Uint8Array(h.buffer), name, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
    c.setUint16(12, dt, true); c.setUint16(14, dd, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
    c.setUint16(28, name.length, true); c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), name);
    off += 30 + name.length + data.length;
  }
  const cdSize = central.reduce((a, b) => a + b.length, 0);
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cdSize, true); e.setUint32(16, off, true);
  const all = chunks.concat(central, [new Uint8Array(e.buffer)]);
  const out = new Uint8Array(all.reduce((a, b) => a + b.length, 0));
  let p = 0; for (const c of all) { out.set(c, p); p += c.length; }
  return out;
}

const api = { DEFAULTS, COLORS, SOURCES, HW_ASSUMPTIONS, reviewNotes, assembly, joinery, FAST, TAGS, cyl, box, RUNNER_STD, RUNNER_HW, HINGE_HW, runnerHoles, hingeFit, PLY_DENSITY, normParams, derived, build, cutList, nest, summary, writeSTEP, makeZip, crc32,
  prismBox, prismCorners, prismVolume, loopPolyline, to3, rot2, rotYZ, rotatePrism, legGeom, legPsi, bedProfile, clearances, hingeZs, springEnds, stayEnds, springSolids, staySolids, linkEnds, linkSolids, rectLoopR01 };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.MurphyCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
