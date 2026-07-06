import { logger } from "../logger/logger.js";

/**
 * Decodes a QR code from an image file.
 * Returns the decoded string/URL or null if no QR code is found or fails.
 */
export async function decodeQrCode(imagePath: string): Promise<string | null> {
  try {
    logger.info(`🔍 Checking receipt for QR code: ${imagePath}`);

    // Dynamically import Jimp and jsQR (resilient to ESM/CJS formats)
    const JimpModule = await import("jimp");
    const Jimp = JimpModule.default || JimpModule;

    const jsQRModule = await import("jsqr");
    const jsQR = jsQRModule.default || jsQRModule;

    // Load the image
    const image = await Jimp.read(imagePath);
    const { data, width, height } = image.bitmap;

    // Decode QR code from RGBA pixel data
    const code = jsQR(new Uint8ClampedArray(data), width, height);

    if (code && code.data) {
      logger.info(`✅ Decoded QR Code successfully: ${code.data}`);
      return code.data.trim();
    }

    logger.info("ℹ️ No QR Code found in the image.");
    return null;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.warn(`⚠️ QR Code decoding skipped/failed: ${msg}`);
    return null;
  }
}
