import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
const INPUT_FOLDER = './images';
const OUTPUT_FILE = './output_stabilized.gif';
const FPS = 2;
async function main() {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gif-stabilizer-'));
    const transformsFile = path.join(tempDir, 'transforms.trf');
    console.log('1️⃣  Preparing images...');
    if (!fs.existsSync(INPUT_FOLDER)) {
        console.error(`❌ Input folder not found: ${INPUT_FOLDER}`);
        return;
    }
    const files = fs.readdirSync(INPUT_FOLDER)
        .filter((file) => /\.(jpg|jpeg|png)$/i.test(file))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    if (files.length === 0) {
        console.error("❌ No images found in " + INPUT_FOLDER);
        return;
    }
    files.forEach((file, index) => {
        const ext = path.extname(file);
        const seqName = `img${String(index).padStart(3, '0')}${ext}`;
        fs.copyFileSync(path.join(INPUT_FOLDER, file), path.join(tempDir, seqName));
    });
    console.log(`   Found ${files.length} images.`);
    console.log('2️⃣  Analyzing shake (Pass 1)...');
    try {
        await new Promise((resolve, reject) => {
            ffmpeg()
                .input(path.join(tempDir, 'img%03d.png'))
                .inputFPS(FPS)
                .complexFilter([`vidstabdetect=stepsize=6:shakiness=8:accuracy=9:result=${transformsFile}`])
                .format('null')
                .output('-')
                .on('end', () => resolve())
                .on('error', (err) => reject(err))
                .run();
        });
    }
    catch (err) {
        console.error('❌ Error during Pass 1 (Analysis):', err);
        return;
    }
    console.log('3️⃣  Stabilizing and generating GIF (Pass 2)...');
    try {
        await new Promise((resolve, reject) => {
            ffmpeg()
                .input(path.join(tempDir, 'img%03d.png'))
                .inputFPS(FPS)
                .complexFilter([
                `vidstabtransform=input=${transformsFile}:zoom=0:smoothing=10`,
                'split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse'
            ])
                .output(OUTPUT_FILE)
                .on('end', () => resolve())
                .on('error', (err) => reject(err))
                .run();
        });
        console.log(`✅ Done! Stabilized GIF saved to: ${OUTPUT_FILE}`);
    }
    catch (err) {
        console.error('❌ Error during Pass 2 (Generation):', err);
    }
    finally {
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
        catch (e) {
            console.warn('Warning: Could not clean up temp directory.');
        }
    }
}
main().catch((err) => console.error('❌ Unexpected Error:', err));
