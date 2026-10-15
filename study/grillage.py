"""Grillage (beam-grid) plate model for the shelf and top over the bed.

Units: N, mm, MPa.  DOFs per node: w (down positive), a = dw/dx, b = dw/dy.
x runs across the bay (span), y from the back wall rail (0) to the front edge.
Members along x bend with (w, a) and twist with b; members along y bend with (w, b) and twist with a
(Hambly's grillage analogy for an orthotropic plate).
"""
import numpy as np
import scipy.sparse as sp
import scipy.sparse.linalg as spla


def beam_k(EI, L, GA=None):
    """4x4 bending stiffness for (w1, s1, w2, s2), Timoshenko if GA given (s = dw/dxi)."""
    phi = 0.0 if not GA else 12 * EI / (GA * L * L)
    c = EI / (L ** 3 * (1 + phi))
    return c * np.array([
        [12, 6 * L, -12, 6 * L],
        [6 * L, (4 + phi) * L * L, -6 * L, (2 - phi) * L * L],
        [-12, -6 * L, 12, -6 * L],
        [6 * L, (2 - phi) * L * L, -6 * L, (4 + phi) * L * L]])


class Model:
    def __init__(self):
        self.ndof = 0
        self.rows, self.cols, self.vals = [], [], []
        self.F = []
        self.fixed = set()
        self.plates = {}

    def add(self, dofs, k):
        for i, di in enumerate(dofs):
            for j, dj in enumerate(dofs):
                if k[i, j] != 0:
                    self.rows.append(di); self.cols.append(dj); self.vals.append(k[i, j])

    def plate(self, name, xs, ys, Dx, Dy, Dxy_t_x, Dxy_t_y):
        """Plate as a grillage. Dx, Dy bending rigidities per unit width (N mm), Dxy_t_* torsion GJ per unit width."""
        nx, ny = len(xs), len(ys)
        base = self.ndof
        self.ndof += 3 * nx * ny
        self.F.extend([0.0] * (3 * nx * ny))
        idx = lambda i, j: base + 3 * (j * nx + i)
        # tributary widths
        tx = np.zeros(nx); ty = np.zeros(ny)
        tx[:-1] += np.diff(xs) / 2; tx[1:] += np.diff(xs) / 2
        ty[:-1] += np.diff(ys) / 2; ty[1:] += np.diff(ys) / 2
        # x-members
        for j in range(ny):
            for i in range(nx - 1):
                L = xs[i + 1] - xs[i]
                n1, n2 = idx(i, j), idx(i + 1, j)
                self.add([n1, n1 + 1, n2, n2 + 1], beam_k(Dx * ty[j], L))
                kt = Dxy_t_x * ty[j] / L
                self.add([n1 + 2, n2 + 2], kt * np.array([[1, -1], [-1, 1]]))
        # y-members
        for i in range(nx):
            for j in range(ny - 1):
                L = ys[j + 1] - ys[j]
                n1, n2 = idx(i, j), idx(i, j + 1)
                self.add([n1, n1 + 2, n2, n2 + 2], beam_k(Dy * tx[i], L))
                kt = Dxy_t_y * tx[i] / L
                self.add([n1 + 1, n2 + 1], kt * np.array([[1, -1], [-1, 1]]))
        self.plates[name] = dict(xs=np.asarray(xs), ys=np.asarray(ys), idx=idx, tx=tx, ty=ty)
        return self.plates[name]

    def node(self, name, x, y):
        p = self.plates[name]
        i = int(np.argmin(abs(p['xs'] - x))); j = int(np.argmin(abs(p['ys'] - y)))
        return p['idx'](i, j), i, j

    def edge_beam_x(self, name, y, x0, x1, EI, GJ=0.0):
        """Extra beam along x at row nearest y between x0..x1 (adds to the plate's own members)."""
        p = self.plates[name]
        j = int(np.argmin(abs(p['ys'] - y)))
        xs = p['xs']
        sel = [i for i in range(len(xs)) if x0 - 1e-6 <= xs[i] <= x1 + 1e-6]
        for a, b in zip(sel[:-1], sel[1:]):
            L = xs[b] - xs[a]
            n1, n2 = p['idx'](a, j), p['idx'](b, j)
            self.add([n1, n1 + 1, n2, n2 + 1], beam_k(EI, L))
            if GJ:
                self.add([n1 + 2, n2 + 2], GJ / L * np.array([[1, -1], [-1, 1]]))

    def beam_y(self, name, x, y0, y1, EI, GA=None):
        """Extra beam along y (e.g. a divider acting as a deep beam) on the nodes of column x."""
        p = self.plates[name]
        i = int(np.argmin(abs(p['xs'] - x)))
        ys = p['ys']
        sel = [j for j in range(len(ys)) if y0 - 1e-6 <= ys[j] <= y1 + 1e-6]
        for a, b in zip(sel[:-1], sel[1:]):
            L = ys[b] - ys[a]
            n1, n2 = p['idx'](i, a), p['idx'](i, b)
            self.add([n1, n1 + 2, n2, n2 + 2], beam_k(EI, L, GA))

    def spring(self, d1, d2, k):
        if d2 is None:
            self.add([d1], np.array([[k]]))
        else:
            self.add([d1, d2], k * np.array([[1, -1], [-1, 1]]))

    def support_line(self, name, x=None, y=None, w=True, a=False, b=False):
        p = self.plates[name]
        xs, ys = p['xs'], p['ys']
        if x is not None:
            i = int(np.argmin(abs(xs - x)))
            for j in range(len(ys)):
                n = p['idx'](i, j)
                if w: self.fixed.add(n)
                if a: self.fixed.add(n + 1)
                if b: self.fixed.add(n + 2)
        if y is not None:
            j = int(np.argmin(abs(ys - y)))
            for i in range(len(xs)):
                n = p['idx'](i, j)
                if w: self.fixed.add(n)
                if a: self.fixed.add(n + 1)
                if b: self.fixed.add(n + 2)

    def uniform(self, name, q, x0=-1e9, x1=1e9, y0=-1e9, y1=1e9):
        p = self.plates[name]
        for j, y in enumerate(p['ys']):
            for i, x in enumerate(p['xs']):
                if x0 <= x <= x1 and y0 <= y <= y1:
                    self.F[p['idx'](i, j)] += q * p['tx'][i] * p['ty'][j]

    def point(self, name, x, y, P):
        n, _, _ = self.node(name, x, y)
        self.F[n] += P

    def solve(self):
        K = sp.coo_matrix((self.vals, (self.rows, self.cols)), shape=(self.ndof, self.ndof)).tocsr()
        F = np.array(self.F)
        free = np.array([d for d in range(self.ndof) if d not in self.fixed])
        u = np.zeros(self.ndof)
        Kff = K[free][:, free]
        u[free] = spla.spsolve(Kff.tocsc(), F[free])
        self.u = u
        return u

    def w_at(self, name, x, y):
        n, _, _ = self.node(name, x, y)
        return self.u[n]

    def w_row(self, name, y):
        p = self.plates[name]
        j = int(np.argmin(abs(p['ys'] - y)))
        return p['xs'], np.array([self.u[p['idx'](i, j)] for i in range(len(p['xs']))])

    def w_grid(self, name):
        p = self.plates[name]
        W = np.array([[self.u[p['idx'](i, j)] for i in range(len(p['xs']))] for j in range(len(p['ys']))])
        return p['xs'], p['ys'], W


def grid(a, b, h):
    n = max(2, int(round((b - a) / h)))
    return np.linspace(a, b, n + 1)


def merge(*arrs):
    return np.unique(np.round(np.concatenate(arrs), 6))


if __name__ == '__main__':
    # check 1: simply supported square plate, uniform load: w = 0.00406 q a^4 / D (nu = 0)
    a, t, E = 1000.0, 18.0, 8000.0
    D = E * t ** 3 / 12
    G = E / 2
    for h in (50, 25):
        m = Model()
        xs = grid(0, a, h); ys = grid(0, a, h)
        m.plate('p', xs, ys, D, D, G * t ** 3 / 6, G * t ** 3 / 6)
        for x in (0, a): m.support_line('p', x=x)
        for y in (0, a): m.support_line('p', y=y)
        m.uniform('p', 1e-3)
        m.solve()
        wc = m.w_at('p', a / 2, a / 2)
        print(f'SS square h={h}: grillage {wc:.4f}  theory {0.00406 * 1e-3 * a ** 4 / D:.4f}')
    # check 2: plate as a simply supported beam (two edges supported, two free): 5 q a^4 / 384 D
    m = Model(); xs = grid(0, a, 25); ys = grid(0, 400, 25)
    m.plate('p', xs, ys, D, D, G * t ** 3 / 6, G * t ** 3 / 6)
    for x in (0, a): m.support_line('p', x=x)
    m.uniform('p', 1e-3); m.solve()
    print(f'beam strip: grillage {m.w_at("p", a / 2, 200):.4f}  theory {5 * 1e-3 * a ** 4 / (384 * D):.4f}')
