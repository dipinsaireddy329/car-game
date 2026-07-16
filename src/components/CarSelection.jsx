import React from 'react';
import { ArrowLeft, Play, Coins, ShieldCheck, Zap } from 'lucide-react';

function CarSelection({
  cars,
  selectedCar,
  setSelectedCar,
  unlockedCars,
  totalCoins,
  onBuy,
  onBack,
  onStart
}) {
  return (
    <div className="glass-panel neon-glow-purple p-6 max-w-4xl w-full cyber-corners flex flex-col gap-6">
      {/* Header */}
      <div className="flex justify-between items-center w-full border-b border-glass-border pb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs font-display text-text-secondary hover:text-neon-cyan transition-all"
        >
          <ArrowLeft size={16} /> MAIN SYSTEM
        </button>
        <h2 className="font-display text-xl font-bold text-white tracking-widest text-center">
          CHOOSE VEHICLE
        </h2>
        <div className="flex items-center gap-2 px-3 py-1 bg-slate-950-60 border border-glass-border rounded-lg">
          <Coins className="text-neon-yellow" size={16} />
          <span className="font-display text-sm font-bold text-neon-yellow">{totalCoins}</span>
        </div>
      </div>

      {/* Main Grid: Selection Left, Details Right */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Car List */}
        <div className="flex flex-col gap-3">
          <h3 className="font-display text-xs font-semibold text-text-secondary tracking-wider">
            AVAILABLE SCHEMATICS
          </h3>
          <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
            {cars.map((car) => {
              const isUnlocked = unlockedCars.includes(car.id);
              const isSelected = selectedCar.id === car.id;
              
              return (
                <button
                  key={car.id}
                  onClick={() => isUnlocked && setSelectedCar(car)}
                  className={`w-full text-left p-3 rounded-lg border transition-all relative overflow-hidden flex items-center justify-between ${
                    isSelected
                      ? 'bg-slate-900/60 border-2'
                      : isUnlocked
                      ? 'bg-slate-950-60 border-glass-border hover:border-slate-600'
                      : 'bg-slate-950/20 border-glass-border opacity-60 cursor-not-allowed'
                  }`}
                  style={{
                    borderColor: isSelected ? car.color : 'var(--glass-border)',
                    boxShadow: isSelected ? `0 0 10px ${car.color}66` : 'none'
                  }}
                  disabled={!isUnlocked}
                >
                  <div className="flex flex-col">
                    <span className="font-display text-sm font-bold text-white flex items-center gap-2">
                      {car.name}
                      {!isUnlocked && (
                        <span className="text-[10px] text-neon-yellow font-normal bg-neon-yellow-dim px-1.5 py-0.5 rounded flex items-center gap-1 font-sans">
                          <Coins size={10} /> {car.price}
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] text-text-secondary mt-1 font-sans">
                      {isUnlocked ? car.perkName : 'LOCKED'}
                    </span>
                  </div>

                  {isUnlocked && isSelected && (
                    <span className="text-[10px] font-display font-semibold px-2 py-0.5 rounded" style={{ color: car.color, border: `1px solid ${car.color}` }}>
                      ACTIVE
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Car Details */}
        <div className="flex flex-col justify-between bg-slate-950-60 border border-glass-border p-4 rounded-xl">
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-display text-lg font-bold text-white" style={{ textShadow: `0 0 10px ${selectedCar.color}44` }}>
                  {selectedCar.name}
                </h3>
                <p className="text-xs text-text-secondary mt-1 font-sans leading-relaxed">
                  {selectedCar.description}
                </p>
              </div>
              <span className="w-4 h-4 rounded-full" style={{ backgroundColor: selectedCar.color, boxShadow: `0 0 10px ${selectedCar.color}` }} />
            </div>

            {/* Stats Bars */}
            <div className="flex flex-col gap-2 font-display">
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[10px] text-text-secondary">
                  <span>MAX VELOCITY</span>
                  <span style={{ color: selectedCar.color }}>{selectedCar.speed}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${selectedCar.speed}%`, backgroundColor: selectedCar.color, boxShadow: `0 0 8px ${selectedCar.color}` }}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[10px] text-text-secondary">
                  <span>LATERAL HANDLING</span>
                  <span style={{ color: selectedCar.color }}>{selectedCar.handling}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${selectedCar.handling}%`, backgroundColor: selectedCar.color, boxShadow: `0 0 8px ${selectedCar.color}` }}
                  />
                </div>
              </div>
            </div>

            {/* Special perk info */}
            <div className="border border-dashed border-glass-border p-3 rounded-lg flex flex-col gap-1 bg-slate-900/40">
              <div className="flex items-center gap-1.5 text-xs font-display font-semibold text-neon-green">
                <Zap size={14} /> SPECIAL PERK: {selectedCar.perkName}
              </div>
              <div className="text-[10px] text-text-secondary font-sans">
                {selectedCar.perkDesc}
              </div>
            </div>
          </div>

          {/* Action Button: BUY or DEPLOY */}
          <div className="mt-4 pt-4 border-t border-glass-border">
            {unlockedCars.includes(selectedCar.id) ? (
              <button
                onClick={onStart}
                className="neon-btn w-full flex items-center justify-center gap-2"
                style={{
                  borderColor: selectedCar.color,
                  color: selectedCar.color,
                  boxShadow: `0 0 10px ${selectedCar.color}33`
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = selectedCar.color;
                  e.currentTarget.style.color = '#000';
                  e.currentTarget.style.boxShadow = `0 0 20px ${selectedCar.color}`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(10, 10, 24, 0.8)';
                  e.currentTarget.style.color = selectedCar.color;
                  e.currentTarget.style.boxShadow = `0 0 10px ${selectedCar.color}33`;
                }}
              >
                <Play size={16} fill="currentColor" /> DEPLOY TO GRID
              </button>
            ) : (
              <button
                onClick={() => onBuy(selectedCar)}
                className={`w-full neon-btn flex items-center justify-center gap-2 ${
                  totalCoins >= selectedCar.price
                    ? 'neon-btn-purple'
                    : 'border-glass-border text-text-muted cursor-not-allowed'
                }`}
                disabled={totalCoins < selectedCar.price}
              >
                <Coins size={16} /> UNLOCK PERK SCHEMATIC (-{selectedCar.price} COINS)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CarSelection;
