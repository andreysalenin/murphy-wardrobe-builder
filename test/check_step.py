"""Load a STEP file with OpenCASCADE and report solids, validity, volume and bounding box."""
import sys
from OCP.STEPControl import STEPControl_Reader
from OCP.IFSelect import IFSelect_RetDone
from OCP.TopExp import TopExp_Explorer
from OCP.TopAbs import TopAbs_SOLID
from OCP.BRepCheck import BRepCheck_Analyzer
from OCP.GProp import GProp_GProps
from OCP.BRepGProp import BRepGProp
from OCP.Bnd import Bnd_Box
from OCP.BRepBndLib import BRepBndLib

path = sys.argv[1]
r = STEPControl_Reader()
st = r.ReadFile(path)
assert st == IFSelect_RetDone, f"read failed: {st}"
r.TransferRoots()
shape = r.OneShape()
exp = TopExp_Explorer(shape, TopAbs_SOLID)
n = bad = 0
vol = 0.0
neg = 0
while exp.More():
    s = exp.Current()
    n += 1
    if not BRepCheck_Analyzer(s).IsValid():
        bad += 1
    p = GProp_GProps()
    BRepGProp.VolumeProperties_s(s, p)
    v = p.Mass()
    if v <= 0:
        neg += 1
    vol += v
    exp.Next()
b = Bnd_Box()
BRepBndLib.Add_s(shape, b)
m0, m1 = b.CornerMin(), b.CornerMax(); x0, y0, z0, x1, y1, z1 = m0.X(), m0.Y(), m0.Z(), m1.X(), m1.Y(), m1.Z()
print(f"{path}: solids={n} invalid={bad} nonpositive_volume={neg} total_volume_m3={vol/1e9:.4f}")
print(f"bbox x[{x0:.1f},{x1:.1f}] y[{y0:.1f},{y1:.1f}] z[{z0:.1f},{z1:.1f}]")
