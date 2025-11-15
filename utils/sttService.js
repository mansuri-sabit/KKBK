/**
 * Speech-to-Text Service
 * Transcribes PCM audio to text using Deepgram API
 */

import dotenv from 'dotenv';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';

dotenv.config();

class STTService {
  constructor() {
    // Use Deepgram directly
    this.deepgramApiKey = process.env.DEEPGRAM_API_KEY;
  }

  /**
   * Transcribe PCM audio buffer to text using Deepgram
   * Main method - uses Deepgram API directly
   * 
   * @param {Buffer} pcmBuffer - PCM audio buffer (16-bit, 16kHz, mono)
   * @param {number} sampleRate - Sample rate (default: 16000)
   * @param {string} language - Language code (default: 'en')
   * @param {number} maxRetries - Maximum number of retry attempts (default: 3, unused for now)
   * @returns {Promise<string|null>} - Transcribed text or null on failure
   */
  async transcribePCM(pcmBuffer, sampleRate = 16000, language = 'en', maxRetries = 3) {
    if (!this.deepgramApiKey) {
      console.error('❌ DEEPGRAM_API_KEY not configured for STT');
      return null;
    }

    if (!pcmBuffer || pcmBuffer.length === 0) {
      console.warn('⚠️  Empty PCM buffer provided to STT');
      return null;
    }

    // Use Deepgram directly
    return await this.transcribeWithDeepgram(pcmBuffer, sampleRate, language);
  }

  /**
   * Transcribe PCM audio buffer to text (alias for transcribePCM)
   * 
   * @param {Buffer} pcmBuffer - PCM audio buffer (16-bit, 16kHz, mono)
   * @param {Object} options - Optional configuration
   * @param {string} options.language - Language code (default: 'en')
   * @returns {Promise<string|null>} - Transcribed text or null on failure
   */
  async transcribePcmBuffer(pcmBuffer, options = {}) {
    return await this.transcribePCM(pcmBuffer);
  }

  /**
   * Convert PCM buffer to WAV file
   * Creates a temporary WAV file that Whisper API can process
   * 
   * @param {Buffer} pcmBuffer - PCM audio buffer (16-bit, 16kHz, mono)
   * @param {number} sampleRate - Sample rate (default: 16000)
   * @returns {Promise<string>} - Path to temporary WAV file
   */
  async pcmToWavFile(pcmBuffer, sampleRate = 16000) {
    const tempDir = tmpdir();
    const tempFileName = `stt_${randomBytes(8).toString('hex')}.wav`;
    const tempFilePath = join(tempDir, tempFileName);

    // WAV file header for 16-bit, 16kHz, mono PCM
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataSize = pcmBuffer.length;
    const fileSize = 36 + dataSize;

    const wavHeader = Buffer.alloc(44);
    
    // RIFF header
    wavHeader.write('RIFF', 0);
    wavHeader.writeUInt32LE(fileSize, 4);
    wavHeader.write('WAVE', 8);
    
    // fmt chunk
    wavHeader.write('fmt ', 12);
    wavHeader.writeUInt32LE(16, 16); // fmt chunk size
    wavHeader.writeUInt16LE(1, 20); // audio format (1 = PCM)
    wavHeader.writeUInt16LE(numChannels, 22);
    wavHeader.writeUInt32LE(sampleRate, 24);
    wavHeader.writeUInt32LE(byteRate, 28);
    wavHeader.writeUInt16LE(blockAlign, 32);
    wavHeader.writeUInt16LE(bitsPerSample, 34);
    
    // data chunk
    wavHeader.write('data', 36);
    wavHeader.writeUInt32LE(dataSize, 40);

    // Write WAV file
    const wavBuffer = Buffer.concat([wavHeader, pcmBuffer]);
    writeFileSync(tempFilePath, wavBuffer);

    return tempFilePath;
  }

  /**
   * Transcribe audio using Deepgram API
   * 
   * @param {Buffer} pcmBuffer - PCM audio buffer (16-bit, 16kHz, mono)
   * @param {number} sampleRate - Sample rate (default: 16000)
   * @param {string} language - Language code (default: 'en')
   * @returns {Promise<string|null>} - Transcribed text or null on failure
   */
  async transcribeWithDeepgram(pcmBuffer, sampleRate = 16000, language = 'en') {
    if (!this.deepgramApiKey) {
      console.error('❌ DEEPGRAM_API_KEY not configured for STT fallback');
      return null;
    }

    if (!pcmBuffer || pcmBuffer.length === 0) {
      console.warn('⚠️  Empty PCM buffer provided to Deepgram STT');
      return null;
    }

    let tempFile = null;
    try {
      console.log(`🎤 Using Deepgram STT (fallback)...`);
      console.log(`   Audio buffer size: ${pcmBuffer.length} bytes, Sample rate: ${sampleRate}Hz`);
      
      // Create WAV file from PCM
      tempFile = await this.pcmToWavFile(pcmBuffer, sampleRate);
      const { readFile } = await import('fs/promises');
      const audioBuffer = await readFile(tempFile);
      console.log(`   Created WAV file: ${audioBuffer.length} bytes`);
      
      // Call Deepgram API
      const axios = (await import('axios')).default;
      console.log(`   Calling Deepgram API...`);
      const response = await axios.post(
        'https://api.deepgram.com/v1/listen',
        audioBuffer,
        {
          headers: {
            'Authorization': `Token ${this.deepgramApiKey}`,
            'Content-Type': 'audio/wav'
          },
          params: {
            model: 'nova-2',
            language: language || 'en',
            punctuate: true,
            diarize: false
          },
          timeout: 30000
        }
      );

      console.log(`   Deepgram API response received`);
      
      // Check response structure
      if (!response.data || !response.data.results) {
        console.warn(`⚠️  Deepgram STT: Unexpected response structure:`, JSON.stringify(response.data).substring(0, 200));
        return null;
      }

      // Debug: Log full response structure
      const channel = response.data?.results?.channels?.[0];
      const alternative = channel?.alternatives?.[0];
      
      console.log(`   Response debug:`, {
        hasResults: !!response.data.results,
        channelsCount: response.data.results?.channels?.length || 0,
        hasChannel: !!channel,
        alternativesCount: channel?.alternatives?.length || 0,
        hasAlternative: !!alternative,
        transcript: alternative?.transcript || 'null/undefined',
        confidence: alternative?.confidence || 'N/A',
        words: alternative?.words?.length || 0
      });

      const transcription = alternative?.transcript;
      const transcribedText = transcription?.trim() || null;

      if (transcribedText) {
        console.log(`✅ Deepgram STT transcription received: "${transcribedText}" (${transcribedText.length} characters)`);
        return transcribedText;
      }

      // Log if transcription is empty - check if it's silence or no speech detected
      if (alternative && alternative.transcript === '') {
        console.warn(`⚠️  Deepgram STT: Empty transcript - user may not have spoken or audio contains only silence`);
        console.warn(`   Confidence: ${alternative.confidence || 'N/A'}, Words: ${alternative.words?.length || 0}`);
      } else if (!alternative) {
        console.warn(`⚠️  Deepgram STT: No alternative found in response`);
      } else {
        console.warn(`⚠️  Deepgram STT: Transcription field is null/undefined`);
      }
      
      return null;
    } catch (error) {
      let errorMessage = error.message || 'Unknown error';
      if (error.response?.data) {
        const errorData = error.response.data;
        if (Buffer.isBuffer(errorData)) {
          try {
            const parsed = JSON.parse(errorData.toString());
            errorMessage = parsed.err_msg || parsed.message || errorData.toString();
          } catch {
            errorMessage = errorData.toString();
          }
        } else if (typeof errorData === 'object') {
          errorMessage = errorData.err_msg || errorData.message || JSON.stringify(errorData);
        } else {
          errorMessage = String(errorData);
        }
      }
      console.error('❌ Deepgram STT error:', errorMessage);
      if (error.response?.status) {
        console.error(`   Status: ${error.response.status}`);
      }
      return null;
    } finally {
      // Clean up temp file
      if (tempFile) {
        try {
          unlinkSync(tempFile);
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
      }
    }
  }
}

export const sttService = new STTService();

