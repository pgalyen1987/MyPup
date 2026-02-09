import { API_CONSTANTS } from './constants.js';
import { ImageUtils } from './image-utils.js';
export class CacheService {
    constructor() {
        this.KEYS = {
            BACKGROUND_FRAMES: 'location_background_frames',
            BACKGROUND_META: 'location_background_meta',
            ENEMY_PREFIX: 'enemy_',
            ENEMY_SUFFIX: '_spritesheet',
            META_SUFFIX: '_meta',
        };
    }
    async cacheBackground(backgroundData, location, timeWeather, prompt) {
        try {
            this._clearOldBackgroundCache();
            console.log('Compressing background frames for cache...');
            const compressedFrames = [];
            for (const frame of backgroundData.frames) {
                const compressed = await ImageUtils.compressBackgroundForCache(frame);
                compressedFrames.push(compressed);
            }
            const framesJson = JSON.stringify(compressedFrames);
            const estimatedSize = framesJson.length * 2;
            console.log(`Compressed background size: ${ImageUtils.formatBytes(estimatedSize)}`);
            if (estimatedSize > API_CONSTANTS.CACHE.MAX_SIZE) {
                console.warn(`Background still too large after compression: ${ImageUtils.formatBytes(estimatedSize)}`);
                this._saveBackgroundMeta(location, timeWeather, prompt, backgroundData, false);
                return false;
            }
            localStorage.setItem(this.KEYS.BACKGROUND_FRAMES, framesJson);
            this._saveBackgroundMeta(location, timeWeather, prompt, backgroundData, true);
            console.log('✓ Background cached successfully');
            return true;
        }
        catch (error) {
            console.warn('Could not cache background:', error);
            this._saveBackgroundMeta(null, null, null, null, false);
            return false;
        }
    }
    getCachedBackground() {
        try {
            const metaJson = localStorage.getItem(this.KEYS.BACKGROUND_META);
            if (!metaJson)
                return null;
            const meta = JSON.parse(metaJson);
            if (!meta.cached)
                return null;
            const framesJson = localStorage.getItem(this.KEYS.BACKGROUND_FRAMES);
            if (!framesJson)
                return null;
            const frames = JSON.parse(framesJson);
            return {
                data: {
                    frames,
                    frameCount: meta.frameCount || frames.length,
                    frameWidth: meta.frameWidth || 512,
                    frameHeight: meta.frameHeight || 512,
                },
                meta
            };
        }
        catch (error) {
            console.warn('Could not read cached background:', error);
            return null;
        }
    }
    _clearOldBackgroundCache() {
        localStorage.removeItem('location_background');
        localStorage.removeItem(this.KEYS.BACKGROUND_FRAMES);
        localStorage.removeItem(this.KEYS.BACKGROUND_META);
    }
    _saveBackgroundMeta(location, timeWeather, prompt, backgroundData, cached) {
        try {
            const meta = {
                timestamp: Date.now(),
                version: API_CONSTANTS.CACHE.VERSION,
                cached,
            };
            if (location)
                meta.location = location;
            if (timeWeather)
                meta.timeWeather = timeWeather;
            if (prompt)
                meta.prompt = prompt;
            if (backgroundData) {
                meta.frameCount = backgroundData.frameCount;
                meta.frameWidth = backgroundData.frameWidth;
                meta.frameHeight = backgroundData.frameHeight;
            }
            localStorage.setItem(this.KEYS.BACKGROUND_META, JSON.stringify(meta));
        }
        catch (e) {
        }
    }
    async cacheEnemySprite(enemyType, spriteData) {
        const cacheKey = this._getEnemyCacheKey(enemyType);
        try {
            const estimatedSize = spriteData.length * 2;
            console.log(`${enemyType} sprite size before cache: ${ImageUtils.formatBytes(estimatedSize)}`);
            let dataToStore = spriteData;
            if (estimatedSize > API_CONSTANTS.CACHE.MAX_SPRITE_SIZE) {
                console.log(`Compressing ${enemyType} sprite for cache...`);
                dataToStore = await ImageUtils.compressSpriteForCache(spriteData);
                console.log(`Compressed ${enemyType} sprite size: ${ImageUtils.formatBytes(dataToStore.length * 2)}`);
            }
            if (dataToStore.length * 2 > API_CONSTANTS.CACHE.MAX_SPRITE_SIZE) {
                console.warn(`${enemyType} sprite still too large after compression`);
                return false;
            }
            localStorage.setItem(cacheKey, dataToStore);
            localStorage.setItem(`${cacheKey}${this.KEYS.META_SUFFIX}`, JSON.stringify({
                timestamp: Date.now(),
                type: enemyType,
                version: 1,
            }));
            console.log(`✓ Cached ${enemyType} sprite to localStorage`);
            return true;
        }
        catch (error) {
            console.warn(`Could not cache ${enemyType} sprite:`, error);
            return false;
        }
    }
    getCachedEnemySprite(enemyType) {
        const cacheKey = this._getEnemyCacheKey(enemyType);
        return localStorage.getItem(cacheKey);
    }
    getEnemySpriteMeta(enemyType) {
        const cacheKey = this._getEnemyCacheKey(enemyType);
        const metaJson = localStorage.getItem(`${cacheKey}${this.KEYS.META_SUFFIX}`);
        if (!metaJson)
            return null;
        try {
            return JSON.parse(metaJson);
        }
        catch {
            return null;
        }
    }
    _getEnemyCacheKey(enemyType) {
        return `${this.KEYS.ENEMY_PREFIX}${enemyType}${this.KEYS.ENEMY_SUFFIX}`;
    }
    clearAllCache() {
        this._clearOldBackgroundCache();
        const enemyTypes = ['cat', 'bird', 'squirrel', 'mailman'];
        for (const type of enemyTypes) {
            const key = this._getEnemyCacheKey(type);
            localStorage.removeItem(key);
            localStorage.removeItem(`${key}${this.KEYS.META_SUFFIX}`);
        }
        console.log('All API cache cleared');
    }
    getCacheStats() {
        const backgroundCached = !!localStorage.getItem(this.KEYS.BACKGROUND_FRAMES);
        const enemyTypes = ['cat', 'bird', 'squirrel', 'mailman'];
        const cachedEnemies = enemyTypes.filter(type => !!this.getCachedEnemySprite(type));
        return {
            backgrounds: backgroundCached,
            enemies: cachedEnemies
        };
    }
}
