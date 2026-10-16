from __future__ import annotations

import json
import xml.etree.ElementTree as ET
from pathlib import Path

from sumo_worker.metrics import osm_way_id


def load_edge_index(net_path: str) -> dict[str, tuple[int, float]]:
    """Map a SUMO edge id to (OSM way id, speed limit m/s). Reuse a file written for this network."""
    path = Path(net_path)
    cached = path.with_name(path.name + ".edges.json")
    if cached.is_file() and cached.stat().st_mtime >= path.stat().st_mtime:
        loaded = _read_edge_cache(cached)
        if loaded is not None:
            return loaded
    index = _parse_edge_index(path)
    _write_edge_cache(cached, index)
    return index


def _parse_edge_index(path: Path) -> dict[str, tuple[int, float]]:
    index: dict[str, tuple[int, float]] = {}
    for _, elem in ET.iterparse(path, events=("end",)):
        if elem.tag != "edge":
            continue
        edge_id = elem.get("id") or ""
        if edge_id.startswith(":"):
            elem.clear()
            continue
        orig_id = None
        limit = None
        for child in elem:
            if child.tag == "param" and child.get("key") == "origId":
                orig_id = child.get("value")
            elif child.tag == "lane" and limit is None and child.get("speed"):
                limit = float(child.get("speed") or 0)
        way_id = osm_way_id(edge_id, orig_id)
        if way_id is not None and limit is not None and limit > 0:
            index[edge_id] = (way_id, limit)
        elem.clear()
    return index


def _read_edge_cache(path: Path) -> dict[str, tuple[int, float]] | None:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if not isinstance(payload, dict):
        return None
    index: dict[str, tuple[int, float]] = {}
    for edge_id, value in payload.items():
        if not isinstance(edge_id, str) or not isinstance(value, list) or len(value) != 2:
            return None
        way_id, limit = value
        if isinstance(way_id, bool) or not isinstance(way_id, int) or not isinstance(limit, (int, float)):
            return None
        index[edge_id] = (way_id, float(limit))
    return index


def _write_edge_cache(path: Path, index: dict[str, tuple[int, float]]) -> None:
    temporary = path.with_name(path.name + ".tmp")
    temporary.write_text(
        json.dumps({edge_id: [way_id, limit] for edge_id, (way_id, limit) in index.items()}, separators=(",", ":")),
        encoding="utf-8",
    )
    temporary.replace(path)
