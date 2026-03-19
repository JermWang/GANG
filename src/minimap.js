// GTA-style radar: player-centered, rotates with player, square with dark tint

export class Minimap {
  constructor(cityData) {
    this.canvas = document.getElementById('radar-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.cityData = cityData;
    this.size = 200;

    // How many world-units the radar shows in each direction from player
    this.radarRange = 80;
  }

  update(playerPos, playerYaw, interactionZones) {
    const ctx = this.ctx;
    const size = this.size;
    const half = size / 2;
    const range = this.radarRange;
    const scale = half / range;

    // Clear with GTA radar background
    ctx.fillStyle = '#1a2a18';
    ctx.fillRect(0, 0, size, size);

    // Add subtle green tint overlay (SA radar style)
    ctx.fillStyle = 'rgba(30, 50, 25, 0.5)';
    ctx.fillRect(0, 0, size, size);

    ctx.save();
    // Center on player, rotate so player always faces up
    ctx.translate(half, half);
    ctx.rotate(playerYaw);

    // Draw roads relative to player
    ctx.strokeStyle = 'rgba(80, 100, 70, 0.7)';
    for (let i = 0; i <= this.cityData.gridSize; i++) {
      const linePos = -this.cityData.cityHalf + i * this.cityData.cellSize;

      // Horizontal road
      const hz = (linePos - playerPos.z) * scale;
      ctx.lineWidth = this.cityData.roadWidth * scale;
      ctx.beginPath();
      ctx.moveTo(-half * 2, hz);
      ctx.lineTo(half * 2, hz);
      ctx.stroke();

      // Vertical road
      const hx = (linePos - playerPos.x) * scale;
      ctx.beginPath();
      ctx.moveTo(hx, -half * 2);
      ctx.lineTo(hx, half * 2);
      ctx.stroke();
    }

    // Draw building blocks
    ctx.fillStyle = 'rgba(40, 55, 35, 0.8)';
    for (let gx = 0; gx < this.cityData.gridSize; gx++) {
      for (let gz = 0; gz < this.cityData.gridSize; gz++) {
        const cx = -this.cityData.cityHalf + this.cityData.roadWidth / 2 + 3 + gx * this.cityData.cellSize;
        const cz = -this.cityData.cityHalf + this.cityData.roadWidth / 2 + 3 + gz * this.cityData.cellSize;
        const rx = (cx - playerPos.x) * scale;
        const rz = (cz - playerPos.z) * scale;
        const bw = this.cityData.blockSize * scale;
        ctx.fillRect(rx, rz, bw, bw);
      }
    }

    // Draw special building blips
    if (interactionZones) {
      for (const zone of interactionZones) {
        const zx = (zone.position.x - playerPos.x) * scale;
        const zz = (zone.position.z - playerPos.z) * scale;

        // Only draw if within radar range
        if (Math.abs(zx) < half && Math.abs(zz) < half) {
          // Square blip (GTA style)
          ctx.fillStyle = zone.color || '#e8a000';
          ctx.fillRect(zx - 4, zz - 4, 8, 8);
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 1;
          ctx.strokeRect(zx - 4, zz - 4, 8, 8);
        }
      }
    }

    ctx.restore();

    // Player blip (always center, always pointing up) — white triangle
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(half, half - 6);
    ctx.lineTo(half - 4, half + 4);
    ctx.lineTo(half + 4, half + 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();

    // North indicator
    ctx.save();
    ctx.translate(half, half);
    ctx.rotate(playerYaw);
    // N is at negative Z in world space
    const nx = 0;
    const nz = -half + 12;
    ctx.fillStyle = '#c0c0c0';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('N', nx, nz + 4);
    ctx.restore();

    // Radar edge darkening
    const edgeGrad = ctx.createRadialGradient(half, half, half * 0.6, half, half, half * 1.1);
    edgeGrad.addColorStop(0, 'rgba(0,0,0,0)');
    edgeGrad.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = edgeGrad;
    ctx.fillRect(0, 0, size, size);
  }
}
