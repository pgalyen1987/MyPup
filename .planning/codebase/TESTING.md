# Testing

## Current Testing State

### Test Coverage
- **No automated tests** - Project has no test files or test framework
- **Manual testing only** - Testing done through browser interaction
- **No test configuration** - No Jest, Mocha, or other test runner configured

### Test Files
- No `*.test.ts` or `*.spec.ts` files found
- No test directory structure
- No test utilities or helpers

## Testing Strategy (Recommended)

### Unit Testing

#### Testable Components
1. **AssetStorage** - Storage operations
   - `init()`, `setItem()`, `getItem()`, `removeItem()`
   - IndexedDB mocking required

2. **ErrorHandler** - Error handling logic
   - Error type classification
   - Retry logic
   - Error context building

3. **Image Processing Utilities** (in `api.ts`)
   - `resizeImageToExactSize()`
   - `removeLimeGreenBackground()`
   - `validateImageContent()`

4. **Configuration** (`config.ts`)
   - Config structure validation
   - Default value verification

### Integration Testing

#### API Integration
- **APIService** - External API calls
  - Mock fetch API
  - Test error handling
  - Test retry logic
  - Test image generation flow

#### Game Logic
- **Game class** - Core game functionality
  - Phaser mocking required
  - Scene lifecycle testing
  - Physics interactions

### End-to-End Testing

#### User Flows
1. **Character Upload Flow**
   - Upload image
   - Generate sprite sheet
   - Start game

2. **Background Generation Flow**
   - Location detection
   - Weather fetching
   - Background generation
   - Game start with background

3. **Gameplay Flow**
   - Player movement
   - Collision detection
   - Collectible collection
   - Enemy interaction

## Testing Challenges

### External Dependencies
- **Phaser.js** - Complex game framework, requires mocking
- **Gemini API** - External service, requires API key and mocking
- **IndexedDB** - Browser API, requires polyfill/mocking
- **Canvas API** - Image processing, requires canvas mocking

### Async Operations
- Multiple async operations (API calls, asset loading)
- Timing-dependent operations
- Race conditions possible

### Browser APIs
- FileReader API
- Fetch API
- IndexedDB
- Canvas API
- localStorage

## Recommended Testing Tools

### Test Framework
- **Jest** - Popular, good TypeScript support
- **Vitest** - Fast, Vite-based, good ES modules support
- **Mocha + Chai** - Flexible, widely used

### Mocking Libraries
- **jsdom** - DOM/Canvas mocking
- **fake-indexeddb** - IndexedDB mocking
- **msw (Mock Service Worker)** - API mocking
- **Phaser mock** - Custom Phaser mocking (may need to create)

### Test Utilities
- **@testing-library/dom** - DOM testing utilities
- **canvas-prebuilt** - Canvas polyfill for Node.js

## Test Structure (Proposed)

```
src/
├── __tests__/           # Test files
│   ├── api.test.ts
│   ├── AssetStorage.test.ts
│   ├── error-handler.test.ts
│   ├── config.test.ts
│   └── game.test.ts
├── __mocks__/           # Mock implementations
│   ├── phaser.ts
│   ├── indexeddb.ts
│   └── fetch.ts
└── utils/               # Test utilities
    ├── test-helpers.ts
    └── mock-factories.ts
```

## Manual Testing Checklist

### Character Customization
- [ ] Upload dog photo
- [ ] Sprite sheet generation succeeds
- [ ] Sprite sheet displays correctly
- [ ] Animations work (walk, jump, idle)

### Background Generation
- [ ] Location detected correctly
- [ ] Weather data fetched
- [ ] Background frames generated (8 frames)
- [ ] Background animates at 2 fps
- [ ] Background displays correctly

### Gameplay
- [ ] Player spawns correctly
- [ ] Player movement (left/right)
- [ ] Player jumping
- [ ] Collision with floor
- [ ] Enemy spawning and movement
- [ ] Collectible collection
- [ ] Score updates
- [ ] Lives system

### Error Handling
- [ ] Invalid API key handling
- [ ] Network error handling
- [ ] Image generation failure
- [ ] Asset loading failure

### Performance
- [ ] Large sprite sheet loading
- [ ] Background frame loading
- [ ] Memory usage (no leaks)
- [ ] Frame rate (60 fps target)

## Testing Best Practices (Future)

### Unit Tests
- Test one thing at a time
- Mock external dependencies
- Test edge cases
- Test error conditions

### Integration Tests
- Test component interactions
- Use real APIs in test environment
- Test data flow
- Test error propagation

### E2E Tests
- Test complete user flows
- Use real browser (Playwright, Cypress)
- Test across browsers
- Test on different screen sizes

### Test Data
- Use fixtures for test data
- Mock API responses
- Use deterministic data
- Clean up after tests

## Continuous Integration (Future)

### CI Pipeline
- Run tests on PR
- Run tests on merge
- Check code coverage
- Lint code
- Build verification

### Coverage Goals
- Unit tests: 80%+ coverage
- Integration tests: Critical paths
- E2E tests: Main user flows

## Current Testing Approach

### Development Testing
- Manual browser testing
- Console logging for debugging
- Error handler logging
- Visual inspection

### Debugging Tools
- Browser DevTools
- Console logging
- Error handler diagnostics
- Phaser debug mode

### Known Issues
- No automated regression testing
- Manual testing time-consuming
- Difficult to test edge cases
- No performance benchmarking
