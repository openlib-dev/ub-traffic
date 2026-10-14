import assert from "node:assert/strict";
import test from "node:test";
import { CITY, collectPlaces, placeKind } from "./export-attractors.mjs";

test("keeps a university and an office inside the city", () => {
  const places = collectPlaces([
    {
      kind: placeKind({ amenity: "university" }),
      name: "National University of Mongolia",
      longitude: 106.921,
      latitude: 47.923,
    },
    {
      kind: placeKind({ building: "office" }),
      name: "Office",
      longitude: 106.917,
      latitude: 47.919,
    },
    {
      kind: placeKind({ amenity: "university" }),
      name: "Outside",
      longitude: CITY.west - 1,
      latitude: 47.9,
    },
    {
      kind: placeKind({ amenity: "school" }),
      name: "School",
      longitude: 106.9,
      latitude: 47.92,
    },
  ]);
  assert.deepEqual(
    places.map((place) => place.kind),
    ["office", "university"],
  );
  assert.equal(places[1].name, "National University of Mongolia");
});

test("keeps one place when the same campus is mapped twice", () => {
  const places = collectPlaces([
    { kind: "university", name: "Campus", longitude: 106.92111, latitude: 47.92311 },
    { kind: "university", name: "Campus again", longitude: 106.92112, latitude: 47.92312 },
  ]);
  assert.equal(places.length, 1);
});
