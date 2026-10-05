export const environmentAmbient = env => Number.isFinite(env?.lighting?.ambientIntensity)
  ? env.lighting.ambientIntensity : Math.min(.35,Math.max(0,Number(env?.lighting?.intensity)||0)*.16);
export class CharacterSceneLighting {
  constructor(){this.originals=new WeakMap();this.roots=new WeakMap();}
  capture(root){
    const materials=new Set();root.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m)materials.add(m);});
    for(const m of materials)if(!this.originals.has(m))this.originals.set(m,{emissiveIntensity:m.emissiveIntensity,
      rim:m.parametricRimColorFactor?.clone(),matcap:m.matcapFactor?.clone(),outlineLightingMixFactor:m.outlineLightingMixFactor});
    this.roots.set(root,materials);return materials;
  }
  apply(root,inEnvironment,anime=false){
    for(const m of this.roots.get(root)||this.capture(root)){
      const original=this.originals.get(m);
      if(original.emissiveIntensity!==undefined)m.emissiveIntensity=inEnvironment?0:original.emissiveIntensity;
      if(original.rim)m.parametricRimColorFactor.copy(original.rim).multiplyScalar(inEnvironment?0:anime?.55:1);
      if(original.matcap)m.matcapFactor.copy(original.matcap).multiplyScalar(inEnvironment?0:anime?.65:1);
      if(original.outlineLightingMixFactor!==undefined)m.outlineLightingMixFactor=inEnvironment?1:original.outlineLightingMixFactor;
    }
  }
}
