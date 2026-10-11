const {test}=require('node:test'),assert=require('node:assert/strict'),P=require('../public/planner.js'),S=require('../public/project-store.js');
const config={product:'rod',rate:15,preset:'mk3',width:48,length:48,height:48,floors:3,belt:270,external:['ingot']};
test('snapshot restores all render geometry and shared references without invoking the planner',()=>{
 const p=P.plan(config),snapshot=S.encode(config,[p]);
 assert.equal(snapshot.modules[0].logistics.routes,undefined);assert.equal(typeof snapshot.modules[0].groups[0].machines[0],'number');
 const original=P.plan;P.plan=()=>{throw Error('Must not regenerate')};try{const q=S.decode(JSON.parse(JSON.stringify(snapshot))).modules[0];
 assert.deepEqual(q.machines,p.machines);assert.deepEqual(q.logistics.edges,p.logistics.edges);assert.deepEqual(q.logistics.nodes,p.logistics.nodes);assert.deepEqual(q.floors,p.floors);
 assert.equal(q.groups[0].machines[0],q.machines[0]);assert.equal(q.logistics.routes[0],q.logistics.edges[0].points);assert.ok(q.logistics.flowCheck.valid);
 }finally{P.plan=original}
 assert.ok(JSON.stringify(snapshot).length<JSON.stringify({config,modules:[p]}).length);
});
test('multiple modules restore their production links and remain independent',()=>{
 const a=P.plan(config),b=structuredClone(a),proposal={kind:'parallel',description:'Два модуля',links:[],modules:[a,b]},restored=S.decode(S.encode({...config,rate:30},[a,b],proposal));
 assert.equal(restored.proposal.kind,'parallel');assert.equal(restored.proposal.modules,restored.modules);assert.equal(restored.modules.length,2);assert.notEqual(restored.modules[0].machines[0],restored.modules[1].machines[0]);assert.equal(restored.config.rate,30);
});
test('invalid versions and damaged geometry are rejected rather than silently recalculated',()=>{
 assert.throws(()=>S.decode({version:999,modules:[]}));const data=S.encode(config,[P.plan(config)]);data.modules[0].logistics.edges[0].points[0]=[999,999,999];assert.throws(()=>S.decode(data));
});
