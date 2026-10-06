export function applyStylizedMaterials(root,style,lighting,originals){
 root.traverse(object=>{if(!object.isMesh)return;const materials=Array.isArray(object.material)?object.material:[object.material];
  if(materials.length&&materials.every(material=>material?.isOutline))object.visible=false;
  for(const material of materials){if(!material)continue;
   material.userData.outlineParameters={visible:false};
   if(material.isMToonMaterial){let original=originals.get(material);if(!original){original={toony:material.shadingToonyFactor,shift:material.shadingShiftFactor};originals.set(material,original);}material.shadingToonyFactor=original.toony+(Math.max(original.toony,.96)-original.toony)*style.toon;material.shadingShiftFactor=original.shift-.02*style.toon;material.outlineWidthFactor=0;material.outlineWidthMode='none';if(material.userData.nprLighting)material.userData.nprLighting.strength.value=0;continue;}
   if(!material.isMeshStandardMaterial&&!material.isMeshPhongMaterial&&!material.isMeshLambertMaterial)continue;
   let state=material.userData.nprLighting;
   if(!state){state={strength:{value:0},steps:{value:3},compile:material.onBeforeCompile,cache:material.customProgramCacheKey};material.userData.nprLighting=state;
    material.onBeforeCompile=function(shader,renderer){state.compile?.call(this,shader,renderer);shader.uniforms.nprStrength=state.strength;shader.uniforms.nprSteps=state.steps;
     shader.fragmentShader='uniform float nprStrength;uniform float nprSteps;\n'+shader.fragmentShader;
     shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
       float nprLum=max(dot(reflectedLight.directDiffuse/max(diffuseColor.rgb,vec3(.001)),vec3(.2126,.7152,.0722)),.00001);
       float nprBand=max(.06,floor(nprLum*nprSteps+.5)/nprSteps);
       reflectedLight.directDiffuse*=mix(1.,clamp(nprBand/nprLum,.4,1.7),nprStrength*.65);
       reflectedLight.directSpecular*=1.-.7*nprStrength;
     `);};
    material.customProgramCacheKey=function(){return (state.cache?.call(this)||'')+'|npr-ramp-v2';};material.needsUpdate=true;
   }
   state.strength.value=style.toon;
  }
 });
 lighting?.apply(root,true,false);
}
