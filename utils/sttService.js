/**
 * Speech-to-Text Service
 * Transcribes PCM audio to text using OpenAI Whisper API
 */

import OpenAI from 'openai';
import dotenv from 'dotenv';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';

dotenv.config();

class STTService {
  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    this.client = this.openaiApiKey ? new OpenAI({ apiKey: this.openaiApiKey }) : null;
    
    // Deepgram fallback
    this.deepgramApiKey = process.env.DEEPGRAM_API_KEY;
  }

  /**
   * Transcribe PCM audio buffer to text using OpenAI Whisper
   * Main method - uses OpenAI SDK
   * Includes retry logic with exponential backoff for connection/rate limit errors
   * 
   * @param {Buffer} pcmBuffer - PCM audio buffer (16-bit, 16kHz, mono)
   * @param {number} sampleRate - Sample rate (default: 16000)
   * @param {string} language - Language code (default: 'en')
   * @param {number} maxRetries - Maximum number of retry attempts (default: 3)
   * @returns {Promise<string|null>} - Transcribed text or null on failure
   */
  async transcribePCM(pcmBuffer, sampleRate = 16000, language = 'en', maxRetries = 3) {
    if (!this.client) {
      console.error('❌ OPENAI_API_KEY not configured for STT');
      return null;
    }

    if (!pcmBuffer || pcmBuffer.length === 0) {
      console.warn('⚠️  Empty PCM buffer provided to STT');
      return null;
    }

    let tempFile = null;
    let lastError = null;

    try {
      // Create a temporary WAV file from PCM
      tempFile = await this.pcmToWavFile(pcmBuffer, sampleRate);
      
      // Read file as File object for OpenAI SDK
      const { readFile } = await import('fs/promises');
      const fileBuffer = await readFile(tempFile);
      
      // Create File object for OpenAI SDK
      const file = new File([fileBuffer], 'audio.wav', { type: 'audio/wav' });
      
      // Retry logic for API calls
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          // Call OpenAI Whisper API using OpenAI SDK
          const transcription = await this.client.audio.transcriptions.create({
            file: file,
            model: 'whisper-1',
            response_format: 'text',
            language: language || 'en',
            timeout: 30000 // 30 second timeout
          });

          const transcribedText = typeof transcription === 'string' 
            ? transcription.trim() 
            : String(transcription).trim();
          
          if (attempt > 0) {
            console.log(`✅ Whisper STT succeeded on retry attempt ${attempt + 1}`);
          }
          
          return transcribedText || null;
        } catch (error) {
          lastError = error;
          const errorStatus = error.status || error.response?.status;
          let errorMessage = error.message || String(error);
          
          // Parse error data if available
          let errorData = error.response?.data || error.error;
          if (Buffer.isBuffer(errorData)) {
            try {
              errorData = JSON.parse(errorData.toString());
              errorMessage = errorData?.error?.message || errorMessage;
            } catch {
              // Ignore parse errors
            }
          }
          
          // Check if it's a quota error - try Deepgram fallback immediately
          const isQuotaError = errorStatus === 429 || 
                            errorMessage.toLowerCase().includes('quota') ||
                            errorMessage.toLowerCase().includes('billing') ||
                            errorData?.error?.type === 'insufficient_quota';
          
          if (isQuotaError && this.deepgramApiKey && attempt === 0) {
            // Don't retry quota errors, go straight to fallback
            console.warn(`⚠️  OpenAI STT quota exceeded, falling back to Deepgram immediately...`);
            break; // Exit retry loop, will use fallback
          }
          
          // Check if it's a connection error - try Deepgram fallback immediately
          const isConnectionError = errorMessage.toLowerCase().includes('connection') ||
                                   errorMessage.toLowerCase().includes('econnreset') ||
                                   errorMessage.toLowerCase().includes('enotfound') ||
                                   errorMessage.toLowerCase().includes('etimedout') ||
                                   errorMessage.toLowerCase().includes('network') ||
                                   errorMessage.toLowerCase().includes('socket');
          
          if (isConnectionError && this.deepgramApiKey && attempt === 0) {
            // Don't retry connection errors, go straight to fallback
            console.warn(`⚠️  OpenAI STT connection error detected, falling back to Deepgram immediately...`);
            break; // Exit retry loop, will use fallback
          }
          
          // Check if it's a retryable error
          const isRetryable = 
            errorStatus === 429 || // Rate limit
            errorStatus >= 500 || // Server errors
            errorMessage.toLowerCase().includes('connection') || // Connection errors
            errorMessage.toLowerCase().includes('timeout') || // Timeout errors
            errorMessage.toLowerCase().includes('econnreset') ||
            errorMessage.toLowerCase().includes('enotfound') ||
            errorMessage.toLowerCase().includes('etimedout');
          
          if (isRetryable && attempt < maxRetries) {
            // Calculate wait time with exponential backoff
            const waitTime = errorStatus === 429 
              ? (error.response?.headers?.['retry-after'] ? parseInt(error.response.headers['retry-after']) * 1000 : Math.min(1000 * Math.pow(2, attempt), 30000))
              : Math.min(1000 * Math.pow(2, attempt), 10000);
            
            console.warn(`⚠️  Whisper STT error (${errorStatus || 'connection'}) - Attempt ${attempt + 1}/${maxRetries + 1}, retrying in ${waitTime}ms`);
            console.warn(`   Error: ${errorMessage.substring(0, 200)}`);
            
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue; // Retry
          } else {
            // Non-retryable error or max retries exceeded
            if (attempt >= maxRetries) {
              console.error(`❌ Whisper STT failed after ${maxRetries + 1} attempts`);
            } else {
              console.error(`❌ Whisper STT non-retryable error: ${errorMessage}`);
            }
            break; // Don't retry
          }
        }
      }
      
      // All retries failed - try Deepgram fallback
      if (lastError && this.deepgramApiKey) {
        const errorStatus = lastError.status || lastError.response?.status;
        let errorMessage = lastError.message || String(lastError);
        let errorData = lastError.response?.data;
        
        // Parse error data if Buffer
        if (Buffer.isBuffer(errorData)) {
          try {
            errorData = JSON.parse(errorData.toString());
            errorMessage = errorData?.error?.message || errorMessage;
          } catch {
            // Ignore parse errors
          }
        }
        
        const isQuotaError = errorStatus === 429 || 
                            errorMessage.toLowerCase().includes('quota') ||
                            errorMessage.toLowerCase().includes('billing') ||
                            errorData?.error?.type === 'insufficient_quota';
        
        const isConnectionError = errorMessage.toLowerCase().includes('connection') ||
                                 errorMessage.toLowerCase().includes('econnreset') ||
                                 errorMessage.toLowerCase().includes('enotfound') ||
                                 errorMessage.toLowerCase().includes('etimedout') ||
                                 errorMessage.toLowerCase().includes('network') ||
                                 errorMessage.toLowerCase().includes('socket');
        
        // Try Deepgram fallback for quota or connection errors
        if (isQuotaError || isConnectionError) {
          console.warn(`⚠️  OpenAI STT failed (${isQuotaError ? 'quota' : 'connection'}), falling back to Deepgram...`);
          return await this.transcribeWithDeepgram(pcmBuffer, sampleRate, language);
        }
      }
      
      return null;
    } catch (error) {
      console.error('❌ Whisper STT error:', error.message || error);
      
      // Try Deepgram fallback on any error if available
      if (this.deepgramApiKey) {
        console.warn(`⚠️  OpenAI STT failed, trying Deepgram fallback...`);
        try {
          return await this.transcribeWithDeepgram(pcmBuffer, sampleRate, language);
        } catch (fallbackError) {
          console.error('❌ Deepgram STT fallback also failed:', fallbackError.message);
        }
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

  /**
   * Transcribe PCM audio buffer to text (alias for transcribePCM)
   * 
   * @param {Buffer} pcmBuffer - PCM audio buffer (16-bit, 8kHz, mono)
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
   * Transcribe audio using Deepgram API (fallback when OpenAI fails)
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

