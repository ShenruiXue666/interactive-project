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
     { x: 2100, y: 1500, r: 35 } // CP0 (you can add more later)
     // Example to add more:
     // { x: 2500, y: 1200, r: 35 }, { x: 2600, y: 800, r: 35 }
   ];
   
   /* ------------------------------------------------------------
      8) CURVED BARRIERS (extra walls) (new)
      Short rotated rectangles approximate curves for drift flow
   ------------------------------------------------------------- */
   var CURVED_BARRIERS = [
     // centerX, centerY, width, height, angleRadians
     { x: 1200, y: 800,  w: 160, h: 24, a:  0.20 },
     { x: 1280, y: 860,  w: 160, h: 24, a:  0.05 },
     { x: 1360, y: 920,  w: 160, h: 24, a: -0.10 }
   ];
   
   /* ------------------------------------------------------------
      10) OPTIONAL SURFACE PADS (new)
      Boost and grip sensors. If used, they fire onPad callback.
   ------------------------------------------------------------- */
   var BOOST_PADS = [
     // { x: 1000, y: 700, w: 140, h: 30 }
   ];
   var GRIP_PADS = [
     // { x: 1800, y: 1300, w: 200, h: 40 }
   ];
   
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
   
     var addList = [
       topWall, bottomWall, leftWall, rightWall,
       chicaneA, chicaneB, startSensor
     ].concat(curvedBodies, checkpointBodies, boostBodies, gripBodies);
   
     World.add(world, addList);
   
     return {
       bounds: { W: W, H: H },
       walls: [topWall, bottomWall, leftWall, rightWall, chicaneA, chicaneB].concat(curvedBodies),
       startSensor: startSensor,
       checkpoints: checkpointBodies,
       boostPads: boostBodies,
       gripPads: gripBodies
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
   
         for (var idx = 0; idx < carBodies.length; idx++) {
           var carLabel = carBodies[idx].label;
   
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
             var hitIndex = parseInt(otherLabel.split("_")[1], 10);
             if (hitIndex === nextCheckpointIndex[idx]) {
               // correct checkpoint in order
               nextCheckpointIndex[idx] = (nextCheckpointIndex[idx] + 1) % Math.max(1, CHECKPOINTS.length);
               passedCheckpoint[idx] = true; // keep legacy flag so older UI logic still works
               if (callbacks && typeof callbacks.onCheckpoint === "function") {
                 callbacks.onCheckpoint(idx, hitIndex);
               }
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
   
