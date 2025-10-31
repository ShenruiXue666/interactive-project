/**
 * Car Physics and Controls
 * Person A - Vehicle Physics Implementation
 */

function wrapPi(a) {
    // Robust wrap to [-PI, PI]
    return Math.atan2(Math.sin(a), Math.cos(a));
}

class Car {
    constructor(x, y, engine, world, controlKeys) {
        // Physics properties
        this.body = Matter.Bodies.rectangle(x, y, 50, 30, {
            density: 0.03,
            frictionAir: 0.05,
            restitution: 0.5
        });

        Matter.World.add(world, this.body);

        // Car properties
        this.maxSpeed = 40;
        this.maxCollisionSpeed = 10;
        this.acceleration = 0.08;
        this.turnSpeed = 0.08;
        this.driftFactor = 0.90;

        // State
        this.state = {
            speed: 0,
            drifting: false,
            releaseSpeed: 0
        };

        // Controls (WASD for player 1, Arrow keys for player 2)
        this.controls = controlKeys || {
            up: 87,      // W
            down: 83,    // S
            left: 65,    // A
            right: 68    // D
        };

        // Visual trail for drifting
        this.trail = [];
        this.maxTrailLength = 30;
    }

    update() {
        // Handle input
        this.handleInput();

        // Update speed from velocity
        let velocity = this.body.velocity;
        this.state.speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);

        // Check if drifting (based on angle between velocity and body angle)
        this.checkDrift();

        // Update trail if drifting
        if (this.state.drifting) {
            this.updateTrail();
        } else {
            this.trail = [];
        }
    }

    handleInput() {
        let velocity = this.body.velocity;
        let angle = this.body.angle;
        let force = 0;

        this.frictionAir = 0.05;

        let carAngle = wrapPi(this.body.angle);
        let velocityAngle = wrapPi(Math.atan2(velocity.y, velocity.x));
        let angleDiff = Math.abs(wrapPi(velocityAngle - carAngle));

        let speed = this.state.speed;

        // Acceleration, braking, and coasting
        if (keyIsDown(this.controls.up)) {
            force = this.acceleration;
            this.state.releaseSpeed = this.state.speed;
        } else if (keyIsDown(this.controls.down)) {
            this.frictionAir = 0.8;
            this.state.releaseSpeed = this.state.speed;
        } else if (speed > 0) {
            // todo
            if (angleDiff > 0.3 || this.state.drifting) {
                this.frictionAir = 0.8;
            } else {
                Matter.Body.setVelocity(this.body, {
                    x: velocity.x * (this.state.releaseSpeed / speed),
                    y: velocity.y * (this.state.releaseSpeed / speed)
                });
            }
        }

        // Apply force in direction car is facing
        if (force !== 0) {
            let forceX = Math.cos(angle) * force;
            let forceY = Math.sin(angle) * force;
            Matter.Body.applyForce(this.body, this.body.position, { x: forceX, y: forceY });
        }

        // Limit max speed

        if (speed > this.maxSpeed) {

            Matter.Body.setVelocity(this.body, {
                x: velocity.x * (this.maxSpeed / speed),
                y: velocity.y * (this.maxSpeed / speed)
            });
        }

        // TODO: reduce speed after collision

        // Steering
        if (speed > 0.2) {
            //let turnSpeed = this.turnSpeed * (speed / this.maxSpeed); // More speed, more responsive turning
            if (keyIsDown(this.controls.left)) {
                Matter.Body.setAngle(this.body, angle - this.turnSpeed);
            }
            if (keyIsDown(this.controls.right)) {
                Matter.Body.setAngle(this.body, angle + this.turnSpeed);
            }
        }

        // Drift mechanics
        if (keyIsDown(this.controls.left) || keyIsDown(this.controls.right)) {
            if (speed > 1.5) { // Only drift at higher speeds
                this.applyDrift();
            }
        }
    }

    applyDrift() {
        // Reduce lateral friction for drift effect
        let velocity = this.body.velocity;
        let angle = this.body.angle;

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

        // Apply drift factor to lateral velocity
        Matter.Body.setVelocity(this.body, {
            x: forward.x * forwardSpeed + lateralVelocity.x * this.driftFactor,
            y: forward.y * forwardSpeed + lateralVelocity.y * this.driftFactor
        });
    }

    checkDrift() {
        if (this.state.speed < 2) {
            this.state.drifting = false;
            return;
        }

        const v = this.body.velocity;

        // Normalize both angles
        let carAngle = wrapPi(this.body.angle);
        let velocityAngle = wrapPi(Math.atan2(v.y, v.x));

        // Shortest unsigned difference in [0, PI]
        let angleDiff = Math.abs(wrapPi(velocityAngle - carAngle));

        //console.log("Angle Diff:", angleDiff.toFixed(2), "Speed:", this.state.speed.toFixed(2));

        this.state.drifting = angleDiff > 0.5 && angleDiff < 1 && this.state.speed > 5;
    }

    updateTrail() {
        this.trail.push({
            x: this.body.position.x,
            y: this.body.position.y
        });

        if (this.trail.length > this.maxTrailLength) {
            this.trail.shift();
        }
    }

    // Getter properties for easy access
    get position() {
        return this.body.position;
    }

    get angle() {
        return this.body.angle;
    }

    get velocity() {
        return this.body.velocity;
    }
}