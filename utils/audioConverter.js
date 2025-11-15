/**
 * Audio Conversion Utility
 * Converts MP3/WAV to 16-bit, 8kHz, mono PCM format (Exotel's preferred format)
 * 
 * Uses ffmpeg if available, otherwise falls back to Node.js libraries
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, unlinkSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';

const execAsync = promisify(exec);

class AudioConverter {
  constructor() {
    this.useFfmpeg = null; // Will be checked on first use
    this.tempDir = tmpdir();
  }

  /**
   * Check if ffmpeg is available
   */
  async checkFfmpeg() {
    if (this.useFfmpeg !== null) {
      return this.useFfmpeg;
    }

    try {
      await execAsync('ffmpeg -version');
      this.useFfmpeg = true;
      console.log('✅ ffmpeg found - will use for audio conversion');
      return true;
    } catch (error) {
      this.useFfmpeg = false;
      console.warn('⚠️  ffmpeg not found - will use Node.js fallback (may be slower)');
      return false;
    }
  }

  /**
   * Convert audio buffer to 16-bit, 16kHz, mono PCM
   * 
   * @param {Buffer} audioBuffer - Input audio (MP3, WAV, etc.)
   * @param {string} inputFormat - Input format ('mp3', 'wav', 'auto')
   * @param {number} sampleRate - Target sample rate (default: 16000)
   * @returns {Promise<Buffer>} - PCM audio buffer (16-bit, 16kHz, mono)
   */
  async convertToPCM(audioBuffer, inputFormat = 'auto', sampleRate = 16000) {
    const hasFfmpeg = await this.checkFfmpeg();

    if (hasFfmpeg) {
      return await this.convertWithFfmpeg(audioBuffer, inputFormat, sampleRate);
    } else {
      // Fallback: Try to use Node.js libraries
      // For now, return error - user should install ffmpeg
      throw new Error(
        'ffmpeg not found. Please install ffmpeg:\n' +
        '  Windows: choco install ffmpeg\n' +
        '  macOS: brew install ffmpeg\n' +
        '  Linux: apt-get install ffmpeg\n' +
        '\nOr set FFMPEG_PATH environment variable to ffmpeg executable path.'
      );
    }
  }

  /**
   * Convert using ffmpeg (recommended)
   */
  async convertWithFfmpeg(audioBuffer, inputFormat = 'auto', sampleRate = 16000) {
    const inputFile = join(this.tempDir, `input_${randomBytes(8).toString('hex')}.${inputFormat === 'auto' ? 'mp3' : inputFormat}`);
    const outputFile = join(this.tempDir, `output_${randomBytes(8).toString('hex')}.pcm`);

    try {
      // Write input file
      writeFileSync(inputFile, audioBuffer);

      // Convert to PCM: 16-bit, 16kHz, mono
      // -f s16le: signed 16-bit little-endian PCM
      // -ar 16000: sample rate 16kHz (mandatory)
      // -ac 1: mono (1 channel)
      // -y: overwrite output file if exists
      // Note: ffmpeg auto-detects input format from file extension/content
      const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
      const command = `${ffmpegPath} -i "${inputFile}" -f s16le -ar ${sampleRate} -ac 1 "${outputFile}" -y`;

      await execAsync(command);

      // Read output file
      const pcmBuffer = readFileSync(outputFile);

      // Cleanup
      try {
        unlinkSync(inputFile);
        unlinkSync(outputFile);
      } catch (cleanupError) {
        // Ignore cleanup errors
        console.warn('Warning: Could not clean up temp files:', cleanupError.message);
      }

      console.log(`✅ Audio converted: ${audioBuffer.length} bytes → ${pcmBuffer.length} bytes PCM (16-bit, ${sampleRate}Hz, mono)`);
      return pcmBuffer;
    } catch (error) {
      // Cleanup on error
      try {
        unlinkSync(inputFile);
        unlinkSync(outputFile);
      } catch (cleanupError) {
        // Ignore
      }

      console.error('❌ ffmpeg conversion error:', error.message);
      throw new Error(`Audio conversion failed: ${error.message}`);
    }
  }

  /**
   * Resample PCM buffer from one sample rate to another
   * Uses ffmpeg to resample raw PCM data
   * 
   * @param {Buffer} pcmBuffer - Input PCM buffer (16-bit, little-endian, mono)
   * @param {number} inputSampleRate - Input sample rate (e.g., 24000)
   * @param {number} outputSampleRate - Target sample rate (e.g., 16000)
   * @returns {Promise<Buffer>} - Resampled PCM buffer
   */
  async resamplePCM(pcmBuffer, inputSampleRate, outputSampleRate) {
    const hasFfmpeg = await this.checkFfmpeg();
    if (!hasFfmpeg) {
      throw new Error('ffmpeg required for PCM resampling');
    }

    // Create temporary WAV file from input PCM
    const inputWav = join(this.tempDir, `input_${randomBytes(8).toString('hex')}.wav`);
    const outputPcm = join(this.tempDir, `output_${randomBytes(8).toString('hex')}.pcm`);

    try {
      // Create WAV header for input PCM
      const numChannels = 1;
      const bitsPerSample = 16;
      const byteRate = inputSampleRate * numChannels * (bitsPerSample / 8);
      const blockAlign = numChannels * (bitsPerSample / 8);
      const dataSize = pcmBuffer.length;
      const fileSize = 36 + dataSize;

      const wavHeader = Buffer.alloc(44);
      wavHeader.write('RIFF', 0);
      wavHeader.writeUInt32LE(fileSize, 4);
      wavHeader.write('WAVE', 8);
      wavHeader.write('fmt ', 12);
      wavHeader.writeUInt32LE(16, 16);
      wavHeader.writeUInt16LE(1, 20);
      wavHeader.writeUInt16LE(numChannels, 22);
      wavHeader.writeUInt32LE(inputSampleRate, 24);
      wavHeader.writeUInt32LE(byteRate, 28);
      wavHeader.writeUInt16LE(blockAlign, 32);
      wavHeader.writeUInt16LE(bitsPerSample, 34);
      wavHeader.write('data', 36);
      wavHeader.writeUInt32LE(dataSize, 40);

      const inputWavBuffer = Buffer.concat([wavHeader, pcmBuffer]);
      writeFileSync(inputWav, inputWavBuffer);

      // Resample using ffmpeg
      const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
      const command = `${ffmpegPath} -i "${inputWav}" -f s16le -ar ${outputSampleRate} -ac 1 "${outputPcm}" -y`;
      await execAsync(command);

      // Read resampled PCM
      const resampledBuffer = readFileSync(outputPcm);

      // Cleanup
      try {
        unlinkSync(inputWav);
        unlinkSync(outputPcm);
      } catch (cleanupError) {
        console.warn('Warning: Could not clean up temp files:', cleanupError.message);
      }

      console.log(`✅ PCM resampled: ${inputSampleRate}Hz → ${outputSampleRate}Hz (${pcmBuffer.length} → ${resampledBuffer.length} bytes)`);
      return resampledBuffer;
    } catch (error) {
      // Cleanup on error
      try {
        unlinkSync(inputWav);
        unlinkSync(outputPcm);
      } catch (cleanupError) {
        // Ignore
      }
      throw new Error(`PCM resampling failed: ${error.message}`);
    }
  }

  /**
   * Chunk PCM buffer into specified size chunks
   * Default: 640 bytes (~20ms at 16kHz)
   * 
   * @param {Buffer} pcmBuffer - PCM audio buffer
   * @param {number} chunkSize - Chunk size in bytes (default: 640 for 16kHz)
   * @returns {Buffer[]} - Array of chunk buffers
   */
  chunkPCM(pcmBuffer, chunkSize = 640) {
    const chunks = [];
    for (let i = 0; i < pcmBuffer.length; i += chunkSize) {
      chunks.push(pcmBuffer.slice(i, Math.min(i + chunkSize, pcmBuffer.length)));
    }
    return chunks;
  }
}

export const audioConverter = new AudioConverter();

