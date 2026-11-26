import bpy, os, math, json
D = bpy.data; s = bpy.context.scene; OUT = "/workspace/surreal-shyam/ext/glb"
c = s.camera; info = {"cam": list(c.location), "rot": list(c.rotation_euler), "lens": c.data.lens, "sensor": c.data.sensor_width}
print("CAM", json.dumps(info)); json.dump(info, open(f"{OUT}/cam.json", "w"))
# HDRIs: 1k HDR for lighting + 2k LDR sky for the backdrop
for nm, f in (("dusk", "evening_road_01_puresky_4k.hdr"), ("day", "kloofendal_48d_partly_cloudy_puresky_4k.hdr")):
    import numpy as np
    im = D.images.load(f"/workspace/tour/pano/assets/hdri/{f}"); im.scale(2048, 1024)
    a = np.empty(2048 * 1024 * 4, dtype=np.float32); im.pixels.foreach_get(a); a = a.reshape(-1, 4)
    k = 1.6 if nm == "dusk" else 1.0
    rgb = a[:, :3] * k; rgb = rgb / (1 + rgb) * 1.25; rgb = np.clip(rgb, 0, 1) ** (1 / 2.2)
    b2 = a.copy(); b2[:, :3] = rgb; b2[:, 3] = 1
    sky = D.images.new(nm + "sky", 2048, 1024, alpha=False); sky.pixels.foreach_set(b2.ravel())
    sky.filepath_raw = f"{OUT}/{nm}-sky.png"; sky.file_format = "PNG"; sky.save()
    im.scale(1024, 512); im.filepath_raw = f"{OUT}/{nm}-1k.hdr"; im.file_format = "HDR"; im.save()
    print("HDR", nm)
# tree: Poly Haven island_tree_01, decimated
for o in list(s.objects): D.objects.remove(o, do_unlink=True)
bpy.ops.import_scene.gltf(filepath="/workspace/tour/pano/assets/models/island_tree_01/island_tree_01_1k.gltf")
ms = [o for o in s.objects if o.type == "MESH"]
print("TREE tris", sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in ms), [o.name for o in ms])
for o in ms:
    t = sum(len(p.vertices) - 2 for p in o.data.polygons)
    if t > 6000:
        m = o.modifiers.new("dec", "DECIMATE"); m.ratio = max(0.02, 6000 / t)
for im in D.images:
    if im.size[0] > 512: im.scale(512, 512)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=f"{OUT}/tree.glb", export_format="GLB", export_draco_mesh_compression_enable=True,
    export_image_format="WEBP", export_apply=True)
print("TREE", os.path.getsize(f"{OUT}/tree.glb"))
