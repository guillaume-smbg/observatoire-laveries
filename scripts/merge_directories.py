#!/usr/bin/env python3
"""Combine source-labelled laundromat leads (OSM, BAUG and laverie.ouvert.tel).

Use only robots-permitted directory/city index pages. Do NOT visit restricted
/f/ pages, download ratings, text reviews, photos, phone numbers or Google
Places data. No business is marked confirmed from an online directory.
Cross-matches are deliberately conservative. Not an exhaustive active-store count.
"""
import collections
import datetime as dt
import difflib
import json
import logging
import math
import re
import time
import unicodedata
import urllib.parse
import urllib.robotparser
from pathlib import Path

import requests
from bs4 import BeautifulSoup

BASE=Path(__file__).resolve().parent.parent
DATA=BASE/"data"
DATA.mkdir(exist_ok=True)
DEPTS=("75","92","93","94")
ROOTS={"baug":"https://baug.fr","ouvert":"https://laverie.ouvert.tel"}
AGENT="ObservatoireLaveriesAudit/1.0 (public research, GitHub: guillaume-smbg/observatoire-laveries)"
HEADERS={"User-Agent":AGENT,"Accept":"text/html,application/xhtml+xml"}
SESSION=requests.Session()
ROBOTS={}
SOURCE_STAT={}
FAILED=[]
PAGE_DELAY=0.48
LAST_REQUEST={}
MAX_PAGES=260
ZIP=re.compile(r"\b(75\d{3}|92\d{3}|93\d{3}|94\d{3})\b")
NOT_LAUNDRY=re.compile(r"pressing|teinturer|dry.clean|nettoyage a sec|blanchisserie industrielle|tailleur|couture|retouche|repassage",re.I)
LAUNDRY=re.compile(r"laverie|lavomatic|lavo.?matic|laundromat|lavand|lav.?club|wash|speed queen|libre.service|buanderie",re.I)
STOP={"la","le","les","de","des","du","d","a","au","aux","en","et","pour","the","paris","laverie","automatique","libre","service","laundry"}

def normalize(x):
    s=unicodedata.normalize("NFKD",str(x or "").lower())
    s="".join(c for c in s if not unicodedata.combining(c))
    s=s.replace("œ","oe").replace("æ","ae").replace("’","'")
    s=re.sub(r"\bav\.?\b","avenue",s)
    s=re.sub(r"\bbd\.?\b","boulevard",s)
    s=re.sub(r"\brte\.?\b","route",s)
    s=re.sub(r"\bst\.?\b","saint",s)
    s=re.sub(r"\bste\.?\b","sainte",s)
    s=re.sub(r"[^a-z0-9]+"," ",s)
    return " ".join(s.split())

def address_key(address,postcode=""):
    text=normalize(address)
    z=ZIP.search(str(postcode)+" "+address)
    pc=z.group(1) if z else str(postcode or "")
    text=re.sub(r"\b(?:75|92|93|94)\d{3}\b"," ",text)
    text=re.sub(r"\b(?:rue|avenue|boulevard|route|place|allee|square|impasse|passage|quai|chemin|cours|faubourg)\b"," ",text)
    text=re.sub(r"\b(?:de|du|des|d|la|le|les|au|aux)\b"," ",text)
    return pc," ".join(text.split())

def house(address):
    m=re.match(r"^\s*(\d{1,4})\s*(bis|ter|b|t)?\b",str(address or "").lower())
    return (m.group(1),m.group(2) or "") if m else None

def quality(name,category=None):
    s=normalize(name)
    if NOT_LAUNDRY.search(s): return "possibly_nonautomatic"
    if LAUNDRY.search(s) or str(category or "").lower().find("automatique")>=0:return "likely_laundry_unverified"
    return "uncertain_type"

def robots_allowed(url):
    p=urllib.parse.urlparse(url)
    root=p.scheme+"://"+p.netloc
    if root not in ROOTS.values():return False
    if root not in ROBOTS:
        rp=urllib.robotparser.RobotFileParser()
        try:
            res=SESSION.get(root+"/robots.txt",headers=HEADERS,timeout=20)
            res.raise_for_status()
            rp.parse(res.text.splitlines())
            ROBOTS[root]=rp
        except Exception as exc:
            FAILED.append({"page":root+"/robots.txt","reason":str(exc)[:180]})
            ROBOTS[root]=False
    rp=ROBOTS[root]
    return bool(rp and rp.can_fetch(AGENT,url))

def download(url):
    parsed=urllib.parse.urlparse(url)
    host=parsed.netloc
    if not robots_allowed(url):
        FAILED.append({"page":url,"reason":"Robots does not allow this directory URL"})
        return None
    elapsed=time.monotonic()-LAST_REQUEST.get(host,0)
    if elapsed<PAGE_DELAY:time.sleep(PAGE_DELAY-elapsed)
    LAST_REQUEST[host]=time.monotonic()
    for attempt in range(3):
        try:
            r=SESSION.get(url,headers=HEADERS,timeout=40,allow_redirects=True)
            r.raise_for_status()
            if not robots_allowed(r.url):raise ValueError("Redirect violates robots policy")
            if len(r.content)<2500:raise ValueError("Unexpectedly small directory response")
            return BeautifulSoup(r.text,"html.parser")
        except Exception as e:
            if attempt==2:
                FAILED.append({"page":url,"reason":str(e)[:180]})
                return None
            time.sleep(1+2*attempt)

def baug_from_page(url,dept):
    doc=download(url)
    if not doc:return [],[]
    articles=doc.select("article[data-company-id]")
    entries=[]
    for card in articles:
        name=card.select_one("h3")
        addr=card.select_one("address")
        if not name or not addr:continue
        n=name.get_text(" ",strip=True)
        a=addr.get_text(" ",strip=True)
        z=ZIP.search(a)
        if not z or z.group(1)[:2]!=dept:continue
        company=str(card.get("data-company-id") or "")
        if not company:continue
        entries.append({
            "source":"baug","source_id":company,"name":n[:140],"address":a[:180],
            "postcode":z.group(1),"dept":dept,"source_url":url+"#"+str(card.get("id") or ""),
            "lat":None,"lon":None,"quality":quality(n)
        })
    city=[]
    for a in doc.select('a[href*="/ville/"]'):
        href=a.get("href") or ""
        url2=urllib.parse.urljoin("https://baug.fr",href).split("#")[0].split("?")[0]
        if re.fullmatch(r"https://baug\.fr/ville/[a-z0-9-]+/",url2):
            city.append(url2)
    logging.info("BAUG %s: %d entries, %d city links",url,len(entries),len(set(city)))
    return entries,sorted(set(city))

def ouvert_from_page(url,dept):
    doc=download(url)
    if not doc:return [],[]
    entries=[]
    for card in doc.select("div.it[data-eid]"):
        ident=str(card.get("data-eid") or "")
        name=card.get("data-nom") or (card.select_one("h3").get_text(" ",strip=True) if card.select_one("h3") else "")
        addr=(card.select_one(".ad").get_text(" ",strip=True) if card.select_one(".ad") else card.get("data-adr") or "")
        cp=card.get("data-cp") or ""
        if cp[:2]!=dept or not ZIP.fullmatch(cp):continue
        try:
            lat=float(card.get("data-lat") or "")
            lon=float(card.get("data-lng") or "")
            if not (48.4<=lat<=49.3 and 1.6<=lon<=3.15):continue
        except (TypeError,ValueError):
            continue
        if not ident:continue
        entries.append({
           "source":"ouvert","source_id":ident,"name":str(name)[:140],"address":str(addr)[:180],
           "postcode":cp,"dept":dept,"source_url":url+"#"+str(card.get("id") or ""),
           "lat":round(lat,7),"lon":round(lon,7),"quality":quality(name,card.get("data-cat"))
        })
    cities=[]
    for a in doc.select("a[href]"):
        full=urllib.parse.urljoin("https://laverie.ouvert.tel",a.get("href","")).split("#")[0].split("?")[0]
        if re.fullmatch(r"https://laverie\.ouvert\.tel/"+dept+r"/[a-z0-9-]+/",full):
            cities.append(full)
    logging.info("OUVERT %s: %d entries, %d city links",url,len(entries),len(set(cities)))
    return entries,sorted(set(cities))

def lonlat_m(a,b):
    lat=(a["lat"]+b["lat"])*0.5
    dx=(a["lon"]-b["lon"])*111320*math.cos(math.radians(lat))
    dy=(a["lat"]-b["lat"])*111132
    return math.hypot(dx,dy)

def same_address(a,b):
    if (a.get("dept") or a.get("dep"))!=(b.get("dept") or b.get("dep")):return False
    pa,sa=address_key(a["address"],a.get("postcode"))
    pb,sb=address_key(b["address"],b.get("postcode"))
    na,nb=house(a["address"]),house(b["address"])
    if pa!=pb or not pa or not na or not nb or na!=nb:return False
    # Do not merge neighbouring buildings, even if the street string looks similar
    return sa==sb or difflib.SequenceMatcher(None,sa,sb).ratio()>=.88

def similar_name(a,b):
    def tokens(x):return {w for w in normalize(x).split() if w not in STOP and len(w)>=3}
    a,b=tokens(a),tokens(b)
    if not a or not b:return False
    return len(a&b)>=1 and len(a&b)/max(len(a),len(b))>=.5

def label_match(a,b):
    # Conservative: official addresses match or close geocoded points with
    # matching brand. 0-12m can match absent names but warns about same-building.
    if same_address(a,b):return True,"exact_street_number"
    if a.get("lat") is not None and b.get("lat") is not None:
        d=lonlat_m(a,b)
        if d<=12:return True,"proximity_under_12m_not_identity"
        if d<=45 and similar_name(a.get("name"),b.get("name")):
            return True,"proximity_and_brand"
    return False,None

def source_doc(rows,source,departments):
    return {"source":source,"generated_at":dt.datetime.now(dt.timezone.utc).isoformat(),
      "counts":dict(collections.Counter(r["dept"] for r in rows)),"source_pages":departments,
      "rows":rows}

def main():
    logging.basicConfig(level=logging.INFO,format="%(asctime)s %(levelname)s %(message)s")
    opened=[]
    baug=[]
    fetched={"baug":set(),"ouvert":set()}
    counts_by_source={}
    cityurls_by_dep={}
    for dept in DEPTS:
        url=f"https://laverie.ouvert.tel/{dept}/"
        result,cities=ouvert_from_page(url,dept)
        opened.extend(result)
        fetched["ouvert"].add(url)
        cityurls_by_dep[dept]=cities
        logging.info("%s: %d opened entries listed at department; visiting %d municipalities",dept,len(result),len(cities))
        for city in cities:
            if city==url or city in fetched["ouvert"]:continue
            part,_=ouvert_from_page(city,dept)
            opened.extend(part)
            fetched["ouvert"].add(city)
    opened_by_id={}
    for row in opened:
        key=row["source_id"]
        # Prefer locality detail page over department top-list entry
        if key not in opened_by_id or len(row["source_url"])>len(opened_by_id[key]["source_url"]):
            opened_by_id[key]=row
    opened=list(opened_by_id.values())
    for dept in DEPTS:
        base=f"https://baug.fr/departement/{dept}/"
        part,cities=baug_from_page(base,dept)
        baug.extend(part)
        fetched["baug"].add(base)
        if dept=="75":
            cities.extend(["https://baug.fr/ville/paris/"])
        # Try only city paths linked from actual open-directory pages plus BAUG department city links.
        for city in cityurls_by_dep.get(dept,[]):
            slug=urllib.parse.urlparse(city).path.rstrip("/").split("/")[-1]
            if dept=="75" and slug.startswith("paris-"):continue
            cities.append("https://baug.fr/ville/"+slug+"/")
        for city in sorted(set(cities)):
            if city in fetched["baug"]:continue
            sub,_=baug_from_page(city,dept)
            baug.extend(sub)
            fetched["baug"].add(city)
    unique_baug={}
    for r in baug:unique_baug[r["source_id"]]=r
    baug=list(unique_baug.values())
    now=dt.datetime.now(dt.timezone.utc).isoformat()
    if len(opened)<800 or len(baug)<350:
        raise RuntimeError(f"Insufficient directory coverage (OUVERT {len(opened)} / BAUG {len(baug)}). Refusing to publish incomplete inventory.")
    counts_by_source={"ouvert":dict(collections.Counter(x["dept"] for x in opened)),
                      "baug":dict(collections.Counter(x["dept"] for x in baug))}
    logging.info("Harvested OUVERT %d, BAUG %d, failed %d page(s)",len(opened),len(baug),len(FAILED))
    osm_doc=json.loads((DATA/"laveries-osm.json").read_text(encoding="utf-8"))
    osm=osm_doc["rows"]
    candidates=[{
        "id":"osm:"+p["id"],"name":p["name"],"address":p.get("address") or "",
        "postcode":next(iter(ZIP.findall(p.get("address",""))),""),
        "dept":p["dep"],"lat":p["lat"],"lon":p["lon"],
        "quality":p.get("quality","unclassified"),"source_refs":[{"source":"osm","id":p["id"],"url":p.get("osm_url","")}],
        "evidence":"Mapped by OSM, NOT field-verified","possible_duplicates":p.get("possible_duplicate_of")
    } for p in osm]
    # Bucketing avoids an expensive all-pairs comparison, but still evaluates same-address candidates across city.
    buckets=collections.defaultdict(list)
    for i,p in enumerate(candidates):
        if p["lat"] is not None:
            cell=(round(p["lat"]*700),round(p["lon"]*700))
            buckets[cell].append(i)
    def candidates_near(p):
        if p.get("lat") is None:return range(len(candidates))
        cell=(round(p["lat"]*700),round(p["lon"]*700))
        out=set()
        for dy in (-1,0,1):
            for dx in (-1,0,1):
                out.update(buckets.get((cell[0]+dy,cell[1]+dx),[]))
        return out
    def find_match(p):
        matching=[]
        for i in candidates_near(p):
            c=candidates[i]
            if p["dept"]!=c["dept"]:continue
            ok,method=label_match(p,c)
            if not ok:continue
            if c.get("source_refs") and any(r["source"]==p["source"] and r["id"]==p["source_id"] for r in c["source_refs"]):continue
            score=3 if method=="exact_street_number" else 2 if method=="proximity_and_brand" else 1
            matching.append((score,i,method))
        matching.sort(reverse=True)
        if len(matching)>1 and matching[0][0]==matching[1][0]:
            return None,"ambiguous_candidates"
        return (matching[0][1],matching[0][2]) if matching else (None,None)
    stats=collections.Counter()
    # OUVERT has coordinates, so a match to OSM can enrich source evidence; unmatched becomes its own candidate pin.
    for p in opened:
        idx,method=find_match(p)
        if idx is None:
            rec={"id":"ouvert:"+p["source_id"],"name":p["name"],"address":p["address"],"postcode":p["postcode"],
                 "dept":p["dept"],"lat":p["lat"],"lon":p["lon"],"quality":p["quality"],
                 "source_refs":[],"evidence":"Directory listing only, NOT field-verified","possible_duplicates":None}
            idx=len(candidates)
            candidates.append(rec)
            cell=(round(rec["lat"]*700),round(rec["lon"]*700))
            buckets[cell].append(idx)
            stats["ouvert_new_geo"]+=1
        else:
            stats["ouvert_linked"]+=1
        c=candidates[idx]
        if not c.get("address"):c["address"]=p["address"];c["postcode"]=p["postcode"]
        c["source_refs"].append({"source":"ouvert","id":p["source_id"],"url":p["source_url"],"match":method})
    # BAUG records are only assigned point coordinates when matching a known address, never guessed.
    postcode_index=collections.defaultdict(list)
    for i,c in enumerate(candidates):
        if c.get("postcode"):postcode_index[c["postcode"]].append(i)
    # Retrieve official SIRENE address points only to locate otherwise unplaced BAUG addresses,
    # not to certify a laundromat or identify a business at that address.
    sirene_path=DATA/"sirene-laundries.json"
    sirene=[]
    if sirene_path.exists():
        sirene=json.loads(sirene_path.read_text(encoding="utf-8")).get("rows",[])
    sirene_by_postcode=collections.defaultdict(list)
    for s in sirene:sirene_by_postcode[str(s.get("postcode",""))].append(s)
    for p in baug:
        matches=[]
        for i in postcode_index.get(p["postcode"],[]):
            c=candidates[i]
            if c["dept"]!=p["dept"]:continue
            if same_address(p,c):
                matches.append(i)
        if len(matches)==1:
            idx=matches[0]
            candidates[idx]["source_refs"].append({"source":"baug","id":p["source_id"],"url":p["source_url"],"match":"exact_address"})
            stats["baug_linked"]+=1
            continue
        # Unmatched BAUG: use exact SIRENE street number geocoordinates as a
        # spatial hint ONLY. The registered company may be a separate operator.
        pts=[s for s in sirene_by_postcode.get(p["postcode"],[]) if same_address(p,s)]
        distinct={(round(float(s["lat"]),5),round(float(s["lon"]),5)) for s in pts if s.get("lat") is not None}
        coords=list(distinct)[0] if len(distinct)==1 else (None,None)
        rec={"id":"baug:"+p["source_id"],"name":p["name"],"address":p["address"],"postcode":p["postcode"],
             "dept":p["dept"],"lat":coords[0],"lon":coords[1],"quality":p["quality"],
             "source_refs":[{"source":"baug","id":p["source_id"],"url":p["source_url"],"match":"unmatched"}],
             "evidence":"Directory listing only; coordinates from registry address if available; NOT field-verified",
             "possible_duplicates":"multiple_exact_address_candidates" if len(matches)>1 else None}
        candidates.append(rec)
        stats["baug_new_geo" if coords[0] is not None else "baug_new_unlocated"]+=1
    # Do not automatically merge similar records lacking exact matching identifiers
    # (address geocoding, fuzzy branding and same-building records can be distinct stores).
    src_totals=collections.Counter()
    for c in candidates:
        c["sources"]=sorted({x["source"] for x in c["source_refs"]})
        src_totals["+".join(c["sources"])]+=1
    candidates.sort(key=lambda c:(c["dept"],c["name"],c["id"]))
    coverage={d:{
        "osm":sum("osm" in c["sources"] for c in candidates if c["dept"]==d),
        "ouvert":sum("ouvert" in c["sources"] for c in candidates if c["dept"]==d),
        "baug":sum("baug" in c["sources"] for c in candidates if c["dept"]==d),
        "distinct_candidates":sum(c["dept"]==d for c in candidates),
        "geolocated":sum(c["dept"]==d and c["lat"] is not None for c in candidates),
        "unlocated":sum(c["dept"]==d and c["lat"] is None for c in candidates)
    } for d in DEPTS}
    out={"generated_at":now,"source":"OSM / Geofabrik + BAUG city directory + laverie.ouvert.tel city directory",
         "sources":{"osm":{"url":"https://www.openstreetmap.org/copyright","date":osm_doc.get("generated_at"),"count":len(osm)},
                    "baug":{"url":"https://baug.fr/","count":len(baug),"coverage":"Only index cards reachable from city and department pages"},
                    "ouvert":{"url":"https://laverie.ouvert.tel/","count":len(opened),"coverage":"Index cards from departments and city/Paris-arrondissement pages"}},
         "verify_status":"None of the listings has been field-verified. Google Maps and reviews were NOT collected. Directory names, addresses and links alone do not prove current business activity.",
         "matching":"Conservative, source IDs and exact normalized house+street+postal; OSM coordinates under 12m or <=45m if name similarity; ambiguous cases kept separately.",
         "counts":coverage,"total_candidates":len(candidates),"located_candidates":sum(c["lat"] is not None for c in candidates),
         "rows":candidates}
    audit={"generated_at":now,"source_counts":{"osm":len(osm),"ouvert":len(opened),"baug":len(baug)},
           "coverage":coverage,"match_stats":dict(stats),"composition":dict(src_totals),
           "total_candidates":len(candidates),"located_candidates":out["located_candidates"],
           "failed_pages":FAILED,"pages_examined":{k:len(v) for k,v in fetched.items()},
           "caveat":"Derived distinct candidate records are NOT verified distinct active self-service laundries. Matching and coordinate clues must be checked."}
    (DATA/"annuaire-croise.json").write_text(json.dumps(out,ensure_ascii=False,separators=(",",":"),allow_nan=False)+"\n",encoding="utf-8")
    (DATA/"annuaire-croise-audit.json").write_text(json.dumps(audit,ensure_ascii=False,indent=2,allow_nan=False)+"\n",encoding="utf-8")
    logging.info("FINISHED CROSS DIRECTORY AUDIT %s",json.dumps({k:v for k,v in audit.items() if k!="failed_pages"},ensure_ascii=False))
    if len(FAILED)>25:logging.warning("%s missing pages; result is NOT complete.",len(FAILED))

if __name__=="__main__":
    main()

# First full four-department catalogue reconciliation, 2026-11-18.
