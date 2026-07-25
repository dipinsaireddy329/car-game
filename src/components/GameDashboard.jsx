import React, { useEffect, useState } from 'react';
import { Heart, Coins, Shield, Flame, Compass, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { touchControls } from '../game/TouchControls';

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
  combo,
  level,
  xp,
  activeMissions = [],
  onQuit
}) {
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile view based on width
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Convert speed ratio to simulated km/h
  const kmh = Math.round(speed * 320);

  // Dynamic hearts mapping
  const hearts = Array.from({ length: 4 }, (_, i) => i < lives);

  // XP level calculation helper
  const nextLevelXp = level * 1800;
  const xpPercent = Math.min(100, (xp / nextLevelXp) * 100);

  return (
    <div className="absolute inset-0 pointer-events-none z-50 font-display flex flex-col justify-between p-4 pb-6 select-none">
      
      {/* ── TOP HUD ROW ── */}
      <div className="w-full flex justify-between items-start pointer-events-auto">
        
        {/* Left Stats: Score, Coins, Combo Badge */}
        <div className="flex flex-col gap-2">
          <div className="flex gap-2 items-center">
            <div className="glass-panel border-l-4 p-2 flex gap-3 items-center" style={{ borderLeftColor: carColor }}>
              <div className="flex flex-col">
                <span className="text-[8px] text-text-secondary">DISTANCE</span>
                <span className="text-base font-extrabold text-white tracking-wider">{score}m</span>
              </div>
            </div>

            <div className="glass-panel border-l-4 p-2 flex gap-3 items-center border-l-Dipin-yellow">
              <Coins className="text-Dipin-yellow" size={15} />
              <div className="flex flex-col">
                <span className="text-[8px] text-text-secondary">COINS</span>
                <span className="text-base font-extrabold text-Dipin-yellow">{coins}</span>
              </div>
            </div>

            {/* Level Indicator Badge */}
            <div className="glass-panel p-2 flex items-center gap-1 border-l-4 border-l-Dipin-green">
              <Star className="text-Dipin-green fill-Dipin-green" size={13} />
              <span className="text-xs font-black text-white">LVL {level}</span>
            </div>
          </div>

          {/* XP Progress bar */}
          <div className="w-[180px] flex flex-col gap-1">
            <div className="xp-bar-outer">
              <div className="xp-bar-inner" style={{ width: `${xpPercent}%` }} />
            </div>
            <div className="flex justify-between text-[7px] text-text-secondary px-0.5">
              <span>XP: {xp}</span>
              <span>NEXT: {nextLevelXp}</span>
            </div>
          </div>
        </div>

        {/* Right Stats: Shield indicators, Lives, Quit button */}
        <div className="flex gap-3 items-center">
          {/* Active Powerup status lights */}
          <div className="flex gap-1">
            {activeShield && (
              <div className="glass-panel p-1.5 flex items-center justify-center border-Dipin-cyan animate-pulse">
                <Shield className="text-Dipin-cyan" size={14} />
              </div>
            )}
            {activeMagnet && (
              <div className="glass-panel p-1.5 flex items-center justify-center border-Dipin-purple animate-bounce">
                <Compass className="text-Dipin-purple" size={14} />
              </div>
            )}
          </div>

          {/* Lives list (Supports up to 4 lives) */}
          <div className="glass-panel p-2 flex gap-1 items-center bg-slate-950-60">
            {hearts.map((active, i) => (
              <Heart
                key={i}
                className={`transition-all duration-300 ${
                  active
                    ? 'text-Dipin-pink fill-Dipin-pink drop-shadow-pink'
                    : 'text-text-muted opacity-25'
                }`}
                size={15}
              />
            ))}
          </div>

          {/* Abort button */}
          <button
            onClick={onQuit}
            className="Dipin-btn Dipin-btn-pink py-1 px-3 min-h-0 text-[10px] pointer-events-auto h-8"
          >
            ABORT
          </button>
        </div>
      </div>

      {/* ── COMBO MULTIPLIER (Floating in center of screen) ── */}
      {combo > 1 && (
        <div className="absolute top-[85px] left-4 pointer-events-none">
          <div className="combo-badge flex items-center gap-1.5 text-xs text-white">
            <span className="text-Dipin-cyan font-black">COMBO</span>
            <span className="text-Dipin-pink font-black text-sm">x{combo}</span>
          </div>
        </div>
      )}

      {/* ── BOTTOM HUD ROW / MOBILE OVERLAYS ── */}
      <div className="w-full flex justify-between items-end">
        
        {/* LEFT BOTTOM COLUMN: Touch Steering OR Telemetry */}
        <div className="pointer-events-auto flex items-end">
          {isMobile ? (
            /* Mobile steer arrow touch widgets */
            <div className="flex gap-2 select-none">
              <div
                onTouchStart={() => touchControls.setLeft(true)}
                onTouchEnd={() => touchControls.setLeft(false)}
                onTouchCancel={() => touchControls.setLeft(false)}
                className="touch-btn touch-btn-steer flex items-center justify-center"
              >
                <ChevronLeft size={28} />
              </div>
              <div
                onTouchStart={() => touchControls.setRight(true)}
                onTouchEnd={() => touchControls.setRight(false)}
                onTouchCancel={() => touchControls.setRight(false)}
                className="touch-btn touch-btn-steer flex items-center justify-center"
              >
                <ChevronRight size={28} />
              </div>
            </div>
          ) : (
            /* Desktop Telemetry Widget */
            <div
              className="flex flex-col gap-2 max-w-[170px] w-full glass-panel p-3 border-l-4 text-xs bg-slate-950-60"
              style={{ borderLeftColor: carColor }}
            >
              <div className="flex items-center justify-between">
                <div className="speed-gauge glass-panel p-2 border-l-4" style={{ borderLeftColor: carColor }}>
                  <div className="text-[10px] text-text-secondary mb-1">SPEED</div>
                  <div className="font-bold text-white tracking-wider Dipin-glow-cyan" style={{ textShadow: `0 0 8px ${carColor}` }}>
                    {kmh}<span className="text-[8px] text-text-secondary ml-1">KM/H</span>
                  </div>
                </div>
              </div>

              {/* Fuel canister level */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[8px] items-center">
                  <span className="text-text-secondary">ENERGY</span>
                  <span className={fuel < 25 ? 'text-Dipin-pink animate-pulse' : 'text-white'}>
                    {Math.round(fuel)}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-950 border border-glass-border rounded overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 rounded ${
                      fuel < 25 ? 'bg-Dipin-pink animate-pulse' : 'bg-Dipin-green'
                    }`}
                    style={{
                      width: `${fuel}%`,
                      boxShadow: fuel < 25 ? '0 0 8px var(--Dipin-pink)' : '0 0 6px var(--Dipin-green)'
                    }}
                  />
                </div>
              </div>

              {/* Nitro tank */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[8px] items-center">
                  <span className="text-text-secondary">NITRO</span>
                  <span className={nitro >= 100 ? 'text-Dipin-cyan font-bold animate-pulse' : 'text-white'}>
                    {Math.round(nitro)}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-950 border border-glass-border rounded overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 rounded ${
                      nitro >= 100 ? 'bg-Dipin-cyan animate-pulse' : 'bg-Dipin-purple'
                    }`}
                    style={{
                      width: `${nitro}%`,
                      boxShadow: nitro >= 100 ? '0 0 8px var(--Dipin-cyan)' : '0 0 6px var(--Dipin-purple)'
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* CENTER BOTTOM COLUMN: Active Missions checklist display */}
        {activeMissions.length > 0 && (
          <div className="max-w-[170px] w-full flex flex-col gap-1 bg-slate-950-60 border border-glass-border rounded-lg p-2 hide-mobile">
            <span className="text-[7px] text-text-secondary font-black tracking-widest text-center border-b border-glass-border pb-1 mb-1">
              MISSIONS
            </span>
            {activeMissions.map((m, idx) => {
              const pct = Math.min(100, (m.progress / m.target) * 100);
              return (
                <div key={idx} className="mission-row">
                  <div className="flex justify-between w-full text-[8px] mb-0.5 text-white">
                    <span className="truncate max-w-[80px]">{m.title}</span>
                    <span>{m.progress}/{m.target}</span>
                  </div>
                  <div className="mission-progress-bar">
                    <div className="mission-progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* RIGHT BOTTOM COLUMN: Touch Nitro/Brake OR Desktop Keyboard Hint */}
        <div className="pointer-events-auto flex items-end">
          {isMobile ? (
            /* Mobile touch pads (Nitro, Brake) */
            <div className="flex gap-2 select-none">
              <div
                onTouchStart={() => touchControls.setBrake(true)}
                onTouchEnd={() => touchControls.setBrake(false)}
                onTouchCancel={() => touchControls.setBrake(false)}
                className="touch-btn touch-btn-brake touch-btn-lg flex flex-col justify-center items-center"
              >
                <span>BRAKE</span>
                <span className="text-[8px] opacity-75">{Math.round(fuel)}%</span>
              </div>
              <div
                onTouchStart={() => touchControls.setNitro(true)}
                onTouchEnd={() => touchControls.setNitro(false)}
                onTouchCancel={() => touchControls.setNitro(false)}
                className="touch-btn touch-btn-nitro touch-btn-lg flex flex-col justify-center items-center"
              >
                <span>NITRO</span>
                <span className="text-[8px] opacity-75">{Math.round(nitro)}%</span>
              </div>
            </div>
          ) : (
            /* Desktop key control guides */
            <div className="glass-panel p-3 text-[8.5px] text-text-secondary max-w-[150px] w-full text-right border-r-4 border-r-Dipin-cyan bg-slate-950-60">
              <p className="font-bold text-white mb-1">KEYBOARD PROTOCOLS</p>
              <p className="font-sans leading-normal">
                Steer: <span className="text-Dipin-cyan font-display">A / D</span> or <span className="text-Dipin-cyan font-display">← / →</span><br />
                Brake: <span className="text-Dipin-cyan font-display">S / ↓</span><br />
                Boost: <span className="text-Dipin-cyan font-display">SPACE / SHIFT</span><br />
                Near miss traffic for points multipliers.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default GameDashboard;
