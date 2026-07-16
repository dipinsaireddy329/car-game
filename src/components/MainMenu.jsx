import React from 'react';
import { Play, Sun, Moon, CloudRain, Shield, Award, Coins } from 'lucide-react';

function MainMenu({
  highScore,
  totalCoins,
  weatherMode,
  setWeatherMode,
  timeOfDay,
  setTimeOfDay,
  onSelectCar
}) {
  return (
    <div className="glass-panel neon-glow-cyan p-8 max-w-md w-full cyber-corners flex flex-col gap-6 items-center">
      {/* Title */}
      <div className="text-center">
        <h1 className="font-display text-4xl font-extrabold text-white tracking-widest neon-pulse-cyan">
          NEON
        </h1>
        <h2 className="font-display text-2xl font-bold text-neon-pink tracking-wider neon-pulse-pink">
          HIGHWAY RACER
        </h2>
        <p className="text-[10px] text-text-secondary mt-1 font-display tracking-widest">
          SYSTEM VERSION 2.0.46
        </p>
      </div>

      {/* Statistics */}
      <div className="w-full grid grid-cols-2 gap-3">
        <div className="flex items-center gap-3 p-3 bg-slate-950-60 border border-glass-border rounded-lg justify-center">
          <Award className="text-neon-cyan" size={20} />
          <div className="flex flex-col text-center">
            <span className="text-[10px] text-text-secondary font-display">BEST SCORE</span>
            <span className="font-display text-lg font-bold text-white">{highScore}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3 p-3 bg-slate-950-60 border border-glass-border rounded-lg justify-center">
          <Coins className="text-neon-yellow" size={20} />
          <div className="flex flex-col text-center">
            <span className="text-[10px] text-text-secondary font-display">COIN BANK</span>
            <span className="font-display text-lg font-bold text-neon-yellow">{totalCoins}</span>
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      <div className="w-full flex flex-col gap-4 border border-glass-border p-4 rounded-lg bg-slate-950-60">
        <h3 className="font-display text-xs font-bold text-neon-purple tracking-wider text-center">
          GRID PARAMETERS
        </h3>

        {/* Weather Setting */}
        <div className="flex justify-between items-center text-sm">
          <span className="text-text-secondary font-display text-xs">WEATHER</span>
          <div className="flex gap-2">
            <button
              onClick={() => setWeatherMode('clear')}
              className={`flex items-center gap-1 text-[11px] font-display px-3 py-1 border rounded transition-all ${
                weatherMode === 'clear'
                  ? 'border-neon-cyan text-neon-cyan bg-neon-cyan-dim'
                  : 'border-glass-border text-text-muted hover:text-white'
              }`}
            >
              <Sun size={12} /> CLEAR
            </button>
            <button
              onClick={() => setWeatherMode('rain')}
              className={`flex items-center gap-1 text-[11px] font-display px-3 py-1 border rounded transition-all ${
                weatherMode === 'rain'
                  ? 'border-neon-pink text-neon-pink bg-neon-pink-dim'
                  : 'border-glass-border text-text-muted hover:text-white'
              }`}
            >
              <CloudRain size={12} /> STORMY
            </button>
          </div>
        </div>

        {/* Time Setting */}
        <div className="flex justify-between items-center text-sm">
          <span className="text-text-secondary font-display text-xs">ENVIRONMENT</span>
          <div className="flex gap-2">
            <button
              onClick={() => setTimeOfDay('day')}
              className={`flex items-center gap-1 text-[11px] font-display px-3 py-1 border rounded transition-all ${
                timeOfDay === 'day'
                  ? 'border-neon-yellow text-neon-yellow bg-neon-yellow-dim'
                  : 'border-glass-border text-text-muted hover:text-white'
              }`}
            >
              <Sun size={12} /> SUNSET
            </button>
            <button
              onClick={() => setTimeOfDay('night')}
              className={`flex items-center gap-1 text-[11px] font-display px-3 py-1 border rounded transition-all ${
                timeOfDay === 'night'
                  ? 'border-neon-purple text-neon-purple bg-neon-purple-dim'
                  : 'border-glass-border text-text-muted hover:text-white'
              }`}
            >
              <Moon size={12} /> DARKNESS
            </button>
          </div>
        </div>
      </div>

      {/* Play Button */}
      <button
        onClick={onSelectCar}
        className="neon-btn neon-btn-cyan w-full flex items-center justify-center gap-2"
      >
        <Play size={18} fill="currentColor" /> ACCESS GARAGE
      </button>
    </div>
  );
}

export default MainMenu;
