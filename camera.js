/**
 * Camera System for Neon Drift Racing
 * Handles smooth camera following and world-to-screen transformations
 * Person C - Rendering, HUD, and Presentation
 */

class Camera {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
        this.targetX = x;
        this.targetY = y;
        
        // Smoothing factor (0-1, higher = more responsive)
        this.smoothing = 0.1;
        
        // Zoom level
        this.zoom = 1.0;
        this.targetZoom = 1.0;
        this.zoomSmoothing = 0.05;
        
        // Screen shake
        this.shakeAmount = 0;
        this.shakeDuration = 0;
        this.shakeDecay = 0.9;
    }
    
    /**
     * Set the camera target position
     * @param {number} x - Target x position
     * @param {number} y - Target y position
     */
    setTarget(x, y) {
        this.targetX = x;
        this.targetY = y;
    }
    
    /**
     * Follow a target object smoothly
     * @param {object} target - Object with x and y properties
     * @param {number} offsetX - Optional X offset from target
     * @param {number} offsetY - Optional Y offset from target
     */
    follow(target, offsetX = 0, offsetY = 0) {
        if (target) {
            this.setTarget(target.x + offsetX, target.y + offsetY);
        }
    }
    
    /**
     * Follow multiple targets (e.g., two players)
     * Centers camera between all targets
     * @param {array} targets - Array of objects with x and y properties
     */
    followMultiple(targets) {
        if (targets && targets.length > 0) {
            let avgX = 0;
            let avgY = 0;
            
            for (let target of targets) {
                avgX += target.x;
                avgY += target.y;
            }
            
            avgX /= targets.length;
            avgY /= targets.length;
            
            this.setTarget(avgX, avgY);
            
            // Optional: adjust zoom based on distance between targets
            if (targets.length === 2) {
                let dist = Math.hypot(
                    targets[1].x - targets[0].x,
                    targets[1].y - targets[0].y
                );
                // Zoom out if players are far apart
                this.targetZoom = Math.max(0.5, Math.min(1.0, 1000 / (dist + 500)));
            }
        }
    }
    
    /**
     * Update camera position with smooth interpolation
     */
    update() {
        // Smooth movement
        this.x += (this.targetX - this.x) * this.smoothing;
        this.y += (this.targetY - this.y) * this.smoothing;
        
        // Smooth zoom
        this.zoom += (this.targetZoom - this.zoom) * this.zoomSmoothing;
        
        // Update screen shake
        if (this.shakeDuration > 0) {
            this.shakeDuration--;
            this.shakeAmount *= this.shakeDecay;
        } else {
            this.shakeAmount = 0;
        }
    }
    
    /**
     * Apply camera transformation to p5.js
     * Call this at the start of draw() before drawing world objects
     */
    apply() {
        push();
        translate(width / 2, height / 2);
        scale(this.zoom);
        
        // Apply screen shake
        if (this.shakeAmount > 0) {
            let shakeX = random(-this.shakeAmount, this.shakeAmount);
            let shakeY = random(-this.shakeAmount, this.shakeAmount);
            translate(shakeX, shakeY);
        }
        
        translate(-this.x, -this.y);
    }
    
    /**
     * Remove camera transformation
     * Call this after drawing world objects, before drawing HUD
     */
    unapply() {
        pop();
    }
    
    /**
     * Trigger screen shake effect
     * @param {number} amount - Shake intensity
     * @param {number} duration - Shake duration in frames
     */
    shake(amount = 10, duration = 10) {
        this.shakeAmount = Math.max(this.shakeAmount, amount);
        this.shakeDuration = Math.max(this.shakeDuration, duration);
    }
    
    /**
     * Set zoom level
     * @param {number} zoom - Zoom level (1.0 = normal)
     */
    setZoom(zoom) {
        this.targetZoom = zoom;
    }
    
    /**
     * Convert world coordinates to screen coordinates
     * @param {number} worldX - World X position
     * @param {number} worldY - World Y position
     * @returns {object} Screen coordinates {x, y}
     */
    worldToScreen(worldX, worldY) {
        let screenX = (worldX - this.x) * this.zoom + width / 2;
        let screenY = (worldY - this.y) * this.zoom + height / 2;
        return { x: screenX, y: screenY };
    }
    
    /**
     * Convert screen coordinates to world coordinates
     * @param {number} screenX - Screen X position
     * @param {number} screenY - Screen Y position
     * @returns {object} World coordinates {x, y}
     */
    screenToWorld(screenX, screenY) {
        let worldX = (screenX - width / 2) / this.zoom + this.x;
        let worldY = (screenY - height / 2) / this.zoom + this.y;
        return { x: worldX, y: worldY };
    }
    
    /**
     * Get camera bounds in world coordinates
     * Useful for culling off-screen objects
     * @returns {object} Bounds {left, right, top, bottom}
     */
    getBounds() {
        let halfWidth = (width / 2) / this.zoom;
        let halfHeight = (height / 2) / this.zoom;
        
        return {
            left: this.x - halfWidth,
            right: this.x + halfWidth,
            top: this.y - halfHeight,
            bottom: this.y + halfHeight
        };
    }
}

