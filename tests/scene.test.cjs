const {test}=require('node:test'),assert=require('node:assert/strict');
require('../public/planner.js');require('../public/scene.js');
test('label categories hide independently and selected element overrides all hidden categories',()=>{
const plan=FactoryPlanner.plan({product:'reinforced',rate:15,floors:1,width:48,belt:270,external:['plate','screw']}),texts=[];
const ctx=new Proxy({measureText:s=>({width:s.length*6}),fillText:s=>texts.push(s)},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)}),canvas={getBoundingClientRect:()=>({width:1000,height:600})};
const args={canvas,ctx,plan,angle:0,tilt:.65,zoom:2,selected:null,floor:'all',onHits:()=>{}},hidden={inputs:false,outputs:false,products:false,splitters:false,mergers:false,references:false};
FactoryScene.render({...args,labelOptions:hidden});assert.deepEqual(texts,[]);
FactoryScene.render({...args,labelOptions:{...hidden,inputs:true}});assert.ok(texts.length>0);assert.ok(texts.every(s=>s.includes('ВХОД')));
texts.length=0;FactoryScene.render({...args,labelOptions:{...hidden,outputs:true}});assert.ok(texts.length>0);assert.ok(texts.every(s=>s.includes('ВЫХОД')));
texts.length=0;FactoryScene.render({...args,selected:0,labelOptions:hidden});assert.ok(texts.some(s=>s.includes('#1')));assert.ok(texts.some(s=>s.includes('ВХОД')));assert.ok(texts.some(s=>s.includes('ВЫХОД')));
for(const type of ['splitter','merger']){texts.length=0;const n=plan.logistics.nodes.find(n=>n.type===type);FactoryScene.render({...args,selected:plan.machines.length+n.id,labelOptions:hidden});assert.ok(texts.some(s=>s.includes('ВХОД')));assert.ok(texts.some(s=>s.includes('ВЫХОД')))}
});
test('splitters and mergers have selectable geometry and exact I/O highlight sets',()=>{
const plan=FactoryPlanner.plan({product:'reinforced',rate:15,floors:1,width:48,belt:270,external:['plate','screw']});
const ctx=new Proxy({measureText:s=>({width:s.length*6})},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)}),canvas={getBoundingClientRect:()=>({width:1000,height:600})};
for(const type of ['splitter','merger']){const n=plan.logistics.nodes.find(n=>n.type===type);assert.ok(n);const id=plan.machines.length+n.id,paths=FactoryScene.machinePaths(plan,id);assert.ok(paths.some(v=>v.input));assert.ok(paths.some(v=>!v.input));assert.ok(Math.abs(paths.filter(v=>v.input).reduce((sum,v)=>sum+v.edge.rate,0)-paths.filter(v=>!v.input).reduce((sum,v)=>sum+v.edge.rate,0))<1e-6);
FactoryScene.render({canvas,ctx,plan,angle:0,tilt:.65,zoom:1,selected:id,floor:'all',onHits:()=>{},gpu:{draw(mesh,M,selected,w,h,ids){assert.equal(selected,id);assert.deepEqual(ids,paths.map(v=>-3-v.edge.id));assert.ok(mesh.faces.filter(f=>f.junction===n.id).every(f=>f.id===id))}}});}
});
test('building selection highlights its exact I/O routes and labels without rebuilding the mesh',()=>{
const plan=FactoryPlanner.plan({product:'rod',rate:15,floors:1,preset:'mk3',width:48,belt:270,external:['ingot']});
const paths=FactoryScene.machinePaths(plan,0);assert.equal(paths.length,2);assert.deepEqual(paths.map(v=>[v.edge.item,v.input]).sort(),[['ingot',true],['rod',false]]);
const texts=[],labelRects=[];let arcs=0,mesh,highlighted;
const ctx=new Proxy({measureText:s=>({width:s.length*6}),fillText:s=>texts.push(s),fillRect:(x,y,w,h)=>labelRects.push({x,y,w,h}),arc:()=>arcs++},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)}),canvas={getBoundingClientRect:()=>({width:1000,height:600})};
const args={canvas,ctx,plan,angle:-.65,tilt:.65,zoom:1,selected:null,floor:'all',onHits:()=>{},gpu:{draw(m,M,selected,w,h,ids){mesh=m;highlighted=ids}}};
FactoryScene.render(args);const original=mesh;assert.ok(texts.includes('↓ ВХОД 1'));assert.ok(texts.includes('ВЫХОД ↑'));
texts.length=0;labelRects.length=0;FactoryScene.render({...args,selected:0});assert.equal(mesh,original);assert.deepEqual(highlighted,paths.map(v=>-3-v.edge.id));assert.equal(arcs,4);
assert.ok(texts.includes('↓ ВХОД · Железный слиток'));assert.ok(texts.includes('ВЫХОД · Железный прут ↑'));assert.ok(!texts.includes('↓ ВХОД 1'));for(let i=0;i<labelRects.length;i++)for(let j=i+1;j<labelRects.length;j++){const a=labelRects[i],b=labelRects[j];assert.ok(!(a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y),'I/O labels must not overlap')}
});
test('conveyor picking selects a complete cached route and highlights both endpoints',()=>{
const plan=FactoryPlanner.plan({product:'rod',rate:15,floors:1,preset:'mk3',width:48,belt:270,external:['ingot']});
let mesh,matrix,arcs=0;const lines=[];
const ctx=new Proxy({measureText:s=>({width:s.length*6}),arc:()=>arcs++,lineTo:(x,y)=>lines.push([x,y])},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)}),canvas={getBoundingClientRect:()=>({width:1000,height:600})};
const args={canvas,ctx,plan,angle:-.65,tilt:.65,zoom:2,selected:null,floor:'all',onHits:()=>{},gpu:{draw(m,M){mesh=m;matrix=M}}};
FactoryScene.render(args);const original=mesh;
const project=([x,y,z])=>[(matrix[0]*x+matrix[4]*y+matrix[8]*z+matrix[12]+1)*500,(1-matrix[1]*x-matrix[5]*y-matrix[9]*z-matrix[13])*300];
let picked=null;for(const f of mesh.faces.filter(f=>f.id<=-3&&f.id!==null)){const center=[0,1,2].map(k=>(f.v[0][k]+f.v[1][k]+f.v[2][k])/3),[x,y]=project(center),id=FactoryScene.pick(x,y);if(id!==null&&id<=-3){picked=id;break}}
assert.ok(picked!==null,'visible conveyor must be selectable');
FactoryScene.render({...args,selected:picked});assert.equal(mesh,original,'selection must reuse cached geometry');
const edge=plan.logistics.edges.find(e=>e.id===-3-picked);assert.equal(arcs,2);assert.equal(lines.length,edge.points.length-1);
for(const [i,point] of lines.entries()){const expected=project(edge.points[i+1]);assert.ok(Math.hypot(point[0]-expected[0],point[1]-expected[1])<.001)}
});
test('3D shows only occupied floor guides when three floors are allowed',()=>{
const plan=FactoryPlanner.plan({product:'rod',rate:15,floors:3,preset:'mk3',width:48,belt:270,external:['ingot']}),labels=[];
const ctx=new Proxy({measureText:s=>({width:s.length*6}),fillText:s=>labels.push(s)},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)}),canvas={getBoundingClientRect:()=>({width:1000,height:600})};
FactoryScene.render({canvas,ctx,plan,angle:0,tilt:.65,zoom:1,selected:null,floor:'all',onHits:()=>{}});
assert.deepEqual(labels.filter(s=>s.startsWith('ЭТАЖ ')),['ЭТАЖ 1']);assert.ok(labels.some(s=>s.includes('48×48×48')));
});
test('cached scene renders camera changes without resetting canvas or invalid coordinates',()=>{
let resets=0,drawn=0;const ctx=new Proxy({measureText:s=>({width:s.length*6})},{get:(o,k)=>o[k]||((...args)=>{drawn++;for(const x of args)if(typeof x==='number')assert.ok(Number.isFinite(x))}),set:(o,k,v)=>(o[k]=v,true)});
const canvas={getBoundingClientRect:()=>({width:1000,height:600}),set width(v){resets++;this.w=v},get width(){return this.w},set height(v){resets++;this.h=v},get height(){return this.h}};
const plan=FactoryPlanner.plan({product:'motor',rate:30,floors:3,width:48,belt:270,external:[]});
for(const floor of ['all','0','1','2'])for(const angle of [-.65,0,1.5,3])FactoryScene.render({canvas,ctx,plan,angle,tilt:angle===0?Math.PI/2:.65,zoom:1,selected:null,floor,onHits:h=>assert.ok(h.length)});
assert.equal(resets,2);assert.ok(drawn>0);
});
test('3D draws exactly the calculated junctions and filters them by product',()=>{
const plan=FactoryPlanner.plan({product:'reinforced',rate:15,floors:1,width:48,belt:270,external:['plate','screw']});
const ctx=new Proxy({measureText:s=>({width:s.length*6})},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)}),canvas={getBoundingClientRect:()=>({width:1000,height:600})};
for(const flow of ['all','plate','screw','reinforced'])FactoryScene.render({canvas,ctx,plan,flow,angle:0,tilt:.65,zoom:1,selected:null,floor:'all',onHits:()=>{},gpu:{draw(mesh){const shown=new Set(mesh.faces.filter(f=>f.junction!==null).map(f=>f.junction));const expected=plan.logistics.nodes.filter(n=>flow==='all'||n.item===flow).map(n=>n.id);assert.deepEqual([...shown].sort((a,b)=>a-b),expected);for(const id of expected){const points=mesh.faces.filter(f=>f.junction===id).flatMap(f=>f.v);for(const [axis,size] of [[0,4],[1,3],[2,4]])assert.ok(Math.abs(Math.max(...points.map(v=>v[axis]))-Math.min(...points.map(v=>v[axis]))-size)<1e-6)}}}});
});
test('GPU camera matrix agrees with screen projection and nearest-surface picking',()=>{
const plan=FactoryPlanner.plan({product:'rod',rate:15,floors:1,width:48,belt:270,external:[]});
const ctx=new Proxy({measureText:s=>({width:s.length*6})},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)}),canvas={getBoundingClientRect:()=>({width:1000,height:600})};
for(const angle of [-.65,0,1.5,3])for(const tilt of [.1,.65,1.2,1.54]){
const zoom=2,panX=20,panY=-30;
FactoryScene.render({canvas,ctx,plan,angle,tilt,zoom,panX,panY,selected:null,floor:'all',onHits:()=>{},gpu:{draw(mesh,M){
const scale=Math.min(900/(plan.width+plan.length+20)*1.3,475/(plan.length*.65+plan.floors[0].height))*zoom,actualRange=Math.max(1,...mesh.faces.flatMap(f=>f.v.map(([X,Y,Z])=>Math.abs(-((X-plan.width/2)*Math.sin(angle)+(Z-plan.length/2)*Math.cos(angle))*Math.sin(tilt)-Y*Math.cos(tilt)))))+2;
const range=mesh.depthRange.value;assert.ok(range>=actualRange-1e-6);
// Screen axes and the depth axis must be perpendicular. Otherwise rear walls
// can win the depth test against roofs at shallow viewing angles.
const right=[M[0],M[4],M[8]],up=[M[1],M[5],M[9]],depth=[M[2],M[6],M[10]];
const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
assert.ok(Math.abs(dot(right,depth))<1e-9);
assert.ok(Math.abs(dot(up,depth))<1e-9);
for(const f of mesh.faces.slice(0,30))for(const [X,Y,Z] of f.v){const x=X-plan.width/2,z=Z-plan.length/2,a=x*Math.cos(angle)-z*Math.sin(angle),b=x*Math.sin(angle)+z*Math.cos(angle);const cx=M[0]*X+M[4]*Y+M[8]*Z+M[12],cy=M[1]*X+M[5]*Y+M[9]*Z+M[13],cz=M[2]*X+M[6]*Y+M[10]*Z+M[14];assert.ok(Math.abs((cx+1)*500-(500+panX+a*scale))<.001);assert.ok(Math.abs((1-cy)*300-(390+panY+(b*Math.cos(tilt)-Y*Math.sin(tilt))*scale))<.001);assert.ok(Math.abs(cz-(-b*Math.sin(tilt)-Y*Math.cos(tilt))/range)<.00001)}
}}});
}
// Looking straight down, the roof is nearer than the floor beneath it.
const machine=plan.machines[0],scale=Math.min(900/(plan.width+plan.length+20)*1.3,475/(plan.length*.65+plan.floors[0].height));
FactoryScene.render({canvas,ctx,plan,angle:0,tilt:0,zoom:1,selected:null,floor:'all',onHits:()=>{}});
assert.equal(FactoryScene.pick(500+(machine.x+machine.w/2-plan.width/2)*scale,390+(machine.z+machine.d/2-plan.length/2)*scale),machine.id);
});

test('isolated floors clip transport geometry and engineering simulation draws moving line markers',()=>{
 require('../public/simulation.js');const p=FactoryPlanner.plan({product:'frame',rate:2,width:48,floors:2,belt:270,external:[]}),simulation=FactorySimulation.create([p]);simulation.advance(20);
 const ctx=new Proxy({measureText:()=>({width:10})},{get:(o,k)=>o[k]||(()=>{})}),canvas={getBoundingClientRect:()=>({width:1000,height:700})};let mesh,particles;
 const args={canvas,ctx,plan:p,angle:0,tilt:.65,zoom:1,selected:null,floor:'1',viewStyle:'engineering',simulation,onHits(){},gpu:{draw(m,M,s,w,h,ids,ps){mesh=m;particles=ps}}};
 FactoryScene.render(args);const low=p.floors[1].y;assert.ok(mesh.faces.filter(f=>f.id<=-3).length);for(const f of mesh.faces.filter(f=>f.id<=-3))for(const v of f.v)assert.ok(v[1]>=low-1e-7);
 FactoryScene.render({...args,floor:'all'});assert.ok(particles.length>0);assert.equal(mesh.floorOpacity,.2);
});


test('3D renders plans with edge geometry even when cached routes are absent',()=>{
 const plan=FactoryPlanner.plan({product:'plate',rate:20,floors:1,width:64,belt:270,external:[]});delete plan.logistics.routes;delete plan.logistics.liftPositions;
 const ctx=new Proxy({measureText:s=>({width:s.length*6})},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)}),canvas={getBoundingClientRect:()=>({width:1000,height:600})};
 assert.doesNotThrow(()=>FactoryScene.render({canvas,ctx,plan,angle:0,tilt:.65,zoom:1,selected:null,floor:'all',onHits:()=>{}}));
});
