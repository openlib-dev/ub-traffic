import os
import tempfile
import unittest
from pathlib import Path

from sumo_worker.cache import route_cache_key, weight_cache_key
from sumo_worker.geo import make_projector, parse_net_location
from sumo_worker.network import load_edge_index


PROJ = "+proj=utm +zone=48 +ellps=WGS84 +datum=WGS84 +units=m +no_defs"


class RouteCacheKeyTest(unittest.TestCase):
    def test_same_inputs_share_a_key_and_a_new_seed_does_not(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            net = root / "city.net.xml"
            attractors = root / "attractors.json"
            net.write_text("<net/>", encoding="utf-8")
            attractors.write_text("{}", encoding="utf-8")
            counts = [("car", 2000)]
            first = route_cache_key(net, 27000, 27900, counts, 42, True, attractors)
            again = route_cache_key(net, 27000, 27900, counts, 42, True, attractors)
            other_seed = route_cache_key(net, 27000, 27900, counts, 7, True, attractors)
            self.assertEqual(first, again)
            self.assertNotEqual(first, other_seed)
            self.assertNotEqual(first, route_cache_key(net, 27000, 27900, counts, 42, False))

    def test_weight_key_follows_the_attractor_file(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            net = root / "city.net.xml"
            attractors = root / "attractors.json"
            net.write_text("<net/>", encoding="utf-8")
            attractors.write_text("{}", encoding="utf-8")
            first = weight_cache_key(net, attractors)
            attractors.write_text('{"places":[]}', encoding="utf-8")
            self.assertNotEqual(first, weight_cache_key(net, attractors))


class ProjectionTest(unittest.TestCase):
    def test_reads_the_network_location(self):
        with tempfile.TemporaryDirectory() as directory:
            net = Path(directory) / "city.net.xml"
            net.write_text(
                f'<net><location netOffset="-1.5,2.5" projParameter="{PROJ}"/></net>',
                encoding="utf-8",
            )
            offset, proj = parse_net_location(net)
            self.assertEqual(offset, (-1.5, 2.5))
            self.assertEqual(proj, PROJ)

    def test_round_trips_a_city_coordinate(self):
        try:
            from pyproj import Proj
        except ImportError:
            self.skipTest("pyproj is not installed")
        offset = (-600000.0, -5300000.0)
        project = make_projector(offset, PROJ)
        forward = Proj(PROJ)
        longitude, latitude = 106.917, 47.918
        easting, northing = forward(longitude, latitude)
        found_lon, found_lat = project(easting + offset[0], northing + offset[1])
        self.assertAlmostEqual(found_lon, longitude, places=5)
        self.assertAlmostEqual(found_lat, latitude, places=5)


class EdgeIndexCacheTest(unittest.TestCase):
    def test_second_read_uses_the_written_index(self):
        with tempfile.TemporaryDirectory() as directory:
            net = Path(directory) / "city.net.xml"
            net.write_text(
                '<net><edge id="12"><lane id="12_0" speed="13.89"/>'
                '<param key="origId" value="12"/></edge></net>',
                encoding="utf-8",
            )
            first = load_edge_index(str(net))
            self.assertEqual(first["12"], (12, 13.89))
            net.write_text("<net></net>", encoding="utf-8")
            cached = net.with_name(net.name + ".edges.json")
            newer = net.stat().st_mtime + 5
            os.utime(cached, (newer, newer))
            self.assertEqual(load_edge_index(str(net)), first)
