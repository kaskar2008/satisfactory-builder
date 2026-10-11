(function(root){
function pair(points){const [a,b]=points;return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,d:Math.hypot(a.x-b.x,a.y-b.y)}}
function bind(element,{enabled=()=>true,drag,pinch,tap}){
 const points=new Map();let moved=false,start=null,previous=null;
 const stop=e=>{e.preventDefault();e.stopImmediatePropagation()};
 element.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch'||!enabled())return;stop(e);if(!points.size){moved=false;start={x:e.clientX,y:e.clientY,target:e.target}}points.set(e.pointerId,{x:e.clientX,y:e.clientY});if(points.size>1)moved=true;previous=points.size===2?pair([...points.values()]):null;element.setPointerCapture(e.pointerId)},{capture:true});
 element.addEventListener('pointermove',e=>{if(!points.has(e.pointerId))return;stop(e);const old=points.get(e.pointerId);points.set(e.pointerId,{x:e.clientX,y:e.clientY});if(Math.hypot(e.clientX-start.x,e.clientY-start.y)>6)moved=true;if(points.size===2){const next=pair([...points.values()]);if(previous&&previous.d>0)pinch(next.d/previous.d,next.x,next.y,next.x-previous.x,next.y-previous.y);previous=next}else if(points.size===1&&moved)drag(e.clientX-old.x,e.clientY-old.y)}, {capture:true});
 const end=e=>{if(!points.has(e.pointerId))return;stop(e);points.delete(e.pointerId);if(!points.size&&e.type==='pointerup'&&!moved)tap(e.clientX,e.clientY,start.target);previous=points.size===2?pair([...points.values()]):null;if(element.hasPointerCapture(e.pointerId))element.releasePointerCapture(e.pointerId)};
 element.addEventListener('pointerup',end,{capture:true});element.addEventListener('pointercancel',end,{capture:true});element.addEventListener('lostpointercapture',e=>{points.delete(e.pointerId);previous=null},{capture:true});element.addEventListener('click',e=>{if(e.pointerType==='touch')stop(e)},{capture:true});
}
root.FactoryTouch={bind,pair};if(typeof module!=='undefined')module.exports=root.FactoryTouch;
})(globalThis);
