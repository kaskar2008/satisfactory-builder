const {test}=require('node:test'),assert=require('node:assert/strict'),L=require('../public/logistics.js'),P=require('../public/planner.js'),B=require('../public/bounded.js');
const length=e=>e.points.slice(1).reduce((sum,v,i)=>sum+Math.hypot(...v.map((n,k)=>n-e.points[i][k])),0);
function fixture(){const points=[[3,5.2,4],[8,5.2,4],[8,5.2,10]],edge={id:0,item:'coal',rate:60,from:{kind:'import',point:points[0],dir:[1,0,0]},to:{point:points.at(-1),dir:[0,0,-1]},points};return {p:{machines:[],floors:[{y:0,ceiling:11,equipmentHeight:9}],bounds:{width:20,length:20,height:11},config:{liftClearance:4}},graph:{products:['coal'],nodes:[],edges:[edge],routes:[points]}}}
test('an import can move even if its old route is already shortest between its fixed endpoints',()=>{
 const {p,graph}=fixture();L.optimizeGraph3D(p,graph);assert.ok(length(graph.edges[0])<11);assert.equal(graph.searchStats.movedImports,1);assert.ok(graph.edges[0].points.every(v=>v[1]===5.2));assert.equal(graph.edges[0].rate,60);
});
test('import relocation rejects a shorter blocked wall approach and keeps other terminals clear',()=>{
 const {p,graph}=fixture(),e=graph.edges[0];e.points=[[3,5.2,4],[4.5,5.2,4],[4.5,5.2,8],[8,5.2,8],[8,5.2,10]];graph.routes[0]=e.points;
 p.machines=[{x:7,z:1,w:2,d:5,h:9,floor:0}];
 const points=[[3,5.2,8],[4.5,5.2,8]];graph.edges.push({id:1,item:'coal',from:{point:points[0],kind:'import',dir:[1,0,0]},to:{point:points[1],dir:[-1,0,0]},points});graph.routes.push(points);
 L.optimizeGraph3D(p,graph);assert.ok(length(e)<=11+1e-6);assert.ok(L.checkBeltCollisions(graph).valid);assert.ok(Math.hypot(e.from.point[0]-3,e.from.point[2]-8)>=4);assert.ok(e.points.every(v=>!(v[0]>6.2&&v[0]<9.8&&v[2]>.2&&v[2]<6.8)));
});
test('the 800 steel module relocates boundary terminals without losing flow or creating crossings',()=>{
 const p=P.plan({product:'steel',rate:800,preset:'mk3',width:48,length:48,height:48,floors:'auto',belt:480,liftClearance:4,clockLimit:250,external:[]});
 const imports=p.logistics.edges.filter(e=>e.from.kind==='import'&&e.item==='coal');assert.equal(imports.reduce((s,e)=>s+e.rate,0),800);assert.ok(imports.every(e=>e.rate<=480));assert.ok(p.logistics.searchStats.movedImports>0);assert.ok(p.logistics.searchStats.movedExports>0);
 assert.ok(B.check(p));assert.ok(L.checkFlows(p,P.recipes).valid);assert.ok(L.checkBeltCollisions(p.logistics).valid);assert.ok(L.checkEquipmentCollisions(p,p.logistics).valid);
});
