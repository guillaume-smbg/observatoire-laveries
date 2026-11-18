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
  assert.equal(errors.length,0,'Page JS runtime errors: '+errors.join(' | '));
  await page.screenshot({path:'/tmp/observatoire-smoke.png',fullPage:true});
  console.log('PASS: Leaflet initialized, financial inputs react, ranking renders, no JS runtime exceptions.');
} finally {
  await browser.close();
}
