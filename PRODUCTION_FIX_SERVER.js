/**
 * PRODUCTION FIX - Exotel Voicebot Server
 * Fixed version addressing call disconnection issues
 */

import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import { ExotelVoicebotCaller } from './index.js';
import dotenv from 'dotenv';
import { ttsService } from './utils/ttsService.js';
import { audioConverter } from './utils/audioConverter.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Create HTTP server for WebSocket
const server = http.createServer(app);

// WebSocket Server for Voicebot
const wss = new WebSocketServer({ 
  server,
  verifyClient: verifyWebSocketClient,
  perMessageDeflate: false, // Disable compression for lower latency
  clientTracking: true
});

// Session management
const activeSessions = new Map(); // callId -> session data

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Exotel Voicebot Caller',
    message: 'Service is running. Use POST /call to initiate a call.'
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

/**
 * Make a call endpoint
 * POST /call
 */
app.post('/call', async (req, res) => {
  try {
    const { to, from } = req.body;
    const targetNumber = to || '+9324606985';
    
    const config = {
      apiKey: process.env.EXOTEL_API_KEY,
      apiToken: process.env.EXOTEL_API_TOKEN,
      sid: process.env.EXOTEL_SID,
      subdomain: process.env.EXOTEL_SUBDOMAIN || 'api.exotel.com',
      appId: process.env.EXOTEL_APP_ID,
      callerId: process.env.EXOTEL_CALLER_ID
    };

    if (!config.apiKey || !config.apiToken || !config.sid || !config.appId || !config.callerId) {
      return res.status(400).json({
        success: false,
        error: 'Missing Exotel configuration. Please set environment variables.',
        required: ['EXOTEL_API_KEY', 'EXOTEL_API_TOKEN', 'EXOTEL_SID', 'EXOTEL_APP_ID', 'EXOTEL_CALLER_ID']
      });
    }

    if (!targetNumber || !targetNumber.startsWith('+')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid phone number. Must start with + (e.g., +919324606985)'
      });
    }

    if (targetNumber.replace(/[^0-9]/g, '') === config.callerId.replace(/[^0-9]/g, '')) {
      return res.status(400).json({
        success: false,
        error: 'Target number cannot be same as CallerId. Please provide a different number to call.'
      });
    }

    const caller = new ExotelVoicebotCaller(config);
    const callLogId = req.body.callLogId || null;
    const result = await caller.makeCall(targetNumber, from, callLogId);

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

/**
 * Voicebot Connect Endpoint - CRITICAL FIX
 * Must return quickly with correct format
 */
app.get('/voicebot/connect', handleVoicebotConnect);
app.post('/voicebot/connect', handleVoicebotConnect);
app.get('/api/v1/exotel/voice/connect', handleVoicebotConnect);
app.post('/api/v1/exotel/voice/connect', handleVoicebotConnect);

function handleVoicebotConnect(req, res) {
  const startTime = Date.now();
  
  try {
    // Parse webhook data (Exotel sends as query params for GET, body for POST)
    const webhookData = req.method === 'GET' ? req.query : req.body;
    
    const callSid = webhookData.CallSid || webhookData.call_id || webhookData.CallSid || `call_${Date.now()}`;
    const callFrom = webhookData.CallFrom || webhookData.from || webhookData.CallFrom;
    const callTo = webhookData.CallTo || webhookData.to || webhookData.CallTo;
    const direction = webhookData.Direction || webhookData.direction || 'unknown';
    const customField = webhookData.CustomField || webhookData.customField;
    
    // CRITICAL: Log everything for debugging
    console.log(`\n📞 [WEBHOOK] Voicebot connect webhook received`);
    console.log(`   Timestamp: ${new Date().toISOString()}`);
    console.log(`   Method: ${req.method}`);
    console.log(`   Headers:`, JSON.stringify(req.headers, null, 2));
    console.log(`   Query:`, JSON.stringify(req.query, null, 2));
    console.log(`   Body:`, JSON.stringify(req.body, null, 2));
    console.log(`   Parsed CallSid: ${callSid}`);
    console.log(`   Parsed From: ${callFrom}`);
    console.log(`   Parsed To: ${callTo}`);
    console.log(`   Parsed Direction: ${direction}`);
    if (customField) {
      console.log(`   Parsed CustomField: ${customField}`);
    }
    
    // Determine base URL for WebSocket
    const baseUrl = process.env.WEBHOOK_BASE_URL || 
                    process.env.RENDER_EXTERNAL_URL || 
                    `https://kkbk-xjhf.onrender.com`;
    
    // Convert to WebSocket URL
    const wsProtocol = baseUrl.startsWith('https') ? 'wss' : 'ws';
    const wsHost = baseUrl.replace(/^https?:\/\//, '').replace(/\/$/, ''); // Remove trailing slash
    
    // Use CustomField (callLogId) if available, otherwise use CallSid
    const callIdentifier = customField || callSid;
    const wsPath = process.env.WS_PATH || '/voicebot/ws';
    const websocketUrl = `${wsProtocol}://${wsHost}${wsPath}?call_id=${encodeURIComponent(callIdentifier)}`;
    
    // CRITICAL: Return exact format Exotel expects
    const response = {
      url: websocketUrl
    };
    
    const responseTime = Date.now() - startTime;
    console.log(`   ✅ Returning WebSocket URL: ${websocketUrl}`);
    console.log(`   Response time: ${responseTime}ms`);
    console.log(`   Response JSON:`, JSON.stringify(response, null, 2));
    
    // CRITICAL: Set headers and return immediately
    res.set({
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'Connection': 'close'
    });
    res.status(200).json(response);
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`❌ [WEBHOOK] Error handling voicebot connect (${responseTime}ms):`, error);
    console.error(`   Stack:`, error.stack);
    
    // CRITICAL: Never return 500 - Exotel will retry and cause issues
    // Return a valid response even on error
    const baseUrl = process.env.WEBHOOK_BASE_URL || 
                    process.env.RENDER_EXTERNAL_URL || 
                    `https://kkbk-xjhf.onrender.com`;
    const wsProtocol = baseUrl.startsWith('https') ? 'wss' : 'ws';
    const wsHost = baseUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const wsPath = process.env.WS_PATH || '/voicebot/ws';
    const fallbackCallId = req.query?.CallSid || req.body?.CallSid || `call_${Date.now()}`;
    const fallbackUrl = `${wsProtocol}://${wsHost}${wsPath}?call_id=${encodeURIComponent(fallbackCallId)}`;
    
    res.set('Content-Type', 'application/json');
    res.status(200).json({ url: fallbackUrl }); // Still return 200 with fallback URL
  }
}

/**
 * Verify WebSocket client (Authentication)
 */
function verifyWebSocketClient(info) {
  const { req } = info;
  const authHeader = req.headers.authorization;
  const expectedToken = process.env.EXOTEL_WS_TOKEN;
  
  if (expectedToken) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.warn('⚠️  WebSocket connection rejected: Missing Authorization header');
      return false;
    }
    
    const token = authHeader.substring(7);
    if (token !== expectedToken) {
      console.warn('⚠️  WebSocket connection rejected: Invalid token');
      return false;
    }
    
    console.log('✅ WebSocket authentication successful');
  }
  
  return true;
}

/**
 * Voice Session Data
 */
class VoiceSession {
  constructor(callId, streamSid = null) {
    this.callId = callId;
    this.streamSid = streamSid;
    this.sequenceNumber = 0;
    this.connectedAt = new Date();
    this.lastActivity = new Date();
    this.audioBuffer = [];
    this.isActive = true;
    this.greetingSent = false;
    this.greetingInProgress = false; // Prevent concurrent greeting attempts
    this.ws = null;
  }
}

/**
 * WebSocket Server - CRITICAL FIXES
 */
wss.on('connection', (ws, request) => {
  const connectionStartTime = Date.now();
  
  // Parse query parameters from URL
  let callId;
  let streamSid = null;
  
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    callId = url.searchParams.get('call_id') || 
             url.searchParams.get('callSid') || 
             url.searchParams.get('callLogId') ||
             `call_${Date.now()}`;
    streamSid = url.searchParams.get('stream_sid') || null;
  } catch (error) {
    console.error('❌ Error parsing WebSocket URL:', error);
    callId = `call_${Date.now()}`;
  }
  
  console.log(`\n📞 [WS] New Exotel WebSocket connection`);
  console.log(`   Call ID: ${callId}`);
  console.log(`   Stream SID (from URL): ${streamSid || 'pending'}`);
  console.log(`   Remote: ${request.socket.remoteAddress}`);
  console.log(`   User-Agent: ${request.headers['user-agent'] || 'unknown'}`);
  console.log(`   Headers:`, JSON.stringify(request.headers, null, 2));
  console.log(`   URL: ${request.url}`);
  
  // Create session
  const session = new VoiceSession(callId, streamSid);
  activeSessions.set(callId, session);
  session.ws = ws;
  
  // CRITICAL: Set WebSocket options for stability
  ws.binaryType = 'arraybuffer';
  
  // CRITICAL: Handle ping/pong to keep connection alive
  ws.on('ping', () => {
    ws.pong();
    session.lastActivity = new Date();
  });
  
  ws.on('pong', () => {
    session.lastActivity = new Date();
  });
  
  // CRITICAL: Handle incoming messages from Exotel
  ws.on('message', (data) => {
    try {
      const messageStr = data.toString();
      const message = JSON.parse(messageStr);
      session.lastActivity = new Date();
      
      console.log(`📨 [WS] Received ${message.event} event for Call ${callId}`);
      console.log(`   Full message:`, JSON.stringify(message, null, 2));
      
      // Handle different event types
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
          console.warn(`⚠️  [WS] Unknown event type: ${message.event}`);
          console.warn(`   Full message:`, JSON.stringify(message, null, 2));
      }
    } catch (error) {
      console.error(`❌ [WS] Error parsing WebSocket message for Call ${callId}:`, error);
      console.error(`   Error: ${error.message}`);
      console.error(`   Stack: ${error.stack}`);
      console.error(`   Raw data (first 500 chars): ${data.toString().substring(0, 500)}`);
      // Don't close connection on parse error - might be non-JSON data
    }
  });

  // Handle connection close
  ws.on('close', (code, reason) => {
    const connectionDuration = Date.now() - connectionStartTime;
    console.log(`\n🔌 [WS] WebSocket connection closed for Call ${callId}`);
    console.log(`   Code: ${code}`);
    console.log(`   Reason: ${reason.toString()}`);
    console.log(`   Connection duration: ${connectionDuration}ms`);
    console.log(`   Last activity: ${session.lastActivity}`);
    console.log(`   Greeting sent: ${session.greetingSent}`);
    console.log(`   Sequence number: ${session.sequenceNumber}`);
    cleanupSession(callId);
  });

  // Handle errors
  ws.on('error', (error) => {
    console.error(`\n❌ [WS] WebSocket error for Call ${callId}:`, error);
    console.error(`   Error message: ${error.message}`);
    console.error(`   Error stack: ${error.stack}`);
    // Don't cleanup on error - let close handler do it
  });
  
  // CRITICAL: Log connection established
  const connectionTime = Date.now() - connectionStartTime;
  console.log(`✅ [WS] WebSocket connection established (${connectionTime}ms)`);
  console.log(`   Waiting for Exotel to send events...`);
});

/**
 * Handle "connected" event from Exotel (if sent)
 */
function handleConnectedEvent(ws, session, message) {
  console.log(`🎉 [WS] Connected event received for Call ${session.callId}`);
  console.log(`   Full message:`, JSON.stringify(message, null, 2));
  
  // Store any stream_sid if provided
  if (message.stream_sid || message.streamSid) {
    session.streamSid = message.stream_sid || message.streamSid;
    console.log(`   ✅ Stream SID from connected event: ${session.streamSid}`);
  }
  
  session.isActive = true;
  
  // If we have stream_sid, trigger greeting
  if (session.streamSid && !session.greetingSent && !session.greetingInProgress) {
    console.log(`   🚀 Triggering greeting from connected event`);
    triggerGreetingSafely(ws, session);
  }
}

/**
 * Handle "start" event from Exotel
 */
function handleStartEvent(ws, session, message) {
  console.log(`\n🎬 [WS] Start event received for Call ${session.callId}`);
  console.log(`   Full message:`, JSON.stringify(message, null, 2));
  
  // Store stream_sid if provided
  if (message.stream_sid || message.streamSid) {
    session.streamSid = message.stream_sid || message.streamSid;
    console.log(`   ✅ Stream SID captured: ${session.streamSid}`);
  }
  
  if (message.callSid) {
    console.log(`   Call SID: ${message.callSid}`);
  }
  
  session.isActive = true;
  
  // CRITICAL: Trigger greeting if we have stream_sid
  if (!session.greetingSent && !session.greetingInProgress && session.streamSid) {
    console.log(`   🚀 Triggering greeting synthesis with stream_sid: ${session.streamSid}`);
    triggerGreetingSafely(ws, session);
  } else if (!session.streamSid) {
    console.log(`   ⚠️  Start event received but no stream_sid found - waiting for media event`);
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
    console.warn(`⚠️  [WS] Media event received but no payload for Call ${session.callId}`);
    return;
  }
  
  // CRITICAL: Store stream_sid from first media event (Voicebot doesn't always send "start")
  if (!session.streamSid && (message.stream_sid || message.streamSid)) {
    session.streamSid = message.stream_sid || message.streamSid;
    console.log(`   ✅ Stream SID captured from media event: ${session.streamSid}`);
    
    // CRITICAL: Trigger greeting immediately when we get stream_sid
    if (!session.greetingSent && !session.greetingInProgress) {
      console.log(`   🚀 Triggering greeting synthesis with stream_sid from media event: ${session.streamSid}`);
      triggerGreetingSafely(ws, session);
    }
  }
  
  // Skip outbound track (audio we're sending)
  if (message.media.track === 'outbound') {
    // Log first few to confirm echo is working
    if (session.sequenceNumber < 3) {
      console.log(`   🔄 Outbound track (echo) - sequence: ${message.sequence_number || 'unknown'}`);
    }
    return;
  }
  
  // Decode base64 audio payload (inbound - customer audio)
  try {
    const audioChunk = Buffer.from(message.media.payload, 'base64');
    
    if (session.audioBuffer.length < 3) {
      console.log(`🎤 [WS] Inbound audio chunk received: ${audioChunk.length} bytes (PCM 16-bit, 8kHz)`);
    }
    
    session.audioBuffer.push(audioChunk);
    
    // TODO: Process customer audio here (STT, AI, etc.)
    
  } catch (error) {
    console.error(`❌ [WS] Error decoding audio payload for Call ${session.callId}:`, error);
  }
}

/**
 * Handle "stop" event from Exotel
 */
function handleStopEvent(ws, session, message) {
  console.log(`\n🛑 [WS] Stop event received for Call ${session.callId}`);
  
  if (message.stop) {
    console.log(`   Reason: ${message.stop.reason || 'unknown'}`);
    console.log(`   Call SID: ${message.stop.call_sid || 'unknown'}`);
  }
  
  session.isActive = false;
  
  if (session.audioBuffer.length > 0) {
    console.log(`   Processing ${session.audioBuffer.length} remaining audio chunks`);
  }
  
  cleanupSession(session.callId);
  
  // Close WebSocket gracefully
  try {
    if (ws.readyState === 1) {
      ws.close(1000, 'Call ended');
    }
  } catch (error) {
    console.error(`   Error closing WebSocket:`, error);
  }
}

/**
 * Handle "mark" event from Exotel
 */
function handleMarkEvent(ws, session, message) {
  if (message.mark) {
    console.log(`📍 [WS] Mark event received: ${message.mark.name} for Call ${session.callId}`);
  }
}

/**
 * CRITICAL: Safely trigger greeting with proper error handling
 */
function triggerGreetingSafely(ws, session) {
  // Prevent concurrent greeting attempts
  if (session.greetingInProgress) {
    console.log(`⚠️  [${session.callId}] Greeting already in progress, skipping`);
    return;
  }
  
  if (session.greetingSent) {
    console.log(`⚠️  [${session.callId}] Greeting already sent, skipping`);
    return;
  }
  
  if (!session.streamSid) {
    console.log(`⏳ [${session.callId}] Waiting for stream_sid before sending greeting`);
    return;
  }
  
  if (ws.readyState !== 1) {
    console.log(`⚠️  [${session.callId}] WebSocket not ready (state: ${ws.readyState}), cannot send greeting`);
    return;
  }
  
  // Mark as in progress
  session.greetingInProgress = true;
  
  // Trigger greeting asynchronously - don't block
  synthesizeAndStreamGreeting(ws, session)
    .then(() => {
      session.greetingInProgress = false;
    })
    .catch((error) => {
      session.greetingInProgress = false;
      session.greetingSent = false; // Allow retry
      console.error(`❌ [${session.callId}] Greeting failed, will retry on next event:`, error.message);
      
      // CRITICAL: Send fallback silence to keep call alive
      sendFallbackSilence(ws, session).catch(err => {
        console.error(`❌ [${session.callId}] Failed to send fallback silence:`, err.message);
      });
    });
}

/**
 * Synthesize greeting and stream to Exotel
 * CRITICAL: Must not crash or close WebSocket on error
 */
async function synthesizeAndStreamGreeting(ws, session) {
  const startTime = Date.now();
  
  try {
    // Get greeting text
    const greetingText = process.env.GREETING_TEXT || 
                        'Hello! Thank you for calling. How can I help you today?';
    
    console.log(`\n🎙️ [${session.callId}] Starting greeting synthesis...`);
    console.log(`   Text: "${greetingText}"`);
    console.log(`   Stream SID: ${session.streamSid}`);
    console.log(`   WebSocket State: ${ws.readyState}`);
    
    // Step 1: Call TTS API with timeout
    console.log(`   Step 1: Calling TTS API...`);
    const ttsStartTime = Date.now();
    const audioBuffer = await Promise.race([
      ttsService.synthesize(greetingText),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('TTS timeout after 10 seconds')), 10000)
      )
    ]);
    const ttsTime = Date.now() - ttsStartTime;
    console.log(`✅ [${session.callId}] TTS synthesis complete: ${audioBuffer.length} bytes (${ttsTime}ms)`);
    
    // Step 2: Convert to PCM with timeout
    console.log(`   Step 2: Converting audio to PCM...`);
    const convertStartTime = Date.now();
    const pcmBuffer = await Promise.race([
      audioConverter.convertToPCM(audioBuffer),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Audio conversion timeout after 15 seconds')), 15000)
      )
    ]);
    const convertTime = Date.now() - convertStartTime;
    console.log(`✅ [${session.callId}] Audio converted to PCM: ${pcmBuffer.length} bytes (${convertTime}ms)`);
    
    // Verify WebSocket is still ready
    if (ws.readyState !== 1) {
      throw new Error(`WebSocket closed during processing (state: ${ws.readyState})`);
    }
    
    // Step 3: Stream PCM to Exotel
    console.log(`   Step 3: Streaming audio to Exotel...`);
    const streamStartTime = Date.now();
    await streamPCMToExotel(ws, session, pcmBuffer);
    const streamTime = Date.now() - streamStartTime;
    console.log(`✅ [${session.callId}] Audio streaming complete (${streamTime}ms)`);
    
    // Step 4: Send mark event
    console.log(`   Step 4: Sending mark event...`);
    sendMarkEvent(ws, session, 'greeting_done');
    
    const totalTime = Date.now() - startTime;
    console.log(`✅ [${session.callId}] Greeting audio streamed successfully! (Total: ${totalTime}ms)`);
    
    // Mark as sent
    session.greetingSent = true;
    
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`\n❌ [${session.callId}] Error in greeting synthesis/streaming (${totalTime}ms):`, error);
    console.error(`   Error message: ${error.message}`);
    console.error(`   Error stack: ${error.stack}`);
    
    // CRITICAL: Don't throw - send fallback instead
    // Reset flags to allow retry
    session.greetingSent = false;
    
    // Send fallback silence to keep call alive
    try {
      await sendFallbackSilence(ws, session);
    } catch (fallbackError) {
      console.error(`❌ [${session.callId}] Fallback silence also failed:`, fallbackError.message);
    }
  }
}

/**
 * Stream PCM audio to Exotel in 3200-byte chunks
 */
async function streamPCMToExotel(ws, session, pcmBuffer) {
  if (!session.isActive || ws.readyState !== 1) {
    throw new Error(`WebSocket not ready. Active: ${session.isActive}, State: ${ws.readyState}`);
  }

  if (!pcmBuffer || pcmBuffer.length === 0) {
    throw new Error('PCM buffer is empty');
  }

  const chunkSize = 3200; // 100ms chunks at 8kHz, 16-bit, mono
  const chunks = audioConverter.chunkPCM(pcmBuffer, chunkSize);
  
  console.log(`📤 [${session.callId}] Streaming ${chunks.length} chunks (${pcmBuffer.length} bytes total)`);
  console.log(`   Stream SID: ${session.streamSid}`);
  console.log(`   Starting sequence number: ${session.sequenceNumber}`);

  let chunksSent = 0;
  for (let i = 0; i < chunks.length; i++) {
    // Check WebSocket state before each chunk
    if (ws.readyState !== 1) {
      console.warn(`⚠️  [${session.callId}] WebSocket closed (state: ${ws.readyState}), stopping at chunk ${i}/${chunks.length}`);
      break;
    }

    const chunk = chunks[i];
    sendAudioChunkToExotel(ws, session, chunk);
    chunksSent++;
    
    // Small delay to prevent overwhelming
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  
  console.log(`✅ [${session.callId}] Sent ${chunksSent}/${chunks.length} chunks. Final sequence: ${session.sequenceNumber}`);
}

/**
 * Send audio chunk to Exotel
 */
function sendAudioChunkToExotel(ws, session, audioChunk) {
  if (!session.isActive || ws.readyState !== 1) {
    return;
  }
  
  try {
    const payload = audioChunk.toString('base64');
    const streamSid = session.streamSid;
    
    if (!streamSid) {
      console.error(`❌ [${session.callId}] Cannot send chunk - stream_sid is missing!`);
      return;
    }
    
    const message = {
      event: 'media',
      stream_sid: streamSid,
      sequence_number: session.sequenceNumber.toString(),
      media: {
        payload: payload
      }
    };
    
    ws.send(JSON.stringify(message));
    
    if (session.sequenceNumber < 3) {
      console.log(`   📤 [${session.callId}] Sent chunk ${session.sequenceNumber}: ${audioChunk.length} bytes`);
    }
    
    session.sequenceNumber++;
    
  } catch (error) {
    console.error(`❌ [${session.callId}] Error sending audio chunk:`, error.message);
  }
}

/**
 * Send mark event to Exotel
 */
function sendMarkEvent(ws, session, markName) {
  if (!session.isActive || ws.readyState !== 1) {
    return;
  }

  try {
    const streamSid = session.streamSid;
    
    if (!streamSid) {
      console.error(`❌ [${session.callId}] Cannot send mark - stream_sid missing`);
      return;
    }
    
    const message = {
      event: 'mark',
      stream_sid: streamSid,
      mark: {
        name: markName
      }
    };
    
    ws.send(JSON.stringify(message));
    console.log(`📍 [${session.callId}] Mark event sent: ${markName}`);
  } catch (error) {
    console.error(`❌ [${session.callId}] Error sending mark event:`, error.message);
  }
}

/**
 * CRITICAL: Send fallback silence to keep call alive if TTS fails
 * Generates 1 second of silence (16-bit, 8kHz, mono PCM)
 */
async function sendFallbackSilence(ws, session) {
  console.log(`🔇 [${session.callId}] Sending fallback silence to keep call alive`);
  
  if (!session.isActive || ws.readyState !== 1 || !session.streamSid) {
    console.warn(`⚠️  [${session.callId}] Cannot send fallback - WS not ready or no stream_sid`);
    return;
  }
  
  try {
    // Generate 1 second of silence: 8000 samples * 2 bytes = 16000 bytes
    const silenceDuration = 1; // seconds
    const sampleRate = 8000;
    const bytesPerSample = 2; // 16-bit
    const silenceLength = silenceDuration * sampleRate * bytesPerSample; // 16000 bytes
    
    const silenceBuffer = Buffer.alloc(silenceLength, 0); // All zeros = silence
    
    // Send in 3200-byte chunks
    const chunks = audioConverter.chunkPCM(silenceBuffer, 3200);
    
    console.log(`   Sending ${chunks.length} silence chunks (${silenceLength} bytes)`);
    
    for (const chunk of chunks) {
      if (ws.readyState !== 1) break;
      sendAudioChunkToExotel(ws, session, chunk);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    sendMarkEvent(ws, session, 'fallback_silence_done');
    console.log(`✅ [${session.callId}] Fallback silence sent`);
    
  } catch (error) {
    console.error(`❌ [${session.callId}] Error sending fallback silence:`, error.message);
    throw error;
  }
}

/**
 * Cleanup session resources
 */
function cleanupSession(callId) {
  const session = activeSessions.get(callId);
  if (session) {
    console.log(`🧹 [${callId}] Cleaning up session`);
    session.isActive = false;
    session.audioBuffer = [];
    activeSessions.delete(callId);
  }
}

/**
 * Get active sessions (for monitoring)
 */
app.get('/voicebot/sessions', (req, res) => {
  const sessions = Array.from(activeSessions.entries()).map(([callId, session]) => ({
    callId: session.callId,
    streamSid: session.streamSid,
    connectedAt: session.connectedAt,
    lastActivity: session.lastActivity,
    sequenceNumber: session.sequenceNumber,
    isActive: session.isActive,
    greetingSent: session.greetingSent,
    greetingInProgress: session.greetingInProgress,
    audioChunksBuffered: session.audioBuffer.length
  }));
  
  res.json({
    total: sessions.length,
    sessions
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ [HTTP] Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: err.message
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`\n🚀 Exotel Voicebot Caller Server running on port ${PORT}`);
  console.log(`📞 POST /call to initiate a call`);
  console.log(`❤️  GET /health for health check`);
  console.log(`🔌 WebSocket Server: ws://localhost:${PORT}/voicebot/ws`);
  console.log(`📡 Voicebot Connect: http://localhost:${PORT}/api/v1/exotel/voice/connect`);
  console.log(`📊 Active Sessions: http://localhost:${PORT}/voicebot/sessions`);
  
  if (process.env.EXOTEL_WS_TOKEN) {
    console.log(`🔐 WebSocket authentication: ENABLED`);
  } else {
    console.log(`⚠️  WebSocket authentication: DISABLED`);
  }
});

export default app;

