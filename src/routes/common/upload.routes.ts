import { Router } from 'express';
import multer from 'multer';
import { uploadToServer } from '../../controllers/common/upload.controller';

const router = Router();

// memory storage to get buffer for cloudinary upload_stream
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Public route for all authenticated/unauthenticated? If you want auth, import and add authenticateUser
router.post('/', upload.single('file'), uploadToServer);

export default router;
