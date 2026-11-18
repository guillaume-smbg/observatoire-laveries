/* Evidence-led dashboard: input datasets are explicitly labelled, never fabricated. */
(() => {
  'use strict';
  const E = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const nfr = value => Number(value).toLocaleString('fr-FR',{maximumFractionDigits:0});
  const pct = value => value == null || !Number.isFinite(Number(value)) ? 'ND' : Number(value).toLocaleString('fr-FR',{maximumFractionDigits:1})+' %';
  let iris=[], osm=null, meta=null, markers=null, reviewed={};
  try { reviewed=JSON.parse(localStorage.getItem('observatoire-laveries-reviews-v1') || '{}') } catch(_){}
  const km = (a,b) => {
    const r=Math.PI/180, dy=(a.lat-b.lat)*r, dx=(a.lon-b.lon)*r;
    return 12742*Math.asin(Math.min(1,Math.sqrt(Math.sin(dy/2)**2 + Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dx/2)**2)));
  };
  const validPoint = p => p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lon)) &&
    Number(p.lat)>=48.4 && Number(p.lat)<=49.3 && Number(p.lon)>=1.7 && Number(p.lon)<=3;
  const json = async path => { const r=await fetch(path,{cache:'no-store'}); if(!r.ok)throw Error('HTTP '+r.status); return r.json() };
  const setState = text => { E('observatory-state').textContent=text };
  const download = (name,body) => {
    const blob=new Blob(['\ufeff'+body],{type:'text/csv;charset=utf-8'}), url=URL.createObjectURL(blob), a=document.createElement('a');
    a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const csv = rows => rows.map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(';')).join('\r\n');
  const weight = id => Number(E(id).value)||0;
  function competition(pt) {
    if(!osm)return null;
    const match=osm.filter(p=>p.dep===pt.dep);
    const dist=match.map(p=>km(pt,p));
    return {c300:dist.filter(d=>d<=.3).length,c500:dist.filter(d=>d<=.5).length,c1000:dist.filter(d=>d<=1).length};
  }
  function canScore(row) {
    return !!osm && !(meta?.failed_departments||[]).includes(row.dep) &&
      Number.isFinite(row.population) && Number.isFinite(row.homes) &&
      Number.isFinite(row.small_pct) && Number.isFinite(row.renters_pct);
  }
  function enriched() {
    const maxHomes=Math.max(1,...iris.map(r=>r.homes||0)),w=[weight('w-households'),weight('w-small'),weight('w-renters'),weight('w-competition')];
    const sum=w.reduce((a,b)=>a+b,0)||1;
    return iris.map(row=>{
      const c=competition(row),scorable=canScore(row),radius=Number(E('rank-radius').value);
      const n=c?c['c'+radius]:null;
      // Heuristic, not a measured business probability. Zero OSM hits does NOT mean zero real rivals.
      const attraction=Math.min(100,100*(row.homes||0)/maxHomes),small=row.small_pct||0,rent=row.renters_pct||0;
      const density=n==null?null:Math.max(0,100-20*n);
      const score=scorable?Math.max(0,Math.min(100,(attraction*w[0]+small*w[1]+rent*w[2]+density*w[3])/sum)):null;
      return {...row,...c,score:score===null?null:Math.round(score*10)/10};
    });
  }
  let visible=[];
  function display() {
    const dep=E('rank-dep').value,query=E('rank-search').value.toLocaleLowerCase('fr'),sort=E('rank-sort').value;
    const all=enriched();
    visible=all.filter(r=> (!dep||r.dep===dep) && (!query||[r.name,r.commune,r.id].some(x=>String(x||'').toLocaleLowerCase('fr').includes(query))) && (r.population||0)>0);
    visible.sort((a,b)=>{
      if(sort==='population')return (b.population||0)-(a.population||0);
      if(sort==='small')return (b.small_pct||0)-(a.small_pct||0);
      if(sort==='renters')return (b.renters_pct||0)-(a.renters_pct||0);
      if(sort==='competition')return (a['c'+E('rank-radius').value]??Infinity)-(b['c'+E('rank-radius').value]??Infinity);
      return (b.score??-1)-(a.score??-1);
    });
    const scores=visible.filter(r=>r.score!==null).length;
    E('rank-summary').textContent=iris.length
      ? nfr(visible.length)+' IRIS correspondant aux filtres · '+nfr(scores)+' indices calculables. '
      +'Indice exploratoire, PAS une prévision de CA. Les points OSM ne sont pas des concurrents vérifiés.'
      : 'Données INSEE IRIS absentes : aucun classement publié.';
    const top=visible.slice(0,100);
    E('rank-body').innerHTML=top.map((r,i)=>
      '<tr><td><button class="tiny" data-iris="'+escapeHtml(r.id)+'" type="button">'+escapeHtml(r.commune||r.name||r.id)+'</button>'
      +'<small>'+escapeHtml(r.name||'')+' · '+escapeHtml(r.id)+'</small></td>'
      +'<td>'+nfr(r.population)+'</td><td>'+nfr(r.homes)+'</td><td>'+pct(r.small_pct)+'</td>'
      +'<td>'+pct(r.renters_pct)+'</td><td>'+(r.score===null?'ND':r['c'+E('rank-radius').value])+'</td>'
      +'<td>'+(r.score===null?'<span title="Données insuffisantes">ND</span>':'<b>'+r.score.toLocaleString('fr-FR')+'/100</b>')+'</td></tr>').join('') ||
      '<tr><td colspan="7">Aucune ligne disponible. Essayez un autre filtre.</td></tr>';
    document.querySelectorAll('[data-iris]').forEach(b=>b.onclick=()=>{
      const r=iris.find(x=>x.id===b.dataset.iris);if(!r)return;
      map.setView([r.lat,r.lon],15);E('iris-focus').innerHTML=
      '<strong>'+escapeHtml(r.commune)+' — '+escapeHtml(r.name)+'</strong>'
      +'<p>Population IRIS (INSEE 2022) : '+nfr(r.population)+' · résidences principales : '+nfr(r.homes)
      +' · logements de moins de 40 m² : '+pct(r.small_pct)+' · locataires : '+pct(r.renters_pct)+'</p>'
      +'<p>Point cartographique représentatif de la zone IRIS, <strong>pas</strong> une adresse commerciale.</p>';
      if(markers)L.circleMarker([r.lat,r.lon],{radius:11,color:'#ee7500',weight:3,fillOpacity:.1}).addTo(markers);
      if(typeof candidate!=='undefined'){candidate={lat:r.lat,lon:r.lon};if(typeof renderSite==='function')renderSite()}
    });
    if(markers)markers.clearLayers();else markers=L.layerGroup().addTo(map);
    if(E('rank-show-markers').checked)top.slice(0,100).forEach((r,i)=>{
      L.circleMarker([r.lat,r.lon],{radius:5,weight:1,color:'#ad5818',fillColor:'#f7ad42',fillOpacity:.65})
        .bindTooltip(escapeHtml(r.name)+' · '+(r.score===null?'score ND':'indice '+r.score+'/100')).addTo(markers);
    });
  }
  function saveReviews(){try{localStorage.setItem('observatoire-laveries-reviews-v1',JSON.stringify(reviewed))}catch(_){}}
  let inventoryRows=[];
  function inventory(){
    const query=E('osm-search').value.toLocaleLowerCase('fr'), dep=E('osm-dept').value,decision=E('osm-status').value;
    inventoryRows=(osm||[]).filter(r=>(!dep||r.dep===dep)&&(!query||[r.name,r.address,r.id].some(x=>String(x||'').toLocaleLowerCase('fr').includes(query)))&&(!decision||((reviewed[r.id]?.status)||'pending')===decision));
    const tabs=inventoryRows.slice(0,200);
    E('osm-inventory-summary').textContent=osm
      ? nfr(inventoryRows.length)+' établissements OSM parmi '+nfr(osm.length)+' recensés, visibles : '+Math.min(tabs.length,200)
        +'. La catégorie OSM peut inclure pressings et blanchisseries ; les contrôles manuels ne sont enregistrés que dans ce navigateur.'
      : 'Inventaire OSM statique non disponible : aucun établissement présenté comme recensé.';
    E('osm-inventory-body').innerHTML=tabs.map(r=>
      '<tr><td><button type="button" class="tiny" data-osm="'+escapeHtml(r.id)+'">'+escapeHtml(r.name)+'</button>'
      +'<small>'+escapeHtml(r.address||'Adresse non renseignée')+' · '+escapeHtml(r.id)+'</small></td>'
      +'<td>'+escapeHtml(r.dep)+'</td><td>'+escapeHtml(r.self_service||'Non précisé')+'</td>'
      +'<td><select aria-label="Statut de vérification locale" data-review="'+escapeHtml(r.id)+'">'
      +[['pending','À vérifier'],['confirmed','Contrôlé sur place'],['excluded','À exclure']].map(([v,l])=>
        '<option value="'+v+'"'+((reviewed[r.id]?.status||'pending')===v?' selected':'')+'>'+l+'</option>').join('')+'</select></td></tr>').join('')||
      '<tr><td colspan="4">Aucun établissement correspondant.</td></tr>';
    document.querySelectorAll('[data-osm]').forEach(b=>b.onclick=()=>{
      const r=osm.find(x=>x.id===b.dataset.osm);if(r)map.setView([r.lat,r.lon],17);
    });
    document.querySelectorAll('[data-review]').forEach(select=>select.onchange=()=>{
      reviewed[select.dataset.review]={status:select.value,date:new Date().toISOString()};saveReviews();
      E('osm-inventory-summary').textContent='Contrôle local enregistré dans ce navigateur. Exportez le CSV pour conserver une sauvegarde.';
    });
  }
  E('osm-export-reviews').onclick=()=>{
    if(!osm)return;
    download('observatoire-verifications-locales.csv',csv([
      ['osm_id','name','department','status_local','date_local','latitude','longitude','source'],
      ...osm.map(r=>[r.id,r.name,r.dep,reviewed[r.id]?.status||'pending',reviewed[r.id]?.date||'',r.lat,r.lon,'OSM non vérifié globalement'])
    ]));
  };
  E('rank-export').onclick=()=>{
    const rows=visible.map(r=>[r.id,r.commune,r.name,r.dep,r.lat,r.lon,r.population,r.homes,
      r.small_pct,r.renters_pct,r.c300??'',r.c500??'',r.c1000??'',r.score??'',meta?.generated_at||'',
      'INSEE RP 2022 / contours 2024; OSM non vérifié; indice exploratoire']);
    download('observatoire-iris-classement-exploratoire.csv',csv([
      ['iris','commune','name','dept','lat','lon','population_2022','residences_principales_2022',
      'moins_40m2_pct','locataires_pct','osm_300m','osm_500m','osm_1000m','indice_exploratoire','date_osm','limites'],...rows
    ]));
  };
  ['rank-dep','rank-search','rank-sort','rank-radius','rank-show-markers','w-households','w-small','w-renters','w-competition']
    .forEach(id=>E(id).addEventListener('input',display));
  ['osm-search','osm-dept','osm-status'].forEach(id=>E(id).addEventListener('input',inventory));
  map.on('click',()=>{
    const p=typeof selectedPoint!=='undefined'&&selectedPoint?selectedPoint:null;
    if(!p||!iris.length)return;
    const nearest=iris.map(r=>({r,dist:km({lat:p.lat,lon:p.lng},r)})).sort((a,b)=>a.dist-b.dist)[0];
    if(nearest)E('iris-focus').innerHTML='IRIS au point représentatif le plus proche : <strong>'+
      escapeHtml(nearest.r.commune)+' / '+escapeHtml(nearest.r.name)+'</strong> ('+
      Math.round(nearest.dist*1000)+' m). <strong>Attention :</strong> ce calcul ne prouve pas que le point appartient à cet IRIS.';
  });
  async function bootstrap(){
    setState('Chargement des sources…');
    const responses=await Promise.allSettled([json('./data/iris-2022.json'),json('./data/laveries-osm.json'),json('./data/refresh-status.json')]);
    if(responses[0].status==='fulfilled'){
      const payload=responses[0].value;
      iris=(Array.isArray(payload.rows)?payload.rows:[]).filter(validPoint).map(r=>({
        ...r, lat:Number(r.lat),lon:Number(r.lon),population:Number(r.population),
        homes:Number(r.homes),small_pct:r.small_pct==null?null:Number(r.small_pct),
        renters_pct:r.renters_pct==null?null:Number(r.renters_pct)
      }));
      E('iris-source').textContent=nfr(iris.length)+' IRIS INSEE RP 2022, géographie 2024 · chargement '+String(payload.generated_at||'inconnu').slice(0,10);
    } else {
      E('iris-source').textContent='Jeu IRIS absent ou inaccessible. Aucune valeur démographique inventée.';
    }
    if(responses[1].status==='fulfilled'){
      meta=responses[1].value;
      osm=(Array.isArray(meta.rows)?meta.rows:[]).filter(validPoint).map(p=>({...p,lat:Number(p.lat),lon:Number(p.lon)}));
      data=osm.map(p=>({...p,source:'OSM (non vérifié)'}));
      show();
      E('osm-source').textContent=nfr(osm.length)+' établissements OpenStreetMap non vérifiés · extraction '
        +String(meta.generated_at||'inconnue').slice(0,10)
        +(meta.failed_departments?.length?' · collecte incomplète : '+meta.failed_departments.join(', '):'');
      E('status').textContent='Inventaire OpenStreetMap sauvegardé au dernier rafraîchissement. Non exhaustif et non contrôlé ; certains établissements peuvent être des pressings.';
    } else E('osm-source').textContent='Inventaire OSM préchargé absent. Utilisez le bouton de collecte manuelle de la carte.';
    if(responses[2].status==='fulfilled'){
      const errors=responses[2].value.errors||{};
      if(Object.keys(errors).length)setState('Actualisation partielle : '+Object.entries(errors).map(([k,v])=>k+' : '+v).join(' / '));
      else setState('Sources publiques chargées sans erreur signalée par le dernier traitement.');
    } else setState('Le diagnostic de rafraîchissement n’est pas encore publié.');
    display();inventory();
  }
  bootstrap().catch(err=>setState('Erreur de chargement : '+err.message));
})();
