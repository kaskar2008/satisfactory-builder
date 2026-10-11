/* Static low-poly approximations of the five supported Satisfactory machines.
   All parts stay inside the planned machine envelope; ports come from the planner. */
globalThis.FactoryModels={machine(m,y,{box,face}){
 if(m.rotation){const world=m,L=globalThis.FactoryLogistics,originalFace=face,originalBox=box;m={...m,...L.localDimensions(m),rotation:0};const transform=v=>L.machinePoint(world,[v[0]-m.x,v[1],v[2]-m.z]);face=(v,c,id)=>originalFace(v.map(transform),c,id);box=(x,Y,z,w,h,d,c,id)=>{const a=transform([x,Y,z]),b=transform([x+w,Y+h,z+d]);originalBox(Math.min(a[0],b[0]),Y,Math.min(a[2],b[2]),Math.abs(b[0]-a[0]),h,Math.abs(b[2]-a[2]),c,id)}}

 const {x,z,w,d,h,id}=m,C={orange:'#e78d35',dark:'#30383d',steel:'#9aa5a9',light:'#c8ccca',black:'#182126',yellow:'#edcb54'};
 const B=(a,b,c,W,H,D,color)=>box(x+a*w,y+b*h,z+c*d,W*w,H*h,D*d,color,id);
 const point=v=>[x+v[0]*w,y+v[1]*h,z+v[2]*d];
 function cylinder(cx,cy,cz,r,height,color,axis='y',segments=8){
  const center=point([cx,cy,cz]),radius=r*Math.min(w,d),heightM=height*(axis==='y'?h:axis==='x'?w:d);
  const ring=(t,level)=>{const v=[...center],axes=axis==='y'?[0,2]:axis==='x'?[1,2]:[0,1],k=axis==='y'?1:axis==='x'?0:2;v[axes[0]]+=Math.cos(t)*radius;v[axes[1]]+=Math.sin(t)*radius;v[k]+=level;return v};
  const top=[...center];top[axis==='y'?1:axis==='x'?0:2]+=heightM;
  const muted='#'+color.slice(1).match(/../g).map(v=>Math.round(parseInt(v,16)*.78).toString(16).padStart(2,'0')).join('');
  for(let i=0;i<segments;i++){const a=i*2*Math.PI/segments,b=(i+1)*2*Math.PI/segments,lo=ring(a,0),next=ring(b,0),hi=ring(a,heightM),hiNext=ring(b,heightM);face([lo,next,hiNext,hi],i%3?color:muted,id);face([top,hi,hiNext,top],color,id);face([center,next,lo,center],C.dark,id)}
 }
 function beam(a,b,r,color){const A=point(a),D=point(b),v=D.map((n,i)=>n-A[i]),len=Math.hypot(...v),u=v.map(n=>n/len),side=Math.abs(u[1])<.9?[u[2],0,-u[0]]:[1,0,0],s=Math.hypot(...side),S=side.map(n=>n*r/s),T=[u[1]*S[2]-u[2]*S[1],u[2]*S[0]-u[0]*S[2],u[0]*S[1]-u[1]*S[0]],corners=p=>[[1,1],[-1,1],[-1,-1],[1,-1]].map(([a,b])=>p.map((n,i)=>n+a*S[i]+b*T[i])),aC=corners(A),bC=corners(D);for(let i=0;i<4;i++)face([aC[i],aC[(i+1)%4],bC[(i+1)%4],bC[i]],color,id);face(aC,C.dark,id);face(bC,color,id)}
 function vent(a,b,c,W,H){B(a,b,c,W,H,.025,C.black);for(let i=0;i<4;i++)B(a+.015,b+H*(i+1)/5,c+.026,W-.03,.012,.01,C.steel)}
 function arm(a,b,c){cylinder(a[0],a[1],a[2],.045,.065,C.orange);beam(a,b,.21,C.orange);beam(b,c,.16,C.light);B(c[0]-.035,c[1]-.035,c[2]-.035,.07,.07,.07,C.dark)}
 function hopper(a,b,c,W,H,D){const bottom=[[a+W*.22,b,c+D*.22],[a+W*.78,b,c+D*.22],[a+W*.78,b,c+D*.78],[a+W*.22,b,c+D*.78]],top=[[a,b+H,c],[a+W,b+H,c],[a+W,b+H,c+D],[a,b+H,c+D]];for(let i=0;i<4;i++)face([point(bottom[i]),point(bottom[(i+1)%4]),point(top[(i+1)%4]),point(top[i])],i%2?C.steel:C.orange,id);face(top.map(point),C.black,id)}
 B(.015,0,.015,.97,.055,.97,C.dark);B(.045,.055,.045,.91,.055,.91,C.steel);
 for(const a of [.06,.83])for(const c of [.07,.84])B(a,0,c,.11,.13,.09,C.orange);
 if(m.b==='smelter'){
  B(.16,.11,.18,.68,.24,.64,C.orange);cylinder(.48,.3,.5,.25,.37,C.dark);
  cylinder(.48,.64,.5,.28,.08,C.orange);cylinder(.48,.72,.5,.19,.08,C.steel);
  B(.68,.34,.61,.19,.51,.19,C.light);B(.7,.85,.63,.15,.15,.15,C.dark);
  B(.2,.18,.15,.58,.08,.025,'#ffc46c');vent(.2,.38,.22,.15,.18);
  beam([.14,.23,.35],[.14,.68,.35],.18,C.steel);beam([.14,.68,.35],[.33,.68,.35],.18,C.steel);
  hopper(.2,.24,.13,.56,.18,.23);B(.26,.4,.235,.4,.13,.018,C.black);
  for(let i=0;i<3;i++)B(.29+i*.12,.42,.255,.055,.085,.012,'#ffac42');
  cylinder(.775,.76,.705,.11,.07,C.dark);B(.65,.28,.38,.12,.12,.21,C.steel);
  beam([.86,.2,.38],[.86,.62,.38],.12,C.light);
  B(.81,.21,.33,.1,.07,.1,C.dark);B(.82,.225,.34,.08,.045,.08,C.orange);
 }else if(m.b==='foundry'){
  B(.1,.11,.2,.8,.22,.63,C.orange);
  for(const a of [.3,.65]){cylinder(a,.33,.46,.15,.35,C.dark);cylinder(a,.67,.46,.17,.06,C.orange);B(a-.06,.73,.43,.12,.27,.12,C.steel)}
  B(.14,.34,.72,.7,.2,.12,C.dark);vent(.16,.39,.845,.65,.1);
  for(const a of [.09,.88])beam([a,.14,.25],[a,.6,.65],.17,C.steel);
  for(const a of [.15,.56]){hopper(a,.29,.12,.29,.18,.23);B(a+.02,.53,.3,.25,.08,.025,C.orange);B(a+.07,.55,.327,.15,.035,.008,'#ffb44b')}
  B(.18,.2,.85,.62,.075,.08,C.steel);
  for(const a of [.22,.57]){B(a,.34,.18,.21,.12,.025,C.black);for(let j=0;j<3;j++)B(a+.025+j*.055,.355,.208,.025,.08,.012,'#ffb44b')}
 }else if(m.b==='constructor'){
  B(.22,.11,.2,.56,.24,.58,C.dark);B(.28,.15,.32,.44,.08,.32,C.steel);
  for(const a of [.12,.8]){B(a,.11,.27,.08,.62,.43,C.orange);B(a+.025,.25,.33,.03,.4,.3,C.steel)}
  B(.12,.72,.27,.76,.13,.43,C.orange);B(.25,.85,.37,.5,.15,.22,C.dark);
  cylinder(.48,.36,.5,.075,.36,C.steel);B(.32,.32,.37,.32,.065,.25,C.orange);
  vent(.27,.73,.245,.44,.09);B(.13,.22,.14,.18,.18,.09,C.light);
  cylinder(.48,.39,.6,.105,.18,C.dark,'z');cylinder(.48,.4,.66,.115,.04,C.orange,'z');
  for(const a of [.22,.72])B(a,.31,.3,.045,.33,.045,C.light);
  B(.29,.215,.3,.42,.03,.38,C.black);
  B(.815,.21,.28,.035,.36,.035,C.dark);B(.825,.25,.29,.018,.28,.018,C.light);
  B(.82,.17,.27,.06,.05,.07,C.steel);
  }else if(['refinery','blender','packager','converter','encoder','accelerator'].includes(m.b)){
  B(.12,.11,.16,.76,.22,.68,C.orange);
  if(m.b==='refinery'){
   // Reference silhouette: open frame, dark vessel, pale stack and orange service housings.
   B(.12,.11,.16,.76,.22,.68,C.dark);
   B(.16,.12,.18,.68,.045,.64,'#74818a');
   cylinder(.48,.31,.47,.23,.32,'#303a42','y',8);
   cylinder(.48,.625,.47,.235,.025,'#77878d','y',8);
   cylinder(.48,.65,.47,.15,.035,'#a77746','y',8);
   cylinder(.23,.32,.29,.048,.65,'#c3cbcf','y',8);
   cylinder(.23,.84,.29,.069,.15,'#d4d9d8','y',8);
   for(const t of [.52,.69,.82])cylinder(.23,t,.29,.058,.012,'#353e45','y',8);
   cylinder(.72,.52,.57,.11,.23,'#3e4a53','y',8);
   cylinder(.72,.75,.57,.12,.04,'#c38a4d','y',8);
   B(.19,.13,.22,.21,.2,.19,'#c98b4d');B(.23,.16,.213,.042,.15,.008,'#ffe49a');
   B(.41,.19,.2,.1,.12,.035,'#495777');
   B(.75,.24,.52,.12,.26,.21,'#bd844c');
   face([[.75,.5,.52],[.87,.5,.52],[.87,.29,.74],[.75,.29,.74]].map(point),'#69757c',id);
   face([[.76,.49,.522],[.86,.49,.522],[.86,.3,.731],[.76,.3,.731]].map(point),'#303c45',id);
   B(.76,.27,.742,.1,.08,.009,'#3a464e');
   for(const a of [.16,.83])B(a,.11,.23,.035,.44,.04,'#9aa8ae');
   B(.12,.55,.2,.78,.025,.51,'#69767b');
   for(const a of [.16,.83])beam([a,.57,.22],[a,.62,.22],.055,'#aab6ba');
   beam([.16,.62,.22],[.83,.62,.22],.055,'#aab6ba');
   B(.09,.11,.49,.018,.45,.025,'#a7b4b9');B(.19,.11,.49,.018,.45,.025,'#a7b4b9');
   for(let i=0;i<8;i++)B(.108,.13+i*.05,.49,.082,.006,.025,'#81929a');
   beam([.2,.57,.31],[.69,.57,.31],.13,'#8b9ca3');
   beam([.64,.2,.72],[.64,.49,.72],.15,'#4c626b');beam([.64,.49,.72],[.76,.49,.72],.15,'#4c626b');
   B(.66,.57,.24,.17,.075,.018,'#b9c2c1');B(.68,.59,.259,.13,.026,.005,'#f2d27d');
  }
  else if(m.b==='blender'){for(const t of [.28,.68]){cylinder(t,.33,.5,.16,.36,C.steel);cylinder(t,.69,.5,.18,.06,C.orange)}B(.17,.75,.3,.66,.1,.4,C.dark)}
  else if(m.b==='packager'){B(.24,.32,.28,.52,.48,.48,C.steel);cylinder(.5,.8,.5,.2,.09,C.orange)}
  else if(m.b==='accelerator'){for(const t of [.3,.65])cylinder(.5,.33,t,.32,.27,C.steel);B(.26,.65,.22,.48,.28,.56,C.dark)}
  else{B(.24,.33,.26,.52,.44,.48,C.steel);for(const t of [.2,.76])B(t,.33,.24,.07,.58,.52,C.orange);B(.18,.81,.24,.64,.1,.52,C.dark)}
 }else if(m.b==='assembler'){
  B(.12,.11,.18,.76,.16,.65,C.dark);B(.27,.27,.36,.46,.07,.35,C.steel);
  for(const a of [.1,.78]){B(a,.11,.22,.12,.41,.52,C.orange);vent(a,.28,.195,.12,.17)}
  arm([.22,.4,.31],[.32,.65,.4],[.47,.41,.49]);arm([.77,.4,.7],[.66,.67,.62],[.54,.43,.53]);
  B(.19,.55,.76,.62,.25,.12,C.dark);B(.15,.8,.74,.7,.1,.16,C.orange);
  for(const a of [.18,.78])B(a,.28,.76,.045,.52,.06,C.steel);
  B(.76,.32,.12,.15,.22,.1,C.light);
  for(const a of [.18,.7])cylinder(a,.45,.45,.055,.09,C.steel,'z');
  B(.34,.345,.43,.32,.025,.19,C.black);B(.38,.37,.47,.24,.045,.11,C.orange);
  beam([.2,.24,.86],[.8,.24,.86],.12,C.light);
  B(.77,.11,.13,.12,.2,.08,C.dark);B(.778,.33,.115,.11,.12,.04,C.steel);B(.79,.35,.108,.085,.07,.012,'#71c8cf');
 }else{
  B(.1,.11,.15,.8,.18,.72,C.dark);B(.18,.29,.25,.64,.12,.48,C.steel);
  for(const a of [.1,.83]){B(a,.22,.22,.07,.6,.58,C.light);B(a,.7,.19,.07,.15,.64,C.orange)}
  B(.1,.82,.19,.8,.12,.64,C.orange);B(.24,.94,.3,.52,.04,.4,C.dark);
  for(let i=0;i<5;i++)B(.275+i*.09,.981,.33,.035,.014,.34,C.steel);
  for(const c of [.32,.64]){arm([.22,.39,c],[.34,.64,c],[.46,.42,c]);arm([.78,.39,c],[.65,.64,c],[.55,.42,c])}
  B(.2,.44,.78,.6,.3,.08,C.dark);vent(.24,.51,.863,.52,.16);
  B(.84,.25,.11,.08,.28,.09,C.light);
  for(const c of [.32,.64]){B(.37,.415,c-.045,.26,.018,.09,C.black);B(.43,.435,c-.03,.14,.028,.06,C.orange)}
  B(.16,.77,.22,.68,.035,.57,C.dark);vent(.34,.84,.165,.32,.06);
 }
 // Service panels, hazard markings and a green operating beacon.
 B(.08,.12,.095,.18,.09,.02,C.black);
 for(let i=0;i<4;i++)B(.085+i*.045,.13,.116,.022,.055,.008,C.yellow);
 B(.11,.21,.1,.1,.12,.025,C.steel);B(.13,.24,.126,.06,.055,.005,'#71c8cf');
 // Both service fittings have a physical bracket down to the base frame.
 if(m.b!=='refinery'){B(.075,.105,.14,.055,.835,.055,C.steel);
 B(.075,.94,.14,.055,.055,.055,'#7dd599');
 B(.105,.105,.1,.12,.105,.05,C.orange);
 B(.105,.19,.095,.11,.02,.06,C.dark);
 // Ceramic power socket mounted on the service mast, with a metal lug.
 B(.072,.56,.135,.07,.04,.07,C.dark);
 for(let i=0;i<3;i++)B(.078,.6+i*.035,.14,.058,.02,.058,'#b69171');
 B(.089,.71,.15,.035,.035,.035,C.steel);}

 for(const a of [.07,.87]){B(a,.115,.22,.04,.07,.5,C.steel);B(a+.006,.187,.45,.028,.026,.026,C.dark)}
 // Fasteners and inset access plates stay clear of the casing surfaces.
 for(const a of [.18,.75])B(a,.115,.83,.035,.035,.03,C.yellow);
 // Port collars use the real recipe's port count and the planned 1.2 m height.
 const recipe=m.recipe??globalThis.FactoryPlanner?.recipes[m.group]??{out:1},inputs=Object.keys(recipe?.ins||{input:1}).length,outputs=Object.keys(globalThis.FactoryPlanner.outputs(recipe,m.group)).length;
 for(const [count,rear] of [[inputs,false],[outputs,true]])for(let i=0;i<count;i++){
  const cx=w*(i+1)/(count+1),cz=rear?z+d-.45:z;
  box(x+cx-.65,y+.42,rear?cz:cz+.025,1.3,1.25,.425,C.orange,id);
  box(x+cx-.48,y+.57,rear?cz+.431:cz+.002,.96,.86,.018,C.black,id);
  box(x+cx-.55,y+.4,rear?z+d-.7:z,1.1,.14,.7,C.steel,id);
 }
},junction(n,y,{box,face}){
 const [x,,z]=n.point,C=n.type==='splitter'?'#db913e':'#c5cbd0';
 box(x-1.85,y-.7,z-1.85,3.7,.3,3.7,'#30383d');
 const outline=[[-1.2,-1.65],[1.2,-1.65],[1.65,-1.2],[1.65,1.2],[1.2,1.65],[-1.2,1.65],[-1.65,1.2],[-1.65,-1.2]],bottom=outline.map(([a,b])=>[x+a,y-.4,z+b]),top=outline.map(([a,b])=>[x+a*.93,y+1.8,z+b*.93]);
 for(let i=0;i<8;i++)face([bottom[i],bottom[(i+1)%8],top[(i+1)%8],top[i]],i%2?'#536067':C);
 box(x-1.85,y+1.8,z-1.85,3.7,.45,3.7,'#69757b');
 box(x-1.2,y+2.25,z-1.2,2.4,.035,2.4,C);
 // Inlaid roof arrows distinguish distribution from collection without labels.
 for(const port of n.type==='splitter'?n.ports.outputs:n.ports.inputs){const dx=port.dir[0],dz=port.dir[2],sign=n.type==='splitter'?1:-1,cx=x+dx*.65,cz=z+dz*.65;
  face([[cx+dx*sign*.38,y+2.29,cz+dz*sign*.38],[cx-dx*sign*.24-dz*.22,y+2.29,cz-dz*sign*.24+dx*.22],[cx-dx*sign*.24+dz*.22,y+2.29,cz-dz*sign*.24-dx*.22],[cx+dx*sign*.38,y+2.29,cz+dz*sign*.38]],'#253138');
 }
 for(const ports of [n.type==='splitter'?[n.ports.input]:n.ports.inputs,n.type==='splitter'?n.ports.outputs:[n.ports.output]])for(const port of ports){const [px,,pz]=port.point,dx=port.dir[0],dz=port.dir[2];box(px-dx*.7-.65,y-.5,pz-dz*.7-.65,1.3,1.7,1.3,'#202a30');box(px-dx*.6-.5,y-.35,pz-dz*.6-.5,1,.18,1,'#8c999f')}
}};

/* Opaque software 3D renderer. Coordinates and routes are schematic. */
const sceneCache=new WeakMap(),shadeCache=new Map(),outlineCache=new WeakMap();

function machinePaths(p,id){if(id>=p.machines.length){const n=p.logistics.nodes.find(n=>p.machines.length+n.id===id);if(!n)return [];const inputs=n.type==='splitter'?[n.ports.input]:n.ports.inputs,outputs=n.type==='splitter'?n.ports.outputs:[n.ports.output],same=(a,b)=>a.every((v,k)=>Math.abs(v-b[k])<1e-6);return p.logistics.edges.filter(e=>e.item===n.item&&(inputs.some(port=>same(port.point,e.to.point))||outputs.some(port=>same(port.point,e.from.point)))).map(edge=>({edge,input:inputs.some(port=>same(port.point,edge.to.point))}))}const m=p.machines.find(m=>m.id===id);if(!m)return [];const ports=FactoryLogistics.machinePorts(p,m,FactoryPlanner.recipesFor(p.config)),inputs=ports.inputs.map(port=>({item:port.item,point:port.point})),outputs=ports.outputs,same=(a,b)=>a.every((v,k)=>Math.abs(v-b[k])<1e-6);
 return p.logistics.edges.filter(e=>inputs.some(port=>port.item===e.item&&same(port.point,e.to.point))||outputs.some(port=>port.item===e.item&&same(port.point,e.from.point))).map(e=>({edge:e,input:inputs.some(port=>port.item===e.item&&same(port.point,e.to.point))}));
}

globalThis.FactoryScene={machinePaths,render({canvas,ctx,plan:p,angle,tilt,zoom,selected,floor,onHits,panX=0,panY=0,gpu,flow='all',labelOptions={},viewStyle='engineering',simulation=null,moduleIndex=0}){
const realistic=viewStyle==='realistic',cacheKey=floor+':'+flow+':'+viewStyle+':'+Boolean(simulation);
const selectedPaths=selected!==null&&selected>=0?machinePaths(p,selected):[];
const floorCount=p.fit?.usedFloors??p.config.floors,L=FactoryLogistics,displayY=y=>L.displayY(p,y),displayBase=f=>L.displayBase(p,f);
const rect=canvas.getBoundingClientRect(),W=rect.width,H=rect.height,dpr=Math.min(globalThis.devicePixelRatio||1,1.5);
const pixelW=Math.round(W*dpr),pixelH=Math.round(H*dpr);if(canvas.width!==pixelW||canvas.height!==pixelH){canvas.width=pixelW;canvas.height=pixelH;}ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);
const visible=floor==='all'?p.machines:p.machines.filter(m=>m.floor===+floor),base=floor==='all'?0:displayBase(+floor);
const scale=Math.min((W-100)/(p.width+p.length+20)*1.3,(H-125)/(p.length*.65+(floor==='all'?(L.displayBase(p,floorCount-1)+(p.floors?.at(-1).height??16)):24)))*zoom;
const cosA=Math.cos(angle),sinA=Math.sin(angle),cosT=Math.cos(tilt),sinT=Math.sin(tilt);
function project(v){const [X,Y,Z]=v,x=X-p.width/2,z=Z-p.length/2,y=Y-base,a=x*cosA-z*sinA,b=x*sinA+z*cosA;return {x:W/2+panX+a*scale,y:H*.65+panY+(b*cosT-y*sinT)*scale,depth:-b*sinT-y*cosT}}
let floorsCache=sceneCache.get(p);if(!floorsCache){floorsCache=new Map();sceneCache.set(p,floorsCache)}
const cached=floorsCache.get(cacheKey),faces=cached?.faces||[],labels=cached?.labels||[],hits=new Map(),routes=cached?.routes||[],liftPositions=cached?.liftPositions||[];
const actualY=y=>L.actualY(p,y);
let floorGeometry=false,junction=null,routeId=null,modelTransform=null,dynamic=false;const surfaceKeys=new Map(),particleFaces=[],travelPaths=cached?.travelPaths||{};
function face(v,color,id=null){v=modelTransform?v.map(modelTransform):v;
if(floor!=='all'&&!floorGeometry){const low=displayBase(+floor),high=p.floors?.[+floor+1]?.y??p.bounds?.height??low+16;
 for(const [level,sign] of [[low,1],[high,-1]]){const clipped=[];for(let i=0;i<v.length;i++){const a=v[i],b=v[(i+1)%v.length],inside=sign*(a[1]-level)>=-1e-7,next=sign*(b[1]-level)>=-1e-7;if(inside)clipped.push(a);if(inside!==next){const t=(level-a[1])/(b[1]-a[1]);clipped.push(a.map((n,k)=>n+(b[k]-n)*t))}}v=clipped;if(v.length<3)return}
}
const f={v,color,id:id??(junction!==null?p.machines.length+junction:routeId===null?null:-3-routeId),backdrop:floorGeometry,junction};if(f.v.length!==4){for(let i=1;i<f.v.length-1;i++){const triangle={...f,v:[f.v[0],f.v[i],f.v[i+1],f.v[i+1]]};if(dynamic)particleFaces.push(triangle);else faces.push(triangle)}return}if(dynamic){particleFaces.push(f);return}if(realistic&&!floorGeometry){const key=f.id+':'+f.v.map(p=>p.map(n=>Math.round(n*1e6)).join(',')).sort().join(';');const old=surfaceKeys.get(key);if(old!==undefined){faces[old]=f;return}surfaceKeys.set(key,faces.length)}faces.push(f)}
function box(x,y,z,w,h,d,color,id=null){let shades=shadeCache.get(color);if(!shades){const rgb=color.match(/\w\w/g).map(v=>parseInt(v,16));shades={};for(const k of [.6,.72,.85,.65])shades[k]='#'+rgb.map(v=>Math.round(v*k).toString(16).padStart(2,'0')).join('');shadeCache.set(color,shades)}const shade=k=>shades[k];
face([[x,y,z],[x+w,y,z],[x+w,y+h,z],[x,y+h,z]],shade(.6),id);face([[x+w,y,z],[x+w,y,z+d],[x+w,y+h,z+d],[x+w,y+h,z]],shade(.72),id);face([[x+w,y,z+d],[x,y,z+d],[x,y+h,z+d],[x+w,y+h,z+d]],shade(.85),id);face([[x,y,z+d],[x,y,z],[x,y+h,z],[x,y+h,z+d]],shade(.65),id);face([[x,y+h,z],[x+w,y+h,z],[x+w,y+h,z+d],[x,y+h,z+d]],color,id);face([[x,y,z+d],[x+w,y,z+d],[x+w,y,z],[x,y,z]],shade(.6),id)}
function arrow(a,b,color){const A=project(a),B=project(b),dx=B.x-A.x,dy=B.y-A.y,l=Math.hypot(dx,dy)||1;ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(A.x,A.y);ctx.lineTo(B.x,B.y);ctx.stroke();ctx.beginPath();ctx.moveTo(B.x,B.y);ctx.lineTo(B.x-dx/l*5-dy/l*3,B.y-dy/l*5+dx/l*3);ctx.lineTo(B.x-dx/l*5+dy/l*3,B.y-dy/l*5-dx/l*3);ctx.fill()}
const arrows=cached?.arrows||[];
let routeDepth=0;
function pipeFace(vertices,a,b){
 const radial=[0,1,2].map(k=>vertices.reduce((sum,v)=>sum+v[k],0)/4-(a[k]+b[k])/2),size=Math.hypot(...radial);
 const light=[-.4,.8,-.35],lightSize=Math.hypot(...light),dot=size?radial.reduce((sum,v,k)=>sum+v*light[k],0)/size/lightSize:0;
 const brightness=.76+.24*dot,color='#'+[132,158,170].map(v=>Math.round(v*brightness).toString(16).padStart(2,'0')).join('');
 face(vertices,color);
}
function tube(a,b,color){if(!realistic){const vector=b.map((v,k)=>v-a[k]),length=Math.hypot(...vector);if(length<1e-8)return;const t=vector.map(v=>v/length),axis=Math.abs(t[1])<.9?[0,1,0]:[1,0,0],u=[t[1]*axis[2]-t[2]*axis[1],t[2]*axis[0]-t[0]*axis[2],t[0]*axis[1]-t[1]*axis[0]],size=Math.hypot(...u);for(let k=0;k<3;k++)u[k]/=size;const v=[t[1]*u[2]-t[2]*u[1],t[2]*u[0]-t[0]*u[2],t[0]*u[1]-t[1]*u[0]],radius=dynamic?.32:.24,ring=p=>[0,1,2,3].map(i=>p.map((n,k)=>n+radius*(u[k]*Math.cos(i*Math.PI/2)+v[k]*Math.sin(i*Math.PI/2)))),A=ring(a),B=ring(b);for(let i=0;i<4;i++)face([A[i],A[(i+1)%4],B[(i+1)%4],B[i]],color);return}const axis=a.findIndex((n,k)=>Math.abs(n-b[k])>1e-7);if(axis<0)return;const axes=[0,1,2].filter(k=>k!==axis),ring=p=>Array.from({length:8},(_,i)=>{const q=[...p];q[axes[0]]+=Math.cos(i*Math.PI/4)*.45;q[axes[1]]+=Math.sin(i*Math.PI/4)*.45;return q}),A=ring(a),B=ring(b);for(let i=0;i<8;i++)pipeFace([A[i],A[(i+1)%8],B[(i+1)%8],B[i]],a,b);for(let i=0;i<8;i++){face([a,A[i],A[(i+1)%8],a],color);face([b,B[(i+1)%8],B[i],b],color)}}
function pipeline(points,color){
 const starts=points.map(v=>[...v]),ends=points.map(v=>[...v]),bends={},tangents=new WeakMap();
 for(let i=1;i<points.length-1;i++){
  const a=points[i-1],b=points[i],c=points[i+1],u=b.map((n,k)=>n-a[k]),v=c.map((n,k)=>n-b[k]),lu=Math.hypot(...u),lv=Math.hypot(...v);
  if(lu<1e-7||lv<1e-7)continue;const U=u.map(n=>n/lu),V=v.map(n=>n/lv);
  if(Math.abs(U.reduce((n,x,k)=>n+x*V[k],0))>1e-6)continue;
  const r=Math.min(.65,lu*.45,lv*.45),center=b.map((n,k)=>n-U[k]*r+V[k]*r);
  ends[i]=b.map((n,k)=>n-U[k]*r);starts[i]=b.map((n,k)=>n+V[k]*r);
  tangents.set(ends[i],U);tangents.set(starts[i],V);
  bends[i]=Array.from({length:13},(_,j)=>{const t=j*Math.PI/24,pt=center.map((n,k)=>n-r*V[k]*Math.cos(t)+r*U[k]*Math.sin(t));tangents.set(pt,U.map((n,k)=>n*Math.cos(t)+V[k]*Math.sin(t)));return pt});
 }
 const path=[starts[0]];for(let i=1;i<points.length;i++){path.push(ends[i]);if(bends[i])path.push(...bends[i].slice(1))}
 const clean=path.filter((v,i)=>!i||Math.hypot(...v.map((n,k)=>n-path[i-1][k]))>1e-7);
 let normal=null;const rings=clean.map((pt,i)=>{
  const a=clean[Math.max(0,i-1)],b=clean[Math.min(clean.length-1,i+1)],delta=b.map((n,k)=>n-a[k]),length=Math.hypot(...delta),t=tangents.get(pt)??delta.map(n=>n/length);
  const ref=normal??(Math.abs(t[1])<.9?[0,1,0]:[1,0,0]),dot=ref.reduce((n,x,k)=>n+x*t[k],0),u=ref.map((n,k)=>n-dot*t[k]),size=Math.hypot(...u);normal=u.map(n=>n/size);
  const v=[t[1]*normal[2]-t[2]*normal[1],t[2]*normal[0]-t[0]*normal[2],t[0]*normal[1]-t[1]*normal[0]];
  return Array.from({length:8},(_,j)=>pt.map((n,k)=>n+.45*(normal[k]*Math.cos(j*Math.PI/4)+v[k]*Math.sin(j*Math.PI/4))));
 });
 for(let i=1;i<rings.length;i++)for(let j=0;j<8;j++)pipeFace([rings[i-1][j],rings[i-1][(j+1)%8],rings[i][(j+1)%8],rings[i][j]],clean[i-1],clean[i]);
 if(!cached){routes.push(clean);travelPaths[routeId]=clean.map(v=>v.map((n,k)=>k===1?actualY(n):n))}
}
function belt(a,b,color='#8b9aa5'){
if(!cached){if(!routeDepth)routes.push([a.map((v,i)=>i===1?actualY(v):v),b.map((v,i)=>i===1?actualY(v):v)]);if(Math.abs(b[1]-a[1])>.1)liftPositions.push({x:a[0],z:a[2],minY:Math.min(actualY(a[1]),actualY(b[1])),maxY:Math.max(actualY(a[1]),actualY(b[1]))})}const dx=b[0]-a[0],dz=b[2]-a[2],dy=b[1]-a[1];if(Math.abs(dy)>.1){box(a[0]-.6,Math.min(a[1],b[1]),a[2]-.6,1.2,Math.abs(dy),1.2,realistic?'#68757b':color);if(realistic){const low=Math.min(a[1],b[1]),height=Math.abs(dy);for(const dx of [-.56,.42])box(a[0]+dx,low,a[2]-.68,.14,height,.14,'#e78d35');box(a[0]-.55,low,a[2]+.61,1.1,height,.12,'#30383d')}for(let y=Math.min(a[1],b[1])+1;y<Math.max(a[1],b[1]);y+=2)box(a[0]-.68,y,a[2]-.68,1.36,.18,1.36,'#34414b');return}
const len=Math.abs(dx)+Math.abs(dz);if(len<.05)return;const x=Math.min(a[0],b[0]),z=Math.min(a[2],b[2]),horizontal=Math.abs(dx)>.1;
box(x-(horizontal?0:.55),a[1]-.35,z-(horizontal?.55:0),horizontal?len:1.1,.35,horizontal?1.1:len,'#34424e');
box(x-(horizontal?0:.42),a[1],z-(horizontal?.42:0),horizontal?len:.84,.09,horizontal?.84:len,realistic?'#454d50':color);
if(realistic){for(const side of [-.53,.43])box(x+(horizontal?0:side),a[1]+.05,z+(horizontal?side:0),horizontal?len:.1,.16,horizontal?.1:len,'#a7b0b2');}
if(realistic&&!simulation&&len>6){const item=p.logistics.edges.find(e=>e.id===routeId)?.item,cargoColor=item==='coal'?'#252b30':item==='ore'?'#8e7661':item==='ingot'||item==='steel'?'#a4adb1':'#bca582';for(const t of [.3,.65]){const X=a[0]+dx*t,Z=a[2]+dz*t;box(X-.22,a[1]+.12,Z-.22,.44,.23,.44,cargoColor)}}
for(let t=1;t<len;t+=Math.max(3,len/12)){const X=a[0]+dx*t/len,Z=a[2]+dz*t/len;face([[X-(horizontal?.09:.48),a[1]+.1,Z-(horizontal?.48:.09)],[X+(horizontal?.09:.48),a[1]+.1,Z-(horizontal?.48:.09)],[X+(horizontal?.09:.48),a[1]+.1,Z+(horizontal?.48:.09)],[X-(horizontal?.09:.48),a[1]+.1,Z+(horizontal?.48:.09)]],'#28333b')}
if(!realistic&&len>2)arrows.push([[a[0]+dx*.35,a[1]+.25,a[2]+dz*.35],[a[0]+dx*.65,a[1]+.25,a[2]+dz*.65],color==='#8b9aa5'?'#e0e7eb':color,routeId])}
function route(points,color){
 if(!cached)routes.push(points.map(v=>v.map((n,i)=>i===1?actualY(n):n)));
 const starts=points.map(v=>[...v]),ends=points.map(v=>[...v]),bends={};routeDepth++;
 if(realistic)for(let i=1;i<points.length-1;i++){
  const a=points[i-1],b=points[i],c=points[i+1],u=b.map((n,k)=>n-a[k]),v=c.map((n,k)=>n-b[k]),lu=Math.hypot(...u),lv=Math.hypot(...v);
  if(Math.abs(u[1])>1e-7||Math.abs(v[1])>1e-7||Math.abs(u[0]*v[0]+u[2]*v[2])>1e-7||lu<.1||lv<.1)continue;
  const U=u.map(n=>n/lu),V=v.map(n=>n/lv),sign=U[0]*V[2]-U[2]*V[0];let r=Math.min(2,lu*.45,lv*.45);
  // A cosmetic fillet must not cut through a machine or a neighbouring belt.
  const obstacles=[...p.machines.map(m=>({lo:[m.x,m.y,m.z],hi:[m.x+m.w,m.y+m.h,m.z+m.d]})),...p.logistics.nodes.map(n=>({lo:[n.point[0]-2,n.point[1]-.7,n.point[2]-2],hi:[n.point[0]+2,n.point[1]+2.3,n.point[2]+2]}))];
  const clear=radius=>{const center=b.map((n,k)=>n-U[k]*radius+V[k]*radius),entry=b.map((n,k)=>n-U[k]*radius),start=Math.atan2(entry[2]-center[2],entry[0]-center[0]),path=Array.from({length:9},(_,j)=>[center[0]+Math.cos(start+sign*j*Math.PI/16)*radius,b[1],center[2]+Math.sin(start+sign*j*Math.PI/16)*radius]);return !path.some(v=>obstacles.some(o=>v[0]+.55>o.lo[0]&&v[0]-.55<o.hi[0]&&v[1]+.21>o.lo[1]&&v[1]-.35<o.hi[1]&&v[2]+.55>o.lo[2]&&v[2]-.55<o.hi[2]))&&!p.logistics.edges.filter(e=>e.id!==routeId).some(e=>e.points.slice(1).some((q,k)=>path.slice(1).some((v,j)=>L.segmentsConflict(path[j],v,e.points[k],q,false))))};
  while(r>.6&&!clear(r))r=Math.max(.6,r-.3);
  const center=b.map((n,k)=>n-U[k]*r+V[k]*r),entry=b.map((n,k)=>n-U[k]*r),exit=b.map((n,k)=>n+V[k]*r);
  ends[i]=entry;starts[i]=exit;
  const start=Math.atan2(entry[2]-center[2],entry[0]-center[0]);
  const at=(t,rad,y)=>[center[0]+Math.cos(start+sign*t*Math.PI/2)*rad,y,center[2]+Math.sin(start+sign*t*Math.PI/2)*rad];
  bends[i]=Array.from({length:9},(_,j)=>at(j/8,r,b[1]));
  function strip(inner,outer,low,high,col){for(let j=0;j<8;j++){const t=j/8,s=(j+1)/8;face([at(t,inner,high),at(s,inner,high),at(s,outer,high),at(t,outer,high)],col);face([at(t,inner,low),at(s,inner,low),at(s,inner,high),at(t,inner,high)],'#536067');face([at(t,outer,high),at(s,outer,high),at(s,outer,low),at(t,outer,low)],'#69757b');face([at(t,outer,low),at(s,outer,low),at(s,inner,low),at(t,inner,low)],'#30383d')}}
  strip(Math.max(.01,r-.55),r+.55,b[1]-.35,b[1],'#34424e');
  strip(Math.max(.01,r-.42),r+.42,b[1]+.005,b[1]+.09,'#454d50');
  strip(Math.max(.01,r-.53),Math.max(.02,r-.43),b[1]+.05,b[1]+.21,'#a7b0b2');strip(r+.43,r+.53,b[1]+.05,b[1]+.21,'#a7b0b2');
 }
 for(let i=1;i<points.length;i++)belt(starts[i-1],ends[i],color);routeDepth--;
 if(!cached){const path=[starts[0]];for(let i=1;i<points.length;i++){path.push(ends[i]);if(bends[i])path.push(...bends[i].slice(1))}travelPaths[routeId]=path}
}
if(!cached){
floorGeometry=true;
for(let f=0;f<floorCount;f++){
if(floor!=='all'&&+floor!==f)continue;
const y=displayBase(f);
if(p.modulePlacements){for(const [i,t] of p.modulePlacements.entries()){if(t.floors&&!t.floors.some(s=>Math.abs(s.y-y)<1e-6))continue;box(t.x,y-.55,t.z,t.w,.5,t.d,i%2?'#60757c':'#6a7e83');for(const z of [t.z,t.z+t.d-.15])box(t.x,y-.02,z,t.w,.1,.15,'#a2b8bf');for(const x of [t.x,t.x+t.w-.15])box(x,y-.02,t.z,.15,.1,t.d,'#a2b8bf');if(floor!=='all'||f===0)labels.push({v:[t.x+t.w/2,y+1,t.z+t.d],text:'Модуль '+(i+1)+(t.label?' · '+t.label:''),color:'#c0dedc',module:true,moduleCorners:[[t.x,y,t.z],[t.x+t.w,y,t.z],[t.x+t.w,y,t.z+t.d],[t.x,y,t.z+t.d]]})}continue}
if(realistic&&floor==='all'&&f===0){for(let x=0;x<p.width;x+=8)for(let z=0;z<p.length;z+=8)box(x,y-.55,z,Math.min(8,p.width-x)-.06,.5,Math.min(8,p.length-z)-.06,(x/8+z/8)%2?'#677477':'#707c7e');}
if(floor!=='all'){
box(0,y-.6,0,p.width,.6,p.length,'#283741');
for(let x=0;x<p.width;x+=8)for(let z=0;z<p.length;z+=8)face([[x,y+.01,z],[Math.min(x+8,p.width),y+.01,z],[Math.min(x+8,p.width),y+.01,Math.min(z+8,p.length)],[x,y+.01,Math.min(z+8,p.length)]],(x/8+z/8)%2?'#30414b':'#344650');
}else{
// Light slabs indicate the storeys without hiding the equipment below.
box(0,y-.35,0,p.width,.3,p.length,'#587078');
for(let x=0;x<=p.width;x+=8)face([[x-.14,y,0],[x+.14,y,0],[x+.14,y,p.length],[x-.14,y,p.length]],'#587887');
for(let z=0;z<=p.length;z+=8)face([[0,y,z-.14],[p.width,y,z-.14],[p.width,y,z+.14],[0,y,z+.14]],'#587887');
box(0,y-.1,0,p.width,.15,.2,'#748b96');box(0,y-.1,p.length-.2,p.width,.15,.2,'#748b96');box(0,y-.1,0,.2,.15,p.length,'#748b96');box(p.width-.2,y-.1,0,.2,.15,p.length,'#748b96');
}
labels.push({v:[0,y,p.length],text:`ЭТАЖ ${f+1}`,color:'#bacbd3'});
}
if(p.bounds&&!p.modulePlacements){const h=p.bounds.height,c='#69808a';for(const x of [0,p.width-.12])for(const z of [0,p.length-.12])box(x,0,z,.12,h,.12,c);for(const y of [0,h-.12]){box(0,y,0,p.width,.12,.12,c);box(0,y,p.length-.12,p.width,.12,.12,c);box(0,y,0,.12,.12,p.length,c);box(p.width-.12,y,0,.12,.12,p.length,c)}labels.push({v:[p.width/2,h+1,p.length],text:'ГРАНИЦЫ · '+p.width+'×'+p.length+'×'+p.bounds.height+' м',color:'#9eb1bb'})}
floorGeometry=false;
const ports=new Map();
for(const worldMachine of visible){const m={...worldMachine,...L.localDimensions(worldMachine),rotation:0},labelStart=labels.length;modelTransform=v=>L.machinePoint(worldMachine,[v[0]-m.x,v[1],v[2]-m.z]);const {x,z,w,d,h}=m,y=displayBase(m.floor),c=FactoryPlanner.buildings[m.b].color,id=m.id;
if(!realistic){box(x,y,z,w,.65,d,'#56636c',id);box(x+.4,y+.65,z+1,w-.8,1.3,d-2,'#26333d',id)}
if(realistic&&globalThis.FactoryModels){FactoryModels.machine({...m,recipe:FactoryPlanner.recipesFor(p.config)[m.group]},y,{box,face})}
else if(m.b==='smelter'||m.b==='foundry'){box(x+w*.16,y+2,z+d*.25,w*.68,h*.55,d*.5,c,id);box(x+w*.24,y+h*.7,z+d*.35,w*.52,1,d*.3,'#444f57',id);box(x+w*.65,y+h*.7,z+d*.5,1,h*.3,1,'#79838b',id);box(x+w*.25,y+2.7,z+d*.24,w*.5,1.8,.15,'#ffba66',id);if(m.b==='foundry')box(x+.6,y+2,z+d*.35,1.4,h*.72,2,'#626d75',id)}
else{box(x+w*.22,y+2,z+d*.26,w*.56,2,d*.48,c,id);for(const sx of [.12,.8]){box(x+w*sx,y+2,z+d*.27,.65,h-2,d*.48,'#64727b',id)}box(x+w*.1,y+h-1,z+d*.29,w*.8,.7,d*.42,c,id);box(x+w*.4,y+4,z+d*.4,w*.2,Math.max(1,h-5),d*.18,'#293b47',id);if(m.b==='assembler'){box(x+w*.27,y+3,z+d*.3,1.4,2.5,2,'#9eb3c4',id);box(x+w*.57,y+3,z+d*.56,1.4,2.5,2,'#9eb3c4',id)}}
const inputs=Object.keys(FactoryPlanner.recipesFor(p.config)[m.group].ins).map((item,i,arr)=>({item,v:[x+w*(i+1)/(arr.length+1),y+1.2,z]})),outputs=Object.keys(FactoryPlanner.outputs(FactoryPlanner.recipesFor(p.config)[m.group],m.group)).map((item,i,arr)=>({item,v:[x+w*(i+1)/(arr.length+1),y+1.2,z+d]}));ports.set(id,{inputs,outputs});
for(const port of inputs){box(port.v[0]-.6,y+.65,z-.35,1.2,1.2,.65,realistic?'#9aa5a9':'#50dfb0',id);if(realistic){box(port.v[0]-.45,y+.8,z-.36,.9,.85,.08,'#182126',id);box(port.v[0]-.18,y+1.7,z-.37,.36,.12,.1,'#7dd599',id)}labels.push({v:[port.v[0],y+2.8,z-.8],text:'↓ ВХОД '+(inputs.indexOf(port)+1),selectedText:'↓ ВХОД · '+FactoryPlanner.items[port.item],color:'#50dfb0',id,io:true})}
for(const {item,v:out} of outputs){box(out[0]-.6,y+.65,z+d-.2,1.2,1.2,.65,realistic?'#9aa5a9':'#ffba66',id);if(realistic){box(out[0]-.45,y+.8,z+d+.4,.9,.85,.08,'#182126',id);box(out[0]-.18,y+1.7,z+d+.41,.36,.12,.1,'#e78d35',id)}labels.push({v:[out[0],y+2.8,z+d+.8],text:'ВЫХОД ↑',selectedText:'ВЫХОД · '+FactoryPlanner.items[item]+' ↑',color:'#ffba66',id,io:true});}
labels.push({v:[x+w/2,y+h+1,z+d/2],text:`#${id+1} ${FactoryPlanner.items[m.group]}`,color:selected===id?'#ffffff':'#d9e3e9',id});for(let i=labelStart;i<labels.length;i++)labels[i].v=modelTransform(labels[i].v);modelTransform=null}
const shown=e=>flow==='all'||e.item===flow;
const connected=new Set(p.logistics.edges.flatMap(e=>[e.from,e.to]));

for(const n of p.logistics.nodes){if(!shown(n)||(floor!=='all'&&n.floor!==+floor))continue;junction=n.id;const [x,Y,z]=n.point,y=displayY(Y),color=p.logistics.colors[n.item];if(n.transport==='pipe'){for(const port of [...(n.type==='splitter'?[n.ports.input]:n.ports.inputs),...(n.type==='splitter'?n.ports.outputs:[n.ports.output])])if(connected.has(port))tube(n.point,port.point,color)}else if(realistic&&globalThis.FactoryModels)FactoryModels.junction(n,y,{box,face});else{box(x-2,y-.7,z-2,4,L.rules.nodeHeight-.18,4,n.type==='splitter'?'#456b64':'#76614a');box(x-1.6,y+2.12,z-1.6,3.2,.18,3.2,color)}const inputs=n.type==='splitter'?[n.ports.input]:n.ports.inputs,outputs=n.type==='splitter'?n.ports.outputs:[n.ports.output];for(const port of inputs){if(!connected.has(port))continue;const v=port.point.map((value,k)=>value-port.dir[k]*.3);box(v[0]-.3,displayY(v[1])-.3,v[2]-.3,.6,.6,.6,'#50dfb0')}for(const port of outputs){if(!connected.has(port))continue;const v=port.point.map((value,k)=>value-port.dir[k]*.3);box(v[0]-.3,displayY(v[1])-.3,v[2]-.3,.6,.6,.6,'#ffba66')}labels.push({v:[x,y+3,z],text:(n.type==='splitter'?'Р':'О')+(n.id+1)+' · '+FactoryPlanner.items[n.item],color,detail:true,id:p.machines.length+n.id});for(const [isInput,ports] of [[true,inputs],[false,outputs]])for(const [i,port] of ports.entries()){if(!connected.has(port))continue;labels.push({v:[port.point[0],displayY(port.point[1])+2.8,port.point[2]],text:(isInput?'↓ ВХОД ':'ВЫХОД ↑ ')+(i+1),color:isInput?'#50dfb0':'#ffba66',id:p.machines.length+n.id,io:true,selectedOnly:true})}junction=null}
for(const e of p.logistics.edges){if(!shown(e))continue;const sourceFloor=L.floorAt(p,e.from.point[1]),targetFloor=L.floorAt(p,e.to.point[1]);if(floor!=='all'&&sourceFloor!==+floor&&targetFloor!==+floor)continue;routeId=e.id;const pts=e.points.map(v=>[v[0],displayY(v[1]),v[2]]);if(!realistic){for(let i=1;i<pts.length;i++)tube(pts[i-1],pts[i],e.color);routes.push(pts)}else if(e.kind==='pipe'){pipeline(pts,e.color);for(const pump of e.pumps??[]){const [X,Y,Z]=pump.point;box(X-.7,Y-.6,Z-.7,1.4,1.2,1.4,'#e78d35')}}else route(pts,e.color);for(const ep of [e.from,e.to])if(ep.kind){const [x,Y,z]=ep.point,y=displayY(Y),dx=ep.dir[0],dz=ep.dir[2];box(x-dx*1.4-.7,y-.7,z-dz*1.4-.7,1.4,2,1.4,'#465864');box(x-dx*1.4-.55,y+1.3,z-dz*1.4-.55,1.1,.15,1.1,e.color);labels.push({v:[x,y+3,z],text:(ep.kind==='import'?'ВХОД · ':'ВЫХОД · ')+FactoryPlanner.items[e.item],color:e.color,edgeId:e.id})}if(flow!=='all')labels.push({v:pts[Math.floor(pts.length/2)],text:FactoryPlanner.items[e.item]+' · '+Math.round(e.rate)+' / мин',color:e.color,detail:true,edgeId:e.id})}
routeId=null;
floorsCache.set(cacheKey,{faces,labels,arrows,routes,liftPositions,travelPaths,floorOpacity:floor==='all'?.2:1,audit:FactoryLogistics.audit(p.logistics.routes??p.logistics.edges.map(e=>e.points),p.logistics.liftPositions??[],p.logistics.clearance)});
}
const mesh=floorsCache.get(cacheKey);
// Project hidden pipe sections through the slabs using the same orthographic camera ray.
const floorRects=p.modulePlacements??[{x:0,z:0,w:p.width,d:p.length}],slabs=p.modulePlacements?p.modulePlacements.flatMap(r=>(r.floors??p.floors).filter(f=>floor==='all'||Math.abs(f.y-displayBase(+floor))<1e-6).map(f=>({...f,rect:r}))):p.floors.filter(f=>floor==='all'||f.index===+floor);
function hiddenByFloor(point){for(const slab of slabs){const dy=slab.y-point[1];if(dy<=.06)continue;const X=point[0]+dy*Math.sin(angle)*Math.tan(tilt),Z=point[2]+dy*Math.cos(angle)*Math.tan(tilt);if((slab.rect?[slab.rect]:floorRects).some(r=>X>=r.x&&X<=r.x+r.w&&Z>=r.z&&Z<=r.z+r.d))return true}return false}

if(simulation){if(!realistic)for(const edge of p.logistics.edges)simulation.setPath(moduleIndex,edge.id,edge.points);for(const [id,path] of Object.entries(mesh.travelPaths))simulation.setPath(moduleIndex,+id,path);dynamic=true;for(const particle of simulation.particles(moduleIndex)){if(flow!=='all'&&particle.item!==flow||floor!=='all'&&L.floorAt(p,particle.point[1])!==+floor)continue;if(p.modulePlacements&&particle.fluid&&hiddenByFloor(particle.point))continue;const [x,y,z]=particle.point,color=p.logistics.colors[particle.item]??'#d5c69f',id=-3-particle.edgeId;
if(!realistic){const vector=particle.direction??[1,0,0],size=Math.hypot(...vector)||1,t=vector.map(v=>v/size);routeId=particle.edgeId;tube([x,y,z].map((v,k)=>v-t[k]*.4),[x,y,z].map((v,k)=>v+t[k]*.4),'#fff3a6');routeId=null}
else if(particle.fluid){
 // Moving bands wrap horizontal and vertical pipes instead of displaying belt cargo.
 const vector=particle.direction??[1,0,0],length=Math.hypot(...vector)||1,t=vector.map(v=>v/length),reference=Math.abs(t[1])<.9?[0,1,0]:[1,0,0],cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],normal=cross(t,reference),size=Math.hypot(...normal)||1,u=normal.map(v=>v/size),v=cross(t,u);
 const ring=(angle,offset)=>[x,y,z].map((n,k)=>n+t[k]*offset+.49*(u[k]*Math.cos(angle)+v[k]*Math.sin(angle)));
 const A=Array.from({length:8},(_,i)=>ring(i*Math.PI/4,-.12)),B=Array.from({length:8},(_,i)=>ring(i*Math.PI/4,.12));for(let i=0;i<8;i++)face([A[i],A[(i+1)%8],B[(i+1)%8],B[i]],color,id)
}else box(x-.22,y+.12,z-.22,.44,.36,.44,color,id)}dynamic=false}
if(globalThis.document){const panel=document.getElementById('route-audit');if(panel&&panel._auditMesh!==mesh){const counts={};for(const i of mesh.audit)counts[i.message]=(counts[i.message]||0)+1;panel.textContent='Расчёт потоков учитывает лимит ленты и каждого порта. Схема коллекторов требует заполнения перед выходом на полный выпуск. Геометрия — черновик: '+Object.entries(counts).map(([m,n])=>m+' ('+n+')').join('; ')+(p.logistics.collisionCheck?.valid&&p.logistics.equipmentCheck?.valid?'. Проверены пересечения независимых лент и проходы через корпуса станков, узлов и терминалов.':'. Проверка коллизий этой схемы не завершена.');panel._auditMesh=mesh}}
if(gpu){
if(!mesh.arrowGeometry){for(const [a,b,color,edgeId] of arrows){routeId=edgeId??null;const dx=b[0]-a[0],dz=b[2]-a[2],len=Math.hypot(dx,dz)||1,nx=-dz/len*.18,nz=dx/len*.18;face([[a[0]+nx,a[1]+.1,a[2]+nz],[b[0]+nx,b[1]+.1,b[2]+nz],[b[0]-nx,b[1]+.1,b[2]-nz],[a[0]-nx,a[1]+.1,a[2]-nz]],color);const t=.6;face([[b[0],b[1]+.12,b[2]],[b[0]-dx/len*t+nx*3,b[1]+.12,b[2]-dz/len*t+nz*3],[b[0]-dx/len*t-nx*3,b[1]+.12,b[2]-dz/len*t-nz*3],[b[0],b[1]+.12,b[2]]],color)}routeId=null;mesh.arrowGeometry=true}
// Use the occupied depth interval instead of a large fixed range. This keeps
// thin panels distinguishable in depth buffers at shallow camera angles.
if(!mesh.spatialBounds){const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(const f of faces)for(const v of f.v)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],v[k]);hi[k]=Math.max(hi[k],v[k])}mesh.spatialBounds=[lo,hi]}
if(!mesh.depthRange||mesh.depthRange.angle!==angle||mesh.depthRange.tilt!==tilt||mesh.depthRange.base!==base){let value=1;const [lo,hi]=mesh.spatialBounds;for(const x of [lo[0],hi[0]])for(const y of [lo[1],hi[1]])for(const z of [lo[2],hi[2]])value=Math.max(value,Math.abs(project([x,y,z]).depth));mesh.depthRange={angle,tilt,base,value:value+2}}
const kx=2*scale/W,ky=2*scale/H,range=mesh.depthRange.value;
const transform=new Float32Array([kx*cosA,-ky*sinA*cosT,-sinA*sinT/range,0, 0,ky*sinT,-cosT/range,0, -kx*sinA,-ky*cosA*cosT,-cosA*sinT/range,0, 2*panX/W-kx*(p.width/2*cosA-p.length/2*sinA),1-2*(H*.65+panY)/H+ky*(p.width/2*sinA*cosT+p.length/2*cosA*cosT-base*sinT),(p.width/2*sinA*sinT+p.length/2*cosA*sinT+base*cosT)/range,1]);
gpu.draw(mesh,transform,selected,pixelW,pixelH,selectedPaths.map(v=>-3-v.edge.id),particleFaces,p.modulePlacements&&floor==='all'?{paths:p.logistics.edges.filter(e=>e.interModule&&e.kind==='pipe').map(e=>-3-e.id),floor:Math.min(...slabs.map(s=>s.y)),rects:floorRects,ray:[sinA*Math.tan(tilt),cosA*Math.tan(tilt)]}:null);
}
/* Exact triangle hit tests use interpolated depth, including non-machine occluders. */
const pickSurface=(x,y,includeFloor=false)=>{let depth=Infinity,id=null,point=null;for(const f of faces){if(f.backdrop&&!includeFloor)continue;const pts=f.v.map(project);for(const ids of [[0,1,2],[0,2,3]]){const [a,b,c]=ids.map(i=>pts[i]),den=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);if(Math.abs(den)<1e-8)continue;const u=((b.y-c.y)*(x-c.x)+(c.x-b.x)*(y-c.y))/den,v=((c.y-a.y)*(x-c.x)+(a.x-c.x)*(y-c.y))/den,w=1-u-v;if(u<0||v<0||w<0)continue;const d=u*a.depth+v*b.depth+w*c.depth;if(d<depth){depth=d;id=f.id;point=[0,1,2].map(k=>u*f.v[ids[0]][k]+v*f.v[ids[1]][k]+w*f.v[ids[2]][k])}}}return point?{id,point}:null};
globalThis.FactoryScene.pick=(x,y)=>pickSurface(x,y)?.id??null;globalThis.FactoryScene.pickSurface=(x,y)=>pickSurface(x,y,true)?.point??null;
for(const m of visible){const pts=[[m.x,displayBase(m.floor),m.z],[m.x+m.w,displayBase(m.floor)+m.h,m.z+m.d],[m.x,displayBase(m.floor)+m.h,m.z+m.d],[m.x+m.w,displayBase(m.floor),m.z]].map(project);hits.set(m.id,{id:m.id,minx:Math.min(...pts.map(v=>v.x)),maxx:Math.max(...pts.map(v=>v.x)),miny:Math.min(...pts.map(v=>v.y)),maxy:Math.max(...pts.map(v=>v.y))})}
ctx.save();ctx.setLineDash([6,5]);ctx.lineWidth=2;ctx.lineCap='round';ctx.globalAlpha=.85;
for(const edge of p.logistics.edges){if(edge.kind!=='pipe'||flow!=='all'&&edge.item!==flow)continue;if(floor!=='all'&&L.floorAt(p,edge.from.point[1])!==+floor&&L.floorAt(p,edge.to.point[1])!==+floor)continue;
 const path=mesh.travelPaths[edge.id]??edge.points;ctx.strokeStyle=edge.id===-3-selected?'#fff3a6':edge.color??'#9dd9e5';ctx.beginPath();let drawing=false;
 for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],length=Math.hypot(...b.map((v,k)=>v-a[k])),steps=Math.max(1,Math.ceil(length/.4));for(let j=0;j<steps;j++){const A=a.map((v,k)=>v+(b[k]-v)*j/steps),B=a.map((v,k)=>v+(b[k]-v)*(j+1)/steps),mid=A.map((v,k)=>(v+B[k])/2);if(hiddenByFloor(mid)){const v=project(A),w=project(B);if(!drawing)ctx.moveTo(v.x,v.y);ctx.lineTo(w.x,w.y);drawing=true}else drawing=false}}
 ctx.stroke();
}ctx.restore();
if(simulation){const bridges=new Set(p.logistics.edges.filter(e=>e.interModule).map(e=>e.id));for(const particle of simulation.particles(moduleIndex)){if(!(particle.fluid&&p.modulePlacements)&&!bridges.has(particle.edgeId)||flow!=='all'&&flow!==particle.item||floor!=='all'&&L.floorAt(p,particle.point[1])!==+floor||!hiddenByFloor(particle.point))continue;const v=project(particle.point);ctx.save();ctx.fillStyle=particle.fluid?'#73dcff':'#ffd27c';ctx.beginPath();ctx.arc(v.x,v.y,particle.fluid?2:3,0,Math.PI*2);ctx.fill();ctx.restore()}}
// Highlight full I/O routes of the selected building, including hidden sections.
const highlights=selected!==null&&selected<=-3?p.logistics.edges.filter(e=>e.id===-3-selected).map(edge=>({edge,color:'#fff3a6'})):selectedPaths.map(v=>({...v,color:v.input?'#50dfb0':'#ffba66'}));
for(const {edge,color} of highlights){ctx.save();ctx.lineJoin='round';ctx.lineCap='round';ctx.setLineDash([5,4]);ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.globalAlpha=.85;
 const low=floor==='all'?-Infinity:displayBase(+floor),high=floor==='all'?Infinity:p.floors?.[+floor+1]?.y??p.bounds?.height??low+16;
 for(let i=1;i<edge.points.length;i++){const a=edge.points[i-1],b=edge.points[i],dy=b[1]-a[1];let t0=0,t1=1;if(Math.abs(dy)<1e-8){if(a[1]<low||a[1]>high)continue}else{const tA=(low-a[1])/dy,tB=(high-a[1])/dy;t0=Math.max(0,Math.min(tA,tB));t1=Math.min(1,Math.max(tA,tB));if(t0>t1)continue}const A=project(a.map((v,k)=>v+(b[k]-v)*t0)),B=project(a.map((v,k)=>v+(b[k]-v)*t1));ctx.beginPath();ctx.moveTo(A.x,A.y);ctx.lineTo(B.x,B.y);ctx.stroke()}
 ctx.setLineDash([]);ctx.globalAlpha=1;for(const [i,point] of [edge.points[0],edge.points.at(-1)].entries()){if(point[1]<low||point[1]>high)continue;const v=project(point);ctx.beginPath();ctx.arc(v.x,v.y,5,0,Math.PI*2);ctx.fillStyle=i?'#ffba66':'#50dfb0';ctx.fill();ctx.strokeStyle='#102027';ctx.lineWidth=1;ctx.stroke()}ctx.restore()}

if(selected!==null&&selected>=0){
 // Union of projected model faces preserves recesses between towers and pipes.
 const polygons=faces.filter(f=>f.id===selected).map(f=>f.v.map(project));
 if(polygons.length){
  const points=polygons.flat(),padding=4,left=Math.floor(Math.min(...points.map(v=>v.x)))-padding,top=Math.floor(Math.min(...points.map(v=>v.y)))-padding,width=Math.ceil(Math.max(...points.map(v=>v.x)))-left+padding,height=Math.ceil(Math.max(...points.map(v=>v.y)))-top+padding;
  const create=()=>typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(1,1):globalThis.document?.createElement('canvas');
  let buffers=outlineCache.get(canvas);if(!buffers){const mask=create(),border=create();if(mask&&border){buffers={mask,border};outlineCache.set(canvas,buffers)}}
  if(buffers){const {mask,border}=buffers;for(const surface of [mask,border]){if(surface.width!==width||surface.height!==height){surface.width=width;surface.height=height}}
   const m=mask.getContext('2d'),b=border.getContext('2d');m.clearRect(0,0,width,height);m.fillStyle='#fff3a6';
   for(const polygon of polygons){m.beginPath();for(const [i,v] of polygon.entries())i?m.lineTo(v.x-left,v.y-top):m.moveTo(v.x-left,v.y-top);m.closePath();m.fill()}
   b.clearRect(0,0,width,height);b.globalCompositeOperation='source-over';for(let i=0;i<16;i++){const a=i*Math.PI/8;b.drawImage(mask,Math.cos(a)*1.5,Math.sin(a)*1.5)}
   b.globalCompositeOperation='destination-out';b.drawImage(mask,0,0);b.globalCompositeOperation='source-over';ctx.drawImage(border,left,top);
  }
 }
}
// Labels are laid out last so the x-ray paths cannot paint over their text.
const occupiedLabels=[],hasSelection=selected!==null&&selected!==undefined,routeIds=new Set(highlights.map(v=>v.edge.id));
const visibleIds=new Set(visible.map(m=>m.id)),simulationLabels=simulation?simulation.modules[moduleIndex].machines.filter(s=>visibleIds.has(s.m.id)).map(s=>{const state=FactorySimulation.machineStatus(s),m=s.m,busy=Math.round(FactorySimulation.utilization(s)*100);return {v:[m.x+m.w/2,displayBase(m.floor)+m.h+1,m.z+m.d/2],text:'#'+(m.id+1)+' · '+(state.status==='crafting'?'Крафт '+Math.floor(state.progress*100)+'%':state.status==='blocked'?'Простой: выход заполнен':'Простой: нет ингредиентов')+' · занятость '+busy+'%',color:state.status==='crafting'?'#80e4b5':'#ffba66',id:m.id,simulation:true,...state}}):[];
const frameLabels=[...labels.filter(l=>!simulation||l.io||l.id===undefined||l.id>=p.machines.length),...simulationLabels];
for(const l of frameLabels.sort((a,b)=>Number(!!b.module)-Number(!!a.module)||Number(b.id===selected)-Number(a.id===selected)||Number(!!b.simulation)-Number(!!a.simulation)||Number(!!b.io)-Number(!!a.io))){
 const selectedLabel=(selected!==null&&selected!==undefined&&l.id===selected)||(l.edgeId!==undefined&&routeIds.has(l.edgeId));
 const nodeLabel=l.id!==undefined&&l.id>=p.machines.length?p.logistics.nodes.find(n=>p.machines.length+n.id===l.id):null,category=l.io||l.edgeId!==undefined&&/ВХОД|ВЫХОД/.test(l.text)?(/ВХОД/.test(l.text)?'inputs':'outputs'):nodeLabel?(nodeLabel.type==='splitter'?'splitters':'mergers'):l.id!==undefined||l.detail?'products':'references';
 if(labelOptions[category]===false&&!selectedLabel&&!l.simulation&&!l.module)continue;
 if(l.selectedOnly&&l.id!==selected)continue;
 if(hasSelection&&((l.id!==undefined&&l.id!==selected)||(l.detail&&l.id!==selected)||(l.edgeId!==undefined&&!routeIds.has(l.edgeId))))continue;
 if(!l.simulation&&!l.io&&(l.detail||l.id!==undefined)&&scale<3&&l.id!==selected)continue;
 const text=l.id===selected?(l.selectedText||l.text):l.text,v=project(l.v);ctx.font=l.module?'bold 12px Arial':'11px Arial';const tw=ctx.measureText(text).width,w=tw+12,h=l.simulation?27:21;
 if(l.moduleCorners){const corners=l.moduleCorners.map(project);v.x=(Math.min(...corners.map(p=>p.x))+Math.max(...corners.map(p=>p.x)))/2;v.y=Math.max(...corners.map(p=>p.y))+22;}
 v.x=Math.max(w/2+8,Math.min(W-w/2-8,v.x));v.y=Math.max(125,Math.min(H-75,v.y));let position=null;for(const [dx,dy] of (l.module?[[0,0],[0,25],[0,50]]:[[0,0],[0,-25],[0,25],[w/2+10,0],[-w/2-10,0],[0,-50],[0,50]])){const x=v.x+dx-w/2,y=v.y+dy-15,rect={x,y,w,h};if(x<8||y<110||x+w>W-8||y+h>H-65)continue;if(occupiedLabels.some(r=>x<r.x+r.w+5&&x+w+5>r.x&&y<r.y+r.h+4&&y+h+4>r.y))continue;position=rect;break}if(!position)continue;
 occupiedLabels.push(position);const x=position.x+w/2,y=position.y+15;if(l.io&&(Math.abs(x-v.x)>1||Math.abs(y-v.y)>1)){ctx.beginPath();ctx.moveTo(v.x,v.y);ctx.lineTo(x,y);ctx.strokeStyle=l.color;ctx.lineWidth=1;ctx.stroke()}
 ctx.fillStyle='#15212bf5';ctx.fillRect(position.x,position.y,w,h);ctx.fillStyle=l.io?l.color:l.id===selected?'#ffffff':l.color;ctx.textAlign='center';ctx.fillText(text,x,y);ctx.textAlign='left';
 if(l.simulation){ctx.fillStyle='#40515b';ctx.fillRect(position.x+4,position.y+h-6,w-8,3);ctx.fillStyle=l.color;ctx.fillRect(position.x+4,position.y+h-6,(w-8)*l.progress,3)}
}
onHits([...hits.values()]);
}};
