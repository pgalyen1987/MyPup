import { CONFIG } from './config.js';
import { ENEMY_CONFIGS, getLevelSpawns } from './EnemyTypes.js';
export class EnemyManager {
    constructor(scene, apiService) {
        this.enemies = [];
        this.currentLevel = 1;
        this.apiService = null;
        this.loadedSprites = new Set();
        this.pendingSprites = new Set();
        this.scene = scene;
        this.apiService = apiService || null;
        this.enemyGroup = scene.physics.add.group();
    }
    setApiService(apiService) {
        this.apiService = apiService;
    }
    async preloadSprites(level, useAI = false) {
        const spawns = getLevelSpawns(level);
        const typesNeeded = [...new Set(spawns.map(s => s.type))];
        console.log(`EnemyManager: Preloading sprites for types: ${typesNeeded.join(', ')}`);
        if (useAI && this.apiService) {
            await this._preloadWithAI(typesNeeded);
        }
        else {
            await this._preloadWithFallbacks(typesNeeded);
        }
    }
    async _preloadWithAI(types) {
        if (!this.apiService) {
            console.warn('No API service available, using fallbacks');
            return this._preloadWithFallbacks(types);
        }
        const typesToGenerate = types.filter(t => !this.loadedSprites.has(t) && !this.pendingSprites.has(t));
        if (typesToGenerate.length === 0)
            return;
        console.log(`🎨 Generating AI sprites for: ${typesToGenerate.join(', ')}`);
        const statusEl = document.getElementById('generation-status');
        try {
            const sprites = await this.apiService.generateAllEnemySprites(typesToGenerate, (current, total, type) => {
                if (statusEl) {
                    statusEl.innerHTML = `<div class="loader"></div> Generating ${type} sprite (${current + 1}/${total})...`;
                    statusEl.style.color = '#ffd700';
                }
            });
            for (const [type, spriteData] of sprites) {
                await this._processGeneratedSprite(type, spriteData);
            }
            if (statusEl) {
                statusEl.innerHTML = '✅ Enemy sprites ready!';
                statusEl.style.color = '#4CAF50';
            }
        }
        catch (error) {
            console.error('AI sprite generation failed, using fallbacks:', error);
            await this._preloadWithFallbacks(typesToGenerate);
        }
    }
    async _processGeneratedSprite(type, base64Data) {
        const config = ENEMY_CONFIGS[type];
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                if (this.scene.textures.exists(config.spriteKey)) {
                    this.scene.textures.remove(config.spriteKey);
                }
                this.scene.textures.addSpriteSheet(config.spriteKey, img, {
                    frameWidth: CONFIG.TILE_SIZE,
                    frameHeight: CONFIG.TILE_SIZE
                });
                this._createAnimations(type);
                this.loadedSprites.add(type);
                this.pendingSprites.delete(type);
                console.log(`✅ Loaded AI-generated ${type} spritesheet`);
                resolve();
            };
            img.onerror = () => {
                console.error(`Failed to load generated ${type} sprite`);
                this._loadFallbackSprite(type).then(resolve);
            };
            img.src = base64Data;
        });
    }
    async _preloadWithFallbacks(types) {
        const loadPromises = types
            .filter(t => !this.loadedSprites.has(t) && !this.pendingSprites.has(t))
            .map(t => this._loadFallbackSprite(t));
        await Promise.all(loadPromises);
    }
    async _loadFallbackSprite(type) {
        const config = ENEMY_CONFIGS[type];
        if (this.scene.textures.exists(config.spriteKey)) {
            this.loadedSprites.add(type);
            return;
        }
        this.pendingSprites.add(type);
        return new Promise((resolve) => {
            if (config.fallbackAsset) {
                const tempKey = `${config.spriteKey}_temp`;
                if (this.scene.textures.exists(tempKey)) {
                    this._processFallbackTexture(type, tempKey);
                    resolve();
                    return;
                }
                this.scene.load.image(tempKey, `${config.fallbackAsset}?v=${Date.now()}`);
                this.scene.load.once('complete', () => {
                    this._processFallbackTexture(type, tempKey);
                    resolve();
                });
                this.scene.load.once('loaderror', () => {
                    console.warn(`Failed to load fallback for ${type}, using placeholder`);
                    this._createPlaceholderSprite(type);
                    resolve();
                });
                this.scene.load.start();
            }
            else {
                this._createPlaceholderSprite(type);
                resolve();
            }
        });
    }
    _processFallbackTexture(type, tempKey) {
        const config = ENEMY_CONFIGS[type];
        if (!this.scene.textures.exists(tempKey))
            return;
        const texture = this.scene.textures.get(tempKey);
        const img = texture.source[0].image;
        if (this.scene.textures.exists(config.spriteKey)) {
            this.scene.textures.remove(config.spriteKey);
        }
        this.scene.textures.addSpriteSheet(config.spriteKey, img, {
            frameWidth: CONFIG.TILE_SIZE,
            frameHeight: CONFIG.TILE_SIZE
        });
        this._createAnimations(type);
        this.loadedSprites.add(type);
        this.pendingSprites.delete(type);
        console.log(`📦 Loaded fallback ${type} spritesheet`);
    }
    _createPlaceholderSprite(type) {
        const config = ENEMY_CONFIGS[type];
        const size = CONFIG.TILE_SIZE;
        const sheetSize = size * 4;
        const colors = {
            cat: 0xFF8C00,
            bird: 0x4169E1,
            squirrel: 0x8B4513,
            mailman: 0x000080,
        };
        const graphics = this.scene.add.graphics();
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 4; col++) {
                const x = col * size;
                const y = row * size;
                graphics.fillStyle(0x00ff00);
                graphics.fillRect(x, y, size, size);
                graphics.fillStyle(colors[type] || 0xFF0000);
                graphics.fillRect(x + 8, y + 8, size - 16, size - 16);
                graphics.fillStyle(0xFFFFFF);
                graphics.fillRect(x + 16, y + 20, 8, 8);
                graphics.fillRect(x + 40, y + 20, 8, 8);
                if (row === 0) {
                    graphics.fillStyle(0x000000);
                    graphics.fillTriangle(x + 50, y + 32, x + 56, y + 38, x + 50, y + 44);
                }
                else if (row === 1) {
                    graphics.fillStyle(0x000000);
                    graphics.fillTriangle(x + 14, y + 32, x + 8, y + 38, x + 14, y + 44);
                }
            }
        }
        graphics.generateTexture(config.spriteKey, sheetSize, sheetSize);
        graphics.destroy();
        const texture = this.scene.textures.get(config.spriteKey);
        if (texture) {
            this.scene.textures.remove(config.spriteKey);
            this.scene.textures.addSpriteSheet(config.spriteKey, texture.source[0].image, {
                frameWidth: size,
                frameHeight: size
            });
        }
        this._createAnimations(type);
        this.loadedSprites.add(type);
        this.pendingSprites.delete(type);
        console.log(`🎨 Created placeholder ${type} spritesheet`);
    }
}
