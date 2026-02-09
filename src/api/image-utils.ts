/**
 * image-utils.ts - Image manipulation utilities
 */

export const ImageUtils = {
    loadImage(base64: string): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Image load failed'));
            img.src = base64;
        });
    },

    createCanvas(width: number, height: number, img?: HTMLImageElement): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get canvas context');
        if (img) ctx.drawImage(img, 0, 0);
        return { canvas, ctx };
    },

    extractBase64Data(dataUrl: string): { data: string; mimeType: string } {
        if (dataUrl.includes(',')) {
            const parts = dataUrl.split(',');
            const mimeMatch = parts[0].match(/data:([^;]+)/);
            return {
                data: parts[1],
                mimeType: mimeMatch?.[1] || 'image/png'
            };
        }
        return { data: dataUrl, mimeType: 'image/png' };
    },

    async resizeToExact(base64: string, width: number, height: number): Promise<string> {
        const img = await this.loadImage(base64);
        if (img.width === width && img.height === height) {
            return base64;
        }
        const { canvas, ctx } = this.createCanvas(width, height);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, width, height);
        return canvas.toDataURL('image/png', 1.0);
    },

    async resizeMax(base64: string, maxWidth: number, maxHeight: number): Promise<string> {
        const img = await this.loadImage(base64);
        let { width, height } = img;
        if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
        }
        if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
        }
        const { canvas, ctx } = this.createCanvas(width, height);
        ctx.drawImage(img, 0, 0, width, height);
        return canvas.toDataURL('image/png', 0.8);
    },

    async validate(base64: string, frameNumber: number, stage: string): Promise<void> {
        try {
            const img = await this.loadImage(base64);
            const { canvas, ctx } = this.createCanvas(img.width, img.height, img);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

            let blackPixels = 0;
            let totalBrightness = 0;
            const totalPixels = canvas.width * canvas.height;

            for (let i = 0; i < imageData.length; i += 4) {
                const r = imageData[i];
                const g = imageData[i + 1];
                const b = imageData[i + 2];
                const a = imageData[i + 3];
                totalBrightness += (r + g + b) / 3;
                if (r < 10 && g < 10 && b < 10 && a > 0) blackPixels++;
            }

            const blackPercent = (blackPixels / totalPixels) * 100;
            const avgBrightness = (totalBrightness / totalPixels / 255) * 100;

            console.log(`API: Frame ${frameNumber} (${stage}) - Black: ${blackPercent.toFixed(1)}%, Brightness: ${avgBrightness.toFixed(1)}%`);
        } catch (e) {
            console.warn(`API: Failed to validate frame ${frameNumber}`);
        }
    },

    async combineFrames(frames: string[], frameWidth: number, frameHeight: number): Promise<string> {
        const canvas = document.createElement('canvas');
        canvas.width = frameWidth * frames.length;
        canvas.height = frameHeight;
        const ctx = canvas.getContext('2d')!;
        ctx.imageSmoothingEnabled = false;

        for (let i = 0; i < frames.length; i++) {
            const img = await this.loadImage(frames[i]);
            ctx.drawImage(img, i * frameWidth, 0, frameWidth, frameHeight);
        }

        console.log(`Combined ${frames.length} frames into ${canvas.width}x${canvas.height} spritesheet`);
        return canvas.toDataURL('image/png');
    },
};