# Architecture

## System Overview

MyPup is a client-side retro 16-bit platformer game built with Phaser.js. The application uses AI (Google Gemini) to generate custom sprite sheets from user-uploaded dog photos and location-based backgrounds.

## Architecture Pattern

**Modular ES6 Module Architecture** with dependency injection:
- TypeScript modules with explicit imports/exports
- Constructor injection for dependencies
- No global state (except window exports for backward compatibility during refactoring)

## Core Components

### 1. Main Bootstrap (`main.ts`)
- **Role**: Application entry point
- **Responsibilities**:
  - Initialize services (AssetStorage, APIService)
  - Wire dependencies via constructor injection
  - Start background generation immediately on page load
  - Initialize CharacterManager with all dependencies
- **Dependencies**: All other modules

### 2. Configuration (`config.ts`)
- **Role**: Centralized configuration management
- **Structure**: 
  - TypeScript interfaces for type safety
  - Nested configuration objects (ANIMATION, PHYSICS, TIMING, VISUAL, API)
  - API key management with localStorage fallback
  - Debug mode toggle
- **Pattern**: Singleton-like export (`CONFIG`)

### 3. API Service (`api.ts`)
- **Role**: External API integration
- **Responsibilities**:
  - Gemini API communication (text/vision analysis, image generation)
  - Location/weather API integration
  - Image processing (resizing, background removal)
  - Error handling and retry logic
- **Pattern**: Service class with async methods

### 4. Game Engine (`game.ts`)
- **Role**: Core game logic and Phaser integration
- **Responsibilities**:
  - Phaser scene management (preload, create, update)
  - Player/enemy/collectible creation and management
  - Physics and collision detection
  - Background rendering and animation
  - Level generation (simple floor-based)
- **Pattern**: Class-based with Phaser lifecycle hooks

### 5. Character Manager (`character.ts`)
- **Role**: Character customization UI and flow
- **Responsibilities**:
  - File upload handling
  - Sprite sheet generation coordination
  - Ready state checking
  - Game initialization
- **Pattern**: Manager class with UI coordination

### 6. Asset Storage (`AssetStorage.ts`)
- **Role**: Large asset persistence
- **Responsibilities**:
  - IndexedDB wrapper for large base64 assets
  - Async storage operations
  - Bypassing localStorage size limits
- **Pattern**: Service class with async methods

### 7. Error Handler (`error-handler.ts`)
- **Role**: Centralized error handling
- **Responsibilities**:
  - Custom error types
  - Error logging and context
  - Retry logic with exponential backoff
  - User-friendly error messages
- **Pattern**: Utility module with class-based error types

## Data Flow

### Sprite Sheet Generation Flow
1. User uploads dog photo → `CharacterManager`
2. `CharacterManager` calls `APIService.analyzeDogImageAndCreatePrompt()`
3. Gemini analyzes image → generates detailed prompt
4. `APIService.generateSpriteSheet()` → Gemini generates sprite sheet
5. Image processed (resize, background removal if needed)
6. Stored in `AssetStorage` (IndexedDB)
7. `Game` class loads from storage on game start

### Background Generation Flow
1. Page load → `main.ts` checks for API key
2. If key exists and no valid cache → `APIService.generateLocationBackground()`
3. Get location (ipapi.co) → Get weather (Open-Meteo)
4. Generate prompt → Generate 8 frames sequentially
5. Store frames in `AssetStorage`
6. `Game.updateBackground()` loads frames and creates Phaser textures
7. Background animates at 2 fps

### Game Initialization Flow
1. DOM ready → `main.ts` initializes services
2. User uploads dog photo → sprite sheet generated
3. Background generated (async, non-blocking)
4. `CharacterManager.checkReadyState()` polls for readiness
5. When ready → "Start Game" button enabled
6. User clicks → `Game` class instantiated
7. Phaser scene loads → assets from `AssetStorage`
8. Game starts

## Design Patterns

### Dependency Injection
- Services passed via constructors
- No global singletons (except CONFIG)
- Example: `CharacterManager(apiService, assetStorage, Game)`

### Service Layer
- `APIService` - External API abstraction
- `AssetStorage` - Storage abstraction
- Clear separation of concerns

### Observer Pattern (Implicit)
- Phaser's event system for game lifecycle
- Polling for asset readiness (`checkReadyState`)

### Strategy Pattern
- Different image processing strategies (resize, background removal)
- Configurable animation speeds, physics parameters

## Module Dependencies

```
main.ts
├── config.ts (CONFIG)
├── api.ts (APIService)
├── AssetStorage.ts (AssetStorage)
├── character.ts (CharacterManager)
└── game.ts (Game)

game.ts
├── config.ts (CONFIG)
├── api.ts (APIService - type only)
├── AssetStorage.ts (AssetStorage - type only)
└── error-handler.ts (errorHandler)

api.ts
└── config.ts (CONFIG)

character.ts
├── api.ts (APIService)
├── AssetStorage.ts (AssetStorage)
└── game.ts (Game - type only)

error-handler.ts
└── config.ts (CONFIG)
```

## State Management

### Application State
- **localStorage**: API keys, metadata, small config
- **IndexedDB**: Large assets (sprite sheets, backgrounds)
- **In-Memory**: Game state (score, lives, player position)
- **Phaser Registry**: Scene-level state

### No Global State
- All state either in classes or storage
- No global variables (except window exports for compatibility)

## Error Handling Strategy

### Centralized Error Handler
- `ErrorHandler` class with custom error types
- Structured error context
- Retry logic with exponential backoff
- User-friendly messages

### Error Types
- API_ERROR, NETWORK_ERROR, ASSET_LOAD_ERROR
- TEXTURE_ERROR, ANIMATION_ERROR, VALIDATION_ERROR
- TIMEOUT_ERROR, UNKNOWN_ERROR

## Performance Considerations

### Asset Loading
- Lazy loading for background frames
- Caching in IndexedDB
- Base64 encoding for storage

### Game Loop
- Phaser's optimized update cycle
- Efficient collision detection (Arcade Physics)
- Background animation at 2 fps (low overhead)

### Memory Management
- Asset cleanup on scene destroy
- Texture disposal
- Timer cleanup

## Security Considerations

### Client-Side Only
- API keys visible in source code
- No backend proxy
- Security warnings in README

### API Key Storage
- localStorage (visible to user)
- No encryption
- User responsible for key security
