/**
 * game/AnimationManager.ts
 * Handles animation creation for player and other entities
 */

import { PhaserScene } from './types.js';

interface AnimationConfig {
    key: string;
    texture: string;
    start: number;
    end: number;
    frameRate: number;
    repeat?: number;
}

export class AnimationManager {
    private scene: PhaserScene;

    constructor(scene: PhaserScene) {
        this.scene = scene;
    }

    // ==================================================================================
    // PLAYER ANIMATIONS
    // ==================================================================================

    public createPlayerAnimations(): void {
        if (!this.scene.textures.exists('playerSprite')) {
            console.warn('Cannot create player animations: playerSprite texture not found');
            return;
        }

        const animations: AnimationConfig[] = [
            { key: 'walk', texture: 'playerSprite', start: 0, end: 3, frameRate: 10, repeat: -1 },
            { key: 'jump', texture: 'playerSprite', start: 8, end: 11, frameRate: 8, repeat: -1 },
            { key: 'idle', texture: 'playerSprite', start: 12, end: 15, frameRate: 6, repeat: -1 },
        ];

        this.createAnimations(animations);
    }

    // ==================================================================================
    // GENERIC ANIMATION CREATION
    // ==================================================================================

    public createAnimations(configs: AnimationConfig[]): void {
        for (const config of configs) {
            this.createAnimation(config);
        }
    }

    public createAnimation(config: AnimationConfig): boolean {
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
        } catch (e) {
            console.warn(`Failed to create animation ${config.key}:`, e);
            return false;
        }
    }

    // ==================================================================================
    // UTILITY
    // ==================================================================================

    public animationExists(key: string): boolean {
        return this.scene.anims.exists(key);
    }

    public removeAnimation(key: string): void {
        if (this.scene.anims.exists(key)) {
            this.scene.anims.remove(key);
        }
    }
}