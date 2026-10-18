import {motionsForCharacter} from './asset-organization.js';
import {voicesForCharacter} from './dialogue-voices.js';
import {offstageSettings} from './offstage-motion.js';
export function airDialogueEditor(node,ctx,index=0){
 const p=ctx.project(),esc=ctx.escape,options=(rows,id)=>'<option value="">不使用</option>'+rows.map(r=>`<option value="${esc(r.id)}" ${r.id===id?'selected':''}>${esc(r.name)}</option>`).join('');
 return `<section class="air-dialogue-editor"><h2>第 ${index+1} 句对白</h2><p class="tip">人物无需上场；头像会说话、眨眼并播放所选动作。</p>${node.event.combat.dialogues.flatMap((line,i)=>i===index?[[line,i]]:[]).map(([line,i])=>{const off=offstageSettings(line),attr=key=>`data-air-dialogue="${key}" data-index="${i}"`;return `<label class="field"><span>说话角色</span><select ${attr('characterId')}>${options(p.characters,line.characterId)}</select></label><label class="field"><span>显示名字</span><input ${attr('speaker')} value="${esc(line.speaker)}" placeholder="留空时用角色名字"></label><label class="field"><span>对话内容</span><textarea ${attr('text')}>${esc(line.text)}</textarea></label><label class="field"><span>角色配音</span><select ${attr('voiceId')}>${options(voicesForCharacter(p,line.characterId),line.voiceId)}</select></label><label class="field"><span>场外头像动作</span><select ${attr('motionId')}>${options(motionsForCharacter(p,line.characterId),off.motionId)}</select></label><label class="field"><span>循环动作</span><input type="checkbox" ${attr('loop')} ${off.motionOptions.loop!==false?'checked':''}></label><div class="inline-actions"><button data-action="event-air-dialogue-up" data-index="${i}" ${i?'':'disabled'}>上移</button><button data-action="event-air-dialogue-down" data-index="${i}" ${i===node.event.combat.dialogues.length-1?'disabled':''}>下移</button><button data-action="event-air-dialogue-duplicate" data-index="${i}">复制这句</button><button data-action="event-air-dialogue-remove" data-index="${i}">删除这句</button></div>`;}).join('')}</section>`;
}
export function airDialogueInput(c,target){
 const line=c.dialogues[Number(target.dataset.index)];if(!line)return false;const key=target.dataset.airDialogue;
 if(['characterId','speaker','text','voiceId'].includes(key)){line[key]=target.value;if(key==='characterId'){line.voiceId='';line.offstage=offstageSettings();}}
 if(['motionId','loop'].includes(key)){line.offstage=offstageSettings(line);if(key==='loop')line.offstage.motionOptions={...line.offstage.motionOptions,loop:target.checked};else line.offstage.motionId=target.value;}
 return ['text','speaker'].includes(key)?'dialogue-text':'dialogue-select';
}
export function airDialogueAction(c,action,target){
 if(action==='event-air-dialogue-add'){if(c.dialogues.length>=200)throw Error('开战前对话最多 200 句');c.dialogues.push({id:crypto.randomUUID(),characterId:'',speaker:'',text:'',voiceId:'',offstage:offstageSettings()});}
 else if(action==='event-air-dialogue-remove')c.dialogues.splice(Number(target.dataset.index),1);
 else if(action==='event-air-dialogue-up'){const i=Number(target.dataset.index);if(i>0)[c.dialogues[i-1],c.dialogues[i]]=[c.dialogues[i],c.dialogues[i-1]];}
 else if(action==='event-air-dialogue-down'){const i=Number(target.dataset.index);if(i<c.dialogues.length-1)[c.dialogues[i+1],c.dialogues[i]]=[c.dialogues[i],c.dialogues[i+1]];}
 else if(action==='event-air-dialogue-duplicate'){const i=Number(target.dataset.index);if(c.dialogues.length>=200)throw Error('开战前对话最多 200 句');const line=structuredClone(c.dialogues[i]);if(!line)return false;line.id=crypto.randomUUID();c.dialogues.splice(i+1,0,line);}
 else return false;return true;
}

export function airDialogueList(node,ctx,index){
 const esc=ctx.escape,roles=ctx.project().characters,lines=node.event.combat.dialogues;
 return `<div class="list step-list air-step-list">${lines.map((line,i)=>`<button class="list-row ${i===index?'selected':''}" data-action="event-air-dialogue-select" data-index="${i}" ${i===index?'aria-current="true"':''}><span class="number">${i+1}</span><span><b>${esc(line.speaker||roles.find(r=>r.id===line.characterId)?.name||'旁白')}</b><small>${esc(line.text||'空对白')}</small></span></button>`).join('')}<button class="list-row air-settings-row ${index>=lines.length?'selected':''}" data-action="event-air-settings" ${index>=lines.length?'aria-current="true"':''}><span>✈</span><span><b>空战设置</b><small>在所有对话结束后开始空战</small></span></button></div>`;
}
