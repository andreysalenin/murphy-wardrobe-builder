# Murphy Wardrobe Builder

**Live page: https://andreysalenin.github.io/murphy-wardrobe-builder/**

A one-page tool for designing a built-in plywood wardrobe around a Create-A-Bed vertical queen Murphy bed: a fold-down bed in the middle, a tower of drawers and hanging space either side, and lift-up flaps over a storage shelf above the bed. Change a size and the 3D model, the bed's swing clearances, the cut list and the sheet nesting update straight away. Then save:

- **Drawings**: an A3 PDF set of 9 sheets: overview, elevations and plans, sections with the bed's swing, the bed frame with the kit's numbers, hardware positions, cut list and hardware, cutting plans and a design review.
- **3D model**: a STEP (AP214) assembly for CAD, one solid per part, with the hardware and mattress if you want them, and the bed closed or at the slider's angle.
- **Cut list**: a CSV of every part, with the sheet each piece is nested on.

Everything runs in the browser and nothing is uploaded. The page is a single self-contained file (`index.html`), so it also works offline.

## What you can change

- **Cavity**: width, height and depth wall to wall, the fitting gaps at the sides and back, and how far the fronts sit back from the room wall.
- **Mattress and bed**: mattress size, the gaps round it (which set the frame size), the 12 mm gap between the closed bed and the shelf above it, and where the bed face panel and frame start off the floor.
- **Side towers**: number and heights of the drawers, drawer runners (drawn as their three nested members), the hanging space, an extra shelf in the top compartment, and whether the doors hinge on the wall side or the bed side.
- **Bought-in hardware**: drawer runners are Hettich KA 5632 (full extension, 45 kg, 46 x 12.7, 250 to 700 long) and hinges are Blum CLIP top BLUMOTION 110° full overlay (71B3550) on CLIP cruciform plates, both sold in Australia. The page picks the runner length that fits, and the hinge plate (0 or 3 mm) and boring distance for each overlay from Blum's table. It models both to the makers' dimensions and puts the runner holes and hinge positions on the drawings.
- **Fronts and plywood**: reveals, the header filler at the ceiling, and the thickness used for carcass, drawers, backs, deck, plinths, packers and the headboard.
- **Create-A-Bed hardware**: pivot, gas-spring and bed-stop positions, frame rails, legs and deck struts, each with the page of the Deluxe Queen Vertical plan it comes from, so they are easy to revise against your kit.
- **Around the bed**: a headboard ledge behind the pillows, and a backrest that leans back over the bed's swing with a bedside shelf on top.
- **Shelf over the bed**: a flat 18 mm shelf carried by the centre divider, with a 20 x 10 steel flat hidden in its front edge (2 mm proud underneath, behind the flaps), or a lip if you prefer one. The safety lock is a twin pin: two 10 mm pins on one bar either side of the divider, going into the bed's foot rail, lifted with one pull through either flap. An optional tab through the joint between the flaps lets you lift it without opening a flap. Two separate pins mid-bay, or no lock, are also options.
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

- `npm run check`: builds three designs in Node and checks cut sizes against the solids, part clashes, the nesting and the design checks.
- `node test/export.js [params.json]`: opens `index.html` in headless Chromium and saves the PDF, STEP, CSV and two screenshots to `out/` (set `CHROMIUM_PATH` to a Chromium or headless-shell binary).
- `python3 test/check_step.py out/default.step`: loads the STEP file with OpenCASCADE (needs Python with cadquery-ocp) and reports solids, validity, volume and bounds.

## The shelf over the bed

`study/` holds the plate model and scripts behind the shelf: why a lip isn't needed once the divider is glued and screwed, why the steel flat is there, which boxes fit in two or three bays, and where the lock can go. See `study/README.md`.

## Please note

The drawings are a starting point for building, not certified engineering. Check every Create-A-Bed position against the instructions that come with your kit, anchor the cabinet to the studs as the kit asks, and measure your cavity, ceiling and floor before cutting.
