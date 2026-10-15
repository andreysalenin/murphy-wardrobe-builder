"""Shelf-over-the-bed options: front-edge sag for each build, from the grillage model.

Geometry from the default design (2458 x 2554 x 600): shelf B2 18 mm, 2170 top, 12 mm above the closed bed;
top B3 at 2482..2500; centre divider 312 x 565; wall rails under both at the back.
"""
import json, math
import numpy as np
from grillage import Model, grid, merge

# ---- geometry (mm) ----
XS = 852.0          # shelf end supports: centre of the bed-cabinet side tops (843..861)
XT = 861.0          # top end supports: cleats on the tower sides
Y0, Y1 = 25.0, 581.0  # back support (wall rail centre) to the front edge
H_DIV = 312.0       # divider height (clear between shelf and top)
LEV = 165.0         # shelf / top mid-planes to the divider mid-height

# ---- materials ----
E_X, E_Y, G_PLY = 8000.0, 5500.0, 550.0   # 18 mm ply: along face grain, across, twist (in-plane) shear
E_SKIN_X, E_SKIN_Y = 8000.0, 4400.0      # 6 mm 3-ply skins in tension / compression
E_STEEL = 200000.0
RHO = 6.2e-7 * 9.81                      # N/mm3 (620 kg/m3 ply)
K_ROOT = 5e8   # N mm/rad: shelf and top screwed to their wall rails, ~8 screws each, slip 2000 N/mm per screw
KDEF = 0.8                               # creep (EN 1995 plywood, service class 1): final = inst x 1.8
G_ACC = 9.81


def solid(t, Ex=E_X, Ey=E_Y, G=G_PLY):
    return dict(Dx=Ex * t ** 3 / 12, Dy=Ey * t ** 3 / 12, Tx=G * t ** 3 / 6, Ty=G * t ** 3 / 6,
                dead=RHO * t, t=t, kgm2=t * 0.62)


def sandwich(H, ts=6.0, rib_t=12.0, rib_pitch=150.0):
    d = H - ts
    Dx = E_SKIN_X * (2 * ts * (d / 2) ** 2 + 2 * ts ** 3 / 12)
    Dy = E_SKIN_Y * (2 * ts * (d / 2) ** 2 + 2 * ts ** 3 / 12)
    T = G_PLY * ts * d * d                 # GJ per unit width for the closed sandwich
    core = H - 2 * ts
    ribs_per_mm2 = 2 * rib_t * core / rib_pitch  # ribs both ways, mm3 per mm2
    dead = RHO * (2 * ts + ribs_per_mm2)
    return dict(Dx=Dx, Dy=Dy, Tx=T, Ty=T, dead=dead, t=H, kgm2=(2 * ts + ribs_per_mm2) * 0.62)


def t_section_EI(flange_b, t, web_t, web_h, E):
    """Upstand on a plate: extra EI over the flange's own (the grillage already has the flange)."""
    A1, A2 = flange_b * t, web_t * web_h
    y1, y2 = t / 2, t + web_h / 2
    yc = (A1 * y1 + A2 * y2) / (A1 + A2)
    I = flange_b * t ** 3 / 12 + A1 * (y1 - yc) ** 2 + web_t * web_h ** 3 / 12 + A2 * (y2 - yc) ** 2
    return E * (I - flange_b * t ** 3 / 12)


def divider_deep_beam(h=H_DIV, t=18.0, beff=200.0, tf=18.0, E=E_Y, Gp=500.0):
    I = t * h ** 3 / 12 + 2 * beff * tf * LEV ** 2
    GA = Gp * t * h * 5 / 6
    return E * I, GA


def run(case, loads):
    """case: dict describing the build. loads: list of (label, kind, value). Returns results per load."""
    h = 24.0
    sx = case.get('sx', [])
    xs = merge(grid(-XS, XS, h), np.array([0.0, -9.0, 9.0] + sx + [-v for v in sx]))
    ys = merge(grid(Y0, Y1, 23.0), np.array([Y1 - 9.0, 536.0, 551.0]))
    out = {}
    for lab, kind, val in loads:
        m = Model()
        sh = case['shelf']
        m.plate('S', xs, ys, sh['Dx'], sh['Dy'], sh['Tx'], sh['Ty'])
        for x in (-XS, XS):
            m.support_line('S', x=x)
        m.support_line('S', y=Y0)
        top = case.get('top')
        if top:
            xt = merge(grid(-XT, XT, h), np.array([0.0, -9.0, 9.0] + sx + [-v for v in sx]))
            m.plate('T', xt, ys, top['Dx'], top['Dy'], top['Tx'], top['Ty'])
            for x in (-XT, XT):
                m.support_line('T', x=x)
            m.support_line('T', y=Y0)
        # front-edge beam on the shelf (lip, lipping, steel)
        for eb in case.get('shelf_edge', []):
            m.edge_beam_x('S', eb['y'], eb['x0'], eb['x1'], eb['EI'])
            if eb.get('mirror'):
                m.edge_beam_x('S', eb['y'], -eb['x1'], -eb['x0'], eb['EI'])
        for eb in case.get('top_edge', []):
            m.edge_beam_x('T', eb['y'], eb['x0'], eb['x1'], eb['EI'])
        # full-depth dividers: deep beam on the shelf column, tied to the top
        for dx in case.get('dividers', []):
            EI, GA = case.get('div_EI_GA', divider_deep_beam())
            for xx in ([dx] if dx == 0 else [dx, -dx]):
                m.beam_y('S', xx, Y0, Y1, EI, GA)
                n0, _, _ = m.node('S', xx, Y0)
                kr = case.get('k_root', K_ROOT)
                if kr is None:
                    m.fixed.add(n0 + 2)    # root held rigidly
                else:
                    m.spring(n0 + 2, None, kr)   # root held by the panels' screws (in-plane couple)
                if top:
                    p = m.plates['S']
                    for j, y in enumerate(p['ys']):
                        nS, _, _ = m.node('S', xx, y); nT, _, _ = m.node('T', xx, y)
                        k = 8000 * 18 * p['ty'][j] / H_DIV
                        m.spring(nS, nT, k)
        # slim front hangers (posts or rods) shelf front -> top front
        for hx in case.get('hangers', []):
            for xx in ([hx] if hx == 0 else [hx, -hx]):
                nS, _, _ = m.node('S', xx, Y1 - 9.0); nT, _, _ = m.node('T', xx, Y1 - 9.0)
                m.spring(nS, nT, case.get('hanger_k', 8000 * 18 * 60 / H_DIV))
        # loads
        if kind == 'dead':
            m.uniform('S', sh['dead'])
            if top:
                m.uniform('T', top['dead'])
                for hx in case.get('flap_hinges', []):   # flap weight on the top's front edge
                    m.point('T', hx, Y1 - 20, case['flap_N'] / 2)
                    m.point('T', -hx, Y1 - 20, case['flap_N'] / 2)
        elif kind == 'udl':          # kg per m2 over the whole shelf
            m.uniform('S', val * G_ACC / 1e6)
        elif kind == 'udl_half':     # kg per m2 on the right half only
            m.uniform('S', val * G_ACC / 1e6, x0=0)
        elif kind == 'point':        # N at the worst front-edge point (x given)
            m.point('S', val[0], Y1, val[1])
        m.solve()
        xr, wr = m.w_row('S', Y1)
        Xg, Yg, Wg = m.w_grid('S')
        out[lab] = dict(front_max=float(Wg.max()), x_at=float(xr[int(np.argmax(wr))]),
                        front_row=[float(v) for v in wr[::3]], xs=[float(v) for v in xr[::3]])
        if top:
            xt_, wt = m.w_row('T', Y1)
            out[lab]['top_front_max'] = float(wt.max())
        if lab == 'heavy':
            X, Y, W = m.w_grid('S')
            out[lab]['grid'] = dict(x=[float(v) for v in X], y=[float(v) for v in Y], w=W.tolist())
    return out


def evaluate(case):
    LOADS = [('dead', 'dead', None), ('light', 'udl', 40.0), ('heavy', 'udl', 100.0), ('heavy_half', 'udl_half', 100.0)]
    pts = case.get('point_x', [426.0])
    res = run(case, LOADS + [(f'point@{int(x)}', 'point', (x, 300.0)) for x in pts])
    long_light = (res['dead']['front_max'] + res['light']['front_max']) * (1 + KDEF)
    long_heavy_full = (res['dead']['front_max'] + res['heavy']['front_max']) * (1 + KDEF)
    long_heavy_half = (res['dead']['front_max'] + res['heavy_half']['front_max']) * (1 + KDEF)
    long_heavy = max(long_heavy_full, long_heavy_half)
    point = max(res[f'point@{int(x)}']['front_max'] for x in pts)
    return dict(res=res, long_light=long_light, long_heavy=long_heavy, long_full=long_heavy_full, long_half=long_heavy_half, point=point,
                top_dead=res['dead'].get('top_front_max'))


S18 = solid(18)
T18 = solid(18)
FLAP_N = 852 * 348 * 18 * RHO   # one flap, N

CASES = {}
lipEI = t_section_EI(150, 18, 18, 36, 8000)
CASES['A0_lip_no_divider'] = dict(label='18 shelf + 36 lip, divider not fixed (how the old estimate saw it)', shelf=S18,
                                  shelf_edge=[dict(y=Y1, x0=9, x1=XS, EI=lipEI, mirror=True)])
CASES['A1_lip_divider'] = dict(label='Current: 18 shelf + 36 lip + centre divider glued and screwed', shelf=S18, top=T18,
                               shelf_edge=[dict(y=Y1, x0=9, x1=XS, EI=lipEI, mirror=True)], dividers=[0],
                               flap_hinges=[93, 765], flap_N=FLAP_N)
CASES['B0_flat_loose'] = dict(label='18 shelf, no lip, divider only sitting in place', shelf=S18)
CASES['B1_flat_divider'] = dict(label='18 shelf, no lip, centre divider glued and screwed', shelf=S18, top=T18,
                                dividers=[0], flap_hinges=[93, 765], flap_N=FLAP_N)
EI_d, GA_d = divider_deep_beam()
CASES['B1s_flat_divider_screwed'] = dict(label='as B1 but divider only screwed (joint slip, 1/4 shear stiffness)', shelf=S18, top=T18,
                                         dividers=[0], div_EI_GA=(EI_d / 2, GA_d / 4), flap_hinges=[93, 765], flap_N=FLAP_N)
CASES['B2_flat_divider_steel'] = dict(label='B1 + 20 x 10 steel flat on edge in the front edge', shelf=S18, top=T18, dividers=[0],
                                      shelf_edge=[dict(y=Y1, x0=9, x1=XS, EI=E_STEEL * 10 * 20 ** 3 / 12, mirror=True)],
                                      flap_hinges=[93, 765], flap_N=FLAP_N)
D3 = 290.0
CASES['C1_three_dividers'] = dict(label='18 shelf, no lip, two dividers (three bays)', shelf=S18, top=T18, dividers=[D3], sx=[D3],
                                  point_x=[0.0, 568.0], flap_hinges=[60, 220, 344, 504, 628, 788], flap_N=FLAP_N * 566 / 852 * 2 / 3)
for H in (30, 36, 42):
    CASES[f'D_box{H}'] = dict(label=f'torsion-box shelf {H} (6 mm skins), no divider', shelf=sandwich(H), point_x=[0.0, 426.0])
SHS = E_STEEL * (40 ** 4 - 34 ** 4) / 12
CASES['E1_open_post_shs'] = dict(label='18 shelf, open bay: front post at centre hung from a 40x40x3 SHS on the top', shelf=S18, top=T18,
                                 top_edge=[dict(y=Y1, x0=-XT, x1=XT, EI=SHS)], hangers=[0], point_x=[0.0, 426.0],
                                 hanger_k=8000 * 18 * 60 / H_DIV)
CASES['E2_open_post_ply'] = dict(label='18 shelf, open bay: front post hung from an 18 x 36 ply upstand on the top', shelf=S18, top=T18,
                                 top_edge=[dict(y=Y1, x0=-XT, x1=XT, EI=t_section_EI(150, 18, 18, 36, 8000))], hangers=[0],
                                 point_x=[0.0, 426.0])
CASES['E3_open_box30_post'] = dict(label='30 torsion box + centre post to a 40x40x3 SHS', shelf=sandwich(30), top=T18,
                                   top_edge=[dict(y=Y1, x0=-XT, x1=XT, EI=SHS)], hangers=[0], point_x=[0.0, 426.0])

RHS30 = E_STEEL * (20 * 30 ** 3 - 16 * 26 ** 3) / 12
CASES['D_box42_rhs'] = dict(label='42 torsion box with a 30x20x2 RHS as its front rib, no divider', shelf=sandwich(42),
                            shelf_edge=[dict(y=Y1, x0=-XS, x1=XS, EI=RHS30)], point_x=[0.0, 426.0])
CASES['D_box36_rhs'] = dict(label='36 torsion box with a 30x20x2 RHS front rib, no divider', shelf=sandwich(36),
                            shelf_edge=[dict(y=Y1, x0=-XS, x1=XS, EI=RHS30)], point_x=[0.0, 426.0])


CASES['B1r_rigid_root'] = dict(CASES['B1_flat_divider'], label='A with a perfectly rigid divider root', k_root=None)
CASES['B1g_glued_rails'] = dict(CASES['B1_flat_divider'], label='A with shelf and top glued as well as screwed to their wall rails', k_root=2e9)
CASES['B2g_steel_glued'] = dict(CASES['B2_flat_divider_steel'], label='A + steel flat, shelf and top glued to their rails', k_root=2e9)

if __name__ == '__main__':
    import sys
    sel = sys.argv[1:] or list(CASES)
    summary = {}
    for k in sel:
        c = CASES[k]
        r = evaluate(c)
        summary[k] = dict(label=c['label'], long_light=r['long_light'], long_heavy=r['long_heavy'], long_full=r['long_full'], long_half=r['long_half'], point=r['point'],
                          dead=r['res']['dead']['front_max'], heavy_inst=r['res']['heavy']['front_max'],
                          half_inst=r['res']['heavy_half']['front_max'], top_dead=r['top_dead'], t=c['shelf']['t'],
                          kgm2=c['shelf']['kgm2'], row=r['res']['heavy']['front_row'], xs=r['res']['heavy']['xs'],
                          grid=r['res']['heavy'].get('grid'))
        print(f"{k:28s} long light {r['long_light']:6.2f}  heavy full {r['long_full']:6.2f} one bay {r['long_half']:6.2f}  300N point {r['point']:6.2f}"
              f"  dead {r['res']['dead']['front_max']:5.2f}  top(dead) {r['top_dead'] if r['top_dead'] is None else round(r['top_dead'], 2)}")
    json.dump(summary, open('results.json', 'w'))
