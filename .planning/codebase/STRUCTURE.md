# Project Structure

## Directory Layout

```
MyPup/
├── .planning/
│   └── codebase/          # Codebase documentation (this folder)
│
├── assets/
│   ├── background/        # Pre-generated background frames (4 frames)
│   │   ├── background_frame_1.png
│   │   ├── background_frame_2.png
│   │   ├── background_frame_3.png
│   │   └── background_frame_4.png
│   ├── Cat.png           # Cat enemy sprite reference
│   └── MyPupLogo.png     # Game logo
│
├── index.html            # Main HTML entry point
├── styles.css            # Global styles
│
├── config.js             # Configuration and API keys
├── AssetStorage.js       # IndexedDB wrapper for asset caching
│
├── api.js                # Gemini API integration (APIService class)
├── character.js          # Character customization (CharacterManager class)
├── game.js               # Main game logic (Game class, Phaser)
├── levels.js             # Level data (CSV definitions)
├── level-generator.js    # Level generation utilities (LevelGenerator class)
├── test-models.js        # API model testing utilities
│
├── README.md             # Project documentation
├── SETUP.md              # Setup instructions
└── GITHUB_PAGES_SETUP.md # GitHub Pages deployment guide
```

## File Responsibilities

### Entry Point
- **`index.html`**
  - HTML structure
  - Script loading order
  - UI elements (menu, game screen)
  - Pre-generation asset loading logic
  - Global window functions for asset management

### Configuration
- **`config.js`**
  - API endpoints (production vs debug mode)
  - Game constants (dimensions, physics, sprite sizes)
  - Debug mode detection and management
  - API key loading from localStorage
  - Global CONFIG object

### Storage Layer
- **`AssetStorage.js`**
  - IndexedDB wrapper class
  - Async storage operations
  - Database initialization
  - Fallback to localStorage (not implemented, but structure supports it)

### API Layer
- **`api.js`**
  - `APIService` class
  - Gemini API integration
  - Image analysis and prompt generation
  - Sprite sheet generation
  - Background generation (location-based)
  - Tile generation (platform, water, treat, bone)
  - Enemy sprite generation
  - Error handling and parsing
  - Base64 image manipulation

### Character Management
- **`character.js`**
  - `CharacterManager` class
  - Image upload handling
  - Automatic sprite sheet generation trigger
  - Ready state checking (sprite sheet + background)
  - Game start initialization
  - UI state management (buttons, loading indicators)
  - Character persistence (save/load)

### Game Logic
- **`game.js`**
  - `Game` class (main game controller)
  - Phaser game configuration
  - Scene lifecycle (preload, create, update)
  - Player physics and controls
  - Enemy AI and behavior
  - Collision detection
  - Collectible management
  - Level generation from CSV
  - Background animation
  - UI updates (score, lives)
  - Pause/resume functionality
  - Debug mode toggle

### Level Data
- **`levels.js`**
  - Level definitions (CSV format)
  - Level metadata (theme, name)
  - CSV parsing utilities
  - Tile type definitions (P=platform, W=water, C=cat, T=treat, B=bone)

### Level Generation
- **`level-generator.js`**
  - `LevelGenerator` class
  - Tilesheet analysis (via Gemini)
  - Level generation utilities
  - Tile identification and mapping

### Testing
- **`test-models.js`**
  - API model availability testing
  - Console testing functions
  - Model endpoint verification

### Styling
- **`styles.css`**
  - Global styles
  - UI component styles
  - Game screen layout
  - Debug indicator styles
  - Responsive considerations

## Module Dependencies

### Dependency Graph

```
index.html
    ├─▶ Phaser.js (CDN)
    ├─▶ AssetStorage.js
    ├─▶ config.js
    ├─▶ api.js
    ├─▶ test-models.js
    ├─▶ levels.js
    ├─▶ level-generator.js
    ├─▶ character.js
    │   └─▶ api.js
    └─▶ game.js
        ├─▶ config.js
        ├─▶ levels.js
        └─▶ api.js (indirect, via window.api)
```

### Global Objects

**Window-level exports:**
- `window.Game` - Game class constructor
- `window.api` - APIService instance
- `window.assetStorage` - AssetStorage instance
- `window.gameInstance` - Current game instance
- `window.LEVELS` - Level data array
- `window.locationBackground` - Cached background spritesheet
- `window.locationBackgroundFrames` - Background frame metadata
- `window.catEnemySpriteSheet` - Cached cat sprite sheet

**Configuration:**
- `CONFIG` - Global configuration object (from config.js)

## Code Organization Patterns

### Class-Based Modules
Each major component is a class:
- `Game` - Encapsulates all game logic
- `APIService` - Encapsulates API interactions
- `CharacterManager` - Encapsulates character customization
- `AssetStorage` - Encapsulates storage operations
- `LevelGenerator` - Encapsulates level generation

### Global Functions
Utility functions attached to window:
- `generateLocationBackground()` - Background pre-generation
- `generateLevelTilesPreload()` - Tile pre-generation
- `generateEnemySpritesPreload()` - Enemy pre-generation
- `preGenerateGameAssets()` - Unified pre-generation

### Event-Driven Architecture
- DOM event listeners in `character.js`
- Phaser input system in `game.js`
- Keyboard shortcuts (D for debug, ESC for pause)

## Asset Organization

### Generated Assets (Runtime)
- Stored in IndexedDB via AssetStorage
- Keys:
  - `custom_sprite_sheet` - User's dog sprite sheet
  - `original_dog_image` - Uploaded dog image
  - `location_background` - Generated background spritesheet
  - `location_background_frames` - Background frame metadata
  - `level_tiles_v1` - Generated level tiles (JSON)
  - `enemy_cat_spritesheet` - Cat enemy sprite sheet

### Static Assets
- Stored in `assets/` directory
- Served directly via HTTP
- Background frames (pre-generated examples)
- Logo and reference images

## Data Structures

### Level Data Format
```javascript
{
  name: "Level 1",
  theme: "Sunny Meadow",
  csv: "P,P,P,..." // CSV string with tile codes
}
```

### Tile Codes
- `P` - Platform (solid, collidable)
- `W` - Water (hazard, collidable)
- `C` - Cat enemy spawn
- `T` - Treat (collectible)
- `B` - Bone (collectible)
- `.` - Empty space

### Sprite Sheet Format
- 4×4 grid (16 frames total)
- 64×64 pixels per frame
- Row 0: Idle (4 frames)
- Row 1: Walk right (4 frames)
- Row 2: Walk left (4 frames)
- Row 3: Jump (4 frames)

## Naming Conventions

### Files
- `camelCase.js` for JavaScript files
- `kebab-case.md` for documentation
- `PascalCase.png` for asset files

### Classes
- `PascalCase` - Game, APIService, CharacterManager

### Variables
- `camelCase` - spriteSheetUrl, currentScene
- `UPPER_SNAKE_CASE` - Constants (CONFIG properties)

### Functions
- `camelCase` - handleImageUpload, generateSpriteSheet
- `verbNoun` pattern - createLevel, updateBackground

### CSS Classes
- `kebab-case` - `game-screen`, `action-button`

## Import/Export Pattern

### No Module System
- All files loaded via `<script>` tags
- Global scope for sharing
- Load order matters (dependencies first)

### Script Loading Order (index.html)
1. Phaser.js (CDN)
2. AssetStorage.js
3. config.js
4. api.js
5. test-models.js
6. levels.js
7. level-generator.js
8. character.js
9. game.js

## Future Structure Considerations

### Potential Improvements
- Module bundler (Webpack, Vite) for better organization
- TypeScript for type safety
- Separate test directory
- Build output directory
- Environment-specific config files
- Component-based UI framework (optional)
