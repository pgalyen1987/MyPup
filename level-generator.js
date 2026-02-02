// Level generator using Gemini to analyze tilesheet and create park-themed levels

class LevelGenerator {
    constructor(apiService) {
        this.apiService = apiService;
        // Tilesheet path removed - using AI-generated tiles only
        this.tileSize = CONFIG.TILE_SIZE; // Use universal tile size from config
    }

    /**
     * Analyze the tilesheet image to identify available tiles
     */
    async analyzeTilesheet() {
        try {
            // Convert image to base64
            const imageBase64 = await this.imageToBase64(this.tilesheetPath);
            
            // Use Gemini to analyze the tilesheet
            const response = await fetch(
                `${CONFIG.GEMINI_API_URL}?key=${CONFIG.GEMINI_API_KEY}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{
                                text: `Analyze this game tilesheet image in detail. This is a park-themed tileset for a 16-bit platformer game.

Please identify and describe:
1. All ground/platform tiles (grass, dirt, stone, etc.)
2. Background elements (trees, clouds, sky, etc.)
3. Decorative elements (flowers, bushes, benches, etc.)
4. Interactive elements (collectibles, obstacles, etc.)
5. The tile grid layout (how many tiles per row/column, tile size)
6. Which tiles are solid/collidable vs decorative
7. Any animated tiles or special tiles

For each tile type, provide:
- Position in the tilesheet (row, column, or tile index)
- Description of what it represents
- Whether it's solid (collidable) or decorative
- Suggested usage in a park level

Format your response as a JSON object with this structure:
{
  "tileSize": ${CONFIG.TILE_SIZE},
  "tilesPerRow": 8,
  "tilesPerColumn": 8,
  "tiles": [
    {
      "index": 0,
      "row": 0,
      "col": 0,
      "type": "ground",
      "description": "grass tile",
      "solid": true,
      "usage": "ground/platform"
    }
  ],
  "backgroundTiles": [],
  "decorativeTiles": []
}`
                            }, {
                                inline_data: {
                                    mime_type: "image/png",
                                    data: imageBase64.split(',')[1]
                                }
                            }]
                        }]
                    })
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                const apiService = new APIService();
                const errorInfo = apiService.parseApiError(errorText, response.status);
                throw errorInfo;
            }

            const data = await response.json();
            const analysis = data.candidates[0].content.parts[0].text;
            
            // Try to parse JSON from the response
            const jsonMatch = analysis.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            
            // If no JSON, return the text analysis
            return { analysis: analysis, raw: true };
        } catch (error) {
            console.error('Error analyzing tilesheet:', error);
            throw error;
        }
    }

    /**
     * Generate a level map based on tilesheet analysis
     */
    async generateLevelMap(tilesheetData) {
        try {
            const prompt = `Based on this tilesheet analysis for a park-themed platformer:

${JSON.stringify(tilesheetData, null, 2)}

Generate a fun, challenging park-themed level map. The level should be 25 tiles wide and 15 tiles tall (${25 * CONFIG.TILE_SIZE}x${15 * CONFIG.TILE_SIZE} pixels at ${CONFIG.TILE_SIZE}px per tile).

Requirements:
- Park theme with grass, trees, benches, paths
- Multiple platforms at different heights
- Safe starting area for the player
- Collectibles placed strategically
- Enemies on platforms
- Background elements (trees, clouds) in upper layers
- A clear path from start to end

IMPORTANT COLLISION RULES:
- "ground" layer tiles MUST have collision boxes (player can stand on them)
- "background" layer tiles are visual only (NO collision)
- "decorative" layer tiles are visual only (NO collision)
- Only ground/platform tiles should be in the "ground" layer
- All ground tiles will get ${CONFIG.TILE_SIZE}x${CONFIG.TILE_SIZE} pixel collision boxes

Return a JSON object with this structure:
{
  "width": 25,
  "height": 15,
  "layers": {
    "background": [
      [tile indices for background layer - NO COLLISION, visual only]
    ],
    "ground": [
      [tile indices for ground/platform layer - WITH COLLISION BOXES]
    ],
    "decorative": [
      [tile indices for decorative elements - NO COLLISION, visual only]
    ]
  },
  "spawn": {"x": 2, "y": 10},
  "collectibles": [{"x": 5, "y": 8}, ...],
  "enemies": [{"x": 10, "y": 6, "type": "moving"}, ...]
}

Use tile indices from the tilesheet. Use -1 for empty tiles.
Make sure ground layer contains only solid, walkable tiles (grass, dirt, stone paths, etc.).`;

            const response = await fetch(
                `${CONFIG.GEMINI_API_URL}?key=${CONFIG.GEMINI_API_KEY}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{
                                text: prompt
                            }]
                        }]
                    })
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                const apiService = new APIService();
                const errorInfo = apiService.parseApiError(errorText, response.status);
                throw errorInfo;
            }

            const data = await response.json();
            const levelText = data.candidates[0].content.parts[0].text;
            
            // Extract JSON from response
            const jsonMatch = levelText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            
            throw new Error('Could not parse level map from response');
        } catch (error) {
            console.error('Error generating level map:', error);
            throw error;
        }
    }

    /**
     * Convert image file to base64
     */
    async imageToBase64(imagePath) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = reject;
            img.src = imagePath;
        });
    }
}

// Export for use in other files
if (typeof window !== 'undefined') {
    window.LevelGenerator = LevelGenerator;
}
