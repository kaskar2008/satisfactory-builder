(function(root){
const version=1,planKeys=['config','exports','imports','power','shards','width','length','bounds','fit','floors','connections'];
function encode(config,modules,proposal=null){
 return {version,savedAt:Date.now(),moduleFlow:root.FactoryBounded.moduleOrder(modules)?'forward':'legacy',config,proposal:proposal?{kind:proposal.kind,description:proposal.description,links:proposal.links}:null,modules:modules.map(p=>{
  const out=Object.fromEntries(planKeys.map(k=>[k,p[k]]));out.machines=p.machines;out.groups=p.groups.map(g=>({...g,machines:g.machines.map(m=>m.id)}));
  const {routes,flowCheck,collisionCheck,equipmentCheck,...logistics}=p.logistics;out.logistics=logistics;return out;
 })};
}
function decode(data){
 if(data?.version!==version||!Array.isArray(data.modules)||!data.modules.length||data.modules.length>(root.FactoryBounded?.performanceLimits.machines??96))throw Error('Неподдерживаемый формат сохранённого завода.');
 const modules=structuredClone(data.modules);
 for(const p of modules){if(!Array.isArray(p.machines)||!p.machines.length||p.machines.length>600||!p.logistics?.edges)throw Error('Повреждён сохранённый завод.');
  p.groups.forEach(g=>g.machines=g.machines.map(id=>{const m=p.machines.find(m=>m.id===id);if(!m)throw Error('Не найден станок сохранённого завода.');return m}));
  p.logistics.routes=[];for(const e of p.logistics.edges)p.logistics.routes[e.id]=e.points;
  const L=root.FactoryLogistics,P=root.FactoryPlanner;p.logistics.flowCheck=L.checkFlows(p,P.recipesFor(p.config));p.logistics.collisionCheck=L.checkBeltCollisions(p.logistics);p.logistics.equipmentCheck=L.checkEquipmentCollisions(p,p.logistics);if(!p.logistics.collisionCheck.valid||!p.logistics.equipmentCheck.valid)throw Error("Сохранённые коммуникации пересекают оборудование или друг друга.");root.FactoryBounded.check(p);p.capacity=P.capacity(p);
 }
 if(data.moduleFlow==='forward'||data.config.independentModules){const order=root.FactoryBounded.moduleOrder(modules);if(!order)throw Error('Сохранённые модули содержат обратный поток.');const sorted=order.map(i=>modules[i]);modules.splice(0,modules.length,...sorted)}
 return {config:data.config,modules,proposal:data.proposal?{...data.proposal,modules}:null};
}
function database(){return new Promise((resolve,reject)=>{const request=indexedDB.open('factory-builder',1);request.onupgradeneeded=()=>request.result.createObjectStore('projects');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})}
async function operation(mode,action){const db=await database();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('projects',mode),request=action(tx.objectStore('projects'));tx.oncomplete=()=>resolve(request.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}finally{db.close()}}
const api={encode,decode,save:(config,modules,proposal)=>operation('readwrite',s=>s.put(encode(config,modules,proposal),'current')),read:()=>operation('readonly',s=>s.get('current')),clear:()=>operation('readwrite',s=>s.delete('current'))};root.FactoryProjectStore=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
