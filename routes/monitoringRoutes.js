/**
 * Monitoring API Routes
 * Provides endpoints to view logs, transcripts, and monitoring status
 */

import express from 'express';
import { monitoringService } from '../utils/monitoringService.js';
import Transcript from '../models/Transcript.js';

const router = express.Router();

/**
 * GET /monitoring/status
 * Check if logs and transcripts are being generated
 */
router.get('/status', async (req, res) => {
  try {
    const status = await monitoringService.checkTranscriptGeneration();
    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to check monitoring status'
    });
  }
});

/**
 * GET /monitoring/logs
 * Get recent logs
 * Query params: limit (default: 100), callId (optional)
 */
router.get('/logs', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const callId = req.query.callId || null;

    const logs = monitoringService.getRecentLogs(limit, callId);

    res.json({
      success: true,
      count: logs.length,
      logs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get logs'
    });
  }
});

/**
 * GET /monitoring/transcripts
 * Get all transcripts
 * Query params: limit (default: 50), callId, status, direction
 */
router.get('/transcripts', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const filters = {};

    if (req.query.callId) filters.callId = req.query.callId;
    if (req.query.status) filters.status = req.query.status;
    if (req.query.direction) filters.direction = req.query.direction;

    const transcripts = await monitoringService.getTranscripts(filters, limit);

    res.json({
      success: true,
      count: transcripts.length,
      transcripts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get transcripts'
    });
  }
});

/**
 * GET /monitoring/transcripts/:callId
 * Get transcript by call ID
 */
router.get('/transcripts/:callId', async (req, res) => {
  try {
    const { callId } = req.params;
    const transcript = await monitoringService.getTranscriptByCallId(callId);

    if (!transcript) {
      return res.status(404).json({
        success: false,
        error: 'Transcript not found'
      });
    }

    res.json({
      success: true,
      transcript
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get transcript'
    });
  }
});

/**
 * GET /monitoring/statistics
 * Get monitoring statistics
 */
router.get('/statistics', async (req, res) => {
  try {
    const stats = await monitoringService.getStatistics();
    res.json({
      success: true,
      ...stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get statistics'
    });
  }
});

export default router;

