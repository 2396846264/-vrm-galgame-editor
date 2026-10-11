import * as THREE from 'three';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';

export function depthBlurRadius(distance,focus,range,strength,maxBlur){
 return Math.min(1,Math.max(0,Math.abs(distance-focus)-range*.5)/Math.max(.1,distance))*strength*maxBlur;
}
// Reuse the alpha-tested, skinned geometry depth already produced for outlines
// and AO. No extra scene render, and DOM dialogue/portraits remain sharp.
export function createDepthOfFieldPass(depth){
 const pass=new ShaderPass({uniforms:{tDiffuse:{value:null},tDepth:{value:null},inverseProjection:{value:new THREE.Matrix4()},resolution:{value:new THREE.Vector2(1,1)},strength:{value:0},focus:{value:4.3},clearRange:{value:2},maxBlur:{value:8}},
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`
   uniform sampler2D tDiffuse,tDepth;uniform mat4 inverseProjection;
   uniform vec2 resolution;uniform float strength,focus,clearRange,maxBlur;varying vec2 vUv;
   float distanceAt(vec2 uv){vec4 p=inverseProjection*vec4(uv*2.-1.,texture2D(tDepth,uv).x*2.-1.,1.);return max(.1,-p.z/p.w);}
   float circle(float d){return clamp(max(0.,abs(d-focus)-clearRange*.5)/max(.1,d),0.,1.);}
   void main(){
    vec4 original=texture2D(tDiffuse,vUv);float distance=distanceAt(vUv),coc=circle(distance),radius=coc*strength*maxBlur*resolution.y/720.;
    if(radius<.3){gl_FragColor=original;return;}
    vec4 sum=original;float total=1.;
    for(int i=0;i<16;i++){
     float angle=float(i)*2.39996323,r=sqrt((float(i)+.5)/16.);
     vec2 uv=clamp(vUv+vec2(cos(angle),sin(angle))*r*radius/resolution,vec2(0.),vec2(1.));
     float sampleDistance=distanceAt(uv),sampleCoc=circle(sampleDistance);
     // Do not pull an in-focus foreground face into a blurred background.
     float weight=sampleDistance<distance-clearRange*.5?mix(.02,1.,sampleCoc):1.;
     sum+=texture2D(tDiffuse,uv)*weight;total+=weight;
    }
    gl_FragColor=sum/total;
   }`});
 pass.uniforms.tDepth.value=depth;pass.enabled=false;return pass;
}
