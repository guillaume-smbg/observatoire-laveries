import fs from 'node:fs';
import assert from 'node:assert/strict';
const path='data/geocoded-addresses.json';
if(!fs.existsSync(path)){console.log('SKIP: IGN address data not generated yet');process.exit(0)}
const d=JSON.parse(fs.readFileSync(path,'utf8'));
const base=JSON.parse(fs.readFileSync('data/annuaire-croise.json','utf8'));
assert.equal(d.address_only_not_business_verification,true,'Must not claim address is verified commerce');
assert.equal(d.source_url,'https://data.geopf.fr/geocodage/search','Expected official IGN API');
assert.equal(d.unlocated_before,d.accepted+d.rejected,'All source candidates must be accounted for');
assert.equal(new Set(d.rows.map(x=>x.id)).size,d.rows.length,'Repeated IDs');
const originals=new Map(base.rows.map(x=>[x.id,x]));
for(const r of d.rows){
 const old=originals.get(r.id);
 assert.ok(old&&old.lat===null,'Only previously unlocated sources may be geocoded');
 assert.equal(r.matched_postcode,old.postcode,'Postal code mismatch');
 assert.ok(r.score>=d.minimum_match_score,'Insufficient address score');
 assert.equal(r.precision,'BAN_housenumber_address_not_business','Address distinction missing');
 assert.ok(Number.isFinite(r.lat)&&Number.isFinite(r.lon),'Missing coordinates');
}
console.log('PASS: '+d.accepted+'/'+d.unlocated_before+' strict IGN housenumber matches; no business confirmation');
