// FSR 1 EASU / RCAS, WebGL GLSL port of GPUOpen-Effects/FidelityFX-FSR.
// Copyright (c) 2021 Advanced Micro Devices, Inc. MIT license.
// Full license is distributed in licenses/AMD-FidelityFX-FSR.txt.
export const fullscreenVertex=`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
export const easuFragment=`
uniform sampler2D tDiffuse;uniform vec2 inputSize,outputSize;varying vec2 vUv;
vec3 loadColor(vec2 p){return texture2D(tDiffuse,(clamp(p,vec2(0.),inputSize-1.)+.5)/inputSize).rgb;}
float luma(vec3 c){return c.g+.5*(c.r+c.b);}
void edgeSet(inout vec2 dir,inout float len,float w,float a,float b,float c,float d,float e){
 vec2 gradient=vec2(d-b,e-a);dir+=gradient*w;
 vec2 magnitude=vec2(max(abs(d-c),abs(c-b)),max(abs(e-c),abs(c-a)));
 vec2 strength=clamp(abs(gradient)/max(magnitude,vec2(1e-6)),0.,1.);len+=dot(strength,strength)*w;
}
void tap(inout vec3 color,inout float weight,vec2 offset,vec2 dir,vec2 lengthScale,float lobe,float clipDistance,vec3 sampleColor){
 vec2 v=vec2(dot(offset,dir),dot(offset,vec2(-dir.y,dir.x)))*lengthScale;float d=min(dot(v,v),clipDistance);
 float a=lobe*d-1.,b=.4*d-1.;a*=a;b=b*b*1.5625-.5625;float w=a*b;color+=sampleColor*w;weight+=w;
}
void main(){
 vec2 location=(floor(gl_FragCoord.xy)+.5)*inputSize/outputSize-.5,base=floor(location),pp=location-base;
 vec3 b=loadColor(base+vec2(0,-1)),c=loadColor(base+vec2(1,-1)),e=loadColor(base+vec2(-1,0)),f=loadColor(base),g=loadColor(base+vec2(1,0)),h=loadColor(base+vec2(2,0));
 vec3 i=loadColor(base+vec2(-1,1)),j=loadColor(base+vec2(0,1)),k=loadColor(base+vec2(1,1)),l=loadColor(base+vec2(2,1)),n=loadColor(base+vec2(0,2)),o=loadColor(base+vec2(1,2));
 vec2 dir=vec2(0.);float len=0.;
 edgeSet(dir,len,(1.-pp.x)*(1.-pp.y),luma(b),luma(e),luma(f),luma(g),luma(j));
 edgeSet(dir,len,pp.x*(1.-pp.y),luma(c),luma(f),luma(g),luma(h),luma(k));
 edgeSet(dir,len,(1.-pp.x)*pp.y,luma(f),luma(i),luma(j),luma(k),luma(n));
 edgeSet(dir,len,pp.x*pp.y,luma(g),luma(j),luma(k),luma(l),luma(o));
 float norm=dot(dir,dir);dir=norm<1./32768.?vec2(1,0):dir*inversesqrt(norm);len=.25*len*len;
 float stretch=dot(dir,dir)/max(max(abs(dir.x),abs(dir.y)),1e-6);vec2 lengthScale=vec2(1.+(stretch-1.)*len,1.-.5*len);float lobe=.5-.29*len,clipDistance=1./lobe;
 vec3 color=vec3(0.);float weight=0.;
 tap(color,weight,vec2(0,-1)-pp,dir,lengthScale,lobe,clipDistance,b);tap(color,weight,vec2(1,-1)-pp,dir,lengthScale,lobe,clipDistance,c);
 tap(color,weight,vec2(-1,0)-pp,dir,lengthScale,lobe,clipDistance,e);tap(color,weight,-pp,dir,lengthScale,lobe,clipDistance,f);tap(color,weight,vec2(1,0)-pp,dir,lengthScale,lobe,clipDistance,g);tap(color,weight,vec2(2,0)-pp,dir,lengthScale,lobe,clipDistance,h);
 tap(color,weight,vec2(-1,1)-pp,dir,lengthScale,lobe,clipDistance,i);tap(color,weight,vec2(0,1)-pp,dir,lengthScale,lobe,clipDistance,j);tap(color,weight,vec2(1,1)-pp,dir,lengthScale,lobe,clipDistance,k);tap(color,weight,vec2(2,1)-pp,dir,lengthScale,lobe,clipDistance,l);
 tap(color,weight,vec2(0,2)-pp,dir,lengthScale,lobe,clipDistance,n);tap(color,weight,vec2(1,2)-pp,dir,lengthScale,lobe,clipDistance,o);
 vec3 minimum=min(min(f,g),min(j,k)),maximum=max(max(f,g),max(j,k));color=clamp(color/max(weight,1e-6),minimum,maximum);
 gl_FragColor=vec4(color,texture2D(tDiffuse,vUv).a);
}`;
export const rcasFragment=`
uniform sampler2D tDiffuse;uniform vec2 outputSize;uniform float sharpness;varying vec2 vUv;
vec4 loadPixel(vec2 p){return texture2D(tDiffuse,(clamp(p,vec2(0.),outputSize-1.)+.5)/outputSize);}
void main(){vec2 p=floor(gl_FragCoord.xy);vec3 b=loadPixel(p+vec2(0,-1)).rgb,d=loadPixel(p+vec2(-1,0)).rgb,f=loadPixel(p+vec2(1,0)).rgb,h=loadPixel(p+vec2(0,1)).rgb;vec4 center=loadPixel(p);vec3 e=center.rgb;
 vec3 minimum=min(min(b,d),min(f,h)),maximum=max(max(b,d),max(f,h));
 vec3 hitMin=min(minimum,e)/max(4.*maximum,vec3(1e-6));vec3 hitMax=(1.-max(maximum,e))/min(4.*minimum-4.,vec3(-1e-6));
 vec3 lobes=max(-hitMin,hitMax);float lobe=max(-.1875,min(max(max(lobes.r,lobes.g),lobes.b),0.))*sharpness;
 vec3 color=(lobe*(b+d+f+h)+e)/(1.+4.*lobe);gl_FragColor=vec4(clamp(color,0.,1.),center.a);
}`;
export const resolveFragment=`
uniform sampler2D tDiffuse;uniform vec2 inputSize,outputSize;uniform int superSamples;varying vec2 vUv;
void main(){if(superSamples<=1){gl_FragColor=texture2D(tDiffuse,vUv);return;}vec4 color=vec4(0.);float columns=superSamples<=4?2.:4.,rows=superSamples==2?2.:superSamples==4?2.:superSamples==8?2.:4.;
 for(int i=0;i<16;i++){if(i>=superSamples)break;float column=mod(float(i),columns),row=superSamples==2?float(i):floor(float(i)/columns);vec2 offset=(vec2(column,row)+.5)/vec2(columns,rows)-.5;color+=texture2D(tDiffuse,vUv+offset/outputSize);}
 gl_FragColor=color/float(superSamples);
}`;
