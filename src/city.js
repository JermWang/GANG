import * as THREE from 'three';
import {
  createBuildingMaterialSet,
  createAsphaltMaterial,
  createSidewalkMaterial,
  createBrickMaterial,
} from './assetLoader.js';
import {
  createSignTexture,
  createGraffitiTexture,
} from './textures.js';

// City layout constants
const BLOCK_SIZE = 40;
const ROAD_WIDTH = 14;
const SIDEWALK_WIDTH = 3;
const CELL_SIZE = BLOCK_SIZE + ROAD_WIDTH;
const GRID_SIZE = 3;
const CITY_HALF = (GRID_SIZE * CELL_SIZE) / 2;

// SA-style warm building color palette
const SA_COLORS = [
  '#8a7a60', '#9a8a6a', '#b0a080', '#7a6a50', '#c0a878',
  '#a09070', '#887060', '#706050', '#c4a880', '#947a5a',
  '#b8a088', '#6a5a48', '#d0b890', '#8a7058', '#a09078',
];

// Vehicle colors (SA style)
const CAR_COLORS = [
  '#2a4a2a', '#8a2020', '#1a1a4a', '#e8e0d0', '#3a3a3a',
  '#c8a030', '#404040', '#6a1a1a', '#2a2a6a', '#d0c0a0',
  '#1a3a1a', '#4a2020', '#e0d0c0', '#606060', '#8a6a20',
];

export const SPECIAL_BUILDINGS = [
  { id: 'bank', name: 'GANG BANK', gridX: 1, gridZ: 0, color: '#e8a000', neonColor: '#e8a000', panel: 'panel-bank' },
  { id: 'liquor', name: 'GANG LIQUOR', gridX: 0, gridZ: 1, color: '#c06020', neonColor: '#e07030', panel: 'panel-liquor' },
  { id: 'tower', name: 'GANG TOWER', gridX: 2, gridZ: 2, color: '#8090a0', neonColor: '#a0b0c0', panel: 'panel-tower' },
  { id: 'garage', name: 'GANG GARAGE', gridX: 2, gridZ: 0, color: '#508030', neonColor: '#70a040', panel: 'panel-garage' },
];

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
    this._createRoads();
    this._createCrosswalks();
    this._createBuildings();
    this._createStreetLights();
    this._createTrafficLights();
    this._createVehicles();
    this._createPalmTrees();
    this._createProps();
    this._createBranding();
    return {
      colliders: this.colliders,
      interactionZones: this.interactionZones,
    };
  }

  _createGround() {
    const size = GRID_SIZE * CELL_SIZE + ROAD_WIDTH * 4;
    const geo = new THREE.PlaneGeometry(size, size);
    const mat = createSidewalkMaterial(Math.round(size / 6), Math.round(size / 6));
    mat.color = new THREE.Color('#5a4a38');
    const ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    this.group.add(ground);
  }

  _createRoads() {
    for (let i = 0; i <= GRID_SIZE; i++) {
      const pos = -CITY_HALF + i * CELL_SIZE;
      this._addRoadStrip(pos, true);
      this._addRoadStrip(pos, false);
    }
  }

  _addRoadStrip(linePos, horizontal) {
    const length = GRID_SIZE * CELL_SIZE + ROAD_WIDTH * 2;
    const repLong = Math.round(length / 8);

    // Road — real asphalt PBR texture
    const roadGeo = new THREE.PlaneGeometry(
      horizontal ? length : ROAD_WIDTH,
      horizontal ? ROAD_WIDTH : length
    );
    const roadMat = createAsphaltMaterial(
      horizontal ? repLong : 2,
      horizontal ? 2 : repLong
    );
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(horizontal ? 0 : linePos, 0.01, horizontal ? linePos : 0);
    road.receiveShadow = true;
    this.group.add(road);

    // Lane markings overlay (painted on road)
    this._addLaneMarkings(linePos, horizontal, length);

    // Curbs + sidewalks
    for (const side of [-1, 1]) {
      // Curb — real concrete
      const curbGeo = new THREE.BoxGeometry(
        horizontal ? length : 0.35,
        0.22,
        horizontal ? 0.35 : length
      );
      const curbMat = createSidewalkMaterial(1, Math.round(length / 4));
      const curb = new THREE.Mesh(curbGeo, curbMat);
      const curbOff = (ROAD_WIDTH / 2 + 0.17) * side;
      curb.position.set(horizontal ? 0 : linePos + curbOff, 0.11, horizontal ? linePos + curbOff : 0);
      curb.castShadow = true;
      this.group.add(curb);

      // Sidewalk — real concrete PBR texture
      const swGeo = new THREE.BoxGeometry(
        horizontal ? length : SIDEWALK_WIDTH,
        0.18,
        horizontal ? SIDEWALK_WIDTH : length
      );
      const swMat = createSidewalkMaterial(
        horizontal ? Math.round(length / 5) : 1,
        horizontal ? 1 : Math.round(length / 5)
      );
      const sw = new THREE.Mesh(swGeo, swMat);
      const swOff = (ROAD_WIDTH / 2 + 0.35 + SIDEWALK_WIDTH / 2) * side;
      sw.position.set(horizontal ? 0 : linePos + swOff, 0.09, horizontal ? linePos + swOff : 0);
      sw.receiveShadow = true;
      this.group.add(sw);
    }
  }

  _createCrosswalks() {
    const cwMat = new THREE.MeshBasicMaterial({ color: '#b0a890' });
    const hGeo = new THREE.PlaneGeometry(ROAD_WIDTH * 0.7, 0.35);
    const vGeo = new THREE.PlaneGeometry(0.35, ROAD_WIDTH * 0.7);

    // Only add crosswalks at every other intersection to reduce mesh count
    for (let i = 0; i <= GRID_SIZE; i += 2) {
      for (let j = 0; j <= GRID_SIZE; j += 2) {
        const ix = -CITY_HALF + i * CELL_SIZE;
        const iz = -CITY_HALF + j * CELL_SIZE;

        for (let s = 0; s < 5; s++) {
          const h = new THREE.Mesh(hGeo, cwMat);
          h.rotation.x = -Math.PI / 2;
          h.position.set(ix, 0.05, iz + ROAD_WIDTH / 2 + 1.5 + s * 0.7);
          this.group.add(h);

          const v = new THREE.Mesh(vGeo, cwMat);
          v.rotation.x = -Math.PI / 2;
          v.position.set(ix + ROAD_WIDTH / 2 + 1.5 + s * 0.7, 0.05, iz);
          this.group.add(v);
        }
      }
    }
  }

  _addLaneMarkings(linePos, horizontal, length) {
    // Center dashed yellow line
    const dashLen = 4;
    const gapLen = 6;
    const total = length;
    const markMat = new THREE.MeshBasicMaterial({ color: '#a09030' });
    const edgeMat = new THREE.MeshBasicMaterial({ color: '#808070' });

    for (let d = -total / 2; d < total / 2; d += dashLen + gapLen) {
      const dashGeo = new THREE.PlaneGeometry(
        horizontal ? dashLen : 0.15,
        horizontal ? 0.15 : dashLen
      );
      const dash = new THREE.Mesh(dashGeo, markMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(
        horizontal ? d + dashLen / 2 : linePos,
        0.04,
        horizontal ? linePos : d + dashLen / 2
      );
      this.group.add(dash);
    }

    // Edge lines (solid white, faded)
    for (const side of [-1, 1]) {
      const edgeGeo = new THREE.PlaneGeometry(
        horizontal ? total : 0.1,
        horizontal ? 0.1 : total
      );
      const edge = new THREE.Mesh(edgeGeo, edgeMat);
      edge.rotation.x = -Math.PI / 2;
      const off = (ROAD_WIDTH / 2 - 0.5) * side;
      edge.position.set(
        horizontal ? 0 : linePos + off,
        0.04,
        horizontal ? linePos + off : 0
      );
      this.group.add(edge);
    }
  }

  _createBuildings() {
    const specialMap = {};
    for (const sb of SPECIAL_BUILDINGS) {
      specialMap[`${sb.gridX},${sb.gridZ}`] = sb;
    }

    for (let gx = 0; gx < GRID_SIZE; gx++) {
      for (let gz = 0; gz < GRID_SIZE; gz++) {
        const key = `${gx},${gz}`;
        const special = specialMap[key];
        const cx = -CITY_HALF + ROAD_WIDTH / 2 + SIDEWALK_WIDTH + gx * CELL_SIZE + BLOCK_SIZE / 2;
        const cz = -CITY_HALF + ROAD_WIDTH / 2 + SIDEWALK_WIDTH + gz * CELL_SIZE + BLOCK_SIZE / 2;

        if (special) {
          this._createSpecialBuilding(cx, cz, special);
        } else {
          this._createRandomBuilding(cx, cz);
        }
      }
    }
  }

  _createRandomBuilding(cx, cz) {
    const subdivisions = Math.random() < 0.3 ? 1 : Math.random() < 0.5 ? 2 : 4;

    if (subdivisions === 1) {
      const w = BLOCK_SIZE * (0.7 + Math.random() * 0.25);
      const d = BLOCK_SIZE * (0.7 + Math.random() * 0.25);
      const h = 8 + Math.random() * 45;
      this._addBuilding(cx, cz, w, d, h);
    } else if (subdivisions === 2) {
      const split = Math.random() < 0.5;
      const half = BLOCK_SIZE / 2 - 1;
      for (let i = 0; i < 2; i++) {
        const ox = split ? (i - 0.5) * (half + 1) : 0;
        const oz = split ? 0 : (i - 0.5) * (half + 1);
        const w = split ? half : BLOCK_SIZE * 0.85;
        const d = split ? BLOCK_SIZE * 0.85 : half;
        const h = 6 + Math.random() * 35;
        this._addBuilding(cx + ox, cz + oz, w, d, h);
      }
    } else {
      const quarter = BLOCK_SIZE / 2 - 1;
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
          const ox = (i - 0.5) * (quarter + 1);
          const oz = (j - 0.5) * (quarter + 1);
          const h = 5 + Math.random() * 25;
          this._addBuilding(cx + ox, cz + oz, quarter, quarter, h);
        }
      }
    }
  }

  _addBuilding(cx, cz, w, d, h, options = {}) {
    const geo = new THREE.BoxGeometry(w, h, d);

    // Real PBR materials with window overlays from assetLoader
    const materials = createBuildingMaterialSet(w, h, d, {
      shopColor: options.shopColor,
    });

    const mesh = new THREE.Mesh(geo, materials);
    mesh.position.set(cx, h / 2, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);

    // 3D architectural details
    this._addBuildingDetails(cx, cz, w, d, h);

    // Rooftop details on taller buildings
    if (h > 20 && Math.random() < 0.7) {
      this._addRooftopDetails(cx, cz, w, d, h);
    }

    // Awning on short commercial buildings
    if (h < 18 && Math.random() < 0.6) {
      this._addAwning(cx, cz, w, d);
    }

    const box = new THREE.Box3().setFromObject(mesh);
    this.colliders.push(box);
    return mesh;
  }

  _addBuildingDetails(cx, cz, w, d, h) {
    const detailMat = new THREE.MeshStandardMaterial({ color: '#6a5a48', roughness: 0.85 });
    const darkMat = new THREE.MeshStandardMaterial({ color: '#3a3028', roughness: 0.9 });

    // Foundation ledge at base
    const baseGeo = new THREE.BoxGeometry(w + 0.3, 0.8, d + 0.3);
    const base = new THREE.Mesh(baseGeo, detailMat);
    base.position.set(cx, 0.4, cz);
    base.castShadow = true;
    this.group.add(base);

    // Cornice at top (offset below roof to avoid z-fighting)
    if (h > 8) {
      const corniceGeo = new THREE.BoxGeometry(w + 0.4, 0.3, d + 0.4);
      const cornice = new THREE.Mesh(corniceGeo, detailMat);
      cornice.position.set(cx, h - 0.6, cz);
      cornice.castShadow = true;
      this.group.add(cornice);
    }

    // Floor separation ledges on taller buildings
    if (h > 15) {
      const numLedges = Math.min(Math.floor(h / 10), 4);
      for (let i = 1; i <= numLedges; i++) {
        const ly = (h / (numLedges + 1)) * i;
        const ledgeGeo = new THREE.BoxGeometry(w + 0.15, 0.12, d + 0.15);
        const ledge = new THREE.Mesh(ledgeGeo, detailMat);
        ledge.position.set(cx, ly, cz);
        this.group.add(ledge);
      }
    }

    // Fire escape on one side (tall buildings)
    if (h > 20 && Math.random() < 0.4) {
      const escapeMat = new THREE.MeshStandardMaterial({ color: '#3a3a38', roughness: 0.7, metalness: 0.5 });
      const escapeW = 2.5;
      const side = Math.random() < 0.5 ? 1 : -1;
      const floors = Math.floor(h / 4);

      for (let f = 1; f < floors; f++) {
        const fy = f * 4;
        // Platform
        const platGeo = new THREE.BoxGeometry(escapeW, 0.08, 1.2);
        const plat = new THREE.Mesh(platGeo, escapeMat);
        plat.position.set(cx + (w / 2 + 0.6) * side, fy, cz);
        plat.castShadow = true;
        this.group.add(plat);

        // Railing
        const railGeo = new THREE.BoxGeometry(escapeW, 0.8, 0.05);
        const rail = new THREE.Mesh(railGeo, escapeMat);
        rail.position.set(cx + (w / 2 + 1.15) * side, fy + 0.4, cz);
        this.group.add(rail);

        // Ladder between floors
        if (f < floors - 1) {
          const ladderGeo = new THREE.BoxGeometry(0.05, 3.5, 0.3);
          const ladder = new THREE.Mesh(ladderGeo, escapeMat);
          ladder.position.set(cx + (w / 2 + 0.3) * side, fy + 2, cz + 0.3);
          this.group.add(ladder);
        }
      }
    }
  }

  _addRooftopDetails(cx, cz, w, d, h) {
    const detailMat = new THREE.MeshStandardMaterial({ color: '#4a4038', roughness: 0.9 });

    // AC unit
    if (Math.random() < 0.7) {
      const acGeo = new THREE.BoxGeometry(2, 1.5, 2);
      const ac = new THREE.Mesh(acGeo, detailMat);
      ac.position.set(cx + (Math.random() - 0.5) * w * 0.5, h + 0.75, cz + (Math.random() - 0.5) * d * 0.5);
      ac.castShadow = true;
      this.group.add(ac);
    }

    // Water tank
    if (h > 30 && Math.random() < 0.5) {
      const tankMat = new THREE.MeshStandardMaterial({ color: '#6a5a4a', roughness: 0.8 });
      const tankGeo = new THREE.CylinderGeometry(1.5, 1.5, 3, 8);
      const tank = new THREE.Mesh(tankGeo, tankMat);
      tank.position.set(cx + (Math.random() - 0.5) * w * 0.3, h + 1.5, cz + (Math.random() - 0.5) * d * 0.3);
      tank.castShadow = true;
      this.group.add(tank);

      // Tank legs
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2;
        const legGeo = new THREE.CylinderGeometry(0.08, 0.08, 2, 4);
        const leg = new THREE.Mesh(legGeo, detailMat);
        leg.position.set(
          cx + (Math.random() - 0.5) * w * 0.3 + Math.cos(angle) * 1,
          h + 1,
          cz + (Math.random() - 0.5) * d * 0.3 + Math.sin(angle) * 1
        );
        this.group.add(leg);
      }
    }
  }

  _addAwning(cx, cz, w, d) {
    const colors = ['#8a2020', '#2a4a2a', '#c0a040', '#2a2a5a', '#806040'];
    const awningColor = colors[Math.floor(Math.random() * colors.length)];
    const awningGeo = new THREE.BoxGeometry(w * 0.7, 0.1, 2);
    const awningMat = new THREE.MeshStandardMaterial({ color: awningColor, roughness: 0.7 });
    const awning = new THREE.Mesh(awningGeo, awningMat);
    awning.position.set(cx, 3.5, cz - d / 2 - 1);
    awning.castShadow = true;
    this.group.add(awning);
  }

  _createSpecialBuilding(cx, cz, spec) {
    const heights = { bank: 30, liquor: 10, tower: 60, alley: 7, garage: 12 };
    const h = heights[spec.id] || 18;
    const w = spec.id === 'alley' ? BLOCK_SIZE * 0.5 : BLOCK_SIZE * 0.85;
    const d = BLOCK_SIZE * 0.85;

    this._addBuilding(cx, cz, w, d, h, {
      litChance: 0.3,
      hasShopFront: true,
      shopColor: spec.color,
      baseColor: spec.id === 'tower' ? '#606a70' : undefined,
    });

    // Sign on front
    const signTex = createSignTexture(spec.name, 512, 128, {
      textColor: spec.neonColor,
      borderColor: spec.neonColor,
      bgColor: 'rgba(30, 20, 10, 0.85)',
      fontSize: spec.name.length > 10 ? 42 : 52,
    });
    const signGeo = new THREE.PlaneGeometry(w * 0.75, w * 0.18);
    const signMat = new THREE.MeshBasicMaterial({ map: signTex, transparent: true });
    // Place signs facing outward on all 4 faces (default PlaneGeometry faces +Z)
    const signData = [
      { pos: [cx, h * 0.7, cz - d / 2 - 0.15], rot: Math.PI },    // front (-Z): flip to face outward
      { pos: [cx, h * 0.7, cz + d / 2 + 0.15], rot: 0 },          // back (+Z): default facing
      { pos: [cx - w / 2 - 0.15, h * 0.7, cz], rot: -Math.PI / 2 }, // left (-X): face outward
      { pos: [cx + w / 2 + 0.15, h * 0.7, cz], rot: Math.PI / 2 },  // right (+X): face outward
    ];
    for (let si = 0; si < signData.length; si++) {
      const sd = signData[si];
      const s = new THREE.Mesh(signGeo, signMat);
      s.position.set(...sd.pos);
      s.rotation.y = sd.rot;
      this.group.add(s);
    }

    // Single neon glow light per building (front face only)
    const neonLight = new THREE.PointLight(spec.neonColor, 2.5, 20);
    neonLight.position.set(cx, h * 0.5, cz - d / 2 - 2);
    this.group.add(neonLight);

    // Interaction zone — all around the building, generous size
    const zoneSize = 10;
    const zone = new THREE.Box3(
      new THREE.Vector3(cx - w / 2 - zoneSize, 0, cz - d / 2 - zoneSize),
      new THREE.Vector3(cx + w / 2 + zoneSize, 5, cz + d / 2 + zoneSize)
    );

    this.interactionZones.push({
      id: spec.id,
      name: spec.name,
      panel: spec.panel,
      zone,
      position: new THREE.Vector3(cx, 0, cz),
      color: spec.neonColor,
    });
  }

  _createStreetLights() {
    const lampColor = '#e8a050';
    const poleMat = new THREE.MeshStandardMaterial({ color: '#4a4a48', roughness: 0.6, metalness: 0.4 });

    for (let i = 0; i <= GRID_SIZE; i++) {
      const linePos = -CITY_HALF + i * CELL_SIZE;
      for (let j = 0; j < GRID_SIZE; j++) {
        const blockCenter = -CITY_HALF + ROAD_WIDTH / 2 + SIDEWALK_WIDTH + j * CELL_SIZE + BLOCK_SIZE / 2;
        this._addStreetLight(blockCenter, linePos - ROAD_WIDTH / 2 - 1.5, lampColor, poleMat);
        this._addStreetLight(linePos - ROAD_WIDTH / 2 - 1.5, blockCenter, lampColor, poleMat);
      }
    }
  }

  _addStreetLight(x, z, color, poleMat) {
    const h = 7;

    // Pole
    const poleGeo = new THREE.CylinderGeometry(0.06, 0.1, h, 6);
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(x, h / 2, z);
    this.group.add(pole);

    // Curved arm
    const armGeo = new THREE.BoxGeometry(2.5, 0.06, 0.06);
    const arm = new THREE.Mesh(armGeo, poleMat);
    arm.position.set(x + 1.25, h, z);
    this.group.add(arm);

    // Fixture
    const fixGeo = new THREE.BoxGeometry(0.8, 0.15, 0.4);
    const fixMat = new THREE.MeshStandardMaterial({ color: '#d0c0a0', roughness: 0.5, emissive: color, emissiveIntensity: 0.3 });
    const fix = new THREE.Mesh(fixGeo, fixMat);
    fix.position.set(x + 2.5, h - 0.15, z);
    this.group.add(fix);

    // Light
    const light = new THREE.PointLight(color, 2, 18);
    light.position.set(x + 2.5, h - 0.4, z);
    this.group.add(light);
  }

  _createTrafficLights() {
    const tlMat = new THREE.MeshStandardMaterial({ color: '#3a3a38', roughness: 0.7, metalness: 0.3 });

    // Place at intersections
    for (let i = 0; i <= GRID_SIZE; i++) {
      for (let j = 0; j <= GRID_SIZE; j++) {
        if (Math.random() < 0.4) continue; // Skip some for variety
        const ix = -CITY_HALF + i * CELL_SIZE;
        const iz = -CITY_HALF + j * CELL_SIZE;

        // One traffic light per corner
        const corner = Math.floor(Math.random() * 4);
        const offsets = [
          [ROAD_WIDTH / 2 + 1, ROAD_WIDTH / 2 + 1],
          [-ROAD_WIDTH / 2 - 1, ROAD_WIDTH / 2 + 1],
          [ROAD_WIDTH / 2 + 1, -ROAD_WIDTH / 2 - 1],
          [-ROAD_WIDTH / 2 - 1, -ROAD_WIDTH / 2 - 1],
        ];
        const [ox, oz] = offsets[corner];

        // Pole
        const poleGeo = new THREE.CylinderGeometry(0.06, 0.08, 4, 6);
        const pole = new THREE.Mesh(poleGeo, tlMat);
        pole.position.set(ix + ox, 2, iz + oz);
        this.group.add(pole);

        // Light housing
        const housingGeo = new THREE.BoxGeometry(0.4, 1.2, 0.4);
        const housing = new THREE.Mesh(housingGeo, tlMat);
        housing.position.set(ix + ox, 4.6, iz + oz);
        this.group.add(housing);

        // Colored lights (red/yellow/green)
        const lightColors = ['#cc2020', '#ccaa20', '#20aa20'];
        const lightPositions = [5.0, 4.6, 4.2];
        const activeLight = Math.floor(Math.random() * 3);
        for (let k = 0; k < 3; k++) {
          const lGeo = new THREE.SphereGeometry(0.08, 8, 8);
          const lMat = new THREE.MeshBasicMaterial({
            color: k === activeLight ? lightColors[k] : '#1a1a1a',
          });
          const l = new THREE.Mesh(lGeo, lMat);
          l.position.set(ix + ox, lightPositions[k], iz + oz - 0.21);
          this.group.add(l);
        }
      }
    }
  }

  _createVehicles() {
    // Park cars along roads
    const bodyMat = new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.6 });
    const tireMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.9 });
    const windshieldMat = new THREE.MeshStandardMaterial({
      color: '#4a6a8a',
      roughness: 0.1,
      metalness: 0.8,
      transparent: true,
      opacity: 0.6,
    });

    for (let i = 0; i <= GRID_SIZE; i++) {
      const linePos = -CITY_HALF + i * CELL_SIZE;

      for (let j = 0; j < GRID_SIZE; j++) {
        const blockStart = -CITY_HALF + ROAD_WIDTH / 2 + SIDEWALK_WIDTH + j * CELL_SIZE;

        // Park 0-2 cars along each road segment
        const numCars = Math.floor(Math.random() * 3);
        for (let c = 0; c < numCars; c++) {
          const along = blockStart + 5 + Math.random() * (BLOCK_SIZE - 10);
          const carColor = CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
          const horizontal = Math.random() < 0.5;

          if (horizontal) {
            this._addCar(along, linePos + ROAD_WIDTH / 2 - 2.5, 0, carColor, bodyMat, tireMat, windshieldMat);
          } else {
            this._addCar(linePos + ROAD_WIDTH / 2 - 2.5, along, Math.PI / 2, carColor, bodyMat, tireMat, windshieldMat);
          }
        }
      }
    }
  }

  _addCar(x, z, rotation, color, bodyMat, tireMat, windshieldMat) {
    const carGroup = new THREE.Group();
    const isPickup = Math.random() < 0.25;
    const bMat = bodyMat.clone();
    bMat.color = new THREE.Color(color);

    const chromeMat = new THREE.MeshStandardMaterial({ color: '#c0c0c0', roughness: 0.1, metalness: 0.9 });
    const trimMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.6 });

    if (isPickup) {
      // === PICKUP TRUCK ===
      // Hood/engine
      const hoodGeo = new THREE.BoxGeometry(1.8, 0.9, 1.9);
      const hood = new THREE.Mesh(hoodGeo, bMat);
      hood.position.set(1.3, 0.75, 0);
      hood.castShadow = true;
      carGroup.add(hood);

      // Cabin
      const cabGeo = new THREE.BoxGeometry(1.6, 1.1, 1.9);
      const cab = new THREE.Mesh(cabGeo, bMat);
      cab.position.set(-0.1, 1.0, 0);
      cab.castShadow = true;
      carGroup.add(cab);

      // Cabin roof
      const roofGeo = new THREE.BoxGeometry(1.4, 0.12, 1.85);
      const roof = new THREE.Mesh(roofGeo, bMat);
      roof.position.set(-0.1, 1.6, 0);
      carGroup.add(roof);

      // Bed
      const bedFloorGeo = new THREE.BoxGeometry(2.2, 0.15, 1.8);
      const bedFloor = new THREE.Mesh(bedFloorGeo, trimMat);
      bedFloor.position.set(-1.8, 0.55, 0);
      carGroup.add(bedFloor);

      // Bed walls
      for (const s of [-1, 1]) {
        const wallGeo = new THREE.BoxGeometry(2.2, 0.5, 0.08);
        const wall = new THREE.Mesh(wallGeo, bMat);
        wall.position.set(-1.8, 0.85, 0.9 * s);
        wall.castShadow = true;
        carGroup.add(wall);
      }
      // Tailgate
      const tgGeo = new THREE.BoxGeometry(0.08, 0.5, 1.8);
      const tg = new THREE.Mesh(tgGeo, bMat);
      tg.position.set(-2.9, 0.85, 0);
      carGroup.add(tg);

      // Windshield
      const wsGeo = new THREE.PlaneGeometry(1.7, 0.9);
      const ws = new THREE.Mesh(wsGeo, windshieldMat);
      ws.position.set(0.65, 1.25, 0);
      ws.rotation.y = -Math.PI / 2;
      ws.rotation.z = -0.15;
      carGroup.add(ws);

      // Bumpers
      const fbGeo = new THREE.BoxGeometry(0.15, 0.25, 2.0);
      const fb = new THREE.Mesh(fbGeo, chromeMat);
      fb.position.set(2.25, 0.4, 0);
      carGroup.add(fb);
      const rb = fb.clone();
      rb.position.set(-3.0, 0.4, 0);
      carGroup.add(rb);

    } else {
      // === SEDAN ===
      // Lower body (chassis + fenders)
      const chassisGeo = new THREE.BoxGeometry(4.4, 0.5, 1.85);
      const chassis = new THREE.Mesh(chassisGeo, bMat);
      chassis.position.set(0, 0.45, 0);
      chassis.castShadow = true;
      carGroup.add(chassis);

      // Upper body (hood, trunk)
      const upperGeo = new THREE.BoxGeometry(4.0, 0.45, 1.8);
      const upper = new THREE.Mesh(upperGeo, bMat);
      upper.position.set(0, 0.9, 0);
      upper.castShadow = true;
      carGroup.add(upper);

      // Hood slope
      const hoodGeo = new THREE.BoxGeometry(1.0, 0.15, 1.75);
      const hoodMesh = new THREE.Mesh(hoodGeo, bMat);
      hoodMesh.position.set(1.7, 1.0, 0);
      hoodMesh.rotation.z = 0.1;
      carGroup.add(hoodMesh);

      // Cabin
      const cabinGeo = new THREE.BoxGeometry(2.0, 0.85, 1.7);
      const cabin = new THREE.Mesh(cabinGeo, bMat);
      cabin.position.set(-0.1, 1.55, 0);
      cabin.castShadow = true;
      carGroup.add(cabin);

      // Roof
      const roofGeo = new THREE.BoxGeometry(1.8, 0.08, 1.72);
      const roof = new THREE.Mesh(roofGeo, bMat);
      roof.position.set(-0.1, 2.0, 0);
      carGroup.add(roof);

      // Trunk slope
      const trunkGeo = new THREE.BoxGeometry(0.8, 0.15, 1.75);
      const trunkMesh = new THREE.Mesh(trunkGeo, bMat);
      trunkMesh.position.set(-1.5, 1.05, 0);
      trunkMesh.rotation.z = -0.08;
      carGroup.add(trunkMesh);

      // Windshield (angled)
      const wsGeo = new THREE.PlaneGeometry(1.6, 0.8);
      const ws = new THREE.Mesh(wsGeo, windshieldMat);
      ws.position.set(0.85, 1.55, 0);
      ws.rotation.y = -Math.PI / 2;
      ws.rotation.z = -0.25;
      carGroup.add(ws);

      // Rear window
      const rwGeo = new THREE.PlaneGeometry(1.5, 0.65);
      const rw = new THREE.Mesh(rwGeo, windshieldMat);
      rw.position.set(-1.1, 1.5, 0);
      rw.rotation.y = Math.PI / 2;
      rw.rotation.z = 0.2;
      carGroup.add(rw);

      // Side windows
      for (const s of [-1, 1]) {
        const swGeo = new THREE.PlaneGeometry(1.6, 0.5);
        const sw = new THREE.Mesh(swGeo, windshieldMat);
        sw.position.set(-0.1, 1.55, 0.86 * s);
        sw.rotation.y = Math.PI / 2 * s;
        carGroup.add(sw);
      }

      // Front bumper with chrome
      const fbGeo = new THREE.BoxGeometry(0.12, 0.2, 1.9);
      const fb = new THREE.Mesh(fbGeo, chromeMat);
      fb.position.set(2.25, 0.35, 0);
      carGroup.add(fb);

      // Rear bumper
      const rbGeo = new THREE.BoxGeometry(0.12, 0.2, 1.9);
      const rb = new THREE.Mesh(rbGeo, chromeMat);
      rb.position.set(-2.25, 0.35, 0);
      carGroup.add(rb);

      // Door line trim
      const doorGeo = new THREE.BoxGeometry(3.8, 0.04, 0.02);
      for (const s of [-1, 1]) {
        const door = new THREE.Mesh(doorGeo, trimMat);
        door.position.set(0, 0.85, 0.92 * s);
        carGroup.add(door);
      }
    }

    // === WHEELS (shared) ===
    const wheelR = isPickup ? 0.4 : 0.35;
    const wheelW = 0.22;
    const wheelGeo = new THREE.CylinderGeometry(wheelR, wheelR, wheelW, 12);
    const hubGeo = new THREE.CylinderGeometry(wheelR * 0.5, wheelR * 0.5, wheelW + 0.02, 8);
    const hubMat = new THREE.MeshStandardMaterial({ color: '#808080', roughness: 0.3, metalness: 0.7 });

    const fwb = isPickup ? 1.3 : 1.3;
    const rwb = isPickup ? -2.0 : -1.3;
    const wz = isPickup ? 0.95 : 0.93;
    const wy = wheelR;

    const wheelPositions = [[fwb, wy, wz], [fwb, wy, -wz], [rwb, wy, wz], [rwb, wy, -wz]];
    for (const [wx, wyy, wzz] of wheelPositions) {
      const wheel = new THREE.Mesh(wheelGeo, tireMat);
      wheel.position.set(wx, wyy, wzz);
      wheel.rotation.x = Math.PI / 2;
      wheel.castShadow = true;
      carGroup.add(wheel);

      // Hub cap
      const hub = new THREE.Mesh(hubGeo, hubMat);
      hub.position.set(wx, wyy, wzz);
      hub.rotation.x = Math.PI / 2;
      carGroup.add(hub);
    }

    // Wheel arches (dark cutouts)
    const archMat = new THREE.MeshStandardMaterial({ color: '#0a0a0a', roughness: 0.95 });
    for (const [wx, wyy, wzz] of wheelPositions) {
      const archGeo = new THREE.BoxGeometry(wheelR * 2.2, wheelR * 1.2, 0.08);
      const arch = new THREE.Mesh(archGeo, archMat);
      arch.position.set(wx, wyy + wheelR * 0.2, wzz > 0 ? wzz - 0.05 : wzz + 0.05);
      carGroup.add(arch);
    }

    // Headlights
    const hlMat = new THREE.MeshBasicMaterial({ color: '#ffe8b0' });
    const hlGeo = new THREE.BoxGeometry(0.06, 0.12, 0.25);
    const hlX = isPickup ? 2.2 : 2.2;
    for (const side of [-0.65, 0.65]) {
      const hl = new THREE.Mesh(hlGeo, hlMat);
      hl.position.set(hlX, 0.65, side);
      carGroup.add(hl);
    }

    // Taillights
    const tlMat2 = new THREE.MeshBasicMaterial({ color: '#cc2020' });
    const tlX = isPickup ? -2.95 : -2.2;
    for (const side of [-0.65, 0.65]) {
      const tl = new THREE.Mesh(hlGeo, tlMat2);
      tl.position.set(tlX, 0.65, side);
      carGroup.add(tl);
    }

    // License plate (rear)
    const plateMat = new THREE.MeshStandardMaterial({ color: '#e0d8c0', roughness: 0.5 });
    const plateGeo = new THREE.BoxGeometry(0.04, 0.15, 0.5);
    const plate = new THREE.Mesh(plateGeo, plateMat);
    plate.position.set(isPickup ? -3.0 : -2.22, 0.45, 0);
    carGroup.add(plate);

    // Side mirrors
    const mirrorGeo = new THREE.BoxGeometry(0.15, 0.1, 0.08);
    for (const s of [-1, 1]) {
      const mirror = new THREE.Mesh(mirrorGeo, trimMat);
      mirror.position.set(0.7, 1.3, (isPickup ? 1.0 : 0.95) * s);
      carGroup.add(mirror);
    }

    carGroup.position.set(x, 0, z);
    carGroup.rotation.y = rotation;
    this.group.add(carGroup);

    const carBox = new THREE.Box3().setFromObject(carGroup);
    this.colliders.push(carBox);
  }

  _createPalmTrees() {
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#5a4a30', roughness: 0.9 });
    const leafMat = new THREE.MeshStandardMaterial({ color: '#3a6a2a', roughness: 0.7, side: THREE.DoubleSide });

    // Place along sidewalks
    for (let i = 0; i <= GRID_SIZE; i++) {
      const linePos = -CITY_HALF + i * CELL_SIZE;
      for (let j = 0; j < GRID_SIZE; j++) {
        if (Math.random() < 0.4) continue;
        const blockStart = -CITY_HALF + ROAD_WIDTH / 2 + SIDEWALK_WIDTH + j * CELL_SIZE;
        const along = blockStart + 3 + Math.random() * (BLOCK_SIZE - 6);
        const side = Math.random() < 0.5 ? 1 : -1;
        const treeX = linePos + (ROAD_WIDTH / 2 + 1.5) * side;

        if (Math.random() < 0.5) {
          this._addPalmTree(along, treeX, trunkMat, leafMat);
        } else {
          this._addPalmTree(treeX, along, trunkMat, leafMat);
        }
      }
    }
  }

  _addPalmTree(x, z, trunkMat, leafMat) {
    const treeGroup = new THREE.Group();
    const height = 8 + Math.random() * 5;
    const lean = (Math.random() - 0.5) * 0.15;

    // Trunk — slightly curved (segments)
    const segments = 5;
    for (let i = 0; i < segments; i++) {
      const t = i / segments;
      const segH = height / segments;
      const radius = 0.2 - t * 0.1;
      const geo = new THREE.CylinderGeometry(radius * 0.8, radius, segH, 6);
      const seg = new THREE.Mesh(geo, trunkMat);
      seg.position.set(lean * t * height, t * height + segH / 2, 0);
      seg.rotation.z = lean * t;
      seg.castShadow = true;
      treeGroup.add(seg);
    }

    // Palm fronds (leaf fans)
    const topX = lean * height;
    const numFronds = 6 + Math.floor(Math.random() * 3);
    for (let i = 0; i < numFronds; i++) {
      const angle = (i / numFronds) * Math.PI * 2 + Math.random() * 0.3;
      const frondLen = 3 + Math.random() * 2;
      const droop = 0.3 + Math.random() * 0.4;

      const frondGeo = new THREE.PlaneGeometry(frondLen, 0.8);
      const frond = new THREE.Mesh(frondGeo, leafMat);
      frond.position.set(
        topX + Math.cos(angle) * frondLen * 0.4,
        height - droop * frondLen * 0.3,
        Math.sin(angle) * frondLen * 0.4
      );
      frond.rotation.set(-droop, angle, 0);
      frond.castShadow = true;
      treeGroup.add(frond);
    }

    treeGroup.position.set(x, 0, z);
    this.group.add(treeGroup);
  }

  _createProps() {
    const propMat = new THREE.MeshStandardMaterial({ color: '#3a3830', roughness: 0.85, metalness: 0.2 });

    // Dumpsters (green, SA-style)
    const dumpsterMat = new THREE.MeshStandardMaterial({ color: '#2a4a2a', roughness: 0.8 });
    for (let i = 0; i < 15; i++) {
      const gx = Math.floor(Math.random() * GRID_SIZE);
      const gz = Math.floor(Math.random() * GRID_SIZE);
      const cx = -CITY_HALF + ROAD_WIDTH / 2 + SIDEWALK_WIDTH + gx * CELL_SIZE + BLOCK_SIZE / 2;
      const cz = -CITY_HALF + ROAD_WIDTH / 2 + SIDEWALK_WIDTH + gz * CELL_SIZE;

      const dGeo = new THREE.BoxGeometry(2, 1.2, 1.2);
      const dumpster = new THREE.Mesh(dGeo, dumpsterMat);
      dumpster.position.set(cx + (Math.random() - 0.5) * BLOCK_SIZE * 0.3, 0.6, cz - 1);
      dumpster.castShadow = true;
      this.group.add(dumpster);

      const dBox = new THREE.Box3().setFromObject(dumpster);
      this.colliders.push(dBox);
    }

    // Fire hydrants
    const hydrantMat = new THREE.MeshStandardMaterial({ color: '#c04020', roughness: 0.6 });
    for (let i = 0; i < 15; i++) {
      const gx = Math.floor(Math.random() * GRID_SIZE);
      const gz = Math.floor(Math.random() * GRID_SIZE);
      const lineX = -CITY_HALF + gx * CELL_SIZE;
      const lineZ = -CITY_HALF + gz * CELL_SIZE;

      const hGeo = new THREE.CylinderGeometry(0.12, 0.18, 0.6, 6);
      const hydrant = new THREE.Mesh(hGeo, hydrantMat);
      hydrant.position.set(lineX + ROAD_WIDTH / 2 + 1.5, 0.3, lineZ + ROAD_WIDTH / 2 + 1.5);
      hydrant.castShadow = true;
      this.group.add(hydrant);
    }

    // Trash cans
    for (let i = 0; i < 25; i++) {
      const gx = Math.floor(Math.random() * GRID_SIZE);
      const gz = Math.floor(Math.random() * GRID_SIZE);
      const cx = -CITY_HALF + ROAD_WIDTH / 2 + SIDEWALK_WIDTH + gx * CELL_SIZE;
      const cz = -CITY_HALF + ROAD_WIDTH / 2 + SIDEWALK_WIDTH + gz * CELL_SIZE;

      const tGeo = new THREE.CylinderGeometry(0.25, 0.3, 0.7, 8);
      const trash = new THREE.Mesh(tGeo, propMat);
      trash.position.set(cx + Math.random() * 3, 0.35, cz + Math.random() * 3);
      trash.castShadow = true;
      this.group.add(trash);
    }

    // Phone booths (a couple)
    const boothMat = new THREE.MeshStandardMaterial({ color: '#6a6a6a', roughness: 0.7 });
    for (let i = 0; i < 4; i++) {
      const gx = Math.floor(Math.random() * GRID_SIZE);
      const gz = Math.floor(Math.random() * GRID_SIZE);
      const lineX = -CITY_HALF + gx * CELL_SIZE + ROAD_WIDTH / 2 + 2;
      const lineZ = -CITY_HALF + gz * CELL_SIZE + ROAD_WIDTH / 2 + 2;

      const bGeo = new THREE.BoxGeometry(0.8, 2.2, 0.8);
      const booth = new THREE.Mesh(bGeo, boothMat);
      booth.position.set(lineX, 1.1, lineZ);
      booth.castShadow = true;
      this.group.add(booth);
    }
  }

  _createBranding() {
    const graffitiTexts = ['$GANG', 'GRIND', 'NEVER GIVE UP', 'GANG SHIT', 'WE UP', 'GROVE ST'];

    for (let i = 0; i < 10; i++) {
      const gx = Math.floor(Math.random() * GRID_SIZE);
      const gz = Math.floor(Math.random() * GRID_SIZE);
      const cx = -CITY_HALF + ROAD_WIDTH / 2 + SIDEWALK_WIDTH + gx * CELL_SIZE + BLOCK_SIZE / 2;
      const cz = -CITY_HALF + ROAD_WIDTH / 2 + SIDEWALK_WIDTH + gz * CELL_SIZE + BLOCK_SIZE / 2;
      const text = graffitiTexts[i % graffitiTexts.length];

      const tex = createGraffitiTexture(text);
      const geo = new THREE.PlaneGeometry(7, 3.5);
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const graffiti = new THREE.Mesh(geo, mat);
      const wallSide = Math.floor(Math.random() * 4);
      const offset = BLOCK_SIZE / 2 * 0.42 + 0.15;
      const height = 2 + Math.random() * 4;

      if (wallSide === 0) graffiti.position.set(cx, height, cz - offset);
      else if (wallSide === 1) { graffiti.position.set(cx + offset, height, cz); graffiti.rotation.y = -Math.PI / 2; }
      else if (wallSide === 2) { graffiti.position.set(cx, height, cz + offset); graffiti.rotation.y = Math.PI; }
      else { graffiti.position.set(cx - offset, height, cz); graffiti.rotation.y = Math.PI / 2; }

      this.group.add(graffiti);
    }

    // Billboard
    const bbTex = createSignTexture('$GANG — GRIND AND NEVER GIVE-UP', 1024, 256, {
      bgColor: 'rgba(30, 20, 10, 0.9)',
      textColor: '#e8a000',
      fontSize: 56,
      borderColor: '#e8a000',
    });
    const bbGeo = new THREE.PlaneGeometry(14, 3.5);
    const bbMat = new THREE.MeshBasicMaterial({ map: bbTex, transparent: true, side: THREE.DoubleSide });
    const billboard = new THREE.Mesh(bbGeo, bbMat);
    const towerSpec = SPECIAL_BUILDINGS.find(b => b.id === 'tower');
    const tcx = -CITY_HALF + ROAD_WIDTH / 2 + SIDEWALK_WIDTH + towerSpec.gridX * CELL_SIZE + BLOCK_SIZE / 2;
    const tcz = -CITY_HALF + ROAD_WIDTH / 2 + SIDEWALK_WIDTH + towerSpec.gridZ * CELL_SIZE + BLOCK_SIZE / 2;
    billboard.position.set(tcx, 65, tcz - BLOCK_SIZE / 2 * 0.43);
    this.group.add(billboard);
  }

  getSpawnPosition() {
    return new THREE.Vector3(0, 1, 0);
  }

  getMinimapData() {
    return {
      gridSize: GRID_SIZE,
      cellSize: CELL_SIZE,
      blockSize: BLOCK_SIZE,
      roadWidth: ROAD_WIDTH,
      cityHalf: CITY_HALF,
      specialBuildings: SPECIAL_BUILDINGS,
    };
  }
}
