import React from 'react';
import { ArrowLeft, Play, Coins, Zap, ShieldAlert, Award } from 'lucide-react';

function CarSelection({
  cars,
  selectedCar,
  setSelectedCar,
  unlockedCars,
  upgrades,
  onUpgrade,
  totalCoins,
  onBuy,
  onBack,
  onStart
}) {
  const currentUpgrades = upgrades[selectedCar.id] || { speed: 1, handling: 1 };
  const maxUpgrades = 5;

  const getUpgradeCost = (currentLevel) => {
    return currentLevel * 50; // 50, 100, 150, 200
  };

  // Helper to render upgrade pips/cells (1 to 5)
  const renderPips = (level) => {
    return (
      <div className="flex gap-1">
        {Array.from({ length: maxUpgrades }).map((_, i) => (
          <div
            key={i}
            className={`w-6 h-2 border rounded-sm transition-all duration-300 ${
              i < level
                ? 'bg-neon-green border-neon-green shadow-[0_0_8px_var(--neon-green)]'
                : 'bg-slate-950 border-glass-border'
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="glass-panel neon-glow-purple p-6 max-w-4xl w-full cyber-corners flex flex-col gap-6">
      {/* Top Header Bar */}
      <div className="flex justify-between items-center w-full border-b border-glass-border pb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs font-display text-text-secondary hover:text-neon-cyan transition-all cursor-pointer"
        >
          <ArrowLeft size={16} /> MAIN SYSTEM
        </button>
        <h2 className="font-display text-xl font-bold text-white tracking-widest text-center">
          GARAGE STATION WORKSHOP
        </h2>
        <div className="flex items-center gap-2 px-3 py-1 bg-slate-950-60 border border-glass-border rounded-lg">
          <Coins className="text-neon-yellow" size={16} />
          <span className="font-display text-sm font-bold text-neon-yellow">{totalCoins}</span>
        </div>
      </div>

      {/* Main Grid Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Side: Vehicle Schematics List */}
        <div className="flex flex-col gap-3">
          <h3 className="font-display text-xs font-semibold text-text-secondary tracking-wider">
            VEHICLE SCHEMATICS
          </h3>
          <div className="flex flex-col gap-2 max-h-[360px] overflow-y-auto pr-1">
            {cars.map((car) => {
              const isUnlocked = unlockedCars.includes(car.id);
              const isSelected = selectedCar.id === car.id;
              
              return (
                <button
                  key={car.id}
                  onClick={() => isUnlocked && setSelectedCar(car)}
                  className={`w-full text-left p-3 rounded-lg border transition-all relative overflow-hidden flex items-center justify-between cursor-pointer ${
                    isSelected
                      ? 'bg-slate-900/60 border-2'
                      : isUnlocked
                      ? 'bg-slate-950-60 border-glass-border hover:border-slate-600'
                      : 'bg-slate-950/20 border-glass-border opacity-60 hover:opacity-80'
                  }`}
                  style={{
                    borderColor: isSelected ? car.color : 'var(--glass-border)',
                    boxShadow: isSelected ? `0 0 12px ${car.color}66` : 'none'
                  }}
                >
                  <div className="flex flex-col">
                    <span className="font-display text-sm font-bold text-white flex items-center gap-2">
                      {car.name}
                      {!isUnlocked && (
                        <span className="text-[10px] text-neon-yellow font-normal bg-neon-yellow-dim px-2 py-0.5 rounded flex items-center gap-1 font-sans border border-neon-yellow/30">
                          <Coins size={10} /> {car.price}
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] text-text-secondary mt-1 font-sans">
                      {isUnlocked ? `Perk: ${car.perkName}` : 'SCHEMATIC LOCKED'}
                    </span>
                  </div>

                  {isUnlocked ? (
                    isSelected ? (
                      <span className="text-[9px] font-display font-bold px-2 py-0.5 rounded" style={{ color: car.color, border: `1px solid ${car.color}` }}>
                        ACTIVE
                      </span>
                    ) : (
                      <span className="text-[9px] text-text-secondary font-display border border-glass-border px-2 py-0.5 rounded hover:text-white">
                        SELECT
                      </span>
                    )
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // prevent select action
                        onBuy(car);
                      }}
                      disabled={totalCoins < car.price}
                      className={`text-[9px] font-display px-2 py-1 border rounded transition-all cursor-pointer ${
                        totalCoins >= car.price
                          ? 'border-neon-yellow text-neon-yellow bg-neon-yellow-dim hover:bg-neon-yellow hover:text-black font-semibold'
                          : 'border-glass-border text-text-muted cursor-not-allowed'
                      }`}
                    >
                      ACQUIRE
                    </button>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Side: Detailed Stats and Upgrades */}
        <div className="flex flex-col justify-between bg-slate-950-60 border border-glass-border p-4 rounded-xl gap-4">
          {/* Header Description */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-display text-lg font-bold text-white" style={{ textShadow: `0 0 10px ${selectedCar.color}44` }}>
                  {selectedCar.name}
                </h3>
                <p className="text-xs text-text-secondary mt-1 font-sans leading-relaxed">
                  {selectedCar.description}
                </p>
              </div>
              <span className="w-4 h-4 rounded-full mt-1.5" style={{ backgroundColor: selectedCar.color, boxShadow: `0 0 12px ${selectedCar.color}` }} />
            </div>

            {/* Unique Perk Card */}
            <div className="border border-dashed border-glass-border p-3 rounded-lg flex flex-col gap-1 bg-slate-900/40 mt-1">
              <div className="flex items-center gap-1.5 text-xs font-display font-semibold text-neon-green">
                <Zap size={14} className="animate-pulse" /> UNIQUE MODULE: {selectedCar.perkName}
              </div>
              <div className="text-[10px] text-text-secondary font-sans leading-relaxed">
                {selectedCar.perkDesc}
              </div>
            </div>
          </div>

          {/* Upgrades Workshop Panel */}
          {unlockedCars.includes(selectedCar.id) ? (
            <div className="border border-glass-border p-4 rounded-lg bg-slate-950/80 flex flex-col gap-4">
              <h4 className="text-center font-display text-xs font-bold text-neon-cyan tracking-wider">
                CORE CALIBRATION WORKSHOP
              </h4>

              {/* Speed upgrade calibration */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center text-xs font-display">
                  <span className="text-white">ENGINE VELOCITY</span>
                  <span className="text-text-secondary">Level {currentUpgrades.speed} / 5</span>
                </div>
                <div className="flex justify-between items-center gap-4">
                  {renderPips(currentUpgrades.speed)}
                  {currentUpgrades.speed < 5 ? (
                    <button
                      onClick={() => onUpgrade(selectedCar.id, 'speed')}
                      disabled={totalCoins < getUpgradeCost(currentUpgrades.speed)}
                      className={`text-[10px] font-display px-3 py-1 border rounded transition-all cursor-pointer ${
                        totalCoins >= getUpgradeCost(currentUpgrades.speed)
                          ? 'border-neon-cyan text-neon-cyan bg-neon-cyan-dim hover:bg-neon-cyan hover:text-black font-semibold'
                          : 'border-glass-border text-text-muted cursor-not-allowed'
                      }`}
                    >
                      +{getUpgradeCost(currentUpgrades.speed)}c
                    </button>
                  ) : (
                    <span className="text-[9px] font-display text-neon-yellow border border-neon-yellow/30 bg-neon-yellow-dim px-2 py-0.5 rounded">
                      MAX LEVEL
                    </span>
                  )}
                </div>
              </div>

              {/* Handling upgrade calibration */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center text-xs font-display">
                  <span className="text-white">LATERAL VECTOR DAMPERS</span>
                  <span className="text-text-secondary">Level {currentUpgrades.handling} / 5</span>
                </div>
                <div className="flex justify-between items-center gap-4">
                  {renderPips(currentUpgrades.handling)}
                  {currentUpgrades.handling < 5 ? (
                    <button
                      onClick={() => onUpgrade(selectedCar.id, 'handling')}
                      disabled={totalCoins < getUpgradeCost(currentUpgrades.handling)}
                      className={`text-[10px] font-display px-3 py-1 border rounded transition-all cursor-pointer ${
                        totalCoins >= getUpgradeCost(currentUpgrades.handling)
                          ? 'border-neon-pink text-neon-pink bg-neon-pink-dim hover:bg-neon-pink hover:text-black font-semibold'
                          : 'border-glass-border text-text-muted cursor-not-allowed'
                      }`}
                    >
                      +{getUpgradeCost(currentUpgrades.handling)}c
                    </button>
                  ) : (
                    <span className="text-[9px] font-display text-neon-yellow border border-neon-yellow/30 bg-neon-yellow-dim px-2 py-0.5 rounded">
                      MAX LEVEL
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-6 bg-slate-950/60 border border-dashed border-glass-border rounded-lg text-center gap-2">
              <ShieldAlert className="text-neon-pink animate-pulse" size={24} />
              <div className="font-display text-xs text-white">UPGRADES LOCKED</div>
              <p className="text-[10px] text-text-secondary leading-relaxed">
                You must purchase and unlock this vehicle's schematic blueprints to calibrate its core.
              </p>
            </div>
          )}

          {/* Action Button: DEPLOY or PURCHASE */}
          <div className="border-t border-glass-border pt-4">
            {unlockedCars.includes(selectedCar.id) ? (
              <button
                onClick={onStart}
                className="neon-btn w-full flex items-center justify-center gap-2 cursor-pointer"
                style={{
                  borderColor: selectedCar.color,
                  color: selectedCar.color,
                  boxShadow: `0 0 12px ${selectedCar.color}33`
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = selectedCar.color;
                  e.currentTarget.style.color = '#000';
                  e.currentTarget.style.boxShadow = `0 0 20px ${selectedCar.color}`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(10, 10, 24, 0.8)';
                  e.currentTarget.style.color = selectedCar.color;
                  e.currentTarget.style.boxShadow = `0 0 12px ${selectedCar.color}33`;
                }}
              >
                <Play size={16} fill="currentColor" /> DEPLOY CAR TO GRID
              </button>
            ) : (
              <button
                onClick={() => onBuy(selectedCar)}
                className={`w-full neon-btn flex items-center justify-center gap-2 cursor-pointer ${
                  totalCoins >= selectedCar.price
                    ? 'neon-btn-purple'
                    : 'border-glass-border text-text-muted cursor-not-allowed'
                }`}
                disabled={totalCoins < selectedCar.price}
              >
                <Coins size={16} /> ACQUIRE SCHEMATIC ({selectedCar.price} COINS)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CarSelection;
