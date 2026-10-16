from __future__ import annotations

import hashlib
import json
from pathlib import Path


def file_stamp(path: Path) -> dict[str, int | str]:
    stat = path.stat()
    return {"path": str(path.resolve()), "mtime_ns": stat.st_mtime_ns, "size": stat.st_size}


def route_cache_key(
    net_path: Path,
    begin: int,
    finish: int,
    counts: list[tuple[str, int]],
    seed: int,
    commute: bool,
    attractors_path: Path | None = None,
) -> str:
    """Same network, clock, demand, seed, and commute inputs always share a route file."""
    payload: dict = {
        "net": file_stamp(net_path),
        "begin": begin,
        "finish": finish,
        "counts": [[mode, count] for mode, count in counts],
        "seed": seed,
        "commute": commute,
    }
    if commute:
        if attractors_path is None:
            raise ValueError("Commute routes need the attractor file.")
        payload["attractors"] = file_stamp(attractors_path)
    return _digest(payload)


def weight_cache_key(net_path: Path, attractors_path: Path) -> str:
    """Commute weights depend on the network and the office and university file."""
    return _digest({"net": file_stamp(net_path), "attractors": file_stamp(attractors_path)})


def _digest(payload: dict) -> str:
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(encoded.encode()).hexdigest()[:20]
