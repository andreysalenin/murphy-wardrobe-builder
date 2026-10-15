# Shelf over the bed: options study

The numbers behind the flat shelf, the hidden steel flat and the twin-pin lock. The shelf over the bed spans
1686 mm only 12 mm above the closed bed, so it has to stay stiff without a lip that gets in the way of boxes.

- `grillage.py`: a beam-grid (grillage) model of an orthotropic plate, checked against plate theory in its `__main__`
  (simply supported square plate and a plate strip, both within 1%).
- `cases.py`: every shelf build considered (lip, flat, steel flat, three bays, torsion boxes, an open bay hung from a
  steel beam), loaded with the shelf's weight, 40 and 100 kg per square metre in both bays or one, and a 300 N hand
  on the front edge. Long-term sag is the instant value x 1.8 (plywood creep indoors, EN 1995 k_def 0.8). The centre
  divider is a deep beam whose back is held by the shelf and top screwed to their wall rails. Writes `results.json`.
- `fit.py`: how many of each reference box or bag fits in each bay layout, checked in plan against the gas stays,
  flap hinge arms, wall rails and lock blocks. Writes `fit.json`.
- `maps.py`, `figures.py`, `export_bb.js`: the figures (sections, deflection maps, bay plans, lock positions and the
  twin-pin detail).

Main results (long-term, worst of both bays or one bay at 100 kg per square metre):

| Build | Sag, mm |
| --- | --- |
| Flat 18 mm shelf, divider glued and screwed, 20 x 10 steel flat in the front edge (the design) | 1.4 |
| Same without the steel flat | 3.0 |
| 36 mm lip, divider glued and screwed | 1.1 |
| Three bays, two dividers | 0.6 |
| Open bay, 42 mm torsion box with a steel front rib | 4.0 |
| Divider only standing on the shelf, no lip | 46 |

To run it (Python 3 with numpy, scipy and matplotlib; Node for the part export):

```
cd study
node export_bb.js '{"upstand":36,"edgeSteel":false,"lockType":"pins"}' parts.json
node export_bb.js '{"gapAbove":38,"lockType":"none"}' parts_A.json
python3 grillage.py      # solver check
python3 cases.py         # all builds, about 30 s
python3 fit.py
python3 maps.py
python3 figures.py
```
