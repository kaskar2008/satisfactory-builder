const {test}=require('node:test'),assert=require('node:assert/strict'),P=require('../public/planner.js'),B=require('../public/bounded.js');
const base={rate:1,floors:3,width:48,belt:270,_layoutOnly:true};
test('computer standard chain imports plastic and aggregates copper for sheets and cable',()=>{const p=P.plan({...base,product:'computer',external:['plastic']});assert.equal(p.imports.plastic,32);assert.equal(p.imports.copperOre,24);assert.equal(p.groups.find(g=>g.id==='computer').b,'manufacturer');assert.equal(p.groups.find(g=>g.id==='circuitBoard').rate,4)});
test('supercomputer chain aggregates shared boards, plastic, and caterium',()=>{const p=P.plan({...base,product:'supercomputer',external:['plastic']});assert.equal(p.imports.plastic,168);assert.ok(Math.abs(p.imports.cateriumOre-124.8)<1e-6);assert.equal(p.groups.find(g=>g.id==='computer').rate,4);assert.equal(p.groups.find(g=>g.id==='circuitBoard').rate,19)});
test('manufacturer with four belt inputs fits a bounded Mk.3 and respects low-tier ports',()=>{const p=P.plan({...base,_layoutOnly:false,product:'heavyFrame',rate:2,belt:270,preset:'mk3',external:['frame','pipe','encased','screw']});assert.ok(B.check(p));assert.equal(p.groups.length,1);assert.equal(p.machines.length,1);assert.equal(Object.keys(p.logistics.manifolds[0].inputs).length,4);const low=P.plan({...base,product:'heavyFrame',rate:2,belt:60,external:['frame','pipe','encased','screw']});assert.equal(low.machines.length,4);assert.ok(low.machines.every(m=>240*m.clock<=60+1e-6))});
test('every added recipe has named ingredients and an acyclic chain',()=>{for(const [id,r] of Object.entries(P.recipes)){assert.ok(P.items[id]);assert.ok(P.buildings[r.b]);assert.ok(r.out>0);for(const [ingredient,rate] of Object.entries(r.ins)){assert.ok(P.items[ingredient]);assert.ok(rate>0)}assert.ok(!P.dependencies(id).includes(id))}});
test('late-game recipes keep exact batches and declare unsupported upstream supplies',()=>{assert.equal(Object.keys(P.recipes).length,121);assert.deepEqual(P.recipes.radio.ins,{aluminumCasing:40,oscillator:1.25,computer:2.5});assert.equal(P.recipeBatches.radio,2);assert.equal(P.recipes.assemblyDirector.b,'assembler');assert.equal(P.recipes.thermalRocket.ins.coolingSystem,3);const p=P.plan({...base,product:'pressureCube',external:['radio','fusedFrame']});assert.equal(p.imports.fusedFrame,1);assert.equal(p.imports.radio,2);assert.equal(p.groups.length,1)});
test('every selectable recipe has a local original game icon',()=>{const fs=require('node:fs'),path=require('node:path');for(const id of Object.keys(P.catalog.items)){const file=path.join(__dirname,'../public',P.itemIcons[id]);const data=fs.readFileSync(file);assert.equal(data.subarray(0,8).toString('hex'),'89504e470d0a1a0a',id);assert.equal(data.readUInt32BE(16),64,id);assert.equal(data.readUInt32BE(20),64,id)}});
test('the complete crafting catalog includes every machine crafting recipe, fluids and all byproducts',()=>{
const source=require('../data/game-data-source.json'),all=Object.values(P.catalog.recipes);
assert.equal(all.length,276);assert.ok(all.every(r=>r.building!=='Верстак'&&!r.seasonal));assert.equal(P.recipes.ficsmasWonderStar,undefined);assert.throws(()=>P.recipesFor({recipeId:'Recipe_XmasStar_C'}),/Неизвестный рецепт/);assert.equal(all.filter(r=>r.alternate).length,111);
assert.deepEqual(all.map(r=>r.id).sort(),Object.values(source.recipes).filter(r=>r.inMachine&&!r.forBuilding&&!/Ficsmas|Fcismas|Xmas|Christmas|Fireworks|Snow|Candy|Gift/i.test(r.className)).map(r=>r.className).sort());
for(const r of all){assert.equal(r.outputs.length,source.recipes[r.id].products.length);assert.ok(r.seconds>0);assert.equal(r.supported,!r.reason);for(const x of [...r.inputs,...r.outputs])assert.ok(P.items[x.item]&&x.rate>0)}
const plastic=all.find(r=>r.id==='Recipe_Plastic_C');assert.equal(plastic.outputs.length,2);assert.equal(plastic.inputs[0].rate,30);assert.equal(plastic.supported,true);
});
test('all supported alternatives use their actual building, input ratios and cycle batches',()=>{
for(const r of Object.values(P.catalog.recipes).filter(r=>r.supported)){
const c={...base,product:r.product,rate:r.outputs[0].rate,recipeId:r.id,external:r.inputs.map(x=>x.item)},p=P.plan(c),g=p.groups.find(g=>g.id===r.product);
assert.equal(g.b,r.b);assert.equal(P.recipeInfo(r.product,r.id).seconds,r.seconds);assert.equal(P.recipeInfo(r.product,r.id).batch,r.outputs[0].amount);
for(const x of r.inputs)assert.ok(Math.abs((p.imports[x.item]??0)-Math.max(0,x.rate-(r.outputs.find(y=>y.item===x.item)?.rate??0)))<1e-6,r.id);
}
});
test('selected cast screws keep their alternative through routing, storage and simulation',()=>{
const L=require('../public/logistics.js'),Store=require('../public/project-store.js'),S=require('../public/simulation.js');
const c={product:'screw',rate:50,recipeId:'Recipe_Alternate_Screw_C',floors:1,width:64,length:64,height:48,belt:270,external:['ingot']},p=P.plan(c);
assert.equal(p.imports.ingot,12.5);assert.equal(p.machines.length,1);assert.equal(p.logistics.flowCheck.valid,true);assert.equal(L.machinePorts(p,p.machines[0],P.recipesFor(c)).inputs[0].item,'ingot');
const restored=Store.decode(Store.encode(c,[p])),sim=S.create(restored.modules);assert.equal(sim.modules[0].machines[0].batch,20);sim.advance(180);assert.ok(sim.stats.produced.screw>=100);
assert.equal(P.recipesFor({recipeId:'Recipe_Plastic_C'}).plastic.b,'refinery');
});

test('recipe icons resolve beside the app under a subdirectory or a local file',()=>{
 for(const icon of Object.values(P.itemIcons))for(const base of ['https://example.test/builder/index.html','file:///E:/projects/sf-builder/index.html']){
  const url=new URL(icon,base);assert.ok(url.pathname.includes('/sf-builder/assets/items/')||url.pathname.startsWith('/builder/assets/items/'));
 }
});
