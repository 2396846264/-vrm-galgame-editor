import { configureShipFlags } from '../ship-flag.js';
import { createShip } from '../warship-runtime.js';
import { projectileRange } from '../aircombat-rules.js';
import * as THREE from 'three';
import { aircraftModel } from '../aircombat-models.js';
import { createFlight, steerFlight } from '../aircombat-physics.js';

// The battle coordinator owns timing; this subsystem updates only explicit battle data.
export function createCombatActors(ctx, { fireGuns }) {
  function spawn(s, blueprint, team, position, heading) {
    const flight =
        blueprint.vehicleType === 'warship'
          ? createShip(blueprint, position, heading)
          : createFlight(blueprint, position, heading),
      model = aircraftModel(flight.spec);
    configureShipFlags(model, ctx.project?.()?.assets || [], (a) => ctx.assetUrl(a));
    model.position.copy(flight.position);
    model.quaternion.copy(flight.rotation);
    model.userData.nprCharacter = true;
    s.scene.add(model);
    const marker = document.createElement('span');
    marker.className = 'air-tag ' + team;
    marker.textContent = '';
    s.root.querySelector('.air-marker-layer').append(marker);
    const fireSounds = blueprint.fireSounds ?? s.config.fireSounds;
    for (const id of new Set([
      ...Object.values(fireSounds || {}),
      ...blueprint.parts.map((p) => p.firepower?.fireSoundId).filter(Boolean),
    ])) {
      const asset = ctx.asset?.(id);
      if (asset && !s.shotVoicePools.has(id))
        s.shotVoicePools.set(
          id,
          Array.from({ length: 8 }, () => {
            const a = new Audio(ctx.assetUrl(asset));
            a.preload = 'auto';
            return a;
          }),
        );
    }
    const u = {
      flight,
      model,
      fireSounds: { ...fireSounds },
      team,
      marker,
      cooldown: 0,
      turretCooldown: 0,
      think: 0,
      target: null,
      evade: 0,
    };
    s.units.push(u);
    return u;
  }

  function ai(s, u, dt) {
    const f = u.flight;
    u.think -= dt;
    u.evade = Math.max(0, u.evade - dt);
    if (u.think <= 0) {
      u.think = 0.25;
      u.target =
        s.units
          .filter(
            (v) => v.flight?.alive && v !== u && (u.team === 'enemy') !== (v.team === 'enemy'),
          )
          .sort(
            (a, b) =>
              a.flight.position.distanceToSquared(f.position) -
              b.flight.position.distanceToSquared(f.position),
          )[0] || null;
    }
    let desired = new THREE.Vector3(0, 0, -1).applyQuaternion(f.rotation);
    if (u.target) {
      const target = u.target.flight,
        delta = target.position.clone().sub(f.position),
        distance = delta.length();
      desired = delta.addScaledVector(target.velocity, Math.min(distance / 800, 6)).normalize();
      const dot = desired.dot(new THREE.Vector3(0, 0, -1).applyQuaternion(f.rotation));
      if (distance < 120 && dot < 0.6) u.evade = 2;
      if (u.evade > 0)
        desired = new THREE.Vector3(
          Math.sin(s.elapsed * 0.4 + f.position.x * 0.001),
          0.12,
          -Math.cos(s.elapsed * 0.4 + f.position.x * 0.001),
        );
      if (distance < projectileRange && dot > 0.975 && u.evade === 0) fireGuns(s, u, desired);
    }
    if (u.cruiseAltitude && (!u.target || u.target.flight.position.distanceTo(f.position) > 5000))
      desired.y = THREE.MathUtils.clamp((u.cruiseAltitude - f.position.y) / 2000, -0.3, 0.35);
    if (f.position.y < 140) desired.y = Math.max(0.45, desired.y);
    if (f.position.y > Math.max(2200, (u.cruiseAltitude || 0) + 400)) desired.y = -0.3;
    steerFlight(f, desired);
    f.throttle = u.team === 'enemy' ? 0.68 + 0.15 * s.config.difficulty : 0.85;
  }

  return { spawn, ai };
}
