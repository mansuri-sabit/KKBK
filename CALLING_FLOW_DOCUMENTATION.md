# 📞 Complete Calling Flow Documentation

## Overview

This document explains the complete flow of how calls are made, how the WebSocket connection works, and how the greeting is played automatically.

---

## 🔄 Complete Call Flow

### Phase 1: Call Initiation

```
1. Client/User makes request
   ↓
   POST https://kkbk-xjhf.onrender.com/call
   Body: { "to": "+919324606985" }
   ↓
2. Server receives request
   ↓
3. Server validates:
   - Phone number format
   - Exotel credentials (API Key, Token, SID, App ID, Caller ID)
   ↓
4. Server creates ExotelVoicebotCaller instance
   ↓
5. Server calls Exotel API:
   POST https://{apiKey}:{apiToken}@api.exotel.com/v1/Accounts/{sid}/Calls/connect
   Body (form-encoded):
   - From: +919324606985 (customer number)
   - CallerId: 07948516111 (your Exotel number)
   - Url: http://my.exotel.com/{sid}/exoml/start_voice/{appId}
   - CustomField: (optional callLogId)
   ↓
6. Exotel API responds with Call SID
   ↓
7. Server returns success response to client
```

**Response:**
```json
{
  "success": true,
  "message": "Call initiated successfully to +919324606985",
  "callSid": "63669fcf5ff6697176926937572919bd"
}
```

---

### Phase 2: Exotel Processing

```
1. Exotel receives call request
   ↓
2. Exotel initiates call to customer number (+919324606985)
   ↓
3. Customer's phone starts ringing
   ↓
4. Exotel routes call through Voicebot Applet (configured in Exotel dashboard)
   ↓
5. Voicebot Applet triggers webhook:
   GET/POST https://kkbk-xjhf.onrender.com/api/v1/exotel/voice/connect
   Query/Body params:
   - CallSid: 63669fcf5ff6697176926937572919bd
   - CallFrom: +919324606985
   - CallTo: 07948516111
   - Direction: outbound-api
   - CustomField: (if provided)
   ↓
6. Server receives webhook request
   ↓
7. Server extracts call information
   ↓
8. Server constructs WebSocket URL:
   wss://kkbk-xjhf.onrender.com/voicebot/ws?call_id={callSid}
   ↓
9. Server returns WebSocket URL to Exotel
```

**Response:**
```json
{
  "url": "wss://kkbk-xjhf.onrender.com/voicebot/ws?call_id=63669fcf5ff6697176926937572919bd"
}
```

---

### Phase 3: WebSocket Connection

```
1. Exotel receives WebSocket URL
   ↓
2. Exotel establishes WebSocket connection:
   wss://kkbk-xjhf.onrender.com/voicebot/ws?call_id=63669fcf5ff6697176926937572919bd
   ↓
3. Server WebSocket handler receives connection
   ↓
4. Server creates VoiceSession:
   - callId: 63669fcf5ff6697176926937572919bd
   - streamSid: null (will be received later)
   - sequenceNumber: 0
   - greetingSent: false
   - isActive: true
   ↓
5. Server logs: "📞 New Exotel WebSocket connection"
   ↓
6. Server waits for Exotel to send events
```

**At this point:**
- WebSocket is connected
- Session is created
- Server is waiting for `stream_sid` from Exotel
- Greeting is NOT sent yet (waiting for stream_sid)

---

### Phase 4: Exotel Sends Events

#### Option A: Exotel Sends "start" Event First

```
1. Exotel sends "start" event:
   {
     "event": "start",
     "stream_sid": "MZ1234567890abcdef",
     "callSid": "63669fcf5ff6697176926937572919bd"
   }
   ↓
2. Server receives "start" event
   ↓
3. Server stores stream_sid in session
   ↓
4. Server logs: "🎬 Start event received"
   ↓
5. Server triggers greeting synthesis
```

#### Option B: Exotel Sends "media" Event First (No "start" Event)

```
1. Exotel sends first "media" event:
   {
     "event": "media",
     "stream_sid": "MZ1234567890abcdef",
     "sequence_number": "0",
     "media": {
       "payload": "<base64 PCM audio>",
       "track": "inbound"
     }
   }
   ↓
2. Server receives "media" event
   ↓
3. Server extracts stream_sid from message
   ↓
4. Server stores stream_sid in session
   ↓
5. Server logs: "✅ Stream SID captured from media event"
   ↓
6. Server triggers greeting synthesis
```

---

### Phase 5: Greeting Synthesis & Playback

```
1. Server detects stream_sid is available
   ↓
2. Server checks:
   - greetingSent = false ✓
   - streamSid exists ✓
   - WebSocket ready (state = 1) ✓
   ↓
3. Server sets greetingSent = true (prevent duplicates)
   ↓
4. Server logs: "🎙️ Starting greeting synthesis..."
   ↓
5. Server gets greeting text:
   - From environment: GREETING_TEXT
   - Or default: "Hello! Thank you for calling. How can I help you today?"
   ↓
6. Server calls TTS API (OpenAI/Google/ElevenLabs):
   POST https://api.openai.com/v1/audio/speech
   Body: {
     "model": "tts-1",
     "input": "Hello! Thank you for calling...",
     "voice": "alloy",
     "response_format": "mp3"
   }
   ↓
7. TTS API returns MP3 audio buffer
   ↓
8. Server logs: "✅ TTS synthesis complete: X bytes"
   ↓
9. Server converts MP3 to PCM using ffmpeg:
   ffmpeg -i input.mp3 -f s16le -ar 8000 -ac 1 output.pcm
   - Format: 16-bit, little-endian PCM
   - Sample rate: 8kHz
   - Channels: Mono (1 channel)
   ↓
10. Server logs: "✅ Audio converted to PCM: X bytes"
   ↓
11. Server chunks PCM into 3200-byte pieces:
    - Each chunk = 100ms of audio (at 8kHz, 16-bit, mono)
    - Example: 16000 bytes = 5 chunks (3200 bytes each)
   ↓
12. Server logs: "📤 Streaming X chunks to Exotel"
   ↓
13. Server sends chunks sequentially to Exotel:
```

**For each chunk (3200 bytes):**

```
1. Server creates message:
   {
     "event": "media",
     "stream_sid": "MZ1234567890abcdef",
     "sequence_number": "0",  // Starts at 0, increments
     "media": {
       "payload": "<base64 encoded PCM chunk>"
     }
   }
   ↓
2. Server sends via WebSocket
   ↓
3. Server increments sequence_number (0 → 1 → 2 → ...)
   ↓
4. Server waits 10ms (to prevent overwhelming)
   ↓
5. Repeat for next chunk
```

**After all chunks sent:**
```
14. Server sends mark event:
    {
      "event": "mark",
      "stream_sid": "MZ1234567890abcdef",
      "mark": {
        "name": "greeting_done"
      }
    }
   ↓
15. Server logs: "📍 Mark event sent: greeting_done"
   ↓
16. Server logs: "✅ Greeting audio streamed successfully!"
```

---

### Phase 6: Audio Playback on Customer's Phone

```
1. Exotel receives audio chunks via WebSocket
   ↓
2. Exotel buffers chunks
   ↓
3. Exotel converts PCM to audio format for phone network
   ↓
4. Exotel streams audio to customer's phone
   ↓
5. Customer hears: "Hello! Thank you for calling. How can I help you today?"
   ↓
6. Exotel receives mark event: "greeting_done"
   ↓
7. Exotel knows greeting playback is complete
```

---

### Phase 7: Ongoing Call (After Greeting)

```
1. Customer speaks (if they respond)
   ↓
2. Customer's phone captures audio
   ↓
3. Exotel receives audio from customer
   ↓
4. Exotel sends audio to server via WebSocket:
   {
     "event": "media",
     "stream_sid": "MZ1234567890abcdef",
     "sequence_number": "X",
     "media": {
       "payload": "<base64 PCM audio>",
       "track": "inbound"  // Customer's audio
     }
   }
   ↓
5. Server receives customer audio
   ↓
6. Server can:
   - Process with Speech-to-Text
   - Send to AI for understanding
   - Generate response
   - Synthesize response with TTS
   - Send response audio back to Exotel
   ↓
7. Process repeats for conversation
```

---

### Phase 8: Call End

```
1. Customer hangs up OR call times out
   ↓
2. Exotel sends "stop" event:
   {
     "event": "stop",
     "stream_sid": "MZ1234567890abcdef",
     "stop": {
       "call_sid": "63669fcf5ff6697176926937572919bd",
       "reason": "hangup" or "timeout"
     }
   }
   ↓
3. Server receives "stop" event
   ↓
4. Server logs: "🛑 Stop event received"
   ↓
5. Server marks session as inactive
   ↓
6. Server cleans up session:
   - Remove from activeSessions map
   - Clear audio buffers
   ↓
7. Server closes WebSocket connection
   ↓
8. Server logs: "🔌 WebSocket connection closed"
```

---

## 📊 Sequence Diagram

```
Client          Server          Exotel          Customer Phone
  |               |               |                  |
  |--POST /call-->|               |                  |
  |               |--API Call---->|                  |
  |               |<--Call SID----|                  |
  |<--Success-----|               |                  |
  |               |               |--Call---------->|
  |               |               |                  |[Ringing]
  |               |<--Webhook-----|                  |
  |               |--WS URL------>|                  |
  |               |               |--WS Connect----->|
  |               |<--Connected---|                  |
  |               |               |--start event---->|
  |               |<--stream_sid--|                  |
  |               |--TTS API------|                  |
  |               |<--Audio-------|                  |
  |               |[Convert PCM]  |                  |
  |               |--chunk 0----->|                  |
  |               |--chunk 1----->|                  |
  |               |--chunk 2----->|                  |
  |               |--mark-------->|                  |
  |               |               |--Audio---------->|
  |               |               |                  |[Hears Greeting]
  |               |<--media-------|                  |
  |               |               |<--Customer Audio-|
  |               |[Process]      |                  |
  |               |--response---->|                  |
  |               |               |--Audio---------->|
  |               |               |                  |[Hears Response]
  |               |<--stop--------|                  |
  |               |               |                  |[Call Ends]
  |               |[Cleanup]      |                  |
```

---

## 🔑 Key Components

### 1. VoiceSession Class
```javascript
{
  callId: "63669fcf5ff6697176926937572919bd",
  streamSid: "MZ1234567890abcdef",
  sequenceNumber: 0,  // Increments with each chunk
  connectedAt: Date,
  lastActivity: Date,
  audioBuffer: [],  // Stores incoming audio
  isActive: true,
  greetingSent: false,  // Prevents duplicate greetings
  ws: WebSocket  // WebSocket connection
}
```

### 2. Message Formats

**Outgoing Media Message:**
```json
{
  "event": "media",
  "stream_sid": "MZ1234567890abcdef",
  "sequence_number": "0",
  "media": {
    "payload": "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQAAAAA="
  }
}
```

**Mark Event:**
```json
{
  "event": "mark",
  "stream_sid": "MZ1234567890abcdef",
  "mark": {
    "name": "greeting_done"
  }
}
```

**Incoming Media Message:**
```json
{
  "event": "media",
  "stream_sid": "MZ1234567890abcdef",
  "sequence_number": "5",
  "media": {
    "payload": "<base64 PCM>",
    "track": "inbound"
  }
}
```

---

## ⚙️ Configuration Required

### Environment Variables (Render)

```env
# Exotel Configuration
EXOTEL_API_KEY=your_api_key
EXOTEL_API_TOKEN=your_api_token
EXOTEL_SID=your_sid
EXOTEL_APP_ID=your_app_id
EXOTEL_CALLER_ID=07948516111

# TTS Configuration
TTS_PROVIDER=openai
OPENAI_API_KEY=sk-...
GREETING_TEXT="Hello! Thank you for calling. How can I help you today?"

# WebSocket Configuration
WEBHOOK_BASE_URL=https://kkbk-xjhf.onrender.com
WS_PATH=/voicebot/ws

# Optional
FFMPEG_PATH=/usr/bin/ffmpeg
```

### Exotel Dashboard Configuration

1. **Voicebot Applet:**
   - Webhook URL: `https://kkbk-xjhf.onrender.com/api/v1/exotel/voice/connect`
   - Method: GET or POST

2. **Phone Number:**
   - Assign Voicebot Applet to your Exotel number

---

## 🐛 Troubleshooting Flow

### Issue: Call Not Connecting
```
Check:
1. Exotel credentials correct?
2. Phone number format correct?
3. Exotel API responding?
4. Check Render logs for errors
```

### Issue: WebSocket Not Connecting
```
Check:
1. WebSocket URL correct in Exotel?
2. Server running on Render?
3. WebSocket path correct: /voicebot/ws
4. Check Render logs for connection attempts
```

### Issue: Greeting Not Playing
```
Check:
1. TTS_PROVIDER set?
2. API key configured?
3. ffmpeg installed?
4. stream_sid received?
5. Check Render logs for:
   - "🎙️ Starting greeting synthesis"
   - "✅ TTS synthesis complete"
   - "📤 Streaming X chunks"
```

---

## 📝 Log Flow Example

```
📞 New Exotel WebSocket connection
   Call ID: 63669fcf5ff6697176926937572919bd
   Stream SID: pending
⏳ Waiting for Exotel to send stream_sid before sending greeting...
📨 Received start event for Call 63669fcf5ff6697176926937572919bd
🎬 Start event received for Call 63669fcf5ff6697176926937572919bd
   ✅ Stream SID captured: MZ1234567890abcdef
   🚀 Triggering greeting synthesis with stream_sid: MZ1234567890abcdef
🎙️ [63669fcf5ff6697176926937572919bd] Starting greeting synthesis...
   Text: "Hello! Thank you for calling. How can I help you today?"
   Stream SID: MZ1234567890abcdef
   WebSocket State: 1
   Step 1: Calling TTS API...
🎙️ TTS synthesis using openai: { textLength: 58, voice: null }
✅ [63669fcf5ff6697176926937572919bd] TTS synthesis complete: 24576 bytes
   Step 2: Converting audio to PCM...
✅ ffmpeg found - will use for audio conversion
✅ Audio converted: 24576 bytes → 12288 bytes PCM (16-bit, 8kHz, mono)
✅ [63669fcf5ff6697176926937572919bd] Audio converted to PCM: 12288 bytes
   Step 3: Streaming audio to Exotel...
📤 [63669fcf5ff6697176926937572919bd] Streaming 4 chunks (12288 bytes total) to Exotel
   Stream SID: MZ1234567890abcdef
   Starting sequence number: 0
   📤 [63669fcf5ff6697176926937572919bd] Sent chunk 0: 3200 bytes
   📤 [63669fcf5ff6697176926937572919bd] Sent chunk 1: 3200 bytes
   📤 [63669fcf5ff6697176926937572919bd] Sent chunk 2: 3200 bytes
   📤 [63669fcf5ff6697176926937572919bd] Sent chunk 3: 2688 bytes
✅ [63669fcf5ff6697176926937572919bd] Sent 4/4 chunks. Final sequence number: 4
   Step 4: Sending mark event...
📍 Mark event sent: greeting_done for Call 63669fcf5ff6697176926937572919bd
✅ [63669fcf5ff6697176926937572919bd] Greeting audio streamed successfully!
```

---

## 🎯 Summary

1. **Call Initiation**: Client → Server → Exotel API
2. **Webhook**: Exotel → Server (returns WebSocket URL)
3. **WebSocket Connection**: Exotel connects to Server
4. **Stream SID**: Exotel sends stream_sid in start/media event
5. **Greeting Synthesis**: Server calls TTS API
6. **Audio Conversion**: MP3 → PCM (16-bit, 8kHz, mono)
7. **Chunking**: PCM split into 3200-byte chunks
8. **Streaming**: Chunks sent to Exotel with sequence numbers
9. **Mark Event**: Completion signal sent
10. **Playback**: Customer hears greeting
11. **Conversation**: Ongoing audio exchange
12. **Call End**: Cleanup and disconnect

---

## 📚 Related Files

- `server.js` - Main server and WebSocket handler
- `utils/ttsService.js` - TTS API integration
- `utils/audioConverter.js` - Audio format conversion
- `index.js` - Exotel API caller
- `TROUBLESHOOTING_GREETING.md` - Troubleshooting guide

---

**Last Updated**: 2025-01-13
**Version**: 1.0

