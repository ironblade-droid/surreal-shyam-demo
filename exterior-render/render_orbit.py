# blender -b exterior.blend -P render_orbit.py -- <mode dusk|day|id> <k 0..11 | brochure> <out.png> [samples]
import bpy, sys, math, time
from mathutils import Vector
a = sys.argv[sys.argv.index("--") + 1:]
mode, k, out = a[0], a[1], a[2]; spp = int(a[3]) if len(a) > 3 else 128
s = bpy.context.scene; D_ = bpy.data
cam = s.camera; CX, CY, R, ANG0 = 7.7, 13.5, 47.6, -127.06
if k != "brochure":
    ang = math.radians(ANG0 + 30 * int(k))
    x, y = CX + R * math.cos(ang), CY + R * math.sin(ang)
    cam.location = (x, y, 1.7)
    cam.rotation_euler = (math.pi / 2, 0, math.atan2(-(CX - x), (CY - y)))
# fill light follows the camera (behind it, high, aimed at the tower)
fill = D_.objects["Fill"]; c = Vector(cam.location); d = (Vector((CX, CY, 0)) - Vector((c.x, c.y, 0))).normalized()
fill.location = (c.x - d.x * 18, c.y - d.y * 18, 30.0)
fill.rotation_euler = (Vector((CX, CY, 14.0)) - fill.location).to_track_quat("-Z", "Y").to_euler()
win = D_.materials["WinGlass"].node_tree.nodes["EmitStr"]
r = s.render; cy = s.cycles; vs = s.view_settings
r.filepath = out; r.resolution_x, r.resolution_y, r.resolution_percentage = 1920, 1080, int(a[4]) if len(a) > 4 else 100
cy.samples = spp; cy.time_limit = 760
if mode == "dusk":
    s.world = D_.worlds["W_Dusk"]
elif mode == "day":
    # clear midday-afternoon: Poly Haven "Kloofendal 48d Partly Cloudy (Pure Sky)" CC0 HDRI does sky, sun and shadows
    w = D_.worlds.new("W_Day2"); w.use_nodes = True; nt = w.node_tree
    env = nt.nodes.new("ShaderNodeTexEnvironment"); env.image = D_.images.load("/workspace/tour/pano/assets/hdri/kloofendal_48d_partly_cloudy_puresky_4k.hdr")
    tc = nt.nodes.new("ShaderNodeTexCoord"); mp = nt.nodes.new("ShaderNodeMapping"); mp.inputs["Rotation"].default_value = (0, 0, math.radians(float(__import__("os").environ.get("DAY_ROT", 110))))
    nt.links.new(tc.outputs["Generated"], mp.inputs["Vector"]); nt.links.new(mp.outputs[0], env.inputs["Vector"])
    nt.links.new(env.outputs[0], nt.nodes["Background"].inputs[0]); nt.nodes["Background"].inputs[1].default_value = float(__import__("os").environ.get("DAY_STR", 1.0))
    s.world = w; fill.data.energy = 0
    win.inputs[1].default_value = 0.4
    for o in s.objects:
        if o.type == "LIGHT": o.data.energy *= 0.2
    vs.exposure = float(__import__("os").environ.get("DAY_EXP", -0.5)); vs.look = "AgX - Medium High Contrast"
elif mode == "id":
    s.world = D_.worlds["W_ID"]
    for o in s.objects:
        o.hide_render = not o.name.startswith("ID_")
    cy.samples = 1; cy.use_denoising = False; cy.use_adaptive_sampling = False
    r.filter_size = 0.0; r.dither_intensity = 0.0; r.film_transparent = True
    vs.view_transform = "Standard"; vs.look = "None"; vs.exposure = 0; vs.gamma = 1; vs.use_white_balance = False
    r.image_settings.color_mode = "RGBA"
t = time.time(); bpy.ops.render.render(write_still=True)
print(f"RENDER_SECONDS {time.time() - t:.1f}")
