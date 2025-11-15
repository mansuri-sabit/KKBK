# WebSocket Implementation for Exotel Voicebot

## Overview

This implementation provides a secure WebSocket endpoint for Exotel's Voicebot streaming protocol, following the backendRef pattern.

## Features

✅ **Secure WebSocket (WSS)** - Supports HTTPS with wss:// URLs  
✅ **Authentication** - Bearer token authentication (optional)  
✅ **Exotel Protocol** - Handles start/media/stop/mark events  
✅ **PCM Audio** - 16-bit, 8kHz, mono, base64 encoded  
✅ **Chunked Streaming** - Sends audio in 3200-byte chunks  
✅ **Session Management** - Tracks active calls  
✅ **Clean Disconnects** - Proper resource cleanup  

## WebSocket Endpoint

### URL Format
```
wss://your-domain.com/voicebot/ws?call_id={callId}
```

### Query Parameters
- `call_id` or `callSid` or `callLogId` - Call identifier
- `stream_sid` - Stream identifier (optional, usually comes in first media event)

### Authentication

If `EXOTEL_WS_TOKEN` environment variable is set, Exotel must send:
```
Authorization: Bearer <token>
```

## Exotel Message Format

### Incoming Messages (from Exotel)

#### Start Event
```json
{
  "event": "start",
  "stream_sid": "string",
  "callSid": "string"
}
```

#### Media Event
```json
{
  "event": "media",
  "stream_sid": "string",
  "sequence_number": "string",
  "media": {
    "chunk": "string",
    "timestamp": "string",
    "payload": "<base64 PCM audio>"
  }
}
```

#### Stop Event
```json
{
  "event": "stop",
  "stream_sid": "string",
  "stop": {
    "call_sid": "string",
    "account_sid": "string",
    "reason": "string"
  }
}
```

### Outgoing Messages (to Exotel)

#### Media Response
```json
{
  "event": "media",
  "stream_sid": "string",
  "sequence_number": "string",
  "media": {
    "chunk": "string",
    "timestamp": "string",
    "payload": "<base64 PCM audio>"
  }
}
```

## Audio Format

- **Format**: Linear PCM
- **Bit Depth**: 16-bit
- **Sample Rate**: 8 kHz
- **Channels**: Mono
- **Endianness**: Little-endian
- **Encoding**: Base64
- **Chunk Size**: 3200 bytes (100ms) or 320 bytes (20ms)

## Implementation Details

### Session Management

Each WebSocket connection creates a `VoiceSession`:
- `callId`: Call identifier
- `streamSid`: Stream identifier from Exotel
- `sequenceNumber`: Sequence counter for media chunks
- `audioBuffer`: Accumulated audio chunks
- `isActive`: Session status

### Event Handlers

1. **handleStartEvent()** - Initializes session, stores stream_sid
2. **handleMediaEvent()** - Processes incoming audio chunks
3. **handleStopEvent()** - Cleans up session, processes final audio
4. **handleMarkEvent()** - Handles synchronization markers

### Audio Processing Flow

```
1. Receive media event from Exotel
   ↓
2. Decode base64 payload to Buffer
   ↓
3. Accumulate in audioBuffer
   ↓
4. Process audio (STT, AI, etc.) - TODO
   ↓
5. Generate response audio (TTS) - TODO
   ↓
6. Send audio back to Exotel in chunks
```

## Environment Variables

```env
# WebSocket Configuration
EXOTEL_WS_TOKEN=your_secret_token  # Optional: for authentication
WS_PATH=/voicebot/ws                # Optional: WebSocket path (default: /voicebot/ws)

# Webhook Base URL (for returning WebSocket URL)
WEBHOOK_BASE_URL=https://your-domain.com
RENDER_EXTERNAL_URL=https://your-domain.com
```

## Testing

### Local Testing with ngrok

1. **Start ngrok tunnel:**
   ```bash
   ngrok http 3000
   ```

2. **Set environment variable:**
   ```env
   WEBHOOK_BASE_URL=https://your-ngrok-url.ngrok.io
   ```

3. **Test WebSocket connection:**
   ```bash
   # Using wscat
   wscat -c "wss://your-ngrok-url.ngrok.io/voicebot/ws?call_id=test-123"
   ```

### Test with Exotel

1. **Configure Voicebot Applet:**
   - Webhook URL: `https://your-domain.com/api/v1/exotel/voice/connect`
   - This returns the WebSocket URL

2. **Make a test call:**
   ```bash
   curl -X POST http://localhost:3000/call \
     -H "Content-Type: application/json" \
     -d '{"to": "+919876543210"}'
   ```

3. **Monitor sessions:**
   ```bash
   curl http://localhost:3000/voicebot/sessions
   ```

## Monitoring Endpoints

### Get Active Sessions
```
GET /voicebot/sessions
```

Response:
```json
{
  "total": 2,
  "sessions": [
    {
      "callId": "call_123",
      "streamSid": "stream_456",
      "connectedAt": "2024-01-01T00:00:00.000Z",
      "lastActivity": "2024-01-01T00:00:05.000Z",
      "sequenceNumber": 150,
      "isActive": true,
      "audioChunksBuffered": 10
    }
  ]
}
```

## Next Steps

### TODO: Integrate Speech-to-Text
```javascript
// In handleMediaEvent()
const audioChunk = Buffer.from(message.media.payload, 'base64');
// Send to Deepgram/Google STT
const transcript = await sttService.transcribe(audioChunk);
```

### TODO: Integrate AI Processing
```javascript
// Process transcript with AI
const response = await aiService.process(transcript);
```

### TODO: Integrate Text-to-Speech
```javascript
// Generate audio from text
const audioBuffer = await ttsService.synthesize(response);
// Send to Exotel
sendAudioToExotel(ws, session, audioBuffer);
```

## Error Handling

- **Invalid JSON**: Logs error, continues processing
- **WebSocket Closed**: Cleans up session, releases resources
- **Authentication Failure**: Rejects connection (if token configured)
- **Audio Decode Error**: Logs error, skips chunk

## Performance Considerations

- **Chunk Size**: 3200 bytes (100ms) balances latency and overhead
- **No Artificial Delays**: Removed 20ms delays for ultra-low latency
- **Backpressure**: WebSocket protocol handles network backpressure automatically
- **Session Cleanup**: Automatic cleanup on disconnect

## Security

1. **HTTPS Required**: Use wss:// for production
2. **Token Authentication**: Set `EXOTEL_WS_TOKEN` for bearer token auth
3. **Input Validation**: Validates JSON structure and required fields
4. **Resource Limits**: Sessions automatically cleaned up on disconnect

## Troubleshooting

### WebSocket Connection Fails
- Check HTTPS/WSS URL is correct
- Verify authentication token (if configured)
- Check firewall/network allows WebSocket connections

### No Audio Received
- Verify Exotel Voicebot applet is configured correctly
- Check webhook returns correct WebSocket URL
- Monitor `/voicebot/sessions` endpoint

### Audio Quality Issues
- Ensure audio is 16-bit PCM, 8kHz, mono
- Check base64 encoding is correct
- Verify chunk size matches Exotel expectations

