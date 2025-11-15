/**
 * Script to upload document to MongoDB via live server
 * Usage: node upload-document.js <server-url> <file-path>
 * Example: node upload-document.js https://your-app.onrender.com WhatsApp_Knowledgebase.docx
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import FormData from 'form-data';
import { createReadStream } from 'fs';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get server URL and file path from command line arguments
const serverUrl = process.argv[2];
const filePath = process.argv[3] || 'WhatsApp_Knowledgebase.docx';

if (!serverUrl) {
  console.error('❌ Error: Server URL is required');
  console.error('\nUsage:');
  console.error('  node upload-document.js <server-url> [file-path]');
  console.error('\nExamples:');
  console.error('  node upload-document.js https://your-app.onrender.com WhatsApp_Knowledgebase.docx');
  console.error('  node upload-document.js https://your-app.onrender.com');
  process.exit(1);
}

// Remove trailing slash
const baseUrl = serverUrl.replace(/\/$/, '');

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
console.log(`\n🚀 Uploading to server: ${baseUrl}`);

// Create form data
const formData = new FormData();
formData.append('file', createReadStream(fullFilePath), {
  filename: path.basename(fullFilePath),
  contentType: getContentType(fullFilePath)
});

// Upload to server
const uploadUrl = `${baseUrl}/documents/upload`;

try {
  console.log('\n📤 Sending POST request...');
  const response = await axios.post(uploadUrl, formData, {
    headers: {
      ...formData.getHeaders()
    },
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    timeout: 120000 // 120 second timeout for document processing
  });

  if (response.data.success) {
    console.log('\n✅ SUCCESS! Document uploaded to MongoDB');
    console.log(`   Document ID: ${response.data.document.id}`);
    console.log(`   Filename: ${response.data.document.filename}`);
    console.log(`   MIME Type: ${response.data.document.mimetype}`);
    console.log(`   Content Length: ${response.data.document.contentLength} characters`);
    console.log(`   Chunks Created: ${response.data.document.chunksCount}`);
    console.log(`   Uploaded At: ${new Date(response.data.document.uploadedAt).toLocaleString()}`);
    console.log(`\n🎉 Document "${response.data.document.filename}" is now live in your MongoDB!`);
    console.log(`   The document has been chunked and is ready for RAG (Retrieval Augmented Generation).`);
  } else {
    console.error('\n❌ Upload failed:', response.data.error || 'Unknown error');
    process.exit(1);
  }
} catch (error) {
  if (error.response) {
    // Server responded with error status
    console.error('\n❌ Server Error:');
    console.error(`   Status: ${error.response.status}`);
    console.error(`   Message: ${error.response.data?.error || error.response.statusText}`);
    if (error.response.data) {
      console.error(`   Details:`, JSON.stringify(error.response.data, null, 2));
    }
  } else if (error.request) {
    // Request was made but no response received
    console.error('\n❌ Network Error:');
    console.error(`   Could not reach server at: ${baseUrl}`);
    console.error(`   Make sure your server is running and accessible`);
    console.error(`   Error: ${error.message}`);
  } else {
    // Something else happened
    console.error('\n❌ Error:', error.message);
  }
  process.exit(1);
}

/**
 * Get content type based on file extension
 */
function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentTypes = {
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.pdf': 'application/pdf'
  };
  return contentTypes[ext] || 'application/octet-stream';
}

