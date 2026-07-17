import { audio } from '../utils/audio';

export class GameLoop {
  constructor(canvas, carConfig, options) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.carConfig = carConfig; // Color, price, perk, etc.
    this.options = options; // weatherMode, timeOfDay, carUpgrades, callbacks

    // Dimensions
    this.width = canvas.width;
    this.height = canvas.height;

    // Road Layout (Margins left and right for scrolling scenery)
    this.roadLeft = 55;
    this.roadRight = this.width - 55;
    this.roadWidth = this.roadRight - this.roadLeft;
    this.lanesCount = 4;
    this.laneWidth = this.roadWidth / this.lanesCount;
    this.roadScrollY = 0;

    // Load upgrade calibrations
    const speedLvl = this.options.carUpgrades?.speed || 1;
    const handlingLvl = this.options.carUpgrades?.handling || 1;

    // Base speed and stats scaling
    this.baseSpeed = 6;
    this.currentSpeed = this.baseSpeed;
    this.maxNormalSpeed = (12 + (carConfig.speed / 100) * 4) * (1 + (speedLvl - 1) * 0.08); 
    this.handlingFactor = (0.07 + (carConfig.handling / 100) * 0.07) * (1 + (handlingLvl - 1) * 0.10);
    
    this.speedRatio = 0;
    this.score = 0;
    this.coins = 0;
    this.lives = (carConfig.id === 'sentinel' || carConfig.id === 'cybertruck') ? 4 : 3; // Sentinel & Cybertruck get 4 lives
    this.fuel = 100;
    this.nitro = 25;
    this.invulnerableTime = 0;
    this.isBoosting = false;

    // Player Positioning
    this.playerWidth = carConfig.id === 'sentinel' ? 52 : (carConfig.id === 'cybertruck' ? 50 : (carConfig.id === 'lightcycle' ? 26 : 42)); 
    this.playerHeight = carConfig.id === 'sentinel' ? 88 : (carConfig.id === 'cybertruck' ? 86 : (carConfig.id === 'lightcycle' ? 72 : 78));
    this.playerLane = 1.5; 
    this.playerX = this.getLaneCenterX(this.playerLane) - this.playerWidth / 2;
    this.playerY = this.height - 120;
    
    // Power-ups State
    this.shieldActive = carConfig.id === 'cruiser'; // Cruiser starting shield perk
    this.shieldTimer = carConfig.id === 'cruiser' ? 999999 : 0;
    this.magnetActive = false;
    this.magnetTimer = 0;
    
    // Scenery & Dynamic Elements Arrays
    this.traffic = [];
    this.items = [];
    this.particles = [];
    this.rainDrops = [];
    this.scenery = [];
    this.floatingTexts = [];
    
    // Timers
    this.trafficSpawnTimer = 0;
    this.itemSpawnTimer = 0;
    this.lightningAlpha = 0;
    this.sirenFlashState = 0;

    this.isPaused = false;
    this.gameOverTriggered = false;

    // Realistic Visuals & Controls State
    this.isBraking = false;
    this.steerAngle = 0;
    this.bodyRoll = 0;
    this.skidMarks = [];
    this.lastSkidLeftX = undefined;
    this.lastSkidLeftY = undefined;
    this.lastSkidRightX = undefined;
    this.lastSkidRightY = undefined;

    // Initialize side scenery & rain
    this.initScenery();
    if (this.options.weatherMode === 'rain') {
      this.initRain();
    }
  }

  getLaneCenterX(laneIndex) {
    return this.roadLeft + laneIndex * this.laneWidth + this.laneWidth / 2;
  }

  initScenery() {
    for (let i = 0; i < 6; i++) {
      const isLeft = i % 2 === 0;
      const w = 35 + Math.random() * 15;
      const h = 50 + Math.random() * 80;
      const x = isLeft ? 5 + Math.random() * 15 : this.width - w - 5 - Math.random() * 15;
      const y = (i * 140) + Math.random() * 40;

      const billboards = ['NEON', 'GRID', 'RUN', 'SYS', 'XP', 'DATA'];
      const signText = Math.random() > 0.6 ? billboards[Math.floor(Math.random() * billboards.length)] : null;

      this.scenery.push({
        x,
        y,
        width: w,
        height: h,
        isLeft,
        color: `hsl(${260 + Math.random() * 60}, 50%, ${10 + Math.random() * 12}%)`,
        lightColor: Math.random() > 0.5 ? 'var(--neon-cyan)' : 'var(--neon-pink)',
        signText
      });
    }
  }

  initRain() {
    this.rainDrops = [];
    for (let i = 0; i < 70; i++) {
      this.rainDrops.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        speed: 16 + Math.random() * 10,
        length: 12 + Math.random() * 8
      });
    }
  }

  // Update loop
  update(keys, deltaTime) {
    if (this.isPaused || this.gameOverTriggered) return;

    this.sirenFlashState = (this.sirenFlashState + 1) % 20;

    // 1. Invulnerable timer
    if (this.invulnerableTime > 0) {
      this.invulnerableTime -= deltaTime;
    }

    // 2. Lightning flash tick
    if (this.options.weatherMode === 'rain') {
      if (this.lightningAlpha > 0) {
        this.lightningAlpha -= deltaTime * 3;
      } else if (Math.random() < 0.003) {
        this.lightningAlpha = 0.75;
        audio.playCrash();
      }
    }

    // 3. Power-up timers
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

    // 4. Fuel depletion logic (Sentinel Heavy Armor loses fuel 25% slower)
    const decayReduction = this.carConfig.id === 'sentinel' ? 0.75 : 1.0;
    const fuelConsumption = 0.05 * (this.currentSpeed / this.baseSpeed) * decayReduction;
    this.fuel = Math.max(0, this.fuel - fuelConsumption);
    this.options.onFuelUpdate(this.fuel);

    if (this.fuel <= 0) {
      this.currentSpeed = Math.max(0.5, this.currentSpeed - 0.1);
      if (this.currentSpeed <= 0.6) {
        this.triggerGameOver();
        return;
      }
    }

    // 5. Nitro Boost handling
    const isBraking = (keys['ArrowDown'] || keys['s'] || keys['S']) && this.currentSpeed > 0;
    this.isBraking = isBraking;

    // You cannot boost while braking
    const isBoosting = (keys[' '] || keys['Shift']) && this.nitro > 0 && this.fuel > 0 && !isBraking;
    this.isBoosting = isBoosting;
    const chargeMultiplier = this.carConfig.id === 'demon' ? 1.5 : 1.0;

    if (isBoosting) {
      if (this.nitro === 100 || this.nitro % 25 === 0) {
        audio.playNitro();
      }
      this.nitro = Math.max(0, this.nitro - 0.5);
      this.currentSpeed = Math.min(this.maxNormalSpeed * 1.7, this.currentSpeed + 0.4);
      this.spawnBoostParticles();
    } else if (isBraking) {
      this.nitro = Math.min(100, this.nitro + 0.04 * chargeMultiplier); // charge slower when braking
      const minSpeed = this.baseSpeed * 0.4;
      this.currentSpeed = Math.max(minSpeed, this.currentSpeed - 0.45); // rapid slowdown
      this.spawnBrakeSmokeParticles();
    } else {
      this.nitro = Math.min(100, this.nitro + 0.08 * chargeMultiplier);
      const targetNormal = this.maxNormalSpeed;
      if (this.currentSpeed > targetNormal) {
        this.currentSpeed -= 0.15;
      } else {
        const scoreBonus = Math.min(4, this.score / 2500);
        const targetSpeed = this.baseSpeed + scoreBonus;
        if (this.currentSpeed < targetSpeed) {
          this.currentSpeed += 0.03;
        } else {
          this.currentSpeed = targetSpeed;
        }
      }
    }
    
    this.options.onNitroUpdate(this.nitro);
    this.options.onSpeedUpdate(this.currentSpeed / (this.maxNormalSpeed * 1.7));
    audio.updateEnginePitch(this.currentSpeed / (this.maxNormalSpeed * 1.7));

    // 6. Steer Left/Right
    let currentHandling = this.handlingFactor;
    // Apply Apex GT tuning drift boost: 15% extra steering responsiveness when boosting nitro
    if (this.carConfig.id === 'gt' && isBoosting) {
      currentHandling *= 1.15;
    }

    let targetSteer = 0;
    let targetRoll = 0;

    if (keys['ArrowLeft'] || keys['a'] || keys['A']) {
      this.playerLane = Math.max(0.08, this.playerLane - currentHandling);
      targetSteer = -0.32;
      targetRoll = -0.045;
    }
    if (keys['ArrowRight'] || keys['d'] || keys['D']) {
      this.playerLane = Math.min(this.lanesCount - 1.08, this.playerLane + currentHandling);
      targetSteer = 0.32;
      targetRoll = 0.045;
    }

    this.steerAngle += (targetSteer - this.steerAngle) * 0.22;
    this.bodyRoll += (targetRoll - this.bodyRoll) * 0.18;

    // Generate skid marks
    const isSkidding = this.isBraking || (Math.abs(this.steerAngle) > 0.22 && this.currentSpeed > this.baseSpeed * 0.8);
    if (isSkidding && this.currentSpeed > 0.8) {
      const leftX = this.playerX + 6;
      const rightX = this.playerX + this.playerWidth - 6;
      const rearY = this.playerY + this.playerHeight - 16;

      if (this.lastSkidLeftX !== undefined) {
        this.skidMarks.push({
          x1: this.lastSkidLeftX,
          y1: this.lastSkidLeftY + this.currentSpeed,
          x2: leftX,
          y2: rearY,
          life: 2.5,
          maxLife: 2.5
        });
        this.skidMarks.push({
          x1: this.lastSkidRightX,
          y1: this.lastSkidRightY + this.currentSpeed,
          x2: rightX,
          y2: rearY,
          life: 2.5,
          maxLife: 2.5
        });
      }
      this.lastSkidLeftX = leftX;
      this.lastSkidLeftY = rearY;
      this.lastSkidRightX = rightX;
      this.lastSkidRightY = rearY;
    } else {
      this.lastSkidLeftX = undefined;
      this.lastSkidLeftY = undefined;
      this.lastSkidRightX = undefined;
      this.lastSkidRightY = undefined;
    }

    // Update skid marks lifecycle
    for (let i = this.skidMarks.length - 1; i >= 0; i--) {
      const sm = this.skidMarks[i];
      sm.y1 += this.currentSpeed;
      sm.y2 += this.currentSpeed;
      sm.life -= deltaTime;
      if (sm.life <= 0 || (sm.y1 > this.height && sm.y2 > this.height)) {
        this.skidMarks.splice(i, 1);
      }
    }

    this.playerX = this.getLaneCenterX(this.playerLane) - this.playerWidth / 2;

    // 7. Scroll lane markers and shoulder buildings
    this.roadScrollY = (this.roadScrollY + this.currentSpeed) % 80;
    this.updateScenery();

    // 8. Update arrays
    this.updateParticles();
    this.updateFloatingTexts(deltaTime);
    if (this.options.weatherMode === 'rain') {
      this.updateRain();
    }

    // 9. Spawner triggers
    this.spawnElements(deltaTime);

    // 10. Physics updates & Collision checking
    this.updateElements(deltaTime);

    // 11. Score tracking
    if (this.fuel > 0) {
      this.score += Math.round(this.currentSpeed / 4);
      this.options.onScoreUpdate(this.score);
    }
  }

  // Draw scene
  draw() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    // 1. Draw road surface
    this.drawRoad();
    this.drawSkidMarks();

    // 2. Draw side skyscrapers & signs
    this.drawScenery();

    // 3. Draw items & vehicles
    this.drawItems();
    this.drawTraffic();
    this.drawParticles();
    this.drawPlayer();

    // 4. Draw overlays (floating texts, rain overlays, lightning flash)
    this.drawFloatingTexts();
    if (this.options.weatherMode === 'rain') {
      this.drawRain();
      if (this.lightningAlpha > 0) {
        this.ctx.fillStyle = `rgba(225, 245, 255, ${this.lightningAlpha})`;
        this.ctx.fillRect(0, 0, this.width, this.height);
      }
    }
    
    this.drawAmbientLighting();
  }

  drawRoad() {
    this.ctx.fillStyle = '#06060f';
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Asphalt grid lines
    this.ctx.strokeStyle = 'rgba(157, 78, 221, 0.04)';
    this.ctx.lineWidth = 1;
    for (let x = this.roadLeft; x <= this.roadRight; x += 40) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.height);
      this.ctx.stroke();
    }

    // Scrolling lane dashes
    this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.25)';
    this.ctx.lineWidth = 3;
    this.ctx.setLineDash([30, 45]);
    for (let i = 1; i < this.lanesCount; i++) {
      const lx = this.roadLeft + i * this.laneWidth;
      this.ctx.beginPath();
      this.ctx.moveTo(lx, this.roadScrollY - 80);
      this.ctx.lineTo(lx, this.height + 80);
      this.ctx.stroke();
    }
    this.ctx.setLineDash([]);

    // Shoulders (lane borders)
    this.ctx.save();
    this.ctx.shadowBlur = 12;
    this.ctx.fillStyle = 'rgba(255, 0, 127, 0.7)'; // neon pink rail borders
    this.ctx.shadowColor = 'rgba(255, 0, 127, 0.4)';
    this.ctx.fillRect(this.roadLeft - 4, 0, 4, this.height);
    this.ctx.fillRect(this.roadRight, 0, 4, this.height);
    this.ctx.restore();
  }

  drawWheelSprite(w, h, accentColor) {
    const ctx = this.ctx;
    ctx.save();
    // Tyre body
    ctx.fillStyle = '#121216';
    ctx.strokeStyle = '#050508';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, 3.5);
    ctx.fill();
    ctx.stroke();

    // Tread lines
    ctx.strokeStyle = '#282830';
    ctx.lineWidth = 0.8;
    for (let y = -h / 2 + 3; y < h / 2; y += 4.5) {
      ctx.beginPath();
      ctx.moveTo(-w / 2, y);
      ctx.lineTo(-w / 2 + 2, y);
      ctx.moveTo(w / 2 - 2, y);
      ctx.lineTo(w / 2, y);
      ctx.stroke();
    }

    // Metallic Rim
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(0, 0, w / 2.6, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  drawHeadlightBeam(lx, ly, color) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const beamLength = 200;
    const beamWidth = 65;
    
    const grad = ctx.createLinearGradient(lx, ly, lx, ly - beamLength);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
    grad.addColorStop(0.18, 'rgba(255, 255, 255, 0.22)');
    grad.addColorStop(0.6, `${color}25`); // transparent accent color
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
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
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

  spawnBrakeSmokeParticles() {
    const pxLeft = this.playerX + 6;
    const pxRight = this.playerX + this.playerWidth - 6;
    const py = this.playerY + this.playerHeight - 16;
    
    for (let tx of [pxLeft, pxRight]) {
      if (Math.random() < 0.4) {
        this.particles.push({
          x: tx,
          y: py,
          vx: (Math.random() - 0.5) * 1.8,
          vy: 1.0 + Math.random() * 1.5,
          size: 2.0 + Math.random() * 3.5,
          color: 'rgba(200, 201, 208, 0.35)',
          glow: false,
          life: 0.45,
          maxLife: 0.45
        });
      }
    }
  }

  drawPlayer() {
    if (this.invulnerableTime > 0 && Math.floor(Date.now() / 80) % 2 === 0) {
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
    
    // Pulsing Underglow on the road
    const pulseFactor = 0.85 + Math.sin(Date.now() / 100) * 0.15;
    const underglowGrad = ctx.createRadialGradient(cx, cy, w * 0.5, cx, cy, h * 0.9);
    underglowGrad.addColorStop(0, `${color}55`);
    underglowGrad.addColorStop(0.5, `${color}18`);
    underglowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = underglowGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, w * 0.95, h * 0.6 * pulseFactor, 0, 0, Math.PI * 2);
    ctx.fill();

    // Now, enter the local space (translated to cx, cy and rotated by bodyRoll)
    ctx.translate(cx, cy);
    ctx.rotate(this.bodyRoll);

    // 1. Draw wheels if not the floating Hyper Phantom or Tron Lightcycle
    if (id !== 'phantom' && id !== 'lightcycle') {
      const wheelWidth = id === 'sentinel' ? 8 : 6.5;
      const wheelHeight = id === 'sentinel' ? 18 : 15;

      // Front wheels steer left/right
      // Front Left
      ctx.save();
      ctx.translate(-w/2 + 2.5, -h/2 + 20);
      ctx.rotate(this.steerAngle);
      this.drawWheelSprite(wheelWidth, wheelHeight, color);
      ctx.restore();

      // Front Right
      ctx.save();
      ctx.translate(w/2 - 2.5, -h/2 + 20);
      ctx.rotate(this.steerAngle);
      this.drawWheelSprite(wheelWidth, wheelHeight, color);
      ctx.restore();

      // Rear wheels remain straight
      // Rear Left
      ctx.save();
      ctx.translate(-w/2 + 2.5, h/2 - 18);
      this.drawWheelSprite(wheelWidth, wheelHeight, color);
      ctx.restore();

      // Rear Right
      ctx.save();
      ctx.translate(w/2 - 2.5, h/2 - 18);
      this.drawWheelSprite(wheelWidth, wheelHeight, color);
      ctx.restore();
    }

    // 2. Draw Chassis shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 10;

    // 3. Draw Chassis body based on car type
    if (id === 'roadster') {
      ctx.fillStyle = '#0a0a14';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -h/2);
      ctx.lineTo(w/2, h/2 - 12);
      ctx.lineTo(-w/2, h/2 - 12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Panel accent line
      ctx.strokeStyle = `${color}88`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -h/2 + 15);
      ctx.lineTo(0, h/2 - 22);
      ctx.stroke();

      // Windshield
      const windshieldGrad = ctx.createLinearGradient(0, -h/6, 0, h/10);
      windshieldGrad.addColorStop(0, 'rgba(0, 240, 255, 0.7)');
      windshieldGrad.addColorStop(1, 'rgba(0, 80, 120, 0.35)');
      ctx.fillStyle = windshieldGrad;
      ctx.beginPath();
      ctx.moveTo(0, -h/6);
      ctx.lineTo(w/3.5, h/10);
      ctx.lineTo(-w/3.5, h/10);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.beginPath();
      ctx.moveTo(-w/4.8, h/10 - 2);
      ctx.lineTo(0, -h/6 + 4);
      ctx.stroke();

      // Rear spoiler
      ctx.fillStyle = '#050508';
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.fillRect(-w/2 - 2, h/2 - 16, w + 4, 4);

    } else if (id === 'cruiser') {
      ctx.fillStyle = '#100a1c';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(-w/2, -h/2 + 2, w, h - 4, 10);
      ctx.fill();
      ctx.stroke();

      // Front push-bumper bars
      ctx.fillStyle = '#22222d';
      ctx.fillRect(-w/3.2, -h/2 - 1, w * 2/3.2, 4);

      // Armored side skirts
      ctx.fillStyle = '#06030b';
      ctx.fillRect(-w/2 - 2, -h/4, 2, h/2);
      ctx.fillRect(w/2, -h/4, 2, h/2);

      // Divided windshield segments
      ctx.fillStyle = 'rgba(157, 78, 221, 0.55)';
      ctx.fillRect(-w/3.2, -h/5, w/1.6, h/8);
      ctx.fillStyle = '#100a1c';
      ctx.fillRect(-1, -h/5, 2, h/8);

      // Spoiler
      ctx.fillStyle = '#181226';
      ctx.fillRect(-w/2 + 6, h/2 - 7, w - 12, 4);

    } else if (id === 'gt') {
      ctx.fillStyle = '#1a0b04';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-w/2, -h/2 + 4, w, h - 8, 7);
      ctx.fill();
      ctx.stroke();

      // Fender flares
      ctx.strokeStyle = `${color}aa`;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-w/2 - 1, -h/2 + 18, 1, 15);
      ctx.strokeRect(w/2, -h/2 + 18, 1, 15);
      ctx.strokeRect(-w/2 - 1, h/2 - 28, 1, 15);
      ctx.strokeRect(w/2, h/2 - 28, 1, 15);

      // Carbon fiber hood details
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(-w/4, -h/2 + 10, w/2, h/4);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 1;
      for (let offset = -w/4 + 2; offset < w/4; offset += 3.5) {
        ctx.beginPath();
        ctx.moveTo(offset, -h/2 + 10);
        ctx.lineTo(offset + 1.8, -h/2 + 10 + h/4);
        ctx.stroke();
      }

      // Windshield
      const gtWinGrad = ctx.createLinearGradient(0, -h/8, 0, h/15);
      gtWinGrad.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
      gtWinGrad.addColorStop(1, 'rgba(255, 87, 34, 0.25)');
      ctx.fillStyle = gtWinGrad;
      ctx.beginPath();
      ctx.roundRect(-w/3.5, -h/8, w/1.75, h/8, 2);
      ctx.fill();

      // Tuning spoiler
      ctx.fillStyle = '#0c0502';
      ctx.fillRect(-w/2 - 3, h/2 - 7, w + 6, 3);
      ctx.fillStyle = color;
      ctx.fillRect(-w/2 - 3, h/2 - 11, 2, 4);
      ctx.fillRect(w/2 + 1, h/2 - 11, 2, 4);

    } else if (id === 'police') {
      ctx.fillStyle = '#080a0f';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.roundRect(-w/2, -h/2 + 4, w, h - 8, 9);
      ctx.fill();
      ctx.stroke();

      // White panel decals
      ctx.fillStyle = '#e6e8f0';
      ctx.beginPath();
      ctx.roundRect(-w/3.5, -h/2 + 8, w/1.75, h/3.5, 4);
      ctx.fill();

      ctx.fillStyle = '#444';
      ctx.fillRect(-w/4, -h/2 - 1, w/2, 4);

      // Windshield
      ctx.fillStyle = 'rgba(255, 215, 0, 0.32)';
      ctx.fillRect(-w/3.2, -h/9, w/1.6, h/9);

      // Sirens
      const isRed = this.sirenFlashState < 10;
      ctx.shadowColor = isRed ? '#ff003c' : '#0066ff';
      ctx.shadowBlur = 15;
      ctx.fillStyle = isRed ? '#ff003c' : '#0066ff';
      ctx.fillRect(-12, -4, 24, 6);
      ctx.shadowBlur = 0;

      // Antennas
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-w/4, h/2 - 8);
      ctx.lineTo(-w/4, h/2 - 20);
      ctx.moveTo(w/4, h/2 - 8);
      ctx.lineTo(w/4, h/2 - 20);
      ctx.stroke();

    } else if (id === 'cobra') {
      ctx.fillStyle = '#1c030d';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(-w/2, -h/2 + 2, w, h - 4, 4);
      ctx.fill();
      ctx.stroke();

      // Double white stripes
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-5, -h/2 + 2, 3, h - 4);
      ctx.fillRect(2, -h/2 + 2, 3, h - 4);

      // Hood scoop
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(-4, -h/4, 8, 12);
      ctx.fillStyle = '#222';
      ctx.fillRect(-2, -h/4 + 2, 4, 8);

      // Windshield
      ctx.fillStyle = 'rgba(233, 30, 99, 0.35)';
      ctx.fillRect(-w/3.2, -h/12, w/1.6, h/9);

      // Low deck spoiler
      ctx.fillStyle = '#111';
      ctx.fillRect(-w/2 + 2, h/2 - 7, w - 4, 3);

    } else if (id === 'demon') {
      ctx.fillStyle = '#16020c';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -h/2);
      ctx.lineTo(w/2 - 3, -h/4);
      ctx.lineTo(w/2, h/2 - 6);
      ctx.lineTo(-w/2, h/2 - 6);
      ctx.lineTo(-w/2 + 3, -h/4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // jet cockpit
      const demonWin = ctx.createRadialGradient(0, -h/8, 1, 0, -h/8, w/3.5);
      demonWin.addColorStop(0, '#ffffff');
      demonWin.addColorStop(0.5, 'rgba(255, 0, 127, 0.85)');
      demonWin.addColorStop(1, 'rgba(10, 2, 6, 0.9)');
      ctx.fillStyle = demonWin;
      ctx.beginPath();
      ctx.ellipse(0, -h/8, w/5, h/8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Reactor engine
      const pulseEngine = Math.sin(Date.now() / 65) * 0.15 + 0.85;
      ctx.shadowColor = '#ff5500';
      ctx.shadowBlur = 12 * pulseEngine;
      ctx.fillStyle = '#ff3300';
      ctx.fillRect(-6, h/4, 12, 10);
      ctx.fillStyle = '#ffff00';
      ctx.fillRect(-3, h/4 + 2, 6, 6);
      ctx.shadowBlur = 0;

    } else if (id === 'sentinel') {
      ctx.fillStyle = '#04140a';
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(-w/2, -h/2, w, h, 6);
      ctx.fill();
      ctx.stroke();

      // front grill
      ctx.fillStyle = '#151515';
      ctx.fillRect(-w/3, -h/2 + 4, w * 2/3, 8);
      ctx.fillStyle = color;
      for (let offset = -w/3 + 3; offset < w/3; offset += 5.5) {
        ctx.fillRect(offset, -h/2 + 5, 2, 6);
      }

      // windshield
      ctx.fillStyle = 'rgba(57, 255, 20, 0.35)';
      ctx.fillRect(-w/2.5, -h/4, w * 2/2.5, h/10);

      // roof searchlights
      ctx.fillStyle = '#333';
      ctx.fillRect(-w/3, -h/4 - 4, 6, 4);
      ctx.fillRect(w/3 - 6, -h/4 - 4, 6, 4);
      ctx.fillStyle = '#fffae0';
      ctx.beginPath();
      ctx.arc(-w/3 + 3, -h/4 - 4, 2.5, 0, Math.PI * 2);
      ctx.arc(w/3 - 3, -h/4 - 4, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // flatbed rear cover
      ctx.fillStyle = '#092412';
      ctx.fillRect(-w/2 + 4, h/8, w - 8, h * 3/8 - 4);

    } else if (id === 'phantom') {
      ctx.fillStyle = '#1c1c22';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, w/2, h/2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Hover pads
      const hoverPulse = 0.85 + Math.sin(Date.now() / 80) * 0.15;
      ctx.save();
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = 10 * hoverPulse;
      ctx.fillStyle = '#00ffff';
      ctx.beginPath();
      ctx.arc(-w/2 + 4.5, -h/3, 4.5, 0, Math.PI * 2);
      ctx.arc(w/2 - 4.5, -h/3, 4.5, 0, Math.PI * 2);
      ctx.arc(-w/2 + 4.5, h/3, 4.5, 0, Math.PI * 2);
      ctx.arc(w/2 - 4.5, h/3, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // canopy
      ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
      ctx.beginPath();
      ctx.ellipse(0, -h/6, w/3.5, h/10, 0, 0, Math.PI * 2);
      ctx.fill();

      // reactor core
      const coreRadius = 7 + Math.sin(Date.now() / 90) * 2.5;
      const coreGrad = ctx.createRadialGradient(0, 5, 1, 0, 5, coreRadius);
      coreGrad.addColorStop(0, '#ffffff');
      coreGrad.addColorStop(0.5, '#00f0ff');
      coreGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = coreGrad;
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(0, 5, coreRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    } else if (id === 'cybertruck') {
      // Angular low-poly stainless steel cybertruck design
      ctx.fillStyle = '#6e7075';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      
      // Draw angular polygon body shape
      ctx.beginPath();
      ctx.moveTo(-w/2, h/2); // back left
      ctx.lineTo(-w/2 + 3, -h/2 + 20); // front side left
      ctx.lineTo(-w/3, -h/2); // nose left
      ctx.lineTo(w/3, -h/2); // nose right
      ctx.lineTo(w/2 - 3, -h/2 + 20); // front side right
      ctx.lineTo(w/2, h/2); // back right
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Sharp geometric panel stripes (e.g. hood angles)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-w/3, -h/2);
      ctx.lineTo(-w/4, -h/4);
      ctx.lineTo(w/4, -h/4);
      ctx.lineTo(w/3, -h/2);
      ctx.stroke();

      // Flat angular windshield
      ctx.fillStyle = 'rgba(200, 220, 240, 0.35)';
      ctx.beginPath();
      ctx.moveTo(-w/2.5, -h/5);
      ctx.lineTo(-w/3, -h/2.8);
      ctx.lineTo(w/3, -h/2.8);
      ctx.lineTo(w/2.5, -h/5);
      ctx.closePath();
      ctx.fill();

      // Lightbar at the front (full width white stripe)
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 10;
      ctx.fillRect(-w/3 + 2, -h/2 + 1, (w * 2/3) - 4, 3);
      ctx.shadowBlur = 0;

      // Heavy wheel wells / armored guards
      ctx.fillStyle = '#1c1d21';
      ctx.fillRect(-w/2 - 1, -h/4, 2, 18);
      ctx.fillRect(w/2 - 1, -h/4, 2, 18);
      ctx.fillRect(-w/2 - 1, h/4, 2, 18);
      ctx.fillRect(w/2 - 1, h/4, 2, 18);

    } else if (id === 'lightcycle') {
      // Streamlined futuristic neon Tron-like motorcycle capsule
      ctx.fillStyle = '#051408';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.2;
      
      // Capsule shape
      ctx.beginPath();
      ctx.roundRect(-w/2, -h/2, w, h, 14);
      ctx.fill();
      ctx.stroke();

      // Center glowing neon spine trail
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -h/2.5);
      ctx.lineTo(0, h/2.5);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Enclosed neon wheel wells
      ctx.fillStyle = '#000000';
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(-w/4, -h/2 + 6, w/2, 18, 4);
      ctx.roundRect(-w/4, h/2 - 24, w/2, 18, 4);
      ctx.fill();
      ctx.stroke();

      // Transparent green glass bubble cabin canopy
      ctx.fillStyle = 'rgba(0, 255, 102, 0.45)';
      ctx.beginPath();
      ctx.ellipse(0, -h/8, w/3.2, h/9, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Draw headlights & light beams
    const hlY = -h/2;
    const hlXLeft = -w/2 + 8;
    const hlXRight = w/2 - 8;

    if (this.options.timeOfDay === 'night' || this.options.weatherMode === 'rain') {
      this.drawHeadlightBeam(hlXLeft, hlY, color);
      this.drawHeadlightBeam(hlXRight, hlY, color);
    }

    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 8;
    ctx.fillRect(hlXLeft - 2.5, hlY, 5, 2.5);
    ctx.fillRect(hlXRight - 2.5, hlY, 5, 2.5);
    ctx.shadowBlur = 0;

    // 5. Draw exhaust pipes and dynamic sparks/particles
    const exhY = h/2;
    const exhXLeft = -w/2 + 9;
    const exhXRight = w/2 - 9;
    ctx.fillStyle = '#555';
    ctx.fillRect(exhXLeft - 1.5, exhY - 3, 3, 4);
    ctx.fillRect(exhXRight - 1.5, exhY - 3, 3, 4);

    // Taillights/Brakelights
    const tlY = h/2 - 1.5;
    const tlWidth = 6;
    const tlHeight = 2.5;

    if (this.isBraking) {
      ctx.fillStyle = '#ff1e1e';
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur = 18;
      ctx.fillRect(-w/2 + 5, tlY - 1, tlWidth, tlHeight);
      ctx.fillRect(w/2 - 5 - tlWidth, tlY - 1, tlWidth, tlHeight);
    } else {
      ctx.fillStyle = '#bb0000';
      ctx.shadowColor = '#bb0000';
      ctx.shadowBlur = 6;
      ctx.fillRect(-w/2 + 5, tlY, tlWidth, tlHeight);
      ctx.fillRect(w/2 - 5 - tlWidth, tlY, tlWidth, tlHeight);
    }
    ctx.shadowBlur = 0;

    // 6. Draw powerup shields & magnets inside rotated context (centered)
    if (this.shieldActive) {
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.85)';
      ctx.shadowColor = 'rgba(0, 240, 255, 0.5)';
      ctx.shadowBlur = 18;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, h / 1.35, 0, Math.PI * 2);
      ctx.stroke();

      const grad = ctx.createRadialGradient(0, 0, w / 2, 0, 0, h / 1.35);
      grad.addColorStop(0, 'rgba(0, 240, 255, 0.0)');
      grad.addColorStop(1, 'rgba(0, 240, 255, 0.15)');
      ctx.fillStyle = grad;
      ctx.fill();
    }

    if (this.magnetActive) {
      ctx.strokeStyle = 'rgba(157, 78, 221, 0.65)';
      ctx.shadowColor = 'rgba(157, 78, 221, 0.45)';
      ctx.shadowBlur = 12;
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.arc(0, 0, h * 1.65, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawScenery() {
    this.scenery.forEach(b => {
      this.ctx.save();
      this.ctx.fillStyle = b.color;
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      this.ctx.fillRect(b.x, b.y, b.width, b.height);
      this.ctx.strokeRect(b.x, b.y, b.width, b.height);

      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      const rows = Math.floor(b.height / 15);
      const cols = Math.floor(b.width / 10);
      for (let r = 1; r < rows; r++) {
        for (let c = 1; c < cols; c++) {
          if ((r + c + Math.round(b.y / 20)) % 3 === 0) {
            this.ctx.fillStyle = b.lightColor;
            this.ctx.globalAlpha = 0.5 + Math.sin(Date.now() / 200 + r) * 0.3;
          } else {
            this.ctx.fillStyle = 'rgba(255,255,255,0.03)';
            this.ctx.globalAlpha = 1.0;
          }
          this.ctx.fillRect(b.x + c * 8, b.y + r * 12, 3, 3);
        }
      }

      if (b.signText) {
        this.ctx.shadowColor = b.lightColor;
        this.ctx.shadowBlur = 10;
        this.ctx.globalAlpha = 0.8 + Math.sin(Date.now() / 150) * 0.15;
        this.ctx.fillStyle = '#020208';
        this.ctx.strokeStyle = b.lightColor;
        this.ctx.lineWidth = 1.5;
        
        const sy = b.y + b.height / 2 - 12;
        const sh = 20;
        const sw = b.width + 12;
        const sx = b.isLeft ? b.x - 4 : b.x - 8;
        
        this.ctx.beginPath();
        this.ctx.rect(sx, sy, sw, sh);
        this.ctx.fill();
        this.ctx.stroke();

        this.ctx.fillStyle = b.lightColor;
        this.ctx.font = 'bold 9px Orbitron';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(b.signText, sx + sw/2, sy + 13);
      }
      this.ctx.restore();
    });
  }

  drawTraffic() {
    this.traffic.forEach(car => {
      const ctx = this.ctx;
      const cx = car.x + car.width / 2;
      const cy = car.y + car.height / 2;
      const w = car.width;
      const h = car.height;

      ctx.save();
      
      // Compute steer/tilt of the traffic car if lane changing
      let steerAngle = 0;
      if (car.isLaneChanger && car.targetLane !== undefined) {
        const dx = (this.getLaneCenterX(car.targetLane) - car.width / 2) - car.x;
        steerAngle = Math.max(-0.25, Math.min(0.25, dx * 0.05));
      }

      // Enter local coordinates
      ctx.translate(cx, cy);

      // Draw wheels
      const wheelW = 5.5;
      const wheelH = 13;
      
      // Front wheels
      ctx.save();
      ctx.translate(-w/2 + 2, -h/2 + 15);
      ctx.rotate(steerAngle);
      ctx.fillStyle = '#1c1c20';
      ctx.fillRect(-wheelW/2, -wheelH/2, wheelW, wheelH);
      ctx.restore();

      ctx.save();
      ctx.translate(w/2 - 2, -h/2 + 15);
      ctx.rotate(steerAngle);
      ctx.fillStyle = '#1c1c20';
      ctx.fillRect(-wheelW/2, -wheelH/2, wheelW, wheelH);
      ctx.restore();

      // Rear wheels
      ctx.fillStyle = '#1c1c20';
      ctx.fillRect(-w/2 + 2 - wheelW/2, h/2 - 15 - wheelH/2, wheelW, wheelH);
      ctx.fillRect(w/2 - 2 - wheelW/2, h/2 - 15 - wheelH/2, wheelW, wheelH);

      // Chassis body shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
      ctx.shadowBlur = 8;

      // Chassis body
      ctx.fillStyle = '#0b0c15';
      ctx.strokeStyle = car.color;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.roundRect(-w/2, -h/2, w, h, 6);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Panel details (grille / hood lines)
      ctx.fillStyle = '#1c1c25';
      ctx.fillRect(-w/3.5, -h/2 + 4, w/1.75, 6); // grille

      // Windshield (rear window is at bottom, front windshield at top)
      ctx.fillStyle = 'rgba(100, 150, 220, 0.4)';
      ctx.fillRect(-w/3.2, -h/4, w/1.6, h/8); // front windshield
      ctx.fillStyle = 'rgba(100, 150, 220, 0.3)';
      ctx.fillRect(-w/3.2, h/4, w/1.6, h/10); // rear window

      // Sirens if police
      if (car.isPolice) {
        const isBlue = this.sirenFlashState < 10;
        ctx.shadowColor = isBlue ? '#0066ff' : '#ff003c';
        ctx.shadowBlur = 12;
        ctx.fillStyle = isBlue ? '#0066ff' : '#ff003c';
        ctx.fillRect(-8, -3, 16, 5);
        ctx.shadowBlur = 0;
      }

      // Dynamic headlights (at the front/top of the car) pointing forward (upwards)
      const hlY = -h / 2;
      const hlXLeft = -w / 2 + 5;
      const hlXRight = w / 2 - 5;

      // Headlight cones
      if (this.options.timeOfDay === 'night' || this.options.weatherMode === 'rain') {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const beamLength = 140;
        const beamWidth = 45;
        const grad = ctx.createLinearGradient(0, hlY, 0, hlY - beamLength);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
        grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.15)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        // Left headlight beam
        ctx.moveTo(hlXLeft, hlY);
        ctx.lineTo(hlXLeft - beamWidth/2, hlY - beamLength);
        ctx.lineTo(hlXLeft + beamWidth/2, hlY - beamLength);
        ctx.closePath();
        ctx.fill();

        // Right headlight beam
        ctx.beginPath();
        ctx.moveTo(hlXRight, hlY);
        ctx.lineTo(hlXRight - beamWidth/2, hlY - beamLength);
        ctx.lineTo(hlXRight + beamWidth/2, hlY - beamLength);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // Headlight bulbs (glow)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(hlXLeft - 1.5, hlY, 3, 2);
      ctx.fillRect(hlXRight - 1.5, hlY, 3, 2);

      // Taillights/Brakelights (at the bottom/rear of the car) pointing backward (downwards)
      const tlY = h / 2 - 2;
      const tlXLeft = -w / 2 + 4;
      const tlXRight = w / 2 - 4 - 5;
      const tlWidth = 5;
      const tlHeight = 2.5;

      // Detect if player is rapidly approaching this car in the same lane
      const latDist = Math.abs(car.x - this.playerX);
      const isPlayerApproaching = latDist < 45 && this.playerY > car.y + h && this.playerY - (car.y + h) < 140;
      
      if (isPlayerApproaching) {
        // Bright glowing brake lights!
        ctx.fillStyle = '#ff1e1e';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 12;
        ctx.fillRect(tlXLeft, tlY, tlWidth, tlHeight);
        ctx.fillRect(tlXRight, tlY, tlWidth, tlHeight);
      } else {
        // Standard tail lights
        ctx.fillStyle = 'rgba(200, 20, 20, 0.8)';
        ctx.fillRect(tlXLeft, tlY, tlWidth, tlHeight);
        ctx.fillRect(tlXRight, tlY, tlWidth, tlHeight);
      }

      ctx.restore();
    });
  }

  drawFloatingTexts() {
    this.ctx.save();
    this.ctx.font = 'bold 10px Orbitron';
    this.ctx.textAlign = 'center';
    
    this.floatingTexts.forEach(t => {
      this.ctx.fillStyle = t.color;
      this.ctx.globalAlpha = t.alpha;
      this.ctx.shadowBlur = 6;
      this.ctx.shadowColor = t.color;
      this.ctx.fillText(t.text, t.x, t.y);
    });
    this.ctx.restore();
  }

  drawItems() {
    this.items.forEach(item => {
      this.ctx.save();
      this.ctx.shadowColor = item.color;
      this.ctx.shadowBlur = 12;

      if (item.type === 'COIN') {
        const radiusX = 10 + Math.sin(Date.now() / 120) * 3;
        this.ctx.strokeStyle = item.color;
        this.ctx.fillStyle = 'rgba(255, 215, 0, 0.15)';
        this.ctx.lineWidth = 2.5;
        this.ctx.beginPath();
        this.ctx.ellipse(item.x, item.y, radiusX, 10, 0, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
      } else if (item.type === 'FUEL') {
        this.ctx.fillStyle = '#061a0b';
        this.ctx.strokeStyle = item.color;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.rect(item.x - 10, item.y - 10, 20, 20);
        this.ctx.fill();
        this.ctx.stroke();

        this.ctx.fillStyle = item.color;
        this.ctx.font = 'bold 11px Inter';
        this.ctx.fillText('F', item.x - 4, item.y + 4);
      } else if (item.type === 'SHIELD') {
        this.ctx.strokeStyle = item.color;
        this.ctx.fillStyle = 'rgba(0, 240, 255, 0.2)';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(item.x, item.y, 11, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
      } else if (item.type === 'MAGNET') {
        this.ctx.strokeStyle = item.color;
        this.ctx.fillStyle = 'rgba(157, 78, 221, 0.2)';
        this.ctx.lineWidth = 2.5;
        this.ctx.beginPath();
        this.ctx.arc(item.x, item.y, 10, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
      }
      this.ctx.restore();
    });
  }

  drawParticles() {
    this.particles.forEach(p => {
      this.ctx.save();
      this.ctx.globalAlpha = p.alpha;
      this.ctx.shadowColor = p.color;
      this.ctx.shadowBlur = p.glow ? 8 : 0;
      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    });
  }

  drawRain() {
    this.ctx.strokeStyle = 'rgba(174, 219, 255, 0.35)';
    this.ctx.lineWidth = 1;
    this.rainDrops.forEach(drop => {
      this.ctx.beginPath();
      this.ctx.moveTo(drop.x, drop.y);
      this.ctx.lineTo(drop.x - 2, drop.y + drop.length);
      this.ctx.stroke();
    });
  }

  drawAmbientLighting() {
    if (this.options.timeOfDay === 'night') {
      const darkGrad = this.ctx.createRadialGradient(
        this.width / 2, this.height / 2, this.height / 3.5,
        this.width / 2, this.height / 2, this.height
      );
      darkGrad.addColorStop(0, 'rgba(5, 5, 22, 0.05)');
      darkGrad.addColorStop(1, 'rgba(0, 0, 5, 0.62)');
      this.ctx.fillStyle = darkGrad;
      this.ctx.fillRect(0, 0, this.width, this.height);
    } else {
      const sunsetGrad = this.ctx.createLinearGradient(0, 0, 0, this.height);
      sunsetGrad.addColorStop(0, 'rgba(255, 75, 45, 0.07)');
      sunsetGrad.addColorStop(0.5, 'rgba(157, 78, 221, 0.04)');
      sunsetGrad.addColorStop(1, 'rgba(0, 0, 10, 0.15)');
      this.ctx.fillStyle = sunsetGrad;
      this.ctx.fillRect(0, 0, this.width, this.height);
    }
  }

  updateScenery() {
    this.scenery.forEach(b => {
      b.y += this.currentSpeed;
      if (b.y > this.height) {
        b.y = -b.height - 40;
        b.height = 50 + Math.random() * 80;
        b.color = `hsl(${260 + Math.random() * 60}, 50%, ${10 + Math.random() * 12}%)`;
        b.lightColor = Math.random() > 0.5 ? 'var(--neon-cyan)' : 'var(--neon-pink)';
        
        const billboards = ['NEON', 'GRID', 'RUN', 'SYS', 'XP', 'DATA'];
        b.signText = Math.random() > 0.6 ? billboards[Math.floor(Math.random() * billboards.length)] : null;
      }
    });
  }

  spawnElements(deltaTime) {
    this.trafficSpawnTimer += deltaTime;
    this.itemSpawnTimer += deltaTime;

    const trafficLimit = 1.0 - Math.min(0.55, this.currentSpeed / 24);
    if (this.trafficSpawnTimer >= trafficLimit) {
      this.trafficSpawnTimer = 0;
      this.spawnTrafficCar();
    }

    if (this.itemSpawnTimer >= 1.2) {
      this.itemSpawnTimer = 0;
      this.spawnCollectibleItem();
    }
  }

  spawnTrafficCar() {
    const lane = Math.floor(Math.random() * this.lanesCount);
    const pathBlocked = this.traffic.some(car => car.lane === lane && car.y < 130);
    if (pathBlocked) return;

    const carWidth = 38;
    const carHeight = 74;
    const x = this.getLaneCenterX(lane) - carWidth / 2;
    const y = -90;

    const roll = Math.random();
    let isLaneChanger = roll < 0.15;
    let isPolice = roll > 0.85;

    let color = 'rgba(255, 0, 127, 0.8)';
    let speedOffset = -2.5;

    if (isPolice) {
      color = 'rgba(0, 100, 255, 0.85)';
      speedOffset = 1.0;
    } else {
      const trafficTypes = [
        { color: 'rgba(255, 0, 127, 0.8)', speedOffset: -3.0 },
        { color: 'rgba(157, 78, 221, 0.8)', speedOffset: -2.0 },
        { color: 'rgba(57, 255, 20, 0.8)', speedOffset: -1.8 },
        { color: 'rgba(255, 215, 0, 0.8)', speedOffset: 2.2 }
      ];
      const spec = trafficTypes[Math.floor(Math.random() * trafficTypes.length)];
      color = spec.color;
      speedOffset = spec.speedOffset;
    }

    this.traffic.push({
      lane,
      x,
      y,
      width: carWidth,
      height: carHeight,
      speed: Math.max(1.2, 2.2 + Math.random() * 2 + speedOffset),
      color,
      isLaneChanger,
      isPolice,
      changeTimer: Math.random() * 3,
      targetLane: lane
    });
  }

  spawnCollectibleItem() {
    const lane = Math.floor(Math.random() * this.lanesCount);
    const x = this.getLaneCenterX(lane);
    const y = -40;

    const roll = Math.random();
    let type = 'COIN';
    let color = 'rgba(255, 215, 0, 0.8)';

    if (roll < 0.65) {
      type = 'COIN';
    } else if (roll < 0.85) {
      type = 'FUEL';
      color = 'rgba(57, 255, 20, 0.95)';
    } else if (roll < 0.92) {
      type = 'SHIELD';
      color = 'rgba(0, 240, 255, 0.95)';
    } else {
      type = 'MAGNET';
      color = 'rgba(157, 78, 221, 0.95)';
    }

    const overlaps = this.items.some(item => Math.abs(item.y - y) < 80 && item.lane === lane);
    if (overlaps) return;

    this.items.push({
      lane,
      x,
      y,
      type,
      color
    });
  }

  updateElements(deltaTime) {
    for (let i = this.traffic.length - 1; i >= 0; i--) {
      const car = this.traffic[i];
      car.y += (this.currentSpeed - car.speed);

      if (car.isLaneChanger) {
        car.changeTimer -= deltaTime;
        if (car.changeTimer <= 0) {
          car.changeTimer = 2 + Math.random() * 3;
          const offset = Math.random() > 0.5 ? 1 : -1;
          const nextLane = Math.max(0, Math.min(this.lanesCount - 1, car.lane + offset));
          
          const laneBlocked = this.traffic.some(tc => tc !== car && tc.lane === nextLane && Math.abs(tc.y - car.y) < 100);
          if (!laneBlocked) {
            car.lane = nextLane;
            car.targetLane = nextLane;
          }
        }

        const targetX = this.getLaneCenterX(car.targetLane) - car.width / 2;
        car.x += (targetX - car.x) * 0.05;
      }

      if (!car.nearMissTriggered && car.y > this.playerY && car.y < this.playerY + 30) {
        const lateralDist = Math.abs((car.x + car.width / 2) - (this.playerX + this.playerWidth / 2));
        if (lateralDist < 70) {
          car.nearMissTriggered = true;
          this.triggerNearMiss(car);
        }
      }

      if (this.checkCollision(this.playerX, this.playerY, this.playerWidth, this.playerHeight, car.x, car.y, car.width, car.height)) {
        this.handleCrash(car, i);
        continue;
      }

      if (car.y > this.height + 100) {
        this.traffic.splice(i, 1);
      }
    }

    const magnetRange = 190;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.y += this.currentSpeed;

      const attractsThis = item.type === 'COIN' || (this.carConfig.id === 'phantom' && item.type === 'FUEL');

      if (this.magnetActive && attractsThis) {
        const dx = (this.playerX + this.playerWidth / 2) - item.x;
        const dy = (this.playerY + this.playerHeight / 2) - item.y;
        const distance = Math.hypot(dx, dy);

        if (distance < magnetRange) {
          const pullSpeed = 14 * (1 - distance / magnetRange);
          item.x += (dx / distance) * pullSpeed;
          item.y += (dy / distance) * pullSpeed;
        }
      }

      const playerCenterX = this.playerX + this.playerWidth / 2;
      const playerCenterY = this.playerY + this.playerHeight / 2;
      const itemDist = Math.hypot(playerCenterX - item.x, playerCenterY - item.y);

      if (itemDist < 35) {
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
    const inset = 4;
    return (
      px + inset < tx + tw - inset &&
      px + pw - inset > tx + inset &&
      py + inset < ty + th - inset &&
      py + ph - inset > ty + inset
    );
  }

  handleCrash(trafficCar, index) {
    if (this.invulnerableTime > 0) return;

    // Cobra "Ram Charger" Perk: during Nitro boost speed, crush traffic and add +200 points
    if (this.carConfig.id === 'cobra' && this.isBoosting) {
      this.spawnCrashExplosion(trafficCar.x + trafficCar.width / 2, trafficCar.y + trafficCar.height / 2, 'rgba(233, 30, 99, 0.95)', 20);
      this.traffic.splice(index, 1);
      
      this.score += 200;
      this.options.onScoreUpdate(this.score);
      audio.playCrash(); 

      this.floatingTexts.push({
        x: trafficCar.x + trafficCar.width / 2,
        y: trafficCar.y - 10,
        text: "+200 RAM DESTROY!",
        color: '#e91e63',
        alpha: 1,
        age: 0
      });

      this.options.onHit(); 
      return;
    }

    // Cybertruck Steel Exoskeleton perk: hits traffic for 40% fuel/energy cell loss instead of losing a life, as long as fuel is above 40%.
    if (this.carConfig.id === 'cybertruck' && this.fuel > 40) {
      this.fuel = Math.max(0, this.fuel - 40);
      this.options.onFuelUpdate(this.fuel);
      this.spawnCrashExplosion(trafficCar.x + trafficCar.width / 2, trafficCar.y + trafficCar.height / 2, 'rgba(161, 161, 170, 0.95)', 15);
      this.traffic.splice(index, 1);
      
      audio.playCrash();
      this.options.onHit();
      this.invulnerableTime = 1.5; 

      this.floatingTexts.push({
        x: this.playerX + this.playerWidth / 2,
        y: this.playerY - 20,
        text: "-40% CELL ABSORPTION",
        color: '#a1a1aa',
        alpha: 1,
        age: 0
      });
      return;
    }

    if (this.shieldActive) {
      this.shieldActive = false;
      this.shieldTimer = 0;
      this.options.onShieldUpdate(false);
      
      this.spawnCrashExplosion(trafficCar.x + trafficCar.width / 2, trafficCar.y + trafficCar.height / 2, 'rgba(0, 240, 255, 0.95)', 15);
      this.traffic.splice(index, 1);
      
      audio.playCrash();
      this.options.onHit();
      this.invulnerableTime = 1.0; 
    } else {
      this.lives = Math.max(0, this.lives - 1);
      this.options.onLivesUpdate(this.lives);
      this.options.onHit();
      
      this.spawnCrashExplosion(this.playerX + this.playerWidth / 2, this.playerY + 20, 'rgba(255, 0, 127, 0.95)', 25);
      
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
      this.coins += 1;
      this.options.onCoinsUpdate(this.coins);
      this.score += 50; 
      
      this.spawnCollectBurst(item.x, item.y, 'rgba(255, 215, 0, 0.95)');
      this.floatingTexts.push({
        x: item.x,
        y: item.y - 10,
        text: "+50 DATA",
        color: 'rgba(255, 215, 0, 1)',
        alpha: 1,
        age: 0
      });
    } else if (item.type === 'FUEL') {
      audio.playShield();
      this.fuel = Math.min(100, this.fuel + 30);
      this.options.onFuelUpdate(this.fuel);
      
      this.spawnCollectBurst(item.x, item.y, 'rgba(57, 255, 20, 0.95)');
      this.floatingTexts.push({
        x: item.x,
        y: item.y - 10,
        text: "+30% CELL",
        color: 'rgba(57, 255, 20, 1)',
        alpha: 1,
        age: 0
      });
    } else if (item.type === 'SHIELD') {
      audio.playShield();
      this.shieldActive = true;
      this.shieldTimer = 8;
      this.options.onShieldUpdate(true);
      
      this.spawnCollectBurst(item.x, item.y, 'rgba(0, 240, 255, 0.95)');
      this.floatingTexts.push({
        x: item.x,
        y: item.y - 10,
        text: "SHIELD ONLINE",
        color: 'rgba(0, 240, 255, 1)',
        alpha: 1,
        age: 0
      });
    } else if (item.type === 'MAGNET') {
      audio.playShield();
      this.magnetActive = true;
      const durationMultiplier = this.carConfig.id === 'roadster' ? 1.3 : 1.0;
      this.magnetTimer = 10 * durationMultiplier;
      this.options.onMagnetUpdate(true);
      
      this.spawnCollectBurst(item.x, item.y, 'rgba(157, 78, 221, 0.95)');
      this.floatingTexts.push({
        x: item.x,
        y: item.y - 10,
        text: "MAGNET ACTIVE",
        color: 'rgba(157, 78, 221, 1)',
        alpha: 1,
        age: 0
      });
    }
  }

  triggerNearMiss(trafficCar) {
    this.score += 150;
    audio.playClick();
    this.options.onScoreUpdate(this.score);
    this.spawnNearMissSparkles();

    this.floatingTexts.push({
      x: this.playerX + this.playerWidth / 2,
      y: this.playerY - 20,
      text: "+150 NEAR MISS!",
      color: 'rgba(57, 255, 20, 1)',
      alpha: 1,
      age: 0
    });
  }

  triggerGameOver() {
    if (this.gameOverTriggered) return;
    this.gameOverTriggered = true;
    this.options.onGameOver(this.score, this.coins);
  }

  updateRain() {
    this.rainDrops.forEach(drop => {
      drop.y += drop.speed;
      if (drop.y > this.height) {
        drop.y = -drop.length;
        drop.x = Math.random() * this.width;
        if (Math.random() > 0.85) {
          this.particles.push({
            x: drop.x,
            y: this.height - 20 - Math.random() * 200,
            vx: 0,
            vy: 0,
            size: 1,
            color: 'rgba(174, 219, 255, 0.3)',
            alpha: 0.8,
            life: 0.2,
            maxLife: 0.2
          });
        }
      }
    });
  }

  updateParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.95;
      p.vy *= 0.95;
      p.life -= 0.016;
      p.alpha = Math.max(0, p.life / p.maxLife);
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  updateFloatingTexts(deltaTime) {
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const t = this.floatingTexts[i];
      t.y -= 1.5;
      t.age += deltaTime;
      t.alpha = Math.max(0, 1.0 - t.age / 0.8);

      if (t.age >= 0.8) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  spawnBoostParticles() {
    const pxLeft = this.playerX + 8;
    const pxRight = this.playerX + this.playerWidth - 8;
    const py = this.playerY + this.playerHeight;
    const carColor = this.carConfig.color;

    for (let pipeX of [pxLeft, pxRight]) {
      this.particles.push({
        x: pipeX,
        y: py,
        vx: (Math.random() - 0.5) * 1.5,
        vy: 5 + Math.random() * 3,
        size: 2.5 + Math.random() * 2,
        color: carColor,
        glow: true,
        life: 0.35,
        maxLife: 0.35
      });
    }
  }

  spawnCollectBurst(x, y, color) {
    for (let i = 0; i < 15; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 4;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 1.5 + Math.random() * 2,
        color,
        glow: true,
        life: 0.5,
        maxLife: 0.5
      });
    }
  }

  spawnCrashExplosion(x, y, color, count = 20) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 8;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2 + Math.random() * 3,
        color,
        glow: true,
        life: 0.7,
        maxLife: 0.7
      });
    }
  }

  spawnNearMissSparkles() {
    const px = this.playerX + this.playerWidth / 2;
    const py = this.playerY;
    
    for (let i = 0; i < 8; i++) {
      this.particles.push({
        x: px + (Math.random() - 0.5) * 40,
        y: py + (Math.random() - 0.5) * 40,
        vx: (Math.random() - 0.5) * 1.0,
        vy: -2 - Math.random() * 2,
        size: 1.5,
        color: 'rgba(57, 255, 20, 0.95)',
        glow: true,
        life: 0.4,
        maxLife: 0.4
      });
    }
  }
}
