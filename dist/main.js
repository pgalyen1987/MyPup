import { CONFIG, initializeConfig, updateApiKeyStatus } from './config.js';
import { AssetStorage } from './AssetStorage.js';
import { APIService } from './api/api.js';
import { CharacterManager } from './character.js';
import { Game } from './game/Game.js';
const SESSION_MARKER_KEY = 'mypup_session_active';
const CACHE_VERSION_KEY = 'mypup_cache_version';
const CURRENT_CACHE_VERSION = '1';
const loadingProgress = {
    background: false,
    enemies: {
        cat: false,
        bird: false,
        squirrel: false,
        mailman: false,
    },
    totalSteps: 5,
    completedSteps: 0,
};
let backgroundGenerationStarted = false;
let enemyGenerationStarted = false;
const assetStorage = new AssetStorage();
const apiService = new APIService();
const characterManager = new CharacterManager(apiService, assetStorage, Game);
if (typeof window !== 'undefined') {
    window.characterManager = characterManager;
    window.clearBackgroundCache = clearBackgroundCache;
    window.getAssetStatus = getAssetStatus;
    window.clearAllCaches = clearAllCaches;
    window.retryBackgroundGeneration = retryBackgroundGeneration;
    window.retrySpriteGeneration = retrySpriteGeneration;
    window.getLoadingProgress = () => loadingProgress;
    window.forceHardReload = forceHardReload;
}
function isHardReload() {
    const storedVersion = localStorage.getItem(CACHE_VERSION_KEY);
    if (storedVersion !== CURRENT_CACHE_VERSION) {
        console.log('Cache version mismatch - treating as hard reload');
        localStorage.setItem(CACHE_VERSION_KEY, CURRENT_CACHE_VERSION);
        return true;
    }
    const sessionMarker = sessionStorage.getItem(SESSION_MARKER_KEY);
    if (!sessionMarker) {
        console.log('No session marker found - treating as hard reload');
        return true;
    }
    if (typeof performance !== 'undefined' && performance.getEntriesByType) {
        const navEntries = performance.getEntriesByType('navigation');
        if (navEntries.length > 0) {
            const navType = navEntries[0].type;
            if (navType === 'navigate') {
                console.log('New navigation detected');
            }
        }
    }
    if (typeof performance !== 'undefined' && performance.navigation) {
        const navType = performance.navigation.type;
    }
    console.log('Session marker exists - treating as soft reload');
    return false;
}
function setSessionMarker() {
    sessionStorage.setItem(SESSION_MARKER_KEY, Date.now().toString());
}
function forceHardReload() {
    console.log('Forcing hard reload...');
    sessionStorage.removeItem(SESSION_MARKER_KEY);
    localStorage.removeItem(CACHE_VERSION_KEY);
    window.location.reload();
}
function updateLoadingUI() {
    const percentage = Math.round((loadingProgress.completedSteps / loadingProgress.totalSteps) * 100);
    const progressFill = document.getElementById('loading-bar-fill');
    const progressText = document.getElementById('loading-percentage');
    if (progressFill) {
        progressFill.style.width = `${percentage}%`;
    }
    if (progressText) {
        progressText.textContent = `${percentage}%`;
    }
    const backgroundItem = document.getElementById('loading-background');
    if (backgroundItem) {
        const icon = backgroundItem.querySelector('.loading-icon');
        if (icon) {
            icon.textContent = loadingProgress.background ? '✅' : '⏳';
        }
    }
    const enemiesItem = document.getElementById('loading-enemies');
    if (enemiesItem) {
        const icon = enemiesItem.querySelector('.loading-icon');
        const allEnemiesDone = Object.values(loadingProgress.enemies).every((v) => v);
        if (icon) {
            icon.textContent = allEnemiesDone ? '✅' : '⏳';
        }
    }
    const subtitle = document.getElementById('loading-subtitle');
    if (subtitle) {
        if (!loadingProgress.background) {
            subtitle.textContent = 'Generating background...';
        }
        else {
            const pendingEnemies = Object.entries(loadingProgress.enemies)
                .filter(([_, done]) => !done)
                .map(([name]) => name);
            if (pendingEnemies.length > 0) {
                subtitle.textContent = `Generating ${pendingEnemies[0]} sprite...`;
            }
            else {
                subtitle.textContent = 'Almost ready!';
            }
        }
    }
}
function showLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    const menuScreen = document.getElementById('menu-screen');
    if (loadingScreen)
        loadingScreen.classList.remove('hidden');
    if (menuScreen)
        menuScreen.classList.add('hidden');
}
function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    const menuScreen = document.getElementById('menu-screen');
    if (loadingScreen)
        loadingScreen.classList.add('hidden');
    if (menuScreen)
        menuScreen.classList.remove('hidden');
}
function isLoadingComplete() {
    return loadingProgress.completedSteps >= loadingProgress.totalSteps;
}
async function clearAllCachesOnLoad() {
    console.log('🧹 Clearing all cached assets for fresh generation...');
    try {
        const keysToPreserve = [SESSION_MARKER_KEY, CACHE_VERSION_KEY, 'debug_mode'];
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && !keysToPreserve.includes(key)) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
        console.log('✓ localStorage cleared');
    }
    catch (e) {
        console.warn('Could not clear localStorage:', e);
    }
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
        }
        catch {
        }
    }
    clearUploadPreview();
    resetFileInput();
    loadingProgress.background = false;
    loadingProgress.enemies.cat = false;
    loadingProgress.enemies.bird = false;
    loadingProgress.enemies.squirrel = false;
    loadingProgress.enemies.mailman = false;
    loadingProgress.completedSteps = 0;
    backgroundGenerationStarted = false;
    enemyGenerationStarted = false;
    console.log('✓ All caches cleared');
}
async function checkForValidCachedAssets() {
    try {
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
    }
    catch (error) {
        console.warn('Error checking cached assets:', error);
        return false;
    }
}
function markAssetsAsLoaded() {
    loadingProgress.background = true;
    loadingProgress.enemies.cat = true;
    loadingProgress.enemies.bird = true;
    loadingProgress.enemies.squirrel = true;
    loadingProgress.enemies.mailman = true;
    loadingProgress.completedSteps = loadingProgress.totalSteps;
}
function clearUploadPreview() {
    const preview = document.getElementById('upload-preview');
    if (preview) {
        preview.innerHTML = '';
    }
    characterManager.clearUploadedImage();
}
function resetFileInput() {
    const fileInput = document.getElementById('dog-image-upload');
    if (fileInput) {
        fileInput.value = '';
    }
}
async function generateLocationBackground() {
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
        }
        else {
            throw new Error('Invalid background data received');
        }
        notifyCharacterManager();
        if (characterManager.currentGameInstance?.updateBackground) {
            characterManager.currentGameInstance.updateBackground();
        }
    }
    catch (error) {
        console.error('Background generation failed:', error);
        backgroundGenerationStarted = false;
        const retryDelay = 10000;
        console.log(`Retrying background generation in ${retryDelay / 1000}s...`);
        const subtitle = document.getElementById('loading-subtitle');
        if (subtitle) {
            subtitle.textContent = 'Background generation failed. Retrying...';
        }
        setTimeout(() => generateLocationBackground(), retryDelay);
    }
}
function notifyCharacterManager() {
    if (typeof characterManager.checkAllAssetsReady === 'function') {
        characterManager.checkAllAssetsReady();
    }
}
async function preGenerateEnemyAssets() {
    if (enemyGenerationStarted) {
        console.log('Enemy generation already started, skipping duplicate call');
        return;
    }
    if (!CONFIG.USE_BACKEND_PROXY || !CONFIG.BACKEND_API_URL) {
        const enemyTypes = ['cat', 'bird', 'squirrel', 'mailman'];
        for (const type of enemyTypes) {
            loadingProgress.enemies[type] = true;
            loadingProgress.completedSteps++;
        }
        updateLoadingUI();
        checkLoadingComplete();
        return;
    }
    enemyGenerationStarted = true;
    const enemyTypes = ['cat', 'bird', 'squirrel', 'mailman'];
    for (const type of enemyTypes) {
        console.log(`Pre-generating ${type} enemy sprite...`);
        await generateEnemySpriteWithRetry(type);
        loadingProgress.enemies[type] = true;
        loadingProgress.completedSteps++;
        updateLoadingUI();
    }
    checkLoadingComplete();
}
async function generateEnemySpriteWithRetry(type) {
    const maxAttempts = 3;
    let attempts = 0;
    let delay = 2000;
    while (attempts < maxAttempts) {
        attempts++;
        try {
            await apiService.generateEnemySpriteSheet(type);
            console.log(`✓ ${type} enemy sprite generated`);
            return;
        }
        catch (error) {
            console.warn(`Failed to pre-generate ${type} (attempt ${attempts}/${maxAttempts}):`, error);
            if (attempts < maxAttempts) {
                await sleep(delay);
                delay *= 2;
            }
        }
    }
    console.error(`Failed to generate ${type} sprite after ${maxAttempts} attempts`);
}
function checkLoadingComplete() {
    if (isLoadingComplete()) {
        console.log('✓ All initial assets generated');
        setTimeout(() => {
            hideLoadingScreen();
        }, 500);
    }
}
async function initializeApp() {
    console.log('Initializing App...');
    try {
        const hardReload = isHardReload();
        setSessionMarker();
        if (hardReload) {
            console.log('🔄 Hard reload detected - clearing caches');
            showLoadingScreen();
            updateLoadingUI();
            await clearAllCachesOnLoad();
        }
        else {
            const hasValidCache = await checkForValidCachedAssets();
            if (hasValidCache) {
                console.log('✓ Using cached assets from previous session');
                markAssetsAsLoaded();
                updateLoadingUI();
                hideLoadingScreen();
                await initializeConfig(apiService, () => {
                    console.log('Skipping asset generation - using cache');
                });
                console.log('✓ App initialization complete (from cache)');
                console.log('📷 Upload a dog image or click Start Game if you have a saved character');
                return;
            }
            else {
                console.log('No valid cache found - generating assets');
                showLoadingScreen();
                updateLoadingUI();
                await clearAllCachesOnLoad();
            }
        }
        await initializeConfig(apiService, generateLocationBackground);
        if (CONFIG.USE_BACKEND_PROXY && CONFIG.BACKEND_API_URL) {
            await updateApiKeyStatus(apiService, generateLocationBackground);
            preGenerateEnemyAssets().catch((error) => {
                console.error('Enemy pre-generation failed:', error);
            });
        }
        else {
            hideLoadingScreen();
        }
        console.log('✓ App initialization complete');
        console.log('📷 Please upload a dog image to generate your character sprite');
    }
    catch (error) {
        console.error('App initialization failed:', error);
        const subtitle = document.getElementById('loading-subtitle');
        if (subtitle) {
            subtitle.textContent = 'Initialization failed. Please refresh.';
            subtitle.style.color = '#ff6b6b';
        }
    }
}
if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', initializeApp);
    }
    else {
        initializeApp();
    }
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function clearBackgroundCache() {
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
        }
        catch {
        }
    }
    backgroundGenerationStarted = false;
    console.log('Background cache cleared. Refresh to regenerate.');
}
async function clearAllCaches() {
    console.log('Clearing all caches...');
    forceHardReload();
}
async function retryBackgroundGeneration() {
    console.log('Manually retrying background generation...');
    backgroundGenerationStarted = false;
    await clearBackgroundCache();
    await generateLocationBackground();
}
async function retrySpriteGeneration() {
    console.log('Manually retrying sprite generation...');
    const spriteKeys = [
        'custom_sprite_sheet',
        'original_dog_image',
        'has_custom_character',
    ];
    for (const key of spriteKeys) {
        localStorage.removeItem(key);
        try {
            await assetStorage.removeItem(key);
        }
        catch {
        }
    }
    if (characterManager.getUploadedImage()) {
        await characterManager.generateSpriteSheetWithRetry();
    }
    else {
        console.log('No image uploaded. Please upload a dog image first.');
    }
}
function getAssetStatus() {
    const readyState = characterManager.getReadyState();
    const backgroundFrames = localStorage.getItem('location_background_frames');
    let backgroundFramesLength = 0;
    if (backgroundFrames) {
        try {
            backgroundFramesLength = JSON.parse(backgroundFrames).length;
        }
        catch {
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
export { assetStorage, apiService, characterManager, generateLocationBackground, clearBackgroundCache, clearAllCaches, getAssetStatus, forceHardReload, };
