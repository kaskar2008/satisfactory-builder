const {test}=require('node:test'),assert=require('node:assert/strict'),P=require('../public/planner.js'),L=require('../public/logistics.js');
test('splitters conserve full input and redistribute a saturated output instead of losing throughput',()=>{
 assert.deepEqual(L.splitterRates(120,[270,270]),[60,60]);
 assert.deepEqual(L.splitterRates(120,[270,270,270]),[40,40,40]);
 assert.deepEqual(L.splitterRates(180,[60,270]),[60,120]);
 assert.deepEqual(L.splitterRates(270,[60,60]),[60,60]);
});
test('unequal splitter branches are explicitly marked as requiring buffer fill for steady production',()=>{
 const p=P.plan({product:'ingot',rate:150,width:128,floors:1,belt:270,clockLimit:100,external:[]}),flows=p.logistics.flowCheck.splitterDistribution;
 const unequal=flows.find(n=>n.requiresBackpressure);assert.ok(unequal);
 assert.equal(unequal.branches.reduce((s,b)=>s+b.startupRate,0),unequal.inputRate);
 assert.equal(unequal.branches.reduce((s,b)=>s+b.steadyRate,0),unequal.inputRate);
 assert.ok(unequal.branches.some(b=>b.startupRate<b.steadyRate));assert.equal(p.logistics.flowCheck.exports.ingot,150);
});
test('construction selection trades extra junctions against saved belts but always prioritizes fewer modules',()=>{
 const fixture=(length,nodes,lifts=0)=>({machines:[{}],logistics:{nodes:Array.from({length:nodes},()=>({type:'splitter'})),lifts,routingMetrics:{horizontalLength:length,verticalLength:0}}});
 const simple=fixture(100,1),needless=fixture(98,2),shorter=fixture(60,2),lifted=fixture(99,1,1);
 assert.ok(L.compareConstruction([simple],[needless])<0);assert.ok(L.compareConstruction([shorter],[simple])<0);assert.ok(L.compareConstruction([simple],[lifted])<0);
 assert.ok(L.compareConstruction([fixture(1000,10)],[fixture(1,0),fixture(1,0)])<0);
});

test('equal consumers use balanced splitter trees without waiting for upstream buffers to fill',()=>{
 for(const count of [4,6,9]){const p=P.plan({product:'ingot',rate:count*30,width:256,floors:1,belt:480,external:[]});
 assert.ok(p.logistics.flowCheck.splitterDistribution.every(n=>!n.requiresBackpressure));}
});

test('layout selection favours demand-matched supply before belt savings, preserving module priority',()=>{
 const fixture=(length,steady)=>({machines:[],logistics:{nodes:[],routingMetrics:{horizontalLength:length,verticalLength:0},flowCheck:{splitterDistribution:[{inputRate:100,branches:steady.map(rate=>({steadyRate:rate,startupRate:50}))}]}}});
 const balanced=fixture(200,[50,50]),hungry=fixture(100,[25,75]);assert.ok(L.compareConstruction([balanced],[hungry])<0);assert.ok(L.compareConstruction([hungry],[balanced,balanced])<0);
});
test('bounded planning compares multiple valid layouts without adding floors just to shorten belts',()=>{
 const p=P.plan({product:'plate',rate:90,preset:'mk3',width:48,length:48,height:48,floors:3,belt:480,clockLimit:250,external:[]});
 assert.equal(p.fit.usedFloors,1);assert.ok(p.fit.optimization.validLayouts>=2);assert.ok(p.fit.optimization.validLayouts<=3);assert.deepEqual(p.fit.optimization.cost,L.constructionCost([p]));
});
test('common external supply stays on one trunk when it fits the belt capacity',()=>{
 const p=P.plan({product:'steel',rate:240,preset:'custom',width:64,length:64,height:24,floors:1,belt:480,clockLimit:200,external:[]});
 assert.equal(p.machines.length,3);const inputs=p.logistics.edges.filter(e=>e.item==='ore'&&e.from.kind==='import');assert.equal(inputs.length,1);assert.equal(inputs[0].rate,240);assert.equal(p.logistics.nodes.filter(n=>n.item==='ore'&&n.type==='splitter').length,1);assert.ok(L.checkFlows(p,P.recipes).valid);
});
test('external trunks remain separate when the combined supply exceeds belt capacity',()=>{
 const p=P.plan({product:'steel',rate:120,preset:'custom',width:64,length:64,height:24,floors:1,belt:60,clockLimit:250,external:[]});
 const inputs=p.logistics.edges.filter(e=>e.item==='ore'&&e.from.kind==='import');assert.equal(inputs.length,2);assert.equal(inputs.reduce((sum,e)=>sum+e.rate,0),120);assert.ok(p.logistics.edges.every(e=>e.rate<=60));assert.ok(L.checkFlows(p,P.recipes).valid);
});
