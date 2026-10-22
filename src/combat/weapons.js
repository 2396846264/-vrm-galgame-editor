import { advanceWaterShell } from '../naval-water-shell.js';
import { playNavalGunAudio } from '../naval-gun-audio.js';
import { navalShellProfile, navalBallisticAim } from '../naval-shell-rules.js';
import { heavyShellBlast, penetrateHeavyShell } from '../naval-shell-damage.js';
import {
  caliberDamage,
  caliberGravity,
  tickWeaponCycle,
  weaponReady,
  consumeWeaponRound,
} from '../weapon-balance.js';
import { turretTarget, targetPoint, ballisticAim } from '../turret-targeting.js';
import { blastShip, bombBurstPoint } from '../warship-runtime.js';
import { intersectVehicle, partWorld } from '../vehicle-hit.js';
import { normalizeWeaponSettings } from '../vehicle-weapon-settings.js';
import { proximityPass, advanceDroppedWeapon } from '../naval-ordnance.js';
import { secondaryFireRange, maxProjectiles, createProjectile } from '../aircombat-rules.js';
import * as THREE from 'three';
import { partFamily } from '../aircombat-schema.js';
import { aimTurret } from '../vehicle-combat.js';
import { damagePart } from '../aircombat-physics.js';

// The battle coordinator owns timing; this subsystem updates only explicit battle data.
export function createCombatWeapons(ctx, { audio }) {
  function fireGuns(s, u, direction) {
    if (u.flight.ammo <= 0 || !u.flight.alive || u.flight.carrierLaunch) return;
    u.gunClocks ||= new Map();
    for (const p of u.flight.spec.parts.filter(
      (p) => partFamily(p.type) === 'gun' && p.health > 0 && p.ammo > 0,
    )) {
      const last = u.gunClocks.get(p.id) ?? -Infinity;
      if (s.elapsed - last < 1 / (p.def.rate || 9) || u.flight.ammo <= 0) continue;
      u.gunClocks.set(p.id, s.elapsed);
      const localMuzzle =
          u.model.userData.models.get(p.id)?.userData.muzzleLocations?.[0] ||
          new THREE.Vector3(0, 0, -1),
        origin = localMuzzle
          .clone()
          .multiplyScalar(p.scale)
          .applyQuaternion(p.rotation)
          .add(p.position)
          .sub(u.flight.spec.com)
          .applyQuaternion(u.flight.rotation)
          .add(u.flight.position),
        forward = new THREE.Vector3(0, 0, -1)
          .applyQuaternion(p.rotation)
          .applyQuaternion(u.flight.rotation);
      if (!shoot(s, u, p, origin, forward, p.def.damage || 12)) continue;
      p.shots = (p.shots || 0) + 1;
      u.flight.ammo--;
      p.ammo--;
    }
  }

  const fShipProfile = (u, p, type) => (u.flight.ship ? navalShellProfile(p.def, type) : null);

  function shoot(s, u, p, origin, direction, damage, round = null) {
    if (s.bullets.length >= maxProjectiles) return false;
    p.lastShotTime = s.elapsed;
    const shot = {
      ...createProjectile(
        origin,
        direction
          .clone()
          .multiplyScalar(p.def.muzzleSpeed || 570)
          .add(u.flight.velocity),
      ),
      owner: u,
      part: p,
      damage,
      gravity: caliberGravity(p.def.caliber),
      age: 0,
      ...normalizeWeaponSettings(p, p.def),
      ...(round || {}),
    };
    shot.shell = u.flight.ship || shot.ammoType !== 'kinetic';
    shot.penetration =
      shot.ammoType === 'ap'
        ? (p.def.caliber || 20) * 1.4
        : shot.ammoType === 'type3'
          ? 15
          : p.def.caliber || 20;
    if (shot.ammoType === 'type3')
      shot.proximityRadius = Math.max(45, Math.min(110, (p.def.caliber || 203) * 0.2));
    const profile = fShipProfile(u, p, shot.ammoType);
    if (profile) {
      shot.gravity = profile.gravity;
      shot.velocity.copy(direction).multiplyScalar(profile.speed).add(u.flight.velocity);
      shot.maxRange = profile.range;
      shot.horizontalRange = true;
      shot.launchOrigin = origin.clone();
      if (['ap', 'he'].includes(shot.ammoType)) {
        shot.heavyRules = true;
        shot.damage = profile.damage;
        shot.remainingDamage = profile.damage;
        shot.blastRadius = profile.blastRadius;
        if (p.def.dualPurpose) shot.proximityRadius = profile.proximityRadius;
      }
    }
    s.bullets.push(shot);
    p.lastShotAmmoType = shot.ammoType;
    s.shots++;
    if (
      (u.team === 'player' ||
        u.flight.position.distanceTo(s.camera.position) < (u.flight.ship ? 12000 : 1200)) &&
      s.elapsed -
        (s.lastShotAudioByType.get(u.team + ':' + s.units.indexOf(u) + ':' + p.type) ?? -1) >
        0.06
    ) {
      s.lastShotAudioByType.set(u.team + ':' + s.units.indexOf(u) + ':' + p.type, s.elapsed);
      const pool = s.shotVoicePools.get(p.firepower?.fireSoundId || u.fireSounds[p.type]);
      if (pool?.length) {
        const sound =
          pool.find((a) => a.paused || a.ended) ||
          pool[(s.shotAudioPlaysByType[p.type] || 0) % pool.length];
        sound.currentTime = 0;
        sound.volume = ctx.effectsVolume?.() ?? ctx.volume?.() ?? 1;
        sound
          .play()
          .then(() => {
            s.shotAudioPlays++;
            s.shotAudioPlaysByType[p.type] = (s.shotAudioPlaysByType[p.type] || 0) + 1;
          })
          .catch((e) => {
            s.shotAudioError = e.message;
          });
      } else if (u.team === 'player' || u.flight.ship) {
        audio(s);
        if (u.flight.ship) {
          if (
            s.audio &&
            playNavalGunAudio(s.audio, p.def.caliber, ctx.effectsVolume?.() ?? ctx.volume?.() ?? 1)
          )
            s.shotAudioPlays++;
        } else if (s.audio?.state === 'running') {
          const osc = s.audio.createOscillator(),
            gain = s.audio.createGain(),
            time = s.audio.currentTime;
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(p.def.caliber >= 37 ? 90 : 180, time);
          osc.frequency.exponentialRampToValueAtTime(35, time + 0.09);
          gain.gain.setValueAtTime(
            (u.flight.ship ? 0.045 : 0.018) * (ctx.effectsVolume?.() ?? ctx.volume?.() ?? 1),
            time,
          );
          gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.1);
          osc.connect(gain);
          gain.connect(s.audio.destination);
          osc.start(time);
          osc.stop(time + 0.12);
          osc.onended = () => {
            osc.disconnect();
            gain.disconnect();
          };
        }
      }
    }
    return true;
  }

  function turrets(s, u, dt) {
    const f = u.flight;
    for (const p of f.spec.parts.filter(
      (p) => partFamily(p.type) === 'turret' && p.health > 0 && !p.fragment,
    )) {
      const profile = f.ship ? navalShellProfile(p.def) : null;
      const origin = partWorld(f, p),
        mount = f.rotation.clone().multiply(p.rotation),
        m = u.model.userData.models.get(p.id),
        range = f.ship ? profile?.range || p.def.range || 6000 : secondaryFireRange,
        target = turretTarget(s.units, u, p, origin, range);
      const cycling = f.ship || Boolean(p.def.customWeapon),
        cycle = cycling ? tickWeaponCycle(p, dt, target) : null;
      if (!target || !m?.userData.turret) continue;
      const currentAim = p.turretAim || { yaw: 0, pitch: 0 },
        locationsBefore = m.userData.muzzleForAim?.(currentAim.yaw, currentAim.pitch) ||
          m.userData.muzzleLocations || [new THREE.Vector3()],
        barrelOffset = locationsBefore
          .reduce((v, x) => v.add(x), new THREE.Vector3())
          .divideScalar(locationsBefore.length || 1),
        aimOrigin = barrelOffset.multiplyScalar(p.scale);
      if (!m.userData.muzzleForAim)
        aimOrigin.applyQuaternion(
          new THREE.Quaternion()
            .setFromEuler(new THREE.Euler(0, currentAim.yaw, 0))
            .multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(currentAim.pitch, 0, 0))),
        );
      aimOrigin.applyQuaternion(mount).add(origin);
      const solution = profile
        ? navalBallisticAim(
            aimOrigin,
            targetPoint(target, origin),
            target.flight.velocity.clone().sub(f.velocity),
            profile.speed,
            profile.gravity,
          )
        : ballisticAim(
            origin,
            targetPoint(target, origin),
            target.flight.velocity.clone().sub(f.velocity),
            p.def.muzzleSpeed || 570,
            caliberGravity(p.def.caliber),
          );
      if (solution.reachable === false) continue;
      const aim = aimTurret(
        p.turretAim || { yaw: 0, pitch: 0 },
        solution.direction.clone().applyQuaternion(mount.clone().invert()),
        dt,
        { ...p.def, ...p },
      );
      p.turretAim = aim;
      m.userData.turret.rotation.y = aim.yaw;
      if (m.userData.turretPitch) m.userData.turretPitch.rotation.x = aim.pitch;
      if (Math.abs(aim.delta) > 1e-5) s.turretTurns++;
      if (
        !aim.canFire ||
        (profile &&
          aim.direction.clone().applyQuaternion(mount).dot(solution.direction) <
            Math.cos(Math.atan2(1.5, aimOrigin.distanceTo(targetPoint(target, aimOrigin))))) ||
        f.ammo <= 0 ||
        p.ammo <= 0 ||
        (cycling && !weaponReady(p))
      )
        continue;
      u.turretClocks ||= new Map();
      if (!cycling && s.elapsed - (u.turretClocks.get(p.id) ?? -Infinity) < 1 / (p.def.rate || 7))
        continue;
      const direction = aim.direction.clone().applyQuaternion(mount),
        muzzleRotation = new THREE.Quaternion()
          .setFromEuler(new THREE.Euler(0, aim.yaw, 0))
          .multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(aim.pitch, 0, 0))),
        locations = m.userData.muzzleForAim?.(aim.yaw, aim.pitch) ||
          m.userData.muzzleLocations || [new THREE.Vector3(0, 0, -1.1)],
        magazine = !p.def.customWeapon && f.ship && (p.def.caliber || 20) <= 40,
        selectedMuzzles = magazine ? [locations[(p.shots || 0) % locations.length]] : locations;
      let fired = false;
      for (const muzzle of selectedMuzzles) {
        if (p.ammo <= 0 || (p.def.customWeapon && cycle.loaded <= 0)) break;
        const actual = muzzle
            .clone()
            .applyQuaternion(m.userData.muzzleForAim ? new THREE.Quaternion() : muzzleRotation)
            .multiplyScalar(p.scale)
            .applyQuaternion(mount)
            .add(origin),
          round = cycle?.round ? { ...cycle.round } : null,
          shotDirection = direction.clone();
        if (profile) {
          const muzzleSolution = navalBallisticAim(
            actual,
            targetPoint(target, actual),
            target.flight.velocity.clone().sub(f.velocity),
            profile.speed,
            profile.gravity,
          );
          if (!muzzleSolution.reachable) continue;
          shotDirection.copy(muzzleSolution.direction);
        }
        if (f.ship && p.def.caliber < 100) {
          shotDirection
            .add(
              new THREE.Vector3(
                Math.random() - 0.5,
                Math.random() - 0.5,
                Math.random() - 0.5,
              ).multiplyScalar(0.012),
            )
            .normalize();
        }
        if (round?.fuze === 'timed') round.burstTime = solution.time;
        const damage = caliberDamage(p.def.caliber) * (round?.ammoType === 'ap' ? 1.35 : 1);
        if (!shoot(s, u, p, actual, shotDirection, damage, round)) break;
        p.shots = (p.shots || 0) + 1;
        f.ammo--;
        p.ammo--;
        if (p.def.customWeapon) consumeWeaponRound(p, true);
        fired = true;
      }
      if (fired) {
        if (f.ship && !p.def.customWeapon) consumeWeaponRound(p);
        u.turretClocks.set(p.id, s.elapsed);
      }
    }
  }

  function dropBomb(s, u, torpedo = false) {
    if (
      !u?.flight?.alive ||
      u.flight.carrierLaunch ||
      u.flight.ship ||
      s.mode !== 'battle' ||
      s.dialogueActive ||
      s.handoff > 0 ||
      s.paused ||
      ctx.paused()
    )
      return;
    const p = u.flight.spec.parts.find(
      (p) =>
        partFamily(p.type) === 'bomb' &&
        Boolean(p.def.torpedo) === torpedo &&
        !p.released &&
        p.health > 0,
    );
    if (!p) {
      s.root.querySelector('.air-message').textContent = torpedo
        ? '没有可用的航空鱼雷'
        : '没有可用的航空炸弹';
      return;
    }
    p.released = true;
    u.flight.bombs--;
    u.model.userData.models.get(p.id).visible = false;
    const mesh = new THREE.Mesh(
      torpedo
        ? new THREE.CylinderGeometry(0.23, 0.23, 4.5, 8)
        : new THREE.ConeGeometry(0.3, 1.3, 8),
      new THREE.MeshStandardMaterial({ color: p.color }),
    );
    if (torpedo) mesh.geometry.rotateX(Math.PI / 2);
    const position = partWorld(u.flight, p);
    mesh.position.copy(position);
    mesh.quaternion.copy(u.flight.rotation);
    s.scene.add(mesh);
    s.bullets.push({
      owner: u,
      part: p,
      position,
      velocity: u.flight.velocity.clone(),
      life: 120,
      damage: p.def.damage || 650,
      penetration: p.def.penetration || 65,
      blastRadius: p.def.blastRadius || 8,
      mesh,
      bomb: true,
      torpedo,
      waterSpeed: p.def.waterSpeed || 24,
      waterRange: p.def.waterRange || 5000,
    });
    if (torpedo) s.torpedoLaunches++;
    s.root.querySelector('.air-message').textContent = torpedo ? '航空鱼雷已投放' : '炸弹已投放';
  }

  const hitPart = (u, a, b) => intersectVehicle(u, a, b);

  function shellBurst(s, b, point, airburst = false) {
    s.flakBursts++;
    if (b.heavyRules) {
      const radius = airburst && b.part.def.dualPurpose ? b.proximityRadius : b.blastRadius;
      s.explosions.emit(point, radius, Boolean(b.submerged));
      s.hits += heavyShellBlast(s.units, point, b.damage, radius);
      return;
    }
    const forward = b.velocity.clone().normalize(),
      type = b.ammoType === 'type3' ? 'type3' : 'he';
    s.flak.emit(point, forward, type, b.part?.def.caliber);
    if (type === 'type3') {
      s.flakClouds.push({
        position: point.clone(),
        forward,
        owner: b.owner,
        life: 2,
        maxLife: 2,
        length: 140 + (b.part?.def.caliber || 203) * 0.35,
        damage: b.damage * 0.12,
      });
      return;
    }
    const radius = b.part?.def.blastRadius || Math.max(14, b.proximityRadius || 20);
    for (const u of s.units) {
      if (!u.flight.alive || u.flight.ship || (u.team === 'enemy') === (b.owner.team === 'enemy'))
        continue;
      const affected = u.flight.spec.parts
        .filter((p) => p.health > 0)
        .map((p) => ({ p, dist: partWorld(u.flight, p).distanceTo(point) }))
        .filter((r) => r.dist < radius)
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 4);
      for (const { p, dist } of affected)
        damagePart(
          u.flight,
          p.id,
          b.damage *
            0.18 *
            (1 - dist / radius) *
            (b.owner.team === 'enemy' ? s.config.difficulty : 1),
          { point },
        );
      if (affected.length) {
        s.hits++;
        impact(s, point, b.owner, u, affected[0].p);
      }
    }
  }

  function bullets(s, dt) {
    for (let i = s.bullets.length - 1; i >= 0; i--) {
      const b = s.bullets[i],
        previous = b.position.clone();
      let expired = false,
        struck = false;
      if (b.bomb) {
        expired = advanceDroppedWeapon(b, dt, s.ocean.userData.ocean);
        b.mesh.position.copy(b.position);
        if (b.waterborne)
          b.mesh.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 0, -1),
            b.velocity.clone().normalize(),
          );
      } else {
        b.age = (b.age || 0) + dt;
        expired = advanceWaterShell(b, dt, s.ocean.userData.ocean);
        if (b.enteredWater) {
          s.waterEntries = (s.waterEntries || 0) + 1;
          s.explosions.splash(b.position, b.part.def.caliber);
        }
        if (expired) {
          s.rangeExpirations = (s.rangeExpirations || 0) + 1;
          s.lastProjectileRange = b.travelled;
        }
      }
      if (b.heavyRules && b.ammoType === 'ap') {
        const result = penetrateHeavyShell(
          s.units,
          b.owner,
          previous,
          b.position,
          b.remainingDamage,
        );
        b.remainingDamage = result.remaining;
        s.apCellHits = (s.apCellHits || 0) + result.impacts.length;
        for (const hit of result.impacts) {
          s.hits++;
          impact(s, hit.point, b.owner, hit.u, hit.p);
        }
        if (result.remaining <= 1e-8 || expired) s.bullets.splice(i, 1);
        continue;
      }
      let best = null;
      for (const u of s.units) {
        if (
          !u.flight.alive ||
          u === b.owner ||
          (!b.heavyRules && (u.team === 'enemy') === (b.owner.team === 'enemy')) ||
          (b.waterborne && !u.flight.ship)
        )
          continue;
        const hit = hitPart(u, previous, b.position);
        if (hit && (!best || hit.t < best.hit.t)) best = { u, hit };
      }
      if (best) {
        const { u, hit } = best,
          point = previous.clone().lerp(b.position, hit.t);
        if (b.heavyRules && b.ammoType === 'he') {
          shellBurst(s, b, point);
        } else if (b.bomb && u.flight.ship) {
          const center = b.torpedo
            ? point
            : bombBurstPoint(u.flight, hit, point, b.velocity.clone().normalize(), b.penetration);
          blastShip(u.flight, center, b.damage, b.blastRadius, b.penetration);
          damagePart(u.flight, hit.part.id, b.damage, { penetration: b.penetration, point });
          s.bombHits++;
        } else if (u.flight.ship && b.shell) {
          const scale = b.owner.team === 'enemy' ? s.config.difficulty : 1,
            penetration = b.penetration || 20,
            center =
              b.ammoType === 'ap'
                ? bombBurstPoint(u.flight, hit, point, b.velocity.clone().normalize(), penetration)
                : point;
          if (['ap', 'he'].includes(b.ammoType))
            blastShip(
              u.flight,
              center,
              b.damage * scale,
              Math.max(
                4,
                Math.min(24, (b.part.def.caliber || 20) / (b.ammoType === 'ap' ? 40 : 20)),
              ),
              penetration,
            );
          damagePart(u.flight, hit.part.id, b.damage * scale * (b.ammoType === 'type3' ? 0.2 : 1), {
            penetration,
            point,
          });
        } else
          damagePart(
            u.flight,
            hit.part.id,
            b.damage * (b.owner.team === 'enemy' ? s.config.difficulty : 1),
            { penetration: b.penetration || 20, point },
          );
        s.hits++;
        impact(s, point, b.owner, u, hit.part);
        if (!b.heavyRules && b.shell && ['he', 'type3'].includes(b.ammoType))
          shellBurst(s, b, point);
        if (!u.flight.alive && u.team === 'enemy') b.owner.flight.kills++;
        struck = true;
      } else if (!b.submerged && b.shell && ['he', 'type3'].includes(b.ammoType)) {
        if (b.fuze === 'timed' && b.age >= b.burstTime) {
          shellBurst(s, b, b.position, true);
          struck = true;
        }
        if (!struck && b.fuze === 'proximity' && b.travelled > 100) {
          let nearest = null;
          for (const u of s.units) {
            if (
              !u.flight.alive ||
              u.flight.ship ||
              (u.team === 'enemy') === (b.owner.team === 'enemy')
            )
              continue;
            const t = proximityPass(
              previous,
              b.position,
              u.flight.previousPosition || u.flight.position,
              u.flight.position,
              b.proximityRadius,
            );
            if (t !== null && (nearest === null || t < nearest)) nearest = t;
          }
          if (nearest !== null) {
            shellBurst(s, b, previous.clone().lerp(b.position, nearest), true);
            struck = true;
          }
        }
      }
      if (
        !struck &&
        b.heavyRules &&
        b.ammoType === 'he' &&
        b.submerged &&
        (b.waterAge >= 0.04 || expired)
      ) {
        shellBurst(s, b, b.position);
        struck = true;
      }
      if (b.bomb && !b.torpedo && b.position.y <= 0 && !struck) {
        s.flak.emit(b.position, new THREE.Vector3(0, 1, 0), 'he');
        for (const u of s.units)
          if (
            u.flight.ship &&
            u.flight.alive &&
            u.flight.position.distanceTo(b.position) < u.flight.spec.radius + b.blastRadius
          )
            blastShip(u.flight, b.position, b.damage * 0.4, b.blastRadius, b.penetration * 0.5);
        struck = true;
      }
      if (struck || expired || (!b.heavyRules && !b.torpedo && b.position.y < 0)) {
        b.mesh?.removeFromParent();
        b.mesh?.geometry.dispose();
        b.mesh?.material.dispose();
        s.bullets.splice(i, 1);
      }
    }
    for (let i = s.flakClouds.length - 1; i >= 0; i--) {
      const c = s.flakClouds[i];
      c.life -= dt;
      const length = (1 - c.life / c.maxLife) * c.length + 20;
      for (const u of s.units) {
        if (!u.flight.alive || u.flight.ship || (u.team === 'enemy') === (c.owner.team === 'enemy'))
          continue;
        const r = u.flight.position.clone().sub(c.position),
          along = r.dot(c.forward);
        if (along > 0 && along < length && r.lengthSq() - along * along < (along * 0.45 + 5) ** 2) {
          const p = u.flight.spec.parts
            .filter((p) => p.health > 0)
            .sort(
              (a, b) =>
                partWorld(u.flight, a).distanceToSquared(c.position) -
                partWorld(u.flight, b).distanceToSquared(c.position),
            )[0];
          if (p)
            damagePart(
              u.flight,
              p.id,
              c.damage * dt * (c.owner.team === 'enemy' ? s.config.difficulty : 1),
              { point: u.flight.position },
            );
        }
      }
      if (c.life <= 0) s.flakClouds.splice(i, 1);
    }
  }

  function impact(s, point, owner, victim, part) {
    for (let i = 0; i < 8; i++) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.13, 0.13, 0.13),
        new THREE.MeshBasicMaterial({
          color: i % 2 ? '#ffd97c' : '#fff4d0',
          transparent: true,
          opacity: 1,
        }),
      );
      mesh.position.copy(point);
      s.scene.add(mesh);
      s.impacts.push({
        mesh,
        life: 0.35,
        velocity: new THREE.Vector3(
          Math.random() - 0.5,
          Math.random() - 0.2,
          Math.random() - 0.5,
        ).multiplyScalar(12),
      });
    }
    while (s.impacts.length > 160) {
      const p = s.impacts.shift();
      p.mesh.removeFromParent();
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
    }
    if (owner.team === 'player') {
      s.hitUntil = s.elapsed + 0.8;
      s.hitText = '命中';
      s.root.querySelector('.air-hit-feedback').classList.toggle('kill', !victim.flight.alive);
    }
    const object = victim.model.userData.models.get(part.id);
    object?.traverse((o) => {
      if (o.material?.emissive) {
        o.material.emissive.set('#b54b17');
        o.material.emissiveIntensity = 0.8;
      }
    });
    part.hitFlashUntil = s.elapsed + 0.12;
  }

  return { fireGuns, turrets, dropBomb, hitPart, bullets };
}
