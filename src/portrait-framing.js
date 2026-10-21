const finite=(value,fallback)=>value!=null&&value!==''&&Number.isFinite(Number(value))?Number(value):fallback;
export function normalizePortraitFraming(value){return {offsetX:Math.max(-100,Math.min(100,finite(value?.offsetX,0))),offsetY:Math.max(-100,Math.min(100,finite(value?.offsetY,0))),scale:Math.max(.25,Math.min(3,finite(value?.scale,1)))};}
export function framePortraitCamera(camera,value){
 const {offsetX,offsetY,scale}=normalizePortraitFraming(value),width=(camera.right-camera.left)/scale,height=(camera.top-camera.bottom)/scale;
 const x=(camera.left+camera.right)/2-width*offsetX/100,y=(camera.bottom+camera.top)/2-height*offsetY/100;
 camera.left=x-width/2;camera.right=x+width/2;camera.bottom=y-height/2;camera.top=y+height/2;camera.updateProjectionMatrix();
}
export function readPortraitFraming(root){const value={};for(const node of root?.querySelectorAll('[data-portrait-framing]')||[])value[node.dataset.portraitFraming]=Number(node.value)/(node.dataset.portraitFraming==='scale'?100:1);return normalizePortraitFraming(value);}
