/* Finite build volumes. Exploded display spacing is never used for fit checks. */
(function(root){
const presets={mk1:{name:'Чертёж Mk.1',width:32,length:32,height:32},mk2:{name:'Чертёж Mk.2',width:40,length:40,height:40},mk3:{name:'Чертёж Mk.3',width:48,length:48,height:48}};
// Measured with real low-poly geometry, item queues and camera rotation.
// These are protective budgets, not a hardware-independent FPS guarantee.
const performanceLimits={side:128,volume:112**3,machines:96,machineUnits:160,nodes:192,belts:800,triangles:360000,particles:2500,generationMs:120000};
function performanceError(message){const e=Error(message);e.code='performance-limit';throw e}
function checkPerformanceConfig(config){const v=volume(config);if(Math.max(v.width,v.length,v.height)>performanceLimits.side||v.width*v.length*v.height>performanceLimits.volume)performanceError('Для плавного 3D и симуляции: сторона не больше '+performanceLimits.side+' м, общий объём не больше '+performanceLimits.volume.toLocaleString('ru-RU')+' м³ (112×112×112 м). Уменьшите размеры; крупное производство разместите в отдельных модулях.');return v}
function performanceLoad(plans){const weights={smelter:1,constructor:1,foundry:1.5,assembler:1.5,manufacturer:2.5},load={machines:0,machineUnits:0,nodes:0,belts:0,triangles:0};for(const p of plans){load.machines+=p.machines.length;load.machineUnits+=p.machines.reduce((s,m)=>s+(weights[m.b]??2.5),0);load.nodes+=p.logistics?.nodes.length??0;load.belts+=p.logistics?.edges.length??0;load.triangles+=p.machines.length*1250+(p.logistics?.nodes.length??0)*300+Math.ceil(p.width/8)*Math.ceil(p.length/8)*16*(p.floors?.length??1);for(const e of p.logistics?.edges??[]){for(let i=1;i<e.points.length;i++){const a=e.points[i-1],b=e.points[i],dy=Math.abs(a[1]-b[1]);load.triangles+=dy>.1?60+Math.ceil(dy/2)*12:80;if(i<e.points.length-1){const c=e.points[i+1],u=b.map((n,k)=>n-a[k]),v=c.map((n,k)=>n-b[k]);if(Math.abs(u[1])<1e-7&&Math.abs(v[1])<1e-7&&Math.abs(u[0]*v[0]+u[2]*v[2])<1e-7)load.triangles+=256}}}}return load}
function checkPerformanceLoad(plans){const load=performanceLoad(plans);for(const key of ['machines','machineUnits','nodes','belts','triangles'])if(load[key]>performanceLimits[key])performanceError('Завод слишком сложный для плавного 3D с симуляцией: '+load.machines+' станков, '+load.nodes+' узлов, '+load.belts+' лент во всех модулях. Лимиты: '+performanceLimits.machines+' станков (тяжёлые модели учитываются дополнительно), '+performanceLimits.nodes+' узлов и '+performanceLimits.belts+' лент; отдельно проверяется детализация поворотов и подъёмников. Уменьшите выпуск, используйте энергокристаллы или добавьте внешние поставки.');return load}
function framePerformance(samples){if(!samples.length)return {fps:0,p95:0,stable:false};const sorted=[...samples].sort((a,b)=>a-b),fps=1000/(samples.reduce((a,b)=>a+b,0)/samples.length),p95=sorted[Math.floor(sorted.length*.95)];return {fps,p95,stable:fps>=59&&p95<=20}}
class FitError extends Error{constructor(message){super(message);this.code='volume-fit'}}
function volume(config){const preset=presets[config.preset];const v=preset?{...preset}:{width:config.width,length:config.length,height:config.height};if(![v.width,v.length,v.height].every(n=>Number.isFinite(n)&&n>=16&&n<=256))throw Error('Размеры объёма должны быть от 16 до 256 м.');return v}
function check(p){const v=p.bounds;if(p.floors?.at(-1).ceiling>v.height+1e-6)throw new FitError('Этажи выходят за высоту объёма.');const inside=(a,margin=0)=>a[0]>=margin-1e-6&&a[0]<=v.width-margin+1e-6&&a[1]>=-1e-6&&a[1]<=v.height-margin+1e-6&&a[2]>=margin-1e-6&&a[2]<=v.length-margin+1e-6;
for(const m of p.machines)if(!inside([m.x,m.y,m.z])||!inside([m.x+m.w,m.y+m.h,m.z+m.d]))throw new FitError('Оборудование выходит за объём.');
for(const n of p.logistics.nodes)if(!inside([n.point[0]-2,n.point[1]-.7,n.point[2]-2])||!inside([n.point[0]+2,n.point[1]+2.3,n.point[2]+2]))throw new FitError('Узлы выходят за объём.');
for(const e of p.logistics.edges){for(const pt of e.points)if(!inside(pt,.8))throw new FitError('Конвейеры выходят за объём.');for(const port of [e.from,e.to])if(port.kind){const center=port.point.map((n,k)=>n-port.dir[k]*1.4);if(!inside([center[0]-.7,center[1]-.7,center[2]-.7])||!inside([center[0]+.7,center[1]+1.45,center[2]+.7]))throw new FitError('Корпус входа или выхода выходит за объём.')}}return true}
function plan(config,raw){
root.FactoryCheckBudget?.();
let last;for(const junctionSpacing of [12,8])for(const terminalMode of ['compact','legacy']){try{return planLayout({...config,junctionSpacing,terminalMode},raw)}catch(e){if(e.code!=='volume-fit')throw e;last=e}}throw last;
}
function planLayout(config,raw){
const v=volume(config);
const normalized={...config,width:v.width,length:v.length,height:v.height},template=raw({...normalized,floors:config.floors==='auto'?1:config.floors,_layoutOnly:true}),maxFloors=config.floors==='auto'?Math.min(template.machines.length,Math.floor(v.height/Math.ceil(Math.min(...template.machines.map(m=>m.h))+2))):config.floors,strategies=['depth','depth-desc','spread','pack','split','split-low','rect-pack','split-rect'];
let attempts=0;const triedLayouts=new Set();
// Floors are a ceiling: exhaust compact layouts before adding another level.
for(let floorLimit=1;floorLimit<=maxFloors;floorLimit++){
let best=null,firstFitAttempt=0,validLayouts=0,routedAfterFit=0;const valid=[];
// Every routed layout stays selectable; the cheapest one is shown first.
const finish=()=>{const L=root.FactoryLogistics,ranked=[...valid].sort((a,b)=>L.compareConstruction([a],[b]));ranked.forEach((v,rank)=>{v.fit.optimization={validLayouts,additionalRoutes:routedAfterFit,cost:L.constructionCost([v]),rank}});best=ranked[0];best.fit.alternatives=ranked.slice(1);return best};
// Preserve the established layouts, then try compact rotated packings before
// spending another floor. Repeating every wide-gap layout for four headings
// adds expensive routing attempts without helping the compact-fit search.
layouts:for(const rotationMode of [null,0,90,180,270,'mixed'])for(const strategy of (rotationMode===null?strategies:['depth','spread','rect-pack','split-rect']))for(const {padding,gap,rowGap=8} of (rotationMode===null?[{padding:12,gap:3},{padding:10,gap:3},{padding:8,gap:3},{padding:8,gap:1},{padding:6,gap:1},{padding:6,gap:1,rowGap:4},{padding:4,gap:1,rowGap:4}]:[{padding:8,gap:1,rowGap:4},{padding:4,gap:1,rowGap:4}]))for(const order of ['chain','reverse']){
try{root.FactoryCheckBudget?.()}catch(e){if(best&&['planning-timeout','module-timeout'].includes(e.code))return finish();throw e}if(config._efficiencyBudget&&attempts>=config._efficiencyBudget*floorLimit)break layouts;
if(best&&(attempts-firstFitAttempt>=12||routedAfterFit>=6))return finish();
attempts++;root.FactoryProgress?.({stage:'layout',percent:10+65*attempts/(attempts+60),message:'Размещаем оборудование: до '+floorLimit+' этажей · вариант '+attempts});const p={...template,config:{...normalized,allowRotations:rotationMode!==null},width:v.width,length:v.length,bounds:{width:v.width,length:v.length,height:v.height},machines:template.machines.map(m=>({...m})),groups:template.groups.map(g=>({...g,machines:[...g.machines]}))};
const cursors=Array.from({length:floorLimit},()=>({x:padding,z:8,row:0}));const floorLoad=Array(floorLimit).fill(0);let failed=false;
function placeFixed(m,c,f){if(m.h+2>v.height)return null;const next={...c};if(strategy.includes('rect')){const rects=c.rects??[],xs=[padding,...rects.map(r=>r.x+r.w+gap)],zs=[8,...rects.map(r=>r.z+r.d+rowGap)],candidates=[];for(const x of xs)for(const z of zs)if(x+m.w<=v.width-padding&&z+m.d<=v.length-6&&!rects.some(r=>x<r.x+r.w+gap&&x+m.w+gap>r.x&&z<r.z+r.d+rowGap&&z+m.d+rowGap>r.z))candidates.push({x,z});candidates.sort((a,b)=>a.z-b.z||a.x-b.x);if(!candidates.length)return null;const point={...candidates[0],floor:f,y:0};next.rects=[...rects,{...point,w:m.w,d:m.d}];return {point,next}}if(next.x+m.w>v.width-padding){next.x=padding;next.z+=next.row+rowGap;next.row=0}if(next.x+m.w>v.width-padding||next.z+m.d>v.length-6)return null;const point={x:next.x,z:next.z,floor:f,y:0};next.x+=m.w+gap;next.row=Math.max(next.row,m.d);return {point,next}}
function place(m,c,f){
 const building=root.FactoryPlanner.buildings[m.b],angles=rotationMode==='mixed'?[0,90,180,270]:[rotationMode??0],choices=[];
 for(const rotation of angles){const w=rotation%180?building.d:building.w,d=rotation%180?building.w:building.d,q=placeFixed({...m,w,d},c,f);if(q){Object.assign(q.point,{rotation,w,d});q.cost=(q.point.z+d)*(v.width-padding)+q.point.x+w;choices.push(q)}}
 return choices.sort((a,b)=>a.cost-b.cost)[0]??null;
}
let groups=[...p.groups];if(strategy.startsWith('split'))groups.sort((a,b)=>root.FactoryPlanner.buildings[b.b].w*root.FactoryPlanner.buildings[b.b].d*b.count-root.FactoryPlanner.buildings[a.b].w*root.FactoryPlanner.buildings[a.b].d*a.count);if(order==='reverse')groups.reverse();
for(const g of groups){
const maxDepth=Math.max(...template.groups.map(t=>t.depth)),preferred=strategy.startsWith('depth')?Math.min(floorLimit-1,Math.floor((maxDepth-g.depth)*floorLimit/(maxDepth+1))):Math.min(floorLimit-1,Math.floor(template.groups.findIndex(t=>t.id===g.id)*floorLimit/template.groups.length));
let floorOrder=['pack','rect-pack'].includes(strategy)?Array.from({length:floorLimit},(_,i)=>i):Array.from({length:floorLimit},(_,i)=>(preferred+i)%floorLimit);if(strategy==='depth-desc')floorOrder=floorOrder.map(f=>floorLimit-1-f);
let assigned=false;
if(strategy.startsWith('split')){
assigned=true;for(const original of g.machines){const m=p.machines[original.id];let done=false;const choices=strategy==="split-low"?[...floorOrder].sort((a,b)=>floorLoad[a]-floorLoad[b]):floorOrder;for(const f of choices){const q=place(m,cursors[f],f);if(!q)continue;Object.assign(m,q.point);cursors[f]=q.next;floorLoad[f]+=m.w*m.d;done=true;break}if(!done){assigned=false;break}}
}else{
for(const f of floorOrder){let c={...cursors[f]},positions=[];for(const original of g.machines){const m=p.machines[original.id],q=place(m,c,f);if(!q){positions=[];break}positions.push({m,point:q.point});c=q.next}if(positions.length!==g.count)continue;for(const q of positions)Object.assign(q.m,q.point);cursors[f]=c;assigned=true;break}
}
if(!assigned){failed=true;break}g.machines=g.machines.map(m=>p.machines[m.id]);const floors=g.machines.map(m=>m.floor).sort((a,b)=>a-b);g.floor=floors[Math.floor(floors.length/2)];
}
if(failed)continue;
const occupied=[...new Set(p.machines.map(m=>m.floor))].sort((a,b)=>a-b),floorMap=new Map(occupied.map((f,i)=>[f,i]));
for(const m of p.machines){m.floor=floorMap.get(m.floor);m.y=0}for(const g of p.groups){g.floor=floorMap.get(g.floor);g.floors=[...new Set(g.machines.map(m=>m.floor))].sort((a,b)=>a-b)}
root.FactoryLogistics.assignFloors(p);if(p.floors.at(-1).ceiling>v.height)continue;
const layoutKey=p.machines.map(m=>[m.x,m.z,m.floor,m.rotation,p.config.allowRotations].join(',')).join(';');if(triedLayouts.has(layoutKey))continue;triedLayouts.add(layoutKey);
if(best)routedAfterFit++;
try{p.logistics=root.FactoryLogistics.calculate(p,root.FactoryPlanner.recipesFor(p.config));check(p);p.fit={attempts,repacked:true,strategy,gap,padding,usedFloors:occupied.length,maxFloors,floorMode:config.floors==='auto'?'auto':'limit'};validLayouts++;valid.push(p);if(!best){best=p;firstFitAttempt=attempts}else if(root.FactoryLogistics.compareConstruction([p],[best])<0)best=p;if(validLayouts>=3)return finish()}catch(e){if(e.code!=='volume-fit'&&!/развести конвейеры|разместить узлы|подход к порту/.test(e.message))throw e}
}
if(best)return finish();
}
throw new FitError('Не удалось найти размещение в одном модуле после '+attempts+' вариантов распределения по этажам и сборки коммуникаций.');
}
function propose(config,raw){const full=raw({...config,floors:config.floors==='auto'?1:config.floors,_layoutOnly:true}),candidates=[];
const fitModule=c=>{const outer=root.FactoryCheckBudget,end=performance.now()+12000;root.FactoryCheckBudget=()=>{outer?.();if(performance.now()>end)throw Object.assign(Error('Нужен меньший модуль'),{code:'module-timeout'})};try{try{return plan({...c,_efficiencyBudget:64},raw)}catch(e){if(!['volume-fit','flow-invalid'].includes(e.code)||c._compactSupply)throw e;const p=plan({...c,_compactSupply:true,_efficiencyBudget:64},raw);p.fit.efficiencyFallback=true;return p}}finally{root.FactoryCheckBudget=outer}};
const retryable=e=>['volume-fit','module-timeout'].includes(e.code);
if(config.independentModules)return componentModules(config,raw,full,fitModule);
// Preserve the minimum final-machine count: first separate the complete
// ingredient frontier, instead of duplicating a throttled end-to-end factory.
if(full.groups.length>1){const outer=root.FactoryCheckBudget,end=performance.now()+12000;root.FactoryCheckBudget=()=>{outer?.();if(performance.now()>end)throw Object.assign(Error('Нужен меньший модуль'),{code:'module-timeout'})};
try{const recipes=root.FactoryPlanner.recipesFor(config),upMachines=full.machines.filter(m=>m.group!==config.product),upPower=upMachines.reduce((s,m)=>s+root.FactoryPlanner.buildings[m.b].power*Math.pow(m.clock,1.321928),0),template=mergeTemplate(config,[{...full,machines:upMachines,power:upPower}]);
const upstream=plan({...template.config,_efficiencyBudget:32},()=>template),external=[...new Set([...(config.external||[]),...Object.keys(recipes[config.product].ins)])],downstream=fitModule({...config,external});
candidates.push({kind:'stages',modules:[upstream,downstream]});
}catch(e){if(!retryable(e))throw e}finally{root.FactoryCheckBudget=outer}}
const cuts=full.groups.filter(g=>g.id!==config.product).map(g=>{const external=[...new Set([...(config.external||[]),g.id])],down=raw({...config,external,floors:config.floors==='auto'?1:config.floors,_layoutOnly:true}),up=raw({...config,product:g.id,rate:down.imports[g.id],floors:config.floors==='auto'?1:config.floors,_layoutOnly:true});return {g,external,count:down.machines.length+up.machines.length,largest:Math.max(down.machines.length,up.machines.length)}}).sort((a,b)=>a.count-b.count||a.largest-b.largest);
let extraCuts=0,cutAttempts=0;for(const {g,external,count} of cuts){if(++cutAttempts>3)break;if(candidates.length&&++extraCuts>2)break;try{const downstream=fitModule({...config,external}),needed=downstream.imports[g.id],upstream=fitModule({...config,product:g.id,rate:needed});candidates.push({kind:'stages',modules:[upstream,downstream],links:[{item:g.id,rate:needed}],description:'Первый модуль производит '+root.FactoryPlanner.items[g.id]+', второй — готовую продукцию.'})}catch(e){if(!retryable(e))throw e}}
if(candidates.length){candidates.sort((a,b)=>root.FactoryLogistics.compareConstruction(a.modules,b.modules));return compactModules(config,candidates[0].modules)}
// Stage fragments share their output with the next stage. Duplicating complete
// factories prematurely adds low-clock final machines and duplicate upstreams.
try{const half=fitModule({...config,rate:config.rate/2}),q=consolidateParallel(config,half);if(q)return q}catch(e){if(!retryable(e))throw e}
return componentModules(config,raw,full,fitModule);}
function consolidateParallel(config,half){
const recipes=root.FactoryPlanner.recipesFor(config),r=recipes[config.product],clock=config.rate/r.out,ceiling=root.FactoryPlanner.recipeCeiling(config,r,config.product);
if(half.machines.every(m=>m.group===config.product)||clock>ceiling+1e-7||half.machines.filter(m=>m.group===config.product).length!==1)return null;
const plans=[];
for(const sink of [false,true]){const old=structuredClone(half);if(sink){const final=old.machines.find(m=>m.group===config.product);final.clock=clock;final.shards=Math.max(0,Math.ceil((clock-1)*2-1e-8))}else old.machines=old.machines.filter(m=>m.group!==config.product);
old.power=old.machines.reduce((s,m)=>s+root.FactoryPlanner.buildings[m.b].power*Math.pow(m.clock,1.321928),0);let p=mergeTemplate(config,[old]);
for(let i=0;i<p.machines.length;i++)Object.assign(p.machines[i],{x:old.machines[i].x,z:old.machines[i].z,rotation:old.machines[i].rotation??0,w:old.machines[i].w,d:old.machines[i].d,floor:old.machines[i].floor});
root.FactoryLogistics.assignFloors(p);p.bounds=volume(config);for(const g of p.groups){g.machines=p.machines.filter(m=>m.group===g.id);g.floors=[...new Set(g.machines.map(m=>m.floor))];g.floor=g.floors[0]}
p.config={...p.config,allowRotations:true,junctionSpacing:8,terminalMode:'compact'};try{p.logistics=root.FactoryLogistics.calculate(p,recipes)}catch(e){if(e.code!=='volume-fit'&&!/развести конвейеры|разместить узлы|подход к порту/.test(e.message))throw e;const template=p;p=plan({...p.config,_efficiencyBudget:32},()=>template)}check(p);const own=!!p.fit;p.fit={...(p.fit??half.fit),strategy:'shared-final-stage',usedFloors:p.floors.length,repacked:true};if(!own){delete p.fit.alternatives;delete p.fit.optimization}plans.push(p)}
const links=Object.entries(plans[0].exports).filter(([item])=>plans[1].imports[item]&&!(config.externalFeedbackItems??[]).includes(item)).map(([item,rate])=>({item,rate}));checkPerformanceLoad(plans);if(!config.allowFeedback&&!moduleOrder(plans))throw new FitError('Модули образуют обратный поток.');
return {kind:'stages',modules:plans,links,description:'Подготовка ресурсов разделена, финальное производство сосредоточено в одном модуле. Потоки идут только вперёд.'};
}
function componentModules(config,raw,full,fitModule){
const modules=[],links=[];let completed=0;
for(const g of full.groups){root.FactoryCheckBudget?.();root.FactoryProgress?.({stage:'modules',percent:82+12*completed/full.groups.length,message:'Собираем отдельные модули: '+root.FactoryPlanner.items[g.id]+' · готово '+modules.length});
 const external=[...new Set([...(config.external||[]),...Object.keys(root.FactoryPlanner.recipesFor(config)[g.id].ins)])];let fitted=null;
 const counts=[...new Set([1,2,4,8,g.count].filter(n=>n<=g.count))].sort((a,b)=>a-b);
 const tryCount=count=>{try{fitted={p:fitModule({...config,product:g.id,rate:g.rate/count,external,_compactSupply:true}),count};return true}catch(e){if(!['volume-fit','module-timeout'].includes(e.code))throw e;return false}};
 let failed=0;for(const count of counts){if(tryCount(count))break;failed=count}
 // The ladder skips counts; bisect between the last failure and the first fit so 3 modules are not rounded up to 4.
 if(fitted)for(let hi=fitted.count,mid=failed+hi>>1;hi-failed>1;mid=failed+hi>>1){if(tryCount(mid))hi=mid;else failed=mid}
 if(!fitted)throw new FitError('Даже отдельный станок для «'+root.FactoryPlanner.items[g.id]+'» с коммуникациями не удалось разместить в выбранных границах. Увеличьте размер модуля.');
 for(let i=0;i<fitted.count;i++)modules.push(structuredClone(fitted.p));completed++;
}
return compactModules(config,modules);}
function mergeTemplate(config,plans){
const recipes=root.FactoryPlanner.recipesFor(config),machines=[],groups=[],imports={},exports={},connections=[],produced={},consumed={};
for(const p of plans)for(const original of p.machines){const m={...original,id:machines.length,floor:0,y:0};delete m.supplyTo;machines.push(m)}
for(const id of new Set(machines.map(m=>m.group))){const list=machines.filter(m=>m.group===id),r=recipes[id],rate=list.reduce((sum,m)=>sum+r.out*m.clock,0);for(const [item,n] of Object.entries(root.FactoryPlanner.outputs(r,id)))produced[item]=(produced[item]??0)+list.reduce((sum,m)=>sum+n*m.clock,0);groups.push({id,b:r.b,count:list.length,clock:rate/r.out/list.length,clockCeiling:root.FactoryPlanner.recipeCeiling(config,r,id),depth:Math.max(...plans.flatMap(p=>p.groups.filter(g=>g.id===id).map(g=>g.depth))),floor:0,rate,machines:list});for(const [item,n] of Object.entries(r.ins)){const amount=rate*n/r.out;consumed[item]=(consumed[item]??0)+amount;connections.push({from:item,to:id,rate:amount,lanes:Math.ceil(amount/root.FactoryPlanner.transportCapacity(config,item))})}}
for(const id of new Set([...Object.keys(produced),...Object.keys(consumed)])){if((config.externalFeedbackItems??[]).includes(id)){if(consumed[id]>1e-6)imports[id]=consumed[id];if(produced[id]>1e-6)exports[id]=produced[id];continue}const balance=(produced[id]??0)-(consumed[id]??0);if(balance>1e-6)exports[id]=balance;else if(balance<-1e-6)imports[id]=-balance}
const product=exports[config.product]?config.product:Object.keys(exports)[0];if(!product)throw new FitError('У объединённого модуля нет выхода.');
const v=volume(config),p={config:{...config,product,rate:exports[product],external:Object.keys(imports),_compactSupply:true},exports,imports,machines,groups,connections,width:v.width,length:v.length,power:plans.reduce((sum,p)=>sum+p.power,0),shards:machines.reduce((sum,m)=>sum+(m.shards??0),0)};root.FactoryLogistics.assignFloors(p);return p;
}
// Check the whole quotient graph: merging the ends of A -> B -> C creates
// a cycle even when A and C have no direct connection to each other.
function moduleFeeds(source,target){return Object.entries(source.exports??{[source.config.product]:source.config.rate}).some(([item,rate])=>rate>1e-6&&(target.imports[item]??0)>1e-6&&!(target.config.externalFeedbackItems??[]).includes(item))}
function moduleOrder(modules){
const adj=modules.map(()=>[]),degree=modules.map(()=>0);
for(let i=0;i<modules.length;i++)for(let j=0;j<modules.length;j++)if(i!==j&&moduleFeeds(modules[i],modules[j])){adj[i].push(j);degree[j]++}
const ready=degree.map((n,i)=>n===0?i:-1).filter(i=>i>=0),order=[];while(ready.length){const i=ready.shift();order.push(i);for(const j of adj[i])if(--degree[j]===0)ready.push(j)}return order.length===modules.length?order:null;
}
function compactModules(config,original){
if(!config.allowFeedback&&!moduleOrder(original)){
 // Fluid recovery can couple two recipes in a loop. Keep each strongly
 // connected component in one module so connections between modules stay forward.
 const output=p=>p.exports??{[p.config.product]:p.config.rate},reach=original.map((p,i)=>original.map((q,j)=>i===j||moduleFeeds(p,q)));
 for(let k=0;k<original.length;k++)for(let i=0;i<original.length;i++)for(let j=0;j<original.length;j++)reach[i][j]||=reach[i][k]&&reach[k][j];
 const seen=new Set(),bundles=[];for(let i=0;i<original.length;i++){if(seen.has(i))continue;const group=original.filter((_,j)=>reach[i][j]&&reach[j][i]);for(let j=0;j<original.length;j++)if(reach[i][j]&&reach[j][i])seen.add(j);
 if(group.length===1){bundles.push(group[0]);continue}const template=mergeTemplate(config,group);try{bundles.push(plan({...template.config,_efficiencyBudget:64},()=>template))}catch(e){if(e.code!=='volume-fit')throw e;throw Object.assign(new FitError('Этапы с возвратом побочного ресурса не помещаются вместе. Можно разрешить обратные связи или получать возвращаемый ресурс снаружи.'),{feedbackItems:[...new Set(group.flatMap(p=>Object.keys(output(p))).filter(item=>group.some(p=>(p.imports[item]??0)>0)&&group.some(p=>item!==p.config.product&&(output(p)[item]??0)>0)))],feedback:true})}}
 original=bundles;if(!moduleOrder(original))throw new FitError('Модули образуют обратный поток. Нужно разделить этапы производства.');
}
let bins=original.map((p,i)=>({p,origins:[i]}));const failed=new Set(),end=performance.now()+90000;
const output=p=>p.exports??{[p.config.product]:p.config.rate};
while(bins.length>1&&performance.now()<end){try{root.FactoryCheckBudget?.()}catch(e){if(e.code==='planning-timeout')break;throw e}const pairs=[];
 for(let i=0;i<bins.length;i++)for(let j=i+1;j<bins.length;j++){const key=[...bins[i].origins,...bins[j].origins].sort((a,b)=>a-b).join(',');if(failed.has(key))continue;const a=bins[i].p,b=bins[j].p;if(config.independentModules&&new Set([...a.groups,...b.groups].map(g=>g.id)).size>1)continue;{const combined=mergeTemplate(config,[a,b]);if(!config.allowFeedback&&!moduleOrder([...bins.filter((_,k)=>k!==i&&k!==j).map(b=>b.p),combined]))continue}const shared=Object.entries(output(a)).reduce((s,[id,n])=>s+Math.min(n,b.imports[id]??0),0)+Object.entries(output(b)).reduce((s,[id,n])=>s+Math.min(n,a.imports[id]??0),0);pairs.push({i,j,key,shared,same:a.groups.length===1&&b.groups.length===1&&a.groups[0].id===b.groups[0].id?1:0,size:a.machines.length+b.machines.length})}
 pairs.sort((a,b)=>b.same-a.same||b.shared-a.shared||a.size-b.size);let merged=false;
 for(const pair of pairs){if(performance.now()>=end)break;try{root.FactoryProgress?.({stage:'modules',percent:94,message:'Уплотняем производство по этажам: '+bins.length+' модулей · объединяем этапы'})}catch(e){if(e.code==='planning-timeout')break;throw e}const a=bins[pair.i],b=bins[pair.j],template=mergeTemplate(config,[a.p,b.p]),outer=root.FactoryCheckBudget,attemptEnd=Math.min(end,performance.now()+5000);root.FactoryCheckBudget=()=>{outer?.();if(performance.now()>attemptEnd)throw Object.assign(Error('Время объединения этапов истекло'),{code:'module-timeout'})};
  try{let p;try{p=stackCandidate(config,[a.p,b.p],template)}catch(e){if(!['volume-fit'].includes(e.code))throw e;p=plan({...template.config,_efficiencyBudget:48},()=>template)}bins=bins.filter((_,i)=>i!==pair.i&&i!==pair.j);bins.push({p,origins:[...a.origins,...b.origins]});merged=true;break}catch(e){if(e.code==='planning-timeout')break;if(!['volume-fit','module-timeout'].includes(e.code))throw e;failed.add(pair.key)}finally{root.FactoryCheckBudget=outer}
 }
 if(!merged)break;
}
const modules=bins.map(b=>b.p),links=[];
for(const item of new Set(modules.flatMap(p=>Object.keys(output(p))))){const rate=modules.reduce((sum,p)=>sum+(p.imports[item]??0),0);if(rate>1e-6&&!(config.externalFeedbackItems??[]).includes(item))links.push({item,rate})}
{const order=moduleOrder(modules);if(!order&&!config.allowFeedback)throw new FitError('Модули образуют обратный поток.');const sorted=(order??modules.map((_,i)=>i)).map(i=>modules[i]);modules.splice(0,modules.length,...sorted)}checkPerformanceLoad(modules);
return {kind:'stages',modules,links,description:'Этапы размещены в модулях с использованием доступных этажей (до уплотнения: '+original.length+'). Общий целевой выпуск сохранён.'+(config.independentModules?' Производство разделено по рецептам; части одного этапа уплотняются вместе.':' Совместимые этапы объединены для уменьшения количества модулей.')+(config.allowFeedback?' Обратные связи разрешены.':' Все поставки направлены только вперёд.')};}
function stackCandidate(config,plans,template){
const exports=p=>p.exports??{[p.config.product]:p.config.rate};
if(!plans.some((p,i)=>plans.some((q,j)=>i!==j&&Object.keys(exports(p)).some(item=>(q.imports[item]??0)>1e-7&&!(q.config.externalFeedbackItems??[]).includes(item)))))return stackIndependent(config,plans,template);
const p=structuredClone(template);let floor=0,index=0;
for(const plan of plans){for(const original of plan.machines){Object.assign(p.machines[index++],{x:original.x,z:original.z,rotation:original.rotation??0,w:original.w,d:original.d,floor:floor+original.floor})}floor+=plan.fit.usedFloors}
if(config.floors!=='auto'&&floor>config.floors)throw new FitError('Превышен максимум этажей.');
root.FactoryLogistics.assignFloors(p);p.bounds=volume(config);if(p.floors.at(-1).ceiling>p.bounds.height)throw new FitError('Превышена высота чертежа.');
for(const g of p.groups){g.machines=p.machines.filter(m=>m.group===g.id);g.floors=[...new Set(g.machines.map(m=>m.floor))];g.floor=g.floors[0]}
p.config={...p.config,allowRotations:true,junctionSpacing:8,terminalMode:'compact'};try{p.logistics=root.FactoryLogistics.calculate(p,root.FactoryPlanner.recipesFor(p.config))}catch(e){if(/развести конвейеры|разместить узлы|подход к порту/.test(e.message))throw new FitError(e.message);throw e}check(p);p.fit={usedFloors:floor,maxFloors:config.floors,floorMode:config.floors==='auto'?'auto':'limit',strategy:'stacked-stages',repacked:true};return p;
}
function stackIndependent(config,plans,template){
const p=structuredClone(template),graph={...structuredClone(plans[0].logistics),nodes:[],edges:[],routes:[],manifolds:[],transfers:[],liftPositions:[],colors:{},products:[]};p.floors=[];let y=0,floor=0,machineIndex=0;
for(const original of plans){const q=structuredClone(original),mOffset=machineIndex,seen=new Set(),shift=v=>{if(v&&!seen.has(v)){seen.add(v);v[1]+=y}},port=ep=>shift(ep?.point);
 for(const m of q.machines){Object.assign(p.machines[machineIndex++],{x:m.x,z:m.z,rotation:m.rotation??0,w:m.w,d:m.d,y:m.y+y,floor:m.floor+floor})}
 for(const n of q.logistics.nodes){shift(n.point);for(const ep of Object.values(n.ports).flat())port(ep);n.id=graph.nodes.length;n.floor+=floor;graph.nodes.push(n)}
 for(const e of q.logistics.edges){port(e.from);port(e.to);e.points.forEach(shift);e.id=graph.edges.length;graph.edges.push(e);graph.routes.push(e.points)}
 for(const manifold of q.logistics.manifolds){manifold.floor+=floor;for(const lane of [...manifold.outputs,...Object.values(manifold.inputs).flat()]){lane.floor+=floor;lane.machines=lane.machines.map(id=>id+mOffset)}graph.manifolds.push(manifold)}
 for(const t of q.logistics.transfers){port(t.targetPort);graph.transfers.push(t)}
 for(const lift of q.logistics.liftPositions){lift.minY+=y;lift.maxY+=y;graph.liftPositions.push(lift)}
 Object.assign(graph.colors,q.logistics.colors);
 const top=Math.max(q.floors.at(-1).ceiling+y,...q.logistics.edges.flatMap(e=>e.points.map(v=>v[1]+.8)),...q.logistics.nodes.map(n=>n.point[1]+2.3));
 for(const f of q.floors)p.floors.push({...f,index:floor+f.index,y:f.y+y,ceiling:f.ceiling+y});
 const last=p.floors.at(-1);last.ceiling=Math.ceil(top);last.height=last.ceiling-last.y;y=last.ceiling;floor+=q.fit.usedFloors;
}
if(config.floors!=='auto'&&floor>config.floors)throw new FitError('Превышен максимум этажей.');
p.bounds=volume(config);for(const g of p.groups){g.machines=p.machines.filter(m=>m.group===g.id);g.floors=[...new Set(g.machines.map(m=>m.floor))];g.floor=g.floors[0]}
graph.products=Object.keys(graph.colors);for(const e of graph.edges)e.color=graph.colors[e.item];graph.splitters=graph.nodes.filter(n=>n.type==='splitter').length;graph.mergers=graph.nodes.filter(n=>n.type==='merger').length;graph.lifts=graph.liftPositions.length;p.logistics=graph;
check(p);graph.collisionCheck=root.FactoryLogistics.checkBeltCollisions(graph);graph.equipmentCheck=root.FactoryLogistics.checkEquipmentCollisions(p,graph);if(!graph.collisionCheck.valid||!graph.equipmentCheck.valid)throw new FitError('Коммуникации этажей пересекаются.');graph.flowCheck=root.FactoryLogistics.checkFlows(p,root.FactoryPlanner.recipesFor(p.config));p.fit={usedFloors:floor,maxFloors:config.floors,floorMode:config.floors==='auto'?'auto':'limit',strategy:'stacked-independent',repacked:true};return p;
}

const api={consolidateParallel,compactModules,moduleOrder,presets,volume,check,plan,propose,FitError,performanceLimits,checkPerformanceConfig,performanceLoad,checkPerformanceLoad,framePerformance};root.FactoryBounded=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
