import * as THREE from 'three';

// Procedural texture generation using Canvas API
// No external assets needed — everything is generated at runtime

export function createBuildingTexture(width = 512, height = 512, options = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const {
    baseColor = '#8a7a60',
    windowColor = '#2a2018',
    litColor = '#e8b040',
    litChance = 0.3,
    windowRows = 8,
    windowCols = 6,
    hasShopFront = false,
    shopColor = '#ffd700',
  } = options;

  // Base wall
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, width, height);

  // Wall grain + dirt stains (SA grungy look)
  for (let i = 0; i < 3000; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const brightness = Math.random() * 30 - 15;
    ctx.fillStyle = `rgba(${brightness > 0 ? 200 : 0}, ${brightness > 0 ? 180 : 0}, ${brightness > 0 ? 140 : 0}, ${Math.abs(brightness) / 200})`;
    ctx.fillRect(x, y, 1 + Math.random(), 1 + Math.random());
  }

  // Vertical dirt/water stains
  for (let i = 0; i < 4; i++) {
    const sx = Math.random() * width;
    const sw = 3 + Math.random() * 8;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.04)';
    ctx.fillRect(sx, 0, sw, height);
  }

  // Window grid
  const marginX = width * 0.08;
  const marginY = height * 0.04;
  const gapX = (width - marginX * 2) / windowCols;
  const gapY = (height - marginY * 2) / windowRows;
  const winW = gapX * 0.55;
  const winH = gapY * 0.6;

  const startRow = hasShopFront ? 1 : 0;

  for (let row = startRow; row < windowRows; row++) {
    for (let col = 0; col < windowCols; col++) {
      const x = marginX + col * gapX + (gapX - winW) / 2;
      const y = marginY + row * gapY + (gapY - winH) / 2;

      const isLit = Math.random() < litChance;

      if (isLit) {
        // Lit window with warm glow
        const hueShift = Math.random();
        let color;
        if (hueShift < 0.6) color = litColor;
        else if (hueShift < 0.8) color = '#7ab0d0'; // blue TV glow
        else color = '#d08050'; // warm reddish

        ctx.fillStyle = color;
        ctx.fillRect(x, y, winW, winH);

        // Window glow
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.fillRect(x, y, winW, winH);
        ctx.shadowBlur = 0;
      } else {
        // Dark window
        ctx.fillStyle = windowColor;
        ctx.fillRect(x, y, winW, winH);

        // Subtle warm reflection
        ctx.fillStyle = 'rgba(140, 120, 80, 0.1)';
        ctx.fillRect(x, y, winW, winH * 0.3);
      }

      // Window frame
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, winW, winH);
    }
  }

  // Shop front on ground floor
  if (hasShopFront) {
    const shopY = height - gapY - marginY * 0.5;
    const shopH = gapY * 1.1;
    ctx.fillStyle = shopColor;
    ctx.globalAlpha = 0.15;
    ctx.fillRect(marginX * 0.5, shopY, width - marginX, shopH);
    ctx.globalAlpha = 1;

    // Shop window
    ctx.fillStyle = 'rgba(255, 220, 100, 0.3)';
    ctx.fillRect(marginX, shopY + shopH * 0.15, width - marginX * 2, shopH * 0.65);
    ctx.strokeStyle = shopColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(marginX, shopY + shopH * 0.15, width - marginX * 2, shopH * 0.65);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createRoadTexture(width = 512, height = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // SA-style warm asphalt
  ctx.fillStyle = '#2a2420';
  ctx.fillRect(0, 0, width, height);

  // Asphalt grain (warmer)
  for (let i = 0; i < 5000; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const v = Math.random() * 18;
    ctx.fillStyle = `rgb(${42 + v}, ${36 + v}, ${32 + v})`;
    ctx.fillRect(x, y, 2, 2);
  }

  // Occasional cracks
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    let cx = Math.random() * width;
    let cy = Math.random() * height;
    ctx.moveTo(cx, cy);
    for (let s = 0; s < 4; s++) {
      cx += (Math.random() - 0.5) * 40;
      cy += Math.random() * 50;
      ctx.lineTo(cx, cy);
    }
    ctx.stroke();
  }

  // Center dashed line (faded yellow)
  ctx.strokeStyle = '#a08820';
  ctx.lineWidth = 3;
  ctx.setLineDash([30, 20]);
  ctx.beginPath();
  ctx.moveTo(width / 2, 0);
  ctx.lineTo(width / 2, height);
  ctx.stroke();

  // Edge lines (faded white)
  ctx.strokeStyle = 'rgba(220, 210, 190, 0.3)';
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(width * 0.1, 0);
  ctx.lineTo(width * 0.1, height);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(width * 0.9, 0);
  ctx.lineTo(width * 0.9, height);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createSidewalkTexture(width = 256, height = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#5a5448';
  ctx.fillRect(0, 0, width, height);

  // Concrete tile pattern (SA sandy)
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
  ctx.lineWidth = 1;
  const tileSize = width / 4;
  for (let x = 0; x <= width; x += tileSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += tileSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Grain
  for (let i = 0; i < 2000; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const v = Math.random() * 10;
    ctx.fillStyle = `rgb(${90 + v}, ${84 + v}, ${72 + v})`;
    ctx.fillRect(x, y, 1, 1);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createSignTexture(text, width = 512, height = 128, options = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const {
    bgColor = 'rgba(0,0,0,0.8)',
    textColor = '#ffd700',
    fontSize = 60,
    glow = true,
    border = true,
    borderColor = '#ffd700',
  } = options;

  // Background
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);

  if (border) {
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, width - 4, height - 4);
  }

  // Text
  ctx.font = `bold ${fontSize}px 'Arial Black', 'Impact', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (glow) {
    ctx.shadowColor = textColor;
    ctx.shadowBlur = 15;
  }

  ctx.fillStyle = textColor;
  ctx.fillText(text, width / 2, height / 2);
  ctx.shadowBlur = 0;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createGraffitiTexture(text, width = 512, height = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Transparent background (will be applied to building walls)
  ctx.clearRect(0, 0, width, height);

  // Graffiti text with drip effect
  // SA-style graffiti colors — greens and oranges (Grove Street vibes)
  const colors = ['#40a030', '#e08020', '#d04020', '#e8c020', '#30a060', '#c04020'];
  const color = colors[Math.floor(Math.random() * colors.length)];

  ctx.font = `bold italic 72px 'Impact', 'Arial Black', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Shadow/outline
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.lineWidth = 6;
  ctx.strokeText(text, width / 2, height / 2);

  // Fill
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 20;
  ctx.fillText(text, width / 2, height / 2);
  ctx.shadowBlur = 0;

  // Drip effect
  const metrics = ctx.measureText(text);
  const textLeft = width / 2 - metrics.width / 2;
  for (let i = 0; i < 5; i++) {
    const dx = textLeft + Math.random() * metrics.width;
    const dy = height / 2 + 30;
    const dripLen = 20 + Math.random() * 40;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.6;
    ctx.fillRect(dx, dy, 2, dripLen);
  }
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createNeonSignTexture(text, width = 256, height = 64, color = '#ff1493') {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, width, height);

  ctx.font = `bold 40px 'Impact', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Multi-layer glow
  for (let i = 3; i >= 0; i--) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 10 + i * 8;
    ctx.fillStyle = i === 0 ? '#ffffff' : color;
    ctx.globalAlpha = i === 0 ? 1 : 0.3;
    ctx.fillText(text, width / 2, height / 2);
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
