(function(root){
// A deliberately dense render/simulation stress fixture, not a buildable plan.
// It exercises the real models, moving items, junction queues and status labels.
function fixture(width,length,height){
 const P=root.FactoryPlanner,L=root.FactoryLogistics,levels=Math.max(1,Math.floor(height/16)),p={width,length,bounds:{width,length,height},config:{width,length,height,floors:levels,belt:1200,product:'heavyFrame'},fit:{usedFloors:levels},machines:[],groups:[],floors:Array.from({length:levels},(_,index)=>({index,y:index*16,height:16,ceiling:(index+1)*16,equipmentHeight:13})),logistics:{nodes:[],edges:[],routes:[],liftPositions:[],clearance:4,colors:{}}};
 const port=(point,dir,kind)=>({point,dir,...(kind?{kind}:{})}),edge=(from,to,item,rate,points)=>{const e={id:p.logistics.edges.length,from,to,item,rate,points:points??[from.point,to.point],color:'#7fcac0'};p.logistics.edges.push(e);p.logistics.routes.push(e.points);p.logistics.colors[item]='#7fcac0'};
 for(let f=0;f<levels;f++)for(let z=0;z+32<=length;z+=32)for(let x=0;x+24<=width;x+=24){if(p.machines.length>=600)continue;
  const group=p.machines.length%3===0?'heavyFrame':p.machines.length%3===1?'rotor':'screw',r=P.recipes[group],b=P.buildings[r.b],m={...b,id:p.machines.length,b:r.b,group,x:x+2,z:z+6,y:f*16,floor:f,clock:2.5};p.machines.push(m);
  const ports=L.machinePorts(p,m,P.recipes);for(const input of ports.inputs){const from=port([input.point[0],input.point[1],z+1],[0,0,1],'import');edge(from,input,input.item,input.rate)}
  const to=port([ports.output.point[0],ports.output.point[1],z+30],[0,0,-1],'export');edge(ports.output,to,group,ports.output.rate);
  // Independent live splitter/merger loop adds routing and queue work.
  const y=f*16+8,X=x+21,A=z+9,B=z+22;
  const s={id:p.logistics.nodes.length,type:'splitter',item:'steel',floor:f,point:[X,y,A],ports:{input:port([X,y,A-2],[0,0,-1]),outputs:[port([X-2,y,A],[-1,0,0]),port([X,y,A+2],[0,0,1]),port([X+2,y,A],[1,0,0])]}};p.logistics.nodes.push(s);
  const n={id:p.logistics.nodes.length,type:'merger',item:'steel',floor:f,point:[X,y,B],ports:{output:port([X,y,B+2],[0,0,1]),inputs:[port([X-2,y,B],[-1,0,0]),port([X,y,B-2],[0,0,-1]),port([X+2,y,B],[1,0,0])]}};p.logistics.nodes.push(n);
  edge(port([X,y,z+1],[0,0,1],'import'),s.ports.input,'steel',1200);
  for(let i=0;i<3;i++){const a=s.ports.outputs[i],b=n.ports.inputs[i],sx=a.point[0]+a.dir[0]*2,sz=a.point[2]+a.dir[2]*2,tx=b.point[0]+b.dir[0]*2,tz=b.point[2]+b.dir[2]*2;edge(a,b,'steel',400,[a.point,[sx,y,sz],[tx,y,sz],[tx,y,tz],b.point].filter((v,j,list)=>!j||v.some((n,k)=>n!==list[j-1][k])))}
  edge(n.ports.output,port([X,y,z+30],[0,0,-1],'export'),'steel',1200);
 }
 return p;
}
const api={fixture};root.FactoryPerformanceBenchmark=api;if(typeof module!=='undefined')module.exports=api;
if(!root.document?.getElementById('start'))return;
const canvas=document.getElementById('overlay'),ctx=canvas.getContext('2d'),renderer=FactoryGPU.create(document.getElementById('gpu')),status=document.getElementById('status'),results=document.getElementById('results');
let meshSize=0;const gpu={draw(mesh,...args){meshSize=mesh.faces.length*2;renderer.draw(mesh,...args)}};
function measure(p,seconds=5){return new Promise(resolve=>{const sim=FactorySimulation.create([p]);let warm=0;
 function fill(){sim.advance(2);warm+=2;if(warm<30){setTimeout(fill,0);return}let start,last,intervals=[],costs=[],particles=0,frames=0;
 function frame(now){if(document.hidden){resolve({error:'Проверка остановлена: вкладка скрыта'});return}if(start===undefined){start=now;last=now}const delta=(now-last)/1000,lastNow=performance.now();sim.advance(Math.min(.25,delta));
 FactoryScene.render({canvas,ctx,plan:p,angle:.5+(now-start)/1000*.5,tilt:.55+.15*Math.sin((now-start)/1400),zoom:1,selected:null,floor:'all',onHits(){},gpu,viewStyle:'realistic',simulation:sim});
 if(now-start>1500){intervals.push(now-last);costs.push(performance.now()-lastNow);frames++;particles=Math.max(particles,sim.summary().inTransit)}last=now;
 if(now-start<(seconds+1.5)*1000){requestAnimationFrame(frame);return}const sorted=[...intervals].sort((a,b)=>a-b),average=intervals.reduce((a,b)=>a+b,0)/intervals.length;resolve({width:p.width,length:p.length,height:p.bounds.height,machines:p.machines.length,nodes:p.logistics.nodes.length,belts:p.logistics.edges.length,particles,triangles:meshSize,frames,fps:1000/average,p95:sorted[Math.floor(sorted.length*.95)],slow:intervals.filter(v=>v>20).length/intervals.length,cpu:costs.reduce((a,b)=>a+b,0)/costs.length});}
 requestAnimationFrame(frame);
 }fill();});}
async function run(sizes,seconds=5){const button=document.getElementById('start');button.disabled=true;document.getElementById('boundary').disabled=true;const rows=[];results.innerHTML='<table><thead><tr><th>Объём, м</th><th>Станки / узлы / ленты</th><th>Предметы</th><th>Треугольники</th><th>FPS</th><th>p95 кадра, мс</th><th>Кадры >20 мс</th><th>CPU, мс</th></tr></thead><tbody></tbody></table>';
 for(const size of sizes){status.textContent='Вращение + симуляция · '+size.join('×');const r=await measure(fixture(...size),seconds);if(r.error){status.textContent=r.error;break}rows.push(r);const tr=document.createElement('tr');tr.innerHTML='<td>'+size.join('×')+'</td><td>'+r.machines+' / '+r.nodes+' / '+r.belts+'</td><td>'+r.particles+'</td><td>'+r.triangles+'</td><td>'+r.fps.toFixed(1)+'</td><td>'+r.p95.toFixed(1)+'</td><td>'+(r.slow*100).toFixed(1)+'%</td><td>'+r.cpu.toFixed(1)+'</td>';results.querySelector('tbody').append(tr);results.dataset.measurements=JSON.stringify(rows);
  if(r.fps<59||r.cpu>20)break;
 }
 status.textContent='Проверка завершена · '+rows.length+' сценариев · '+canvas.clientWidth+'×'+canvas.clientHeight+' · DPR '+devicePixelRatio;button.disabled=false;document.getElementById('boundary').disabled=false;
}
document.getElementById('start').onclick=()=>run([[32,32,32],[48,48,48],[64,64,48],[80,80,48],[96,96,48],[112,112,48],[128,128,48],[64,64,96],[96,96,96],[112,112,112],[120,120,120],[128,128,128],[192,192,192],[256,256,256]]);
document.getElementById('boundary').onclick=()=>run([[112,112,112],[120,120,120]],12);
})(globalThis);
