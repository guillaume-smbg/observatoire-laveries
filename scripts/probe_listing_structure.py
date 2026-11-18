#!/usr/bin/env python3
import requests,bs4,re,urllib.parse,urllib.robotparser
urls=[
"https://baug.fr/ville/boulogne-billancourt/",
"https://baug.fr/departement/93/",
"https://laverie.ouvert.tel/93/",
"https://laverie.ouvert.tel/75/paris-7e/"
]
for u in urls:
 try:
  r=requests.get(u,timeout=35,headers={"User-Agent":"ObservatoireLaveriesResearch/1.0","Accept":"text/html"})
  soup=bs4.BeautifulSoup(r.text,"html.parser")
  print("\nSOURCE",u,r.status_code,len(r.content))
  for tag in soup.select('h2,h3,h4')[:13]:
   name=tag.get_text(' ',strip=True)
   if len(name)<4:continue
   parent=tag.parent
   grand=parent.parent if parent else None
   print("HEADER",name[:90],"TAG",tag.name,tag.get("class"),"PAR",parent.name if parent else None,parent.get("class") if parent else None,"GP",grand.name if grand else None,grand.get("class") if grand else None)
   print("PARENT_TXT",parent.get_text(' ',strip=True)[:260] if parent else '')
   print("GRAND_TXT",grand.get_text(' ',strip=True)[:350] if grand else '')
   print("PARENT_OUTER",str(parent)[:850] if parent else '')
  print("TOTAL H3",len(soup.find_all('h3')),"TOTAL ARTICLE",len(soup.find_all('article')),"total scripts",len(soup.find_all('script')))
  print("CITY_LINKS",[x.get("href") for x in soup.select("a[href]") if "/ville/" in x.get("href","") or re.search(r"/(75|93)/[\w-]+/$",x.get("href",""))][:15])
 except Exception as e:print('ERROR',str(e))
