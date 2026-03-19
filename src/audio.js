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

// ========== VICE CITY RADIO (Synthwave generator) ==========
let radioNodes = null;

export function startRadio() {
  if (radioPlaying) return;
  const c = getCtx();
  radioPlaying = true;

  // Simple synthwave loop using oscillators
  const nodes = { oscs: [], gains: [], intervals: [] };

  // Bass line (repeating pattern)
  const bassNotes = [55, 55, 73.42, 65.41, 55, 55, 82.41, 73.42]; // Am pattern
  let bassIdx = 0;
  const bassOsc = c.createOscillator();
  bassOsc.type = 'sawtooth';
  bassOsc.frequency.value = bassNotes[0];

  const bassFilter = c.createBiquadFilter();
  bassFilter.type = 'lowpass';
  bassFilter.frequency.value = 300;
  bassFilter.Q.value = 5;

  const bassGain = c.createGain();
  bassGain.gain.value = 0.3;

  bassOsc.connect(bassFilter).connect(bassGain).connect(musicGain);
  bassOsc.start();
  nodes.oscs.push(bassOsc);
  nodes.gains.push(bassGain);

  const bassInterval = setInterval(() => {
    bassIdx = (bassIdx + 1) % bassNotes.length;
    bassOsc.frequency.setTargetAtTime(bassNotes[bassIdx], c.currentTime, 0.05);
  }, 500);
  nodes.intervals.push(bassInterval);

  // Pad (sustained chord)
  const padNotes = [220, 261.63, 329.63]; // Am chord
  for (const freq of padNotes) {
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;

    const padGain = c.createGain();
    padGain.gain.value = 0.06;

    osc.connect(padGain).connect(musicGain);
    osc.start();
    nodes.oscs.push(osc);
    nodes.gains.push(padGain);
  }

  // Hi-hat pattern (noise bursts)
  const hatInterval = setInterval(() => {
    const t = c.currentTime;
    const bufLen = c.sampleRate * 0.02;
    const buf = c.createBuffer(1, bufLen, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufLen * 0.3));
    }
    const src = c.createBufferSource();
    src.buffer = buf;
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 8000;
    const g = c.createGain();
    g.gain.value = 0.08;
    src.connect(hp).connect(g).connect(musicGain);
    src.start();
  }, 250);
  nodes.intervals.push(hatInterval);

  // Kick drum every beat
  const kickInterval = setInterval(() => {
    const t = c.currentTime;
    const kickOsc = c.createOscillator();
    kickOsc.frequency.setValueAtTime(150, t);
    kickOsc.frequency.exponentialRampToValueAtTime(30, t + 0.12);
    const kickGain = c.createGain();
    kickGain.gain.setValueAtTime(0.25, t);
    kickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    kickOsc.connect(kickGain).connect(musicGain);
    kickOsc.start(t);
    kickOsc.stop(t + 0.2);
  }, 500);
  nodes.intervals.push(kickInterval);

  radioNodes = nodes;
}

export function stopRadio() {
  if (!radioNodes) return;
  radioPlaying = false;
  for (const osc of radioNodes.oscs) {
    try { osc.stop(); } catch(e) {}
  }
  for (const id of radioNodes.intervals) {
    clearInterval(id);
  }
  radioNodes = null;
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
