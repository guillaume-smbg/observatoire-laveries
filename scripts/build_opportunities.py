#!/usr/bin/env python3
"""Exploratory 300/500/1000m walk-independent demographic catchments.

Equal-area-intersection approximation assumes uniform distribution of residents
and dwellings within each INSEE IRIS polygon. The centre of each IRIS is an
exploration point, NOT a vacant store/address. All OSM points remain unverified.
Do not convert scores to revenue forecasts.
"""
import datetime as dt
import json
import math
from collections import Counter
from pathlib import Path
from shapely.geometry import Point, shape
from shapely.affinity import scale
from shapely.strtree import STRtree

BASE=Path(__file__).resolve().parent.parent
DATA=BASE/"data"
RADII=(300,500,1000)
FX=111320*math.cos(math.radians(48.85))
FY=111132

def read(name):
    with (DATA/name).open(encoding="utf-8") as f:
        return json.load(f)

def n(v):
    try:
        x=float(v)
        return x if math.isfinite(x) else None
    except (ValueError,TypeError):
        return None

def point(row):
    return Point(float(row["lon"])*FX,float(row["lat"])*FY)

def make_region():
    census=read("iris-2022.json")
    geo=read("iris-2022-contours.geojson")
    bycode={str(r["id"]):r for r in census["rows"]}
    geoms=[]
    rows=[]
    for f in geo["features"]:
        id=str((f.get("properties") or {}).get("id") or "")
        r=bycode.get(id)
        if not r:continue
        try:
            g=scale(shape(f["geometry"]),xfact=FX,yfact=FY,origin=(0,0))
            if not g.is_valid:g=g.buffer(0)
            if g.is_empty or g.area<=100:continue
            if n(r.get("population")) is None or n(r.get("homes")) is None:continue
            geoms.append(g)
            rows.append(r)
        except Exception:continue
    if len(rows)<2000:raise ValueError("Official IRIS geometry join incomplete: "+str(len(rows)))
    return rows,geoms,census,geo

def competitors(records,centre,r):
    # Includes all OSM shops in every department, even across admin boundaries.
    radius2=r*r
    cx,cy=centre.x,centre.y
    inside=[r0 for r0 in records if (cx-r0['_mx'])**2+(cy-r0['_my'])**2<=radius2]
    return {
      "all":len(inside),
      "explicit":sum(x.get("quality")=="self_service_tagged" for x in inside),
      "plausible":sum(x.get("quality") in ("self_service_tagged","possibly_automatic") for x in inside),
      "possible_nonautomatic":sum(x.get("quality")=="probably_not_automatic" for x in inside)
    }

def directory_counts(records,centre,r):
    """Source-labelled public directory candidates. Counts are NOT verified open shops."""
    radius2=r*r
    cx,cy=centre.x,centre.y
    inside=[x for x in records if (cx-x["_mx"])**2+(cy-x["_my"])**2<=radius2]
    possible=[x for x in inside if x.get("quality") not in
              ("probably_not_automatic","possibly_nonautomatic","uncertain_type","unclassified")]
    return {
      "all":len(inside),
      "plausible":len(possible),
      "multi":sum(len(x.get("sources",[]))>=2 for x in possible),
      "osm":sum("osm" in x.get("sources",[]) for x in inside),
      "excluded_quality":len(inside)-len(possible),
      "address_only":sum(x.get("geocoded_by_ban",False) for x in inside)
    }

def catchment(centre,r,tree,geoms,rows,records,directory):
    circle=centre.buffer(r,resolution=20)
    matched=tree.query(circle)
    area=0.0
    pop=homes=small=renters=0.0
    good_homes=good_small=good_renters=0.0
    for key in matched:
        i=int(key)
        g=geoms[i]
        try:intersection=circle.intersection(g)
        except Exception:continue
        if intersection.is_empty:continue
        portion=intersection.area/g.area
        area+=intersection.area
        row=rows[i]
        pop+=portion*(n(row.get("population")) or 0)
        h=portion*(n(row.get("homes")) or 0)
        homes+=h
        ss=n(row.get("small_pct"))
        if ss is not None:
            small+=h*ss/100
            good_small+=h
        rr=n(row.get("renters_pct"))
        if rr is not None:
            renters+=h*rr/100
            good_renters+=h
    coverage=min(1,area/(math.pi*r*r))
    return {
      "population":round(pop),
      "homes":round(homes),
      "small_homes_est":round(small) if good_small else None,
      "renter_homes_est":round(renters) if good_renters else None,
      "small_pct":round(100*small/good_small,1) if good_small else None,
      "renters_pct":round(100*renters/good_renters,1) if good_renters else None,
      "coverage":round(coverage,3),
      "osm":competitors(records,centre,r),
      "directory":directory_counts(directory,centre,r)
    }

def percentile(nums,q):
    nums=sorted(float(x) for x in nums if x is not None)
    if not nums:return 1
    return max(1,nums[round(q*(len(nums)-1))])

def main():
    rows,geoms,census,geo=make_region()
    osm=read("laveries-osm.json")
    if osm.get("failed_departments") or len(osm.get("rows",[]))<100:
        raise ValueError("Incomplete OSM evidence, refusing to calculate comprehensive score")
    records=[{**x,"_mx":float(x["lon"])*FX,"_my":float(x["lat"])*FY} for x in osm["rows"] if x.get("quality") in ("self_service_tagged","possibly_automatic","probably_not_automatic","unclassified")]
    # Add independent public directory records only once, after cautious source
    # matching. Missing-position records are included only if strict IGN
    # housenumber geocoding was independently accepted.
    directory_doc=read("annuaire-croise.json")
    if len(directory_doc.get("rows",[]))<1200:
        raise ValueError("Insufficient cross-directory source; withholding scored recommendations")
    geo_path=DATA/"geocoded-addresses.json"
    geocoded={}
    geo_doc=None
    if geo_path.exists():
        geo_doc=read("geocoded-addresses.json")
        if geo_doc.get("directory_generated_at")==directory_doc.get("generated_at"):
            geocoded={r["id"]:r for r in geo_doc.get("rows",[])}
    directory=[]
    for r in directory_doc["rows"]:
        p=dict(r)
        if p.get("lat") is None:
            g=geocoded.get(p["id"])
            if not g:continue
            p["lat"],p["lon"]=g["lat"],g["lon"]
            p["geocoded_by_ban"]=True
        try:
            lat,lon=float(p["lat"]),float(p["lon"])
        except (TypeError,ValueError):continue
        if not(48.4<=lat<=49.3 and 1.7<=lon<=3.15):continue
        p["_mx"]=lon*FX
        p["_my"]=lat*FY
        directory.append(p)
    if len(directory)<1000:
        raise ValueError("Less than 1000 cross-directory coordinates available")
    logging_note="Cross-source %d/%d geolocated, %d IGN addresses applied"%(len(directory),len(directory_doc["rows"]),len(geocoded))
    print(logging_note)
    tree=STRtree(geoms)
    points=[]
    for i,row in enumerate(rows):
        c=point(row)
        nearby={str(r):catchment(c,r,tree,geoms,rows,records,directory) for r in RADII}
        points.append({
          "id":str(row["id"]),
          "commune":row.get("commune") or row["id"],
          "name":row.get("name") or row["id"],
          "department":row["dep"],
          "lat":round(float(row["lat"]),6),
          "lon":round(float(row["lon"]),6),
          "catchments":nearby
        })
    denom=percentile([r["catchments"]["500"]["homes"] for r in points],.9)
    for p in points:
        d=p["catchments"]["500"]
        if d["coverage"]<.80 or d["small_pct"] is None or d["renters_pct"] is None:
            p["score"]=None
            p["reason"]="Incomplete study-area coverage or demographic values"
        else:
            demand=min(100,d["homes"]/denom*100)
            nonexhaustive=max(0,100-16*d["directory"]["multi"])
            p["score"]=round(.38*demand+.25*d["small_pct"]+.22*d["renters_pct"]+.15*nonexhaustive,1)
            p["reason"]="Heuristic IRIS-centred analysis, not a validated market forecast"
    ordered=sorted((p for p in points if p["score"] is not None),key=lambda p:-p["score"])
    chosen=[]
    for p in ordered:
        if all(point(p).distance(point(prev))>=650 for prev in chosen):
            chosen.append(p)
        if len(chosen)>=50:break
    if len(chosen)<20:raise ValueError("Too few complete IRIS candidates")
    output={
      "source":"INSEE RP 2022 / contours IRIS 2024 / OpenStreetMap Geofabrik / BAUG / Laverie Ouvert",
      "generated_at":dt.datetime.now(dt.timezone.utc).isoformat(),
      "insee_generated_at":census.get("generated_at"),
      "osm_generated_at":osm.get("generated_at"),
      "directory_generated_at":directory_doc.get("generated_at"),
      "address_geocoding_generated_at":geo_doc.get("generated_at") if geo_doc and geocoded else None,
      "scope":"Departments 75,92,93,94 only",
      "point_type":"IRIS interior representative point, NOT a commercial premises",
      "distances":"Planar geographic circles, NOT walking isochrones",
      "population_method":"IRIS population and housing uniformly distributed by area. Intersected area fraction summed. Estimate only, not observed within circles.",
      "study_area_coverage":"Intersection fraction with study region; scores hidden below 80%",
      "osm_status":"OSM and independent directory records are NOT verified open competitors; the address-only IGN location is NOT shop confirmation.",
      "candidate_total":len(directory_doc["rows"]),
      "candidate_geolocated":len(directory),
      "candidate_unlocated":len(directory_doc["rows"])-len(directory),
      "candidate_matching":"Independent sources reconciled conservatively, possible duplicates remain; no Google Places data collected.",
      "score_method":"Illustrative 500m index: 38% dwellings normalized to 90th percentile + 25% small-dwelling share + 22% renters share + 15% penalty (100-16*multi-source plausible directory leads). Unverified, non-calibrated. No CA inference.",
      "normalization_p90_homes_500m":round(denom),
      "radius_m":list(RADII),
      "top50_distinct_iris_ids":[p["id"] for p in chosen],
      "count":len(points),
      "rows":points
    }
    (DATA/"opportunities.json").write_text(json.dumps(output,ensure_ascii=False,separators=(",",":"),allow_nan=False)+"\n",encoding="utf-8")
    audit={
      "generated_at":output["generated_at"],
      "count_iris":len(points),
      "scorable":sum(p["score"] is not None for p in points),
      "unscorable":sum(p["score"] is None for p in points),
      "top50":len(chosen),
      "score_min":min(p["score"] for p in ordered),
      "score_max":max(p["score"] for p in ordered),
      "max_osm_points_500m":max(p["catchments"]["500"]["osm"]["all"] for p in points),
      "max_directory_candidates_500m":max(p["catchments"]["500"]["directory"]["all"] for p in points),
      "directory_candidates_total":len(directory_doc["rows"]),
      "directory_candidates_geolocated":len(directory),
      "directory_age":directory_doc.get("generated_at"),
      "osm_date":osm.get("generated_at"),
      "insee_date":census.get("generated_at"),
      "caveat":"Area-weighted estimated populations, only place representative points, multi-source directories not field-verified, possible duplicated and closed premises; score is heuristic."
    }
    (DATA/"opportunities-audit.json").write_text(json.dumps(audit,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(audit,ensure_ascii=False))

if __name__=="__main__":
    main()
