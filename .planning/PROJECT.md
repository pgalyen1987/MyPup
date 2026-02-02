# MyPup - Technical Refactoring Project

## One-Liner

Refactor MyPup 2D platformer to improve architecture, code quality, and performance while migrating to TypeScript, maintaining all existing functionality, and ensuring GitHub Pages compatibility.

## Context

MyPup is a retro 16-bit platformer game where players upload a photo of their dog to generate a custom sprite sheet character. The game uses Google Gemini 3 API for AI-powered asset generation, including location-based backgrounds and level tiles that adapt to the player's IP geolocation, weather conditions, and time of day.

The codebase is functional but has accumulated technical debt across architecture, code quality, performance, and error handling. This project addresses these concerns systematically while maintaining backward compatibility and preparing for a TypeScript migration.

**Current State:**
- Working game with Phaser.js 3.80.1
- JavaScript ES6+ with no build step
- Client-side only, hosted on GitHub Pages
- AI-powered asset generation via Gemini API
- IndexedDB caching for generated assets
- Location-based background and tile generation

**Target State:**
- TypeScript codebase with proper type safety
- Improved architecture with reduced coupling
- Better code quality (no magic numbers, consistent patterns)
- Performance optimizations (parallel asset generation, memory management)
- Comprehensive error handling and recovery
- Maintained compatibility with existing saves/cache
- GitHub Pages compatible build output

## Requirements

### Validated

- ✓ Custom dog character sprite sheet generation — existing (Gemini API analysis + generation)
- ✓ Location-based background generation — existing (8-frame animated backgrounds from IP geolocation)
- ✓ Context-aware level tiles — existing (platform, water, treat, bone tiles based on location/weather)
- ✓ Phaser.js game engine integration — existing (physics, rendering, animations)
- ✓ Asset caching in IndexedDB — existing (persistent storage for generated assets)
- ✓ Level generation from CSV — existing (tile-based level system)
- ✓ Player controls and physics — existing (arrow keys, spacebar, jump, movement)
- ✓ Enemy AI and behavior — existing (cat enemies with patrol patterns)
- ✓ Collectible system — existing (treats and bones for scoring)
- ✓ Score and lives tracking — existing (game state management)
- ✓ Debug mode toggle — existing (D key, physics visualization)
- ✓ GitHub Pages deployment — existing (static file hosting)

### Active

- [ ] Migrate JavaScript codebase to TypeScript
- [ ] Set up TypeScript build pipeline compatible with GitHub Pages
- [ ] Refactor global state management (reduce window.* dependencies)
- [ ] Implement dependency injection pattern
- [ ] Reduce tight coupling between modules
- [ ] Extract magic numbers to CONFIG constants
- [ ] Move hardcoded animation frame indices to configuration
- [ ] Implement parallel background frame generation
- [ ] Optimize memory usage for large base64 assets
- [ ] Add asset cleanup on scene destroy
- [ ] Implement comprehensive error handling with retry logic
- [ ] Add fallback default assets for error recovery
- [ ] Create consistent error handling patterns
- [ ] Add progress indicators for long asset generation operations
- [ ] Improve error messages with recovery options
- [ ] Set up basic automated testing framework
- [ ] Add type definitions for Phaser.js
- [ ] Ensure no breaking changes to existing functionality
- [ ] Maintain IndexedDB cache compatibility
- [ ] Verify GitHub Pages deployment after build

### Out of Scope

- Backend API proxy for API key security — Will use Google API domain restrictions (handled separately)
- Complete test coverage — Basic test suite only, not comprehensive
- Full module system migration — Keep script-based loading, improve organization
- Offline mode support — Online mode only (API-dependent)
- Major feature additions — Focus on refactoring, not new features
- TypeScript strict mode migration — Gradual migration, allow `any` where needed initially
- Performance profiling tools — Manual optimization based on identified concerns

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Migrate to TypeScript | Improve type safety, developer experience, and maintainability | — Pending |
| Keep Phaser.js and Google Gemini | Core dependencies, well-integrated | — Confirmed |
| GitHub Pages static hosting | Current deployment method, no backend available | — Confirmed |
| No breaking changes | Maintain user experience and cache compatibility | — Confirmed |
| Address architecture/quality/performance first | Highest impact improvements before error handling | — Pending |
| Use Google API domain restrictions | Client-side security without backend proxy | — Pending (user to handle) |
| Parallel asset generation | Reduce initial load time from 60-80s to ~10-15s | — Pending |
| Dependency injection pattern | Reduce tight coupling, improve testability | — Pending |
| Extract all magic numbers | Consistency with CONFIG pattern, easier tuning | — Pending |

## Constraints

### Hard Constraints

1. **Tech Stack**: Must keep Phaser.js 3.80.1 and Google Gemini API integration
2. **TypeScript Migration**: Required for improved code quality
3. **Browser Compatibility**: Modern browsers only (Chrome, Firefox, Safari, Edge)
4. **Hosting**: Must be deployable to GitHub Pages (static files only, no backend)
5. **Backward Compatibility**: No breaking changes to existing functionality or cache format
6. **Deadline**: February 8th, 2026 (6 days from project start)

### Soft Constraints

- Prefer incremental refactoring over big-bang rewrite
- Maintain existing file structure where possible
- Keep debug mode functionality intact
- Preserve all game mechanics and features

## Success Criteria

### Architecture Improvements
- [ ] Global state reduced (minimal window.* usage)
- [ ] Dependency injection implemented for core classes
- [ ] Reduced coupling between Game, APIService, CharacterManager
- [ ] Clear separation of concerns

### Code Quality Improvements
- [ ] All magic numbers moved to CONFIG
- [ ] Animation frame indices configurable
- [ ] Consistent error handling patterns
- [ ] TypeScript types for all major interfaces
- [ ] No `any` types in critical paths (where feasible)

### Performance Improvements
- [ ] Background frames generate in parallel (or with progress indicator)
- [ ] Memory usage optimized (asset cleanup, lazy loading)
- [ ] Initial load time reduced (caching strategy improved)
- [ ] No memory leaks on scene destroy

### Error Handling Improvements
- [ ] Retry logic with exponential backoff for API calls
- [ ] Fallback default assets available
- [ ] Progress indicators for long operations
- [ ] User-friendly error messages with recovery options
- [ ] Consistent error handling across all modules

### TypeScript Migration
- [ ] All .js files converted to .ts
- [ ] Type definitions for Phaser.js added
- [ ] Build pipeline creates GitHub Pages compatible output
- [ ] No runtime errors from type mismatches

### Compatibility
- [ ] Existing IndexedDB cache still works
- [ ] Game functionality unchanged
- [ ] GitHub Pages deployment successful
- [ ] All browsers tested and working

## Risks

### High Risk
- **TypeScript migration complexity**: Large codebase (2700+ lines in game.js alone), potential for breaking changes
  - *Mitigation*: Incremental migration, thorough testing, maintain JS fallback during transition

- **Deadline pressure**: 6 days for significant refactoring
  - *Mitigation*: Prioritize highest-impact changes, defer non-critical improvements

- **Breaking existing functionality**: Risk of introducing bugs during refactoring
  - *Mitigation*: No breaking changes constraint, comprehensive testing, incremental changes

### Medium Risk
- **GitHub Pages build compatibility**: TypeScript build output must work with static hosting
  - *Mitigation*: Test build output early, ensure CDN compatibility

- **Performance regressions**: Refactoring might introduce performance issues
  - *Mitigation*: Performance testing, monitor memory usage, profile critical paths

- **Cache compatibility**: IndexedDB format changes might break existing user data
  - *Mitigation*: Maintain cache format, add migration if needed

### Low Risk
- **Browser compatibility**: TypeScript output should work in all modern browsers
  - *Mitigation*: Target ES6+, test in multiple browsers

## Timeline Context

**Project Start**: February 2nd, 2026
**Deadline**: February 8th, 2026
**Duration**: 6 days

**Approximate Time Allocation** (estimated):
- TypeScript setup and migration: 2-3 days
- Architecture refactoring: 1-2 days
- Performance optimizations: 1 day
- Error handling improvements: 1 day
- Testing and bug fixes: 1 day

*Note: These are estimates. Actual time may vary based on complexity discovered during implementation.*

## Related Documents

- `.planning/codebase/ARCHITECTURE.md` - Current system architecture
- `.planning/codebase/STACK.md` - Technology stack details
- `.planning/codebase/STRUCTURE.md` - Project structure and organization
- `.planning/codebase/CONVENTIONS.md` - Code style and conventions
- `.planning/codebase/CONCERNS.md` - Detailed technical concerns (17 issues identified)
- `.planning/codebase/INTEGRATIONS.md` - External API integrations
- `.planning/codebase/TESTING.md` - Testing strategy and gaps

---
*Last updated: 2026-02-02 after initialization*
