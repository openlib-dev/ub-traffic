from __future__ import annotations

import json
import os
import shutil
import subprocess
import threading
from pathlib import Path

from sumo_worker.metrics import clock_label, segment_metrics, simulation_window
from sumo_worker.network import load_edge_index
from sumo_worker.scenario import (
    VCLASS,
    apply_osm_edits,
    curb_closed,
    demand_phrase,
    modes_in_edits,
    patch_zaisan_signals,
    ATTRACTOR_RADIUS_M,
    scenario_digest,
    sink_weights,
    slow_signal_ids,
    source_weights,
    structural_edits,
    trip_split,
    write_edge_weights,
    zaisan_coverage,
    zaisan_slow,
    zaisan_way_ids,
)

DATA = Path(os.environ.get("SIM_DATA", "/data"))
OSM_PATH = DATA / "ulaanbaatar.osm"
NET_PATH = DATA / "ulaanbaatar.net.xml"
ATTRACTORS_PATH = DATA / "attractors.json"


class CancelledRun(Exception):
    pass


def ensure_district_file() -> None:
    if not OSM_PATH.is_file():
        raise RuntimeError("City OSM file is missing. Run npm run district:export.")


def execute_run(config: dict, cancel: threading.Event, progress) -> dict:
    """Run one synthetic SUMO scenario and return the playback timeline."""
    ensure_district_file()
    begin, finish = simulation_window(config["startTime"], config["endTime"])
    seed = int(config["seed"])
    vehicles = int(config["demandIntensity"])
    edits = config.get("edits") or []
    commute = bool(config.get("commuteAttractors", True))
    coverage = zaisan_coverage(begin, finish)
    changing = structural_edits(edits)
    if changing:
        progress(0.05, "Building the edited city network")
        net_path = _ensure_edited_network(changing, cancel)
    else:
        progress(0.05, "Building the city network")
        _ensure_network(cancel)
        net_path = NET_PATH
    if coverage != "never":
        progress(0.1, "Setting the slow Zaisan Street signal")
        net_path = _ensure_zaisan_network(net_path, changing, coverage == "switch", cancel)

    run_dir = DATA / "runs" / "work"
    run_dir.mkdir(parents=True, exist_ok=True)
    trips = run_dir / "trips.xml"
    routes = run_dir / "routes.rou.xml"
    counts = trip_split(vehicles, modes_in_edits(edits))
    if commute:
        progress(0.18, f"Generating estimated demand toward offices and universities ({demand_phrase(counts)}, seed {seed})")
        weights = _commute_weights(net_path, run_dir)
    else:
        progress(0.18, f"Generating estimated demand ({demand_phrase(counts)}, seed {seed})")
        weights = None
    _generate_routes(net_path, trips, routes, begin, finish, counts, seed, cancel, weights)
    trip_count = _count_vehicles(routes)
    if trip_count == 0:
        raise RuntimeError("SUMO could not place passenger-car trips on this city network.")

    progress(0.28, f"Simulating {trip_count} estimated trips")
    frames = _simulate(net_path, routes, begin, finish, cancel, progress, edits, coverage)
    return {
        "scenarioId": config["scenarioId"],
        "seed": seed,
        "demand": "synthetic",
        "vehicleClass": "passenger",
        "tripCount": trip_count,
        "frames": frames,
    }


def _ensure_edited_network(edits: list[dict], cancel: threading.Event) -> Path:
    """Build a net from a copied OSM file. The baseline OSM and net stay in place."""
    digest = scenario_digest(edits)
    osm_path = DATA / "runs" / f"{digest}.osm"
    net_path = DATA / "runs" / f"{digest}.net.xml"
    source_mtime = OSM_PATH.stat().st_mtime
    fresh = (
        osm_path.is_file()
        and net_path.is_file()
        and osm_path.stat().st_mtime >= source_mtime
        and net_path.stat().st_mtime >= osm_path.stat().st_mtime
    )
    if fresh:
        return net_path
    apply_osm_edits(OSM_PATH, osm_path, edits)
    _convert(osm_path, net_path, cancel)
    return net_path


def _ensure_zaisan_network(source: Path, edits: list[dict], keep_original: bool, cancel: threading.Event) -> Path:
    """Copy the network and slow the Zaisan Street signals. The source net stays as it was."""
    if cancel.is_set():
        raise CancelledRun()
    digest = scenario_digest(edits)
    label = "both" if keep_original else "slow"
    dest = DATA / "runs" / f"zaisan-{label}-{digest}.net.xml"
    fresh = dest.is_file() and dest.stat().st_mtime >= source.stat().st_mtime
    if fresh:
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, dest)
    replaced = patch_zaisan_signals(dest, zaisan_way_ids(OSM_PATH), keep_original=keep_original)
    if replaced == 0:
        dest.write_bytes(source.read_bytes())
    return dest


def _ensure_network(cancel: threading.Event) -> None:
    if NET_PATH.is_file() and NET_PATH.stat().st_mtime >= OSM_PATH.stat().st_mtime:
        return
    _convert(OSM_PATH, NET_PATH, cancel)


def _convert(osm_path: Path, net_path: Path, cancel: threading.Event) -> None:
    _run(
        [
            "netconvert",
            "--osm-files",
            str(osm_path),
            "--output-file",
            str(net_path),
            "--geometry.remove",
            "true",
            "--ramps.guess",
            "true",
            "--junctions.join",
            "true",
            "--tls.guess-signals",
            "true",
            "--tls.discard-simple",
            "true",
            "--roundabouts.guess",
            "true",
            "--remove-edges.isolated",
            "true",
            "--ignore-errors",
            "true",
            "--osm.elevation",
            "false",
        ],
        cancel,
    )


def _commute_weights(net_path: Path, run_dir: Path) -> Path:
    if not ATTRACTORS_PATH.is_file():
        raise RuntimeError("Office and university locations are missing. Run npm run attractors:export.")
    catalog = json.loads(ATTRACTORS_PATH.read_text(encoding="utf-8"))
    places = catalog.get("places") or []
    if not places:
        raise RuntimeError("Office and university locations are missing. Run npm run attractors:export.")
    import sumolib

    net = sumolib.net.readNet(str(net_path))
    usable = [edge for edge in net.getEdges() if not edge.getID().startswith(":") and edge.allows("passenger")]
    attractors: set[str] = set()
    for place in places:
        try:
            x, y = net.convertLonLat2XY(float(place["longitude"]), float(place["latitude"]))
        except (KeyError, TypeError, ValueError):
            continue
        for edge, _distance in net.getNeighboringEdges(x, y, ATTRACTOR_RADIUS_M):
            if edge.allows("passenger") and not edge.getID().startswith(":"):
                attractors.add(edge.getID())
    if not attractors:
        raise RuntimeError("No office or university is close enough to the road network.")
    residential = {
        edge.getID()
        for edge in usable
        if "residential" in (edge.getType() or "") or "living" in (edge.getType() or "")
    }
    edge_ids = [edge.getID() for edge in usable]
    prefix = run_dir / "commute"
    write_edge_weights(prefix.with_suffix(".src.xml"), source_weights(edge_ids, residential))
    write_edge_weights(prefix.with_suffix(".dst.xml"), sink_weights(edge_ids, attractors))
    return prefix


def _generate_routes(net, trips, routes, begin, finish, counts, seed, cancel, weights: Path | None = None) -> None:
    tools = Path(os.environ.get("SUMO_HOME", "/usr/share/sumo")) / "tools" / "randomTrips.py"
    parts = []
    for mode, count in counts:
        if count <= 0:
            continue
        part_trips = trips.with_name(f"{mode}.trips.xml")
        part_routes = routes.with_name(f"{mode}.rou.xml")
        period = max((finish - begin) / count, 0.25)
        _run(
            [
                "python3",
                str(tools),
                "-n",
                str(net),
                "-o",
                str(part_trips),
                "-r",
                str(part_routes),
                "--seed",
                str(seed),
                "-b",
                str(begin),
                "-e",
                str(finish),
                "--period",
                f"{period:.3f}",
                "--vehicle-class",
                VCLASS[mode],
                "--prefix",
                mode,
                "--validate",
                "--min-distance",
                "20" if mode == "train" else "50",
            ]
            + (["--weights-prefix", str(weights)] if weights else []),
            cancel,
        )
        parts.append(part_routes)
    _merge_routes(parts, routes)


def _merge_routes(parts: list[Path], dest: Path) -> None:
    import xml.etree.ElementTree as ET

    root = ET.Element("routes")
    for part in parts:
        for child in list(ET.parse(part).getroot()):
            if child.tag in {"vType", "vehicle", "flow"}:
                root.append(child)
    ET.ElementTree(root).write(dest, encoding="unicode", xml_declaration=True)


def _simulate(net, routes, begin, finish, cancel, progress, edits: list[dict] | None = None, coverage: str = "never") -> list[dict]:
    import traci

    index = load_edge_index(str(net))
    if not index:
        raise RuntimeError("The SUMO network has no edges tied to an OpenStreetMap way.")

    traci.start(
        [
            "sumo",
            "-n",
            str(net),
            "-r",
            str(routes),
            "--begin",
            str(begin),
            "--end",
            str(finish),
            "--no-step-log",
            "true",
            "--time-to-teleport",
            "120",
            "--ignore-route-errors",
            "true",
        ],
        label="ub",
    )
    frames = []
    duration = max(finish - begin, 1)
    curb = _curb_lanes(index, edits or [])
    curb_state: dict[str, bool] = {}
    signals = slow_signal_ids(Path(net)) if coverage == "switch" else []
    signal_state: dict[str, str] = {}
    try:
        while traci.simulation.getTime() < finish:
            if cancel.is_set():
                raise CancelledRun()
            try:
                traci.simulationStep()
            except Exception as exc:
                if type(exc).__name__ not in {"TraCIException", "FatalTraCIError"}:
                    raise
                break
            now = traci.simulation.getTime()
            _apply_zaisan(traci, signals, now, signal_state)
            _apply_curb(traci, curb, now, begin, finish, curb_state)
            frames.append(_frame(traci, index, now))
            if len(frames) % 15 == 0:
                fraction = 0.28 + 0.67 * min((now - begin) / duration, 1)
                progress(fraction, f"Simulating {clock_label(now)}")
            if traci.simulation.getMinExpectedNumber() <= 0 and now >= begin:
                break
    finally:
        traci.close()
    if not frames:
        raise RuntimeError("SUMO finished without a recorded timestep.")
    return frames


def _curb_lanes(index: dict[str, tuple[int, float]], edits: list[dict]) -> list[tuple[str, str]]:
    """Rightmost SUMO lane for each parked or stalled way. Lane 0 is the curb lane."""
    wanted = {edit["wayId"]: edit["op"] for edit in edits if edit.get("op") in {"park", "stall"}}
    lanes = []
    for edge_id, (way_id, _) in index.items():
        op = wanted.get(way_id)
        if op:
            lanes.append((f"{edge_id}_0", op))
    return lanes


def _apply_zaisan(traci, signals: list[str], now: float, state: dict[str, str]) -> None:
    if not signals:
        return
    program = "slow" if zaisan_slow(now) else "0"
    if state.get("program") == program:
        return
    for tl_id in signals:
        try:
            traci.trafficlight.setProgram(tl_id, program)
        except Exception as exc:
            if type(exc).__name__ not in {"TraCIException", "FatalTraCIError"}:
                raise
    state["program"] = program


def _apply_curb(traci, lanes: list[tuple[str, str]], now: float, begin: int, finish: int, state: dict[str, bool]) -> None:
    blocked = {"passenger", "bus", "truck", "motorcycle", "bicycle"}
    for lane_id, op in lanes:
        closed = curb_closed(op, now, begin, finish)
        if state.get(lane_id) is closed:
            continue
        try:
            if closed:
                current = set(traci.lane.getDisallowed(lane_id))
                traci.lane.setDisallowed(lane_id, sorted(current | blocked))
            else:
                current = set(traci.lane.getDisallowed(lane_id))
                traci.lane.setDisallowed(lane_id, sorted(current - blocked))
        except Exception as exc:
            if type(exc).__name__ not in {"TraCIException", "FatalTraCIError"}:
                raise
            continue
        state[lane_id] = closed


def _frame(traci, index, now: float) -> dict:
    vehicles = []
    speeds: dict[str, list[float]] = {}
    for veh_id in traci.vehicle.getIDList():
        x, y = traci.vehicle.getPosition(veh_id)
        lon, lat = _lon_lat(traci, x, y)
        vehicles.append(
            {
                "id": veh_id,
                "longitude": round(lon, 6),
                "latitude": round(lat, 6),
                "bearing": round(traci.vehicle.getAngle(veh_id), 1),
            }
        )
        edge_id = traci.vehicle.getRoadID(veh_id)
        if edge_id and not edge_id.startswith(":"):
            speeds.setdefault(edge_id, []).append(traci.vehicle.getSpeed(veh_id))

    samples = []
    for edge_id, edge_speeds in speeds.items():
        mapped = index.get(edge_id)
        if mapped is None:
            continue
        way_id, limit = mapped
        mean = sum(edge_speeds) / len(edge_speeds)
        samples.append((way_id, len(edge_speeds), mean, limit))

    return {
        "timestamp": clock_label(now),
        "vehicles": vehicles,
        "segments": segment_metrics(samples),
    }


def _lon_lat(traci, x: float, y: float) -> tuple[float, float]:
    lon, lat = traci.simulation.convertGeo(x, y)
    if _in_mongolia(lon, lat):
        return lon, lat
    if _in_mongolia(lat, lon):
        return lat, lon
    raise RuntimeError("SUMO positions could not be converted to longitude and latitude.")


def _in_mongolia(lon: float, lat: float) -> bool:
    return 90 <= lon <= 120 and 40 <= lat <= 55


def _count_vehicles(routes: Path) -> int:
    if not routes.is_file():
        return 0
    text = routes.read_text(encoding="utf-8", errors="replace")
    return text.count("<vehicle ")


def _run(args: list[str], cancel: threading.Event) -> None:
    proc = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    while proc.poll() is None:
        if cancel.is_set():
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
            raise CancelledRun()
        threading.Event().wait(0.2)
    stdout, stderr = proc.communicate()
    if proc.returncode != 0:
        detail = (stderr or stdout or "command failed").strip()
        raise RuntimeError(detail[-700:])


def write_timeline(path: Path, run_id: str, timeline: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {"runId": run_id, **timeline}
    path.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
