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
 *   10)
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
 */
var WORLD_BOUNDS = { W: 3000, H: 2000 };

/* ============================================
 * 5) START POSITIONS + RESET HELPER
 * ============================================
 */
var START_POSITIONS = [
    { x: 400, y: 500, angle: 0 },   // Player 1 spawn
    { x: 1600, y: 500, angle: 0 }    // Player 2 spawn
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
 * 6) MULTIPLE CHECKPOINTS
 * ============================================
 */
var CHECKPOINTS = [
    // Scattered checkpoints forming a racing circuit
    { x: 2100, y: 1500, r: 35 },  // CP0 - Bottom-right
    { x: 2500, y: 1200, r: 35 },  // CP1 - Top-right
    { x: 2000, y: 600, r: 35 },   // CP2 - Top-center
    { x: 1000, y: 300, r: 35 },   // CP3 - Top-left
    { x: 400, y: 1000, r: 35 },   // CP4 - Middle-left
    { x: 1100, y: 1600, r: 35 }   // CP5 - Bottom-left
];

/* ============================================
 * RANDOMIZATION SYSTEM
 * ============================================
 */
var RANDOMIZATION = {
    enable: true,
    checkpointCount: 6,
    checkpointRadius: 35,
    checkpointMinSpacing: 320,      // Minimum distance between checkpoints
    obstacleCount: 9,              // Matches CURVED_BARRIERS default length
    obstacleSize: { wMin: 100, wMax: 160, hMin: 18, hMax: 26 },
    obstacleAngleMax: 0.4,       // Maximum rotation angle for obstacles
    margin: 60,                    // Keep away from outer walls
    maxAttempts: 2000              // Safety limit for placement loops
};

/* ============================================
 * COLLISION HELPER FUNCTIONS
 * ============================================
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
    var cosA = Math.cos(-ra);
    var sinA = Math.sin(-ra);
    var lx = cosA * (cx - rx) - sinA * (cy - ry);
    var ly = sinA * (cx - rx) + cosA * (cy - ry);
    var hw = rw / 2;
    var hh = rh / 2;
    var closestX = Math.max(-hw, Math.min(lx, hw));
    var closestY = Math.max(-hh, Math.min(ly, hh));
    var dx = lx - closestX;
    var dy = ly - closestY;
    return (dx * dx + dy * dy) < (cr * cr);
}

// Check if two rotated rectangles overlap (simple SAT)
function rectsOverlap(ax, ay, aw, ah, aa, bx, by, bw, bh, ba) {
    function getCorners(x, y, w, h, a) {
        var hw = w / 2;
        var hh = h / 2;
        var c = Math.cos(a);
        var s = Math.sin(a);
        return [
            { x: x + c * (-hw) - s * (-hh), y: y + s * (-hw) + c * (-hh) },
            { x: x + c * (hw) - s * (-hh), y: y + s * (hw) + c * (-hh) },
            { x: x + c * (hw) - s * (hh), y: y + s * (hw) + c * (hh) },
            { x: x + c * (-hw) - s * (hh), y: y + s * (-hw) + c * (hh) }
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
    var axes = [
        { x: A[1].x - A[0].x, y: A[1].y - A[0].y },
        { x: A[3].x - A[0].x, y: A[3].y - A[0].y }
    ];
    for (var k = 0; k < axes.length; k++) {
        var axv = axes[k];
        var len = Math.hypot(axv.x, axv.y) || 1;
        var nx = axv.x / len;
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
 */
function randomizeTrackLayout_() {
    if (!RANDOMIZATION.enable) return;
    var W = WORLD_BOUNDS.W;
    var H = WORLD_BOUNDS.H;
    var M = RANDOMIZATION.margin;

    // Step 1: Randomize obstacles
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
        for (var j = 0; j < obs.length; j++) {
            if (rectsOverlap(ox, oy, ow, oh, oa, obs[j].x, obs[j].y, obs[j].w, obs[j].h, obs[j].a)) {
                okO = false;
                break;
            }
        }
        if (okO) obs.push({ x: ox, y: oy, w: ow, h: oh, a: oa });
    }
    if (obs.length === RANDOMIZATION.obstacleCount) CURVED_BARRIERS = obs;

    // Step 2: Randomize checkpoints
    var cps = [];
    attempts = 0;
    while (cps.length < RANDOMIZATION.checkpointCount && attempts < RANDOMIZATION.maxAttempts) {
        attempts++;
        var cx = randRange(M, W - M);
        var cy = randRange(M, H - M);
        var ok = true;
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
    if (cps.length === RANDOMIZATION.checkpointCount) CHECKPOINTS = cps;
}

/* ============================================
 * 8) CURVED BARRIERS (OBSTACLES)
 * ============================================
 */
var CURVED_BARRIERS = [
    { x: 800, y: 300, w: 120, h: 20, a: 0.3 },   // Top-left area
    { x: 1200, y: 400, w: 140, h: 22, a: -0.2 },  // Top-center area
    { x: 2000, y: 350, w: 100, h: 18, a: 0.4 },   // Top-right area
    { x: 600, y: 800, w: 160, h: 24, a: -0.1 },  // Middle-left area
    { x: 1500, y: 900, w: 130, h: 20, a: 0.25 },  // Middle-center area
    { x: 2400, y: 850, w: 110, h: 22, a: -0.3 },  // Middle-right area
    { x: 900, y: 1400, w: 150, h: 26, a: 0.15 },  // Bottom-left area
    { x: 1800, y: 1500, w: 120, h: 20, a: -0.25 }, // Bottom-center area
    { x: 2200, y: 1600, w: 140, h: 24, a: 0.35 }  // Bottom-right area
];

/* ============================================
 * 12) TURRET SYSTEM
 * ============================================
 */
var TURRET_CONFIG = {
    count: 8,
    triggerRadius: 450,
    forceRadius: 1100,
    sprayRadius: 120,
    minSpacing: 750,
    margin: 80
};
var TURRETS = []; // Populated by randomizeTurrets_()

/* ============================================
 * TURRET PLACEMENT RANDOMIZER
 * ============================================
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

        // --- NEW FIX ---
        // Check spacing from car start positions (avoid spawning in a trigger)
        if (ok) {
            for (var s = 0; s < START_POSITIONS.length; s++) {
                var sp = START_POSITIONS[s];
                var dx = tx - sp.x;
                var dy = ty - sp.y;
                var dist = Math.hypot(dx, dy);
                // Keep turrets further than their trigger radius from spawn points
                if (dist < (TURRET_CONFIG.triggerRadius + 50)) { // Add 50px buffer
                    ok = false;
                    break;
                }
            }
        }
        // --- END NEW FIX ---

        if (ok) {
            turrets.push({
                x: tx, y: ty, angle: 0,
                range: TURRET_CONFIG.forceRadius,
                triggerRadius: TURRET_CONFIG.triggerRadius,
                sprayRadius: TURRET_CONFIG.sprayRadius
            });
        }
    }
    if (turrets.length >= TURRET_CONFIG.count) TURRETS = turrets;
}

/* ============================================
 * 1) ARENA CONSTRUCTION
 * ============================================
 */
function buildTrack(MatterRef, world) {
    var Bodies = MatterRef.Bodies;
    var World = MatterRef.World;
    var W = WORLD_BOUNDS.W;
    var H = WORLD_BOUNDS.H;
    var wallThickness = 40;

    var wallOptions = {
        isStatic: true,
        restitution: 0,
        friction: 0,
        label: "WALL"
    };

    // Outer boundary walls
    var topWall = Bodies.rectangle(W / 2, wallThickness / 2, W, wallThickness, wallOptions);
    var bottomWall = Bodies.rectangle(W / 2, H - wallThickness / 2, W, wallThickness, wallOptions);
    var leftWall = Bodies.rectangle(wallThickness / 2, H / 2, wallThickness, H, wallOptions);
    var rightWall = Bodies.rectangle(W - wallThickness / 2, H / 2, wallThickness, H, wallOptions);

    // Chicanes
    var chicaneA = Bodies.rectangle(1400, 900, 260, 30, { ...wallOptions, angle: Math.PI / 12 });
    var chicaneB = Bodies.rectangle(1650, 1100, 260, 30, { ...wallOptions, angle: -Math.PI / 12 });

    randomizeTrackLayout_();
    randomizeTurrets_();

    // Create curved barrier bodies
    var curvedBodies = [];
    for (var cb = 0; cb < CURVED_BARRIERS.length; cb++) {
        var c = CURVED_BARRIERS[cb];
        curvedBodies.push(Bodies.rectangle(c.x, c.y, c.w, c.h, { ...wallOptions, angle: c.a }));
    }

    // Start line sensor
    var startSensor = Bodies.rectangle(600, 400, 220, 10, {
        isStatic: true,
        isSensor: true,
        label: "START"
    });

    // Create checkpoint sensors
    var checkpointBodies = [];
    for (var ci = 0; ci < CHECKPOINTS.length; ci++) {
        var cp = CHECKPOINTS[ci];
        checkpointBodies.push(Bodies.circle(cp.x, cp.y, cp.r, {
            isStatic: true,
            isSensor: true,
            label: "CHECK_" + ci
        }));
    }

    // Create turret bodies
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
    ].concat(curvedBodies, checkpointBodies, turretBodies);

    World.add(world, addList);

    var turretState = createTurretState_(TURRETS.length);

    return {
        bounds: { W: W, H: H },
        walls: [topWall, bottomWall, leftWall, rightWall, chicaneA, chicaneB].concat(curvedBodies),
        startSensor: startSensor,
        checkpoints: checkpointBodies,
        turrets: turretBodies,
        turretData: TURRETS,
        turretState: turretState
    };
}

/* ============================================
 * 2) SENSORS AND RACE RULES (CHECKPOINT LOGIC MODIFIED)
 * ============================================
 */
function attachRaceRules(MatterRef, engine, carBodies, callbacks) {
    var Events = MatterRef.Events;

    // --- Build the fast lookup map ---
    var carIdToIndex = {};
    for (var i = 0; i < carBodies.length; i++) {
        var carBody = carBodies[i];
        if (!carBody) continue;
        if (!carBody.label) carBody.label = "CAR" + i;
        carIdToIndex[carBody.id] = i;
    }

    // --- Per-car race state tracking ---
    var numCars = carBodies.length;

    // We now use a bitmask to track which checkpoints are hit.
    // e.g., if CP0 and CP2 are hit, mask = 101 (binary) = 5 (decimal)
    var checkpointMask = new Array(numCars).fill(0);

    // Calculate the "all passed" mask. If there are 6 checkpoints,
    // this will be 111111 (binary) = 63 (decimal).
    var numCheckpoints = Math.max(1, CHECKPOINTS.length);
    var allCheckpointsMask = (1 << numCheckpoints) - 1;

    var startCooldownMs = new Array(numCars).fill(0);
    var penaltyUntil = new Array(numCars).fill(0);
    var lapState = createLapState_(numCars);

    // --- Listen for collision events ---
    Events.on(engine, "collisionStart", function (evt) {
        var pairs = evt.pairs;
        var now = performance.now();

        for (var p = 0; p < pairs.length; p++) {
            var pair = pairs[p];
            var a = pair.bodyA;
            var b = pair.bodyB;
            var carIndex = -1;
            var otherBody = null;

            if (carIdToIndex[a.id] !== undefined) {
                carIndex = carIdToIndex[a.id];
                otherBody = b;
            } else if (carIdToIndex[b.id] !== undefined) {
                carIndex = carIdToIndex[b.id];
                otherBody = a;
            } else {
                continue; // Not a car collision
            }

            var otherLabel = otherBody.label;

            if (otherLabel && otherLabel.startsWith("CHECK_")) {
                var hitIndex = parseInt(otherLabel.split("_")[1], 10);

                // Set the bit for this checkpoint.
                // e.g., if mask is 0001 (CP0) and we hit CP2 (bit 2),
                // 1 << 2 = 0100.
                // 0001 | 0100 = 0101.

                // Only set the bit if it's not already set
                var newHit = (checkpointMask[carIndex] & (1 << hitIndex)) === 0;
                checkpointMask[carIndex] |= (1 << hitIndex);

                // Call the callback every time, regardless of order.
                if (callbacks && typeof callbacks.onCheckpoint === "function") {
                    callbacks.onCheckpoint(carIndex, hitIndex);
                }

                var allPassed = (checkpointMask[carIndex] === allCheckpointsMask);

                // Check if this is single player (numCars === 1), if all CPs are
                // now passed, and if this was the *last* new checkpoint hit.
                if (numCars === 1 && allPassed && newHit) {
                    var lapTimeSec = completeLap_(lapState, carIndex);

                    // Reset the checkpoint mask for the next lap
                    checkpointMask[carIndex] = 0;

                    // Set start cooldown to prevent double-lap triggers
                    startCooldownMs[carIndex] = now + 1000;

                    if (callbacks && typeof callbacks.onLap === "function") {
                        callbacks.onLap(carIndex, lapTimeSec);
                    }
                }

                continue; // Collision handled
            }

            switch (otherLabel) {
                case "START":
                    if (now < startCooldownMs[carIndex]) break;

                    // Check if the car's mask matches the "all passed" mask.
                    var allPassed = (checkpointMask[carIndex] === allCheckpointsMask);

                    // This logic will now primarily apply to 2-player mode,
                    // as single-player mode will reset the mask on the last checkpoint.
                    if (allPassed) {
                        var lapTimeSec = completeLap_(lapState, carIndex);

                        // Reset the checkpoint mask for the next lap
                        checkpointMask[carIndex] = 0;

                        startCooldownMs[carIndex] = now + 1000;
                        if (callbacks && typeof callbacks.onLap === "function") {
                            callbacks.onLap(carIndex, lapTimeSec);
                        }
                    }
                    break;

                case "WALL":
                    penaltyUntil[carIndex] = now + 1000;
                    if (callbacks && typeof callbacks.onWallHit === "function") {
                        callbacks.onWallHit(carIndex);
                    }
                    break;
            }
        }
    });

    // --- Public API ---
    return {
        getLapInfo: function (index) {
            if (index === undefined) index = 0;
            return {
                lap: lapState.lapCount[index],
                lastLap: lapState.lastLap[index],
                bestLap: lapState.bestLap[index],

                // Expose the raw mask so the HUD can
                // draw which checkpoints are active.
                checkpointMask: checkpointMask[index],

                isPenalized: (performance.now() < penaltyUntil[index])
            };
        },

        resetRace: function (index) {
            if (index === undefined) index = 0;

            checkpointMask[index] = 0; // Reset the mask

            startCooldownMs[index] = 0;
            penaltyUntil[index] = 0;
            resetLapState_(lapState, index);
        },

        isPenalized: function (index) {
            if (index === undefined) index = 0;
            return performance.now() < penaltyUntil[index];
        }
    };
}

/* ============================================
 * 3) LAP TIMING
 * ============================================
 */
function createLapState_(carsCount) {
    var now = performance.now();
    return {
        lapCount: new Array(carsCount).fill(0),
        lastLap: new Array(carsCount).fill(0),
        bestLap: new Array(carsCount).fill(0),
        lapStartMs: new Array(carsCount).fill(now)
    };
}

function completeLap_(lapState, index) {
    var now = performance.now();
    var lapTimeSec = (now - lapState.lapStartMs[index]) / 1000;
    lapState.lapStartMs[index] = now;
    lapState.lapCount[index] += 1;
    lapState.lastLap[index] = lapTimeSec;
    if (lapState.bestLap[index] === 0 || lapTimeSec < lapState.bestLap[index]) {
        lapState.bestLap[index] = lapTimeSec;
    }
    return lapTimeSec;
}

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
 * 12b) TURRET STATE & UPDATE SYSTEM (PERFORMANCE OPTIMIZED)
 * ============================================
 */
function createTurretState_(turretCount) {
    // This state no longer needs to track its own particles,
    // as that is handled by the global pool in sketch.js.
    return {
        activeSprays: new Array(turretCount).fill(false),
        sprayEndTime: new Array(turretCount).fill(0),
        carsInTrigger: new Array(turretCount).fill(false),
        glowIntensity: new Array(turretCount).fill(0)
    };
}

/* ============================================
 * TURRET UPDATE LOGIC (PERFORMANCE OPTIMIZED)
 * ============================================
 */
function updateTurrets_(turretState, turretData, turretBodies, carBodies, MatterRef, borrowParticle) {
    var now = performance.now();

    for (var i = 0; i < turretData.length; i++) {
        var tur = turretData[i];
        var turBody = turretBodies[i];
        if (!tur || !turBody) continue;

        var turX = turBody.position.x;
        var turY = turBody.position.y;
        var triggerRadius = tur.triggerRadius || TURRET_CONFIG.triggerRadius;
        var forceRadius = tur.range || TURRET_CONFIG.forceRadius;
        var hasCarInTrigger = false;

        var carsInForceRange = []; // Collect cars to apply force to

        // --- Single Combined Loop ---
        // Check ALL cars against this ONE turret
        for (var c = 0; c < carBodies.length; c++) {
            var car = carBodies[c];
            if (!car || !car.position) continue;

            var carX = car.position.x;
            var carY = car.position.y;
            var dx = carX - turX;
            var dy = carY - turY;
            var dist = Math.hypot(dx, dy);

            if (dist <= triggerRadius && dist > 0) {
                hasCarInTrigger = true;
            }
            if (dist <= forceRadius && dist > 0) {
                carsInForceRange.push({ car: car, dx: dx, dy: dy, dist: dist });
            }
        }

        var wasInTrigger = turretState.carsInTrigger[i];
        turretState.carsInTrigger[i] = hasCarInTrigger;

        // Start spray when car first enters
        if (hasCarInTrigger && !wasInTrigger && !turretState.activeSprays[i]) {
            turretState.activeSprays[i] = true;
            turretState.sprayEndTime[i] = now + 1000;
            turretState.glowIntensity[i] = 1.0;

            if (typeof borrowParticle === 'function') {
                for (var p = 0; p < 5; p++) {
                    var randomAngle = Math.random() * Math.PI * 2;
                    var speed = 2 + Math.random() * 3;
                    var sprayRadius = tur.sprayRadius || TURRET_CONFIG.sprayRadius;

                    // We calculate a velocity (vx, vy) for the particle pool,
                    // which expects velocity instead of target (tx, ty).
                    borrowParticle(
                        turX, // x
                        turY, // y
                        Math.cos(randomAngle) * speed, // vx
                        Math.sin(randomAngle) * speed, // vy
                        40,    // lifetime
                        '#ADD8E6' // particle color (light blue for water)
                    );
                }
            } else {
                console.warn("updateTurrets: 'borrowParticle' function not provided.");
            }
        }

        // If spraying, apply forces
        if (turretState.activeSprays[i] && now < turretState.sprayEndTime[i]) {

            // Apply forces to all cars found in range
            for (var c = 0; c < carsInForceRange.length; c++) {
                var hit = carsInForceRange[c];
                var car = hit.car;

                var dirX = hit.dx / hit.dist;
                var dirY = hit.dy / hit.dist;

                // Reverse direction to push car AWAY
                var pushDirX = -dirX;
                var pushDirY = -dirY;

                var forceScale = Math.max(0.35, 1.0 - (hit.dist / forceRadius));
                var pushForce = 0.08 * forceScale;

                Matter.Body.applyForce(car, car.position, {
                    x: pushDirX * pushForce,
                    y: pushDirY * pushForce
                });
            }

            // Update glow fade during spray
            var sprayProgress = (now - (turretState.sprayEndTime[i] - 1000)) / 1000;
            turretState.glowIntensity[i] = Math.max(0, 1.0 - sprayProgress * 0.5);

        } else if (turretState.activeSprays[i] && now >= turretState.sprayEndTime[i]) {
            // Spray ended
            turretState.activeSprays[i] = false;
            turretState.glowIntensity[i] = 0;
        } else if (!hasCarInTrigger) {
            // No cars, fade glow
            turretState.glowIntensity[i] = Math.max(0, turretState.glowIntensity[i] - 0.05);
        }
    }

    return turretState;
}

// Public wrapper to update turrets (called from sketch.js)
function updateTurrets(turretState, turretData, turretBodies, carBodies, MatterRef, borrowParticle) {
    return updateTurrets_(turretState, turretData, turretBodies, carBodies, MatterRef, borrowParticle);
}

/* ============================================
 * DEBUG DRAWING HELPERS
 * ============================================
 */
function drawStartAndCheckpointDebug() {
    push();
    noFill();
    stroke(255, 255, 0);
    strokeWeight(2);
    rectMode(CENTER);
    rect(600, 400, 220, 10);
    stroke(0, 200, 255);
    for (var i = 0; i < CHECKPOINTS.length; i++) {
        circle(CHECKPOINTS[i].x, CHECKPOINTS[i].y, CHECKPOINTS[i].r * 2);
    }
    pop();
}

/* ============================================
 * 11) OPTIONAL JSON ARENA LOADER
 * ============================================
 */
function loadArenaFromJSON(data, MatterRef, world) {
    var Bodies = MatterRef.Bodies;
    var World = MatterRef.World;
    var addList = [];

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

    if (addList.length) World.add(world, addList);
}


