import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  createAsphaltMaterial,
  createSidewalkMaterial,
} from './assetLoader.js';
import {
  createSignTexture,
} from './textures.js';

// Confined area constants
const ROAD_WIDTH = 14;
const ROAD_LENGTH = 100;
const SIDEWALK_WIDTH = 3;
const AREA_HALF_X = ROAD_LENGTH / 2 + 10;
const AREA_HALF_Z = 40;

// Vehicle colors (SA style)
const CAR_COLORS = [
  '#2a4a2a', '#8a2020', '#1a1a4a', '#e8e0d0', '#3a3a3a',
  '#c8a030', '#404040', '#6a1a1a', '#2a2a6a', '#d0c0a0',
];

export const SPECIAL_BUILDINGS = [];

export class City {
  constructor(scene) {
    this.scene = scene;
    this.colliders = [];
    this.interactionZones = [];
    this.group = new THREE.Group();
    this.group.name = 'city';
    scene.add(this.group);
  }

  generate() {
    this._createGround();
    this._createRoad();
    this._createSidewalks();
    this._createGasStation();
    this._createParkingLot();
    this._createStreetLights();
    this._createPalmTrees();
    this._createProps();
    this._createBoundaryFog();
    return {
      colliders: this.colliders,
      interactionZones: this.interactionZones,
      // Export bounds for NPC system
      bounds: { halfX: AREA_HALF_X, halfZ: AREA_HALF_Z, roadWidth: ROAD_WIDTH },
    };
  }

  // ============ GROUND ============
  _createGround() {
    const sizeX = AREA_HALF_X * 2 + 20;
    const sizeZ = AREA_HALF_Z * 2 + 20;
    const geo = new THREE.PlaneGeometry(sizeX, sizeZ);
    const mat = createSidewalkMaterial(Math.round(sizeX / 6), Math.round(sizeZ / 6));
    mat.color = new THREE.Color('#8a8070');
    const ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    this.group.add(ground);
  }

  // ============ SINGLE 2-LANE ROAD (along X-axis, centered at Z=0) ============
  _createRoad() {
    const length = ROAD_LENGTH + 40; // extend past visible area for fade effect

    // Asphalt surface
    const roadGeo = new THREE.PlaneGeometry(length, ROAD_WIDTH);
    const roadMat = createAsphaltMaterial(Math.round(length / 8), 2);
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.01, 0);
    road.receiveShadow = true;
    this.group.add(road);

    // Center dashed yellow line (lane divider)
    const dashLen = 4, gapLen = 6;
    const markMat = new THREE.MeshBasicMaterial({ color: '#a09030' });
    for (let d = -length / 2; d < length / 2; d += dashLen + gapLen) {
      const dashGeo = new THREE.PlaneGeometry(dashLen, 0.15);
      const dash = new THREE.Mesh(dashGeo, markMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(d + dashLen / 2, 0.04, 0);
      this.group.add(dash);
    }

    // Edge lines (solid white)
    const edgeMat = new THREE.MeshBasicMaterial({ color: '#808070' });
    for (const side of [-1, 1]) {
      const edgeGeo = new THREE.PlaneGeometry(length, 0.1);
      const edge = new THREE.Mesh(edgeGeo, edgeMat);
      edge.rotation.x = -Math.PI / 2;
      edge.position.set(0, 0.04, (ROAD_WIDTH / 2 - 0.5) * side);
      this.group.add(edge);
    }

    // Curbs on both sides
    const curbMat = createSidewalkMaterial(1, Math.round(length / 4));
    for (const side of [-1, 1]) {
      const curbGeo = new THREE.BoxGeometry(length, 0.22, 0.35);
      const curb = new THREE.Mesh(curbGeo, curbMat);
      curb.position.set(0, 0.11, (ROAD_WIDTH / 2 + 0.17) * side);
      curb.castShadow = true;
      this.group.add(curb);
    }
  }

  // ============ SIDEWALKS ============
  _createSidewalks() {
    const length = ROAD_LENGTH + 40;
    const swMat = createSidewalkMaterial(Math.round(length / 5), 1);

    for (const side of [-1, 1]) {
      const swGeo = new THREE.BoxGeometry(length, 0.18, SIDEWALK_WIDTH);
      const sw = new THREE.Mesh(swGeo, swMat);
      sw.position.set(0, 0.09, (ROAD_WIDTH / 2 + 0.35 + SIDEWALK_WIDTH / 2) * side);
      sw.receiveShadow = true;
      this.group.add(sw);
    }
  }

  // ============ GAS STATION (south side of road, -Z) ============
  _createGasStation() {
    const stationX = -10;
    const stationZ = -(ROAD_WIDTH / 2 + SIDEWALK_WIDTH + 12);
    const stationMat = new THREE.MeshStandardMaterial({ color: '#c8b898', roughness: 0.8 });
    const roofMat = new THREE.MeshStandardMaterial({ color: '#8a2020', roughness: 0.6 });
    const metalMat = new THREE.MeshStandardMaterial({ color: '#4a4a48', roughness: 0.5, metalness: 0.4 });

    // Main building
    const buildW = 12, buildH = 5, buildD = 8;
    const buildGeo = new THREE.BoxGeometry(buildW, buildH, buildD);
    const building = new THREE.Mesh(buildGeo, stationMat);
    building.position.set(stationX, buildH / 2, stationZ - 6);
    building.castShadow = true;
    building.receiveShadow = true;
    this.group.add(building);
    this.colliders.push(new THREE.Box3().setFromObject(building));

    // Flat roof overhang
    const roofGeo = new THREE.BoxGeometry(buildW + 2, 0.3, buildD + 2);
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.set(stationX, buildH + 0.15, stationZ - 6);
    roof.castShadow = true;
    this.group.add(roof);

    // Sign: "$GANG GAS"
    const signTex = createSignTexture('$GANG GAS', 512, 128, {
      textColor: '#e8a000', borderColor: '#e8a000',
      bgColor: 'rgba(30, 20, 10, 0.9)', fontSize: 52,
    });
    const signGeo = new THREE.PlaneGeometry(8, 2);
    const signMat = new THREE.MeshBasicMaterial({ map: signTex, transparent: true });
    const sign = new THREE.Mesh(signGeo, signMat);
    sign.position.set(stationX, buildH + 1.5, stationZ - 6 + buildD / 2 + 0.1);
    this.group.add(sign);

    // Neon glow
    const neon = new THREE.PointLight('#e8a000', 3, 25);
    neon.position.set(stationX, buildH, stationZ - 2);
    this.group.add(neon);

    // Gas pump canopy (open-air roof over pump island)
    const canopyW = 16, canopyD = 8, canopyH = 4.5;
    const canopyGeo = new THREE.BoxGeometry(canopyW, 0.25, canopyD);
    const canopy = new THREE.Mesh(canopyGeo, roofMat);
    canopy.position.set(stationX, canopyH, stationZ);
    canopy.castShadow = true;
    this.group.add(canopy);

    // Canopy support pillars (4 corners)
    const pillarGeo = new THREE.CylinderGeometry(0.2, 0.2, canopyH, 8);
    const pillars = [
      [stationX - canopyW / 2 + 1, stationZ - canopyD / 2 + 1],
      [stationX + canopyW / 2 - 1, stationZ - canopyD / 2 + 1],
      [stationX - canopyW / 2 + 1, stationZ + canopyD / 2 - 1],
      [stationX + canopyW / 2 - 1, stationZ + canopyD / 2 - 1],
    ];
    for (const [px, pz] of pillars) {
      const pillar = new THREE.Mesh(pillarGeo, metalMat);
      pillar.position.set(px, canopyH / 2, pz);
      pillar.castShadow = true;
      this.group.add(pillar);
    }

    // Canopy lights (underneath)
    for (const side of [-1, 1]) {
      const light = new THREE.PointLight('#ffe8c0', 1.5, 15);
      light.position.set(stationX + side * 5, canopyH - 0.5, stationZ);
      this.group.add(light);
    }

    // Gas pumps (3 pump islands)
    const pumpMat = new THREE.MeshStandardMaterial({ color: '#d0d0d0', roughness: 0.5 });
    const pumpBaseMat = new THREE.MeshStandardMaterial({ color: '#3a3a38', roughness: 0.7 });
    for (let i = -1; i <= 1; i++) {
      const px = stationX + i * 5;
      const pz = stationZ;

      // Pump base
      const baseGeo = new THREE.BoxGeometry(0.8, 0.3, 1.5);
      const base = new THREE.Mesh(baseGeo, pumpBaseMat);
      base.position.set(px, 0.15, pz);
      this.group.add(base);

      // Pump body
      const pumpGeo = new THREE.BoxGeometry(0.6, 1.5, 0.5);
      const pump = new THREE.Mesh(pumpGeo, pumpMat);
      pump.position.set(px, 1.05, pz);
      pump.castShadow = true;
      this.group.add(pump);

      // Pump screen (dark)
      const screenGeo = new THREE.PlaneGeometry(0.4, 0.3);
      const screenMat = new THREE.MeshBasicMaterial({ color: '#1a3a1a' });
      const screen = new THREE.Mesh(screenGeo, screenMat);
      screen.position.set(px, 1.4, pz + 0.26);
      this.group.add(screen);

      // Hose
      const hoseGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.2, 6);
      const hoseMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.9 });
      const hose = new THREE.Mesh(hoseGeo, hoseMat);
      hose.position.set(px + 0.35, 0.9, pz);
      hose.rotation.z = 0.4;
      this.group.add(hose);

      // Collider for pump
      this.colliders.push(new THREE.Box3(
        new THREE.Vector3(px - 0.5, 0, pz - 0.8),
        new THREE.Vector3(px + 0.5, 2, pz + 0.8)
      ));
    }

    // Concrete pad under pumps
    const padGeo = new THREE.BoxGeometry(canopyW, 0.12, canopyD);
    const padMat = createSidewalkMaterial(3, 1);
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.position.set(stationX, 0.06, stationZ);
    pad.receiveShadow = true;
    this.group.add(pad);
  }

  // ============ PARKING LOT (north side of road, +Z) ============
  _createParkingLot() {
    const lotX = 5;
    const lotZ = ROAD_WIDTH / 2 + SIDEWALK_WIDTH + 8;
    const lotW = 30, lotD = 14;

    // Asphalt surface
    const lotGeo = new THREE.PlaneGeometry(lotW, lotD);
    const lotMat = createAsphaltMaterial(4, 2);
    const lot = new THREE.Mesh(lotGeo, lotMat);
    lot.rotation.x = -Math.PI / 2;
    lot.position.set(lotX, 0.02, lotZ);
    lot.receiveShadow = true;
    this.group.add(lot);

    // Parking lines
    const lineMat = new THREE.MeshBasicMaterial({ color: '#b0a890' });
    const numSpots = 8;
    const spotW = lotW / numSpots;
    for (let i = 0; i <= numSpots; i++) {
      const lx = lotX - lotW / 2 + i * spotW;
      const lineGeo = new THREE.PlaneGeometry(0.1, lotD * 0.6);
      const line = new THREE.Mesh(lineGeo, lineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(lx, 0.05, lotZ);
      this.group.add(line);
    }

    // A few parked cars in the lot
    const bodyMat = new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.6 });
    const tireMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.9 });
    const windshieldMat = new THREE.MeshStandardMaterial({
      color: '#4a6a8a', roughness: 0.1, metalness: 0.8, transparent: true, opacity: 0.6,
    });

    const parkedSlots = [0, 2, 3, 5, 7]; // which slots have cars
    for (const slot of parkedSlots) {
      const cx = lotX - lotW / 2 + (slot + 0.5) * spotW;
      const cz = lotZ;
      const color = CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
      this._addParkedCar(cx, cz, Math.PI / 2 + (Math.random() - 0.5) * 0.1, color, bodyMat, tireMat, windshieldMat);
    }

    // Low concrete barrier around lot edges (back and sides)
    const barrierMat = new THREE.MeshStandardMaterial({ color: '#808078', roughness: 0.8 });
    // Back wall
    const backGeo = new THREE.BoxGeometry(lotW + 1, 0.6, 0.4);
    const back = new THREE.Mesh(backGeo, barrierMat);
    back.position.set(lotX, 0.3, lotZ + lotD / 2);
    back.castShadow = true;
    this.group.add(back);
    this.colliders.push(new THREE.Box3().setFromObject(back));

    // Side walls
    for (const side of [-1, 1]) {
      const sideGeo = new THREE.BoxGeometry(0.4, 0.6, lotD);
      const sw = new THREE.Mesh(sideGeo, barrierMat);
      sw.position.set(lotX + (lotW / 2 + 0.2) * side, 0.3, lotZ);
      sw.castShadow = true;
      this.group.add(sw);
      this.colliders.push(new THREE.Box3().setFromObject(sw));
    }
  }

  // Simplified parked car (sedan only)
  _addParkedCar(x, z, rotation, color, bodyMat, tireMat, windshieldMat) {
    const carGroup = new THREE.Group();
    const bMat = bodyMat.clone();
    bMat.color = new THREE.Color(color);

    // Body
    const chassisGeo = new THREE.BoxGeometry(4.2, 0.5, 1.85);
    const chassis = new THREE.Mesh(chassisGeo, bMat);
    chassis.position.y = 0.45;
    chassis.castShadow = true;
    carGroup.add(chassis);

    const upperGeo = new THREE.BoxGeometry(3.8, 0.4, 1.8);
    const upper = new THREE.Mesh(upperGeo, bMat);
    upper.position.y = 0.9;
    carGroup.add(upper);

    // Cabin
    const cabinGeo = new THREE.BoxGeometry(1.8, 0.75, 1.7);
    const cabin = new THREE.Mesh(cabinGeo, bMat);
    cabin.position.set(-0.1, 1.5, 0);
    cabin.castShadow = true;
    carGroup.add(cabin);

    // Windows
    const glassMat = windshieldMat;
    const winGeo = new THREE.BoxGeometry(1.6, 0.5, 1.65);
    const win = new THREE.Mesh(winGeo, glassMat);
    win.position.set(-0.1, 1.5, 0);
    carGroup.add(win);

    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.22, 10);
    const wheelPos = [[1.3, 0.35, 0.93], [1.3, 0.35, -0.93], [-1.3, 0.35, 0.93], [-1.3, 0.35, -0.93]];
    for (const [wx, wy, wz] of wheelPos) {
      const wheel = new THREE.Mesh(wheelGeo, tireMat);
      wheel.position.set(wx, wy, wz);
      wheel.rotation.x = Math.PI / 2;
      carGroup.add(wheel);
    }

    // Headlights / taillights
    const hlGeo = new THREE.BoxGeometry(0.06, 0.12, 0.25);
    const hlMat = new THREE.MeshBasicMaterial({ color: '#ffe8b0' });
    const tlMat = new THREE.MeshBasicMaterial({ color: '#cc2020' });
    for (const s of [-0.65, 0.65]) {
      const hl = new THREE.Mesh(hlGeo, hlMat);
      hl.position.set(2.1, 0.6, s);
      carGroup.add(hl);
      const tl = new THREE.Mesh(hlGeo, tlMat);
      tl.position.set(-2.1, 0.6, s);
      carGroup.add(tl);
    }

    carGroup.position.set(x, 0, z);
    carGroup.rotation.y = rotation;
    this.group.add(carGroup);
    this.colliders.push(new THREE.Box3().setFromObject(carGroup));
  }

  // ============ STREET LIGHTS ============
  _createStreetLights() {
    const lampColor = '#e8a050';
    const poleMat = new THREE.MeshStandardMaterial({ color: '#4a4a48', roughness: 0.6, metalness: 0.4 });

    // Lights along the road at intervals
    for (let x = -ROAD_LENGTH / 2; x <= ROAD_LENGTH / 2; x += 20) {
      for (const side of [-1, 1]) {
        this._addStreetLight(x, (ROAD_WIDTH / 2 + SIDEWALK_WIDTH + 1) * side, lampColor, poleMat);
      }
    }
  }

  _addStreetLight(x, z, color, poleMat) {
    const h = 7;
    const poleGeo = new THREE.CylinderGeometry(0.06, 0.1, h, 6);
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(x, h / 2, z);
    this.group.add(pole);

    const armDir = z > 0 ? -1 : 1; // arm points toward road
    const armGeo = new THREE.BoxGeometry(2.5, 0.06, 0.06);
    const arm = new THREE.Mesh(armGeo, poleMat);
    arm.position.set(x, h, z + 1.25 * armDir);
    this.group.add(arm);

    const fixGeo = new THREE.BoxGeometry(0.8, 0.15, 0.4);
    const fixMat = new THREE.MeshStandardMaterial({ color: '#d0c0a0', roughness: 0.5, emissive: color, emissiveIntensity: 0.3 });
    const fix = new THREE.Mesh(fixGeo, fixMat);
    fix.position.set(x, h - 0.15, z + 2.5 * armDir);
    this.group.add(fix);

    const light = new THREE.PointLight(color, 2, 18);
    light.position.set(x, h - 0.4, z + 2.5 * armDir);
    this.group.add(light);
  }

  // ============ PALM TREES ============
  _createPalmTrees() {
    const loader = new GLTFLoader();
    
    // Palm tree positions along sidewalks
    const positions = [
      [-35, -(ROAD_WIDTH / 2 + SIDEWALK_WIDTH + 2)],
      [-15, (ROAD_WIDTH / 2 + SIDEWALK_WIDTH + 2)],
      [20, -(ROAD_WIDTH / 2 + SIDEWALK_WIDTH + 2)],
      [35, (ROAD_WIDTH / 2 + SIDEWALK_WIDTH + 2)],
      [-5, (ROAD_WIDTH / 2 + SIDEWALK_WIDTH + 25)],
      [25, -(ROAD_WIDTH / 2 + SIDEWALK_WIDTH + 20)],
    ];

    // Load the palm tree model once, then clone for each position
    loader.load('/palm tree/scene.gltf', (gltf) => {
      const palmModel = gltf.scene;
      palmModel.traverse((node) => {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
        }
      });

      for (const [tx, tz] of positions) {
        const tree = palmModel.clone();
        tree.position.set(tx, 0, tz);
        tree.scale.set(0.8, 0.8, 0.8); // Adjust scale as needed
        tree.rotation.y = Math.random() * Math.PI * 2; // Random rotation for variety
        this.group.add(tree);
      }
    });
  }

  // ============ PROPS ============
  _createProps() {
    const propMat = new THREE.MeshStandardMaterial({ color: '#3a3830', roughness: 0.85, metalness: 0.2 });

    // Dumpster behind gas station
    const dumpsterMat = new THREE.MeshStandardMaterial({ color: '#2a4a2a', roughness: 0.8 });
    const dGeo = new THREE.BoxGeometry(2, 1.2, 1.2);
    const dumpster = new THREE.Mesh(dGeo, dumpsterMat);
    dumpster.position.set(-16, 0.6, -(ROAD_WIDTH / 2 + SIDEWALK_WIDTH + 18));
    dumpster.castShadow = true;
    this.group.add(dumpster);
    this.colliders.push(new THREE.Box3().setFromObject(dumpster));

    // Fire hydrant
    const hydrantMat = new THREE.MeshStandardMaterial({ color: '#c04020', roughness: 0.6 });
    const hGeo = new THREE.CylinderGeometry(0.12, 0.18, 0.6, 6);
    for (const [hx, hz] of [[15, ROAD_WIDTH / 2 + 1.5], [-25, -(ROAD_WIDTH / 2 + 1.5)]]) {
      const hydrant = new THREE.Mesh(hGeo, hydrantMat);
      hydrant.position.set(hx, 0.3, hz);
      hydrant.castShadow = true;
      this.group.add(hydrant);
    }

    // Trash cans along sidewalk
    for (const [tx, tz] of [[-30, ROAD_WIDTH / 2 + 2], [10, -(ROAD_WIDTH / 2 + 2)], [30, ROAD_WIDTH / 2 + 2]]) {
      const tGeo = new THREE.CylinderGeometry(0.25, 0.3, 0.7, 8);
      const trash = new THREE.Mesh(tGeo, propMat);
      trash.position.set(tx, 0.35, tz);
      trash.castShadow = true;
      this.group.add(trash);
    }

    // Billboard near gas station — uses actual banner image
    const bbLoader = new THREE.TextureLoader();
    const bbTex = bbLoader.load('/gang banner.png');
    bbTex.colorSpace = THREE.SRGBColorSpace;
    const bbGeo = new THREE.PlaneGeometry(18, 6);
    const bbMat = new THREE.MeshBasicMaterial({ map: bbTex, side: THREE.DoubleSide });
    const billboard = new THREE.Mesh(bbGeo, bbMat);
    billboard.position.set(-10, 12, -(ROAD_WIDTH / 2 + SIDEWALK_WIDTH + 24));
    this.group.add(billboard);

    // Billboard frame
    const frameMat = new THREE.MeshStandardMaterial({ color: '#2a2a28', roughness: 0.5, metalness: 0.6 });
    const frameW = 18.4, frameH = 6.4, frameD = 0.15;
    const frameBack = new THREE.Mesh(
      new THREE.BoxGeometry(frameW, frameH, frameD),
      frameMat
    );
    frameBack.position.set(-10, 12, -(ROAD_WIDTH / 2 + SIDEWALK_WIDTH + 24) - 0.1);
    this.group.add(frameBack);

    // Billboard poles (two support poles)
    const bbPoleMat = new THREE.MeshStandardMaterial({ color: '#4a4a48', roughness: 0.6, metalness: 0.4 });
    const bbPoleGeo = new THREE.CylinderGeometry(0.2, 0.25, 12, 6);
    const bbPoleL = new THREE.Mesh(bbPoleGeo, bbPoleMat);
    bbPoleL.position.set(-10 - 6, 6, -(ROAD_WIDTH / 2 + SIDEWALK_WIDTH + 24));
    this.group.add(bbPoleL);
    const bbPoleR = new THREE.Mesh(bbPoleGeo, bbPoleMat);
    bbPoleR.position.set(-10 + 6, 6, -(ROAD_WIDTH / 2 + SIDEWALK_WIDTH + 24));
    this.group.add(bbPoleR);
  }

  // ============ BOUNDARY WALLS ============
  _createBoundaryFog() {
    // Don't override scene fog here — lighting.js sets the coastal haze
    // The HDRI sky sphere + FogExp2 from lighting.js handle the sky/fade

    // Invisible boundary walls to prevent player from walking off
    const wallMat = new THREE.MeshBasicMaterial({ visible: false });
    const wallH = 10;

    // Left/Right walls (along Z axis)
    for (const side of [-1, 1]) {
      const wallGeo = new THREE.BoxGeometry(1, wallH, AREA_HALF_Z * 2);
      const wall = new THREE.Mesh(wallGeo, wallMat);
      wall.position.set(AREA_HALF_X * side, wallH / 2, 0);
      this.group.add(wall);
      this.colliders.push(new THREE.Box3().setFromObject(wall));
    }

    // Front/Back walls (along X axis)
    for (const side of [-1, 1]) {
      const wallGeo = new THREE.BoxGeometry(AREA_HALF_X * 2, wallH, 1);
      const wall = new THREE.Mesh(wallGeo, wallMat);
      wall.position.set(0, wallH / 2, AREA_HALF_Z * side);
      this.group.add(wall);
      this.colliders.push(new THREE.Box3().setFromObject(wall));
    }
  }

  getSpawnPosition() {
    // Spawn player on the sidewalk near the gas station
    return new THREE.Vector3(0, 0.2, -(ROAD_WIDTH / 2 + 2));
  }

  getMinimapData() {
    return {
      areaHalfX: AREA_HALF_X,
      areaHalfZ: AREA_HALF_Z,
      roadWidth: ROAD_WIDTH,
      roadLength: ROAD_LENGTH,
    };
  }
}
