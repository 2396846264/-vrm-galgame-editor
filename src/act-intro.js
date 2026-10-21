// One cancellable presentation per playback request; no project/save schema change.
export const actIntroTiming=Object.freeze({enter:460,hold:800,exit:340});
export function createActIntro(){
 let current=null;
 const cancel=()=>{const run=current;if(!run)return;current=null;run.cancelled=true;run.animation?.cancel();run.timers.forEach(clearTimeout);run.finishWait?.();run.node.remove();run.host.classList.remove('act-introducing');};
 async function play(host,name,valid=()=>true){
  cancel();if(!host||!valid())return false;
  const node=host.ownerDocument.createElement('div');node.className='act-intro';node.setAttribute('role','status');node.setAttribute('aria-live','polite');node.textContent=String(name||'');
  const run={host,node,cancelled:false,timers:[]};current=run;host.classList.add('act-introducing');
  const active=()=>current===run&&!run.cancelled&&node.isConnected&&valid();
  const wait=duration=>new Promise(resolve=>{const timer=setTimeout(done,duration);function done(){clearTimeout(timer);run.finishWait=null;resolve();}run.finishWait=done;});
  node.dataset.phase='enter';host.append(node);
  try{
   const {enter,hold,exit}=actIntroTiming,total=enter+hold+exit;
   // A single compositor timeline keeps the 800 ms pause independent of delayed
   // JavaScript callbacks while real models are being rendered.
   run.timers.push(setTimeout(()=>{if(active())node.dataset.phase='hold';},enter),setTimeout(()=>{if(active())node.dataset.phase='exit';},enter+hold));
   if(node.animate){
    run.animation=node.animate([
     {offset:0,transform:'translateX(-125%)',opacity:0,easing:'cubic-bezier(.16,1.18,.3,1)'},
     {offset:enter/total,transform:'translateX(0)',opacity:1,easing:'linear'},
     {offset:(enter+hold)/total,transform:'translateX(0)',opacity:1,easing:'cubic-bezier(.65,0,.85,.35)'},
     {offset:1,transform:'translateX(-125%)',opacity:0}
    ],{duration:total,fill:'both'});
    try{await run.animation.finished;}catch{return false;}
   }else{node.style.transform='translateX(0)';await wait(total);}
   return active();
  }finally{if(current===run)cancel();}
 }
 return{play,cancel,get active(){return Boolean(current);}};
}
