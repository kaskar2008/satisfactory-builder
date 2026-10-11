const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

// Exercise the generation lifecycle with a controlled worker result.
function harness(){
 const elements=new Map();
 function $(id){if(id==='maximize')return null;if(!elements.has(id))elements.set(id,{textContent:'',children:[],dataset:{},style:{},hidden:false,disabled:false,open:false,classList:{remove(){},contains(){return false}},replaceChildren(){this.children=[]},append(node){this.children.push(node)},setAttribute(){},removeAttribute(){},addEventListener(name,fn){this[name]=fn},showModal(){this.open=true},close(value){this.returnValue=value??this.returnValue;this.open=false;this.close?.listener?.()},scrollIntoView(){},click(){this.onclick()}});return elements.get(id)}
 const confirmation=$('reset-confirmation');
 confirmation.addEventListener=(name,fn)=>{confirmation.listener=fn};
 confirmation.close=value=>{confirmation.returnValue=value;confirmation.open=false;confirmation.listener()};
 const old={config:{product:'iron',rate:1},machines:[{}]};
 const context={$,current:old,modulePlans:[old],proposal:null,selected:{id:1},hitboxes:[{}],lastConfig:null,canvas:{style:{}},gpuCanvas:{style:{}},FactoryBounded:require('../public/bounded.js'),P:{items:{iron:'Железо'},estimate(){}},fmt:String,volumeControls(){},config:()=>({product:'iron',rate:1,width:48,length:48,height:48}),viewport:{scrollIntoView(){context.viewportScrolled=true},classList:{contains:()=>false}},expandView(){},updateCapacity(){},showModules(plans){context.modulePlans=plans;context.current=plans[0]},FactoryProjectStore:{async clear(){context.cleared=true},async save(c,modules,proposal){context.saved={config:c,modules,proposal}}},localStorage:{removed:false,removeItem(){this.removed=true},setItem(){}},document:{body:{classList:{add(){},remove(){}}},querySelector:()=>$('workspace'),createElement:()=>({remove(){}})},window:{scrollTo(){context.scrolled=true}},setInterval(fn){context.tick=fn;return 1},clearInterval(){context.timerStopped=true},setTimeout(fn){context.task=fn},planAsync:()=>context.workerResult};
 vm.createContext(context);
 context.stopSimulation=()=>{context.simulationStopped=true};
 const source=fs.readFileSync('public/app.js','utf8');vm.runInContext(source.slice(source.indexOf('const plural='),source.indexOf('const pipeLabel=')),context);
 vm.runInContext(source.slice(source.indexOf('let generationBusy='),source.indexOf('function targetRate')),context);
 context.syncVisualization=()=>{};return {context,$,old};
}

test('cancel keeps the current factory and does not start a worker',async()=>{
 const {context,$,old}=harness();const pending=context.generate();
 assert.equal($('reset-confirmation').open,true);assert.equal(context.current,old);
 $('reset-confirmation').close('cancel');await pending;
 assert.equal(context.current,old);assert.equal(context.scrolled,undefined);assert.equal(context.task,undefined);assert.equal(context.localStorage.removed,false);
});
test('manual crafting shows its explanation before confirmation, calculation or deleting the saved factory',async()=>{
const {context,$,old}=harness();context.config=()=>({recipeId:'manual'});context.P.catalog={recipes:{manual:{supported:false,reason:'Ручной крафт: не автоматизируется в станке'}}};
await context.generate();assert.equal($('error-modal').open,true);assert.ok($('error-message').textContent.includes('Ручной крафт'));assert.equal(context.current,old);assert.equal(context.cleared,undefined);assert.equal(context.task,undefined);assert.equal($('reset-confirmation').open,false);
});
test('oversized custom volume is rejected before reset confirmation or deletion',async()=>{
 const {context,$,old}=harness();context.config=()=>({preset:'custom',width:128,length:128,height:128});await context.generate();
 assert.equal(context.current,old);assert.equal($('reset-confirmation').open,false);assert.equal($('error-modal').open,true);assert.equal(context.localStorage.removed,false);assert.equal(context.task,undefined);
});
test('excessive machine demand is rejected before clearing the saved factory',async()=>{
 const {context,$,old}=harness();context.P.estimate=()=>{throw Error('Слишком много станков')};await context.generate();assert.equal(context.current,old);assert.equal($('error-modal').open,true);assert.equal(context.localStorage.removed,false);
});
test('confirmation clears the factory before calculation, scrolls up and blocks duplicate generation',async()=>{
 const {context,$}=harness();const pending=context.generate();
 $('reset-confirmation').close('generate');await pending;
 assert.equal(context.current,null);assert.equal(context.modulePlans.length,0);assert.equal(context.hitboxes.length,0);
 assert.equal(context.canvas.style.visibility,'hidden');assert.equal(context.localStorage.removed,true);assert.equal(context.scrolled,true);
 assert.equal($('generation-loader').open,true);const originalTask=context.task;
 await context.generate();assert.equal(context.task,originalTask);
 context.workerResult=Promise.resolve({modules:[{config:{product:'iron'}}],proposal:null});await context.task();
 assert.equal($('generation-loader').open,false);assert.equal($('generate').disabled,false);assert.ok(context.current);assert.equal($('error-modal').open,false);
 assert.equal(context.saved.modules,context.modulePlans);assert.equal(context.timerStopped,true);assert.equal(context.viewportScrolled,true);
});
test('worker errors close the loader and appear in a modal without restoring the old factory',async()=>{
 const {context,$}=harness();const pending=context.generate();$('reset-confirmation').close('generate');await pending;
 context.workerResult=Promise.reject(new Error('Проверочная ошибка'));await context.task();
 assert.equal($('generation-loader').open,false);assert.equal($('error-modal').open,true);
 assert.equal($('error-message').textContent,'Проверочная ошибка');assert.equal($('error').textContent,'');assert.equal(context.current,null);
});
test('multiple modules are accepted, saved and summarized below the visualization',async()=>{
 const {context,$}=harness();const pending=context.generate();$('reset-confirmation').close('generate');await pending;
 const alternative={description:'Два модуля',modules:[{config:{product:'iron',rate:1},machines:[{}],width:48,length:48,bounds:{height:48}}],links:[]};
 context.workerResult=Promise.resolve({modules:alternative.modules,proposal:alternative});await context.task();
 assert.equal($('error-modal').open,false);assert.equal($('info-modal').open,false);assert.equal($('fit-panel').hidden,false);
 assert.ok(context.current);assert.equal(context.saved.proposal,alternative);assert.equal(context.saved.modules,alternative.modules);
 assert.ok($('fit-panel').children.length>0);
});
test('progress messages describe the current stage and never move backwards',()=>{
 const {context,$}=harness();vm.runInContext('generationBusy=true;startProgress()',context);
 const message=$('loader-description').textContent;context.generationProgress({stage:'routing',percent:65,message:'Прокладываем ленты'});assert.equal($('generation-progress').value,65);assert.equal($('loader-description').textContent,message);
 context.generationProgress({percent:10,split:true,message:'Подбираем второй модуль'});assert.equal($('generation-progress').value,78);
 context.tick();assert.ok($('generation-progress').value>=78);assert.ok($('generation-progress').value<100);
});


test('generation copy rotates every four seconds without repeats or worker flicker',()=>{
 const {context,$}=harness();vm.runInContext('generationBusy=true;startProgress()',context);
 const seen=new Set([$ ('loader-description').textContent]);
 for(let i=0;i<70;i++){
  const previous=$('loader-description').textContent;
  for(let tick=0;tick<4;tick++){context.generationProgress({stage:'routing',message:tick%2?'Строим':'Проверяем',percent:20});context.tick();assert.equal($('loader-description').textContent,previous)}
  context.tick();const next=$('loader-description').textContent;assert.ok(next);assert.ok(!seen.has(next));seen.add(next);
 }
 assert.equal(seen.size,71);
 context.stopProgress();assert.equal(context.timerStopped,true);
});
test('a new generation does not start with the previous message and copy is unique',()=>{
 const {context,$}=harness();vm.runInContext('generationBusy=true;startProgress()',context);const previous=$('loader-description').textContent;
 context.stopProgress();context.startProgress();assert.notEqual($('loader-description').textContent,previous);
 vm.runInContext('globalThis.copy=Object.values(generationMessages).flat()',context);assert.equal(new Set(context.copy).size,context.copy.length);assert.ok(context.copy.length>=100);
});


test('cancelling active generation rejects pending work and restores controls without an error modal',async()=>{
 const {context,$}=harness();context.current=null;context.modulePlans=[];context.pendingPlans=new Map();context.plannerWorker={terminate(){context.terminated=true}};context.clearTimeout=()=>{};
 await context.generate();let reject;context.workerResult=new Promise((resolve,r)=>{reject=r});context.pendingPlans.set(1,{timer:1,reject});const task=context.task();context.cancelGeneration();await task;
 assert.equal(context.terminated,true);assert.equal(context.pendingPlans.size,0);assert.equal($('generation-loader').open,false);assert.equal($('generate').disabled,false);assert.equal($('error-modal').open,false);assert.equal(context.current,null);
});
