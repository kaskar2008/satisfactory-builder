const {test}=require('node:test'),assert=require('node:assert/strict'),P=require('../public/planner.js'),B=require('../public/bounded.js'),L=require('../public/logistics.js');
const base={product:'encased',rate:5,preset:'mk3',width:48,floors:2,belt:270,external:['concrete']};
test('motor export uses a shortest level route at its output port height',()=>{
const p=P.plan({product:'motor',rate:2,preset:'mk3',width:48,length:48,height:48,floors:'auto',belt:270,external:['rotor']});
const e=p.logistics.edges.find(e=>e.item==='motor'&&e.to.kind==='export');
assert.ok(e);const actual=e.points.slice(1).reduce((sum,b,i)=>sum+Math.hypot(...b.map((n,k)=>n-e.points[i][k])),0),minimum=e.from.point.reduce((sum,n,k)=>sum+Math.abs(n-e.to.point[k]),0);assert.ok(Math.abs(actual-minimum)<1e-6,'free export must not acquire detours or lifts');
assert.ok(e.points.every(v=>Math.abs(v[1]-e.from.point[1])<1e-6));assert.ok(B.check(p));
const segments=p.logistics.edges.flatMap(e=>e.points.slice(1).map((b,i)=>({a:e.points[i],b})));
for(let i=0;i<segments.length;i++)for(let j=i+1;j<segments.length;j++)assert.ok(!L.segmentsConflict(segments[i].a,segments[i].b,segments[j].a,segments[j].b));
});
test('unobstructed constructor, assembler and manufacturer exports do not rise and descend',()=>{
for(const product of ['rod','reinforced','motor','computer']){
const p=P.plan({product,rate:1,preset:'custom',width:64,length:64,height:48,floors:'auto',belt:270,external:Object.keys(P.recipes[product].ins)});
const e=p.logistics.edges.find(e=>e.to.kind==='export');assert.ok(e);assert.ok(e.points.every(v=>Math.abs(v[1]-e.from.point[1])<1e-6),product+' export should remain at port height');assert.ok(B.check(p));
}
});
test('smart plating merges compatible smelter outputs near the sources before a shared trunk',()=>{
const p=P.plan({...base,product:'smartPlating',rate:2,floors:3,external:[],_compactSupply:true});const nodes=p.logistics.nodes.filter(n=>n.item==='ingot'&&n.type==='merger');assert.equal(nodes.length,1);
const node=nodes[0],same=(a,b)=>a.every((v,k)=>Math.abs(v-b[k])<1e-6),incoming=p.logistics.edges.filter(e=>node.ports.inputs.some(port=>same(port.point,e.to.point))),outgoing=p.logistics.edges.filter(e=>same(node.ports.output.point,e.from.point));
assert.equal(incoming.length,2);assert.equal(outgoing.length,1);assert.ok(Math.abs(incoming.reduce((n,e)=>n+e.rate,0)-outgoing[0].rate)<1e-6);assert.ok(outgoing[0].rate<=p.config.belt);
assert.ok(incoming.reduce((sum,e)=>sum+e.points.slice(1).reduce((s,b,i)=>s+Math.hypot(...b.map((n,k)=>n-e.points[i][k])),0),0)<100,'outputs must merge before two long independent trunks');assert.ok(p.logistics.routingMetrics.horizontalLength+p.logistics.routingMetrics.verticalLength<1177.68,'routing should improve the original example');assert.ok(B.check(p));
});
test('5.1 modular frames fit one Mk.3 with at most three occupied floors and separate product routes',()=>{
const c={...base,product:'frame',rate:5.1,floors:3,external:['plate','ingot','screw']};const plans=[P.plan(c)];
assert.ok(plans.length<=2);for(const p of plans){assert.ok(B.check(p));const floors=[...new Set(p.machines.map(m=>m.floor))].sort((a,b)=>a-b);assert.deepEqual(floors,Array.from({length:floors.length},(_,i)=>i));assert.equal(p.fit.usedFloors,floors.length);
for(const g of p.groups){assert.deepEqual(g.floors,[...new Set(g.machines.map(m=>m.floor))].sort((a,b)=>a-b));for(const m of g.machines)assert.equal(m,p.machines[m.id])}
for(const f of p.floors){assert.equal(f.height,Math.ceil(Math.max(...p.machines.filter(m=>m.floor===f.index).map(m=>m.h))+2));for(const m of p.machines.filter(m=>m.floor===f.index))assert.equal(m.y,f.y);if(f.index)assert.equal(f.y,p.floors[f.index-1].ceiling)}
for(const g of p.logistics.manifolds){for(const lane of [...g.outputs,...Object.values(g.inputs).flat()])assert.ok(lane.machines.every(id=>p.machines[id].floor===lane.floor));for(const [item,lanes] of Object.entries(g.inputs))lanes.forEach((lane,i)=>assert.ok(Math.abs(p.logistics.transfers.filter(t=>t.to===g.id&&t.from===item&&t.targetLane===i).reduce((sum,t)=>sum+t.rate,0)-lane.rate)<1e-6))}
}
const p=plans[0];assert.equal(p.machines.length,8);assert.ok(p.fit.usedFloors<=3);assert.equal(p.config.rate,c.rate);assert.deepEqual(p.config.external,c.external);assert.ok([1,3].includes(p.fit.gap));
const segments=p.logistics.edges.flatMap(e=>e.points.slice(1).map((b,i)=>({a:e.points[i],b})));
for(let i=0;i<segments.length;i++)for(let j=i+1;j<segments.length;j++)assert.ok(!L.segmentsConflict(segments[i].a,segments[i].b,segments[j].a,segments[j].b));
for(const {a,b} of segments){const axis=a.findIndex((v,i)=>Math.abs(v-b[i])>1e-7);for(const m of p.machines){const lo=[m.x,m.y,m.z],hi=[m.x+m.w,m.y+m.h,m.z+m.d];assert.ok(![0,1,2].every(i=>i===axis?Math.min(Math.max(a[i],b[i]),hi[i])-Math.max(Math.min(a[i],b[i]),lo[i])>1e-6:a[i]>lo[i]+1e-6&&a[i]<hi[i]-1e-6),'Conveyor must not pass through a machine')}}
});
test('blueprint presets use internal cubic build volumes',()=>{assert.deepEqual(Object.values(B.presets).map(v=>[v.width,v.length,v.height]),[[32,32,32],[40,40,40],[48,48,48]]);const p=P.plan({...base,product:'rod',external:[],preset:'mk2'});assert.equal(p.width,40);assert.equal(p.length,40);assert.equal(p.bounds.height,40);assert.ok(B.check(p))});
test('bounded planner repacks and keeps every route, node, machine and terminal inside',()=>{const p=P.plan(base);assert.ok(p.fit.attempts>=1);assert.ok(B.check(p));for(const e of p.logistics.edges)for(const ep of [e.from,e.to])if(ep.kind){const margin=ep.kind==='export'?.8:3;assert.ok(ep.point[0]>=margin&&ep.point[0]<=p.width-margin);assert.ok(ep.point[2]>=margin&&ep.point[2]<=p.length-margin)}const segments=p.logistics.edges.flatMap(e=>e.points.slice(1).map((b,i)=>({a:e.points[i],b})));for(let i=0;i<segments.length;i++)for(let j=i+1;j<segments.length;j++)assert.ok(!L.segmentsConflict(segments[i].a,segments[i].b,segments[j].a,segments[j].b))});
test('compact encased beams fit Mk.1 without bypassing its height with a custom override',()=>{const p=P.plan({...base,preset:'mk1',floors:3,height:100});assert.equal(p.bounds.height,32);assert.ok(p.floors.at(-1).ceiling<=32);assert.ok(B.check(p));assert.ok(p.logistics.flowCheck.valid);assert.deepEqual(p.imports,{concrete:30,ore:60,coal:60});const segments=p.logistics.edges.flatMap(e=>e.points.slice(1).map((b,i)=>({a:e.points[i],b})));for(let i=0;i<segments.length;i++)for(let j=i+1;j<segments.length;j++)assert.ok(!L.segmentsConflict(segments[i].a,segments[i].b,segments[j].a,segments[j].b));assert.ok(B.check(P.plan({...base,preset:'custom',length:48,height:24,floors:2})))});
test('failure proposes two independently bounded modules with conserved final output',()=>{const c={...base,product:'reinforced',rate:10,external:[]};assert.throws(()=>P.plan(c),e=>e.code==='volume-fit');const q=P.propose(c);assert.equal(q.modules.length,2);q.modules.forEach(p=>assert.ok(B.check(p)));assert.equal(q.kind,'stages');assert.equal(q.modules[1].config.rate,c.rate);for(const link of q.links){assert.equal(q.modules[0].config.product,link.item);assert.equal(q.modules[0].config.rate,link.rate);assert.equal(q.modules[1].imports[link.item],link.rate)}});
test('parallel alternative halves the target and does not draw an outside connector',()=>{const c={...base,product:'rod',rate:35,preset:'mk1',floors:1,external:['ingot']};assert.throws(()=>P.plan(c),e=>e.code==='volume-fit');const q=P.propose(c);assert.equal(q.kind,'parallel');assert.equal(q.modules.reduce((n,p)=>n+p.config.rate,0),35);assert.equal(q.links.length,0);q.modules.forEach(p=>assert.ok(B.check(p)))});
test('when two modules are insufficient, additional bounded stages preserve the requested output',()=>{const q=P.propose({...base,preset:'mk1',rate:100});assert.ok(q.modules.length>2);assert.ok(q.modules.every(B.check));assert.ok(Math.abs(q.modules.filter(p=>p.config.product===base.product).reduce((sum,p)=>sum+p.config.rate,0)-100)<1e-7)});
test('encased beams fit a single three-floor Mk.3, including on-site concrete',()=>{
for(const external of [['concrete'],[]]){const p=P.plan({...base,rate:5.1,floors:3,external});assert.ok(B.check(p));assert.ok(['depth','spread'].includes(p.fit.strategy));assert.ok(p.fit.usedFloors<=3);assert.deepEqual([...new Set(p.machines.map(m=>m.floor))].sort(),Array.from({length:p.fit.usedFloors},(_,i)=>i));assert.equal(p.config.rate,5.1);assert.equal(p.groups.find(g=>g.id==='encased').rate,5.1);
const segments=p.logistics.edges.flatMap(e=>e.points.slice(1).map((b,i)=>({a:e.points[i],b})));for(let i=0;i<segments.length;i++)for(let j=i+1;j<segments.length;j++)assert.ok(!L.segmentsConflict(segments[i].a,segments[i].b,segments[j].a,segments[j].b));
for(const {a,b} of segments){const axis=a.findIndex((v,i)=>Math.abs(v-b[i])>1e-7);for(const m of p.machines){const lo=[m.x,m.y,m.z],hi=[m.x+m.w,m.y+m.h,m.z+m.d];assert.ok(![0,1,2].every(i=>i===axis?Math.min(Math.max(a[i],b[i]),hi[i])-Math.max(Math.min(a[i],b[i]),lo[i])>1e-6:a[i]>lo[i]+1e-6&&a[i]<hi[i]-1e-6),'Conveyor must not pass through a machine')}}
}
});



