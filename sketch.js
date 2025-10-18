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
// let camera; // Disabled - using grid panning instead
let hud;

// Matter.js
let Engine = Matter.Engine;
let World = Matter.World;
let Bodies = Matter.Bodies;
let engine;
let world;

// Placeholder for Person A and B's code
let cars = [];
let track = null;
let lapInfo = {
    currentLap: 1,
    currentTime: 0,
    lastTime: null,
    bestTime: null
};

// Visual settings
const NEON_GRID_SIZE = 50; // Changed to match midterm_0
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
    let canvas = createCanvas(windowWidth, windowHeight); // Restore responsive canvas
    canvas.parent('game-container');

    // Initialize Matter.js
    engine = Engine.create();
    world = engine.world;
    world.gravity.y = 0; // Top-down view, no gravity

    // Initialize systems
    // camera = new Camera(0, 0); // Disabled
    hud = new HUD();

    // Setup menu interactions
    setupMenuSystem();

    // Initialize placeholder game objects
    // NOTE: These will be replaced by Person A and B's implementations
    initializePlaceholderGame();

    console.log('Neon Drift Racing - Person C Demo');
    console.log('Camera and HUD systems initialized');
}

/**
 * p5.js draw function - main game loop
 */
function draw() {
    background(10, 5, 20); // Dark purple-ish background

    if (gameState === 'playing') {
        // Update physics
        Engine.update(engine);

        // Update camera to follow car(s)
        // updateCameraFollow(); // Disabled
        // camera.update(); // Disabled

        // Update game logic (placeholder)
        updateGameLogic();

        // Draw world with grid panning (no camera transform)
        // camera.apply(); // Disabled
        drawNeonGrid();
        drawTrack();
        drawCars();
        // camera.unapply(); // Disabled

        // Draw HUD (no camera transform)
        drawHUD();

    } else if (gameState === 'menu' || gameState === 'paused') {
        // Show menu background effect
        drawMenuBackground();
    }
}

/**
 * Update camera to follow active car(s)
 */
// function updateCameraFollow() { // Disabled
//     if (cars.length === 1) {
//         // Camera follows the car's world position
//         camera.x = cars[0].pos.x;
//         camera.y = cars[0].pos.y;
//     } else if (cars.length === 2 && gameMode === 'two-player') {
//         // For two-player, average the positions
//         camera.x = (cars[0].pos.x + cars[1].pos.x) / 2;
//         camera.y = (cars[0].pos.y + cars[1].pos.y) / 2;
//     }
// }

/**
 * Update game logic (placeholder - will integrate with Person A & B's code)
 */
function updateGameLogic() {
    // Update lap timer
    lapInfo.currentTime += deltaTime;

    // Update cars based on game mode
    if (cars.length > 0) {
        // Player 1 - WASD controls
        let car1 = cars[0];
        let forward1 = keyIsDown(87);  // W
        let back1 = keyIsDown(83);     // S
        let turnLeft1 = keyIsDown(65); // A
        let turnRight1 = keyIsDown(68); // D

        car1.update(forward1, back1, turnLeft1, turnRight1, 4);

        // Update car state for HUD
        if (!car1.state) {
            car1.state = {
                speed: 0,
                drifting: false,
                driftScore: 0,
                driftCombo: 1
            };
        }
        car1.state.speed = car1.vel.mag();
    }

    // Player 2 - Arrow keys (only in two-player mode)
    if (gameMode === 'two-player' && cars.length > 1) {
        let car2 = cars[1];
        let forward2 = keyIsDown(UP_ARROW);
        let back2 = keyIsDown(DOWN_ARROW);
        let turnLeft2 = keyIsDown(LEFT_ARROW);
        let turnRight2 = keyIsDown(RIGHT_ARROW);

        car2.update(forward2, back2, turnLeft2, turnRight2, 4);

        // Update car state for HUD
        if (!car2.state) {
            car2.state = {
                speed: 0,
                drifting: false,
                driftScore: 0,
                driftCombo: 1
            };
        }
        car2.state.speed = car2.vel.mag();
    }
}

/**
 * Draw HUD based on game mode
 */
function drawHUD() {
    if (gameMode === 'single' && cars.length > 0) {
        hud.drawSinglePlayer(cars[0].state || {}, lapInfo);
    } else if (gameMode === 'two-player' && cars.length >= 2) {
        hud.drawTwoPlayer(
            cars[0].state || {},
            cars[1].state || {},
            lapInfo,
            { ...lapInfo } // Placeholder for player 2 lap info
        );
    }
}

/**
 * Draw neon grid background
 */
function drawNeonGrid() {
    push();

    // World dimensions (1400 x 1000)
    let worldW = 1400;
    let worldH = 1000;

    // Calculate average position for camera follow
    let avgX, avgY;
    if (gameMode === 'two-player' && cars.length >= 2) {
        avgX = (cars[0].pos.x + cars[1].pos.x) / 2;
        avgY = (cars[0].pos.y + cars[1].pos.y) / 2;
    } else if (cars.length > 0) {
        avgX = cars[0].pos.x;
        avgY = cars[0].pos.y;
    } else {
        avgX = 0;
        avgY = 0;
    }

    // Calculate origin in screen space based on average position
    let cx = width / 2;
    let cy = height / 2;
    let originScreenX = cx - avgX;
    let originScreenY = cy + avgY; // y positive = up

    // Draw grid lines with neon glow
    drawingContext.shadowBlur = 5;
    drawingContext.shadowColor = NEON_COLORS.cyan;
    stroke(0, 255, 255, 30);
    strokeWeight(1);

    // Vertical lines
    for (let x = -worldW; x <= worldW; x += NEON_GRID_SIZE) {
        let sx = originScreenX + x;
        line(sx, 0, sx, height);
    }

    // Horizontal lines
    for (let y = -worldH; y <= worldH; y += NEON_GRID_SIZE) {
        let sy = originScreenY - y; // convert world y (up positive) to screen y
        line(0, sy, width, sy);
    }

    drawingContext.shadowBlur = 0;
    pop();
}

/**
 * Draw track boundaries with neon glow
 */
function drawTrack() {
    push();

    // Calculate average position for camera follow
    let avgX, avgY;
    if (gameMode === 'two-player' && cars.length >= 2) {
        avgX = (cars[0].pos.x + cars[1].pos.x) / 2;
        avgY = (cars[0].pos.y + cars[1].pos.y) / 2;
    } else if (cars.length > 0) {
        avgX = cars[0].pos.x;
        avgY = cars[0].pos.y;
    } else {
        avgX = 0;
        avgY = 0;
    }

    // Calculate origin in screen space based on average position
    let cx = width / 2;
    let cy = height / 2;
    let originScreenX = cx - avgX;
    let originScreenY = cy + avgY;

    translate(originScreenX, originScreenY);
    scale(1, -1); // Flip y-axis to match world coordinates (y up)

    // NOTE: This will use Person B's track.draw(camera) function
    // For now, draw a placeholder track

    stroke(NEON_COLORS.wall);
    strokeWeight(4);

    // Apply neon glow
    drawingContext.shadowBlur = 15;
    drawingContext.shadowColor = NEON_COLORS.wall;

    noFill();

    // Outer boundary (world bounds)
    rect(-700, -500, 1400, 1000);

    // Inner chicane (placeholder)
    beginShape();
    vertex(-400, -200);
    vertex(0, -200);
    vertex(0, 200);
    vertex(400, 200);
    endShape();

    // Draw checkpoints
    stroke(NEON_COLORS.yellow);
    strokeWeight(3);
    drawingContext.shadowColor = NEON_COLORS.yellow;

    line(-700, 0, -650, 0); // Start line
    line(0, -500, 0, -450); // Checkpoint 1
    line(700, 0, 650, 0); // Checkpoint 2
    line(0, 500, 0, 450); // Checkpoint 3

    drawingContext.shadowBlur = 0;
    pop();
}

/**
 * Draw cars with neon effects
 */
function drawCars() {
    // Calculate average position for camera follow
    let avgX, avgY;
    if (gameMode === 'two-player' && cars.length >= 2) {
        avgX = (cars[0].pos.x + cars[1].pos.x) / 2;
        avgY = (cars[0].pos.y + cars[1].pos.y) / 2;
    } else if (cars.length > 0) {
        avgX = cars[0].pos.x;
        avgY = cars[0].pos.y;
    } else {
        avgX = 0;
        avgY = 0;
    }

    // Draw each car relative to the average position
    for (let i = 0; i < cars.length; i++) {
        let car = cars[i];
        let carColor = i === 0 ? NEON_COLORS.cyan : NEON_COLORS.magenta;

        push();

        // Calculate relative position from average
        let relX = car.pos.x - avgX;
        let relY = car.pos.y - avgY;

        // Position car relative to center based on average
        translate(width / 2 + relX, height / 2 - relY); // y flipped
        rotate(car.heading);

        // Apply glow
        drawingContext.shadowBlur = 20;
        drawingContext.shadowColor = carColor;

        // Draw car body
        rectMode(CENTER);
        fill(carColor);
        stroke(255);
        strokeWeight(2);
        rect(0, 0, car.w, car.h);

        // Front marker
        fill(255);
        rect(car.w * 0.4, 0, 10, car.h);

        drawingContext.shadowBlur = 0;

        pop();
    }
}

/**
 * Draw skid marks for drifting car
 */
// function drawSkidMarks(car) { // Disabled for now
//     // Placeholder - Person A will implement actual skid mark trail
//     push();
//     stroke(100, 100, 100, 100);
//     strokeWeight(3);
//     noFill();
//     
//     // Draw a simple trail
//     if (!car.trail) car.trail = [];
//     car.trail.push({ x: car.position.x, y: car.position.y });
//     if (car.trail.length > 20) car.trail.shift();
//     
//     beginShape();
//     for (let point of car.trail) {
//         vertex(point.x, point.y);
//     }
//     endShape();
//     
//     pop();
// }

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
 * Initialize placeholder game objects
 * NOTE: This will be replaced with Person A & B's actual implementations
 */
function initializePlaceholderGame() {
    // Create car(s) based on game mode
    cars = [];

    if (gameMode === 'single') {
        cars.push(new Car());
    } else if (gameMode === 'two-player') {
        // Player 1 starts on the left
        let car1 = new Car();
        car1.pos.x = -100;
        cars.push(car1);

        // Player 2 starts on the right
        let car2 = new Car();
        car2.pos.x = 100;
        cars.push(car2);
    }

    // Reset lap info
    lapInfo = {
        currentLap: 1,
        currentTime: 0,
        lastTime: null,
        bestTime: null
    };
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
    initializePlaceholderGame();

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
    resumeGame();
    initializePlaceholderGame();
    // camera.x = 0; // Disabled
    // camera.y = 0; // Disabled
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
    // camera.shake(5, 5); // Disabled
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

// Example: Called when car completes a lap
function onLap(carIndex, lapTime) {
    console.log('Lap completed!', lapTime);

    lapInfo.lastTime = lapTime;
    if (!lapInfo.bestTime || lapTime < lapInfo.bestTime) {
        lapInfo.bestTime = lapTime;
    }
    lapInfo.currentLap++;
    lapInfo.currentTime = 0;
}

// Example: Called when car hits checkpoint
function onCheckpoint(carIndex, checkpointIndex) {
    console.log('Checkpoint ' + checkpointIndex + ' reached');
}

// Example: Called when car hits wall
function onWallHit(carIndex) {
    // camera.shake(10, 8); // Disabled

    // Reset drift combo
    if (cars[carIndex] && cars[carIndex].state) {
        cars[carIndex].state.driftCombo = 1;
    }
}

// Helper: interpolate angles along shortest path
function lerpAngle(a, b, t) {
    // wrap difference to [-PI, PI]
    let diff = (b - a + PI) % (PI * 2);
    if (diff < 0) diff += PI * 2;
    diff -= PI;
    return a + diff * t;
}

// Car class with physics-based movement
class Car {
    constructor() {
        // Car maintains a world position (0,0 at world center)
        this.pos = createVector(0, 0); // world coordinates, x right, y up
        this.vel = createVector(0, 0);
        this.acc = createVector(0, 0);
        this.maxSpeed = 5;
        this.maxForce = 0.1;
        this.w = 50; // width of car rectangle
        this.h = 30; // height of car rectangle

        this.heading = 0; // current displayed heading (radians)
        this.desiredHeading = 0; // target heading to turn toward
        // smoothing factor (0..1) — smaller is smoother/slower
        this.headingSmooth = 0.13;
        this.turnSpeed = 0.05; // radians per frame when holding A/D

        // State for HUD integration
        this.state = {
            speed: 0,
            drifting: false,
            driftScore: 0,
            driftCombo: 1
        };
    }

    // updated signature: flags for forward/back and turning
    update(forward, back, turnLeft, turnRight, speed) {
        // turning controls adjust desired heading
        if (turnLeft) this.desiredHeading -= this.turnSpeed;
        if (turnRight) this.desiredHeading += this.turnSpeed;

        // smoothly interpolate heading toward desiredHeading
        this.heading = lerpAngle(this.heading, this.desiredHeading, this.headingSmooth);

        // movement along the car's front (heading)
        if (forward || back) {
            let dir = forward ? 1 : -1;
            // heading is screen-space angle; compute world velocity (y up -> negate sin)
            this.vel.x = cos(this.heading) * speed * dir;
            this.vel.y = -sin(this.heading) * speed * dir;
            this.pos.add(this.vel);
        } else {
            this.vel.set(0, 0);
        }

        // clamp to world bounds (world is 1400 x 1000 centered at origin)
        let halfW = 700;
        let halfH = 500;
        this.pos.x = constrain(this.pos.x, -halfW, halfW);
        this.pos.y = constrain(this.pos.y, -halfH, halfH);
    }
}

