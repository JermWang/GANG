import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { createGTAPass } from './postprocessing.js';
import { City } from './city.js';
import { Player } from './player.js';
import { InteractionSystem } from './interactions.js';
import { setupLighting, createSkybox } from './lighting.js';
import { Minimap } from './minimap.js';
import { NPCSystem } from './npcs.js';
import { GunSystem } from './gun.js';
import { startAmbient, playFootstep, toggleRadio, isRadioPlaying } from './audio.js';

// ============================
// GLOBALS
// ============================
let scene, camera, renderer, composer, gtaPass;
let city, player, interactions, minimap, npcs, gun;
let colliders = [];
let interactionZones = [];
let clock;
let gameStarted = false;

// Camera — GTA SA style third-person
const CAM_DISTANCE = 5;
const CAM_HEIGHT = 2;
const CAM_LERP = 4;
let camPitch = 0.25;

// ============================
// INIT
// ============================
async function init() {
  scene = new THREE.Scene();
  clock = new THREE.Clock();

  // Renderer — warm tone mapping for SA feel
  const canvas = document.getElementById('game-canvas');
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 2.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // Camera — wider FOV like GTA
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 600);

  // === Post-processing chain ===
  composer = new EffectComposer(renderer);

  // 1. Scene render
  composer.addPass(new RenderPass(scene, camera));

  // 2. Bloom — subtle, for sun glow and bright surfaces
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.3,   // strength
    0.5,   // radius
    0.9    // threshold
  );
  composer.addPass(bloomPass);

  // 3. GTA SA color grading + film grain + vignette
  gtaPass = createGTAPass();
  composer.addPass(gtaPass);

  // Lighting + Sky
  setupLighting(scene);
  createSkybox(scene);

  // City
  updateLoader(10, 'GENERATING CITY...');
  city = new City(scene);
  const cityData = city.generate();
  colliders = cityData.colliders;
  interactionZones = cityData.interactionZones;

  updateLoader(30, 'LOADING MODELS...');

  // Player
  player = new Player(scene);
  player.spawn(city.getSpawnPosition());

  // Load player model (GLB)
  await player.loadModel();
  updateLoader(50, 'SPAWNING CIVILIANS...');

  // NPCs (pedestrians and traffic)
  npcs = new NPCSystem(scene, cityData);

  // Load civilian GLTF models before spawning
  await npcs.loadModels();
  npcs.initialize();
  updateLoader(70, 'LOADING HUD...');

  // Interactions
  interactions = new InteractionSystem();
  interactions.setZones(interactionZones);

  // Radar (GTA-style)
  minimap = new Minimap(city.getMinimapData());

  // Gun system (pass player mesh for 3rd person gun attachment)
  gun = new GunSystem(scene, camera, player.mesh);

  updateLoader(90, 'ALMOST THERE...');

  // Events
  window.addEventListener('resize', onResize);

  const gameCanvas = document.getElementById('game-canvas');
  gameCanvas.addEventListener('click', () => {
    if (gameStarted && !interactions.isPanelOpen()) {
      gameCanvas.requestPointerLock();
    }
  });

  document.addEventListener('pointerlockchange', () => {
    player.pointerLocked = document.pointerLockElement === gameCanvas;
  });

  document.addEventListener('mousemove', (e) => {
    if (!player.pointerLocked) return;
    camPitch = Math.max(0.05, Math.min(1.0, camPitch + e.movementY * 0.002));
  });

  // Radio keyboard shortcut
  document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'r' && gameStarted) {
      toggleRadio();
      const radioBtn = document.getElementById('radio-btn');
      if (radioBtn) radioBtn.classList.toggle('active', isRadioPlaying());
    }
  });

  // Copy CA button
  const copyBtn = document.getElementById('copy-ca-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const ca = copyBtn.dataset.ca || 'TBA';
      navigator.clipboard.writeText(ca).then(() => {
        const msg = document.getElementById('ca-copied-msg');
        if (msg) { msg.textContent = 'COPIED!'; setTimeout(() => { msg.textContent = ''; }, 2000); }
      });
    });
  }

  // Nav bar panel buttons
  setupNavBar();

  // Loading complete
  updateLoader(100, 'READY');
  setTimeout(() => {
    const enterBtn = document.getElementById('enter-btn');
    enterBtn.classList.remove('hidden');
    enterBtn.addEventListener('click', startGame);
  }, 400);

  animate();
}

function setupNavBar() {
  const overlay = document.getElementById('panel-overlay');
  const navLinks = document.querySelectorAll('.nav-link[data-panel]');
  const closeBtns = document.querySelectorAll('.panel-close[data-close]');

  function openPanel(panelId) {
    // Hide all panels first
    overlay.querySelectorAll('.panel').forEach(p => p.style.display = 'none');
    const target = document.getElementById(panelId);
    if (target) {
      target.style.display = '';
      overlay.classList.remove('hidden');
      // Exit pointer lock when panel is open
      if (document.pointerLockElement) document.exitPointerLock();
    }
    // Highlight active nav link
    navLinks.forEach(l => l.classList.toggle('active', l.dataset.panel === panelId));
  }

  function closePanel() {
    overlay.classList.add('hidden');
    navLinks.forEach(l => l.classList.remove('active'));
  }

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.stopPropagation();
      const panelId = link.dataset.panel;
      // Toggle: if already open, close it
      const target = document.getElementById(panelId);
      if (!overlay.classList.contains('hidden') && target && target.style.display !== 'none') {
        closePanel();
      } else {
        openPanel(panelId);
      }
    });
  });

  closeBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      closePanel();
    });
  });

  // Click backdrop to close
  const backdrop = overlay.querySelector('.panel-backdrop');
  if (backdrop) {
    backdrop.addEventListener('click', closePanel);
  }
}

function startGame() {
  gameStarted = true;

  const startScreen = document.getElementById('start-screen');
  startScreen.classList.add('fade-out');
  setTimeout(() => { startScreen.style.display = 'none'; }, 1000);

  // HUD already visible from start screen
  document.getElementById('game-canvas').requestPointerLock();

  // Snap camera to correct 3rd person position immediately
  const pPos = player.getPosition();
  const yaw = player.getYaw();
  camera.position.set(
    pPos.x + Math.sin(yaw + Math.PI) * CAM_DISTANCE,
    pPos.y + CAM_HEIGHT + camPitch * 2,
    pPos.z + Math.cos(yaw + Math.PI) * CAM_DISTANCE
  );
  camera.lookAt(pPos.x, pPos.y + 1.2, pPos.z);

  // Show gun
  if (gun) gun.show();

  // Start ambient city sounds
  startAmbient();

  // Setup radio toggle
  const radioBtn = document.getElementById('radio-btn');
  if (radioBtn) {
    radioBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleRadio();
      radioBtn.classList.toggle('active', isRadioPlaying());
    });
  }

  // Setup share button — high score tweet with CJ meme
  const shareBtn = document.getElementById('share-btn');
  if (shareBtn) {
    shareBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const kills = gun ? gun.killCount : 0;
      const siteUrl = window.location.origin;
      const imageUrl = `${siteUrl}/Desperate-CJ-meme-3.jpg`;
      const text = encodeURIComponent(
        `I just dropped ${kills} bodies in $GANG City 🔫☠️\n\nThink you can beat my score?\n\nGrind And Never Give-up 💰\n\n`
      );
      const url = encodeURIComponent(siteUrl);
      window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
    });
  }

  // Setup mobile controls
  setupMobileControls();
}

function updateLoader(percent, text) {
  const bar = document.getElementById('loader-bar');
  const label = document.getElementById('loader-text');
  if (bar) bar.style.width = `${percent}%`;
  if (label) label.textContent = text;
}

// ============================
// GAME LOOP
// ============================
function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.getElapsedTime();

  // Update GTA shader time (for film grain animation)
  if (gtaPass) {
    gtaPass.uniforms.time.value = elapsed;
  }

  // Always update NPCs (even during loading screen for visual effect)
  if (npcs) {
    npcs.update(dt);
  }

  if (gameStarted) {
    player.update(dt, colliders);
    updateCamera(dt);
    interactions.update(player.getPosition());
    minimap.update(player.getPosition(), player.getYaw(), interactionZones);
    if (gun) gun.update(dt, player.getPosition(), player.getYaw(), player.rightHandBone);

    // Footstep sounds when moving
    if (player.direction.lengthSq() > 0 && player.onGround) {
      playFootstep(player.keys.shift);
    }
  } else {
    // Cinematic idle camera — slow orbit around gas station
    const t = elapsed;
    const radius = 30;
    camera.position.set(
      Math.sin(t * 0.1) * radius - 5,
      12 + Math.sin(t * 0.06) * 3,
      Math.cos(t * 0.1) * radius
    );
    camera.lookAt(-5, 3, -10);
  }

  composer.render();
}

function updateCamera(dt) {
  const playerPos = player.getPosition();
  const yaw = player.getYaw();

  // GTA-style third person: behind and slightly above shoulder
  const targetX = playerPos.x + Math.sin(yaw + Math.PI) * CAM_DISTANCE;
  const targetZ = playerPos.z + Math.cos(yaw + Math.PI) * CAM_DISTANCE;
  const targetY = playerPos.y + CAM_HEIGHT + camPitch * 2;

  // Smooth follow with slight lag (like GTA cam)
  const lerpFactor = 1 - Math.exp(-CAM_LERP * dt);
  camera.position.x += (targetX - camera.position.x) * lerpFactor;
  camera.position.y += (targetY - camera.position.y) * lerpFactor;
  camera.position.z += (targetZ - camera.position.z) * lerpFactor;

  // Look at player upper body / slightly ahead
  const lookAhead = 1.5;
  const lookTarget = new THREE.Vector3(
    playerPos.x + Math.sin(yaw) * lookAhead,
    playerPos.y + 1.2,
    playerPos.z + Math.cos(yaw) * lookAhead
  );
  camera.lookAt(lookTarget);
}

// ============================
// RESIZE
// ============================
function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
}

// ============================
// MOBILE CONTROLS
// ============================
function setupMobileControls() {
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || 
                   ('ontouchstart' in window && window.innerWidth < 900);
  if (!isMobile) return;

  // Auto-lock pointer isn't available on mobile, so skip it
  // Instead, use touch-based camera drag on the canvas
  const canvas = document.getElementById('game-canvas');
  let lastTouchX = 0, lastTouchY = 0;
  let cameraTouch = null;

  canvas.addEventListener('touchstart', (e) => {
    // Use touches not on joystick/buttons for camera
    for (const t of e.changedTouches) {
      if (t.clientX > window.innerWidth * 0.3 && t.clientX < window.innerWidth * 0.7) {
        cameraTouch = t.identifier;
        lastTouchX = t.clientX;
        lastTouchY = t.clientY;
      }
    }
  }, { passive: true });

  canvas.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === cameraTouch) {
        const dx = t.clientX - lastTouchX;
        const dy = t.clientY - lastTouchY;
        player.yaw -= dx * 0.004;
        camPitch = Math.max(0.05, Math.min(1.0, camPitch + dy * 0.004));
        lastTouchX = t.clientX;
        lastTouchY = t.clientY;
      }
    }
  }, { passive: true });

  canvas.addEventListener('touchend', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === cameraTouch) cameraTouch = null;
    }
  }, { passive: true });

  // Joystick
  const joystickZone = document.getElementById('joystick-zone');
  const joystickThumb = document.getElementById('joystick-thumb');
  let joystickTouch = null;
  const joyCenter = { x: 60, y: 60 };
  const joyMax = 40;

  joystickZone.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.changedTouches[0];
    joystickTouch = t.identifier;
    player.pointerLocked = true; // Enable movement on mobile
  });

  joystickZone.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === joystickTouch) {
        const rect = joystickZone.getBoundingClientRect();
        let dx = t.clientX - rect.left - joyCenter.x;
        let dy = t.clientY - rect.top - joyCenter.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > joyMax) {
          dx = (dx / dist) * joyMax;
          dy = (dy / dist) * joyMax;
        }
        joystickThumb.style.transform = `translate(${dx}px, ${dy}px)`;
        
        // Map to WASD
        const nx = dx / joyMax;
        const ny = dy / joyMax;
        player.keys.w = ny < -0.3;
        player.keys.s = ny > 0.3;
        player.keys.a = nx < -0.3;
        player.keys.d = nx > 0.3;
      }
    }
  });

  const resetJoystick = () => {
    joystickTouch = null;
    joystickThumb.style.transform = 'translate(0, 0)';
    player.keys.w = false;
    player.keys.s = false;
    player.keys.a = false;
    player.keys.d = false;
  };

  joystickZone.addEventListener('touchend', resetJoystick);
  joystickZone.addEventListener('touchcancel', resetJoystick);

  // Fire button
  const fireBtn = document.getElementById('mobile-shoot');
  if (fireBtn) {
    fireBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (gun) gun.isFiring = true;
    });
    fireBtn.addEventListener('touchend', () => {
      if (gun) gun.isFiring = false;
    });
  }

  // Sprint button
  const sprintBtn = document.getElementById('mobile-sprint');
  if (sprintBtn) {
    sprintBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      player.keys.shift = true;
    });
    sprintBtn.addEventListener('touchend', () => {
      player.keys.shift = false;
    });
  }

  // Interact button
  const interactBtn = document.getElementById('mobile-interact');
  if (interactBtn) {
    interactBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      // Simulate E key press
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'e' }));
    });
    interactBtn.addEventListener('touchend', () => {
      document.dispatchEvent(new KeyboardEvent('keyup', { key: 'e' }));
    });
  }
}

// ============================
// DEBUG (expose for Puppeteer inspection)
// ============================
window.__debug = () => ({ scene, camera, player, npcs, gun, gameStarted });

// ============================
// INTRO VIDEO FLOW
// ============================
let initStarted = false;

function endIntroAndStartLoading() {
  if (initStarted) return;
  initStarted = true;

  const overlay = document.getElementById('intro-overlay');
  const video = document.getElementById('intro-video');
  const clickPrompt = document.getElementById('intro-click-prompt');

  // Immediately hide click prompt to prevent flashback
  if (clickPrompt) clickPrompt.style.display = 'none';
  
  // Force overlay to stay hidden
  overlay.style.pointerEvents = 'none';

  // Fade out intro overlay
  overlay.classList.add('fade-out');
  setTimeout(() => {
    overlay.style.display = 'none';
    if (video) { video.pause(); video.src = ''; } // free memory
  }, 1000);

  // Show start screen and begin loading the game
  const startScreen = document.getElementById('start-screen');
  startScreen.style.display = '';
  
  // Show HUD components on start screen (GTA style)
  document.getElementById('hud').classList.remove('hidden');
  
  init();
}

function setupIntro() {
  const overlay = document.getElementById('intro-overlay');
  const video = document.getElementById('intro-video');
  const clickPrompt = document.getElementById('intro-click-prompt');
  const startBtn = document.getElementById('intro-start-btn');

  if (!overlay || !video || !startBtn) {
    // No intro elements, just start normally
    document.getElementById('start-screen').style.display = '';
    document.getElementById('hud').classList.remove('hidden');
    init();
    return;
  }

  // Check if video file exists and can load
  video.addEventListener('error', () => {
    console.log('Intro video not found, skipping to start screen');
    endIntroAndStartLoading();
  }, { once: true });

  // Try to load the video metadata
  video.load();

  startBtn.addEventListener('click', () => {
    // Hide the click prompt immediately and permanently
    clickPrompt.style.display = 'none';
    clickPrompt.style.visibility = 'hidden';
    video.classList.add('playing');
    
    // Ensure video doesn't loop
    video.loop = false;
    
    // Play video with audio
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // If video play fails, skip to game
        endIntroAndStartLoading();
      });
    }

    // Add a skip button once video is playing
    const skipBtn = document.createElement('button');
    skipBtn.id = 'intro-skip-btn';
    skipBtn.textContent = 'SKIP ▶';
    skipBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      endIntroAndStartLoading();
    });
    overlay.appendChild(skipBtn);
  }, { once: true });

  // When video ends naturally, transition to start screen
  video.addEventListener('ended', () => {
    endIntroAndStartLoading();
  }, { once: true });
}

// ============================
// START
// ============================
setupIntro();
