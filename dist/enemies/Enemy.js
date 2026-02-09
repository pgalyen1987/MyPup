import { CONFIG } from '../config.js';
export class Enemy {
    constructor(scene, x, y, type, config) {
        this.sprite = null;
        this.state = 'idle';
        this.direction = 1;
        this.patrolTimer = 0;
        this.patrolDuration = 2000;
        this.isDestroyed = false;
        this.lastAnimKey = '';
        this.hurtTimer = null;
        this.deathTween = null;
        this.scene = scene;
        this.type = type;
        this.config = config;
        this.health = config.health;
        this.scene.events?.once('shutdown', this.onSceneShutdown, this);
        this.scene.events?.once('destroy', this.onSceneShutdown, this);
        this.createSprite(x, y);
    }
    onSceneShutdown() {
        this.destroy();
    }
    isSceneActive() {
        return (this.scene &&
            this.scene.sys &&
            this.scene.sys.isActive() &&
            !this.scene.sys.isTransitioning());
    }
    createSprite(x, y) {
        if (!this.isSceneActive()) {
            console.error('Scene is not active - cannot create enemy');
            return;
        }
        if (!this.scene.textures.exists(this.type)) {
            console.error(`Texture ${this.type} not found - cannot create enemy`);
            return;
        }
        const texture = this.scene.textures.get(this.type);
        const frameCount = texture.frameTotal;
        if (frameCount < 2) {
            console.error(`Texture ${this.type} has insufficient frames: ${frameCount}`);
            return;
        }
        this.sprite = this.scene.physics.add.sprite(x, y, this.type, 12);
        if (!this.sprite) {
            console.error(`Failed to create sprite for ${this.type}`);
            return;
        }
        this.sprite.setOrigin(0.5, 1);
        this.sprite.setDepth(CONFIG.VISUAL?.DEPTH_COLLECTIBLES_ENEMIES || 50);
        const frame = texture.get(0);
        const frameWidth = frame.width;
        const frameHeight = frame.height;
        const targetSize = this.config.isBoss ? CONFIG.TILE_SIZE * 1.5 : CONFIG.TILE_SIZE;
        const scale = targetSize / Math.max(frameWidth, frameHeight);
        this.sprite.setScale(scale);
        if (this.sprite.body) {
            if (this.config.behavior === 'fly') {
                this.sprite.body.setAllowGravity(false);
            }
            const hitboxWidth = frameWidth * 0.6;
            const hitboxHeight = frameHeight * 0.8;
            this.sprite.body.setSize(hitboxWidth, hitboxHeight);
            this.sprite.body.setOffset((frameWidth - hitboxWidth) / 2, frameHeight - hitboxHeight);
        }
        this.direction = Math.random() > 0.5 ? 1 : -1;
        this.patrolTimer = Math.random() * this.patrolDuration;
        this.state = 'idle';
        this.playAnimation('idle');
        console.log(`Created ${this.type} enemy at (${x}, ${y})`);
    }
    update(player) {
        if (this.isDestroyed || !this.sprite || !this.sprite.active)
            return;
        if (!this.isSceneActive())
            return;
        if (this.state === 'dead' || this.state === 'hurt')
            return;
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
        this.updateSpriteDirection();
    }
    behaviorPatrol() {
        if (!this.sprite || !this.isSceneActive())
            return;
        this.sprite.setVelocityX(this.config.speed * this.direction);
        this.patrolTimer += this.scene.game.loop.delta;
        if (this.patrolTimer >= this.patrolDuration) {
            this.direction *= -1;
            this.patrolTimer = 0;
        }
        if (this.sprite.body?.blocked.left) {
            this.direction = 1;
            this.patrolTimer = 0;
        }
        else if (this.sprite.body?.blocked.right) {
            this.direction = -1;
            this.patrolTimer = 0;
        }
        this.state = 'walking';
        this.playAnimation('walk');
    }
    behaviorFly() {
        if (!this.sprite || !this.isSceneActive())
            return;
        this.sprite.setVelocityX(this.config.speed * this.direction);
        const time = this.scene.time.now / 1000;
        const verticalOffset = Math.sin(time * 2) * 30;
        this.sprite.setVelocityY(verticalOffset);
        this.patrolTimer += this.scene.game.loop.delta;
        if (this.patrolTimer >= this.patrolDuration * 1.5) {
            this.direction *= -1;
            this.patrolTimer = 0;
        }
        this.state = 'walking';
        this.playAnimation('walk');
    }
    behaviorChase(player) {
        if (!this.sprite || !player || !player.active) {
            this.behaviorPatrol();
            return;
        }
        if (!this.isSceneActive())
            return;
        const distance = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, player.x, player.y);
        if (distance < 400) {
            this.direction = player.x < this.sprite.x ? -1 : 1;
            const chaseSpeed = this.config.speed * 1.3;
            this.sprite.setVelocityX(chaseSpeed * this.direction);
            this.state = 'walking';
            this.playAnimation('walk');
        }
        else {
            this.behaviorPatrol();
        }
    }
    updateSpriteDirection() {
        if (!this.sprite)
            return;
    }
    playAnimation(anim) {
        if (!this.sprite || !this.sprite.anims)
            return;
        if (!this.isSceneActive())
            return;
        let animKey;
        if (anim === 'walk') {
            animKey = this.direction > 0 ? `${this.type}_walk_right` : `${this.type}_walk_left`;
        }
        else {
            animKey = `${this.type}_${anim}`;
        }
        if (animKey !== this.lastAnimKey) {
            if (this.scene.anims?.exists(animKey)) {
                this.sprite.play(animKey, true);
                this.lastAnimKey = animKey;
            }
        }
    }
    takeDamage(amount) {
        if (this.isDestroyed || this.state === 'dead')
            return;
        if (!this.isSceneActive())
            return;
        this.health -= amount;
        if (this.health <= 0) {
            this.die();
        }
        else {
            this.state = 'hurt';
            if (this.sprite) {
                this.sprite.setTint(0xff0000);
                this.sprite.setVelocityX(0);
                if (this.hurtTimer) {
                    this.hurtTimer.remove();
                    this.hurtTimer = null;
                }
                this.hurtTimer = this.scene.time.delayedCall(200, () => {
                    this.hurtTimer = null;
                    if (this.sprite && !this.isDestroyed && this.isSceneActive()) {
                        this.sprite.clearTint();
                        this.state = 'walking';
                    }
                });
            }
        }
    }
    die() {
        if (this.isDestroyed || !this.sprite)
            return;
        this.state = 'dead';
        this.sprite.setVelocity(0, 0);
        if (this.sprite.body) {
            this.sprite.body.setAllowGravity(false);
            this.sprite.body.enable = false;
        }
        if (!this.isSceneActive()) {
            this.destroy();
            return;
        }
        this.deathTween = this.scene.tweens.add({
            targets: this.sprite,
            alpha: 0,
            y: this.sprite.y - 50,
            scaleX: 0,
            scaleY: 0,
            rotation: Math.PI,
            duration: 400,
            ease: 'Power2',
            onComplete: () => {
                this.deathTween = null;
                this.destroy();
            },
        });
    }
    isActive() {
        return !this.isDestroyed && this.state !== 'dead' && this.sprite?.active === true;
    }
    getScoreValue() {
        return this.config.scoreValue;
    }
    destroy() {
        if (this.isDestroyed)
            return;
        this.isDestroyed = true;
        if (this.scene?.events) {
            this.scene.events.off('shutdown', this.onSceneShutdown, this);
            this.scene.events.off('destroy', this.onSceneShutdown, this);
        }
        if (this.hurtTimer) {
            this.hurtTimer.remove();
            this.hurtTimer = null;
        }
        if (this.deathTween) {
            this.deathTween.stop();
            this.deathTween = null;
        }
        if (this.sprite) {
            this.sprite.destroy();
            this.sprite = null;
        }
        this.scene = null;
    }
}
