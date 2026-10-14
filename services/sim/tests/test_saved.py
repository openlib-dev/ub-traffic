import tempfile
import unittest
from pathlib import Path

from sumo_worker.saved import list_saved, parse_saved_body, write_saved


def body(**overrides):
    payload = {
        "name": "Morning",
        "startTime": "07:30",
        "endTime": "07:45",
        "demandIntensity": 2000,
        "seed": 42,
        "commuteAttractors": True,
        "edits": [],
        "summary": {
            "totalSevereSeconds": 90,
            "roads": [{"roadId": 1, "severeSeconds": 90, "lowestSpeedKmh": 8, "label": "Peace"}],
            "series": [{"timestamp": "07:30:00", "count": 1}],
        },
    }
    payload.update(overrides)
    return payload


class SavedResultTest(unittest.TestCase):
    def test_rejects_a_blank_name_and_a_negative_count(self):
        with self.assertRaises(ValueError):
            parse_saved_body(body(name="  "))
        bad = body()
        bad["summary"] = {**bad["summary"], "totalSevereSeconds": -1}
        with self.assertRaises(ValueError):
            parse_saved_body(bad)

    def test_lists_saved_results_newest_first(self):
        first = parse_saved_body(body(name="First"))
        second = parse_saved_body(body(name="Second"))
        second["createdAt"] = "2026-10-14T00:00:00Z"
        first["createdAt"] = "2026-10-13T00:00:00Z"
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            write_saved(root, first)
            write_saved(root, second)
            listed = list_saved(root)
        self.assertEqual([item["name"] for item in listed], ["Second", "First"])
        self.assertEqual(listed[0]["totalSevereSeconds"], 90)
        self.assertEqual(listed[0]["editCount"], 0)
