// Old archive fields are validated for compatibility; no configurable loading UI remains.
export const loadingStyles = [
 ['orbit','追光圆点'],['ring','弧光圆环'],['bars','律动音阶'],['pulse','呼吸光点'],
 ['radar','战术雷达'],['tiles','终端方块'],['petals','花瓣轮转'],['hourglass','时光沙漏']
];
export const uiLayouts=[['auto','跟随风格'],['bottom','底部横排'],['left','左侧目录'],['right','右侧模块'],['top','顶部导航']];
export function normalizeUiLayout(value){return uiLayouts.some(([id])=>id===value)?value:'auto';}
export function normalizeLoading(value){
 return {style:loadingStyles.some(([id])=>id===value?.style)?value.style:'orbit',
 color:typeof value?.color==='string'&&/^#[0-9a-f]{6}$/i.test(value.color)?value.color.toLowerCase():'#67c6b0',
 speed:Number.isFinite(Number(value?.speed))?Math.max(.5,Math.min(2,Number(value.speed))):1,
 position:['center','bottom-right','bottom'].includes(value?.position)?value.position:'center'};
}
