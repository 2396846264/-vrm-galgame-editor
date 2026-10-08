export function uniformScaleValue(scale){return Math.cbrt(scale[0]*scale[1]*scale[2]);}
export function uniformScaleVector(scale,value){
 const original=uniformScaleValue(scale);if(!Number.isFinite(value)||value<=0||!Number.isFinite(original)||original<=0)throw Error('缩放请输入大于零的数');
 const result=scale.map(axis=>axis*value/original);if(result.some(v=>v<.0001||v>10000))throw Error('等比缩放超出允许范围');return result;
}
