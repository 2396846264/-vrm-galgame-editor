import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {gameUiPresets,gameTitleActions} from '../src/game-ui-themes.js';
import {normalizeGameUi,gameUiPicker} from '../src/game-ui.js';
import {gameControlsMarkup} from '../src/game-ui-controls.js';
import {gameLoadingMarkup} from '../src/game-ui-composition.js';
import {characterNameColor,validNameColor} from '../src/character-name-color.js';
import {editAgentProject} from '../src/project-agent-operations.js';
import {mergeEditorProject} from '../src/editor-project-merge.js';
assert.equal(gameUiPresets.length,4);
assert.deepEqual(gameUiPresets.slice(2).map(p=>p.name),['青柠浅色','青柠深色']);
assert(!/微信|WeChat/i.test(gameUiPresets.map(p=>p.name+' '+p.description).join(' ')));
for(const old of ['pop','terminal','tactical','ark','heian','noir','astral',null])assert.equal(normalizeGameUi(old),'classic');
assert.equal(normalizeGameUi('pink-pop'),'pink-pop');assert.equal(gameTitleActions.length,9);assert.equal(gameTitleActions[5][1],'knowledge-open');
assert(!/knowledge-title-button|game-ui-preset|data-palette-color|name="loading-|name="ui-layout/.test(gameUiPicker()));
const controls=gameControlsMarkup();assert.equal((controls.match(/<button /g)||[]).length,7);assert.equal((controls.match(/<svg /g)||[]).length,7);
assert(!gameControlsMarkup({android:true}).includes('toggle-fullscreen'));
assert.equal(gameLoadingMarkup({gameTheme:'ark',loading:{style:'radar',color:'#ff0000'}}),gameLoadingMarkup());
assert.equal(characterNameColor(), '#ffbfdc');assert.equal(characterNameColor({nameColor:'#6BC9FF'}),'#6bc9ff');assert(!validNameColor('red'));assert(!validNameColor('#fff;opacity:0'));
const project={id:'colors',ui:{},title:{actors:[]},assets:[],characters:[{id:'a',name:'保存',nameColor:'#6bc9ff'},{id:'b',name:'保存',nameColor:'#e6a1d5'}],acts:[],items:[],knowledgeBooks:[],environments:[],assetFolders:[],renderPresets:[]};
const next=editAgentProject(project,[{action:'update',kind:'character',id:'a',data:{nameColor:'#abcdef'}}]).project;
assert.equal(next.characters[0].nameColor,'#abcdef');assert.equal(next.characters[1].nameColor,'#e6a1d5');assert.equal(project.characters[0].nameColor,'#6bc9ff');
assert.throws(()=>editAgentProject(project,[{action:'update',kind:'character',id:'a',data:{nameColor:'red'}}]));
assert.deepEqual(JSON.parse(JSON.stringify(next)).characters,next.characters);
for(const name of ['game-ui-styles.css','game-ui-alignment.css','game-ui-palette.css','game-ui-palette-editor.js','game-ui-palette-editor.css','game-ui-library.js'])assert(!existsSync('src/'+name));
const main=readFileSync('src/main.js','utf8');assert(!main.includes('applyGamePalette('));assert(main.includes("node.style.setProperty('--speaker-color',characterNameColor(character(characterId)))"));
console.log('PASS: four skins with one composition, nine bottom actions, seven icon controls, no legacy style/customization code, immutable independent character colors and API/serialization.');

const {playerGameSkin,rememberGameSkin}=await import('../src/game-ui-skin.js');const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
assert.equal(playerGameSkin({id:'a',ui:{gameTheme:'pink-pop'}},storage),'pink-pop');rememberGameSkin({id:'a'},'classic',storage);assert.equal(playerGameSkin({id:'a',ui:{gameTheme:'pink-pop'}},storage),'classic');assert.equal(playerGameSkin({id:'b',ui:{gameTheme:'pink-pop'}},storage),'pink-pop');
assert.equal(editAgentProject(project,[{action:'update',kind:'ui',data:{gameTheme:'pink-pop'}}]).project.ui.gameTheme,'pink-pop');

for(const value of ['wechat-green','wechat-dark']){assert.equal(normalizeGameUi(value),value);assert.equal(editAgentProject(project,[{action:'update',kind:'ui',data:{gameTheme:value}}]).project.ui.gameTheme,value);}
