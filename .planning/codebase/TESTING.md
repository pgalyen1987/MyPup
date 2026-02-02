# Testing

## Current Testing State

### Test Coverage
- **No automated tests** currently implemented
- **Manual testing** via browser and console
- **API model testing** utility available (`test-models.js`)

## Testing Utilities

### API Model Testing
**File**: `test-models.js`

**Function**: `testGeminiModels()`
- Tests availability of Gemini API models
- Checks text and image generation endpoints
- Console-based testing
- Can be run manually: `testGeminiModels()` in browser console

**Purpose**:
- Verify API key permissions
- Check model availability
- Debug API endpoint issues
- Validate API responses

### Manual Testing Workflow

1. **Open browser console**
2. **Run**: `testGeminiModels()`
3. **Check output** for model availability
4. **Verify** API responses

## Testing Areas

### 1. API Integration
**Current**: Manual testing via console
**What to test**:
- API key validation
- Image analysis (dog photo)
- Sprite sheet generation
- Background generation
- Tile generation
- Error handling

**How to test**:
- Upload dog image
- Monitor console for API calls
- Check generated assets
- Verify error messages

### 2. Game Logic
**Current**: Manual gameplay testing
**What to test**:
- Player movement and physics
- Collision detection
- Enemy AI behavior
- Collectible collection
- Score and lives system
- Level generation from CSV
- Fall detection and respawn

**How to test**:
- Play game manually
- Test edge cases (falling, collisions)
- Verify UI updates
- Check debug mode visualization

### 3. Asset Loading
**Current**: Manual verification
**What to test**:
- Sprite sheet loading
- Background frame animation
- Tile texture creation
- IndexedDB storage/retrieval
- Cache invalidation
- Fallback mechanisms

**How to test**:
- Clear cache and reload
- Check AssetStorage in DevTools
- Verify asset persistence
- Test with slow network (throttling)

### 4. UI/UX
**Current**: Manual interaction
**What to test**:
- Image upload
- Sprite generation flow
- Button states (enabled/disabled)
- Loading indicators
- Error messages
- Game start flow

**How to test**:
- Interact with UI elements
- Test error scenarios
- Verify button states
- Check loading states

### 5. Cross-Browser
**Current**: Not systematically tested
**What to test**:
- Chrome, Firefox, Safari, Edge
- IndexedDB support
- Canvas API support
- Fetch API support

## Testing Gaps

### Missing Test Types

1. **Unit Tests**
   - No test framework (Jest, Mocha, etc.)
   - No test files
   - No test runner configuration

2. **Integration Tests**
   - No automated API testing
   - No game loop testing
   - No asset pipeline testing

3. **E2E Tests**
   - No end-to-end testing framework
   - No automated gameplay testing

4. **Performance Tests**
   - No frame rate monitoring
   - No memory leak detection
   - No asset loading performance tests

5. **Accessibility Tests**
   - No a11y testing
   - No keyboard navigation tests
   - No screen reader compatibility

## Recommended Testing Strategy

### Phase 1: Manual Testing Checklist
- [ ] API key validation
- [ ] Image upload and sprite generation
- [ ] Game start and gameplay
- [ ] Collision detection
- [ ] Enemy behavior
- [ ] Collectible collection
- [ ] Score and lives
- [ ] Pause/resume
- [ ] Debug mode toggle
- [ ] Asset caching

### Phase 2: Automated Unit Tests
**Framework**: Jest or Vitest
**Test Files**:
- `__tests__/api.test.js` - API service tests
- `__tests__/game.test.js` - Game logic tests
- `__tests__/character.test.js` - Character manager tests
- `__tests__/assetStorage.test.js` - Storage tests

**Mocking**:
- Mock fetch API calls
- Mock IndexedDB
- Mock Phaser (or use headless mode)

### Phase 3: Integration Tests
**Framework**: Playwright or Cypress
**Test Scenarios**:
- Full game flow (upload → generate → play)
- Asset generation pipeline
- Error recovery
- Cache behavior

### Phase 4: Performance Tests
**Tools**: Chrome DevTools Performance tab
**Metrics**:
- Frame rate (target: 60 FPS)
- Memory usage
- Asset load times
- API response times

## Test Data

### Test Images
- Sample dog images for sprite generation
- Various image formats (JPEG, PNG)
- Different image sizes

### Test Levels
- Simple level (minimal tiles)
- Complex level (many enemies/collectibles)
- Edge cases (no platforms, all water, etc.)

### Test Scenarios
- Happy path: Upload → Generate → Play
- Error path: Invalid API key
- Error path: Network failure
- Error path: Invalid image format
- Edge case: Very large image
- Edge case: Empty level CSV

## Debugging Tools

### Browser DevTools
- **Console**: Logging and error messages
- **Network**: API call monitoring
- **Application**: IndexedDB inspection
- **Performance**: Frame rate and memory
- **Sources**: Breakpoint debugging

### Phaser Debug
- **Physics Debug**: Toggle with 'D' key
- **Visual collision boxes**
- **Scene inspector** (if available)

### Custom Debug Features
- Debug mode flag (URL parameter or localStorage)
- Console logging with context
- Error messages in UI

## Test Environment Setup

### Local Development
- HTTP server (Python, Node.js, or VS Code Live Server)
- Browser with DevTools
- API key for Gemini API

### No Test Environment Required
- Pure client-side application
- No build step needed
- No test database needed

## Continuous Integration

### Current State
- **No CI/CD pipeline**
- **No automated testing**
- **No deployment automation**

### Recommended CI Setup
- **GitHub Actions** (if using GitHub)
- **Test on push/PR**
- **Deploy to GitHub Pages on merge**

## Test Documentation

### Test Cases
- Not documented
- Should document:
  - Test scenarios
  - Expected results
  - Edge cases
  - Known issues

### Test Results
- Not tracked
- Should track:
  - Test execution history
  - Failure rates
  - Performance metrics

## Recommendations

### Immediate Actions
1. **Create manual testing checklist**
2. **Document known issues**
3. **Add more console logging for debugging**
4. **Test in multiple browsers**

### Short-term
1. **Set up Jest or Vitest**
2. **Write unit tests for API service**
3. **Write unit tests for game logic**
4. **Add test coverage reporting**

### Long-term
1. **E2E testing with Playwright**
2. **Performance monitoring**
3. **Automated regression testing**
4. **CI/CD pipeline**

## Testing Best Practices

### What's Working
✅ Manual testing workflow
✅ Console-based API testing
✅ Debug mode for visualization
✅ Error logging

### What's Missing
❌ Automated test suite
❌ Test coverage metrics
❌ Continuous testing
❌ Performance benchmarks
❌ Accessibility testing
