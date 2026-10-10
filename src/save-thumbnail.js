// Save a small actual game screenshot, never the save/settings window.
export async function captureSaveThumbnail(frame,capture) {
  if(!frame?.isConnected)return '';
  const root=frame.ownerDocument.documentElement;
  root.classList.add('save-capturing');
  try {
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const area=frame.getBoundingClientRect();
    const result=await capture({x:area.x,y:area.y,width:area.width,height:area.height,viewportWidth:innerWidth,viewportHeight:innerHeight});
    return validSaveThumbnail(result?.dataUrl) ? result.dataUrl : '';
  } finally { root.classList.remove('save-capturing'); }
}
export function validSaveThumbnail(value) {
  return typeof value==='string'&&value.length<=120000&&/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(value);
}
