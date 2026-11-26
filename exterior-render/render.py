# blender -b exterior.blend -P render.py -- <samples> <pct> <out.png> [exposure] [time_limit_s]
import bpy, sys, time
a = sys.argv[sys.argv.index("--") + 1:]
s = bpy.context.scene
s.cycles.samples = int(a[0]); s.render.resolution_percentage = int(a[1]); s.render.filepath = a[2]
if len(a) > 3: s.view_settings.exposure = float(a[3])
s.cycles.time_limit = float(a[4]) if len(a) > 4 else 760
s.render.threads_mode = "AUTO"
t = time.time(); bpy.ops.render.render(write_still=True)
print(f"RENDER_SECONDS {time.time() - t:.1f}")
