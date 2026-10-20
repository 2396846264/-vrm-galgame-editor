// Fine adjustment is relative to the saved placement, including positions from
// the first-person grabber. It never validates that position against HTML steps.
export function castFineControls(popup){
 for(const control of popup.querySelectorAll('[data-precise-control]')){
  const number=control.querySelector('[data-draft-cast-adjust]'),slider=control.querySelector('[data-precise-fine]');if(!number||!slider)continue;
  const key=number.dataset.draftCastAdjust.split('.')[1],increment=Number(slider.dataset.fineStep)||.01;
  slider.dataset.draftCastAdjust=number.dataset.draftCastAdjust;slider.dataset.draftCastValue=String(Number(number.value)||0);
  number.closest('label').remove();control.removeAttribute('data-precise-control');slider.removeAttribute('data-precise-fine');
  const readout=control.querySelector('output');readout.hidden=false;readout.className='cast-fine-value';
  const show=()=>{const value=Number(slider.dataset.draftCastValue),text=String(Number(value.toFixed(3)))+(key==='size'?'%':['yaw','pitch'].includes(key)?'°':' 米');readout.value=text;slider.setAttribute('aria-valuetext',text);};
  let base=null;
  slider.addEventListener('input',()=>{base??=Number(slider.dataset.draftCastValue);let value=base+Number(slider.value)*increment;if(key==='size')value=Math.max(50,Math.min(500,value));if(['yaw','pitch'].includes(key))value=Math.max(-360,Math.min(360,value));slider.dataset.draftCastValue=String(Number(value.toFixed(5)));show();});
  const reset=()=>{base=null;slider.value='0';};slider.addEventListener('change',reset);slider.addEventListener('pointercancel',reset);slider.addEventListener('blur',reset);show();
 }
}
