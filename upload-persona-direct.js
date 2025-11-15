/**
 * Script to upload persona directly to MongoDB (bypasses server API)
 * Usage: node upload-persona-direct.js
 * 
 * Requires MONGODB_URI environment variable or .env file
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config();

// Persona Schema (matches models/Persona.js)
const personaSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    default: 'default'
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

const Persona = mongoose.models.Persona || mongoose.model('Persona', personaSchema);

// Configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/voicebot';
const personaName = process.argv[2] || 'parvati'; // Default persona name

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
console.log(`\n🔌 Connecting to MongoDB...`);
console.log(`   URI: ${MONGODB_URI.replace(/\/\/.*@/, '//***:***@')}`); // Hide credentials

try {
  // Connect to MongoDB
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  // Upload/Update persona
  console.log(`\n📤 Uploading persona "${personaName}" to MongoDB...`);
  
  const persona = await Persona.findOneAndUpdate(
    { name: personaName },
    { 
      content: personaContent.trim(),
      updatedAt: new Date()
    },
    { 
      upsert: true, // Create if doesn't exist
      new: true, // Return updated document
      runValidators: true
    }
  );

  console.log('\n✅ SUCCESS! Persona uploaded to MongoDB');
  console.log(`   Persona ID: ${persona._id}`);
  console.log(`   Name: ${persona.name}`);
  console.log(`   Content Length: ${persona.content.length} characters`);
  console.log(`   Created At: ${persona.createdAt ? new Date(persona.createdAt).toLocaleString() : 'N/A'}`);
  console.log(`   Updated At: ${new Date(persona.updatedAt).toLocaleString()}`);
  console.log(`\n🎉 Persona "${personaName}" is now live in your MongoDB!`);

  // Close connection
  await mongoose.disconnect();
  console.log('\n✅ MongoDB connection closed');
  
} catch (error) {
  console.error('\n❌ Error:', error.message);
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
  process.exit(1);
}

