/**
 * File Parser Utility
 * Extracts text from various file formats (txt, md, docx, pdf)
 */

import { readFileSync } from 'fs';
import { createRequire } from 'module';
import mammoth from 'mammoth';
// pdf-parse is a CommonJS module, use createRequire for reliable import
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

/**
 * Extract text from a file buffer based on mimetype
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} mimetype - MIME type of the file
 * @param {string} filename - Original filename (for error messages)
 * @returns {Promise<string>} Extracted text
 */
async function extractTextFromFile(fileBuffer, mimetype, filename = 'unknown') {
  try {
    // Determine file type from mimetype or filename extension
    const fileType = getFileType(mimetype, filename);

    switch (fileType) {
      case 'txt':
      case 'md':
        return extractTextFromTxt(fileBuffer);
      
      case 'docx':
        return await extractTextFromDocx(fileBuffer);
      
      case 'pdf':
        return await extractTextFromPdf(fileBuffer);
      
      default:
        throw new Error(`Unsupported file type: ${mimetype || filename}`);
    }
  } catch (error) {
    console.error(`❌ Error extracting text from ${filename}:`, error.message);
    throw error;
  }
}

/**
 * Get file type from mimetype or filename
 * @param {string} mimetype - MIME type
 * @param {string} filename - Filename
 * @returns {string} File type (txt, md, docx, pdf)
 */
function getFileType(mimetype, filename) {
  // Check mimetype first
  if (mimetype) {
    if (mimetype === 'text/plain' || mimetype.includes('text/plain')) {
      return 'txt';
    }
    if (mimetype === 'text/markdown' || mimetype.includes('markdown')) {
      return 'md';
    }
    if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        mimetype.includes('wordprocessingml') ||
        mimetype.includes('docx')) {
      return 'docx';
    }
    if (mimetype === 'application/pdf' || mimetype.includes('pdf')) {
      return 'pdf';
    }
  }

  // Fallback to filename extension
  const ext = filename.toLowerCase().split('.').pop();
  switch (ext) {
    case 'txt':
      return 'txt';
    case 'md':
    case 'markdown':
      return 'md';
    case 'docx':
      return 'docx';
    case 'pdf':
      return 'pdf';
    default:
      throw new Error(`Unsupported file extension: .${ext}`);
  }
}

/**
 * Extract text from plain text file
 * @param {Buffer} fileBuffer - File buffer
 * @returns {string} Text content
 */
function extractTextFromTxt(fileBuffer) {
  return fileBuffer.toString('utf8').trim();
}

/**
 * Extract text from DOCX file
 * @param {Buffer} fileBuffer - File buffer
 * @returns {Promise<string>} Extracted text
 */
async function extractTextFromDocx(fileBuffer) {
  try {
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    return result.value.trim();
  } catch (error) {
    console.error('❌ Error parsing DOCX:', error.message);
    throw new Error(`Failed to parse DOCX: ${error.message}`);
  }
}

/**
 * Extract text from PDF file
 * @param {Buffer} fileBuffer - File buffer
 * @returns {Promise<string>} Extracted text
 */
async function extractTextFromPdf(fileBuffer) {
  try {
    const data = await pdfParse(fileBuffer);
    return data.text.trim();
  } catch (error) {
    console.error('❌ Error parsing PDF:', error.message);
    throw new Error(`Failed to parse PDF: ${error.message}`);
  }
}

export { extractTextFromFile, getFileType };

