const {test}=require('node:test'),assert=require('node:assert/strict'),P=require('../public/planner.js'),L=require('../public/logistics.js'),B=require('../public/bounded.js'),G=require('../public/graph.js');
const base={width:128,length:128,height:128,floors:'auto',belt:1200,pipeCapacity:600,clockLimit:100,allowFeedback:false};

test('every solid coproduct can be external without creating a module dependency',()=>{
 let checked=0;
 for(const recipe of Object.values(P.catalog.recipes))for(const output of recipe.outputs.filter(o=>o.item!==recipe.product&&!P.isFluid(o.item))){
  const c={...base,product:recipe.product,recipeId:recipe.id,rate:recipe.outputs.find(o=>o.item===recipe.product).rate,external:recipe.inputs.map(i=>i.item),externalFeedbackItems:[output.item],_layoutOnly:true},p=P.plan(c);
  assert.ok(p.exports[output.item]>0,recipe.id);
  const consumer={config:{...base,product:'plate',rate:1,externalFeedbackItems:[output.item]},imports:{[output.item]:output.rate},exports:{plate:1}};
  assert.ok(B.moduleOrder([p,consumer]),recipe.id);
  consumer.exports[recipe.inputs[0].item]=1;assert.ok(B.moduleOrder([p,consumer]),recipe.id+' external coproduct must break return dependency');
  consumer.config.externalFeedbackItems=[];assert.equal(B.moduleOrder([p,consumer]),null,recipe.id+' real return dependency must remain detectable');
  checked++;
 }
 assert.ok(checked>=5);
});

test('external solid silica stays separate from byproduct supply in stages and merged modules',()=>{
 const c={...base,product:'aluminum',rate:60,externalFeedbackItems:['silica','water'],external:['silica','water'],independentModules:true};
 const a=P.plan({...c,product:'aluminaSolution',rate:60,external:['water','bauxite','silica']}),b=P.plan({...c,product:'aluminumScrap',rate:90,external:['water','coal','aluminaSolution','silica']}),d=P.plan({...c,external:['aluminumScrap','silica','water']});
 const q=B.compactModules(c,[d,b,a]);assert.ok(B.moduleOrder(q.modules));assert.ok(!q.links.some(l=>['silica','water'].includes(l.item)));
 const check=modules=>{assert.equal(modules.reduce((s,p)=>s+(p.imports.silica??0),0),75);assert.equal(modules.reduce((s,p)=>s+(p.exports?.silica??0),0),25);for(const p of modules)assert.ok(p.logistics.flowCheck.valid)};
 check(q.modules);
 const g=G.build(q.modules,{...q,links:[...q.links,{item:'silica',rate:25}]});assert.ok(!g.nodes.some(n=>n.id==='transfer:silica'));
 const merged=B.compactModules({...c,independentModules:false},[a,d]);assert.equal(merged.modules.length,1);check(merged.modules);assert.equal(merged.modules[0].logistics.flowCheck.internalSupply.silica,0);
});
