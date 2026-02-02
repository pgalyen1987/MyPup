# Code Conventions

## Overview
MyPup follows JavaScript ES6+ conventions with class-based architecture. The codebase prioritizes readability and maintainability.

## Naming Conventions

### Files
- **JavaScript**: `camelCase.js` (e.g., `game.js`, `character.js`)
- **HTML/CSS**: `kebab-case` (e.g., `index.html`, `styles.css`)
- **Assets**: `PascalCase.png` or `snake_case.png` (e.g., `MyPupLogo.png`, `background_frame_1.png`)

### Classes
- **PascalCase**: `Game`, `APIService`, `CharacterManager`, `AssetStorage`, `LevelGenerator`

### Variables
- **camelCase**: `spriteSheetUrl`, `currentScene`, `uploadedImage`
- **Constants**: `UPPER_SNAKE_CASE` in CONFIG object (e.g., `GAME_WIDTH`, `TILE_SIZE`)
- **Private-like**: No true private members, but underscore prefix convention not consistently used

### Functions/Methods
- **camelCase**: `handleImageUpload()`, `generateSpriteSheet()`, `createLevel1()`
- **Verb-noun pattern**: `createLevel()`, `updateBackground()`, `collectItem()`
- **Async functions**: Explicitly marked with `async` keyword

### CSS Classes
- **kebab-case**: `.game-screen`, `.action-button`, `.debug-indicator`

### IDs
- **kebab-case**: `#game-container`, `#start-game-btn`, `#generation-status`

## Code Style

### Indentation
- **4 spaces** (not tabs)
- Consistent across all files

### Semicolons
- **Always used** - Explicit semicolons at end of statements

### Quotes
- **Single quotes** preferred for strings
- Double quotes used in JSON and HTML attributes

### Line Length
- No strict limit, but generally kept under 100-120 characters
- Long lines broken with proper indentation

### Spacing
- **Functions**: Space after `function` keyword
- **Objects**: Space after colons in object literals
- **Arrays**: No space inside brackets `[item]`
- **Operators**: Spaces around operators (`a + b`, not `a+b`)

## Class Structure

### Constructor Pattern
```javascript
class Game {
    constructor(spriteSheetUrl, initialLevelImage = null) {
        this.spriteSheetUrl = spriteSheetUrl;
        // Method binding
        this.preload = this.preload.bind(this);
        // ...
    }
}
```

### Method Binding
- Methods bound in constructor when used as callbacks
- Ensures `this` context is preserved
- Pattern: `this.methodName = this.methodName.bind(this);`

### Property Initialization
- Properties initialized in constructor
- Default values via function parameters
- No TypeScript, so no type annotations

## Function Patterns

### Async/Await
- **Preferred** over Promise chains
- Error handling with try-catch blocks
- Example:
```javascript
async generateSpriteSheet(dogDescription, imageBase64) {
    try {
        const spritePrompt = await this.analyzeDogImageAndCreatePrompt(imageBase64);
        // ...
    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
}
```

### Error Handling
- Try-catch blocks around async operations
- Error messages logged to console
- User-facing error messages in UI
- Errors re-thrown when appropriate

### Callback Patterns
- Phaser scene callbacks use wrapper functions
- `self` variable captures `this` for nested functions
- Example:
```javascript
const self = this;
scene: {
    preload: function() { self.preload(this); },
    create: function() { self.create(this); }
}
```

## Comments

### File Headers
- Brief description at top of file
- Example: `// Main game logic using Phaser.js`

### Inline Comments
- Explain "why" not "what"
- Used for complex logic or workarounds
- Debug comments left in code (e.g., `// Debug: Check texture availability`)

### TODO Comments
- Not found in current codebase (all TODOs implemented)
- Would use `// TODO: description` format if needed

### Documentation Comments
- JSDoc-style comments for some methods
- Not consistently applied across all methods
- Example:
```javascript
/**
 * Generate sprite sheet using Gemini 3 (Imagen 3 via Gemini API)
 */
async generateSpriteSheet(dogDescription, imageBase64) {
    // ...
}
```

## Constants and Configuration

### Global Config Object
- All constants in `CONFIG` object (config.js)
- UPPER_SNAKE_CASE for property names
- Grouped by category (API, Game, Sprite)

### Magic Numbers
- Avoided - use CONFIG constants
- Example: `CONFIG.TILE_SIZE` instead of `64`
- Universal tile size: `64` pixels (defined once in CONFIG)

### Hardcoded Values
- Some hardcoded values remain (e.g., animation frame indices)
- Should be moved to CONFIG for consistency

## Variable Declarations

### const vs let
- **const** preferred for values that don't change
- **let** used for variables that are reassigned
- **var** not used (ES6+ only)

### Variable Naming
- Descriptive names (e.g., `spriteSheetUrl` not `url`)
- Abbreviations avoided (e.g., `scene` not `sc`)
- Boolean prefixes: `is`, `has`, `can` (e.g., `isAttacking`, `hasTraded`)

## Object and Array Patterns

### Object Literals
- Short syntax when possible
- Properties on separate lines for readability
- Example:
```javascript
const config = {
    type: Phaser.AUTO,
    width: CONFIG.GAME_WIDTH,
    height: CONFIG.GAME_HEIGHT
};
```

### Array Methods
- Functional style preferred (map, filter, forEach)
- Arrow functions for short callbacks
- Example:
```javascript
rows.forEach((row, rowIndex) => {
    // ...
});
```

## Phaser-Specific Patterns

### Scene Lifecycle
- Methods: `preload()`, `create()`, `update()`
- Bound to Game class instance
- Scene passed as parameter

### Physics Bodies
- Arcade Physics used throughout
- Body size and offset set explicitly
- Immovable flag for static objects

### Sprite Creation
- Dynamic texture creation from base64
- Sprite sheet frame configuration
- Animation creation from frames

## API Integration Patterns

### Fetch API
- Used for all HTTP requests
- Error handling with response.ok checks
- JSON parsing with error handling

### Base64 Handling
- MIME type detection and handling
- Data URL format: `data:image/png;base64,{data}`
- Extraction: `imageBase64.split(',')[1]`

### Async Asset Loading
- Promises for asset operations
- Retry mechanisms for failed loads
- Cache checks before API calls

## Storage Patterns

### localStorage
- Simple key-value storage
- JSON.stringify/parse for objects
- Used for: API keys, flags, small metadata

### IndexedDB (AssetStorage)
- Async operations only
- Error handling for storage failures
- Fallback considerations (though not fully implemented)

## Debugging Patterns

### Console Logging
- Strategic console.log statements
- Debug mode flag controls verbosity
- Error logging with context

### Debug Mode
- Toggle with 'D' key in game
- URL parameter: `?debug=true`
- localStorage flag: `debug_mode`
- Different API endpoints in debug mode

### Physics Debug
- Phaser physics debug visualization
- Toggle with debug mode
- Shows collision boxes

## Code Organization

### File Structure
- One class per file (generally)
- Related utilities grouped together
- Global functions at file level

### Method Ordering
- Constructor first
- Lifecycle methods (preload, create, update)
- Public methods
- Private/helper methods last

### Import Dependencies
- No module system (script tags)
- Load order matters
- Dependencies loaded first

## Best Practices Followed

✅ **Consistent naming conventions**
✅ **Async/await for asynchronous code**
✅ **Error handling with try-catch**
✅ **Constants in CONFIG object**
✅ **Descriptive variable names**
✅ **Method binding for callbacks**
✅ **Comments for complex logic**

## Areas for Improvement

⚠️ **Type annotations** - Consider TypeScript
⚠️ **JSDoc comments** - More comprehensive documentation
⚠️ **Private members** - Consider using #private syntax
⚠️ **Magic numbers** - Some hardcoded values remain
⚠️ **Error types** - Custom error classes
⚠️ **Testing** - No unit tests currently
⚠️ **Linting** - No ESLint configuration visible
