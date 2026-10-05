// Decisions depend only on recent rendered frames, never hardware identity.
export function preloadMode(fps){return Number.isFinite(fps)&&fps>55?'full':Number.isFinite(fps)&&fps>=30?'partial':'off';}
export class FrameRateMeter{
  constructor(){this.reset();}
  reset(){this.samples=[];this.elapsed=0;this.fps=0;}
  sample(seconds,hidden=false){
    if(hidden){this.reset();return 0;}
    if(!Number.isFinite(seconds)||seconds<=0)return this.fps;
    this.samples.push(seconds);this.elapsed+=seconds;
    while(this.samples.length>1&&this.elapsed-this.samples[0]>=1)this.elapsed-=this.samples.shift();
    this.fps=this.elapsed>=.5?this.samples.length/this.elapsed:0;return this.fps;
  }
}
export function nextPreloadTarget(acts,index,step){
  const current=acts[index];if(!current||current.kind==='event'||!current.steps?.length||step<Math.max(0,current.steps.length-3))return null;
  const targets=new Set();let canContinue=true;
  for(const line of current.steps.slice(step)){
    if(line.choices?.length){for(const choice of line.choices)if(choice.actId)targets.add(choice.actId);canContinue=false;break;}
  }
  if(canContinue&&acts[index+1])targets.add(acts[index+1].id);
  return targets.size===1?acts.find(act=>act.id===[...targets][0])||null:null;
}
export class ActPreloader{
  constructor({fps,allowed,create,dispose,status=()=>{},defer=()=>new Promise(r=>setTimeout(r,0))}){Object.assign(this,{fps,allowed,create,dispose,status,defer});this.record=null;this.lastResult=null;}
  mode(){return preloadMode(this.fps());}
  update(target){
    if(!target){this.reset();return;}
    if(this.record?.id!==target.id){this.reset();if(this.mode()==='off'||!this.allowed())return;const bundle=this.create(target);this.record={id:target.id,bundle,done:new Set(),failed:new Set(),task:null,cancelled:false,foreground:false};}
    const record=this.record;if(!record)return;
    const mode=this.mode(),eligible=this.allowed()&&mode!=='off';
    const jobs=record.bundle.jobs.filter(job=>!record.done.has(job.key)&&!record.failed.has(job.key)&&(mode==='full'||job.partial)).sort((a,b)=>Number(Boolean(b.partial))-Number(Boolean(a.partial)));
    this.status({busy:eligible&&Boolean((record.task&&!record.waiting)||jobs.length),mode,id:record.id,done:record.done.size,total:record.bundle.jobs.filter(j=>mode==='full'||j.partial).length});
    if(!eligible||record.task||!jobs.length)return;
    const gate=async()=>{while(!record.cancelled&&!record.foreground&&(!this.allowed()||this.mode()==='off'||(!jobs[0].partial&&this.mode()!=='full'))){record.waiting=true;await new Promise(r=>setTimeout(r,60));}record.waiting=false;if(record.cancelled)throw Error('Preload cancelled');};
    record.task=(async()=>{await this.defer();await gate();if(!record.foreground&&this.mode()==='partial'&&!jobs[0].partial)return;await jobs[0].run(gate);record.done.add(jobs[0].key);})()
      .catch(()=>{if(!record.cancelled)record.failed.add(jobs[0].key);})
      .finally(()=>{record.task=null;if(this.record===record)this.update(target);});
  }
  async take(id){
    const record=this.record;if(!record||record.id!==id){this.reset();return null;}
    this.record=null;record.foreground=true;this.status({busy:false,mode:this.mode()});await record.task;
    if(record.cancelled)return null;
    this.lastResult={id,done:[...record.done],failed:[...record.failed],mode:this.mode()};return record.bundle;
  }
  reset(){const old=this.record;this.record=null;if(old){old.cancelled=true;this.dispose(old.bundle);}this.status({busy:false,mode:'off'});}
  snapshot(){const r=this.record;return r?{id:r.id,mode:this.mode(),busy:Boolean(r.task),done:[...r.done],failed:[...r.failed]}:null;}
}
