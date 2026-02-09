import { CONFIG } from './config.js';
if (window.updateDebugIndicators) {
    window.updateDebugIndicators();
}
const RETRY_CONFIG = {
    MAX_ATTEMPTS: 5,
    INITIAL_DELAY_MS: 2000,
    MAX_DELAY_MS: 30000,
    BACKOFF_MULTIPLIER: 2,
};
const BACKGROUND_POLL_CONFIG = {
    MAX_ATTEMPTS: 60,
    INTERVAL_MS: 5000,
    MIN_FRAMES_REQUIRED: 8,
};
export class CharacterManager {
    constructor(apiService, assetStorage, gameClass) {
        this.currentGameInstance = null;
        this.currentSpriteSheet = null;
        this.uploadedImage = null;
        this.spriteReady = false;
        this.backgroundReady = false;
        this.isGeneratingSprite = false;
        this.isCheckingBackground = false;
        this.apiService = apiService;
        this.assetStorage = assetStorage;
        this.gameClass = gameClass;
        this.setupEventListeners();
        this.loadCachedAssets();
    }
    setupEventListeners() {
        const uploadInput = document.getElementById('dog-image-upload');
        const startBtn = document.getElementById('start-game-btn');
        if (uploadInput) {
            uploadInput.addEventListener('change', (e) => this.handleImageUpload(e));
        }
        if (startBtn) {
            startBtn.addEventListener('click', () => this.startGame());
        }
    }
    async loadCachedAssets() {
        console.log('Checking for cached assets...');
        const cachedSprite = await this.getStoredItem('custom_sprite_sheet');
        const cachedImage = await this.getStoredItem('original_dog_image');
        if (cachedSprite && this.isValidSpriteSheet(cachedSprite)) {
            console.log('✓ Found cached sprite sheet');
            this.currentSpriteSheet = cachedSprite;
            this.uploadedImage = cachedImage;
            this.spriteReady = true;
            if (cachedImage) {
                this.updatePreviewHTML(cachedImage, 'Dog preview');
            }
            this.updatePreviewHTML(cachedSprite, 'Sprite Sheet Ready!', true);
        }
        await this.checkBackgroundReady();
        if (this.backgroundReady) {
            console.log('✓ Found cached background');
        }
        await this.checkAllAssetsReady();
    }
    async getStoredItem(key) {
        try {
            const asset = await this.assetStorage.getItem(key);
            if (asset)
                return asset;
        }
        catch {
        }
        return localStorage.getItem(key);
    }
    async setStoredItem(key, value) {
        try {
            await this.assetStorage.setItem(key, value);
        }
        catch (error) {
            console.warn(`Failed to save to AssetStorage, using localStorage: ${key}`, error);
        }
        try {
            localStorage.setItem(key, value);
        }
        catch (error) {
            console.warn(`Failed to save to localStorage: ${key}`, error);
        }
    }
    async removeStoredItem(key) {
        try {
            await this.assetStorage.removeItem(key);
        }
        catch {
        }
        localStorage.removeItem(key);
    }
    async handleImageUpload(event) {
        const target = event.target;
        const file = target.files?.[0];
        if (!file)
            return;
        if (!file.type.startsWith('image/')) {
            alert('Please upload an image file');
            return;
        }
        console.log('New image uploaded - clearing old sprite cache...');
        this.spriteReady = false;
        this.currentSpriteSheet = null;
        this.updateStartButton();
        await this.clearSpriteCache();
        const reader = new FileReader();
        reader.onload = async (e) => {
            const result = e.target?.result;
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
    clearUploadedImage() {
        this.uploadedImage = null;
        this.currentSpriteSheet = null;
        this.spriteReady = false;
        this.updateStartButton();
    }
    async clearSpriteCache() {
        const keysToRemove = [
            'custom_sprite_sheet',
            'original_dog_image',
            'has_custom_character',
        ];
        for (const key of keysToRemove) {
            await this.removeStoredItem(key);
        }
    }
    async clearAllCaches() {
        console.log('Clearing all caches...');
        await this.clearSpriteCache();
        const backgroundKeys = [
            'location_background_frames',
            'location_background_meta',
            'location_background',
        ];
        for (const key of backgroundKeys) {
            await this.removeStoredItem(key);
        }
        this.spriteReady = false;
        this.backgroundReady = false;
        this.currentSpriteSheet = null;
        this.uploadedImage = null;
        this.updateStartButton();
        console.log('All caches cleared');
    }
    async generateSpriteSheetWithRetry() {
        if (!this.uploadedImage || this.isGeneratingSprite)
            return;
        const statusEl = document.getElementById('generation-status');
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
                this.updateStatus(statusEl, `<div class="loader"></div> Generating sprite sheet... (Attempt ${attempt}/${RETRY_CONFIG.MAX_ATTEMPTS})`, '#ffd700');
                console.log(`Sprite generation attempt ${attempt}/${RETRY_CONFIG.MAX_ATTEMPTS}`);
                const spriteSheetUrl = await this.apiService.generateSpriteSheet('Custom dog character', this.uploadedImage);
                if (!this.isValidSpriteSheet(spriteSheetUrl)) {
                    throw new Error('Invalid sprite sheet generated (validation failed)');
                }
                await this.handleSpriteGenerationSuccess(spriteSheetUrl);
                return;
            }
            catch (error) {
                console.error(`Sprite generation attempt ${attempt} failed:`, error);
                if (attempt < RETRY_CONFIG.MAX_ATTEMPTS) {
                    this.updateStatus(statusEl, `<div class="loader"></div> Generation failed. Retrying in ${Math.round(delay / 1000)}s... (Attempt ${attempt}/${RETRY_CONFIG.MAX_ATTEMPTS})`, '#ff9800');
                    await this.sleep(delay);
                    delay = Math.min(delay * RETRY_CONFIG.BACKOFF_MULTIPLIER, RETRY_CONFIG.MAX_DELAY_MS);
                }
                else {
                    this.handleSpriteGenerationFailure(statusEl);
                }
            }
        }
    }
    async checkSpriteCache() {
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
    isValidSpriteSheet(spriteSheet) {
        if (!spriteSheet)
            return false;
        if (spriteSheet.length < 1000)
            return false;
        if (!spriteSheet.startsWith('data:image/'))
            return false;
        return true;
    }
    async handleSpriteGenerationSuccess(spriteSheetUrl) {
        this.currentSpriteSheet = spriteSheetUrl;
        this.spriteReady = true;
        this.isGeneratingSprite = false;
        await this.setStoredItem('custom_sprite_sheet', spriteSheetUrl);
        if (this.uploadedImage) {
            await this.setStoredItem('original_dog_image', this.uploadedImage);
        }
        localStorage.setItem('has_custom_character', 'true');
        this.updatePreviewHTML(spriteSheetUrl, 'Sprite Sheet Ready!', true);
        console.log('✓ Sprite sheet generated successfully');
        await this.checkAllAssetsReady();
    }
    handleSpriteGenerationFailure(statusEl) {
        this.isGeneratingSprite = false;
        this.updateStatus(statusEl, `❌ Sprite generation failed after ${RETRY_CONFIG.MAX_ATTEMPTS} attempts. Please try again.`, '#ff6b6b');
        this.addRetryButton(statusEl);
    }
    async checkAllAssetsReady() {
        const statusEl = document.getElementById('generation-status');
        if (!this.spriteReady || !this.currentSpriteSheet) {
            this.updateStatus(statusEl, '<div class="loader"></div> Waiting for sprite generation...', '#ffd700');
            this.updateStartButton();
            return;
        }
        await this.checkBackgroundReady();
        if (!this.backgroundReady) {
            this.updateStatus(statusEl, '<div class="loader"></div> Waiting for background generation...', '#ffd700');
            this.updateStartButton();
            if (!this.isCheckingBackground) {
                this.pollBackgroundReady();
            }
            return;
        }
        console.log('✓ All assets ready - game can start');
        this.updateStatus(statusEl, '✓ All assets ready! Click "Start Game" to begin.', '#4CAF50');
        this.updateStartButton();
        if (CONFIG.DEBUG_MODE) {
            await this.displayBackgroundPreview();
        }
    }
    async checkBackgroundReady() {
        try {
            const framesStr = await this.getStoredItem('location_background_frames');
            if (framesStr) {
                const frames = JSON.parse(framesStr);
                this.backgroundReady = Array.isArray(frames) && frames.length >= BACKGROUND_POLL_CONFIG.MIN_FRAMES_REQUIRED;
            }
            else {
                this.backgroundReady = false;
            }
        }
        catch (error) {
            console.error('Error checking background:', error);
            this.backgroundReady = false;
        }
        return this.backgroundReady;
    }
    async pollBackgroundReady() {
        if (this.isCheckingBackground)
            return;
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
            this.updateStatus(statusEl, '❌ Background generation timed out. Please refresh the page.', '#ff6b6b');
            this.addRefreshButton(statusEl);
        }
    }
    updateStartButton() {
        const startBtn = document.getElementById('start-game-btn');
        if (!startBtn)
            return;
        const canStart = this.spriteReady && this.backgroundReady && this.currentSpriteSheet !== null;
        startBtn.disabled = !canStart;
        if (canStart) {
            startBtn.textContent = 'Start Game';
            startBtn.classList.add('ready');
        }
        else {
            startBtn.textContent = 'Loading Assets...';
            startBtn.classList.remove('ready');
        }
    }
    async startGame() {
        if (!this.spriteReady || !this.backgroundReady || !this.currentSpriteSheet) {
            const statusEl = document.getElementById('generation-status');
            this.updateStatus(statusEl, '⚠️ Please wait for all assets to load.', '#ff9800');
            return;
        }
        const startBtn = document.getElementById('start-game-btn');
        if (startBtn)
            startBtn.disabled = true;
        try {
            this.showGameScreen();
            if (window.updateDebugIndicators) {
                window.updateDebugIndicators();
            }
            if (this.currentGameInstance) {
                this.currentGameInstance.destroy();
                this.currentGameInstance = null;
            }
            this.currentGameInstance = new this.gameClass(this.currentSpriteSheet, this.apiService, this.assetStorage, null);
        }
        catch (error) {
            this.handleGameStartError(error, startBtn);
        }
    }
    returnToMenu() {
        if (this.currentGameInstance) {
            this.currentGameInstance.destroy();
            this.currentGameInstance = null;
        }
        this.showMenuScreen();
        this.checkAllAssetsReady();
    }
    showGameScreen() {
        document.getElementById('menu-screen')?.classList.add('hidden');
        document.getElementById('game-screen')?.classList.remove('hidden');
    }
    showMenuScreen() {
        document.getElementById('menu-screen')?.classList.remove('hidden');
        document.getElementById('game-screen')?.classList.add('hidden');
    }
    handleGameStartError(error, startBtn) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error starting game:', error);
        const statusEl = document.getElementById('generation-status');
        this.updateStatus(statusEl, `❌ Error starting game: ${errorMessage}`, '#ff6b6b');
        this.showMenuScreen();
        if (startBtn)
            startBtn.disabled = false;
    }
    async loadSavedCharacter() {
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
        await this.checkAllAssetsReady();
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    updateStatus(el, html, color) {
        if (el) {
            el.innerHTML = html;
            el.style.color = color;
        }
    }
    updatePreviewHTML(src, altText, isSprite = false) {
        const preview = document.getElementById('upload-preview');
        if (!preview)
            return;
        const style = isSprite ? 'width: 256px; height: 256px;' : '';
        const caption = isSprite ? '<p style="margin-top: 10px; font-size: 0.9em;">✓ Sprite Sheet Ready!</p>' : '';
        preview.innerHTML = `
            <div>
                <img src="${src}" alt="${altText}" class="pixelated" style="${style}">
                ${caption}
            </div>
        `;
    }
    addRetryButton(statusEl) {
        if (!statusEl || document.getElementById('retry-sprite-btn'))
            return;
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
        btn.onclick = () => {
            btn.remove();
            this.generateSpriteSheetWithRetry();
        };
        statusEl.appendChild(document.createElement('br'));
        statusEl.appendChild(btn);
    }
    addRefreshButton(statusEl) {
        if (!statusEl || document.getElementById('refresh-page-btn'))
            return;
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
        btn.onclick = () => {
            window.location.reload();
        };
        statusEl.appendChild(document.createElement('br'));
        statusEl.appendChild(btn);
    }
    async displayBackgroundPreview() {
        if (!CONFIG.DEBUG_MODE)
            return;
        console.log('🔍 DEBUG: Displaying background preview...');
        const framesStr = await this.getStoredItem('location_background_frames');
        if (!framesStr)
            return;
        let frames;
        try {
            frames = JSON.parse(framesStr);
        }
        catch {
            return;
        }
        if (!Array.isArray(frames) || frames.length === 0)
            return;
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
                ${frames.map((src, i) => `
                    <div style="background:#2a2a2a;padding:5px;border-radius:4px;text-align:center">
                        <div style="color:#aaa;font-size:11px;margin-bottom:5px">Frame ${i + 1}</div>
                        <img src="${src}" style="width:100%;border:1px solid #333" title="Frame ${i + 1}">
                    </div>
                `).join('')}
            </div>
        `;
    }
    getReadyState() {
        return {
            sprite: this.spriteReady,
            background: this.backgroundReady,
            canStart: this.spriteReady && this.backgroundReady && this.currentSpriteSheet !== null,
        };
    }
    getSpriteSheet() {
        return this.currentSpriteSheet;
    }
    getUploadedImage() {
        return this.uploadedImage;
    }
}
