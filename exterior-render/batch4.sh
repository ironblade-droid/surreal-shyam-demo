#!/bin/bash
# after batch3: re-render the dusk stills and day 00 that still show the removed neighbour block
cd /workspace/surreal-shyam/ext
while ! grep -q ALLDONE logs/batch3.log; do sleep 10; done
B=/home/box/apps/blender; O=renders/orbit; T0=$(date +%s)
run() { local nn=$(printf %02d $2); local t0=$(date +%s)
  timeout -s KILL 900 $B -b exterior.blend -P scripts/render_orbit.py -- $1 $2 $O/$1/$nn.png 128 > logs/orbit/$1-$nn-r4.log 2>&1; local rc=$?
  echo "$(date +%H:%M:%S) $1 $nn exit=$rc wall=$(( $(date +%s) - t0 ))s $(grep RENDER_SECONDS logs/orbit/$1-$nn-r4.log) $(grep -o 'Sample [0-9]*/128' logs/orbit/$1-$nn-r4.log | grep -v ' 0/' | tail -1)"; }
for k in 4 5 3 0 1 2; do run dusk $k; done
run day 0
echo "ALLDONE total=$(( $(date +%s) - T0 ))s"
