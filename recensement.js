/* Cross-directory discovery, all leads unverified; no scraping in users' browsers. */
(() => {
'use strict';
const $=id=>document.getElementById(id);
const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fr=n=>Number(n||0).toLocaleString('fr-FR');
const labels={
  osm:'OpenStreetMap',ouvert:'Laverie Ouvert',baug:'BAUG',
  self_service_tagged:'Libre-service indiqué dans OSM, non vérifié',
  possibly_automatic:'Nom OSM évocateur, non vérifié',
  likely_laundry_unverified:'Nom d’annuaire évocateur, non vérifié',
  possibly_nonautomatic:'Pressing / blanchisserie non automatique possible',
  probably_not_automatic:'OSM : non automatique possible',
  uncertain_type:'Type de commerce incertain',
  unclassified:'OSM : type non classé',
  pending:'À vérifier',google_seen:'Recherche Google consultée',confirmed:'Contrôlé personnellement sur place',
  excluded:'À exclure (contrôle local)'
};
const statusKey='laveries-croisement-verifications-v1';
let reviews={};try{reviews=JSON.parse(localStorage.getItem(statusKey)||'{}')||{}}catch(_){}
let doc=null,audit=null,priorityDoc=null,priorityMap=new Map(),rows=[],filtered=[],markers=null,focus=null;
const map=L.map('map').setView([48.855,2.35],11);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© OpenStreetMap contributors'}).addTo(map);
markers=L.layerGroup().addTo(map);
function getStatus(p){return reviews[p.id]?.status||'pending'}
function saveReview(id,field,value){
  reviews[id]={...(reviews[id]||{}),[field]:value,date:new Date().toISOString()};
  try{localStorage.setItem(statusKey,JSON.stringify(reviews))}catch(_){}
  render();
}
function saveStatus(id,status){saveReview(id,'status',status)}
function gmaps(p){
  const query=[p.name,p.address||p.postcode||'', 'France'].filter(Boolean).join(', ');
  return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(query);
}
function linkRef(r){
  const urls={osm:/^https:\/\/www\.openstreetmap\.org\/(node|way|relation)\/\d+$/,
    baug:/^https:\/\/baug\.fr\/(ville|departement)\/[\w-]+\/#?[\w-]*$/,
    ouvert:/^https:\/\/laverie\.ouvert\.tel\/(75|92|93|94)\/[\w-]+\/#?[\w-]*$/};
  return urls[r.source]?.test(r.url||'') ?'<a href="'+safe(r.url)+'" target="_blank" rel="noopener noreferrer">'+safe(labels[r.source]||r.source)+' ↗</a>':'';
}
function getFiltered(){
  const d=$('dept').value,s=$('source').value,q=$('search').value.trim().toLocaleLowerCase('fr'),
    quality=$('quality').value,geo=$('geo').value,status=$('status').value,priority=$('priority').value;
  filtered=rows.filter(p=>
    (!d||p.dept===d)&&(!q||[p.name,p.address,p.postcode,p.id].some(x=>String(x||'').toLocaleLowerCase('fr').includes(q)))&&
    (!s||(s==='multi'?p.sources.length>=2:s==='nonosm'?!p.sources.includes('osm'):p.sources.includes(s)))&&
    (!quality||p.quality===quality)&&(!geo||(geo==='yes'?p.lat!==null:p.lat===null))&&
    (!status||getStatus(p)===status)&&(!priority||String(priorityMap.get(p.id)?.priority||'').startsWith(priority))
  );
  if($('sort').value==='priority')filtered.sort((a,b)=>(priorityMap.get(b.id)?.points||0)-(priorityMap.get(a.id)?.points||0)||a.dept.localeCompare(b.dept));
  else if($('sort').value==='name')filtered.sort((a,b)=>a.name.localeCompare(b.name,'fr'));
  else if($('sort').value==='dept')filtered.sort((a,b)=>a.dept.localeCompare(b.dept)||a.name.localeCompare(b.name,'fr'));
  else filtered.sort((a,b)=>b.sources.length-a.sources.length||a.dept.localeCompare(b.dept)||a.name.localeCompare(b.name,'fr'));
  return filtered;
}
function showDetails(id,pan=true){
  const p=rows.find(x=>x.id===id);if(!p)return;focus=p;
  if(pan&&p.lat!==null)map.setView([p.lat,p.lon],16);
  const recorded=reviews[p.id];
  const matches=p.source_refs.map(linkRef).filter(Boolean).join(' · ');
  $('selected').innerHTML='<h3>'+safe(p.name)+'</h3>'
    +'<p>'+safe(p.address||'Adresse non renseignée')+' · '+safe(p.dept)+'</p>'
    +'<p><strong>'+safe(p.sources.length)+' source(s) · '+safe(labels[p.quality]||p.quality)+'</strong></p>'
    +(priorityMap.get(p.id)?'<p><strong>Vérification : '+safe(priorityMap.get(p.id).priority)+'</strong> · '+safe(priorityMap.get(p.id).reasons||'')+'</p>':'')
    +'<p>'+matches+'</p>'
    +'<p><a href="'+safe(gmaps(p))+'" target="_blank" rel="noopener noreferrer">Rechercher cet établissement sur Google Maps ↗</a></p>'
    +'<p class="sub">'+safe(p.evidence||'Non vérifié')+'</p>'
    +(p.lat===null?'<p class="sub">Coordonnées absentes : non placé sur la carte.</p>':
      p.geocoded_by_ban?'<p class="notice">Point issu de l’adresse IGN/BAN (score '+safe(p.geocoding_score)+') : numéro de rue localisé, commerce non vérifié.</p>':'<p class="sub">Position provenant d’un annuaire ou d’OSM, non vérifiée sur place.</p>')
    +(p.possible_duplicates?'<p class="notice">Possible doublon ou rapprochement ambigu : '+safe(p.possible_duplicates)+'</p>':'')
    +'<label>Mon résultat de vérification<select id="local-check">'
    +[['pending','À vérifier'],['google_seen','Fiche Google consultée et jugée concordante (non vérifiée sur place)'],
      ['confirmed','Vérifié personnellement sur place'],['excluded','À exclure (fermé, pressing, doublon…)']]
      .map(([v,n])=>'<option value="'+v+'"'+(getStatus(p)===v?' selected':'')+'>'+n+'</option>').join('')
    +'</select></label>'
    +'<label>Type constaté<select id="local-type">'+[
       ['','Non renseigné'],['automatic','Laverie automatique'],['pressing','Pressing / blanchisserie non libre-service'],
       ['closed','Fermée / inexistante'],['duplicate','Doublon confirmé'],['other','Autre']
      ].map(([v,t])=>'<option value="'+v+'"'+((reviews[p.id]?.type||'')===v?' selected':'')+'>'+t+'</option>').join('')+'</select></label>'
    +'<label>Note de contrôle (locale, facultative)<textarea id="local-note" maxlength="800" rows="3" placeholder="Date, constat, machines, tarif…">'+safe(reviews[p.id]?.note||'')+'</textarea></label>'
    +'<label>Lien de preuve / référence (facultatif)<input type="url" id="local-evidence" maxlength="350" placeholder="https://…" value="'+safe(reviews[p.id]?.evidence||'')+'"></label>'
    +(recorded?'<p class="sub">Dernière saisie locale : '+safe(recorded.date||'inconnue')+'</p>':'')
    +'<p class="sub">Le statut est conservé uniquement dans ce navigateur, pas partagé publiquement.</p>';
  $('local-check').onchange=v=>saveStatus(p.id,v.target.value);
  $('local-type').onchange=v=>saveReview(p.id,'type',v.target.value);
  $('local-note').onchange=v=>saveReview(p.id,'note',v.target.value.slice(0,800));
  $('local-evidence').onchange=v=>saveReview(p.id,'evidence',v.target.value.slice(0,350));}
function render(){
  if(!doc)return;
  const filt=getFiltered(),limit=Number($('limit').value),display=filt.slice(0,limit);
  $('summary').textContent=fr(filt.length)+' candidats correspondant aux filtres, '+fr(filt.filter(x=>x.lat!==null).length)+' géolocalisés. '+fr(display.length)+' lignes visibles ; aucune vérification terrain automatique.';
  $('body').innerHTML=display.map(p=>
    '<tr><td><button class="secondary" type="button" data-select="'+safe(p.id)+'">'+safe(p.name)+'</button><small class="block">'+safe(p.address||'Adresse inconnue')+'</small></td>'
    +'<td>'+safe(p.dept)+'</td><td>'+p.sources.map(src=>'<span class="tag '+(src==='osm'?'good':'')+'">'+safe(labels[src]||src)+'</span>').join('')+'</td>'
    +'<td><small>'+safe(labels[p.quality]||p.quality)+'</small><small class="block">'+(p.lat===null?'Sans position sûre':p.geocoded_by_ban?'Adresse IGN/BAN (commerce non vérifié)':'Position renseignée')+'</small>'
    +(priorityMap.get(p.id)?'<span class="tag warn">'+safe(priorityMap.get(p.id).priority.split(' — ')[0])+' : à contrôler</span>':'')
    +(getStatus(p)!=='pending'?'<span class="tag warn">'+safe(labels[getStatus(p)])+'</span>':'')+'</td>'
    +'<td><a href="'+safe(gmaps(p))+'" target="_blank" rel="noopener noreferrer">Google Maps ↗</a></td></tr>'
  ).join('')||'<tr><td colspan="5">Aucune fiche correspondant aux filtres.</td></tr>';
  document.querySelectorAll('[data-select]').forEach(x=>x.onclick=()=>showDetails(x.dataset.select));
  markers.clearLayers();
  // Keep the map responsive: plot at most 2,800 visible geo points.
  for(const p of filt.filter(x=>x.lat!==null).slice(0,2800)){
    const color=p.geocoded_by_ban?'#8a69ae':p.sources.length>=2?'#1f866d':p.sources.includes('osm')?'#3376a3':'#d08535';
    const marker=L.circleMarker([p.lat,p.lon],{radius:4,color,fillColor:color,fillOpacity:.8,weight:1});
    marker.bindTooltip(safe(p.name)+' · '+p.sources.map(x=>labels[x]).join(' / '));
    marker.on('click',()=>showDetails(p.id,false));
    marker.addTo(markers);
  }
  if(focus)showDetails(focus.id,false);
}
function csv(rows){
 return '\ufeff'+rows.map(row=>row.map(x=>'"'+String(x??'').replace(/"/g,'""')+'"').join(';')).join('\r\n')+'\r\n';
}
function exportRows(){
 const header=['id','nom','adresse','code_postal','departement','latitude','longitude','precision_geographique','sources',
   'qualite_presumee','statut_local','type_constate_local','notes_controle_local','reference_locale','date_du_controle_local','source_urls','statut_source'];
 const content=csv([header,...filtered.map(p=>[
  p.id,p.name,p.address,p.postcode,p.dept,p.lat??'',p.lon??'',p.geocoded_by_ban?'Adresse IGN/BAN (non vérifiée)':'Annuaire ou OSM',p.sources.join('+'),
  p.quality,getStatus(p),reviews[p.id]?.type||'',reviews[p.id]?.note||'',reviews[p.id]?.evidence||'',reviews[p.id]?.date||'',p.source_refs.map(x=>x.url).join(' | '),'Non vérifié par les annuaires'
 ])]);
 const blob=new Blob([content],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download='recensement-laveries-pistes-a-verifier.csv';a.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function paintAudit(){
 if(!audit)return;
 const failures=audit.failed_pages||[];
 const counts=doc.counts||{};
 $('audit-body').innerHTML='<p><strong>Traitement du '+safe(String(doc.generated_at||'').slice(0,10))+'</strong> · '+fr(audit.pages_examined?.ouvert||0)
   +' pages Laverie Ouvert et '+fr(audit.pages_examined?.baug||0)+' pages BAUG interrogées.</p>'
   +'<p>'+fr(failures.length)+' pages non récupérées ou refusées. '+(failures.length?'La collecte reste incomplète pour les pages concernées.':'Pas d’échec déclaré par le collecteur.')+'</p>'
   +'<p class="sub">BAUG : '+fr(audit.source_counts?.baug)+' fiches consultables sur '+fr(Object.values(audit.annuaire_claimed_by_department?.baug||{}).reduce((a,b)=>a+b,0))+' annoncées sur les pages départementales. La page Paris est limitée à 100 résultats : ce n’est pas un inventaire BAUG exhaustif.</p>'
   +'<div class="tablewrap"><table><thead><tr><th>Département</th><th>OSM</th><th>Laverie Ouvert</th><th>BAUG accessibles</th><th>Candidats distincts*</th><th>Géolocalisés</th></tr></thead><tbody>'
   +['75','92','93','94'].map(d=>'<tr><td>'+d+'</td><td>'+fr(audit.source_entries_by_department?.osm?.[d]??counts[d]?.osm)+'</td><td>'+fr(audit.source_entries_by_department?.ouvert?.[d]??counts[d]?.ouvert)+'</td><td>'+fr(audit.source_entries_by_department?.baug?.[d]??counts[d]?.baug)+'</td><td><b>'+fr(counts[d]?.distinct_candidates)+'</b></td><td>'+fr(counts[d]?.geolocated)+'</td></tr>').join('')
   +'</tbody></table></div>'
   +'<p class="sub">* Candidats après rapprochement prudent, incluant des doublons possibles. Le nombre réel de laveries automatiques ouvertes reste inconnu. Certaines pages BAUG affichent une liste tronquée et peuvent ne pas avoir toutes été récupérées.</p>'
   +(failures.length?'<details><summary>Consulter les pages en échec</summary>'+failures.slice(0,30).map(x=>'<p class="sub">'+safe(x.page)+' : '+safe(x.reason)+'</p>').join('')+'</details>':'');
}
async function start(){
 try{
  const [a,b,g,priorities]=await Promise.all([
    fetch('./data/annuaire-croise.json',{cache:'no-store'}),
    fetch('./data/annuaire-croise-audit.json',{cache:'no-store'}),
    fetch('./data/geocoded-addresses.json',{cache:'no-store'}).catch(()=>null),
    fetch('./data/verification-prioritaire.json',{cache:'no-store'}).catch(()=>null)
  ]);
  if(!a.ok||!b.ok)throw Error('Données croisées non encore publiées : '+a.status+' / '+b.status);
  [doc,audit]=await Promise.all([a.json(),b.json()]);
  rows=Array.isArray(doc.rows)?doc.rows:[];
  let added=0;
  if(g?.ok){
    const geoDoc=await g.json();
    // Discard geocoding belonging to an older directory snapshot.
    if(geoDoc.directory_generated_at===doc.generated_at&&geoDoc.address_only_not_business_verification===true){
      const matched=new Map((geoDoc.rows||[]).map(x=>[x.id,x]));
      rows=rows.map(x=>{
        const y=matched.get(x.id);
        if(!y||x.lat!==null||y.precision!=='BAN_housenumber_address_not_business')return x;
        added++;
        return {...x,lat:y.lat,lon:y.lon,geocoded_by_ban:true,geocoding_score:y.score};
      });
    }
  }
  if(priorities?.ok){
    priorityDoc=await priorities.json();
    if(priorityDoc.directory_generated_at===doc.generated_at){
      priorityMap=new Map((priorityDoc.rows||[]).map(p=>[p.id,p]));
      const levels=['A','B','C'].map(level=>level+': '+fr([...priorityMap.values()].filter(p=>String(p.priority).startsWith(level)).length));
      $('review-queue-summary').textContent=fr(priorityMap.size)+' fiches dans la liste de contrôle priorisée, niveaux '+levels.join(' · ')+'. Priorité = charge de vérification, pas probabilité d’existence.';
    }
  }
  if(!priorityMap.size)$('review-queue-summary').textContent='Liste prioritaire indisponible ou plus ancienne que l’annuaire : aucun ordre de contrôle inventé.';
  $('count-ban').textContent=fr(added);
  if(rows.length<900)throw Error('Inventaire croisé insuffisant : aucun total présenté');
  $('count-osm').textContent=fr(doc.sources?.osm?.count);
  $('count-ouvert').textContent=fr(doc.sources?.ouvert?.count);
  $('count-baug').textContent=fr(doc.sources?.baug?.count);
  $('count-total').textContent=fr(doc.total_candidates);
  $('count-geo').textContent=fr(rows.filter(x=>x.lat!==null).length);
  $('loading').textContent='Recoupement disponible, dont '+fr(added)+' adresse(s) IGN/BAN ajoutée(s). Aucune fiche ne devient un commerce confirmé par géocodage.';
  paintAudit();render();
 }catch(e){
  $('loading').textContent='Recoupement indisponible : '+e.message+'. L’inventaire OSM initial reste consultable sur la carte principale.';
  $('summary').textContent='Aucun chiffre consolidé ne peut être confirmé tant que les fichiers ne sont pas publiés.';
 }
}
for(const id of ['dept','search','source','quality','geo','status','priority','sort','limit'])
 $(id).addEventListener(id==='search'?'input':'change',render);
$('export').onclick=exportRows;
$('export-backup').onclick=()=>{
 const payload={schema:'laveries-verifications-locales-v1',exported_at:new Date().toISOString(),reviews};
 const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='mes-controles-laveries.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 $('backup-status').textContent='Mes contrôles locaux sont exportés. Conservez ce fichier en lieu sûr.';
};
$('restore-backup').onchange=async e=>{
 const file=e.target.files?.[0];if(!file)return;
 try{
  if(file.size>2_000_000)throw Error('Fichier trop volumineux');
  const data=JSON.parse(await file.text());
  if(data.schema!=='laveries-verifications-locales-v1'||!data.reviews||typeof data.reviews!=='object'||Array.isArray(data.reviews))throw Error('Format de sauvegarde inconnu');
  const permitted=new Set(['pending','google_seen','confirmed','excluded']);
  const known=new Set(rows.map(r=>r.id));
  let imported=0;
  for(const [id,v] of Object.entries(data.reviews)){
    if(!known.has(id)||!v||!permitted.has(v.status))continue;
    reviews[id]={status:v.status,type:String(v.type||'').slice(0,40),note:String(v.note||'').slice(0,800),evidence:String(v.evidence||'').slice(0,350),date:String(v.date||'').slice(0,40)};
    imported++;
  }
  localStorage.setItem(statusKey,JSON.stringify(reviews));
  $('backup-status').textContent=fr(imported)+' vérifications locales restaurées depuis le fichier JSON.';
  render();
 }catch(error){$('backup-status').textContent='Restauration refusée : '+error.message}
 e.target.value='';
};
$('only-new').onclick=()=>{$('source').value='nonosm';render()};
$('reset').onclick=()=>{
 for(const id of ['dept','search','source','quality','geo','status','priority'])$(id).value='';
 $('sort').value='priority';$('limit').value='100';render();
};
start();
})();
