// IKEA ALEX drawer unit, 36x70 cm (5 drawers: 2 shallow over 3 deep). Study model, see alex.md.
// Options: color (hex, default grey-turquoise), colorName, open (0..1 pulls the top drawer out),
// feet (rubber foot height, mm, default 8: the body is 692 tall so the top stays at IKEA's 700),
// gripW / gripDepth (the cut-out grip at the top edge of every front, mm).
(function (root) {
  // IKEA ALEX finishes. IKEA does not publish colour codes: every hex here is an estimate from product photos.
  var COLORS = {
    'grey-turquoise': '#6c9a9b',            // 304.837.99, sold about 2021-2024, now discontinued in most markets
    'white': '#f0efea',                     // 404.735.49 (AU) / 004.735.46
    'dark grey': '#4b4c4e',                 // 105.888.96 (AU) / 605.888.94
    'black-brown': '#2f2a26',               // 604.735.48
    'white stained oak effect': '#d8cbb5',  // 204.735.50 (AU) / 804.735.47, printed paper foil
    'black-blue': '#252b35',                // 005.904.75, limited edition
  };

  function hex2rgb(h) { h = String(h).replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&'); var n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function rgb2hex(c) { return '#' + c.map(function (v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); }).join(''); }
  function shade(h, k, add) { return rgb2hex(hex2rgb(h).map(function (v) { return v * k + (add || 0); })); }

  function build(opt) {
    opt = opt || {};
    var name = opt.colorName ? String(opt.colorName).toLowerCase().replace(/[\s_]+/g, ' ').replace('gray', 'grey') : null;
    if (name === 'turquoise' || name === 'grey turquoise') name = 'grey-turquoise';
    var color = opt.color || (name && COLORS[name]) || COLORS['grey-turquoise'];
    var colorName = opt.colorName || (opt.color ? 'custom' : 'grey-turquoise');
    var open = Math.max(0, Math.min(1, +opt.open || 0));

    // ---- key sizes (mm). P = published by IKEA, M = measured by a third party, E = estimated (see notes)
    var W = 360, D = 580;                                   // P: 36 x 58 cm
    var feetH = opt.feet != null ? Math.max(0, +opt.feet) : 8; // E: 700 (P) minus 692 (M body height)
    var bodyH = 692;                                        // M: 69.2 cm measured without feet
    var H = feetH + bodyH;                                  // 700 = P overall height, top surface above floor
    var sideT = 18, topT = 18, botT = 18;                   // E: from 32 cm fronts in a 36 cm carcass, and pack weight
    var backT = 16;                                         // E: finished particleboard back
    var frontT = 16;                                        // E: grip screws over 14 mm would break through the front
    var frontW = 320;                                       // M: 32 cm
    var sideGap = (W - 2 * sideT - frontW) / 2;             // 2 mm
    var smallH = 101, medH = 147;                           // M: 10 cm / 4.0 in and 15 cm / 5.8 in (5 3/4 in)
    var heights = [smallH, smallH, medH, medH, medH];       // top to bottom
    var z0 = feetH + botT, z1 = H - topT;                   // drawer opening
    var nGaps = heights.length + 1;
    var gap = (z1 - z0 - heights.reduce(function (a, b) { return a + b; }, 0)) / nGaps; // about 2.2 mm
    var gripW = opt.gripW || 100, gripDepth = opt.gripDepth || 22, gripR = Math.min(gripDepth, gripW / 2) / 2; // E
    var travel = 380;                                       // E: partial-extension runners with stops
    var xL = sideT + sideGap, xR = W - sideT - sideGap, xc = W / 2;

    var mats = {
      body: color,                       // carcass: sides, top, bottom, back (same painted finish as the fronts)
      front: color,                      // drawer fronts: same finish as the carcass on the real unit
      drawer: shade(color, 0.92, 6),     // drawer box (foil) seen when the top drawer is pulled out
      grip: shade(color, 0.22, 14),      // dark interior seen through each cut-out grip (stands in for shadow)
      void: shade(color, 0.16, 10),      // dark cavity behind the fronts, read through the gaps
      feet: '#2a2a2a',                   // black rubber feet
    };

    var parts = [];
    function box(n, mat, a, b) { parts.push({ name: n, mat: mat, shape: 'box', min: a, max: b }); }

    // ---- carcass
    box('side right', 'body', [0, 0, feetH], [sideT, D, H - topT]);           // x = 0 end is the right side seen from the front
    box('side left', 'body', [W - sideT, 0, feetH], [W, D, H - topT]);
    box('top', 'body', [0, 0, H - topT], [W, D, H]);                          // flush top, no overhang, sits on the sides
    box('bottom', 'body', [sideT, backT, feetH], [W - sideT, D, feetH + botT]);
    box('back', 'body', [sideT, 0, feetH], [W - sideT, backT, H - topT]);      // finished back, flush with the rear edges
    box('cavity shadow', 'void', [sideT, backT, z0], [W - sideT, backT + 2, z1]);

    // ---- rubber feet under the bottom/sides, near the corners
    if (feetH > 0) {
      [[24, 30], [W - 24, 30], [24, D - 30], [W - 24, D - 30]].forEach(function (p, i) {
        parts.push({ name: 'foot ' + (i + 1), mat: 'feet', shape: 'cyl', a: [p[0], p[1], 0], b: [p[0], p[1], feetH], d: 25 });
      });
    }

    // ---- drawer front outline in (x, z): rectangle with a U-shaped cut-out grip at the top centre
    function frontPts(zb, zt) {
      var pts = [[xL, zb], [xR, zb], [xR, zt], [xc + gripW / 2, zt]];
      var xr = xc + gripW / 2 - gripR, xl = xc - gripW / 2 + gripR, zc = zt - gripDepth + gripR, i, a, N = 6;
      pts.push([xc + gripW / 2, zc]);
      for (i = 1; i <= N; i++) { a = -Math.PI / 2 * i / N; pts.push([xr + gripR * Math.cos(a), zc + gripR * Math.sin(a)]); }
      for (i = 0; i <= N; i++) { a = -Math.PI / 2 - Math.PI / 2 * i / N; pts.push([xl + gripR * Math.cos(a), zc + gripR * Math.sin(a)]); }
      pts.push([xc - gripW / 2, zt], [xL, zt]);
      return pts.map(function (p) { return [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100]; });
    }

    var fronts = [], z = z1;
    heights.forEach(function (h, i) {
      z -= gap;
      var zt = z, zb = z - h; z = zb;
      fronts.push({ index: i + 1, zBottom: +zb.toFixed(1), zTop: +zt.toFixed(1), height: h });
      var dy = i === 0 ? open * travel : 0;
      parts.push({ name: 'drawer front ' + (i + 1), mat: 'front', shape: 'extrude', axis: 'y', from: D - frontT + dy, to: D + dy, pts: frontPts(zb, zt) });
      if (i === 0) {
        // top drawer box (always built so it can slide out): inside 292 wide x 524 deep, 56 mm side walls
        var yb = backT + 12, sw = 12, zBot = zb + 13, zSide = zBot + 56;
        box('top drawer side right', 'drawer', [xc - 146 - sw, yb + dy, zb + 4], [xc - 146, D - frontT + dy, zSide]);
        box('top drawer side left', 'drawer', [xc + 146, yb + dy, zb + 4], [xc + 146 + sw, D - frontT + dy, zSide]);
        box('top drawer back', 'drawer', [xc - 146, yb + dy, zb + 4], [xc + 146, yb + sw + dy, zSide]);
        box('top drawer bottom', 'drawer', [xc - 146, yb + sw + dy, zBot - 3], [xc + 146, D - frontT + dy, zBot]);
      }
      if (i > 0 || open === 0) {
        box('grip shadow ' + (i + 1), 'grip', [xc - gripW / 2 - 3, D - frontT - 40 + dy, zt - gripDepth - 3], [xc + gripW / 2 + 3, D - frontT - 0.5 + dy, zt - 0.5]);
      }
    });

    return {
      dims: {
        W: W, D: D, H: H, bodyH: bodyH, feetH: feetH, topZ: H,
        topT: topT, topOverhang: 0, sideT: sideT, bottomT: botT, backT: backT,
        frontT: frontT, frontW: frontW, frontInset: 0, sideGap: sideGap,
        drawerCount: heights.length, frontHeights: heights, frontsTopToBottom: fronts,
        gap: +gap.toFixed(2), frameTop: topT, frameBottom: botT,
        grip: { shape: 'U-shaped cut-out in the top edge, through the front, centred', w: gripW, depth: gripDepth, r: gripR },
        drawerInside: { w: 292, d: 524, sideWallSmall: 56, sideWallLarge: 117 },
        drawerTravel: travel, openTravel: +(open * travel).toFixed(1),
        color: color, colorName: colorName,
      },
      materials: mats,
      parts: parts,
      notes: [
        'Overall 360 W x 580 D x 700 H mm are IKEA published figures (US page: 14 1/8 x 22 7/8 x 27 1/2 in = 35.9 x 58.1 x 69.9 cm). The top surface is at 700 mm.',
        'Body 692 mm tall (theworkspacehero.com measured 69.2 cm; IKEA 70 cm "with feet"). Units made since about 2021 stand on rubber feet (OzBargain owners: new version has rubber feet and pre-drilled holes for castors and desk tops), so feet are modelled 8 mm tall, Ø25 mm, near the corners. opt.feet changes this; the split body/feet is an estimate, the 700 total is published.',
        'Five drawers: two shallow over three deep. Front heights 101 / 101 / 147 / 147 / 147 mm top to bottom (measured: 10 cm = 4.0 in and 15 cm = 5.8 in by theworkspacehero.com; 4 in and 5 3/4 in by ifonlyapril.com). IKEA lists max load 2 kg for a small drawer and 4 kg for the others.',
        'Fronts 320 mm wide (measured), inset flush in the carcass. 360 - 320 = 40 mm leaves 18 mm sides plus 2 mm side gaps; the 18 mm board is an estimate that also matches the 27.5 kg pack weight. Top and bottom panels taken as the same 18 mm, so the front reads as a frame about 18-20 mm wide on all four sides.',
        'Vertical gaps: the opening between bottom and top panels (656 mm) minus the five fronts (643 mm) leaves 13 mm, shared as six equal gaps of about 2.2 mm (above the top drawer, between drawers, above the bottom panel). Estimated.',
        'No plinth or recessed base: the bottom panel is at the base and the unit stands on its four small feet (estimated from the castor version, which screws castors into the base, and from the absence of any plinth in IKEA images descriptions).',
        'Top: flush with the sides, front and back (no overhang), assumed to sit on the sides (full 360 x 580). Thickness 18 mm estimated. Square edges ("smooth, square edges" per IKEA image text); the slight edge radius of the plastic edging is not modelled.',
        'Grip: every front has an integrated cut-out handle, a dip cut down into the top edge, through the front (IKEA image text: "cut-out handles", "recessed handles"; slashgear: "built-in recessed dip at the top of each drawer"; clevercreations: printed handles drop into the "hole in the front of the drawers", same size on every drawer). Its exact size is not published: modelled 100 mm wide x 22 mm deep, U-shaped with 11 mm bottom radii, centred (estimate; a parametric ALEX-style model uses a rounded-bottom notch about 30% of the front width and 20% of the drawer height). Post-2021 units (incl. 304.837.99) have a slightly different curve from older ones.',
        'Behind each cut-out a dark solid stands in for the shadowed drawer interior (photos show the cut-outs as black; IKEA image text even calls them "black handles"). A dark panel inside the back does the same for the gaps between fronts.',
        'Front thickness 16 mm (estimate: printed handles screw into the back of the front and warn that screws over 14 mm break through the face). Back 16 mm particleboard, finished (IKEA: "the back is finished"), flush with the rear edges (estimate).',
        'Drawer box (top drawer only, to show when opened): inside 292 W x 524 D (measured 29.2 x 52.4 cm; IKEA lists 52 cm inside depth), side walls 56 mm above the drawer bottom (measured), 12 mm sides. Deep drawers: 117 mm side walls (not modelled). Runners: ball-bearing, partial extension with stops; travel 380 mm at open = 1 is an estimate.',
        'Colour: IKEA calls it grey-turquoise (US: gray-turquoise), article 304.837.99, a muted, greyed teal. IKEA does not publish colour codes; #6c9a9b is an estimate from product photos (plausible range about #5f8d8e to #7fa7a7). The fronts and carcass have the same finish (particleboard, acrylic paint, paper foil, plastic edging).',
        'Other ALEX hexes (estimates): white #f0efea, dark grey #4b4c4e, black-brown #2f2a26, white stained oak effect #d8cbb5, black-blue #252b35. Pass opt.colorName with one of these names, or opt.color as a hex.',
        'Not modelled: pre-drilled holes for castors and tabletop fixing, drawer runners, the four lower drawer boxes (hidden), edge radii.',
        'Frame: x = 0 is the unit\'s right-hand side seen from the front; y = 0 is the back (wall side), y = 580 the drawer faces.',
      ],
      sources: [
        { title: 'IKEA AU: ALEX drawer unit, white, 36x70 cm (404.735.49): measurements, materials, assembly PDF link', url: 'https://www.ikea.com/au/en/p/alex-drawer-unit-white-40473549/' },
        { title: 'IKEA assembly instructions AA-2242840-5 (text only; drawings not readable here)', url: 'https://www.ikea.com/au/en/assembly_instructions/alex-drawer-unit-white__AA-2242840-5-100.pdf' },
        { title: 'IKEA US: ALEX drawer unit, white (004.735.46): inch measurements, image text "cut-out handles"', url: 'https://www.ikea.com/us/en/p/alex-drawer-unit-white-00473546' },
        { title: 'IKEA US: ALEX drawer unit on casters, white/black (36x76 cm): "black cut-out handles"', url: 'https://www.ikea.com/us/en/p/alex-drawer-unit-on-casters-white-black-s59422220/' },
        { title: 'IKEA SE: ALEX hurts med lådor (inside depth 52 cm, "infällda handtag" in a review)', url: 'https://www.ikea.com/se/sv/p/alex-hurts-med-lador-vit-00473546/' },
        { title: 'IKEA Turkey: ALEX, grey-turquoise, 36x70 cm (304.837.99)', url: 'https://www.ikea.com.tr/en/p30483799' },
        { title: 'IKEA Turkey (Turkish): ALEX keson, gri-turkuaz (materials, features)', url: 'https://www.ikea.com.tr/p30483799' },
        { title: 'IKEA Islas Canarias: ALEX drawer unit gray-turquoise 304.837.99 (dims, materials, features)', url: 'https://islas.ikea.es/elhierro/en/pd/alex-drawer-unit-gray-turquoise-art-30483799' },
        { title: 'IKEA CA: ALEX series (image text "cut-out handles")', url: 'https://www.ikea.com/ca/en/p/alex-drawer-unit-black-blue-00590475' },
        { title: 'The Workspace Hero: ALEX drawer dimensions and interior measurements', url: 'https://theworkspacehero.com/alex-drawer-dimensions/' },
        { title: 'If Only April: ALEX drawer upgrade (front heights 4 in and 5 3/4 in)', url: 'https://ifonlyapril.com/alex-drawer-upgrade-ikea-hack/' },
        { title: 'OzBargain: ALEX deal thread (new version: rubber feet, castor holes, 2021 change)', url: 'https://www.ozbargain.com.au/node/643079' },
        { title: 'Clever Creations: ALEX handle and label system (cut-out same on all drawers, 14 mm screw limit)', url: 'https://clevercreations.org/ikea-alex-handle-label-system/' },
        { title: 'SlashGear: 3D printed add-ons for IKEA (ALEX "recessed dip at the top of each drawer")', url: 'https://www.slashgear.com/2124353/3d-printed-add-ons-for-ikea-products' },
        { title: 'Thangs: IKEA Alex handle v1 2024, traced from a 304.837.99 drawer curve', url: 'https://thangs.com/designer/Alex-RandomNumbers/3d-model/IKEA%20Alex%20Handle%20v1%202024-1144979' },
        { title: 'Printables: New IKEA ALEX handle (2023), new cut-out differs from older units', url: 'https://printables.com/model/754081-new-ikea-alex-handle-2023' },
        { title: 'MakerWorld: ALEX-style parametric drawers (rounded-bottom finger cut-out proportions)', url: 'https://makerworld.com/en/models/3478157' },
        { title: 'IKEA Hackers: ALEX full extension question (ball-bearing runners with stops)', url: 'https://ikeahackers.net/2019/11/alex-drawer-full-extension.html' },
        { title: 'Home Lazada: IKEA ALEX comparison ("integrated cut-out pulls", shallow over deep drawers)', url: 'https://home.lazada.com.ph/ikea-alex-comparison-how-it-stacks-up-against-other-drawer-units-ph/' },
        { title: 'IKEA GB: colour codes are not published', url: 'https://www.ikea.com/gb/en/customer-service/knowledge/articles/2f5e7bb5-7575-4fb1-g03g-880e71f13b1g.html' },
      ],
    };
  }
  build.COLORS = COLORS;
  if (typeof module !== 'undefined') module.exports = build; else (root.Furniture = root.Furniture || {}).alex = build;
})(this);
