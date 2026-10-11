const {test}=require('node:test'),assert=require('node:assert/strict'),L=require('../public/logistics.js');
const length=points=>points.slice(1).reduce((s,b,i)=>s+Math.hypot(...b.map((v,k)=>v-points[i][k])),0);
function fixture(height=20,differentHeights=false){
 const from=[2,differentHeights?9.2:5.2,4],to=[18,5.2,4],edge=(id,points)=>({id,item:id?'concrete':'steel',from:{point:points[0],dir:[0,0,0]},to:{point:points.at(-1),dir:[0,0,0]},points});
 const obstacle=edge(0,[[10,differentHeights?9.2:5.2,0],[10,differentHeights?9.2:5.2,14]]);
 const detour=edge(1,[from,[2,from[1],17],[18,from[1],17],...(differentHeights?[[18,5.2,17]]:[]),to]);
 const p={machines:[],floors:[{index:0,y:0,equipmentHeight:8,height,ceiling:height}],bounds:{width:20,length:20,height}};
 const graph={products:['steel','concrete'],nodes:[],edges:[obstacle,detour],routes:[obstacle.points,detour.points]};return {p,graph};
}
test('a conveyor crosses above a blocking belt instead of keeping a long planar detour',()=>{
 const {p,graph}=fixture(),before=length(graph.edges[1].points);L.optimizeGraph3D(p,graph);
 const path=graph.edges[1].points;assert.ok(length(path)<before-10);assert.ok(path.some(v=>v[1]>=9.2-1e-6));
 for(let i=1;i<path.length;i++)for(let j=1;j<graph.edges[0].points.length;j++)assert.ok(!L.segmentsConflict(path[i-1],path[i],graph.edges[0].points[j-1],graph.edges[0].points[j]));
 for(let i=1;i<path.length;i++)if(path[i][1]!==path[i-1][1])assert.ok(Math.abs(path[i][1]-path[i-1][1])>=4-1e-6);
});
test('different port heights are eligible for a direct height-aware shortcut',()=>{
 const {p,graph}=fixture(20,true),before=length(graph.edges[1].points);L.optimizeGraph3D(p,graph);
 assert.ok(length(graph.edges[1].points)<before-10);assert.deepEqual(graph.edges[1].points[0],[2,9.2,4]);assert.deepEqual(graph.edges[1].points.at(-1),[18,5.2,4]);
});
test('insufficient headroom permits a shorter side detour but never an illegal short lift',()=>{
 const {p,graph}=fixture(8.5),before=length(graph.edges[1].points);
 p.machines=[{x:0,z:0,w:20,d:20,h:4.5,floor:0}];L.optimizeGraph3D(p,graph);
 assert.ok(length(graph.edges[1].points)<=before);assert.ok(graph.edges[1].points.every(v=>v[1]===5.2));assert.ok(graph.edges[1].points.every(v=>v[1]<=7.7+1e-6));
});
test('20 encased beams per minute avoid the concrete collector detour and keep complete flows',()=>{
 const P=require('../public/planner.js'),B=require('../public/bounded.js');
 const p=P.plan({product:'encased',rate:20,preset:'mk3',width:48,length:48,height:48,floors:'auto',belt:480,liftClearance:4,clockLimit:250,external:[]});
 const edge=p.logistics.edges.find(e=>e.item==='concrete'&&!e.from.kind&&length(e.points)<30);assert.ok(edge);assert.ok(length(edge.points)<30,'previous concrete route was 65.43 m');
 assert.ok(p.logistics.routingMetrics.horizontalLength+p.logistics.routingMetrics.verticalLength<1600,'previous factory required 1727.15 m');
 const ore=p.logistics.edges.filter(e=>e.item==='ore'),trunks=ore.filter(e=>e.from.kind==='import');
 assert.ok(trunks.length<=p.fit.usedFloors);assert.equal(trunks.reduce((s,e)=>s+e.rate,0),240);assert.ok(trunks.every(e=>e.rate<=p.config.belt));
 const splitters=p.logistics.nodes.filter(n=>n.item==='ore'&&n.type==='splitter');assert.ok(splitters.every(n=>n.point[2]<30),'ore must split near foundries when a floor has multiple consumers');
 assert.ok(ore.reduce((sum,e)=>sum+length(e.points),0)<210,'previous early split required 241.8 m of ore conveyors');
 assert.ok(B.check(p));assert.ok(L.checkFlows(p,P.recipes).valid);
 const segments=p.logistics.edges.flatMap(e=>e.points.slice(1).map((b,i)=>({a:e.points[i],b})));
 for(let i=0;i<segments.length;i++)for(let j=i+1;j<segments.length;j++)assert.ok(!L.segmentsConflict(segments[i].a,segments[i].b,segments[j].a,segments[j].b));
});

test('a belt can pass below another belt when there is no headroom for an overpass',()=>{
 const {p,graph}=fixture(10);
 // Overpass at 9.2 is blocked; the free 1.2 m plane remains usable.
 p.machines=[{x:9,z:0,w:2,d:15,h:1,floor:1}];
 p.floors.push({index:1,y:8,height:2,equipmentHeight:1,ceiling:10});
 const before=length(graph.edges[1].points);L.optimizeGraph3D(p,graph);
 assert.ok(length(graph.edges[1].points)<before-10);
 assert.ok(graph.edges[1].points.some(v=>Math.abs(v[1]-1.2)<1e-6));
});

test('200 steel pipes keep coal distribution on its own floor instead of crossing the upper storey',()=>{
 const P=require('../public/planner.js'),B=require('../public/bounded.js');
 const p=P.plan({product:'pipe',rate:200,preset:'mk3',width:48,length:48,height:48,floors:'auto',belt:480,liftClearance:4,clockLimit:250,external:[]});
 const coal=p.logistics.edges.filter(e=>e.item==='coal');
 assert.ok(coal.every(e=>{const from=L.floorAt(p,e.from.point[1]),to=L.floorAt(p,e.to.point[1]);return from!==to||e.points.every(v=>v[1]>=p.floors[from].y&&v[1]<p.floors[from].ceiling)}), 'previous coal branch rose to 23.2 m through the upper storey');
 assert.ok(p.logistics.routingMetrics.horizontalLength+p.logistics.routingMetrics.verticalLength<986.71,'previous factory required 986.71 m');
 assert.ok(B.check(p));assert.ok(L.checkFlows(p,P.recipes).valid);
 const segments=p.logistics.edges.flatMap(e=>e.points.slice(1).map((b,i)=>({a:e.points[i],b})));
 for(let i=0;i<segments.length;i++)for(let j=i+1;j<segments.length;j++)assert.ok(!L.segmentsConflict(segments[i].a,segments[i].b,segments[j].a,segments[j].b));
});
