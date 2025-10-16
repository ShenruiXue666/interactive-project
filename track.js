/* 
   File: track.js
   Role: Person B
   Parts:
     0) World bounds
     1) Arena construction
     2) Sensors and race rules
     3) Lap timing
     4) World offset support helpers
   Notes:
     -  p5 + Matter style
     - Callbacks expected from sketch.js:
         onCheckpoint(carIndex, checkpointIndex)
         onLap(carIndex, lapTimeSeconds)
         onWallHit(carIndex) */

/* 0) WORLD BOUNDS
   Used by camera and HUD to know the world size */
   var WORLD_BOUNDS = { W: 3000, H: 2000 };

   /* 1) ARENA CONSTRUCTION
      Builds outer walls, two chicanes, start sensor, checkpoint sensor
      Adds all bodies to Matter world
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
   
     // Start line sensor
     var startSensor = Bodies.rectangle(600, 400, 220, 10, {
       isStatic: true, isSensor: true, label: "START"
     });
   
     // Single checkpoint sensor
     var checkpoint = Bodies.circle(2100, 1500, 35, {
       isStatic: true, isSensor: true, label: "CHECK"
     });
   
     World.add(world, [
       topWall, bottomWall, leftWall, rightWall,
       chicaneA, chicaneB,
       startSensor, checkpoint
     ]);
   
     return {
       bounds: { W: W, H: H },
       walls: [topWall, bottomWall, leftWall, rightWall, chicaneA, chicaneB],
       startSensor: startSensor,
       checkpoint: checkpoint
     };
   }
   
   /* 2) SENSORS AND RACE RULES
      Wires collision events for cars against CHECK, START, and WALL
      Sets a per car flag for checkpoint pass, and fires callbacks */

   function attachRaceRules(MatterRef, engine, carBodies, callbacks) {
     var Events = MatterRef.Events;
   
     // Ensure car labels exist so collision checks work
     for (var i = 0; i < carBodies.length; i++) {
       if (!carBodies[i].label) carBodies[i].label = "CAR" + i;
     }
   
     // Per car race state
     var passedCheckpoint = new Array(carBodies.length).fill(false);
   
     // Lap timing state is defined in Part 3 below
     var lapState = createLapState_(carBodies.length);
   
     Events.on(engine, "collisionStart", function(evt) {
       var pairs = evt.pairs;
   
       for (var p = 0; p < pairs.length; p++) {
         var a = pairs[p].bodyA;
         var b = pairs[p].bodyB;
   
         for (var idx = 0; idx < carBodies.length; idx++) {
           var carLabel = carBodies[idx].label;
   
           // Checkpoint touch
           if ((a.label === carLabel && b.label === "CHECK") ||
               (b.label === carLabel && a.label === "CHECK")) {
             passedCheckpoint[idx] = true;
             if (callbacks && typeof callbacks.onCheckpoint === "function") {
               callbacks.onCheckpoint(idx, 0);
             }
           }
   
           // Start line cross
           if ((a.label === carLabel && b.label === "START") ||
               (b.label === carLabel && a.label === "START")) {
             // Only count lap if checkpoint was passed since last start
             if (passedCheckpoint[idx]) {
               var lapTimeSec = completeLap_(lapState, idx); // Part 3 handles timing
               passedCheckpoint[idx] = false;
               if (callbacks && typeof callbacks.onLap === "function") {
                 callbacks.onLap(idx, lapTimeSec);
               }
             }
           }
   
           // Wall hit penalty
           if ((a.label === carLabel && b.label === "WALL") ||
               (b.label === carLabel && a.label === "WALL")) {
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
           passedCheckpoint: passedCheckpoint[index]
         };
       },
       resetRace: function(index) {
         if (index === undefined) index = 0;
         passedCheckpoint[index] = false;
         resetLapState_(lapState, index);
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
   
   /* 4) WORLD OFFSET SUPPORT HELPERS
      These are simple getters Person C can call if needed */

   function getWorldBounds() { return { W: WORLD_BOUNDS.W, H: WORLD_BOUNDS.H }; }
   
   /* debug drawing helpers
      Call from draw() while camera is applied if you want outlines */

   function drawStartAndCheckpointDebug() {
     push();
     noFill();
     stroke(255, 255, 0);
     strokeWeight(2);
     // Start line rectangle for reference
     rectMode(CENTER);
     rect(600, 400, 220, 10);
     // Checkpoint circle for reference
     stroke(0, 200, 255);
     circle(2100, 1500, 35 * 2);
     pop();
   }
   