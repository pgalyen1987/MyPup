# Technology Stack

## Overview
MyPup is a client-side retro 16-bit platformer game built with modern web technologies and AI-powered asset generation.

## Core Technologies

### Frontend Framework
- **Phaser.js 3.80.1** - 2D game framework
  - Arcade Physics engine for collisions and movement
  - Scene-based architecture (preload, create, update lifecycle)
  - Sprite sheet and animation management
  - Camera and world bounds management

### Languages
- **JavaScript (ES6+)** - Primary language
  - Classes and modern syntax
  - Async/await for asynchronous operations
  - No build step or transpilation required

### Markup & Styling
- **HTML5** - Semantic structure
- **CSS3** - Styling and layout
  - Custom properties for theming
  - Responsive design considerations

## External Dependencies

### CDN Libraries
- **Phaser.js 3.80.1** (via jsdelivr CDN)
  - No npm/node_modules required
  - Loaded directly in `index.html`

### API Services
- **Google Gemini API** - AI-powered content generation
  - Gemini 1.5 Flash (production) / Gemini 2.5 Flash (debug) - Text/vision analysis
  - Gemini 3 Pro Image Preview (production) / Gemini 2.5 Flash Image (debug) - Image generation
  - REST API via `generativelanguage.googleapis.com`

### External Data Services
- **ipapi.co** - IP geolocation for location-based backgrounds
- **Open-Meteo API** - Weather data for contextual tile generation

## Browser APIs Used

### Storage
- **localStorage** - API keys, small metadata, cache flags
- **IndexedDB** (via AssetStorage wrapper) - Large base64 assets (sprite sheets, backgrounds)
  - Bypasses 5MB localStorage limit
  - Async storage for generated assets

### Canvas API
- Image resizing and manipulation
- Base64 encoding/decoding
- Chroma keying (green/magenta background removal)

### File API
- FileReader for image uploads
- Image element for preview and validation

## Development Tools

### Debugging
- Browser DevTools console logging
- Phaser physics debug visualization (toggle with 'D' key)
- Debug mode flag (URL parameter or localStorage)

### Testing
- `test-models.js` - Manual API model testing utility
- Console-based testing functions

## Build & Deployment

### Build System
- **None** - Pure client-side, no build step
- Files served directly via HTTP server or GitHub Pages

### Deployment
- Static file hosting
- GitHub Pages compatible
- No server-side requirements

## Configuration

### Environment
- No Node.js or npm required
- Works in any modern browser
- Kali Linux environment (per user rules)

### API Keys
- Stored in `config.js` (development)
- Stored in localStorage (runtime)
- ⚠️ Security warning: Keys visible in client-side code

## Asset Management

### Storage Strategy
- **IndexedDB** (AssetStorage class) - Large generated assets
- **localStorage** - Small metadata and flags
- Cache invalidation via version numbers and timestamps

### Asset Types
- Sprite sheets (base64 encoded PNG)
- Background frames (base64 encoded PNG)
- Level tiles (base64 encoded PNG)
- Original uploaded images

## Version Control
- Git (implied by GitHub Pages setup)
- No `.gitignore` visible (should exclude API keys)
