const {test}=require('node:test'),assert=require('node:assert/strict'),P=require('../public/planner.js'),G=require('../public/graph.js');
const config={rate:20,width:64,floors:1,belt:270,external:[]};
test('graph retains every actual logistics connection including fluids and byproducts',()=>{
 for(const product of ['plate','frame','plastic']){const p=P.plan({...config,product,rate:product==='frame'?2:20}),before=JSON.stringify(p.logistics),g=G.build([p]),ids=new Set(g.nodes.map(n=>n.id));assert.equal(g.edges.length,p.logistics.edges.length);assert.equal(ids.size,g.nodes.length);assert.equal(g.nodes.filter(n=>n.type==='machine').length,p.machines.length);for(const e of g.edges){assert.ok(ids.has(e.from)&&ids.has(e.to));const original=p.logistics.edges.find(v=>'m0:edge'+v.id===e.id);assert.equal(e.rate,original.rate);assert.equal(e.item,original.item);assert.equal(e.kind,original.kind)}for(const n of g.nodes)assert.ok(Number.isFinite(n.x)&&Number.isFinite(n.y));assert.equal(JSON.stringify(p.logistics),before)}
});
test('module transfers connect actual exports and imports without losing local edges',()=>{
 const a=P.plan({...config,product:'ingot',rate:30}),b=P.plan({...config,product:'plate',external:['ingot']}),g=G.build([a,b],{kind:'stages',links:[{item:'ingot',rate:30}]});
 assert.equal(g.nodes.filter(n=>n.type==='transfer').length,1);assert.equal(g.edges.filter(e=>e.kind!=='transfer').length,a.logistics.edges.length+b.logistics.edges.length);assert.ok(g.edges.some(e=>e.from.startsWith('m0:export')&&e.to==='transfer:ingot'));assert.ok(g.edges.some(e=>e.from==='transfer:ingot'&&e.to.startsWith('m1:import')));
});

test('layer ordering removes avoidable crossings while retaining every edge',()=>{
 const nodes=[{id:'a',rank:0},{id:'b',rank:0},{id:'c',rank:1},{id:'d',rank:1}],edges=[{id:'ad',from:'a',to:'d'},{id:'bc',from:'b',to:'c'}];
 const g=G.layout(nodes,edges);assert.equal(g.crossings,0);assert.ok((nodes[0].y-nodes[1].y)*(nodes[3].y-nodes[2].y)>0);assert.equal(g.edges.length,2);
});
test('long connections reserve lanes around intervening cards and split parallel ports',()=>{
 const nodes=[{id:'a',rank:0},{id:'b',rank:1},{id:'c',rank:2}],edges=[{id:'ab',from:'a',to:'b'},{id:'bc',from:'b',to:'c'},{id:'ac',from:'a',to:'c'}];
 const g=G.layout(nodes,edges),long=edges[2],middle=nodes[1];assert.ok(long.path.includes(' L '));
 const horizontal=long.path.match(/ L ([\d.]+) ([\d.]+)/);assert.ok(horizontal);const laneY=Number(horizontal[2]);assert.ok(laneY<middle.y||laneY>middle.y+78);assert.notEqual(edges[0].path.split(' C ')[0],long.path.split(' C ')[0]);assert.equal(g.nodes.length,3);
});

test('all modules occupy distinct stage blocks with production captions',()=>{
 const a=P.plan({...config,product:'ingot',rate:30}),b=P.plan({...config,product:'plate',external:['ingot']}),g=G.build([a,b],{kind:'stages',links:[{item:'ingot',rate:30}]});
 assert.equal(g.groups.length,2);assert.ok(g.groups[0].x+g.groups[0].width<g.groups[1].x);assert.ok(g.groups[0].detail.includes('Железный слиток'));assert.ok(g.groups[1].detail.includes('Железная пластина'));
 for(const n of g.nodes.filter(n=>n.module!==undefined)){const box=g.groups[n.module];assert.ok(n.x>=box.x&&n.x+230<=box.x+box.width);assert.ok(n.y>box.y+49)}
 assert.ok(g.edges.some(e=>e.kind==='transfer'));
});

test('recipe overview combines identical machines and preserves flows through junctions',()=>{
 const p=P.plan({...config,product:'reinforced',rate:15,external:['plate','screw']}),raw=G.build([p]),g=G.recipesGraph(raw);
 const machine=g.nodes.find(n=>n.type==='machine');assert.equal(machine.count,p.machines.length);assert.equal(machine.rate,15);assert.ok(!g.nodes.some(n=>n.type==='splitter'||n.type==='merger'));assert.ok(g.nodes.length<raw.nodes.length);
 for(const item of ['plate','screw']){const flow=g.edges.filter(e=>e.to===machine.id&&e.item===item).reduce((n,e)=>n+e.rate,0);assert.ok(Math.abs(flow-p.imports[item])<1e-6)}
 assert.ok(Math.abs(g.edges.filter(e=>e.from===machine.id).reduce((n,e)=>n+e.rate,0)-15)<1e-6);
});

test('mouse zoom keeps the graph point under the cursor fixed and clamps extremes',()=>{
 const start={zoom:.5,x:-100,y:40},cursor=[250,180],point=[(cursor[0]-start.x)/start.zoom,(cursor[1]-start.y)/start.zoom],next=G.zoomAt(start,1.7,cursor);
 assert.ok(Math.abs(point[0]*next.zoom+next.x-cursor[0])<1e-8);assert.ok(Math.abs(point[1]*next.zoom+next.y-cursor[1])<1e-8);
 const restored=G.zoomAt(next,1/1.7,cursor);assert.ok(Math.abs(restored.x-start.x)<1e-8);assert.ok(Math.abs(restored.y-start.y)<1e-8);assert.equal(G.zoomAt(start,1e9,cursor).zoom,8);assert.equal(G.zoomAt(start,1e-9,cursor).zoom,.03);
});

test('expanding the graph fits its canvas without activating a 3D tab',()=>{
 const vm=require('node:vm'),source=require('node:fs').readFileSync('public/app.js','utf8'),elements=new Map(),classes=()=>({toggle(){}}),context={graphView:true,topView:false,current:null,viewport:{classList:classes()},document:{body:{classList:classes()}},requestAnimationFrame:fn=>fn(),fitGraph(){context.fits++},camera(){context.cameraCalls++},draw(){},fits:0,cameraCalls:0,$:id=>{if(!elements.has(id))elements.set(id,{classList:classes(),setAttribute(){}});return elements.get(id)}};
 vm.createContext(context);vm.runInContext(source.slice(0,source.indexOf('const P=')),context);const start=source.indexOf('function expandView(expanded)'),end=source.indexOf('const graphPanel=',start);vm.runInContext(source.slice(start,end),context);context.expandView(true);context.expandView(false);assert.equal(context.fits,2);assert.equal(context.cameraCalls,0);
 context.graphView=false;context.expandView(true);assert.equal(context.cameraCalls,1);
});

test('panning retains a visible fraction of the graph and permits movement in both directions',()=>{
 const left=G.boundPan({x:-9999,y:-9999},[1000,500],[800,600]);assert.equal(left.x,-900);assert.equal(left.y,-450);
 const right=G.boundPan({x:9999,y:9999},[1000,500],[800,600]);assert.equal(right.x,700);assert.equal(right.y,550);
 assert.deepEqual(G.boundPan({x:30,y:40},[1000,500],[800,600]),{x:30,y:40});
});

test('graph simulation positions particles by transport progress and fills crafting nodes',()=>{
 require('../public/simulation.js');const G=globalThis.FactoryGraph,attrs={},created=[];
 let pathReads=0;const fill={setAttribute(k,v){attrs[k]=v}},path={getTotalLength:()=>100,getPointAtLength:d=>{pathReads++;return {x:d,y:20}}},a={nodes:[{node:{id:'m0:machine0',module:0},fill}],paths:[{edge:{id:'m0:edge0'},path}],circles:new Map(),layer:{append(c){created.push(c)}},el(tag,values){return {values,setAttribute(k,v){this.values[k]=v},remove(){this.removed=true}}}};
 const host={__simulationGraph:a},state={m:{id:0,group:'ingot'},remaining:5,duration:10,outputBatches:{ingot:1},output:[]},simulation={time:0,modules:[{index:0,machines:[state],edges:[{e:{id:0,item:'ingot'},length:10,fluid:false,items:[{d:5,token:{id:1}}]}]}]};
 G.updateSimulation(host,simulation);assert.equal(attrs.width,115);assert.equal(created[0].values.cx,50);assert.equal(created[0].values.cy,20);assert.equal(pathReads,129);simulation.time=.05;simulation.modules[0].edges[0].items[0].d=6;G.updateSimulation(host,simulation);assert.equal(created.length,1);assert.equal(pathReads,129);assert.equal(created[0].values.cx,60);G.updateSimulation(host,null);assert.equal(attrs.width,0);assert.equal(a.circles.size,0);assert.equal(created[0].removed,true);
});

test('selected stage rebuilds transfer boundaries locally and branches multi-input resources',()=>{
 require('../public/logistics.js');const q=JSON.parse(require('node:fs').readFileSync('tests/fixtures/water-repro.fixture.json','utf8'));q.modules[1].logistics.edges.find(e=>e.item==='water'&&e.to.kind==='export').rate=360;const raw=G.build(q.modules,q.proposal),before=JSON.stringify(raw),g=G.stageGraph(raw,0),ids=new Set(g.nodes.map(n=>n.id));
 assert.ok(g.nodes.every(n=>n.module===0));assert.ok(g.width<raw.width);assert.equal(JSON.stringify(raw),before);const water=g.nodes.find(n=>n.id==='transfer:water:input'),splitter=g.nodes.find(n=>n.id==='transfer:water:input:splitter');assert.ok(water&&splitter);assert.ok(water.x<splitter.x);assert.equal(g.edges.filter(e=>e.from===splitter.id).length,2);for(const e of g.edges)assert.ok(ids.has(e.from)&&ids.has(e.to));for(const e of raw.edges.filter(e=>e.id.startsWith('m0:edge')))assert.ok(g.edges.some(v=>v.id===e.id));assert.ok(G.recipesGraph(g).nodes.length>0);
});

test('graph balances recycled water against external makeup at each input',()=>{
 const q=JSON.parse(require('node:fs').readFileSync('tests/fixtures/water-repro.fixture.json','utf8')),raw=G.build(q.modules,q.proposal),hub=raw.nodes.find(n=>n.id==='transfer:water');assert.equal(hub.rate,120);const inputs=raw.nodes.filter(n=>n.module===0&&n.type==='import'&&n.item==='water');assert.equal(inputs.reduce((n,v)=>n+v.moduleRate,0),120);assert.equal(inputs.reduce((n,v)=>n+v.externalRate,0),240);for(const n of inputs)assert.equal(n.moduleRate+n.externalRate,n.rate);const stage=G.stageGraph(raw,0);assert.equal(stage.nodes.find(n=>n.id==='transfer:water:input').rate,120);
});

test('recipe stage boundaries never inflate local supplies or exports',()=>{
 const q=JSON.parse(require('node:fs').readFileSync('tests/fixtures/water-repro.fixture.json','utf8')),raw=G.build(q.modules,q.proposal),all=G.recipesGraph(raw),before=JSON.stringify(raw);
 for(let module=0;module<q.modules.length;module++){
  const stage=G.recipesGraph(G.stageGraph(raw,module));
  for(const original of all.nodes.filter(n=>n.module===module)){
   const local=stage.nodes.find(n=>n.id===original.id);assert.ok(local,original.id);
   for(const field of ['rate','moduleRate','externalRate','count'])assert.equal(local[field],original[field],original.id+' '+field);
   assert.deepEqual(local.outputs,original.outputs);
  }
  for(const boundary of stage.nodes.filter(n=>n.boundary)){
   const flow=stage.edges.filter(e=>boundary.type==='import'?e.from===boundary.id:e.to===boundary.id).reduce((sum,e)=>sum+e.rate,0);
   assert.equal(flow,boundary.rate);assert.ok(!stage.edges.some(e=>e.from===boundary.id&&e.to===boundary.id));
  }
 }
 const stage=G.recipesGraph(G.stageGraph(raw,0));
 assert.equal(stage.nodes.find(n=>n.type==='import'&&n.item==='water'&&!n.boundary).rate,360);
 assert.equal(stage.nodes.find(n=>n.type==='export'&&n.item==='aluminaSolution'&&!n.boundary).rate,240);
 assert.equal(JSON.stringify(raw),before);
});


test('recycled byproducts do not collapse production into one graph column',()=>{
 const p=P.plan({...config,product:'aluminumScrap',rate:90,width:128}),raw=G.build([p]);
 for(const g of [raw,G.stageGraph(raw,0),G.recipesGraph(raw)]){
  const alumina=g.nodes.find(n=>n.type==='machine'&&n.item==='aluminaSolution'),scrap=g.nodes.find(n=>n.type==='machine'&&n.item==='aluminumScrap');
  assert.ok(alumina.rank<scrap.rank);assert.ok(alumina.x+230<scrap.x);
  const byId=new Map(g.nodes.map(n=>[n.id,n]));const returns=g.edges.filter(e=>byId.get(e.to).rank<=byId.get(e.from).rank);
  assert.equal(returns.length,1);assert.equal(returns[0].item,'water');assert.ok(returns[0].path);
  assert.ok(g.nodes.every(n=>Number.isFinite(n.x)&&Number.isFinite(n.y)));
 }
 assert.equal(raw.edges.length,p.logistics.edges.length);
});


test('machine cards include every recipe output at the actual clock rate and aggregate byproduct rates',()=>{
 const p=P.plan({...config,product:'aluminumScrap',rate:360,width:128}),raw=G.build([p]),g=G.recipesGraph(raw);
 const machines=raw.nodes.filter(n=>n.type==='machine'&&n.item==='aluminumScrap');assert.ok(machines.length>1);
 for(const n of machines){const m=p.machines.find(m=>'m0:machine'+m.id===n.id),r=P.recipesFor(p.config)[m.group];assert.deepEqual(n.outputs,Object.entries(P.outputs(r,m.group)).map(([item,rate])=>({item,rate:rate*m.clock})));assert.ok(n.height>78)}
 const combined=g.nodes.find(n=>n.type==='machine'&&n.item==='aluminumScrap');assert.equal(combined.outputs.find(o=>o.item==='aluminumScrap').rate,360);assert.equal(combined.outputs.find(o=>o.item==='water').rate,120);
 const stage=G.stageGraph(raw,0);assert.deepEqual(stage.nodes.find(n=>n.id===machines[0].id).outputs,machines[0].outputs);
 for(const a of raw.nodes)for(const b of raw.nodes)if(a!==b&&a.rank===b.rank&&a.y<b.y)assert.ok(a.y+a.height<b.y);
});
