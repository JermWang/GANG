import * as THREE from 'three';
import { loadModel, setupAnimations, playAnimation, getModelHeight } from './modelLoader.js';

const WALK_SPEED = 8;
const SPRINT_SPEED = 16;
const PLAYER_RADIUS = 0.5;
const PLAYER_HEIGHT = 1.8;
const GRAVITY = -25;
const GROUND_Y = 0.15; // Sidewalk height

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.onGround = true;

    // Input state
    this.keys = { w: false, a: false, s: false, d: false, shift: false, space: false };

    // Euler for mouse look
    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this.yaw = 0;

    // Model container
    this.mesh = new THREE.Group();
    this.mesh.name = 'player';
    scene.add(this.mesh);

    // Animation state
    this.mixer = null;
    this.actions = null;
    this.currentAction = null;
    this.modelReady = false;

    // Collision helper
    this._box = new THREE.Box3();
    this._tempVec = new THREE.Vector3();

    this._setupInput();
  }

  async loadModel() {
    try {
      // Load Tommy Vercetti FBX (character mesh + skeleton)
      const charPath = '/assets/rigged/PC _ Computer - Grand Theft Auto_ Vice City - Characters - Tommy Vercetti.fbx';
      const charData = await loadModel(charPath);
      const model = charData.scene;

      // FBX models from Mixamo come in cm scale — convert to meters
      const rawHeight = getModelHeight(model);
      const targetHeight = PLAYER_HEIGHT; // 1.8m
      const scale = targetHeight / rawHeight;
      model.scale.setScalar(scale);

      // Center the model on its origin (fix pivot point)
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      // Only offset X and Z to center horizontally; keep Y at feet
      model.position.x -= center.x;
      model.position.z -= center.z;
      model.position.y -= box.min.y; // put feet at y=0

      // Enable shadows and fix materials
      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (child.material) {
            child.material.metalness = 0;
            child.material.roughness = 0.8;
            if (child.material.map && child.material.map.image) {
              child.material.map.needsUpdate = true;
            }
          }
        }
        if (child.isBone && child.name.includes('RightHand') && !child.name.includes('Index') && !child.name.includes('Thumb')) {
          this.rightHandBone = child;
        }
      });

      this.mesh.add(model);

      // Setup mixer on the character model
      this.mixer = new THREE.AnimationMixer(model);
      this.actions = new Map();

      // Load Mixamo animation FBXs and bind them to the character
      const animFiles = {
        'Idle':     '/assets/rigged/pistol idle.fbx',
        'Walk':     '/assets/rigged/pistol walk.fbx',
        'Run':      '/assets/rigged/Pistol Run.fbx',
        'Sprint':   '/assets/rigged/Fast Run.fbx',
        'Jump':     '/assets/rigged/Jump.fbx',
        'Strafe':   '/assets/rigged/pistol strafe.fbx',
        'WalkBack': '/assets/rigged/pistol walk backward.fbx',
        'RunBack':  '/assets/rigged/pistol run backward.fbx',
      };

      const animPromises = Object.entries(animFiles).map(async ([name, path]) => {
        try {
          const animData = await loadModel(path);
          if (animData.animations.length > 0) {
            const clip = animData.animations[0];
            clip.name = name; // rename clip to our standard name
            const action = this.mixer.clipAction(clip);
            this.actions.set(name, action);
          }
        } catch (e) {
          console.warn(`Could not load animation: ${name}`, e);
        }
      });

      await Promise.all(animPromises);

      // Start with idle animation
      const idleAction = this.actions.get('Idle');
      if (idleAction) {
        idleAction.play();
        this.currentAction = idleAction;
      }

      this.modelReady = true;
      console.log('Player model loaded with animations:', [...this.actions.keys()]);
    } catch (e) {
      console.warn('Could not load player FBX, using fallback box mesh', e);
      this._createFallbackMesh();
      this.modelReady = true;
    }
  }

  _findAnim(names) {
    if (!this.actions) return null;
    for (const n of names) {
      if (this.actions.has(n)) return n;
    }
    // Partial match
    for (const [key] of this.actions) {
      for (const n of names) {
        if (key.toLowerCase().includes(n.toLowerCase())) return key;
      }
    }
    return null;
  }

  _createFallbackMesh() {
    const mat = new THREE.MeshStandardMaterial({ color: '#2a6a2a', roughness: 0.75 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.6, 0.3), mat);
    body.position.y = 0.8;
    body.castShadow = true;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.4, 0.35), mat);
    head.position.y = 1.65;
    head.castShadow = true;
    this.mesh.add(body, head);
  }

  _setupInput() {
    document.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      if (key === 'w') this.keys.w = true;
      if (key === 'a') this.keys.a = true;
      if (key === 's') this.keys.s = true;
      if (key === 'd') this.keys.d = true;
      if (key === 'shift') this.keys.shift = true;
      if (key === ' ') this.keys.space = true;
    });

    document.addEventListener('keyup', (e) => {
      const key = e.key.toLowerCase();
      if (key === 'w') this.keys.w = false;
      if (key === 'a') this.keys.a = false;
      if (key === 's') this.keys.s = false;
      if (key === 'd') this.keys.d = false;
      if (key === 'shift') this.keys.shift = false;
      if (key === ' ') this.keys.space = false;
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.pointerLocked) return;
      this.yaw -= e.movementX * 0.002;
    });
  }

  set pointerLocked(val) {
    this._pointerLocked = val;
  }

  get pointerLocked() {
    return this._pointerLocked || false;
  }

  spawn(position) {
    this.mesh.position.copy(position);
    this.mesh.position.y = GROUND_Y;
    this.velocity.set(0, 0, 0);
    this.yaw = 0;
  }

  update(dt, colliders) {
    // Always update animation mixer
    if (this.mixer) this.mixer.update(dt);

    // Only process input when pointer is locked (desktop) or enabled (mobile)
    if (!this.pointerLocked) return;

    const speed = this.keys.shift ? SPRINT_SPEED : WALK_SPEED;

    // Movement direction relative to camera yaw
    this.direction.set(0, 0, 0);
    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);

    if (this.keys.w) this.direction.add(forward);
    if (this.keys.s) this.direction.sub(forward);
    if (this.keys.a) this.direction.sub(right);
    if (this.keys.d) this.direction.add(right);

    const isMoving = this.direction.lengthSq() > 0;
    if (isMoving) {
      this.direction.normalize();
    }

    // Animation state transitions
    if (this.actions) {
      const isSprinting = this.keys.shift && isMoving;
      let targetAnim;
      if (!this.onGround) {
        targetAnim = this._findAnim(['Jump', 'jump']);
      } else if (isSprinting) {
        targetAnim = this._findAnim(['Run', 'run', 'Sprint']);
      } else if (isMoving) {
        targetAnim = this._findAnim(['Walk', 'walk', 'Walking']);
      } else {
        targetAnim = this._findAnim(['Idle', 'idle']);
      }
      if (targetAnim) {
        this.currentAction = playAnimation(this.actions, targetAnim, this.currentAction);
      }
    }

    // Apply movement
    this.velocity.x = this.direction.x * speed;
    this.velocity.z = this.direction.z * speed;

    // Gravity
    if (!this.onGround) {
      this.velocity.y += GRAVITY * dt;
    }

    // Jump
    if (this.keys.space && this.onGround) {
      this.velocity.y = 8;
      this.onGround = false;
    }

    // Calculate new position
    const newPos = this.mesh.position.clone();
    newPos.x += this.velocity.x * dt;
    newPos.y += this.velocity.y * dt;
    newPos.z += this.velocity.z * dt;

    // Ground check (model origin at feet)
    if (newPos.y <= GROUND_Y) {
      newPos.y = GROUND_Y;
      this.velocity.y = 0;
      this.onGround = true;
    }

    // Collision detection (slide along walls)
    const playerMin = new THREE.Vector3(
      newPos.x - PLAYER_RADIUS,
      newPos.y,
      newPos.z - PLAYER_RADIUS
    );
    const playerMax = new THREE.Vector3(
      newPos.x + PLAYER_RADIUS,
      newPos.y + PLAYER_HEIGHT,
      newPos.z + PLAYER_RADIUS
    );
    this._box.set(playerMin, playerMax);

    let collided = false;
    for (const collider of colliders) {
      if (this._box.intersectsBox(collider)) {
        collided = true;

        // Try X-only movement
        const xOnlyPos = this.mesh.position.clone();
        xOnlyPos.x += this.velocity.x * dt;
        const xBox = new THREE.Box3(
          new THREE.Vector3(xOnlyPos.x - PLAYER_RADIUS, xOnlyPos.y, xOnlyPos.z - PLAYER_RADIUS),
          new THREE.Vector3(xOnlyPos.x + PLAYER_RADIUS, xOnlyPos.y + PLAYER_HEIGHT, xOnlyPos.z + PLAYER_RADIUS)
        );
        let xBlocked = false;
        for (const c of colliders) {
          if (xBox.intersectsBox(c)) { xBlocked = true; break; }
        }

        // Try Z-only movement
        const zOnlyPos = this.mesh.position.clone();
        zOnlyPos.z += this.velocity.z * dt;
        const zBox = new THREE.Box3(
          new THREE.Vector3(zOnlyPos.x - PLAYER_RADIUS, zOnlyPos.y, zOnlyPos.z - PLAYER_RADIUS),
          new THREE.Vector3(zOnlyPos.x + PLAYER_RADIUS, zOnlyPos.y + PLAYER_HEIGHT, zOnlyPos.z + PLAYER_RADIUS)
        );
        let zBlocked = false;
        for (const c of colliders) {
          if (zBox.intersectsBox(c)) { zBlocked = true; break; }
        }

        // Wall sliding
        if (!xBlocked) newPos.x = xOnlyPos.x;
        else newPos.x = this.mesh.position.x;

        if (!zBlocked) newPos.z = zOnlyPos.z;
        else newPos.z = this.mesh.position.z;

        break;
      }
    }

    this.mesh.position.copy(newPos);

    // Rotate mesh to face movement direction
    if (isMoving) {
      this.mesh.rotation.y = this.yaw;
    }
  }

  getPosition() {
    return this.mesh.position;
  }

  getYaw() {
    return this.yaw;
  }
}
