/**
 * HUD (Heads-Up Display) System for Neon Drift Racing
 * Displays speed, lap times, drift scores, and other game information
 * Person C - Rendering, HUD, and Presentation
 */

class HUD {
    constructor() {
        this.fontSize = 18;
        this.padding = 20;
        
        // Player colors
        this.player1Color = '#00ffff'; // Cyan
        this.player2Color = '#ff00ff'; // Magenta
        
        // Animation
        this.driftFlashAlpha = 0;
        this.comboScale = 1;
    }
    
    /**
     * Draw single player HUD
     * @param {object} carState - Car state object with speed, drifting, score, etc.
     * @param {object} lapInfo - Lap information object
     */
    drawSinglePlayer(carState, lapInfo) {
        push();
        
        // Speed display (top left)
        this.drawSpeed(carState.speed, this.padding, this.padding, this.player1Color);
        
        // Lap time display (top center)
        this.drawLapTime(lapInfo, width / 2, this.padding);
        
        // Drift score (top right)
        this.drawDriftScore(carState, width - this.padding, this.padding);
        
        // Drift indicator (center)
        if (carState.drifting) {
            this.drawDriftIndicator(width / 2, height - 100, carState.driftCombo || 1);
        }
        
        pop();
    }
    
    /**
     * Draw two player HUD
     * @param {object} car1State - Player 1 car state
     * @param {object} car2State - Player 2 car state
     * @param {object} lap1Info - Player 1 lap info
     * @param {object} lap2Info - Player 2 lap info
     */
    drawTwoPlayer(car1State, car2State, lap1Info, lap2Info) {
        push();
        
        // Player 1 (left side)
        this.drawSpeed(car1State.speed, this.padding, this.padding, this.player1Color);
        this.drawDriftScore(car1State, this.padding, this.padding + 60, this.player1Color, 'left');
        this.drawLapTime(lap1Info, this.padding + 150, this.padding, this.player1Color);
        
        // Player 2 (right side)
        this.drawSpeed(car2State.speed, width - this.padding, this.padding, this.player2Color, 'right');
        this.drawDriftScore(car2State, width - this.padding, this.padding + 60, this.player2Color, 'right');
        this.drawLapTime(lap2Info, width - this.padding - 150, this.padding, this.player2Color);
        
        // Drift indicators
        if (car1State.drifting) {
            this.drawDriftIndicator(width / 4, height - 100, car1State.driftCombo || 1, this.player1Color);
        }
        if (car2State.drifting) {
            this.drawDriftIndicator(3 * width / 4, height - 100, car2State.driftCombo || 1, this.player2Color);
        }
        
        pop();
    }
    
    /**
     * Draw speed display
     * @param {number} speed - Current speed
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {string} color - Display color
     * @param {string} align - Text alignment ('left' or 'right')
     */
    drawSpeed(speed, x, y, color = '#00ffff', align = 'left') {
        push();
        
        textAlign(align === 'right' ? RIGHT : LEFT, TOP);
        textSize(this.fontSize);
        
        // Label
        fill(150);
        noStroke();
        text('SPEED', x, y);
        
        // Speed value with glow
        textSize(this.fontSize * 2);
        fill(color);
        this.applyTextGlow(color);
        
        let speedKmh = Math.abs(speed * 3.6).toFixed(0); // Convert to km/h
        text(speedKmh, x, y + 25);
        
        // Unit
        textSize(this.fontSize);
        fill(150);
        noStroke();
        text('km/h', x, y + 55);
        
        pop();
    }
    
    /**
     * Draw lap time display
     * @param {object} lapInfo - Lap information (current, last, best)
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {string} color - Display color
     */
    drawLapTime(lapInfo, x, y, color = '#00ffff') {
        if (!lapInfo) return;
        
        push();
        textAlign(CENTER, TOP);
        textSize(this.fontSize);
        
        // Current lap and checkpoint
        fill(150);
        noStroke();
        text('LAP ' + (lapInfo.currentLap || 1), x, y);
        
        // Current time
        fill(color);
        this.applyTextGlow(color);
        textSize(this.fontSize * 1.5);
        text(this.formatTime(lapInfo.currentTime || 0), x, y + 25);
        
        // Last and best times
        textSize(this.fontSize * 0.9);
        fill(150);
        noStroke();
        
        if (lapInfo.lastTime) {
            text('LAST: ' + this.formatTime(lapInfo.lastTime), x, y + 55);
        }
        
        if (lapInfo.bestTime) {
            fill('#ffaa00');
            text('BEST: ' + this.formatTime(lapInfo.bestTime), x, y + 75);
        }
        
        pop();
    }
    
    /**
     * Draw drift score
     * @param {object} carState - Car state with drift info
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {string} color - Display color
     * @param {string} align - Text alignment
     */
    drawDriftScore(carState, x, y, color = '#00ffff', align = 'right') {
        if (!carState) return;
        
        push();
        textAlign(align === 'left' ? LEFT : RIGHT, TOP);
        textSize(this.fontSize);
        
        // Label
        fill(150);
        noStroke();
        text('DRIFT', x, y);
        
        // Score with glow
        fill(color);
        this.applyTextGlow(color);
        textSize(this.fontSize * 1.5);
        text(Math.floor(carState.driftScore || 0), x, y + 25);
        
        pop();
    }
    
    /**
     * Draw drift indicator when drifting
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} combo - Combo multiplier
     * @param {string} color - Display color
     */
    drawDriftIndicator(x, y, combo = 1, color = '#ff00ff') {
        push();
        
        // Animate combo scale
        this.comboScale = lerp(this.comboScale, 1 + combo * 0.1, 0.2);
        
        textAlign(CENTER, CENTER);
        textSize(this.fontSize * 2 * this.comboScale);
        
        fill(color);
        this.applyTextGlow(color, combo * 3);
        
        text('DRIFT!', x, y);
        
        // Combo multiplier
        if (combo > 1) {
            textSize(this.fontSize * 1.5 * this.comboScale);
            fill('#ffaa00');
            this.applyTextGlow('#ffaa00', combo * 2);
            text('x' + combo, x, y + 40);
        }
        
        pop();
    }
    
    /**
     * Apply text glow effect
     * @param {string} color - Glow color
     * @param {number} intensity - Glow intensity multiplier
     */
    applyTextGlow(color, intensity = 1) {
        drawingContext.shadowBlur = 15 * intensity;
        drawingContext.shadowColor = color;
    }
    
    /**
     * Format time in MM:SS.mmm format
     * @param {number} ms - Time in milliseconds
     * @returns {string} Formatted time string
     */
    formatTime(ms) {
        let totalSeconds = ms / 1000;
        let minutes = Math.floor(totalSeconds / 60);
        let seconds = Math.floor(totalSeconds % 60);
        let milliseconds = Math.floor((totalSeconds % 1) * 1000);
        
        return minutes.toString().padStart(2, '0') + ':' +
               seconds.toString().padStart(2, '0') + '.' +
               milliseconds.toString().padStart(3, '0');
    }
    
    /**
     * Draw countdown for race start
     * @param {number} count - Countdown number (3, 2, 1, or 0 for GO)
     */
    drawCountdown(count) {
        push();
        
        textAlign(CENTER, CENTER);
        textSize(this.fontSize * 5);
        
        let displayText = count > 0 ? count.toString() : 'GO!';
        let color = count > 0 ? '#ff0000' : '#00ff00';
        
        fill(color);
        this.applyTextGlow(color, 3);
        
        text(displayText, width / 2, height / 2);
        
        pop();
    }
    
    /**
     * Draw minimap (optional feature)
     * @param {array} cars - Array of car objects
     * @param {array} checkpoints - Array of checkpoint positions
     * @param {number} x - Minimap X position
     * @param {number} y - Minimap Y position
     * @param {number} size - Minimap size
     */
    drawMinimap(cars, checkpoints, x, y, size = 150) {
        push();
        
        // Background
        fill(0, 0, 0, 150);
        stroke(100);
        strokeWeight(2);
        rect(x, y, size, size);
        
        // Scale factor (adjust based on track size)
        let scale = size / 2000; // Assumes track is roughly 2000x2000
        
        // Draw checkpoints
        noStroke();
        fill(100, 100, 100, 100);
        for (let cp of checkpoints || []) {
            let px = x + size / 2 + cp.x * scale;
            let py = y + size / 2 + cp.y * scale;
            ellipse(px, py, 5);
        }
        
        // Draw cars
        for (let i = 0; i < (cars || []).length; i++) {
            let car = cars[i];
            let carColor = i === 0 ? this.player1Color : this.player2Color;
            
            fill(carColor);
            this.applyTextGlow(carColor, 0.5);
            
            let px = x + size / 2 + car.x * scale;
            let py = y + size / 2 + car.y * scale;
            ellipse(px, py, 8);
        }
        
        pop();
    }
    
    /**
     * Draw notification message
     * @param {string} message - Message to display
     * @param {number} duration - How long to show (frames)
     */
    drawNotification(message, x = width / 2, y = height / 3) {
        push();
        
        textAlign(CENTER, CENTER);
        textSize(this.fontSize * 2);
        
        fill('#ffaa00');
        this.applyTextGlow('#ffaa00', 2);
        
        text(message, x, y);
        
        pop();
    }
}

