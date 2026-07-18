# 🚗 Dipin Highway Racer — Retro Cyberpunk Arcade

A browser-based cyberpunk top-down racing arcade game built with React + Vite. Race at high speed through a Dipin-lit cyber grid, dodge traffic, collect coins, unlock cars, and survive the grid.

---

## 🎮 How to Play

| Key | Action |
|---|---|
| `←` / `→` Arrow Keys | Steer left / right |
| `↑` Arrow Key | Accelerate |
| `↓` / `S` | Brake |
| `Space` / `Shift` | Activate Nitro boost |
| `P` | Pause / Resume |

**Goal:** Survive as long as possible, rack up a high score, and collect coins to spend on upgrades.

---

## 🚘 Garage — All 10 Cars (All Free!)

| Car | Top Speed | Handling | Perk |
|---|---|---|---|
| **Cyber Roadster** | 65 | 75 | E-Magnet Plus — Magnet lasts 30% longer |
| **Dipin Cruiser** | 55 | 60 | Shield Capacitor — Starts with an active shield |
| **Apex GT** | 80 | 88 | Tuning Drift — +15% handling during Nitro |
| **Future Interceptor** | 80 | 70 | Data Double — All coins worth ×2 |
| **Carbon Cobra** | 88 | 62 | Ram Charger — Crush traffic during Nitro for +200 pts |
| **Speed Demon** | 95 | 85 | Nitro Burst — Nitro refills 50% faster |
| **Sentinel Truck** | 50 | 50 | Heavy Armor — 4 lives, slower fuel drain |
| **Hyper Phantom** | 90 | 95 | Cell Attractor — Magnets also attract fuel canisters |
| **Blueprints Cybertruck** | 70 | 52 | Steel Exoskeleton — 4 lives, collisions drain fuel instead of lives |
| **Vector Lightcycle** | 92 | 98 | Slipstream Profile — Ultra-narrow 26px hitbox for lane splitting |

---

## ✨ Visual Features

- **Procedural car rendering** — every vehicle is drawn with unique chassis shapes, windshields, cockpits, spoilers, and underglow
- **Nitro Rocket Fire** — animated flickering exhaust flames when boosting
- **Nitro Warp Zoom** — subtle canvas zoom + edge speed lines during boost
- **Dipin Gantry Arches** — 3D-perspective arches scroll over the road with hanging lights and signs
- **Magnet Laser Arcs** — purple dashed energy beams connect your car to attracted coins
- **Friction Sparks** — orange/yellow sparks spray from rear tyres during hard braking or drifting
- **Tyre Skid Marks** — dynamic rubber marks fade out on the asphalt
- **Rain Ripples** — concentric water splash rings on the road surface in storm mode
- **Wireframe Skyscrapers** — structural X-cross towers with pulsing scan bands, blinking antennas, and Dipin billboards
- **Traffic AI** — cars have headlights, brake lights, windshields, spoilers, and lane-changing behaviour
- **Dynamic lighting** — headlight beams, underglow, proximity brake lights for traffic

---

## ⬆️ Upgrades

Spend coins earned during races to upgrade your car's:
- **Speed** — increases top speed per level (up to level 5)
- **Handling** — tightens steering responsiveness

---

## 🌦️ Game Modes

Choose your challenge before starting a race:

**Weather:**
- Clear
- Rain (reduced visibility, asphalt ripples, lightning)

**Time of Day:**
- Day
- Night (headlight beams activated, darker roads)

---

## 🛠️ Tech Stack

- **React 19** + **Vite 6**
- **Canvas 2D API** — all game rendering is done via raw `<canvas>` with no game engine dependency
- **Framer Motion** — UI transitions and animations
- **Web Audio API** — fully procedural audio (engine hum, coin SFX, nitro whoosh, crash noise, retro arpeggiator soundtrack)

---

## 🚀 Development

```bash
# Install dependencies
npm install

# Start local dev server (hot reload)
npm run dev

# Build for production
npm run build
```

The game runs at **http://localhost:5173** in development mode.

---

## 📁 Project Structure

```
src/
├── game/
│   ├── GameLoop.js       # Core game loop, physics, rendering, AI
│   └── GameEngine.jsx    # React wrapper around the canvas
├── components/
│   ├── MainMenu.jsx      # Main menu screen
│   ├── CarSelection.jsx  # Garage & car picker
│   └── GameDashboard.jsx # In-game HUD overlay
├── utils/
│   └── audio.js          # Web Audio API sound manager
├── App.jsx               # App state, car registry, game orchestration
└── index.css             # Global styles & cyberpunk design tokens
```
