const {test}=require('node:test'),assert=require('node:assert/strict'),L=require('../public/logistics.js');
const P=require('../public/planner.js'),B=require('../public/bounded.js');
test('near-wall imports and exports connect directly instead of lifting into hairpins',()=>{
 const p=P.plan({product:'plate',rate:90,preset:'mk3',width:48,length:48,height:48,floors:'auto',belt:480,liftClearance:4,clockLimit:250,external:[]});
 const terminals=p.logistics.edges.filter(e=>e.from.kind||e.to.kind);
 assert.equal(terminals.length,2);
 for(const e of terminals){assert.equal(e.points.length,2);assert.equal(e.points[0][1],e.points[1][1]);assert.ok(Math.hypot(...e.points[0].map((v,k)=>v-e.points[1][k]))<=2)}
 assert.ok(B.check(p));assert.ok(L.checkFlows(p,P.recipes).valid);assert.ok(L.checkBeltCollisions(p.logistics).valid);assert.ok(L.checkEquipmentCollisions(p,p.logistics).valid);
});
test('independent belts collide at T ends, near elbows and lift heads',()=>{
 assert.ok(L.segmentsConflict([2,5,5],[8,5,5],[8,5,2],[8,5,5],false));
 assert.ok(L.segmentsConflict([2,5,5],[8,5,5],[8.4,5,2],[8.4,5,8],false));
 assert.ok(L.segmentsConflict([8,1,5],[8,9,5],[2,9.2,5],[10,9.2,5],false));
 assert.ok(!L.segmentsConflict([2,5,5],[8,5,5],[8.4,6,2],[8.4,6,8],false));
});
test('exports can move even when the route was shortest for its original fixed endpoints',()=>{
 const points=[[8,5.2,10],[8,5.2,4],[3,5.2,4]],edge={id:0,item:'steel',rate:120,from:{point:points[0],dir:[0,0,-1]},to:{kind:'export',point:points.at(-1),dir:[1,0,0]},points};
 const p={machines:[],floors:[{y:0,ceiling:11,equipmentHeight:9}],bounds:{width:20,length:20,height:11},config:{liftClearance:4}},graph={products:['steel'],nodes:[],edges:[edge],routes:[points]};
 L.optimizeGraph3D(p,graph);
 assert.equal(graph.searchStats.movedExports,1);assert.equal(edge.to.kind,'export');assert.equal(edge.from.kind,undefined);assert.equal(edge.rate,120);assert.deepEqual(edge.points[0],[8,5.2,10]);assert.deepEqual(edge.points.at(-1),edge.to.point);assert.equal(graph.routes[0],edge.points);
 assert.ok(edge.points.slice(1).reduce((s,v,i)=>s+Math.hypot(...v.map((n,k)=>n-edge.points[i][k])),0)<11);
});
