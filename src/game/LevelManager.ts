/**
 * game/LevelManager.ts
 * Manages level creation, platforms, and collectibles
 */

import { CONFIG } from '../config.js';
import { PhaserScene, PhaserSprite, PhaserGroup, PlatformConfig, CollectibleConfig } from './types.js';

// Type for Phaser collider
type PhaserCollider = any;

export class LevelManager {
    private scene: PhaserScene;
    private platforms: PhaserGroup | null = null;
    private collectibles: PhaserGroup | null = null;
    private floor: any | null = null;

    // Track colliders for cleanup
    private playerPlatformCollider: PhaserCollider | null = null;
    private playerCollectibleCollider: PhaserCollider | null = null;

    // Track if destroyed
    private isDestroyed: boolean = false;

    constructor(scene: PhaserScene) {
        this.scene = scene;

        // Listen for scene shutdown
        this.scene.events?.once('shutdown', this.onSceneShutdown, this);
        this.scene.events?.once('destroy', this.onSceneShutdown, this);
    }

    // ==================================================================================
    // SCENE LIFECYCLE
    // ==================================================================================

    private onSceneShutdown(): void {
        this.destroy();
    }

    private isSceneActive(): boolean {
        return (
            !this.isDestroyed &&
            this.scene &&
            this.scene.sys &&
            this.scene.sys.isActive()
        );
    }

    // ==================================================================================
    // LEVEL CREATION
    // ==================================================================================

    public createLevel(level: number): void {
        if (this.isDestroyed || !this.isSceneActive()) {
            console.warn('LevelManager: Cannot create level - manager or scene not active');
            return;
        }

        console.log(`LevelManager: Creating level ${level}...`);

        // Clear previous level content (but not colliders - those are managed separately)
        this.clearLevelContent();

        // Create new groups
        this.platforms = this.scene.physics.add.staticGroup();
        this.collectibles = this.scene.physics.add.group();

        // Build level
        this.createFloor();
        this.createPlatforms(level);
        this.createCollectibles(level);

        console.log(`LevelManager: Level ${level} created with ${this.getActiveCollectibleCount()} collectibles`);
    }

    private createFloor(): void {
        if (!this.isSceneActive()) return;

        const worldWidth = CONFIG.GAME_WIDTH * 3;
        const floorY = CONFIG.GAME_HEIGHT - (CONFIG.TILE_SIZE / 2);
        const floorHeight = CONFIG.TILE_SIZE;

        // Create an invisible floor - just a physics body, no visual
        this.floor = this.scene.add.zone(
            worldWidth / 2,
            floorY,
            worldWidth,
            floorHeight
        );

        // Add physics to the zone
        this.scene.physics.add.existing(this.floor, true); // true = static body

        // Set the physics body size
        if (this.floor.body) {
            this.floor.body.setSize(worldWidth, floorHeight);
        }

        // Add to platforms group for collision detection
        this.platforms?.add(this.floor);
    }

    private createPlatforms(level: number): void {
        if (!this.isSceneActive() || !this.platforms) return;

        const TILE = CONFIG.TILE_SIZE;

        const platformConfigs: Record<number, PlatformConfig[]> = {
            1: [
                { x: 300, y: CONFIG.GAME_HEIGHT - TILE * 3, width: 4 },
                { x: 600, y: CONFIG.GAME_HEIGHT - TILE * 5, width: 3 },
                { x: 1000, y: CONFIG.GAME_HEIGHT - TILE * 4, width: 5 },
                { x: 1400, y: CONFIG.GAME_HEIGHT - TILE * 6, width: 3 },
                { x: 1800, y: CONFIG.GAME_HEIGHT - TILE * 3, width: 4 },
            ],
            2: [
                { x: 250, y: CONFIG.GAME_HEIGHT - TILE * 4, width: 3 },
                { x: 500, y: CONFIG.GAME_HEIGHT - TILE * 6, width: 2 },
                { x: 750, y: CONFIG.GAME_HEIGHT - TILE * 4, width: 3 },
                { x: 1000, y: CONFIG.GAME_HEIGHT - TILE * 7, width: 4 },
                { x: 1300, y: CONFIG.GAME_HEIGHT - TILE * 5, width: 2 },
                { x: 1600, y: CONFIG.GAME_HEIGHT - TILE * 4, width: 3 },
                { x: 1900, y: CONFIG.GAME_HEIGHT - TILE * 6, width: 4 },
            ],
            3: [
                { x: 200, y: CONFIG.GAME_HEIGHT - TILE * 3, width: 2 },
                { x: 400, y: CONFIG.GAME_HEIGHT - TILE * 5, width: 2 },
                { x: 600, y: CONFIG.GAME_HEIGHT - TILE * 7, width: 2 },
                { x: 850, y: CONFIG.GAME_HEIGHT - TILE * 5, width: 3 },
                { x: 1100, y: CONFIG.GAME_HEIGHT - TILE * 3, width: 2 },
                { x: 1350, y: CONFIG.GAME_HEIGHT - TILE * 6, width: 2 },
                { x: 1600, y: CONFIG.GAME_HEIGHT - TILE * 4, width: 3 },
                { x: 2100, y: CONFIG.GAME_HEIGHT - TILE * 4, width: 5 },
            ],
        };

        const configs = platformConfigs[level] || platformConfigs[1];

        for (const plat of configs) {
            const width = plat.width * TILE;
            const height = TILE / 2;

            const platform = this.scene.add.rectangle(
                plat.x,
                plat.y,
                width,
                height,
                CONFIG.VISUAL?.PLATFORM_COLOR || 0x8B4513
            );
            platform.setOrigin(0.5, 0.5);
            platform.setDepth((CONFIG.VISUAL?.DEPTH_TILES || 0) + 1);
            this.scene.physics.add.existing(platform, true);

            if (platform.body) {
                platform.body.setSize(width, height);
            }

            this.platforms.add(platform);
        }
    }

    private createCollectibles(level: number): void {
        if (!this.isSceneActive() || !this.collectibles) return;

        this.createCollectibleTexture();

        const collectibleConfigs: Record<number, CollectibleConfig[]> = {
            1: [
                { x: 300, y: CONFIG.GAME_HEIGHT - CONFIG.TILE_SIZE * 4 },
                { x: 600, y: CONFIG.GAME_HEIGHT - CONFIG.TILE_SIZE * 6 },
                { x: 1000, y: CONFIG.GAME_HEIGHT - CONFIG.TILE_SIZE * 5 },
                { x: 1400, y: CONFIG.GAME_HEIGHT - CONFIG.TILE_SIZE * 7 },
                { x: 1800, y: CONFIG.GAME_HEIGHT - CONFIG.TILE_SIZE * 4 },
            ],
            2: [
                { x: 250, y: CONFIG.GAME_HEIGHT - CONFIG.TILE_SIZE * 5 },
                { x: 500, y: CONFIG.GAME_HEIGHT - CONFIG.TILE_SIZE * 7 },
                { x: 750, y: CONFIG.GAME_HEIGHT - CONFIG.TILE_SIZE * 5 },
                { x: 1000, y: CONFIG.GAME_HEIGHT - CONFIG.TILE_SIZE * 8 },
                { x: 1300, y: CONFIG.GAME_HEIGHT - CONFIG.TILE_SIZE * 6 },
                { x: 1600, y: CONFIG.GAME_HEIGHT - CONFIG.TILE_SIZE * 5 },
            ],
            3: [
                { x: 200, y: CONFIG.GAME_HEIGHT - CONFIG.TILE_SIZE * 4 },
                { x: 400, y: CONFIG.GAME_HEIGHT - CONFIG.TILE_SIZE * 6 },
                { x: 600, y: CONFIG.GAME_HEIGHT - CONFIG.TILE_SIZE * 8 },
                { x: 850, y: CONFIG.GAME_HEIGHT - CONFIG.TILE_SIZE * 6 },
                { x: 1100, y: CONFIG.GAME_HEIGHT - CONFIG.TILE_SIZE * 4 },
                { x: 1600, y: CONFIG.GAME_HEIGHT - CONFIG.TILE_SIZE * 5 },
                { x: 2100, y: CONFIG.GAME_HEIGHT - CONFIG.TILE_SIZE * 5 },
            ],
        };

        const positions = collectibleConfigs[level] || collectibleConfigs[1];

        for (const pos of positions) {
            const c = this.collectibles.create(pos.x, pos.y, 'collectible') as PhaserSprite;
            if (c) {
                c.body.setAllowGravity(false);
                c.body.setSize(CONFIG.TILE_SIZE * 0.5, CONFIG.TILE_SIZE * 0.5);
                c.setDepth(CONFIG.VISUAL?.DEPTH_COLLECTIBLES_ENEMIES || 50);

                this.scene.tweens.add({
                    targets: c,
                    y: pos.y - 10,
                    duration: 1000,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut',
                });
            }
        }
    }

    private createCollectibleTexture(): void {
        if (!this.isSceneActive()) return;
        if (this.scene.textures.exists('collectible')) return;

        const g = this.scene.add.graphics();
        const size = CONFIG.TILE_SIZE;

        g.fillStyle(0xFFD700);
        g.fillCircle(size / 2, size / 2, size * 0.4);

        g.fillStyle(0xFFEA00);
        g.fillCircle(size / 2, size / 2, size * 0.25);

        g.generateTexture('collectible', size, size);
        g.destroy();
    }

    // ==================================================================================
    // GETTERS
    // ==================================================================================

    public getPlatforms(): PhaserGroup | null {
        return this.platforms;
    }

    public getCollectibles(): PhaserGroup | null {
        return this.collectibles;
    }

    public getActiveCollectibleCount(): number {
        if (!this.collectibles) return 0;

        let count = 0;
        this.collectibles.children.iterate((child: any) => {
            if (child && child.active && child.visible) {
                count++;
            }
            return true;
        });

        return count;
    }

    // ==================================================================================
    // COLLISION SETUP
    // ==================================================================================

    /**
     * Sets up player collision with platforms and collectibles.
     * Tracks colliders for proper cleanup during level transitions.
     */
    public setupPlayerCollision(
        player: PhaserSprite,
        onCollect: (player: PhaserSprite, item: PhaserSprite) => void
    ): void {
        if (!this.isSceneActive()) return;

        // Remove existing colliders first
        this.removePlayerColliders();

        // Setup platform collision
        if (player && this.platforms) {
            this.playerPlatformCollider = this.scene.physics.add.collider(
                player,
                this.platforms
            );
        }

        // Setup collectible overlap
        if (player && this.collectibles) {
            this.playerCollectibleCollider = this.scene.physics.add.overlap(
                player,
                this.collectibles,
                (p: any, c: any) => {
                    // Only trigger if collectible is still active
                    if (c.active && c.visible) {
                        onCollect(p as PhaserSprite, c as PhaserSprite);
                    }
                },
                undefined,
                this
            );
        }
    }

    /**
     * Removes player colliders without destroying level content.
     * Call this before setting up new collisions.
     */
    public removePlayerColliders(): void {
        if (this.playerPlatformCollider) {
            this.playerPlatformCollider.destroy();
            this.playerPlatformCollider = null;
        }

        if (this.playerCollectibleCollider) {
            this.playerCollectibleCollider.destroy();
            this.playerCollectibleCollider = null;
        }
    }

    /**
     * Gets the current player-platform collider.
     * Useful for Game.ts to manage collisions externally.
     */
    public getPlayerPlatformCollider(): PhaserCollider | null {
        return this.playerPlatformCollider;
    }

    /**
     * Gets the current player-collectible collider.
     */
    public getPlayerCollectibleCollider(): PhaserCollider | null {
        return this.playerCollectibleCollider;
    }

    // ==================================================================================
    // LEVEL TRANSITION
    // ==================================================================================

    /**
     * Clears level content for transitioning to a new level.
     * This removes collectibles, platforms, and their associated tweens,
     * but keeps the manager ready to create a new level.
     */
    public clearLevel(): void {
        console.log('LevelManager: Clearing level...');

        // Remove colliders first (they reference the objects we're about to destroy)
        this.removePlayerColliders();

        // Clear level content
        this.clearLevelContent();

        console.log('LevelManager: Level cleared');
    }

    /**
     * Internal method to clear level content (platforms, collectibles, floor).
     * Does NOT remove colliders - use clearLevel() for full cleanup.
     */
    private clearLevelContent(): void {
        // Kill all tweens on collectibles and destroy them
        if (this.collectibles) {
            this.collectibles.children.iterate((child: any) => {
                if (child) {
                    this.scene.tweens.killTweensOf(child);
                }
                return true;
            });
            this.collectibles.clear(true, true); // removeFromScene, destroyChildren
        }

        // Clear platforms (includes floor since floor is added to platforms group)
        if (this.platforms) {
            this.platforms.clear(true, true);
        }

        // Clear floor reference
        this.floor = null;
    }

    // ==================================================================================
    // CLEANUP
    // ==================================================================================

    public destroy(): void {
        if (this.isDestroyed) return;
        this.isDestroyed = true;

        console.log('LevelManager: Destroying...');

        // Remove scene event listeners
        if (this.scene?.events) {
            this.scene.events.off('shutdown', this.onSceneShutdown, this);
            this.scene.events.off('destroy', this.onSceneShutdown, this);
        }

        // Remove colliders
        this.removePlayerColliders();

        // Clear level content
        this.clearLevelContent();

        // Null out references
        this.platforms = null;
        this.collectibles = null;
        this.floor = null;
        this.scene = null as any;

        console.log('LevelManager: Destroyed');
    }
}