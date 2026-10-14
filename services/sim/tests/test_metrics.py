import unittest

from sumo_worker.metrics import (
    clock_label,
    congestion_from_ratio,
    osm_way_id,
    segment_metrics,
    simulation_window,
)


class MetricsTest(unittest.TestCase):
    def test_bands_use_strict_thresholds(self):
        self.assertEqual(congestion_from_ratio(81, 100), "free")
        self.assertEqual(congestion_from_ratio(80, 100), "moderate")
        self.assertEqual(congestion_from_ratio(51, 100), "moderate")
        self.assertEqual(congestion_from_ratio(50, 100), "heavy")
        self.assertEqual(congestion_from_ratio(26, 100), "heavy")
        self.assertEqual(congestion_from_ratio(25, 100), "severe")
        self.assertEqual(congestion_from_ratio(0, 100), "severe")
        self.assertIsNone(congestion_from_ratio(-1, 100))
        self.assertIsNone(congestion_from_ratio(10, 0))

    def test_osm_way_id(self):
        self.assertEqual(osm_way_id("123#1", "123"), 123)
        self.assertEqual(osm_way_id("456", None), 456)
        self.assertEqual(osm_way_id("-89", None), 89)
        self.assertIsNone(osm_way_id(":cluster_1", None))
        self.assertIsNone(osm_way_id("12#0", "12 34"))

    def test_empty_edges_are_omitted(self):
        segments = segment_metrics(
            [
                (10, 2, 10, 13.9),
                (10, 0, 13.9, 13.9),
                (11, 1, -1, 13.9),
            ]
        )
        self.assertEqual([item["roadId"] for item in segments], [10])

    def test_window(self):
        self.assertEqual(simulation_window("07:30", "07:45"), (7 * 3600 + 30 * 60, 7 * 3600 + 45 * 60))
        self.assertEqual(clock_label(7 * 3600 + 30 * 60 + 5), "07:30:05")
        with self.assertRaises(ValueError):
            simulation_window("07:30", "08:00")


if __name__ == "__main__":
    unittest.main()
