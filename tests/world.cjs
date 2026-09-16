'use strict';
// Production functions in V8. Canvas commands are checked; no browser/GPU claims.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path'),crypto=require('node:crypto');
const html=fs.readFileSync(path.join(__dirname,'../dist/index.html'),'utf8'),script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
let checks=0,canvasCommands=0;
const check=(condition,message)=>{assert(condition,message);checks++};
const equal=(a,b,message)=>{assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)),message);checks++};
function setup(storage=new Map()){
 let doc;
 const matches=(n,q)=>q==='button'?n.tagName==='BUTTON':q[0]==='.'?n.className.split(' ').includes(q.slice(1)):false;
 function node(tag='div',id=''){const n={tagName:tag.toUpperCase(),id,children:[],dataset:{},style:{},className:'',hidden:false,value:'',classList:{toggle(){},add(){},remove(){}},append(...items){this.children.push(...items)},replaceChildren(...items){this.children=items},setAttribute(k,v){this[k]=v},querySelector(q){return this.children.find(c=>matches(c,q))||node()},querySelectorAll(q){return this.children.filter(c=>matches(c,q))},addEventListener(){},focus(){doc.activeElement=this},getBoundingClientRect(){return {width:320,height:180}},getClientRects(){return [1]}};return n;}
 const elements=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(x=>[x[1],node('div',x[1])]));
 const ingredients=['water','rice','koji','yeast'].map(id=>{const n=node('button');n.dataset.ingredient=id;return n});
 doc={hidden:false,activeElement:null,body:node(),getElementById:id=>elements.get(id),createElement:tag=>node(tag),querySelector:()=>ingredients[0],querySelectorAll:q=>q.includes('ingredient')?ingredients:[],addEventListener(){}};
 elements.get('resultOverlay').hidden=true;
 const context={console,Math,Float32Array,Uint16Array,Set,Map,Object,Array,Number,JSON,Date,document:doc,window:{addEventListener(){}},localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},matchMedia:()=>({matches:false}),performance:{now:()=>1000},innerWidth:390,innerHeight:844,devicePixelRatio:1,setTimeout:()=>0,clearTimeout(){},requestAnimationFrame:()=>0};
 vm.createContext(context);vm.runInContext(script.slice(0,script.indexOf('\ninitGL();buildWorld();')),context);
 const run=code=>vm.runInContext(code,context);run('notify=()=>{};soundCue=()=>{};buildWorld();initWorldMap();resetCamera();');
 return {context,run,elements,storage,doc};
}
const t=setup(),keys=['water','rice','koji','yeast'];
for(let mask=0;mask<16;mask++){
 t.run('game.ingredients=new Set('+JSON.stringify(keys.filter((_,i)=>mask&(1<<i)))+');updateWorldUI()');
 const e=t.run('worldEcology()');
 keys.forEach((key,i)=>equal(e[key],!!(mask&(1<<i)),key+' tracks ingredient presence'));
 equal(e.population,e.yeast?1:0,'initial colony is one representative cell');
 equal(e.flow>0,e.water&&e.rice&&e.koji,'flow needs water/rice/koji');
 for(const card of t.elements.get('worldPlaces').children)equal(card.querySelector('button').disabled,!e[card.dataset.place],'map destinations require their material');
}
t.run("game.ingredients=new Set(['water','rice','koji','yeast']);startBatch();");
for(const ferment of [0,1,25,64,65,99,100])for(const buds of [0,1,2,3]){
 t.run('game.ferment='+ferment+';game.buds='+buds);
 const e=t.run('worldEcology()');check(e.population>=1&&e.population<=23,'bounded population');check(e.bubbles>=0&&e.bubbles<=24,'bounded bubbles');check(e.life.every(Number.isFinite),'finite uniforms');
}
t.run('game.ferment=100;game.buds=3');equal(t.run('worldEcology().population'),23,'mature world contains all representative cells');
equal(t.run('worldEcology().bubbles'),24,'full fermentation bubble limit');
t.run('game.buds=0');equal(t.run('worldEcology().bubbles'),24,'bubbles depend on fermentation, not budding');
const before=t.run('snapshot()');
for(const id of ['rice','koji','yeast']){
 check(t.run('focusWorldPlace('+JSON.stringify(id)+')'),'can focus available landmark');
 equal(t.run('snapshot().run.pos'),before.run.pos,'map does not teleport the player');
 equal(t.run('snapshot().run.nodes'),before.run.nodes,'map preserves collected sugar');
 equal(t.run('snapshot().observed'),before.observed,'map does not award specimen discovery');
 equal(t.run('snapshot().run.ferment'),before.run.ferment,'map does not advance growth');
 equal(t.run('focusedWorldPlace().id'),id,'landmark identity follows camera');
 equal(t.run('panel'),null,'destination selection closes panel');
}
t.run('save()');const savedEcology=t.run('worldEcology()'),restored=setup(t.storage);check(restored.run('restoreRun()'),'save restored');equal(restored.run('worldEcology()'),savedEcology,'same world appearance after resume');
equal(restored.run('focusedWorldPlace().id'),'yeast','same landmark after resume');
const eco=restored.run('worldEcology()');restored.run("settings.animations=false;settings.reduced=true;simTime=9876;mode='cell';buildCell();");equal(restored.run('worldEcology()'),eco,'visual state independent of animation time, settings and cell view');
const cellTags=restored.run('Object.values(batches).flatMap(b=>b.data.filter((_,i)=>i%18===16))');check(cellTags.every(x=>x===0||x===1),'cell clipping tags stay separate from world layers');
restored.run("setMode('world');");equal(restored.run('worldEcology()'),eco,'returning from cell preserves visual state');
const layers=restored.run('Object.values(batches).flatMap(b=>b.data.filter((_,i)=>i%18===16))');equal([...new Set(layers)].sort(),[1,2,3,4,5,6],'all world components tagged');
// Full production dynamic update: buffers remain bounded, including player/cargo/risk.
restored.run('gl={createBuffer(){return {}},bindBuffer(){},bufferData(){},bufferSubData(){}};buildDynamic();');
let maxCargo=0,maxAgents=0;
for(const mode of ['world','dive','yeast','cell'])for(const style of ['realistic','character']){
 restored.run('mode='+JSON.stringify(mode)+';settings.style='+JSON.stringify(style)+';game.risk=100;game.buds=3;game.energy=18;');
 for(const time of [0,1.4,99,10000]){restored.run('simTime='+time+';updateDynamic()');const counts=restored.run('Object.fromEntries(Object.entries(dynamics).map(([k,b])=>[k,b.count]))');check(counts.cargo<=220&&counts.agents<=220,'all dynamic instances fit allocated buffers');maxCargo=Math.max(maxCargo,counts.cargo);maxAgents=Math.max(maxAgents,counts.agents);check(restored.run('Object.values(dynamics).every(b=>b.array.slice(0,b.count*18).every(Number.isFinite))'),'finite dynamic geometry');}
}
const ctx=new Proxy({}, {get(target,key){if(key==='createRadialGradient')return ()=>({addColorStop(){}});if(key in target)return target[key];return (...args)=>{canvasCommands++;for(const n of args)if(typeof n==='number')check(Number.isFinite(n),'finite fallback canvas argument');if(key==='arc')check(args[2]>=0,'nonnegative circle radius');if(key==='ellipse')check(args[2]>=0&&args[3]>=0,'nonnegative ellipse radius');}},set(target,key,value){target[key]=value;return true}});
restored.context.testCanvas=ctx;restored.run("gl=null;fallback=testCanvas;mode='world';buildWorld();");
for(const id of ['rice','koji','yeast']){restored.run('focusWorldPlace('+JSON.stringify(id)+');drawFallback()');}
restored.run("mode='cell';buildCell();drawFallback();mode='world';game.active=false;game.finished=false;game.explore=false;game.ferment=0;game.buds=0;game.ingredients.clear();buildWorld();drawFallback();");
equal(restored.run('worldEcology().population'),0,'empty world has no old colony');check(!restored.run("focusWorldPlace('yeast')"),'cannot focus absent ingredient');
equal(restored.run('worldEcology().flow'),0,'empty world has no sugar circulation');
// Execute the real draw path with a recording GL adapter, not a GPU substitute.
const uniforms={};let drawCalls=0;
restored.context.glProbe=new Proxy({}, {get(_,key){if(key==='uniform4fv'||key==='uniform3fv')return (name,value)=>{uniforms[name]=Array.from(value)};if(key==='uniform1f')return (name,value)=>{uniforms[name]=value};return ()=>{};}});
restored.context.instProbe={vertexAttribDivisorANGLE(){},drawElementsInstancedANGLE(){drawCalls++}};
restored.run("gl=glProbe;inst=instProbe;program={loc:Object.fromEntries(['uLife','uWater','uVP','uEye','uTime','uCurrent','uMotion','uScene','uBuild','uBuildTime','uGlow','uAmbient','uClip','aPosition','aNormal','aOffset','aScale','aQuat','aColor','aExtra'].map((k,i)=>[k,k.startsWith('u')?k:i]))};meshes={sphere:{count:840},detail:{count:2592},cylinder:{count:48},ring:{count:1296}};background=()=>{};finishPost=()=>{};buildWorld();drawGL();");
equal(uniforms.uLife,[0,0,0,0],'empty state reaches shader');equal(uniforms.uWater,0,'water visibility reaches shader');
restored.run("game.ingredients=new Set(['water','rice','koji','yeast']);game.ferment=70;game.buds=2;drawGL();");equal(uniforms.uLife,restored.run('worldEcology().life'),'growth reaches shader every draw');equal(uniforms.uWater,1,'water appears after addition');check(drawCalls>0,'draw path completed');
console.log(JSON.stringify({status:'PASS',checks,canvasCommands,maxCargoInstances:maxCargo,maxAgentInstances:maxAgents,htmlSha256:crypto.createHash('sha256').update(html).digest('hex'),scope:'Production state, save/restore, map focus, bounded dynamic data, 2D Canvas commands and GL uniform dispatch. No browser, GPU or device testing.'},null,2));
