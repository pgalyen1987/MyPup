# External Integrations

## Overview
MyPup integrates with several external APIs and services for AI-powered asset generation and location-based content.

## API Integrations

### 1. Google Gemini API

#### Purpose
- **Text/Vision Analysis**: Analyze uploaded dog images and generate prompts
- **Image Generation**: Create sprite sheets, backgrounds, and tiles

#### Endpoints

**Production Mode:**
- Text/Vision: `gemini-1.5-flash:generateContent`
- Image Generation: `gemini-3-pro-image-preview:generateContent`

**Debug Mode:**
- Text/Vision: `gemini-2.5-flash:generateContent`
- Image Generation: `gemini-2.5-flash-image:generateContent`

#### Base URL
```
https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent
```

#### Authentication
- API key via query parameter: `?key={API_KEY}`
- Key stored in `config.js` or `localStorage`
- ⚠️ **Security**: Keys visible in client-side code

#### Request Format
```javascript
{
    contents: [{
        parts: [
            { text: "prompt text" },
            { inline_data: { mime_type: "image/png", data: "base64..." } }
        ]
    }],
    generationConfig: {
        temperature: 0.2,
        topK: 16,
        topP: 0.9,
        maxOutputTokens: 8192
    }
}
```

#### Response Format
```javascript
{
    candidates: [{
        content: {
            parts: [{
                inline_data: {
                    mime_type: "image/png",
                    data: "base64..."
                }
            }]
        }
    }]
}
```

#### Use Cases

**1. Dog Image Analysis**
- **Function**: `analyzeDogImageAndCreatePrompt()`
- **Model**: Gemini 1.5 Flash / 2.5 Flash
- **Input**: Base64 dog image
- **Output**: Detailed prompt for sprite generation
- **Purpose**: Extract breed, colors, markings for accurate sprite generation

**2. Sprite Sheet Generation**
- **Function**: `generateSpriteSheet()`
- **Model**: Gemini 3 Pro Image Preview / 2.5 Flash Image
- **Input**: Generated prompt + original image
- **Output**: 4×4 sprite sheet (256×256px, 16 frames)
- **Purpose**: Create custom dog character sprite sheet

**3. Background Generation**
- **Function**: `generateLocationBackground()`
- **Model**: Gemini 3 Pro Image Preview / 2.5 Flash Image
- **Input**: Location and weather context
- **Output**: 8-frame animated background (512×512px per frame)
- **Purpose**: Location-based animated backgrounds

**4. Tile Generation**
- **Function**: `generateLevelTiles()`
- **Model**: Gemini 3 Pro Image Preview / 2.5 Flash Image
- **Input**: Theme and location context
- **Output**: 4 tiles (platform, water, treat, bone) - 64×64px each
- **Purpose**: Context-aware level tiles

**5. Enemy Sprite Generation**
- **Function**: `generateEnemySpriteSheet()`
- **Model**: Gemini 3 Pro Image Preview / 2.5 Flash Image
- **Input**: Enemy type ("cat")
- **Output**: Cat sprite sheet (4×4 grid, 256×256px)
- **Purpose**: Generate enemy character sprites

#### Error Handling
- HTTP status code checking
- Response structure validation
- Error message parsing
- User-friendly error messages
- Fallback to cached assets

#### Rate Limiting
- No explicit rate limiting implemented
- Relies on API's built-in limits
- Caching reduces API calls

#### Caching Strategy
- Generated assets cached in IndexedDB
- 24-hour cache expiration for backgrounds
- Cache versioning for invalidation
- Pre-generation on page load (if API key available)

---

### 2. ipapi.co

#### Purpose
- **Geolocation**: Get user's location for context-aware backgrounds

#### Endpoint
```
GET https://ipapi.co/json/
```

#### Authentication
- **None required** - Free tier
- IP-based geolocation

#### Response Format
```javascript
{
    city: "Fredericksburg",
    region: "Virginia",
    country: "United States",
    latitude: 38.3416,
    longitude: -77.4307,
    timezone: "America/New_York"
}
```

#### Use Cases
- **Location-based backgrounds**: Use city/region for prompt generation
- **Weather context**: Coordinates passed to weather API

#### Error Handling
- Try-catch around fetch
- Fallback to default location if API fails
- Silent failure (background generation continues)

#### Caching
- Location data cached in background metadata
- 24-hour cache expiration

---

### 3. Open-Meteo API

#### Purpose
- **Weather Data**: Get current weather for contextual tile generation

#### Endpoint
```
GET https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=weather_code,precipitation&timezone=auto
```

#### Authentication
- **None required** - Free and open

#### Response Format
```javascript
{
    current: {
        weather_code: 0,
        precipitation: 0.0
    },
    // ... other fields
}
```

#### Use Cases
- **Context-aware tiles**: Weather affects tile appearance (rainy = wet tiles)
- **Time of day**: Determined from timezone and current time
- **Season**: Determined from date and location

#### Error Handling
- Try-catch around fetch
- Fallback to default weather if API fails
- Silent failure (tile generation continues with defaults)

#### Caching
- Weather data included in tile cache metadata
- Cache expiration tied to tile cache (persistent until invalidated)

---

## Data Flow

### Asset Generation Pipeline

```
1. User uploads dog image
   ↓
2. CharacterManager calls APIService
   ↓
3. APIService.analyzeDogImageAndCreatePrompt()
   → Gemini API (text/vision)
   ↓
4. APIService.generateSpriteSheet()
   → Gemini API (image generation)
   ↓
5. AssetStorage.setItem() - Cache sprite sheet
   ↓
6. Game initialization uses cached sprite sheet
```

### Background Generation Pipeline

```
1. Page load or manual trigger
   ↓
2. ipapi.co - Get location
   ↓
3. Open-Meteo - Get weather
   ↓
4. Generate location/weather prompt
   → Gemini API (text generation)
   ↓
5. Generate 8 background frames sequentially
   → Gemini API (image generation, 8 calls)
   ↓
6. AssetStorage.setItem() - Cache background
   ↓
7. Game uses cached background frames
```

### Tile Generation Pipeline

```
1. Pre-generation on page load
   ↓
2. Get location and weather (if available)
   ↓
3. Generate 4 tile prompts (platform, water, treat, bone)
   → Gemini API (text generation, 4 calls)
   ↓
4. Generate 4 tile images
   → Gemini API (image generation, 4 calls)
   ↓
5. AssetStorage.setItem() - Cache tiles
   ↓
6. Game uses cached tiles for level generation
```

## Integration Patterns

### Async/Await Pattern
All API calls use async/await:
```javascript
async generateSpriteSheet() {
    const prompt = await this.analyzeDogImageAndCreatePrompt(image);
    const spriteSheet = await this.generateImage(prompt);
    return spriteSheet;
}
```

### Error Handling Pattern
Consistent error handling:
```javascript
try {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
    }
    const data = await response.json();
    return data;
} catch (error) {
    console.error('API call failed:', error);
    throw error;
}
```

### Caching Pattern
Cache-first strategy:
```javascript
// Check cache first
const cached = await assetStorage.getItem(key);
if (cached && isValid(cached)) {
    return cached;
}

// Generate if not cached
const generated = await generateAsset();
await assetStorage.setItem(key, generated);
return generated;
```

## Security Considerations

### API Key Exposure
- ⚠️ **Critical**: API keys stored in client-side JavaScript
- Visible in source code and DevTools
- Should use backend proxy in production

### CORS
- All APIs support CORS
- No CORS issues encountered
- Requests from browser work directly

### Rate Limiting
- No client-side rate limiting
- Relies on API provider limits
- Caching reduces API calls

### Data Privacy
- User images processed by Google Gemini API
- Location data sent to ipapi.co and Open-Meteo
- No personal data stored on external servers (only generated assets cached locally)

## Dependencies

### External Services
- **Google Gemini API** - Required for game functionality
- **ipapi.co** - Optional (fallback available)
- **Open-Meteo** - Optional (fallback available)

### Browser APIs
- **Fetch API** - HTTP requests
- **IndexedDB** - Asset caching
- **localStorage** - Small data storage
- **Canvas API** - Image manipulation
- **FileReader API** - Image upload

## Failure Modes

### API Key Invalid
- Error message displayed to user
- Game cannot start without valid key
- Cached assets still usable

### Network Failure
- Error message displayed
- Fallback to cached assets if available
- Game continues with defaults if possible

### API Rate Limit
- Error message displayed
- User must wait or use cached assets
- No automatic retry mechanism

### Geolocation Failure
- Silent fallback to default location
- Background generation continues
- No user-visible error

## Future Integration Opportunities

### Potential Additions
- **Backend API Proxy** - Secure API key handling
- **Analytics** - Game usage tracking
- **Leaderboards** - Score sharing
- **Social Sharing** - Share custom characters
- **Cloud Save** - Cross-device progress
- **Multiplayer** - Real-time gameplay (would require backend)

### Integration Improvements
- **Retry Logic** - Automatic retry on API failures
- **Rate Limit Handling** - Queue and retry with backoff
- **Offline Mode** - Full functionality with cached assets
- **Progressive Enhancement** - Graceful degradation
