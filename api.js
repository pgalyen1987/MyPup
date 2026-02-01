// API integration for Gemini 3

class APIService {
    constructor() {
        // Do not cache key in constructor to avoid storage race conditions
    }

    get apiKey() {
        // Try to get from CONFIG first, then localStorage
        return CONFIG.GEMINI_API_KEY || localStorage.getItem('gemini_api_key') || '';
    }

    /**
     * Verify API key by making a simple test request
     */
    async verifyApiKey() {
        if (!this.apiKey) {
            return { valid: false, error: 'No API key provided' };
        }

        try {
            // Make a simple test request to verify the key works
            const response = await fetch(
                `${CONFIG.GEMINI_API_URL}?key=${this.apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{ text: 'Say "OK" if you can read this.' }]
                        }],
                        generationConfig: {
                            temperature: 0.1,
                            maxOutputTokens: 10,
                        }
                    })
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                const errorInfo = this.parseApiError(errorText, response.status);
                return { valid: false, error: errorInfo.message };
            }

            const data = await response.json();
            if (data.candidates && data.candidates.length > 0) {
                return { valid: true };
            } else {
                return { valid: false, error: 'Invalid API response' };
            }
        } catch (error) {
            return { valid: false, error: error.message || 'Network error' };
        }
    }

    /**
     * Analyze dog image using Gemini 3 API and create a detailed prompt for sprite generation
     */
    async analyzeDogImageAndCreatePrompt(imageBase64) {
        try {
            // Extract base64 data
            let base64Data = imageBase64;
            if (imageBase64.includes(',')) {
                base64Data = imageBase64.split(',')[1];
            }

            // Determine MIME type
            let mimeType = "image/jpeg";
            if (imageBase64.startsWith('data:image/png')) mimeType = "image/png";
            else if (imageBase64.startsWith('data:image/webp')) mimeType = "image/webp";

            // Use the unified Gemini 2.0 Flash endpoint
            console.log('Analyzing image with:', CONFIG.GEMINI_API_URL);
            
            let response = await fetch(
                `${CONFIG.GEMINI_API_URL}?key=${this.apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [
                                {
                                    text: `Analyze this dog image and describe it for a retro sprite artist.
                                    
                                    Output format:
                                    1. Main visual features (breed, color, markings).
                                    2. A strict image generation prompt for a sprite sheet.
                                    
                                    The prompt must create:
                                    - A pixel art spritesheet (256x256 pixels total).
                                    - 4x4 grid (16 frames).
                                    - Frame size: 64x64 pixels.
                                    - Rows:
                                      1. Walk Right
                                      2. Walk Left
                                      3. Jump
                                      4. Idle
                                    - Style: 16-bit Super Mario World style, vibrant, cute.
                                    - Background: Transparent (or solid color if transparent not supported, will remove later).`
                                },
                                {
                                    inline_data: {
                                        mime_type: mimeType,
                                        data: base64Data
                                    }
                                }
                            ]
                        }],
                        generationConfig: {
                            temperature: 0.4,
                            maxOutputTokens: 1024,
                        }
                    })
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                throw this.parseApiError(errorText, response.status);
            }

            const data = await response.json();
            
            // Debug logging to understand structure
            if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
                console.error('Full API Response:', JSON.stringify(data, null, 2));
                
                // Check if we have a finish reason that explains the empty content
                const candidate = data.candidates?.[0];
                if (candidate?.finishReason) {
                     throw new Error(`Gemini API stopped with reason: ${candidate.finishReason}`);
                }
                
                throw new Error('Invalid response from Gemini API - Check console for details');
            }
            
            const analysis = data.candidates[0].content.parts[0].text;
            
            // Extract a refined prompt from the analysis or just append the requirement
            // For now, we'll construct a strong prompt using the analysis
            const spritePrompt = `Create a pixel art sprite sheet of a dog based on this description: ${analysis}

            Important Constraints:
            - Image Size: 256x256 pixels.
            - Grid: 4x4 (4 rows, 4 columns). Each cell is 64x64 pixels.
            - Style: 16-bit retro platformer (Nintendo SNES style).
            - Row 1: Walking Right animation (4 frames).
            - Row 2: Walking Left animation (4 frames).
            - Row 3: Jumping animation (4 frames).
            - Row 4: Idle animation (4 frames).
            - Background: solid lime green color background.
            - The dog must be clear, readable, and cute.
            - If they have clothing or accessories, they must be consistent across all frames.`;

            return spritePrompt;
        } catch (error) {
            console.error('Error analyzing dog image:', error);
            throw error;
        }
    }

    /**
     * Generate sprite sheet using Gemini 3 (Imagen 3 via Gemini API)
     */
    async generateSpriteSheet(dogDescription, imageBase64) {
        try {
            // Step 1: Analyze
            const spritePrompt = await this.analyzeDogImageAndCreatePrompt(imageBase64);
            
            console.log('Generating sprite with prompt:', spritePrompt);

            // Step 2: Generate Image
            // Note: Gemini 2.0 Flash Exp supports image generation in the same manner
            const response = await fetch(
                `${CONFIG.GEMINI_IMAGE_GEN_URL}?key=${this.apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{ text: spritePrompt }]
                        }],
                        // Requesting image result - this structure depends on the specific model version
                        // For experimental models, sometimes we just ask in text. 
                        // However, standard Imagen on Vertex/Gemini usually returns base64 in a specific field.
                        // Let's assume standard generateContent response with inline data if the model supports it.
                        generationConfig: {
                            temperature: 0.4,
                            topK: 32,
                            topP: 0.95,
                            maxOutputTokens: 8192,
                        }
                    })
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                throw this.parseApiError(errorText, response.status);
            }

            const data = await response.json();
            
            // Handle different response formats
            // Format A: candidates[0].content.parts[0].inline_data
            // Format B: candidates[0].content.parts[0].text (if it failed to generate image and returned text)
            
            const candidate = data.candidates?.[0];
            if (!candidate) throw new Error('No candidates returned');

            for (const part of candidate.content.parts) {
                if (part.inline_data || part.inlineData) {
                    const inline = part.inline_data || part.inlineData;
                    const rawBase64 = `data:${inline.mime_type || inline.mimeType};base64,${inline.data}`;
                    
                    // Post-process to remove background
                    return await this.removeSolidBackground(rawBase64);
                }
                
                // Sometimes the model might return a text link or refusal
                if (part.text && (part.text.includes("I cannot") || part.text.includes("Error"))) {
                     throw new Error(`Model Refusal: ${part.text}`);
                }
            }

            throw new Error('No image data found in response. The model may have returned text instead of an image.');
            
        } catch (error) {
            console.error('Error generating sprite sheet:', error);
            throw error;
        }
    }

    /**
     * Helper to remove solid background color (Chroma Key) from an image
     * Samples corner pixels to determine background color, then removes similar colors.
     */
    async removeSolidBackground(base64Image) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);

                const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imgData.data;
                const width = canvas.width;
                const height = canvas.height;

                // Sample corner pixels to determine background color
                // Top-left, top-right, bottom-left, bottom-right
                const corners = [
                    { x: 0, y: 0 },
                    { x: width - 1, y: 0 },
                    { x: 0, y: height - 1 },
                    { x: width - 1, y: height - 1 }
                ];
                
                // Also sample a few pixels along the edges
                const edgeSamples = [];
                for (let i = 0; i < 10; i++) {
                    edgeSamples.push({ x: Math.floor((width / 10) * i), y: 0 }); // Top edge
                    edgeSamples.push({ x: Math.floor((width / 10) * i), y: height - 1 }); // Bottom edge
                    edgeSamples.push({ x: 0, y: Math.floor((height / 10) * i) }); // Left edge
                    edgeSamples.push({ x: width - 1, y: Math.floor((height / 10) * i) }); // Right edge
                }
                
                // Collect all sample colors
                const sampleColors = [];
                [...corners, ...edgeSamples].forEach(pos => {
                    const idx = (pos.y * width + pos.x) * 4;
                    if (idx >= 0 && idx < data.length) {
                        sampleColors.push({
                            r: data[idx],
                            g: data[idx + 1],
                            b: data[idx + 2]
                        });
                    }
                });
                
                // Calculate average background color from samples
                let avgR = 0, avgG = 0, avgB = 0;
                sampleColors.forEach(color => {
                    avgR += color.r;
                    avgG += color.g;
                    avgB += color.b;
                });
                avgR = Math.round(avgR / sampleColors.length);
                avgG = Math.round(avgG / sampleColors.length);
                avgB = Math.round(avgB / sampleColors.length);
                
                console.log(`Background color detected: RGB(${avgR}, ${avgG}, ${avgB}) from ${sampleColors.length} samples`);

                // Primary method: Detect green/lime green colors (chroma key)
                const isGreenColor = (r, g, b) => {
                    // Lime green is typically high green, low red, low blue
                    // Check if green is the dominant channel
                    const greenDominance = g > r && g > b;
                    const greenRatio = g / (r + g + b + 1); // Avoid division by zero
                    
                    // Lime green typically has:
                    // - Green channel is highest
                    // - Green is at least 40% of total color
                    // - Red and blue are relatively low
                    const isLimeGreen = greenDominance && 
                                       greenRatio > 0.4 && 
                                       g > 100 && // Green must be bright enough
                                       (r + b) < g * 1.5; // Red+Blue shouldn't be too high
                    
                    // Also check for pure green (RGB where G is very high)
                    const isPureGreen = g > 150 && r < 100 && b < 100;
                    
                    return isLimeGreen || isPureGreen;
                };
                
                // Secondary method: Check against average background color
                const tolerance = 80;
                const toleranceSquared = tolerance * tolerance;
                
                // Detect common background colors (white, light grey, etc.) as fallback
                const isLightColor = (r, g, b) => {
                    const brightness = (r + g + b) / 3;
                    const isGrey = Math.abs(r - g) < 40 && Math.abs(g - b) < 40 && Math.abs(r - b) < 40;
                    return brightness > 180 && isGrey;
                };
                
                // Check if pixel is near edge (likely background)
                const isNearEdge = (x, y, edgeDistance = 5) => {
                    return x < edgeDistance || x >= width - edgeDistance || 
                           y < edgeDistance || y >= height - edgeDistance;
                };

                let removedCount = 0;
                let greenRemoved = 0;
                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                        const i = (y * width + x) * 4;
                        const r = data[i];
                        const g = data[i + 1];
                        const b = data[i + 2];
                        const a = data[i + 3];

                        // Skip if already transparent
                        if (a === 0) continue;

                        // PRIMARY: Check if it's a green/lime green color (chroma key)
                        const isGreen = isGreenColor(r, g, b);
                        if (isGreen) {
                            data[i + 3] = 0;
                            removedCount++;
                            greenRemoved++;
                            continue;
                        }

                        // SECONDARY: Check against average background color
                        const dr = r - avgR;
                        const dg = g - avgG;
                        const db = b - avgB;
                        const distanceSquared = dr * dr + dg * dg + db * db;
                        const channelMatch = (
                            Math.abs(r - avgR) < tolerance &&
                            Math.abs(g - avgG) < tolerance &&
                            Math.abs(b - avgB) < tolerance
                        );

                        // TERTIARY: Check if it's a light grey/white background color
                        const isLightBackground = isLightColor(r, g, b);
                        
                        // QUATERNARY: Check if color is very close to any of the corner samples
                        let matchesCorner = false;
                        for (const sample of sampleColors) {
                            const sampleDr = r - sample.r;
                            const sampleDg = g - sample.g;
                            const sampleDb = b - sample.b;
                            const sampleDist = Math.sqrt(sampleDr * sampleDr + sampleDg * sampleDg + sampleDb * sampleDb);
                            if (sampleDist < tolerance) {
                                matchesCorner = true;
                                break;
                            }
                        }
                        
                        // QUINARY: If near edge and matches background characteristics, remove it
                        const nearEdge = isNearEdge(x, y, 10);
                        const edgeMatch = nearEdge && (channelMatch || isLightBackground);

                        // Remove if it matches any criteria
                        if (distanceSquared < toleranceSquared || channelMatch || isLightBackground || matchesCorner || edgeMatch) {
                            data[i + 3] = 0;
                            removedCount++;
                        }
                    }
                }
                
                console.log(`Removed ${removedCount} background pixels (${((removedCount / (width * height)) * 100).toFixed(1)}% of image)`);
                console.log(`  - ${greenRemoved} green/lime green pixels removed (chroma key)`);
                console.log(`  - ${removedCount - greenRemoved} other background pixels removed`);

                ctx.putImageData(imgData, 0, 0);
                resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = reject;
            img.src = base64Image;
        });
    }

    /**
     * Parse API error response to extract meaningful error information
     */
    parseApiError(errorText, statusCode) {
        try {
            const errorData = JSON.parse(errorText);
            
            if (errorData.error) {
                const error = errorData.error;
                const message = error.message || 'Unknown API error';
                const code = error.code || statusCode;
                
                // Check for specific error types
                // Note: "expired" often means setup issue, not actual expiration
                if (message.includes('expired') || message.includes('API key expired')) {
                    return {
                        type: 'API_KEY_EXPIRED',
                        message: 'API key error detected. This usually means:\n' +
                                '1. "Generative Language API" is not enabled\n' +
                                '2. Billing is not set up\n' +
                                '3. API key restrictions are too strict\n\n' +
                                'See API_SETUP_GUIDE.md for detailed setup instructions.',
                        originalMessage: message,
                        code: code,
                        action: 'check_setup'
                    };
                }
                
                if (message.includes('invalid') || message.includes('API_KEY_INVALID') || 
                    message.includes('API key not valid')) {
                    return {
                        type: 'API_KEY_INVALID',
                        message: 'Your API key is invalid. Please check your key and try again.',
                        originalMessage: message,
                        code: code,
                        action: 'clear_and_renew'
                    };
                }
                
                if (message.includes('quota') || message.includes('QUOTA_EXCEEDED') || 
                    message.includes('exceeded your current quota')) {
                    return {
                        type: 'QUOTA_EXCEEDED',
                        message: 'API quota exceeded for image generation.\n\n' +
                                'Solutions:\n' +
                                '1. Check your quota limits in Google Cloud Console\n' +
                                '2. Wait for quota to reset (usually daily)\n' +
                                '3. Upgrade your plan if needed\n' +
                                '4. The model exists but you need quota to use it',
                        originalMessage: message,
                        code: code,
                        action: 'check_quota'
                    };
                }
                
                // Check for model not found errors
                if (message.includes('not found') || message.includes('not supported') || 
                    message.includes('ListModels') || message.includes('is not found') ||
                    message.includes('not available')) {
                    return {
                        type: 'MODEL_NOT_FOUND',
                        message: '❌ CRITICAL: No models found. The Generative Language API is likely not enabled.\n\n' +
                                '🔧 To fix:\n' +
                                '1. Go to: https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com\n' +
                                '2. Click "Enable"\n' +
                                '3. Wait 2-5 minutes\n' +
                                '4. Refresh this page\n\n' +
                                'Or run listAvailableModels() in console to check available models.',
                        originalMessage: message,
                        code: code,
                        action: 'enable_api'
                    };
                }
                
                return {
                    type: 'API_ERROR',
                    message: message,
                    originalMessage: message,
                    code: code,
                    action: 'check_key'
                };
            }
        } catch (e) {
            // If we can't parse the error, return a generic error
        }
        
        return {
            type: 'UNKNOWN_ERROR',
            message: `API error (${statusCode}): ${errorText.substring(0, 200)}`,
            originalMessage: errorText,
            code: statusCode,
            action: 'check_key'
        };
    }

    /**
     * Generate individual 32x32 tiles for procedural level rendering
     * Returns an object with base64 tile images: { treat, bone, platform }
     * 
     * NOTE: Only generates platform and collectible objects (treat, bone).
     * - Ground tiles: NOT generated (location-based background serves as ground)
     * - Cat/enemy tiles: NOT generated (uses static Cat.png file)
     * - Only 3 POST calls total: platform, treat, bone
     */
    async generateLevelTiles(theme) {
        try {
            console.log(`Generating individual tiles for theme: ${theme}`);
            console.log('Only generating: platform, treat, bone (3 POST calls total)');
            
            const tiles = {};
            
            // Generate platform tile (POST call #1)
            console.log('POST #1: Generating platform tile...');
            tiles.platform = await this.generateSingleTile(
                `Generate a single 32x32 pixel art tile of a FLOATING PLATFORM for a platformer game.
                Style: 16-bit Super Mario World style.
                Theme: ${theme}
                The tile should show: a stone or wooden platform block with grass on top.
                Must work as a standalone floating block.
                NO text, NO borders. Just the tile.`
            );
            
            // Generate treat/collectible tile (POST call #2)
            console.log('POST #2: Generating treat tile...');
            tiles.treat = await this.generateSingleTile(
                `Generate a single 32x32 pixel art tile of a DOG TREAT collectible item.
                Style: 16-bit pixel art, cute and colorful.
                Theme: ${theme}
                The tile should show: a golden/orange dog biscuit or bone-shaped treat.
                Transparent background.
                NO text, NO borders. Just the item on transparent background.`
            );
            
            // Generate bone/goal tile (POST call #3)
            console.log('POST #3: Generating bone tile...');
            tiles.bone = await this.generateSingleTile(
                `Generate a single 32x32 pixel art tile of a LARGE BONE (goal item).
                Style: 16-bit pixel art, shiny and important-looking.
                The tile should show: a white/cream colored dog bone, slightly glowing or sparkly.
                Transparent background.
                NO text. Just the bone on transparent background.`
            );
            
            console.log('All 3 tiles generated successfully! (platform, treat, bone)');
            return tiles;
            
        } catch (error) {
            console.error('Error generating tiles:', error);
            throw error;
        }
    }
    
    /**
     * Generate a single 32x32 tile
     */
    async generateSingleTile(prompt) {
        const response = await fetch(
            `${CONFIG.GEMINI_IMAGE_GEN_URL}?key=${this.apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.3, maxOutputTokens: 8192 }
                })
            }
        );

        if (!response.ok) {
            throw new Error(`Tile generation failed: ${response.status}`);
        }

        const data = await response.json();
        const candidate = data.candidates?.[0];
        if (!candidate) {
            console.error('No candidates in response:', data);
            throw new Error('No candidates');
        }

        console.log('Tile generation response structure:', {
            hasContent: !!candidate.content,
            partsCount: candidate.content?.parts?.length || 0
        });

        for (const part of candidate.content.parts) {
            // Check both possible formats
            const inlineData = part.inline_data || part.inlineData;
            if (inlineData) {
                const mimeType = inlineData.mime_type || inlineData.mimeType || 'image/png';
                const base64Data = inlineData.data;
                
                if (!base64Data) {
                    console.warn('Inline data found but no base64 data:', inlineData);
                    continue;
                }
                
                // Ensure proper format
                const dataUrl = base64Data.startsWith('data:') 
                    ? base64Data 
                    : `data:${mimeType};base64,${base64Data}`;
                
                console.log(`✓ Extracted tile image, size: ${base64Data.length} chars, mime: ${mimeType}`);
                return dataUrl;
            }
            
            // Also check for text responses that might contain image data
            if (part.text) {
                console.warn('Got text response instead of image:', part.text.substring(0, 100));
            }
        }
        
        console.error('No image data found in response parts:', candidate.content.parts);
        throw new Error('No image data in tile response');
    }

    /**
     * Get user's location data from IP address
     */
    async getUserLocation() {
        try {
            // Use ipapi.co for IP geolocation (free tier)
            const response = await fetch('https://ipapi.co/json/');
            if (!response.ok) {
                throw new Error('Failed to get location data');
            }
            const data = await response.json();
            return {
                city: data.city || 'Unknown',
                region: data.region || 'Unknown',
                country: data.country_name || 'Unknown',
                latitude: data.latitude,
                longitude: data.longitude,
                timezone: data.timezone || 'UTC'
            };
        } catch (error) {
            console.warn('Could not get location from IP, using defaults:', error);
            // Return default location
            return {
                city: 'Unknown',
                region: 'Unknown',
                country: 'Unknown',
                latitude: null,
                longitude: null,
                timezone: 'UTC'
            };
        }
    }

    /**
     * Get current time of day, weather info, and season based on location
     */
    async getTimeAndWeather(location) {
        try {
            // Get current time in user's timezone
            const now = new Date();
            const timeString = now.toLocaleString('en-US', { 
                timeZone: location.timezone,
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });
            
            // Determine time of day
            const hour = now.toLocaleString('en-US', { 
                timeZone: location.timezone,
                hour: 'numeric',
                hour12: false
            });
            const hourNum = parseInt(hour) || 12;
            let timeOfDay = 'day';
            if (hourNum >= 5 && hourNum < 12) timeOfDay = 'morning';
            else if (hourNum >= 12 && hourNum < 17) timeOfDay = 'afternoon';
            else if (hourNum >= 17 && hourNum < 20) timeOfDay = 'evening';
            else timeOfDay = 'night';

            // Determine season based on month and hemisphere
            // Northern hemisphere: Dec-Feb=winter, Mar-May=spring, Jun-Aug=summer, Sep-Nov=fall
            // Southern hemisphere: reversed
            const month = now.toLocaleString('en-US', { 
                timeZone: location.timezone,
                month: 'numeric'
            });
            const monthNum = parseInt(month) || 1;
            
            // Simple hemisphere detection based on latitude (northern > 0, southern < 0)
            const isNorthern = (location.latitude || 0) >= 0;
            let season;
            
            if (isNorthern) {
                if (monthNum >= 12 || monthNum <= 2) season = 'winter';
                else if (monthNum >= 3 && monthNum <= 5) season = 'spring';
                else if (monthNum >= 6 && monthNum <= 8) season = 'summer';
                else season = 'fall';
            } else {
                // Southern hemisphere - reversed
                if (monthNum >= 12 || monthNum <= 2) season = 'summer';
                else if (monthNum >= 3 && monthNum <= 5) season = 'fall';
                else if (monthNum >= 6 && monthNum <= 8) season = 'winter';
                else season = 'spring';
            }

            return {
                timeString,
                timeOfDay,
                hour: hourNum,
                season
            };
        } catch (error) {
            console.warn('Error getting time/weather:', error);
            return {
                timeString: new Date().toLocaleTimeString(),
                timeOfDay: 'day',
                hour: 12,
                season: 'spring'
            };
        }
    }

    /**
     * Generate a location-based background prompt using Gemini
     */
    async generateBackgroundPrompt(location, timeWeather) {
        try {
            const prompt = `Based on this location and time information, create a detailed prompt for generating an ANIMATED pixel art background scene:

Location:
- City: ${location.city}
- Region/State: ${location.region}
- Country: ${location.country}
- Time: ${timeWeather.timeString} (${timeWeather.timeOfDay})
- Season: ${timeWeather.season}

You must create a detailed, vivid image generation prompt that EXPLICITLY includes:

1. SEASON: Clearly describe the season (${timeWeather.season}) - mention seasonal colors, foliage, weather patterns, etc.
   - Spring: blooming flowers, green grass, mild weather
   - Summer: lush vegetation, warm colors, bright skies
   - Fall/Autumn: changing leaves, orange/red/brown colors, falling leaves
   - Winter: snow, bare trees, cold atmosphere, winter weather

2. TIME OF DAY: Clearly describe the time of day (${timeWeather.timeOfDay}) - mention lighting, sky colors, sun position, etc.

3. WEATHER CONDITIONS: Describe the weather conditions appropriate for ${location.city}, ${location.region} at this time of year. Include details like:
   - Sky conditions (clear, cloudy, overcast, etc.)
   - Weather type (sunny, rainy, foggy, snowy, windy, etc.)
   - Atmospheric effects (mist, rain, snow, clouds, wind, etc.)
   - Temperature indicators (if relevant to visual appearance)
   - ANIMATION HINTS: If rainy, mention rain animation. If snowy, mention snow falling. If windy, mention grass/leaves waving.

4. LANDMARKS: Include specific, recognizable landmarks or unique features of ${location.city}, ${location.region}, ${location.country}. These could be:
   - Famous buildings or structures
   - Natural features (mountains, rivers, coastlines)
   - City skyline characteristics
   - Regional architectural styles
   - Cultural or historical landmarks

5. ANIMATION REQUIREMENTS: The background must be animated with 4 frames showing:
   - Frame 1: Base state
   - Frame 2: Animation state (rain falling, snow falling, grass/leaves waving in wind, clouds moving, etc.)
   - Frame 3: Animation state (variation of frame 2)
   - Frame 4: Return to base or slight variation
   - Animation should be subtle and loop seamlessly
   - If weather is rainy: show rain drops in different positions across frames
   - If weather is snowy: show snowflakes falling at different positions
   - If weather is windy: show grass, leaves, or flags waving/moving
   - If weather is calm: show subtle cloud movement or gentle grass swaying

The prompt should also:
- Be suitable for a retro 16-bit platformer game background
- Be seamlessly tileable horizontally (left and right edges match perfectly)
- Have a consistent pixel art style throughout
- Include sky, distant landmarks, and ground elements
- Generate 4 frames of animation in a single spritesheet: 4 tiles wide x 1 tile tall
- Each frame should be 400 tiles wide x 14 tiles tall (12800x448 pixels at 32px per tile)
- Total spritesheet size: 51200 pixels wide x 448 pixels tall (4 frames x 12800 pixels each)

IMPORTANT RESTRICTIONS:
- DO NOT include any text signs, labels, or written text in the image
- DO NOT include signs with the city name (${location.city})
- DO NOT include signs with the time (${timeWeather.timeString} or ${timeWeather.timeOfDay})
- DO NOT include any text, words, numbers, or letters anywhere in the scene
- The scene should be purely visual with no written elements

CRITICAL: Your output must be a complete, ready-to-use image generation prompt that explicitly mentions:
- The season with visual details
- The time of day with visual details (but NO text signs showing the time)
- The weather conditions with atmospheric details and animation hints
- Specific landmarks or features of ${location.city} (but NO text signs with the city name)
- The 4-frame animation sequence requirements

Output ONLY the image generation prompt text, nothing else. Do not include explanations or markdown formatting.`;

            const response = await fetch(
                `${CONFIG.GEMINI_API_URL}?key=${this.apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{ text: prompt }]
                        }],
                        generationConfig: {
                            temperature: 0.7,
                            maxOutputTokens: 1024,
                        }
                    })
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                throw this.parseApiError(errorText, response.status);
            }

            const data = await response.json();
            
            if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
                throw new Error('Invalid response from Gemini API for background prompt');
            }
            
            let promptText = data.candidates[0].content.parts[0].text;
            
            // Clean up markdown if present
            promptText = promptText.replace(/```/g, '').trim();
            
            return promptText;
        } catch (error) {
            console.error('Error generating background prompt:', error);
            throw error;
        }
    }

    /**
     * Generate the actual background image using the prompt (returns 4 animated frames)
     */
    async generateBackgroundImage(prompt) {
        try {
            // Enhance prompt with specific requirements for 4-frame animation spritesheet
            const enhancedPrompt = `${prompt}

CRITICAL REQUIREMENTS FOR 4-FRAME ANIMATED SPRITESHEET:
- Image size: exactly 51200 pixels wide x 448 pixels tall
- This is a spritesheet with 4 animation frames arranged horizontally
- Frame 1: Position 0-12799 pixels (0-12799px from left)
- Frame 2: Position 12800-25599 pixels (12800-25599px from left)
- Frame 3: Position 25600-38399 pixels (25600-38399px from left)
- Frame 4: Position 38400-51199 pixels (38400-51199px from left)
- Each frame is exactly 12800 pixels wide x 448 pixels tall (400 tiles x 14 tiles at 32px per tile)
- Each frame should be seamlessly tileable horizontally (left and right edges match)
- Animation should loop seamlessly: Frame 4 should transition smoothly back to Frame 1 when tiled
- Include sky, distant landmarks/buildings, and ground elements in each frame
- Animation elements (rain, snow, wind effects) should vary across the 4 frames to create smooth animation

ANIMATION GUIDELINES:
- Rain: Show rain drops at different vertical positions across the 4 frames
- Snow: Show snowflakes at different positions, creating a falling effect
- Wind: Show grass, leaves, or flags in different positions to simulate movement
- Clouds: Show clouds slightly shifted across frames
- Calm: Show subtle variations like gentle grass swaying or cloud drift

TEXT RESTRICTIONS (CRITICAL):
- DO NOT include any text, signs, labels, or written words in the image
- NO city name signs or labels
- NO time displays, clocks, or time-related text
- NO numbers, letters, or any written text anywhere in the scene
- The image must be purely visual with zero text elements

16-BIT RETRO STYLE REQUIREMENTS (CRITICAL):
- Pixel art style, authentic 16-bit retro game aesthetic (Super Nintendo / Sega Genesis era)
- Limited color palette typical of 16-bit games (256 colors max, but use fewer for authenticity)
- No anti-aliasing or smooth gradients - use solid color blocks and dithering patterns
- Sharp, pixelated edges - no blur or smoothing
- Style reference: Super Mario World, Donkey Kong Country, Sonic the Hedgehog, or similar 16-bit platformer backgrounds
- Use pixel-perfect rendering with clear, distinct pixels
- Background layers should have depth but maintain the flat, layered look of 16-bit games
- Colors should be vibrant but within the 16-bit color range (no modern high-color gradients)
- Use dithering patterns for color transitions if needed (checkerboard or ordered dithering)
- All elements must look hand-pixelated, not rendered or filtered`;

            console.log('Generating background image with prompt:', enhancedPrompt);

            const response = await fetch(
                `${CONFIG.GEMINI_IMAGE_GEN_URL}?key=${this.apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{ text: enhancedPrompt }]
                        }],
                        generationConfig: {
                            temperature: 0.4,
                            topK: 32,
                            topP: 0.95,
                            maxOutputTokens: 8192,
                        }
                    })
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                throw this.parseApiError(errorText, response.status);
            }

            const data = await response.json();
            
            const candidate = data.candidates?.[0];
            if (!candidate) throw new Error('No candidates returned');

            for (const part of candidate.content.parts) {
                if (part.inline_data || part.inlineData) {
                    const inline = part.inline_data || part.inlineData;
                    const rawBase64 = `data:${inline.mime_type || inline.mimeType};base64,${inline.data}`;
                    
                    console.log('Background image generated successfully');
                    return rawBase64;
                }
                
                if (part.text && (part.text.includes("I cannot") || part.text.includes("Error"))) {
                     throw new Error(`Model Refusal: ${part.text}`);
                }
            }

            throw new Error('No image data found in background response.');
            
        } catch (error) {
            console.error('Error generating background image:', error);
            throw error;
        }
    }

    /**
     * Generate location-based background (main function)
     */
    async generateLocationBackground() {
        try {
            console.log('Generating location-based background...');
            
            // Step 1: Get user location
            const location = await this.getUserLocation();
            console.log('Location data:', location);
            
            // Step 2: Get time and weather info
            const timeWeather = await this.getTimeAndWeather(location);
            console.log('Time/Weather:', timeWeather);
            
            // Step 3: Generate prompt from Gemini
            const prompt = await this.generateBackgroundPrompt(location, timeWeather);
            console.log('Generated prompt:', prompt);
            
            // Step 4: Generate background image
            const backgroundImage = await this.generateBackgroundImage(prompt);
            console.log('Background image generated');
            
            // Step 5: Cache it with version 2 (4-frame animated format)
            try {
                localStorage.setItem('location_background', backgroundImage);
                localStorage.setItem('location_background_meta', JSON.stringify({
                    location,
                    timeWeather,
                    prompt,
                    timestamp: Date.now(),
                    version: 2 // Version 2 = 4-frame animated spritesheet format
                }));
            } catch (storageError) {
                console.warn('Could not cache background image:', storageError);
            }
            
            return backgroundImage;
        } catch (error) {
            console.error('Error in generateLocationBackground:', error);
            throw error;
        }
    }
}

// Export for use in other files
if (typeof window !== 'undefined') {
    window.APIService = APIService;
    // Instantiate immediately for global use
    window.api = new APIService();
}
