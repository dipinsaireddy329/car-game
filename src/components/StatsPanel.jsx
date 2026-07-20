import React from 'react';
import { BarChart2, Calendar, Navigation, Coins, Shield, ArrowLeft } from 'lucide-react';
import { audio } from '../utils/audio';

function StatsPanel({ onBack }) {
  // Load stats from localStorage
  const savedStatsStr = localStorage.getItem('dipin_stats');
  const stats = savedStatsStr ? JSON.parse(savedStatsStr) : {
    totalRuns: 0,
    bestDistance: 0,
    bestSpeed: 0,
    totalCoins: 0
  };

  const statItems = [
    { label: 'TOTAL GRID RUNS', value: stats.totalRuns, icon: Calendar, color: 'var(--Dipin-cyan)' },
    { label: 'RECORD DISTANCE', value: `${stats.bestDistance}m`, icon: Navigation, color: 'var(--Dipin-pink)' },
    { label: 'MAX VELOCITY', value: `${stats.bestSpeed} KM/H`, icon: Shield, color: 'var(--Dipin-orange)' },
    { label: 'LIFETIME CREDITS', value: stats.totalCoins, icon: Coins, color: 'var(--Dipin-yellow)' }
  ];

  return (
    <div className="glass-panel Dipin-glow-orange p-6 max-w-md w-full cyber-corners flex flex-col gap-5 select-none font-display">
      
      {/* Title */}
      <div className="text-center relative">
        <h1 className="text-2xl font-black text-white tracking-widest Dipin-pulse-orange">
          GRID STATISTICS
        </h1>
        <p className="text-[9px] text-text-secondary mt-1">
          GRID TELEMETRY METRIC LOGS
        </p>
      </div>

      {/* Grid of stats */}
      <div className="grid grid-cols-2 gap-3 mt-1">
        {statItems.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div
              key={idx}
              className="flex flex-col items-center p-3 bg-slate-950-60 border border-glass-border rounded-lg text-center"
            >
              <Icon size={18} style={{ color: item.color }} className="mb-1" />
              <span className="text-[8px] text-text-secondary leading-tight mt-0.5">
                {item.label}
              </span>
              <span className="text-base font-black text-white mt-1">
                {item.value}
              </span>
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
        className="Dipin-btn Dipin-btn-orange w-full flex items-center justify-center gap-2 mt-2"
      >
        <ArrowLeft size={15} /> BACK TO MENU
      </button>

    </div>
  );
}

export default StatsPanel;
