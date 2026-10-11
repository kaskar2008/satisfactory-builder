const {test}=require('node:test'),assert=require('node:assert/strict'),P=require('../public/planner.js'),L=require('../public/logistics.js'),B=require('../public/bounded.js');
test('stacked oscillator routes reuse horizontal corridors and preserve construction clearance',()=>{
const p=P.plan({product:'oscillator',rate:1,preset:'custom',width:64,length:64,height:48,floors:3,belt:270,external:[]});
assert.ok(['stacked','spatial'].includes(p.logistics.routing));assert.equal(p.fit.usedFloors,1);assert.ok(B.check(p));
const segments=p.logistics.edges.flatMap(e=>e.points.slice(1).map((b,i)=>({a:e.points[i],b,item:e.item,axis:e.points[i].findIndex((v,k)=>Math.abs(v-b[k])>1e-7)})));
const horizontal=segments.reduce((sum,{a,b})=>sum+Math.hypot(a[0]-b[0],a[2]-b[2]),0),vertical=segments.reduce((sum,{a,b})=>sum+Math.abs(a[1]-b[1]),0);
// Previous two-floor routing used 702.62 m horizontally and 237 m vertically.
assert.ok(horizontal+vertical<939.62);assert.ok(horizontal+vertical*1.2<702.62+237*1.2);assert.ok(L.checkBeltCollisions(p.logistics).valid);
let stacked=false;
for(let i=0;i<segments.length;i++)for(let j=i+1;j<segments.length;j++){const a=segments[i],b=segments[j];assert.ok(!L.segmentsConflict(a.a,a.b,b.a,b.b));if(a.axis!==b.axis||a.axis===1||a.item===b.item||Math.abs(a.a[1]-b.a[1])<1.4)continue;const k=a.axis===0?2:0;if(Math.abs(a.a[k]-b.a[k])<=1&&Math.min(Math.max(a.a[a.axis],a.b[a.axis]),Math.max(b.a[b.axis],b.b[b.axis]))-Math.max(Math.min(a.a[a.axis],a.b[a.axis]),Math.min(b.a[b.axis],b.b[b.axis]))>2)stacked=true}
assert.ok(stacked,'Different products must reuse a corridor at separate heights');
for(const {a,b,axis} of segments)for(const m of p.machines){const lo=[m.x,m.y,m.z],hi=[m.x+m.w,m.y+m.h,m.z+m.d];assert.ok(![0,1,2].every(i=>i===axis?Math.min(Math.max(a[i],b[i]),hi[i])-Math.max(Math.min(a[i],b[i]),lo[i])>1e-6:a[i]>lo[i]+1e-6&&a[i]<hi[i]-1e-6),'Belt or lift passes through a machine')}
assert.equal(p.logistics.issues.length,0);
});
