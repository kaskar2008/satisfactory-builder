const {test}=require('node:test'),assert=require('node:assert/strict'),P=require('../public/planner.js'),S=require('../public/project-store.js'),L=require('../public/logistics.js');
globalThis.FactoryBounded=require('../public/bounded.js');globalThis.FactoryLogistics=L;globalThis.FactoryPlanner=P;
const config={product:'plate',rate:90,preset:'mk3',width:48,length:48,height:48,floors:3,belt:480,clockLimit:250,external:[]};
test('every routed layout stays available and ranks from the cheapest',()=>{
 const p=P.plan(config),all=[p,...p.fit.alternatives];
 assert.equal(all.length,p.fit.optimization.validLayouts);assert.ok(all.length>=2);
 all.forEach((q,i)=>{assert.equal(q.fit.optimization.rank,i);assert.ok(q.logistics.flowCheck.valid);assert.equal(q.fit.alternatives===undefined||q===p,true)});
 for(let i=1;i<all.length;i++)assert.ok(L.compareConstruction([all[i-1]],[all[i]])<=0);
});
test('saved alternatives stay compact, survive a round trip and decode on demand',()=>{
 const p=P.plan(config),snapshot=JSON.parse(JSON.stringify(S.encode(config,[p]))),saved=snapshot.modules[0].fit.alternatives;
 assert.equal(saved.length,p.fit.alternatives.length);assert.equal(saved[0].fit.alternatives,undefined);assert.equal(saved[0].logistics.routes,undefined);
 const restored=S.decode(snapshot).modules[0];assert.equal(restored.fit.alternatives.length,saved.length);
 const next=S.materialize(restored.fit.alternatives[0]);assert.ok(next.logistics.flowCheck.valid);assert.equal(next.fit.optimization.rank,1);assert.equal(S.materialize(next),next);
 // A re-save keeps untouched alternatives in their saved form.
 assert.deepEqual(S.encode(config,[restored]).modules[0].fit.alternatives,saved);
});
