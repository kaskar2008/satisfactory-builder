const {test}=require('node:test'),assert=require('node:assert/strict'),P=require('../public/planner.js'),S=require('../public/simulation.js');
const endpoint=(point,kind)=>({point,dir:[1,0,0],...(kind?{kind}:{})});
function direct(rate=60,belt=60,distance=100){const from=endpoint([0,0,0],'import'),to=endpoint([distance,0,0],'export');return {config:{belt},machines:[],logistics:{nodes:[],edges:[{id:0,item:'ingot',rate,from,to,points:[from.point,to.point]}]}}}
test('items move forward at belt speed, independently of the allocated item rate',()=>{
 const s=S.create([direct(30,480)]);s.advance(3);const particle=s.particles(0)[0];assert.ok(particle);assert.ok(Math.abs(particle.point[0]-9.6)<.11);assert.equal(s.stats.imported.ingot,1);
});

test('60 and 180 items per minute on the same belt tier change density, not movement speed',()=>{
 const slow=S.create([direct(60,270,1000)]),dense=S.create([direct(180,270,1000)]);
 slow.advance(60);dense.advance(60);assert.ok(Math.abs(dense.particles(0).length-3*slow.particles(0).length)<=1);
 const a=slow.particles(0)[0].point[0],b=dense.particles(0)[0].point[0];slow.advance(1);dense.advance(1);
 assert.ok(Math.abs(slow.particles(0)[0].point[0]-a-5.4)<1e-6);assert.ok(Math.abs(dense.particles(0)[0].point[0]-b-5.4)<1e-6);
 const mk1=S.create([direct(30,60,1000)]),mk3=S.create([direct(30,270,1000)]);mk1.advance(3);mk3.advance(3);
 assert.ok(Math.abs(mk3.particles(0)[0].point[0]/mk1.particles(0)[0].point[0]-4.5)<1e-6);
});
test('short conveyors cannot bypass nominal throughput or duplicate items',()=>{
 const s=S.create([direct(120,60,.1)]);s.advance(120);assert.ok(s.stats.exported.ingot<=120);assert.ok(s.stats.exported.ingot>=118);assert.equal(s.stats.imported.ingot,s.stats.exported.ingot+s.particles(0).length);
});

test('power shards accelerate recipe cycles without bypassing conveyor capacity',()=>{
 const p=P.plan({product:'ingot',rate:75,width:64,floors:1,belt:120,clockLimit:250,external:[]}),s=S.create([p]);
 assert.equal(s.modules[0].machines.length,1);assert.equal(s.modules[0].machines[0].duration,.8);
 s.advance(180);const before=s.stats.exported.ingot;s.advance(120);assert.ok(Math.abs(s.stats.exported.ingot-before-150)<=2);
});

test('a saturated merger respects its outgoing belt limit and backs up upstream',()=>{
 const p=P.plan({product:'ingot',rate:90,width:100,floors:1,belt:120,external:[]}),s=S.create([p]);
 for(const e of s.modules[0].edges)if(e.sink.type==='export')e.speed=1.2;
 s.advance(180);const before=s.stats.exported.ingot;s.advance(180);
 assert.ok(s.stats.exported.ingot-before<=181);assert.ok(s.stats.exported.ingot-before>=175);
 assert.ok(s.modules[0].nodes.some(n=>n.n.type==='merger'&&n.queue.length>=8));
});
test('machines consume complete integer recipe batches and preserve production through the full path',()=>{
 const p=P.plan({product:'plate',rate:20,width:64,floors:1,belt:60,external:[]}),s=S.create([p]);s.advance(180);const before=s.stats.exported.plate??0;s.advance(300);const after=s.stats.exported.plate;
 assert.ok(Math.abs((after-before)/5-20)<=.5);assert.ok((s.stats.imported.ore??0)>after);assert.ok(s.stats.produced.plate%2===0);assert.ok(s.modules[0].machines.every(m=>m.output.length<=(m.m.group==='plate'?200:100)));
 for(const e of s.modules[0].edges)for(let i=1;i<e.items.length;i++)assert.ok(e.items[i-1].d-e.items[i].d>=1.2-1e-6);
});

test('a complete multi-ingredient modular-frame chain reaches its requested final output',()=>{
 const p=P.plan({product:'frame',rate:2,width:100,floors:1,belt:120,external:[]}),s=S.create([p]);
 s.advance(600);const before=s.stats.exported.frame??0;s.advance(180);assert.ok(before>0);assert.ok(Math.abs((s.stats.exported.frame??0)-before-6)<=2);
});

test('balanced frame and motor chains sustain near-full occupation at their actual clocks',()=>{
 for(const product of ['frame','motor']){
  const p=P.plan({product,rate:10,width:128,floors:1,belt:480,clockLimit:250,external:[]}),s=S.create([p]);
  s.advance(1200);const before=s.stats.exported[product]??0;s.advance(600);
  assert.ok(Math.abs((s.stats.exported[product]-before)/10-10)<=.2,product);
  for(const m of s.modules[0].machines)assert.ok(S.utilization(m)>=.99,product+': '+m.m.group+' '+S.utilization(m));
  for(const g of p.groups){assert.ok(g.count<=g.minimumCount+1);assert.ok(g.machines.every(m=>m.clock<=g.clockCeiling+1e-7));}
 }
});

test('fractional source intervals preserve supply instead of rounding away items',()=>{
 const s=S.create([direct(112.5,480,.1)]);s.advance(600);assert.ok(Math.abs(s.stats.exported.ingot-1125)<=1);
});

test('occupation measures working time independently of a machine clock',()=>{
 const s=S.create([P.plan({product:'ingot',rate:15,width:64,floors:1,belt:120,external:[]})]),m=s.modules[0].machines[0];
 assert.equal(m.m.clock,.5);s.advance(300);assert.ok(S.utilization(m)>.99);
 for(const e of s.modules[0].edges)if(e.source.type==='import'){e.e.rate=0;e.credit=0}
 s.advance(600);assert.equal(S.utilization(m),0);
});
test('all production batches consume integer ingredients at the configured recipe rates',()=>{for(const [item,r] of Object.entries(P.recipes)){const batch=S.batches[item];assert.ok(batch);for(const [id,rate] of Object.entries(r.ins))if(!P.isFluid(id))assert.ok(Math.abs(rate/r.out*batch-Math.round(rate/r.out*batch))<1e-7,item)}});

test('circuit boards use the standard eight-second cycle producing one board',()=>{
 const p=P.plan({product:'circuitBoard',rate:7.5,width:64,floors:1,belt:120,external:['copperSheet','plastic']}),s=S.create([p]);
 const machine=s.modules[0].machines.find(m=>m.m.group==='circuitBoard');assert.equal(machine.duration,8);assert.deepEqual(machine.needed,[['copperSheet',2],['plastic',4]]);
});

test('machine status distinguishes crafting, missing ingredients and a full output',()=>{
 const s=S.create([P.plan({product:'ingot',rate:30,width:64,floors:1,belt:120,external:[]})]),m=s.modules[0].machines[0];
 assert.deepEqual(S.machineStatus(m),{status:'waiting',progress:0});
 m.remaining=m.duration/2;assert.deepEqual(S.machineStatus(m),{status:'crafting',progress:.5});
 m.output=Array.from({length:100},()=>({item:'ingot'}));m.remaining=0;
 assert.deepEqual(S.machineStatus(m),{status:'blocked',progress:1});
 m.remaining=null;assert.deepEqual(S.machineStatus(m),{status:'blocked',progress:0});
});

test('a machine waits for every ingredient and resumes when the missing supply arrives',()=>{
 const p=P.plan({product:'steel',rate:45,width:64,floors:1,belt:120,external:[]}),s=S.create([p]);
 const coal=s.modules[0].edges.find(e=>e.source.type==='import'&&e.e.item==='coal'),rate=coal.e.rate;coal.e.rate=0;
 s.advance(180);assert.equal(s.stats.produced.steel??0,0);assert.equal(s.modules[0].machines[0].remaining,null);
 coal.e.rate=rate;s.advance(180);assert.ok(s.stats.exported.steel>50);
});

test('splitters skip a full branch and keep supplying available branches without loss',()=>{
 const p=P.plan({product:'ingot',rate:90,width:100,floors:1,belt:120,external:[]}),s=S.create([p]);
 const blocked=s.modules[0].machines[0];blocked.remaining=Infinity;blocked.inputs.ore=Array.from({length:100},()=>({item:'ore'}));
 s.advance(300);assert.equal(blocked.cycles,0);assert.equal(blocked.inputs.ore.length,100);
 assert.ok(s.modules[0].machines.slice(1).every(m=>m.cycles>70));
 const stored=s.modules[0].edges.reduce((n,e)=>n+e.items.filter(t=>t.token.item==='ore').length,0)+s.modules[0].nodes.filter(n=>n.n.item==='ore').reduce((n,s)=>n+s.queue.length,0)+s.modules[0].machines.slice(1).reduce((n,m)=>n+m.inputs.ore.length+(m.remaining!==null?1:0),0);
 assert.equal(s.stats.imported.ore,stored+s.stats.produced.ingot);
});
test('module transfer replaces external spawning and conserves upstream products',()=>{
 const a=direct(60,60,.1),b=direct(60,60,.1),s=S.create([a,b],{kind:'stages',links:[{item:'ingot',rate:60}]});s.advance(120);
 assert.ok(s.stats.imported.ingot<=120);assert.ok(s.stats.exported.ingot<=s.stats.imported.ingot);assert.ok(s.stats.exported.ingot>=117);
});
test('mergers and splitters preserve item counts and fairly serve equal branches',()=>{
 const p=P.plan({product:'ingot',rate:90,width:100,floors:1,belt:120,external:[]}),s=S.create([p]);s.advance(180);
 const before=s.modules[0].machines.map(m=>m.cycles);s.advance(180);const machines=s.modules[0].machines.map((m,i)=>m.cycles-before[i]);assert.ok(Math.max(...machines)-Math.min(...machines)<=3);assert.ok(s.stats.exported.ingot>100);
 const input=s.stats.imported.ore??0,inventory=s.modules[0].edges.reduce((n,e)=>n+e.items.filter(t=>t.token.item==='ore').length,0)+s.modules[0].nodes.filter(n=>n.n.item==='ore').reduce((n,s)=>n+s.queue.length,0)+s.modules[0].machines.reduce((n,m)=>n+m.inputs.ore.length+(m.remaining!==null?1:0),0);
 assert.equal(input,inventory+s.stats.produced.ingot);
});
test('simulation frames keep the static scene cached and follow its rounded bend path',()=>{
 require('../public/scene.js');const p=P.plan({product:'ingot',rate:30,width:64,floors:1,belt:120,external:[]}),s=S.create([p]);s.advance(10);let staticMesh,draws=0;
 const texts=[],ctx=new Proxy({measureText:()=>({width:10}),fillText:t=>texts.push(t)},{get:(o,k)=>o[k]||(()=>{})}),canvas={getBoundingClientRect:()=>({width:1000,height:700})};
 const args={canvas,ctx,plan:p,angle:0,tilt:.65,zoom:1,selected:null,floor:'all',onHits(){},viewStyle:'realistic',simulation:s,gpu:{draw(mesh,m,sel,w,h,paths,particles){if(staticMesh)assert.equal(mesh,staticMesh);staticMesh=mesh;assert.ok(particles.length>0);draws++}}};
 FactoryScene.render(args);s.advance(.1);FactoryScene.render(args);assert.equal(draws,2);assert.ok(Object.values(staticMesh.travelPaths).some(path=>path.length>4));assert.ok(texts.some(t=>/Крафт|Простой/.test(t)));
});

test('all six real belt tiers preserve nominal throughput on short routes',()=>{
 for(const belt of [60,120,270,480,780,1200])for(const distance of [.1,2,12]){
  const s=S.create([direct(belt*2,belt,distance)]);s.advance(30);const before=s.stats.exported.ingot;s.advance(60);assert.ok(Math.abs(s.stats.exported.ingot-before-belt)<=1,belt+' at '+distance+' m');assert.equal(s.stats.imported.ingot,s.stats.exported.ingot+s.particles(0).length);
 }
});

test('inter-module deliveries wait for physical route length and nominal belt speed',()=>{
 for(const [distance,belt] of [[12,60],[120,60],[120,120]]){
  const route={id:2,item:'ingot',kind:'belt',rate:60,points:[[0,0,0],[distance,0,0]],source:{module:0,original:0},destination:{module:1,original:0}};
  const s=S.create([direct(60,belt,.1),direct(60,belt,.1)],{kind:'stages',links:[{item:'ingot'}]},[route]);
  const duration=distance/(belt*.02);s.advance(2);const event=s.transferEvents.find(e=>e.phase==='out');assert.ok(event);assert.equal(event.duration,duration);assert.equal(event.routeId,2);
  s.advance(duration-2);assert.equal(s.stats.exported.ingot??0,0);assert.equal(s.particles(1).length,0);
  s.advance(2);assert.ok(s.stats.exported.ingot>0);const before=s.stats.exported.ingot;s.advance(60);assert.ok(Math.abs(s.stats.exported.ingot-before-60)<=1);
 }
});
