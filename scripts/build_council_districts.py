#!/usr/bin/env python3
"""Build src/data/council_districts.json.

For each of the 51 City Council districts: a simplified boundary polygon plus the
list of NYPD precincts it overlaps, with each precinct's share of the district's
land area. Sources:
  - Council district boundaries: NYC Open Data "City Council Districts" (2023 lines,
    clipped to shoreline), downloaded as GeoJSON.
  - Precinct boundaries: src/data/nyc_precincts.json (same file the app renders).
  - Member names: scraped from council.nyc.gov/districts/ into council_members.json.

Shares are computed on lon/lat coordinates; at NYC's scale the distortion cancels
out of the ratio, so shares are accurate to well under a percentage point.

Usage: python3 scripts/build_council_districts.py <council_raw.geojson> <council_members.json>
"""
import json
import sys

from shapely.geometry import shape, mapping
from shapely.ops import unary_union

MIN_SHARE = 0.005  # ignore overlaps under 0.5% of district area (boundary slivers)
SIMPLIFY_TOL = 0.0003  # ~30m; keeps the outline crisp but small enough to bundle


def main(council_path, members_path):
    council = json.load(open(council_path))
    members = {int(k): v for k, v in json.load(open(members_path)).items()}
    precincts = json.load(
        open("src/data/nyc_precincts.json")
    )

    pct_geoms = {}
    for f in precincts["features"]:
        num = int(f["properties"]["precinct"])
        g = shape(f["geometry"]).buffer(0)
        pct_geoms[num] = pct_geoms[num].union(g) if num in pct_geoms else g

    out = []
    for f in sorted(council["features"], key=lambda f: int(f["properties"]["coundist"])):
        dnum = int(f["properties"]["coundist"])
        dgeom = shape(f["geometry"]).buffer(0)
        darea = dgeom.area
        overlaps = []
        for pnum, pgeom in pct_geoms.items():
            if not dgeom.intersects(pgeom):
                continue
            inter = dgeom.intersection(pgeom).area
            share = inter / darea
            if share >= MIN_SHARE:
                overlaps.append({"precinct": pnum, "share": round(share, 4)})
        overlaps.sort(key=lambda o: -o["share"])
        simplified = dgeom.simplify(SIMPLIFY_TOL, preserve_topology=True)
        out.append(
            {
                "district": dnum,
                "member": members.get(dnum),
                "precincts": overlaps,
                "geometry": mapping(simplified),
            }
        )
        covered = sum(o["share"] for o in overlaps)
        print(f"D{dnum:>2} {members.get(dnum, '?'):<28} {len(overlaps)} precincts, {covered:.1%} covered")

    with open("src/data/council_districts.json", "w") as fh:
        json.dump({"generated_from": "NYC Open Data council lines (2023) x app precinct file", "districts": out}, fh)
    size = sum(1 for _ in open("src/data/council_districts.json"))
    print(f"wrote src/data/council_districts.json")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
