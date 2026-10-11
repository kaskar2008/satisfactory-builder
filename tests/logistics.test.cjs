const {test}=require('node:test'),assert=require('node:assert/strict'),P=require('../public/planner.js'),L=require('../public/logistics.js');
test('small factories keep junctions and routes close to their occupied floor area',()=>{
const p=P.plan({product:'encased',rate:5.1,floors:2,width:64,belt:270,external:['concrete']}),points=p.logistics.edges.flatMap(e=>e.points);
const length=p.logistics.edges.reduce((sum,e)=>sum+e.points.slice(1).reduce((n,b,i)=>n+Math.hypot(...b.map((v,k)=>v-e.points[i][k])),0),0);
assert.ok(Math.max(...points.map(v=>v[0]))-Math.min(...points.map(v=>v[0]))<=80,'Conveyors must not spread into distant product corridors');
assert.ok(length<1000,'Regression: excessive conveyor detours');
for(const n of p.logistics.nodes){const machines=p.machines.filter(m=>m.floor===n.floor),minX=Math.min(...machines.map(m=>m.x)),maxX=Math.max(...machines.map(m=>m.x+m.w));assert.ok(n.point[0]>=minX-8&&n.point[0]<=maxX+8)}
const wider=P.plan({...p.config,width:96});assert.deepEqual(wider.logistics.nodes.map(n=>n.point),p.logistics.nodes.map(n=>n.point),'Unused floor width must not push junctions away');
});
test('encased beam routing preserves bends and clears neighboring belts and lift shafts',()=>{
for(const floors of [1,2,3]){
const p=P.plan({product:'encased',rate:5.1,floors,width:64,belt:270,external:['concrete']}),segments=[];
for(const e of p.logistics.edges){assert.deepEqual(e.points[0],e.from.point);assert.deepEqual(e.points.at(-1),e.to.point);for(let i=1;i<e.points.length;i++){const a=e.points[i-1],b=e.points[i];assert.equal(a.filter((n,k)=>Math.abs(n-b[k])>1e-7).length,1,'Every rendered segment must retain its axis');segments.push({a,b,id:e.id})}}
for(let i=0;i<segments.length;i++)for(let j=i+1;j<segments.length;j++){const a=segments[i],b=segments[j];assert.ok(!L.segmentsConflict(a.a,a.b,b.a,b.b),JSON.stringify([a,b]))}
assert.ok(p.logistics.edges.some(e=>e.from.kind==='import'));assert.ok(p.logistics.edges.some(e=>e.to.kind==='export'));
}
});
test('low tier belts never overload a machine port or manifold lane',()=>{
const p=P.plan({product:'motor',rate:10,floors:3,width:48,belt:60,external:[],liftClearance:6});
for(const g of p.groups){assert.ok(g.rate/g.count<=60+1e-6);for(const n of Object.values(P.recipes[g.id].ins))assert.ok(n*g.clock<=60+1e-6)}
for(const g of p.logistics.manifolds)for(const lane of [...g.outputs,...Object.values(g.inputs).flat()])assert.ok(lane.rate<=60+1e-6);
assert.ok(p.logistics.splitters>0);assert.ok(p.logistics.mergers>0);
for(const g of p.logistics.manifolds)for(const [item,lanes] of Object.entries(g.inputs))lanes.forEach((lane,i)=>{const incoming=p.logistics.transfers.filter(t=>t.to===g.id&&t.from===item&&t.targetLane===i).reduce((n,t)=>n+t.rate,0);assert.ok(Math.abs(incoming-lane.rate)<1e-6)});
for(const t of p.logistics.transfers)assert.ok(t.rate<=60+1e-6);
});
test('audit detects slope, lift height, tight corner, and neighboring lift clearance',()=>{
const issues=L.audit([[[0,0,0],[1,2,0]],[[0,0,0],[0,3,0]],[[0,0,0],[1,0,0],[1,0,1]]],[{x:0,z:0,minY:0,maxY:16},{x:2,z:0,minY:8,maxY:24}],4);
for(const code of ['slope','lift-height','turn-space','lift-clearance'])assert.ok(issues.some(i=>i.code===code));
assert.equal(L.audit([[[0,0,0],[0,16,0]]],[{x:0,z:0,minY:0,maxY:16},{x:4,z:0,minY:0,maxY:16}],4).length,0);
});
test('shared outputs are distributed without producing or losing items',()=>{
const p=P.plan({product:'frame',rate:10,floors:2,width:48,belt:120,external:[]});
for(const g of p.groups.filter(g=>g.id!==p.config.product)){const outgoing=p.logistics.transfers.filter(t=>t.from===g.id&&!t.external).reduce((n,t)=>n+t.rate,0);assert.ok(Math.abs(outgoing-g.rate)<1e-6)}
});
test('actual three-port junction graph has exact counts and conserves flow at every node',()=>{
const p=P.plan({product:'reinforced',rate:15,floors:1,width:48,belt:270,external:['plate','screw']});
assert.equal(p.logistics.splitters,2);assert.equal(p.logistics.mergers,1);
assert.equal(p.logistics.nodes.length,3);
const key=v=>v.point.join(':');
for(const n of p.logistics.nodes){const ins=n.type==='splitter'?[n.ports.input]:n.ports.inputs,outs=n.type==='splitter'?n.ports.outputs:[n.ports.output];const inbound=p.logistics.edges.filter(e=>ins.some(v=>key(v)===key(e.to))),outbound=p.logistics.edges.filter(e=>outs.some(v=>key(v)===key(e.from)));assert.ok(n.type==='splitter'?inbound.length===1:inbound.length>=2&&inbound.length<=3);assert.ok(n.type==='splitter'?outbound.length>=2&&outbound.length<=3:outbound.length===1);assert.ok(inbound.every(e=>e.item===n.item)&&outbound.every(e=>e.item===n.item));assert.ok(Math.abs(inbound.reduce((s,e)=>s+e.rate,0)-outbound.reduce((s,e)=>s+e.rate,0))<1e-6)}
for(let i=0;i<p.logistics.nodes.length;i++)for(let j=i+1;j<p.logistics.nodes.length;j++){const a=p.logistics.nodes[i],b=p.logistics.nodes[j];if(a.floor===b.floor)assert.ok(Math.abs(a.point[0]-b.point[0])>=4||Math.abs(a.point[2]-b.point[2])>=4)}
for(const n of p.logistics.nodes)for(const m of p.machines)if(n.floor===m.floor)assert.ok(n.point[0]+2<=m.x||n.point[0]-2>=m.x+m.w||n.point[2]+2<=m.z||n.point[2]-2>=m.z+m.d);
});
test('different products never share a collinear conveyor segment',()=>{
const p=P.plan({product:'motor',rate:5,floors:3,width:48,belt:270,external:[]}),segments=[];
for(const e of p.logistics.edges)for(let i=1;i<e.points.length;i++){const a=e.points[i-1],b=e.points[i],axis=a.findIndex((v,j)=>Math.abs(v-b[j])>1e-7);if(axis<0)continue;segments.push({item:e.item,a,b,axis})}
for(let i=0;i<segments.length;i++)for(let j=i+1;j<segments.length;j++){const a=segments[i],b=segments[j];if(a.item===b.item||a.axis!==b.axis)continue;const other=[0,1,2].filter(k=>k!==a.axis);if(other.some(k=>Math.abs(a.a[k]-b.a[k])>1e-6))continue;const k=a.axis,overlap=Math.min(Math.max(a.a[k],a.b[k]),Math.max(b.a[k],b.b[k]))-Math.max(Math.min(a.a[k],a.b[k]),Math.min(b.a[k],b.b[k]));assert.ok(overlap<=1e-6,`Shared segment: ${JSON.stringify(a)} / ${JSON.stringify(b)}`)}
});
