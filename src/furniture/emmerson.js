// Castlery "Emmerson Adjustable Standing Desk" (current 3-stage, dual-motor version, 2023+ manual), solid American
// walnut or American oak top on a black T-frame. Format: see FORMAT.md. Millimetres; x along the length (x = 0 at the
// RIGHT end as seen standing at the front), y = 0 at the back, y = D at the front, z up from the floor.
(function (root) {
  function build(opt) {
    opt = opt || {};
    const r1 = (v) => Math.round(v * 10) / 10;

    // ---- top ---------------------------------------------------------------------------------------------------
    const L = +opt.length || 1400;             // published options: 1200 and 1400
    const D = 700;                             // published: D70 cm
    const T = +opt.thickness || 20;            // inferred: overall H 60-125 minus published leg height 58-123 = 20 mm
    const tEdge = Math.min(T, 12);             // visible edge thickness after the underside bevel (estimate)
    const bevW = 30;                           // width of the underside bevel, inward from each edge (estimate)
    const rc = +opt.cornerR || 40;             // plan corner radius: about 40 (owner's measurement)
    // the front edge: flat for 250 at each end, then a shallow arc set back 50 at the middle, where you sit (owner's
    // measurement); a circle through both ends of the 900 chord and 50 deep: radius (450^2 + 50^2) / 100 = 2050
    const flat = opt.indentFlat == null ? 250 : +opt.indentFlat, sag = opt.indent == null ? 50 : +opt.indent;
    const chord = L - 2 * flat, Rarc = sag > 0 && chord > 0 ? ((chord / 2) ** 2 + sag * sag) / (2 * sag) : 0;

    // ---- frame (fixed parts) -------------------------------------------------------------------------------------
    const frameMin = 580, frameMax = 1230;     // published "leg height" 58-123 cm (frame height = underside of top)
    const hMin = frameMin + T, hMax = frameMax + T;   // 600 - 1250 with the 20 mm top (published 60-125 cm)
    let H = opt.height == null ? hMin : +opt.height;
    H = Math.max(hMin, Math.min(hMax, H));
    const zU = H - T;                          // underside of the top

    const legToLeg = +opt.legToLeg || (L - 270);   // published 93 cm at L 120 (clear width between columns at 45 cm)
    const col = [                              // outer section of each column stage [x width, y depth] (estimates)
      [70, 80],                                // stage 1, bottom (outer), fixed to the foot
      [63, 73],                                // stage 2, middle
      [56, 66],                                // stage 3, top, carries the side bracket
    ];
    const legInsetCol = (L - legToLeg) / 2 - col[0][0];   // end of top -> outer face of bottom stage
    const cxR = legInsetCol + col[0][0] / 2;               // column centre x, right leg (x = 0 end)
    const cxL = L - cxR;                                   // left leg
    const cy = D / 2;                                      // T-frame: column centred in depth (estimate)

    const glideH = 10, glideD = 32;            // levelling glides (published: adjust up to 1 cm)
    const footW = 70, footLen = 680, footHc = 34, footHe = 18;   // foot: width x, length y, height mid / ends (est.)
    const fy0 = cy - footLen / 2, fy1 = cy + footLen / 2;
    const zFootTop = glideH + footHc;          // column stands on the foot here

    const brW = 60, brLen = 580, brH = 28;     // side bracket (top-mounting arm) under the top (estimates)
    const by0 = cy - brLen / 2, by1 = cy + brLen / 2;
    const zBr = zU - brH;                      // underside of the side bracket = top of the column

    const beamY = 60, beamZ = 30;              // supporting beam section (estimate), flush under the top, centred on legs
    const trayLen = 700, trayDep = 120, trayH = 90, trayY0 = 40;   // cable tray (listed in the manual), at the back

    // column stage heights: bottom stage fixed; the two moving stages share the stroke equally
    const stroke = zU - (frameMin);            // 0 at the lowest position, 650 at the top
    const exp2 = 15 + stroke / 2, exp3 = 25 + stroke / 2;   // visible length of stage 2 and 3
    const z1top = (frameMin - brH) - 25 - 15;  // top of the bottom stage (fixed): 512
    const z2top = z1top + exp2, z3top = zBr;   // z3top == z2top + exp3

    const wood = opt.wood === 'oak' ? 'oak' : 'walnut';
    const keypad = opt.keypad === 'left' ? 'left' : 'right';
    const tray = opt.tray !== false;

    const materials = {
      walnut: '#6b4a33',      // American walnut, clear lacquer: warm mid/dark brown
      oak: '#c9a77a',         // American (white) oak, clear lacquer
      frame: '#232323',       // matte black powder-coated steel
      glide: '#121212',       // black plastic levelling glides
      keypad: '#1a1a1a',      // black hand switch
      display: '#3a4248',     // keypad LED window (dark)
      grommet: '#151515',     // cable-hole grommet caps
      tray: '#262626',        // black steel cable tray
    };
    const top = wood;
    const parts = [];
    const box = (name, mat, min, max) => parts.push({ name, mat, shape: 'box', min, max });

    // ---- top: the plan (rounded corners, the front's arc) as an upper slab at the full outline and a lower slab set
    // in, standing for the underside bevel (the edge looks tEdge thick) --------------------------------------------
    // outline inset by d: the corners keep their centres (radius rc - d), the arc its centre (radius Rarc + d)
    const outline = (d) => {
      const r = Math.max(2, rc - d), pts = [], arcPts = [];
      const corner = (cx, cyy, a0) => { for (let i = 0; i <= 4; i++) { const a = (a0 + i * 22.5) * Math.PI / 180; pts.push([r1(cx + r * Math.cos(a)), r1(cyy + r * Math.sin(a))]); } };
      if (Rarc > 0) {
        const ca = D - sag + Rarc, Ra = Rarc + d, yE = D - d, half = Math.sqrt(Math.max(0, Ra * Ra - (ca - yE) ** 2)), n = 16;
        for (let i = 0; i <= n; i++) { const x = L / 2 + half - 2 * half * i / n; arcPts.push([r1(x), r1(ca - Math.sqrt(Math.max(0, Ra * Ra - (x - L / 2) ** 2)))]); }
      }
      corner(L - rc, D - rc, 0);                           // front, at the x = L end; then along the front toward x = 0
      pts.push(...arcPts);
      corner(rc, D - rc, 90); corner(rc, rc, 180); corner(L - rc, rc, 270);
      return pts;
    };
    parts.push({ name: 'top (upper slab)', mat: top, shape: 'extrude', axis: 'z', from: H - tEdge, to: H, pts: outline(0) });
    if (T > tEdge) parts.push({ name: 'top (lower slab, inside the underside bevel)', mat: top, shape: 'extrude', axis: 'z', from: zU, to: H - tEdge, pts: outline(bevW * 0.6) });
    // two cable-management holes with grommet caps, back corners (positions estimated)
    for (const gx of [200, L - 200]) parts.push({ name: 'cable grommet', mat: 'grommet', shape: 'cyl', a: [gx, 70, H - 2], b: [gx, 70, H + 0.6], d: 60 });

    // ---- legs ------------------------------------------------------------------------------------------------------
    for (const [side, cx] of [['right', cxR], ['left', cxL]]) {
      // foot: tapered T-foot, flat underside on two glides
      parts.push({ name: `foot ${side}`, mat: 'frame', shape: 'extrude', axis: 'x', from: cx - footW / 2, to: cx + footW / 2,
        pts: [[fy0, glideH], [fy1, glideH], [fy1, glideH + footHe], [cy + 110, zFootTop], [cy - 110, zFootTop], [fy0, glideH + footHe]] });
      for (const gy of [fy0 + 40, fy1 - 40]) parts.push({ name: `glide ${side}`, mat: 'glide', shape: 'cyl', a: [cx, gy, 0], b: [cx, gy, glideH], d: glideD });
      // column: three rectangular stages, largest at the bottom
      const st = (i, z0, z1) => box(`column ${side} stage ${i + 1}`, 'frame',
        [cx - col[i][0] / 2, cy - col[i][1] / 2, z0], [cx + col[i][0] / 2, cy + col[i][1] / 2, z1]);
      st(0, zFootTop, z1top);
      st(1, z1top - 5, z2top);
      st(2, z2top - 5, z3top);
      // plastic guide collars at the top of stages 1 and 2
      box(`column ${side} collar 1`, 'glide', [cx - col[0][0] / 2 - 1.5, cy - col[0][1] / 2 - 1.5, z1top - 10], [cx + col[0][0] / 2 + 1.5, cy + col[0][1] / 2 + 1.5, z1top]);
      box(`column ${side} collar 2`, 'glide', [cx - col[1][0] / 2 - 1.5, cy - col[1][1] / 2 - 1.5, z2top - 8], [cx + col[1][0] / 2 + 1.5, cy + col[1][1] / 2 + 1.5, z2top]);
      // side bracket (top-mounting arm) running front to back under the top
      box(`side bracket ${side}`, 'frame', [cx - brW / 2, by0, zBr], [cx + brW / 2, by1, zU]);
    }
    // supporting beam between the side brackets, flush under the top, in line with the columns
    box('supporting beam', 'frame', [cxR + brW / 2, cy - beamY / 2, zU - beamZ], [cxL - brW / 2, cy + beamY / 2, zU]);

    // cable management tray (manual parts list), open U-channel under the back of the top
    if (tray) {
      const t = 2, y0 = trayY0, y1 = trayY0 + trayDep, zb = zU - trayH;
      parts.push({ name: 'cable tray', mat: 'tray', shape: 'extrude', axis: 'x', from: (L - trayLen) / 2, to: (L + trayLen) / 2,
        pts: [[y0, zU], [y0, zb], [y1, zb], [y1, zU - 30], [y1 - t, zU - 30], [y1 - t, zb + t], [y0 + t, zb + t], [y0 + t, zU]] });
    }

    // hand switch (4 memory keys + display) under the front edge
    const kW = 150, kx0 = keypad === 'right' ? 185 : L - 185 - kW, kx1 = kx0 + kW;
    parts.push({ name: 'keypad', mat: 'keypad', shape: 'extrude', axis: 'x', from: kx0, to: kx1,
      pts: [[D - 64, zU], [D - 4, zU], [D - 4, zU - 8], [D - 14, zU - 24], [D - 64, zU - 24]] });
    parts.push({ name: 'keypad display', mat: 'display', shape: 'extrude', axis: 'x', from: kx0 + 12, to: kx0 + 52,
      pts: [[D - 4.5, zU - 9], [D - 3.5, zU - 9], [D - 12.5, zU - 21], [D - 13.5, zU - 21]] });

    // ---- dims: everything below the top, relative to the TOP SURFACE (z negative) ----------------------------------
    const under = [];
    for (const p of parts) {
      let mn, mx;
      if (p.shape === 'box') { mn = p.min; mx = p.max; }
      else if (p.shape === 'cyl') { mn = [0, 1, 2].map(i => Math.min(p.a[i], p.b[i]) - (i === 2 ? 0 : p.d / 2)); mx = [0, 1, 2].map(i => Math.max(p.a[i], p.b[i]) + (i === 2 ? 0 : p.d / 2)); }
      else {
        const u = p.pts.map(q => q[0]), v = p.pts.map(q => q[1]);
        const rng = { x: [p.from, p.to], u: [Math.min(...u), Math.max(...u)], v: [Math.min(...v), Math.max(...v)] };
        if (p.axis === 'z') { mn = [rng.u[0], rng.v[0], p.from]; mx = [rng.u[1], rng.v[1], p.to]; }
        if (p.axis === 'x') { mn = [p.from, rng.u[0], rng.v[0]]; mx = [p.to, rng.u[1], rng.v[1]]; }
        if (p.axis === 'y') { mn = [rng.u[0], p.from, rng.v[0]]; mx = [rng.u[1], p.to, rng.v[1]]; }
      }
      if (p.name.startsWith('top') || p.name === 'cable grommet') continue;
      under.push({ name: p.name, x: [r1(mn[0]), r1(mx[0])], y: [r1(mn[1]), r1(mx[1])], z: [r1(mn[2] - H), r1(mx[2] - H)] });
    }
    // nearest approach of any part below the top to each end of the top (x = 0 is the right end seen from the front)
    const endClear = { right: Math.min(...under.map(u => u.x[0])), left: r1(L - Math.max(...under.map(u => u.x[1]))) };
    const dims = {
      L, D, T, H, hMin, hMax,
      edgeVisible: tEdge, bevelWidth: bevW, cornerRadius: rc,
      undersideZ: -T,                                   // underside of the top, relative to the top surface
      undersideAtEdge: -tEdge,                          // at the very edge (underside bevel), relative to top surface
      frameHeight: [frameMin, frameMax],                // floor -> underside of the top
      legToLeg,                                         // clear width between the columns
      frameWidth: L - 2 * legInsetCol,                  // outside of column to outside of column
      columnCentresX: [cxR, cxL], columnCentreY: cy,
      legInset: {                                       // x from each end of the top
        column: legInsetCol,                            // outer face of the bottom (widest) stage
        collar: r1(cxR - col[0][0] / 2 - 1.5),          // plastic guide collar at the top of the bottom stage
        columnTopStage: r1(cxR - col[2][0] / 2),
        foot: r1(cxR - footW / 2),                      // side face of the foot (feet run front to back)
        glide: r1(cxR - glideD / 2),
      },
      armInset: {                                       // x from each end of the top to frame members under it
        sideBracket: r1(cxR - brW / 2),                 // nearest member under the top: the side brackets
        beam: r1(cxR + brW / 2),
        tray: tray ? (L - trayLen) / 2 : null,
        keypad: keypad === 'right' ? { right: kx0 } : { left: L - kx1 },
      },
      sideBracket: { width: brW, length: brLen, height: brH, y: [by0, by1], z: [-T - brH, -T] },
      beam: { section: [beamY, beamZ], y: [cy - beamY / 2, cy + beamY / 2], z: [-T - beamZ, -T], x: [cxR + brW / 2, cxL - brW / 2] },
      foot: { length: footLen, width: footW, heightMid: footHc, heightEnd: footHe, y: [fy0, fy1], glideHeight: glideH },
      columnStages: col,
      // nothing but the top itself lies within this distance of each end of the top, at any height; so an object
      // reaching less than this far under an end only needs its top below the underside of the top (H - T)
      endClear,
      endZoneClear: Math.min(endClear.right, endClear.left),
      under,
      options: { length: L, wood, keypad, tray, height: H },
    };

    const notes = [
      'Current Emmerson version: 3-stage lifting columns (Castlery review variant names "with 3-stage Leg"), electric, 4 memory presets, 38 mm/s, 125 kg (assembly manual 2023-02-28). Older 2-stage version (H 70-120 cm, leg-to-leg 111 cm at 140 cm, max 100 kg) is not modelled.',
      'Published (Castlery AU/US/UK spec blocks, all for the 120 cm length): W120 x D70 x H 60-125 cm; leg height 58-123 cm; leg-to-leg distance 93 cm at 45 cm height; levellers max 1 cm; 47 kg; 2 cable-management holes; solid oak/walnut top, clear lacquer; metal frame. Lengths offered: 120 and 140 cm (no 160). Woods: American walnut and American oak.',
      'Top thickness T = 20 mm is inferred: published overall height (60-125) minus published leg height (58-123). The 4.2 x 19 mm top screws and the 47 kg weight are also consistent with 20-25 mm. opt.thickness overrides; the frame range stays 580-1230 mm and hMin/hMax move with T.',
      'Edge: BHG review lists "sleek bevelled edges"; an image-derived tag set (MeetFelix) says "slim profile", "curved front edge". Modelled as a 12 mm visible edge with an 8 mm high x 30 mm wide underside bevel on all four sides, plan corners r 8 mm. Bevel size and corner radius are estimates; for clearance use the flat underside at -T.',
      'Leg position: the 93 cm clear width at L 1200 gives column outer faces (L - 930)/2 - 70 = 65 mm from each end with the assumed 70 mm column width. The 140 cm spec is not published (the server-rendered page only shows the 120 cm block); assumed the frame keeps the same end inset (leg-to-leg 1130 mm). opt.legToLeg overrides.',
      'Frame parts (manual parts list): 2 feet, 2 lifting columns, 1 supporting beam, 2 side brackets, 1 cable-management tray, 1 hand switch, power plug, desktop. No separate control box is listed, so none is modelled (controller assumed integrated). A customer review (May 2026) wishes a cable tray were included, so the current shipment may lack the tray: opt.tray = false removes it.',
      'Frame colour: black (MeetFelix product tags "black metal T-frame" for the current oak SKU AS-000998-OA; Castlery offers no frame-colour option). Assumed the same black frame with walnut.',
      'Estimated (not published, product photos could not be inspected from this session): column stage sections 70x80 / 63x73 / 56x66 mm (x by y, largest at the bottom), foot 680 long x 70 wide x 34 mm high at the column tapering to 18 mm at the ends, glides 32 mm dia x 10 mm, side brackets 60 wide x 580 long x 28 mm high, beam 60 x 30 mm flush under the top between the brackets on the column centre line, tray 700 x 120 x 90 mm at the back, keypad 150 x 60 x 24 mm under the front edge 185 mm from the end, grommets 60 mm dia at 200 mm from the ends and 70 mm from the back.',
      'Clearance near the ends: within endZoneClear (63.5 mm, set by the bottom-stage collar; column face 65, foot side 65, side bracket 70) of either end there is nothing at all but the top itself (no foot, glide, column or bracket, from the floor up), so an object reaching under an end by less than that needs H >= its height + T (ALEX 700 mm: H >= 720 mm plus a few mm margin; 725 if the top is really 25 mm). The underside bevel lifts the underside only within 30 mm of the edge (to -12 mm at the very edge), so take -T as the governing underside.',
      'Telescoping: feet, glides and the bottom stage are fixed; stages 2 and 3 each take half of the stroke (H - hMin); the side brackets, beam, tray and keypad move with the top.',
      'Keypad default "right" (x near 0, standing at the front) is the usual placement for this kind of frame; not confirmed from a photo.',
      'x = 0 is the right-hand end seen from the front (FORMAT: +x runs to the left). Everything except the keypad is symmetric.',
    ];
    const sources = [
      { title: 'Castlery AU, Emmerson Adjustable Standing Desk (walnut, 1.4 m)', url: 'https://www.castlery.com/au/products/emmerson-adjustable-standing-desk?wood=american_walnut&length=1_4m' },
      { title: 'Castlery AU, Emmerson (PLA page)', url: 'https://www.castlery.com/au/pla/emmerson-adjustable-standing-desk' },
      { title: 'Castlery US, Emmerson Adjustable Standing Desk', url: 'https://www.castlery.com/us/products/emmerson-adjustable-standing-desk' },
      { title: 'Castlery US, Emmerson (t50441117)', url: 'https://www.castlery.com/us/products/emmerson-adjustable-standing-desk-t50441117' },
      { title: 'Castlery UK, Emmerson Adjustable Standing Desk', url: 'https://www.castlery.com/uk/products/emmerson-adjustable-standing-desk' },
      { title: 'Castlery CA, Emmerson Adjustable Standing Desk', url: 'https://www.castlery.com/ca/products/emmerson-adjustable-standing-desk' },
      { title: 'Castlery SG, Emmerson Adjustable Standing Desk', url: 'https://www.castlery.com/sg/products/emmerson-adjustable-standing-desk' },
      { title: 'Castlery AU, Emmerson old (2-stage) version, 140 cm', url: 'https://www.castlery.com/au/products/emmerson-adjustable-standing-desk-old?length=1_4m&wood=oak' },
      { title: 'Castlery SG, Emmerson Sit-Stand Desk 140 cm walnut (older listing, image names)', url: 'https://www.castlery.com/sg/products/emmerson-sit-stand-desk?length=1_4m&wood=walnut' },
      { title: 'Emmerson Standing Desk assembly manual (2023-02-28)', url: 'https://res.cloudinary.com/castlery/image/upload/v1681184366/Emmerson_Standing_Desk_50220007_50220008_53800006_53800007_53800008__20230228.pdf' },
      { title: 'MeetFelix product listing (image-derived feature tags)', url: 'https://www.meetfelix.ai/products/castlery-emmerson-adjustable-standing-desk/dfd00c47-f063-4887-add1-13e9c5ae3478' },
      { title: 'Better Homes & Gardens AU, best standing desks', url: 'https://www.bhg.com.au/shopping/best-standing-desks/' },
      { title: 'AptDeco resale listing (Castlery adjustable oak standing desk)', url: 'https://www.aptdeco.com/product/castlery-adjustable-oak-standing-desk' },
    ];
    return { dims, materials, parts, notes, sources };
  }
  if (typeof module !== 'undefined') module.exports = build; else (root.Furniture = root.Furniture || {}).emmerson = build;
})(this);
