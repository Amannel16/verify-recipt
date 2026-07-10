import fs from "node:fs";
import path from "node:path";
import { createId } from "@paralleldrive/cuid2";
import multer, { type Multer } from "multer";

export const UPLOAD_DIR = path.join(process.cwd(), "uploads");

export const upload = (filePath: string): Multer => {
  const DIR = path.join(UPLOAD_DIR, `/${filePath}`);

  if (!fs.existsSync(DIR)) {
    fs.mkdirSync(DIR, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, DIR);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      const base = path
        .basename(file.originalname, ext)
        .replace(/\s+/g, "_")
        .slice(0, 50);
      cb(null, `${base}-${createId()}${ext}`);
    },
  });

  return multer({
    storage,
    limits: { fileSize: 250 * 1024 * 1024, fieldSize: 10 * 1024 * 1024 },
  });
};

export const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});
