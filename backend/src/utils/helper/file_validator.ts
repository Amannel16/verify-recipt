import { fileTypeFromFile } from "file-type";
import fs from "node:fs";
import { logger } from "../logger/logger.js";

export const validateFileType = async (
  filePath: string,
  allowedMimeTypes: string[],
): Promise<boolean> => {
  try {
    const result = await fileTypeFromFile(filePath);
    logger.info(`File type: ${JSON.stringify(result)}. PATH: ${filePath}`);

    if (!result) {
      if (
        filePath.toLowerCase().endsWith(".svg") &&
        allowedMimeTypes.includes("image/svg+xml")
      ) {
        try {
          // Read a chunk to verify if it contains <svg
          const fd = await fs.promises.open(filePath, "r");
          const buffer = Buffer.alloc(1024);
          await fd.read(buffer, 0, 1024, 0);
          await fd.close();
          const content = buffer.toString("utf-8");
          if (content.includes("<svg")) {
            return true;
          }
        } catch (error) {
          logger.error("Error validating file type:", error);
          return false;
        }
      }
      return false;
    }

    let mime = result.mime;

    // Normalize some video types
    if (mime === "video/matroska") mime = "video/x-matroska";
    if (mime === "video/x-msvideo") mime = "video/avi"; // .avi fallback

    return allowedMimeTypes.includes(mime);
  } catch (error) {
    logger.error("Error validating file type:", error);
    return false;
  }
};

export const safeDeleteFile = async (filePath: string): Promise<void> => {
  try {
    await fs.promises.unlink(filePath);
  } catch (err) {
    logger.error("Error deleting file:", err);
  }
};
