import * as THREE from 'three';
import {createOceanWater} from './ocean-water.js';
// Procedural water: no network textures, no extra reflection passes per surface.
export const waterPresets={lake:{name:'平静水面',width:20,height:20,color:'#00b8ed',waveHeight:.05,waveScale:3,flowSpeed:0,flowAngle:0,opacity:.88},river:{name:'流水 / 河道',width:4,height:24,color:'#00bcd4',waveHeight:.08,waveScale:1.8,flowSpeed:1.3,flowAngle:90,opacity:.85},waterfall:{name:'瀑布 / 水帘',width:5,height:8,color:'#53dbf0',waveHeight:.025,waveScale:.5,flowSpeed:2.5,flowAngle:90,opacity:.75,rotation:[Math.PI/2,0,0]}};
Object.assign(waterPresets,{
 ocean:{...waterPresets.lake,name:'海洋 · OceanThreejs',waterType:'ocean',width:1000,height:1000,waveHeight:.65,waveScale:35,flowSpeed:10,flowAngle:25,opacity:1},
 pond:{...waterPresets.lake,name:'池塘',waterType:'pond',waterShape:'ellipse',width:8,height:6,waveHeight:.025,waveScale:1.5},
 well:{...waterPresets.lake,name:'井水',waterType:'well',waterShape:'ellipse',width:1.8,height:1.8,waveHeight:.008,waveScale:.4},
 fountain:{...waterPresets.lake,name:'喷泉水面与水柱',waterType:'fountain',waterShape:'ellipse',width:6,height:6,waveHeight:.025,waveScale:1,jetHeight:2}
});
export function waterNode(preset='lake') {return {id:crypto.randomUUID(),kind:'water',parentId:null,position:[0,.05,0],rotation:[0,0,0],scale:[1,1,1],...structuredClone(waterPresets[preset]||waterPresets.lake)};}
function waterNormals(){
 const size=128;let seed=7319,height=new Float32Array(size*size);
 for(let i=0;i<height.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;height[i]=seed/4294967295;}
 const index=(x,y)=>((y+size)%size)*size+(x+size)%size;
 for(let pass=0;pass<4;pass++){const next=new Float32Array(height.length);for(let y=0;y<size;y++)for(let x=0;x<size;x++){let sum=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)sum+=height[index(x+dx,y+dy)];next[index(x,y)]=sum/9;}height=next;}
 const data=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const n=new THREE.Vector3((height[index(x-1,y)]-height[index(x+1,y)])*5,1,(height[index(x,y-1)]-height[index(x,y+1)])*5).normalize(),i=index(x,y)*4;data[i]=Math.round((n.x*.5+.5)*255);data[i+1]=Math.round((n.y*.5+.5)*255);data[i+2]=Math.round((n.z*.5+.5)*255);data[i+3]=Math.round(height[index(x,y)]*255);}
 const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;return texture;
}
export function createWaterSurface(n){
 if(n.waterType==='ocean')return createOceanWater(n);
 const geometry=n.waterShape==='ellipse'?new THREE.CircleGeometry(.5,96).scale(n.width,n.height,1):new THREE.PlaneGeometry(n.width,n.height,Math.min(96,Math.max(8,Math.ceil(n.width/2))),Math.min(96,Math.max(8,Math.ceil(n.height/2))));geometry.rotateX(-Math.PI/2);
 const angle=(n.flowAngle||0)*Math.PI/180,normalTexture=waterNormals();
 const material=new THREE.ShaderMaterial({transparent:(n.opacity??1)<1,depthWrite:true,side:THREE.DoubleSide,fog:true,toneMapped:false,uniforms:THREE.UniformsUtils.merge([THREE.UniformsLib.fog,{normalMap:{value:normalTexture},time:{value:0},surfaceOffset:{value:new THREE.Vector2()},waterColor:{value:new THREE.Color(n.color||'#00b8ed')},waveHeight:{value:n.waveHeight??.05},waveScale:{value:n.waveScale??3},flow:{value:new THREE.Vector2(Math.cos(angle),Math.sin(angle)).multiplyScalar(n.flowSpeed??0)},opacity:{value:n.opacity??1}}]),vertexShader:`uniform vec2 surfaceOffset;uniform float time;uniform float waveHeight;uniform float waveScale;uniform vec2 flow;varying vec3 vWorld;varying vec2 vWater;
 #include <fog_pars_vertex>
 void main(){vec3 p=position;vWater=p.xz+surfaceOffset;vec2 w=(vWater-flow*time)/waveScale;p.y+=waveHeight*(sin(w.x*.8+time*.65)*.6+sin(w.y*.65-time*.45)*.4);vec4 world=modelMatrix*vec4(p,1.);vWorld=world.xyz;vec4 mvPosition=viewMatrix*world;gl_Position=projectionMatrix*mvPosition;
 #include <fog_vertex>
 }`,fragmentShader:`uniform sampler2D normalMap;uniform mat4 modelMatrix;uniform float time;uniform vec3 waterColor;uniform float waveHeight;uniform float waveScale;uniform vec2 flow;uniform float opacity;varying vec3 vWorld;varying vec2 vWater;
 #include <fog_pars_fragment>
 vec2 cellHash(vec2 p){return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);}
 float caustic(vec2 p){vec2 g=floor(p),f=fract(p);float first=8.,second=8.;for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 o=vec2(float(x),float(y));vec2 h=cellHash(g+o);vec2 r=o+.5+.33*sin(time*.35+6.28318*h)-f;float d=dot(r,r);if(d<first){second=first;first=d;}else if(d<second)second=d;}return 1.-smoothstep(.012,.18,second-first);}
 void main(){vec2 p=(vWater-flow*time*.3)/max(.05,waveScale);vec4 a=texture2D(normalMap,p*.08),b=texture2D(normalMap,p*.19+vec2(time*.003,-time*.002));vec3 normal=normalize(mat3(modelMatrix)*normalize((a.xyz*2.-1.)+(b.xyz*2.-1.)));if(!gl_FrontFacing)normal=-normal;
 vec3 view=normalize(cameraPosition-vWorld);float fresnel=pow(1.-max(0.,dot(view,normal)),3.);
 vec2 warped=p+vec2(sin(p.y*1.4+time*.22),cos(p.x*1.3-time*.17))*.45+vec2(sin(p.y*3.1+p.x*.4),cos(p.x*2.9+p.y*.3))*.13;
 float detail=1.-smoothstep(.12,.65,length(fwidth(warped)));float cells=caustic(warped*.75)*detail,fine=caustic(warped*1.63+vec2(7.2,-3.1))*detail*detail;float depth=.82+.18*sin(p.x*.65+p.y*.4+time*.16);
 vec3 base=waterColor;float gray=dot(base,vec3(.2126,.7152,.0722));base=max(vec3(0.),mix(vec3(gray),base,1.35));
 vec3 color=base*depth;color=mix(color,vec3(.04,.82,.98),fresnel*.26);color+=vec3(.12,.52,.55)*(cells*.26+fine*.04);
 color=mix(color,vec3(.62,1.,1.),pow(cells,3.)*.06);gl_FragColor=vec4(color,opacity);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 #include <fog_fragment>
 }`});
 material.waterNormal=normalTexture;const mesh=new THREE.Mesh(geometry,material);mesh.userData.water=true;mesh.material.userData.outlineParameters={visible:false};geometry.computeBoundingBox();geometry.boundingBox.expandByScalar(n.waveHeight??.05);geometry.computeBoundingSphere();geometry.boundingSphere.radius+=n.waveHeight??.05;
 if(n.waterType==='fountain'){
  const count=240,data=new Float32Array(count*3),g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(data,3).setUsage(THREE.DynamicDrawUsage));const m=new THREE.PointsMaterial({color:'#c5f4ff',size:.055,transparent:true,opacity:.72,depthWrite:false});const drops=new THREE.Points(g,m);drops.frustumCulled=false;mesh.add(drops);
  mesh.userData.animateWater=t=>{const height=n.jetHeight??2;for(let i=0;i<count;i++){const age=(t/(Math.sqrt(8*height/9.81))+(i*.61803398875)%1)%1,angle=i*2.39996322973,r=age*height*.28*(.6+.4*Math.sin(i*17)**2);data[i*3]=Math.cos(angle)*r;data[i*3+1]=4*height*age*(1-age)+.03;data[i*3+2]=Math.sin(angle)*r;}g.attributes.position.needsUpdate=true;};mesh.userData.animateWater(0);
 }return mesh;
}
export function advanceWater(mesh,delta){if(mesh.userData.ocean){mesh.userData.ocean.advance(delta);return;}if(Number.isFinite(delta)&&delta>0)mesh.material.uniforms.time.value+=Math.min(delta,.1);mesh.userData.animateWater?.(mesh.material.uniforms.time.value);}
