#!/usr/bin/env python3
"""One-time public-directory feasibility probe. No collection of bulk records."""
import re, urllib.parse, urllib.request, urllib.robotparser, html
from html.parser import HTMLParser
class Probe(HTMLParser):
 def __init__(self): super().__init__();self.links=[];self.h=[];self.title='';self.current_h=False
 def handle_starttag(self,tag,attrs):
  attrs=dict(attrs)
  if tag=='a' and attrs.get('href'):self.links.append(attrs['href'])
  if tag in ('h1','h2','h3'):self.current_h=True
 def handle_endtag(self,tag):
  if tag in ('h1','h2','h3'):self.current_h=False
 def handle_data(self,data):
  if self.current_h and len(self.h)<8:self.h.append(data.strip()[:100])
sources=[
 ("BAUG","https://baug.fr/departement/93/"),
 ("BAUG-city","https://baug.fr/ville/boulogne-billancourt/"),
 ("Laverie ouvert","https://laverie.ouvert.tel/93/"),
 ("Laverie ouvert-Paris","https://laverie.ouvert.tel/75/")
]
headers={"User-Agent":"ObservatoireLaveriesResearch/1.0 (+https://github.com/guillaume-smbg/observatoire-laveries)","Accept":"text/html"}
def read(url):
 req=urllib.request.Request(url,headers=headers)
 with urllib.request.urlopen(req,timeout=22) as res:return res.read(2_000_000).decode("utf-8","replace"),res.status,res.geturl()
for name,url in sources:
 p=urllib.parse.urlparse(url);root=f'{p.scheme}://{p.netloc}'
 try:
  txt,_,_=read(root+'/robots.txt')
  print('ROBOTS',name,txt[:600].replace('\n',' / '),flush=True)
  rp=urllib.robotparser.RobotFileParser();rp.parse(txt.splitlines())
  ok=rp.can_fetch(headers["User-Agent"],url)
 except Exception as e:
  print('ROBOTS_ERROR',name,str(e)[:120],flush=True);ok=False
 print('PERMITTED',name,ok,flush=True)
 if not ok:continue
 try:
  page,status,final=read(url)
  parsed=Probe();parsed.feed(page)
  internal=[v for v in parsed.links if v.startswith('/') or p.netloc in v]
  print('PAGE',name,status,final,'bytes',len(page),'links',len(parsed.links),'headings',parsed.h[:7],flush=True)
  print('LINK_SAMPLE',name,internal[:25],flush=True)
  print('COUNTS',name,re.findall(r'.{0,35}(?:laveries automatiques|laveries|résultats|établissements).{0,70}',re.sub(r'<[^>]+>',' ',page),flags=re.I)[:5],flush=True)
  print('JSONLD',name,bool(re.search(r'application/ld\\+json',page,re.I)),'PAGINATION',any('page=' in x or '/page/' in x for x in internal),flush=True)
 except Exception as e:print('PAGE_ERROR',name,str(e)[:300],flush=True)
