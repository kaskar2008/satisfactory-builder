const {test}=require('node:test'),assert=require('node:assert/strict'),P=require('../public/planner.js'),L=require('../public/logistics.js'),B=require('../public/bounded.js');require('../public/scene.js');
test('all four machine headings rotate asymmetric footprints and every recipe port together',()=>{
 for(const [b,building] of Object.entries(P.buildings))for(const rotation of [0,90,180,270]){
  const group=Object.keys(P.recipes).find(k=>P.recipes[k].b===b),m={...building,id:0,b,group,x:6,z:8,floor:0,clock:1,rotation,w:rotation%180?building.d:building.w,d:rotation%180?building.w:building.d},p={floors:[{y:0}]},ports=L.machinePorts(p,m,P.recipes);
  assert.deepEqual(ports.output.dir,L.rotateDirection([0,0,1],rotation));
  for(const port of [...ports.inputs,ports.output]){assert.ok(port.point[0]>=m.x&&port.point[0]<=m.x+m.w);assert.ok(port.point[2]>=m.z&&port.point[2]<=m.z+m.d);const outside=port.point.map((v,k)=>v+port.dir[k]);assert.ok(outside[0]<m.x||outside[0]>m.x+m.w||outside[2]<m.z||outside[2]>m.z+m.d)}
  const vertices=[];FactoryModels.machine(m,0,{face(v){vertices.push(...v)},box(x,y,z,w,h,d){vertices.push([x,y,z],[x+w,y+h,z+d])}});
  for(const v of vertices){assert.ok(v[0]>=m.x-1e-6&&v[0]<=m.x+m.w+1e-6);assert.ok(v[2]>=m.z-1e-6&&v[2]<=m.z+m.d+1e-6)}
 }
});
test('a quarter turn fits an assembler in a shallow module with complete input and output routes',()=>{
 const p=P.plan({product:'reinforced',rate:1,preset:'custom',width:40,length:24,height:16,floors:1,belt:270,external:['plate','screw']});
 assert.equal(p.machines[0].rotation,90);assert.equal(p.machines[0].w,15);assert.equal(p.machines[0].d,10);assert.ok(B.check(p));assert.ok(L.checkFlows(p,P.recipes).valid);
 assert.equal(FactoryScene.machinePaths(p,0).length,3);
 const ctx=new Proxy({measureText:s=>({width:s.length*6})},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)}),canvas={getBoundingClientRect:()=>({width:1000,height:700})};
 for(const viewStyle of ['engineering','realistic']){let mesh;FactoryScene.render({canvas,ctx,plan:p,angle:.5,tilt:.6,zoom:1,selected:0,floor:'all',viewStyle,onHits(){},gpu:{draw(m){mesh=m}}});assert.ok(mesh.faces.some(f=>f.id===0));assert.ok(mesh.labels.filter(l=>l.id===0&&l.io).every(l=>l.v[0]>=p.machines[0].x-.9&&l.v[0]<=p.machines[0].x+p.machines[0].w+.9))}
});
test('rotating junctions preserves independent ports, flows and the square stackable footprint',()=>{
 const p=P.plan({product:'steel',rate:240,preset:'custom',width:64,length:64,height:32,floors:1,belt:480,clockLimit:200,external:[]});
 for(const m of p.machines){m.rotation=90;[m.w,m.d]=[m.d,m.w]}p.config.allowRotations=true;p.logistics=L.calculate(p,P.recipes);
 assert.ok(p.logistics.nodes.some(n=>n.rotation!==0));assert.ok(B.check(p));assert.ok(L.checkFlows(p,P.recipes).valid);
 for(const n of p.logistics.nodes){assert.ok([0,90,180,270].includes(n.rotation));const ports=Object.values(n.ports).flat();assert.equal(new Set(ports.map(v=>v.point.join(':'))).size,4);for(const port of ports)assert.equal(Math.abs(port.point[0]-n.point[0])+Math.abs(port.point[2]-n.point[2]),2)}
});
