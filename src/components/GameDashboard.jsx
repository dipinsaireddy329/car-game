import React from 'react';
import { Heart, Coins, Navigation, Shield, Zap, Compass, Flame, AlertCircle } from 'lucide-react';

function GameDashboard({
  score,
  coins,
  lives,
  speed,
  nitro,
  fuel,
  activeShield,
  activeMagnet,
  carColor,
  onQuit
}) {
  // Convert speed ratio to simulated km/h
  const kmh = Math.round(speed * 320);

  // Lives array helper
  const hearts = Array.from({ length: 3 }, (_, i) => i < lives);

  return (
    <div className="absolute inset-0 pointer-events-none z-50 font-display flex flex-col justify-between p-4">
      {/* Top HUD Bar */}
      <div className="w-full flex justify-between items-center pointer-events-auto">
        {/* Left Side: Score & Coins */}
        <div className="flex gap-4 items-center">
          <div className="glass-panel border-l-4 p-3 flex gap-3 items-center" style={{ borderLeftColor: carColor }}>
            <div className="flex flex-col">
              <span className="text-[9px] text-text-secondary">DISTANCE</span>
              <span className="text-xl font-extrabold text-white tracking-wider">{score}m</span>
            </div>
          </div>

          <div className="glass-panel border-l-4 p-3 flex gap-3 items-center border-l-Dipin-yellow">
            <Coins className="text-Dipin-yellow animate-pulse" size={16} />
            <div className="flex flex-col">
              <span className="text-[9px] text-text-secondary">DATA COINS</span>
              <span className="text-xl font-extrabold text-Dipin-yellow">{coins}</span>
            </div>
          </div>
        </div>

        {/* Right Side: Lives and Abort Button */}
        <div className="flex gap-4 items-center">
          {/* Active Power-up Overlay indicators */}
          <div className="flex gap-2">
            {activeShield && (
              <div className="glass-panel p-2 flex items-center justify-center Dipin-glow-cyan border-Dipin-cyan animate-bounce">
                <Shield className="text-Dipin-cyan" size={16} />
              </div>
            )}
            {activeMagnet && (
              <div className="glass-panel p-2 flex items-center justify-center Dipin-glow-purple border-Dipin-purple animate-pulse">
                <Compass className="text-Dipin-purple" size={16} />
              </div>
            )}
          </div>

          {/* Lives Display */}
          <div className="glass-panel p-3 flex gap-1.5 items-center">
            {hearts.map((active, i) => (
              <Heart
                key={i}
                className={`transition-all duration-300 ${active
                    ? 'text-Dipin-pink fill-Dipin-pink filter drop-shadow-[0_0_5px_var(--Dipin-pink)]'
                    : 'text-text-muted opacity-30'
                  }`}
                size={18}
              />
            ))}
          </div>

          {/* Abort button */}
          <button
            onClick={onQuit}
            className="Dipin-btn Dipin-btn-pink py-1.5 px-4 text-xs font-bold pointer-events-auto"
          >
            ABORT
          </button>
        </div>
      </div>

      {/* Bottom HUD Bar / Floating Left Panel for Dashboard Gauges */}
      <div className="flex justify-between items-end w-full">
        {/* Left Side: Telemetry Widgets (Speed, Nitro, Fuel) */}
        <div className="flex flex-col gap-3 max-w-[200px] w-full pointer-events-auto glass-panel p-4 border-l-4" style={{ borderLeftColor: carColor }}>
          <h4 className="text-[10px] text-text-secondary tracking-widest text-center border-b border-glass-border pb-1.5 mb-1">
            GRID TELEMETRY
          </h4>

          {/* Speedometer */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-text-secondary">VELOCITY</span>
            <span className="text-base font-bold text-white tracking-wider" style={{ textShadow: `0 0 5px ${carColor}` }}>
              {kmh} <span className="text-[9px] text-text-secondary">KM/H</span>
            </span>
          </div>

          {/* Fuel Level */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-[9px] items-center">
              <span className="text-text-secondary flex items-center gap-1">
                ENERGY CELL
              </span>
              <span className={fuel < 25 ? "text-Dipin-pink animate-pulse" : "text-white"}>
                {Math.round(fuel)}%
              </span>
            </div>
            <div className="w-full h-2 bg-slate-950 border border-glass-border rounded overflow-hidden">
              <div
                className={`h-full transition-all duration-300 rounded ${fuel < 25
                    ? 'bg-Dipin-pink animate-pulse'
                    : 'bg-Dipin-green'
                  }`}
                style={{
                  width: `${fuel}%`,
                  boxShadow: fuel < 25 ? '0 0 8px var(--Dipin-pink)' : '0 0 8px var(--Dipin-green)'
                }}
              />
            </div>
            {fuel < 25 && (
              <span className="text-[8px] text-Dipin-pink flex items-center gap-1 animate-pulse justify-center">
                <AlertCircle size={8} /> CRITICAL FUEL LEVEL
              </span>
            )}
          </div>

          {/* Nitro Charge */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-[9px] items-center">
              <span className="text-text-secondary flex items-center gap-1">
                <Flame size={10} className="text-Dipin-cyan" /> NITRO CHARGE
              </span>
              <span className={nitro >= 100 ? "text-Dipin-cyan font-bold" : "text-white"}>
                {Math.round(nitro)}%
              </span>
            </div>
            <div className="w-full h-2 bg-slate-950 border border-glass-border rounded overflow-hidden">
              <div
                className={`h-full transition-all duration-300 rounded ${nitro >= 100
                    ? 'bg-Dipin-cyan animate-pulse'
                    : 'bg-Dipin-purple'
                  }`}
                style={{
                  width: `${nitro}%`,
                  boxShadow: nitro >= 100 ? '0 0 10px var(--Dipin-cyan)' : '0 0 8px var(--Dipin-purple)'
                }}
              />
            </div>
            {nitro >= 100 && (
              <span className="text-[8px] text-Dipin-cyan font-bold flex items-center gap-1 animate-pulse justify-center font-display">
                PRESS SPACE / SHIFT TO BOOST
              </span>
            )}
          </div>
        </div>

        {/* Right Side: Driving Control Help Tips */}
        <div className="glass-panel p-3 text-[9px] text-text-secondary max-w-[180px] w-full text-right border-r-4 border-r-Dipin-cyan">
          <p className="font-bold text-white mb-1">CONTROL PROTOCOLS</p>
          <p className="font-sans leading-relaxed">
            Move: <span className="text-Dipin-cyan font-display">A / D</span> or <span className="text-Dipin-cyan font-display">← / →</span><br />
            Brake: <span className="text-Dipin-cyan font-display">S / ↓</span><br />
            Boost: <span className="text-Dipin-cyan font-display">SPACE / SHIFT</span><br />
            Avoid: Traffic blocks<br />
            Collect: fuel cells & credits
          </p>
        </div>
      </div>
    </div>
  );
}

export default GameDashboard;
