/**
 * game/PlayerController.ts
 * Handles player creation, physics, input, and animations
 */

import { CONFIG } from '../config.js';
import { PhaserScene, PhaserSprite, PhaserGroup, MobileInput } from './types.js';

declare const Phaser: any;

export class PlayerController {
    private scene: PhaserScene;
    private player: PhaserSprite | null = null;
    private cursors: any | null = null;
    private spaceKey: any | null = null;
    private mobileInput: MobileInput = { left: false, right: false, jump: false };
    private frameWidth: number = 0;
    private frameHeight: number = 0;
    private scaleFactor: number = 1;

    constructor(scene: PhaserScene) {
        this.scene = scene;
    }

    // ==================================================================================
    // SPRITE SETUP
    // ==================================================================================

    public async setupSprite(spriteSheetUrl: string): Promise<void> {
        if (this.scene.textures.exists('playerSprite')) {
            console.log('playerSprite texture already exists');
            return;
        }

        // Load the image and wait for it to complete
        const image = await this.loadImageFromUrl(spriteSheetUrl);

        if (!image || image.width === 0 || image.height === 0) {
            throw new Error(`Failed to load player sprite or invalid dimensions: ${image?.width}x${image?.height}`);
        }

        console.log(`Player sprite source size: ${image.width}x${image.height}`);

        // Remove green background
        const processedImage = this.removeLimeGreenBackground(image);

        // Calculate frame dimensions (4x4 grid)
        this.frameWidth = Math.floor(processedImage.width / 4);
        this.frameHeight = Math.floor(processedImage.height / 4);

        console.log(`Calculated frame size: ${this.frameWidth}x${this.frameHeight}`);

        if (this.frameWidth <= 0 || this.frameHeight <= 0) {
            throw new Error(`Invalid calculated sprite dimensions: ${this.frameWidth}x${this.frameHeight}`);
        }

        // Calculate scale
        const targetSize = CONFIG.TILE_SIZE;
        this.scaleFactor = targetSize / Math.max(this.frameWidth, this.frameHeight);

        // Create sprite sheet in Phaser
        this.scene.textures.addSpriteSheet('playerSprite', processedImage, {
            frameWidth: this.frameWidth,
            frameHeight: this.frameHeight,
        });

        if (!this.scene.textures.exists('playerSprite')) {
            throw new Error('Failed to create playerSprite texture');
        }

        console.log(`Player sprite setup complete: ${this.frameWidth}x${this.frameHeight} frames, scale: ${this.scaleFactor}`);
    }

    private loadImageFromUrl(url: string): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
            const img = new Image();

            img.onload = () => {
                // Double-check dimensions after load
                if (img.width > 0 && img.height > 0) {
                    resolve(img);
                } else {
                    reject(new Error('Image loaded but has zero dimensions'));
                }
            };

            img.onerror = () => {
                reject(new Error('Failed to load player texture from URL'));
            };

            // Handle data URLs and regular URLs
            img.src = url;
        });
    }

    // ==================================================================================
    // PHYSICS SETUP
    // ==================================================================================

    public setupPhysics(platforms: PhaserGroup | null): void {
        if (!this.scene.textures.exists('playerSprite')) {
            throw new Error('playerSprite texture missing - cannot create player');
        }

        const floorY = CONFIG.GAME_HEIGHT - CONFIG.TILE_SIZE;
        const playerY = floorY - CONFIG.TILE_SIZE;

        this.player = this.scene.physics.add.sprite(100, playerY, 'playerSprite', 0);

        if (!this.player) {
            throw new Error('Failed to create player sprite');
        }

        this.player.setBounce(CONFIG.PHYSICS?.PLAYER_BOUNCE || 0.1);
        this.player.setCollideWorldBounds(true);
        this.player.setOrigin(0.5, 1.0);
        this.player.setDepth(CONFIG.VISUAL?.DEPTH_PLAYER || 100);
        this.player.setDragX(CONFIG.PHYSICS?.PLAYER_DRAG_X || 100);

        // Apply scaling
        const baseScale = CONFIG.VISUAL?.PLAYER_SCALE_DEFAULT || 1.5;
        this.player.setScale(this.scaleFactor * baseScale);

        // Setup physics body
        if (this.player.body) {
            const bodyWidth = CONFIG.TILE_SIZE * 0.6;
            const bodyHeight = CONFIG.TILE_SIZE * 0.9;
            this.player.body.setSize(bodyWidth, bodyHeight);
            this.player.body.setOffset(
                (this.frameWidth - bodyWidth) / 2,
                this.frameHeight - bodyHeight
            );
        }

        // Add collision with platforms
        if (platforms && platforms.children.size > 0) {
            this.scene.physics.add.collider(this.player, platforms);
        }

        console.log('Player physics setup complete');
    }

    // ==================================================================================
    // INPUT SETUP
    // ==================================================================================

    public setupInput(): void {
        this.cursors = this.scene.input.keyboard.createCursorKeys();
        this.spaceKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.setupMobileControls();
    }

    private setupMobileControls(): void {
        const addTouchListeners = (elementId: string, inputKey: keyof MobileInput): void => {
            const element = document.getElementById(elementId);
            if (!element) return;

            element.addEventListener('touchstart', (e: TouchEvent) => {
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

        addTouchListeners('mobile-left', 'left');
        addTouchListeners('mobile-right', 'right');
        addTouchListeners('mobile-jump', 'jump');
    }

    // ==================================================================================
    // UPDATE
    // ==================================================================================

    public update(): void {
        if (!this.player || !this.player.body || !this.cursors) return;

        const body = this.player.body;
        const isOnGround: boolean = body.onFloor() || body.touching.down;

        this.handleInput(isOnGround);
    }

    private handleInput(isOnGround: boolean): void {
        if (!this.cursors || !this.player) return;

        const mobile = this.mobileInput;
        const speed = CONFIG.PLAYER_SPEED || 200;
        const jumpForce = CONFIG.JUMP_FORCE || -400;

        // Horizontal movement
        if (this.cursors.left.isDown || mobile.left) {
            this.player.setVelocityX(-speed);
            this.player.setFlipX(true);
            if (isOnGround && this.player.anims) {
                this.player.play('walk', true);
            }
        } else if (this.cursors.right.isDown || mobile.right) {
            this.player.setVelocityX(speed);
            this.player.setFlipX(false);
            if (isOnGround && this.player.anims) {
                this.player.play('walk', true);
            }
        } else {
            this.player.setVelocityX(0);
            if (isOnGround && this.player.anims) {
                this.player.play('idle', true);
            }
        }

        // Jump
        if ((this.cursors.up.isDown || this.spaceKey?.isDown || mobile.jump) && isOnGround) {
            this.player.setVelocityY(jumpForce);
            if (this.player.anims) {
                this.player.play('jump', true);
            }
            this.mobileInput.jump = false;
        }

        // Air animation
        if (!isOnGround && this.player.anims && !this.player.anims.isPlaying) {
            this.player.play('jump', true);
        }
    }

    // ==================================================================================
    // PLAYER ACTIONS
    // ==================================================================================

    public getSprite(): PhaserSprite | null {
        return this.player;
    }

    public resetPosition(): void {
        if (this.player) {
            this.player.setPosition(100, CONFIG.GAME_HEIGHT - CONFIG.TILE_SIZE * 2);
            this.player.setVelocity(0, 0);
        }
    }

    public takeDamage(): void {
        if (!this.player) return;

        this.player.setTint(0xff0000);
        this.player.setData('invulnerable', true);

        this.scene.tweens.add({
            targets: this.player,
            alpha: 0.5,
            duration: 100,
            yoyo: true,
            repeat: 7,
        });

        this.scene.time.delayedCall(1500, () => {
            if (this.player) {
                this.player.clearTint();
                this.player.setAlpha(1);
                this.player.setData('invulnerable', false);
            }
        });
    }

    public isInvulnerable(): boolean {
        return this.player?.getData('invulnerable') === true;
    }

    public isFallenOffWorld(): boolean {
        return this.player ? this.player.y > CONFIG.GAME_HEIGHT + 100 : false;
    }

    // ==================================================================================
    // UTILITIES
    // ==================================================================================

    private removeLimeGreenBackground(image: HTMLImageElement): HTMLImageElement {
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');

        if (!ctx) return image;

        ctx.drawImage(image, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            // Remove lime green and similar green backgrounds
            if (g > 150 && g > r * 1.2 && g > b * 1.2) {
                data[i + 3] = 0;
            }
        }

        ctx.putImageData(imgData, 0, 0);

        const processedImg = new Image();
        processedImg.src = canvas.toDataURL('image/png');

        return processedImg;
    }

    public destroy(): void {
        this.player = null;
        this.cursors = null;
        this.spaceKey = null;
    }
}