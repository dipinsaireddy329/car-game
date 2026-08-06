import React, { useEffect, useRef, useState } from 'react';
import { GameLoop } from './GameLoop';
import { Play, RotateCcw } from 'lucide-react';
import { audio } from '../utils/audio';
import { touchControls } from './TouchControls';

function GameEngine({
  selectedCar,
  carUpgrades,
  theme,
  onGameOver,
  onScoreUpdate,
  onCoinsUpdate,
  onLivesUpdate,
  onSpeedUpdate,
  onNitroUpdate,
  onFuelUpdate,
  onShieldUpdate,
  onMagnetUpdate,
  onLevelUpdate,
  onComboUpdate,
  onHit,
  gyroscopeEnabled
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const gameLoopRef = useRef(null);
  const requestRef = useRef(null);
  const keysRef = useRef({});
  const [isPaused, setIsPaused] = useState(false);
  // Track which keys are pressed — reset on window blur so stuck keys don't happen
  const resetKeys = () => { keysRef.current = {}; };

  // Gyroscope toggle updates
  useEffect(() => {
    if (gyroscopeEnabled) {
      touchControls.toggleGyro().then(active => {
        if (!active && touchControls.gyroEnabled) {
          touchControls.toggleGyro(); // Toggle off if permission fails
        }
      });
    } else {
      if (touchControls.gyroEnabled) {
        touchControls.toggleGyro();
      }
    }
  }, [gyroscopeEnabled]);

  // Main Loop Game Engine Wiring
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const handleResize = () => {
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;

      const aspectRatio = 450 / 700;
      let newWidth = containerWidth;
      let newHeight = containerWidth / aspectRatio;

      if (newHeight > containerHeight) {
        newHeight = containerHeight;
        newWidth = containerHeight * aspectRatio;
      }

      canvas.style.width = `${newWidth}px`;
      canvas.style.height = `${newHeight}px`;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = newWidth * dpr;
      canvas.height = newHeight * dpr;
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    handleResize(); // Initial resize sizing call

    // Attach mobile touch handler
    touchControls.attach(canvas, container);

    // Keyboard handlers for Desktop controls
    const handleKeyDown = (e) => {
      const preventKeys = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '];
      if (preventKeys.includes(e.key) || preventKeys.includes(e.code)) {
        e.preventDefault();
      }
      // Map both key names for robustness
      keysRef.current[e.key] = true;
      keysRef.current[e.code] = true;

      // Escape or P triggers pausing
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        togglePause();
      }
    };

    const handleKeyUp = (e) => {
      keysRef.current[e.key] = false;
      keysRef.current[e.code] = false;
    };

    // Reset all keys if window loses focus (prevents stuck keys)
    window.addEventListener('blur', resetKeys);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Auto-focus the container so keyboard events are captured immediately
    if (container) {
      container.focus();
    }

    console.log("GameEngine useEffect mounted");

    // Instantiate game loop
    const gameLoop = new GameLoop(canvas, selectedCar, {
      carUpgrades,
      theme,
      onGameOver,
      onScoreUpdate,
      onCoinsUpdate,
      onLivesUpdate,
      onSpeedUpdate,
      onNitroUpdate,
      onFuelUpdate,
      onShieldUpdate,
      onMagnetUpdate,
      onLevelUpdate,
      onComboUpdate,
      onHit
    });

    gameLoopRef.current = gameLoop;

    let lastTime = performance.now();
    let frameCount = 0;

    const tick = (time) => {
      try {
        const deltaTime = (time - lastTime) / 1000;
        lastTime = time;

        // Capped delta to avoid massive glitches on frame drops
        const cappedDelta = Math.min(0.05, deltaTime);

        frameCount++;
        if (frameCount % 60 === 0) {
          console.log("tick executing, gameLoop.isPaused:", gameLoop.isPaused, "gameOverTriggered:", gameLoop.gameOverTriggered);
        }

        if (!gameLoop.isPaused && !gameLoop.gameOverTriggered) {
          // Merge keyboard controls with touch controls virtual key map
          const mergedKeys = { ...keysRef.current, ...touchControls.keys };
          gameLoop.update(mergedKeys, cappedDelta);
          gameLoop.draw();
        } else if (gameLoop.isPaused) {
          gameLoop.draw();
        }
      } catch (err) {
        console.error("CRITICAL ERROR IN TICK:", err);
      }

      requestRef.current = requestAnimationFrame(tick);
    };

    requestRef.current = requestAnimationFrame(tick);

    // Cleanup listeners & loops
    return () => {
      console.log("GameEngine useEffect cleanup");
      cancelAnimationFrame(requestRef.current);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', resetKeys);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      touchControls.detach();
      audio.stopEngine();
      audio.stopRain();
      audio.stopCity();
    };
  }, [selectedCar, theme]);

  const togglePause = () => {
    if (!gameLoopRef.current) return;

    const newPauseState = !gameLoopRef.current.isPaused;
    gameLoopRef.current.isPaused = newPauseState;
    setIsPaused(newPauseState);
    audio.playClick();

    if (newPauseState) {
      audio.stopEngine();
      audio.stopMusic();
      audio.stopRain();
      audio.stopCity();
    } else {
      audio.startEngine();
      audio.startMusic();
      if (gameLoopRef.current.theme.hasRain) {
        audio.startRain();
      }
      if (gameLoopRef.current.theme.neonCity || gameLoopRef.current.theme.cityLights) {
        audio.startCity();
      }
    }
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className="absolute inset-0 w-full h-full flex items-center justify-center p-4 bg-[#020206]/85 z-10 select-none outline-none"
      onFocus={() => { /* keep focus so keyboard events work */ }}
    >
      <div className="relative game-canvas-wrapper flex items-center justify-center max-h-[90vh] aspect-[450/700]">
        <canvas ref={canvasRef} />

        {/* Pause Screen Overlay */}
        {isPaused && (
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center gap-6 pointer-events-auto">
            <div className="text-center font-display">
              <h2 className="text-3xl font-extrabold text-Dipin-cyan Dipin-pulse-cyan tracking-wider">
                GRID SUSPENDED
              </h2>
              <p className="text-xs text-text-secondary mt-1">
                PAUSE MODE ACTIVE
              </p>
            </div>

            <div className="flex flex-col gap-3 w-48 font-display">
              <button
                onClick={togglePause}
                className="Dipin-btn Dipin-btn-cyan w-full flex items-center justify-center gap-2"
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
