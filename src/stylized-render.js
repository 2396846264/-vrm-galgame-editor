import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {Pass} from 'three/addons/postprocessing/Pass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {FXAAShader} from 'three/addons/shaders/FXAAShader.js';
import {effectiveStyle} from './render-style.js';

class ScenePass extends Pass{
 constructor(stage){super();this.stage=stage;this.needsSwap=false;this.normalTarget=new THREE.WebGLRenderTarget(1,1,{minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter});this.normalTarget.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);this.normalMaterials=new WeakMap();this.ownedNormals=new Set();}
 normalFor(source,character){
  let variants=this.normalMaterials.get(source);if(!variants){variants={};this.normalMaterials.set(source,variants);}const kind=character?'character':'environment';if(variants[kind])return variants[kind];
  const material=new THREE.MeshNormalMaterial({side:source.side,opacity:character?1:.25,blending:THREE.NoBlending}),map=source.map||source.litMultiplyTexture||source.uniforms?.map?.value;
  if(map){map.updateMatrix();const transform={value:map.matrix},cutoff={value:source.alphaTest||(source.transparent?.15:0)};
   material.onBeforeCompile=shader=>{shader.uniforms.nprMask={value:map};shader.uniforms.nprMaskTransform=transform;shader.uniforms.nprCutoff=cutoff;shader.vertexShader='uniform mat3 nprMaskTransform;varying vec2 nprUv;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nnprUv=(nprMaskTransform*vec3(uv,1.)).xy;');shader.fragmentShader='uniform sampler2D nprMask;uniform float nprCutoff;varying vec2 nprUv;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(texture2D(nprMask,nprUv).a<nprCutoff)discard;');};material.customProgramCacheKey=()=> 'npr-normal-mask-v1';
  }
  variants[kind]=material;this.ownedNormals.add(material);return material;
 }
 setSize(w,h){this.normalTarget.setSize(w,h);}
 render(renderer,_write,read){
  const s=this.stage,old={target:renderer.getRenderTarget(),background:s.scene.background,override:s.scene.overrideMaterial,shadow:renderer.shadowMap.autoUpdate,autoClear:renderer.autoClear,color:renderer.getClearColor(new THREE.Color()),alpha:renderer.getClearAlpha()};const hidden=[],materials=[];
  try{
   renderer.autoClear=true;
   if(s.stylePipeline.needsGeometry){
    s.scene.traverse(object=>{if(object.userData.environmentSky||(object.isMesh&&(Array.isArray(object.material)?object.material:[object.material]).every(material=>material?.isOutline||material?.isShadowMaterial))){hidden.push([object,object.visible]);object.visible=false;}else if(object.isMesh){let character=false;for(let parent=object;parent;parent=parent.parent)if(parent.userData.nprCharacter){character=true;break;}materials.push([object,object.material]);object.material=Array.isArray(object.material)?object.material.map(material=>this.normalFor(material,character)):this.normalFor(object.material,character);}});
    s.scene.background=null;s.scene.overrideMaterial=null;renderer.shadowMap.autoUpdate=false;renderer.setClearColor(0,0);renderer.setRenderTarget(this.normalTarget);renderer.clear();renderer.render(s.scene,s.camera);
    for(const[o,material]of materials)o.material=material;materials.length=0;for(const[o,visible]of hidden)o.visible=visible;hidden.length=0;s.scene.background=old.background;s.scene.overrideMaterial=old.override;renderer.shadowMap.autoUpdate=old.shadow;renderer.setClearColor(old.color,old.alpha);
   }
   renderer.setRenderTarget(read);renderer.clear();renderer.render(s.scene,s.camera);
  }finally{for(const[o,material]of materials)o.material=material;for(const[o,visible]of hidden)o.visible=visible;s.scene.background=old.background;s.scene.overrideMaterial=old.override;renderer.shadowMap.autoUpdate=old.shadow;renderer.autoClear=old.autoClear;renderer.setClearColor(old.color,old.alpha);renderer.setRenderTarget(old.target);}
 }
 clearMaterials(){for(const material of this.ownedNormals)material.dispose();this.ownedNormals.clear();this.normalMaterials=new WeakMap();}
 dispose(){this.normalTarget.dispose();this.normalTarget.depthTexture?.dispose();this.clearMaterials();}
}
const vertexShader=`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const fragmentShader=`
uniform sampler2D tDiffuse,tNormal,tDepth;
uniform vec2 resolution;
uniform mat4 inverseProjection;
uniform float time,hasGeometry,simplify,posterize,posterMix,outline,outlineBackgroundAlpha,outlineDetail,ao,aoRadius,sharpen,blur,emboss,exposure,gamma,hue,temperature,tint,sepia,monochrome,invert,vignette,bloom,pixelSize,halftone,hatch,dither,grain,scanlines,chromatic,tear,saturationBoost,contrastBoost,motion;
uniform vec3 outlineColor;
varying vec2 vUv;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
vec3 toDisplay(vec3 c){return mix(c*12.92,1.055*pow(max(c,vec3(0.)),vec3(1./2.4))-.055,step(vec3(.0031308),c));}
vec3 toLinear(vec3 c){return mix(c/12.92,pow(max((c+.055)/1.055,vec3(0.)),vec3(2.4)),step(vec3(.04045),c));}
vec3 sampleColor(vec2 uv){return toDisplay(texture2D(tDiffuse,clamp(uv,vec2(0.),vec2(1.))).rgb);}
float depthAt(vec2 uv){return texture2D(tDepth,clamp(uv,vec2(0.),vec2(1.))).x;}
vec3 viewPosition(vec2 uv,float depth){vec4 p=inverseProjection*vec4(uv*2.-1.,depth*2.-1.,1.);return p.xyz/p.w;}
vec3 normalAt(vec2 uv){return normalize(texture2D(tNormal,clamp(uv,vec2(0.),vec2(1.))).xyz*2.-1.);}
float lum(vec3 c){return dot(c,vec3(.2126,.7152,.0722));}
vec3 hueRotate(vec3 c,float a){float co=cos(a),si=sin(a);return c*co+cross(normalize(vec3(1.)),c)*si+vec3(dot(normalize(vec3(1.)),c))*(1.-co)/sqrt(3.);}
void main(){
 vec2 pixel=1./resolution,uv=vUv;
 float tick=floor(time*13.),chance=step(.87,hash(vec2(tick,73.)));
 float strip=step(abs(uv.y-hash(vec2(tick,19.))),.012+.035*hash(vec2(tick,7.)));
 uv.x+=tear*motion*chance*strip*(hash(vec2(tick,31.))-.5)*.07;
 uv=clamp(uv,vec2(0.),vec2(1.));
 if(pixelSize>1.)uv=(floor(uv*resolution/pixelSize)+.5)*pixelSize/resolution;
 vec4 original=texture2D(tDiffuse,uv);vec3 center=toDisplay(original.rgb),color=center;
 float depth=hasGeometry>.5?depthAt(uv):1.;vec3 normal=hasGeometry>.5?normalAt(uv):vec3(0.,0.,1.);
 if(simplify>0.||blur>0.){
  vec3 sum=center;float weight=1.;float radius=1.+simplify*3.+blur*3.;
  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
   if(x==0&&y==0)continue;vec2 off=uv+vec2(float(x),float(y))*pixel*radius;vec3 c=sampleColor(off);float w=exp(-dot(c-center,c-center)*mix(35.,4.,blur));
   if(hasGeometry>.5){float z=depthAt(off);w*=1.-step(.02,abs(depth-z));w*=pow(max(dot(normal,normalAt(off)),0.),4.);}
   sum+=c*w;weight+=w;
  }
  color=mix(center,sum/max(weight,.0001),max(simplify,blur));
 }
 vec3 left=sampleColor(uv-vec2(pixel.x,0.)),right=sampleColor(uv+vec2(pixel.x,0.)),up=sampleColor(uv+vec2(0.,pixel.y)),down=sampleColor(uv-vec2(0.,pixel.y));
 color+=sharpen*(center-(left+right+up+down)*.25);
 if(emboss>0.)color=mix(color,vec3(.5)+(right-left+up-down)*.65,emboss);
 if(chromatic>0.){color.r=mix(color.r,sampleColor(uv+vec2(pixel.x*chromatic,0.)).r,.65);color.b=mix(color.b,sampleColor(uv-vec2(pixel.x*chromatic,0.)).b,.65);}
 if(ao>0.&&hasGeometry>.5&&depth<.99999){
  vec3 p=viewPosition(uv,depth);float total=0.;float screenRadius=clamp(aoRadius*resolution.y/max(.2,-p.z),2.,32.);
  for(int i=0;i<8;i++){float angle=float(i)*.78539816;vec2 at=uv+vec2(cos(angle),sin(angle))*pixel*screenRadius;float d=depthAt(at);if(d>=.99999)continue;vec3 v=viewPosition(at,d)-p;float distance=length(v);if(distance>.005)total+=max(dot(normal,v/distance)-.12,0.)*(1.-smoothstep(aoRadius*.3,aoRadius*2.,distance));}
  color*=1.-ao*min(total*.25,.65);
 }
 color*=exp2(exposure);color=pow(max(color,vec3(0.)),vec3(1./gamma));
 color=hueRotate(color,hue*.0174532925);color*=vec3(1.+temperature*.15,1.+tint*.1,1.-temperature*.15);color.g*=1.-tint*.13;
 color=mix(vec3(lum(color)),color,saturationBoost);color=(color-.5)*contrastBoost+.5;
 if(bloom>0.){vec3 glow=max(center-.75,0.);for(int i=0;i<4;i++){float a=float(i)*1.5707963+.785;vec3 c=sampleColor(uv+vec2(cos(a),sin(a))*pixel*5.);glow+=max(c-.75,0.)*.25;}color+=glow*bloom;}
 color=mix(color,vec3(lum(color)),monochrome);
 vec3 oldPhoto=vec3(dot(color,vec3(.393,.769,.189)),dot(color,vec3(.349,.686,.168)),dot(color,vec3(.272,.534,.131)));color=mix(color,oldPhoto,sepia);
 color=mix(color,1.-color,invert);
 if(posterize>=2.){float ordered=mod(floor(gl_FragCoord.x)+2.*floor(gl_FragCoord.y),4.)/4.-.375;vec3 separated=floor(clamp(color+ordered*dither/posterize,0.,1.)*(posterize-1.)+.5)/(posterize-1.);color=mix(color,separated,posterMix);}
 if(halftone>0.){vec2 cell=fract(gl_FragCoord.xy/5.)-.5;float ink=1.-smoothstep(.28,.38,length(cell));color*=1.-halftone*ink*(1.-lum(color))*.65;}
 if(hatch>0.){float line=step(.76,fract((gl_FragCoord.x+gl_FragCoord.y)/6.));color*=1.-hatch*line*(1.-lum(color))*.6;}
 float edge=0.,characterMask=texture2D(tNormal,uv).a;
 if(outline>0.&&hasGeometry>.5){
  for(int i=0;i<4;i++){float a=float(i)*1.5707963;vec2 at=uv+vec2(cos(a),sin(a))*pixel*max(outline,1.);float nd=depthAt(at);
   characterMask=max(characterMask,texture2D(tNormal,at).a);float mask=abs(step(depth,.99999)-step(nd,.99999));float z1=-viewPosition(uv,depth).z,z2=-viewPosition(at,nd).z;
   float boundary=smoothstep(.012,.075,abs(z1-z2)/max(1.,min(z1,z2)));
   float bend=smoothstep(mix(.7,.12,outlineDetail),mix(.95,.5,outlineDetail),1.-max(dot(normal,normalAt(at)),0.));
   edge=max(edge,max(mask,max(boundary,bend*step(depth,.99999)*step(nd,.99999))));
  }
  color=mix(color,outlineColor,clamp(edge*.78*min(outline,1.)*mix(outlineBackgroundAlpha,1.,step(.75,characterMask)),0.,1.));
 }
 float noise=hash(floor(gl_FragCoord.xy)+vec2(floor(time*24.)*17.*motion));color+=(noise-.5)*grain*.3;
 color*=1.-scanlines*(.5+.5*sin(gl_FragCoord.y*3.14159265+floor(time*18.)*motion))*.25;
 color*=1.-tear*motion*.018*hash(vec2(tick,90.));
 vec2 p=vUv*2.-1.;color*=1.-vignette*smoothstep(.25,1.4,dot(p,p))*.65;
 gl_FragColor=vec4(toLinear(clamp(color,0.,1.)),original.a);
}`;
export class StylizedPipeline{
 constructor(stage){
  this.stage=stage;this.composer=new EffectComposer(stage.renderer);this.scenePass=new ScenePass(stage);this.composer.addPass(this.scenePass);
  const uniforms={tDiffuse:{value:null},tNormal:{value:null},tDepth:{value:null},resolution:{value:new THREE.Vector2(1,1)},inverseProjection:{value:new THREE.Matrix4()},time:{value:0},hasGeometry:{value:0},motion:{value:1},outlineColor:{value:new THREE.Color()}};
  for(const key of Object.keys(effectiveStyle({preset:'custom'})))if(key!=='outlineColor')uniforms[key]={value:0};
  this.filterPass=new ShaderPass({uniforms,vertexShader,fragmentShader});
  // ShaderPass clones texture uniforms; restore the live render-target attachments.
  this.filterPass.uniforms.tNormal.value=this.scenePass.normalTarget.texture;this.filterPass.uniforms.tDepth.value=this.scenePass.normalTarget.depthTexture;
  this.composer.addPass(this.filterPass);this.outputPass=new OutputPass();this.composer.addPass(this.outputPass);this.fxaaPass=new ShaderPass(FXAAShader);this.composer.addPass(this.fxaaPass);this.update(stage.renderSettings);
 }
 update(settings){this.settings=settings;this.style=effectiveStyle(settings);for(const[key,value]of Object.entries(this.style)){const uniform=this.filterPass.uniforms[key];if(uniform)key==='outlineColor'?uniform.value.set(value).convertLinearToSRGB():uniform.value=value;}this.needsGeometry=this.style.outline>0||this.style.ao>0||this.style.simplify>0;this.filterPass.uniforms.hasGeometry.value=this.needsGeometry?1:0;}
 resize(w,h){const ratio=this.stage.renderer.getPixelRatio();this.composer.setPixelRatio(ratio);this.composer.setSize(w,h);this.filterPass.uniforms.resolution.value.set(Math.max(1,w*ratio),Math.max(1,h*ratio));this.fxaaPass.uniforms.resolution.value.set(1/Math.max(1,w*ratio),1/Math.max(1,h*ratio));}
 render(delta){this.filterPass.uniforms.time.value+=delta;this.filterPass.uniforms.inverseProjection.value.copy(this.stage.camera.projectionMatrixInverse);this.filterPass.uniforms.motion.value=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches?0:1;this.composer.render(delta);}
 dispose(){this.scenePass.dispose();this.filterPass.dispose();this.outputPass.dispose();this.fxaaPass.dispose();this.composer.dispose();}
}
