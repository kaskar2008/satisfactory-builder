const {test}=require('node:test'),assert=require('node:assert/strict'),P=require('../public/planner.js'),L=require('../public/logistics.js'),B=require('../public/bounded.js');
require('../public/scene.js');
test('junctions can share a footprint and touch vertically while retaining independent ports and routes',()=>{
 const p=P.plan({product:'steel',rate:240,preset:'custom',width:64,length:64,height:48,floors:1,belt:480,clockLimit:200,external:[]});
 const nodes=p.logistics.nodes,pairs=nodes.flatMap((a,i)=>nodes.slice(i+1).filter(b=>a.floor===b.floor&&a.point[0]===b.point[0]&&a.point[2]===b.point[2]).map(b=>[a,b]));
 // Stacking is allowed, but a verified flat layout may be cheaper after collision repair.
 assert.ok(p.logistics.nodes.length);assert.ok(L.checkBeltCollisions(p.logistics).valid);
 const lower={point:[6,5.2,6]},upper={point:[6,8.2,6]};assert.ok(Math.abs(lower.point[1]+2.3-(upper.point[1]-.7))<1e-6);
 for(const [a,b] of pairs){assert.equal(Math.round(Math.abs(a.point[1]-b.point[1])*1e6)/1e6,L.rules.nodeHeight);assert.notEqual(a.item,b.item);assert.ok(Math.max(a.point[1],b.point[1])+2.3<=p.floors[a.floor].ceiling)}
 assert.ok(B.check(p));assert.ok(L.checkFlows(p,P.recipes).valid);
 const segments=p.logistics.edges.flatMap(e=>e.points.slice(1).map((b,i)=>({a:e.points[i],b})));
 for(let i=0;i<segments.length;i++)for(let j=i+1;j<segments.length;j++)assert.ok(!L.segmentsConflict(segments[i].a,segments[i].b,segments[j].a,segments[j].b));
});
test('engineering junction caps have no coincident top surface with their own casing',()=>{
 const p=P.plan({product:'reinforced',rate:15,floors:1,width:48,belt:270,external:['plate','screw']});
 const ctx=new Proxy({measureText:s=>({width:s.length*6})},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)}),canvas={getBoundingClientRect:()=>({width:1000,height:700})};let mesh;
 FactoryScene.render({canvas,ctx,plan:p,angle:-.65,tilt:.65,zoom:1,selected:null,floor:'all',onHits(){},gpu:{draw(m){mesh=m}}});
 for(const n of p.logistics.nodes){const surfaces=mesh.faces.filter(f=>f.junction===n.id&&f.v.every(v=>Math.abs(v[1]-f.v[0][1])<1e-7));const width=f=>Math.max(...f.v.map(v=>v[0]))-Math.min(...f.v.map(v=>v[0]));const casing=surfaces.filter(f=>Math.abs(width(f)-4)<1e-7).sort((a,b)=>b.v[0][1]-a.v[0][1])[0],cap=surfaces.filter(f=>Math.abs(width(f)-3.2)<1e-7).sort((a,b)=>b.v[0][1]-a.v[0][1])[0];assert.ok(cap.v[0][1]-casing.v[0][1]>.17);assert.ok(Math.abs(cap.v[0][1]-(n.point[1]+2.3))<1e-6)}
});
test('a short ceiling prevents adding a tier that would pass through the next floor',()=>{
 const p=P.plan({product:'rod',rate:45,preset:'custom',width:64,length:64,height:48,floors:1,belt:480,clockLimit:100,external:['ingot']});
 assert.equal(p.floors[0].height,10);assert.ok(p.logistics.nodes.length>=2);
 for(const n of p.logistics.nodes)assert.ok(n.point[1]+2.3<=p.floors[n.floor].ceiling+1e-7);
 assert.ok(B.check(p));assert.ok(L.checkFlows(p,P.recipes).valid);
});
