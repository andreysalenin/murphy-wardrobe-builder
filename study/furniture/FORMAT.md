# Furniture module format

Each item is one file, `study/furniture/<name>.js`, a UMD-style module:

```js
(function (root) {
  function build(opt) {            // opt: item options (height, length, colour...), all optional
    return {
      dims: { ... },               // key sizes in mm (overall L/D/H, top thickness, height range, inset of legs...)
      materials: { name: '#rrggbb', ... },   // default colour per material name
      parts: [ ... ],              // solids, below
      notes: [ '...' ],            // modelling decisions and assumptions
      sources: [ { title, url } ],
    };
  }
  if (typeof module !== 'undefined') module.exports = build; else (root.Furniture = root.Furniture || {}).NAME = build;
})(this);
```

Local frame, millimetres: x along the item's width/length (0 at one end, its full length at the other), y depth with
y = 0 at the BACK (the face that goes against the wall) and y = D at the FRONT (the side you use), z up from the floor
it stands on (z = 0). Right-handed, so standing at the front looking at it, +x runs to your LEFT.

Parts (each `{ name, mat, ...shape }`, `mat` a key of `materials`, optional `color` to override):

- box:     `{ shape: 'box', min: [x0, y0, z0], max: [x1, y1, z1] }`
- cyl:     `{ shape: 'cyl', a: [x, y, z], b: [x, y, z], d }`            (round bar or tube from a to b, diameter d)
- extrude: `{ shape: 'extrude', axis: 'x' | 'y' | 'z', from, to, pts: [[p, q], ...] }`
           a polygon (either winding, no holes, not self-crossing) swept along the axis from `from` to `to`.
           axis 'z': pts are [x, y]; axis 'x': pts are [y, z]; axis 'y': pts are [x, z].
           Use it for rounded or chamfered profiles (approximate arcs with 4 to 8 segments per quarter).

Keep it to about 80 solids or fewer; small details that read at room scale only.

Preview: `node study/furniture/preview.js study/furniture/<name>.js <outPrefix> '<opt json>'` writes
`<outPrefix>-iso.png`, `-front.png`, `-side.png`, `-top.png`, `-below.png` (and prints dims).
