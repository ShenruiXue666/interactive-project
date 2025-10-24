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
        updateCameraFollow();
        camera.update();

        // Update game logic (placeholder)
        updateGameLogic();

        // Draw world with camera
        camera.apply();
        drawNeonGrid();
        drawTrack();
        drawCars();
        camera.unapply();

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
    push();

    // NOTE: This will use Person B's track.draw(camera) function
    // For now, draw a placeholder track

    stroke(NEON_COLORS.wall);
    strokeWeight(4);

    // Apply neon glow
    drawingContext.shadowBlur = 15;
    drawingContext.shadowColor = NEON_COLORS.wall;

    noFill();

    // Outer boundary
    rect(-800, -600, 1600, 1200);

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

    line(-800, 0, -750, 0); // Start line
    line(0, -600, 0, -550); // Checkpoint 1
    line(800, 0, 750, 0); // Checkpoint 2
    line(0, 600, 0, 550); // Checkpoint 3

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
        rect(0, 0, 40, 20);

        // Headlights
        fill(255, 255, 0);
        ellipse(15, -7, 5);
        ellipse(15, 7, 5);

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
 * Initialize placeholder game objects
 * NOTE: This will be replaced with Person A & B's actual implementations
 */
function initializePlaceholderGame() {
    // Clear existing cars from world
    for (let car of cars) {
        if (car.body) {
            World.remove(world, car.body);
        }
    }

    // Create car(s) using Car class
    if (gameMode === 'single') {
        let car = new Car(0, 0, engine, world, {
            up: 87,      // W
            down: 83,    // S
            left: 65,    // A
            right: 68    // D
        });
        cars = [car];
    } else {
        // Player 1 - WASD
        let car1 = new Car(-100, 0, engine, world, {
            up: 87,      // W
            down: 83,    // S
            left: 65,    // A
            right: 68    // D
        });

        // Player 2 - Arrow keys
        let car2 = new Car(100, 0, engine, world, {
            up: UP_ARROW,
            down: DOWN_ARROW,
            left: LEFT_ARROW,
            right: RIGHT_ARROW
        });

        cars = [car1, car2];
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
    camera.x = 0;
    camera.y = 0;
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

    // Demo: Test camera shake with Space (will be replaced by drift mechanics)
    if (key === ' ' && gameState === 'playing') {
        camera.shake(15, 10);
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
    camera.shake(10, 8);

    // Reset drift combo
    if (cars[carIndex] && cars[carIndex].state) {
        cars[carIndex].state.driftCombo = 1;
    }
}
