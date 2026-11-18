#!/usr/bin/env python3
"""Build an OSM-mapped, NON-verified laundry inventory from a dated Geofabrik PBF snapshot.
No fabricated businesses. No private credentials. Node and way tags only; relations not processed.
"""
import datetime as dt
import json
import logging
import os
from pathlib import Path
import tempfile
import urllib.request

import osmium
from shapely.geometry import Point, shape
from shapely.ops import unary_union
from shapely.prepared import prep

ROOT=Path(__file__).resolve().parent.parent
DATA=ROOT/"data"
DATA.mkdir(exist_ok=True)
SOURCE="https://download.geofabrik.de/europe/france/ile-de-france-latest.osm.pbf"
DEPTS=("75","92","93","94")
HEADERS={"User-Agent":"ObservatoireLaveriesPublicData/1.0 (+https://github.com/guillaume-smbg/observatoire-laveries)"}


def get_geo(url):
    req=urllib.request.Request(url,headers=HEADERS)
    with urllib.request.urlopen(req,timeout=40) as res:
        return json.load(res)


def department_boundaries():
    boundaries={}
    for d in DEPTS:
        try:
            url=f"https://geo.api.gouv.fr/departements/{d}?fields=nom,code&format=geojson&geometry=contour"
            obj=get_geo(url)
            geom=obj.get("geometry")
            if not geom and obj.get("features"):
                geom=obj["features"][0].get("geometry")
            if not geom:
                raise ValueError("no administrative department polygon returned")
            poly=shape(geom)
            if poly.is_empty or not poly.is_valid:
                poly=poly.buffer(0)
            boundaries[d]=poly
        except Exception as exc:
            logging.warning("French department border unavailable %s: %s",d,exc)
    if len(boundaries)!=4:
        logging.warning("Using IRIS polygons as a conservative fallback for missing departmental borders")
        path=DATA/"iris-2022-contours.geojson"
        if path.exists():
            features=json.loads(path.read_text(encoding="utf-8")).get("features",[])
            for d in DEPTS:
                if d in boundaries:continue
                polygons=[shape(x["geometry"]) for x in features if str(x.get("properties",{}).get("id","")).startswith(d)]
                if polygons:
                    boundaries[d]=unary_union(polygons)
    if len(boundaries)<4:
        raise RuntimeError("Cannot verify the outlines of all four departments; refusing to manufacture coverage")
    return {k:prep(v) for k,v in boundaries.items()}


class LaundryHandler(osmium.SimpleHandler):
    def __init__(self,borders):
        super().__init__()
        self.borders=borders
        self.rows={}
        self.counts={d:0 for d in DEPTS}
        self.seen=0

    def add(self, obj, kind, lat, lon):
        tags={t.k:t.v for t in obj.tags}
        if tags.get("shop")!="laundry" and tags.get("amenity")!="laundry":
            return
        self.seen+=1
        if not(-90<=lat<=90 and -180<=lon<=180):
            return
        point=Point(lon,lat)
        dept=next((code for code,poly in self.borders.items() if poly.covers(point)),None)
        if not dept:
            return
        ident=f"{kind}/{obj.id}"
        if ident in self.rows:
            return
        self.rows[ident]={
            "id":ident,"name":tags.get("name") or "Laverie (nom absent)",
            "address":" ".join(filter(None,[tags.get("addr:housenumber",""),tags.get("addr:street",""),tags.get("addr:city","")])),
            "dep":dept,"lat":round(lat,7),"lon":round(lon,7),
            "kind":tags.get("shop") or tags.get("amenity") or "laundry",
            "self_service":tags.get("self_service") or tags.get("laundry:service") or "",
            "osm_url":"https://www.openstreetmap.org/"+ident,
            "source":"OpenStreetMap (Geofabrik PBF) — non vérifié"
        }
        self.counts[dept]+=1

    def node(self,node):
        if node.tags.get("shop")!="laundry" and node.tags.get("amenity")!="laundry":return
        if node.location.valid():
            self.add(node,"node",node.location.lat,node.location.lon)

    def way(self,way):
        if way.tags.get("shop")!="laundry" and way.tags.get("amenity")!="laundry":return
        pts=[node.location for node in way.nodes if node.location.valid()]
        if not pts:return
        self.add(way,"way",sum(p.lat for p in pts)/len(pts),sum(p.lon for p in pts)/len(pts))


def run():
    logging.basicConfig(level=logging.INFO,format="%(asctime)s %(levelname)s %(message)s")
    borders=department_boundaries()
    logging.info("Four department boundaries ready")
    fd,path=tempfile.mkstemp(suffix=".osm.pbf")
    os.close(fd)
    try:
        logging.info("Downloading daily OSM Île-de-France PBF (about 325 MB): %s",SOURCE)
        req=urllib.request.Request(SOURCE,headers=HEADERS)
        with urllib.request.urlopen(req,timeout=240) as stream,open(path,"wb") as out:
            size=0
            while True:
                chunk=stream.read(4*1024*1024)
                if not chunk:break
                out.write(chunk)
                size+=len(chunk)
        logging.info("Downloaded %s bytes",size)
        if size<50_000_000:
            raise RuntimeError("Extract unexpectedly small")
        handler=LaundryHandler(borders)
        handler.apply_file(path,locations=True)
        logging.info("Found %d mapped laundry POIs, %d inside target departments",handler.seen,len(handler.rows))
    finally:
        Path(path).unlink(missing_ok=True)
    if any(handler.counts[d]<10 for d in DEPTS):
        raise RuntimeError("Implausibly low department count, refusing overwrite: "+str(handler.counts))
    doc={
        "source":"OpenStreetMap via Geofabrik daily Île-de-France PBF — NON VÉRIFIÉ",
        "source_url":SOURCE,"generated_at":dt.datetime.now(dt.timezone.utc).isoformat(),
        "exhaustive":False,"professionally_verified":False,"failed_departments":[],
        "counts_by_department":handler.counts,
        "caveat":"Exhaustif uniquement pour les objets OSM étiquetés nodes/ways selon la date de l'extrait, non exhaustif des laveries existantes; inclut potentiellement des pressings; relations OSM non traitées; points ways approximatifs.",
        "rows":sorted(handler.rows.values(),key=lambda x:x["id"])
    }
    target=DATA/"laveries-osm.json"
    target.write_text(json.dumps(doc,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
    logging.info("Wrote %s: %s locations with per-department counts %s",target,len(handler.rows),handler.counts)
    (DATA/"osm-extract-status.json").write_text(json.dumps({
        "source_url":SOURCE,"generated_at":doc["generated_at"],
        "total":len(handler.rows),"counts_by_department":handler.counts,
        "method":"Geofabrik PBF with official French department polygons, nodes and ways",
        "limit":"Not an inventory of verified self-service laundromats",
    },ensure_ascii=False,indent=2)+"\n",encoding="utf-8")


if __name__=="__main__":
    run()
