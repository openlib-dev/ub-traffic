from __future__ import annotations

import xml.etree.ElementTree as ET

from sumo_worker.metrics import osm_way_id


def load_edge_index(net_path: str) -> dict[str, tuple[int, float]]:
    """Map a SUMO edge id to (OSM way id, speed limit m/s)."""
    index: dict[str, tuple[int, float]] = {}
    for _, elem in ET.iterparse(net_path, events=("end",)):
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
