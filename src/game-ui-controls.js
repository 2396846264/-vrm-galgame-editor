// Live game and editor preview use the same controls, icons and glass surface.
const paths={
 back:'<path d="M8 7H4V3M4 7c2-3 8-3 11-1 5 4 3 13-5 13H7"/>',
 save:'<path d="M5 3h13l3 3v15H3V3h2Zm2 0v7h10V3M7 21v-7h10v7"/>',
 menu:'<path d="M3 5h18M3 12h18M3 19h18"/>',
 play:'<path fill="currentColor" stroke="none" d="m7 3 15 9L7 21Z"/>',
 book:'<path d="M12 5C8 2 3 3 2 4v15c4-2 7-1 10 1 3-2 6-3 10-1V4c-3-2-7-1-10 1ZM12 5v15"/>',
 bag:'<path d="M5 8h14l2 13H3L5 8Zm3 2V6a4 4 0 0 1 8 0v4"/>',
 window:'<path d="M5 3h14a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Z"/><path d="m8 21-4 3v-5"/>'
};
export const gameIcon=name=>`<svg class="game-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.window}</svg>`;
export const quickButtonLabel=(icon,label)=>`${gameIcon(icon)}<span class="game-button-label">${label}</span>`;
export function gameControlsMarkup({android=false,fullscreen=false,preview=false}={}){
 return `<div class="scene-top-actions">${[['back','stop-play','返回标题'],['menu','settings','设置']].map(([icon,action,label])=>`<button type="button" data-action="${action}" class="scene-icon-button" title="${label}" aria-label="${label}">${gameIcon(icon)}</button>`).join('')}</div><div class="scene-quick-actions"><button type="button" id="auto-play-button" class="auto-play-button ${preview?'':'hidden'}" data-action="auto-toggle" aria-pressed="false" title="自动播放">${quickButtonLabel('play','自动播放')}</button><button type="button" data-action="load-game" title="读档">${quickButtonLabel('book','读档')}</button><button type="button" data-action="save-game" title="存档">${quickButtonLabel('save','存档')}</button><button type="button" data-action="open-inventory" title="物品栏">${quickButtonLabel('bag','物品栏')}</button>${android?'':`<button type="button" data-action="toggle-fullscreen" title="切换全屏">${quickButtonLabel('window',fullscreen?'窗口':'全屏')}</button>`}</div>`;
}
export const dialogueMarkup=(preview=false)=>`<div ${preview?'':'id="dialogue"'} class="dialogue${preview?' visible':''}"><div class="dialogue-copy"><div class="speaker" ${preview?'':'id="dialogue-speaker"'}>${preview?'千早爱音':''}</div><span class="dialogue-wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span><div id="dialogue-text">${preview?'我知道！可是你一盯着我，我就只记得你在盯着我了。':''}</div></div><span class="dialogue-next" aria-hidden="true"></span></div>`;
