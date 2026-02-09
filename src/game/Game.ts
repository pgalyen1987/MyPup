/**
 * game/Game.ts
 * Main game class - coordinates all game modules
 */

import { CONFIG } from '../config.js';
import type { APIService } from '../api/api.js';
import type { AssetStorage } from '../AssetStorage.js';
import { errorHandler, ErrorType } from '../error-handler.js';
import { EnemyManager } from '../enemies/EnemyManager.js';
import { Enemy } from '../enemies/Enemy.js';

import { GameStateManager } from './GameState.js';
import { PlayerController } from './PlayerController.js';
import { LevelManager } from './LevelManager.js';
import { BackgroundManager } from './BackgroundManager.js';
import { UIManager } from './UIManager.js';
import { AnimationManager } from './AnimationManager.js';
import { PhaserScene, PhaserGame, PhaserSprite } from './types.js';

declare const Phaser: any;

if (typeof Phaser === 'undefined') {
    throw new Error('Phaser.js is required but not found.');
}

export class Game {
    // ==================================================================================
    // PROPERTIES
    // ==================================================================================

    // Services
    private readonly spriteSheetUrl: string;
    private readonly apiService: APIService;
    private readonly assetStorage: AssetStorage;

    // Phaser
    public game: PhaserGame | null = null;
    private currentScene: PhaserScene | null = null;

    // Managers
    private stateManager: GameStateManager;
    private playerController: PlayerController | null = null;
    private levelManager: LevelManager | null = null;
    private backgroundManager: BackgroundManager | null = null;
    private uiManager: UIManager | null = null;
    private animationManager: AnimationManager | null = null;
    private enemyManager: EnemyManager | null = null;

    // State flags
    private isCreating: boolean = true;
    private isDestroyed: boolean = false;

    // Public reference
    public gameInstance: Game;

    // ==================================================================================
    // CONSTRUCTOR
    // ==================================================================================

    constructor(
        spriteSheetUrl: string,
        apiService: APIService,
        assetStorage: AssetStorage,
        _initialLevelImage: string | null = null
    ) {
        if (!spriteSheetUrl || spriteSheetUrl.length < 100) {
            throw new Error('Invalid sprite sheet URL provided to Game constructor');
        }

        this.spriteSheetUrl = spriteSheetUrl;
        this.apiService = apiService;
        this.assetStorage = assetStorage;
        this.gameInstance = this;
        this.isCreating = true;
        this.isDestroyed = false;

        // Initialize state manager with callbacks
        this.stateManager = new GameStateManager({
            onScoreChange: (score) => this.uiManager?.updateScore(score),
            onLivesChange: (lives) => this.uiManager?.updateLives(lives),
            onLevelChange: (level) => this.uiManager?.updateLevel(level),
            onGameOver: (score) => this.handleGameOver(score),
            onWin: (score) => this.handleWin(score),
        });

        this.initializePhaser();
    }

    // ==================================================================================
    // PHASER INITIALIZATION
    // ==================================================================================

    private initializePhaser(): void {
        // Use arrow functions to properly capture 'this' and receive 'scene' from Phaser
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
                preload: function(this: PhaserScene) {
                    gameInstance.preload(this);
                },
                create: function(this: PhaserScene) {
                    gameInstance.create(this);
                },
                update: function(this: PhaserScene) {
                    gameInstance.update(this);
                },
            },
            pixelArt: true,
            backgroundColor: '#87CEEB',
        };

        this.game = new Phaser.Game(config);
    }

    // ==================================================================================
    // PHASER LIFECYCLE
    // ==================================================================================

    private preload(scene: PhaserScene): void {
        if (this.isDestroyed) return;

        console.log('Game: Preload started');
        this.currentScene = scene;

        try {
            scene.load.image('player', this.spriteSheetUrl);

            scene.load.on('complete', () => {
                if (!this.isDestroyed) {
                    console.log('Game: Asset loading complete');
                }
            });

            scene.load.on('loaderror', (file: { key: string }) => {
                if (file.key === 'player' && !this.isDestroyed) {
                    this.handleCriticalError('Player sprite failed to load');
                }
            });
        } catch (error) {
            this.handleCriticalError(error instanceof Error ? error.message : 'Preload error');
        }
    }

    private async create(scene: PhaserScene): Promise<void> {
        if (this.isDestroyed) return;

        // CRITICAL: Set creating flag immediately
        this.isCreating = true;
        this.currentScene = scene;

        try {
            console.log('Game: Create started');

            // Validate scene is ready
            if (!scene || !scene.textures || !scene.physics) {
                throw new Error('Scene not fully initialized');
            }

            // Initialize managers with the scene
            this.uiManager = new UIManager(scene);
            this.animationManager = new AnimationManager(scene);
            this.backgroundManager = new BackgroundManager(scene, this.assetStorage);
            this.levelManager = new LevelManager(scene);
            this.playerController = new PlayerController(scene);

            // Load background
            await this.backgroundManager.load();
            if (this.isDestroyed) return;

            // Setup player
            await this.playerController.setupSprite(this.spriteSheetUrl);
            if (this.isDestroyed) return;

            // Create level
            const currentLevel = this.stateManager.getLevel();
            console.log('Creating initial level:', currentLevel);
            this.levelManager.createLevel(currentLevel);

            // Setup player physics and input
            this.playerController.setupPhysics(this.levelManager.getPlatforms());
            this.playerController.setupInput();

            // Create animations
            this.animationManager.createPlayerAnimations();

            // Setup collectible collision
            const player = this.playerController.getSprite();
            if (player) {
                this.levelManager.setupPlayerCollision(player, this.handleCollectItem);
            }

            // Initialize enemies
            await this.initializeEnemies(scene);
            if (this.isDestroyed) return;

            // Setup camera
            this.setupCamera(scene);

            // Setup pause
            scene.input.keyboard.on('keydown-ESC', () => this.togglePause());

            // Initial UI update
            const state = this.stateManager.getState();
            this.uiManager.updateAll(state.score, state.level, state.lives);

            // Play idle animation
            player?.play('idle');

            console.log('Game: Create finished successfully');

        } catch (error) {
            if (!this.isDestroyed) {
                this.handleCriticalError(error instanceof Error ? error.message : 'Create error');
            }
        } finally {
            // CRITICAL: Only allow update() to run after create() is fully complete
            this.isCreating = false;
        }
    }

    private update(scene: PhaserScene): void {
        // Guard clauses - don't run update if not ready
        if (this.isDestroyed) return;
        if (this.isCreating) return;
        if (!this.currentScene) return;
        if (this.stateManager.isGameOver()) return;
        if (this.stateManager.isPaused()) return;

        // Additional safety check
        if (!this.levelManager || !this.playerController) return;

        // Update player
        this.playerController.update();

        // Update enemies
        try {
            this.enemyManager?.update();
        } catch (e) {
            // Silently handle enemy update errors
        }

        // Check if player fell off world
        if (this.playerController.isFallenOffWorld()) {
            this.handlePlayerDamage();
            return;
        }

        // Check level complete condition
        this.checkLevelComplete();
    }

    // ==================================================================================
    // LEVEL MANAGEMENT
    // ==================================================================================

    private checkLevelComplete(): void {
        if (this.isCreating || this.isDestroyed) return;

        const collectiblesLeft = this.levelManager?.getActiveCollectibleCount() ?? -1;
        const enemiesLeft = this.enemyManager?.getActiveCount() ?? -1;

        // Only advance if we have valid counts (not default -1)
        if (collectiblesLeft === 0 && enemiesLeft === 0) {
            this.advanceLevel();
        }
    }

    private advanceLevel(): void {
        if (this.stateManager.isGameOver()) return;
        if (this.isCreating) return;
        if (this.isDestroyed) return;

        const canContinue = this.stateManager.nextLevel();
        if (!canContinue) return;

        this.stateManager.setPaused(true);

        this.uiManager?.showLevelTransition(this.stateManager.getLevel(), async () => {
            if (this.isDestroyed) return;

            this.stateManager.setPaused(false);

            // Clear and recreate level
            this.enemyManager?.clearAll();
            this.levelManager?.createLevel(this.stateManager.getLevel());

            // Reset player
            this.playerController?.resetPosition();

            // Setup collisions
            const player = this.playerController?.getSprite();
            if (player) {
                this.levelManager?.setupPlayerCollision(player, this.handleCollectItem);
            }

            // Spawn enemies
            try {
                await this.enemyManager?.preloadSprites(this.stateManager.getLevel(), true);
                this.enemyManager?.spawnLevel(this.stateManager.getLevel());
                if (player) {
                    this.enemyManager?.setPlayer(player);
                }
            } catch (e) {
                console.warn('Failed to load enemies for new level:', e);
            }
        });
    }

    // ==================================================================================
    // ENEMY MANAGEMENT
    // ==================================================================================

    private async initializeEnemies(scene: PhaserScene): Promise<void> {
        this.enemyManager = new EnemyManager(scene, this.apiService);

        this.enemyManager.setCallbacks({
            onEnemyKilled: (enemy: Enemy) => this.onEnemyKilled(enemy),
            onPlayerHit: (enemy: Enemy) => this.onPlayerHit(enemy),
        });

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
        } catch (e) {
            console.warn('Enemy loading issue:', e);
        }
    }

    // ==================================================================================
    // CAMERA SETUP
    // ==================================================================================

    private setupCamera(scene: PhaserScene): void {
        const worldWidth = CONFIG.GAME_WIDTH * 3;

        scene.cameras.main.setBounds(0, 0, worldWidth, CONFIG.GAME_HEIGHT);
        scene.physics.world.setBounds(0, 0, worldWidth, CONFIG.GAME_HEIGHT, true, true, true, true);

        const player = this.playerController?.getSprite();
        if (player) {
            scene.cameras.main.startFollow(player, true, 0.1, 0.1);
        }
    }

    // ==================================================================================
    // GAME EVENTS (Arrow functions to preserve 'this' context)
    // ==================================================================================

    private handleCollectItem = (_player: PhaserSprite, item: PhaserSprite): void => {
        if (this.isDestroyed) return;

        item.disableBody(true, true);
        this.stateManager.addScore(10);
        this.uiManager?.createScorePopup(item.x, item.y, '+10');
    };

    private onEnemyKilled(enemy: Enemy): void {
        if (this.isDestroyed) return;

        const scoreValue = enemy.getScoreValue();
        this.stateManager.addScore(scoreValue);

        this.uiManager?.createScorePopup(
            enemy.sprite?.x || 0,
            enemy.sprite?.y || 0,
            `+${scoreValue}`
        );

        // Camera shake based on enemy type
        const shakeIntensity = enemy.type === 'mailman' ? 0.03 : 0.005;
        const shakeDuration = enemy.type === 'mailman' ? 400 : 100;
        this.currentScene?.cameras.main.shake(shakeDuration, shakeIntensity);
    }

    private onPlayerHit(enemy: Enemy): void {
        if (this.isDestroyed) return;

        if (!this.playerController?.isInvulnerable()) {
            this.handlePlayerDamage(enemy.config.damage);
        }
    }

    private handlePlayerDamage(damage: number = 1): void {
        if (this.isDestroyed) return;

        this.playerController?.resetPosition();
        this.playerController?.takeDamage();
        this.currentScene?.cameras.main.shake(300, 0.02);

        this.stateManager.loseLife(damage);
    }

    // ==================================================================================
    // GAME STATE HANDLERS
    // ==================================================================================

    private handleGameOver(score: number): void {
        if (this.isDestroyed) return;

        this.currentScene?.physics.pause();
        this.uiManager?.showGameOver(score, () => this.restartGame());
    }

    private handleWin(score: number): void {
        if (this.isDestroyed) return;

        this.currentScene?.physics.pause();
        this.uiManager?.showWin(score, () => this.restartGame());
    }

    public togglePause(): void {
        if (this.isDestroyed) return;
        if (this.stateManager.isGameOver()) return;

        const isPaused = this.stateManager.togglePause();

        if (isPaused) {
            this.currentScene?.physics.pause();
            this.uiManager?.showPauseMenu(
                () => this.togglePause(),
                () => this.restartGame()
            );
        } else {
            this.currentScene?.physics.resume();
            this.uiManager?.hidePauseMenu();
        }

        this.uiManager?.updatePauseButton(isPaused);
    }

    public restartGame(): void {
        this.destroy();
        this.uiManager?.removeAllOverlays();

        // Use characterManager's returnToMenu if available
        const cm = (window as any).characterManager;
        if (cm?.returnToMenu) {
            cm.returnToMenu();
        } else {
            document.getElementById('menu-screen')?.classList.remove('hidden');
            document.getElementById('game-screen')?.classList.add('hidden');
        }
    }

    // ==================================================================================
    // ERROR HANDLING
    // ==================================================================================

    private handleCriticalError(message: string): void {
        if (this.isDestroyed) return;

        console.error('CRITICAL ERROR:', message);

        // Set flags to stop all processing
        this.isCreating = true; // Prevent update from running
        this.isDestroyed = true;

        errorHandler.createError(
            ErrorType.ASSET_LOAD_ERROR,
            message,
            { operation: 'game', module: 'Game' }
        );

        this.uiManager?.showCriticalError(
            message,
            () => {
                this.destroy();
                document.getElementById('menu-screen')?.classList.remove('hidden');
                document.getElementById('game-screen')?.classList.add('hidden');
            },
            () => window.location.reload()
        );
    }

    // ==================================================================================
    // PUBLIC METHODS
    // ==================================================================================

    public updateBackground(): void {
        if (this.isDestroyed) return;
        this.backgroundManager?.refresh();
    }

    public getStateManager(): GameStateManager {
        return this.stateManager;
    }

    public isGameCreating(): boolean {
        return this.isCreating;
    }

    // ==================================================================================
    // CLEANUP
    // ==================================================================================

    public destroy(): void {
        if (this.isDestroyed) return;

        console.log('Game: Cleaning up...');

        // Set flags first to stop all processing
        this.isDestroyed = true;
        this.isCreating = true;

        // Destroy managers
        try {
            this.backgroundManager?.destroy();
        } catch (e) { /* ignore */ }

        try {
            this.enemyManager?.destroy();
        } catch (e) { /* ignore */ }

        try {
            this.levelManager?.destroy();
        } catch (e) { /* ignore */ }

        try {
            this.playerController?.destroy();
        } catch (e) { /* ignore */ }

        // Clear references
        this.backgroundManager = null;
        this.enemyManager = null;
        this.levelManager = null;
        this.playerController = null;
        this.uiManager = null;
        this.animationManager = null;
        this.currentScene = null;

        // Destroy Phaser game
        try {
            this.game?.destroy(true);
        } catch (e) { /* ignore */ }
        this.game = null;

        // Reset state
        this.stateManager.reset();

        console.log('Game: Destroyed');
    }
}

// ==================================================================================
// GLOBAL PAUSE BUTTON HANDLER
// ==================================================================================

if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        document.getElementById('pause-btn')?.addEventListener('click', () => {
            const cm = (window as any).characterManager;
            const gameInstance = cm?.currentGameInstance as Game | undefined;
            gameInstance?.togglePause();
        });
    });
}