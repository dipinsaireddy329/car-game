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
    this.lives = carConfig.id === 'sentinel' ? 4 : 3; // Sentinel gets 4 lives
    this.fuel = 100;
    this.nitro = 25;
    this.invulnerableTime = 0;
    this.isBoosting = false;

    // Player Positioning
    this.playerWidth = carConfig.id === 'sentinel' ? 52 : 42; 
    this.playerHeight = carConfig.id === 'sentinel' ? 88 : 78;
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
    const isBoosting = (keys[' '] || keys['Shift']) && this.nitro > 0 && this.fuel > 0;
    this.isBoosting = isBoosting;
    const chargeMultiplier = this.carConfig.id === 'demon' ? 1.5 : 1.0;

    if (isBoosting) {
      if (this.nitro === 100 || this.nitro % 25 === 0) {
        audio.playNitro();
      }
      this.nitro = Math.max(0, this.nitro - 0.5);
      this.currentSpeed = Math.min(this.maxNormalSpeed * 1.7, this.currentSpeed + 0.4);
      this.spawnBoostParticles();
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

    if (keys['ArrowLeft'] || keys['a'] || keys['A']) {
      this.playerLane = Math.max(0.08, this.playerLane - currentHandling);
    }
    if (keys['ArrowRight'] || keys['d'] || keys['D']) {
      this.playerLane = Math.min(this.lanesCount - 1.08, this.playerLane + currentHandling);
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

  // Draw 8 completely unique cyberpunk and street car graphics
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

    this.ctx.save();
    this.ctx.shadowColor = color;
    this.ctx.shadowBlur = 15;

    if (id === 'roadster') {
      this.ctx.fillStyle = '#0f0f24';
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.moveTo(x + w/2, y);
      this.ctx.lineTo(x + w, y + h);
      this.ctx.lineTo(x, y + h);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();

      this.ctx.fillStyle = color;
      this.ctx.fillRect(x - 2, y + h - 25, 4, 20);
      this.ctx.fillRect(x + w - 2, y + h - 25, 4, 20);

      this.ctx.fillStyle = 'rgba(0, 240, 255, 0.45)';
      this.ctx.beginPath();
      this.ctx.moveTo(x + w/2, y + 25);
      this.ctx.lineTo(x + w - 10, y + h - 20);
      this.ctx.lineTo(x + 10, y + h - 20);
      this.ctx.closePath();
      this.ctx.fill();

    } else if (id === 'cruiser') {
      this.ctx.fillStyle = '#120c1f';
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 2.5;
      this.ctx.beginPath();
      this.ctx.roundRect(x, y, w, h, 10);
      this.ctx.fill();
      this.ctx.stroke();

      this.ctx.fillStyle = '#080512';
      this.ctx.fillRect(x - 3, y + 15, 3, h - 30);
      this.ctx.fillRect(x + w, y + 15, 3, h - 30);

      this.ctx.fillStyle = color;
      this.ctx.fillRect(x + 8, y + h - 6, w - 16, 3);

      this.ctx.fillStyle = 'rgba(157, 78, 221, 0.4)';
      this.ctx.fillRect(x + 6, y + 25, w - 12, 14);

    } else if (id === 'gt') {
      // Apex GT: Orange tuner with side skirts, headlights, spoiler
      this.ctx.fillStyle = '#1f0d06';
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.roundRect(x, y + 4, w, h - 8, 6);
      this.ctx.fill();
      this.ctx.stroke();

      // Street neon underglow
      this.ctx.shadowBlur = 20;
      this.ctx.fillStyle = 'rgba(255, 87, 34, 0.6)';
      this.ctx.fillRect(x - 4, y + 20, 4, h - 40);
      this.ctx.fillRect(x + w, y + 20, 4, h - 40);

      // Tuner spoiler
      this.ctx.fillStyle = '#111';
      this.ctx.fillRect(x - 4, y + h - 6, w + 8, 4);
      this.ctx.fillStyle = color;
      this.ctx.fillRect(x - 4, y + h - 8, 2, 4);
      this.ctx.fillRect(x + w + 2, y + h - 8, 2, 4);

      // Cockpit window
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      this.ctx.fillRect(x + 5, y + 22, w - 10, 16);

    } else if (id === 'police') {
      this.ctx.fillStyle = '#0a0d14';
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.roundRect(x, y + 4, w, h - 8, 8);
      this.ctx.fill();
      this.ctx.stroke();

      const isRed = this.sirenFlashState < 10;
      this.ctx.shadowBlur = 18;
      this.ctx.shadowColor = isRed ? '#ff003c' : '#0066ff';
      this.ctx.fillStyle = isRed ? '#ff003c' : '#0066ff';
      this.ctx.fillRect(x + w/2 - 12, y + h/2 - 6, 24, 6);

      this.ctx.fillStyle = 'rgba(255, 215, 0, 0.4)';
      this.ctx.beginPath();
      this.ctx.arc(x + w/2, y + 18, 5, 0, Math.PI*2);
      this.ctx.fill();

    } else if (id === 'cobra') {
      // Carbon Cobra: Pink muscle car with double white stripes down hood
      this.ctx.fillStyle = '#1c030d';
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 2.5;
      this.ctx.beginPath();
      this.ctx.roundRect(x, y + 2, w, h - 4, 4);
      this.ctx.fill();
      this.ctx.stroke();

      // Double racing stripes (white)
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillRect(x + w/2 - 6, y + 2, 3, h - 6);
      this.ctx.fillRect(x + w/2 + 3, y + 2, 3, h - 6);

      // Cowl hood scoop induction
      this.ctx.fillStyle = '#000000';
      this.ctx.fillRect(x + w/2 - 4, y + 24, 8, 12);

      // Windshield
      this.ctx.fillStyle = 'rgba(233, 30, 99, 0.3)';
      this.ctx.fillRect(x + 5, y + 36, w - 10, 12);

    } else if (id === 'demon') {
      this.ctx.fillStyle = '#1c030f';
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.moveTo(x + w/2, y);
      this.ctx.lineTo(x + w - 4, y + 35);
      this.ctx.lineTo(x + w - 1, y + h - 8);
      this.ctx.lineTo(x + 1, y + h - 8);
      this.ctx.lineTo(x + 4, y + 35);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();

      this.ctx.fillStyle = color;
      this.ctx.fillRect(x - 5, y + h - 18, 6, 15);
      this.ctx.fillRect(x + w - 1, y + h - 18, 6, 15);

      this.ctx.fillStyle = '#ff6600';
      this.ctx.fillRect(x + w/2 - 5, y + h - 5, 10, 4);

    } else if (id === 'sentinel') {
      this.ctx.fillStyle = '#061a0b';
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.roundRect(x, y, w, h, 6);
      this.ctx.fill();
      this.ctx.stroke();

      this.ctx.fillStyle = '#111';
      this.ctx.fillRect(x - 2, y, w + 4, 8);
      this.ctx.fillRect(x - 2, y + h - 8, w + 4, 8);

      this.ctx.fillStyle = color;
      this.ctx.fillRect(x + 10, y + 16, w - 20, 4);
      this.ctx.fillRect(x + 10, y + 24, w - 20, 4);

    } else if (id === 'phantom') {
      this.ctx.fillStyle = '#1d1d1f';
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.ellipse(x + w/2, y + h/2, w/2, h/2, 0, 0, Math.PI*2);
      this.ctx.fill();
      this.ctx.stroke();

      const coreR = 5 + Math.sin(Date.now() / 100) * 2;
      this.ctx.fillStyle = '#fff';
      this.ctx.shadowBlur = 15;
      this.ctx.shadowColor = '#fff';
      this.ctx.beginPath();
      this.ctx.arc(x + w/2, y + h/2 - 10, coreR, 0, Math.PI*2);
      this.ctx.fill();
    }

    // Taillights
    if (id !== 'roadster') {
      this.ctx.shadowColor = 'rgba(255, 0, 80, 0.8)';
      this.ctx.fillStyle = 'rgba(255, 0, 80, 0.9)';
      this.ctx.fillRect(x + 4, y + h - 4, 6, 2);
      this.ctx.fillRect(x + w - 10, y + h - 4, 6, 2);
    }

    // Active powerups
    if (this.shieldActive) {
      this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.85)';
      this.ctx.shadowColor = 'rgba(0, 240, 255, 0.5)';
      this.ctx.shadowBlur = 18;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(x + w/2, y + h/2, h/1.4, 0, Math.PI*2);
      this.ctx.stroke();

      const grad = this.ctx.createRadialGradient(x + w/2, y + h/2, w/2, x + w/2, y + h/2, h/1.4);
      grad.addColorStop(0, 'rgba(0, 240, 255, 0.0)');
      grad.addColorStop(1, 'rgba(0, 240, 255, 0.12)');
      this.ctx.fillStyle = grad;
      this.ctx.fill();
    }

    if (this.magnetActive) {
      this.ctx.strokeStyle = 'rgba(157, 78, 221, 0.6)';
      this.ctx.shadowColor = 'rgba(157, 78, 221, 0.4)';
      this.ctx.shadowBlur = 10;
      this.ctx.lineWidth = 1.5;
      this.ctx.beginPath();
      this.ctx.arc(x + w/2, y + h/2, h * 1.8, 0, Math.PI * 2);
      this.ctx.stroke();
    }

    this.ctx.restore();
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
      this.ctx.save();
      this.ctx.shadowColor = car.color;
      this.ctx.shadowBlur = 10;
      this.ctx.lineWidth = 1.5;

      this.ctx.fillStyle = '#0d0d1c';
      this.ctx.strokeStyle = car.color;
      this.ctx.beginPath();
      this.ctx.roundRect(car.x, car.y, car.width, car.height, 6);
      this.ctx.fill();
      this.ctx.stroke();

      this.ctx.shadowColor = '#fff';
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      this.ctx.fillRect(car.x + 5, car.y + car.height - 2, 6, 2);
      this.ctx.fillRect(car.x + car.width - 11, car.y + car.height - 2, 6, 2);

      this.ctx.shadowColor = 'rgba(255, 50, 50, 0.5)';
      this.ctx.fillStyle = 'rgba(255, 50, 50, 0.8)';
      this.ctx.fillRect(car.x + 4, car.y, 6, 2);
      this.ctx.fillRect(car.x + car.width - 10, car.y, 6, 2);

      if (car.isPolice) {
        const isBlue = this.sirenFlashState < 10;
        this.ctx.shadowColor = isBlue ? '#0066ff' : '#ff003c';
        this.ctx.fillStyle = isBlue ? '#0066ff' : '#ff003c';
        this.ctx.fillRect(car.x + car.width/2 - 6, car.y + car.height/2 - 3, 12, 6);
      }

      this.ctx.restore();
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
