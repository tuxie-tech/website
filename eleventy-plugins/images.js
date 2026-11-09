import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const DEFAULT_MAX_BYTES = 512000;
const DEFAULT_MAX_DIMENSION = 1600;
const DEFAULT_QUALITY = 75;
const OPTIMIZABLE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);

// Keyed by target so rescanning on rebuilds replaces entries instead of duplicating them.
const queue = new Map();

const readNumber = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const readImageLimits = (env = process.env) => ({
    maxBytes: readNumber(env.IMAGE_MAX_BYTES, DEFAULT_MAX_BYTES),
    maxDimension: readNumber(env.IMAGE_MAX_DIMENSION, DEFAULT_MAX_DIMENSION),
    quality: readNumber(env.IMAGE_QUALITY, DEFAULT_QUALITY),
});

export const isOptimizable = (file) => OPTIMIZABLE_EXTENSIONS.has(path.extname(file).toLowerCase());

// Queues a source image to be written to `target` (relative to the output dir) at build end.
export const queueImage = (src, target) => {
    queue.set(target, src);
};

// Re-encodes in the source's own format so existing references keep working.
const encode = (pipeline, extension, quality) => {
    switch (extension) {
        case ".jpg":
        case ".jpeg":
            return pipeline.jpeg({ quality, mozjpeg: true });
        case ".webp":
            return pipeline.webp({ quality });
        case ".avif":
            return pipeline.avif({ quality });
        default:
            return pipeline.png({ palette: true, quality, compressionLevel: 9 });
    }
};

export const optimizeImage = async (src, dest, limits = readImageLimits()) => {
    fs.mkdirSync(path.dirname(dest), { recursive: true });

    const { size } = fs.statSync(src);
    const { width = 0, height = 0 } = await sharp(src).metadata();
    const tooLarge = size > limits.maxBytes;
    const tooWide = Math.max(width, height) > limits.maxDimension;

    if (!tooLarge && !tooWide) {
        fs.copyFileSync(src, dest);
        return;
    }

    const resized = sharp(src).rotate().resize({
        width: limits.maxDimension,
        height: limits.maxDimension,
        fit: "inside",
        withoutEnlargement: true,
    });
    const output = await encode(resized, path.extname(src).toLowerCase(), limits.quality).toBuffer();

    // Never make a file bigger unless the dimensions had to shrink.
    if (!tooWide && output.length >= size) {
        fs.copyFileSync(src, dest);
        return;
    }

    fs.writeFileSync(dest, output);
};

const isFresh = (src, dest) => fs.existsSync(dest) && fs.statSync(dest).mtimeMs >= fs.statSync(src).mtimeMs;

export const processQueuedImages = async (outputDir) => {
    const limits = readImageLimits();

    for (const [target, src] of queue) {
        if (!fs.existsSync(src)) {
            continue;
        }

        const dest = path.join(outputDir, target);
        if (isFresh(src, dest)) {
            continue;
        }

        console.log(`[images] ${src} -> ${dest}`);
        await optimizeImage(src, dest, limits);
    }
};
