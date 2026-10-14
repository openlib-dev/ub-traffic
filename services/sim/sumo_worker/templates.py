from __future__ import annotations

import json
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path

from sumo_worker.scenario import validate_edits

ID = re.compile(r"^[a-f0-9]{12}$")
MAX_NAME = 80


def parse_template_body(body: dict) -> dict:
    """Return a stored template. A template is a name and road edits, with no traffic summary."""
    if not isinstance(body, dict):
        raise ValueError("A template must be an object.")
    name = body.get("name")
    if not isinstance(name, str) or not name.strip() or len(name.strip()) > MAX_NAME:
        raise ValueError("A template needs a name.")
    edits = validate_edits(body.get("edits") or [])
    return {
        "id": uuid.uuid4().hex[:12],
        "name": name.strip(),
        "createdAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "edits": edits,
    }


def write_template(directory: Path, record: dict) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / f"{record['id']}.json"
    path.write_text(json.dumps(record, separators=(",", ":")), encoding="utf-8")


def list_templates(directory: Path) -> list[dict]:
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
        edits = record.get("edits") if isinstance(record.get("edits"), list) else []
        items.append(
            {
                "id": record["id"],
                "name": record.get("name") or record["id"],
                "createdAt": record.get("createdAt") or "",
                "editCount": len(edits),
            }
        )
    items.sort(key=lambda item: item["createdAt"], reverse=True)
    return items


def read_template(directory: Path, template_id: str) -> dict | None:
    if not ID.match(template_id):
        return None
    path = directory / f"{template_id}.json"
    if not path.is_file():
        return None
    record = json.loads(path.read_text(encoding="utf-8"))
    return record if isinstance(record, dict) else None


def replace_template_edits(directory: Path, template_id: str, edits: list) -> dict | None:
    record = read_template(directory, template_id)
    if record is None:
        return None
    record["edits"] = validate_edits(edits)
    write_template(directory, record)
    return record


def delete_template(directory: Path, template_id: str) -> bool:
    if not ID.match(template_id):
        return False
    path = directory / f"{template_id}.json"
    if not path.is_file():
        return False
    path.unlink()
    return True
