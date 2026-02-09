export const ImageUtils = {
    loadImage(base64) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Image load failed'));
            img.src = base64;
        });
    },
    createCanvas(width, height, img) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx)
            throw new Error('Could not get canvas context');
        if (img)
            ctx.drawImage(img, 0, 0);
        return { canvas, ctx };
    },
    extractBase64Data(dataUrl) {
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
    async resizeToExact(base64, width, height) {
        const img = await this.loadImage(base64);
        if (img.width === width && img.height === height) {
            return base64;
        }
        const { canvas, ctx } = this.createCanvas(width, height);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, width, height);
        return canvas.toDataURL('image/png', 1.0);
    },
    async resizeMax(base64, maxWidth, maxHeight) {
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
    async compressForCache(base64, options = {}) {
        const { maxWidth = 512, maxHeight = 512, quality = 0.7, preserveTransparency = true } = options;
        const img = await this.loadImage(base64);
        let width = img.width;
        let height = img.height;
        if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
        }
        const { canvas, ctx } = this.createCanvas(width, height);
        ctx.imageSmoothingEnabled = !preserveTransparency;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        if (preserveTransparency) {
            return canvas.toDataURL('image/png');
        }
        else {
            return canvas.toDataURL('image/jpeg', quality);
        }
    },
    async compressSpriteForCache(base64) {
        return this.compressForCache(base64, {
            maxWidth: 256,
            maxHeight: 256,
            preserveTransparency: true
        });
    },
    async compressBackgroundForCache(base64) {
        return this.compressForCache(base64, {
            maxWidth: 512,
            maxHeight: 512,
            quality: 0.6,
            preserveTransparency: false
        });
    },
    async validate(base64, frameNumber, stage) {
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
                if (r < 10 && g < 10 && b < 10 && a > 0)
                    blackPixels++;
            }
            const blackPercent = (blackPixels / totalPixels) * 100;
            const avgBrightness = (totalBrightness / totalPixels / 255) * 100;
            console.log(`API: Frame ${frameNumber} (${stage}) - Black: ${blackPercent.toFixed(1)}%, Brightness: ${avgBrightness.toFixed(1)}%`);
        }
        catch (e) {
            console.warn(`API: Failed to validate frame ${frameNumber}`);
        }
    },
    async combineFrames(frames, frameWidth, frameHeight) {
        const canvas = document.createElement('canvas');
        canvas.width = frameWidth * frames.length;
        canvas.height = frameHeight;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        for (let i = 0; i < frames.length; i++) {
            const img = await this.loadImage(frames[i]);
            ctx.drawImage(img, i * frameWidth, 0, frameWidth, frameHeight);
        }
        console.log(`Combined ${frames.length} frames into ${canvas.width}x${canvas.height} spritesheet`);
        return canvas.toDataURL('image/png');
    },
    getBase64Size(base64) {
        const data = base64.includes(',') ? base64.split(',')[1] : base64;
        return Math.round((data.length * 3) / 4);
    },
    formatBytes(bytes) {
        if (bytes < 1024)
            return `${bytes} B`;
        if (bytes < 1024 * 1024)
            return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
    },
};
