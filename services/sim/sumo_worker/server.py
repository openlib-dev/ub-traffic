from __future__ import annotations

import asyncio
import logging
import threading
import uuid
from contextlib import asynccontextmanager

from fastapi import Body, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from sumo_worker.metrics import simulation_window
from sumo_worker.runner import DATA, CancelledRun, execute_run, stored_timeline, write_timeline
from sumo_worker.saved import delete_saved, list_saved, parse_saved_body, read_saved, write_saved
from sumo_worker.scenario import validate_edits
from sumo_worker.templates import (
    delete_template,
    list_templates,
    parse_template_body,
    read_template,
    replace_template_edits,
    write_template,
)

SAVED_DIR = DATA / "runs" / "saved"
TEMPLATE_DIR = DATA / "runs" / "templates"

log = logging.getLogger("sumo_worker")
TERMINAL = {"finished", "cancelled", "error"}


class SimulationConfigIn(BaseModel):
    scenarioId: str = Field(min_length=1, max_length=80)
    startTime: str
    endTime: str
    demandIntensity: int = Field(ge=1, le=5000)
    speed: int
    seed: int = Field(ge=0, le=2_147_483_647)
    edits: list[dict] = Field(default_factory=list)
    commuteAttractors: bool = True


class RunRecord:
    def __init__(self, run_id: str, config: dict):
        self.run_id = run_id
        self.config = config
        self.status = "running"
        self.cancel = threading.Event()
        self.events: list[dict] = []
        self.subscribers: list[asyncio.Queue] = []
        self.timeline: dict | None = None
        self.lock = threading.Lock()


class State:
    def __init__(self):
        self.loop: asyncio.AbstractEventLoop | None = None
        self.run: RunRecord | None = None
        self.lock = threading.Lock()


state = State()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    state.loop = asyncio.get_running_loop()
    (DATA / "runs").mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/runs/active")
def active_run():
    record = state.run
    if record is None:
        return {"runId": None}
    with record.lock:
        progress = next((event for event in reversed(record.events) if event.get("type") == "progress"), None)
    return {
        "runId": record.run_id,
        "status": record.status,
        "fraction": progress["fraction"] if progress else 0,
        "message": progress["message"] if progress else "",
    }


@app.post("/runs")
def start_run(config: SimulationConfigIn):
    try:
        simulation_window(config.startTime, config.endTime)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if config.speed not in {1, 2, 5, 10}:
        raise HTTPException(status_code=400, detail="Playback speed must be 1, 2, 5, or 10.")
    try:
        edits = validate_edits(config.edits)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    with state.lock:
        if state.run is not None and state.run.status == "running":
            raise HTTPException(status_code=409, detail="A simulation is already running.")
        payload = config.model_dump()
        payload["edits"] = edits
        record = RunRecord(uuid.uuid4().hex[:12], payload)
        state.run = record

    threading.Thread(target=_worker, args=(record,), daemon=True).start()
    return {"runId": record.run_id}


@app.post("/runs/{run_id}/cancel")
def cancel_run(run_id: str):
    record = _record(run_id)
    if record.status == "running":
        record.cancel.set()
    return {"ok": True}


@app.get("/saved")
def saved_index():
    return list_saved(SAVED_DIR)


@app.get("/saved/{saved_id}")
def saved_result(saved_id: str):
    record = read_saved(SAVED_DIR, saved_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Unknown saved result.")
    return record


@app.post("/saved")
def save_result(body: dict = Body(...)):
    try:
        record = parse_saved_body(body)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    write_saved(SAVED_DIR, record)
    return {"id": record["id"]}


@app.delete("/saved/{saved_id}")
def remove_saved(saved_id: str):
    if not delete_saved(SAVED_DIR, saved_id):
        raise HTTPException(status_code=404, detail="Unknown saved result.")
    return {"ok": True}


@app.get("/templates")
def template_index():
    return list_templates(TEMPLATE_DIR)


@app.get("/templates/{template_id}")
def template_result(template_id: str):
    record = read_template(TEMPLATE_DIR, template_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Unknown template.")
    return record


@app.post("/templates")
def save_template(body: dict = Body(...)):
    try:
        record = parse_template_body(body)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    write_template(TEMPLATE_DIR, record)
    return {"id": record["id"]}


@app.put("/templates/{template_id}")
def update_template(template_id: str, body: dict = Body(...)):
    try:
        edits = (body or {}).get("edits") or []
        record = replace_template_edits(TEMPLATE_DIR, template_id, edits)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if record is None:
        raise HTTPException(status_code=404, detail="Unknown template.")
    return {"ok": True}


@app.delete("/templates/{template_id}")
def remove_template(template_id: str):
    if not delete_template(TEMPLATE_DIR, template_id):
        raise HTTPException(status_code=404, detail="Unknown template.")
    return {"ok": True}


@app.get("/runs/{run_id}/timeline")
def timeline(run_id: str):
    record = state.run
    if record is not None and record.run_id == run_id:
        if record.timeline is None:
            raise HTTPException(status_code=409, detail="The simulation has not finished.")
        return record.timeline
    stored = stored_timeline(DATA / "runs", run_id)
    if stored is None:
        raise HTTPException(status_code=404, detail="Unknown run.")
    return stored


@app.websocket("/runs/{run_id}/events")
async def events(websocket: WebSocket, run_id: str):
    await websocket.accept()
    record = state.run if state.run and state.run.run_id == run_id else None
    if record is None:
        await websocket.send_json({"type": "error", "runId": run_id, "message": "Unknown run."})
        await websocket.close()
        return

    queue: asyncio.Queue = asyncio.Queue()
    with record.lock:
        prior = list(record.events)
        record.subscribers.append(queue)
    try:
        for event in prior:
            await websocket.send_json(event)
        if prior and prior[-1]["type"] in TERMINAL:
            return
        while True:
            event = await queue.get()
            await websocket.send_json(event)
            if event["type"] in TERMINAL:
                return
    except WebSocketDisconnect:
        return
    finally:
        with record.lock:
            if queue in record.subscribers:
                record.subscribers.remove(queue)


def _record(run_id: str) -> RunRecord:
    record = state.run
    if record is None or record.run_id != run_id:
        raise HTTPException(status_code=404, detail="Unknown run.")
    return record


def _worker(record: RunRecord) -> None:
    def progress(fraction: float, message: str) -> None:
        _publish(record, {
            "type": "progress",
            "runId": record.run_id,
            "fraction": round(max(0, min(fraction, 1)), 3),
            "message": message,
        })

    try:
        timeline = execute_run(record.config, record.cancel, progress)
        payload = {"runId": record.run_id, "frames": timeline["frames"]}
        path = DATA / "runs" / f"{record.run_id}.json"
        write_timeline(path, record.run_id, {"frames": timeline["frames"]})
        record.timeline = payload
        record.status = "ready"
        _publish(record, {"type": "finished", "runId": record.run_id})
    except CancelledRun:
        record.status = "cancelled"
        _publish(record, {"type": "cancelled", "runId": record.run_id})
    except Exception as exc:
        log.exception("run failed")
        record.status = "error"
        _publish(record, {"type": "error", "runId": record.run_id, "message": str(exc)[:500]})


def _publish(record: RunRecord, event: dict) -> None:
    with record.lock:
        record.events.append(event)
        subscribers = list(record.subscribers)
    loop = state.loop
    if loop is None:
        return
    for queue in subscribers:
        loop.call_soon_threadsafe(queue.put_nowait, event)
