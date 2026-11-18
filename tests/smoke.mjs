import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root = new URL('../', import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), 'utf8');
const html = read('index.html');
const sources = ['observatoire.js', 'analytics.js', 'advanced-finance.js'];
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(new Set(ids).size, ids.length, 'Duplicate HTML element id');
assert.ok(ids.length >= 90, 'Missing interface controls');
const idSet = new Set(ids);
for (const name of sources) {
  const text = read(name);
  assert.ok(html.includes('src="./'+name+'"'), 'Missing script reference '+name);
  new vm.Script(text, { filename:name });
  for(const m of text.matchAll(/(?:E|\$)\('([^']+)'\)/g))
    assert.ok(idSet.has(m[1]), 'Missing HTML element '+m[1]+' requested by '+name);
}
for(const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g))
  new vm.Script(match[1], {filename:'inline.js'});
assert.ok(html.includes('non vérifi')||html.includes('non vérifi'), 'Data limitations must be explicit');
assert.ok(html.includes('INSEE'), 'Missing official demographic attribution');
const forbidden=[/sk-[a-zA-Z0-9_-]{20,}/,/ghp_[A-Za-z0-9]{30,}/,/github_pat_[A-Za-z0-9_]{30,}/,/service_role.*['"][A-Za-z0-9._-]{80,}/i];
for(const name of ['index.html',...sources])
  for(const rx of forbidden) assert.ok(!rx.test(read(name)), 'Suspected secret in '+name);
for(const file of ['data/iris-2022.json','data/laveries-osm.json']) {
  if(!fs.existsSync(new URL(file,root)))continue;
  const data=JSON.parse(read(file));
  assert.ok(Array.isArray(data.rows)&&data.rows.length>0, file+' empty');
  assert.ok(data.source&&data.generated_at,'Missing provenance in '+file);
  if(file.includes('osm'))assert.equal(data.exhaustive,false,'OSM cannot be claimed exhaustive');
  if(file.includes('iris'))assert.equal(data.year,2022,'Wrong census year');
}
console.log('PASS: JS parse, DOM wiring, source attribution, data metadata, secret patterns');
