/**
 * Persona Loader Utility
 * Loads system prompt from parvati_persona.txt file
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let cachedPrompt = null;

/**
 * Load system prompt from parvati_persona.txt
 * @returns {string} System prompt text
 */
function loadSystemPrompt() {
  if (cachedPrompt) {
    return cachedPrompt;
  }

  try {
    // Path to parvati_persona.txt in repo root
    const personaPath = join(__dirname, '..', 'parvati_persona.txt');
    const raw = readFileSync(personaPath, 'utf8');
    cachedPrompt = raw.trim();
    console.log('✅ Loaded persona prompt from parvati_persona.txt');
  } catch (err) {
    console.error('❌ Failed to load parvati_persona.txt, using fallback prompt', err.message);
    cachedPrompt = 'You are a helpful AI call agent.'; // safe fallback
  }

  return cachedPrompt;
}

export { loadSystemPrompt };

