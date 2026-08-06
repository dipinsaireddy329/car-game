# 🚗 Dipin Highway Racer — Retro Cyberpunk Arcade

A high-performance, browser-based top-down retro cyberpunk racing game built using **React 19**, **Vite 8**, and the native **HTML5 Canvas 2D API**. Experience high-speed racing through a neon-lit cyber grid, dodge traffic, gather energy cells, unlock powerful vehicles, and survive the grid.

---

## 🎮 How to Play & Controls

The game is designed with a responsive multi-input system supporting desktop keyboard inputs, mobile touch buttons, and device gyroscope steering.

| Input System | Action | Controls |
| :--- | :--- | :--- |
| **Keyboard Controls** | Steer Left / Right | `←` or `A` / `→` or `D` |
| | Accelerate | `↑` or `W` |
| | Brake / Slow | `↓` or `S` |
| | Activate Nitro Boost | `Spacebar` or `Shift` |
| | Pause / Resume | `P` |
| **Mobile Touch UI** | Left & Right buttons | Tap/Hold left-hand steer arrows |
| | Brake & Nitro | Tap/Hold right-hand custom buttons |
| | Gyroscope Steering | Toggle **GYRO** mode on the HUD (steer by tilting your device) |

**Objective:** Drive as far as possible along the highway grid before your energy/fuel cell reaches zero. Dodge traffic, execute near-misses to build scoring combos, collect credits, and earn XP to level up.

---

## 🚘 Garage — Grid Vehicles & Perks

All vehicles are procedural, rendering dynamic chassis shapes, distinct spoilers, wheels, and glowing neon underglow at runtime.

| Vehicle | Top Speed | Handling | Exclusive Grid Perk |
| :--- | :---: | :---: | :--- |
| **Cyber Roadster** | 65 | 75 | **E-Magnet Plus** — Coin attraction magnets last 30% longer |
| **Dipin Cruiser** | 55 | 60 | **Shield Capacitor** — Automatically starts the run with an active shield |
| **Apex GT** | 80 | 88 | **Tuning Drift** — Lateral handling is boosted by +15% during Nitro |
| **Future Interceptor** | 80 | 70 | **Data Double** — All collected credits are worth double (×2) value |
| **Carbon Cobra** | 88 | 62 | **Ram Charger** — Hitting traffic during Nitro crushes them for +200 pts without crashing |
| **Speed Demon** | 95 | 85 | **Nitro Burst** — Nitro charges and refills 50% faster |
| **Sentinel Truck** | 50 | 50 | **Heavy Armor** — Starts with 4 lives; energy cell decays 25% slower |
| **Hyper Phantom** | 90 | 95 | **Cell Attractor** — Coin magnets also attract fuel/energy canisters |
| **Blueprints Cybertruck** | 70 | 52 | **Steel Exoskeleton** — 4 lives; traffic impacts drain energy instead of losing a life |
| **Vector Lightcycle** | 92 | 98 | **Slipstream Profile** — Ultra-narrow 26px vehicle hitbox for lane splitting |

---

## 🔧 Upgrades & Progression

Credits secured during grid runs can be spent in the Garage to permanently upgrade each vehicle's hardware components up to **Level 5**:
*   **Engine Speed Tuning:** Increases the vehicle's top speed threshold on each upgrade level.
*   **Handling Dynamics:** Tightens steering responsiveness and reduces drift latency.

---

## 📊 Gameplay Features & Mechanics

*   **Near-Miss Combo Multiplier:** Zooming close to traffic cars at high velocities triggers a **Near Miss**. Stacking near misses quickly increments your **Combo Multiplier**, multiplying distance score outputs.
*   **XP & Level-Ups:** Secure distance and complete runs to earn XP nodes. Reaching new levels plays a distinct audio celebration and increases grid notoriety.
*   **Procedural Missions:** Every run offers three active missions (e.g. *Gather Credits*, *Horizon Run*, *Hazard Slip*). Completing a mission awards an immediate **+100 credits bonus**.
*   **Daily Rewards Chime:** Log in daily to claim a credit bonus. Securing consecutive daily log-in streaks triggers a multiplier, scaling up the bonus credits (up to **500 credits** max).

---

## ✨ Immersive Cyberpunk Aesthetics & VFX

The visual layout renders a glowing, retro-futuristic grid using custom-tuned GPU-friendly Canvas 2D procedures:
*   **Visual Warp Zoom:** Activating Nitro dynamically zooms the camera viewport and overlays high-speed velocity lines.
*   **Skid Marks & Sparks:** Hard braking, tight drifting, and side scrapes paint persistent rubber skid marks on the road and spray active orange sparks.
*   **Magnet Energy Arcs:** Active magnets emit glowing, dashed laser arcs that visually couple attracted items to the vehicle.
*   **Atmospheric Weather & Environments:**
    *   *Day, Dawn, Sunset, Night:* Dynamic sky transitions that change ambient coloring.
    *   *Rain & Storms:* Water droplets bounce, creating ripple rings on the asphalt. Storms periodically trigger flashing wireframe lightning, casting real-time highlights over the road.
    *   *3D Perspective Skyscrapers:* Wireframe structures scroll in parallax, featuring blinking signal beacons and glowing retro neon billboards.

---

## 🎵 Procedural Synthwave Audio Engine

All sound effects and soundtrack elements are computed procedurally at runtime using the **Web Audio API** (zero audio file downloads required).
*   **Dynamic Engine Hum:** A dual-oscillator synthesizer loops an engine drone that scales in pitch and gain relative to your vehicle's speed.
*   **Whoosh & Boom Effects:** Custom sound synthesizers generate retro explosion noises during collisions, high-frequency white noise sweeps for Nitro, and pitch-bent sweeps for powerup activations.
*   **Procedural Synthwave Soundtrack:** Generates an ongoing 135 BPM synthwave melody loop featuring randomized arpeggiators and deep basslines.

---

## 🛠️ Technology Stack

*   **Core framework:** React 19 + Vite 8
*   **Rendering layer:** HTML5 Canvas (2D Context)
*   **UI Animations:** Framer Motion
*   **Styling System:** Vanilla CSS + Tailwind CSS integration
*   **Sound Synthesis:** Web Audio API

---

## 🚀 Local Development

Follow these instructions to install dependencies and run the game locally:

```bash
# Clone the repository and enter the directory
git clone https://github.com/dipinsaireddy329/car-game.git
cd car-game

# Install dependencies
npm install

# Run the development server
npm run dev

# Compile production-ready assets
npm run build
```

Once running, the development server will be hosted on **http://localhost:5173**.

---

## 🌐 Deployment Configuration (Vercel)

The project includes custom settings for deployment on **Vercel**:
*   **Vite Base Path:** Vite is configured with `base: '/'` to ensure all script, CSS, and asset routes resolve relative to the root URL.
*   **Build Output Configuration:** The project builds into the `/build` folder. The deployment pipeline is configured via [vercel.json](file:///Users/dipin/MyWorkspace/Car-game/car-game/vercel.json):
    ```json
    {
      "buildCommand": "npm run build",
      "outputDirectory": "build"
    }
    ```

---

## 📁 Project Structure

*   [src/game/GameLoop.js](file:///Users/dipin/MyWorkspace/Car-game/car-game/src/game/GameLoop.js) — The engine driving physics calculations, rendering cycles, player mechanics, and traffic AI.
*   [src/game/GameEngine.jsx](file:///Users/dipin/MyWorkspace/Car-game/car-game/src/game/GameEngine.jsx) — React interface component wrapping around the active `<canvas>`.
*   [src/components/](file:///Users/dipin/MyWorkspace/Car-game/car-game/src/components/) — Menu overlays, UI overlays, garage, trophy archives, and dashboard HUD panels.
*   [src/utils/audio.js](file:///Users/dipin/MyWorkspace/Car-game/car-game/src/utils/audio.js) — Web Audio API procedural sound synthesizer and manager class.
*   [src/App.jsx](file:///Users/dipin/MyWorkspace/Car-game/car-game/src/App.jsx) — Top-level React orchestration, global game state, and browser local storage synchronization.
*   [src/index.css](file:///Users/dipin/MyWorkspace/Car-game/car-game/src/index.css) — Design systems, layout sheets, and retro cyberpunk styling variables.
