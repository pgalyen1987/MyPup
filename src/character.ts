/**
 * character.ts
 * Manages character customization, image uploading, sprite generation via Gemini,
 * and game state initialization.
 */

import type { APIService } from './api/api.js';
import type { AssetStorage } from './AssetStorage.js';
import { Game } from './game/Game.js';
import { CONFIG } from './config.js';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface RetryConfig {
    readonly MAX_ATTEMPTS: number;
    readonly INITIAL_DELAY_MS: number;
    readonly MAX_DELAY_MS: number;
    readonly BACKOFF_MULTIPLIER: number;
}

interface ReadyState {
    sprite: boolean;
    background: boolean;
    canStart: boolean;
}

type GameClass = typeof Game;

if (window.updateDebugIndicators) {
    window.updateDebugIndicators();
}

// ============================================================================
// CONSTANTS
// ============================================================================

const RETRY_CONFIG: RetryConfig = {
    MAX_ATTEMPTS: 5,
    INITIAL_DELAY_MS: 2000,
    MAX_DELAY_MS: 30000,
    BACKOFF_MULTIPLIER: 2,
} as const;

const BACKGROUND_POLL_CONFIG = {
    MAX_ATTEMPTS: 60,
    INTERVAL_MS: 5000,
    MIN_FRAMES_REQUIRED: 8,
} as const;

// ============================================================================
// CHARACTER MANAGER CLASS
// ============================================================================

export class CharacterManager {
    private readonly apiService: APIService;
    private readonly assetStorage: AssetStorage;
    private readonly gameClass: GameClass;

    // State
    public currentGameInstance: Game | null = null;
    private currentSpriteSheet: string | null = null;
    private uploadedImage: string | null = null;

    // Ready state tracking
    private spriteReady: boolean = false;
    private backgroundReady: boolean = false;
    private isGeneratingSprite: boolean = false;
    private isCheckingBackground: boolean = false;

    constructor(
        apiService: APIService,
        assetStorage: AssetStorage,
        gameClass: GameClass
    ) {
        this.apiService = apiService;
        this.assetStorage = assetStorage;
        this.gameClass = gameClass;
        this.setupEventListeners();
    }

    // ==================================================================================
    // INITIALIZATION
    // ==================================================================================

    private setupEventListeners(): void {
        const uploadInput = document.getElementById('dog-image-upload') as HTMLInputElement | null;
        const startBtn = document.getElementById('start-game-btn') as HTMLButtonElement | null;

        if (uploadInput) {
            uploadInput.addEventListener('change', (e: Event) => this.handleImageUpload(e));
        }
        if (startBtn) {
            startBtn.addEventListener('click', () => this.startGame());
        }
    }

    // ==================================================================================
    // STORAGE HELPERS
    // ==================================================================================

    private async getStoredItem(key: string): Promise<string | null> {
        try {
            const asset = await this.assetStorage.getItem(key);
            if (asset) return asset;
        } catch {
            // Ignore storage errors, fall through to localStorage
        }

        return localStorage.getItem(key);
    }

    private async setStoredItem(key: string, value: string): Promise<void> {
        try {
            await this.assetStorage.setItem(key, value);
        } catch (error) {
            console.warn(`Failed to save to AssetStorage, using localStorage: ${key}`, error);
        }

        try {
            localStorage.setItem(key, value);
        } catch (error) {
            console.warn(`Failed to save to localStorage: ${key}`, error);
        }
    }

    private async removeStoredItem(key: string): Promise<void> {
        try {
            await this.assetStorage.removeItem(key);
        } catch {
            // Ignore errors
        }
        localStorage.removeItem(key);
    }

    // ==================================================================================
    // IMAGE UPLOAD & SPRITE GENERATION
    // ==================================================================================

    public async handleImageUpload(event: Event): Promise<void> {
        const target = event.target as HTMLInputElement;
        const file = target.files?.[0];

        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('Please upload an image file');
            return;
        }

        console.log('New image uploaded - clearing old sprite cache...');

        // Reset ready state
        this.spriteReady = false;
        this.currentSpriteSheet = null;
        this.updateStartButton();

        // Clear old cache
        await this.clearSpriteCache();

        // Read and process the file
        const reader = new FileReader();

        reader.onload = async (e: ProgressEvent<FileReader>) => {
            const result = e.target?.result as string;

            if (!result) {
                console.error('Failed to read uploaded file');
                return;
            }

            this.updatePreviewHTML(result, 'Dog preview');
            this.uploadedImage = result;
            await this.generateSpriteSheetWithRetry();
        };

        reader.onerror = () => {
            console.error('Error reading file');
            const statusEl = document.getElementById('generation-status');
            this.updateStatus(statusEl, '❌ Error reading file. Please try again.', '#ff6b6b');
        };

        reader.readAsDataURL(file);
    }

    public clearUploadedImage(): void {
        this.uploadedImage = null;
        this.currentSpriteSheet = null;
        this.spriteReady = false;
        this.updateStartButton();
    }

    private async clearSpriteCache(): Promise<void> {
        const keysToRemove = [
            'custom_sprite_sheet',
            'original_dog_image',
            'has_custom_character',
        ];

        for (const key of keysToRemove) {
            await this.removeStoredItem(key);
        }
    }

    public async generateSpriteSheetWithRetry(): Promise<void> {
        if (!this.uploadedImage || this.isGeneratingSprite) return;

        const statusEl = document.getElementById('generation-status');

        // Check cache first
        const isCacheValid = await this.checkSpriteCache();
        if (isCacheValid) {
            await this.checkAllAssetsReady();
            return;
        }

        this.isGeneratingSprite = true;
        let attempt = 0;
        let delay = RETRY_CONFIG.INITIAL_DELAY_MS;

        while (attempt < RETRY_CONFIG.MAX_ATTEMPTS) {
            attempt++;

            try {
                this.updateStatus(
                    statusEl,
                    `<div class="loader"></div> Generating sprite sheet... (Attempt ${attempt}/${RETRY_CONFIG.MAX_ATTEMPTS})`,
                    '#ffd700'
                );

                console.log(`Sprite generation attempt ${attempt}/${RETRY_CONFIG.MAX_ATTEMPTS}`);

                const spriteSheetUrl = await this.apiService.generateSpriteSheet(
                    'Custom dog character',
                    this.uploadedImage
                );

                // Validate the result
                if (!this.isValidSpriteSheet(spriteSheetUrl)) {
                    throw new Error('Invalid sprite sheet generated (validation failed)');
                }

                // Success!
                await this.handleSpriteGenerationSuccess(spriteSheetUrl);
                return;

            } catch (error) {
                console.error(`Sprite generation attempt ${attempt} failed:`, error);

                if (attempt < RETRY_CONFIG.MAX_ATTEMPTS) {
                    this.updateStatus(
                        statusEl,
                        `<div class="loader"></div> Generation failed. Retrying in ${Math.round(delay / 1000)}s... (Attempt ${attempt}/${RETRY_CONFIG.MAX_ATTEMPTS})`,
                        '#ff9800'
                    );

                    await this.sleep(delay);
                    delay = Math.min(delay * RETRY_CONFIG.BACKOFF_MULTIPLIER, RETRY_CONFIG.MAX_DELAY_MS);
                } else {
                    this.handleSpriteGenerationFailure(statusEl);
                }
            }
        }
    }

    private async checkSpriteCache(): Promise<boolean> {
        const savedImage = await this.getStoredItem('original_dog_image');
        const savedSprite = await this.getStoredItem('custom_sprite_sheet');

        if (this.uploadedImage === savedImage && savedSprite && this.isValidSpriteSheet(savedSprite)) {
            console.log('Using cached sprite sheet for identical image.');
            this.currentSpriteSheet = savedSprite;
            this.spriteReady = true;
            this.updatePreviewHTML(savedSprite, 'Sprite Sheet Ready!', true);
            return true;
        }

        return false;
    }

    private isValidSpriteSheet(spriteSheet: string | null): boolean {
        if (!spriteSheet) return false;
        if (spriteSheet.length < 1000) return false;
        if (!spriteSheet.startsWith('data:image/')) return false;
        return true;
    }

    private async handleSpriteGenerationSuccess(spriteSheetUrl: string): Promise<void> {
        this.currentSpriteSheet = spriteSheetUrl;
        this.spriteReady = true;
        this.isGeneratingSprite = false;

        // Cache the sprite
        await this.setStoredItem('custom_sprite_sheet', spriteSheetUrl);
        if (this.uploadedImage) {
            await this.setStoredItem('original_dog_image', this.uploadedImage);
        }
        localStorage.setItem('has_custom_character', 'true');

        this.updatePreviewHTML(spriteSheetUrl, 'Sprite Sheet Ready!', true);
        console.log('✓ Sprite sheet generated successfully');

        await this.checkAllAssetsReady();
    }

    private handleSpriteGenerationFailure(statusEl: HTMLElement | null): void {
        this.isGeneratingSprite = false;
        this.updateStatus(
            statusEl,
            `❌ Sprite generation failed after ${RETRY_CONFIG.MAX_ATTEMPTS} attempts. Please try again.`,
            '#ff6b6b'
        );
        this.addRetryButton(statusEl);
    }

    // ==================================================================================
    // ASSET READY STATE MANAGEMENT
    // ==================================================================================

    public async checkAllAssetsReady(): Promise<void> {
        const statusEl = document.getElementById('generation-status');

        // Check sprite
        if (!this.spriteReady || !this.currentSpriteSheet) {
            this.updateStatus(statusEl, '<div class="loader"></div> Waiting for sprite generation...', '#ffd700');
            this.updateStartButton();
            return;
        }

        // Check background
        await this.checkBackgroundReady();

        if (!this.backgroundReady) {
            this.updateStatus(statusEl, '<div class="loader"></div> Waiting for background generation...', '#ffd700');
            this.updateStartButton();

            // Start polling for background
            if (!this.isCheckingBackground) {
                this.pollBackgroundReady();
            }
            return;
        }

        // All assets ready!
        console.log('✓ All assets ready - game can start');
        this.updateStatus(statusEl, '✓ All assets ready! Click "Start Game" to begin.', '#4CAF50');
        this.updateStartButton();

        if (CONFIG.DEBUG_MODE) {
            await this.displayBackgroundPreview();
        }
    }

    private async checkBackgroundReady(): Promise<boolean> {
        try {
            const framesStr = await this.getStoredItem('location_background_frames');

            if (framesStr) {
                const frames: unknown = JSON.parse(framesStr);
                this.backgroundReady = Array.isArray(frames) && frames.length >= BACKGROUND_POLL_CONFIG.MIN_FRAMES_REQUIRED;
            } else {
                this.backgroundReady = false;
            }
        } catch (error) {
            console.error('Error checking background:', error);
            this.backgroundReady = false;
        }

        return this.backgroundReady;
    }

    private async pollBackgroundReady(): Promise<void> {
        if (this.isCheckingBackground) return;

        this.isCheckingBackground = true;
        let attempts = 0;

        while (attempts < BACKGROUND_POLL_CONFIG.MAX_ATTEMPTS && !this.backgroundReady) {
            attempts++;
            await this.sleep(BACKGROUND_POLL_CONFIG.INTERVAL_MS);

            const ready = await this.checkBackgroundReady();
            console.log(`Background check ${attempts}/${BACKGROUND_POLL_CONFIG.MAX_ATTEMPTS}: ${ready ? 'Ready' : 'Not ready'}`);

            if (ready) {
                this.isCheckingBackground = false;
                await this.checkAllAssetsReady();
                return;
            }
        }

        this.isCheckingBackground = false;

        if (!this.backgroundReady) {
            const statusEl = document.getElementById('generation-status');
            this.updateStatus(
                statusEl,
                '❌ Background generation timed out. Please refresh the page.',
                '#ff6b6b'
            );
            this.addRefreshButton(statusEl);
        }
    }

    private updateStartButton(): void {
        const startBtn = document.getElementById('start-game-btn') as HTMLButtonElement | null;

        if (!startBtn) return;

        const canStart = this.spriteReady && this.backgroundReady && this.currentSpriteSheet !== null;
        startBtn.disabled = !canStart;

        if (canStart) {
            startBtn.textContent = 'Start Game';
            startBtn.classList.add('ready');
        } else {
            startBtn.textContent = 'Loading Assets...';
            startBtn.classList.remove('ready');
        }
    }

    // ==================================================================================
    // GAME START
    // ==================================================================================

    public async startGame(): Promise<void> {
        // Double-check all assets are ready
        if (!this.spriteReady || !this.backgroundReady || !this.currentSpriteSheet) {
            const statusEl = document.getElementById('generation-status');
            this.updateStatus(statusEl, '⚠️ Please wait for all assets to load.', '#ff9800');
            return;
        }

        const startBtn = document.getElementById('start-game-btn') as HTMLButtonElement | null;
        if (startBtn) startBtn.disabled = true;

        try {
            this.showGameScreen();

            if (window.updateDebugIndicators) {
                window.updateDebugIndicators();
            }

            if (this.currentGameInstance) {
                this.currentGameInstance.destroy();
            }

            this.currentGameInstance = new this.gameClass(
                this.currentSpriteSheet,
                this.apiService,
                this.assetStorage,
                null
            );

        } catch (error) {
            this.handleGameStartError(error, startBtn);
        }
    }

    private showGameScreen(): void {
        document.getElementById('menu-screen')?.classList.add('hidden');
        document.getElementById('game-screen')?.classList.remove('hidden');
    }

    private showMenuScreen(): void {
        document.getElementById('menu-screen')?.classList.remove('hidden');
        document.getElementById('game-screen')?.classList.add('hidden');
    }

    private handleGameStartError(error: unknown, startBtn: HTMLButtonElement | null): void {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error starting game:', error);

        const statusEl = document.getElementById('generation-status');
        this.updateStatus(statusEl, `❌ Error starting game: ${errorMessage}`, '#ff6b6b');

        this.showMenuScreen();

        if (startBtn) startBtn.disabled = false;
    }

    public async loadSavedCharacter(): Promise<void> {
        const savedSprite = await this.getStoredItem('custom_sprite_sheet');
        const savedImage = await this.getStoredItem('original_dog_image');

        if (savedSprite && this.isValidSpriteSheet(savedSprite)) {
            this.currentSpriteSheet = savedSprite;
            this.uploadedImage = savedImage;
            this.spriteReady = true;

            if (savedImage) {
                this.updatePreviewHTML(savedImage, 'Dog preview');
            }

            console.log('Loaded saved character from storage');
        }

        // Always check full asset state
        await this.checkAllAssetsReady();
    }

    // ==================================================================================
    // UI HELPERS
    // ==================================================================================

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private updateStatus(el: HTMLElement | null, html: string, color: string): void {
        if (el) {
            el.innerHTML = html;
            el.style.color = color;
        }
    }

    private updatePreviewHTML(src: string, altText: string, isSprite: boolean = false): void {
        const preview = document.getElementById('upload-preview');

        if (!preview) return;

        const style = isSprite ? 'width: 256px; height: 256px;' : '';
        const caption = isSprite ? '<p style="margin-top: 10px; font-size: 0.9em;">✓ Sprite Sheet Ready!</p>' : '';

        preview.innerHTML = `
            <div>
                <img src="${src}" alt="${altText}" class="pixelated" style="${style}">
                ${caption}
            </div>
        `;
    }

    private addRetryButton(statusEl: HTMLElement | null): void {
        if (!statusEl || document.getElementById('retry-sprite-btn')) return;

        const btn = document.createElement('button');
        btn.id = 'retry-sprite-btn';
        btn.className = 'retry-button';
        btn.textContent = '🔄 Retry Sprite Generation';
        btn.style.cssText = `
            margin-top: 15px;
            padding: 10px 20px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
        `;

        btn.onclick = (): void => {
            btn.remove();
            this.generateSpriteSheetWithRetry();
        };

        statusEl.appendChild(document.createElement('br'));
        statusEl.appendChild(btn);
    }

    private addRefreshButton(statusEl: HTMLElement | null): void {
        if (!statusEl || document.getElementById('refresh-page-btn')) return;

        const btn = document.createElement('button');
        btn.id = 'refresh-page-btn';
        btn.className = 'refresh-button';
        btn.textContent = '🔄 Refresh Page';
        btn.style.cssText = `
            margin-top: 15px;
            padding: 10px 20px;
            background: #2196F3;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
        `;

        btn.onclick = (): void => {
            window.location.reload();
        };

        statusEl.appendChild(document.createElement('br'));
        statusEl.appendChild(btn);
    }

    public async displayBackgroundPreview(): Promise<void> {
        if (!CONFIG.DEBUG_MODE) return;

        console.log('🔍 DEBUG: Displaying background preview...');

        const framesStr = await this.getStoredItem('location_background_frames');
        if (!framesStr) return;

        let frames: string[];
        try {
            frames = JSON.parse(framesStr);
        } catch {
            return;
        }

        if (!Array.isArray(frames) || frames.length === 0) return;

        let container = document.getElementById('debug-background-preview');

        if (!container) {
            container = document.createElement('div');
            container.id = 'debug-background-preview';
            Object.assign(container.style, {
                marginTop: '20px',
                padding: '15px',
                background: '#1a1a1a',
                border: '2px solid #4CAF50',
                borderRadius: '8px',
                maxHeight: '400px',
                overflowY: 'auto',
            });

            const statusEl = document.getElementById('generation-status');
            statusEl?.parentNode?.insertBefore(container, statusEl.nextSibling);
        }

        container.innerHTML = `
            <h3 style="color:#4CAF50;margin:0 0 10px 0;font-size:14px">
                🔍 DEBUG: Background Frames (${frames.length})
            </h3>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px">
                ${frames.map((src: string, i: number) => `
                    <div style="background:#2a2a2a;padding:5px;border-radius:4px;text-align:center">
                        <div style="color:#aaa;font-size:11px;margin-bottom:5px">Frame ${i + 1}</div>
                        <img src="${src}" style="width:100%;border:1px solid #333" title="Frame ${i + 1}">
                    </div>
                `).join('')}
            </div>
        `;
    }

    // ==================================================================================
    // PUBLIC GETTERS FOR DEBUGGING
    // ==================================================================================

    public getReadyState(): ReadyState {
        return {
            sprite: this.spriteReady,
            background: this.backgroundReady,
            canStart: this.spriteReady && this.backgroundReady && this.currentSpriteSheet !== null,
        };
    }

    public getSpriteSheet(): string | null {
        return this.currentSpriteSheet;
    }

    public getUploadedImage(): string | null {
        return this.uploadedImage;
    }
}