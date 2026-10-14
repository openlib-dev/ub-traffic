import tempfile
import unittest
from pathlib import Path

from sumo_worker.templates import list_templates, parse_template_body, write_template


def highway():
    return {
        "wayId": 8000000000001,
        "op": "add",
        "kind": "highway",
        "modes": ["car"],
        "start": {"longitude": 106.9, "latitude": 47.92},
        "end": {"longitude": 106.93, "latitude": 47.92},
    }


class TemplateTest(unittest.TestCase):
    def test_an_empty_template_is_a_copy_of_the_base_map(self):
        record = parse_template_body({"name": "Empty", "edits": []})
        self.assertEqual(record["edits"], [])

    def test_stores_the_name_and_edits(self):
        record = parse_template_body({"name": "  Ring highway ", "edits": [highway()]})
        self.assertEqual(record["name"], "Ring highway")
        self.assertEqual(record["edits"][0]["kind"], "highway")
        self.assertNotIn("summary", record)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            write_template(root, record)
            listed = list_templates(root)
        self.assertEqual(listed[0]["name"], "Ring highway")
        self.assertEqual(listed[0]["editCount"], 1)
