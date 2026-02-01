// Main game logic using Phaser.js

// Ensure Phaser is loaded before proceeding
if (typeof Phaser === 'undefined') {
    console.error('Phaser.js is not loaded! Please ensure the Phaser script is loaded before game.js');
    throw new Error('Phaser.js is required but not found. Check script loading order in index.html');
}

// Export Game class to window for global access
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
        this.generateLevelFromTilesheet = this.generateLevelFromTilesheet.bind(this);
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
        this.tilesheetData = null;
        this.levelGenerator = null;
        this.currentScene = null; // Store reference to active scene
    }

    preload(scene) {
        console.log('Game: Preload started');
        this.currentScene = scene;
        
        // Log the sprite URL length to verify we have data
        console.log('Game: Sprite sheet URL length:', this.spriteSheetUrl ? this.spriteSheetUrl.length : 'NULL');
        
        // Load custom sprite sheet
        scene.load.image('player', this.spriteSheetUrl);
        
        // Load custom sprite sheet as IMAGE first (for dynamic sizing in create)
        scene.load.image('player', this.spriteSheetUrl);
        
        // REMOVED: Static spritesheet loading
        // We will create the spritesheet dynamically in create() to handle different image sizes

        // Load tilesheet (optional - used as fallback if AI tiles aren't available)
        // Try to load, but don't fail if it doesn't exist since we use AI tiles now
        try {
            scene.load.spritesheet('tilesheet', 'Titlesheet.png', {
                frameWidth: 64,
                frameHeight: 64
            });
        } catch (e) {
            console.warn('Titlesheet.png not found - will use AI-generated tiles only');
        }
        
        // Load cat enemies spritesheet
        // Cat.png is 870x674 with 6 columns x 6 rows
        // Frame size: 870/6 = 145 wide, 674/6 ≈ 112 tall
        scene.load.spritesheet('cat', 'Cat.png', {
            frameWidth: 145,
            frameHeight: 112
        });

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
        // Create a canvas-based platform graphic
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 16;
        const ctx = canvas.getContext('2d');
        
        // Draw platform
        ctx.fillStyle = '#8B4513'; // Brown
        ctx.fillRect(0, 0, 64, 16);
        ctx.fillStyle = '#A0522D'; // Darker brown
        ctx.fillRect(0, 12, 64, 4);
        ctx.fillStyle = '#654321'; // Even darker for depth
        ctx.fillRect(0, 14, 64, 2);
        
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
                
                console.log(`Game: creating dynamic spritesheet. Source: ${sourceImage.width}x${sourceImage.height}, Frame: ${frameWidth}x${frameHeight}`);
                
                // Use .image to get the raw DOM Image element
                scene.textures.addSpriteSheet('playerSprite', playerTexture.source[0].image, {
                    frameWidth: frameWidth,
                    frameHeight: frameHeight
                });
            } else if (!scene.textures.exists('playerSprite')) {
                console.error('Game: Player texture MISSING (both player and playerSprite)');
            }

            // Ensure player is created
            if (!this.player) {
                this.player = scene.physics.add.sprite(100, 450, 'playerSprite');
                this.player.setBounce(0.2);
                this.player.setCollideWorldBounds(true);
                
                // Calculate scale to make player approx 1.5 tiles high (approx 96px)
                // If frame is 256px, scale should be ~0.375
                // If frame is 64px, scale should be 1.5
                const playerFrame = scene.textures.get('playerSprite').frames[0];
                const frameSize = playerFrame ? playerFrame.width : 64;
                // Target size is roughly 1.5x standard sprite size (64 * 1.5 = 96)
                const targetSize = CONFIG.SPRITE_SIZE * 1.5;
                const scale = targetSize / frameSize;
                
                console.log(`Game: Scaling player. Frame: ${frameSize}, Target: ${targetSize}, Scale: ${scale.toFixed(2)}`);
                this.player.setScale(scale);
                
                // Adjust body size to match visual
                // For a 256px frame scaled to 96px, body should be roughly smaller for better collisions
                // Normalized to the frame size
                if (this.player.body) {
                   // Make hitbox narrower (50% of width) and shorter (80% of height)
                   const hitWidth = frameSize * 0.5; 
                   const hitHeight = frameSize * 0.8;
                   this.player.body.setSize(hitWidth, hitHeight);
                   this.player.body.setOffset((frameSize - hitWidth) / 2, (frameSize - hitHeight));
                }
                
                // Ensure player is rendered ON TOP of the level
                this.player.setDepth(100);
            }

            // 2. Generate Level (Default or AI)
            // Use pre-loaded level image if available
            console.log('Game: Creating Level 1...');
            this.createLevel1(scene);
            
            // Ensure camera limits
            scene.cameras.main.setBounds(0, 0, CONFIG.GAME_WIDTH, CONFIG.GAME_HEIGHT);

            // Create animations
            this.createAnimations(scene);

            // Input
            this.cursors = scene.input.keyboard.createCursorKeys();
            
            // Add spacebar for jump
            this.spaceKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
            
            // Add 'D' key for Debug Mode
            this.debugKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
            this.debugMode = false; // Default to hidden
            
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

    async generateLevelFromTilesheet(scene) {
        try {
            // Analyze tilesheet
            console.log('Analyzing tilesheet...');
            this.tilesheetData = await this.levelGenerator.analyzeTilesheet();
            
            // Generate level map
            console.log('Generating level map...');
            this.levelData = await this.levelGenerator.generateLevelMap(this.tilesheetData);
            
            // Render the level
            this.renderLevel(scene);
        } catch (error) {
            console.error('Error generating level:', error);
            
            // Check if it's an API key error
            if (error.type === 'API_KEY_EXPIRED' || error.type === 'API_KEY_INVALID') {
                console.warn('API key issue detected. Using default level. Please check your API key.');
            }
            
            // Fallback to default level
            this.createDefaultLevel(scene);
        }
    }

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
        const spawnX = this.levelData.spawn ? this.levelData.spawn.x * 64 : 100;
        const spawnY = this.levelData.spawn ? this.levelData.spawn.y * 64 : 450;
        
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
        const tileSize = 64;
        for (let row = 0; row < layerData.length; row++) {
            for (let col = 0; col < layerData[row].length; col++) {
                const tileIndex = layerData[row][col];
                if (tileIndex >= 0) {
                    const x = col * tileSize;
                    const y = row * tileSize;
                    
                    // Create tile sprite for visual
                    const tile = scene.add.sprite(x, y, 'tilesheet', tileIndex);
                    tile.setOrigin(0, 0);
                    tile.setDepth(isSolid ? 1 : 0); // Ground tiles on top
                    
                    // If solid, create collision box
                    if (isSolid) {
                        const platform = this.platforms.create(x, y, 'tilesheet', tileIndex);
                        platform.setOrigin(0, 0);
                        platform.setImmovable(true); // Static platform
                        platform.body.setSize(tileSize, tileSize);
                        platform.body.setOffset(0, 0); // Ensure collision box aligns with tile
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
        const tileSize = 32; 
        const levelHeight = rows.length * tileSize;
        // Calculate offset to align level to BOTTOM of screen if it's smaller than game height
        const yOffset = Math.max(0, CONFIG.GAME_HEIGHT - levelHeight);
        
        console.log(`Game: Level Height: ${levelHeight}, Game Height: ${CONFIG.GAME_HEIGHT}, Y Offset: ${yOffset}`);

        // Parse dimensions first for canvas sizing
        const maxCols = Math.max(...rows.map(r => r.length));
        const actualWidth = maxCols * tileSize;
        const canvasHeight = levelHeight + yOffset;
        
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
        const useForegroundCanvas = useRenderTexture && !locationBg; // Don't use foreground canvas if we have location background
        // ONLY create background canvas if we have a location-based background
        const useBackgroundCanvas = useRenderTexture && locationBg; // Only use background canvas for location-based background
        
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
        
        if (locationBg) {
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
                
                // Load the location background as a texture (4-frame spritesheet)
                const bgKey = 'location_background_texture';
                if (!scene.textures.exists(bgKey)) {
                    scene.textures.addBase64(bgKey, locationBg);
                }
                
                // Wait for texture to be ready and get ACTUAL dimensions from Gemini
                let actualBgWidth = 51200; // Default: 4 frames x 12800px each
                let actualBgHeight = 448; // Default fallback
                let frameWidth = 12800; // Each frame is 12800px wide
                
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
                        if (scene.textures.exists(bgKey)) {
                            const texture = scene.textures.get(bgKey);
                            if (texture && texture.source && texture.source.length > 0) {
                                const source = texture.source[0];
                                if (source.width > 0 && source.height > 0) {
                                    // Get ACTUAL dimensions from the image Gemini returned
                                    actualBgWidth = source.width;
                                    actualBgHeight = source.height;
                                    // If it's a 4-frame spritesheet, each frame is width/4
                                    if (actualBgWidth >= 51200) {
                                        frameWidth = actualBgWidth / 4;
                                        console.log(`Game: Location background is 4-frame spritesheet: ${actualBgWidth}x${actualBgHeight} (each frame: ${frameWidth}x${actualBgHeight})`);
                                    } else {
                                        // Fallback: single frame
                                        frameWidth = actualBgWidth;
                                        console.log(`Game: Location background is single frame: ${actualBgWidth}x${actualBgHeight}`);
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
                // Check if it's animated: should be 4 frames (51200px wide) or close to it
                const isAnimated = actualBgWidth >= 40000; // Allow some tolerance (at least ~3.1 frames worth)
                
                if (isAnimated && !scene.textures.exists('bg_spritesheet')) {
                    console.log('Game: Creating sprite sheet from 4-frame animated background...');
                    const texture = scene.textures.get(bgKey);
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
                        try {
                            scene.textures.addSpriteSheet('bg_spritesheet', source.image, {
                                frameWidth: frameWidth,
                                frameHeight: actualBgHeight,
                                startFrame: 0,
                                endFrame: 3
                            });
                            console.log(`Game: Created background sprite sheet (4 frames, ${frameWidth}x${actualBgHeight} per frame)`);
                        } catch (err) {
                            console.error('Game: Failed to create sprite sheet:', err);
                        }
                    }
                }
                
                // Use frame width (single frame or one frame from spritesheet)
                // The background image is 12800px wide per frame (400 tiles x 32px)
                // Display it at 1:1 pixel scale - no scaling needed horizontally
                // Scale vertically to match canvas height
                const bgTileWidth = frameWidth; // 12800 pixels = 400 tiles x 32px
                const bgTileHeight = actualBgHeight; // 448 pixels = 14 tiles x 32px
                const tilesNeeded = Math.ceil(actualWidth / bgTileWidth);
                const scaleY = canvasHeight / bgTileHeight;
                
                console.log(`Game: Tiling location-based background (from IP)`);
                console.log(`  - Actual image dimensions from Gemini: ${actualBgWidth}x${actualBgHeight}`);
                console.log(`  - Frame width: ${frameWidth}px (${frameWidth/32} tiles), Height: ${actualBgHeight}px (${actualBgHeight/32} tiles)`);
                console.log(`  - Level width: ${actualWidth}px (${actualWidth/32} tiles), Height: ${canvasHeight}px`);
                console.log(`  - Tiles needed: ${tilesNeeded}, Scale Y: ${scaleY.toFixed(2)}`);
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
                        if (!scene.anims.exists('bg_animate')) {
                            try {
                                scene.anims.create({
                                    key: 'bg_animate',
                                    frames: scene.anims.generateFrameNumbers('bg_spritesheet', { start: 0, end: 3 }),
                                    frameRate: animSpeed,
                                    repeat: -1 // Loop forever
                                });
                                console.log(`Game: Created background animation (${animSpeed} fps, 4 frames)`);
                            } catch (err) {
                                console.error('Game: Failed to create animation:', err);
                            }
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
                
                // Use sprite sheet for animated, or single texture for static
                const spriteKey = isAnimated ? 'bg_spritesheet' : bgKey;
                
                for (let i = 0; i < tilesNeeded; i++) {
                    // Use sprite for animated backgrounds, image for static
                    // Position each tile at the correct x coordinate
                    const xPos = i * bgTileWidth;
                    
                    let bgSprite;
                    if (isAnimated && scene.textures.exists('bg_spritesheet')) {
                        // Create sprite with animation support
                        bgSprite = scene.add.sprite(xPos, 0, 'bg_spritesheet', 0); // Start with frame 0
                    } else {
                        // Use image for static backgrounds
                        bgSprite = scene.add.image(xPos, 0, bgKey);
                    }
                    
                    bgSprite.setOrigin(0, 0);
                    // Display at 1:1 pixel scale horizontally, scale vertically to match canvas height
                    bgSprite.setDisplaySize(bgTileWidth, bgTileHeight * scaleY);
                    bgSprite.setDepth(-10); // Behind everything
                    bgSprite.setScrollFactor(1, 1); // Move with camera
                    bgSprite.setVisible(true);
                    bgSprite.setAlpha(1.0);
                    
                    // Start animation if available (only works with sprites, not images)
                    if (isAnimated && scene.anims.exists('bg_animate') && bgSprite.play) {
                        try {
                            bgSprite.play('bg_animate');
                            console.log(`Game: Started animation on background sprite ${i} at x=${xPos}`);
                        } catch (err) {
                            console.warn(`Game: Failed to start animation on sprite ${i}:`, err);
                        }
                    } else if (isAnimated) {
                        console.warn(`Game: Animation not available for sprite ${i} (isAnimated=${isAnimated}, animExists=${scene.anims.exists('bg_animate')}, hasPlay=${!!bgSprite.play})`);
                    }
                    
                    this.backgroundSprites.push(bgSprite);
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
            scene.physics.world.setBounds(0, 0, actualWidth, canvasHeight);
            scene.cameras.main.setBounds(0, 0, actualWidth, canvasHeight);
            scene.cameras.main.startFollow(this.player, true, 0.1, 0.1);
            console.log('Game: Camera and player set up - background can now scroll while tiles load');
        } else if (!this.player) {
            console.warn('Game: Player sprite not ready yet, camera setup will happen after player creation');
        }
        
        // 2. Load AI-generated tiles if available, otherwise use fallback
        // Store tiles availability for later use
        let aiTilesAvailable = false;
        
        const loadTiles = async () => {
            try {
                // Check for cached tiles (but don't fail if localStorage is full)
                let tiles = null;
                try {
                    const cachedTiles = localStorage.getItem('level_tiles_v1');
                    if (cachedTiles) {
                        console.log('Using cached AI-generated tiles');
                        tiles = JSON.parse(cachedTiles);
                    }
                } catch (storageError) {
                    console.warn('Could not read from localStorage (quota exceeded?):', storageError);
                    // Continue to generate new tiles
                }
                
                // Generate new tiles if not cached
                if (!tiles && window.api && window.api.apiKey) {
                    console.log('Generating AI tiles from Gemini...');
                    const currentLevel = window.LEVELS ? window.LEVELS[0] : { theme: 'Sunny Meadow' };
                    tiles = await window.api.generateLevelTiles(currentLevel.theme);
                    
                    // Clear old cache and save new tiles
                    try {
                        // Remove old cache entry to free up space
                        localStorage.removeItem('level_tiles_v1');
                        // Now save the new tiles
                        localStorage.setItem('level_tiles_v1', JSON.stringify(tiles));
                        console.log('Tiles cached successfully (overwrote old cache)');
                    } catch (storageError) {
                        console.warn('Could not cache tiles (localStorage quota exceeded), clearing cache and retrying...', storageError);
                        // Try to clear more space by removing other game-related cache
                        try {
                            localStorage.removeItem('level_tiles_v1');
                            localStorage.removeItem('character_sprite_sheet');
                            // Try again
                            localStorage.setItem('level_tiles_v1', JSON.stringify(tiles));
                            console.log('Tiles cached after clearing additional cache');
                        } catch (retryError) {
                            console.warn('Still could not cache tiles, using directly from API:', retryError);
                            // Continue anyway - we have the tiles in memory
                        }
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
                console.warn('Could not load AI tiles, using fallback tilesheet:', error);
                this.aiTilesAvailable = false;
            }
        };
        
        // Wait for tiles to load before parsing CSV
        await loadTiles();
        
        // CRITICAL: After tile textures are loaded, re-verify background sprites are still visible
        // Phaser's addBase64 can trigger scene refreshes that might affect existing sprites
        // This happens RIGHT AFTER tile POST calls return, which is when the background disappears
        const bgKey = 'location_background_texture';
        if (scene.textures.exists(bgKey)) {
            console.log('Game: Background texture still exists after tile loading ✓');
        } else {
            console.error('Game: ERROR - Background texture was removed/overwritten during tile loading!');
            // Re-add it if it was accidentally removed
            if (locationBg) {
                console.log('Game: Re-adding background texture...');
                scene.textures.addBase64(bgKey, locationBg);
            }
        }
        
        if (this.backgroundSprites && this.backgroundSprites.length > 0) {
            console.log('Game: Re-verifying background sprites after tile texture loading...');
            let activeCount = 0;
            this.backgroundSprites.forEach((sprite, index) => {
                if (sprite && sprite.active) {
                    // Re-apply all properties to ensure they persist
                    sprite.setVisible(true);
                    sprite.setDepth(-10); // Must be behind all tiles
                    sprite.setAlpha(1.0);
                    sprite.setScrollFactor(1, 1);
                    // Ensure the texture reference is still valid
                    if (sprite.texture && sprite.texture.key !== bgKey) {
                        console.warn(`Game: Background sprite ${index} texture changed from ${bgKey} to ${sprite.texture.key}`);
                        // Try to restore the correct texture
                        if (scene.textures.exists(bgKey)) {
                            sprite.setTexture(bgKey);
                        }
                    }
                    activeCount++;
                } else {
                    console.warn(`Game: Background sprite ${index} became inactive after texture loading`);
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
                const centerX = x + 16;
                const centerY = y + 16;

                switch (cell) {
                    case 'P': // Platform
                        let p;
                        if (scene.textures.exists('tilesheet')) {
                            p = this.platforms.create(x, y, 'tilesheet', 1);
                        } else {
                            p = scene.add.rectangle(centerX, centerY, 32, 32, 0x8B4513);
                            scene.physics.add.existing(p, true);
                            this.platforms.add(p);
                        }
                        p.setOrigin(0, 0);
                        if (p.body) p.body.setSize(32, 32);
                        p.setVisible(false);
                        
                        // Draw visual on foreground canvas
                        if (this.foregroundCanvas) {
                            if (this.aiTilesAvailable && scene.textures.exists('tile_platform')) {
                                const tempImg = scene.add.image(0, 0, 'tile_platform');
                                tempImg.setOrigin(0.5, 0.5);
                                // CRITICAL: Scale down from 1024x1024 to 32x32 pixels
                                tempImg.setDisplaySize(32, 32);
                                this.foregroundCanvas.draw(tempImg, centerX, centerY);
                                tempImg.destroy();
                            } else if (scene.textures.exists('tilesheet')) {
                                const tempImg = scene.add.image(0, 0, 'tilesheet', 1);
                                tempImg.setTint(0x8B4513);
                                tempImg.setOrigin(0.5, 0.5);
                                this.foregroundCanvas.draw(tempImg, centerX, centerY);
                                tempImg.destroy();
                            } else {
                                const tempRect = scene.add.rectangle(0, 0, 32, 32, 0x8B4513);
                                tempRect.setOrigin(0.5, 0.5);
                                this.foregroundCanvas.draw(tempRect, centerX, centerY);
                                tempRect.destroy();
                            }
                        } else {
                            // Fallback: create visible sprite
                            if (this.aiTilesAvailable && scene.textures.exists('tile_platform')) {
                                const visual = scene.add.image(centerX, centerY, 'tile_platform');
                                // CRITICAL: Scale down from 1024x1024 to 32x32 pixels
                                visual.setDisplaySize(32, 32);
                                visual.setDepth(0);
                            } else if (scene.textures.exists('tilesheet')) {
                                const visual = scene.add.image(centerX, centerY, 'tilesheet', 1);
                                visual.setTint(0x8B4513);
                                visual.setDepth(0);
                            } else {
                                const visual = scene.add.rectangle(centerX, centerY, 32, 32, 0x8B4513);
                                visual.setDepth(0);
                            }
                        }
                        break;
                    case 'W': // Water (Hazard)
                        let w;
                        if (scene.textures.exists('tilesheet')) {
                            w = this.hazards.create(x, y, 'tilesheet', 2);
                        } else {
                            w = scene.add.rectangle(centerX, centerY, 32, 32, 0x1E90FF);
                            scene.physics.add.existing(w, true);
                            this.hazards.add(w);
                        }
                        w.setOrigin(0, 0);
                        if (w.body) w.body.setSize(32, 32);
                        w.setVisible(false);
                        
                        // Draw water visual on foreground canvas
                        if (this.foregroundCanvas) {
                            if (scene.textures.exists('tilesheet')) {
                                const tempImg = scene.add.image(0, 0, 'tilesheet', 2);
                                tempImg.setTint(0x1E90FF);
                                tempImg.setOrigin(0.5, 0.5);
                                this.foregroundCanvas.draw(tempImg, centerX, centerY);
                                tempImg.destroy();
                            } else {
                                const tempRect = scene.add.rectangle(0, 0, 32, 32, 0x1E90FF);
                                tempRect.setOrigin(0.5, 0.5);
                                this.foregroundCanvas.draw(tempRect, centerX, centerY);
                                tempRect.destroy();
                            }
                        } else {
                            // Create visible sprite (when foregroundCanvas is disabled for location backgrounds)
                            if (scene.textures.exists('tilesheet')) {
                                const visual = scene.add.image(centerX, centerY, 'tilesheet', 2);
                                visual.setTint(0x1E90FF);
                                visual.setDepth(0); // In front of background (depth -10)
                                visual.setScrollFactor(1, 1);
                            } else {
                                const visual = scene.add.rectangle(centerX, centerY, 32, 32, 0x1E90FF);
                                visual.setDepth(0); // In front of background (depth -10)
                                visual.setScrollFactor(1, 1);
                            }
                        }
                        break;
                    case 'C': // Cat Enemy
                        const enemy = this.enemies.create(x + 16, y + 16, 'cat', 0);
                        enemy.setScale(0.4); // Adjusted scale for better visibility
                        enemy.setBounce(0.2);
                        enemy.setCollideWorldBounds(false);
                        enemy.setDepth(1); // Above background (depth -10) and tiles (depth 0)
                        const dir = Math.random() > 0.5 ? 1 : -1;
                        enemy.setVelocityX(60 * dir);
                        enemy.setData('direction', dir);
                        enemy.setData('state', 'walking'); // walking, attacking, dying, dead
                        enemy.setData('attackCooldown', 0);
                        enemy.setData('lastWallCheck', 0);
                        // Set collision box - adjust for cat sprite size
                        enemy.body.setSize(50, 60);
                        enemy.body.setOffset(20, 15);
                        enemy.anims.play(dir > 0 ? 'cat-walk-right' : 'cat-walk-left');
                        break;
                    case 'O': // Treat
                        // Physics body for collectible
                        let treat;
                        if (this.aiTilesAvailable && scene.textures.exists('tile_treat')) {
                            treat = this.collectibles.create(centerX, centerY, 'tile_treat');
                            treat.setData('type', 'treat');
                            // CRITICAL: Scale down from 1024x1024 to 32x32 pixels
                            treat.setDisplaySize(32, 32);
                            treat.setOrigin(0.5, 0.5);
                            treat.setDepth(1); // Above background (depth -10) and tiles (depth 0)
                        } else if (scene.textures.exists('tilesheet')) {
                            treat = this.collectibles.create(centerX, centerY, 'tilesheet', 5);
                            treat.setTint(0xFFD700);
                            treat.setData('type', 'treat');
                            treat.setScale(0.5);
                            treat.setDepth(1); // Above background (depth -10) and tiles (depth 0)
                        } else {
                            treat = scene.add.circle(centerX, centerY, 12, 0xFFD700);
                            scene.physics.add.existing(treat, true);
                            this.collectibles.add(treat);
                            treat.setData('type', 'treat');
                            treat.setDepth(1); // Above background (depth -10) and tiles (depth 0)
                        }
                        break;
                    case 'B': // Bone
                        // Physics body for collectible (needs to be interactive)
                        let bone;
                        if (this.aiTilesAvailable && scene.textures.exists('tile_bone')) {
                            bone = this.collectibles.create(centerX, centerY, 'tile_bone');
                            bone.setData('type', 'bone');
                            // CRITICAL: Scale down from 1024x1024 to 32x32 pixels
                            bone.setDisplaySize(32, 32);
                            bone.setOrigin(0.5, 0.5);
                            bone.setDepth(1); // Above background (depth -10) and tiles (depth 0)
                        } else if (scene.textures.exists('tilesheet')) {
                            bone = this.collectibles.create(centerX, centerY, 'tilesheet', 6);
                            bone.setTint(0xFFFFFF);
                            bone.setData('type', 'bone');
                            bone.setDepth(1); // Above background (depth -10) and tiles (depth 0)
                        } else {
                            bone = scene.add.rectangle(centerX, centerY, 24, 12, 0xFFFFFF);
                            scene.physics.add.existing(bone, true);
                            this.collectibles.add(bone);
                            bone.setData('type', 'bone');
                            bone.setDepth(1); // Above background (depth -10) and tiles (depth 0)
                        }
                        break;
                    case '@': // Spawn
                        if (this.player) this.player.setPosition(x + 16, y + 16);
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
        console.log(`Game: Level size: ${actualWidth}x${levelHeight + yOffset}`);
        scene.physics.world.setBounds(0, 0, actualWidth, levelHeight + yOffset);
        scene.cameras.main.setBounds(0, 0, actualWidth, levelHeight + yOffset);
        // Camera follow was already set up earlier to allow background scrolling during tile loading
        // Just ensure it's still active (don't call startFollow again as it may reset)

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
    updateBackground() {
        if (!this.currentScene) {
            console.warn('Game: Cannot update background - no scene available');
            return;
        }
        
        const scene = this.currentScene;
        const locationBg = window.locationBackground || localStorage.getItem('location_background');
        
        if (!locationBg) {
            console.log('Game: updateBackground called but no background available yet');
            return;
        }
        
        // Check if background is already loaded
        if (this.backgroundSprites && this.backgroundSprites.length > 0) {
            console.log('Game: Background already loaded, skipping update');
            return;
        }
        
        console.log('Game: Updating background - background became available after game start');
        
        // Re-run the background setup code
        // Get level dimensions
        const levelData = window.LEVELS ? window.LEVELS[0] : null;
        if (!levelData) {
            console.warn('Game: Cannot update background - no level data');
            return;
        }
        
        const rows = levelData.csv.trim().split('\n');
        const tileSize = 32;
        const levelHeight = rows.length * tileSize;
        const yOffset = Math.max(0, CONFIG.GAME_HEIGHT - levelHeight);
        const maxCols = Math.max(...rows.map(r => r.length));
        const actualWidth = maxCols * tileSize;
        const canvasHeight = levelHeight + yOffset;
        
        // Use the same background setup logic from generateLevelFromCSV
        // This is a simplified version that just sets up the background sprites
        try {
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
            
            const bgKey = 'location_background_texture';
            if (!scene.textures.exists(bgKey)) {
                scene.textures.addBase64(bgKey, locationBg);
            }
            
            // Wait a bit for texture to load, then set up sprites
            setTimeout(() => {
                if (!scene.textures.exists(bgKey)) {
                    console.warn('Game: Background texture not ready after update');
                    return;
                }
                
                const texture = scene.textures.get(bgKey);
                if (!texture || !texture.source || texture.source.length === 0) {
                    console.warn('Game: Background texture source not available');
                    return;
                }
                
                const source = texture.source[0];
                const actualBgWidth = source.width;
                const actualBgHeight = source.height;
                const frameWidth = actualBgWidth >= 51200 ? actualBgWidth / 4 : actualBgWidth;
                const isAnimated = actualBgWidth >= 51200;
                
                // Create sprite sheet if animated
                if (isAnimated && !scene.textures.exists('bg_spritesheet')) {
                    scene.textures.addSpriteSheet('bg_spritesheet', source.image, {
                        frameWidth: frameWidth,
                        frameHeight: actualBgHeight,
                        startFrame: 0,
                        endFrame: 3
                    });
                }
                
                // Create animation
                let animSpeed = 8;
                if (weatherMeta && weatherMeta.timeWeather) {
                    const weather = weatherMeta.timeWeather;
                    if (weather.season === 'winter' || weather.timeOfDay === 'night') {
                        animSpeed = 6;
                    } else if (weather.season === 'spring' || weather.season === 'summer') {
                        animSpeed = 10;
                    }
                }
                
                if (isAnimated && scene.textures.exists('bg_spritesheet') && !scene.anims.exists('bg_animate')) {
                    scene.anims.create({
                        key: 'bg_animate',
                        frames: scene.anims.generateFrameNumbers('bg_spritesheet', { start: 0, end: 3 }),
                        frameRate: animSpeed,
                        repeat: -1
                    });
                }
                
                // Create background sprites
                const bgTileWidth = frameWidth;
                const bgTileHeight = actualBgHeight;
                const tilesNeeded = Math.ceil(actualWidth / bgTileWidth);
                const scaleY = canvasHeight / bgTileHeight;
                
                if (!this.backgroundSprites) {
                    this.backgroundSprites = [];
                }
                
                this.backgroundSprites.forEach(sprite => {
                    if (sprite && sprite.active) {
                        sprite.destroy();
                    }
                });
                this.backgroundSprites = [];
                
                const spriteKey = isAnimated ? 'bg_spritesheet' : bgKey;
                
                for (let i = 0; i < tilesNeeded; i++) {
                    const bgSprite = isAnimated 
                        ? scene.add.sprite(i * bgTileWidth, 0, spriteKey, 0)
                        : scene.add.image(i * bgTileWidth, 0, spriteKey);
                    
                    bgSprite.setOrigin(0, 0);
                    bgSprite.setDisplaySize(bgTileWidth, bgTileHeight * scaleY);
                    bgSprite.setDepth(-10);
                    bgSprite.setScrollFactor(1, 1);
                    bgSprite.setVisible(true);
                    bgSprite.setAlpha(1.0);
                    
                    if (isAnimated && scene.anims.exists('bg_animate')) {
                        bgSprite.play('bg_animate');
                    }
                    
                    this.backgroundSprites.push(bgSprite);
                }
                
                console.log(`Game: Background updated successfully (${tilesNeeded} tiles, ${isAnimated ? 'animated' : 'static'})`);
            }, 100);
        } catch (error) {
            console.error('Game: Error updating background:', error);
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
            const collectible = this.collectibles.create(pos.x * 64, pos.y * 64, 'platform');
            collectible.setTint(0xffff00);
            collectible.setScale(0.3);
            collectible.body.setSize(20, 20);
        });

        scene.physics.add.overlap(this.player, this.collectibles, this.collectItem, null, this);
    }

    createEnemiesFromLevel(scene) {
        this.enemies = scene.physics.add.group();

        this.levelData.enemies.forEach(enemyData => {
            const enemy = this.enemies.create(enemyData.x * 64, enemyData.y * 64, 'enemies', 0); 
            enemy.body.setSize(40, 40); 
            enemy.body.setOffset(12, 24); 
            enemy.setVelocityX(enemyData.type === 'moving' ? -80 : 0);
            enemy.setCollideWorldBounds(true);
            enemy.setBounce(1, 0);
        });

        scene.physics.add.collider(this.enemies, this.platforms);
        scene.physics.add.overlap(this.player, this.enemies, this.hitEnemy, null, this);
    }

    createAnimations(scene) {
        // Only if not exists
        if (scene.anims.exists('walk-right')) return;
        
        // Player animations
        // Walking right
        scene.anims.create({
            key: 'walk-right',
            frames: scene.anims.generateFrameNumbers('playerSprite', { start: 0, end: 3 }),
            frameRate: 10,
            repeat: -1
        });

        // Walking left
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
        // Cat.png: 870x674 pixels, 6 columns x 6 rows
        // Frame size: 870/6 = 145px wide, 674/6 ≈ 112px tall
        // Row 0 (frames 0-5): Idle - 6 frames
        scene.anims.create({
            key: 'cat-idle',
            frames: scene.anims.generateFrameNumbers('cat', { start: 0, end: 5 }),
            frameRate: 8,
            repeat: -1
        });

        // Row 1 (frames 6-11): Walk Right - 6 frames
        scene.anims.create({
            key: 'cat-walk-right',
            frames: scene.anims.generateFrameNumbers('cat', { start: 6, end: 11 }),
            frameRate: 10,
            repeat: -1
        });

        // Row 2 (frames 12-17): Walk Left - 6 frames
        scene.anims.create({
            key: 'cat-walk-left',
            frames: scene.anims.generateFrameNumbers('cat', { start: 12, end: 17 }),
            frameRate: 10,
            repeat: -1
        });

        // Row 3 (frames 18-23): Attack Right - 6 frames
        scene.anims.create({
            key: 'cat-attack-right',
            frames: scene.anims.generateFrameNumbers('cat', { start: 18, end: 23 }),
            frameRate: 12,
            repeat: 0
        });

        // Row 4 (frames 24-29): Attack Left - 6 frames
        scene.anims.create({
            key: 'cat-attack-left',
            frames: scene.anims.generateFrameNumbers('cat', { start: 24, end: 29 }),
            frameRate: 12,
            repeat: 0
        });

        // Row 5 (frames 30-35): Death - 6 frames
        scene.anims.create({
            key: 'cat-death',
            frames: scene.anims.generateFrameNumbers('cat', { start: 30, end: 35 }),
            frameRate: 10,
            repeat: 0
        });

        // Set default animation
        if (this.player) this.player.anims.play('idle');
    }

    createEnemies(scene) {
        this.enemies = scene.physics.add.group();

        // Create enemies on platforms using the sprite
        // Enemy 1
        const enemy1 = this.enemies.create(550, 350, 'enemies', 0);
        enemy1.body.setSize(40, 40);
        enemy1.body.setOffset(12, 24);
        enemy1.setVelocityX(-80);
        enemy1.setCollideWorldBounds(true);
        enemy1.setBounce(1, 0);

        // Enemy 2
        const enemy2 = this.enemies.create(150, 200, 'enemies', 2); 
        enemy2.body.setSize(40, 40);
        enemy2.body.setOffset(12, 24);
        enemy2.setVelocityX(80);
        enemy2.setCollideWorldBounds(true);
        enemy2.setBounce(1, 0);

        // Collision with platforms
        scene.physics.add.collider(this.enemies, this.platforms);
        
        // Collision with player
        scene.physics.add.overlap(this.player, this.enemies, this.hitEnemy, null, this);
    }

    createCollectibles(scene) {
        // Create collectible graphic (coin/star)
        const collectibleGraphics = scene.add.graphics();
        collectibleGraphics.fillStyle(0xffd700);
        collectibleGraphics.fillCircle(16, 16, 12);
        collectibleGraphics.fillStyle(0xffed4e);
        collectibleGraphics.fillCircle(16, 16, 8);
        collectibleGraphics.generateTexture('collectible', 32, 32);
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
            
            // Player movement
            // Player movement
            const isOnGround = this.player.body.onFloor();
            
            if (this.cursors.left.isDown) {
                this.player.setVelocityX(-CONFIG.PLAYER_SPEED);
                if (isOnGround) {
                    this.player.anims.play('walk-left', true);
                }
                // Don't flip X if we have a specific 'walk-left' animation row
                this.player.setFlipX(false); 
            } else if (this.cursors.right.isDown) {
                this.player.setVelocityX(CONFIG.PLAYER_SPEED);
                if (isOnGround) {
                    this.player.anims.play('walk-right', true);
                }
                this.player.setFlipX(false);
            } else {
                this.player.setVelocityX(0);
                if (isOnGround) {
                    this.player.anims.play('idle', true);
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

            // Check if player fell off
            if (this.player.y > CONFIG.GAME_HEIGHT + 100) {
                this.loseLife();
            }

            // Update cat enemies
            if (this.enemies) {
                this.enemies.children.entries.forEach(cat => {
                    if (!cat || !cat.active || cat.getData('state') === 'dead') return;
                    
                    const state = cat.getData('state');
                    const direction = cat.getData('direction');
                    const attackCooldown = cat.getData('attackCooldown') || 0;
                    
                    // Update attack cooldown
                    if (attackCooldown > 0) {
                        cat.setData('attackCooldown', attackCooldown - 1);
                    }
                    
                    // Check if cat should attack (player nearby)
                    if (state === 'walking' && attackCooldown === 0 && this.player) {
                        const distance = Phaser.Math.Distance.Between(
                            cat.x, cat.y,
                            this.player.x, this.player.y
                        );
                        
                        // Attack if player is within 150 pixels
                        if (distance < 150) {
                            cat.setData('state', 'attacking');
                            cat.setVelocityX(0); // Stop moving during attack
                            const attackAnim = direction > 0 ? 'cat-attack-right' : 'cat-attack-left';
                            cat.anims.play(attackAnim);
                            
                            // Return to walking after attack animation completes
                            cat.once('animationcomplete', () => {
                                if (cat.active && cat.getData('state') === 'attacking') {
                                    cat.setData('state', 'walking');
                                    cat.setData('attackCooldown', 120); // 2 seconds cooldown at 60fps
                                    cat.setVelocityX(60 * direction);
                                    cat.anims.play(direction > 0 ? 'cat-walk-right' : 'cat-walk-left');
                                }
                            });
                        }
                    }
                    
                    // Update walking animation based on direction
                    if (state === 'walking' && cat.body.velocity.x !== 0) {
                        const currentDir = cat.body.velocity.x > 0 ? 1 : -1;
                        if (currentDir !== direction) {
                            cat.setData('direction', currentDir);
                            cat.anims.play(currentDir > 0 ? 'cat-walk-right' : 'cat-walk-left');
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
        // When cat hits a wall, turn around
        if (enemy.getData('state') === 'walking' || enemy.getData('state') === 'idle') {
            const currentDir = enemy.getData('direction');
            const newDir = -currentDir;
            enemy.setData('direction', newDir);
            enemy.setVelocityX(60 * newDir);
            enemy.anims.play(newDir > 0 ? 'cat-walk-right' : 'cat-walk-left');
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
            // Player jumped on enemy - play death animation then destroy
            enemy.setData('state', 'dying');
            enemy.setVelocityX(0);
            enemy.body.setEnable(false); // Disable physics during death
            
            // Play death animation
            enemy.anims.play('cat-death');
            
            // Destroy after animation completes
            enemy.once('animationcomplete', () => {
                if (enemy.active) {
                    enemy.setData('state', 'dead');
                    enemy.destroy();
                }
            });
            
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
                enemy.anims.play('cat-idle');
                enemy.setData('attackCooldown', 60); // 1 second stun
                
                // Return to walking after stun
                if (this.currentScene) {
                    this.currentScene.time.delayedCall(1000, () => {
                        if (enemy.active && enemy.getData('state') === 'idle') {
                            const dir = enemy.getData('direction');
                            enemy.setData('state', 'walking');
                            enemy.setVelocityX(60 * dir);
                            enemy.anims.play(dir > 0 ? 'cat-walk-right' : 'cat-walk-left');
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

// Pause button functionality
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        const pauseBtn = document.getElementById('pause-btn');
        if (pauseBtn) {
            pauseBtn.addEventListener('click', () => {
                if (window.gameInstance && window.gameInstance.game) {
                    const scene = window.gameInstance.game.scene.getScene('default');
                    const scenes = window.gameInstance.game.scene.scenes;
                    if (scenes.length > 0) {
                        const activeScene = scenes[0];
                        if (activeScene.physics.world.isPaused) {
                            activeScene.physics.resume();
                            pauseBtn.textContent = 'Pause';
                        } else {
                            activeScene.physics.pause();
                            pauseBtn.textContent = 'Resume';
                        }
                    }
                }
            });
        }
    });
}

// Export Game class to window for global access
if (typeof window !== 'undefined') {
    window.Game = Game;
}
