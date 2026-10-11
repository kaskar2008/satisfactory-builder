/* Directed production graph built from the actual logistics endpoints. */
(function(root){
const key=p=>p.map(v=>Math.round(v*1e5)).join(','),fmt=n=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(n);
function count(n,a,b,c){const v=Math.abs(n)%100;return n+' '+(v>=11&&v<=14?c:v%10===1?a:v%10>=2&&v%10<=4?b:c)}
function wrapText(value,limit){const lines=[];let line='';for(const word of String(value??'').split(/\s+/)){if(line&&(line+' '+word).length>limit){lines.push(line);line=word}else line+=(line?' ':'')+word}if(line)lines.push(line);return lines}
function secondaryOutputLines(n){const P=root.FactoryPlanner;return (n.outputs??[]).filter(o=>o.item!==n.item).flatMap(o=>wrapText(P.items[o.item]+' · '+fmt(o.rate)+' '+(P.isFluid(o.item)?'м³':'шт')+'/мин',32))}
function cardText(n,mode){
 const P=root.FactoryPlanner,name=mode==='recipes'&&n.type==='machine'?P.items[n.item]:n.label,detail=mode==='recipes'&&n.type==='machine'?count(n.count,'станок','станка','станков')+' · '+P.buildings[n.building].name:n.detail;
 const supplyDetail=n.type==='import'&&n.moduleRate>0?detail+' · из модулей '+fmt(n.moduleRate)+' / извне '+fmt(n.externalRate??0):detail,titles=wrapText(name,22),details=wrapText(supplyDetail,25),titleSize=12,detailSize=11;
 const detailY=14+Math.max(0,titles.length-1)*(titleSize+1)+14,rateY=detailY+Math.max(0,details.length-1)*(detailSize+1)+18;
 return {name,supplyDetail,titles,details,titleSize,detailSize,detailY,rateY};
}
function productionRanks(nodes,edges){
 const byId=new Map(nodes.map(n=>[n.id,n])),out=new Map(nodes.map(n=>[n.id,[]])),degree=new Map(nodes.map(n=>[n.id,0]));
 const reaches=(from,to)=>{const stack=[from],seen=new Set();while(stack.length){const id=stack.pop();if(id===to)return true;if(seen.has(id))continue;seen.add(id);stack.push(...out.get(id))}return false};
 const priority=e=>{const source=byId.get(e.from);return source.type==='machine'&&source.item!==e.item?1:0};
 for(const e of [...edges].sort((a,b)=>priority(a)-priority(b))){if(reaches(e.to,e.from))continue;out.get(e.from).push(e.to);degree.set(e.to,degree.get(e.to)+1)}
 for(const n of nodes)n.rank=0;const queue=nodes.filter(n=>!degree.get(n.id));for(let i=0;i<queue.length;i++)for(const id of out.get(queue[i].id)){const n=byId.get(id);n.rank=Math.max(n.rank,queue[i].rank+1);degree.set(id,degree.get(id)-1);if(!degree.get(id))queue.push(n)}
}
function build(plans,proposal){
 const P=root.FactoryPlanner,L=root.FactoryLogistics,nodes=[],edges=[];
 plans.forEach((p,module)=>{
  const inputs=new Map(),outputs=new Map(),prefix='m'+module+':',register=(map,ports,id)=>{for(const port of ports)map.set(port.item+':'+key(port.point),id)};
  for(const m of p.machines){const id=prefix+'machine'+m.id,ports=L.machinePorts(p,m,P.recipesFor(p.config));nodes.push({id,module,item:m.group,building:m.b,rate:P.recipesFor(p.config)[m.group].out*m.clock,outputs:Object.entries(P.outputs(P.recipesFor(p.config)[m.group],m.group)).map(([item,rate])=>({item,rate:rate*m.clock})),count:1,type:'machine',label:P.buildings[m.b].name+' #'+(m.id+1),detail:P.items[m.group]});register(inputs,ports.inputs,id);register(outputs,ports.outputs,id)}
  for(const n of p.logistics.nodes){const id=prefix+'node'+n.id;nodes.push({id,module,type:n.type,label:(n.type==='splitter'?'Разветвитель':'Объединитель')+' #'+(n.id+1),detail:P.items[n.item]});register(inputs,(n.type==='splitter'?[n.ports.input]:n.ports.inputs).map(v=>({...v,item:n.item})),id);register(outputs,(n.type==='splitter'?n.ports.outputs:[n.ports.output]).map(v=>({...v,item:n.item})),id)}
  const endpoint=(ep,e,map)=>{if(ep.kind){const id=prefix+ep.kind+':'+e.id;nodes.push({id,module,type:ep.kind,label:ep.kind==='import'?'Поставка':'Выход',detail:P.items[e.item],item:e.item,rate:e.rate});return id}const id=map.get(e.item+':'+key(ep.point));if(!id)throw Error('Не найден узел графа для '+e.item);return id};
  for(const e of p.logistics.edges)edges.push({id:prefix+'edge'+e.id,from:endpoint(e.from,e,outputs),to:endpoint(e.to,e,inputs),item:e.item,rate:e.rate,kind:e.kind,color:e.color??p.logistics.colors[e.item]});
 });
 if(proposal?.kind==='stages')for(const link of proposal.links){
  const sources=new Set(plans.flatMap((p,i)=>(p.exports?p.exports[link.item]:p.config.product===link.item)?[i]:[]));if(!sources.size)sources.add(0);
  const exports=nodes.filter(n=>n.type==='export'&&n.item===link.item&&sources.has(n.module)).map(n=>({n,remaining:n.rate,used:0})),imports=nodes.filter(n=>n.type==='import'&&n.item===link.item&&!(plans[n.module].config.externalFeedbackItems??[]).includes(link.item));
  const allocations=[];for(const input of imports){let remaining=input.rate;for(const source of exports){if(source.n.module===input.module)continue;const rate=Math.min(remaining,source.remaining);if(rate<=1e-7)continue;allocations.push({input,rate});source.remaining-=rate;source.used+=rate;remaining-=rate}input.moduleRate=input.rate-remaining;input.externalRate=remaining}
  if(!allocations.length)continue;const id='transfer:'+link.item;nodes.push({id,item:link.item,type:'transfer',label:'Между модулями',detail:P.items[link.item],rate:allocations.reduce((n,e)=>n+e.rate,0)});
  for(const source of exports)if(source.used>1e-7)edges.push({id:id+':'+source.n.id,from:source.n.id,to:id,item:link.item,rate:source.used,kind:'transfer',color:'#81cbb5'});
  for(const {input,rate} of allocations){const old=edges.find(e=>e.id===id+':'+input.id);if(old)old.rate+=rate;else edges.push({id:id+':'+input.id,from:id,to:input.id,item:link.item,rate,kind:'transfer',color:'#81cbb5'})}

 }
 for(const n of nodes)if(n.type==='import'){n.moduleRate??=0;n.externalRate??=n.rate}
 const byId=new Map(nodes.map(n=>[n.id,n])),degree=new Map(nodes.map(n=>[n.id,0])),out=new Map(nodes.map(n=>[n.id,[]]));
 for(const e of edges){degree.set(e.to,degree.get(e.to)+1);out.get(e.from).push(e.to)}
 const queue=nodes.filter(n=>!degree.get(n.id));for(const n of nodes)n.rank=0;
 for(let i=0;i<queue.length;i++){const n=queue[i];for(const id of out.get(n.id)){const next=byId.get(id);next.rank=Math.max(next.rank,n.rank+1);degree.set(id,degree.get(id)-1);if(!degree.get(id))queue.push(next)}}
 // Cyclic recipes retain their connections; unresolved nodes share a final column.
 productionRanks(nodes,edges);
 // Keep each production module in its own consecutive block of columns.
 if(plans.length>1){let offset=0;plans.forEach((p,module)=>{
  const local=nodes.filter(n=>n.module===module),ids=new Set(local.map(n=>n.id)),localEdges=edges.filter(e=>ids.has(e.from)&&ids.has(e.to)),degree=new Map(local.map(n=>[n.id,0])),out=new Map(local.map(n=>[n.id,[]]));
  for(const n of local)n.rank=0;for(const e of localEdges){degree.set(e.to,degree.get(e.to)+1);out.get(e.from).push(e.to)}
  const queue=local.filter(n=>!degree.get(n.id));for(let i=0;i<queue.length;i++)for(const id of out.get(queue[i].id)){const n=byId.get(id);n.rank=Math.max(n.rank,queue[i].rank+1);degree.set(id,degree.get(id)-1);if(!degree.get(id))queue.push(n)}
  productionRanks(local,localEdges);for(const n of local){n.rank+=offset}offset=Math.max(offset,...local.map(n=>n.rank))+2;
 });
 for(const n of nodes.filter(n=>n.type==='transfer')){const sources=edges.filter(e=>e.to===n.id).map(e=>byId.get(e.from).rank);n.rank=Math.max(0,...sources)+1}
 }
 const graph=layout(nodes,edges);graph.groups=plans.map((p,module)=>{
  const members=nodes.filter(n=>n.module===module),left=Math.min(...members.map(n=>n.x))-20,right=Math.max(...members.map(n=>n.x+230))+20;
  const outputs=Object.entries(p.exports??{[p.config.product]:p.config.rate}).filter(([,rate])=>rate>0).map(([item,rate])=>P.items[item]+' · '+fmt(rate)+' '+(P.isFluid(item)?'м³':'шт')+'/мин');
  return {module,x:left,y:14,width:right-left,height:graph.height-28,title:'Этап '+(module+1)+' · Модуль '+(module+1),detail:outputs.join(' / '),machines:p.machines.length};
 });return graph;

}
function layout(nodes,edges){
 for(const n of nodes)n.height=Math.max(78,cardText(n,'recipes').rateY+10,cardText(n,'all').rateY+10)+(secondaryOutputLines(n).length?12+secondaryOutputLines(n).length*14:0);const rowHeight=Math.max(130,...nodes.map(n=>n.height+52));
 const byId=new Map(nodes.map(n=>[n.id,n])),layers=[],chains=new Map(),before=new Map(),after=new Map();
 const add=n=>{(layers[n.rank]??=[]).push(n);before.set(n.id,[]);after.set(n.id,[])};nodes.forEach(add);
 // Reserve a lane in every skipped column so long edges cannot pass through cards.
 for(const e of edges){const a=byId.get(e.from),b=byId.get(e.to),chain=[a];
  for(let rank=a.rank+1;rank<b.rank;rank++){const n={id:'lane:'+e.id+':'+rank,rank,dummy:true};add(n);chain.push(n)}chain.push(b);chains.set(e.id,chain);
  for(let i=1;i<chain.length;i++){after.get(chain[i-1].id).push(chain[i]);before.get(chain[i].id).push(chain[i-1])}
 }
 const order=new Map(),index=()=>layers.forEach(column=>column?.forEach((n,i)=>order.set(n.id,i)));index();
 const crossings=()=>{let count=0;for(let rank=0;rank<layers.length-1;rank++){const pairs=[];for(const n of layers[rank]??[])for(const v of after.get(n.id))if(v.rank===rank+1)pairs.push([order.get(n.id),order.get(v.id)]);for(let i=0;i<pairs.length;i++)for(let j=i+1;j<pairs.length;j++)if((pairs[i][0]-pairs[j][0])*(pairs[i][1]-pairs[j][1])<0)count++}return count};
 let best=layers.map(v=>v?.slice()),score=crossings();
 for(let pass=0;pass<8;pass++){const forward=pass%2===0,ranks=Array.from({length:layers.length},(_,i)=>i);if(!forward)ranks.reverse();
  for(const rank of ranks){const column=layers[rank];if(!column)continue;const neighbors=forward?before:after,center=n=>{const values=neighbors.get(n.id).filter(v=>forward?v.rank<rank:v.rank>rank).map(v=>order.get(v.id));return values.length?values.reduce((a,b)=>a+b,0)/values.length:order.get(n.id)};
   const centers=new Map(column.map(n=>[n.id,center(n)]));column.sort((a,b)=>centers.get(a.id)-centers.get(b.id)||order.get(a.id)-order.get(b.id));index();
  }
  const next=crossings();if(next<score){score=next;best=layers.map(v=>v?.slice())}
 }
 best.forEach((column,rank)=>column?.forEach((n,i)=>{n.x=40+rank*450;n.y=100+i*rowHeight}));
 const incoming=new Map(nodes.map(n=>[n.id,[]])),outgoing=new Map(nodes.map(n=>[n.id,[]]));for(const e of edges){incoming.get(e.to).push(e);outgoing.get(e.from).push(e)}
 const ports=new Map();for(const [side,map] of [['in',incoming],['out',outgoing]])for(const [id,list] of map){list.sort((a,b)=>byId.get(side==='in'?a.from:a.to).y-byId.get(side==='in'?b.from:b.to).y);list.forEach((e,i)=>ports.set(side+e.id,byId.get(id).y+14+(byId.get(id).height-28)*(i+1)/(list.length+1)))}
 let returnLane=0;const rows=Math.max(1,...best.map(v=>v?.length??0)),baseHeight=rows*rowHeight+120;
 for(const e of edges){const chain=chains.get(e.id),a=chain[0],b=chain.at(-1),start=[a.x+230,ports.get('out'+e.id)],end=[b.x,ports.get('in'+e.id)];let d='M '+start.join(' '),last=start;
  if(b.rank<=a.rank){const lane=baseHeight+30*++returnLane;d+=' L '+(start[0]+20)+' '+start[1]+' L '+(start[0]+20)+' '+lane+' L '+(end[0]-20)+' '+lane+' L '+(end[0]-20)+' '+end[1]+' L '+end.join(' ');e.labelPoint=[(start[0]+end[0])/2,lane-10]}
  else{for(let i=1;i<chain.length;i++){const n=chain[i],entry=n.dummy?[n.x,n.y+39]:end,exit=[n.x+230,n.y+39],gap=entry[0]-last[0],bend=gap*.5;d+=' C '+(last[0]+bend)+' '+last[1]+', '+(entry[0]-bend)+' '+entry[1]+', '+entry.join(' ');if(i===1)e.labelPoint=[(last[0]+entry[0])/2,(last[1]+entry[1])/2-14];if(n.dummy)d+=' L '+exit.join(' ');last=exit}}
  e.path=d;
 }
 return {nodes,edges,crossings:score,width:Math.max(800,80+best.length*450),height:Math.max(420,baseHeight+returnLane*30+30)};
}
function recipesGraph(raw){
 const nodes=[],byKey=new Map(),mapping=new Map();
 for(const original of raw.nodes){if(original.type==='splitter'||original.type==='merger')continue;
 // Stage boundaries describe the same flow as the local import/export, not extra supply.
 const key=original.module+':'+original.type+':'+(original.boundary?original.id:original.type==='machine'?original.item+':'+original.building:original.item??original.id);
 let n=byKey.get(key);if(!n){n={...original,id:key,count:0,rate:0,outputs:[],moduleRate:0,externalRate:0};byKey.set(key,n);nodes.push(n)}for(const output of original.outputs??[]){let target=n.outputs.find(o=>o.item===output.item);if(!target){target={item:output.item,rate:0};n.outputs.push(target)}target.rate+=output.rate}n.count+=original.count??1;n.rate+=original.rate??0;n.moduleRate+=original.moduleRate??0;n.externalRate+=original.externalRate??0;mapping.set(original.id,n.id);
 }
 const out=new Map(raw.nodes.map(n=>[n.id,[]]));for(const e of raw.edges)out.get(e.from).push(e);
 const edges=[],merged=new Map();
 const add=(from,to,edge,rate)=>{const key=from+'>'+to+':'+edge.item;let e=merged.get(key);if(!e){e={...edge,id:'recipe:'+key,from,to,rate:0};merged.set(key,e);edges.push(e)}e.rate+=rate};
 for(const original of raw.nodes){if(!mapping.has(original.id))continue;const from=mapping.get(original.id);
 for(const first of out.get(original.id)){const walk=(edge,rate,seen)=>{if(mapping.has(edge.to)){add(from,mapping.get(edge.to),first,rate);return}if(seen.has(edge.to))return;const next=out.get(edge.to).filter(e=>e.item===first.item),total=next.reduce((n,e)=>n+e.rate,0);if(!total)return;const visited=new Set(seen);visited.add(edge.to);for(const e of next)walk(e,rate*e.rate/total,visited)};walk(first,first.rate,new Set())}
 }
 const byId=new Map(nodes.map(n=>[n.id,n]));let offset=0;
 for(const group of raw.groups){const local=nodes.filter(n=>n.module===group.module),ids=new Set(local.map(n=>n.id)),localEdges=edges.filter(e=>ids.has(e.from)&&ids.has(e.to)),degree=new Map(local.map(n=>[n.id,0])),out=new Map(local.map(n=>[n.id,[]]));for(const n of local)n.rank=0;
 for(const e of localEdges){degree.set(e.to,degree.get(e.to)+1);out.get(e.from).push(e.to)}const queue=local.filter(n=>!degree.get(n.id));for(let i=0;i<queue.length;i++)for(const id of out.get(queue[i].id)){const n=byId.get(id);n.rank=Math.max(n.rank,queue[i].rank+1);degree.set(id,degree.get(id)-1);if(!degree.get(id))queue.push(n)}
 productionRanks(local,localEdges);for(const n of local){n.rank+=offset}offset=Math.max(offset,...local.map(n=>n.rank))+2;
 }
 for(const n of nodes.filter(n=>n.type==='transfer'))n.rank=Math.max(0,...edges.filter(e=>e.to===n.id).map(e=>byId.get(e.from).rank))+1;
 const graph=layout(nodes,edges);graph.groups=raw.groups.map(group=>{const members=nodes.filter(n=>n.module===group.module),left=Math.min(...members.map(n=>n.x))-20,right=Math.max(...members.map(n=>n.x+230))+20;return {...group,x:left,width:right-left,height:graph.height-28}});return graph;
}
function stageGraph(raw,module){
 const nodes=raw.nodes.filter(n=>n.module===module).map(n=>({...n,rank:0})),ids=new Set(nodes.map(n=>n.id)),edges=raw.edges.filter(e=>ids.has(e.from)&&ids.has(e.to)).map(e=>({...e}));
 for(const hub of raw.nodes.filter(n=>n.type==='transfer')){
  const incoming=raw.edges.filter(e=>e.from===hub.id&&ids.has(e.to)),outgoing=raw.edges.filter(e=>e.to===hub.id&&ids.has(e.from));
  if(incoming.length){const sources=[...new Set(raw.edges.filter(e=>e.to===hub.id).map(e=>raw.nodes.find(n=>n.id===e.from)?.module).filter(m=>m!==undefined&&m!==module))];
   const sourceId=hub.id+':input';nodes.push({...hub,id:sourceId,module,boundary:true,type:'import',externalRate:0,moduleRate:incoming.reduce((n,e)=>n+e.rate,0),label:'Из '+sources.map(m=>'модуля '+(m+1)).join(', '),rate:incoming.reduce((n,e)=>n+e.rate,0),rank:0});
   let distributor=sourceId;if(incoming.length>1){distributor=sourceId+':splitter';nodes.push({id:distributor,module,item:hub.item,type:'splitter',label:'Разветвитель',detail:root.FactoryPlanner.items[hub.item],rank:0});edges.push({id:distributor+':feed',from:sourceId,to:distributor,item:hub.item,rate:incoming.reduce((n,e)=>n+e.rate,0),kind:'transfer',color:incoming[0].color})}
   for(const e of incoming)edges.push({...e,from:distributor});
  }
  if(outgoing.length){const id=hub.id+':output',destinations=[...new Set(raw.edges.filter(e=>e.from===hub.id).map(e=>raw.nodes.find(n=>n.id===e.to)?.module).filter(m=>m!==undefined&&m!==module))];nodes.push({...hub,id,module,boundary:true,type:'export',label:'В '+destinations.map(m=>'модуль '+(m+1)).join(', '),rate:outgoing.reduce((n,e)=>n+e.rate,0),rank:0});for(const e of outgoing)edges.push({...e,to:id})}
 }
 const byId=new Map(nodes.map(n=>[n.id,n])),degree=new Map(nodes.map(n=>[n.id,0])),out=new Map(nodes.map(n=>[n.id,[]]));for(const e of edges){degree.set(e.to,degree.get(e.to)+1);out.get(e.from).push(e.to)}const queue=nodes.filter(n=>!degree.get(n.id));for(let i=0;i<queue.length;i++)for(const id of out.get(queue[i].id)){const n=byId.get(id);n.rank=Math.max(n.rank,queue[i].rank+1);degree.set(id,degree.get(id)-1);if(!degree.get(id))queue.push(n)}productionRanks(nodes,edges);
 const graph=layout(nodes,edges);graph.groups=raw.groups.filter(g=>g.module===module).map(g=>({...g,x:0,width:graph.width,height:graph.height}));return graph;
}
function render(host,plans,proposal,{flow='all',module='all',mode='recipes',onSelect}={}){
 const full=build(plans,proposal),raw=module==='all'?full:stageGraph(full,+module),graph=mode==='recipes'?recipesGraph(raw):raw,P=root.FactoryPlanner,ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
 svg.setAttribute('width',graph.width);svg.setAttribute('height',graph.height);svg.setAttribute('viewBox','0 0 '+graph.width+' '+graph.height);svg.setAttribute('role','img');svg.setAttribute('aria-label','Граф всех связей производства');
 const el=(tag,attrs,text)=>{const n=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);if(text)n.textContent=text;return n},byId=new Map(graph.nodes.map(n=>[n.id,n]));
 const filtered=graph.edges.filter(e=>(flow==='all'||e.item===flow)&&(module==='all'||byId.get(e.from).module===+module||byId.get(e.to).module===+module)),visible=new Set(filtered.flatMap(e=>[e.from,e.to]));
 if(flow==='all')for(const n of graph.nodes)if(module==='all'||n.module===+module)visible.add(n.id);
 if((module!=='all'||flow!=='all')&&visible.size){const points=graph.nodes.filter(n=>visible.has(n.id)).flatMap(n=>[[n.x,n.y],[n.x+230,n.y+n.height]]);for(const e of filtered){const values=e.path.match(/-?\d+(?:\.\d+)?/g).map(Number);for(let i=0;i<values.length;i+=2)points.push([values[i],values[i+1]]);points.push(e.labelPoint)}const left=Math.min(...points.map(p=>p[0]))-30,top=Math.min(...points.map(p=>p[1]))-40,width=Math.max(...points.map(p=>p[0]))-left+30,height=Math.max(...points.map(p=>p[1]))-top+40;svg.setAttribute('viewBox',[left,top,width,height].join(' '));svg.setAttribute('width',width);svg.setAttribute('height',height)}
 if(module==='all'&&plans.length>1)for(const group of graph.groups){if(!graph.nodes.some(n=>n.module===group.module&&visible.has(n.id)))continue;
 const palette=['#60cbb1','#7cb9ed','#d5a2ee','#e4bb77'],color=palette[group.module%palette.length],g=el('g',{class:'graph-stage'});
 g.append(el('rect',{x:group.x,y:group.y,width:group.width,height:group.height,rx:16,fill:color,'fill-opacity':.045,stroke:color,'stroke-opacity':.6,'stroke-width':2}));
 g.append(el('text',{x:group.x+18,y:group.y+27,fill:color,class:'graph-stage-title'},group.title),el('text',{x:group.x+18,y:group.y+49,class:'graph-stage-detail'},group.detail+' · '+count(group.machines,'станок','станка','станков')));svg.append(g);
 }
 const animation={paths:[],nodes:[],circles:new Map(),el};host.__simulationGraph=animation;const defs=el('defs',{}),marker=el('marker',{id:'graph-arrow',viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:7,markerHeight:7,orient:'auto-start-reverse'});marker.append(el('path',{d:'M 0 0 L 10 5 L 0 10 z',fill:'context-stroke'}));defs.append(marker);svg.append(defs);
 for(const e of filtered){const path=el('path',{d:e.path,fill:'none',stroke:e.color??'#a5c1d0','stroke-width':2,'marker-end':'url(#graph-arrow)','stroke-dasharray':e.kind==='transfer'?'7 5':'none'});
 const product=P.items[e.item],rate=fmt(e.rate)+' '+(P.isFluid(e.item)?'м³':'шт')+'/мин',label=product+': '+rate;path.append(el('title',{},label));svg.append(path);animation.paths.push({edge:e,path,from:byId.get(e.from),to:byId.get(e.to)});const [x,y]=e.labelPoint,text=el('text',{x,y,'text-anchor':'middle',class:'graph-edge-label'});text.append(el('tspan',{x,dy:0},product),el('tspan',{x,dy:13},rate));svg.append(text)}

 for(const n of graph.nodes.filter(n=>visible.has(n.id))){const g=el('g',{class:'graph-node'+(host.__selectedNode===n.id?' selected':''),'data-node-id':n.id,'aria-pressed':String(host.__selectedNode===n.id),tabindex:0}),color=n.type==='import'?'#50dfb0':n.type==='export'?'#ffba66':'#86b9cb';
 if(onSelect){g.setAttribute('role','button');g.setAttribute('aria-label',n.label+' · '+(P.items[n.item]??n.detail));g.style.cursor='pointer';let press=null;g.onpointerdown=e=>{if(e.button===0){e.preventDefault();e.stopPropagation();press=[e.clientX,e.clientY]}};g.onpointercancel=()=>{press=null};g.onclick=e=>{const dragged=press&&Math.hypot(e.clientX-press[0],e.clientY-press[1])>4;press=null;if(!dragged)onSelect(n)};g.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(n)}}}
 g.append(el('rect',{x:n.x,y:n.y,width:230,height:n.height,rx:16,fill:n.type==='machine'?'#283b43':'#1c3034',stroke:color}));
 if(n.type==='machine'){const clipId='graph-craft-'+animation.nodes.length,clip=el('clipPath',{id:clipId});clip.append(el('rect',{x:n.x,y:n.y,width:230,height:n.height,rx:16}));defs.append(clip);const fill=el('rect',{x:n.x,y:n.y,width:0,height:n.height,fill:'#50dfb0','fill-opacity':.22,'clip-path':'url(#'+clipId+')','pointer-events':'none'});g.append(fill);animation.nodes.push({node:n,fill})}
 const icon=P.itemIcons[n.item];if(icon){g.append(el('circle',{cx:n.x+35,cy:n.y+39,r:26,fill:'#15252e',stroke:color,'stroke-opacity':.5}));g.append(el('image',{href:icon,x:n.x+13,y:n.y+17,width:44,height:44}))}
 const x=n.x+(icon?70:12),{name,supplyDetail,titles,details,titleSize,detailSize,detailY,rateY}=cardText(n,mode),rate=n.rate?fmt(n.rate)+' '+(P.isFluid(n.item)?'м³':'шт')+'/мин':n.module===undefined?'Между этапами':'Модуль '+(n.module+1);
 const title=el('text',{x,y:n.y+14,class:'graph-node-title','font-size':titleSize,style:'font-size:'+titleSize+'px'});titles.forEach((line,i)=>title.append(el('tspan',{x,dy:i?titleSize+1:0},line)));
 const detailText=el('text',{x,y:n.y+detailY,class:'graph-node-detail',style:'font-size:'+detailSize+'px'});details.forEach((line,i)=>detailText.append(el('tspan',{x,dy:i?detailSize+1:0},line)));
 g.append(title,detailText,el('text',{x,y:n.y+rateY,class:'graph-node-rate'},rate));const secondary=secondaryOutputLines(n);secondary.forEach((line,i)=>g.append(el('text',{x:n.x+12,y:n.y+Math.max(94,rateY+22)+i*14,class:'graph-node-detail',style:'font-size:11px'},line)));g.append(el('title',{},name+' · '+supplyDetail+' · '+rate+(secondary.length?' · '+secondary.join(' '):'')));svg.append(g)}

 const cards=graph.nodes.filter(n=>visible.has(n.id));if(cards.length){const left=Math.min(...cards.map(n=>n.x)),top=Math.min(...cards.map(n=>n.y)),right=Math.max(...cards.map(n=>n.x+230)),bottom=Math.max(...cards.map(n=>n.y+n.height));svg.setAttribute('data-content-bounds',JSON.stringify([left,top,right-left,bottom-top]))}
 animation.layer=el('g',{'pointer-events':'none',class:'graph-simulation-particles'});svg.append(animation.layer);host.__graph=graph;host.replaceChildren(svg);return graph;
}
function selectNode(host,id){
 host.__selectedNode=id??null;
 for(const card of host.querySelectorAll('.graph-node')){const active=card.getAttribute('data-node-id')===host.__selectedNode;card.classList.toggle('selected',active);card.setAttribute('aria-pressed',String(active))}
}
function updateSimulation(host,simulation){
 const a=host.__simulationGraph;if(!a)return;
 if(a.simulation!==simulation){
  a.simulation=simulation;a.lastTime=null;a.bindings=[];
  const paths=new Map(a.paths.map(p=>[p.edge.id,p])),overview=new Map();
  for(const p of a.paths)if(p.edge.id.startsWith('recipe:')){const key=p.from.module+':'+p.edge.item;if(!overview.has(key))overview.set(key,p)}
  for(const entry of a.nodes)entry.states=simulation?.modules[entry.node.module]?.machines.filter(s=>/^m\d+:machine\d+$/.test(entry.node.id)?entry.node.id==='m'+entry.node.module+':machine'+s.m.id:s.m.group===entry.node.item)??[];
  if(simulation)for(const module of simulation.modules)for(const edge of module.edges){const link=paths.get('m'+module.index+':edge'+edge.e.id)??overview.get(module.index+':'+edge.e.item);if(!link)continue;
   if(!link.samples){const length=link.path.getTotalLength();link.samples=Array.from({length:129},(_,i)=>link.path.getPointAtLength(length*i/128))}
   a.bindings.push({module:module.index,edge,link});
  }
 }
 // Limit SVG attribute updates to 30 Hz; the transport engine keeps its full time step.
 if(simulation&&a.lastTime!==null&&simulation.time-a.lastTime<1/30)return;a.lastTime=simulation?.time??null;
 for(const {states,fill} of a.nodes){const progress=states.length?states.reduce((sum,s)=>sum+(s.remaining===null?0:Math.max(0,Math.min(1,1-s.remaining/s.duration))),0)/states.length:0;fill.setAttribute('width',230*progress)}
 const active=new Set();for(const {module,edge,link} of a.bindings)for(const item of edge.items){const key=module+':'+item.token.id;active.add(key);let circle=a.circles.get(key);if(!circle){circle=a.el('circle',{r:3.5,fill:edge.fluid?'#73dcff':'#ffd27c',stroke:'#142128','stroke-width':1});a.circles.set(key,circle);a.layer.append(circle)}
  const offset=Math.max(0,Math.min(1,item.d/edge.length))*128,index=Math.min(127,Math.floor(offset)),t=offset-index,A=link.samples[index],B=link.samples[index+1];circle.setAttribute('cx',A.x+(B.x-A.x)*t);circle.setAttribute('cy',A.y+(B.y-A.y)*t);
 }
 if(simulation)for(const event of simulation.transferEvents??[]){const age=simulation.time-event.time,duration=event.duration??1;if(age<0||age>duration)continue;for(const link of a.paths.filter(p=>p.edge.kind==='transfer'&&p.edge.item===event.item&&(event.phase==='out'?p.from.type==='export'&&p.from.module===event.module:p.to.type==='import'&&p.to.module===event.module))){if(!link.samples){const length=link.path.getTotalLength();link.samples=Array.from({length:129},(_,i)=>link.path.getPointAtLength(length*i/128))}const key='transfer:'+event.phase+':'+event.id+':'+link.edge.id;active.add(key);let circle=a.circles.get(key);if(!circle){circle=a.el('circle',{r:3.5,fill:'#73dcff'});a.circles.set(key,circle);a.layer.append(circle)}const offset=age/duration*128,i=Math.min(127,Math.floor(offset)),t=offset-i,A=link.samples[i],B=link.samples[i+1];circle.setAttribute('cx',A.x+(B.x-A.x)*t);circle.setAttribute('cy',A.y+(B.y-A.y)*t)}}
 for(const [key,circle] of a.circles)if(!active.has(key)){circle.remove();a.circles.delete(key)}
}
function boundPan(camera,size,viewport){const keepX=Math.min(size[0]*.1,viewport[0]*.9),keepY=Math.min(size[1]*.1,viewport[1]*.9);return {...camera,x:Math.max(keepX-size[0],Math.min(viewport[0]-keepX,camera.x)),y:Math.max(keepY-size[1],Math.min(viewport[1]-keepY,camera.y))}}
function zoomAt(camera,factor,point){const zoom=Math.max(.03,Math.min(8,camera.zoom*factor)),ratio=zoom/camera.zoom;return {zoom,x:point[0]-(point[0]-camera.x)*ratio,y:point[1]-(point[1]-camera.y)*ratio}}
root.FactoryGraph={build,stageGraph,layout,recipesGraph,render,selectNode,updateSimulation,zoomAt,boundPan};if(typeof module!=='undefined')module.exports=root.FactoryGraph;
})(globalThis);
