export function voiceTextIndex(length,time,duration){if(!Number.isFinite(duration)||duration<=0)return 0;return Math.max(0,Math.min(length,Math.floor(length*Math.max(0,Number(time)||0)/duration)));}

// The media clock, rather than wall time, owns voiced dialogue. Buffering,
// seeking, pause/resume and playback speed therefore cannot drift the text.
export class VoiceDialogueClock {
 constructor(audio,length,{progress=()=>{},speaking=()=>{},complete=()=>{},failed=()=>{}}={}){
  this.audio=audio;this.length=length;this.progress=progress;this.speaking=speaking;this.complete=complete;this.failed=failed;this.revealed=false;this.finished=false;this.waiting=false;this.listeners=[];
  const on=(name,fn)=>{audio.addEventListener(name,fn);this.listeners.push([name,fn]);};
  for(const event of ['loadedmetadata','durationchange','timeupdate','play','pause','ratechange'])on(event,()=>this.tick());
  on('waiting',()=>{this.waiting=true;this.tick();});on('playing',()=>{this.waiting=false;this.tick();});on('seeking',()=>{this.waiting=true;this.tick();});on('seeked',()=>{this.waiting=false;this.tick();});
  on('ended',()=>this.finish());on('error',()=>this.fail());this.timer=setInterval(()=>this.tick(),25);
 }
 tick(){if(this.finished)return;if(this.audio.ended)return this.finish();if(this.audio.readyState>=1&&(!Number.isFinite(this.audio.duration)||this.audio.duration<=0))return this.fail();this.progress(this.revealed?this.length:voiceTextIndex(this.length,this.audio.currentTime,this.audio.duration));if(this.finished)return;this.speaking(!this.audio.paused&&!this.waiting&&!this.audio.seeking&&this.audio.readyState>=2);}
 reveal(){this.revealed=true;this.progress(this.length);}
 finish(){if(this.finished)return;this.progress(this.length);this.dispose();this.speaking(false);this.complete();}
 fail(){if(this.finished)return;this.dispose();this.speaking(false);this.failed();}
 dispose(){if(this.finished)return;this.finished=true;clearInterval(this.timer);for(const [name,fn]of this.listeners)this.audio.removeEventListener(name,fn);this.listeners=[];}
}
