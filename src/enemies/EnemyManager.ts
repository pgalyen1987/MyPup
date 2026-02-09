/**
 * EnemyManager.ts
 * Manages enemy spawning and AI-generated sprite loading
 */

import { CONFIG } from '../config.js';
import type { APIService } from '../api/api.js';
import { Enemy, EnemyConfig } from './Enemy.js';

declare const Phaser: any;

type PhaserScene = any;
type PhaserSprite = any;
type PhaserGroup = any;
type PhaserCollider = any;

// ============================================================================
// ENEMY CONFIGURATIONS
// ============================================================================

const ENEMY_CONFIGS: Record<string, EnemyConfig> = {
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

// Level configurations
const LEVEL_ENEMIES: Record<number, string[]> = {
    1: ['cat', 'bird'],
    2: ['cat', 'bird', 'squirrel'],
    3: ['cat', 'bird', 'squirrel', 'mailman'],
};

// ============================================================================
// ENEMY MANAGER CLASS
// ============================================================================

export class EnemyManager {
    private scene: PhaserScene;
    private apiService: APIService;
    private enemies: Enemy[] = [];
    private player: PhaserSprite | null = null;
    private platforms: PhaserGroup | null = null;

    // Track loaded textures globally (shared across scene instances)
    private static globalLoadedTextures: Set<string> = new Set();

    // Track colliders for cleanup
    private colliders: PhaserCollider[] = [];

    // Track pending image loads for cancellation
    private pendingLoads: Map<string, { cancelled: boolean }> = new Map();

    // Track created animations for this manager instance
    private createdAnimations: string[] = [];

    // Flag to prevent operations after destruction
    private isDestroyed: boolean = false;

    private callbacks: {
        onEnemyKilled?: (enemy: Enemy, player: PhaserSprite) => void;
        onPlayerHit?: (enemy: Enemy, player: PhaserSprite) => void;
    } = {};

    constructor(scene: PhaserScene, apiService: APIService) {
        this.scene = scene;
        this.apiService = apiService;

        // Listen for scene lifecycle events
        this.scene.events.once('shutdown', this.handleSceneShutdown, this);
        this.scene.events.once('destroy', this.handleSceneDestroy, this);
    }

    // ==================================================================================
    // SCENE LIFECYCLE HANDLERS
    // ==================================================================================

    private handleSceneShutdown(): void {
        console.log('EnemyManager: Scene shutting down, cleaning up...');
        this.cleanup(false); // Don't clear global textures on shutdown (scene restart)
    }

    private handleSceneDestroy(): void {
        console.log('EnemyManager: Scene destroying, full cleanup...');
        this.cleanup(true); // Full cleanup including textures
    }

    private cleanup(clearTextures: boolean): void {
        this.isDestroyed = true;

        // Cancel all pending image loads
        this.pendingLoads.forEach((loadState, type) => {
            loadState.cancelled = true;
            console.log(`Cancelled pending load for ${type}`);
        });
        this.pendingLoads.clear();

        // Destroy all enemies
        this.clearAll();

        // Remove all physics colliders
        this.removeAllColliders();

        // Clear callbacks to prevent stale references
        this.callbacks = {};

        // Optionally clear animations (they're global in Phaser)
        if (clearTextures) {
            this.removeCreatedAnimations();
            EnemyManager.globalLoadedTextures.clear();
        }

        // Clear references
        this.platforms = null;
        this.player = null;

        // Remove event listeners
        if (this.scene && this.scene.events) {
            this.scene.events.off('shutdown', this.handleSceneShutdown, this);
            this.scene.events.off('destroy', this.handleSceneDestroy, this);
        }
    }

    private removeAllColliders(): void {
        for (const collider of this.colliders) {
            if (collider && collider.destroy) {
                collider.destroy();
            }
        }
        this.colliders = [];
    }

    private removeCreatedAnimations(): void {
        for (const animKey of this.createdAnimations) {
            if (this.scene?.anims?.exists(animKey)) {
                this.scene.anims.remove(animKey);
            }
        }
        this.createdAnimations = [];
    }

    // ==================================================================================
    // UTILITY METHODS
    // ==================================================================================

    private isSceneActive(): boolean {
        return (
            !this.isDestroyed &&
            this.scene &&
            this.scene.sys &&
            this.scene.sys.isActive() &&
            !this.scene.sys.isTransitioning()
        );
    }

    // ==================================================================================
    // PUBLIC METHODS
    // ==================================================================================

    public setCallbacks(callbacks: {
        onEnemyKilled?: (enemy: Enemy, player: PhaserSprite) => void;
        onPlayerHit?: (enemy: Enemy, player: PhaserSprite) => void;
    }): void {
        if (this.isDestroyed) return;
        this.callbacks = callbacks;
    }

    public setPlayer(player: PhaserSprite): void {
        if (this.isDestroyed) return;
        this.player = player;
        this.setupPlayerCollisions();
    }

    public setPlatforms(platforms: PhaserGroup): void {
        if (this.isDestroyed) return;
        this.platforms = platforms;
        this.setupPlatformCollisions();
    }

    private setupPlayerCollisions(): void {
        if (!this.player || this.isDestroyed) return;

        for (const enemy of this.enemies) {
            if (enemy.sprite && enemy.isActive()) {
                const collider = this.scene.physics.add.overlap(
                    this.player,
                    enemy.sprite,
                    () => this.handlePlayerEnemyCollision(enemy),
                    undefined,
                    this
                );
                this.colliders.push(collider);
            }
        }
    }

    private setupPlatformCollisions(): void {
        if (!this.platforms || this.isDestroyed) return;

        for (const enemy of this.enemies) {
            if (enemy.sprite && enemy.isActive()) {
                const collider = this.scene.physics.add.collider(enemy.sprite, this.platforms);
                this.colliders.push(collider);
            }
        }
    }

    public async preloadSprites(level: number, waitForAll: boolean = true): Promise<void> {
        if (this.isDestroyed) return;

        const enemyTypes = LEVEL_ENEMIES[level] || LEVEL_ENEMIES[1];
        console.log(`EnemyManager: Loading sprites for types: ${enemyTypes.join(', ')}`);

        const loadPromises: Promise<void>[] = [];

        for (const type of enemyTypes) {
            // Check both global cache and scene texture manager
            const textureExists = this.scene.textures.exists(type);
            const inGlobalCache = EnemyManager.globalLoadedTextures.has(type);

            if (!textureExists) {
                if (inGlobalCache) {
                    // Texture was loaded before but scene doesn't have it
                    // Try to reload from localStorage cache
                    loadPromises.push(this.loadEnemySprite(type));
                } else {
                    // Never loaded, fetch from API
                    loadPromises.push(this.loadEnemySprite(type));
                }
            } else {
                // Texture exists in scene, ensure animations are created
                EnemyManager.globalLoadedTextures.add(type);
                this.createEnemyAnimations(type);
            }
        }

        if (waitForAll && loadPromises.length > 0) {
            try {
                await Promise.all(loadPromises);
            } catch (error) {
                console.error('EnemyManager: Some sprites failed to load:', error);
                // Continue anyway - enemies without sprites won't spawn
            }
        }
    }

    public spawnLevel(level: number): void {
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
            } else {
                console.warn(`Cannot spawn ${spawn.type} - texture not loaded (exists: ${textureExists})`);
            }
        }

        console.log(`EnemyManager: Spawned ${this.enemies.length} enemies for level ${level}`);
    }

    public update(): void {
        if (this.isDestroyed || !this.isSceneActive()) return;

        // Clean up dead enemies from the array periodically
        this.enemies = this.enemies.filter(enemy => {
            if (!enemy.isActive()) {
                // Enemy is dead/destroyed, remove its colliders
                return false;
            }
            return true;
        });

        for (const enemy of this.enemies) {
            try {
                if (enemy.isActive()) {
                    enemy.update(this.player);
                }
            } catch (e) {
                console.warn('Enemy update error:', e);
            }
        }
    }

    public getActiveCount(): number {
        return this.enemies.filter((e) => e.isActive()).length;
    }

    public clearAll(): void {
        // Remove colliders first
        this.removeAllColliders();

        // Then destroy enemies
        for (const enemy of this.enemies) {
            enemy.destroy();
        }
        this.enemies = [];
    }

    public destroy(): void {
        this.cleanup(true);
    }

    // ==================================================================================
    // SPRITE LOADING FROM CACHE
    // ==================================================================================

    private async loadEnemySprite(type: string): Promise<void> {
        if (this.isDestroyed) {
            throw new Error('Manager destroyed during load');
        }

        console.log(`EnemyManager: Loading ${type} sprite...`);

        // Create a cancellation token for this load
        const loadState = { cancelled: false };
        this.pendingLoads.set(type, loadState);

        try {
            // Get from localStorage cache (where api.ts stores them)
            const cacheKey = `enemy_${type}_spritesheet`;
            let spriteData = localStorage.getItem(cacheKey);

            // Check if cancelled after localStorage access
            if (loadState.cancelled) {
                throw new Error('Load cancelled');
            }

            if (!spriteData) {
                // Not in cache - generate it now
                console.log(`${type} not in cache, generating via API...`);
                spriteData = await this.apiService.generateEnemySpriteSheet(type);

                // Check if cancelled after API call
                if (loadState.cancelled) {
                    throw new Error('Load cancelled');
                }
            }

            if (!spriteData || spriteData.length < 1000) {
                throw new Error(`Invalid sprite data for ${type}`);
            }

            // Create Phaser texture from the base64 data
            await this.createTextureFromBase64(type, spriteData, loadState);

            // Only mark as loaded if not cancelled
            if (!loadState.cancelled) {
                EnemyManager.globalLoadedTextures.add(type);
                console.log(`✓ ${type} sprite loaded successfully`);
            }
        } catch (error) {
            if (loadState.cancelled) {
                console.log(`Load cancelled for ${type}`);
            } else {
                console.error(`Failed to load ${type} sprite:`, error);
            }
            throw error;
        } finally {
            this.pendingLoads.delete(type);
        }
    }

    private createTextureFromBase64(
        type: string,
        base64Data: string,
        loadState: { cancelled: boolean }
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            // Check if already cancelled
            if (loadState.cancelled || this.isDestroyed) {
                reject(new Error('Load cancelled'));
                return;
            }

            // Skip if texture already exists
            if (this.scene?.textures?.exists(type)) {
                console.log(`Texture ${type} already exists`);
                this.createEnemyAnimations(type);
                resolve();
                return;
            }

            const img = new Image();

            img.onload = () => {
                // Check if cancelled or scene destroyed during image load
                if (loadState.cancelled || this.isDestroyed || !this.isSceneActive()) {
                    console.log(`Texture creation cancelled for ${type} - scene no longer active`);
                    reject(new Error('Scene no longer active'));
                    return;
                }

                try {
                    // The AI generates a 4x4 grid (16 frames)
                    const frameWidth = Math.floor(img.width / 4);
                    const frameHeight = Math.floor(img.height / 4);

                    if (frameWidth <= 0 || frameHeight <= 0) {
                        reject(new Error(`Invalid frame dimensions for ${type}: ${frameWidth}x${frameHeight}`));
                        return;
                    }

                    console.log(`${type} sprite: ${img.width}x${img.height}, frames: ${frameWidth}x${frameHeight}`);

                    // Double-check scene is still valid
                    if (!this.scene?.textures) {
                        reject(new Error('Scene textures manager not available'));
                        return;
                    }

                    // Add as sprite sheet to Phaser
                    this.scene.textures.addSpriteSheet(type, img, {
                        frameWidth: frameWidth,
                        frameHeight: frameHeight,
                    });

                    // Verify texture was created
                    if (!this.scene.textures.exists(type)) {
                        reject(new Error(`Failed to create texture for ${type}`));
                        return;
                    }

                    // Create animations for this enemy type
                    this.createEnemyAnimations(type);

                    resolve();
                } catch (error) {
                    reject(error);
                }
            };

            img.onerror = () => {
                reject(new Error(`Failed to load image for ${type}`));
            };

            // Ensure proper data URL format
            if (!base64Data.startsWith('data:')) {
                base64Data = `data:image/png;base64,${base64Data}`;
            }

            img.src = base64Data;
        });
    }

    private createEnemyAnimations(type: string): void {
        if (this.isDestroyed || !this.scene?.anims) return;

        const config = ENEMY_CONFIGS[type];
        const frameRate = config?.frameRate || 8;

        // Animation layout based on AI sprite sheet:
        // Row 0 (frames 0-3): Walk Right
        // Row 1 (frames 4-7): Walk Left
        // Row 2 (frames 8-11): Attack
        // Row 3 (frames 12-15): Idle

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
                } catch (e) {
                    console.warn(`Failed to create animation ${anim.key}:`, e);
                }
            }
        }
    }

    // ==================================================================================
    // ENEMY SPAWNING
    // ==================================================================================

    private spawnEnemy(type: string, x: number, y: number, config: EnemyConfig): void {
        if (this.isDestroyed || !this.isSceneActive()) return;

        try {
            const enemy = new Enemy(this.scene, x, y, type, config);

            if (enemy.sprite) {
                this.enemies.push(enemy);

                // Setup collision with platforms/floor
                if (this.platforms) {
                    const platformCollider = this.scene.physics.add.collider(
                        enemy.sprite,
                        this.platforms
                    );
                    this.colliders.push(platformCollider);
                }

                // Setup collision with player if player exists
                if (this.player) {
                    const playerCollider = this.scene.physics.add.overlap(
                        this.player,
                        enemy.sprite,
                        () => this.handlePlayerEnemyCollision(enemy),
                        undefined,
                        this
                    );
                    this.colliders.push(playerCollider);
                }
            } else {
                console.warn(`Enemy ${type} created without sprite`);
            }
        } catch (error) {
            console.error(`Failed to spawn ${type}:`, error);
        }
    }

    private getSpawnPositions(level: number): Array<{ type: string; x: number; y: number }> {
        const TILE = CONFIG.TILE_SIZE;
        const groundY = CONFIG.GAME_HEIGHT - TILE * 1.5;
        const airY = CONFIG.GAME_HEIGHT - TILE * 4;

        const spawns: Record<number, Array<{ type: string; x: number; y: number }>> = {
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

    // ==================================================================================
    // COLLISION HANDLING
    // ==================================================================================

    private handlePlayerEnemyCollision(enemy: Enemy): void {
        if (this.isDestroyed || !this.isSceneActive()) return;
        if (!this.player || !enemy.isActive()) return;

        const playerBody = this.player.body;
        const enemySprite = enemy.sprite;

        if (!playerBody || !enemySprite) return;

        // Check if player is stomping (falling onto enemy from above)
        const playerFalling = playerBody.velocity.y > 0;
        const playerAbove = this.player.y < enemySprite.y - (enemySprite.displayHeight * 0.3);

        if (playerFalling && playerAbove) {
            // Player stomped the enemy
            enemy.takeDamage(1);

            // Bounce the player up
            this.player.setVelocityY(-300);

            if (!enemy.isActive()) {
                this.callbacks.onEnemyKilled?.(enemy, this.player);
            }
        } else {
            // Player got hit by enemy
            if (!this.player.getData('invulnerable')) {
                this.callbacks.onPlayerHit?.(enemy, this.player);
            }
        }
    }
}