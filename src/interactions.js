import * as THREE from 'three';

export class InteractionSystem {
  constructor() {
    this.zones = [];
    this.activeZone = null;
    this.panelOpen = false;

    // DOM refs
    this.overlay = document.getElementById('panel-overlay');
    this.prompt = document.getElementById('interact-prompt');
    this.promptName = document.getElementById('prompt-name');
    this.panels = {};

    // Cache panel elements
    const panelEls = document.querySelectorAll('.panel');
    panelEls.forEach(p => {
      this.panels[p.id] = p;
    });

    this._setupCloseButtons();
    this._setupKeyBindings();
  }

  setZones(zones) {
    this.zones = zones;
  }

  _setupCloseButtons() {
    document.querySelectorAll('.panel-close').forEach(btn => {
      btn.addEventListener('click', () => this.closePanel());
    });

    // Close on backdrop click
    const backdrop = document.querySelector('.panel-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', () => this.closePanel());
    }
  }

  _setupKeyBindings() {
    document.addEventListener('keydown', (e) => {
      if (e.key.toLowerCase() === 'e' && this.activeZone && !this.panelOpen) {
        this.openPanel(this.activeZone.panel);
      }
      if (e.key === 'Escape' && this.panelOpen) {
        this.closePanel();
      }
    });
  }

  update(playerPosition) {
    if (this.panelOpen) return;

    const playerPoint = new THREE.Vector3(
      playerPosition.x,
      playerPosition.y - 0.5,
      playerPosition.z
    );

    let found = null;
    for (const zone of this.zones) {
      if (zone.zone.containsPoint(playerPoint)) {
        found = zone;
        break;
      }
    }

    if (found && found !== this.activeZone) {
      this.activeZone = found;
      this._showPrompt(found.name);
    } else if (!found && this.activeZone) {
      this.activeZone = null;
      this._hidePrompt();
    }
  }

  _showPrompt(name) {
    this.prompt.classList.remove('hidden');
    this.promptName.textContent = name;
  }

  _hidePrompt() {
    this.prompt.classList.add('hidden');
  }

  openPanel(panelId) {
    this.panelOpen = true;
    this._hidePrompt();

    // Show overlay
    this.overlay.classList.remove('hidden');

    // Activate correct panel
    Object.values(this.panels).forEach(p => p.classList.remove('active'));
    if (this.panels[panelId]) {
      this.panels[panelId].classList.add('active');
    }

    // Release pointer lock
    document.exitPointerLock();
  }

  closePanel() {
    this.panelOpen = false;
    this.overlay.classList.add('hidden');
    Object.values(this.panels).forEach(p => p.classList.remove('active'));

    // Re-lock pointer
    const canvas = document.getElementById('game-canvas');
    canvas.requestPointerLock();
  }

  isPanelOpen() {
    return this.panelOpen;
  }
}
