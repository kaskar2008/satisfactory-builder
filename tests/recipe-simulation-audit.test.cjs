const {test}=require('node:test'),assert=require('node:assert/strict'),P=require('../public/planner.js'),S=require('../public/simulation.js'),L=require('../public/logistics.js'),raw=require('../data/game-data-source.json');
test('every catalog recipe preserves extracted game cycle times and batch quantities',()=>{
 for(const r of Object.values(P.catalog.recipes)){const source=raw.recipes[r.id];assert.equal(r.seconds,source.time,r.id);for(const [entries,original] of [[r.inputs,source.ingredients],[r.outputs,source.products]])for(const [i,x] of entries.entries()){assert.equal(x.amount,original[i].amount,r.id);assert.ok(Math.abs(x.rate-60*x.amount/source.time)<1e-8,r.id)}}
});
test('all recipes at 100% preserve steady production and exported rates without amplifiers',()=>{
 const failures=[];
 for(const r of Object.values(P.catalog.recipes)){
  const config={product:r.product,recipeId:r.id,belt:Math.max(1200,...r.inputs.concat(r.outputs).filter(x=>!P.isFluid(x.item)).map(x=>x.rate)),pipeCapacity:600};
  // Isolate recipe timing with short uncongested routes; tier bottlenecks are tested separately.
  const m={...P.buildings[r.b],id:0,group:r.product,b:r.b,x:10,z:10,floor:0,clock:1},p={config,machines:[m],floors:[{index:0,y:0}],logistics:{nodes:[],edges:[]}};
  const ports=L.machinePorts(p,m,P.recipesFor(config));
  for(const [input,list] of [[true,ports.inputs],[false,ports.outputs]])for(const port of list){delete port.kind;const boundary={kind:input?'import':'export',point:port.point.map((v,k)=>v+port.dir[k]*2)},from=input?boundary:port,to=input?port:boundary,entry=(input?r.inputs:r.outputs).find(x=>x.item===port.item);p.logistics.edges.push({id:p.logistics.edges.length,item:port.item,rate:entry.rate,kind:P.isFluid(port.item)?'pipe':'belt',capacity:Math.max(600,entry.rate),crossSection:1,volume:2,from,to,points:[from.point,to.point]})}
  const s=S.create([p]);s.advance(Math.max(180,3*r.seconds));const before={...s.stats.exported};const duration=Math.max(300,5*r.seconds);s.advance(duration);
  for(const x of r.outputs){const actual=(s.stats.exported[x.item]??0)-(before[x.item]??0),expected=x.rate*duration/60;if(Math.abs(actual-expected)>x.amount+1.01)failures.push(r.id+' '+x.item+': '+actual+' vs '+expected)}
 }
 assert.deepEqual(failures,[]);
});
