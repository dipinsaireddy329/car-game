/**
 * TouchControls.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Dedicated touch / gyroscope input module for Dipin Highway Racer.
 *
 * Exports a singleton `touchControls` that:
 *   - Tracks multi-touch events and maps them to a `keys`-compatible object
 *   - Supports swipe-based steering (left/right swipe threshold)
 *   - Supports gyroscope steering (opt-in via toggle)
 *   - Exposes virtual key state that the GameLoop can read just like keyboard keys
 *
 * Usage:
 *   import { touchControls } from './TouchControls';
 *
 *   // Attach to the canvas element
 *   touchControls.attach(canvasElement, containerElement);
 *
 *   // Pass its key state into the game loop update call
 *   gameLoop.update({ ...keysRef.current, ...touchControls.keys }, deltaTime);
 *
 *   // Detach when done
 *   touchControls.detach();
 */

class TouchControlsManager {
  constructor() {
    // Virtual key state — mirrors keyboard key names used in GameLoop
    this.keys = {
      ArrowLeft:  false,
      ArrowRight: false,
      ArrowDown:  false,
      ' ':        false,   // Nitro (Space)
    };

    // Internal touch tracking
    this._activeTouches = new Map(); // touchId → { startX, startY, currentX, currentY, zone }
    this._canvas = null;
    this._container = null;

    // Swipe detection
    this._swipeThreshold = 25;   // px moved before it counts as a steer
    this._swipeDecay     = 0.08; // how fast swipe influence decays without movement

    // Smooth steer values (interpolated from touch delta)
    this._steerLeft  = false;
    this._steerRight = false;

    // Gyroscope
    this.gyroEnabled       = false;
    this._gyroPermGranted  = false;
    this._calibrationRef   = null;  // calibrated reference angle
    this._gyroDeadzone     = 4;     // degrees of tilt before steering kicks in
    this.gyroSensitivity   = 1.0;   // tilt sensitivity multiplier
    this._gyroTiltLeft     = false;
    this._gyroTiltRight    = false;

    // Bound handlers (stored so we can remove them)
    this._onTouchStart = this._onTouchStart.bind(this);
    this._onTouchMove  = this._onTouchMove.bind(this);
    this._onTouchEnd   = this._onTouchEnd.bind(this);
    this._onOrientation = this._onOrientation.bind(this);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Attach to DOM elements. Call once after canvas is mounted.
   * @param {HTMLCanvasElement} canvas
   * @param {HTMLElement}       container  - the wrapper div around the canvas
   */
  attach(canvas, container) {
    this.detach(); // safety: remove any previous listeners

    this._canvas    = canvas;
    this._container = container;

    const opts = { passive: false };

    // We listen on the container so the touch area covers HUD buttons too
    container.addEventListener('touchstart',  this._onTouchStart, opts);
    container.addEventListener('touchmove',   this._onTouchMove,  opts);
    container.addEventListener('touchend',    this._onTouchEnd,   opts);
    container.addEventListener('touchcancel', this._onTouchEnd,   opts);
  }

  /** Remove all event listeners. Call on component unmount. */
  detach() {
    const c = this._container;
    if (!c) return;

    c.removeEventListener('touchstart',  this._onTouchStart);
    c.removeEventListener('touchmove',   this._onTouchMove);
    c.removeEventListener('touchend',    this._onTouchEnd);
    c.removeEventListener('touchcancel', this._onTouchEnd);

    this._disableGyro();
    this._resetKeys();
    this._activeTouches.clear();
    this._canvas    = null;
    this._container = null;
  }

  /**
   * Toggle gyroscope steering on/off.
   * On iOS 13+ this first triggers a permission prompt.
   * Returns a Promise<boolean> resolving to whether gyro is now active.
   */
  async toggleGyro() {
    if (this.gyroEnabled) {
      this._disableGyro();
      return false;
    }

    // iOS requires explicit permission
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const result = await DeviceOrientationEvent.requestPermission();
        if (result !== 'granted') return false;
      } catch (e) {
        return false;
      }
    }

    this._enableGyro();
    this._calibrationRef = null; // trigger calibration on next reading
    return true;
  }

  /** Force recalculate of reference tilt baseline */
  calibrateGyro() {
    this._calibrationRef = null;
    this.triggerVibrate(60);
  }

  /** Trigger mobile haptic vibration feedback */
  triggerVibrate(duration = 40) {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(duration);
      } catch (e) {}
    }
  }

  /** Set steering keys from an external button (for HUD buttons) */
  setLeft(active)  {
    if (active && !this.keys.ArrowLeft) this.triggerVibrate(35);
    this.keys.ArrowLeft  = active;
  }
  setRight(active) {
    if (active && !this.keys.ArrowRight) this.triggerVibrate(35);
    this.keys.ArrowRight = active;
  }
  setBrake(active) {
    if (active && !this.keys.ArrowDown) this.triggerVibrate(40);
    this.keys.ArrowDown  = active;
  }
  setNitro(active) {
    if (active && !this.keys[' ']) this.triggerVibrate(50);
    this.keys[' ']       = active;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TOUCH EVENT HANDLERS
  // ───────────────────────────────────────────────────────────────────────────

  _onTouchStart(e) {
    e.preventDefault();

    for (const t of e.changedTouches) {
      const zone = this._getZone(t.clientX, t.clientY);
      this._activeTouches.set(t.identifier, {
        id: t.identifier,
        startX: t.clientX,
        startY: t.clientY,
        currentX: t.clientX,
        currentY: t.clientY,
        zone
      });

      // Immediate zone press
      this._applyZoneDown(zone);
    }
  }

  _onTouchMove(e) {
    e.preventDefault();

    for (const t of e.changedTouches) {
      const touch = this._activeTouches.get(t.identifier);
      if (!touch) continue;

      touch.currentX = t.clientX;
      touch.currentY = t.clientY;

      // Swipe-based steering for the steer zone
      if (touch.zone === 'steer') {
        const dx = touch.currentX - touch.startX;
        if (dx < -this._swipeThreshold) {
          this.keys.ArrowLeft  = true;
          this.keys.ArrowRight = false;
        } else if (dx > this._swipeThreshold) {
          this.keys.ArrowRight = true;
          this.keys.ArrowLeft  = false;
        } else {
          // Within dead-zone — release steer
          this.keys.ArrowLeft  = false;
          this.keys.ArrowRight = false;
        }
      }
    }
  }

  _onTouchEnd(e) {
    e.preventDefault();

    for (const t of e.changedTouches) {
      const touch = this._activeTouches.get(t.identifier);
      if (!touch) continue;

      this._applyZoneUp(touch.zone);
      this._activeTouches.delete(t.identifier);
    }

    // If no steer touches remain, release steer keys
    const hasSteer = Array.from(this._activeTouches.values()).some(t => t.zone === 'steer');
    if (!hasSteer) {
      this.keys.ArrowLeft  = false;
      this.keys.ArrowRight = false;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // ZONE DETECTION
  //
  // Screen is split into logical zones:
  //   LEFT HALF     → steer zone (swipe left/right for direction)
  //   RIGHT TOP     → nitro button zone (handled by HUD buttons, but also
  //                   detected here for raw touch fallback)
  //   RIGHT BOTTOM  → brake zone
  // ───────────────────────────────────────────────────────────────────────────

  _getZone(clientX, clientY) {
    const W  = window.innerWidth;
    const H  = window.innerHeight;
    const isRight = clientX > W * 0.55;
    const isTop   = clientY < H * 0.5;

    if (!isRight) return 'steer';
    if (isTop)    return 'nitro';
    return 'brake';
  }

  _applyZoneDown(zone) {
    switch (zone) {
      case 'nitro': this.keys[' ']      = true; break;
      case 'brake': this.keys.ArrowDown = true; break;
      // 'steer' is handled via swipe in touchMove
    }
  }

  _applyZoneUp(zone) {
    switch (zone) {
      case 'nitro': this.keys[' ']      = false; break;
      case 'brake': this.keys.ArrowDown = false; break;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // GYROSCOPE
  // ───────────────────────────────────────────────────────────────────────────

  _enableGyro() {
    this.gyroEnabled = true;
    this._calibrationRef = null; // calibrate on first reading
    window.addEventListener('deviceorientation', this._onOrientation);
  }

  _disableGyro() {
    this.gyroEnabled = false;
    window.removeEventListener('deviceorientation', this._onOrientation);
    // Only clear gyro-driven keys; leave HUD-button keys alone
    this._gyroTiltLeft  = false;
    this._gyroTiltRight = false;
    this._syncGyroKeys();
  }

  _onOrientation(e) {
    let tilt = 0;
    // Get device orientation angle: 0 = Portrait, 90 = Landscape Left, -90/270 = Landscape Right
    const orientation = window.orientation ?? (screen.orientation && screen.orientation.angle) ?? 0;

    if (orientation === 90) {
      // Landscape left: beta is the primary steering axis
      tilt = -e.beta;
    } else if (orientation === -90 || orientation === 270) {
      // Landscape right: beta is the primary steering axis (inverted)
      tilt = e.beta;
    } else {
      // Portrait: gamma is the primary steering axis
      tilt = e.gamma;
    }

    if (this._calibrationRef === null) {
      this._calibrationRef = tilt;
    }

    const relativeTilt = tilt - this._calibrationRef;
    const adjustedDeadzone = this._gyroDeadzone;

    // Apply sensitivity multiplier
    const effectiveTilt = relativeTilt * this.gyroSensitivity;

    this._gyroTiltLeft  = effectiveTilt < -adjustedDeadzone;
    this._gyroTiltRight = effectiveTilt > adjustedDeadzone;
    this._syncGyroKeys();
  }

  _syncGyroKeys() {
    // Only drive steer keys if no swipe touch is active on the steer zone
    const hasSwipe = Array.from(this._activeTouches.values()).some(t => t.zone === 'steer');
    if (!hasSwipe) {
      this.keys.ArrowLeft  = this._gyroTiltLeft;
      this.keys.ArrowRight = this._gyroTiltRight;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ───────────────────────────────────────────────────────────────────────────

  _resetKeys() {
    this.keys.ArrowLeft  = false;
    this.keys.ArrowRight = false;
    this.keys.ArrowDown  = false;
    this.keys[' ']       = false;
  }
}

export const touchControls = new TouchControlsManager();
