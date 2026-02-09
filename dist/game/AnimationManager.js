export class AnimationManager {
    constructor(scene) {
        this.scene = scene;
    }
    createPlayerAnimations() {
        if (!this.scene.textures.exists('playerSprite')) {
            console.warn('Cannot create player animations: playerSprite texture not found');
            return;
        }
        const animations = [
            { key: 'walk', texture: 'playerSprite', start: 0, end: 3, frameRate: 10, repeat: -1 },
            { key: 'jump', texture: 'playerSprite', start: 8, end: 11, frameRate: 8, repeat: -1 },
            { key: 'idle', texture: 'playerSprite', start: 12, end: 15, frameRate: 6, repeat: -1 },
        ];
        this.createAnimations(animations);
    }
    createAnimations(configs) {
        for (const config of configs) {
            this.createAnimation(config);
        }
    }
    createAnimation(config) {
        if (this.scene.anims.exists(config.key)) {
            return true;
        }
        try {
            this.scene.anims.create({
                key: config.key,
                frames: this.scene.anims.generateFrameNumbers(config.texture, {
                    start: config.start,
                    end: config.end,
                }),
                frameRate: config.frameRate,
                repeat: config.repeat ?? -1,
            });
            return true;
        }
        catch (e) {
            console.warn(`Failed to create animation ${config.key}:`, e);
            return false;
        }
    }
    animationExists(key) {
        return this.scene.anims.exists(key);
    }
    removeAnimation(key) {
        if (this.scene.anims.exists(key)) {
            this.scene.anims.remove(key);
        }
    }
}
