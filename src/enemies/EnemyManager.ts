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
    private loadedTextures: Set<string> = new Set();

    private callbacks: {
        onEnemyKilled?: (enemy: Enemy, player: PhaserSprite) => void;
        onPlayerHit?: (enemy: Enemy, player: PhaserSprite) => void;
    } = {};

    constructor(scene: PhaserScene, apiService: APIService) {
        this.scene = scene;
        this.apiService = apiService;
    }

    // ==================================================================================
    // PUBLIC METHODS
    // ==================================================================================

    public setCallbacks(callbacks: {
        onEnemyKilled?: (enemy: Enemy, player: PhaserSprite) => void;
        onPlayerHit?: (enemy: Enemy, player: PhaserSprite) => void;
    }): void {
        this.callbacks = callbacks;
    }

    public setPlayer(player: PhaserSprite): void {
        this.player = player;
        this.setupCollisions();
    }

    private setupCollisions(): void {
        if (!this.player) return;

        for (const enemy of this.enemies) {
            if (enemy.sprite) {
                this.scene.physics.add.overlap(
                    this.player,
                    enemy.sprite,
                    () => this.handlePlayerEnemyCollision(enemy),
                    undefined,
                    this
                );
            }
        }
    }

    public async preloadSprites(level: number, waitForAll: boolean = true): Promise<void> {
        const enemyTypes = LEVEL_ENEMIES[level] || LEVEL_ENEMIES[1];
        console.log(`EnemyManager: Loading sprites for types: ${enemyTypes.join(', ')}`);

        const loadPromises: Promise<void>[] = [];

        for (const type of enemyTypes) {
            if (!this.loadedTextures.has(type) && !this.scene.textures.exists(type)) {
                loadPromises.push(this.loadEnemySprite(type));
            } else {
                this.loadedTextures.add(type);
            }
        }

        if (waitForAll && loadPromises.length > 0) {
            await Promise.all(loadPromises);
        }
    }

    public spawnLevel(level: number): void {
        this.clearAll();

        const spawnConfigs = this.getSpawnPositions(level);

        for (const spawn of spawnConfigs) {
            const config = ENEMY_CONFIGS[spawn.type];

            if (config && this.loadedTextures.has(spawn.type)) {
                this.spawnEnemy(spawn.type, spawn.x, spawn.y, config);
            } else {
                console.warn(`Cannot spawn ${spawn.type} - texture not loaded`);
            }
        }

        console.log(`EnemyManager: Spawned ${this.enemies.length} enemies for level ${level}`);
    }

    public update(): void {
        for (const enemy of this.enemies) {
            try {
                if (enemy.isActive()) {
                    enemy.update(this.player);
                }
            } catch (e) {
                // Silently handle individual enemy update errors
            }
        }
    }

    public getActiveCount(): number {
        return this.enemies.filter((e) => e.isActive()).length;
    }

    public clearAll(): void {
        for (const enemy of this.enemies) {
            enemy.destroy();
        }
        this.enemies = [];
    }

    public destroy(): void {
        this.clearAll();
        this.loadedTextures.clear();
    }

    // ==================================================================================
    // SPRITE LOADING FROM CACHE
    // ==================================================================================

    private async loadEnemySprite(type: string): Promise<void> {
        console.log(`EnemyManager: Loading ${type} sprite...`);

        try {
            // Get from localStorage cache (where api.ts stores them)
            const cacheKey = `enemy_${type}_spritesheet`;
            let spriteData = localStorage.getItem(cacheKey);

            if (!spriteData) {
                // Not in cache - generate it now
                console.log(`${type} not in cache, generating via API...`);
                spriteData = await this.apiService.generateEnemySpriteSheet(type);
            }

            if (!spriteData || spriteData.length < 1000) {
                throw new Error(`Invalid sprite data for ${type}`);
            }

            // Create Phaser texture from the base64 data
            await this.createTextureFromBase64(type, spriteData);

            this.loadedTextures.add(type);
            console.log(`✓ ${type} sprite loaded successfully`);

        } catch (error) {
            console.error(`Failed to load ${type} sprite:`, error);
            throw error;
        }
    }

    private createTextureFromBase64(type: string, base64Data: string): Promise<void> {
        return new Promise((resolve, reject) => {
            // Skip if texture already exists
            if (this.scene.textures.exists(type)) {
                console.log(`Texture ${type} already exists`);
                resolve();
                return;
            }

            const img = new Image();

            img.onload = () => {
                try {
                    // The AI generates a 4x4 grid (16 frames)
                    const frameWidth = Math.floor(img.width / 4);
                    const frameHeight = Math.floor(img.height / 4);

                    if (frameWidth <= 0 || frameHeight <= 0) {
                        reject(new Error(`Invalid frame dimensions for ${type}: ${frameWidth}x${frameHeight}`));
                        return;
                    }

                    console.log(`${type} sprite: ${img.width}x${img.height}, frames: ${frameWidth}x${frameHeight}`);

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
        try {
            const enemy = new Enemy(this.scene, x, y, type, config);

            if (enemy.sprite) {
                this.enemies.push(enemy);

                // Setup collision with player if player exists
                if (this.player) {
                    this.scene.physics.add.overlap(
                        this.player,
                        enemy.sprite,
                        () => this.handlePlayerEnemyCollision(enemy),
                        undefined,
                        this
                    );
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