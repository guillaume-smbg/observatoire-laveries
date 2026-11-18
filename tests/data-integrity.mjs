import assert from 'node:assert/strict';
import fs from 'node:fs';

const load=path=>JSON.parse(fs.readFileSync(path,'utf8'));
const exists=path=>fs.existsSync(path);
if(exists('data/laveries-osm.json')){
 const doc=load('data/laveries-osm.json');
 assert.equal(doc.exhaustive,false,'OSM cannot be labelled exhaustive');
 assert.equal(doc.professionally_verified,false,'OSM cannot be called professionally verified');
 assert.ok(Array.isArray(doc.rows)&&doc.rows.length>0,'OSM records missing');
 assert.equal(new Set(doc.rows.map(x=>x.id)).size,doc.rows.length,'Duplicate OSM identifiers');
 const counts=Object.values(doc.counts_by_department||{}).reduce((a,b)=>a+b,0);
 assert.equal(counts,doc.rows.length,'OSM geography count differs from rows');
 for(const x of doc.rows)assert.ok(['75','92','93','94'].includes(x.dep),'Out-of-area OSM record '+x.id);
}
if(exists('data/sirene-laundries.json')){
 const doc=load('data/sirene-laundries.json');
 assert.equal(doc.exhaustive,false,'SIRENE cannot be an exhaustive laundromat inventory');
 assert.equal(doc.not_an_inventory_of_laundromats,true,'SIRENE limitations missing');
 if(doc.complete!==undefined){
  assert.equal(doc.complete,true,'Partial SIRENE refresh must never replace the public snapshot');
  assert.equal(doc.coverage_status,'complete','SIRENE coverage state must be explicit');
 }
 assert.ok(Array.isArray(doc.rows)&&doc.rows.length>0,'No SIRENE rows');
 assert.equal(new Set(doc.rows.map(x=>x.id)).size,doc.rows.length,'Duplicate SIRENE SIRET');
 for(const r of doc.rows){
   assert.match(r.id,/^\d{14}$/,'Invalid public SIRET');
   assert.equal(r.activity,'96.01B','Unexpected activity in registry candidate');
   assert.equal(r.administrative_status,'A','Closed establishment wrongly included');
   assert.ok(['75','92','93','94'].includes(r.dep),'Out-of-area registry candidate');
   if(r.closest_osm_id)assert.ok(Number(r.closest_osm_meters)<=45,'Outside proximity threshold');
 }
 for(const [dep,coverage] of Object.entries(doc.departments||{})){
   assert.ok(['75','92','93','94'].includes(dep),'Unexpected SIRENE department metadata');
   if(doc.complete!==undefined){
    assert.equal(coverage.complete_page_scan,true,'Department '+dep+' has incomplete SIRENE pagination');
    assert.equal(coverage.pages_read,coverage.pages,'Department '+dep+' SIRENE pages were not all read');
   }
 }
 if(exists('data/candidats-sirene-sans-osm.csv')){
  const csv=fs.readFileSync('data/candidats-sirene-sans-osm.csv','utf-8');
  assert.ok(csv.includes('SIRET_PUBLIC')&&csv.includes('À VÉRIFIER'),'CSV must be explicitly marked unverified');
  assert.ok(csv.includes('RECHERCHE_GOOGLE_MAPS'),'Priority CSV lacks Google search links');
 }
}
if(exists('data/iris-2022.json')){
 const d=load('data/iris-2022.json');
 assert.equal(d.year,2022,'Census year mismatch');
 assert.ok(Array.isArray(d.rows)&&d.rows.length>200,'Insufficient IRIS records');
}
console.log('PASS: source metadata, administrative activity filters, identifiers, geographic counts and non-exhaustiveness.');

