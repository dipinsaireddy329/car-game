class SoundManager {
  constructor() {
    this.ctx = null;
    this.muted = false;
    
    // Nodes for engine hum
    this.engineOsc = null;
    this.engineGain = null;

    // Music loop variables
    this.musicTimer = null;
    this.musicStep = 0;
    this.musicPlaying = false;
    
    // Base synth config
    this.synthVolume = 0.08;
    this.sfxVolume = 0.15;
  }

  init() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    this.ctx = new AudioContextClass();
    
    // Resume context if suspended (browser autoplay policy)
    if (this.ctx.state === 'suspended') {
      const resume = () => {
        this.ctx.resume();
        window.removeEventListener('click', resume);
        window.removeEventListener('keydown', resume);
      };
      window.addEventListener('click', resume);
      window.addEventListener('keydown', resume);
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.muted) {
      this.stopEngine();
      this.stopMusic();
    } else {
      this.init();
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }
    return this.muted;
  }

  // Engine hum sound (adjusts frequency to match car speed ratio 0.0 - 1.0)
  startEngine() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    if (this.engineOsc) {
      this.stopEngine();
    }

    try {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.setValueAtTime(65, this.ctx.currentTime); // Low C

      // A biquad filter to make it sound less harsh (muffle the high frequencies)
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(180, this.ctx.currentTime);

      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.setValueAtTime(0.04, this.ctx.currentTime);

      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);
      
      this.engineOsc.start();
    } catch (e) {
      console.warn("Failed to start engine audio", e);
    }
  }

  updateEnginePitch(speedRatio) {
    if (this.muted || !this.ctx || !this.engineOsc) return;
    try {
      // Scale frequency from 50Hz to 180Hz based on speed
      const targetFreq = 50 + (speedRatio * 130);
      this.engineOsc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.1);
      // Volume slightly increases with speed
      const targetGain = 0.03 + (speedRatio * 0.03);
      this.engineGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.1);
    } catch (e) {
      // Safe fallback
    }
  }

  stopEngine() {
    if (this.engineOsc) {
      try {
        this.engineOsc.stop();
      } catch (e) {}
      this.engineOsc = null;
    }
    this.engineGain = null;
  }

  // SFX: Coin collected
  playCoin() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.connect(gain);
      gain.connect(this.ctx.destination);

      const t = this.ctx.currentTime;
      // Double beep effect
      osc.frequency.setValueAtTime(523.25, t); // C5
      osc.frequency.setValueAtTime(659.25, t + 0.08); // E5
      
      gain.gain.setValueAtTime(this.sfxVolume, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

      osc.start(t);
      osc.stop(t + 0.25);
    } catch (e) {}
  }

  // SFX: Crash / Explosion (using generated white noise)
  playCrash() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const t = this.ctx.currentTime;
      const bufferSize = this.ctx.sampleRate * 0.5; // 0.5 seconds
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, t);
      filter.frequency.exponentialRampToValueAtTime(80, t + 0.45);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(this.sfxVolume * 1.5, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.48);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start(t);
      noise.stop(t + 0.5);

      // Low frequency synth boom to give rumble
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(100, t);
      osc.frequency.exponentialRampToValueAtTime(30, t + 0.4);
      oscGain.gain.setValueAtTime(this.sfxVolume * 1.2, t);
      oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.connect(oscGain);
      oscGain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    } catch (e) {}
  }

  // SFX: Nitro activation whoosh
  playNitro() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const t = this.ctx.currentTime;
      const duration = 0.4;
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.setValueAtTime(3, t);
      filter.frequency.setValueAtTime(400, t);
      filter.frequency.exponentialRampToValueAtTime(2500, t + duration);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(this.sfxVolume * 0.8, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start(t);
      noise.stop(t + duration);
    } catch (e) {}
  }

  // SFX: Shield activate sound
  playShield() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.connect(gain);
      gain.connect(this.ctx.destination);

      const t = this.ctx.currentTime;
      osc.frequency.setValueAtTime(220, t);
      osc.frequency.exponentialRampToValueAtTime(880, t + 0.35);

      gain.gain.setValueAtTime(this.sfxVolume, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

      osc.start(t);
      osc.stop(t + 0.35);
    } catch (e) {}
  }

  // SFX: Simple UI click sound
  playClick() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.connect(gain);
      gain.connect(this.ctx.destination);

      const t = this.ctx.currentTime;
      osc.frequency.setValueAtTime(600, t);
      gain.gain.setValueAtTime(this.sfxVolume * 0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

      osc.start(t);
      osc.stop(t + 0.05);
    } catch (e) {}
  }

  // Procedural retro cyberpunk arpeggiator soundtrack
  startMusic() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    if (this.musicPlaying) return;

    this.musicPlaying = true;
    this.musicStep = 0;
    
    // Notes for retro bass loop (A minor: A, C, G, D)
    const bassline = [55.00, 55.00, 65.41, 65.41, 48.99, 48.99, 58.27, 58.27];
    // Synth Lead notes that trigger occasionally for melody
    const leadNotes = [220.00, 0, 261.63, 0, 196.00, 293.66, 220.00, 329.63];

    const tempo = 135; // BPM
    const stepDuration = 60 / tempo / 2; // Eighth notes

    const playStep = () => {
      if (!this.musicPlaying || this.muted || !this.ctx) return;
      const t = this.ctx.currentTime;

      // Play bass note
      const bassFreq = bassline[this.musicStep % bassline.length];
      if (bassFreq > 0) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(bassFreq, t);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(220, t);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        gain.gain.setValueAtTime(this.synthVolume, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + stepDuration * 0.9);

        osc.start(t);
        osc.stop(t + stepDuration * 0.9);
      }

      // Play melody note occasionally (every step but with rest representation)
      const leadFreq = leadNotes[this.musicStep % leadNotes.length];
      if (leadFreq > 0 && Math.random() > 0.3) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(leadFreq, t);

        // Echo/Delay effect simulation via light release
        gain.gain.setValueAtTime(this.synthVolume * 0.4, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + stepDuration * 1.8);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(t);
        osc.stop(t + stepDuration * 1.8);
      }

      this.musicStep++;
      
      // Schedule next step
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
