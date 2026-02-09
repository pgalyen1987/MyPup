import { CONFIG } from '../config.js';
export class LevelManager {
    constructor(scene) {
        this.platforms = null;
        this.collectibles = null;
        this.floor = null;
        this.playerPlatformCollider = null;
        this.playerCollectibleCollider = null;
        this.isDestroyed = false;
        this.scene = scene;
        this.scene.events?.once('shutdown', this.onSceneShutdown, this);
        this.scene.events?.once('destroy', this.onSceneShutdown, this);
    }
    onSceneShutdown() {
        this.destroy();
    }
    isSceneActive() {
        return (!this.isDestroyed &&
            this.scene &&
            this.scene.sys &&
            this.scene.sys.isActive());
    }
    createLevel(level) {
        if (this.isDestroyed || !this.isSceneActive()) {
            console.warn('LevelManager: Cannot create level - manager or scene not active');
            return;
        }
        console.log(`LevelManager: Creating level ${level}...`);
        this.clearLevelContent();
        this.platforms = this.scene.physics.add.staticGroup();
        this.collectibles = this.scene.physics.add.group();
        this.createFloor();
        this.createPlatforms(level);
        this.createCollectibles(level);
        console.log(`LevelManager: Level ${level} created with ${this.getActiveCollectibleCount()} collectibles`);
    }
    createFloor() {
        if (!this.isSceneActive())
            return;
        const worldWidth = CONFIG.GAME_WIDTH * 3;
        const floorY = CONFIG.GAME_HEIGHT - (CONFIG.TILE_SIZE / 2);
        const floorHeight = CONFIG.TILE_SIZE;
        this.floor = this.scene.add.zone(worldWidth / 2, floorY, worldWidth, floorHeight);
        this.scene.physics.add.existing(this.floor, true);
        if (this.floor.body) {
            this.floor.body.setSize(worldWidth, floorHeight);
        }
        this.platforms?.add(this.floor);
    }
    createPlatforms(level) {
        if (!this.isSceneActive() || !this.platforms)
            return;
        const TILE = CONFIG.TILE_SIZE;
        const platformConfigs = {
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
            const platform = this.scene.add.rectangle(plat.x, plat.y, width, height, CONFIG.VISUAL?.PLATFORM_COLOR || 0x8B4513);
            platform.setOrigin(0.5, 0.5);
            platform.setDepth((CONFIG.VISUAL?.DEPTH_TILES || 0) + 1);
            this.scene.physics.add.existing(platform, true);
            if (platform.body) {
                platform.body.setSize(width, height);
            }
            this.platforms.add(platform);
        }
    }
    createCollectibles(level) {
        if (!this.isSceneActive() || !this.collectibles)
            return;
        this.createCollectibleTexture();
        const collectibleConfigs = {
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
            const c = this.collectibles.create(pos.x, pos.y, 'collectible');
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
    createCollectibleTexture() {
        if (!this.isSceneActive())
            return;
        if (this.scene.textures.exists('collectible'))
            return;
        const g = this.scene.add.graphics();
        const size = CONFIG.TILE_SIZE;
        g.fillStyle(0xFFD700);
        g.fillCircle(size / 2, size / 2, size * 0.4);
        g.fillStyle(0xFFEA00);
        g.fillCircle(size / 2, size / 2, size * 0.25);
        g.generateTexture('collectible', size, size);
        g.destroy();
    }
    getPlatforms() {
        return this.platforms;
    }
    getCollectibles() {
        return this.collectibles;
    }
    getActiveCollectibleCount() {
        if (!this.collectibles)
            return 0;
        let count = 0;
        this.collectibles.children.iterate((child) => {
            if (child && child.active && child.visible) {
                count++;
            }
            return true;
        });
        return count;
    }
    setupPlayerCollision(player, onCollect) {
        if (!this.isSceneActive())
            return;
        this.removePlayerColliders();
        if (player && this.platforms) {
            this.playerPlatformCollider = this.scene.physics.add.collider(player, this.platforms);
        }
        if (player && this.collectibles) {
            this.playerCollectibleCollider = this.scene.physics.add.overlap(player, this.collectibles, (p, c) => {
                if (c.active && c.visible) {
                    onCollect(p, c);
                }
            }, undefined, this);
        }
    }
    removePlayerColliders() {
        if (this.playerPlatformCollider) {
            this.playerPlatformCollider.destroy();
            this.playerPlatformCollider = null;
        }
        if (this.playerCollectibleCollider) {
            this.playerCollectibleCollider.destroy();
            this.playerCollectibleCollider = null;
        }
    }
    getPlayerPlatformCollider() {
        return this.playerPlatformCollider;
    }
    getPlayerCollectibleCollider() {
        return this.playerCollectibleCollider;
    }
    clearLevel() {
        console.log('LevelManager: Clearing level...');
        this.removePlayerColliders();
        this.clearLevelContent();
        console.log('LevelManager: Level cleared');
    }
    clearLevelContent() {
        if (this.collectibles) {
            this.collectibles.children.iterate((child) => {
                if (child) {
                    this.scene.tweens.killTweensOf(child);
                }
                return true;
            });
            this.collectibles.clear(true, true);
        }
        if (this.platforms) {
            this.platforms.clear(true, true);
        }
        this.floor = null;
    }
    destroy() {
        if (this.isDestroyed)
            return;
        this.isDestroyed = true;
        console.log('LevelManager: Destroying...');
        if (this.scene?.events) {
            this.scene.events.off('shutdown', this.onSceneShutdown, this);
            this.scene.events.off('destroy', this.onSceneShutdown, this);
        }
        this.removePlayerColliders();
        this.clearLevelContent();
        this.platforms = null;
        this.collectibles = null;
        this.floor = null;
        this.scene = null;
        console.log('LevelManager: Destroyed');
    }
}
