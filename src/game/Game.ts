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

    public gameInstance: Game;

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
        const self = this;

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
                preload: function (this: PhaserScene): void { self.preload(this); },
                create: function (this: PhaserScene): void { self.create(this); },
                update: function (this: PhaserScene): void { self.update(this); },
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
        console.log('Game: Preload started');
        this.currentScene = scene;

        try {
            scene.load.image('player', this.spriteSheetUrl);

            scene.load.on('complete', () => console.log('Game: Asset loading complete'));
            scene.load.on('loaderror', (file: { key: string }) => {
                if (file.key === 'player') {
                    this.handleCriticalError('Player sprite failed to load');
                }
            });
        } catch (error) {
            this.handleCriticalError(error instanceof Error ? error.message : 'Preload error');
        }
    }

    private async create(scene: PhaserScene): Promise<void> {
        try {
            console.log('Game: Create started');
            this.currentScene = scene;

            // Initialize managers
            this.uiManager = new UIManager(scene);
            this.animationManager = new AnimationManager(scene);
            this.backgroundManager = new BackgroundManager(scene, this.assetStorage);
            this.levelManager = new LevelManager(scene);
            this.playerController = new PlayerController(scene);

            // Load background
            await this.backgroundManager.load();

            // Setup player
            await this.playerController.setupSprite(this.spriteSheetUrl);

            // Create level
            this.levelManager.createLevel(this.stateManager.getLevel());

            // Setup player physics and input
            this.playerController.setupPhysics(this.levelManager.getPlatforms());
            this.playerController.setupInput();

            // Create animations
            this.animationManager.createPlayerAnimations();

            // Setup collectible collision
            const player = this.playerController.getSprite();
            if (player) {
                this.levelManager.setupPlayerCollision(player, this.onCollectItem.bind(this));
            }

            // Initialize enemies
            await this.initializeEnemies(scene);

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
            this.handleCriticalError(error instanceof Error ? error.message : 'Create error');
        }
    }

    private update(_scene: PhaserScene): void {
        if (this.stateManager.isGameOver() || this.stateManager.isPaused()) return;

        // Update player
        this.playerController?.update();

        // Update enemies
        try {
            this.enemyManager?.update();
        } catch (e) {
            // Silently handle
        }

        // Check if fallen
        if (this.playerController?.isFallenOffWorld()) {
            this.handlePlayerDamage();
        }

        // Check level complete
        const collectiblesLeft = this.levelManager?.getActiveCollectibleCount() ?? 0;
        const enemiesLeft = this.enemyManager?.getActiveCount() ?? 0;

        if (collectiblesLeft === 0 && enemiesLeft === 0) {
            this.advanceLevel();
        }
    }

    // ==================================================================================
    // ENEMY INITIALIZATION
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
            await this.enemyManager.preloadSprites(this.stateManager.getLevel(), true);
            this.enemyManager.spawnLevel(this.stateManager.getLevel());
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
    // GAME EVENTS
    // ==================================================================================

    private onCollectItem(_player: PhaserSprite, item: PhaserSprite): void {
        item.disableBody(true, true);
        this.stateManager.addScore(10);
        this.uiManager?.createScorePopup(item.x, item.y, '+10');
    }

    private onEnemyKilled(enemy: Enemy): void {
        this.stateManager.addScore(enemy.getScoreValue());
        this.uiManager?.createScorePopup(
            enemy.sprite?.x || 0,
            enemy.sprite?.y || 0,
            `+${enemy.getScoreValue()}`
        );

        if (enemy.type === 'mailman') {
            this.currentScene?.cameras.main.shake(400, 0.03);
        } else {
            this.currentScene?.cameras.main.shake(100, 0.005);
        }
    }

    private onPlayerHit(enemy: Enemy): void {
        if (!this.playerController?.isInvulnerable()) {
            this.handlePlayerDamage(enemy.config.damage);
        }
    }

    private handlePlayerDamage(damage: number = 1): void {
        this.playerController?.resetPosition();
        this.playerController?.takeDamage();
        this.currentScene?.cameras.main.shake(300, 0.02);

        const isDead = this.stateManager.loseLife(damage);
        if (!isDead) {
            // Player still alive, continue
        }
    }

    // ==================================================================================
    // LEVEL PROGRESSION
    // ==================================================================================

    private advanceLevel(): void {
        if (this.stateManager.isGameOver()) return;

        const canContinue = this.stateManager.nextLevel();
        if (!canContinue) return; // Win condition handled by state manager

        this.stateManager.setPaused(true);

        this.uiManager?.showLevelTransition(this.stateManager.getLevel(), async () => {
            this.stateManager.setPaused(false);

            // Recreate level
            this.enemyManager?.clearAll();
            this.levelManager?.createLevel(this.stateManager.getLevel());

            // Reset player
            this.playerController?.resetPosition();

            // Setup collisions
            const player = this.playerController?.getSprite();
            if (player) {
                this.levelManager?.setupPlayerCollision(player, this.onCollectItem.bind(this));
            }

            // Spawn enemies
            try {
                await this.enemyManager?.preloadSprites(this.stateManager.getLevel(), true);
                this.enemyManager?.spawnLevel(this.stateManager.getLevel());
                if (player) {
                    this.enemyManager?.setPlayer(player);
                }
            } catch (e) {
                console.warn('Failed to load enemies:', e);
            }
        });
    }

    // ==================================================================================
    // GAME STATE HANDLERS
    // ==================================================================================

    private handleGameOver(score: number): void {
        this.currentScene?.physics.pause();
        this.uiManager?.showGameOver(score, () => this.restartGame());
    }

    private handleWin(score: number): void {
        this.currentScene?.physics.pause();
        this.uiManager?.showWin(score, () => this.restartGame());
    }

    public togglePause(): void {
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
        document.getElementById('menu-screen')?.classList.remove('hidden');
        document.getElementById('game-screen')?.classList.add('hidden');
    }

    // ==================================================================================
    // ERROR HANDLING
    // ==================================================================================

    private handleCriticalError(message: string): void {
        console.error('CRITICAL ERROR:', message);

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
        this.backgroundManager?.refresh();
    }

    // ==================================================================================
    // CLEANUP
    // ==================================================================================

    public destroy(): void {
        console.log('Game: Cleaning up...');

        this.backgroundManager?.destroy();
        this.enemyManager?.destroy();
        this.levelManager?.destroy();
        this.playerController?.destroy();

        this.backgroundManager = null;
        this.enemyManager = null;
        this.levelManager = null;
        this.playerController = null;
        this.uiManager = null;
        this.animationManager = null;
        this.currentScene = null;

        this.game?.destroy(true);
        this.game = null;

        this.stateManager.reset();

        console.log('Game: Destroyed');
    }
}

// ==================================================================================
// GLOBAL PAUSE BUTTON
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