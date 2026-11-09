import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import { optimizeImage, readImageLimits } from "../eleventy-plugins/images.js";

const LIMITS = { maxBytes: 1_000_000, maxDimension: 100, quality: 60 };

const makeImage = async (dir, name, size) => {
    const file = path.join(dir, name);
    await sharp({ create: { width: size, height: size, channels: 3, background: "#336699" } }).png().toFile(file);
    return file;
};

test("reads limits from environment with defaults", () => {
    assert.deepEqual(readImageLimits({}), { maxBytes: 512000, maxDimension: 1600, quality: 75 });
    assert.deepEqual(
        readImageLimits({ IMAGE_MAX_BYTES: "10", IMAGE_MAX_DIMENSION: "20", IMAGE_QUALITY: "30" }),
        { maxBytes: 10, maxDimension: 20, quality: 30 }
    );
});

test("downsizes images exceeding the dimension limit", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "img-"));
    const src = await makeImage(dir, "big.png", 300);
    const dest = path.join(dir, "out", "big.png");

    await optimizeImage(src, dest, LIMITS);

    const meta = await sharp(dest).metadata();
    assert.equal(Math.max(meta.width, meta.height), 100);
});

test("copies images within limits unchanged", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "img-"));
    const src = await makeImage(dir, "small.png", 50);
    const dest = path.join(dir, "out", "small.png");

    await optimizeImage(src, dest, LIMITS);

    assert.deepEqual(await fs.readFile(dest), await fs.readFile(src));
});

test("recompresses images exceeding the byte limit", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "img-"));
    const src = path.join(dir, "noisy.png");
    const noise = Buffer.alloc(80 * 80 * 3);
    for (let i = 0; i < noise.length; i++) {
        noise[i] = (i * 7919) % 256;
    }
    await sharp(noise, { raw: { width: 80, height: 80, channels: 3 } }).png().toFile(src);
    const dest = path.join(dir, "out", "noisy.png");
    const originalSize = (await fs.stat(src)).size;

    await optimizeImage(src, dest, { ...LIMITS, maxBytes: originalSize - 1 });

    assert.ok((await fs.stat(dest)).size < originalSize);
});
