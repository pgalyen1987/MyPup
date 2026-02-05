// Character customization and sprite management

// Type definitions
import type { APIService } from './api.js';
import type { AssetStorage } from './AssetStorage.js';
import type { Game } from './game.js';
import { CONFIG } from './config.js';

// Extend Window interface for global objects (extends config.ts declarations)
declare global {
    interface Window {
        assetStorage?: {
            getItem(key: string): Promise<string | undefined>;
            setItem(key: string, value: string): Promise<void>;
        };
        testGeminiModels?: () => Promise<void>;
        gameInstance?: any; // Will be typed when game.ts is migrated
        Game?: any; // Will be typed when game.ts is migrated
    }
}

export class CharacterManager {
    private apiService: APIService;
    private assetStorage: AssetStorage;
    private gameClass: typeof Game;
    private currentGameInstance: Game | null = null;
    private currentSpriteSheet: string | null = null;
    private uploadedImage: string | null = null;
    private imageBase64?: string;

    constructor(apiService: APIService, assetStorage: AssetStorage, gameClass: typeof Game) {
        this.apiService = apiService;
        this.assetStorage = assetStorage;
        this.gameClass = gameClass;
        this.setupEventListeners();
    }

    setupEventListeners(): void {
        const uploadInput = document.getElementById('dog-image-upload');
        const startBtn = document.getElementById('start-game-btn');

        if (uploadInput) {
            uploadInput.addEventListener('change', (e) => this.handleImageUpload(e as Event));
        }
        if (startBtn) {
            startBtn.addEventListener('click', () => this.startGame());
        }
    }

    async handleImageUpload(event: Event): Promise<void> {
        const target = event.target as HTMLInputElement;
        const file = target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Please upload an image file');
            return;
        }

        // Clear old sprite cache when new image is uploaded
        console.log('New image uploaded - clearing old sprite cache...');
        try {
            await this.assetStorage.removeItem('custom_sprite_sheet');
            await this.assetStorage.removeItem('original_dog_image');
            localStorage.removeItem('custom_sprite_sheet');
            localStorage.removeItem('original_dog_image');
            localStorage.removeItem('has_custom_character');
            this.currentSpriteSheet = null;
            console.log('Old sprite cache cleared');
        } catch (error) {
            console.warn('Failed to clear old cache:', error);
        }

        // Show preview
        const preview = document.getElementById('upload-preview');
        const reader = new FileReader();
        
        reader.onload = async (e) => {
            const result = (e.target as FileReader).result as string;
            if (preview) {
                preview.innerHTML = `<img src="${result}" alt="Dog preview" class="pixelated">`;
            }
            this.uploadedImage = result;
            
            // Automatically start sprite sheet generation with new image
            await this.generateSpriteSheet();
        };

        reader.readAsDataURL(file);
    }

    async generateSpriteSheet(): Promise<void> {
        if (!this.uploadedImage) {
            return;
        }

        const statusEl = document.getElementById('generation-status');
        const startBtn = document.getElementById('start-game-btn') as HTMLButtonElement | null;
        
        // Disable start button and show loading
        if (startBtn) {
            startBtn.disabled = true;
        }
        if (statusEl) {
            statusEl.innerHTML = '<div class="loader"></div> Analyzing your dog\'s features with Gemini AI...';
            statusEl.style.color = '#ffd700';
        }
        
        // Smart Caching Check
        let savedImage: string | undefined, savedSprite: string | undefined;
        savedImage = await this.assetStorage.getItem('original_dog_image') as string | undefined;
        savedSprite = await this.assetStorage.getItem('custom_sprite_sheet') as string | undefined;
        
        // Fallback to localStorage if AssetStorage doesn't have it
        if (!savedImage) {
            savedImage = localStorage.getItem('original_dog_image') || undefined;
        }
        if (!savedSprite) {
            savedSprite = localStorage.getItem('custom_sprite_sheet') || undefined;
        }
        
        // If the uploaded image matches the saved one, and we have a sprite, use it!
        // NOTE: Cached sprite sheets should already have background removed (if generated after the fix)
        // If you see green background, clear cache and regenerate
        if (this.uploadedImage === savedImage && savedSprite) {
            console.log('Using cached sprite sheet for identical image.');
            console.log('⚠️ If you see green background, run clearPlayerSpriteCache() and regenerate');
            this.currentSpriteSheet = savedSprite;
            await this.checkReadyState();
            return;
        }

        try {
            // Use the uploaded image (already in base64 format from FileReader)
            const imageBase64 = this.uploadedImage;
            
            // Verify we have the image
            if (!imageBase64) {
                throw new Error('No image data available');
            }
            
            console.log('Generating sprite sheet with uploaded image, base64 length:', imageBase64.length);
            console.log('Image preview (first 100 chars):', imageBase64.substring(0, 100));
            
            // Generate sprite sheet
            if (statusEl) {
                statusEl.innerHTML = '<div class="loader"></div> Analyzing with Gemini 3 and generating sprite sheet...';
                statusEl.style.color = '#ffd700';
            }
            
            const spriteSheetUrl = await this.apiService.generateSpriteSheet(
                'Custom dog character',
                imageBase64
            );

            // Load and validate sprite sheet
            this.currentSpriteSheet = spriteSheetUrl;
            
            // Store in IndexedDB (AssetStorage) for persistence
            try {
                await this.assetStorage.setItem('custom_sprite_sheet', spriteSheetUrl);
                await this.assetStorage.setItem('original_dog_image', this.imageBase64 || this.uploadedImage);
                localStorage.setItem('has_custom_character', 'true');
            } catch (storageError) {
                console.warn('Failed to save character to storage:', storageError);
                if (statusEl) {
                    statusEl.textContent += ' (Warning: Could not cache character, but game will work)';
                }
            }
            
            // Update preview and check if ready to start
            this.updatePreview(spriteSheetUrl);
            await this.checkReadyState();

        } catch (error: any) {
            console.error('Error generating sprite sheet:', error);
            
            // Handle structured error objects from API
            let errorMessage = error.message || 'Unknown error occurred';
            let showRefreshButton = false;
            
            if (error.type) {
                errorMessage = error.message || errorMessage;
                
                // For expired or invalid keys, show backend error
                if (error.type === 'API_KEY_EXPIRED' || error.type === 'API_KEY_INVALID') {
                    // Backend proxy handles API keys, so this shouldn't happen
                    // But if it does, show a generic backend error
                    errorMessage += '\n\nPlease check your backend configuration.';
                }
                
                // For model not found, suggest refreshing
                if (error.type === 'MODEL_NOT_FOUND') {
                    showRefreshButton = true;
                }
            }
            
            if (statusEl) {
                statusEl.innerHTML = `❌ Error: ${errorMessage}`;
                statusEl.style.color = '#ff6b6b';
                
                // Add a refresh button for model errors
                if (showRefreshButton && !document.getElementById('error-refresh-btn')) {
                    const refreshBtn = document.createElement('button');
                    refreshBtn.id = 'error-refresh-btn';
                    refreshBtn.className = 'clear-button';
                    refreshBtn.textContent = 'Refresh Page';
                    refreshBtn.style.marginTop = '10px';
                    refreshBtn.style.background = '#4CAF50';
                    refreshBtn.onclick = () => {
                        window.location.reload();
                    };
                    statusEl.appendChild(document.createElement('br'));
                    statusEl.appendChild(refreshBtn);
                }
                
                // Add test models button for model errors
                if (error.type === 'MODEL_NOT_FOUND' && !document.getElementById('error-test-models-btn')) {
                    const testBtn = document.createElement('button');
                    testBtn.id = 'error-test-models-btn';
                    testBtn.className = 'clear-button';
                    testBtn.textContent = 'Test Available Models';
                    testBtn.style.marginTop = '10px';
                    testBtn.style.background = '#2196F3';
                    testBtn.onclick = () => {
                        if (window.testGeminiModels) {
                            if (statusEl) {
                                statusEl.innerHTML = 'Testing models... Check browser console (F12) for results.';
                            }
                            window.testGeminiModels()!.then(() => {
                                if (statusEl) {
                                    statusEl.innerHTML += '<br><br>✅ Test complete! Check console for working models.';
                                }
                            }).catch((err: Error) => {
                                if (statusEl) {
                                    statusEl.innerHTML += `<br><br>❌ Test error: ${err.message}`;
                                }
                            });
                        } else {
                            alert('Test script not loaded. Please refresh the page and try again.');
                        }
                    };
                    statusEl.appendChild(document.createElement('br'));
                    statusEl.appendChild(testBtn);
                }
            }
            
            // Keep start button disabled on error
            if (startBtn) {
                startBtn.disabled = true;
            }
        }
    }

    updatePreview(spriteUrl: string): void {
        // Show preview
        const preview = document.getElementById('upload-preview');
        if (preview) {
            preview.innerHTML = `
                <div>
                    <img src="${spriteUrl}" alt="Sprite sheet" class="pixelated" style="width: 256px; height: 256px;">
                    <p style="margin-top: 10px; font-size: 0.9em;">Sprite Sheet Ready!</p>
                </div>
            `;
        }
    }

    async checkReadyState(): Promise<void> {
        const statusEl = document.getElementById('generation-status');
        const startBtn = document.getElementById('start-game-btn') as HTMLButtonElement | null;
        
        console.log('CharacterManager: checkReadyState called');
        console.log('CharacterManager: currentSpriteSheet:', this.currentSpriteSheet ? 'YES' : 'NO');
        
        // Check if sprite sheet is ready
        if (!this.currentSpriteSheet) {
            console.log('CharacterManager: Sprite sheet not ready, disabling button');
            if (statusEl) {
                statusEl.innerHTML = '<div class="loader"></div> Generating sprite sheet...';
                statusEl.style.color = '#ffd700';
            }
            if (startBtn) {
                startBtn.disabled = true;
            }
            return;
        }
        
        // Check if background is ready (REQUIRED)
        // Background is ONLY stored as frames array (8 frames, 512x512 each)
        // We only check for the frames array - no spritesheet fallback
        let backgroundReady = false;
        try {
            // First check AssetStorage for frames array (preferred)
            const framesStr = await this.assetStorage.getItem('location_background_frames');
            if (framesStr) {
                try {
                    const frames = JSON.parse(framesStr);
                    backgroundReady = Array.isArray(frames) && frames.length >= 8;
                    console.log('CharacterManager: Background check via AssetStorage (frames array):', backgroundReady, `(${frames?.length || 0} frames)`);
                } catch (e) {
                    console.warn('CharacterManager: Could not parse frames array from AssetStorage:', e);
                }
            } else {
                console.log('CharacterManager: No frames array found in AssetStorage');
            }
            
            // Fallback: Check localStorage for frames array
            if (!backgroundReady) {
                const localFramesStr = localStorage.getItem('location_background_frames');
                if (localFramesStr) {
                    try {
                        const frames = JSON.parse(localFramesStr);
                        backgroundReady = Array.isArray(frames) && frames.length >= 8;
                        console.log('CharacterManager: Background check via localStorage (frames array):', backgroundReady, `(${frames?.length || 0} frames)`);
                    } catch (e) {
                        console.warn('CharacterManager: Could not parse frames array from localStorage:', e);
                    }
                } else {
                    console.log('CharacterManager: No frames array found in localStorage');
                }
            }
        } catch (error) {
            console.error('CharacterManager: Error checking background:', error);
            backgroundReady = false;
        }
        
        console.log('CharacterManager: Background ready:', backgroundReady);
        
        if (!backgroundReady) {
            console.log('CharacterManager: Background not ready, waiting...');
            if (statusEl) {
                statusEl.innerHTML = '<div class="loader"></div> Waiting for background to be ready...';
                statusEl.style.color = '#ffd700';
            }
            if (startBtn) {
                startBtn.disabled = true;
            }
            
            // Wait a bit and check again (background might be generating)
            // But limit retries to avoid infinite loop
            const retryCount = (this as any)._backgroundRetryCount || 0;
            if (retryCount < CONFIG.TIMING.MAX_BACKGROUND_RETRY_ATTEMPTS) { // Max retries configured in CONFIG
                (this as any)._backgroundRetryCount = retryCount + 1;
                setTimeout(() => this.checkReadyState(), CONFIG.TIMING.RETRY_DELAY_VERY_LONG);
            } else {
                const timeoutSeconds = CONFIG.TIMING.MAX_BACKGROUND_RETRY_ATTEMPTS * (CONFIG.TIMING.RETRY_DELAY_VERY_LONG / 1000);
                console.error(`CharacterManager: Background check timed out after ${timeoutSeconds} seconds`);
                if (statusEl) {
                    statusEl.innerHTML = '⚠️ Background generation is taking longer than expected. Please check your backend connection and try refreshing.';
                    statusEl.style.color = '#ff9800';
                }
            }
            return;
        }
        
        // Reset retry count on success
        (this as any)._backgroundRetryCount = 0;
        
        // Both are ready!
        console.log('CharacterManager: Both sprite sheet and background ready, enabling button');
        
        // In debug mode, display background images before enabling button
        if (CONFIG.DEBUG_MODE) {
            await this.displayBackgroundPreview();
        }
        
        if (statusEl) {
            statusEl.textContent = '✓ Ready to play! Click "Start Game" to begin.';
            statusEl.style.color = '#4CAF50';
        }
        if (startBtn) {
            startBtn.disabled = false;
        }
    }

    /**
     * Display background images in debug mode (for debugging background rendering issues)
     */
    async displayBackgroundPreview(): Promise<void> {
        if (!CONFIG.DEBUG_MODE) {
            return; // Only in debug mode
        }
        
        console.log('🔍 DEBUG MODE: Displaying background preview...');
        
        try {
            // Get background frames from storage
            let frames: string[] | null = null;
            
            // Try AssetStorage first
            const framesStr = await this.assetStorage.getItem('location_background_frames');
            if (framesStr) {
                frames = JSON.parse(framesStr);
            } else {
                // Fallback to localStorage
                const localFramesStr = localStorage.getItem('location_background_frames');
                if (localFramesStr) {
                    frames = JSON.parse(localFramesStr);
                }
            }
            
            if (!frames || frames.length === 0) {
                console.warn('🔍 DEBUG: No background frames found to display');
                return;
            }
            
            console.log(`🔍 DEBUG: Found ${frames.length} background frames, displaying preview...`);
            
            // Create or get preview container
            let previewContainer = document.getElementById('debug-background-preview');
            if (!previewContainer) {
                previewContainer = document.createElement('div');
                previewContainer.id = 'debug-background-preview';
                previewContainer.style.cssText = `
                    margin-top: 20px;
                    padding: 15px;
                    background: #1a1a1a;
                    border: 2px solid #4CAF50;
                    border-radius: 8px;
                    max-height: 400px;
                    overflow-y: auto;
                `;
                
                const title = document.createElement('h3');
                title.textContent = '🔍 DEBUG: Background Frames Preview';
                title.style.cssText = 'color: #4CAF50; margin-top: 0; margin-bottom: 10px; font-size: 14px;';
                previewContainer.appendChild(title);
                
                const statusEl = document.getElementById('generation-status');
                if (statusEl && statusEl.parentNode) {
                    statusEl.parentNode.insertBefore(previewContainer, statusEl.nextSibling);
                }
            } else {
                // Clear existing content
                previewContainer.innerHTML = '';
                const title = document.createElement('h3');
                title.textContent = '🔍 DEBUG: Background Frames Preview';
                title.style.cssText = 'color: #4CAF50; margin-top: 0; margin-bottom: 10px; font-size: 14px;';
                previewContainer.appendChild(title);
            }
            
            // Display each frame
            const frameInfo = document.createElement('p');
            frameInfo.textContent = `Showing ${frames.length} frames (1024x1024 each):`;
            frameInfo.style.cssText = 'color: #ccc; font-size: 12px; margin-bottom: 10px;';
            previewContainer.appendChild(frameInfo);
            
            const gridContainer = document.createElement('div');
            gridContainer.style.cssText = `
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 10px;
            `;
            
            frames.forEach((frameBase64, index) => {
                const frameDiv = document.createElement('div');
                frameDiv.style.cssText = `
                    border: 1px solid #555;
                    padding: 5px;
                    background: #2a2a2a;
                    border-radius: 4px;
                `;
                
                const label = document.createElement('div');
                label.textContent = `Frame ${index + 1}/${frames.length}`;
                label.style.cssText = 'color: #aaa; font-size: 11px; margin-bottom: 5px; text-align: center;';
                frameDiv.appendChild(label);
                
                const img = document.createElement('img');
                img.src = frameBase64;
                img.style.cssText = `
                    width: 100%;
                    height: auto;
                    max-width: 200px;
                    max-height: 200px;
                    object-fit: contain;
                    border: 1px solid #333;
                    border-radius: 2px;
                    display: block;
                    margin: 0 auto;
                `;
                img.alt = `Background frame ${index + 1}`;
                
                // Add click to view full size
                img.onclick = () => {
                    const fullSize = window.open('', '_blank');
                    if (fullSize) {
                        fullSize.document.write(`
                            <html>
                                <head><title>Frame ${index + 1} - Full Size</title></head>
                                <body style="margin:0; background:#000; display:flex; justify-content:center; align-items:center; min-height:100vh;">
                                    <img src="${frameBase64}" style="max-width:100%; max-height:100vh;" alt="Frame ${index + 1}">
                                </body>
                            </html>
                        `);
                    }
                };
                img.style.cursor = 'pointer';
                img.title = 'Click to view full size';
                
                frameDiv.appendChild(img);
                gridContainer.appendChild(frameDiv);
            });
            
            previewContainer.appendChild(gridContainer);
            
            console.log('🔍 DEBUG: Background preview displayed successfully');
        } catch (error) {
            console.error('🔍 DEBUG: Error displaying background preview:', error);
        }
    }

    async startGame(): Promise<void> {
        if (!this.currentSpriteSheet) {
            alert('Please generate a sprite sheet first');
            return;
        }

        const startBtn = document.getElementById('start-game-btn') as HTMLButtonElement | null;
        const statusEl = document.getElementById('generation-status');
        
        // Disable button and show loading status
        if (startBtn) {
            startBtn.disabled = true;
        }
        if (statusEl) {
            statusEl.textContent = 'Loading Level 1 Visuals...';
            statusEl.style.color = '#ffd700';
        }

        try {
            // Using procedural tile rendering - no level image preload needed
            console.log('Using procedural tile rendering');

            // Hide menu, show game
            const menuScreen = document.getElementById('menu-screen');
            const gameScreen = document.getElementById('game-screen');
            if (menuScreen) {
                menuScreen.classList.add('hidden');
            }
            if (gameScreen) {
                gameScreen.classList.remove('hidden');
            }
            
            // Update debug indicator when game screen is shown
            if (window.updateDebugIndicators) {
                window.updateDebugIndicators();
            }

            // Initialize game with custom sprite (no level image, will use procedural tiles)
            if (this.currentGameInstance) {
                this.currentGameInstance.destroy();
            }
            
            // Create game instance with injected dependencies
            // No longer using LEVELS - using simple floor instead
            this.currentGameInstance = new this.gameClass(
                this.currentSpriteSheet,
                this.apiService,
                this.assetStorage,
                null
            );
            
            // Game instance is stored in CharacterManager, no need for window assignment
            
            // Reset status
            if (statusEl) {
                statusEl.textContent = '';
            }
            
            // Re-enable button ONLY if we are back in menu (which we aren't, but for safety)
            if (startBtn) {
                startBtn.disabled = false;
            }

        } catch (error: any) {
            // This catches errors in the setup logic itself, not the API call
            console.error('Error starting game:', error);
            if (statusEl) {
                statusEl.textContent = `❌ Error starting game: ${error.message}`;
                statusEl.style.color = '#ff6b6b';
            }
            if (startBtn) {
                startBtn.disabled = false;
            }
        }
    }

    async loadSavedCharacter(): Promise<void> {
        let savedSprite: string | undefined, savedImage: string | undefined;
        savedSprite = await this.assetStorage.getItem('custom_sprite_sheet') as string | undefined;
        savedImage = await this.assetStorage.getItem('original_dog_image') as string | undefined;
        
        // Fallback to localStorage if AssetStorage doesn't have it
        if (!savedSprite) {
            savedSprite = localStorage.getItem('custom_sprite_sheet') || undefined;
        }
        if (!savedImage) {
            savedImage = localStorage.getItem('original_dog_image') || undefined;
        }
        
        if (savedSprite) {
            this.currentSpriteSheet = savedSprite;
            this.uploadedImage = savedImage || null;
            
            const preview = document.getElementById('upload-preview');
            if (preview && savedImage) {
                preview.innerHTML = `<img src="${savedImage}" alt="Dog preview" class="pixelated">`;
            }
            
            // Check if ready to start
            await this.checkReadyState();
        } else {
            // No saved character, ensure start button is disabled
            const startBtn = document.getElementById('start-game-btn') as HTMLButtonElement | null;
            if (startBtn) {
                startBtn.disabled = true;
            }
        }
    }
}

// Note: CharacterManager initialization is now handled in main.ts
// This module just exports the CharacterManager class
// The initialization code that waits for APIService has been moved to main.ts
