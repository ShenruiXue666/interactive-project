/* 
   File: track.js
   Role: Person B 
   Parts:
     0) World bounds
     1) Arena construction
     2) Sensors and race rules
     3) Lap timing
     4) World helpers
     5) Start positions + reset helper    
     6) Multiple checkpoints in order      
     7) Start-line cooldown                
     8) Curved barriers (extra walls)     
     9) Penalty timer API                  
    10) Optional pads (boost/grip)         
    11) Optional JSON arena loader         
   Notes:
     - p5 + Matter style
     - Callbacks expected from sketch.js:
         onCheckpoint(carIndex, checkpointIndex)
         onLap(carIndex, lapTimeSeconds)
         onWallHit(carIndex)
         onPad(carIndex, type)            // optional if your team wants pads
*/

/* 0) WORLD BOUNDS
   Used by camera and HUD to know the world size */
   var WORLD_BOUNDS = { W: 3000, H: 2000 };

   /* ------------------------------------------------------------
      5) START POSITIONS + RESET HELPER (new)
      Deterministic spawn for single or two players
      Person C can read or call resetToStart
   ------------------------------------------------------------- */
   var START_POSITIONS = [
     { x: 600, y: 500, angle: 0 },   // P1
     { x: 640, y: 500, angle: 0 }    // P2
   ];
   function getStartPositions() { return START_POSITIONS.slice(); }
   function resetToStart(carBody, index) {
     var sp = START_POSITIONS[index % START_POSITIONS.length];
     Matter.Body.setPosition(carBody, { x: sp.x, y: sp.y });
     Matter.Body.setAngle(carBody, sp.angle);
     Matter.Body.setVelocity(carBody, { x: 0, y: 0 });
     Matter.Body.setAngularVelocity(carBody, 0);
   }
   
   /* ------------------------------------------------------------
      6) MULTIPLE CHECKPOINTS IN ORDER (new)
      Lap counts only if checkpoints are touched in order
      Define as data. buildTrack will create a sensor for each.
   ------------------------------------------------------------- */
   var CHECKPOINTS = [
     // Scattered checkpoints for a proper racing circuit (avoiding obstacles)
     { x: 2100, y: 1500, r: 35 },  // CP0 - Bottom-right
     { x: 2500, y: 1200, r: 35 },  // CP1 - Top-right
     { x: 2000, y: 600, r: 35 },   // CP2 - Top-center
     { x: 1000, y: 300, r: 35 },   // CP3 - Top-left (moved away from obstacle)
     { x: 400, y: 1000, r: 35 },   // CP4 - Middle-left (moved away from obstacle)
     { x: 1100, y: 1600, r: 35 }   // CP5 - Bottom-left (moved away from obstacle)
   ];
  
  // Person B: randomization config (kept simple and deterministic bounds)
  var RANDOMIZATION = {
    enable: true,
    checkpointCount: 6,
    checkpointRadius: 35,
    checkpointMinSpacing: 320, // enforce min distance between checkpoints
    obstacleCount: 9, // match CURVED_BARRIERS default length
    obstacleSize: { wMin: 100, wMax: 160, hMin: 18, hMax: 26 },
    obstacleAngleMax: 0.4,
    margin: 60,       // keep away from outer walls
    maxAttempts: 2000 // while-loop guard per set
  };
  
  // Helper: pick random number in [a, b]
  function randRange(a, b) { return a + Math.random() * (b - a); }
  
  // Helper: circle-circle overlap
  function circlesOverlap(ax, ay, ar, bx, by, br) {
    var dx = ax - bx; var dy = ay - by; var r = ar + br; return (dx * dx + dy * dy) < (r * r);
  }
  
  // Helper: circle-rect overlap (rect centered, rotated)
  function circleRectOverlap(cx, cy, cr, rx, ry, rw, rh, ra) {
    // Transform circle into rectangle's local space by inverse rotation
    var cosA = Math.cos(-ra), sinA = Math.sin(-ra);
    var lx = cosA * (cx - rx) - sinA * (cy - ry);
    var ly = sinA * (cx - rx) + cosA * (cy - ry);
    var hw = rw / 2, hh = rh / 2;
    // Closest point on AABB to circle center
    var closestX = Math.max(-hw, Math.min(lx, hw));
    var closestY = Math.max(-hh, Math.min(ly, hh));
    var dx = lx - closestX, dy = ly - closestY;
    return (dx * dx + dy * dy) < (cr * cr);
  }
  
  // Helper: rect-rect overlap (both centered, rotated). Cheap SAT with only two axes (of A);
  // adequate for small thin obstacles. We keep conservative.
  function rectsOverlap(ax, ay, aw, ah, aa, bx, by, bw, bh, ba) {
    function getCorners(x, y, w, h, a) {
      var hw = w / 2, hh = h / 2;
      var c = Math.cos(a), s = Math.sin(a);
      return [
        { x: x + c * (-hw) - s * (-hh), y: y + s * (-hw) + c * (-hh) },
        { x: x + c * ( hw) - s * (-hh), y: y + s * ( hw) + c * (-hh) },
        { x: x + c * ( hw) - s * ( hh), y: y + s * ( hw) + c * ( hh) },
        { x: x + c * (-hw) - s * ( hh), y: y + s * (-hw) + c * ( hh) }
      ];
    }
    function project(poly, ax, ay) {
      var min = Infinity, max = -Infinity;
      for (var i = 0; i < poly.length; i++) {
        var p = poly[i];
        var dot = p.x * ax + p.y * ay;
        if (dot < min) min = dot;
        if (dot > max) max = dot;
      }
      return { min: min, max: max };
    }
    function overlapOnAxis(pa, pb) { return !(pa.max < pb.min || pb.max < pa.min); }
    var A = getCorners(ax, ay, aw, ah, aa);
    var B = getCorners(bx, by, bw, bh, ba);
    // Axes = normals of A's edges (2 unique for rectangle)
    var axes = [
      { x: A[1].x - A[0].x, y: A[1].y - A[0].y },
      { x: A[3].x - A[0].x, y: A[3].y - A[0].y }
    ];
    for (var k = 0; k < axes.length; k++) {
      var axv = axes[k];
      var len = Math.hypot(axv.x, axv.y) || 1;
      var nx = axv.x / len, ny = axv.y / len; // axis unit
      var pa = project(A, nx, ny), pb = project(B, nx, ny);
      if (!overlapOnAxis(pa, pb)) return false;
    }
    return true;
  }
  
  // Person B: Randomize obstacles first, then checkpoints with spacing and no-overlap
  function randomizeTrackLayout_() {
    if (!RANDOMIZATION.enable) return;
    var W = WORLD_BOUNDS.W, H = WORLD_BOUNDS.H, M = RANDOMIZATION.margin;
    // 1) Obstacles: free-form rectangles scattered around (no need to avoid checkpoints yet)
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
      // avoid with existing obstacles
      if (okO) {
        for (var j = 0; j < obs.length; j++) {
          var o = obs[j];
          if (rectsOverlap(ox, oy, ow, oh, oa, o.x, o.y, o.w, o.h, o.a)) { okO = false; break; }
        }
      }
      if (okO) obs.push({ x: ox, y: oy, w: ow, h: oh, a: oa });
    }
    if (obs.length === RANDOMIZATION.obstacleCount) CURVED_BARRIERS = obs;

    // 2) Checkpoints: enforce min spacing and avoid obstacles
    var cps = [];
    attempts = 0;
    while (cps.length < RANDOMIZATION.checkpointCount && attempts < RANDOMIZATION.maxAttempts) {
      attempts++;
      var cx = randRange(M, W - M);
      var cy = randRange(M, H - M);
      var ok = true;
      // keep checkpoints separated by a minimum spacing
      for (var i = 0; i < cps.length; i++) {
        var dx = cx - cps[i].x; var dy = cy - cps[i].y;
        if ((dx * dx + dy * dy) < (RANDOMIZATION.checkpointMinSpacing * RANDOMIZATION.checkpointMinSpacing)) {
          ok = false; break;
        }
      }
      // avoid overlapping any obstacle (approximate by circle-rect test)
      if (ok) {
        for (var k = 0; k < CURVED_BARRIERS.length; k++) {
          var o2 = CURVED_BARRIERS[k];
          if (circleRectOverlap(cx, cy, RANDOMIZATION.checkpointRadius * 1.2, o2.x, o2.y, o2.w, o2.h, o2.a)) {
            ok = false; break;
          }
        }
      }
      if (ok) cps.push({ x: cx, y: cy, r: RANDOMIZATION.checkpointRadius });
    }
    if (cps.length === RANDOMIZATION.checkpointCount) CHECKPOINTS = cps;
  }
   
   /* ------------------------------------------------------------
      8) CURVED BARRIERS (extra walls) (new)
      Short rotated rectangles approximate curves for drift flow
   ------------------------------------------------------------- */
   var CURVED_BARRIERS = [
     // centerX, centerY, width, height, angleRadians
     // Scattered obstacles across the track for better gameplay
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
   
   /* ------------------------------------------------------------
      10) OPTIONAL SURFACE PADS (new)
      Boost and grip sensors. If used, they fire onPad callback.
   ------------------------------------------------------------- */
   var BOOST_PADS = [
     // Scattered boost pads for speed boosts
     { x: 1000, y: 600, w: 140, h: 30 },   // Top area
     { x: 1600, y: 1200, w: 120, h: 25 },  // Middle area
     { x: 2200, y: 1000, w: 130, h: 28 }   // Right area
   ];
   var GRIP_PADS = [
     // Scattered grip pads for better traction
     { x: 700, y: 1200, w: 180, h: 35 },   // Left area
     { x: 1900, y: 600, w: 160, h: 32 },   // Top-right area
     { x: 1400, y: 1600, w: 200, h: 40 }   // Bottom area
   ];
   
   /* ------------------------------------------------------------
      12) TURRET SYSTEM (new)
      Static turrets that spray water pressure to push cars away
      Person B: Turret system for challenging gameplay
      - Multiple turrets (4-6) placed with spacing
      - Push cars away when they enter trigger radius
      - Random spray directions for visual effect
   ------------------------------------------------------------- */
   var TURRET_CONFIG = {
     count: 8,                    // Number of turrets - increased for better coverage
     triggerRadius: 450,          // Small inner radius for activation/reactivation - easy to exit/re-enter (400-500px)
     forceRadius: 1100,            // Large outer radius for push force - affects cars far away (1000-1200px)
     sprayRadius: 120,            // Visual spray radius (wider for visibility)
     minSpacing: 750,            // Minimum distance between turrets - ensures even spacing (700-800px)
     margin: 80                   // Keep away from world edges
   };
   
   var TURRETS = []; // Will be populated by randomizeTurrets_()
   
   // Person B: Randomize turret placement with spacing constraints
   function randomizeTurrets_() {
     var W = WORLD_BOUNDS.W, H = WORLD_BOUNDS.H, M = TURRET_CONFIG.margin;
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
           angle: 0, // Not used for force direction, but for visual
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
   
   /* 1) ARENA CONSTRUCTION
      Builds outer walls, chicanes, start sensor, ordered checkpoints,
      curved barriers, optional pads. Adds all to Matter world.
      Returns references for optional debug draw  */
   function buildTrack(MatterRef, world) {
     var Bodies = MatterRef.Bodies;
     var World  = MatterRef.World;
   
     var W = WORLD_BOUNDS.W;
     var H = WORLD_BOUNDS.H;
     var wallThickness = 40;
   
     var wallOptions = {
       isStatic: true,
       restitution: 0,
       friction: 0,
       label: "WALL"
     };
   
     // Outer walls
     var topWall    = Bodies.rectangle(W / 2, wallThickness / 2, W, wallThickness, wallOptions);
     var bottomWall = Bodies.rectangle(W / 2, H - wallThickness / 2, W, wallThickness, wallOptions);
     var leftWall   = Bodies.rectangle(wallThickness / 2, H / 2, wallThickness, H, wallOptions);
     var rightWall  = Bodies.rectangle(W - wallThickness / 2, H / 2, wallThickness, H, wallOptions);
   
     // Chicanes to create S-curve drift path
     var chicaneA = Bodies.rectangle(1400, 900, 260, 30, {
       isStatic: true, restitution: 0, friction: 0, label: "WALL", angle: Math.PI / 12
     });
     var chicaneB = Bodies.rectangle(1650, 1100, 260, 30, {
       isStatic: true, restitution: 0, friction: 0, label: "WALL", angle: -Math.PI / 12
     });
   
    // Randomize layout before creating bodies (Person B requirement)
    randomizeTrackLayout_();
    
    // Person B: Randomize turret placement (after checkpoints/obstacles are placed)
    randomizeTurrets_();

    // Extra curved barriers (new)
     var curvedBodies = [];
     for (var cb = 0; cb < CURVED_BARRIERS.length; cb++) {
       var c = CURVED_BARRIERS[cb];
       curvedBodies.push(Bodies.rectangle(c.x, c.y, c.w, c.h, {
         isStatic: true, restitution: 0, friction: 0, label: "WALL", angle: c.a
       }));
     }
   
     // Start line sensor
     var startSensor = Bodies.rectangle(600, 400, 220, 10, {
       isStatic: true, isSensor: true, label: "START"
     });
   
     // Multiple checkpoint sensors (ordered)
     var checkpointBodies = [];
     for (var ci = 0; ci < CHECKPOINTS.length; ci++) {
       var cp = CHECKPOINTS[ci];
       checkpointBodies.push(Bodies.circle(cp.x, cp.y, cp.r, {
         isStatic: true, isSensor: true, label: "CHECK_" + ci
       }));
     }
   
     // Optional pads
     var boostBodies = [];
     for (var bi = 0; bi < BOOST_PADS.length; bi++) {
       var bp = BOOST_PADS[bi];
       boostBodies.push(Bodies.rectangle(bp.x, bp.y, bp.w, bp.h, {
         isStatic: true, isSensor: true, label: "BOOST_PAD"
       }));
     }
     var gripBodies = [];
     for (var gi = 0; gi < GRIP_PADS.length; gi++) {
       var gp = GRIP_PADS[gi];
       gripBodies.push(Bodies.rectangle(gp.x, gp.y, gp.w, gp.h, {
         isStatic: true, isSensor: true, label: "GRIP_PAD"
       }));
     }
   
     // Person B: Create turret bodies (static emitters)
     var turretBodies = [];
     for (var ti = 0; ti < TURRETS.length; ti++) {
       var tur = TURRETS[ti];
       turretBodies.push(Bodies.rectangle(tur.x, tur.y, 40, 40, {
         isStatic: true, restitution: 0, friction: 0, label: "TURRET_" + ti, angle: tur.angle
       }));
     }
   
     var addList = [
       topWall, bottomWall, leftWall, rightWall,
       chicaneA, chicaneB, startSensor
     ].concat(curvedBodies, checkpointBodies, boostBodies, gripBodies, turretBodies);
   
     World.add(world, addList);
   
     // Person B: Initialize turret spray state (timers, active sprays)
     var turretState = createTurretState_(TURRETS.length);
   
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
   
   /* 2) SENSORS AND RACE RULES
      Wires collision events for cars against ordered CHECK_i, START, WALL,
      pads. Keeps per car flags and fires callbacks. */
   function attachRaceRules(MatterRef, engine, carBodies, callbacks) {
     var Events = MatterRef.Events;
   
     // Ensure car labels exist
     for (var i = 0; i < carBodies.length; i++) {
       if (!carBodies[i].label) carBodies[i].label = "CAR" + i;
     }
   
     // Per car race state
     var passedCheckpoint = new Array(carBodies.length).fill(false); // legacy single cp flag
     var nextCheckpointIndex = new Array(carBodies.length).fill(0);  // ordered checkpoints (new)
   
     // 7) Start-line cooldown (new)
     var startCooldownMs = new Array(carBodies.length).fill(0);
   
     // 9) Penalty timer (new)
     var penaltyUntil = new Array(carBodies.length).fill(0);
   
     // Lap timing state defined in Part 3
     var lapState = createLapState_(carBodies.length);
   
     Events.on(engine, "collisionStart", function(evt) {
       var pairs = evt.pairs;
       var now = performance.now();
   
       for (var p = 0; p < pairs.length; p++) {
         var a = pairs[p].bodyA;
         var b = pairs[p].bodyB;
         
         // Debug: Log all collisions involving cars (reduced logging)
         // if (a.label && a.label.indexOf("CAR") === 0) {
         //   console.log("🚗 Car collision:", a.label, "with", b.label);
         // }
         // if (b.label && b.label.indexOf("CAR") === 0) {
         //   console.log("🚗 Car collision:", b.label, "with", a.label);
         // }
   
         for (var idx = 0; idx < carBodies.length; idx++) {
           var carLabel = carBodies[idx].label;
          // Process only if this collision pair actually involves this car
          var involvesThisCar = (a.label === carLabel || b.label === carLabel);
          if (!involvesThisCar) continue;
   
           // Pads (optional)
           if ((a.label === carLabel && b.label === "BOOST_PAD") ||
               (b.label === carLabel && a.label === "BOOST_PAD")) {
             if (callbacks && typeof callbacks.onPad === "function") callbacks.onPad(idx, "boost");
           }
           if ((a.label === carLabel && b.label === "GRIP_PAD") ||
               (b.label === carLabel && a.label === "GRIP_PAD")) {
             if (callbacks && typeof callbacks.onPad === "function") callbacks.onPad(idx, "grip");
           }
   
           // Ordered checkpoint touch (CHECK_0, CHECK_1, ...)
           // If you have only one checkpoint, this still works at index 0
           var otherLabel = (a.label === carLabel) ? b.label : a.label;
           if (otherLabel && otherLabel.indexOf("CHECK_") === 0) {
             console.log("🚗 Car", carLabel, "collided with", otherLabel);
             var hitIndex = parseInt(otherLabel.split("_")[1], 10);
             console.log("🎯 Hit checkpoint", hitIndex, "expected", nextCheckpointIndex[idx]);
             if (hitIndex === nextCheckpointIndex[idx]) {
               // correct checkpoint in order
               console.log("✅ CORRECT CHECKPOINT ORDER!");
               nextCheckpointIndex[idx] = (nextCheckpointIndex[idx] + 1) % Math.max(1, CHECKPOINTS.length);
               passedCheckpoint[idx] = true; // keep legacy flag so older UI logic still works
               if (callbacks && typeof callbacks.onCheckpoint === "function") {
                 callbacks.onCheckpoint(idx, hitIndex);
               }
             } else {
               console.log("❌ Wrong checkpoint order - expected", nextCheckpointIndex[idx], "got", hitIndex);
             }
           }
   
           // Start line cross with cooldown and order requirement
           if (((a.label === carLabel && b.label === "START") ||
                (b.label === carLabel && a.label === "START"))) {
   
             // Ignore if in cooldown
             if (now < startCooldownMs[idx]) continue;
   
             var cps = Math.max(1, CHECKPOINTS.length);
             var allPassed = (cps === 1) ? passedCheckpoint[idx]
                                         : (nextCheckpointIndex[idx] === 0 && passedCheckpoint[idx]);
             if (allPassed) {
               var lapTimeSec = completeLap_(lapState, idx);
               passedCheckpoint[idx] = false;
               // set cooldown to 1s
               startCooldownMs[idx] = now + 1000;
               if (callbacks && typeof callbacks.onLap === "function") {
                 callbacks.onLap(idx, lapTimeSec);
               }
             }
           }
   
           // Wall hit penalty
           if ((a.label === carLabel && b.label === "WALL") ||
               (b.label === carLabel && a.label === "WALL")) {
             // penalty timer starts (1s)
             penaltyUntil[idx] = now + 1000;
             if (callbacks && typeof callbacks.onWallHit === "function") {
               callbacks.onWallHit(idx);
             }
           }
         }
       }
     });
   
     // Public helpers for HUD or debugging
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
   
   /* 3) LAP TIMING
      Uses performance.now to time each lap between valid START crossings
      Keeps per car arrays for lapCount, lastLap, bestLap, lapStartMs */
   function createLapState_(carsCount) {
     var now = performance.now();
     return {
       lapCount: new Array(carsCount).fill(0),
       lastLap:  new Array(carsCount).fill(0),
       bestLap:  new Array(carsCount).fill(0),
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
   
   /* 4) WORLD HELPERS */
   function getWorldBounds() { return { W: WORLD_BOUNDS.W, H: WORLD_BOUNDS.H }; }
   
   /* ------------------------------------------------------------
      12b) TURRET STATE & UPDATE (new)
      Person B: Manages turret spray timing and applies forces to cars
   ------------------------------------------------------------- */
   function createTurretState_(turretCount) {
     var now = performance.now();
     return {
       activeSprays: new Array(turretCount).fill(false),
       sprayEndTime: new Array(turretCount).fill(0),
       particles: [], // Array of particle arrays for each turret
       carsInTrigger: new Array(turretCount).fill(false), // Track if any car is in trigger radius
       glowIntensity: new Array(turretCount).fill(0) // Pulsing glow (0-1)
     };
   }
   
   // Person B: Update turret spray logic and apply forces to cars in range
   // Turrets only activate when cars enter trigger radius, push cars away, spray randomly
   function updateTurrets_(turretState, turretData, turretBodies, carBodies, MatterRef) {
     var now = performance.now();
     var Bodies = MatterRef.Bodies;
     
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
       // Works for both single-player and two-player modes - checks all cars equally
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
         // Apply forces to ALL cars in force range (both players affected equally)
         for (var c = 0; c < carBodies.length; c++) {
           var car = carBodies[c];
           if (!car || !car.position) continue;
           
           var carX = car.position.x;
           var carY = car.position.y;
           
           // Vector from turret to car
           var dx = carX - turX;
           var dy = carY - turY;
           var dist = Math.hypot(dx, dy);
           
           // Check if car is in force application range (both players checked equally)
           if (dist <= forceRadius && dist > 0) {
             // Normalize the vector from turret to car
             var len = dist;
             var dirX = dx / len;
             var dirY = dy / len;
             
             // Reverse direction to push car AWAY from turret
             var pushDirX = -dirX;
             var pushDirY = -dirY;
             
             // Scale force by distance (closer = stronger push, but still noticeable at long range)
             // Expanded radius: maintain consistent feel across longer distances
             var forceScale = Math.max(0.35, 1.0 - (dist / forceRadius)); // 35% minimum at max range for longer distances
             var pushForce = 0.08 * forceScale; // Base force increased for more noticeable push impact
             
             // Apply force pushing car away from turret
             Matter.Body.applyForce(car, car.position, {
               x: pushDirX * pushForce,
               y: pushDirY * pushForce
             });
           }
         }
         
         // Update particle positions and lifetimes for visual
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
         // No cars in trigger, fade glow
         turretState.glowIntensity[i] = Math.max(0, turretState.glowIntensity[i] - 0.05);
       }
     }
     
     return turretState;
   }
   
   // Person B: Public wrapper to update turrets (called from sketch.js)
   function updateTurrets(turretState, turretData, turretBodies, carBodies, MatterRef) {
     return updateTurrets_(turretState, turretData, turretBodies, carBodies, MatterRef);
   }
   
   /* debug drawing helpers
      Draws the real start line and all checkpoints created by buildTrack */
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
   
    // 11) OPTIONAL JSON ARENA LOADER
      /* Create walls, checkpoints, and pads from a plain JS object.
      You can call this instead of or in addition to buildTrack if needed.
      Example shape of data: 
      {
        "walls":[{"x":1200,"y":850,"w":160,"h":24,"a":0.1}],
        "checkpoints":[{"x":2100,"y":1500,"r":35}],
        "pads":{"boost":[{"x":1000,"y":700,"w":140,"h":30}],
                "grip":[{"x":1800,"y":1300,"w":200,"h":40}]}
      }
        */
   
   function loadArenaFromJSON(data, MatterRef, world) {
     var Bodies = MatterRef.Bodies;
     var World  = MatterRef.World;
   
     var addList = [];
   
     if (data.walls && data.walls.length) {
       for (var i = 0; i < data.walls.length; i++) {
         var w = data.walls[i];
         addList.push(Bodies.rectangle(w.x, w.y, w.w, w.h, {
           isStatic: true, restitution: 0, friction: 0, label: "WALL", angle: w.a || 0
         }));
       }
     }
     if (data.checkpoints && data.checkpoints.length) {
       // also update in-memory list so draw debug shows them
       CHECKPOINTS = [];
       for (var c = 0; c < data.checkpoints.length; c++) {
         var cp = data.checkpoints[c];
         CHECKPOINTS.push({ x: cp.x, y: cp.y, r: cp.r });
         addList.push(Bodies.circle(cp.x, cp.y, cp.r, {
           isStatic: true, isSensor: true, label: "CHECK_" + c
         }));
       }
     }
     if (data.pads) {
       if (data.pads.boost && data.pads.boost.length) {
         for (var b = 0; b < data.pads.boost.length; b++) {
           var bp = data.pads.boost[b];
           addList.push(Bodies.rectangle(bp.x, bp.y, bp.w, bp.h, {
             isStatic: true, isSensor: true, label: "BOOST_PAD"
           }));
         }
       }
       if (data.pads.grip && data.pads.grip.length) {
         for (var g = 0; g < data.pads.grip.length; g++) {
           var gp = data.pads.grip[g];
           addList.push(Bodies.rectangle(gp.x, gp.y, gp.w, gp.h, {
             isStatic: true, isSensor: true, label: "GRIP_PAD"
           }));
         }
       }
     }
   
     if (addList.length) World.add(world, addList);
   }
   
