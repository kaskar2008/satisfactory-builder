const {test}=require('node:test'),assert=require('node:assert/strict');
require('../public/planner.js');require('../public/scene.js');

test('low-poly machines fit their planned envelopes and retain selection IDs',()=>{
 for(const [b,building] of Object.entries(FactoryPlanner.buildings)){
  const m={...building,x:3,z:5,b,id:7},vertices=[];let count=0;
  FactoryModels.machine(m,10,{face(v,c,id){count++;assert.equal(id,7);vertices.push(...v)},box(x,y,z,w,h,d,c,id){assert.equal(id,7);count+=6;vertices.push([x,y,z],[x+w,y+h,z+d])}});
  assert.ok(count>100&&count<600,b+' must have bounded static detail');
  for(const v of vertices){assert.ok(v.every(Number.isFinite));assert.ok(v[0]>=m.x-1e-6&&v[0]<=m.x+m.w+1e-6,b+' width');assert.ok(v[1]>=10-1e-6&&v[1]<=10+m.h+1e-6,b+' height');assert.ok(v[2]>=m.z-1e-6&&v[2]<=m.z+m.d+1e-6,b+' depth')}
 }
});
test('switching styles preserves route topology, picking, selection and separate cached meshes',()=>{
 const plan=FactoryPlanner.plan({product:'reinforced',rate:15,floors:1,width:48,belt:270,external:['plate','screw']}),original=JSON.stringify(plan.logistics);
 const ctx=new Proxy({measureText:s=>({width:s.length*6})},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)}),canvas={getBoundingClientRect:()=>({width:1000,height:700})};
 let mesh,paths;const args={canvas,ctx,plan,angle:-.65,tilt:.65,zoom:1,selected:null,floor:'all',onHits(){},gpu:{draw(m,M,s,w,h,ids){mesh=m;paths=ids}}};
 FactoryScene.render(args);const engineering=mesh;
 FactoryScene.render({...args,viewStyle:'realistic'});const realistic=mesh;assert.notEqual(realistic,engineering);assert.ok(realistic.faces.length>engineering.faces.length);
 for(const n of plan.logistics.nodes){const id=plan.machines.length+n.id;assert.ok(realistic.faces.some(f=>f.id===id));FactoryScene.render({...args,viewStyle:'realistic',selected:id,angle:1});assert.equal(mesh,realistic);assert.deepEqual(paths,FactoryScene.machinePaths(plan,id).map(v=>-3-v.edge.id))}
 FactoryScene.render({...args,viewStyle:'engineering',selected:0});assert.equal(mesh,engineering);assert.equal(JSON.stringify(plan.logistics),original);
});

test('detailed junction shells and roof markings stay inside the stackable 4 by 4 by 3 metre envelope',()=>{
 const p=FactoryPlanner.plan({product:'reinforced',rate:15,floors:1,width:48,belt:270,external:['plate','screw']});
 for(const n of p.logistics.nodes){const vertices=[],y=n.point[1];
  FactoryModels.junction(n,y,{face(v){vertices.push(...v)},box(x,y,z,w,h,d){vertices.push([x,y,z],[x+w,y+h,z+d])}});
  for(const [x,Y,z] of vertices){assert.ok([x,Y,z].every(Number.isFinite));assert.ok(Math.abs(x-n.point[0])<=2+1e-6);assert.ok(Math.abs(z-n.point[2])<=2+1e-6);assert.ok(Y>=y-.7-1e-6&&Y<=y+2.3+1e-6)}
 }
});

test('low-poly corners use curved decks and rails while preserving the planned graph',()=>{
 const plan=FactoryPlanner.plan({product:'reinforced',rate:15,floors:1,width:48,belt:270,external:['plate','screw']}),original=JSON.stringify(plan.logistics);
 const ctx=new Proxy({measureText:s=>({width:s.length*6})},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)}),canvas={getBoundingClientRect:()=>({width:1000,height:700})};let mesh;
 FactoryScene.render({canvas,ctx,plan,viewStyle:'realistic',angle:.4,tilt:.5,zoom:1,selected:null,floor:'all',onHits(){},gpu:{draw(m){mesh=m}}});
 const curves=mesh.faces.filter(f=>f.id<=-3&&f.v.some((v,i)=>{const next=f.v[(i+1)%4];return Math.abs(v[0]-next[0])>1e-4&&Math.abs(v[2]-next[2])>1e-4}));
 assert.ok(curves.length>20);assert.equal(JSON.stringify(plan.logistics),original);
 const keys=new Set();for(const f of mesh.faces.filter(f=>!f.backdrop)){const key=f.id+':'+f.v.map(v=>v.map(n=>Math.round(n*1e6)).join(',')).sort().join(';');assert.ok(!keys.has(key),'coincident faces');keys.add(key)}
});

test('fluid animation wraps pipes while solid items remain conveyor cubes',()=>{
 const plan=FactoryPlanner.plan({product:'ingot',rate:30,floors:1,width:48,belt:60,external:[]});
 const ctx=new Proxy({measureText:s=>({width:s.length*6})},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)}),canvas={getBoundingClientRect:()=>({width:1000,height:700})};
 for(const direction of [[1,0,0],[0,1,0],[0,0,1]]){
  let faces;const simulation={modules:[{machines:[]}],setPath(){},particles(){return [{item:'ingot',edgeId:0,point:[10,5,10],fluid:true,direction},{item:'ingot',edgeId:1,point:[20,5,20],fluid:false}]}};
  FactoryScene.render({canvas,ctx,plan,simulation,viewStyle:'realistic',moduleIndex:0,angle:.4,tilt:.5,zoom:1,selected:null,floor:'all',flow:'all',onHits(){},gpu:{draw(m,M,s,w,h,ids,particles){faces=particles}}});
  const bands=faces.filter(f=>f.id===-3),cargo=faces.filter(f=>f.id===-4);assert.equal(bands.length,8);assert.equal(cargo.length,6);
  const axis=direction.indexOf(1);for(const face of bands)for(const v of face.v){assert.ok(v.every(Number.isFinite));assert.ok(Math.abs(Math.abs(v[axis]-[10,5,10][axis])-.12)<1e-8)}
 }
});

test('pipe junctions render only connected arms: three form a tee, four form a cross',()=>{
 const ctx=new Proxy({measureText:()=>({width:10})},{get:(o,k)=>o[k]||(()=>{})}),canvas={getBoundingClientRect:()=>({width:1000,height:700})};
 for(const rate of [40,60])for(const viewStyle of ['realistic','engineering'])for(const type of ['splitter','merger']){
  const p=FactoryPlanner.plan({product:'plastic',rate,floors:1,width:64,belt:270,pipeCapacity:300,clockLimit:100});
  const n=p.logistics.nodes.find(n=>n.transport==='pipe'),connected=new Set(p.logistics.edges.flatMap(e=>[e.from,e.to]));
  const ports=[n.ports.input,...n.ports.outputs];if(type==='merger'){n.type='merger';n.ports={inputs:n.ports.outputs,output:n.ports.input};for(const e of p.logistics.edges){[e.from,e.to]=[e.to,e.from];e.points=[...e.points].reverse()}}assert.equal(ports.filter(port=>connected.has(port)).length,rate===40?3:4);
  let mesh;FactoryScene.render({canvas,ctx,plan:p,viewStyle,angle:0,tilt:.65,zoom:1,selected:null,floor:'all',onHits(){},gpu:{draw(m){mesh=m}}});
  const vertices=mesh.faces.filter(f=>f.junction===n.id).flatMap(f=>f.v);
  for(const port of ports){const axis=port.dir.findIndex(v=>v!==0),sign=port.dir[axis];const extent=Math.max(...vertices.map(v=>(v[axis]-n.point[axis])*sign));assert.ok(connected.has(port)?extent>=1.9:extent<1,'unused arm must not be rendered');}
 }
});

test('realistic pipes have continuous rounded bends and fluid follows the same path',()=>{
 const p=FactoryPlanner.plan({product:'aluminumScrap',rate:90,width:64,floors:2,belt:270,pipeCapacity:300});
 const ctx=new Proxy({measureText:()=>({width:10})},{get:(o,k)=>o[k]||(()=>{})}),canvas={getBoundingClientRect:()=>({width:1000,height:700})};let mesh;
 FactoryScene.render({canvas,ctx,plan:p,viewStyle:'realistic',angle:0,tilt:.65,zoom:1,selected:null,floor:'all',onHits(){},gpu:{draw(m){mesh=m}}});
 let rounded=0,vertical=0;for(const e of p.logistics.edges.filter(e=>e.kind==='pipe')){
  const colors=new Set(mesh.faces.filter(f=>f.id===-3-e.id).map(f=>f.color));assert.ok(colors.size>=4,'pipe facets must retain directional shading');const path=mesh.travelPaths[e.id];assert.ok(path);assert.deepEqual(path[0],e.points[0]);assert.deepEqual(path.at(-1),e.points.at(-1));
  for(let i=1;i<path.length;i++){const delta=path[i].map((n,k)=>n-path[i-1][k]);assert.ok(delta.every(Number.isFinite));if(delta.filter(n=>Math.abs(n)>1e-6).length>1){rounded++;if(Math.abs(delta[1])>1e-6)vertical++}}
 }
 assert.ok(rounded>0);assert.ok(vertical>0);
});
