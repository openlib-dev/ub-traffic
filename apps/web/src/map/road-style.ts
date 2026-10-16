import type { LineLayerSpecification } from "maplibre-gl";
import type { HighwayClass } from "@/domain/road";
import { CONGESTION_COLOR } from "@/domain/simulation";

type LinePaint = NonNullable<LineLayerSpecification["paint"]>;

export const ROAD_CLASS_COLOR: Record<HighwayClass, string> = {
  motorway: "#e2b340",
  trunk: "#e8833a",
  primary: "#3aa0d8",
  secondary: "#7b84f2",
  tertiary: "#3cafa0",
  unclassified: "#8b95a7",
  residential: "#8b95a7",
  living_street: "#a894c4",
  service: "#667084",
  other: "#667084",
};

export const ROAD_CLASS_LEGEND = [
  { label: "Motorway", color: ROAD_CLASS_COLOR.motorway },
  { label: "Trunk", color: ROAD_CLASS_COLOR.trunk },
  { label: "Primary", color: ROAD_CLASS_COLOR.primary },
  { label: "Secondary", color: ROAD_CLASS_COLOR.secondary },
  { label: "Tertiary", color: ROAD_CLASS_COLOR.tertiary },
  { label: "Local", color: ROAD_CLASS_COLOR.residential },
  { label: "Living street", color: ROAD_CLASS_COLOR.living_street },
  { label: "Service", color: ROAD_CLASS_COLOR.service },
] as const;

const classColor = [
  "match",
  ["get", "highwayClass"],
  "motorway",
  ROAD_CLASS_COLOR.motorway,
  "trunk",
  ROAD_CLASS_COLOR.trunk,
  "primary",
  ROAD_CLASS_COLOR.primary,
  "secondary",
  ROAD_CLASS_COLOR.secondary,
  "tertiary",
  ROAD_CLASS_COLOR.tertiary,
  "unclassified",
  ROAD_CLASS_COLOR.unclassified,
  "residential",
  ROAD_CLASS_COLOR.residential,
  "living_street",
  ROAD_CLASS_COLOR.living_street,
  "service",
  ROAD_CLASS_COLOR.service,
  ROAD_CLASS_COLOR.other,
];

const lineWidth = [
  "interpolate",
  ["linear"],
  ["zoom"],
  11,
  ["match", ["get", "highwayClass"], "motorway", 1.6, "trunk", 1.4, "primary", 1.15, "secondary", 0.8, "tertiary", 0.55, 0.4],
  16,
  ["match", ["get", "highwayClass"], "motorway", 7.5, "trunk", 6.4, "primary", 5.2, "secondary", 3.8, "tertiary", 2.8,   1.7],
];

export function roadCasingPaint(casing: string): LinePaint {
  return {
    "line-color": casing,
    "line-width": ["interpolate", ["linear"], ["zoom"], 11, 2.4, 16, 9],
    "line-opacity": 0.9,
  } as unknown as LinePaint;
}

const congestionColor = [
  "match",
  ["get", "congestion"],
  "free",
  CONGESTION_COLOR.free,
  "moderate",
  CONGESTION_COLOR.moderate,
  "heavy",
  CONGESTION_COLOR.heavy,
  "severe",
  CONGESTION_COLOR.severe,
  "#8b95a7",
];

export function roadLinePaint(showCongestion = false): LinePaint {
  return {
    "line-color": showCongestion ? ["case", ["has", "congestion"], congestionColor, classColor] : classColor,
    "line-width": lineWidth,
    "line-opacity": 0.95,
  } as unknown as LinePaint;
}

export function severeSecondsPaint(): LinePaint {
  return {
    "line-color": CONGESTION_COLOR.severe,
    "line-width": [
      "interpolate",
      ["linear"],
      ["zoom"],
      11,
      ["interpolate", ["linear"], ["coalesce", ["get", "severeSeconds"], 0], 1, 1.4, 40, 7],
      16,
      ["interpolate", ["linear"], ["coalesce", ["get", "severeSeconds"], 0], 1, 3, 40, 14],
    ],
    "line-opacity": 0.45,
  } as unknown as LinePaint;
}

export function severeDeltaPaint(): LinePaint {
  return {
    "line-color": ["case", [">", ["get", "severeDelta"], 0], CONGESTION_COLOR.severe, "#3dd68c"],
    "line-width": [
      "interpolate",
      ["linear"],
      ["zoom"],
      11,
      ["interpolate", ["linear"], ["abs", ["get", "severeDelta"]], 1, 1.4, 40, 7],
      16,
      ["interpolate", ["linear"], ["abs", ["get", "severeDelta"]], 1, 3, 40, 14],
    ],
    "line-opacity": 0.85,
  } as unknown as LinePaint;
}

export function bottleneckLinePaint(): LinePaint {
  return {
    "line-color": CONGESTION_COLOR.severe,
    "line-width": ["interpolate", ["linear"], ["zoom"], 11, 3.6, 16, 10],
    "line-opacity": 1,
  } as unknown as LinePaint;
}

export function scenarioOutlinePaint(): LinePaint {
  return {
    "line-color": ["match", ["get", "templateSide"], "second", "#3aa0d8", "both", "#f7fbff", "#e2b340"],
    "line-width": ["interpolate", ["linear"], ["zoom"], 11, 3.4, 16, 12],
    "line-opacity": 0.95,
  } as unknown as LinePaint;
}

export function scenarioClosedPaint(): LinePaint {
  return {
    "line-color": ["match", ["get", "templateSide"], "first", "#e2b340", "second", "#3aa0d8", "both", "#f7fbff", "#d5dbe3"],
    "line-width": ["interpolate", ["linear"], ["zoom"], 11, 2.4, 16, 8],
    "line-opacity": 0.95,
    "line-dasharray": [1.2, 1.2],
  } as unknown as LinePaint;
}

export function scenarioLinkPaint(): LinePaint {
  return {
    "line-color": [
      "case",
      ["==", ["get", "compare"], "first"],
      "#e2b340",
      ["==", ["get", "compare"], "second"],
      "#3aa0d8",
      ["==", ["get", "compare"], "both"],
      "#f7fbff",
      [
        "match",
        ["get", "kind"],
        "highway",
        "#e2b340",
        "subway",
        "#c084fc",
        "railway",
        "#d7c4a3",
        "street",
        "#3aa0d8",
        "bridge",
        "#3aa0d8",
        "#3aa0d8",
      ],
    ],
    "line-width": [
      "interpolate",
      ["linear"],
      ["zoom"],
      11,
      ["match", ["get", "kind"], "highway", 5, 2.2],
      16,
      ["match", ["get", "kind"], "highway", 12, 6],
    ],
    "line-opacity": 0.95,
  } as unknown as LinePaint;
}

export function scenarioRailwayPaint(): LinePaint {
  return {
    "line-color": [
      "case",
      ["==", ["get", "compare"], "first"],
      "#e2b340",
      ["==", ["get", "compare"], "second"],
      "#3aa0d8",
      ["==", ["get", "compare"], "both"],
      "#f7fbff",
      "#d7c4a3",
    ],
    "line-width": ["interpolate", ["linear"], ["zoom"], 11, 2, 16, 5],
    "line-dasharray": [0.4, 1.2],
    "line-opacity": 0.95,
  } as unknown as LinePaint;
}

export function scenarioBridgeCasingPaint(): LinePaint {
  return {
    "line-color": "#1a2330",
    "line-width": ["interpolate", ["linear"], ["zoom"], 11, 5, 16, 12],
    "line-opacity": 0.85,
    "line-gap-width": ["interpolate", ["linear"], ["zoom"], 11, 2, 16, 6],
  } as unknown as LinePaint;
}

export function scenarioPreviewPaint(): LinePaint {
  const solid = scenarioLinkPaint();
  return {
    ...solid,
    "line-color": [
      "case",
      ["==", ["get", "invalid"], true],
      "#ef4d4d",
      solid["line-color"] as LinePaint["line-color"],
    ],
    "line-dasharray": [1.2, 1.2],
  } as unknown as LinePaint;
}

export function roadSelectionPaint(): LinePaint {
  return {
    "line-color": "#f7fbff",
    "line-width": ["interpolate", ["linear"], ["zoom"], 11, 3.2, 16, 11],
    "line-opacity": 1,
  } as unknown as LinePaint;
}

export function roadHitPaint(): LinePaint {
  return {
    "line-color": "#000000",
    "line-width": 16,
    "line-opacity": 0.01,
  };
}

export const roadLineLayout = {
  "line-cap": "round",
  "line-join": "round",
} as const;
