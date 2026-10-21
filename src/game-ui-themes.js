// All skins share the same composition and behavior; only their surfaces differ.
export const gameUiPresets=[{id:'classic',name:'液态玻璃',description:'透明磨砂与柔和高光',paletteEditable:false},{id:'pink-pop',name:'粉白星光',description:'半透明白底、粉色强调与浅灰按钮',paletteEditable:false},{id:'wechat-green',name:'青柠浅色',description:'浅灰底色、白色控件与绿色消息气泡',paletteEditable:false},{id:'wechat-dark',name:'青柠深色',description:'深灰界面与鲜明的青绿色',paletteEditable:false}];
export function normalizeGameUi(value){return gameUiPresets.some(p=>p.id===value)?value:'classic';}
export const gameTitleActions=[['继续游戏','continue-game'],['开始游戏','play'],['载入游戏','load-game'],['系统设置','settings'],['附加鉴赏','gallery'],['资料库','knowledge-open'],['角色详情','role-details'],['游玩进度','play-progress'],['退出游戏','exit-game']];
