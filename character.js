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
        const generateBtn = document.getElementById('generate-sprite-btn');
        const startBtn = document.getElementById('start-game-btn');

        uploadInput.addEventListener('change', (e) => this.handleImageUpload(e));
        generateBtn.addEventListener('click', () => this.generateSpriteSheet());
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
        
        reader.onload = (e) => {
            preview.innerHTML = `<img src="${e.target.result}" alt="Dog preview" class="pixelated">`;
            this.uploadedImage = e.target.result;
            document.getElementById('generate-sprite-btn').disabled = false;
            const statusEl = document.getElementById('generation-status');
            if (statusEl) {
                statusEl.textContent = 'Image uploaded! Click "Generate Sprite Sheet" to create your custom character.';
                statusEl.style.color = '#4CAF50';
            }
        };

        reader.readAsDataURL(file);
    }

    async generateSpriteSheet() {
        if (!this.uploadedImage) {
            alert('Please upload an image first');
            return;
        }

        const statusEl = document.getElementById('generation-status');
        const generateBtn = document.getElementById('generate-sprite-btn');
        
        // Smart Caching Check
        const savedImage = localStorage.getItem('original_dog_image');
        const savedSprite = localStorage.getItem('custom_sprite_sheet');
        
        // If the uploaded image matches the saved one, and we have a sprite, use it!
        if (this.uploadedImage === savedImage && savedSprite) {
            console.log('Using cached sprite sheet for identical image.');
            this.currentSpriteSheet = savedSprite;
            this.updatePreviewAndUI(savedSprite, '✓ Using cached sprite sheet (no API call needed). Click "Start Game".');
            return;
        }

        generateBtn.disabled = true;
        statusEl.textContent = 'Analyzing your dog\'s features with Gemini AI...';
        statusEl.style.color = '#ffd700';

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
            
            // Store in localStorage for persistence
            try {
                localStorage.setItem('custom_sprite_sheet', spriteSheetUrl);
                localStorage.setItem('original_dog_image', this.uploadedImage);
            } catch (storageError) {
                console.warn('Failed to save to localStorage (likely too big):', storageError);
                statusEl.textContent += ' (Warning: Sprite too large to cache, but game will work)';
            }
            
            this.updatePreviewAndUI(spriteSheetUrl, '✓ Sprite sheet generated successfully! Click "Start Game" to play.');

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
            
            generateBtn.disabled = false;
        }
    }

    updatePreviewAndUI(spriteUrl, statusMessage) {
        // Show preview
        const preview = document.getElementById('upload-preview');
        preview.innerHTML = `
            <div>
                <img src="${spriteUrl}" alt="Sprite sheet" class="pixelated" style="width: 256px; height: 256px;">
                <p style="margin-top: 10px; font-size: 0.9em;">Sprite Sheet Ready!</p>
            </div>
        `;

        const statusEl = document.getElementById('generation-status');
        statusEl.textContent = statusMessage;
        statusEl.style.color = '#4CAF50';
        
        document.getElementById('start-game-btn').disabled = false;
        document.getElementById('generate-sprite-btn').disabled = false;
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

    loadSavedCharacter() {
        const savedSprite = localStorage.getItem('custom_sprite_sheet');
        const savedImage = localStorage.getItem('original_dog_image');
        
        if (savedSprite) {
            this.currentSpriteSheet = savedSprite;
            this.uploadedImage = savedImage;
            
            const preview = document.getElementById('upload-preview');
            if (savedImage) {
                preview.innerHTML = `<img src="${savedImage}" alt="Dog preview" class="pixelated">`;
            }
            
            document.getElementById('start-game-btn').disabled = false;
            document.getElementById('generation-status').textContent = 'Previous character loaded. You can start the game or upload a new image.';
        }
    }
}

// Initialize character manager when DOM is ready
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        window.characterManager = new CharacterManager();
        window.characterManager.loadSavedCharacter();
    });
}
