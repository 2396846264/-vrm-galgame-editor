export const offstageSettings=line=>({motionId:'',expressionWeights:{},...(line?.offstage||{}),motionOptions:{loop:true,placement:'inPlace',...(line?.offstage?.motionOptions||{})}});
export function dialogueResourceLines(act){return act?.event?.type==='aircombat'?act.event.combat?.dialogues||[]:act.steps||[];}
