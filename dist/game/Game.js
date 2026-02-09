import { CONFIG } from '../config.js';
import { errorHandler, ErrorType } from '../error-handler.js';
import { EnemyManager } from '../enemies/EnemyManager.js';
import { GameStateManager } from './GameState.js';
import { PlayerController } from './PlayerController.js';
import { LevelManager } from './LevelManager.js';
import { BackgroundManager } from './BackgroundManager.js';
import { UIManager } from './UIManager.js';
import { AnimationManager } from './AnimationManager.js';
if (typeof Phaser === 'undefined') {
    throw new Error('Phaser.js is required but not found.');
}
export class Game {
    constructor(spriteSheetUrl, apiService, assetStorage, _initialLevelImage = null) {
        this.game = null;
        this.currentScene = null;
        this.playerController = null;
        this.levelManager = null;
        this.backgroundManager = null;
        this.uiManager = null;
        this.animationManager = null;
        this.enemyManager = null;
        this.isCreating = true;
        this.isDestroyed = false;
        this.isTransitioningLevel = false;
        this.playerCollectibleCollider = null;
        this.handleCollectItem = (_player, item) => {
            if (this.isDestroyed || this.isTransitioningLevel)
                return;
            if (!item || !item.active)
                return;
            item.disableBody(true, true);
            item.setActive(false);
            item.setVisible(false);
            this.currentScene?.tweens.killTweensOf(item);
            this.stateManager.addScore(10);
            this.uiManager?.createScorePopup(item.x, item.y, '+10');
            const remaining = this.levelManager?.getActiveCollectibleCount() ?? 0;
            console.log(`Collected! Remaining collectibles: ${remaining}`);
        };
        if (!spriteSheetUrl || spriteSheetUrl.length < 100) {
            throw new Error('Invalid sprite sheet URL provided to Game constructor');
        }
        this.spriteSheetUrl = spriteSheetUrl;
        this.apiService = apiService;
        this.assetStorage = assetStorage;
        this.gameInstance = this;
        this.isCreating = true;
        this.isDestroyed = false;
        this.isTransitioningLevel = false;
        this.stateManager = new GameStateManager({
            onScoreChange: (score) => this.uiManager?.updateScore(score),
            onLivesChange: (lives) => this.uiManager?.updateLives(lives),
            onLevelChange: (level) => this.uiManager?.updateLevel(level),
            onGameOver: (score) => this.handleGameOver(score),
            onWin: (score) => this.handleWin(score),
        });
        this.initializePhaser();
    }
    initializePhaser() {
        const gameInstance = this;
        const config = {
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
                    gameInstance.preload(this);
                },
                create: function () {
                    gameInstance.create(this);
                },
                update: function () {
                    gameInstance.update(this);
                },
            },
            pixelArt: true,
            backgroundColor: '#87CEEB',
        };
        this.game = new Phaser.Game(config);
    }
    isSceneActive() {
        return (!this.isDestroyed &&
            this.currentScene &&
            this.currentScene.sys &&
            this.currentScene.sys.isActive() &&
            !this.currentScene.sys.isTransitioning());
    }
    preload(scene) {
        if (this.isDestroyed)
            return;
        console.log('Game: Preload started');
        this.currentScene = scene;
        try {
            scene.load.image('player', this.spriteSheetUrl);
            scene.load.on('complete', () => {
                if (!this.isDestroyed) {
                    console.log('Game: Asset loading complete');
                }
            });
            scene.load.on('loaderror', (file) => {
                if (file.key === 'player' && !this.isDestroyed) {
                    this.handleCriticalError('Player sprite failed to load');
                }
            });
        }
        catch (error) {
            this.handleCriticalError(error instanceof Error ? error.message : 'Preload error');
        }
    }
    async create(scene) {
        if (this.isDestroyed)
            return;
        this.isCreating = true;
        this.currentScene = scene;
        try {
            console.log('Game: Create started');
            if (!scene || !scene.textures || !scene.physics) {
                throw new Error('Scene not fully initialized');
            }
            this.uiManager = new UIManager(scene);
            this.animationManager = new AnimationManager(scene);
            this.backgroundManager = new BackgroundManager(scene, this.assetStorage);
            this.levelManager = new LevelManager(scene);
            this.playerController = new PlayerController(scene);
            await this.backgroundManager.load();
            if (this.isDestroyed)
                return;
            await this.playerController.setupSprite(this.spriteSheetUrl);
            if (this.isDestroyed)
                return;
            const currentLevel = this.stateManager.getLevel();
            console.log('Creating initial level:', currentLevel);
            this.levelManager.createLevel(currentLevel);
            this.playerController.setupPhysics(this.levelManager.getPlatforms());
            this.playerController.setupInput();
            this.animationManager.createPlayerAnimations();
            this.setupCollectibleCollision();
            await this.initializeEnemies(scene);
            if (this.isDestroyed)
                return;
            this.setupCamera(scene);
            scene.input.keyboard.on('keydown-ESC', () => this.togglePause());
            const state = this.stateManager.getState();
            this.uiManager.updateAll(state.score, state.level, state.lives);
            const player = this.playerController.getSprite();
            player?.play('idle');
            console.log('Game: Create finished successfully');
        }
        catch (error) {
            if (!this.isDestroyed) {
                this.handleCriticalError(error instanceof Error ? error.message : 'Create error');
            }
        }
        finally {
            this.isCreating = false;
        }
    }
    update(scene) {
        if (this.isDestroyed)
            return;
        if (this.isCreating)
            return;
        if (this.isTransitioningLevel)
            return;
        if (!this.currentScene)
            return;
        if (this.stateManager.isGameOver())
            return;
        if (this.stateManager.isPaused())
            return;
        if (!this.levelManager || !this.playerController)
            return;
        this.playerController.update();
        try {
            this.enemyManager?.update();
        }
        catch (e) {
        }
        if (this.playerController.isFallenOffWorld()) {
            this.handlePlayerDamage();
            return;
        }
        this.checkLevelComplete();
    }
    setupCollectibleCollision() {
        if (this.playerCollectibleCollider) {
            this.playerCollectibleCollider.destroy();
            this.playerCollectibleCollider = null;
        }
        const player = this.playerController?.getSprite();
        const collectibles = this.levelManager?.getCollectibles();
        if (player && collectibles) {
            this.playerCollectibleCollider = this.currentScene?.physics.add.overlap(player, collectibles, this.handleCollectItem, undefined, this);
        }
    }
    checkLevelComplete() {
        if (this.isCreating || this.isDestroyed || this.isTransitioningLevel)
            return;
        if (!this.levelManager)
            return;
        const collectiblesLeft = this.levelManager.getActiveCollectibleCount();
        const enemiesLeft = this.enemyManager?.getActiveCount() ?? 0;
        if (collectiblesLeft === 0 && enemiesLeft === 0) {
            console.log('Level complete! Advancing...');
            this.advanceLevel();
        }
    }
    advanceLevel() {
        if (this.stateManager.isGameOver())
            return;
        if (this.isCreating)
            return;
        if (this.isDestroyed)
            return;
        if (this.isTransitioningLevel)
            return;
        const canContinue = this.stateManager.nextLevel();
        if (!canContinue)
            return;
        this.isTransitioningLevel = true;
        this.stateManager.setPaused(true);
        this.uiManager?.showLevelTransition(this.stateManager.getLevel(), async () => {
            await this.performLevelTransition();
        });
    }
    async performLevelTransition() {
        if (this.isDestroyed || !this.isSceneActive()) {
            this.isTransitioningLevel = false;
            return;
        }
        try {
            console.log('Performing level transition...');
            this.currentScene?.physics.pause();
            if (this.playerCollectibleCollider) {
                this.playerCollectibleCollider.destroy();
                this.playerCollectibleCollider = null;
            }
            this.enemyManager?.clearAll();
            this.levelManager?.clearLevel();
            await this.waitForFrame();
            if (this.isDestroyed)
                return;
            const newLevel = this.stateManager.getLevel();
            console.log(`Loading assets for level ${newLevel}...`);
            try {
                await this.enemyManager?.preloadSprites(newLevel, true);
            }
            catch (e) {
                console.warn('Failed to preload enemy sprites:', e);
            }
            if (this.isDestroyed)
                return;
            console.log(`Creating level ${newLevel}...`);
            this.levelManager?.createLevel(newLevel);
            this.playerController?.resetPosition();
            const platforms = this.levelManager?.getPlatforms();
            if (platforms) {
                this.playerController?.updatePlatformCollision(platforms);
            }
            this.setupCollectibleCollision();
            if (platforms) {
                this.enemyManager?.setPlatforms(platforms);
            }
            this.enemyManager?.spawnLevel(newLevel);
            const player = this.playerController?.getSprite();
            if (player) {
                this.enemyManager?.setPlayer(player);
            }
            console.log(`Level ${newLevel} ready!`);
            this.currentScene?.physics.resume();
            this.stateManager.setPaused(false);
        }
        catch (error) {
            console.error('Level transition error:', error);
            this.currentScene?.physics.resume();
            this.stateManager.setPaused(false);
        }
        finally {
            this.isTransitioningLevel = false;
        }
    }
    waitForFrame() {
        return new Promise(resolve => {
            if (this.currentScene && !this.isDestroyed) {
                this.currentScene.time.delayedCall(16, resolve);
            }
            else {
                resolve();
            }
        });
    }
    async initializeEnemies(scene) {
        this.enemyManager = new EnemyManager(scene, this.apiService);
        this.enemyManager.setCallbacks({
            onEnemyKilled: (enemy) => this.onEnemyKilled(enemy),
            onPlayerHit: (enemy) => this.onPlayerHit(enemy),
        });
        const platforms = this.levelManager?.getPlatforms();
        if (platforms) {
            this.enemyManager.setPlatforms(platforms);
        }
        const player = this.playerController?.getSprite();
        if (player) {
            this.enemyManager.setPlayer(player);
        }
        try {
            const currentLevel = this.stateManager.getLevel();
            await this.enemyManager.preloadSprites(currentLevel, true);
            if (!this.isDestroyed) {
                this.enemyManager.spawnLevel(currentLevel);
            }
        }
        catch (e) {
            console.warn('Enemy loading issue:', e);
        }
    }
    setupCamera(scene) {
        const worldWidth = CONFIG.GAME_WIDTH * 3;
        scene.cameras.main.setBounds(0, 0, worldWidth, CONFIG.GAME_HEIGHT);
        scene.physics.world.setBounds(0, 0, worldWidth, CONFIG.GAME_HEIGHT, true, true, true, true);
        const player = this.playerController?.getSprite();
        if (player) {
            scene.cameras.main.startFollow(player, true, 0.1, 0.1);
        }
    }
    onEnemyKilled(enemy) {
        if (this.isDestroyed || this.isTransitioningLevel)
            return;
        const scoreValue = enemy.getScoreValue();
        this.stateManager.addScore(scoreValue);
        this.uiManager?.createScorePopup(enemy.sprite?.x || 0, enemy.sprite?.y || 0, `+${scoreValue}`);
        const shakeIntensity = enemy.type === 'mailman' ? 0.03 : 0.005;
        const shakeDuration = enemy.type === 'mailman' ? 400 : 100;
        this.currentScene?.cameras.main.shake(shakeDuration, shakeIntensity);
    }
    onPlayerHit(enemy) {
        if (this.isDestroyed || this.isTransitioningLevel)
            return;
        if (!this.playerController?.isInvulnerable()) {
            this.handlePlayerDamage(enemy.config.damage);
        }
    }
    handlePlayerDamage(damage = 1) {
        if (this.isDestroyed || this.isTransitioningLevel)
            return;
        this.playerController?.resetPosition();
        this.playerController?.takeDamage();
        this.currentScene?.cameras.main.shake(300, 0.02);
        this.stateManager.loseLife(damage);
    }
    handleGameOver(score) {
        if (this.isDestroyed)
            return;
        this.isTransitioningLevel = false;
        this.currentScene?.physics.pause();
        this.uiManager?.showGameOver(score, () => this.restartGame());
    }
    handleWin(score) {
        if (this.isDestroyed)
            return;
        this.isTransitioningLevel = false;
        this.currentScene?.physics.pause();
        this.uiManager?.showWin(score, () => this.restartGame());
    }
    togglePause() {
        if (this.isDestroyed)
            return;
        if (this.stateManager.isGameOver())
            return;
        if (this.isTransitioningLevel)
            return;
        const isPaused = this.stateManager.togglePause();
        if (isPaused) {
            this.currentScene?.physics.pause();
            this.uiManager?.showPauseMenu(() => this.togglePause(), () => this.restartGame());
        }
        else {
            this.currentScene?.physics.resume();
            this.uiManager?.hidePauseMenu();
        }
        this.uiManager?.updatePauseButton(isPaused);
    }
    restartGame() {
        this.isTransitioningLevel = false;
        this.destroy();
        this.uiManager?.removeAllOverlays();
        const cm = window.characterManager;
        if (cm?.returnToMenu) {
            cm.returnToMenu();
        }
        else {
            document.getElementById('menu-screen')?.classList.remove('hidden');
            document.getElementById('game-screen')?.classList.add('hidden');
        }
    }
    handleCriticalError(message) {
        if (this.isDestroyed)
            return;
        console.error('CRITICAL ERROR:', message);
        this.isCreating = true;
        this.isDestroyed = true;
        this.isTransitioningLevel = false;
        errorHandler.createError(ErrorType.ASSET_LOAD_ERROR, message, { operation: 'game', module: 'Game' });
        this.uiManager?.showCriticalError(message, () => {
            this.destroy();
            document.getElementById('menu-screen')?.classList.remove('hidden');
            document.getElementById('game-screen')?.classList.add('hidden');
        }, () => window.location.reload());
    }
    updateBackground() {
        if (this.isDestroyed)
            return;
        this.backgroundManager?.refresh();
    }
    getStateManager() {
        return this.stateManager;
    }
    isGameCreating() {
        return this.isCreating;
    }
    destroy() {
        if (this.isDestroyed)
            return;
        console.log('Game: Cleaning up...');
        this.isDestroyed = true;
        this.isCreating = true;
        this.isTransitioningLevel = false;
        if (this.playerCollectibleCollider) {
            try {
                this.playerCollectibleCollider.destroy();
            }
            catch (e) { }
            this.playerCollectibleCollider = null;
        }
        try {
            this.enemyManager?.destroy();
        }
        catch (e) { }
        try {
            this.levelManager?.destroy();
        }
        catch (e) { }
        try {
            this.playerController?.destroy();
        }
        catch (e) { }
        try {
            this.backgroundManager?.destroy();
        }
        catch (e) { }
        this.backgroundManager = null;
        this.enemyManager = null;
        this.levelManager = null;
        this.playerController = null;
        this.uiManager = null;
        this.animationManager = null;
        this.currentScene = null;
        try {
            this.game?.destroy(true);
        }
        catch (e) { }
        this.game = null;
        this.stateManager.reset();
        console.log('Game: Destroyed');
    }
}
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        document.getElementById('pause-btn')?.addEventListener('click', () => {
            const cm = window.characterManager;
            const gameInstance = cm?.currentGameInstance;
            gameInstance?.togglePause();
        });
    });
}
