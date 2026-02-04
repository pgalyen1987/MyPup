# Code Conventions

## TypeScript Style

### Type Safety
- **Strict mode**: Disabled (`strict: false` in tsconfig)
- **Type checking**: Enabled for interfaces and classes
- **Type-only imports**: Used for dependencies (`import type { APIService }`)
- **Any types**: Used sparingly (e.g., Phaser types: `any`)

### Naming Conventions

#### Classes
- **PascalCase**: `APIService`, `CharacterManager`, `AssetStorage`, `Game`
- **Descriptive**: Clear purpose from name

#### Interfaces
- **PascalCase**: `AnimationConfig`, `PhysicsConfig`, `ErrorContext`
- **Suffix**: Often end with `Config` or `Context`

#### Enums
- **PascalCase**: `ErrorType`
- **Values**: `UPPER_SNAKE_CASE` (e.g., `API_ERROR`, `NETWORK_ERROR`)

#### Variables & Functions
- **camelCase**: `spriteSheetUrl`, `checkReadyState()`, `generateSpriteSheet()`
- **Private members**: Prefix with `private` keyword (TypeScript)

#### Constants
- **UPPER_SNAKE_CASE**: `CONFIG`, `GEMINI_API_KEY`, `MAX_RETRY_ATTEMPTS`
- **Module-level**: Exported from `config.ts`

#### Files
- **kebab-case**: `error-handler.ts`, `AssetStorage.ts`
- **One class per file**: Generally followed

## Code Organization

### Module Structure
```typescript
// 1. Imports
import { CONFIG } from './config.js';

// 2. Type definitions (if any)
interface MyInterface { ... }

// 3. Class/function definitions
export class MyClass { ... }

// 4. Exports (if any additional)
```

### Class Structure
```typescript
export class MyClass {
    // 1. Properties (private first, then public)
    private privateProp: string;
    public publicProp: number;
    
    // 2. Constructor
    constructor(...) { ... }
    
    // 3. Methods (public first, then private)
    public publicMethod() { ... }
    private privateMethod() { ... }
}
```

### Method Ordering
- Constructor first
- Public methods before private
- Related methods grouped together
- Lifecycle methods in order (preload, create, update)

## Comments & Documentation

### File Headers
- JSDoc-style comments for major files
- Purpose and role description

### Function Comments
- JSDoc for public methods (when needed)
- Inline comments for complex logic
- TODO comments avoided (per user rules)

### Code Comments
- Explain "why" not "what"
- Complex algorithms documented
- API integration points explained

## Error Handling

### Error Types
- Custom error classes: `AppError`
- Error context objects: `ErrorContext`
- User-friendly messages: `userMessage` property

### Error Handling Pattern
```typescript
try {
    // operation
} catch (error) {
    errorHandler.handleError(
        ErrorType.API_ERROR,
        'Operation failed',
        { operation: 'methodName', module: 'ClassName' },
        error
    );
}
```

## Async/Await Patterns

### Async Functions
- All API calls use `async/await`
- No promise chains (prefer async/await)
- Error handling with try/catch

### Promise Patterns
```typescript
// Preferred
async function myFunction() {
    try {
        const result = await someAsyncOperation();
        return result;
    } catch (error) {
        // handle error
    }
}

// Avoid
function myFunction() {
    return someAsyncOperation()
        .then(result => { ... })
        .catch(error => { ... });
}
```

## Phaser Integration

### Type Handling
- Phaser types as `any` (no official types)
- Custom type definitions in `phaser.d.ts`
- Runtime checks for Phaser availability

### Scene Lifecycle
- `preload()` - Asset loading
- `create()` - Initialization
- `update()` - Game loop
- Methods bound to `this` in constructor

## Configuration Management

### Centralized Config
- All config in `config.ts`
- Nested objects by domain
- Type-safe interfaces
- Runtime access via `CONFIG` export

### Config Access Pattern
```typescript
// Import config
import { CONFIG } from './config.js';

// Access nested config
CONFIG.ANIMATION.PLAYER_WALK_RIGHT_START
CONFIG.API.GEMINI_API_URL
```

## Dependency Injection

### Constructor Injection
- Dependencies passed via constructor
- No global singletons (except CONFIG)
- Type-only imports for dependencies

### Example
```typescript
class MyClass {
    constructor(
        private apiService: APIService,
        private assetStorage: AssetStorage
    ) {}
}
```

## Storage Patterns

### localStorage
- Small data: API keys, metadata
- Synchronous access
- JSON serialization

### IndexedDB (via AssetStorage)
- Large data: Base64 assets
- Async access
- String storage (base64)

### Cache Keys
- Consistent naming: `location_background_frames`, `player_sprite_sheet`
- Versioned metadata: `location_background_meta`

## API Integration

### Error Handling
- Try/catch around all API calls
- Structured error parsing
- Retry logic with exponential backoff
- User-friendly error messages

### Request Patterns
```typescript
const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
});

if (!response.ok) {
    // handle error
}

const data = await response.json();
```

## Code Quality Rules (from user rules)

### DRY Principle
- No code duplication
- Reusable components
- Shared utilities

### No TODOs
- Complete implementations
- No "to do" statements
- Working code only

### Clean Code
- Simple and readable
- Avoid unnecessary complexity
- PEP 8-like standards (adapted for TypeScript)

### Consistency
- Single architecture
- Consistent patterns
- No discrepancies

## Formatting

### Indentation
- 4 spaces (TypeScript default)
- Consistent throughout

### Line Length
- No strict limit
- Readability prioritized

### Semicolons
- Used consistently
- TypeScript/JavaScript standard

### Quotes
- Single quotes preferred (when consistent)
- Double quotes for JSON/HTML attributes

## Testing

### Current State
- No test files found
- No test framework configured
- Manual testing only

### Future Considerations
- Unit tests for utilities
- Integration tests for API
- E2E tests for game flow
