import { API_CONSTANTS } from './constants.js';
export const ColorUtils = {
    distance(c1, c2) {
        return Math.sqrt(Math.pow(c1.r - c2.r, 2) +
            Math.pow(c1.g - c2.g, 2) +
            Math.pow(c1.b - c2.b, 2));
    },
    isGreenish(color) {
        const { r, g, b } = color;
        const { COLOR } = API_CONSTANTS;
        const greenDominant = g > COLOR.GREEN_MIN_VALUE &&
            g > r * COLOR.GREEN_DOMINANT_MULTIPLIER &&
            g > b * COLOR.GREEN_DOMINANT_MULTIPLIER;
        const isBrightGreenish = (r + g + b) > COLOR.BRIGHTNESS_SUM_THRESHOLD &&
            g > 100 && g > r && g > b;
        const isVeryBright = (r + g + b) > COLOR.VERY_BRIGHT_THRESHOLD && g > r && g > b;
        return greenDominant || isBrightGreenish || isVeryBright;
    },
    isBackgroundColor(color, target, tolerance = API_CONSTANTS.COLOR.BACKGROUND_TOLERANCE) {
        const dist = this.distance(color, target);
        if (dist <= tolerance)
            return true;
        const { COLOR } = API_CONSTANTS;
        return color.g > COLOR.BRIGHT_GREEN_MIN &&
            color.r < COLOR.BRIGHT_GREEN_MAX_RB &&
            color.b < COLOR.BRIGHT_GREEN_MAX_RB &&
            color.g > color.r * 1.5 &&
            color.g > color.b * 1.5;
    },
    isPureGreen(color) {
        const { COLOR } = API_CONSTANTS;
        return color.g > COLOR.PURE_GREEN_MIN &&
            color.r < COLOR.PURE_GREEN_MAX_RB &&
            color.b < COLOR.PURE_GREEN_MAX_RB;
    },
    sampleEdgePixels(data, width, height) {
        const samples = [];
        const corners = [
            { x: 0, y: 0 },
            { x: width - 1, y: 0 },
            { x: 0, y: height - 1 },
            { x: width - 1, y: height - 1 }
        ];
        for (let i = 0; i < API_CONSTANTS.EDGE_SAMPLES; i++) {
            corners.push({ x: Math.floor((width / API_CONSTANTS.EDGE_SAMPLES) * i), y: 0 }, { x: Math.floor((width / API_CONSTANTS.EDGE_SAMPLES) * i), y: height - 1 }, { x: 0, y: Math.floor((height / API_CONSTANTS.EDGE_SAMPLES) * i) }, { x: width - 1, y: Math.floor((height / API_CONSTANTS.EDGE_SAMPLES) * i) });
        }
        for (const { x, y } of corners) {
            const i = (y * width + x) * 4;
            samples.push({ r: data[i], g: data[i + 1], b: data[i + 2] });
        }
        return samples;
    },
    detectBackgroundColor(samples) {
        const greenSamples = samples.filter(p => this.isGreenish(p));
        if (greenSamples.length === 0) {
            console.warn('No green samples found, using default #00ff00');
            return { r: 0, g: 255, b: 0 };
        }
        const avgR = Math.round(greenSamples.reduce((sum, p) => sum + p.r, 0) / greenSamples.length);
        const avgG = Math.round(greenSamples.reduce((sum, p) => sum + p.g, 0) / greenSamples.length);
        const avgB = Math.round(greenSamples.reduce((sum, p) => sum + p.b, 0) / greenSamples.length);
        console.log(`Detected background: RGB(${avgR}, ${avgG}, ${avgB}) from ${greenSamples.length}/${samples.length} samples`);
        return { r: avgR, g: avgG, b: avgB };
    },
};
