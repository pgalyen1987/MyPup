# System Architecture

## Overview
MyPup follows a client-side game architecture with AI-powered asset generation. The game uses Phaser.js for rendering and physics, with asynchronous asset loading and caching.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (Client)                     │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────┐  │
│  │  index.html  │───▶│  character.js│───▶│  api.js  │  │
│  │  (UI Layer)  │    │  (Character  │    │  (API    │  │
│  │              │    │   Manager)   │    │  Service)│  │
│  └──────────────┘    └──────────────┘    └──────────┘  │
│         │                    │                  │        │
│         │                    │                  │        │
│         ▼                    ▼                  ▼        │
│  ┌──────────────────────────────────────────────────┐  │
│  │              game.js (Phaser Game)                 │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │  │
│  │  │ Preload  │─▶│  Create  │─▶│    Update    │  │  │
│  │  │  Scene   │  │  Scene   │  │    Loop      │  │  │
│  │  └──────────┘  └──────────┘  └──────────────┘  │  │
│  └──────────────────────────────────────────────────┘  │
│         │                    │                  │        │
│         ▼                    ▼                  ▼        │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────┐ │
│  │ AssetStorage │    │  levels.js    │    │ config.js │ │
│  │ (IndexedDB)  │    │  (Level Data) │    │  (Config) │ │
│  └──────────────┘    └──────────────┘    └──────────┘ │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│              External APIs (Internet)                    │
├─────────────────────────────────────────────────────────┤
│  • Google Gemini API (AI generation)                    │
│  • ipapi.co (Geolocation)                                │
│  • Open-Meteo (Weather data)                             │
└─────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Game Initialization Flow

```
User Uploads Image
    ↓
character.js: handleImageUpload()
    ↓
character.js: generateSpriteSheet() (automatic)
    ↓
api.js: generateSpriteSheet()
    ├─▶ analyzeDogImageAndCreatePrompt() (Gemini 1.5/2.5 Flash)
    └─▶ Image generation (Gemini 3 Pro Image Preview/2.5 Flash Image)
    ↓
AssetStorage: Store sprite sheet
    ↓
character.js: checkReadyState()
    ↓
User clicks "Start Game"
    ↓
game.js: new Game(spriteSheetUrl)
    ↓
Phaser Game Initialization
    ├─▶ preload() - Load assets
    ├─▶ create() - Setup scene, physics, entities
    └─▶ update() - Game loop (60 FPS)
```

### 2. Asset Generation Pipeline

```
Background Generation:
    Location Detection (ipapi.co)
        ↓
    Weather Data (Open-Meteo)
        ↓
    Prompt Generation (Gemini text model)
        ↓
    8-Frame Sequential Generation (Gemini image model)
        ↓
    AssetStorage Cache

Tile Generation:
    Theme/Location Context
        ↓
    Individual Tile Prompts (Gemini text model)
        ↓
    4 Tiles Generated (platform, water, treat, bone)
        ↓
    AssetStorage Cache

Enemy Generation:
    Static Cat Sprite Sheet (one-time generation)
        ↓
    AssetStorage Cache
```

### 3. Game Loop Architecture

**Phaser Scene Lifecycle:**
1. **preload()** - Load textures, images, sounds
2. **create()** - Initialize game objects, physics, input
3. **update()** - Game loop (called every frame ~60 FPS)

**Update Loop Responsibilities:**
- Player movement and physics
- Enemy AI and movement
- Collision detection
- Camera following
- UI updates (score, lives)
- Fall detection and respawn
- Animation state management

## Design Patterns

### 1. Class-Based Architecture
- `Game` class - Main game controller
- `APIService` class - API interaction abstraction
- `CharacterManager` class - Character customization logic
- `AssetStorage` class - IndexedDB wrapper
- `LevelGenerator` class - Level generation utilities

### 2. Singleton Pattern (Implicit)
- `window.gameInstance` - Single game instance
- `window.api` - Single API service instance
- `window.assetStorage` - Single storage instance

### 3. Observer Pattern
- Event listeners for UI interactions
- Phaser input system (keyboard, mouse)
- Scene lifecycle callbacks

### 4. Factory Pattern
- Dynamic sprite sheet creation from base64
- Level generation from CSV data
- Tile creation from cached assets

### 5. Strategy Pattern
- Debug mode vs production mode (different API endpoints)
- Fallback storage (IndexedDB → localStorage)

## Data Flow

### Asset Loading Flow
```
1. Check AssetStorage (IndexedDB) cache
2. If missing/expired, generate via API
3. Store in AssetStorage
4. Convert base64 to Phaser texture
5. Create sprite sheet frames
6. Use in game
```

### Level Generation Flow
```
1. Load CSV from levels.js
2. Parse CSV into 2D array
3. Calculate level dimensions (rows × 64px)
4. Create physics bodies for each tile type
5. Spawn enemies and collectibles from CSV markers
6. Set world bounds and camera bounds
7. Create ground platform at bottom
```

### Player Input Flow
```
Keyboard Input
    ↓
Phaser Input System
    ↓
game.js: update() method
    ↓
Player physics body manipulation
    ↓
Collision detection (Arcade Physics)
    ↓
Game state updates
```

## State Management

### Game State
- Stored in `Game` class instance
- Score, lives, level data
- Player position and state
- Enemy positions and states
- Collectible states

### Persistent State
- **localStorage**: API keys, debug mode, cache flags
- **IndexedDB**: Generated assets (sprite sheets, backgrounds, tiles)

### Scene State
- Managed by Phaser scene lifecycle
- Physics world state
- Camera position and bounds
- Sprite positions and animations

## Error Handling

### API Errors
- Try-catch blocks around API calls
- Error messages displayed in UI
- Fallback to cached assets when available
- Graceful degradation (game continues with defaults)

### Asset Loading Errors
- Retry mechanisms for asynchronous loading
- Texture existence checks before use
- Fallback to programmatically generated assets

### Physics Errors
- Body existence checks before manipulation
- Immovable flag handling for static bodies
- Bounds validation

## Performance Considerations

### Asset Caching
- All generated assets cached in IndexedDB
- Cache versioning for invalidation
- 24-hour cache expiration for backgrounds

### Rendering Optimization
- Pixel-perfect rendering (no anti-aliasing)
- Sprite sheet reuse (single texture, multiple frames)
- Static platforms (no physics updates needed)

### Memory Management
- Base64 strings stored efficiently
- Texture cleanup on scene destroy
- Limited concurrent API requests

## Security Considerations

### API Key Exposure
- ⚠️ Keys stored in client-side JavaScript
- Visible in source code
- Should use backend proxy in production

### CORS
- External API calls from browser
- No CORS issues (APIs support CORS)

## Scalability

### Current Limitations
- Single level at a time
- All assets loaded upfront
- No level progression system

### Future Considerations
- Level progression and unlocking
- Dynamic level loading
- Asset streaming for large levels
- Multiplayer support (would require backend)
