/**
 * Configuration file for API keys and settings
 */

// Animation configuration
export interface AnimationConfig {
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
    PLAYER_COLLISION_WIDTH_MULTIPLIER: number;
    PLAYER_COLLISION_HEIGHT_MULTIPLIER: number;
    PLAYER_COLLISION_OFFSET_Y_MULTIPLIER: number;
    ENEMY_COLLISION_SIZE_MULTIPLIER: number;
    ENEMY_COLLISION_OFFSET_MULTIPLIER: number;
    ENEMY_VELOCITY_MULTIPLIER: number;
    PLAYER_BOUNCE: number;
    ENEMY_BOUNCE_X: number;
    ENEMY_BOUNCE_Y: number;
    PLAYER_DRAG_X: number;
}

// Timing configuration
export interface TimingConfig {
    RETRY_DELAY_SHORT: number;
    RETRY_DELAY_MEDIUM: number;
    RETRY_DELAY_LONG: number;
    RETRY_DELAY_VERY_LONG: number;
    MAX_RETRY_ATTEMPTS: number;
    MAX_BACKGROUND_RETRY_ATTEMPTS: number;
    BACKGROUND_FRAME_UPDATE_INTERVAL: number;
    BACKGROUND_ANIMATION_SPEED: number;
}

// Visual configuration
export interface VisualConfig {
    PLAYER_SCALE_DEFAULT: number;
    PLAYER_SCALE_FALLBACK: number;
    PLAYER_TARGET_SIZE_MULTIPLIER: number;
    COLLECTIBLE_OUTER_RADIUS_MULTIPLIER: number;
    COLLECTIBLE_INNER_RADIUS_MULTIPLIER: number;
    COLLECTIBLE_OUTER_COLOR: number;
    COLLECTIBLE_INNER_COLOR: number;
    PLATFORM_COLOR: number;
    GROUND_COLOR: number;
    DEPTH_BACKGROUND: number;
    DEPTH_TILES: number;
    DEPTH_COLLECTIBLES_ENEMIES: number;
    DEPTH_PLAYER: number;
}

// API configuration
export interface ApiConfig {
    BACKGROUND_FRAME_WIDTH: number;
    BACKGROUND_FRAME_HEIGHT: number;
    TILE_IMAGE_SIZE: number;
    BACKGROUND_FRAME_COUNT: number;
    SPRITE_SHEET_FRAMES_PER_ROW: number;
    SPRITE_SHEET_ROWS: number;
}

// Configuration interface
export interface GameConfig {
    DEBUG_MODE: boolean;
    GEMINI_API_KEY: string;
    GEMINI_API_URL: string;
    GEMINI_IMAGE_GEN_URL: string;
    BACKEND_API_URL: string;
    USE_BACKEND_PROXY: boolean;
    GAME_WIDTH: number;
    GAME_HEIGHT: number;
    GRAVITY: number;
    PLAYER_SPEED: number;
    JUMP_FORCE: number;
    SPRITE_SHEET_WIDTH: number;
    SPRITE_SHEET_HEIGHT: number;
    SPRITE_SIZE: number;
    TILE_SIZE: number;
    ANIMATION: AnimationConfig;
    PHYSICS: PhysicsConfig;
    TIMING: TimingConfig;
    VISUAL: VisualConfig;
    API: ApiConfig;
}

// Check for debug mode in URL or localStorage
function isDebugMode(): boolean {
    if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('debug') === 'true' || urlParams.get('debug') === '1') {
            return true;
        }
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
    CONFIG.DEBUG_MODE = enabled;
    updateDebugIndicators();
    console.log(`Debug mode ${enabled ? 'ENABLED' : 'DISABLED'}. Reloading page...`);
    window.location.reload();
}

// Update debug indicators in UI
function updateDebugIndicators(): void {
    const isDebug = CONFIG.DEBUG_MODE;

    const debugIndicator = document.getElementById('debug-mode-indicator');
    if (debugIndicator) {
        if (isDebug) {
            debugIndicator.style.display = 'block';
            debugIndicator.innerHTML = '🐛 DEBUG MODE: Using gemini-2.5-flash models';
        } else {
            debugIndicator.style.display = 'none';
        }
    }

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
    DEBUG_MODE: DEBUG_MODE,

    GEMINI_API_KEY: '',

    BACKEND_API_URL: 'https://apiproxy-kdh2fuqrca-uc.a.run.app',
    USE_BACKEND_PROXY: true,

    GEMINI_API_URL: DEBUG_MODE
        ? 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
        : 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent',

    GEMINI_IMAGE_GEN_URL: DEBUG_MODE
        ? 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent'
        : 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent',

    GAME_WIDTH: 1024,
    GAME_HEIGHT: 1024,
    GRAVITY: 1600,
    PLAYER_SPEED: 220,
    JUMP_FORCE: -650,

    SPRITE_SHEET_WIDTH: 4,
    SPRITE_SHEET_HEIGHT: 4,
    SPRITE_SIZE: 64,
    TILE_SIZE: 64,

    ANIMATION: {
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

    PHYSICS: {
        PLAYER_COLLISION_WIDTH_MULTIPLIER: 0.35,
        PLAYER_COLLISION_HEIGHT_MULTIPLIER: 0.75,
        PLAYER_COLLISION_OFFSET_Y_MULTIPLIER: 0.15,
        ENEMY_COLLISION_SIZE_MULTIPLIER: 0.75,
        ENEMY_COLLISION_OFFSET_MULTIPLIER: 0.125,
        ENEMY_VELOCITY_MULTIPLIER: 1.25,
        PLAYER_BOUNCE: 0.2,
        ENEMY_BOUNCE_X: 1,
        ENEMY_BOUNCE_Y: 0,
        PLAYER_DRAG_X: 2000,
    },

    TIMING: {
        RETRY_DELAY_SHORT: 50,
        RETRY_DELAY_MEDIUM: 100,
        RETRY_DELAY_LONG: 500,
        RETRY_DELAY_VERY_LONG: 1000,
        MAX_RETRY_ATTEMPTS: 100,
        MAX_BACKGROUND_RETRY_ATTEMPTS: 90,
        BACKGROUND_FRAME_UPDATE_INTERVAL: 50,
        BACKGROUND_ANIMATION_SPEED: 2,
    },

    VISUAL: {
        PLAYER_SCALE_DEFAULT: 2.5,
        PLAYER_SCALE_FALLBACK: 0.38,
        PLAYER_TARGET_SIZE_MULTIPLIER: 2.5,
        COLLECTIBLE_OUTER_RADIUS_MULTIPLIER: 0.1875,
        COLLECTIBLE_INNER_RADIUS_MULTIPLIER: 0.125,
        COLLECTIBLE_OUTER_COLOR: 0xffd700,
        COLLECTIBLE_INNER_COLOR: 0xffed4e,
        PLATFORM_COLOR: 0x8B4513,
        GROUND_COLOR: 0x90EE90,
        DEPTH_BACKGROUND: -10,
        DEPTH_TILES: 0,
        DEPTH_COLLECTIBLES_ENEMIES: 1,
        DEPTH_PLAYER: 100,
    },

    API: {
        BACKGROUND_FRAME_WIDTH: 1024,
        BACKGROUND_FRAME_HEIGHT: 1024,
        TILE_IMAGE_SIZE: 64,
        BACKGROUND_FRAME_COUNT: 8,
        SPRITE_SHEET_FRAMES_PER_ROW: 4,
        SPRITE_SHEET_ROWS: 4,
    },
};

// Load API keys from environment or localStorage
async function loadConfig(): Promise<void> {
    // Config is already set up for backend proxy
}

// Update the backend connection status
export async function updateApiKeyStatus(apiService?: any, preGenerateGameAssets?: () => void): Promise<void> {
    if (CONFIG.USE_BACKEND_PROXY && CONFIG.BACKEND_API_URL) {
        if (apiService) {
            const verification = await apiService.verifyApiKey();
            if (verification.valid) {
                console.log('✓ Backend proxy connected and verified');
                if (preGenerateGameAssets) {
                    console.log('Backend verified, starting asset pre-generation...');
                    Promise.resolve(preGenerateGameAssets()).catch((error: any) => {
                        console.error('Error during asset pre-generation:', error);
                    });
                }
            } else {
                console.warn(`⚠️ Backend connection issue: ${verification.error || 'Unable to verify'}`);
            }
        }
        return;
    }

    console.warn('⚠️ Backend proxy not configured.');
}

// Initialize config on load
export async function initializeConfig(apiService?: any, preGenerateGameAssets?: () => void): Promise<void> {
    async function setupConfig(): Promise<void> {
        await new Promise(resolve => setTimeout(resolve, 100));

        await loadConfig();

        updateDebugIndicators();

        if (CONFIG.DEBUG_MODE) {
            console.log('🐛 DEBUG MODE ENABLED - Using gemini-2.5-flash models');
            console.log('   Text Model:', CONFIG.GEMINI_API_URL);
            console.log('   Image Model:', CONFIG.GEMINI_IMAGE_GEN_URL);
        } else {
            console.log('✓ Production Mode - Using gemini-3-pro-image-preview');
        }

        document.addEventListener('keydown', (event) => {
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
    }

    // Export functions for global access
    if (typeof window !== 'undefined') {
        (window as any).updateApiKeyStatus = () => updateApiKeyStatus(apiService, preGenerateGameAssets);
        (window as any).setDebugMode = setDebugMode;
        (window as any).isDebugMode = () => CONFIG.DEBUG_MODE;
        window.updateDebugIndicators = updateDebugIndicators;
        (window as any).CONFIG = CONFIG;
    }

    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', () => {
            setupConfig().catch(console.error);
        });
    } else {
        setupConfig().catch(console.error);
    }
}