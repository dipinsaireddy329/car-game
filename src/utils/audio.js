/**
 * audio.js — Dipin Highway Racer Procedural Audio Engine
 * ─────────────────────────────────────────────────────────────────────────────
 * All sounds are generated via Web Audio API (no external files).
 * Supports: engine hum, nitro, crash, coin, shield, click, rain ambience,
 *           thunder, city ambience, level-up, combo ping, daily reward chime,
 *           lucky box sparkle, and a procedural synthwave music loop.
 *
 * Volume levels are stored in localStorage:
 *   dipin_volume_sfx   → 0.0–1.0
 *   dipin_volume_music → 0.0–1.0
 */

class SoundManager {
  constructor() {
    this.ctx         = null;
    this.muted       = false;

    // Master volume nodes (created after ctx is initialised)
    this._sfxGain    = null;
    this._musicGain  = null;
    this._masterGain = null;

    // ── Engine hum
    this.engineOsc  = null;
    this.engineGain = null;

    // ── Music loop
    this.musicTimer   = null;
    this.musicStep    = 0;
    this.musicPlaying = false;

    // ── Rain ambience
    this._rainNode  = null;
    this._rainGain  = null;
    this._rainPlaying = false;

    // ── City ambience (low drone)
    this._cityNode  = null;
    this._cityGain  = null;
    this._cityPlaying = false;

    // ── Volume levels (read from localStorage or use defaults)
    this.sfxVolume   = parseFloat(localStorage.getItem('dipin_volume_sfx')   ?? '0.15');
    this.synthVolume = parseFloat(localStorage.getItem('dipin_volume_music')  ?? '0.08');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // INIT
  // ───────────────────────────────────────────────────────────────────────────

  init() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();

    // Master gain — everything flows through this
    this._masterGain = this.ctx.createGain();
    this._masterGain.gain.value = this.muted ? 0 : 1;
    this._masterGain.connect(this.ctx.destination);

    // SFX sub-bus
    this._sfxGain = this.ctx.createGain();
    this._sfxGain.gain.value = 1;
    this._sfxGain.connect(this._masterGain);

    // Music sub-bus
    this._musicGain = this.ctx.createGain();
    this._musicGain.gain.value = 1;
    this._musicGain.connect(this._masterGain);

    // Resume on first user interaction (browser autoplay policy)
    if (this.ctx.state === 'suspended') {
      const resume = () => {
        this.ctx.resume();
        window.removeEventListener('click',    resume);
        window.removeEventListener('keydown',  resume);
        window.removeEventListener('touchend', resume);
      };
      window.addEventListener('click',    resume, { once: true });
      window.addEventListener('keydown',  resume, { once: true });
      window.addEventListener('touchend', resume, { once: true });
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // MUTE / VOLUME
  // ───────────────────────────────────────────────────────────────────────────

  toggleMute() {
    this.muted = !this.muted;
    if (this._masterGain) {
      this._masterGain.gain.setTargetAtTime(this.muted ? 0 : 1, this.ctx.currentTime, 0.1);
    }
    if (this.muted) {
      this.stopEngine();
      this.stopMusic();
      this.stopRain();
      this.stopCity();
    }
    return this.muted;
  }

  /** Set SFX volume (0–1). Persists to localStorage. */
  setSfxVolume(v) {
    this.sfxVolume = Math.max(0, Math.min(1, v));
    localStorage.setItem('dipin_volume_sfx', this.sfxVolume.toFixed(2));
  }

  /** Set music volume (0–1). Persists to localStorage. */
  setMusicVolume(v) {
    this.synthVolume = Math.max(0, Math.min(1, v));
    localStorage.setItem('dipin_volume_music', this.synthVolume.toFixed(2));
    if (this._musicGain) {
      this._musicGain.gain.setTargetAtTime(this.synthVolume * 10, this.ctx.currentTime, 0.2);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // HELPER — create a short noise buffer
  // ───────────────────────────────────────────────────────────────────────────

  _makeNoise(duration) {
    if (!this.ctx) return null;
    const size   = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
    const data   = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  /** Utility: connect osc → gain → sfx bus and schedule start/stop */
  _scheduleOsc(type, freq, gainVal, start, stop) {
    if (!this.ctx) return;
    try {
      const osc  = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(gainVal, start);
      gain.gain.exponentialRampToValueAtTime(0.001, stop);
      osc.connect(gain);
      gain.connect(this._sfxGain);
      osc.start(start);
      osc.stop(stop);
    } catch (e) { /* safe */ }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // ENGINE HUM
  // ───────────────────────────────────────────────────────────────────────────

  startEngine() {
    if (this.muted) return;
    this.init();
    if (!this.ctx || this.engineOsc) return;

    try {
      this.engineOsc  = this.ctx.createOscillator();
      const filter    = this.ctx.createBiquadFilter();
      this.engineGain = this.ctx.createGain();

      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.setValueAtTime(65, this.ctx.currentTime);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(180, this.ctx.currentTime);

      this.engineGain.gain.setValueAtTime(0.04, this.ctx.currentTime);

      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this._sfxGain);
      this.engineOsc.start();
    } catch (e) { console.warn('Engine audio failed', e); }
  }

  updateEnginePitch(speedRatio) {
    if (this.muted || !this.ctx || !this.engineOsc) return;
    try {
      const freq = 50 + speedRatio * 130;
      const vol  = 0.03 + speedRatio * 0.03;
      this.engineOsc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.1);
      this.engineGain.gain.setTargetAtTime(vol,  this.ctx.currentTime, 0.1);
    } catch (e) { /* safe */ }
  }

  stopEngine() {
    if (this.engineOsc) {
      try { this.engineOsc.stop(); } catch (e) {}
      this.engineOsc  = null;
      this.engineGain = null;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SFX
  // ───────────────────────────────────────────────────────────────────────────

  /** Coin collect — double beep */
  playCoin() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._scheduleOsc('sine', 523.25, this.sfxVolume, t,        t + 0.12);
    this._scheduleOsc('sine', 659.25, this.sfxVolume, t + 0.07, t + 0.24);
  }

  /** Crash / explosion — noise + low boom */
  playCrash() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    try {
      const t      = this.ctx.currentTime;
      const buffer = this._makeNoise(0.5);
      const noise  = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type  = 'lowpass';
      filter.frequency.setValueAtTime(800, t);
      filter.frequency.exponentialRampToValueAtTime(80, t + 0.45);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(this.sfxVolume * 1.5, t);
      gain.gain.exponentialRampToValueAtTime(0.001,  t + 0.48);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this._sfxGain);
      noise.start(t);
      noise.stop(t + 0.5);

      // Low rumble boom
      this._scheduleOsc('sawtooth', 100, this.sfxVolume * 1.2, t, t + 0.4);
    } catch (e) {}
  }

  /** Nitro activation whoosh */
  playNitro() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    try {
      const t      = this.ctx.currentTime;
      const buffer = this._makeNoise(0.4);
      const noise  = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type  = 'bandpass';
      filter.Q.setValueAtTime(3, t);
      filter.frequency.setValueAtTime(400,  t);
      filter.frequency.exponentialRampToValueAtTime(2500, t + 0.4);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(this.sfxVolume * 0.8, t);
      gain.gain.exponentialRampToValueAtTime(0.001,  t + 0.4);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this._sfxGain);
      noise.start(t);
      noise.stop(t + 0.4);
    } catch (e) {}
  }

  /** Shield / powerup activate */
  playShield() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._scheduleOsc('sine', 220,  this.sfxVolume, t, t + 0.18);
    this._scheduleOsc('sine', 440,  this.sfxVolume, t + 0.12, t + 0.32);
    this._scheduleOsc('sine', 880,  this.sfxVolume, t + 0.24, t + 0.38);
  }

  /** UI button click */
  playClick() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._scheduleOsc('sine', 700, this.sfxVolume * 0.45, t, t + 0.06);
  }

  /** ── NEW: Thunder crack (for Storm/Rain theme lightning) */
  playThunder() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    try {
      const t      = this.ctx.currentTime;
      const buffer = this._makeNoise(1.2);
      const noise  = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type  = 'lowpass';
      filter.frequency.setValueAtTime(600, t);
      filter.frequency.exponentialRampToValueAtTime(40, t + 1.0);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(this.sfxVolume * 2.5, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.1);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this._sfxGain);
      noise.start(t);
      noise.stop(t + 1.2);

      // Sub boom
      this._scheduleOsc('sine', 55, this.sfxVolume * 1.8, t, t + 0.6);
    } catch (e) {}
  }

  /** ── NEW: Level-up celebration — ascending arpeggio */
  playLevelUp() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const notes = [261.63, 329.63, 392, 523.25, 659.25, 783.99];
    notes.forEach((freq, i) => {
      this._scheduleOsc('triangle', freq, this.sfxVolume * 0.9, t + i * 0.09, t + i * 0.09 + 0.18);
    });
  }

  /** ── NEW: Combo increase ping — rising sine */
  playCombo(comboLevel = 1) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const t    = this.ctx.currentTime;
    const freq = 400 + comboLevel * 120;
    this._scheduleOsc('sine', freq, this.sfxVolume * 0.5, t, t + 0.1);
    this._scheduleOsc('sine', freq * 1.5, this.sfxVolume * 0.35, t + 0.06, t + 0.18);
  }

  /** ── NEW: Daily reward chime — sparkle sequence */
  playDailyReward() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // Pentatonic sparkle
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
      this._scheduleOsc('triangle', f, this.sfxVolume * 0.7, t + i * 0.1, t + i * 0.1 + 0.22);
      if (i % 2 === 0) {
        this._scheduleOsc('sine', f * 2, this.sfxVolume * 0.2, t + i * 0.1 + 0.05, t + i * 0.1 + 0.2);
      }
    });
  }

  /** ── NEW: Lucky box — random sparkle burst */
  playLuckyBox() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const freqs = [440, 880, 660, 1320, 990, 1760];
    freqs.forEach((f, i) => {
      const delay = Math.random() * 0.35;
      this._scheduleOsc(
        Math.random() > 0.5 ? 'sine' : 'triangle',
        f, this.sfxVolume * (0.4 + Math.random() * 0.4),
        t + delay, t + delay + 0.15
      );
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // RAIN AMBIENCE — looping filtered noise
  // ───────────────────────────────────────────────────────────────────────────

  startRain() {
    if (this.muted || this._rainPlaying) return;
    this.init();
    if (!this.ctx) return;

    try {
      // 5-second noise loop
      const size   = this.ctx.sampleRate * 5;
      const buffer = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
      const data   = buffer.getChannelData(0);
      for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;

      this._rainNode          = this.ctx.createBufferSource();
      this._rainNode.buffer   = buffer;
      this._rainNode.loop     = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type  = 'bandpass';
      filter.frequency.value = 2200;
      filter.Q.value         = 0.3;

      const filter2 = this.ctx.createBiquadFilter();
      filter2.type  = 'highpass';
      filter2.frequency.value = 500;

      this._rainGain = this.ctx.createGain();
      this._rainGain.gain.value = 0;

      this._rainNode.connect(filter);
      filter.connect(filter2);
      filter2.connect(this._rainGain);
      this._rainGain.connect(this._musicGain);

      this._rainNode.start();
      // Fade in
      this._rainGain.gain.setTargetAtTime(this.sfxVolume * 0.5, this.ctx.currentTime, 1.0);
      this._rainPlaying = true;
    } catch (e) {}
  }

  stopRain() {
    if (!this._rainPlaying) return;
    if (this._rainGain) {
      this._rainGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.5);
      setTimeout(() => {
        try { this._rainNode?.stop(); } catch (e) {}
        this._rainNode  = null;
        this._rainGain  = null;
      }, 1500);
    }
    this._rainPlaying = false;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // CITY AMBIENCE — low rumble drone
  // ───────────────────────────────────────────────────────────────────────────

  startCity() {
    if (this.muted || this._cityPlaying) return;
    this.init();
    if (!this.ctx) return;

    try {
      this._cityNode      = this.ctx.createOscillator();
      this._cityNode.type = 'sawtooth';
      this._cityNode.frequency.setValueAtTime(55, this.ctx.currentTime);

      const filter = this.ctx.createBiquadFilter();
      filter.type  = 'lowpass';
      filter.frequency.value = 120;

      this._cityGain = this.ctx.createGain();
      this._cityGain.gain.value = 0;

      this._cityNode.connect(filter);
      filter.connect(this._cityGain);
      this._cityGain.connect(this._musicGain);
      this._cityNode.start();

      this._cityGain.gain.setTargetAtTime(this.synthVolume * 0.3, this.ctx.currentTime, 1.5);
      this._cityPlaying = true;
    } catch (e) {}
  }

  stopCity() {
    if (!this._cityPlaying) return;
    if (this._cityGain) {
      this._cityGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.5);
      setTimeout(() => {
        try { this._cityNode?.stop(); } catch (e) {}
        this._cityNode  = null;
        this._cityGain  = null;
      }, 1500);
    }
    this._cityPlaying = false;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SYNTHWAVE MUSIC LOOP
  // ───────────────────────────────────────────────────────────────────────────

  startMusic() {
    if (this.muted || this.musicPlaying) return;
    this.init();
    if (!this.ctx) return;

    this.musicPlaying = true;
    this.musicStep    = 0;

    // A-minor-ish progression: A, C, G, D, F, Am, Em, G
    const bassline  = [55.00, 55.00, 65.41, 65.41, 48.99, 48.99, 58.27, 58.27];
    const leadNotes = [220.00, 0, 261.63, 0, 196.00, 293.66, 220.00, 329.63];
    // Extra arpeggiated high layer
    const arpeggios = [440, 0, 523.25, 392, 0, 659.25, 523.25, 0];

    const tempo        = 135; // BPM
    const stepDuration = 60 / tempo / 2;

    const playStep = () => {
      if (!this.musicPlaying || this.muted || !this.ctx) return;
      const t = this.ctx.currentTime;
      const s = this.musicStep;

      // ── Bass
      const bassFreq = bassline[s % bassline.length];
      if (bassFreq > 0) {
        try {
          const osc  = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type   = 'sawtooth';
          osc.frequency.setValueAtTime(bassFreq, t);

          const filt = this.ctx.createBiquadFilter();
          filt.type  = 'lowpass';
          filt.frequency.setValueAtTime(220, t);

          osc.connect(filt); filt.connect(gain); gain.connect(this._musicGain);
          gain.gain.setValueAtTime(this.synthVolume, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + stepDuration * 0.9);
          osc.start(t); osc.stop(t + stepDuration * 0.9);
        } catch (e) {}
      }

      // ── Lead melody
      const leadFreq = leadNotes[s % leadNotes.length];
      if (leadFreq > 0 && Math.random() > 0.25) {
        try {
          const osc  = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type   = 'triangle';
          osc.frequency.setValueAtTime(leadFreq, t);
          osc.connect(gain); gain.connect(this._musicGain);
          gain.gain.setValueAtTime(this.synthVolume * 0.4, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + stepDuration * 1.8);
          osc.start(t); osc.stop(t + stepDuration * 1.8);
        } catch (e) {}
      }

      // ── Arpeggio layer (every 2 steps)
      if (s % 2 === 0) {
        const arpFreq = arpeggios[s % arpeggios.length];
        if (arpFreq > 0 && Math.random() > 0.4) {
          try {
            const osc  = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type   = 'square';
            osc.frequency.setValueAtTime(arpFreq, t);
            osc.connect(gain); gain.connect(this._musicGain);
            gain.gain.setValueAtTime(this.synthVolume * 0.12, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + stepDuration * 0.6);
            osc.start(t); osc.stop(t + stepDuration * 0.6);
          } catch (e) {}
        }
      }

      this.musicStep++;
      this.musicTimer = setTimeout(playStep, stepDuration * 1000);
    };

    playStep();
  }

  stopMusic() {
    this.musicPlaying = false;
    if (this.musicTimer) {
      clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
  }
}

export const audio = new SoundManager();
