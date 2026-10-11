function buttonIcon(name,label){const shapes={"play":"<path d=\"m8 5 11 7-11 7Z\"/>","stop":"<rect x=\"6\" y=\"6\" width=\"12\" height=\"12\" rx=\"1\"/>","reset":"<path d=\"M3 10a9 9 0 1 1 2 8M3 4v6h6\"/>","expand":"<path d=\"M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5\"/>","collapse":"<path d=\"M3 8h5V3m8 0v5h5M8 21v-5H3m18 0h-5v5\"/>","arrow":"<path d=\"M7 17 17 7M7 7h10v10\"/>","close":"<path d=\"m6 6 12 12M6 18 18 6\"/>"};return '<svg class="button-icon" aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+shapes[name]+'</svg><span>'+label+'</span>'}
const P=FactoryPlanner,$=id=>document.getElementById(id),fmt=n=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(n);
const plural=(n,one,few,many)=>{const v=Math.abs(n)%100;return n+' '+(v>=11&&v<=14?many:v%10===1?one:v%10>=2&&v%10<=4?few:many)};
const pipeLabel=document.createElement('label');pipeLabel.textContent='Трубопроводы';const pipeSelect=document.createElement('select');pipeSelect.id='pipe-capacity';pipeSelect.add(new Option('Mk.1 · 300 м³ / мин','300'));pipeSelect.add(new Option('Mk.2 · 600 м³ / мин','600'));pipeLabel.append(pipeSelect);$('belt').closest('label').after(pipeLabel);
const flowUnit=item=>P.isFluid(item)?'м³':'шт';
const usedFloors=p=>p.fit?.usedFloors??p.config.floors;
let plannerWorker,requestId=0;const pendingPlans=new Map();
function bootPlannerWorker(){
 if(plannerWorker)return;
 plannerWorker=new Worker('planner-worker.js');
 plannerWorker.onmessage=({data})=>{const pending=pendingPlans.get(data.id);if(!pending)return;if(data.progress){if(data.progress.split&&!pending.modulesOnly){pending.modulesOnly=true;armPlanTimeout(data.id,pending)}generationProgress(data.progress);return}clearTimeout(pending.timer);pendingPlans.delete(data.id);if(data.error)pending.reject(Object.assign(new Error(data.error.message),data.error));else pending.resolve(data.result)};
 plannerWorker.onerror=()=>{for(const pending of pendingPlans.values()){clearTimeout(pending.timer);pending.reject(new Error('Ошибка фонового расчёта. Обновите страницу.'))}pendingPlans.clear();plannerWorker.terminate();plannerWorker=null};
}
function armPlanTimeout(id,pending){
 clearTimeout(pending.timer);pending.timer=setTimeout(()=>{
  if(!pendingPlans.has(id))return;
  if(!pending.modulesOnly){plannerWorker.terminate();plannerWorker=null;pending.modulesOnly=true;generationProgress({stage:'modules',split:true,percent:78,message:'Поиск одного модуля занял слишком долго. Планируем отдельные производственные модули'});bootPlannerWorker();armPlanTimeout(id,pending);plannerWorker.postMessage({id,config:pending.config,modulesOnly:true});return}
  pendingPlans.delete(id);pending.reject(new Error('Не удалось завершить разделение на модули за 4 минуты. Увеличьте размер модуля или добавьте внешние поставки.'));plannerWorker.terminate();plannerWorker=null;
 },pending.modulesOnly?240000:FactoryBounded.performanceLimits.generationMs);
}
function planAsync(config){bootPlannerWorker();return new Promise((resolve,reject)=>{const id=++requestId,pending={resolve,reject,config,modulesOnly:false,timer:null};pendingPlans.set(id,pending);armPlanTimeout(id,pending);plannerWorker.postMessage({id,config})})}
let graphView=false,graphPanX=0,graphPanY=0,graphDrag=null,graphZoom=1,graphPlans=null,graphProposal=null,graphFilterKey="";
let modulePlans=[],lastConfig,proposal;let current,angle=-.65,tilt=.65,zoom=1,selected=null,hitboxes=[],panX=0,panY=0;
[...new Set([...Object.keys(P.recipes),...Object.values(P.catalog.recipes).map(r=>r.product)])].forEach(id=>$('product').add(new Option(P.items[id],id)));$('product').value='frame';
function supplies(chosen=[]){const selected=P.catalog.recipes[$('product').dataset.recipeId];if(selected&&!selected.supported){$('supplies').replaceChildren();$('required-imports').hidden=false;$('required-imports').textContent=selected.reason;return}const required=P.dependencies($('product').value,new Set(),{recipeId:$('product').dataset.recipeId||undefined}).filter(id=>!P.recipes[id]&&!['ore','copperOre','coal','limestone','cateriumOre','rawQuartz','sulfur','water','crudeOil','nitrogenGas','bauxite','uranium','sam'].includes(id));$('required-imports').hidden=!required.length;$('required-imports').textContent=required.length?'Доставляются снаружи: '+required.map(id=>P.items[id]).join(', ')+'. Эти компоненты доставляются готовыми; их производство здесь не рассчитывается.':'';$('supplies').replaceChildren();for(const id of P.dependencies($('product').value,new Set(),{recipeId:$('product').dataset.recipeId||undefined}).filter(id=>P.recipes[id]||P.isFluid(id))){const label=document.createElement('label');label.className='supply';const input=document.createElement('input');input.type='checkbox';input.value=id;input.checked=chosen.includes(id);label.append(input,document.createTextNode(P.items[id]));$('supplies').append(label)}}
$('product').onchange=()=>{const selected=P.catalog.recipes[$('product').dataset.recipeId];$('rate').value=selected?.outputs[0].rate??P.recipes[$('product').value].out; supplies()};$('rate').value=P.recipes[$('product').value].out;supplies();
function config(){return {recipeId:$('product').dataset.recipeId||undefined,independentModules:$('independent-modules').checked,allowFeedback:$('allow-feedback').checked,externalFeedbackItems:JSON.parse($('allow-feedback').dataset.externalItems||'[]'),preset:$('preset').value,length:Number($('length').value),height:Number($('height').value),product:$('product').value,rate:Number($('rate').value),floors:$('floors').value==='auto'?'auto':Number($('floors').value),width:Number($('width').value),belt:Number($('belt').value),pipeCapacity:Number($('pipe-capacity').value),liftClearance:Number($('clearance').value),clockLimit:Number($('clock-limit').value),external:[...$('supplies').querySelectorAll('input:checked')].map(e=>e.value)}}
function volumeControls(){const preset=FactoryBounded.presets[$('preset').value],limits=FactoryBounded.performanceLimits;for(const key of ['width','length','height']){if(preset)$(key).value=preset[key];$(key).disabled=!!preset;$(key).max=limits.side}const max=3;for(const option of $('floors').options)option.disabled=Number(option.value)>max;if(Number($('floors').value)>max)$('floors').value=String(max);$('volume-help').textContent='Этажи — максимум. Высота каждого этажа: самый высокий станок + 2 м запаса. Всё оборудование и коммуникации должны помещаться в объём.';const area=Number($('width').value)*Number($('length').value),maxHeight=Math.min(limits.side,Math.floor(limits.volume/area/4)*4);if(Number.isFinite(maxHeight))$('height').max=Math.max(16,maxHeight);$('performance-help').textContent='Для плавного 3D с симуляцией: сторона до '+limits.side+' м, объём до '+fmt(limits.volume)+' м³. При выбранной площади высота до '+Math.max(0,maxHeight)+' м. Плотность завода проверяется отдельно; 60 FPS зависят от устройства.'}
$('preset').onchange=volumeControls;$('height').onchange=volumeControls;volumeControls();
for(const id of ['width','length','height'])$(id).oninput=volumeControls;
let overviewPlan=null;
function modulePoint(v,p,t,inverse=false){const r=t.rotation,W=p.width,D=p.length;if(inverse){const x=v[0]-t.x,z=v[2]-t.z;return r===90?[z,v[1],D-x]:r===180?[W-x,v[1],D-z]:r===270?[W-z,v[1],x]:[x,v[1],z]}const [x,y,z]=v;return r===90?[t.x+D-z,y,t.z+x]:r===180?[t.x+W-x,y,t.z+D-z]:r===270?[t.x+z,y,t.z+W-x]:[t.x+x,y,t.z+z]}
function moduleDirection(v,r){return r===90?[-v[2],v[1],v[0]]:r===180?[-v[0],v[1],-v[2]]:r===270?[v[2],v[1],-v[0]]:[...v]}
function modulePortDirection(port,p){const [x,,z]=port.point,distances=[x,p.width-x,z,p.length-z],i=distances.indexOf(Math.min(...distances));return [[-1,0,0],[1,0,0],[0,0,-1],[0,0,1]][i]}
function arrangeModules(plans,links){
 const ports=plans.map(p=>p.logistics.edges.flatMap(e=>[e.from,e.to].filter(port=>port.kind).map(port=>({port,item:e.item,rate:e.rate})))),placed=new Map([[0,{x:0,z:0,rotation:0,w:plans[0].width,d:plans[0].length}]]),linked=new Set((links??[]).map(l=>l.item));
 const pairs=(i,j)=>ports[i].flatMap(a=>ports[j].filter(b=>a.item===b.item&&a.port.kind!==b.port.kind&&linked.has(a.item)).map(b=>[a,b]));
 while(placed.size<plans.length){const i=placed.size,p=plans[i];let best=null;
 for(const rotation of [0,90,180,270]){const w=rotation%180?p.length:p.width,d=rotation%180?p.width:p.length;
 for(const [j,t] of [[i-1,placed.get(i-1)]]){const candidates=[{x:t.x+t.w+8,z:t.z+(t.d-d)/2}];
 for(const [a,b] of pairs(i,j)){const A=modulePoint(a.port.point,p,{x:0,z:0,rotation}),B=modulePoint(b.port.point,plans[j],t),dir=moduleDirection(modulePortDirection(a.port,p),rotation);for(const candidate of [...candidates]){if(Math.abs(dir[0])>.5)candidates.push({...candidate,z:B[2]-A[2]})}}
 for(const c of candidates){const v={...c,rotation,w,d};if([...placed.values()].some(q=>v.x<q.x+q.w+4&&v.x+w+4>q.x&&v.z<q.z+q.d+4&&v.z+d+4>q.z))continue;let score=0;
 for(const [k,q] of placed)for(const [a,b] of pairs(i,k)){const A=modulePoint(a.port.point,p,v),B=modulePoint(b.port.point,plans[k],q),U=moduleDirection(modulePortDirection(a.port,p),rotation),V=moduleDirection(modulePortDirection(b.port,plans[k]),q.rotation),delta=B.map((n,k)=>n-A[k]),aligned=Math.abs(delta[1])<.1&&U.every((n,k)=>Math.abs(n+V[k])<.1)&&delta.reduce((n,x,k)=>n+x*U[k],0)>0&&delta.every((x,k)=>Math.abs(U[k])>.1||Math.abs(x)<.1);score+=Math.hypot(...delta)*(1+Math.min(2,Math.log1p(a.rate)/3))+ (aligned?-180:0)}
 const rectangles=[...placed.values(),v],left=Math.min(...rectangles.map(t=>t.x)),right=Math.max(...rectangles.map(t=>t.x+t.w)),top=Math.min(...rectangles.map(t=>t.z)),bottom=Math.max(...rectangles.map(t=>t.z+t.d));score+=.35*(right-left)*(bottom-top)+.5*Math.abs((right-left)-(bottom-top));if(!best||score<best.score)best={...v,score};}
 }}placed.set(i,best??{x:Math.max(...[...placed.values()].map(t=>t.x+t.w))+8,z:0,rotation:0,w:p.width,d:p.length});}
 const minX=Math.min(...[...placed.values()].map(t=>t.x)),minZ=Math.min(...[...placed.values()].map(t=>t.z));return plans.map((p,i)=>{const t=placed.get(i);return {...t,x:t.x-minX,z:t.z-minZ}});
}
function buildOverview(plans){
 const p=structuredClone(plans[0]);p.config={...lastConfig??plans[0].config};p.machines=[];p.groups=[];p.logistics.nodes=[];p.logistics.edges=[];p.logistics.transfers=[];p.logistics.colors={};p.imports={};p.exports={};p.power=0;p.connections=[];p.overview=[];
 const placements=arrangeModules(plans,proposal?.links);p.modulePlacements=placements.map((t,i)=>({...t,label:P.items[plans[i].config.product]??plans[i].config.product,floors:plans[i].floors.map(f=>({...f}))}));const levels=[...new Set(plans.flatMap(q=>q.floors.map(f=>f.y)))].sort((a,b)=>a-b);p.floors=levels.map((y,index)=>({index,y,height:Math.max(...plans.flatMap(q=>q.floors.filter(f=>f.y===y).map(f=>f.height))),equipmentHeight:Math.max(...plans.flatMap(q=>q.floors.filter(f=>f.y===y).map(f=>f.equipmentHeight??f.height-2)))}));let offset=0;
 for(const [module,original] of plans.entries()){const q=structuredClone(original),machineBase=p.machines.length,nodeBase=p.logistics.nodes.length,edgeBase=p.logistics.edges.length,t=placements[module];const floor=f=>levels.indexOf(original.floors[f].y),seen=new Set();
  function shift(object){if(!object||typeof object!=='object'||seen.has(object))return;seen.add(object);if(Array.isArray(object)){object.forEach(shift);return}for(const [key,value] of Object.entries(object)){if((key==='point'||key==='from'||key==='to')&&Array.isArray(value)&&value.length===3){const v=modulePoint(value,original,t);value.splice(0,3,...v)}else if(key==='dir'&&Array.isArray(value)){value.splice(0,3,...moduleDirection(value,t.rotation))}else shift(value)}}shift(q.logistics);
  for(const m of q.machines){m.id+=machineBase;const corners=[[m.x,0,m.z],[m.x+m.w,0,m.z+m.d]].map(v=>modulePoint(v,original,t));m.x=Math.min(...corners.map(v=>v[0]));m.z=Math.min(...corners.map(v=>v[2]));if(t.rotation%180)[m.w,m.d]=[m.d,m.w];m.rotation=((m.rotation??0)+t.rotation)%360;m.floor=floor(m.floor)}for(const n of q.logistics.nodes){n.id+=nodeBase;n.floor=floor(n.floor)}for(const e of q.logistics.edges){e.id+=edgeBase;e.points=original.logistics.edges[e.id-edgeBase].points.map(v=>modulePoint(v,original,t));p.overview.push({id:e.id,module,original:e.id-edgeBase,transform:t})}
  for(const g of q.groups){const oldFloor=g.floor;g.floor=floor(oldFloor);g.floors=(g.floors??[oldFloor]).map(f=>floor(f))}p.machines.push(...q.machines);p.groups.push(...q.groups);p.logistics.nodes.push(...q.logistics.nodes);p.logistics.edges.push(...q.logistics.edges);p.logistics.transfers.push(...q.logistics.transfers);Object.assign(p.logistics.colors,q.logistics.colors);p.power+=q.power;p.connections.push(...q.connections);for(const field of ['imports','exports'])for(const [id,n] of Object.entries(q[field]??{}))p[field][id]=(p[field][id]??0)+n;offset+=q.width+24;
 }
 p.width=Math.max(...placements.map(t=>t.x+t.w));p.length=Math.max(...placements.map(t=>t.z+t.d));p.bounds={width:p.width,length:p.length,height:Math.max(...plans.map(q=>q.bounds?.height??q.floors.at(-1).y+q.floors.at(-1).height))};p.config.floors=p.floors.length;p.fit={usedFloors:p.floors.length};
 for(const link of proposal?.links??[]){const exports=p.logistics.edges.filter(e=>e.item===link.item&&e.to.kind==='export').map(e=>({e,remaining:e.rate})),imports=p.logistics.edges.filter(e=>e.item===link.item&&e.from.kind==='import');for(const input of imports){let remaining=input.rate;for(const source of exports){if(remaining<1e-6)break;if(source.remaining<1e-6||p.overview.find(v=>v.id===source.e.id).module===p.overview.find(v=>v.id===input.id).module)continue;const rate=Math.min(remaining,source.remaining);remaining-=rate;source.remaining-=rate;const a=source.e.to.point,b=input.from.point,U=(()=>{const v=p.overview.find(v=>v.id===source.e.id);return moduleDirection(modulePortDirection(plans[v.module].logistics.edges[v.original].to,plans[v.module]),v.transform.rotation)})(),V=(()=>{const v=p.overview.find(v=>v.id===input.id);return moduleDirection(modulePortDirection(plans[v.module].logistics.edges[v.original].from,plans[v.module]),v.transform.rotation)})(),delta=b.map((n,k)=>n-a[k]),direct=Math.abs(delta[1])<.1&&U.every((n,k)=>Math.abs(n+V[k])<.1)&&delta.reduce((n,x,k)=>n+x*U[k],0)>0&&delta.every((n,k)=>Math.abs(U[k])>.1||Math.abs(n)<.1),id=p.logistics.edges.length,depth=-2-(id-p.overview.length)*1.1,A=a.map((n,k)=>n+U[k]*2),B=b.map((n,k)=>n+V[k]*2),points=direct?[a,b]:[a,A,[A[0],depth,A[2]],[A[0],depth,B[2]],[B[0],depth,B[2]],B,b];p.logistics.edges.push({id,item:link.item,color:p.logistics.colors[link.item],kind:P.isFluid(link.item)?'pipe':'belt',rate,capacity:source.e.capacity,points:points.filter((v,i)=>!i||v.some((n,k)=>Math.abs(n-points[i-1][k])>1e-6)),from:{point:a,dir:U},to:{point:b,dir:V},pumps:[],interModule:true,direct,source:p.overview.find(v=>v.id===source.e.id),destination:p.overview.find(v=>v.id===input.id)})}}}

 p.logistics.products=Object.keys(p.logistics.colors);p.logistics.routes=p.logistics.edges.map(e=>e.points);p.logistics.flowCheck=null;p.logistics.collisionCheck=null;p.logistics.equipmentCheck=null;p.logistics.liftPositions=[];return p;
}
function overviewSimulation(){
 if(!simulation||!current.overview)return simulation;const plan=current;plan.bridgePaths??=new Map();plan.simulationPaths??=new Map();const overviewById=plan.overviewById??=new Map(plan.overview.map(e=>[e.id,e])),overviewByOriginal=plan.overviewByOriginal??=new Map(plan.overview.map(e=>[e.module+":"+e.original,e])),bridges=plan.simulationBridges??=plan.logistics.edges.filter(e=>e.interModule);let cachedParticles;
 return {modules:[{machines:plan.machines.map((m,i)=>{let index=i;for(const module of simulation.modules){if(index<module.machines.length)return {...module.machines[index],m};index-=module.machines.length}})}],
 setPath(index,id,path){const v=overviewById.get(id);if(v){if(plan.simulationPaths.get(id)?.source!==path){const local=path.map(pt=>modulePoint(pt,modulePlans[v.module],v.transform,true));plan.simulationPaths.set(id,{source:path,local})}simulation.setPath(v.module,v.original,plan.simulationPaths.get(id).local)}else plan.bridgePaths.set(id,path)},
 particles(){if(cachedParticles)return cachedParticles;const particles=simulation.modules.flatMap(module=>simulation.particles(module.index).map(pt=>{const v=overviewByOriginal.get(module.index+":"+pt.edgeId);return {...pt,edgeId:v.id,point:modulePoint(pt.point,modulePlans[module.index],v.transform),direction:moduleDirection(pt.direction,v.transform.rotation)}}));
 for(const event of simulation.transferEvents??[]){const age=simulation.time-event.time;if(event.phase!=='out'||age<0||age>=(event.duration??1))continue;for(const edge of bridges.filter(e=>(event.routeId===undefined||e.id===event.routeId)&&e.item===event.item&&e.source.module===event.module&&(event.edgeId===undefined||e.source.original===event.edgeId))){const path=plan.bridgePaths.get(edge.id)??edge.points,length=path.slice(1).reduce((sum,v,i)=>sum+Math.hypot(...v.map((n,k)=>n-path[i][k])),0),distance=age/(event.duration??1)*length,point=FactorySimulation.position(path,distance),ahead=FactorySimulation.position(path,Math.min(length,distance+.05)),behind=FactorySimulation.position(path,Math.max(0,distance-.05));particles.push({id:'bridge:'+event.id+':'+edge.id,item:event.item,edgeId:edge.id,point,direction:ahead.map((n,k)=>n-behind[k]),fluid:P.isFluid(event.item),amount:1})}}
 return cachedParticles=particles;}};
}

function showModules(plans){stopSimulation();modulePlans=plans;overviewPlan=null;current=plans[0];selected=null;canvas.style.visibility='visible';gpuCanvas.style.visibility='visible';$('selection').hidden=true;const select=$('module-view');select.replaceChildren();if(plans.length>1)select.add(new Option('Все модули','all'));plans.forEach((p,i)=>select.add(new Option(plans.length===1?'Один модуль':'Модуль '+(i+1)+' · '+Object.keys(p.exports??{[p.config.product]:p.config.rate}).map(id=>P.items[id]).join(' + '),String(i))));select.value='0';select.disabled=plans.length===1;syncVisualization();render();}
let generationBusy=false,generationCancelled=false,confirmationPending=false,progressTimer=null,progressValue=0,progressCeiling=12;
function showError(message,feedback=null){for(const id of ['retry-feedback','retry-external']){const button=$(id);button.hidden=!feedback;button.onclick=()=>{$('error-modal').close();if(id==='retry-feedback'){$('allow-feedback').checked=true;$('allow-feedback').dataset.externalItems='[]'}else{const c=config();$('allow-feedback').dataset.externalItems=JSON.stringify(feedback.feedbackItems);supplies([...new Set([...c.external,...feedback.feedbackItems])]);$('allow-feedback').checked=false}generate()}};$('error').textContent='';$('error-message').textContent=message;if(!$('error-modal').open)$('error-modal').showModal()}
$('error-close').onclick=()=>$('error-modal').close();
$('info-close').onclick=()=>$('info-modal').close();
$('generation-loader').addEventListener('cancel',e=>{e.preventDefault();cancelGeneration()});
$('cancel-generation').onclick=cancelGeneration;
function cancelGeneration(){if(!generationBusy||$('cancel-generation').disabled)return;generationCancelled=true;$('cancel-generation').disabled=true;$('loader-description').textContent='Отменяем генерацию…';plannerWorker?.terminate();plannerWorker=null;for(const pending of pendingPlans.values()){clearTimeout(pending.timer);pending.reject(Object.assign(new Error('Генерация отменена'),{cancelled:true}))}pendingPlans.clear()}
function syncVisualization(){const empty=!current;viewport.classList.toggle('empty',empty);$('visualization-empty').hidden=!empty;for(const control of viewport.querySelectorAll('button,select,input,summary')){if(control.tagName==='SUMMARY'){control.style.pointerEvents=empty?'none':'';control.setAttribute('aria-disabled',String(empty))}else control.disabled=empty}if(!empty){for(const id of ['floor-view','flow-view','view-style'])$(id).disabled=graphView;$('module-view').disabled=graphView||modulePlans.length===1}if(empty){$('selection').hidden=true;graphHost.replaceChildren();graphHost.__selectedNode=null}}

function showInfo(message,title='Информация о заводе'){$('info-title').textContent=title;$('info-message').textContent=message;$('info-modal').showModal()}
const generationMessages={
 preparation:[
 'Сначала выясняем, какие компоненты нужны для выбранного продукта.',
 'Разбираем рецепт на понятную цепочку: от сырья до готового изделия.',
 'Считаем выпуск, который должен обеспечить каждый этап производства.',
 'Учитываем компоненты, которые вы решили доставлять снаружи.',
 'Подбираем количество станков под заданный выпуск.',
 'Сверяем входы и выходы рецептов, включая побочные продукты.',
 'Учитываем выбранный разгон и расход ингредиентов.',
 'Готовим список оборудования для вашего завода.'
 ],
 layout:[
 'Ищем расположение, в котором станки поместятся в выбранный объём.',
 'Сравниваем варианты размещения оборудования по этажам.',
 'Проверяем, хватает ли высоты для самых высоких станков.',
 'Пробуем разные повороты станков, чтобы удобнее соединить их.',
 'Ищем место для оборудования и его входов и выходов.',
 'Стараемся разместить связанные этапы ближе друг к другу.',
 'Подбираем компоновку с учётом размеров каждого здания.',
 'Ищем сочетание плотного размещения и коротких соединений.'
 ],
 routing:[
 'Соединяем выходы станков со входами следующих этапов.',
 'Подбираем маршруты доставки компонентов между станками.',
 'Распределяем подачу по нескольким линиям, где это необходимо.',
 'Собираем соединения через разветвители и объединители.',
 'Прокладываем конвейеры с учётом выбранной пропускной способности.',
 'Разводим маршруты по высоте, когда прямой путь занят.',
 'Соединяем внешние поставки с производственными линиями.',
 'Проверяем пути отвода готовой продукции и побочных продуктов.'
 ],
 optimization:[
 'Ищем более короткие пути между уже размещёнными станками.',
 'Проверяем, где можно сократить длину соединений.',
 'Сравниваем маршруты с разным числом подъёмников.',
 'Проверяем пересечения независимых производственных линий.',
 'Ищем обходы там, где оборудование мешает прямому соединению.',
 'Уточняем повороты и высоты маршрутов.',
 'Сравниваем варианты соединений для одной и той же цепочки.',
 'Стараемся уменьшить лишние переходы между уровнями.'
 ],
 modules:[
 'Подбираем отдельные модули для этапов производственной цепочки.',
 'Проверяем, какие этапы можно разместить в общем модуле.',
 'Распределяем оборудование между модулями выбранного размера.',
 'Согласуем выпуск одного модуля с потребностями следующего.',
 'Проверяем поставки компонентов между отдельными модулями.',
 'Ищем возможность объединить совместимые этапы производства.',
 'Подбираем этажи для оборудования внутри каждого модуля.',
 'Сравниваем варианты разделения большой производственной цепочки.'
 ],
 validation:[
 'Проверяем, что входные потоки соответствуют расходу рецептов.',
 'Сверяем итоговый выпуск с вашей производственной задачей.',
 'Проверяем размещение оборудования в границах модуля.',
 'Уточняем, куда направлены все выходы производства.',
 'Сверяем пропускную способность линий с потоком компонентов.',
 'Проверяем связи между этапами готового плана.',
 'Собираем сведения о станках, поставках и энергопотреблении.',
 'Готовим производственную цепочку к показу в 3D.'
 ],
 tips:[
 'Чем ближе связанные станки, тем короче путь компонентов между ними.',
 'Количество этажей задаёт предел: завод может занять меньше этажей.',
 'Высота этажа зависит от самого высокого станка на нём.',
 'Внешние поставки позволяют исключить часть промежуточного производства.',
 'Разгон станка увеличивает и выпуск, и расход ингредиентов.',
 'Быстрая лента помогает только тогда, когда предыдущий этап даёт достаточно предметов.',
 'Побочные продукты тоже требуют отвода из станка.',
 'Ленты переносят предметы, а трубы — жидкости и газы.',
 'Потоки предметов считаются в штуках в минуту, жидкости — в кубометрах в минуту.',
 'Один рецепт может давать сразу несколько полезных продуктов.',
 'Альтернативный рецепт может изменить состав и размеры всей цепочки.',
 'Один дополнительный станок иногда помогает распределить нагрузку между линиями.',
 'Пропускная способность линии ограничивает поток даже при разгоне станков.',
 'Разветвитель распределяет подачу, а объединитель собирает несколько потоков.',
 'Подъёмники помогают доставлять предметы между уровнями.',
 'Компактный завод требует места не только для станков, но и для соединений.',
 'Поворот здания меняет положение его входов и выходов.',
 'Сырьё поступает в план снаружи; промежуточные продукты можно производить внутри.',
 'В симуляции станок ждёт полного набора ингредиентов для следующего цикла.',
 'В начале симуляции лентам и внутренним буферам нужно время на заполнение.',
 'Если выход заполнен, станок ждёт, пока продукция уйдёт дальше.',
 'Несколько модулей могут последовательно производить один конечный продукт.',
 'Мощность завода зависит от оборудования и выбранного разгона.',
 'После генерации можно выбрать здание и увидеть его входы и выходы.',
 'Фильтр продукции помогает рассмотреть отдельный поток в 3D.',
 'Готовый проект можно экспортировать и открыть позже.',
 'Симуляция помогает увидеть подачу компонентов и работу станков.',
 'У короткой цепочки тоже могут быть длинные маршруты, если станки далеко друг от друга.',
 'Число станков зависит от выпуска рецепта и выбранного разгона.',
 'Небольшое изменение рецепта может сильно изменить потребность в сырье.',
 'Для устойчивого выпуска всем этапам нужна согласованная подача.',
 'Размер модуля ограничивает доступное место для всей компоновки.',
 'Одинаковый конечный выпуск можно получить разными сочетаниями станков и рецептов.',
 'Каждый вход рецепта должен получать свою долю компонентов.',
 'Высокий выпуск требует большей подачи на предыдущих этапах.',
 'Линия готовой продукции начинается с поставок сырья.',
 'Запас скорости ленты не увеличивает скорость самого рецепта.',
 'Потребность в ингредиентах рассчитывается для всей цепочки сразу.',
 'Один промежуточный продукт может понадобиться нескольким этапам.',
 'Общие ингредиенты учитываются по суммарной потребности станков.',
 'Короткий цикл рецепта означает более частый выпуск небольших партий.',
 'Длинный цикл может давать сразу большую партию продукции.',
 'Разгон сокращает время производственного цикла.',
 'При остановке подачи станок сначала расходует накопленные ингредиенты.',
 'Для жидкости важны и поток, и объём трубопровода.',
 'Заполнение трубы в симуляции занимает время.',
 'Насосы помогают поднимать жидкость на нужную высоту.',
 'Выбранный уровень труб задаёт предел их пропускной способности.',
 'У каждого станка свои размеры и расположение портов.',
 'Самый крупный станок может определять размеры целого участка.',
 'Увеличение площади даёт больше вариантов размещения оборудования.',
 'Дополнительная высота позволяет разместить больше уровней.',
 'Разные этажи можно рассмотреть по отдельности.',
 'Вид сверху удобен для оценки расположения станков.',
 'Объёмный вид помогает увидеть высоту зданий и соединений.',
 'При выборе станка подсвечиваются связанные с ним маршруты.',
 'Подписи входов помогают понять, откуда приходит каждый ингредиент.',
 'Подписи выходов показывают, куда уходит готовая продукция.',
 'Отдельный модуль можно рассмотреть без остальных частей завода.',
 'Сохранённый проект позволяет вернуться к найденной компоновке.',
 'Внешняя поставка готового компонента уменьшает число этапов внутри завода.',
 'Производство всех компонентов внутри увеличивает число связей между станками.',
 'Для одного продукта могут существовать стандартные и альтернативные рецепты.',
 'Готовая компоновка показывает не только здания, но и связи между ними.'
 ]
};
let generationStage='preparation',generationMessageTicks=0,generationSeen=new Set(),lastGenerationMessage='';
function rotateGenerationMessage(){
 const available=pool=>pool.filter(text=>!generationSeen.has(text)&&text!==lastGenerationMessage);
 const stage=available(generationMessages[generationStage]??[]),tips=available(generationMessages.tips);
 const pool=stage.length&&(!tips.length||generationSeen.size%2===0)?stage:tips.length?tips:stage;
 if(!pool.length)return;
 const text=pool[Math.floor(Math.random()*pool.length)];generationSeen.add(text);lastGenerationMessage=text;$('loader-description').textContent=text;
}
function generationProgress(event){
 if(!generationBusy)return;
 if(Number.isFinite(event.percent)){const percent=event.split?Math.max(78,event.percent):event.percent;progressValue=Math.max(progressValue,Math.min(98,percent));progressCeiling=Math.min(98,Math.max(progressCeiling,progressValue+3))}
 $('generation-progress').value=progressValue;$('progress-percent').textContent=Math.floor(progressValue)+'%';if(event.stage)generationStage=event.stage;
}
function startProgress(){progressValue=0;progressCeiling=12;generationStage='preparation';generationMessageTicks=0;generationSeen=new Set();generationProgress({percent:1});rotateGenerationMessage();progressTimer=setInterval(()=>{progressValue+=Math.max(0,(progressCeiling-progressValue)*.08);$('generation-progress').value=progressValue;$('progress-percent').textContent=Math.floor(progressValue)+'%';if(++generationMessageTicks%5===0)rotateGenerationMessage()},800)}
function stopProgress(){clearInterval(progressTimer);progressTimer=null}
function confirmReset(){return new Promise(resolve=>{const dialog=$('reset-confirmation');dialog.returnValue='cancel';dialog.addEventListener('close',()=>resolve(dialog.returnValue==='generate'),{once:true});dialog.showModal()})}
async function clearFactory(c){
 stopSimulation();current=null;modulePlans=[];proposal=null;selected=null;hitboxes=[];
 for(const id of ['stats','chain','resources','logistics','route-audit','machine-count','product-legend','module-view','floor-view','flow-view','fit-panel'])$(id).replaceChildren();
 syncVisualization();$('module-view').disabled=true;$('fit-panel').hidden=true;$('selection').hidden=true;canvas.style.visibility='hidden';gpuCanvas.style.visibility='hidden';
 $('project-name').textContent=P.items[c.product]??'';$('scene-title').textContent='Генерация завода…';$('dimensions').textContent=c.width+' × '+c.length+' × '+c.height+' м';$('export').disabled=true;
 localStorage.removeItem('factory-project');await FactoryProjectStore.clear();
}
function renderProposal(){
 const panel=$('fit-panel');panel.replaceChildren();panel.hidden=!proposal;if(!proposal)return;
 const text=document.createElement('p');text.textContent='Производство размещено в '+plural(modulePlans.length,'отдельном модуле','отдельных модулях','отдельных модулях')+'. '+proposal.description;panel.append(text);
 for(const [i,p] of modulePlans.entries()){const line=document.createElement('p');line.textContent='Модуль '+(i+1)+': '+Object.entries(p.exports??{[p.config.product]:p.config.rate}).map(([id,rate])=>P.items[id]+' '+fmt(rate)).join(' + ')+' / мин · '+plural(p.machines.length,'станок','станка','станков')+' · '+p.width+'×'+p.length+'×'+p.bounds.height+' м';panel.append(line)}
 for(const link of proposal.links){const line=document.createElement('p');line.textContent='Между модулями: '+P.items[link.item]+' — '+fmt(link.rate)+' / мин. Соединение строится отдельно от чертежей.';panel.append(line)}
}
async function persistFactory(){await FactoryProjectStore.save(lastConfig,modulePlans,proposal);localStorage.setItem('factory-project',JSON.stringify(lastConfig))}
async function generate(){
 if(generationBusy||confirmationPending)return;
 volumeControls();const c=config();
 const recipe=P.catalog?.recipes[c.recipeId];if(recipe&&!recipe.supported){showError(recipe.reason+'. Выбранный рецепт можно просмотреть в каталоге, но завод для него пока не генерируется. Выберите рецепт из категории «Доступны для генерации».');return}
 try{FactoryBounded.checkPerformanceConfig(c);P.estimate(c)}catch(e){showError(e.message);return}
 if(current||modulePlans.length||proposal){confirmationPending=true;const approved=await confirmReset();confirmationPending=false;if(!approved)return}
 generationCancelled=false;generationBusy=true;document.body.classList.add('generation-busy');$('cancel-generation').disabled=false;lastConfig=c;if(viewport.classList.contains('expanded'))expandView(false);
 window.scrollTo({top:0,behavior:'instant'});document.querySelector('.workspace').setAttribute('aria-busy','true');$('generation-loader').showModal();startProgress();
 try{await clearFactory(c);runGeneration(c)}catch(e){stopProgress();$('generation-loader').close();document.querySelector('.workspace').removeAttribute('aria-busy');generationBusy=false;document.body.classList.remove('generation-busy');syncVisualization();showError('Не удалось подготовить локальное хранилище: '+e.message)}
}
function runGeneration(c){
 $('error').classList.remove('success');$('error').textContent='';$('generate').disabled=true;
 setTimeout(async()=>{let failure=null,info=null;
  try{if(generationCancelled)throw Object.assign(new Error('Генерация отменена'),{cancelled:true});const result=await planAsync(c);$('cancel-generation').disabled=true;proposal=result.proposal;showModules(result.modules);renderProposal();
   generationProgress({percent:98,message:'Сохраняем готовые модули в локальное хранилище'});
   try{await persistFactory()}catch(e){info='Завод построен, но не удалось сохранить его на устройстве. Экспортируйте проект, чтобы не потерять результат. '+e.message}
   
   $('generation-progress').value=100;$('progress-percent').textContent='100%';
  }catch(e){failure=e;$('scene-title').textContent='Не удалось создать завод';$('route-audit').textContent='Готовая компоновка не найдена.'}
  finally{stopProgress();$('generation-loader').close();document.querySelector('.workspace').removeAttribute('aria-busy');generationBusy=false;document.body.classList.remove('generation-busy');syncVisualization();$('generate').disabled=false;$('export').disabled=!current;if(failure&&!failure.cancelled)showError(failure.message,failure.feedback?failure:null);else if(!failure){viewport.scrollIntoView?.({behavior:'smooth',block:'start'});if(info)showInfo(info)}}
 },16);
}

function targetRate(plans){const product=lastConfig?.product??plans.at(-1)?.config.product;return plans.reduce((sum,p)=>sum+(p.exports?.[product]??(p.config.product===product?p.config.rate:0)),0)}
$('module-view').onchange=()=>{current=$('module-view').value==='all'?(overviewPlan??=buildOverview(modulePlans)):modulePlans[Number($('module-view').value)];if(!current)return;selected=null;$('selection').hidden=true;render()};
function row(title,sub,qty,icon='◇'){return `<div class="row"><span class="icon">${icon}</span><div class="text"><strong>${title}</strong><small>${sub}</small></div><span class="qty">${qty}</span></div>`}
function render(){const p=current;$('project-name').textContent=P.items[p.config.product].toUpperCase();$('scene-title').textContent=`${plural(p.fit.usedFloors,'этаж','этажа','этажей')} · ${p.config.floors==='auto'?'этажи подобраны автоматически':'максимум '+p.config.floors} · ${plural(p.machines.length,'станок','станка','станков')}`;$('dimensions').textContent=`${p.width} × ${p.length} × ${p.bounds.height} м · этажи: ${p.floors.map(f=>f.height+' м').join(' / ')} · реальный масштаб`;
$('stats').innerHTML=[['ЦЕЛЕВОЙ ВЫПУСК',fmt(p.config.rate),flowUnit(p.config.product)+' / мин'],['ОБОРУДОВАНИЕ',p.machines.length,plural(p.machines.length,'станок','станка','станков').split(' ').slice(1).join(' ')],['МОЩНОСТЬ',fmt(p.power),'МВт'],['ЗОНА СТАНКОВ',fmt(p.width*p.length),'м²']].map(([a,b,c])=>`<div class="stat"><small>${a}</small><strong>${b}<span>${c}</span></strong></div>`).join('');
$('chain').innerHTML=p.groups.map(g=>row(P.items[g.id],`${P.buildings[g.b].name} · этажи ${(g.floors||[g.floor]).map(f=>f+1).join(", ")} · разгон ${fmt(Math.min(...g.machines.map(m=>m.clock))*100)+'–'+fmt(Math.max(...g.machines.map(m=>m.clock))*100)}% · предел портов/кристаллов ${fmt(g.clockCeiling*100)}%`,`${g.count} × · ${fmt(g.rate)} / мин`)).join('');if(p.exports)$('chain').innerHTML+=Object.entries(p.exports).map(([id,n])=>row('Выход · '+P.items[id],id===p.config.product?'Целевой продукт':'Побочный продукт: требуется отвод или дальнейшее потребление',fmt(n)+' '+flowUnit(id)+' / мин','↗')).join('');$('machine-count').textContent=plural(p.groups.length,'группа','группы','групп').toUpperCase();
$('resources').innerHTML=Object.entries(p.imports).map(([id,n])=>row(P.items[id],`${plural(p.logistics.transfers.filter(t=>t.external&&t.from===id).length,'внешняя линия','внешние линии','внешних линий')} · ${P.isFluid(id)?'труба до '+(p.config.pipeCapacity??300)+' м³/мин':'лента Mk.'+([60,120,270,480,780,1200].indexOf(p.config.belt)+1)}`,`${fmt(n)} ${flowUnit(id)} / мин`,'↳')).join('')+p.connections.filter(c=>c.lanes>1).map(c=>row(`${P.items[c.from]} → ${P.items[c.to]}`,'Параллельные линии между группами',plural(c.lanes,'линия','линии','линий'),'⇉')).join('');
const l=p.logistics;$('route-audit')._auditMesh=null;$('logistics').innerHTML=row('Разветвители', 'Узлы из графа, показанного в 3D',l.splitters,'⑂')+row('Объединители','Узлы из графа, показанного в 3D',l.mergers,'⋈')+row('Подъёмники всех трасс',`Зазор ${l.clearance} м · высоты этажей по оборудованию`,l.lifts,'↕')+row('Линии подачи', 'Без смешивания разных предметов',l.manifolds.reduce((n,g)=>n+Object.values(g.inputs).reduce((a,lanes)=>a+lanes.length,0),0),'⇉');
$('logistics').innerHTML+=row('Цель занятости — 100%',p.fit?.efficiencyFallback?'Выбран компактный вариант, чтобы сохранить один модуль; возможен более долгий выход на полный режим.':'Балансировка веток под расход потребителей. Начальное заполнение лент и буферов может вызывать простой.','После запуска');
if(l.flowCheck)$('logistics').innerHTML+=row('Входы и выходы проверены',plural(l.flowCheck.machineInputs,'вход станка','входа станков','входов станков')+' · '+plural(l.flowCheck.machineOutputs,'выход','выхода','выходов')+' · баланс сырья и продукции сохранён','✓');$('logistics').innerHTML+=row('Энергокристаллы','По фактическому разгону; предел '+(p.config.clockLimit??100)+'%',p.machines.reduce((s,m)=>s+(m.shards??0),0),'◆');
const pipes=l.edges.filter(e=>e.kind==='pipe');if(pipes.length)$('logistics').innerHTML+=row('Трубопроводы','Упрощённая модель: 1 м³ объёма на метр; заполнение и сохранение жидкости · насосы '+pipes.reduce((n,e)=>n+(e.pumps?.length??0),0),fmt(pipes.reduce((n,e)=>n+e.volume,0))+' м³','≈');if(l.routingMetrics)$('logistics').innerHTML+=row('Длина коммуникаций',fmt(l.routingMetrics.horizontalLength)+' м горизонтальных лент · '+fmt(l.routingMetrics.verticalLength)+' м подъёмников'+(['stacked','spatial'].includes(l.routing)?' · ленты на нескольких высотах':''),fmt(l.routingMetrics.horizontalLength+l.routingMetrics.verticalLength)+' м','↝');
if(p.fit.optimization)$('logistics').innerHTML+=row('Сравнение компоновок','Выбор по длине лент, подъёмникам, узлам и станкам; минимум модулей — приоритет',plural(p.fit.optimization.validLayouts,'вариант','варианта','вариантов'),'⇄');
const flows=$('flow-view');flows.replaceChildren(new Option('Все продукты','all'));for(const id of l.products)flows.add(new Option(P.items[id],id));$('product-legend').innerHTML=l.products.map(id=>`<span><i style="background:${l.colors[id]}"></i>${P.items[id]}</span>`).join('');
const view=$('floor-view');view.replaceChildren(new Option('Все этажи','all'));for(let n=0;n<usedFloors(p);n++)view.add(new Option(`Этаж ${n+1}${p.machines.some(m=>m.floor===n)?"":" · без станков"}`,String(n)));camera()}
const canvas=$('scene'),ctx=canvas.getContext('2d');
const gpuCanvas=document.createElement('canvas');gpuCanvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none';canvas.before(gpuCanvas);canvas.style.position='relative';canvas.tabIndex=0;const gpu=FactoryGPU.create(gpuCanvas);
const labelKeys=['inputs','outputs','products','splitters','mergers'],labelOptions=Object.fromEntries([...labelKeys,'references'].map(k=>[k,true]));
try{const saved=JSON.parse(localStorage.getItem('factory-label-options')||'{}');for(const k of Object.keys(labelOptions))if(typeof saved[k]==='boolean')labelOptions[k]=saved[k]}catch{}
function updateLabelControls(){for(const k of labelKeys)$('labels-'+k).checked=labelOptions[k];const enabled=labelKeys.filter(k=>labelOptions[k]).length;$('labels-all').checked=enabled===labelKeys.length;$('labels-all').indeterminate=enabled>0&&enabled<labelKeys.length}
for(const k of labelKeys)$('labels-'+k).onchange=()=>{labelOptions[k]=$('labels-'+k).checked;updateLabelControls();localStorage.setItem('factory-label-options',JSON.stringify(labelOptions));draw()};
$('labels-all').onchange=()=>{for(const k of Object.keys(labelOptions))labelOptions[k]=$('labels-all').checked;updateLabelControls();localStorage.setItem('factory-label-options',JSON.stringify(labelOptions));draw()};updateLabelControls();
let framePending=false,simulation=null,simulationFrame=null,simulationLast=null,simulationStatusTime=0,simulationSamples=[],simulationWarmUntil=0;
function stopSimulation(){if(simulationFrame!==null)cancelAnimationFrame(simulationFrame);simulationFrame=null;simulationLast=null;simulation=null;$('simulate').innerHTML=buttonIcon('play','Симуляция');$('simulate').setAttribute('aria-pressed','false');$('simulation-status').hidden=true}
function simulationTick(now){if(!simulation)return;if(document.hidden){simulationLast=null;simulationSamples=[];simulationWarmUntil=now+4000}else if(simulationLast!==null){const dt=now-simulationLast;simulation.advance(Math.min(.25,dt/1000));if(now>simulationWarmUntil)simulationSamples.push({time:now,dt});while(simulationSamples.length&&simulationSamples[0].time<now-3000)simulationSamples.shift()}simulationLast=now;draw();if(now-simulationStatusTime>250){const s=simulation.summary(),fps=FactoryBounded.framePerformance(simulationSamples.map(v=>v.dt));if(s.inTransit>FactoryBounded.performanceLimits.particles||simulationSamples.length>60&&simulationSamples.at(-1).time-simulationSamples[0].time>2800&&!fps.stable){stopSimulation();draw();showInfo('Симуляция остановлена, чтобы избежать зависания: '+(s.inTransit>FactoryBounded.performanceLimits.particles?'число движущихся предметов превысило '+FactoryBounded.performanceLimits.particles:fmt(fps.fps)+' FPS, медленные кадры '+fmt(fps.p95)+' мс')+'. Уменьшите выпуск, добавьте внешние поставки или отключите часть подписей. Геометрия завода сохранена.','Производительность симуляции');return}$('simulation-status').textContent='Симуляция · '+Math.floor(s.time)+' с · '+(fps.fps?fmt(fps.fps)+' FPS · ':'')+'Mk.'+([60,120,270,480,780,1200].indexOf(current.config.belt)+1)+' · '+fmt(current.config.belt*.02)+' м/с · работают '+s.active+' '+plural(s.active,'станок','станка','станков').split(' ').slice(1).join(' ')+' · в пути '+s.inTransit+(s.imported?.water!==undefined?' · вода извне '+fmt(s.imported.water)+' м³':'')+' · выпущено '+(Object.entries(s.exported).map(([item,n])=>P.items[item]+': '+fmt(n)+' '+flowUnit(item)).join(', ')||'0');const pipeDetail=$('selected-pipe-volume');if(pipeDetail){const v=s.pipes.find(v=>v.module===modulePlans.indexOf(current)&&v.id===-3-selected);pipeDetail.textContent=fmt(v?.stored??0);$('selected-pipe-flow').textContent=fmt(v?.actualFlow??0)}simulationStatusTime=now}simulationFrame=requestAnimationFrame(simulationTick)}
$('simulate').onclick=()=>{if(simulation){stopSimulation();draw();return}if(!current)return;try{FactoryBounded.checkPerformanceLoad(modulePlans)}catch(e){showError(e.message);return}overviewPlan??=modulePlans.length>1?buildOverview(modulePlans):null;simulation=FactorySimulation.create(modulePlans,proposal,overviewPlan?.logistics.edges.filter(e=>e.interModule)??[]);simulationSamples=[];simulationWarmUntil=performance.now()+4000;$('simulate').innerHTML=buttonIcon('stop','Остановить');$('simulate').setAttribute('aria-pressed','true');$('simulation-status').hidden=false;simulationLast=null;simulationFrame=requestAnimationFrame(simulationTick);draw()};
function draw(){if(framePending)return;framePending=true;requestAnimationFrame(()=>{framePending=false;$('simulate').disabled=!current;if(!current)return;if(graphView){if($('selection').hidden&&graphHost.__selectedNode)FactoryGraph.selectNode(graphHost,null);refreshGraph();FactoryGraph.updateSimulation(graphHost,simulation);return}FactoryScene.render({canvas,ctx,plan:current,angle,tilt,zoom,selected,panX,panY,gpu,flow:$('flow-view').value,floor:$('floor-view').value,labelOptions,viewStyle:$('view-style').value,simulation:overviewSimulation(),moduleIndex:current.overview?0:Number($('module-view').value),onHits:h=>{hitboxes=h;if(!h.length)return;const rect=canvas.getBoundingClientRect(),left=Math.min(...h.map(v=>v.minx)),right=Math.max(...h.map(v=>v.maxx)),top=Math.min(...h.map(v=>v.miny)),bottom=Math.max(...h.map(v=>v.maxy)),bound=FactoryGraph.boundPan({x:left,y:top},[right-left,bottom-top],[rect.width,rect.height]);if(Math.abs(bound.x-left)>.1||Math.abs(bound.y-top)>.1){panX+=bound.x-left;panY+=bound.y-top;draw()}}})})}
function orbitPivot(event){
 if(!current)return null;const p=current,r=canvas.getBoundingClientRect(),floor=$('floor-view').value,L=FactoryLogistics,base=floor==='all'?0:L.displayBase(p,+floor),height=floor==='all'?(L.displayBase(p,usedFloors(p)-1)+(p.floors?.at(-1).height??16)):24;
 const scale=Math.min((r.width-100)/(p.width+p.length+20)*1.3,(r.height-125)/(p.length*.65+height))*zoom,y=height/2;
 const screenX=event?event.clientX-r.left:r.width/2,screenY=event?event.clientY-r.top:r.height/2,hit=FactoryScene.pickSurface?.(screenX,screenY);
 if(hit)return {x:hit[0]-p.width/2,z:hit[2]-p.length/2,y:hit[1]-base,scale,screenX:screenX-r.width/2,screenY:screenY-r.height*.65};
 const a=(screenX-r.width/2-panX)/scale,b=((screenY-r.height*.65-panY)/scale+y*Math.sin(tilt))/Math.cos(tilt);
 return {x:a*Math.cos(angle)+b*Math.sin(angle),z:-a*Math.sin(angle)+b*Math.cos(angle),y,scale,screenX:screenX-r.width/2,screenY:screenY-r.height*.65};
}
function centerOrbitPivot(pivot){if(!pivot)return;panX=pivot.screenX-(pivot.x*Math.cos(angle)-pivot.z*Math.sin(angle))*pivot.scale;panY=pivot.screenY-((pivot.x*Math.sin(angle)+pivot.z*Math.cos(angle))*Math.cos(tilt)-pivot.y*Math.sin(tilt))*pivot.scale;}
let pointer=null,moved=false;
canvas.oncontextmenu=e=>e.preventDefault();
canvas.onpointerdown=e=>{if(pointer)return;e.preventDefault();canvas.focus({preventScroll:true});pointer={id:e.pointerId,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,mode:e.button===2||(e.button===1&&e.shiftKey)?'pan':e.button===1||(e.button===0&&e.altKey)?'orbit':'select'};if(pointer.mode==='orbit')pointer.pivot=orbitPivot(e);moved=false;canvas.setPointerCapture(e.pointerId);canvas.style.cursor=pointer.mode==='pan'?'grabbing':pointer.mode==='orbit'?'move':'default'};
canvas.onpointermove=e=>{if(!pointer||e.pointerId!==pointer.id)return;const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;if(Math.hypot(e.clientX-pointer.startX,e.clientY-pointer.startY)>4)moved=true;if(pointer.mode==='pan'){panX+=dx;panY+=dy}else if(pointer.mode==='orbit'){angle-=dx*.006;tilt=Math.max(.03,Math.min(Math.PI/2-.01,tilt+dy*.006));centerOrbitPivot(pointer.pivot);$('iso').classList.add('active')}pointer.x=e.clientX;pointer.y=e.clientY;if(pointer.mode!=='select')draw()};
canvas.onpointercancel=canvas.onlostpointercapture=()=>{pointer=null;canvas.style.cursor='default'};
function showSelection(id,plan=current,spatial=true){const hit=id===null||id===undefined?null:{id};selected=hit?.id??null;const panel=$('selection');panel.hidden=selected===null;if(hit&&selected<=-3){const edge=plan.logistics.edges.find(v=>v.id===-3-selected),length=edge.points.slice(1).reduce((n,b,i)=>n+Math.hypot(...b.map((v,k)=>v-edge.points[i][k])),0);panel.innerHTML=`<button id="close-selection" aria-label="Закрыть">${buttonIcon('close','')}</button><strong>${edge.kind==='pipe'?'Труба':'Конвейер'} #${edge.id+1}</strong><br>${P.items[edge.item]}<br><small>Расчётный поток: ${fmt(edge.rate)} ${flowUnit(edge.item)} / мин<br>${edge.kind==='pipe'?`Труба: до ${fmt(edge.capacity)} м³ / мин<br>Объём: ${fmt(edge.volume)} м³ · насосов: ${edge.pumps?.length??0}<br>Скорость псевдожидкости: ${fmt((edge.capacity??plan.config.pipeCapacity??300)/60/(edge.crossSection??1))} м/с<br>Заполнение: <span id="selected-pipe-volume">${fmt(simulation?.summary().pipes.find(v=>v.module===modulePlans.indexOf(plan)&&v.id===edge.id)?.stored??0)}</span> м³<br>Фактический выход: <span id="selected-pipe-flow">0</span> м³ / мин<br>Упрощённый направленный поток; объём сохраняется.`:`Лента: Mk.${[60,120,270,480,780,1200].indexOf(plan.config.belt)+1} · до ${fmt(plan.config.belt)} / мин<br>Скорость движения: ${fmt(plan.config.belt*.02)} м/с<br>Меньший поток увеличивает промежутки между предметами.`}<br>Длина пути: ${fmt(length)} м<br>Отметки высоты: ${fmt(Math.min(...edge.points.map(v=>v[1])))}–${fmt(Math.max(...edge.points.map(v=>v[1])))} м<br>Зелёная точка — начало, оранжевая — конец.<br>Подсвечен весь путь, включая скрытые участки.</small>`;$('close-selection').onclick=()=>{selected=null;panel.hidden=true;draw()}}else if(hit&&selected>=plan.machines.length){const n=plan.logistics.nodes.find(n=>plan.machines.length+n.id===selected),paths=FactoryScene.machinePaths(plan,selected),inputs=paths.filter(v=>v.input),outputs=paths.filter(v=>!v.input);panel.innerHTML=`<button id="close-selection" aria-label="Закрыть">${buttonIcon('close','')}</button><strong>${n.type==='splitter'?'Разветвитель':'Соединитель'} #${n.id+1}</strong><br>${P.items[n.item]}<br><small>${spatial?`Этаж ${n.floor+1} · 4 × 4 × 3 м<br>Высота портов: ${fmt(n.point[1])} м<br>Поворот: ${n.rotation??0}°<br><br>`:''}<span style="color:#50dfb0">ВХОДЫ</span><br>${inputs.map(v=>'Конвейер #'+(v.edge.id+1)+': '+fmt(v.edge.rate)+' / мин').join('<br>')}<br><br><span style="color:#ffba66">ВЫХОДЫ</span><br>${outputs.map(v=>'Конвейер #'+(v.edge.id+1)+': '+fmt(v.edge.rate)+' / мин').join('<br>')}</small>`;$('close-selection').onclick=()=>{selected=null;panel.hidden=true;draw()}}else if(hit){const m=plan.machines[selected],g=plan.groups.find(g=>g.id===m.group),b=P.buildings[m.b];panel.innerHTML=`<button id="close-selection" aria-label="Закрыть">${buttonIcon('close','')}</button><strong>${b.name} #${m.id+1}</strong><br>${P.items[m.group]}<br><small>${spatial?`Этаж ${m.floor+1} · ${m.w} × ${m.d} м<br>Поворот: ${m.rotation??0}°<br>`:''}Разгон ${fmt(m.clock*100)}% · энергокристаллы: ${m.shards??0}<br>Выпуск ${fmt(P.recipesFor(plan.config)[m.group].out*m.clock)} / мин<br>${spatial?`Позиция: ${m.x} / ${m.z} м<br>`:''}<br><span style="color:#50dfb0">ВХОДЫ</span><br>${Object.entries(P.recipesFor(plan.config)[m.group].ins).map(([id,n])=>`${P.items[id]}: ${fmt(n*m.clock)} / мин`).join("<br>")}<br><br><span style="color:#ffba66">ВЫХОД</span><br>${Object.entries(P.outputs(P.recipesFor(plan.config)[m.group],m.group)).map(([id,n])=>P.items[id]+': '+fmt(n*m.clock)+' '+flowUnit(id)+' / мин').join('<br>')}</small>`;$('close-selection').onclick=()=>{selected=null;panel.hidden=true;draw()}}draw()}
canvas.onpointerup=e=>{const mode=pointer?.mode;pointer=null;canvas.style.cursor='default';if(moved||mode!=='select')return;const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;const id=FactoryScene.pick?.(x,y);showSelection(id)};canvas.onwheel=e=>{e.preventDefault();const old=zoom;zoom=Math.max(.2,Math.min(8,zoom*Math.exp(-e.deltaY*.001)));const ratio=zoom/old,r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;panX=(x-r.width/2)*(1-ratio)+panX*ratio;panY=(y-r.height*.65)*(1-ratio)+panY*ratio;draw()};
function camera(){angle=-.65;tilt=.65;zoom=1;panX=0;panY=0;
if(current){const r=canvas.getBoundingClientRect(),p=current,floor=$('floor-view').value,base=floor==='all'?0:FactoryLogistics.displayBase(p,+floor),scale=Math.min((r.width-100)/(p.width+p.length+20)*1.3,(r.height-125)/(p.length*.65+(floor==='all'?(FactoryLogistics.displayBase(p,usedFloors(p)-1)+(p.floors?.at(-1).height??16)):24))),points=p.logistics.edges.flatMap(e=>e.points).map(v=>[v[0],FactoryLogistics.displayY(p,v[1]),v[2]]);points.push([0,0,0],[p.width,0,p.length]);if(p.bounds)points.push([0,p.bounds.height,0],[p.width,p.bounds.height,p.length]);const projected=points.map(([X,Y,Z])=>{const x=X-p.width/2,z=Z-p.length/2;return [(x*Math.cos(angle)-z*Math.sin(angle))*scale,((x*Math.sin(angle)+z*Math.cos(angle))*Math.cos(tilt)-(Y-base)*Math.sin(tilt))*scale]}),xs=projected.map(v=>v[0]),ys=projected.map(v=>v[1]),minx=Math.min(...xs),maxx=Math.max(...xs),miny=Math.min(...ys),maxy=Math.max(...ys);zoom=Math.min(8,(r.width-160)/Math.max(1,maxx-minx),(r.height-170)/Math.max(1,maxy-miny));panX=-(minx+maxx)*zoom/2;panY=-r.height*.1-(miny+maxy)*zoom/2}
$('iso').classList.toggle('active',!graphView);draw()}
function focusSelected(){if(selected===null||selected<=-3){camera();return}const p=current,n=selected>=p.machines.length?p.logistics.nodes.find(n=>p.machines.length+n.id===selected):null,m=n?{x:n.point[0]-2,z:n.point[2]-2,w:4,d:4,h:3,floor:n.floor,y:n.point[1]-.7}:current.machines[selected],rect=canvas.getBoundingClientRect(),floor=$('floor-view').value,base=floor==='all'?0:FactoryLogistics.displayBase(p,+floor);zoom=2;const scale=Math.min((rect.width-100)/(current.width+current.length+20)*1.3,(rect.height-125)/(current.length*.65+(floor==='all'?(FactoryLogistics.displayBase(current,usedFloors(current)-1)+(current.floors?.at(-1).height??16)):24)))*zoom;const x=m.x+m.w/2-current.width/2,z=m.z+m.d/2-current.length/2,y=(m.y??FactoryLogistics.displayBase(current,m.floor))+m.h/2-base;panX=-(x*Math.cos(angle)-z*Math.sin(angle))*scale;panY=-rect.height*.15-((x*Math.sin(angle)+z*Math.cos(angle))*Math.cos(tilt)-y*Math.sin(tilt))*scale;draw()}
canvas.onkeydown=e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();if(e.shiftKey){panX+=e.key==='ArrowLeft'?-20:e.key==='ArrowRight'?20:0;panY+=e.key==='ArrowUp'?-20:e.key==='ArrowDown'?20:0}else{angle+=e.key==='ArrowLeft'?-.1:e.key==='ArrowRight'?.1:0;tilt=Math.max(.03,Math.min(Math.PI/2-.01,tilt+(e.key==='ArrowUp'?-.08:e.key==='ArrowDown'?.08:0)));$('iso').classList.add('active')}draw()}if(e.key.toLowerCase()==='f'){e.preventDefault();focusSelected()}if(e.key==='Escape'){selected=null;$('selection').hidden=true;draw()}if(e.key==='Home'){e.preventDefault();camera()}};
const viewport=canvas.closest('.viewport');function expandView(expanded){viewport.classList.toggle('expanded',expanded);document.body.classList.toggle('view-expanded',expanded);$('expand-view').setAttribute('aria-pressed',String(expanded));$('expand-view').innerHTML=buttonIcon(expanded?'collapse':'expand',expanded?'Свернуть':'Развернуть');requestAnimationFrame(()=>{if(graphView){fitGraph();draw()}else camera()})}
const graphPanel=document.createElement('div');graphPanel.className='graph-panel';
const graphControls=document.createElement('div');graphControls.className='graph-controls';
const graphScope=document.createElement('select');graphScope.setAttribute('aria-label','Модули на графе');
const graphFlow=document.createElement('select');graphFlow.setAttribute('aria-label','Продукт на графе');
const graphScroll=document.createElement('div');graphScroll.className='graph-scroll';
const graphHost=document.createElement('div');graphScroll.append(graphHost);
const graphHint=document.createElement('small');graphHint.hidden=true;

const graphFit=document.createElement('button');graphFit.textContent='Весь граф';graphFit.onclick=fitGraph;graphControls.append(graphFit);const graphMode=document.createElement('select');graphMode.setAttribute('aria-label','Детализация графа');graphMode.add(new Option('Граф рецептов','recipes'));graphMode.add(new Option('Все станки и узлы','machines'));graphMode.value='machines';graphControls.prepend(graphMode,graphScope,graphFlow);graphControls.append(graphHint);const graphStageBar=document.createElement('div');graphStageBar.className='graph-stages';graphPanel.append(graphControls,graphStageBar,graphScroll);viewport.append(graphPanel);
function scaleGraph(){const svg=graphHost.querySelector('svg');if(!svg)return;const size=svg.getAttribute('viewBox').split(' ').map(Number),content=JSON.parse(svg.getAttribute('data-content-bounds')||JSON.stringify(size)),offsetX=(content[0]-size[0])*graphZoom,offsetY=(content[1]-size[1])*graphZoom,bounded=FactoryGraph.boundPan({x:graphPanX+offsetX,y:graphPanY+offsetY},[content[2]*graphZoom,content[3]*graphZoom],[graphScroll.clientWidth,graphScroll.clientHeight]);graphPanX=bounded.x-offsetX;graphPanY=bounded.y-offsetY;svg.setAttribute('width',size[2]*graphZoom);svg.setAttribute('height',size[3]*graphZoom);graphHost.style.transform='translate('+graphPanX+'px,'+graphPanY+'px)'}
function fitGraph(){const svg=graphHost.querySelector('svg');if(!svg)return;const size=svg.getAttribute('viewBox').split(' ').map(Number);graphZoom=Math.max(.1,Math.min(1,(graphScroll.clientWidth-20)/size[2],(graphScroll.clientHeight-20)/size[3]));graphPanX=(graphScroll.clientWidth-size[2]*graphZoom)/2;graphPanY=(graphScroll.clientHeight-size[3]*graphZoom)/2;scaleGraph()}
function zoomGraph(factor,x,y){const next=FactoryGraph.zoomAt({zoom:graphZoom,x:graphPanX,y:graphPanY},factor,[x,y]);graphZoom=next.zoom;graphPanX=next.x;graphPanY=next.y;scaleGraph()}
graphScroll.addEventListener('wheel',e=>{e.preventDefault();const r=graphScroll.getBoundingClientRect(),delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?r.height:1);zoomGraph(Math.exp(-delta*.0015),e.clientX-r.left,e.clientY-r.top)},{passive:false});
graphScroll.oncontextmenu=e=>e.preventDefault();
graphScroll.onpointerdown=e=>{if(graphDrag||![0,1,2].includes(e.button))return;e.preventDefault();graphDrag={id:e.pointerId,x:e.clientX,y:e.clientY};graphScroll.setPointerCapture(e.pointerId);graphScroll.classList.add('dragging')};
graphScroll.onpointermove=e=>{if(!graphDrag||graphDrag.id!==e.pointerId)return;graphPanX+=e.clientX-graphDrag.x;graphPanY+=e.clientY-graphDrag.y;graphDrag.x=e.clientX;graphDrag.y=e.clientY;scaleGraph()};
function endGraphDrag(e){if(!graphDrag||e.pointerId!==graphDrag.id)return;graphDrag=null;graphScroll.classList.remove('dragging');if(graphScroll.hasPointerCapture(e.pointerId))graphScroll.releasePointerCapture(e.pointerId)}
graphScroll.onpointerup=graphScroll.onpointercancel=graphScroll.onlostpointercapture=endGraphDrag;
function focusGraphNode(node){
 const svg=graphHost.querySelector('svg');if(!svg)return;
 const target=graphHost.__graph?.nodes.find(n=>n.id===node.id);if(!target)return;
 const box=svg.getAttribute('viewBox').split(' ').map(Number);
 graphPanX=graphScroll.clientWidth/2-(target.x+115-box[0])*graphZoom;
 graphPanY=graphScroll.clientHeight/2-(target.y+(target.height??78)/2-box[1])*graphZoom;
 scaleGraph();
}
function showGraphSelection(node){
 showGraphSelectionDetails(node);FactoryGraph.selectNode(graphHost,node.id);const close=$('close-selection'),closeAction=close.onclick;close.onclick=()=>{FactoryGraph.selectNode(graphHost,null);closeAction()};
 const title=$('selection').querySelector('strong');if(!title)return;
 const link=document.createElement('a');link.href='#graph-node';link.className='selection-node-link';link.textContent=title.textContent;link.title='Показать узел в центре графа';link.onclick=e=>{e.preventDefault();focusGraphNode(node)};title.replaceChildren(link);
}
function showGraphSelectionDetails(node){
 const plan=modulePlans[node.module];
 const machine=node.id.match(/^m\d+:machine(\d+)$/),junction=node.id.match(/^m\d+:node(\d+)$/);
 if(machine){showSelection(plan.machines.findIndex(m=>m.id===+machine[1]),plan,false);return}
 if(junction){showSelection(plan.machines.length+Number(junction[1]),plan,false);return}
 if(node.type==='machine'){const members=plan.machines.filter(m=>m.group===node.item&&m.b===node.building),m={...members[0],id:0,clock:members.reduce((sum,m)=>sum+m.clock,0)};showSelection(0,{...plan,machines:[m]},false);$('selection').querySelector('strong').textContent=P.buildings[node.building].name+' · '+plural(members.length,'станок','станка','станков');return}
 const panel=$('selection'),rate=fmt(node.rate??0)+' '+flowUnit(node.item)+' / мин';selected=null;panel.hidden=false;panel.innerHTML='<button id="close-selection" aria-label="Закрыть">'+buttonIcon('close','')+'</button><strong>'+node.label+'</strong><br>'+P.items[node.item]+'<br><small>'+(node.module===undefined?'Между модулями':'Модуль '+(node.module+1))+'<br>Расчётный поток: '+rate+(node.type==='import'?'<br>Из модулей: '+fmt(node.moduleRate??0)+' '+flowUnit(node.item)+' / мин<br>Извне: '+fmt(node.externalRate??node.rate??0)+' '+flowUnit(node.item)+' / мин':'')+'</small>';$('close-selection').onclick=()=>{panel.hidden=true;selected=null;draw()}
}
function refreshGraph(){if(graphPlans!==modulePlans||graphProposal!==proposal){graphPlans=modulePlans;graphProposal=proposal;graphFilterKey='';graphStageBar.replaceChildren();graphStageBar.hidden=modulePlans.length<2;
modulePlans.forEach((p,i)=>{const chip=document.createElement('button'),products=Object.keys(p.exports??{[p.config.product]:p.config.rate}).map(item=>P.items[item]).join(' / ');chip.dataset.module=String(i);chip.setAttribute('aria-pressed','false');chip.textContent='Этап '+(i+1)+' · Модуль '+(i+1)+' · '+products;chip.style.borderColor=['#60cbb1','#7cb9ed','#d5a2ee','#e4bb77'][i%4];chip.onclick=()=>{graphScope.value=String(i);refreshGraph()};graphStageBar.append(chip)});
graphScope.replaceChildren(new Option('Все модули','all'));modulePlans.forEach((p,i)=>graphScope.add(new Option('Модуль '+(i+1),String(i))));graphFlow.replaceChildren(new Option('Все продукты','all'));for(const item of new Set(modulePlans.flatMap(p=>p.logistics.edges.map(e=>e.item))))graphFlow.add(new Option(P.items[item],item))}
for(const chip of graphStageBar.querySelectorAll('button')){const active=chip.dataset.module===graphScope.value;chip.classList.toggle('active',active);chip.setAttribute('aria-pressed',String(active))}
const key=graphScope.value+':'+graphFlow.value+':'+graphMode.value;if(graphFilterKey===key)return;selected=null;$('selection').hidden=true;FactoryGraph.selectNode(graphHost,null);graphFilterKey=key;FactoryGraph.render(graphHost,modulePlans,proposal,{module:graphScope.value,flow:graphFlow.value,mode:graphMode.value,onSelect:showGraphSelection});fitGraph()}
graphMode.onchange=graphScope.onchange=graphFlow.onchange=()=>{refreshGraph();graphScroll.scrollTo(0,0)};
function setGraphView(active){graphView=active;const toolbar=viewport.querySelector('.view-toolbar');if(active)toolbar.insertBefore(graphControls,$('simulate'));else graphPanel.prepend(graphControls);try{localStorage.setItem('factory-view-mode',active?'graph':'3d')}catch{};viewport.classList.toggle('graph-mode',active);canvas.style.display=active?'none':'';gpuCanvas.style.display=active?'none':'';if(active)ctx.clearRect(0,0,canvas.width,canvas.height);$('graph-view').classList.toggle('active',active);$('graph-view').setAttribute('aria-pressed',String(active));$('iso').classList.toggle('active',!active);for(const id of ['floor-view','flow-view','view-style'])$(id).disabled=active;$('module-view').disabled=active||modulePlans.length===1;draw()}
$('graph-view').onclick=()=>setGraphView(true);
const viewToolbar=viewport.querySelector('.view-toolbar');new ResizeObserver(()=>{viewport.style.setProperty('--graph-toolbar-bottom',(viewToolbar.offsetTop+viewToolbar.offsetHeight+10)+'px')}).observe(viewToolbar);
$('expand-view').onclick=()=>expandView(!viewport.classList.contains('expanded'));document.addEventListener('keydown',e=>{if(e.key==='Escape'&&viewport.classList.contains('expanded')){expandView(false);$('expand-view').focus()}});
try{$('view-style').value=localStorage.getItem('factory-view-style')==='realistic'?'realistic':'engineering'}catch{}
$('view-style').onchange=()=>{viewport.classList.toggle('realistic',$('view-style').value==='realistic');localStorage.setItem('factory-view-style',$('view-style').value);draw()};viewport.classList.toggle('realistic',$('view-style').value==='realistic');
$('flow-view').onchange=()=>{selected=null;$('selection').hidden=true;draw()};
$('iso').onclick=()=>{setGraphView(false);camera()};$('reset').onclick=()=>{if(graphView){fitGraph()}else camera()};$('floor-view').onchange=()=>{selected=null;$('selection').hidden=true;draw()};$('generate').onclick=()=>generate();new ResizeObserver(draw).observe(canvas);
$('export').onclick=()=>{if(!current)return;const blob=new Blob([JSON.stringify(FactoryProjectStore.encode(lastConfig,modulePlans,proposal),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`factory-${current.config.product}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
function loadControls(c){$('product').dataset.recipeId=c.recipeId??'';$('independent-modules').checked=!!c.independentModules;$('allow-feedback').checked=!!c.allowFeedback;$('allow-feedback').dataset.externalItems=JSON.stringify(c.externalFeedbackItems??[]);$('preset').value=FactoryBounded.presets[c.preset]?c.preset:'custom';$('length').value=c.length??c.width;$('height').value=c.height??48;$('product').value=c.product;$('rate').value=c.rate;$('floors').value=c.floors;$('width').value=c.width;$('belt').value=c.belt;$('pipe-capacity').value=c.pipeCapacity??300;$('clearance').value=c.liftClearance??4;$('clock-limit').value=c.clockLimit??100;supplies(c.external);window.refreshRecipePicker?.();volumeControls()}
function restoreFactory(data){const restored=FactoryProjectStore.decode(data);for(const p of restored.modules)FactoryBounded.checkPerformanceConfig({...p.config,...p.bounds});FactoryBounded.checkPerformanceLoad(restored.modules);lastConfig=restored.config;proposal=restored.proposal;loadControls(lastConfig);showModules(restored.modules);renderProposal();$('export').disabled=false}
$('import').onchange=async e=>{try{const data=JSON.parse(await e.target.files[0].text());if(data.version===1&&data.modules){if(current&&!await confirmReset())return;restoreFactory(data);await persistFactory()}else{loadControls(data.config);await generate()}}catch(err){showError('Не удалось открыть проект: '+err.message)}finally{e.target.value=''}};
async function initialize(){syncVisualization();try{const snapshot=await FactoryProjectStore.read();if(snapshot){restoreFactory(snapshot);return}const saved=localStorage.getItem('factory-project');if(saved)loadControls(JSON.parse(saved));volumeControls();$('export').disabled=true;syncVisualization()}catch(e){showError('Не удалось восстановить завод: '+e.message+' Можно создать новый завод кнопкой генерации.')}}
try{setGraphView(localStorage.getItem('factory-view-mode')==='graph')}catch{setGraphView(false)}
initialize();

FactoryTouch.bind(canvas,{enabled:()=>!!current&&!generationBusy,drag:(dx,dy)=>{angle-=dx*.006;tilt=Math.max(.03,Math.min(Math.PI/2-.01,tilt+dy*.006));draw()},pinch:(factor,x,y,dx,dy)=>{const r=canvas.getBoundingClientRect(),old=zoom;zoom=Math.max(.2,Math.min(8,zoom*factor));const ratio=zoom/old;panX=(x-r.left-r.width/2)*(1-ratio)+panX*ratio+dx;panY=(y-r.top-r.height*.65)*(1-ratio)+panY*ratio+dy;draw()},tap:(x,y)=>{const r=canvas.getBoundingClientRect();showSelection(FactoryScene.pick?.(x-r.left,y-r.top))}});
FactoryTouch.bind(graphScroll,{enabled:()=>!!current&&!generationBusy,drag:(dx,dy)=>{graphPanX+=dx;graphPanY+=dy;scaleGraph()},pinch:(factor,x,y,dx,dy)=>{const r=graphScroll.getBoundingClientRect();zoomGraph(factor,x-r.left,y-r.top);graphPanX+=dx;graphPanY+=dy;scaleGraph()},tap:(x,y,target)=>{const card=target.closest?.('.graph-node'),node=graphHost.__graph?.nodes.find(n=>n.id===card?.getAttribute('data-node-id'));if(node)showGraphSelection(node)}});
