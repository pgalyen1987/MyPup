import { CONFIG } from '../config.js';
export class BackgroundManager {
    constructor(scene, assetStorage) {
        this.backgroundTiles = [];
        this.frameTimer = null;
        this.isUpdating = false;
        this.currentFrameIndex = 0;
        this.totalFrames = 8;
        this.scene = scene;
        this.assetStorage = assetStorage;
    }
    async load() {
        const frames = await this.getFramesFromStorage();
        if (frames.length < this.totalFrames) {
            console.warn(`Not enough background frames available: ${frames.length}/${this.totalFrames}`);
            return;
        }
        console.log(`Loading ${this.totalFrames} background frames...`);
        const loadedCount = await this.loadFrameTextures(frames);
        if (loadedCount < this.totalFrames) {
            console.warn(`Only loaded ${loadedCount}/${this.totalFrames} background frames`);
        }
        this.createBackgroundTiles();
        if (this.backgroundTiles.length > 0) {
            this.startAnimation();
            console.log(`✓ Background loaded: ${this.backgroundTiles.length} tiles, ${this.totalFrames} frames`);
        }
    }
    async getFramesFromStorage() {
        let frames = [];
        try {
            const stored = await this.assetStorage.getItem('location_background_frames');
            if (stored) {
                frames = JSON.parse(stored);
            }
            if (frames.length === 0) {
                const local = localStorage.getItem('location_background_frames');
                if (local) {
                    frames = JSON.parse(local);
                }
            }
        }
        catch (e) {
            console.warn('Failed to parse background frames:', e);
        }
        return frames;
    }
    async loadFrameTextures(frames) {
        let loadedCount = 0;
        for (let i = 0; i < this.totalFrames && i < frames.length; i++) {
            const key = `bg_frame_${i}`;
            if (this.scene.textures.exists(key)) {
                loadedCount++;
                continue;
            }
            if (!frames[i]) {
                console.warn(`Background frame ${i} is empty`);
                continue;
            }
            try {
                await this.loadBase64Texture(key, frames[i]);
                loadedCount++;
            }
            catch (e) {
                console.warn(`Failed to load background frame ${i}:`, e);
            }
        }
        return loadedCount;
    }
    loadBase64Texture(key, base64) {
        return new Promise((resolve, reject) => {
            let src = base64;
            if (!src.startsWith('data:')) {
                src = `data:image/png;base64,${base64}`;
            }
            const img = new Image();
            img.onload = () => {
                try {
                    if (!this.scene.textures.exists(key)) {
                        this.scene.textures.addImage(key, img);
                    }
                    resolve();
                }
                catch (e) {
                    reject(e);
                }
            };
            img.onerror = () => {
                reject(new Error(`Failed to load texture ${key}`));
            };
            img.src = src;
        });
    }
    createBackgroundTiles() {
        this.clearTiles();
        if (!this.scene.textures.exists('bg_frame_0')) {
            console.warn('Cannot create background tiles: bg_frame_0 texture not found');
            return;
        }
        const worldWidth = CONFIG.GAME_WIDTH * 3;
        const tileWidth = CONFIG.GAME_WIDTH;
        const tileHeight = CONFIG.GAME_HEIGHT;
        const tilesNeeded = Math.ceil(worldWidth / tileWidth) + 1;
        for (let i = 0; i < tilesNeeded; i++) {
            const x = i * tileWidth + tileWidth / 2;
            const y = tileHeight / 2;
            const tile = this.scene.add.image(x, y, 'bg_frame_0');
            tile.setDisplaySize(tileWidth, tileHeight);
            tile.setDepth(CONFIG.VISUAL?.DEPTH_BACKGROUND || -100);
            tile.setScrollFactor(1, 1);
            this.scene.children.sendToBack(tile);
            this.backgroundTiles.push(tile);
        }
        this.currentFrameIndex = 0;
    }
    startAnimation() {
        this.stopAnimation();
        const fps = CONFIG.TIMING?.BACKGROUND_ANIMATION_SPEED || 2;
        const delay = 1000 / fps;
        this.frameTimer = this.scene.time.addEvent({
            delay,
            loop: true,
            callback: () => this.advanceFrame(),
        });
        console.log(`Background animation started: ${fps} fps (${delay}ms per frame)`);
    }
    stopAnimation() {
        if (this.frameTimer) {
            this.frameTimer.destroy();
            this.frameTimer = null;
        }
    }
    advanceFrame() {
        if (this.backgroundTiles.length === 0)
            return;
        this.currentFrameIndex = (this.currentFrameIndex + 1) % this.totalFrames;
        const textureKey = `bg_frame_${this.currentFrameIndex}`;
        if (!this.scene.textures.exists(textureKey)) {
            console.warn(`Background texture ${textureKey} not found, skipping`);
            return;
        }
        for (const tile of this.backgroundTiles) {
            if (tile && tile.active) {
                tile.setTexture(textureKey);
            }
        }
    }
    async refresh() {
        if (this.isUpdating)
            return;
        this.isUpdating = true;
        try {
            this.stopAnimation();
            this.clearTiles();
            await this.load();
        }
        finally {
            this.isUpdating = false;
        }
    }
    getCurrentFrame() {
        return this.currentFrameIndex;
    }
    getTileCount() {
        return this.backgroundTiles.length;
    }
    isLoaded() {
        return this.backgroundTiles.length > 0 && this.scene.textures.exists('bg_frame_0');
    }
    clearTiles() {
        for (const tile of this.backgroundTiles) {
            if (tile) {
                tile.destroy();
            }
        }
        this.backgroundTiles = [];
        this.currentFrameIndex = 0;
    }
    destroy() {
        this.stopAnimation();
        this.clearTiles();
    }
}
