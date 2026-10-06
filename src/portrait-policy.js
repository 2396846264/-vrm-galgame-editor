export function canGeneratePortrait(item,modelType,hasPortrait,force=false,userCapture=false){
  if(!item||!['vrm','fbxCharacter'].includes(modelType))return false;
  if(hasPortrait&&item.portraitSource==='manual'&&!userCapture)return false;
  return force||!hasPortrait;
}
