import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { logger } from "../logger/logger.js";

export interface PreprocessedImages {
  original: string;              // Resized & rotated original
  grayscaleNormalized: string;   // Grayscale and normalized contrast
  sharpened: string;             // Grayscale + normalized + sharpened text
  thresholded: string;           // Grayscale + normalized + adaptive-like binary threshold
  tempPaths: string[];           // List of all paths for cleanup
}

/**
 * Preprocesses a receipt image to optimize OCR and AI extraction accuracy.
 * Generates multiple contrast-adjusted and thresholded variants.
 */
export async function preprocessReceiptImage(imagePath: string): Promise<PreprocessedImages> {
  logger.info(`🖼️ Preprocessing receipt image: ${imagePath}`);
  
  const tempPaths: string[] = [];
  
  try {
    const ext = path.extname(imagePath).toLowerCase();
    const basename = path.basename(imagePath, ext);
    const uploadsDir = path.dirname(imagePath);
    const tmpDir = path.join(uploadsDir, "tmp");
    
    // Ensure tmp directory exists
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    // Initialize sharp pipeline with auto-rotation (using EXIF metadata)
    const pipeline = sharp(imagePath).rotate();
    const metadata = await pipeline.metadata();
    
    let resizePipeline = pipeline;
    const width = metadata.width || 0;
    const height = metadata.height || 0;
    const longEdge = Math.max(width, height);
    const maxLongEdge = 2000;
    
    // Resize image if it exceeds the max long edge, maintaining aspect ratio
    if (longEdge > maxLongEdge) {
      logger.info(`📐 Resizing image from ${width}x${height} (long edge: ${longEdge}px) to max ${maxLongEdge}px`);
      if (width >= height) {
        resizePipeline = pipeline.resize({ width: maxLongEdge });
      } else {
        resizePipeline = pipeline.resize({ height: maxLongEdge });
      }
    }

    // 1. Resized Original
    const origPath = path.join(tmpDir, `orig_${basename}.jpg`);
    await resizePipeline
      .clone()
      .jpeg({ quality: 90, chromaSubsampling: "4:4:4" })
      .toFile(origPath);
    tempPaths.push(origPath);

    // 2. Grayscale & Normalized (contrast stretch)
    const grayPath = path.join(tmpDir, `gray_${basename}.jpg`);
    await sharp(origPath)
      .grayscale()
      .normalize()
      .jpeg({ quality: 90 })
      .toFile(grayPath);
    tempPaths.push(grayPath);

    // 3. Sharpened (grayscale + normalized + sharpen filter)
    const sharpPath = path.join(tmpDir, `sharp_${basename}.jpg`);
    await sharp(grayPath)
      .sharpen({ sigma: 1.5, m1: 0.5, m2: 10 })
      .jpeg({ quality: 90 })
      .toFile(sharpPath);
    tempPaths.push(sharpPath);

    // 4. Thresholded (grayscale + normalized + binary threshold)
    const thresholdPath = path.join(tmpDir, `thresh_${basename}.jpg`);
    // Threshold value: pixels below 140 become black, above become white
    await sharp(grayPath)
      .threshold(140)
      .jpeg({ quality: 90 })
      .toFile(thresholdPath);
    tempPaths.push(thresholdPath);

    logger.info(`✨ Successfully created 4 preprocessed image variants in ${tmpDir}`);

    return {
      original: origPath,
      grayscaleNormalized: grayPath,
      sharpened: sharpPath,
      thresholded: thresholdPath,
      tempPaths
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`❌ Failed to preprocess image: ${msg}. Falling back to original image path.`);
    
    // Return original image path for all variants as a fallback
    return {
      original: imagePath,
      grayscaleNormalized: imagePath,
      sharpened: imagePath,
      thresholded: imagePath,
      tempPaths: []
    };
  }
}

/**
 * Cleans up temporary image files created during preprocessing.
 */
export async function cleanupTempImages(paths: string[]): Promise<void> {
  if (!paths || paths.length === 0) return;
  
  logger.info(`🧹 Cleaning up ${paths.length} temporary preprocessed images...`);
  for (const p of paths) {
    try {
      if (fs.existsSync(p)) {
        fs.unlinkSync(p);
      }
    } catch (e) {
      logger.warn(`⚠️ Failed to delete temporary image ${p}:`, e);
    }
  }
}
