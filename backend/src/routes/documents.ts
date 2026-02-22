import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { prisma } from '../server';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { authorize } from '../middleware/auth';
import { logger } from '../utils/logger';

// ─── Security helpers ─────────────────────────────────────────────────────────

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CUID_REGEX = /^c[a-z0-9]{20,30}$/i;

function validateId(id: string): boolean {
  return UUID_REGEX.test(id) || CUID_REGEX.test(id);
}

// Ensure a resolved path is strictly inside the allowed base directory.
function assertInsideBase(base: string, target: string): void {
  const resolvedBase = path.resolve(base) + path.sep;
  const resolvedTarget = path.resolve(target);
  if (!resolvedTarget.startsWith(resolvedBase)) {
    throw new AppError('Invalid file path', 400, 'INVALID_PATH');
  }
}

// Magic-bytes map for allowed MIME types (first bytes of file)
const MAGIC_BYTES: Record<string, Buffer[]> = {
  'pdf':  [Buffer.from([0x25, 0x50, 0x44, 0x46])],                     // %PDF
  'png':  [Buffer.from([0x89, 0x50, 0x4e, 0x47])],                     // PNG
  'jpg':  [Buffer.from([0xff, 0xd8, 0xff])],                            // JPEG
  'jpeg': [Buffer.from([0xff, 0xd8, 0xff])],
  'docx': [Buffer.from([0x50, 0x4b, 0x03, 0x04])],                     // PK zip (OOXML)
  'xlsx': [Buffer.from([0x50, 0x4b, 0x03, 0x04])],
  'doc':  [Buffer.from([0xd0, 0xcf, 0x11, 0xe0])],                     // OLE2
  'xls':  [Buffer.from([0xd0, 0xcf, 0x11, 0xe0])],
};

function validateMagicBytes(filePath: string, ext: string): void {
  const signatures = MAGIC_BYTES[ext.toLowerCase()];
  if (!signatures) return; // unknown ext — already rejected by fileFilter

  const buf = Buffer.alloc(8);
  const fd = fs.openSync(filePath, 'r');
  try {
    fs.readSync(fd, buf, 0, 8, 0);
  } finally {
    fs.closeSync(fd);
  }

  const valid = signatures.some(sig => buf.slice(0, sig.length).equals(sig));
  if (!valid) {
    fs.unlinkSync(filePath); // remove suspicious file
    throw new AppError('File content does not match its extension', 400, 'INVALID_FILE_CONTENT');
  }
}

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = process.env.UPLOAD_PATH || './uploads';

    // Create base directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    // Validate applicationId before using in path
    const applicationId = req.params.applicationId;
    if (!validateId(applicationId)) {
      return cb(new Error('Invalid applicationId format'), '');
    }

    const applicationDir = path.join(uploadPath, 'applications', applicationId);
    // Ensure resulting path is inside uploadPath
    assertInsideBase(path.join(uploadPath, 'applications'), applicationDir);
    
    if (!fs.existsSync(applicationDir)) {
      fs.mkdirSync(applicationDir, { recursive: true });
    }
    
    cb(null, applicationDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext);
    cb(null, `${basename}-${uniqueSuffix}${ext}`);
  }
});

// File filter
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = process.env.ALLOWED_FILE_TYPES?.split(',') || 
    ['pdf', 'png', 'jpg', 'jpeg', 'xlsx', 'xls', 'doc', 'docx'];
  
  const ext = path.extname(file.originalname).toLowerCase().substring(1);
  
  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new AppError(`File type .${ext} is not allowed`, 400, 'INVALID_FILE_TYPE'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB default
    files: 5 // Maximum 5 files per request
  }
});

// Get documents for application
router.get('/:applicationId',
  authorize(['view_application']),
  asyncHandler(async (req: Request, res: Response) => {
    const { applicationId } = req.params;

    if (!validateId(applicationId)) {
      throw new AppError('Invalid applicationId', 400, 'INVALID_ID');
    }

    // Check if application exists
    const application = await prisma.creditApplication.findUnique({
      where: { id: applicationId },
      select: { id: true, applicationNumber: true }
    });

    if (!application) {
      throw new AppError('Application not found', 404, 'APPLICATION_NOT_FOUND');
    }

    const documents = await prisma.document.findMany({
      where: { applicationId },
      include: {
        uploader: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      application: {
        id: application.id,
        applicationNumber: application.applicationNumber
      },
      documents
    });
  })
);

// Upload documents
router.post('/:applicationId/upload', 
  authorize(['upload_documents']),
  upload.array('documents', 5),
  asyncHandler(async (req: Request, res: Response) => {
    const { applicationId } = req.params;
    const { category } = req.body;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      throw new AppError('No files uploaded', 400, 'NO_FILES');
    }

    // Validate applicationId
    if (!validateId(applicationId)) {
      throw new AppError('Invalid applicationId', 400, 'INVALID_ID');
    }

    // Validate magic bytes for each uploaded file
    for (const file of files) {
      const ext = path.extname(file.originalname).toLowerCase().substring(1);
      validateMagicBytes(file.path, ext);
    }

    // Check if application exists
    const application = await prisma.creditApplication.findUnique({
      where: { id: applicationId }
    });

    if (!application) {
      throw new AppError('Application not found', 404, 'APPLICATION_NOT_FOUND');
    }

    // Create document records
    const documentData = files.map(file => ({
      applicationId,
      filename: file.originalname,
      filePath: file.path,
      fileSize: file.size,
      mimeType: file.mimetype,
      category: category || 'OTHER',
      uploadedBy: req.user!.id
    }));

    const documents = await prisma.document.createMany({
      data: documentData
    });

    // Get created documents with relations
    const createdDocuments = await prisma.document.findMany({
      where: {
        applicationId,
        uploadedBy: req.user!.id,
        createdAt: {
          gte: new Date(Date.now() - 5000) // Last 5 seconds
        }
      },
      include: {
        uploader: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: files.length
    });

    logger.info('Documents uploaded', {
      applicationId,
      fileCount: files.length,
      fileNames: files.map(f => f.originalname),
      uploadedBy: req.user!.id
    });

    res.status(201).json({
      message: `${files.length} document(s) uploaded successfully`,
      documents: createdDocuments
    });
  })
);

// Get document by ID
router.get('/file/:id', 
  authorize(['view_application']), 
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        application: {
          select: {
            id: true,
            applicationNumber: true
          }
        }
      }
    });

    if (!document) {
      throw new AppError('Document not found', 404, 'DOCUMENT_NOT_FOUND');
    }

    res.json({ document });
  })
);

// Download document
router.get('/download/:id', 
  authorize(['view_application']), 
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const document = await prisma.document.findUnique({
      where: { id }
    });

    if (!document) {
      throw new AppError('Document not found', 404, 'DOCUMENT_NOT_FOUND');
    }

    // Check if file exists
    if (!fs.existsSync(document.filePath)) {
      throw new AppError('File not found on disk', 404, 'FILE_NOT_FOUND');
    }

    // Set appropriate headers
    res.setHeader('Content-Disposition', `attachment; filename="${document.filename}"`);
    res.setHeader('Content-Type', document.mimeType || 'application/octet-stream');

    // Stream file to response
    const fileStream = fs.createReadStream(document.filePath);
    fileStream.pipe(res);

    logger.info('Document downloaded', {
      documentId: id,
      filename: document.filename,
      downloadedBy: req.user!.id
    });
  })
);

// Delete document
router.delete('/:id', 
  authorize(['upload_documents', 'edit_application']), 
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const document = await prisma.document.findUnique({
      where: { id }
    });

    if (!document) {
      throw new AppError('Document not found', 404, 'DOCUMENT_NOT_FOUND');
    }

    // Delete file from disk
    if (fs.existsSync(document.filePath)) {
      fs.unlinkSync(document.filePath);
    }

    // Delete record from database
    await prisma.document.delete({
      where: { id }
    });

    logger.info('Document deleted', {
      documentId: id,
      filename: document.filename,
      deletedBy: req.user!.id
    });

    res.json({
      message: 'Document deleted successfully'
    });
  })
);

// Update document metadata
router.put('/:id', 
  authorize(['upload_documents', 'edit_application']), 
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { category, status, ocrText, extractedData } = req.body;

    const updateData: any = {};
    if (category !== undefined) updateData.category = category;
    if (status !== undefined) updateData.status = status;
    if (ocrText !== undefined) updateData.ocrText = ocrText;
    if (extractedData !== undefined) updateData.extractedData = extractedData;

    const document = await prisma.document.update({
      where: { id },
      data: updateData,
      include: {
        uploader: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    res.json({
      message: 'Document updated successfully',
      document
    });
  })
);

export default router;