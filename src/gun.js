import * as THREE from 'three';
import { playGunshot, playNPCHit } from './audio.js';

const FIRE_RATE = 0.15; // seconds between shots
const MAX_RANGE = 200;
const IMPACT_LIFETIME = 3; // seconds before impact markers fade

export class GunSystem {
  constructor(scene, camera, playerMesh) {
    this.scene = scene;
    this.camera = camera;
    this.playerMesh = playerMesh; // Player's mesh Group (for 3rd person gun attachment)
    this.raycaster = new THREE.Raycaster();
    this.fireTimer = 0;
    this.isFiring = false;
    this.impacts = [];
    this.muzzleFlash = null;
    this.muzzleTimer = 0;
    this.killCount = 0;

    this._createGunMesh();
    this._createMuzzleFlash();
    this._setupInput();
  }

  _createGunMesh() {
    this.gunGroup = new THREE.Group();
    
    const metalMat = new THREE.MeshStandardMaterial({ color: '#2a2a2a', roughness: 0.3, metalness: 0.8 });
    const gripMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.9 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: '#555555', roughness: 0.2, metalness: 0.9 });

    // Slide (top part)
    const slideGeo = new THREE.BoxGeometry(0.06, 0.06, 0.28);
    const slide = new THREE.Mesh(slideGeo, metalMat);
    slide.position.set(0, 0.03, -0.02);
    this.gunGroup.add(slide);

    // Barrel
    const barrelGeo = new THREE.BoxGeometry(0.04, 0.04, 0.12);
    const barrel = new THREE.Mesh(barrelGeo, chromeMat);
    barrel.position.set(0, 0.01, -0.2);
    this.gunGroup.add(barrel);

    // Frame (lower)
    const frameGeo = new THREE.BoxGeometry(0.05, 0.05, 0.22);
    const frame = new THREE.Mesh(frameGeo, metalMat);
    frame.position.set(0, -0.02, 0);
    this.gunGroup.add(frame);

    // Grip
    const gripGeo = new THREE.BoxGeometry(0.045, 0.12, 0.06);
    const grip = new THREE.Mesh(gripGeo, gripMat);
    grip.position.set(0, -0.08, 0.06);
    grip.rotation.x = 0.2;
    this.gunGroup.add(grip);

    // Trigger guard
    const guardGeo = new THREE.BoxGeometry(0.02, 0.04, 0.06);
    const guard = new THREE.Mesh(guardGeo, metalMat);
    guard.position.set(0, -0.04, 0.02);
    this.gunGroup.add(guard);

    // Position gun in bottom-right of screen (like GTA)
    // This will be updated each frame relative to camera
    this.gunGroup.visible = false;
    this.scene.add(this.gunGroup);
  }

  _createMuzzleFlash() {
    const flashGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const flashMat = new THREE.MeshBasicMaterial({ 
      color: '#ffaa00', 
      transparent: true, 
      opacity: 0.9 
    });
    this.muzzleFlash = new THREE.Mesh(flashGeo, flashMat);
    this.muzzleFlash.visible = false;
    this.scene.add(this.muzzleFlash);

    // Muzzle light
    this.muzzleLight = new THREE.PointLight('#ffaa00', 3, 8);
    this.muzzleLight.visible = false;
    this.scene.add(this.muzzleLight);
  }

  _setupInput() {
    document.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.isFiring = true;
    });
    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.isFiring = false;
    });
  }

  show() {
    this.gunGroup.visible = true;
  }

  hide() {
    this.gunGroup.visible = false;
  }

  _fire() {
    // Raycast from center of screen
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    this.raycaster.far = MAX_RANGE;

    const intersects = this.raycaster.intersectObjects(this.scene.children, true);
    
    // Filter out gun, muzzle flash, player, and sky
    const hit = intersects.find(i => {
      const obj = i.object;
      let parent = obj;
      while (parent) {
        if (parent === this.gunGroup) return false;
        if (parent === this.muzzleFlash) return false;
        if (parent.name === 'player') return false;
        if (parent.name === 'npcs') return false;
        parent = parent.parent;
      }
      return true;
    });

    // Show muzzle flash + play sound
    this.muzzleTimer = 0.05;
    this.muzzleFlash.visible = true;
    this.muzzleLight.visible = true;
    playGunshot();

    if (hit) {
      this._createImpact(hit.point, hit.face?.normal);
      
      // Check if we hit an NPC
      let npcHit = intersects.find(i => {
        let p = i.object;
        while (p) {
          if (p.parent && p.parent.name === 'npcs') return true;
          p = p.parent;
        }
        return false;
      });

      if (npcHit) {
        this._onNPCHit(npcHit);
        playNPCHit();
      }
    }
  }

  _onNPCHit(hit) {
    // Find the NPC group and ragdoll it
    let npcGroup = hit.object;
    while (npcGroup && npcGroup.parent && npcGroup.parent.name !== 'npcs') {
      npcGroup = npcGroup.parent;
    }
    if (!npcGroup) return;
    if (npcGroup.userData.dead) return; // already dead

    // Increment kill counter
    this.killCount++;
    const killEl = document.getElementById('kill-count');
    if (killEl) killEl.textContent = this.killCount;

    // Mark dead
    npcGroup.userData.dead = true;
    npcGroup.userData.deathTimer = 3;
    npcGroup.userData.speed = 0;

    // Play Death animation if available, otherwise fall back to tilt
    if (npcGroup.userData.actions) {
      const deathName = npcGroup.userData.actions.has('Death') ? 'Death' : 
                         npcGroup.userData.actions.has('Defeat') ? 'Defeat' : null;
      if (deathName) {
        const deathAction = npcGroup.userData.actions.get(deathName);
        deathAction.setLoop(THREE.LoopOnce, 1);
        deathAction.clampWhenFinished = true;
        if (npcGroup.userData.currentAction) {
          npcGroup.userData.currentAction.crossFadeTo(deathAction, 0.15, true);
        }
        deathAction.reset().play();
        npcGroup.userData.currentAction = deathAction;
        return;
      }
    }

    // Fallback tilt for box-mesh NPCs
    const pushDir = new THREE.Vector3()
      .subVectors(hit.point, this.camera.position)
      .normalize();
    npcGroup.rotation.x = pushDir.z * 1.2;
    npcGroup.rotation.z = -pushDir.x * 1.2;
    npcGroup.position.y = 0.3;
  }

  _createImpact(point, normal) {
    // Bullet hole decal
    const impactGeo = new THREE.CircleGeometry(0.08, 8);
    const impactMat = new THREE.MeshBasicMaterial({ 
      color: '#1a1a1a',
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    });
    const impact = new THREE.Mesh(impactGeo, impactMat);
    impact.position.copy(point);
    
    if (normal) {
      impact.position.addScaledVector(normal, 0.02);
      impact.lookAt(point.clone().add(normal));
    }
    
    impact.userData.lifetime = IMPACT_LIFETIME;
    this.scene.add(impact);
    this.impacts.push(impact);

    // Spark particles
    for (let i = 0; i < 3; i++) {
      const sparkGeo = new THREE.BoxGeometry(0.03, 0.03, 0.03);
      const sparkMat = new THREE.MeshBasicMaterial({ 
        color: '#ffcc00',
        transparent: true,
      });
      const spark = new THREE.Mesh(sparkGeo, sparkMat);
      spark.position.copy(point);
      spark.userData.velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 4,
        Math.random() * 3,
        (Math.random() - 0.5) * 4
      );
      spark.userData.lifetime = 0.3;
      this.scene.add(spark);
      this.impacts.push(spark);
    }
  }

  update(dt, playerPos, playerYaw, rightHandBone) {
    this.fireTimer -= dt;

    // Position gun in player's right hand (3rd person GTA style)
    if (this.gunGroup.visible) {
      if (rightHandBone) {
        // Attach to animated right hand bone
        const handPos = new THREE.Vector3();
        rightHandBone.getWorldPosition(handPos);
        this.gunGroup.position.copy(handPos);
        this.gunGroup.rotation.set(0, playerYaw, 0);
      } else if (this.playerMesh) {
        // Fallback: offset from player position
        const sinY = Math.sin(playerYaw);
        const cosY = Math.cos(playerYaw);
        this.gunGroup.position.set(
          playerPos.x + cosY * 0.4 - sinY * 0.3,
          playerPos.y + 0.85,
          playerPos.z - sinY * 0.4 - cosY * 0.3
        );
        this.gunGroup.rotation.set(0, playerYaw, 0);
      }

      // Muzzle flash at gun tip
      const fwd = new THREE.Vector3(0, 0, -0.3).applyAxisAngle(new THREE.Vector3(0, 1, 0), playerYaw);
      const muzzlePos = this.gunGroup.position.clone().add(fwd);
      this.muzzleFlash.position.copy(muzzlePos);
      this.muzzleLight.position.copy(muzzlePos);
    }

    // Fire logic
    if (this.isFiring && this.fireTimer <= 0 && this.gunGroup.visible) {
      this.fireTimer = FIRE_RATE;
      this._fire();
    }

    // Muzzle flash timer
    if (this.muzzleTimer > 0) {
      this.muzzleTimer -= dt;
      if (this.muzzleTimer <= 0) {
        this.muzzleFlash.visible = false;
        this.muzzleLight.visible = false;
      }
    }

    // Update impacts (fade + physics for sparks)
    for (let i = this.impacts.length - 1; i >= 0; i--) {
      const imp = this.impacts[i];
      imp.userData.lifetime -= dt;

      // Spark physics
      if (imp.userData.velocity) {
        imp.position.addScaledVector(imp.userData.velocity, dt);
        imp.userData.velocity.y -= 10 * dt;
        imp.material.opacity = Math.max(0, imp.userData.lifetime / 0.3);
      }

      if (imp.userData.lifetime <= 0) {
        this.scene.remove(imp);
        imp.geometry.dispose();
        imp.material.dispose();
        this.impacts.splice(i, 1);
      }
    }
  }
}
