# Murphy Wardrobe Builder

**Live page: https://andreysalenin.github.io/murphy-wardrobe-builder/**

A one-page tool for designing a built-in plywood wardrobe around a Create-A-Bed vertical queen Murphy bed: a fold-down bed in the middle, a tower of drawers and hanging space either side, and lift-up flaps over a storage shelf above the bed. Change a size and the 3D model, the bed's swing clearances, the cut list and the sheet nesting update straight away. Then save:

- **Drawings**: an A3 PDF set of 18 sheets: overview, elevations and plans, sections with the bed's swing, the bed frame with the kit's numbers, hardware positions, cut list and hardware, cutting plans, a build sequence (a day-by-day timeline and 19 steps, each with a picture and its fixings), assembly details, a fixings schedule (screws, dowels, drill sizes, glue, wall fixings, parts by step) and a design review. Everything is vector, the 3D views included: they are drawn as shaded faces in exact depth order, so they stay sharp at any zoom and print cleanly.
- **Assembly details**: a half page for every step that joins plywood. Each operation is an exploded view at one scale, with the part going on pulled back along its joint, each screw floating off its head side, and a dashed line from its tip through the clearance hole to where it lands. Dowels and Dominos float in the gap. Tags name the fixings (A is an 8g x 50, DW an 8 x 30 dowel, and so on), and numbered, coloured circles give the driving order where it matters: the front screw of a carcass joint first, a back's four corners first, the steel flat from the middle out. Close-ups at 1:5 or larger show a typical joint. Dimensions are drawn on the views themselves: a chain along each line of holes from the edge of the part the fixing goes through, centre to centre, with equal gaps written once (50 · 6 × 77.5 · 50), and a chain across the face that places each line from the edges. Screws are spaced on whole-millimetre pitches so the chains stay short, and lines that repeat are dimensioned once. The first half page draws every fixing full size as a key. The hole positions come from one joinery model, which the tests check for each fixing: inside the parts it joins, clear of their faces, room to drive it, and no clashes with another fixing.
- **3D model**: a STEP (AP214) assembly for CAD, one solid per part, with the hardware and mattress if you want them, and the bed closed or at the slider's angle.
- **Cut list**: a CSV of every part, with the sheet each piece is nested on.

Everything runs in the browser and nothing is uploaded. The page is a single self-contained file (`index.html`), so it also works offline.

## What you can change

- **Cavity**: width, height and depth wall to wall, the fitting gaps at the sides and back, and how far the fronts sit back from the room wall.
- **Mattress and bed**: mattress size, the gaps round it (which set the frame size), the 12 mm gap between the closed bed and the shelf above it, and where the bed face panel and frame start off the floor.
- **Side towers**: number and heights of the drawers, drawer runners (drawn as their three nested members), the hanging space, an extra shelf in the top compartment, and whether the doors hinge on the wall side or the bed side.
- **Bought-in hardware**: drawer runners are Hettich KA 5632 (full extension, 45 kg, 46 x 12.7, 250 to 700 long) and hinges are Blum CLIP top BLUMOTION 110° full overlay (71B3550) on CLIP cruciform plates, both sold in Australia. The page picks the runner length that fits, and the hinge plate (0 or 3 mm) and boring distance for each overlay from Blum's table. It models both to the makers' dimensions and puts the runner holes and hinge positions on the drawings.
- **Bed gap**: the bed-cabinet sides stand 11 mm (7/16 in) off the bed frame's side rails, the gap the Create-A-Bed hardware is built for, so the kit's cabinet plates screw straight on. A wider gap (your original drawing had 30 mm) is still an option, with packers under the plates to bring them back to the kit's spacing; at 11 mm each tower is 19 mm wider inside.
- **Kick board and header**: each is one plank right across. The kick board is as tall as clears the bed's face panel as it swings down, so the drawers and tower plinths drop to sit on it and the hanging space gets the difference. The planks run as long as your longest sheet allows.
- **Fronts and plywood**: reveals, the header filler at the ceiling, and the thickness used for carcass, drawers, backs, deck, plinths, packers and the headboard.
- **Create-A-Bed hardware**: pivot, gas-spring and bed-stop positions, frame rails, legs and deck struts, each with the page of the Deluxe Queen Vertical plan it comes from, so they are easy to revise against your kit.
- **Around the bed**: a headboard ledge behind the pillows, and a backrest that leans back over the bed's swing with a bedside shelf on top.
- **Shelf over the bed**: a box of the shelf, two upper bed-cabinet sides (so the doubled 2 x 18 mm sides run the full height, broken only where the shelf passes through), the top and a 6 mm back that ties it together, built on the floor and slid in. The shelf is flat 18 mm, carried by the centre divider, with a 20 x 10 steel flat hidden in its front edge (2 mm proud underneath, behind the flaps), or a lip if you prefer one. The safety lock is a twin pin: two 10 mm pins on one bar either side of the divider, going into the bed's foot rail, lifted with one pull through either flap. An optional tab through the joint between the flaps lets you lift it without opening a flap. Two separate pins mid-bay, or no lock, are also options.
- **Sheets and cutting**: the sheets you have in each thickness, kerf, edge trim and grain direction. Parts are nested onto them with straight, track-saw cuts.
- **3D view**: click any door, drawer or flap to open or close just that one (click the bed to swing it down or back up). "Open fronts" opens or shuts them all, and shows a grey dash when only some are open. Also fronts on or off, a cut through the bed, mattress, hardware, colour by sheet thickness, and a slider (or play button) that swings the bed down with the gas springs, flap stays and lock moving.

The page checks the design as you go: the bed's swing against the floor, the shelf and flaps, the headboard and the kick board; the shelf's sag; the legs against the kit's pivot height; and whether the parts fit on your sheets. Settings are remembered in the browser.

## Building

`index.html` is generated from the sources:

```
npm install
npm run build      # writes index.html
```

- `src/page.html`: markup and styles
- `src/core.js`: parameters, geometry, swing clearances, checks, cut list, nesting, STEP writer (also runs in Node)
- `src/viewer.js`: three.js viewer and the renders used in the drawings
- `src/drawings.js`: the A3 drawing set (jsPDF)
- `src/app.js`: page wiring

three.js r128 and jsPDF 2.5.1 (both MIT licensed) are inlined by `build.js`.

## Tests

- `npm run check`: builds three designs in Node and checks cut sizes against the solids, part clashes, the nesting and the design checks, then every screw, dowel and Domino in the joinery model.
- `node test/export.js [params.json]`: opens `index.html` in headless Chromium and saves the PDF, STEP, CSV and two screenshots to `out/` (set `CHROMIUM_PATH` to a Chromium or headless-shell binary).
- `python3 test/check_step.py out/default.step`: loads the STEP file with OpenCASCADE (needs Python with cadquery-ocp) and reports solids, validity, volume and bounds.

## The shelf over the bed

`study/` holds the plate model and scripts behind the shelf: why a lip isn't needed once the divider is glued and screwed, why the steel flat is there, which boxes fit in two or three bays, and where the lock can go. See `study/README.md`.

## Please note

The drawings are a starting point for building, not certified engineering. Check every Create-A-Bed position against the instructions that come with your kit, anchor the cabinet to the studs as the kit asks, and measure your cavity, ceiling and floor before cutting.
