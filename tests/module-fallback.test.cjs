const {test}=require('node:test'),assert=require('node:assert/strict'),P=require('../public/planner.js'),B=require('../public/bounded.js'),S=require('../public/simulation.js'),Store=require('../public/project-store.js');
test('a chain that cannot fit in a small single-floor module uses bounded stages and preserves output through multi-product modules',()=>{
 const proposal=P.propose({product:'motor',rate:5,floors:1,preset:'mk1',width:32,length:32,height:32,belt:270,clockLimit:100,liftClearance:4});
 assert.equal(proposal.kind,'stages');assert.ok(proposal.modules.length>1);assert.ok(proposal.modules.every(B.check));
 assert.equal(proposal.modules.reduce((sum,p)=>sum+(p.exports?.motor??(p.config.product==='motor'?p.config.rate:0)),0),5);
 for(const link of proposal.links){const produced=proposal.modules.reduce((sum,p)=>sum+(p.exports?.[link.item]??(p.config.product===link.item?p.config.rate:0)),0),consumed=proposal.modules.reduce((sum,p)=>sum+(p.imports[link.item]??0),0);assert.ok(Math.abs(produced-consumed)<1e-7,link.item);assert.ok(Math.abs(consumed-link.rate)<1e-7,link.item)}
 const restored=Store.decode(Store.encode({product:'motor',rate:5},proposal.modules,proposal));assert.equal(restored.modules.length,proposal.modules.length);
 const simulation=S.create(restored.modules,restored.proposal);simulation.advance(300);
 for(const link of proposal.links)assert.equal(simulation.stats.imported[link.item],undefined,'Intermediate '+link.item+' must come from another module');
 assert.ok(simulation.stats.exported.motor>0);assert.deepEqual(Object.keys(simulation.stats.exported),['motor']);
});
test('standard recipe information distinguishes batch duration from items per minute',()=>{assert.deepEqual(P.recipeInfo('frame'),{batch:2,seconds:60,rate:2});assert.deepEqual(P.recipeInfo('radio'),{batch:2,seconds:48,rate:2.5});for(const [id,r] of Object.entries(P.recipes)){const info=P.recipeInfo(id);assert.ok(info.seconds>0);assert.equal(info.rate,r.out);assert.equal(info.batch,P.recipeBatches[id])}});
