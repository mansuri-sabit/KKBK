/**
 * Monitoring Service
 * Tracks logs and transcripts generation
 */

import Transcript from '../models/Transcript.js';
import { connectDB } from '../config/db.js';

class MonitoringService {
  constructor() {
    this.logBuffer = []; // In-memory log buffer (last 1000 logs)
    this.maxLogBufferSize = 1000;
  }

  /**
   * Add log entry to buffer
   * @param {string} callId - Call ID
   * @param {string} level - Log level (info, warn, error)
   * @param {string} message - Log message
   * @param {Object} metadata - Additional metadata
   */
  addLog(callId, level, message, metadata = {}) {
    const logEntry = {
      timestamp: new Date(),
      callId: callId || 'system',
      level,
      message,
      metadata
    };

    // Add to buffer
    this.logBuffer.push(logEntry);

    // Keep buffer size manageable
    if (this.logBuffer.length > this.maxLogBufferSize) {
      this.logBuffer.shift(); // Remove oldest entry
    }

    // Also log to console
    const emoji = {
      info: 'ℹ️',
      warn: '⚠️',
      error: '❌',
      success: '✅'
    }[level] || '📝';

    console.log(`${emoji} [MONITOR] [${callId || 'system'}] ${message}`, metadata);
  }

  /**
   * Save transcript to MongoDB
   * @param {Object} session - VoiceSession object
   * @returns {Promise<Object>} Saved transcript
   */
  async saveTranscript(session) {
    try {
      await connectDB();

      const transcriptData = {
        callId: session.callId,
        callSid: session.callSid || null,
        from: session.from || null,
        to: session.to || null,
        direction: session.direction || 'inbound',
        conversationHistory: session.conversationHistory || [],
        duration: session.connectedAt 
          ? Math.round((new Date() - session.connectedAt) / 1000)
          : 0,
        startedAt: session.connectedAt || new Date(),
        endedAt: new Date(),
        status: 'completed',
        metadata: {
          streamSid: session.streamSid || null,
          greetingSent: session.greetingSent || false,
          totalTurns: Math.floor((session.conversationHistory?.length || 0) / 2),
          lastUserText: session.lastUserText || null,
          lastBotText: session.lastBotText || null
        }
      };

      // Try to find existing transcript (in case call was already saved)
      let transcript = await Transcript.findOne({ callId: session.callId });

      if (transcript) {
        // Update existing transcript
        Object.assign(transcript, transcriptData);
        await transcript.save();
        this.addLog(session.callId, 'info', 'Transcript updated in MongoDB', { transcriptId: transcript._id });
      } else {
        // Create new transcript
        transcript = new Transcript(transcriptData);
        await transcript.save();
        this.addLog(session.callId, 'success', 'Transcript saved to MongoDB', { transcriptId: transcript._id });
      }

      return transcript;
    } catch (error) {
      this.addLog(session.callId, 'error', 'Failed to save transcript', { error: error.message });
      console.error('❌ Error saving transcript:', error);
      return null;
    }
  }

  /**
   * Get recent logs
   * @param {number} limit - Number of logs to return
   * @param {string} callId - Optional: filter by call ID
   * @returns {Array} Array of log entries
   */
  getRecentLogs(limit = 100, callId = null) {
    let logs = [...this.logBuffer];

    if (callId) {
      logs = logs.filter(log => log.callId === callId);
    }

    // Sort by timestamp (newest first)
    logs.sort((a, b) => b.timestamp - a.timestamp);

    return logs.slice(0, limit);
  }

  /**
   * Get all transcripts from MongoDB
   * @param {Object} filters - Optional filters (callId, status, etc.)
   * @param {number} limit - Maximum number of transcripts to return
   * @returns {Promise<Array>} Array of transcripts
   */
  async getTranscripts(filters = {}, limit = 50) {
    try {
      await connectDB();

      const query = {};
      if (filters.callId) query.callId = filters.callId;
      if (filters.status) query.status = filters.status;
      if (filters.direction) query.direction = filters.direction;

      const transcripts = await Transcript.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      return transcripts;
    } catch (error) {
      this.addLog('system', 'error', 'Failed to get transcripts', { error: error.message });
      console.error('❌ Error getting transcripts:', error);
      return [];
    }
  }

  /**
   * Get transcript by call ID
   * @param {string} callId - Call ID
   * @returns {Promise<Object|null>} Transcript or null
   */
  async getTranscriptByCallId(callId) {
    try {
      await connectDB();
      const transcript = await Transcript.findOne({ callId }).lean();
      return transcript;
    } catch (error) {
      this.addLog('system', 'error', 'Failed to get transcript by callId', { callId, error: error.message });
      return null;
    }
  }

  /**
   * Get monitoring statistics
   * @returns {Promise<Object>} Statistics object
   */
  async getStatistics() {
    try {
      await connectDB();

      const totalTranscripts = await Transcript.countDocuments();
      const activeCalls = await Transcript.countDocuments({ status: 'active' });
      const completedCalls = await Transcript.countDocuments({ status: 'completed' });
      const failedCalls = await Transcript.countDocuments({ status: 'failed' });

      const recentTranscripts = await Transcript.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .select('callId duration status createdAt')
        .lean();

      const avgDuration = await Transcript.aggregate([
        { $match: { status: 'completed', duration: { $gt: 0 } } },
        { $group: { _id: null, avgDuration: { $avg: '$duration' } } }
      ]);

      return {
        transcripts: {
          total: totalTranscripts,
          active: activeCalls,
          completed: completedCalls,
          failed: failedCalls
        },
        logs: {
          inBuffer: this.logBuffer.length,
          maxBufferSize: this.maxLogBufferSize
        },
        recentCalls: recentTranscripts,
        averageDuration: avgDuration.length > 0 ? Math.round(avgDuration[0].avgDuration) : 0
      };
    } catch (error) {
      this.addLog('system', 'error', 'Failed to get statistics', { error: error.message });
      return {
        transcripts: { total: 0, active: 0, completed: 0, failed: 0 },
        logs: { inBuffer: this.logBuffer.length, maxBufferSize: this.maxLogBufferSize },
        recentCalls: [],
        averageDuration: 0
      };
    }
  }

  /**
   * Check if transcripts are being generated
   * @returns {Promise<Object>} Status object
   */
  async checkTranscriptGeneration() {
    try {
      await connectDB();

      // Check if any transcripts exist
      const transcriptCount = await Transcript.countDocuments();
      
      // Check recent transcripts (last 1 hour)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentTranscripts = await Transcript.countDocuments({
        createdAt: { $gte: oneHourAgo }
      });

      // Check if logs are being generated
      const recentLogs = this.getRecentLogs(10);
      const logsInLastHour = recentLogs.filter(
        log => new Date() - log.timestamp < 60 * 60 * 1000
      ).length;

      return {
        transcripts: {
          enabled: true,
          totalCount: transcriptCount,
          recentCount: recentTranscripts,
          status: transcriptCount > 0 ? 'active' : 'no_data'
        },
        logs: {
          enabled: true,
          inBuffer: this.logBuffer.length,
          recentCount: logsInLastHour,
          status: logsInLastHour > 0 ? 'active' : 'no_recent_logs'
        },
        overall: {
          status: (transcriptCount > 0 || logsInLastHour > 0) ? 'healthy' : 'no_activity',
          message: transcriptCount > 0 
            ? `✅ Transcripts are being generated (${transcriptCount} total, ${recentTranscripts} in last hour)`
            : '⚠️ No transcripts found yet'
        }
      };
    } catch (error) {
      return {
        transcripts: { enabled: false, error: error.message },
        logs: { enabled: true, inBuffer: this.logBuffer.length },
        overall: { status: 'error', message: `Error checking: ${error.message}` }
      };
    }
  }
}

export const monitoringService = new MonitoringService();

