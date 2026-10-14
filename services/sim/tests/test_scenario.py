import tempfile
import unittest
from pathlib import Path

from sumo_worker.scenario import (
    apply_osm_edits,
    curb_closed,
    patch_zaisan_signals,
    sink_weights,
    write_edge_weights,
    zaisan_coverage,
    zaisan_slow,
)

SAMPLE = """<?xml version="1.0" encoding="UTF-8"?>
<osm version="0.6" generator="ub-simulation">
<node id="10" lat="47.920000" lon="106.910000"/>
<node id="11" lat="47.921000" lon="106.911000"/>
<node id="12" lat="47.922000" lon="106.912000"/>
<node id="13" lat="47.923000" lon="106.913000"/>
<way id="1"><nd ref="10"/><nd ref="11"/><tag k="highway" v="residential"/></way>
<way id="2"><nd ref="11"/><nd ref="12"/><tag k="highway" v="residential"/><tag k="lanes" v="1"/></way>
<way id="3"><nd ref="12"/><nd ref="13"/><tag k="highway" v="primary"/></way>
</osm>
"""


class ScenarioTest(unittest.TestCase):
    def test_apply_edits_leaves_the_source_unchanged(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "base.osm"
            source.write_text(SAMPLE, encoding="utf-8")
            before = source.read_bytes()
            dest = root / "edited.osm"
            apply_osm_edits(
                source,
                dest,
                [
                    {"wayId": 1, "op": "close"},
                    {"wayId": 2, "op": "lanes", "lanes": 3},
                    {"wayId": 3, "op": "maxspeed", "maxspeedKmh": 40},
                ],
            )
            self.assertEqual(source.read_bytes(), before)
            text = dest.read_text(encoding="utf-8")
            self.assertNotIn('id="1"', text)
            self.assertIn('k="lanes" v="3"', text)
            self.assertIn('k="maxspeed" v="40"', text)
            self.assertIn('id="2"', text)
            self.assertIn('id="3"', text)

    def test_added_links_are_written_only_on_the_copy(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "base.osm"
            source.write_text(SAMPLE, encoding="utf-8")
            before = source.read_bytes()
            dest = root / "edited.osm"
            apply_osm_edits(
                source,
                dest,
                [
                    {
                        "wayId": 8_000_000_000_001,
                        "op": "add",
                        "kind": "highway",
                        "modes": ["car"],
                        "start": {"longitude": 106.91, "latitude": 47.92},
                        "end": {"longitude": 106.911, "latitude": 47.921},
                    },
                    {
                        "wayId": 8_000_000_000_002,
                        "op": "add",
                        "kind": "subway",
                        "modes": ["train"],
                        "start": {"longitude": 106.91, "latitude": 47.92},
                        "end": {"longitude": 106.912, "latitude": 47.922},
                    },
                    {
                        "wayId": 8_000_000_000_003,
                        "op": "add",
                        "kind": "road",
                        "modes": ["bus"],
                        "start": {"longitude": 106.912, "latitude": 47.922},
                        "end": {"longitude": 106.913, "latitude": 47.923},
                    },
                ],
            )
            self.assertEqual(source.read_bytes(), before)
            text = dest.read_text(encoding="utf-8")
            self.assertIn('k="highway" v="motorway"', text)
            self.assertIn('k="railway" v="subway"', text)
            self.assertIn('k="highway" v="primary"', text)
            self.assertIn('k="bus" v="yes"', text)

    def test_a_surface_link_keeps_every_vertex(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "base.osm"
            source.write_text(SAMPLE, encoding="utf-8")
            dest = root / "edited.osm"
            apply_osm_edits(
                source,
                dest,
                [
                    {
                        "wayId": 8_000_000_000_009,
                        "op": "add",
                        "kind": "highway",
                        "modes": ["car"],
                        "lanes": 3,
                        "start": {"longitude": 107.5, "latitude": 47.5},
                        "end": {"longitude": 107.52, "latitude": 47.52},
                        "points": [
                            {"longitude": 107.5, "latitude": 47.5},
                            {"longitude": 107.51, "latitude": 47.51},
                            {"longitude": 107.52, "latitude": 47.52},
                        ],
                    }
                ],
            )
            text = dest.read_text(encoding="utf-8")
            self.assertIn('lat="47.5100000"', text)
            self.assertIn('k="lanes" v="3"', text)
            way = text.split('id="8000000000009"', 1)[1].split("</way>", 1)[0]
            self.assertEqual(way.count("<nd "), 3)

    def test_a_link_outside_the_district_is_added_on_the_copy(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "base.osm"
            source.write_text(SAMPLE, encoding="utf-8")
            before = source.read_bytes()
            dest = root / "edited.osm"
            apply_osm_edits(
                source,
                dest,
                [
                    {
                        "wayId": 8_000_000_000_004,
                        "op": "add",
                        "kind": "road",
                        "modes": ["car"],
                        "start": {
                            "longitude": 107.21,
                            "latitude": 47.21,
                            "along": {"longitude": 107.22, "latitude": 47.21},
                        },
                        "end": {
                            "longitude": 107.21,
                            "latitude": 47.22,
                            "along": {"longitude": 107.22, "latitude": 47.22},
                        },
                    }
                ],
            )
            self.assertEqual(source.read_bytes(), before)
            text = dest.read_text(encoding="utf-8")
            self.assertIn('id="8000000000004"', text)
            self.assertIn('lat="47.2100000"', text)
            self.assertIn('k="highway" v="primary"', text)
            self.assertIn('k="highway" v="unclassified"', text)

    def test_construction_drops_one_lane_and_caps_speed(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "base.osm"
            source.write_text(SAMPLE, encoding="utf-8")
            before = source.read_bytes()
            dest = root / "edited.osm"
            apply_osm_edits(source, dest, [{"wayId": 3, "op": "construction"}])
            self.assertEqual(source.read_bytes(), before)
            text = dest.read_text(encoding="utf-8")
            self.assertIn('id="3"', text)
            self.assertIn('k="lanes" v="1"', text)
            self.assertIn('k="maxspeed" v="30"', text)

    def test_curb_lane_timing(self):
        begin, finish = 7 * 3600 + 30 * 60, 7 * 3600 + 45 * 60
        self.assertTrue(curb_closed("park", begin, begin, finish))
        self.assertFalse(curb_closed("park", begin + 120, begin, finish))
        self.assertTrue(curb_closed("stall", begin + 450, begin, finish))
        self.assertFalse(curb_closed("stall", begin + 10, begin, finish))

    def test_zaisan_signal_keeps_the_cross_street_red(self):
        net = """<?xml version="1.0" encoding="UTF-8"?>
<net>
<edge id="north" from="a" to="j">
<lane id="north_0" speed="10" length="10" shape="0,0 0,10"/>
<param key="origId" value="40002943"/>
</edge>
<edge id="south" from="b" to="j">
<lane id="south_0" speed="10" length="10" shape="0,20 0,10"/>
<param key="origId" value="40002943"/>
</edge>
<edge id="cross" from="c" to="j">
<lane id="cross_0" speed="10" length="10" shape="-10,10 0,10"/>
<param key="origId" value="9"/>
</edge>
<tlLogic id="j" type="static" programID="0" offset="0">
<phase duration="30" state="GGG"/>
</tlLogic>
<connection from="north" to="out" fromLane="0" toLane="0" tl="j" linkIndex="0"/>
<connection from="south" to="out" fromLane="0" toLane="0" tl="j" linkIndex="1"/>
<connection from="cross" to="out" fromLane="0" toLane="0" tl="j" linkIndex="2"/>
</net>
"""
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "net.xml"
            path.write_text(net, encoding="utf-8")
            replaced = patch_zaisan_signals(path, {"40002943"})
            self.assertEqual(replaced, 1)
            text = path.read_text(encoding="utf-8")
            self.assertIn('duration="55"', text)
            self.assertNotIn('state="GGG"', text)
            for state in ("Grr", "yrr", "rGr", "ryr"):
                self.assertIn(f'state="{state}"', text)

    def test_zaisan_follows_office_hours(self):
        self.assertTrue(zaisan_slow(7 * 3600 + 45 * 60))
        self.assertTrue(zaisan_slow(18 * 3600))
        self.assertFalse(zaisan_slow(9 * 3600))
        self.assertFalse(zaisan_slow(12 * 3600))
        self.assertEqual(zaisan_coverage(10 * 3600, 10 * 3600 + 15 * 60), "never")
        self.assertEqual(zaisan_coverage(7 * 3600 + 30 * 60, 7 * 3600 + 45 * 60), "always")
        self.assertEqual(zaisan_coverage(8 * 3600 + 50 * 60, 9 * 3600 + 5 * 60), "switch")

    def test_sink_weights_give_attractors_about_70_percent(self):
        weights = sink_weights(["a", "b", "c", "d"], {"a"})
        total = sum(weights.values())
        self.assertAlmostEqual(weights["a"] / total, 0.7, places=5)

    def test_weight_file_puts_each_edge_on_its_own_line(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "commute.src.xml"
            write_edge_weights(path, {"-100#0": 4, "997975851": 1})
            edge_lines = [line for line in path.read_text(encoding="utf-8").splitlines() if "<edge " in line]
            self.assertEqual(len(edge_lines), 2)
            self.assertIn('id="-100#0"', edge_lines[0])
            self.assertIn('id="997975851"', edge_lines[1])

    def test_crossing_window_keeps_the_original_signal(self):
        net = """<?xml version="1.0" encoding="UTF-8"?>
<net>
<edge id="north" from="a" to="j">
<lane id="north_0" speed="10" length="10" shape="0,0 0,10"/>
<param key="origId" value="40002943"/>
</edge>
<tlLogic id="j" type="static" programID="0" offset="0">
<phase duration="30" state="G"/>
</tlLogic>
<connection from="north" to="out" fromLane="0" toLane="0" tl="j" linkIndex="0"/>
</net>
"""
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "net.xml"
            path.write_text(net, encoding="utf-8")
            replaced = patch_zaisan_signals(path, {"40002943"}, keep_original=True)
            self.assertEqual(replaced, 1)
            text = path.read_text(encoding="utf-8")
            self.assertIn('state="G"', text)
            self.assertIn('programID="slow"', text)
            self.assertIn('duration="55"', text)


if __name__ == "__main__":
    unittest.main()
