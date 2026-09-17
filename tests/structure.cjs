'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../dist/index.html'),'utf8'),script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(script);
assert(!/<script[^>]*\ssrc=|<link[^>]*\shref=[\x22\x27](?!data:)|@import\b|url\(\s*https?:|\bfetch\(|new WebSocket|\bimport\s*\(/i.test(html),'no runtime network dependencies');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);assert.equal(ids.length,new Set(ids).size,'unique IDs');
for(const [,id] of script.matchAll(/\$\('([^']+)'\)/g))assert(ids.includes(id),'referenced element exists: '+id);
const elements=new Map(ids.map(id=>[id,{}]));
const ctx={console,Math,Float32Array,Uint16Array,Set,Map,Object,Array,Number,JSON,document:{getElementById:id=>elements.get(id),hidden:false},localStorage:{getItem:()=>null,setItem(){}},matchMedia:()=>({matches:false}),performance:{now:()=>1000},innerWidth:1280,innerHeight:720,devicePixelRatio:1};
vm.createContext(ctx);vm.runInContext(script.slice(0,script.indexOf('\ninitGL();buildWorld();')),ctx);
const summaries=[];
for(const f of ['buildWorld','buildCell']){vm.runInContext(f+'()',ctx);const batches=vm.runInContext('batches',ctx);let count=0,triangles=0;
for(const [name,b] of Object.entries(batches)){assert.equal(b.data.length%18,0);for(let i=0;i<b.data.length;i+=18){for(let j=0;j<18;j++)assert(Number.isFinite(b.data[i+j]),f+' '+name+' finite data');for(let j=3;j<6;j++)assert(b.data[i+j]>0,'positive scale');const q=b.data.slice(i+6,i+10);assert(Math.abs(Math.hypot(...q)-1)<1e-6,'normalized quaternion');}let n=b.data.length/18;count+=n;triangles+=n*({sphere:280,detail:864,cylinder:16,ring:432}[b.mesh]);}
assert(count<15000,'instance budget');assert(triangles<2500000,'triangle budget');summaries.push({scene:f,instances:count,triangles,staticDrawCalls:Object.keys(batches).length});}
// Actual lipid bilayer: pore center is within its shell, exterior particles begin outside.
const poreRadius=Math.hypot(4.65,1.4);assert(poreRadius>4.68&&poreRadius<4.95);assert(Math.hypot(5.55,1.4)>4.95);
const eye=vm.runInContext('lookAt([0,0,10],[0,0,0])',ctx);assert.equal(eye[14],-10);
console.log(JSON.stringify({status:'PASS',inlineBytes:Buffer.byteLength(html),uniqueIds:ids.length,externalRuntimeDependencies:0,geometry:summaries,scope:'Static HTML, actual procedural geometry, math; no browser or GPU execution'},null,2));
