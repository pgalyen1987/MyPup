/**
 * Enemy.ts
 * Individual enemy entity with AI behavior
 */

import { CONFIG } from '../config.js';

declare const Phaser: any;

type PhaserScene = any;
type PhaserSprite = any;

// ============================================================================
// TYPES
// ============================================================================

export interface EnemyConfig {
    type: string;
    health: number;
    speed: number;
    damage: number;
    scoreValue: number;
    behavior: 'patrol' | 'fly' | 'chase';
    frameRate: number;
    isBoss?: boolean;
}

type EnemyState = 'idle' | 'walking' | 'attacking' | 'hurt' | 'dead';

// ============================================================================
// ENEMY CLASS
// ============================================================================

export class Enemy {
    public sprite: PhaserSprite | null = null;
    public type: string;
    public config: EnemyConfig;

    private scene: PhaserScene;
    private health: number;
    private state: EnemyState = 'idle';
    private direction: number = 1; // 1 = right, -1 = left
    private patrolTimer: number = 0;
    private patrolDuration: number = 2000;
    private isDestroyed: boolean = false;
    private lastAnimKey: string = '';

    constructor(
        scene: PhaserScene,
        x: number,
        y: number,
        type: string,
        config: EnemyConfig
    ) {
        this.scene = scene;
        this.type = type;
        this.config = config;
        this.health = config.health;

        this.createSprite(x, y);
    }

    // ==================================================================================
    // CREATION
    // ==================================================================================

    private createSprite(x: number, y: number): void {
        // Check if texture exists
        if (!this.scene.textures.exists(this.type)) {
            console.error(`Texture ${this.type} not found - cannot create enemy`);
            return;
        }

        // Get texture info to verify it has frames
        const texture = this.scene.textures.get(this.type);
        const frameCount = texture.frameTotal;

        if (frameCount < 2) {
            console.error(`Texture ${this.type} has insufficient frames: ${frameCount}`);
            return;
        }

        // Create the sprite
        this.sprite = this.scene.physics.add.sprite(x, y, this.type, 12); // Start with idle frame

        if (!this.sprite) {
            console.error(`Failed to create sprite for ${this.type}`);
            return;
        }

        // Basic setup
        this.sprite.setOrigin(0.5, 1);
        this.sprite.setDepth(CONFIG.VISUAL?.DEPTH_COLLECTIBLES_ENEMIES || 50);

        // Scale based on tile size
        const frame = texture.get(0);
        const frameWidth = frame.width;
        const frameHeight = frame.height;
        const targetSize = this.config.isBoss ? CONFIG.TILE_SIZE * 1.5 : CONFIG.TILE_SIZE;
        const scale = targetSize / Math.max(frameWidth, frameHeight);
        this.sprite.setScale(scale);

        // Physics setup
        if (this.sprite.body) {
            // Flying enemies don't have gravity
            if (this.config.behavior === 'fly') {
                this.sprite.body.setAllowGravity(false);
            }

            // Set hitbox
            const hitboxWidth = frameWidth * 0.6;
            const hitboxHeight = frameHeight * 0.8;
            this.sprite.body.setSize(hitboxWidth, hitboxHeight);
            this.sprite.body.setOffset(
                (frameWidth - hitboxWidth) / 2,
                frameHeight - hitboxHeight
            );
        }

        // Randomize initial direction and patrol timing
        this.direction = Math.random() > 0.5 ? 1 : -1;
        this.patrolTimer = Math.random() * this.patrolDuration;

        // Start with idle animation
        this.state = 'idle';
        this.playAnimation('idle');

        console.log(`Created ${this.type} enemy at (${x}, ${y})`);
    }

    // ==================================================================================
    // UPDATE LOOP
    // ==================================================================================

    public update(player: PhaserSprite | null): void {
        if (this.isDestroyed || !this.sprite || !this.sprite.active) return;
        if (this.state === 'dead' || this.state === 'hurt') return;

        // Execute behavior based on type
        switch (this.config.behavior) {
            case 'patrol':
                this.behaviorPatrol();
                break;
            case 'fly':
                this.behaviorFly();
                break;
            case 'chase':
                this.behaviorChase(player);
                break;
        }

        // Update sprite direction
        this.updateSpriteDirection();
    }

    private behaviorPatrol(): void {
        if (!this.sprite) return;

        // Move in current direction
        this.sprite.setVelocityX(this.config.speed * this.direction);

        // Update patrol timer
        this.patrolTimer += this.scene.game.loop.delta;

        // Change direction periodically
        if (this.patrolTimer >= this.patrolDuration) {
            this.direction *= -1;
            this.patrolTimer = 0;
        }

        // Change direction if hitting a wall
        if (this.sprite.body?.blocked.left) {
            this.direction = 1;
            this.patrolTimer = 0;
        } else if (this.sprite.body?.blocked.right) {
            this.direction = -1;
            this.patrolTimer = 0;
        }

        this.state = 'walking';
        this.playAnimation('walk');
    }

    private behaviorFly(): void {
        if (!this.sprite) return;

        // Horizontal movement
        this.sprite.setVelocityX(this.config.speed * this.direction);

        // Sinusoidal vertical movement for bobbing effect
        const time = this.scene.time.now / 1000;
        const verticalOffset = Math.sin(time * 2) * 30;
        this.sprite.setVelocityY(verticalOffset);

        // Update patrol timer for direction changes
        this.patrolTimer += this.scene.game.loop.delta;

        if (this.patrolTimer >= this.patrolDuration * 1.5) {
            this.direction *= -1;
            this.patrolTimer = 0;
        }

        this.state = 'walking';
        this.playAnimation('walk');
    }

    private behaviorChase(player: PhaserSprite | null): void {
        if (!this.sprite || !player) {
            this.behaviorPatrol();
            return;
        }

        const distance = Phaser.Math.Distance.Between(
            this.sprite.x,
            this.sprite.y,
            player.x,
            player.y
        );

        // Chase if player is within range
        if (distance < 400) {
            this.direction = player.x < this.sprite.x ? -1 : 1;

            // Move faster when chasing
            const chaseSpeed = this.config.speed * 1.3;
            this.sprite.setVelocityX(chaseSpeed * this.direction);

            this.state = 'walking';
            this.playAnimation('walk');
        } else {
            // Patrol if player is far
            this.behaviorPatrol();
        }
    }

    private updateSpriteDirection(): void {
        if (!this.sprite) return;

        // Use the walk_left / walk_right animations based on direction
        // The sprite itself doesn't need to flip since we have separate left/right animations
    }

    private playAnimation(anim: 'idle' | 'walk' | 'attack'): void {
        if (!this.sprite || !this.sprite.anims) return;

        let animKey: string;

        if (anim === 'walk') {
            // Use direction-specific walk animation
            animKey = this.direction > 0 ? `${this.type}_walk_right` : `${this.type}_walk_left`;
        } else {
            animKey = `${this.type}_${anim}`;
        }

        // Only change animation if it's different
        if (animKey !== this.lastAnimKey) {
            if (this.scene.anims.exists(animKey)) {
                this.sprite.play(animKey, true);
                this.lastAnimKey = animKey;
            }
        }
    }

    // ==================================================================================
    // DAMAGE & DEATH
    // ==================================================================================

    public takeDamage(amount: number): void {
        if (this.isDestroyed || this.state === 'dead') return;

        this.health -= amount;

        if (this.health <= 0) {
            this.die();
        } else {
            // Hurt state
            this.state = 'hurt';

            if (this.sprite) {
                this.sprite.setTint(0xff0000);
                this.sprite.setVelocityX(0);

                this.scene.time.delayedCall(200, () => {
                    if (this.sprite && !this.isDestroyed) {
                        this.sprite.clearTint();
                        this.state = 'walking';
                    }
                });
            }
        }
    }

    private die(): void {
        if (this.isDestroyed || !this.sprite) return;

        this.state = 'dead';

        // Stop movement
        this.sprite.setVelocity(0, 0);
        if (this.sprite.body) {
            this.sprite.body.setAllowGravity(false);
        }

        // Death animation
        this.scene.tweens.add({
            targets: this.sprite,
            alpha: 0,
            y: this.sprite.y - 50,
            scaleX: 0,
            scaleY: 0,
            rotation: Math.PI,
            duration: 400,
            ease: 'Power2',
            onComplete: () => {
                this.destroy();
            },
        });
    }

    // ==================================================================================
    // UTILITY METHODS
    // ==================================================================================

    public isActive(): boolean {
        return !this.isDestroyed && this.state !== 'dead' && this.sprite?.active === true;
    }

    public getScoreValue(): number {
        return this.config.scoreValue;
    }

    public destroy(): void {
        this.isDestroyed = true;

        if (this.sprite) {
            this.sprite.destroy();
            this.sprite = null;
        }
    }
}