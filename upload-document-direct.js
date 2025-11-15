/**
 * Script to upload document directly to MongoDB (bypasses server API)
 * Usage: node upload-document-direct.js [file-path]
 * 
 * Requires MONGODB_URI environment variable or .env file
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { extractTextFromFile } from './utils/fileParser.js';
import { chunkText } from './utils/knowledgebaseMongo.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config();

// Document Schema (matches models/Document.js)
const documentSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true,
    trim: true
  },
  mimetype: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  chunks: {
    type: [String],
    default: [],
    required: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Create index on uploadedAt for sorting
documentSchema.index({ uploadedAt: -1 });

const Document = mongoose.models.Document || mongoose.model('Document', documentSchema);

// Configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/voicebot';
const filePath = process.argv[2] || 'WhatsApp_Knowledgebase.docx';

// Resolve file path (relative to current directory or absolute)
const fullFilePath = path.isAbsolute(filePath) 
  ? filePath 
  : path.join(__dirname, filePath);

console.log('📄 Reading document file...');
console.log(`   File: ${fullFilePath}`);

if (!fs.existsSync(fullFilePath)) {
  console.error(`❌ Error: File not found: ${fullFilePath}`);
  process.exit(1);
}

const fileStats = fs.statSync(fullFilePath);
const fileSizeMB = (fileStats.size / (1024 * 1024)).toFixed(2);

console.log(`✅ File found (${fileSizeMB} MB)`);

// Read file buffer
const fileBuffer = fs.readFileSync(fullFilePath);
const filename = path.basename(fullFilePath);

// Determine MIME type based on extension
function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes = {
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.pdf': 'application/pdf'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

const mimetype = getMimeType(filename);

console.log(`\n🔌 Connecting to MongoDB...`);
console.log(`   URI: ${MONGODB_URI.replace(/\/\/.*@/, '//***:***@')}`); // Hide credentials

try {
  // Connect to MongoDB
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  // Extract text from file
  console.log(`\n📝 Extracting text from ${filename} (${mimetype})...`);
  const extractedText = await extractTextFromFile(fileBuffer, mimetype, filename);

  if (!extractedText || extractedText.trim().length === 0) {
    console.error('❌ Error: File appears to be empty or could not extract text');
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`✅ Extracted text (${extractedText.length} characters)`);

  // Chunk the text
  console.log(`\n✂️  Chunking text...`);
  const chunks = chunkText(extractedText, 1000, 200);
  console.log(`✅ Created ${chunks.length} chunks`);

  // Save to MongoDB
  console.log(`\n📤 Uploading document to MongoDB...`);
  
  const document = new Document({
    filename: filename,
    mimetype: mimetype,
    content: extractedText.trim(),
    chunks: chunks,
    uploadedAt: new Date()
  });

  await document.save();

  console.log('\n✅ SUCCESS! Document uploaded to MongoDB');
  console.log(`   Document ID: ${document._id}`);
  console.log(`   Filename: ${document.filename}`);
  console.log(`   MIME Type: ${document.mimetype}`);
  console.log(`   Content Length: ${document.content.length} characters`);
  console.log(`   Chunks Created: ${document.chunks.length}`);
  console.log(`   Uploaded At: ${new Date(document.uploadedAt).toLocaleString()}`);
  console.log(`\n🎉 Document "${document.filename}" is now live in your MongoDB!`);
  console.log(`   The document has been chunked and is ready for RAG (Retrieval Augmented Generation).`);

  // Close connection
  await mongoose.disconnect();
  console.log('\n✅ MongoDB connection closed');
  
} catch (error) {
  console.error('\n❌ Error:', error.message);
  if (error.stack) {
    console.error('\nStack trace:', error.stack);
  }
  
  if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Check your MONGODB_URI in .env file or environment variables');
    console.error('   2. Make sure MongoDB is running and accessible');
    console.error('   3. For MongoDB Atlas, check your IP whitelist');
    console.error('   4. Verify your connection string format:');
    console.error('      mongodb://username:password@host:port/database');
    console.error('      or');
    console.error('      mongodb+srv://username:password@cluster.mongodb.net/database');
  }
  
  try {
    await mongoose.disconnect();
  } catch (disconnectError) {
    // Ignore disconnect errors
  }
  
  process.exit(1);
}

