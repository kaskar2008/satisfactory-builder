const {test}=require('node:test'),assert=require('node:assert/strict'),P=require('../public/planner.js'),B=require('../public/bounded.js');
const base={product:'oscillator',rate:1,preset:'custom',width:64,length:64,height:48,floors:3,belt:270,external:[]};
test('automatic floors can use four levels while retaining the height limit',()=>{
const config={product:'reinforced',rate:20,preset:'custom',width:32,length:32,height:64,floors:'auto',belt:270,external:['plate','screw']};
assert.throws(()=>P.plan({...config,floors:3}),e=>e.code==='volume-fit');const p=P.plan(config);assert.equal(p.config.floors,'auto');assert.equal(p.fit.usedFloors,4);assert.equal(p.fit.maxFloors,4);assert.equal(p.floors.at(-1).ceiling,52);assert.ok(B.check(p));
assert.throws(()=>P.plan({...config,height:51}),e=>e.code==='volume-fit');
});
test('automatic floors proposes three separate modules when two cannot fit',()=>{
const config={product:'rod',rate:75,preset:'custom',width:32,length:32,height:16,floors:'auto',belt:270,external:['ingot']};assert.throws(()=>P.plan(config),e=>e.code==='volume-fit');
const q=P.propose(config);assert.equal(q.kind,'parallel');assert.equal(q.modules.length,3);assert.equal(q.modules.reduce((n,p)=>n+p.config.rate,0),75);assert.equal(q.links.length,0);q.modules.forEach(p=>assert.ok(B.check(p)));assert.notEqual(q.modules[0].machines,q.modules[1].machines);
});

test('different equipment heights produce different ceilings and cumulative floor elevations',()=>{
const L=require('../public/logistics.js'),p={config:{floors:3},machines:[{floor:0,h:8},{floor:0,h:9},{floor:1,h:11},{floor:2,h:12.3}]};
L.assignFloors(p);
assert.deepEqual(p.floors.map(f=>[f.y,f.height,f.ceiling]),[[0,11,11],[11,13,24],[24,15,39]]);
assert.deepEqual(p.machines.map(m=>m.y),[0,0,11,24]);
assert.deepEqual(p.floors.map(f=>L.displayBase(p,f.index)),[0,11,24]);
for(const y of [0,1.2,10.9,11,12.2,23.9,24,25.2,39]){assert.equal(L.displayY(p,y),y);assert.ok(Math.abs(L.actualY(p,L.displayY(p,y))-y)<1e-6)}
const invalid={...p,bounds:{width:48,length:48,height:38},logistics:{nodes:[],edges:[]}};
assert.throws(()=>B.check(invalid),e=>e.code==='volume-fit');
});
test('oscillator example uses one floor with a maximum of three',()=>{const p=P.plan(base);assert.equal(p.machines.length,10);assert.equal(p.config.floors,3);assert.equal(p.fit.usedFloors,1);assert.ok(B.check(p));assert.deepEqual([...new Set(p.machines.map(m=>m.floor))].sort(),[0]);assert.deepEqual(p.machines.map(m=>[m.x,m.z,m.floor]),P.plan({...base,floors:2}).machines.map(m=>[m.x,m.z,m.floor]));assert.equal(P.plan({...base,floors:1}).fit.usedFloors,1)});
test('small factory uses one floor regardless of an allowed maximum of three',()=>{const c={...base,product:'rod',rate:15,preset:'mk3',external:['ingot']};const p=P.plan(c);assert.equal(p.fit.usedFloors,1);assert.equal(p.config.floors,3);assert.deepEqual(p.machines.map(m=>[m.x,m.z,m.floor]),P.plan({...c,floors:1}).machines.map(m=>[m.x,m.z,m.floor]));assert.ok(B.check(p))});
test('unused allowed floors cannot cause a height rejection',()=>{const p=P.plan({...base,product:'rod',rate:15,preset:'mk1',height:100,external:['ingot']});assert.equal(p.bounds.height,32);assert.equal(p.fit.usedFloors,1);assert.ok(B.check(p))});

