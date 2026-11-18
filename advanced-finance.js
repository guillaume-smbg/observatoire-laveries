/* Illustrative model only. All financial inputs are pre-tax (HT), no commercial market validation. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const get=id=>Math.max(0,Number($(id).value)||0);
  const money=v=>Math.round(v).toLocaleString('fr-FR')+' €';
  const pm=v=>Math.round(v).toLocaleString('fr-FR')+' €/mois';
  const escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const monthlyLoan=(p,annual,months)=>{
    if(!p||!months)return 0;
    const r=annual/1200;
    if(r===0)return p/months;
    return p*r/(1-(1+r)**(-months));
  };
  function inputs(){
    return {
      area:get('f-area'),rent:get('f-rent'),depositMonths:get('f-deposit'),
      worksBrut:get('f-works-brut'),worksShop:get('f-works-shop'),
      machineNew:get('f-machines-new'),machineUsed:get('f-machines-used'),
      machines:get('f-machines'),kiosk:get('f-kiosk'),video:get('f-video'),extra:get('f-extra'),
      design:get('f-design'),contingency:get('f-contingency')/100,
      equipment:$('f-equipment').value,local:$('f-local').value,
      debtShare:get('f-debt-share')/100,rate:get('f-rate'),loanYears:get('f-years'),
      cycles:get('f-cycles'),price:get('f-price'),water:get('f-water'),power:get('f-power'),detergent:get('f-detergent'),
      commission:get('f-payment-pct')/100,services:get('f-services'),
      maintenance:get('f-maintenance'),insurance:get('f-insurance'),internet:get('f-internet'),
      cleaning:get('f-cleaning'),standby:get('f-standby'),other:get('f-other'), labor:get('f-labor'),
      repairs:get('f-repairs')
    };
  }
  const totals=(v,local,equipment)=>{
    const works=local==='brut'?v.worksBrut:v.worksShop,machines=equipment==='new'?v.machineNew:v.machineUsed;
    const base=works+machines+v.kiosk+v.video+v.extra+v.design;
    const reserve=base*v.contingency,deposit=v.rent*v.depositMonths;
    return {works,machines,reserve,deposit,capex:base+reserve+deposit};
  };
  function model(){
    const v=inputs(),a=totals(v,v.local,v.equipment),debt=a.capex*v.debtShare,equity=a.capex-debt;
    const loan=monthlyLoan(debt,v.rate,v.loanYears*12);
    const fixed=v.rent+v.maintenance+v.insurance+v.internet+v.cleaning+v.standby+v.other+v.labor+v.repairs;
    const unitVar=v.water+v.power+v.detergent+v.price*v.commission;
    const unitMargin=v.price-unitVar;
    const serviceMargin=v.services; // already net of product purchase and specific variable costs
    const breakeven=unitMargin>0?Math.max(0,(fixed+loan-serviceMargin)/(unitMargin*30.4375)):null;
    const scen=[['Prudent',.65],['Central',1],['Dynamique',1.35]].map(([name,mult])=>{
      const cycles=v.cycles*mult,ca=cycles*30.4375*v.price,variable=cycles*30.4375*unitVar;
      const op=ca-variable+serviceMargin-fixed,afterDebt=op-loan;
      const perYear=afterDebt*12;
      return {name,cycles,ca,variable,op,afterDebt,perYear};
    });
    $('f-out-invest').textContent=money(a.capex);
    $('f-out-debt').textContent=money(debt);
    $('f-out-equity').textContent=money(equity);
    $('f-out-loan').textContent=pm(loan);
    $('f-out-threshold').textContent=breakeven===null?'Non calculable':breakeven.toLocaleString('fr-FR',{maximumFractionDigits:1})+' cycles/jour';
    $('f-out-margin').textContent=money(unitMargin)+' HT/cycle';
    $('f-out-fixed').textContent=pm(fixed);
    $('f-out-rentsqm').textContent=v.area>0?(v.rent/v.area).toLocaleString('fr-FR',{maximumFractionDigits:1})+' €/m²/mois':'ND';
    $('f-out-load').textContent=v.machines>0?(v.cycles/v.machines).toLocaleString('fr-FR',{maximumFractionDigits:1})+' cycles/machine/jour':'ND';
    $('f-out-invest-detail').textContent='Travaux '+money(a.works)+' + machines '+money(a.machines)
      +' + autres postes '+money(v.kiosk+v.video+v.extra+v.design)
      +' + provision aléas '+money(a.reserve)+' + dépôt de garantie immobilisé '+money(a.deposit)+'.';
    $('f-result-rows').innerHTML=scen.map(s=>{
      const cls=s.afterDebt<0?'class="negative"':'';
      return '<tr '+cls+'><td>'+s.name+'</td><td>'+s.cycles.toFixed(1).replace('.',',')+'</td>'
        +'<td>'+money(s.ca)+'</td><td>'+money(s.variable)+'</td><td>'+money(s.op)+'</td>'
        +'<td><strong>'+money(s.afterDebt)+'</strong></td><td>'+money(s.perYear)+'</td></tr>';
    }).join('');
    $('f-compare-rows').innerHTML=[
      ['Ancien commerce','Occasion','shop','used'],['Ancien commerce','Neuf','shop','new'],
      ['Brut de béton','Occasion','brut','used'],['Brut de béton','Neuf','brut','new']
    ].map(([l,e,loc,eq])=>{
      const v2=totals(v,loc,eq);
      return '<tr><td>'+escape(l)+'</td><td>'+escape(e)+'</td><td>'+money(v2.capex)+'</td>'
        +'<td>'+money(v2.capex*(1-v.debtShare))+'</td><td>'+pm(monthlyLoan(v2.capex*v.debtShare,v.rate,v.loanYears*12))+'</td></tr>';
    }).join('');
    const c=scen[1];const payback=c.afterDebt>0?equity/(12*c.afterDebt):null;
    $('f-warning').textContent=(unitMargin<=0?'Attention : marge unitaire nulle ou négative. ':'')
      +(breakeven!=null&&v.cycles<breakeven?'Le scénario central est sous le seuil de couverture des charges et remboursements. ':'')
      +'Délai théorique de retour sur fonds propres en scénario central : '
      +(payback!=null?payback.toLocaleString('fr-FR',{maximumFractionDigits:1})+' années':'non calculable')
      +'. Ce résultat ignore la fiscalité, les amortissements, les variations de trésorerie et la revente des machines.';
    return {inputs:v,investment:a,debt,equity,loan,fixed,unitVar,unitMargin,breakeven,scenarios:scen};
  }
  let latest;
  function refresh(){latest=model()}
  document.querySelectorAll('#financial-detailed input,#financial-detailed select').forEach(i=>i.addEventListener('input',refresh));
  $('f-export').onclick=()=>{
    if(!latest)return;
    const v=latest,rows=[['indicateur','valeur','unite','hypothese'],
      ['Investissement initial',v.investment.capex,'EUR HT et depot','estimation illustrative'],
      ['Dette',v.debt,'EUR','hypothese'],['Apport',v.equity,'EUR','hypothese'],
      ['Mensualite',v.loan,'EUR/mois','taux et duree modifies'],
      ['Charges fixes',v.fixed,'EUR/mois','hors financement'],
      ['Marge par cycle',v.unitMargin,'EUR HT','hors services'],
      ['Seuil cycles/jour',v.breakeven??'','cycles/jour','couvre charges et dette'],
      ...v.scenarios.map(s=>['Resultat cash '+s.name,s.afterDebt,'EUR/mois','avant impots, amortissements, remunerations et TVA'])];
    const csv='\ufeff'+rows.map(r=>r.map(c=>'"'+String(c??'').replace(/"/g,'""')+'"').join(';')).join('\r\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='previsionnel-laverie-hypotheses.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  $('f-copy').onclick=()=>{
    if(!latest)return;
    const x=latest,s=x.scenarios[1],txt='Observatoire des laveries — simulation illustrative HT\n'
      +'Investissement : '+money(x.investment.capex)+'\nDette : '+money(x.debt)
      +'\nApport : '+money(x.equity)+'\nMensualité : '+pm(x.loan)
      +'\nScénario central : '+money(s.ca)+' de CA /mois, '+money(s.afterDebt)
      +' de cash-flow avant impôts/amortissements/rémunération.\nInventaire OSM et données démographiques non validés comme chiffres de marché.';
    if(navigator.clipboard?.writeText)navigator.clipboard.writeText(txt).then(()=>$('f-copy-status').textContent='Synthèse copiée.').catch(()=>$('f-copy-status').textContent='Copie refusée par le navigateur.');
    else $('f-copy-status').textContent='Copie impossible dans ce navigateur.';
  };
  refresh();
})();
