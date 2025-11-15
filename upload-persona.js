/**
 * Script to upload persona from parvati_persona.txt to MongoDB via live server
 * Usage: node upload-persona.js [server-url]
 * Example: node upload-persona.js https://your-app.onrender.com
 *          node upload-persona.js http://localhost:3000
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get server URL from command line argument
const serverUrl = process.argv[2];
const personaName = process.argv[3] || 'parvati'; // Default persona name

if (!serverUrl) {
  console.error('❌ Error: Server URL is required');
  console.error('\nUsage:');
  console.error('  node upload-persona.js <server-url> [persona-name]');
  console.error('\nExamples:');
  console.error('  node upload-persona.js https://your-app.onrender.com');
  console.error('  node upload-persona.js https://your-app.onrender.com parvati');
  console.error('  node upload-persona.js http://localhost:3000');
  process.exit(1);
}

// Remove trailing slash
const baseUrl = serverUrl.replace(/\/$/, '');

// Read persona file
const personaFilePath = path.join(__dirname, 'parvati_persona.txt');

console.log('📝 Reading persona file...');
console.log(`   File: ${personaFilePath}`);

if (!fs.existsSync(personaFilePath)) {
  console.error(`❌ Error: File not found: ${personaFilePath}`);
  process.exit(1);
}

const personaContent = fs.readFileSync(personaFilePath, 'utf-8');

if (!personaContent || personaContent.trim().length === 0) {
  console.error('❌ Error: Persona file is empty');
  process.exit(1);
}

console.log(`✅ Read persona file (${personaContent.length} characters)`);
console.log(`\n🚀 Uploading to server: ${baseUrl}`);
console.log(`   Persona name: ${personaName}`);

// Upload to server
const uploadUrl = `${baseUrl}/persona/upload`;

const payload = {
  content: personaContent.trim(),
  name: personaName
};

try {
  console.log('\n📤 Sending POST request...');
  const response = await axios.post(uploadUrl, payload, {
    headers: {
      'Content-Type': 'application/json'
    },
    timeout: 30000 // 30 second timeout
  });

  if (response.data.success) {
    console.log('\n✅ SUCCESS! Persona uploaded to MongoDB');
    console.log(`   Persona ID: ${response.data.persona.id}`);
    console.log(`   Name: ${response.data.persona.name}`);
    console.log(`   Content Length: ${response.data.persona.contentLength} characters`);
    console.log(`   Updated At: ${new Date(response.data.persona.updatedAt).toLocaleString()}`);
    console.log(`\n🎉 Persona "${personaName}" is now live in your MongoDB!`);
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

