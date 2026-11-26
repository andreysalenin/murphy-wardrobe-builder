# Castlery Emmerson Adjustable Standing Desk: modelling study

Model: `emmerson.js`. Options: `height` (top surface, 600 to 1250, default 600), `length` (1200 or 1400, default 1400),
`wood` ('walnut' default, 'oak'), `keypad` ('right' default, 'left'). Extra overrides: `thickness`, `legToLeg`, `tray`.
Renders: `emmerson-*.png` (minimum height, 600) and `emmerson-740-*.png` (740 mm).

This models the current version: 3-stage lifting columns, electric, 4 memory presets, 125 kg load (assembly manual
dated 2023-02-28, and review variant names such as "120cm with 3-stage Leg, Walnut"). The older 2-stage version
(H 70 to 120 cm, 100 kg) is not modelled.

## Dimensions

| Item | Value | Status |
|---|---|---|
| Length options | 1200, 1400 (no 1600) | published |
| Depth | 700 | published |
| Height, top surface | 600 to 1250 | published (60 to 125 cm, in both the spec block and the manual) |
| Leg height (floor to underside of top) | 580 to 1230 | published (AU 58 to 123 cm; US 22.8 to 48.4 in) |
| Top thickness T | 20 | inferred: overall height minus leg height. 25 is possible (both ranges rounded); the 4.2 x 19 top screws and the 47 kg weight fit either |
| Leg-to-leg clear width | 930 at L 1200 | published ("at height 45 cm") |
| Leg-to-leg at L 1400 | 1130 | assumed: same end inset as the 120 cm desk. The 140 cm spec block is not served |
| Edge | 12 visible, underside bevel 8 high x 30 wide, all four sides | "bevelled edges" (BHG), "slim profile" and "curved front edge" (image tags); sizes estimated |
| Plan corners | r 8 | estimate |
| Levellers | 10 high, 32 dia, adjust up to 10 | adjustment published (max 1 cm); size estimated |
| Feet | 680 long x 70 wide, 34 high at the column tapering to 18 at the ends, centred in depth | estimate (T-frame) |
| Column stages (x by y) | 70x80 bottom, 63x73, 56x66, largest at the bottom | estimate |
| Side brackets | 60 wide x 580 long x 28 high, y 60 to 640 | estimate (manual lists 2 side brackets) |
| Supporting beam | 60 x 30, flush under the top, on the column centre line, between the brackets | estimate (manual lists 1 beam) |
| Cable tray | 700 x 120 x 90, at the back, centred | estimate (listed in the manual, but a 2026 review suggests it no longer ships) |
| Keypad | 150 x 60 x 24 under the front edge, 185 from the right end | estimate (4 memory keys + display, per the manual) |
| Cable holes | 2, grommets 60 dia, 200 from the ends, 70 from the back | count published; position estimated |
| Weight | 47 kg (120 cm) | published |

## Frame layout under the top, near the ends

The desk is symmetric except for the keypad. Distances in x are from each end of the top (L 1400; the same at 1200).
The z values are relative to the top surface at T 20.

- **Top:** underside at -20, rising to -12 only within 30 mm of the edge because of the bevel. Use -20 for clearance.
- **0 to 63.5 mm from each end:** nothing below the top, at any height, from the floor up. This is the strip an ALEX can run into.
- **63.5:** plastic guide collar at the top of the bottom column stage.
- **65:** outer face of the bottom column stage, and side face of the foot. The foot runs y 10 to 690 at floor level, z 10 to 44 above the floor.
- **70:** side bracket (the top-mounting arm), running front to back at y 60 to 640, z -48 to -20. This is the nearest frame member under the top (armInset).
- **72:** face of the top column stage.
- **130:** start of the beam, running x 130 to L-130 at y 320 to 380, z -50 to -20.
- **185:** keypad (right end by default), z -44 to -20. Tray at x 350 to 1050 (L 1400), z -110 to -20.

For the ALEX layout, it overlaps each top end by about 27 mm, well inside the clear 63.5 mm strip. Only the top
itself has to clear it: the top surface must be at or above 700 + T, i.e. 720 mm plus a few mm of margin (725 if the
top is 25 mm). No foot, column or bracket interferes, provided the true insets are not under about 30 mm, which is very
unlikely for this kind of frame.

## Colours (defaults)

| Material | Colour |
|---|---|
| American walnut, clear lacquer | #6b4a33 |
| American oak, clear lacquer | #c9a77a |
| Frame, black powder coat | #232323 |
| Glides and collars | #121212 |
| Keypad | #1a1a1a |
| Tray | #262626 |
| Grommets | #151515 |

The frame is black for both woods. There is no frame-colour option, and the image-derived tags for the current SKU
say "black metal T-frame".

## Confirmed and not confirmed

- **Confirmed (published):**
  - length options, depth, height range and leg height (which gives T)
  - leg-to-leg distance at 120 cm, load, levellers and weight
  - wood options
  - parts list: 2 feet, 2 columns, 1 beam, 2 side brackets, tray, hand switch, no separate control box
  - 3-stage columns, memory keypad
- **Not confirmed:**
  - Product photos could not be inspected from this session. WebFetch cannot read images, the image search only shows pictures to the user, and the browser extension was not connected.
  - So these are typical-frame estimates: every frame cross-section, the foot shape, bracket and beam sizes and positions, the column orientation, which side the keypad is on, the bevel size and corner radius, and the grommet positions.
  - The 140 cm leg-to-leg distance is not published.
  - T could be 25 rather than 20.
  - Whether the current shipment includes the cable tray is unclear.
- **Most worth checking against a photo or the real desk:**
  - the column-to-end distance at 140 cm (expected about 65; measure it)
  - the top thickness
  - the keypad side

## Sources

- Castlery AU (walnut, 1.4 m): https://www.castlery.com/au/products/emmerson-adjustable-standing-desk?wood=american_walnut&length=1_4m
- Castlery AU PLA page: https://www.castlery.com/au/pla/emmerson-adjustable-standing-desk
- Castlery US: https://www.castlery.com/us/products/emmerson-adjustable-standing-desk and https://www.castlery.com/us/products/emmerson-adjustable-standing-desk-t50441117
- Castlery UK: https://www.castlery.com/uk/products/emmerson-adjustable-standing-desk
- Castlery CA: https://www.castlery.com/ca/products/emmerson-adjustable-standing-desk
- Castlery SG: https://www.castlery.com/sg/products/emmerson-adjustable-standing-desk
- Old 2-stage version (140 cm: H 70 to 120, leg-to-leg 111): https://www.castlery.com/au/products/emmerson-adjustable-standing-desk-old?length=1_4m&wood=oak
- Older SG listing, 140 cm walnut (image names only): https://www.castlery.com/sg/products/emmerson-sit-stand-desk?length=1_4m&wood=walnut
- Assembly manual (2023-02-28): https://res.cloudinary.com/castlery/image/upload/v1681184366/Emmerson_Standing_Desk_50220007_50220008_53800006_53800007_53800008__20230228.pdf
- MeetFelix listing (image-derived tags): https://www.meetfelix.ai/products/castlery-emmerson-adjustable-standing-desk/dfd00c47-f063-4887-add1-13e9c5ae3478
- Better Homes & Gardens AU: https://www.bhg.com.au/shopping/best-standing-desks/
- AptDeco resale listing: https://www.aptdeco.com/product/castlery-adjustable-oak-standing-desk
