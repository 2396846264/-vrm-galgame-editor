import {StylizedPipeline} from './stylized-render.js';
import {applyStylizedMaterials} from './stylized-materials.js';
import {effectiveStyle} from './render-style.js';
import {resolveEventRender,neutralRender} from './render-presets.js';
const neutral=effectiveStyle(neutralRender());
export function applyAirRender(s,project={}){
 const settings=resolveEventRender(project,s.node),style=effectiveStyle(settings),key=JSON.stringify(settings);if(s.airRenderKey===key)return;
 s.airRenderKey=key;s.renderSettings=settings;
 s.root.querySelector('canvas').style.filter=`brightness(${settings.brightness}%) contrast(${settings.contrast}%) saturate(${settings.saturation}%)`;
 const effects=Object.keys(style).some(k=>style[k]!==neutral[k]);
 if(effects){if(!s.stylePipeline)s.stylePipeline=new StylizedPipeline(s);else s.stylePipeline.update(settings);const w=s.root.clientWidth,h=s.root.clientHeight;if(w&&h)s.stylePipeline.resize(w,h);}
 else{s.stylePipeline?.dispose();s.stylePipeline=null;}
 if(style.toon>0||style.specular!==1||s.stylizedMaterials){s.originalRenderMaterials||=new WeakMap();applyStylizedMaterials(s.scene,style,null,s.originalRenderMaterials);s.stylizedMaterials=true;}
}
export function renderAirScene(s,dt){if(s.stylePipeline)s.stylePipeline.render(dt);else s.renderer.render(s.scene,s.camera);}
