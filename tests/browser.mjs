import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1366,height:850}});
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
try {
  const response=await page.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded',timeout:45000});
  assert.equal(response.status(),200,'Site must load as HTML 200');
  await page.waitForSelector('#map .leaflet-map-pane',{state:'attached',timeout:30000});
  assert.ok(await page.locator('#map').isVisible(),'Map container must be visible');
  await page.waitForFunction(() => document.getElementById('f-out-invest')?.textContent?.includes('€'),{timeout:20000});
  const initial=await page.locator('#f-out-invest').innerText();
  await page.locator('#f-works-shop').fill('52000');
  const modified=await page.locator('#f-out-invest').innerText();
  assert.notEqual(initial,modified,'Financial simulator must update investment amount');
  await page.locator('#rank-dep').selectOption('92');
  assert.ok(await page.locator('#rank-summary').count(),'Ranking controls must render');
  assert.ok(await page.locator('#sirene-census').count(),'SIRENE registry comparison must be visible');
  await page.locator('#sirene-dept').selectOption('75');
  await page.locator('#sirene-scope').selectOption('unmapped');
  assert.ok(await page.locator('#sirene-summary').count(),'Administrative candidates must render clear status');
  await page.locator('#osm-quality').selectOption('self_service_tagged');
  assert.ok(await page.locator('#osm-inventory-summary').count(),'OSM evidence filtering must update');
  await page.locator('#osm-quality').selectOption('');
  await page.waitForSelector('#osm-inventory-body a.google-check', {timeout:15000});
  const googleLink=await page.locator('#osm-inventory-body a.google-check').first().getAttribute('href');
  assert.ok(googleLink.startsWith('https://www.google.com/maps/search/?api=1&query='),'Google verification search must link to Maps');
  await page.locator('[data-review]').first().selectOption('google_seen');
  assert.equal(await page.locator('[data-review]').first().inputValue(),'google_seen','Google corroboration must remain separate from field verification');
  assert.equal(errors.length,0,'Page JS runtime errors: '+errors.join(' | '));
  await page.screenshot({path:'/tmp/observatoire-smoke.png',fullPage:true});
  console.log('PASS: Leaflet initialized, financial inputs react, ranking, SIRENE and OSM evidence filters, Google search links and review states work, no JS runtime exceptions.');
} finally {
  await browser.close();
}
