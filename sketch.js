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
let gameState = 'menu'; // 'menu', 'playing', 'paused', 'gameOver'
let gameMode = 'single'; // 'single' or 'two-player'

/* ============================================
 * CORE SYSTEMS
 * ============================================
 */
let camera; // Camera system for following cars
let hud; // HUD system for displaying game info

/* ============================================
 * TWO-PLAYER MODE TIMER
 * ============================================
 */
let twoPlayerTimer = 3600; // 60 seconds * 60 FPS = 3600 frames
let twoPlayerMaxTime = 3600;

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
let cars = []; // Array of car objects
let track = null; // Track data from Person B's buildTrack()
let raceRules = null; // Race rules and collision handlers from Person B
let lapInfo = {
    currentLap: 1,
    currentTime: 0,
    lastTime: null,
    bestTime: null
};

/* ============================================
 * VISUAL EFFECTS
 * ============================================
 */
// Use object pools to pre-allocate memory and avoid runtime garbage.
// This is the single biggest optimization for this file.
const MAX_SKIDMARKS = 300;
const MAX_PARTICLES = 1000;
let skidMarkPool = [];
let particlePool = [];
let nextSkidMarkIndex = 0;
let nextParticleIndex = 0;

let showParticles = false; // Toggle for particle effects

/* ============================================
 * CHECKPOINT SYSTEM
 * ============================================
 */
// Track which checkpoints each player has activated
let checkpointActivations = {
    player1: new Array(6).fill(false),
    player2: new Array(6).fill(false)
};
let checkpointEffects = []; // Visual effects for activated checkpoints
let checkpointCooldowns = {}; // Use an object map for faster lookups
let alertCooldowns = {}; // Use an object map

// Person B - Bilal: Time-based checkpoint activation (auto-resets after 2.5s)
let checkpointActiveUntil = []; // millis until which each checkpoint stays green

// Person B - Bilal: Per-player checkpoint counters for two-player mode
let checkpointCounter = [0, 0];

// Person B - Bilal: Single-player checkpoint counter and high-score tracking
let singlePlayerCheckpointCount = 0; // Current session checkpoint count for single-player
let bestCheckpointScore = 0; // Best checkpoint score from localStorage (updates during gameplay)
let lastSessionDisplayedScore = 0; // Score from previous session (loaded at start, never changes during current session)

// Person B - Bilal: Track last meaningful movement direction per car (for unstuck nudge)
let lastMovementDir = []; // Array of {x, y} unit vectors

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

/* ============================================
 * SOUND & MUSIC SYSTEM (Person C)
 * ============================================
 */
let menuMusic, pauseMusic, singlePlayerMusic, twoPlayerMusic, checkpointSound, resultMusic;
let currentMusic = null; // Tracks currently playing music track

/**
 * Preload game assets (sound files)
 */
function preload() {
    soundFormats('wav', 'mp3');
    // NOTE: Ensure 'assets/sounds' folder contains these files
    try {
        menuMusic = loadSound('assets/sounds/menu.wav');
        pauseMusic = loadSound('assets/sounds/pause.wav');
        singlePlayerMusic = loadSound('assets/sounds/singleplayer.mp3');
        twoPlayerMusic = loadSound('assets/sounds/twoplayers.wav');
        checkpointSound = loadSound('assets/sounds/checkpoint.wav');
        resultMusic = loadSound('assets/sounds/result.wav');
    } catch (e) {
        console.error("Error loading sounds. Make sure 'assets/sounds' folder exists.", e);
    }
}

/**
 * p5.js setup function
 */
function setup() {
    let canvas = createCanvas(windowWidth, windowHeight);
    canvas.parent('game-container');

    // Initialize Matter.js physics engine
    engine = Engine.create();
    world = engine.world;
    world.gravity.y = 0;

    // Initialize core systems
    camera = new Camera(0, 0);
    hud = new HUD();

    initializePools();

    // Person B - Bilal: Load best checkpoint score from localStorage
    loadBestCheckpointScore();

    // Setup menu button event listeners
    setupMenuSystem();

    // Initialize track system (Person B's buildTrack function)
    initializeTrack();
}

/**
 * p5.js draw function - main game loop
 */
function draw() {
    background(10, 5, 20); // Dark purple background

    // Update background music based on current game state
    manageMusic();

    // Safety check: ensure game state is valid
    if (!gameState || gameState === 'undefined') {
        gameState = 'playing';
    }

    if (gameState === 'playing') {
        // Ensure physics engine is running
        if (engine && engine.world) {
            Engine.update(engine);
        } else {
            // Failsafe in case engine is lost
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
        drawNeonGrid();
        drawTrack();
        drawAllSkidMarks();
        updateAndDrawParticles();
        drawCars();
        if (camera) {
            camera.unapply();
        }

        // Draw HUD overlay
        drawHUD();
        drawCheckpointEffects();
        drawCheckpointStatus();

    } else if (gameState === 'gameOver') {
        // Game Over screen (frozen game state)
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
        // Game Over overlay is shown via HTML/CSS

    } else if (gameState === 'menu' || gameState === 'paused') {
        // Show animated menu background effect
        drawMenuBackground();
    }
}

/**
 * Update camera to follow active car(s)
 */
function updateCameraFollow() {
    if (!camera) return;
    if (cars.length === 1) {
        camera.follow(cars[0].position);
    } else if (cars.length === 2 && gameMode === 'two-player') {
        camera.followMultiple([cars[0].position, cars[1].position]);
    }
}

/**
 * Update game logic each frame
 */
function updateGameLogic() {
    // Update lap timer
    lapInfo.currentTime += deltaTime;

    // Person B - Bilal: Two-player mode countdown timer
    if (gameMode === 'two-player') {
        twoPlayerTimer -= 1;
        if (twoPlayerTimer <= 0) {
            showGameOver();
            return;
        }
    }

    // Update all cars and track movement direction
    for (let i = 0; i < cars.length; i++) {
        let car = cars[i];
        if (!car || !car.body) continue;
        car.update();

        // Person B - Bilal: Track last meaningful movement direction for unstuck nudge
        if (car.body.velocity) {
            let vx = car.body.velocity.x || 0;
            let vy = car.body.velocity.y || 0;
            let sp = Math.hypot(vx, vy);
            if (sp > 0.2) {
                lastMovementDir[i] = { x: vx / sp, y: vy / sp };
            }
        }
    }

    if (frameCount % 3 === 0) {
        for (let i = 0; i < cars.length; i++) {
            let car = cars[i];
            if (car.state && car.state.drifting && car.trail && car.trail.length > 1) {
                let lastPoint = car.trail[car.trail.length - 1];
                let secondLastPoint = car.trail[car.trail.length - 2];
                let carColor = i === 0 ? NEON_COLORS.cyan : NEON_COLORS.magenta;

                // "Borrow" a skidmark from the pool
                borrowSkidMark(
                    lastPoint.x, lastPoint.y,
                    secondLastPoint.x, secondLastPoint.y,
                    carColor
                );

                // "Borrow" particles from the pool
                if (showParticles) {
                    for (let j = 0; j < 3; j++) {
                        borrowParticle(
                            lerp(lastPoint.x, secondLastPoint.x, Math.random()),
                            lerp(lastPoint.y, secondLastPoint.y, Math.random()),
                            (Math.random() - 0.5) * 1,
                            (Math.random() - 0.5) * 1,
                            30, carColor
                        );
                    }
                }
            }
        }
    }

    // Update checkpoint visual effects (fade timers)
    updateCheckpointEffects();

    // Person B - Bilal: Update turret system
    if (track && track.turrets && track.turretData && track.turretState && cars.length > 0) {
        let carBodies = cars.map(c => c.body).filter(b => b != null);
        if (carBodies.length > 0 && typeof updateTurrets === 'function') {
            // We pass the particle borrowing function to the turret system
            // so it can also use our global, optimized particle pool.
            updateTurrets_(
                track.turretState,
                track.turretData,
                track.turrets,
                carBodies,
                Matter,
                borrowParticle // Pass the borrow function
            );
        }
    }

    // PERFORMANCE: Removed redundant checkCheckpointProximity()
    // The physics engine's `onCheckpoint` callback is the correct
    // and only source of truth for this.
}

/**
 * Draw HUD based on game mode
 */
function drawHUD() {
    if (!hud) return;
    if (gameMode === 'single' && cars.length > 0) {
        let car1State = cars[0].state || {};
        car1State.totalDriftTime = cars[0].getCurrentDriftTime ? cars[0].getCurrentDriftTime() : (car1State.totalDriftTime || 0);
        hud.drawSinglePlayer(car1State, lapInfo);
    } else if (gameMode === 'two-player' && cars.length >= 2) {
        let player1LapInfo = raceRules ? raceRules.getLapInfo(0) : lapInfo;
        let player2LapInfo = raceRules ? raceRules.getLapInfo(1) : lapInfo;

        let car1State = cars[0].state || {};
        let car2State = cars[1].state || {};
        car1State.totalDriftTime = cars[0].getCurrentDriftTime ? cars[0].getCurrentDriftTime() : (car1State.totalDriftTime || 0);
        car2State.totalDriftTime = cars[1].getCurrentDriftTime ? cars[1].getCurrentDriftTime() : (car2State.totalDriftTime || 0);

        hud.drawTwoPlayer(
            car1State,
            car2State,
            twoPlayerTimer
        );
    }
}

/**
 * Draw neon grid background
 */
function drawNeonGrid() {
    push();

    let bounds = camera.getBounds();
    let startX = Math.floor(bounds.left / NEON_GRID_SIZE) * NEON_GRID_SIZE;
    let startY = Math.floor(bounds.top / NEON_GRID_SIZE) * NEON_GRID_SIZE;
    let endX = Math.ceil(bounds.right / NEON_GRID_SIZE) * NEON_GRID_SIZE;
    let endY = Math.ceil(bounds.bottom / NEON_GRID_SIZE) * NEON_GRID_SIZE;

    // drawingContext.shadowBlur = 5;
    // drawingContext.shadowColor = NEON_COLORS.cyan;

    // Set lower opacity for grid
    stroke(0, 255, 255, 30);
    strokeWeight(1);

    // Vertical lines
    for (let x = startX; x <= endX; x += NEON_GRID_SIZE) {
        line(x, startY, x, endY);
    }
    // Horizontal lines
    for (let y = startY; y <= endY; y += NEON_GRID_SIZE) {
        line(startX, y, endX, y);
    }

    // drawingContext.shadowBlur = 0;
    pop();
}

/**
 * Draw track boundaries with neon glow
 */
function drawTrack() {
    if (!track) return;

    push();

    // --- Draw track walls ---
    stroke(NEON_COLORS.wall);
    strokeWeight(4);
    drawingContext.shadowBlur = 15;
    drawingContext.shadowColor = NEON_COLORS.wall;
    noFill();

    for (let wall of track.walls) {
        let pos = wall.position;
        let angle = wall.angle;
        let width = wall.bounds.max.x - wall.bounds.min.x;
        let height = wall.bounds.max.y - wall.bounds.min.y;

        push();
        translate(pos.x, pos.y);
        rotate(angle);
        rectMode(CENTER);
        rect(0, 0, width, height);
        pop();
    }

    // --- Draw start line ---
    stroke(NEON_COLORS.yellow);
    strokeWeight(3);
    drawingContext.shadowColor = NEON_COLORS.yellow;
    push();
    translate(400, 500);
    rectMode(CENTER);
    rect(0, 0, 100, 70);
    if (gameMode === 'two-player') rect(1200, 0, 100, 70);
    pop();

    // --- Draw checkpoints ---
    for (let i = 0; i < track.checkpoints.length; i++) {
        let checkpoint = track.checkpoints[i];
        let pos = checkpoint.position;
        let radius = checkpoint.circleRadius || 35;
        let isActivated = checkpointActiveUntil && checkpointActiveUntil[i] && millis() < checkpointActiveUntil[i];

        if (isActivated) {
            stroke('#00ff00');
            strokeWeight(4);
            drawingContext.shadowBlur = 20;
            drawingContext.shadowColor = '#00ff00';
        } else {
            stroke(NEON_COLORS.cyan);
            strokeWeight(3);
            drawingContext.shadowBlur = 10;
            drawingContext.shadowColor = NEON_COLORS.cyan;
        }
        circle(pos.x, pos.y, radius * 2);
    }

    // --- Draw turrets ---
    if (track.turrets && track.turretData && track.turretState) {
        for (let i = 0; i < track.turrets.length; i++) {
            let turret = track.turrets[i];
            let turData = track.turretData[i];
            let turState = track.turretState;
            if (!turret || !turData) continue;

            let pos = turret.position;
            let glow = turState.glowIntensity && turState.glowIntensity[i] ? turState.glowIntensity[i] : 0;

            // Draw pulsing glow
            if (glow > 0) {
                push();
                noFill();
                stroke(100, 200, 255, glow * 120);
                strokeWeight(3);
                drawingContext.shadowBlur = glow * 25;
                drawingContext.shadowColor = 'rgba(100, 200, 255, ' + (glow * 0.8) + ')';
                circle(pos.x, pos.y, 60 + glow * 20);
                pop();
            }

            // Draw turret base
            push();
            translate(pos.x, pos.y);
            stroke('#00aaff');
            strokeWeight(2);
            fill('#0066aa');
            drawingContext.shadowBlur = 10 + glow * 15;
            drawingContext.shadowColor = glow > 0 ? '#00ffff' : '#00aaff';
            rectMode(CENTER);
            rect(0, 0, 40, 40);
            fill('#00ffff'); // Center indicator
            noStroke();
            circle(0, 0, 8);
            pop();

            // --- Draw Turret Spray Area ---
            // (Particle drawing is now handled by the global updateAndDrawParticles loop)
            if (turState.activeSprays && turState.activeSprays[i]) {
                push();
                noFill();
                stroke(100, 200, 255, 60);
                strokeWeight(2);
                drawingContext.shadowBlur = 10;
                drawingContext.shadowColor = 'rgba(100, 200, 255, 0.3)';
                let sprayRange = turData.sprayRadius || 120;
                for (let r = sprayRange * 0.3; r <= sprayRange; r += sprayRange * 0.2) {
                    circle(pos.x, pos.y, r * 2);
                }
                pop();
            }
        }
    }

    drawingContext.shadowBlur = 0;
    pop();
}

/**
 * Draw cars with neon glow effects
 */
function drawCars() {
    push();
    for (let i = 0; i < cars.length; i++) {
        let car = cars[i];
        let carColor = i === 0 ? NEON_COLORS.cyan : NEON_COLORS.magenta;

        drawingContext.shadowBlur = 20;
        drawingContext.shadowColor = carColor;

        fill(carColor);
        stroke(255);
        strokeWeight(2);

        push();
        translate(car.position.x, car.position.y);
        rotate(car.angle);
        rectMode(CENTER);
        rect(0, 0, 50, 30); // Body
        fill(255, 255, 0);
        rect(25, 0, 10, 30); // Headlights
        pop();
    }
    drawingContext.shadowBlur = 0;
    pop();
}

/**
 * Draw all persistent skid marks
 * Iterates the pool and draws only active marks.
 */
function drawAllSkidMarks() {
    push();
    noFill();

    // We can disable it or reduce it. Let's try disabling.
    // drawingContext.shadowBlur = 15;

    for (let i = 0; i < skidMarkPool.length; i++) {
        let mark = skidMarkPool[i];
        if (!mark.active) continue; // Skip inactive marks

        let alpha = (mark.lifetime / mark.maxLifetime);

        // if (drawingContext.shadowBlur > 0) {
        //     drawingContext.shadowColor = mark.color;
        // }

        let c = color(mark.color);
        stroke(red(c) - 100, green(c) - 100, blue(c) - 100, alpha * 150);
        strokeWeight(3);
        line(mark.x1 - 5, mark.y1, mark.x2 - 5, mark.y2);
        line(mark.x1 + 5, mark.y1, mark.x2 + 5, mark.y2);

        mark.lifetime--;
        if (mark.lifetime <= 0) {
            mark.active = false; // "Return" to pool
        }
    }
    drawingContext.shadowBlur = 0;
    pop();
}

/**
 * Update and draw all particle effects 
 * Iterates the pool and draws only active particles.
 */
function updateAndDrawParticles() {
    push();

    // drawingContext.shadowBlur = 10;
    strokeWeight(6);

    for (let i = 0; i < particlePool.length; i++) {
        let p = particlePool[i];
        if (!p.active) continue; // Skip inactive

        // Update
        p.x += p.vx;
        p.y += p.vy;
        p.lifetime--;

        // Draw
        let alpha = p.lifetime / p.maxLifetime;
        let c = color(p.color);
        // if (drawingContext.shadowBlur > 0) {
        //     drawingContext.shadowColor = p.color;
        // }
        stroke(red(c) - 50, green(c) - 50, blue(c) - 50, alpha * 255);
        point(p.x, p.y);

        // "Return" to pool
        if (p.lifetime <= 0) {
            p.active = false;
        }
    }
    drawingContext.shadowBlur = 0;
    pop();
}

/**
 * Draw animated background for menu screens
 */
function drawMenuBackground() {
    push();
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
 */
function initializeTrack() {
    if (typeof buildTrack === 'function') {
        track = buildTrack(Matter, world);
    } else {
        console.error("buildTrack() function not found. Is track.js loaded?");
    }
}

/**
 * Initialize game objects (cars, race rules, etc.)
 */
function initializeGame() {
    // Clear existing cars
    for (let car of cars) {
        if (car.body) {
            World.remove(world, car.body);
        }
    }

    let startPositions = getStartPositions();
    if (gameMode === 'single') {
        let car = new Car(startPositions[0].x, startPositions[0].y, engine, world, {
            up: 87, down: 83, left: 65, right: 68 // WASD
        });
        cars = [car];
    } else {
        let car1 = new Car(startPositions[0].x, startPositions[0].y, engine, world, {
            up: 87, down: 83, left: 65, right: 68 // WASD
        });
        let car2 = new Car(startPositions[1].x, startPositions[1].y, engine, world, {
            up: UP_ARROW, down: DOWN_ARROW, left: LEFT_ARROW, right: RIGHT_ARROW
        });
        cars = [car1, car2];
    }

    // Setup race rules and collision detection
    let carBodies = cars.map((car, index) => {
        car.body.label = "CAR" + index;
        return car.body;
    });

    if (typeof attachRaceRules === 'function') {
        raceRules = attachRaceRules(Matter, engine, carBodies, {
            onCheckpoint: onCheckpoint,
            onLap: onLap,
            onWallHit: onWallHit,
        });
    } else {
        console.error("attachRaceRules() function not found. Is track.js loaded?");
    }


    // Reset lap info
    lapInfo = { currentLap: 1, currentTime: 0, lastTime: null, bestTime: null };

    // Reset checkpoint system
    let cpCount = (track && track.checkpoints) ? track.checkpoints.length : 6;
    checkpointActivations.player1 = new Array(cpCount).fill(false);
    checkpointActivations.player2 = new Array(cpCount).fill(false);
    checkpointActiveUntil = new Array(cpCount).fill(0);
    checkpointCounter = [0, 0];
    singlePlayerCheckpointCount = 0;
    checkpointEffects = [];
    checkpointCooldowns = {};
    alertCooldowns = {};
    lastMovementDir = new Array(cars.length).fill({ x: 0, y: 1 });

    // Reset two-player timer
    twoPlayerTimer = twoPlayerMaxTime;

    // Reset pools
    resetPools();
}

/**
 * Setup menu system interactions
 */
function setupMenuSystem() {
    // Bind all button clicks
    document.getElementById('btn-single').addEventListener('click', () => {
        gameMode = 'single';
        startGame();
    });
    document.getElementById('btn-two-player').addEventListener('click', () => {
        gameMode = 'two-player';
        startGame();
    });
    document.getElementById('btn-instructions').addEventListener('click', () => {
        document.getElementById('start-menu').style.display = 'none';
        document.getElementById('instructions-overlay').style.display = 'flex';
    });
    document.getElementById('btn-back').addEventListener('click', () => {
        document.getElementById('instructions-overlay').style.display = 'none';
        document.getElementById('start-menu').style.display = 'flex';
    });
    document.getElementById('btn-back-top').addEventListener('click', () => {
        document.getElementById('instructions-overlay').style.display = 'none';
        document.getElementById('start-menu').style.display = 'flex';
    });
    document.getElementById('btn-resume').addEventListener('click', resumeGame);
    document.getElementById('btn-restart').addEventListener('click', restartGame);
    document.getElementById('btn-menu').addEventListener('click', returnToMenu);

    // Game over buttons (need to be bound)
    let btnRestartGO = document.getElementById('btn-restart-gameover');
    if (btnRestartGO) {
        btnRestartGO.addEventListener('click', restartGame);
    }
    let btnMenuGO = document.getElementById('btn-menu-gameover');
    if (btnMenuGO) {
        btnMenuGO.addEventListener('click', returnToMenu);
    }
}

/**
 * Start the game
 */
function startGame() {
    document.getElementById('start-menu').style.display = 'none';
    document.getElementById('instructions-overlay').style.display = 'none';
    gameState = 'playing';
    initializeGame();
}

/**
 * Pause the game
 */
function pauseGame() {
    if (gameState === 'playing') {
        gameState = 'paused';
        document.getElementById('pause-menu').style.display = 'flex';
    }
}

/**
 * Resume the game
 */
function resumeGame() {
    gameState = 'playing';
    document.getElementById('pause-menu').style.display = 'none';
}

/**
 * Restart the game
 */
function restartGame() {
    gameState = 'playing';
    document.getElementById('pause-menu').style.display = 'none';
    document.getElementById('gameover-menu').style.display = 'none';
    twoPlayerTimer = twoPlayerMaxTime;
    checkpointEffects = [];
    checkpointCooldowns = {};
    alertCooldowns = {};
    if (camera) {
        camera.x = 0;
        camera.y = 0;
        camera.zoom = 1; // Also reset zoom just in case
    }
    initializeGame();
}

/**
 * Return to main menu
 */
function returnToMenu() {
    gameState = 'menu';
    document.getElementById('pause-menu').style.display = 'none';
    document.getElementById('gameover-menu').style.display = 'none';
    document.getElementById('start-menu').style.display = 'flex';
}

/**
 * Person B - Bilal: Show Game Over screen for two-player mode
 */
function showGameOver() {
    gameState = 'gameOver';
    let player1Score = checkpointCounter[0] || 0;
    let player2Score = checkpointCounter[1] || 0;
    document.getElementById('player1-score').textContent = player1Score;
    document.getElementById('player2-score').textContent = player2Score;
    document.getElementById('gameover-menu').style.display = 'flex';
}

/**
 * Handle keyboard input
 */
function keyPressed() {
    // Pause / Resume
    if (key === 'p' || key === 'P') {
        if (gameState === 'playing') pauseGame();
        else if (gameState === 'paused') resumeGame();
    }

    // Restart/Respawn
    if (key === 'r' || key === 'R') {
        if (gameState === 'gameOver') {
            restartGame();
        } else if (gameState === 'playing' || gameState === 'paused') {
            if (gameMode === 'two-player') respawnPlayer(0);
            else restartGame();
        }
    }

    // Return to menu
    if (keyCode === ESCAPE) {
        if (gameState === 'playing') pauseGame();
        else if (gameState === 'paused') returnToMenu();
        return false; // Prevent default
    }

    // Toggle particles
    if (key === 'e' || key === 'E') {
        showParticles = !showParticles;
    }

    // Unstuck nudge
    if (key === 'f' || key === 'F') { // <-- Changed from 'u'
        if (gameMode === 'two-player') {
            unstuckNudge(0); // Nudge Player 1
        } else {
            unstuckNudge(0); // Nudge the only player
        }
    }

    // Right Ctrl for P2 unstuck nudge
    if (keyCode === 17 && gameState === 'playing' && gameMode === 'two-player') {
        unstuckNudge(1); // Nudge Player 2
    }
}

/**
 * Respawn a specific player at start position
 */
function respawnPlayer(playerIndex) {
    if (!cars[playerIndex] || !track) return;
    let startPositions = getStartPositions();
    if (startPositions[playerIndex]) {
        let car = cars[playerIndex];
        resetToStart(car.body, playerIndex); // Use Person B's reset function
    }
}

/**
 * Handle window resize
 */
function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
}

/* ============================================
 *  POOL FUNCTIONS
 * ============================================
 */

/**
 * Creates the object pools on setup
 */
function initializePools() {
    // Skid Mark Pool
    for (let i = 0; i < MAX_SKIDMARKS; i++) {
        skidMarkPool.push({
            x1: 0, y1: 0, x2: 0, y2: 0,
            lifetime: 0, maxLifetime: 360,
            color: '#ffffff',
            active: false
        });
    }

    // Particle Pool
    for (let i = 0; i < MAX_PARTICLES; i++) {
        particlePool.push({
            x: 0, y: 0,
            vx: 0, vy: 0,
            lifetime: 0, maxLifetime: 30,
            color: '#ffffff',
            active: false
        });
    }
}

/**
 * Resets all objects in pools to inactive
 */
function resetPools() {
    for (let mark of skidMarkPool) mark.active = false;
    for (let p of particlePool) p.active = false;
    nextSkidMarkIndex = 0;
    nextParticleIndex = 0;
}

/**
 * Borrows a skidmark from the pool and activates it
 */
function borrowSkidMark(x1, y1, x2, y2, color) {
    let mark = skidMarkPool[nextSkidMarkIndex];

    mark.x1 = x1;
    mark.y1 = y1;
    mark.x2 = x2;
    mark.y2 = y2;
    mark.color = color;
    mark.lifetime = 360;
    mark.maxLifetime = 360;
    mark.active = true;

    nextSkidMarkIndex = (nextSkidMarkIndex + 1) % MAX_SKIDMARKS;
}

/**
 * Borrows a particle from the pool and activates it
 * This function can be called from anywhere (drift, turrets, etc.)
 */
function borrowParticle(x, y, vx, vy, lifetime, color) {
    let p = particlePool[nextParticleIndex];

    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.lifetime = lifetime;
    p.maxLifetime = lifetime;
    p.color = color;
    p.active = true;

    nextParticleIndex = (nextParticleIndex + 1) % MAX_PARTICLES;
    return p; // Return ref, though not strictly needed
}


/* ============================================
 * VEHICLE PHYSICS CALLBACKS (Person A)
 * ============================================
 */
function onDriftStart(carIndex) {
    if (camera && camera.shake) camera.shake(5, 5);
}
function onDriftEnd(carIndex, score, combo) {
    if (cars[carIndex] && cars[carIndex].state) {
        cars[carIndex].state.driftScore += score;
    }
}

/* ============================================
 * RACE RULES CALLBACKS (Person B)
 * ============================================
 */

function onLap(carIndex, lapTime) {
    lapInfo.lastTime = lapTime;
    if (!lapInfo.bestTime || lapTime < lapInfo.bestTime) {
        lapInfo.bestTime = lapTime;
    }
    lapInfo.currentLap++;
    lapInfo.currentTime = 0;
    if (camera && camera.shake) camera.shake(8, 15);
}

function onCheckpoint(carIndex, checkpointIndex) {
    try {
        if (checkpointSound && checkpointSound.isLoaded()) {
            checkpointSound.play();
        }

        let cooldownKey = `${carIndex}-${checkpointIndex}`;
        if (checkpointCooldowns[cooldownKey] && checkpointCooldowns[cooldownKey] > millis() - 500) {
            return; // Already activated recently
        }
        checkpointCooldowns[cooldownKey] = millis();

        if (carIndex === 0 && checkpointActivations.player1) {
            checkpointActivations.player1[checkpointIndex] = true;
        }
        if (carIndex === 1 && checkpointActivations.player2) {
            checkpointActivations.player2[checkpointIndex] = true;
        }

        if (checkpointActiveUntil) {
            checkpointActiveUntil[checkpointIndex] = millis() + 2500;
        }

        if (gameMode === 'two-player' && checkpointCounter) {
            checkpointCounter[carIndex] = (checkpointCounter[carIndex] || 0) + 1;
        }

        if (gameMode === 'single' && carIndex === 0) {
            singlePlayerCheckpointCount++;
            if (singlePlayerCheckpointCount > bestCheckpointScore) {
                bestCheckpointScore = singlePlayerCheckpointCount;
                saveBestCheckpointScore(bestCheckpointScore);
            }
            if (singlePlayerCheckpointCount > lastSessionDisplayedScore) {
                lastSessionDisplayedScore = singlePlayerCheckpointCount;
            }
        }

        if (track && track.checkpoints[checkpointIndex]) {
            let checkpoint = track.checkpoints[checkpointIndex];
            checkpointEffects.push({
                x: width / 2,
                y: height / 2,
                timer: 60,
                maxTimer: 60,
                player: carIndex,
                type: 'ring' // Add a type
            });
        }

        if (camera && camera.shake) camera.shake(3, 5);
        showCheckpointNotification(carIndex, checkpointIndex);

        // PERFORMANCE: Removed call to blocking showCheckpointAlert()

    } catch (error) {
        console.error('Error in checkpoint activation:', error);
    }
}

function onWallHit(carIndex) {
    if (camera && camera.shake) camera.shake(10, 8);
    if (cars[carIndex] && cars[carIndex].state) {
        cars[carIndex].state.driftCombo = 1;
        cars[carIndex].state.driftScore = Math.max(0, cars[carIndex].state.driftScore - 50);
    }
}

/* ============================================
 * HELPER FUNCTIONS (CLEANUP)
 * ============================================
 */

/**
 * Applies the unstuck nudge
 */
function unstuckNudge(playerIndex) {
    const kickSpeed = 6;
    const forceMag = 0.06;

    // Check if the playerIndex is valid
    if (playerIndex < 0 || playerIndex >= cars.length || !cars[playerIndex]) {
        return; // Invalid index or car doesn't exist
    }

    let car = cars[playerIndex];
    if (!car || !car.body) return;

    let dir = lastMovementDir[playerIndex];
    let useFacingFallback = false;
    if (!dir || !isFinite(dir.x) || !isFinite(dir.y) || Math.hypot(dir.x, dir.y) < 0.5) {
        useFacingFallback = true;
    }

    if (useFacingFallback) {
        let angle = car.body.angle || 0;
        dir = { x: Math.cos(angle), y: Math.sin(angle) };
    }

    let ox = -dir.x;
    let oy = -dir.y;
    let len = Math.hypot(ox, oy) || 1;
    ox /= len;
    oy /= len;

    let v = car.body.velocity || { x: 0, y: 0 };
    Matter.Body.setVelocity(car.body, {
        x: v.x + ox * kickSpeed,
        y: v.y + oy * kickSpeed
    });
    Matter.Body.applyForce(car.body, car.body.position, {
        x: ox * forceMag,
        y: oy * forceMag
    });
    Matter.Body.translate(car.body, { x: ox * 2, y: oy * 2 });

    if (camera && camera.shake) camera.shake(2, 3);
}

/*
 * Update checkpoint activation visual effects
 */
function updateCheckpointEffects() {
    if (checkpointEffects.length === 0) return;

    // Filter out effects that are done
    checkpointEffects = checkpointEffects.filter(effect => {
        effect.timer--;
        return effect.timer > 0;
    });
}

/**
 * Draw checkpoint activation visual effects
 */
function drawCheckpointEffects() {
    push();
    for (let i = 0; i < checkpointEffects.length; i++) {
        let effect = checkpointEffects[i];
        let alpha = effect.timer / effect.maxTimer;

        if (effect.type === 'notification') {
            // Draw notification text
            textAlign(CENTER, CENTER);
            textSize(20);

            // Background box
            fill(0, 0, 0, alpha * 150);
            noStroke();
            rectMode(CENTER);
            rect(effect.x, effect.y, 300, 40, 10);

            // Text
            fill(0, 255, 0, alpha * 255);
            text(effect.message, effect.x, effect.y);

        } else if (effect.type === 'ring') {
            // Draw expanding ring
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
                noStroke();
                text('CHECKPOINT!', effect.x, effect.y - 50);
            }
        }
    }
    pop();
}

/**
 * Show non-blocking checkpoint notification
 */
function showCheckpointNotification(carIndex) {
    checkpointEffects.push({
        message: `CHECKPOINT ACTIVATED!`,
        player: carIndex + 1,
        timer: 120, // 2 seconds
        maxTimer: 120,
        x: width / 2,
        y: height / 3,
        type: 'notification'
    });
}

/**
 * Draw checkpoint status display in HUD
 */
function drawCheckpointStatus() {
    if (!checkpointActivations) return;

    push();
    let x = width - 200;
    let y = 20;

    textAlign(LEFT, TOP);
    textSize(14);
    fill(255);

    let cpCount = (track && track.checkpoints) ? track.checkpoints.length : 6;
    let activatedCount = 0;

    fill(255);
    let yOffset = y + 40;
    if (gameMode === 'single') {
        if (checkpointActivations.player1) {
            activatedCount = checkpointActivations.player1.filter(Boolean).length;
        }
        textSize(18);
        fill(155);
        text("CHECKPOINTS", x, y);
        textSize(36);
        fill(NEON_COLORS.cyan);
        text(`${activatedCount}/${cpCount}`, x, y + 20);
    } else {
        yOffset = y + 160;
        fill(155);
        textSize(18);
        text(`CHECKPOINTS`, 20, yOffset);
        text(`CHECKPOINTS`, x + 60, yOffset);
        textSize(36);
        fill(NEON_COLORS.cyan); // Kept player-specific colors
        text(`${checkpointCounter[0] || 0}`, 20, yOffset += 18);
        fill(NEON_COLORS.magenta); // Kept player-specific colors
        text(`${checkpointCounter[1] || 0}`, x + 160, yOffset);
    }
    /*
    for (let i = 0; i < cpCount; i++) {
        let p1Active = checkpointActivations.player1 && checkpointActivations.player1[i];
        let p2Active = checkpointActivations.player2 && checkpointActivations.player2[i];
        let isActivated = p1Active || p2Active;
        let c = isActivated ? (p1Active ? NEON_COLORS.cyan : NEON_COLORS.magenta) : '#666';
        if (p1Active && p2Active) c = NEON_COLORS.green;

        fill(c);
        text(`CP${i + 1}: ${isActivated ? '✓' : '○'}`, x, y + 20 + (i * 15));
    }
    */
    let ctrlYOffset = (gameMode === 'single') ? height - 150 : height - 180;
    let ctrlX = 30;
    fill(NEON_COLORS.cyan);
    textSize(18);
    text("Controls:", ctrlX - 3, ctrlYOffset);
    fill(155);
    text("E - Toggle Effects", ctrlX, ctrlYOffset += 20);
    text("ESC - Pause", ctrlX, ctrlYOffset += 20);

    if (gameMode === 'single') {
        text("F - Unstuck Nudge", ctrlX, ctrlYOffset += 18);
        fill(155);
        text(`Checkpoints: ${singlePlayerCheckpointCount}`, x, yOffset += 36);
        if (lastSessionDisplayedScore > 0) {
            fill(NEON_COLORS.cyan); // Kept this style to differentiate "Last Score"
            text(`Last Score: ${lastSessionDisplayedScore}`, x, yOffset += 18);
        }
    } else {
        text("F - Unstuck Nudge P1", ctrlX, ctrlYOffset += 18);
        text("Ctrl - Unstuck Nudge P2", ctrlX, ctrlYOffset += 18);
    }

    pop();
}

/**
 * Manage background music playback
 */
function manageMusic() {
    let targetMusic = null;

    if (gameState === 'menu') targetMusic = menuMusic;
    else if (gameState === 'paused') targetMusic = pauseMusic;
    else if (gameState === 'playing') {
        if (gameMode === 'single') targetMusic = singlePlayerMusic;
        else if (gameMode === 'two-player') targetMusic = twoPlayerMusic;
    }
    else if (gameState === 'gameOver') targetMusic = resultMusic;

    if (targetMusic !== currentMusic) {
        if (currentMusic && currentMusic.isLoaded() && currentMusic.isPlaying()) {
            currentMusic.stop();
        }
        if (targetMusic && targetMusic.isLoaded() && !targetMusic.isPlaying()) {
            targetMusic.loop();
        }
        currentMusic = targetMusic;
    }
}

/* ============================================
 * SINGLE-PLAYER CHECKPOINT TRACKING SYSTEM
 * ============================================
 */

function loadBestCheckpointScore() {
    try {
        let stored = localStorage.getItem('bestCheckpointScore');
        if (stored !== null) {
            let loadedScore = parseInt(stored, 10) || 0;
            bestCheckpointScore = loadedScore;
            lastSessionDisplayedScore = loadedScore;
        }
    } catch (error) {
        console.warn('Could not load bestCheckpointScore from localStorage:', error);
    }
}

function saveBestCheckpointScore(score) {
    try {
        localStorage.setItem('bestCheckpointScore', score.toString());
    } catch (error) {
        console.warn('Could not save bestCheckpointScore to localStorage:', error);
    }
}
