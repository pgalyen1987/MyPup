// Main game logic using Phaser.js

// Ensure Phaser is loaded before proceeding
if (typeof Phaser === 'undefined') {
    console.error('Phaser.js is not loaded! Please ensure the Phaser script is loaded before game.js');
    throw new Error('Phaser.js is required but not found. Check script loading order in index.html');
}

// Game class definition - will be exported to window.Game at end of file
class Game {
    constructor(spriteSheetUrl, initialLevelImage = null) {
        this.spriteSheetUrl = spriteSheetUrl;
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
                    debug: true // Enable physics debug - shows all hitboxes
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
            backgroundColor: '#00000000', // Transparent - we draw our own backgrounds
            transparent: true // Make canvas transparent
        };

        this.game = new Phaser.Game(this.config);
        this.player = null;
        this.cursors = null;
        this.platforms = null;
        this.enemies = null;
        this.collectibles = null;
        this.score = 0;
        this.lives = 3;
        this.levelData = null;
        this.levelGenerator = null;
        this.currentScene = null; // Store reference to active scene
    }

    preload(scene) {
        console.log('Game: Preload started');
        this.currentScene = scene;
        
        // Log the sprite URL length to verify we have data
        console.log('Game: Sprite sheet URL length:', this.spriteSheetUrl ? this.spriteSheetUrl.length : 'NULL');
        
        // Load custom sprite sheet as IMAGE first (for dynamic sizing in create)
        // We will create the spritesheet dynamically in create() to handle different image sizes
        scene.load.image('player', this.spriteSheetUrl);

        // Tilesheet loading removed - using AI-generated tiles only
        
        // Load cat enemy (fallback to static file)
        const catPath = 'assets/Cat.png';
        scene.load.image('catFallback', catPath);
        
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

    createPlatformDataURL() {
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

    create(scene) {
        try {
            console.log('Game: Create started', scene);
            this.currentScene = scene;

            // 1. Create Player FIRST (so it exists for colliders)
            // DYNAMIC SPRITESHEET CREATION
            // Check if we need to create the spritesheet from the base image
            if (!scene.textures.exists('playerSprite') && scene.textures.exists('player')) {
                const playerTexture = scene.textures.get('player');
                const sourceImage = playerTexture.source[0];
                
                // Assume 4x4 grid
                const frameWidth = Math.floor(sourceImage.width / 4);
                const frameHeight = Math.floor(sourceImage.height / 4);
                
                scene.textures.addSpriteSheet('playerSprite', sourceImage.image, {
                    frameWidth: frameWidth,
                    frameHeight: frameHeight
                });
            }

            // DYNAMIC CAT SPRITESHEET CREATION
            const catSource = window.catEnemySpriteSheet;
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
                   console.log(`Game: Successfully created dynamic cat spritesheet (4x4), frame size: ${frameWidth}x${frameHeight}`);
                   
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
            } else if (!scene.textures.exists('cat') && scene.textures.exists('catFallback')) {
                // Fallback to static image if no AI cat available
                const fallbackImg = scene.textures.get('catFallback').source[0].image;
                // Try to use tile size for fallback, but fallback image may have different dimensions
                const fallbackFrameWidth = Math.floor(fallbackImg.width / 4);
                const fallbackFrameHeight = Math.floor(fallbackImg.height / 4);
                scene.textures.addSpriteSheet('cat', fallbackImg, {
                    frameWidth: fallbackFrameWidth,
                    frameHeight: fallbackFrameHeight
                });
                console.log(`Game: Using fallback cat sprite with frame size: ${fallbackFrameWidth}x${fallbackFrameHeight}`);
            } else if (!scene.textures.exists('cat')) {
                console.error('Game: No cat texture available - neither AI-generated nor fallback cat found!');
                console.error('Game: Cats will not be visible. Check that cat spritesheet is being generated.');
                console.error('Game: catEnemySpriteSheet available:', !!catSource);
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

            // Ensure player is created
            if (!this.player) {
                this.player = scene.physics.add.sprite(100, 450, 'playerSprite');
                this.player.setBounce(0.2);
                this.player.setCollideWorldBounds(true);
                
                // Calculate scale to make player approx 1.5 tiles high
                // If frame is 256px, scale should be ~0.375
                // If frame matches tile size, scale should be 1.5
                const playerFrame = scene.textures.get('playerSprite').frames[0];
                const frameSize = playerFrame ? playerFrame.width : CONFIG.TILE_SIZE;
                // Target size is roughly 1.5x standard tile size
                const targetSize = CONFIG.TILE_SIZE * 1.5;
                const scale = targetSize / frameSize;
                
                console.log(`Game: Scaling player. Frame: ${frameSize}, Target: ${targetSize}, Scale: ${scale.toFixed(2)}`);
                this.player.setScale(scale);
                
                // Adjust body size to match visual
                // For a 256px frame scaled to 96px, body should be roughly smaller for better collisions
                // Normalized to the frame size
                if (this.player.body) {
                   // Hitbox refinement:
                   // 35% width for narrow character, 75% height to leave room for head/feet
                   const hitWidth = frameSize * 0.35; 
                   const hitHeight = frameSize * 0.75;
                   this.player.body.setSize(hitWidth, hitHeight);
                   
                   // Offset: center-x, and leave ~10% room at top for head, ~15% at bottom for feet/ground
                   // This prevents head clipping and helps with ground alignment
                   this.player.body.setOffset((frameSize - hitWidth) / 2, frameSize * 0.15);
                   
                    // Fix sliding: Add high drag
                    this.player.setDragX(2000); 
                    
                    // Save frame size for offset calculations in update()
                    this.player.frameSize = frameSize;
                }
                
                // Ensure player is rendered ON TOP of the level
                this.player.setDepth(100);
            }

            // 2. Generate Level (Default or AI)
            // Use pre-loaded level image if available
            console.log('Game: Creating Level 1...');
            this.createLevel1(scene);
            
            // Ensure camera and physics world limits
            scene.cameras.main.setBounds(0, 0, CONFIG.GAME_WIDTH, CONFIG.GAME_HEIGHT);
            scene.physics.world.setBounds(0, 0, CONFIG.GAME_WIDTH, CONFIG.GAME_HEIGHT, true, true, true, true);
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

    renderLevel(scene) {
        if (!this.levelData) {
            this.createDefaultLevel(scene);
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
             this.player.setScale(1.5);
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

    renderLayer(scene, layerData, isSolid) {
        const tileSize = CONFIG.TILE_SIZE;
        for (let row = 0; row < layerData.length; row++) {
            for (let col = 0; col < layerData[row].length; col++) {
                const tileIndex = layerData[row][col];
                if (tileIndex >= 0) {
                    const x = col * tileSize;
                    const y = row * tileSize;
                    
                    // Create tile visual using colored rectangle (tilesheet removed)
                    const tile = scene.add.rectangle(x, y, tileSize, tileSize, isSolid ? 0x8B4513 : 0x90EE90);
                    tile.setOrigin(0, 0);
                    tile.setDepth(isSolid ? 1 : 0); // Ground tiles on top
                    
                    // If solid, create collision box
                    if (isSolid) {
                        const platform = scene.add.rectangle(x, y, tileSize, tileSize, 0x8B4513);
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
                        platform.setDepth(1);
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

    createLevel1(scene) {
        console.log('Game: Creating Level 1 using Levels System...');
        
        let level = { csv: '' };
        if (typeof window !== 'undefined' && window.LEVELS && window.LEVELS.length > 0) {
            level = window.LEVELS[0];
        } else {
            console.warn('Levels not found. Using fallback.');
        }

        this.generateLevelFromCSV(scene, level.csv, this.initialLevelImage);
    }

    async generateLevelFromCSV(scene, csvData, preLoadedImage = null) {
        // Ensure animations are created before creating enemies that need them
        this.createAnimations(scene);
        
        // Clear existing groups
        if (this.platforms) this.platforms.clear(true, true);
        if (this.enemies) this.enemies.clear(true, true);
        if (this.collectibles) this.collectibles.clear(true, true);
        if (this.hazards) this.hazards.clear(true, true);
        
        // Clean up existing canvas layers
        if (this.backgroundCanvas) {
            this.backgroundCanvas.destroy();
        }
        if (this.foregroundCanvas) {
            this.foregroundCanvas.destroy();
        }
        
        // Clean up existing background sprites (for large levels that use sprites instead of canvas)
        if (this.backgroundSprites) {
            this.backgroundSprites.forEach(sprite => {
                if (sprite && sprite.active) {
                    sprite.destroy();
                }
            });
            this.backgroundSprites = [];
        }

        // Initialize groups
        this.platforms = scene.physics.add.staticGroup();
        this.hazards = scene.physics.add.staticGroup();
        this.enemies = scene.physics.add.group();
        this.collectibles = scene.physics.add.staticGroup();

        // Parse CSV to get dimensions first
        const rows = csvData.trim().split('\n');
        const tileSize = CONFIG.TILE_SIZE; 
        const levelHeight = rows.length * tileSize;
        // Calculate offset to align level to BOTTOM of screen if it's smaller than game height
        // For 8 rows (512px), yOffset will be 0 since level matches viewport exactly
        const yOffset = Math.max(0, CONFIG.GAME_HEIGHT - levelHeight);
        
        // The actual playable level height (where content exists)
        const actualLevelHeight = levelHeight;
        // The canvas/rendering height (includes padding if level is smaller than viewport)
        // For 8 rows (512px), canvasHeight equals levelHeight since yOffset is 0
        const canvasHeight = levelHeight + yOffset;
        
        console.log(`Game: Level Height: ${levelHeight}, Game Height: ${CONFIG.GAME_HEIGHT}, Y Offset: ${yOffset}`);
        console.log(`Game: Actual playable height: ${actualLevelHeight}, Canvas height: ${canvasHeight}`);

        // Parse dimensions first for canvas sizing
        const maxCols = Math.max(...rows.map(r => r.length));
        const actualWidth = maxCols * tileSize;
        // canvasHeight already calculated above
        
        // Validate dimensions (WebGL has maximum texture size limits)
        // Use a conservative limit - many systems have issues with textures > 2048
        // For very large levels, we'll skip RenderTexture and use direct sprites
        const MAX_SAFE_TEXTURE_SIZE = 2048;
        
        if (actualWidth <= 0 || canvasHeight <= 0) {
            console.error(`Game: Invalid canvas dimensions: ${actualWidth}x${canvasHeight}`);
            throw new Error(`Invalid level dimensions: ${actualWidth}x${canvasHeight}`);
        }
        
        // CRITICAL CHECK: Never create RenderTexture for levels larger than safe size
        // This prevents framebuffer errors that occur during Phaser's async initialization
        const useRenderTexture = actualWidth <= MAX_SAFE_TEXTURE_SIZE && canvasHeight <= MAX_SAFE_TEXTURE_SIZE;
        
        // Check for location background BEFORE creating canvases
        // ONLY location-based background (from IP address) is used - no other backgrounds
        const locationBg = window.locationBackground || localStorage.getItem('location_background');
        // Get frames array if available (version 5+)
        const locationBgFrames = window.locationBackgroundFrames || (() => {
            try {
                const framesStr = localStorage.getItem('location_background_frames');
                return framesStr ? JSON.parse(framesStr) : null;
            } catch (e) {
                return null;
            }
        })();
        const useFramesArray = locationBgFrames && locationBgFrames.length >= 4;
        const useForegroundCanvas = useRenderTexture && !locationBg && !useFramesArray; // Don't use foreground canvas if we have location background
        // ONLY create background canvas if we have a location-based background
        const useBackgroundCanvas = useRenderTexture && (locationBg || useFramesArray); // Only use background canvas for location-based background
        
        // Initialize canvas references to null (will use sprite rendering)
        this.backgroundCanvas = null;
        this.foregroundCanvas = null;
        
        // Only create RenderTexture for smaller levels
        // CRITICAL: Skip RenderTexture entirely for large levels to avoid framebuffer errors
        if (!useRenderTexture) {
            console.log(`Game: Level dimensions ${actualWidth}x${canvasHeight} exceed safe texture size ${MAX_SAFE_TEXTURE_SIZE}, skipping RenderTexture and using direct sprite rendering`);
            // Both are already null, so sprite rendering will be used
        } else {
            console.log(`Game: Creating canvas layers: ${actualWidth}x${canvasHeight}`);
            
            // Create background canvas layer ONLY for location-based background (from IP address)
            // NO other backgrounds are created - only location-based background
            if (useBackgroundCanvas && locationBg) {
                try {
                    // Check if dimensions are still valid before creating
                    if (actualWidth > MAX_SAFE_TEXTURE_SIZE || canvasHeight > MAX_SAFE_TEXTURE_SIZE) {
                        throw new Error(`Dimensions ${actualWidth}x${canvasHeight} exceed safe limit ${MAX_SAFE_TEXTURE_SIZE}`);
                    }
                    
                    this.backgroundCanvas = scene.add.renderTexture(0, 0, actualWidth, canvasHeight);
                    if (this.backgroundCanvas) {
                        this.backgroundCanvas.setDepth(-10); // Behind everything
                        this.backgroundCanvas.setVisible(true); // Ensure it's visible
                        this.backgroundCanvas.setAlpha(1.0); // Fully opaque
                    }
                } catch (error) {
                    console.error('Game: Failed to create background canvas:', error);
                    this.backgroundCanvas = null;
                    console.warn('Game: Falling back to direct sprite rendering for location background');
                }
            } else {
                // No location background - no background canvas needed
                this.backgroundCanvas = null;
            }
            
            // Create foreground canvas layer (platforms, ground, collectibles, enemies)
            // ONLY if we don't have a location background (location backgrounds need transparency)
            if (useForegroundCanvas) {
                try {
                    // Check if dimensions are still valid before creating
                    if (actualWidth > MAX_SAFE_TEXTURE_SIZE || canvasHeight > MAX_SAFE_TEXTURE_SIZE) {
                        throw new Error(`Dimensions ${actualWidth}x${canvasHeight} exceed safe limit ${MAX_SAFE_TEXTURE_SIZE}`);
                    }
                    
                    this.foregroundCanvas = scene.add.renderTexture(0, 0, actualWidth, canvasHeight);
                    if (this.foregroundCanvas) {
                        this.foregroundCanvas.setDepth(0); // In front of background
                        this.foregroundCanvas.setVisible(true); // Ensure it's visible
                        // Clear to ensure transparency - RenderTextures should be transparent by default
                        this.foregroundCanvas.clear();
                        // Set blend mode to ensure proper alpha blending
                        this.foregroundCanvas.setBlendMode(Phaser.BlendModes.NORMAL);
                    }
                } catch (error) {
                    console.error('Game: Failed to create foreground canvas:', error);
                    this.foregroundCanvas = null;
                    console.warn('Game: Falling back to direct sprite rendering');
                }
            } else {
                console.log('Game: Skipping foreground canvas - using sprites for transparency (location background mode)');
                this.foregroundCanvas = null;
            }
            
            // Double-check: if background canvas failed and we have location background, log warning
            // Background canvas is ONLY created for location-based backgrounds
            if (!this.backgroundCanvas && locationBg) {
                console.warn('Game: Background canvas creation failed for location background');
            }
        }
        
        // Draw location-based background (from IP address) on background layer
        // This is the PRIMARY background - it should always be visible
        // Note: locationBg was already declared at line 441, reuse it here
        
        if (locationBg || useFramesArray) {
            console.log('Game: Location-based background (from IP) found - will tile and animate');
            try {
                // Get weather metadata to determine animation style
                let weatherMeta = null;
                try {
                    const metaStr = localStorage.getItem('location_background_meta');
                    if (metaStr) {
                        weatherMeta = JSON.parse(metaStr);
                    }
                } catch (e) {
                    console.warn('Could not parse background metadata:', e);
                }
                
                // NEW APPROACH: Use frames array instead of spritesheet
                // Load each frame as a separate texture and cycle through them
                let frameWidth = 512; // Each frame is 512px wide (optimized from 1024)
                let actualBgHeight = 512; // Each frame is 512px tall
                let isAnimated = false;
                
                if (useFramesArray) {
                    // Version 5+: Use frames array - load each frame as separate texture
                    console.log('Game: Loading 4 background frames as separate textures...');
                    isAnimated = true;
                    
                    // Load each frame as a separate texture
                    for (let i = 0; i < locationBgFrames.length; i++) {
                        const frameKey = `bg_frame_${i}`;
                        if (!scene.textures.exists(frameKey)) {
                            scene.textures.addBase64(frameKey, locationBgFrames[i]);
                        }
                    }
                    
                    // Wait for all frames to load
                    await new Promise((resolve) => {
                        let attempts = 0;
                        const maxAttempts = 100;
                        const checkFrames = () => {
                            attempts++;
                            if (attempts > maxAttempts) {
                                console.warn('Timeout waiting for background frames');
                                resolve();
                                return;
                            }
                            let allLoaded = true;
                            for (let i = 0; i < locationBgFrames.length; i++) {
                                if (!scene.textures.exists(`bg_frame_${i}`)) {
                                    allLoaded = false;
                                    break;
                                }
                            }
                            if (allLoaded) {
                                // Get dimensions from first frame
                                const texture = scene.textures.get('bg_frame_0');
                                if (texture && texture.source && texture.source.length > 0) {
                                    const source = texture.source[0];
                                    if (source.width > 0 && source.height > 0) {
                                        frameWidth = source.width;
                                        actualBgHeight = source.height;
                                        console.log(`Game: Background frames loaded: ${frameWidth}x${actualBgHeight} each`);
                                    }
                                }
                                resolve();
                                return;
                            }
                            setTimeout(checkFrames, 50);
                        };
                        checkFrames();
                    });
                } else {
                    // Fallback: Use spritesheet (old version)
                    const bgKey = 'location_background_texture';
                    if (!scene.textures.exists(bgKey)) {
                        scene.textures.addBase64(bgKey, locationBg);
                    }
                    
                    // Wait for texture to be ready and get ACTUAL dimensions from Gemini
                    let actualBgWidth = 2048; // Default: 4 frames x 512px each
                    
                    await new Promise((resolve) => {
                        let attempts = 0;
                        const maxAttempts = 100;
                        const checkTexture = () => {
                            attempts++;
                            if (attempts > maxAttempts) {
                                console.warn('Timeout waiting for background texture');
                                resolve();
                                return;
                            }
                            // Use the bgKey constant defined in the outer scope
                            if (scene.textures.exists('location_background_texture')) {
                                const texture = scene.textures.get('location_background_texture');
                                if (texture && texture.source && texture.source.length > 0) {
                                    const source = texture.source[0];
                                    if (source.width > 0 && source.height > 0) {
                                        actualBgWidth = source.width;
                                        actualBgHeight = source.height;
                                        frameWidth = actualBgWidth >= 1800 && actualBgWidth <= 2200 ? actualBgWidth / 4 : actualBgWidth;
                                        isAnimated = actualBgWidth >= 1800 && actualBgWidth <= 2200;
                                        console.log(`Game: Background image dimensions from Gemini: ${actualBgWidth}x${actualBgHeight}`);
                                        resolve();
                                        return;
                                    }
                                }
                            }
                            setTimeout(checkTexture, 50);
                        };
                        checkTexture();
                    });
                }
                
                await new Promise((resolve) => {
                    let attempts = 0;
                    const maxAttempts = 100;
                    const checkTexture = () => {
                        attempts++;
                        if (attempts > maxAttempts) {
                            console.warn('Timeout waiting for background texture');
                            resolve();
                            return;
                        }
                        const textureKey = 'location_background_texture';
                        if (scene.textures.exists(textureKey)) {
                            const texture = scene.textures.get(textureKey);
                            if (texture && texture.source && texture.source.length > 0) {
                                const source = texture.source[0];
                                if (source.width > 0 && source.height > 0) {
                                    // Get ACTUAL dimensions from the image Gemini returned
                                    actualBgWidth = source.width;
                                    actualBgHeight = source.height;
                                    
                                    console.log(`Game: Background image dimensions from Gemini: ${actualBgWidth}x${actualBgHeight}`);
                                    
                                    // Check if it's a 4-frame spritesheet (should be 2048px wide: 4 frames x 512px each)
                                    // Allow some tolerance for slight variations
                                    if (actualBgWidth >= 1800 && actualBgWidth <= 2200 && actualBgHeight >= 450 && actualBgHeight <= 550) {
                                        // Likely a 4-frame spritesheet (4 x 512px = 2048px)
                                        frameWidth = actualBgWidth / 4;
                                        console.log(`Game: Location background appears to be 4-frame spritesheet: ${actualBgWidth}x${actualBgHeight} (each frame: ${frameWidth}x${actualBgHeight})`);
                                        
                                        if (actualBgWidth !== 2048 || actualBgHeight !== 512) {
                                            console.warn(`Game: Image is ${actualBgWidth}x${actualBgHeight}, expected 2048x512 for 4 frames (4 x 512x512). May not animate correctly.`);
                                        }
                                    } else if (actualBgWidth === 1024 && actualBgHeight === 1024) {
                                        // This is an old cached single frame - should have been regenerated
                                        frameWidth = actualBgWidth;
                                        console.error(`Game: ERROR - Found old cached background (1024x1024 single frame). This should have been regenerated!`);
                                        console.error(`Game: Please clear cache and regenerate background. Using as static frame for now.`);
                                    } else {
                                        // Too small or wrong size for 4 frames - treat as single frame
                                        frameWidth = actualBgWidth;
                                        console.warn(`Game: Location background is wrong size for 4-frame animation: ${actualBgWidth}x${actualBgHeight} (expected 2048x512 for 4 frames of 512x512 each)`);
                                        console.warn(`Game: Will use as single static frame instead of animated spritesheet`);
                                    }
                                    resolve();
                                    return;
                                }
                            }
                        }
                        setTimeout(checkTexture, 50);
                    };
                    checkTexture();
                });
                
                // Parse 4-frame spritesheet into a Phaser sprite sheet
                // Check if it's animated: should be 4 frames (2048px wide: 4 x 512px) or close to it
                // Note: isAnimated was already declared above, so just update it
                if (!useFramesArray) {
                    isAnimated = actualBgWidth >= 1800 && actualBgWidth <= 2200; // Allow some tolerance for 4 frames of 512px
                }
                
                if (isAnimated && !scene.textures.exists('bg_spritesheet')) {
                    console.log('Game: Creating sprite sheet from 4-frame animated background...');
                    const texture = scene.textures.get('location_background_texture');
                    if (texture && texture.source && texture.source.length > 0) {
                        const source = texture.source[0];
                        
                        // Wait for source image to be fully loaded
                        await new Promise((resolve) => {
                            if (source.image && source.image.complete) {
                                resolve();
                            } else if (source.image) {
                                source.image.onload = resolve;
                                source.image.onerror = resolve; // Continue even if error
                                setTimeout(resolve, 1000); // Timeout after 1 second
                            } else {
                                resolve();
                            }
                        });
                        
                        // Create sprite sheet with 4 frames horizontally
                        // Phaser expects frames arranged horizontally in a single row
                        // Our image should be 51200px wide with 4 frames of 12800px each
                        try {
                            // Verify the image dimensions match our expectations
                            console.log(`Game: Creating spritesheet from image ${source.image.width}x${source.image.height}`);
                            console.log(`Game: Expected dimensions: ${actualBgWidth}x${actualBgHeight}, frameWidth: ${frameWidth}`);
                            
                            if (source.image.width < 3800) {
                                console.error(`Game: Image too small for 4-frame animation! Got ${source.image.width}px, need at least 4096px (4 x 1024px)`);
                                console.error(`Game: This image appears to be a single frame, not a 4-frame spritesheet`);
                            }
                            
                            // Create the spritesheet - Phaser will extract frames horizontally
                            // For a 4096x1024 image with 4 frames of 1024x1024 each
                            // Phaser calculates: 4096 / 1024 = 4 frames
                            scene.textures.addSpriteSheet('bg_spritesheet', source.image, {
                                frameWidth: frameWidth,  // 1024px per frame
                                frameHeight: actualBgHeight  // 1024px
                            });
                            
                            // Phaser might create 5 frames (0-4) if there's any rounding, so we need to ensure only 4
                            const sheet = scene.textures.get('bg_spritesheet');
                            if (sheet) {
                                // Calculate expected frames: image width / frame width
                                const expectedFrames = Math.floor(source.image.width / frameWidth);
                                console.log(`Game: Image is ${source.image.width}x${source.image.height}, expected ${expectedFrames} frames of ${frameWidth}x${actualBgHeight}`);
                                
                                if (sheet.frameTotal > 4) {
                                    console.warn(`Game: Phaser created ${sheet.frameTotal} frames, but we only need 4. This is OK, we'll only use frames 0-3.`);
                                }
                            }
                            
                            // Verify the spritesheet was created correctly
                            const createdSheet = scene.textures.get('bg_spritesheet');
                            if (createdSheet) {
                                const frameCount = createdSheet.frameTotal || 0;
                                console.log(`Game: Created background sprite sheet successfully - ${frameCount} frames`);
                                console.log(`Game: Spritesheet details - frameWidth: ${frameWidth}, frameHeight: ${actualBgHeight}, total frames: ${frameCount}`);
                                
                                // Verify frames exist
                                for (let f = 0; f < 4; f++) {
                                    const frame = createdSheet.get(f);
                                    if (frame) {
                                        console.log(`Game: Frame ${f} exists: ${frame.width}x${frame.height}`);
                                    } else {
                                        console.error(`Game: ERROR - Frame ${f} does not exist!`);
                                    }
                                }
                                
                                if (frameCount !== 4) {
                                    console.warn(`Game: WARNING - Expected 4 frames but got ${frameCount}!`);
                                }
                            } else {
                                console.error('Game: Spritesheet creation returned null');
                            }
                        } catch (err) {
                            console.error('Game: Failed to create sprite sheet:', err);
                            console.error('Game: Error details:', err.message);
                        }
                    }
                }
                
                // Use frame width (single frame or one frame from spritesheet)
                // Background frames are 512x512, viewport is 512x512 - no scaling needed!
                // Display at 1:1 scale to match viewport exactly
                const bgTileWidth = frameWidth; // 512 pixels per frame
                const bgTileHeight = actualBgHeight; // 512 pixels tall per frame
                
                // Scale to fit the VIEWPORT (not canvas height) - viewport is always 512x512
                // This ensures background matches viewport size exactly
                const scaleY = CONFIG.GAME_HEIGHT / bgTileHeight; // Scale to fit viewport height (512px)
                const scaleX = scaleY; // Use uniform scaling to maintain aspect ratio
                
                // Calculate how many tiles we need (using scaled width)
                const scaledTileWidth = bgTileWidth * scaleX;
                const tilesNeeded = Math.ceil(actualWidth / scaledTileWidth);
                
                console.log(`Game: Tiling location-based background (from IP)`);
                console.log(`  - Actual image dimensions from Gemini: ${actualBgWidth}x${actualBgHeight}`);
                console.log(`  - Frame width: ${frameWidth}px, Height: ${actualBgHeight}px (each frame is ${frameWidth}x${actualBgHeight})`);
                console.log(`  - Viewport size: ${CONFIG.GAME_WIDTH}x${CONFIG.GAME_HEIGHT}px`);
                console.log(`  - Level width: ${actualWidth}px (${actualWidth/CONFIG.TILE_SIZE} tiles), Canvas height: ${canvasHeight}px`);
                console.log(`  - Tiles needed: ${tilesNeeded}, Scale X: ${scaleX.toFixed(2)}, Scale Y: ${scaleY.toFixed(2)} (scaled to viewport, not canvas)`);
                console.log(`  - Animated: ${isAnimated ? 'YES (4 frames)' : 'NO (single frame)'}`);
                console.log(`  - Background will be at depth: -10 (behind everything)`);
                
                // Determine animation speed based on weather
                let animSpeed = 8; // Default: 8 frames per second
                if (weatherMeta && weatherMeta.timeWeather) {
                    const weather = weatherMeta.timeWeather;
                    // Faster animation for active weather (rain, snow, wind)
                    if (weather.season === 'winter' || weather.timeOfDay === 'night') {
                        animSpeed = 6; // Slower for winter/night
                    } else if (weather.season === 'spring' || weather.season === 'summer') {
                        animSpeed = 10; // Faster for spring/summer (wind, grass)
                    }
                }
                
                // Create animation if we have 4 frames - wait for spritesheet to be ready
                if (isAnimated) {
                    // Wait for spritesheet to exist
                    let attempts = 0;
                    while (!scene.textures.exists('bg_spritesheet') && attempts < 50) {
                        await new Promise(resolve => setTimeout(resolve, 50));
                        attempts++;
                    }
                    
                    if (scene.textures.exists('bg_spritesheet')) {
                        // Verify spritesheet has frames before creating animation
                        const sheet = scene.textures.get('bg_spritesheet');
                        const frameCount = sheet ? (sheet.frameTotal || 0) : 0;
                        console.log(`Game: Spritesheet ready with ${frameCount} frames, creating animation...`);
                        
                        if (!scene.anims.exists('bg_animate')) {
                            try {
                                // Build animation frames manually to ensure they're valid
                                const sheet = scene.textures.get('bg_spritesheet');
                                if (!sheet) {
                                    throw new Error('Spritesheet does not exist');
                                }
                                
                                // Use Phaser's AnimationFrameConfig format
                                const animFrames = [];
                                for (let i = 0; i < 4; i++) {
                                    if (sheet.has(i)) {
                                        // Use the proper Phaser frame format
                                        animFrames.push({
                                            key: 'bg_spritesheet',
                                            frame: i
                                        });
                                        console.log(`Game: Added frame ${i} to animation`);
                                    } else {
                                        console.error(`Game: Frame ${i} missing from spritesheet!`);
                                    }
                                }
                                
                                if (animFrames.length !== 4) {
                                    throw new Error(`Expected 4 frames but only found ${animFrames.length}`);
                                }
                                
                                console.log(`Game: Built animation with ${animFrames.length} frames manually`);
                                
                                // Create the animation
                                const animConfig = {
                                    key: 'bg_animate',
                                    frames: animFrames,
                                    frameRate: animSpeed,
                                    repeat: -1 // Loop forever
                                };
                                
                                scene.anims.create(animConfig);
                                
                                // Verify animation was created and has valid frames
                                if (scene.anims.exists('bg_animate')) {
                                    const anim = scene.anims.get('bg_animate');
                                    console.log(`Game: ✓ Background animation created successfully (${animSpeed} fps, ${anim.frames.length} frames, key: 'bg_animate')`);
                                    
                                    // Verify each frame is valid
                                    anim.frames.forEach((frame, idx) => {
                                        if (frame && frame.frame) {
                                            console.log(`Game: Animation frame ${idx}: valid (frame index: ${frame.frame.index !== undefined ? frame.frame.index : frame.frame.name})`);
                                        } else {
                                            console.error(`Game: Animation frame ${idx} is invalid!`, frame);
                                        }
                                    });
                                } else {
                                    console.error('Game: Animation creation failed - animation does not exist!');
                                }
                            } catch (err) {
                                console.error('Game: Failed to create animation:', err);
                                console.error('Game: Error stack:', err.stack);
                            }
                        } else {
                            console.log('Game: Animation bg_animate already exists');
                        }
                    } else {
                        console.warn('Game: Spritesheet not ready after waiting, animation may not work');
                    }
                }
                
                // Draw location-based background (from IP address) on background canvas - TILE IT HORIZONTALLY
                // This background MUST stay visible at all times
                if (this.backgroundCanvas) {
                    // For animated backgrounds, we can't use canvas (need sprites for animation)
                    // So we'll use sprites even if canvas is available
                    console.log('Game: Using sprites for animated background (canvas cannot animate)');
                }
                
                // Always use sprites for animated backgrounds (or when canvas is not available)
                // Store references to ensure they persist and stay visible
                if (!this.backgroundSprites) {
                    this.backgroundSprites = [];
                }
                // Clear any existing background sprites
                this.backgroundSprites.forEach(sprite => {
                    if (sprite && sprite.active) {
                        sprite.destroy();
                    }
                });
                this.backgroundSprites = [];
                
                // Create background sprites - use frames array if available, otherwise fallback to spritesheet
                for (let i = 0; i < tilesNeeded; i++) {
                    const scaledTileWidth = bgTileWidth * scaleX;
                    const xPos = i * scaledTileWidth;
                    
                    let bgSprite;
                    if (useFramesArray) {
                        // Version 5+: Use frames array - create sprite with first frame, we'll cycle through them
                        bgSprite = scene.add.image(xPos, 0, 'bg_frame_0'); // Start with frame 0
                    bgSprite.setOrigin(0, 0);
                    // Background should be exactly viewport height (512px), not scaled to level height
                    bgSprite.setDisplaySize(bgTileWidth * scaleX, CONFIG.GAME_HEIGHT);
                        // Store animation data
                        bgSprite.setData('frameCount', 4);
                        bgSprite.setData('currentFrame', 0);
                        bgSprite.setData('lastFrameUpdate', Date.now());
                        bgSprite.setData('frameRate', 1000 / animSpeed);
                    } else if (isAnimated && scene.textures.exists('bg_spritesheet')) {
                        // Fallback: Use spritesheet (old version)
                        bgSprite = scene.add.sprite(xPos, 0, 'bg_spritesheet', 0);
                    bgSprite.setOrigin(0, 0);
                    // Background should be exactly viewport height (512px), not scaled to level height
                    bgSprite.setDisplaySize(bgTileWidth * scaleX, CONFIG.GAME_HEIGHT);
                        if (scene.anims.exists('bg_animate')) {
                            bgSprite.play('bg_animate');
                        }
                    } else {
                        // Static background
                        const bgKey = 'location_background_texture';
                        bgSprite = scene.add.image(xPos, 0, bgKey);
                    bgSprite.setOrigin(0, 0);
                    // Background should be exactly viewport height (512px), not scaled to level height
                    bgSprite.setDisplaySize(bgTileWidth * scaleX, CONFIG.GAME_HEIGHT);
                    }
                    
                    bgSprite.setDepth(-10);
                    bgSprite.setScrollFactor(1, 1);
                    bgSprite.setVisible(true);
                    bgSprite.setAlpha(1.0);
                    
                    this.backgroundSprites.push(bgSprite);
                }
                
                // Set up frame cycling timer if using frames array
                if (useFramesArray && this.backgroundSprites.length > 0) {
                    // Determine animation speed based on weather
                    let animSpeed = 8; // Default: 8 frames per second
                    if (weatherMeta && weatherMeta.timeWeather) {
                        const weather = weatherMeta.timeWeather;
                        if (weather.season === 'winter' || weather.timeOfDay === 'night') {
                            animSpeed = 6; // Slower for winter/night
                        } else if (weather.season === 'spring' || weather.season === 'summer') {
                            animSpeed = 10; // Faster for spring/summer
                        }
                    }
                    
                    // Calculate frame duration in milliseconds
                    const frameDuration = 1000 / animSpeed; // e.g., 8 fps = 125ms per frame
                    
                    // Create a timer to cycle through frames
                    this.backgroundFrameTimer = scene.time.addEvent({
                        delay: frameDuration,
                        callback: () => {
                            // Cycle to next frame for all background sprites
                            this.backgroundSprites.forEach(sprite => {
                                if (sprite && sprite.active) {
                                    const frameKeys = sprite.getData('frameKeys');
                                    if (frameKeys && frameKeys.length === 4) {
                                        let currentIndex = sprite.getData('frameIndex') || 0;
                                        currentIndex = (currentIndex + 1) % 4; // Cycle 0->1->2->3->0
                                        sprite.setTexture(frameKeys[currentIndex]);
                                        sprite.setData('frameIndex', currentIndex);
                                    }
                                }
                            });
                        },
                        loop: true
                    });
                    
                    console.log(`Game: Background frame cycling started (${animSpeed} fps, ${frameDuration.toFixed(0)}ms per frame)`);
                }
                
                // Verify animation is working
                if (isAnimated && this.backgroundSprites.length > 0) {
                    const firstSprite = this.backgroundSprites[0];
                    if (firstSprite && firstSprite.anims) {
                        const anim = firstSprite.anims.currentAnim;
                        if (anim) {
                            console.log(`Game: Background animation verified - ${anim.key} playing at ${anim.frameRate} fps, frame ${anim.currentFrame?.index || 'unknown'}`);
                        } else {
                            console.warn('Game: Background sprite created but animation not playing');
                        }
                    }
                }
                console.log(`Game: Location-based background (from IP) tiled as ${isAnimated ? 'animated' : 'static'} images (${tilesNeeded} horizontal tiles, depth: -10)`);
            } catch (error) {
                console.warn('Could not load location background:', error);
                // No fallback - leave background transparent/empty
                // Only location-based backgrounds are used
            }
        } else {
            // No location background available - leave completely transparent
            // ONLY location-based backgrounds (from IP address) are used - no defaults, no fallbacks
            console.log('Game: No location-based background available - leaving background completely transparent');
            // Destroy background canvas if it was created but we have no location background
            if (this.backgroundCanvas) {
                this.backgroundCanvas.destroy();
                this.backgroundCanvas = null;
            }
        }
        
        console.log(`Game: Background rendering setup complete: ${actualWidth}x${canvasHeight}`);
        
        // Set up camera and player early so background can scroll while tiles are loading
        // This allows the background to be visible and scrollable during tile generation
        if (!this.player && scene.textures.exists('playerSprite')) {
            // Create player at a default position (will be moved to spawn point later)
            this.player = scene.physics.add.sprite(100, 450, 'playerSprite');
            this.player.setBounce(0.2);
            this.player.setCollideWorldBounds(true);
            this.player.setScale(0.38); // Match the scale from preload
            this.player.setDepth(100);
            
            // Set up camera bounds and follow player immediately
            // This enables background scrolling while tiles are being generated
            // Use canvasHeight for initial bounds (will be updated later with actual level height)
            scene.physics.world.setBounds(0, 0, actualWidth, canvasHeight, true, true, true, true);
            scene.cameras.main.setBounds(0, 0, actualWidth, canvasHeight);
            scene.cameras.main.startFollow(this.player, true, 0.1, 0.1);
            scene.cameras.main.setDeadzone(0, 0);
            console.log(`Game: Camera and player set up - initial bounds: ${actualWidth}x${canvasHeight}, background can scroll while tiles load`);
        } else if (!this.player) {
            console.warn('Game: Player sprite not ready yet, camera setup will happen after player creation');
        }
        
        // 2. Load AI-generated tiles if available, otherwise use fallback
        // Store tiles availability for later use
        let aiTilesAvailable = false;
        
        const loadTiles = async () => {
            try {
                // Check for cached tiles using AssetStorage or fallback to localStorage
                let tiles = null;
                try {
                    if (window.assetStorage) {
                        const cachedTilesStr = await window.assetStorage.getItem('level_tiles_v1');
                        if (cachedTilesStr) {
                            console.log('Using cached AI-generated tiles (IndexedDB)');
                            tiles = JSON.parse(cachedTilesStr);
                        }
                    }
                    
                    if (!tiles) {
                        const cachedTiles = localStorage.getItem('level_tiles_v1');
                        if (cachedTiles) {
                            console.log('Using cached AI-generated tiles (localStorage)');
                            tiles = JSON.parse(cachedTiles);
                        }
                    }
                } catch (storageError) {
                    console.warn('Could not read from storage:', storageError);
                }
                
                // Generate new tiles if not cached
                if (!tiles && window.api && window.api.apiKey) {
                    console.log('Generating AI tiles from Gemini...');
                    const currentLevel = window.LEVELS ? window.LEVELS[0] : { theme: 'Sunny Meadow' };
                    tiles = await window.api.generateLevelTiles(currentLevel.theme);
                    
                    // Clear old cache and save new tiles
                    // Save tiles to storage
                    try {
                        if (window.assetStorage) {
                            await window.assetStorage.setItem('level_tiles_v1', JSON.stringify(tiles));
                            localStorage.setItem('has_level_tiles', 'true');
                        } else {
                            localStorage.setItem('level_tiles_v1', JSON.stringify(tiles));
                        }
                    } catch (storageError) {
                        console.warn('Could not cache tiles in storage:', storageError);
                    }
                }
                
                // Load tiles as Phaser textures if available
                if (tiles) {
                    // Helper function to add base64 texture and wait for it to load
                    const addTexture = (key, base64Data) => {
                        return new Promise((resolve, reject) => {
                            try {
                                // Check if base64 data is valid
                                if (!base64Data || typeof base64Data !== 'string') {
                                    console.warn(`Invalid base64 data for ${key}:`, typeof base64Data);
                                    reject(new Error(`Invalid base64 data for ${key}`));
                                    return;
                                }
                                
                                // Ensure it starts with data:image
                                if (!base64Data.startsWith('data:image')) {
                                    console.warn(`Base64 data for ${key} doesn't start with data:image, prefix:`, base64Data.substring(0, 20));
                                    // Try to fix it - assume it's PNG
                                    if (base64Data.startsWith('data:')) {
                                        // Already has data: prefix, might be missing image/ part
                                        console.log('Base64 already has data: prefix');
                                    } else {
                                        // Add data:image/png;base64, prefix
                                        base64Data = 'data:image/png;base64,' + base64Data;
                                        console.log(`Fixed base64 prefix for ${key}`);
                                    }
                                }
                                
                                console.log(`Adding texture ${key}, data length: ${base64Data.length}`);
                                
                                // Add texture using addBase64
                                try {
                                    scene.textures.addBase64(key, base64Data);
                                } catch (addError) {
                                    console.error(`Error calling addBase64 for ${key}:`, addError);
                                    reject(addError);
                                    return;
                                }
                                
                                // Wait for texture to be ready with timeout
                                let attempts = 0;
                                const maxAttempts = 100; // 5 seconds max wait
                                
                                const checkTexture = () => {
                                    attempts++;
                                    if (attempts > maxAttempts) {
                                        console.error(`Timeout waiting for texture ${key} to load`);
                                        reject(new Error(`Timeout loading texture ${key}`));
                                        return;
                                    }
                                    
                                    if (scene.textures.exists(key)) {
                                        const texture = scene.textures.get(key);
                                        if (texture && texture.source && texture.source.length > 0) {
                                            const source = texture.source[0];
                                            if (source.width > 0 && source.height > 0) {
                                                console.log(`✓ Texture ${key} loaded: ${source.width}x${source.height}`);
                                                resolve(true);
                                                return;
                                            }
                                        }
                                    }
                                    
                                    // Retry after a short delay
                                    setTimeout(checkTexture, 50);
                                };
                                
                                // Start checking after a brief delay
                                setTimeout(checkTexture, 100);
                            } catch (error) {
                                console.error(`Error adding texture ${key}:`, error);
                                reject(error);
                            }
                        });
                    };
                    
                    // Load all textures and wait for them
                    const texturePromises = [];
                    
                    // Ground tiles removed - using background image as ground visual
                    // No need to load tile_ground texture
                    
                    // Helper to re-verify background after each texture is added
                    const reVerifyBackground = () => {
                        const bgKey = 'location_background_texture';
                        if (this.backgroundSprites && this.backgroundSprites.length > 0) {
                            this.backgroundSprites.forEach((sprite) => {
                                if (sprite && sprite.active) {
                                    sprite.setVisible(true);
                                    sprite.setDepth(-10);
                                    sprite.setAlpha(1.0);
                                }
                            });
                        }
                        if (this.backgroundCanvas) {
                            this.backgroundCanvas.setVisible(true);
                            this.backgroundCanvas.setDepth(-10);
                            this.backgroundCanvas.setAlpha(1.0);
                        }
                    };
                    
                    if (tiles.platform) {
                        texturePromises.push(addTexture('tile_platform', tiles.platform).then(() => {
                            aiTilesAvailable = true;
                            console.log('✓ AI platform tile ready');
                            reVerifyBackground(); // Re-verify background after each texture
                        }).catch(err => console.warn('Failed to load platform tile:', err)));
                    }
                    
                    if (tiles.treat) {
                        texturePromises.push(addTexture('tile_treat', tiles.treat).then(() => {
                            aiTilesAvailable = true;
                            console.log('✓ AI treat tile ready');
                            reVerifyBackground(); // Re-verify background after each texture
                        }).catch(err => console.warn('Failed to load treat tile:', err)));
                    }
                    
                    if (tiles.bone) {
                        texturePromises.push(addTexture('tile_bone', tiles.bone).then(() => {
                            aiTilesAvailable = true;
                            console.log('✓ AI bone tile ready');
                            reVerifyBackground(); // Re-verify background after each texture
                        }).catch(err => console.warn('Failed to load bone tile:', err)));
                    }
                    
                    // Wait for all textures to load
                    await Promise.all(texturePromises);
                    console.log(`AI tiles loaded: ${aiTilesAvailable ? 'YES' : 'NO'}`);
                }
                
                // Store availability for CSV parsing
                this.aiTilesAvailable = aiTilesAvailable;
                console.log(`this.aiTilesAvailable set to: ${this.aiTilesAvailable}`);
            } catch (error) {
                console.warn('Could not load AI tiles:', error);
                this.aiTilesAvailable = false;
            }
        };
        
        // Wait for tiles to load before parsing CSV
        await loadTiles();
        
        // CRITICAL: After tile textures are loaded, re-verify background sprites are still visible
        // Phaser's addBase64 can trigger scene refreshes that might affect existing sprites
        // This happens RIGHT AFTER tile POST calls return, which is when the background disappears
        const bgKey = 'location_background_texture';
        const frame0Key = 'bg_frame_0';
        
        const bgExists = scene.textures.exists(bgKey) || scene.textures.exists(frame0Key);
        
        if (bgExists) {
            console.log('Game: Background texture (or frame 0) still exists after tile loading ✓');
        } else {
            console.error('Game: ERROR - Background texture was removed/overwritten during tile loading!');
            // Re-run updateBackground to restore visuals
            console.log('Game: Triggering background restoration...');
            this.updateBackground();
        }
        
        if (this.backgroundSprites && this.backgroundSprites.length > 0) {
            console.log('Game: Re-verifying background sprites after tile texture loading...');
            let activeCount = 0;
            this.backgroundSprites.forEach((sprite, index) => {
                if (sprite && sprite.active) {
                    sprite.setVisible(true);
                    sprite.setDepth(-10);
                    sprite.setAlpha(1.0);
                    sprite.setScrollFactor(1, 1);
                    
                    // Critical: if sprite lost its texture reference during Phaser texture changes, reset it
                    if (!sprite.texture || (sprite.texture.key !== bgKey && !sprite.texture.key.startsWith('bg_frame_'))) {
                        const targetKey = useFramesArray ? 'bg_frame_0' : bgKey;
                        console.warn(`Game: Restoring texture for background sprite ${index} to ${targetKey}`);
                        if (scene.textures.exists(targetKey)) {
                            sprite.setTexture(targetKey);
                        }
                    }
                    activeCount++;
                }
            });
            console.log(`Game: Background sprites re-verified after tile loading (${activeCount}/${this.backgroundSprites.length} active)`);
        }
        
        // Also re-verify background canvas if it exists
        if (this.backgroundCanvas) {
            this.backgroundCanvas.setVisible(true);
            this.backgroundCanvas.setDepth(-10);
            this.backgroundCanvas.setAlpha(1.0);
            console.log('Game: Background canvas re-verified after tile loading');
        }
        
        // Debug: Check what textures are available
        console.log('Available textures after loading:', {
            'tile_platform': scene.textures.exists('tile_platform'),
            'tile_treat': scene.textures.exists('tile_treat'),
            'tile_bone': scene.textures.exists('tile_bone'),
            'aiTilesAvailable': this.aiTilesAvailable
        });

        // 2. Parse CSV and create physics objects, drawing visuals to canvas layers
        rows.forEach((row, rowIndex) => {
            const cells = row.split('');
            
            cells.forEach((cell, colIndex) => {
                const x = colIndex * tileSize;
                const y = (rowIndex * tileSize) + yOffset;
                const centerX = x + (tileSize / 2);
                const centerY = y + (tileSize / 2);

                switch (cell) {
                    case 'P': // Platform
                        let p;
                        {
                            p = scene.add.rectangle(centerX, centerY, CONFIG.TILE_SIZE, CONFIG.TILE_SIZE, 0x8B4513);
                            scene.physics.add.existing(p, true);
                            this.platforms.add(p);
                        }
                        // Default origin is 0.5, so it stays centered at centerX, centerY
                        p.setVisible(false);
                        
                        // Draw visual on foreground canvas
                        if (this.foregroundCanvas) {
                            if (this.aiTilesAvailable && scene.textures.exists('tile_platform')) {
                                const tempImg = scene.add.image(0, 0, 'tile_platform');
                                tempImg.setOrigin(0.5, 0.5);
                                // CRITICAL: Scale down from 1024x1024 to tile size pixels
                                tempImg.setDisplaySize(CONFIG.TILE_SIZE, CONFIG.TILE_SIZE);
                                this.foregroundCanvas.draw(tempImg, centerX, centerY);
                                tempImg.destroy();
                            } else {
                                // Use colored rectangle for platform visual
                                const tempRect = scene.add.rectangle(0, 0, CONFIG.TILE_SIZE, CONFIG.TILE_SIZE, 0x8B4513);
                                tempRect.setOrigin(0.5, 0.5);
                                this.foregroundCanvas.draw(tempRect, centerX, centerY);
                                tempRect.destroy();
                            }
                        } else {
                            // Fallback: create visible sprite
                            if (this.aiTilesAvailable && scene.textures.exists('tile_platform')) {
                                const visual = scene.add.image(centerX, centerY, 'tile_platform');
                                // CRITICAL: Scale down from 1024x1024 to tile size pixels
                                visual.setDisplaySize(CONFIG.TILE_SIZE, CONFIG.TILE_SIZE);
                                visual.setDepth(0);
                            } else {
                                // Use colored rectangle for platform visual
                                const visual = scene.add.rectangle(centerX, centerY, CONFIG.TILE_SIZE, CONFIG.TILE_SIZE, 0x8B4513);
                                visual.setDepth(0);
                            }
                        }
                        break;
                    case 'W': // Water (Hazard)
                        let w;
                        {
                            w = scene.add.rectangle(centerX, centerY, CONFIG.TILE_SIZE, CONFIG.TILE_SIZE, 0x1E90FF);
                            scene.physics.add.existing(w, true);
                            this.hazards.add(w);
                        }
                        // Default origin is 0.5
                        w.setVisible(false);
                        
                        // Draw water visual on foreground canvas
                        if (this.foregroundCanvas) {
                            if (this.aiTilesAvailable && scene.textures.exists('tile_platform')) {
                                const tempImg = scene.add.image(0, 0, 'tile_platform');
                                tempImg.setDisplaySize(CONFIG.TILE_SIZE, CONFIG.TILE_SIZE);
                                tempImg.setOrigin(0.5, 0.5);
                                this.foregroundCanvas.draw(tempImg, centerX, centerY);
                                tempImg.destroy();
                            } else {
                                const tempRect = scene.add.rectangle(0, 0, CONFIG.TILE_SIZE, CONFIG.TILE_SIZE, 0x1E90FF);
                                tempRect.setOrigin(0.5, 0.5);
                                this.foregroundCanvas.draw(tempRect, centerX, centerY);
                                tempRect.destroy();
                            }
                        } else {
                            // Create visible sprite (when foregroundCanvas is disabled for location backgrounds)
                            if (this.aiTilesAvailable && scene.textures.exists('tile_platform')) {
                                const visual = scene.add.image(centerX, centerY, 'tile_platform');
                                visual.setDisplaySize(CONFIG.TILE_SIZE, CONFIG.TILE_SIZE);
                                visual.setDepth(0);
                                visual.setScrollFactor(1, 1);
                            } else {
                                const visual = scene.add.rectangle(centerX, centerY, CONFIG.TILE_SIZE, CONFIG.TILE_SIZE, 0x1E90FF);
                                visual.setDepth(0); // In front of background (depth -10)
                                visual.setScrollFactor(1, 1);
                            }
                        }
                        break;
                    case 'C': // Cat Enemy
                        // Check if cat texture exists before creating enemy
                        if (!scene.textures.exists('cat')) {
                            console.warn(`Game: Cannot create cat enemy at (${x}, ${y}) - 'cat' texture not found`);
                            break;
                        }
                        const enemy = this.enemies.create(x + (CONFIG.TILE_SIZE / 2), y, 'cat', 0);
                        if (!enemy) {
                            console.error(`Game: Failed to create cat enemy at (${x}, ${y})`);
                            break;
                        }
                        // No scaling needed - cat sprite sheet uses universal tile size (64x64 per frame)
                        enemy.setBounce(0.2);
                        enemy.setCollideWorldBounds(true);
                        enemy.setDepth(1); // Above background (depth -10) and tiles (depth 0)
                        enemy.setVisible(true); // Ensure cat is visible
                        enemy.setAlpha(1.0); // Ensure fully opaque
                        const dir = Math.random() > 0.5 ? 1 : -1;
                        // Velocity based on tile size: 1.25 tiles per second (80px/s at 64px tiles)
                        enemy.setVelocityX(CONFIG.TILE_SIZE * 1.25 * dir);
                        enemy.setData('direction', dir);
                        enemy.setData('state', 'walking'); // walking, attacking, dying, dead
                        enemy.setData('attackCooldown', 0);
                        enemy.setData('isAttacking', false);
                        enemy.setData('attackDamageWindow', false);
                        enemy.setData('lastWallCheck', 0);
                        // Set collision box using universal tile size
                        // Cat sprite is 64x64, use 75% for collision box (48px) with 12.5% offset (8px)
                        enemy.body.setSize(CONFIG.TILE_SIZE * 0.75, CONFIG.TILE_SIZE * 0.75);
                        enemy.body.setOffset(CONFIG.TILE_SIZE * 0.125, CONFIG.TILE_SIZE * 0.125);
                        // Only play animation if it exists and sprite sheet is ready
                        const animKey = dir > 0 ? 'cat-walk-right' : 'cat-walk-left';
                        if (scene.anims.exists(animKey) && scene.textures.exists('cat')) {
                            enemy.anims.play(animKey);
                        } else {
                            console.warn(`Game: Cat animation '${animKey}' not available, cat may not animate`);
                        }
                        console.log(`Game: Created cat enemy at (${x + (CONFIG.TILE_SIZE / 2)}, ${y}), texture exists: ${scene.textures.exists('cat')}`);
                        break;
                    case 'O': // Treat
                        // Physics body for collectible
                        let treat;
                        if (this.aiTilesAvailable && scene.textures.exists('tile_treat')) {
                            treat = this.collectibles.create(centerX, centerY, 'tile_treat');
                            treat.setData('type', 'treat');
                            // CRITICAL: Scale down from 1024x1024 to tile size pixels
                            treat.setDisplaySize(CONFIG.TILE_SIZE, CONFIG.TILE_SIZE);
                            treat.setOrigin(0.5, 0.5);
                            treat.setDepth(1); // Above background (depth -10) and tiles (depth 0)
                        } else {
                            // Use colored rectangle for treat visual
                            treat = scene.add.rectangle(centerX, centerY, 24, 24, 0xFFD700);
                            scene.physics.add.existing(treat, true);
                            this.collectibles.add(treat);
                            treat.setData('type', 'treat');
                            treat.setScale(0.5);
                            treat.setDepth(1); // Above background (depth -10) and tiles (depth 0)
                        }
                        break;
                    case 'B': // Bone
                        // Physics body for collectible (needs to be interactive)
                        let bone;
                        if (this.aiTilesAvailable && scene.textures.exists('tile_bone')) {
                            bone = this.collectibles.create(centerX, centerY, 'tile_bone');
                            bone.setData('type', 'bone');
                            // CRITICAL: Scale down from 1024x1024 to tile size pixels
                            bone.setDisplaySize(CONFIG.TILE_SIZE, CONFIG.TILE_SIZE);
                            bone.setOrigin(0.5, 0.5);
                            bone.setDepth(1); // Above background (depth -10) and tiles (depth 0)
                        } else {
                            // Use colored rectangle for bone visual
                            bone = scene.add.rectangle(centerX, centerY, 24, 12, 0xFFFFFF);
                            scene.physics.add.existing(bone, true);
                            this.collectibles.add(bone);
                            bone.setData('type', 'bone');
                            bone.setDepth(1); // Above background (depth -10) and tiles (depth 0)
                        }
                        break;
                    case '@': // Spawn
                        if (this.player) this.player.setPosition(x + (CONFIG.TILE_SIZE / 2), y + (CONFIG.TILE_SIZE / 2));
                        break;
                    case '.': // Empty space - transparent, background shows through
                    case ' ': // Space - also transparent
                        // Explicitly do nothing - background will show through
                        // No physics body, no visual rendering
                        break;
                }
            });
        });

        // CRITICAL: Ensure location-based background (from IP address) stays visible after all tiles are drawn
        // This is the PRIMARY background and must always be visible
        if (this.backgroundCanvas) {
            // Re-verify the location-based tiled background is still visible and at correct depth
            this.backgroundCanvas.setVisible(true);
            this.backgroundCanvas.setDepth(-10); // Must be behind all tiles
            this.backgroundCanvas.setAlpha(1.0);
            // Ensure background is behind foreground if foreground exists
            if (this.foregroundCanvas) {
                this.foregroundCanvas.setDepth(0);
                this.backgroundCanvas.setDepth(-10);
            }
            console.log('Game: Location-based background (from IP) canvas visibility confirmed after tile rendering (depth: -10)');
        }
        
        // CRITICAL: Re-verify background image sprites visibility after tiles load
        // This ensures the location-based background stays visible
        if (this.backgroundSprites && this.backgroundSprites.length > 0) {
            let activeCount = 0;
            this.backgroundSprites.forEach((sprite, index) => {
                if (sprite && sprite.active) {
                    sprite.setVisible(true);
                    sprite.setDepth(-10); // Must be behind all tiles (depth 0) and collectibles/enemies (depth 1)
                    sprite.setAlpha(1.0);
                    activeCount++;
                } else {
                    console.warn(`Game: Background sprite ${index} is not active`);
                }
            });
            console.log(`Game: Location-based background (from IP) sprites visibility confirmed (${activeCount}/${this.backgroundSprites.length} active, depth: -10)`);
            
            // Debug: Check if any sprites are covering the background
            if (activeCount < this.backgroundSprites.length) {
                console.warn(`Game: WARNING - Some background sprites are not active!`);
            }
        }
        
        // Debug: Verify depth ordering
        console.log('Game: Depth ordering - Background: -10, Tiles: 0, Collectibles/Enemies: 1, Player: 100');
        
        // Final verification: Ensure background texture still exists and sprites are still valid
        const finalBgKey = 'location_background_texture';
        if (scene.textures.exists(finalBgKey)) {
            console.log('Game: ✓ Background texture confirmed present after all rendering');
        } else {
            console.error('Game: ✗ ERROR - Background texture missing after all rendering!');
        }
        
        if (this.backgroundSprites && this.backgroundSprites.length > 0) {
            const finalActiveCount = this.backgroundSprites.filter(s => s && s.active && s.visible).length;
            console.log(`Game: ✓ Background sprites final check: ${finalActiveCount}/${this.backgroundSprites.length} active and visible`);
        }
        
        // Debug: Log canvas states
        if (this.backgroundCanvas && this.foregroundCanvas) {
            console.log('Game: Canvas depths - Background:', this.backgroundCanvas.depth, 'Foreground:', this.foregroundCanvas.depth);
            console.log('Game: Canvas visibility - Background:', this.backgroundCanvas.visible, 'Foreground:', this.foregroundCanvas.visible);
        }
        
        // Update World Bounds and Camera based on final level size (camera was already set up earlier for scrolling)
        // The ground platform should be at the bottom of the last row of content
        // Last row is at index (rows.length - 1), positioned at: (rows.length - 1) * tileSize + yOffset
        // The bottom edge of the last row is at: rows.length * tileSize + yOffset
        // Ground platform center should be at: rows.length * tileSize + yOffset - tileSize/2
        const lastRowIndex = rows.length - 1;
        const lastRowY = lastRowIndex * tileSize + yOffset;
        const lastRowBottom = rows.length * tileSize + yOffset;
        const groundY = lastRowBottom - CONFIG.TILE_SIZE / 2;
        
        // World bounds should match the actual level content area
        // For 8 rows (512px), level matches viewport exactly, so worldBoundsHeight = CONFIG.GAME_HEIGHT
        // For levels taller than viewport, use level height. For smaller levels, use viewport height.
        const worldBoundsHeight = Math.max(actualLevelHeight + yOffset, CONFIG.GAME_HEIGHT);
        
        console.log(`Game: Level size: ${actualWidth}x${actualLevelHeight}, Canvas: ${actualWidth}x${canvasHeight}`);
        console.log(`Game: Last row (index ${lastRowIndex}) at y=${lastRowY}, bottom at y=${lastRowBottom}`);
        console.log(`Game: Ground platform at y=${groundY}, World bounds height: ${worldBoundsHeight}`);
        
        // Set world bounds with collision enabled on all sides
        // Use worldBoundsHeight to ensure camera can't go below visible area
        scene.physics.world.setBounds(0, 0, actualWidth, worldBoundsHeight, true, true, true, true);
        scene.cameras.main.setBounds(0, 0, actualWidth, worldBoundsHeight);
        
        // Ensure camera viewport shows the bottom of the level when at max scroll
        // The camera viewport height is CONFIG.GAME_HEIGHT, so max camera Y should be worldBoundsHeight - CONFIG.GAME_HEIGHT
        const maxCameraY = Math.max(0, worldBoundsHeight - CONFIG.GAME_HEIGHT);
        console.log(`Game: Camera can scroll from y=0 to y=${maxCameraY}, viewport height=${CONFIG.GAME_HEIGHT}`);
        
        // Update camera follow to ensure it respects bounds and doesn't allow scrolling below visible level
        if (this.player) {
            scene.cameras.main.startFollow(this.player, true, 0.1, 0.1);
            // Set deadzone to keep player centered in viewport
            scene.cameras.main.setDeadzone(0, 0);
            // Ensure camera respects bounds
            scene.cameras.main.setBounds(0, 0, actualWidth, worldBoundsHeight);
        }
        
        // Ensure player and enemies have world bounds collision enabled
        if (this.player) {
            this.player.setCollideWorldBounds(true);
        }
        if (this.enemies) {
            this.enemies.children.entries.forEach(enemy => {
                if (enemy && enemy.active) {
                    enemy.setCollideWorldBounds(true);
                }
            });
        }
        
        // Camera follow was already set up earlier to allow background scrolling during tile loading
        // Just ensure it's still active (don't call startFollow again as it may reset)

        // Create a ground platform at the bottom of the ACTUAL level content (not canvas)
        // This prevents falling through the visible bottom of the level
        const groundPlatform = scene.add.rectangle(actualWidth / 2, groundY, actualWidth, CONFIG.TILE_SIZE, 0x8B4513);
        // Add physics as static (true parameter makes it immovable automatically)
        scene.physics.add.existing(groundPlatform, true);
        this.platforms.add(groundPlatform);
        groundPlatform.setVisible(false); // Invisible collision box
        groundPlatform.setDepth(-1); // Behind everything
        // Static bodies are automatically immovable, but ensure body exists
        if (groundPlatform.body) {
            // Static bodies don't need setImmovable, but we can set it if the method exists
            if (typeof groundPlatform.body.setImmovable === 'function') {
                groundPlatform.body.setImmovable(true);
            }
        }
        console.log(`Game: Created ground platform at y=${groundY} (bottom of actual level content) to prevent falling`);

        // Add collisions
        scene.physics.add.collider(this.player, this.platforms);
        scene.physics.add.collider(this.enemies, this.platforms, this.enemyHitWall, null, this);
        scene.physics.add.collider(this.player, this.hazards, this.playerHitHazard, null, this);
        scene.physics.add.overlap(this.player, this.collectibles, this.collectItem, null, this);
        scene.physics.add.overlap(this.player, this.enemies, this.hitEnemy, null, this);
        
        console.log('Game: Level generated from CSV.');
    }

    /**
     * Update background when it becomes available (called after async generation)
     */
    async updateBackground() {
        if (!this.currentScene) {
            console.warn('Game: Cannot update background - no scene available');
            return;
        }
        
        // Guard against redundant updates
        if (this.isUpdatingBackground) {
            console.log('Game: Background update already in progress, skipping');
            return;
        }
        
        this.isUpdatingBackground = true;
        
        try {
            const scene = this.currentScene;
        const locationBg = window.locationBackground || localStorage.getItem('location_background');
        
        // Get frames array if available (version 5+)
        const locationBgFrames = window.locationBackgroundFrames || (() => {
            try {
                const framesStr = localStorage.getItem('location_background_frames');
                return framesStr ? JSON.parse(framesStr) : null;
            } catch (e) {
                return null;
            }
        })();
        
        const useFramesArray = locationBgFrames && locationBgFrames.length >= 2;
        
        if (!locationBg && !useFramesArray) {
            console.log('Game: updateBackground called but no background or frames available yet');
            return;
        }
        
        // Check if background is already loaded
        if (this.backgroundSprites && this.backgroundSprites.length > 0) {
            console.log('Game: Background already loaded, skipping update');
            return;
        }
        
        console.log('Game: Updating background - background became available after game start');
        
        // Get level dimensions
        const levelData = window.LEVELS ? window.LEVELS[0] : null;
        if (!levelData) {
            console.warn('Game: Cannot update background - no level data');
            return;
        }
        
        const rows = levelData.csv.trim().split('\n');
        const tileSize = CONFIG.TILE_SIZE;
        const levelHeight = rows.length * tileSize;
        const yOffset = Math.max(0, CONFIG.GAME_HEIGHT - levelHeight);
        const maxCols = Math.max(...rows.map(r => r.length));
        const actualWidth = maxCols * tileSize;
        const canvasHeight = levelHeight + yOffset;
        
            // Get weather metadata
            let weatherMeta = null;
            try {
                const metaStr = localStorage.getItem('location_background_meta');
                if (metaStr) {
                    weatherMeta = JSON.parse(metaStr);
                }
            } catch (e) {
                console.warn('Could not parse background metadata:', e);
            }
            
            let frameWidth = 512;
            let actualBgHeight = 512;
            let isAnimated = false;
            let bgKey = 'location_background_texture';
            
            if (useFramesArray) {
                console.log(`Game: updateBackground - Loading ${locationBgFrames.length} background frames as separate textures...`);
                isAnimated = true;
                
                // Load each frame as a separate texture
                for (let i = 0; i < locationBgFrames.length; i++) {
                    const frameKey = `bg_frame_${i}`;
                    if (!scene.textures.exists(frameKey)) {
                        scene.textures.addBase64(frameKey, locationBgFrames[i]);
                    }
                }
                
                // Wait for all frames to load
                await new Promise((resolve) => {
                    let attempts = 0;
                    const maxAttempts = 100;
                    const checkFrames = () => {
                        attempts++;
                        if (attempts > maxAttempts) {
                            console.warn('Timeout waiting for background frames');
                            resolve();
                            return;
                        }
                        let allLoaded = true;
                        for (let i = 0; i < locationBgFrames.length; i++) {
                            if (!scene.textures.exists(`bg_frame_${i}`)) {
                                allLoaded = false;
                                break;
                            }
                        }
                        if (allLoaded) {
                            const texture = scene.textures.get('bg_frame_0');
                            if (texture && texture.source && texture.source.length > 0) {
                                frameWidth = texture.source[0].width || 512;
                                actualBgHeight = texture.source[0].height || 512;
                            }
                            resolve();
                            return;
                        }
                        setTimeout(checkFrames, 50);
                    };
                    checkFrames();
                });
            } else if (locationBg) {
                // Fallback: Use spritesheet (old version)
                if (typeof locationBg !== 'string') {
                    console.error('Game: locationBg is not a string!', locationBg);
                    return;
                }
                
                if (!scene.textures.exists(bgKey)) {
                    scene.textures.addBase64(bgKey, locationBg);
                }
                
                await new Promise((resolve) => {
                    let attempts = 0;
                    const maxAttempts = 100;
                    const checkTexture = () => {
                        attempts++;
                        if (attempts > maxAttempts) {
                            console.warn('Timeout waiting for background texture');
                            resolve();
                            return;
                        }
                        const textureKey = 'location_background_texture';
                        if (scene.textures.exists(textureKey)) {
                            const texture = scene.textures.get(textureKey);
                            if (texture && texture.source && texture.source.length > 0) {
                                const source = texture.source[0];
                                if (source.width > 0) {
                                    const actualBgWidth = source.width;
                                    actualBgHeight = source.height;
                                    frameWidth = (actualBgWidth >= 1800 && actualBgWidth <= 2200) ? actualBgWidth / 4 : actualBgWidth;
                                    isAnimated = (actualBgWidth >= 1800 && actualBgWidth <= 2200);
                                    resolve();
                                    return;
                                }
                            }
                        }
                        setTimeout(checkTexture, 50);
                    };
                    checkTexture();
                });
            }
            
            // Create spritesheet if animated and using spritesheet logic
            if (isAnimated && !useFramesArray && !scene.textures.exists('bg_spritesheet')) {
                const texture = scene.textures.get(bgKey);
                if (texture && texture.source && texture.source.length > 0) {
                    scene.textures.addSpriteSheet('bg_spritesheet', texture.source[0].image, {
                        frameWidth: frameWidth,
                        frameHeight: actualBgHeight
                    });
                }
            }
            
            // Determine animation speed (Frames Per Second)
            // With 8 frames, a speed of 2 means a full cycle every 4 seconds.
            let animSpeed = 2; 
            if (weatherMeta && weatherMeta.timeWeather) {
                const weather = weatherMeta.timeWeather;
                if (weather.season === 'winter' || weather.timeOfDay === 'night') animSpeed = 1.5;
                else if (weather.season === 'spring' || weather.season === 'summer') animSpeed = 2.5;
            }
            
            // Create background sprites
            // Scale to fit VIEWPORT (512x512), not canvas height
            const scaleY = CONFIG.GAME_HEIGHT / actualBgHeight;
            const scaleX = scaleY; // Use uniform scaling to fit height and tile horizontally
            const scaledTileWidth = frameWidth * scaleX;
            const tilesNeeded = Math.ceil(actualWidth / scaledTileWidth);
            
            if (!this.backgroundSprites) this.backgroundSprites = [];
            this.backgroundSprites.forEach(s => s && s.active && s.destroy());
            this.backgroundSprites = [];
            
            for (let i = 0; i < tilesNeeded; i++) {
                const scaledTileWidth = Math.round(frameWidth * scaleX);
                const xPos = i * scaledTileWidth;
                let bgSprite;
                
                if (useFramesArray) {
                    // Cyclic animation using separate frames
                    bgSprite = scene.add.image(xPos, 0, 'bg_frame_0');
                    bgSprite.setData('frameCount', locationBgFrames.length);
                    bgSprite.setData('currentFrame', 0);
                    bgSprite.setData('lastFrameUpdate', Date.now());
                    bgSprite.setData('frameRate', 1000 / animSpeed);
                } else if (isAnimated && scene.textures.exists('bg_spritesheet')) {
                    bgSprite = scene.add.sprite(xPos, 0, 'bg_spritesheet', 0);
                    // Create animation if needed
                    if (!scene.anims.exists('bg_animate')) {
                        scene.anims.create({
                            key: 'bg_animate',
                            frames: scene.anims.generateFrameNumbers('bg_spritesheet', { start: 0, end: 3 }),
                            frameRate: animSpeed,
                            repeat: -1
                        });
                    }
                    bgSprite.play('bg_animate');
                } else {
                    bgSprite = scene.add.image(xPos, 0, bgKey);
                }
                
                bgSprite.setOrigin(0, 0);
                // Background should be exactly viewport height (512px), not scaled to level height
                bgSprite.setDisplaySize(scaledTileWidth, CONFIG.GAME_HEIGHT);
                bgSprite.setDepth(-10);
                bgSprite.setScrollFactor(1, 1);
                this.backgroundSprites.push(bgSprite);
            }
            
            console.log(`Game: Internal background updated successfully (${tilesNeeded} tiles, ${isAnimated ? 'animated' : 'static'})`);
        } catch (error) {
            console.error('Game: Error updating background:', error);
        } finally {
            this.isUpdatingBackground = false;
        }
    }

    playerHitHazard(player, hazard) {
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
             }, 500);
        }
    }

    createCollectiblesFromLevel(scene) {
        this.collectibles = scene.physics.add.group();
        
        this.levelData.collectibles.forEach(pos => {
            const collectible = this.collectibles.create(pos.x * CONFIG.TILE_SIZE, pos.y * CONFIG.TILE_SIZE, 'platform');
            collectible.setTint(0xffff00);
            collectible.setScale(0.3);
            collectible.body.setSize(20, 20);
        });

        scene.physics.add.overlap(this.player, this.collectibles, this.collectItem, null, this);
    }

    createEnemiesFromLevel(scene) {
        this.enemies = scene.physics.add.group();

        this.levelData.enemies.forEach(enemyData => {
            if (!scene.textures.exists('cat')) {
                console.warn(`Game: Cannot create cat enemy - 'cat' texture not found`);
                return;
            }
            const enemy = this.enemies.create(enemyData.x * CONFIG.TILE_SIZE, enemyData.y * CONFIG.TILE_SIZE, 'cat', 0);
            if (!enemy) {
                console.error(`Game: Failed to create cat enemy`);
                return;
            }
            // No scaling needed - cat sprite sheet uses universal tile size (64x64 per frame)
            enemy.setVisible(true);
            enemy.setAlpha(1.0);
            // Set collision box using universal tile size (75% of tile, 12.5% offset)
            enemy.body.setSize(CONFIG.TILE_SIZE * 0.75, CONFIG.TILE_SIZE * 0.75);
            enemy.body.setOffset(CONFIG.TILE_SIZE * 0.125, CONFIG.TILE_SIZE * 0.125); 
            // Velocity based on tile size: 1.25 tiles per second
            const velocity = enemyData.type === 'moving' ? -(CONFIG.TILE_SIZE * 1.25) : 0;
            enemy.setVelocityX(velocity);
            enemy.setCollideWorldBounds(true);
            enemy.body.onWorldBounds = true; // Trigger events if needed
            enemy.setBounce(1, 0);
            
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
        });

        // Ensure colliders are set up
        scene.physics.add.collider(this.enemies, this.platforms);
        scene.physics.add.overlap(this.player, this.enemies, this.hitEnemy, null, this);
        
    }

    createAnimations(scene) {
        // Only if not exists
        if (scene.anims.exists('walk-right')) return;
        
        // Ensure sprite sheets exist before creating animations
        if (!scene.textures.exists('playerSprite')) {
            console.warn('Game: Cannot create player animations - playerSprite texture not found');
            return;
        }
        
        // Player animations
        // Walking right (Reference for both directions)
        scene.anims.create({
            key: 'walk-right',
            frames: scene.anims.generateFrameNumbers('playerSprite', { start: 0, end: 3 }),
            frameRate: 10,
            repeat: -1
        });

        // Walking left (Row 2: frames 4-7)
        scene.anims.create({
            key: 'walk-left',
            frames: scene.anims.generateFrameNumbers('playerSprite', { start: 4, end: 7 }),
            frameRate: 10,
            repeat: -1
        });

        // Jumping
        scene.anims.create({
            key: 'jump',
            frames: scene.anims.generateFrameNumbers('playerSprite', { start: 8, end: 11 }),
            frameRate: 10,
            repeat: -1
        });

        // Idle
        scene.anims.create({
            key: 'idle',
            frames: scene.anims.generateFrameNumbers('playerSprite', { start: 12, end: 15 }),
            frameRate: 5,
            repeat: -1
        });

        // CAT ENEMY ANIMATIONS
        // Only create if cat sprite sheet exists
        if (scene.textures.exists('cat')) {
            // Row 1 (frames 0-3): Walk - Used for both directions
            scene.anims.create({
                key: 'cat-walk-right',
                frames: scene.anims.generateFrameNumbers('cat', { start: 0, end: 3 }),
                frameRate: 10,
                repeat: -1
            });

            scene.anims.create({
                key: 'cat-walk-left',
                frames: scene.anims.generateFrameNumbers('cat', { start: 4, end: 7 }), // Row 2: Walk Left (frames 4-7)
                frameRate: 10,
                repeat: -1
            });

            // Row 3 (frames 8-11): Attack/Action - 4 frames
            scene.anims.create({
                key: 'cat-attack',
                frames: scene.anims.generateFrameNumbers('cat', { start: 8, end: 11 }),
                frameRate: 10,
                repeat: -1
            });

            // Row 4 (frames 12-15): Idle - 4 frames
            scene.anims.create({
                key: 'cat-idle',
                frames: scene.anims.generateFrameNumbers('cat', { start: 12, end: 15 }),
                frameRate: 8,
                repeat: -1
            });
        } else {
            console.warn('Game: Cannot create cat animations - cat texture not found');
        }

        // Set default animation
        if (this.player) this.player.anims.play('idle');
    }

    createEnemies(scene) {
        this.enemies = scene.physics.add.group();

        // Create enemies on platforms using the sprite
        // Create enemies on platforms using the 'cat' key
        if (!scene.textures.exists('cat')) {
            console.warn('Game: Cannot create enemies - cat texture not found');
            return;
        }
        // Enemy 1
        const enemy1 = this.enemies.create(550, 350, 'cat', 0);
        if (!enemy1) {
            console.error('Game: Failed to create enemy1');
            return;
        }
        // No scaling needed - cat sprite sheet uses universal tile size (64x64 per frame)
        enemy1.setVisible(true);
        enemy1.setAlpha(1.0);
        // Set collision box using universal tile size (75% of tile, 12.5% offset)
        enemy1.body.setSize(CONFIG.TILE_SIZE * 0.75, CONFIG.TILE_SIZE * 0.75);
        enemy1.body.setOffset(CONFIG.TILE_SIZE * 0.125, CONFIG.TILE_SIZE * 0.125);
        // Velocity based on tile size: 1.25 tiles per second
        enemy1.setVelocityX(-(CONFIG.TILE_SIZE * 1.25));
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
        enemy2.setVisible(true);
        enemy2.setAlpha(1.0);
        // Set collision box using universal tile size (75% of tile, 12.5% offset)
        enemy2.body.setSize(CONFIG.TILE_SIZE * 0.75, CONFIG.TILE_SIZE * 0.75);
        enemy2.body.setOffset(CONFIG.TILE_SIZE * 0.125, CONFIG.TILE_SIZE * 0.125);
        // Velocity based on tile size: 1.25 tiles per second
        enemy2.setVelocityX(CONFIG.TILE_SIZE * 1.25);
        enemy2.setCollideWorldBounds(true);
        enemy2.setBounce(1, 0);
        enemy2.setData('direction', 1);
        enemy2.setData('state', 'walking');
        enemy2.setData('attackCooldown', 0);
        enemy2.setData('isAttacking', false);
        enemy2.setData('attackDamageWindow', false);
        enemy2.anims.play('cat-walk-right');

        // Collision with platforms
        scene.physics.add.collider(this.enemies, this.platforms);
        
        // Collision with player
        scene.physics.add.overlap(this.player, this.enemies, this.hitEnemy, null, this);
    }

    createCollectibles(scene) {
        // Create collectible graphic (coin/star)
        const collectibleGraphics = scene.add.graphics();
        collectibleGraphics.fillStyle(0xffd700);
        collectibleGraphics.fillCircle(CONFIG.TILE_SIZE / 2, CONFIG.TILE_SIZE / 2, CONFIG.TILE_SIZE * 0.1875);
        collectibleGraphics.fillStyle(0xffed4e);
        collectibleGraphics.fillCircle(CONFIG.TILE_SIZE / 2, CONFIG.TILE_SIZE / 2, CONFIG.TILE_SIZE * 0.125);
        collectibleGraphics.generateTexture('collectible', CONFIG.TILE_SIZE, CONFIG.TILE_SIZE);
        collectibleGraphics.destroy();

        this.collectibles = scene.physics.add.group();
        
        // Create collectibles at various positions
        const positions = [
            { x: 200, y: 400 },
            { x: 400, y: 300 },
            { x: 650, y: 300 },
            { x: 100, y: 150 },
            { x: 700, y: 120 },
            { x: 500, y: 500 }
        ];

        positions.forEach(pos => {
            const collectible = this.collectibles.create(pos.x, pos.y, 'collectible');
            collectible.body.setSize(24, 24);
        });

        // Collision with collectibles
        scene.physics.add.overlap(this.player, this.collectibles, this.collectItem, null, this);
    }

    update(scene) {
        try {
            // Update background animations if using frame array
            if (this.backgroundSprites) {
                const now = Date.now();
                this.backgroundSprites.forEach(sprite => {
                    const frameCount = sprite.getData('frameCount');
                    if (frameCount) {
                        const lastUpdate = sprite.getData('lastFrameUpdate');
                        const frameRate = sprite.getData('frameRate');
                        if (now - lastUpdate > frameRate) {
                            let currentFrame = sprite.getData('currentFrame');
                            currentFrame = (currentFrame + 1) % frameCount;
                            sprite.setTexture(`bg_frame_${currentFrame}`);
                            sprite.setData('currentFrame', currentFrame);
                            sprite.setData('lastFrameUpdate', now);
                        }
                    }
                });
            }

            // Periodically check if background became available (fallback if updateBackground wasn't called)
            if (scene && !this.backgroundSprites?.length) {
                const locationBg = window.locationBackground || localStorage.getItem('location_background');
                if (locationBg) {
                    // Only check every 5 seconds to avoid spam
                    const now = Date.now();
                    if (!this.lastBackgroundCheck || now - this.lastBackgroundCheck > 5000) {
                        this.lastBackgroundCheck = now;
                        console.log('Game: Background became available, updating...');
                        this.updateBackground();
                    }
                }
            }
            
            if (!this.player || !this.player.body || !this.cursors) return;
            
            const isOnGround = this.player.body.onFloor() || this.player.body.touching.down;

            const frameSize = this.player.frameSize || CONFIG.TILE_SIZE;
            const offsetX = (frameSize * (1 - 0.35)) / 2;

            // Movement handling
            if (this.cursors.left.isDown) {
                this.player.setVelocityX(-CONFIG.PLAYER_SPEED);
                if (isOnGround) {
                    this.player.anims.play('walk-left', true);
                    this.player.setOffset(offsetX, frameSize * 0.22);
                }
                // No flip needed - walk-left uses dedicated frames (row 2)
            } else if (this.cursors.right.isDown) {
                this.player.setVelocityX(CONFIG.PLAYER_SPEED);
                if (isOnGround) {
                    this.player.anims.play('walk-right', true);
                    this.player.setOffset(offsetX, frameSize * 0.22);
                }
                // No flip needed - walk-right uses dedicated frames (row 1)
            } else {
                this.player.setVelocityX(0);
                if (isOnGround) {
                    this.player.anims.play('idle', true);
                    this.player.setOffset(offsetX, frameSize * 0.12);
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

            // Check if player fell off the map (use actual level bottom, accounting for yOffset)
            const rows = this.currentCSVData ? this.currentCSVData.trim().split('\n') : [];
            if (rows.length > 0) {
                const tileSize = CONFIG.TILE_SIZE;
                const levelHeight = rows.length * tileSize;
                const yOffset = Math.max(0, CONFIG.GAME_HEIGHT - levelHeight);
                const lastRowBottom = rows.length * tileSize + yOffset;
                const actualLevelBottom = lastRowBottom;
                const killZone = actualLevelBottom + 200; // Kill zone 200px below level bottom
                
                if (this.player.y > killZone) {
                    console.warn(`Game: Player fell off map at y=${this.player.y}, level bottom=${actualLevelBottom}`);
                    this.loseLife();
                }
                
                // Also check if player is below visible level (safety check)
                if (this.player.y > actualLevelBottom + 50) {
                    // Reset player position to safe position above ground
                    const spawnY = Math.min(100, actualLevelBottom - CONFIG.TILE_SIZE * 3);
                    this.player.setPosition(this.player.x, spawnY);
                    this.player.setVelocityY(0);
                }
            }

            // Check for enemies falling off map (use actual level bottom, accounting for yOffset)
            if (this.enemies) {
                // Calculate actual level bottom from stored CSV data
                const rows = this.currentCSVData ? this.currentCSVData.trim().split('\n') : [];
                if (rows.length > 0) {
                    const tileSize = CONFIG.TILE_SIZE;
                    const levelHeight = rows.length * tileSize;
                    const yOffset = Math.max(0, CONFIG.GAME_HEIGHT - levelHeight);
                    const lastRowBottom = rows.length * tileSize + yOffset;
                    const actualLevelBottom = lastRowBottom;
                    
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
                            const dist = Phaser.Math.Distance.Between(cat.x, cat.y, this.player.x, this.player.y);
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
                                            const currentDist = Phaser.Math.Distance.Between(cat.x, cat.y, this.player.x, this.player.y);
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
                                        const finalDist = Phaser.Math.Distance.Between(cat.x, cat.y, this.player.x, this.player.y);
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

    enemyHitWall(enemy, wall) {
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

    hitEnemy(player, enemy) {
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

    collectItem(player, item) {
        item.disableBody(true, true);
        this.score += 10;
        this.updateUI();

        // Check win condition
        if (this.collectibles.countActive(true) === 0) {
            this.winGame();
        }
    }

    loseLife() {
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

    gameOver() {
        if (this.currentScene) this.currentScene.physics.pause();
        this.showOverlay('GAME OVER', `Final Score: ${this.score}`, '#ff0000');
    }

    winGame() {
        if (this.currentScene) this.currentScene.physics.pause();
        this.showOverlay('YOU WIN!', `Final Score: ${this.score}`, '#4CAF50');
    }

    showOverlay(title, subtitle, color) {
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

    restartGame() {
        if (this.game) {
            this.game.destroy(true);
        }
        // Remove overlay if exists (safety)
        const existingOverlay = document.getElementById('game-overlay');
        if (existingOverlay) existingOverlay.remove();
        
        document.getElementById('menu-screen').classList.remove('hidden');
        document.getElementById('game-screen').classList.add('hidden');
    }

    updateUI() {
        const scoreEl = document.getElementById('score');
        const livesEl = document.getElementById('lives');
        if (scoreEl) scoreEl.textContent = `Score: ${this.score}`;
        if (livesEl) livesEl.textContent = `Lives: ${this.lives}`;
    }

    toggleDebug() {
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

    destroy() {
        if (this.game) {
            this.game.destroy(true);
        }
    }
}

// Pause button functionality - enhanced with scene pause/resume
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        const pauseBtn = document.getElementById('pause-btn');
        if (pauseBtn) {
            pauseBtn.addEventListener('click', () => {
                if (window.gameInstance && window.gameInstance.game) {
                    const scenes = window.gameInstance.game.scene.scenes;
                    if (scenes.length > 0) {
                        const activeScene = scenes[0];
                        if (activeScene.scene.isPaused()) {
                            // Resume game
                            activeScene.scene.resume();
                            activeScene.physics.resume();
                            pauseBtn.textContent = 'Pause';
                            pauseBtn.classList.remove('paused');
                        } else {
                            // Pause game
                            activeScene.scene.pause();
                            activeScene.physics.pause();
                            pauseBtn.textContent = 'Resume';
                            pauseBtn.classList.add('paused');
                        }
                    }
                }
            });
            
            // Also support ESC key for pause/resume
            document.addEventListener('keydown', (event) => {
                if (event.key === 'Escape' || event.key === 'Pause') {
                    // Only trigger if not typing in an input field
                    if (event.target.tagName !== 'INPUT' && event.target.tagName !== 'TEXTAREA') {
                        event.preventDefault();
                        pauseBtn.click();
                    }
                }
            });
        }
    });
}

// Export Game class to window for global access immediately
if (typeof window !== 'undefined') {
    window.Game = Game;
    console.log('Game class exported to window.Game');
} else {
    // Node.js or other environment
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Game;
    }
}
