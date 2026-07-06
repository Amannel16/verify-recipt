import { logger } from "../logger/logger.js";

/**
 * Decodes a QR code from an image file.
 * Returns the decoded string/URL or null if no QR code is found or fails.
 * 
 * Uses a hybrid decoder approach:
 * 1. jsQR (extremely fast for standard digital screenshots)
 * 2. @zxing/library (robust for blurry, rotated, or high-noise camera photos)
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

    // --- 1. Try decoding with jsQR ---
    logger.info("  -> Attempting QR decoding with jsQR...");
    const code = jsQR(new Uint8ClampedArray(data), width, height);

    if (code && code.data) {
      const result = code.data.trim();
      logger.info(`✅ Decoded QR Code successfully via jsQR: ${result}`);
      return result;
    }

    // --- 2. Try decoding with @zxing/library (ZXing JS) ---
    logger.info("  -> jsQR found no QR code. Attempting with @zxing/library...");
    try {
      const zxing = await import("@zxing/library");
      const {
        MultiFormatReader,
        RGBLuminanceSource,
        BinaryBitmap,
        HybridBinarizer,
        DecodeHintType,
        BarcodeFormat
      } = zxing;

      // Convert Jimp RGBA pixel buffer to a 1-byte-per-pixel luminance array
      const len = width * height;
      const luminances = new Uint8ClampedArray(len);
      for (let i = 0; i < len; i++) {
        const r = data[i * 4];
        const g = data[i * 4 + 1];
        const b = data[i * 4 + 2];
        // Standard luminance weights for grayscale conversion
        luminances[i] = (0.2126 * r + 0.7152 * g + 0.0722 * b) & 0xff;
      }

      const luminanceSource = new RGBLuminanceSource(luminances, width, height);
      const binaryBitmap = new BinaryBitmap(new HybridBinarizer(luminanceSource));

      const reader = new MultiFormatReader();
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
      hints.set(DecodeHintType.TRY_HARDER, true);
      reader.setHints(hints);

      const zxingResult = reader.decode(binaryBitmap);
      const result = zxingResult.getText();

      if (result) {
        const trimmedResult = result.trim();
        logger.info(`✅ Decoded QR Code successfully via ZXing: ${trimmedResult}`);
        return trimmedResult;
      }
    } catch (zxingError: any) {
      logger.info(`ℹ️ ZXing QR decoding finished: ${zxingError.message || zxingError}`);
    }

    logger.info("ℹ️ No QR Code found in the image by either decoder.");
    return null;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.warn(`⚠️ QR Code decoding skipped/failed: ${msg}`);
    return null;
  }
}
