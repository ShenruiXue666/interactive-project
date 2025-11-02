/* 
 * File: track.js
 * Role: Person B - Bilal
 * Description: Track construction, collision detection, race rules, and gameplay mechanics
 * 
 * Main Components:
 *   0) World bounds configuration
 *   1) Arena construction (walls, chicanes, sensors)
 *   2) Sensors and race rules (collision detection)
 *   3) Lap timing system
 *   4) World helper functions
 *   5) Start positions and reset helper
 *   6) Multiple checkpoints in order
 *   7) Start-line cooldown system
 *   8) Curved barriers (obstacles)
 *   9) Penalty timer API
 *   10) Optional surface pads (boost/grip)
 *   11) Optional JSON arena loader
 *   12) Turret system (water pressure obstacles)
 * 
 * Integration Notes:
 *   - Uses p5.js + Matter.js for physics
 *   - Expected callbacks from sketch.js:
 *       onCheckpoint(carIndex, checkpointIndex)
 *       onLap(carIndex, lapTimeSeconds)
 *       onWallHit(carIndex)
 *       onPad(carIndex, type) // optional
 */

/* ============================================
 * 0) WORLD BOUNDS
 * ============================================
 * Defines the playable world dimensions.
 * Used by camera and HUD systems.
 */
var WORLD_BOUNDS = { W: 3000, H: 2000 };

/* ============================================
 * 5) START POSITIONS + RESET HELPER
 * ============================================
 * Deterministic spawn positions for single or two players.
 * Person C can read positions via getStartPositions() or reset cars with resetToStart().
 */
var START_POSITIONS = [
    { x: 600, y: 500, angle: 0 },   // Player 1 spawn
    { x: 640, y: 500, angle: 0 }    // Player 2 spawn
];

// Get a copy of start positions array
function getStartPositions() { 
    return START_POSITIONS.slice(); 
}

// Reset a car body to its designated start position
function resetToStart(carBody, index) {
    var sp = START_POSITIONS[index % START_POSITIONS.length];
    Matter.Body.setPosition(carBody, { x: sp.x, y: sp.y });
    Matter.Body.setAngle(carBody, sp.angle);
    Matter.Body.setVelocity(carBody, { x: 0, y: 0 });
    Matter.Body.setAngularVelocity(carBody, 0);
}

/* ============================================
 * 6) MULTIPLE CHECKPOINTS IN ORDER
 * ============================================
 * Ordered checkpoint system for proper racing circuit.
 * Lap counts only if checkpoints are touched in sequence.
 * buildTrack() creates a sensor for each checkpoint.
 */
var CHECKPOINTS = [
    // Scattered checkpoints forming a racing circuit (positioned to avoid obstacles)
    { x: 2100, y: 1500, r: 35 },  // CP0 - Bottom-right
    { x: 2500, y: 1200, r: 35 },  // CP1 - Top-right
    { x: 2000, y: 600, r: 35 },   // CP2 - Top-center
    { x: 1000, y: 300, r: 35 },   // CP3 - Top-left (moved away from obstacle)
    { x: 400, y: 1000, r: 35 },   // CP4 - Middle-left (moved away from obstacle)
    { x: 1100, y: 1600, r: 35 }   // CP5 - Bottom-left (moved away from obstacle)
];

/* ============================================
 * RANDOMIZATION SYSTEM
 * ============================================
 * Randomized obstacle and checkpoint placement system.
 * Ensures proper spacing and avoids overlaps for better gameplay variety.
 */
var RANDOMIZATION = {
    enable: true,
    checkpointCount: 6,
    checkpointRadius: 35,
    checkpointMinSpacing: 320,      // Minimum distance between checkpoints
    obstacleCount: 9,                // Matches CURVED_BARRIERS default length
    obstacleSize: { wMin: 100, wMax: 160, hMin: 18, hMax: 26 },
    obstacleAngleMax: 0.4,           // Maximum rotation angle for obstacles
    margin: 60,                      // Keep away from outer walls
    maxAttempts: 2000               // Safety limit for placement loops
};

/* ============================================
 * COLLISION HELPER FUNCTIONS
 * ============================================
 * Geometric collision detection utilities.
 * Used for randomized placement to prevent overlaps.
 */

// Generate random number in range [a, b]
function randRange(a, b) { 
    return a + Math.random() * (b - a); 
}

// Check if two circles overlap
function circlesOverlap(ax, ay, ar, bx, by, br) {
    var dx = ax - bx;
    var dy = ay - by;
    var r = ar + br;
    return (dx * dx + dy * dy) < (r * r);
}

// Check if circle overlaps with rotated rectangle
function circleRectOverlap(cx, cy, cr, rx, ry, rw, rh, ra) {
    // Transform circle into rectangle's local space by inverse rotation
    var cosA = Math.cos(-ra);
    var sinA = Math.sin(-ra);
    var lx = cosA * (cx - rx) - sinA * (cy - ry);
    var ly = sinA * (cx - rx) + cosA * (cy - ry);
    var hw = rw / 2;
    var hh = rh / 2;
    
    // Find closest point on AABB to circle center
    var closestX = Math.max(-hw, Math.min(lx, hw));
    var closestY = Math.max(-hh, Math.min(ly, hh));
    var dx = lx - closestX;
    var dy = ly - closestY;
    
    return (dx * dx + dy * dy) < (cr * cr);
}

// Check if two rotated rectangles overlap (simple SAT with two axes)
function rectsOverlap(ax, ay, aw, ah, aa, bx, by, bw, bh, ba) {
    function getCorners(x, y, w, h, a) {
        var hw = w / 2;
        var hh = h / 2;
        var c = Math.cos(a);
        var s = Math.sin(a);
        return [
            { x: x + c * (-hw) - s * (-hh), y: y + s * (-hw) + c * (-hh) },
            { x: x + c * ( hw) - s * (-hh), y: y + s * ( hw) + c * (-hh) },
            { x: x + c * ( hw) - s * ( hh), y: y + s * ( hw) + c * ( hh) },
            { x: x + c * (-hw) - s * ( hh), y: y + s * (-hw) + c * ( hh) }
        ];
    }
    
    function project(poly, ax, ay) {
        var min = Infinity;
        var max = -Infinity;
        for (var i = 0; i < poly.length; i++) {
            var p = poly[i];
            var dot = p.x * ax + p.y * ay;
            if (dot < min) min = dot;
            if (dot > max) max = dot;
        }
        return { min: min, max: max };
    }
    
    function overlapOnAxis(pa, pb) { 
        return !(pa.max < pb.min || pb.max < pa.min); 
    }
    
    var A = getCorners(ax, ay, aw, ah, aa);
    var B = getCorners(bx, by, bw, bh, ba);
    
    // Use normals of A's edges as separation axes (2 unique for rectangle)
    var axes = [
        { x: A[1].x - A[0].x, y: A[1].y - A[0].y },
        { x: A[3].x - A[0].x, y: A[3].y - A[0].y }
    ];
    
    for (var k = 0; k < axes.length; k++) {
        var axv = axes[k];
        var len = Math.hypot(axv.x, axv.y) || 1;
        var nx = axv.x / len;  // Normalize axis
        var ny = axv.y / len;
        var pa = project(A, nx, ny);
        var pb = project(B, nx, ny);
        if (!overlapOnAxis(pa, pb)) return false;
    }
    
    return true;
}

/* ============================================
 * RANDOMIZED TRACK LAYOUT GENERATOR
 * ============================================
 * Randomizes obstacles first, then checkpoints with spacing constraints.
 * Ensures no overlaps between checkpoints and obstacles for better gameplay flow.
 */
function randomizeTrackLayout_() {
    if (!RANDOMIZATION.enable) return;
    
    var W = WORLD_BOUNDS.W;
    var H = WORLD_BOUNDS.H;
    var M = RANDOMIZATION.margin;
    
    // Step 1: Randomize obstacles (rectangles scattered around)
    var obs = [];
    var attempts = 0;
    while (obs.length < RANDOMIZATION.obstacleCount && attempts < RANDOMIZATION.maxAttempts) {
        attempts++;
        var ox = randRange(M, W - M);
        var oy = randRange(M, H - M);
        var ow = randRange(RANDOMIZATION.obstacleSize.wMin, RANDOMIZATION.obstacleSize.wMax);
        var oh = randRange(RANDOMIZATION.obstacleSize.hMin, RANDOMIZATION.obstacleSize.hMax);
        var oa = randRange(-RANDOMIZATION.obstacleAngleMax, RANDOMIZATION.obstacleAngleMax);
        var okO = true;
        
        // Check for overlap with existing obstacles
        for (var j = 0; j < obs.length; j++) {
            var o = obs[j];
            if (rectsOverlap(ox, oy, ow, oh, oa, o.x, o.y, o.w, o.h, o.a)) {
                okO = false;
                break;
            }
        }
        
        if (okO) obs.push({ x: ox, y: oy, w: ow, h: oh, a: oa });
    }
    
    if (obs.length === RANDOMIZATION.obstacleCount) {
        CURVED_BARRIERS = obs;
    }

    // Step 2: Randomize checkpoints (enforce min spacing and avoid obstacles)
    var cps = [];
    attempts = 0;
    while (cps.length < RANDOMIZATION.checkpointCount && attempts < RANDOMIZATION.maxAttempts) {
        attempts++;
        var cx = randRange(M, W - M);
        var cy = randRange(M, H - M);
        var ok = true;
        
        // Ensure minimum spacing between checkpoints
        for (var i = 0; i < cps.length; i++) {
            var dx = cx - cps[i].x;
            var dy = cy - cps[i].y;
            var distSq = dx * dx + dy * dy;
            var minDistSq = RANDOMIZATION.checkpointMinSpacing * RANDOMIZATION.checkpointMinSpacing;
            if (distSq < minDistSq) {
                ok = false;
                break;
            }
        }
        
        // Avoid overlapping any obstacle
        if (ok) {
            for (var k = 0; k < CURVED_BARRIERS.length; k++) {
                var o2 = CURVED_BARRIERS[k];
                if (circleRectOverlap(cx, cy, RANDOMIZATION.checkpointRadius * 1.2, o2.x, o2.y, o2.w, o2.h, o2.a)) {
                    ok = false;
                    break;
                }
            }
        }
        
        if (ok) cps.push({ x: cx, y: cy, r: RANDOMIZATION.checkpointRadius });
    }
    
    if (cps.length === RANDOMIZATION.checkpointCount) {
        CHECKPOINTS = cps;
    }
}

/* ============================================
 * 8) CURVED BARRIERS (OBSTACLES)
 * ============================================
 * Rotated rectangles that approximate curves for drift flow.
 * Creates challenging sections that require skillful navigation.
 */
var CURVED_BARRIERS = [
    // Format: centerX, centerY, width, height, angleRadians
    // Scattered obstacles across the track for varied gameplay
    { x: 800, y: 300,   w: 120, h: 20, a:  0.3 },   // Top-left area
    { x: 1200, y: 400,  w: 140, h: 22, a: -0.2 },   // Top-center area
    { x: 2000, y: 350,  w: 100, h: 18, a:  0.4 },   // Top-right area
    { x: 600, y: 800,   w: 160, h: 24, a: -0.1 },   // Middle-left area
    { x: 1500, y: 900,  w: 130, h: 20, a:  0.25 },  // Middle-center area
    { x: 2400, y: 850,  w: 110, h: 22, a: -0.3 },   // Middle-right area
    { x: 900, y: 1400,  w: 150, h: 26, a:  0.15 },  // Bottom-left area
    { x: 1800, y: 1500, w: 120, h: 20, a: -0.25 },  // Bottom-center area
    { x: 2200, y: 1600, w: 140, h: 24, a:  0.35 }   // Bottom-right area
];

/* ============================================
 * 10) OPTIONAL SURFACE PADS
 * ============================================
 * Boost and grip sensor pads.
 * If used, they trigger onPad callback when cars collide.
 */
var BOOST_PADS = [
    // Boost pads provide speed boosts when driven over
    { x: 1000, y: 600, w: 140, h: 30 },   // Top area
    { x: 1600, y: 1200, w: 120, h: 25 },  // Middle area
    { x: 2200, y: 1000, w: 130, h: 28 }   // Right area
];

var GRIP_PADS = [
    // Grip pads improve traction and reduce drift
    { x: 700, y: 1200, w: 180, h: 35 },   // Left area
    { x: 1900, y: 600, w: 160, h: 32 },   // Top-right area
    { x: 1400, y: 1600, w: 200, h: 40 }   // Bottom area
];

/* ============================================
 * 12) TURRET SYSTEM
 * ============================================
 * Static turrets that spray water pressure to push cars away.
 * Adds dynamic challenge - turrets activate when cars enter trigger radius.
 * Features random spray directions for visual effect.
 */
var TURRET_CONFIG = {
    count: 8,                    // Number of turrets in the arena
    triggerRadius: 450,          // Inner radius for activation (400-500px)
    forceRadius: 1100,           // Outer radius for push force application (1000-1200px)
    sprayRadius: 120,            // Visual spray radius (wider for visibility)
    minSpacing: 750,             // Minimum distance between turrets (700-800px)
    margin: 80                   // Keep away from world edges
};

var TURRETS = []; // Populated by randomizeTurrets_()

/* ============================================
 * TURRET PLACEMENT RANDOMIZER
 * ============================================
 * Randomizes turret positions with spacing constraints.
 * Ensures turrets are evenly distributed and not too close to checkpoints.
 */
function randomizeTurrets_() {
    var W = WORLD_BOUNDS.W;
    var H = WORLD_BOUNDS.H;
    var M = TURRET_CONFIG.margin;
    var turrets = [];
    var attempts = 0;
    var maxAttempts = 1000;
    
    while (turrets.length < TURRET_CONFIG.count && attempts < maxAttempts) {
        attempts++;
        var tx = randRange(M, W - M);
        var ty = randRange(M, H - M);
        var ok = true;
        
        // Check spacing from existing turrets
        for (var j = 0; j < turrets.length; j++) {
            var existing = turrets[j];
            var dx = tx - existing.x;
            var dy = ty - existing.y;
            var dist = Math.hypot(dx, dy);
            if (dist < TURRET_CONFIG.minSpacing) {
                ok = false;
                break;
            }
        }
        
        // Check spacing from checkpoints (avoid placing too close)
        if (ok) {
            for (var c = 0; c < CHECKPOINTS.length; c++) {
                var cp = CHECKPOINTS[c];
                var dx = tx - cp.x;
                var dy = ty - cp.y;
                var dist = Math.hypot(dx, dy);
                if (dist < 200) { // Keep 200px from checkpoints
                    ok = false;
                    break;
                }
            }
        }
        
        if (ok) {
            turrets.push({
                x: tx,
                y: ty,
                angle: 0,                      // Not used for force direction, kept for visual consistency
                range: TURRET_CONFIG.forceRadius,
                triggerRadius: TURRET_CONFIG.triggerRadius,
                sprayRadius: TURRET_CONFIG.sprayRadius
            });
        }
    }
    
    if (turrets.length >= TURRET_CONFIG.count) {
        TURRETS = turrets;
    }
}

/* ============================================
 * 1) ARENA CONSTRUCTION
 * ============================================
 * Builds the complete track: outer walls, chicanes, start sensor, ordered checkpoints,
 * curved barriers, optional pads, and turrets. Adds all bodies to Matter world.
 * Returns references for rendering and collision detection.
 */
function buildTrack(MatterRef, world) {
    var Bodies = MatterRef.Bodies;
    var World  = MatterRef.World;
    
    var W = WORLD_BOUNDS.W;
    var H = WORLD_BOUNDS.H;
    var wallThickness = 40;
    
    // Wall physics properties
    var wallOptions = {
        isStatic: true,
        restitution: 0,           // No bounce
        friction: 0,
        label: "WALL"
    };
    
    // Outer boundary walls
    var topWall    = Bodies.rectangle(W / 2, wallThickness / 2, W, wallThickness, wallOptions);
    var bottomWall = Bodies.rectangle(W / 2, H - wallThickness / 2, W, wallThickness, wallOptions);
    var leftWall   = Bodies.rectangle(wallThickness / 2, H / 2, wallThickness, H, wallOptions);
    var rightWall  = Bodies.rectangle(W - wallThickness / 2, H / 2, wallThickness, H, wallOptions);
    
    // Chicanes create S-curve drift sections
    var chicaneA = Bodies.rectangle(1400, 900, 260, 30, {
        isStatic: true,
        restitution: 0,
        friction: 0,
        label: "WALL",
        angle: Math.PI / 12
    });
    var chicaneB = Bodies.rectangle(1650, 1100, 260, 30, {
        isStatic: true,
        restitution: 0,
        friction: 0,
        label: "WALL",
        angle: -Math.PI / 12
    });
    
    // Randomize layout before creating physics bodies
    randomizeTrackLayout_();
    
    // Randomize turret placement after checkpoints/obstacles are placed
    randomizeTurrets_();
    
    // Create curved barrier bodies (obstacles)
    var curvedBodies = [];
    for (var cb = 0; cb < CURVED_BARRIERS.length; cb++) {
        var c = CURVED_BARRIERS[cb];
        curvedBodies.push(Bodies.rectangle(c.x, c.y, c.w, c.h, {
            isStatic: true,
            restitution: 0,
            friction: 0,
            label: "WALL",
            angle: c.a
        }));
    }
    
    // Start line sensor (triggers lap completion when crossed)
    var startSensor = Bodies.rectangle(600, 400, 220, 10, {
        isStatic: true,
        isSensor: true,
        label: "START"
    });
    
    // Create checkpoint sensors (ordered sequence required)
    var checkpointBodies = [];
    for (var ci = 0; ci < CHECKPOINTS.length; ci++) {
        var cp = CHECKPOINTS[ci];
        checkpointBodies.push(Bodies.circle(cp.x, cp.y, cp.r, {
            isStatic: true,
            isSensor: true,
            label: "CHECK_" + ci
        }));
    }
    
    // Create boost pad sensors
    var boostBodies = [];
    for (var bi = 0; bi < BOOST_PADS.length; bi++) {
        var bp = BOOST_PADS[bi];
        boostBodies.push(Bodies.rectangle(bp.x, bp.y, bp.w, bp.h, {
            isStatic: true,
            isSensor: true,
            label: "BOOST_PAD"
        }));
    }
    
    // Create grip pad sensors
    var gripBodies = [];
    for (var gi = 0; gi < GRIP_PADS.length; gi++) {
        var gp = GRIP_PADS[gi];
        gripBodies.push(Bodies.rectangle(gp.x, gp.y, gp.w, gp.h, {
            isStatic: true,
            isSensor: true,
            label: "GRIP_PAD"
        }));
    }
    
    // Create turret bodies (static emitters)
    var turretBodies = [];
    for (var ti = 0; ti < TURRETS.length; ti++) {
        var tur = TURRETS[ti];
        turretBodies.push(Bodies.rectangle(tur.x, tur.y, 40, 40, {
            isStatic: true,
            restitution: 0,
            friction: 0,
            label: "TURRET_" + ti,
            angle: tur.angle
        }));
    }
    
    // Add all bodies to world
    var addList = [
        topWall, bottomWall, leftWall, rightWall,
        chicaneA, chicaneB, startSensor
    ].concat(curvedBodies, checkpointBodies, boostBodies, gripBodies, turretBodies);
    
    World.add(world, addList);
    
    // Initialize turret spray state (timers, active sprays, particles)
    var turretState = createTurretState_(TURRETS.length);
    
    // Return track data for rendering and game logic
    return {
        bounds: { W: W, H: H },
        walls: [topWall, bottomWall, leftWall, rightWall, chicaneA, chicaneB].concat(curvedBodies),
        startSensor: startSensor,
        checkpoints: checkpointBodies,
        boostPads: boostBodies,
        gripPads: gripBodies,
        turrets: turretBodies,
        turretData: TURRETS,
        turretState: turretState
    };
}

/* ============================================
 * 2) SENSORS AND RACE RULES
 * ============================================
 * Wires collision detection for cars against checkpoints, start line, walls, and pads.
 * Tracks per-car state (checkpoint order, lap timing, penalties).
 * Fires callbacks to sketch.js when events occur.
 */
function attachRaceRules(MatterRef, engine, carBodies, callbacks) {
    var Events = MatterRef.Events;
    
    // Ensure all car bodies have proper labels
    for (var i = 0; i < carBodies.length; i++) {
        if (!carBodies[i].label) carBodies[i].label = "CAR" + i;
    }
    
    // Per-car race state tracking
    var passedCheckpoint = new Array(carBodies.length).fill(false);  // Legacy single checkpoint flag
    var nextCheckpointIndex = new Array(carBodies.length).fill(0);   // Ordered checkpoint system
    
    // Start-line cooldown prevents immediate re-triggering
    var startCooldownMs = new Array(carBodies.length).fill(0);
    
    // Penalty timer tracks wall-hit penalties
    var penaltyUntil = new Array(carBodies.length).fill(0);
    
    // Lap timing state (defined in Part 3)
    var lapState = createLapState_(carBodies.length);
    
    // Listen for collision events
    Events.on(engine, "collisionStart", function(evt) {
        var pairs = evt.pairs;
        var now = performance.now();
        
        for (var p = 0; p < pairs.length; p++) {
            var a = pairs[p].bodyA;
            var b = pairs[p].bodyB;
            
            // Process collisions for each car
            for (var idx = 0; idx < carBodies.length; idx++) {
                var carLabel = carBodies[idx].label;
                
                // Only process if this collision involves the current car
                var involvesThisCar = (a.label === carLabel || b.label === carLabel);
                if (!involvesThisCar) continue;
                
                // Surface pad collisions (optional)
                if ((a.label === carLabel && b.label === "BOOST_PAD") ||
                    (b.label === carLabel && a.label === "BOOST_PAD")) {
                    if (callbacks && typeof callbacks.onPad === "function") {
                        callbacks.onPad(idx, "boost");
                    }
                }
                
                if ((a.label === carLabel && b.label === "GRIP_PAD") ||
                    (b.label === carLabel && a.label === "GRIP_PAD")) {
                    if (callbacks && typeof callbacks.onPad === "function") {
                        callbacks.onPad(idx, "grip");
                    }
                }
                
                // Ordered checkpoint detection (CHECK_0, CHECK_1, ...)
                var otherLabel = (a.label === carLabel) ? b.label : a.label;
                if (otherLabel && otherLabel.indexOf("CHECK_") === 0) {
                    var hitIndex = parseInt(otherLabel.split("_")[1], 10);
                    
                    // Only count if checkpoint is hit in correct sequence
                    if (hitIndex === nextCheckpointIndex[idx]) {
                        // Correct order - advance to next checkpoint
                        nextCheckpointIndex[idx] = (nextCheckpointIndex[idx] + 1) % Math.max(1, CHECKPOINTS.length);
                        passedCheckpoint[idx] = true; // Legacy flag for older UI logic
                        
                        if (callbacks && typeof callbacks.onCheckpoint === "function") {
                            callbacks.onCheckpoint(idx, hitIndex);
                        }
                    }
                }
                
                // Start line crossing (with cooldown and order requirement)
                if (((a.label === carLabel && b.label === "START") ||
                     (b.label === carLabel && a.label === "START"))) {
                    
                    // Ignore if still in cooldown period
                    if (now < startCooldownMs[idx]) continue;
                    
                    // Check if all checkpoints were passed (for lap completion)
                    var cps = Math.max(1, CHECKPOINTS.length);
                    var allPassed = (cps === 1) ? passedCheckpoint[idx]
                                                : (nextCheckpointIndex[idx] === 0 && passedCheckpoint[idx]);
                    
                    if (allPassed) {
                        // Complete lap and reset for next lap
                        var lapTimeSec = completeLap_(lapState, idx);
                        passedCheckpoint[idx] = false;
                        
                        // Set cooldown to prevent immediate re-triggering
                        startCooldownMs[idx] = now + 1000;
                        
                        if (callbacks && typeof callbacks.onLap === "function") {
                            callbacks.onLap(idx, lapTimeSec);
                        }
                    }
                }
                
                // Wall hit penalty
                if ((a.label === carLabel && b.label === "WALL") ||
                    (b.label === carLabel && a.label === "WALL")) {
                    // Apply penalty timer (1 second)
                    penaltyUntil[idx] = now + 1000;
                    
                    if (callbacks && typeof callbacks.onWallHit === "function") {
                        callbacks.onWallHit(idx);
                    }
                }
            }
        }
    });
    
    // Public API for HUD and debugging
    return {
        getLapInfo: function(index) {
            if (index === undefined) index = 0;
            return {
                lap: lapState.lapCount[index],
                lastLap: lapState.lastLap[index],
                bestLap: lapState.bestLap[index],
                passedCheckpoint: passedCheckpoint[index],
                nextCheckpointIndex: nextCheckpointIndex[index],
                isPenalized: (performance.now() < penaltyUntil[index])
            };
        },
        
        resetRace: function(index) {
            if (index === undefined) index = 0;
            passedCheckpoint[index] = false;
            nextCheckpointIndex[index] = 0;
            startCooldownMs[index] = 0;
            penaltyUntil[index] = 0;
            resetLapState_(lapState, index);
        },
        
        isPenalized: function(index) {
            if (index === undefined) index = 0;
            return performance.now() < penaltyUntil[index];
        }
    };
}

/* ============================================
 * 3) LAP TIMING
 * ============================================
 * Tracks lap times using performance.now() for accurate timing.
 * Maintains per-car arrays for lap count, last lap time, best lap time, and lap start time.
 */
function createLapState_(carsCount) {
    var now = performance.now();
    return {
        lapCount: new Array(carsCount).fill(0),
        lastLap:  new Array(carsCount).fill(0),
        bestLap:  new Array(carsCount).fill(0),
        lapStartMs: new Array(carsCount).fill(now)
    };
}

// Complete a lap and update timing records
function completeLap_(lapState, index) {
    var now = performance.now();
    var lapTimeSec = (now - lapState.lapStartMs[index]) / 1000;
    lapState.lapStartMs[index] = now;
    lapState.lapCount[index] += 1;
    lapState.lastLap[index] = lapTimeSec;
    
    // Update best lap time if this one is faster
    if (lapState.bestLap[index] === 0 || lapTimeSec < lapState.bestLap[index]) {
        lapState.bestLap[index] = lapTimeSec;
    }
    
    return lapTimeSec;
}

// Reset lap timing state for a specific car
function resetLapState_(lapState, index) {
    lapState.lapCount[index] = 0;
    lapState.lastLap[index] = 0;
    lapState.bestLap[index] = 0;
    lapState.lapStartMs[index] = performance.now();
}

/* ============================================
 * 4) WORLD HELPERS
 * ============================================
 */
function getWorldBounds() { 
    return { W: WORLD_BOUNDS.W, H: WORLD_BOUNDS.H }; 
}

/* ============================================
 * 12b) TURRET STATE & UPDATE SYSTEM
 * ============================================
 * Manages turret spray timing, particle effects, and force application.
 * Turrets activate when cars enter trigger radius and push cars away with water pressure.
 */
function createTurretState_(turretCount) {
    var now = performance.now();
    return {
        activeSprays: new Array(turretCount).fill(false),      // Which turrets are currently spraying
        sprayEndTime: new Array(turretCount).fill(0),          // When each spray ends
        particles: [],                                         // Particle arrays for each turret (visual effect)
        carsInTrigger: new Array(turretCount).fill(false),     // Track if any car is in trigger radius
        glowIntensity: new Array(turretCount).fill(0)          // Pulsing glow intensity (0-1)
    };
}

/* ============================================
 * TURRET UPDATE LOGIC
 * ============================================
 * Updates turret spray logic and applies forces to cars in range.
 * Works identically for single-player and two-player modes - all cars are affected equally.
 * Turrets activate when cars enter trigger radius, push cars away, and spray randomly.
 */
function updateTurrets_(turretState, turretData, turretBodies, carBodies, MatterRef) {
    var now = performance.now();
    
    // Update each turret
    for (var i = 0; i < turretData.length; i++) {
        var tur = turretData[i];
        var turBody = turretBodies[i];
        if (!tur || !turBody) continue;
        
        // Get turret position from body if available, otherwise use data
        var turX = (turBody && turBody.position) ? turBody.position.x : tur.x;
        var turY = (turBody && turBody.position) ? turBody.position.y : tur.y;
        var triggerRadius = tur.triggerRadius || TURRET_CONFIG.triggerRadius;
        var forceRadius = tur.range || TURRET_CONFIG.forceRadius;
        var hasCarInTrigger = false;
        
        // Check if any car is in trigger radius (activates turret)
        // Works for both single-player and two-player modes
        for (var c = 0; c < carBodies.length; c++) {
            var car = carBodies[c];
            if (!car || !car.position) continue;
            
            var carX = car.position.x;
            var carY = car.position.y;
            var dx = carX - turX;
            var dy = carY - turY;
            var dist = Math.hypot(dx, dy);
            
            // Any car entering trigger radius activates the turret
            if (dist <= triggerRadius && dist > 0) {
                hasCarInTrigger = true;
                break; // Found at least one car, no need to check others
            }
        }
        
        // Update trigger state: activate if car enters, deactivate if no cars in range
        var wasInTrigger = turretState.carsInTrigger[i];
        turretState.carsInTrigger[i] = hasCarInTrigger;
        
        // Start spray when car first enters trigger radius (only once per entry)
        if (hasCarInTrigger && !wasInTrigger && !turretState.activeSprays[i]) {
            turretState.activeSprays[i] = true;
            turretState.sprayEndTime[i] = now + 1000; // Spray lasts 1 second
            turretState.glowIntensity[i] = 1.0; // Start at full glow
            
            // Initialize random spray particles (spread in all directions)
            turretState.particles[i] = [];
            for (var p = 0; p < 25; p++) { // More particles for wider spray
                var randomAngle = Math.random() * Math.PI * 2; // Random direction
                var dist = Math.random() * tur.sprayRadius;
                turretState.particles[i].push({
                    x: tur.x,
                    y: tur.y,
                    life: 40,
                    maxLife: 40,
                    tx: tur.x + Math.cos(randomAngle) * dist,
                    ty: tur.y + Math.sin(randomAngle) * dist,
                    speed: 2 + Math.random() * 3 // Variable particle speed
                });
            }
        }
        
        // If spraying, apply forces to cars in force range
        // Works for both single-player and two-player modes - affects all cars equally
        if (turretState.activeSprays[i] && now < turretState.sprayEndTime[i]) {
            // Apply forces to ALL cars in force range
            for (var c = 0; c < carBodies.length; c++) {
                var car = carBodies[c];
                if (!car || !car.position) continue;
                
                var carX = car.position.x;
                var carY = car.position.y;
                
                // Vector from turret to car
                var dx = carX - turX;
                var dy = carY - turY;
                var dist = Math.hypot(dx, dy);
                
                // Check if car is in force application range
                if (dist <= forceRadius && dist > 0) {
                    // Normalize the vector from turret to car
                    var len = dist;
                    var dirX = dx / len;
                    var dirY = dy / len;
                    
                    // Reverse direction to push car AWAY from turret
                    var pushDirX = -dirX;
                    var pushDirY = -dirY;
                    
                    // Scale force by distance (closer = stronger push)
                    // Maintain consistent feel across longer distances
                    var forceScale = Math.max(0.35, 1.0 - (dist / forceRadius)); // 35% minimum at max range
                    var pushForce = 0.08 * forceScale; // Base force for noticeable push impact
                    
                    // Apply force pushing car away from turret
                    Matter.Body.applyForce(car, car.position, {
                        x: pushDirX * pushForce,
                        y: pushDirY * pushForce
                    });
                }
            }
            
            // Update particle positions and lifetimes for visual effect
            if (turretState.particles[i]) {
                for (var pIdx = turretState.particles[i].length - 1; pIdx >= 0; pIdx--) {
                    var part = turretState.particles[i][pIdx];
                    if (!part) continue;
                    
                    part.life--;
                    if (part.life <= 0) {
                        turretState.particles[i].splice(pIdx, 1);
                    }
                }
            }
            
            // Update pulsing glow (fade out during spray)
            var sprayProgress = (now - (turretState.sprayEndTime[i] - 1000)) / 1000;
            turretState.glowIntensity[i] = Math.max(0, 1.0 - sprayProgress * 0.5); // Fade from 1.0 to 0.5
        } else if (turretState.activeSprays[i] && now >= turretState.sprayEndTime[i]) {
            // Spray ended
            turretState.activeSprays[i] = false;
            turretState.particles[i] = [];
            turretState.glowIntensity[i] = 0;
        } else if (!hasCarInTrigger) {
            // No cars in trigger, fade glow gradually
            turretState.glowIntensity[i] = Math.max(0, turretState.glowIntensity[i] - 0.05);
        }
    }
    
    return turretState;
}

// Public wrapper to update turrets (called from sketch.js)
function updateTurrets(turretState, turretData, turretBodies, carBodies, MatterRef) {
    return updateTurrets_(turretState, turretData, turretBodies, carBodies, MatterRef);
}

/* ============================================
 * DEBUG DRAWING HELPERS
 * ============================================
 * Draws start line and all checkpoints for visual debugging reference.
 */
function drawStartAndCheckpointDebug() {
    push();
    noFill();
    
    // Start line rectangle for reference
    stroke(255, 255, 0);
    strokeWeight(2);
    rectMode(CENTER);
    rect(600, 400, 220, 10);
    
    // All checkpoints from data
    stroke(0, 200, 255);
    for (var i = 0; i < CHECKPOINTS.length; i++) {
        circle(CHECKPOINTS[i].x, CHECKPOINTS[i].y, CHECKPOINTS[i].r * 2);
    }
    
    pop();
}

/* ============================================
 * 11) OPTIONAL JSON ARENA LOADER
 * ============================================
 * Create walls, checkpoints, and pads from a plain JavaScript object.
 * Can be called instead of or in addition to buildTrack if needed.
 * 
 * Example data structure:
 * {
 *   "walls": [{"x":1200, "y":850, "w":160, "h":24, "a":0.1}],
 *   "checkpoints": [{"x":2100, "y":1500, "r":35}],
 *   "pads": {
 *     "boost": [{"x":1000, "y":700, "w":140, "h":30}],
 *     "grip": [{"x":1800, "y":1300, "w":200, "h":40}]
 *   }
 * }
 */
function loadArenaFromJSON(data, MatterRef, world) {
    var Bodies = MatterRef.Bodies;
    var World  = MatterRef.World;
    var addList = [];
    
    // Load walls
    if (data.walls && data.walls.length) {
        for (var i = 0; i < data.walls.length; i++) {
            var w = data.walls[i];
            addList.push(Bodies.rectangle(w.x, w.y, w.w, w.h, {
                isStatic: true,
                restitution: 0,
                friction: 0,
                label: "WALL",
                angle: w.a || 0
            }));
        }
    }
    
    // Load checkpoints (also update in-memory list for debug drawing)
    if (data.checkpoints && data.checkpoints.length) {
        CHECKPOINTS = [];
        for (var c = 0; c < data.checkpoints.length; c++) {
            var cp = data.checkpoints[c];
            CHECKPOINTS.push({ x: cp.x, y: cp.y, r: cp.r });
            addList.push(Bodies.circle(cp.x, cp.y, cp.r, {
                isStatic: true,
                isSensor: true,
                label: "CHECK_" + c
            }));
        }
    }
    
    // Load boost pads
    if (data.pads) {
        if (data.pads.boost && data.pads.boost.length) {
            for (var b = 0; b < data.pads.boost.length; b++) {
                var bp = data.pads.boost[b];
                addList.push(Bodies.rectangle(bp.x, bp.y, bp.w, bp.h, {
                    isStatic: true,
                    isSensor: true,
                    label: "BOOST_PAD"
                }));
            }
        }
        
        // Load grip pads
        if (data.pads.grip && data.pads.grip.length) {
            for (var g = 0; g < data.pads.grip.length; g++) {
                var gp = data.pads.grip[g];
                addList.push(Bodies.rectangle(gp.x, gp.y, gp.w, gp.h, {
                    isStatic: true,
                    isSensor: true,
                    label: "GRIP_PAD"
                }));
            }
        }
    }
    
    // Add all loaded bodies to world
    if (addList.length) World.add(world, addList);
}
