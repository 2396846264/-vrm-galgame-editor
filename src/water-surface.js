import * as THREE from 'three';
// Procedural water: no network textures, no extra reflection passes per surface.
export const waterPresets={lake:{name:'平静水面',width:20,height:20,color:'#397b94',waveHeight:.05,waveScale:3,flowSpeed:0,flowAngle:0,opacity:.88},river:{name:'流水 / 河道',width:4,height:24,color:'#27849a',waveHeight:.08,waveScale:1.8,flowSpeed:1.3,flowAngle:90,opacity:.85},waterfall:{name:'瀑布 / 水帘',width:5,height:8,color:'#71aebb',waveHeight:.025,waveScale:.5,flowSpeed:2.5,flowAngle:90,opacity:.75,rotation:[Math.PI/2,0,0]}};
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
 const geometry=new THREE.PlaneGeometry(n.width,n.height,Math.min(96,Math.max(8,Math.ceil(n.width/2))),Math.min(96,Math.max(8,Math.ceil(n.height/2))));geometry.rotateX(-Math.PI/2);
 const angle=(n.flowAngle||0)*Math.PI/180,normalTexture=waterNormals();
 const material=new THREE.ShaderMaterial({transparent:(n.opacity??1)<1,depthWrite:true,side:THREE.DoubleSide,fog:true,uniforms:THREE.UniformsUtils.merge([THREE.UniformsLib.fog,{normalMap:{value:normalTexture},time:{value:0},surfaceOffset:{value:new THREE.Vector2()},waterColor:{value:new THREE.Color(n.color||'#12617d')},waveHeight:{value:n.waveHeight??.05},waveScale:{value:n.waveScale??3},flow:{value:new THREE.Vector2(Math.cos(angle),Math.sin(angle)).multiplyScalar(n.flowSpeed??0)},opacity:{value:n.opacity??1}}]),vertexShader:`uniform vec2 surfaceOffset;uniform float time;uniform float waveHeight;uniform float waveScale;uniform vec2 flow;varying vec3 vWorld;varying vec2 vWater;
 #include <fog_pars_vertex>
 void main(){vec3 p=position;vWater=p.xz+surfaceOffset;vec2 w=(vWater-flow*time)/waveScale;p.y+=waveHeight*(sin(w.x*.8+time*.65)*.6+sin(w.y*.65-time*.45)*.4);vec4 world=modelMatrix*vec4(p,1.);vWorld=world.xyz;vec4 mvPosition=viewMatrix*world;gl_Position=projectionMatrix*mvPosition;
 #include <fog_vertex>
 }`,fragmentShader:`uniform sampler2D normalMap;uniform mat4 modelMatrix;uniform float time;uniform vec3 waterColor;uniform float waveHeight;uniform float waveScale;uniform vec2 flow;uniform float opacity;varying vec3 vWorld;varying vec2 vWater;
 #include <fog_pars_fragment>
 void main(){vec2 p=(vWater-flow*time)/max(.05,waveScale);vec4 a=texture2D(normalMap,p*.08),b=texture2D(normalMap,p*.19+vec2(time*.003,-time*.002));float wave=(a.a+b.a-1.)*4.;vec3 normal=normalize((a.xyz*2.-1.)+(b.xyz*2.-1.));normal=normalize(mat3(modelMatrix)*normal);if(!gl_FrontFacing)normal=-normal;vec3 view=normalize(cameraPosition-vWorld);float fresnel=pow(1.-max(0.,dot(view,normal)),3.);vec3 reflected=mix(vec3(.28,.52,.68),vec3(.67,.82,.91),fresnel);vec3 color=mix(waterColor*(.82+wave*.045),reflected,.18+fresnel*.62);vec3 sun=normalize(vec3(.4,.75,.35));float sparkle=pow(max(0.,dot(normal,normalize(view+sun))),100.);color+=vec3(1.,.92,.74)*sparkle*.65;float foam=smoothstep(1.74,2.,wave)*min(.18,length(flow)*.08);color=mix(color,vec3(.75,.92,.96),foam);gl_FragColor=vec4(color,opacity);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 #include <fog_fragment>
 }`});
 material.waterNormal=normalTexture;const mesh=new THREE.Mesh(geometry,material);mesh.userData.water=true;mesh.material.userData.outlineParameters={visible:false};geometry.computeBoundingBox();geometry.boundingBox.expandByScalar(n.waveHeight??.05);geometry.computeBoundingSphere();geometry.boundingSphere.radius+=n.waveHeight??.05;return mesh;
}
export function advanceWater(mesh,delta){if(Number.isFinite(delta)&&delta>0)mesh.material.uniforms.time.value+=Math.min(delta,.1);}
