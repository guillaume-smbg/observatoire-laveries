import urllib.request, time
sources={
"INSEE LOG":"https://www.insee.fr/fr/statistiques/fichier/8647012/base-ic-logement-2022_csv.zip",
"INSEE POP":"https://www.insee.fr/fr/statistiques/fichier/8647014/base-ic-evol-struct-pop-2022_csv.zip",
"Contours IRIS":"https://data.iledefrance.fr/api/explore/v2.1/catalog/datasets/iris/exports/geojson",
"OSM Overpass":"https://overpass.kumi.systems/api/interpreter",
}
for name,url in sources.items():
    t=time.monotonic()
    try:
        req=urllib.request.Request(url,method="HEAD",headers={"User-Agent":"Mozilla/5.0"})
        with urllib.request.urlopen(req,timeout=12) as r:
            print(name, "STATUS", r.status, "TYPE",r.headers.get("content-type"),"LENGTH",r.headers.get("content-length"),"SECONDS",round(time.monotonic()-t,1),flush=True)
    except Exception as e:
        print(name,"ERROR",str(e)[:250],"SECONDS",round(time.monotonic()-t,1),flush=True)

# Run diagnostics after workflow registration.

import json
try:
    req=urllib.request.Request("https://data.iledefrance.fr/api/explore/v2.1/catalog/datasets/iris/records?limit=1",headers={"User-Agent":"Mozilla/5.0"})
    with urllib.request.urlopen(req,timeout=16) as r:
        j=json.load(r)
        print("IRIS GEOMETRY SAMPLE PROPERTY KEYS:",repr(list((j.get("results") or [{}])[0].keys())),flush=True)
        print("IRIS GEOMETRY SAMPLE PROPERTIES:",repr({k:v for k,v in (j.get("results") or [{}])[0].items() if k not in ("geo_shape","geo_point_2d")}),flush=True)
except Exception as exc:
    print("GEOMETRY SAMPLE ERR",str(exc)[:250],flush=True)
