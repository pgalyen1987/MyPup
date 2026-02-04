// Main game logic using Phaser.js
import { CONFIG } from './config.js';
import type { APIService } from './api.js';
import type { AssetStorage } from './AssetStorage.js';
import { errorHandler, ErrorType } from './error-handler.js';

// Ensure Phaser is loaded before proceeding
if (typeof Phaser === 'undefined') {
    console.error('Phaser.js is not loaded! Please ensure the Phaser script is loaded before game.js');
    throw new Error('Phaser.js is required but not found. Check script loading order in index.html');
}

// Type definitions
interface LevelData {
    layers?: {
        background?: number[][];
        ground?: number[][];
        decorative?: number[][];
    };
    spawn?: { x: number; y: number };
    collectibles?: Array<{ x: number; y: number }>;
    enemies?: Array<{ x: number; y: number; type: string }>;
}



// Ensure Phaser is loaded before proceeding
if (typeof Phaser === 'undefined') {
    console.error('Phaser.js is not loaded! Please ensure the Phaser script is loaded before game.js');
    throw new Error('Phaser.js is required but not found. Check script loading order in index.html');
}

// Game class definition - will be exported to window.Game at end of file
export class Game {
    // Properties
    private spriteSheetUrl: string;
    private initialLevelImage: string | null;
    private apiService: APIService;
    private assetStorage: AssetStorage;
    private config: any; // Phaser.GameConfig
    private game: any = null; // Phaser.Game
    private player: any = null; // Phaser.Physics.Arcade.Sprite
    private cursors: any = null; // Phaser.Types.Input.Keyboard.CursorKeys
    private spaceKey: any = null; // Phaser.Input.Keyboard.Key
    private debugKey: any = null; // Phaser.Input.Keyboard.Key
    private debugMode: boolean = false;
    private platforms: any = null; // Phaser.Physics.Arcade.StaticGroup
    private enemies: any = null; // Phaser.Physics.Arcade.Group
    private collectibles: any = null; // Phaser.Physics.Arcade.StaticGroup
    private hazards: any = null; // Phaser.Physics.Arcade.StaticGroup
    private score: number = 0;
    private lives: number = 3;
    private levelData: LevelData | null = null;
    // levelGenerator removed - no longer using CSV-based level generation
    private currentScene: any = null; // Phaser.Scene
    private backgroundCanvas: any = null; // Phaser.GameObjects.RenderTexture
    private foregroundCanvas: any = null; // Phaser.GameObjects.RenderTexture
    private backgroundSprites: any[] = []; // Phaser.GameObjects.Sprite[]
    private isUpdatingBackground: boolean = false;
    private lastBackgroundCheck: number = 0;
    // currentCSVData removed - no longer using CSV-based level generation
    private backgroundFrameTimer: any = null;
    private backgroundAnimationFrameCounter: number = 0;
    private backgroundAnimationFrameDelay: number = 30; // 30 frames at 60fps = 500ms (2fps)
    // aiTilesAvailable removed - no longer using AI-generated tiles
    private isGameOver: boolean = false;
    private hasLoggedUpdateError: boolean = false;
    public gameInstance: any = null; // Store game instance for pause/resume (public for pause button access)

    constructor(
        spriteSheetUrl: string,
        apiService: APIService,
        assetStorage: AssetStorage,
        initialLevelImage: string | null = null
    ) {
        this.spriteSheetUrl = spriteSheetUrl;
        this.apiService = apiService;
        this.assetStorage = assetStorage;
        this.initialLevelImage = initialLevelImage;
        const self = this; // Capture 'this' for use in scene config
        
        // Bind methods to ensure 'this' always refers to the Game instance
        this.preload = this.preload.bind(this);
        this.create = this.create.bind(this);
        this.update = this.update.bind(this);
        this.createLevel1 = this.createLevel1.bind(this);
        this.renderLevel = this.renderLevel.bind(this);
        this.renderLayer = this.renderLayer.bind(this);
        this.createCollectiblesFromLevel = this.createCollectiblesFromLevel.bind(this);
        this.createEnemiesFromLevel = this.createEnemiesFromLevel.bind(this);
        this.createAnimations = this.createAnimations.bind(this);
        this.createEnemies = this.createEnemies.bind(this);
        this.createCollectibles = this.createCollectibles.bind(this);
        this.hitEnemy = this.hitEnemy.bind(this);
        this.collectItem = this.collectItem.bind(this);
        this.loseLife = this.loseLife.bind(this);
        this.gameOver = this.gameOver.bind(this);
        this.winGame = this.winGame.bind(this);

        // Store game instance reference for pause/resume
        this.gameInstance = this;

        // Use transparent background - we draw our own backgrounds (location-based from Gemini)
        this.config = {
            type: Phaser.AUTO,
            width: CONFIG.GAME_WIDTH,
            height: CONFIG.GAME_HEIGHT,
            parent: 'phaser-game',
            physics: {
                default: 'arcade',
                arcade: {
                    gravity: { y: CONFIG.GRAVITY },
                    debug: CONFIG.DEBUG_MODE // Only show collision boxes in debug mode
                }
            },
            scene: {
                // Pass the scene instance to our class methods using wrappers
                preload: function() { 
                    console.log('Wrapper: preload called, this:', this);
                    self.preload(this); 
                },
                create: function() { 
                    console.log('Wrapper: create called, this:', this);
                    self.create(this); 
                },
                update: function(time, delta) { 
                    try {
                        // Log every ~60 frames (approx 1 sec)
                        if (!this._logFrame) this._logFrame = 0;
                        this._logFrame++;
                        if (this._logFrame % 60 === 0) {
                            console.log('Wrapper: update running... (Frame ' + this._logFrame + ')');
                        }

                        self.update(this); 
                    } catch (e) {
                         console.error('Wrapper: Error in update:', e);
                    }
                }
            },
            pixelArt: true,
            backgroundColor: '#000000', // Black - will be covered by background image
            transparent: false // Opaque - background image should cover this
        };

        this.game = new Phaser.Game(this.config);
    }

    preload(scene: any): void {
        console.log('Game: Preload started');
        this.currentScene = scene;
        
        // Log the sprite URL length to verify we have data
        console.log('Game: Sprite sheet URL length:', this.spriteSheetUrl ? this.spriteSheetUrl.length : 'NULL');
        
        // Load custom sprite sheet as IMAGE first (for dynamic sizing in create)
        // We will create the spritesheet dynamically in create() to handle different image sizes
        scene.load.image('player', this.spriteSheetUrl);

        // Tilesheet loading removed - using AI-generated tiles only
        
        // Load cat enemy (fallback to static file)
        // Add cache-busting query parameter to ensure we get the latest version
        const catPath = 'assets/Cat.png';
        const catPathWithCacheBust = `${catPath}?v=${Date.now()}`;
        scene.load.image('catFallback', catPathWithCacheBust);
        
        // If we have a generated cat spritesheet, it will be loaded in create()

        // Create platform graphic - use a data URL for a simple brown platform (fallback)
        const platformDataUrl = this.createPlatformDataURL();
        scene.load.image('platform', platformDataUrl);
        
        // Add events to check load status
        scene.load.on('complete', () => {
            console.log('Game: Asset loading complete');
        });
        scene.load.on('loaderror', (file) => {
            console.error('Game: Asset load error:', file.key, file.src);
        });
    }

    createPlatformDataURL(): string {
        // Create a canvas-based platform graphic using universal tile size
        const canvas = document.createElement('canvas');
        canvas.width = CONFIG.TILE_SIZE;
        canvas.height = CONFIG.TILE_SIZE / 4; // Platform height is 1/4 of tile size
        const ctx = canvas.getContext('2d');
        
        // Draw platform
        ctx.fillStyle = '#8B4513'; // Brown
        ctx.fillRect(0, 0, CONFIG.TILE_SIZE, CONFIG.TILE_SIZE / 4);
        ctx.fillStyle = '#A0522D'; // Darker brown
        ctx.fillRect(0, (CONFIG.TILE_SIZE / 4) - 4, CONFIG.TILE_SIZE, 4);
        ctx.fillStyle = '#654321'; // Even darker for depth
        ctx.fillRect(0, (CONFIG.TILE_SIZE / 4) - 2, CONFIG.TILE_SIZE, 2);
        
        return canvas.toDataURL('image/png');
    }

    /**
     * Remove lime green (#00ff00) background from an image
     * Specifically targets the chroma key green color we request in sprite generation prompts
     */
    removeLimeGreenBackground(image: HTMLImageElement): HTMLImageElement {
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return image;

        ctx.drawImage(image, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;

        // Target color: #00ff00 = RGB(0, 255, 0)
        // With tolerance for slight variations due to compression/encoding
        const TARGET_R = 0;
        const TARGET_G = 255;
        const TARGET_B = 0;
        const TOLERANCE = 50; // Allow some variation for compression artifacts

        /**
         * Check if a pixel is lime green (#00ff00) or close to it
         */
        const isLimeGreen = (r: number, g: number, b: number): boolean => {
            // Calculate color distance from target #00ff00
            const distance = Math.sqrt(
                Math.pow(r - TARGET_R, 2) + 
                Math.pow(g - TARGET_G, 2) + 
                Math.pow(b - TARGET_B, 2)
            );
            
            // Primary check: close to pure #00ff00
            if (distance <= TOLERANCE) return true;
            
            // Secondary check: bright green with very low red/blue (handles slight variations)
            // Green must be dominant and bright, red/blue must be very low
            const isBrightGreen = g > 200 && r < 80 && b < 80;
            const greenDominance = g > r * 2 && g > b * 2;
            
            return isBrightGreen && greenDominance;
        };

        // Remove lime green pixels (make them transparent)
        let removedCount = 0;
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            if (isLimeGreen(r, g, b)) {
                data[i + 3] = 0; // Set alpha to 0 (transparent)
                removedCount++;
            }
        }

        ctx.putImageData(imgData, 0, 0);
        
        console.log(`Removed ${removedCount} lime green (#00ff00) background pixels`);
        
        // Create new image from processed canvas
        const processedImg = new Image();
        processedImg.src = canvas.toDataURL('image/png');
        return processedImg;
    }

    /**
     * Validate and log player spritesheet frame count
     */
    validateAndLogPlayerSpritesheet(scene: any, expectedWidth: number, expectedHeight: number, frameWidth: number, frameHeight: number): void {
        const expectedFrames = CONFIG.API.SPRITE_SHEET_FRAMES_PER_ROW * CONFIG.API.SPRITE_SHEET_ROWS; // 16
        const texture = scene.textures.get('playerSprite');
        const actualFrames = texture ? texture.frameTotal : 0;
        
        console.log(`Game: Created player spritesheet with ${actualFrames} frames (expected ${expectedFrames})`);
        
        if (actualFrames !== expectedFrames) {
            console.warn(`Game: WARNING - Player spritesheet has ${actualFrames} frames, expected ${expectedFrames} (4x4 grid).`);
            console.warn(`Game: Expected image size: ${expectedWidth}x${expectedHeight}`);
            console.warn(`Game: Animations may not work correctly. Please regenerate the spritesheet with exactly 16 frames in a 256x256 pixel image.`);
            // Try to use only the first 16 frames if we have more
            if (actualFrames > expectedFrames) {
                console.warn(`Game: Will attempt to use only first ${expectedFrames} frames for animations.`);
            }
        } else {
            console.log(`Game: Created player spritesheet with frame size: ${frameWidth}x${frameHeight} (universal tile size)`);
            console.log(`Game: Validated spritesheet: ${actualFrames} frames in 4x4 grid ✓`);
        }
    }

    /**
     * Create cat spritesheet from image and validate frame count
     */
    createCatSpritesheetFromImage(scene: any, img: HTMLImageElement, frameWidth: number, frameHeight: number, expectedWidth: number, expectedHeight: number): void {
        // Remove existing texture if it exists
        if (scene.textures.exists('cat')) {
            scene.textures.remove('cat');
        }
        
        try {
            scene.textures.addSpriteSheet('cat', img, {
                frameWidth: frameWidth,
                frameHeight: frameHeight
            });
            
            // Validate frame count
            const catTexture = scene.textures.get('cat');
            const actualFrames = catTexture ? catTexture.frameTotal : 0;
            const expectedFrames = CONFIG.API.SPRITE_SHEET_FRAMES_PER_ROW * CONFIG.API.SPRITE_SHEET_ROWS; // 16
            
            console.log(`Game: Cat spritesheet created with ${actualFrames} frames (expected ${expectedFrames})`);
            console.log(`Game: Image size: ${img.width}x${img.height}, frame size: ${frameWidth}x${frameHeight}`);
            
            if (actualFrames === expectedFrames) {
                console.log(`Game: ✓ Cat spritesheet validated: ${actualFrames} frames in 4x4 grid`);
            } else if (actualFrames > expectedFrames) {
                const errorHandler = (window as any).ErrorHandler;
                if (errorHandler) {
                    errorHandler.createError(
                        (window as any).ErrorType?.VALIDATION_ERROR || 'VALIDATION_ERROR',
                        `Cat spritesheet has ${actualFrames} frames instead of ${expectedFrames}.`,
                        { 
                            operation: 'validateCatSpritesheet', 
                            module: 'Game',
                            details: {
                                actualFrames,
                                expectedFrames,
                                imageWidth: img.width,
                                imageHeight: img.height,
                                frameWidth,
                                frameHeight
                            }
                        },
                        null,
                        `Cat sprite sheet has ${actualFrames} frames instead of 16. This may cause animation issues.`,
                        true,
                        'Will use only frames 0-15 for animations'
                    );
                }
                console.warn(`Game: ⚠️ Cat spritesheet has ${actualFrames} frames instead of ${expectedFrames}`);
                console.warn(`Game: Will use only frames 0-15 for animations`);
            }
            
            // Re-create animations now that texture exists
            this.createAnimations(scene);
        } catch (textureError) {
            const errorHandler = (window as any).ErrorHandler;
            if (errorHandler) {
                errorHandler.handleTextureError(
                    textureError,
                    'cat',
                    { 
                        operation: 'createCatSpritesheet', 
                        module: 'Game', 
                        details: { imageWidth: img.width, imageHeight: img.height, frameWidth, frameHeight }
                    }
                );
            }
        }
    }

    create(scene: any): void {
        try {
            console.log('Game: Create started', scene);
            this.currentScene = scene;

            // 1. Create Player FIRST (so it exists for colliders)
            // DYNAMIC SPRITESHEET CREATION
            // Check if we need to create the spritesheet from the base image
            if (!scene.textures.exists('playerSprite') && scene.textures.exists('player')) {
                const playerTexture = scene.textures.get('player');
                const sourceImage = playerTexture.source[0];
                let processedImage = sourceImage.image;
                
                // Remove lime green background from sprite sheet if present
                // This handles cases where cached sprite sheets still have green background
                console.log('Game: Checking for and removing lime green background from player sprite sheet...');
                try {
                    const imageWithNoBackground = this.removeLimeGreenBackground(processedImage);
                    processedImage = imageWithNoBackground;
                    console.log('Game: ✅ Background removal applied to player sprite sheet');
                } catch (bgError) {
                    console.warn('Game: ⚠️ Could not remove background from sprite sheet (may already be removed):', bgError);
                    // Continue with original image if background removal fails
                }
                
                // Log actual image dimensions for debugging
                const actualWidth = processedImage.width;
                const actualHeight = processedImage.height;
                console.log(`Game: Player spritesheet image dimensions: ${actualWidth}x${actualHeight}`);
                
                // Use universal tile size for frame dimensions (64x64)
                // Player sprite sheet should be 4x4 grid, each frame is CONFIG.TILE_SIZE (64x64)
                // Total size should be CONFIG.TILE_SIZE * 4 = 256x256
                const frameWidth = CONFIG.TILE_SIZE;
                const frameHeight = CONFIG.TILE_SIZE;
                const expectedWidth = frameWidth * 4; // 256
                const expectedHeight = frameHeight * 4; // 256
                
                console.log(`Game: Expected spritesheet size: ${expectedWidth}x${expectedHeight}, frame size: ${frameWidth}x${frameHeight}`);
                
                // If image is not the expected size, we need to adjust frame parsing
                // If image is 1024x1024, we should parse as 256x256 frames (16 frames in 4x4 grid)
                // Then scale down to 64x64 for display
                let actualFrameWidth = frameWidth;
                let actualFrameHeight = frameHeight;
                let needsScaling = false;
                
                if (actualWidth !== expectedWidth || actualHeight !== expectedHeight) {
                    console.error(`Game: ERROR - Player spritesheet is ${actualWidth}x${actualHeight}, expected ${expectedWidth}x${expectedHeight}`);
                    console.error(`Game: Attempting workaround - will parse frames and scale for display.`);
                    console.error(`Game: Please clear cache (clearPlayerSpriteCache()) and regenerate with exactly 256x256 pixels for best results.`);
                    
                    // If image is 4x larger (1024x1024), parse as 256x256 frames, then scale to 64x64
                    if (actualWidth === expectedWidth * 4 && actualHeight === expectedHeight * 4) {
                        // Image is 1024x1024, parse as 256x256 frames (16 frames in 4x4 grid)
                        actualFrameWidth = expectedWidth; // 256
                        actualFrameHeight = expectedHeight; // 256
                        needsScaling = true;
                        console.warn(`Game: Image is 4x too large. Parsing as ${actualFrameWidth}x${actualFrameHeight} frames, will scale down to ${frameWidth}x${frameHeight} for display.`);
                    } else {
                        // Other size mismatch - try to calculate frame size
                        const framesPerRow = Math.floor(actualWidth / frameWidth);
                        const framesPerCol = Math.floor(actualHeight / frameHeight);
                        if (framesPerRow >= 4 && framesPerCol >= 4) {
                            // Use the calculated frame size
                            actualFrameWidth = Math.floor(actualWidth / 4);
                            actualFrameHeight = Math.floor(actualHeight / 4);
                            needsScaling = actualFrameWidth !== frameWidth || actualFrameHeight !== frameHeight;
                            console.warn(`Game: Calculated frame size: ${actualFrameWidth}x${actualFrameHeight}, needs scaling: ${needsScaling}`);
                        }
                    }
                }
                
                // Handle 1024x1024 images natively: parse as 256x256 frames, then scale sprite for display
                // This allows Gemini-generated 1024x1024 spritesheets to work without resizing
                // Create spritesheet using calculated frame size and processed image (with background removed)
                scene.textures.addSpriteSheet('playerSprite', processedImage, {
                    frameWidth: actualFrameWidth,  // 256 for 1024x1024 images, 64 for 256x256 images
                    frameHeight: actualFrameHeight
                });
                
                // Store scaling info for later use when creating sprite
                if (needsScaling) {
                    (scene as any).playerSpriteNeedsScaling = true;
                    (scene as any).playerSpriteScale = frameWidth / actualFrameWidth; // Scale from 256 to 64 = 0.25
                    console.log(`Game: Will scale player sprite by ${frameWidth / actualFrameWidth} to display at correct size`);
                } else {
                    (scene as any).playerSpriteNeedsScaling = false;
                    (scene as any).playerSpriteScale = 1.0;
                }
                
                // Validate spritesheet has correct frame count
                this.validateAndLogPlayerSpritesheet(scene, expectedWidth, expectedHeight, frameWidth, frameHeight);
            }

            // DYNAMIC CAT SPRITESHEET CREATION
            // Load from AssetStorage (async, but we'll handle it in a promise)
            this.assetStorage.getItem('cat_enemy_spritesheet').then((catSource: string | null) => {
            if (catSource && !scene.textures.exists('cat')) {
                const img = new Image();
                img.onload = () => {
                   // Cat sprite sheet should be 4x4 grid, each frame is CONFIG.TILE_SIZE (64x64)
                   // Total size should be CONFIG.TILE_SIZE * 4 = 256x256
                   const frameWidth = CONFIG.TILE_SIZE;
                   const frameHeight = CONFIG.TILE_SIZE;
                   scene.textures.addSpriteSheet('cat', img, {
                       frameWidth: frameWidth,
                       frameHeight: frameHeight
                   });
                   
                   // Validate spritesheet has correct frame count (should be 16 frames in 4x4 grid)
                   const expectedFrames = CONFIG.API.SPRITE_SHEET_FRAMES_PER_ROW * CONFIG.API.SPRITE_SHEET_ROWS; // 16
                   const texture = scene.textures.get('cat');
                   const actualFrames = texture ? texture.frameTotal : 0;
                   
                   if (actualFrames !== expectedFrames) {
                       console.warn(`Game: WARNING - Cat spritesheet has ${actualFrames} frames, expected ${expectedFrames} (4x4 grid).`);
                       console.warn(`Game: Image dimensions: ${img.width}x${img.height}, expected: ${frameWidth * 4}x${frameHeight * 4}`);
                       console.warn(`Game: Animations may not work correctly. Please regenerate the spritesheet with exactly 16 frames in a 256x256 pixel image.`);
                   } else {
                   console.log(`Game: Successfully created dynamic cat spritesheet (4x4), frame size: ${frameWidth}x${frameHeight}`);
                       console.log(`Game: Validated cat spritesheet: ${actualFrames} frames in 4x4 grid ✓`);
                   }
                   
                   // Re-create animations now that texture exists
                   this.createAnimations(scene);
                   
                   // If level is already generated, we need to recreate enemies
                   if (this.enemies && this.enemies.children.size === 0) {
                       console.log('Game: Cat texture loaded after level generation, checking if enemies need to be recreated...');
                   }
                };
                img.onerror = () => {
                    console.error('Game: Failed to load cat sprite sheet image');
                };
                img.src = catSource;
                }
            }).catch((e) => {
                console.warn('Could not load cat spritesheet from AssetStorage:', e);
            });
            
            if (!scene.textures.exists('cat') && scene.textures.exists('catFallback')) {
                // Fallback to static image if no AI cat available
                const fallbackImg = scene.textures.get('catFallback').source[0].image;
                
                // Log actual image dimensions
                const actualCatWidth = fallbackImg.width;
                const actualCatHeight = fallbackImg.height;
                console.log(`Game: Cat fallback image dimensions: ${actualCatWidth}x${actualCatHeight}`);
                
                // Expected: 256x256 with 16 frames (4x4 grid of 64x64 frames)
                const expectedCatWidth = CONFIG.TILE_SIZE * 4; // 256
                const expectedCatHeight = CONFIG.TILE_SIZE * 4; // 256
                const fallbackFrameWidth = CONFIG.TILE_SIZE; // 64
                const fallbackFrameHeight = CONFIG.TILE_SIZE; // 64
                
                // Step 1: Resize image to 256x256 if needed
                const resizeCanvas = document.createElement('canvas');
                resizeCanvas.width = expectedCatWidth;
                resizeCanvas.height = expectedCatHeight;
                const resizeCtx = resizeCanvas.getContext('2d');
                
                if (!resizeCtx) {
                    console.error('Game: Could not get canvas context for cat image resize');
                } else {
                    // Draw and resize the image
                    resizeCtx.drawImage(fallbackImg, 0, 0, expectedCatWidth, expectedCatHeight);
                    const resizedDataURL = resizeCanvas.toDataURL('image/png');
                    
                    // Step 2: Load resized image and remove background
                    const resizedImg = new Image();
                    resizedImg.onload = () => {
                        console.log(`Game: Cat image resized to ${expectedCatWidth}x${expectedCatHeight}`);
                        
                        // Remove lime green background from resized image
                        console.log('Game: Removing lime green background from cat image...');
                        const processedCatImg = this.removeLimeGreenBackground(resizedImg);
                        
                        // Step 3: Wait for processed image to load, then create spritesheet
                        processedCatImg.onload = () => {
                            // Verify processed image is exactly 256x256
                            const processedWidth = processedCatImg.width;
                            const processedHeight = processedCatImg.height;
                            
                            if (processedWidth !== expectedCatWidth || processedHeight !== expectedCatHeight) {
                                console.warn(`Game: Processed cat image is ${processedWidth}x${processedHeight}, expected ${expectedCatWidth}x${expectedCatHeight}`);
                                console.warn(`Game: This may cause incorrect frame parsing.`);
                            }
                            
                            // Create spritesheet with correct frame size (64x64 for 256x256 image)
                            // Remove existing texture if it exists
                            if (scene.textures.exists('cat')) {
                                scene.textures.remove('cat');
                            }
                            
                            // Create spritesheet directly from processed image
                            // Ensure image is exactly 256x256 before creating spritesheet to get exactly 16 frames
                            if (processedWidth !== expectedCatWidth || processedHeight !== expectedCatHeight) {
                                console.warn(`Game: Processed cat image is ${processedWidth}x${processedHeight}, resizing to ${expectedCatWidth}x${expectedCatHeight}`);
                                const finalResizeCanvas = document.createElement('canvas');
                                finalResizeCanvas.width = expectedCatWidth;
                                finalResizeCanvas.height = expectedCatHeight;
                                const finalResizeCtx = finalResizeCanvas.getContext('2d');
                                if (finalResizeCtx) {
                                    finalResizeCtx.drawImage(processedCatImg, 0, 0, expectedCatWidth, expectedCatHeight);
                                    const finalResizedImg = new Image();
                                    finalResizedImg.onload = () => {
                                        this.createCatSpritesheetFromImage(scene, finalResizedImg, fallbackFrameWidth, fallbackFrameHeight, expectedCatWidth, expectedCatHeight);
                                    };
                                    finalResizedImg.src = finalResizeCanvas.toDataURL('image/png');
                                    return;
                                }
                            }
                            
                            // Image is correct size, create spritesheet
                            try {
                                scene.textures.addSpriteSheet('cat', processedCatImg, {
                    frameWidth: fallbackFrameWidth,
                    frameHeight: fallbackFrameHeight
                });
                            } catch (textureError) {
                                errorHandler.handleTextureError(
                                    textureError,
                                    'cat',
                                    { 
                                        operation: 'createCatSpritesheet', 
                                        module: 'Game', 
                                        details: { processedWidth, processedHeight, frameWidth: fallbackFrameWidth, frameHeight: fallbackFrameHeight }
                                    }
                                );
                                return;
                            }
                            
                            // Validate frame count
                            const catTexture = scene.textures.get('cat');
                            const actualFrames = catTexture ? catTexture.frameTotal : 0;
                            const expectedFrames = CONFIG.API.SPRITE_SHEET_FRAMES_PER_ROW * CONFIG.API.SPRITE_SHEET_ROWS; // 16
                            
                            console.log(`Game: Cat spritesheet created with ${actualFrames} frames (expected ${expectedFrames})`);
                            console.log(`Game: Processed image size: ${processedWidth}x${processedHeight}, frame size: ${fallbackFrameWidth}x${fallbackFrameHeight}`);
                            
                            // Calculate expected frames based on image dimensions
                            const calculatedFramesPerRow = Math.floor(processedWidth / fallbackFrameWidth);
                            const calculatedFramesPerCol = Math.floor(processedHeight / fallbackFrameHeight);
                            const calculatedTotalFrames = calculatedFramesPerRow * calculatedFramesPerCol;
                            
                            console.log(`Game: Frame calculation - Image: ${processedWidth}x${processedHeight}, Frame: ${fallbackFrameWidth}x${fallbackFrameHeight}`);
                            console.log(`Game: Calculated: ${calculatedFramesPerRow} frames/row × ${calculatedFramesPerCol} frames/col = ${calculatedTotalFrames} total frames`);
                            
                            if (actualFrames === expectedFrames) {
                                console.log(`Game: ✓ Cat spritesheet validated: ${actualFrames} frames in 4x4 grid`);
                            } else if (actualFrames > expectedFrames) {
                                errorHandler.createError(
                                    ErrorType.VALIDATION_ERROR,
                                    `Cat spritesheet has ${actualFrames} frames instead of ${expectedFrames}. Calculated: ${calculatedTotalFrames} frames.`,
                                    { 
                                        operation: 'validateCatSpritesheet', 
                                        module: 'Game',
                                        details: {
                                            actualFrames,
                                            expectedFrames,
                                            calculatedTotalFrames,
                                            processedWidth,
                                            processedHeight,
                                            frameWidth: fallbackFrameWidth,
                                            frameHeight: fallbackFrameHeight,
                                            calculatedFramesPerRow,
                                            calculatedFramesPerCol
                                        }
                                    },
                                    null,
                                    `Cat sprite sheet has ${actualFrames} frames instead of 16. This may cause animation issues.`,
                                    'Will use only frames 0-15 for animations'
                                );
                                console.warn(`Game: ⚠️ Cat spritesheet has ${actualFrames} frames instead of ${expectedFrames}`);
                                console.warn(`Game: Will use only frames 0-${expectedFrames - 1} for animations`);
                            } else {
                                errorHandler.createError(
                                    ErrorType.VALIDATION_ERROR,
                                    `Cat spritesheet has only ${actualFrames} frames, expected ${expectedFrames}`,
                                    { 
                                        operation: 'validateCatSpritesheet', 
                                        module: 'Game',
                                        details: {
                                            actualFrames,
                                            expectedFrames,
                                            processedWidth,
                                            processedHeight
                                        }
                                    },
                                    null,
                                    `Cat sprite sheet has insufficient frames (${actualFrames} instead of ${expectedFrames})`,
                                    'Regenerate the cat sprite sheet with exactly 16 frames'
                                );
                                console.warn(`Game: ⚠️ Cat spritesheet has only ${actualFrames} frames, expected ${expectedFrames}`);
                            }
                            
                            console.log(`Game: ✓ Cat image resized, background removed, and spritesheet created`);
                            
                            // Wait a bit for texture to be fully registered, then create animations
                            const createCatAnimations = () => {
                                console.log('Game: Creating cat animations...');
                                console.log(`Game: Cat texture exists check: ${scene.textures.exists('cat')}`);
                                
                                if (scene.textures.exists('cat')) {
                                    try {
                                        // Remove frame 16 if it exists (Phaser sometimes creates an extra frame)
                                        const catTexture = scene.textures.get('cat');
                                        console.log(`Game: About to call createAnimations - cat texture has ${catTexture?.frameTotal || 0} frames`);
                                        
                                        if (catTexture && catTexture.frameTotal > 16) {
                                            console.warn(`Game: Cat texture has ${catTexture.frameTotal} frames, will limit animations to frames 0-15`);
                                        }
                                        
                                        console.log('Game: Calling this.createAnimations(scene)...');
                                        this.createAnimations(scene);
                                        console.log('Game: createAnimations call completed');
                                    } catch (animError) {
                                        console.error('Game: Exception in createCatAnimations:', animError);
                                        errorHandler.handleAnimationError(
                                            animError,
                                            'cat-animations',
                                            { 
                                                operation: 'createCatAnimations', 
                                                module: 'Game',
                                                details: { 
                                                    textureExists: scene.textures.exists('cat'),
                                                    errorMessage: animError?.message,
                                                    errorStack: animError?.stack
                                                }
                                            }
                                        );
                                    }
                                    
                                    // Verify animations were created and update existing enemies
                                    setTimeout(() => {
                                        const walkRightExists = scene.anims.exists('cat-walk-right');
                                        const walkLeftExists = scene.anims.exists('cat-walk-left');
                                        if (walkRightExists && walkLeftExists) {
                                            console.log('Game: ✓ Cat animations created successfully');
                                            
                                            // Update existing cat enemies to use animations
                                            if (this.enemies && this.enemies.children) {
                                                let updatedCount = 0;
                                                this.enemies.children.entries.forEach((enemy: any) => {
                                                    if (enemy && enemy.texture && enemy.texture.key === 'cat') {
                                                        // Determine direction and play appropriate animation
                                                        const velocity = enemy.body ? enemy.body.velocity.x : 0;
                                                        if (velocity < 0 && walkLeftExists) {
                                                            enemy.anims.play('cat-walk-left', true);
                                                            updatedCount++;
                                                        } else if (velocity > 0 && walkRightExists) {
                                                            enemy.anims.play('cat-walk-right', true);
                                                            updatedCount++;
                                                        } else if (walkLeftExists) {
                                                            // Default to walk-left
                                                            enemy.anims.play('cat-walk-left', true);
                                                            updatedCount++;
                                                        }
                                                    }
                                                });
                                                if (updatedCount > 0) {
                                                    console.log(`Game: ✓ Updated ${updatedCount} cat enemies with animations`);
                                                }
                                            }
                                        } else {
                                            console.warn(`Game: ⚠️ Cat animations not fully created (walk-right: ${walkRightExists}, walk-left: ${walkLeftExists})`);
                                            // Retry once more after a longer delay
                                            setTimeout(() => {
                                                console.warn('Game: Retrying cat animation creation...');
                                                if (scene.textures.exists('cat')) {
                                                    this.createAnimations(scene);
                                                } else {
                                                    console.error('Game: Cat texture still does not exist after delay');
                                                }
                                            }, 200);
                                        }
                                    }, 150);
                                } else {
                                    console.error('Game: Cat texture does not exist when trying to create animations');
                                    console.warn('Game: Cat texture does not exist yet, retrying in 100ms...');
                                    setTimeout(createCatAnimations, 100);
                                }
                            };
                            
                            // Start animation creation after a short delay to ensure texture is registered
                            setTimeout(createCatAnimations, 50);
                        };
                        
                        processedCatImg.onerror = () => {
                            console.error('Game: Failed to load processed cat image, using resized without background removal');
                            scene.textures.addSpriteSheet('cat', resizedImg, {
                    frameWidth: fallbackFrameWidth,
                    frameHeight: fallbackFrameHeight
                });
                            this.createAnimations(scene);
                        };
                        
                        // If processed image is already loaded, trigger onload
                        if (processedCatImg.complete) {
                            processedCatImg.onload(null as any);
                        }
                    };
                    
                    resizedImg.onerror = () => {
                        console.error('Game: Failed to resize cat image, using original');
                        // Fallback: try to use original image
                        const processedCatImg = this.removeLimeGreenBackground(fallbackImg);
                        processedCatImg.onload = () => {
                            scene.textures.addSpriteSheet('cat', processedCatImg, {
                                frameWidth: fallbackFrameWidth,
                                frameHeight: fallbackFrameHeight
                            });
                            this.createAnimations(scene);
                        };
                        if (processedCatImg.complete) {
                            processedCatImg.onload(null as any);
                        }
                    };
                    
                    resizedImg.src = resizedDataURL;
                }
            } else if (!scene.textures.exists('cat')) {
                console.error('Game: No cat texture available - neither AI-generated nor fallback cat found!');
                console.error('Game: Cats will not be visible. Check that cat spritesheet is being generated.');
                console.error('Game: catFallback available:', scene.textures.exists('catFallback'));
            }
            
            // Log cat texture status
            if (scene.textures.exists('cat')) {
                const catTexture = scene.textures.get('cat');
                console.log(`Game: Cat texture exists: ${catTexture.key}, frames: ${catTexture.frameTotal || 'unknown'}`);
            } else {
                console.warn('Game: Cat texture does not exist - enemies will not be visible!');
                console.warn('Game: Make sure cat spritesheet is pre-generated or fallback cat exists');
            }

            // 1. Generate Level FIRST (before player) to ensure collision blocks exist
            // Use pre-loaded level image if available
            console.log('Game: Creating Level 1...');
            this.createLevel1(scene);
            
            // 2. Create player AFTER floor exists (prevents falling through)
            // Ensure player is created
            if (!this.player) {
                // Verify playerSprite texture exists before creating sprite
                if (!scene.textures.exists('playerSprite')) {
                    console.error('Game: playerSprite texture does not exist! Cannot create player.');
                    return;
                }
                
                const playerTexture = scene.textures.get('playerSprite');
                console.log(`Game: Creating player from playerSprite texture (${playerTexture.frameTotal} frames available)`);
                
                // Position player so feet are well above the top of the floor collision box
                // Floor is now at: gameHeight - tileSize = 1024 - 64 = 960 (ground surface level)
                // Floor rectangle is positioned at y = floorY - floorHeight = 960 - 32 = 928
                // Rectangle extends from y=928 to y=960 (ground surface)
                // Floor top edge is at y=928
                // With origin 0.5,1.0, sprite Y position directly represents feet position
                const floorY = CONFIG.GAME_HEIGHT - CONFIG.TILE_SIZE; // 960 (matches createLevel1 - ground surface)
                const floorHeight = CONFIG.TILE_SIZE / 2; // 32px
                const floorTopY = floorY - floorHeight; // 928 (top edge of floor collision box)
                // Position player feet well above the floor top edge (spawn in air, will fall onto floor)
                const playerFeetY = floorTopY - CONFIG.TILE_SIZE; // 864 (one full tile above floor top edge)
                this.player = scene.physics.add.sprite(100, playerFeetY, 'playerSprite', 0);
                this.player.setBounce(CONFIG.PHYSICS.PLAYER_BOUNCE);
                this.player.setCollideWorldBounds(true);
                
                // Set origin to bottom-center (0.5, 1.0) so Y position represents feet/ground level
                // This ensures collision box bottom aligns with feet
                this.player.setOrigin(0.5, 1.0);
                
                // Check if sprite needs scaling (if image was wrong size)
                const needsScaling = (scene as any).playerSpriteNeedsScaling;
                const scaleFactor = (scene as any).playerSpriteScale || 1.0;
                
                // Get frame info before scaling
                const frame = this.player.frame;
                const frameWidth = frame ? frame.width : CONFIG.TILE_SIZE;
                const frameHeight = frame ? frame.height : CONFIG.TILE_SIZE;
                
                console.log(`Game: Player sprite frame dimensions: ${frameWidth}x${frameHeight}`);
                
                if (needsScaling) {
                    console.log(`Game: Applying scale factor ${scaleFactor} to player sprite to correct for wrong image size`);
                    this.player.setScale(scaleFactor);
                } else {
                    // Player sprite frames are CONFIG.TILE_SIZE (64x64) - render at 1:1 scale
                    this.player.setScale(1.0);
                }
                
                // Explicitly set frame 0 again after scaling to ensure it's displayed correctly
                this.player.setFrame(0);
                
                // Verify the frame is set correctly
                const currentFrame = this.player.frame;
                if (currentFrame) {
                    console.log(`Game: Player sprite using frame ${currentFrame.index || currentFrame.name}, size: ${currentFrame.width}x${currentFrame.height}`);
                }
                
                // Log sprite dimensions for debugging
                const finalFrame = this.player.frame;
                if (finalFrame) {
                    console.log(`Game: Player sprite frame info: frame=${finalFrame.name || finalFrame.index}, width=${finalFrame.width}, height=${finalFrame.height}, cutX=${finalFrame.cutX}, cutY=${finalFrame.cutY}, cutWidth=${finalFrame.cutWidth}, cutHeight=${finalFrame.cutHeight}`);
                    
                    // Ensure frame size is correct - if not, force it
                    if (finalFrame.width !== CONFIG.TILE_SIZE || finalFrame.height !== CONFIG.TILE_SIZE) {
                        console.warn(`Game: Frame size mismatch! Frame is ${finalFrame.width}x${finalFrame.height}, expected ${CONFIG.TILE_SIZE}x${CONFIG.TILE_SIZE}`);
                        console.warn(`Game: This may cause rendering issues. The sprite may appear too small or too large.`);
                    }
                }
                
                // Ensure display size is correct
                const expectedDisplaySize = CONFIG.TILE_SIZE;
                const actualDisplayWidth = this.player.displayWidth;
                const actualDisplayHeight = this.player.displayHeight;
                
                console.log(`Game: Player display size: ${actualDisplayWidth}x${actualDisplayHeight} (expected ${expectedDisplaySize}x${expectedDisplaySize})`);
                
                if (Math.abs(actualDisplayWidth - expectedDisplaySize) > 1 || Math.abs(actualDisplayHeight - expectedDisplaySize) > 1) {
                    console.warn(`Game: Display size mismatch! Adjusting scale to fix...`);
                    // Calculate correct scale based on frame size
                    const targetFrameSize = CONFIG.TILE_SIZE;
                    const currentFrameSize = finalFrame ? finalFrame.width : frameWidth;
                    const correctScale = targetFrameSize / currentFrameSize;
                    this.player.setScale(correctScale);
                    console.log(`Game: Adjusted scale to ${correctScale} to achieve ${expectedDisplaySize}x${expectedDisplaySize} display size`);
                    console.log(`Game: New display size: ${this.player.displayWidth}x${this.player.displayHeight}`);
                }
                
                console.log(`Game: Player sprite created at 1:1 scale (${CONFIG.TILE_SIZE}x${CONFIG.TILE_SIZE} frames)`);
                console.log(`Game: Player display size: ${this.player.displayWidth}x${this.player.displayHeight}`);
                
                // Adjust body size to match scaled sprite exactly
                // Collision box should be same size as the actual displayed sprite (after scaling)
                if (this.player.body) {
                   // Get actual displayed sprite dimensions (after scaling)
                   const spriteWidth = this.player.displayWidth || CONFIG.TILE_SIZE;
                   const spriteHeight = this.player.displayHeight || CONFIG.TILE_SIZE;
                   
                   // Set collision box to match the scaled sprite size exactly
                   this.player.body.setSize(spriteWidth, spriteHeight);
                   
                   // With origin 0.5,1.0 (bottom-center), the sprite's visual bottom is at Y position
                   // The physics body is centered on the sprite position by default
                   // We need to offset it down by half the height to align the body bottom with sprite bottom (feet)
                   // Offset: (0, -spriteHeight/2) moves body down so its bottom aligns with sprite bottom
                   this.player.body.setOffset(0, -spriteHeight / 2);
                   
                   console.log(`Game: Player collision box set to ${spriteWidth}x${spriteHeight} (matches scaled sprite size)`);
                   
                    // Fix sliding: Add high drag
                    this.player.setDragX(CONFIG.PHYSICS.PLAYER_DRAG_X); 
                    
                    // Save frame size for offset calculations in update() (using universal tile size)
                    this.player.frameSize = CONFIG.TILE_SIZE;
                }
                
                // Ensure player is rendered ON TOP of the level
                this.player.setDepth(CONFIG.VISUAL.DEPTH_PLAYER);
                
                // Add collider between player and platforms (floor was created in createLevel1)
                // Ensure both player and platform bodies are ready before creating collider
                if (this.platforms && this.platforms.children.size > 0 && this.player && this.player.body) {
                    // Verify platform body exists
                    const platformBody = this.platforms.children.entries[0]?.body;
                    if (platformBody) {
                        const collider = scene.physics.add.collider(this.player, this.platforms);
                        console.log('Game: ✓ Player-platform collider added');
                        console.log(`Game: Collider active: ${collider ? 'YES' : 'NO'}, platforms count: ${this.platforms.children.size}`);
                        
                        // Log detailed body information for debugging
                        const playerBottom = this.player.body.y + (this.player.body.height / 2) + (this.player.body.offset?.y || 0);
                        const floorTop = platformBody.y - (platformBody.height / 2) + (platformBody.offset?.y || 0);
                        console.log(`Game: Player body - position=(${this.player.body.x.toFixed(1)}, ${this.player.body.y.toFixed(1)}), size=${this.player.body.width.toFixed(1)}x${this.player.body.height.toFixed(1)}, offset=(${(this.player.body.offset?.x || 0).toFixed(1)}, ${(this.player.body.offset?.y || 0).toFixed(1)}), bottom=${playerBottom.toFixed(1)}`);
                        console.log(`Game: Floor body - position=(${platformBody.x.toFixed(1)}, ${platformBody.y.toFixed(1)}), size=${platformBody.width.toFixed(1)}x${platformBody.height.toFixed(1)}, offset=(${(platformBody.offset?.x || 0).toFixed(1)}, ${(platformBody.offset?.y || 0).toFixed(1)}), top=${floorTop.toFixed(1)}`);
                        console.log(`Game: Player bottom (${playerBottom.toFixed(1)}) should be above floor top (${floorTop.toFixed(1)})`);
                    } else {
                        console.error('Game: ERROR - Platform body does not exist!');
                    }
                } else {
                    if (!this.platforms || this.platforms.children.size === 0) {
                        console.warn('Game: ⚠️ Platforms group is empty, cannot add player collider');
                    }
                    if (!this.player || !this.player.body) {
                        console.warn('Game: ⚠️ Player or player body does not exist, cannot add collider');
                    }
                }
            }
            
            // Ensure camera and physics world limits
            // World width should match background tiles width for scrolling
            // Calculate world width based on background tiles (will be set after background loads)
            const defaultWorldWidth = CONFIG.GAME_WIDTH * 3; // Default to 3x viewport width for scrolling
            scene.cameras.main.setBounds(0, 0, defaultWorldWidth, CONFIG.GAME_HEIGHT);
            scene.physics.world.setBounds(0, 0, defaultWorldWidth, CONFIG.GAME_HEIGHT, true, true, true, true);
            
            // Initialize physics debug based on debug mode (collision boxes only visible in debug mode)
            if (scene.physics && scene.physics.world) {
                scene.physics.world.drawDebug = this.debugMode || CONFIG.DEBUG_MODE;
            }
            
            // Set up camera to follow player (enables background scrolling)
            if (this.player) {
                scene.cameras.main.startFollow(this.player, true, 0.1, 0.1);
                scene.cameras.main.setDeadzone(0, 0);
            }
            // Create animations
            this.createAnimations(scene);

            // Input
            this.cursors = scene.input.keyboard.createCursorKeys();
            
            // Add spacebar for jump
            this.spaceKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
            
            // Add 'D' key for Debug Mode
            this.debugKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
            this.debugMode = false;

            // Global safety: if cats fall through platforms, reset them or destroy them
            scene.physics.world.on('worldbounds', (body) => {
                if (body.gameObject && body.gameObject.texture && body.gameObject.texture.key === 'cat') {
                    const worldBounds = scene.physics.world.bounds;
                    // If cat falls below the kill zone, destroy it
                    if (body.gameObject.y > worldBounds.height + 200) {
                        console.warn(`Game: Cat fell off map at y=${body.gameObject.y}, destroying`);
                        body.gameObject.destroy();
                    } else if (body.gameObject.y > worldBounds.height) {
                        // Reset to a safe position near the bottom
                        body.gameObject.y = worldBounds.height - CONFIG.TILE_SIZE * 2;
                        body.gameObject.setVelocityY(0);
                    }
                }
            });
            
            scene.input.keyboard.on('keydown-D', () => {
                this.toggleDebug();
            });

            // Update UI
            this.updateUI();
            
            console.log('Game: Create finished successfully');
        } catch (error) {
            console.error('CRITICAL ERROR in Game.create:', error);
            console.error('Scene:', scene);
            console.error('This:', this);
        }
    }

    // generateLevelFromTilesheet method removed - tilesheet functionality no longer used

    renderLevel(scene: any): void {
        if (!this.levelData) {
            console.warn('Game: No level data available, cannot render level');
            return;
        }

        // Create platforms group
        this.platforms = scene.physics.add.staticGroup();
        
        // Create background layer
        if (this.levelData.layers && this.levelData.layers.background) {
            this.renderLayer(scene, this.levelData.layers.background, false);
        }
        
        // Create ground/platform layer (solid/collidable)
        if (this.levelData.layers && this.levelData.layers.ground) {
            this.renderLayer(scene, this.levelData.layers.ground, true);
        }
        
        // Create decorative layer
        if (this.levelData.layers && this.levelData.layers.decorative) {
            this.renderLayer(scene, this.levelData.layers.decorative, false);
        }

        // Create player at spawn point
        const spawnX = this.levelData.spawn ? this.levelData.spawn.x * CONFIG.TILE_SIZE : 100;
        const spawnY = this.levelData.spawn ? this.levelData.spawn.y * CONFIG.TILE_SIZE : 450;
        
        // Reset player position if already created
        if (this.player) {
            this.player.setPosition(spawnX, spawnY);
        } else {
             this.player = scene.physics.add.sprite(spawnX, spawnY, 'playerSprite');
             this.player.setBounce(0.2);
             this.player.setCollideWorldBounds(true);
             this.player.setScale(CONFIG.VISUAL.PLAYER_SCALE_DEFAULT);
        }

        // Physics collisions
        scene.physics.add.collider(this.player, this.platforms);

        // Create collectibles and enemies from level data
        if (this.levelData.collectibles && this.levelData.collectibles.length > 0) {
            this.createCollectiblesFromLevel(scene);
        } else {
            this.createCollectibles(scene);
        }

        if (this.levelData.enemies && this.levelData.enemies.length > 0) {
            this.createEnemiesFromLevel(scene);
        } else {
            this.createEnemies(scene);
        }
        
        // Helper to setup overlap
        if (this.collectibles) {
             scene.physics.add.overlap(this.player, this.collectibles, this.collectItem, null, this);
        }
    }

    renderLayer(scene: any, layerData: number[][], isSolid: boolean): void {
        const tileSize = CONFIG.TILE_SIZE;
        for (let row = 0; row < layerData.length; row++) {
            for (let col = 0; col < layerData[row].length; col++) {
                const tileIndex = layerData[row][col];
                if (tileIndex >= 0) {
                    const x = col * tileSize;
                    const y = row * tileSize;
                    
                    // Create tile visual using colored rectangle (tilesheet removed)
                    const tile = scene.add.rectangle(x, y, tileSize, tileSize, isSolid ? CONFIG.VISUAL.PLATFORM_COLOR : CONFIG.VISUAL.GROUND_COLOR);
                    tile.setOrigin(0, 0);
                    tile.setDepth(isSolid ? CONFIG.VISUAL.DEPTH_COLLECTIBLES_ENEMIES : CONFIG.VISUAL.DEPTH_TILES); // Ground tiles on top
                    
                    // If solid, create collision box
                    if (isSolid) {
                        const platform = scene.add.rectangle(x, y, tileSize, tileSize, CONFIG.VISUAL.PLATFORM_COLOR);
                        // Add physics as static (true parameter makes it immovable automatically)
                        scene.physics.add.existing(platform, true);
                        this.platforms.add(platform);
                        platform.setOrigin(0, 0);
                        // Static bodies are automatically immovable, but ensure body exists
                        if (platform.body) {
                            platform.body.setSize(tileSize, tileSize);
                            platform.body.setOffset(0, 0); // Ensure collision box aligns with tile
                        }
                        // Make it invisible (we already have the visual tile above)
                        platform.setAlpha(0);
                        platform.setDepth(CONFIG.VISUAL.DEPTH_COLLECTIBLES_ENEMIES);
                    }
                }
            }
        }
    }

    // Add global error handler
    componentDidMount() {
        window.addEventListener('error', (event) => {
            console.error('Global error caught:', event.error);
            console.error('Error message:', event.message);
            console.error('Error source:', event.filename, 'Line:', event.lineno);
        });
    }

    createLevel1(scene: any): void {
        console.log('Game: Creating simple floor level...');
        this.createSimpleFloor(scene);
    }
    
    /**
     * Create a simple generic floor with collision tiles
     */
    createSimpleFloor(scene: any): void {
        // Ensure animations are created before creating enemies
        this.createAnimations(scene);
        
        // Clear existing groups
        if (this.platforms) this.platforms.clear(true, true);
        if (this.enemies) this.enemies.clear(true, true);
        if (this.collectibles) this.collectibles.clear(true, true);
        if (this.hazards) this.hazards.clear(true, true);

        // Initialize groups
        this.platforms = scene.physics.add.staticGroup();
        this.hazards = scene.physics.add.staticGroup();
        this.enemies = scene.physics.add.group();
        this.collectibles = scene.physics.add.staticGroup();

        const tileSize = CONFIG.TILE_SIZE; 
        const gameWidth = CONFIG.GAME_WIDTH;
        const gameHeight = CONFIG.GAME_HEIGHT;
        
        // Create floor - positioned higher than bottom, spans full world width
        // Default world width is 3x viewport (matches background tiles)
        const worldWidth = gameWidth * 3; // 3072px - matches default world bounds
        const floorY = gameHeight - tileSize; // Position ground one tile higher than bottom
        const floorHeight = tileSize / 2; // Make floor collision box half the normal tile height (32px instead of 64px)
        
        // Floor width: full world width to span entire level
        const floorWidth = worldWidth;
        
        // Create a single floor collision box with reduced height, positioned at world origin (0,0)
        // Position rectangle at its center for easier body alignment
        // Rectangle should span from x=0 to x=worldWidth, and from y=floorTileY to y=floorTileY+floorHeight
        const floorTileY = floorY - floorHeight; // Top edge position so bottom edge is at floorY
        const floorCenterX = worldWidth / 2; // Center of the floor horizontally
        const floorCenterY = floorTileY + (floorHeight / 2); // Center of the floor vertically
        console.log(`Game: Creating floor collision box: top=${floorTileY}, bottom=${floorY}, width=${floorWidth}, height=${floorHeight}, center=(${floorCenterX}, ${floorCenterY})`);
        
        const floorTile = scene.add.rectangle(floorCenterX, floorCenterY, floorWidth, floorHeight, CONFIG.VISUAL.GROUND_COLOR);
        floorTile.setOrigin(0.5, 0.5); // Center origin so body center aligns with rectangle center
        // Ensure ground scrolls with world (not fixed to camera)
        floorTile.setScrollFactor(1, 1); // Scroll with world/camera like background
        // Hide collision block - it's for physics only (only visible in debug mode via physics debug draw)
        floorTile.setVisible(CONFIG.DEBUG_MODE); // Only visible in debug mode
        floorTile.setDepth(CONFIG.VISUAL.DEPTH_BACKGROUND - 1); // Behind background
        
        // Add physics body for collision
        scene.physics.add.existing(floorTile, true); // true = static body (already immovable by default)
        if (floorTile.body) {
            // Set body size to match rectangle dimensions
            floorTile.body.setSize(floorWidth, floorHeight);
            // With origin (0.5, 0.5), the body center is at the rectangle center, so no offset needed
            floorTile.body.setOffset(0, 0);
            // Static bodies are automatically immovable - no need to call setImmovable()
            const bodyTop = floorTile.body.y - floorTile.body.height/2;
            const bodyBottom = floorTile.body.y + floorTile.body.height/2;
            const bodyLeft = floorTile.body.x - floorTile.body.width/2;
            const bodyRight = floorTile.body.x + floorTile.body.width/2;
            console.log(`Game: Floor physics body created: size=${floorWidth}x${floorHeight}, rect.center=(${floorTile.x.toFixed(1)}, ${floorTile.y.toFixed(1)}), body.center=(${floorTile.body.x.toFixed(1)}, ${floorTile.body.y.toFixed(1)})`);
            console.log(`Game: Floor body bounds: left=${bodyLeft.toFixed(1)}, right=${bodyRight.toFixed(1)}, top=${bodyTop.toFixed(1)}, bottom=${bodyBottom.toFixed(1)}`);
            console.log(`Game: Floor should span: x=0 to x=${worldWidth}, y=${floorTileY} to y=${floorY}`);
        } else {
            console.error('Game: ERROR - Floor tile physics body was not created!');
        }
        
        // Add to platforms group
        this.platforms.add(floorTile);
        console.log(`Game: Floor tile added to platforms group. Group size: ${this.platforms.children.size}`);
        
        // Add collisions (player might not exist yet, will be added later in create method)
        if (this.player) {
            scene.physics.add.collider(this.player, this.platforms);
            console.log('Game: Player-platform collider added in createLevel1');
        } else {
            console.log('Game: Player not yet created, collider will be added later in create method');
        }
        // Enemies and other collisions will be added when enemies are uncommented
        // scene.physics.add.collider(this.enemies, this.platforms, this.enemyHitWall, null, this);
        // scene.physics.add.collider(this.player, this.hazards, this.playerHitHazard, null, this);
        // scene.physics.add.overlap(this.player, this.collectibles, this.collectItem, null, this);
        // scene.physics.add.overlap(this.player, this.enemies, this.hitEnemy, null, this);
        
        // Load location-based background if available - do it immediately
        this.loadLocationBackground(scene).catch(err => {
            console.error('Game: Error loading background:', err);
        });
        
        console.log('Game: Simple floor created successfully');
    }
    
    /**
     * Load location-based background (separate from level generation)
     */
    async loadLocationBackground(scene: any): Promise<void> {
        // Load location-based background if available
        let locationBgFrames: string[] | null = null;
        try {
            const framesStr = await this.assetStorage.getItem('location_background_frames');
            if (framesStr) {
                locationBgFrames = JSON.parse(framesStr);
            } else {
                const localFramesStr = localStorage.getItem('location_background_frames');
                if (localFramesStr) {
                    locationBgFrames = JSON.parse(localFramesStr);
                }
                    }
                } catch (e) {
            console.warn('Could not load background frames:', e);
        }
        
        if (locationBgFrames && locationBgFrames.length >= 8) {
            // Create background directly here - simple and immediate
            const firstFrame = locationBgFrames[0];
            const frameKey = 'bg_frame_0';
            
            // Load texture
            if (!scene.textures.exists(frameKey)) {
                try {
                    scene.textures.addBase64(frameKey, firstFrame);
                } catch (e) {
                    console.error('Game: Failed to load background texture:', e);
                    return;
                }
            }
            
            // Wait briefly for texture
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Load all frames for animation
            console.log('🖼️ Loading background animation frames...');
            let loadedFrames = 0;
            const framePromises: Promise<void>[] = [];
            
            for (let i = 1; i < 8; i++) {
                const frameKey_i = `bg_frame_${i}`;
                if (!scene.textures.exists(frameKey_i) && locationBgFrames[i]) {
                    try {
                        // addBase64 returns immediately, but texture might not be ready
                        scene.textures.addBase64(frameKey_i, locationBgFrames[i]);
                        
                        // Wait for texture to be ready
                        const texturePromise = new Promise<void>((resolve) => {
                            const checkTexture = () => {
                                if (scene.textures.exists(frameKey_i)) {
                                    const texture = scene.textures.get(frameKey_i);
                                    if (texture && texture.source && texture.source[0]) {
                                        loadedFrames++;
                                        resolve();
                                    } else {
                                        // Texture exists but not ready, check again
                                        setTimeout(checkTexture, 50);
                                    }
                                } else {
                                    // Texture doesn't exist yet, check again
                                    setTimeout(checkTexture, 50);
                                }
                            };
                            checkTexture();
                        });
                        framePromises.push(texturePromise);
                    } catch (e) {
                        console.warn(`⚠️ Failed to load frame ${i}:`, e);
                    }
                } else if (scene.textures.exists(frameKey_i)) {
                    loadedFrames++;
                }
            }
            
            // Wait for all textures to be ready
            await Promise.all(framePromises);
            console.log(`✅ Loaded ${loadedFrames + 1} background frames (frame 0 + ${loadedFrames} additional)`);
            
            // Verify all frames are available after waiting
            let missingFrames = 0;
            for (let i = 0; i < 8; i++) {
                const frameKey_i = `bg_frame_${i}`;
                if (!scene.textures.exists(frameKey_i)) {
                    console.error(`❌ Background frame ${i} (${frameKey_i}) is missing!`);
                    missingFrames++;
                } else {
                    const texture = scene.textures.get(frameKey_i);
                    if (!texture || !texture.source || !texture.source[0]) {
                        console.warn(`⚠️ Background frame ${i} exists but not ready`);
                        missingFrames++;
                    }
                }
            }
            
            if (missingFrames > 0) {
                console.warn(`⚠️ ${missingFrames} background frames are missing or not ready`);
            } else {
                console.log('✅ All 8 background frames are ready');
            }
            
            // Verify texture
            const texture = scene.textures.get(frameKey);
            if (texture && texture.source && texture.source[0] && texture.source[0].image) {
                console.log(`✅ Texture confirmed: ${texture.source[0].image.width}x${texture.source[0].image.height}`);
            } else {
                console.error('❌ Texture has no image!');
            }
            
            // Create multiple background tiles for seamless horizontal scrolling
            // Since viewport is 1024x1024 and background frames are 1024x1024, we need multiple tiles
            // to cover the viewport and allow scrolling
            const frameWidth = CONFIG.GAME_WIDTH; // 1024
            const frameHeight = CONFIG.GAME_HEIGHT; // 1024
            const tilesNeeded = 3; // 3 tiles = 3072px wide, allows scrolling beyond viewport
            const worldWidth = tilesNeeded * frameWidth; // Total world width for scrolling
            
            // Store sprites
            if (!this.backgroundSprites) this.backgroundSprites = [];
            
            // Create frame keys array for animation
            const frameKeys: string[] = [];
            for (let i = 0; i < 8; i++) {
                frameKeys.push(`bg_frame_${i}`);
            }
            
            // Update world bounds to match background width
            scene.cameras.main.setBounds(0, 0, worldWidth, CONFIG.GAME_HEIGHT);
            scene.physics.world.setBounds(0, 0, worldWidth, CONFIG.GAME_HEIGHT, true, true, true, true);
            
            // Create background tiles
            for (let i = 0; i < tilesNeeded; i++) {
                const xPos = (i * frameWidth) + (frameWidth / 2); // Center of each tile
                const yPos = CONFIG.GAME_HEIGHT / 2; // Center vertically
                
                const bgSprite = scene.add.image(xPos, yPos, frameKey);
                bgSprite.setOrigin(0.5, 0.5);
                bgSprite.setDisplaySize(frameWidth, frameHeight);
                bgSprite.setDepth(CONFIG.VISUAL.DEPTH_BACKGROUND);
                bgSprite.setScrollFactor(1, 1); // Scroll with world/camera
                bgSprite.setVisible(true);
                bgSprite.setAlpha(1.0);
                
                // Store animation data
                bgSprite.setData('frameKeys', frameKeys);
                bgSprite.setData('frameIndex', 0);
                
                // Force to absolute back of display list
                scene.children.sendToBack(bgSprite);
                
                this.backgroundSprites.push(bgSprite);
            }
            
            console.log(`✅ Background created with ${tilesNeeded} tiles (${worldWidth}x${frameHeight}) for scrolling (scrollFactor 1,1)`);
            
            // Wait for all textures to be fully loaded and ready
            console.log('⏳ Waiting for all background textures to be ready...');
            let allTexturesReady = false;
            let waitAttempts = 0;
            const maxWaitAttempts = 20; // 20 * 100ms = 2 seconds max wait
            
            while (!allTexturesReady && waitAttempts < maxWaitAttempts) {
                allTexturesReady = true;
                for (let i = 0; i < 8; i++) {
                    const frameKey_i = `bg_frame_${i}`;
                    if (!scene.textures.exists(frameKey_i)) {
                        allTexturesReady = false;
                        break;
                    }
                    const texture = scene.textures.get(frameKey_i);
                    if (!texture || !texture.source || !texture.source[0] || !texture.source[0].image) {
                        allTexturesReady = false;
                        break;
                    }
                }
                
                if (!allTexturesReady) {
                    waitAttempts++;
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
            
            if (allTexturesReady) {
                console.log('✅ All 8 background textures are ready!');
            } else {
                console.warn('⚠️ Not all background textures are ready after waiting, but starting animation anyway');
                // Log which frames are missing
                for (let i = 0; i < 8; i++) {
                    const frameKey_i = `bg_frame_${i}`;
                    if (!scene.textures.exists(frameKey_i)) {
                        console.warn(`⚠️ Frame ${i} (${frameKey_i}) is still missing`);
                    }
                }
            }
            
            // Start animation timer (2 fps) - animates all background tiles
            if (this.backgroundFrameTimer) {
                this.backgroundFrameTimer.destroy();
            }
            const frameDuration = 1000 / CONFIG.TIMING.BACKGROUND_ANIMATION_SPEED;
            console.log(`🎬 Starting background animation timer: ${frameDuration}ms delay (${CONFIG.TIMING.BACKGROUND_ANIMATION_SPEED} fps)`);
            
            // Store scene reference for the callback
            const sceneRef = scene;
            let animationCycleCount = 0;
            
            // Verify scene.time exists and is active
            if (!scene.time) {
                console.error('❌ scene.time does not exist! Cannot create animation timer.');
                return;
            }
            
            console.log(`🔍 Scene time manager check: exists=${!!scene.time}, paused=${scene.time.paused}`);
            
            // Create the timer using a recursive delayedCall pattern for more reliability
            try {
                const animateBackground = () => {
                    try {
                        animationCycleCount++;
                        
                        // Log every callback to verify it's firing
                        if (animationCycleCount === 1) {
                            console.log('🎬 Background animation timer callback fired for the first time!');
                        }
                            
                            if (!this.backgroundSprites || this.backgroundSprites.length === 0) {
                                if (animationCycleCount % 8 === 0) {
                                    console.warn('⚠️ Background animation: No background sprites found');
                                }
                                return;
                            }
                            
                            let updatedCount = 0;
                            this.backgroundSprites.forEach((bgSprite: any, index: number) => {
                                if (!bgSprite || !bgSprite.active) {
                                    if (index === 0 && animationCycleCount === 1) {
                                        console.warn(`⚠️ Background sprite ${index} is not active`);
                                    }
                                    return;
                                }
                                
                                const currentIndex = bgSprite.getData('frameIndex') || 0;
                                const nextIndex = (currentIndex + 1) % 8;
                                const frameKeys = bgSprite.getData('frameKeys') || [];
                                
                                if (frameKeys.length === 0) {
                                    if (index === 0 && animationCycleCount === 1) {
                                        console.error(`❌ Background sprite ${index} has no frameKeys!`);
                                    }
                                    return;
                                }
                                
                                const nextFrameKey = frameKeys[nextIndex];
                                
                                if (!nextFrameKey) {
                                    if (index === 0 && animationCycleCount === 1) {
                                        console.error(`❌ Background sprite ${index}: No frameKey for index ${nextIndex}`);
                                    }
                                    return;
                                }
                                
                                // Check if texture exists
                                if (!sceneRef.textures.exists(nextFrameKey)) {
                                    if (index === 0 && animationCycleCount <= 3) {
                                        console.warn(`⚠️ Background animation: Texture ${nextFrameKey} not found (frame ${nextIndex})`);
                                    }
                                    return;
                                }
                                
                                try {
                                    // Set the texture
                                    bgSprite.setTexture(nextFrameKey);
                                    bgSprite.setData('frameIndex', nextIndex);
                                    updatedCount++;
                                    
                                    // Log first few updates to verify it's working
                                    if (index === 0 && animationCycleCount <= 3) {
                                        console.log(`🎬 Background animation: Updated sprite ${index} to frame ${nextIndex} (${nextFrameKey})`);
                                    }
                                    
                                    // Debug log every 8 frames (once per full cycle) for first sprite only
                                    if (nextIndex === 0 && index === 0) {
                                        console.log(`🎬 Background animation cycle ${Math.floor(animationCycleCount / 8)} complete`);
                                    }
                                } catch (e) {
                                    console.error(`❌ Error setting texture ${nextFrameKey} on sprite ${index}:`, e);
                                }
                            });
                            
                        if (updatedCount === 0 && animationCycleCount <= 3) {
                            console.warn(`⚠️ Background animation: No sprites were updated (cycle ${animationCycleCount})`);
                        }
                        
                        // Schedule next frame
                        if (this.backgroundSprites && this.backgroundSprites.length > 0) {
                            this.backgroundFrameTimer = sceneRef.time.delayedCall(frameDuration, animateBackground);
                        }
                    } catch (callbackError) {
                        console.error('❌ Error in background animation callback:', callbackError);
                        // Try to continue anyway
                        if (this.backgroundSprites && this.backgroundSprites.length > 0) {
                            this.backgroundFrameTimer = sceneRef.time.delayedCall(frameDuration, animateBackground);
                        }
                    }
                };
                
                // Start the animation loop
                this.backgroundFrameTimer = scene.time.delayedCall(frameDuration, animateBackground);
                
                // Verify timer was created
                if (!this.backgroundFrameTimer) {
                    console.error('❌ Failed to create background animation timer!');
                    return;
                }
                
                console.log(`✅ Background animation timer created using delayedCall pattern`);
                
                // Test if timer is working by checking after a short delay
                scene.time.delayedCall(100, () => {
                    if (animationCycleCount === 0) {
                        console.warn('⚠️ Background animation timer callback has not fired after 100ms - timer may not be active');
                        console.log(`🔍 Timer state: exists=${!!this.backgroundFrameTimer}, scene.time.paused=${sceneRef.time.paused}`);
                    } else {
                        console.log(`✅ Background animation timer is working! Callback fired ${animationCycleCount} time(s)`);
                    }
                });
                
            } catch (timerError) {
                console.error('❌ Error creating background animation timer:', timerError);
            }
            
            console.log('✅ Background created directly in loadLocationBackground');
        } else {
            console.log('Game: No location background available, using default background');
        }
    }

    // generateLevelFromCSV method removed - using simple floor instead

    /**
     * Update background when it becomes available (called after async generation)
     * SIMPLIFIED VERSION - Just get ONE frame rendering first
     */
    async updateBackground(): Promise<void> {
        // If background already created in loadLocationBackground, skip
        if (this.backgroundSprites && this.backgroundSprites.length > 0) {
            console.log('🔵 updateBackground: Background already created, skipping');
            return;
        }
        console.log('🔵 updateBackground START');
        
        if (!this.currentScene) {
            console.error('❌ No scene available');
            return;
        }
        
        if (this.isUpdatingBackground) {
            console.log('⏸️ Update already in progress, skipping');
            return;
        }
        
        this.isUpdatingBackground = true;
        console.log('✅ Update flag set');
        
        try {
            const scene = this.currentScene;
            console.log('🔵 Getting frames from storage...');
            
            // SIMPLIFIED: Just get first frame
            let firstFrame: string | null = null;
            try {
                const framesStr = await this.assetStorage.getItem('location_background_frames');
                if (framesStr) {
                    const frames = JSON.parse(framesStr);
                    console.log(`✅ Loaded ${frames.length} frames from AssetStorage`);
                    if (frames.length > 0) {
                        firstFrame = frames[0];
                        console.log(`✅ First frame length: ${firstFrame.length}, starts: ${firstFrame.substring(0, 30)}...`);
                    }
                } else {
                    const localFramesStr = localStorage.getItem('location_background_frames');
                    if (localFramesStr) {
                        const frames = JSON.parse(localFramesStr);
                        console.log(`✅ Loaded ${frames.length} frames from localStorage`);
                        if (frames.length > 0) {
                            firstFrame = frames[0];
                            console.log(`✅ First frame length: ${firstFrame.length}`);
                        }
                    }
                }
            } catch (e) {
                console.error('❌ Error loading frames:', e);
            }
            
            if (!firstFrame) {
                console.error('❌ No first frame available');
                this.isUpdatingBackground = false;
                return;
            }
            // SIMPLIFIED: Just load first frame and create ONE image
            console.log('🔵 Loading texture...');
            const frameKey = 'bg_frame_0';
            
            // Load texture - try addBase64 first, fallback to image element if needed
            if (!scene.textures.exists(frameKey)) {
                console.log('🔵 Loading texture...');
                try {
                    scene.textures.addBase64(frameKey, firstFrame);
                    console.log('✅ Texture added via addBase64');
                } catch (e) {
                    console.warn('⚠️ addBase64 failed, trying image element method:', e);
                    // Fallback: load via image element
                    const img = new Image();
                    await new Promise<void>((resolve, reject) => {
                        img.onload = () => {
                            try {
                                scene.textures.addImage(frameKey, img);
                                console.log('✅ Texture loaded via image element');
                                resolve();
                            } catch (err) {
                                reject(err);
                            }
                        };
                        img.onerror = () => reject(new Error('Image load failed'));
                        img.src = firstFrame;
                    });
                }
            } else {
                console.log('✅ Texture already exists');
            }
            
            // Wait for texture to be ready
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Verify texture
            if (!scene.textures.exists(frameKey)) {
                console.error('❌ Texture not available after load');
                this.isUpdatingBackground = false;
                return;
            }
            
            const texture = scene.textures.get(frameKey);
            if (!texture || !texture.source || texture.source.length === 0 || !texture.source[0]?.image) {
                console.error('❌ Texture has no valid image source');
                this.isUpdatingBackground = false;
                return;
            }
            
            console.log(`✅ Texture verified: ${texture.source[0].image.width}x${texture.source[0].image.height}`);
            
            // Try using a simple image first - position at viewport center with scrollFactor(0,0)
            // This should be the simplest possible setup
            const viewportCenterX = CONFIG.GAME_WIDTH / 2;
            const viewportCenterY = CONFIG.GAME_HEIGHT / 2;
            
            console.log(`🔵 Creating background image at viewport center (${viewportCenterX}, ${viewportCenterY})`);
            
            // CRITICAL: Load all 8 frames first, then create sprite
            // Load remaining frames in background
            for (let i = 1; i < 8; i++) {
                const frameKey_i = `bg_frame_${i}`;
                if (!scene.textures.exists(frameKey_i) && frames[i]) {
                    try {
                        scene.textures.addBase64(frameKey_i, frames[i]);
                    } catch (e) {
                        console.warn(`⚠️ Failed to load frame ${i}:`, e);
                    }
                }
            }
            
            // Wait a moment for textures to be ready
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Get camera position - it might have moved if player already exists
            const camera = scene.cameras.main;
            const cameraX = camera.scrollX || 0;
            const cameraY = camera.scrollY || 0;
            
            // Position at camera center in world coordinates
            const worldX = cameraX + (CONFIG.GAME_WIDTH / 2);
            const worldY = cameraY + (CONFIG.GAME_HEIGHT / 2);
            
            console.log(`🔵 Camera at (${cameraX}, ${cameraY}), creating background at world (${worldX}, ${worldY})`);
            const bgSprite = scene.add.image(worldX, worldY, frameKey);
            
            if (!bgSprite) {
                console.error('❌ Failed to create background image');
                this.isUpdatingBackground = false;
                return;
            }
            
            // Use scrollFactor(0,0) to fix to camera viewport
            bgSprite.setOrigin(0.5, 0.5);
            bgSprite.setDisplaySize(CONFIG.GAME_WIDTH, CONFIG.GAME_HEIGHT);
            bgSprite.setDepth(CONFIG.VISUAL.DEPTH_BACKGROUND);
            bgSprite.setScrollFactor(0, 0); // Fixed to camera
            bgSprite.setPosition(CONFIG.GAME_WIDTH / 2, CONFIG.GAME_HEIGHT / 2); // Viewport center
            bgSprite.setVisible(true);
            bgSprite.setAlpha(1.0);
            
            // Remove red tint - use normal image
            // bgSprite.setTint(0xff0000); // REMOVED
            
            // Force it to the back
            scene.children.sendToBack(bgSprite);
            
            console.log(`✅ Background created at viewport center with scrollFactor(0,0)`);
            
            // Store sprite
            if (!this.backgroundSprites) this.backgroundSprites = [];
            this.backgroundSprites.push(bgSprite);
            
            // Set up frame cycling for animation (2 fps)
            const frameKeys: string[] = [];
            for (let i = 0; i < 8; i++) {
                frameKeys.push(`bg_frame_${i}`);
            }
            bgSprite.setData('frameKeys', frameKeys);
            bgSprite.setData('frameIndex', 0);
            
            // Start animation timer
            if (this.backgroundFrameTimer) {
                this.backgroundFrameTimer.destroy();
            }
            const frameDuration = 1000 / CONFIG.TIMING.BACKGROUND_ANIMATION_SPEED;
            this.backgroundFrameTimer = scene.time.addEvent({
                delay: frameDuration,
                callback: () => {
                    if (bgSprite && bgSprite.active) {
                        const currentIndex = bgSprite.getData('frameIndex') || 0;
                        const nextIndex = (currentIndex + 1) % 8;
                        const nextFrameKey = frameKeys[nextIndex];
                        if (scene.textures.exists(nextFrameKey)) {
                            bgSprite.setTexture(nextFrameKey);
                            bgSprite.setData('frameIndex', nextIndex);
                        }
                    }
                },
                loop: true
            });
            
            console.log(`✅ Background created - size: ${bgSprite.displayWidth}x${bgSprite.displayHeight}, depth: ${bgSprite.depth}`);
            
            // CRITICAL VERIFICATION: Check if sprite is actually in display list and will render
            console.log('🔍 Background sprite verification:');
            console.log(`  - In scene.children.list: ${scene.children.list.includes(bgSprite)}`);
            console.log(`  - In displayList: ${scene.sys.displayList.list.includes(bgSprite)}`);
            console.log(`  - Active: ${bgSprite.active}`);
            console.log(`  - Visible: ${bgSprite.visible}`);
            console.log(`  - Alpha: ${bgSprite.alpha}`);
            console.log(`  - Texture key: ${bgSprite.texture?.key}`);
            console.log(`  - Texture has source: ${bgSprite.texture?.source?.length > 0}`);
            console.log(`  - Display size: ${bgSprite.displayWidth}x${bgSprite.displayHeight}`);
            console.log(`  - Position: (${bgSprite.x}, ${bgSprite.y})`);
            console.log(`  - ScrollFactor: (${bgSprite.scrollFactorX}, ${bgSprite.scrollFactorY})`);
            
            // Force a render update
            bgSprite.setVisible(false);
            scene.sys.displayList.depthSort();
            setTimeout(() => {
                bgSprite.setVisible(true);
                console.log('🔵 Forced visibility toggle to trigger render');
            }, 50);
            
        } catch (error) {
            console.error('Game: Error updating background:', error);
        } finally {
            this.isUpdatingBackground = false;
        }
    }

    playerHitHazard(player: any, hazard: any): void {
        if (this.isGameOver) return;
        console.log('Game: Ouch! Hit water/hazard.');
        
        // Simple deathLogic: Respawn or Lose Life
        player.setTint(0xff0000);
        player.setVelocity(0, -400); 
        
        // Reset after short delay
        if (!player.isHit) {
             player.isHit = true;
             setTimeout(() => {
                 this.gameOver();
                 player.isHit = false;
             }, CONFIG.TIMING.RETRY_DELAY_LONG);
        }
    }

    createCollectiblesFromLevel(scene: any): void {
        this.collectibles = scene.physics.add.group();
        
        this.levelData.collectibles.forEach(pos => {
            const collectible = this.collectibles.create(pos.x * CONFIG.TILE_SIZE, pos.y * CONFIG.TILE_SIZE, 'collectible');
            // Use tile-sized collision box for consistency
            collectible.body.setSize(CONFIG.TILE_SIZE, CONFIG.TILE_SIZE);
        });

        scene.physics.add.overlap(this.player, this.collectibles, this.collectItem, null, this);
    }

    createEnemiesFromLevel(scene: any): void {
        this.enemies = scene.physics.add.group();

        this.levelData.enemies.forEach(enemyData => {
            if (!scene.textures.exists('cat')) {
                console.warn(`Game: Cannot create cat enemy - 'cat' texture not found`);
                return;
            }
            // TEMPORARILY COMMENTED OUT - Focus on fixing background first
            /*
            // Position cat so feet align with ground level (same as player)
            // enemyData.y is row index, so enemyData.y * TILE_SIZE is top of row (ground level)
            // With origin 0.5,1.0, sprite Y position directly represents feet position
            const enemy = this.enemies.create(enemyData.x * CONFIG.TILE_SIZE + (CONFIG.TILE_SIZE / 2), enemyData.y * CONFIG.TILE_SIZE, 'cat', 0);
            if (!enemy) {
                console.error(`Game: Failed to create cat enemy`);
                return;
            }
            // No scaling needed - cat sprite sheet uses universal tile size (64x64 per frame)
            // Render at 1:1 scale (no scaling)
            enemy.setScale(1.0);
            // Set origin to bottom-center (0.5, 1.0) so Y position represents feet/ground level
            enemy.setOrigin(0.5, 1.0);
            enemy.setVisible(true);
            enemy.setAlpha(1.0);
            // Set collision box to match sprite size exactly
            if (enemy.body) {
                // Get actual sprite dimensions
                const spriteWidth = enemy.displayWidth || CONFIG.TILE_SIZE;
                const spriteHeight = enemy.displayHeight || CONFIG.TILE_SIZE;
                // Set collision box to match sprite size exactly
                enemy.body.setSize(spriteWidth, spriteHeight);
                // With origin 0.5,1.0 (bottom-center), offset (0, -height) positions collision box to align with sprite
                enemy.body.setOffset(0, -spriteHeight);
            } 
            // Velocity based on tile size: 1.25 tiles per second
            const velocity = enemyData.type === 'moving' ? -(CONFIG.TILE_SIZE * 1.25) : 0;
            enemy.setVelocityX(velocity);
            enemy.setCollideWorldBounds(true);
            enemy.body.onWorldBounds = true; // Trigger events if needed
            enemy.setBounce(CONFIG.PHYSICS.ENEMY_BOUNCE_X, CONFIG.PHYSICS.ENEMY_BOUNCE_Y);
            
            // Initialize enemy data
            const direction = velocity > 0 ? 1 : (velocity < 0 ? -1 : 0);
            enemy.setData('direction', direction);
            enemy.setData('state', velocity !== 0 ? 'walking' : 'idle');
            enemy.setData('attackCooldown', 0);
            enemy.setData('isAttacking', false);
            enemy.setData('attackDamageWindow', false);
            
            // Only play animations if they exist
            if (velocity < 0 && scene.anims.exists('cat-walk-left')) {
                enemy.anims.play('cat-walk-left');
            } else if (velocity > 0 && scene.anims.exists('cat-walk-right')) {
                enemy.anims.play('cat-walk-right');
            } else if (scene.anims.exists('cat-idle')) {
                enemy.anims.play('cat-idle');
            }
            */
        });

        // Ensure colliders are set up
        // TEMPORARILY COMMENTED OUT - Player and enemies are commented out
        /*
        scene.physics.add.collider(this.enemies, this.platforms);
        scene.physics.add.overlap(this.player, this.enemies, this.hitEnemy, null, this);
        */
        
    }

    createAnimations(scene: any): void {
        // Ensure sprite sheets exist before creating animations
        if (!scene.textures.exists('playerSprite')) {
            console.warn('Game: Cannot create player animations - playerSprite texture not found');
            // Don't return early - we might still need to create cat animations
        } else {
            // Create player animations individually if they don't exist
            // Walking right
            if (!scene.anims.exists('walk-right')) {
        scene.anims.create({
            key: 'walk-right',
                    frames: scene.anims.generateFrameNumbers('playerSprite', { 
                        start: CONFIG.ANIMATION.PLAYER_WALK_RIGHT_START, 
                        end: CONFIG.ANIMATION.PLAYER_WALK_RIGHT_END 
                    }),
                    frameRate: CONFIG.ANIMATION.PLAYER_WALK_RIGHT_FRAME_RATE,
            repeat: -1
        });
                console.log('Game: ✓ Created walk-right animation');
            }

        // Walking left (Row 2: frames 4-7)
            if (!scene.anims.exists('walk-left')) {
        scene.anims.create({
            key: 'walk-left',
                    frames: scene.anims.generateFrameNumbers('playerSprite', { 
                        start: CONFIG.ANIMATION.PLAYER_WALK_LEFT_START, 
                        end: CONFIG.ANIMATION.PLAYER_WALK_LEFT_END 
                    }),
                    frameRate: CONFIG.ANIMATION.PLAYER_WALK_LEFT_FRAME_RATE,
            repeat: -1
        });
                console.log('Game: ✓ Created walk-left animation');
            }

        // Jumping
            if (!scene.anims.exists('jump')) {
        scene.anims.create({
            key: 'jump',
                    frames: scene.anims.generateFrameNumbers('playerSprite', { 
                        start: CONFIG.ANIMATION.PLAYER_JUMP_START, 
                        end: CONFIG.ANIMATION.PLAYER_JUMP_END 
                    }),
                    frameRate: CONFIG.ANIMATION.PLAYER_JUMP_FRAME_RATE,
            repeat: -1
        });
                console.log('Game: ✓ Created jump animation');
            }

        // Idle
            if (!scene.anims.exists('idle')) {
        scene.anims.create({
            key: 'idle',
                    frames: scene.anims.generateFrameNumbers('playerSprite', { 
                        start: CONFIG.ANIMATION.PLAYER_IDLE_START, 
                        end: CONFIG.ANIMATION.PLAYER_IDLE_END 
                    }),
                    frameRate: CONFIG.ANIMATION.PLAYER_IDLE_FRAME_RATE,
            repeat: -1
        });
                console.log('Game: ✓ Created idle animation');
            }
        }

        // CAT ENEMY ANIMATIONS
        // Only create if cat sprite sheet exists
        const context = { operation: 'createCatAnimations', module: 'Game' };
        
        console.log(`Game: createAnimations called - checking for cat texture...`);
        const catTextureExists = scene.textures.exists('cat');
        console.log(`Game: Cat texture exists: ${catTextureExists}`);
        
        if (catTextureExists) {
            try {
                const catTexture = scene.textures.get('cat');
                console.log(`Game: Got cat texture:`, catTexture ? 'yes' : 'no');
                
                if (!catTexture) {
                    errorHandler.createError(
                        ErrorType.TEXTURE_ERROR,
                        'Cat texture exists check returned true but get() returned null',
                        { ...context, details: { textureKey: 'cat' } },
                        null,
                        'Cat texture is in an invalid state',
                        'Try clearing cache and refreshing'
                    );
                    return;
                }
                
                const catFrames = catTexture.frameTotal || 0;
                const expectedFrames = CONFIG.API.SPRITE_SHEET_FRAMES_PER_ROW * CONFIG.API.SPRITE_SHEET_ROWS; // 16
                
                console.log(`Game: Creating cat animations - texture exists, ${catFrames} frames available`);
                console.log(`Game: Cat texture details - key: ${catTexture.key}, frameTotal: ${catTexture.frameTotal}, source: ${catTexture.source ? 'exists' : 'missing'}`);
                
                // Validate frame count
                if (catFrames === 0) {
                    errorHandler.createError(
                        ErrorType.VALIDATION_ERROR,
                        'Cat texture has 0 frames',
                        { ...context, details: { catFrames, expectedFrames } },
                        null,
                        'Cat sprite sheet has no frames',
                        'Regenerate the cat sprite sheet'
                    );
                    return;
                }
            
            if (catFrames < expectedFrames) {
                console.warn(`Game: Cat texture has only ${catFrames} frames, expected ${expectedFrames}. Animations may not work correctly.`);
            }
            
            // Remove existing animations if they exist (to allow recreation)
            const catAnimKeys = ['cat-walk-right', 'cat-walk-left', 'cat-attack', 'cat-idle'];
            catAnimKeys.forEach(key => {
                if (scene.anims.exists(key)) {
                    scene.anims.remove(key);
                    console.log(`Game: Removed existing ${key} animation`);
                }
            });
            
            // Row 1 (frames 0-3): Walk Right - 4 frames
            try {
                const walkRightStart = CONFIG.ANIMATION.CAT_WALK_RIGHT_START;
                const walkRightEnd = Math.min(CONFIG.ANIMATION.CAT_WALK_RIGHT_END, catFrames - 1, 15); // Cap at 15 to avoid frame 16
                
                console.log(`Game: Attempting to generate cat-walk-right frames: start=${walkRightStart}, end=${walkRightEnd}, totalFrames=${catFrames}`);
                
                let walkRightFrames: any[] = [];
                try {
                    walkRightFrames = scene.anims.generateFrameNumbers('cat', { 
                        start: walkRightStart, 
                        end: walkRightEnd
                    });
                } catch (genError) {
                    console.error('Game: generateFrameNumbers failed, creating frames manually:', genError);
                    // Manually create frames
                    for (let i = walkRightStart; i <= walkRightEnd; i++) {
                        if (catTexture.has(i)) {
                            walkRightFrames.push({ key: 'cat', frame: i });
                        }
                    }
                }
                
                console.log(`Game: Generated cat-walk-right frames: ${walkRightFrames.length} frames`);
                
                if (walkRightFrames.length === 0) {
                    errorHandler.handleAnimationError(
                        new Error(`No frames generated for cat-walk-right. Texture has ${catFrames} frames, trying to access ${walkRightStart}-${walkRightEnd}`),
                        'cat-walk-right',
                        { ...context, details: { catFrames, walkRightStart, walkRightEnd } }
                    );
                } else {
                    try {
            scene.anims.create({
                key: 'cat-walk-right',
                            frames: walkRightFrames,
                            frameRate: CONFIG.ANIMATION.CAT_WALK_RIGHT_FRAME_RATE,
                repeat: -1
            });
                        console.log(`Game: ✓ Created cat-walk-right animation (${walkRightFrames.length} frames: ${walkRightStart}-${walkRightEnd})`);
                    } catch (createError) {
                        errorHandler.handleAnimationError(
                            createError,
                            'cat-walk-right',
                            { ...context, details: { frames: walkRightFrames.length, walkRightStart, walkRightEnd } }
                        );
                    }
                }
            } catch (error) {
                errorHandler.handleAnimationError(
                    error,
                    'cat-walk-right',
                    { ...context, details: { stage: 'frame_generation' } }
                );
            }

            // Row 2 (frames 4-7): Walk Left - 4 frames
            try {
                const walkLeftStart = CONFIG.ANIMATION.CAT_WALK_LEFT_START;
                const walkLeftEnd = Math.min(CONFIG.ANIMATION.CAT_WALK_LEFT_END, catFrames - 1, 15); // Cap at 15 to avoid frame 16
                
                console.log(`Game: Attempting to generate cat-walk-left frames: start=${walkLeftStart}, end=${walkLeftEnd}, totalFrames=${catFrames}`);
                
                let walkLeftFrames: any[] = [];
                try {
                    walkLeftFrames = scene.anims.generateFrameNumbers('cat', { 
                        start: walkLeftStart, 
                        end: walkLeftEnd
                    });
                } catch (genError) {
                    console.error('Game: generateFrameNumbers failed, creating frames manually:', genError);
                    // Manually create frames
                    for (let i = walkLeftStart; i <= walkLeftEnd; i++) {
                        if (catTexture.has(i)) {
                            walkLeftFrames.push({ key: 'cat', frame: i });
                        }
                    }
                }
                
                console.log(`Game: Generated cat-walk-left frames: ${walkLeftFrames.length} frames`);
                
                if (walkLeftFrames.length === 0) {
                    errorHandler.handleAnimationError(
                        new Error(`No frames generated for cat-walk-left. Texture has ${catFrames} frames, trying to access ${walkLeftStart}-${walkLeftEnd}`),
                        'cat-walk-left',
                        { ...context, details: { catFrames, walkLeftStart, walkLeftEnd } }
                    );
                } else {
                    try {
            scene.anims.create({
                key: 'cat-walk-left',
                            frames: walkLeftFrames,
                            frameRate: CONFIG.ANIMATION.CAT_WALK_LEFT_FRAME_RATE,
                repeat: -1
            });
                        console.log(`Game: ✓ Created cat-walk-left animation (${walkLeftFrames.length} frames: ${walkLeftStart}-${walkLeftEnd})`);
                    } catch (createError) {
                        errorHandler.handleAnimationError(
                            createError,
                            'cat-walk-left',
                            { ...context, details: { frames: walkLeftFrames.length, walkLeftStart, walkLeftEnd } }
                        );
                    }
                }
            } catch (error) {
                errorHandler.handleAnimationError(
                    error,
                    'cat-walk-left',
                    { ...context, details: { stage: 'frame_generation' } }
                );
            }

            // Row 3 (frames 8-11): Attack/Action - 4 frames
            try {
            scene.anims.create({
                key: 'cat-attack',
                    frames: scene.anims.generateFrameNumbers('cat', { 
                        start: CONFIG.ANIMATION.CAT_ATTACK_START, 
                        end: Math.min(CONFIG.ANIMATION.CAT_ATTACK_END, catFrames - 1)
                    }),
                    frameRate: CONFIG.ANIMATION.CAT_ATTACK_FRAME_RATE,
                repeat: -1
            });
            } catch (error) {
                console.error('Game: Failed to create cat-attack animation:', error);
            }

            // Row 4 (frames 12-15): Idle - 4 frames
            try {
            scene.anims.create({
                key: 'cat-idle',
                    frames: scene.anims.generateFrameNumbers('cat', { 
                        start: CONFIG.ANIMATION.CAT_IDLE_START, 
                        end: Math.min(CONFIG.ANIMATION.CAT_IDLE_END, catFrames - 1)
                    }),
                    frameRate: CONFIG.ANIMATION.CAT_IDLE_FRAME_RATE,
                repeat: -1
            });
            } catch (error) {
                console.error('Game: Failed to create cat-idle animation:', error);
            }
            
            console.log('Game: Finished creating cat animations');
            } catch (error) {
                errorHandler.createError(
                    ErrorType.ANIMATION_ERROR,
                    'Failed to create cat animations',
                    { ...context, details: { stage: 'animation_creation' } },
                    error,
                    'Cat animations could not be created. Cats may not animate properly.',
                    'Check console for details or try regenerating the cat sprite sheet'
                );
            }
        } else {
            console.warn('Game: Cannot create cat animations - cat texture not found');
            console.warn(`Game: Available textures: ${Object.keys(scene.textures.list).join(', ')}`);
        }

        // Set default animation
        if (this.player) this.player.anims.play('idle');
    }

    createEnemies(scene: any): void {
        this.enemies = scene.physics.add.group();

        // Create enemies on platforms using the sprite
        // Create enemies on platforms using the 'cat' key
        if (!scene.textures.exists('cat')) {
            console.warn('Game: Cannot create enemies - cat texture not found');
            return;
        }
        // TEMPORARILY COMMENTED OUT - Focus on fixing background first
        /*
        // Enemy 1
        const enemy1 = this.enemies.create(550, 350, 'cat', 0);
        if (!enemy1) {
            console.error('Game: Failed to create enemy1');
            return;
        }
        // No scaling needed - cat sprite sheet uses universal tile size (64x64 per frame)
        // Render at 1:1 scale (no scaling)
        enemy1.setScale(1.0);
        // Set origin to bottom-center (0.5, 1.0) so Y position represents feet/ground level
        enemy1.setOrigin(0.5, 1.0);
        enemy1.setVisible(true);
        enemy1.setAlpha(1.0);
        // Set collision box to match sprite size exactly
        if (enemy1.body) {
            // Get actual sprite dimensions
            const spriteWidth = enemy1.displayWidth || CONFIG.TILE_SIZE;
            const spriteHeight = enemy1.displayHeight || CONFIG.TILE_SIZE;
            // Set collision box to match sprite size exactly
            enemy1.body.setSize(spriteWidth, spriteHeight);
            // With origin 0.5,1.0 (bottom-center), offset (0, -height) positions collision box to align with sprite
            enemy1.body.setOffset(0, -spriteHeight);
        }
        // Velocity based on tile size: 1.25 tiles per second
        enemy1.setVelocityX(-(CONFIG.TILE_SIZE * CONFIG.PHYSICS.ENEMY_VELOCITY_MULTIPLIER));
        enemy1.setCollideWorldBounds(true);
        enemy1.setBounce(1, 0);
        enemy1.setData('direction', -1);
        enemy1.setData('state', 'walking');
        enemy1.setData('attackCooldown', 0);
        enemy1.setData('isAttacking', false);
        enemy1.setData('attackDamageWindow', false);
        enemy1.anims.play('cat-walk-left');

        // Enemy 2
        const enemy2 = this.enemies.create(150, 200, 'cat', 0);
        if (!enemy2) {
            console.error('Game: Failed to create enemy2');
            return;
        }
        // No scaling needed - cat sprite sheet uses universal tile size (64x64 per frame)
        // Render at 1:1 scale (no scaling)
        enemy2.setScale(1.0);
        // Set origin to bottom-center (0.5, 1.0) so Y position represents feet/ground level
        enemy2.setOrigin(0.5, 1.0);
        enemy2.setVisible(true);
        enemy2.setAlpha(1.0);
        // Set collision box to match sprite size exactly
        if (enemy2.body) {
            // Get actual sprite dimensions
            const spriteWidth = enemy2.displayWidth || CONFIG.TILE_SIZE;
            const spriteHeight = enemy2.displayHeight || CONFIG.TILE_SIZE;
            // Set collision box to match sprite size exactly
            enemy2.body.setSize(spriteWidth, spriteHeight);
            // With origin 0.5,1.0 (bottom-center), offset (0, -height) positions collision box to align with sprite
            enemy2.body.setOffset(0, -spriteHeight);
        }
        // Velocity based on tile size (configured multiplier)
        enemy2.setVelocityX(CONFIG.TILE_SIZE * CONFIG.PHYSICS.ENEMY_VELOCITY_MULTIPLIER);
        enemy2.setCollideWorldBounds(true);
        enemy2.setBounce(CONFIG.PHYSICS.ENEMY_BOUNCE_X, CONFIG.PHYSICS.ENEMY_BOUNCE_Y);
        enemy2.setData('direction', 1);
        enemy2.setData('state', 'walking');
        enemy2.setData('attackCooldown', 0);
        enemy2.setData('isAttacking', false);
        enemy2.setData('attackDamageWindow', false);
        enemy2.anims.play('cat-walk-right');
        */

        // Collision with platforms
        // TEMPORARILY COMMENTED OUT - Player and enemies are commented out
        /*
        scene.physics.add.collider(this.enemies, this.platforms);
        
        // Collision with player
        scene.physics.add.overlap(this.player, this.enemies, this.hitEnemy, null, this);
        */
    }

    createCollectibles(scene: any): void {
        // Create collectible graphic (coin/star)
        const collectibleGraphics = scene.add.graphics();
        collectibleGraphics.fillStyle(CONFIG.VISUAL.COLLECTIBLE_OUTER_COLOR);
        collectibleGraphics.fillCircle(
            CONFIG.TILE_SIZE / 2, 
            CONFIG.TILE_SIZE / 2, 
            CONFIG.TILE_SIZE * CONFIG.VISUAL.COLLECTIBLE_OUTER_RADIUS_MULTIPLIER
        );
        collectibleGraphics.fillStyle(CONFIG.VISUAL.COLLECTIBLE_INNER_COLOR);
        collectibleGraphics.fillCircle(
            CONFIG.TILE_SIZE / 2, 
            CONFIG.TILE_SIZE / 2, 
            CONFIG.TILE_SIZE * CONFIG.VISUAL.COLLECTIBLE_INNER_RADIUS_MULTIPLIER
        );
        collectibleGraphics.generateTexture('collectible', CONFIG.TILE_SIZE, CONFIG.TILE_SIZE);
        collectibleGraphics.destroy();

        this.collectibles = scene.physics.add.group();
        
        // Create collectibles at various positions (using tile-based coordinates)
        // Positions are in tiles, converted to pixels using CONFIG.TILE_SIZE
        const positions = [
            { x: 3, y: 6 },   // 3 tiles right, 6 tiles down (192px, 384px)
            { x: 6, y: 5 },   // 6 tiles right, 5 tiles down (384px, 320px)
            { x: 10, y: 5 },  // 10 tiles right, 5 tiles down (640px, 320px)
            { x: 1, y: 2 },   // 1 tile right, 2 tiles down (64px, 128px)
            { x: 11, y: 2 },  // 11 tiles right, 2 tiles down (704px, 128px)
            { x: 8, y: 8 }    // 8 tiles right, 8 tiles down (512px, 512px)
        ];

        positions.forEach(pos => {
            const pixelX = pos.x * CONFIG.TILE_SIZE;
            const pixelY = pos.y * CONFIG.TILE_SIZE;
            const collectible = this.collectibles.create(pixelX, pixelY, 'collectible');
            // Collision box should be tile-sized for consistency
            collectible.body.setSize(CONFIG.TILE_SIZE, CONFIG.TILE_SIZE);
        });

        // Collision with collectibles
        scene.physics.add.overlap(this.player, this.collectibles, this.collectItem, null, this);
    }

    update(scene: any): void {
        try {
            // Background animation using update loop (more reliable than timers)
            if (this.backgroundSprites && this.backgroundSprites.length > 0) {
                this.backgroundAnimationFrameCounter++;
                if (this.backgroundAnimationFrameCounter >= this.backgroundAnimationFrameDelay) {
                    this.backgroundAnimationFrameCounter = 0;
                    
                    // Cycle through background frames
                    this.backgroundSprites.forEach((bgSprite: any, index: number) => {
                        if (!bgSprite || !bgSprite.active) return;
                        
                        const currentIndex = bgSprite.getData('frameIndex') || 0;
                        const nextIndex = (currentIndex + 1) % 8;
                        const frameKeys = bgSprite.getData('frameKeys') || [];
                        const nextFrameKey = frameKeys[nextIndex];
                        
                        if (nextFrameKey && scene.textures.exists(nextFrameKey)) {
                            try {
                                bgSprite.setTexture(nextFrameKey);
                                bgSprite.setData('frameIndex', nextIndex);
                                
                                // Log first few cycles for debugging
                                if (nextIndex === 0 && index === 0) {
                                    console.log('🎬 Background animation cycle complete (update loop)');
                                }
                            } catch (e) {
                                console.error(`❌ Error setting background texture:`, e);
                            }
                        }
                    });
                }
            }

            // Periodically check if background became available (fallback if updateBackground wasn't called)
            if (scene && !this.backgroundSprites?.length) {
                // Load from AssetStorage or localStorage fallback (async, but we'll handle it in a promise)
                this.assetStorage.getItem('location_background_frames').then((framesStr: string | null) => {
                    let locationBgFrames: string[] | null = null;
                    if (framesStr) {
                        locationBgFrames = JSON.parse(framesStr);
                    } else {
                        const localFramesStr = localStorage.getItem('location_background_frames');
                        if (localFramesStr) {
                            locationBgFrames = JSON.parse(localFramesStr);
                        }
                    }
                    // If we got frames, trigger background update
                    if (framesStr) {
                        try {
                            const locationBgFrames = JSON.parse(framesStr);
                            if (locationBgFrames && locationBgFrames.length >= 8) {
                                this.updateBackground();
                            }
                        } catch (parseError) {
                            // Ignore parse errors
                        }
                    }
                }).catch((e) => {
                    // Ignore errors in periodic check
                });
                
                    // Only check every 5 seconds to avoid spam
                    const now = Date.now();
                    if (!this.lastBackgroundCheck || now - this.lastBackgroundCheck > 5000) {
                        this.lastBackgroundCheck = now;
                        console.log('Game: Background became available, but already created in loadLocationBackground - skipping updateBackground');
                        // Background already created in loadLocationBackground, don't create again
                }
            }
            
            if (!this.player || !this.player.body || !this.cursors) return;
            
            const isOnGround = this.player.body.onFloor() || this.player.body.touching.down;

            // Use universal tile size for all calculations
            const offsetX = (CONFIG.TILE_SIZE * (1 - 0.35)) / 2;

            // Movement handling
            if (this.cursors.left.isDown) {
                this.player.setVelocityX(-CONFIG.PLAYER_SPEED);
                if (isOnGround) {
                    if (this.currentScene && this.currentScene.anims.exists('walk-left')) {
                    this.player.anims.play('walk-left', true);
                    } else {
                        // Fallback: try to create the animation if it doesn't exist
                        if (this.currentScene) {
                            console.warn('Game: walk-left animation not found, attempting to create it');
                            this.createAnimations(this.currentScene);
                            if (this.currentScene.anims.exists('walk-left')) {
                                this.player.anims.play('walk-left', true);
                            } else {
                                console.error('Game: Failed to create walk-left animation');
                            }
                        }
                    }
                    this.player.setOffset(offsetX, CONFIG.TILE_SIZE * 0.22);
                }
                // No flip needed - walk-left uses dedicated frames (row 2)
            } else if (this.cursors.right.isDown) {
                this.player.setVelocityX(CONFIG.PLAYER_SPEED);
                if (isOnGround) {
                    if (this.currentScene && this.currentScene.anims.exists('walk-right')) {
                    this.player.anims.play('walk-right', true);
                    } else {
                        // Fallback: try to create the animation if it doesn't exist
                        if (this.currentScene) {
                            console.warn('Game: walk-right animation not found, attempting to create it');
                            this.createAnimations(this.currentScene);
                            if (this.currentScene.anims.exists('walk-right')) {
                                this.player.anims.play('walk-right', true);
                            }
                        }
                    }
                    this.player.setOffset(offsetX, CONFIG.TILE_SIZE * 0.22);
                }
                // No flip needed - walk-right uses dedicated frames (row 1)
            } else {
                this.player.setVelocityX(0);
                if (isOnGround) {
                    this.player.anims.play('idle', true);
                    this.player.setOffset(offsetX, CONFIG.TILE_SIZE * 0.12);
                }
            }
            // Jumping
            if ((this.cursors.up.isDown || this.spaceKey.isDown) && isOnGround) {
                this.player.setVelocityY(CONFIG.JUMP_FORCE);
                this.player.anims.play('jump', true);
            }

            // Play jump animation while in air
            if (!isOnGround && !this.player.anims.isPlaying) {
                this.player.anims.play('jump', true);
            }

            // Check if player fell off the map (simple floor - use game height)
            const killZone = CONFIG.GAME_HEIGHT + 200; // Kill zone 200px below game bottom
                if (this.player.y > killZone) {
                console.warn(`Game: Player fell off map at y=${this.player.y}`);
                    this.loseLife();
                }
                
                // Also check if player is below visible level (safety check)
            if (this.player.y > CONFIG.GAME_HEIGHT + 50) {
                    // Reset player position to safe position above ground
                const spawnY = CONFIG.GAME_HEIGHT - CONFIG.TILE_SIZE * 2; // Above floor
                    this.player.setPosition(this.player.x, spawnY);
                    this.player.setVelocityY(0);
            }

            // Check for enemies falling off map (simple floor - use game height)
            if (this.enemies) {
                const actualLevelBottom = CONFIG.GAME_HEIGHT; // Floor is at game height
                    
                    this.enemies.children.entries.forEach(cat => {
                        if (!cat || !cat.active || cat.getData('state') === 'dead') return;
                        
                        // Safety check: if enemy falls too far, reset or destroy
                        if (cat.y > actualLevelBottom + 200) {
                            console.warn(`Game: Enemy fell off map at y=${cat.y}, destroying`);
                            cat.destroy();
                            return;
                        } else if (cat.y > actualLevelBottom + 50) {
                            // Reset to safe position above ground
                            cat.y = actualLevelBottom - CONFIG.TILE_SIZE * 2;
                            cat.setVelocityY(0);
                        }
                    });
            }
            
            // Update cat enemies
            if (this.enemies) {
                this.enemies.children.entries.forEach(cat => {
                    if (!cat || !cat.active || cat.getData('state') === 'dead') return;
                    
                    const state = cat.getData('state') || 'walking';
                    const velocity = cat.body.velocity.x;
                    const direction = velocity > 0 ? 1 : (velocity < 0 ? -1 : 0);
                    
                    // Simple state management if not set
                    if (!cat.getData('state')) cat.setData('state', 'walking');
                    
                    // Update walking animation - use dedicated frames, no flipping needed
                    if (state === 'walking' && velocity !== 0) {
                        const animKey = velocity > 0 ? 'cat-walk-right' : 'cat-walk-left';
                        if (scene.anims.exists(animKey) && cat.anims.currentAnim?.key !== animKey) {
                            cat.anims.play(animKey, true);
                        }
                        // No setFlipX needed - we have dedicated walk-left frames (4-7)
                    } else if (state === 'walking' && velocity === 0) {
                        if (scene.anims.exists('cat-idle')) {
                            cat.anims.play('cat-idle', true);
                        }
                    }
                    
                    // Enhanced attack logic with cooldown and range checking
                    if (state === 'walking' && this.player && !cat.getData('isAttacking')) {
                        // Check attack cooldown
                        const attackCooldown = cat.getData('attackCooldown') || 0;
                        if (attackCooldown > 0) {
                            cat.setData('attackCooldown', attackCooldown - 1);
                        } else {
                            // Check if player is in attack range
                            const dist = Math.sqrt(Math.pow(cat.x - this.player.x, 2) + Math.pow(cat.y - this.player.y, 2));
                            const attackRange = 120; // Attack range in pixels
                            
                            // Check if player is in front of the cat (line of sight)
                            const catDirection = cat.getData('direction') || (velocity > 0 ? 1 : -1);
                            const toPlayerX = this.player.x - cat.x;
                            const isInFront = (catDirection > 0 && toPlayerX > 0) || (catDirection < 0 && toPlayerX < 0);
                            
                            if (dist < attackRange && isInFront && !this.player.getData('invulnerable')) {
                                // Start attack
                                cat.setData('state', 'attacking');
                                cat.setData('isAttacking', true);
                                cat.setVelocityX(0);
                                if (scene.anims.exists('cat-attack')) {
                                    cat.anims.play('cat-attack', true);
                                }
                                
                                // Set attack damage window (middle frames of attack animation)
                                cat.setData('attackDamageWindow', true);
                                
                                // Check for damage during attack animation
                                const attackCheck = this.currentScene.time.addEvent({
                                    delay: 200, // Check after 200ms (mid-attack)
                                    callback: () => {
                                        if (cat.active && cat.getData('state') === 'attacking') {
                                            const currentDist = Math.sqrt(Math.pow(cat.x - this.player.x, 2) + Math.pow(cat.y - this.player.y, 2));
                                            if (currentDist < attackRange && !this.player.getData('invulnerable')) {
                                                // Player is still in range - deal damage
                                                this.loseLife();
                                                // Make player briefly invulnerable
                                                this.player.setData('invulnerable', true);
                                                this.player.setTint(0xff0000);
                                                this.currentScene.time.delayedCall(1000, () => {
                                                    if (this.player && this.player.active) {
                                                        this.player.setData('invulnerable', false);
                                                        this.player.clearTint();
                                                    }
                                                });
                                            }
                                        }
                                    },
                                    loop: false
                                });
                                
                                // Handle attack completion
                                cat.once('animationcomplete', (animation) => {
                                    if (animation.key === 'cat-attack') {
                                        cat.setData('state', 'walking');
                                        cat.setData('isAttacking', false);
                                        cat.setData('attackDamageWindow', false);
                                        
                                        // Set attack cooldown (2 seconds at 60fps = 120 frames)
                                        cat.setData('attackCooldown', 120);
                                        
                                        // Resume movement - turn toward player if close, otherwise continue in direction
                                        const finalDist = Math.sqrt(Math.pow(cat.x - this.player.x, 2) + Math.pow(cat.y - this.player.y, 2));
                                        if (finalDist < 150) {
                                            // Turn toward player
                                            const toPlayer = this.player.x > cat.x ? 1 : -1;
                                            cat.setData('direction', toPlayer);
                                            // Velocity based on tile size: 1.25 tiles per second
                                            cat.setVelocityX(CONFIG.TILE_SIZE * 1.25 * toPlayer);
                                        } else {
                                            // Continue in original direction
                                            const dir = cat.getData('direction') || 1;
                                            // Velocity based on tile size: 1.25 tiles per second
                                            cat.setVelocityX(CONFIG.TILE_SIZE * 1.25 * dir);
                                        }
                                        
                                        // Clean up attack check event
                                        if (attackCheck) {
                                            attackCheck.remove();
                                        }
                                    }
                                });
                            }
                        }
                    }
                });
            }
        } catch (error) {
             // Only log once to avoid spamming console
             if (!this.hasLoggedUpdateError) {
                 console.error('CRITICAL ERROR in Game.update:', error);
                 this.hasLoggedUpdateError = true;
             }
        }
    }

    enemyHitWall(enemy: any, wall: any): void {
        // When cat hits a wall or platform edge (handled by bounce), update animation
        const velocity = enemy.body.velocity.x;
        const scene = enemy.scene;
        // Use dedicated frames, no flipping needed
        if (velocity > 0 && scene && scene.anims.exists('cat-walk-right')) {
            enemy.anims.play('cat-walk-right', true);
        } else if (velocity < 0 && scene && scene.anims.exists('cat-walk-left')) {
            enemy.anims.play('cat-walk-left', true);
        }
    }

    hitEnemy(player: any, enemy: any): void {
        // Skip if enemy is already dead or dying
        if (enemy.getData('state') === 'dead' || enemy.getData('state') === 'dying') {
            return;
        }
        
        // Precise collision detection
        // Check if player is falling AND is physically above the enemy
        const isFalling = player.body.velocity.y > 0;
        const isAbove = player.body.y + player.body.height * 0.5 < enemy.body.y;

        if (isFalling && isAbove) {
            // Player jumped on enemy - destroy immediately (no death animation in 4x4 grid)
            enemy.setData('state', 'dead');
            enemy.destroy();
            
            player.setVelocityY(-400); // Higher bounce
            this.score += 50;
            this.updateUI();
        } else {
            // Player hit enemy from side/below - check if enemy is attacking
            if (enemy.getData('state') === 'attacking') {
                // Enemy is attacking - player takes damage
                this.loseLife();
            } else {
                // Enemy is just walking - player takes damage but enemy also gets stunned
                this.loseLife();
                // Stun the cat briefly
                enemy.setData('state', 'idle');
                enemy.setVelocityX(0);
                if (this.currentScene && this.currentScene.anims.exists('cat-idle')) {
                    enemy.anims.play('cat-idle');
                }
                enemy.setData('attackCooldown', 60); // 1 second stun
                
                // Return to walking after stun
                if (this.currentScene) {
                    this.currentScene.time.delayedCall(1000, () => {
                        if (enemy.active && enemy.getData('state') === 'idle') {
                            const dir = enemy.getData('direction');
                            enemy.setData('state', 'walking');
                            // Velocity based on tile size: 1.25 tiles per second
                            enemy.setVelocityX(CONFIG.TILE_SIZE * 1.25 * dir);
                            const animKey = dir > 0 ? 'cat-walk-right' : 'cat-walk-left';
                            if (this.currentScene && this.currentScene.anims.exists(animKey)) {
                                enemy.anims.play(animKey);
                            }
                        }
                    });
                }
            }
        }
    }

    collectItem(player: any, item: any): void {
        item.disableBody(true, true);
        this.score += 10;
        this.updateUI();

        // Check win condition
        if (this.collectibles.countActive(true) === 0) {
            this.winGame();
        }
    }

    loseLife(): void {
        this.lives--;
        this.updateUI();

        if (this.lives <= 0) {
            this.gameOver();
        } else {
            // Reset player position with brief invincibility
            this.player.setPosition(100, 450);
            this.player.setTint(0xff0000);
            if (this.currentScene) {
                this.currentScene.time.delayedCall(1000, () => {
                    if (this.player) this.player.clearTint();
                });
            }
        }
    }

    gameOver(): void {
        if (this.currentScene) this.currentScene.physics.pause();
        this.showOverlay('GAME OVER', `Final Score: ${this.score}`, '#ff0000');
    }

    winGame(): void {
        if (this.currentScene) this.currentScene.physics.pause();
        this.showOverlay('YOU WIN!', `Final Score: ${this.score}`, '#4CAF50');
    }

    showOverlay(title: string, subtitle: string, color: string): void {
        const overlay = document.createElement('div');
        overlay.id = 'game-overlay';
        overlay.style.position = 'absolute';
        overlay.style.top = '50%';
        overlay.style.left = '50%';
        overlay.style.transform = 'translate(-50%, -50%)';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
        overlay.style.padding = '40px';
        overlay.style.borderRadius = '20px';
        overlay.style.textAlign = 'center';
        overlay.style.color = 'white';
        overlay.style.border = `4px solid ${color}`;
        overlay.style.zIndex = '1000';
        overlay.innerHTML = `
            <h1 style="font-size: 48px; color: ${color}; margin-bottom: 20px; font-family: 'Press Start 2P', monospace;">${title}</h1>
            <p style="font-size: 24px; margin-bottom: 30px;">${subtitle}</p>
            <button id="restart-btn" style="padding: 15px 30px; font-size: 20px; cursor: pointer; background: ${color}; border: none; color: white; border-radius: 5px;">Play Again</button>
        `;
        document.body.appendChild(overlay);

        document.getElementById('restart-btn').addEventListener('click', () => {
             document.body.removeChild(overlay);
             this.restartGame();
        });
    }

    restartGame(): void {
        if (this.game) {
            this.game.destroy(true);
        }
        // Remove overlay if exists (safety)
        const existingOverlay = document.getElementById('game-overlay');
        if (existingOverlay) existingOverlay.remove();
        
        document.getElementById('menu-screen').classList.remove('hidden');
        document.getElementById('game-screen').classList.add('hidden');
    }

    updateUI(): void {
        const scoreEl = document.getElementById('score');
        const livesEl = document.getElementById('lives');
        if (scoreEl) scoreEl.textContent = `Score: ${this.score}`;
        if (livesEl) livesEl.textContent = `Lives: ${this.lives}`;
    }

    toggleDebug(): void {
        this.debugMode = !this.debugMode;
        console.log(`Debug Mode: ${this.debugMode ? 'ON' : 'OFF'}`);
        
        // Toggle physics debug visualization
        if (this.currentScene && this.currentScene.physics) {
            this.currentScene.physics.world.drawDebug = this.debugMode;
            this.currentScene.physics.world.debugGraphic.clear();
        }
        
        // Toggle platform/hazard visibility (for debugging collision boxes)
        if (this.platforms) {
            this.platforms.children.iterate((child) => {
                if (child) child.setVisible(this.debugMode);
            });
        }
        if (this.hazards) {
            this.hazards.children.iterate((child) => {
                if (child) child.setVisible(this.debugMode);
            });
        }
    }

    destroy(): void {
        // Phase 5: Comprehensive asset cleanup to prevent memory leaks
        console.log('Game: Starting comprehensive cleanup...');
        
        // Phase 5: Log memory usage before cleanup (if available)
        if (performance && (performance as any).memory) {
            const memory = (performance as any).memory;
            console.log(`Game: Memory before cleanup - Used: ${(memory.usedJSHeapSize / 1048576).toFixed(2)}MB, Total: ${(memory.totalJSHeapSize / 1048576).toFixed(2)}MB`);
        }
        
        // Clean up background frame timer
        if (this.backgroundFrameTimer) {
            try {
                this.backgroundFrameTimer.destroy();
                this.backgroundFrameTimer = null;
            } catch (e) {
                console.warn('Game: Error destroying background frame timer:', e);
            }
        }
        
        // Clean up background sprites
        if (this.backgroundSprites && this.backgroundSprites.length > 0) {
            this.backgroundSprites.forEach(sprite => {
                if (sprite && sprite.active) {
                    try {
                        sprite.destroy();
                    } catch (e) {
                        console.warn('Game: Error destroying background sprite:', e);
                    }
                }
            });
            this.backgroundSprites = [];
        }
        
        // Clean up canvas layers
        if (this.backgroundCanvas) {
            try {
                this.backgroundCanvas.destroy();
                this.backgroundCanvas = null;
            } catch (e) {
                console.warn('Game: Error destroying background canvas:', e);
            }
        }
        
        if (this.foregroundCanvas) {
            try {
                this.foregroundCanvas.destroy();
                this.foregroundCanvas = null;
            } catch (e) {
                console.warn('Game: Error destroying foreground canvas:', e);
            }
        }
        
        // Clean up physics groups
        if (this.platforms) {
            try {
                this.platforms.clear(true, true);
                this.platforms = null;
            } catch (e) {
                console.warn('Game: Error clearing platforms:', e);
            }
        }
        
        if (this.enemies) {
            try {
                this.enemies.clear(true, true);
                this.enemies = null;
            } catch (e) {
                console.warn('Game: Error clearing enemies:', e);
            }
        }
        
        if (this.collectibles) {
            try {
                this.collectibles.clear(true, true);
                this.collectibles = null;
            } catch (e) {
                console.warn('Game: Error clearing collectibles:', e);
            }
        }
        
        if (this.hazards) {
            try {
                this.hazards.clear(true, true);
                this.hazards = null;
            } catch (e) {
                console.warn('Game: Error clearing hazards:', e);
            }
        }
        
        // Clean up player reference
        this.player = null;
        
        // Clean up current scene reference and scene-specific data
        if (this.currentScene) {
            // Clean up scene-specific lazy load functions
            if ((this.currentScene as any).loadBackgroundFrame) {
                delete (this.currentScene as any).loadBackgroundFrame;
            }
            if ((this.currentScene as any).backgroundFramesData) {
                delete (this.currentScene as any).backgroundFramesData;
            }
        }
        this.currentScene = null;
        
        // Destroy Phaser game instance (this will clean up all Phaser resources)
        if (this.game) {
            try {
            this.game.destroy(true);
                this.game = null;
            } catch (e) {
                console.warn('Game: Error destroying Phaser game:', e);
            }
        }
        
        // Phase 5: Log memory usage after cleanup (if available)
        if (performance && (performance as any).memory) {
            setTimeout(() => {
                const memory = (performance as any).memory;
                console.log(`Game: Memory after cleanup - Used: ${(memory.usedJSHeapSize / 1048576).toFixed(2)}MB, Total: ${(memory.totalJSHeapSize / 1048576).toFixed(2)}MB`);
            }, 100);
        }
        
        console.log('Game: Cleanup completed');
    }
}

// Pause button functionality - enhanced with scene pause/resume
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        const pauseBtn = document.getElementById('pause-btn');
        if (pauseBtn) {
            pauseBtn.addEventListener('click', () => {
                // Find game instance from CharacterManager
                const characterManager = (window as any).characterManager;
                if (characterManager && characterManager.currentGameInstance) {
                    const gameInstance = characterManager.currentGameInstance;
                    if (gameInstance && gameInstance.game && gameInstance.game.scene) {
                        const scenes = gameInstance.game.scene.scenes;
                        if (scenes && scenes.length > 0) {
                        const activeScene = scenes[0];
                            if (activeScene && activeScene.scene) {
                        if (activeScene.scene.isPaused()) {
                            // Resume game
                            activeScene.scene.resume();
                                    if (activeScene.physics) activeScene.physics.resume();
                            pauseBtn.textContent = 'Pause';
                            pauseBtn.classList.remove('paused');
                        } else {
                            // Pause game
                            activeScene.scene.pause();
                                    if (activeScene.physics) activeScene.physics.pause();
                            pauseBtn.textContent = 'Resume';
                            pauseBtn.classList.add('paused');
                                }
                            }
                        }
                    }
                }
            });
            
            // Also support ESC key for pause/resume
            document.addEventListener('keydown', (event) => {
                if (event.key === 'Escape' || event.key === 'Pause') {
                    // Only trigger if not typing in an input field
                    const target = event.target as HTMLElement;
                    if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
                        event.preventDefault();
                        pauseBtn.click();
                    }
                }
            });
        }
    });
}

// Note: Game is no longer exported to window here.
// It is instantiated in main.ts and injected into CharacterManager.
// Temporary window.Game assignment exists in main.ts for backward compatibility during refactoring.
