/**
 * Document Model
 * Stores uploaded documents and their parsed text chunks for RAG
 */

import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true,
    trim: true
  },
  mimetype: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  chunks: {
    type: [String],
    default: [],
    required: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true // Adds createdAt and updatedAt automatically
});

// Create index on uploadedAt for sorting
documentSchema.index({ uploadedAt: -1 });

const Document = mongoose.models.Document || mongoose.model('Document', documentSchema);

export default Document;

