import json
import tempfile
import unittest
from pathlib import Path

from sumo_worker.runner import stored_timeline, write_timeline


class StoredTimelineTest(unittest.TestCase):
    def test_reads_a_finished_run_after_it_left_memory(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            write_timeline(root / "abc123.json", "abc123", {"frames": [{"timestamp": "07:30:00"}]})
            payload = stored_timeline(root, "abc123")
            self.assertEqual(payload["runId"], "abc123")
            self.assertEqual(payload["frames"][0]["timestamp"], "07:30:00")

    def test_rejects_a_path_outside_the_runs_directory(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "secret.json").write_text("{}", encoding="utf-8")
            self.assertIsNone(stored_timeline(root, "../secret"))
            self.assertIsNone(stored_timeline(root, "missing"))

    def test_rejects_a_file_for_a_different_run(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "abc123.json").write_text(json.dumps({"runId": "other", "frames": []}), encoding="utf-8")
            self.assertIsNone(stored_timeline(root, "abc123"))
