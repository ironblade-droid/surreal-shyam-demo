# Surreal Shyam photoreal exterior (phase 1). Run: blender -b -P build_exterior.py
# Coordinates: x = across the front (80' road) face, y = back along the long side (30' road) face, z up. Building at x∈[0,W], y∈[0,D].
import bpy, bmesh, math, random, os
from mathutils import Vector
D_ = bpy.data
OUT = "/workspace/surreal-shyam/ext/exterior.blend"
ASSETS = "/workspace/tour/pano/assets"
random.seed(7)
HDRI_ROT = float(os.environ.get('HDRI_ROT', 60)); HDRI_STR = float(os.environ.get('HDRI_STR', 0.34))

bpy.ops.wm.read_factory_settings(use_empty=True)
scn = bpy.context.scene

W, D = 15.4, 27.0          # plan (data.ts: 15.4 x 40; shortened toward the brochure's slender silhouette)
RC = 1.4                   # plan corner radius
GH, FH, NF = 5.2, 3.2, 7   # ground floor height, floor-to-floor, residential floors
ROOF = GH + NF * FH        # 27.6
BASE = 0.55                # default slab projection
K2700 = (1.0, 0.66, 0.38)

# ----------------------------------------------------------------- materials
def nodes_mat(name):
    m = D_.materials.new(name); m.use_nodes = True
    nt = m.node_tree; p = nt.nodes["Principled BSDF"]; return m, nt, p

def plaster(name, rgb, rough=0.82, bump=0.06, var=0.06, dirt=0.0):
    m, nt, p = nodes_mat(name); N = nt.nodes; L = nt.links
    tc = N.new("ShaderNodeTexCoord")
    nz = N.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 45; nz.inputs["Detail"].default_value = 8
    L.new(tc.outputs["Object"], nz.inputs["Vector"])
    big = N.new("ShaderNodeTexNoise"); big.inputs["Scale"].default_value = 0.35; big.inputs["Detail"].default_value = 3
    L.new(tc.outputs["Object"], big.inputs["Vector"])
    mix = N.new("ShaderNodeMix"); mix.data_type = "RGBA"; mix.blend_type = "MULTIPLY"
    mix.inputs[6].default_value = (*rgb, 1)
    rmp = N.new("ShaderNodeMapRange"); rmp.inputs[3].default_value = 1 - var; rmp.inputs[4].default_value = 1.0
    L.new(big.outputs["Fac"], rmp.inputs[0])
    L.new(rmp.outputs[0], mix.inputs["Factor"]); mix.inputs[7].default_value = (0.93, 0.92, 0.9, 1)
    col = mix.outputs[2]
    if dirt:   # rain streaks (noise stretched vertically) + blotchy weathering
        mp = N.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (5.0, 5.0, 0.35)
        L.new(tc.outputs["Object"], mp.inputs["Vector"])
        st = N.new("ShaderNodeTexNoise"); st.inputs["Scale"].default_value = 2.2; st.inputs["Detail"].default_value = 6
        L.new(mp.outputs[0], st.inputs["Vector"])
        bl = N.new("ShaderNodeTexNoise"); bl.inputs["Scale"].default_value = 1.6; bl.inputs["Detail"].default_value = 10
        L.new(tc.outputs["Object"], bl.inputs["Vector"])
        mm = N.new("ShaderNodeMath"); mm.operation = "MULTIPLY"; L.new(st.outputs["Fac"], mm.inputs[0]); L.new(bl.outputs["Fac"], mm.inputs[1])
        dr = N.new("ShaderNodeMapRange"); dr.inputs[1].default_value = 0.22; dr.inputs[2].default_value = 0.42
        dr.inputs[3].default_value = 1.0; dr.inputs[4].default_value = 1.0 - dirt
        L.new(mm.outputs[0], dr.inputs[0])
        m2 = N.new("ShaderNodeMix"); m2.data_type = "RGBA"; m2.blend_type = "MULTIPLY"; m2.inputs["Factor"].default_value = 1
        L.new(col, m2.inputs[6]); cr = N.new("ShaderNodeCombineColor")
        for k in range(3): L.new(dr.outputs[0], cr.inputs[k])
        L.new(cr.outputs[0], m2.inputs[7]); col = m2.outputs[2]
    L.new(col, p.inputs["Base Color"])
    b = N.new("ShaderNodeBump"); b.inputs["Strength"].default_value = bump; b.inputs["Distance"].default_value = 0.02
    L.new(nz.outputs["Fac"], b.inputs["Height"]); L.new(b.outputs["Normal"], p.inputs["Normal"])
    p.inputs["Roughness"].default_value = rough
    return m

def simple(name, rgb, rough=0.5, metal=0.0, emit=None, estr=0.0):
    m, nt, p = nodes_mat(name)
    p.inputs["Base Color"].default_value = (*rgb, 1); p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metal
    if emit: p.inputs["Emission Color"].default_value = (*emit, 1); p.inputs["Emission Strength"].default_value = estr
    return m

def glass_clear(name, rgb=(0.86, 0.93, 0.92), rough=0.02):
    m, nt, p = nodes_mat(name)
    p.inputs["Base Color"].default_value = (*rgb, 1); p.inputs["Roughness"].default_value = rough
    p.inputs["Transmission Weight"].default_value = 1.0; p.inputs["IOR"].default_value = 1.52
    return m

def textured(name, img, scale, tint=(1, 1, 1), rough=0.5, nor=None):
    m, nt, p = nodes_mat(name); N = nt.nodes; L = nt.links
    tc = N.new("ShaderNodeTexCoord"); mp = N.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (scale,) * 3
    L.new(tc.outputs["Object"], mp.inputs["Vector"])
    it = N.new("ShaderNodeTexImage"); it.image = D_.images.load(img); it.projection = "BOX"; it.projection_blend = 0.2
    L.new(mp.outputs[0], it.inputs["Vector"])
    mix = N.new("ShaderNodeMix"); mix.data_type = "RGBA"; mix.blend_type = "MULTIPLY"; mix.inputs["Factor"].default_value = 1
    L.new(it.outputs["Color"], mix.inputs[6]); mix.inputs[7].default_value = (*tint, 1)
    L.new(mix.outputs[2], p.inputs["Base Color"]); p.inputs["Roughness"].default_value = rough
    if nor:
        nt_ = N.new("ShaderNodeTexImage"); nt_.image = D_.images.load(nor); nt_.image.colorspace_settings.name = "Non-Color"
        nt_.projection = "BOX"; nt_.projection_blend = 0.2; L.new(mp.outputs[0], nt_.inputs["Vector"])
        nm = N.new("ShaderNodeNormalMap"); nm.inputs["Strength"].default_value = 0.6
        L.new(nt_.outputs["Color"], nm.inputs["Color"]); L.new(nm.outputs[0], p.inputs["Normal"])
    return m

def window_glass():
    """dark tinted reflective glass; ~35% of windows glow warm (lit rooms), brighter toward the ceiling"""
    m, nt, p = nodes_mat("WinGlass"); N = nt.nodes; L = nt.links
    p.inputs["Base Color"].default_value = (0.006, 0.007, 0.008, 1); p.inputs["Roughness"].default_value = 0.07
    p.inputs["IOR"].default_value = 1.52; p.inputs["Specular IOR Level"].default_value = 0.16
    geo = N.new("ShaderNodeNewGeometry")
    vor = N.new("ShaderNodeTexVoronoi"); vor.inputs["Scale"].default_value = 0.42; vor.inputs["Randomness"].default_value = 1.0
    L.new(geo.outputs["Position"], vor.inputs["Vector"])
    sep = N.new("ShaderNodeSeparateColor"); L.new(vor.outputs["Color"], sep.inputs[0])
    lit = N.new("ShaderNodeMapRange"); lit.inputs[1].default_value = 0.62; lit.inputs[2].default_value = 0.65
    L.new(sep.outputs[0], lit.inputs[0])
    tint = N.new("ShaderNodeMapRange"); tint.inputs[3].default_value = 0.55; tint.inputs[4].default_value = 1.2
    L.new(sep.outputs[1], tint.inputs[0])
    # height within the storey: (z - GH) mod FH
    sz = N.new("ShaderNodeSeparateXYZ"); L.new(geo.outputs["Position"], sz.inputs[0])
    sub = N.new("ShaderNodeMath"); sub.operation = "SUBTRACT"; sub.inputs[1].default_value = GH
    L.new(sz.outputs["Z"], sub.inputs[0])
    md = N.new("ShaderNodeMath"); md.operation = "FLOORED_MODULO"; md.inputs[1].default_value = FH
    L.new(sub.outputs[0], md.inputs[0])
    gr = N.new("ShaderNodeMapRange"); gr.inputs[1].default_value = 0.3; gr.inputs[2].default_value = 2.5
    gr.inputs[3].default_value = 0.35; gr.inputs[4].default_value = 1.0
    L.new(md.outputs[0], gr.inputs[0])
    m1 = N.new("ShaderNodeMath"); m1.operation = "MULTIPLY"; L.new(lit.outputs[0], m1.inputs[0]); L.new(gr.outputs[0], m1.inputs[1])
    m2 = N.new("ShaderNodeMath"); m2.operation = "MULTIPLY"; L.new(m1.outputs[0], m2.inputs[0]); L.new(tint.outputs[0], m2.inputs[1])
    m3 = N.new("ShaderNodeMath"); m3.name = "EmitStr"; m3.operation = "MULTIPLY"; m3.inputs[1].default_value = 3.2
    L.new(m2.outputs[0], m3.inputs[0]); L.new(m3.outputs[0], p.inputs["Emission Strength"])
    p.inputs["Emission Color"].default_value = (1.0, 0.56, 0.26, 1)
    return m

def asphalt():
    m, nt, p = nodes_mat("Asphalt"); N = nt.nodes; L = nt.links
    tc = N.new("ShaderNodeTexCoord")
    n1 = N.new("ShaderNodeTexNoise"); n1.inputs["Scale"].default_value = 220; n1.inputs["Detail"].default_value = 4
    n2 = N.new("ShaderNodeTexNoise"); n2.inputs["Scale"].default_value = 0.6; n2.inputs["Detail"].default_value = 6
    for n in (n1, n2): L.new(tc.outputs["Object"], n.inputs["Vector"])
    r = N.new("ShaderNodeValToRGB"); r.color_ramp.elements[0].color = (0.035, 0.036, 0.038, 1); r.color_ramp.elements[1].color = (0.085, 0.084, 0.082, 1)
    mx = N.new("ShaderNodeMath"); mx.operation = "MULTIPLY_ADD"; mx.inputs[1].default_value = 0.5
    L.new(n1.outputs["Fac"], mx.inputs[0]); L.new(n2.outputs["Fac"], mx.inputs[2])
    L.new(mx.outputs[0], r.inputs[0]); L.new(r.outputs[0], p.inputs["Base Color"])
    rr = N.new("ShaderNodeMapRange"); rr.inputs[3].default_value = 0.55; rr.inputs[4].default_value = 0.9
    L.new(n2.outputs["Fac"], rr.inputs[0]); L.new(rr.outputs[0], p.inputs["Roughness"])
    b = N.new("ShaderNodeBump"); b.inputs["Strength"].default_value = 0.35; b.inputs["Distance"].default_value = 0.01
    L.new(n1.outputs["Fac"], b.inputs["Height"]); L.new(b.outputs[0], p.inputs["Normal"])
    return m

def paving(name, c1, c2, mortar, sx=0.6, sy=0.3):
    m, nt, p = nodes_mat(name); N = nt.nodes; L = nt.links
    tc = N.new("ShaderNodeTexCoord")
    br = N.new("ShaderNodeTexBrick"); br.inputs["Scale"].default_value = 1.0
    br.inputs["Brick Width"].default_value = sx; br.inputs["Row Height"].default_value = sy
    br.inputs["Mortar Size"].default_value = 0.008; br.offset = 0.5
    br.inputs["Color1"].default_value = (*c1, 1); br.inputs["Color2"].default_value = (*c2, 1); br.inputs["Mortar"].default_value = (*mortar, 1)
    L.new(tc.outputs["Object"], br.inputs["Vector"])
    L.new(br.outputs["Color"], p.inputs["Base Color"]); p.inputs["Roughness"].default_value = 0.75
    b = N.new("ShaderNodeBump"); b.inputs["Strength"].default_value = 0.4; b.inputs["Distance"].default_value = 0.005
    L.new(br.outputs["Fac"], b.inputs["Height"]); b.invert = True; L.new(b.outputs[0], p.inputs["Normal"])
    return m

M = {
    "white": plaster("BandWhite", (0.80, 0.78, 0.74), 0.75, 0.05, 0.05, dirt=0.18),
    "wall": plaster("WallGrey", (0.40, 0.37, 0.33), 0.88, 0.09, 0.07, dirt=0.22),
    "wood": textured("SoffitWood", f"{ASSETS}/textures/american_walnut_veneer/american_walnut_veneer_diff_2k.jpg", 0.6, (1.0, 0.82, 0.68), 0.5),
    "balc": simple("BalconyFloor", (0.42, 0.39, 0.35), 0.45),
    "win": window_glass(),
    "rail": glass_clear("RailGlass", (0.80, 0.90, 0.88), 0.01),
    "store": glass_clear("StoreGlass", (0.88, 0.94, 0.93), 0.01),
    "frame": simple("DarkFrame", (0.022, 0.022, 0.024), 0.35, 0.85),
    "louvre": simple("Louvre", (0.05, 0.05, 0.055), 0.45, 0.6),
    "clad": simple("DarkCladding", (0.03, 0.028, 0.026), 0.3),
    "core": simple("CoreDark", (0.03, 0.03, 0.03), 0.8),
    "asph": asphalt(),
    "pave": paving("Paving", (0.50, 0.47, 0.42), (0.46, 0.43, 0.39), (0.30, 0.29, 0.27)),
    "walk": paving("Sidewalk", (0.38, 0.36, 0.34), (0.34, 0.32, 0.30), (0.22, 0.21, 0.2), 0.4, 0.4),
    "kerb": plaster("Kerb", (0.42, 0.41, 0.39), 0.8, 0.1, 0.1),
    "mark": simple("RoadMark", (0.75, 0.75, 0.72), 0.6),
    "soil": simple("Soil", (0.05, 0.035, 0.025), 0.95),
    "ground": plaster("Ground", (0.12, 0.11, 0.095), 0.95, 0.2, 0.2),
    "ceil": simple("LobbyCeiling", (0.75, 0.72, 0.68), 0.6),
    "lfloor": simple("LobbyFloor", (0.55, 0.50, 0.45), 0.12),
    "ipanel": textured("InteriorWood", f"{ASSETS}/textures/american_walnut_veneer/american_walnut_veneer_diff_2k.jpg", 0.8, (1, 0.9, 0.8), 0.4),
    "lightpanel": simple("LightPanel", (1, 1, 1), 0.5, 0, (1.0, 0.82, 0.60), 32.0),
    "downlight": simple("Downlight", (1, 1, 1), 0.5, 0, (1.0, 0.75, 0.48), 40.0),
    "gold": simple("SignGold", (0.8, 0.6, 0.3), 0.3, 0.8, (1.0, 0.72, 0.38), 8.0),
    "signw": simple("SignWhite", (1, 1, 1), 0.4, 0, (1.0, 0.93, 0.82), 14.0),
    "lamp": simple("LampHead", (1, 1, 1), 0.5, 0, (1.0, 0.8, 0.55), 30.0),
    "pole": simple("Pole", (0.06, 0.06, 0.065), 0.4, 0.7),
    "neigh": plaster("NeighbourWall", (0.20, 0.18, 0.16), 0.9, 0.1, 0.15),
    "far": plaster("FarBlocks", (0.22, 0.21, 0.2), 0.9, 0.1, 0.2),
}

# ----------------------------------------------------------------- geometry accumulators (one mesh per material)
ACC = {}
def acc(key):
    return ACC.setdefault(key, ([], []))

def quad_mesh(key, rings, closed=True, cap=False):
    """rings: list of point lists (equal length); builds quads between consecutive rings (and last->first if closed)"""
    V, F = acc(key); b = len(V); n = len(rings[0]); R = len(rings)
    for r in rings: V.extend(r)
    rr = range(R) if closed else range(R - 1)
    for j in rr:
        j2 = (j + 1) % R
        for i in range(n - (0 if closed else 1)) if False else range(n):
            i2 = (i + 1) % n
            F.append((b + j * n + i, b + j * n + i2, b + j2 * n + i2, b + j2 * n + i))

def ribbon(key, pts_lo, pts_hi):
    """open strip between two polylines (same length)"""
    V, F = acc(key); b = len(V); n = len(pts_lo)
    V.extend(pts_lo); V.extend(pts_hi)
    for i in range(n - 1):
        F.append((b + i, b + i + 1, b + n + i + 1, b + n + i))

def obox(key, O, t, n, s0, s1, d0, d1, z0, z1):
    """box in a face frame: s along tangent t, d along outward normal n, z up"""
    V, F = acc(key); b = len(V)
    for (s, d, z) in [(s0, d0, z0), (s1, d0, z0), (s1, d1, z0), (s0, d1, z0), (s0, d0, z1), (s1, d0, z1), (s1, d1, z1), (s0, d1, z1)]:
        V.append((O[0] + t[0] * s + n[0] * d, O[1] + t[1] * s + n[1] * d, z))
    F.extend([(b, b + 3, b + 2, b + 1), (b + 4, b + 5, b + 6, b + 7), (b, b + 1, b + 5, b + 4),
              (b + 1, b + 2, b + 6, b + 5), (b + 2, b + 3, b + 7, b + 6), (b + 3, b, b + 4, b + 7)])

def abox(key, x0, x1, y0, y1, z0, z1):
    obox(key, (0, 0), (1, 0), (0, -1), x0, x1, -y1, -y0, z0, z1)

def finish(name, key, mat, bevel=0.0, smooth=False, solidify=0.0, recalc=True):
    V, F = ACC[key]
    me = D_.meshes.new(name); me.from_pydata(V, [], F); me.validate()
    o = D_.objects.new(name, me); scn.collection.objects.link(o); me.materials.append(mat)
    if recalc:
        bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    if smooth:
        for p in me.polygons: p.use_smooth = True
        bm = bmesh.new(); bm.from_mesh(me)
        for e in bm.edges:
            if len(e.link_faces) == 2 and e.calc_face_angle(0) > math.radians(35): e.smooth = False
        bm.to_mesh(me); bm.free()
    if bevel:
        md = o.modifiers.new("bev", "BEVEL"); md.width = bevel; md.segments = 3; md.limit_method = "ANGLE"
        md.angle_limit = math.radians(35); md.harden_normals = smooth
    if solidify:
        md = o.modifiers.new("sol", "SOLIDIFY"); md.thickness = solidify; md.offset = 0
    return o

# ----------------------------------------------------------------- plan outline
FACES = {  # O, tangent, normal, length  (counter-clockwise)
    "F": ((0, 0), (1, 0), (0, -1), W),
    "E": ((W, 0), (0, 1), (1, 0), D),
    "B": ((W, D), (-1, 0), (0, 1), W),
    "S": ((0, D), (0, -1), (-1, 0), D),   # long 30'-road face; s runs from the rear (s=0) to the front corner (s=D)
}
ORDER = ["F", "E", "B", "S"]

def outline(step=0.3, nc=12):
    P = []
    for k, f in enumerate(ORDER):
        O, t, n, L = FACES[f]
        m = max(2, int(round((L - 2 * RC) / step)))
        for i in range(m):
            s = RC + (L - 2 * RC) * i / m
            P.append(dict(x=O[0] + t[0] * s, y=O[1] + t[1] * s, nx=n[0], ny=n[1], f=f, s=s))
        C = (O[0] + t[0] * (L - RC) - n[0] * RC, O[1] + t[1] * (L - RC) - n[1] * RC)
        for i in range(nc):
            a = (math.pi / 2) * i / nc
            mx, my = math.cos(a) * n[0] + math.sin(a) * t[0], math.cos(a) * n[1] + math.sin(a) * t[1]
            P.append(dict(x=C[0] + RC * mx, y=C[1] + RC * my, nx=mx, ny=my, f="C", s=0.0))
    return P
OUTL = outline()

def sstep(a, b, v):
    t = min(1.0, max(0.0, (v - a) / (b - a))); return t * t * (3 - 2 * t)

BALC = [(1.9, 6.6), (9.0, 13.6)]   # front/back balcony boxes (s ranges)
BAY_D = 1.35   # recessed balcony bays on the long faces
def bay_centres(face, fl):
    ph = (fl * 2.2) % 6.6 if face == "S" else (fl * 1.7 + 2.0) % 6.6
    return [4.8 + ph * 0.55, 14.2 + ph * 0.55]

# band projection per face and floor: (s0, s1, depth, transition)
def bumps(face, fl):
    if face in ("F", "B"):
        return []                                                          # flat wall; boxy balconies are hung on it separately
    return [(c - 1.7, c + 1.7, 0.45, 2.4) for c in bay_centres(face, fl)]  # gentle swell over each recessed bay

def bump_at(face, s, fl):
    if face == "C": return 0.0
    v = 0.0
    for (a, b, d, tw) in bumps(face, fl):
        v = max(v, d * sstep(a - tw, a, s) * (1 - sstep(b, b + tw, s)))
    return v

def off_at(p, fl): return BASE + bump_at(p["f"], p["s"], fl)

def thick_at(p, fl):
    """thin flat bands; the lower edge lifts gently over the recessed bays (the brochure's soft arches)"""
    if p["f"] in ("S", "E"):
        bn = bump_at(p["f"], p["s"], fl) / 0.45
        return 0.46 - 0.14 * bn
    return 0.40

# ----------------------------------------------------------------- slabs (bands, brown soffits)
def slab(fl, ztop, top_extra=0.05, roof=False):
    rings = {k: [] for k in ("ot", "ob", "ib", "it")}
    for p in OUTL:
        o = off_at(p, fl) if not roof else BASE + 0.1
        th = thick_at(p, fl) if not roof else 0.6
        ox, oy = p["x"] + p["nx"] * o, p["y"] + p["ny"] * o
        ix, iy = p["x"] - p["nx"] * 0.7, p["y"] - p["ny"] * 0.7
        rings["ot"].append((ox, oy, ztop + top_extra)); rings["ob"].append((ox, oy, ztop - th))
        rings["ib"].append((ix, iy, ztop - 0.30)); rings["it"].append((ix, iy, ztop + top_extra))
    quad_mesh("band", [rings["ot"], rings["ob"]], closed=False)
    quad_mesh("soffit", [rings["ob"], rings["ib"]], closed=False)
    quad_mesh("balc", [rings["it"], rings["ot"]], closed=False)
    quad_mesh("band", [rings["ib"], rings["it"]], closed=False)
    return rings

def zfl(fl): return GH + (fl - 1) * FH     # slab-top level of residential floor fl (1..7); fl=8 -> roof

for fl in range(1, NF + 1):
    slab(fl, zfl(fl))
slab(NF + 1, ROOF, top_extra=0.6, roof=True)

# ----------------------------------------------------------------- core (deep inside, so it never pokes through the rounded corners) + skin
Z_CORE0 = GH - 0.30
abox("core", 1.7, W - 1.7, 1.7, D - 1.7, Z_CORE0, ROOF)
def cyl(key, cx, cy, r, z0, z1, n=40):
    lo = [(cx + r * math.cos(2 * math.pi * i / n), cy + r * math.sin(2 * math.pi * i / n), z0) for i in range(n)]
    hi = [(x, y, z1) for (x, y, _) in lo]
    quad_mesh(key, [lo, hi], closed=False)
    V, F = acc(key); b = len(V); V.extend(lo); F.append(tuple(range(b, b + n))[::-1]); b = len(V); V.extend(hi); F.append(tuple(range(b, b + n)))
for (cx, cy) in [(RC, RC), (W - RC, RC), (W - RC, D - RC), (RC, D - RC)]:
    cyl("wall", cx, cy, RC, Z_CORE0, ROOF)
abox("wall", RC, W - RC, RC, D - RC, Z_CORE0, Z_CORE0 + 0.01)

WALL_T = 0.24
def openings(face, fl):
    O, t, n, L = FACES[face]; res = []
    if face in ("F", "B"):
        for (a, b) in BALC:
            c = (a + b) / 2; res.append((c - 1.6, c + 1.6, "door"))
    else:
        for c in bay_centres(face, fl):
            res.append((c - 1.6, c + 1.6, "bay"))
    s = RC + 1.3; k = fl
    while s < L - RC - 1.0:
        if all(s + 0.9 < a - 0.45 or s - 0.9 > b + 0.45 for (a, b, _) in res):
            kind = "louvre" if (k % 2 == 0 and face in ("S", "E")) else "win"
            w = 1.35 if kind == "win" else 1.6
            res.append((s - w / 2, s + w / 2, kind)); k += 1
        s += 2.6 if face in ("S", "E") else 3.0
    return sorted(res)

def window_unit(face, s0, s1, z0, z1, mullions=1, gd=-0.13):
    O, t, n, L = FACES[face]
    obox("win", O, t, n, s0, s1, gd - 0.012, gd, z0, z1)
    fw = 0.05
    for (a, b, c, d) in [(s0, s0 + fw, z0, z1), (s1 - fw, s1, z0, z1), (s0, s1, z0, z0 + fw), (s0, s1, z1 - fw, z1)]:
        obox("frame", O, t, n, a, b, gd - 0.03, gd + 0.03, c, d)
    for i in range(1, mullions + 1):
        sm = s0 + (s1 - s0) * i / (mullions + 1)
        obox("frame", O, t, n, sm - 0.025, sm + 0.025, gd - 0.03, gd + 0.03, z0, z1)

LIGHTS = []
for fl in range(1, NF + 1):
    zb = zfl(fl) + 0.05; zt = (zfl(fl + 1) if fl < NF else ROOF) - 0.30
    for face in ORDER:
        O, t, n, L = FACES[face]
        cur = RC
        for (a, b, kind) in openings(face, fl):
            a = max(a, RC + 0.05); b = min(b, L - RC - 0.05)
            if a > cur: obox("wall", O, t, n, cur, a, -WALL_T, 0, zb, zt)
            if kind == "bay":      # recessed balcony: returns, back glazing, wood ceiling, floor, downlights
                obox("wall", O, t, n, a, a + 0.18, -BAY_D, 0, zb, zt); obox("wall", O, t, n, b - 0.18, b, -BAY_D, 0, zb, zt)
                window_unit(face, a + 0.18, b - 0.18, zb, zb + 2.5, mullions=2, gd=-BAY_D + 0.02)
                obox("wall", O, t, n, a + 0.18, b - 0.18, -BAY_D - 0.1, -BAY_D + 0.05, zb + 2.5, zt)
                obox("soffit", O, t, n, a, b, -BAY_D, -0.5, zt - 0.03, zt)
                obox("balc", O, t, n, a, b, -BAY_D, -0.5, zb - 0.05, zb)
                for sc in (a + 0.8, b - 0.8):
                    x, y = O[0] + t[0] * sc + n[0] * (-BAY_D * 0.55), O[1] + t[1] * sc + n[1] * (-BAY_D * 0.55)
                    LIGHTS.append((x, y, zt - 0.04))
            elif kind == "door":
                window_unit(face, a, b, zb, zb + 2.5, mullions=2)
                obox("wall", O, t, n, a, b, -WALL_T, 0, zb + 2.5, zt)
            else:
                oz0, oz1 = zb + 0.5, zb + 2.4
                window_unit(face, a, b, oz0, oz1, mullions=1)
                obox("wall", O, t, n, a, b, -WALL_T, 0, zb, oz0); obox("wall", O, t, n, a, b, -WALL_T, 0, oz1, zt)
            if kind == "louvre":   # tall dark vertical louvre panel standing proud of the facade
                fs = a - 0.1
                while fs < b + 0.1:
                    obox("louvre", O, t, n, fs, fs + 0.035, 0.06, 0.2, zb, zt); fs += 0.09
                obox("louvre", O, t, n, a - 0.14, a - 0.1, 0.02, 0.22, zb, zt); obox("louvre", O, t, n, b + 0.1, b + 0.14, 0.02, 0.22, zb, zt)
            cur = b
        if cur < L - RC: obox("wall", O, t, n, cur, L - RC, -WALL_T, 0, zb, zt)

# ----------------------------------------------------------------- balcony glass rails + soffit downlights
for fl in range(1, NF + 1):
    z = zfl(fl) + 0.05
    run_lo, run_hi = [], []
    def flush():
        global run_lo, run_hi
        if len(run_lo) > 1: ribbon("rail", run_lo, run_hi)
        run_lo, run_hi = [], []
    for p in OUTL + [OUTL[0]]:
        o = off_at(p, fl); thr = 0.32 if p["f"] in ("S", "E") else 0.75
        if o > BASE + thr:
            x, y = p["x"] + p["nx"] * (o - 0.08), p["y"] + p["ny"] * (o - 0.08)
            run_lo.append((x, y, z + 0.02)); run_hi.append((x, y, z + 1.05))
        else:
            flush()
    flush()
    if fl < NF:
        zs = zfl(fl + 1) - 0.30; last = -9
        for i, p in enumerate(OUTL):
            if p["f"] in ("F", "B") and off_at(p, fl + 1) > BASE + 0.7 and i - last > 6:
                last = i; o = off_at(p, fl + 1)
                LIGHTS.append((p["x"] + p["nx"] * (o * 0.55), p["y"] + p["ny"] * (o * 0.55), zs - 0.03))
# boxy balconies hung on the flat front/back walls: white slab box, white side frames, frameless glass on three sides
BDP = BASE + 1.35
for fl in range(1, NF + 1):
    z = zfl(fl); ztop = (zfl(fl + 1) if fl < NF else ROOF) - 0.38
    for face in ("F", "B"):
        O, t, n, L = FACES[face]
        for (a, b) in BALC:
            obox("band", O, t, n, a - 0.18, b + 0.18, BASE - 0.05, BDP, z - 0.38, z + 0.05)
            obox("band", O, t, n, a - 0.18, a, BASE - 0.05, BDP, z + 0.05, ztop)
            obox("band", O, t, n, b, b + 0.18, BASE - 0.05, BDP, z + 0.05, ztop)
            pts = [(a + 0.02, BDP - 0.06), (b - 0.02, BDP - 0.06)]
            lo = [(O[0] + t[0] * ss + n[0] * dd, O[1] + t[1] * ss + n[1] * dd, z + 0.07) for ss, dd in pts]
            ribbon("rail", lo, [(x, y, z + 1.08) for x, y, _ in lo])
            if fl < NF:
                for sc in (a + 1.1, b - 1.1):
                    dc = (BASE + BDP) / 2
                    LIGHTS.append((O[0] + t[0] * sc + n[0] * dc, O[1] + t[1] * sc + n[1] * dc, zfl(fl + 1) - 0.38 - 0.03))
            else:
                for sc in (a + 1.1, b - 1.1):
                    dc = (BASE + BDP) / 2
                    LIGHTS.append((O[0] + t[0] * sc + n[0] * dc, O[1] + t[1] * sc + n[1] * dc, ROOF - 0.38 - 0.03))
        # cap over the top floor balconies
    if fl == NF:
        for face in ("F", "B"):
            O, t, n, L = FACES[face]
            for (a, b) in BALC:
                obox("band", O, t, n, a - 0.18, b + 0.18, BASE - 0.05, BDP, ROOF - 0.38, ROOF + 0.6)
for (x, y, z) in LIGHTS:
    abox("downlight", x - 0.06, x + 0.06, y - 0.06, y + 0.06, z - 0.01, z + 0.02)

# ----------------------------------------------------------------- crown: smooth curved parapet + sloped louvre screens rising above it
zr = ROOF + 0.6
def crown_h(p):
    if p["f"] == "C": return 1.5
    s, L = p["s"], FACES[p["f"]][3]
    rise = 1 - sstep(RC, RC + 4.0, s) * (1 - sstep(L - RC - 4.0, L - RC, s))
    return 0.35 + 1.15 * rise
co, ci, ct, cit = [], [], [], []
for p in OUTL:
    o = BASE + 0.1; h = crown_h(p)
    co.append((p["x"] + p["nx"] * o, p["y"] + p["ny"] * o, zr - 0.02)); ct.append((p["x"] + p["nx"] * o, p["y"] + p["ny"] * o, zr + h))
    ci.append((p["x"] + p["nx"] * (o - 0.28), p["y"] + p["ny"] * (o - 0.28), zr - 0.02)); cit.append((p["x"] + p["nx"] * (o - 0.28), p["y"] + p["ny"] * (o - 0.28), zr + h))
quad_mesh("band", [co, ct, cit, ci], closed=True)
def slat(key, O, t, n, s0, s1, d0, z0, d1, z1, th=0.05):
    V, F = acc(key); b = len(V)
    for (s, d, z) in [(s0, d0, z0), (s1, d0, z0), (s1, d1, z1), (s0, d1, z1), (s0, d0, z0 + th), (s1, d0, z0 + th), (s1, d1, z1 + th), (s0, d1, z1 + th)]:
        V.append((O[0] + t[0] * s + n[0] * d, O[1] + t[1] * s + n[1] * d, z))
    F.extend([(b, b + 3, b + 2, b + 1), (b + 4, b + 5, b + 6, b + 7), (b, b + 1, b + 5, b + 4),
              (b + 1, b + 2, b + 6, b + 5), (b + 2, b + 3, b + 7, b + 6), (b + 3, b, b + 4, b + 7)])
for face in ORDER:
    O, t, n, L = FACES[face]
    a, b = RC + 2.4, L - RC - 2.4
    s = a
    while s < b:
        slat("louvre", O, t, n, s, s + 0.07, -0.30, zr + 0.1, -1.9, zr + 4.6, th=0.09); s += 0.22
    obox("louvre", O, t, n, a - 0.1, b + 0.1, -2.05, -1.8, zr + 4.5, zr + 4.8)       # top beam
    for sp in (a - 0.1, (a + b) / 2, b):
        obox("louvre", O, t, n, sp, sp + 0.1, -2.0, -1.85, zr, zr + 4.6)                # posts
abox("louvre", 0.6, W - 0.6, 0.6, D - 0.6, zr - 0.05, zr)   # roof deck

# ----------------------------------------------------------------- ground floor: double-height glass retail / lobby
gi = []  # storefront outline inset
for p in OUTL:
    gi.append((p["x"] - p["nx"] * 0.35, p["y"] - p["ny"] * 0.35))
ribbon("store", [(x, y, 0.12) for x, y in gi] + [(gi[0][0], gi[0][1], 0.12)],
       [(x, y, Z_CORE0) for x, y in gi] + [(gi[0][0], gi[0][1], Z_CORE0)])
# mullions, transom, sign band, dark cladding piers
for i, p in enumerate(OUTL):
    if i % 5 == 0:
        x, y = p["x"] - p["nx"] * 0.33, p["y"] - p["ny"] * 0.33
        t = (-p["ny"], p["nx"])
        obox("frame", (x, y), t, (p["nx"], p["ny"]), -0.04, 0.04, -0.08, 0.06, 0.12, Z_CORE0)
    if i % 25 == 0 and p["f"] != "C":
        x, y = p["x"], p["y"]; t = (-p["ny"], p["nx"])
        obox("clad", (x, y), t, (p["nx"], p["ny"]), -0.35, 0.35, -0.3, 0.12, 0.0, Z_CORE0)
for z0, z1, key, dd in ((3.30, 3.40, "frame", 0.28), (3.55, 4.40, "clad", 0.22)):
    lo = [(p["x"] - p["nx"] * dd, p["y"] - p["ny"] * dd, z0) for p in OUTL]; lo.append(lo[0])
    hi = [(x, y, z1) for (x, y, _) in lo]
    ri = [(p["x"] - p["nx"] * (dd + 0.12), p["y"] - p["ny"] * (dd + 0.12), z1) for p in OUTL]; ri.append(ri[0])
    rb = [(x, y, z0) for (x, y, _) in ri]
    quad_mesh(key, [lo, hi, ri, rb], closed=True)
abox("clad", -0.1, W + 0.1, -0.1, D + 0.1, -0.05, 0.12)       # plinth
# lobby interior
abox("lfloor", 0.4, W - 0.4, 0.4, D - 0.4, 0.12, 0.13)
abox("ceil", 0.3, W - 0.3, 0.3, D - 0.3, Z_CORE0 - 0.05, Z_CORE0)
abox("ipanel", 5.0, W - 5.0, 6.0, D - 6.0, 0.12, Z_CORE0 - 0.05)    # inner wood-clad core
for x in (2.0, W / 2, W - 2.0):
    abox("lightpanel", x - 0.6, x + 0.6, 1.0, D - 1.0, Z_CORE0 - 0.07, Z_CORE0 - 0.05)
for y in (2.0, D / 2, D - 2.0):
    abox("lightpanel", 1.0, W - 1.0, y - 0.6, y + 0.6, Z_CORE0 - 0.07, Z_CORE0 - 0.05)
# a few display counters / planters inside so the glass isn't empty
for (x0, y0) in ((2.0, 3.0), (2.0, 10.0), (2.0, 18.0), (2.0, 26.0), (8.0, 2.0), (11.5, 2.0)):
    abox("clad", x0, x0 + 1.6, y0, y0 + 0.8, 0.12, 1.0)
    abox("lightpanel", x0 + 0.1, x0 + 1.5, y0 + 0.1, y0 + 0.7, 1.0, 1.02)
# entrance canopy + signage on the front face
abox("band", 4.4, 11.0, -2.2, 0.0, 4.2, 4.5)
abox("downlight", 5.0, 5.2, -1.2, -1.0, 4.18, 4.2); abox("downlight", 10.2, 10.4, -1.2, -1.0, 4.18, 4.2)

# ----------------------------------------------------------------- site: setback paving, planter wall, sidewalks, roads, markings
SB = 3.0
abox("pave", -SB, W + SB + 6, -SB, D + SB, 0.0, 0.08)
abox("kerb", -SB - 0.4, -SB, -SB - 0.4, D + SB, 0.0, 0.7)            # compound / planter wall along the side road
abox("kerb", -SB - 0.4, 4.0, -SB - 0.4, -SB, 0.0, 0.7)               # along the front (gap for the entrance)
abox("kerb", 11.4, W + SB + 6, -SB - 0.4, -SB, 0.0, 0.7)
abox("kerb", -SB + 0.35, -SB + 0.5, -SB + 0.35, D + SB, 0.0, 0.62)
abox("soil", -SB, -SB + 0.35, -SB, D + SB, 0.0, 0.62)
abox("soil", -SB, 4.0, -SB, -SB + 0.35, 0.0, 0.62); abox("soil", 11.4, W + SB + 6, -SB, -SB + 0.35, 0.0, 0.62)
# sidewalks (raised) with kerbs
abox("walk", -SB - 3.5, W + 60, -SB - 3.5, -SB - 0.4, 0.0, 0.16)
abox("walk", -SB - 3.5, -SB - 0.4, -SB - 0.4, 120, 0.0, 0.16)
abox("kerb", -SB - 3.7, W + 60, -SB - 3.7, -SB - 3.5, 0.0, 0.17)
abox("kerb", -SB - 3.7, -SB - 3.5, -SB - 3.5, 120, 0.0, 0.17)
R30 = (-SB - 3.7 - 9.1, -SB - 3.7)            # 30' road (x range)
R80 = (-SB - 3.7 - 24.4, -SB - 3.7)           # 80' road (y range)
abox("asph", -160, 160, R80[0], R80[1], -0.02, 0.0)
abox("asph", R30[0], R30[1], R80[1], 160, -0.02, 0.0)
# far sidewalks
abox("walk", -160, 160, R80[0] - 3.5, R80[0], 0.0, 0.16)
abox("walk", R30[0] - 3.5, R30[0], R80[1], 160, 0.0, 0.16)
abox("ground", -400, 400, -400, 400, -0.06, -0.03)
# lane markings on the 80' road: centre median line + dashed lanes; zebra across the 30' road mouth
yc = (R80[0] + R80[1]) / 2
abox("mark", -160, 160, yc - 0.18, yc - 0.06, 0.0, 0.004); abox("mark", -160, 160, yc + 0.06, yc + 0.18, 0.0, 0.004)
for yl in (yc - 6.1, yc + 6.1):
    x = -160
    while x < 160:
        abox("mark", x, x + 3.0, yl - 0.07, yl + 0.07, 0.0, 0.004); x += 9.0
for yl in (R80[0] + 0.5, R80[1] - 0.5):
    abox("mark", -160, 160, yl - 0.07, yl + 0.07, 0.0, 0.004)
x = R30[0] + 0.6
while x < R30[1] - 0.6:
    abox("mark", x, x + 0.5, R80[1] - 4.5, R80[1] - 0.8, 0.0, 0.004); x += 1.0
xc = (R30[0] + R30[1]) / 2
y = R80[1] + 2
while y < 160:
    abox("mark", xc - 0.07, xc + 0.07, y, y + 3.0, 0.0, 0.004); y += 9.0
# neighbours / background
abox("neigh", W + SB + 6.5, W + SB + 6.8, -SB, D + SB, 0.0, 2.0)   # side boundary wall to the neighbouring plot (a tall block filled the orbit frames)
abox("far", -110, -70, 25, 60, 0.0, 10.0)
abox("far", 70, 100, 40, 70, 0.0, 16.0)
abox("kerb", -SB, W + SB + 6, D + SB, D + SB + 0.25, 0.0, 1.9)   # rear boundary wall
abox("far", -60, -30, 90, 120, 0.0, 12.0)

# street lamps
LAMPS = []
for x in (-38.0, -14.0, 10.0, 34.0):
    LAMPS.append((x, -SB - 3.0, 0))
for y in (8.0, 30.0):
    LAMPS.append((-SB - 3.0, y, 1))
for (x, y, ax) in LAMPS:
    abox("pole", x - 0.08, x + 0.08, y - 0.08, y + 0.08, 0.16, 8.0)
    if ax == 0: abox("pole", x - 0.05, x + 0.05, y - 1.6, y, 7.85, 8.0); hx, hy = x, y - 1.5
    else: abox("pole", x - 1.6, x, y - 0.05, y + 0.05, 7.85, 8.0); hx, hy = x - 1.5, y
    abox("lamp", hx - 0.3, hx + 0.3, hy - 0.15, hy + 0.15, 7.78, 7.85)
    LIGHTS.append((hx, hy, 7.7, "street"))

# ----------------------------------------------------------------- build meshes
finish("Bands", "band", M["white"], bevel=0.05, smooth=True)
finish("Soffits", "soffit", M["wood"], smooth=True)
finish("BalconyFloors", "balc", M["balc"])
finish("Core", "core", M["core"])
finish("Walls", "wall", M["wall"], bevel=0.015)
finish("WindowGlass", "win", M["win"])
finish("Frames", "frame", M["frame"])
finish("Louvres", "louvre", M["louvre"])
finish("RailGlass", "rail", M["rail"], solidify=0.014, recalc=False)
finish("StoreGlass", "store", M["store"], solidify=0.012, recalc=False)
finish("Cladding", "clad", M["clad"], bevel=0.01)
for k in ("downlight", "lfloor", "ceil", "ipanel", "lightpanel", "asph", "pave", "walk", "kerb", "mark", "soil", "ground", "neigh", "far", "pole", "lamp"):
    finish(k.capitalize(), k, M[k], bevel=0.01 if k in ("kerb",) else 0.0)

# signage text
def sign(txt, loc, rot_z, size):
    cu = D_.curves.new("sign", "FONT"); cu.body = txt; cu.size = size; cu.align_x = "CENTER"; cu.align_y = "CENTER"; cu.extrude = 0.01
    for f in ("/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",):
        if os.path.exists(f): cu.font = D_.fonts.load(f)
    o = D_.objects.new("Sign", cu); scn.collection.objects.link(o)
    o.location = loc; o.rotation_euler = (math.radians(90), 0, rot_z); o.data.materials.append(M["gold"]); return o
sign("SURREAL  SHYAM", (W / 2, -2.25, 4.35), 0, 0.55)
for (txt, sv, sz) in (("SURREAL SHYAM", 6.0, 0.62), ("ATELIER", 12.5, 0.72), ("CAFÉ AROMA", 18.4, 0.66), ("LUXE HOME", 23.8, 0.66)):
    o = sign(txt, (0.02, D - sv, 3.98), -math.pi / 2, sz)
    o.data.materials[0] = M["signw"] if txt != "SURREAL SHYAM" else M["gold"]
# warm cove strip washing the storefront glass from under the sign band
for p in OUTL[::2]:
    pass
LOBBY_SIGN = True

# ----------------------------------------------------------------- lights
def add_light(name, kind, loc, energy, rgb, **kw):
    ld = D_.lights.new(name, kind); ld.energy = energy; ld.color = rgb
    for k, v in kw.items(): setattr(ld, k, v)
    o = D_.objects.new(name, ld); o.location = loc; scn.collection.objects.link(o); return o
for i, L_ in enumerate(LIGHTS):
    if len(L_) == 3:
        add_light(f"DL{i}", "SPOT", L_, 45, K2700, spot_size=math.radians(110), spot_blend=0.8, shadow_soft_size=0.03)
    else:
        add_light(f"ST{i}", "SPOT", L_[:3], 900, (1.0, 0.78, 0.52), spot_size=math.radians(120), spot_blend=0.6, shadow_soft_size=0.15)
# lobby interior lights
for x in (3.0, W - 3.0):
    for y in (3.0, 10.0, 17.0, 24.0, 31.0):
        o = add_light(f"LB{x}{y}", "AREA", (x, y, Z_CORE0 - 0.3), 1300, K2700, size=2.0)
for x in (6.0, 10.0):
    add_light(f"LBf{x}", "AREA", (x, 2.5, Z_CORE0 - 0.3), 1300, K2700, size=2.0)
# canopy lights
add_light("Canopy", "AREA", (7.7, -1.1, 4.1), 150, K2700, size=4.0)

# sky: Poly Haven "Evening Road 01 (Pure Sky)" CC0 HDRI, cloudy blue dusk, lights and background
wd = D_.worlds.new("World"); scn.world = wd; wd.use_nodes = True
nt = wd.node_tree; bg = nt.nodes["Background"]
env = nt.nodes.new("ShaderNodeTexEnvironment"); env.image = D_.images.load(f"{ASSETS}/hdri/evening_road_01_puresky_4k.hdr")
tcw = nt.nodes.new("ShaderNodeTexCoord"); mpw = nt.nodes.new("ShaderNodeMapping"); mpw.inputs["Rotation"].default_value = (0, 0, math.radians(HDRI_ROT))
nt.links.new(tcw.outputs["Generated"], mpw.inputs["Vector"]); nt.links.new(mpw.outputs[0], env.inputs["Vector"])
wd.name = "W_Dusk"
hs = nt.nodes.new("ShaderNodeHueSaturation"); hs.inputs["Saturation"].default_value = 0.62; hs.inputs["Value"].default_value = 0.92
nt.links.new(env.outputs[0], hs.inputs["Color"])
sxyz = nt.nodes.new("ShaderNodeSeparateXYZ"); nt.links.new(tcw.outputs["Generated"], sxyz.inputs[0])
hz = nt.nodes.new("ShaderNodeMapRange"); hz.inputs[1].default_value = 0.0; hz.inputs[2].default_value = 0.22
hz.inputs[3].default_value = 0.75; hz.inputs[4].default_value = 0.0; nt.links.new(sxyz.outputs["Z"], hz.inputs[0])
warm = nt.nodes.new("ShaderNodeMix"); warm.data_type = "RGBA"; warm.blend_type = "MULTIPLY"
nt.links.new(hz.outputs[0], warm.inputs["Factor"]); nt.links.new(hs.outputs[0], warm.inputs[6]); warm.inputs[7].default_value = (1.9, 1.15, 0.62, 1)
nt.links.new(warm.outputs[2], bg.inputs[0]); bg.inputs[1].default_value = HDRI_STR
wday = D_.worlds.new("W_Day"); wday.use_nodes = True; nd = wday.node_tree
skd = nd.nodes.new("ShaderNodeTexSky"); skd.sky_type = "NISHITA"; skd.sun_elevation = math.radians(38); skd.sun_rotation = math.radians(215)
skd.sun_disc = False; skd.air_density = 1.0; skd.dust_density = 1.5
envd = nd.nodes.new("ShaderNodeTexEnvironment"); envd.image = D_.images.load(f"{ASSETS}/hdri/evening_road_01_puresky_4k.hdr")
tcd = nd.nodes.new("ShaderNodeTexCoord"); mpd = nd.nodes.new("ShaderNodeMapping"); mpd.inputs["Rotation"].default_value = (0, 0, math.radians(HDRI_ROT))
nd.links.new(tcd.outputs["Generated"], mpd.inputs["Vector"]); nd.links.new(mpd.outputs[0], envd.inputs["Vector"])
hsd = nd.nodes.new("ShaderNodeHueSaturation"); hsd.inputs["Saturation"].default_value = 0.55; nd.links.new(envd.outputs[0], hsd.inputs["Color"])
mxd = nd.nodes.new("ShaderNodeMix"); mxd.data_type = "RGBA"; mxd.blend_type = "SCREEN"; mxd.inputs["Factor"].default_value = 0.35
nd.links.new(skd.outputs[0], mxd.inputs[6]); nd.links.new(hsd.outputs[0], mxd.inputs[7])
nd.links.new(mxd.outputs[2], nd.nodes["Background"].inputs[0]); nd.nodes["Background"].inputs[1].default_value = 0.30
wid = D_.worlds.new("W_ID"); wid.use_nodes = True; wid.use_fake_user = True; wday.use_fake_user = True; wid.node_tree.nodes["Background"].inputs[0].default_value = (0, 0, 0, 1)
dsun = add_light("DaySun", "SUN", (0, 0, 60), 4.0, (1.0, 0.93, 0.84), angle=math.radians(1.0))
dsun.rotation_euler = (math.radians(52), 0, math.radians(215 - 90 + 180))
dsun.hide_render = True
# soft warm-neutral fill from behind the camera (the brochure facade reads evenly lit, like a twilight flood)
fill = add_light("Fill", "AREA", (-60.0, -62.0, 30.0), float(os.environ.get('FILL', 60000)), (1.0, 0.88, 0.74), size=25.0)
fill.rotation_euler = (Vector((7.7, 13.0, 14.0)) - Vector(fill.location)).to_track_quat("-Z", "Y").to_euler()
fill.visible_glossy = False

# ----------------------------------------------------------------- trees (Poly Haven glTF, instanced)
def load_tree(name, path):
    before = set(D_.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in D_.objects if o not in before]
    col = D_.collections.new(name); scn.collection.children.link(col)
    for o in new:
        for c in list(o.users_collection): c.objects.unlink(o)
        col.objects.link(o)
    bpy.context.view_layer.layer_collection.children[name].exclude = True
    return col
TA = load_tree("SRC_tree", f"{ASSETS}/models/island_tree_01/island_tree_01_1k.gltf")
TS = load_tree("SRC_shrub", f"{ASSETS}/models/tree_small_02/tree_small_02_1k.gltf")
def inst(col, loc, scale, rot):
    e = D_.objects.new(f"I-{col.name}", None); e.instance_type = "COLLECTION"; e.instance_collection = col
    e.location = loc; e.scale = (scale,) * 3; e.rotation_euler = (0, 0, rot); scn.collection.objects.link(e)
for y in (21.5, 29.0):
    inst(TA, (-SB - 1.7, y, 0.16), 1.75 + random.random() * 0.3, random.random() * 6.28)
for x in (17.5, 25.0, -12.0 + 0.0):
    if x == -12.0: continue
    inst(TA, (x, -SB - 1.7, 0.16), 1.7 + random.random() * 0.3, random.random() * 6.28)
for y in [-2.0 + 2.2 * i for i in range(17)]:
    inst(TS, (-SB + 0.17, y, 0.6), 0.32 + random.random() * 0.08, random.random() * 6.28)
for x in [-2.0 + 2.2 * i for i in range(3)] + [12.0 + 2.2 * i for i in range(5)]:
    inst(TS, (x, -SB + 0.17, 0.6), 0.32 + random.random() * 0.08, random.random() * 6.28)
# distant tree line / skyline so the ground doesn't run to a bare horizon
for k in range(46):
    a = math.radians(-30 + k * 4.2) ; rr = 95 + random.random() * 40
    x, y = 4 + rr * math.cos(a), 10 + rr * math.sin(a)
    inst(TA, (x, y, 0), 3.2 + random.random() * 1.6, random.random() * 6.28)
for k in range(9):
    a = math.radians(-20 + k * 21); rr = 150 + random.random() * 40
    x, y = 4 + rr * math.cos(a), 10 + rr * math.sin(a); h = 10 + random.random() * 18
    abox("far2", x - 9, x + 9, y - 9, y + 9, 0.0, h)
finish("FarSkyline", "far2", M["far"])
# background tree masses
for (x, y, s) in ((-70, 15, 3.4), (75, 60, 3.0), (-60, 75, 3.2), (80, -45, 3.0)):
    inst(TA, (x, y, 0), s, random.random() * 6.28)

# ----------------------------------------------------------------- cars + people for scale (procedural; Poly Haven has no CC0 vehicles or people)
def paint(name, rgb):
    m, nt, p = nodes_mat(name)
    p.inputs["Base Color"].default_value = (*rgb, 1); p.inputs["Metallic"].default_value = 0.55; p.inputs["Roughness"].default_value = 0.28
    p.inputs["Coat Weight"].default_value = 1.0; p.inputs["Coat Roughness"].default_value = 0.03
    return m
CARGLASS = simple("CarGlass", (0.01, 0.012, 0.014), 0.05)
TYRE = simple("Tyre", (0.02, 0.02, 0.02), 0.8); RIM = simple("Rim", (0.6, 0.6, 0.62), 0.25, 1.0)
HEAD = simple("HeadLamp", (1, 1, 1), 0.2, 0, (1.0, 0.95, 0.85), 40.0); TAIL = simple("TailLamp", (0.5, 0.02, 0.02), 0.3, 0, (1.0, 0.05, 0.03), 12.0)
def mesh_obj(name, verts, faces, mat, parent, bevel=0.0, seg=4):
    me = D_.meshes.new(name); me.from_pydata(verts, [], faces); me.validate()
    o = D_.objects.new(name, me); scn.collection.objects.link(o); me.materials.append(mat); o.parent = parent
    for pl in me.polygons: pl.use_smooth = True
    if bevel:
        md = o.modifiers.new("b", "BEVEL"); md.width = bevel; md.segments = seg; md.limit_method = "ANGLE"; md.harden_normals = False
    return o
def prism(x0, x1, y0, y1, z0, z1, tx0=None, tx1=None, ty=0.0):
    tx0 = x0 if tx0 is None else tx0; tx1 = x1 if tx1 is None else tx1
    v = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (tx0, y0 + ty, z1), (tx1, y0 + ty, z1), (tx1, y1 - ty, z1), (tx0, y1 - ty, z1)]
    f = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    return v, f
def car(name, loc, rot, rgb, lights=True):
    e = D_.objects.new(name, None); scn.collection.objects.link(e); e.location = loc; e.rotation_euler = (0, 0, rot)
    pm = paint(name + "Paint", rgb)
    mesh_obj(name + "Body", *prism(-2.30, 2.30, -0.90, 0.90, 0.28, 0.90, -2.18, 2.05, 0.07), pm, e, bevel=0.2, seg=6)
    mesh_obj(name + "Cabin", *prism(-1.25, 1.05, -0.84, 0.84, 0.90, 1.42, -0.80, 0.35, 0.17), CARGLASS, e, bevel=0.07, seg=3)
    mesh_obj(name + "Roof", *prism(-0.78, 0.33, -0.66, 0.66, 1.40, 1.45), pm, e, bevel=0.03, seg=2)
    for (x, y) in ((-1.45, -0.80), (-1.45, 0.80), (1.40, -0.80), (1.40, 0.80)):
        v, f = [], []
        n = 24
        for i in range(n):
            a = 2 * math.pi * i / n
            for yy in (y - 0.12, y + 0.12): v.append((x + 0.34 * math.cos(a), yy, 0.34 + 0.34 * math.sin(a)))
        for i in range(n):
            j = (i + 1) % n; f.append((2 * i, 2 * j, 2 * j + 1, 2 * i + 1))
        f.append(tuple(2 * i for i in range(n))[::-1]); f.append(tuple(2 * i + 1 for i in range(n)))
        mesh_obj(name + "Tyre", v, f, TYRE, e)
        yo = y + (0.125 if y > 0 else -0.125)
        v, f = [], []
        for i in range(n):
            a = 2 * math.pi * i / n
            for yy, rr in ((yo - 0.01, 0.235), (yo + 0.01 * (1 if y > 0 else -1) * 0 + (0.012 if y > 0 else -0.012), 0.20)):
                v.append((x + rr * math.cos(a), yy, 0.34 + rr * math.sin(a)))
        for i in range(n):
            j = (i + 1) % n; f.append((2 * i, 2 * j, 2 * j + 1, 2 * i + 1))
        f.append(tuple(2 * i + 1 for i in range(n)))
        mesh_obj(name + "Rim", v, f, RIM, e)
    for yy in (-0.62, 0.62):
        mesh_obj(name + "HL", *prism(2.24, 2.30, yy - 0.2, yy + 0.2, 0.74, 0.82), HEAD, e)
        mesh_obj(name + "TL", *prism(-2.30, -2.24, yy - 0.22, yy + 0.22, 0.78, 0.86), TAIL, e)
    if lights:
        ld = D_.lights.new(name + "Beam", "SPOT"); ld.energy = 120; ld.color = (1, 0.95, 0.85); ld.spot_size = math.radians(70); ld.spot_blend = 0.7
        lo = D_.objects.new(name + "Beam", ld); scn.collection.objects.link(lo); lo.parent = e
        lo.location = (2.4, 0, 0.78); lo.rotation_euler = (0, math.radians(100), 0)
car("CarA", (3.0, -10.4, 0.0), 0.0, (0.04, 0.09, 0.22))           # blue saloon, near lane of the 80' road
car("CarB", (16.0, -20.5, 0.0), math.pi, (0.50, 0.51, 0.53))        # silver, far lane
car("CarC", (-13.4, 14.0, 0.0), math.pi / 2, (0.75, 0.74, 0.72), lights=False)   # parked on the 30' road

SKIN = simple("Skin", (0.35, 0.22, 0.15), 0.5)
def person(name, loc, rot, cloth, legs, h=1.72):
    e = D_.objects.new(name, None); scn.collection.objects.link(e); e.location = loc; e.rotation_euler = (0, 0, rot)
    k = h / 1.72
    def mb(nm, mat, elems):
        mbd = D_.metaballs.new(nm); mbd.resolution = 0.02; mbd.render_resolution = 0.012; mbd.threshold = 0.6
        for (typ, co, r, sz, q) in elems:
            el = mbd.elements.new(); el.type = typ; el.co = co; el.radius = r
            if typ in ("ELLIPSOID", "CAPSULE"):
                el.size_x, el.size_y, el.size_z = sz
            if q: el.rotation = q
        o = D_.objects.new(nm, mbd); scn.collection.objects.link(o); o.parent = e; o.scale = (k, k, k); mbd.materials.append(mat); return o
    from mathutils import Quaternion
    vert = Quaternion((0, 1, 0), math.radians(90))
    mb(name + "Torso", cloth, [("ELLIPSOID", (0, 0, 1.22), 0.36, (0.55, 0.85, 1.15), None),
                                ("ELLIPSOID", (0, 0, 0.98), 0.32, (0.55, 0.8, 0.7), None),
                                ("CAPSULE", (0.02, -0.25, 1.12), 0.09, (0.22, 1, 1), vert),
                                ("CAPSULE", (-0.02, 0.25, 1.12), 0.09, (0.22, 1, 1), vert)])
    mb(name + "Legs", legs, [("CAPSULE", (0.05, -0.09, 0.48), 0.11, (0.36, 1, 1), Quaternion((0, 1, 0), math.radians(84))),
                             ("CAPSULE", (-0.06, 0.09, 0.48), 0.11, (0.36, 1, 1), Quaternion((0, 1, 0), math.radians(96)))])
    mb(name + "Head", SKIN, [("BALL", (0, 0, 1.60), 0.17, None, None), ("BALL", (0, 0, 1.50), 0.09, None, None)])
CL = [simple("ClothA", (0.75, 0.72, 0.66), 0.8), simple("ClothB", (0.05, 0.06, 0.09), 0.8), simple("ClothC", (0.30, 0.08, 0.06), 0.8), simple("ClothD", (0.20, 0.25, 0.32), 0.8)]
DEN = simple("Denim", (0.04, 0.06, 0.12), 0.85)
person("P1", (-5.0, 3.0, 0.16), 0.3, CL[0], DEN)
person("P2", (-4.4, -4.6, 0.16), 1.2, CL[1], CL[1], 1.66)
person("P3", (2.6, -5.3, 0.16), -1.5, CL[2], DEN, 1.78)
person("P4", (6.6, -2.2, 0.08), 3.0, CL[3], CL[1])
person("P5", (12.8, -5.0, 0.16), 1.7, CL[0], CL[1], 1.62)

# ----------------------------------------------------------------- camera (brochure angle: low, from the 80' road, two-point perspective)
cam_d = D_.cameras.new("Cam"); cam = D_.objects.new("Cam", cam_d); scn.collection.objects.link(cam); scn.camera = cam
cam.location = (-21.0, -24.5, 1.7)
tx, ty = W * 0.45, D * 0.42
cam.rotation_euler = (math.radians(90), 0, math.atan2(-(tx - cam.location.x), (ty - cam.location.y)))
cam_d.lens = 19; cam_d.sensor_width = 36; cam_d.sensor_fit = "HORIZONTAL"; cam_d.shift_y = 0.225; cam_d.clip_end = 2000

# ----------------------------------------------------------------- render settings + colour
r = scn.render; c = scn.cycles
r.engine = "CYCLES"; c.device = "CPU"; r.resolution_x, r.resolution_y = 1920, 1080; r.resolution_percentage = 100
c.samples = 128; c.use_adaptive_sampling = True; c.adaptive_threshold = 0.02
c.use_denoising = True; c.denoiser = "OPENIMAGEDENOISE"
c.max_bounces = 8; c.diffuse_bounces = 4; c.glossy_bounces = 4; c.transmission_bounces = 8; c.transparent_max_bounces = 16
c.caustics_reflective = False; c.caustics_refractive = False; c.sample_clamp_indirect = 8
vs = scn.view_settings; vs.view_transform = "AgX"; vs.look = "AgX - Medium High Contrast"; vs.exposure = 0.0; vs.use_white_balance = True; vs.white_balance_temperature = 6000
r.image_settings.file_format = "PNG"
# ----------------------------------------------------------------- colour-ID proxies: one prism per flat (floor x wing) + ground floor
import json
def srgb2lin(c):
    c = c / 255.0; return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
def clip(poly, x0, x1, y0, y1):
    def cl(P, inside, inter):
        out = []
        for i in range(len(P)):
            cur, prv = P[i], P[i - 1]
            if inside(cur):
                if not inside(prv): out.append(inter(prv, cur))
                out.append(cur)
            elif inside(prv): out.append(inter(prv, cur))
        return out
    def ix(xc):
        return lambda a, b: (xc, a[1] + (b[1] - a[1]) * (xc - a[0]) / (b[0] - a[0]))
    def iy(yc):
        return lambda a, b: (a[0] + (b[0] - a[0]) * (yc - a[1]) / (b[1] - a[1]), yc)
    P = poly
    P = cl(P, lambda p: p[0] >= x0, ix(x0)); P = cl(P, lambda p: p[0] <= x1, ix(x1)) if P else P
    P = cl(P, lambda p: p[1] >= y0, iy(y0)) if P else P; P = cl(P, lambda p: p[1] <= y1, iy(y1)) if P else P
    return P
def envelope(fl):
    pts = []
    for p in OUTL:
        o = BASE + 0.02
        if fl >= 1 and p["f"] in ("S", "E"): o = off_at(p, fl) + 0.02
        if fl >= 1 and p["f"] in ("F", "B") and any(a - 0.2 <= p["s"] <= b + 0.2 for a, b in BALC): o = BDP + 0.02
        pts.append((p["x"] + p["nx"] * o, p["y"] + p["ny"] * o))
    return pts
WING_Q = {1: (W / 2, 99, -99, D / 2), 2: (-99, W / 2, -99, D / 2), 3: (-99, W / 2, D / 2, 99), 4: (W / 2, 99, D / 2, 99)}
IDMAP = {}
def id_prism(name, poly, z0, z1, rgb8, info):
    bm = bmesh.new()
    lo = [bm.verts.new((x, y, z0)) for x, y in poly]; hi = [bm.verts.new((x, y, z1)) for x, y in poly]
    bm.faces.new(lo[::-1]); bm.faces.new(hi)
    for i in range(len(poly)):
        j = (i + 1) % len(poly); bm.faces.new((lo[i], lo[j], hi[j], hi[i]))
    bmesh.ops.triangulate(bm, faces=bm.faces[:], quad_method="BEAUTY", ngon_method="EAR_CLIP")
    me = D_.meshes.new(name); bm.to_mesh(me); bm.free()
    o = D_.objects.new(name, me); scn.collection.objects.link(o)
    m = D_.materials.new(name); m.use_nodes = True; nt_ = m.node_tree; nt_.nodes.remove(nt_.nodes["Principled BSDF"])
    em = nt_.nodes.new("ShaderNodeEmission"); em.inputs["Color"].default_value = (*[srgb2lin(c) for c in rgb8], 1); em.inputs["Strength"].default_value = 1.0
    nt_.links.new(em.outputs[0], nt_.nodes["Material Output"].inputs["Surface"]); me.materials.append(m)
    o.hide_render = True
    IDMAP["#%02x%02x%02x" % tuple(rgb8)] = info
for fl in range(1, NF + 1):
    z0 = zfl(fl) - 0.30; z1 = (zfl(fl + 1) - 0.30) if fl < NF else ROOF + 0.6
    env_ = envelope(fl)
    for w in (1, 2, 3, 4):
        poly = clip(env_, *WING_Q[w])
        rgb8 = (20 + fl * 30, 40 + w * 45, 128 if w % 2 else 210)
        id_prism(f"ID_F{fl}W{w}", poly, z0, z1, rgb8, {"floor": fl, "wing": w, "unit": f"{fl}0{w}"})
id_prism("ID_GROUND", envelope(0), 0.0, zfl(1) - 0.30, (255, 220, 40), {"floor": 0, "wing": None, "unit": None, "label": "Ground floor (retail + lobby)"})
os.makedirs("/workspace/surreal-shyam/ext/renders/orbit", exist_ok=True)
json.dump({"background": "transparent (alpha 0)", "match": "nearest colour; values may differ by +-1 from rounding", "colors": IDMAP},
          open("/workspace/surreal-shyam/ext/renders/orbit/id_map.json", "w"), indent=1)
bpy.ops.wm.save_as_mainfile(filepath=OUT)
print("SAVED", OUT, "lights", len(LIGHTS))
