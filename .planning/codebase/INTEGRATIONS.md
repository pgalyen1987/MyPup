# External Integrations

## API Integrations

### Google Gemini API

#### Purpose
- **Image Analysis**: Analyze uploaded dog photos to extract features
- **Image Generation**: Generate sprite sheets and background images
- **Text Generation**: Create detailed prompts for image generation

#### Endpoints Used

1. **Text/Vision Analysis**
   - URL: `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
   - Models:
     - Production: `gemini-3-pro-image-preview`
     - Debug: `gemini-2.5-flash`
   - Method: POST
   - Authentication: API key in query parameter
   - Used for: Dog image analysis, prompt generation

2. **Image Generation**
   - URL: `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
   - Models:
     - Production: `gemini-3-pro-image-preview`
     - Debug: `gemini-2.5-flash-image`
   - Method: POST
   - Authentication: API key in query parameter
   - Used for: Sprite sheet generation, background frame generation

#### Request Format
```typescript
{
  contents: [{
    parts: [
      { text: "prompt text" },
      { inline_data: { mime_type: "image/png", data: "base64..." } }
    ]
  }],
  generationConfig: {
    temperature: 0.4,
    maxOutputTokens: 8192
  }
}
```

#### Response Format
```typescript
{
  candidates: [{
    content: {
      parts: [{
        text: "response text" | { inline_data: { mime_type: "image/png", data: "base64..." } }
      }]
    }
  }]
}
```

#### Error Handling
- Structured error parsing
- Retry logic with exponential backoff
- User-friendly error messages
- API key validation

#### Rate Limiting
- No explicit rate limiting implemented
- Sequential frame generation (8 frames for background)
- Potential for rate limit issues with high usage

#### Security

**Production Mode (Backend Proxy)**:
- ✅ API key stored in Google Cloud environment variables
- ✅ API key never sent to frontend
- ✅ Backend proxy handles all API calls
- ✅ Safe for public GitHub Pages hosting
- ✅ CORS configured for specific domain

**Development Mode (Direct API)**:
- ⚠️ API key stored in localStorage (visible to user)
- ⚠️ API key in URL query parameter (visible in network logs)
- ⚠️ Security warnings in README
- ⚠️ Not recommended for production

#### Backend Proxy Integration
- **Endpoint**: Google Cloud Function URL (e.g., `https://apiproxy-xxxxx-uc.a.run.app`)
- **Request Format**: Wrapped in `{ endpoint, model, requestBody }`
- **Response Format**: Same as direct API (transparent proxy)
- **Configuration**: `USE_BACKEND_PROXY: true` in `src/config.ts`

### IP Geolocation API (ipapi.co)

#### Purpose
- Detect user location for location-based background generation

#### Endpoint
- URL: `https://ipapi.co/json/`
- Method: GET
- Authentication: None (free tier)
- Rate Limits: Unknown (free tier)

#### Response Format
```typescript
{
  city: string;
  region: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
}
```

#### Error Handling
- Fallback to default location if API fails
- Timeout handling
- Network error handling

### Open-Meteo API

#### Purpose
- Get weather data for location-based background generation

#### Endpoint
- URL: `https://api.open-meteo.com/v1/forecast`
- Method: GET
- Parameters:
  - `latitude`: number
  - `longitude`: number
  - `current`: "weather_code,precipitation"
  - `timezone`: "auto"
- Authentication: None (free, no API key)

#### Response Format
```typescript
{
  current: {
    weather_code: number;
    precipitation: number;
  }
}
```

#### Error Handling
- Fallback to default weather if API fails
- Timeout handling
- Network error handling

## CDN Integrations

### Phaser.js (jsDelivr CDN)

#### Purpose
- Game framework library

#### Integration
- URL: `https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js`
- Loaded via `<script>` tag in `index.html`
- Global `Phaser` object available
- Version: 3.80.1 (pinned)

#### Dependencies
- WebGL support required
- Web Audio API (optional)

## Browser APIs

### IndexedDB

#### Purpose
- Store large base64-encoded assets (sprite sheets, background frames)
- Bypass 5MB localStorage limit

#### Implementation
- Wrapped in `AssetStorage` class
- Async operations
- Database name: `MyPupAssets`
- Object store: `assets`

#### Operations
- `init()` - Initialize database
- `setItem(key, value)` - Store asset
- `getItem(key)` - Retrieve asset
- `removeItem(key)` - Delete asset

### localStorage

#### Purpose
- Store API keys
- Store metadata (small JSON objects)
- Store configuration

#### Usage
- Synchronous API
- JSON serialization for objects
- String storage for API keys

### FileReader API

#### Purpose
- Read uploaded image files
- Convert to base64 for API submission

#### Usage
- `FileReader.readAsDataURL()`
- Async operation
- Base64 data URL format

### Canvas API

#### Purpose
- Image processing (resizing)
- Background removal (color detection)
- Image validation (brightness, black pixel detection)

#### Usage
- `HTMLCanvasElement` for image manipulation
- `CanvasRenderingContext2D` for pixel access
- Image data manipulation

### Fetch API

#### Purpose
- HTTP requests to external APIs
- Gemini API calls
- Location/weather API calls

#### Usage
- Standard `fetch()` API
- JSON request/response
- Error handling with try/catch

## Integration Patterns

### Sequential API Calls
- Background generation: 8 frames generated sequentially
- Each frame uses previous frames as reference
- Slower but ensures consistency

### Parallel Operations
- Background generation starts immediately on page load
- Non-blocking (doesn't wait for DOM)
- Character customization can happen simultaneously

### Caching Strategy
- API responses cached in IndexedDB
- Metadata cached in localStorage
- Cache versioning for invalidation
- Cache age checking (24 hours for backgrounds)

### Error Recovery
- Retry logic with exponential backoff
- Fallback to cached assets
- User-friendly error messages
- Graceful degradation

## Integration Dependencies

### External Services
- Google Gemini API (required for core functionality)
- ipapi.co (optional, for location-based backgrounds)
- Open-Meteo API (optional, for weather-based backgrounds)

### Browser Requirements
- Modern browser with ES2020 support
- IndexedDB support
- Canvas API support
- Fetch API support
- WebGL support (for Phaser)

## Security Considerations

### API Keys
- Stored client-side (visible to users)
- No encryption
- User responsible for key security
- Should be revoked if exposed

### Data Privacy
- User images sent to Gemini API
- Location data sent to ipapi.co
- No data stored on application server
- All data client-side only

### CORS
- All APIs support CORS
- No CORS issues expected
- CDN resources accessible

## Rate Limiting & Quotas

### Gemini API
- Unknown rate limits (depends on API key tier)
- Sequential frame generation reduces rate limit risk
- Potential for quota exhaustion with high usage

### ipapi.co
- Free tier available
- Rate limits unknown
- No authentication required

### Open-Meteo
- Free, no API key
- Rate limits unknown
- Public API

## Backend Integration

### Google Cloud Functions Proxy

#### Purpose
- Secure API key management
- Hide API key from frontend
- Enable public GitHub Pages hosting

#### Implementation
- **File**: `backend/index.js`
- **Function**: `apiProxy`
- **Runtime**: Node.js 20
- **Trigger**: HTTP (public)

#### Request Flow
1. Frontend sends request to backend URL
2. Backend receives `{ endpoint, model, requestBody }`
3. Backend adds API key from environment variable
4. Backend forwards to Gemini API
5. Backend returns response to frontend

#### Configuration
- API key set during deployment: `--set-env-vars GEMINI_API_KEY=$GEMINI_API_KEY`
- CORS headers configured for GitHub Pages
- Memory: 512MB
- Timeout: 540s (for long image generation)

#### Deployment
- Deployed via `gcloud functions deploy`
- Region: us-central1
- Public endpoint (no authentication required)
- Auto-scaling based on traffic

## Future Integration Considerations

### Potential Additions
- ✅ Backend proxy for API keys (security) - **IMPLEMENTED**
- Analytics integration (usage tracking)
- Error reporting service (Sentry, etc.)
- CDN for generated assets (performance)
- Rate limiting in backend
- Request quotas per user

### Improvements Needed
- ✅ API key security (backend proxy) - **IMPLEMENTED**
- Rate limiting handling (backend-side)
- Quota monitoring (Cloud Monitoring)
- Error reporting service
- Request logging and analytics