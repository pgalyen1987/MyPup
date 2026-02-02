# Phase 1: TypeScript Setup & Build Pipeline

## Goal
Establish TypeScript development environment and build pipeline compatible with GitHub Pages.

## Why This Phase
Foundation for all subsequent work. Must be working before migration begins. Without a working TypeScript build pipeline, we cannot proceed with the migration.

## Success Criteria
- [ ] TypeScript compiler configured (`tsconfig.json`)
- [ ] Build pipeline produces GitHub Pages compatible output
- [ ] Phaser.js type definitions installed and working
- [ ] Development workflow established (compile, test, deploy)
- [ ] Existing functionality works with TypeScript build output
- [ ] GitHub Pages deployment verified

## Plans

### Plan 1.1: Research & Setup TypeScript Configuration
**Goal**: Research TypeScript setup options and create initial configuration

**Tasks**:
1. Research TypeScript compiler options for GitHub Pages (ES6+ output, module system)
2. Check Phaser.js type definitions availability (`@types/phaser` or official types)
3. Decide on build tool: `tsc` (simple) vs `esbuild` (faster) vs `webpack` (complex)
4. Create `tsconfig.json` with appropriate settings for GitHub Pages
5. Create `package.json` for dependency management (TypeScript, types, build tools)

**Research Needed**:
- TypeScript compiler configuration for static site hosting
- Phaser.js 3.80.1 type definitions source
- Build tool comparison for this use case

**Acceptance Criteria**:
- `tsconfig.json` exists with GitHub Pages compatible settings
- `package.json` exists with necessary dependencies
- TypeScript can compile a simple test file

---

### Plan 1.2: Set Up Build Pipeline
**Goal**: Create build process that compiles TypeScript to JavaScript for GitHub Pages

**Tasks**:
1. Configure TypeScript output directory (e.g., `dist/` or `build/`)
2. Set up build script in `package.json`
3. Ensure output JavaScript is ES6+ compatible (no module bundling needed for GitHub Pages)
4. Test compilation of a simple TypeScript file
5. Verify output works in browser

**Research Needed**:
- GitHub Pages file structure requirements
- Whether to output to root or subdirectory
- Script loading order preservation

**Acceptance Criteria**:
- `npm run build` compiles TypeScript to JavaScript
- Output files are in correct location for GitHub Pages
- Build output can be tested locally

---

### Plan 1.3: Integrate Phaser.js Type Definitions
**Goal**: Ensure Phaser.js types are available for TypeScript development

**Tasks**:
1. Install Phaser.js type definitions (`npm install --save-dev @types/phaser` or use official types)
2. Verify types work with Phaser 3.80.1
3. Create type declaration file if needed for global Phaser object
4. Test TypeScript compilation with Phaser types
5. Document any type definition issues or workarounds

**Research Needed**:
- Official Phaser.js TypeScript support
- `@types/phaser` package compatibility with 3.80.1
- Global type declarations for CDN-loaded libraries

**Acceptance Criteria**:
- Phaser.js types available in TypeScript files
- No type errors when referencing Phaser classes
- TypeScript IntelliSense works for Phaser API

---

### Plan 1.4: Update HTML & Development Workflow
**Goal**: Update project structure to support TypeScript build output

**Tasks**:
1. Update `index.html` to load compiled JavaScript instead of source `.js` files
2. Create development workflow (watch mode for auto-compilation)
3. Set up `.gitignore` to exclude build artifacts
4. Document build process in README or SETUP.md
5. Test that existing game functionality works with build output

**Research Needed**:
- Best practice for development vs production builds
- Watch mode setup for TypeScript
- GitHub Pages deployment with build artifacts

**Acceptance Criteria**:
- `index.html` loads compiled JavaScript files
- Development workflow allows live reload or watch mode
- Build artifacts are gitignored appropriately
- Game runs correctly with TypeScript build output

---

## Dependencies
- None (this is the first phase)

## Risks & Mitigation

**Risk**: Phaser.js type definitions may not be available or compatible
- *Mitigation*: Check availability first, create custom types if needed

**Risk**: Build output may not work with existing HTML structure
- *Mitigation*: Test incrementally, maintain backward compatibility

**Risk**: GitHub Pages may have issues with build output structure
- *Mitigation*: Test deployment early, follow GitHub Pages best practices

## Estimated Duration
0.5-1 day

## Notes
- Keep existing JavaScript files until migration is complete
- Build output should be in a separate directory (e.g., `dist/`)
- Consider using `tsc --watch` for development
- May need to adjust script loading order in HTML

---
*Created: 2026-02-02*
