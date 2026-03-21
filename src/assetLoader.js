import * as THREE from 'three';

// Centralized asset loader — loads real PBR textures from /assets/textures/
// All textures are CC0 from Poly Haven

const loader = new THREE.TextureLoader();
const cache = {};

function loadTex(path, repeatX = 1, repeatY = 1) {
  const key = `${path}_${repeatX}_${repeatY}`;
  if (cache[key]) return cache[key].clone();

  const tex = loader.load(`/assets/textures/${path}`);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = path.includes('norm') ? THREE.LinearSRGBColorSpace : THREE.SRGBColorSpace;
  cache[path] = tex;

  const clone = tex.clone();
  clone.repeat.set(repeatX, repeatY);
  return clone;
}

// ========== BUILDING MATERIALS ==========

// Brick wall — for older/shorter buildings
export function createBrickMaterial(tintColor = '#b09080', repeatX = 3, repeatY = 3) {
  return new THREE.MeshStandardMaterial({
    map: loadTex('brick_diff.jpg', repeatX, repeatY),
    normalMap: loadTex('brick_norm.jpg', repeatX, repeatY),
    normalScale: new THREE.Vector2(0.5, 0.5),
    color: new THREE.Color(tintColor),
    roughness: 0.82,
  });
}

// Stucco/plaster — for SA-style residential buildings
export function createStuccoMaterial(tintColor = '#c0a880', repeatX = 2, repeatY = 3) {
  return new THREE.MeshStandardMaterial({
    map: loadTex('stucco_diff.jpg', repeatX, repeatY),
    normalMap: loadTex('stucco_norm.jpg', repeatX, repeatY),
    normalScale: new THREE.Vector2(0.4, 0.4),
    color: new THREE.Color(tintColor),
    roughness: 0.78,
  });
}

// Concrete — for modern/tall buildings
export function createConcreteMaterial(tintColor = '#908878', repeatX = 2, repeatY = 4) {
  return new THREE.MeshStandardMaterial({
    map: loadTex('concrete_diff.jpg', repeatX, repeatY),
    normalMap: loadTex('concrete_norm.jpg', repeatX, repeatY),
    normalScale: new THREE.Vector2(0.3, 0.3),
    color: new THREE.Color(tintColor),
    roughness: 0.75,
  });
}

// ========== ROAD / SIDEWALK MATERIALS ==========

export function createAsphaltMaterial(repeatX = 4, repeatY = 20) {
  return new THREE.MeshStandardMaterial({
    map: loadTex('asphalt_diff.jpg', repeatX, repeatY),
    normalMap: loadTex('asphalt_norm.jpg', repeatX, repeatY),
    normalScale: new THREE.Vector2(0.4, 0.4),
    color: new THREE.Color('#a09890'),
    roughness: 0.92,
  });
}

export function createSidewalkMaterial(repeatX = 4, repeatY = 20) {
  return new THREE.MeshStandardMaterial({
    map: loadTex('concrete_diff.jpg', repeatX, repeatY),
    normalMap: loadTex('concrete_norm.jpg', repeatX, repeatY),
    normalScale: new THREE.Vector2(0.3, 0.3),
    color: new THREE.Color('#b0a898'),
    roughness: 0.88,
  });
}

// ========== ROOF MATERIAL ==========

export function createRoofMaterial() {
  return new THREE.MeshStandardMaterial({
    map: loadTex('concrete_diff.jpg', 2, 2),
    normalMap: loadTex('concrete_norm.jpg', 2, 2),
    normalScale: new THREE.Vector2(0.3, 0.3),
    color: new THREE.Color('#9a9080'),
    roughness: 0.85,
    metalness: 0.0,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
}

// ========== WINDOW OVERLAY TEXTURE ==========
// Creates a procedural window grid texture to layer on top of real wall textures
export function createWindowOverlay(width = 512, height = 512, options = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const {
    windowRows = 8,
    windowCols = 6,
    litChance = 0.2,
    hasShopFront = false,
    shopColor = '#e8a000',
  } = options;

  // Fully transparent base (will blend with PBR material)
  ctx.clearRect(0, 0, width, height);

  // Window grid — sharp rectangles, GTA SA style
  const marginX = width * 0.07;
  const marginY = height * 0.05;
  const gapX = (width - marginX * 2) / windowCols;
  const gapY = (height - marginY * 2) / windowRows;
  const winW = gapX * 0.38;
  const winH = gapY * 0.5;

  const startRow = hasShopFront ? 1 : 0;

  for (let row = startRow; row < windowRows; row++) {
    for (let col = 0; col < windowCols; col++) {
      const x = marginX + col * gapX + (gapX - winW) / 2;
      const y = marginY + row * gapY + (gapY - winH) / 2;

      // Window recess (sharp dark rectangle)
      ctx.fillStyle = 'rgba(8, 6, 4, 0.9)';
      ctx.fillRect(x, y, winW, winH);

      // Lit windows — subtle warm glow
      const isLit = Math.random() < litChance;
      if (isLit) {
        const r = Math.random();
        let color;
        if (r < 0.5) color = 'rgba(200, 160, 60, 0.55)';       // warm yellow
        else if (r < 0.7) color = 'rgba(100, 150, 180, 0.4)';   // TV blue
        else if (r < 0.85) color = 'rgba(180, 110, 60, 0.45)';  // reddish
        else color = 'rgba(220, 220, 180, 0.5)';                 // bright

        ctx.fillStyle = color;
        ctx.fillRect(x + 1, y + 1, winW - 2, winH - 2);
      } else {
        // Faint sky reflection on glass
        ctx.fillStyle = 'rgba(60, 70, 80, 0.08)';
        ctx.fillRect(x + 1, y + 1, winW - 2, winH * 0.3);
      }

      // Thin window frame
      ctx.strokeStyle = 'rgba(40, 35, 28, 0.5)';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(x, y, winW, winH);

      // Thin sill
      ctx.fillStyle = 'rgba(70, 60, 50, 0.3)';
      ctx.fillRect(x - 0.5, y + winH, winW + 1, 1.5);
    }
  }

  // Shop front on ground floor
  if (hasShopFront) {
    const shopY = height - gapY - marginY * 0.3;
    const shopH = gapY;

    // Shop window
    ctx.fillStyle = 'rgba(160, 140, 80, 0.2)';
    ctx.fillRect(marginX, shopY + 6, width - marginX * 2, shopH - 12);

    // Awning stripe
    ctx.fillStyle = shopColor || '#c0a060';
    ctx.globalAlpha = 0.4;
    ctx.fillRect(marginX * 0.5, shopY - 2, width - marginX, 8);
    ctx.globalAlpha = 1;
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// ========== BUILDING MATERIAL SETS ==========
// Returns array of 6 materials for a BoxGeometry (right, left, top, bottom, front, back)

const SA_TINTS = [
  '#e0d0b0', '#d8c8a8', '#e8d8c0', '#d0c0a0', '#e4d0a8',
  '#d8c8b0', '#ccc0a8', '#e8e0d0', '#e0d0a8', '#d8c8a0',
  '#f0e0c8', '#d0c0a0', '#e0d0b8', '#c8c0a0', '#f0e0d0',
];

export function createBuildingMaterialSet(w, h, d, options = {}) {
  const stories = Math.floor(h / 3.5);
  const tint = SA_TINTS[Math.floor(Math.random() * SA_TINTS.length)];

  // Choose wall type based on building height
  let wallMat;
  const r = Math.random();
  if (h < 15) {
    // Short buildings: stucco or brick
    wallMat = r < 0.5
      ? createStuccoMaterial(tint, Math.max(1, Math.round(w / 12)), Math.max(1, Math.round(h / 8)))
      : createBrickMaterial(tint, Math.max(1, Math.round(w / 8)), Math.max(1, Math.round(h / 6)));
  } else if (h < 35) {
    // Medium: brick or concrete
    wallMat = r < 0.6
      ? createBrickMaterial(tint, Math.max(1, Math.round(w / 8)), Math.max(1, Math.round(h / 6)))
      : createConcreteMaterial(tint, Math.max(1, Math.round(w / 10)), Math.max(1, Math.round(h / 8)));
  } else {
    // Tall: concrete
    wallMat = createConcreteMaterial(tint, Math.max(1, Math.round(w / 10)), Math.max(1, Math.round(h / 8)));
  }

  // Window overlay
  const windowTex = createWindowOverlay(512, 512, {
    windowRows: Math.min(stories, 14),
    windowCols: Math.max(3, Math.floor(w / 4)),
    litChance: 0.15 + Math.random() * 0.15,
    hasShopFront: h < 20 && Math.random() < 0.6,
    shopColor: options.shopColor,
  });

  // Create wall materials with window overlay blended
  const wallWithWindows = wallMat.clone();
  // We'll use emissiveMap for window glow
  wallWithWindows.emissiveMap = windowTex;
  wallWithWindows.emissive = new THREE.Color('#ffe0a0');
  wallWithWindows.emissiveIntensity = 0.4;

  const roofMat = createRoofMaterial();
  const bottomMat = new THREE.MeshStandardMaterial({ color: '#3a3028', roughness: 0.95 });

  // 6 faces: +x, -x, +y (top), -y (bottom), +z, -z
  return [
    wallWithWindows,          // right
    wallWithWindows.clone(),  // left
    roofMat,                  // top
    bottomMat,                // bottom
    wallWithWindows.clone(),  // front
    wallWithWindows.clone(),  // back
  ];
}
