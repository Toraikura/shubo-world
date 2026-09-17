'use strict';
// Execute production state functions in V8 with storage/DOM adapters.
// These are lifecycle and geometry checks, not browser, GPU or touch QA.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../dist/index.html'),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
let checks=0;
const check=(value,message)=>{assert(value,message);checks++};
const equal=(a,b,message)=>{assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)),message);checks++};
function setup(storage=new Map(),failWrites=false){
 function node(id=''){const children=[],listeners={};return {id,tagName:'DIV',children,hidden:true,dataset:{},style:{},value:'',disabled:false,inert:false,listeners,classList:{add(){},remove(){},toggle(){}},setAttribute(){},append(x){children.push(x)},replaceChildren(){children.length=0},querySelector(){return node()},querySelectorAll(){return []},addEventListener(ev,f){listeners[ev]=f},focus(){doc.activeElement=this},click(){this.onclick?.()},remove(){},getClientRects(){return [1]}}}
 const elements=new Map(ids.map(id=>[id,node(id)]));
 const ingredients=['water','rice','koji','yeast'].map(key=>{const n=node();n.tagName='BUTTON';n.dataset.ingredient=key;return n});
 const modes=['world','dive','yeast','cell'].map(key=>{const n=node();n.tagName='BUTTON';n.dataset.mode=key;return n});
 const styles=['realistic','character'].map(key=>{const n=node();n.tagName='BUTTON';n.dataset.style=key;return n});
 const doc={hidden:false,activeElement:null,body:node('body'),getElementById:id=>elements.get(id),createElement:()=>node(),addEventListener(){},querySelector:()=>ingredients[0],querySelectorAll:selector=>selector.includes('ingredient')?ingredients:selector.includes('data-style')?styles:selector.includes('mode')?modes:[]};
 const ctx={console,Math,Float32Array,Uint16Array,Set,Map,Object,Array,Number,JSON,Date,document:doc,window:{addEventListener(){}},localStorage:{getItem:key=>storage.get(key)||null,setItem(key,value){if(failWrites)throw Error('quota');storage.set(key,value)}},matchMedia:()=>({matches:false}),performance:{now:()=>1000},innerWidth:390,innerHeight:844,devicePixelRatio:1,setTimeout:()=>0,clearTimeout(){},requestAnimationFrame:()=>0};
 vm.createContext(ctx);vm.runInContext(script.slice(0,script.indexOf('\ninitGL();buildWorld();')),ctx);
 vm.runInContext('this.api={buildWorld,buildCell,restoreRun,snapshot,normalizeSave,cleanName,save,chooseStyle,startBatch,finishBatch,interact,stepPlayer,stepCompanions,setMode,updateCare,bindControls,readSaveFile,game,colony,settings,player,camera};notify=()=>{};soundCue=()=>{};',ctx);
 ctx.api.buildWorld();return {ctx,api:ctx.api,storage,elements,doc,run:code=>vm.runInContext(code,ctx)};
}
// Exterior presentation must not alter the saved microscopic world.
const exterior=setup();exterior.run("initKuraGeometry();game.ingredients=new Set(['water','rice','koji','yeast']);startBatch();setMode('yeast');game.time=42;game.energy=4;player.pos=[1,.2,6];camera.yaw=.43;paused=false;panel=null;");
const priorExterior=exterior.api.snapshot();exterior.run('returnKura();');equal(exterior.api.snapshot().run,priorExterior.run,'returning to KURA preserves saved mode, camera, run and resources');
for(let i=1;i<80;i++)exterior.run('frame('+i*16.67+')');equal(exterior.api.game.time,42,'KURA suspends even an unpaused active run');
exterior.run("settings.animations=false;input.keys.add('arrowleft');this.yawBefore=kura.yaw;tickKura(.1);input.keys.clear()");check(exterior.run('kura.yaw>yawBefore'),'motion OFF preserves manual keyboard camera');
exterior.run('settings.animations=true;peekVat();tickKura(.1);paused=true;');const progress=exterior.run('kura.transition.progress');exterior.run('tickKura(.2)');equal(exterior.run('kura.transition.progress'),progress,'pause freezes entry');exterior.run("paused=false;panel='helpPanel';tickKura(.2)");equal(exterior.run('kura.transition.progress'),progress,'dialog freezes entry');exterior.run('panel=null;settings.animations=false;tickKura(.1)');equal(exterior.run('kura.transition'),null,'motion OFF completes entry without animated travel');
equal(exterior.api.snapshot().run,priorExterior.run,'one-click LIFE entry preserves complete microscopic state');check(exterior.run('kura.scene')==='micro','one-click LIFE entry completes');check(exterior.run('microPapers().length')<=64,'paper draw items capped');check(exterior.run('kura.instances')<600,'exterior geometry bounded');
exterior.run('returnKura();settings.animations=true;peekVat();');for(let i=0;i<60;i++)exterior.run('tickKura(.04)');check(exterior.run("kura.scene==='micro'&&kura.transition===null"),'animated entry completes after exactly one activation');check(!ids.includes('brewerHotspot'),'brewer button removed');check(exterior.run("kuraPapers().some(p=>p.atlas==='brewer')"),'brewer character retained');
for(const b of Object.values(exterior.run('kura.batches')))check(b.data.every(Number.isFinite)&&b.data.length%18===0,'finite packed brewery geometry');
const first=setup();const a=first.api;
a.game.ingredients=new Set(['water','rice','koji','yeast']);a.startBatch();a.setMode('yeast');a.colony.name='こめまる';
a.player.pos=[0,.2,6.8];a.game.time=83.4;a.game.energy=6;a.interact();equal(a.colony.totalBuds,1,'first actual bud recorded');
for(let i=0;i<2;i++){a.game.energy=6;a.interact()}
a.game.energy=6;a.interact();equal(a.colony.totalBuds,3,'capped colony does not award phantom births');equal(a.game.energy,6,'capped action does not consume glucose');
first.run('sugarNodes[4].active=false;sugarNodes[4].respawn=7.25');
a.setMode('cell');a.camera.yaw=.7;a.camera.distance=9.2;a.save();
const savedBefore=a.snapshot();const resumed=setup(first.storage);check(resumed.api.restoreRun(),'restore succeeds');
equal(resumed.api.game.time,83.4,'no offline catchup or penalty');equal(resumed.api.player.pos,[0,.2,6.8],'same player location');equal(resumed.api.snapshot().run.nodes,savedBefore.run.nodes,'depleted resources survive cell view save');equal(resumed.api.snapshot().run.mode,'cell','same view restored');equal(resumed.api.colony.totalBuds,3,'no duplicate lifetime births on restore');
equal(resumed.api.snapshot().run.paused,true,'active run resumes safely paused');
resumed.api.bindControls();resumed.elements.get('meetColony').onclick();equal(resumed.api.snapshot().run.mode,'cell','continue button preserves restored mode');equal(resumed.api.camera.distance,9.2,'continue button preserves camera');
const stateBefore=resumed.api.snapshot();resumed.api.chooseStyle('character');const stateAfter=resumed.api.snapshot();equal(stateAfter.run,stateBefore.run,'style does not reset run');equal(stateAfter.colony,stateBefore.colony,'style does not reset lineage');
resumed.api.setMode('yeast');resumed.run('paused=false;');
resumed.api.stepCompanions(.016);const origin=resumed.run('companions.map(p=>[...p])');resumed.api.player.pos=[5,.2,6.8];for(let i=0;i<90;i++)resumed.api.stepCompanions(1/60);check(resumed.run('companions[0][0]')>origin[0][0],'companions follow actual movement');check(resumed.run('companions.length')===3,'companion count bounded');
resumed.doc.activeElement=resumed.elements.get('colonyNameInput');resumed.doc.activeElement.value='命名中';resumed.api.updateCare();equal(resumed.doc.activeElement.value,'命名中','care refresh preserves unconfirmed typing');
resumed.api.finishBatch(true);resumed.api.finishBatch(true);equal(resumed.api.colony.stableBatches,1,'result processing is idempotent');equal(resumed.api.colony.history.length,1,'result record is idempotent');
resumed.api.save();const completed=setup(resumed.storage);completed.api.restoreRun();equal(completed.api.game.explore,true,'completed world can be revisited');equal(completed.api.colony.stableBatches,1,'completed save does not award success again');
check(a.normalizeSave({version:1})===null,'unknown schema rejected');check(a.normalizeSave({version:2})===null,'missing state rejected');
const dirty=JSON.parse(JSON.stringify(savedBefore));dirty.colony.name='<script>\u0000不思議</script>';dirty.run.buds=500;dirty.run.time=Infinity;dirty.run.pos=[NaN,Infinity,-9999];dirty.settings.style='alien';const cleaned=a.normalizeSave(dirty);equal(cleaned.run.buds,3,'imported counters bounded');check(cleaned.run.pos.every(Number.isFinite),'import coordinates finite');check(!/[<>\u0000]/.test(cleaned.colony.name),'name sanitized');equal(cleaned.settings.style,'realistic','invalid style falls back');
const backupStorage=new Map([['shubo.v2','broken'],['shubo.v2.backup',JSON.stringify(savedBefore)]]);const recovered=setup(backupStorage);check(recovered.api.restoreRun(),'recovers last known valid version');equal(recovered.api.colony.name,'こめまる','backup recovery preserves identity');
const legacy=setup(new Map([['shubo.v1',JSON.stringify({settings:{quality:'low'},observed:['rice'],best:111})]]));equal(legacy.api.settings.quality,'low','legacy preferences migrated');equal(legacy.api.game.best,111,'legacy best preserved');equal([...legacy.api.game.observed],['rice'],'legacy observations preserved');
const blocked=setup(new Map(),true);blocked.run('saveClock=5');check(blocked.api.save()===false,'storage failure signalled');equal(blocked.run('saveClock'),0,'failed autosave waits for next interval');equal(blocked.run('saveHealthy'),false,'storage failure exposed to UI');
// Character geometry uses the same bounded batches as the naturalist look.
const geometry=[];
for(const style of ['realistic','character']){const t=setup();t.api.settings.style=style;t.api.buildWorld();const batches=t.run('batches');let count=0,triangles=0;for(const b of Object.values(batches)){for(let i=0;i<b.data.length;i+=18){check(b.data.slice(i,i+18).every(Number.isFinite),'finite character instance');check(b.data.slice(i+3,i+6).every(n=>n>0),'positive instance scale');}count+=b.data.length/18;triangles+=(b.data.length/18)*({sphere:280,detail:864,cylinder:16,ring:432}[b.mesh]);}check(count<15000,'world instance cap');check(triangles<2500000,'world triangle cap');geometry.push({style,instances:count,triangles,staticDrawCalls:Object.keys(batches).length});}
(async()=>{const t=setup();await t.api.readSaveFile({size:50,text:async()=>'{bad'});equal(t.run('pendingImport'),null,'invalid import keeps current save');await t.api.readSaveFile({size:JSON.stringify(savedBefore).length,text:async()=>JSON.stringify(savedBefore)});equal(t.run('pendingImport.colony.name'),'こめまる','valid import staged for explicit in-game confirmation');check(!t.storage.has('shubo.v2'),'staging an import does not replace live data');console.log(JSON.stringify({status:'PASS',checks,geometry,scope:'Actual production lifecycle functions in Node VM; browser/GPU/mobile untested'},null,2));})().catch(e=>{console.error(e);process.exitCode=1});
