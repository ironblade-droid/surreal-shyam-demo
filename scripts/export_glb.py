# blender -b exterior.blend -P export_glb.py  -> ext/glb/building.glb + ao.png (never saves the .blend)
import bpy, bmesh, math, json, os, time
D = bpy.data; s = bpy.context.scene; OUT = "/workspace/surreal-shyam/ext/glb"
T0 = time.time()
# world rotations for three.js
info = {}
for w in D.worlds:
    if w.use_nodes:
        for n in w.node_tree.nodes:
            if n.type == "MAPPING": info[w.name] = [round(v, 4) for v in n.inputs["Rotation"].default_value]
            if n.type == "BACKGROUND": info[w.name + "_str"] = n.inputs[1].default_value
SKIP = ("tree", "island", "ID_GROUND")
keep, ids = [], []
for o in list(s.objects):
    if o.type == "MESH" and o.name.startswith("ID_F"): ids.append(o); continue
    if o.type != "MESH" or o.hide_render or o.name.startswith(SKIP): continue
    keep.append(o)
for o in list(s.objects):
    if o not in keep and o not in ids: D.objects.remove(o, do_unlink=True)
print("KEEP", len(keep), "IDS", len(ids), [o.name for o in keep][:60])
# ---- simplify materials to glTF-friendly principled values
def colour_of(sock):
    if not sock.is_linked: return tuple(sock.default_value)
    n = sock.links[0].from_node
    if n.type == "MIX":
        for i in (6, 7):
            if not n.inputs[i].is_linked: return tuple(n.inputs[i].default_value)
        return colour_of(n.inputs[6])
    if n.type == "MIX_RGB":
        for i in (1, 2):
            if not n.inputs[i].is_linked: return tuple(n.inputs[i].default_value)
    if n.type == "VALTORGB":
        e = n.color_ramp.elements; return tuple(sum(x.color[i] for x in e) / len(e) for i in range(4))
    if n.type == "RGB": return tuple(n.outputs[0].default_value)
    for i in n.inputs:
        if i.type == "RGBA": return colour_of(i)
    return (0.6, 0.6, 0.6, 1)
def value_of(sock, dflt):
    if not sock.is_linked: return sock.default_value
    n = sock.links[0].from_node
    if n.type == "MAP_RANGE": return (n.inputs[3].default_value + n.inputs[4].default_value) / 2
    if n.type == "VALUE": return n.outputs[0].default_value
    return dflt
mats = {}
for m in D.materials:
    if not m.use_nodes: continue
    nt = m.node_tree; p = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if not p: continue
    has_img = p.inputs["Base Color"].is_linked and p.inputs["Base Color"].links[0].from_node.type == "TEX_IMAGE"
    if not has_img:
        c = colour_of(p.inputs["Base Color"])
        for l in list(p.inputs["Base Color"].links): nt.links.remove(l)
        p.inputs["Base Color"].default_value = c
    r = value_of(p.inputs["Roughness"], 0.6)
    for l in list(p.inputs["Roughness"].links): nt.links.remove(l)
    p.inputs["Roughness"].default_value = r
    for k in ("Normal", "Emission Strength", "Emission Color", "Alpha"):
        if k in p.inputs and not has_img:
            for l in list(p.inputs[k].links): nt.links.remove(l)
    mats[m.name] = {"rgb": [round(v, 3) for v in p.inputs["Base Color"].default_value[:3]], "rough": round(r, 3),
                    "metal": round(p.inputs["Metallic"].default_value, 3), "trans": round(p.inputs["Transmission Weight"].default_value, 3),
                    "emit": round(p.inputs["Emission Strength"].default_value, 3)}
print("MATS", json.dumps(mats))
# ---- apply modifiers, join static building geometry (non-glass) for one AO atlas
bpy.ops.object.select_all(action="DESELECT")
for o in keep:
    o.select_set(True)
bpy.context.view_layer.objects.active = keep[0]
bpy.ops.object.convert(target="MESH")
GLASSY = ("WindowGlass", "RailGlass", "StoreGlass", "CarGlass")
building = [o for o in keep if o.name.split(".")[0] in ("Bands", "Soffits", "BalconyFloors", "Core", "Walls", "Frames", "Louvres", "Cladding", "Lfloor", "Ceil", "Ipanel")]
bpy.ops.object.select_all(action="DESELECT")
for o in building: o.select_set(True)
bpy.context.view_layer.objects.active = building[0]
bpy.ops.object.join(); B = bpy.context.view_layer.objects.active; B.name = "Building"
me = B.data
print("BUILDING tris", sum(len(p.vertices) - 2 for p in me.polygons), "uvs", [u.name for u in me.uv_layers])
uv = me.uv_layers.new(name="AO"); me.uv_layers.active = uv
bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT"); bpy.ops.mesh.normals_make_consistent(inside=False)
bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.0015, area_weight=0.0, scale_to_bounds=True)
bpy.ops.object.mode_set(mode="OBJECT")
print("UV done", round(time.time() - T0))
RES = int(os.environ.get("AO_RES", 2048))
img = D.images.new("AO", RES, RES, alpha=False, float_buffer=False); img.colorspace_settings.name = "Non-Color"
for slot in B.material_slots:
    m = slot.material; nt = m.node_tree
    n = nt.nodes.new("ShaderNodeTexImage"); n.image = img; n.name = "AOBAKE"
    nt.nodes.active = n
s.render.engine = "CYCLES"; s.cycles.device = "CPU"; s.cycles.samples = int(os.environ.get("AO_SPP", 24))
s.render.bake.margin = 4; s.world.light_settings.distance = 2.5
bpy.ops.object.select_all(action="DESELECT"); B.select_set(True); bpy.context.view_layer.objects.active = B
bpy.ops.object.bake(type="AO")
img.filepath_raw = f"{OUT}/ao.png"; img.file_format = "PNG"; img.save()
print("BAKE done", round(time.time() - T0))
for slot in B.material_slots:
    nt = slot.material.node_tree; nt.nodes.remove(nt.nodes["AOBAKE"])
# ---- ID prisms: hit volumes (exported, hidden in three.js)
for o in ids: o.hide_render = False; o.hide_viewport = False; o.hide_set(False)
for o in s.objects:
    if o.type == "LIGHT" or o.type == "CAMERA": D.objects.remove(o, do_unlink=True)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=f"{OUT}/building.glb", export_format="GLB", use_selection=False,
    export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
    export_draco_position_quantization=14, export_draco_normal_quantization=10, export_draco_texcoord_quantization=12,
    export_image_format="WEBP", export_apply=True, export_lights=False, export_cameras=False, export_extras=True)
json.dump({"worlds": info, "mats": mats}, open(f"{OUT}/info.json", "w"), indent=1)
print("EXPORT done", round(time.time() - T0), os.path.getsize(f"{OUT}/building.glb"))
