import React, { useEffect, useRef, useState } from 'react';
import { GameLoop } from './GameLoop';
import { Pause, Play, LogOut } from 'lucide-react';
import { audio } from '../utils/audio';

function GameEngine({
  selectedCar,
  carUpgrades,
  weatherMode,
  timeOfDay,
  onGameOver,
  onScoreUpdate,
  onCoinsUpdate,
  onLivesUpdate,
  onSpeedUpdate,
  onNitroUpdate,
  onFuelUpdate,
  onShieldUpdate,
  onMagnetUpdate,
  onHit
}) {
  const canvasRef = useRef(null);
  const gameLoopRef = useRef(null);
  const requestRef = useRef(null);
  const keysRef = useRef({});
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set fixed resolution
    canvas.width = 450;
    canvas.height = 700;

    // Key handlers
    const handleKeyDown = (e) => {
      // Prevent scrolling behaviors for space and arrow keys
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }

      keysRef.current[e.key] = true;

      // Handle pause toggling with Escape or 'p'
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        togglePause();
      }
    };

    const handleKeyUp = (e) => {
      keysRef.current[e.key] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Instantiate game loop
    const gameLoop = new GameLoop(canvas, selectedCar, {
      carUpgrades,
      weatherMode,
      timeOfDay,
      onGameOver,
      onScoreUpdate,
      onCoinsUpdate,
      onLivesUpdate,
      onSpeedUpdate,
      onNitroUpdate,
      onFuelUpdate,
      onShieldUpdate,
      onMagnetUpdate,
      onHit
    });
    
    gameLoopRef.current = gameLoop;

    // Start ticker loop
    let lastTime = performance.now();
    
    const tick = (time) => {
      const deltaTime = (time - lastTime) / 1000; // convert to seconds
      lastTime = time;

      // Restrict max time step to avoid large jumps during frame drops
      const cappedDelta = Math.min(0.05, deltaTime);

      if (!gameLoop.isPaused && !gameLoop.gameOverTriggered) {
        gameLoop.update(keysRef.current, cappedDelta);
        gameLoop.draw();
      } else if (gameLoop.isPaused) {
        // Draw the static board state when paused
        gameLoop.draw();
      }

      requestRef.current = requestAnimationFrame(tick);
    };

    requestRef.current = requestAnimationFrame(tick);

    // Cleanup
    return () => {
      cancelAnimationFrame(requestRef.current);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      
      // Stop dynamic synth sounds
      audio.stopEngine();
    };
  }, [selectedCar, weatherMode, timeOfDay]);

  const togglePause = () => {
    if (!gameLoopRef.current) return;
    
    const newPauseState = !gameLoopRef.current.isPaused;
    gameLoopRef.current.isPaused = newPauseState;
    setIsPaused(newPauseState);
    audio.playClick();

    if (newPauseState) {
      audio.stopEngine();
      audio.stopMusic();
    } else {
      audio.startEngine();
      audio.startMusic();
    }
  };

  return (
    <div className="absolute inset-0 w-full h-full flex items-center justify-center p-4 bg-[#020206]/85 z-10">
      {/* Game Canvas Container */}
      <div className="relative shadow-[0_0_40px_rgba(0,0,0,0.9)] border-2 border-glass-border rounded-xl overflow-hidden bg-[#05050e]">
        <canvas
          ref={canvasRef}
          className="block max-h-[90vh] aspect-[450/700] object-contain"
        />

        {/* Pause Overlay Screen */}
        {isPaused && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center gap-6 pointer-events-auto">
            <div className="text-center font-display">
              <h2 className="text-3xl font-extrabold text-neon-cyan neon-pulse-cyan tracking-wider">
                SYSTEM PAUSED
              </h2>
              <p className="text-xs text-text-secondary mt-1">
                GRID INTERFACE SUSPENDED
              </p>
            </div>

            <div className="flex flex-col gap-3 w-48 font-display">
              <button
                onClick={togglePause}
                className="neon-btn neon-btn-cyan w-full flex items-center justify-center gap-2"
              >
                <Play size={14} fill="currentColor" /> RESUME RIDE
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default GameEngine;
