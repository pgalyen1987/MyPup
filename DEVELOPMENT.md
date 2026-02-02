# Development Workflow

## Overview

This project uses TypeScript for development and compiles to JavaScript for deployment. The build process outputs individual ES2020 module files that are compatible with modern browsers and GitHub Pages.

## Development Setup

### Prerequisites
- Node.js v18 or higher
- npm

### Initial Setup
```bash
npm install
```

## Development Commands

### Watch Mode (Recommended for Development)
```bash
npm run watch
```
Automatically recompiles TypeScript files when you save changes. Keep this running while developing.

### Production Build
```bash
npm run build
```
Compiles all TypeScript files once. Use this before committing or deploying.

## File Structure

```
MyPup/
├── src/              # TypeScript source files (development)
│   ├── *.ts         # TypeScript files
│   └── phaser.d.ts  # Phaser type definitions
├── dist/             # Compiled JavaScript (generated, gitignored)
│   └── *.js         # Compiled output files
├── *.js              # Original JavaScript files (will be migrated to src/)
└── index.html        # HTML entry point
```

## Workflow

### During Development
1. Edit TypeScript files in `src/`
2. Run `npm run watch` to auto-compile
3. Test in browser (will load from `dist/` after migration)
4. Commit changes

### Before Deployment
1. Run `npm run build` to ensure latest changes are compiled
2. Verify `dist/` contains all necessary files
3. Deploy to GitHub Pages (dist/ files will be served)

## Migration Status

**Phase 1 (Current)**: TypeScript setup complete
- ✅ TypeScript configuration
- ✅ Build pipeline
- ✅ Phaser type definitions
- ⏳ HTML update (will be done in Phase 2)

**Phase 2 (Next)**: Code migration
- JavaScript files will be moved to `src/` and converted to `.ts`
- HTML will be updated to load from `dist/`
- Original `.js` files will be removed after migration

## TypeScript Configuration

- **Target**: ES2020 (modern browsers)
- **Module**: ES2020 modules
- **Strict Mode**: Disabled (gradual migration)
- **Source Maps**: Disabled (production)
- **Output**: Individual files (not bundled)

## Browser Compatibility

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support  
- Safari: ✅ Full support (ES2020 modules supported)
- Mobile browsers: ✅ Works (modern browsers only)

## Notes

- Individual files are output (not bundled) for better debugging
- ES2020 modules require `<script type="module">` tags (will be updated in Phase 2)
- Source files in `src/` are the source of truth
- `dist/` is gitignored and regenerated on build

---
*Last updated: 2026-02-02*
