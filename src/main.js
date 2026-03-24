import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { createGTAPass } from './postprocessing.js';
import { City } from './city.js';
import { setupLighting, createSkybox } from './lighting.js';
import { Minimap } from './minimap.js';
import { startAmbient, toggleRadio, isRadioPlaying } from './audio.js';

// ============================
// GLOBALS
// ============================
let scene, camera, renderer, composer, gtaPass;
let city, minimap;
let interactionZones = [];
let clock;

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

  // Camera
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 600);

  // === Post-processing chain ===
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.3, 0.5, 0.9
  );
  composer.addPass(bloomPass);

  gtaPass = createGTAPass();
  composer.addPass(gtaPass);

  // Lighting + Sky
  setupLighting(scene);
  createSkybox(scene);

  // City
  city = new City(scene);
  const cityData = city.generate();
  interactionZones = cityData.interactionZones;

  // Radar (decorative)
  minimap = new Minimap(city.getMinimapData());

  // Events
  window.addEventListener('resize', onResize);

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

  // Loading complete — show enter button
  updateLoader(100, 'READY');
  setTimeout(() => {
    const enterBtn = document.getElementById('enter-btn');
    if (enterBtn) {
      enterBtn.classList.remove('hidden');
      enterBtn.addEventListener('click', enterSite);
      enterBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        enterSite();
      }, { once: true });
    }
  }, 400);

  animate();
}

function enterSite() {
  const startScreen = document.getElementById('start-screen');
  if (startScreen) {
    startScreen.classList.add('fade-out');
    setTimeout(() => { startScreen.style.display = 'none'; }, 1000);
  }

  // Show decorative HUD
  document.getElementById('hud').classList.remove('hidden');

  // Start ambient city sounds
  startAmbient();

  // Radio toggle
  const radioBtn = document.getElementById('radio-btn');
  if (radioBtn) {
    radioBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleRadio();
      radioBtn.classList.toggle('active', isRadioPlaying());
    });
  }

  // Share button
  const shareBtn = document.getElementById('share-btn');
  if (shareBtn) {
    shareBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const siteUrl = window.location.origin;
      const text = encodeURIComponent(
        `$GANG \u2014 Grind And Never Give-up \ud83d\udcb0\n\nThe next big community token on Solana \ud83d\udd25\n\n`
      );
      const url = encodeURIComponent(siteUrl);
      window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
    });
  }
}

function updateLoader(percent, text) {
  const bar = document.getElementById('loader-bar');
  const label = document.getElementById('loader-text');
  if (bar) bar.style.width = `${percent}%`;
  if (label) label.textContent = text;
}

function setupNavBar() {
  const overlay = document.getElementById('panel-overlay');
  const navLinks = document.querySelectorAll('.nav-link[data-panel]');
  const closeBtns = document.querySelectorAll('.panel-close[data-close]');
  let activePanel = null;

  function openPanel(panelId) {
    // Remove active from all panels
    overlay.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(panelId);
    if (target) {
      target.classList.add('active');
      overlay.classList.remove('hidden');
      activePanel = panelId;
    }
    // Highlight active nav link
    navLinks.forEach(l => l.classList.toggle('active', l.dataset.panel === panelId));
  }

  function closePanel() {
    overlay.classList.add('hidden');
    overlay.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    navLinks.forEach(l => l.classList.remove('active'));
    activePanel = null;
  }

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.stopPropagation();
      const panelId = link.dataset.panel;
      // Toggle: if same panel is open, close; otherwise switch
      if (activePanel === panelId) {
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

  // ESC key to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && activePanel) {
      closePanel();
    }
  });
}

// ============================
// CINEMATIC CAMERA LOOP
// ============================
function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.getElapsedTime();

  // Update GTA shader time (for film grain animation)
  if (gtaPass) {
    gtaPass.uniforms.time.value = elapsed;
  }

  // Cinematic camera — slow orbit around the city
  const t = elapsed;
  const radius = 35;
  camera.position.set(
    Math.sin(t * 0.08) * radius - 5,
    14 + Math.sin(t * 0.05) * 4,
    Math.cos(t * 0.08) * radius
  );
  camera.lookAt(-5, 2, -10);

  // Update decorative minimap with camera position
  if (minimap) {
    const camYaw = Math.atan2(camera.position.x + 5, camera.position.z + 10);
    minimap.update(camera.position, camYaw, interactionZones);
  }

  composer.render();
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
// DEBUG (expose for Puppeteer inspection)
// ============================
window.__debug = () => ({ scene, camera });

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

  // Show start screen and begin loading
  document.getElementById('start-screen').style.display = '';
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
    init();
    return;
  }

  // Check if video file exists and can load
  video.addEventListener('error', () => {
    console.log('Intro video not found, skipping to start screen');
    endIntroAndStartLoading();
  }, { once: true });

  // Timeout: if video doesn't load within 4s (e.g. mobile), skip intro
  const videoTimeout = setTimeout(() => {
    if (!initStarted) {
      console.log('Intro video load timeout, skipping to start screen');
      endIntroAndStartLoading();
    }
  }, 4000);

  video.addEventListener('loadeddata', () => clearTimeout(videoTimeout), { once: true });

  // Try to load the video metadata
  video.load();

  function onIntroStart() {
    // Hide the click prompt immediately and permanently
    clickPrompt.style.display = 'none';
    clickPrompt.style.visibility = 'hidden';
    video.classList.add('playing');
    
    // Ensure video doesn't loop
    video.loop = false;
    clearTimeout(videoTimeout);
    
    // Play video with audio
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // If video play fails (common on mobile), skip to game
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
    skipBtn.addEventListener('touchend', (e) => {
      e.stopPropagation();
      endIntroAndStartLoading();
    });
    overlay.appendChild(skipBtn);
  }

  startBtn.addEventListener('click', onIntroStart, { once: true });
  // Also handle touchend for mobile (some browsers delay click events)
  startBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    startBtn.removeEventListener('click', onIntroStart);
    onIntroStart();
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
