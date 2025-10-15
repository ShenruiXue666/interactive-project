# Neon Drift Racing

A top-down view drift racing arena game built with p5.js and Matter.js, featuring neon-style visuals, physics-based car simulation, and competitive drift racing mechanics.

![Neon Drift Racing](demo.gif)

## 🎮 Game Features

- **Realistic Car Physics**: Acceleration, braking, and steering with lateral grip model
- **Drift System**: Slide around corners at high speed, earn points and combo multipliers
- **Neon Visual Effects**: Glowing track boundaries, grid background, and particle effects
- **Single & Two-Player Modes**: Race solo or compete against a friend
- **Lap Timing System**: Track your current, last, and best lap times
- **Dynamic Camera**: Smooth camera following with screen shake effects
- **Comprehensive HUD**: Real-time speed, drift score, and lap information display

## 🕹️ Controls

### Single Player Mode
- **W / ↑** - Accelerate
- **S / ↓** - Brake / Reverse
- **A / ←** - Turn Left
- **D / →** - Turn Right
- **Space** - Handbrake (Force Drift)

### Two Player Mode
- **Player 1 (Cyan)**: W/A/S/D + Shift (handbrake)
- **Player 2 (Magenta)**: Arrow Keys + Space (handbrake)

### General Controls
- **P** - Pause / Resume
- **R** - Restart Game
- **ESC** - Return to Menu
- **Mouse Click** - Navigate menus and use back buttons

## 🚀 Getting Started

### Prerequisites
- Modern web browser (Chrome, Firefox, Safari, or Edge)
- Internet connection (for CDN libraries)

### Installation

1. Clone or download this repository
2. Open `index.html` in your web browser
3. Select game mode and start racing!

### Running Locally
```bash
# Using Python 3
python -m http.server 8000

# Using Python 2
python -m SimpleHTTPServer 8000

# Using Node.js (http-server)
npx http-server -p 8000
```

Then open `http://localhost:8000` in your browser.

## 📁 Project Structure

```
midterm proj/
├── index.html          # Main HTML entry point
├── styles.css          # Neon styling and UI design
├── sketch.js           # Main game orchestration (Person C)
├── camera.js           # Camera follow system (Person C)
├── hud.js              # HUD display system (Person C)
├── car.js              # Vehicle physics (Person A) [TODO]
├── track.js            # Track & collisions (Person B) [TODO]
└── README.md           # This file
```

## 🎨 Technical Implementation

### Person C Deliverables (Rendering, HUD, and Presentation)

#### 1. Camera System (`camera.js`)
- **Smooth Camera Follow**: Interpolated camera movement with configurable smoothing
- **Multi-target Support**: Centers camera between multiple players in two-player mode
- **Dynamic Zoom**: Automatically adjusts zoom based on player distance
- **Screen Shake**: Visual feedback for collisions and drifting
- **Coordinate Transformations**: World-to-screen and screen-to-world conversions
- **View Culling**: Provides camera bounds for off-screen object optimization

**Key Features:**
```javascript
camera.follow(target);              // Follow single target
camera.followMultiple([p1, p2]);    // Follow multiple targets
camera.shake(amount, duration);     // Trigger screen shake
camera.setZoom(level);              // Adjust zoom level
```

#### 2. HUD System (`hud.js`)
- **Speed Display**: Real-time speed in km/h with neon glow
- **Lap Timer**: Current, last, and best lap times in MM:SS.mmm format
- **Drift Score**: Live drift points and combo multiplier display
- **Drift Indicator**: Animated "DRIFT!" indicator with combo visualization
- **Two-Player HUD**: Color-coded displays for both players
- **Minimap Support**: Optional minimap showing car positions and checkpoints
- **Notifications**: System for displaying race events

**Visual Effects:**
- Text glow effects using canvas shadow API
- Animated combo multipliers
- Color-coded player information (Cyan for P1, Magenta for P2)

#### 3. Neon Visual Effects
- **Grid Background**: Animated neon grid with camera culling for performance
- **Glow Effects**: Layered stroke technique for neon glow on all elements
- **Track Boundaries**: Neon-lit walls with color-coded sections
- **Car Rendering**: Glowing car bodies with headlights and skid marks
- **Particle Effects**: Support for drift smoke and collision sparks

#### 4. Menu System
- **Start Menu**: Mode selection (Single/Two-Player) with neon styling
- **Instructions Overlay**: Complete control guide and gameplay explanation
- **Pause Menu**: In-game pause with resume/restart/menu options
- **Responsive Design**: All menus adapt to different screen sizes

**CSS Features:**
- Custom neon text effects with multiple shadow layers
- Animated flickering title effect
- Gradient backgrounds with blur
- Hover effects with glow animations

#### 5. Main Game Orchestration (`sketch.js`)
- **Game State Management**: Menu, playing, and paused states
- **Game Loop**: Coordinates physics updates, camera, and rendering
- **Integration Points**: Clean API for Person A & B components
- **Event Handling**: Keyboard input for controls and menu navigation
- **Responsive Canvas**: Automatic resize handling

**Integration API:**
```javascript
// For Person A (Vehicle Physics)
onDriftStart(carIndex)
onDriftEnd(carIndex, score, combo)

// For Person B (Track & Collisions)
onLap(carIndex, lapTime)
onCheckpoint(carIndex, checkpointIndex)
onWallHit(carIndex)
```

## 🎯 Gameplay Mechanics

### Drift System
1. Enter a turn at high speed while pressing turn + accelerate
2. The car enters drift mode, leaving tire marks
3. Maintain the drift to build score
4. Chain multiple drifts for combo multipliers
5. Wall hits reset your combo - be careful!

### Lap System
1. Start at the start/finish line
2. Pass through all checkpoints in order
3. Cross the finish line to complete the lap
4. Try to beat your best time!

## 🔧 Technical Notes

### Libraries Used
- **p5.js v1.7.0**: Canvas rendering and animation framework
- **Matter.js v0.19.0**: 2D physics engine for realistic car physics and collisions

### Performance Optimizations
- Camera-based view culling for grid rendering
- Efficient particle system with automatic cleanup
- Minimal DOM manipulation for HUD updates
- Optimized shadow blur effects

### Browser Compatibility
- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support
- Mobile: Touch controls not yet implemented

## 🎨 Visual Design Philosophy

The game uses a **neon cyberpunk aesthetic** inspired by 1980s arcade games:
- High contrast neon colors (cyan, magenta, yellow)
- Glow effects on all key visual elements
- Dark background to make neon colors pop
- Grid-based retro-futuristic environment
- Smooth animations and screen shake for tactile feedback

## 🚧 Development Status

### Completed (Person C)
- ✅ Project structure and HTML setup
- ✅ Camera follow system with smooth interpolation
- ✅ Neon visual effects and grid background
- ✅ Comprehensive HUD system
- ✅ Menu system (start, instructions, pause)
- ✅ CSS styling with neon effects
- ✅ Main game orchestration
- ✅ Integration API for other components

### Pending (Person A & B)
- ⏳ Car physics implementation (Person A)
- ⏳ Track construction and collision detection (Person B)
- ⏳ Checkpoint and lap timing logic (Person B)
- ⏳ NPC cars (optional)
- ⏳ Multiple track layouts (optional)

## 🎥 Demo

To see the current implementation:
1. Open `index.html` in a browser
2. The camera and HUD systems are fully functional
3. Placeholder cars demonstrate the visual style
4. All menus and transitions are working

**Note**: Full gameplay requires integration with Person A's vehicle physics and Person B's track/collision systems.

## 📝 Code Documentation

All code files include comprehensive comments:
- Function-level documentation with parameters and return values
- Inline comments explaining complex logic
- Clear separation of concerns
- Integration points clearly marked for team collaboration

## 🤝 Team Collaboration

### Person A Integration
Person A should implement `car.js` with the following API:
```javascript
class Car {
    constructor(x, y, playerIndex) { }
    update(dt, controls) { }  // Returns state object
    draw() { }
    getState() { }  // Returns {pos, angle, speed, drifting, score}
}
```

### Person B Integration
Person B should implement `track.js` with:
```javascript
function buildTrack(world) { }  // Creates Matter.js bodies
function drawTrack(camera) { }  // Renders track
// Events: onLap, onCheckpoint, onWallHit
```

## 📄 License

This project is created for educational purposes as part of a midterm project.

## 👥 Contributors

- **Person C**: Rendering, HUD, and Presentation (This implementation)
- **Person A**: Vehicle Physics and Gameplay Logic (Pending)
- **Person B**: Track, Collisions, and Game Rules (Pending)

---

**Happy Drifting! 🏎️💨**

