const {test}=require('node:test'),assert=require('node:assert/strict'),P=require('../public/planner.js'),L=require('../public/logistics.js');
const base={product:'rod',rate:10,floors:1,width:48,belt:270,external:['ingot']};
test('supercomputer chain uses the minimum machine count allowed by shards and every input port',()=>{
const p=P.plan({product:'supercomputer',rate:3,floors:1,width:48,belt:480,external:['computer','cable','wire','plastic'],clockLimit:250,_layoutOnly:true,_compactSupply:true});assert.equal(p.machines.length,18);
for(const g of p.groups){const r=P.recipes[g.id],ceiling=Math.min(2.5,480/r.out,...Object.values(r.ins).map(n=>480/n));assert.equal(g.count,Math.ceil(g.rate/r.out/ceiling-1e-9));assert.ok(g.clock<=ceiling+1e-6);assert.ok(Math.abs(g.count*g.clock*r.out-g.rate)<1e-6);assert.equal(g.clockCeiling,ceiling)}
const high=p.groups.find(g=>g.id==='highSpeed');assert.equal(high.count,2);assert.ok(high.clock<high.clockCeiling);assert.equal(high.rate,9);assert.ok(9/P.recipes.highSpeed.out*P.recipes.highSpeed.ins.quickwire>480,'one fully loaded manufacturer would overload its input');
});
test('power shards increase clock ceiling and compact machine counts, while input ports remain capped',()=>{
const a=P.plan({...base,rate:35,clockLimit:100}),b=P.plan({...base,rate:35,clockLimit:250});assert.equal(a.machines.length,3);assert.equal(b.machines.length,1);assert.ok(Math.abs(b.machines[0].clock-35/15)<1e-7);assert.equal(b.shards,3);assert.ok(Math.abs(b.power-4*Math.pow(35/15,1.321928))<1e-6);
const c=P.plan({...base,product:'copperPowder',rate:30,belt:60,external:['copper'],clockLimit:250});assert.equal(c.machines.length,3);assert.ok(c.logistics.edges.every(e=>e.rate<=60));assert.ok(c.logistics.flowCheck.valid);
});
test('maximum keeps the existing geometry and reaches a clock bottleneck without increasing counts',()=>{
const p=P.plan({...base,clockLimit:250}),q=P.maximize(p);assert.ok(Math.abs(q.config.rate-37.5)<1e-6);assert.equal(q.machines.length,p.machines.length);assert.deepEqual(q.logistics.routes,p.logistics.routes);assert.equal(p.config.rate,10);assert.equal(q.shards,3);assert.ok(q.capacity.bottlenecks.some(v=>v.type==='machine'));assert.ok(L.checkFlows(q,P.recipes).valid);assert.throws(()=>P.maximize(p,P.capacity(p).factor+.1));
});
test('maximum is limited by the busiest belt or port rather than by output alone',()=>{
const p=P.plan({...base,product:'rotor',rate:1,belt:60,external:['rod','screw'],clockLimit:250}),q=P.maximize(p);assert.ok(Math.abs(q.config.rate-2.4)<1e-6);assert.ok(q.logistics.edges.every(e=>e.rate<=60+1e-6));assert.equal(q.imports.screw,60);assert.ok(q.capacity.bottlenecks.some(v=>v.type==='conveyor'));assert.ok(q.machines.every(m=>m.clock<=2.5));
});
test('all recipes have matching complete input/output flows at both clock ceilings',()=>{
for(const product of Object.keys(P.recipes))for(const clockLimit of [100,250]){const p=P.plan({...base,product,rate:1,external:Object.keys(P.recipes[product].ins),clockLimit});assert.ok(L.checkFlows(p,P.recipes).valid,product);const q=P.maximize(p);assert.ok(L.checkFlows(q,P.recipes).valid,product);assert.ok(q.machines.every(m=>m.clock<=clockLimit/100+1e-6));assert.ok(q.logistics.edges.every(e=>e.rate<=P.transportCapacity(q.config,e.item)+1e-6));}
});
test('flow validation rejects disconnected, wrong-item and overloaded machine ports',()=>{
const p=P.plan(base);for(const mutate of [q=>q.logistics.edges.pop(),q=>q.logistics.edges[0].item='copper',q=>q.logistics.edges[0].rate=271,q=>q.logistics.edges[0].rate/=2,q=>q.logistics.edges[0].from.dir=[1,0,0]]){const q=structuredClone(p);mutate(q);assert.throws(()=>L.checkFlows(q,P.recipes),e=>e.code==='flow-invalid')}
});
test('a shared iron chain preserves every machine and junction balance after maximizing',()=>{
const p=P.plan({...base,product:'smartPlating',rate:2,floors:3,external:[],clockLimit:250}),q=P.maximize(p);assert.ok(q.logistics.flowCheck.valid);assert.equal(q.logistics.flowCheck.exports.smartPlating,q.config.rate);assert.equal(q.imports.ore/p.imports.ore,q.config.rate/p.config.rate);assert.deepEqual(q.logistics.nodes,p.logistics.nodes);
});
test('separate upstream and downstream modules maximize together without exceeding the inter-module belt',()=>{
const downstream=P.plan({...base,product:'supercomputer',rate:1,floors:3,belt:480,external:['computer','cable','wire','quickwire']});
const upstream=P.plan({...base,product:'quickwire',rate:downstream.imports.quickwire,floors:2,belt:480,external:[]});
const plans=[upstream,downstream].map(p=>({...p,config:{...p.config,clockLimit:250}})),factor=Math.min(...plans.map(p=>P.capacity(p).factor)),[a,b]=plans.map(p=>P.maximize(p,factor));
assert.ok(Math.abs(a.config.rate-b.imports.quickwire)<1e-6);assert.ok(a.config.rate<=480+1e-6);for(const p of [a,b]){assert.ok(p.logistics.flowCheck.valid);assert.ok(p.logistics.edges.every(e=>e.rate<=480+1e-6));assert.ok(p.machines.every(m=>m.clock<=2.5+1e-6))}
});
