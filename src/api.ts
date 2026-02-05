// API integration for Gemini 3

import { CONFIG } from './config.js';

// Helper to get DEBUG_MODE
const DEBUG_MODE = CONFIG.DEBUG_MODE;

// Type definitions
interface ApiError {
  type: string;
  message: string;
  originalMessage?: string;
  code: number;
  action?: string;
}

interface LocationData {
  city: string;
  region: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  timezone: string;
}

interface WeatherReport {
  description: string;
  hasPrecipitation: boolean;
  precipitationType: string;
  weatherCode: number;
}

interface TimeWeather {
  timeString: string;
  timeOfDay: string;
  hour: number;
  season: string;
  weatherReport: WeatherReport;
}

interface BackgroundData {
  frames: string[];
  frameCount: number;
  frameWidth: number;
  frameHeight: number;
  spritesheet?: string;
}

// LevelTiles interface removed - no longer using AI-generated tiles

export class APIService {
    constructor() {
        // Do not cache key in constructor to avoid storage race conditions
    }

    get apiKey() {
        // If using backend proxy, API key is not needed on client side
        if (CONFIG.USE_BACKEND_PROXY) {
            return ''; // Backend handles API key
        }
        // Try to get from CONFIG first, then localStorage
        return CONFIG.GEMINI_API_KEY || localStorage.getItem('gemini_api_key') || '';
    }

    /**
     * Get the API endpoint URL (either backend proxy or direct Gemini API)
     */
    private getApiUrl(model: string, endpoint: string = 'generateContent'): string {
        if (CONFIG.USE_BACKEND_PROXY && CONFIG.BACKEND_API_URL) {
            // Use backend proxy - API key is handled server-side
            return CONFIG.BACKEND_API_URL;
        } else {
            // Use direct Gemini API - requires API key in query string
            const baseUrl = model.includes('image') ? CONFIG.GEMINI_IMAGE_GEN_URL : CONFIG.GEMINI_API_URL;
            // Extract base URL without key
            const urlWithoutKey = baseUrl.split('?')[0];
            return `${urlWithoutKey}?key=${this.apiKey}`;
        }
    }

    /**
     * Make an API request (either to backend proxy or direct Gemini API)
     */
    private async makeApiRequest(model: string, requestBody: any, endpoint: string = 'generateContent'): Promise<Response> {
        const url = this.getApiUrl(model, endpoint);
        
        if (CONFIG.USE_BACKEND_PROXY && CONFIG.BACKEND_API_URL) {
            // Request to backend proxy
            return fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    endpoint: endpoint,
                    model: model,
                    requestBody: requestBody
                })
            });
        } else {
            // Direct request to Gemini API
            return fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });
        }
    }

    /**
     * Verify API key by making a simple test request
     * Works with both backend proxy and direct API modes
     */
    async verifyApiKey(): Promise<{ valid: boolean; error?: string }> {
        // If using backend proxy, check if backend URL is configured
        if (CONFIG.USE_BACKEND_PROXY) {
            if (!CONFIG.BACKEND_API_URL) {
                return { valid: false, error: 'Backend API URL not configured' };
            }
            // Test backend connection
            try {
                const model = DEBUG_MODE ? 'gemini-2.5-flash' : 'gemini-3-pro-image-preview';
                const requestBody = {
                    contents: [{
                        parts: [{ text: 'Say "OK" if you can read this.' }]
                    }],
                    generationConfig: {
                        temperature: 0.1,
                        maxOutputTokens: 10,
                    }
                };
                
                const response = await this.makeApiRequest(model, requestBody);
                
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

        // Direct API key verification
        if (!this.apiKey) {
            return { valid: false, error: 'No API key provided' };
        }

        try {
            // Make a simple test request to verify the key works
            const response = await this.makeApiRequest(
                DEBUG_MODE ? 'gemini-2.5-flash' : 'gemini-3-pro-image-preview',
                {
                    contents: [{
                        parts: [{ text: 'Say "OK" if you can read this.' }]
                    }],
                    generationConfig: {
                        temperature: 0.1,
                        maxOutputTokens: 10,
                    }
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
    async resizeImage(base64Str: string, maxWidth: number, maxHeight: number): Promise<string> {
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
     * Validate image content to detect black/empty images
     */
    async validateImageContent(base64Str: string, frameNumber: number, stage: string): Promise<void> {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = base64Str;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    console.warn(`API: Could not get canvas context for frame ${frameNumber} validation (${stage})`);
                    return resolve();
                }
                ctx.drawImage(img, 0, 0);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
                
                let blackPixels = 0;
                let totalPixels = canvas.width * canvas.height;
                let totalBrightness = 0;
                
                for (let i = 0; i < imageData.length; i += 4) {
                    const r = imageData[i];
                    const g = imageData[i + 1];
                    const b = imageData[i + 2];
                    const a = imageData[i + 3];
                    
                    // Calculate brightness
                    const brightness = (r + g + b) / 3;
                    totalBrightness += brightness;
                    
                    // Consider pixel black if RGB values are all < 10
                    if (r < 10 && g < 10 && b < 10 && a > 0) {
                        blackPixels++;
                    }
                }
                
                const blackPercent = (blackPixels / totalPixels) * 100;
                const avgBrightness = totalBrightness / (totalPixels * 255) * 100;
                
                console.log(`API: Frame ${frameNumber} validation (${stage}) - Black: ${blackPercent.toFixed(1)}%, Avg brightness: ${avgBrightness.toFixed(1)}%, Size: ${img.width}x${img.height}`);
                
                if (blackPercent > 95) {
                    console.error(`API: ⚠️ WARNING - Frame ${frameNumber} is ${blackPercent.toFixed(1)}% black at ${stage}! Image may be empty or invalid.`);
                }
                if (avgBrightness < 5) {
                    console.error(`API: ⚠️ WARNING - Frame ${frameNumber} has very low average brightness (${avgBrightness.toFixed(1)}%) at ${stage}! Image may be black.`);
                }
                
                resolve();
            };
            img.onerror = () => {
                console.warn(`API: Failed to load image for validation (frame ${frameNumber}, ${stage})`);
                resolve();
            };
        });
    }

    /**
     * Resize a base64 image to an exact size (not max size)
     */
    async resizeImageToExactSize(base64Str: string, targetWidth: number, targetHeight: number): Promise<string> {
        console.log(`API: resizeImageToExactSize called - target: ${targetWidth}x${targetHeight}`);
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.src = base64Str;
            img.onload = () => {
                // Check if resize is needed
                if (img.width === targetWidth && img.height === targetHeight) {
                    console.log(`Frame is already ${targetWidth}x${targetHeight}, no resize needed`);
                    resolve(base64Str);
                    return;
                }
                
                console.log(`Resizing frame from ${img.width}x${img.height} to ${targetWidth}x${targetHeight}`);
                
                const canvas = document.createElement('canvas');
                canvas.width = targetWidth;
                canvas.height = targetHeight;
                const ctx = canvas.getContext('2d');
                
                if (!ctx) {
                    reject(new Error('Could not get canvas context'));
                    return;
                }
                
                // Use imageSmoothingEnabled: false for pixel art to maintain crisp edges
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
                resolve(canvas.toDataURL('image/png', 1.0));
            };
            img.onerror = (e) => reject(new Error('Image load failed during resize'));
        });
    }

    /**
     * Analyze dog image using Gemini 3 API and create a detailed prompt for sprite generation
     */
    async analyzeDogImageAndCreatePrompt(imageBase64: string): Promise<string> {
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

            // Use the unified Gemini endpoint (via backend proxy or direct)
            const model = DEBUG_MODE ? 'gemini-2.5-flash' : 'gemini-3-pro-image-preview';
            console.log('Analyzing image with:', CONFIG.USE_BACKEND_PROXY ? 'Backend Proxy' : model);
            
            const requestBody = {
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
                            `
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
            };
            
            let response = await this.makeApiRequest(model, requestBody);

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
            
            let analysis = data.candidates[0].content.parts[0].text;
            
            // Clean and format the analysis text
            // Remove any markdown formatting, extra whitespace, or code blocks
            analysis = analysis.trim();
            // Remove markdown code blocks if present
            analysis = analysis.replace(/```[\s\S]*?```/g, '');
            // Remove markdown bold/italic formatting
            analysis = analysis.replace(/\*\*([^*]+)\*\*/g, '$1');
            analysis = analysis.replace(/\*([^*]+)\*/g, '$1');
            // Clean up multiple newlines
            analysis = analysis.replace(/\n{3,}/g, '\n\n');
            // Remove leading/trailing whitespace from each line
            analysis = analysis.split('\n').map(line => line.trim()).join('\n');
            
            console.log('📝 Extracted dog analysis:', analysis);
            console.log('📏 Analysis length:', analysis.length, 'characters');
            console.log('📋 Analysis preview (first 200 chars):', analysis.substring(0, 200));
            
            // Verify analysis is not empty
            if (!analysis || analysis.trim().length === 0) {
                console.error('⚠️ WARNING: Dog analysis is empty! This will cause sprite generation to fail.');
                throw new Error('Dog image analysis returned empty result. Please try again.');
            }
            
            // Construct a highly rigid structural prompt
            const tileSize = CONFIG.TILE_SIZE;
            const spriteSheetSize = tileSize * 4; // 4x4 grid = 256x256 pixels
            const totalFrames = 16; // 4 rows × 4 columns = 16 frames
            
            const spritePrompt = `TITLE: 16-bit Retro Dog Spritesheet - EXACT 256x256 PIXEL IMAGE (4x4 GRID, 16 FRAMES REQUIRED)

MANDATORY IMAGE SIZE - READ THIS FIRST:
- THE ENTIRE IMAGE MUST BE EXACTLY 256 PIXELS WIDE × 256 PIXELS TALL.
- DO NOT GENERATE ANY OTHER SIZE. NOT 512x512, NOT 1024x1024, NOT ANY OTHER SIZE.
- THE FINAL OUTPUT IMAGE DIMENSIONS MUST BE PRECISELY 256×256 PIXELS.

CHARACTER DESCRIPTION (from image analysis):
${analysis}

CRITICAL - ACCURACY REQUIREMENTS:
- The dog MUST match the visual description above EXACTLY.
- Use the EXACT colors, markings, and features described in the analysis.
- If the analysis mentions specific colors (e.g., "brown and white"), use those EXACT colors.
- If the analysis mentions distinctive features (spots, patches, ear color, collar), include them EXACTLY.
- The dog's breed/type and body shape from the analysis must be accurately represented.
- Do NOT simplify or generalize - match the specific dog from the image analysis.

STYLE: SNES-era pixel art, vibrant colors, clean outlines, 16-bit aesthetic.

CRITICAL IMAGE REQUIREMENTS:
- EXACT Canvas Size: ${spriteSheetSize}x${spriteSheetSize} pixels (256×256) - THIS IS MANDATORY.
- EXACT Layout: 4 rows × 4 columns = 16 frames total (NO MORE, NO LESS).
- Each frame cell: EXACTLY ${tileSize}x${tileSize} pixels (${tileSize}px wide × ${tileSize}px tall).

FRAME GRID LAYOUT (READ CAREFULLY):
The image must be divided into a perfect 4×4 grid. Frame numbering starts at 0 in the top-left corner and goes left-to-right, top-to-bottom:

Row 1 (Top Row, Y=0 to Y=${tileSize-1}):
  Frame 0: Walk Right - Frame 1 (X=0 to X=${tileSize-1})
  Frame 1: Walk Right - Frame 2 (X=${tileSize} to X=${tileSize*2-1})
  Frame 2: Walk Right - Frame 3 (X=${tileSize*2} to X=${tileSize*3-1})
  Frame 3: Walk Right - Frame 4 (X=${tileSize*3} to X=${tileSize*4-1})

Row 2 (Second Row, Y=${tileSize} to Y=${tileSize*2-1}):
  Frame 4: Walk Left - Frame 1 (X=0 to X=${tileSize-1})
  Frame 5: Walk Left - Frame 2 (X=${tileSize} to X=${tileSize*2-1})
  Frame 6: Walk Left - Frame 3 (X=${tileSize*2} to X=${tileSize*3-1})
  Frame 7: Walk Left - Frame 4 (X=${tileSize*3} to X=${tileSize*4-1})

Row 3 (Third Row, Y=${tileSize*2} to Y=${tileSize*3-1}):
  Frame 8: Jump - Frame 1 (X=0 to X=${tileSize-1})
  Frame 9: Jump - Frame 2 (X=${tileSize} to X=${tileSize*2-1})
  Frame 10: Jump - Frame 3 (X=${tileSize*2} to X=${tileSize*3-1})
  Frame 11: Jump - Frame 4 (X=${tileSize*3} to X=${tileSize*4-1})

Row 4 (Bottom Row, Y=${tileSize*3} to Y=${tileSize*4-1}):
  Frame 12: Idle - Frame 1 (X=0 to X=${tileSize-1})
  Frame 13: Idle - Frame 2 (X=${tileSize} to X=${tileSize*2-1})
  Frame 14: Idle - Frame 3 (X=${tileSize*2} to X=${tileSize*3-1})
  Frame 15: Idle - Frame 4 (X=${tileSize*3} to X=${tileSize*4-1})

ALIGNMENT REQUIREMENTS - CRITICAL FOR GROUND POSITIONING:
HORIZONTAL ALIGNMENT:
- Every sprite must be PIXEL-PERFECTLY CENTERED horizontally within its ${tileSize}x${tileSize} cell.
- The dog's center should align with the horizontal center of each cell (at X=${Math.floor(tileSize/2)} within each cell).

VERTICAL ALIGNMENT (CRITICAL - DO NOT CENTER VERTICALLY):
- The dog's FEET must be positioned at the BOTTOM EDGE of each ${tileSize}x${tileSize} cell.
- Within each cell, the bottom edge is at Y=${tileSize-1} (relative to that cell's top-left corner at Y=0).
- The dog should NOT be centered vertically - it must be positioned so its feet touch the bottom of the cell.
- Every sprite must have the SAME vertical baseline (feet at the same Y-level relative to each cell's bottom edge).
- Character height: Approximately ${Math.round(tileSize * 0.625)}-${Math.round(tileSize * 0.78125)} pixels tall.
- The dog's body should extend UPWARD from the bottom of the cell, leaving empty space at the TOP of each cell.
- This ensures the dog appears to stand on the ground, not float in the air.

SUMMARY: Horizontally CENTERED, Vertically at BOTTOM (feet touching bottom edge).

CRITICAL CONSTRAINTS:
- BACKGROUND: Solid, uniform lime green (#00ff00) background ONLY. NO transparency, NO other colors.
- NO shadows, NO floor, NO grid lines, NO borders, NO decorative elements.
- The character must remain PERFECTLY CONSISTENT in size, features, colors, and proportions across ALL 16 frames.
- ALL 16 frames MUST be present. Missing frames will cause the game to break.

FINAL SIZE REMINDER - CRITICAL:
- THE OUTPUT IMAGE MUST BE EXACTLY 256 PIXELS WIDE AND 256 PIXELS TALL.
- TOTAL DIMENSIONS: 256×256 PIXELS. NO OTHER SIZE WILL WORK.
- VERIFY YOUR OUTPUT IS 256×256 BEFORE RETURNING IT.`;

            return spritePrompt;
        } catch (error) {
            console.error('Error analyzing dog image:', error);
            throw error;
        }
    }

    /**
     * Generate sprite sheet using Gemini 3 (Imagen 3 via Gemini API)
     */
    async generateSpriteSheet(dogDescription: string, imageBase64: string): Promise<string> {
        try {
            // Step 1: Analyze the dog image and create detailed prompt
            // Note: dogDescription parameter is kept for API compatibility but analysis is done from image
            const spritePrompt = await this.analyzeDogImageAndCreatePrompt(imageBase64);
            
            console.log('🎨 Generating sprite sheet with analysis-based prompt');
            console.log('📋 Prompt length:', spritePrompt.length, 'characters');
            console.log('📋 Prompt preview (first 500 chars):', spritePrompt.substring(0, 500));
            
            // Verify the analysis section is in the prompt
            if (!spritePrompt.includes('CHARACTER DESCRIPTION (from image analysis):')) {
                console.error('⚠️ ERROR: Prompt template is missing the analysis section!');
            } else {
                // Extract the analysis from the prompt to verify it's there
                const analysisMatch = spritePrompt.match(/CHARACTER DESCRIPTION \(from image analysis\):\s*\n([\s\S]*?)\nSTYLE:/);
                if (analysisMatch && analysisMatch[1]) {
                    const extractedAnalysis = analysisMatch[1].trim();
                    console.log('✅ Verified: Analysis found in prompt, length:', extractedAnalysis.length, 'characters');
                    console.log('📝 Analysis in prompt (first 100 chars):', extractedAnalysis.substring(0, 100));
                } else {
                    console.warn('⚠️ WARNING: Could not extract analysis from prompt - it may be empty or malformed');
                }
            }

            // Step 2: Generate Image
            const model = DEBUG_MODE ? 'gemini-2.5-flash-image' : 'gemini-3-pro-image-preview';
            const requestBody = {
                contents: [{
                    parts: [{ text: spritePrompt }]
                }],
                generationConfig: {
                    temperature: 0.2,
                    topK: 16,
                    topP: 0.9,
                    maxOutputTokens: 8192,
                }
            };
            
            const response = await this.makeApiRequest(model, requestBody);

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
                    console.log('🎨 Removing background from player sprite sheet...');
                    const processedBase64 = await this.removeSolidBackground(rawBase64);
                    console.log('✅ Background removal complete for player sprite sheet');
                    return processedBase64;
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
    async generateEnemySpriteSheet(enemyType: string = 'cat'): Promise<string> {
        try {
            console.log(`Generating ${enemyType} enemy spritesheet...`);
            
            const tileSize = CONFIG.TILE_SIZE;
            const spriteSheetSize = tileSize * 4; // 4x4 grid = 256x256 pixels
            const totalFrames = 16; // 4 rows × 4 columns = 16 frames
            
            const enemyPrompt = `TITLE: 16-bit Retro ${enemyType.toUpperCase()} Enemy Spritesheet - EXACT 4x4 GRID (16 FRAMES REQUIRED)
CHARACTER DESCRIPTION: A cool, slightly mischievous ${enemyType} for a platformer enemy. 
STYLE: SNES-era pixel art, vibrant colors, clean outlines, 16-bit aesthetic.

CRITICAL IMAGE REQUIREMENTS:
- EXACT Canvas Size: ${spriteSheetSize}x${spriteSheetSize} pixels (NO EXCEPTIONS).
- EXACT Layout: 4 rows × 4 columns = 16 frames total (NO MORE, NO LESS).
- Each frame cell: EXACTLY ${tileSize}x${tileSize} pixels (${tileSize}px wide × ${tileSize}px tall).

FRAME GRID LAYOUT (READ CAREFULLY):
The image must be divided into a perfect 4×4 grid. Frame numbering starts at 0 in the top-left corner and goes left-to-right, top-to-bottom:

Row 1 (Top Row, Y=0 to Y=${tileSize-1}):
  Frame 0: Walk Right - Frame 1 (X=0 to X=${tileSize-1})
  Frame 1: Walk Right - Frame 2 (X=${tileSize} to X=${tileSize*2-1})
  Frame 2: Walk Right - Frame 3 (X=${tileSize*2} to X=${tileSize*3-1})
  Frame 3: Walk Right - Frame 4 (X=${tileSize*3} to X=${tileSize*4-1})

Row 2 (Second Row, Y=${tileSize} to Y=${tileSize*2-1}):
  Frame 4: Walk Left - Frame 1 (X=0 to X=${tileSize-1})
  Frame 5: Walk Left - Frame 2 (X=${tileSize} to X=${tileSize*2-1})
  Frame 6: Walk Left - Frame 3 (X=${tileSize*2} to X=${tileSize*3-1})
  Frame 7: Walk Left - Frame 4 (X=${tileSize*3} to X=${tileSize*4-1})

Row 3 (Third Row, Y=${tileSize*2} to Y=${tileSize*3-1}):
  Frame 8: Attack - Frame 1 (X=0 to X=${tileSize-1})
  Frame 9: Attack - Frame 2 (X=${tileSize} to X=${tileSize*2-1})
  Frame 10: Attack - Frame 3 (X=${tileSize*2} to X=${tileSize*3-1})
  Frame 11: Attack - Frame 4 (X=${tileSize*3} to X=${tileSize*4-1})

Row 4 (Bottom Row, Y=${tileSize*3} to Y=${tileSize*4-1}):
  Frame 12: Idle - Frame 1 (X=0 to X=${tileSize-1})
  Frame 13: Idle - Frame 2 (X=${tileSize} to X=${tileSize*2-1})
  Frame 14: Idle - Frame 3 (X=${tileSize*2} to X=${tileSize*3-1})
  Frame 15: Idle - Frame 4 (X=${tileSize*3} to X=${tileSize*4-1})

ALIGNMENT REQUIREMENTS:
- Every sprite must be PIXEL-PERFECTLY CENTERED horizontally within its ${tileSize}x${tileSize} cell.
- Every sprite must have the SAME vertical baseline (feet at the same Y-level in every cell).
- Character height: Approximately ${Math.round(tileSize * 0.625)}-${Math.round(tileSize * 0.78125)} pixels within each ${tileSize}px cell.

CRITICAL CONSTRAINTS:
- BACKGROUND: Solid, uniform lime green (#00ff00) background ONLY. NO transparency, NO other colors.
- NO shadows, NO floor, NO grid lines, NO borders, NO decorative elements.
- The character must remain PERFECTLY CONSISTENT in size, features, colors, and proportions across ALL 16 frames.
- The image MUST be exactly ${spriteSheetSize}x${spriteSheetSize} pixels. If you cannot create this exact size, DO NOT generate the image.
- ALL 16 frames MUST be present. Missing frames will cause the game to break.`;

            const model = DEBUG_MODE ? 'gemini-2.5-flash-image' : 'gemini-3-pro-image-preview';
            const requestBody = {
                contents: [{
                    parts: [{ text: enemyPrompt }]
                }],
                generationConfig: {
                    temperature: 0.3,
                    topK: 16,
                    topP: 0.9,
                    maxOutputTokens: 8192,
                }
            };
            
            const response = await this.makeApiRequest(model, requestBody);

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
    async removeSolidBackground(base64Image: string): Promise<string> {
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

                // Sample corner and edge pixels to find lime green (#00ff00) background regions
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

                // Detect the ACTUAL background color by sampling corners/edges
                // This handles cases where Gemini returns a slightly different green than #00ff00
                const samplePixels: Array<{r: number, g: number, b: number}> = [];
                for (const pos of [...corners, ...edgeSamples]) {
                    const i = (pos.y * width + pos.x) * 4;
                    samplePixels.push({
                        r: data[i],
                        g: data[i + 1],
                        b: data[i + 2]
                    });
                }
                
                // Find green-ish pixels in the samples (likely background)
                // Very lenient detection to catch various shades of green that Gemini might return
                const greenSamples = samplePixels.filter(p => {
                    // Method 1: Green is clearly dominant
                    const greenDominant = p.g > 80 && p.g > p.r * 1.2 && p.g > p.b * 1.2;
                    // Method 2: Bright green-ish color (likely background)
                    const isBrightGreenish = (p.r + p.g + p.b) > 250 && p.g > 100 && p.g > p.r && p.g > p.b;
                    // Method 3: Very bright overall (likely solid background color)
                    const isVeryBright = (p.r + p.g + p.b) > 500;
                    return greenDominant || isBrightGreenish || (isVeryBright && p.g > p.r && p.g > p.b);
                });
                
                // Calculate average background color from green samples
                let avgBgR = 0, avgBgG = 255, avgBgB = 0; // Default to #00ff00
                if (greenSamples.length > 0) {
                    avgBgR = Math.round(greenSamples.reduce((sum, p) => sum + p.r, 0) / greenSamples.length);
                    avgBgG = Math.round(greenSamples.reduce((sum, p) => sum + p.g, 0) / greenSamples.length);
                    avgBgB = Math.round(greenSamples.reduce((sum, p) => sum + p.b, 0) / greenSamples.length);
                    console.log(`🎨 Detected background color: RGB(${avgBgR}, ${avgBgG}, ${avgBgB}) from ${greenSamples.length} green samples (out of ${samplePixels.length} total samples)`);
                } else {
                    console.warn('⚠️ No green samples found in corners/edges, using default #00ff00');
                    console.log(`Sample pixels:`, samplePixels.slice(0, 5).map(p => `RGB(${p.r},${p.g},${p.b})`));
                }

                // Primary method: Detect the ACTUAL background green color (not just #00ff00)
                // This handles slight variations in the green that Gemini returns
                const isGreenColor = (r, g, b) => {
                    // Use detected background color as target, with tolerance
                    const TARGET_R = avgBgR;
                    const TARGET_G = avgBgG;
                    const TARGET_B = avgBgB;
                    const TOLERANCE = 80; // Increased tolerance to handle more variation
                    
                    // Calculate distance from detected background color
                    const distance = Math.sqrt(
                        Math.pow(r - TARGET_R, 2) + 
                        Math.pow(g - TARGET_G, 2) + 
                        Math.pow(b - TARGET_B, 2)
                    );
                    
                    // Primary check: close to detected background color
                    if (distance <= TOLERANCE) return true;
                    
                    // Secondary check: bright green with very low red/blue (more lenient)
                    // Green must be dominant and bright, red/blue must be very low
                    const isBrightGreen = g > 180 && r < 100 && b < 100;
                    const greenDominance = g > r * 1.5 && g > b * 1.5;
                    
                    return isBrightGreen && greenDominance;
                };
                
                
                // Check if pixel is near edge (likely background)
                const isNearEdge = (x, y, edgeDistance = 5) => {
                    return x < edgeDistance || x >= width - edgeDistance || 
                           y < edgeDistance || y >= height - edgeDistance;
                };

                // Method 1: Flood fill background removal to preserve internal colors
                // This starts from the corners and removes only connected lime green (#00ff00) pixels
                const visited = new Uint8Array(width * height);
                const stack = [...corners, ...edgeSamples];
                let removedCount = 0;
                
                // Use the detected background color (not hardcoded #00ff00)
                const TARGET_LIME_GREEN_R = avgBgR;
                const TARGET_LIME_GREEN_G = avgBgG;
                const TARGET_LIME_GREEN_B = avgBgB;
                const LIME_GREEN_TOLERANCE = 80; // Increased tolerance
                
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
                    
                    // Check if pixel is lime green (#00ff00) chroma key
                    // Calculate distance from target #00ff00
                    const limeGreenDistance = Math.sqrt(
                        Math.pow(r - TARGET_LIME_GREEN_R, 2) + 
                        Math.pow(g - TARGET_LIME_GREEN_G, 2) + 
                        Math.pow(b - TARGET_LIME_GREEN_B, 2)
                    );
                    
                    // Check if pixel is close to #00ff00
                    const isLimeGreen = limeGreenDistance <= LIME_GREEN_TOLERANCE ||
                                      // Fallback: bright green with very low red/blue
                                      (g > 200 && r < 80 && b < 80 && g > r * 2 && g > b * 2);
                    
                    const isBg = isLimeGreen; // Only remove lime green (#00ff00) chroma key

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
                
                // Method 2: Pass through entire image to remove any remaining lime green pixels
                // This catches isolated lime green pixels that weren't connected to edges
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
                        
                        // Use the detected background color (not hardcoded #00ff00)
                        const TARGET_LIME_GREEN_R = avgBgR;
                        const TARGET_LIME_GREEN_G = avgBgG;
                        const TARGET_LIME_GREEN_B = avgBgB;
                        const LIME_GREEN_TOLERANCE = 80; // Increased tolerance
                        
                        // Calculate distance from target #00ff00
                        const limeGreenDistance = Math.sqrt(
                            Math.pow(r - TARGET_LIME_GREEN_R, 2) + 
                            Math.pow(g - TARGET_LIME_GREEN_G, 2) + 
                            Math.pow(b - TARGET_LIME_GREEN_B, 2)
                        );
                        
                        // Check if pixel is close to #00ff00
                        const isLimeGreen = limeGreenDistance <= LIME_GREEN_TOLERANCE ||
                                          // Fallback: bright green with very low red/blue
                                          (g > 200 && r < 80 && b < 80 && g > r * 2 && g > b * 2);
                        
                        // Pure green check (exact or very close to #00ff00)
                        const isPureGreen = g > 240 && r < 50 && b < 50;
                        
                        // Only remove lime green (#00ff00) chroma key pixels
                        if (isLimeGreen || isPureGreen) {
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
    parseApiError(errorText: string, statusCode: number): ApiError {
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
     * Returns an object with base64 tile images: { treat, bone, platform, water }
     * 
     * NOTE: Generates platform, water/hazard, and collectible objects (treat, bone).
     * - Ground tiles: NOT generated (location-based background serves as ground)
     * - Cat/enemy tiles: NOT generated (uses static Cat.png file)
     * - Platform and Water tiles use location data for context-aware generation
     */
    // generateLevelTiles and generateSingleTile methods removed
    // These methods generated platform, water, treat, and bone tiles that were never used
    // The game now uses a simple floor instead of AI-generated tiles

    /**
     * Get user's location data from IP address
     */
    async getUserLocation(): Promise<LocationData> {
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
    async getTimeAndWeather(location: LocationData): Promise<TimeWeather> {
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
                weatherReport: { description: 'clear sky', hasPrecipitation: false, precipitationType: 'none', weatherCode: 0 }
            };
        }
    }

    /**
     * Generate a location-based background prompt using Gemini
     */
    async generateBackgroundPrompt(location: LocationData, timeWeather: TimeWeather): Promise<string> {
        try {
            const weatherDesc = timeWeather.weatherReport?.description || (timeWeather.timeOfDay === 'night' ? 'clear night sky with stars' : 'appropriate for current location');
            
            const prompt = `Describe a beautiful, immersive landscape scene for a retro 16-bit platformer game background based on this real-world data:

Location: ${location.city}, ${location.region}, ${location.country}
Time: ${timeWeather.timeString} (${timeWeather.timeOfDay})
Season: ${timeWeather.season}
Weather: ${weatherDesc}

CRITICAL REQUIREMENT - GEOGRAPHIC TOPOGRAPHY ACCURACY:
- You MUST research and accurately represent the ACTUAL topography and geography of ${location.city}, ${location.region}, ${location.country}.
- DO NOT include mountains, hills, or elevated terrain if ${location.city} is located on flat plains, coastal lowlands, or river valleys.
- DO NOT include flat plains if ${location.city} is located in mountainous or hilly regions.
- If ${location.city} is coastal, include appropriate coastal features (ocean, beaches, cliffs, harbors) ONLY if they actually exist.
- If ${location.city} is inland, do NOT include ocean or coastal features.
- If ${location.city} is in a desert region, include desert-appropriate features (sand, cacti, arid landscapes).
- If ${location.city} is in a forested region, include appropriate forest features.
- Research the ACTUAL elevation, terrain type, and natural features of ${location.city} and represent them accurately.
- The topography MUST match real-world geographic data for this location.

CRITICAL REQUIREMENT - LANDMARKS ARE MANDATORY:
- You MUST include MAJOR, HIGHLY RECOGNIZABLE landmarks from ${location.city}. This is NOT optional.
- Landmarks should be ARCHITECTURAL, HISTORICAL, or NATURAL features that make ${location.city} instantly recognizable.
- Examples: Famous buildings, monuments, bridges, skylines, natural formations, or iconic structures unique to ${location.city}.
- Landmarks must be MASSIVE and DOMINANT in the scene - they should be the PRIMARY focal point, taking up a significant portion of the background.
- Describe landmarks in EXTREME detail with specific architectural features, distinctive shapes, and recognizable characteristics.
- The scene MUST feel uniquely and immediately identifiable as ${location.city} - if someone familiar with ${location.city} sees this background, they should instantly recognize it.
- If ${location.city} has famous landmarks (like the Eiffel Tower for Paris, Statue of Liberty for New York, Golden Gate Bridge for San Francisco, etc.), these MUST be prominently featured.
- Do NOT create generic cityscapes - this MUST be specifically and unmistakably ${location.city}.

SEAMLESS HORIZONTAL TILING REQUIREMENT:
- This background will be tiled horizontally and MUST tile seamlessly without visible seams or restarts.
- The left edge and right edge must connect perfectly when placed side-by-side.
- Large landmarks should either be fully contained within the frame OR positioned so they wrap seamlessly from right edge to left edge.
- Avoid placing major landmarks exactly at the edges - center them or ensure perfect wraparound.
- The background must create a continuous, seamless loop when tiled horizontally.

STRICT REALISM REQUIREMENT - NO FANTASY ELEMENTS:
- This background MUST be based on REAL-WORLD locations and features ONLY.
- ABSOLUTELY NO fantasy elements: NO castles, NO dragons, NO magical creatures, NO fantasy architecture, NO mythical structures.
- NO fictional or imaginary landmarks - only REAL, ACTUAL landmarks that exist in ${location.city}.
- The scene must be PHOTOGRAPHICALLY ACCURATE to the real-world appearance of ${location.city}.
- Use ONLY real architectural styles, real natural features, and real landmarks that actually exist in ${location.city}.
- If you are unsure about specific landmarks in ${location.city}, describe realistic urban or natural landscapes typical of ${location.region}, ${location.country} that would be found in real-world locations.
- The background should look like a real photograph converted to 16-bit pixel art, NOT a fantasy game world.

Do not include any text or signs. Description should be vivid for a 16-bit SNES style pixel art aesthetic.`;

            const model = DEBUG_MODE ? 'gemini-2.5-flash' : 'gemini-3-pro-image-preview';
            const requestBody = {
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 1024,
                }
            };
            
            const response = await this.makeApiRequest(model, requestBody);

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
                    return `A realistic SNES-era pixel art landscape of ${location.city}, ${location.region}, ${location.country} based on real-world locations. No fantasy elements - only real architectural and natural features.`;
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
    async generateBackgroundImage(prompt: string, timeWeather: TimeWeather | null = null, progressCallback?: (current: number, total: number) => void): Promise<BackgroundData> {
        try {
            // Generate configured number of separate frames for smoother animation and less jitter
            const frameWidth = CONFIG.API.BACKGROUND_FRAME_WIDTH; 
            const frameHeight = CONFIG.API.BACKGROUND_FRAME_HEIGHT; 
            const totalFrames = CONFIG.API.BACKGROUND_FRAME_COUNT;
            
            console.log(`Generating ${totalFrames}-frame animated background sequentially (${frameWidth}x${frameHeight})...`);
            
            const frames = [];
            let previousFrame = null;
            
            // Generate a random seed for this background set to improve frame consistency
            const seed = Math.floor(Math.random() * 1000000);
            console.log(`Using seed ${seed} for all frames in this background set.`);
            
            const hasPrecipitation = timeWeather?.weatherReport?.hasPrecipitation;
            const precipitationType = timeWeather?.weatherReport?.precipitationType || 'rain';
            
            // Notify progress: starting
            if (progressCallback) {
                progressCallback(0, totalFrames);
            }
            
            // PRE-PROMPT: Explain the animation context before generating frames
            const animationContext = `IMPORTANT CONTEXT - ANIMATED BACKGROUND GENERATION:
You are generating 8 separate images that will be used as frames in an animated background for a retro 16-bit platformer game.

DUAL ANIMATION SYSTEM - CRITICAL TO UNDERSTAND:
1. FRAME CYCLING ANIMATION: These 8 images cycle continuously in a loop (Frame 1 → Frame 2 → ... → Frame 8 → Frame 1 → ...)
   - The animation plays at 2 frames per second (very slow, smooth motion)
   - This creates subtle movement within each frame (clouds drifting, gentle swaying, weather effects)
   
2. HORIZONTAL SCROLLING: Each frame also scrolls horizontally as the player moves through the level
   - Multiple copies of each frame are placed side-by-side to create a continuous scrolling background
   - The background scrolls smoothly as the player moves left or right
   - This means the same frame will be visible multiple times across the screen width

ANIMATION REQUIREMENTS FOR BOTH SYSTEMS:
- All 8 frames must maintain visual consistency: same landmarks, same composition, same overall scene
- Only subtle elements should animate between frames (clouds drifting slowly, gentle swaying of trees/vegetation, slow weather effects)
- Major structures, landmarks, and buildings must remain COMPLETELY STATIC across all 8 frames
- Frame 8 must loop seamlessly back to Frame 1 (the frame cycling animation should be continuous and cyclical)
- Each frame is 1024x1024 pixels and must tile horizontally without seams (for smooth horizontal scrolling)
- The animation must look smooth and natural when BOTH cycling through frames AND scrolling horizontally
- Avoid any rapid motion, sudden changes, or elements that would cause visual jitter in either animation mode
- Keep this dual animation context in mind for all 8 frames you generate.`;

            console.log('📋 Animation context provided to AI:', animationContext);
            
            for (let i = 0; i < totalFrames; i++) {
                const frameNum = i + 1;
                let framePrompt;
                
                if (frameNum === 1) {
                    // Initial frame: Description based on location, with animation context
                    framePrompt = `${animationContext}

A 16-bit retro pixel art landscape for a side-scrolling platformer background.
                    Theme: ${prompt}
                    Style: SNES-era pixel art, vibrant colors, dithered shading, clear layers.
                    
                    MANDATORY IMAGE SIZE:
                    - The output image MUST be exactly 1024 pixels wide by 1024 pixels tall.
                    - NOT any other size - EXACTLY 1024x1024 pixels.
                    - This is critical for proper tiling and animation.
                    
                    CRITICAL - SEAMLESS HORIZONTAL TILING:
                    - This image MUST tile horizontally PERFECTLY without any visible seams or restarts.
                    - The FAR LEFT edge and FAR RIGHT edge must match pixel-for-pixel so they connect seamlessly when placed side-by-side.
                    - When the background scrolls horizontally, there must be NO visible break or restart point - it must appear as one continuous scene.
                    - Do NOT cut large landmarks in half at the edges. Either keep them fully contained within the frame OR position them so they wrap seamlessly from right edge to left edge.
                    - Test the tiling mentally: if you place two copies side-by-side, they should form one continuous, seamless image with no obvious repetition point.
                    
                    ANIMATION REQUIREMENTS (2 FPS - SLOW, SMOOTH):
                    - This background will animate at 2 frames per second (very slow, smooth animation).
                    - Only subtle elements should animate: clouds drifting slowly, gentle swaying of trees/vegetation, slow weather effects.
                    - All landmarks, buildings, and major structures must remain COMPLETELY STATIC and never move between frames.
                    - Animation must be EXTREMELY subtle to prevent jitter or visual discomfort at 2 fps.
                    - Avoid rapid motion, sudden changes, or elements that would cause visual jitter when cycling through frames.
                    
                    Composition - LANDMARKS ARE CRITICAL:
                    - The landmarks described in the prompt MUST be MASSIVE, DOMINANT, and HIGHLY VISIBLE in this image.
                    - Landmarks should occupy a MAJOR portion of the background (at least 30-50% of the visible area).
                    - Landmarks must be rendered with EXTREME detail and clarity so they are instantly recognizable.
                    - The scene should include sky, PROMINENT ICONIC LANDMARKS (as the primary focus), and ground elements.
                    - If the prompt mentions specific landmarks, they MUST appear prominently in this frame.
                    ${hasPrecipitation ? `Weather effect: Show visible ${precipitationType} falling slowly in the foreground and midground (pixel art ${precipitationType} streaks or flakes). Keep motion very subtle for 2 fps animation.` : ''}
                    NO text, NO signs. This is the first frame of an 8-frame animation loop that will play at 2 fps.
                    OUTPUT SIZE: 1024 by 1024 pixels - VERIFY YOUR OUTPUT IS EXACTLY 1024x1024 BEFORE RETURNING IT.`;
                } else {
                    // Subsequent frames: Include animation context and dual-reference for structure (Frame 1) and motion (Frame i-1)
                    let animationText = '';
                    const progress = ((frameNum - 1) / totalFrames * 100).toFixed(1);
                    
                    if (frameNum < totalFrames) {
                        animationText = `REMEMBER: This is part of an 8-frame animated background loop. Frame ${frameNum} of ${totalFrames} (${progress}% through the loop). 
                        Move clouds slightly further right than in the previous frame. Increase any swaying or rippling slightly.`;
                    } else {
                        animationText = `REMEMBER: This is part of an 8-frame animated background loop. This is the FINAL frame (${progress}%). 
                        It MUST lead perfectly back to Frame 1 to complete the seamless animation cycle. 
                        Clouds should be at their furthest position, such that the next step would be their exact position in Frame 1. 
                        All swaying and rippling should be at a state that connects seamlessly back to the start of the loop.`;
                    }
                    
                    if (hasPrecipitation) {
                        const effect = precipitationType === 'snow' ? 'drift further down and across' : 'fall downward in progressive streaks';
                        animationText += ` Also advance the ${precipitationType} animation so it cycles seamlessly.`;
                    }

                    framePrompt = `${animationContext}

Generate frame ${frameNum} of an ${totalFrames}-frame SEAMLESS animation loop.
                    You are provided with TWO images:
                    1. The FIRST FRAME (Anchor): Use this to keep all buildings and landmarks pixel-perfect.
                    2. The PREVIOUS FRAME (Continuity): Use this to ensure smooth, incremental motion.

                    MANDATORY IMAGE SIZE:
                    - The output image MUST be exactly 1024 pixels wide by 1024 pixels tall.
                    - NOT 512x512, NOT any other size - EXACTLY 1024x1024 pixels.
                    - This is critical for proper tiling and animation.

                    CRITICAL - ANIMATION SPEED: 2 FPS (VERY SLOW):
                    - This animation plays at 2 frames per second - EXTREMELY slow and smooth.
                    - Motion must be MINIMAL and SUBTLE - barely perceptible changes between frames.
                    - Avoid any rapid movement, sudden changes, or elements that would cause visual jitter.
                    - Animation should feel like a gentle, slow drift - not active motion.
                    
                    STABILITY PROTOCOL - LANDMARKS MUST STAY FIXED: 
                    - All landmarks, buildings, and ground from the FIRST FRAME must remain in the EXACT same pixel positions. ZERO drift.
                    - Landmarks are COMPLETELY STATIC and must NEVER move or shift between frames - they are the anchor of the scene.
                    - Only weather effects (clouds, precipitation) and small decorative elements should animate - landmarks stay perfectly still.
                    - Even animated elements must move VERY SLOWLY to prevent jitter at 2 fps.
                    
                    SEAMLESS TILING PROTOCOL - NO VISIBLE RESTARTS:
                    - Maintain PERFECT horizontal tiling. The left edge MUST always match the right edge perfectly.
                    - When tiled horizontally, there must be NO visible seam, break, or restart point - it must appear as one continuous scene.
                    - If a cloud or object moves off the RIGHT edge, it MUST reappear exactly from the LEFT edge (wraparound) at the correct position.
                    - Test mentally: placing multiple copies side-by-side should create a seamless, continuous background with no obvious repetition.
                    - Avoid patterns or elements that would make the tiling obvious or create visible restart points.
                    
                    ANTI-JITTER PROTOCOL:
                    - Keep all motion EXTREMELY subtle and slow to prevent visual jitter at 2 fps.
                    - Avoid elements that flicker, jump, or change rapidly between frames.
                    - Ensure smooth, gradual transitions that won't cause visual discomfort when cycling.
                    - Static elements (landmarks, buildings) must be pixel-perfect identical across all frames.
                    
                    LOOPING INSTRUCTIONS:
                    ${animationText}
                    
                    The resulting image must be 1024x1024 with the same SNES-era pixel art style.
                    OUTPUT SIZE: 1024x1024 pixels - VERIFY YOUR OUTPUT IS EXACTLY 1024×1024 BEFORE RETURNING IT.`;
                }
                
                // Use first frame as anchor and previous frame for continuity
                const referenceFrames = [];
                if (frameNum > 1) {
                    referenceFrames.push(frames[0]); // Frame 1 is always first
                    if (frameNum > 2) {
                        referenceFrames.push(frames[frames.length - 1]); // Previous frame is second
                    }
                }
                
                console.log(`API: Generating frame ${frameNum}/${totalFrames}...`);
                const currentFrame = await this.generateSingleFrame(framePrompt, frameNum, referenceFrames, seed, totalFrames);
                console.log(`API: Frame ${frameNum} received from Gemini, base64 length: ${currentFrame?.length || 0}, starts with: ${currentFrame?.substring(0, 50) || 'none'}`);
                
                // Ensure frame is exactly the right size (resize if needed)
                const resizedFrame = await this.resizeImageToExactSize(currentFrame, frameWidth, frameHeight);
                console.log(`API: Frame ${frameNum} resized, final base64 length: ${resizedFrame?.length || 0}`);
                frames.push(resizedFrame);
                
                // Notify progress: frame completed
                if (progressCallback) {
                    progressCallback(frameNum, totalFrames);
                }
                
                console.log(`Frame ${frameNum}/${totalFrames} generated successfully (References: ${referenceFrames.length}).`);
            }

            console.log(`Successfully generated ${frames.length} background frames sequentially`);
            
            // Return the frames as an array - we'll cycle through them for animation
            // Store as an object with frames array and metadata
            const backgroundData: BackgroundData = {
                frames: frames, // Array of 8 base64 images (1024x1024 each)
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
    async generateSingleFrame(prompt: string, frameNumber: number, referenceFrames: string[] | null = null, seed: number | null = null, totalFrames: number = 8): Promise<string> {
        console.log(`Generating background frame ${frameNumber}/${totalFrames}...`);
        
        // Prepare request body
        const parts: Array<{ text: string } | { inline_data: { mime_type: string; data: string } }> = [{ text: prompt }];
        
        // If we have reference frames, include them for image-to-image consistency
        if (referenceFrames && Array.isArray(referenceFrames) && referenceFrames.length > 0) {
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
                    } as any
                });
                console.log(`Including reference frame ${index + 1} in request for frame ${frameNumber}`);
            });
        }
        
        const model = DEBUG_MODE ? 'gemini-2.5-flash-image' : 'gemini-3-pro-image-preview';
        const requestBody = {
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
        };
        
        const response = await this.makeApiRequest(model, requestBody);

        if (!response.ok) {
            const errorText = await response.text();
            throw this.parseApiError(errorText, response.status);
        }

        const data = await response.json();
        
        // Log raw response structure for debugging
        console.log(`API: Frame ${frameNumber} raw response structure:`, {
            hasCandidates: !!data.candidates,
            candidateCount: data.candidates?.length || 0,
            firstCandidateParts: data.candidates?.[0]?.content?.parts?.length || 0
        });
        
        const candidate = data.candidates?.[0];
        if (!candidate) {
            console.error(`API: No candidates in response for frame ${frameNumber}. Full response:`, JSON.stringify(data, null, 2));
            throw new Error(`No candidates returned for frame ${frameNumber}`);
        }

        // Check for text refusals first
        for (const part of candidate.content.parts) {
            if (part.text) {
                const textContent = part.text.toLowerCase();
                if (textContent.includes("i cannot") || textContent.includes("error") || 
                    textContent.includes("sorry") || textContent.includes("unable")) {
                    console.error(`API: Model refusal for frame ${frameNumber}:`, part.text);
                    throw new Error(`Model Refusal for frame ${frameNumber}: ${part.text}`);
                }
            }
        }

        // Look for image data
        for (const part of candidate.content.parts) {
            if (part.inline_data || part.inlineData) {
                const inline = part.inline_data || part.inlineData;
                
                // Validate base64 data
                if (!inline.data || inline.data.length === 0) {
                    console.error(`API: Empty base64 data for frame ${frameNumber}`);
                    throw new Error(`Empty image data for frame ${frameNumber}`);
                }
                
                // Check base64 data length (should be substantial for a 1024x1024 image)
                const base64Length = inline.data.length;
                console.log(`API: Frame ${frameNumber} base64 data length: ${base64Length} characters`);
                if (base64Length < 1000) {
                    console.warn(`API: ⚠️ Frame ${frameNumber} base64 data is suspiciously short (${base64Length} chars). Expected ~400k+ for 1024x1024 PNG.`);
                }
                
                const rawBase64 = `data:${inline.mime_type || inline.mimeType};base64,${inline.data}`;
                
                // Validate image before resizing
                await this.validateImageContent(rawBase64, frameNumber, 'before resize');
                
                // Resize to exactly 1024x1024 if needed (Gemini sometimes returns different sizes)
                console.log(`API: Frame ${frameNumber} received from Gemini, checking size...`);
                const resizedBase64 = await this.resizeImageToExactSize(rawBase64, CONFIG.API.BACKGROUND_FRAME_WIDTH, CONFIG.API.BACKGROUND_FRAME_HEIGHT);
                
                // Validate image after resizing
                await this.validateImageContent(resizedBase64, frameNumber, 'after resize');
                
                console.log(`API: Frame ${frameNumber} processed, final size should be ${CONFIG.API.BACKGROUND_FRAME_WIDTH}x${CONFIG.API.BACKGROUND_FRAME_HEIGHT}`);
                console.log(`Frame ${frameNumber}/${totalFrames} generated successfully`);
                return resizedBase64;
            }
        }

        // If we get here, no image data was found
        console.error(`API: No image data found in frame ${frameNumber} response. Parts:`, candidate.content.parts.map(p => ({ 
            hasText: !!p.text, 
            hasInlineData: !!(p.inline_data || p.inlineData),
            textPreview: p.text?.substring(0, 100)
        })));
        throw new Error(`No image data found in frame ${frameNumber} response.`);
    }
    
    /**
     * Combine 4 frames into a single horizontal spritesheet
     * Each frame from Gemini is 1024x1024, combined into 4096x1024 spritesheet
     * Scaling to fit the view window happens in the game code when displaying
     */
    async combineFramesIntoSpritesheet(frameDataUrls: string[], frameWidth: number, frameHeight: number): Promise<string> {
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
                            resolveImg(undefined);
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
    async generateLocationBackground(): Promise<BackgroundData> {
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
            // Add progress callback to update UI
            const updateProgress = (current: number, total: number) => {
                const statusEl = document.getElementById('generation-status');
                if (statusEl) {
                    const percent = Math.round((current / total) * 100);
                    statusEl.innerHTML = `<div class="loader"></div> Generating background: Frame ${current}/${total} (${percent}%)`;
                    statusEl.style.color = '#ffd700';
                }
            };
            
            const backgroundData = await this.generateBackgroundImage(prompt, timeWeather, updateProgress);
            console.log('Background frames generated');
            
            // Clear progress message
            const statusEl = document.getElementById('generation-status');
            if (statusEl) {
                statusEl.innerHTML = '';
            }
            
            // Step 5: Cache it with version 5 (8 separate frames in array, no spritesheet in localStorage to save space)
            try {
                // Clear old spritesheet if it exists to make space
                localStorage.removeItem('location_background');
                
                // Store the frames array (already 1024x1024 from API, 8 frames total)
                localStorage.setItem('location_background_frames', JSON.stringify(backgroundData.frames));
                
                localStorage.setItem('location_background_meta', JSON.stringify({
                    location,
                    timeWeather,
                    prompt,
                    timestamp: Date.now(),
                    version: 5, // Version 5 = 8 separate frames in array (no spritesheet needed in localStorage)
                    frameCount: backgroundData.frameCount,
                    frameWidth: backgroundData.frameWidth,
                    frameHeight: backgroundData.frameHeight
                }));
                console.log('Background cached successfully (frames array)');
            } catch (storageError) {
                console.warn('Could not cache background image (localStorage probably full):', storageError);
            }
            
            return backgroundData;
        } catch (error) {
            console.error('Error in generateLocationBackground:', error);
            throw error;
        }
    }
}

// Note: APIService is no longer exported to window here.
// It is instantiated in main.ts and will be injected into classes that need it.
// Temporary window.api assignment exists in main.ts for backward compatibility during refactoring.
