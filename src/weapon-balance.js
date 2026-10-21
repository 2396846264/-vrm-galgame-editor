// Deliberately game-balanced values; calibre is in millimetres, time in seconds.
export const caliberDamage=c=>Math.round(5*(Math.max(7.7,c||7.7)/7.7)**1.65);
export const caliberGravity=c=>1.2*Math.sqrt(Math.max(7.7,c||7.7)/7.7);
export function turretRateLimits(d={}){const c=d.caliber||12.7,limit=d.naval?(c>=203?Math.min(45,20*203/c):60):60;return {yaw:limit,pitch:limit};}
export function ammunitionFor(d,targetShip=false,settings={}){
 if(d.customWeapon)return {ammoType:d.customWeapon.ammoType,fuze:d.customWeapon.ammoType==='type3'?'proximity':!targetShip&&d.dualPurpose&&d.caliber>=100?'proximity':'impact'};
 const c=d.caliber||12.7;
 if(!d.naval)return {ammoType:'kinetic',fuze:'impact'};
 if(targetShip)return {ammoType:settings.surfaceAmmo==='he'?'he':'ap',fuze:'impact'};
 if(d.dualPurpose&&c>=100)return {ammoType:'he',fuze:'proximity'};
 if(c>=203)return {ammoType:'type3',fuze:'proximity'};
 if(c>=76)return {ammoType:'he',fuze:settings.fuze==='impact'?'proximity':settings.fuze||d.fuze||'timed'};
 return {ammoType:'kinetic',fuze:'impact'};
}
export function loadingProfile(d={}){
 if(d.customWeapon){const w=d.customWeapon;return {capacity:w.magazine?w.capacity:Math.max(1,w.barrels.length),burst:w.magazine?w.capacity:1,burstPause:0,reload:w.magazine?w.reload:0,interval:60/w.rpm,initialLoaded:true};}
 if(!d.naval)return null;
 const c=d.caliber||20;
 if(c<=25)return {capacity:40,burst:4,burstPause:1.2,reload:20,interval:.4};
 if(c<=40)return {capacity:16,burst:4,burstPause:1.5,reload:16,interval:.5};
 return {capacity:1,burst:1,burstPause:0,reload:c<100?6:c<203?8:c<300?12.5:c<400?25:40,interval:0};
}
// A loaded round is a snapshot. Losing/changing targets never replaces it.
export function tickWeaponCycle(p,dt,target){
 const cfg=loadingProfile(p.def);if(!cfg)return null;
 let c=p.weaponCycle;
 if(!c){c=p.weaponCycle={round:null,remaining:0,burstLeft:cfg.burst,cooldown:0,reloading:false,reloads:0};}
 c.cooldown=Math.max(0,c.cooldown-dt);
 if(c.reloading){c.remaining=Math.max(0,c.remaining-dt);if(c.remaining<=1e-8){c.reloading=false;c.loaded=cfg.capacity;c.burstLeft=cfg.burst;c.reloads++;}}
 if(!c.round&&target&&p.ammo>0){c.round={...ammunitionFor(p.def,Boolean(target.flight.ship),p)};c.loaded=cfg.capacity;c.burstLeft=cfg.burst;if(c.initialized||cfg.capacity===1&&!cfg.initialLoaded){c.reloading=true;c.remaining=cfg.reload;}c.initialized=true;}
 return c;
}
export const weaponReady=p=>Boolean(p.weaponCycle?.round&&!p.weaponCycle.reloading&&p.weaponCycle.cooldown<=1e-8&&p.weaponCycle.loaded>0);
export function consumeWeaponRound(p,ignoreCooldown=false){const c=p.weaponCycle,cfg=loadingProfile(p.def);if(!cfg||!(ignoreCooldown?c?.round&&!c.reloading&&c.loaded>0:weaponReady(p)))return false;c.loaded--;c.burstLeft--;c.cooldown=cfg.interval;
 if(c.loaded===0){c.round=null;c.reloading=false;c.remaining=0;c.burstLeft=cfg.burst;}
 else if(c.burstLeft===0){c.cooldown=Math.max(c.cooldown,cfg.burstPause);c.burstLeft=cfg.burst;}
 return true;
}
export function beginMagazineReload(p,target){const c=p.weaponCycle,cfg=loadingProfile(p.def);if(!cfg||!c||c.round||p.ammo<=0||!target)return;
 c.round={...ammunitionFor(p.def,Boolean(target.flight.ship),p)};c.reloading=true;c.remaining=cfg.reload;c.loaded=cfg.capacity;c.burstLeft=cfg.burst;
}
