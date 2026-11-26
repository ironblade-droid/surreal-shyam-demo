# Photoreal exterior (Blender Cycles)
- `build_exterior.py` builds `exterior.blend` procedurally (tower, site, lights, worlds, colour-ID proxies, `id_map.json`).
- `render_orbit.py -- <dusk|day|id> <0..11|brochure> <out.png> [samples]` renders one orbit still (r = 47.6 m around the tower, 30° steps, eye height 1.7 m; 00 = brochure side).
- `make_viewer.py` turns the renders into `public/exterior/` (WebP 1920/1024, 1280x720 ID masks).
- Render the .blend in place: it stores asset paths relative to itself.
