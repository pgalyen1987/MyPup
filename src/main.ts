/**
 * main.ts
 * Main Bootstrap File - Application Entry Point
 */

import { CONFIG, initializeConfig, updateApiKeyStatus } from './config.js';
import { AssetStorage } from './AssetStorage.js';
import { APIService } from './api/api.js';
import { CharacterManager } from './character.js';
import { Game } from './game/Game.js';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface AssetStatus {
    characterManager: {
        sprite: boolean;
        background: boolean;
        canStart: boolean;
    };
    backgroundFramesLength: number;
    backgroundMeta: string | null;
    hasCustomCharacter: string | null;
}

interface LoadingProgress {
    background: boolean;
    enemies: {
        cat: boolean;
        bird: boolean;
        squirrel: boolean;
        mailman: boolean;
    };
    totalSteps: number;
    completedSteps: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SESSION_MARKER_KEY = 'mypup_session_active';
const CACHE_VERSION_KEY = 'mypup_cache_version';
const CURRENT_CACHE_VERSION = '1'; // Increment this to force cache clear on deploy

// ============================================================================
// LOADING STATE
// ============================================================================

const loadingProgress: LoadingProgress = {
    background: false,
    enemies: {
        cat: false,
        bird: false,
        squirrel: false,
        mailman: false,
    },
    totalSteps: 5, // 1 background + 4 enemies
    completedSteps: 0,
};

// Track if generation has started to prevent duplicates
let backgroundGenerationStarted = false;
let enemyGenerationStarted = false;

// ============================================================================
// SERVICE INITIALIZATION
// ============================================================================

const assetStorage = new AssetStorage();
const apiService = new APIService();
const characterManager = new CharacterManager(apiService, assetStorage, Game);

// ============================================================================
// WINDOW EXPORTS (for debugging and HTML handlers)
// ============================================================================

if (typeof window !== 'undefined') {
    (window as any).characterManager = characterManager;
    (window as any).clearBackgroundCache = clearBackgroundCache;
    (window as any).getAssetStatus = getAssetStatus;
    (window as any).clearAllCaches = clearAllCaches;
    (window as any).retryBackgroundGeneration = retryBackgroundGeneration;
    (window as any).retrySpriteGeneration = retrySpriteGeneration;
    (window as any).getLoadingProgress = () => loadingProgress;
    (window as any).forceHardReload = forceHardReload;
}

// ============================================================================
// RELOAD DETECTION
// ============================================================================

/**
 * Determines if this is a hard reload (cache should be cleared) or soft reload
 *
 * Hard reload scenarios:
 * - First visit to the site
 * - Ctrl+Shift+R / Shift+F5
 * - Browser cache cleared
 * - New browser session (all tabs closed)
 * - Cache version mismatch (new deployment)
 *
 * Soft reload scenarios:
 * - Regular refresh (F5 / Ctrl+R)
 * - Navigation back to page
 * - Game over -> return to menu -> start again
 */
function isHardReload(): boolean {
    // Check 1: Cache version mismatch (new deployment)
    const storedVersion = localStorage.getItem(CACHE_VERSION_KEY);
    if (storedVersion !== CURRENT_CACHE_VERSION) {
        console.log('Cache version mismatch - treating as hard reload');
        localStorage.setItem(CACHE_VERSION_KEY, CURRENT_CACHE_VERSION);
        return true;
    }

    // Check 2: Session marker doesn't exist (new session or hard reload)
    const sessionMarker = sessionStorage.getItem(SESSION_MARKER_KEY);
    if (!sessionMarker) {
        console.log('No session marker found - treating as hard reload');
        return true;
    }

    // Check 3: Use Performance API to detect reload type
    if (typeof performance !== 'undefined' && performance.getEntriesByType) {
        const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
        if (navEntries.length > 0) {
            const navType = navEntries[0].type;

            // 'reload' with no session marker = hard reload
            // 'navigate' = new navigation
            // 'back_forward' = browser back/forward
            if (navType === 'navigate') {
                console.log('New navigation detected');
                // Could be hard reload or first visit
                // Session marker check above handles this
            }
        }
    }

    // Check 4: Legacy Navigation Timing API (fallback)
    if (typeof performance !== 'undefined' && (performance as any).navigation) {
        const navType = (performance as any).navigation.type;
        // TYPE_RELOAD = 1, but we can't distinguish hard vs soft with this alone
    }

    console.log('Session marker exists - treating as soft reload');
    return false;
}

/**
 * Set the session marker to indicate an active session
 */
function setSessionMarker(): void {
    sessionStorage.setItem(SESSION_MARKER_KEY, Date.now().toString());
}

/**
 * Force a hard reload - clears session marker and reloads
 */
function forceHardReload(): void {
    console.log('Forcing hard reload...');
    sessionStorage.removeItem(SESSION_MARKER_KEY);
    localStorage.removeItem(CACHE_VERSION_KEY);
    window.location.reload();
}

// ============================================================================
// LOADING UI MANAGEMENT
// ============================================================================

function updateLoadingUI(): void {
    const percentage = Math.round((loadingProgress.completedSteps / loadingProgress.totalSteps) * 100);

    // Update progress bar
    const progressFill = document.getElementById('loading-bar-fill');
    const progressText = document.getElementById('loading-percentage');

    if (progressFill) {
        progressFill.style.width = `${percentage}%`;
    }

    if (progressText) {
        progressText.textContent = `${percentage}%`;
    }

    // Update background status
    const backgroundItem = document.getElementById('loading-background');
    if (backgroundItem) {
        const icon = backgroundItem.querySelector('.loading-icon');
        if (icon) {
            icon.textContent = loadingProgress.background ? '✅' : '⏳';
        }
    }

    // Update enemies status
    const enemiesItem = document.getElementById('loading-enemies');
    if (enemiesItem) {
        const icon = enemiesItem.querySelector('.loading-icon');
        const allEnemiesDone = Object.values(loadingProgress.enemies).every((v) => v);
        if (icon) {
            icon.textContent = allEnemiesDone ? '✅' : '⏳';
        }
    }

    // Update subtitle with current task
    const subtitle = document.getElementById('loading-subtitle');
    if (subtitle) {
        if (!loadingProgress.background) {
            subtitle.textContent = 'Generating background...';
        } else {
            const pendingEnemies = Object.entries(loadingProgress.enemies)
                .filter(([_, done]) => !done)
                .map(([name]) => name);

            if (pendingEnemies.length > 0) {
                subtitle.textContent = `Generating ${pendingEnemies[0]} sprite...`;
            } else {
                subtitle.textContent = 'Almost ready!';
            }
        }
    }
}

function showLoadingScreen(): void {
    const loadingScreen = document.getElementById('loading-screen');
    const menuScreen = document.getElementById('menu-screen');

    if (loadingScreen) loadingScreen.classList.remove('hidden');
    if (menuScreen) menuScreen.classList.add('hidden');
}

function hideLoadingScreen(): void {
    const loadingScreen = document.getElementById('loading-screen');
    const menuScreen = document.getElementById('menu-screen');

    if (loadingScreen) loadingScreen.classList.add('hidden');
    if (menuScreen) menuScreen.classList.remove('hidden');
}

function isLoadingComplete(): boolean {
    return loadingProgress.completedSteps >= loadingProgress.totalSteps;
}

// ============================================================================
// CACHE MANAGEMENT
// ============================================================================

async function clearAllCachesOnLoad(): Promise<void> {
    console.log('🧹 Clearing all cached assets for fresh generation...');

    // Clear ALL localStorage except session/version markers
    try {
        const keysToPreserve = [SESSION_MARKER_KEY, CACHE_VERSION_KEY, 'debug_mode'];
        const keysToRemove: string[] = [];

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && !keysToPreserve.includes(key)) {
                keysToRemove.push(key);
            }
        }

        keysToRemove.forEach(key => localStorage.removeItem(key));
        console.log('✓ localStorage cleared');
    } catch (e) {
        console.warn('Could not clear localStorage:', e);
    }

    // Clear AssetStorage
    const keysToRemove = [
        'location_background_frames',
        'location_background_meta',
        'location_background',
        'custom_sprite_sheet',
        'original_dog_image',
        'has_custom_character',
    ];

    for (const key of keysToRemove) {
        try {
            await assetStorage.removeItem(key);
        } catch {
            // Ignore errors
        }
    }

    // Clear the uploaded image preview
    clearUploadPreview();

    // Reset the file input
    resetFileInput();

    // Reset loading progress
    loadingProgress.background = false;
    loadingProgress.enemies.cat = false;
    loadingProgress.enemies.bird = false;
    loadingProgress.enemies.squirrel = false;
    loadingProgress.enemies.mailman = false;
    loadingProgress.completedSteps = 0;

    // Reset generation flags
    backgroundGenerationStarted = false;
    enemyGenerationStarted = false;

    console.log('✓ All caches cleared');
}

/**
 * Check if we have valid cached assets that can be reused
 */
async function checkForValidCachedAssets(): Promise<boolean> {
    try {
        // Check for cached background
        const backgroundFrames = localStorage.getItem('location_background_frames');
        if (!backgroundFrames) {
            console.log('No cached background found');
            return false;
        }

        const frames = JSON.parse(backgroundFrames);
        if (!Array.isArray(frames) || frames.length < 8) {
            console.log('Cached background invalid or incomplete');
            return false;
        }

        // Check for cached enemy sprites
        const enemyTypes = ['cat', 'bird', 'squirrel', 'mailman'];
        let hasAllEnemies = true;

        for (const type of enemyTypes) {
            const sprite = localStorage.getItem(`enemy_${type}_spritesheet`);
            if (!sprite || sprite.length < 1000) {
                console.log(`Missing or invalid cached sprite for ${type}`);
                hasAllEnemies = false;
                break;
            }
        }

        if (!hasAllEnemies) {
            return false;
        }

        console.log('✓ Found valid cached assets');
        return true;
    } catch (error) {
        console.warn('Error checking cached assets:', error);
        return false;
    }
}

/**
 * Mark all assets as loaded from cache
 */
function markAssetsAsLoaded(): void {
    loadingProgress.background = true;
    loadingProgress.enemies.cat = true;
    loadingProgress.enemies.bird = true;
    loadingProgress.enemies.squirrel = true;
    loadingProgress.enemies.mailman = true;
    loadingProgress.completedSteps = loadingProgress.totalSteps;
}

function clearUploadPreview(): void {
    const preview = document.getElementById('upload-preview');
    if (preview) {
        preview.innerHTML = '';
    }

    // Reset character manager's uploaded image state
    characterManager.clearUploadedImage();
}

function resetFileInput(): void {
    const fileInput = document.getElementById('dog-image-upload') as HTMLInputElement | null;
    if (fileInput) {
        fileInput.value = '';
    }
}

// ============================================================================
// BACKGROUND GENERATION
// ============================================================================

async function generateLocationBackground(): Promise<void> {
    // Prevent duplicate calls
    if (backgroundGenerationStarted) {
        console.log('Background generation already started, skipping duplicate call');
        return;
    }

    if (!CONFIG.USE_BACKEND_PROXY || !CONFIG.BACKEND_API_URL) {
        console.log('Skipping background generation: No backend configured.');
        loadingProgress.background = true;
        loadingProgress.completedSteps++;
        updateLoadingUI();
        checkLoadingComplete();
        return;
    }

    backgroundGenerationStarted = true;

    try {
        console.log('🚀 Generating new location background...');

        const bgData = await apiService.generateLocationBackground();

        if (bgData.frames && bgData.frames.length >= 8) {
            await assetStorage.setItem('location_background_frames', JSON.stringify(bgData.frames));
            console.log('✓ Background generation complete');

            loadingProgress.background = true;
            loadingProgress.completedSteps++;
            updateLoadingUI();
            checkLoadingComplete();
        } else {
            throw new Error('Invalid background data received');
        }

        notifyCharacterManager();

        // Update live game if running
        if (characterManager.currentGameInstance?.updateBackground) {
            characterManager.currentGameInstance.updateBackground();
        }

    } catch (error) {
        console.error('Background generation failed:', error);

        // Reset flag to allow retry
        backgroundGenerationStarted = false;

        // Retry with exponential backoff
        const retryDelay = 10000;
        console.log(`Retrying background generation in ${retryDelay / 1000}s...`);

        const subtitle = document.getElementById('loading-subtitle');
        if (subtitle) {
            subtitle.textContent = 'Background generation failed. Retrying...';
        }

        setTimeout(() => generateLocationBackground(), retryDelay);
    }
}

function notifyCharacterManager(): void {
    if (typeof characterManager.checkAllAssetsReady === 'function') {
        characterManager.checkAllAssetsReady();
    }
}

// ============================================================================
// ENEMY ASSET PRE-GENERATION
// ============================================================================

async function preGenerateEnemyAssets(): Promise<void> {
    // Prevent duplicate calls
    if (enemyGenerationStarted) {
        console.log('Enemy generation already started, skipping duplicate call');
        return;
    }

    if (!CONFIG.USE_BACKEND_PROXY || !CONFIG.BACKEND_API_URL) {
        // Mark all as complete if no backend
        const enemyTypes = ['cat', 'bird', 'squirrel', 'mailman'] as const;
        for (const type of enemyTypes) {
            loadingProgress.enemies[type] = true;
            loadingProgress.completedSteps++;
        }
        updateLoadingUI();
        checkLoadingComplete();
        return;
    }

    enemyGenerationStarted = true;

    const enemyTypes = ['cat', 'bird', 'squirrel', 'mailman'] as const;

    for (const type of enemyTypes) {
        console.log(`Pre-generating ${type} enemy sprite...`);
        await generateEnemySpriteWithRetry(type);

        loadingProgress.enemies[type] = true;
        loadingProgress.completedSteps++;
        updateLoadingUI();
    }

    checkLoadingComplete();
}

async function generateEnemySpriteWithRetry(type: string): Promise<void> {
    const maxAttempts = 3;
    let attempts = 0;
    let delay = 2000;

    while (attempts < maxAttempts) {
        attempts++;

        try {
            await apiService.generateEnemySpriteSheet(type);
            console.log(`✓ ${type} enemy sprite generated`);
            return;

        } catch (error) {
            console.warn(`Failed to pre-generate ${type} (attempt ${attempts}/${maxAttempts}):`, error);

            if (attempts < maxAttempts) {
                await sleep(delay);
                delay *= 2; // Exponential backoff
            }
        }
    }

    console.error(`Failed to generate ${type} sprite after ${maxAttempts} attempts`);
    // Still mark as complete to not block loading
}

// ============================================================================
// LOADING COMPLETE CHECK
// ============================================================================

function checkLoadingComplete(): void {
    if (isLoadingComplete()) {
        console.log('✓ All initial assets generated');

        // Small delay for visual feedback
        setTimeout(() => {
            hideLoadingScreen();
        }, 500);
    }
}

// ============================================================================
// MAIN INITIALIZATION
// ============================================================================

async function initializeApp(): Promise<void> {
    console.log('Initializing App...');

    try {
        // Set session marker AFTER checking reload type
        const hardReload = isHardReload();
        setSessionMarker();

        if (hardReload) {
            // Hard reload - clear everything and regenerate
            console.log('🔄 Hard reload detected - clearing caches');
            showLoadingScreen();
            updateLoadingUI();
            await clearAllCachesOnLoad();
        } else {
            // Soft reload - check for valid cached assets
            const hasValidCache = await checkForValidCachedAssets();

            if (hasValidCache) {
                // Use cached assets - skip loading screen
                console.log('✓ Using cached assets from previous session');
                markAssetsAsLoaded();
                updateLoadingUI();
                hideLoadingScreen();

                // Initialize config without triggering regeneration
                await initializeConfig(apiService, () => {
                    // Don't regenerate - we have cached assets
                    console.log('Skipping asset generation - using cache');
                });

                console.log('✓ App initialization complete (from cache)');
                console.log('📷 Upload a dog image or click Start Game if you have a saved character');
                return;
            } else {
                // No valid cache - need to generate
                console.log('No valid cache found - generating assets');
                showLoadingScreen();
                updateLoadingUI();
                await clearAllCachesOnLoad();
            }
        }

        // Initialize config
        await initializeConfig(apiService, generateLocationBackground);

        // Verify backend connection and start asset generation
        if (CONFIG.USE_BACKEND_PROXY && CONFIG.BACKEND_API_URL) {
            // updateApiKeyStatus will call generateLocationBackground via callback
            await updateApiKeyStatus(apiService, generateLocationBackground);

            // Only start enemy generation here (background is started by updateApiKeyStatus)
            preGenerateEnemyAssets().catch((error) => {
                console.error('Enemy pre-generation failed:', error);
            });
        } else {
            // No backend - skip loading screen
            hideLoadingScreen();
        }

        console.log('✓ App initialization complete');
        console.log('📷 Please upload a dog image to generate your character sprite');

    } catch (error) {
        console.error('App initialization failed:', error);

        // Show error on loading screen
        const subtitle = document.getElementById('loading-subtitle');
        if (subtitle) {
            subtitle.textContent = 'Initialization failed. Please refresh.';
            subtitle.style.color = '#ff6b6b';
        }
    }
}

// ============================================================================
// DOM READY HANDLER
// ============================================================================

if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', initializeApp);
    } else {
        initializeApp();
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// DEBUG UTILITIES
// ============================================================================

async function clearBackgroundCache(): Promise<void> {
    console.log('Clearing background cache...');

    const keysToRemove = [
        'location_background_frames',
        'location_background_meta',
        'location_background',
    ];

    for (const key of keysToRemove) {
        localStorage.removeItem(key);
        try {
            await assetStorage.removeItem(key);
        } catch {
            // Ignore errors
        }
    }

    // Reset the flag to allow regeneration
    backgroundGenerationStarted = false;

    console.log('Background cache cleared. Refresh to regenerate.');
}

async function clearAllCaches(): Promise<void> {
    console.log('Clearing all caches...');

    // Use the forceHardReload to ensure clean state
    forceHardReload();
}

async function retryBackgroundGeneration(): Promise<void> {
    console.log('Manually retrying background generation...');

    // Reset flag to allow retry
    backgroundGenerationStarted = false;

    await clearBackgroundCache();
    await generateLocationBackground();
}

async function retrySpriteGeneration(): Promise<void> {
    console.log('Manually retrying sprite generation...');

    // Clear sprite cache
    const spriteKeys = [
        'custom_sprite_sheet',
        'original_dog_image',
        'has_custom_character',
    ];

    for (const key of spriteKeys) {
        localStorage.removeItem(key);
        try {
            await assetStorage.removeItem(key);
        } catch {
            // Ignore errors
        }
    }

    // Trigger regeneration if there's an uploaded image
    if (characterManager.getUploadedImage()) {
        await characterManager.generateSpriteSheetWithRetry();
    } else {
        console.log('No image uploaded. Please upload a dog image first.');
    }
}

function getAssetStatus(): AssetStatus {
    const readyState = characterManager.getReadyState();
    const backgroundFrames = localStorage.getItem('location_background_frames');
    let backgroundFramesLength = 0;

    if (backgroundFrames) {
        try {
            backgroundFramesLength = JSON.parse(backgroundFrames).length;
        } catch {
            backgroundFramesLength = 0;
        }
    }

    return {
        characterManager: readyState,
        backgroundFramesLength,
        backgroundMeta: localStorage.getItem('location_background_meta'),
        hasCustomCharacter: localStorage.getItem('has_custom_character'),
    };
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
    assetStorage,
    apiService,
    characterManager,
    generateLocationBackground,
    clearBackgroundCache,
    clearAllCaches,
    getAssetStatus,
    forceHardReload,
};