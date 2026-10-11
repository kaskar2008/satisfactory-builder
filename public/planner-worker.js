importScripts('recipe-catalog.js','logistics.js','bounded.js','planner.js');
onmessage=({data})=>{
 let last=0,lastStage='',split=!!data.modulesOnly||!!data.config.independentModules,deadline=performance.now()+(split?240000:100000);
 globalThis.FactoryCheckBudget=()=>{if(performance.now()>deadline)throw Object.assign(Error('Истекло время поиска компоновки'),{code:'planning-timeout'})};
 globalThis.FactoryProgress=event=>{FactoryCheckBudget();const now=performance.now();if(now-last<180&&!event.force&&event.stage===lastStage)return;last=now;lastStage=event.stage;postMessage({id:data.id,progress:{...event,split}})};
 try{
  globalThis.FactoryBounded?.checkPerformanceConfig(data.config);
  FactoryPlanner.estimate?.(data.config);
  FactoryProgress({stage:'demand',percent:3,message:'Рассчитываем рецепты, поставки и разгон станков',force:true});
  let plan,proposal=null;
  try{if(split)throw Object.assign(Error('Переходим к модулям'),{code:'planning-timeout'});plan=FactoryPlanner.plan(data.config)}catch(e){if(!['volume-fit','planning-timeout'].includes(e.code))throw e;split=true;deadline=performance.now()+240000;FactoryProgress({stage:'modules',percent:78,message:data.config.independentModules?'Разделяем производство на логические модули по рецептам':'Поиск одного модуля завершён. Разносим производство по отдельным модулям',force:true});proposal=FactoryPlanner.propose(data.config);if(!proposal)throw e}
  if(proposal?.modules.length===1){plan=proposal.modules[0];proposal=null}
  deadline=Infinity;
  FactoryProgress({stage:'validation',percent:97,message:'Проверяем потоки, границы и готовим завод к отображению',force:true});
  globalThis.FactoryBounded?.checkPerformanceLoad(proposal?proposal.modules:[plan]);
  if(!data.config.allowFeedback&&globalThis.FactoryBounded?.moduleOrder&&!FactoryBounded.moduleOrder(proposal?proposal.modules:[plan]))throw Object.assign(Error('Модули образуют обратный поток. Нужно разделить этапы производства.'),{code:'volume-fit'});
  postMessage({id:data.id,result:{modules:proposal?proposal.modules:[plan],proposal}});
 }catch(e){postMessage({id:data.id,error:{message:e.message,code:e.code,feedback:e.feedback,feedbackItems:e.feedbackItems}})}finally{globalThis.FactoryProgress=null;globalThis.FactoryCheckBudget=null}
};
