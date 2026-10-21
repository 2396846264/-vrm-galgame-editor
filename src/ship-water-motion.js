import * as T from 'three';
// Sample the hull footprint, not the instantaneous normal at one tiny crest.
// Navigation owns yaw; this adds gentle heave/pitch/roll without changing routes.
const euler=new T.Euler();
export function floatShips(units,water,dt=1/60){
 if(!water)return;
 for(const u of units){const f=u.flight;if(!f?.ship||!f.alive||f.sinking)continue;
  const yaw=euler.setFromQuaternion(f.rotation,'YXZ').y,c=Math.cos(yaw),s=Math.sin(yaw),x=f.position.x,z=f.position.z;
  const halfLength=f.shipClass==='carrier'?100:40,halfBeam=f.shipClass==='carrier'?14:8;
  const fore=water.height(x-s*halfLength,z-c*halfLength),aft=water.height(x+s*halfLength,z+c*halfLength),left=water.height(x-c*halfBeam,z+s*halfBeam),right=water.height(x+c*halfBeam,z-s*halfBeam);
  const targetHeight=(fore+aft+left+right)/4,pitch=T.MathUtils.clamp(Math.atan2(fore-aft,halfLength*2),-.045,.045),roll=T.MathUtils.clamp(Math.atan2(right-left,halfBeam*2),-.055,.055);
  const motion=f.waterMotion||(f.waterMotion={height:targetHeight,pitch,roll}),previous=motion.height,blend=1-Math.exp(-Math.max(0,dt)*2.2);
  motion.height+=(targetHeight-motion.height)*blend;motion.pitch+=(pitch-motion.pitch)*blend;motion.roll+=(roll-motion.roll)*blend;
  f.position.y=f.spec.com.y+motion.height;if(f.velocity)f.velocity.y=(motion.height-previous)/Math.max(dt,1e-6);
  f.rotation.setFromEuler(euler.set(motion.pitch,yaw,motion.roll,'YXZ'));
 }
}
