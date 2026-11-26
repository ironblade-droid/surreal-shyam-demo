#!/bin/bash
# after batch4: hero (brochure camera) dusk without the removed neighbour block
cd /workspace/surreal-shyam/ext
while ! grep -q ALLDONE logs/batch4.log; do sleep 10; done
t0=$(date +%s)
timeout -s KILL 900 /home/box/apps/blender -b exterior.blend -P scripts/render_orbit.py -- dusk brochure renders/hero-dusk.png 128 > logs/orbit/hero-dusk.log 2>&1; rc=$?
echo "$(date +%H:%M:%S) hero dusk exit=$rc wall=$(( $(date +%s) - t0 ))s $(grep RENDER_SECONDS logs/orbit/hero-dusk.log) $(grep -o 'Sample [0-9]*/128' logs/orbit/hero-dusk.log | grep -v ' 0/' | tail -1)"
echo ALLDONE
