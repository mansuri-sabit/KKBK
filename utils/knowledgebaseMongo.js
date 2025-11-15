/**
 * Knowledgebase Service (MongoDB-based)
 * Loads documents from MongoDB and provides RAG chunk retrieval
 */

import Document from '../models/Document.js';
import { connectDB } from '../config/db.js';

let cachedChunks = null;
let cacheTimestamp = null;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache

/**
 * Chunk text into smaller pieces for RAG
 * @param {string} text - Full text to chunk
 * @param {number} chunkSize - Target chunk size in characters (default: 1000)
 * @param {number} overlap - Overlap between chunks in characters (default: 200)
 * @returns {string[]} Array of text chunks
 */
function chunkText(text, chunkSize = 1000, overlap = 200) {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const chunks = [];
  let start = 0;
  const textLength = text.length;
  const maxChunks = Math.ceil(textLength / Math.max(1, chunkSize - overlap)) + 100; // Safety limit

  while (start < textLength && chunks.length < maxChunks) {
    let end = Math.min(start + chunkSize, textLength);
    
    // Try to break at sentence boundary if possible
    if (end < textLength) {
      const sentenceEnd = text.lastIndexOf('.', end);
      const paragraphEnd = text.lastIndexOf('\n\n', end);
      const bestBreak = Math.max(sentenceEnd, paragraphEnd);
      
      if (bestBreak > start + chunkSize * 0.5) {
        // Use sentence/paragraph break if it's not too early
        end = bestBreak + 1;
      }
    }

    const chunk = text.substring(start, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    // If we've reached the end, break
    if (end >= textLength) {
      break;
    }

    // Move start forward with overlap, ensuring we always advance
    const nextStart = Math.max(start + 1, end - overlap);
    start = nextStart;
  }

  return chunks;
}

/**
 * Load all documents from MongoDB and combine chunks
 * @returns {Promise<string[]>} Array of all document chunks
 */
async function loadAllChunks() {
  // Check cache first
  if (cachedChunks && cacheTimestamp && (Date.now() - cacheTimestamp) < CACHE_TTL_MS) {
    return cachedChunks;
  }

  try {
    await connectDB();

    // Fetch all documents
    const documents = await Document.find({}).sort({ uploadedAt: -1 });

    if (documents.length === 0) {
      console.log('⚠️  No documents found in MongoDB knowledgebase');
      cachedChunks = [];
      cacheTimestamp = Date.now();
      return [];
    }

    // Combine all chunks from all documents
    const allChunks = [];
    for (const doc of documents) {
      if (doc.chunks && doc.chunks.length > 0) {
        allChunks.push(...doc.chunks);
      } else if (doc.content) {
        // If chunks not available, chunk the content now
        const docChunks = chunkText(doc.content);
        allChunks.push(...docChunks);
      }
    }

    console.log(`✅ Loaded ${allChunks.length} chunks from ${documents.length} document(s) in MongoDB`);
    
    // Update cache
    cachedChunks = allChunks;
    cacheTimestamp = Date.now();

    return allChunks;

  } catch (error) {
    console.error('❌ Error loading chunks from MongoDB:', error.message);
    cachedChunks = [];
    cacheTimestamp = Date.now();
    return [];
  }
}

/**
 * Find relevant chunks based on query
 * Uses simple keyword matching (can be upgraded to embeddings later)
 * @param {string} query - User query text
 * @param {number} maxChunks - Maximum number of chunks to return (default: 3)
 * @returns {Promise<string[]>} Array of relevant chunk texts
 */
async function getRelevantChunks(query, maxChunks = 3) {
  if (!query || query.trim().length === 0) {
    return [];
  }

  try {
    // Load all chunks
    const allChunks = await loadAllChunks();

    if (allChunks.length === 0) {
      return [];
    }

    const q = query.toLowerCase().trim();
    const queryWords = q.split(/\s+/).filter(word => word.length >= 2); // Skip very short words

    if (queryWords.length === 0) {
      return [];
    }

    // Score each chunk by keyword overlap
    const scored = allChunks.map((chunk, idx) => {
      const text = chunk.toLowerCase();
      let score = 0;

      // Count keyword matches
      queryWords.forEach(word => {
        const wordRegex = new RegExp(`\\b${word}\\b`, 'gi');
        const matches = (text.match(wordRegex) || []).length;
        score += matches;
      });

      // Bonus for exact phrase match
      if (text.includes(q)) {
        score += 5;
      }

      // Bonus for heading-like patterns (starts with # or ends with :)
      if (/^#+\s|:$/.test(chunk)) {
        score += 1;
      }

      return { chunk, score, idx };
    });

    // Sort by score desc, index asc (earlier chunks preferred if same score)
    scored.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.idx - b.idx;
    });

    // Return top chunks with score > 0
    const relevant = scored
      .filter(item => item.score > 0)
      .slice(0, maxChunks)
      .map(item => item.chunk);

    if (relevant.length > 0) {
      console.log(`🔍 Found ${relevant.length} relevant chunk(s) for query: "${query.substring(0, 50)}"`);
    }

    return relevant;

  } catch (error) {
    console.error('❌ Error finding relevant chunks:', error.message);
    return [];
  }
}

/**
 * Get all documents from MongoDB
 * @returns {Promise<Array>} Array of document documents
 */
async function getAllDocuments() {
  try {
    await connectDB();
    return await Document.find({}).sort({ uploadedAt: -1 });
  } catch (error) {
    console.error('❌ Error fetching documents:', error.message);
    return [];
  }
}

/**
 * Get document by ID
 * @param {string} id - Document ID
 * @returns {Promise<Object|null>} Document or null
 */
async function getDocumentById(id) {
  try {
    await connectDB();
    return await Document.findById(id);
  } catch (error) {
    console.error('❌ Error fetching document:', error.message);
    return null;
  }
}

/**
 * Clear knowledgebase cache (useful after document updates)
 */
function clearKnowledgebaseCache() {
  cachedChunks = null;
  cacheTimestamp = null;
}

export { 
  loadAllChunks, 
  getRelevantChunks, 
  chunkText,
  getAllDocuments,
  getDocumentById,
  clearKnowledgebaseCache
};

