// Configuration file for API keys and settings
// ⚠️ SECURITY WARNING: Do NOT hardcode API keys here if this is a public repository!
// Instead, use environment variables or a backend proxy (see SECURITY.md)

// Check for debug mode in URL or localStorage
function isDebugMode() {
    // Check URL parameter
    if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('debug') === 'true' || urlParams.get('debug') === '1') {
            return true;
        }
        // Check localStorage
        return localStorage.getItem('debug_mode') === 'true';
    }
    return false;
}

// Set debug mode
function setDebugMode(enabled) {
    if (enabled) {
        localStorage.setItem('debug_mode', 'true');
    } else {
        localStorage.removeItem('debug_mode');
    }
    // Update CONFIG immediately
    CONFIG.DEBUG_MODE = enabled;
    // Update UI indicators
    updateDebugIndicators();
    // Reload to apply API URL changes
    console.log(`Debug mode ${enabled ? 'ENABLED' : 'DISABLED'}. Reloading page...`);
    window.location.reload();
}

// Update debug indicators in UI
function updateDebugIndicators() {
    const isDebug = CONFIG.DEBUG_MODE;
    
    // Update menu indicator
    const debugIndicator = document.getElementById('debug-mode-indicator');
    if (debugIndicator) {
        if (isDebug) {
            debugIndicator.style.display = 'block';
            debugIndicator.innerHTML = '🐛 DEBUG MODE: Using gemini-2.5-flash models';
        } else {
            debugIndicator.style.display = 'none';
        }
    }
    
    // Update game indicator
    const debugIndicatorGame = document.getElementById('debug-mode-indicator-game');
    if (debugIndicatorGame) {
        if (isDebug) {
            debugIndicatorGame.style.display = 'block';
            debugIndicatorGame.innerHTML = '🐛 DEBUG: gemini-2.5-flash';
        } else {
            debugIndicatorGame.style.display = 'none';
        }
    }
}

const DEBUG_MODE = isDebugMode();

const CONFIG = {
    // Debug mode flag
    DEBUG_MODE: DEBUG_MODE,
    
    // Gemini 3 API configuration
    // For production: Use environment variables or backend proxy
    // For development: Enter key when prompted (stored in localStorage only)
    GEMINI_API_KEY: '', // ⚠️ NEVER commit real keys to git!
    
    // Text/Vision analysis: Use Gemini 3 preview (Multimodal) or Gemini 2.5 Flash in debug mode
    // Based on test results: gemini-3-pro-image-preview is available
    GEMINI_API_URL: DEBUG_MODE 
        ? 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
        : 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
    
    // Image generation: Use Gemini 3 preview or Gemini 2.5 Flash Image in debug mode
    // Based on test results: gemini-3-pro-image-preview is available and returns images
    GEMINI_IMAGE_GEN_URL: DEBUG_MODE
        ? 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent'
        : 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent',
    
    // Game settings
    GAME_WIDTH: 512, // Matches background frame width (512x512)
    GAME_HEIGHT: 512, // Matches background frame height (512x512)
    GRAVITY: 1600, // Adjusted for new height
    PLAYER_SPEED: 220, 
    JUMP_FORCE: -650,
    
    // Sprite settings
    SPRITE_SHEET_WIDTH: 4, // 4 frames for animation
    SPRITE_SHEET_HEIGHT: 4, // 4 directions/actions
    SPRITE_SIZE: 64, // 64x64 pixels per sprite
    TILE_SIZE: 64, // Universal tile size
};

// Load API keys from environment or localStorage
async function loadConfig() {
    // Try to load from localStorage first
    const savedGeminiKey = localStorage.getItem('gemini_api_key');
    
    if (savedGeminiKey) {
        CONFIG.GEMINI_API_KEY = savedGeminiKey;
    }
    
    // Update UI to show API key status (this will verify and trigger background generation)
    await updateApiKeyStatus();
    
    // If not in localStorage, don't prompt automatically - let user click button
}

// Clear API key from localStorage and config
function clearApiKey() {
    localStorage.removeItem('gemini_api_key');
    CONFIG.GEMINI_API_KEY = '';
    // Update status without verification (since key is cleared)
    const statusEl = document.getElementById('api-key-status');
    if (statusEl) {
        statusEl.innerHTML = '⚠ No API Key Set - Click "Set/Change API Key" to enter one';
        statusEl.style.color = '#ff6b6b';
    }
    console.log('API key cleared. Please set a new key to use the game.');
}

// Set or update API key
async function setApiKey() {
    const key = prompt(
        'Enter your Gemini 3 API key:\n\n' +
        '⚠️ SECURITY NOTE: Your key will be stored in this browser\'s localStorage\n' +
        'and may be visible in DevTools. Only use on trusted devices.\n\n' +
        'Enter API key (or leave blank to cancel):'
    );
    
    if (key && key.trim()) {
        CONFIG.GEMINI_API_KEY = key.trim();
        localStorage.setItem('gemini_api_key', CONFIG.GEMINI_API_KEY);
        await updateApiKeyStatus(); // This will verify and trigger background generation
        console.log('API key saved and verified.');
    } else if (key === '') {
        // User cancelled
        return;
    }
}

// Update the API key status display
async function updateApiKeyStatus() {
    const statusEl = document.getElementById('api-key-status');
    if (statusEl) {
        if (CONFIG.GEMINI_API_KEY) {
            // Show masked key (first 10 and last 4 characters)
            const maskedKey = CONFIG.GEMINI_API_KEY.substring(0, 10) + '...' + 
                            CONFIG.GEMINI_API_KEY.substring(CONFIG.GEMINI_API_KEY.length - 4);
            statusEl.innerHTML = `⏳ Verifying API Key: <code>${maskedKey}</code>...`;
            statusEl.style.color = '#ffd700';
            
            // Verify the API key
            if (window.api) {
                const verification = await window.api.verifyApiKey();
                if (verification.valid) {
                    statusEl.innerHTML = `✓ API Key Verified: <code>${maskedKey}</code>`;
                    statusEl.style.color = '#4CAF50';
                    
                    // Trigger asset pre-generation immediately after successful verification
                    if (window.preGenerateGameAssets) {
                        console.log('API key verified, starting asset pre-generation...');
                        window.preGenerateGameAssets();
                    } else {
                        console.warn('preGenerateGameAssets function not available yet');
                    }
                } else {
                    statusEl.innerHTML = `❌ API Key Invalid: <code>${maskedKey}</code><br><small>${verification.error}</small>`;
                    statusEl.style.color = '#ff6b6b';
                }
            } else {
                // API service not ready yet, just show key is set
                statusEl.innerHTML = `✓ API Key Set: <code>${maskedKey}</code>`;
                statusEl.style.color = '#4CAF50';
            }
        } else {
            statusEl.innerHTML = '⚠ No API Key Set - Click "Set/Change API Key" to enter one';
            statusEl.style.color = '#ff6b6b';
        }
    }
}

// Initialize config on load
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', async () => {
        // Wait a tiny bit to ensure all scripts are loaded
        await new Promise(resolve => setTimeout(resolve, 100));
        
        await loadConfig();
        
        // Show debug mode status in console and UI
        updateDebugIndicators();
        
        if (CONFIG.DEBUG_MODE) {
            console.log('🐛 DEBUG MODE ENABLED - Using gemini-2.5-flash models');
            console.log('   Text Model:', CONFIG.GEMINI_API_URL);
            console.log('   Image Model:', CONFIG.GEMINI_IMAGE_GEN_URL);
            console.log('   Press D to toggle debug mode');
        } else {
            console.log('✓ Production Mode - Using gemini-3-pro-image-preview models');
            console.log('   Press D to toggle debug mode');
        }
        
        // Add keyboard shortcut for 'D' key to toggle debug mode
        document.addEventListener('keydown', (event) => {
            // Only trigger if not typing in an input field
            if (event.key.toLowerCase() === 'd' && 
                event.target.tagName !== 'INPUT' && 
                event.target.tagName !== 'TEXTAREA') {
                event.preventDefault();
                const newDebugMode = !CONFIG.DEBUG_MODE;
                console.log(`Toggling debug mode: ${CONFIG.DEBUG_MODE} → ${newDebugMode}`);
                setDebugMode(newDebugMode);
            }
        });
        
        // Set up clear API key button
        const clearBtn = document.getElementById('clear-api-key-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to clear the API key? You will need to enter it again to use the game.')) {
                    clearApiKey();
                }
            });
        }
        
        // Set up set/change API key button
        const setBtn = document.getElementById('set-api-key-btn');
        if (setBtn) {
            setBtn.addEventListener('click', () => {
                setApiKey();
            });
        }
    });
    
    // Export functions for global access
    window.clearApiKey = clearApiKey;
    window.setApiKey = setApiKey;
    window.updateApiKeyStatus = updateApiKeyStatus;
    window.setDebugMode = setDebugMode;
    window.isDebugMode = () => CONFIG.DEBUG_MODE;
    window.updateDebugIndicators = updateDebugIndicators;
}
