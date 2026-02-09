import { CONFIG } from './config.js';
const API_CONSTANTS = {
    COLOR: {
        GREEN_MIN_VALUE: 80,
        GREEN_DOMINANT_MULTIPLIER: 1.2,
        BRIGHT_GREEN_MIN: 180,
        BRIGHT_GREEN_MAX_RB: 100,
        PURE_GREEN_MIN: 240,
        PURE_GREEN_MAX_RB: 50,
        BACKGROUND_TOLERANCE: 80,
        BRIGHTNESS_SUM_THRESHOLD: 250,
        VERY_BRIGHT_THRESHOLD: 500,
    },
    VALIDATION: {
        BLACK_PIXEL_THRESHOLD: 10,
        BLACK_PERCENT_WARNING: 95,
        LOW_BRIGHTNESS_WARNING: 5,
        MIN_BASE64_LENGTH: 1000,
    },
    ANIMATION: {
        TOTAL_FRAMES: 8,
        FPS: 2,
    },
    EDGE_SAMPLES: 10,
};
const PromptTemplates = {
    dogAnalysis: `Analyze this dog image and describe its core visual traits for a 16-bit retro sprite artist.

Focus exclusively on:
- Breed/Type and Body Shape
- Primary and Secondary Colors
- Distinctive Markings (spots, patches, ear color)
- Eyes and Expressions
- Any visible accessories (collar, bandana)`,
    enemyDescriptions: {
        cat: `A mischievous orange tabby cat with:
- Bright orange fur with darker tiger stripes
- Green eyes with a sly expression
- Pink nose and inner ears
- White chest/belly patch
- Long fluffy tail held high
- Slightly crouched, sneaky posture
- Small but fierce appearance`,
        bird: `An angry blue jay bird with:
- Vibrant blue feathers on wings and tail
- White and gray chest feathers
- Black collar marking around neck
- Sharp orange beak
- Beady black eyes with angry eyebrows
- Small crest of feathers on head
- Wings spread in flight/attack poses
- Small orange feet (tucked when flying)`,
        squirrel: `A hyperactive brown squirrel with:
- Reddish-brown fur on back
- Cream/white belly fur
- Large bushy tail curled upward
- Big round black eyes
- Small rounded ears
- Tiny pink nose
- Small paws holding pose
- Energetic, bouncy stance
- Cheeks slightly puffed`,
        mailman: `A grumpy mail carrier (human) with:
- Blue postal uniform with shorts
- Light blue button-up shirt
- Dark blue cap with small brim
- Brown leather mail bag/satchel
- White envelope in hand (for throwing)
- Sturdy brown shoes
- Stern/angry facial expression
- Mustache (optional)
- Stocky, intimidating build
- This is the BOSS enemy - make them 1.5x larger than other sprites`,
    },
    spriteSheet: (analysis, tileSize) => {
        const spriteSheetSize = tileSize * 4;
        return `TITLE: 16-bit Retro Dog Spritesheet - EXACT ${spriteSheetSize}x${spriteSheetSize} PIXEL IMAGE (4x4 GRID, 16 FRAMES REQUIRED)

MANDATORY IMAGE SIZE - READ THIS FIRST:
- THE ENTIRE IMAGE MUST BE EXACTLY ${spriteSheetSize} PIXELS WIDE × ${spriteSheetSize} PIXELS TALL.
- DO NOT GENERATE ANY OTHER SIZE.

CHARACTER DESCRIPTION (from image analysis):
${analysis}

STYLE: SNES-era pixel art, vibrant colors, clean outlines, 16-bit aesthetic.

CRITICAL IMAGE REQUIREMENTS:
- EXACT Canvas Size: ${spriteSheetSize}x${spriteSheetSize} pixels - THIS IS MANDATORY.
- EXACT Layout: 4 rows × 4 columns = 16 frames total.
- Each frame cell: EXACTLY ${tileSize}x${tileSize} pixels.

FRAME GRID LAYOUT:
Row 1 (frames 0-3): Walk Right animation
Row 2 (frames 4-7): Walk Left animation
Row 3 (frames 8-11): Jump animation
Row 4 (frames 12-15): Idle animation

ALIGNMENT: Horizontally CENTERED, Vertically at BOTTOM (feet touching bottom edge).

CRITICAL CONSTRAINTS:
- BACKGROUND: Solid lime green (#00ff00) ONLY.
- NO shadows, NO floor, NO grid lines.
- Character must be CONSISTENT across all 16 frames.

OUTPUT: ${spriteSheetSize}×${spriteSheetSize} pixels.`;
    },
    enemySpriteSheet: (enemyType, tileSize) => {
        const spriteSheetSize = tileSize * 4;
        const description = PromptTemplates.enemyDescriptions[enemyType] || `A ${enemyType} enemy character`;
        const isBoss = enemyType === 'mailman';
        return `TITLE: 16-bit Retro ${enemyType.toUpperCase()} Enemy Spritesheet - EXACT ${spriteSheetSize}x${spriteSheetSize} PIXEL IMAGE

MANDATORY IMAGE SIZE:
- THE ENTIRE IMAGE MUST BE EXACTLY ${spriteSheetSize} PIXELS WIDE × ${spriteSheetSize} PIXELS TALL.
- This is a 4x4 grid = 16 frames total, each frame is ${tileSize}x${tileSize} pixels.

CHARACTER DESCRIPTION:
${description}

STYLE: SNES-era 16-bit pixel art with vibrant colors, clean black outlines, subtle dithering.

FRAME LAYOUT (4 rows × 4 columns):
Row 1 (frames 0-3): Walk/Move Right animation
Row 2 (frames 4-7): Walk/Move Left animation (mirror of Row 1)
Row 3 (frames 8-11): Attack animation
Row 4 (frames 12-15): Idle animation

ALIGNMENT REQUIREMENTS:
- Every sprite CENTERED horizontally in its ${tileSize}×${tileSize} cell
- ${enemyType === 'bird' ? 'Birds should be vertically CENTERED (they fly)' : 'Feet at BOTTOM edge of each cell'}
- Character height: ${isBoss ? '90-95%' : '60-75%'} of cell height

CRITICAL CONSTRAINTS:
- BACKGROUND: Solid lime green (#00ff00) ONLY
- NO transparency, NO shadows, NO grid lines
- Character must be IDENTICAL in design across all frames (only pose changes)
- All 16 frames MUST be present

OUTPUT: Exactly ${spriteSheetSize}×${spriteSheetSize} pixels.`;
    },
    animationContext: (totalFrames) => `ANIMATED BACKGROUND GENERATION:
You are generating ${totalFrames} separate images for an animated background.
- Animation plays at 2 fps - motion must be MINIMAL and SUBTLE.
- All frames must maintain visual consistency.
- Major structures must remain STATIC across all frames.
- Frame ${totalFrames} must loop seamlessly back to Frame 1.`,
    backgroundPrompt: (location, timeWeather) => {
        const weatherDesc = timeWeather.weatherReport?.description || 'clear sky';
        return `Describe a beautiful landscape scene for a 16-bit platformer background:

Location: ${location.city}, ${location.region}, ${location.country}
Time: ${timeWeather.timeString} (${timeWeather.timeOfDay})
Season: ${timeWeather.season}
Weather: ${weatherDesc}

Include recognizable landmarks from ${location.city}.
Must tile horizontally seamlessly.
No fantasy elements - real-world features only.
No text or signs.
16-bit SNES pixel art aesthetic.`;
    },
};
const ImageUtils = {
    loadImage(base64) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Image load failed'));
            img.src = base64;
        });
    },
    createCanvas(width, height, img) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx)
            throw new Error('Could not get canvas context');
        if (img)
            ctx.drawImage(img, 0, 0);
        return { canvas, ctx };
    },
    extractBase64Data(dataUrl) {
        if (dataUrl.includes(',')) {
            const parts = dataUrl.split(',');
            const mimeMatch = parts[0].match(/data:([^;]+)/);
            return {
                data: parts[1],
                mimeType: mimeMatch?.[1] || 'image/png'
            };
        }
        return { data: dataUrl, mimeType: 'image/png' };
    },
    async resizeToExact(base64, width, height) {
        const img = await this.loadImage(base64);
        if (img.width === width && img.height === height) {
            return base64;
        }
        const { canvas, ctx } = this.createCanvas(width, height);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, width, height);
        return canvas.toDataURL('image/png', 1.0);
    },
    async resizeMax(base64, maxWidth, maxHeight) {
        const img = await this.loadImage(base64);
        let { width, height } = img;
        if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
        }
        if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
        }
        const { canvas, ctx } = this.createCanvas(width, height);
        ctx.drawImage(img, 0, 0, width, height);
        return canvas.toDataURL('image/png', 0.8);
    },
    async validate(base64, frameNumber, stage) {
        try {
            const img = await this.loadImage(base64);
            const { canvas, ctx } = this.createCanvas(img.width, img.height, img);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            let blackPixels = 0;
            let totalBrightness = 0;
            const totalPixels = canvas.width * canvas.height;
            for (let i = 0; i < imageData.length; i += 4) {
                const r = imageData[i];
                const g = imageData[i + 1];
                const b = imageData[i + 2];
                const a = imageData[i + 3];
                totalBrightness += (r + g + b) / 3;
                if (r < 10 && g < 10 && b < 10 && a > 0)
                    blackPixels++;
            }
            const blackPercent = (blackPixels / totalPixels) * 100;
            const avgBrightness = (totalBrightness / totalPixels / 255) * 100;
            console.log(`API: Frame ${frameNumber} (${stage}) - Black: ${blackPercent.toFixed(1)}%, Brightness: ${avgBrightness.toFixed(1)}%`);
        }
        catch (e) {
            console.warn(`API: Failed to validate frame ${frameNumber}`);
        }
    },
};
const ColorUtils = {
    distance(c1, c2) {
        return Math.sqrt(Math.pow(c1.r - c2.r, 2) +
            Math.pow(c1.g - c2.g, 2) +
            Math.pow(c1.b - c2.b, 2));
    },
    isGreenish(color) {
        const { r, g, b } = color;
        const { COLOR } = API_CONSTANTS;
        const greenDominant = g > COLOR.GREEN_MIN_VALUE &&
            g > r * COLOR.GREEN_DOMINANT_MULTIPLIER &&
            g > b * COLOR.GREEN_DOMINANT_MULTIPLIER;
        const isBrightGreenish = (r + g + b) > COLOR.BRIGHTNESS_SUM_THRESHOLD &&
            g > 100 && g > r && g > b;
        const isVeryBright = (r + g + b) > COLOR.VERY_BRIGHT_THRESHOLD && g > r && g > b;
        return greenDominant || isBrightGreenish || isVeryBright;
    },
    isBackgroundColor(color, target, tolerance = API_CONSTANTS.COLOR.BACKGROUND_TOLERANCE) {
        const dist = this.distance(color, target);
        if (dist <= tolerance)
            return true;
        const { COLOR } = API_CONSTANTS;
        return color.g > COLOR.BRIGHT_GREEN_MIN &&
            color.r < COLOR.BRIGHT_GREEN_MAX_RB &&
            color.b < COLOR.BRIGHT_GREEN_MAX_RB &&
            color.g > color.r * 1.5 &&
            color.g > color.b * 1.5;
    },
    isPureGreen(color) {
        const { COLOR } = API_CONSTANTS;
        return color.g > COLOR.PURE_GREEN_MIN &&
            color.r < COLOR.PURE_GREEN_MAX_RB &&
            color.b < COLOR.PURE_GREEN_MAX_RB;
    },
    sampleEdgePixels(data, width, height) {
        const samples = [];
        const corners = [
            { x: 0, y: 0 },
            { x: width - 1, y: 0 },
            { x: 0, y: height - 1 },
            { x: width - 1, y: height - 1 }
        ];
        for (let i = 0; i < API_CONSTANTS.EDGE_SAMPLES; i++) {
            corners.push({ x: Math.floor((width / API_CONSTANTS.EDGE_SAMPLES) * i), y: 0 }, { x: Math.floor((width / API_CONSTANTS.EDGE_SAMPLES) * i), y: height - 1 }, { x: 0, y: Math.floor((height / API_CONSTANTS.EDGE_SAMPLES) * i) }, { x: width - 1, y: Math.floor((height / API_CONSTANTS.EDGE_SAMPLES) * i) });
        }
        for (const { x, y } of corners) {
            const i = (y * width + x) * 4;
            samples.push({ r: data[i], g: data[i + 1], b: data[i + 2] });
        }
        return samples;
    },
    detectBackgroundColor(samples) {
        const greenSamples = samples.filter(p => this.isGreenish(p));
        if (greenSamples.length === 0) {
            console.warn('No green samples found, using default #00ff00');
            return { r: 0, g: 255, b: 0 };
        }
        const avgR = Math.round(greenSamples.reduce((sum, p) => sum + p.r, 0) / greenSamples.length);
        const avgG = Math.round(greenSamples.reduce((sum, p) => sum + p.g, 0) / greenSamples.length);
        const avgB = Math.round(greenSamples.reduce((sum, p) => sum + p.b, 0) / greenSamples.length);
        console.log(`Detected background: RGB(${avgR}, ${avgG}, ${avgB}) from ${greenSamples.length}/${samples.length} samples`);
        return { r: avgR, g: avgG, b: avgB };
    },
};
const BackgroundRemover = {
    async remove(base64Image) {
        const img = await ImageUtils.loadImage(base64Image);
        const { canvas, ctx } = ImageUtils.createCanvas(img.width, img.height, img);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        const { width, height } = canvas;
        const samples = ColorUtils.sampleEdgePixels(data, width, height);
        const bgColor = ColorUtils.detectBackgroundColor(samples);
        const removedFlood = this._floodFill(data, width, height, bgColor);
        console.log(`Flood fill removed ${removedFlood} pixels`);
        const removedSweep = this._sweepPass(data, width, height, bgColor);
        console.log(`Sweep pass removed ${removedSweep} more pixels`);
        ctx.putImageData(imgData, 0, 0);
        return canvas.toDataURL('image/png');
    },
    _floodFill(data, width, height, bgColor) {
        const visited = new Uint8Array(width * height);
        const stack = [
            { x: 0, y: 0 },
            { x: width - 1, y: 0 },
            { x: 0, y: height - 1 },
            { x: width - 1, y: height - 1 }
        ];
        let removed = 0;
        while (stack.length > 0) {
            const pos = stack.pop();
            const { x, y } = pos;
            if (x < 0 || x >= width || y < 0 || y >= height)
                continue;
            const idx = y * width + x;
            if (visited[idx])
                continue;
            visited[idx] = 1;
            const i = idx * 4;
            const color = { r: data[i], g: data[i + 1], b: data[i + 2] };
            if (ColorUtils.isBackgroundColor(color, bgColor) || ColorUtils.isPureGreen(color)) {
                data[i + 3] = 0;
                removed++;
                stack.push({ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 });
            }
        }
        return removed;
    },
    _sweepPass(data, width, height, bgColor) {
        let removed = 0;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = (y * width + x) * 4;
                if (data[i + 3] === 0)
                    continue;
                const color = { r: data[i], g: data[i + 1], b: data[i + 2] };
                if (ColorUtils.isBackgroundColor(color, bgColor) || ColorUtils.isPureGreen(color)) {
                    data[i + 3] = 0;
                    removed++;
                }
            }
        }
        return removed;
    },
};
const ErrorParser = {
    parse(errorText, statusCode) {
        try {
            const errorData = JSON.parse(errorText);
            if (errorData.error) {
                return this._parseErrorObject(errorData.error, statusCode);
            }
        }
        catch {
        }
        return {
            type: 'UNKNOWN_ERROR',
            message: `API error (${statusCode}): ${errorText.substring(0, 200)}`,
            originalMessage: errorText,
            code: statusCode,
            action: 'check_key'
        };
    },
    _parseErrorObject(error, statusCode) {
        const message = error.message || 'Unknown API error';
        const code = error.code || statusCode;
        const patterns = [
            {
                keywords: ['expired', 'API key expired'],
                type: 'API_KEY_EXPIRED',
                getMessage: () => 'API key error. Check setup.',
                action: 'check_setup'
            },
            {
                keywords: ['invalid', 'API_KEY_INVALID', 'API key not valid'],
                type: 'API_KEY_INVALID',
                getMessage: () => 'Invalid API key.',
                action: 'clear_and_renew'
            },
            {
                keywords: ['quota', 'QUOTA_EXCEEDED', 'exceeded your current quota'],
                type: 'QUOTA_EXCEEDED',
                getMessage: () => 'API quota exceeded.',
                action: 'check_quota'
            },
            {
                keywords: ['not found', 'not supported', 'ListModels', 'is not found', 'not available'],
                type: 'MODEL_NOT_FOUND',
                getMessage: () => 'Model not found. Enable Generative Language API.',
                action: 'enable_api'
            }
        ];
        for (const pattern of patterns) {
            if (pattern.keywords.some(kw => message.includes(kw))) {
                return {
                    type: pattern.type,
                    message: pattern.getMessage(),
                    originalMessage: message,
                    code,
                    action: pattern.action
                };
            }
        }
        return {
            type: 'API_ERROR',
            message,
            originalMessage: message,
            code,
            action: 'check_key'
        };
    },
};
const WeatherCodes = {
    getDescription(code, precipitation) {
        const report = {
            description: 'clear sky',
            hasPrecipitation: precipitation > 0,
            precipitationType: 'none',
            weatherCode: code
        };
        if (code === 0) {
            report.description = 'clear sky';
        }
        else if (code <= 3) {
            report.description = 'partly cloudy';
        }
        else if (code >= 51 && code <= 67) {
            report.description = 'rainy';
            report.precipitationType = 'rain';
            report.hasPrecipitation = true;
        }
        else if (code >= 71 && code <= 77) {
            report.description = 'snowy';
            report.precipitationType = 'snow';
            report.hasPrecipitation = true;
        }
        else if (code >= 80 && code <= 82) {
            report.description = 'rain showers';
            report.precipitationType = 'rain';
            report.hasPrecipitation = true;
        }
        else if (code >= 85 && code <= 86) {
            report.description = 'snow showers';
            report.precipitationType = 'snow';
            report.hasPrecipitation = true;
        }
        else if (code >= 95) {
            report.description = 'stormy';
            report.precipitationType = 'rain';
            report.hasPrecipitation = true;
        }
        else {
            report.description = 'cloudy';
        }
        return report;
    },
};
export class APIService {
    get debugMode() {
        return CONFIG.DEBUG_MODE;
    }
    get apiKey() {
        if (CONFIG.USE_BACKEND_PROXY)
            return '';
        return CONFIG.GEMINI_API_KEY || localStorage.getItem('gemini_api_key') || '';
    }
    getApiUrl(model) {
        if (CONFIG.USE_BACKEND_PROXY && CONFIG.BACKEND_API_URL) {
            return CONFIG.BACKEND_API_URL;
        }
        const baseUrl = model.includes('image') ? CONFIG.GEMINI_IMAGE_GEN_URL : CONFIG.GEMINI_API_URL;
        const urlWithoutKey = baseUrl.split('?')[0];
        return `${urlWithoutKey}?key=${this.apiKey}`;
    }
    async makeApiRequest(model, requestBody, endpoint = 'generateContent') {
        const url = this.getApiUrl(model);
        const body = CONFIG.USE_BACKEND_PROXY && CONFIG.BACKEND_API_URL
            ? { endpoint, model, requestBody }
            : requestBody;
        return fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
    }
    getModel(forImage = false) {
        if (forImage) {
            return this.debugMode ? 'gemini-2.5-flash-image' : 'gemini-3-pro-image-preview';
        }
        return this.debugMode ? 'gemini-2.5-flash' : 'gemini-3-pro-image-preview';
    }
    async extractImageFromResponse(data, context) {
        const candidate = data.candidates?.[0];
        if (!candidate)
            throw new Error(`No candidates returned for ${context}`);
        for (const part of candidate.content.parts) {
            if (part.text) {
                const text = part.text.toLowerCase();
                if (text.includes("i cannot") || text.includes("error") || text.includes("sorry")) {
                    throw new Error(`Model Refusal for ${context}: ${part.text}`);
                }
            }
            if (part.inline_data || part.inlineData) {
                const inline = part.inline_data || part.inlineData;
                if (!inline.data || inline.data.length === 0) {
                    throw new Error(`Empty image data for ${context}`);
                }
                return `data:${inline.mime_type || inline.mimeType};base64,${inline.data}`;
            }
        }
        throw new Error(`No image data found in ${context} response`);
    }
    async verifyApiKey() {
        if (CONFIG.USE_BACKEND_PROXY && !CONFIG.BACKEND_API_URL) {
            return { valid: false, error: 'Backend API URL not configured' };
        }
        if (!CONFIG.USE_BACKEND_PROXY && !this.apiKey) {
            return { valid: false, error: 'No API key provided' };
        }
        try {
            const response = await this.makeApiRequest(this.getModel(), {
                contents: [{ parts: [{ text: 'Say "OK" if you can read this.' }] }],
                generationConfig: { temperature: 0.1, maxOutputTokens: 10 }
            });
            if (!response.ok) {
                const errorText = await response.text();
                return { valid: false, error: ErrorParser.parse(errorText, response.status).message };
            }
            const data = await response.json();
            return data.candidates?.length > 0
                ? { valid: true }
                : { valid: false, error: 'Invalid API response' };
        }
        catch (error) {
            return { valid: false, error: error.message || 'Network error' };
        }
    }
    async generateSpriteSheet(dogDescription, imageBase64) {
        const analysis = await this._analyzeDogImage(imageBase64);
        console.log('Dog analysis:', analysis.substring(0, 200) + '...');
        const spritePrompt = PromptTemplates.spriteSheet(analysis, CONFIG.TILE_SIZE);
        console.log('Generating sprite sheet...');
        const response = await this.makeApiRequest(this.getModel(true), {
            contents: [{ parts: [{ text: spritePrompt }] }],
            generationConfig: { temperature: 0.2, topK: 16, topP: 0.9, maxOutputTokens: 8192 }
        });
        if (!response.ok) {
            throw ErrorParser.parse(await response.text(), response.status);
        }
        const rawBase64 = await this.extractImageFromResponse(await response.json(), 'sprite sheet');
        return BackgroundRemover.remove(rawBase64);
    }
    async generateEnemySpriteSheet(enemyType = 'cat') {
        console.log(`Generating ${enemyType} enemy spritesheet...`);
        const prompt = PromptTemplates.enemySpriteSheet(enemyType, CONFIG.TILE_SIZE);
        const response = await this.makeApiRequest(this.getModel(true), {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.3, topK: 16, topP: 0.9, maxOutputTokens: 8192 }
        });
        if (!response.ok) {
            throw ErrorParser.parse(await response.text(), response.status);
        }
        const rawBase64 = await this.extractImageFromResponse(await response.json(), `${enemyType} sprite`);
        const processed = await BackgroundRemover.remove(rawBase64);
        this._cacheEnemySprite(enemyType, processed);
        console.log(`${enemyType} spritesheet generated successfully`);
        return processed;
    }
    _cacheEnemySprite(enemyType, spriteData) {
        const cacheKey = `enemy_${enemyType}_spritesheet`;
        try {
            const estimatedSize = spriteData.length * 2;
            const maxSize = 1 * 1024 * 1024;
            if (estimatedSize > maxSize) {
                console.warn(`${enemyType} sprite too large to cache: ${(estimatedSize / 1024 / 1024).toFixed(2)}MB`);
                return;
            }
            localStorage.setItem(cacheKey, spriteData);
            localStorage.setItem(`${cacheKey}_meta`, JSON.stringify({
                timestamp: Date.now(),
                type: enemyType,
                version: 1
            }));
            console.log(`✓ Cached ${enemyType} sprite to localStorage`);
        }
        catch (error) {
            console.warn(`Could not cache ${enemyType} sprite:`, error);
        }
    }
    getCachedEnemySprite(enemyType) {
        const cacheKey = `enemy_${enemyType}_spritesheet`;
        return localStorage.getItem(cacheKey);
    }
    async generateLocationBackground(progressCallback) {
        console.log('Generating location-based background...');
        const location = await this._getUserLocation();
        console.log('Location:', location.city, location.country);
        const timeWeather = await this._getTimeAndWeather(location);
        console.log('Time/Weather:', timeWeather.timeOfDay, timeWeather.weatherReport.description);
        const descriptionPrompt = PromptTemplates.backgroundPrompt(location, timeWeather);
        const description = await this._generateBackgroundDescription(descriptionPrompt);
        console.log('Background description generated');
        const backgroundData = await this._generateBackgroundFrames(description, timeWeather, progressCallback);
        this._cacheBackground(backgroundData, location, timeWeather, description);
        return backgroundData;
    }
    parseApiError(errorText, statusCode) {
        return ErrorParser.parse(errorText, statusCode);
    }
    async resizeImage(base64, maxWidth, maxHeight) {
        return ImageUtils.resizeMax(base64, maxWidth, maxHeight);
    }
    async resizeImageToExactSize(base64, width, height) {
        return ImageUtils.resizeToExact(base64, width, height);
    }
    async validateImageContent(base64, frameNumber, stage) {
        return ImageUtils.validate(base64, frameNumber, stage);
    }
    async removeSolidBackground(base64) {
        return BackgroundRemover.remove(base64);
    }
    async _analyzeDogImage(imageBase64) {
        const { data, mimeType } = ImageUtils.extractBase64Data(imageBase64);
        const response = await this.makeApiRequest(this.getModel(), {
            contents: [{
                    parts: [
                        { text: PromptTemplates.dogAnalysis },
                        { inline_data: { mime_type: mimeType, data } }
                    ]
                }],
            generationConfig: { temperature: 0.4, maxOutputTokens: 1024 }
        });
        if (!response.ok) {
            throw ErrorParser.parse(await response.text(), response.status);
        }
        const responseData = await response.json();
        const text = responseData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text?.trim()) {
            throw new Error('Dog image analysis returned empty result');
        }
        return text
            .replace(/```[\s\S]*?```/g, '')
            .replace(/\*\*([^*]+)\*\*/g, '\$1')
            .replace(/\*([^*]+)\*/g, '\$1')
            .replace(/\n{3,}/g, '\n\n')
            .split('\n')
            .map((line) => line.trim())
            .join('\n')
            .trim();
    }
    async _getUserLocation() {
        try {
            const response = await fetch('https://ipapi.co/json/');
            if (!response.ok)
                throw new Error('Failed to get location');
            const data = await response.json();
            return {
                city: data.city || 'Unknown',
                region: data.region || 'Unknown',
                country: data.country_name || 'Unknown',
                latitude: data.latitude,
                longitude: data.longitude,
                timezone: data.timezone || 'UTC'
            };
        }
        catch (error) {
            console.warn('Could not get location, using defaults:', error);
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
    async _getTimeAndWeather(location) {
        const now = new Date();
        const options = { timeZone: location.timezone };
        const hourStr = now.toLocaleString('en-US', { ...options, hour: 'numeric', hour12: false });
        const hour = parseInt(hourStr) || 12;
        const monthStr = now.toLocaleString('en-US', { ...options, month: 'numeric' });
        const month = parseInt(monthStr) || 1;
        let timeOfDay = 'day';
        if (hour >= 5 && hour < 12)
            timeOfDay = 'morning';
        else if (hour >= 12 && hour < 17)
            timeOfDay = 'afternoon';
        else if (hour >= 17 && hour < 20)
            timeOfDay = 'evening';
        else
            timeOfDay = 'night';
        const isNorthern = (location.latitude || 0) >= 0;
        let season;
        if (month >= 12 || month <= 2)
            season = isNorthern ? 'winter' : 'summer';
        else if (month >= 3 && month <= 5)
            season = isNorthern ? 'spring' : 'fall';
        else if (month >= 6 && month <= 8)
            season = isNorthern ? 'summer' : 'winter';
        else
            season = isNorthern ? 'fall' : 'spring';
        let weatherReport = WeatherCodes.getDescription(0, 0);
        if (location.latitude && location.longitude) {
            try {
                const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=weather_code,precipitation&timezone=auto`;
                const response = await fetch(weatherUrl);
                if (response.ok) {
                    const data = await response.json();
                    weatherReport = WeatherCodes.getDescription(data.current.weather_code, data.current.precipitation);
                }
            }
            catch (e) {
                console.warn('Could not fetch weather:', e);
            }
        }
        return {
            timeString: now.toLocaleString('en-US', { ...options, hour: 'numeric', minute: '2-digit', hour12: true }),
            timeOfDay,
            hour,
            season,
            weatherReport
        };
    }
    async _generateBackgroundDescription(prompt) {
        const response = await this.makeApiRequest(this.getModel(), {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
        });
        if (!response.ok) {
            throw ErrorParser.parse(await response.text(), response.status);
        }
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
            if (data.candidates?.[0]?.finishReason === 'SAFETY') {
                return 'A realistic SNES-era pixel art landscape with real-world features.';
            }
            throw new Error('Invalid response for background prompt');
        }
        return text.replace(/```/g, '').trim();
    }
    _buildFramePrompt(animationContext, description, frameNum, totalFrames, hasPrecipitation, precipitationType) {
        const baseRequirements = `
MANDATORY IMAGE SIZE: 1024x1024 pixels exactly.
SEAMLESS HORIZONTAL TILING required.
ANIMATION: ${API_CONSTANTS.ANIMATION.FPS} fps - motion must be MINIMAL.
All landmarks must remain STATIC.
${hasPrecipitation ? `Weather: Show ${precipitationType} falling slowly.` : ''}
OUTPUT SIZE: 1024x1024 pixels.`;
        if (frameNum === 1) {
            return `${animationContext}

A 16-bit retro pixel art landscape for a side-scrolling platformer.
Theme: ${description}
Style: SNES-era pixel art, vibrant colors, dithered shading.
${baseRequirements}
This is the first frame of an ${totalFrames}-frame animation loop.`;
        }
        const progress = ((frameNum - 1) / totalFrames * 100).toFixed(1);
        const loopNote = frameNum === totalFrames
            ? `This is the FINAL frame (${progress}%). It MUST lead perfectly back to Frame 1.`
            : `Frame ${frameNum} of ${totalFrames} (${progress}% through loop). Move clouds slightly further.`;
        return `${animationContext}

Generate frame ${frameNum} of an ${totalFrames}-frame SEAMLESS animation loop.
Two reference images provided: Frame 1 (anchor) and previous frame (continuity).

STABILITY: All landmarks must remain in EXACT same pixel positions as Frame 1.
LOOPING: ${loopNote}
${baseRequirements}`;
    }
    async _generateSingleFrame(prompt, frameNumber, referenceFrames, seed, totalFrames) {
        const parts = [{ text: prompt }];
        for (const frame of referenceFrames) {
            if (!frame)
                continue;
            const { data } = ImageUtils.extractBase64Data(frame);
            parts.push({ inline_data: { mime_type: 'image/png', data } });
        }
        const response = await this.makeApiRequest(this.getModel(true), {
            contents: [{ parts }],
            generationConfig: { temperature: 0.05, topK: 8, topP: 0.8, maxOutputTokens: 8192, seed }
        });
        if (!response.ok) {
            throw ErrorParser.parse(await response.text(), response.status);
        }
        const data = await response.json();
        const base64 = await this.extractImageFromResponse(data, `frame ${frameNumber}`);
        await ImageUtils.validate(base64, frameNumber, 'after generation');
        console.log(`Frame ${frameNumber}/${totalFrames} generated successfully`);
        return base64;
    }
    async _combineFrames(frames, frameWidth, frameHeight) {
        const canvas = document.createElement('canvas');
        canvas.width = frameWidth * frames.length;
        canvas.height = frameHeight;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        for (let i = 0; i < frames.length; i++) {
            const img = await ImageUtils.loadImage(frames[i]);
            ctx.drawImage(img, i * frameWidth, 0, frameWidth, frameHeight);
        }
        console.log(`Combined ${frames.length} frames into ${canvas.width}x${canvas.height} spritesheet`);
        return canvas.toDataURL('image/png');
    }
    async _generateBackgroundFrames(description, timeWeather, progressCallback) {
        const frameWidth = CONFIG.API.BACKGROUND_FRAME_WIDTH;
        const frameHeight = CONFIG.API.BACKGROUND_FRAME_HEIGHT;
        const totalFrames = CONFIG.API.BACKGROUND_FRAME_COUNT;
        const frames = [];
        const seed = Math.floor(Math.random() * 1000000);
        console.log(`Generating ${totalFrames} frames at ${frameWidth}x${frameHeight}...`);
        progressCallback?.(0, totalFrames);
        const animationContext = PromptTemplates.animationContext(totalFrames);
        const hasPrecipitation = timeWeather.weatherReport?.hasPrecipitation;
        const precipitationType = timeWeather.weatherReport?.precipitationType || 'rain';
        for (let i = 0; i < totalFrames; i++) {
            const frameNum = i + 1;
            const framePrompt = this._buildFramePrompt(animationContext, description, frameNum, totalFrames, hasPrecipitation, precipitationType);
            const referenceFrames = frameNum > 1
                ? [frames[0], ...(frameNum > 2 ? [frames[frames.length - 1]] : [])]
                : [];
            console.log(`Generating frame ${frameNum}/${totalFrames}...`);
            const frame = await this._generateSingleFrame(framePrompt, frameNum, referenceFrames, seed, totalFrames);
            const resized = await ImageUtils.resizeToExact(frame, frameWidth, frameHeight);
            frames.push(resized);
            progressCallback?.(frameNum, totalFrames);
        }
        console.log(`Generated ${frames.length} individual frames`);
        return {
            frames,
            frameCount: frames.length,
            frameWidth,
            frameHeight
        };
    }
    _cacheBackground(backgroundData, location, timeWeather, prompt) {
        try {
            localStorage.removeItem('location_background');
            localStorage.removeItem('location_background_frames');
            localStorage.removeItem('location_background_meta');
            const framesJson = JSON.stringify(backgroundData.frames);
            const estimatedSize = framesJson.length * 2;
            const maxSize = 4 * 1024 * 1024;
            if (estimatedSize > maxSize) {
                console.warn(`Background frames too large to cache: ${(estimatedSize / 1024 / 1024).toFixed(2)}MB`);
                localStorage.setItem('location_background_meta', JSON.stringify({
                    location,
                    timeWeather,
                    prompt,
                    timestamp: Date.now(),
                    version: 5,
                    frameCount: backgroundData.frameCount,
                    frameWidth: backgroundData.frameWidth,
                    frameHeight: backgroundData.frameHeight,
                    cached: false
                }));
                return;
            }
            localStorage.setItem('location_background_frames', framesJson);
            localStorage.setItem('location_background_meta', JSON.stringify({
                location,
                timeWeather,
                prompt,
                timestamp: Date.now(),
                version: 5,
                frameCount: backgroundData.frameCount,
                frameWidth: backgroundData.frameWidth,
                frameHeight: backgroundData.frameHeight,
                cached: true
            }));
            console.log('Background cached successfully');
        }
        catch (error) {
            console.warn('Could not cache background:', error);
            try {
                localStorage.setItem('location_background_meta', JSON.stringify({
                    timestamp: Date.now(),
                    version: 5,
                    cached: false
                }));
            }
            catch (e) {
            }
        }
    }
}
