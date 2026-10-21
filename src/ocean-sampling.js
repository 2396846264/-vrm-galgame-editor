import * as T from 'three';
// Invert horizontal displacement to sample height at a WORLD x/z, not at a
// displaced mesh vertex's original coordinate. FFT data arrives asynchronously.
export function oceanSampler(waves,options={}){
 let pixels=null,size=0;const scales=[1,.27,.072],weights=[1,.55,.28],patch=options.patchSize||220;
 const scratch={y:0,dx:0,dz:0};
 function field(x,z,c){if(!pixels)return 0;let value=0;for(let i=0;i<3;i++){const u=x/(patch*scales[i])*size-.5,v=z/(patch*scales[i])*size-.5,a=Math.floor(u),b=Math.floor(v),fx=u-a,fy=v-b,ix=((a%size)+size)%size,iy=((b%size)+size)%size,jx=(ix+1)%size,jy=(iy+1)%size;value+=(pixels[(iy*size+ix)*4+c]*(1-fx)*(1-fy)+pixels[(iy*size+jx)*4+c]*fx*(1-fy)+pixels[(jy*size+ix)*4+c]*(1-fx)*fy+pixels[(jy*size+jx)*4+c]*fx*fy)*weights[i];}return value;}
 function displacement(x,z,time){let y=field(x,z,0),dx=field(x,z,1)*(options.choppiness??1),dz=field(x,z,2)*(options.choppiness??1);for(let i=0;i<waves.params.length;i++){const p=waves.params[i],d=waves.directions[i],phase=p.x*(d.x*x+d.y*z)-p.w*time,c=Math.cos(phase);y+=p.y*Math.sin(phase);dx+=p.z*p.y*d.x*c;dz+=p.z*p.y*d.y*c;}scratch.y=y;scratch.dx=dx;scratch.dz=dz;return scratch;}

 return {setFFT(data,n){pixels=data;size=n;},height(x,z,time=0){let px=x,pz=z;for(let i=0;i<3;i++){const d=displacement(px,pz,time);px=x-d.dx;pz=z-d.dz;}return displacement(px,pz,time).y;},normal(x,z,time=0,target=new T.Vector3()){const h=.65;let dx=(field(x+h,z,0)-field(x-h,z,0))/(2*h),dz=(field(x,z+h,0)-field(x,z-h,0))/(2*h);for(let i=0;i<waves.params.length;i++){const p=waves.params[i],d=waves.directions[i],slope=p.x*p.y*Math.cos(p.x*(d.x*x+d.y*z)-p.w*time);dx+=d.x*slope;dz+=d.y*slope;}return target.set(-dx,1,-dz).normalize();},get fftReady(){return !!pixels;}};
}
