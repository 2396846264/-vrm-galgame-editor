export function applyStylizedMaterials(root,style,lighting,originals){
 root.traverse(object=>{if(!object.isMesh)return;const materials=Array.isArray(object.material)?object.material:[object.material];
  if(materials.length&&materials.every(material=>material?.isOutline))object.visible=false;
  for(const material of materials){if(!material)continue;
   material.userData.outlineParameters={visible:false};
   if(material.isMToonMaterial){let original=originals.get(material);if(!original){original={toony:material.shadingToonyFactor,shift:material.shadingShiftFactor};originals.set(material,original);}material.shadingToonyFactor=original.toony;material.shadingShiftFactor=original.shift;material.outlineWidthFactor=0;material.outlineWidthMode='none';}
   if(!material.isMToonMaterial&&!material.isMeshStandardMaterial&&!material.isMeshPhongMaterial&&!material.isMeshLambertMaterial&&!material.isMMDToonMaterial)continue;
   let state=material.userData.nprLighting;
   if(!state){state={strength:{value:0},steps:{value:3},threshold:{value:0},softness:{value:0},specular:{value:1},compile:material.onBeforeCompile,cache:material.customProgramCacheKey};material.userData.nprLighting=state;
    material.onBeforeCompile=function(shader,renderer){state.compile?.call(this,shader,renderer);shader.uniforms.nprStrength=state.strength;shader.uniforms.nprSteps=state.steps;shader.uniforms.nprThreshold=state.threshold;shader.uniforms.nprSoftness=state.softness;shader.uniforms.nprSpecular=state.specular;
     shader.fragmentShader='uniform float nprStrength;uniform float nprSteps;uniform float nprThreshold;uniform float nprSoftness;uniform float nprSpecular;\n'+shader.fragmentShader;
     if(material.isMToonMaterial){
      shader.fragmentShader=shader.fragmentShader.replace('return shading;',`float nprContinuous=clamp((dotNL+shadingShift+nprThreshold)*.5+.5,0.,1.);
       float nprLayer=floor(nprContinuous*(nprSteps-1.)+.5)/(nprSteps-1.);
       return mix(shading,mix(nprLayer,nprContinuous,nprSoftness)*shadow,nprStrength);`);
      shader.fragmentShader=shader.fragmentShader.replaceAll('getDiffuse( material, shading, directLight.color )','getDiffuse( material, shading, directLight.color )*mix(1.,mix(.42,1.,shading),nprStrength)');
     }else{
      if(material.isMMDToonMaterial){
       // The imported MMD ramp is already banded. Quantizing its total light
       // again barely changes it, so custom bands use the surface/light angle.
       shader.fragmentShader=shader.fragmentShader.replace('vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;',`vec3 nprOriginalRamp=getGradientIrradiance(geometryNormal,directLight.direction);
        float nprContinuous=clamp(dot(geometryNormal,directLight.direction)*.5+.5+nprThreshold,0.,1.);
        float nprLayer=floor(nprContinuous*(nprSteps-1.)+.5)/(nprSteps-1.);
        vec3 irradiance=mix(nprOriginalRamp,vec3(mix(.35,1.,mix(nprLayer,nprContinuous,nprSoftness))),nprStrength)*directLight.color;`);
       shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>','#include <lights_fragment_end>\nreflectedLight.directSpecular*=(1.-.7*nprStrength)*nprSpecular;');
      }else shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
       float nprLum=max(dot(reflectedLight.directDiffuse/max(diffuseColor.rgb,vec3(.001)),vec3(.2126,.7152,.0722)),.00001);
       float nprBand=max(.06,floor(max(0.,nprLum+nprThreshold)*nprSteps+.5)/nprSteps);nprBand=mix(nprBand,nprLum,nprSoftness);
       reflectedLight.directDiffuse*=mix(1.,clamp(nprBand/nprLum,.4,1.7),nprStrength*.65);
       reflectedLight.directSpecular*=(1.-.7*nprStrength)*nprSpecular;
     `);
      if(material.isMMDToonMaterial)shader.fragmentShader=shader.fragmentShader.replace('outgoingLight += matcapColor.rgb;','outgoingLight += matcapColor.rgb*nprSpecular;').replace('outgoingLight *= matcapColor.rgb;','outgoingLight *= pow(max(matcapColor.rgb,vec3(.001)),vec3(nprSpecular));');
     }
    };
    material.customProgramCacheKey=function(){return (state.cache?.call(this)||'')+'|npr-ramp-v5';};material.needsUpdate=true;
   }
   state.strength.value=style.toon;state.steps.value=style.toonSteps;state.threshold.value=style.toonThreshold;state.softness.value=style.toonSoftness;state.specular.value=style.specular;
  }
 });
 lighting?.apply(root,true,false);
}
