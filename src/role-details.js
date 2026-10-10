import {roleWindow,roleLoadOrder,rolePlacement,unlockedRoles} from './role-queue.js';
import {createDetailIdle} from './detail-idle.js';

export function createRoleDetails(ctx){
 let root=null,viewer=null,roles=[],index=0,wanted=0,serial=0,lifecycle=0,working=false,closed=true,currentId='',ready=Promise.resolve();
 const records=new Map(),settlers=new Map();
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const tick=()=>new Promise(r=>requestAnimationFrame(()=>setTimeout(r,0)));
 const key=role=>'details:'+role.id;
 function text(){
  const role=roles[index];if(!root)return;
  root.querySelector('.role-details-counter').textContent=roles.length?`${index+1} / ${roles.length}`:'0 / 0';
  root.querySelector('[data-role-prev]').disabled=index<=0;root.querySelector('[data-role-next]').disabled=index>=roles.length-1;
  const about=root.querySelector('.role-details-about'),stories=root.querySelector('.role-details-stories');
  if(!role){about.innerHTML='';stories.innerHTML='';return;}
  about.innerHTML=`<small>角色简介</small><h2>${esc(role.name)}</h2>${role.title?`<strong>${esc(role.title)}</strong>`:''}<p>${esc(role.description||'')}</p>`;
  const count=ctx.lineCount(role.id),entries=(role.stories||[]).map((story,i)=>({story,i})).filter(({story})=>story.text?.trim());
  stories.innerHTML=`<h3>角色故事</h3>${entries.length?entries.map(({story,i})=>count>=Math.max(0,Number(story.unlockLines)||0)?`<article><h4>故事 ${i+1}</h4><p>${esc(story.text)}</p></article>`:`<article class="role-story-locked"><h4>故事 ${i+1} · 未解锁</h4><p>阅读这个角色的 ${Math.max(0,Number(story.unlockLines)||0)} 句对白后解锁</p><small>已阅读 ${count} 句</small></article>`).join(''):'<p class="role-no-story">暂时没有角色故事。</p>'}`;
  about.scrollTop=stories.scrollTop=0;
 }
 function status(message){if(root)root.querySelector('.role-details-status').textContent=message;}
 async function display(token){
  if(closed||token!==serial)return;
  // Keep eleven prepared, but animate/draw only the five near the viewport.
  const entries=roleWindow(roles.length,index,2).filter(i=>records.has(roles[i].id)).map(i=>{
   const role=roles[i],model=ctx.asset(role.modelId),motion=ctx.idleMotion(role);
   return {actorKey:key(role),modelAsset:model,motionAsset:motion,motionOptions:{loop:true,placement:'inPlace',feet:'lock'},position:'center',transform:rolePlacement(i-index),expressionWeights:{},props:role.props||[],visiblePropIds:(role.props||[]).map(p=>p.id),assets:ctx.project().assets};
  });
  await viewer.showCast(entries,null,true);
  if(closed||token!==serial)return;
  for(const entry of entries)viewer.dimRecord(records.get(entry.actorKey.slice(8)),entry.actorKey===key(roles[index])?1:.68);
  const role=roles[index],photo=root.querySelector('.role-details-photo');
  const portrait=role&&!ctx.asset(role.modelId)&&ctx.asset(role.portraitId);
  photo.hidden=!portrait;if(portrait)photo.src=ctx.url(portrait);
  const missing=root.querySelector('.role-details-empty');missing.hidden=Boolean(role&&(ctx.asset(role.modelId)||portrait));
  missing.textContent=role?'这个角色尚未导入模型。':'还没有解锁角色。先在故事里遇见他们吧。';
  const keep=new Set(roleWindow(roles.length,index).map(i=>key(roles[i])));
  for(const old of [...viewer.modelCache.keys()])if(!keep.has(old)){await viewer.releaseModel(old);records.delete(old.slice(8));}
  const keptMotions=new Set(roleWindow(roles.length,index).map(i=>ctx.idleMotion(roles[i])?.id));
  for(const id of viewer.motionCache.keys())if(!keptMotions.has(id))await viewer.releaseMotion(id);
 }
 async function pump(){
  if(working||closed)return;working=true;const generation=lifecycle;
  try{
   while(!closed){
    const token=serial;index=wanted;currentId=roles[index]?.id||'';text();
    if(!roles.length){await display(token);status('');break;}
    if(records.has(roles[index].id)||!ctx.asset(roles[index].modelId))await display(token);
    const order=roleLoadOrder(roles.length,index);let failed=false;
    for(const at of order){
     if(closed||token!==serial)break;
     const role=roles[at],model=ctx.asset(role.modelId);
     if(!model||records.has(role.id))continue;
     status(at===index?'正在准备角色…':'正在准备两侧角色…');await tick();
     try{
      const activeViewer=viewer,record=await activeViewer.loadModel(model,key(role));if(closed||viewer!==activeViewer)return;
      if(!record)continue;const motion=ctx.idleMotion(role);
      if(motion)await activeViewer.prepareClip(model,motion,key(role));
      else{record.idleClip=createDetailIdle(record);record.currentMotionToken='';}
      if(closed||viewer!==activeViewer)return;
      records.set(role.id,record);if(token===serial)await display(token);
     }catch(error){failed=true;if(token===serial)status(`角色暂时无法显示：${error.message}`);}
    }
    if(closed)return;if(token!==serial){settlers.get(token)?.(false);settlers.delete(token);continue;}
    await display(token);if(!failed)status('');settlers.get(token)?.(true);settlers.delete(token);break;
   }
  }finally{if(generation===lifecycle){working=false;if(!closed&&wanted!==index)pump();}}
 }
 function select(next){
  if(closed||!roles.length)return Promise.resolve(false);
  const target=Math.max(0,Math.min(roles.length-1,next));
  if(target===wanted&&working)return ready;
  wanted=target;serial++;for(const resolve of settlers.values())resolve(false);settlers.clear();
  ready=new Promise(resolve=>settlers.set(serial,resolve));pump();return ready;
 }
 function close(notify=true){
  closed=true;serial++;lifecycle++;for(const resolve of settlers.values())resolve(false);settlers.clear();viewer?.destroy();viewer=null;root?.remove();root=null;records.clear();if(notify)ctx.closed();
 }
 function open(){
  close(false);roles=unlockedRoles(ctx.project().characters,ctx.unlocked);index=Math.max(0,roles.findIndex(r=>r.id===currentId));wanted=index;closed=false;working=false;
  const frame=document.querySelector('.player .stage-frame');
  frame.insertAdjacentHTML('beforeend',`<section id="role-details" class="role-details" role="dialog" aria-modal="true" aria-label="角色详情" tabindex="-1">
   <div class="role-details-canvas" aria-label="拖动或滚动切换角色" tabindex="0"></div><div class="role-details-floor"></div>
   <header><div><small>CHARACTER DETAILS</small><h1>角色详情</h1></div><span class="role-details-counter"></span><button type="button" data-role-close aria-label="返回标题">关闭 ×</button></header>
   <aside class="role-details-about"></aside><aside class="role-details-stories"></aside>
   <img class="role-details-photo" hidden alt="角色立绘"><p class="role-details-empty" hidden></p>
   <footer><button type="button" data-role-prev aria-label="上一位角色">‹</button><span>拖动画面或滚动鼠标，切换角色</span><button type="button" data-role-next aria-label="下一位角色">›</button></footer><div class="role-details-status" role="status"></div></section>`);
  root=frame.querySelector('#role-details');viewer=ctx.createStage(root.querySelector('.role-details-canvas'),message=>status(message));
  viewer.setRenderSettings(ctx.project().render);viewer.camera.fov=32;viewer.camera.position.set(0,1.04,4.4);viewer.camera.lookAt(0,.98,0);viewer.camera.updateProjectionMatrix();
  root.addEventListener('click',event=>{event.stopPropagation();if(event.target.closest('[data-role-close]'))close();else if(event.target.closest('[data-role-prev]'))select(wanted-1);else if(event.target.closest('[data-role-next]'))select(wanted+1);});
  root.addEventListener('keydown',event=>{
   if(event.key==='Tab'){const targets=[...root.querySelectorAll('button:not(:disabled),[tabindex="0"]')],first=targets[0],last=targets.at(-1),active=document.activeElement;if(active===root||event.shiftKey&&active===first||!event.shiftKey&&active===last){event.preventDefault();event.stopPropagation();(event.shiftKey?last:first)?.focus();}return;}
   if(['Escape','ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();event.stopPropagation();if(event.key==='Escape')close();else select(wanted+(event.key==='ArrowLeft'?-1:1));}
  });
  const canvas=root.querySelector('.role-details-canvas');let start=null,scroll=0,lastWheel=0;
  canvas.addEventListener('pointerdown',event=>{if(event.button!==0)return;start={x:event.clientX,y:event.clientY};try{canvas.setPointerCapture(event.pointerId);}catch{}canvas.focus({preventScroll:true});});
  canvas.addEventListener('pointerup',event=>{if(!start)return;const dx=event.clientX-start.x,dy=event.clientY-start.y;start=null;if(Math.abs(dx)>36&&Math.abs(dx)>Math.abs(dy))select(wanted+(dx<0?1:-1));});
  canvas.addEventListener('pointercancel',()=>start=null);
  canvas.addEventListener('wheel',event=>{event.preventDefault();if(performance.now()-lastWheel<220)return;scroll+=Math.abs(event.deltaX)>Math.abs(event.deltaY)?event.deltaX:event.deltaY;if(Math.abs(scroll)>=40){select(wanted+(scroll>0?1:-1));scroll=0;lastWheel=performance.now();}},{passive:false});
  root.focus({preventScroll:true});text();if(roles.length)return select(index);ready=display(serial).then(()=>true);return ready;
 }
 return {open,close,select,get ready(){return ready;},get isOpen(){return !closed;},get viewer(){return viewer;},get roles(){return roles;},get index(){return index;}};
}
