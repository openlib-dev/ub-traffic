#!/bin/sh
set -eu
mkdir -p /data/runs

seed() {
  name="$1"
  if [ ! -s "/data/$name" ] && [ -s "/opt/city/$name" ]; then
    cp "/opt/city/$name" "/data/$name"
  fi
}

seed ulaanbaatar.osm
seed attractors.json
seed ulaanbaatar.net.xml

exec python3 -m sumo_worker
