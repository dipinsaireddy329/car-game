import React, { useEffect, useState } from 'react';
import { Play, Award, BarChart2, Gift, Star, Volume2, HelpCircle } from 'lucide-react';
import { audio } from '../utils/audio';

function MainMenu({
  highScore,
  totalCoins,
  themeSetting,
  setThemeSetting,
  onSelectCar,
  onOpenAchievements,
  onOpenStats,
  onClaimDaily,
  dailyClaimable
}) {
  const themes = [
    { id: 'random', name: 'Random', style: 'theme-preview-random' },
    { id: 'dawn', name: 'Dawn', style: 'theme-preview-dawn' },
    { id: 'day', name: 'Day', style: 'theme-preview-day' },
    { id: 'sunset', name: 'Sunset', style: 'theme-preview-sunset' },
    { id: 'night', name: 'Night', style: 'theme-preview-night' },
    { id: 'rain', name: 'Rain', style: 'theme-preview-rain' },
    { id: 'storm', name: 'Storm', style: 'theme-preview-storm' }
  ];

  return (
    <div className="glass-panel Dipin-glow-cyan p-6 max-w-md w-full cyber-corners flex flex-col gap-5 items-center relative select-none">
      
      {/* ── Title Branding ── */}
      <div className="text-center">
        <h1 className="font-display text-4xl font-extrabold text-white tracking-widest Dipin-pulse-cyan">
          DIPIN
        </h1>
        <h2 className="font-display text-2xl font-bold text-Dipin-pink tracking-wider Dipin-pulse-pink">
          HIGHWAY RACER
        </h2>
        <p className="text-[9px] text-text-secondary mt-1 font-display tracking-widest">
          GRID REBOOT v2.5.0
        </p>
      </div>

      {/* ── Best Score & Coin Bank Stats ── */}
      <div className="w-full grid grid-cols-2 gap-3 font-display">
        <div className="flex items-center gap-3 p-2.5 bg-slate-950-60 border border-glass-border rounded-lg justify-center">
          <Award className="text-Dipin-cyan" size={18} />
          <div className="flex flex-col text-center">
            <span className="text-[8px] text-text-secondary">BEST SCORE</span>
            <span className="text-base font-bold text-white">{highScore}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 p-2.5 bg-slate-950-60 border border-glass-border rounded-lg justify-center">
          <Star className="text-Dipin-yellow fill-Dipin-yellow" size={18} />
          <div className="flex flex-col text-center">
            <span className="text-[8px] text-text-secondary">CREDITS</span>
            <span className="text-base font-bold text-Dipin-yellow">{totalCoins}</span>
          </div>
        </div>
      </div>

      {/* ── 6-Theme Environmental Selection Tiles ── */}
      <div className="w-full flex flex-col gap-2 border border-glass-border p-3 rounded-lg bg-slate-950-60">
        <h3 className="font-display text-[9px] font-black text-Dipin-purple tracking-widest text-center">
          HIGHWAY CORE COORDINATES
        </h3>
        
        <div className="grid grid-cols-4 gap-1.5 mt-1">
          {themes.map(t => (
            <div
              key={t.id}
              onClick={() => {
                audio.playClick();
                setThemeSetting(t.id);
              }}
              className={`theme-tile ${themeSetting === t.id ? 'selected' : ''}`}
            >
              <div className={`theme-preview ${t.style}`} />
              <span className="truncate">{t.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Utility Buttons (Daily, Achievements, Stats) ── */}
      <div className="w-full grid grid-cols-3 gap-2">
        {/* Daily reward button */}
        <button
          onClick={onClaimDaily}
          disabled={!dailyClaimable}
          className={`Dipin-btn text-[10px] py-2 px-1 gap-1.5 h-11 flex flex-col justify-center border ${
            dailyClaimable 
              ? 'border-Dipin-yellow text-Dipin-yellow Dipin-pulse-yellow' 
              : 'border-glass-border text-text-muted'
          }`}
        >
          <Gift size={14} />
          <span>DAILY</span>
        </button>

        {/* Achievements panel */}
        <button
          onClick={onOpenAchievements}
          className="Dipin-btn Dipin-btn-purple text-[10px] py-2 px-1 gap-1.5 h-11 flex flex-col justify-center border"
        >
          <Award size={14} />
          <span>TROPHIES</span>
        </button>

        {/* Stats panel */}
        <button
          onClick={onOpenStats}
          className="Dipin-btn Dipin-btn-orange text-[10px] py-2 px-1 gap-1.5 h-11 flex flex-col justify-center border"
        >
          <BarChart2 size={14} />
          <span>STATS</span>
        </button>
      </div>

      {/* ── Access Garage Action ── */}
      <button
        onClick={onSelectCar}
        className="Dipin-btn Dipin-btn-cyan w-full flex items-center justify-center gap-2 py-3"
      >
        <Play size={16} fill="currentColor" /> ACCESS GARAGE STATION
      </button>
    </div>
  );
}

export default MainMenu;
