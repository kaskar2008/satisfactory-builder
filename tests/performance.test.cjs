const {test}=require('node:test'),assert=require('node:assert/strict');
global.FactoryLogistics=require('../public/logistics.js');global.FactoryPlanner=require('../public/planner.js');require('../public/scene.js');const {fixture}=require('../benchmarks/performance-benchmark.js');
const B=require('../public/bounded.js');
test('dimension and volume budgets reject the first failing cube while preserving game presets',()=>{
 assert.doesNotThrow(()=>B.checkPerformanceConfig({width:112,length:112,height:112}));
 assert.throws(()=>B.checkPerformanceConfig({width:120,length:120,height:120}),e=>e.code==='performance-limit');
 assert.throws(()=>B.checkPerformanceConfig({width:136,length:16,height:16}),e=>e.code==='performance-limit');
 assert.doesNotThrow(()=>B.checkPerformanceConfig({width:128,length:128,height:84}));
 for(const preset of ['mk1','mk2','mk3'])assert.doesNotThrow(()=>B.checkPerformanceConfig({preset,width:256,length:256,height:256}));
 assert.doesNotThrow(()=>B.checkPerformanceConfig({width:32,length:32,height:128}));
});
test('complexity includes every simulated module and detailed belt turns',()=>{
 assert.doesNotThrow(()=>B.checkPerformanceLoad([fixture(112,112,112)]));assert.throws(()=>B.checkPerformanceLoad([fixture(120,120,120)]),e=>e.code==='performance-limit');
 assert.throws(()=>B.checkPerformanceLoad(Array(8).fill(fixture(64,64,48))),e=>e.code==='performance-limit');
 const p=fixture(32,32,32),original=B.performanceLoad([p]).triangles;p.logistics.edges[0].points=Array.from({length:2000},(_,i)=>[Math.ceil(i/2),5,Math.floor(i/2)]);assert.ok(B.performanceLoad([p]).triangles>original);assert.throws(()=>B.checkPerformanceLoad([p]),e=>e.code==='performance-limit');
});
test('preflight counts machines without routing or changing planner state',()=>{
 const p=FactoryPlanner.estimate({product:'frame',rate:10,preset:'mk3',floors:'auto',belt:480,clockLimit:250,external:[]});assert.ok(p.machines.length);assert.equal(p.logistics,undefined);
 assert.throws(()=>FactoryPlanner.estimate({product:'rod',rate:10000,width:48,length:48,height:48,floors:1,belt:1200,clockLimit:250,external:['ingot']}),e=>e.code==='performance-limit');
});
test('frame check accepts 60 Hz and 120 Hz but rejects sustained drops and stutters',()=>{
 assert.ok(B.framePerformance(Array(180).fill(1000/60)).stable);assert.ok(B.framePerformance(Array(360).fill(1000/120)).stable);assert.ok(!B.framePerformance(Array(150).fill(20)).stable);assert.ok(!B.framePerformance([...Array(90).fill(8.33),...Array(10).fill(33.33)]).stable);assert.equal(B.framePerformance([]).fps,0);
});
test('dense realistic scene does not spread hundreds of thousands of vertices into a function call',()=>{
 const p=fixture(96,96,48),ctx=new Proxy({measureText:s=>({width:s.length*6})},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)}),canvas={getBoundingClientRect:()=>({width:1500,height:780})};let cached;
 for(const angle of [.3,1.1])FactoryScene.render({canvas,ctx,plan:p,angle,tilt:.6,zoom:1,selected:null,floor:'all',viewStyle:'realistic',onHits(){},gpu:{draw(mesh){assert.ok(mesh.faces.length*4>100000);assert.ok(Number.isFinite(mesh.depthRange.value));assert.ok(mesh.depthRange.value>0);if(cached)assert.equal(mesh.spatialBounds,cached);cached=mesh.spatialBounds;for(const f of mesh.faces)for(const v of f.v)for(let k=0;k<3;k++)assert.ok(v[k]>=cached[0][k]&&v[k]<=cached[1][k])}}});
});
