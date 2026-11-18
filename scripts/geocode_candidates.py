#!/usr/bin/env python3
"""Address-only geocoding of unlocated public directory candidates using IGN Geoplateforme.

Geocoded address does NOT prove business operation or the matching storefront.
A candidate is accepted only for high-scoring housenumber results with exact
postal code and street number. No company identities are sent to IGN.
"""
import datetime as dt
import json
import logging
import math
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

DATA=Path(__file__).resolve().parent.parent/"data"
API="https://data.geopf.fr/geocodage/search"
HEADERS={"User-Agent":"ObservatoireLaveries/1.0 (+https://github.com/guillaume-smbg/observatoire-laveries)","Accept":"application/json"}
DEPTS={"75","92","93","94"}
NUMBER=re.compile(r"^\s*(\d{1,4})(?:\s*(bis|ter|quater|b|t|q))?(?=\W|$)",re.I)
MIN_SCORE=.82
# Match abbreviations only as standalone address tokens. In particular, a bare
# \bR\b would also rewrite the first letter of every full "Rue".
ADDRESS_ABBREVIATIONS=(
    (re.compile(r"\bBd\.?(?=\s|$)",re.I),"Boulevard"),
    (re.compile(r"\bAv\.?(?=\s|$)",re.I),"Avenue"),
    (re.compile(r"\bImp\.?(?=\s|$)",re.I),"Impasse"),
    (re.compile(r"\bPl\.?(?=\s|$)",re.I),"Place"),
    (re.compile(r"\bR\.?(?=\s|$)",re.I),"Rue"),
    (re.compile(r"\bSq\.?(?=\s|$)",re.I),"Square"),
    (re.compile(r"\bCh\.?(?=\s|$)",re.I),"Chemin"),
    (re.compile(r"\bSt\.?(?=\s|$)",re.I),"Saint"),
    (re.compile(r"\bSte\.?(?=\s|$)",re.I),"Sainte"),
)

def house(value):
    m=NUMBER.search(str(value or ""))
    if not m:return None
    suffix=(m.group(2) or "").lower()
    suffix={"b":"bis","t":"ter","q":"quater"}.get(suffix,suffix)
    return (int(m.group(1)),suffix)

def query_address(value,postcode):
    """Send only a cleaned street address and one postal code to the BAN."""
    text=str(value or "").strip()
    # A house number must start the address; avoid transmitting a business name
    # that may have been accidentally stored in the address field.
    if house(text) is None:return ""
    text=re.sub(r"(?<!\d)\d{5}(?!\d)"," ",text)
    text=re.sub(r"[,;]+"," ",text)
    for pattern,replacement in ADDRESS_ABBREVIATIONS:
        text=pattern.sub(replacement,text)
    text=" ".join(text.split())
    return (text+" "+str(postcode).strip()).strip()

def fetch(q):
    url=API+"?"+urllib.parse.urlencode({"q":q,"limit":4,"index":"address","autocomplete":0})
    for tries in range(3):
        try:
            req=urllib.request.Request(url,headers=HEADERS)
            with urllib.request.urlopen(req,timeout=25) as r:
                j=json.load(r)
            return j.get("features",[]) if isinstance(j,dict) else []
        except Exception as err:
            if tries==2:raise
            logging.warning("IGN service: %s; retrying",str(err)[:120])
            time.sleep(2*(tries+1))
    return []

def check(candidate,features):
    cp=str(candidate.get("postcode") or "").strip()
    num=house(candidate.get("address"))
    if num is None or len(cp)!=5 or cp[:2] not in DEPTS:
        return None,"no_valid_housenumber_or_postcode"
    reasons=[]
    for f in features:
        p=f.get("properties") or {}
        g=f.get("geometry") or {}
        coords=g.get("coordinates") or []
        p_cp=str(p.get("postcode") or "")
        pnum=house(p.get("name") or p.get("label"))
        ptype=str(p.get("type") or "")
        score=float(p.get("score") or 0)
        try:lon,lat=map(float,coords[:2])
        except (ValueError,TypeError):continue
        if (score>=MIN_SCORE and p_cp==cp and pnum==num and ptype=="housenumber" and
            48.4<=lat<=49.3 and 1.7<=lon<=3.15):
            return {
                "id":candidate["id"],"lat":round(lat,7),"lon":round(lon,7),
                "score":round(score,3),"precision":"BAN_housenumber_address_not_business",
                "matched_postcode":p_cp,"matched_house_number":pnum[0],"matched_repetition":pnum[1],
                "source":"IGN Géoplateforme / Base Adresse Nationale",
                "matched_label":str(p.get("label") or "")[:150]
            },None
        reasons.append(f"{ptype}/{score:.2f}/{p_cp}/{pnum}")
    return None,(";".join(reasons[:3]) or "no_results")

def main():
    logging.basicConfig(level=logging.INFO,format="%(asctime)s %(levelname)s %(message)s")
    full=json.loads((DATA/"annuaire-croise.json").read_text(encoding="utf-8"))
    candidates=[x for x in full["rows"] if x.get("lat") is None]
    if not candidates:
        raise RuntimeError("No unlocated address candidates found. Is source broken?")
    result=[]
    rejected=[]
    seen_cache={}
    for i,p in enumerate(candidates):
        cp=str(p.get("postcode") or "").strip()
        q=query_address(p.get("address"),cp)
        if not q or not cp:
            rejected.append({"id":p["id"],"reason":"no_address"});continue
        key=q.lower()
        if key in seen_cache:
            features=seen_cache[key]
        else:
            try: features=fetch(q)
            except Exception as err:
                rejected.append({"id":p["id"],"reason":"network_error:"+str(err)[:100]})
                continue
            seen_cache[key]=features
            time.sleep(.11)
        accepted,why=check(p,features)
        if accepted:result.append(accepted)
        else:rejected.append({"id":p["id"],"reason":why})
        if (i+1)%50==0:
            logging.info("Processed %d / %d candidates; accepted %d, rejected %d",i+1,len(candidates),len(result),len(rejected))
    if len(result)+len(rejected)!=len(candidates):
        raise AssertionError("Lost geocoding candidates")
    payload={
        "source":"IGN Géoplateforme / Base Adresse Nationale",
        "source_url":API,
        "directory_generated_at":full.get("generated_at"),
        "generated_at":dt.datetime.now(dt.timezone.utc).isoformat(),
        "unlocated_before":len(candidates),
        "address_only_not_business_verification":True,
        "minimum_match_score":MIN_SCORE,
        "accepted":len(result),
        "rejected":len(rejected),
        "rows":result,
        "rejected_rows":rejected,
        "note":"Strict postal code, street number, housenumber type and score; accepted points are addresses, NOT verified open laundromats."
    }
    (DATA/"geocoded-addresses.json").write_text(json.dumps(payload,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
    logging.info("Geocoding complete: %d/%d mapped at address level (NOT verified shops)",len(result),len(candidates))

if __name__=="__main__":
    main()

# Initial deployment and source-integrity run.
