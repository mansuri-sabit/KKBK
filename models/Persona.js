/**
 * Persona Model
 * Stores AI persona/system prompt text in MongoDB
 */

import mongoose from 'mongoose';

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
  timestamps: true // Adds createdAt and updatedAt automatically
});

// Update updatedAt on save
personaSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Note: unique: true on name field automatically creates a unique index

const Persona = mongoose.models.Persona || mongoose.model('Persona', personaSchema);

export default Persona;

