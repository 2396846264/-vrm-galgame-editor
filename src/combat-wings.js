export const wingCapacity=6;
const clone=x=>structuredClone(x);
// Keep slot identity while migrating old seven-slot wings. Never duplicate the player.
export function normalizeCombatWings(value,normalizeAircraft,fallback){
 fallback=normalizeAircraft(fallback);
 const source=Array.isArray(value.allyWings)?value.allyWings.slice(0,4):[];
 if(!source.length)return{allyWings:[],playerWingId:'',playerSlot:-1,aircraft:fallback,allies:Math.max(0,Math.min(15,Math.round(Number(value.allies) || 0)))};
 const wings=[],seen=new Set(),overflow=[];let player=null,ai=0;
 for(let i=0;i<source.length;i++){
  const w=source[i],base=String(w.id||'wing-'+i);let id=base;while(seen.has(id))id+='-copy';seen.add(id);
  const altitude=Math.max(150,Math.min(6000,Number(w.altitude)||700)),formation=['v','lineAbreast','singleColumn'].includes(w.formation)?w.formation:'v',next={id,altitude,formation,spawnOnCarrier:w.spawnOnCarrier===undefined?Boolean(value.startOnGround):Boolean(w.spawnOnCarrier),carrierId:String(w.carrierId||''),carrierIndex:Math.max(0,Math.round(Number(w.carrierIndex)||0)),aircrafts:[]};wings.push(next);
  const rows=(Array.isArray(w.aircrafts)?w.aircrafts:[]).slice(0,7);
  for(let slot=0;slot<rows.length;slot++){
   const a=rows[slot],selected=base===String(value.playerWingId)&&slot===Number(value.playerSlot)&&!player&&!overflow.some(o=>o.selected);
   let blueprint=null;if(a&&(selected||ai<15)){blueprint=normalizeAircraft(a);if(!selected)ai++;}
   if(slot>=wingCapacity){if(blueprint)overflow.push({blueprint,selected});continue;}next.aircrafts.push(blueprint);if(blueprint&&selected)player={wing:next,slot};
  }
 }
 for(const entry of overflow){let w=wings.find(w=>w.aircrafts.filter(Boolean).length<wingCapacity);if(!w&&wings.length<4){w={id:'overflow-wing',formation:'v',altitude:700,spawnOnCarrier:Boolean(value.startOnGround),carrierId:'',carrierIndex:0,aircrafts:[]};wings.push(w);}if(!w)continue;let slot=w.aircrafts.findIndex(a=>!a);if(slot<0)slot=w.aircrafts.length;w.aircrafts[slot]=entry.blueprint;if(entry.selected)player={wing:w,slot};}
 if(!player){let w=wings.find(w=>w.aircrafts.filter(Boolean).length<wingCapacity);if(!w){w={id:'player-wing',formation:'v',spawnOnCarrier:Boolean(value.startOnGround),carrierId:'',carrierIndex:0,altitude:Math.max(150,Math.min(6000,Number(value.altitude)||600)),aircrafts:[]};wings.push(w);}let slot=w.aircrafts.findIndex(a=>!a);if(slot<0)slot=w.aircrafts.length;w.aircrafts[slot]=clone(fallback);player={wing:w,slot};}
 return{allyWings:wings,playerWingId:player.wing.id,playerSlot:player.slot,aircraft:clone(player.wing.aircrafts[player.slot]),allies:ai};
}
export function ensureWingComposition(c){
 if(c.allyWings?.length)return;
 const aircraft=[c.aircraft,...Array.from({length:c.allies},()=>c.allyAircraft)];
 c.allyWings=[];for(let i=0;i<aircraft.length;i+=wingCapacity)c.allyWings.push({id:'legacy-wing-'+i/wingCapacity,formation:'v',altitude:c.altitude,spawnOnCarrier:Boolean(c.startOnGround),carrierId:'',carrierIndex:0,aircrafts:aircraft.slice(i,i+wingCapacity).map(clone)});
 c.playerWingId=c.allyWings[0].id;c.playerSlot=0;
}
export function isPlayerSlot(c,w,slot){return c.playerWingId===w.id&&c.playerSlot===slot;}
export function wingSpawns(c,offsets){const rows=[];for(let wi=0;wi<c.allyWings.length;wi++){const w=c.allyWings[wi],positions=offsets(w.formation,wingCapacity);for(let slot=0;slot<w.aircrafts.length;slot++){const blueprint=w.aircrafts[slot];if(!blueprint)continue;rows.push({team:isPlayerSlot(c,w,slot)?'player':'ally',wingId:w.id,spawnOnCarrier:w.spawnOnCarrier,carrierId:w.carrierId,carrierIndex:w.carrierIndex,slot,blueprint,altitude:w.altitude,position:[positions[slot][0]+(wi-(c.allyWings.length-1)/2)*12000,w.altitude,positions[slot][1]]});}}return rows.sort((a,b)=>(b.team==='player')-(a.team==='player'));}
