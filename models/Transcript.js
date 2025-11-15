/**
 * Transcript Model
 * Stores conversation transcripts from voice calls
 */

import mongoose from 'mongoose';

const transcriptSchema = new mongoose.Schema({
  callId: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  callSid: {
    type: String,
    trim: true,
    index: true
  },
  from: {
    type: String,
    trim: true
  },
  to: {
    type: String,
    trim: true
  },
  direction: {
    type: String,
    enum: ['inbound', 'outbound-api'],
    default: 'inbound'
  },
  conversationHistory: {
    type: [{
      role: {
        type: String,
        enum: ['system', 'user', 'assistant'],
        required: true
      },
      content: {
        type: String,
        required: true
      },
      timestamp: {
        type: Date,
        default: Date.now
      }
    }],
    default: []
  },
  duration: {
    type: Number, // Duration in seconds
    default: 0
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  endedAt: {
    type: Date
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'failed'],
    default: 'active'
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true // Adds createdAt and updatedAt automatically
});

// Create indexes for efficient queries
transcriptSchema.index({ callId: 1 });
transcriptSchema.index({ callSid: 1 });
transcriptSchema.index({ createdAt: -1 });
transcriptSchema.index({ status: 1 });

const Transcript = mongoose.models.Transcript || mongoose.model('Transcript', transcriptSchema);

export default Transcript;

