import fs from 'node:fs';
import assert from 'node:assert/strict';
const origin='https://gtapartylimos.com',siteId='cbc8f422-c35f-41e2-89cd-26a2dd8bb2a9';
const ownershipFile='googleba238d1ac19f5d0a.html',ownershipContent='google-site-verification: '+ownershipFile;
const urls=s=>[...s.matchAll(/<loc>([^<]+)<\/loc>/g)].map(x=>x[1]);
const source=urls(fs.readFileSync('public/sitemap.xml','utf8')),built=urls(fs.readFileSync('dist/sitemap.xml','utf8'));
for(const name of ['index.html','dist/index.html']){const html=fs.readFileSync(name,'utf8');assert.equal((html.match(new RegExp('site-tracking/'+siteId+'\\.js','g'))||[]).length,1);assert(!html.includes('googletagmanager.com'),'No second tag owner or copied Analytics ID');}
assert.equal(source.length,21);assert.equal(new Set(source).size,21);assert.deepEqual(built,source);
for(const u of source){assert.equal(new URL(u).origin,origin);assert(fs.existsSync('dist'+new URL(u).pathname+(new URL(u).pathname.endsWith('/')?'index.html':'/index.html')));}
for(const dir of ['public','dist']){assert.match(fs.readFileSync(dir+'/robots.txt','utf8'),/Sitemap: https:\/\/gtapartylimos\.com\/sitemap\.xml/);assert.equal(JSON.parse(fs.readFileSync(dir+'/.well-known/growth-studio.json')).site_id,siteId);assert.equal(fs.readFileSync(dir+'/'+ownershipFile,'utf8').trim(),ownershipContent);}
const base=process.argv[2];
if(base){assert.equal(new URL(base).hostname,'127.0.0.1');for(const [p,type] of [['/robots.txt','text/plain'],['/sitemap.xml','xml'],['/.well-known/growth-studio.json','application/json'],['/'+ownershipFile,'text/html']]){const r=await fetch(base+p,{signal:AbortSignal.timeout(5000)});assert.equal(r.status,200);assert((r.headers.get('content-type')||'').includes(type),p);const t=await r.text();assert(!t.includes('<!doctype html>'),p);if(p.endsWith('.json'))assert.equal(JSON.parse(t).site_id,siteId);if(p.endsWith('.xml'))assert.deepEqual(urls(t),source);if(p==='/'+ownershipFile)assert.equal(t.trim(),ownershipContent);}}
console.log(JSON.stringify({result:'PASS_CLIENT_STATIC_CONNECTION',canonical_origin:origin,sitemap_urls:source.length,proof_client_exact:true,http_checked:!!base,live_deployed:false,forms_submitted:0}));
