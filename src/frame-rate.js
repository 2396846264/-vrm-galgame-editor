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
