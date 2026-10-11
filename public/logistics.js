/* Capacity planning and geometric checks. Clearance is a planner preference,
   not a claimed universal game minimum. Coordinates use the calculated elevation of each floor. */
(function(root){
const rules={maxSlope:35,minRadius:2,minSegment:.5,maxSegment:56,minLift:4,maxLift:48,nodeSize:4,nodeHeight:3,heightStep:.3};

function assignFloors(p){
 const count=Math.max(...p.machines.map(m=>m.floor))+1;let y=0;
 p.floors=Array.from({length:count},(_,index)=>{const equipmentHeight=Math.max(0,...p.machines.filter(m=>m.floor===index).map(m=>m.h)),height=Math.ceil(equipmentHeight+2),f={index,y,height,equipmentHeight,ceiling:y+height};y+=height;return f});
 for(const m of p.machines)m.y=floorBase(p,m.floor);return p.floors;
}
function floorBase(p,f){return p.floors?.[f]?.y??f*16}
function floorAt(p,y){if(!p.floors)return Math.max(0,Math.min((p.fit?.usedFloors??p.config.floors)-1,Math.floor((y+1e-5)/16)));let f=0;for(const level of p.floors)if(y>=level.y-1e-5)f=level.index;return f}
function displayY(p,y){return y}
function actualY(p,y){return y}
function displayBase(p,f){return floorBase(p,f)}
function overhead(p,y){const f=p.floors?.[floorAt(p,y)];return f?y>=f.y+f.equipmentHeight+.8:y%16>=14}

// Sparse 3D A*: heading is part of the state; a lift can start at any free
// corridor point. The heap avoids scanning the entire frontier each step.
function search3D({start,end,bounds,boxes=[],segments=[],anchors=[],cost,upperBound=Infinity,maxExpanded=5000,priorityWeight=1,minVertical=rules.minLift}){
const axes=[0,1,2].map(k=>{const size=[bounds.width,bounds.height,bounds.length][k],values=[start[k],end[k],.8,size-.8,...anchors.map(p=>p[k]),...(k===1?[start[1]-rules.minLift,start[1]+rules.minLift,end[1]-rules.minLift,end[1]+rules.minLift]:[])];for(let n=k===1?5.2:2;n<size-.8;n+=(k===1?rules.heightStep:2))values.push(Math.round(n*1e6)/1e6);for(const box of boxes)values.push(box.lo[k]-.1,box.hi[k]+.1);for(const s of segments)if(k!==1)values.push(s.a[k]-1.5,s.a[k]+1.5,s.b[k]-1.5,s.b[k]+1.5);return [...new Set(values.filter(n=>n>=.8-1e-7&&n<=size-.8+1e-7))].sort((a,b)=>a-b)});
const [xs,ys,zs]=axes,ny=ys.length,nz=zs.length,encode=(x,y,z)=>((x*ny+y)*nz+z),decode=id=>{const z=id%nz,n=(id-z)/nz,y=n%ny;return [(n-y)/ny,y,z]},point=id=>decode(id).map((n,k)=>axes[k][n]);
const source=encode(xs.indexOf(start[0]),ys.indexOf(start[1]),zs.indexOf(start[2])),target=encode(xs.indexOf(end[0]),ys.indexOf(end[1]),zs.indexOf(end[2]));
const edgeCost=cost||((a,b)=>Math.hypot(...a.map((v,k)=>v-b[k]))),heuristic=p=>.7*(Math.abs(p[0]-end[0])+Math.abs(p[2]-end[2]))+.35*Math.abs(p[1]-end[1]);
const blocked=(a,b)=>{const axis=a.findIndex((v,k)=>Math.abs(v-b[k])>1e-7);return boxes.some(box=>[0,1,2].every(k=>k===axis?Math.min(Math.max(a[k],b[k]),box.hi[k])-Math.max(Math.min(a[k],b[k]),box.lo[k])>1e-7:a[k]>box.lo[k]+1e-7&&a[k]<box.hi[k]-1e-7))||segments.some(s=>segmentsConflict(a,b,s.a,s.b,false))};
const heap=[],push=v=>{heap.push(v);let i=heap.length-1;while(i){const p=(i-1)>>1;if(heap[p].f<=v.f)break;heap[i]=heap[p];i=p}heap[i]=v},pop=()=>{const first=heap[0],v=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1].f<heap[c].f)c++;if(heap[c].f>=v.f)break;heap[i]=heap[c];i=c}heap[i]=v}return first};
const initial=source*4+3,dist=new Map([[initial,0]]),prev=new Map(),edgeCache=new Map();push({state:initial,g:0,f:priorityWeight*heuristic(start)});let expanded=0;
while(heap.length&&expanded<maxExpanded){if((expanded&127)===0)root.FactoryCheckBudget?.();const entry=pop();if(entry.g!==dist.get(entry.state))continue;const id=Math.floor(entry.state/4),heading=entry.state%4,a=point(id);if(entry.g+heuristic(a)>=upperBound)continue;expanded++;if(id===target){const path=[];for(let k=entry.state;k!==undefined;k=prev.get(k))path.push(point(Math.floor(k/4)));return {path:path.reverse(),cost:entry.g,expanded,limited:false}}
const indices=decode(id),neighbors=[];for(const k of [0,2]){const candidates=new Set([0,axes[k].length-1,axes[k].indexOf(end[k]),...anchors.map(p=>axes[k].indexOf(p[k]))]);for(const direction of [-1,1]){let n=indices[k]+direction;while(n>=0&&n<axes[k].length&&Math.abs(axes[k][n]-a[k])<.5-1e-7)n+=direction;if(n>=0&&n<axes[k].length)candidates.add(n)}for(const n of candidates){const length=Math.abs(axes[k][n]-a[k]);if(length<.5-1e-7||length>56+1e-7)continue;const q=[...indices];q[k]=n;neighbors.push({id:encode(...q),heading:k})}}
for(let y=0;y<ny;y++){const delta=Math.abs(ys[y]-a[1]);if(delta>=minVertical-1e-7&&delta<=48+1e-7)neighbors.push({id:encode(indices[0],y,indices[2]),heading:1})}
for(const n of neighbors){const b=point(n.id),key=Math.min(id,n.id)+':'+Math.max(id,n.id);let value=edgeCache.get(key);if(value===undefined){value=blocked(a,b)?Infinity:edgeCost(a,b);edgeCache.set(key,value)}if(!Number.isFinite(value))continue;const g=entry.g+value+(heading!==3&&heading!==n.heading?.8:0),state=n.id*4+n.heading,f=g+priorityWeight*heuristic(b);if(g+heuristic(b)>=upperBound||g>=(dist.get(state)??Infinity))continue;dist.set(state,g);prev.set(state,entry.state);push({state,g,f})}}
return {path:null,cost:Infinity,expanded,limited:expanded>=maxExpanded};
}
function pack(machines,rate,capacity,separateFloors=false){const lanes=[];for(const m of machines){const amount=typeof rate==='function'?rate(m):rate;let lane=lanes.find(l=>l.rate+amount<=capacity+1e-7&&l.supplyTo===m.supplyTo&&(!separateFloors||l.floor===m.floor));if(!lane){lane={rate:0,machines:[],floor:m.floor,...(m.supplyTo?{supplyTo:m.supplyTo}:{})};lanes.push(lane)}lane.rate+=amount;lane.machines.push(m.id)}return lanes}
// Assign all branches together; choosing a port by branch index can consume
// the nearest inlet before a later source is considered. Include approach
// directions so the estimate penalizes going around the junction body.
function assignJunctionPorts(anchors,ports){
 const permutations=[[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];
 const cost=order=>anchors.reduce((sum,a,i)=>{const b=ports[order[i]],A=a.point.map((v,k)=>v+a.dir[k]*2),B=b.point.map((v,k)=>v+b.dir[k]*2);return sum+4+A.reduce((s,v,k)=>s+Math.abs(v-B[k]),0)},0);
 return permutations.sort((a,b)=>cost(a)-cost(b))[0].slice(0,anchors.length);
}
function optimizeGraph3D(p,graph){
root.FactoryProgress?.({stage:'optimization',message:'Сокращаем трассы в 3D и проверяем пересечения'});
// Reverse exports during optimization so both boundary directions use the
// same wall search and collision checks. Restore their production direction.
const exports=graph.edges.filter(e=>e.to.kind==='export');
for(const e of exports){[e.from,e.to]=[e.to,e.from];[e.fromLead,e.toLead]=[e.toLead,e.fromLead];e.from.kind='import';e.points=[...e.points].reverse()}
const stats={searchedRoutes:0,improvedRoutes:0,expanded:0,limitedRoutes:0},axis=(a,b)=>a.findIndex((v,k)=>Math.abs(v-b[k])>1e-7),segments=e=>e.points.slice(1).map((b,i)=>({a:e.points[i],b}));
const equipmentBoxes=[...p.machines.map(m=>({lo:[m.x-.8,floorBase(p,m.floor)-.5,m.z-.8],hi:[m.x+m.w+.8,floorBase(p,m.floor)+m.h+.6,m.z+m.d+.8]})),...graph.nodes.map(n=>({lo:[n.point[0]-2.8,n.point[1]-.9,n.point[2]-2.8],hi:[n.point[0]+2.8,n.point[1]+2.6,n.point[2]+2.8]}))];
const tidy=path=>{const out=[];for(const v of path){if(out.length&&v.every((n,k)=>Math.abs(n-out.at(-1)[k])<1e-7))continue;while(out.length>1&&axis(out.at(-2),out.at(-1))===axis(out.at(-1),v)&&out.at(-1).every((n,k)=>(n-out.at(-2)[k])*(v[k]-n)>=0))out.pop();out.push(v)}return out};
const length=path=>path.slice(1).reduce((s,b,i)=>s+Math.hypot(...b.map((v,k)=>v-path[i][k])),0);
// Rip up one complete route at a time. Every other belt remains an obstacle,
// so a local improvement cannot take space required by a later connection.
const order=[...graph.edges].sort((a,b)=>length(b.points)-length(a.points));
for(const e of order){const minLift=fluid(e.item)?.5:rules.minLift;root.FactoryCheckBudget?.();const boxes=[...equipmentBoxes,...graph.edges.flatMap(v=>[v.from,v.to]).filter(ep=>ep.kind&&ep!==e.from&&ep!==e.to).map(terminalBox)];const oldLength=length(e.points),minimumLength=e.from.point.reduce((sum,v,k)=>sum+Math.abs(v-e.to.point[k]),0);const occupied=graph.edges.filter(v=>v!==e).flatMap(segments),cells=new Set();for(const s of occupied){if(axis(s.a,s.b)===1)continue;const n=Math.max(1,Math.ceil(Math.hypot(s.a[0]-s.b[0],s.a[2]-s.b[2])/2));for(let i=0;i<n;i++){const t=(i+.5)/n;cells.add(Math.floor((s.a[0]+(s.b[0]-s.a[0])*t)/2)+':'+Math.floor((s.a[2]+(s.b[2]-s.a[2])*t)/2))}}
const needsRepair=e.points.slice(1).some((b,i)=>occupied.some(s=>segmentsConflict(e.points[i],b,s.a,s.b,false))||boxes.some(box=>{const contains=v=>v.every((n,k)=>n>=box.lo[k]&&n<=box.hi[k]);if(i===0&&contains(e.from.point)||i===e.points.length-2&&contains(e.to.point))return false;return segmentBox(e.points[i],b,box)}));
const junction=graph.nodes.find(n=>n.type==='merger'&&n.ports.inputs.includes(e.to)||n.type==='splitter'&&n.ports.outputs.includes(e.from));
if(!junction&&!needsRepair&&e.from.kind!=='import'&&oldLength<=minimumLength+1e-7)continue;
const cost=(a,b)=>{const size=Math.hypot(...a.map((v,k)=>v-b[k]));if(axis(a,b)===1)return size*1.2+2;const n=Math.max(1,Math.ceil(size/2));let value=0;for(let i=0;i<n;i++){const t=(i+.5)/n,x=a[0]+(b[0]-a[0])*t,z=a[2]+(b[2]-a[2])*t;value+=size/n*(cells.has(Math.floor(x/2)+':'+Math.floor(z/2))?1:overhead(p,a[1])?1.002:1.01)}return value};
const score=path=>path.slice(1).reduce((s,b,i)=>s+cost(path[i],b),0)+Math.max(0,path.length-2)*.8;
const lead=2+graph.products.indexOf(e.item)*.01,A=e.from.point.map((v,k)=>v+e.from.dir[k]*(e.fromLead??lead)),B=e.to.point.map((v,k)=>v+e.to.dir[k]*(e.toLead??lead)),old=score(e.points);
// Cheap height-aware shortcuts run for EVERY route, independently of A*'s
// shared expansion budget. Ports on different heights are equally eligible.
const levels=[...new Set([A[1],B[1],Math.max(A[1],B[1])+minLift,Math.min(A[1],B[1])-minLift,
 ...occupied.filter(s=>axis(s.a,s.b)!==1).flatMap(s=>[s.a[1]-1.5,s.a[1]+1.5]),
 ...boxes.map(box=>box.hi[1]+.1)].map(y=>Math.round(y*1e6)/1e6))]
 .filter(y=>y>=.8&&y<=p.bounds.height-.8&&[A[1],B[1]].every(v=>Math.abs(y-v)<1e-7||Math.abs(y-v)>=minLift-1e-7&&Math.abs(y-v)<=rules.maxLift+1e-7));
const candidates=[];
// Test side corridors analytically as well as L turns. A straight L can be
// blocked by a machine even when a short route around its side is available.
// Include lower belt planes: raising above an obstacle is not the only option.
const corridors=k=>[...new Set([.8,[p.bounds.width,0,p.bounds.length][k]-.8,
 ...boxes.flatMap(box=>[box.lo[k]-.1,box.hi[k]+.1]),
 ...occupied.flatMap(s=>[s.a[k]-1.5,s.a[k]+1.5,s.b[k]-1.5,s.b[k]+1.5])])]
 .filter(v=>v>=.8&&v<=[p.bounds.width,0,p.bounds.length][k]-.8);
const sideX=corridors(0),sideZ=corridors(2);
for(const [fromExtra,toExtra] of [[0,0],[0,4],[4,0],[4,4],...(needsRepair?[[1.3-(e.fromLead??lead),0],[0,1.3-(e.toLead??lead)],[1.3-(e.fromLead??lead),1.3-(e.toLead??lead)]]:[])]){
 const C=A.map((v,k)=>v+e.from.dir[k]*fromExtra),D=B.map((v,k)=>v+e.to.dir[k]*toExtra);
 if([C,D].some(v=>v[0]<.8||v[0]>p.bounds.width-.8||v[2]<.8||v[2]>p.bounds.length-.8))continue;
 for(const height of levels){const U=[C[0],height,C[2]],V=[D[0],height,D[2]];
 for(const path of [[C,U,[V[0],height,U[2]],V,D],[C,U,[U[0],height,V[2]],V,D]])candidates.push(tidy([e.from.point,...path,e.to.point]));
 for(const x of sideX)candidates.push(tidy([e.from.point,C,U,[x,height,U[2]],[x,height,V[2]],V,D,e.to.point]));
 for(const z of sideZ)candidates.push(tidy([e.from.point,C,U,[U[0],height,z],[V[0],height,z],V,D,e.to.point]));
 }
}
const validShortcut=(path,source=e.from.point,sourceDir=e.from.dir,target=e.to)=>{
 const forward=(a,b,dir)=>dir.every(n=>n===0)||b.reduce((sum,v,k)=>sum+(v-a[k])*dir[k],0)>1e-7;
 if(!forward(source,path[1],sourceDir)||!forward(target.point,path.at(-2),target.dir))return false;
 for(let i=1;i<path.length;i++){
  const a=path[i-1],b=path[i],k=axis(a,b),size=Math.abs(a[k]-b[k]);
  if(k<0||k===1&&(size<minLift-1e-7||size>rules.maxLift+1e-7)||k!==1&&(size<rules.minSegment-1e-7||size>rules.maxSegment+1e-7))return false;
  if(occupied.some(s=>segmentsConflict(a,b,s.a,s.b,false)))return false;
  if(!fluid(e.item)&&k===1&&occupied.some(s=>axis(s.a,s.b)===1&&Math.max(Math.min(a[1],b[1]),Math.min(s.a[1],s.b[1]))<Math.min(Math.max(a[1],b[1]),Math.max(s.a[1],s.b[1]))-1e-7&&Math.hypot(a[0]-s.a[0],a[2]-s.a[2])<(p.config?.liftClearance??4)-1e-7))return false;
  if(boxes.some(box=>{const contains=v=>v.every((value,j)=>value>=box.lo[j]&&value<=box.hi[j]);if(i===1&&contains(source)||i===path.length-1&&contains(target.point))return false;return [0,1,2].every(j=>j===k?Math.min(Math.max(a[j],b[j]),box.hi[j])-Math.max(Math.min(a[j],b[j]),box.lo[j])>1e-7:a[j]>box.lo[j]+1e-7&&a[j]<box.hi[j]-1e-7)}))return false;
  for(let j=i+1;j<path.length;j++)if(segmentsConflict(a,b,path[j-1],path[j]))return false;
 }
 return true;
};
// After routing, reconsider unused equivalent ports using actual free space.
// Only commit a shorter collision-free route; keep the old connection otherwise.
if(junction){const side=junction.type==='merger'?'to':'from',ports=junction.type==='merger'?junction.ports.inputs:junction.ports.outputs,options=[];
 for(const port of ports){if(port===e[side]||graph.edges.some(v=>v!==e&&v[side]===port))continue;
  const from=side==='from'?port:e.from,to=side==='to'?port:e.to,C=from.point.map((v,k)=>v+from.dir[k]*(e.fromLead??lead)),D=to.point.map((v,k)=>v+to.dir[k]*(e.toLead??lead));
  for(const h of levels){const U=[C[0],h,C[2]],V=[D[0],h,D[2]],paths=[[U,[V[0],h,U[2]],V],[U,[U[0],h,V[2]],V],...sideX.map(x=>[U,[x,h,U[2]],[x,h,V[2]],V]),...sideZ.map(z=>[U,[U[0],h,z],[V[0],h,z],V])];
   for(const middle of paths){const path=tidy([from.point,C,...middle,D,to.point]);if(length(path)<oldLength-1e-6&&score(path)<old-1e-6)options.push({port,from,to,path,value:score(path)})}
  }
 }
 for(const v of options.sort((a,b)=>a.value-b.value))if(validShortcut(v.path,v.from.point,v.from.dir,v.to)){e[side]=v.port;e.points=v.path;graph.routes[e.id]=v.path;stats.improvedRoutes++;stats.reassignedPorts=(stats.reassignedPorts??0)+1;break}
 if(length(e.points)<oldLength-1e-6)continue;
}
// Import terminals are movable design variables, not fixed obstacles. Try
// actual collision-checked routes from all walls, including exact alignment
// with the receiver approach and reachable points on the existing route.
if(e.from.kind==='import'){
 const targetFloor=floorAt(p,e.to.point[1]),ceiling=p.floors?.[targetFloor]?.ceiling??p.bounds.height,anchors=[{point:e.to.point,tail:[]},{point:B,tail:[e.to.point]},...e.points.slice(1,-1).map((point,i)=>({point,tail:e.points.slice(i+2)}))].filter(v=>floorAt(p,v.point[1])===targetFloor&&v.point[1]<=Math.min(ceiling-1.5,p.bounds.height-.8));
 const terminals=graph.edges.filter(v=>v!==e).flatMap(v=>[v.from,v.to]).filter(v=>v.kind),options=[];
 for(const anchor of anchors){const y=anchor.point[1],xs=new Set([e.to.point[0],B[0],anchor.point[0],...e.points.map(v=>v[0])]),zs=new Set([e.to.point[2],B[2],anchor.point[2],...e.points.map(v=>v[2])]);for(let t=4;t<p.bounds.width-3;t+=4)xs.add(t);for(let t=4;t<p.bounds.length-3;t+=4)zs.add(t);
  const ports=[3,2.1].flatMap(margin=>[...xs].flatMap(x=>[{point:[x,y,margin],dir:[0,0,1]},{point:[x,y,p.bounds.length-margin],dir:[0,0,-1]}]).concat([...zs].flatMap(z=>[{point:[margin,y,z],dir:[1,0,0]},{point:[p.bounds.width-margin,y,z],dir:[-1,0,0]}])));
  for(const port of ports){if(port.point[0]<2.1||port.point[0]>p.bounds.width-2.1||port.point[2]<2.1||port.point[2]>p.bounds.length-2.1||terminals.some(v=>Math.abs(v.point[1]-y)<2.2&&Math.hypot(v.point[0]-port.point[0],v.point[2]-port.point[2])<4))continue;
   const body=terminalBox(port);if(y<.7||y+1.45>p.bounds.height||occupied.some(s=>segmentBox(s.a,s.b,body)))continue;
   if(boxes.some(box=>port.point.every((value,k)=>value>box.lo[k]&&value<box.hi[k])))continue;
   const S=port.point.map((v,k)=>v+port.dir[k]*(e.fromLead??lead)),T=anchor.point;if(S[0]<.8||S[0]>p.bounds.width-.8||S[2]<.8||S[2]>p.bounds.length-.8)continue;
   // A straight connection needs no separate approach legs. Requiring both
   // leads creates hairpins when a junction is already close to the wall.
   const paths=[[S,[T[0],y,S[2]],T],[S,[S[0],y,T[2]],T]];
   if(port.point[0]===T[0]||port.point[2]===T[2])paths.push([T]);
   for(const path of paths){const full=tidy([port.point,...path,...anchor.tail]);if(full.length<2||length(full)>=oldLength-1e-6)continue;const value=score(full);if(value<old-1e-6)options.push({port,path:full,value})}
  }
 }
 for(const option of options.sort((a,b)=>a.value-b.value)){
  const forward=(a,b,dir)=>b.reduce((sum,v,k)=>sum+(v-a[k])*dir[k],0)>1e-7;
  if(!forward(option.port.point,option.path[1],option.port.dir)||!forward(e.to.point,option.path.at(-2),e.to.dir)||!validShortcut(option.path,option.port.point,option.port.dir))continue;
  Object.assign(e.from,option.port);e.points=option.path;graph.routes[e.id]=e.points;stats.improvedRoutes++;stats[exports.includes(e)?'movedExports':'movedImports']=(stats[exports.includes(e)?'movedExports':'movedImports']??0)+1;break;
 }
 if(length(e.points)<oldLength-1e-6)continue;
}
let shortcut=null;
const ranked=candidates.filter(path=>needsRepair||length(path)<oldLength-1e-6).map(path=>({path,value:score(path)})).filter(v=>needsRepair||v.value<old-1e-6).sort((a,b)=>a.value-b.value);
for(const {path} of ranked)if(validShortcut(path)){shortcut=path;break}
if(shortcut){e.points=shortcut;graph.routes[e.id]=shortcut;stats.improvedRoutes++;continue}
if(stats.expanded>=6000)continue;
const result=search3D({minVertical:minLift,start:A,end:B,bounds:p.bounds,boxes,segments:occupied,anchors:e.points,cost,upperBound:needsRepair?Infinity:old,priorityWeight:2.5,maxExpanded:Math.min(needsRepair?2000:800,6000-stats.expanded)});stats.searchedRoutes++;stats.expanded+=result.expanded;if(result.limited)stats.limitedRoutes++;
if(!result.path)continue;const full=tidy([e.from.point,...result.path,e.to.point]);if(!needsRepair&&(score(full)>=old-1e-6||length(full)>length(e.points)+1e-6))continue;if(!validShortcut(full))continue;e.points=full;graph.routes[e.id]=full;stats.improvedRoutes++;
}
for(const e of exports){e.from.kind='export';[e.from,e.to]=[e.to,e.from];[e.fromLead,e.toLead]=[e.toLead,e.fromLead];e.points=[...e.points].reverse();graph.routes[e.id]=e.points}
graph.searchStats=stats;if(stats.improvedRoutes)graph.routing='spatial';graph.liftPositions=[];graph.routingMetrics={horizontalLength:0,verticalLength:0};
for(const e of graph.edges)for(const {a,b} of segments(e)){graph.routingMetrics.horizontalLength+=Math.hypot(a[0]-b[0],a[2]-b[2]);graph.routingMetrics.verticalLength+=Math.abs(a[1]-b[1]);if(axis(a,b)===1)graph.liftPositions.push({x:a[0],z:a[2],minY:Math.min(a[1],b[1]),maxY:Math.max(a[1],b[1]),item:e.item})}graph.lifts=graph.liftPositions.length;return graph;
}
function rotateDirection(v,rotation=0){const r=((rotation%360)+360)%360,[x,y,z]=v;return r===90?[-z,y,x]:r===180?[-x,y,-z]:r===270?[z,y,-x]:[x,y,z]}
function localDimensions(m){return (m.rotation??0)%180?{w:m.d,d:m.w}:{w:m.w,d:m.d}}
function machinePoint(m,v){const {w,d}=localDimensions(m),r=((m.rotation??0)%360+360)%360,[u,y,t]=v;return r===90?[m.x+d-t,y,m.z+u]:r===180?[m.x+w-u,y,m.z+d-t]:r===270?[m.x+t,y,m.z+w-u]:[m.x+u,y,m.z+t]}
const fluid=id=>!!root.FactoryRecipeCatalog?.items[id]?.fluid;
const outputRates=(r,id)=>r.outs??{[id]:r.out};
const transportCapacity=(p,item)=>fluid(item)?(p.config.pipeCapacity??300):p.config.belt;
function machinePorts(p,m,recipes){const keys=Object.keys(recipes[m.group].ins),y=floorBase(p,m.floor)+1.2,{w,d}=localDimensions(m),rotation=m.rotation??0;const outputs=Object.entries(outputRates(recipes[m.group],m.group)).map(([item,n],i,arr)=>({item,kind:fluid(item)?'pipe':'belt',point:machinePoint(m,[w*(i+1)/(arr.length+1),y,d]),dir:rotateDirection([0,0,1],rotation),rate:n*m.clock}));return {inputs:keys.map((item,i)=>({item,kind:fluid(item)?'pipe':'belt',point:machinePoint(m,[w*(i+1)/(keys.length+1),y,0]),dir:rotateDirection([0,0,-1],rotation),rate:recipes[m.group].ins[item]*m.clock})),outputs,output:outputs.find(v=>v.item===m.group)??outputs[0]}}
function checkFlows(p,recipes){
const edges=p.logistics.edges,key=v=>v.point.map(n=>Math.round(n*1e6)/1e6).join(':'),sources=new Map(),sinks=new Map(),near=(a,b)=>Math.abs(a-b)<=1e-6*Math.max(1,a,b),fail=message=>{const e=Error('Ошибка входов/выходов: '+message);e.code='flow-invalid';throw e};
function add(map,port,item,rate){const k=key(port);if(map.has(k))fail('порты совпадают');map.set(k,{port,item,rate})}
for(const m of p.machines){const ports=machinePorts(p,m,recipes);for(const port of ports.inputs)add(sinks,port,port.item,port.rate);for(const port of ports.outputs)add(sources,port,port.item,port.rate)}
for(const n of p.logistics.nodes){for(const port of n.type==='splitter'?[n.ports.input]:n.ports.inputs)add(sinks,port,n.item,null);for(const port of n.type==='splitter'?n.ports.outputs:[n.ports.output])add(sources,port,n.item,null)}
for(const e of edges){if(!Number.isFinite(e.rate)||e.rate<=0||e.rate>transportCapacity(p,e.item)+1e-6)fail('перегружена лента #'+(e.id+1));if(e.points.length<2||key({point:e.points[0]})!==key(e.from)||key({point:e.points.at(-1)})!==key(e.to))fail('лента не доведена до порта');for(const [ep,next] of [[e.from,e.points[1]],[e.to,e.points.at(-2)]])if(next.reduce((s,v,k)=>s+(v-ep.point[k])*ep.dir[k],0)<=1e-7)fail('лента подходит к порту с неверной стороны');for(const [ep,map,kind] of [[e.from,sources,'import'],[e.to,sinks,'export']]){if(ep.kind){if(ep.kind!==kind)fail('неверное направление внешнего порта');continue}const port=map.get(key(ep));if(!port||port.item!==e.item||!ep.dir.every((n,k)=>n===port.port.dir[k]))fail('неверный предмет или порт ленты #'+(e.id+1))}}
for(const [map,side] of [[sources,'from'],[sinks,'to']])for(const [k,port] of map){const connected=edges.filter(e=>!e[side].kind&&key(e[side])===k);if(connected.length>1)fail('несколько лент подключены к одному порту');if(port.rate!==null&&(connected.length!==1||!near(connected[0].rate,port.rate)))fail('поток станка не соответствует рецепту')}
for(const n of p.logistics.nodes){const input=n.type==='splitter'?[n.ports.input]:n.ports.inputs,output=n.type==='splitter'?n.ports.outputs:[n.ports.output],sum=(ports,side)=>edges.filter(e=>!e[side].kind&&ports.some(port=>key(port)===key(e[side]))).reduce((s,e)=>s+e.rate,0);if(!near(sum(input,'to'),sum(output,'from')))fail('нарушен баланс узла #'+(n.id+1))}
const imports={},exports={};for(const e of edges){if(e.from.kind==='import')imports[e.item]=(imports[e.item]||0)+e.rate;if(e.to.kind==='export')exports[e.item]=(exports[e.item]||0)+e.rate}
for(const item of new Set([...Object.keys(imports),...Object.keys(p.imports)]))if(!near(imports[item]||0,p.imports[item]||0))fail('неверная внешняя поставка '+item);
const expectedExports=p.exports??{[p.config.product]:p.config.rate};for(const item of new Set([...Object.keys(exports),...Object.keys(expectedExports)]))if(!near(exports[item]||0,expectedExports[item]||0))fail('неверный конечный выпуск');
// Boundary flows are the net recipe balance, not the sum of the old modules'
// terminals. An internally available ingredient must stay inside the module.
const produced={},consumed={};for(const m of p.machines){const r=recipes[m.group];for(const [item,n] of Object.entries(outputRates(r,m.group)))produced[item]=(produced[item]??0)+n*m.clock;for(const [item,rate] of Object.entries(r.ins))consumed[item]=(consumed[item]??0)+rate*m.clock}
const internalSupply={};for(const item of new Set([...Object.keys(produced),...Object.keys(consumed),...Object.keys(imports),...Object.keys(exports)])){const supply=produced[item]??0,demand=consumed[item]??0;const external=(p.config.externalFeedbackItems??[]).includes(item);internalSupply[item]=external?0:Math.min(supply,demand);if(!near(imports[item]??0,external?demand:Math.max(0,demand-supply))||!near(exports[item]??0,external?supply:Math.max(0,supply-demand)))fail('внутренний поток '+item+' ошибочно выведен за границы модуля')}
const splitterDistribution=p.logistics.nodes.filter(n=>n.type==='splitter').map(n=>{const branches=edges.filter(e=>n.ports.outputs.some(port=>key(port)===key(e.from))),total=branches.reduce((s,e)=>s+e.rate,0),startup=splitterRates(total,branches.map(()=>transportCapacity(p,n.item)));return {id:n.id,item:n.item,inputRate:total,requiresBackpressure:branches.some((e,i)=>!near(e.rate,startup[i])),branches:branches.map((e,i)=>({edgeId:e.id,startupRate:startup[i],steadyRate:e.rate}))}});
return {valid:true,machineInputs:p.machines.reduce((s,m)=>s+Object.keys(recipes[m.group].ins).length,0),machineOutputs:p.machines.reduce((s,m)=>s+Object.keys(outputRates(recipes[m.group],m.group)).length,0),externalInputs:edges.filter(e=>e.from.kind==='import').length,externalOutputs:edges.filter(e=>e.to.kind==='export').length,imports,exports,internalSupply,splitterDistribution};
}
// Round-robin splitting amongst unblocked outputs, with redistribution when
// a slower output fills. Unequal steady demands require downstream buffers.
function splitterRates(input,capacities){
 const rates=capacities.map(()=>0);let remaining=input,open=capacities.map((_,i)=>i);
 while(open.length&&remaining>1e-7){const share=remaining/open.length,limited=open.filter(i=>capacities[i]-rates[i]<=share);if(!limited.length){for(const i of open)rates[i]+=share;break}for(const i of limited){remaining-=capacities[i]-rates[i];rates[i]=capacities[i]}open=open.filter(i=>!limited.includes(i))}return rates;
}
// Heuristic construction effort, not an in-game materials bill. Keep module
// count lexicographic: saving a few belts must never add another factory.
function constructionCost(plans){
 const total={modules:plans.length,machines:0,splitters:0,mergers:0,lifts:0,horizontalLength:0,verticalLength:0};
 for(const p of plans){const l=p.logistics;total.machines+=p.machines.length;total.splitters+=l.nodes.filter(n=>n.type==='splitter').length;total.mergers+=l.nodes.filter(n=>n.type==='merger').length;total.lifts+=l.lifts??0;total.horizontalLength+=l.routingMetrics?.horizontalLength??0;total.verticalLength+=l.routingMetrics?.verticalLength??0}
 total.score=total.horizontalLength+1.2*total.verticalLength+8*(total.splitters+total.mergers)+6*total.lifts+16*total.machines;return total;
}
function distributionPenalty(plans){return plans.reduce((sum,p)=>sum+(p.logistics.flowCheck?.splitterDistribution??[]).reduce((n,s)=>n+s.branches.reduce((v,b)=>v+Math.max(0,b.steadyRate-b.startupRate)/s.inputRate,0),0),0)}
function compareConstruction(a,b){const x=constructionCost(a),y=constructionCost(b);return x.modules-y.modules||distributionPenalty(a)-distributionPenalty(b)||x.score-y.score||x.machines-y.machines}
function calculate(p,recipes){if(!p.floors)assignFloors(p);const capacity=p.config.belt,manifolds=[],issues=[],transfers=[],clearance=p.config.liftClearance??4;
root.FactoryProgress?.({stage:'routing',message:'Собираем сплиттеры, мерджеры и прокладываем конвейеры'});
for(const g of p.groups){const inputs={};for(const [item,n] of Object.entries(recipes[g.id].ins))inputs[item]=pack(g.machines,m=>n*m.clock,transportCapacity(p,item),!!p.bounds);manifolds.push({id:g.id,floor:g.floor,inputs,outputs:[]})}
for(const item of new Set(p.machines.flatMap(m=>Object.keys(outputRates(recipes[m.group],m.group))))){let manifold=manifolds.find(g=>g.id===item);if(!manifold){manifold={id:item,floor:0,inputs:{},outputs:[]};manifolds.push(manifold)}const machines=p.machines.filter(m=>outputRates(recipes[m.group],m.group)[item]);manifold.outputs=pack(machines,m=>outputRates(recipes[m.group],m.group)[item]*m.clock,transportCapacity(p,item),!!p.bounds)}
const sourceRemaining=new Map(manifolds.map(g=>[g.id,g.outputs.map(l=>l.rate)]));let laneIndex=0;
for(const c of p.connections){const target=manifolds.find(g=>g.id===c.to),source=(p.config.externalFeedbackItems??[]).includes(c.from)?null:manifolds.find(g=>g.id===c.from);for(const [dest,lane] of target.inputs[c.from].entries()){let remaining=lane.rate;const src=source?sourceRemaining.get(source.id):[remaining];for(let index=0;index<src.length&&remaining>1e-7;index++){if(source?.outputs[index].supplyTo&&source.outputs[index].supplyTo!==c.to+':'+(lane.supplyTo||'')+':'+dest)continue;const rate=Math.min(src[index],remaining);if(rate<1e-7)continue;src[index]-=rate;remaining-=rate;const sourceFloor=source?(source.outputs[index].floor??source.floor):null,targetFloor=lane.floor??target.floor;transfers.push({from:c.from,to:c.to,sourceLane:index,targetLane:dest,rate,external:!source,lift:!!source&&sourceFloor!==targetFloor,liftPosition:{x:p.width+8,z:p.length+8+laneIndex*clearance},height:source?Math.abs(floorBase(p,sourceFloor)-floorBase(p,targetFloor)):0});laneIndex++}if(remaining>1e-6&&source&&(p.imports[c.from]??0)>0){transfers.push({from:c.from,to:c.to,sourceLane:0,targetLane:dest,rate:remaining,external:true,lift:false,height:0});remaining=0}if(remaining>1e-6)issues.push({code:'missing-supply',message:`Недостаточно подачи ${c.from} → ${c.to}`})}}
let graph;if(p.bounds){for(const [mode,optimized,reserve,receiverPlacement,stackNodes] of [['stacked',true,false,true,true],['reserved',true,true,true,true],['fallback',false,false,true,true],['flat',true,false,true,false],['flat-fallback',false,false,true,false],['legacy',false,false,false,false]]){try{graph=buildGraph(p,recipes,manifolds,transfers,clearance,optimized,reserve,receiverPlacement,stackNodes);graph=optimizeGraph3D(p,graph);if(!checkBeltCollisions(graph).valid||!checkEquipmentCollisions(p,graph).valid){const err=Error('Не удалось развести конвейеры без пересечений.');err.code='volume-fit';throw err}break}catch(e){if(mode==='legacy'||(e.code!=='volume-fit'&&!/развести конвейеры|разместить узлы|подход к порту/.test(e.message)))throw e}}}else graph=buildGraph(p,recipes,manifolds,transfers,clearance,false);
const result={rules,manifolds,transfers,...graph,clearance,issues,strategy:'manifold'};result.collisionCheck=checkBeltCollisions(result);result.equipmentCheck=checkEquipmentCollisions(p,result);if(p.bounds&&(!result.collisionCheck.valid||!result.equipmentCheck.valid)){const err=Error('Не удалось развести конвейеры без пересечений.');err.code='volume-fit';throw err}for(const e of result.edges){e.kind=fluid(e.item)?'pipe':'belt';e.capacity=transportCapacity(p,e.item);if(e.kind==='pipe'){e.crossSection=1;const length=e.points.slice(1).reduce((s,b,i)=>s+Math.hypot(...b.map((v,k)=>v-e.points[i][k])),0);e.volume=length*e.crossSection;e.segments=e.points.slice(1).flatMap((b,i)=>{const a=e.points[i],length=Math.hypot(...b.map((v,k)=>v-a[k])),count=Math.max(1,Math.ceil(length/56));return Array.from({length:count},(_,j)=>({from:a.map((v,k)=>v+(b[k]-v)*j/count),to:a.map((v,k)=>v+(b[k]-v)*(j+1)/count),volume:length/count*e.crossSection}))});e.pumps=[];const gas=/nitrogenGas|excitedPhotonicMatter|darkMatterResidue/.test(e.item);let head=e.from.point[1]+10;for(let i=1;i<e.points.length;i++){const a=e.points[i-1],b=e.points[i];if(!gas&&b[1]>head){const count=Math.ceil((b[1]-head)/20);for(let j=0;j<count;j++){const Y=head;e.pumps.push({point:[a[0],Y,a[2]],headLift:20,power:4});head=Y+20}}}}}
for(const n of result.nodes)if(fluid(n.item)){n.transport='pipe';n.name='Трубопроводная развязка'}
result.pumpPower=result.edges.reduce((sum,e)=>sum+(e.pumps??[]).reduce((n,pump)=>n+pump.power,0),0);
p.power=p.machines.reduce((sum,m)=>sum+(recipes[m.group].power??root.FactoryPlanner.buildings[m.b].power)*Math.pow(m.clock,1.321928),0)+result.pumpPower;
result.flowCheck=checkFlows({...p,logistics:result},recipes);return result;
}
function buildGraph(p,recipes,manifolds,transfers,clearance,optimized=false,reserve=false,receiverPlacement=true,stackNodes=true){
const nodes=[],edges=[],products=[...new Set([...Object.keys(p.imports),...manifolds.filter(g=>g.outputs.length).map(g=>g.id)])];
const palette=['#63d9c3','#efb86d','#879ff0','#f181b5','#b6d865','#ba95ef','#65cafa','#ef8c61','#cbd3e0','#dfcf75','#81c39d','#ce8ad4','#85a9a0','#dcafc0','#9db477','#9ea4cf','#d6a67e','#80bfbf','#bba1a1','#b4b6dc'];
const colors=Object.fromEntries(products.map((id,i)=>[id,palette[i%palette.length]]));
const endpoint=(point,dir)=>({point,dir});
function machinePort(id,item,output=false){const ports=machinePorts(p,p.machines[id],recipes),port=output?ports.outputs.find(v=>v.item===item):ports.inputs.find(v=>v.item===item);return {...endpoint(port.point,port.dir),rate:port.rate}}
function node(type,item,floor,anchors=[],nearSources=false){
const machineMargin=p.config.allowRotations?3.6:5,machines=p.machines.filter(m=>m.floor===floor),points=anchors.map(a=>a.point),nearZ=points.length?points.reduce((sum,v)=>sum+v[2],0)/points.length:8;
const side=type==='splitter'?-1:1,nearX=side<0?Math.min(...machines.map(m=>m.x))-8:Math.max(...machines.map(m=>m.x+m.w))+8;
const locationCost=([x,z])=>type==='splitter'&&receiverPlacement&&(!recipes[item]||(p.config.external||[]).includes(item))&&points.length?points.reduce((sum,v)=>sum+Math.abs(x-v[0])+Math.abs(z-v[2]),0)+Math.min(x,z,p.width-x,p.length-z):nearSources?points.reduce((sum,v)=>sum+Math.abs(x-v[0])+Math.abs(z-v[2]),0)+.25*Math.max(...points.map(v=>Math.abs(x-v[0])+Math.abs(z-v[2]))):Math.abs(x-nearX)+Math.abs(z-nearZ);
const baseY=floorBase(p,floor)+5.2;
let location;if(p.bounds){
 const candidates=[];for(let x=6;x<=p.width-6;x+=4)for(let z=6;z<=p.length-6;z+=4)candidates.push([x,z,baseY]);
 if(stackNodes)for(const n of nodes.filter(n=>n.floor===floor))candidates.push([n.point[0],n.point[2],n.point[1]+rules.nodeHeight]);
 const ceiling=Math.min(p.bounds.height,p.floors?.[floor]?.ceiling??p.bounds.height);
 const verticalCost=Y=>points.reduce((sum,v)=>sum+Math.abs(Y-v[1]),0);
 location=candidates.filter(([x,z,Y])=>Y+2.3<=ceiling+1e-7&&!machines.some(m=>x>m.x-machineMargin&&x<m.x+m.w+machineMargin&&z>m.z-machineMargin&&z<m.z+m.d+machineMargin)&&!nodes.some(n=>n.floor===floor&&Math.abs(Y-n.point[1])<rules.nodeHeight-1e-7&&Math.abs(x-n.point[0])<(p.config.junctionSpacing??12)&&Math.abs(z-n.point[2])<(p.config.junctionSpacing??12))).sort((a,b)=>locationCost(a)-locationCost(b)+verticalCost(a[2])-verticalCost(b[2]))[0];
 if(!location){const err=Error('Не удалось разместить узлы внутри границ.');err.code='volume-fit';throw err}
}
for(let ring=0;!location;ring++){const candidates=[];for(let dx=0;dx<=ring;dx++)for(let dz=-ring;dz<=ring;dz++)candidates.push([nearX+side*dx*16,nearZ+dz*16]);const free=candidates.filter(([x,z])=>!nodes.some(n=>n.floor===floor&&Math.abs(x-n.point[0])<16&&Math.abs(z-n.point[2])<16));location=free.sort((a,b)=>Math.abs(a[0]-nearX)+Math.abs(a[1]-nearZ)-Math.abs(b[0]-nearX)-Math.abs(b[1]-nearZ))[0]}
const [x,z,Y]=location,y=Y??baseY,n={id:nodes.length,type,item,floor,point:[x,y,z],ports:{}};
if(type==='splitter'){n.ports.input=endpoint([x,y,z-2],[0,0,-1]);n.ports.outputs=[endpoint([x+2,y,z],[1,0,0]),endpoint([x,y,z+2],[0,0,1]),endpoint([x-2,y,z],[-1,0,0])]}else{n.ports.inputs=[endpoint([x-2,y,z],[-1,0,0]),endpoint([x,y,z-2],[0,0,-1]),endpoint([x+2,y,z],[1,0,0])];n.ports.output=endpoint([x,y,z+2],[0,0,1])}
const rotatePort=(port,r)=>{const delta=rotateDirection(port.point.map((v,k)=>v-n.point[k]),r);return endpoint(delta.map((v,k)=>v+n.point[k]),rotateDirection(port.dir,r))};
n.rotation=0;
if(p.config.allowRotations&&points.length){const ports=type==='splitter'?n.ports.outputs:n.ports.inputs,perms=[[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]],cost=r=>Math.min(...perms.map(order=>points.reduce((sum,v,i)=>sum+v.reduce((s,value,k)=>s+Math.abs(value-rotatePort(ports[order[i%3]],r).point[k]),0),0)));n.rotation=[0,90,180,270].sort((a,b)=>cost(a)-cost(b))[0];
 for(const key of Object.keys(n.ports))n.ports[key]=Array.isArray(n.ports[key])?n.ports[key].map(port=>rotatePort(port,n.rotation)):rotatePort(n.ports[key],n.rotation);
}
nodes.push(n);return n}
function edge(from,to,item,rate){if(rate<=1e-7)return;edges.push({id:edges.length,from,to,item,rate,color:colors[item]})}
function distribute(targets,item,floor){
 if(targets.length===1)return targets[0].port;
 const n=node('splitter',item,floor,targets.map(t=>t.port));
 // Group by demand, rather than feeding two machines and a hungry tail.
 // Four equal consumers use 2×2; six use 3×2. Equal trunks need no
 // accumulation in the first machines before the remaining ones receive supply.
 let groups;
 if(targets.length<=3)groups=targets.map(t=>[t]);
 else if(p.config._compactSupply)groups=[[targets[0]],[targets[1]],targets.slice(2)];
 else {const choices=[2,3].map(count=>{const buckets=Array.from({length:count},()=>({rate:0,targets:[]}));for(const t of [...targets].sort((a,b)=>b.rate-a.rate)){const b=buckets.reduce((best,b)=>b.rate<best.rate?b:best);b.targets.push(t);b.rate+=t.rate}const average=buckets.reduce((s,b)=>s+b.rate,0)/count;return {buckets,error:buckets.reduce((s,b)=>s+Math.abs(b.rate-average),0)}}).sort((a,b)=>a.error-b.error||a.buckets.length-b.buckets.length);groups=choices[0].buckets.map(b=>b.targets)}
 const branches=groups.map(g=>g.length===1?g[0]:{port:distribute(g,item,floor),rate:g.reduce((sum,t)=>sum+t.rate,0)});
 const permutations=[[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];
 const score=ports=>branches.reduce((sum,t,i)=>sum+t.port.point.reduce((dist,v,k)=>dist+Math.abs(v-n.ports.outputs[ports[i]].point[k]),0),0);
 const ports=receiverPlacement&&(!recipes[item]||(p.config.external||[]).includes(item))?permutations.sort((a,b)=>score(a)-score(b))[0]:[0,1,2];
 branches.forEach((t,i)=>edge(n.ports.outputs[ports[i]],t.port,item,t.rate));
 return n.ports.input;
}
function collect(sources,item,floor){let acc=sources[0];for(let i=1;i<sources.length;i+=2){const chunk=[acc,...sources.slice(i,i+2)],n=node('merger',item,floor,chunk.map(t=>t.port),true);chunk.forEach((s,j)=>edge(s.port,n.ports.inputs[j],item,s.rate));acc={port:n.ports.output,rate:chunk.reduce((sum,s)=>sum+s.rate,0)}}return acc.port}
const inlets=new Map(),outlets=new Map();
for(const g of manifolds){const group=p.groups.find(v=>v.id===g.id);for(const [item,lanes] of Object.entries(g.inputs))lanes.forEach((lane,i)=>{inlets.set([g.id,item,i].join(':'),distribute(lane.machines.map(id=>({port:machinePort(id,item),rate:machinePort(id,item).rate})),item,lane.floor??g.floor))});g.outputs.forEach((lane,i)=>outlets.set([g.id,i].join(':'),collect(lane.machines.map(id=>({port:machinePort(id,g.id,true),rate:machinePort(id,g.id,true).rate})),g.id,lane.floor??group?.floor??0)))}
// Allocate actual merger inlet ports for transfers, then connect output forks.
for(const g of manifolds)for(const [item,lanes] of Object.entries(g.inputs))lanes.forEach((lane,i)=>{const incoming=transfers.filter(t=>t.to===g.id&&t.from===item&&t.targetLane===i),sink=inlets.get([g.id,item,i].join(':'));if(incoming.length===1){incoming[0].targetPort=sink;return}let acc=null,total=0;for(let j=1;j<incoming.length;j+=2){const n=node('merger',item,lane.floor??g.floor,[sink]);if(j===1){incoming[0].targetPort=n.ports.inputs[0];total=incoming[0].rate}else edge(acc,n.ports.inputs[0],item,total);incoming.slice(j,j+2).forEach((t,k)=>{t.targetPort=n.ports.inputs[k+1];total+=t.rate});acc=n.ports.output;}if(acc)edge(acc,sink,item,total)});
for(const g of manifolds)g.outputs.forEach((lane,i)=>{const out=outlets.get([g.id,i].join(':')),ts=transfers.filter(t=>!t.external&&t.from===g.id&&t.sourceLane===i),targets=ts.map(t=>({port:t.targetPort,rate:t.rate})),remaining=lane.rate-ts.reduce((sum,t)=>sum+t.rate,0);if(remaining>1e-6){const end=endpoint([out.point[0]+10,out.point[1],out.point[2]+8],[-1,0,0]);end.kind='export';targets.push({port:end,rate:remaining})}const fork=distribute(targets,g.id,lane.floor??g.floor);edge(out,fork,g.id,lane.rate)});
for(const t of transfers.filter(t=>t.external)){const dest=t.targetPort,source=endpoint([dest.point[0]-8,dest.point[1],dest.point[2]-8],[0,0,1]);source.kind='import';edge(source,dest,t.from,t.rate)}
if(receiverPlacement)for(const n of nodes){const side=n.type==='merger'?'to':'from',other=side==='to'?'from':'to',ports=n.type==='merger'?n.ports.inputs:n.ports.outputs,connected=edges.filter(e=>ports.includes(e[side])),order=assignJunctionPorts(connected.map(e=>e[other]),ports);connected.forEach((e,i)=>{e[side]=ports[order[i]]})}
// Lower tiers have longer port leads: upper-tier belts stop before the
// lower-tier lift shafts rather than crossing them on the same axis.
const portOwners=new Map();for(const n of nodes)for(const port of n.type==='splitter'?[n.ports.input,...n.ports.outputs]:[...n.ports.inputs,n.ports.output])portOwners.set(port,n);
function portLead(port,item){const base=2+products.indexOf(item)*.01,n=portOwners.get(port);if(!n){
 const candidates=p.machines.flatMap(m=>{const ports=machinePorts(p,m,recipes);return [...ports.inputs,...ports.outputs].filter(v=>v.item===item).map(v=>({...v,m}))});
 const own=candidates.find(v=>v.point.every((x,k)=>Math.abs(x-port.point[k])<1e-7));if(!own)return base;
 const direction=port.dir.findIndex(v=>v!==0),along=direction===0?2:0;
 const row=candidates.filter(v=>v.m.floor===own.m.floor&&v.dir.every((x,k)=>x===port.dir[k])&&Math.abs(v.point[direction]-port.point[direction])<1e-7).sort((a,b)=>a.point[along]-b.point[along]);
 const inputIndex=Math.max(0,machinePorts(p,own.m,recipes).inputs.findIndex(v=>v.point.every((x,k)=>Math.abs(x-port.point[k])<1e-7)));
 const distance=base+(row.indexOf(own)+inputIndex)*1.5,available=port.dir[direction]>0?[p.width,0,p.length][direction]-.8-port.point[direction]:port.point[direction]-.8;
 return Math.min(distance,Math.max(base,available));
} const top=Math.max(...nodes.filter(v=>v.floor===n.floor&&Math.abs(v.point[0]-n.point[0])<1e-7&&Math.abs(v.point[2]-n.point[2])<1e-7).map(v=>v.point[1]));return base+Math.round((top-n.point[1])/rules.nodeHeight)*clearance}
for(const e of edges){e.fromLead=portLead(e.from,e.item);e.toLead=portLead(e.to,e.item)}
if(p.bounds){const used=[];for(const e of edges)for(const ep of [e.from,e.to])if(ep.kind){const candidates=[];for(let t=8;t<=Math.max(p.width,p.length)-8;t+=4){if(t<=p.width-8)candidates.push({point:[t,ep.point[1],3],dir:[0,0,1]},{point:[t,ep.point[1],p.length-3],dir:[0,0,-1]});if(t<=p.length-8)candidates.push({point:[3,ep.point[1],t],dir:[1,0,0]},{point:[p.width-3,ep.point[1],t],dir:[-1,0,0]})}const target=ep.kind==='import'?e.to.point:e.from.point;for(const v of [{point:[target[0],ep.point[1],3],dir:[0,0,1]},{point:[target[0],ep.point[1],p.length-3],dir:[0,0,-1]},{point:[3,ep.point[1],target[2]],dir:[1,0,0]},{point:[p.width-3,ep.point[1],target[2]],dir:[-1,0,0]}])if(v.point[0]>=3&&v.point[0]<=p.width-3&&v.point[2]>=3&&v.point[2]<=p.length-3)candidates.push(v);if(ep.kind==='export'&&p.config.terminalMode!=='legacy')for(const v of [{point:[target[0],ep.point[1],2.1],dir:[0,0,1]},{point:[target[0],ep.point[1],p.length-2.1],dir:[0,0,-1]},{point:[2.1,ep.point[1],target[2]],dir:[1,0,0]},{point:[p.width-2.1,ep.point[1],target[2]],dir:[-1,0,0]}])candidates.push(v);const terminalCost=v=>{const dist=Math.abs(v.point[0]-target[0])+Math.abs(v.point[2]-target[2]),port=ep.kind==='export'?e.from:e.to,aligned=v.point.every((n,k)=>k===1||Math.abs(port.dir[k])>0||Math.abs(n-target[k])<1e-6)&&v.dir.every((n,k)=>n===-port.dir[k])&&v.point.some((n,k)=>(n-target[k])*port.dir[k]>0);return dist+(ep.kind==='export'&&!aligned?3:0)};const lead=2+products.indexOf(e.item)*.01,shafts=edges.flatMap(edge=>[edge.from,edge.to].filter(port=>!port.kind&&port!==e.from&&port!==e.to).map(port=>port.point.map((n,i)=>n+port.dir[i]*portLead(port,edge.item)))),candidate=candidates.filter(v=>!shafts.some(q=>Math.abs(v.point[0]+v.dir[0]*lead-q[0])<1.5&&Math.abs(v.point[2]+v.dir[2]*lead-q[2])<1.5)&&Math.abs(v.point[0]-target[0])+Math.abs(v.point[2]-target[2])>=(p.config.terminalMode==='legacy'?10:2*lead+.5)&&!used.some(u=>Math.abs(u[1]-v.point[1])<2&&Math.hypot(u[0]-v.point[0],u[2]-v.point[2])<4)).sort((a,b)=>terminalCost(a)-terminalCost(b))[0];if(!candidate){const err=Error('Не удалось разместить узлы входов и выходов.');err.code='volume-fit';throw err}Object.assign(ep,candidate);used.push(ep.point)}}
const liftPositions=[],routes=[],occupied=[],searchStats={searchedRoutes:0,improvedRoutes:0,expanded:0,limitedRoutes:0};
const approaches=edges.map(e=>[e.from,e.to].map((ep,j)=>ep.point.map((v,i)=>v+ep.dir[i]*(p.bounds?(j?e.toLead:e.fromLead):5+products.indexOf(e.item)*.01))));
if(p.bounds&&approaches.flat().some(v=>v[0]<.8||v[0]>p.width-.8||v[2]<.8||v[2]>p.length-.8)){const err=Error('Не помещается подход к порту.');err.code='volume-fit';throw err}
const same=(a,b)=>a.every((v,i)=>Math.abs(v-b[i])<1e-7);
const tidy=pts=>{const out=[];for(const v of pts){if(out.length&&same(v,out[out.length-1]))continue;while(out.length>1){const a=out[out.length-2],b=out[out.length-1],u=b.map((n,i)=>n-a[i]),w=v.map((n,i)=>n-b[i]);if(u.filter(n=>Math.abs(n)>1e-7).length===1&&w.filter(n=>Math.abs(n)>1e-7).length===1&&u.some((n,i)=>Math.abs(n)>1e-7&&Math.abs(w[i])>1e-7&&n*w[i]>0)){out.pop()}else break}out.push(v)}return out};
function blocked(a,b,rects){return rects.some(r=>Math.abs(a[0]-b[0])<1e-7?a[0]>r.x0&&a[0]<r.x1&&Math.max(Math.min(a[2],b[2]),r.z0)<Math.min(Math.max(a[2],b[2]),r.z1):a[2]>r.z0&&a[2]<r.z1&&Math.max(Math.min(a[0],b[0]),r.x0)<Math.min(Math.max(a[0],b[0]),r.x1))}
function searchPath(a,b,rects,costOf=null){
const xs=[...new Set([a[0],b[0],...rects.flatMap(r=>[r.x0-.1,r.x1+.1])])].filter(v=>!p.bounds||(v>=.8&&v<=p.width-.8)).sort((x,y)=>x-y),zs=[...new Set([a[2],b[2],...rects.flatMap(r=>[r.z0-.1,r.z1+.1])])].filter(v=>!p.bounds||(v>=.8&&v<=p.length-.8)).sort((x,y)=>x-y),N=zs.length,start=xs.indexOf(a[0])*N+zs.indexOf(a[2]),goal=xs.indexOf(b[0])*N+zs.indexOf(b[2]),dist=new Map([[start,0]]),prev=new Map(),closed=new Set(),queue=[start];
const point=id=>[xs[Math.floor(id/N)],a[1],zs[id%N]],score=id=>dist.get(id)+(costOf?.7:1)*(Math.abs(xs[Math.floor(id/N)]-b[0])+Math.abs(zs[id%N]-b[2]));let examined=0;
while(queue.length&&examined++<(p.bounds?3000:600)){let best=0;for(let j=1;j<queue.length;j++)if(score(queue[j])<score(queue[best]))best=j;const id=queue.splice(best,1)[0];if(closed.has(id))continue;if(id===goal){const path=[];for(let k=id;k!==undefined;k=prev.get(k))path.push(point(k));return [path.reverse()]}closed.add(id);const x=Math.floor(id/N),z=id%N;for(const [X,Z] of [[x-1,z],[x+1,z],[x,z-1],[x,z+1]]){if(X<0||X>=xs.length||Z<0||Z>=N)continue;const k=X*N+Z;if(closed.has(k))continue;const u=point(id),v=point(k);if(blocked(u,v,rects))continue;const cost=dist.get(id)+(costOf?costOf(u,v):Math.abs(u[0]-v[0])+Math.abs(u[2]-v[2]));if(cost<(dist.get(k)??Infinity)){dist.set(k,cost);prev.set(k,id);queue.push(k)}}}return []}
const corridorCells=new Set();
function segmentCost(a,b){const length=Math.hypot(...a.map((v,i)=>v-b[i]));if(Math.abs(a[1]-b[1])>1e-7)return reserve?length*.35:length*1.2+2;
let cost=0;const count=Math.max(1,Math.ceil(length/2));for(let k=0;k<count;k++){const t=(k+.5)/count,x=a[0]+(b[0]-a[0])*t,z=a[2]+(b[2]-a[2])*t,key=Math.floor(x/2)+':'+Math.floor(z/2),overEquipment=p.machines.some(m=>x>=m.x&&x<=m.x+m.w&&z>=m.z&&z<=m.z+m.d),aboveBuildHeight=overhead(p,a[1]);cost+=length/count*(reserve?(corridorCells.has(key)?.7:1+(overEquipment||aboveBuildHeight?.15:1.6)):(corridorCells.has(key)?1:overEquipment||aboveBuildHeight?1.002:1.01))}return cost}
const pathCost=points=>points.slice(1).reduce((sum,v,i)=>sum+segmentCost(points[i],v),0)+Math.max(0,points.length-2)*.8;
function machineCollision(a,b){const axis=a.findIndex((v,i)=>Math.abs(v-b[i])>1e-7);return p.machines.some(m=>{const lo=[m.x,floorBase(p,m.floor),m.z],hi=[m.x+m.w,floorBase(p,m.floor)+m.h,m.z+m.d];return [0,1,2].every(i=>i===axis?Math.min(Math.max(a[i],b[i]),hi[i])-Math.max(Math.min(a[i],b[i]),lo[i])>1e-6:a[i]>lo[i]+1e-6&&a[i]<hi[i]-1e-6)})}
// Reserve the longest inter-floor connections before local branches can fence
// their shafts in. Edge IDs retain the original graph order.
for(const e of (p.bounds?[...edges].sort((a,b)=>(!reserve?(Number(a.to.kind!=='export')-Number(b.to.kind!=='export')):0)||Math.abs(b.from.point[1]-b.to.point[1])-Math.abs(a.from.point[1]-a.to.point[1])):edges)){const a=e.from.point,b=e.to.point,A=approaches[e.id][0],B=approaches[e.id][1],product=products.indexOf(e.item);let height=Math.max(a[1],b[1],p.bounds&&optimized&&!reserve?0:floorBase(p,Math.max(floorAt(p,a[1]),floorAt(p,b[1])))+5.2),chosen=null;
let bestCost=Infinity;const initialHeight=height,planes=optimized?[...new Set([...Array.from({length:Math.max(0,Math.floor((p.bounds.height-.8-initialHeight)/rules.heightStep)+1)},(_,i)=>Math.round((initialHeight+i*rules.heightStep)*1e6)/1e6),...p.machines.map(m=>floorBase(p,m.floor)+m.h+1.4)].filter(y=>y>=initialHeight&&y<=p.bounds.height-.8))].sort((a,b)=>a-b):Array.from({length:32},(_,i)=>initialHeight+i*4.5);
for(let attempt=0;attempt<planes.length&&(optimized||!chosen);attempt++){height=planes[attempt];if(optimized){if(!fluid(e.item)&&[a[1],b[1]].some(y=>height-y>1e-7&&height-y<4-1e-7))continue}else while(!fluid(e.item)&&[a[1],b[1]].some(y=>height-y>1e-7&&height-y<4-1e-7))height+=4;
// Higher planes cannot improve a route once even their obstacle-free cost is worse.
if(optimized&&!reserve&&chosen){const lowerBound=Math.hypot(...a.map((v,k)=>v-A[k]))+Math.hypot(...b.map((v,k)=>v-B[k]))+Math.abs(A[0]-B[0])+Math.abs(A[2]-B[2])+1.2*(Math.abs(height-a[1])+Math.abs(height-b[1]));if(lowerBound>=bestCost-1e-7)break}
if(p.bounds&&height>p.bounds.height-.8)break;
const rects=[];if(p.bounds)rects.push({x0:-10000,x1:.8,z0:-10000,z1:10000},{x0:p.width-.8,x1:10000,z0:-10000,z1:10000},{x0:-10000,x1:10000,z0:-10000,z1:.8},{x0:-10000,x1:10000,z0:p.length-.8,z1:10000});for(const [id,ends] of approaches.entries())if(id!==e.id)for(const v of ends){const top=Math.max(...edges[id].from.point.slice(1,2),...edges[id].to.point.slice(1,2))+4;if(height<v[1]-1.4||height>top+1.4)continue;if([A,B].some(t=>Math.abs(t[0]-v[0])<1.4&&Math.abs(t[2]-v[2])<1.4))continue;rects.push({x0:v[0]-1.4,x1:v[0]+1.4,z0:v[2]-1.4,z1:v[2]+1.4})}for(const m of p.machines)if(height>=floorBase(p,m.floor)-.5&&height<=floorBase(p,m.floor)+m.h+.6)rects.push({x0:m.x-.8,x1:m.x+m.w+.8,z0:m.z-.8,z1:m.z+m.d+.8});for(const n of nodes)if(height>=n.point[1]-.9&&height<=n.point[1]+2.6)rects.push({x0:n.point[0]-2.8,x1:n.point[0]+2.8,z0:n.point[2]-2.8,z1:n.point[2]+2.8});for(const s of occupied){if(height>=Math.min(s.a[1],s.b[1])-.9&&height<=Math.max(s.a[1],s.b[1])+.9)rects.push({x0:Math.min(s.a[0],s.b[0])-1.4,x1:Math.max(s.a[0],s.b[0])+1.4,z0:Math.min(s.a[2],s.b[2])-1.4,z1:Math.max(s.a[2],s.b[2])+1.4})}
for(const [id,ends] of approaches.entries())if(id!==e.id)ends.forEach((v,j)=>{const port=(j?edges[id].to:edges[id].from).point;if(Math.abs(height-port[1])>.9)return;const r={x0:Math.min(v[0],port[0])-.9,x1:Math.max(v[0],port[0])+.9,z0:Math.min(v[2],port[2])-.9,z1:Math.max(v[2],port[2])+.9};if([A,B].some(q=>q[0]>r.x0&&q[0]<r.x1&&q[2]>r.z0&&q[2]<r.z1))return;rects.push(r)});
const U=[A[0],height,A[2]],V=[B[0],height,B[2]],paths=[[U,[V[0],height,U[2]],V],[U,[U[0],height,V[2]],V]];
const xs=[(U[0]+V[0])/2,Math.min(U[0],V[0])-6,Math.max(U[0],V[0])+6,Math.min(...approaches.flat().map(v=>v[0]))-8,Math.max(...approaches.flat().map(v=>v[0]))+8],zs=[(U[2]+V[2])/2,Math.min(U[2],V[2])-6,Math.max(U[2],V[2])+6,Math.min(...approaches.flat().map(v=>v[2]))-8,Math.max(...approaches.flat().map(v=>v[2]))+8];
for(const x of xs)paths.push([U,[x,height,U[2]],[x,height,V[2]],V]);for(const z of zs)paths.push([U,[U[0],height,z],[V[0],height,z],V]);
paths.sort((u,v)=>u.reduce((sum,p,i)=>sum+(i?Math.hypot(...p.map((n,j)=>n-u[i-1][j])):0),0)-v.reduce((sum,p,i)=>sum+(i?Math.hypot(...p.map((n,j)=>n-v[i-1][j])):0),0));
function accept(path){const clean=tidy(path);if(clean.slice(1).some((v,i)=>blocked(clean[i],v,rects)))return null;const full=tidy([a,A,...clean,B,b]);for(let i=1;i<full.length;i++)for(let j=i+1;j<full.length;j++)if(segmentsConflict(full[i-1],full[i],full[j-1],full[j]))return null;if(p.bounds&&full.slice(1).some((v,i)=>occupied.some(s=>segmentsConflict(full[i],v,s.a,s.b,true))))return null;if(optimized&&full.slice(1).some((v,i)=>machineCollision(full[i],v)||edges.flatMap(e=>[e.from,e.to]).filter(ep=>ep.kind).some(ep=>segmentBox(full[i],v,terminalBox(ep)))))return null;return full}
let local=null,localCost=Infinity;
for(const path of paths){const accepted=accept(path);if(!accepted)continue;const cost=optimized?pathCost(accepted):0;if(cost<localCost){local=accepted;localCost=cost}if(!optimized)break}
const horizontalLength=points=>points.slice(1).reduce((sum,v,i)=>sum+Math.hypot(v[0]-points[i][0],v[2]-points[i][2]),0);
if((!local||(optimized&&localCost<bestCost&&horizontalLength(local)>1.25*(Math.abs(A[0]-B[0])+Math.abs(A[2]-B[2]))))&&(p.bounds||attempt<2))for(const path of searchPath(U,V,rects,optimized?segmentCost:null)){const accepted=accept(path);if(accepted){const cost=optimized?pathCost(accepted):0;if(cost<localCost){local=accepted;localCost=cost}break}}
if(local&&localCost<bestCost){chosen=local;bestCost=localCost}

}
if(!chosen)throw Error('Не удалось развести конвейеры без пересечений. Уменьши выпуск или увеличь ширину завода.');
e.points=[chosen[0]];for(let k=1;k<chosen.length;k++){const a=chosen[k-1],b=chosen[k],vertical=Math.abs(a[0]-b[0])<1e-7&&Math.abs(a[2]-b[2])<1e-7,count=vertical?Math.ceil(Math.abs(a[1]-b[1])/48):1;for(let j=1;j<=Math.max(1,count);j++)e.points.push(j===Math.max(1,count)?b:a.map((v,i)=>v+(b[i]-v)*j/Math.max(1,count)))}routes[e.id]=e.points;
for(let i=1;i<e.points.length;i++){const a=e.points[i-1],b=e.points[i];if(Math.abs(a[1]-b[1])>.001)continue;const length=Math.hypot(a[0]-b[0],a[2]-b[2]),count=Math.max(1,Math.ceil(length/2));for(let k=0;k<count;k++){const t=(k+.5)/count;corridorCells.add(Math.floor((a[0]+(b[0]-a[0])*t)/2)+':'+Math.floor((a[2]+(b[2]-a[2])*t)/2))}}
for(let i=1;i<e.points.length;i++){const u=e.points[i-1],v=e.points[i];occupied.push({a:u,b:v,edge:e.id});if(Math.abs(u[1]-v[1])>.001)liftPositions.push({x:u[0],z:u[2],minY:Math.min(u[1],v[1]),maxY:Math.max(u[1],v[1]),item:e.item})}
}
const routingMetrics={horizontalLength:0,verticalLength:0};for(const points of routes)for(let i=1;i<points.length;i++){routingMetrics.horizontalLength+=Math.hypot(points[i][0]-points[i-1][0],points[i][2]-points[i-1][2]);routingMetrics.verticalLength+=Math.abs(points[i][1]-points[i-1][1])}
return {routing:optimized?'stacked':'fallback',searchStats,routingMetrics,nodes,edges,products,colors,routes,liftPositions,splitters:nodes.filter(n=>n.type==='splitter').length,mergers:nodes.filter(n=>n.type==='merger').length,lifts:liftPositions.length};
}
// Swept belt envelopes include the width at elbows and lift heads. Checking
// strict centre-line interiors missed T crossings and collisions near ends.
function terminalBox(ep){const center=ep.point.map((n,k)=>n-ep.dir[k]*1.4);return {lo:[center[0]-1.25,center[1]-.95,center[2]-1.25],hi:[center[0]+1.25,center[1]+1.65,center[2]+1.25]}}
function segmentBox(a,b,box){const axis=a.findIndex((v,k)=>Math.abs(v-b[k])>1e-7);return [0,1,2].every(k=>k===axis?Math.min(Math.max(a[k],b[k]),box.hi[k])-Math.max(Math.min(a[k],b[k]),box.lo[k])>1e-6:a[k]>box.lo[k]+1e-6&&a[k]<box.hi[k]-1e-6)}
function checkEquipmentCollisions(p,graph){
 const boxes=[...p.machines.map(m=>({lo:[m.x,floorBase(p,m.floor),m.z],hi:[m.x+m.w,floorBase(p,m.floor)+m.h,m.z+m.d]})),...graph.nodes.map(n=>({lo:[n.point[0]-2,n.point[1]-.7,n.point[2]-2],hi:[n.point[0]+2,n.point[1]+2.3,n.point[2]+2]})),...graph.edges.flatMap(e=>[e.from,e.to]).filter(ep=>ep.kind).map(terminalBox)],conflicts=[];
 for(const e of graph.edges)for(let i=1;i<e.points.length;i++)for(const [index,box] of boxes.entries())if(segmentBox(e.points[i-1],e.points[i],box))conflicts.push({edge:e.id,segment:i-1,box:index});
 return {valid:!conflicts.length,conflicts};
}
function checkBeltCollisions(graph){
 const conflicts=[],segments=graph.edges.flatMap(e=>e.points.slice(1).map((b,i)=>({a:e.points[i],b,edge:e.id,index:i})));
 for(let i=0;i<segments.length;i++)for(let j=i+1;j<segments.length;j++){
  const a=segments[i],b=segments[j];if(a.edge===b.edge)continue;
  if(segmentsConflict(a.a,a.b,b.a,b.b,false))conflicts.push({edges:[a.edge,b.edge],segments:[a.index,b.index]});
 }
 return {valid:!conflicts.length,conflicts};
}
function segmentsConflict(a,b,c,d,allowJoint=true){
 const axis=(a,b)=>a.findIndex((v,k)=>Math.abs(v-b[k])>1e-7),u=axis(a,b),v=axis(c,d);
 if(u<0||v<0)return false;
 if(!allowJoint&&segmentsConflict(a,b,c,d,true))return true;
 if(allowJoint){
  if(u===v){if([0,1,2].some(k=>k!==u&&Math.abs(a[k]-c[k])>=1.4))return false;return Math.min(Math.max(a[u],b[u]),Math.max(c[u],d[u]))-Math.max(Math.min(a[u],b[u]),Math.min(c[u],d[u]))>1e-6}
  const k=3-u-v;if(Math.abs(a[k]-c[k])>=1.4)return false;return c[u]>Math.min(a[u],b[u])+.001&&c[u]<Math.max(a[u],b[u])-.001&&a[v]>Math.min(c[v],d[v])+.001&&a[v]<Math.max(c[v],d[v])-.001;
 }

 return [0,1,2].every(k=>{
  const padA=k===u?0:k===1?.28:u===1?.68:.55,padB=k===v?0:k===1?.28:v===1?.68:.55;
  return Math.min(Math.max(a[k],b[k])+padA,Math.max(c[k],d[k])+padB)-Math.max(Math.min(a[k],b[k])-padA,Math.min(c[k],d[k])-padB)>1e-6;
 });
}
function audit(routes,lifts,clearance=4){const issues=[];const warn=(code,message,route)=>issues.push({code,message,route});
for(const [ri,points] of routes.entries()){for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],horizontal=Math.hypot(dx,dz),length=Math.hypot(horizontal,dy);if(length<1e-7)continue;if(horizontal<1e-7){if(Math.abs(dy)<rules.minLift-1e-6||Math.abs(dy)>rules.maxLift+1e-6)warn('lift-height','Высота подъёмника вне 4–48 м',ri);continue}if(Math.atan2(Math.abs(dy),horizontal)*180/Math.PI>rules.maxSlope+1e-6)warn('slope','Уклон конвейера больше 35°',ri);if(length<rules.minSegment)warn('short-belt','Лента короче 0,5 м',ri);if(length>rules.maxSegment)warn('long-belt','Лента длиннее 56 м: нужны промежуточные опоры',ri)}
for(let i=1;i<points.length-1;i++){const a=points[i-1],b=points[i],c=points[i+1];if(Math.abs(a[1]-b[1])>.01||Math.abs(c[1]-b[1])>.01)continue;const u=[b[0]-a[0],b[2]-a[2]],v=[c[0]-b[0],c[2]-b[2]],lu=Math.hypot(...u),lv=Math.hypot(...v);if(lu<1e-7||lv<1e-7)continue;const theta=Math.acos(Math.max(-1,Math.min(1,(u[0]*v[0]+u[1]*v[1])/(lu*lv)))),run=rules.minRadius*Math.tan(theta/2);if(theta>.01){if(run>Math.min(lu,lv)+1e-6)warn('turn-space','Недостаточно места для поворота радиусом 2 м',ri);else warn('sharp-turn','Угловой стык требует скругления радиусом 2 м',ri)}}}
for(let i=0;i<lifts.length;i++)for(let j=i+1;j<lifts.length;j++){const a=lifts[i],b=lifts[j];if(Math.max(a.minY,b.minY)>=Math.min(a.maxY,b.maxY))continue;if(Math.hypot(a.x-b.x,a.z-b.z)<clearance-1e-7)warn('lift-clearance',`Подъёмники ближе монтажного зазора ${clearance} м`,i)}
return issues}
const api={assignJunctionPorts,assignFloors,floorBase,floorAt,displayY,actualY,displayBase,rules,calculate,audit,pack,segmentsConflict,checkBeltCollisions,checkEquipmentCollisions,search3D,optimizeGraph3D,machinePorts,rotateDirection,localDimensions,machinePoint,checkFlows,splitterRates,constructionCost,compareConstruction};root.FactoryLogistics=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);






