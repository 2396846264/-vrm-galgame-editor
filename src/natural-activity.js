// One coordinator per stage: independent clocks plus gentle crowd limits.
export function createNaturalActivity(random=Math.random){
 let time=0,blinkAfter=0,gazeAfter=0;const gazes=new Map(),waiting=new Map();
 return {
  tick(delta){time+=Math.max(0,Math.min(Number(delta)||0,.1));for(const [owner,until]of gazes)if(until<=time)gazes.delete(owner);for(const [owner,row]of waiting)if(time-row.seen>2.5)waiting.delete(owner);},
  request(kind,owner,duration=0){
   if(kind==='blink'){if(time<blinkAfter)return false;blinkAfter=time+.28+random()*.4;return true;}
   const row=waiting.get(owner)||{priority:time+random()*.7,seen:time};row.seen=time;waiting.set(owner,row);
   if(time<gazeAfter||gazes.size>=2)return false;
   if([...waiting].some(([other,entry])=>other!==owner&&entry.priority<row.priority))return false;
   waiting.delete(owner);
   gazeAfter=time+1.2+random()*1.2;gazes.set(owner,time+duration);return true;
  },
  release(owner){gazes.delete(owner);waiting.delete(owner);},
  diagnostics(){return {time,activeGazes:gazes.size,blinkAfter,gazeAfter};}
 };
}
