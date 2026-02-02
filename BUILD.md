# Build Instructions

## TypeScript Build Pipeline

This project uses TypeScript for type safety and better code quality. The build process compiles TypeScript files from `src/` to JavaScript files in `dist/`.

### Prerequisites

- Node.js (v18 or higher)
- npm

### Setup

```bash
npm install
```

### Build Commands

**Production Build:**
```bash
npm run build
```
Compiles all TypeScript files from `src/` to `dist/`.

**Development (Watch Mode):**
```bash
npm run watch
```
Automatically recompiles TypeScript files when changes are detected.

### Output

- **Source**: `src/**/*.ts`
- **Output**: `dist/**/*.js`
- **Format**: ES2020 modules (compatible with modern browsers)

### GitHub Pages Deployment

The `dist/` directory contains the compiled JavaScript files that should be served by GitHub Pages. The HTML file will be updated to load these compiled files instead of the source JavaScript files.

### File Structure

```
MyPup/
├── src/           # TypeScript source files
├── dist/          # Compiled JavaScript (gitignored)
├── tsconfig.json  # TypeScript configuration
└── package.json   # Dependencies and scripts
```

### Notes

- Individual files are output (not bundled) for better debugging and GitHub Pages compatibility
- ES2020 modules are used (modern browsers only)
- Source maps are disabled for production
- Type declarations are not generated (not needed for runtime)

---
*Last updated: 2026-02-02*
