"""Figures for the antresol options study (PNG, white background, drawing style of the A3 set)."""
import json, math
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle, Polygon, Circle, FancyBboxPatch
from matplotlib.collections import PatchCollection

C = lambda *rgb: tuple(v / 255 for v in rgb)
CARCASS = C(244, 236, 221); FRONT = C(252, 249, 243); FRAME = C(235, 220, 196); DECK = C(240, 228, 207)
PACKER = C(222, 199, 166); BLOCK = C(181, 136, 92); METAL = C(74, 78, 84); CHROME = C(190, 194, 199)
MATT = C(238, 240, 242); ACC = C(176, 98, 10); BAD = C(176, 40, 31); INK = C(34, 34, 34); GREY = C(110, 112, 118)
GOOD = C(40, 110, 70); BOXC = C(214, 226, 238); BOXE = C(70, 96, 128)
FILLS = dict(carcass=CARCASS, front=FRONT, frame=FRAME, deck=DECK, packer=PACKER, block=BLOCK, metal=METAL,
             chrome=CHROME, mattress=MATT, rubber=METAL, strap=METAL, ledge=CARCASS, plinth=CARCASS, drawer=FRONT, back=CARCASS)
plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 9, 'axes.linewidth': 0.6})
LW = 0.7


def rect(ax, x0, y0, x1, y1, fc, ec=INK, lw=LW, z=2, ls='-', alpha=1, hatch=None):
    ax.add_patch(Rectangle((x0, y0), x1 - x0, y1 - y0, facecolor=fc, edgecolor=ec, lw=lw, zorder=z, ls=ls, alpha=alpha, hatch=hatch))


def dim_v(ax, x, y0, y1, text, side=1, color=INK, fs=8):
    ax.annotate('', xy=(x, y0), xytext=(x, y1), arrowprops=dict(arrowstyle='<->', lw=0.6, color=color, shrinkA=0, shrinkB=0), zorder=9)
    ax.text(x + side * 6, (y0 + y1) / 2, text, rotation=90, ha='left' if side > 0 else 'right', va='center', fontsize=fs, color=color, zorder=9)


def dim_h(ax, x0, x1, y, text, color=INK, fs=8, dy=5):
    ax.annotate('', xy=(x0, y), xytext=(x1, y), arrowprops=dict(arrowstyle='<->', lw=0.6, color=color, shrinkA=0, shrinkB=0), zorder=9)
    ax.text((x0 + x1) / 2, y + dy, text, ha='center', va='bottom', fontsize=fs, color=color, zorder=9)


def note(ax, xy, xytext, text, color=INK, fs=8, ha='left'):
    ax.annotate(text, xy=xy, xytext=xytext, fontsize=fs, color=color, ha=ha, va='center', zorder=10,
                arrowprops=dict(arrowstyle='-', lw=0.5, color=color, shrinkA=0, shrinkB=2))


def section_parts(ax, parts, x, win, skip=()):
    y0w, y1w, z0w, z1w = win
    for p in parts:
        b = p['bb']
        if p['mark'] in skip:
            continue
        if not (b[0] <= x <= b[3]):
            continue
        if b[4] < y0w or b[1] > y1w or b[5] < z0w or b[2] > z1w:
            continue
        ya, yb = max(b[1], y0w), min(b[4], y1w)
        za, zb = max(b[2], z0w), min(b[5], z1w)
        fc = FILLS.get(p['kind'], CARCASS)
        rect(ax, ya, za, yb, zb, fc, z=3 if p['hw'] else 2)


# ---------------------------------------------------------------- fig 1: section, lip vs flat
def fig_sections():
    P0 = json.load(open('parts.json')); PA = json.load(open('parts_A.json'))
    fig, axs = plt.subplots(1, 2, figsize=(11, 4.9), dpi=200)
    X = 300.0
    win = (250, 1070, 2095, 2575)
    for ax, D, title in ((axs[0], P0, 'Now: 36 mm lip, pin block mid-bay'), (axs[1], PA, 'Option A: flat shelf, towers 16 mm taller')):
        G = D['G']
        section_parts(ax, D['parts'], X, win, skip=('D4', 'FH', 'FS', 'LG'))
        ax.plot([win[0], win[1]], [2554, 2554], color=INK, lw=1.0, zorder=4)
        ax.text(win[0] + 6, 2560, 'ceiling', fontsize=7.5, color=GREY)
        top_u = G['zTopB']; shelf = G['zBm1']
        lip = any(p['mark'] == 'B5' for p in D['parts'])
        if lip:
            b0 = shelf + 36
            rect(ax, 560, b0, 1040, b0 + 310, BOXC, ec=BOXE, lw=0.9, z=5, alpha=0.85)
            rect(ax, 560, top_u, 600, b0 + 310, BAD, ec=BAD, lw=0, z=6, alpha=0.6)
            ax.text(820, b0 + 200, 'Really Useful Box 35 l, 310 high', ha='center', va='center', fontsize=8, color=BOXE, zorder=7)
            ax.text(820, b0 + 120, f'to pass over the lip it needs {310 + 36};\nthe opening is {int(top_u - shelf)}', ha='center', va='center', fontsize=8, color=BAD, zorder=7)
            dim_v(ax, 545, shelf + 36, top_u, f'{int(top_u - shelf - 36)} over the lip', side=-1)
            dim_v(ax, 470, shelf, top_u, f'{int(top_u - shelf)} clear', side=-1, color=GREY)
            note(ax, (572, shelf + 20), (700, shelf + 14), '36 mm lip', color=BAD)
            note(ax, (520, shelf + 30), (330, shelf + 95), 'pin block', color=BAD)
        else:
            rect(ax, 101, shelf, 581, shelf + 310, BOXC, ec=BOXE, lw=0.9, z=5, alpha=0.85)
            ax.text(420, shelf + 155, 'Really Useful Box 35 l\nslides straight in', ha='center', va='center', fontsize=8, color=BOXE, zorder=7)
            dim_v(ax, 640, shelf, top_u, f'{int(top_u - shelf)} clear', side=1)
            note(ax, (581, shelf + 6), (700, shelf + 14), 'flat top; the steel flat in the front edge takes the push latch', color=GOOD)
        note(ax, (560, 2131), (700, 2128), 'bed foot rail (bed closed)', color=GREY)
        note(ax, (591, 2105), (700, 2104), 'bed face panel', color=GREY)
        note(ax, (575, 2146), (700, 2152), '12 gap to the bed', color=GREY)
        ax.set_xlim(win[0], win[1]); ax.set_ylim(win[2], win[3]); ax.set_aspect('equal'); ax.axis('off')
        ax.set_title(title, fontsize=10, loc='left', color=INK, pad=4)
    fig.text(0.01, 0.02, 'Section 300 mm from the centre line through the left bay; room on the right; flaps open (not drawn). Dimensions in mm.', fontsize=7.5, color=GREY)
    fig.tight_layout(rect=(0, 0.04, 1, 1))
    fig.savefig('fig_section.png', facecolor='white')
    plt.close(fig)


# ---------------------------------------------------------------- fig 2: deflection maps
def fig_maps():
    M = json.load(open('maps.json'))
    fig, axs = plt.subplots(2, 1, figsize=(10, 6.6), dpi=200)
    specs = [('B0_flat_loose', 'Flat 18 mm shelf, divider only standing on it', 'Oranges'),
             ('A_steel_half', 'Option A: divider glued and screwed, steel flat in the front edge; right bay loaded, left empty', 'Blues')]
    for ax, (k, title, cm) in zip(axs, specs):
        d = M[k]; x = np.array(d['x']); y = np.array(d['y']); W = np.array(d['w'])
        Yp = 581 - y  # front edge at the bottom of the picture? keep front at bottom: plot y as depth from front
        step = 4 if W.max() > 10 else 0.2
        lv = np.arange(min(0.0, math.floor(W.min() / step) * step), W.max() + step, step)
        cf = ax.contourf(x, y, W, levels=lv, cmap=cm)
        cs = ax.contour(x, y, W, levels=lv[1::2], colors='k', linewidths=0.35, alpha=0.6)
        ax.clabel(cs, fmt=lambda v: f'{v:.1f}' if W.max() < 5 else f'{v:.0f}', fontsize=6.5)
        cb_ticks = lv[::2]
        cb = fig.colorbar(cf, ax=ax, fraction=0.025, pad=0.01, ticks=cb_ticks)
        cb.ax.set_yticklabels([f'{v:.1f}' if W.max() < 5 else f'{v:.0f}' for v in cb_ticks])
        cb.set_label('mm, long term', fontsize=7.5); cb.ax.tick_params(labelsize=7)
        # supports
        for xx in (-852, 852):
            ax.plot([xx, xx], [y.min(), y.max()], color=INK, lw=2.2)
        ax.plot([x.min(), x.max()], [y.min(), y.min()], color=INK, lw=2.2)
        if k == 'A_steel_half':
            ax.plot([0, 0], [y.min(), y.max()], color=INK, lw=2.2)
            ax.text(10, 300, 'divider', rotation=90, fontsize=7.5, va='center', color=INK)
        imax = np.unravel_index(np.argmax(W), W.shape)
        ax.plot(x[imax[1]], y[imax[0]], 'o', color='k', ms=3)
        ax.annotate(f'{W.max():.1f} mm', (x[imax[1]], y[imax[0]]), xytext=(x[imax[1]] + 60, y[imax[0]] - 110), fontsize=8.5,
                    arrowprops=dict(arrowstyle='-', lw=0.5), weight='bold')
        ax.set_xlim(-880, 880); ax.set_ylim(y.max() + 8, y.min() - 30)
        ax.set_aspect('equal')
        ax.set_xticks([-852, -426, 0, 426, 852]); ax.set_yticks([25, 581]); ax.set_yticklabels(['wall rail', 'front edge'])
        ax.tick_params(labelsize=7)
        ax.set_title(title, fontsize=9.5, loc='left')
    fig.text(0.01, 0.01, 'Shelf over the bed from above, front edge at the bottom. 100 kg/m² of storage (top: both bays; bottom: one bay, the worst case) plus the shelf\'s weight, creep x1.8. Thick lines = supports.', fontsize=7.5, color=GREY)
    fig.tight_layout(rect=(0, 0.03, 1, 1))
    fig.savefig('fig_maps.png', facecolor='white')
    plt.close(fig)


# ---------------------------------------------------------------- fig 3: layouts from above
def bay_frame(ax, y0, dividers, label, clear, note_txt=None):
    # tower sides and dividers in plan; y0 = picture offset; depth 16..581 drawn downward (front at the bottom)
    H = 565
    def Y(y):
        return y0 + (581 - y)   # front edge at the bottom (y0), back at y0 + 565
    rect(ax, -861, Y(581), 861, Y(16), C(250, 247, 240), ec=INK, lw=0.6, z=1)
    for s in (-1, 1):
        rect(ax, s * 861, Y(581), s * 897, Y(16), CARCASS, ec=INK, lw=0.6, z=2, hatch='////')
    for d in dividers:
        rect(ax, d - 9, Y(581), d + 9, Y(16), CARCASS, ec=INK, lw=0.6, z=3)
    # stays (thin rods near each panel face, front half)
    faces = [-861, 861] + [d + s * 9 for d in dividers for s in (-1, 1)]
    for f in faces:
        sgn = 1 if f < 0 or (f in [d - 9 for d in dividers]) else -1
        if f in [d + 9 for d in dividers]:
            sgn = 1
        if f in [d - 9 for d in dividers]:
            sgn = -1
        if f == -861:
            sgn = 1
        if f == 861:
            sgn = -1
        xx = f + sgn * 12
        ax.plot([xx, xx], [Y(331), Y(572)], color=METAL, lw=1.4, zorder=4, solid_capstyle='round')
    ax.text(-861, Y(16) + 30, label, fontsize=9, weight='bold', va='bottom')
    ax.text(861, Y(16) + 30, f'{clear}', fontsize=8.5, va='bottom', ha='right', color=GREY)
    if note_txt:
        ax.text(-861, Y(581) - 40, note_txt, fontsize=7.8, va='top', color=GREY)
    return Y


def item(ax, Y, x0, y0, w, d, name, color=BOXC, ec=BOXE):
    rect(ax, x0, Y(y0), x0 + w, Y(y0 + d), color, ec=ec, lw=0.8, z=5, alpha=0.95)
    ax.text(x0 + w / 2, Y(y0 + d / 2), name, ha='center', va='center', fontsize=7, color=ec, zorder=6)


def pin(ax, Y, x, y, w=50, d=50, color=BLOCK):
    rect(ax, x - w / 2, Y(y - d / 2), x + w / 2, Y(y + d / 2), color, ec=INK, lw=0.6, z=6)


def fig_layouts():
    fig, ax = plt.subplots(figsize=(10, 12.5), dpi=200)
    gap = 860
    # 1: now
    Y = bay_frame(ax, 3 * gap, [0], 'Now: two bays, 36 mm lip, pins mid-bay', 'clear 312, 276 over the lip',
                  'Lip and pins block the front of each bay; only boxes under 276 mm get in, and only behind the pins.')
    for s in (-1, 1):
        rect(ax, 9 if s > 0 else -861, Y(581), 861 if s > 0 else -9, Y(563), C(236, 200, 190), ec=BAD, lw=0.6, z=5, hatch='xxx')
        pin(ax, Y, s * 300, 536, color=C(205, 120, 100))
    item(ax, Y, -840, 34, 600, 400, 'crate\n600 x 400')
    item(ax, Y, 240, 34, 600, 400, 'crate\n600 x 400')
    # 2: A
    Y = bay_frame(ax, 2 * gap, [0], 'A: two bays, flat shelf, twin pin at the divider', 'clear 328 (towers +16)',
                  'Bays 852 x 565. The twin-pin block sits in front of the divider; everything else is open.')
    pin(ax, Y, 0, 544, w=100, d=50, color=ACC)
    item(ax, Y, -840, 16, 690, 550, 'IKEA SKUBB case\n690 x 550 x 190')
    item(ax, Y, 55, 34, 390, 480, 'RUB 35 l\n390 x 480')
    item(ax, Y, 450, 34, 390, 480, 'RUB 35 l\n390 x 480')
    # 3: B
    d = 290
    Y = bay_frame(ax, gap, [-d, d], 'B: three bays, three flaps, twin pins at both dividers', 'clear 328',
                  'Bays 562 wide: nearly square, so 570-690 mm boxes and suitcases no longer fit.')
    for s in (-1, 1):
        pin(ax, Y, s * d, 544, w=100, d=50, color=ACC)
    item(ax, Y, -785, 34, 390, 480, 'RUB 35 l')
    item(ax, Y, -200, 16, 400, 550, 'cabin bag\n400 x 550')
    item(ax, Y, 395, 34, 390, 480, 'RUB 35 l')
    # 4: C
    Y = bay_frame(ax, 0, [], 'C: one open bay, 42 mm torsion-box shelf, pins in the corners', 'clear 314 (towers +26)',
                  'Takes long things; boxes fit about as in A. Light storage only (see the sag chart).')
    for s in (-1, 1):
        pin(ax, Y, s * 775, 536, color=ACC)
    item(ax, Y, -800, 40, 1600, 250, 'rolled rug or ski bag, 1600 long', color=C(226, 232, 214), ec=C(80, 100, 60))
    for k in range(4):
        item(ax, Y, -700 + k * 360, 330, 330, 200, 'shoe box\n330 x 200')
    ax.set_xlim(-920, 920); ax.set_ylim(-150, 3 * gap + 700)
    ax.set_aspect('equal'); ax.axis('off')
    fig.text(0.02, 0.008, 'From above, front edge (flaps) at the bottom of each plan; dark rods = flap gas stays, brown = lock blocks. RUB = Really Useful Box.', fontsize=7.5, color=GREY)
    fig.tight_layout(rect=(0, 0.015, 1, 1))
    fig.savefig('fig_layouts.png', facecolor='white')
    plt.close(fig)


# ---------------------------------------------------------------- fig 4: lock positions, front elevation
def fig_locks():
    D = json.load(open('parts.json')); G = D['G']
    fig, ax = plt.subplots(figsize=(11, 4.6), dpi=200)
    z0, z1 = 1880, 2575
    # towers: inner side T2, top compartment interior
    for s in (-1, 1):
        rect(ax, s * 861, z0, s * 879, 2482, CARCASS, z=2)             # tower inner side
        rect(ax, s * 879, 1782, s * 1206, 1800, CARCASS, z=2)          # tower shelf
        rect(ax, s * 879, 2482, s * 1224, 2500, CARCASS, z=2)          # tower top
        rect(ax, s * 1206, z0, s * 1224, 2482, CARCASS, z=2)           # tower outer side
        rect(ax, s * 843, z0, s * 861, 2152, CARCASS, z=2)             # bed-cabinet side
        rect(ax, s * 795, z0, s * 813, 2140, FRAME, z=1, ls='--', lw=0.6)   # side rail (behind the face)
    rect(ax, -861, 2152, 861, 2170, CARCASS, z=2)                      # shelf
    rect(ax, -861, 2482, 861, 2500, CARCASS, z=2)                      # top
    rect(ax, -9, 2170, 9, 2482, CARCASS, z=2)                          # divider
    rect(ax, -795, 2122, 795, 2140, FRAME, z=1, ls='--', lw=0.6)       # foot rail
    rect(ax, -813, z0, 0, 2140, FRONT, z=0, alpha=0.6); rect(ax, 0, z0, 813, 2140, FRONT, z=0, alpha=0.6)
    ax.plot([-1224, 1224], [2554, 2554], color=INK, lw=0.9)
    ax.text(0, 1960, 'bed face panel (two halves)', ha='center', fontsize=7.5, color=GREY)
    ax.text(0, 2100, 'foot rail behind the face', ha='center', fontsize=7, color=GREY)
    for s in (-1, 1):
        ax.text(s * 1042, 2100, 'tower top\ncompartment', ha='center', va='center', fontsize=7, color=GREY)
    # L1 mid-bay pins
    for s in (-1, 1):
        x = s * 300
        rect(ax, x - 25, 2170, x + 25, 2215, C(205, 120, 100), z=5)
        ax.plot([x, x], [2125, 2240], color=BAD, lw=2.2, zorder=6)
        ax.plot([x - 30, x + 30], [2160, 2250], color=BAD, lw=1.4, zorder=8); ax.plot([x - 30, x + 30], [2250, 2160], color=BAD, lw=1.4, zorder=8)
    note(ax, (300, 2252), (380, 2440), '1  now: pins mid-bay, in the way of boxes', color=BAD)
    # L2 staple straddling the divider
    rect(ax, -50, 2170, 50, 2210, ACC, z=5)
    for s in (-1, 1):
        ax.plot([s * 30, s * 30], [2125, 2228], color=METAL, lw=2.4, zorder=6)
    ax.plot([-30, -30, 30, 30], [2228, 2245, 2245, 2228], color=METAL, lw=2.4, zorder=6)
    note(ax, (-20, 2246), (-120, 2400), '2  twin pin straddling the divider\n    (two pins on one bar, one pull)', color=ACC, ha='right')
    # L3 corner pins
    for s in (-1, 1):
        x = s * 775
        rect(ax, x - 25, 2170, x + 25, 2215, ACC, z=5)
        ax.plot([x, x], [2125, 2240], color=METAL, lw=2.2, zorder=6)
    note(ax, (775, 2240), (700, 2330), '3  corner pins over the\n    foot rail ends', color=ACC, ha='right')
    # L4 tower bolts
    for s in (-1, 1):
        ax.plot([s * 930, s * 800], [2050, 2050], color=METAL, lw=2.6, zorder=6)
        ax.add_patch(Circle((s * 935, 2050), 9, facecolor=METAL, edgecolor=INK, lw=0.4, zorder=7))
    note(ax, (-930, 2050), (-1180, 2230), '4  bolts from inside the tower\n    into the side rails', color=ACC)
    ax.set_xlim(-1240, 1240); ax.set_ylim(z0, z1); ax.set_aspect('equal'); ax.axis('off')
    fig.text(0.01, 0.02, 'Front view, flaps and tower doors off; dashed = bed frame behind the face panel. Pins drop 15 mm into the foot rail; bolts go 15 mm into the side rails.', fontsize=7.5, color=GREY)
    fig.tight_layout(rect=(0, 0.04, 1, 1))
    fig.savefig('fig_locks.png', facecolor='white')
    plt.close(fig)


# ---------------------------------------------------------------- fig 5: staple pin detail
def fig_staple():
    fig, axs = plt.subplots(1, 2, figsize=(11, 5.0), dpi=200)
    sh0, sh1 = 2152, 2170
    ylim = (2085, 2320)
    bar0 = sh1 + 40                      # bar rests on the block when locked
    # (a) front view at the divider
    ax = axs[0]
    rect(ax, -170, sh0, 170, sh1, CARCASS)
    rect(ax, -9, 2300, 9, ylim[1], CARCASS)
    note(ax, (0, 2310), (60, 2310), 'divider, notched 72 deep x 130 high\nat its front foot for the block and bar', fs=7, color=GREY)
    rect(ax, -50, sh1, 50, bar0, BLOCK)
    rect(ax, -170, 2122, 170, 2140, FRAME)
    rect(ax, -60, 2137, 60, 2140, CHROME, lw=0.4, z=3)
    for lift, ls, al in ((0, '-', 1.0), (30, '--', 0.7)):
        solid = lift == 0
        for sgn in (-1, 1):
            ax.add_patch(Rectangle((sgn * 30 - 5, 2125 + lift), 10, bar0 + 12 - 2125, facecolor=CHROME if solid else 'none',
                                   edgecolor=METAL if solid else GREY, lw=0.8, ls=ls, zorder=6, alpha=al))
            rect(ax, sgn * 30 - 8, bar0 + 6 + lift, sgn * 30 + 8, bar0 + 12 + lift, METAL if solid else 'none', ec=METAL if solid else GREY, lw=0.6, z=7, ls=ls, alpha=al)
        rect(ax, -50, bar0 + lift, 50, bar0 + 6 + lift, METAL if solid else 'none', ec=METAL if solid else GREY, lw=0.8, z=7, ls=ls, alpha=al)
        ax.add_patch(FancyBboxPatch((-15, bar0 + 6 + lift), 30, 22, boxstyle='round,pad=0,rounding_size=8', facecolor=BLOCK if solid else 'none',
                                    edgecolor=INK if solid else GREY, lw=0.7, ls=ls, zorder=7, alpha=al))
    dim_h(ax, -30, 30, 2100, '60 c/c', fs=7.5, dy=-16)
    dim_v(ax, -110, 2125, 2140, '15 into the rail', side=-1, fs=7)
    dim_v(ax, -140, 2140, 2152, '12 gap', side=-1, fs=7)
    dim_v(ax, 75, bar0, bar0 + 30, 'lift 30', side=1, fs=7, color=ACC)
    note(ax, (45, 2190), (95, 2190), 'hardwood guide block\n100 x 50 x 40, steel bushes', fs=7)
    note(ax, (35, 2160), (95, 2160), 'two 10 mm mild-steel pins', fs=7)
    note(ax, (48, bar0 + 3), (95, bar0 + 44), '100 x 30 x 6 steel bar, pins\nnutted through it; wooden knob', fs=7)
    note(ax, (50, 2138), (95, 2112), 'steel strike plate let into\nthe foot rail (bed closed)', fs=7)
    ax.set_xlim(-180, 190); ax.set_ylim(*ylim); ax.set_aspect('equal'); ax.axis('off')
    ax.set_title('Front view at the divider, flaps off', fontsize=9.5, loc='left')
    # (b) side section through one pin (x = 30)
    ax = axs[1]
    rect(ax, 390, sh0, 581, sh1, CARCASS)
    rect(ax, 519, sh1, 569, bar0, BLOCK)
    rect(ax, 506, 2122, 582, 2140, FRAME)
    rect(ax, 582, ylim[0], 600, 2140, FRONT)
    rect(ax, 582, 2146, 600, ylim[1], FRONT)
    rect(ax, 390, sh1, 509, 2300, CARCASS, ls='--', alpha=0.45)
    rect(ax, 390, 2300, 581, ylim[1], CARCASS, ls='--', alpha=0.45)
    ax.add_patch(Rectangle((539, 2125), 10, bar0 + 12 - 2125, facecolor=CHROME, edgecolor=METAL, lw=0.8, zorder=6))
    rect(ax, 529, bar0, 559, bar0 + 6, METAL, ec=METAL, z=7)
    rect(ax, 536, bar0 + 6, 552, bar0 + 12, METAL, ec=METAL, z=7)
    ax.add_patch(Rectangle((544, bar0 - 3), 72, 3, facecolor='none', edgecolor=ACC, lw=0.9, ls='--', zorder=7))
    note(ax, (612, bar0 - 2), (630, 2262), 'optional 2 mm tab under the bar, out\nthrough the 6 mm joint between the\nflaps: unlock without opening a flap', fs=7, color=ACC)
    dim_h(ax, 544, 581, 2100, '37', fs=7.5, dy=-16)
    note(ax, (575, 2131), (630, 2125), 'foot rail, drilled through', fs=7, color=GREY)
    note(ax, (591, 2180), (630, 2185), 'flap, closed', fs=7, color=GREY)
    note(ax, (591, 2110), (630, 2100), 'bed face panel', fs=7, color=GREY)
    note(ax, (450, 2240), (430, 2275), 'divider beyond (dashed)', fs=7, color=GREY)
    note(ax, (527, 2195), (400, 2200), 'spring ball plunger\nholds the pins up or down', fs=7)
    ax.set_xlim(380, 750); ax.set_ylim(*ylim); ax.set_aspect('equal'); ax.axis('off')
    ax.set_title('Section through one pin, room on the right', fontsize=9.5, loc='left')
    fig.text(0.01, 0.02, 'Locked (solid) and lifted 30 mm (dashed): lifted, the tips sit inside the shelf, clear of the bed. Dimensions in mm.', fontsize=7.5, color=GREY)
    fig.tight_layout(rect=(0, 0.045, 1, 1))
    fig.savefig('fig_staple.png', facecolor='white')
    plt.close(fig)


if __name__ == '__main__':
    import sys
    which = sys.argv[1:] or ['sections', 'maps', 'layouts', 'locks', 'staple']
    for w in which:
        globals()['fig_' + w]()
        print('done', w)
