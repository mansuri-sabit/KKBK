/**
 * Document API Routes
 * Handles document upload, retrieval, and deletion
 */

import express from 'express';
import multer from 'multer';
import Document from '../models/Document.js';
import { extractTextFromFile } from '../utils/fileParser.js';
import { chunkText } from '../utils/knowledgebaseMongo.js';
import { clearKnowledgebaseCache } from '../utils/knowledgebaseMongo.js';

const router = express.Router();

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept txt, md, docx, pdf files
    const allowedMimes = [
      'text/plain',
      'text/markdown',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/pdf'
    ];
    
    const allowedExts = ['.txt', '.md', '.docx', '.pdf'];
    const ext = '.' + file.originalname.split('.').pop().toLowerCase();

    if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type. Allowed: ${allowedExts.join(', ')}`), false);
    }
  }
});

/**
 * POST /documents/upload
 * Upload document file(s)
 * Accepts: multipart/form-data with file field
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file provided. Use multipart/form-data with "file" field.'
      });
    }

    const { buffer, originalname, mimetype } = req.file;

    // Extract text from file
    console.log(`📄 Extracting text from ${originalname} (${mimetype})...`);
    const extractedText = await extractTextFromFile(buffer, mimetype, originalname);

    if (!extractedText || extractedText.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'File appears to be empty or could not extract text'
      });
    }

    // Chunk the text
    const chunks = chunkText(extractedText, 1000, 200);

    // Save to MongoDB
    const document = new Document({
      filename: originalname,
      mimetype: mimetype,
      content: extractedText,
      chunks: chunks,
      uploadedAt: new Date()
    });

    await document.save();

    // Clear knowledgebase cache
    clearKnowledgebaseCache();

    console.log(`✅ Document "${originalname}" uploaded and chunked (${chunks.length} chunks)`);

    res.json({
      success: true,
      message: `Document "${originalname}" uploaded successfully`,
      document: {
        id: document._id,
        filename: document.filename,
        mimetype: document.mimetype,
        contentLength: document.content.length,
        chunksCount: document.chunks.length,
        uploadedAt: document.uploadedAt
      }
    });
  } catch (error) {
    console.error('❌ Error uploading document:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload document'
    });
  }
});

/**
 * GET /documents
 * List all documents
 */
router.get('/', async (req, res) => {
  try {
    const documents = await Document.find({})
      .select('_id filename mimetype uploadedAt createdAt')
      .sort({ uploadedAt: -1 });

    res.json({
      success: true,
      count: documents.length,
      documents: documents.map(doc => ({
        id: doc._id,
        filename: doc.filename,
        mimetype: doc.mimetype,
        uploadedAt: doc.uploadedAt,
        createdAt: doc.createdAt
      }))
    });
  } catch (error) {
    console.error('❌ Error fetching documents:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch documents'
    });
  }
});

/**
 * GET /documents/:id
 * Get document by ID (includes parsed text)
 */
router.get('/:id', async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    res.json({
      success: true,
      document: {
        id: document._id,
        filename: document.filename,
        mimetype: document.mimetype,
        content: document.content,
        chunksCount: document.chunks.length,
        uploadedAt: document.uploadedAt,
        createdAt: document.createdAt
      }
    });
  } catch (error) {
    console.error('❌ Error fetching document:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid document ID'
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch document'
    });
  }
});

/**
 * DELETE /documents/:id
 * Delete document by ID
 */
router.delete('/:id', async (req, res) => {
  try {
    const document = await Document.findByIdAndDelete(req.params.id);

    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    // Clear knowledgebase cache
    clearKnowledgebaseCache();

    console.log(`✅ Document "${document.filename}" deleted`);

    res.json({
      success: true,
      message: `Document "${document.filename}" deleted successfully`
    });
  } catch (error) {
    console.error('❌ Error deleting document:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid document ID'
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete document'
    });
  }
});

export default router;

