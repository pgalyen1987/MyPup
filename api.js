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
     * Resize a base64 image using canvas
     */
    async resizeImage(base64Str, maxWidth, maxHeight) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.src = base64Str;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
                if (height > maxHeight) {
                    width = Math.round((width * maxHeight) / height);
                    height = maxHeight;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/png', 0.8));
            };
            img.onerror = (e) => reject(new Error('Image load failed'));
        });
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
                                    text: `Analyze this dog image and describe its core visual traits for a 16-bit retro sprite artist.
                                    
                                    Focus exclusively on:
                                    - Breed/Type and Body Shape
                                    - Primary and Secondary Colors
                                    - Distinctive Markings (spots, patches, ear color)
                                    - Eyes and Expressions
                                    - Any visible accessories (collar, bandana)
                                    
                                    KEEP IT CONCISE. This description will be used in an image generation prompt.`
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
            
            // Construct a highly rigid structural prompt
            const tileSize = CONFIG.TILE_SIZE;
            const spriteSheetSize = tileSize * 4; // 4x4 grid
            const spritePrompt = `TITLE: 16-bit Retro Dog Spritesheet
CHARACTER DESCRIPTION: ${analysis}
STYLE: SNES-era pixel art, vibrant colors, clean outlines, 16-bit aesthetic.

IMAGE STRUCTURE:
- Total Canvas Size: ${spriteSheetSize}x${spriteSheetSize} pixels.
- Layout: EXACT 4x4 grid of character poses (16 sprites total).
- Cell Size: Each sprite must be contained within a ${tileSize}x${tileSize} pixel square.
- ALIGNMENT: 
  - Every sprite must be PIXEL-PERFECTLY CENTERED horizontally in its ${tileSize}x${tileSize} cell.
  - Every sprite must have the same vertical baseline (feet touching the same Y-level in every cell).
  - Row 1: Walk Right (4 frames)
  - Row 2: Walk Left (4 frames)
  - Row 3: Jump (4 frames)
  - Row 4: Idle/Sitting (4 frames)

CRITICAL CONSTRAINTS:
- BACKGROUND: Solid, uniform lime green (#00ff00) background ONLY.
- NO shadows, NO floor, NO grid lines.
- The character must remain perfectly consistent in size, features, and colors across all 16 frames.
- Ensure the character occupies roughly ${Math.round(tileSize * 0.625)}-${Math.round(tileSize * 0.78125)} pixels of height within the ${tileSize}px cell.`;

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
                            temperature: 0.2,
                            topK: 16,
                            topP: 0.9,
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
     * Generate an enemy spritesheet (e.g., Cat) using the same 4x4 grid as the dog
     */
    async generateEnemySpriteSheet(enemyType = 'cat') {
        try {
            console.log(`Generating ${enemyType} enemy spritesheet...`);
            
            const tileSize = CONFIG.TILE_SIZE;
            const spriteSheetSize = tileSize * 4; // 4x4 grid
            const enemyPrompt = `TITLE: 16-bit Retro ${enemyType.toUpperCase()} Enemy Spritesheet
CHARACTER DESCRIPTION: A cool, slightly mischievous ${enemyType} for a platformer enemy. 
STYLE: SNES-era pixel art, vibrant colors, clean outlines, 16-bit aesthetic.

IMAGE STRUCTURE:
- Total Canvas Size: ${spriteSheetSize}x${spriteSheetSize} pixels.
- Layout: EXACT 4x4 grid of character poses (16 sprites total).
- Cell Size: Each sprite must be contained within a ${tileSize}x${tileSize} pixel square.
- ALIGNMENT: 
  - Every sprite must be PIXEL-PERFECTLY CENTERED horizontally in its ${tileSize}x${tileSize} cell.
  - Every sprite must have the same vertical baseline (feet touching the same Y-level in every cell).
  - Row 1: Walk Right (4 frames)
  - Row 2: Walk Left (4 frames)
  - Row 3: Jump/Attack (4 frames)
  - Row 4: Idle (4 frames)

CRITICAL CONSTRAINTS:
- BACKGROUND: Solid, uniform lime green (#00ff00) background ONLY.
- NO shadows, NO floor, NO grid lines.
- The character must remain perfectly consistent across all 16 frames.`;

            const response = await fetch(
                `${CONFIG.GEMINI_IMAGE_GEN_URL}?key=${this.apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{ text: enemyPrompt }]
                        }],
                        generationConfig: {
                            temperature: 0.3,
                            topK: 16,
                            topP: 0.9,
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
            if (!candidate) throw new Error('No candidates returned for enemy sprite');

            for (const part of candidate.content.parts) {
                if (part.inline_data || part.inlineData) {
                    const inline = part.inline_data || part.inlineData;
                    const rawBase64 = `data:${inline.mime_type || inline.mimeType};base64,${inline.data}`;
                    return await this.removeSolidBackground(rawBase64);
                }
            }

            throw new Error('No image data found in enemy sprite response');
            
        } catch (error) {
            console.error('Error generating enemy sprite sheet:', error);
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

                // Primary method: Detect green/lime green colors (chroma key) and magenta (#ff00ff)
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
                
                // Detect magenta color (#ff00ff = RGB(255, 0, 255))
                const isMagentaColor = (r, g, b) => {
                    // Magenta is high red, low green, high blue
                    // #ff00ff = RGB(255, 0, 255)
                    const isMagenta = r > 200 && b > 200 && g < 50;
                    // Also check for close matches with tolerance
                    const redBlueHigh = r > 150 && b > 150;
                    const greenLow = g < 100;
                    const isCloseMagenta = redBlueHigh && greenLow && Math.abs(r - b) < 50;
                    
                    return isMagenta || isCloseMagenta;
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

                // Method 1: Flood fill background removal to preserve internal colors
                // This starts from the corners and removes only connected background pixels
                const visited = new Uint8Array(width * height);
                const stack = [...corners, ...edgeSamples];
                let removedCount = 0;
                
                const colorDist = (r1, g1, b1, r2, g2, b2) => {
                    return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
                };

                const fillTolerance = 120; // Slightly higher tolerance for flood fill
                
                while (stack.length > 0) {
                    const { x, y } = stack.pop();
                    if (x < 0 || x >= width || y < 0 || y >= height) continue;
                    
                    const pos = y * width + x;
                    if (visited[pos]) continue;
                    visited[pos] = 1;

                    const i = pos * 4;
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    
                    // If this pixel is similar to the detected background or is pure lime green/magenta
                    const isBg = colorDist(r, g, b, avgR, avgG, avgB) < fillTolerance || 
                                 (g > 200 && r < 100 && b < 100) || // Lime Green
                                 (r > 200 && b > 200 && g < 100);   // Magenta

                    if (isBg) {
                        data[i + 3] = 0; // Make transparent
                        removedCount++;
                        
                        // Add neighbors
                        stack.push({ x: x + 1, y });
                        stack.push({ x: x - 1, y });
                        stack.push({ x, y: y + 1 });
                        stack.push({ x, y: y - 1 });
                    }
                }
                
                console.log(`Flood fill removed ${removedCount} background pixels (${((removedCount / (width * height)) * 100).toFixed(1)}% of image)`);
                
                // Method 2: Pass through entire image to remove any remaining green/magenta pixels
                // This catches isolated green pixels that weren't connected to edges
                let additionalRemoved = 0;
                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                        const i = (y * width + x) * 4;
                        const r = data[i];
                        const g = data[i + 1];
                        const b = data[i + 2];
                        const a = data[i + 3];
                        
                        // Skip if already transparent
                        if (a === 0) continue;
                        
                        // More aggressive green detection - catch #00ff00 and variations
                        // Lime green (#00ff00 = RGB(0, 255, 0)) or close variations
                        const isLimeGreen = (g > 200 && r < 150 && b < 150) || // Bright green, low red/blue
                                          (g > r * 2 && g > b * 2 && g > 150); // Green dominates significantly
                        
                        // Also check for pure green (#00ff00 exactly or very close)
                        const isPureGreen = g > 240 && r < 50 && b < 50;
                        
                        // Magenta detection
                        const isMagenta = (r > 200 && b > 200 && g < 100);
                        
                        // Check if pixel matches average background color (with tolerance)
                        const matchesAvgBg = colorDist(r, g, b, avgR, avgG, avgB) < 100;
                        
                        if (isLimeGreen || isPureGreen || isMagenta || matchesAvgBg) {
                            data[i + 3] = 0; // Make transparent
                            additionalRemoved++;
                        }
                    }
                }
                
                console.log(`Additional pass removed ${additionalRemoved} more background pixels`);
                console.log(`Total removed: ${removedCount + additionalRemoved} pixels (${(((removedCount + additionalRemoved) / (width * height)) * 100).toFixed(1)}% of image)`);

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
     * Generate individual 64x64 tiles for procedural level rendering
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
            const tileSize = CONFIG.TILE_SIZE;
            tiles.platform = await this.generateSingleTile(
                `Generate a single ${tileSize}x${tileSize} pixel art tile of a FLOATING PLATFORM for a platformer game.
                Style: 16-bit Super Mario World style.
                Theme: ${theme}
                The tile should show: a stone or wooden platform block with grass on top.
                Must work as a standalone floating block.
                NO text, NO borders. Just the tile.`
            );
            
            // Generate treat/collectible tile (POST call #2)
            console.log('POST #2: Generating treat tile...');
            tiles.treat = await this.generateSingleTile(
                `Generate a single ${tileSize}x${tileSize} pixel art tile of a DOG TREAT collectible item.
                Style: 16-bit pixel art, cute and colorful.
                Theme: ${theme}
                The tile should show: a golden/orange dog biscuit or bone-shaped treat.
                Transparent background.
                NO text, NO borders. Just the item on transparent background.`
            );
            
            // Generate bone/goal tile (POST call #3)
            console.log('POST #3: Generating bone tile...');
            tiles.bone = await this.generateSingleTile(
                `Generate a single ${tileSize}x${tileSize} pixel art tile of a LARGE BONE (goal item).
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
     * Generate a single tile (size determined by CONFIG.TILE_SIZE)
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
            const month = now.toLocaleString('en-US', { 
                timeZone: location.timezone,
                month: 'numeric'
            });
            const monthNum = parseInt(month) || 1;
            const isNorthern = (location.latitude || 0) >= 0;
            let season;
            
            if (isNorthern) {
                if (monthNum >= 12 || monthNum <= 2) season = 'winter';
                else if (monthNum >= 3 && monthNum <= 5) season = 'spring';
                else if (monthNum >= 6 && monthNum <= 8) season = 'summer';
                else season = 'fall';
            } else {
                if (monthNum >= 12 || monthNum <= 2) season = 'summer';
                else if (monthNum >= 3 && monthNum <= 5) season = 'fall';
                else if (monthNum >= 6 && monthNum <= 8) season = 'winter';
                else season = 'spring';
            }

            // Step 2: Get real-time weather from Open-Meteo
            let weatherReport = {
                description: 'clear sky',
                hasPrecipitation: false,
                precipitationType: 'none',
                weatherCode: 0
            };

            if (location.latitude && location.longitude) {
                try {
                    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=weather_code,precipitation&timezone=auto`;
                    const weatherResponse = await fetch(weatherUrl);
                    if (weatherResponse.ok) {
                        const weatherData = await weatherResponse.json();
                        const code = weatherData.current.weather_code;
                        const prec = weatherData.current.precipitation;
                        
                        weatherReport.weatherCode = code;
                        weatherReport.hasPrecipitation = prec > 0;
                        
                        // Map WMO codes to descriptions
                        if (code === 0) weatherReport.description = 'clear sky';
                        else if (code <= 3) weatherReport.description = 'partly cloudy';
                        else if (code >= 51 && code <= 67) {
                            weatherReport.description = 'rainy';
                            weatherReport.precipitationType = 'rain';
                            weatherReport.hasPrecipitation = true;
                        }
                        else if (code >= 71 && code <= 77) {
                            weatherReport.description = 'snowy';
                            weatherReport.precipitationType = 'snow';
                            weatherReport.hasPrecipitation = true;
                        }
                        else if (code >= 80 && code <= 82) {
                            weatherReport.description = 'rain showers';
                            weatherReport.precipitationType = 'rain';
                            weatherReport.hasPrecipitation = true;
                        }
                        else if (code >= 85 && code <= 86) {
                            weatherReport.description = 'snow showers';
                            weatherReport.precipitationType = 'snow';
                            weatherReport.hasPrecipitation = true;
                        }
                        else if (code >= 95) {
                            weatherReport.description = 'stormy';
                            weatherReport.precipitationType = 'rain';
                            weatherReport.hasPrecipitation = true;
                        }
                        else weatherReport.description = 'cloudy';
                    }
                } catch (e) {
                    console.warn('Could not fetch real-time weather, using location-based defaults:', e);
                }
            }

            return {
                timeString,
                timeOfDay,
                hour: hourNum,
                season,
                weatherReport
            };
        } catch (error) {
            console.warn('Error getting time/weather:', error);
            return {
                timeString: new Date().toLocaleTimeString(),
                timeOfDay: 'day',
                hour: 12,
                season: 'spring',
                weatherReport: { description: 'clear sky', hasPrecipitation: false, precipitationType: 'none' }
            };
        }
    }

    /**
     * Generate a location-based background prompt using Gemini
     */
    async generateBackgroundPrompt(location, timeWeather) {
        try {
            const weatherDesc = timeWeather.weatherReport?.description || (timeWeather.timeOfDay === 'night' ? 'clear night sky with stars' : 'appropriate for current location');
            
            const prompt = `Describe a beautiful, immersive landscape scene for a retro 16-bit platformer game background based on this real-world data:

Location: ${location.city}, ${location.region}, ${location.country}
Time: ${timeWeather.timeString} (${timeWeather.timeOfDay})
Season: ${timeWeather.season}
Weather: ${weatherDesc}

Include giant, highly recognizable visual landmarks and iconic features from ${location.city} (architectural, historical, or natural). Describe these landmarks in large, crisp detail so they are the focal point of the background. The scene must feel uniquely and immediately identifiable as ${location.city}. Do not include any text or signs. Description should be vivid for a 16-bit SNES style.`;

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
                console.warn('Gemini API did not return text for background prompt. Full response:', JSON.stringify(data));
                
                // Check for safety refusal
                if (data.candidates?.[0]?.finishReason === 'SAFETY') {
                    console.warn('Safety refusal detected. Retrying with a more generic prompt...');
                    return `A beautiful SNES-era pixel art landscape of a city with a historic and natural feel, suitable for ${location.city}.`;
                }
                
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
     * Generate the actual background image using the prompt (returns 4 animated frames combined into spritesheet)
     * Each frame is 1024x1024, combined into a 4096x1024 spritesheet (4 frames horizontally)
     */
    async generateBackgroundImage(prompt, timeWeather = null) {
        try {
            // Generate 8 separate frames for smoother animation and less jitter
            const frameWidth = 512; 
            const frameHeight = 512; 
            const totalFrames = 8;
            
            console.log(`Generating ${totalFrames}-frame animated background sequentially (512x512)...`);
            
            const frames = [];
            let previousFrame = null;
            
            // Generate a random seed for this background set to improve frame consistency
            const seed = Math.floor(Math.random() * 1000000);
            console.log(`Using seed ${seed} for all frames in this background set.`);
            
            const hasPrecipitation = timeWeather?.weatherReport?.hasPrecipitation;
            const precipitationType = timeWeather?.weatherReport?.precipitationType || 'rain';
            
            for (let i = 0; i < totalFrames; i++) {
                const frameNum = i + 1;
                let framePrompt;
                
                if (frameNum === 1) {
                    // Initial frame: Description based on location, no size mention
                    framePrompt = `A 16-bit retro pixel art landscape for a side-scrolling platformer background.
                    Theme: ${prompt}
                    Style: SNES-era pixel art, vibrant colors, dithered shading, clear layers.
                    
                    SEAMLESS TILING PROTOCOL:
                    - This image MUST tile horizontally perfectly.
                    - The FAR LEFT edge and FAR RIGHT edge must match pixel-for-pixel so they connect seamlessly when placed side-by-side.
                    - Do NOT cut large landmarks in half at the edges. Keep them fully contained or handle the cross-over perfectly.
                    
                    Composition:
                    - Ensure recognizable landmarks from ${prompt} are HUGE and highly visible.
                    - The scene should include sky, prominent iconic landmarks, and ground elements.
                    ${hasPrecipitation ? `Weather effect: Show visible ${precipitationType} falling in the foreground and midground (pixel art ${precipitationType} streaks or flakes).` : ''}
                    NO text, NO signs. This is the first frame of an animation loop.`;
                } else {
                    // Subsequent frames: Dual-reference for structure (Frame 1) and motion (Frame i-1)
                    let animationText = '';
                    const progress = ((frameNum - 1) / totalFrames * 100).toFixed(1);
                    
                    if (frameNum < totalFrames) {
                        animationText = `This is frame ${frameNum} of ${totalFrames} (${progress}% through the loop). 
                        Move clouds slightly further right than in the previous frame. Increase any swaying or rippling slightly.`;
                    } else {
                        animationText = `This is the FINAL frame (${progress}%). 
                        It MUST lead perfectly back to Frame 1. 
                        Clouds should be at their furthest position, such that the next step would be their exact position in Frame 1. 
                        All swaying and rippling should be at a state that connects seamlessly back to the start of the loop.`;
                    }
                    
                    if (hasPrecipitation) {
                        const effect = precipitationType === 'snow' ? 'drift further down and across' : 'fall downward in progressive streaks';
                        animationText += ` Also advance the ${precipitationType} animation so it cycles seamlessly.`;
                    }

                    framePrompt = `Generate frame ${frameNum} of an ${totalFrames}-frame SEAMLESS animation loop.
                    You are provided with TWO images:
                    1. The FIRST FRAME (Anchor): Use this to keep all buildings and landmarks pixel-perfect.
                    2. The PREVIOUS FRAME (Continuity): Use this to ensure smooth, incremental motion.

                    STABILITY PROTOCOL: 
                    - All landmarks, buildings, and ground from the FIRST FRAME must remain in the EXACT same pixel positions. ZERO drift.
                    
                    SEAMLESS TILING PROTOCOL:
                    - Maintain PERFECT horizontal tiling. The left edge MUST always match the right edge perfectly.
                    - If a cloud or object moves off the RIGHT edge, it MUST reapppear exactly from the LEFT edge (wraparound).
                    
                    LOOPING INSTRUCTIONS:
                    ${animationText}
                    
                    The resulting image must be 512x512 with the same SNES-era pixel art style.`;
                }
                
                // Use first frame as anchor and previous frame for continuity
                const referenceFrames = [];
                if (frameNum > 1) {
                    referenceFrames.push(frames[0]); // Frame 1 is always first
                    if (frameNum > 2) {
                        referenceFrames.push(frames[frames.length - 1]); // Previous frame is second
                    }
                }
                
                const currentFrame = await this.generateSingleFrame(framePrompt, frameNum, referenceFrames, seed);
                frames.push(currentFrame);
                
                console.log(`Frame ${frameNum}/${totalFrames} generated successfully (References: ${referenceFrames.length}).`);
            }

            console.log(`Successfully generated ${frames.length} background frames sequentially`);
            
            // Return the frames as an array - we'll cycle through them for animation
            // Store as an object with frames array and metadata
            const backgroundData = {
                frames: frames, // Array of 4 base64 images
                frameCount: frames.length,
                frameWidth: frameWidth,
                frameHeight: frameHeight
            };
            
            // For backward compatibility, also store as a single combined image
            // But the game will use the frames array for animation
            const spritesheet = await this.combineFramesIntoSpritesheet(frames, frameWidth, frameHeight);
            backgroundData.spritesheet = spritesheet; // Keep for fallback
            
            console.log(`Background frames ready: ${frames.length} separate ${frameWidth}x${frameHeight} images`);
            
            return backgroundData;
            
        } catch (error) {
            console.error('Error generating background image:', error);
            throw error;
        }
    }
    
    /**
     * Generate a single frame of the background animation
     */
    async generateSingleFrame(prompt, frameNumber, previousFrameBase64 = null, seed = null) {
        console.log(`Generating background frame ${frameNumber}/4...`);
        
        // Prepare request body
        const parts = [{ text: prompt }];
        
        // If we have reference frames, include them for image-to-image consistency
        if (referenceFrames && referenceFrames.length > 0) {
            referenceFrames.forEach((frameBase64, index) => {
                if (!frameBase64) return;
                
                let base64Data = frameBase64;
                if (frameBase64.includes(',')) {
                    base64Data = frameBase64.split(',')[1];
                }
                
                parts.push({
                    inline_data: {
                        mime_type: "image/png",
                        data: base64Data
                    }
                });
                console.log(`Including reference frame ${index + 1} in request for frame ${frameNumber}`);
            });
        }
        
        const response = await fetch(
            `${CONFIG.GEMINI_IMAGE_GEN_URL}?key=${this.apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: parts
                    }],
                    generationConfig: {
                        temperature: 0.05,
                        topK: 8,
                        topP: 0.8,
                        maxOutputTokens: 8192,
                        ...(seed !== null && { seed: seed })
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
        if (!candidate) throw new Error(`No candidates returned for frame ${frameNumber}`);

        for (const part of candidate.content.parts) {
            if (part.inline_data || part.inlineData) {
                const inline = part.inline_data || part.inlineData;
                const rawBase64 = `data:${inline.mime_type || inline.mimeType};base64,${inline.data}`;
                
                console.log(`Frame ${frameNumber}/4 generated successfully`);
                return rawBase64;
            }
            
            if (part.text && (part.text.includes("I cannot") || part.text.includes("Error"))) {
                 throw new Error(`Model Refusal for frame ${frameNumber}: ${part.text}`);
            }
        }

        throw new Error(`No image data found in frame ${frameNumber} response.`);
    }
    
    /**
     * Combine 4 frames into a single horizontal spritesheet
     * Each frame from Gemini is 1024x1024, combined into 4096x1024 spritesheet
     * Scaling to fit the view window happens in the game code when displaying
     */
    async combineFramesIntoSpritesheet(frameDataUrls, frameWidth, frameHeight) {
        return new Promise((resolve, reject) => {
            try {
                // Create a canvas to combine the frames
                const canvas = document.createElement('canvas');
                canvas.width = frameWidth * frameDataUrls.length; // Dynamic width based on frame count
                canvas.height = frameHeight;
                const ctx = canvas.getContext('2d');
                
                // Disable image smoothing for pixel art
                ctx.imageSmoothingEnabled = false;
                
                // Load all frames as images and place them side by side
                const imagePromises = frameDataUrls.map((dataUrl, index) => {
                    return new Promise((resolveImg, rejectImg) => {
                        const img = new Image();
                        img.onload = () => {
                            const xPos = index * frameWidth;
                            
                            // Draw the frame at full size
                            ctx.drawImage(
                                img,
                                xPos, // Destination X
                                0, // Destination Y
                                frameWidth,
                                frameHeight
                            );
                            
                            console.log(`Frame ${index + 1}/${frameDataUrls.length}: Placed ${img.width}x${img.height} at position x=${xPos} in spritesheet`);
                            resolveImg();
                        };
                        img.onerror = () => rejectImg(new Error(`Failed to load frame ${index + 1}`));
                        img.src = dataUrl;
                    });
                });
                
                // Wait for all frames to load and draw
                Promise.all(imagePromises).then(() => {
                    // Convert canvas to base64 data URL
                    const spritesheetDataUrl = canvas.toDataURL('image/png');
                    console.log(`Combined ${frameDataUrls.length} frames into spritesheet: ${canvas.width}x${canvas.height} (${frameDataUrls.length} frames of ${frameWidth}x${frameHeight} each)`);
                    resolve(spritesheetDataUrl);
                }).catch(reject);
                
            } catch (error) {
                reject(error);
            }
        });
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
            
            // Step 4: Generate background image (returns object with frames array)
            const backgroundData = await this.generateBackgroundImage(prompt, timeWeather);
            console.log('Background frames generated');
            
            // Step 5: Cache it with version 5 (4 separate frames in array, no spritesheet in localStorage to save space)
            try {
                // Clear old spritesheet if it exists to make space
                localStorage.removeItem('location_background');
                
                // Store the frames array (already 512x512 from API)
                localStorage.setItem('location_background_frames', JSON.stringify(backgroundData.frames));
                
                localStorage.setItem('location_background_meta', JSON.stringify({
                    location,
                    timeWeather,
                    prompt,
                    timestamp: Date.now(),
                    version: 5, // Version 5 = 4 separate frames in array (no spritesheet needed in localStorage)
                    frameCount: backgroundData.frameCount,
                    frameWidth: backgroundData.frameWidth,
                    frameHeight: backgroundData.frameHeight
                }));
                console.log('Background cached successfully (frames array)');
            } catch (storageError) {
                console.warn('Could not cache background image (localStorage probably full):', storageError);
                // We still have it in memory for the current session via window.locationBackground
            }
            
            return backgroundData;
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
