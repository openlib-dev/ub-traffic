from __future__ import annotations

import xml.etree.ElementTree as ET
from pathlib import Path


def parse_net_location(net_path: Path) -> tuple[tuple[float, float], str]:
    """Read netOffset and projParameter from a SUMO network. Stops at the location tag."""
    for _, elem in ET.iterparse(net_path, events=("end",)):
        if elem.tag != "location":
            elem.clear()
            continue
        offset = (elem.get("netOffset") or "").split(",")
        proj = elem.get("projParameter") or ""
        elem.clear()
        if len(offset) != 2 or not proj or proj == "!":
            raise ValueError("The SUMO network has no geographic projection.")
        return (float(offset[0]), float(offset[1])), proj
    raise ValueError("The SUMO network has no geographic projection.")


def make_projector(net_offset: tuple[float, float], proj_parameter: str):
    """Map a SUMO x/y to longitude and latitude. netOffset is added when SUMO projects a point."""
    from pyproj import Proj

    projection = Proj(proj_parameter)
    origin_x, origin_y = net_offset

    def project(x: float, y: float) -> tuple[float, float]:
        longitude, latitude = projection(x - origin_x, y - origin_y, inverse=True)
        return float(longitude), float(latitude)

    return project


def load_projector(net_path: Path):
    offset, proj = parse_net_location(net_path)
    return make_projector(offset, proj)
