/**
 * Main Bootstrap File
 * 
 * This is the single entry point for the application.
 * It imports all modules and wires dependencies together using constructor injection.
 */

// Import all modules so they execute and export to window (temporary during refactoring)
import { CONFIG } from './config.js'; // Initializes CONFIG and sets up API key handlers
import './api.js'; // Imports APIService class (no longer exports to window)
import './game.js'; // Imports Game class (no longer exports to window)

// Import classes and data to instantiate them here
import { AssetStorage } from './AssetStorage.js';
import { APIService } from './api.js';
import { CharacterManager } from './character.js';
import { Game } from './game.js';

// Initialize services
const assetStorage = new AssetStorage();
const apiService = new APIService();

// Initialize CharacterManager with all dependencies
const characterManager = new CharacterManager(apiService, assetStorage, Game);

// Start background generation IMMEDIATELY if backend is configured
// Don't wait for DOM or other initialization - start as soon as possible
(async () => {
    // Check if backend proxy is configured
    if (CONFIG.USE_BACKEND_PROXY && CONFIG.BACKEND_API_URL) {
        // Check if background is already cached and valid
        const cachedMeta = localStorage.getItem('location_background_meta');
        let needsGeneration = true;
        
        if (cachedMeta) {
            try {
                const meta = JSON.parse(cachedMeta);
                const age = Date.now() - meta.timestamp;
                if (age / (1000 * 60 * 60) < 24 && (meta.version || 0) >= 5) {
                    needsGeneration = false;
                    console.log('Background already cached and valid, skipping immediate generation');
                }
            } catch (e) {
                // Invalid metadata, will regenerate
            }
        }
        
        // Also check if frames exist
        if (needsGeneration) {
            const framesStr = await assetStorage.getItem('location_background_frames');
            const localFramesStr = localStorage.getItem('location_background_frames');
            if (framesStr || localFramesStr) {
                try {
                    const frames = framesStr ? JSON.parse(framesStr) : JSON.parse(localFramesStr);
                    if (Array.isArray(frames) && frames.length >= 8) {
                        needsGeneration = false;
                        console.log('Background frames found, skipping immediate generation');
                    }
                } catch (e) {
                    // Invalid frames, will regenerate
                }
            }
        }
        
        if (needsGeneration) {
            console.log('🚀 Starting background generation immediately on page load...');
            // Start background generation immediately (don't await - let it run in background)
            generateLocationBackground()
                .then(() => {
                    console.log('✓ Immediate background generation completed');
                    // Notify CharacterManager that background is ready (so Start Game button can be enabled)
                    if (characterManager && typeof (characterManager as any).checkReadyState === 'function') {
                        (characterManager as any).checkReadyState();
                    }
                })
                .catch((error) => {
                    console.error('Immediate background generation failed:', error);
                });
        }
    }
})();

// Utility function to clear background cache (for testing)
async function clearBackgroundCache(): Promise<void> {
    console.log('Clearing background cache...');
    
    // Clear localStorage
    localStorage.removeItem('location_background_frames');
    localStorage.removeItem('location_background_meta');
    localStorage.removeItem('location_background'); // Old format
    
    // Clear AssetStorage (IndexedDB)
    try {
        await assetStorage.removeItem('location_background_frames');
        await assetStorage.removeItem('location_background');
        console.log('✓ Background cache cleared from both localStorage and IndexedDB');
    } catch (error) {
        console.warn('Could not clear from AssetStorage:', error);
        console.log('✓ Background cache cleared from localStorage');
    }
    
    console.log('Background cache cleared! Refresh the page to regenerate.');
}

// Utility function to clear player sprite sheet cache (for testing)
async function clearPlayerSpriteCache(): Promise<void> {
    console.log('Clearing player sprite sheet cache...');
    
    // Clear localStorage
    localStorage.removeItem('custom_sprite_sheet');
    
    // Clear AssetStorage (IndexedDB)
    try {
        await assetStorage.removeItem('custom_sprite_sheet');
        console.log('✓ Player sprite sheet cache cleared from both localStorage and IndexedDB');
    } catch (error) {
        console.warn('Could not clear from AssetStorage:', error);
        console.log('✓ Player sprite sheet cache cleared from localStorage');
    }
    
    console.log('Player sprite sheet cache cleared! Refresh the page and upload a new dog image to regenerate.');
}

// Utility function to clear cat sprite sheet cache (for testing)
async function clearCatCache(): Promise<void> {
    // Note: Cat sprites use static Cat.png from assets folder, no cache to clear
    console.log('⚠️  Note: The Cat.png file is loaded from assets/Cat.png (static asset, no cache)');
    console.log('⚠️  To force reload, do a hard refresh:');
    console.log('   - Chrome/Edge: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)');
    console.log('   - Firefox: Ctrl+F5 (Windows/Linux) or Cmd+Shift+R (Mac)');
    console.log('   - Safari: Cmd+Option+R');
}

// Export to window for easy console access
if (typeof window !== 'undefined') {
    (window as any).clearBackgroundCache = clearBackgroundCache;
    (window as any).clearPlayerSpriteCache = clearPlayerSpriteCache;
    (window as any).clearCatCache = clearCatCache;
    console.log('💡 Tip: Run clearBackgroundCache() in the console to clear the background cache and force regeneration.');
    console.log('💡 Tip: Run clearPlayerSpriteCache() in the console to clear the player sprite sheet cache and force regeneration.');
    console.log('💡 Tip: Run clearCatCache() in the console to clear the cat sprite sheet cache.');
}

// Asset pre-generation functions (moved from index.html inline script)
async function generateLocationBackground(): Promise<void> {
    // Verify backend proxy is configured
    if (!CONFIG.USE_BACKEND_PROXY || !CONFIG.BACKEND_API_URL) {
        console.log('generateLocationBackground: Backend proxy not configured, skipping background generation');
        return;
    }

    try {
        // Check cache
        const cachedMeta = localStorage.getItem('location_background_meta');
        if (cachedMeta) {
            try {
                const meta = JSON.parse(cachedMeta);
                const age = Date.now() - meta.timestamp;
                if (age / (1000 * 60 * 60) < 24 && (meta.version || 0) >= 5) {
                    console.log('Background already cached and valid (age:', Math.round(age / (1000 * 60 * 60)), 'hours)');
                    return;
                } else {
                    console.log('Background cache expired or wrong version, will regenerate');
                }
            } catch (e) {
                console.warn('Could not parse background metadata, will regenerate:', e);
            }
        } else {
            console.log('No background metadata found, will generate new background');
        }
        
        console.log('Pre-generating location background...');
        console.log('Main: Calling generateLocationBackground()...');
        const bgData = await apiService.generateLocationBackground();
        console.log(`Main: Background generation complete - frameCount: ${bgData.frameCount}, frameWidth: ${bgData.frameWidth}, frameHeight: ${bgData.frameHeight}`);
        console.log(`Main: Frames array length: ${bgData.frames?.length || 0}`);
        if (bgData.frames && bgData.frames.length > 0) {
            console.log(`Main: First frame base64 length: ${bgData.frames[0]?.length || 0}, starts with: ${bgData.frames[0]?.substring(0, 50) || 'none'}`);
        }
        
        // Store frames array in AssetStorage (API already stores it in localStorage)
        // Also store spritesheet if available (for backward compatibility)
        if (bgData.spritesheet) {
            await assetStorage.setItem('location_background', bgData.spritesheet);
        }
        await assetStorage.setItem('location_background_frames', JSON.stringify(bgData.frames));
        
        // Notify CharacterManager that background is ready (so Start Game button can be enabled)
        if (characterManager && typeof (characterManager as any).checkReadyState === 'function') {
            (characterManager as any).checkReadyState();
        }
        
        // Metadata is already stored by apiService.generateLocationBackground()
        // Just ensure it's up to date
        const existingMeta = localStorage.getItem('location_background_meta');
        if (existingMeta) {
            try {
                const meta = JSON.parse(existingMeta);
                meta.timestamp = Date.now();
                localStorage.setItem('location_background_meta', JSON.stringify(meta));
            } catch (e) {
                // If parsing fails, create new metadata
                localStorage.setItem('location_background_meta', JSON.stringify({
                    timestamp: Date.now(),
                    version: 5
                }));
            }
        }
        
        // Update game instance if it exists
        if (characterManager && (characterManager as any).currentGameInstance) {
            const gameInstance = (characterManager as any).currentGameInstance;
            if (typeof gameInstance.updateBackground === 'function') {
                gameInstance.updateBackground();
            }
        }
    } catch (error) {
        console.error('Pre-generation of background failed:', error);
    }
}

// generateLevelTilesPreload function removed - no longer using AI-generated tiles

// generateEnemySpritesPreload function removed - enemies use static Cat.png from assets folder

async function preGenerateGameAssets(): Promise<void> {
    console.log('Starting game asset pre-generation...');
    // Only generate background - enemies use static Cat.png from assets folder
    await generateLocationBackground();
    // Note: Enemy sprites use static Cat.png from assets/Cat.png, no AI generation needed
    console.log('Asset pre-generation complete or skipped due to cache.');
}

// Load cached assets on startup
// Note: Assets are loaded on-demand from AssetStorage in game.ts, no need to assign to window
async function loadCachedAssets(): Promise<void> {
    console.log('Page loaded, cached assets will be loaded on-demand from AssetStorage');
    // Assets are loaded directly from AssetStorage when needed in game.ts
    // No window assignments needed
}

// Minimal window assignments only for HTML button handlers and pause functionality
if (typeof window !== 'undefined') {
    (window as any).characterManager = characterManager; // Needed for pause button
}

// Initialize app
async function initializeApp() {
    // Load cached assets first
    await loadCachedAssets();
    
    // Initialize CharacterManager
    await characterManager.loadSavedCharacter();
    console.log('Main: CharacterManager initialized');
    
    // Initialize config with dependencies
    const { initializeConfig, updateApiKeyStatus } = await import('./config.js');
    await initializeConfig(apiService, preGenerateGameAssets);
    
    // Check if we have API access (either backend proxy or direct API key)
    const hasBackend = CONFIG.USE_BACKEND_PROXY && CONFIG.BACKEND_API_URL;
    const savedKey = localStorage.getItem('gemini_api_key');
    const hasDirectKey = savedKey && apiService.apiKey;
    
    if (hasBackend || hasDirectKey) {
        console.log(hasBackend ? 'Backend proxy configured, checking if assets need pre-generation...' : 'API key found, checking if assets need pre-generation...');
        // updateApiKeyStatus will trigger preGenerateGameAssets if connection/key is valid
        await updateApiKeyStatus(apiService, preGenerateGameAssets);
    } else {
        console.log('No API access configured (neither backend proxy nor API key), asset generation will start when configured');
    }
}

// Wait for DOM to be ready
if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', initializeApp);
    } else {
        // DOM already loaded
        initializeApp();
    }
}

// Export services for use in other modules
export { assetStorage, apiService, characterManager, preGenerateGameAssets };
