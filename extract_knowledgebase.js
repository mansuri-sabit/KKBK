/**
 * Extract text from WhatsApp_Knowledgebase.docx and save to whatsapp_knowledgebase.txt
 */

import mammoth from 'mammoth';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function extractKnowledgebase() {
  try {
    const docxPath = join(__dirname, 'WhatsApp_Knowledgebase.docx');
    const txtPath = join(__dirname, 'whatsapp_knowledgebase.txt');

    console.log('📖 Extracting text from WhatsApp_Knowledgebase.docx...');
    
    const result = await mammoth.extractRawText({ path: docxPath });
    const text = result.value;

    // Clean up the text (remove excessive whitespace, normalize line breaks)
    const cleanedText = text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
      .trim();

    writeFileSync(txtPath, cleanedText, 'utf8');
    
    console.log(`✅ Extracted knowledgebase text to whatsapp_knowledgebase.txt`);
    console.log(`   Text length: ${cleanedText.length} characters`);
    console.log(`   Preview (first 200 chars):\n${cleanedText.substring(0, 200)}...`);
  } catch (error) {
    console.error('❌ Error extracting knowledgebase:', error.message);
    process.exit(1);
  }
}

extractKnowledgebase();

