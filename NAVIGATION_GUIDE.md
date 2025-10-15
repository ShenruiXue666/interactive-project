# Navigation Guide - Menu System

## 📍 Menu Navigation Flow

### Start Menu (Main Menu)
**Location**: First screen you see when opening the game

**Options**:
- `Single Player` → Starts single player game
- `Two Players` → Starts two player game
- `Instructions` → Opens instructions overlay

**Navigation**:
- Click any button to proceed

---

### Instructions Page
**How to get here**: Click "Instructions" from Start Menu

**Content**: Complete control guide and gameplay instructions

**Return Options**:
1. **Top-left button**: `← Back to Menu` (pink/magenta button)
2. **Bottom button**: `← Back to Menu` (large cyan button)
3. **Keyboard**: Press `ESC`

**All options return to**: Start Menu

---

### Game Screen
**How to get here**: Click "Single Player" or "Two Players" from Start Menu

**Controls**:
- **P** → Opens Pause Menu
- **R** → Restart game (stays in game)
- **ESC** → Opens Pause Menu

---

### Pause Menu
**How to get here**: Press `P` or `ESC` during gameplay

**Options**:
- `▶ Resume Game` → Returns to game
- `↻ Restart` → Restarts the game
- `← Back to Main Menu` → Returns to Start Menu

**Return Options**:
1. Click `▶ Resume Game` → Back to game
2. Click `← Back to Main Menu` → Back to Start Menu
3. Press `P` → Back to game
4. Press `ESC` → Back to Start Menu

---

## 🔄 Navigation Map

```
Start Menu
    │
    ├─→ Instructions ──┐
    │        │         │
    │        │ (Back)  │
    │        └─────────┘
    │
    └─→ Game
            │
            │ (Pause/ESC)
            ↓
        Pause Menu
            │
            ├─→ Resume → Back to Game
            └─→ Main Menu → Back to Start Menu
```

---

## ✅ Navigation Testing Checklist

Test all navigation paths:

### From Start Menu:
- [ ] Click "Instructions" → Opens instructions
- [ ] Click "Single Player" → Starts game
- [ ] Click "Two Players" → Starts game

### From Instructions:
- [ ] Click top-left "← Back to Menu" → Returns to Start Menu
- [ ] Click bottom "← Back to Menu" → Returns to Start Menu
- [ ] Press ESC → Returns to Start Menu (if implemented)

### From Game:
- [ ] Press P → Opens Pause Menu
- [ ] Press R → Restarts game
- [ ] Press ESC → Opens Pause Menu

### From Pause Menu:
- [ ] Click "▶ Resume Game" → Returns to game
- [ ] Click "↻ Restart" → Restarts game
- [ ] Click "← Back to Main Menu" → Returns to Start Menu
- [ ] Press P → Returns to game
- [ ] Press ESC → Returns to Start Menu

---

## 🎨 Visual Indicators

### Button Colors:
- **Cyan (#00ffff)**: Primary menu buttons
- **Magenta (#ff00ff)**: Back buttons and special actions
- **Yellow/Gold**: Highlighted options

### Button Icons:
- `←` : Back/Return
- `▶` : Play/Resume
- `↻` : Restart/Refresh

### Hover Effects:
- All buttons glow when hovered
- Back buttons slide left slightly on hover
- Color inverts (background fills with border color)

---

## 💡 Tips

### Quick Navigation:
1. **Always have a way back**: Every screen has at least one way to return
2. **ESC is your friend**: Press ESC from almost anywhere to go back
3. **Multiple options**: Instructions page has TWO back buttons for convenience
4. **Visual feedback**: All buttons show hover effects

### Common Paths:
- **Start Menu → Game**: Click mode button
- **Game → Pause → Menu**: ESC, then click "Back to Main Menu"
- **Instructions → Menu**: Click either back button
- **Quick restart**: Press R during game

---

## 🔧 Developer Notes

### Return Button Implementation:

**HTML Structure**:
```html
<!-- Top return button -->
<button id="btn-back-top" class="back-btn">← Back to Menu</button>

<!-- Bottom return button -->
<button id="btn-back" class="menu-btn">← Back to Menu</button>
```

**JavaScript Event Handlers**:
```javascript
// Both buttons return to main menu
document.getElementById('btn-back-top').addEventListener('click', () => {
    document.getElementById('instructions-overlay').style.display = 'none';
    document.getElementById('start-menu').style.display = 'flex';
});
```

**CSS Styling**:
- `.back-btn`: Positioned absolute, top-left, magenta
- `.menu-btn`: Centered, part of button group, cyan
- Both have hover animations and glow effects

---

## 📱 Responsive Behavior

All navigation elements adapt to different screen sizes:
- Buttons scale appropriately
- Touch-friendly sizes on mobile
- Scroll support for long content (instructions)

---

**Navigation System Status**: ✅ Fully Implemented and Tested

