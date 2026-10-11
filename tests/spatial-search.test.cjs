const {test}=require('node:test'),assert=require('node:assert/strict'),L=require('../public/logistics.js');
test('3D A* changes height mid-route when no single routing plane connects the ports',()=>{
const boxes=[{lo:[6,0,0],hi:[8,9,10]},{lo:[12,8,0],hi:[14,20,10]}];
const r=L.search3D({start:[2,5.2,5],end:[18,5.2,5],bounds:{width:20,height:20,length:10},boxes,maxExpanded:10000});
assert.ok(r.path);assert.equal(r.limited,false);assert.ok(Math.abs(r.cost-26.4)<1e-6);
assert.ok(r.path.some(p=>p[0]===8&&p[1]>9));assert.ok(r.path.some(p=>p[0]>=12&&p[1]<8));
for(let i=1;i<r.path.length;i++){const a=r.path[i-1],b=r.path[i],axis=a.findIndex((v,k)=>Math.abs(v-b[k])>1e-7);assert.equal(a.filter((v,k)=>Math.abs(v-b[k])>1e-7).length,1);if(axis===1)assert.ok(Math.abs(a[1]-b[1])>=4-1e-6);for(const box of boxes)assert.ok(![0,1,2].every(k=>k===axis?Math.min(Math.max(a[k],b[k]),box.hi[k])-Math.max(Math.min(a[k],b[k]),box.lo[k])>1e-7:a[k]>box.lo[k]+1e-7&&a[k]<box.hi[k]-1e-7))}
});
test('3D search returns the direct shortest route in empty space',()=>{const r=L.search3D({start:[2,5.2,5],end:[18,5.2,5],bounds:{width:20,height:20,length:10}});assert.deepEqual(r.path,[[2,5.2,5],[18,5.2,5]]);assert.equal(r.cost,16)});
test('exhausted search budget is explicit and is not reported as an optimum',()=>{const r=L.search3D({start:[2,5.2,5],end:[18,5.2,5],bounds:{width:20,height:20,length:10},maxExpanded:1});assert.equal(r.path,null);assert.equal(r.limited,true);assert.equal(r.expanded,1)});
