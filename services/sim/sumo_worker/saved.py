from __future__ import annotations

import json
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path

from sumo_worker.scenario import validate_edits

CLOCK = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
STAMP = re.compile(r"^\d{2}:\d{2}:\d{2}$")
ID = re.compile(r"^[a-f0-9]{12}$")
MAX_NAME = 80


def parse_saved_body(body: dict) -> dict:
    """Return a stored result. Raises ValueError when the summary is not usable."""
    if not isinstance(body, dict):
        raise ValueError("A saved result must be an object.")
    name = body.get("name")
    if not isinstance(name, str) or not name.strip() or len(name.strip()) > MAX_NAME:
        raise ValueError("A saved result needs a name.")
    start = body.get("startTime")
    end = body.get("endTime")
    if not isinstance(start, str) or not isinstance(end, str) or not CLOCK.match(start) or not CLOCK.match(end):
        raise ValueError("A saved result needs a clock range.")
    vehicles = body.get("demandIntensity")
    seed = body.get("seed")
    if isinstance(vehicles, bool) or not isinstance(vehicles, int) or not 1 <= vehicles <= 5000:
        raise ValueError("Vehicles must be a whole number from 1 to 5000.")
    if isinstance(seed, bool) or not isinstance(seed, int) or not 0 <= seed <= 2_147_483_647:
        raise ValueError("Seed must be a whole number from 0 to 2147483647.")
    if not isinstance(body.get("commuteAttractors"), bool):
        raise ValueError("Morning commute must be true or false.")
    edits = validate_edits(body.get("edits") or [])
    summary = _summary(body.get("summary"))
    return {
        "id": uuid.uuid4().hex[:12],
        "name": name.strip(),
        "createdAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "startTime": start,
        "endTime": end,
        "demandIntensity": vehicles,
        "seed": seed,
        "commuteAttractors": body["commuteAttractors"],
        "edits": edits,
        "summary": summary,
    }


def write_saved(directory: Path, record: dict) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / f"{record['id']}.json"
    path.write_text(json.dumps(record, separators=(",", ":")), encoding="utf-8")


def list_saved(directory: Path) -> list[dict]:
    if not directory.is_dir():
        return []
    items = []
    for path in directory.glob("*.json"):
        try:
            record = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        if not isinstance(record, dict) or not ID.match(str(record.get("id", ""))):
            continue
        summary = record.get("summary") if isinstance(record.get("summary"), dict) else {}
        items.append(
            {
                "id": record["id"],
                "name": record.get("name") or record["id"],
                "createdAt": record.get("createdAt") or "",
                "startTime": record.get("startTime") or "",
                "endTime": record.get("endTime") or "",
                "demandIntensity": record.get("demandIntensity") or 0,
                "commuteAttractors": bool(record.get("commuteAttractors")),
                "editCount": len(record.get("edits") or []),
                "totalSevereSeconds": summary.get("totalSevereSeconds") or 0,
            }
        )
    items.sort(key=lambda item: item["createdAt"], reverse=True)
    return items


def read_saved(directory: Path, saved_id: str) -> dict | None:
    if not ID.match(saved_id):
        return None
    path = directory / f"{saved_id}.json"
    if not path.is_file():
        return None
    record = json.loads(path.read_text(encoding="utf-8"))
    return record if isinstance(record, dict) else None


def delete_saved(directory: Path, saved_id: str) -> bool:
    if not ID.match(saved_id):
        return False
    path = directory / f"{saved_id}.json"
    if not path.is_file():
        return False
    path.unlink()
    return True


def _summary(value: object) -> dict:
    if not isinstance(value, dict):
        raise ValueError("A saved result needs its severe-road summary.")
    total = value.get("totalSevereSeconds")
    roads = value.get("roads")
    series = value.get("series")
    if isinstance(total, bool) or not isinstance(total, int) or total < 0:
        raise ValueError("Severe seconds must be a whole number.")
    if not isinstance(roads, list) or len(roads) > 20_000 or not isinstance(series, list) or len(series) > 900:
        raise ValueError("The severe-road summary is too large.")
    cleaned_roads = []
    for road in roads:
        if not isinstance(road, dict):
            raise ValueError("Each bottleneck needs a road.")
        road_id = road.get("roadId")
        seconds = road.get("severeSeconds")
        speed = road.get("lowestSpeedKmh")
        label = road.get("label")
        if isinstance(road_id, bool) or not isinstance(road_id, int) or road_id <= 0:
            raise ValueError("Each bottleneck needs a road.")
        if isinstance(seconds, bool) or not isinstance(seconds, int) or seconds < 0:
            raise ValueError("Severe seconds must be a whole number.")
        if isinstance(speed, bool) or not isinstance(speed, (int, float)) or speed < 0:
            raise ValueError("Each bottleneck needs a speed.")
        if not isinstance(label, str):
            raise ValueError("Each bottleneck needs a name.")
        cleaned_roads.append(
            {"roadId": road_id, "severeSeconds": seconds, "lowestSpeedKmh": float(speed), "label": label[:120]}
        )
    cleaned_series = []
    for point in series:
        if not isinstance(point, dict):
            raise ValueError("Each second needs a severe-road count.")
        timestamp = point.get("timestamp")
        count = point.get("count")
        if not isinstance(timestamp, str) or not STAMP.match(timestamp):
            raise ValueError("Each second needs a clock time.")
        if isinstance(count, bool) or not isinstance(count, int) or count < 0:
            raise ValueError("Each second needs a severe-road count.")
        cleaned_series.append({"timestamp": timestamp, "count": count})
    return {"totalSevereSeconds": total, "roads": cleaned_roads, "series": cleaned_series}
