export function preciseTransform(label,value,min,max,attributes,output='',unit='',fineStep=.01){
 return `<div class="adjustment precise-adjustment" data-precise-control><span>${label}${unit}</span><label>粗调<input type="number" data-precise-number ${attributes} min="${min}" max="${max}" step="${fineStep}" value="${Number(value)||0}"></label><label>微调<input type="range" data-precise-fine data-fine-step="${fineStep}" min="-100" max="100" step="1" value="0" aria-label="${label}微调"></label><output hidden ${output}>${value}</output></div>`;
}
export function routePreciseInput(node){
 if(node.hasAttribute('data-precise-fine')){
  const number=node.closest('[data-precise-control]').querySelector('[data-precise-number]');node.__fineBase??=Number(number.value);const value=Math.max(Number(number.min),Math.min(Number(number.max),node.__fineBase+Number(node.value)*Number(node.dataset.fineStep)));
  number.value=String(Number(value.toFixed(5)));number.__fineProxy=true;number.dispatchEvent(new Event('input',{bubbles:true}));delete number.__fineProxy;return true;
 }
 if(node.hasAttribute('data-precise-number')&&!node.__fineProxy){const fine=node.closest('[data-precise-control]').querySelector('[data-precise-fine]');fine.value='0';delete fine.__fineBase;}
 return false;
}
document.addEventListener('pointerup',event=>{const node=event.target;if(node.hasAttribute?.('data-precise-fine')){node.value='0';delete node.__fineBase;}});
