import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX } from 'lucide-react';
import MainMenu from './components/MainMenu';
import CarSelection from './components/CarSelection';
import GameDashboard from './components/GameDashboard';
import GameEngine from './game/GameEngine';
import { audio } from './utils/audio';

// Expanded Cars Database (10 Vehicles: Added Cybertruck and Lightcycle, all free!)
export const CARS = [
  {
    id: 'roadster',
    name: 'Cyber Roadster',
    description: 'Sleek starter machine built for cyber grid cruising. Balanced dynamics.',
    speed: 65,
    handling: 75,
    perkName: 'E-Magnet Plus',
    perkDesc: 'Coin attraction magnet lasts 30% longer.',
    color: '#00f0ff', // neon cyan
    price: 0,
    trail: 'rgba(0, 240, 255, 0.4)'
  },
  {
    id: 'cruiser',
    name: 'Neon Cruiser',
    description: 'Armored heavy-duty patrol racer. Higher endurance and shields.',
    speed: 55,
    handling: 60,
    perkName: 'Shield Capacitor',
    perkDesc: 'Starts game with a shielding field active.',
    color: '#9d4edd', // neon purple
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
    color: '#ff5722', // neon orange
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
    color: '#ffd700', // neon yellow
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
    color: '#e91e63', // hot pink
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
    color: '#ff007f', // neon pink
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
    color: '#39ff14', // neon green
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
    color: '#ffffff', // bright white
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
    color: '#a1a1aa', // steel grey
    price: 0,
    trail: 'rgba(161, 161, 170, 0.4)'
  },
  {
    id: 'lightcycle',
    name: 'Vector Lightcycle',
    description: 'Ultra-narrow grid-skimming neon motorcycle. Exceptional agility and profile.',
    speed: 92,
    handling: 98,
    perkName: 'Slipstream Profile',
    perkDesc: 'Extremely narrow 26px vehicle hitbox allowing effortless lane splitting.',
    color: '#00ff66', // neon lime
    price: 0,
    trail: 'rgba(0, 255, 102, 0.4)'
  }
];

function App() {
  const [gameState, setGameState] = useState('MENU'); // MENU, SELECT_CAR, PLAYING, GAME_OVER
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
  
  // Settings
  const [weatherMode, setWeatherMode] = useState('clear'); // clear, rain
  const [timeOfDay, setTimeOfDay] = useState('night'); // day, night
  const [muted, setMuted] = useState(false);
  const [shake, setShake] = useState(false);

  // Load progress from localStorage
  useEffect(() => {
    const savedHighScore = localStorage.getItem('neon_racer_high_score');
    const savedCoins = localStorage.getItem('neon_racer_total_coins');
    const savedUnlocked = localStorage.getItem('neon_racer_unlocked_cars');
    const savedUpgrades = localStorage.getItem('neon_racer_upgrades');
    const savedMuted = localStorage.getItem('neon_racer_muted');

    if (savedHighScore) setHighScore(parseInt(savedHighScore, 10));
    if (savedCoins) setCoins(parseInt(savedCoins, 10));
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
      } catch (e) {
        // use default
      }
    }
    if (savedMuted === 'true') {
      setMuted(true);
      audio.muted = true;
    }
  }, []);

  // Control background music based on state
  useEffect(() => {
    if (gameState === 'PLAYING') {
      audio.startMusic();
      audio.startEngine();
    } else {
      audio.stopEngine();
      if (gameState === 'GAME_OVER') {
        audio.stopMusic();
      } else {
        if (!muted && (gameState === 'MENU' || gameState === 'SELECT_CAR')) {
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
    localStorage.setItem('neon_racer_muted', isMuted ? 'true' : 'false');
    audio.playClick();
  };

  const handleStartGame = () => {
    audio.playClick();
    setScore(0);
    setSessionCoins(0);
    
    // Sentinel & Cybertruck start with 4 lives, others have 3
    const startLives = (selectedCar.id === 'sentinel' || selectedCar.id === 'cybertruck') ? 4 : 3;
    setLives(startLives);
    
    setFuel(100);
    setNitro(0);
    setActiveShield(selectedCar.id === 'cruiser'); 
    setActiveMagnet(false);
    setGameState('PLAYING');
  };

  const handleBuyCar = (car) => {
    if (coins >= car.price && !unlockedCars.includes(car.id)) {
      const newCoins = coins - car.price;
      const newUnlocked = [...unlockedCars, car.id];
      
      setCoins(newCoins);
      setUnlockedCars(newUnlocked);
      
      localStorage.setItem('neon_racer_total_coins', newCoins.toString());
      localStorage.setItem('neon_racer_unlocked_cars', JSON.stringify(newUnlocked));
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

      localStorage.setItem('neon_racer_total_coins', newCoins.toString());
      localStorage.setItem('neon_racer_upgrades', JSON.stringify(newUpgrades));
      audio.playShield();
    } else {
      audio.playClick();
    }
  };

  const handleGameOver = (finalScore, finalCoins) => {
    audio.playCrash();
    
    // Interceptor double coin perk
    const processedCoins = selectedCar.id === 'police' ? finalCoins * 2 : finalCoins;
    
    const newCoinsBank = coins + processedCoins;
    setCoins(newCoinsBank);
    localStorage.setItem('neon_racer_total_coins', newCoinsBank.toString());

    if (finalScore > highScore) {
      setHighScore(finalScore);
      localStorage.setItem('neon_racer_high_score', finalScore.toString());
    }

    setSessionCoins(processedCoins);
    setScore(finalScore);
    setGameState('GAME_OVER');
  };

  const triggerScreenShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 400);
  };

  return (
    <div className={`relative w-full h-full overflow-hidden ${shake ? 'shake-screen' : ''}`}>
      {/* Retro background lines & CRT effects */}
      <div className="cyber-grid-container" />
      <div className="scanlines" />
      <div className="vignette" />

      {/* Mute Button */}
      <button 
        className="audio-toggle-btn"
        onClick={handleToggleMute}
        title={muted ? "Unmute Sound" : "Mute Sound"}
      >
        {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
      </button>

      {/* Screen Transitions */}
      <AnimatePresence mode="wait">
        {gameState === 'MENU' && (
          <motion.div
            key="menu"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 flex items-center justify-center p-4"
          >
            <MainMenu
              highScore={highScore}
              totalCoins={coins}
              weatherMode={weatherMode}
              setWeatherMode={setWeatherMode}
              timeOfDay={timeOfDay}
              setTimeOfDay={setTimeOfDay}
              onSelectCar={() => {
                audio.playClick();
                setGameState('SELECT_CAR');
              }}
            />
          </motion.div>
        )}

        {gameState === 'SELECT_CAR' && (
          <motion.div
            key="select-car"
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            transition={{ duration: 0.3 }}
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

        {gameState === 'PLAYING' && (
          <motion.div
            key="playing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 w-full h-full"
          >
            {/* Canvas Game Engine */}
            <GameEngine
              selectedCar={selectedCar}
              carUpgrades={upgrades[selectedCar.id] || { speed: 1, handling: 1 }}
              weatherMode={weatherMode}
              timeOfDay={timeOfDay}
              onGameOver={handleGameOver}
              onScoreUpdate={setScore}
              onCoinsUpdate={setSessionCoins}
              onLivesUpdate={setLives}
              onSpeedUpdate={setSpeed}
              onNitroUpdate={setNitro}
              onFuelUpdate={setFuel}
              onShieldUpdate={setActiveShield}
              onMagnetUpdate={setActiveMagnet}
              onHit={triggerScreenShake}
            />

            {/* Dashboard HUD overlay */}
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
              onQuit={() => {
                audio.playClick();
                setGameState('MENU');
              }}
            />
          </motion.div>
        )}

        {gameState === 'GAME_OVER' && (
          <motion.div
            key="game-over"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.15 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0 flex items-center justify-center p-4"
          >
            <div className="glass-panel neon-glow-pink p-8 max-w-md w-full text-center cyber-corners flex flex-col items-center gap-6">
              <h1 className="font-display text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-red-500 neon-pulse-pink">
                GRID COLLISION
              </h1>
              
              <div className="w-full bg-slate-950/60 p-5 rounded-lg border border-slate-800 flex flex-col gap-3 font-display">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-text-secondary">DISTANCE SCORE</span>
                  <span className="text-xl font-bold text-white">{score}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-text-secondary">COINS SECURED</span>
                  <span className="text-xl font-bold text-neon-yellow">+{sessionCoins}</span>
                </div>
                {selectedCar.id === 'police' && (
                  <div className="text-[10px] text-neon-yellow/80 mt-[-6px] text-right font-sans">
                    * 2X Interceptor Data Perk Applied
                  </div>
                )}
                <hr className="border-slate-800" />
                <div className="flex justify-between items-center text-sm">
                  <span className="text-text-secondary">PERSONAL BEST</span>
                  <span className="text-xl font-bold text-neon-cyan">{highScore}</span>
                </div>
              </div>

              <div className="flex flex-col gap-3 w-full">
                <button
                  className="neon-btn neon-btn-pink w-full"
                  onClick={handleStartGame}
                >
                  REBOOT ENGINE
                </button>
                
                <button
                  className="neon-btn neon-btn-cyan w-full"
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
