"""How many of each reference item fit in each antresol layout (one item type at a time).

Plan coordinates: x across (0 = centre line), y from the back of the shelf (16) to its front edge (581);
heights z measured up from the shelf top. Obstacles are boxes; the gas stays are sloping rods near each panel face.
"""
import itertools

Y_BACK, Y_FRONT = 16.0, 581.0
STAY_FIX = (331.0, 50.0)      # stay fixed end (y, z above the shelf)
STAY_FLAP = (572.0, 174.0)    # flap end, flap closed
STAY_OFF = (4.5, 19.5)        # rod band from the panel face (12 in, dia 15)

ITEMS = [
    # name, L, W, H (mm), source key
    ('IKEA SKUBB storage case', 690, 550, 190, 'skubb'),
    ('IKEA SAMLA 45 l box with lid', 570, 390, 280, 'samla'),
    ('Really Useful Box 35 l', 480, 390, 310, 'rub'),
    ('Large suitcase (about)', 750, 500, 300, None),
    ('Cabin bag (about)', 550, 400, 230, None),
    ('Euro crate 600 x 400', 600, 400, 270, None),
]


def layout(name, clear, lip, bays, pins, wall_rail=90.0, hinge_x=()):
    """bays: list of (x0, x1) clear between panel faces. pins: list of obstacle boxes (x0,x1,y0,y1,h)."""
    return dict(name=name, clear=clear, lip=lip, bays=bays, pins=pins, wall_rail=wall_rail, hinge_x=hinge_x)


def stay_z_at(y):
    (y0, z0), (y1, z1) = STAY_FIX, STAY_FLAP
    if y < y0:
        return None
    return z0 + (min(y, y1) - y0) * (z1 - z0) / (y1 - y0)


def collides(L, item_box):
    x0, x1, y0, y1, h = item_box
    if y0 < Y_BACK - 1e-6 or y1 > Y_FRONT + 1e-6:
        return True
    if h > L['clear']:
        return True
    # lip: items cannot sit over the front strip
    if L['lip'] and y1 > Y_FRONT - 18 + 1e-6:
        return True
    # wall rail under the top, at the back
    if y0 < 34 and h > L['clear'] - L['wall_rail']:
        return True
    # flap hinge arms: 17 down from the top, front 50 mm
    for hx in L['hinge_x']:
        if x0 < hx + 12 and x1 > hx - 12 and y1 > Y_FRONT - 50 and h > L['clear'] - 17:
            return True
    for (bx0, bx1, by0, by1, bh) in L['pins']:
        if x0 < bx1 and x1 > bx0 and y0 < by1 and y1 > by0:
            return True
    # stays near each panel face of the bay the item sits in
    for (a, b) in L['bays']:
        if x0 >= a - 1e-6 and x1 <= b + 1e-6:
            for face, sgn in ((a, 1), (b, -1)):
                band = (face + sgn * STAY_OFF[0], face + sgn * STAY_OFF[1])
                lo, hi = min(band), max(band)
                if x0 < hi and x1 > lo:
                    zs = stay_z_at(max(y0, STAY_FIX[0]))
                    if zs is not None and y1 > STAY_FIX[0] and h > zs:
                        return True
            return False
    return True  # spans a divider


def entry_ok(L, H):
    return H <= L['clear'] - (L['lip'] or 0)


def count(L, item, step=10):
    """Greedy packing per bay, both orientations, rows from the back; returns the best count."""
    name, a, b, H, _ = item
    if not entry_ok(L, H):
        return 0, 'too tall to get in'
    best = 0
    for (x0, x1) in L['bays']:
        bay_best = 0
        for (w, d) in ((a, b), (b, a)):
            placed = []
            ys = [Y_BACK + k * step for k in range(int((Y_FRONT - Y_BACK) / step) + 1)]
            xs = [x0 + k * step for k in range(int((x1 - x0) / step) + 1)] + [x1 - w]
            for y in ys:
                for x in sorted(set(xs)):
                    bx = (x, x + w, y, y + d, H)
                    if x + w > x1 + 1e-6:
                        continue
                    if collides(L, bx):
                        continue
                    if any(x < p[1] and x + w > p[0] and y < p[3] and y + d > p[2] for p in placed):
                        continue
                    placed.append(bx)
            bay_best = max(bay_best, len(placed))
        best += bay_best
    return best, ''


def layouts(raise_mm=16):
    c0 = 312.0
    T = 18.0
    half = 9.0
    # current: two bays, 36 lip, pins at +-300 in 50 x 50 blocks
    pinb = lambda x: (x - 25, x + 25, 536 - 25, 536 + 25, 80)
    hinges2 = [93, 765, -93, -765]
    cur = layout('Now: two bays, 36 lip, pins mid-bay', c0, 36.0, [(-861, -half), (half, 861)],
                 [pinb(300), pinb(-300)], hinge_x=hinges2)
    # A: two bays, flat, staple block straddling the divider (100 wide, 50 deep)
    A = layout('A: two bays, flat, twin pin at the divider', c0 + raise_mm, 0, [(-861, -half), (half, 861)],
               [(-50, 50, 519, 569, 70)], hinge_x=hinges2)
    # B: three bays 562, staple blocks at both dividers
    d = 290.0
    hinges3 = [3 + 90, 3 + 566 - 90 - 0, 572 + 90, 855 - 90]
    hinges3 = [h for h in (93, 193, 375, 765)]
    B = layout('B: three bays, twin pins at the dividers', c0 + raise_mm, 0,
               [(-861, -d - half), (-d + half, d - half), (d + half, 861)],
               [(-d - 50, -d + 50, 519, 569, 70), (d - 50, d + 50, 519, 569, 70)],
               hinge_x=[-765, -375, -193, 193, 375, 765])
    # C: one open bay, 42 torsion box, raised 26, corner pins
    C = layout('C: one open bay, torsion-box shelf, corner pins', c0 + 26 - 24, 0, [(-861, 861)],
               [(750, 800, 511, 561, 80), (-800, -750, 511, 561, 80)], hinge_x=[93, 765, -93, -765])
    return [cur, A, B, C]


if __name__ == '__main__':
    import json
    out = []
    for L in layouts():
        row = dict(layout=L['name'], clear=L['clear'], entry=L['clear'] - (L['lip'] or 0), counts={})
        for it in ITEMS:
            n, why = count(L, it)
            row['counts'][it[0]] = n
        out.append(row)
        print(L['name'], row['entry'], row['counts'])
    json.dump(out, open('fit.json', 'w'), indent=1)
