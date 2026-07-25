import { audio } from '../utils/audio';

// 🌅 ENVIRONMENT THEMES CONFIG
const THEMES = {
  dawn: {
    name: 'Dawn',
    skyColors: ['#0f051d', '#2c114d', '#ff5e36', '#ffa047'],
    ambientColor: 'rgba(255, 110, 50, 0.08)',
    roadColor: '#181220',
    fogColor: 'rgba(255, 180, 120, 0.12)',
    shadowLength: 2.2,
    hasFog: true
  },
  day: {
    name: 'Day',
    skyColors: ['#0077c2', '#00bfff', '#b3e5fc'],
    ambientColor: 'rgba(255, 255, 255, 0.02)',
    roadColor: '#1b1b2d',
    hasHeatShimmer: true
  },
  sunset: {
    name: 'Sunset',
    skyColors: ['#1a052e', '#4c0f5f', '#ff4500', '#ff8c00'],
    ambientColor: 'rgba(255, 80, 0, 0.08)',
    roadColor: '#20162a',
    cityLights: true
  },
  night: {
    name: 'Night',
    skyColors: ['#020208', '#050518', '#0c0c30'],
    ambientColor: 'rgba(12, 12, 48, 0.2)',
    roadColor: '#0b0b18',
    glowIntensity: 1.5,
    neonCity: true
  },
  rain: {
    name: 'Rain',
    skyColors: ['#181c26', '#2d3748', '#4a5568'],
    ambientColor: 'rgba(100, 110, 150, 0.12)',
    roadColor: '#14141d',
    isWet: true,
    hasRain: true,
    lightning: true
  },
  storm: {
    name: 'Storm',
    skyColors: ['#0a0b10', '#121420', '#202430'],
    ambientColor: 'rgba(50, 55, 80, 0.18)',
    roadColor: '#0e0e14',
    isWet: true,
    hasRain: true,
    lightning: true,
    heavyStorm: true
  }
};

// 🛣️ PROCEDURAL HIGHWAY ZONES
const HIGHWAY_ZONES = ['city', 'bridge', 'tunnel', 'forest', 'desert'];

export class GameLoop {
  constructor(canvas, carConfig, options) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.carConfig = carConfig;
    this.options = options;

    // Canvas resolution
    this.width = canvas.width;
    this.height = canvas.height;

    // Road Dimensions & Layout
    this.roadLeft = 55;
    this.roadRight = this.width - 55;
    this.roadWidth = this.roadRight - this.roadLeft;
    this.lanesCount = 4;
    this.laneWidth = this.roadWidth / this.lanesCount;
    this.roadScrollY = 0;

    // Initialize Theme
    const selectedTheme = options.theme || 'night';
    this.theme = THEMES[selectedTheme] || THEMES.night;

    // Upgrades
    const speedLvl = this.options.carUpgrades?.speed || 1;
    const handlingLvl = this.options.carUpgrades?.handling || 1;

    // Base physics metrics
    this.baseSpeed = 12; // increased for more noticeable movement
    this.currentSpeed = this.baseSpeed;
    // Adjust maxNormalSpeed proportionally to baseSpeed
    this.maxNormalSpeed = (24 + (carConfig.speed / 100) * 8) * (1 + (speedLvl - 1) * 0.08);
    this.handlingFactor = (0.07 + (carConfig.handling / 100) * 0.07) * (1 + (handlingLvl - 1) * 0.10);

    // Gameplay Core
    this.distance = 0;
    this.score = 0;
    this.coins = 0;
    this.lives = (carConfig.id === 'sentinel' || carConfig.id === 'cybertruck') ? 4 : 3;
    this.fuel = 100;
    this.nitro = 25;
    this.invulnerableTime = 0;
    this.isBoosting = false;
    this.isBraking = false;

    // Levels & Combos
    this.level = parseInt(localStorage.getItem('dipin_level') || '1', 10);
    this.xp = parseInt(localStorage.getItem('dipin_xp') || '0', 10);
    this.combo = 1;
    this.comboTimer = 0;
    this.driftScore = 0;
    this.driftAccumulator = 0;

    // Player Sizing & Positioning
    this.playerWidth = carConfig.id === 'sentinel' ? 52 : (carConfig.id === 'cybertruck' ? 50 : (carConfig.id === 'lightcycle' ? 26 : 42));
    this.playerHeight = carConfig.id === 'sentinel' ? 88 : (carConfig.id === 'cybertruck' ? 86 : (carConfig.id === 'lightcycle' ? 72 : 78));
    this.playerLane = 1.5;
    this.playerX = this.getLaneCenterX(this.playerLane) - this.playerWidth / 2;
    this.playerY = this.height - 120;

    // Power-up States
    this.shieldActive = carConfig.id === 'cruiser';
    this.shieldTimer = carConfig.id === 'cruiser' ? 999999 : 0;
    this.magnetActive = false;
    this.magnetTimer = 0;

    // ── PERFORMANCE: OFFSCREEN CANVAS FOR PARALLAX BACKGROUNDS
    this.bgCanvas = document.createElement('canvas');
    this.bgCanvas.width = this.width;
    this.bgCanvas.height = 140;
    this.bgCtx = this.bgCanvas.getContext('2d');
    this.bgCacheDirty = true;

    // Procedural elements arrays
    this.traffic = [];
    this.items = [];
    this.scenery = [];
    this.gantries = [];
    this.roadRipples = [];
    this.skidMarks = [];

    // ── PERFORMANCE: OBJECT POOLING FOR PARTICLES & FLOATING TEXTS
    this.maxParticles = 180;
    this.particles = Array.from({ length: this.maxParticles }, () => ({
      active: false, x: 0, y: 0, vx: 0, vy: 0, size: 0, color: '', alpha: 0, glow: false, life: 0, maxLife: 0
    }));

    this.maxFloatingTexts = 15;
    this.floatingTexts = Array.from({ length: this.maxFloatingTexts }, () => ({
      active: false, x: 0, y: 0, text: '', color: '', alpha: 0, age: 0
    }));

    this.maxRainDrops = 60;
    this.rainDrops = Array.from({ length: this.maxRainDrops }, () => ({
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      speed: 15 + Math.random() * 8,
      length: 10 + Math.random() * 6
    }));

    // Timers & visual states
    this.trafficSpawnTimer = 0;
    this.itemSpawnTimer = 0;
    this.lightningAlpha = 0;
    this.sirenFlashState = 0;
    this.steerAngle = 0;
    this.bodyRoll = 0;
    this.warpScale = 1.0;
    this.sparkTimer = 0;
    this.shakeIntensity = 0;

    // Load static arrays
    this.initScenery();
    this.initGantries();

    // Trigger Ambient Audio
    if (this.theme.hasRain) {
      audio.startRain();
    }
    if (this.theme.neonCity || this.theme.cityLights) {
      audio.startCity();
    }
  }

  getLaneCenterX(laneIndex) {
    return this.roadLeft + laneIndex * this.laneWidth + this.laneWidth / 2;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // INIT ELEMENTS
  // ───────────────────────────────────────────────────────────────────────────

  initScenery() {
    this.scenery = [];
    for (let i = 0; i < 7; i++) {
      const isLeft = i % 2 === 0;
      const w = 35 + Math.random() * 15;
      const h = 50 + Math.random() * 80;
      const x = isLeft ? 5 + Math.random() * 15 : this.width - w - 5 - Math.random() * 15;
      const y = (i * 120) + Math.random() * 30;

      const billboards = ['GRID', 'SPEED', 'DIPIN', 'XP', 'DATA', 'SYSTEM', 'RUN'];
      const signText = Math.random() > 0.55 ? billboards[Math.floor(Math.random() * billboards.length)] : null;

      this.scenery.push({
        x, y, width: w, height: h, isLeft,
        color: `hsl(${260 + Math.random() * 65}, 50%, ${8 + Math.random() * 10}%)`,
        lightColor: Math.random() > 0.5 ? 'var(--Dipin-cyan)' : 'var(--Dipin-pink)',
        signText,
        bouncePhase: Math.random() * Math.PI
      });
    }
  }

  initGantries() {
    this.gantries = [];
    for (let i = 0; i < 2; i++) {
      this.gantries.push(this.createGantry(-i * 450 - 250));
    }
  }

  createGantry(startY) {
    const colors = ['#00f0ff', '#ff007f', '#9d4edd', '#39ff14'];
    const labels = ['GRID ACCESS', 'VELOCITY ZONE', 'DATA NODE', 'SYS ONLINE', 'RUN'];
    return {
      y: startY !== undefined ? startY : -80,
      color: colors[Math.floor(Math.random() * colors.length)],
      label: Math.random() > 0.4 ? labels[Math.floor(Math.random() * labels.length)] : null
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // OBJECT POOL SPAWNERS
  // ───────────────────────────────────────────────────────────────────────────

  spawnParticle(x, y, vx, vy, size, color, glow = false, life = 0.5) {
    const p = this.particles.find(part => !part.active);
    if (!p) return;
    p.active = true;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.size = size;
    p.color = color;
    p.glow = glow;
    p.life = life;
    p.maxLife = life;
    p.alpha = 1.0;
  }

  spawnFloatingText(x, y, text, color) {
    const ft = this.floatingTexts.find(f => !f.active);
    if (!ft) return;
    ft.active = true;
    ft.x = x;
    ft.y = y;
    ft.text = text;
    ft.color = color;
    ft.alpha = 1.0;
    ft.age = 0;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // UPDATE GAME LOOP
  // ───────────────────────────────────────────────────────────────────────────

  update(keys, deltaTime) {
    if (this.isPaused || this.gameOverTriggered) return;

    this.sirenFlashState = (this.sirenFlashState + 1) % 20;

    // 🏎️ Camera shake decay
    if (this.shakeIntensity > 0) {
      this.shakeIntensity -= deltaTime * 8;
    }

    // 🌧️ Rain / Lightning triggers
    if (this.theme.lightning) {
      if (this.lightningAlpha > 0) {
        this.lightningAlpha -= deltaTime * 3.5;
      } else if (Math.random() < (this.theme.heavyStorm ? 0.005 : 0.002)) {
        this.lightningAlpha = 0.85;
        this.shakeIntensity = 3.0;
        audio.playThunder();
      }
    }

    // 🛡️ Power-ups
    if (this.shieldTimer > 0 && this.carConfig.id !== 'cruiser') {
      this.shieldTimer -= deltaTime;
      if (this.shieldTimer <= 0) {
        this.shieldActive = false;
        this.options.onShieldUpdate(false);
      }
    }
    if (this.magnetTimer > 0) {
      this.magnetTimer -= deltaTime;
      if (this.magnetTimer <= 0) {
        this.magnetActive = false;
        this.options.onMagnetUpdate(false);
      }
    }

    // Combo timer decay
    if (this.comboTimer > 0) {
      this.comboTimer -= deltaTime;
      if (this.comboTimer <= 0) {
        this.combo = 1;
        this.options.onComboUpdate(this.combo);
      }
    }

    // ⚡ Invulnerability
    if (this.invulnerableTime > 0) {
      this.invulnerableTime -= deltaTime;
    }

    // ⛽ Fuel Consumption (Sentinel vehicle perk: drains fuel 25% slower)
    const decayFactor = this.carConfig.id === 'sentinel' ? 0.75 : 1.0;
    const consumption = 0.05 * (this.currentSpeed / this.baseSpeed) * decayFactor;
    this.fuel = Math.max(0, this.fuel - consumption);
    this.options.onFuelUpdate(this.fuel);

    if (this.fuel <= 0) {
      this.currentSpeed = Math.max(0.4, this.currentSpeed - deltaTime * 8);
      if (this.currentSpeed <= 0.5) {
        this.triggerGameOver();
        return;
      }
    }

    // 🎮 Controls & Boosting
    const isBraking = (keys['ArrowDown'] || keys['s'] || keys['S']) && this.currentSpeed > 0;
    this.isBraking = isBraking;
    const isBoosting = (keys[' '] || keys['Shift']) && this.nitro > 0 && this.fuel > 0 && !isBraking;
    this.isBoosting = isBoosting;

    const demonPerk = this.carConfig.id === 'demon' ? 1.5 : 1.0;

    if (isBoosting) {
      if (Math.floor(this.nitro) % 20 === 0) {
        audio.playNitro();
      }
      this.nitro = Math.max(0, this.nitro - deltaTime * 20);
      this.currentSpeed = Math.min(this.maxNormalSpeed * 1.65, this.currentSpeed + deltaTime * 22);
      this.spawnBoostParticles();
    } else if (isBraking) {
      this.nitro = Math.min(100, this.nitro + deltaTime * 6 * demonPerk);
      this.currentSpeed = Math.max(this.baseSpeed * 0.4, this.currentSpeed - deltaTime * 30);
      this.spawnBrakeParticles();
    } else {
      this.nitro = Math.min(100, this.nitro + deltaTime * 12 * demonPerk);
      const targetSpeed = this.baseSpeed + Math.min(6, this.score / 3500);
      if (this.currentSpeed > this.maxNormalSpeed) {
        this.currentSpeed -= deltaTime * 12;
      } else if (this.currentSpeed < targetSpeed) {
        this.currentSpeed += deltaTime * 3;
      }
    }

    this.options.onNitroUpdate(this.nitro);
    const speedRatio = this.currentSpeed / (this.maxNormalSpeed * 1.65);
    this.options.onSpeedUpdate(speedRatio);
    audio.updateEnginePitch(speedRatio);

    // ⚙️ Handling
    let curHandling = this.handlingFactor;
    if (this.carConfig.id === 'gt' && isBoosting) {
      curHandling *= 1.15; // Apex GT perk: steer +15% inside nitro warp
    }

    let targetSteer = 0;
    let targetRoll = 0;
    let steeringActive = false;

    if (keys['ArrowLeft'] || keys['a'] || keys['A']) {
      this.playerLane = Math.max(0.06, this.playerLane - curHandling * deltaTime * 60);
      targetSteer = -0.3;
      targetRoll = -0.05;
      steeringActive = true;
    }
    if (keys['ArrowRight'] || keys['d'] || keys['D']) {
      this.playerLane = Math.min(this.lanesCount - 1.06, this.playerLane + curHandling * deltaTime * 60);
      targetSteer = 0.3;
      targetRoll = 0.05;
      steeringActive = true;
    }

    this.steerAngle += (targetSteer - this.steerAngle) * 0.2;
    this.bodyRoll += (targetRoll - this.bodyRoll) * 0.16;
    this.playerX = this.getLaneCenterX(this.playerLane) - this.playerWidth / 2;

    // 🏁 Drift Mechanic
    if (steeringActive && this.currentSpeed > this.baseSpeed * 1.2) {
      const addedDrift = Math.round(this.currentSpeed * 0.8);
      this.driftAccumulator += addedDrift;
      if (this.driftAccumulator >= 180) {
        this.driftScore += 10;
        this.driftAccumulator = 0;
        this.score += 5;
        this.options.onScoreUpdate(this.score);
        this.spawnParticle(
          this.playerX + (targetSteer < 0 ? this.playerWidth : 0),
          this.playerY + this.playerHeight - 8,
          -targetSteer * 4 + (Math.random() - 0.5) * 2,
          1 + Math.random() * 2,
          2.0, '#00ffff', true, 0.35
        );
      }
    }

    // 🗺️ Procedural Highway Progress & Segments
    this.distance += this.currentSpeed * deltaTime * 8;
    const segmentIndex = Math.floor(this.distance / 1800) % HIGHWAY_ZONES.length;
    this.currentSegment = HIGHWAY_ZONES[segmentIndex];

    // Scroll road surface
    this.roadScrollY = (this.roadScrollY + this.currentSpeed) % 80;

    // Spawning & Updates
    this.spawnElements(deltaTime);
    this.updateScenery();
    this.updateParticles(deltaTime);
    this.updateFloatingTexts(deltaTime);
    this.updateElements(deltaTime);
    this.updateGantries(deltaTime);

    if (this.theme.hasRain) {
      this.updateRain(deltaTime);
      this.updateRipples(deltaTime);
    }

    // Score Distance update
    if (this.fuel > 0) {
      this.score += Math.round(this.currentSpeed * 0.12);
      this.options.onScoreUpdate(this.score);

      // Level Progression
      const nextLevelXp = this.level * 1800;
      if (this.xp >= nextLevelXp) {
        this.level++;
        this.xp = 0;
        localStorage.setItem('dipin_level', this.level.toString());
        audio.playLevelUp();
        this.spawnFloatingText(this.playerX + this.playerWidth / 2, this.playerY - 40, `LEVEL UP: ${this.level}`, '#39ff14');
        this.triggerXPNotify();
      }
    }

    // Boost warp zoom interpolation
    const warpTarget = this.isBoosting ? 1.04 : 1.0;
    this.warpScale += (warpTarget - this.warpScale) * 0.08;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // DRAW ELEMENTS
  // ───────────────────────────────────────────────────────────────────────────

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // Nitro Zoom Transform
    if (Math.abs(this.warpScale - 1.0) > 0.001) {
      ctx.save();
      ctx.translate(this.width / 2, this.height / 2);
      ctx.scale(this.warpScale, this.warpScale);
      ctx.translate(-this.width / 2, -this.height / 2);
    }

    // 1. Theme-specific background/sky
    this.drawSky();
    
    // 2. Parallax background elements (Cached offscreen if possible)
    this.drawParallaxBackground();

    // 3. Road asphalt & ripples
    this.drawRoad();
    this.drawRipples();
    this.drawSkidMarks();

    // 4. Side landscape elements
    this.drawScenery();

    // 5. Items and traffic
    this.drawItems();
    this.drawTraffic();
    this.drawParticles();
    this.drawPlayer();

    // 6. Gantries (overlay arches)
    this.drawGantries();

    if (this.magnetActive) {
      this.drawMagnetArcs();
    }

    // 7. Overlays (weather, floating score pings, lightning flashes)
    this.drawFloatingTexts();
    if (this.theme.hasRain) {
      this.drawRain();
    }
    if (this.lightningAlpha > 0) {
      ctx.fillStyle = `rgba(240, 245, 255, ${this.lightningAlpha})`;
      ctx.fillRect(0, 0, this.width, this.height);
    }

    // Reset transform
    if (Math.abs(this.warpScale - 1.0) > 0.001) {
      ctx.restore();
    }

    // 8. Visual warp speed lines (Screen edge)
    if (this.isBoosting) {
      this.drawSpeedLines();
    }

    // Ambient Lighting Overlay
    this.drawAmbientLighting();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // DETAILED DRAWING HELPERS
  // ───────────────────────────────────────────────────────────────────────────

  drawSky() {
    const ctx = this.ctx;
    const skyGrad = ctx.createLinearGradient(0, 0, 0, 140);
    const colors = this.theme.skyColors;
    
    skyGrad.addColorStop(0, colors[0]);
    skyGrad.addColorStop(0.4, colors[1] || colors[0]);
    skyGrad.addColorStop(1, colors[2] || colors[1] || colors[0]);

    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, this.width, 140);

    // Dawn / Sunset clouds or sun silhouette
    if (this.options.theme === 'dawn' || this.options.theme === 'sunset') {
      ctx.fillStyle = this.options.theme === 'dawn' ? 'rgba(255, 94, 54, 0.25)' : 'rgba(255, 69, 0, 0.2)';
      ctx.beginPath();
      ctx.arc(this.width / 2, 130, 50, 0, Math.PI, true);
      ctx.fill();
    }
  }

  drawParallaxBackground() {
    const ctx = this.ctx;

    // Redraw offscreen background cache only if dirty
    if (this.bgCacheDirty) {
      const bCtx = this.bgCtx;
      bCtx.clearRect(0, 0, this.width, 140);

      const offset = (this.distance * 0.1) % 180;

      if (this.currentSegment === 'forest') {
        // Pine trees / Mountains outline
        bCtx.fillStyle = '#060f14';
        bCtx.beginPath();
        bCtx.moveTo(0, 140);
        bCtx.lineTo(60, 60);
        bCtx.lineTo(130, 140);
        bCtx.lineTo(220, 45);
        bCtx.lineTo(310, 140);
        bCtx.lineTo(380, 75);
        bCtx.lineTo(this.width, 140);
        bCtx.fill();
      } else if (this.currentSegment === 'desert') {
        // Dune slopes
        bCtx.fillStyle = '#1c1510';
        bCtx.beginPath();
        bCtx.ellipse(80, 140, 150, 60, 0, 0, Math.PI, true);
        bCtx.ellipse(320, 140, 200, 75, 0, 0, Math.PI, true);
        bCtx.fill();
      } else {
        // Skyscrapers cityscape background
        bCtx.fillStyle = '#090812';
        for (let i = 0; i < 9; i++) {
          const sx = (i * 55 - offset + this.width) % (this.width + 60) - 40;
          const sh = 60 + ((i * 17) % 55);
          bCtx.fillRect(sx, 140 - sh, 45, sh);

          // Tiny yellow skyline window lines
          bCtx.fillStyle = 'rgba(255, 230, 100, 0.15)';
          for (let wy = 140 - sh + 8; wy < 130; wy += 12) {
            bCtx.fillRect(sx + 10, wy, 4, 3);
            bCtx.fillRect(sx + 28, wy, 4, 3);
          }
          bCtx.fillStyle = '#090812';
        }
      }
      this.bgCacheDirty = false;
    }

    ctx.drawImage(this.bgCanvas, 0, 0);

    // Make cache dirty to update building scroll phase
    if (this.currentSegment === 'city' || this.currentSegment === 'bridge') {
      this.bgCacheDirty = true;
    }
  }

  drawRoad() {
    const ctx = this.ctx;
    
    // Road border shoulders base colors
    ctx.fillStyle = '#04040a';
    ctx.fillRect(0, 140, this.width, this.height - 140);

    // Draw asphalt surface gradient
    const roadGrad = ctx.createLinearGradient(this.width / 2, 140, this.width / 2, this.height);
    roadGrad.addColorStop(0, '#10101f');
    roadGrad.addColorStop(0.6, this.theme.roadColor);
    roadGrad.addColorStop(1, '#080812');
    ctx.fillStyle = roadGrad;
    ctx.fillRect(this.roadLeft, 140, this.roadWidth, this.height - 140);

    // Wet road specular reflection sheens
    if (this.theme.isWet) {
      ctx.fillStyle = 'rgba(174, 219, 255, 0.05)';
      ctx.fillRect(this.roadLeft, 140, this.roadWidth, this.height - 140);

      // Reflective lanes mirror sheen
      const wetGrad = ctx.createLinearGradient(0, 140, 0, this.height);
      wetGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
      wetGrad.addColorStop(0.7, 'rgba(0, 240, 255, 0.04)');
      wetGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = wetGrad;
      ctx.fillRect(this.roadLeft + 10, 140, this.roadWidth - 20, this.height - 140);
    }

    // Road borders / guard rails
    ctx.fillStyle = 'var(--Dipin-pink)';
    if (this.currentSegment === 'bridge') {
      // Draw bridge truss barriers
      ctx.strokeStyle = '#9d4edd';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let y = 140; y < this.height; y += 40) {
        const py = (y + this.roadScrollY) % (this.height - 140) + 140;
        ctx.moveTo(this.roadLeft - 6, py);
        ctx.lineTo(this.roadLeft, py + 20);
        ctx.lineTo(this.roadLeft - 6, py + 40);
        
        ctx.moveTo(this.roadRight + 6, py);
        ctx.lineTo(this.roadRight, py + 20);
        ctx.lineTo(this.roadRight + 6, py + 40);
      }
      ctx.stroke();
    } else if (this.currentSegment === 'tunnel') {
      // Dark walls
      ctx.fillStyle = '#06060f';
      ctx.fillRect(0, 140, this.roadLeft - 4, this.height - 140);
      ctx.fillRect(this.roadRight + 4, 140, this.width - this.roadRight - 4, this.height - 140);

      // Yellow stripe light strips
      ctx.fillStyle = '#ff8800';
      ctx.fillRect(this.roadLeft - 8, 140, 3, this.height - 140);
      ctx.fillRect(this.roadRight + 5, 140, 3, this.height - 140);
    } else {
      // Normal Neon borders
      ctx.save();
      ctx.shadowBlur = 8;
      ctx.shadowColor = 'var(--Dipin-pink)';
      ctx.fillRect(this.roadLeft - 3, 140, 3, this.height - 140);
      ctx.fillRect(this.roadRight, 140, 3, this.height - 140);
      ctx.restore();
    }

    // Lane dashes
    ctx.strokeStyle = this.theme.neonCity ? 'rgba(0, 240, 255, 0.35)' : 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([25, 35]);
    for (let i = 1; i < this.lanesCount; i++) {
      const lx = this.roadLeft + i * this.laneWidth;
      ctx.beginPath();
      ctx.moveTo(lx, this.roadScrollY + 140 - 80);
      ctx.lineTo(lx, this.height + 80);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  drawPlayer() {
    if (this.invulnerableTime > 0 && Math.floor(Date.now() / 85) % 2 === 0) {
      return;
    }

    const x = this.playerX;
    const y = this.playerY;
    const w = this.playerWidth;
    const h = this.playerHeight;
    const color = this.carConfig.color;
    const id = this.carConfig.id;
    const ctx = this.ctx;

    const cx = x + w / 2;
    const cy = y + h / 2;

    ctx.save();

    // ── Suspension bounce animation
    const bounceOffset = Math.sin(Date.now() * 0.015) * 1.5;
    
    // Underglow lighting
    const glowScale = 0.9 + Math.sin(Date.now() * 0.02) * 0.1;
    const underGlow = ctx.createRadialGradient(cx, cy, w * 0.3, cx, cy, h * 0.85);
    underGlow.addColorStop(0, `${color}60`);
    underGlow.addColorStop(0.5, `${color}15`);
    underGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = underGlow;
    ctx.beginPath();
    ctx.ellipse(cx, cy + bounceOffset, w * 0.9, h * 0.55 * glowScale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ground shadows
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + h * 0.42, w * 0.6, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Translate to local vehicle coordinates with roll tilt applied
    ctx.translate(cx, cy + bounceOffset);
    ctx.rotate(this.bodyRoll);

    // Draw wheels (except hovering Phantom)
    if (id !== 'phantom') {
      const wheelW = id === 'sentinel' ? 8 : 6.5;
      const wheelH = id === 'sentinel' ? 17 : 14;

      // Front Wheels (Steering tilt)
      ctx.save();
      ctx.translate(-w / 2 + 3, -h / 2 + 18);
      ctx.rotate(this.steerAngle);
      this.drawWheelSprite(wheelW, wheelH, color);
      ctx.restore();

      ctx.save();
      ctx.translate(w / 2 - 3, -h / 2 + 18);
      ctx.rotate(this.steerAngle);
      this.drawWheelSprite(wheelW, wheelH, color);
      ctx.restore();

      // Rear Wheels
      ctx.save();
      ctx.translate(-w / 2 + 3, h / 2 - 18);
      this.drawWheelSprite(wheelW, wheelH, color);
      ctx.restore();

      ctx.save();
      ctx.translate(w / 2 - 3, h / 2 - 18);
      this.drawWheelSprite(wheelW, wheelH, color);
      ctx.restore();
    }

    // Detailed Windows/Chassis Bodies
    if (id === 'roadster') {
      // Roadster cyberpunk vector shell
      ctx.fillStyle = '#0b0c16';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -h / 2);
      ctx.lineTo(w / 2, h / 2 - 10);
      ctx.lineTo(-w / 2, h / 2 - 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Glass windshield
      const winGrad = ctx.createLinearGradient(0, -h / 6, 0, h / 8);
      winGrad.addColorStop(0, 'rgba(0, 240, 255, 0.7)');
      winGrad.addColorStop(1, 'rgba(0, 80, 120, 0.2)');
      ctx.fillStyle = winGrad;
      ctx.beginPath();
      ctx.moveTo(0, -h / 6);
      ctx.lineTo(w / 3.5, h / 9);
      ctx.lineTo(-w / 3.5, h / 9);
      ctx.closePath();
      ctx.fill();

    } else if (id === 'cruiser') {
      // Patrol tank racer
      ctx.fillStyle = '#110b20';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w, h, 8);
      ctx.fill();
      ctx.stroke();

      // Windshield
      ctx.fillStyle = 'rgba(157, 78, 221, 0.55)';
      ctx.fillRect(-w / 3.2, -h / 6, w / 1.6, h / 7);

    } else if (id === 'gt') {
      // Apex Drift GT
      ctx.fillStyle = '#1c0c05';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2 + 2, w, h - 4, 6);
      ctx.fill();
      ctx.stroke();

      // Spoiler wing
      ctx.fillStyle = '#0f0502';
      ctx.fillRect(-w / 2 - 2, h / 2 - 8, w + 4, 3);
      
      // Windshield
      ctx.fillStyle = 'rgba(255, 136, 0, 0.45)';
      ctx.fillRect(-w / 3.4, -h / 8, w / 1.7, h / 8);

    } else if (id === 'police') {
      // Interceptor patrol
      ctx.fillStyle = '#090a10';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w, h, 8);
      ctx.fill();
      ctx.stroke();

      // White panel decals
      ctx.fillStyle = '#ebeefc';
      ctx.fillRect(-w / 3.5, -h / 4, w / 1.75, h / 3.5);

      // Flashing Siren Bar
      const sirenColor = this.sirenFlashState < 10 ? '#ff0055' : '#00aaff';
      ctx.fillStyle = sirenColor;
      ctx.shadowColor = sirenColor;
      ctx.shadowBlur = 10;
      ctx.fillRect(-10, -3, 20, 5);
      ctx.shadowBlur = 0;

    } else if (id === 'cobra') {
      // Muscle charger
      ctx.fillStyle = '#1c040e';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w, h, 4);
      ctx.fill();
      ctx.stroke();

      // Dual racing stripes
      ctx.fillStyle = '#fff';
      ctx.fillRect(-5, -h / 2, 2, h);
      ctx.fillRect(3, -h / 2, 2, h);

    } else if (id === 'demon') {
      // Jet prototype
      ctx.fillStyle = '#18040d';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(0, -h / 2);
      ctx.lineTo(w / 2 - 2, -h / 5);
      ctx.lineTo(w / 2, h / 2 - 5);
      ctx.lineTo(-w / 2, h / 2 - 5);
      ctx.lineTo(-w / 2 + 2, -h / 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Exhaust glow
      const exhPulse = 10 + Math.sin(Date.now() * 0.05) * 4;
      ctx.fillStyle = '#ff3c00';
      ctx.shadowColor = '#ff3c00';
      ctx.shadowBlur = exhPulse;
      ctx.fillRect(-5, h / 2 - 6, 10, 8);
      ctx.shadowBlur = 0;

    } else if (id === 'sentinel') {
      // Sentinel Armored Truck
      ctx.fillStyle = '#06160b';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w, h, 6);
      ctx.fill();
      ctx.stroke();

      // Windshield
      ctx.fillStyle = 'rgba(57, 255, 20, 0.4)';
      ctx.fillRect(-w / 2.3, -h / 4, w * 2 / 2.3, h / 9);

    } else if (id === 'phantom') {
      // Hover Phantom
      ctx.fillStyle = '#1f1e24';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Floating particles
      if (Math.random() < 0.15) {
        this.spawnParticle(cx + (Math.random() - 0.5) * w, cy + h / 2, 0, 1 + Math.random() * 2, 1.5, '#00f0ff', true, 0.3);
      }

    } else if (id === 'cybertruck') {
      // Angular cyber alloy
      ctx.fillStyle = '#7a7a7f';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-w / 2, h / 2);
      ctx.lineTo(-w / 2 + 3, -h / 2 + 18);
      ctx.lineTo(-w / 4, -h / 2);
      ctx.lineTo(w / 4, -h / 2);
      ctx.lineTo(w / 2 - 3, -h / 2 + 18);
      ctx.lineTo(w / 2, h / 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // White geometric LED bar
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-w / 4 + 2, -h / 2 + 2, w / 2 - 4, 3);

    } else if (id === 'lightcycle') {
      // Glowing vector cycle
      ctx.fillStyle = '#05180c';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w, h, 12);
      ctx.fill();
      ctx.stroke();

      // Spine laser trail
      ctx.fillStyle = color;
      ctx.fillRect(-1.5, -h / 3, 3, h * 2 / 3);
    }

    // Dynamic Headlights (drawn if night/rain/storm)
    const hlY = -h / 2;
    const hlLeftX = -w / 2 + 7;
    const hlRightX = w / 2 - 7;

    if (this.options.theme === 'night' || this.theme.hasRain) {
      this.drawHeadlightBeam(hlLeftX, hlY, color);
      this.drawHeadlightBeam(hlRightX, hlY, color);
    }

    // Taillights/Brake indicators
    const tlY = h / 2 - 2;
    if (this.isBraking) {
      ctx.fillStyle = '#ff1818';
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur = 12;
      ctx.fillRect(-w / 2 + 4, tlY, 6, 3);
      ctx.fillRect(w / 2 - 10, tlY, 6, 3);
    } else {
      ctx.fillStyle = '#aa0808';
      ctx.fillRect(-w / 2 + 4, tlY, 5, 2.5);
      ctx.fillRect(w / 2 - 9, tlY, 5, 2.5);
    }
    ctx.shadowBlur = 0;

    // Nitro Rocket Boost Flames
    if (this.isBoosting) {
      const scale = 0.8 + Math.sin(Date.now() * 0.08) * 0.2;
      const flameH = (12 + Math.random() * 16) * scale;
      const flameGrad = ctx.createLinearGradient(0, h / 2, 0, h / 2 + flameH);
      flameGrad.addColorStop(0, '#ffffdd');
      flameGrad.addColorStop(0.3, '#ffaa00');
      flameGrad.addColorStop(1, 'rgba(255, 0, 80, 0)');
      
      ctx.fillStyle = flameGrad;
      ctx.beginPath();
      ctx.moveTo(-5, h / 2);
      ctx.lineTo(5, h / 2);
      ctx.lineTo(0, h / 2 + flameH);
      ctx.closePath();
      ctx.fill();
    }

    // Active power-up visuals
    if (this.shieldActive) {
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.8)';
      ctx.shadowColor = 'rgba(0, 240, 255, 0.4)';
      ctx.shadowBlur = 16;
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.arc(0, 0, h * 0.65, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  drawWheelSprite(w, h, accentColor) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = '#111115';
    ctx.fillRect(-w / 2, -h / 2, w, h);
    
    // Tire tread stripes (representing animation spin)
    ctx.fillStyle = '#22222a';
    const offset = Math.floor(this.distance * 0.2) % 4;
    for (let y = -h / 2 + offset; y < h / 2; y += 4) {
      ctx.fillRect(-w / 2, y, w, 1);
    }

    // Rims
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, w / 2.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawHeadlightBeam(lx, ly, color) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    
    const beamLength = 180;
    const beamWidth = 55;
    const grad = ctx.createLinearGradient(lx, ly, lx, ly - beamLength);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
    grad.addColorStop(0.3, `${color}20`);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(lx - beamWidth / 2, ly - beamLength);
    ctx.lineTo(lx + beamWidth / 2, ly - beamLength);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawSkidMarks() {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.lineWidth = 3.5;
    this.skidMarks.forEach(sm => {
      ctx.globalAlpha = Math.max(0, sm.life / sm.maxLife) * 0.45;
      ctx.beginPath();
      ctx.moveTo(sm.x1, sm.y1);
      ctx.lineTo(sm.x2, sm.y2);
      ctx.stroke();
    });
    ctx.restore();
  }

  drawTraffic() {
    this.traffic.forEach(car => {
      const ctx = this.ctx;
      const cx = car.x + car.width / 2;
      const cy = car.y + car.height / 2;
      const w = car.width;
      const h = car.height;

      ctx.save();

      // Ground shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + h * 0.42, w * 0.55, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Steering angle for lane changers
      let steer = 0;
      if (car.isLaneChanger && car.targetLane !== car.lane) {
        steer = car.targetLane > car.lane ? 0.15 : -0.15;
      }

      ctx.translate(cx, cy);
      ctx.rotate(steer);

      // Wheels
      ctx.fillStyle = '#15151b';
      ctx.fillRect(-w / 2 + 1, -h / 2 + 12, 5, 11);
      ctx.fillRect(w / 2 - 6, -h / 2 + 12, 5, 11);
      ctx.fillRect(-w / 2 + 1, h / 2 - 20, 5, 11);
      ctx.fillRect(w / 2 - 6, h / 2 - 20, 5, 11);

      // Chassis
      ctx.fillStyle = '#080810';
      ctx.strokeStyle = car.color;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w, h, 5);
      ctx.fill();
      ctx.stroke();

      // Windows
      ctx.fillStyle = 'rgba(100, 150, 220, 0.3)';
      ctx.fillRect(-w / 3, -h / 4, w * 2 / 3, h / 7); // front
      ctx.fillRect(-w / 3, h / 5, w * 2 / 3, h / 10); // back

      // Headlights bulbs & beams
      ctx.fillStyle = '#fffae0';
      ctx.fillRect(-w / 2 + 3, -h / 2, 4, 2);
      ctx.fillRect(w / 2 - 7, -h / 2, 4, 2);

      if (this.options.theme === 'night' || this.theme.hasRain) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const beamGrad = ctx.createLinearGradient(0, -h / 2, 0, -h / 2 - 130);
        beamGrad.addColorStop(0, 'rgba(255, 255, 230, 0.35)');
        beamGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = beamGrad;
        
        ctx.beginPath();
        ctx.moveTo(-w / 2 + 5, -h / 2);
        ctx.lineTo(-w / 2 - 20, -h / 2 - 130);
        ctx.lineTo(-w / 2 + 30, -h / 2 - 130);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(w / 2 - 5, -h / 2);
        ctx.lineTo(w / 2 - 30, -h / 2 - 130);
        ctx.lineTo(w / 2 + 20, -h / 2 - 130);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // Brakelights
      if (car.brakeLightActive) {
        ctx.fillStyle = '#ff003c';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 10;
        ctx.fillRect(-w / 2 + 3, h / 2 - 2, 5, 2);
        ctx.fillRect(w / 2 - 8, h / 2 - 2, 5, 2);
      } else {
        ctx.fillStyle = '#900000';
        ctx.fillRect(-w / 2 + 3, h / 2 - 2, 4, 2);
        ctx.fillRect(w / 2 - 7, h / 2 - 2, 4, 2);
      }

      ctx.restore();
    });
  }

  drawScenery() {
    const ctx = this.ctx;
    this.scenery.forEach(b => {
      ctx.save();

      // Check current segment types
      if (this.currentSegment === 'forest') {
        // Draw green pine tree silhouettes
        ctx.fillStyle = '#061d15';
        ctx.beginPath();
        ctx.moveTo(b.x + b.width / 2, b.y);
        ctx.lineTo(b.x, b.y + b.height);
        ctx.lineTo(b.x + b.width, b.y + b.height);
        ctx.closePath();
        ctx.fill();

        // Trunk
        ctx.fillStyle = '#1c1005';
        ctx.fillRect(b.x + b.width / 2 - 3, b.y + b.height, 6, 8);
      } else if (this.currentSegment === 'desert') {
        // Cacti silhouettes
        ctx.fillStyle = '#1f2510';
        ctx.fillRect(b.x + b.width / 2 - 3, b.y, 6, b.height); // main trunk
        ctx.fillRect(b.x, b.y + b.height * 0.4, b.width, 4); // cross branch
        ctx.fillRect(b.x, b.y + b.height * 0.1, 4, b.height * 0.3); // left arm
        ctx.fillRect(b.x + b.width - 4, b.y + b.height * 0.2, 4, b.height * 0.2); // right arm
      } else if (this.currentSegment === 'bridge') {
        // Suspender cable towers
        ctx.strokeStyle = '#2d2d3a';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(b.isLeft ? this.roadLeft - 8 : this.roadRight + 8, b.y);
        ctx.lineTo(b.isLeft ? this.roadLeft - 8 : this.roadRight + 8, b.y + b.height);
        ctx.stroke();

        // Warning lights
        const blink = Math.sin(Date.now() * 0.01 + b.bouncePhase) > 0;
        if (blink) {
          ctx.fillStyle = '#ff1e1e';
          ctx.shadowBlur = 8;
          ctx.shadowColor = '#ff1e1e';
          ctx.beginPath();
          ctx.arc(b.isLeft ? this.roadLeft - 8 : this.roadRight + 8, b.y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // Neon Skyscraper towers
        ctx.fillStyle = b.color;
        ctx.fillRect(b.x, b.y, b.width, b.height);

        ctx.strokeStyle = b.lightColor;
        ctx.lineWidth = 1.0;
        ctx.strokeRect(b.x, b.y, b.width, b.height);

        // Matrix window light dots
        const rows = Math.floor(b.height / 14);
        const cols = Math.floor(b.width / 10);
        for (let r = 1; r < rows; r++) {
          for (let c = 1; c < cols; c++) {
            const glow = (r * 3 + c * 7 + Math.floor(b.y / 25)) % 4 === 0;
            if (glow) {
              ctx.fillStyle = b.lightColor;
              ctx.fillRect(b.x + c * 9, b.y + r * 13, 2.5, 2.5);
            }
          }
        }
      }

      // Billboard labels
      if (b.signText && this.currentSegment !== 'forest' && this.currentSegment !== 'desert') {
        const sy = b.y + b.height * 0.4;
        ctx.fillStyle = '#06060f';
        ctx.strokeStyle = b.lightColor;
        ctx.lineWidth = 1.2;
        ctx.fillRect(b.isLeft ? b.x - 4 : b.x - 8, sy, b.width + 12, 18);
        ctx.strokeRect(b.isLeft ? b.x - 4 : b.x - 8, sy, b.width + 12, 18);

        ctx.fillStyle = b.lightColor;
        ctx.font = 'bold 8px Orbitron';
        ctx.textAlign = 'center';
        ctx.fillText(b.signText, (b.isLeft ? b.x - 4 : b.x - 8) + (b.width + 12) / 2, sy + 12);
      }

      ctx.restore();
    });
  }

  drawItems() {
    this.items.forEach(item => {
      this.ctx.save();
      this.ctx.shadowColor = item.color;
      this.ctx.shadowBlur = 10;

      if (item.type === 'COIN') {
        const sizeX = 9 + Math.sin(Date.now() * 0.012) * 2;
        this.ctx.strokeStyle = item.color;
        this.ctx.fillStyle = 'rgba(255, 215, 0, 0.15)';
        this.ctx.lineWidth = 2.0;
        this.ctx.beginPath();
        this.ctx.ellipse(item.x, item.y, sizeX, 9, 0, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();

        // Inside emblem
        this.ctx.fillStyle = item.color;
        this.ctx.font = 'bold 8px Inter';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(item.multiplier ? `${item.multiplier}x` : 'C', item.x, item.y + 3);

      } else if (item.type === 'FUEL') {
        this.ctx.strokeStyle = item.color;
        this.ctx.fillStyle = 'rgba(57, 255, 20, 0.15)';
        this.ctx.lineWidth = 2.0;
        this.ctx.beginPath();
        this.ctx.rect(item.x - 9, item.y - 9, 18, 18);
        this.ctx.fill();
        this.ctx.stroke();

        this.ctx.fillStyle = item.color;
        this.ctx.font = '9px Inter';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('F', item.x, item.y + 3.5);

      } else if (item.type === 'SHIELD') {
        this.ctx.strokeStyle = item.color;
        this.ctx.fillStyle = 'rgba(0, 240, 255, 0.2)';
        this.ctx.lineWidth = 2.0;
        this.ctx.beginPath();
        this.ctx.arc(item.x, item.y, 10, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();

      } else if (item.type === 'MAGNET') {
        this.ctx.strokeStyle = item.color;
        this.ctx.fillStyle = 'rgba(157, 78, 221, 0.2)';
        this.ctx.lineWidth = 2.0;
        this.ctx.beginPath();
        this.ctx.arc(item.x, item.y, 10, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();

      } else if (item.type === 'LUCKY') {
        // Rainbow Lucky box
        const luckyPulse = Math.sin(Date.now() * 0.01) * 3;
        this.ctx.shadowColor = '#00ffff';
        this.ctx.shadowBlur = 15;
        this.ctx.fillStyle = '#060614';
        this.ctx.strokeStyle = 'var(--Dipin-cyan)';
        this.ctx.lineWidth = 2.0;
        this.ctx.beginPath();
        this.ctx.rect(item.x - 10, item.y - 10, 20, 20);
        this.ctx.fill();
        this.ctx.stroke();

        this.ctx.fillStyle = '#ff00ff';
        this.ctx.font = 'bold 12px Orbitron';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('?', item.x, item.y + 4.5);
      }
      this.ctx.restore();
    });
  }

  drawParticles() {
    const ctx = this.ctx;
    this.particles.forEach(p => {
      if (!p.active) return;
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = p.glow ? 10 : 0;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  drawRain() {
    const ctx = this.ctx;
    ctx.strokeStyle = this.theme.heavyStorm ? 'rgba(150, 190, 255, 0.4)' : 'rgba(174, 219, 255, 0.25)';
    ctx.lineWidth = 1.0;
    this.rainDrops.forEach(drop => {
      ctx.beginPath();
      ctx.moveTo(drop.x, drop.y);
      ctx.lineTo(drop.x - 2, drop.y + drop.length);
      ctx.stroke();
    });
  }

  drawRipples() {
    const ctx = this.ctx;
    ctx.save();
    this.roadRipples.forEach(rp => {
      ctx.globalAlpha = Math.max(0, rp.life / rp.maxLife) * 0.3;
      ctx.strokeStyle = 'rgba(174, 219, 255, 0.8)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.ellipse(rp.x, rp.y, rp.r, rp.r * 0.4, 0, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.restore();
  }

  drawGantries() {
    const ctx = this.ctx;
    this.gantries.forEach(g => {
      ctx.save();

      const progressY = Math.max(0, Math.min(1, (g.y - 140) / (this.height - 140)));
      if (g.y < 140) {
        ctx.restore();
        return;
      }

      const archHeight = 24 + progressY * 34;
      const alpha = 0.1 + progressY * 0.75;

      ctx.globalAlpha = Math.min(1.0, alpha);
      ctx.strokeStyle = g.color;
      ctx.shadowColor = g.color;
      ctx.shadowBlur = 10 + progressY * 12;
      ctx.lineWidth = 1.5 + progressY * 1.5;

      // Draw pillars
      ctx.beginPath();
      ctx.moveTo(this.roadLeft - 4, g.y + archHeight);
      ctx.lineTo(this.roadLeft - 4, g.y);
      ctx.moveTo(this.roadRight + 4, g.y + archHeight);
      ctx.lineTo(this.roadRight + 4, g.y);
      ctx.stroke();

      // Top crossbar arc
      ctx.beginPath();
      ctx.moveTo(this.roadLeft - 4, g.y);
      ctx.bezierCurveTo(
        this.roadLeft + this.roadWidth * 0.2, g.y - 15 * progressY,
        this.roadRight - this.roadWidth * 0.2, g.y - 15 * progressY,
        this.roadRight + 4, g.y
      );
      ctx.stroke();

      // sign tag text
      if (g.label && progressY > 0.35) {
        const textAlpha = Math.min(1.0, (progressY - 0.35) * 2.5);
        ctx.globalAlpha = textAlpha;
        ctx.font = `bold ${8 + Math.floor(progressY * 5)}px Orbitron`;
        ctx.textAlign = 'center';
        ctx.fillStyle = g.color;
        ctx.fillText(g.label, this.width / 2, g.y + archHeight * 0.5 - 4);
      }

      ctx.restore();
    });
  }

  drawMagnetArcs() {
    const ctx = this.ctx;
    const pcx = this.playerX + this.playerWidth / 2;
    const pcy = this.playerY + this.playerHeight / 2;

    this.items.forEach(item => {
      const attractsThis = item.type === 'COIN' || (this.carConfig.id === 'phantom' && item.type === 'FUEL');
      if (!attractsThis) return;

      const dist = Math.hypot(item.x - pcx, item.y - pcy);
      if (dist > 185) return;

      const alpha = Math.max(0, 1 - dist / 185) * (0.4 + Math.sin(Date.now() * 0.08) * 0.2);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#9d4edd';
      ctx.shadowColor = '#9d4edd';
      ctx.shadowBlur = 8;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.lineDashOffset = -(Date.now() * 0.08) % 8;
      
      ctx.beginPath();
      ctx.moveTo(pcx, pcy);
      ctx.lineTo(item.x, item.y);
      ctx.stroke();
      ctx.restore();
    });
  }

  drawSpeedLines() {
    const ctx = this.ctx;
    ctx.save();
    const count = 12;
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.2;

    for (let i = 0; i < count; i++) {
      const lineLen = 30 + Math.random() * 60;
      const y = 140 + ((Date.now() * 0.3 + i * 85) % (this.height - 140));

      // Left
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(lineLen, y);
      ctx.stroke();

      // Right
      ctx.beginPath();
      ctx.moveTo(this.width, y);
      ctx.lineTo(this.width - lineLen, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawAmbientLighting() {
    const ctx = this.ctx;
    
    // Dawn atmosphere gradient overlay
    if (this.options.theme === 'dawn') {
      const g = ctx.createLinearGradient(0, 140, 0, this.height);
      g.addColorStop(0, 'rgba(255, 94, 54, 0.09)');
      g.addColorStop(1, 'rgba(15, 5, 29, 0.2)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 140, this.width, this.height - 140);
    } else if (this.options.theme === 'sunset') {
      const g = ctx.createLinearGradient(0, 140, 0, this.height);
      g.addColorStop(0, 'rgba(255, 69, 0, 0.12)');
      g.addColorStop(1, 'rgba(26, 0, 48, 0.35)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 140, this.width, this.height - 140);
    } else if (this.options.theme === 'night') {
      // Dark vignetting
      const g = ctx.createRadialGradient(
        this.width / 2, this.height / 2, this.height / 3.5,
        this.width / 2, this.height / 2, this.height
      );
      g.addColorStop(0, 'rgba(5, 5, 22, 0.05)');
      g.addColorStop(1, 'rgba(0, 0, 5, 0.62)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 140, this.width, this.height - 140);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // ELEMENT UPDATE HANDLERS
  // ───────────────────────────────────────────────────────────────────────────

  updateScenery() {
    this.scenery.forEach(b => {
      b.y += this.currentSpeed;
      if (b.y > this.height) {
        b.y = 140 - b.height - 30;
        b.height = 50 + Math.random() * 80;
        b.color = `hsl(${260 + Math.random() * 65}, 50%, ${8 + Math.random() * 10}%)`;
        b.lightColor = Math.random() > 0.5 ? 'var(--Dipin-cyan)' : 'var(--Dipin-pink)';

        const billboards = ['GRID', 'SPEED', 'DIPIN', 'XP', 'DATA', 'SYSTEM', 'RUN'];
        b.signText = Math.random() > 0.55 ? billboards[Math.floor(Math.random() * billboards.length)] : null;
      }
    });
  }

  updateGantries(deltaTime) {
    for (let i = this.gantries.length - 1; i >= 0; i--) {
      this.gantries[i].y += this.currentSpeed * 0.9;
      if (this.gantries[i].y > this.height + 100) {
        this.gantries.splice(i, 1);
      }
    }
    // Spawn new gantries
    if (Math.random() < 0.005 && this.gantries.length < 2) {
      this.gantries.push(this.createGantry(-60));
    }
  }

  updateParticles(deltaTime) {
    this.particles.forEach(p => {
      if (!p.active) return;
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.life -= deltaTime;
      p.alpha = Math.max(0, p.life / p.maxLife);
      if (p.life <= 0) {
        p.active = false;
      }
    });
  }

  updateFloatingTexts(deltaTime) {
    this.floatingTexts.forEach(ft => {
      if (!ft.active) return;
      ft.y -= deltaTime * 40;
      ft.age += deltaTime;
      ft.alpha = Math.max(0, 1 - ft.age / 0.85);
      if (ft.age >= 0.85) {
        ft.active = false;
      }
    });
  }

  updateRain(deltaTime) {
    this.rainDrops.forEach(drop => {
      drop.y += drop.speed;
      if (drop.y > this.height) {
        drop.y = -drop.length;
        drop.x = Math.random() * this.width;
      }
    });
  }

  updateRipples(deltaTime) {
    for (let i = this.roadRipples.length - 1; i >= 0; i--) {
      const rp = this.roadRipples[i];
      rp.r += deltaTime * 24;
      rp.y += this.currentSpeed;
      rp.life -= deltaTime;
      if (rp.life <= 0 || rp.y > this.height) {
        this.roadRipples.splice(i, 1);
      }
    }
    if (Math.random() < (this.theme.heavyStorm ? 0.35 : 0.15)) {
      this.roadRipples.push({
        x: this.roadLeft + Math.random() * this.roadWidth,
        y: 140 + Math.random() * (this.height - 140),
        r: 1,
        maxR: 8 + Math.random() * 8,
        life: 0.45,
        maxLife: 0.45
      });
    }
  }

  spawnElements(deltaTime) {
    this.trafficSpawnTimer += deltaTime;
    this.itemSpawnTimer += deltaTime;

    const spawnDelay = 1.1 - Math.min(0.6, this.currentSpeed / 22);
    if (this.trafficSpawnTimer >= spawnDelay) {
      this.trafficSpawnTimer = 0;
      this.spawnTrafficCar();
    }

    if (this.itemSpawnTimer >= 1.3) {
      this.itemSpawnTimer = 0;
      this.spawnCollectibleItem();
    }
  }

  spawnTrafficCar() {
    const lane = Math.floor(Math.random() * this.lanesCount);
    // Block spawning if path directly blocked
    const pathBlocked = this.traffic.some(tc => tc.lane === lane && tc.y < 120);
    if (pathBlocked) return;

    const w = 38;
    const h = 74;
    const x = this.getLaneCenterX(lane) - w / 2;
    const y = -80;

    const roll = Math.random();
    const isPolice = roll > 0.88;
    const isLaneChanger = roll < 0.2;

    const colors = ['#ff007f', '#9d4edd', '#00f0ff', '#39ff14', '#ff8800'];
    const color = isPolice ? '#0066ff' : colors[Math.floor(Math.random() * colors.length)];

    this.traffic.push({
      lane, x, y, width: w, height: h,
      speed: 2.5 + Math.random() * 2 + (isPolice ? 1.0 : -1.0),
      color,
      isPolice,
      isLaneChanger,
      changeTimer: Math.random() * 3 + 1,
      targetLane: lane,
      brakeLightActive: false
    });
  }

  spawnCollectibleItem() {
    const lane = Math.floor(Math.random() * this.lanesCount);
    const x = this.getLaneCenterX(lane);
    const y = -30;

    const roll = Math.random();
    let type = 'COIN';
    let color = '#ffd700'; // Default gold
    let multiplier = 1;

    if (roll < 0.65) {
      type = 'COIN';
      // ── Gameplay addition: Coin multipliers
      const multRoll = Math.random();
      if (multRoll > 0.88) {
        multiplier = 3;
        color = '#a855f7'; // Purple 3x coin
      } else if (multRoll > 0.7) {
        multiplier = 2;
        color = '#00aaff'; // Blue 2x coin
      }
    } else if (roll < 0.8) {
      type = 'FUEL';
      color = '#39ff14';
    } else if (roll < 0.88) {
      type = 'SHIELD';
      color = '#00ffff';
    } else if (roll < 0.94) {
      type = 'MAGNET';
      color = '#9d4edd';
    } else {
      // ── Gameplay addition: Lucky Mystery Box
      type = 'LUCKY';
      color = '#ffffff';
    }

    const overlap = this.items.some(item => item.lane === lane && Math.abs(item.y - y) < 80);
    if (overlap) return;

    this.items.push({ lane, x, y, type, color, multiplier });
  }

  updateElements(deltaTime) {
    // ── Traffic Vehicles AI & Physics
    for (let i = this.traffic.length - 1; i >= 0; i--) {
      const car = this.traffic[i];
      car.y += (this.currentSpeed - car.speed);

      // AI Overtaking / Braking logic
      const blockAhead = this.traffic.find(tc => tc !== car && tc.lane === car.lane && tc.y < car.y && car.y - tc.y < 120);
      if (blockAhead) {
        car.speed = Math.max(1.0, car.speed - deltaTime * 4.5);
        car.brakeLightActive = true;

        // Try changing lane
        if (car.isLaneChanger && car.changeTimer <= 0) {
          const lFree = car.lane > 0 && !this.traffic.some(tc => tc.lane === car.lane - 1 && Math.abs(tc.y - car.y) < 90);
          const rFree = car.lane < this.lanesCount - 1 && !this.traffic.some(tc => tc.lane === car.lane + 1 && Math.abs(tc.y - car.y) < 90);
          
          if (lFree) {
            car.targetLane = car.lane - 1;
            car.lane = car.lane - 1;
            car.changeTimer = 3.5;
          } else if (rFree) {
            car.targetLane = car.lane + 1;
            car.lane = car.lane + 1;
            car.changeTimer = 3.5;
          }
        }
      } else {
        car.brakeLightActive = false;
      }

      // Smooth horizontal animation toward target lane
      if (car.isLaneChanger) {
        car.changeTimer -= deltaTime;
        const targetX = this.getLaneCenterX(car.targetLane) - car.width / 2;
        car.x += (targetX - car.x) * 0.06;
      }

      // Proximity-based Near Miss bonus
      if (!car.nearMissTriggered && car.y > this.playerY && car.y < this.playerY + 30) {
        const lateralDist = Math.abs((car.x + car.width / 2) - (this.playerX + this.playerWidth / 2));
        if (lateralDist < 66 && lateralDist >= 35) {
          car.nearMissTriggered = true;
          this.triggerNearMiss(car, lateralDist);
        }
      }

      // Collisions
      if (this.checkCollision(this.playerX, this.playerY, this.playerWidth, this.playerHeight, car.x, car.y, car.width, car.height)) {
        this.handleCrash(car, i);
        continue;
      }

      // Remove offscreen
      if (car.y > this.height + 100 || car.y < -150) {
        this.traffic.splice(i, 1);
      }
    }

    // ── Item Pickups & Magnet pulling
    const magnetRange = 180;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.y += this.currentSpeed;

      const attractsThis = item.type === 'COIN' || (this.carConfig.id === 'phantom' && item.type === 'FUEL');

      if (this.magnetActive && attractsThis) {
        const dx = (this.playerX + this.playerWidth / 2) - item.x;
        const dy = (this.playerY + this.playerHeight / 2) - item.y;
        const dist = Math.hypot(dx, dy);

        if (dist < magnetRange) {
          const speed = 15 * (1 - dist / magnetRange);
          item.x += (dx / dist) * speed;
          item.y += (dy / dist) * speed;
        }
      }

      const distPlayer = Math.hypot((this.playerX + this.playerWidth / 2) - item.x, (this.playerY + this.playerHeight / 2) - item.y);
      if (distPlayer < 35) {
        this.handleCollectItem(item);
        this.items.splice(i, 1);
        continue;
      }

      if (item.y > this.height + 60) {
        this.items.splice(i, 1);
      }
    }
  }

  checkCollision(px, py, pw, ph, tx, ty, tw, th) {
    const inset = 3.5;
    return (
      px + inset < tx + tw - inset &&
      px + pw - inset > tx + inset &&
      py + inset < ty + th - inset &&
      py + ph - inset > ty + inset
    );
  }

  handleCrash(car, index) {
    if (this.invulnerableTime > 0) return;

    // Cobra perk: crushes traffic obstacles inside Nitro Boost speed
    if (this.carConfig.id === 'cobra' && this.isBoosting) {
      this.spawnCrashExplosion(car.x + car.width / 2, car.y + car.height / 2, 'var(--Dipin-pink)', 18);
      this.traffic.splice(index, 1);
      
      this.score += 200;
      this.xp += 100;
      this.options.onScoreUpdate(this.score);
      this.shakeIntensity = 2.5;

      audio.playCrash();
      this.spawnFloatingText(car.x + car.width / 2, car.y - 10, '+200 RAM DEMOLISH!', 'var(--Dipin-pink)');
      return;
    }

    // Cybertruck Steel Exoskeleton: hits traffic blocks for 40% fuel depletion instead of losing a life (when fuel is > 40%)
    if (this.carConfig.id === 'cybertruck' && this.fuel > 40) {
      this.fuel = Math.max(0, this.fuel - 40);
      this.options.onFuelUpdate(this.fuel);
      this.spawnCrashExplosion(car.x + car.width / 2, car.y + car.height / 2, '#7a7a7f', 14);
      this.traffic.splice(index, 1);

      audio.playCrash();
      this.shakeIntensity = 2.0;
      this.invulnerableTime = 1.6;
      this.spawnFloatingText(this.playerX + this.playerWidth / 2, this.playerY - 20, '-40% ENERGY SHIELD', '#7a7a7f');
      return;
    }

    if (this.shieldActive) {
      this.shieldActive = false;
      this.shieldTimer = 0;
      this.options.onShieldUpdate(false);
      this.spawnCrashExplosion(car.x + car.width / 2, car.y + car.height / 2, '#00ffff', 15);
      this.traffic.splice(index, 1);
      
      audio.playCrash();
      this.shakeIntensity = 1.5;
      this.invulnerableTime = 1.0;
      this.spawnFloatingText(this.playerX + this.playerWidth / 2, this.playerY - 20, 'SHIELD BROKEN', '#00ffff');
    } else {
      this.lives = Math.max(0, this.lives - 1);
      this.options.onLivesUpdate(this.lives);
      this.shakeIntensity = 4.5;
      this.spawnCrashExplosion(this.playerX + this.playerWidth / 2, this.playerY + 20, '#ff007f', 24);

      if (this.lives <= 0) {
        this.triggerGameOver();
      } else {
        audio.playCrash();
        this.invulnerableTime = 2.0;
        this.traffic.splice(index, 1);
      }
    }
  }

  handleCollectItem(item) {
    if (item.type === 'COIN') {
      audio.playCoin();
      const earnedCoins = item.multiplier || 1;
      this.coins += earnedCoins;
      this.options.onCoinsUpdate(this.coins);

      const addedScore = 50 * earnedCoins;
      this.score += addedScore;
      this.xp += 25 * earnedCoins;
      this.options.onScoreUpdate(this.score);

      const coinColor = item.color;
      this.spawnCollectBurst(item.x, item.y, coinColor);
      this.spawnFloatingText(item.x, item.y - 12, `+${addedScore} DATA`, coinColor);

    } else if (item.type === 'FUEL') {
      audio.playShield();
      this.fuel = Math.min(100, this.fuel + 30);
      this.options.onFuelUpdate(this.fuel);

      this.spawnCollectBurst(item.x, item.y, '#39ff14');
      this.spawnFloatingText(item.x, item.y - 12, '+30% ENERGY', '#39ff14');

    } else if (item.type === 'SHIELD') {
      audio.playShield();
      this.shieldActive = true;
      this.shieldTimer = 9;
      this.options.onShieldUpdate(true);

      this.spawnCollectBurst(item.x, item.y, '#00ffff');
      this.spawnFloatingText(item.x, item.y - 12, 'SHIELD ENGAGED', '#00ffff');

    } else if (item.type === 'MAGNET') {
      audio.playShield();
      this.magnetActive = true;
      const roadsterFactor = this.carConfig.id === 'roadster' ? 1.3 : 1.0;
      this.magnetTimer = 10 * roadsterFactor;
      this.options.onMagnetUpdate(true);

      this.spawnCollectBurst(item.x, item.y, '#9d4edd');
      this.spawnFloatingText(item.x, item.y - 12, 'MAGNET CHARGED', '#9d4edd');

    } else if (item.type === 'LUCKY') {
      // ── Gameplay addition: Mystery Lucky reward box
      audio.playLuckyBox();
      this.spawnCollectBurst(item.x, item.y, '#ffffff');

      const luckyPrizes = ['life', 'nitro', 'supercoins', 'shield'];
      const prize = luckyPrizes[Math.floor(Math.random() * luckyPrizes.length)];

      if (prize === 'life') {
        this.lives = Math.min(4, this.lives + 1);
        this.options.onLivesUpdate(this.lives);
        this.spawnFloatingText(item.x, item.y - 12, '+1 LUCK LIFE!', '#39ff14');
      } else if (prize === 'nitro') {
        this.nitro = 100;
        this.options.onNitroUpdate(this.nitro);
        this.spawnFloatingText(item.x, item.y - 12, 'FULL NITRO WING!', '#00ffff');
      } else if (prize === 'supercoins') {
        this.coins += 10;
        this.options.onCoinsUpdate(this.coins);
        this.score += 500;
        this.options.onScoreUpdate(this.score);
        this.spawnFloatingText(item.x, item.y - 12, 'LUCKY COIN BURST (+10)', '#ffd700');
      } else if (prize === 'shield') {
        this.shieldActive = true;
        this.shieldTimer = 12;
        this.options.onShieldUpdate(true);
        this.spawnFloatingText(item.x, item.y - 12, 'LUCKY SHIELD ACTIVATED', '#ff00ff');
      }
    }
  }

  triggerNearMiss(car, lateralDist) {
    const isMega = lateralDist < 46;
    const basePts = isMega ? 300 : 150;
    
    // Increment combo
    this.combo = Math.min(5, this.combo + 1);
    this.comboTimer = 3.0; // 3 seconds window
    this.options.onComboUpdate(this.combo);

    const bonusPoints = basePts * this.combo;
    this.score += bonusPoints;
    this.xp += Math.round(bonusPoints * 0.5);
    this.options.onScoreUpdate(this.score);

    audio.playCombo(this.combo);
    this.spawnNearMissSparkles(car.x + car.width / 2);

    const txt = isMega ? `MEGA NEAR MISS x${this.combo}` : `NEAR MISS x${this.combo}`;
    this.spawnFloatingText(
      this.playerX + this.playerWidth / 2,
      this.playerY - 25,
      `+${bonusPoints} ${txt}`,
      isMega ? '#ff8800' : '#39ff14'
    );
  }

  triggerGameOver() {
    if (this.gameOverTriggered) return;
    this.gameOverTriggered = true;

    // Persist stats callback triggers
    this.updateStatsAndAchievements();

    this.options.onGameOver(this.score, this.coins);
  }

  updateStatsAndAchievements() {
    try {
      // 1. Update stats in localStorage
      const savedStatsStr = localStorage.getItem('dipin_stats');
      const stats = savedStatsStr ? JSON.parse(savedStatsStr) : {
        totalRuns: 0,
        bestDistance: 0,
        bestSpeed: 0,
        totalCoins: 0,
        totalNearMisses: 0,
        totalDrifts: 0
      };

      stats.totalRuns += 1;
      if (this.score > stats.bestDistance) {
        stats.bestDistance = this.score;
      }
      const topSpeedKmh = Math.round((this.currentSpeed / (this.maxNormalSpeed * 1.65)) * 320);
      if (topSpeedKmh > stats.bestSpeed) {
        stats.bestSpeed = topSpeedKmh;
      }
      stats.totalCoins += this.coins;
      localStorage.setItem('dipin_stats', JSON.stringify(stats));

      // 2. Check achievements
      const savedAchStr = localStorage.getItem('dipin_achievements');
      const achievements = savedAchStr ? JSON.parse(savedAchStr) : {};

      if (stats.totalRuns >= 1) achievements.first_ride = true;
      if (stats.bestSpeed >= 280) achievements.speed_demon = true;
      if (stats.bestDistance >= 5000) achievements.grid_runner = true;
      if (stats.totalCoins >= 200) achievements.coin_hoarder = true;

      localStorage.setItem('dipin_achievements', JSON.stringify(achievements));
    } catch (e) {
      console.warn("Failed saving statistics", e);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PARTICLE GENERATORS
  // ───────────────────────────────────────────────────────────────────────────

  spawnBoostParticles() {
    const py = this.playerY + this.playerHeight;
    const pxL = this.playerX + 8;
    const pxR = this.playerX + this.playerWidth - 8;
    const color = this.carConfig.color;

    for (const tx of [pxL, pxR]) {
      this.spawnParticle(
        tx, py,
        (Math.random() - 0.5) * 1.5,
        5 + Math.random() * 3,
        2.5 + Math.random() * 2,
        color, true, 0.35
      );
    }
  }

  spawnBrakeParticles() {
    const py = this.playerY + this.playerHeight - 16;
    const pxL = this.playerX + 5;
    const pxR = this.playerX + this.playerWidth - 5;

    for (const tx of [pxL, pxR]) {
      if (Math.random() < 0.4) {
        this.spawnParticle(
          tx, py,
          (Math.random() - 0.5) * 1.5,
          1.5 + Math.random() * 1.5,
          2.0 + Math.random() * 2.5,
          'rgba(210, 210, 218, 0.4)', false, 0.4
        );
      }
    }
  }

  spawnCollectBurst(x, y, color) {
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 3.5;
      this.spawnParticle(
        x, y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        1.5 + Math.random() * 1.5,
        color, true, 0.45
      );
    }
  }

  spawnCrashExplosion(x, y, color, count = 20) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 7;
      this.spawnParticle(
        x, y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        2.0 + Math.random() * 3.0,
        color, true, 0.65
      );
    }
  }

  spawnNearMissSparkles(x) {
    const py = this.playerY;
    for (let i = 0; i < 6; i++) {
      this.spawnParticle(
        x + (Math.random() - 0.5) * 35,
        py + (Math.random() - 0.5) * 30,
        (Math.random() - 0.5) * 1.2,
        -1.5 - Math.random() * 1.5,
        1.5, '#39ff14', true, 0.4
      );
    }
  }

  // Reactive state notify levels to React App component
  triggerXPNotify() {
    if (this.options.onLevelUpdate) {
      this.options.onLevelUpdate(this.level, this.xp);
    }
  }
}
