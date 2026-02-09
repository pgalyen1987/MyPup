import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as path from 'path';
export class VideoConverter {
    constructor() {
        this.outputOptions = [
            '-c:v libx264',
            '-pix_fmt yuv420p',
            '-movflags +faststart',
            '-vf scale=trunc(iw/2)*2:trunc(ih/2)*2'
        ];
    }
    gifToVideo(inputPath, outputPath) {
        return new Promise((resolve, reject) => {
            if (!fs.existsSync(inputPath)) {
                return reject(new Error(`Input file not found: ${inputPath}`));
            }
            console.log(`🎥 Converting GIF: ${inputPath}...`);
            ffmpeg(inputPath)
                .outputOptions(this.outputOptions)
                .save(outputPath)
                .on('end', () => {
                console.log(`✅ Conversion finished: ${outputPath}`);
                resolve(outputPath);
            })
                .on('error', (err) => {
                console.error('❌ Error converting GIF:', err.message);
                reject(err);
            });
        });
    }
    imageListToVideo(imageList, outputPath, fps = 30) {
        return new Promise((resolve, reject) => {
            if (imageList.length === 0) {
                return reject(new Error("Image list is empty"));
            }
            console.log(`🎥 Creating video from ${imageList.length} images...`);
            const listFileName = `temp_list_${Date.now()}.txt`;
            const fileContent = imageList
                .map(img => `file '${path.resolve(img)}'`)
                .join('\n');
            fs.writeFileSync(listFileName, fileContent);
            ffmpeg()
                .input(listFileName)
                .inputOptions(['-f concat', '-safe 0'])
                .outputOptions([
                ...this.outputOptions,
                `-r ${fps}`
            ])
                .save(outputPath)
                .on('end', () => {
                try {
                    if (fs.existsSync(listFileName))
                        fs.unlinkSync(listFileName);
                }
                catch (e) {
                    console.warn("Could not delete temp file");
                }
                console.log(`✅ Video created: ${outputPath}`);
                resolve(outputPath);
            })
                .on('error', (err) => {
                if (fs.existsSync(listFileName))
                    fs.unlinkSync(listFileName);
                console.error('❌ Error creating video:', err.message);
                reject(err);
            });
        });
    }
    patternToVideo(inputPattern, outputPath, fps = 30) {
        return new Promise((resolve, reject) => {
            console.log(`🎥 Converting sequence ${inputPattern} to video...`);
            ffmpeg(inputPattern)
                .inputOptions([`-framerate ${fps}`])
                .outputOptions(this.outputOptions)
                .save(outputPath)
                .on('end', () => {
                console.log(`✅ Video created: ${outputPath}`);
                resolve(outputPath);
            })
                .on('error', (err) => {
                console.error('❌ Error converting sequence:', err.message);
                reject(err);
            });
        });
    }
}
