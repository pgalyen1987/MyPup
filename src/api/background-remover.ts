/**
 * background-remover.ts - Green screen background removal
 */

import { RGB } from './types.js';
import { ImageUtils } from './image-utils.js';
import { ColorUtils } from './color-utils.js';

export const BackgroundRemover = {
    async remove(base64Image: string): Promise<string> {
        const img = await ImageUtils.loadImage(base64Image);
        const { canvas, ctx } = ImageUtils.createCanvas(img.width, img.height, img);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        const { width, height } = canvas;

        const samples = ColorUtils.sampleEdgePixels(data, width, height);
        const bgColor = ColorUtils.detectBackgroundColor(samples);

        const removedFlood = this._floodFill(data, width, height, bgColor);
        console.log(`Flood fill removed ${removedFlood} pixels`);

        const removedSweep = this._sweepPass(data, width, height, bgColor);
        console.log(`Sweep pass removed ${removedSweep} more pixels`);

        ctx.putImageData(imgData, 0, 0);
        return canvas.toDataURL('image/png');
    },

    _floodFill(data: Uint8ClampedArray, width: number, height: number, bgColor: RGB): number {
        const visited = new Uint8Array(width * height);
        const stack: Array<{ x: number; y: number }> = [
            { x: 0, y: 0 },
            { x: width - 1, y: 0 },
            { x: 0, y: height - 1 },
            { x: width - 1, y: height - 1 }
        ];

        let removed = 0;

        while (stack.length > 0) {
            const pos = stack.pop()!;
            const { x, y } = pos;
            if (x < 0 || x >= width || y < 0 || y >= height) continue;

            const idx = y * width + x;
            if (visited[idx]) continue;
            visited[idx] = 1;

            const i = idx * 4;
            const color: RGB = { r: data[i], g: data[i + 1], b: data[i + 2] };

            if (ColorUtils.isBackgroundColor(color, bgColor) || ColorUtils.isPureGreen(color)) {
                data[i + 3] = 0;
                removed++;
                stack.push({ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 });
            }
        }

        return removed;
    },

    _sweepPass(data: Uint8ClampedArray, width: number, height: number, bgColor: RGB): number {
        let removed = 0;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = (y * width + x) * 4;
                if (data[i + 3] === 0) continue;

                const color: RGB = { r: data[i], g: data[i + 1], b: data[i + 2] };

                if (ColorUtils.isBackgroundColor(color, bgColor) || ColorUtils.isPureGreen(color)) {
                    data[i + 3] = 0;
                    removed++;
                }
            }
        }

        return removed;
    },
};