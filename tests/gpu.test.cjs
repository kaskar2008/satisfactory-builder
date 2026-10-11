const {test}=require('node:test'),assert=require('node:assert/strict');require('../public/gpu.js');
test('floor guides cannot write depth; equipment retains depth testing',()=>{
let depth=true,write=true;const draws=[];
const gl=new Proxy({DEPTH_TEST:1,COMPILE_STATUS:2,LINK_STATUS:3,createShader:()=>({}),createProgram:()=>({}),createBuffer:()=>({}),getShaderParameter:()=>true,getProgramParameter:()=>true,getAttribLocation:()=>0,getUniformLocation:()=>0,enable:k=>{if(k===1)depth=true},disable:k=>{if(k===1)depth=false},depthMask:v=>{write=v},drawArrays:(mode,start,count)=>draws.push({start,count,depth,write})},{get:(o,k)=>o[k]??(()=>{})});
const canvas={getContext:()=>gl},gpu=FactoryGPU.create(canvas),v=[[0,0,0],[1,0,0],[1,0,1],[0,0,1]];
gpu.draw({faces:[{v,color:'#ffffff',id:0},{v,color:'#444444',backdrop:true}]},new Float32Array(16),null,800,600);
assert.deepEqual(draws,[{start:0,count:6,depth:false,write:false},{start:6,count:6,depth:true,write:true}]);
});

test('particle animation reuses GPU storage across frames after its capacity grows',()=>{
 const allocations=[],updates=[];const gl=new Proxy({getShaderParameter:()=>true,getProgramParameter:()=>true,getAttribLocation:()=>0,bufferData:(target,data)=>allocations.push(data),bufferSubData:(target,offset,data)=>updates.push(Array.from(data))},{get:(o,k)=>o[k]??(()=>{})});const gpu=FactoryGPU.create({getContext:()=>gl}),mesh={faces:[]},v=[[0,0,0],[1,0,0],[1,0,1],[0,0,1]],particles=[{v,color:'#73dcff',id:-3}];
 gpu.draw(mesh,new Float32Array(16),null,800,600,[],particles);gpu.draw(mesh,new Float32Array(16),null,800,600,[],particles);
 assert.equal(allocations.filter(v=>typeof v==='number').length,1);assert.equal(updates.length,2);assert.equal(updates[0].length,42);assert.deepEqual(updates[0],updates[1]);
});
