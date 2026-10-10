export function unlockedRoles(roles,isUnlocked){return roles.filter(role=>isUnlocked(role.id));}
export function roleWindow(length,index,radius=5){
  if(!length)return [];
  index=Math.max(0,Math.min(length-1,index));
  return Array.from({length:Math.min(length-1,index+radius)-Math.max(0,index-radius)+1},(_,i)=>Math.max(0,index-radius)+i);
}
export function roleLoadOrder(length,index){return roleWindow(length,index).sort((a,b)=>Math.abs(a-index)-Math.abs(b-index)||a-b);}
export function rolePlacement(distance){return {size:1,offsetX:distance,offsetY:0,offsetZ:-distance*.32,yaw:distance===0?0:-Math.sign(distance)*16,pitch:0};}
