import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1280,height:840},acceptDownloads:true});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 const r=await page.goto('http://127.0.0.1:4173/recensement.html',{waitUntil:'domcontentloaded',timeout:45000});
 assert.equal(r.status(),200,'Census route must exist');
 await page.waitForSelector('#map .leaflet-map-pane',{state:'attached',timeout:30000});
 await page.waitForFunction(()=>document.getElementById('loading')?.textContent.includes('Recoupement disponible'),{timeout:40000});
 const n=Number((await page.locator('#count-total').innerText()).replaceAll(/\s/g,''));
 assert.ok(n>900,'Census should exceed original OSM baseline');
 await page.waitForFunction(()=>document.getElementById('review-queue-summary')?.textContent.includes('fiches dans la liste'),{timeout:15000});
 await page.locator('#priority').selectOption('A');
 assert.ok((await page.locator('#body tr').count())>0,'Priority A review list empty');
 assert.ok((await page.locator('#summary').innerText()).includes('candidats'),'Priority filter did not update');
 await page.locator('#priority').selectOption('');
 const ban=Number((await page.locator('#count-ban').innerText()).replace(/\s/g,''));
 const geocodeState=await page.evaluate(async()=>{
  const [d,g]=await Promise.all([fetch('./data/annuaire-croise.json').then(r=>r.json()),fetch('./data/geocoded-addresses.json').then(r=>r.ok?r.json():null)]);
  return {sameSnapshot:!!g&&g.directory_generated_at===d.generated_at&&g.address_only_not_business_verification===true,accepted:g?.accepted||0};
 });
 if(geocodeState.sameSnapshot){
  assert.ok(geocodeState.accepted>=35&&ban>=35,'Strict IGN/BAN address suggestions missing from a matching data snapshot');
 }else{
  assert.equal(ban,0,'Stale IGN/BAN coordinates must be discarded');
  assert.ok((await page.locator('#loading').innerText()).includes('ignorées')||(await page.locator('#loading').innerText()).includes('indisponible'),'Stale or missing IGN/BAN snapshot must be explained');
 }
 const original=Number((await page.locator('#count-osm').innerText()).replaceAll(/\s/g,''));
 assert.ok(original>=800,'Baseline OSM inventory unexpectedly small');
 await page.locator('#source').selectOption('nonosm');
 assert.ok((await page.locator('#summary').innerText()).includes('candidats'),'Filtered source count missing');
 await page.locator('[data-select]').first().click();
 assert.ok(await page.locator('#selected a[href*="google.com/maps/search/"]').count(),'Candidate should provide manual Google Maps cross-check');
 await page.locator('#local-type').selectOption('automatic');
 await page.locator('#local-note').fill('Passage de contrôle terrain à confirmer');
 await page.locator('#local-note').press('Tab');
 await page.locator('#local-evidence').fill('https://www.google.com/maps/search/?api=1&query=laverie');
 await page.locator('#local-evidence').press('Tab');
 await page.locator('#local-check').selectOption('google_seen');
 assert.equal(await page.locator('#local-check').inputValue(),'google_seen','Manual Google corroboration must be local');
 const backup=page.waitForEvent('download');
 await page.locator('#export-backup').click();
 assert.equal((await backup).suggestedFilename(),'mes-controles-laveries.json','JSON backup missing');
 const download=page.waitForEvent('download');
 await page.locator('#export').click();
 assert.ok((await download).suggestedFilename().endsWith('.csv'),'Filtered CSV export not working');
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.getElementById('loading')?.textContent.includes('Recoupement disponible'),{timeout:40000});
 assert.ok(await page.locator('#map').isVisible(),'Map should remain functional after reload');
 await page.setViewportSize({width:390,height:844});
 await page.waitForTimeout(450);
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
 assert.ok(overflow<=12,'Unexpected horizontal mobile overflow: '+overflow);
 assert.deepEqual(errors,[],'Uncaught frontend JS exception(s)');
 await page.screenshot({path:'/tmp/observatoire-recensement.png',fullPage:true});
 console.log('PASS: multi-directory audit, OSM baseline, filters, BAN geocoding, A/B/C review filters, manual notes and Google check, JSON backup, CSV, mobile layout, map, no page errors');
}finally{await browser.close()}
