import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { processProductImage, ImageError, MAX_DIMENSION } from "@/lib/images";

async function makePng(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 120, b: 40 } },
  })
    .png()
    .toBuffer();
}

describe("processProductImage", () => {
  it("downscales a large photo to WebP within the max dimension", async () => {
    const input = await makePng(2400, 1600);
    const out = await processProductImage(input);
    expect(out.contentType).toBe("image/webp");
    expect(out.ext).toBe("webp");
    expect(Math.max(out.width, out.height)).toBeLessThanOrEqual(MAX_DIMENSION);
    // aspect ratio preserved (3:2)
    expect(out.width).toBe(1200);
    expect(out.height).toBe(800);
    // and it's a real webp
    const meta = await sharp(out.buffer).metadata();
    expect(meta.format).toBe("webp");
  });

  it("never upscales a small image", async () => {
    const input = await makePng(300, 200);
    const out = await processProductImage(input);
    expect(out.width).toBe(300);
    expect(out.height).toBe(200);
  });

  it("rejects a non-image buffer", async () => {
    await expect(processProductImage(Buffer.from("this is not an image"))).rejects.toBeInstanceOf(
      ImageError
    );
  });

  it("rejects an empty file", async () => {
    await expect(processProductImage(Buffer.alloc(0))).rejects.toBeInstanceOf(ImageError);
  });
});
