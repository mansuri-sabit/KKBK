/**
 * Persona API Routes
 * Handles persona upload and retrieval
 */

import express from 'express';
import { updatePersona, getPersonaDocument, loadPersonaFromMongo } from '../utils/personaService.js';

const router = express.Router();

/**
 * POST /persona/upload
 * Upload/update persona text
 * Body: { content: "..." }
 */
router.post('/upload', async (req, res) => {
  try {
    const { content, name } = req.body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Persona content is required and must be a non-empty string'
      });
    }

    const personaName = name || 'default';
    const persona = await updatePersona(content.trim(), personaName);

    res.json({
      success: true,
      message: `Persona "${personaName}" updated successfully`,
      persona: {
        id: persona._id,
        name: persona.name,
        contentLength: persona.content.length,
        updatedAt: persona.updatedAt
      }
    });
  } catch (error) {
    console.error('❌ Error uploading persona:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update persona'
    });
  }
});

/**
 * GET /persona
 * Get current persona
 * Query params: ?name=default (optional)
 */
router.get('/', async (req, res) => {
  try {
    const personaName = req.query.name || 'default';
    const persona = await getPersonaDocument(personaName);

    if (!persona) {
      return res.status(404).json({
        success: false,
        error: `Persona "${personaName}" not found`
      });
    }

    res.json({
      success: true,
      persona: {
        id: persona._id,
        name: persona.name,
        content: persona.content,
        updatedAt: persona.updatedAt,
        createdAt: persona.createdAt
      }
    });
  } catch (error) {
    console.error('❌ Error fetching persona:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch persona'
    });
  }
});

export default router;

