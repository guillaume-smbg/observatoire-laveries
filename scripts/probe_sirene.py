import json,urllib.parse,urllib.request,time
base="https://recherche-entreprises.api.gouv.fr/search"
headers={"User-Agent":"ObservatoireLaveries/1.0 (public data audit)","Accept":"application/json"}
for dept in ['75','92']:
    params={'activite_principale':'96.01B','departement':dept,'etat_administratif':'A','per_page':'2','page':'1'}
    url=base+'?'+urllib.parse.urlencode(params)
    try:
        req=urllib.request.Request(url,headers=headers)
        with urllib.request.urlopen(req,timeout=25) as r:
            doc=json.load(r)
        print('DEPT',dept,'META',{k:v for k,v in doc.items() if k!='results'},flush=True)
        for item in doc.get('results',[])[:2]:
            print('COMPANY KEYS',list(item),flush=True)
            print('SIEGE',json.dumps(item.get('siege'),ensure_ascii=False)[:1400],flush=True)
            print('MATCHING ETS',json.dumps(item.get('matching_etablissements'),ensure_ascii=False)[:1900],flush=True)
    except Exception as e:
        print('ERROR',dept,str(e)[:450],flush=True)
    time.sleep(.5)

# Diagnostic API for source qualification.
