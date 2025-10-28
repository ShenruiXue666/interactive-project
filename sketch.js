/**
 * Main Sketch - Neon Drift Racing
 * Orchestrates the game, camera, HUD, and rendering
 * Person C - Rendering, HUD, and Presentation
 * 
 * This file coordinates:
 * - Game loop and state management
 * - Camera follow system
 * - HUD rendering
 * - Neon visual effects
 * - Menu system and user input
 */

// Game state
let gameState = 'menu'; // 'menu', 'playing', 'paused'
let gameMode = 'single'; // 'single' or 'two-player'

// Core systems
let camera;
let hud;

// Matter.js
let Engine = Matter.Engine;
let World = Matter.World;
let Bodies = Matter.Bodies;
let engine;
let world;

// Game objects
let cars = [];
let track = null;
let raceRules = null;
let lapInfo = {
    currentLap: 1,
    currentTime: 0,
    lastTime: null,
    bestTime: null
};

// Checkpoint activation tracking
let checkpointActivations = {
    player1: new Array(6).fill(false), // Track which checkpoints player 1 has hit
    player2: new Array(6).fill(false)  // Track which checkpoints player 2 has hit
};
let checkpointEffects = []; // Visual effects for activated checkpoints
let checkpointCooldowns = []; // Prevent multiple activations
let alertCooldowns = []; // Prevent multiple alert popups
let showCheckpointAlerts = true; // Toggle for checkpoint alerts (default ON)

// Visual settings
const NEON_GRID_SIZE = 100;
const NEON_COLORS = {
    cyan: '#00ffff',
    magenta: '#ff00ff',
    yellow: '#ffff00',
    green: '#00ff00',
    wall: '#ff006f'
};

// Menu elements
let menuElements;

/**
 * p5.js setup function
 */
function setup() {
    let canvas = createCanvas(windowWidth, windowHeight);
    canvas.parent('game-container');

    // Initialize Matter.js
    engine = Engine.create();
    world = engine.world;
    world.gravity.y = 0; // Top-down view, no gravity

    // Initialize systems
    camera = new Camera(0, 0);
    hud = new HUD();

    // Setup menu interactions
    setupMenuSystem();

    // Initialize track system
    initializeTrack();

    console.log('Neon Drift Racing - Person C Demo');
    console.log('Camera and HUD systems initialized');
}

/**
 * p5.js draw function - main game loop
 */
function draw() {
    background(10, 5, 20); // Dark purple-ish background

    // SAFETY: Ensure game state is valid
    if (!gameState || gameState === 'undefined') {
        gameState = 'playing';
        console.log("⚠️ Invalid game state detected, resetting to playing");
    }

    if (gameState === 'playing') {
        // CRITICAL: Ensure physics engine is running
        if (engine && engine.world) {
            Engine.update(engine);
        } else {
            console.warn("⚠️ Physics engine not available, reinitializing...");
            // Try to reinitialize if needed
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

        // Update game logic
        updateGameLogic();

        // Draw world with camera
        if (camera) {
            camera.apply();
        }
        drawNeonGrid();
        drawTrack();
        drawCars();
        if (camera) {
            camera.unapply();
        }

        // Draw HUD (no camera transform)
        drawHUD();

        // Draw checkpoint activation effects
        drawCheckpointEffects();

        // Draw checkpoint status
        drawCheckpointStatus();

    } else if (gameState === 'menu' || gameState === 'paused') {
        // Show menu background effect
        drawMenuBackground();
    }
}

/**
 * Update camera to follow active car(s)
 */
function updateCameraFollow() {
    if (cars.length === 1) {
        camera.follow(cars[0].position);
    } else if (cars.length === 2 && gameMode === 'two-player') {
        camera.followMultiple([cars[0].position, cars[1].position]);
    }
}

/**
 * Update game logic (placeholder - will integrate with Person A & B's code)
 */
function updateGameLogic() {
    // Update lap timer
    lapInfo.currentTime += deltaTime;

    // Update cars
    for (let car of cars) {
        car.update();
    }

    // Update checkpoint effects
    updateCheckpointEffects();

    // Check for proximity to checkpoints (backup detection)
    checkCheckpointProximity();
}

/**
 * Draw HUD based on game mode
 */
function drawHUD() {
    if (gameMode === 'single' && cars.length > 0) {
        hud.drawSinglePlayer(cars[0].state || {}, lapInfo);
    } else if (gameMode === 'two-player' && cars.length >= 2) {
        // Get lap info for both players from race rules
        let player1LapInfo = raceRules ? raceRules.getLapInfo(0) : lapInfo;
        let player2LapInfo = raceRules ? raceRules.getLapInfo(1) : lapInfo;

        hud.drawTwoPlayer(
            cars[0].state || {},
            cars[1].state || {},
            player1LapInfo,
            player2LapInfo
        );
    }
}

/**
 * Draw neon grid background
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

    // Draw checkpoints with activation states
    for (let i = 0; i < track.checkpoints.length; i++) {
        let checkpoint = track.checkpoints[i];
        let pos = checkpoint.position;
        let radius = checkpoint.circleRadius || 35;

        // Check if this checkpoint is activated
        let isActivated = checkpointActivations.player1[i] || checkpointActivations.player2[i];

        if (isActivated) {
            // Activated checkpoint - bright green with glow
            stroke('#00ff00');
            strokeWeight(4);
            drawingContext.shadowBlur = 20;
            drawingContext.shadowColor = '#00ff00';
        } else {
            // Inactive checkpoint - cyan
            stroke(NEON_COLORS.cyan);
            strokeWeight(3);
            drawingContext.shadowBlur = 10;
            drawingContext.shadowColor = NEON_COLORS.cyan;
        }

        circle(pos.x, pos.y, radius * 2);
    }

    drawingContext.shadowBlur = 0;
    pop();
}

/**
 * Draw cars with neon effects
 */
function drawCars() {
    push();

    for (let i = 0; i < cars.length; i++) {
        let car = cars[i];
        let carColor = i === 0 ? NEON_COLORS.cyan : NEON_COLORS.magenta;

        // Draw skid marks first (if drifting)
        if (car.state && car.state.drifting) {
            drawSkidMarks(car);
        }

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
 * Draw skid marks for drifting car
 */
function drawSkidMarks(car) {
    push();
    stroke(100, 100, 100, 100);
    strokeWeight(3);
    noFill();

    // Draw a simple trail
    if (!car.trail) car.trail = [];
    car.trail.push({ x: car.position.x, y: car.position.y });
    if (car.trail.length > 20) car.trail.shift();

    beginShape();
    for (let point of car.trail) {
        vertex(point.x, point.y);
    }
    endShape();

    drawingContext.shadowBlur = 0;
    pop();
}

/**
 * Draw animated background for menu
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
 */
function initializeTrack() {
    // Build the track using Person B's track.js
    track = buildTrack(Matter, world);

    console.log('Track initialized with bounds:', track.bounds);
}

/**
 * Initialize game objects (cars, race rules, etc.)
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

    // Reset checkpoint activations
    checkpointActivations.player1.fill(false);
    checkpointActivations.player2.fill(false);
    checkpointEffects = [];

    console.log('Game initialized with', cars.length, 'car(s)');
}

/**
 * Setup menu system interactions
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
 */
function startGame() {
    document.getElementById('start-menu').style.display = 'none';
    document.getElementById('instructions-overlay').style.display = 'none';
    gameState = 'playing';

    // Initialize game
    initializeGame();

    console.log('Game started in ' + gameMode + ' mode');
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
    console.log("🔄 RESTARTING GAME...");

    // Force game state to playing
    gameState = 'playing';

    // Clear any blocking states
    checkpointCooldowns = [];
    alertCooldowns = [];
    checkpointEffects = [];

    // Reset checkpoint activations
    if (checkpointActivations) {
        checkpointActivations.player1.fill(false);
        checkpointActivations.player2.fill(false);
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

    console.log("✅ Game restarted successfully");
}

/**
 * Return to main menu
 */
function returnToMenu() {
    gameState = 'menu';
    document.getElementById('pause-menu').style.display = 'none';
    document.getElementById('start-menu').style.display = 'flex';
}

/**
 * Handle keyboard input
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

    // Restart
    if (key === 'r' || key === 'R') {
        if (gameState === 'playing' || gameState === 'paused') {
            restartGame();
        }
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
        console.log("🧪 TESTING CHECKPOINT ACTIVATION!");
        onCheckpoint(0, 0); // Force activate checkpoint 0 for player 0
    }

    // Toggle checkpoint alerts with L key (L for "alerts")
    if (key === 'l' || key === 'L') {
        showCheckpointAlerts = !showCheckpointAlerts;
        console.log("🔔 Checkpoint alerts:", showCheckpointAlerts ? "ENABLED" : "DISABLED");
    }

    // Return to menu with M key
    if (key === 'm' || key === 'M') {
        console.log("🏁 Returning to menu");
        returnToMenu();
    }

    // Force game state to playing with G key (if stuck)
    if (key === 'g' || key === 'G') {
        console.log("🔄 FORCING GAME STATE TO PLAYING");
        gameState = 'playing';
        console.log("✅ Game state forced to playing");
    }

    // Handbrake/drift boost with Space
    if (key === ' ' && gameState === 'playing') {
        // Apply handbrake to all cars
        for (let car of cars) {
            if (car.state && car.state.speed > 1) {
                // Apply handbrake effect - reduce speed and increase drift
                let velocity = car.body.velocity;
                let angle = car.body.angle;

                // Calculate forward and lateral components
                let forward = {
                    x: Math.cos(angle),
                    y: Math.sin(angle)
                };

                let forwardSpeed = velocity.x * forward.x + velocity.y * forward.y;
                let lateralVelocity = {
                    x: velocity.x - forward.x * forwardSpeed,
                    y: velocity.y - forward.y * forwardSpeed
                };

                // Apply strong drift effect
                Matter.Body.setVelocity(car.body, {
                    x: forward.x * forwardSpeed * 0.8 + lateralVelocity.x * 0.7,
                    y: forward.y * forwardSpeed * 0.8 + lateralVelocity.y * 0.7
                });

                // Camera shake for handbrake
                camera.shake(8, 5);
            }
        }
    }
}

/**
 * Handle window resize
 */
function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
}

/**
 * Integration points for Person A (Vehicle Physics)
 * These functions will be called by Person A's car.js
 */

// Example: Called when drift starts
function onDriftStart(carIndex) {
    camera.shake(5, 5);
}

// Example: Called when drift ends with score
function onDriftEnd(carIndex, score, combo) {
    if (cars[carIndex] && cars[carIndex].state) {
        cars[carIndex].state.driftScore += score;
    }
}

/**
 * Integration points for Person B (Track & Collisions)
 * These functions will be called by Person B's track.js
 */

// Called when car completes a lap
function onLap(carIndex, lapTime) {
    console.log('Lap completed!', lapTime);

    lapInfo.lastTime = lapTime;
    if (!lapInfo.bestTime || lapTime < lapInfo.bestTime) {
        lapInfo.bestTime = lapTime;
    }
    lapInfo.currentLap++;
    lapInfo.currentTime = 0;

    // Camera shake for lap completion
    camera.shake(8, 15);
}

// Called when car hits checkpoint
function onCheckpoint(carIndex, checkpointIndex) {
    try {
        // Check if this checkpoint was already activated recently (only for visual effects, not alerts)
        let cooldownKey = `${carIndex}-${checkpointIndex}`;
        let wasRecentlyActivated = checkpointCooldowns[cooldownKey] && checkpointCooldowns[cooldownKey] > millis() - 500;

        if (wasRecentlyActivated) {
            console.log("⏰ Checkpoint", checkpointIndex, "already activated recently for car", carIndex);
            // Don't return early - still show alert but skip visual effects
        }

        console.log('🎯 CHECKPOINT ACTIVATED! Car', carIndex, 'hit checkpoint', checkpointIndex);

        // Set cooldown to prevent duplicate activations
        checkpointCooldowns[cooldownKey] = millis();

        // Track checkpoint activation safely
        if (checkpointActivations && checkpointActivations.player1 && carIndex < checkpointActivations.player1.length) {
            checkpointActivations.player1[checkpointIndex] = true;
        }
        if (checkpointActivations && checkpointActivations.player2 && carIndex < checkpointActivations.player2.length) {
            checkpointActivations.player2[checkpointIndex] = true;
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

        console.log('✅ Checkpoint activation completed successfully');

        // Show checkpoint alert (with separate cooldown to prevent spam)
        if (showCheckpointAlerts) {
            let alertKey = `${carIndex}-${checkpointIndex}`;
            if (!alertCooldowns[alertKey] || alertCooldowns[alertKey] < millis() - 2000) {
                alertCooldowns[alertKey] = millis();
                showCheckpointAlert(carIndex, checkpointIndex);
            } else {
                console.log("⏰ Alert for checkpoint", checkpointIndex, "on cooldown for car", carIndex);
            }
        }

    } catch (error) {
        console.error('❌ Error in checkpoint activation:', error);
    }
}

// Called when car hits wall
function onWallHit(carIndex) {
    camera.shake(10, 8);

    // Reset drift combo
    if (cars[carIndex] && cars[carIndex].state) {
        cars[carIndex].state.driftCombo = 1;
        cars[carIndex].state.driftScore = Math.max(0, cars[carIndex].state.driftScore - 50);
    }
}

// Called when car hits boost or grip pad
function onPad(carIndex, padType) {
    console.log('Car', carIndex, 'hit', padType, 'pad');

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
        camera.shake(5, 8);
    } else if (padType === 'grip') {
        // Apply grip effect (reduce drift)
        if (cars[carIndex] && cars[carIndex].state) {
            cars[carIndex].state.gripBoost = 60; // 1 second at 60fps
        }
    }
}

/**
 * Update checkpoint activation effects
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
 * Draw checkpoint activation effects
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
 * Check proximity to checkpoints (backup detection system)
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
                        console.log("🎯 PROXIMITY DETECTED! Car", carIndex, "inside checkpoint", cpIndex);

                        // Set cooldown
                        checkpointCooldowns[cooldownKey] = millis();

                        // Always trigger checkpoint activation (simplified)
                        console.log("✅ TRIGGERING CHECKPOINT ACTIVATION!");
                        onCheckpoint(carIndex, cpIndex);
                    } else {
                        console.log("⏰ Checkpoint", cpIndex, "on cooldown for car", carIndex);
                    }
                }
            }
        }
    } catch (error) {
        console.error('❌ Error in proximity detection:', error);
    }
}

/**
 * Show checkpoint alert dialog (NON-BLOCKING with alert popup)
 */
function showCheckpointAlert(carIndex, checkpointIndex) {
    try {
        console.log(`🎯 CHECKPOINT ${checkpointIndex + 1} ACTIVATED! Player ${carIndex + 1} reached checkpoint ${checkpointIndex + 1}!`);

        // Show alert popup but make it non-blocking
        let message = `🎯 CHECKPOINT ${checkpointIndex + 1} ACTIVATED!\n\nPlayer ${carIndex + 1} reached checkpoint ${checkpointIndex + 1}!\n\nWhat would you like to do?`;

        // Use setTimeout to make the dialog non-blocking
        setTimeout(() => {
            try {
                let choice = confirm(message + "\n\nClick OK to continue racing\nClick Cancel to return to menu");

                if (!choice) {
                    // User chose to return to menu
                    console.log("🏁 Player chose to return to menu");
                    returnToMenu();
                } else {
                    // User chose to continue
                    console.log("🏁 Player chose to continue racing");
                    gameState = 'playing';
                    console.log("✅ Game state set to playing");
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

    console.log("✅ Checkpoint notification shown (non-blocking)");
}

/**
 * Draw checkpoint status in HUD
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
    for (let i = 0; i < 6; i++) {
        let isActivated = checkpointActivations.player1[i] || checkpointActivations.player2[i];
        let color = isActivated ? '#00ff00' : '#666666';

        fill(color);
        text(`CP${i + 1}: ${isActivated ? '✓' : '○'}`, x, y + 20 + (i * 15));
    }

    // Show alert status
    fill(showCheckpointAlerts ? '#00ff00' : '#ff6666');
    text(`Alerts: ${showCheckpointAlerts ? 'ON' : 'OFF'} (Press L)`, x, y + 120);

    // Show controls
    fill(255);
    text("Controls:", x, y + 140);
    text("T - Test checkpoint", x, y + 155);
    text("L - Toggle alerts", x, y + 170);
    text("M - Return to menu", x, y + 185);
    text("G - Force resume (if stuck)", x, y + 200);

    pop();
}

/**
 * Force game resumption after checkpoint alert
 */
function resumeGameFromCheckpoint() {
    try {
        console.log("🔄 FORCING GAME RESUMPTION...");

        // Ensure game state is playing
        gameState = 'playing';

        // Ensure physics engine is running
        if (engine && engine.world) {
            console.log("✅ Physics engine confirmed running");
        }

        // Force a frame update to get things moving
        console.log("✅ Game resumption complete - should be running smoothly now");

        // Additional safety: ensure draw loop continues
        if (typeof draw === 'function') {
            console.log("✅ Draw function available");
        }

    } catch (error) {
        console.error('❌ Error in game resumption:', error);
        // Fallback: just set game state
        gameState = 'playing';
    }
}
