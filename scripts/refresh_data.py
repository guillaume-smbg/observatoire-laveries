#!/usr/bin/env python3
"""Public-data-only refresh. No credentials, invented entries or personal data."""
import csv
import datetime as dt
import io
import json
import logging
import re
import time
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data"
OUT.mkdir(parents=True, exist_ok=True)
DEPTS = ("75", "92", "93", "94")
HEADERS = {"User-Agent": "ObservatoireLaveriesOpenData/1.0 (public academic mapping project)", "Accept": "*/*"}
INSEE_LOG = "https://www.insee.fr/fr/statistiques/fichier/8647012/base-ic-logement-2022_csv.zip"
INSEE_POP = "https://www.insee.fr/fr/statistiques/fichier/8647014/base-ic-evol-struct-pop-2022_csv.zip"
GEO_URLS = [
    "https://data.iledefrance.fr/api/explore/v2.1/catalog/datasets/iris/exports/geojson",
    "https://data.iledefrance.fr/explore/dataset/iris/download/?format=geojson&timezone=Europe%2FParis&lang=fr",
]
OVERPASS = [
    "https://overpass.private.coffee/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass-api.de/api/interpreter",
]


def retrieve(url, payload=None, timeout=65, retries=2):
    req = urllib.request.Request(url, data=payload, headers=HEADERS, method="POST" if payload else "GET")
    error = None
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as res:
                body = res.read()
                if not body:
                    raise ValueError("empty response")
                return body
        except Exception as exc:
            error = exc
            logging.warning("source %s: attempt %s: %s", url[:65], attempt + 1, exc)
            if attempt < retries - 1:
                time.sleep(2 * (attempt + 1))
    raise RuntimeError(str(error))


def save(filename, obj):
    target = OUT / filename
    data = json.dumps(obj, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n"
    target.write_text(data, encoding="utf-8")
    logging.info("Wrote %s: %s bytes", filename, len(data))


def csvrows(blob, required):
    z = zipfile.ZipFile(io.BytesIO(blob))
    members = sorted((x for x in z.infolist() if x.filename.lower().endswith(".csv")), key=lambda x: x.file_size, reverse=True)
    for entry in members:
        stream = io.TextIOWrapper(z.open(entry), encoding="utf-8-sig", errors="replace", newline="")
        first = []
        for _ in range(10):
            line = stream.readline()
            if not line:
                break
            first.append(line)
            if all(x in line.upper() for x in required):
                delimiter = ";" if line.count(";") > line.count(",") else ","
                columns = next(csv.reader([line], delimiter=delimiter))
                columns = [c.strip().upper().replace("\ufeff", "") for c in columns]
                reader = csv.DictReader(stream, fieldnames=columns, delimiter=delimiter)
                logging.info("CSV %s, columns=%s", entry.filename, columns[:12])
                yield from reader
                return
        stream.close()
    raise RuntimeError("INSEE CSV header missing: " + ",".join(required))


def val(row, *names):
    for name in names:
        raw = row.get(name.upper())
        if raw not in ("", None, "s", "S", "nd", "ND"):
            try:
                return float(str(raw).replace(",", "."))
            except ValueError:
                continue
    return None


def iris_code(row):
    return str(row.get("IRIS", "")).strip()


def collect_demography():
    logging.info("Fetching official INSEE housing 2022")
    housing = {}
    for row in csvrows(retrieve(INSEE_LOG, timeout=80), ("IRIS", "P22_RP")):
        code = iris_code(row)
        if code[:2] not in DEPTS or len(code) != 9:
            continue
        homes = val(row, "P22_RP")
        small = val(row, "P22_RP_M30M2")
        small30 = val(row, "P22_RP_3040M2")
        renters = val(row, "P22_RP_LOC")
        if not homes or homes <= 0:
            continue
        housing[code] = {
            "id": code, "dep": code[:2], "name": row.get("LIBIRIS") or row.get("LIBCOM") or code,
            "commune": row.get("LIBCOM") or "", "homes": round(homes),
            "small": round(small + small30) if small is not None and small30 is not None else None,
            "small_pct": round(100 * (small + small30) / homes, 1) if small is not None and small30 is not None else None,
            "renters_pct": round(100 * renters / homes, 1) if renters is not None else None,
        }
    logging.info("Housing rows IDF: %s", len(housing))
    if len(housing) < 200:
        raise RuntimeError("Housing rows too few: " + str(len(housing)))
    logging.info("Fetching official INSEE population 2022")
    for row in csvrows(retrieve(INSEE_POP, timeout=80), ("IRIS", "P22_POP")):
        code = iris_code(row)
        if code in housing:
            pop = val(row, "P22_POP")
            housing[code]["population"] = round(pop) if pop is not None else None
    logging.info("Fetching 2024 IRIS geometry IDF")
    features = None
    for url in GEO_URLS:
        try:
            geo = json.loads(retrieve(url, timeout=80, retries=1))
            features = geo.get("features")
            if not features:
                raise ValueError("GeoJSON features missing")
            break
        except Exception as exc:
            logging.warning("Geometry URL failed: %s", exc)
    if not features:
        raise RuntimeError("No geographical reference source")
    from shapely.geometry import shape
    matched = {}
    code_pattern = re.compile(r"^(?:75|92|93|94)\d{7}$")
    for feature in features:
        props = feature.get("properties") or {}
        code = next((str(x).strip() for x in props.values() if isinstance(x, (str, int)) and code_pattern.fullmatch(str(x).strip())), "")
        if code not in housing or not feature.get("geometry"):
            continue
        try:
            point = shape(feature["geometry"]).representative_point()
            matched[code] = [round(point.y, 6), round(point.x, 6)]
        except Exception:
            continue
    result = []
    for code, row in housing.items():
        if row.get("population") is None or code not in matched:
            continue
        row["lat"], row["lon"] = matched[code]
        result.append(row)
    logging.info("Joined housing+population+geometry: %s IRIS", len(result))
    if len(result) < 200:
        raise RuntimeError("IRIS join failed; no data file overwritten")
    result.sort(key=lambda x: x["id"])
    save("iris-2022.json", {
        "source": "INSEE RP 2022 — bases IRIS logement et population ; IGN/Insee contours IRIS 2024 via data.iledefrance.fr",
        "source_urls": [INSEE_LOG, INSEE_POP, GEO_URLS[0]],
        "year": 2022, "geography_year": 2024, "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "verified_businesses": False, "coverage": "IRIS avec données jointes, pas toutes les zones",
        "rows": result
    })
    return len(result)


def collect_osm():
    rows = {}
    per_dept = {}
    failed = []
    for dep in DEPTS:
        # The administrative-area filter is essential: a bounding box alone also includes outer suburbs.
        query = ('[out:json][timeout:130];'
                 'area["boundary"="administrative"]["admin_level"="6"]["ref:INSEE"="' + dep + '"]->.sector;'
                 '(nwr(area.sector)["shop"="laundry"];nwr(area.sector)["amenity"="laundry"];);'
                 'out center tags;')
        payload = urllib.parse.urlencode({"data": query}).encode()
        response = None
        for url in OVERPASS:
            try:
                response = json.loads(retrieve(url, payload=payload, timeout=45, retries=1))
                break
            except Exception as exc:
                logging.warning("Overpass %s / %s: %s", dep, url, exc)
        if response is None:
            failed.append(dep)
            continue
        elements = response.get("elements", [])
        if len(elements) < 5:
            logging.warning("Dept %s: only %s OSM objects returned; classification rejected", dep, len(elements))
            failed.append(dep)
            continue
        per_dept[dep] = len(elements)
        for obj in elements:
            tags = obj.get("tags") or {}
            center = obj.get("center") or obj
            lat, lon = center.get("lat"), center.get("lon")
            if not isinstance(lat, (float, int)) or not isinstance(lon, (float, int)):
                continue
            identifier = str(obj.get("type")) + "/" + str(obj.get("id"))
            if identifier in rows:
                continue
            # A mapped laundry is not necessarily a self-service laundromat.
            rows[identifier] = {
                "id": identifier, "name": tags.get("name") or "Laverie (nom absent)",
                "address": " ".join(str(tags.get(k, "")).strip() for k in ("addr:housenumber", "addr:street", "addr:city")).strip(),
                "dep": dep, "lat": round(lat, 7), "lon": round(lon, 7),
                "kind": tags.get("shop") or tags.get("amenity") or "laundry",
                "self_service": tags.get("self_service") or tags.get("laundry:service") or "",
                "osm_url": "https://www.openstreetmap.org/" + identifier,
                "source": "OpenStreetMap — non vérifié"
            }
    logging.info("OSM records: %s ; missing departments: %s", len(rows), failed)
    if not rows:
        raise RuntimeError("No valid OSM records; previous data retained")
    save("laveries-osm.json", {
        "source": "OpenStreetMap / Overpass API — données contributives NON VÉRIFIÉES",
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(), "exhaustive": False,
        "professionally_verified": False, "failed_departments": failed, "counts_by_department": per_dept,
        "caveat": "La catégorie OSM shop=laundry peut inclure pressings et blanchisseries non automatiques.",
        "rows": list(sorted(rows.values(), key=lambda x: x["id"]))
    })
    return len(rows)


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    jobs = (("iris", collect_demography), ("osm", collect_osm))
    errors = {}
    counts = {}
    for name, work in jobs:
        try:
            counts[name] = work()
        except Exception as exc:
            logging.exception("Source %s failed", name)
            errors[name] = str(exc)[:500]
    save("refresh-status.json", {
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "counts": counts, "errors": errors, "note": "Partial failures do not generate invented or empty replacement datasets."
    })
    if errors:
        logging.warning("Partial refresh: %s", errors)
    # Intentionally exit 0: allow status file and other successful data to be committed.
    # Missing datasets must be surfaced as unavailable by the client.


if __name__ == "__main__":
    main()
