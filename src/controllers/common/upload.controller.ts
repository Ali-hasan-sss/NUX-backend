import path from 'path';
import fs from 'fs';
import { Request, Response } from 'express';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { errorResponse, successResponse } from '../../utils/response';

/** Max width/height for compressed images */
const MAX_IMAGE_DIMENSION = 1920;
/** WebP quality (1-100) */
const WEBP_QUALITY = 82;

/** Directory for uploads (relative to project root). Stored files are served at /uploads/... */
const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';

/**
 * Ensure directory exists; create recursively if needed.
 */
function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Get absolute path for uploads root (project root + UPLOAD_DIR).
 */
function getUploadsRoot(): string {
  // When running from dist/, __dirname is back_end/dist/controllers/common
  const projectRoot = path.resolve(__dirname, '..', '..', '..');
  return path.join(projectRoot, UPLOAD_DIR);
}

/**
 * Build relative URL path (no domain) for stored file, e.g. /uploads/restaurants/xxx/category/yyy.webp
 */
function toRelativeUrl(relativePath: string): string {
  const normalized = relativePath.split(path.sep).join('/');
  return '/' + (normalized.startsWith(UPLOAD_DIR + '/') ? normalized : UPLOAD_DIR + '/' + normalized);
}

/**
 * @swagger
 * /api/uploadFile:
 *   post:
 *     summary: Upload a file to the server
 *     description: |
 *       Uploads an image to the server. Images are compressed (max 1920px, WebP quality 82) and stored on disk.
 *       Returns a path without domain (e.g. /uploads/...) so the client can resolve it with the current API domain.
 *     tags: [Upload]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               folder, restaurantId, entityType, entityId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Returns { url: "/uploads/...", ... }
 *       400:
 *         description: No file provided
 *       415:
 *         description: Unsupported media type
 *       500:
 *         description: Server error
 */
export const uploadToServer = async (req: Request, res: Response) => {
  try {
    const { file } = req as any;
    const { folder, restaurantId, entityType, entityId } = req.body || {};

    if (!file || !file.buffer) {
      return errorResponse(res, 'No file provided', 400);
    }

    const contentType = (file.mimetype as string) || '';
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(contentType)) {
      return errorResponse(res, 'Unsupported file type', 415);
    }

    const uploadsRoot = getUploadsRoot();
    ensureDir(uploadsRoot);
    const segments = [uploadsRoot];
    if (folder) segments.push(String(folder).replace(/[^a-zA-Z0-9_-]/g, ''));
    if (restaurantId) segments.push('restaurants', String(restaurantId).replace(/[^a-zA-Z0-9_-]/g, ''));
    if (entityType) segments.push(String(entityType).replace(/[^a-zA-Z0-9_-]/g, '') || 'misc');
    const dirPath = path.join(...segments);
    ensureDir(dirPath);

    const ext = path.extname(file.originalname || '') || '.jpg';
    const baseName = uuidv4();
    const outputFileName = baseName + '.webp';
    const outputPath = path.join(dirPath, outputFileName);

    const buffer = file.buffer as Buffer;
    const image = sharp(buffer);
    const meta = await image.metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    const needsResize = width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION;

    const pipeline = needsResize
      ? image.resize(MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION, { fit: 'inside', withoutEnlargement: true })
      : image;
    await pipeline
      .webp({ quality: WEBP_QUALITY })
      .toFile(outputPath);

    const relativePath = path.relative(uploadsRoot, outputPath);
    const urlPath = toRelativeUrl(relativePath);

    const stats = await sharp(outputPath).metadata();
    return successResponse(res, 'Uploaded', {
      url: urlPath,
      path: urlPath,
      width: stats.width ?? null,
      height: stats.height ?? null,
      format: 'webp',
      provider: 'server',
    });
  } catch (e) {
    console.error('Upload error:', e);
    return errorResponse(res, 'Server error', 500);
  }
};

/**
 * Legacy Cloudinary upload – kept for reference or fallback.
 * Use uploadToServer for new behavior.
 */
export const uploadToCloudinary = uploadToServer;
