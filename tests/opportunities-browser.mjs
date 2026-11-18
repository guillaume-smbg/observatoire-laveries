import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1280,height:900},acceptDownloads:true});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
  const response=await page.goto('http://127.0.0.1:4173/opportunites.html',{waitUntil:'domcontentloaded',timeout:45000});
  assert.equal(response.status(),200,'Opportunity page must load');
  await page.waitForSelector('#map .leaflet-map-pane',{state:'attached',timeout:35000});
  await page.waitForFunction(()=>/^2\s*695$/.test(document.getElementById('k-iris')?.textContent?.replace(/\s+/g,' ')||''),{timeout:45000});
  assert.ok(Number((await page.locator('#k-scores').innerText()).replace(/\s/g,''))>1000,'Scored districts absent');
  assert.ok(Number((await page.locator('#k-directory').innerText()).replace(/\s/g,''))>=1500,'Merged directory not displayed');
  assert.equal(await page.locator('#evidence').inputValue(),'dir_multi','Default ranking must use explicit merged evidence');
  assert.equal(await page.locator('#top-rows tr').count(),50,'Expected 50 distinct candidate sectors');
  await page.locator('#top-rows [data-focus]').first().click();
  const content=await page.locator('#place-detail').innerText();
  assert.ok(content.includes('Habitants estimés')&&content.includes('Résidences principales estimées'),'Evidence missing from site detail');
  await page.route('**/isochrone?**',route=>route.fulfill({
    status:200,
    headers:{'access-control-allow-origin':'*','content-type':'application/json'},
    body:JSON.stringify({type:'FeatureCollection',features:[{type:'Feature',properties:{contour:5},geometry:{type:'Polygon',coordinates:[[[2.34,48.85],[2.35,48.85],[2.35,48.86],[2.34,48.85]]]}}]})
  }));
  await page.locator('#walk-iso').click();
  await page.waitForFunction(()=>document.getElementById('walk-status')?.textContent.includes('via Valhalla'),{timeout:18000});
  assert.ok((await page.locator('#walk-status').innerText()).includes('ne modifient pas le classement'),'Walking API should not alter score methodology');
  await page.locator('#walk-clear').click();
  assert.ok((await page.locator('#walk-status').innerText()).includes('masqués'),'Isochrone removal failed');
  await page.locator('#save-place').click();
  assert.equal(await page.locator('#comparison-rows tr').count(),1,'Selected candidate should be compared');
  const old=await page.locator('#comparison-rows tr').innerText();
  await page.locator('[data-cycles]').first().fill('55');
  await page.locator('[data-cycles]').first().press('Tab');
  const revised=await page.locator('#comparison-rows tr').innerText();
  assert.notEqual(old,revised,'Changes to assumed activity must alter cashflows');
  await page.locator('#evidence').selectOption('all');
  assert.ok((await page.locator('#rank-note').innerText()).includes('Tous points OSM'),'Competition scenario should respond');
  const downloadEvent=page.waitForEvent('download');
  await page.locator('#download-csv').click();
  const file=await downloadEvent;
  assert.ok(file.suggestedFilename().endsWith('.csv'),'CSV expected');
  await page.evaluate(()=>{window.__printCalled=false;window.print=()=>window.__printCalled=true});
  await page.locator('#print-comparison').click();
  assert.equal(await page.evaluate(()=>window.__printCalled),true,'Browser print dialog must be invoked');
  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(600);
  assert.ok(await page.locator('#map').isVisible(),'Map should be visible on mobile');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  assert.ok(overflow<20,'Unexpected mobile horizontal page overflow: '+overflow);
  assert.deepEqual(errors,[],'JavaScript runtime errors');
  await page.screenshot({path:'/tmp/observatoire-opportunites.png',fullPage:true});
  console.log('PASS: 2695 IRIS loaded; 50 distinct zones, dynamic finance, merged evidence and walking isochrones; CSV, PDF print invocation; mobile viewport.');
}finally{await browser.close()}
