import { CONFIG } from '../config.js';
import { Enemy } from './Enemy.js';
const ENEMY_CONFIGS = {
    cat: {
        type: 'cat',
        health: 1,
        speed: 80,
        damage: 1,
        scoreValue: 100,
        behavior: 'patrol',
        frameRate: 8,
    },
    bird: {
        type: 'bird',
        health: 1,
        speed: 120,
        damage: 1,
        scoreValue: 150,
        behavior: 'fly',
        frameRate: 10,
    },
    squirrel: {
        type: 'squirrel',
        health: 1,
        speed: 100,
        damage: 1,
        scoreValue: 125,
        behavior: 'patrol',
        frameRate: 8,
    },
    mailman: {
        type: 'mailman',
        health: 3,
        speed: 60,
        damage: 2,
        scoreValue: 500,
        behavior: 'chase',
        frameRate: 6,
        isBoss: true,
    },
};
const LEVEL_ENEMIES = {
    1: ['cat', 'bird'],
    2: ['cat', 'bird', 'squirrel'],
    3: ['cat', 'bird', 'squirrel', 'mailman'],
};
export class EnemyManager {
    constructor(scene, apiService) {
        this.enemies = [];
        this.player = null;
        this.platforms = null;
        this.colliders = [];
        this.pendingLoads = new Map();
        this.createdAnimations = [];
        this.isDestroyed = false;
        this.callbacks = {};
        this.scene = scene;
        this.apiService = apiService;
        this.scene.events.once('shutdown', this.handleSceneShutdown, this);
        this.scene.events.once('destroy', this.handleSceneDestroy, this);
    }
    handleSceneShutdown() {
        console.log('EnemyManager: Scene shutting down, cleaning up...');
        this.cleanup(false);
    }
    handleSceneDestroy() {
        console.log('EnemyManager: Scene destroying, full cleanup...');
        this.cleanup(true);
    }
    cleanup(clearTextures) {
        this.isDestroyed = true;
        this.pendingLoads.forEach((loadState, type) => {
            loadState.cancelled = true;
            console.log(`Cancelled pending load for ${type}`);
        });
        this.pendingLoads.clear();
        this.clearAll();
        this.removeAllColliders();
        this.callbacks = {};
        if (clearTextures) {
            this.removeCreatedAnimations();
            EnemyManager.globalLoadedTextures.clear();
        }
        this.platforms = null;
        this.player = null;
        if (this.scene && this.scene.events) {
            this.scene.events.off('shutdown', this.handleSceneShutdown, this);
            this.scene.events.off('destroy', this.handleSceneDestroy, this);
        }
    }
    removeAllColliders() {
        for (const collider of this.colliders) {
            if (collider && collider.destroy) {
                collider.destroy();
            }
        }
        this.colliders = [];
    }
    removeCreatedAnimations() {
        for (const animKey of this.createdAnimations) {
            if (this.scene?.anims?.exists(animKey)) {
                this.scene.anims.remove(animKey);
            }
        }
        this.createdAnimations = [];
    }
    isSceneActive() {
        return (!this.isDestroyed &&
            this.scene &&
            this.scene.sys &&
            this.scene.sys.isActive() &&
            !this.scene.sys.isTransitioning());
    }
    setCallbacks(callbacks) {
        if (this.isDestroyed)
            return;
        this.callbacks = callbacks;
    }
    setPlayer(player) {
        if (this.isDestroyed)
            return;
        this.player = player;
        this.setupPlayerCollisions();
    }
    setPlatforms(platforms) {
        if (this.isDestroyed)
            return;
        this.platforms = platforms;
        this.setupPlatformCollisions();
    }
    setupPlayerCollisions() {
        if (!this.player || this.isDestroyed)
            return;
        for (const enemy of this.enemies) {
            if (enemy.sprite && enemy.isActive()) {
                const collider = this.scene.physics.add.overlap(this.player, enemy.sprite, () => this.handlePlayerEnemyCollision(enemy), undefined, this);
                this.colliders.push(collider);
            }
        }
    }
    setupPlatformCollisions() {
        if (!this.platforms || this.isDestroyed)
            return;
        for (const enemy of this.enemies) {
            if (enemy.sprite && enemy.isActive()) {
                const collider = this.scene.physics.add.collider(enemy.sprite, this.platforms);
                this.colliders.push(collider);
            }
        }
    }
    async preloadSprites(level, waitForAll = true) {
        if (this.isDestroyed)
            return;
        const enemyTypes = LEVEL_ENEMIES[level] || LEVEL_ENEMIES[1];
        console.log(`EnemyManager: Loading sprites for types: ${enemyTypes.join(', ')}`);
        const loadPromises = [];
        for (const type of enemyTypes) {
            const textureExists = this.scene.textures.exists(type);
            const inGlobalCache = EnemyManager.globalLoadedTextures.has(type);
            if (!textureExists) {
                if (inGlobalCache) {
                    loadPromises.push(this.loadEnemySprite(type));
                }
                else {
                    loadPromises.push(this.loadEnemySprite(type));
                }
            }
            else {
                EnemyManager.globalLoadedTextures.add(type);
                this.createEnemyAnimations(type);
            }
        }
        if (waitForAll && loadPromises.length > 0) {
            try {
                await Promise.all(loadPromises);
            }
            catch (error) {
                console.error('EnemyManager: Some sprites failed to load:', error);
            }
        }
    }
    spawnLevel(level) {
        if (this.isDestroyed || !this.isSceneActive()) {
            console.warn('EnemyManager: Cannot spawn level - manager or scene not active');
            return;
        }
        this.clearAll();
        const spawnConfigs = this.getSpawnPositions(level);
        for (const spawn of spawnConfigs) {
            const config = ENEMY_CONFIGS[spawn.type];
            const textureExists = this.scene.textures.exists(spawn.type);
            if (config && textureExists) {
                this.spawnEnemy(spawn.type, spawn.x, spawn.y, config);
            }
            else {
                console.warn(`Cannot spawn ${spawn.type} - texture not loaded (exists: ${textureExists})`);
            }
        }
        console.log(`EnemyManager: Spawned ${this.enemies.length} enemies for level ${level}`);
    }
    update() {
        if (this.isDestroyed || !this.isSceneActive())
            return;
        this.enemies = this.enemies.filter(enemy => {
            if (!enemy.isActive()) {
                return false;
            }
            return true;
        });
        for (const enemy of this.enemies) {
            try {
                if (enemy.isActive()) {
                    enemy.update(this.player);
                }
            }
            catch (e) {
                console.warn('Enemy update error:', e);
            }
        }
    }
    getActiveCount() {
        return this.enemies.filter((e) => e.isActive()).length;
    }
    clearAll() {
        this.removeAllColliders();
        for (const enemy of this.enemies) {
            enemy.destroy();
        }
        this.enemies = [];
    }
    destroy() {
        this.cleanup(true);
    }
    async loadEnemySprite(type) {
        if (this.isDestroyed) {
            throw new Error('Manager destroyed during load');
        }
        console.log(`EnemyManager: Loading ${type} sprite...`);
        const loadState = { cancelled: false };
        this.pendingLoads.set(type, loadState);
        try {
            const cacheKey = `enemy_${type}_spritesheet`;
            let spriteData = localStorage.getItem(cacheKey);
            if (loadState.cancelled) {
                throw new Error('Load cancelled');
            }
            if (!spriteData) {
                console.log(`${type} not in cache, generating via API...`);
                spriteData = await this.apiService.generateEnemySpriteSheet(type);
                if (loadState.cancelled) {
                    throw new Error('Load cancelled');
                }
            }
            if (!spriteData || spriteData.length < 1000) {
                throw new Error(`Invalid sprite data for ${type}`);
            }
            await this.createTextureFromBase64(type, spriteData, loadState);
            if (!loadState.cancelled) {
                EnemyManager.globalLoadedTextures.add(type);
                console.log(`✓ ${type} sprite loaded successfully`);
            }
        }
        catch (error) {
            if (loadState.cancelled) {
                console.log(`Load cancelled for ${type}`);
            }
            else {
                console.error(`Failed to load ${type} sprite:`, error);
            }
            throw error;
        }
        finally {
            this.pendingLoads.delete(type);
        }
    }
    createTextureFromBase64(type, base64Data, loadState) {
        return new Promise((resolve, reject) => {
            if (loadState.cancelled || this.isDestroyed) {
                reject(new Error('Load cancelled'));
                return;
            }
            if (this.scene?.textures?.exists(type)) {
                console.log(`Texture ${type} already exists`);
                this.createEnemyAnimations(type);
                resolve();
                return;
            }
            const img = new Image();
            img.onload = () => {
                if (loadState.cancelled || this.isDestroyed || !this.isSceneActive()) {
                    console.log(`Texture creation cancelled for ${type} - scene no longer active`);
                    reject(new Error('Scene no longer active'));
                    return;
                }
                try {
                    const frameWidth = Math.floor(img.width / 4);
                    const frameHeight = Math.floor(img.height / 4);
                    if (frameWidth <= 0 || frameHeight <= 0) {
                        reject(new Error(`Invalid frame dimensions for ${type}: ${frameWidth}x${frameHeight}`));
                        return;
                    }
                    console.log(`${type} sprite: ${img.width}x${img.height}, frames: ${frameWidth}x${frameHeight}`);
                    if (!this.scene?.textures) {
                        reject(new Error('Scene textures manager not available'));
                        return;
                    }
                    this.scene.textures.addSpriteSheet(type, img, {
                        frameWidth: frameWidth,
                        frameHeight: frameHeight,
                    });
                    if (!this.scene.textures.exists(type)) {
                        reject(new Error(`Failed to create texture for ${type}`));
                        return;
                    }
                    this.createEnemyAnimations(type);
                    resolve();
                }
                catch (error) {
                    reject(error);
                }
            };
            img.onerror = () => {
                reject(new Error(`Failed to load image for ${type}`));
            };
            if (!base64Data.startsWith('data:')) {
                base64Data = `data:image/png;base64,${base64Data}`;
            }
            img.src = base64Data;
        });
    }
    createEnemyAnimations(type) {
        if (this.isDestroyed || !this.scene?.anims)
            return;
        const config = ENEMY_CONFIGS[type];
        const frameRate = config?.frameRate || 8;
        const animations = [
            { key: `${type}_walk_right`, start: 0, end: 3 },
            { key: `${type}_walk_left`, start: 4, end: 7 },
            { key: `${type}_attack`, start: 8, end: 11 },
            { key: `${type}_idle`, start: 12, end: 15 },
        ];
        for (const anim of animations) {
            if (!this.scene.anims.exists(anim.key)) {
                try {
                    this.scene.anims.create({
                        key: anim.key,
                        frames: this.scene.anims.generateFrameNumbers(type, {
                            start: anim.start,
                            end: anim.end,
                        }),
                        frameRate: frameRate,
                        repeat: -1,
                    });
                    this.createdAnimations.push(anim.key);
                    console.log(`Created animation: ${anim.key}`);
                }
                catch (e) {
                    console.warn(`Failed to create animation ${anim.key}:`, e);
                }
            }
        }
    }
    spawnEnemy(type, x, y, config) {
        if (this.isDestroyed || !this.isSceneActive())
            return;
        try {
            const enemy = new Enemy(this.scene, x, y, type, config);
            if (enemy.sprite) {
                this.enemies.push(enemy);
                if (this.platforms) {
                    const platformCollider = this.scene.physics.add.collider(enemy.sprite, this.platforms);
                    this.colliders.push(platformCollider);
                }
                if (this.player) {
                    const playerCollider = this.scene.physics.add.overlap(this.player, enemy.sprite, () => this.handlePlayerEnemyCollision(enemy), undefined, this);
                    this.colliders.push(playerCollider);
                }
            }
            else {
                console.warn(`Enemy ${type} created without sprite`);
            }
        }
        catch (error) {
            console.error(`Failed to spawn ${type}:`, error);
        }
    }
    getSpawnPositions(level) {
        const TILE = CONFIG.TILE_SIZE;
        const groundY = CONFIG.GAME_HEIGHT - TILE * 1.5;
        const airY = CONFIG.GAME_HEIGHT - TILE * 4;
        const spawns = {
            1: [
                { type: 'cat', x: 500, y: groundY },
                { type: 'cat', x: 1000, y: groundY },
                { type: 'bird', x: 700, y: airY },
                { type: 'bird', x: 1300, y: airY },
            ],
            2: [
                { type: 'cat', x: 400, y: groundY },
                { type: 'cat', x: 1000, y: groundY },
                { type: 'bird', x: 600, y: airY },
                { type: 'bird', x: 1200, y: airY },
                { type: 'squirrel', x: 800, y: groundY },
                { type: 'squirrel', x: 1500, y: groundY },
            ],
            3: [
                { type: 'cat', x: 350, y: groundY },
                { type: 'cat', x: 1100, y: groundY },
                { type: 'bird', x: 500, y: airY },
                { type: 'bird', x: 1300, y: airY },
                { type: 'squirrel', x: 700, y: groundY },
                { type: 'squirrel', x: 1600, y: groundY },
                { type: 'mailman', x: 2000, y: groundY },
            ],
        };
        return spawns[level] || spawns[1];
    }
    handlePlayerEnemyCollision(enemy) {
        if (this.isDestroyed || !this.isSceneActive())
            return;
        if (!this.player || !enemy.isActive())
            return;
        const playerBody = this.player.body;
        const enemySprite = enemy.sprite;
        if (!playerBody || !enemySprite)
            return;
        const playerFalling = playerBody.velocity.y > 0;
        const playerAbove = this.player.y < enemySprite.y - (enemySprite.displayHeight * 0.3);
        if (playerFalling && playerAbove) {
            enemy.takeDamage(1);
            this.player.setVelocityY(-300);
            if (!enemy.isActive()) {
                this.callbacks.onEnemyKilled?.(enemy, this.player);
            }
        }
        else {
            if (!this.player.getData('invulnerable')) {
                this.callbacks.onPlayerHit?.(enemy, this.player);
            }
        }
    }
}
EnemyManager.globalLoadedTextures = new Set();
