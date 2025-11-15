# TTS Greeting Implementation Guide

## Overview

This implementation synthesizes a greeting message at call start and streams it to Exotel via WebSocket. The greeting is automatically played when Exotel opens the WebSocket connection.

## Features

✅ **Automatic Greeting** - Synthesizes and plays greeting immediately when WebSocket opens  
✅ **Multiple TTS Providers** - Supports OpenAI, Google, ElevenLabs, and Deepgram  
✅ **Audio Conversion** - Converts TTS output (MP3/WAV) to 16-bit, 8kHz, mono PCM  
✅ **Chunked Streaming** - Streams audio in 3200-byte chunks (~100ms)  
✅ **Mark Events** - Sends completion marker after greeting finishes  

## Setup

### 1. Install ffmpeg (Required for Audio Conversion)

**Windows:**
```bash
choco install ffmpeg
# OR download from https://ffmpeg.org/download.html
```

**macOS:**
```bash
brew install ffmpeg
```

**Linux:**
```bash
apt-get install ffmpeg
# OR
yum install ffmpeg
```

**Verify installation:**
```bash
ffmpeg -version
```

If ffmpeg is not in PATH, set `FFMPEG_PATH` environment variable:
```bash
export FFMPEG_PATH=/path/to/ffmpeg
```

### 2. Configure TTS Provider

Choose one TTS provider and set the required environment variables:

#### Option A: OpenAI TTS (Recommended for simplicity)
```env
TTS_PROVIDER=openai
OPENAI_API_KEY=sk-...
GREETING_TEXT="Hello! Thank you for calling. How can I help you today?"
```

#### Option B: Google Cloud TTS
```env
TTS_PROVIDER=google
GOOGLE_TTS_API_KEY=your-api-key
GREETING_TEXT="Hello! Thank you for calling. How can I help you today?"
```

#### Option C: ElevenLabs TTS
```env
TTS_PROVIDER=elevenlabs
ELEVENLABS_API_KEY=your-api-key
GREETING_TEXT="Hello! Thank you for calling. How can I help you today?"
```

#### Option D: Deepgram TTS
```env
TTS_PROVIDER=deepgram
DEEPGRAM_API_KEY=your-api-key
GREETING_TEXT="Hello! Thank you for calling. How can I help you today?"
```

**Note:** Deepgram HTTP API is not fully implemented. For production, use the Deepgram SDK with WebSocket streaming (see `backendRef/src/services/deepgramTTS.service.ts`).

### 3. Environment Variables

Add to your `.env` file:

```env
# TTS Configuration
TTS_PROVIDER=openai
OPENAI_API_KEY=sk-...
GREETING_TEXT="Hello! Thank you for calling. How can I help you today?"

# Optional: Custom ffmpeg path
FFMPEG_PATH=/usr/local/bin/ffmpeg
```

## How It Works

### Flow

1. **WebSocket Opens** - Exotel connects to your WebSocket endpoint
2. **TTS Synthesis** - Immediately calls TTS API with greeting text
3. **Audio Conversion** - Converts TTS output (MP3/WAV) to PCM format:
   - Format: 16-bit, 8kHz, mono
   - Uses ffmpeg for conversion
4. **Chunked Streaming** - Breaks PCM into 3200-byte chunks (~100ms each)
5. **Send to Exotel** - Streams chunks with sequence numbers:
   ```json
   {
     "event": "media",
     "stream_sid": "<streamSid>",
     "sequence_number": "0",
     "media": {
       "payload": "<base64 chunk>"
     }
   }
   ```
6. **Mark Event** - Sends completion marker:
   ```json
   {
     "event": "mark",
     "stream_sid": "<streamSid>",
     "mark": {
       "name": "greeting_done"
     }
   }
   ```

### Timing

- **TTS Synthesis**: ~200-500ms (depends on provider)
- **Audio Conversion**: ~50-200ms (depends on audio length)
- **Streaming**: Real-time, ~100ms per chunk
- **Total Latency**: ~300-700ms from WebSocket open to first audio chunk

## Code Structure

### Files Created

- `utils/ttsService.js` - TTS service supporting multiple providers
- `utils/audioConverter.js` - Audio conversion utility (MP3/WAV → PCM)

### Files Modified

- `server.js` - Added greeting synthesis on WebSocket connection

### Key Functions

- `synthesizeAndStreamGreeting()` - Main function that orchestrates TTS → conversion → streaming
- `streamPCMToExotel()` - Streams PCM audio in chunks
- `sendMarkEvent()` - Sends completion marker

## Testing

### 1. Test TTS Service

```javascript
import { ttsService } from './utils/ttsService.js';

const audio = await ttsService.synthesize('Hello, this is a test');
console.log('Audio buffer:', audio.length, 'bytes');
```

### 2. Test Audio Conversion

```javascript
import { audioConverter } from './utils/audioConverter.js';

const pcm = await audioConverter.convertToPCM(audioBuffer);
console.log('PCM buffer:', pcm.length, 'bytes');
```

### 3. Test Full Flow

1. Start server: `npm start`
2. Make a test call: `POST /call` with `{"to": "+1234567890"}`
3. Check logs for:
   - `🎙️ Synthesizing greeting`
   - `✅ TTS synthesis complete`
   - `✅ Audio converted to PCM`
   - `📤 Streaming X chunks`
   - `📍 Mark event sent: greeting_done`

## Troubleshooting

### Error: "ffmpeg not found"
- Install ffmpeg (see Setup step 1)
- Or set `FFMPEG_PATH` environment variable

### Error: "TTS service not available"
- Check that `TTS_PROVIDER` is set correctly
- Verify API key is set for chosen provider
- Check API key is valid

### Error: "WebSocket not ready for streaming"
- Ensure `stream_sid` is received before sending audio
- Check WebSocket connection is still open

### Greeting not playing
- Check server logs for errors
- Verify TTS API is responding
- Check audio conversion is successful
- Verify chunks are being sent (check sequence numbers)

## Customization

### Change Greeting Text

Set `GREETING_TEXT` environment variable:
```env
GREETING_TEXT="Welcome to our service! How may I assist you?"
```

### Change Voice (OpenAI)

Modify `utils/ttsService.js`:
```javascript
await ttsService.synthesize(text, 'nova'); // Options: alloy, echo, fable, onyx, nova, shimmer
```

### Change Chunk Size

Modify `streamPCMToExotel()` in `server.js`:
```javascript
const chunkSize = 3200; // 100ms chunks (default)
// OR
const chunkSize = 320;  // 20ms chunks (lower latency, more overhead)
```

## Performance Notes

- **Chunk Size**: 3200 bytes = 100ms at 8kHz, 16-bit, mono
- **Smaller chunks** (320 bytes) = lower latency but more overhead
- **Larger chunks** (6400 bytes) = less overhead but higher latency
- **Recommended**: 3200 bytes for good balance

## Next Steps

After greeting plays, you can:
1. Start listening for caller audio (inbound track)
2. Process audio with Speech-to-Text
3. Generate responses with AI
4. Synthesize and stream responses back

See `backendRef/src/services/` for examples of STT and AI integration.

