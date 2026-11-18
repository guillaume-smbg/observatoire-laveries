#!/usr/bin/env python3
"""Generate a transparent, complete manual-review worklist for public candidates.

A priority is an inspection workload score, NOT an estimate of business
existence, number of competitors, or revenue. No Google content is collected.
"""
import csv
import datetime as dt
import json
import math
import re
import urllib.parse
from pathlib import Path

D=Path(__file__).resolve().parent.parent/"data"

def read(name):
    return json.loads((D/name).read_text(encoding="utf-8"))

def meters(a,b):
    r=math.pi/180
    dy=(float(a["lat"])-float(b["lat"]))*r
    dx=(float(a["lon"])-float(b["lon"]))*r
    h=math.sin(dy/2)**2+math.cos(float(a["lat"])*r)*math.cos(float(b["lat"])*r)*math.sin(dx/2)**2
    return 12742000*math.asin(min(1,math.sqrt(h)))

def main():
    items=read("annuaire-croise.json")
    geo=read("geocoded-addresses.json")
    prospect=read("opportunities.json")
    accepted={r["id"]:r for r in geo["rows"]} if geo.get("directory_generated_at")==items.get("generated_at") else {}
    byid={r["id"]:r for r in prospect["rows"]}
    top=[byid[k] for k in prospect.get("top50_distinct_iris_ids",[]) if k in byid]
    if len(top)!=50 or items.get("total_candidates",0)<1000:
        raise RuntimeError("Incomplete prior location selection and directory evidence")
    out=[]
    for item in items["rows"]:
        record=dict(item)
        ban=accepted.get(record["id"]) if record.get("lat") is None else None
        if ban:record.update(lat=ban["lat"],lon=ban["lon"])
        located=record.get("lat") is not None
        nearest=min(((meters(record,p),p) for p in top),key=lambda x:x[0]) if located else None
        distance=round(nearest[0]) if nearest else None
        zone=nearest[1] if nearest else None
        priority=0
        reasons=[]
        if not located:
            priority+=3;reasons.append("Adresse à localiser")
        if ban:
            priority+=2;reasons.append("Point de rue IGN/BAN, commerce à confirmer")
        if len(record.get("sources",[]))==1:
            priority+=3;reasons.append("Une seule source")
        if record.get("possible_duplicates"):
            priority+=5;reasons.append("Rapprochement ambigu / doublon potentiel")
        if record.get("quality") in ("possibly_nonautomatic","probably_not_automatic"):
            priority+=4;reasons.append("Pressing / activité non automatique à vérifier")
        elif record.get("quality") in ("uncertain_type","unclassified"):
            priority+=2;reasons.append("Nature du commerce inconnue")
        if nearest and nearest[0]<=500:
            priority+=4;reasons.append("Concurrence influente près d’une zone du Top 50")
        elif nearest and nearest[0]<=1000:
            priority+=2;reasons.append("Proche d’une zone du Top 50")
        # Priority is for FIELD REVIEW; high priority does not mean likely open.
        tier="A — à vérifier en priorité" if priority>=6 else "B — à vérifier" if priority>=3 else "C — contrôle standard"
        # Directory addresses may already contain the postal code; avoid
        # repeating it (some source strings also contain a trailing comma).
        address=re.sub(r"\s+", " ", str(record.get("address") or "")).strip(" ,")
        if record.get("postcode"):
            postcode=str(record["postcode"])
            address=re.sub(r"\s*,?\s*"+re.escape(postcode)+r"\b\s*", " ", address)
            address=re.sub(r"\b"+re.escape(postcode)+r"\s*,?\s*", " ", address)
            address=re.sub(r"\s+Paris\s*$", "", address, flags=re.IGNORECASE)
        address=re.sub(r"\s+,", ",", address).strip(" ,")
        address=re.sub(r"\s+", " ", address).strip(" ,")
        query=" ".join(filter(None,[record.get("name",""),address,record.get("postcode",""),"France"]))
        url="https://www.google.com/maps/search/?api=1&query="+urllib.parse.quote(query)
        out.append({
            "id":record["id"],"nom":record.get("name",""),"adresse":record.get("address",""),
            "code_postal":record.get("postcode",""),"departement":record["dept"],
            "latitude":record.get("lat"),"longitude":record.get("lon"),
            "precision_geo":"adresse IGN/BAN, établissement non vérifié" if ban else "position d’annuaire non vérifiée" if located else "inconnue",
            "sources":"+".join(record.get("sources",[])),"nombre_sources":len(record.get("sources",[])),
            "type_presume":record.get("quality",""),"priorite":tier,"points_priorite":priority,
            "motifs":"; ".join(reasons),"iris_proche":zone["id"] if zone else "",
            "commune_iris_proche":zone["commune"] if zone else "",
            "distance_point_iris_m":distance,"google_maps_recherche":url,
            "controle_terrain":"NON VERIFIE","commentaire":"",
        })
    out.sort(key=lambda x:(-x["points_priorite"],x["departement"],x["nom"]))
    head=list(out[0])
    with (D/"verification-prioritaire.csv").open("w",newline="",encoding="utf-8-sig") as f:
        w=csv.DictWriter(f,fieldnames=head,delimiter=";",quoting=csv.QUOTE_MINIMAL)
        w.writeheader()
        w.writerows(out)
    (D/"verification-prioritaire.json").write_text(json.dumps({
        "source":"Cross-directory review workload, NOT verified shops",
        "generated_at":dt.datetime.now(dt.timezone.utc).isoformat(),
        "directory_generated_at":items.get("generated_at"),
        "rows":[{"id":x["id"],"priority":x["priorite"],"points":x["points_priorite"],
                 "reasons":x["motifs"]} for x in out]
    },ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
    counts={}
    for tier in ("A — à vérifier en priorité","B — à vérifier","C — contrôle standard"):
        counts[tier]=sum(x["priorite"]==tier for x in out)
    (D/"verification-prioritaire-audit.json").write_text(json.dumps({
        "generated_at":dt.datetime.now(dt.timezone.utc).isoformat(),
        "total":len(out),"counts_by_priority":counts,
        "directory_generated_at":items.get("generated_at"),
        "opportunities_generated_at":prospect.get("generated_at"),
        "ban_generated_at":geo.get("generated_at"),
        "method":"Manual review workload score: single-source, dubious type, ambiguous match, uncertain coordinates, and proximity to exploratory top 50.",
        "limitation":"Every lead is unverified, no Google Places data is downloaded. Priority is NOT a business-activity assessment."
    },ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"count":len(out),"priority":counts},ensure_ascii=False))

if __name__=="__main__":
    main()

