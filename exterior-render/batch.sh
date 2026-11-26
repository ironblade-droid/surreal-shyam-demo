#!/bin/bash
# orbit batch: ID passes first (fast), then dusk + day per angle. Each render hard-killed at 900 s.
cd /workspace/surreal-shyam/ext
B=/home/box/apps/blender; O=renders/orbit; mkdir -p $O/dusk $O/day $O/id logs/orbit
T0=$(date +%s)
run() { # mode k
  local nn=$(printf %02d $2); local t0=$(date +%s)
  timeout -s KILL 900 $B -b exterior.blend -P scripts/render_orbit.py -- $1 $2 $O/$1/$nn.png 128 > logs/orbit/$1-$nn.log 2>&1
  echo "$(date +%H:%M:%S) $1 $nn exit=$? wall=$(( $(date +%s) - t0 ))s $(grep RENDER_SECONDS logs/orbit/$1-$nn.log)"
}
for k in $(seq 0 11); do run id $k; done
for k in $(seq 0 11); do run dusk $k; run day $k; done
echo "ALLDONE total=$(( $(date +%s) - T0 ))s"
