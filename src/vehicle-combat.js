import * as THREE from 'three';
import {normalizeWeaponSettings} from './vehicle-weapon-settings.js';
// Angular acceleration and axis limits are part of the mount, not the target selection.
export function aimTurret(previous,direction,dt,settings={}){
 const cfg=normalizeWeaponSettings(settings,settings),rad=Math.PI/180,desiredYaw=Math.atan2(-direction.x,-direction.z),desiredPitch=Math.asin(THREE.MathUtils.clamp(direction.y,-1,1)),minPitch=(settings.minPitch??-14.3)*rad,maxPitch=(settings.maxPitch??77.35)*rad;
 const minYaw=(settings.minYaw??-180)*rad,maxYaw=(settings.maxYaw??180)*rad,full=maxYaw-minYaw>=Math.PI*2-.0001,goal=THREE.MathUtils.clamp(desiredYaw,minYaw,maxYaw),yawError=full?Math.atan2(Math.sin(desiredYaw-previous.yaw),Math.cos(desiredYaw-previous.yaw)):goal-previous.yaw,pitchError=THREE.MathUtils.clamp(desiredPitch,minPitch,maxPitch)-previous.pitch,acc=cfg.traverseAcceleration*rad;
 const axis=(error,velocity,limit)=>{velocity=THREE.MathUtils.clamp(velocity,-limit,limit);const wanted=Math.sign(error)*Math.min(limit,Math.sqrt(2*acc*Math.abs(error))),speed=THREE.MathUtils.clamp(velocity+THREE.MathUtils.clamp(wanted-velocity,-acc*dt,acc*dt),-limit,limit);let delta=speed*dt;if(Math.sign(delta)===Math.sign(error)&&Math.abs(delta)>=Math.abs(error))return {delta:error,speed:0};return{delta,speed};};
 const y=axis(yawError,previous.yawVelocity||0,cfg.yawRate*rad),p=axis(pitchError,previous.pitchVelocity||0,cfg.pitchRate*rad),yaw=full?previous.yaw+y.delta:THREE.MathUtils.clamp(previous.yaw+y.delta,minYaw,maxYaw),pitch=THREE.MathUtils.clamp(previous.pitch+p.delta,minPitch,maxPitch),barrel=new THREE.Vector3(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));
 return {yaw,pitch,yawVelocity:y.speed,pitchVelocity:p.speed,delta:y.delta,direction:barrel,canFire:(full||desiredYaw>=minYaw-1e-6&&desiredYaw<=maxYaw+1e-6)&&desiredPitch>=minPitch&&desiredPitch<=maxPitch&&barrel.dot(direction)>.999};
}
