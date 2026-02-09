/**
 * game/LevelManager.ts
 * Manages level creation, platforms, and collectibles
 */

import { CONFIG } from '../config.js';
import { PhaserScene, PhaserSprite, PhaserGroup, PlatformConfig, CollectibleConfig } from './types.js';

export class LevelManager {
    private scene: PhaserScene;
    private platforms: PhaserGroup | null = null;
    private collectibles: PhaserGroup | null = null;

    constructor(scene: PhaserScene) {
        this.scene = scene;
    }

    // ==================================================================================
    // LEVEL CREATION
    // ==================================================================================

    public createLevel(level: number): void {
        console.log(`LevelManager: Creating level ${level}...`);
        this.clearGroups();

        this.platforms = this.scene.physics.add.staticGroup();
        this.collectibles = this.scene.physics.add.group();

        this.createFloor();
        this.createPlatforms(level);
        this.createCollectibles(level);
    }

    private createFloor(): void {
        const worldWidth = CONFIG.GAME_WIDTH * 3;
        const floorY = CONFIG.GAME_HEIGHT - (CONFIG.TILE_SIZE / 2);
        const floorHeight = CONFIG.TILE_SIZE;

        const floor = this.scene.add.rectangle(
            worldWidth / 2,
            floorY,
            worldWidth,
            floorHeight,
            CONFIG.VISUAL?.GROUND_COLOR || 0x654321
        );
        floor.setOrigin(0.5, 0.5);
        floor.setDepth((CONFIG.VISUAL?.DEPTH_BACKGROUND || 0) + 1);

        this.scene.physics.add.existing(floor, true);
        if (floor.body) {
            floor.body.setSize(worldWidth, floorHeight);
        }
        this.platforms?.add(floor);
    }

    private createPlatforms(level: number): void {
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
            platform.setDepth((CONFIG.VISUAL?.DEPTH_BACKGROUND || 0) + 2);
            this.scene.physics.add.existing(platform, true);

            if (platform.body) {
                platform.body.setSize(width, height);
            }

            this.platforms?.add(platform);
        }
    }

    private createCollectibles(level: number): void {
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
            const c = this.collectibles?.create(pos.x, pos.y, 'collectible');
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
        return this.collectibles?.countActive(true) ?? 0;
    }

    // ==================================================================================
    // COLLISION SETUP
    // ==================================================================================

    public setupPlayerCollision(player: PhaserSprite, onCollect: (player: PhaserSprite, item: PhaserSprite) => void): void {
        if (player && this.platforms) {
            this.scene.physics.add.collider(player, this.platforms);
        }

        if (player && this.collectibles) {
            this.scene.physics.add.overlap(player, this.collectibles, onCollect, undefined, this);
        }
    }

    // ==================================================================================
    // CLEANUP
    // ==================================================================================

    private clearGroups(): void {
        this.platforms?.clear(true, true);
        this.collectibles?.clear(true, true);
    }

    public destroy(): void {
        this.clearGroups();
        this.platforms = null;
        this.collectibles = null;
    }
}