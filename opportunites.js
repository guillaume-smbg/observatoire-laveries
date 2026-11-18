/* Independent, source-labelled investment area explorer. No account/analytics/backend. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = v => String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
  const fr = (v,dec=0) => Number(v||0).toLocaleString('fr-FR',{maximumFractionDigits:dec});
  const eur = v => fr(Math.round(Number(v)||0))+' €';
  const number = id => Math.max(0,Number($(id).value)||0);
  const storageKey = 'laveries-opportunites-v2';
  const financeKey = 'laveries-opportunites-finance-v2';
  let opportunityDoc=null, iris=[], osmDoc=null, osm=[], directoryDoc=null, directory=[], addressDoc=null, selected=null, visible=[], markers=[], showRivals=false, selectedLayer=null, walkingLayer=null;
  let saved={};
  let map, rankedLayer, rivalsLayer;
  const FIELDS = ['price','variable','fixed','services','investment','debt','interest','years'];
  function getStore(key,fallback){try {return JSON.parse(localStorage.getItem(key)||'null')||fallback} catch(_){return fallback}}
  function putStore(key,obj){try{localStorage.setItem(key,JSON.stringify(obj))}catch(_){}}
  const backup=getStore(storageKey,{});
  if(backup&&typeof backup==='object'&&!Array.isArray(backup))saved=backup;
  function distance(a,b){
    const rad=Math.PI/180, dy=(a.lat-b.lat)*rad,dx=(a.lon-b.lon)*rad;
    return 12742000*Math.asin(Math.min(1,Math.sqrt(Math.sin(dy/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dx/2)**2)));
  }
  function googleLink(p){
    const generic=!p.name||p.name.toLowerCase().startsWith('laverie (nom absent)');
    const q=generic?'laverie automatique '+Number(p.lat).toFixed(6)+','+Number(p.lon).toFixed(6):p.name+' '+(p.address||'')+' France';
    return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(q);
  }
  function walkingDirections(origin,destination){
    return 'https://www.google.com/maps/dir/?api=1&origin='+
      encodeURIComponent(origin.lat+','+origin.lon)+'&destination='+
      encodeURIComponent(destination.lat+','+destination.lon)+'&travelmode=walking';
  }
  function csv(rows){
    return '\ufeff'+rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(';')).join('\r\n')+'\r\n';
  }
  function download(name,text){
    const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');
    a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),900);
  }
  async function get(path){
    const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw Error(path+' : HTTP '+r.status);return r.json();
  }
  function radius(){return $('radius').value}
  function keyEvidence(){return $('evidence').value}
  function filteredCandidate(p,mode){
    if(mode==='all')return true;
    if(mode==='explicit')return p.quality==='self_service_tagged';
    if(mode==='plausible')return ['self_service_tagged','possibly_automatic'].includes(p.quality);
    if(mode==='dir_all')return true;
    const plausible=!['probably_not_automatic','possibly_nonautomatic','uncertain_type','unclassified'].includes(p.quality);
    if(mode==='dir_plausible')return plausible;
    if(mode==='dir_multi')return plausible && Array.isArray(p.sources)&&p.sources.length>=2;
    return false;
  }
  function isDirectoryMode(mode=keyEvidence()){return mode.startsWith('dir_')}
  function reviewedExclusions(){
    if(!$('exclude-local').checked)return [];
    let status={};try{status=JSON.parse(localStorage.getItem('laveries-croisement-verifications-v1')||'{}')||{}}catch(_){}
    return directory.filter(p=>status[p.id]?.status==='excluded'&&p.lat!==null);
  }
  function countCandidates(p,mode=keyEvidence()){
    const c=p.catchments?.[radius()];
    if(!c)return 0;
    const base=isDirectoryMode(mode)?c.directory?.[mode.slice(4)]:c.osm?.[mode];
    if(!Number.isFinite(Number(base)))return null;
    if(!isDirectoryMode(mode)||!$('exclude-local').checked)return Number(base);
    const r=Number(radius()),removals=reviewedExclusions().filter(c=>filteredCandidate(c,mode)&&distance(p,c)<=r).length;
    return Math.max(0,Number(base)-removals);
  }
  function indexFor(p,mode=keyEvidence()){
    const d=p.catchments?.[radius()];
    if(!d||d.coverage<Math.max(.80,Number($('coverage').value))||
      d.small_pct===null||d.renters_pct===null||!Number.isFinite(d.homes))return null;
    const competitors=countCandidates(p,mode);
    if(competitors===null)return null;
    const proportion=Math.min(100,(d.homes/(p90s[radius()]||1))*100);
    const lessCrowded=Math.max(0,100-16*competitors);
    return Math.round((.38*proportion+.25*d.small_pct+.22*d.renters_pct+.15*lessCrowded)*10)/10;
  }
  function sensitivity(p){
    const cases=['dir_multi','dir_plausible','dir_all'].map(k=>indexFor(p,k)).filter(x=>x!==null);
    if(cases.length<3)return '';
    return 'Sensibilité concurrence annuaires : '+fr(Math.min(...cases),1)+' à '+fr(Math.max(...cases),1)+'/100, selon les inclusions de fiches non vérifiées.';
  }
  function confidence(p){
    const c=p.catchments?.[radius()];
    return c?c.coverage:0;
  }
  let p90s={};
  function estimateScore(p){return indexFor(p,keyEvidence())}
  function pr90(values){
    const v=values.filter(Number.isFinite).sort((a,b)=>a-b);
    return Math.max(1,v[Math.round(.9*(v.length-1))]||1);
  }
  function getRows(){
    const dep=$('dept').value;
    const q=$('search').value.toLocaleLowerCase('fr').trim();
    const minSmall=Number($('small-share').value);
    const out=[];
    for(const p of iris){
      const d=p.catchments?.[radius()];
      if(!d||(dep&&p.department!==dep)||d.small_pct===null||d.small_pct<minSmall)continue;
      if(q&&![p.commune,p.name,p.id].some(x=>String(x||'').toLocaleLowerCase('fr').includes(q)))continue;
      const score=estimateScore(p);
      if(score===null)continue;
      out.push({...p,score,catchment:d});
    }
    const mode=$('sort').value;
    out.sort((a,b)=>{
      if(mode==='housing')return b.catchment.homes-a.catchment.homes;
      if(mode==='small')return b.catchment.small_pct-a.catchment.small_pct;
      if(mode==='renters')return b.catchment.renters_pct-a.catchment.renters_pct;
      if(mode==='few')return countCandidates(a)-countCandidates(b)||b.score-a.score;
      return b.score-a.score;
    });
    return out;
  }
  function distinct(rows,limit=50){
    const min=Number($('dedupe').value),chosen=[];
    for(const p of rows){
      if(!min||chosen.every(c=>distance(c,p)>=min))chosen.push(p);
      if(chosen.length>=limit)break;
    }
    return chosen;
  }
  function scoreColor(v){return v>=80?'#0d7963':v>=65?'#287ca6':v>=50?'#cc8c2e':'#9c6a78'}
  function renderRanking(){
    if(!iris.length){$('top-rows').innerHTML='<tr><td colspan="7">Les données géographiques ne sont pas disponibles.</td></tr>';return}
    const all=getRows(),top=distinct(all,50);visible=all;
    $('k-iris').textContent=fr(iris.length);
    $('k-scores').textContent=fr(all.length);
    $('k-saved').textContent=fr(Object.keys(saved).length);
    $('k-osm').textContent=fr(osm.length);
    $('k-directory').textContent=directory.length?fr(directoryDoc.rows.length):'—';
    $('rank-note').textContent=fr(all.length)+' IRIS répondant aux critères, '+fr(top.length)+' secteurs distincts affichés. Rayon : '+radius()+' m. '+$('evidence').selectedOptions[0].textContent+'. Ces comptages ne sont pas des commerces vérifiés.';
    $('list-subtitle').textContent='50 secteurs au maximum · sélection par indice expérimental et espacement géographique · pas un classement des locaux disponibles.';
    $('top-rows').innerHTML=top.map((p,i)=>{
      const c=p.catchment;
      return '<tr><td><button type="button" class="tiny" data-focus="'+esc(p.id)+'">'+(i+1)+'. '+esc(p.commune)+'</button><small>'+esc(p.name)+' · IRIS '+esc(p.id)+'</small></td>'
        +'<td><strong>'+fr(p.score,1)+'/100</strong></td><td>'+fr(c.population)+'</td>'
        +'<td>'+fr(c.small_pct,1)+' %</td><td>'+fr(c.renters_pct,1)+' %</td>'
        +'<td>'+fr(countCandidates(p))+'</td><td><button class="tiny secondary" data-save="'+esc(p.id)+'">Comparer</button></td></tr>';
    }).join('')||'<tr><td colspan="7">Aucune zone conforme aux critères. Élargissez les filtres.</td></tr>';
    document.querySelectorAll('[data-focus]').forEach(b=>b.addEventListener('click',()=>select(b.dataset.focus)));
    document.querySelectorAll('[data-save]').forEach(b=>b.addEventListener('click',()=>save(b.dataset.save)));
    if(rankedLayer){
      rankedLayer.clearLayers();
      for(const p of top){
        const marker=L.circleMarker([p.lat,p.lon],{radius:7,color:scoreColor(p.score),fillColor:scoreColor(p.score),fillOpacity:.83,weight:1.4})
          .bindTooltip(esc(p.commune)+' · '+esc(p.name)+' · indice '+fr(p.score,1)+'/100');
        marker.on('click',()=>select(p.id));
        marker.addTo(rankedLayer);
      }
    }
    if(selected)select(selected.id,false);
    renderComparison();
  }
  function nearest(p){
    if(!iris.length)return null;
    let best,dist=Infinity;
    for(const q of iris){const v=distance(p,q);if(v<dist){best=q;dist=v}}
    return dist<=700?best:null;
  }
  function renderRivals(p){
    const r=Number(radius());
    const within=osm.map(x=>({...x,dist:distance(p,x)})).filter(x=>x.dist<=r).sort((a,b)=>a.dist-b.dist);
    const filtered=within.filter(x=>keyEvidence()==='all'||(keyEvidence()==='explicit'
      ?x.quality==='self_service_tagged':['self_service_tagged','possibly_automatic'].includes(x.quality)));
    $('compete-list').innerHTML='<p><strong>'+filtered.length+' points OSM</strong> à '+r+' m, selon le filtre choisi. Non vérifiés, certains peuvent être des pressings.</p>'
      +(filtered.length?'<div>'+filtered.slice(0,12).map(x=>
        '<p><a href="'+esc(googleLink(x))+'" target="_blank" rel="noopener noreferrer">'+esc(x.name||'Laverie sans nom')+'</a>'
        +'<small> · '+Math.round(x.dist)+' m · '+esc(x.quality||'non classé')+' · <a href="'+esc(walkingDirections(p,x))+'" target="_blank" rel="noopener noreferrer">itinéraire à pied ↗</a></small></p>').join('')+'</div>':'<p>Aucun point OSM renseigné dans ce rayon. Ne signifie pas absence réelle de concurrent.</p>');
  }
  function select(id,pan=true){
    const p=iris.find(x=>x.id===id);if(!p)return;selected=p;
    const r=radius(),d=p.catchments[r],sc=estimateScore(p);
    $('save-place').disabled=false;
    $('save-place').textContent=saved[p.id]?'Déjà sauvegardé · retirer':'Ajouter à comparer';
    $('place-detail').innerHTML='<h3>'+esc(p.commune)+' — '+esc(p.name)+'</h3>'
      +'<p><strong>Indice indicatif : '+(sc===null?'non calculable':fr(sc,1)+'/100')+'</strong> · IRIS '+esc(p.id)+'</p>'
      +'<div class="detail-grid"><div><small>Habitants estimés</small><strong>'+fr(d.population)+'</strong></div>'
      +'<div><small>Résidences principales estimées</small><strong>'+fr(d.homes)+'</strong></div>'
      +'<div><small>Fiches candidates selon filtre</small><strong>'+fr(countCandidates(p))+'</strong></div>'
      +'<div><small>Part de petits logements</small><strong>'+(d.small_pct===null?'ND':fr(d.small_pct,1)+' %')+'</strong></div>'
      +'<div><small>Part de locataires</small><strong>'+(d.renters_pct===null?'ND':fr(d.renters_pct,1)+' %')+'</strong></div>'
      +'<div><small>Couverture IRIS du cercle</small><strong>'+fr(d.coverage*100,1)+' %</strong></div></div>'
      +'<p class="muted">'+esc(sensitivity(p))+'</p><p class="muted">Estimations par pondération surfacique des IRIS en '+r+' m, pas des habitants recensés exactement dans le cercle. Les fiches concurrentes ne sont pas des laveries confirmées. La zone représentée n’est pas un local disponible.</p>'
      +'<p><a href="https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(p.lat+','+p.lon)+'" target="_blank" rel="noopener noreferrer">Examiner le secteur sur Google Maps ↗</a></p>';
    renderRivals(p);
    if(selectedLayer)selectedLayer.clearLayers();
    selectedLayer=L.layerGroup().addTo(map);
    L.circle([p.lat,p.lon],{radius:Number(r),color:'#df8134',fillOpacity:.04,weight:1.5}).addTo(selectedLayer);
    L.circleMarker([p.lat,p.lon],{radius:10,color:'#d36226',weight:3,fillOpacity:.35}).addTo(selectedLayer);
    if(pan)map.setView([p.lat,p.lon],14);
  }
  function save(id){
    if(saved[id]){delete saved[id];putStore(storageKey,saved);select(id,false);renderComparison();return}
    if(Object.keys(saved).length>=6){$('loading').textContent='La comparaison est limitée à 6 zones ; retirez-en une avant d’en ajouter une autre.';return}
    saved[id]={rent:2000,cycles:35};
    putStore(storageKey,saved);
    select(id,false);renderComparison();
  }
  function loan(){
    const p=number('investment')*Math.min(100,number('debt'))/100;
    const years=Math.max(1,number('years'));
    const r=number('interest')/1200,n=years*12;
    return r?p*r/(1-(1+r)**(-n)):p/n;
  }
  function finance(p){
    const v=saved[p.id]||{rent:2000,cycles:35};
    const price=number('price'),variable=number('variable'),monthly=30.4375,cycles=Math.max(0,Number(v.cycles)||0),rent=Math.max(0,Number(v.rent)||0);
    const service=number('services'),fixed=number('fixed'),debtService=loan(),margin=price-variable;
    const ca=cycles*monthly*price;
    const cash=cycles*monthly*margin+service-fixed-rent-debtService;
    const cashPrudent=cycles*.65*monthly*margin+service-fixed-rent-debtService;
    const cashDynamic=cycles*1.35*monthly*margin+service-fixed-rent-debtService;
    const breakEven=margin>0?Math.max(0,(fixed+rent+debtService-service)/(margin*monthly)):null;
    return {ca,cash,cashPrudent,cashDynamic,breakEven,rent,cycles};
  }
  function renderComparison(){
    $('k-saved').textContent=Object.keys(saved).length;
    const savedRows=Object.keys(saved).map(id=>iris.find(p=>p.id===id)).filter(Boolean);
    $('comparison-rows').innerHTML=savedRows.map(p=>{
      const f=finance(p),c=p.catchments[radius()];
      return '<tr><td><strong>'+esc(p.commune)+'</strong><small>'+esc(p.name)+' · '+c.osm[keyEvidence()]+' points OSM à '+radius()+' m · couverture '+fr(c.coverage*100)+' %</small></td>'
        +'<td><label><span class="hide-print">Loyer HT (€)</span><input type="number" min="0" step="50" data-rent="'+esc(p.id)+'" value="'+f.rent+'"></label><span class="print-value">'+eur(f.rent)+'</span></td>'
        +'<td><label><span class="hide-print">Cycles/jour</span><input type="number" min="0" step="1" data-cycles="'+esc(p.id)+'" value="'+f.cycles+'"></label><span class="print-value">'+fr(f.cycles)+'</span></td>'
        +'<td>'+eur(f.ca)+'</td>'
        +'<td>'+eur(f.cashPrudent)+'</td><td><strong style="color:'+(f.cash<0?'#a33b3b':'#0a6e59')+'">'+eur(f.cash)+'</strong></td><td>'+eur(f.cashDynamic)+'</td>'
        +'<td>'+(f.breakEven===null?'non atteignable':fr(f.breakEven,1))+'</td>'
        +'<td class="hide-print"><button class="tiny secondary" data-remove="'+esc(p.id)+'">Retirer</button></td></tr>';
    }).join('')||'<tr><td colspan="9">Aucune zone sauvegardée. Cliquez sur « Comparer » dans le classement.</td></tr>';
    document.querySelectorAll('[data-rent]').forEach(x=>x.addEventListener('change',()=>updateSite(x.dataset.rent,'rent',x.value)));
    document.querySelectorAll('[data-cycles]').forEach(x=>x.addEventListener('change',()=>updateSite(x.dataset.cycles,'cycles',x.value)));
    document.querySelectorAll('[data-remove]').forEach(x=>x.addEventListener('click',()=>save(x.dataset.remove)));
  }
  function updateSite(id,key,val){
    if(!saved[id])return;
    saved[id][key]=Math.max(0,Number(val)||0);
    putStore(storageKey,saved);
    renderComparison();
  }
  function exportRanking(){
    const rows=[['IRIS','commune','quartier','departement','latitude','longitude','rayon_m',
      'population_estimee','residences_principales_estimees','petits_logements_pct','locataires_pct',
      'couverture_pct','concurrents_candidats_selon_filtre','filtre_sources','indice_heuristique','donnees_insee','donnees_osm','limites']];
    for(const p of visible){
      const d=p.catchment;
      rows.push([p.id,p.commune,p.name,p.department,p.lat,p.lon,radius(),d.population,d.homes,d.small_pct,d.renters_pct,
        Math.round(d.coverage*100),countCandidates(p),keyEvidence(),p.score,opportunityDoc.insee_generated_at,
        opportunityDoc.osm_generated_at,'Estimations surfaciques, rayon a vol d oiseau, annuaires et OSM non verifies, score non valide']);
    }
    download('classement-opportunites-exploratoires.csv',csv(rows));
  }
  function exportComparison(){
    const rows=[['IRIS','commune','quartier','rayon_m','population_estimee','logements_estimes','part_petits_pct',
      'locataires_pct','fiches_candidates_non_verifiees','loyer_hc_ht_mensuel','cycles_jour_hypothese','ca_lavage_ht_mensuel',
      'cash_prudent_apres_pret','cash_central_apres_pret','cash_dynamique_apres_pret','seuil_cycles_jour','source','limites']];
    for(const id of Object.keys(saved)){
      const p=iris.find(x=>x.id===id);if(!p)continue;
      const d=p.catchments[radius()],f=finance(p);
      rows.push([p.id,p.commune,p.name,radius(),d.population,d.homes,d.small_pct,d.renters_pct,
        countCandidates(p),f.rent,f.cycles,Math.round(f.ca),Math.round(f.cashPrudent),Math.round(f.cash),Math.round(f.cashDynamic),f.breakEven?.toFixed(1)??'',
        opportunityDoc.source,'Hypothese de frequentation manuelle, IRIS repartition uniforme, OSM non verifie']);
    }
    download('comparatif-emplacements-laveries.csv',csv(rows));
  }
  function restoreFinance(){
    const config=getStore(financeKey,null);if(config&&typeof config==='object'){
      for(const id of FIELDS)if(Number.isFinite(Number(config[id])))$(id).value=config[id];
    }
  }
  function saveFinance(){
    const settings={};for(const id of FIELDS)settings[id]=number(id);
    putStore(financeKey,settings);renderComparison();
  }
  function toggleOSM(){
    showRivals=!showRivals;rivalsLayer.clearLayers();
    if(!showRivals)return;
    for(const p of osm){
      const col=p.quality==='self_service_tagged'?'#217a55':p.quality==='probably_not_automatic'?'#d48b32':'#7b8793';
      L.circleMarker([p.lat,p.lon],{radius:3,color:col,fillOpacity:.8,weight:.5})
        .bindPopup('<strong>'+esc(p.name)+'</strong><p><a href="'+esc(googleLink(p))+'" target="_blank" rel="noopener noreferrer">Rechercher sur Google Maps</a></p><small>Source OSM non vérifiée.</small>')
        .addTo(rivalsLayer);
    }
  }
  function reset(){
    $('dept').value='';$('search').value='';$('radius').value='500';$('evidence').value='dir_multi';
    $('small-share').value='0';$('coverage').value='.8';$('sort').value='score';$('dedupe').value='650';
    renderRanking();
  }
  function wire(){
    for(const id of ['dept','search','radius','evidence','small-share','coverage','sort','dedupe','exclude-local']){
      $(id).addEventListener(id==='search'?'input':'change',renderRanking);
    }
    for(const id of FIELDS)$(id).addEventListener('change',saveFinance);
    $('save-place').onclick=()=>selected&&save(selected.id);
    $('download-csv').onclick=exportRanking;
    $('export-comparison').onclick=exportComparison;
    $('show-competitors').onclick=toggleOSM;
    $('reset-filters').onclick=reset;
    $('clear-comparison').onclick=()=>{
      if(!Object.keys(saved).length)return;
      if(!window.confirm('Vider les emplacements enregistrés dans ce navigateur ?'))return;
      saved={};putStore(storageKey,saved);renderComparison();
      if(selected)select(selected.id,false);
    };
    $('print-report').onclick=()=>window.print();
    $('print-comparison').onclick=()=>window.print();
    map.on('click',ev=>{
      const p=nearest(ev.latlng);
      if(p)select(p.id);
      else $('loading').textContent='Aucun point IRIS représentatif suffisamment proche du clic.';
    });
  }
  function initializeMap(){
    map=L.map('map').setView([48.855,2.35],11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
      maxZoom:18,attribution:'© contributeurs OpenStreetMap'
    }).addTo(map);
    rankedLayer=L.layerGroup().addTo(map);
    rivalsLayer=L.layerGroup().addTo(map);
  }
  async function start(){
    initializeMap();restoreFinance();wire();
    const [a,b]=await Promise.allSettled([get('./data/opportunities.json'),get('./data/laveries-osm.json')]);
    if(a.status!=='fulfilled')throw Error('Les statistiques de proximité ne sont pas encore disponibles : '+a.reason.message);
    opportunityDoc=a.value;iris=Array.isArray(opportunityDoc.rows)?opportunityDoc.rows:[];
    if(iris.length<2000)throw Error('Données IRIS incomplètes, classement suspendu.');
    for(const r of ['300','500','1000'])
      p90s[r]=pr90(iris.map(p=>p.catchments?.[r]?.homes).filter(Number.isFinite));
    if(b.status==='fulfilled'){
      osmDoc=b.value;osm=Array.isArray(osmDoc.rows)?osmDoc.rows:[];
    }
    $('source-dates').textContent='INSEE / IRIS : '+String(opportunityDoc.insee_generated_at||'inconnue').slice(0,10)
      +' · extraction OSM de calcul : '+String(opportunityDoc.osm_generated_at||'inconnue').slice(0,10)
      +' · annuaires croisés : '+String(opportunityDoc.directory_generated_at||'inconnue').slice(0,10)
      +' · génération des rayons : '+String(opportunityDoc.generated_at||'inconnue').slice(0,10)
      +(osmDoc&&osmDoc.generated_at!==opportunityDoc.osm_generated_at?' · ATTENTION : le fichier OSM a été actualisé après la génération des calculs ; rafraîchir les opportunités.':'');
    $('loading').textContent='Données chargées : '+fr(iris.length)+' quartiers IRIS, rayons 300/500/1000 m et '+fr(osm.length)+' points OSM non vérifiés.';
    renderRanking();
  }
  start().catch(error=>{
    $('loading').textContent='Données ou carte indisponibles : '+error.message+'. Consultez la carte principale pendant la mise à jour.';
    $('rank-note').textContent='Aucun classement de remplacement n’est inventé.';
  });
})();
