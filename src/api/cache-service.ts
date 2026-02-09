/**
 * cache-service.ts - Local storage caching for sprites and backgrounds
 */

import { BackgroundData, BackgroundMeta, EnemySpriteMeta, LocationData, TimeWeather } from './types.js';
import { API_CONSTANTS } from './constants.js';

export class CacheService {
    private readonly KEYS = {
        BACKGROUND_FRAMES: 'location_background_frames',
        BACKGROUND_META: 'location_background_meta',
        ENEMY_PREFIX: 'enemy_',
        ENEMY_SUFFIX: '_spritesheet',
        META_SUFFIX: '_meta',
    };

    // -------------------------------------------------------------------------
    // Background Caching
    // -------------------------------------------------------------------------

    cacheBackground(
        backgroundData: BackgroundData,
        location: LocationData,
        timeWeather: TimeWeather,
        prompt: string
    ): boolean {
        try {
            this._clearOldBackgroundCache();

            const framesJson = JSON.stringify(backgroundData.frames);
            const estimatedSize = framesJson.length * 2;

            if (estimatedSize > API_CONSTANTS.CACHE.MAX_SIZE) {
                console.warn(`Background frames too large to cache: ${(estimatedSize / 1024 / 1024).toFixed(2)}MB`);
                this._saveBackgroundMeta(location, timeWeather, prompt, backgroundData, false);
                return false;
            }

            localStorage.setItem(this.KEYS.BACKGROUND_FRAMES, framesJson);
            this._saveBackgroundMeta(location, timeWeather, prompt, backgroundData, true);
            console.log('Background cached successfully');
            return true;
        } catch (error) {
            console.warn('Could not cache background:', error);
            this._saveBackgroundMeta(null, null, null, null, false);
            return false;
        }
    }

    getCachedBackground(): { data: BackgroundData; meta: BackgroundMeta } | null {
        try {
            const metaJson = localStorage.getItem(this.KEYS.BACKGROUND_META);
            if (!metaJson) return null;

            const meta: BackgroundMeta = JSON.parse(metaJson);
            if (!meta.cached) return null;

            const framesJson = localStorage.getItem(this.KEYS.BACKGROUND_FRAMES);
            if (!framesJson) return null;

            const frames: string[] = JSON.parse(framesJson);

            return {
                data: {
                    frames,
                    frameCount: meta.frameCount || frames.length,
                    frameWidth: meta.frameWidth || 1024,
                    frameHeight: meta.frameHeight || 1024,
                },
                meta
            };
        } catch (error) {
            console.warn('Could not read cached background:', error);
            return null;
        }
    }

    private _clearOldBackgroundCache(): void {
        localStorage.removeItem('location_background');
        localStorage.removeItem(this.KEYS.BACKGROUND_FRAMES);
        localStorage.removeItem(this.KEYS.BACKGROUND_META);
    }

    private _saveBackgroundMeta(
        location: LocationData | null,
        timeWeather: TimeWeather | null,
        prompt: string | null,
        backgroundData: BackgroundData | null,
        cached: boolean
    ): void {
        try {
            const meta: BackgroundMeta = {
                timestamp: Date.now(),
                version: API_CONSTANTS.CACHE.VERSION,
                cached,
            };

            if (location) meta.location = location;
            if (timeWeather) meta.timeWeather = timeWeather;
            if (prompt) meta.prompt = prompt;
            if (backgroundData) {
                meta.frameCount = backgroundData.frameCount;
                meta.frameWidth = backgroundData.frameWidth;
                meta.frameHeight = backgroundData.frameHeight;
            }

            localStorage.setItem(this.KEYS.BACKGROUND_META, JSON.stringify(meta));
        } catch (e) {
            // Ignore meta save errors
        }
    }

    // -------------------------------------------------------------------------
    // Enemy Sprite Caching
    // -------------------------------------------------------------------------

    cacheEnemySprite(enemyType: string, spriteData: string): boolean {
        const cacheKey = this._getEnemyCacheKey(enemyType);

        try {
            const estimatedSize = spriteData.length * 2;

            if (estimatedSize > API_CONSTANTS.CACHE.MAX_SPRITE_SIZE) {
                console.warn(`${enemyType} sprite too large to cache: ${(estimatedSize / 1024 / 1024).toFixed(2)}MB`);
                return false;
            }

            localStorage.setItem(cacheKey, spriteData);
            localStorage.setItem(`${cacheKey}${this.KEYS.META_SUFFIX}`, JSON.stringify({
                timestamp: Date.now(),
                type: enemyType,
                version: 1
            } as EnemySpriteMeta));

            console.log(`✓ Cached ${enemyType} sprite to localStorage`);
            return true;
        } catch (error) {
            console.warn(`Could not cache ${enemyType} sprite:`, error);
            return false;
        }
    }

    getCachedEnemySprite(enemyType: string): string | null {
        const cacheKey = this._getEnemyCacheKey(enemyType);
        return localStorage.getItem(cacheKey);
    }

    getEnemySpriteMeta(enemyType: string): EnemySpriteMeta | null {
        const cacheKey = this._getEnemyCacheKey(enemyType);
        const metaJson = localStorage.getItem(`${cacheKey}${this.KEYS.META_SUFFIX}`);
        if (!metaJson) return null;

        try {
            return JSON.parse(metaJson);
        } catch {
            return null;
        }
    }

    private _getEnemyCacheKey(enemyType: string): string {
        return `${this.KEYS.ENEMY_PREFIX}${enemyType}${this.KEYS.ENEMY_SUFFIX}`;
    }

    // -------------------------------------------------------------------------
    // General Cache Management
    // -------------------------------------------------------------------------

    clearAllCache(): void {
        this._clearOldBackgroundCache();

        const enemyTypes = ['cat', 'bird', 'squirrel', 'mailman'];
        for (const type of enemyTypes) {
            const key = this._getEnemyCacheKey(type);
            localStorage.removeItem(key);
            localStorage.removeItem(`${key}${this.KEYS.META_SUFFIX}`);
        }

        console.log('All API cache cleared');
    }

    getCacheStats(): { backgrounds: boolean; enemies: string[] } {
        const backgroundCached = !!localStorage.getItem(this.KEYS.BACKGROUND_FRAMES);

        const enemyTypes = ['cat', 'bird', 'squirrel', 'mailman'];
        const cachedEnemies = enemyTypes.filter(type => !!this.getCachedEnemySprite(type));

        return {
            backgrounds: backgroundCached,
            enemies: cachedEnemies
        };
    }
}