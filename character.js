// Character customization and sprite management

class CharacterManager {
    constructor() {
        this.apiService = new APIService();
        this.currentSpriteSheet = null;
        this.uploadedImage = null;
        this.setupEventListeners();
    }

    setupEventListeners() {
        const uploadInput = document.getElementById('dog-image-upload');
        const startBtn = document.getElementById('start-game-btn');

        uploadInput.addEventListener('change', (e) => this.handleImageUpload(e));
        startBtn.addEventListener('click', () => this.startGame());
    }

    async handleImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Please upload an image file');
            return;
        }

        // Show preview
        const preview = document.getElementById('upload-preview');
        const reader = new FileReader();
        
        reader.onload = async (e) => {
            preview.innerHTML = `<img src="${e.target.result}" alt="Dog preview" class="pixelated">`;
            this.uploadedImage = e.target.result;
            
            // Automatically start sprite sheet generation
            await this.generateSpriteSheet();
        };

        reader.readAsDataURL(file);
    }

    async generateSpriteSheet() {
        if (!this.uploadedImage) {
            return;
        }

        const statusEl = document.getElementById('generation-status');
        const startBtn = document.getElementById('start-game-btn');
        
        // Disable start button and show loading
        startBtn.disabled = true;
        statusEl.innerHTML = '<div class="loader"></div> Analyzing your dog\'s features with Gemini AI...';
        statusEl.style.color = '#ffd700';
        
        // Smart Caching Check
        let savedImage, savedSprite;
        if (window.assetStorage) {
            savedImage = await window.assetStorage.getItem('original_dog_image');
            savedSprite = await window.assetStorage.getItem('custom_sprite_sheet');
        } else {
            savedImage = localStorage.getItem('original_dog_image');
            savedSprite = localStorage.getItem('custom_sprite_sheet');
        }
        
        // If the uploaded image matches the saved one, and we have a sprite, use it!
        if (this.uploadedImage === savedImage && savedSprite) {
            console.log('Using cached sprite sheet for identical image.');
            this.currentSpriteSheet = savedSprite;
            await this.checkReadyState();
            return;
        }

        try {
            // Convert image to base64 if needed
            const imageBase64 = this.uploadedImage;
            
            // Generate sprite sheet
            statusEl.innerHTML = '<div class="loader"></div> Analyzing with Gemini 3 and generating sprite sheet...';
            statusEl.style.color = '#ffd700';
            
            const spriteSheetUrl = await this.apiService.generateSpriteSheet(
                'Custom dog character',
                imageBase64
            );

            // Load and validate sprite sheet
            this.currentSpriteSheet = spriteSheetUrl;
            
            // Store in IndexedDB (AssetStorage) for persistence
            try {
                if (window.assetStorage) {
                    await window.assetStorage.setItem('custom_sprite_sheet', spriteSheetUrl);
                    await window.assetStorage.setItem('original_dog_image', this.imageBase64 || this.uploadedImage);
                    localStorage.setItem('has_custom_character', 'true');
                } else {
                    localStorage.setItem('custom_sprite_sheet', spriteSheetUrl);
                    localStorage.setItem('original_dog_image', this.uploadedImage);
                }
            } catch (storageError) {
                console.warn('Failed to save character to storage:', storageError);
                statusEl.textContent += ' (Warning: Could not cache character, but game will work)';
            }
            
            // Update preview and check if ready to start
            this.updatePreview(spriteSheetUrl);
            await this.checkReadyState();

        } catch (error) {
            console.error('Error generating sprite sheet:', error);
            
            // Handle structured error objects from API
            let errorMessage = error.message || 'Unknown error occurred';
            let showClearButton = false;
            let showRefreshButton = false;
            
            if (error.type) {
                errorMessage = error.message || errorMessage;
                
                // For expired or invalid keys, suggest clearing
                if (error.type === 'API_KEY_EXPIRED' || error.type === 'API_KEY_INVALID') {
                    showClearButton = true;
                    if (error.type === 'API_KEY_EXPIRED') {
                        errorMessage += '\n\nThis is usually a setup issue, not expiration. Check API_SETUP_GUIDE.md for help.';
                    } else {
                        errorMessage += '\n\nClick "Clear API Key" above to remove the invalid key, then set a new one.';
                    }
                }
                
                // For model not found, suggest refreshing
                if (error.type === 'MODEL_NOT_FOUND') {
                    showRefreshButton = true;
                }
            }
            
            statusEl.innerHTML = `❌ Error: ${errorMessage}`;
            statusEl.style.color = '#ff6b6b';
            
            // Add a clear key button if needed
            if (showClearButton && !document.getElementById('error-clear-key-btn')) {
                const clearBtn = document.createElement('button');
                clearBtn.id = 'error-clear-key-btn';
                clearBtn.className = 'clear-button';
                clearBtn.textContent = 'Clear Expired Key';
                clearBtn.style.marginTop = '10px';
                clearBtn.onclick = () => {
                    if (window.clearApiKey) {
                        window.clearApiKey();
                        statusEl.innerHTML = 'API key cleared. Please set a new key using the "Set/Change API Key" button above.';
                        clearBtn.remove();
                    }
                };
                statusEl.appendChild(document.createElement('br'));
                statusEl.appendChild(clearBtn);
            }
            
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
                        statusEl.innerHTML = 'Testing models... Check browser console (F12) for results.';
                        window.testGeminiModels().then(() => {
                            statusEl.innerHTML += '<br><br>✅ Test complete! Check console for working models.';
                        }).catch(err => {
                            statusEl.innerHTML += `<br><br>❌ Test error: ${err.message}`;
                        });
                    } else {
                        alert('Test script not loaded. Please refresh the page and try again.');
                    }
                };
                statusEl.appendChild(document.createElement('br'));
                statusEl.appendChild(testBtn);
            }
            
            // Keep start button disabled on error
            const startBtn = document.getElementById('start-game-btn');
            startBtn.disabled = true;
        }
    }

    updatePreview(spriteUrl) {
        // Show preview
        const preview = document.getElementById('upload-preview');
        preview.innerHTML = `
            <div>
                <img src="${spriteUrl}" alt="Sprite sheet" class="pixelated" style="width: 256px; height: 256px;">
                <p style="margin-top: 10px; font-size: 0.9em;">Sprite Sheet Ready!</p>
            </div>
        `;
    }

    async checkReadyState() {
        const statusEl = document.getElementById('generation-status');
        const startBtn = document.getElementById('start-game-btn');
        
        // Check if sprite sheet is ready
        if (!this.currentSpriteSheet) {
            statusEl.innerHTML = '<div class="loader"></div> Generating sprite sheet...';
            statusEl.style.color = '#ffd700';
            startBtn.disabled = true;
            return;
        }
        
        // Check if background is ready
        let backgroundReady = false;
        if (window.assetStorage) {
            const bg = await window.assetStorage.getItem('location_background');
            backgroundReady = !!bg;
        } else {
            backgroundReady = !!localStorage.getItem('location_background');
        }
        
        if (!backgroundReady) {
            statusEl.innerHTML = '<div class="loader"></div> Waiting for background to be ready...';
            statusEl.style.color = '#ffd700';
            startBtn.disabled = true;
            
            // Wait a bit and check again (background might be generating)
            setTimeout(() => this.checkReadyState(), 1000);
            return;
        }
        
        // Both are ready!
        statusEl.textContent = '✓ Ready to play! Click "Start Game" to begin.';
        statusEl.style.color = '#4CAF50';
        startBtn.disabled = false;
    }

    async startGame() {
        if (!this.currentSpriteSheet) {
            alert('Please generate a sprite sheet first');
            return;
        }

        const startBtn = document.getElementById('start-game-btn');
        const statusEl = document.getElementById('generation-status');
        
        // Disable button and show loading status
        startBtn.disabled = true;
        statusEl.textContent = 'Loading Level 1 Visuals...';
        statusEl.style.color = '#ffd700';

        try {
            // Using procedural tile rendering - no level image preload needed
            console.log('Using procedural tile rendering');

            // Hide menu, show game
            document.getElementById('menu-screen').classList.add('hidden');
            document.getElementById('game-screen').classList.remove('hidden');
            
            // Update debug indicator when game screen is shown
            if (window.updateDebugIndicators) {
                window.updateDebugIndicators();
            }

            // Initialize game with custom sprite (no level image, will use procedural tiles)
            if (window.gameInstance) {
                window.gameInstance.destroy();
            }
            
            window.gameInstance = new Game(this.currentSpriteSheet, null);
            
            // Reset status
            statusEl.textContent = '';
            
            // Re-enable button ONLY if we are back in menu (which we aren't, but for safety)
            startBtn.disabled = false;

        } catch (error) {
            // This catches errors in the setup logic itself, not the API call
            console.error('Error starting game:', error);
            statusEl.textContent = `❌ Error starting game: ${error.message}`;
            statusEl.style.color = '#ff6b6b';
            startBtn.disabled = false;
        }
    }

    async loadSavedCharacter() {
        let savedSprite, savedImage;
        if (window.assetStorage) {
            savedSprite = await window.assetStorage.getItem('custom_sprite_sheet');
            savedImage = await window.assetStorage.getItem('original_dog_image');
        } else {
            savedSprite = localStorage.getItem('custom_sprite_sheet');
            savedImage = localStorage.getItem('original_dog_image');
        }
        
        if (savedSprite) {
            this.currentSpriteSheet = savedSprite;
            this.uploadedImage = savedImage;
            
            const preview = document.getElementById('upload-preview');
            if (savedImage) {
                preview.innerHTML = `<img src="${savedImage}" alt="Dog preview" class="pixelated">`;
            }
            
            // Check if ready to start
            await this.checkReadyState();
        } else {
            // No saved character, ensure start button is disabled
            document.getElementById('start-game-btn').disabled = true;
        }
    }
}

// Initialize character manager when DOM is ready
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', async () => {
        window.characterManager = new CharacterManager();
        await window.characterManager.loadSavedCharacter();
    });
}
