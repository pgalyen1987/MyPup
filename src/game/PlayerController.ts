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
    private cursors: any = null;
    private spaceKey: any = null;
    private mobileInput: MobileInput = { left: false, right: false, jump: false };
    private frameWidth: number = 0;
    private frameHeight: number = 0;
    private scaleFactor: number = 1;
    private platformCollider: any = null;
    private isDestroyed: boolean = false;

    // Animation state tracking
    private currentAnim: string = '';

    constructor(scene: PhaserScene) {
        this.scene = scene;
    }

    // ==================================================================================
    // SPRITE SETUP
    // ==================================================================================

    public async setupSprite(spriteSheetUrl: string): Promise<void> {
        if (this.scene.textures.exists('playerSprite')) {
            console.log('playerSprite texture already exists');
            this.createPlayerSprite();
            return;
        }

        // Load the image and wait for it to complete
        const image = await this.loadImageFromUrl(spriteSheetUrl);

        if (!image || image.width === 0 || image.height === 0) {
            throw new Error(`Failed to load player sprite or invalid dimensions: ${image?.width}x${image?.height}`);
        }

        console.log(`Player sprite source size: ${image.width}x${image.height}`);

        // Remove green background
        const processedImage = await this.removeLimeGreenBackground(image);

        // Calculate frame dimensions (4x4 grid)
        this.frameWidth = Math.floor(processedImage.width / 4);
        this.frameHeight = Math.floor(processedImage.height / 4);

        console.log(`Calculated frame size: ${this.frameWidth}x${this.frameHeight}`);

        if (this.frameWidth <= 0 || this.frameHeight <= 0) {
            throw new Error(`Invalid calculated sprite dimensions: ${this.frameWidth}x${this.frameHeight}`);
        }

        // Calculate scale - MAKE DOG LARGER
        // Use 2x tile size as the target, with a minimum scale
        const targetSize = CONFIG.TILE_SIZE * 2.5; // Increased from 1x to 2.5x
        this.scaleFactor = Math.max(1.5, targetSize / Math.max(this.frameWidth, this.frameHeight));

        console.log(`Scale factor: ${this.scaleFactor} (target size: ${targetSize})`);

        // Create sprite sheet in Phaser
        this.scene.textures.addSpriteSheet('playerSprite', processedImage, {
            frameWidth: this.frameWidth,
            frameHeight: this.frameHeight,
        });

        if (!this.scene.textures.exists('playerSprite')) {
            throw new Error('Failed to create playerSprite texture');
        }

        // Verify frame count
        const texture = this.scene.textures.get('playerSprite');
        console.log(`Player sprite setup complete: ${this.frameWidth}x${this.frameHeight} frames, total frames: ${texture.frameTotal}, scale: ${this.scaleFactor}`);

        // Create the actual player sprite
        this.createPlayerSprite();
    }

    /**
     * Creates the player physics sprite after texture is loaded
     */
    private createPlayerSprite(): void {
        if (this.player) {
            console.log('Player sprite already exists');
            return;
        }

        if (!this.scene.textures.exists('playerSprite')) {
            console.error('Cannot create player - texture not loaded');
            return;
        }

        // Create the physics sprite
        const startX = 100;
        const startY = CONFIG.GAME_HEIGHT - CONFIG.TILE_SIZE * 3;

        this.player = this.scene.physics.add.sprite(startX, startY, 'playerSprite', 0);

        if (!this.player) {
            throw new Error('Failed to create player sprite');
        }

        // Set origin to bottom center for platformer behavior
        this.player.setOrigin(0.5, 1);

        // Apply scale - LARGER DOG
        this.player.setScale(this.scaleFactor);

        // Set depth
        this.player.setDepth(CONFIG.VISUAL?.DEPTH_PLAYER || 100);

        // Setup physics body
        if (this.player.body) {
            // Adjust hitbox - make it proportional to the larger sprite
            const hitboxWidth = this.frameWidth * 0.5;
            const hitboxHeight = this.frameHeight * 0.85;
            this.player.body.setSize(hitboxWidth, hitboxHeight);
            this.player.body.setOffset(
                (this.frameWidth - hitboxWidth) / 2,
                this.frameHeight - hitboxHeight
            );

            // Increase gravity scale slightly for better feel with larger sprite
            this.player.body.setGravityY(100);
        }

        // Create animations for this sprite
        this.createAnimations();

        console.log(`Player sprite created at (${startX}, ${startY}) with scale ${this.scaleFactor}`);
    }

    /**
     * Creates player animations based on sprite sheet layout
     * Assumes 4x4 grid (16 frames):
     * Row 0 (0-3): Idle
     * Row 1 (4-7): Walk/Run
     * Row 2 (8-11): Jump
     * Row 3 (12-15): Special/Attack (unused for now)
     */
    private createAnimations(): void {
        if (!this.scene || !this.scene.anims) {
            console.error('Cannot create animations - scene or anims manager not available');
            return;
        }

        const texture = this.scene.textures.get('playerSprite');
        const totalFrames = texture.frameTotal - 1; // Subtract 1 because frameTotal includes base frame

        console.log(`Creating player animations with ${totalFrames} frames available`);

        // Define animation configurations
        const animations = [
            {
                key: 'idle',
                frames: totalFrames >= 4 ? { start: 0, end: 3 } : { start: 0, end: 0 },
                frameRate: 6,
                repeat: -1
            },
            {
                key: 'walk',
                frames: totalFrames >= 8 ? { start: 4, end: 7 } : { start: 0, end: Math.min(3, totalFrames) },
                frameRate: 10,
                repeat: -1
            },
            {
                key: 'jump',
                frames: totalFrames >= 12 ? { start: 8, end: 11 } : { start: 0, end: 0 },
                frameRate: 8,
                repeat: 0
            }
        ];

        for (const anim of animations) {
            // Remove existing animation if it exists
            if (this.scene.anims.exists(anim.key)) {
                this.scene.anims.remove(anim.key);
            }

            try {
                this.scene.anims.create({
                    key: anim.key,
                    frames: this.scene.anims.generateFrameNumbers('playerSprite', anim.frames),
                    frameRate: anim.frameRate,
                    repeat: anim.repeat
                });
                console.log(`Created animation '${anim.key}' with frames ${anim.frames.start}-${anim.frames.end}`);
            } catch (e) {
                console.error(`Failed to create animation '${anim.key}':`, e);
            }
        }
    }

    private loadImageFromUrl(url: string): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
            const img = new Image();

            img.onload = () => {
                if (img.width > 0 && img.height > 0) {
                    resolve(img);
                } else {
                    reject(new Error('Image loaded but has zero dimensions'));
                }
            };

            img.onerror = () => {
                reject(new Error('Failed to load player texture from URL'));
            };

            img.src = url;
        });
    }

    private async removeLimeGreenBackground(image: HTMLImageElement): Promise<HTMLImageElement> {
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

        return new Promise((resolve) => {
            const processedImg = new Image();

            processedImg.onload = () => {
                console.log(`Processed image loaded: ${processedImg.width}x${processedImg.height}`);
                resolve(processedImg);
            };

            processedImg.onerror = () => {
                console.warn('Failed to load processed image, using original');
                resolve(image);
            };

            processedImg.src = canvas.toDataURL('image/png');
        });
    }

    // ==================================================================================
    // PHYSICS SETUP
    // ==================================================================================

    public setupPhysics(platforms: PhaserGroup): void {
        if (!this.player) {
            console.warn('PlayerController.setupPhysics: No player sprite exists');
            return;
        }

        if (this.platformCollider) {
            this.platformCollider.destroy();
            this.platformCollider = null;
        }

        if (platforms) {
            this.platformCollider = this.scene.physics.add.collider(
                this.player,
                platforms
            );
        }

        this.player.setCollideWorldBounds(true);

        console.log('Player physics setup complete');
    }

    public updatePlatformCollision(newPlatforms: PhaserGroup): void {
        if (!this.player) {
            console.warn('PlayerController.updatePlatformCollision: No player sprite exists');
            return;
        }

        if (this.platformCollider) {
            this.platformCollider.destroy();
            this.platformCollider = null;
        }

        if (newPlatforms) {
            this.platformCollider = this.scene.physics.add.collider(
                this.player,
                newPlatforms
            );
            console.log('Player platform collision updated');
        }
    }

    // ==================================================================================
    // INPUT SETUP
    // ==================================================================================

    public setupInput(): void {
        if (!this.scene?.input?.keyboard) {
            console.warn('Keyboard input not available');
            return;
        }

        this.cursors = this.scene.input.keyboard.createCursorKeys();
        this.spaceKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.setupMobileControls();

        console.log('Player input setup complete');
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
        if (this.isDestroyed) return;
        if (!this.player || !this.player.body || !this.cursors) return;

        const body = this.player.body;
        const isOnGround: boolean = body.onFloor() || body.touching.down;

        this.handleMovement(isOnGround);
        this.handleAnimations(isOnGround);
    }

    private handleMovement(isOnGround: boolean): void {
        if (!this.cursors || !this.player) return;

        const mobile = this.mobileInput;
        const speed = CONFIG.PLAYER_SPEED || 250; // Slightly increased for larger sprite
        const jumpForce = CONFIG.JUMP_FORCE || -650; // Adjusted for better feel

        // Horizontal movement
        if (this.cursors.left.isDown || mobile.left) {
            this.player.setVelocityX(-speed);
            this.player.setFlipX(true);
        } else if (this.cursors.right.isDown || mobile.right) {
            this.player.setVelocityX(speed);
            this.player.setFlipX(false);
        } else {
            this.player.setVelocityX(0);
        }

        // Jump
        if ((this.cursors.up.isDown || this.spaceKey?.isDown || mobile.jump) && isOnGround) {
            this.player.setVelocityY(jumpForce);
            this.mobileInput.jump = false; // Prevent continuous jumping
        }
    }

    private handleAnimations(isOnGround: boolean): void {
        if (!this.player || !this.player.anims) return;

        const velocityX = this.player.body?.velocity?.x || 0;
        const velocityY = this.player.body?.velocity?.y || 0;

        let targetAnim = 'idle';

        // Determine which animation to play
        if (!isOnGround) {
            // In the air
            targetAnim = 'jump';
        } else if (Math.abs(velocityX) > 10) {
            // Moving horizontally on ground
            targetAnim = 'walk';
        } else {
            // Standing still on ground
            targetAnim = 'idle';
        }

        // Only change animation if it's different from current
        if (targetAnim !== this.currentAnim) {
            // Check if animation exists before playing
            if (this.scene.anims.exists(targetAnim)) {
                this.player.play(targetAnim, true);
                this.currentAnim = targetAnim;
            } else {
                console.warn(`Animation '${targetAnim}' does not exist`);
            }
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
            this.player.setPosition(100, CONFIG.GAME_HEIGHT - CONFIG.TILE_SIZE * 3);
            this.player.setVelocity(0, 0);
            this.player.clearTint();
            this.player.setAlpha(1);
            this.currentAnim = '';
        }
    }

    public takeDamage(): void {
        if (!this.player || this.isDestroyed) return;

        this.player.setTint(0xff0000);
        this.player.setData('invulnerable', true);

        // Flashing effect
        this.scene.tweens.add({
            targets: this.player,
            alpha: 0.5,
            duration: 100,
            yoyo: true,
            repeat: 7,
        });

        // Remove invulnerability after delay
        this.scene.time.delayedCall(1500, () => {
            if (this.player && !this.isDestroyed) {
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
    // CLEANUP
    // ==================================================================================

    public destroy(): void {
        if (this.isDestroyed) return;
        this.isDestroyed = true;

        console.log('PlayerController: Destroying...');

        if (this.platformCollider) {
            try {
                this.platformCollider.destroy();
            } catch (e) { /* ignore */ }
            this.platformCollider = null;
        }

        if (this.player) {
            try {
                this.player.destroy();
            } catch (e) { /* ignore */ }
            this.player = null;
        }

        this.cursors = null;
        this.spaceKey = null;
        this.mobileInput = { left: false, right: false, jump: false };
        this.currentAnim = '';

        console.log('PlayerController: Destroyed');
    }
}