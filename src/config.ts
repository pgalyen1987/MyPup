// Configuration file for API keys and settings
// ⚠️ SECURITY WARNING: Do NOT hardcode API keys here if this is a public repository!
// Instead, use environment variables or a backend proxy (see SECURITY.md)

// Animation configuration
export interface AnimationConfig {
    // Player animations
    PLAYER_WALK_RIGHT_START: number;
    PLAYER_WALK_RIGHT_END: number;
    PLAYER_WALK_RIGHT_FRAME_RATE: number;
    PLAYER_WALK_LEFT_START: number;
    PLAYER_WALK_LEFT_END: number;
    PLAYER_WALK_LEFT_FRAME_RATE: number;
    PLAYER_JUMP_START: number;
    PLAYER_JUMP_END: number;
    PLAYER_JUMP_FRAME_RATE: number;
    PLAYER_IDLE_START: number;
    PLAYER_IDLE_END: number;
    PLAYER_IDLE_FRAME_RATE: number;
    
    // Cat enemy animations
    CAT_WALK_RIGHT_START: number;
    CAT_WALK_RIGHT_END: number;
    CAT_WALK_RIGHT_FRAME_RATE: number;
    CAT_WALK_LEFT_START: number;
    CAT_WALK_LEFT_END: number;
    CAT_WALK_LEFT_FRAME_RATE: number;
    CAT_ATTACK_START: number;
    CAT_ATTACK_END: number;
    CAT_ATTACK_FRAME_RATE: number;
    CAT_IDLE_START: number;
    CAT_IDLE_END: number;
    CAT_IDLE_FRAME_RATE: number;
}

// Physics configuration
export interface PhysicsConfig {
    // Collision box multipliers (as percentage of tile size)
    PLAYER_COLLISION_WIDTH_MULTIPLIER: number;  // 0.35
    PLAYER_COLLISION_HEIGHT_MULTIPLIER: number; // 0.75
    PLAYER_COLLISION_OFFSET_Y_MULTIPLIER: number; // 0.15
    ENEMY_COLLISION_SIZE_MULTIPLIER: number;    // 0.75
    ENEMY_COLLISION_OFFSET_MULTIPLIER: number;  // 0.125
    
    // Velocity multipliers (in tiles per second)
    ENEMY_VELOCITY_MULTIPLIER: number;          // 1.25 tiles/sec
    
    // Bounce values
    PLAYER_BOUNCE: number;                       // 0.2
    ENEMY_BOUNCE_X: number;                      // 1
    ENEMY_BOUNCE_Y: number;                     // 0
    
    // Drag
    PLAYER_DRAG_X: number;                      // 2000
}

// Timing configuration
export interface TimingConfig {
    // Retry and timeout values (in milliseconds)
    RETRY_DELAY_SHORT: number;                  // 50ms
    RETRY_DELAY_MEDIUM: number;                 // 100ms
    RETRY_DELAY_LONG: number;                   // 500ms
    RETRY_DELAY_VERY_LONG: number;              // 1000ms
    
    // Max retry attempts
    MAX_RETRY_ATTEMPTS: number;                 // 100
    MAX_BACKGROUND_RETRY_ATTEMPTS: number;      // 60
    
    // Background animation
    BACKGROUND_FRAME_UPDATE_INTERVAL: number;    // 50ms
    BACKGROUND_ANIMATION_SPEED: number;         // 8 fps = 125ms per frame
}

// Visual configuration
export interface VisualConfig {
    // Scaling factors
    PLAYER_SCALE_DEFAULT: number;                // 1.5
    PLAYER_SCALE_FALLBACK: number;               // 0.38
    PLAYER_TARGET_SIZE_MULTIPLIER: number;      // 1.5 (tiles)
    
    // Collectible visual multipliers
    COLLECTIBLE_OUTER_RADIUS_MULTIPLIER: number; // 0.1875
    COLLECTIBLE_INNER_RADIUS_MULTIPLIER: number; // 0.125
    
    // Colors (hex values)
    COLLECTIBLE_OUTER_COLOR: number;             // 0xffd700 (gold)
    COLLECTIBLE_INNER_COLOR: number;             // 0xffed4e (yellow)
    PLATFORM_COLOR: number;                      // 0x8B4513 (brown)
    GROUND_COLOR: number;                        // 0x90EE90 (light green)
    
    // Depth values (z-index)
    DEPTH_BACKGROUND: number;                    // -10
    DEPTH_TILES: number;                         // 0
    DEPTH_COLLECTIBLES_ENEMIES: number;          // 1
    DEPTH_PLAYER: number;                        // 100
}

// API configuration
export interface ApiConfig {
    // Image size constraints
    BACKGROUND_FRAME_WIDTH: number;               // 1024
    BACKGROUND_FRAME_HEIGHT: number;            // 1024
    TILE_IMAGE_SIZE: number;                     // Uses CONFIG.TILE_SIZE (64)
    
    // Frame counts
    BACKGROUND_FRAME_COUNT: number;              // 8
    SPRITE_SHEET_FRAMES_PER_ROW: number;        // 4
    SPRITE_SHEET_ROWS: number;                   // 4
}

// Configuration interface
export interface GameConfig {
    // Debug mode flag
    DEBUG_MODE: boolean;
    
    // Gemini 3 API configuration
    GEMINI_API_KEY: string;
    GEMINI_API_URL: string;
    GEMINI_IMAGE_GEN_URL: string;
    
    // Game settings
    GAME_WIDTH: number;
    GAME_HEIGHT: number;
    GRAVITY: number;
    PLAYER_SPEED: number;
    JUMP_FORCE: number;
    
    // Sprite settings
    SPRITE_SHEET_WIDTH: number;
    SPRITE_SHEET_HEIGHT: number;
    SPRITE_SIZE: number;
    TILE_SIZE: number;
    
    // Animation configuration
    ANIMATION: AnimationConfig;
    
    // Physics configuration
    PHYSICS: PhysicsConfig;
    
    // Timing configuration
    TIMING: TimingConfig;
    
    // Visual configuration
    VISUAL: VisualConfig;
    
    // API configuration
    API: ApiConfig;
}

// Extend Window interface for global functions
declare global {
    interface Window {
        clearApiKey: () => void;
        setApiKey: () => Promise<void>;
        updateApiKeyStatus: () => Promise<void>;
        setDebugMode: (enabled: boolean) => void;
        isDebugMode: () => boolean;
        updateDebugIndicators: () => void;
        api?: any; // Will be typed properly when api.ts is migrated
        preGenerateGameAssets?: () => Promise<void>;
    }
}

// Check for debug mode in URL or localStorage
function isDebugMode(): boolean {
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
function setDebugMode(enabled: boolean): void {
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
function updateDebugIndicators(): void {
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

export const CONFIG: GameConfig = {
    // Debug mode flag
    DEBUG_MODE: DEBUG_MODE,
    
    // Gemini 3 API configuration
    // For production: Use environment variables or backend proxy
    // For development: Enter key when prompted (stored in localStorage only)
    GEMINI_API_KEY: '', // ⚠️ NEVER commit real keys to git!
    
    // Text/Vision analysis: Use Gemini 3 Pro Image Preview for both text and image generation
    // Production: gemini-3-pro-image-preview for all operations
    GEMINI_API_URL: DEBUG_MODE 
        ? 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
        : 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent',
    
    // Image generation: Use Gemini 3 Pro Image Preview (same as text/vision)
    // Production: gemini-3-pro-image-preview for image generation
    GEMINI_IMAGE_GEN_URL: DEBUG_MODE
        ? 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent'
        : 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent',
    
    // Game settings
    GAME_WIDTH: 1024, // Matches background frame width (1024x1024)
    GAME_HEIGHT: 1024, // Matches background frame height (1024x1024)
    GRAVITY: 1600, // Adjusted for new height
    PLAYER_SPEED: 220, 
    JUMP_FORCE: -650,
    
    // Sprite settings
    SPRITE_SHEET_WIDTH: 4, // 4 frames for animation
    SPRITE_SHEET_HEIGHT: 4, // 4 directions/actions
    SPRITE_SIZE: 64, // 64x64 pixels per sprite
    TILE_SIZE: 64, // Universal tile size
    
    // Animation configuration
    ANIMATION: {
        // Player animations (4x4 sprite sheet: 4 frames per row, 4 rows)
        PLAYER_WALK_RIGHT_START: 0,
        PLAYER_WALK_RIGHT_END: 3,
        PLAYER_WALK_RIGHT_FRAME_RATE: 10,
        PLAYER_WALK_LEFT_START: 4,
        PLAYER_WALK_LEFT_END: 7,
        PLAYER_WALK_LEFT_FRAME_RATE: 10,
        PLAYER_JUMP_START: 8,
        PLAYER_JUMP_END: 11,
        PLAYER_JUMP_FRAME_RATE: 10,
        PLAYER_IDLE_START: 12,
        PLAYER_IDLE_END: 15,
        PLAYER_IDLE_FRAME_RATE: 5,
        
        // Cat enemy animations (4x4 sprite sheet: 4 frames per row, 4 rows)
        CAT_WALK_RIGHT_START: 0,
        CAT_WALK_RIGHT_END: 3,
        CAT_WALK_RIGHT_FRAME_RATE: 10,
        CAT_WALK_LEFT_START: 4,
        CAT_WALK_LEFT_END: 7,
        CAT_WALK_LEFT_FRAME_RATE: 10,
        CAT_ATTACK_START: 8,
        CAT_ATTACK_END: 11,
        CAT_ATTACK_FRAME_RATE: 10,
        CAT_IDLE_START: 12,
        CAT_IDLE_END: 15,
        CAT_IDLE_FRAME_RATE: 8,
    },
    
    // Physics configuration
    PHYSICS: {
        // Collision box multipliers (as percentage of tile size)
        PLAYER_COLLISION_WIDTH_MULTIPLIER: 0.35,
        PLAYER_COLLISION_HEIGHT_MULTIPLIER: 0.75,
        PLAYER_COLLISION_OFFSET_Y_MULTIPLIER: 0.15,
        ENEMY_COLLISION_SIZE_MULTIPLIER: 0.75,
        ENEMY_COLLISION_OFFSET_MULTIPLIER: 0.125,
        
        // Velocity multipliers (in tiles per second)
        ENEMY_VELOCITY_MULTIPLIER: 1.25,
        
        // Bounce values
        PLAYER_BOUNCE: 0.2,
        ENEMY_BOUNCE_X: 1,
        ENEMY_BOUNCE_Y: 0,
        
        // Drag
        PLAYER_DRAG_X: 2000,
    },
    
    // Timing configuration
    TIMING: {
        // Retry and timeout values (in milliseconds)
        RETRY_DELAY_SHORT: 50,
        RETRY_DELAY_MEDIUM: 100,
        RETRY_DELAY_LONG: 500,
        RETRY_DELAY_VERY_LONG: 1000,
        
        // Max retry attempts
        MAX_RETRY_ATTEMPTS: 100,
        MAX_BACKGROUND_RETRY_ATTEMPTS: 90, // 90 seconds (90 retries × 1 second delay)
        
        // Background animation
        BACKGROUND_FRAME_UPDATE_INTERVAL: 50,
        BACKGROUND_ANIMATION_SPEED: 2, // fps (slow, smooth background animation)
    },
    
    // Visual configuration
    VISUAL: {
        // Scaling factors
        PLAYER_SCALE_DEFAULT: 1.5,
        PLAYER_SCALE_FALLBACK: 0.38,
        PLAYER_TARGET_SIZE_MULTIPLIER: 1.5,
        
        // Collectible visual multipliers
        COLLECTIBLE_OUTER_RADIUS_MULTIPLIER: 0.1875,
        COLLECTIBLE_INNER_RADIUS_MULTIPLIER: 0.125,
        
        // Colors (hex values)
        COLLECTIBLE_OUTER_COLOR: 0xffd700, // gold
        COLLECTIBLE_INNER_COLOR: 0xffed4e, // yellow
        PLATFORM_COLOR: 0x8B4513, // brown
        GROUND_COLOR: 0x90EE90, // light green
        
        // Depth values (z-index)
        DEPTH_BACKGROUND: -10,
        DEPTH_TILES: 0,
        DEPTH_COLLECTIBLES_ENEMIES: 1,
        DEPTH_PLAYER: 100,
    },
    
    // API configuration
    API: {
        // Image size constraints
        BACKGROUND_FRAME_WIDTH: 1024,
        BACKGROUND_FRAME_HEIGHT: 1024,
        TILE_IMAGE_SIZE: 64, // Uses CONFIG.TILE_SIZE
        
        // Frame counts
        BACKGROUND_FRAME_COUNT: 8,
        SPRITE_SHEET_FRAMES_PER_ROW: 4,
        SPRITE_SHEET_ROWS: 4,
    },
};

// Load API keys from environment or localStorage
async function loadConfig(): Promise<void> {
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
function clearApiKey(): void {
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
// Accepts dependencies to avoid window.* usage
export async function setApiKey(apiService?: any, preGenerateGameAssets?: () => void): Promise<void> {
    const key = prompt(
        'Enter your Gemini 3 API key:\n\n' +
        '⚠️ SECURITY NOTE: Your key will be stored in this browser\'s localStorage\n' +
        'and may be visible in DevTools. Only use on trusted devices.\n\n' +
        'Enter API key (or leave blank to cancel):'
    );
    
    if (key && key.trim()) {
        CONFIG.GEMINI_API_KEY = key.trim();
        localStorage.setItem('gemini_api_key', CONFIG.GEMINI_API_KEY);
        await updateApiKeyStatus(apiService, preGenerateGameAssets); // This will verify and trigger background generation
        console.log('API key saved and verified.');
    } else if (key === '') {
        // User cancelled
        return;
    }
}

// Update the API key status display
// Accepts dependencies to avoid window.* usage
export async function updateApiKeyStatus(apiService?: any, preGenerateGameAssets?: () => void): Promise<void> {
    const statusEl = document.getElementById('api-key-status');
    if (statusEl) {
        if (CONFIG.GEMINI_API_KEY) {
            // Show masked key (first 10 and last 4 characters)
            const maskedKey = CONFIG.GEMINI_API_KEY.substring(0, 10) + '...' + 
                            CONFIG.GEMINI_API_KEY.substring(CONFIG.GEMINI_API_KEY.length - 4);
            statusEl.innerHTML = `⏳ Verifying API Key: <code>${maskedKey}</code>...`;
            statusEl.style.color = '#ffd700';
            
            // Verify the API key
            if (apiService) {
                const verification = await apiService.verifyApiKey();
                if (verification.valid) {
                    statusEl.innerHTML = `✓ API Key Verified: <code>${maskedKey}</code>`;
                    statusEl.style.color = '#4CAF50';
                    
                    // Trigger asset pre-generation immediately after successful verification
                    if (preGenerateGameAssets) {
                        console.log('API key verified, starting asset pre-generation...');
                        // Don't await - let it run in background, but catch errors
                        Promise.resolve(preGenerateGameAssets()).catch((error: any) => {
                            console.error('Error during asset pre-generation:', error);
                        });
                    } else {
                        console.warn('updateApiKeyStatus: preGenerateGameAssets function not provided');
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
// Accepts dependencies to avoid window.* usage
export async function initializeConfig(apiService?: any, preGenerateGameAssets?: () => void): Promise<void> {
    // Function to set up event listeners (can be called immediately or on DOMContentLoaded)
    async function setupConfig(): Promise<void> {
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
            console.log('✓ Production Mode - Using gemini-3-pro-image-preview for all operations');
            console.log('   Press D to toggle debug mode');
        }
        
        // Add keyboard shortcut for 'D' key to toggle debug mode
        document.addEventListener('keydown', (event) => {
            // Only trigger if not typing in an input field
            if (event.key.toLowerCase() === 'd' && 
                event.target && 
                (event.target as HTMLElement).tagName !== 'INPUT' && 
                (event.target as HTMLElement).tagName !== 'TEXTAREA') {
                event.preventDefault();
                const newDebugMode = !CONFIG.DEBUG_MODE;
                console.log(`Toggling debug mode: ${CONFIG.DEBUG_MODE} → ${newDebugMode}`);
                setDebugMode(newDebugMode);
            }
        });
        
        // Set up clear API key button
        const clearBtn = document.getElementById('clear-api-key-btn');
        if (clearBtn) {
            // Remove existing listeners to avoid duplicates
            const newClearBtn = clearBtn.cloneNode(true);
            clearBtn.parentNode?.replaceChild(newClearBtn, clearBtn);
            newClearBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to clear the API key? You will need to enter it again to use the game.')) {
                    clearApiKey();
                }
            });
        }
        
        // Set up set/change API key button
        const setBtn = document.getElementById('set-api-key-btn');
        if (setBtn) {
            // Remove existing listeners to avoid duplicates
            const newSetBtn = setBtn.cloneNode(true);
            setBtn.parentNode?.replaceChild(newSetBtn, setBtn);
            newSetBtn.addEventListener('click', async () => {
                await setApiKey(apiService, preGenerateGameAssets);
            });
        }
    }
    
    // Export functions for global access (needed for HTML button handlers)
    // These are minimal window exports required for UI functionality
    if (typeof window !== 'undefined') {
        window.clearApiKey = clearApiKey;
        window.setApiKey = () => setApiKey(apiService, preGenerateGameAssets);
        window.updateApiKeyStatus = () => updateApiKeyStatus(apiService, preGenerateGameAssets);
        window.setDebugMode = setDebugMode;
        window.isDebugMode = () => CONFIG.DEBUG_MODE;
        window.updateDebugIndicators = updateDebugIndicators;
        
        // Export CONFIG for global access (needed for debug mode toggle)
        (window as any).CONFIG = CONFIG;
    }
    
    // Initialize when DOM is ready, or immediately if already ready
    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', () => {
            setupConfig().catch(console.error);
        });
    } else {
        // DOM is already loaded, initialize immediately
        setupConfig().catch(console.error);
    }
}
