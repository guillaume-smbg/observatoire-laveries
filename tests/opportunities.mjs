import fs from 'node:fs';
import assert from 'node:assert/strict';
const path='data/opportunities.json';
if(!fs.existsSync(path)){console.log('SKIP: no computed opportunities published yet');process.exit(0)}
const p=JSON.parse(fs.readFileSync(path,'utf8'));
assert.ok(p.count>=2000,'Unexpectedly few IRIS opportunities');
assert.equal(p.rows.length,p.count,'Number of points disagrees');
assert.ok(p.source.includes('INSEE')&&p.source.includes('OpenStreetMap')&&p.source.includes('BAUG'),'Crossed source attribution missing');
assert.ok(p.candidate_total>=1500&&p.candidate_geolocated>=1400,'Cross directory candidate coverage unexpectedly low');
assert.equal(p.top50_distinct_iris_ids.length,50,'Need 50 regionally distinct candidates');
assert.ok(Number.isFinite(p.candidate_unlocated)&&p.candidate_unlocated>=0,
 'Unlocated directory leads must remain visible in provenance');
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
   assert.ok(c.directory,'Directory competitor count missing at radius '+r);
   assert.ok(c.directory.all>=c.directory.plausible&&c.directory.plausible>=c.directory.multi,
     'Public-directory confidence hierarchy incoherent');
   assert.ok(c.directory.all>=c.directory.osm,'Merged directory loses historic OSM points');
   assert.ok(c.directory.address_only>=0&&c.directory.address_only<=c.directory.all,'Bad IGN count');
   assert.ok(c.directory.address_only<=c.directory.all,'Address-only count cannot exceed all candidates');
 }
 assert.ok(v.catchments['300'].population<=v.catchments['500'].population+5,'Population decreases with increased radius');
 assert.ok(v.catchments['500'].population<=v.catchments['1000'].population+5,'Population decreases with increased radius');
 if(v.score!==null){scored++;assert.ok(v.score>=0&&v.score<=100,'Score outside range')}
}
assert.ok(scored>=1000,'Most scores unavailable');
console.log('PASS: '+p.count+' georeferenced IRIS; '+scored+' scorable; three nested radii; all sources labelled');

if(fs.existsSync('data/verification-prioritaire.json')){
 const pri=JSON.parse(fs.readFileSync('data/verification-prioritaire.json','utf8'));
 assert.equal(pri.rows.length,p.candidate_total,'Manual verification JSON must cover all directory leads');
 assert.equal(new Set(pri.rows.map(r=>r.id)).size,pri.rows.length,'Manual-review IDs must not duplicate');
 assert.ok(pri.rows.every(r=>['A','B','C'].includes(String(r.priority).charAt(0))),'Unknown priority labels');
 const queue=fs.readFileSync('data/verification-prioritaire.csv','utf8');
 for(const line of queue.split(/\r?\n/).slice(1).filter(Boolean)){
   const cols=line.split(';');
   const postcode=cols[4];
   const url=cols[18]||'';
   if(/^\d{5}$/.test(postcode)&&url){
     const decoded=decodeURIComponent(url);
     assert.equal((decoded.match(new RegExp(postcode,'g'))||[]).length,1,'Google search URL duplicates postal code for '+cols[0]);
   }
 }
}

