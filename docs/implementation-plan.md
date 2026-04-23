# Dead Zone City — Full Enhancement Plan

This document outlines every enhancement to implement, broken into self-contained phases. Each phase produces a working game and is committed separately before moving on.

**Review changes applied:**
- Sprint speed reduced from 1.7× to 1.5×
- Melee damage increased from 40 to 55
- Phase 4 split into 4a (boss) and 4b (power-ups)
- Phase 8 (pause) moved before Phase 5 (upgrade kits need pause)
- Phases 10 and 11 swapped (gun model rework before casing spawns)
- Phase 12 split into 12a (performance) and 12b (polish/balance); mobile dropped
- Damage upgrades use additive stacking with a cap
- Boss gets reduced headshot multiplier (1.3× instead of 2×)
- Power-up invuln reduced from 8s to 5s
- Each phase includes a state reset checklist for `startGame()`

---

## Phase 1: Player Mechanics — Sprint, Stamina, Melee Attack

**Goal:** Add sprint (Shift), stamina bar, and melee (V key) for close-quarters combat.

### Execution Steps

1. **Sprint system**
   - Add `sprintEnergy = 100`, `isSprinting = false` state variables.
   - In `updatePlayer()`, if `keys['ShiftLeft']` and moving and `sprintEnergy > 0`, set `isSprinting = true`, multiply speed by 1.5×, drain `sprintEnergy` by `30 * dt`.
   - When not sprinting or stamina exhausted, recover `sprintEnergy` by `15 * dt`.
   - Below 10 stamina, cannot sprint until above 20.
   - Increase head-bob speed while sprinting.

2. **Stamina HUD**
   - Add a `#stamina-wrap` div inside `#hud`, positioned below the health bar.
   - Blue/yellow coloring. Update `updateHUD()` to set stamina fill width based on `sprintEnergy`.

3. **Melee attack**
   - Add `MELEE_DMG = 55`, `MELEE_RANGE = 2.8`, `MELEE_CD = 0.6`, `meleeCooldown = 0`.
   - On `KeyV` press: if cooldown is 0, raycast forward `MELEE_RANGE`, check zombie hits, deal 55 damage.
   - Play "whoosh" sound: noise burst through bandpass at 400 Hz, 0.08s duration.
   - Brief gun-model lunge animation (push forward then back over 0.2s).
   - Show melee cooldown indicator on HUD when on cooldown.

4. **State reset** — In `startGame()`, add: `sprintEnergy = 100; isSprinting = false; meleeCooldown = 0;`

**Commit message:** `feat: sprint, stamina bar, and melee attack`

---

## Phase 2: Headshots & Kill Combos

**Goal:** 2× damage on headshot hits (1.3× for bosses); combo multiplier for fast kills.

### Execution Steps

1. **Headshot detection**
   - In `createZombie()`, mark the head mesh (`zp(.44*s, .44*s, .44*s, bodyMat, 0, 1.86*s, 0)`) with `userData.headshot = true`.
   - In `fireWeapon()` raycast loop, check `hits[0].object.userData.headshot`.
   - If true and zombie is not a boss, multiply damage by 2. If boss, multiply by 1.3.
   - Play headshot "dink" sound: 0.15s square wave at 1200 Hz, volume 0.25.

2. **Floating damage numbers**
   - Add `#dmg-numbers` container div (pointer-events: none, full-screen absolute overlay).
   - `spawnDmgNumber(worldPos, dmg, isHeadshot)`: project 3D position to screen coordinates using `camera.project()`, create a temporary `<div>` with the damage number, animate upward + fade over 0.8s, then remove.
   - Headshot numbers: larger font, gold color (`#ffd700`).
   - Cap at 20 active damage numbers.

3. **Kill combo system**
   - Add `comboCount = 0`, `comboTimer = 0`, `COMBO_TIMEOUT = 2.0`.
   - On zombie kill: reset `comboTimer` to `COMBO_TIMEOUT`, increment `comboCount`.
   - In animate loop: `comboTimer -= dt`; if expired, reset `comboCount` to 0.
   - Score gained = `ZDEFS[type].score * (1 + comboCount * 0.1)`, capped at 5× multiplier (comboCount max 40).
   - Display combo counter on HUD (`#combo-wrap`) with scaling font size.

4. **State reset** — In `startGame()`, add: `comboCount = 0; comboTimer = 0;`

**Commit message:** `feat: headshot multiplier, floating damage numbers, kill combos`

---

## Phase 3: Zombie Improvements — Collision, Avoidance, Blood Pools

**Goal:** Zombies don't stack; navigate around obstacles; leave persistent blood decals.

### Execution Steps

1. **Zombie-zombie push-apart**
   - In `updateZombies()`, after movement loop, run push loop:
   - For each pair of living zombies within 1.2 units, push both apart by `(separation_direction * dt * 3)`.
   - Limit to only processing zombies within 15 units of the player for performance.

2. **Obstacle avoidance (AABB-based, no raycasting)**
   - Add `avoidTimer` and `avoidDir` fields to each zombie object.
   - Before moving a zombie toward the player, check if the direct path crosses any obstacle AABB.
   - If blocked and `avoidTimer <= 0`: set `avoidDir` to perpendicular direction (rotate path direction ±90°), set `avoidTimer = 0.5`.
   - While `avoidTimer > 0`: move zombie in `avoidDir` direction instead of toward player. Decrement `avoidTimer -= dt`.
   - This avoids the need for Per-frame raycasting entirely.

3. **Persistent blood pools**
   - Add `bloodPools[]` array.
   - On zombie death, spawn a flat `PlaneGeometry(random 1.5-2.5, random 1.5-2.5)` at `y=0.02`, random Z rotation, dark red `MeshLambertMaterial`.
   - Also spawn a blood pool at damage positions when a zombie takes damage (30% chance, smaller size 0.5-1.0).
   - Limit to 50 pools; remove oldest via `scene.remove()` when exceeded.

4. **State reset** — In `startGame()`, add: remove all blood pools from scene and reset `bloodPools = []`.

**Commit message:** `feat: zombie collision, obstacle avoidance, blood pools`

---

## Phase 4a: Boss Waves

**Goal:** Every 5th wave spawns a boss zombie with a special attack and unique health bar.

### Execution Steps

1. **Boss zombie type**
   - Add `'boss'` to `ZDEFS`: `{hp:1200, speed:0.9, dmg:45, dmgCD:1500, col:0x8a1010, dark:0x5a0808, sz:2.2, score:1000}`.
   - Boss model: larger body, spiked shoulder plates (2 extra box meshes tilted outward), glowing red eyes (emissive).
   - Boss takes reduced headshot multiplier (1.3× instead of 2×).

2. **Boss projectile attack**
   - Add `bossProjectiles[]` array.
   - Every 4 seconds, boss fires a green glowing sphere toward the player at speed 12 units/s.
   - Projectile collision: if within 1.5 units of player, deal 30 damage and destroy.
   - Projectile has a 5-second lifetime; remove if expired.
   - Add `updateBossProjectiles(dt)` to animate loop.

3. **Boss wave trigger**
   - In `startWave()`: if `wave % 5 === 0`, the last spawn in the wave is a boss.
   - Wave announcement text: "WAVE X — BOSS INCOMING" for boss waves.
   - Show boss health bar (`#boss-hp-wrap`) below the crosshair when any boss is alive.

4. **State reset** — In `startGame()`, add: remove all boss projectiles from scene; `bossProjectiles = [];`

**Commit message:** `feat: boss zombie type with projectile attack and boss health bar`

---

## Phase 4b: Power-Up Drops

**Goal:** Zombies drop temporary power-ups.

### Execution Steps

1. **Power-up types**
   - `POWERUP_TYPES = ['2xdmg', 'speed', 'invuln']` — double damage 15s, +40% speed 12s, invulnerability 5s.
   - 12% drop chance on zombie death. Boss drops 2 random power-ups + health kit.

2. **Power-up entity**
   - Visual: floating, rotating `OctahedronGeometry` with emissive material in power-up color (red/2xdmg, blue/speed, gold/invuln).
   - Point light on each (intensity 0.6, range 3). Cap active power-ups at 8 on ground.

3. **Active power-up tracking**
   - `activePowerups = {}` — type → remaining time.
   - On collect: play chime sound, start timer, show colored bar on HUD.
   - In `updateHUD()`, render active power-up timers.

4. **State reset** — In `startGame()`: `activePowerups = {};` remove power-up meshes/lights from scene.

**Commit message:** `feat: power-up drops from zombies`

---

## Phase 5 (was Phase 8): Pause Menu

**Goal:** Pause game with Escape key; required before upgrade kit UI.

### Execution Steps

1. **Pause system**
   - Add `paused = false` state variable.
   - On `Escape` press during gameplay: set `paused = true`, exit pointer lock, show `#pause-screen` overlay.
   - "RESUME" button: set `paused = false`, re-request pointer lock, hide overlay.
   - "QUIT" button: show start screen, reset `started = false`.

2. **Pause-aware game loop**
   - In `animate()`, skip all `updateXxx()` calls when `paused === true`. Still render the scene.
   - Replace `Date.now()` calls in `updateLoot()` with a `gameTime` accumulator that pauses when `paused === true`.

3. **Pause overlay**
   - `#pause-screen` div: dark overlay with "PAUSED" title, RESUME and QUIT buttons. Styled like existing screens.

4. **State reset** — In `startGame()`, add: `paused = false; gameTime = 0;`

**Commit message:** `feat: pause menu with Escape key`

---

## Phase 6 (was Phase 5): Weapon Upgrade Kits

**Goal:** Find upgrade kits that boost weapon stats.

### Execution Steps

1. **Upgrade kit loot item**
   - New loot type: `'upgrade'` — golden toolbox appearance (small box with emissive gold material).
   - Placed in buildings: 2 per game. Position: inside Police Station and Bank.
   - On collect: pause game (use the pause system from Phase 5), show upgrade selection.

2. **Upgrade selection UI**
   - `#upgrade-select` overlay (same style as weapon-select).
   - Three `.upgrade-card` divs showing options: **+25% Damage** (orange), **+20% Fire Rate** (blue), **-30% Spread** (green).
   - On click: apply additive bonus to current weapon. Damage: `w.dmg *= 1 + 0.25 * upgradeCount`. Fire rate: `w.rate *= (1 - 0.20 * upgradeCount)`. Spread: `w.spread *= (1 - 0.30 * upgradeCount)`.
   - Cap: max 3 upgrades per weapon per stat.
   - Resume game after selection.

3. **State reset** — In `startGame()`: weapon stats are reset via `initWeapons()` which already copies from `WEAPONS`.

**Commit message:** `feat: weapon upgrade kits and upgrade selection UI`

---

## Phase 7 (was Phase 6): Barricade System

**Goal:** Push furniture to block doorways; zombies break through.

### Execution Steps

1. **Barricade objects**
   - Add `barricades[]` array.
   - Place 6 wooden crates near building entrances (visible `BoxGeometry(1.2, 1.0, 1.0)` with brown material).
   - Each crate: `{mesh, px, pz, hx: 0.8, hz: 0.7, health: 200, maxHealth: 200}`.
   - Also add crate AABBs to `obstacles[]` so they block zombies and player.

2. **Player pushing**
   - When player moves into a crate (collision check in `updatePlayer()`), push the crate in player's movement direction at 40% of player speed.
   - Update crate's `px, pz`, mesh position, and `obstacles[]` entry.
   - Show "PUSH" text on HUD when looking at a pushable crate within 2.5 units.

3. **Zombie barricade-breaking**
   - In `updateZombies()`, if a zombie's path is blocked by a barricade within 1.5 units:
     - Switch zombie to `attackingBarricade` state.
     - Deal zombie's `dmg` to barricade `health` every `dmgCD` ms.
     - Update barricade mesh color: lerp from brown to dark grey based on `health/maxHealth`.
   - When barricade health reaches 0: remove mesh, remove from `obstacles[]` and `barricades[]`, play crash sound (noise burst through lowpass at 300 Hz, 0.4s).

4. **Zombie state machine**
   - Add `state` field to each zombie: `'chasing'`, `'attackingBarricade'`.
   - If `attackingBarricade` and barricade is destroyed, switch back to `'chasing'`.

5. **State reset** — In `startGame()`: reset all barricade positions, restore health, re-add to obstacles.

**Commit message:** `feat: barricade system with pushable crates and zombie destruction`

---

## Phase 8: Weather Effects

**Goal:** Dynamic rain and fog at higher waves; lightning flashes.

### Execution Steps

1. **Rain particle system**
   - Create `rainGroup` — pool of 400 thin `PlaneGeometry(0.04, 0.6)` meshes with `MeshBasicMaterial({color: 0xaabbcc, transparent: true, opacity: 0.5})`.
   - Pre-allocate all rain meshes in `rainGroup`, initially invisible.
   - In `updateDayNight()`, when `dayFactor > 0.4`, activate rain meshes proportional to intensity.
   - Each active rain mesh falls at speed 40 units/s; when below ground, recycle to top.
   - Use a single call to `scene.add(rainGroup)` / `scene.remove(rainGroup)` based on weather.

2. **Heavy fog**
   - When `dayFactor > 0.6`, smoothly reduce `scene.fog.near` and `scene.fog.far`:
     - `fog.near` interpolates from 30 to 10.
     - `fog.far` interpolates from 130 to 60.

3. **Lightning flashes**
   - At `dayFactor > 0.7`, random lightning every 8-20 seconds.
   - Brief flash: set `ambientLight.intensity` to 3.0 for 0.1s, then recover.
   - Screen overlay flash (`#flash` background briefly white).
   - Thunder sound: low noise burst through lowpass at 150 Hz, 1.2s, volume 1.0.

4. **Rain sound**
   - Loop a filtered noise source (bandpass at 2000 Hz, Q=0.4, volume 0.08) when raining.

**Commit message:** `feat: rain, fog, and lightning weather effects`

---

## Phase 9 (was Phase 8): Kill Feed, Damage Direction, Weapon Wheel

**Goal:** Kill feed, directional damage indicator, and weapon wheel.

### Execution Steps

1. **Kill feed**
   - Add `#kill-feed` div top-center of screen, showing last 5 kills.
   - Each entry: "REGULAR ZOMBIE → HEADSHOT" or "RUNNER → GRENADE", styled in green.
   - Boss kills show in gold (`#ffd700`).
   - Entries fade out after 4s via CSS transition on opacity.

2. **Directional damage indicator**
   - Add `#dmg-indicator` div with four arrow overlays (up/down/left/right), initially invisible.
   - On damage: calculate angle from source zombie to player. Show the corresponding arrow(s) for 0.6s with CSS opacity transition.
   - For grenade self-damage, show a center red pulse instead.

3. **Weapon wheel (hold Q)**
   - On `keydown('KeyQ')`: show `#weapon-wheel` overlay.
   - Track relative mouse movement to select weapon slot (7 slots in a circle).
   - On `keyup('KeyQ')`: switch to selected weapon, hide overlay.
   - Since pointer lock is active, use `movementX`/`movementY` to track a virtual cursor from center.

4. **State reset** — In `startGame()`: clear kill feed div contents.

**Commit message:** `feat: kill feed, damage direction indicator, weapon wheel`

---

## Phase 10 (was Phase 9): Persistent Upgrades & Leaderboard

**Goal:** Spend score on permanent upgrades; track high scores.

### Execution Steps

1. **Persistent upgrade store**
   - After death, show "UPGRADES" button on game-over screen.
   - Opens upgrade store overlay with purchasable items:
     - **+25 Max HP** (cost: 2000, max 3)
     - **+15% Sprint Speed** (cost: 1500, max 2)
     - **+1 Grenade Start** (cost: 3000, max 2)
     - **+20% Weapon Damage (additive)** (cost: 4000, max 3)
   - Deduct from total score. Store upgrades in `localStorage` as JSON.
   - On game start, read upgrades and apply: increase `MAX_HEALTH` by `25 * hpUpgrades`, etc.
   - Weapon damage uses additive stacking: `finalDmg = baseDmg * (1 + sum_of_upgrade_bonuses)`.
   - Wrap `localStorage` calls in `try/catch`; fall back to base stats if unavailable.

2. **High score leaderboard**
   - On game over, save `{score, wave, date}` to `localStorage` key `dzc_scores` (array capped at 10).
   - Show "HIGH SCORES" button on start screen.
   - Display top 10 runs in a scrollable overlay.

3. **Personal best label**
   - On game-over screen, if current score beats personal best, show "PERSONAL BEST!" in gold.

**Commit message:** `feat: persistent upgrades store and local high score leaderboard`

---

## Phase 11 (was Phase 10): Randomized Loot & New Buildings

**Goal:** Randomize loot positions; add Church and Warehouse buildings.

### Execution Steps

1. **Randomized loot positions**
   - Replace hardcoded `spawnLoot()` calls in building functions with a `generateLoot()` function called at game start.
   - Define loot pool with weights: health (40%), ammo (40%), weapon (15%), upgrade kit (5%).
   - For each building, define a bounding box and number of loot items.
   - Place 8-12 street loot items randomly (with obstacle collision checks).
   - Two upgrade kits always placed: one in Police Station, one in Bank.

2. **New building: Church**
   - Position: (-34, 4), 20×14, height 10.
   - Tall steeple with cross on top. Pews inside (row of box meshes).
   - Stone grey walls, dark roof.
   - Loot: health kit, sniper ammo.

3. **New building: Warehouse**
   - Position: (34, 4), 22×16, height 6.
   - Large open interior with shelving unit rows.
   - Corrugated metal walls (light grey).
   - Loot: shotgun, ammo, upgrade kit.

4. **State reset** — In `startGame()`: call `generateLoot()` which clears and re-spawns all loot items.

**Commit message:** `feat: randomized loot positions, church and warehouse buildings`

---

## Phase 12 (was Phase 11): Weapon Swap Animation & Gun Models

**Goal:** Brief delay on weapon swap; improved gun models; 3D muzzle flash.

### Execution Steps

1. **Weapon swap delay**
   - Add `weaponSwapTimer = 0`, `SWAP_TIME = 0.5`.
   - On weapon switch: set `weaponSwapTimer = SWAP_TIME`. Cannot fire during swap.
   - Animate gun model: lower down by 0.3 units over first 0.25s, then raise new gun up over 0.25s.
   - In `updatePlayer()`, decrement `weaponSwapTimer -= dt`.

2. **Improved gun models**
   - Build each weapon from multiple box sub-meshes: barrel, body, grip, magazine, sight.
   - Different proportions per weapon type (sniper: long barrel, short grip; shotgun: wide barrel, etc.).
   - Group all parts under `gunGroup` for consistent swap animation.

3. **3D muzzle flash**
   - Replace `shootLight` intensity flash with a brief `SpriteMaterial` muzzle flash at barrel tip.
   - Flash uses additive blending, white-yellow color, 0.06s lifetime.

4. **State reset** — In `startGame()`: `weaponSwapTimer = 0;`

**Commit message:** `feat: weapon swap animation, detailed gun models, 3D muzzle flash`

---

## Phase 13 (was Phase 10's bullet casings): Bullet Casings

**Goal:** Eject shell casings from gun on fire.

### Execution Steps

1. **Bullet casing system**
   - Add `casings[]` array.
   - On each shot (except grenade): spawn a small `CylinderGeometry(0.02, 0.02, 0.06)` with yellow-gold material.
   - Casing ejects sideways from gun position with slight upward velocity, then falls with gravity.
   - Casing stays on ground for 5s, then fades and is removed.
   - Cap at 100 active casings.

2. **State reset** — In `startGame()`: remove all casing meshes from scene; `casings = [];`

**Commit message:** `feat: bullet casing ejection particles`

---

## Phase 14 (was Phase 12a): Performance — Object Pooling & Polish

**Goal:** Optimize particle/blood pool systems; fix remaining issues.

### Execution Steps

1. **Object pooling for particles**
   - Pre-allocate 50 particle mesh objects. Instead of `new THREE.Mesh` in `addParticle()`, grab from pool.
   - When a particle dies, return it to the pool instead of `scene.remove()`.
   - Avoid `scene.remove()`/`scene.add()` churn in the main particle loop.

2. **Object pooling for blood pools**
   - Pre-allocate 50 `PlaneGeometry` meshes for blood pools, initially invisible.
   - On blood pool spawn, grab from pool and make visible.
   - When cap exceeded, reuse the oldest pool entry.

3. **Fix `Date.now()` calls for pause compatibility**
   - Replace all `Date.now()` references in game logic with a `gameTime` accumulator that only advances when not paused.
   - This ensures loot bobbing, power-up timers, and other time-dependent features freeze properly during pause.

4. **Light count audit**
   - Count total point lights (12 street lights + loot lights + power-up lights + boss projectile lights).
   - If total exceeds 16, reduce street light radius to avoid hitting WebGL limits.
   - Loot lights: use intensity 0.4 instead of 0.8 to reduce contribution.

**Commit message:** `feat: object pooling for particles, pause-safe timing, light optimization`

---

## Phase 15 (was Phase 12b): Final Balance & Polish

**Goal:** Balance pass, final polish, and cleanup.

### Execution Steps

1. **Balance pass**
   - Verify boss HP is beatable: at 1200 HP, M4A1 does 220 DPS = ~5.5s of sustained fire, reasonable.
   - Verify sprint speed (1.5×) doesn't trivialize runners — at 10.2 units/s sprint vs 4.2 runner speed, short bursts are escape tools.
   - Verify combo scaling: capped at 5× for 40+ combo, additive with power-ups.
   - Verify barricade health (200) vs zombie damage (10/8/28/45) — regular: 20s, boss: 4.4s.
   - Adjust power-up drop rate if needed after testing.

2. **Visual polish**
   - Add subtle camera tilt when strafing left/right (3° roll).
   - Screen edge vignette intensifies during sprint.
   - Boss: add a pulsing red emissive glow.
   - Kill combo text scales up briefly on increment.

3. **Audio polish**
   - Sprint: add wind/rush sound (looping noise through highpass at 2000 Hz, volume tied to sprint state).
   - Power-up collect: ascending tone (3 quick sine tones, pitch rising).
   - Boss death: long low rumble + explosion.

4. **Code cleanup**
   - Remove any dead/commented code.
   - Ensure all features properly reset in `startGame()`.
   - Verify all HUD elements update correctly after each feature.

**Commit message:** `feat: final balance pass, visual polish, and code cleanup`

---

## Phases at a Glance

| Phase | Feature | Complexity |
|-------|---------|-----------|
| 1 | Sprint, stamina, melee | Medium |
| 2 | Headshots, damage numbers, combos | Medium |
| 3 | Zombie collision, avoidance, blood pools | Medium-High |
| 4a | Boss waves | High |
| 4b | Power-up drops | Medium |
| 5 | Pause menu | Low |
| 6 | Weapon upgrade kits | Medium |
| 7 | Barricade system | High |
| 8 | Weather effects | Medium |
| 9 | Kill feed, damage indicator, weapon wheel | Medium |
| 10 | Persistent upgrades, leaderboard | Medium |
| 11 | Randomized loot, new buildings | Medium |
| 12 | Weapon swap animation, gun models | Medium |
| 13 | Bullet casings | Low |
| 14 | Object pooling, timing fixes, light audit | Medium |
| 15 | Final balance & polish | Medium |

Each phase produces a working, playable game and is committed before starting the next.