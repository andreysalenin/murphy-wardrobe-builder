# IKEA ALEX drawer unit, 36x70 cm: modelling study

Model: `alex.js`. Options:
- `color`: hex. The default is grey-turquoise, #6c9a9b.
- `colorName`: 'grey-turquoise', 'white', 'dark grey', 'black-brown', 'white stained oak effect' or 'black-blue'. It is used when `color` is not given.
- `open`: 0 to 1, pulls the top drawer out by up to 380 mm.

Extra overrides:
- `feet`: rubber foot height, default 8. The body stays 692, so the overall height is 692 + feet.
- `gripW` and `gripDepth`: size of the cut-out grip, default 100 x 22.

Renders:
- `alex-*.png`: the default, grey-turquoise and closed.
- `alex-open-iso.png`: `{"open":1}`.
- `alex-white-iso.png`: `{"colorName":"white"}`.

24 solids.

This models the version made since about 2021 (white 404.735.49 in AU; grey-turquoise 304.837.99). It has rubber feet and
pre-drilled holes for castors and tabletop fixing. The grey-turquoise finish only exists in this version.

## Dimensions (mm)

| Item | Value | Status |
|---|---|---|
| Width | 360 | published (36 cm; US 14 1/8 in = 359) |
| Depth | 580 | published (58 cm; US 22 7/8 in = 581) |
| Height, top surface above floor | 700 | published (70 cm; US 27 1/2 in = 699) |
| Body height (without feet) | 692 | measured by a third party (69.2 cm, "70 cm with feet") |
| Rubber feet | 8 high, dia 25, 24/30 from the edges | presence: owner reports (new version); size estimated from 700 - 692 |
| Top | 360 x 580 x 18, flush on all sides, no overhang, square edges | flush: images and descriptions ("smooth, square edges"); 18 estimated |
| Sides, bottom | 18 | estimate (see below) |
| Back | 16, finished, flush with the rear edges | "finished back" published; thickness estimated |
| Plinth | none: the bottom panel is at the base, on 4 small feet | estimate |
| Drawers | 5: two shallow over three deep | published (5 drawers; separate max load for the "small drawer") |
| Front heights, top to bottom | 101, 101, 147, 147, 147 | measured: 10 cm / 4.0 in and 15 cm / 5.8 in (Workspace Hero); 4 in and 5 3/4 in (If Only April) |
| Front width | 320 | measured (32 cm) |
| Fronts | inset, flush with the carcass front edge | estimate from 320 in 360 |
| Side gaps | 2 each side | derived: (360 - 2 x 18 - 320) / 2 |
| Vertical gaps | 6 x 2.17 | derived: opening 656 - fronts 643 = 13 |
| Visible frame | about 18 sides, 20 above the top drawer, 20 below the bottom one | derived |
| Front thickness | 16 | estimate (printed handles warn that screws over 14 mm come through the face) |
| Grip | U-shaped cut-out in the top edge, through the front, centred; 100 wide x 22 deep, 11 radius at the bottom corners; same on all 5 fronts | form: sources below; size estimated |
| Drawer inside | 292 W x 524 D; side walls 56 (small), 117 (deep) above the drawer bottom | measured; IKEA lists 52 cm inside depth |
| Drawer travel | 380 at open = 1 | estimate (partial-extension ball-bearing runners with stops) |
| Loads | 2 kg small drawer, 4 kg others, 12 kg total | published |
| Pack | 59 x 11 x 81/82 cm; 27.5 kg (white) | published |

### Why 18 mm sides
The fronts measure 320 in a 360 carcass, which leaves 40 mm for two sides and two gaps: 18 + 2 each side. A 16 mm
board would leave 4 mm side gaps, unusual for IKEA.

Adding up particleboard at about 650 kg/m3 for the panels, plus the drawer boxes and the runners, gives about 28 kg
with 18 mm panels. That matches the 27.5 kg pack weight. With panels around 12 mm the total would be about 22 kg.

### Vertical layout, z from the floor
| Part | z (mm) |
|---|---|
| Feet | 0 to 8 |
| Bottom panel | 8 to 26 |
| Drawer 5 | 28.2 to 175.2 |
| Drawer 4 | 177.3 to 324.3 |
| Drawer 3 | 326.5 to 473.5 |
| Drawer 2 | 475.7 to 576.7 |
| Drawer 1 | 578.8 to 679.8 |
| Top panel | 682 to 700 |

### Clearance for the desks
Nothing sticks out beyond the 360 x 580 footprint at any height, and the top is a plain flat slab with square edges. A
desk top that overlaps each side by 27 mm only needs its underside above 700.

The body height is the main uncertainty: one owner measured 692 without the feet. Measure the real unit from floor to top before setting the desk height.

## Grip (integrated handle)

What the sources say:
- IKEA's image text calls them "cut-out handles", "recessed handles", "sleek, curved handles" and "black handles". The cut-outs show dark in photos because you look into the shadowed drawer.
- SlashGear: "a built-in recessed dip at the top of each drawer".
- Clever Creations, makers of printed add-on handles: the handle drops into "the hole in the front of the drawers", and the cut-out is the same size on every ALEX drawer.
- Thangs: a printed handle made for 304.837.99 was traced from the drawer's curve.
- Printables: owners report the post-2021 cut-out differs from the older one.

So the grip is a dip cut down into the top edge of each front, through its full thickness, centred.

Its width, depth and curve are not published anywhere I could read. I modelled 100 x 22 mm with rounded bottom corners. That is about 31% of the front width, matching an ALEX-style parametric model whose rounded-bottom cut-out is about 30% of the drawer width.

A dark solid behind each cut-out stands in for the shadowed drawer interior.

## Colours

| Finish | Hex (estimate) | Article |
|---|---|---|
| grey-turquoise (US: gray-turquoise), default | #6c9a9b (range about #5f8d8e to #7fa7a7) | 304.837.99 |
| white | #f0efea | 404.735.49 (AU), 004.735.46 |
| dark grey | #4b4c4e | 105.888.96 (AU), 605.888.94 |
| black-brown | #2f2a26 | 604.735.48 |
| white stained oak effect (printed foil) | #d8cbb5 | 204.735.50 (AU), 804.735.47 |
| black-blue (limited) | #252b35 | 005.904.75 |

Other materials in the model:

| Material | Hex |
|---|---|
| Grip shadow | body colour x 0.22, plus a little grey |
| Cavity behind the gaps | body colour x 0.16 |
| Drawer box | body colour, slightly darker |
| Feet | #2a2a2a, black rubber |

The turquoise ALEX is IKEA's "grey-turquoise", a muted, greyed teal. It is the only turquoise ALEX in IKEA's listings, and it seems to be no longer sold in Australia or most other markets: the AU and GB URLs fall back to category pages.

Carcass and fronts have the same finish: particleboard with acrylic paint, paper foil and plastic edging.

IKEA states it does not publish colour codes, so every hex is an estimate.

## Confirmed and not confirmed

- **Confirmed (published or measured):**
  - W, D, H
  - 5 drawers, two of them small
  - front heights and width
  - drawer inside sizes
  - finished back, drawer stops, materials
  - the colour name and article number
  - the grip is a cut-out dip at the top of each front
  - rubber feet on the current version
- **Not confirmed:**
  - I could not look at any product photo from this session. WebFetch cannot read images (every image URL failed), the image search only shows pictures to the user, and the assembly PDF came through as text without its drawings.
  - So these come from text sources and from the derivations above:
    - panel thicknesses (18 / 16)
    - whether the top sits on the sides or between them
    - the 2.2 mm gaps
    - the grip's exact size and curve
    - the foot size
    - the grey-turquoise hex
  - The renders match IKEA's own text description of its photos: a plain flat-topped box with a thin frame, square edges, and dark cut-outs centred at the top of each front.
- **Most worth checking on the real unit:**
  - floor-to-top height: 700 or 692
  - the grip size
  - the colour, against a photo of the actual unit

## Sources

- IKEA AU, ALEX white 404.735.49: https://www.ikea.com/au/en/p/alex-drawer-unit-white-40473549/
- Assembly instructions AA-2242840-5: https://www.ikea.com/au/en/assembly_instructions/alex-drawer-unit-white__AA-2242840-5-100.pdf
- IKEA US, ALEX white 004.735.46 (inch sizes, image text): https://www.ikea.com/us/en/p/alex-drawer-unit-white-00473546
- IKEA US, ALEX on casters 36x76 ("black cut-out handles"): https://www.ikea.com/us/en/p/alex-drawer-unit-on-casters-white-black-s59422220/
- IKEA SE, ALEX hurts med lådor (inside depth 52 cm): https://www.ikea.com/se/sv/p/alex-hurts-med-lador-vit-00473546/
- IKEA Turkey, ALEX grey-turquoise 304.837.99: https://www.ikea.com.tr/en/p30483799 and https://www.ikea.com.tr/p30483799
- IKEA Islas Canarias, ALEX gray-turquoise 304.837.99: https://islas.ikea.es/elhierro/en/pd/alex-drawer-unit-gray-turquoise-art-30483799
- IKEA CA, ALEX series page ("cut-out handles"): https://www.ikea.com/ca/en/p/alex-drawer-unit-black-blue-00590475
- IKEA GB, colour codes not published: https://www.ikea.com/gb/en/customer-service/knowledge/articles/2f5e7bb5-7575-4fb1-g03g-880e71f13b1g.html
- The Workspace Hero, ALEX drawer dimensions: https://theworkspacehero.com/alex-drawer-dimensions/
- If Only April, ALEX drawer upgrade: https://ifonlyapril.com/alex-drawer-upgrade-ikea-hack/
- OzBargain thread (2021 version change, rubber feet): https://www.ozbargain.com.au/node/643079
- Clever Creations, ALEX handle and label system: https://clevercreations.org/ikea-alex-handle-label-system/
- SlashGear, 3D printed add-ons for IKEA: https://www.slashgear.com/2124353/3d-printed-add-ons-for-ikea-products
- Thangs, IKEA Alex Handle v1 2024 (304.837.99): https://thangs.com/designer/Alex-RandomNumbers/3d-model/IKEA%20Alex%20Handle%20v1%202024-1144979
- Printables, New IKEA ALEX handle (2023): https://printables.com/model/754081-new-ikea-alex-handle-2023
- MakerWorld, ALEX-style parametric drawers: https://makerworld.com/en/models/3478157
- IKEA Hackers, ALEX full-extension question (runners): https://ikeahackers.net/2019/11/alex-drawer-full-extension.html
- Lazada Home, ALEX comparison ("integrated cut-out pulls"): https://home.lazada.com.ph/ikea-alex-comparison-how-it-stacks-up-against-other-drawer-units-ph/
