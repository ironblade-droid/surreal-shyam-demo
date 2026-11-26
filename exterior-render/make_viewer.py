# Build the exterior orbit viewer: renders -> WebP (1920 q82, 1024 q80), ID passes -> 1280x720 PNG masks (nearest), id_map.json, index.html
import os, shutil, json
from PIL import Image
R = "/workspace/surreal-shyam/ext/renders"; OUT = os.environ.get("OUT", "/workspace/surreal-shyam/ext/viewer")
for m in ("dusk", "day", "id"): os.makedirs(f"{OUT}/img/{m}", exist_ok=True)
def webp(src, dst):
    im = Image.open(src).convert("RGB")
    im.save(f"{dst}-1920.webp", "WEBP", quality=82, method=6)
    im.resize((1024, 576), Image.LANCZOS).save(f"{dst}-1024.webp", "WEBP", quality=80, method=6)
webp(f"{R}/hero-dusk.png" if os.path.exists(f"{R}/hero-dusk.png") else f"{R}/test-r5.png", f"{OUT}/img/dusk/hero")
for m in ("dusk", "day"):
    for k in range(12): webp(f"{R}/orbit/{m}/{k:02d}.png", f"{OUT}/img/{m}/{k:02d}")
for f in [f"{k:02d}" for k in range(12)] + ["hero"]:
    Image.open(f"{R}/orbit/id/{f}.png").convert("RGBA").resize((1280, 720), Image.NEAREST).save(f"{OUT}/img/id/{f}.png", optimize=True)
shutil.copy(f"{R}/orbit/id_map.json", f"{OUT}/img/id_map.json")
print("done", sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(OUT) for f in fs) // 1024, "KB")
