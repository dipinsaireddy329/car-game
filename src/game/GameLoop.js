import { audio } from '../utils/audio';

export class GameLoop {
  constructor(canvas, carConfig, options) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.carConfig = carConfig; // Color, handling, speed, perks, etc.
    this.options = options; // weatherMode, timeOfDay, callbacks

    // Dimensions
    this.width = canvas.width;
    this.height = canvas.height;

    // Road Layout
    this.lanesCount = 4;
    this.laneWidth = this.width / this.lanesCount;
    this.roadScrollY = 0;

    // Player Physics
    this.playerWidth = 44;
    this.playerHeight = 82;
    // Start player in the center of lane 1 (0-indexed: 0, 1, 2, 3)
    this.playerLane = 1.5; 
    this.playerX = this.getLaneCenterX(this.playerLane) - this.playerWidth / 2;
    this.playerY = this.height - 130;
    this.playerTargetX = this.playerX;
    
    // Stats
    this.baseSpeed = 6;
    this.currentSpeed = this.baseSpeed;
    this.maxNormalSpeed = 12 + (carConfig.speed / 100) * 4; // stats influence top speed
    this.speedRatio = 0; // 0.0 to 1.0 for audio pitch
    this.score = 0;
    this.coins = 0;
    this.lives = 3;
    this.fuel = 100;
    this.nitro = 20; // Starts with some nitro charge
    this.invulnerableTime = 0; // Flash when hit

    // Power-ups State
    this.shieldActive = carConfig.id === 'cruiser'; // Cruiser starts with shield
    this.shieldTimer = carConfig.id === 'cruiser' ? 999999 : 0;
    this.magnetActive = false;
    this.magnetTimer = 0;
    
    // Arrays
    this.traffic = [];
    this.items = [];
    this.particles = [];
    this.rainDrops = [];
    
    // Timers
    this.trafficSpawnTimer = 0;
    this.itemSpawnTimer = 0;
    this.weatherTimer = 0;

    // Settings
    this.isPaused = false;
    this.gameOverTriggered = false;

    // Initialize rain if rainy
    if (this.options.weatherMode === 'rain') {
      this.initRain();
    }
  }

  getLaneCenterX(laneIndex) {
    return laneIndex * this.laneWidth + this.laneWidth / 2;
  }

  initRain() {
    this.rainDrops = [];
    for (let i = 0; i < 60; i++) {
      this.rainDrops.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        speed: 15 + Math.random() * 10,
        length: 10 + Math.random() * 10
      });
    }
  }

  // Update Game Physics
  update(keys, deltaTime) {
    if (this.isPaused || this.gameOverTriggered) return;

    // 1. Invulnerability flashing timer
    if (this.invulnerableTime > 0) {
      this.invulnerableTime -= deltaTime;
    }

    // 2. Power-up timers
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

    // 3. Fuel Depletion
    const fuelConsumption = 0.05 * (this.currentSpeed / this.baseSpeed);
    this.fuel = Math.max(0, this.fuel - fuelConsumption);
    this.options.onFuelUpdate(this.fuel);

    if (this.fuel <= 0) {
      // Speed decays when fuel runs dry
      this.currentSpeed = Math.max(0.5, this.currentSpeed - 0.1);
      if (this.currentSpeed <= 0.6) {
        // Stop engine and trigger game over
        this.triggerGameOver();
        return;
      }
    }

    // 4. Nitro Mechanics
    const isBoosting = (keys[' '] || keys['Shift']) && this.nitro > 0 && this.fuel > 0;
    
    // Scale rate based on Speed Demon perk
    const chargeMultiplier = this.carConfig.id === 'demon' ? 1.5 : 1.0;

    if (isBoosting) {
      // Trigger nitro SFX when beginning to boost
      if (this.nitro === 100 || this.nitro % 30 === 0) {
        audio.playNitro();
      }
      this.nitro = Math.max(0, this.nitro - 0.6);
      this.currentSpeed = Math.min(this.maxNormalSpeed * 1.7, this.currentSpeed + 0.4);
      // Spawn boost fire particles
      this.spawnBoostParticles();
    } else {
      // Re-charge nitro slowly
      this.nitro = Math.min(100, this.nitro + 0.08 * chargeMultiplier);
      
      // Decelerate back to normal speed
      const targetNormal = this.maxNormalSpeed;
      if (this.currentSpeed > targetNormal) {
        this.currentSpeed -= 0.2;
      } else {
        // Speed gradually increases over time as score rises
        const scoreBonus = Math.min(4, this.score / 2000);
        const targetSpeed = this.baseSpeed + scoreBonus;
        if (this.currentSpeed < targetSpeed) {
          this.currentSpeed += 0.05;
        } else {
          this.currentSpeed = targetSpeed;
        }
      }
    }
    
    this.options.onNitroUpdate(this.nitro);
    this.options.onSpeedUpdate(this.currentSpeed / (this.maxNormalSpeed * 1.7));
    audio.updateEnginePitch(this.currentSpeed / (this.maxNormalSpeed * 1.7));

    // 5. Player Lateral Movement
    const handlingFactor = 0.08 + (this.carConfig.handling / 100) * 0.08;
    
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) {
      this.playerLane = Math.max(0.1, this.playerLane - handlingFactor);
    }
    if (keys['ArrowRight'] || keys['d'] || keys['D']) {
      this.playerLane = Math.min(this.lanesCount - 1.1, this.playerLane + handlingFactor);
    }

    this.playerX = this.getLaneCenterX(this.playerLane) - this.playerWidth / 2;

    // 6. Scroll Road markers
    this.roadScrollY = (this.roadScrollY + this.currentSpeed) % 80;

    // 7. Update particles
    this.updateParticles();

    // 8. Update Weather (Raindrops)
    if (this.options.weatherMode === 'rain') {
      this.updateRain();
    }

    // 9. Spawn Obstacles & Items
    this.spawnElements(deltaTime);

    // 10. Update & Move Elements
    this.updateElements(deltaTime);

    // 11. Increment Score (based on distance travelled)
    if (this.fuel > 0) {
      this.score += Math.round(this.currentSpeed / 4);
      this.options.onScoreUpdate(this.score);
    }
  }

  // Draw all graphics to Canvas
  draw() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    // 1. Draw Road Base & Lanes
    this.drawRoad();

    // 2. Draw Items/Collectibles
    this.drawItems();

    // 3. Draw Traffic obstacles
    this.drawTraffic();

    // 4. Draw Particles
    this.drawParticles();

    // 5. Draw Player Car
    this.drawPlayer();

    // 6. Draw Weather Overlay
    if (this.options.weatherMode === 'rain') {
      this.drawRain();
    }
    
    // 7. Ambient Lighting gradient based on Time of Day
    this.drawAmbientLighting();
  }

  // Draw highway asphalt grid and glowing barrier rails
  drawRoad() {
    // Background asphalt shade
    this.ctx.fillStyle = '#060612';
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Grid lines for retro speed sensation
    this.ctx.strokeStyle = 'rgba(157, 78, 221, 0.05)';
    this.ctx.lineWidth = 1;
    for (let x = 0; x < this.width; x += 40) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.height);
      this.ctx.stroke();
    }

    // Scrolling lane dividers (dashed neon cyan)
    this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.3)';
    this.ctx.lineWidth = 3;
    this.ctx.setLineDash([40, 40]);
    
    for (let i = 1; i < this.lanesCount; i++) {
      const lx = i * this.laneWidth;
      this.ctx.beginPath();
      this.ctx.moveTo(lx, this.roadScrollY - 80);
      this.ctx.lineTo(lx, this.height + 80);
      this.ctx.stroke();
    }
    this.ctx.setLineDash([]); // Reset line dash

    // Side Barriers (Left and Right glowing rails)
    const neonPink = 'rgba(255, 0, 127, 0.8)';
    
    // Left barrier
    this.ctx.shadowColor = 'rgba(255, 0, 127, 0.5)';
    this.ctx.shadowBlur = 10;
    this.ctx.fillStyle = neonPink;
    this.ctx.fillRect(0, 0, 5, this.height);

    // Right barrier
    this.ctx.fillRect(this.width - 5, 0, 5, this.height);
    
    // Reset shadow
    this.ctx.shadowBlur = 0;
  }

  // Draw player's cyan/pink neon vehicle model
  drawPlayer() {
    // If invulnerable, flash visibility
    if (this.invulnerableTime > 0 && Math.floor(Date.now() / 100) % 2 === 0) {
      return;
    }

    const x = this.playerX;
    const y = this.playerY;
    const w = this.playerWidth;
    const h = this.playerHeight;
    const color = this.carConfig.color;

    this.ctx.save();
    
    // Apply neon hover glow
    this.ctx.shadowColor = color;
    this.ctx.shadowBlur = 15;
    
    // Main fuselage chassis
    this.ctx.fillStyle = '#0f0f2d';
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.roundRect(x, y + 5, w, h - 10, 8);
    this.ctx.fill();
    this.ctx.stroke();

    // Wheel pods (Cyber styling)
    this.ctx.fillStyle = '#020208';
    this.ctx.fillRect(x - 4, y + 12, 4, 18);
    this.ctx.fillRect(x + w, y + 12, 4, 18);
    this.ctx.fillRect(x - 4, y + h - 30, 4, 18);
    this.ctx.fillRect(x + w, y + h - 30, 4, 18);

    // Red taillights (glowing)
    this.ctx.shadowColor = 'rgba(255, 0, 80, 0.8)';
    this.ctx.fillStyle = 'rgba(255, 0, 80, 0.9)';
    this.ctx.fillRect(x + 6, y + h - 3, 8, 3);
    this.ctx.fillRect(x + w - 14, y + h - 3, 8, 3);

    // Cyber windshield glassmorphism
    this.ctx.shadowColor = color;
    this.ctx.shadowBlur = 6;
    this.ctx.fillStyle = 'rgba(0, 240, 255, 0.35)';
    this.ctx.beginPath();
    this.ctx.moveTo(x + 8, y + 30);
    this.ctx.lineTo(x + w - 8, y + 30);
    this.ctx.lineTo(x + w - 12, y + 48);
    this.ctx.lineTo(x + 12, y + 48);
    this.ctx.closePath();
    this.ctx.fill();

    // Draw active shield bubble if shield is on
    if (this.shieldActive) {
      this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.8)';
      this.ctx.shadowColor = 'rgba(0, 240, 255, 0.5)';
      this.ctx.shadowBlur = 18;
      this.ctx.lineWidth = 2.5;
      this.ctx.beginPath();
      // Draw shield circle around player center
      this.ctx.arc(x + w / 2, y + h / 2, h / 1.5, 0, Math.PI * 2);
      this.ctx.stroke();

      // Soft shield transparency radial gradient
      const grad = this.ctx.createRadialGradient(
        x + w / 2, y + h / 2, w / 2, 
        x + w / 2, y + h / 2, h / 1.5
      );
      grad.addColorStop(0, 'rgba(0, 240, 255, 0.0)');
      grad.addColorStop(1, 'rgba(0, 240, 255, 0.12)');
      this.ctx.fillStyle = grad;
      this.ctx.fill();
    }

    // Draw active magnet attraction wave
    if (this.magnetActive) {
      this.ctx.strokeStyle = 'rgba(157, 78, 221, 0.6)';
      this.ctx.shadowColor = 'rgba(157, 78, 221, 0.4)';
      this.ctx.shadowBlur = 10;
      this.ctx.lineWidth = 1.5;
      this.ctx.beginPath();
      this.ctx.arc(x + w / 2, y + h / 2, h * 1.8, 0, Math.PI * 2);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  // Draw traffic cars
  drawTraffic() {
    this.traffic.forEach(car => {
      this.ctx.save();
      this.ctx.shadowColor = car.color;
      this.ctx.shadowBlur = 10;
      this.ctx.lineWidth = 1.5;

      // Chassis
      this.ctx.fillStyle = '#0b0b18';
      this.ctx.strokeStyle = car.color;
      this.ctx.beginPath();
      this.ctx.roundRect(car.x, car.y, car.width, car.height, 6);
      this.ctx.fill();
      this.ctx.stroke();

      // Headlights pointing down
      this.ctx.shadowColor = '#fff';
      this.ctx.fillStyle = 'rgba(255,255,255,0.9)';
      this.ctx.fillRect(car.x + 5, car.y + car.height - 2, 6, 2);
      this.ctx.fillRect(car.x + car.width - 11, car.y + car.height - 2, 6, 2);

      // Tail lights
      this.ctx.shadowColor = 'rgba(255, 50, 50, 0.5)';
      this.ctx.fillStyle = 'rgba(255, 50, 50, 0.8)';
      this.ctx.fillRect(car.x + 4, car.y, 6, 2);
      this.ctx.fillRect(car.x + car.width - 10, car.y, 6, 2);

      this.ctx.restore();
    });
  }

  // Draw glowing collectibles
  drawItems() {
    this.items.forEach(item => {
      this.ctx.save();
      this.ctx.shadowColor = item.color;
      this.ctx.shadowBlur = 12;

      if (item.type === 'COIN') {
        // Spin effect based on timestamp
        const radiusX = 10 + Math.sin(Date.now() / 150) * 3;
        this.ctx.strokeStyle = item.color;
        this.ctx.fillStyle = 'rgba(255, 215, 0, 0.15)';
        this.ctx.lineWidth = 2.5;
        this.ctx.beginPath();
        this.ctx.ellipse(item.x, item.y, radiusX, 10, 0, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
      } else if (item.type === 'FUEL') {
        // Green Fuel Box
        this.ctx.fillStyle = '#061a0b';
        this.ctx.strokeStyle = item.color;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.rect(item.x - 10, item.y - 10, 20, 20);
        this.ctx.fill();
        this.ctx.stroke();
        // Inner F letter
        this.ctx.fillStyle = item.color;
        this.ctx.font = 'bold 11px Inter';
        this.ctx.fillText('F', item.x - 4, item.y + 4);
      } else if (item.type === 'SHIELD') {
        // Cyan shield sphere
        this.ctx.strokeStyle = item.color;
        this.ctx.fillStyle = 'rgba(0, 240, 255, 0.2)';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(item.x, item.y, 11, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
      } else if (item.type === 'MAGNET') {
        // Purple magnet loop
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

  // Draw active particle systems
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

  // Render falling rain drops
  drawRain() {
    this.ctx.strokeStyle = 'rgba(174, 219, 255, 0.3)';
    this.ctx.lineWidth = 1;
    this.rainDrops.forEach(drop => {
      this.ctx.beginPath();
      this.ctx.moveTo(drop.x, drop.y);
      this.ctx.lineTo(drop.x - 2, drop.y + drop.length);
      this.ctx.stroke();
    });
  }

  // Render atmospheric overlay color matching environment modes
  drawAmbientLighting() {
    if (this.options.timeOfDay === 'night') {
      // Midnight dark grid vignette
      const darkGrad = this.ctx.createRadialGradient(
        this.width / 2, this.height / 2, this.height / 3,
        this.width / 2, this.height / 2, this.height
      );
      darkGrad.addColorStop(0, 'rgba(5, 5, 20, 0.05)');
      darkGrad.addColorStop(1, 'rgba(0, 0, 5, 0.55)');
      this.ctx.fillStyle = darkGrad;
      this.ctx.fillRect(0, 0, this.width, this.height);
    } else {
      // Golden hour / Sunset warm red purple overlay
      const sunsetGrad = this.ctx.createLinearGradient(0, 0, 0, this.height);
      sunsetGrad.addColorStop(0, 'rgba(255, 75, 45, 0.06)');
      sunsetGrad.addColorStop(0.5, 'rgba(157, 78, 221, 0.03)');
      sunsetGrad.addColorStop(1, 'rgba(0, 0, 10, 0.12)');
      this.ctx.fillStyle = sunsetGrad;
      this.ctx.fillRect(0, 0, this.width, this.height);
    }
  }

  // Elements (Traffic, Coins, Fuel) spawning engine
  spawnElements(deltaTime) {
    this.trafficSpawnTimer += deltaTime;
    this.itemSpawnTimer += deltaTime;

    // Traffic spawn frequency scales with speed
    const trafficLimit = 1.0 - Math.min(0.5, this.currentSpeed / 25); // Faster speed = higher frequency spawn
    if (this.trafficSpawnTimer >= trafficLimit) {
      this.trafficSpawnTimer = 0;
      this.spawnTrafficCar();
    }

    // Collectibles spawn frequency
    if (this.itemSpawnTimer >= 1.2) {
      this.itemSpawnTimer = 0;
      this.spawnCollectibleItem();
    }
  }

  spawnTrafficCar() {
    // Generate lane ensuring not all lanes are full at same depth
    const lane = Math.floor(Math.random() * this.lanesCount);
    
    // Verify lane block density - avoid spawning if too close to another traffic car in same lane
    const pathBlocked = this.traffic.some(car => car.lane === lane && car.y < 120);
    if (pathBlocked) return;

    const carWidth = 40;
    const carHeight = 78;
    const x = this.getLaneCenterX(lane) - carWidth / 2;
    const y = -90; // Start offscreen

    // Select color matching archetype (police interceptor, retro sedan, sports car)
    const trafficTypes = [
      { color: 'rgba(255, 0, 127, 0.8)', speedOffset: -3 }, // slow racer pink
      { color: 'rgba(157, 78, 221, 0.8)', speedOffset: -2 }, // cruiser purple
      { color: 'rgba(57, 255, 20, 0.8)', speedOffset: -1.5 }, // econ green
      { color: 'rgba(255, 215, 0, 0.8)', speedOffset: 2 } // fast sports car yellow
    ];
    const spec = trafficTypes[Math.floor(Math.random() * trafficTypes.length)];

    this.traffic.push({
      lane,
      x,
      y,
      width: carWidth,
      height: carHeight,
      // Move downwards relative to road scroll speed.
      // So velocity inside grid is currentSpeed + offset
      speed: Math.max(1, 2 + Math.random() * 2 + spec.speedOffset),
      color: spec.color
    });
  }

  spawnCollectibleItem() {
    const lane = Math.floor(Math.random() * this.lanesCount);
    const x = this.getLaneCenterX(lane);
    const y = -40;

    // Weight probabilities: COIN > FUEL > SHIELD = MAGNET
    const roll = Math.random();
    let type = 'COIN';
    let color = 'rgba(255, 215, 0, 0.8)'; // gold

    if (roll < 0.65) {
      type = 'COIN';
    } else if (roll < 0.85) {
      type = 'FUEL';
      color = 'rgba(57, 255, 20, 0.9)'; // neon green
    } else if (roll < 0.92) {
      type = 'SHIELD';
      color = 'rgba(0, 240, 255, 0.9)'; // neon cyan
    } else {
      type = 'MAGNET';
      color = 'rgba(157, 78, 221, 0.9)'; // neon purple
    }

    // Verify lane overlaps
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

  // Update position of obstacles and collectibles, check collisions
  updateElements(deltaTime) {
    // 1. Move Traffic
    for (let i = this.traffic.length - 1; i >= 0; i--) {
      const car = this.traffic[i];
      // They descend because player is moving forward faster than them
      car.y += (this.currentSpeed - car.speed);
      
      // Near miss validation (passed player close laterally)
      if (!car.nearMissTriggered && car.y > this.playerY && car.y < this.playerY + 40) {
        const lateralDist = Math.abs((car.x + car.width / 2) - (this.playerX + this.playerWidth / 2));
        if (lateralDist < 75) {
          car.nearMissTriggered = true;
          this.triggerNearMiss();
        }
      }

      // Check collision
      if (this.checkCollision(this.playerX, this.playerY, this.playerWidth, this.playerHeight, car.x, car.y, car.width, car.height)) {
        this.handleCrash(car, i);
        continue;
      }

      // Delete offscreen elements
      if (car.y > this.height + 100) {
        this.traffic.splice(i, 1);
      }
    }

    // 2. Move & Attract Items
    const magnetRange = 180;
    
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.y += this.currentSpeed;

      // Magnet force attraction physics
      if (this.magnetActive && item.type === 'COIN') {
        const dx = (this.playerX + this.playerWidth / 2) - item.x;
        const dy = (this.playerY + this.playerHeight / 2) - item.y;
        const distance = Math.hypot(dx, dy);

        if (distance < magnetRange) {
          // Accelerate coin towards player
          const pullSpeed = 12 * (1 - distance / magnetRange);
          item.x += (dx / distance) * pullSpeed;
          item.y += (dy / distance) * pullSpeed;
        }
      }

      // Check item collection
      const playerCenterX = this.playerX + this.playerWidth / 2;
      const playerCenterY = this.playerY + this.playerHeight / 2;
      const itemDist = Math.hypot(playerCenterX - item.x, playerCenterY - item.y);

      if (itemDist < 35) {
        this.handleCollectItem(item);
        this.items.splice(i, 1);
        continue;
      }

      // Delete offscreen
      if (item.y > this.height + 60) {
        this.items.splice(i, 1);
      }
    }
  }

  checkCollision(px, py, pw, ph, tx, ty, tw, th) {
    // 5px margin of forgiveness (insets) to prevent annoying close-shave collisions
    const inset = 4;
    return (
      px + inset < tx + tw - inset &&
      px + pw - inset > tx + inset &&
      py + inset < ty + th - inset &&
      py + ph - inset > ty + inset
    );
  }

  // Handle Collision crashes
  handleCrash(trafficCar, index) {
    if (this.invulnerableTime > 0) return;

    if (this.shieldActive) {
      // Shield absorbs collision, destroying obstacle
      this.shieldActive = false;
      this.shieldTimer = 0;
      this.options.onShieldUpdate(false);
      
      // Explode the traffic obstacle car
      this.spawnCrashExplosion(trafficCar.x + trafficCar.width / 2, trafficCar.y + trafficCar.height / 2, 'rgba(0, 240, 255, 0.9)', 15);
      this.traffic.splice(index, 1);
      
      audio.playCrash();
      this.options.onHit(); // Screen shake
      this.invulnerableTime = 1.0; // 1s brief safety recovery
    } else {
      // Lose life
      this.lives = Math.max(0, this.lives - 1);
      this.options.onLivesUpdate(this.lives);
      this.options.onHit(); // Screen shake
      
      // Spawn explosion sparks
      this.spawnCrashExplosion(this.playerX + this.playerWidth / 2, this.playerY + 20, 'rgba(255, 0, 127, 0.9)', 25);
      
      if (this.lives <= 0) {
        this.triggerGameOver();
      } else {
        audio.playCrash();
        this.invulnerableTime = 2.0; // Flashing safety period
        
        // Remove the car hit to prevent double-hitting
        this.traffic.splice(index, 1);
      }
    }
  }

  // Handle Pickups
  handleCollectItem(item) {
    if (item.type === 'COIN') {
      audio.playCoin();
      this.coins += 1;
      this.options.onCoinsUpdate(this.coins);
      this.score += 50; // extra distance bonus
      this.spawnCollectBurst(item.x, item.y, 'rgba(255, 215, 0, 0.9)');
    } else if (item.type === 'FUEL') {
      audio.playShield(); // light bell chime
      this.fuel = Math.min(100, this.fuel + 30);
      this.options.onFuelUpdate(this.fuel);
      this.spawnCollectBurst(item.x, item.y, 'rgba(57, 255, 20, 0.9)');
    } else if (item.type === 'SHIELD') {
      audio.playShield();
      this.shieldActive = true;
      // Magnet/Shield duration is increased based on Roadster perk if relevant
      this.shieldTimer = 8; // 8 seconds duration
      this.options.onShieldUpdate(true);
      this.spawnCollectBurst(item.x, item.y, 'rgba(0, 240, 255, 0.9)');
    } else if (item.type === 'MAGNET') {
      audio.playShield();
      this.magnetActive = true;
      
      const durationMultiplier = this.carConfig.id === 'roadster' ? 1.3 : 1.0;
      this.magnetTimer = 10 * durationMultiplier;
      this.options.onMagnetUpdate(true);
      this.spawnCollectBurst(item.x, item.y, 'rgba(157, 78, 221, 0.9)');
    }
  }

  triggerNearMiss() {
    this.score += 150; // Near miss bonus!
    audio.playClick(); // light tick chime
    this.options.onScoreUpdate(this.score);

    // Spawn tiny green floating spark lines indicating bonus
    this.spawnNearMissSparkles();
  }

  triggerGameOver() {
    if (this.gameOverTriggered) return;
    this.gameOverTriggered = true;
    this.options.onGameOver(this.score, this.coins);
  }

  // Rain Update Loop
  updateRain() {
    this.rainDrops.forEach(drop => {
      drop.y += drop.speed;
      if (drop.y > this.height) {
        drop.y = -drop.length;
        drop.x = Math.random() * this.width;
        // Splash ripple particle on the road occasionally
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

  // Particle Mechanics
  updateParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      // Drag/deceleration
      p.vx *= 0.95;
      p.vy *= 0.95;
      
      p.life -= 0.016; // subtract frame slice
      p.alpha = Math.max(0, p.life / p.maxLife);

      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  spawnBoostParticles() {
    // Left and right tailpipe exhausts
    const pxLeft = this.playerX + 10;
    const pxRight = this.playerX + this.playerWidth - 10;
    const py = this.playerY + this.playerHeight;
    const carColor = this.carConfig.color;

    // Spawn 2 particles per tailpipe
    for (let pipeX of [pxLeft, pxRight]) {
      this.particles.push({
        x: pipeX,
        y: py,
        vx: (Math.random() - 0.5) * 1.5,
        vy: 4 + Math.random() * 3, // ejecting backwards
        size: 2 + Math.random() * 2,
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
        vy: -2 - Math.random() * 2, // float up
        size: 1.5,
        color: 'rgba(57, 255, 20, 0.95)', // neon green text sparks
        glow: true,
        life: 0.4,
        maxLife: 0.4
      });
    }
  }
}
