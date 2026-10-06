
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {validateEnvironment} from './environment-schema.js';
import {SceneAnimationPlayer} from './scene-animations.js';
const url=a=>`https://project.galgame/${a.path.split('/').map(encodeURIComponent).join('/')}${a.revision?'?v='+encodeURIComponent(a.revision):''}`;
export function createImagePlaneMaterial(texture,node={}) {
  return new (node.unlit===false?THREE.MeshStandardMaterial:THREE.MeshBasicMaterial)({
    map:texture,side:THREE.DoubleSide,transparent:true,depthWrite:false,forceSinglePass:true,
    alphaTest:Math.max(.001,Math.min(1,Number(node.alphaCutoff)||0))
  });
}
export function disposeTree(root) {
  const geometries=new Set(),materials=new Set(),textures=new Set();
  root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}});
  geometries.forEach(v=>v.dispose());materials.forEach(v=>v.dispose());textures.forEach(v=>{v.dispose();v.source?.data?.close?.();});
}
export class EnvironmentRuntime {
  constructor(scene,loader=new GLTFLoader()){this.scene=scene;this.loader=loader;this.root=null;this.request=0;this.key='';this.environmentId='';this.objects=new Map();this.animations=new SceneAnimationPlayer();}
  async load(env,assets,{beforeNode=null}={}) {
    const token=++this.request;
    const key=env?JSON.stringify([{...env,revision:undefined},env.nodes.filter(n=>n.assetId).map(n=>{const a=assets.find(a=>a.id===n.assetId);return [a?.id,a?.path,a?.revision];})]):'';if(key===this.key)return this.objects;
    if(!env){this.clear(false);this.key='';return this.objects;}
    validateEnvironment(env,assets);
    const root=new THREE.Group(), objects=new Map(),models=new Map();
    try {
      // Sequential decode bounds peak memory and makes cleanup deterministic.
      for(const n of env.nodes){
        if(beforeNode)await beforeNode();
        if(token!==this.request){disposeTree(root);return this.objects;}
        let object=new THREE.Group();root.add(object);
        if(n.kind==='ground'){object.add(new THREE.Mesh(new THREE.PlaneGeometry(n.width,n.height),new THREE.MeshStandardMaterial({color:n.color||'#b7bfae',roughness:1,side:THREE.DoubleSide})));object.children[0].receiveShadow=true;object.children[0].castShadow=true;}else if(n.kind==='model'){
          const gltf=await this.loader.loadAsync(url(assets.find(a=>a.id===n.assetId)));object.add(gltf.scene);
          if(gltf.animations?.length)models.set(n.id,{nodeId:n.id,assetId:n.assetId,name:n.name||'GLB 模型',root:gltf.scene,clips:gltf.animations,mixer:new THREE.AnimationMixer(gltf.scene)});
          gltf.scene.traverse(o=>{if(o.isMesh){o.castShadow=n.castShadow!==false;o.receiveShadow=true;}});
        }else if(n.kind==='light'){
          const light=new THREE.PointLight(n.color,n.intensity,n.distance,2);light.castShadow=n.castShadow===true;light.shadow.mapSize.set(512,512);light.shadow.normalBias=.02;object.add(light);
        }else if(n.kind==='sky'){
          let map=null;if(n.assetId){map=await new THREE.TextureLoader().loadAsync(url(assets.find(a=>a.id===n.assetId)));map.colorSpace=THREE.SRGBColorSpace;map.repeat.x=-1;map.offset.x=1;}
          const sky=new THREE.Mesh(new THREE.SphereGeometry(80,48,24),new THREE.MeshBasicMaterial({map,color:map?0xffffff:n.color,side:THREE.BackSide,depthWrite:false}));sky.material.userData.outlineParameters={visible:false};sky.userData.environmentSky=true;sky.frustumCulled=false;sky.renderOrder=-10;object.add(sky);
        }else if(n.kind==='imagePlane'){
          const texture=await new THREE.TextureLoader().loadAsync(url(assets.find(a=>a.id===n.assetId)));texture.colorSpace=THREE.SRGBColorSpace;
          const material=createImagePlaneMaterial(texture,n);
          const board=new THREE.Mesh(new THREE.PlaneGeometry(n.width,n.height),material);board.castShadow=n.unlit===false;board.receiveShadow=n.unlit===false;object.add(board);
        }
        object.name=n.name||n.kind;object.userData.nodeId=n.id;object.position.fromArray(n.position);object.rotation.set(...n.rotation);object.scale.fromArray(n.scale);object.visible=n.visible!==false;objects.set(n.id,object);
        if(token!==this.request){disposeTree(root);return this.objects;}
      }
      for(const n of env.nodes)if(n.parentId)objects.get(n.parentId).add(objects.get(n.id));
      if(token!==this.request){disposeTree(root);return this.objects;}
      this.clear(false);this.root=root;this.objects=objects;this.key=key;this.environmentId=env.id;this.animations=new SceneAnimationPlayer(models);this.scene.add(root);return objects;
    }catch(error){disposeTree(root);throw error;}
  }
  update(camera,delta=0,paused=false){if(!this.root)return;this.animations.update(delta,paused);this.root.updateWorldMatrix(true,true);const position=camera.getWorldPosition(new THREE.Vector3());this.root.traverse(o=>{if(o.userData.environmentSky)o.position.copy(o.parent.worldToLocal(position.clone()));});}
  clear(cancel=true){if(cancel)this.request++;this.animations.dispose();if(this.root){this.scene.remove(this.root);disposeTree(this.root);}this.root=null;this.objects=new Map();this.key='';this.environmentId='';this.animations=new SceneAnimationPlayer();}
}
