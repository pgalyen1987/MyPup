# Technology Stack

## Languages
- **TypeScript** (ES2020) - Primary language, compiled to JavaScript
- **JavaScript** (ES2020) - Runtime target
- **HTML5** - Markup
- **CSS3** - Styling

## Core Frameworks & Libraries

### Game Engine
- **Phaser.js 3.80.1** - 2D game framework
  - Loaded via CDN (`https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js`)
  - Used for rendering, physics, animations, asset management
  - WebGL renderer with Web Audio support

### AI/ML Services
- **Google Gemini API** - AI-powered image analysis and generation
  - `gemini-2.5-flash` / `gemini-3-pro-image-preview` - Text/vision analysis
  - `gemini-2.5-flash-image` / `gemini-3-pro-image-preview` - Image generation
  - Used for:
    - Analyzing uploaded dog photos
    - Generating sprite sheets
    - Creating location-based background images

### External APIs
- **ipapi.co** - IP geolocation for location-based backgrounds
- **Open-Meteo API** - Weather data for background generation

## Backend Infrastructure

### Google Cloud Functions (2nd Gen)
- **Runtime**: Node.js 20
- **Framework**: @google-cloud/functions-framework
- **Purpose**: Secure API proxy for Gemini API requests
- **Deployment**: Google Cloud Platform
- **Trigger**: HTTP (public endpoint)
- **Environment**: API key stored as environment variable

### Backend Dependencies
- `@google-cloud/functions-framework: ^3.3.0` - Cloud Functions runtime
- `@types/node: ^20.0.0` - TypeScript definitions

## Build Tools & Development

### Compiler
- **TypeScript 5.3.3** - Type checking and compilation
  - Target: ES2020
  - Module: ES2020
  - Module resolution: bundler
  - Output: `dist/` directory
  - Source maps: Disabled
  - Comments: Removed in production

### Development Tools
- **Node.js** - Runtime environment
- **npm** - Package manager
- **@types/node 20.10.0** - TypeScript definitions
- **Google Cloud SDK** - For backend deployment

## Storage & Persistence

### Client-Side Storage
- **localStorage** - API keys, metadata, small assets
- **IndexedDB** - Large base64-encoded assets (via `AssetStorage` class)
  - Bypasses 5MB localStorage limit
  - Stores sprite sheets, background frames

## Browser APIs Used
- **Canvas API** - Image processing (resizing, background removal)
- **FileReader API** - Reading uploaded image files
- **IndexedDB API** - Large asset storage
- **Fetch API** - HTTP requests to Gemini and weather APIs
- **WebGL** - Phaser rendering backend

## Dependencies Summary

### Production Dependencies
- None (all external via CDN or browser APIs)

### Development Dependencies
- `typescript: ^5.3.3`
- `@types/node: ^20.10.0`
- `esbuild: ^0.19.12` (listed but not actively used in build scripts)

## Build Configuration
- **TypeScript Compiler** - Primary build tool
- **No bundler** - Direct ES modules
- **No minification** - TypeScript handles comment removal
- **No source maps** - Disabled for production

## Runtime Environment

### Frontend
- **Browser** - Chrome, Firefox, Safari, Edge
- **ES Modules** - Native module support required
- **No Node.js** - Pure client-side application
- **Hosting**: GitHub Pages (static hosting)

### Backend
- **Node.js 20** - Google Cloud Functions runtime
- **Hosting**: Google Cloud Platform
- **Region**: us-central1 (configurable)
- **Scaling**: Automatic (serverless)