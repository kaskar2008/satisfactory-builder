const {test}=require('node:test'),assert=require('node:assert/strict'),P=require('../public/planner.js'),L=require('../public/logistics.js'),B=require('../public/bounded.js'),Store=require('../public/project-store.js'),S=require('../public/simulation.js');
test('the saved nine-module rotor factory compacts without creating backward flows in the default mode',()=>{
const old=Store.decode(require('../tests/fixtures/module-compaction-fixture.json')),q=B.compactModules(old.config,old.modules);assert.equal(q.modules.length,4);assert.ok(q.modules.every(B.check));assert.deepEqual(B.moduleOrder(q.modules),q.modules.map((_,i)=>i));assert.deepEqual(q.modules.map(p=>p.fit.usedFloors).sort(),[2,2,2,4]);assert.equal(q.modules.reduce((sum,p)=>sum+(p.exports?.rotor??(p.config.product==='rotor'?p.config.rate:0)),0),15);assert.equal(q.modules.reduce((sum,p)=>sum+p.machines.length,0),old.modules.reduce((sum,p)=>sum+p.machines.length,0));
for(const p of q.modules){assert.ok(p.logistics.flowCheck.valid);assert.ok(L.checkEquipmentCollisions(p,p.logistics).valid);assert.ok(L.checkBeltCollisions(p.logistics).valid)}
const restored=Store.decode(Store.encode(old.config,q.modules,q)),sim=S.create(restored.modules,restored.proposal);const reference=S.create(old.modules,old.proposal);sim.advance(540);reference.advance(540);assert.equal(sim.stats.exported.rotor,reference.stats.exported.rotor);assert.deepEqual(sim.stats.produced,reference.stats.produced);assert.deepEqual(Object.keys(sim.stats.imported),['ore']);assert.deepEqual(Object.keys(sim.stats.exported),['rotor']);
});
test('merging dependent stages routes the internally consumed share while exporting the remaining share',()=>{const c={product:'rod',rate:15,floors:3,preset:'mk3',width:48,length:48,height:48,belt:270,clockLimit:100},a=P.plan({...c,product:'ingot',rate:30}),b=P.plan({...c,external:['ingot']});const q=B.compactModules(c,[a,b]);assert.equal(q.modules.length,1);assert.deepEqual(q.modules[0].exports,{ingot:15,rod:15});assert.equal(q.modules[0].imports.ingot,undefined);assert.ok(q.modules[0].logistics.flowCheck.valid);assert.ok(B.check(q.modules[0]));const max=P.maximize(q.modules[0]);assert.equal(max.exports.ingot,15);assert.equal(max.exports.rod,15)});
test('all three current modules expose only their net recipe balances',()=>{
const saved=Store.decode(require('../tests/fixtures/factory-compacted.json'));
assert.equal(saved.modules.length,3);
for(const p of saved.modules){const check=L.checkFlows(p,P.recipes);assert.ok(check.valid);for(const item of Object.keys(check.imports))assert.equal(check.exports[item]??0,0)}
const third=saved.modules[2];assert.deepEqual(third.groups.map(g=>g.id).sort(),['ingot','rotor']);assert.equal(third.logistics.flowCheck.internalSupply.ingot,0);assert.equal(third.imports.rod,75);
});
test('a conserved but unnecessary external loop is rejected on generation and restore',()=>{
const p=P.plan({product:'rod',rate:15,floors:1,width:64,belt:270});
const from={kind:'import',point:[1,1.2,1],dir:[1,0,0]},to={kind:'export',point:[5,1.2,1],dir:[-1,0,0]};
p.logistics.edges.push({id:p.logistics.edges.length,item:'ingot',rate:1,from,to,points:[from.point,to.point]});p.imports.ingot=1;p.exports={rod:15,ingot:1};
assert.throws(()=>L.checkFlows(p,P.recipes),e=>e.code==='flow-invalid'&&e.message.includes('внутренний поток ingot'));
assert.throws(()=>Store.decode(Store.encode(p.config,[p])),e=>e.code==='flow-invalid');
});
test('a merged stage imports only the deficit after using its own ingredient output',()=>{
const c={product:'rod',rate:30,floors:3,preset:'mk3',width:48,length:48,height:48,belt:270,clockLimit:100};
const q=B.compactModules(c,[P.plan({...c,product:'ingot',rate:15}),P.plan({...c,external:['ingot']})]);
assert.equal(q.modules.length,1);const p=q.modules[0],check=L.checkFlows(p,P.recipes);
assert.equal(check.internalSupply.ingot,15);assert.equal(check.imports.ingot,15);assert.equal(check.exports.ingot,undefined);assert.equal(check.exports.rod,30);
});

test('independent mode rejects contractions across intermediate stages and orders split stages forward',()=>{
const old=Store.decode(require('../tests/fixtures/module-compaction-fixture.json')),config={...old.config,independentModules:true};
const q=B.compactModules(config,old.modules),order=B.moduleOrder(q.modules);
assert.deepEqual(order,q.modules.map((_,i)=>i));assert.ok(q.modules.length<old.modules.length);assert.equal(q.modules.reduce((n,p)=>n+p.machines.length,0),32);
assert.equal(q.modules.reduce((n,p)=>n+(p.exports?.rotor??(p.config.product==='rotor'?p.config.rate:0)),0),15);
for(let i=0;i<q.modules.length;i++)for(let j=0;j<q.modules.length;j++)if(i!==j)for(const [item,n] of Object.entries(q.modules[i].exports??{[q.modules[i].config.product]:q.modules[i].config.rate}))if(n>0&&(q.modules[j].imports[item]??0)>0)assert.ok(i<j);
const restored=Store.decode(Store.encode(config,q.modules,q));assert.equal(restored.config.independentModules,true);assert.ok(B.moduleOrder(restored.modules));
const cyclic=Store.encode(config,Store.decode(require('../tests/fixtures/factory-compacted.json')).modules);assert.throws(()=>Store.decode(cyclic),/обратный поток/);
});
test('cycle detection covers indirect return paths and permits parallel fragments',()=>{
const m=(exports,imports)=>({exports,imports,config:{}});
assert.deepEqual(B.moduleOrder([m({c:1},{b:1}),m({a:1},{}),m({b:1},{a:1})]),[1,2,0]);
assert.equal(B.moduleOrder([m({a:1},{c:1}),m({b:1},{a:1}),m({c:1},{b:1})]),null);
assert.ok(B.moduleOrder([m({a:1},{}),m({a:1},{}),m({b:2},{a:2})]));
});
test('the option separates recipes while the default packs adjacent stages together',()=>{
const c={product:'rod',rate:15,floors:3,preset:'mk3',width:48,length:48,height:48,belt:270,clockLimit:100};
const stages=[P.plan({...c,product:'ingot',rate:15}),P.plan({...c,external:['ingot']})];
const compact=B.compactModules(c,stages),logical=B.compactModules({...c,independentModules:true},stages);
assert.equal(compact.modules.length,1);assert.equal(logical.modules.length,2);assert.ok(logical.modules.every(p=>p.groups.length===1));
assert.deepEqual(B.moduleOrder(compact.modules),[0]);assert.deepEqual(B.moduleOrder(logical.modules),[0,1]);
});
test('two half-rate upstream layouts feed a single full-rate final machine without exceeding ports',()=>{
const c={product:'rod',rate:15,preset:'mk3',width:48,length:48,height:48,floors:'auto',belt:270,clockLimit:100},half=P.plan({...c,rate:7.5}),q=B.consolidateParallel(c,half);
assert.equal(q.modules.length,2);const finals=q.modules.flatMap(p=>p.machines.filter(m=>m.group==='rod'));assert.equal(finals.length,1);assert.equal(finals[0].clock,1);assert.deepEqual(q.links,[{item:'ingot',rate:7.5}]);
for(const p of q.modules){assert.ok(B.check(p));assert.ok(L.checkFlows(p,P.recipes).valid)}assert.deepEqual(B.moduleOrder(q.modules),[0,1]);
const sim=S.create(Store.decode(Store.encode(c,q.modules,q)).modules,q);sim.advance(240);assert.ok(sim.stats.exported.rod>40);assert.equal(sim.stats.imported.ingot,undefined);
});


test('stacked compaction keeps the selected alternate automated wiring recipe',()=>{
 const vm=require('node:vm'),source=require('node:fs').readFileSync('public/bounded.js','utf8'),start=source.indexOf('function stackCandidate('),end=source.indexOf('function stackIndependent(',start),recipeId='Recipe_Alternate_HighSpeedWiring_C',config={product:'automatedWiring',recipeId,rate:7.5,width:48,length:48,height:48,floors:'auto',belt:270,external:[]};
 const templates=[{config:{product:'stator',rate:3.75},exports:{stator:3.75},imports:{},fit:{usedFloors:1},machines:[{x:4,z:4,w:10,d:15,floor:0}]},{config,imports:{stator:3.75},exports:{automatedWiring:7.5},fit:{usedFloors:1},machines:[{x:4,z:4,w:18,d:16,floor:0}]}];
 let used;const context={structuredClone,root:{FactoryPlanner:P,FactoryLogistics:{assignFloors(p){p.floors=[{ceiling:40}]},calculate(p,recipes){used=recipes;return {}}}},volume:()=>({height:48}),check(){},FitError:Error};vm.createContext(context);vm.runInContext(source.slice(start,end),context);context.stackCandidate(config,templates,{config,machines:[{group:'stator'},{group:'automatedWiring'}],groups:[{id:'stator'},{id:'automatedWiring'}]});
 assert.deepEqual(used.automatedWiring.ins,P.recipesFor(config).automatedWiring.ins);assert.ok(used.automatedWiring.ins.highSpeed);assert.equal(used.automatedWiring.out,7.5);
});
