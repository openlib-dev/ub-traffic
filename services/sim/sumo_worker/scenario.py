from __future__ import annotations

import copy
import hashlib
import json
import xml.etree.ElementTree as ET
from pathlib import Path

import math

MAX_EDITS = 50
MIN_LANES = 1
MAX_LANES = 4
MIN_MAXSPEED_KMH = 10
MAX_MAXSPEED_KMH = 90
SNAP_METERS = 40
NODE_ID_BASE = 9_000_000_000_000
SPAN_ID_BASE = 7_000_000_000_000
MODE_ORDER = ("car", "bus", "truck", "train")
VCLASS = {"car": "passenger", "bus": "bus", "truck": "truck", "train": "rail"}


def validate_edits(raw: list | None) -> list[dict]:
    """Return one canonical edit per way. Raises ValueError on a bad payload."""
    if raw is None:
        return []
    if not isinstance(raw, list):
        raise ValueError("Edits must be a list.")
    if len(raw) > MAX_EDITS:
        raise ValueError("A scenario can change at most 50 roads.")
    seen: set[int] = set()
    edits: list[dict] = []
    for item in raw:
        if not isinstance(item, dict):
            raise ValueError("Each edit must name a road.")
        way_id = item.get("wayId")
        op = item.get("op")
        if isinstance(way_id, bool) or not isinstance(way_id, int) or way_id == 0:
            raise ValueError("Each edit must name a road.")
        if way_id in seen:
            raise ValueError("Each road can have one edit.")
        seen.add(way_id)
        if op == "add":
            edits.append(_add_edit(item, way_id))
        elif way_id <= 0:
            raise ValueError("Each edit must name a road.")
        elif op == "close":
            edits.append(_with_shape({"wayId": way_id, "op": "close"}, item))
        elif op == "access":
            edits.append(_with_shape({"wayId": way_id, "op": "access", "modes": _modes(item.get("modes"))}, item))
        elif op == "lanes":
            lanes = item.get("lanes")
            if isinstance(lanes, bool) or not isinstance(lanes, int) or lanes < MIN_LANES or lanes > MAX_LANES:
                raise ValueError("Lanes must be a whole number from 1 to 4.")
            edits.append(_with_shape({"wayId": way_id, "op": "lanes", "lanes": lanes}, item))
        elif op == "maxspeed":
            speed = item.get("maxspeedKmh")
            if (
                isinstance(speed, bool)
                or not isinstance(speed, int)
                or speed < MIN_MAXSPEED_KMH
                or speed > MAX_MAXSPEED_KMH
            ):
                raise ValueError("Speed must be a whole number from 10 to 90 km/h.")
            edits.append(_with_shape({"wayId": way_id, "op": "maxspeed", "maxspeedKmh": speed}, item))
        elif op in {"park", "stall", "construction"}:
            edits.append(_with_shape({"wayId": way_id, "op": op}, item))
        else:
            raise ValueError("An edit can close a road or change its lanes or speed.")
    edits.sort(key=lambda edit: edit["wayId"])
    return edits


def scenario_digest(edits: list[dict]) -> str:
    payload = json.dumps(edits, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode()).hexdigest()[:20]


def apply_osm_edits(source: Path, dest: Path, edits: list[dict]) -> None:
    """Write a copied OSM document with the edits applied. The source file is only read."""
    before = source.read_bytes()
    tree = ET.parse(source)
    root = tree.getroot()
    ways = {way.get("id"): way for way in root.findall("way")}
    for edit in edits:
        if edit["op"] == "add":
            _append_link(root, edit)
            continue
        way = ways.get(str(edit["wayId"]))
        if way is None:
            shape = edit.get("coordinates")
            if not shape:
                raise ValueError(f"Way {edit['wayId']} is not in the simulated network.")
            way = _insert_way(root, edit["wayId"], shape)
            ways[str(edit["wayId"])] = way
        if edit["op"] == "close":
            root.remove(way)
        elif edit["op"] == "lanes":
            _set_tag(way, "lanes", str(edit["lanes"]))
        elif edit["op"] == "maxspeed":
            _set_tag(way, "maxspeed", str(edit["maxspeedKmh"]))
        elif edit["op"] == "construction":
            lanes, speed = construction_tags(way)
            _set_tag(way, "lanes", str(lanes))
            _set_tag(way, "maxspeed", str(speed))
        elif edit["op"] in {"park", "stall"}:
            continue
        else:
            _apply_access(way, edit["modes"], None)
    dest.parent.mkdir(parents=True, exist_ok=True)
    tree.write(dest, encoding="unicode", xml_declaration=True)
    if source.read_bytes() != before:
        raise RuntimeError("The baseline OSM file was modified.")


CONSTRUCTION_SPEED_KMH = 30
PARK_SLICE_SECONDS = 120
ZAISAN_GREEN_SECONDS = 55
ZAISAN_YELLOW_SECONDS = 5
ZAISAN_NAMES = {"zaisan street", "зайсангийн гудамж"}
WORK_START_SECONDS = 9 * 3600
WORK_END_SECONDS = 18 * 3600
SINK_SHARE = 0.7
ATTRACTOR_RADIUS_M = 250


def structural_edits(edits: list[dict]) -> list[dict]:
    """Edits that change the OSM copy. Parking and a stall only close a lane during the run."""
    return [edit for edit in edits if edit.get("op") not in {"park", "stall"}]


def construction_tags(way: ET.Element) -> tuple[int, int]:
    """One fewer lane, never below 1, and a speed limit of at most 30 km/h."""
    raw_lanes = _tag_value(way, "lanes")
    try:
        lanes = int(float(raw_lanes)) if raw_lanes else 2
    except ValueError:
        lanes = 2
    raw_speed = _tag_value(way, "maxspeed")
    try:
        speed = int(float(raw_speed)) if raw_speed else 50
    except ValueError:
        speed = 50
    return max(MIN_LANES, lanes - 1), max(MIN_MAXSPEED_KMH, min(speed, CONSTRUCTION_SPEED_KMH))


def curb_closed(op: str, now: float, begin: int, finish: int) -> bool:
    """Whether the curb lane is blocked at this simulated second."""
    if op == "park":
        elapsed = now - begin
        if elapsed < 0:
            return False
        return int(elapsed // PARK_SLICE_SECONDS) % 2 == 0
    if op == "stall":
        span = finish - begin
        return begin + span / 4 <= now < begin + (3 * span) / 4
    return False


def zaisan_slow(now: float) -> bool:
    """Slow signal before 09:00 and from 18:00 onward. Office hours are an assumption."""
    second = now % 86400
    return second < WORK_START_SECONDS or second >= WORK_END_SECONDS


def zaisan_coverage(begin: int, finish: int) -> str:
    """always, never, or switch, for a window that may cross 09:00 or 18:00."""
    if finish <= begin:
        return "never"
    start = zaisan_slow(begin)
    end = zaisan_slow(finish - 1)
    if start == end:
        return "always" if start else "never"
    return "switch"


def sink_weights(edge_ids: list[str], attractor_ids: set[str], share: float = SINK_SHARE) -> dict[str, float]:
    """Give attractor edges about `share` of the destination probability."""
    attractors = [edge_id for edge_id in edge_ids if edge_id in attractor_ids]
    others = [edge_id for edge_id in edge_ids if edge_id not in attractor_ids]
    if not attractors or not others or share <= 0 or share >= 1:
        return {edge_id: 1.0 for edge_id in edge_ids}
    weight = (share / (1 - share)) * (len(others) / len(attractors))
    values = {edge_id: 1.0 for edge_id in others}
    for edge_id in attractors:
        values[edge_id] = weight
    return values


def source_weights(edge_ids: list[str], residential_ids: set[str]) -> dict[str, float]:
    """Prefer trips that leave residential streets."""
    if not any(edge_id in residential_ids for edge_id in edge_ids):
        return {edge_id: 1.0 for edge_id in edge_ids}
    return {edge_id: 4.0 if edge_id in residential_ids else 1.0 for edge_id in edge_ids}


def write_edge_weights(path: Path, weights: dict[str, float]) -> None:
    """Write one edge per line. SUMO reads a single edge from each line."""
    root = ET.Element("data")
    interval = ET.SubElement(root, "interval", {"id": "weights", "begin": "0", "end": "86400"})
    for edge_id, value in weights.items():
        ET.SubElement(interval, "edge", {"id": edge_id, "value": f"{value:.6f}"})
    ET.indent(root)
    path.parent.mkdir(parents=True, exist_ok=True)
    ET.ElementTree(root).write(path, encoding="unicode", xml_declaration=True)


def patch_zaisan_signals(net_path: Path, way_ids: set[str], keep_original: bool = False) -> int:
    """Replace guessed signals on Zaisan Street with a slow north–south program.

    Crossing approaches stay red. Junctions without a signal are left unchanged.
    Returns how many programs were replaced.
    """
    tree = ET.parse(net_path)
    root = tree.getroot()
    bearings: dict[str, float] = {}
    origins: dict[str, set[str]] = {}
    for edge in root.findall("edge"):
        edge_id = edge.get("id") or ""
        if not edge_id or edge_id.startswith(":"):
            continue
        origins[edge_id] = _edge_way_ids(edge)
        bearing = _edge_bearing(edge)
        if bearing is not None:
            bearings[edge_id] = bearing
    replaced = 0
    for logic in list(root.findall("tlLogic")):
        tl_id = logic.get("id")
        if not tl_id:
            continue
        links = [
            (int(conn.get("linkIndex")), conn.get("from") or "")
            for conn in root.findall("connection")
            if conn.get("tl") == tl_id and (conn.get("linkIndex") or "").isdigit()
        ]
        if not links:
            continue
        zaisan = [(index, bearings.get(edge)) for index, edge in links if origins.get(edge, set()) & way_ids]
        if not zaisan:
            continue
        width = max(index for index, _ in links) + 1
        reference = next((bearing for _, bearing in zaisan if bearing is not None), 0.0)
        group_a = [index for index, bearing in zaisan if bearing is None or _angle_delta(bearing, reference) <= 90]
        group_b = [index for index, _bearing in zaisan if index not in group_a]
        target = logic
        if keep_original:
            target = copy.deepcopy(logic)
            target.set("programID", "slow")
            root.insert(list(root).index(logic) + 1, target)
        for child in list(target):
            target.remove(child)
        target.set("type", "static")
        target.set("programID", "slow" if keep_original else "0")
        target.set("offset", "0")
        _phase(target, ZAISAN_GREEN_SECONDS, _signal_state(width, group_a, "G"))
        _phase(target, ZAISAN_YELLOW_SECONDS, _signal_state(width, group_a, "y"))
        _phase(target, ZAISAN_GREEN_SECONDS, _signal_state(width, group_b, "G"))
        _phase(target, ZAISAN_YELLOW_SECONDS, _signal_state(width, group_b, "y"))
        replaced += 1
    if replaced:
        tree.write(net_path, encoding="unicode", xml_declaration=True)
    return replaced


def slow_signal_ids(net_path: Path) -> list[str]:
    root = ET.parse(net_path).getroot()
    return [
        logic_id
        for logic in root.findall("tlLogic")
        if logic.get("programID") == "slow" and (logic_id := logic.get("id"))
    ]


def zaisan_way_ids(osm_path: Path) -> set[str]:
    root = ET.parse(osm_path).getroot()
    found = set()
    for way in root.findall("way"):
        names = {_tag_value(way, key).casefold() for key in ("name", "name:en", "name:mn")}
        if names & ZAISAN_NAMES and way.get("id"):
            found.add(way.get("id"))
    return found


def trip_split(total: int, modes: list[str]) -> list[tuple[str, int]]:
    """Even split. Any remainder stays with the first selected vehicle type."""
    selected = [mode for mode in MODE_ORDER if mode in modes]
    used = selected or ["car"]
    base, remainder = divmod(total, len(used))
    return [(mode, base + (remainder if index == 0 else 0)) for index, mode in enumerate(used)]


def modes_in_edits(edits: list[dict]) -> list[str]:
    found = set()
    for edit in edits:
        if edit.get("op") in {"access", "add"}:
            found.update(edit.get("modes") or [])
    selected = [mode for mode in MODE_ORDER if mode in found]
    return selected or ["car"]


def demand_phrase(counts: list[tuple[str, int]]) -> str:
    labels = {"car": "cars", "bus": "buses", "truck": "trucks", "train": "subway trains"}
    parts = [f"{count} {labels[mode]}" for mode, count in counts if count > 0]
    return ", ".join(parts)


def _add_edit(item: dict, way_id: int) -> dict:
    if way_id <= 0:
        raise ValueError("A new link needs its own id.")
    kind = item.get("kind")
    if kind not in {"road", "highway", "subway", "street", "railway", "bridge", "intersection", "signal"}:
        raise ValueError("A new link is a road, highway, street, bridge, subway, or railway.")
    start = _end(item.get("start"))
    end = _end(item.get("end"))
    edit = {"wayId": way_id, "op": "add", "kind": kind, "modes": _modes(item.get("modes")), "start": start, "end": end}
    points = item.get("points")
    if isinstance(points, list):
        if len(points) < 2 or len(points) > 64:
            raise ValueError("A new link needs its shape.")
        edit["points"] = [_end(point) for point in points]
        edit["start"] = edit["points"][0]
        edit["end"] = edit["points"][-1]
    name = item.get("name")
    if isinstance(name, str) and name.strip():
        edit["name"] = name.strip()[:80]
    lanes = item.get("lanes")
    if lanes is not None:
        if isinstance(lanes, bool) or not isinstance(lanes, int) or lanes < MIN_LANES or lanes > MAX_LANES:
            raise ValueError("Lanes must be a whole number from 1 to 4.")
        edit["lanes"] = lanes
    speed = item.get("maxspeedKmh")
    if speed is not None:
        if isinstance(speed, bool) or not isinstance(speed, int) or speed < MIN_MAXSPEED_KMH or speed > MAX_MAXSPEED_KMH:
            raise ValueError("Speed must be a whole number from 10 to 90 km/h.")
        edit["maxspeedKmh"] = speed
    if item.get("oneway") is True:
        edit["oneway"] = True
    stops = item.get("stops")
    if isinstance(stops, int) and not isinstance(stops, bool) and 1 <= stops <= 40:
        edit["stops"] = stops
    return edit


def _end(value: object) -> dict:
    if not isinstance(value, dict):
        raise ValueError("A new link needs two ends.")
    lon = value.get("longitude")
    lat = value.get("latitude")
    if isinstance(lon, bool) or isinstance(lat, bool) or not isinstance(lon, (int, float)) or not isinstance(lat, (int, float)):
        raise ValueError("A new link needs two ends.")
    if not -180 <= float(lon) <= 180 or not -90 <= float(lat) <= 90:
        raise ValueError("A new link needs two ends.")
    end = {"longitude": float(lon), "latitude": float(lat)}
    along = value.get("along")
    if isinstance(along, dict):
        along_lon = along.get("longitude")
        along_lat = along.get("latitude")
        if (
            not isinstance(along_lon, bool)
            and not isinstance(along_lat, bool)
            and isinstance(along_lon, (int, float))
            and isinstance(along_lat, (int, float))
        ):
            end["along"] = {"longitude": float(along_lon), "latitude": float(along_lat)}
    return end


def _with_shape(edit: dict, item: dict) -> dict:
    shape = item.get("coordinates")
    if shape is None:
        return edit
    if not isinstance(shape, list) or len(shape) < 2 or len(shape) > 500:
        raise ValueError("A road edit needs the road's shape.")
    edit["coordinates"] = [_end(point) for point in shape]
    return edit


def _modes(value: object) -> list[str]:
    if not isinstance(value, list):
        raise ValueError("Choose at least one kind of vehicle.")
    modes = [mode for mode in MODE_ORDER if mode in value]
    if not modes:
        raise ValueError("Choose at least one kind of vehicle.")
    return modes


def _append_link(root: ET.Element, edit: dict) -> None:
    kind = edit["kind"]
    if kind in {"intersection", "signal"}:
        return
    points = edit.get("points") or [edit["start"], edit["end"]]
    refs = []
    last = len(points) - 1
    for index, point in enumerate(points):
        node_id = _vertex(root, point, edit, index == 0 or index == last)
        if not refs or refs[-1] != node_id:
            refs.append(node_id)
    if len(refs) < 2:
        raise ValueError("Choose two different ends.")
    way = ET.SubElement(root, "way", {"id": str(edit["wayId"])})
    for ref in refs:
        ET.SubElement(way, "nd", {"ref": ref})
    if kind == "subway":
        _set_tag(way, "railway", "subway")
    elif kind == "railway":
        _set_tag(way, "railway", "rail")
    elif kind == "highway":
        _set_tag(way, "highway", "motorway")
    elif kind == "street":
        _set_tag(way, "highway", "residential")
    elif kind == "bridge":
        _set_tag(way, "highway", "primary")
        _set_tag(way, "bridge", "yes")
    else:
        _set_tag(way, "highway", "primary")
    if edit.get("name"):
        _set_tag(way, "name", edit["name"])
    if edit.get("oneway"):
        _set_tag(way, "oneway", "yes")
    if edit.get("lanes"):
        _set_tag(way, "lanes", str(edit["lanes"]))
    if edit.get("maxspeedKmh"):
        _set_tag(way, "maxspeed", str(edit["maxspeedKmh"]))
    _apply_access(way, edit["modes"], kind)


def _vertex(root: ET.Element, point: dict, edit: dict, connect: bool) -> str:
    if connect:
        return _node_for_end(root, point, edit)
    found = _nearest_node(root, point)
    if found is not None:
        return found
    node_id = _fresh_id(root, "node", NODE_ID_BASE)
    _insert_node(root, node_id, point["longitude"], point["latitude"])
    return node_id


def _apply_access(way: ET.Element, modes: list[str], kind: str | None) -> None:
    allowed = set(modes)
    if kind not in {"subway", "railway"}:
        _set_tag(way, "motorcar", "yes" if "car" in allowed else "no")
        _set_tag(way, "bus", "yes" if "bus" in allowed else "no")
        _set_tag(way, "hgv", "yes" if "truck" in allowed else "no")


def _node_for_end(root: ET.Element, end: dict, edit: dict) -> str:
    """Use a nearby OSM node, or add one on the clicked road so another district can connect."""
    found = _nearest_node(root, end)
    if found is not None:
        return found
    node_id = _fresh_id(root, "node", NODE_ID_BASE)
    _insert_node(root, node_id, end["longitude"], end["latitude"])
    along = end.get("along") or _offset(end, 60)
    along_id = _nearest_node(root, along)
    if along_id is None or along_id == node_id:
        along_id = _fresh_id(root, "node", NODE_ID_BASE)
        _insert_node(root, along_id, along["longitude"], along["latitude"])
    if along_id != node_id:
        _span_way(root, node_id, along_id, edit)
    return node_id


def _nearest_node(root: ET.Element, end: dict) -> str | None:
    best_id = None
    best_distance = SNAP_METERS + 1
    for node in root.findall("node"):
        lon = node.get("lon")
        lat = node.get("lat")
        if lon is None or lat is None or node.get("id") is None:
            continue
        distance = _meters(float(lon), float(lat), end["longitude"], end["latitude"])
        if distance < best_distance:
            best_distance = distance
            best_id = node.get("id")
    if best_id is None or best_distance > SNAP_METERS:
        return None
    return best_id


def _insert_way(root: ET.Element, way_id: int, coordinates: list[dict]) -> ET.Element:
    refs = []
    for point in coordinates:
        node_id = _nearest_node(root, point)
        if node_id is None:
            node_id = _fresh_id(root, "node", NODE_ID_BASE)
            _insert_node(root, node_id, point["longitude"], point["latitude"])
        if not refs or refs[-1] != node_id:
            refs.append(node_id)
    if len(refs) < 2:
        raise ValueError("A road edit needs the road's shape.")
    way = ET.Element("way", {"id": str(way_id)})
    for ref in refs:
        ET.SubElement(way, "nd", {"ref": ref})
    _set_tag(way, "highway", "unclassified")
    root.append(way)
    return way


def _span_way(root: ET.Element, start: str, end: str, edit: dict) -> None:
    way = ET.SubElement(root, "way", {"id": _fresh_id(root, "way", SPAN_ID_BASE)})
    ET.SubElement(way, "nd", {"ref": start})
    ET.SubElement(way, "nd", {"ref": end})
    if edit["kind"] in {"subway", "railway"}:
        _set_tag(way, "railway", "subway" if edit["kind"] == "subway" else "rail")
    else:
        _set_tag(way, "highway", "unclassified")
    _apply_access(way, edit["modes"], edit["kind"])


def _offset(end: dict, meters: float) -> dict:
    lat = end["latitude"]
    lon = end["longitude"] + meters / (111_320 * max(0.2, math.cos(math.radians(lat))))
    return {"longitude": lon, "latitude": lat}


def _fresh_id(root: ET.Element, tag: str, base: int) -> str:
    used = set()
    for element in root.findall(tag):
        raw = element.get("id")
        if raw and raw.lstrip("-").isdigit():
            used.add(int(raw))
    candidate = base + 1
    while candidate in used:
        candidate += 1
    return str(candidate)


def _insert_node(root: ET.Element, node_id: str, lon: float, lat: float) -> None:
    node = ET.Element("node", {"id": node_id, "lon": f"{lon:.7f}", "lat": f"{lat:.7f}"})
    for index, child in enumerate(list(root)):
        if child.tag == "way":
            root.insert(index, node)
            return
    root.append(node)


def _meters(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    radius = 6_371_000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lon / 2) ** 2
    return 2 * radius * math.asin(math.sqrt(a))


def _tag_value(way: ET.Element, key: str) -> str:
    for tag in way.findall("tag"):
        if tag.get("k") == key:
            return tag.get("v") or ""
    return ""


def _edge_way_ids(edge: ET.Element) -> set[str]:
    orig = ""
    for child in edge:
        if child.tag == "param" and child.get("key") == "origId":
            orig = child.get("value") or ""
    raw = orig or edge.get("id") or ""
    found = set()
    for token in raw.replace("#", " ").replace(",", " ").replace(";", " ").split():
        token = token.lstrip("-")
        if token.isdigit():
            found.add(token)
    return found


def _edge_bearing(edge: ET.Element) -> float | None:
    shape = edge.get("shape")
    if not shape:
        lane = edge.find("lane")
        shape = lane.get("shape") if lane is not None else None
    if not shape:
        return None
    parts = shape.split()
    if len(parts) < 2:
        return None
    x1, y1 = (float(value) for value in parts[0].split(","))
    x2, y2 = (float(value) for value in parts[-1].split(","))
    return math.degrees(math.atan2(x2 - x1, y2 - y1)) % 360


def _angle_delta(left: float, right: float) -> float:
    delta = abs(left - right) % 360
    return min(delta, 360 - delta)


def _signal_state(width: int, green: list[int], letter: str) -> str:
    chars = ["r"] * width
    for index in green:
        if 0 <= index < width:
            chars[index] = letter
    return "".join(chars)


def _phase(logic: ET.Element, duration: int, state: str) -> None:
    ET.SubElement(logic, "phase", {"duration": str(duration), "state": state})


def _set_tag(way: ET.Element, key: str, value: str) -> None:
    for tag in way.findall("tag"):
        if tag.get("k") == key:
            tag.set("v", value)
            return
    ET.SubElement(way, "tag", {"k": key, "v": value})
