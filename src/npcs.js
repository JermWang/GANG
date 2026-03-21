import * as THREE from 'three';
import { loadModel, cloneModel, setupAnimations, playAnimation, getModelHeight } from './modelLoader.js';

// City-appropriate civilian models from Quaternius pack
const CIVILIAN_MODELS = [
  'Casual_Male', 'Casual_Female',
  'Casual2_Male', 'Casual2_Female',
];

const CIVILIAN_BASE_PATH = '/assets/models/glTF-civilians/';
const NPC_HEIGHT = 1.0; // Target height in world units

const CAR_COLORS = [
  '#2a4a2a', '#8a2020', '#1a1a4a', '#e8e0d0', '#3a3a3a',
  '#c8a030', '#404040', '#6a1a1a', '#2a2a6a', '#d0c0a0',
];

export class NPCSystem {
  constructor(scene, cityData) {
    this.scene = scene;
    this.cityData = cityData;
    this.bounds = cityData.bounds || { halfX: 60, halfZ: 40, roadWidth: 14 };
    this.pedestrians = [];
    this.trafficCars = [];
    this.group = new THREE.Group();
    this.group.name = 'npcs';
    scene.add(this.group);
    this._cachedModels = [];
    this._modelsLoaded = false;
  }

  async loadModels() {
    const promises = CIVILIAN_MODELS.map(async (name) => {
      try {
        const data = await loadModel(`${CIVILIAN_BASE_PATH}${name}.gltf`);
        return { name, data };
      } catch (e) {
        console.warn(`Failed to load civilian model: ${name}`, e);
        return null;
      }
    });
    const results = await Promise.all(promises);
    this._cachedModels = results.filter(Boolean);
    this._modelsLoaded = this._cachedModels.length > 0;
    console.log(`Loaded ${this._cachedModels.length} civilian models`);
  }

  initialize() {
    // Spawn pedestrians on sidewalks (keep it light)
    for (let i = 0; i < 5; i++) {
      this._spawnPedestrian();
    }

    // Spawn traffic cars on road — evenly spaced, both directions
    const carsPerLane = 3;
    const spacing = (this.bounds.halfX * 1.6) / carsPerLane;
    for (let lane of [1, -1]) {
      for (let i = 0; i < carsPerLane; i++) {
        const x = -this.bounds.halfX * 0.8 + i * spacing + (Math.random() - 0.5) * 5;
        this._spawnTrafficCar(lane, x);
      }
    }
  }

  _getRandomSidewalkPos() {
    const rw = this.bounds.roadWidth;
    const side = Math.random() < 0.5 ? -1 : 1;
    const swZ = (rw / 2 + 2) * side;
    const x = (Math.random() - 0.5) * this.bounds.halfX * 1.6;
    return { x, z: swZ, side };
  }

  _spawnPedestrian() {
    const ped = this._createPedestrianMesh();
    const pos = this._getRandomSidewalkPos();
    ped.position.set(pos.x, 0, pos.z);

    // Walk along X axis (along the sidewalk)
    const dir = Math.random() < 0.5 ? 1 : -1;
    ped.userData.direction = new THREE.Vector3(dir, 0, 0);
    ped.userData.speed = 1.5 + Math.random() * 1.5;
    ped.userData.walkTimer = 0;
    ped.userData.turnTimer = 5 + Math.random() * 8;
    ped.userData.sidewalkSide = pos.side;

    this.group.add(ped);
    this.pedestrians.push(ped);
  }

  _createPedestrianMesh() {
    const group = new THREE.Group();

    if (this._modelsLoaded) {
      // Pick a random cached model and clone it
      const pick = this._cachedModels[Math.floor(Math.random() * this._cachedModels.length)];
      const { scene: clonedScene, animations } = cloneModel(pick.data);

      // Scale to target height
      const h = getModelHeight(clonedScene);
      const scale = NPC_HEIGHT / (h || 1);
      clonedScene.scale.setScalar(scale);

      // Center model so feet sit at y=0 of the group
      clonedScene.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(clonedScene);
      clonedScene.position.y -= box.min.y;

      // Enable shadows
      clonedScene.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      group.add(clonedScene);

      // Setup animation mixer
      const { mixer, actions } = setupAnimations(clonedScene, animations);
      group.userData.mixer = mixer;
      group.userData.actions = actions;
      group.userData.currentAction = null;

      // Start with Walk animation
      const walkAction = actions.get('Walk') || actions.get('Idle');
      if (walkAction) {
        walkAction.play();
        group.userData.currentAction = walkAction;
      }
    } else {
      // Fallback: simple box mesh
      const mat = new THREE.MeshStandardMaterial({ color: '#40e0d0', roughness: 0.7 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.2, 0.3), mat);
      body.position.y = 0.85;
      body.castShadow = true;
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.4, 0.35), mat);
      head.position.y = 1.65;
      head.castShadow = true;
      group.add(body, head);
    }

    return group;
  }

  _spawnTrafficCar(laneDir, startX) {
    const car = this._createTrafficCarMesh();
    const rw = this.bounds.roadWidth;
    
    // Lane offset: positive lane = +Z side, negative lane = -Z side
    const laneZ = (rw / 4) * laneDir;
    const x = startX !== undefined ? startX : (Math.random() - 0.5) * this.bounds.halfX;
    
    car.position.set(x, 0.18, laneZ);
    
    // Face driving direction: +Z is model forward
    // laneDir=1 drives +X, so rotate -90° around Y
    // laneDir=-1 drives -X, so rotate +90° around Y
    car.rotation.y = laneDir > 0 ? -Math.PI / 2 : Math.PI / 2;
    car.userData.baseSpeed = 8 + Math.random() * 4;
    car.userData.speed = car.userData.baseSpeed;
    car.userData.laneDir = laneDir;
    car.userData.direction = new THREE.Vector3(laneDir, 0, 0);

    this.group.add(car);
    this.trafficCars.push(car);
  }

  _createTrafficCarMesh() {
    const group = new THREE.Group();
    const color = CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.3 });
    const glassMat = new THREE.MeshStandardMaterial({ color: '#1a2a3a', roughness: 0.1, metalness: 0.8 });
    const wheelMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.9 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: '#c0c0c0', roughness: 0.2, metalness: 0.9 });

    // Car faces +Z direction (forward)
    // Main body (long axis = Z)
    const bodyGeo = new THREE.BoxGeometry(1.8, 0.8, 4.2);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.4;
    body.castShadow = true;
    group.add(body);

    // Cabin
    const cabinGeo = new THREE.BoxGeometry(1.6, 0.7, 2.2);
    const cabin = new THREE.Mesh(cabinGeo, bodyMat);
    cabin.position.set(0, 1.1, -0.2);
    cabin.castShadow = true;
    group.add(cabin);

    // Windows
    const windowGeo = new THREE.BoxGeometry(1.65, 0.5, 2.0);
    const windows = new THREE.Mesh(windowGeo, glassMat);
    windows.position.set(0, 1.15, -0.2);
    group.add(windows);

    // Wheels (swapped X/Z)
    const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.25, 12);
    const wheelPositions = [
      [0.9, 0.35, 1.3], [-0.9, 0.35, 1.3],
      [0.9, 0.35, -1.3], [-0.9, 0.35, -1.3]
    ];
    for (const pos of wheelPositions) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.position.set(...pos);
      wheel.rotation.z = Math.PI / 2;
      wheel.castShadow = true;
      group.add(wheel);
    }

    // Headlights (front = +Z)
    const lightGeo = new THREE.BoxGeometry(0.3, 0.2, 0.1);
    const hl1 = new THREE.Mesh(lightGeo, chromeMat);
    hl1.position.set(0.5, 0.5, 2.1);
    group.add(hl1);
    const hl2 = new THREE.Mesh(lightGeo, chromeMat);
    hl2.position.set(-0.5, 0.5, 2.1);
    group.add(hl2);

    // Taillights (rear = -Z)
    const tailMat = new THREE.MeshStandardMaterial({ color: '#aa0000', emissive: '#330000' });
    const tl1 = new THREE.Mesh(lightGeo, tailMat);
    tl1.position.set(0.5, 0.5, -2.1);
    group.add(tl1);
    const tl2 = new THREE.Mesh(lightGeo, tailMat);
    tl2.position.set(-0.5, 0.5, -2.1);
    group.add(tl2);

    return group;
  }

  update(dt) {
    const halfX = this.bounds.halfX;
    const rw = this.bounds.roadWidth;
    const fadeStart = halfX * 0.7;

    // Update pedestrians
    for (const ped of this.pedestrians) {
      if (ped.userData.mixer) ped.userData.mixer.update(dt);

      // Handle dead NPCs
      if (ped.userData.dead) {
        ped.userData.deathTimer -= dt;
        if (ped.userData.deathTimer < 2 && ped.position.y > -0.5) {
          ped.position.y -= dt * 0.5;
        }
        if (ped.userData.deathTimer <= 0) {
          ped.userData.dead = false;
          ped.rotation.x = 0;
          ped.rotation.z = 0;
          const pos = this._getRandomSidewalkPos();
          ped.position.set(pos.x, 0, pos.z);
          ped.userData.speed = 1.5 + Math.random() * 1.5;
          const dir = Math.random() < 0.5 ? 1 : -1;
          ped.userData.direction.set(dir, 0, 0);
          ped.userData.sidewalkSide = pos.side;

          if (ped.userData.actions) {
            ped.userData.currentAction = playAnimation(ped.userData.actions, 'Walk', ped.userData.currentAction, 0.3);
          }
        }
        continue;
      }

      // Move along sidewalk
      ped.position.x += ped.userData.direction.x * ped.userData.speed * dt;
      ped.rotation.y = Math.atan2(ped.userData.direction.x, ped.userData.direction.z);

      // Wrap at edges — teleport to opposite side
      if (ped.position.x > halfX) {
        ped.position.x = -halfX;
      } else if (ped.position.x < -halfX) {
        ped.position.x = halfX;
      }

      // Fade opacity near boundaries
      const dist = Math.abs(ped.position.x);
      const opacity = dist > fadeStart ? 1 - (dist - fadeStart) / (halfX - fadeStart) : 1;
      ped.traverse(child => {
        if (child.isMesh && child.material) {
          child.material.transparent = true;
          child.material.opacity = Math.max(0, opacity);
        }
      });

      // Occasional direction flip
      ped.userData.turnTimer -= dt;
      if (ped.userData.turnTimer <= 0) {
        ped.userData.direction.x *= -1;
        ped.userData.turnTimer = 8 + Math.random() * 10;
      }
    }

    // Update traffic cars with spatial awareness
    for (let i = 0; i < this.trafficCars.length; i++) {
      const car = this.trafficCars[i];
      const dir = car.userData.laneDir;
      let targetSpeed = car.userData.baseSpeed;

      // Check distance to car ahead in same lane
      const minFollowDist = 12;
      for (let j = 0; j < this.trafficCars.length; j++) {
        if (i === j) continue;
        const other = this.trafficCars[j];
        if (other.userData.laneDir !== dir) continue; // different lane
        
        // "ahead" means in the driving direction
        const dx = (other.position.x - car.position.x) * dir;
        if (dx > 0 && dx < minFollowDist) {
          // Slow down proportionally — closer = slower
          const ratio = dx / minFollowDist;
          targetSpeed = Math.min(targetSpeed, other.userData.speed * ratio);
        }
      }

      // Smoothly adjust speed
      car.userData.speed += (targetSpeed - car.userData.speed) * Math.min(dt * 3, 1);
      car.userData.speed = Math.max(car.userData.speed, 0);

      car.position.x += dir * car.userData.speed * dt;

      // Wrap at edges — respawn with gap check
      if (car.position.x > halfX + 15) {
        car.position.x = -halfX - 12;
        car.userData.speed = car.userData.baseSpeed;
      } else if (car.position.x < -halfX - 15) {
        car.position.x = halfX + 12;
        car.userData.speed = car.userData.baseSpeed;
      }

      // Fade near boundaries
      const dist = Math.abs(car.position.x);
      const opacity = dist > fadeStart ? 1 - (dist - fadeStart) / (halfX + 15 - fadeStart) : 1;
      car.traverse(child => {
        if (child.isMesh && child.material) {
          child.material.transparent = true;
          child.material.opacity = Math.max(0, opacity);
        }
      });
    }
  }

  /**
   * Called when an NPC is killed — plays Death animation instead of tilt.
   */
  onNPCDeath(ped) {
    if (ped.userData.actions) {
      const deathAnim = ped.userData.actions.get('Death') || ped.userData.actions.get('Defeat');
      if (deathAnim) {
        deathAnim.setLoop(THREE.LoopOnce, 1);
        deathAnim.clampWhenFinished = true;
        ped.userData.currentAction = playAnimation(ped.userData.actions, deathAnim === ped.userData.actions.get('Death') ? 'Death' : 'Defeat', ped.userData.currentAction, 0.15);
      }
    }
  }
}
