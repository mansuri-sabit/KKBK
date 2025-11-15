/**
 * Knowledgebase Loader and Retrieval Utility
 * Loads WhatsApp knowledgebase from whatsapp_knowledgebase.txt and provides retrieval
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let kbRawText = null;
let kbSections = null;

/**
 * Load knowledgebase from whatsapp_knowledgebase.txt
 * @returns {{kbRawText: string, kbSections: string[]}}
 */
function loadKnowledgebase() {
  if (kbRawText !== null && kbSections !== null) {
    return { kbRawText, kbSections };
  }

  try {
    const kbPath = join(__dirname, '..', 'whatsapp_knowledgebase.txt');
    kbRawText = readFileSync(kbPath, 'utf8');

    // Simple splitting strategy: split by two newlines to get "paragraphs" or "sections"
    kbSections = kbRawText
      .split(/\n\s*\n/g)
      .map(s => s.trim())
      .filter(Boolean);

    console.log(
      `✅ Loaded WhatsApp knowledgebase from whatsapp_knowledgebase.txt (sections: ${kbSections.length})`
    );
  } catch (err) {
    console.error('❌ Failed to load whatsapp_knowledgebase.txt, knowledgebase disabled', err.message);
    kbRawText = '';
    kbSections = [];
  }

  return { kbRawText, kbSections };
}

/**
 * Find relevant sections from knowledgebase based on query
 * @param {string} query - User query text
 * @param {number} maxSections - Maximum number of sections to return (default: 3)
 * @returns {string[]} Array of relevant section texts
 */
function findRelevantSections(query, maxSections = 3) {
  const { kbSections } = loadKnowledgebase();
  
  if (!kbSections.length || !query) {
    return [];
  }

  const q = query.toLowerCase();

  // Very simple relevance: score by keyword overlap / indexOf
  const scored = kbSections.map((section, idx) => {
    const text = section.toLowerCase();
    let score = 0;

    // boost if query words appear
    q.split(/\s+/).forEach(word => {
      if (!word || word.length < 2) return; // Skip very short words
      if (text.includes(word)) {
        score += 1;
      }
    });

    // small bonus if heading-like pattern (starts with # or ends with :)
    if (/^#+\s|:$/.test(section)) {
      score += 0.5;
    }

    return { section, score, idx };
  });

  // Sort by score desc, index asc (earlier sections preferred if same score)
  scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.idx - b.idx;
  });

  return scored
    .filter(item => item.score > 0)
    .slice(0, maxSections)
    .map(item => item.section);
}

export { loadKnowledgebase, findRelevantSections };

