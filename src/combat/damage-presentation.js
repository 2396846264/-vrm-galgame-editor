import { shapeGeometry } from '../vehicle-shapes.js';
import * as THREE from 'three';
import { partModel } from '../aircombat-models.js';

// The battle coordinator owns timing; this subsystem updates only explicit battle data.
export function createCombatDamagePresentation() {
  function syncShipFragments(s, u) {
    if (!u.flight.ship) return;
    for (const f of u.flight.fragments) {
      if (!f.group) {
        f.group = new THREE.Group();
        s.scene.add(f.group);
        for (const p of f.parts) {
          const m = u.model.userData.models.get(p.id);
          f.group.add(m);
          m.position.copy(p.position).sub(f.localCenter);
          m.quaternion.copy(p.rotation);
        }
      }
      f.group.position.copy(f.position);
      f.group.quaternion.copy(f.rotation);
      f.group.visible = !u.flight.sunk;
    }
  }

  function revealDamage(s, u) {
    u.model.updateMatrixWorld(true);
    for (const p of u.flight.spec.parts) {
      let m = u.model.userData.models.get(p.id);
      if (!m) {
        m = partModel(p);
        m.scale.setScalar(p.scale);
        m.quaternion.copy(p.rotation);
        (p.fragment?.group || u.model).add(m);
        u.model.userData.models.set(p.id, m);
      }
      if (p.blockCells && m.userData.cellRevision !== (p.renderRevision || 0)) {
        m.position.copy(p.position).sub(p.fragment ? p.fragment.localCenter : u.flight.spec.com);
        m.quaternion.copy(p.rotation);
        const mesh = m.children.find((o) => o.isMesh);
        if (mesh) {
          mesh.geometry.dispose();
          mesh.geometry = shapeGeometry(p.def.shape || 'cube', p.def.size);
        }
        m.userData.cellRevision = p.renderRevision || 0;
      }
      if (p.blockCells && !p.damageFacesRevealed) {
        const mesh = m.children.find((o) => o.isMesh);
        if (mesh) {
          mesh.geometry.dispose();
          mesh.geometry = shapeGeometry(p.def.shape || 'cube', p.def.size);
        }
        p.damageFacesRevealed = true;
      }
      if (p.detached && !p.debrisSpawned) {
        p.debrisSpawned = true;
        const fragment = m.clone(true);
        fragment.position.copy(m.getWorldPosition(new THREE.Vector3()));
        fragment.quaternion.copy(m.getWorldQuaternion(new THREE.Quaternion()));
        fragment.scale.copy(m.getWorldScale(new THREE.Vector3()));
        fragment.visible = true;
        s.scene.add(fragment);
        s.debris.push({
          mesh: fragment,
          velocity: u.flight.velocity.clone(),
          spin: new THREE.Vector3(0.25, 0.1, 0.4),
          life: 30,
        });
      }
    }
  }

  function stepDebris(s, dt) {
    for (let i = s.debris.length - 1; i >= 0; i--) {
      const d = s.debris[i];
      d.life -= dt;
      d.velocity.y -= 9.81 * dt;
      d.velocity.multiplyScalar(Math.exp(-dt * 0.05));
      d.mesh.position.addScaledVector(d.velocity, dt);
      d.mesh.rotation.x += d.spin.x * dt;
      d.mesh.rotation.z += d.spin.z * dt;
      if (d.life <= 0 || d.mesh.position.y < 0) {
        d.mesh.removeFromParent();
        s.debris.splice(i, 1);
      }
    }
  }

  return { syncShipFragments, revealDamage, stepDebris };
}
