/**
 * Persona Service
 * Loads persona/system prompt from MongoDB instead of local file
 */

import Persona from '../models/Persona.js';
import { connectDB } from '../config/db.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let cachedPersona = null;
let cacheTimestamp = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

/**
 * Get fallback persona from local file (for initial setup)
 * @returns {string}
 */
function getFallbackPersona() {
  try {
    const personaPath = join(__dirname, '..', 'parvati_persona.txt');
    const raw = readFileSync(personaPath, 'utf8');
    return raw.trim();
  } catch (err) {
    console.warn('⚠️  Fallback persona file not found, using default');
    return 'You are a helpful AI call agent.';
  }
}

/**
 * Load persona from MongoDB
 * @param {string} name - Persona name (default: "default")
 * @returns {Promise<string>} Persona content text
 */
async function loadPersonaFromMongo(name = 'default') {
  // Check cache first
  if (cachedPersona && cacheTimestamp && (Date.now() - cacheTimestamp) < CACHE_TTL_MS) {
    return cachedPersona;
  }

  try {
    // Ensure DB connection
    await connectDB();

    // Fetch persona from MongoDB
    let persona = await Persona.findOne({ name });

    // If not exists, create with fallback
    if (!persona) {
      console.log(`📝 Persona "${name}" not found in DB, creating with fallback...`);
      const fallbackContent = getFallbackPersona();
      
      persona = new Persona({
        name,
        content: fallbackContent,
        updatedAt: new Date()
      });
      
      await persona.save();
      console.log(`✅ Created persona "${name}" in MongoDB with fallback content`);
    }

    // Update cache
    cachedPersona = persona.content;
    cacheTimestamp = Date.now();

    console.log(`✅ Loaded persona "${name}" from MongoDB (${persona.content.length} chars)`);
    return persona.content;

  } catch (error) {
    console.error('❌ Error loading persona from MongoDB:', error.message);
    
    // Fallback to local file if DB fails
    const fallback = getFallbackPersona();
    cachedPersona = fallback;
    cacheTimestamp = Date.now();
    console.warn('⚠️  Using fallback persona from local file');
    return fallback;
  }
}

/**
 * Update persona in MongoDB
 * @param {string} content - New persona content
 * @param {string} name - Persona name (default: "default")
 * @returns {Promise<Object>} Updated persona document
 */
async function updatePersona(content, name = 'default') {
  try {
    await connectDB();

    const persona = await Persona.findOneAndUpdate(
      { name },
      { 
        content: content.trim(),
        updatedAt: new Date()
      },
      { 
        upsert: true, // Create if doesn't exist
        new: true, // Return updated document
        runValidators: true
      }
    );

    // Clear cache
    cachedPersona = null;
    cacheTimestamp = null;

    console.log(`✅ Updated persona "${name}" in MongoDB`);
    return persona;

  } catch (error) {
    console.error('❌ Error updating persona:', error.message);
    throw error;
  }
}

/**
 * Get persona document from MongoDB
 * @param {string} name - Persona name (default: "default")
 * @returns {Promise<Object|null>} Persona document or null
 */
async function getPersonaDocument(name = 'default') {
  try {
    await connectDB();
    return await Persona.findOne({ name });
  } catch (error) {
    console.error('❌ Error fetching persona document:', error.message);
    return null;
  }
}

/**
 * Clear persona cache (useful after updates)
 */
function clearPersonaCache() {
  cachedPersona = null;
  cacheTimestamp = null;
}

export { 
  loadPersonaFromMongo, 
  updatePersona, 
  getPersonaDocument,
  clearPersonaCache 
};

