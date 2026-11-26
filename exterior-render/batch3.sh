#!/bin/bash
# fix pass: dusk 03-05 (neighbour block shortened so it no longer fills the frame), all day stills with the new day HDRI
cd /workspace/surreal-shyam/ext
B=/home/box/apps/blender; O=renders/orbit; T0=$(date +%s)
run() { local nn=$(printf %02d $2); local t0=$(date +%s)
  timeout -s KILL 900 $B -b exterior.blend -P scripts/render_orbit.py -- $1 $2 $O/$1/$nn.png 128 > logs/orbit/$1-$nn-r3.log 2>&1; local rc=$?
  echo "$(date +%H:%M:%S) $1 $nn exit=$rc wall=$(( $(date +%s) - t0 ))s $(grep RENDER_SECONDS logs/orbit/$1-$nn-r3.log) $(grep -o 'Sample [0-9]*/128' logs/orbit/$1-$nn-r3.log | grep -v ' 0/' | tail -1)"; }
for k in 4 5 3; do run dusk $k; done
for k in $(seq 0 11); do run day $k; done
echo "ALLDONE total=$(( $(date +%s) - T0 ))s"
