/**
 * TTS Service Utility
 * Supports multiple TTS providers: OpenAI, Google, or simple fallback
 */

import axios from 'axios';
import dotenv from 'dotenv';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

dotenv.config();

class TTSService {
  constructor() {
    this.provider = process.env.TTS_PROVIDER || 'openai'; // 'openai', 'google', 'elevenlabs', 'deepgram'
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    this.googleApiKey = process.env.GOOGLE_TTS_API_KEY;
    this.elevenlabsApiKey = process.env.ELEVENLABS_API_KEY;
    this.deepgramApiKey = process.env.DEEPGRAM_API_KEY;
    this.elevenlabsVoiceId = process.env.ELEVEN_VOICE_ID || 'Rachel';
    this.elevenlabsClient = this.elevenlabsApiKey ? new ElevenLabsClient({ apiKey: this.elevenlabsApiKey }) : null;
  }

  /**
   * Map OpenAI voice names to Deepgram voice names
   */
  mapVoiceToDeepgram(openaiVoice) {
    const voiceMap = {
      'shimmer': 'aura-asteria-en',  // Female
      'alloy': 'aura-luna-en',        // Female
      'echo': 'aura-stella-en',        // Female
      'fable': 'aura-athena-en',      // Female
      'onyx': 'aura-hera-en',         // Female
      'nova': 'aura-luna-en'           // Female (changed from aura-orion-en)
    };
    return voiceMap[openaiVoice] || 'aura-asteria-en'; // Default to female voice
  }

  /**
   * Synthesize text to speech with automatic fallback
   * Returns audio buffer (PCM format)
   * 
   * @param {string} text - Text to synthesize
   * @param {string} voice - Voice ID (provider-specific)
   * @param {number} sampleRate - Target sample rate (default: 16000)
   * @returns {Promise<{buffer: Buffer, sourceSampleRate: number}>} - Audio buffer and source sample rate
   */
  async synthesize(text, voice = null, sampleRate = 16000) {
    console.log(`🎙️ TTS synthesis using ${this.provider}:`, { textLength: text.length, voice, sampleRate });

    // Try OpenAI first
    if (this.openaiApiKey) {
      try {
        const buffer = await this.synthesizeOpenAI(text, voice, sampleRate);
        // OpenAI returns 24kHz PCM
        return { buffer, sourceSampleRate: 24000 };
      } catch (error) {
        const errorStatus = error.response?.status || error.status;
        const errorMessage = error.message || String(error);
        let errorData = error.response?.data;
        
        // Parse error data if Buffer
        if (Buffer.isBuffer(errorData)) {
          try {
            errorData = JSON.parse(errorData.toString());
          } catch {
            // Ignore parse errors
          }
        }
        
        // Check if it's a quota error - try Deepgram fallback
        const isQuotaError = errorStatus === 429 || 
                            errorMessage.toLowerCase().includes('quota') ||
                            errorMessage.toLowerCase().includes('billing') ||
                            errorData?.error?.type === 'insufficient_quota';
        
        if (isQuotaError && this.deepgramApiKey) {
          console.warn(`⚠️  OpenAI TTS quota exceeded, falling back to Deepgram...`);
          const buffer = await this.synthesizeDeepgram(text, voice, sampleRate);
          // Deepgram returns at target sample rate (already converted)
          return { buffer, sourceSampleRate: sampleRate };
        }
        
        // Re-throw if not quota error or no fallback available
        throw error;
      }
    }

    // If no OpenAI key, try Deepgram
    if (this.deepgramApiKey) {
      const buffer = await this.synthesizeDeepgram(text, voice, sampleRate);
      return { buffer, sourceSampleRate: sampleRate };
    }

    throw new Error('No TTS provider configured. Please set OPENAI_API_KEY or DEEPGRAM_API_KEY.');
  }

  /**
   * OpenAI TTS (tts-1-hd model for best quality)
   * Returns raw 16-bit PCM format (16kHz, mono)
   * Includes retry logic with exponential backoff for rate limit errors
   */
  async synthesizeOpenAI(text, voice = 'shimmer', sampleRate = 16000, maxRetries = 3) {
    if (!this.openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const validVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
    const selectedVoice = voice && validVoices.includes(voice) ? voice : 'shimmer';

    let lastError = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Request PCM format for raw audio output
        const response = await axios.post(
          'https://api.openai.com/v1/audio/speech',
          {
            model: 'tts-1-hd', // Best quality model
            input: text,
            voice: selectedVoice,
            response_format: 'pcm', // Raw PCM format
            speed: 1.0
          },
          {
            headers: {
              'Authorization': `Bearer ${this.openaiApiKey}`,
              'Content-Type': 'application/json'
            },
            responseType: 'arraybuffer',
            timeout: 30000 // 30 second timeout
          }
        );

        // OpenAI returns PCM at 24kHz, need to resample to 16kHz
        const pcmBuffer = Buffer.from(response.data);
        
        // If sample rate is already 16kHz, return as-is
        // Otherwise, we'll need to resample (handled by audioConverter)
        if (attempt > 0) {
          console.log(`✅ OpenAI TTS succeeded on retry attempt ${attempt + 1}`);
        }
        return pcmBuffer;
      } catch (error) {
        lastError = error;
        const statusCode = error.response?.status;
        let errorData = error.response?.data;
        
        // Parse error data if it's a Buffer
        if (Buffer.isBuffer(errorData)) {
          try {
            errorData = JSON.parse(errorData.toString());
          } catch {
            // If parsing fails, use as string
            errorData = { error: { message: errorData.toString() } };
          }
        }
        
        // Log error details
        if (statusCode === 429) {
          // Check if it's a quota error (don't retry) vs rate limit (retry)
          const errorMessage = errorData?.error?.message || error.message || '';
          const isQuotaError = errorMessage.toLowerCase().includes('quota') || 
                              errorMessage.toLowerCase().includes('billing') ||
                              errorData?.error?.type === 'insufficient_quota';
          
          if (isQuotaError) {
            // Quota exceeded - don't retry, this won't fix itself
            console.error(`❌ OpenAI TTS quota exceeded - No retries will help. Please check your OpenAI billing/quota.`);
            console.error(`   Error: ${errorMessage}`);
            break; // Don't retry quota errors
          }
          
          // Regular rate limit - retry with backoff
          const retryAfter = error.response?.headers['retry-after'] || null;
          const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : Math.min(1000 * Math.pow(2, attempt), 30000);
          
          console.warn(`⚠️  OpenAI TTS rate limit (429) - Attempt ${attempt + 1}/${maxRetries + 1}`);
          if (retryAfter) {
            console.log(`   Retry-After header: ${retryAfter}s - waiting ${waitTime}ms`);
          } else {
            console.log(`   Exponential backoff: waiting ${waitTime}ms`);
          }
          
          // Only retry if we haven't exceeded max retries
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue; // Retry
          } else {
            console.error('❌ OpenAI TTS rate limit exceeded after all retries');
          }
        } else if (statusCode >= 500 && statusCode < 600) {
          // Server errors - retry with exponential backoff
          const waitTime = Math.min(1000 * Math.pow(2, attempt), 10000);
          console.warn(`⚠️  OpenAI TTS server error (${statusCode}) - Attempt ${attempt + 1}/${maxRetries + 1}, retrying in ${waitTime}ms`);
          
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue; // Retry
          }
        } else {
          // Other errors (4xx except 429) - don't retry
          console.error('OpenAI TTS error:', errorData || error.message);
          break; // Don't retry for client errors
        }
      }
    }
    
    // If we get here, all retries failed
    let errorMessage = 'Unknown error';
    if (lastError?.response?.data) {
      const errorData = lastError.response.data;
      // Handle Buffer objects
      if (Buffer.isBuffer(errorData)) {
        try {
          const parsed = JSON.parse(errorData.toString());
          errorMessage = parsed.error?.message || parsed.message || errorData.toString();
        } catch {
          errorMessage = errorData.toString();
        }
      } else if (typeof errorData === 'object') {
        errorMessage = errorData.error?.message || errorData.message || JSON.stringify(errorData);
      } else {
        errorMessage = String(errorData);
      }
    } else if (lastError?.message) {
      errorMessage = lastError.message;
    }
    throw new Error(`OpenAI TTS failed after ${maxRetries + 1} attempts: ${errorMessage}`);
  }

  /**
   * Google Cloud Text-to-Speech
   * Returns MP3 format
   */
  async synthesizeGoogle(text, voice = 'en-US-Standard-B') {
    if (!this.googleApiKey) {
      throw new Error('GOOGLE_TTS_API_KEY not configured');
    }

    try {
      const response = await axios.post(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${this.googleApiKey}`,
        {
          input: { text },
          voice: {
            languageCode: 'en-US',
            name: voice,
            ssmlGender: 'NEUTRAL'
          },
          audioConfig: {
            audioEncoding: 'MP3',
            sampleRateHertz: 24000
          }
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      // Google returns base64 encoded audio
      return Buffer.from(response.data.audioContent, 'base64');
    } catch (error) {
      console.error('Google TTS error:', error.response?.data || error.message);
      throw new Error(`Google TTS failed: ${error.message}`);
    }
  }

  /**
   * ElevenLabs TTS
   * Returns MP3 format
   */
  async synthesizeElevenLabs(text, voice = 'EXAVITQu4vr4xnSDxMaL') {
    if (!this.elevenlabsApiKey) {
      throw new Error('ELEVENLABS_API_KEY not configured');
    }

    try {
      const response = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${voice}`,
        {
          text,
          model_id: 'eleven_turbo_v2_5',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75
          }
        },
        {
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': this.elevenlabsApiKey
          },
          responseType: 'arraybuffer'
        }
      );

      return Buffer.from(response.data);
    } catch (error) {
      console.error('ElevenLabs TTS error:', error.response?.data || error.message);
      throw new Error(`ElevenLabs TTS failed: ${error.message}`);
    }
  }

  /**
   * Deepgram TTS (Aura)
   * Returns MP3 format, will be converted to PCM
   */
  async synthesizeDeepgram(text, voice = 'aura-asteria-en', sampleRate = 16000) {
    if (!this.deepgramApiKey) {
      throw new Error('DEEPGRAM_API_KEY not configured');
    }

    try {
      console.log(`🎙️ Using Deepgram TTS with voice: ${voice}`);
      
      // Deepgram TTS API endpoint - correct format (no model parameter, only voice)
      // Map OpenAI voice names to Deepgram voices if needed
      const deepgramVoice = this.mapVoiceToDeepgram(voice);
      const response = await axios.post(
        `https://api.deepgram.com/v1/speak?voice=${encodeURIComponent(deepgramVoice)}`,
        {
          text: text
        },
        {
          headers: {
            'Authorization': `Token ${this.deepgramApiKey}`,
            'Content-Type': 'application/json'
          },
          responseType: 'arraybuffer',
          timeout: 30000
        }
      );

      // Deepgram returns MP3, convert to PCM
      const mp3Buffer = Buffer.from(response.data);
      console.log(`✅ Deepgram TTS complete: ${mp3Buffer.length} bytes MP3`);
      
      // Convert MP3 to PCM using audioConverter
      const { audioConverter } = await import('./audioConverter.js');
      const pcmBuffer = await audioConverter.convertToPCM(mp3Buffer, 'mp3', sampleRate);
      
      console.log(`✅ Deepgram audio converted to PCM: ${pcmBuffer.length} bytes`);
      return pcmBuffer;
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
      console.error('❌ Deepgram TTS error:', errorMessage);
      throw new Error(`Deepgram TTS failed: ${errorMessage}`);
    }
  }

  /**
   * Stream reply using ElevenLabs TTS
   * Synthesizes text with ElevenLabs and streams PCM chunks to Exotel
   * 
   * @param {Object} session - VoiceSession object
   * @param {string} text - Text to synthesize and stream
   * @returns {Promise<void>}
   */
  async streamReplyWithElevenLabs(session, text) {
    if (!this.elevenlabsClient) {
      throw new Error('ELEVENLABS_API_KEY not configured');
    }

    if (!text || text.trim().length === 0) {
      throw new Error('Empty text provided');
    }

    try {
      console.log(`🎙️ [${session.callId}] ElevenLabs TTS synthesis: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);

      // Synthesize audio using ElevenLabs
      const audio = await this.elevenlabsClient.textToSpeech.convert(
        this.elevenlabsVoiceId,
        {
          text: text,
          model_id: 'eleven_turbo_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75
          }
        }
      );

      // Convert audio stream to buffer
      const chunks = [];
      for await (const chunk of audio) {
        chunks.push(chunk);
      }
      const audioBuffer = Buffer.concat(chunks);

      console.log(`✅ [${session.callId}] ElevenLabs TTS complete: ${audioBuffer.length} bytes`);

      // Convert to PCM using audioConverter
      const { audioConverter } = await import('./audioConverter.js');
      const pcmBuffer = await audioConverter.convertToPCM(audioBuffer);

      console.log(`✅ [${session.callId}] Audio converted to PCM: ${pcmBuffer.length} bytes`);

      // Stream PCM chunks to Exotel
      await this.streamPCMChunksToExotel(session, pcmBuffer);

      console.log(`✅ [${session.callId}] ElevenLabs reply streamed successfully!`);
    } catch (error) {
      console.error(`❌ [${session.callId}] ElevenLabs TTS error:`, error.message || error);
      throw error;
    }
  }

  /**
   * Stream PCM chunks to Exotel via WebSocket
   * Helper function used by streamReplyWithElevenLabs
   * 
   * @param {Object} session - VoiceSession object
   * @param {Buffer} pcmBuffer - PCM audio buffer
   * @returns {Promise<void>}
   */
  async streamPCMChunksToExotel(session, pcmBuffer) {
    const ws = session.ws;
    
    if (!ws || ws.readyState !== 1) {
      throw new Error(`WebSocket not ready (state: ${ws?.readyState || 'null'})`);
    }

    if (!session.streamSid) {
      throw new Error('stream_sid not available');
    }

    const { audioConverter } = await import('./audioConverter.js');
    const chunkSize = 3200; // 100ms chunks at 8kHz, 16-bit, mono
    const chunks = audioConverter.chunkPCM(pcmBuffer, chunkSize);

    console.log(`📤 [${session.callId}] Streaming ${chunks.length} PCM chunks to Exotel`);

    for (let i = 0; i < chunks.length; i++) {
      if (ws.readyState !== 1) {
        console.warn(`⚠️  [${session.callId}] WebSocket closed, stopping at chunk ${i}/${chunks.length}`);
        break;
      }

      const chunk = chunks[i];
      const payload = chunk.toString('base64');
      
      const message = {
        event: 'media',
        stream_sid: session.streamSid,
        sequence_number: session.sequenceNumber.toString(),
        media: {
          payload: payload
        }
      };

      ws.send(JSON.stringify(message));
      session.sequenceNumber++;

      // Small delay to prevent overwhelming
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Send mark event
    const markMessage = {
      event: 'mark',
      stream_sid: session.streamSid,
      mark: {
        name: 'assistant_reply_done'
      }
    };
    ws.send(JSON.stringify(markMessage));
  }
}

export const ttsService = new TTSService();

