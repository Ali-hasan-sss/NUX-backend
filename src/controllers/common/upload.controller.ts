import { Request, Response } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import { errorResponse, successResponse } from '../../utils/response';

// Expect env vars: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, CLOUDINARY_FOLDER(optional)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
/**
 * @swagger
 * /api/uploadFile:
 *   post:
 *     summary: Upload a file to the server
 *     description: |
 *       Uploads a file (image) to the server. Accepted types: image/jpeg, image/png, image/webp. Max size 5MB.
 *       **Note:** Cloudinary upload has been discontinued; files are stored on the server. Firebase integration for push notifications has also been removed (see deprecated /api/firebase/updateFirebaseToken).
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
 *                 description: Image file (JPEG, PNG, WebP)
 *               folder:
 *                 type: string
 *                 description: Optional target folder root
 *               restaurantId:
 *                 type: string
 *                 description: Optional restaurant id to namespace uploads
 *               entityType:
 *                 type: string
 *                 description: Optional entity type (e.g. logo, menuItem)
 *               entityId:
 *                 type: string
 *                 description: Optional entity id
 *     responses:
 *       200:
 *         description: Upload success (returns url and metadata)
 *       400:
 *         description: No file provided
 *       415:
 *         description: Unsupported media type
 *       500:
 *         description: Server error
 */
export const uploadToCloudinary = async (req: Request, res: Response) => {
  try {
    const { file } = req as any;
    const { folder, restaurantId, entityType, entityId } = req.body || {};

    if (!file || !file.buffer) {
      return errorResponse(res, 'No file provided', 400);
    }

    // Basic mime/type guard
    const contentType = file.mimetype as string | undefined;
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!contentType || !allowed.includes(contentType)) {
      return errorResponse(res, 'Unsupported file type', 415);
    }

    const targetFolder = folder || process.env.CLOUDINARY_FOLDER || 'loalityapp';
    const publicFolder = restaurantId
      ? `${targetFolder}/restaurants/${restaurantId}/${entityType || 'misc'}`
      : targetFolder;

    const uploadResult = await cloudinary.uploader.upload_stream(
      {
        folder: publicFolder,
        resource_type: 'image',
        use_filename: false,
        unique_filename: true,
        overwrite: false,
      },
      (err: any, result: any) => {
        if (err || !result) {
          return errorResponse(res, 'Upload failed', 500);
        }
        return successResponse(res, 'Uploaded', {
          url: result.secure_url,
          public_id: result.public_id,
          width: result.width,
          height: result.height,
          format: result.format,
          bytes: result.bytes,
          folder: result.folder,
          entityType: entityType || null,
          entityId: entityId || null,
          provider: 'cloudinary',
        });
      },
    );

    // Write buffer to stream
    const stream = uploadResult as unknown as NodeJS.WritableStream;
    stream.write(file.buffer);
    stream.end();
  } catch (e) {
    console.error(e);
    return errorResponse(res, 'Server error', 500);
  }
};
