import fs from 'node:fs';
import assert from 'node:assert/strict';
const path='data/opportunities.json';
if(!fs.existsSync(path)){console.log('SKIP: no computed opportunities published yet');process.exit(0)}
const p=JSON.parse(fs.readFileSync(path,'utf8'));
assert.ok(p.count>=2000,'Unexpectedly few IRIS opportunities');
assert.equal(p.rows.length,p.count,'Number of points disagrees');
assert.ok(p.source.includes('INSEE')&&p.source.includes('OpenStreetMap'),'Sources missing');
assert.equal(p.top50_distinct_iris_ids.length,50,'Need 50 regionally distinct candidates');
let scored=0;
for(const v of p.rows){
 assert.ok(['75','92','93','94'].includes(v.department),'Outside target');
 assert.ok(Number.isFinite(v.lat)&&Number.isFinite(v.lon),'Missing map point');
 for(const r of ['300','500','1000']){
   const c=v.catchments[r];
   assert.ok(c,'Missing radius '+r);
   assert.ok(c.coverage>=0&&c.coverage<=1.001,'Bad geographic coverage');
   assert.ok(c.population>=0&&c.homes>=0,'Negative demographics');
   assert.ok(c.osm.all>=c.osm.plausible&&c.osm.plausible>=c.osm.explicit,'Incoherent OSM confidence counts');
 }
 assert.ok(v.catchments['300'].population<=v.catchments['500'].population+5,'Population decreases with increased radius');
 assert.ok(v.catchments['500'].population<=v.catchments['1000'].population+5,'Population decreases with increased radius');
 if(v.score!==null){scored++;assert.ok(v.score>=0&&v.score<=100,'Score outside range')}
}
assert.ok(scored>=1000,'Most scores unavailable');
console.log('PASS: '+p.count+' georeferenced IRIS; '+scored+' scorable; three nested radii; all sources labelled');
