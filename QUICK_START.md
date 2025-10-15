# Quick Start Guide - Neon Drift Racing

## 🚀 Running the Game (No Installation Required!)

### Method 1: Direct Browser Open (Simplest)
1. Locate `index.html` in the project folder
2. Double-click `index.html`
3. Your default browser will open the game
4. Click "Single Player" or "Two Players" to start!

**Note**: This works because we're using CDN links for p5.js and Matter.js libraries.

---

### Method 2: Local Server (Recommended for Development)

If you plan to modify the code or add features, use a local server:

#### Using Python 3:
```bash
cd "/Users/xueshenrui/Desktop/interactive/midterm proj"
python -m http.server 8000
```

Then open: `http://localhost:8000`

#### Using Python 2:
```bash
cd "/Users/xueshenrui/Desktop/interactive/midterm proj"
python -m SimpleHTTPServer 8000
```

Then open: `http://localhost:8000`

#### Using Node.js:
```bash
cd "/Users/xueshenrui/Desktop/interactive/midterm proj"
npx http-server -p 8000
```

Then open: `http://localhost:8000`

#### Using PHP:
```bash
cd "/Users/xueshenrui/Desktop/interactive/midterm proj"
php -S localhost:8000
```

Then open: `http://localhost:8000`

---

## 🎮 Controls

### Menus
- **Mouse**: Click buttons to navigate
- **Back Buttons**: Click "← Back to Menu" to return to main menu
- **ESC**: Return to menu from game or instructions

### In-Game (Single Player)
- **W** or **↑**: Accelerate
- **S** or **↓**: Brake / Reverse
- **A** or **←**: Turn Left
- **D** or **→**: Turn Right
- **Space**: Handbrake / Force Drift
- **P**: Pause
- **R**: Restart

### Two Player Mode
- **Player 1 (Cyan)**: W/A/S/D + Shift
- **Player 2 (Magenta)**: Arrow Keys + Space

---

## 📁 Project Files

### Core Files (Person C)
```
index.html              - Main entry point
styles.css              - Neon styling
camera.js               - Camera system
hud.js                  - HUD system
sketch.js               - Game orchestration
```

### Documentation
```
README.md               - Full project documentation
TECHNICAL_NOTES.md      - Technical details
IMPLEMENTATION_SUMMARY.md - Implementation summary
QUICK_START.md          - This file
```

### Integration Files (To be added by Person A & B)
```
car.js                  - Vehicle physics (Person A)
track.js                - Track & collisions (Person B)
```

---

## 🔍 What You'll See

### Current Implementation (Person C Complete)
✅ **Working Features**:
- Animated neon menu system
- Smooth camera following
- Neon grid background
- HUD displays (speed, time, drift score)
- Placeholder cars that demonstrate visual style
- Pause/resume functionality
- Mode selection (single/two-player)

⏳ **Pending Integration** (Person A & B):
- Actual car physics and controls
- Complete track with collisions
- Checkpoint system
- Lap timing functionality
- Drift mechanics
- NPC cars

---

## 🎨 Current Demo Features

### What Works Now:
1. **Menu System**: Fully functional start menu, instructions, and pause menu
2. **Visual Effects**: Complete neon aesthetic with glow effects
3. **Camera**: Smooth following of placeholder cars
4. **HUD**: Displays all information (with placeholder data)
5. **Responsive**: Resizes with window

### Test the Camera:
- The camera smoothly follows the placeholder cars
- In two-player mode, camera centers between both cars
- Press Space to test screen shake effect

### Test the Menus:
- Click "Instructions" to see full control guide
- Use the **top-left** or **bottom** back button to return to main menu
- Start a game and press P to pause
- Press ESC to navigate back to menu

---

## 🛠️ For Developers (Integration Guide)

### Person A (Vehicle Physics)
Create `car.js` with this structure:
```javascript
class Car {
    constructor(x, y, playerIndex) {
        this.position = {x, y};
        this.state = {
            speed: 0,
            drifting: false,
            driftScore: 0,
            driftCombo: 1
        };
    }
    
    update(dt, controls) {
        // Your physics here
    }
    
    getState() {
        return this.state;
    }
}
```

### Person B (Track & Collisions)
Create `track.js` with these functions:
```javascript
function buildTrack(world) {
    // Create Matter.js bodies
}

function drawTrack(camera) {
    // Render track with neon effects
}

// Emit events by calling:
// onLap(carIndex, lapTime)
// onCheckpoint(carIndex, checkpointId)
// onWallHit(carIndex)
```

---

## 📱 Browser Compatibility

✅ **Fully Supported**:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

⚠️ **Not Yet Supported**:
- Mobile browsers (touch controls not implemented)
- Internet Explorer

---

## 🐛 Troubleshooting

### Game won't load?
- Check browser console (F12) for errors
- Make sure you're using a modern browser
- Ensure internet connection for CDN libraries

### Menus not working?
- Check if JavaScript is enabled
- Clear browser cache and reload
- Try a different browser

### Performance issues?
- Close other browser tabs
- Update your graphics drivers
- Try reducing browser zoom level

---

## 📞 Support

### For Questions:
- Check `README.md` for detailed documentation
- Check `TECHNICAL_NOTES.md` for implementation details
- Review inline code comments

### For Integration:
- See integration API in `sketch.js`
- Check placeholder implementations
- Review callback functions

---

## ✨ Quick Test Checklist

Run through these to verify everything works:

- [ ] Open index.html in browser
- [ ] See animated neon start menu
- [ ] Click "Instructions" button
- [ ] See complete control guide
- [ ] Click "Back" to return to menu
- [ ] Click "Single Player"
- [ ] See neon grid background
- [ ] See HUD with speed/time/score
- [ ] Press P to pause
- [ ] See pause menu
- [ ] Click "Resume"
- [ ] Press R to restart
- [ ] Press ESC to return to menu
- [ ] Try "Two Players" mode
- [ ] See two HUD displays

If all checkboxes work, Person C implementation is fully functional! ✅

---

## 🎯 Next Steps

1. **For Person A**: Implement vehicle physics in `car.js`
2. **For Person B**: Implement track system in `track.js`
3. **Integration**: Everything should work together automatically via the integration API

---

**Ready to Race! 🏎️💨**

*Enjoy the neon drift experience!*

