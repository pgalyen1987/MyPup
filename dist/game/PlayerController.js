import { CONFIG } from '../config.js';
export class PlayerController {
    constructor(scene) {
        this.player = null;
        this.cursors = null;
        this.spaceKey = null;
        this.mobileInput = { left: false, right: false, jump: false };
        this.frameWidth = 0;
        this.frameHeight = 0;
        this.scaleFactor = 1;
        this.platformCollider = null;
        this.isDestroyed = false;
        this.currentAnim = '';
        this.scene = scene;
    }
    async setupSprite(spriteSheetUrl) {
        if (this.scene.textures.exists('playerSprite')) {
            console.log('playerSprite texture already exists');
            this.createPlayerSprite();
            return;
        }
        const image = await this.loadImageFromUrl(spriteSheetUrl);
        if (!image || image.width === 0 || image.height === 0) {
            throw new Error(`Failed to load player sprite or invalid dimensions: ${image?.width}x${image?.height}`);
        }
        console.log(`Player sprite source size: ${image.width}x${image.height}`);
        const processedImage = await this.removeLimeGreenBackground(image);
        this.frameWidth = Math.floor(processedImage.width / 4);
        this.frameHeight = Math.floor(processedImage.height / 4);
        console.log(`Calculated frame size: ${this.frameWidth}x${this.frameHeight}`);
        if (this.frameWidth <= 0 || this.frameHeight <= 0) {
            throw new Error(`Invalid calculated sprite dimensions: ${this.frameWidth}x${this.frameHeight}`);
        }
        const targetSize = CONFIG.TILE_SIZE * 2.5;
        this.scaleFactor = Math.max(1.5, targetSize / Math.max(this.frameWidth, this.frameHeight));
        console.log(`Scale factor: ${this.scaleFactor} (target size: ${targetSize})`);
        this.scene.textures.addSpriteSheet('playerSprite', processedImage, {
            frameWidth: this.frameWidth,
            frameHeight: this.frameHeight,
        });
        if (!this.scene.textures.exists('playerSprite')) {
            throw new Error('Failed to create playerSprite texture');
        }
        const texture = this.scene.textures.get('playerSprite');
        console.log(`Player sprite setup complete: ${this.frameWidth}x${this.frameHeight} frames, total frames: ${texture.frameTotal}, scale: ${this.scaleFactor}`);
        this.createPlayerSprite();
    }
    createPlayerSprite() {
        if (this.player) {
            console.log('Player sprite already exists');
            return;
        }
        if (!this.scene.textures.exists('playerSprite')) {
            console.error('Cannot create player - texture not loaded');
            return;
        }
        const startX = 100;
        const startY = CONFIG.GAME_HEIGHT - CONFIG.TILE_SIZE * 3;
        this.player = this.scene.physics.add.sprite(startX, startY, 'playerSprite', 0);
        if (!this.player) {
            throw new Error('Failed to create player sprite');
        }
        this.player.setOrigin(0.5, 1);
        this.player.setScale(this.scaleFactor);
        this.player.setDepth(CONFIG.VISUAL?.DEPTH_PLAYER || 100);
        if (this.player.body) {
            const hitboxWidth = this.frameWidth * 0.5;
            const hitboxHeight = this.frameHeight * 0.85;
            this.player.body.setSize(hitboxWidth, hitboxHeight);
            this.player.body.setOffset((this.frameWidth - hitboxWidth) / 2, this.frameHeight - hitboxHeight);
            this.player.body.setGravityY(100);
        }
        this.createAnimations();
        console.log(`Player sprite created at (${startX}, ${startY}) with scale ${this.scaleFactor}`);
    }
    createAnimations() {
        if (!this.scene || !this.scene.anims) {
            console.error('Cannot create animations - scene or anims manager not available');
            return;
        }
        const texture = this.scene.textures.get('playerSprite');
        const totalFrames = texture.frameTotal - 1;
        console.log(`Creating player animations with ${totalFrames} frames available`);
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
            }
            catch (e) {
                console.error(`Failed to create animation '${anim.key}':`, e);
            }
        }
    }
    loadImageFromUrl(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                if (img.width > 0 && img.height > 0) {
                    resolve(img);
                }
                else {
                    reject(new Error('Image loaded but has zero dimensions'));
                }
            };
            img.onerror = () => {
                reject(new Error('Failed to load player texture from URL'));
            };
            img.src = url;
        });
    }
    async removeLimeGreenBackground(image) {
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
    setupPhysics(platforms) {
        if (!this.player) {
            console.warn('PlayerController.setupPhysics: No player sprite exists');
            return;
        }
        if (this.platformCollider) {
            this.platformCollider.destroy();
            this.platformCollider = null;
        }
        if (platforms) {
            this.platformCollider = this.scene.physics.add.collider(this.player, platforms);
        }
        this.player.setCollideWorldBounds(true);
        console.log('Player physics setup complete');
    }
    updatePlatformCollision(newPlatforms) {
        if (!this.player) {
            console.warn('PlayerController.updatePlatformCollision: No player sprite exists');
            return;
        }
        if (this.platformCollider) {
            this.platformCollider.destroy();
            this.platformCollider = null;
        }
        if (newPlatforms) {
            this.platformCollider = this.scene.physics.add.collider(this.player, newPlatforms);
            console.log('Player platform collision updated');
        }
    }
    setupInput() {
        if (!this.scene?.input?.keyboard) {
            console.warn('Keyboard input not available');
            return;
        }
        this.cursors = this.scene.input.keyboard.createCursorKeys();
        this.spaceKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.setupMobileControls();
        console.log('Player input setup complete');
    }
    setupMobileControls() {
        const addTouchListeners = (elementId, inputKey) => {
            const element = document.getElementById(elementId);
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
        addTouchListeners('mobile-left', 'left');
        addTouchListeners('mobile-right', 'right');
        addTouchListeners('mobile-jump', 'jump');
    }
    update() {
        if (this.isDestroyed)
            return;
        if (!this.player || !this.player.body || !this.cursors)
            return;
        const body = this.player.body;
        const isOnGround = body.onFloor() || body.touching.down;
        this.handleMovement(isOnGround);
        this.handleAnimations(isOnGround);
    }
    handleMovement(isOnGround) {
        if (!this.cursors || !this.player)
            return;
        const mobile = this.mobileInput;
        const speed = CONFIG.PLAYER_SPEED || 250;
        const jumpForce = CONFIG.JUMP_FORCE || -650;
        if (this.cursors.left.isDown || mobile.left) {
            this.player.setVelocityX(-speed);
            this.player.setFlipX(true);
        }
        else if (this.cursors.right.isDown || mobile.right) {
            this.player.setVelocityX(speed);
            this.player.setFlipX(false);
        }
        else {
            this.player.setVelocityX(0);
        }
        if ((this.cursors.up.isDown || this.spaceKey?.isDown || mobile.jump) && isOnGround) {
            this.player.setVelocityY(jumpForce);
            this.mobileInput.jump = false;
        }
    }
    handleAnimations(isOnGround) {
        if (!this.player || !this.player.anims)
            return;
        const velocityX = this.player.body?.velocity?.x || 0;
        const velocityY = this.player.body?.velocity?.y || 0;
        let targetAnim = 'idle';
        if (!isOnGround) {
            targetAnim = 'jump';
        }
        else if (Math.abs(velocityX) > 10) {
            targetAnim = 'walk';
        }
        else {
            targetAnim = 'idle';
        }
        if (targetAnim !== this.currentAnim) {
            if (this.scene.anims.exists(targetAnim)) {
                this.player.play(targetAnim, true);
                this.currentAnim = targetAnim;
            }
            else {
                console.warn(`Animation '${targetAnim}' does not exist`);
            }
        }
    }
    getSprite() {
        return this.player;
    }
    resetPosition() {
        if (this.player) {
            this.player.setPosition(100, CONFIG.GAME_HEIGHT - CONFIG.TILE_SIZE * 3);
            this.player.setVelocity(0, 0);
            this.player.clearTint();
            this.player.setAlpha(1);
            this.currentAnim = '';
        }
    }
    takeDamage() {
        if (!this.player || this.isDestroyed)
            return;
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
            if (this.player && !this.isDestroyed) {
                this.player.clearTint();
                this.player.setAlpha(1);
                this.player.setData('invulnerable', false);
            }
        });
    }
    isInvulnerable() {
        return this.player?.getData('invulnerable') === true;
    }
    isFallenOffWorld() {
        return this.player ? this.player.y > CONFIG.GAME_HEIGHT + 100 : false;
    }
    destroy() {
        if (this.isDestroyed)
            return;
        this.isDestroyed = true;
        console.log('PlayerController: Destroying...');
        if (this.platformCollider) {
            try {
                this.platformCollider.destroy();
            }
            catch (e) { }
            this.platformCollider = null;
        }
        if (this.player) {
            try {
                this.player.destroy();
            }
            catch (e) { }
            this.player = null;
        }
        this.cursors = null;
        this.spaceKey = null;
        this.mobileInput = { left: false, right: false, jump: false };
        this.currentAnim = '';
        console.log('PlayerController: Destroyed');
    }
}
