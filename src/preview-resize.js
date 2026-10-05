const storageKey='vrm-editor-preview-width-v1',ratio=16/9;
export function createPreviewResizer(center){
 const frame=center.querySelector('.stage-frame');let preference=0,drag=null,raf=0;
 try{const value=Number(localStorage.getItem(storageKey));if(Number.isFinite(value)&&value>=160)preference=value;}catch{}
 const handles=[];
 const move=event=>{if(!drag||drag.id!==event.pointerId)return;event.preventDefault();event.stopPropagation();const dx=event.clientX-drag.x,dy=(event.clientY-drag.y)*ratio,change=drag.kind==='right'?dx:drag.kind==='bottom'?dy:Math.abs(dx)>Math.abs(dy)?dx:dy,limit=limits();preference=Math.max(limit.min,Math.min(limit.max,drag.width+change));apply();};
 const finish=event=>{if(!drag||drag.id!==event.pointerId)return;event.stopPropagation();const node=drag.node;drag=null;center.classList.remove('preview-resizing');persist();if(node.hasPointerCapture(event.pointerId))node.releasePointerCapture(event.pointerId);};
 document.addEventListener('pointermove',move);document.addEventListener('pointerup',finish);document.addEventListener('pointercancel',finish);
 for(const [kind,label]of[['right','拖动右边调整预览大小，固定16比9'],['bottom','拖动底边调整预览大小，固定16比9'],['corner','拖动右下角调整预览大小，固定16比9；双击恢复默认']]){
  const node=document.createElement('button');node.type='button';node.className='preview-resize-handle preview-resize-'+kind;node.dataset.previewResize=kind;node.setAttribute('aria-label',label);node.title=label;if(kind==='corner')node.innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 17L17 6M11 17L17 11M16 17L17 16"/></svg>';frame.append(node);handles.push(node);
 }
 function limits(){const css=getComputedStyle(center),height=center.clientHeight-parseFloat(css.paddingTop)-parseFloat(css.paddingBottom),width=center.clientWidth-parseFloat(css.paddingLeft)-parseFloat(css.paddingRight);const max=Math.max(160,Math.min(width,Math.max(160,height-400)*ratio));return {max,min:Math.min(320,max),defaultWidth:Math.min(max,960,height*.5*ratio)};}
 function apply(){const limit=limits(),width=Math.max(limit.min,Math.min(limit.max,preference||limit.defaultWidth));frame.style.width=width+'px';frame.style.height=width/ratio+'px';frame.dataset.previewWidth=String(Math.round(width));}
 function persist(){try{preference?localStorage.setItem(storageKey,String(preference)):localStorage.removeItem(storageKey);}catch{}}
 const schedule=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(apply);};
 const observer=new ResizeObserver(schedule);observer.observe(center);apply();
 for(const node of handles){
  if(new URLSearchParams(location.search).has('smoke'))for(const type of ['pointerdown','pointermove','pointerup','lostpointercapture'])node.addEventListener(type,event=>{window.__previewResizeEvents||=[];window.__previewResizeEvents.push({type,button:event.button,id:event.pointerId,x:event.clientX,y:event.clientY,playing:center.closest('.editor')?.classList.contains('is-playing'),preferred:preference});});
  node.addEventListener('click',event=>event.stopPropagation());
  node.addEventListener('pointerdown',event=>{if(event.button!==0||center.closest('.editor')?.classList.contains('is-playing'))return;event.preventDefault();event.stopPropagation();drag={node,id:event.pointerId,x:event.clientX,y:event.clientY,width:frame.getBoundingClientRect().width,kind:node.dataset.previewResize};try{node.setPointerCapture(event.pointerId);}catch{}center.classList.add('preview-resizing');});
  node.addEventListener('pointermove',move);
  node.addEventListener('pointerup',finish);node.addEventListener('pointercancel',finish);node.addEventListener('lostpointercapture',finish);
  node.addEventListener('dblclick',event=>{event.preventDefault();event.stopPropagation();preference=0;persist();apply();});
  node.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(event.key)){event.preventDefault();event.stopPropagation();if(event.key==='Home')preference=0;else{const step=event.shiftKey?80:16,limit=limits();preference=Math.max(limit.min,Math.min(limit.max,frame.getBoundingClientRect().width+(['ArrowLeft','ArrowUp'].includes(event.key)?-step:step)));}persist();apply();}});
 }
 return {apply,reset(){preference=0;persist();apply();},dispose(){observer.disconnect();cancelAnimationFrame(raf);document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',finish);document.removeEventListener('pointercancel',finish);handles.forEach(node=>node.remove());},get preferredWidth(){return preference;}};
}
