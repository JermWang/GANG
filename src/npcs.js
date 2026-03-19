import * as THREE from 'three';
import { loadModel, cloneModel, setupAnimations, playAnimation, getModelHeight } from './modelLoader.js';

// City-appropriate civilian models from Quaternius pack
const CIVILIAN_MODELS = [
  'Casual_Male', 'Casual_Female',
  'Casual2_Male', 'Casual2_Female',
  'Casual3_Male', 'Casual3_Female',
  'Casual_Bald',
  'Suit_Male', 'Suit_Female',
  'Worker_Male', 'Worker_Female',
  'OldClassy_Male', 'OldClassy_Female',
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
    this.pedestrians = [];
    this.trafficCars = [];
    this.group = new THREE.Group();
    this.group.name = 'npcs';
    scene.add(this.group);
    this._cachedModels = []; // loaded GLTF data per model type
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

  initialize(roadPositions, sidewalkPositions) {
    // Spawn pedestrians on sidewalks
    for (let i = 0; i < 15; i++) {
      this._spawnPedestrian();
    }

    // Spawn traffic cars on roads
    for (let i = 0; i < 8; i++) {
      this._spawnTrafficCar();
    }
  }

  _spawnPedestrian() {
    const ped = this._createPedestrianMesh();
    
    // Random position on sidewalk area
    const range = 70;
    ped.position.set(
      (Math.random() - 0.5) * range,
      0,
      (Math.random() - 0.5) * range
    );

    // Random walk direction
    ped.userData.direction = new THREE.Vector3(
      Math.random() - 0.5,
      0,
      Math.random() - 0.5
    ).normalize();
    ped.userData.speed = 1.5 + Math.random() * 1.5;
    ped.userData.walkTimer = 0;
    ped.userData.turnTimer = 3 + Math.random() * 5;

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

  _spawnTrafficCar() {
    const car = this._createTrafficCarMesh();
    
    // Random position on road
    const range = 60;
    const roadOffset = 3; // Offset from center of road
    
    // Pick a random road lane
    const isHorizontal = Math.random() < 0.5;
    if (isHorizontal) {
      car.position.set(
        (Math.random() - 0.5) * range,
        0.4,
        Math.floor(Math.random() * 3 - 1) * 54 + (Math.random() < 0.5 ? roadOffset : -roadOffset)
      );
      car.rotation.y = Math.random() < 0.5 ? 0 : Math.PI;
    } else {
      car.position.set(
        Math.floor(Math.random() * 3 - 1) * 54 + (Math.random() < 0.5 ? roadOffset : -roadOffset),
        0.4,
        (Math.random() - 0.5) * range
      );
      car.rotation.y = Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
    }

    car.userData.speed = 8 + Math.random() * 6;
    car.userData.direction = new THREE.Vector3(
      Math.sin(car.rotation.y),
      0,
      Math.cos(car.rotation.y)
    );

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
    const bounds = 80;

    // Update pedestrians
    for (const ped of this.pedestrians) {
      // Update animation mixer
      if (ped.userData.mixer) {
        ped.userData.mixer.update(dt);
      }

      // Handle dead NPCs
      if (ped.userData.dead) {
        ped.userData.deathTimer -= dt;
        // Sink into ground slowly after death anim plays
        if (ped.userData.deathTimer < 3) {
          if (ped.position.y > -0.5) {
            ped.position.y -= dt * 0.3;
          }
        }
        // Respawn after timer
        if (ped.userData.deathTimer <= 0) {
          ped.userData.dead = false;
          ped.rotation.x = 0;
          ped.rotation.z = 0;
          ped.position.y = 0;
          ped.position.x = (Math.random() - 0.5) * 70;
          ped.position.z = (Math.random() - 0.5) * 70;
          ped.userData.speed = 1.5 + Math.random() * 1.5;
          ped.userData.direction.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();

          // Switch back to Walk animation
          if (ped.userData.actions) {
            const walkAction = ped.userData.actions.get('Walk') || ped.userData.actions.get('Idle');
            if (walkAction) {
              ped.userData.currentAction = playAnimation(ped.userData.actions, 'Walk', ped.userData.currentAction, 0.3);
            }
          }
        }
        continue;
      }

      // Move forward
      ped.position.x += ped.userData.direction.x * ped.userData.speed * dt;
      ped.position.z += ped.userData.direction.z * ped.userData.speed * dt;

      // Face direction
      ped.rotation.y = Math.atan2(ped.userData.direction.x, ped.userData.direction.z);

      // Random turns
      ped.userData.turnTimer -= dt;
      if (ped.userData.turnTimer <= 0) {
        ped.userData.direction.set(
          Math.random() - 0.5,
          0,
          Math.random() - 0.5
        ).normalize();
        ped.userData.turnTimer = 3 + Math.random() * 5;
      }

      // Wrap around bounds
      if (ped.position.x > bounds) ped.position.x = -bounds;
      if (ped.position.x < -bounds) ped.position.x = bounds;
      if (ped.position.z > bounds) ped.position.z = -bounds;
      if (ped.position.z < -bounds) ped.position.z = bounds;
    }

    // Update traffic cars
    for (const car of this.trafficCars) {
      // Move forward
      car.position.x += car.userData.direction.x * car.userData.speed * dt;
      car.position.z += car.userData.direction.z * car.userData.speed * dt;

      // Wrap around bounds
      if (car.position.x > bounds) car.position.x = -bounds;
      if (car.position.x < -bounds) car.position.x = bounds;
      if (car.position.z > bounds) car.position.z = -bounds;
      if (car.position.z < -bounds) car.position.z = bounds;
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
