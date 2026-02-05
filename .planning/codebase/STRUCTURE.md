# Project Structure

## Directory Layout

```
MyPup/
├── .planning/
│   └── codebase/          # Codebase documentation (this directory)
├── assets/                # Static assets
│   ├── Cat.png           # Cat enemy sprite (fallback)
│   └── MyPupLogo.png     # Game logo
├── backend/              # Google Cloud Functions backend
│   ├── index.js         # Cloud Function entry point (API proxy)
│   ├── package.json     # Backend dependencies
│   ├── README.md        # Backend setup instructions
│   ├── DEPLOY.md        # Deployment guide
│   ├── TROUBLESHOOTING.md # Backend troubleshooting
│   └── setup.sh         # Automated setup script
├── dist/                  # Compiled JavaScript (TypeScript output)
│   ├── api.js
│   ├── AssetStorage.js
│   ├── character.js
│   ├── config.js
│   ├── error-handler.js
│   ├── game.js
│   ├── main.js
│   └── phaser.d.ts       # Phaser type definitions
├── node_modules/          # npm dependencies
├── src/                   # TypeScript source files
│   ├── api.ts            # API service (Gemini, location, weather)
│   ├── AssetStorage.ts   # IndexedDB wrapper for large assets
│   ├── character.ts      # Character customization manager
│   ├── config.ts         # Centralized configuration
│   ├── error-handler.ts  # Error handling system
│   ├── game.ts           # Main game logic (Phaser)
│   ├── main.ts           # Application entry point
│   └── phaser.d.ts       # Phaser type definitions
├── index.html            # Main HTML file
├── styles.css            # Application styles
├── package.json          # npm configuration
├── package-lock.json     # Dependency lock file
├── tsconfig.json         # TypeScript configuration
├── README.md             # Project documentation
├── BUILD.md              # Build instructions
├── DEVELOPMENT.md        # Development guide
├── GITHUB_PAGES_SETUP.md # GitHub Pages deployment guide
└── GITHUB_PAGES_WITH_BACKEND.md # Backend + GitHub Pages guide
```

## Source Files (`src/`)

### Core Modules

#### `main.ts` (Entry Point)
- **Size**: ~314 lines
- **Purpose**: Bootstrap application, wire dependencies
- **Exports**: None (side effects only)
- **Imports**: All other modules

#### `config.ts` (Configuration)
- **Size**: ~544 lines
- **Purpose**: Centralized configuration
- **Exports**: `CONFIG` object, configuration interfaces
- **Key Sections**:
  - Animation config
  - Physics config
  - Timing config
  - Visual config
  - API config

#### `api.ts` (API Service)
- **Size**: ~1529 lines
- **Purpose**: External API integration
- **Exports**: `APIService` class
- **Key Methods**:
  - `analyzeDogImageAndCreatePrompt()` - Dog image analysis
  - `generateSpriteSheet()` - Sprite sheet generation
  - `generateLocationBackground()` - Background generation
  - `generateSingleFrame()` - Individual frame generation
  - Image processing utilities

#### `game.ts` (Game Engine)
- **Size**: ~2695 lines
- **Purpose**: Core game logic
- **Exports**: `Game` class
- **Key Methods**:
  - `preload()` - Asset loading
  - `create()` - Scene initialization
  - `update()` - Game loop
  - `updateBackground()` - Background rendering
  - `createAnimations()` - Animation setup
  - `createLevel1()` - Level generation

#### `character.ts` (Character Manager)
- **Size**: ~300+ lines
- **Purpose**: Character customization UI
- **Exports**: `CharacterManager` class
- **Key Methods**:
  - `checkReadyState()` - Asset readiness polling
  - `startGame()` - Game initialization
  - File upload handling

#### `AssetStorage.ts` (Storage)
- **Size**: ~80 lines
- **Purpose**: IndexedDB wrapper
- **Exports**: `AssetStorage` class
- **Key Methods**:
  - `init()` - Database initialization
  - `setItem()` / `getItem()` / `removeItem()` - Storage operations

#### `error-handler.ts` (Error Handling)
- **Size**: ~280 lines
- **Purpose**: Centralized error handling
- **Exports**: `ErrorHandler` class, `ErrorType` enum, `AppError` class
- **Key Features**:
  - Custom error types
  - Retry logic
  - Error logging

#### `phaser.d.ts` (Type Definitions)
- **Purpose**: Phaser.js type definitions
- **Content**: TypeScript declarations for Phaser API

## Compiled Output (`dist/`)

- TypeScript compiles `src/*.ts` → `dist/*.js`
- ES2020 modules (no bundling)
- Comments removed
- Source maps disabled
- Type definitions preserved

## Module Organization

### By Responsibility
- **Configuration**: `config.ts`
- **External Services**: `api.ts`
- **Storage**: `AssetStorage.ts`
- **Game Logic**: `game.ts`
- **UI/UX**: `character.ts`
- **Error Handling**: `error-handler.ts`
- **Bootstrap**: `main.ts`

### By Layer
- **Presentation**: `index.html`, `styles.css`
- **Application**: `main.ts`, `character.ts`
- **Domain**: `game.ts`
- **Infrastructure**: `api.ts`, `AssetStorage.ts`, `error-handler.ts`
- **Configuration**: `config.ts`

## File Naming Conventions

- **TypeScript files**: `kebab-case.ts` (e.g., `error-handler.ts`)
- **JavaScript output**: `kebab-case.js` (e.g., `error-handler.js`)
- **Classes**: `PascalCase` (e.g., `APIService`, `CharacterManager`)
- **Interfaces**: `PascalCase` (e.g., `AnimationConfig`, `PhysicsConfig`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `CONFIG`, `ErrorType`)

## Import/Export Patterns

### Default Exports
- None (all named exports)

### Named Exports
- Classes: `export class APIService`
- Interfaces: `export interface AnimationConfig`
- Enums: `export enum ErrorType`
- Constants: `export const CONFIG`

### Import Patterns
- Type-only imports: `import type { APIService } from './api.js'`
- Value imports: `import { CONFIG } from './config.js'`
- Side-effect imports: `import './config.js'`

## Asset Organization

### Static Assets (`assets/`)
- Images: PNG format
- Logo: `MyPupLogo.png`
- Fallback sprites: `Cat.png`

### Generated Assets (Runtime)
- Sprite sheets: Base64, stored in IndexedDB
- Background frames: Base64 array, stored in IndexedDB
- Metadata: JSON, stored in localStorage

## Build Output Structure

```
dist/
├── *.js              # Compiled TypeScript
└── phaser.d.ts       # Type definitions (copied)
```

## Configuration Files

### `tsconfig.json`
- TypeScript compiler configuration
- Target: ES2020
- Module: ES2020
- Output: `dist/`
- Excludes: `node_modules`, `dist`, `assets`, `.planning`

### `package.json`
- Project metadata
- Build scripts: `build`, `watch`, `dev`
- Dev dependencies only

## Backend Structure (`backend/`)

### `index.js`
- **Size**: ~100 lines
- **Purpose**: Google Cloud Function that proxies Gemini API requests
- **Function**: `apiProxy` (HTTP trigger)
- **Responsibilities**:
  - Receive frontend API requests
  - Add API key from environment variable
  - Forward to Gemini API
  - Handle CORS
  - Return responses

### `package.json`
- Backend dependencies (`@google-cloud/functions-framework`)
- Deployment scripts
- Cloud Functions framework configuration

### Documentation
- `README.md` - Setup and deployment instructions
- `DEPLOY.md` - Quick deployment guide
- `TROUBLESHOOTING.md` - Common issues and solutions
- `setup.sh` - Automated setup script

## Documentation Files

- `README.md` - Project overview and setup
- `BUILD.md` - Build instructions
- `DEVELOPMENT.md` - Development guide
- `GITHUB_PAGES_SETUP.md` - Deployment guide
- `GITHUB_PAGES_WITH_BACKEND.md` - Backend + GitHub Pages guide
- `backend/README.md` - Backend setup instructions
- `backend/DEPLOY.md` - Backend deployment guide
- `backend/TROUBLESHOOTING.md` - Backend troubleshooting
- `.planning/codebase/*.md` - Codebase documentation
