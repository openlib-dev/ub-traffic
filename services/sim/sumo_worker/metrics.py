"""Speed bands and OSM ids shared with the web app.

The same thresholds live in apps/web/src/domain/simulation.ts.
"""

from __future__ import annotations

CONGESTION_BANDS = (
    (0.8, "free"),
    (0.5, "moderate"),
    (0.25, "heavy"),
)


def congestion_from_ratio(speed_kmh: float, limit_kmh: float) -> str | None:
    if speed_kmh < 0 or limit_kmh <= 0:
        return None
    ratio = speed_kmh / limit_kmh
    for threshold, level in CONGESTION_BANDS:
        if ratio > threshold:
            return level
    return "severe"


def osm_way_id(edge_id: str, orig_id: str | None = None) -> int | None:
    """Map a SUMO edge to one OpenStreetMap way id.

    Internal junction edges and edges joined from several ways are omitted.
    """
    if not edge_id or edge_id.startswith(":"):
        return None
    raw = (orig_id or "").strip() or edge_id
    if any(separator in raw for separator in (" ", ",", ";")):
        return None
    raw = raw.split("#", 1)[0]
    if raw.startswith("-"):
        raw = raw[1:]
    if not raw.isdigit():
        return None
    return int(raw)


def segment_metrics(samples: list[tuple[int, int, float, float]]) -> list[dict]:
    """Collapse per-edge samples onto OSM way ids.

    Each sample is (osm way id, vehicle count, mean speed m/s, speed limit m/s).
    Edges with no vehicles are not sampled, so they stay unpainted.
    """
    grouped: dict[int, list[tuple[int, float, float]]] = {}
    for osm_id, count, speed_m_s, limit_m_s in samples:
        if count <= 0 or speed_m_s < 0 or limit_m_s <= 0:
            continue
        grouped.setdefault(osm_id, []).append((count, speed_m_s, limit_m_s))

    segments = []
    for osm_id, rows in grouped.items():
        total = sum(count for count, _, _ in rows)
        speed_kmh = sum(count * speed for count, speed, _ in rows) / total * 3.6
        limit_kmh = sum(count * limit for count, _, limit in rows) / total * 3.6
        level = congestion_from_ratio(speed_kmh, limit_kmh)
        if level is None:
            continue
        segments.append(
            {
                "roadId": osm_id,
                "speedKmh": round(speed_kmh, 1),
                "congestion": level,
            }
        )
    segments.sort(key=lambda item: item["roadId"])
    return segments


def simulation_window(start: str, end: str) -> tuple[int, int]:
    begin = _clock_seconds(start)
    finish = _clock_seconds(end)
    if begin is None or finish is None or finish <= begin:
        raise ValueError("Simulation window must be a clock range such as 07:30–07:45.")
    duration = finish - begin
    if duration > 15 * 60:
        raise ValueError("This worker runs at most 15 minutes of simulated time.")
    if duration < 60:
        raise ValueError("Simulation window must be at least one minute.")
    return begin, finish


def clock_label(seconds: float) -> str:
    total = max(0, int(seconds))
    hours, remainder = divmod(total, 3600)
    minutes, secs = divmod(remainder, 60)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}"


def _clock_seconds(value: str) -> int | None:
    parts = value.split(":")
    if len(parts) != 2 or not all(part.isdigit() for part in parts):
        return None
    hours, minutes = int(parts[0]), int(parts[1])
    if hours > 23 or minutes > 59:
        return None
    return hours * 3600 + minutes * 60
