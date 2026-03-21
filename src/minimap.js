// GTA-style radar: player-centered, rotates with player, square with dark tint

export class Minimap {
  constructor(cityData) {
    this.canvas = document.getElementById('radar-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.cityData = cityData;
    this.size = 200;
    this.radarRange = 50;
  }

  update(playerPos, playerYaw, interactionZones) {
    const ctx = this.ctx;
    const size = this.size;
    const half = size / 2;
    const range = this.radarRange;
    const scale = half / range;
    const rw = this.cityData.roadWidth || 14;

    // Clear with GTA radar background
    ctx.fillStyle = '#1a2a18';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = 'rgba(30, 50, 25, 0.5)';
    ctx.fillRect(0, 0, size, size);

    ctx.save();
    ctx.translate(half, half);
    ctx.rotate(playerYaw);

    // Draw the single road (horizontal along X, at Z=0)
    const roadZ = (0 - playerPos.z) * scale;
    ctx.strokeStyle = 'rgba(80, 100, 70, 0.7)';
    ctx.lineWidth = rw * scale;
    ctx.beginPath();
    ctx.moveTo(-half * 3, roadZ);
    ctx.lineTo(half * 3, roadZ);
    ctx.stroke();

    // Gas station blip (south side)
    const gsX = (-10 - playerPos.x) * scale;
    const gsZ = (-(rw / 2 + 15) - playerPos.z) * scale;
    if (Math.abs(gsX) < half && Math.abs(gsZ) < half) {
      ctx.fillStyle = '#e8a000';
      ctx.fillRect(gsX - 6, gsZ - 4, 12, 8);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.strokeRect(gsX - 6, gsZ - 4, 12, 8);
    }

    // Parking lot blip (north side)
    const plX = (5 - playerPos.x) * scale;
    const plZ = ((rw / 2 + 8) - playerPos.z) * scale;
    if (Math.abs(plX) < half && Math.abs(plZ) < half) {
      ctx.fillStyle = 'rgba(60, 80, 55, 0.8)';
      ctx.fillRect(plX - 8, plZ - 4, 16, 8);
    }

    ctx.restore();

    // Player blip — white triangle always center
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
    ctx.fillStyle = '#c0c0c0';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('N', 0, -half + 16);
    ctx.restore();

    // Radar edge darkening
    const edgeGrad = ctx.createRadialGradient(half, half, half * 0.6, half, half, half * 1.1);
    edgeGrad.addColorStop(0, 'rgba(0,0,0,0)');
    edgeGrad.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = edgeGrad;
    ctx.fillRect(0, 0, size, size);
  }
}
