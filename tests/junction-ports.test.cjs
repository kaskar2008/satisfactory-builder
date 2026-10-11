const {test}=require('node:test'),assert=require('node:assert/strict'),L=require('../public/logistics.js');
const endpoint=(point,dir)=>({point,dir});
function fixture(type='merger'){
 const ports=[endpoint([18,5.2,20],[-1,0,0]),endpoint([20,5.2,18],[0,0,-1]),endpoint([22,5.2,20],[1,0,0])],source=endpoint([6,5.2,20],[1,0,0]);
 const points=[source.point,[8,5.2,20],[8,9.2,20],[26,9.2,20],[26,5.2,20],ports[2].point];
 const node={id:0,type,item:'iron',point:[20,5.2,20],ports:type==='merger'?{inputs:ports,output:endpoint([20,5.2,22],[0,0,1])}:{outputs:ports,input:endpoint([20,5.2,22],[0,0,1])}};
 const e={id:0,item:'iron',rate:60,from:source,to:ports[2],points};if(type==='splitter'){[e.from,e.to]=[e.to,e.from];e.points=[...points].reverse()}
 return {p:{machines:[],floors:[{y:0,ceiling:14,equipmentHeight:9}],bounds:{width:40,length:40,height:14},config:{liftClearance:4}},g:{nodes:[node],edges:[e],products:['iron'],routes:[e.points]},ports};
}
test('equivalent junction ports minimize all branches together at every rotation',()=>{
 for(const rotation of [0,90,180,270]){const ports=[endpoint([-2,0,0],[-1,0,0]),endpoint([0,0,-2],[0,0,-1]),endpoint([2,0,0],[1,0,0])].map(p=>endpoint(L.rotateDirection(p.point,rotation),L.rotateDirection(p.dir,rotation))),anchors=[endpoint([12,0,0],[-1,0,0]),endpoint([-12,0,0],[1,0,0])].map(p=>endpoint(L.rotateDirection(p.point,rotation),L.rotateDirection(p.dir,rotation)));
 assert.deepEqual(L.assignJunctionPorts(anchors,ports),[2,0]);
 }
});
for(const type of ['merger','splitter'])test(type+' replaces a far unused port with a direct near connection',()=>{
 const {p,g,ports}=fixture(type),e=g.edges[0];L.optimizeGraph3D(p,g);
 assert.equal(e[type==='merger'?'to':'from'],ports[0]);assert.equal(e.points.length,2);assert.equal(g.searchStats.reassignedPorts,1);assert.equal(e.rate,60);assert.equal(g.routes[0],e.points);assert.ok(L.checkBeltCollisions(g).valid);assert.ok(L.checkEquipmentCollisions(p,g).valid);
});
test('a nearer junction port is not selected through a building',()=>{
 const {p,g}=fixture();p.machines=[{x:10,z:17,w:4,d:6,h:10,floor:0}];L.optimizeGraph3D(p,g);
 assert.ok(L.checkEquipmentCollisions(p,g).valid);assert.ok(L.checkBeltCollisions(g).valid);
});
test('junction optimization never steals an occupied port',()=>{
 const {p,g,ports}=fixture();const e={id:1,item:'iron',rate:30,from:endpoint([12,5.2,20],[1,0,0]),to:ports[0],points:[[12,5.2,20],ports[0].point]};g.edges.push(e);g.routes.push(e.points);L.optimizeGraph3D(p,g);
 assert.equal(new Set(g.edges.map(e=>e.to)).size,2);assert.equal(g.edges[1].to,ports[0]);assert.ok(L.checkBeltCollisions(g).valid);
});
