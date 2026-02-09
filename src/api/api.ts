/**
 * api.ts - Main API Service
 * Clean API integration for Gemini 3
 */

import { CONFIG } from '../config.js';
import { ApiError, BackgroundData, ProgressCallback, TimeWeather } from './types.js';
import { ImageUtils } from './image-utils.js';
import { BackgroundRemover } from './background-remover.js';
import { ErrorParser } from './error-parser.js';
import { PromptTemplates } from './prompt-templates.js';
import { LocationWeatherService } from './location-weather-service.js';
import { CacheService } from './cache-service.js';

export class APIService {
    private locationService = new LocationWeatherService();
    private cache = new CacheService();

    // -------------------------------------------------------------------------
    // Configuration Getters
    // -------------------------------------------------------------------------

    private get debugMode(): boolean {
        return CONFIG.DEBUG_MODE;
    }

    private get apiKey(): string {
        if (CONFIG.USE_BACKEND_PROXY) return '';
        return CONFIG.GEMINI_API_KEY || localStorage.getItem('gemini_api_key') || '';
    }

    // -------------------------------------------------------------------------
    // Request Handling
    // -------------------------------------------------------------------------

    private getApiUrl(model: string): string {
        if (CONFIG.USE_BACKEND_PROXY && CONFIG.BACKEND_API_URL) {
            return CONFIG.BACKEND_API_URL;
        }
        const baseUrl = model.includes('image') ? CONFIG.GEMINI_IMAGE_GEN_URL : CONFIG.GEMINI_API_URL;
        const urlWithoutKey = baseUrl.split('?')[0];
        return `${urlWithoutKey}?key=${this.apiKey}`;
    }

    private async makeApiRequest(model: string, requestBody: any, endpoint: string = 'generateContent'): Promise<Response> {
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

    private getModel(forImage: boolean = false): string {
        if (forImage) {
            return this.debugMode ? 'gemini-2.5-flash-image' : 'gemini-3-pro-image-preview';
        }
        return this.debugMode ? 'gemini-2.5-flash' : 'gemini-3-pro-image-preview';
    }

    private async extractImageFromResponse(data: any, context: string): Promise<string> {
        const candidate = data.candidates?.[0];
        if (!candidate) throw new Error(`No candidates returned for ${context}`);

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

    // -------------------------------------------------------------------------
    // Public API Methods
    // -------------------------------------------------------------------------

    async verifyApiKey(): Promise<{ valid: boolean; error?: string }> {
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
        } catch (error: any) {
            return { valid: false, error: error.message || 'Network error' };
        }
    }

    async generateSpriteSheet(dogDescription: string, imageBase64: string): Promise<string> {
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

    async generateEnemySpriteSheet(enemyType: string = 'cat'): Promise<string> {
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

        this.cache.cacheEnemySprite(enemyType, processed);

        console.log(`${enemyType} spritesheet generated successfully`);
        return processed;
    }

    async generateLocationBackground(progressCallback?: ProgressCallback): Promise<BackgroundData> {
        console.log('Generating location-based background...');

        const location = await this.locationService.getUserLocation();
        console.log('Location:', location.city, location.country);

        const timeWeather = await this.locationService.getTimeAndWeather(location);
        console.log('Time/Weather:', timeWeather.timeOfDay, timeWeather.weatherReport.description);

        const descriptionPrompt = PromptTemplates.backgroundPrompt(location, timeWeather);
        const description = await this._generateBackgroundDescription(descriptionPrompt);
        console.log('Background description generated');

        const backgroundData = await this._generateBackgroundFrames(description, timeWeather, progressCallback);

        this.cache.cacheBackground(backgroundData, location, timeWeather, description);

        return backgroundData;
    }

    // -------------------------------------------------------------------------
    // Cache Access Methods
    // -------------------------------------------------------------------------

    getCachedEnemySprite(enemyType: string): string | null {
        return this.cache.getCachedEnemySprite(enemyType);
    }

    getCachedBackground(): { data: BackgroundData; meta: any } | null {
        return this.cache.getCachedBackground();
    }

    clearCache(): void {
        this.cache.clearAllCache();
    }

    getCacheStats(): { backgrounds: boolean; enemies: string[] } {
        return this.cache.getCacheStats();
    }

    // -------------------------------------------------------------------------
    // Utility Methods (for backward compatibility)
    // -------------------------------------------------------------------------

    parseApiError(errorText: string, statusCode: number): ApiError {
        return ErrorParser.parse(errorText, statusCode);
    }

    async resizeImage(base64: string, maxWidth: number, maxHeight: number): Promise<string> {
        return ImageUtils.resizeMax(base64, maxWidth, maxHeight);
    }

    async resizeImageToExactSize(base64: string, width: number, height: number): Promise<string> {
        return ImageUtils.resizeToExact(base64, width, height);
    }

    async validateImageContent(base64: string, frameNumber: number, stage: string): Promise<void> {
        return ImageUtils.validate(base64, frameNumber, stage);
    }

    async removeSolidBackground(base64: string): Promise<string> {
        return BackgroundRemover.remove(base64);
    }

    // -------------------------------------------------------------------------
    // Private Helper Methods
    // -------------------------------------------------------------------------

    private async _analyzeDogImage(imageBase64: string): Promise<string> {
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
            .map((line: string) => line.trim())
            .join('\n')
            .trim();
    }

    private async _generateBackgroundDescription(prompt: string): Promise<string> {
        console.log('Generating background description...');

        const response = await this.makeApiRequest(this.getModel(), {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Background description API error:', errorText);
            throw ErrorParser.parse(errorText, response.status);
        }

        const data = await response.json();

        // Debug logging
        console.log('Background description response:', JSON.stringify(data, null, 2).substring(0, 500));

        const candidate = data.candidates?.[0];

        if (!candidate) {
            console.error('No candidates in response:', data);
            throw new Error('No candidates returned for background description');
        }

        // Check for safety block
        if (candidate.finishReason === 'SAFETY') {
            console.warn('Background description blocked by safety filter, using fallback');
            return 'A realistic SNES-era pixel art landscape with rolling hills, trees, and a clear sky. Real-world natural scenery.';
        }

        // Check for other non-STOP finish reasons
        if (candidate.finishReason && candidate.finishReason !== 'STOP') {
            console.warn(`Unexpected finish reason: ${candidate.finishReason}`);
        }

        const text = candidate.content?.parts?.[0]?.text;

        if (!text) {
            console.error('No text in candidate:', candidate);
            // Return fallback instead of throwing
            console.warn('Using fallback background description');
            return 'A realistic SNES-era pixel art landscape with natural scenery, trees, and sky appropriate for a platformer game.';
        }

        console.log('Background description generated:', text.substring(0, 100) + '...');
        return text.replace(/```/g, '').trim();
    }

    private async _generateBackgroundFrames(
        description: string,
        timeWeather: TimeWeather,
        progressCallback?: ProgressCallback
    ): Promise<BackgroundData> {
        const frameWidth = CONFIG.API.BACKGROUND_FRAME_WIDTH;
        const frameHeight = CONFIG.API.BACKGROUND_FRAME_HEIGHT;
        const totalFrames = CONFIG.API.BACKGROUND_FRAME_COUNT;
        const frames: string[] = [];
        const seed = Math.floor(Math.random() * 1000000);

        console.log(`Generating ${totalFrames} frames at ${frameWidth}x${frameHeight}...`);
        progressCallback?.(0, totalFrames);

        const animationContext = PromptTemplates.animationContext(totalFrames);
        const hasPrecipitation = timeWeather.weatherReport?.hasPrecipitation;
        const precipitationType = timeWeather.weatherReport?.precipitationType || 'rain';

        for (let i = 0; i < totalFrames; i++) {
            const frameNum = i + 1;
            const framePrompt = PromptTemplates.framePrompt(
                animationContext,
                description,
                frameNum,
                totalFrames,
                hasPrecipitation,
                precipitationType
            );

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

    private async _generateSingleFrame(
        prompt: string,
        frameNumber: number,
        referenceFrames: string[],
        seed: number,
        totalFrames: number
    ): Promise<string> {
        const parts: any[] = [{ text: prompt }];

        for (const frame of referenceFrames) {
            if (!frame) continue;
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
}

// -------------------------------------------------------------------------
// Export singleton instance and types
// -------------------------------------------------------------------------

export const apiService = new APIService();

// Re-export types for convenience
export type {
    ApiError,
    BackgroundData,
    ProgressCallback,
    LocationData,
    TimeWeather,
    WeatherReport,
    RGB,
    BackgroundMeta,
    EnemySpriteMeta
} from './types.js';