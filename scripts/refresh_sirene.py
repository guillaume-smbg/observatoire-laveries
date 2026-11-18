#!/usr/bin/env python3
"""Secondary establishment registry census. NAF != an operating self-service laundromat.

Only open-diffusion active establishment records under historical NAF 96.01B.
Do not convert companies or administrative addresses to confirmed local laundries.
No API keys and no personal names from legal-entity names are published.
"""
import datetime as dt
import json
import csv
import re
import logging
import math
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from pathlib import Path

ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/"data"
OUT.mkdir(exist_ok=True)
BASE="https://recherche-entreprises.api.gouv.fr/search"
DEPTS=("75","92","93","94")
NAF="96.01B"
MAX_PAGE=130
HEADERS={"User-Agent":"ObservatoireLaveries/1.0 (public company register analysis)","Accept":"application/json"}

def request_page(dept,page):
    args={"activite_principale":NAF,"departement":dept,"etat_administratif":"A","per_page":25,"page":page}
    url=BASE+"?"+urllib.parse.urlencode(args)
    last=None
    for attempt in range(5):
        try:
            req=urllib.request.Request(url,headers=HEADERS)
            with urllib.request.urlopen(req,timeout=30) as response:
                body=json.load(response)
                if not isinstance(body.get("results"),list):
                    raise ValueError("Unexpected company search API response")
                return body
        except (urllib.error.HTTPError, urllib.error.URLError,ValueError,TimeoutError) as exc:
            last=exc
            retry_after=0
            if isinstance(exc,urllib.error.HTTPError):
                try:retry_after=float(exc.headers.get("Retry-After",0))
                except (ValueError,TypeError):pass
                if exc.code in (400,401,403,404):raise
            delay=min(30,max(retry_after,2**attempt))
            logging.warning("Dept %s page %s: %s; retry in %ss",dept,page,exc,delay)
            time.sleep(delay)
    raise RuntimeError(str(last))

def as_geo(record):
    try:
        lat=float(record.get("latitude"))
        lon=float(record.get("longitude"))
        if 48.48<=lat<=49.28 and 1.85<=lon<=3.12:
            return (round(lat,7),round(lon,7))
    except (TypeError,ValueError):pass
    return None

def from_company(company,dept):
    items=(company.get("matching_etablissements") or [])
    siege=company.get("siege")
    if isinstance(siege,dict):items=items+[siege]
    result=[]
    for e in items:
        if not isinstance(e,dict):continue
        if str(e.get("activite_principale") or "").upper()!=NAF:continue
        if str(e.get("etat_administratif") or "").upper()!="A":continue
        if str(e.get("statut_diffusion_etablissement") or "O").upper()!="O":continue
        cp=str(e.get("code_postal") or "")
        postal_dept=cp[:2]
        if postal_dept!=dept:continue
        pos=as_geo(e)
        if not pos:continue
        siret=str(e.get("siret") or "")
        if len(siret)!=14 or not siret.isdigit():continue
        enseignes=[x for x in (e.get("liste_enseignes") or []) if isinstance(x,str) and x.strip()]
        brand=(e.get("nom_commercial") or (enseignes[0] if enseignes else "") or "").strip()
        # Never copy a sole trader's personal name from nom_complet / nom_raison_sociale.
        result.append({
            "id":siret,"name":brand[:100] or "Établissement déclaré 96.01B (nom commercial inconnu)",
            "commercial_name_present":bool(brand),"lat":pos[0],"lon":pos[1],
            "dep":dept,"postcode":cp,
            "address":str(e.get("adresse") or "").strip()[:160],
            "activity":NAF,"administrative_status":"A","registry":"SIRENE / API Recherche d’entreprises",
            "registry_url":"https://annuaire-entreprises.data.gouv.fr/etablissement/"+siret,
            "meaning":"Immatriculation et adresse administrative uniquement, activité réelle et libre-service non vérifiés"
        })
    return result

def distance(a,b):
    r=math.pi/180.
    dlat=(a["lat"]-b["lat"])*r
    dlon=(a["lon"]-b["lon"])*r
    t=math.sin(dlat/2)**2+math.cos(a["lat"]*r)*math.cos(b["lat"]*r)*math.sin(dlon/2)**2
    return 12742000*math.asin(min(1,math.sqrt(t)))

def run():
    logging.basicConfig(level=logging.INFO,format="%(asctime)s %(levelname)s %(message)s")
    rows={}
    meta={}
    problems={}
    for dept in DEPTS:
        seen=0
        try:
            first=request_page(dept,1)
            pages=int(first.get("total_pages") or 1)
            total=int(first.get("total_results") or 0)
            cap=min(pages,MAX_PAGE)
            found={}
            for page in range(1,cap+1):
                payload=first if page==1 else request_page(dept,page)
                seen+=len(payload["results"])
                for company in payload["results"]:
                    for row in from_company(company,dept):
                        found[row["id"]]=row
                if page%10==0:logging.info("%s: %s / %s pages processed, %s valid establishments",dept,page,pages,len(found))
                if page<cap:time.sleep(.25)
            meta[dept]={"company_matches":total,"pages":pages,"pages_read":cap,"results_read":seen,
                        "establishments_with_coordinates":len(found),"complete_page_scan":cap==pages}
            rows.update(found)
            if cap<pages:problems[dept]="Pagination cap hit: "+str(cap)+"/"+str(pages)
        except Exception as exc:
            logging.exception("Department %s: API unavailable",dept)
            problems[dept]=str(exc)[:180]
        logging.info("SIRENE dept %s: %s",dept,meta.get(dept,{}))
    if not rows:
        raise RuntimeError("No legal establishments downloaded; old snapshot retained.")
    result=list(sorted(rows.values(),key=lambda x:x["id"]))
    osm_path=OUT/"laveries-osm.json"
    candidate_links=[]
    matched_ids=set()
    if osm_path.exists():
        osm=json.loads(osm_path.read_text(encoding="utf-8")).get("rows",[])
        buckets={}
        for item in osm:
            cell=(round(float(item["lat"])*500),round(float(item["lon"])*500))
            buckets.setdefault(cell,[]).append(item)
        for row in result:
            cell=(round(row["lat"]*500),round(row["lon"]*500))
            near=[]
            for i in (-1,0,1):
                for j in (-1,0,1):
                    for item in buckets.get((cell[0]+i,cell[1]+j),[]):
                        d=distance(row,item)
                        if d<=45:
                            near.append((d,item))
            near.sort(key=lambda pair:pair[0])
            if near:
                dist,item=near[0]
                row["closest_osm_id"]=item["id"]
                row["closest_osm_meters"]=round(dist)
                row["match_quality"]="proximity_only_not_business_verified"
                candidate_links.append({"siret":row["id"],"osm_id":item["id"],"meters":round(dist)})
                matched_ids.add(item["id"])
    stamp=dt.datetime.now(dt.timezone.utc).isoformat()
    artifact={
        "source":"API Recherche d'entreprises / SIRENE — activités administratives 96.01B, établissements A, diffusion O",
        "source_url":BASE,
        "generated_at":stamp,
        "exhaustive":False,
        "not_an_inventory_of_laundromats":True,
        "explanation":"NAF 96.01B inclut des pressings et adresses administratives; source ne certifiant pas un commerce ou une laverie libre-service",
        "departments":meta,"errors":problems,
        "geographic_osm_proximity_m":45,
        "proximity_matches":len(candidate_links),
        "distinct_osm_proximity_matches":len(matched_ids),
        "rows":result
    }
    (OUT/"sirene-laundries.json").write_text(json.dumps(artifact,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
    (OUT/"sirene-audit.json").write_text(json.dumps({
        "generated_at":stamp,"source":BASE,"registered_candidates":len(result),
        "distinct_osm_proximity_matches":len(matched_ids),
        "proximity_pairs":len(candidate_links),
        "counts_by_department":dict(Counter(x["dep"] for x in result)),
        "errors":problems,
        "limit":"Proximité ≠ même établissement, pas de confirmation de laverie automatique."
    },ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    # Review candidates with a commercially disclosed, laundry-like trading name.
    # Search labels are leads only; neither SIRENE nor Google proves operation.
    pattern=re.compile(r"laverie|lavomatic|speed queen|wash|laundro|lavomat|lavorie", re.I)
    priority=[r for r in result if not r.get("closest_osm_id")
              and r.get("commercial_name_present") and pattern.search(r["name"])]
    priority.sort(key=lambda r:(r["dep"],r["postcode"],r["name"]))
    csv_path=OUT/"candidats-sirene-sans-osm.csv"
    with csv_path.open("w",encoding="utf-8-sig",newline="") as out:
        writer=csv.writer(out,delimiter=";",quoting=csv.QUOTE_ALL)
        writer.writerow(["SIRET_PUBLIC","NOM_COMMERCIAL_DECLARÉ","DÉPARTEMENT","CODE_POSTAL",
                         "FICHE_ADMINISTRATIVE","RECHERCHE_GOOGLE_MAPS","STATUT","SOURCE"])
        for row in priority:
            google_query=row["name"]+" "+row["postcode"]+" France"
            url="https://www.google.com/maps/search/?api=1&query="+urllib.parse.quote(google_query)
            writer.writerow([row["id"],row["name"],row["dep"],row["postcode"],
                             row["registry_url"],url,
                             "À VÉRIFIER : pas de point OSM à <=45 m",
                             "SIRENE NAF 96.01B ; pas preuve de laverie"])
    logging.info("Prioritized %d non-verified SIRENE commercial-name leads without nearby OSM",len(priority))
    logging.info("SIRENE: %s establishments / %s distinct OSM candidates within 45 m / errors %s",
                 len(result),len(matched_ids),problems)

if __name__=="__main__":
    run()
