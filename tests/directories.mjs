import assert from 'node:assert/strict';
import fs from 'node:fs';
if(!fs.existsSync('data/annuaire-croise.json')){console.log('SKIP: directory comparison has not been published yet');process.exit(0)}
const doc=JSON.parse(fs.readFileSync('data/annuaire-croise.json','utf8'));
const audit=JSON.parse(fs.readFileSync('data/annuaire-croise-audit.json','utf8'));
assert.ok(doc.sources.osm.count>900,'OSM baseline missing');
assert.ok(doc.sources.ouvert.count>=800,'Public-directory coverage too small');
assert.ok(doc.sources.baug.count>=350,'BAUG coverage too small');
assert.equal(doc.rows.length,doc.total_candidates,'Inconsistent unique candidate count');
assert.equal(new Set(doc.rows.map(r=>r.id)).size,doc.rows.length,'Duplicate canonical identifiers');
assert.equal(audit.total_candidates,doc.total_candidates,'Audit counts not matching');
assert.ok(/none.*field-verified|not.*verified/i.test(doc.verify_status),'Verification caveat missing');
for(const x of doc.rows){
  assert.ok(['75','92','93','94'].includes(x.dept),'Unexpected department');
  assert.ok(x.sources.length>=1,'Candidate has no source');
  assert.ok(!x.verified&&!x.confirmed,'Directory must never certify an opening');
  if(x.lat!==null)assert.ok(Number.isFinite(x.lat)&&Number.isFinite(x.lon),'Incomplete coordinate pair');
  for(const ref of x.source_refs){
    if(ref.source==='ouvert')assert.match(ref.url,/laverie\.ouvert\.tel\/\d\d\//,'Not a permitted listing');
    if(ref.source==='baug')assert.match(ref.url,/baug\.fr\/(?:ville|departement)\//,'Unknown BAUG link');
  }
}
console.log('PASS: '+doc.total_candidates+' source-labelled leads, '+doc.located_candidates+' mapped, not verified');
