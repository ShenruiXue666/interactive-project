/**
 * Main Sketch - Neon Drift Racing
 * Orchestrates the game, camera, HUD, and rendering
 * 
 * Person C - Rendering, HUD, and Presentation
 * Person B - Bilal: Track integration, collision callbacks, Game Over screen, checkpoint system
 * 
 * This file coordinates:
 * - Game loop and state management
 * - Camera follow system
 * - HUD rendering
 * - Neon visual effects
 * - Menu system and user input
 * - Integration with Person B's track and collision systems
 */

/* ============================================
 * GAME STATE VARIABLES
 * ============================================
 */
let gameState = 'menu';  // 'menu', 'playing', 'paused', 'gameOver'
let gameMode = 'single'; // 'single' or 'two-player'

/* ============================================
 * CORE SYSTEMS
 * ============================================
 */
let camera;  // Camera system for following cars
let hud;     // HUD system for displaying game info

/* ============================================
 * TWO-PLAYER MODE TIMER
 * ============================================
 * Person B - Bilal: 30-second countdown timer for two-player mode.
 * When timer reaches zero, Game Over screen is displayed.
 */
let twoPlayerTimer = 1800;      // 30 seconds * 60 FPS = 1800 frames
let twoPlayerMaxTime = 1800;

/* ============================================
 * MATTER.JS PHYSICS ENGINE
 * ============================================
 */
let Engine = Matter.Engine;
let World = Matter.World;
let Bodies = Matter.Bodies;
let engine;
let world;

/* ============================================
 * GAME OBJECTS
 * ============================================
 */
let cars = [];      // Array of car objects
let track = null;   // Track data from Person B's buildTrack()
let raceRules = null; // Race rules and collision handlers from Person B
let lapInfo = {
    currentLap: 1,
    currentTime: 0,
    lastTime: null,
    bestTime: null
};

/* ============================================
 * VISUAL EFFECTS (Person C)
 * ============================================
 */
let skidMarks = [];           // Persistent skid mark trails
let particles = [];            // Particle effects for drift marks
let showParticles = true;      // Toggle for particle effects

/* ============================================
 * CHECKPOINT SYSTEM
 * ============================================
 */
// Track which checkpoints each player has activated
let checkpointActivations = {
    player1: new Array(6).fill(false),
    player2: new Array(6).fill(false)
};
let checkpointEffects = [];          // Visual effects for activated checkpoints
let checkpointCooldowns = [];        // Prevent duplicate activations
let alertCooldowns = [];             // Prevent spam alert popups
let showCheckpointAlerts = false;    // Toggle for checkpoint alerts (default OFF)

// Person B - Bilal: Time-based checkpoint activation (auto-resets after 2.5s)
let checkpointActiveUntil = [];      // millis until which each checkpoint stays green

// Person B - Bilal: Per-player checkpoint counters for two-player mode
let checkpointCounter = [0, 0];

// Person B - Bilal: Single-player checkpoint counter and high-score tracking
let singlePlayerCheckpointCount = 0;  // Current session checkpoint count for single-player
let bestCheckpointScore = 0;          // Best checkpoint score from localStorage (updates during gameplay)
let lastSessionDisplayedScore = 0;    // Score from previous session (loaded at start, never changes during current session)

// Person B - Bilal: Track last meaningful movement direction per car (for unstuck nudge)
let lastMovementDir = [];            // Array of {x, y} unit vectors

/* ============================================
 * VISUAL SETTINGS
 * ============================================
 */
const NEON_GRID_SIZE = 100;
const NEON_COLORS = {
    cyan: '#00ffff',
    magenta: '#ff00ff',
    yellow: '#ffff00',
    green: '#00ff00',
    wall: '#ff006f'
};

// Menu elements (unused, reserved for future use)
let menuElements;

/* ============================================
 * SOUND & MUSIC SYSTEM (Person C)
 * ============================================
 */
let menuMusic, pauseMusic, singlePlayerMusic, twoPlayerMusic, checkpointSound;
let currentMusic = null; // Tracks currently playing music track

/**
 * Preload game assets (sound files)
 * Called automatically by p5.js before setup()
 */
function preload() {
    soundFormats('wav', 'mp3');
    // NOTE: Ensure 'assets/sounds' folder contains these files
    menuMusic = loadSound('assets/sounds/menu.wav');
    pauseMusic = loadSound('assets/sounds/pause.wav');
    singlePlayerMusic = loadSound('assets/sounds/singleplayer.mp3');
    twoPlayerMusic = loadSound('assets/sounds/twoplayers.wav');
    checkpointSound = loadSound('assets/sounds/checkpoint.wav');
}

/**
 * p5.js setup function
 * Initializes the game canvas, physics engine, camera, HUD, and track
 */
function setup() {
    let canvas = createCanvas(windowWidth, windowHeight);
    canvas.parent('game-container');

    // Initialize Matter.js physics engine (top-down view, no gravity)
    engine = Engine.create();
    world = engine.world;
    world.gravity.y = 0;

    // Initialize core systems
    camera = new Camera(0, 0);
    hud = new HUD();

    // Person B - Bilal: Load best checkpoint score from localStorage
    loadBestCheckpointScore();

    // Setup menu button event listeners
    setupMenuSystem();

    // Initialize track system (Person B's buildTrack function)
    initializeTrack();

    // console.log('Neon Drift Racing');
    // console.log('Camera and HUD systems initialized');
}

/**
 * p5.js draw function - main game loop
 * Called 60 times per second, handles all game state rendering
 */
function draw() {
    background(10, 5, 20); // Dark purple background

    // Update background music based on current game state
    manageMusic();

    // Safety check: ensure game state is valid
    if (!gameState || gameState === 'undefined') {
        gameState = 'playing';
        // console.log("⚠️ Invalid game state detected, resetting to playing");
    }

    if (gameState === 'playing') {
        // Ensure physics engine is running
        if (engine && engine.world) {
            Engine.update(engine);
        } else {
            console.warn("⚠️ Physics engine not available, reinitializing...");
            if (typeof Engine !== 'undefined') {
                engine = Engine.create();
                world = engine.world;
                world.gravity.y = 0;
            }
        }

        // Update camera to follow car(s)
        updateCameraFollow();
        if (camera) {
            camera.update();
        }

        // Update all game logic (physics, timers, checkpoints, turrets)
        updateGameLogic();

        // Apply camera transformation and draw world
        if (camera) {
            camera.apply();
        }
        drawNeonGrid();              // Background grid
        drawTrack();                 // Track walls, checkpoints, turrets (Person B)
        drawAllSkidMarks();          // Persistent skid mark trails
        updateAndDrawParticles();    // Particle effects from drifting
        drawCars();                  // Player cars
        if (camera) {
            camera.unapply();
        }

        // Draw HUD overlay (no camera transform, always on screen)
        drawHUD();

        // Draw checkpoint activation visual effects
        drawCheckpointEffects();

        // Draw checkpoint status display in corner
        drawCheckpointStatus();

    } else if (gameState === 'gameOver') {
        // Person B - Bilal: Game Over screen for two-player mode
        // Physics stopped - freeze on last frame, show final checkpoint counts

        // Draw frozen game state (last frame before timer expired)
        if (camera) {
            camera.apply();
        }
        drawNeonGrid();
        drawTrack();
        drawAllSkidMarks();
        updateAndDrawParticles(); // Particles can still fade out
        drawCars();
        if (camera) {
            camera.unapply();
        }

        // Draw HUD with final scores
        drawHUD();
        drawCheckpointEffects();
        drawCheckpointStatus();

        // Game Over overlay shown via HTML/CSS

    } else if (gameState === 'menu' || gameState === 'paused') {
        // Show animated menu background effect
        drawMenuBackground();
    }
}

/**
 * Update camera to follow active car(s)
 * Single player: follows one car
 * Two player: follows both cars with split-screen or combined view
 */
function updateCameraFollow() {
    if (cars.length === 1) {
        camera.follow(cars[0].position);
    } else if (cars.length === 2 && gameMode === 'two-player') {
        camera.followMultiple([cars[0].position, cars[1].position]);
    }
}

/**
 * Update game logic each frame
 * Handles timers, car updates, skid marks, particles, checkpoints, and turrets
 */
function updateGameLogic() {
    // Update lap timer
    lapInfo.currentTime += deltaTime;

    // Person B - Bilal: Two-player mode countdown timer
    // When timer reaches zero, display Game Over screen with final checkpoint counts
    if (gameMode === 'two-player') {
        twoPlayerTimer -= 1;

        if (twoPlayerTimer <= 0) {
            // console.log('⏰ Two-player timer expired! Showing Game Over screen...');
            showGameOver();
            return;
        }
    }

    // Update all cars and track movement direction
    for (let i = 0; i < cars.length; i++) {
        let car = cars[i];
        car.update();

        // Person B - Bilal: Track last meaningful movement direction for unstuck nudge
        if (car && car.body && car.body.velocity) {
            let vx = car.body.velocity.x || 0;
            let vy = car.body.velocity.y || 0;
            let sp = Math.hypot(vx, vy);
            // Only update when moving enough to be meaningful (> 0.2 speed)
            if (sp > 0.2) {
                lastMovementDir[i] = { x: vx / sp, y: vy / sp };
            }
        }
    }

    // Generate skid marks when cars are drifting (Person C visual effect)
    // Only create new marks every 3 frames for performance
    if (frameCount % 3 === 0) {
        for (let i = 0; i < cars.length; i++) {
            let car = cars[i];
            if (car.state && car.state.drifting && car.trail && car.trail.length > 1) {
                let lastPoint = car.trail[car.trail.length - 1];
                let secondLastPoint = car.trail[car.trail.length - 2];
                let carColor = i === 0 ? NEON_COLORS.cyan : NEON_COLORS.magenta;

                // Create persistent skid mark
                skidMarks.push({
                    x1: lastPoint.x,
                    y1: lastPoint.y,
                    x2: secondLastPoint.x,
                    y2: secondLastPoint.y,
                    lifetime: 360, // Fades out over 6 seconds at 60fps
                    color: carColor
                });

                // Emit particle burst for visual effect
                if (showParticles) {
                    for (let j = 0; j < 3; j++) {
                        particles.push({
                            x: lerp(lastPoint.x, secondLastPoint.x, Math.random()),
                            y: lerp(lastPoint.y, secondLastPoint.y, Math.random()),
                            vx: (Math.random() - 0.5) * 1,
                            vy: (Math.random() - 0.5) * 1,
                            lifetime: 30, // 0.5 second lifetime
                            maxLifetime: 30,
                            color: carColor
                        });
                    }
                }
            }
        }
    }

    // Update checkpoint visual effects (fade timers)
    updateCheckpointEffects();

    // Person B - Bilal: Update turret system - applies forces to cars and manages spray effects
    // Works for both single-player and two-player modes
    if (track && track.turrets && track.turretData && track.turretState && cars.length > 0) {
        let carBodies = cars.map(c => c.body).filter(b => b != null);
        if (carBodies.length > 0 && typeof updateTurrets === 'function') {
            track.turretState = updateTurrets(track.turretState, track.turretData, track.turrets, carBodies, Matter);
        }
    }

    // Backup checkpoint proximity detection (supplementary to Person B's collision system)
    checkCheckpointProximity();
}

/**
 * Draw HUD based on game mode
 */
function drawHUD() {
    if (gameMode === 'single' && cars.length > 0) {
        // Get current drift time including active drift
        let car1State = cars[0].state || {};
        car1State.totalDriftTime = cars[0].getCurrentDriftTime ? cars[0].getCurrentDriftTime() : (car1State.totalDriftTime || 0);
        hud.drawSinglePlayer(car1State, lapInfo);
    } else if (gameMode === 'two-player' && cars.length >= 2) {
        // Get lap info for both players from race rules
        let player1LapInfo = raceRules ? raceRules.getLapInfo(0) : lapInfo;
        let player2LapInfo = raceRules ? raceRules.getLapInfo(1) : lapInfo;

        // Get current drift times including active drift
        let car1State = cars[0].state || {};
        let car2State = cars[1].state || {};
        car1State.totalDriftTime = cars[0].getCurrentDriftTime ? cars[0].getCurrentDriftTime() : (car1State.totalDriftTime || 0);
        car2State.totalDriftTime = cars[1].getCurrentDriftTime ? cars[1].getCurrentDriftTime() : (car2State.totalDriftTime || 0);

        hud.drawTwoPlayer(
            car1State,
            car2State,
            twoPlayerTimer // Pass the timer value
        );
    }
}

/**
 * Draw neon grid background
 * Person C: Creates animated cyan grid that follows camera for depth effect
 */
function drawNeonGrid() {
    push();

    stroke(NEON_COLORS.cyan);
    strokeWeight(1);

    // Calculate visible grid bounds
    let bounds = camera.getBounds();
    let startX = Math.floor(bounds.left / NEON_GRID_SIZE) * NEON_GRID_SIZE;
    let startY = Math.floor(bounds.top / NEON_GRID_SIZE) * NEON_GRID_SIZE;
    let endX = Math.ceil(bounds.right / NEON_GRID_SIZE) * NEON_GRID_SIZE;
    let endY = Math.ceil(bounds.bottom / NEON_GRID_SIZE) * NEON_GRID_SIZE;

    // Draw grid lines with glow
    drawingContext.shadowBlur = 5;
    drawingContext.shadowColor = NEON_COLORS.cyan;

    // Set lower opacity for grid
    stroke(0, 255, 255, 30);

    // Vertical lines
    for (let x = startX; x <= endX; x += NEON_GRID_SIZE) {
        line(x, startY, x, endY);
    }

    // Horizontal lines
    for (let y = startY; y <= endY; y += NEON_GRID_SIZE) {
        line(startX, y, endX, y);
    }

    drawingContext.shadowBlur = 0;
    pop();
}

/**
 * Draw track boundaries with neon glow
 * Renders walls, start line, checkpoints, and turrets (Person B's track elements)
 * Person B - Bilal: Includes checkpoint time-based activation and turret rendering
 */
function drawTrack() {
    if (!track) return;

    push();

    // Draw track walls with neon glow
    stroke(NEON_COLORS.wall);
    strokeWeight(4);
    drawingContext.shadowBlur = 15;
    drawingContext.shadowColor = NEON_COLORS.wall;
    noFill();

    // Draw all walls from track system
    for (let wall of track.walls) {
        let pos = wall.position;
        let angle = wall.angle;

        // Get wall dimensions from bounds
        let width = wall.bounds.max.x - wall.bounds.min.x;
        let height = wall.bounds.max.y - wall.bounds.min.y;

        push();
        translate(pos.x, pos.y);
        rotate(angle);
        rectMode(CENTER);
        rect(0, 0, width, height);
        pop();
    }

    // Draw start line
    stroke(NEON_COLORS.yellow);
    strokeWeight(3);
    drawingContext.shadowColor = NEON_COLORS.yellow;

    let startPos = track.startSensor.position;
    let startBounds = track.startSensor.bounds;
    let startWidth = startBounds.max.x - startBounds.min.x;
    let startHeight = startBounds.max.y - startBounds.min.y;

    push();
    translate(startPos.x, startPos.y);
    rectMode(CENTER);
    rect(0, 0, startWidth, startHeight);
    pop();

    // Person B - Bilal: Draw checkpoints with time-based activation states
    // Checkpoints turn green when activated and auto-reset after 2.5 seconds
    for (let i = 0; i < track.checkpoints.length; i++) {
        let checkpoint = track.checkpoints[i];
        let pos = checkpoint.position;
        let radius = checkpoint.circleRadius || 35;

        // Check if checkpoint is currently active (time-based)
        let isActivated = checkpointActiveUntil && checkpointActiveUntil[i] && millis() < checkpointActiveUntil[i];

        if (isActivated) {
            // Activated checkpoint - bright green with glow
            stroke('#00ff00');
            strokeWeight(4);
            drawingContext.shadowBlur = 20;
            drawingContext.shadowColor = '#00ff00';
        } else {
            // Inactive checkpoint - cyan outline
            stroke(NEON_COLORS.cyan);
            strokeWeight(3);
            drawingContext.shadowBlur = 10;
            drawingContext.shadowColor = NEON_COLORS.cyan;
        }

        circle(pos.x, pos.y, radius * 2);
    }

    // Person B - Bilal: Draw turrets with pulsing glow and random spray particles
    if (track.turrets && track.turretData && track.turretState) {
        for (let i = 0; i < track.turrets.length; i++) {
            let turret = track.turrets[i];
            let turData = track.turretData[i];
            let turState = track.turretState;

            if (!turret || !turData) continue;

            let pos = turret.position;
            let glow = turState.glowIntensity && turState.glowIntensity[i] ? turState.glowIntensity[i] : 0;

            // Draw pulsing glow around turret when active
            if (glow > 0) {
                push();
                noFill();
                stroke(100, 200, 255, glow * 120);
                strokeWeight(3);
                drawingContext.shadowBlur = glow * 25;
                drawingContext.shadowColor = 'rgba(100, 200, 255, ' + (glow * 0.8) + ')';
                circle(pos.x, pos.y, 60 + glow * 20); // Glow expands with intensity
                drawingContext.shadowBlur = 0;
                pop();
            }

            // Draw turret base (small rectangle)
            push();
            translate(pos.x, pos.y);
            stroke('#00aaff');
            strokeWeight(2);
            fill('#0066aa');
            drawingContext.shadowBlur = 10 + glow * 15;
            drawingContext.shadowColor = glow > 0 ? '#00ffff' : '#00aaff';
            rectMode(CENTER);
            rect(0, 0, 40, 40);

            // Draw center indicator
            fill('#00ffff');
            noStroke();
            circle(0, 0, 8);
            drawingContext.shadowBlur = 0;
            pop();

            // Draw active spray particles if spraying (random directions, wide spread)
            if (turState.activeSprays && turState.activeSprays[i] && turState.particles && turState.particles[i]) {
                for (let p of turState.particles[i]) {
                    if (!p || p.life <= 0) continue;

                    // Calculate current particle position (animated toward target)
                    let progress = 1 - (p.life / p.maxLife);
                    let currentX = p.x + (p.tx - p.x) * progress;
                    let currentY = p.y + (p.ty - p.y) * progress;
                    let alpha = (p.life / p.maxLife) * 200; // Fade out

                    // Draw larger, more visible particles with trail
                    push();
                    fill(100, 200, 255, alpha);
                    stroke(150, 220, 255, alpha * 0.8);
                    strokeWeight(1.5);
                    drawingContext.shadowBlur = 8;
                    drawingContext.shadowColor = 'rgba(100, 200, 255, ' + (alpha / 255) + ')';
                    circle(currentX, currentY, 5 + progress * 2); // Slightly larger particles
                    drawingContext.shadowBlur = 0;

                    // Draw trail line back to turret for longer spray effect
                    if (progress > 0.2) {
                        stroke(100, 200, 255, alpha * 0.4);
                        strokeWeight(1);
                        line(p.x, p.y, currentX, currentY);
                    }
                    pop();
                }

                // Draw wider spray area indicator (full circle spray, not directional)
                if (turState.activeSprays[i]) {
                    push();
                    noFill();
                    stroke(100, 200, 255, 60);
                    strokeWeight(2);
                    drawingContext.shadowBlur = 10;
                    drawingContext.shadowColor = 'rgba(100, 200, 255, 0.3)';
                    // Draw multiple concentric circles to show spray range
                    let sprayRange = turData.sprayRadius || 120;
                    for (let r = sprayRange * 0.3; r <= sprayRange; r += sprayRange * 0.2) {
                        circle(pos.x, pos.y, r * 2);
                    }
                    drawingContext.shadowBlur = 0;
                    pop();
                }
            }
        }
    }

    drawingContext.shadowBlur = 0;
    pop();
}

/**
 * Draw cars with neon glow effects
 * Person C: Renders car bodies with color-coded glow (cyan for P1, magenta for P2)
 */
function drawCars() {
    push();

    for (let i = 0; i < cars.length; i++) {
        let car = cars[i];
        let carColor = i === 0 ? NEON_COLORS.cyan : NEON_COLORS.magenta;

        // Apply glow
        drawingContext.shadowBlur = 20;
        drawingContext.shadowColor = carColor;

        // Draw car body
        fill(carColor);
        stroke(255);
        strokeWeight(2);

        push();
        translate(car.position.x, car.position.y);
        rotate(car.angle);

        // Simple car shape
        rectMode(CENTER);
        rect(0, 0, 50, 30);

        // Headlights
        fill(255, 255, 0);
        rect(25, 0, 10, 30);

        pop();
    }

    drawingContext.shadowBlur = 0;
    pop();
}

/**
 * Draw all persistent skid marks
 * Person C: Renders fading skid mark trails left by drifting cars
 * Marks fade out over time and are removed when lifetime expires
 */
function drawAllSkidMarks() {
    push();
    noFill();
    for (let i = skidMarks.length - 1; i >= 0; i--) {
        let mark = skidMarks[i];
        let alpha = (mark.lifetime / 360); // Fades from 1 to 0

        // Apply neon glow effect
        drawingContext.shadowBlur = 15;
        drawingContext.shadowColor = mark.color;

        // Set stroke color to match the car's color, with fading alpha
        let c = color(mark.color);
        stroke(red(c) - 100, green(c) - 100, blue(c) - 100, alpha * 150);
        strokeWeight(3);
        line(mark.x1 - 5, mark.y1, mark.x2 - 5, mark.y2);
        line(mark.x1 + 5, mark.y1, mark.x2 + 5, mark.y2);

        mark.lifetime--;
        if (mark.lifetime <= 0) {
            skidMarks.splice(i, 1);
        }
    }
    drawingContext.shadowBlur = 0; // Reset shadow
    pop();
}

/**
 * Update and draw all particle effects
 * Person C: Manages particle lifetime, movement, and fading for drift visual effects
 */
function updateAndDrawParticles() {
    push();
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];

        // Update position
        p.x += p.vx;
        p.y += p.vy;
        p.lifetime--;

        // Calculate alpha
        let alpha = p.lifetime / p.maxLifetime;

        // Draw particle
        let c = color(p.color);
        drawingContext.shadowBlur = 10;
        drawingContext.shadowColor = p.color;
        stroke(red(c) - 50, green(c) - 50, blue(c) - 50, alpha * 255);
        strokeWeight(6);
        point(p.x, p.y);

        // Remove if lifetime is over
        if (p.lifetime <= 0) {
            particles.splice(i, 1);
        }
    }
    drawingContext.shadowBlur = 0;
    pop();
}

/**
 * Draw animated background for menu screens
 * Person C: Creates pulsing grid effect for menu visual appeal
 */
function drawMenuBackground() {
    push();

    // Animated grid
    let time = millis() * 0.001;

    for (let x = 0; x < width; x += 50) {
        for (let y = 0; y < height; y += 50) {
            let offset = sin(time + x * 0.01 + y * 0.01) * 5;
            stroke(0, 255, 255, 20 + offset);
            strokeWeight(1);
            point(x, y);
        }
    }

    pop();
}

/**
 * Initialize track system
 * Calls Person B's buildTrack() to construct the arena, checkpoints, obstacles, and turrets
 */
function initializeTrack() {
    track = buildTrack(Matter, world);
    // console.log('Track initialized with bounds:', track.bounds);
}

/**
 * Initialize game objects (cars, race rules, etc.)
 * Creates car(s) based on game mode and sets up collision detection via Person B's race rules
 */
function initializeGame() {
    // Clear existing cars from world
    for (let car of cars) {
        if (car.body) {
            World.remove(world, car.body);
        }
    }

    // Get start positions from track system
    let startPositions = getStartPositions();

    // Create car(s) using Car class
    if (gameMode === 'single') {
        let car = new Car(startPositions[0].x, startPositions[0].y, engine, world, {
            up: 87,      // W
            down: 83,    // S
            left: 65,    // A
            right: 68    // D
        });
        cars = [car];
    } else {
        // Player 1 - WASD
        let car1 = new Car(startPositions[0].x, startPositions[0].y, engine, world, {
            up: 87,      // W
            down: 83,    // S
            left: 65,    // A
            right: 68    // D
        });

        // Player 2 - Arrow keys
        let car2 = new Car(startPositions[1].x, startPositions[1].y, engine, world, {
            up: UP_ARROW,
            down: DOWN_ARROW,
            left: LEFT_ARROW,
            right: RIGHT_ARROW
        });

        cars = [car1, car2];
    }

    // Setup race rules and collision detection
    let carBodies = cars.map((car, index) => {
        // Set unique label for each car
        car.body.label = "CAR" + index;
        return car.body;
    });
    raceRules = attachRaceRules(Matter, engine, carBodies, {
        onCheckpoint: onCheckpoint,
        onLap: onLap,
        onWallHit: onWallHit,
        onPad: onPad
    });

    // Reset lap info
    lapInfo = {
        currentLap: 1,
        currentTime: 0,
        lastTime: null,
        bestTime: null
    };

    // Person B - Bilal: Reset checkpoint activations and timers
    let cpCount = (track && track.checkpoints) ? track.checkpoints.length : 6;
    checkpointActivations.player1 = new Array(cpCount).fill(false);
    checkpointActivations.player2 = new Array(cpCount).fill(false);
    checkpointActiveUntil = new Array(cpCount).fill(0);  // Time-based reset system
    checkpointCounter = [0, 0];                         // Two-player checkpoint counters
    singlePlayerCheckpointCount = 0;                     // Single-player checkpoint counter
    checkpointEffects = [];
    checkpointCooldowns = [];
    alertCooldowns = [];
    lastMovementDir = [];                              // For unstuck nudge system

    // Reset two-player timer
    twoPlayerTimer = twoPlayerMaxTime;

    // console.log('Game initialized with', cars.length, 'car(s)');
}

/**
 * Setup menu system interactions
 * Binds event listeners to menu buttons for navigation
 */
function setupMenuSystem() {
    // Single player button
    document.getElementById('btn-single').addEventListener('click', () => {
        gameMode = 'single';
        startGame();
    });

    // Two player button
    document.getElementById('btn-two-player').addEventListener('click', () => {
        gameMode = 'two-player';
        startGame();
    });

    // Instructions button
    document.getElementById('btn-instructions').addEventListener('click', () => {
        document.getElementById('start-menu').style.display = 'none';
        document.getElementById('instructions-overlay').style.display = 'flex';
    });

    // Back button (bottom)
    document.getElementById('btn-back').addEventListener('click', () => {
        document.getElementById('instructions-overlay').style.display = 'none';
        document.getElementById('start-menu').style.display = 'flex';
    });

    // Back button (top)
    document.getElementById('btn-back-top').addEventListener('click', () => {
        document.getElementById('instructions-overlay').style.display = 'none';
        document.getElementById('start-menu').style.display = 'flex';
    });

    // Pause menu buttons
    document.getElementById('btn-resume').addEventListener('click', () => {
        resumeGame();
    });

    document.getElementById('btn-restart').addEventListener('click', () => {
        restartGame();
    });

    document.getElementById('btn-menu').addEventListener('click', () => {
        returnToMenu();
    });
}

/**
 * Start the game
 * Hides menus and initializes game objects (cars, track, race rules)
 */
function startGame() {
    document.getElementById('start-menu').style.display = 'none';
    document.getElementById('instructions-overlay').style.display = 'none';
    gameState = 'playing';

    // Initialize game
    initializeGame();

    // console.log('Game started in ' + gameMode + ' mode');
}

/**
 * Pause the game
 * Switches game state to 'paused' and shows pause menu overlay
 */
function pauseGame() {
    if (gameState === 'playing') {
        gameState = 'paused';
        document.getElementById('pause-menu').style.display = 'flex';
    }
}

/**
 * Resume the game
 * Returns from paused state to playing state and hides pause menu
 */
function resumeGame() {
    gameState = 'playing';
    document.getElementById('pause-menu').style.display = 'none';
}

/**
 * Restart the game
 * Resets all game state, timers, checkpoints, and reinitializes game objects
 */
function restartGame() {
    // console.log("🔄 RESTARTING GAME...");

    gameState = 'playing';

    // Hide game over overlay if visible
    document.getElementById('gameover-menu').style.display = 'none';

    // Reset two-player timer
    twoPlayerTimer = twoPlayerMaxTime;

    // Clear any blocking states
    checkpointCooldowns = [];
    alertCooldowns = [];
    checkpointEffects = [];

    // Reset checkpoint activations
    if (checkpointActivations) {
        let cpCount = (track && track.checkpoints) ? track.checkpoints.length : 6;
        checkpointActivations.player1 = new Array(cpCount).fill(false);
        checkpointActivations.player2 = new Array(cpCount).fill(false);
        checkpointActiveUntil = new Array(cpCount).fill(0);
    }

    // Resume game
    resumeGame();

    // Reinitialize game
    initializeGame();

    // Reset camera
    if (camera) {
        camera.x = 0;
        camera.y = 0;
    }

    // console.log("✅ Game restarted successfully");
}

/**
 * Return to main menu
 * Resets game state to menu and shows start menu overlay
 */
function returnToMenu() {
    gameState = 'menu';
    document.getElementById('pause-menu').style.display = 'none';
    document.getElementById('gameover-menu').style.display = 'none';
    document.getElementById('start-menu').style.display = 'flex';
}

/**
 * Person B - Bilal: Show Game Over screen for two-player mode
 * Displays final checkpoint counts when timer expires
 * Stops physics updates and freezes the game state
 */
function showGameOver() {
    gameState = 'gameOver';

    // Get final checkpoint counts from Person B's checkpoint counter system
    let player1Score = checkpointCounter[0] || 0;
    let player2Score = checkpointCounter[1] || 0;

    // Update HTML overlay with final scores
    document.getElementById('player1-score').textContent = player1Score;
    document.getElementById('player2-score').textContent = player2Score;

    // Display the Game Over overlay
    document.getElementById('gameover-menu').style.display = 'flex';

    // console.log('🎮 Game Over! Player 1:', player1Score, 'checkpoints | Player 2:', player2Score, 'checkpoints');
}

/**
 * Handle keyboard input
 * Processes all key presses for game controls (pause, respawn, menu, toggles, etc.)
 */
function keyPressed() {
    // Pause / Resume
    if (key === 'p' || key === 'P') {
        if (gameState === 'playing') {
            pauseGame();
        } else if (gameState === 'paused') {
            resumeGame();
        }
    }

    // Restart/Respawn
    if (key === 'r' || key === 'R') {
        if (gameState === 'gameOver') {
            // Person B - Bilal: Restart game from Game Over screen
            restartGame();
        } else if (gameState === 'playing' || gameState === 'paused') {
            if (gameMode === 'two-player') {
                // In two-player mode, R key only respawns player 1
                respawnPlayer(0);
            } else {
                // In single player mode, R key restarts the entire game
                restartGame();
            }
        }
    }

    // Right Ctrl key for player 2 respawn in two-player mode
    if (keyCode === 17 && gameState === 'playing' && gameMode === 'two-player') {
        respawnPlayer(1);
    }

    // Return to menu
    if (keyCode === ESCAPE) {
        if (gameState === 'playing') {
            pauseGame();
        } else if (gameState === 'paused') {
            returnToMenu();
        }
        return false; // Prevent default
    }

    // Test checkpoint activation with T key
    if (key === 't' || key === 'T') {
        // console.log("🧪 TESTING CHECKPOINT ACTIVATION!");
        onCheckpoint(0, 0); // Force activate checkpoint 0 for player 0
    }

    // Toggle checkpoint alerts with L key (L for "alerts")
    if (key === 'l' || key === 'L') {
        showCheckpointAlerts = !showCheckpointAlerts;
        // console.log("🔔 Checkpoint alerts:", showCheckpointAlerts ? "ENABLED" : "DISABLED");
    }

    // Toggle particles with E key (from user version)
    if (key === 'e' || key === 'E') {
        showParticles = !showParticles;
        // console.log("✨ Particles:", showParticles ? "ENABLED" : "DISABLED");
    }

    // Return to menu with M key
    if (key === 'm' || key === 'M') {
        // console.log("🏁 Returning to menu");
        // Person B - Bilal: Allow returning to menu from Game Over screen
        if (gameState === 'gameOver' || gameState === 'playing' || gameState === 'paused') {
            returnToMenu();
        }
    }

    // Force game state to playing with G key (if stuck)
    if (key === 'g' || key === 'G') {
        // console.log("🔄 FORCING GAME STATE TO PLAYING");
        gameState = 'playing';
        // console.log("✅ Game state forced to playing");
    }

    // Person B - Bilal: Unstuck nudge with U key
    // Gives a small velocity kick and force to help cars escape when stuck against walls
    if (key === 'u' || key === 'U') {
        const kickSpeed = 6;     // Small initial speed burst
        const forceMag = 0.06;  // Follow-up force for smooth separation
        for (let i = 0; i < cars.length; i++) {
            let car = cars[i];
            if (!car || !car.body) continue;

            // Use last movement direction, or fallback to car's facing direction
            let dir = lastMovementDir[i];
            let useFacingFallback = false;
            if (!dir || !isFinite(dir.x) || !isFinite(dir.y)) {
                useFacingFallback = true;
            } else if (Math.hypot(dir.x, dir.y) < 0.5) {
                useFacingFallback = true;
            }
            if (useFacingFallback) {
                let angle = car.body.angle || 0;
                dir = { x: Math.cos(angle), y: Math.sin(angle) };
            }

            // Push car in opposite direction to separate from obstacle
            let ox = -dir.x;
            let oy = -dir.y;
            let len = Math.hypot(ox, oy) || 1;
            ox /= len;
            oy /= len;

            // Apply immediate velocity kick (feels responsive)
            let v = car.body.velocity || { x: 0, y: 0 };
            Matter.Body.setVelocity(car.body, {
                x: v.x + ox * kickSpeed,
                y: v.y + oy * kickSpeed
            });

            // Apply follow-up force to maintain separation
            Matter.Body.applyForce(car.body, car.body.position, {
                x: ox * forceMag,
                y: oy * forceMag
            });

            // Small positional adjustment for deeply stuck cars (avoids teleporting)
            Matter.Body.translate(car.body, { x: ox * 2, y: oy * 2 });

            if (camera && camera.shake) camera.shake(2, 3);
        }
        // console.log("🛠️ Unstuck nudge applied (kick+force)");
    }

    // Person B - Bilal: Handbrake/drift boost with Space key
    // Applies strong drift effect when handbrake is held
    if (key === ' ' && gameState === 'playing') {
        for (let car of cars) {
            if (car.state && car.state.speed > 1) {
                let velocity = car.body.velocity;
                let angle = car.body.angle;

                // Calculate forward and lateral velocity components
                let forward = {
                    x: Math.cos(angle),
                    y: Math.sin(angle)
                };

                let forwardSpeed = velocity.x * forward.x + velocity.y * forward.y;
                let lateralVelocity = {
                    x: velocity.x - forward.x * forwardSpeed,
                    y: velocity.y - forward.y * forwardSpeed
                };

                // Apply strong drift effect (reduces forward speed, maintains lateral)
                Matter.Body.setVelocity(car.body, {
                    x: forward.x * forwardSpeed * 0.8 + lateralVelocity.x * 0.7,
                    y: forward.y * forwardSpeed * 0.8 + lateralVelocity.y * 0.7
                });

                // Camera shake for handbrake feedback
                if (camera && camera.shake) {
                    camera.shake(8, 5);
                }
            }
        }
    }
}

/**
 * Respawn a specific player at start position
 * Resets car position, velocity, and rotation to spawn point
 * @param {number} playerIndex - Index of the player to respawn (0 or 1)
 */
function respawnPlayer(playerIndex) {
    if (!cars[playerIndex] || !track) return;

    // console.log(`🔄 Respawning player ${playerIndex + 1}`);

    // Get start positions from track system
    let startPositions = getStartPositions();

    if (startPositions[playerIndex]) {
        let car = cars[playerIndex];

        // Use Matter.js Body.setPosition and Body.setVelocity for proper physics updates
        Matter.Body.setPosition(car.body, {
            x: startPositions[playerIndex].x,
            y: startPositions[playerIndex].y
        });

        Matter.Body.setVelocity(car.body, { x: 0, y: 0 });
        Matter.Body.setAngularVelocity(car.body, 0);
        Matter.Body.setAngle(car.body, 0);

        // console.log(`✅ Player ${playerIndex + 1} respawned at start position (${startPositions[playerIndex].x}, ${startPositions[playerIndex].y})`);
    } else {
        console.warn(`⚠️ No start position found for player ${playerIndex + 1}`);
    }
}

/**
 * Handle window resize
 * Adjusts canvas size when browser window is resized
 */
function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
}

/* ============================================
 * INTEGRATION POINTS FOR PERSON A
 * ============================================
 * Person A: Vehicle Physics callbacks
 * These functions are called by Person A's car.js for drift scoring and effects
 */

/**
 * Called when drift starts
 * @param {number} carIndex - Index of the car starting to drift
 */
function onDriftStart(carIndex) {
    if (camera && camera.shake) {
        camera.shake(5, 5);
    }
}

/**
 * Called when drift ends with score
 * @param {number} carIndex - Index of the car that finished drifting
 * @param {number} score - Score earned from the drift
 * @param {number} combo - Combo multiplier applied
 */
function onDriftEnd(carIndex, score, combo) {
    if (cars[carIndex] && cars[carIndex].state) {
        cars[carIndex].state.driftScore += score;
    }
}

/* ============================================
 * INTEGRATION POINTS FOR PERSON B
 * ============================================
 * Person B - Bilal: These callback functions are called by Person B's track.js
 * when collision events occur (checkpoints, laps, wall hits, pads)
 */

/**
 * Called when car completes a lap
 * @param {number} carIndex - Index of the car that completed the lap
 * @param {number} lapTime - Lap time in seconds
 */
function onLap(carIndex, lapTime) {
    // console.log('Lap completed!', lapTime);

    lapInfo.lastTime = lapTime;
    if (!lapInfo.bestTime || lapTime < lapInfo.bestTime) {
        lapInfo.bestTime = lapTime;
    }
    lapInfo.currentLap++;
    lapInfo.currentTime = 0;

    // Camera shake for lap completion
    if (camera && camera.shake) {
        camera.shake(8, 15);
    }
}

/**
 * Called when car hits checkpoint
 * Person B - Bilal: Handles checkpoint activation, visual effects, and two-player scoring
 * @param {number} carIndex - Index of the car that hit the checkpoint
 * @param {number} checkpointIndex - Index of the checkpoint that was hit
 */
function onCheckpoint(carIndex, checkpointIndex) {
    try {
        // Play checkpoint sound effect
        if (checkpointSound && checkpointSound.isLoaded()) {
            checkpointSound.play();
        }

        // Check for recent activation to prevent duplicate effects
        let cooldownKey = `${carIndex}-${checkpointIndex}`;
        let wasRecentlyActivated = checkpointCooldowns[cooldownKey] && checkpointCooldowns[cooldownKey] > millis() - 500;

        if (wasRecentlyActivated) {
            // console.log("⏰ Checkpoint", checkpointIndex, "already activated recently for car", carIndex);
        }

        // console.log('🎯 CHECKPOINT ACTIVATED! Car', carIndex, 'hit checkpoint', checkpointIndex);

        // Set cooldown to prevent duplicate activations
        checkpointCooldowns[cooldownKey] = millis();

        // Track checkpoint activation per player
        if (carIndex === 0 && checkpointActivations && checkpointActivations.player1) {
            checkpointActivations.player1[checkpointIndex] = true;
        }
        if (carIndex === 1 && checkpointActivations && checkpointActivations.player2) {
            checkpointActivations.player2[checkpointIndex] = true;
        }

        // Person B - Bilal: Mark checkpoint as active with time-based auto-reset
        if (checkpointActiveUntil && typeof millis === 'function') {
            checkpointActiveUntil[checkpointIndex] = millis() + 2500; // Resets after 2.5 seconds
        }

        // Person B - Bilal: Increment checkpoint counter for two-player mode scoring
        if (gameMode === 'two-player' && checkpointCounter && checkpointCounter.length >= 2) {
            checkpointCounter[carIndex] = (checkpointCounter[carIndex] || 0) + 1;
        }

        // Person B - Bilal: Increment single-player checkpoint counter and update high score
        if (gameMode === 'single' && carIndex === 0) {
            singlePlayerCheckpointCount++;

            // Update best score if current count exceeds it (for saving to localStorage)
            if (singlePlayerCheckpointCount > bestCheckpointScore) {
                bestCheckpointScore = singlePlayerCheckpointCount;
                saveBestCheckpointScore(bestCheckpointScore);
            }

            // Update displayed "Last Player's Score" when current player beats previous score
            // This ensures next person sees the updated high score
            if (singlePlayerCheckpointCount > lastSessionDisplayedScore) {
                lastSessionDisplayedScore = singlePlayerCheckpointCount;
            }
        }

        // Create visual effect safely (only if not recently activated)
        if (!wasRecentlyActivated && track && track.checkpoints && track.checkpoints[checkpointIndex] && checkpointEffects) {
            let checkpoint = track.checkpoints[checkpointIndex];
            checkpointEffects.push({
                x: checkpoint.position.x,
                y: checkpoint.position.y,
                timer: 60, // 1 second at 60fps
                maxTimer: 60,
                player: carIndex
            });
        }

        // Camera shake for checkpoint (safely)
        if (camera && camera.shake) {
            camera.shake(3, 5);
        }

        // console.log('✅ Checkpoint activation completed successfully');

        // Show non-blocking notification (from friend version - better UX)
        showCheckpointNotification(carIndex, checkpointIndex);

        // Optionally show blocking alert if enabled (from user version)
        if (showCheckpointAlerts) {
            let alertKey = `${carIndex}-${checkpointIndex}`;
            if (!alertCooldowns[alertKey] || alertCooldowns[alertKey] < millis() - 2000) {
                alertCooldowns[alertKey] = millis();
                showCheckpointAlert(carIndex, checkpointIndex);
            }
        }

    } catch (error) {
        console.error('❌ Error in checkpoint activation:', error);
    }
}

/**
 * Called when car hits a wall
 * Person B - Bilal: Applies penalty (drift combo reset, score penalty)
 * @param {number} carIndex - Index of the car that hit the wall
 */
function onWallHit(carIndex) {
    if (camera && camera.shake) {
        camera.shake(10, 8);
    }

    // Reset drift combo and apply score penalty
    if (cars[carIndex] && cars[carIndex].state) {
        cars[carIndex].state.driftCombo = 1;
        cars[carIndex].state.driftScore = Math.max(0, cars[carIndex].state.driftScore - 50);
    }
}

/**
 * Called when car hits a boost or grip pad
 * Person B - Bilal: Handles pad collisions (boost pads give speed, grip pads improve traction)
 * @param {number} carIndex - Index of the car that hit the pad
 * @param {string} padType - Type of pad: 'boost' or 'grip'
 */
function onPad(carIndex, padType) {
    // console.log('Car', carIndex, 'hit', padType, 'pad');

    if (padType === 'boost') {
        // Apply boost effect
        if (cars[carIndex]) {
            let velocity = cars[carIndex].body.velocity;
            let angle = cars[carIndex].body.angle;
            let boostForce = 0.1;

            Matter.Body.applyForce(cars[carIndex].body, cars[carIndex].body.position, {
                x: Math.cos(angle) * boostForce,
                y: Math.sin(angle) * boostForce
            });
        }
        if (camera && camera.shake) {
            camera.shake(5, 8);
        }
    } else if (padType === 'grip') {
        // Apply grip effect (reduce drift)
        if (cars[carIndex] && cars[carIndex].state) {
            cars[carIndex].state.gripBoost = 60; // 1 second at 60fps
        }
    }
}

/**
 * Update checkpoint activation visual effects
 * Decrements timer for all active checkpoint effects and removes expired ones
 */
function updateCheckpointEffects() {
    for (let i = checkpointEffects.length - 1; i >= 0; i--) {
        let effect = checkpointEffects[i];
        effect.timer--;

        if (effect.timer <= 0) {
            checkpointEffects.splice(i, 1);
        }
    }
}

/**
 * Draw checkpoint activation visual effects
 * Renders expanding rings and notifications when checkpoints are activated
 */
function drawCheckpointEffects() {
    push();

    for (let i = checkpointEffects.length - 1; i >= 0; i--) {
        let effect = checkpointEffects[i];
        let alpha = effect.timer / effect.maxTimer;

        if (effect.message) {
            // This is a notification - draw it differently
            textAlign(CENTER, CENTER);
            textSize(20);
            fill(0, 255, 0, alpha * 255);

            // Draw background box
            fill(0, 0, 0, alpha * 150);
            rect(effect.x - 150, effect.y - 20, 300, 40);

            // Draw text
            fill(0, 255, 0, alpha * 255);
            text(effect.message, effect.x, effect.y);

            // Update timer
            effect.timer--;
            if (effect.timer <= 0) {
                checkpointEffects.splice(i, 1);
            }
        } else {
            // This is a visual effect - draw expanding ring
            let scaleValue = 1 + (1 - alpha) * 2;

            stroke(0, 255, 0, alpha * 255);
            strokeWeight(3);
            noFill();

            push();
            translate(effect.x, effect.y);
            scale(scaleValue);
            circle(0, 0, 70);
            pop();

            // Draw "CHECKPOINT!" text
            if (alpha > 0.5) {
                textAlign(CENTER, CENTER);
                textSize(16);
                fill(0, 255, 0, alpha * 255);
                text('CHECKPOINT!', effect.x, effect.y - 50);
            }

            // Update timer
            effect.timer--;
            if (effect.timer <= 0) {
                checkpointEffects.splice(i, 1);
            }
        }
    }

    pop();
}

/**
 * Backup checkpoint proximity detection system
 * Supplementary to Person B's collision detection - provides additional safety check
 * Detects when cars are within checkpoint radius and triggers activation
 */
function checkCheckpointProximity() {
    try {
        if (!track || !track.checkpoints || !cars) return;

        for (let carIndex = 0; carIndex < cars.length; carIndex++) {
            let car = cars[carIndex];
            if (!car || !car.position) continue;

            let carPos = car.position;

            for (let cpIndex = 0; cpIndex < track.checkpoints.length; cpIndex++) {
                let checkpoint = track.checkpoints[cpIndex];
                if (!checkpoint || !checkpoint.position) continue;

                let cpPos = checkpoint.position;
                let cpRadius = checkpoint.circleRadius || 35;

                // Calculate distance between car and checkpoint
                let distance = Math.sqrt(
                    Math.pow(carPos.x - cpPos.x, 2) +
                    Math.pow(carPos.y - cpPos.y, 2)
                );

                // If car is inside checkpoint radius
                if (distance < cpRadius) {
                    // Create unique key for this car-checkpoint combination
                    let cooldownKey = `${carIndex}-${cpIndex}`;

                    // Check cooldown to prevent spam (reduced to 1 second)
                    if (!checkpointCooldowns[cooldownKey] || checkpointCooldowns[cooldownKey] < millis() - 1000) {
                        // console.log("🎯 PROXIMITY DETECTED! Car", carIndex, "inside checkpoint", cpIndex);

                        // Set cooldown
                        checkpointCooldowns[cooldownKey] = millis();

                        // Always trigger checkpoint activation (simplified)
                        // console.log("✅ TRIGGERING CHECKPOINT ACTIVATION!");
                        onCheckpoint(carIndex, cpIndex);
                    } else {
                        // console.log("⏰ Checkpoint", cpIndex, "on cooldown for car", carIndex);
                    }
                }
            }
        }
    } catch (error) {
        console.error('❌ Error in proximity detection:', error);
    }
}

/**
 * Show checkpoint alert dialog
 * Person C: Optional blocking alert (can be disabled via toggle)
 * Non-blocking by default for better gameplay flow
 */
function showCheckpointAlert(carIndex, checkpointIndex) {
    try {
        // console.log(`🎯 CHECKPOINT ${checkpointIndex + 1} ACTIVATED! Player ${carIndex + 1} reached checkpoint ${checkpointIndex + 1}!`);

        // Show alert popup but make it non-blocking
        let message = `🎯 CHECKPOINT ${checkpointIndex + 1} ACTIVATED!\n\nPlayer ${carIndex + 1} reached checkpoint ${checkpointIndex + 1}!\n\nWhat would you like to do?`;

        // Use setTimeout to make the dialog non-blocking
        setTimeout(() => {
            try {
                let choice = confirm(message + "\n\nClick OK to continue racing\nClick Cancel to return to menu");

                if (!choice) {
                    // User chose to return to menu
                    // console.log("🏁 Player chose to return to menu");
                    returnToMenu();
                } else {
                    // User chose to continue
                    // console.log("🏁 Player chose to continue racing");
                    gameState = 'playing';
                    // console.log("✅ Game state set to playing");
                }
            } catch (error) {
                console.error('❌ Error in checkpoint alert dialog:', error);
                gameState = 'playing';
            }
        }, 50); // Very small delay to prevent blocking

        // Also show visual notification
        showCheckpointNotification(carIndex, checkpointIndex);

    } catch (error) {
        console.error('❌ Error in checkpoint alert:', error);
        // Even if there's an error, ensure game continues
        gameState = 'playing';
    }
}

/**
 * Show non-blocking checkpoint notification
 * Person B - Bilal: Creates visual notification without interrupting gameplay
 * @param {number} carIndex - Index of the car that activated checkpoint
 * @param {number} checkpointIndex - Index of the activated checkpoint
 */
function showCheckpointNotification(carIndex, checkpointIndex) {
    // Create a temporary notification that doesn't block the game
    let notification = {
        message: `CHECKPOINT ${checkpointIndex + 1} ACTIVATED!`,
        player: carIndex + 1,
        timer: 120, // 2 seconds at 60fps
        maxTimer: 120,
        x: width / 2,
        y: height / 3
    };

    // Add to effects array for drawing
    checkpointEffects.push(notification);

    // console.log("✅ Checkpoint notification shown (non-blocking)");
}

/**
 * Draw checkpoint status display in HUD
 * Shows checkpoint activation states and control instructions in top-right corner
 * Person B - Bilal: Displays two-player checkpoint counters
 */
function drawCheckpointStatus() {
    if (!checkpointActivations) return;

    push();

    // Draw checkpoint status in top-right corner
    let x = width - 200;
    let y = 20;

    textAlign(LEFT, TOP);
    textSize(14);
    fill(255);
    text("CHECKPOINTS:", x, y);

    // Draw checkpoint indicators
    let cpCount = (track && track.checkpoints) ? track.checkpoints.length : 6;
    for (let i = 0; i < cpCount; i++) {
        let isActivated = checkpointActivations.player1[i] || checkpointActivations.player2[i];
        let color = isActivated ? '#00ff00' : '#666666';

        fill(color);
        text(`CP${i + 1}: ${isActivated ? '✓' : '○'}`, x, y + 20 + (i * 15));
    }

    // Show controls
    fill(255);
    text("Controls:", x, y + 140);
    text("E - Toggle Particle Effects", x, y + 155);
    text("ESC - Pause", x, y + 170);
    if (gameMode === 'single') {
        text("R - Respawn", x, y + 185);
        text("U - Unstuck nudge", x, y + 200);
    } else {
        text("R - Respawn P1", x, y + 185);
        text("Right Ctrl - Respawn P2", x, y + 200);
        text("U - Unstuck nudge", x, y + 215);
    }

    // Person B - Bilal: Display single-player checkpoint counter and high score
    if (gameMode === 'single') {
        fill(255);
        let counterY = y + 215;
        text(`Checkpoints: ${singlePlayerCheckpointCount}`, x, counterY);
        // Display score from previous session (not current session)
        if (lastSessionDisplayedScore > 0) {
            fill(200, 200, 255); // Slightly different color for high score
            text(`Last Player's Score: ${lastSessionDisplayedScore} Checkpoints`, x, counterY + 15);
        }
    }

    // Person B - Bilal: Display two-player checkpoint counters in HUD
    if (gameMode === 'two-player') {
        fill(255);
        let counterY = y + 230;
        text(`P1 CP Count: ${checkpointCounter[0] || 0}`, x, counterY);
        text(`P2 CP Count: ${checkpointCounter[1] || 0}`, x, counterY + 15);
    }

    pop();
}

/**
 * Manage background music playback
 * Person C: Automatically switches music tracks based on game state and mode
 * Handles smooth transitions between menu, pause, single-player, and two-player music
 */
function manageMusic() {
    let targetMusic = null;

    // Determine which music should be playing
    if (gameState === 'menu') {
        targetMusic = menuMusic;
    } else if (gameState === 'paused') {
        targetMusic = pauseMusic;
    } else if (gameState === 'playing') {
        if (gameMode === 'single') {
            targetMusic = singlePlayerMusic;
        } else if (gameMode === 'two-player') {
            targetMusic = twoPlayerMusic;
        }
    }

    // If the target music is not the one currently playing
    if (targetMusic !== currentMusic) {
        // Stop any currently playing music
        if (currentMusic && currentMusic.isLoaded() && currentMusic.isPlaying()) {
            currentMusic.stop();
        }

        // Play the new target music if it exists and is loaded
        if (targetMusic && targetMusic.isLoaded()) {
            targetMusic.loop();
        }

        // Update the current music tracker
        currentMusic = targetMusic;
    }
}

/* ============================================
 * SINGLE-PLAYER CHECKPOINT TRACKING SYSTEM
 * ============================================
 * Person B - Bilal: Added single-player checkpoint tracking and high-score save system
 * Tracks checkpoint count for single-player mode and saves best score to localStorage
 */

/**
 * Load best checkpoint score from localStorage
 * Person B - Bilal: Retrieves the highest checkpoint score from previous sessions
 * Stores it in both bestCheckpointScore (for saving) and lastSessionDisplayedScore (for display)
 */
function loadBestCheckpointScore() {
    try {
        let stored = localStorage.getItem('bestCheckpointScore');
        if (stored !== null) {
            let loadedScore = parseInt(stored, 10) || 0;
            bestCheckpointScore = loadedScore;
            lastSessionDisplayedScore = loadedScore;  // Store for display (never changes during current session)
            // console.log('📊 Loaded best checkpoint score from previous session:', loadedScore);
        }
    } catch (error) {
        console.warn('⚠️ Could not load best checkpoint score from localStorage:', error);
        bestCheckpointScore = 0;
        lastSessionDisplayedScore = 0;
    }
}

/**
 * Save best checkpoint score to localStorage
 * Person B - Bilal: Stores the highest checkpoint score for future sessions
 * @param {number} score - The checkpoint score to save
 */
function saveBestCheckpointScore(score) {
    try {
        localStorage.setItem('bestCheckpointScore', score.toString());
        // console.log('💾 Saved best checkpoint score:', score);
    } catch (error) {
        console.warn('⚠️ Could not save best checkpoint score to localStorage:', error);
    }
}

/**
 * Force game resumption after checkpoint alert
 * Safety function to ensure game continues running after dialog interactions
 */
function resumeGameFromCheckpoint() {
    try {
        // console.log("🔄 FORCING GAME RESUMPTION...");

        // Ensure game state is playing
        gameState = 'playing';

        // Ensure physics engine is running
        if (engine && engine.world) {
            // console.log("✅ Physics engine confirmed running");
        }

        // Force a frame update to get things moving
        // console.log("✅ Game resumption complete - should be running smoothly now");

        // Additional safety: ensure draw loop continues
        if (typeof draw === 'function') {
            // console.log("✅ Draw function available");
        }

    } catch (error) {
        console.error('❌ Error in game resumption:', error);
        // Fallback: just set game state to playing
        gameState = 'playing';
    }
}
