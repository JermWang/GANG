// ================================================
// GANG CITY — Audio System (Web Audio API)
// Procedural sounds — no external files needed
// ================================================

let ctx = null;
let masterGain = null;
let musicGain = null;
let sfxGain = null;
let ambientSource = null;
let radioPlaying = false;

function getCtx() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.6;
    masterGain.connect(ctx.destination);

    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.7;
    sfxGain.connect(masterGain);

    musicGain = ctx.createGain();
    musicGain.gain.value = 0.15;
    musicGain.connect(masterGain);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// ========== GUNSHOT ==========
export function playGunshot() {
  const c = getCtx();
  const t = c.currentTime;

  // Noise burst (crack)
  const bufLen = c.sampleRate * 0.08;
  const buf = c.createBuffer(1, bufLen, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufLen * 0.08));
  }
  const noise = c.createBufferSource();
  noise.buffer = buf;

  // Bandpass for punch
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 800;
  bp.Q.value = 1.5;

  // Low thump
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, t);
  osc.frequency.exponentialRampToValueAtTime(40, t + 0.08);

  const oscGain = c.createGain();
  oscGain.gain.setValueAtTime(0.6, t);
  oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

  const noiseGain = c.createGain();
  noiseGain.gain.setValueAtTime(0.8, t);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

  noise.connect(bp).connect(noiseGain).connect(sfxGain);
  osc.connect(oscGain).connect(sfxGain);

  noise.start(t);
  noise.stop(t + 0.1);
  osc.start(t);
  osc.stop(t + 0.12);
}

// ========== FOOTSTEP ==========
let lastFootstep = 0;

export function playFootstep(isRunning = false) {
  const c = getCtx();
  const now = c.currentTime;
  const interval = isRunning ? 0.3 : 0.5;
  if (now - lastFootstep < interval) return;
  lastFootstep = now;

  const t = c.currentTime;

  // Short noise burst
  const bufLen = c.sampleRate * 0.04;
  const buf = c.createBuffer(1, bufLen, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufLen * 0.15));
  }
  const noise = c.createBufferSource();
  noise.buffer = buf;

  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 200 + Math.random() * 200;

  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 2000 + Math.random() * 1000;

  const gain = c.createGain();
  gain.gain.setValueAtTime(0.15, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

  noise.connect(hp).connect(lp).connect(gain).connect(sfxGain);
  noise.start(t);
  noise.stop(t + 0.06);
}

// ========== NPC HIT ==========
export function playNPCHit() {
  const c = getCtx();
  const t = c.currentTime;

  // Thud
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(100, t);
  osc.frequency.exponentialRampToValueAtTime(30, t + 0.15);

  const gain = c.createGain();
  gain.gain.setValueAtTime(0.4, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

  osc.connect(gain).connect(sfxGain);
  osc.start(t);
  osc.stop(t + 0.2);
}

// ========== AMBIENT CITY ==========
export function startAmbient() {
  const c = getCtx();
  if (ambientSource) return;

  // Continuous low rumble + distant traffic
  const bufLen = c.sampleRate * 4;
  const buf = c.createBuffer(1, bufLen, c.sampleRate);
  const data = buf.getChannelData(0);
  
  // Brownian noise (smooth rumble)
  let last = 0;
  for (let i = 0; i < bufLen; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3;
    // Add occasional "car pass" sounds
    if (Math.random() < 0.0001) {
      const carLen = Math.min(c.sampleRate * 0.5, bufLen - i);
      for (let j = 0; j < carLen; j++) {
        const env = Math.sin(Math.PI * j / carLen);
        data[i + j] += (Math.random() * 2 - 1) * 0.15 * env;
      }
    }
  }

  ambientSource = c.createBufferSource();
  ambientSource.buffer = buf;
  ambientSource.loop = true;

  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 400;

  const gain = c.createGain();
  gain.gain.value = 0.25;

  ambientSource.connect(lp).connect(gain).connect(musicGain);
  ambientSource.start();
}

export function stopAmbient() {
  if (ambientSource) {
    ambientSource.stop();
    ambientSource = null;
  }
}

// ========== GTA RADIO (MP3 playback) ==========
let radioAudio = null;

export function startRadio() {
  if (radioPlaying) return;
  radioPlaying = true;

  if (!radioAudio) {
    radioAudio = new Audio('/Grand_Theft_Auto_San_Andreas_-_Theme_Song_(mp3.pm).mp3');
    radioAudio.loop = true;
    radioAudio.volume = 0.3;
  }
  radioAudio.play().catch(() => {});
}

export function stopRadio() {
  if (!radioAudio) return;
  radioPlaying = false;
  radioAudio.pause();
}

export function isRadioPlaying() {
  return radioPlaying;
}

export function toggleRadio() {
  if (radioPlaying) {
    stopRadio();
  } else {
    startRadio();
  }
  return radioPlaying;
}
