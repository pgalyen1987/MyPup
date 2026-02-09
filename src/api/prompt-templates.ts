/**
 * prompt-templates.ts - AI prompt templates
 */

import { LocationData, TimeWeather } from './types.js';
import { API_CONSTANTS } from './constants.js';

const enemyDescriptions: Record<string, string> = {
    cat: `A mischievous orange tabby cat with:
- Bright orange fur with darker tiger stripes
- Green eyes with a sly expression
- Pink nose and inner ears
- White chest/belly patch
- Long fluffy tail held high
- Slightly crouched, sneaky posture
- Small but fierce appearance`,

    bird: `An angry blue jay bird with:
- Vibrant blue feathers on wings and tail
- White and gray chest feathers
- Black collar marking around neck
- Sharp orange beak
- Beady black eyes with angry eyebrows
- Small crest of feathers on head
- Wings spread in flight/attack poses
- Small orange feet (tucked when flying)`,

    squirrel: `A hyperactive brown squirrel with:
- Reddish-brown fur on back
- Cream/white belly fur
- Large bushy tail curled upward
- Big round black eyes
- Small rounded ears
- Tiny pink nose
- Small paws holding pose
- Energetic, bouncy stance
- Cheeks slightly puffed`,

    mailman: `A grumpy mail carrier (human) with:
- Blue postal uniform with shorts
- Light blue button-up shirt
- Dark blue cap with small brim
- Brown leather mail bag/satchel
- White envelope in hand (for throwing)
- Sturdy brown shoes
- Stern/angry facial expression
- Mustache (optional)
- Stocky, intimidating build
- This is the BOSS enemy - make them 1.5x larger than other sprites`,
};

export const PromptTemplates = {
    dogAnalysis: `Analyze this dog image and describe its core visual traits for a 16-bit retro sprite artist.

Focus exclusively on:
- Breed/Type and Body Shape
- Primary and Secondary Colors
- Distinctive Markings (spots, patches, ear color)
- Eyes and Expressions
- Any visible accessories (collar, bandana)`,

    getEnemyDescription(enemyType: string): string {
        return enemyDescriptions[enemyType] || `A ${enemyType} enemy character`;
    },

    spriteSheet(analysis: string, tileSize: number): string {
        const spriteSheetSize = tileSize * 4;
        return `TITLE: 16-bit Retro Dog Spritesheet - EXACT ${spriteSheetSize}x${spriteSheetSize} PIXEL IMAGE (4x4 GRID, 16 FRAMES REQUIRED)

MANDATORY IMAGE SIZE - READ THIS FIRST:
- THE ENTIRE IMAGE MUST BE EXACTLY ${spriteSheetSize} PIXELS WIDE × ${spriteSheetSize} PIXELS TALL.
- DO NOT GENERATE ANY OTHER SIZE.

CHARACTER DESCRIPTION (from image analysis):
${analysis}

STYLE: SNES-era pixel art, vibrant colors, clean outlines, 16-bit aesthetic.

CRITICAL IMAGE REQUIREMENTS:
- EXACT Canvas Size: ${spriteSheetSize}x${spriteSheetSize} pixels - THIS IS MANDATORY.
- EXACT Layout: 4 rows × 4 columns = 16 frames total.
- Each frame cell: EXACTLY ${tileSize}x${tileSize} pixels.

FRAME GRID LAYOUT:
Row 1 (frames 0-3): Walk Right animation
Row 2 (frames 4-7): Walk Left animation
Row 3 (frames 8-11): Jump animation
Row 4 (frames 12-15): Idle animation

ALIGNMENT: Horizontally CENTERED, Vertically at BOTTOM (feet touching bottom edge).

CRITICAL CONSTRAINTS:
- BACKGROUND: Solid lime green (#00ff00) ONLY.
- NO shadows, NO floor, NO grid lines.
- Character must be CONSISTENT across all 16 frames.

OUTPUT: ${spriteSheetSize}×${spriteSheetSize} pixels.`;
    },

    enemySpriteSheet(enemyType: string, tileSize: number): string {
        const spriteSheetSize = tileSize * 4;
        const description = this.getEnemyDescription(enemyType);
        const isBoss = enemyType === 'mailman';

        return `TITLE: 16-bit Retro ${enemyType.toUpperCase()} Enemy Spritesheet - EXACT ${spriteSheetSize}x${spriteSheetSize} PIXEL IMAGE

MANDATORY IMAGE SIZE:
- THE ENTIRE IMAGE MUST BE EXACTLY ${spriteSheetSize} PIXELS WIDE × ${spriteSheetSize} PIXELS TALL.
- This is a 4x4 grid = 16 frames total, each frame is ${tileSize}x${tileSize} pixels.

CHARACTER DESCRIPTION:
${description}

STYLE: SNES-era 16-bit pixel art with vibrant colors, clean black outlines, subtle dithering.

FRAME LAYOUT (4 rows × 4 columns):
Row 1 (frames 0-3): Walk/Move Right animation
Row 2 (frames 4-7): Walk/Move Left animation (mirror of Row 1)
Row 3 (frames 8-11): Attack animation
Row 4 (frames 12-15): Idle animation

ALIGNMENT REQUIREMENTS:
- Every sprite CENTERED horizontally in its ${tileSize}×${tileSize} cell
- ${enemyType === 'bird' ? 'Birds should be vertically CENTERED (they fly)' : 'Feet at BOTTOM edge of each cell'}
- Character height: ${isBoss ? '90-95%' : '60-75%'} of cell height

CRITICAL CONSTRAINTS:
- BACKGROUND: Solid lime green (#00ff00) ONLY
- NO transparency, NO shadows, NO grid lines
- Character must be IDENTICAL in design across all frames (only pose changes)
- All 16 frames MUST be present

OUTPUT: Exactly ${spriteSheetSize}×${spriteSheetSize} pixels.`;
    },

    animationContext(totalFrames: number): string {
        return `ANIMATED BACKGROUND GENERATION:
You are generating ${totalFrames} separate images for an animated background.
- Animation plays at ${API_CONSTANTS.ANIMATION.FPS} fps - motion must be MINIMAL and SUBTLE.
- All frames must maintain visual consistency.
- Major structures must remain STATIC across all frames.
- Frame ${totalFrames} must loop seamlessly back to Frame 1.`;
    },

    backgroundPrompt(location: LocationData, timeWeather: TimeWeather): string {
        const weatherDesc = timeWeather.weatherReport?.description || 'clear sky';

        // Simplified prompt - less demanding on the model
        return `Write a brief 2-3 sentence description of a 16-bit SNES-style pixel art landscape for a platformer game.

    Setting: ${location.city}, ${timeWeather.season}, ${timeWeather.timeOfDay}, ${weatherDesc}.

    Include: Local landmarks or typical scenery. Must tile horizontally.
    Style: 16-bit SNES pixel art, vibrant colors.
    No fantasy elements, no text.`;
    },

    framePrompt(
        animationContext: string,
        description: string,
        frameNum: number,
        totalFrames: number,
        hasPrecipitation: boolean | undefined,
        precipitationType: string
    ): string {
        const baseRequirements = `
MANDATORY IMAGE SIZE: 1024x1024 pixels exactly.
SEAMLESS HORIZONTAL TILING required.
ANIMATION: ${API_CONSTANTS.ANIMATION.FPS} fps - motion must be MINIMAL.
All landmarks must remain STATIC.
${hasPrecipitation ? `Weather: Show ${precipitationType} falling slowly.` : ''}
OUTPUT SIZE: 1024x1024 pixels.`;

        if (frameNum === 1) {
            return `${animationContext}

A 16-bit retro pixel art landscape for a side-scrolling platformer.
Theme: ${description}
Style: SNES-era pixel art, vibrant colors, dithered shading.
${baseRequirements}
This is the first frame of an ${totalFrames}-frame animation loop.`;
        }

        const progress = ((frameNum - 1) / totalFrames * 100).toFixed(1);
        const loopNote = frameNum === totalFrames
            ? `This is the FINAL frame (${progress}%). It MUST lead perfectly back to Frame 1.`
            : `Frame ${frameNum} of ${totalFrames} (${progress}% through loop). Move clouds slightly further.`;

        return `${animationContext}

Generate frame ${frameNum} of an ${totalFrames}-frame SEAMLESS animation loop.
Two reference images provided: Frame 1 (anchor) and previous frame (continuity).

STABILITY: All landmarks must remain in EXACT same pixel positions as Frame 1.
LOOPING: ${loopNote}
${baseRequirements}`;
    },
};