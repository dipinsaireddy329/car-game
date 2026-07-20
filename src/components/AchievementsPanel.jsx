import React from 'react';
import { Award, Lock, CheckCircle, ArrowLeft } from 'lucide-react';
import { audio } from '../utils/audio';

const ACHIEVEMENT_LIST = [
  {
    id: 'first_ride',
    title: 'First Grid Run',
    description: 'Enter the cyber loop and complete a race.',
    iconColor: 'var(--Dipin-cyan)'
  },
  {
    id: 'speed_demon',
    title: 'Grid Breaker',
    description: 'Reach a top velocity of 280+ km/h.',
    iconColor: 'var(--Dipin-pink)'
  },
  {
    id: 'grid_runner',
    title: 'Far Horizon',
    description: 'Drive a total score of 5,000+ meters in a run.',
    iconColor: 'var(--Dipin-purple)'
  },
  {
    id: 'coin_hoarder',
    title: 'Resource Banker',
    description: 'Accumulate 200+ total lifetime credits.',
    iconColor: 'var(--Dipin-yellow)'
  }
];

function AchievementsPanel({ onBack }) {
  // Load unlocked states from localStorage
  const savedAch = localStorage.getItem('dipin_achievements');
  const unlocked = savedAch ? JSON.parse(savedAch) : {};

  return (
    <div className="glass-panel Dipin-glow-purple p-6 max-w-md w-full cyber-corners flex flex-col gap-5 select-none font-display">
      
      {/* Title */}
      <div className="text-center relative">
        <h1 className="text-2xl font-black text-white tracking-widest Dipin-pulse-purple">
          GRID TROPHIES
        </h1>
        <p className="text-[9px] text-text-secondary mt-1">
          RECONSTRUCTED ARCHIVE SYSTEM
        </p>
      </div>

      {/* Grid of badges */}
      <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-1">
        {ACHIEVEMENT_LIST.map(a => {
          const isUnlocked = !!unlocked[a.id];
          return (
            <div
              key={a.id}
              className={`flex items-center gap-4 p-3 border rounded-lg bg-slate-950-60 transition-all ${
                isUnlocked 
                  ? 'border-l-4 border-l-Dipin-yellow border-glass-border' 
                  : 'border-glass-border opacity-40'
              }`}
            >
              {/* Badge Icon */}
              <div 
                className="p-2 rounded-full flex items-center justify-center bg-slate-900 border border-glass-border"
                style={{ color: isUnlocked ? a.iconColor : 'var(--text-muted)' }}
              >
                {isUnlocked ? <Award size={20} className="drop-shadow-cyan" /> : <Lock size={20} />}
              </div>

              {/* Texts */}
              <div className="flex flex-col text-left flex-1 min-w-0">
                <span className={`text-xs font-bold leading-normal truncate ${isUnlocked ? 'text-white' : 'text-text-muted'}`}>
                  {a.title}
                </span>
                <span className="text-[9px] text-text-secondary leading-tight mt-0.5 whitespace-normal font-sans">
                  {a.description}
                </span>
              </div>

              {/* Status */}
              <div>
                {isUnlocked ? (
                  <CheckCircle size={15} className="text-Dipin-green" />
                ) : (
                  <span className="text-[8px] text-text-muted font-bold">LOCKED</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Back button */}
      <button
        onClick={() => {
          audio.playClick();
          onBack();
        }}
        className="Dipin-btn Dipin-btn-purple w-full flex items-center justify-center gap-2 mt-2"
      >
        <ArrowLeft size={15} /> BACK TO MENU
      </button>

    </div>
  );
}

export default AchievementsPanel;
