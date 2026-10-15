"""Long-term deflection maps of the shelf for the figures: divider loose (both bays loaded) and
option A (divider fixed, steel flat, one bay loaded). Writes maps.json."""
import json
import numpy as np
import cases

out = {}
for key, k, kind in [('B0_flat_loose', 'B0_flat_loose', 'udl'), ('A_steel_half', 'B2_flat_divider_steel', 'udl_half')]:
    c = cases.CASES[k]
    g = {}
    for lab, kd, val in [('dead', 'dead', None), ('load', kind, 100.0)]:
        r = cases.run(c, [('heavy', kd, val)])
        g[lab] = np.array(r['heavy']['grid']['w'])
        xs, ys = r['heavy']['grid']['x'], r['heavy']['grid']['y']
    W = (g['dead'] + g['load']) * (1 + cases.KDEF)
    out[key] = dict(x=xs, y=ys, w=W.tolist(), max=float(W.max()))
    print(key, round(float(W.max()), 2), 'mm')
json.dump(out, open('maps.json', 'w'))
