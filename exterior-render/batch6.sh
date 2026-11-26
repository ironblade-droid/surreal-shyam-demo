#!/bin/bash
# dusk 06-08 were rendered on 23 Nov with the old neighbour block; re-render with the boundary wall
cd /workspace/surreal-shyam/ext
for k in 6 7 8; do nn=$(printf %02d $k); t0=$(date +%s)
  timeout -s KILL 900 /home/box/apps/blender -b exterior.blend -P scripts/render_orbit.py -- dusk $k renders/orbit/dusk/$nn.png 128 > logs/orbit/dusk-$nn-r5.log 2>&1; rc=$?
  echo "$(date +%H:%M:%S) dusk $nn exit=$rc wall=$(( $(date +%s)-t0 ))s $(grep -o 'Sample [0-9]*/128' logs/orbit/dusk-$nn-r5.log | grep -v ' 0/' | tail -1)"
done; echo ALLDONE
