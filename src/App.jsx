import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX, Sparkles, X } from 'lucide-react';
import MainMenu from './components/MainMenu';
import CarSelection from './components/CarSelection';
import GameDashboard from './components/GameDashboard';
import AchievementsPanel from './components/AchievementsPanel';
import StatsPanel from './components/StatsPanel';
import GameEngine from './game/GameEngine';
import { audio } from './utils/audio';

// Expanded Cars Database
export const CARS = [
  {
    id: 'roadster',
    name: 'Cyber Roadster',
    description: 'Sleek starter machine built for cyber grid cruising. Balanced dynamics.',
    speed: 65,
    handling: 75,
    perkName: 'E-Magnet Plus',
    perkDesc: 'Coin attraction magnet lasts 30% longer.',
    color: '#00f0ff',
    price: 0,
    trail: 'rgba(0, 240, 255, 0.4)'
  },
  {
    id: 'cruiser',
    name: 'Dipin Cruiser',
    description: 'Armored heavy-duty patrol racer. Higher endurance and shields.',
    speed: 55,
    handling: 60,
    perkName: 'Shield Capacitor',
    perkDesc: 'Starts game with a shielding field active.',
    color: '#9d4edd',
    price: 0,
    trail: 'rgba(157, 78, 221, 0.4)'
  },
  {
    id: 'gt',
    name: 'Apex GT',
    description: 'Street-tuned import drift racer. Equipped with performance nitro-drift tires.',
    speed: 80,
    handling: 88,
    perkName: 'Tuning Drift',
    perkDesc: 'Vehicle lateral handling increases by 15% during active Nitro boosts.',
    color: '#ff5722',
    price: 0,
    trail: 'rgba(255, 87, 34, 0.4)'
  },
  {
    id: 'police',
    name: 'Future Interceptor',
    description: 'Special taskforce pursuit vehicle. Optimized for data collection.',
    speed: 80,
    handling: 70,
    perkName: 'Data Double',
    perkDesc: 'All network coins collected are worth double value.',
    color: '#ffd700',
    price: 0,
    trail: 'rgba(255, 215, 0, 0.4)'
  },
  {
    id: 'cobra',
    name: 'Carbon Cobra',
    description: 'Classic heavy muscle street racer. Built for raw speed and ramming force.',
    speed: 88,
    handling: 62,
    perkName: 'Ram Charger',
    perkDesc: 'Hitting traffic during active Nitro crushes obstacles for +200 points without crashing.',
    color: '#e91e63',
    price: 0,
    trail: 'rgba(233, 30, 99, 0.4)'
  },
  {
    id: 'demon',
    name: 'Speed Demon',
    description: 'Prototype racing chassis. Extremely high speed. Dangerous output.',
    speed: 95,
    handling: 85,
    perkName: 'Nitro Burst',
    perkDesc: 'Nitro refills and charges 50% faster.',
    color: '#ff007f',
    price: 0,
    trail: 'rgba(255, 0, 127, 0.4)'
  },
  {
    id: 'sentinel',
    name: 'Sentinel Truck',
    description: 'Massive armored truck. Has 4 lives instead of 3. Drains energy slower.',
    speed: 50,
    handling: 50,
    perkName: 'Heavy Armor',
    perkDesc: 'Starts with 4 lives. Energy cell decays 25% slower.',
    color: '#39ff14',
    price: 0,
    trail: 'rgba(57, 255, 20, 0.4)'
  },
  {
    id: 'phantom',
    name: 'Hyper Phantom',
    description: 'Experimental phase vehicle. Attracts energy cells as well as coins.',
    speed: 90,
    handling: 95,
    perkName: 'Cell Attractor',
    perkDesc: 'Magnets attract fuel energy canisters in addition to coins.',
    color: '#ffffff',
    price: 0,
    trail: 'rgba(255, 255, 255, 0.4)'
  },
  {
    id: 'cybertruck',
    name: 'Blueprints Cybertruck',
    description: 'Angular low-poly tank built with stainless steel alloys. Heavy impact shield.',
    speed: 70,
    handling: 52,
    perkName: 'Steel Exoskeleton',
    perkDesc: 'Starts with 4 lives. Hits traffic for only 40% energy cell loss instead of losing a life.',
    color: '#a1a1aa',
    price: 0,
    trail: 'rgba(161, 161, 170, 0.4)'
  },
  {
    id: 'lightcycle',
    name: 'Vector Lightcycle',
    description: 'Ultra-narrow grid-skimming Dipin motorcycle. Exceptional agility and profile.',
    speed: 92,
    handling: 98,
    perkName: 'Slipstream Profile',
    perkDesc: 'Extremely narrow 26px vehicle hitbox allowing effortless lane splitting.',
    color: '#00ff66',
    price: 0,
    trail: 'rgba(0, 255, 102, 0.4)'
  }
];

function App() {
  const [gameState, setGameState] = useState('MENU'); // MENU, SELECT_CAR, PLAYING, GAME_OVER, ACHIEVEMENTS, STATS
  const [selectedCar, setSelectedCar] = useState(CARS[0]);
  const [highScore, setHighScore] = useState(0);
  const [coins, setCoins] = useState(0);
  const [unlockedCars, setUnlockedCars] = useState(CARS.map(c => c.id));
  const [upgrades, setUpgrades] = useState({
    roadster: { speed: 1, handling: 1 },
    cruiser: { speed: 1, handling: 1 },
    gt: { speed: 1, handling: 1 },
    police: { speed: 1, handling: 1 },
    cobra: { speed: 1, handling: 1 },
    demon: { speed: 1, handling: 1 },
    sentinel: { speed: 1, handling: 1 },
    phantom: { speed: 1, handling: 1 },
    cybertruck: { speed: 1, handling: 1 },
    lightcycle: { speed: 1, handling: 1 }
  });

  // Game metrics (sent from Canvas Game Loop)
  const [score, setScore] = useState(0);
  const [sessionCoins, setSessionCoins] = useState(0);
  const [lives, setLives] = useState(3);
  const [speed, setSpeed] = useState(0);
  const [nitro, setNitro] = useState(0);
  const [fuel, setFuel] = useState(100);
  const [activeShield, setActiveShield] = useState(false);
  const [activeMagnet, setActiveMagnet] = useState(false);

  // ── Gameplay additions
  const [level, setLevel] = useState(1);
  const [xp, setXp] = useState(0);
  const [combo, setCombo] = useState(1);
  const [activeTheme, setActiveTheme] = useState('night');
  const [gyroscopeEnabled, setGyroscopeEnabled] = useState(false);
  const [activeMissions, setActiveMissions] = useState([
    { id: 'coins', title: 'Gather Credits', progress: 0, target: 12, type: 'coins' },
    { id: 'distance', title: 'Horizon Run', progress: 0, target: 1800, type: 'distance' },
    { id: 'near_miss', title: 'Hazard Slip', progress: 0, target: 4, type: 'near_miss' }
  ]);

  // Settings
  const [themeSetting, setThemeSetting] = useState('random');
  const [muted, setMuted] = useState(false);
  const [shake, setShake] = useState(false);

  // Daily Rewards states
  const [dailyClaimable, setDailyClaimable] = useState(false);
  const [showDailyPopup, setShowDailyPopup] = useState(false);
  const [dailyStreak, setDailyStreak] = useState(1);

  // Load progress from localStorage
  useEffect(() => {
    const savedHighScore = localStorage.getItem('Dipin_racer_high_score');
    const savedCoins = localStorage.getItem('Dipin_racer_total_coins');
    const savedUnlocked = localStorage.getItem('Dipin_racer_unlocked_cars');
    const savedUpgrades = localStorage.getItem('Dipin_racer_upgrades');
    const savedMuted = localStorage.getItem('Dipin_racer_muted');
    const savedTheme = localStorage.getItem('dipin_theme');

    const savedLvl = localStorage.getItem('dipin_level');
    const savedXp = localStorage.getItem('dipin_xp');

    if (savedHighScore) setHighScore(parseInt(savedHighScore, 10));
    if (savedCoins) setCoins(parseInt(savedCoins, 10));
    if (savedTheme) setThemeSetting(savedTheme);

    if (savedLvl) setLevel(parseInt(savedLvl, 10));
    if (savedXp) setXp(parseInt(savedXp, 10));

    if (savedUnlocked) {
      try {
        const parsed = JSON.parse(savedUnlocked);
        const allIds = CARS.map(c => c.id);
        const merged = Array.from(new Set([...parsed, ...allIds]));
        setUnlockedCars(merged);
      } catch (e) {
        setUnlockedCars(CARS.map(c => c.id));
      }
    } else {
      setUnlockedCars(CARS.map(c => c.id));
    }
    if (savedUpgrades) {
      try {
        setUpgrades(JSON.parse(savedUpgrades));
      } catch (e) {}
    }
    if (savedMuted === 'true') {
      setMuted(true);
      audio.muted = true;
    }

    // Check Daily claim eligibility
    const savedDaily = localStorage.getItem('dipin_daily_reward');
    if (savedDaily) {
      try {
        const parsed = JSON.parse(savedDaily);
        const lastClaimDate = new Date(parsed.lastClaimDate).toDateString();
        const todayDate = new Date().toDateString();
        setDailyStreak(parsed.streak || 1);
        if (lastClaimDate !== todayDate) {
          setDailyClaimable(true);
        }
      } catch (e) {
        setDailyClaimable(true);
      }
    } else {
      setDailyClaimable(true);
    }
  }, []);

  // Save volume levels and dynamic configs when changing
  useEffect(() => {
    localStorage.setItem('dipin_theme', themeSetting);
  }, [themeSetting]);

  // Control background music based on state
  useEffect(() => {
    if (gameState === 'PLAYING') {
      audio.startMusic();
      audio.startEngine();
    } else {
      audio.stopEngine();
      audio.stopRain();
      audio.stopCity();
      if (gameState === 'GAME_OVER') {
        audio.stopMusic();
      } else {
        if (!muted && (gameState === 'MENU' || gameState === 'SELECT_CAR' || gameState === 'ACHIEVEMENTS' || gameState === 'STATS')) {
          audio.startMusic();
        }
      }
    }
    return () => {
      audio.stopEngine();
    };
  }, [gameState, muted]);

  const handleToggleMute = () => {
    const isMuted = audio.toggleMute();
    setMuted(isMuted);
    localStorage.setItem('Dipin_racer_muted', isMuted ? 'true' : 'false');
    audio.playClick();
  };

  const handleClaimDaily = () => {
    if (!dailyClaimable) return;
    audio.playDailyReward();

    // Reward math (Day 1=150, Day 2=200, Day 3=250... cap at 500)
    const prizeCoins = Math.min(500, 100 + dailyStreak * 50);
    const newCoins = coins + prizeCoins;
    setCoins(newCoins);
    localStorage.setItem('Dipin_racer_total_coins', newCoins.toString());

    // Update streak data
    const savedDaily = localStorage.getItem('dipin_daily_reward');
    let nextStreak = 1;
    if (savedDaily) {
      try {
        const parsed = JSON.parse(savedDaily);
        const lastClaim = new Date(parsed.lastClaimDate);
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (lastClaim.toDateString() === yesterday.toDateString()) {
          nextStreak = (parsed.streak || 0) + 1;
        }
      } catch (e) {}
    }

    localStorage.setItem(
      'dipin_daily_reward',
      JSON.stringify({
        lastClaimDate: new Date().toISOString(),
        streak: nextStreak
      })
    );
    setDailyStreak(nextStreak);
    setDailyClaimable(false);
    setShowDailyPopup(true);
  };

  const handleStartGame = () => {
    audio.playClick();
    setScore(0);
    setSessionCoins(0);
    setCombo(1);

    // Reset procedural missions trackers
    setActiveMissions([
      { id: 'coins', title: 'Gather Credits', progress: 0, target: 12, type: 'coins' },
      { id: 'distance', title: 'Horizon Run', progress: 0, target: 1800, type: 'distance' },
      { id: 'near_miss', title: 'Hazard Slip', progress: 0, target: 4, type: 'near_miss' }
    ]);

    // Choose active theme
    if (themeSetting === 'random') {
      const options = ['dawn', 'day', 'sunset', 'night', 'rain', 'storm'];
      const chosen = options[Math.floor(Math.random() * options.length)];
      setActiveTheme(chosen);
    } else {
      setActiveTheme(themeSetting);
    }

    const startLives = (selectedCar.id === 'sentinel' || selectedCar.id === 'cybertruck') ? 4 : 3;
    setLives(startLives);

    setFuel(100);
    setNitro(25);
    setActiveShield(selectedCar.id === 'cruiser');
    setActiveMagnet(false);
    
    // Add direct class overlay on body element to stop elastic scrolls on Safari
    document.body.classList.add('playing');

    setGameState('PLAYING');
  };

  const handleBuyCar = (car) => {
    if (coins >= car.price && !unlockedCars.includes(car.id)) {
      const newCoins = coins - car.price;
      const newUnlocked = [...unlockedCars, car.id];

      setCoins(newCoins);
      setUnlockedCars(newUnlocked);

      localStorage.setItem('Dipin_racer_total_coins', newCoins.toString());
      localStorage.setItem('Dipin_racer_unlocked_cars', JSON.stringify(newUnlocked));
      audio.playShield();
      return true;
    }
    audio.playClick();
    return false;
  };

  const handleUpgrade = (carId, stat) => {
    const currentLevel = upgrades[carId]?.[stat] || 1;
    if (currentLevel >= 5) return;

    const cost = currentLevel * 50;
    if (coins >= cost) {
      const newCoins = coins - cost;
      const newCarUpgrades = {
        ...upgrades[carId],
        [stat]: currentLevel + 1
      };
      const newUpgrades = {
        ...upgrades,
        [carId]: newCarUpgrades
      };

      setCoins(newCoins);
      setUpgrades(newUpgrades);

      localStorage.setItem('Dipin_racer_total_coins', newCoins.toString());
      localStorage.setItem('Dipin_racer_upgrades', JSON.stringify(newUpgrades));
      audio.playShield();
    } else {
      audio.playClick();
    }
  };

  const handleGameOver = (finalScore, finalCoins) => {
    audio.playCrash();

    // Remove safari bounce inhibitor classes
    document.body.classList.remove('playing');

    const processedCoins = selectedCar.id === 'police' ? finalCoins * 2 : finalCoins;
    const newCoinsBank = coins + processedCoins;
    setCoins(newCoinsBank);
    localStorage.setItem('Dipin_racer_total_coins', newCoinsBank.toString());

    if (finalScore > highScore) {
      setHighScore(finalScore);
      localStorage.setItem('Dipin_racer_high_score', finalScore.toString());
    }

    setSessionCoins(processedCoins);
    setScore(finalScore);
    setGameState('GAME_OVER');
  };

  const triggerScreenShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 400);
  };

  // Score mission monitoring callback
  const handleScoreUpdate = (newScore) => {
    setScore(newScore);
    updateMission('distance', newScore);
  };

  // Coin mission monitoring callback
  const handleCoinsUpdate = (newCoins) => {
    setSessionCoins(newCoins);
    updateMission('coins', newCoins);
  };

  // Near miss combo monitoring callback
  const handleComboUpdate = (newCombo) => {
    setCombo(newCombo);
    if (newCombo > 1) {
      const curMiss = activeMissions.find(m => m.type === 'near_miss');
      if (curMiss) {
        updateMission('near_miss', curMiss.progress + 1);
      }
    }
  };

  const handleLevelUpdate = (newLvl, newXp) => {
    setLevel(newLvl);
    setXp(newXp);
    localStorage.setItem('dipin_level', newLvl.toString());
    localStorage.setItem('dipin_xp', newXp.toString());
  };

  const updateMission = (type, value) => {
    setActiveMissions(prev =>
      prev.map(m => {
        if (m.type === type) {
          const nextProgress = Math.min(m.target, value);
          if (nextProgress >= m.target && m.progress < m.target) {
            // Mission completed bonus award! (+100 credits)
            setCoins(c => {
              const bonusCoins = c + 100;
              localStorage.setItem('Dipin_racer_total_coins', bonusCoins.toString());
              return bonusCoins;
            });
            audio.playDailyReward();
          }
          return { ...m, progress: nextProgress };
        }
        return m;
      })
    );
  };

  return (
    <div className={`relative w-full h-full overflow-hidden select-none ${shake ? 'shake-screen' : ''}`}>
      
      {/* Visual scanlines & filters */}
      <div className="cyber-grid-container" />
      <div className="scanlines" />
      <div className="vignette" />

      {/* Mute Audio Action Button */}
      {gameState !== 'PLAYING' && (
        <button
          className="audio-toggle-btn"
          onClick={handleToggleMute}
          title={muted ? 'Unmute Sound' : 'Mute Sound'}
        >
          {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>
      )}

      {/* Daily streak claimed popup modal */}
      {showDailyPopup && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="daily-reward-card max-w-sm w-full flex flex-col items-center gap-4 relative">
            <button
              onClick={() => setShowDailyPopup(false)}
              className="absolute top-3 right-3 text-text-muted hover:text-white pointer-events-auto"
            >
              <X size={16} />
            </button>
            <div className="reward-coin-burst">🎁</div>
            <h2 className="font-display text-lg font-black text-Dipin-yellow tracking-widest mt-1">
              GRID INCOMING SENT!
            </h2>
            <p className="font-sans text-xs text-text-secondary leading-normal text-center">
              Credit node successfully claims reward!<br />
              Credits added: <span className="text-Dipin-yellow font-bold">+{Math.min(500, 100 + dailyStreak * 50)}</span>
            </p>
            <div className="flex gap-2 text-[10px] text-Dipin-cyan font-bold tracking-widest mt-1 bg-slate-900/60 p-2 rounded border border-glass-border">
              <span>DAILY STREAK: {dailyStreak} DAYS</span>
            </div>
            <button
              onClick={() => setShowDailyPopup(false)}
              className="Dipin-btn Dipin-btn-cyan w-full text-xs font-bold mt-2"
            >
              SECURE GRID DATA
            </button>
          </div>
        </div>
      )}

      {/* Screen Routing Transitions */}
      <AnimatePresence mode="wait">
        {gameState === 'MENU' && (
          <motion.div
            key="menu"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 flex items-center justify-center p-4"
          >
            <MainMenu
              highScore={highScore}
              totalCoins={coins}
              themeSetting={themeSetting}
              setThemeSetting={setThemeSetting}
              onSelectCar={() => {
                audio.playClick();
                setGameState('SELECT_CAR');
              }}
              onOpenAchievements={() => {
                audio.playClick();
                setGameState('ACHIEVEMENTS');
              }}
              onOpenStats={() => {
                audio.playClick();
                setGameState('STATS');
              }}
              onClaimDaily={handleClaimDaily}
              dailyClaimable={dailyClaimable}
            />
          </motion.div>
        )}

        {gameState === 'SELECT_CAR' && (
          <motion.div
            key="select-car"
            initial={{ opacity: 0, x: 120 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -120 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 flex items-center justify-center p-4"
          >
            <CarSelection
              cars={CARS}
              selectedCar={selectedCar}
              setSelectedCar={setSelectedCar}
              unlockedCars={unlockedCars}
              upgrades={upgrades}
              onUpgrade={handleUpgrade}
              totalCoins={coins}
              onBuy={handleBuyCar}
              onBack={() => {
                audio.playClick();
                setGameState('MENU');
              }}
              onStart={handleStartGame}
            />
          </motion.div>
        )}

        {gameState === 'ACHIEVEMENTS' && (
          <motion.div
            key="achievements"
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -100 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 flex items-center justify-center p-4"
          >
            <AchievementsPanel
              onBack={() => {
                setGameState('MENU');
              }}
            />
          </motion.div>
        )}

        {gameState === 'STATS' && (
          <motion.div
            key="stats"
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -100 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 flex items-center justify-center p-4"
          >
            <StatsPanel
              onBack={() => {
                setGameState('MENU');
              }}
            />
          </motion.div>
        )}

        {gameState === 'PLAYING' && (
          <motion.div
            key="playing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0 w-full h-full"
          >
            {/* Canvas Game Engine */}
            <GameEngine
              selectedCar={selectedCar}
              carUpgrades={upgrades[selectedCar.id] || { speed: 1, handling: 1 }}
              theme={activeTheme}
              onGameOver={handleGameOver}
              onScoreUpdate={handleScoreUpdate}
              onCoinsUpdate={handleCoinsUpdate}
              onLivesUpdate={setLives}
              onSpeedUpdate={setSpeed}
              onNitroUpdate={setNitro}
              onFuelUpdate={setFuel}
              onShieldUpdate={setActiveShield}
              onMagnetUpdate={setActiveMagnet}
              onLevelUpdate={handleLevelUpdate}
              onComboUpdate={handleComboUpdate}
              onHit={triggerScreenShake}
              gyroscopeEnabled={gyroscopeEnabled}
            />

            {/* Dashboard HUD HUD HUD overlay */}
            <GameDashboard
              score={score}
              coins={sessionCoins}
              lives={lives}
              speed={speed}
              nitro={nitro}
              fuel={fuel}
              activeShield={activeShield}
              activeMagnet={activeMagnet}
              carColor={selectedCar.color}
              combo={combo}
              level={level}
              xp={xp}
              activeMissions={activeMissions}
              onQuit={() => {
                audio.playClick();
                document.body.classList.remove('playing');
                setGameState('MENU');
              }}
            />

            {/* Micro gyro toggle float button */}
            <button
              onClick={() => {
                audio.playClick();
                setGyroscopeEnabled(!gyroscopeEnabled);
              }}
              className={`absolute top-20 right-4 p-2 text-[9px] pointer-events-auto border rounded-lg z-100 flex flex-col items-center justify-center gap-1 ${
                gyroscopeEnabled 
                  ? 'border-Dipin-cyan text-Dipin-cyan bg-Dipin-cyan-dim font-black' 
                  : 'border-glass-border text-text-muted bg-slate-950-60'
              }`}
            >
              <span>GYRO</span>
              <span>{gyroscopeEnabled ? 'ON' : 'OFF'}</span>
            </button>
          </motion.div>
        )}

        {gameState === 'GAME_OVER' && (
          <motion.div
            key="game-over"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.12 }}
            transition={{ duration: 0.35 }}
            className="absolute inset-0 flex items-center justify-center p-4"
          >
            <div className="glass-panel Dipin-glow-pink p-6 max-w-md w-full text-center cyber-corners flex flex-col items-center gap-5">
              <h1 className="font-display text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-red-500 Dipin-pulse-pink">
                GRID COLLISION
              </h1>

              <div className="w-full bg-slate-950/60 p-4 rounded-lg border border-slate-800 flex flex-col gap-2.5 font-display text-sm">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-text-secondary">DISTANCE RECORDED</span>
                  <span className="text-lg font-bold text-white">{score}m</span>
                </div>
                
                <div className="flex justify-between items-center text-xs">
                  <span className="text-text-secondary">CREDITS SECURED</span>
                  <span className="text-lg font-bold text-Dipin-yellow">+{sessionCoins}</span>
                </div>

                {selectedCar.id === 'police' && (
                  <div className="text-[9px] text-Dipin-yellow/80 mt-[-6px] text-right font-sans">
                    * 2x Interceptor Double Credits perk Applied
                  </div>
                )}

                <hr className="border-slate-800" />
                
                <div className="flex justify-between items-center text-xs">
                  <span className="text-text-secondary">GRID BEST DISTANCE</span>
                  <span className="text-lg font-bold text-Dipin-cyan">{highScore}m</span>
                </div>
              </div>

              <div className="flex flex-col gap-2.5 w-full">
                <button
                  className="Dipin-btn Dipin-btn-pink w-full py-2.5"
                  onClick={handleStartGame}
                >
                  REBOOT ENGINE
                </button>

                <button
                  className="Dipin-btn Dipin-btn-cyan w-full py-2.5"
                  onClick={() => {
                    audio.playClick();
                    setGameState('SELECT_CAR');
                  }}
                >
                  GARAGE STATION
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
