import { CONFIG } from './config.js';
import { errorHandler, ErrorType } from './error-handler.js';
import { EnemyManager } from './enemies/EnemyManager.js';
if (typeof Phaser === 'undefined') {
    throw new Error('Phaser.js is required but not found. Check script loading order in index.html');
}
export class Game {
    constructor(spriteSheetUrl, apiService, assetStorage, _initialLevelImage = null) {
        this.game = null;
        this.player = null;
        this.cursors = null;
        this.platforms = null;
        this.collectibles = null;
        this.spaceKey = null;
        this.currentScene = null;
        this.enemyManager = null;
        this.state = {
            score: 0,
            lives: 3,
            level: 1,
            isGameOver: false,
            isPaused: false,
        };
        this.mobileInput = { left: false, right: false, jump: false };
        this.backgroundSprites = [];
        this.backgroundFrameTimer = null;
        this.isUpdatingBackground = false;
        if (!spriteSheetUrl || spriteSheetUrl.length < 100) {
            throw new Error('Invalid sprite sheet URL provided to Game constructor');
        }
        this.spriteSheetUrl = spriteSheetUrl;
        this.apiService = apiService;
        this.assetStorage = assetStorage;
        this.gameInstance = this;
        const self = this;
        this.config = {
            type: Phaser.AUTO,
            width: CONFIG.GAME_WIDTH,
            height: CONFIG.GAME_HEIGHT,
            parent: 'phaser-game',
            physics: {
                default: 'arcade',
                arcade: {
                    gravity: { y: CONFIG.GRAVITY },
                    debug: CONFIG.DEBUG_MODE,
                },
            },
            scene: {
                preload: function () {
                    self.preload(this);
                },
                create: function () {
                    self.create(this);
                },
                update: function () {
                    self.update(this);
                },
            },
            pixelArt: true,
            backgroundColor: '#87CEEB',
        };
        this.game = new Phaser.Game(this.config);
    }
    preload(scene) {
        console.log('Game: Preload started');
        this.currentScene = scene;
        try {
            scene.load.image('player', this.spriteSheetUrl);
            this.createPlatformTexture(scene);
            scene.load.on('complete', () => {
                console.log('Game: Asset loading complete');
            });
            scene.load.on('loaderror', (file) => {
                console.error(`Asset load error: ${file.key}`);
                if (file.key === 'player') {
                    this.handleCriticalAssetError('Player sprite failed to load');
                }
            });
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown preload error';
            console.error('Preload error:', error);
            this.handleCriticalAssetError(errorMessage);
        }
    }
    async create(scene) {
        try {
            console.log('Game: Create started');
            this.currentScene = scene;
            await this.loadLocationBackground(scene);
            await this.handlePlayerSpriteSetup(scene);
            await this.createLevel(scene, this.state.level);
            this.setupPlayerPhysics(scene);
            this.enemyManager = new EnemyManager(scene, this.apiService);
            this.enemyManager.setCallbacks({
                onEnemyKilled: (enemy, player) => this.onEnemyKilled(enemy, player),
                onPlayerHit: (enemy, player) => this.onPlayerHit(enemy, player),
            });
            const worldWidth = CONFIG.GAME_WIDTH * 3;
            scene.cameras.main.setBounds(0, 0, worldWidth, CONFIG.GAME_HEIGHT);
            scene.physics.world.setBounds(0, 0, worldWidth, CONFIG.GAME_HEIGHT, true, true, true, true);
            if (this.player) {
                scene.cameras.main.startFollow(this.player, true, 0.1, 0.1);
                this.enemyManager.setPlayer(this.player);
            }
            try {
                await this.enemyManager.preloadSprites(this.state.level, true);
                this.enemyManager.spawnLevel(this.state.level);
            }
            catch (enemyError) {
                console.warn('Enemy loading issue, continuing:', enemyError);
            }
            this.createAnimations(scene);
            this.setupInput(scene);
            this.setupMobileControls();
            this.updateUI();
            console.log('Game: Create finished successfully');
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error during game creation';
            console.error('CRITICAL ERROR in Game.create:', error);
            this.handleCriticalAssetError(errorMessage);
        }
    }
    update(_scene) {
        if (!this.player || !this.player.body || !this.cursors)
            return;
        if (this.state.isGameOver || this.state.isPaused)
            return;
        const body = this.player.body;
        const isOnGround = body.onFloor() || body.touching.down;
        this.handlePlayerInput(isOnGround);
        try {
            this.enemyManager?.update();
        }
        catch (e) {
        }
        if (this.player.y > CONFIG.GAME_HEIGHT + 100) {
            this.loseLife();
        }
        const collectiblesLeft = this.collectibles?.countActive(true) ?? 0;
        const enemiesLeft = this.enemyManager?.getActiveCount() ?? 0;
        if (collectiblesLeft === 0 && enemiesLeft === 0 && !this.state.isGameOver) {
            this.nextLevel();
        }
    }
    handleCriticalAssetError(message) {
        console.error('CRITICAL ASSET ERROR:', message);
        errorHandler.createError(ErrorType.ASSET_LOAD_ERROR, message, { operation: 'game_asset_load', module: 'Game' });
        document.getElementById('critical-error-overlay')?.remove();
        const overlay = document.createElement('div');
        overlay.id = 'critical-error-overlay';
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.95); display: flex; flex-direction: column;
            justify-content: center; align-items: center; z-index: 10000;
            color: white; font-family: 'Press Start 2P', monospace;
            text-align: center; padding: 20px;
        `;
        overlay.innerHTML = `
            <h1 style="color: #ff6b6b; margin-bottom: 20px; font-size: 24px;">Asset Load Error</h1>
            <p style="margin-bottom: 30px; max-width: 500px; line-height: 1.6; font-size: 12px;">${message}</p>
            <div style="display: flex; gap: 15px; flex-wrap: wrap; justify-content: center;">
                <button id="return-menu-btn" style="padding: 15px 30px; background: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 12px; font-family: inherit;">Return to Menu</button>
                <button id="retry-game-btn" style="padding: 15px 30px; background: #2196F3; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 12px; font-family: inherit;">Retry</button>
            </div>
        `;
        document.body.appendChild(overlay);
        document.getElementById('return-menu-btn')?.addEventListener('click', () => {
            overlay.remove();
            this.destroy();
            document.getElementById('menu-screen')?.classList.remove('hidden');
            document.getElementById('game-screen')?.classList.add('hidden');
        });
        document.getElementById('retry-game-btn')?.addEventListener('click', () => {
            overlay.remove();
            window.location.reload();
        });
    }
    async handlePlayerSpriteSetup(scene) {
        if (scene.textures.exists('playerSprite')) {
            console.log('playerSprite texture already exists');
            return;
        }
        if (!scene.textures.exists('player')) {
            throw new Error('Player texture not loaded - cannot setup sprite');
        }
        const playerTexture = scene.textures.get('player');
        if (!playerTexture || !playerTexture.source || !playerTexture.source[0]) {
            throw new Error('Player texture has no source data');
        }
        let processedImage = playerTexture.source[0].image;
        if (!processedImage) {
            throw new Error('Player texture has no image data');
        }
        try {
            processedImage = this.removeLimeGreenBackground(processedImage);
        }
        catch (e) {
            console.warn('Background removal failed, using original image', e);
        }
        const actualWidth = processedImage.width;
        const actualHeight = processedImage.height;
        console.log(`Player sprite source size: ${actualWidth}x${actualHeight}`);
        if (actualWidth <= 0 || actualHeight <= 0) {
            throw new Error(`Invalid image dimensions: ${actualWidth}x${actualHeight}`);
        }
        const framesPerRow = 4;
        const framesPerCol = 4;
        const frameWidth = Math.floor(actualWidth / framesPerRow);
        const frameHeight = Math.floor(actualHeight / framesPerCol);
        console.log(`Calculated frame size: ${frameWidth}x${frameHeight}`);
        if (frameWidth <= 0 || frameHeight <= 0) {
            throw new Error(`Invalid calculated sprite dimensions: ${frameWidth}x${frameHeight}`);
        }
        const targetSize = CONFIG.TILE_SIZE;
        const scaleFactor = targetSize / Math.max(frameWidth, frameHeight);
        scene.playerSpriteScale = scaleFactor;
        scene.playerSpriteNeedsScaling = true;
        scene.playerFrameWidth = frameWidth;
        scene.playerFrameHeight = frameHeight;
        scene.textures.addSpriteSheet('playerSprite', processedImage, {
            frameWidth: frameWidth,
            frameHeight: frameHeight,
        });
        if (!scene.textures.exists('playerSprite')) {
            throw new Error('Failed to create playerSprite texture');
        }
        console.log(`Player sprite setup complete: ${frameWidth}x${frameHeight} frames, scale: ${scaleFactor}`);
    }
    setupPlayerPhysics(scene) {
        if (!scene.textures.exists('playerSprite')) {
            throw new Error('playerSprite texture missing - cannot create player');
        }
        const floorY = CONFIG.GAME_HEIGHT - CONFIG.TILE_SIZE;
        const playerY = floorY - CONFIG.TILE_SIZE;
        this.player = scene.physics.add.sprite(100, playerY, 'playerSprite', 0);
        if (!this.player) {
            throw new Error('Failed to create player sprite');
        }
        this.player.setBounce(CONFIG.PHYSICS?.PLAYER_BOUNCE || 0.1);
        this.player.setCollideWorldBounds(true);
        this.player.setOrigin(0.5, 1.0);
        this.player.setDepth(CONFIG.VISUAL?.DEPTH_PLAYER || 100);
        this.player.setDragX(CONFIG.PHYSICS?.PLAYER_DRAG_X || 100);
        const scaleFactor = scene.playerSpriteScale || 1.0;
        const baseScale = CONFIG.VISUAL?.PLAYER_SCALE_DEFAULT || 1.5;
        this.player.setScale(scaleFactor * baseScale);
        if (this.player.body) {
            const bodyWidth = CONFIG.TILE_SIZE * 0.6;
            const bodyHeight = CONFIG.TILE_SIZE * 0.9;
            this.player.body.setSize(bodyWidth, bodyHeight);
            this.player.body.setOffset((scene.playerFrameWidth - bodyWidth) / 2, scene.playerFrameHeight - bodyHeight);
        }
        if (this.platforms && this.platforms.children.size > 0) {
            scene.physics.add.collider(this.player, this.platforms);
        }
        console.log('Player physics setup complete');
    }
    async createLevel(scene, level) {
        console.log(`Game: Creating level ${level}...`);
        this.clearGroups();
        this.platforms = scene.physics.add.staticGroup();
        this.collectibles = scene.physics.add.group();
        const worldWidth = CONFIG.GAME_WIDTH * 3;
        const floorY = CONFIG.GAME_HEIGHT - (CONFIG.TILE_SIZE / 2);
        const floorHeight = CONFIG.TILE_SIZE;
        const floor = scene.add.rectangle(worldWidth / 2, floorY, worldWidth, floorHeight, CONFIG.VISUAL?.GROUND_COLOR || 0x654321);
        floor.setOrigin(0.5, 0.5);
        floor.setDepth((CONFIG.VISUAL?.DEPTH_BACKGROUND || 0) + 1);
        scene.physics.add.existing(floor, true);
        if (floor.body) {
            floor.body.setSize(worldWidth, floorHeight);
        }
        this.platforms.add(floor);
        this.createPlatforms(scene, level);
        this.createCollectibles(scene, level);
    }
    createPlatforms(scene, level) {
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
        const platforms = platformConfigs[level] || platformConfigs[1];
        for (const plat of platforms) {
            const width = plat.width * TILE;
            const height = TILE / 2;
            const platform = scene.add.rectangle(plat.x, plat.y, width, height, CONFIG.VISUAL?.PLATFORM_COLOR || 0x8B4513);
            platform.setOrigin(0.5, 0.5);
            platform.setDepth((CONFIG.VISUAL?.DEPTH_BACKGROUND || 0) + 2);
            scene.physics.add.existing(platform, true);
            if (platform.body) {
                platform.body.setSize(width, height);
            }
            this.platforms?.add(platform);
        }
    }
    createCollectibles(scene, level) {
        if (!scene.textures.exists('collectible')) {
            const g = scene.add.graphics();
            const size = CONFIG.TILE_SIZE;
            g.fillStyle(0xFFD700);
            g.fillCircle(size / 2, size / 2, size * 0.4);
            g.fillStyle(0xFFEA00);
            g.fillCircle(size / 2, size / 2, size * 0.25);
            g.generateTexture('collectible', size, size);
            g.destroy();
        }
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
            const c = this.collectibles?.create(pos.x, pos.y, 'collectible');
            if (c) {
                c.body.setAllowGravity(false);
                c.body.setSize(CONFIG.TILE_SIZE * 0.5, CONFIG.TILE_SIZE * 0.5);
                c.setDepth(CONFIG.VISUAL?.DEPTH_COLLECTIBLES_ENEMIES || 50);
                scene.tweens.add({
                    targets: c,
                    y: pos.y - 10,
                    duration: 1000,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut',
                });
            }
        }
        if (this.player && this.collectibles) {
            scene.physics.add.overlap(this.player, this.collectibles, this.collectItem.bind(this), undefined, this);
        }
    }
    clearGroups() {
        this.platforms?.clear(true, true);
        this.collectibles?.clear(true, true);
    }
    setupInput(scene) {
        this.cursors = scene.input.keyboard.createCursorKeys();
        this.spaceKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        scene.input.keyboard.on('keydown-ESC', () => this.togglePause());
    }
    setupMobileControls() {
        const leftBtn = document.getElementById('mobile-left');
        const rightBtn = document.getElementById('mobile-right');
        const jumpBtn = document.getElementById('mobile-jump');
        const addTouchListeners = (element, inputKey) => {
            if (!element)
                return;
            element.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.mobileInput[inputKey] = true;
            });
            element.addEventListener('touchend', () => {
                this.mobileInput[inputKey] = false;
            });
            element.addEventListener('mousedown', () => {
                this.mobileInput[inputKey] = true;
            });
            element.addEventListener('mouseup', () => {
                this.mobileInput[inputKey] = false;
            });
        };
        addTouchListeners(leftBtn, 'left');
        addTouchListeners(rightBtn, 'right');
        addTouchListeners(jumpBtn, 'jump');
    }
    handlePlayerInput(isOnGround) {
        if (!this.cursors || !this.player)
            return;
        const mobile = this.mobileInput;
        const speed = CONFIG.PLAYER_SPEED || 200;
        const jumpForce = CONFIG.JUMP_FORCE || -400;
        if (this.cursors.left.isDown || mobile.left) {
            this.player.setVelocityX(-speed);
            this.player.setFlipX(true);
            if (isOnGround && this.player.anims) {
                this.player.play('walk', true);
            }
        }
        else if (this.cursors.right.isDown || mobile.right) {
            this.player.setVelocityX(speed);
            this.player.setFlipX(false);
            if (isOnGround && this.player.anims) {
                this.player.play('walk', true);
            }
        }
        else {
            this.player.setVelocityX(0);
            if (isOnGround && this.player.anims) {
                this.player.play('idle', true);
            }
        }
        if ((this.cursors.up.isDown || this.spaceKey?.isDown || mobile.jump) && isOnGround) {
            this.player.setVelocityY(jumpForce);
            if (this.player.anims) {
                this.player.play('jump', true);
            }
            this.mobileInput.jump = false;
        }
        if (!isOnGround && this.player.anims && !this.player.anims.isPlaying) {
            this.player.play('jump', true);
        }
    }
    createAnimations(scene) {
        if (!scene.textures.exists('playerSprite'))
            return;
        const createAnim = (key, start, end, frameRate) => {
            if (!scene.anims.exists(key)) {
                try {
                    scene.anims.create({
                        key,
                        frames: scene.anims.generateFrameNumbers('playerSprite', { start, end }),
                        frameRate,
                        repeat: -1,
                    });
                }
                catch (e) {
                    console.warn(`Failed to create animation ${key}:`, e);
                }
            }
        };
        createAnim('walk', 0, 3, 10);
        createAnim('jump', 8, 11, 8);
        createAnim('idle', 12, 15, 6);
        if (this.player) {
            this.player.play('idle');
        }
    }
    onEnemyKilled(enemy, _player) {
        this.state.score += enemy.getScoreValue();
        this.updateUI();
        if (enemy.type === 'mailman') {
            this.currentScene?.cameras.main.shake(400, 0.03);
            this.currentScene?.time.delayedCall(1000, () => this.nextLevel());
        }
        else {
            this.currentScene?.cameras.main.shake(100, 0.005);
        }
        this.createScorePopup(enemy.sprite?.x || 0, enemy.sprite?.y || 0, `+${enemy.getScoreValue()}`);
    }
    onPlayerHit(enemy, _player) {
        this.loseLife(enemy.config.damage);
    }
    createScorePopup(x, y, text) {
        if (!this.currentScene)
            return;
        const popup = this.currentScene.add.text(x, y, text, {
            fontSize: '24px',
            fontFamily: 'Press Start 2P, monospace',
            color: '#FFD700',
            stroke: '#000000',
            strokeThickness: 4,
        });
        popup.setOrigin(0.5);
        popup.setDepth((CONFIG.VISUAL?.DEPTH_PLAYER || 100) + 10);
        this.currentScene.tweens.add({
            targets: popup,
            y: y - 50,
            alpha: 0,
            duration: 1000,
            ease: 'Power2',
            onComplete: () => popup.destroy(),
        });
    }
    collectItem(_player, item) {
        item.disableBody(true, true);
        this.state.score += 10;
        this.updateUI();
        this.createScorePopup(item.x, item.y, '+10');
    }
    loseLife(damage = 1) {
        if (this.player?.getData('invulnerable'))
            return;
        this.state.lives -= damage;
        this.updateUI();
        if (this.state.lives <= 0) {
            this.gameOver();
        }
        else {
            this.handlePlayerDamage();
        }
    }
    handlePlayerDamage() {
        if (!this.player)
            return;
        this.player.setPosition(100, CONFIG.GAME_HEIGHT - CONFIG.TILE_SIZE * 2);
        this.player.setVelocity(0, 0);
        this.player.setTint(0xff0000);
        this.player.setData('invulnerable', true);
        this.currentScene?.cameras.main.shake(300, 0.02);
        this.currentScene?.tweens.add({
            targets: this.player,
            alpha: 0.5,
            duration: 100,
            yoyo: true,
            repeat: 7,
        });
        this.currentScene?.time.delayedCall(1500, () => {
            if (this.player) {
                this.player.clearTint();
                this.player.setAlpha(1);
                this.player.setData('invulnerable', false);
            }
        });
    }
    nextLevel() {
        if (this.state.isGameOver)
            return;
        this.state.level++;
        if (this.state.level > 3) {
            this.winGame();
            return;
        }
        console.log(`Advancing to level ${this.state.level}`);
        this.state.isPaused = true;
        this.showLevelTransition(`Level ${this.state.level}`, async () => {
            this.state.isPaused = false;
            this.enemyManager?.clearAll();
            await this.createLevel(this.currentScene, this.state.level);
            if (this.player) {
                this.player.setPosition(100, CONFIG.GAME_HEIGHT - CONFIG.TILE_SIZE * 2);
                this.player.setVelocity(0, 0);
            }
            if (this.player && this.platforms) {
                this.currentScene?.physics.add.collider(this.player, this.platforms);
            }
            if (this.player && this.collectibles) {
                this.currentScene?.physics.add.overlap(this.player, this.collectibles, this.collectItem.bind(this), undefined, this);
            }
            try {
                await this.enemyManager?.preloadSprites(this.state.level, true);
                this.enemyManager?.spawnLevel(this.state.level);
                this.enemyManager?.setPlayer(this.player);
            }
            catch (e) {
                console.warn('Failed to load enemies for next level:', e);
            }
            this.updateUI();
        });
    }
    showLevelTransition(text, callback) {
        if (!this.currentScene) {
            callback();
            return;
        }
        const overlay = this.currentScene.add.rectangle(CONFIG.GAME_WIDTH / 2, CONFIG.GAME_HEIGHT / 2, CONFIG.GAME_WIDTH, CONFIG.GAME_HEIGHT, 0x000000, 0.8);
        overlay.setScrollFactor(0);
        overlay.setDepth((CONFIG.VISUAL?.DEPTH_PLAYER || 100) + 100);
        const levelText = this.currentScene.add.text(CONFIG.GAME_WIDTH / 2, CONFIG.GAME_HEIGHT / 2, text, { fontSize: '48px', fontFamily: 'Press Start 2P, monospace', color: '#FFD700' });
        levelText.setOrigin(0.5);
        levelText.setScrollFactor(0);
        levelText.setDepth((CONFIG.VISUAL?.DEPTH_PLAYER || 100) + 101);
        levelText.setScale(0);
        this.currentScene.tweens.add({
            targets: levelText,
            scale: 1,
            duration: 500,
            ease: 'Back.easeOut',
        });
        this.currentScene.time.delayedCall(2000, () => {
            this.currentScene?.tweens.add({
                targets: [overlay, levelText],
                alpha: 0,
                duration: 500,
                onComplete: () => {
                    overlay.destroy();
                    levelText.destroy();
                    callback();
                },
            });
        });
    }
    gameOver() {
        this.state.isGameOver = true;
        this.currentScene?.physics.pause();
        this.showOverlay('GAME OVER', `Final Score: ${this.state.score}`, '#ff0000');
    }
    winGame() {
        this.state.isGameOver = true;
        this.currentScene?.physics.pause();
        this.showOverlay('YOU WIN!', `Final Score: ${this.state.score}`, '#4CAF50');
    }
    togglePause() {
        if (this.state.isGameOver)
            return;
        this.state.isPaused = !this.state.isPaused;
        if (this.state.isPaused) {
            this.currentScene?.physics.pause();
            this.showPauseMenu();
        }
        else {
            this.currentScene?.physics.resume();
            this.hidePauseMenu();
        }
        const btn = document.getElementById('pause-btn');
        if (btn) {
            const textEl = btn.querySelector('.button-text');
            if (textEl) {
                textEl.textContent = this.state.isPaused ? 'Resume' : 'Pause';
            }
        }
    }
    showPauseMenu() {
        if (document.getElementById('pause-overlay'))
            return;
        const overlay = document.createElement('div');
        overlay.id = 'pause-overlay';
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.8); display: flex; flex-direction: column;
            justify-content: center; align-items: center; z-index: 1000;
        `;
        overlay.innerHTML = `
            <h1 style="color:#4CAF50; margin-bottom: 20px; font-family: 'Press Start 2P', monospace;">PAUSED</h1>
            <p style="margin-bottom: 20px; font-family: 'Press Start 2P', monospace; color: white;">Press ESC to resume</p>
            <button id="resume-btn" style="padding: 15px 30px; margin: 5px; background: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer; font-family: inherit;">Resume</button>
            <button id="quit-btn" style="padding: 15px 30px; margin: 5px; background: #ff4444; color: white; border: none; border-radius: 5px; cursor: pointer; font-family: inherit;">Quit</button>
        `;
        document.body.appendChild(overlay);
        document.getElementById('resume-btn')?.addEventListener('click', () => this.togglePause());
        document.getElementById('quit-btn')?.addEventListener('click', () => this.restartGame());
    }
    hidePauseMenu() {
        document.getElementById('pause-overlay')?.remove();
    }
    showOverlay(title, subtitle, color) {
        const overlay = document.createElement('div');
        overlay.id = 'game-overlay';
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.8); display: flex; flex-direction: column;
            justify-content: center; align-items: center; z-index: 1000;
        `;
        overlay.innerHTML = `
            <h1 style="color:${color}; font-family:'Press Start 2P', monospace; font-size: 36px;">${title}</h1>
            <p style="font-size: 18px; margin: 20px 0; color: white; font-family: 'Press Start 2P', monospace;">${subtitle}</p>
            <button id="restart-btn" style="padding: 15px 30px; background:${color}; color: white; border: none; border-radius: 5px; cursor: pointer; font-family: inherit; font-size: 14px;">Play Again</button>
        `;
        document.body.appendChild(overlay);
        document.getElementById('restart-btn')?.addEventListener('click', () => {
            overlay.remove();
            this.restartGame();
        });
    }
    restartGame() {
        this.destroy();
        document.getElementById('game-overlay')?.remove();
        document.getElementById('pause-overlay')?.remove();
        document.getElementById('menu-screen')?.classList.remove('hidden');
        document.getElementById('game-screen')?.classList.add('hidden');
    }
    updateUI() {
        const scoreEl = document.querySelector('#score .stat-value') || document.getElementById('score');
        const levelEl = document.querySelector('#level .stat-value') || document.getElementById('level');
        const livesEl = document.getElementById('lives');
        if (scoreEl)
            scoreEl.textContent = this.state.score.toString();
        if (levelEl)
            levelEl.textContent = `Level ${this.state.level}`;
        if (livesEl) {
            const hearts = livesEl.querySelectorAll('.heart');
            if (hearts.length > 0) {
                hearts.forEach((heart, index) => {
                    if (index < this.state.lives) {
                        heart.classList.remove('lost');
                        heart.textContent = '❤️';
                    }
                    else {
                        heart.classList.add('lost');
                        heart.textContent = '🖤';
                    }
                });
            }
            else {
                livesEl.textContent = `Lives: ${'❤️'.repeat(Math.max(0, this.state.lives))}`;
            }
        }
    }
    async loadLocationBackground(scene) {
        let frames = [];
        try {
            const stored = await this.assetStorage.getItem('location_background_frames');
            frames = stored ? JSON.parse(stored) : [];
            if (frames.length === 0) {
                const local = localStorage.getItem('location_background_frames');
                frames = local ? JSON.parse(local) : [];
            }
        }
        catch (e) {
            console.warn('Failed to parse background frames', e);
        }
        if (frames.length < 8) {
            console.warn('Not enough background frames available:', frames.length);
            return;
        }
        console.log(`Loading ${frames.length} background frames...`);
        for (let i = 0; i < 8; i++) {
            const key = `bg_frame_${i}`;
            if (!scene.textures.exists(key) && frames[i]) {
                try {
                    await this.loadBase64Texture(scene, key, frames[i]);
                }
                catch (e) {
                    console.warn(`Failed to load background frame ${i}:`, e);
                }
            }
        }
        const tilesNeeded = 3;
        const frameWidth = CONFIG.GAME_WIDTH;
        const frameHeight = CONFIG.GAME_HEIGHT;
        this.backgroundSprites.forEach((s) => s?.destroy());
        this.backgroundSprites = [];
        for (let i = 0; i < tilesNeeded; i++) {
            const x = i * frameWidth + frameWidth / 2;
            const y = frameHeight / 2;
            if (scene.textures.exists('bg_frame_0')) {
                const bg = scene.add.image(x, y, 'bg_frame_0');
                bg.setDisplaySize(frameWidth, frameHeight);
                bg.setDepth(CONFIG.VISUAL?.DEPTH_BACKGROUND || -100);
                bg.setScrollFactor(1, 1);
                bg.setData('frameIndex', 0);
                scene.children.sendToBack(bg);
                this.backgroundSprites.push(bg);
            }
        }
        if (this.backgroundSprites.length > 0) {
            this.startBackgroundAnimation(scene);
            console.log('Background loaded successfully');
        }
    }
    loadBase64Texture(scene, key, base64) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                try {
                    scene.textures.addImage(key, img);
                    resolve();
                }
                catch (e) {
                    reject(e);
                }
            };
            img.onerror = () => reject(new Error(`Failed to load texture ${key}`));
            img.src = base64;
        });
    }
    startBackgroundAnimation(scene) {
        if (this.backgroundFrameTimer) {
            this.backgroundFrameTimer.destroy();
        }
        const delay = 1000 / (CONFIG.TIMING?.BACKGROUND_ANIMATION_SPEED || 2);
        this.backgroundFrameTimer = scene.time.addEvent({
            delay,
            loop: true,
            callback: () => {
                if (!this.backgroundSprites || this.backgroundSprites.length === 0)
                    return;
                this.backgroundSprites.forEach((bg) => {
                    if (!bg || !bg.active)
                        return;
                    const current = bg.getData('frameIndex');
                    const next = (current + 1) % 8;
                    const nextKey = `bg_frame_${next}`;
                    if (scene.textures.exists(nextKey)) {
                        bg.setTexture(nextKey);
                        bg.setData('frameIndex', next);
                    }
                });
            },
        });
    }
    updateBackground() {
        if (this.currentScene && !this.isUpdatingBackground) {
            this.isUpdatingBackground = true;
            this.backgroundSprites.forEach((s) => s?.destroy());
            this.backgroundSprites = [];
            this.loadLocationBackground(this.currentScene).finally(() => {
                this.isUpdatingBackground = false;
            });
        }
    }
    createPlatformTexture(scene) {
        if (scene.textures.exists('platform'))
            return;
        const g = scene.add.graphics();
        g.fillStyle(0x8B4513);
        g.fillRect(0, 0, CONFIG.TILE_SIZE, CONFIG.TILE_SIZE / 4);
        g.fillStyle(0xA0522D);
        g.fillRect(0, CONFIG.TILE_SIZE / 4 - 4, CONFIG.TILE_SIZE, 4);
        g.generateTexture('platform', CONFIG.TILE_SIZE, CONFIG.TILE_SIZE / 4);
        g.destroy();
    }
    removeLimeGreenBackground(image) {
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');
        if (!ctx)
            return image;
        ctx.drawImage(image, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            if (g > 150 && g > r * 1.2 && g > b * 1.2) {
                data[i + 3] = 0;
            }
        }
        ctx.putImageData(imgData, 0, 0);
        const processedImg = new Image();
        processedImg.src = canvas.toDataURL('image/png');
        return processedImg;
    }
    destroy() {
        console.log('Game: Cleaning up...');
        if (this.backgroundFrameTimer) {
            this.backgroundFrameTimer.destroy();
            this.backgroundFrameTimer = null;
        }
        this.backgroundSprites.forEach((s) => s?.destroy());
        this.backgroundSprites = [];
        this.enemyManager?.destroy();
        this.enemyManager = null;
        this.platforms?.clear(true, true);
        this.platforms = null;
        this.collectibles?.clear(true, true);
        this.collectibles = null;
        this.player = null;
        this.cursors = null;
        this.spaceKey = null;
        this.currentScene = null;
        this.game?.destroy(true);
        this.game = null;
        this.state = {
            score: 0,
            lives: 3,
            level: 1,
            isGameOver: false,
            isPaused: false,
        };
        console.log('Game: Destroyed');
    }
}
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        document.getElementById('pause-btn')?.addEventListener('click', () => {
            const cm = window.characterManager;
            const gameInstance = cm?.currentGameInstance;
            if (gameInstance) {
                gameInstance.togglePause();
            }
        });
    });
}
