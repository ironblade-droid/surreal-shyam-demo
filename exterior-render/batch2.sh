#!/bin/bash
# resume: missing day 03, and re-render day stills that were cut short by the time limit after box pauses (11: 33 spp, 05/07: 64 spp)
cd /workspace/surreal-shyam/ext
B=/home/box/apps/blender; O=renders/orbit; T0=$(date +%s)
for k in 3 11 5 7; do nn=$(printf %02d $k); t0=$(date +%s)
  timeout -s KILL 900 $B -b exterior.blend -P scripts/render_orbit.py -- day $k $O/day/$nn.png 128 > logs/orbit/day-$nn-r2.log 2>&1
  rc=$?
  echo "$(date +%H:%M:%S) day $nn exit=$rc wall=$(( $(date +%s) - t0 ))s $(grep RENDER_SECONDS logs/orbit/day-$nn-r2.log) $(grep -o 'Sample [0-9]*/128' logs/orbit/day-$nn-r2.log | grep -v ' 0/' | tail -1)"
done
echo "ALLDONE total=$(( $(date +%s) - T0 ))s"
