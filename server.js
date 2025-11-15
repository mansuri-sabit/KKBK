import express from "express";
import { WebSocketServer } from "ws";
// OpenAI removed - using Deepgram for STT/TTS and Gemini for LLM
import { ExotelVoicebotCaller } from './index.js';
import { sttService } from './utils/sttService.js';
import { ttsService } from './utils/ttsService.js';
import { audioConverter } from './utils/audioConverter.js';
import { aiService } from './utils/aiService.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const server = app.listen(process.env.PORT || 3000);
const wss = new WebSocketServer({ server, path: "/was" });

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/', (req, res) => {
  const baseUrl = process.env.WEBHOOK_BASE_URL || 
                  process.env.RENDER_EXTERNAL_URL || 
                  'https://kkbk-xjhf.onrender.com';
  const wsUrl = baseUrl.replace(/^https?/, 'wss');
  
  res.json({
    status: 'ok',
    service: 'Voicebot (Deepgram STT/TTS + Gemini LLM)',
    message: 'WebSocket server running on /was. Use POST /call to initiate calls.',
    endpoint: `${wsUrl}/was?sample-rate=16000`,
    baseUrl: baseUrl
  });
});

/**
 * Make a call endpoint
 * POST /call
 * Body: { "to": "+919324606985", "from": "optional" }
 */
app.post('/call', async (req, res) => {
  try {
    const { to, from } = req.body;

    // Default number if not provided
    const targetNumber = to || '+919324606985';

    // Validate configuration
    const config = {
      apiKey: process.env.EXOTEL_API_KEY,
      apiToken: process.env.EXOTEL_API_TOKEN,
      sid: process.env.EXOTEL_SID,
      subdomain: process.env.EXOTEL_SUBDOMAIN || 'api.exotel.com',
      appId: process.env.EXOTEL_APP_ID,
      callerId: process.env.EXOTEL_CALLER_ID
    };

    // Check required config
    if (!config.apiKey || !config.apiToken || !config.sid || !config.appId || !config.callerId) {
      return res.status(400).json({
        success: false,
        error: 'Missing Exotel configuration. Please set environment variables.',
        required: ['EXOTEL_API_KEY', 'EXOTEL_API_TOKEN', 'EXOTEL_SID', 'EXOTEL_APP_ID', 'EXOTEL_CALLER_ID']
      });
    }

    // Validate phone number
    if (!targetNumber || !targetNumber.startsWith('+')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid phone number. Must start with + (e.g., +919324606985)'
      });
    }

    // Initialize caller and make call
    const caller = new ExotelVoicebotCaller(config);
    const result = await caller.makeCall(targetNumber, from);

    if (result.success) {
      res.json({
        success: true,
        message: `Call initiated successfully to ${targetNumber}`,
        callSid: result.callSid,
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to initiate call to ${targetNumber}`,
        error: result.error,
        status: result.status
      });
    }
  } catch (error) {
    console.error('Error in /call endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

console.log("✅ WSS Ready → /was");

// Session management
const sessions = new Map();

/**
 * Generate dynamic system prompt from custom_parameters
 */
function generateSystemPrompt(customParams) {
  if (!customParams || Object.keys(customParams).length === 0) {
    return 'You are a helpful assistant.';
  }

  const {
    persona_name,
    persona_age,
    tone,
    gender,
    city,
    language,
    documents,
    customer_name
  } = customParams;

  let systemPrompt = '';

  // Persona introduction (exact format: "You are {{persona_name}}, {{persona_age}} saal ki {{tone}} {{gender}} from {{city}}.")
  if (persona_name) {
    systemPrompt += `You are ${persona_name}`;
    if (persona_age) {
      systemPrompt += `, ${persona_age} saal ki`;
    }
    if (tone) {
      systemPrompt += ` ${tone}`;
    }
    if (gender) {
      systemPrompt += ` ${gender}`;
    }
    if (city) {
      systemPrompt += ` from ${city}`;
    }
    systemPrompt += '.\n\n';
  }

  // Language instruction
  if (language) {
    const langInstruction = language.toLowerCase().includes('hindi') || language.toLowerCase().includes('hi')
      ? 'Baat karo Hinglish mein (mix of Hindi and English).'
      : `Speak in ${language}.`;
    systemPrompt += `${langInstruction}\n\n`;
  }

  // Documents/knowledgebase
  if (documents) {
    systemPrompt += `Sirf in documents se jawab do:\n${documents}\n\n`;
  }

  // Customer name
  if (customer_name) {
    systemPrompt += `Customer ka naam: ${customer_name}\n\n`;
  }

  return systemPrompt.trim() || 'You are a helpful assistant.';
}

/**
 * Clean greeting text - remove GREETING_TEXT= prefix if present
 */
function cleanGreetingText(text) {
  if (!text) return text;
  // Remove GREETING_TEXT= prefix if present
  if (text.startsWith('GREETING_TEXT=')) {
    text = text.substring('GREETING_TEXT='.length);
    // Remove quotes if present
    if ((text.startsWith('"') && text.endsWith('"')) || 
        (text.startsWith("'") && text.endsWith("'"))) {
      text = text.slice(1, -1);
    }
  }
  return text.trim();
}

/**
 * Send fallback silence to keep call alive when TTS fails
 */
async function sendFallbackSilence(ws, session) {
  // Check if call is still active before sending fallback
  if (!session || !session.isActive) {
    // Call already ended, don't log warning - this is expected
    return;
  }
  
  if (ws.readyState !== 1) {
    // WebSocket closed, call ended - this is expected
    return;
  }
  
  if (!session.streamSid) {
    console.warn(`⚠️  [${session.callId}] Cannot send fallback - no stream_sid`);
    return;
  }

  try {
    console.log(`🔇 [${session.callId}] Sending fallback silence (1 second)`);
    
    // Generate 1 second of silence: sampleRate * 2 bytes (16-bit)
    const silenceDuration = 1; // seconds
    const silenceLength = session.sampleRate * 2 * silenceDuration; // bytes
    
    const silenceBuffer = Buffer.alloc(silenceLength, 0); // All zeros = silence
    
    // Send in chunks
    const chunkSize = session.sampleRate === 8000 ? 3200 : 6400; // 100ms chunks
    const chunks = audioConverter.chunkPCM(silenceBuffer, chunkSize);
    
    console.log(`   📤 Sending ${chunks.length} silence chunks (${silenceLength} bytes)`);
    
    for (const chunk of chunks) {
      if (ws.readyState !== 1) break;
      
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
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    // Send mark event
    if (ws.readyState === 1) {
      const markMessage = {
        event: 'mark',
        stream_sid: session.streamSid,
        mark: {
          name: 'fallback_silence_done'
        }
      };
      ws.send(JSON.stringify(markMessage));
    }
    
    console.log(`✅ [${session.callId}] Fallback silence sent`);
  } catch (error) {
    console.error(`❌ [${session.callId}] Error sending fallback silence:`, error.message);
    throw error;
  }
}

/**
 * Stream TTS audio to Exotel
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} session - Session object
 * @param {string} text - Text to synthesize
 * @param {boolean} sendMark - Whether to send mark event after streaming (default: true)
 */
async function streamTTSAudio(ws, session, text, sendMark = true) {
  if (!text || !text.trim()) {
    console.warn(`⚠️  [${session.callId}] Empty text for TTS`);
    return;
  }

  try {
    // Get voice from custom_parameters or default to female voice (aura-luna-en for Deepgram)
    // Female voices: aura-asteria-en, aura-luna-en, aura-stella-en (Deepgram)
    const voice = session.customParameters?.voice_id || 'nova';
    
    console.log(`🎙️ [${session.callId}] TTS: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}" (voice: ${voice})`);
    
    // Synthesize with TTS using Deepgram
    const { buffer: audioBuffer, sourceSampleRate } = await ttsService.synthesize(text, voice, session.sampleRate);
    
    // Resample if needed (Deepgram returns at target rate)
    let pcmBuffer = audioBuffer;
    if (sourceSampleRate !== session.sampleRate) {
      console.log(`   🔄 Resampling from ${sourceSampleRate}Hz to ${session.sampleRate}Hz`);
      pcmBuffer = await audioConverter.resamplePCM(audioBuffer, sourceSampleRate, session.sampleRate);
    }
    
    // CRITICAL: Chunk size per Exotel requirements
    // Minimum: 3.2k (3200 bytes) = 100ms at 8kHz
    // For 16kHz: 6400 bytes = 100ms (16kHz * 2 bytes * 0.1s = 3200 samples = 6400 bytes)
    // Must be multiple of 320 bytes
    // Using 100ms chunks for optimal quality and compliance
    const chunkSize = session.sampleRate === 8000 ? 3200 : 6400; // 100ms chunks
    const chunks = audioConverter.chunkPCM(pcmBuffer, chunkSize);
    
    console.log(`📤 [${session.callId}] Streaming ${chunks.length} chunks (${pcmBuffer.length} bytes total)`);
    
    // Stream chunks to Exotel
    for (let i = 0; i < chunks.length; i++) {
      if (ws.readyState !== 1) {
        if (session.isActive) {
          console.warn(`⚠️  [${session.callId}] WebSocket closed unexpectedly, stopping at chunk ${i}/${chunks.length}`);
        } else {
          console.log(`ℹ️  [${session.callId}] Call ended, stopping TTS stream at chunk ${i}/${chunks.length}`);
        }
        break;
      }
      
      // Check for barge-in (clear message)
      if (session.pendingClear) {
        console.log(`🛑 [${session.callId}] Barge-in detected, stopping TTS stream`);
        session.pendingClear = false;
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
    
    // Send mark event to signal completion (only if sendMark is true)
    if (sendMark && ws.readyState === 1 && !session.pendingClear) {
      const markMessage = {
        event: 'mark',
        stream_sid: session.streamSid,
        mark: {
          name: 'assistant_reply_done'
        }
      };
      ws.send(JSON.stringify(markMessage));
      console.log(`✅ [${session.callId}] TTS stream complete, mark sent`);
    }
  } catch (error) {
    console.error(`❌ [${session.callId}] TTS error:`, error.message);
    // Rethrow so calling code can handle it (reset flags, etc.)
    throw error;
  }
}

/**
 * Process user audio: STT → LLM → TTS
 */
async function processUserAudio(session) {
  if (session.audioBuffer.length === 0) {
    return;
  }
  
  // Check for barge-in
  if (session.pendingClear) {
    console.log(`🛑 [${session.callId}] Barge-in detected, clearing audio buffer`);
    session.audioBuffer = [];
    session.pendingClear = false;
    return;
  }
  
  try {
    // Combine all audio chunks
    const combinedAudio = Buffer.concat(session.audioBuffer);
    session.audioBuffer = []; // Clear buffer
    
    console.log(`🎤 [${session.callId}] Processing ${combinedAudio.length} bytes of audio`);
    
    // Check if audio is mostly silence (all zeros or very low amplitude)
    const sampleCount = combinedAudio.length / 2; // 16-bit = 2 bytes per sample
    let nonZeroSamples = 0;
    let maxAmplitude = 0;
    for (let i = 0; i < combinedAudio.length; i += 2) {
      const sample = combinedAudio.readInt16LE(i);
      const absSample = Math.abs(sample);
      if (absSample > 100) { // Threshold for "non-silence" (100 out of 32767)
        nonZeroSamples++;
      }
      if (absSample > maxAmplitude) {
        maxAmplitude = absSample;
      }
    }
    const silenceRatio = 1 - (nonZeroSamples / sampleCount);
    console.log(`   Audio analysis: ${nonZeroSamples}/${sampleCount} non-silent samples (${(silenceRatio * 100).toFixed(1)}% silence), max amplitude: ${maxAmplitude}`);
    
    // If audio is mostly silence, skip STT
    if (silenceRatio > 0.95) {
      console.warn(`⚠️  [${session.callId}] Audio is mostly silence (${(silenceRatio * 100).toFixed(1)}%), skipping STT`);
      return;
    }
    
    // STT: Transcribe audio using Deepgram
    console.log(`🎤 [${session.callId}] Starting STT transcription...`);
    const transcribedText = await sttService.transcribePCM(combinedAudio, session.sampleRate);
    
    if (!transcribedText || transcribedText.trim().length === 0) {
      console.warn(`⚠️  [${session.callId}] No transcription from STT - user audio may be empty or STT failed`);
      console.warn(`   Audio stats: ${combinedAudio.length} bytes, ${(silenceRatio * 100).toFixed(1)}% silence, max amplitude: ${maxAmplitude}`);
      return;
    }
    
    console.log(`📝 [${session.callId}] STT: "${transcribedText}"`);
    
    // CRITICAL: Use aiService to generate reply with token-by-token streaming
    // This ensures persona is loaded from MongoDB and knowledgebase chunks are used
    console.log(`🤖 [${session.callId}] Generating AI reply with streaming (token-by-token)...`);
    const startTime = Date.now();
    
    // Initialize conversation history if empty
    if (!session.conversationHistory || session.conversationHistory.length === 0) {
      session.conversationHistory = [];
    }
    
    // Text buffer for accumulating tokens until we have enough for TTS
    let textBuffer = '';
    let firstChunkTime = null;
    let totalTokens = 0;
    let pendingTTS = null; // Track ongoing TTS synthesis
    
    // Sentence-ending punctuation for natural breaks
    const sentenceEnders = /[.!?]\s*/;
    // Minimum words before forcing TTS (for very long sentences)
    const minWordsForTTS = 8;
    
    // Streaming callback: called for each token as it arrives
    const onToken = async (token, isComplete) => {
      try {
        if (isComplete) {
          // Final chunk - process any remaining buffer
          if (textBuffer.trim().length > 0) {
            const remainingText = textBuffer.trim();
            textBuffer = '';
            if (remainingText) {
              console.log(`🎙️ [${session.callId}] Final TTS chunk: "${remainingText.substring(0, 50)}${remainingText.length > 50 ? '...' : ''}"`);
              // Wait for any pending TTS to complete before starting final chunk
              if (pendingTTS) {
                await pendingTTS;
              }
              // Final chunk - send mark event after this one
              pendingTTS = streamTTSAudio(session.ws, session, remainingText, true).catch(err => {
                console.error(`❌ [${session.callId}] Final TTS chunk error:`, err.message);
              });
              await pendingTTS;
              pendingTTS = null;
            }
          }
          const totalLatency = Date.now() - startTime;
          const timeToFirstChunk = firstChunkTime ? (firstChunkTime - startTime) : 0;
          console.log(`✅ [${session.callId}] Streaming complete: ${totalTokens} tokens, ${totalLatency}ms total, ${timeToFirstChunk}ms to first chunk`);
          return;
        }
        
        if (!token) return;
        
        totalTokens++;
        textBuffer += token;
        
        // Track time to first token
        if (!firstChunkTime) {
          firstChunkTime = Date.now();
          console.log(`⚡ [${session.callId}] First token received in ${firstChunkTime - startTime}ms`);
        }
        
        // Check if we have a complete sentence or enough words
        const words = textBuffer.trim().split(/\s+/);
        const hasSentenceEnd = sentenceEnders.test(textBuffer);
        const hasEnoughWords = words.length >= minWordsForTTS;
        
        if (hasSentenceEnd || (hasEnoughWords && textBuffer.length > 50)) {
          // Extract sentence(s) from buffer
          let textToSpeak = '';
          let remainingBuffer = '';
          
          if (hasSentenceEnd) {
            // Split at sentence boundary
            const match = textBuffer.match(/^([^.!?]*[.!?]\s*)/);
            if (match) {
              textToSpeak = match[1].trim();
              remainingBuffer = textBuffer.slice(match[0].length);
            } else {
              // Fallback: take first part
              const sentences = textBuffer.split(sentenceEnders);
              if (sentences.length > 1) {
                textToSpeak = sentences[0] + (textBuffer.match(sentenceEnders)?.[0] || '');
                remainingBuffer = textBuffer.slice(textToSpeak.length);
              }
            }
          } else {
            // Force TTS on word boundary if we have enough words
            const wordBoundary = textBuffer.lastIndexOf(' ', 100);
            if (wordBoundary > 20) {
              textToSpeak = textBuffer.substring(0, wordBoundary).trim();
              remainingBuffer = textBuffer.slice(wordBoundary).trim();
            }
          }
          
          if (textToSpeak && textToSpeak.length > 3) {
            // Update buffer
            textBuffer = remainingBuffer;
            
            // Convert to TTS and stream immediately
            console.log(`🎙️ [${session.callId}] Streaming TTS chunk: "${textToSpeak.substring(0, 50)}${textToSpeak.length > 50 ? '...' : ''}"`);
            
            // Wait for any pending TTS to complete before starting new one (to maintain order)
            if (pendingTTS) {
              await pendingTTS;
            }
            
            // Start TTS synthesis (track promise to maintain order)
            // Don't send mark event for intermediate chunks, only for final chunk
            pendingTTS = streamTTSAudio(session.ws, session, textToSpeak, false).catch(err => {
              console.error(`❌ [${session.callId}] TTS chunk error:`, err.message);
            });
          }
        }
      } catch (error) {
        console.error(`❌ [${session.callId}] Error in streaming callback:`, error.message);
      }
    };
    
    // Use streaming method which calls onToken for each token
    const replyText = await aiService.generateAgentReplyStreaming(session, transcribedText.trim(), onToken);
    
    if (!replyText) {
      console.warn(`⚠️  [${session.callId}] No reply from AI service`);
      return;
    }
    
    const totalLatency = Date.now() - startTime;
    console.log(`💬 [${session.callId}] AI Reply complete (${totalLatency}ms): "${replyText}"`);
    
  } catch (error) {
    console.error(`❌ [${session.callId}] Error processing audio:`, error.message);
  }
}

// WebSocket connection handler
wss.on("connection", (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const sampleRateParam = url.searchParams.get("sample-rate");
  const sampleRate = sampleRateParam ? parseInt(sampleRateParam) : 16000;
  
  // Extract callSid from query params (Exotel sends this)
  const callSid = url.searchParams.get("callSid") || url.searchParams.get("callLogId") || `call_${Date.now()}`;
  
  console.log(`🔗 [${callSid}] Client Connected (sample-rate: ${sampleRate}Hz)`);
  
  // Create session
  const session = {
    callId: callSid,
    streamSid: null,
    sampleRate: sampleRate,
    ws: ws,
    audioBuffer: [],
    conversationHistory: [],
    customParameters: {},
    sequenceNumber: 0,
    isActive: false,
    pendingClear: false,
    processingAudio: false,
    greetingSent: false, // Track if greeting has been sent
    greetingInProgress: false, // Prevent concurrent greeting attempts
    outboundTrackLogged: false, // Flag to log outbound track once
    inboundTrackLogged: false // Flag to log inbound track once
  };
  
  sessions.set(callSid, session);
  
  // Handle incoming messages from Exotel
  ws.on("message", async (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      // Handle clear message (can come as event or control message)
      if (message.clear || message.event === 'clear') {
        handleClearEvent(ws, session, message);
        return;
      }
      
      if (!message.event) {
        console.warn(`⚠️  [${callSid}] Message without event field:`, JSON.stringify(message).substring(0, 100));
        return;
      }
      
      console.log(`📨 [${callSid}] Received event: ${message.event}`);
      
      switch (message.event) {
        case 'connected':
          handleConnectedEvent(ws, session, message);
          break;
          
        case 'start':
          handleStartEvent(ws, session, message);
          break;
          
        case 'media':
          handleMediaEvent(ws, session, message);
          break;
          
        case 'stop':
          handleStopEvent(ws, session, message);
          break;
          
        case 'mark':
          handleMarkEvent(ws, session, message);
          break;
          
        default:
          console.warn(`⚠️  [${callSid}] Unknown event: ${message.event}`);
      }
    } catch (error) {
      console.error(`❌ [${callSid}] Error parsing message:`, error.message);
    }
  });
  
  ws.on("close", () => {
    console.log(`❌ [${callSid}] Disconnected`);
    sessions.delete(callSid);
  });
  
  ws.on("error", (error) => {
    console.error(`❌ [${callSid}] WebSocket error:`, error.message);
  });
});

/**
 * Handle "connected" event from Exotel
 * This event is sent when the WebSocket connection is established
 */
function handleConnectedEvent(ws, session, message) {
  console.log(`🎉 [${session.callId}] Connected event received`);
  
  // Store stream_sid if provided in connected event
  if (message.stream_sid || message.streamSid) {
    session.streamSid = message.stream_sid || message.streamSid;
    console.log(`   ✅ Stream SID from connected event: ${session.streamSid}`);
  }
  
  // Extract custom_parameters if provided
  if (message.connected?.custom_parameters || message.custom_parameters) {
    session.customParameters = message.connected?.custom_parameters || message.custom_parameters;
    console.log(`   📋 Custom Parameters:`, JSON.stringify(session.customParameters, null, 2));
  }
  
  session.isActive = true;
  
  // If we have stream_sid, trigger greeting (if not already sent or in progress)
  if (session.streamSid && !session.greetingSent && !session.greetingInProgress) {
    let greeting = session.customParameters?.greeting || 
                   process.env.GREETING_TEXT || 
                   "Hello! Thank you for calling. How can I help you today?";
    greeting = cleanGreetingText(greeting); // Clean the greeting text
    console.log(`   🎙️ Triggering greeting from connected event: "${greeting}"`);
    session.greetingInProgress = true;
    session.greetingSent = true; // Mark as sent to prevent duplicates
    streamTTSAudio(ws, session, greeting)
      .then(() => {
        session.greetingInProgress = false;
      })
      .catch(error => {
        console.error(`   ❌ Error sending greeting from connected event:`, error.message);
        session.greetingSent = false; // Allow retry on error
        session.greetingInProgress = false;
        // Send fallback silence to keep call alive
        sendFallbackSilence(ws, session).catch(err => {
          console.error(`   ❌ Failed to send fallback silence:`, err.message);
        });
      });
  } else if (!session.streamSid) {
    console.log(`   ⏳ Waiting for stream_sid to send greeting`);
  } else if (session.greetingInProgress) {
    console.log(`   ⏳ Greeting already in progress, skipping`);
  } else if (session.greetingSent) {
    console.log(`   ✅ Greeting already sent, skipping`);
  }
}

/**
 * Handle "start" event from Exotel
 */
function handleStartEvent(ws, session, message) {
  console.log(`🎬 [${session.callId}] Start event received`);
  
  // Store stream_sid
  if (message.stream_sid || message.streamSid) {
    session.streamSid = message.stream_sid || message.streamSid;
    console.log(`   ✅ Stream SID: ${session.streamSid}`);
  }
  
  // Extract custom_parameters
  if (message.start?.custom_parameters || message.custom_parameters) {
    session.customParameters = message.start?.custom_parameters || message.custom_parameters;
    console.log(`   📋 Custom Parameters:`, JSON.stringify(session.customParameters, null, 2));
  }
  
  // Initialize conversation history (will be populated with persona from MongoDB when first message arrives)
  if (!session.conversationHistory) {
    session.conversationHistory = [];
  }
  
  // Note: System prompt will be loaded from MongoDB (or generated from custom_parameters) 
  // by aiService.ensureSystemMessage() when first user message is processed
  
  session.isActive = true;
  
  // CRITICAL: Always send greeting when stream_sid is available
  // Use custom greeting if provided, otherwise use default or env variable
  let greeting = session.customParameters?.greeting || 
                 process.env.GREETING_TEXT || 
                 "Hello! Thank you for calling. How can I help you today?";
  greeting = cleanGreetingText(greeting); // Clean the greeting text
  
  if (session.streamSid && !session.greetingSent && !session.greetingInProgress) {
    console.log(`   🎙️ Sending greeting: "${greeting}"`);
    session.greetingInProgress = true;
    session.greetingSent = true; // Mark as sent to prevent duplicates
    // Send greeting asynchronously to not block
    streamTTSAudio(ws, session, greeting)
      .then(() => {
        session.greetingInProgress = false;
      })
      .catch(error => {
        console.error(`   ❌ Error sending greeting:`, error.message);
        session.greetingSent = false; // Allow retry on error
        session.greetingInProgress = false;
        // Send fallback silence to keep call alive
        sendFallbackSilence(ws, session).catch(err => {
          console.error(`   ❌ Failed to send fallback silence:`, err.message);
        });
      });
  } else if (!session.streamSid) {
    console.warn(`   ⚠️  Cannot send greeting - stream_sid not available yet`);
  } else if (session.greetingInProgress) {
    console.log(`   ⏳ Greeting already in progress, skipping`);
  } else if (session.greetingSent) {
    console.log(`   ✅ Greeting already sent, skipping`);
  }
}

/**
 * Handle "media" event from Exotel
 */
function handleMediaEvent(ws, session, message) {
  if (!message.media || !message.media.payload) {
    return;
  }
  
  // Store stream_sid from first media event if not already set
  if (!session.streamSid && (message.stream_sid || message.streamSid)) {
    session.streamSid = message.stream_sid || message.streamSid;
    console.log(`   ✅ Stream SID captured from media: ${session.streamSid}`);
    
    // CRITICAL: Trigger greeting if not sent yet (fallback if start event didn't have stream_sid)
    if (!session.greetingSent && !session.greetingInProgress && session.isActive) {
      let greeting = session.customParameters?.greeting || 
                     process.env.GREETING_TEXT || 
                     "Hello! Thank you for calling. How can I help you today?";
      greeting = cleanGreetingText(greeting); // Clean the greeting text
      console.log(`   🎙️ Triggering greeting from media event: "${greeting}"`);
      session.greetingInProgress = true;
      session.greetingSent = true;
      streamTTSAudio(ws, session, greeting)
        .then(() => {
          session.greetingInProgress = false;
        })
        .catch(error => {
          console.error(`   ❌ Error sending greeting from media event:`, error.message);
          session.greetingSent = false; // Allow retry
          session.greetingInProgress = false;
          // Send fallback silence to keep call alive
          sendFallbackSilence(ws, session).catch(err => {
            console.error(`   ❌ Failed to send fallback silence:`, err.message);
          });
        });
    }
  }
  
  // Skip outbound track (echo of our audio)
  if (message.media.track === 'outbound') {
    // Log first few outbound tracks for debugging
    if (!session.outboundTrackLogged) {
      console.log(`   🔄 [${session.callId}] Outbound track detected (echo of our audio) - skipping`);
      session.outboundTrackLogged = true;
    }
    return;
  }
  
  // Decode base64 audio payload (inbound - customer audio)
  try {
    const audioChunk = Buffer.from(message.media.payload, 'base64');
    
    // Log first few inbound tracks for debugging
    if (!session.inboundTrackLogged) {
      console.log(`   🎤 [${session.callId}] Inbound track detected (customer audio) - ${audioChunk.length} bytes`);
      session.inboundTrackLogged = true;
    }
    
    session.audioBuffer.push(audioChunk);
    
    // Process audio when buffer reaches threshold (~2 seconds of audio)
    // For 16kHz: 2 seconds = 16000 * 2 * 2 bytes = 64000 bytes
    // For 8kHz: 2 seconds = 8000 * 2 * 2 bytes = 32000 bytes
    const threshold = session.sampleRate * 2 * 2; // 2 seconds * 2 bytes per sample
    if (session.audioBuffer.length > 0 && !session.processingAudio) {
      const totalBytes = session.audioBuffer.reduce((sum, buf) => sum + buf.length, 0);
      if (totalBytes >= threshold) {
        session.processingAudio = true;
        processUserAudio(session).finally(() => {
          session.processingAudio = false;
        });
      }
    }
  } catch (error) {
    console.error(`❌ [${session.callId}] Error decoding audio:`, error.message);
  }
}

/**
 * Handle "stop" event from Exotel
 */
function handleStopEvent(ws, session, message) {
  console.log(`🛑 [${session.callId}] Stop event received`);
  
  if (message.stop) {
    console.log(`   Reason: ${message.stop.reason || 'unknown'}`);
  }
  
  session.isActive = false;
  
  // Process any remaining audio
  if (session.audioBuffer.length > 0 && !session.processingAudio) {
    session.processingAudio = true;
    processUserAudio(session).finally(() => {
      session.processingAudio = false;
    });
  }
  
  // Cleanup
  sessions.delete(session.callId);
  
  // Close WebSocket
  if (ws.readyState === 1) {
    ws.close();
  }
}

/**
 * Handle "mark" event from Exotel
 */
function handleMarkEvent(ws, session, message) {
  console.log(`📍 [${session.callId}] Mark event: ${message.mark?.name || 'unknown'}`);
}

/**
 * Handle "clear" event (barge-in)
 */
function handleClearEvent(ws, session, message) {
  console.log(`🛑 [${session.callId}] Clear event (barge-in)`);
  session.pendingClear = true;
  session.audioBuffer = []; // Clear audio buffer
}
