import {gameUiPresets,normalizeGameUi} from './game-ui-themes.js';
const key=project=>'vrm-player-ui-'+project.id;
export function playerGameSkin(project,storage){let value;try{value=storage?.getItem(key(project));}catch{}return gameUiPresets.some(p=>p.id===value)?value:normalizeGameUi(project.ui?.gameTheme);}
export function rememberGameSkin(project,value,storage){const skin=normalizeGameUi(value);try{storage?.setItem(key(project),skin);}catch{}return skin;}
