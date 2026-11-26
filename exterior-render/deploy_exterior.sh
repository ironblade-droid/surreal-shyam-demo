#!/bin/bash
# Build the orbit viewer and publish it: gh-pages /exterior/ (fast-forward only, never force) + source to main (site/public/exterior + exterior-render/)
set -e
EXT=/workspace/surreal-shyam/ext
python3 $EXT/scripts/make_viewer.py
# ---- gh-pages
cd /workspace/ss-pages
git fetch -q origin gh-pages && git checkout -q gh-pages && git rebase -q origin/gh-pages
rm -rf exterior && cp -r $EXT/viewer exterior
git add -A exterior && git commit -q -m "Exterior viewer: favicon link" || echo "gh-pages: nothing to commit"
for i in 1 2 3; do git push -q origin gh-pages && break || { git fetch -q origin gh-pages; git rebase -q origin/gh-pages; }; done
git log --oneline -1
# ---- main (separate worktree so the other worker's uncommitted edits in site/ are untouched)
cd /workspace/ss-main-ext
git fetch -q origin main && git rebase -q origin/main 2>/dev/null || git reset -q --soft origin/main
rm -rf public/exterior && cp -r $EXT/viewer public/exterior
mkdir -p exterior-render && cp $EXT/scripts/{build_exterior.py,render_orbit.py,render.py,make_viewer.py,batch.sh,batch2.sh,batch3.sh,batch4.sh,batch5.sh,batch6.sh,deploy_exterior.sh} exterior-render/
cp /workspace/surreal-shyam/qa/ext-orbit-qa.mjs exterior-render/
cat > exterior-render/README.md <<'MD'
# Photoreal exterior (Blender Cycles)
- `build_exterior.py` builds `exterior.blend` procedurally (tower, site, lights, worlds, colour-ID proxies, `id_map.json`).
- `render_orbit.py -- <dusk|day|id> <0..11|brochure> <out.png> [samples]` renders one orbit still (r = 47.6 m around the tower, 30° steps, eye height 1.7 m; 00 = brochure side).
- `make_viewer.py` turns the renders into `public/exterior/` (WebP 1920/1024, 1280x720 ID masks).
- Render the .blend in place: it stores asset paths relative to itself.
MD
git add -A public/exterior exterior-render
git commit -q -m "Exterior viewer: favicon link" || echo "main: nothing to commit"
for i in 1 2 3; do git push -q origin HEAD:main && break || { git fetch -q origin main; git rebase -q origin/main; }; done
git log --oneline -1
