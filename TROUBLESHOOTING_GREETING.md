# Greeting Not Playing - Troubleshooting Guide

## Common Issues & Solutions

### Issue 1: TTS API Key Not Configured

**Symptoms:**
- Greeting not playing
- Error in logs: "OPENAI_API_KEY not configured" or similar

**Solution:**
1. Go to Render dashboard → Your service → Environment
2. Add environment variable:
   - `TTS_PROVIDER=openai`
   - `OPENAI_API_KEY=sk-your-key-here`
   - `GREETING_TEXT="Hello! Thank you for calling..."` (optional)

### Issue 2: ffmpeg Not Available on Render

**Symptoms:**
- Error: "ffmpeg not found"
- Audio conversion failing

**Solution:**
Render doesn't have ffmpeg by default. You have two options:

**Option A: Install ffmpeg in Render (Recommended)**
1. Add build command in Render:
   ```bash
   apt-get update && apt-get install -y ffmpeg
   ```
2. Or use a Dockerfile with ffmpeg pre-installed

**Option B: Use a different approach (if ffmpeg not available)**
- Use a TTS service that outputs PCM directly (like Deepgram with WebSocket)
- Or use a cloud service for audio conversion

### Issue 3: WebSocket Not Receiving stream_sid

**Symptoms:**
- Logs show: "⏳ Waiting for stream_sid"
- Greeting never triggers

**Solution:**
- Check Render logs to see if Exotel is sending "start" or "media" events
- Verify WebSocket URL is correct in Exotel configuration
- Check if Exotel is actually connecting to your WebSocket

### Issue 4: Greeting Sent But Not Playing

**Symptoms:**
- Logs show: "✅ Greeting audio streamed successfully"
- But no audio plays on call

**Possible Causes:**
1. **Audio format issue**: PCM might not be in correct format
2. **Sequence numbers**: Might be starting from wrong number
3. **Exotel not accepting audio**: Check Exotel documentation

**Solution:**
- Check Render logs for detailed chunk sending information
- Verify PCM format: 16-bit, 8kHz, mono, little-endian
- Check sequence numbers start at 0

## Debugging Steps

### Step 1: Check Render Logs

Look for these log messages:
```
📞 New Exotel WebSocket connection
🎬 Start event received
✅ Stream SID captured
🎙️ Starting greeting synthesis...
✅ TTS synthesis complete
✅ Audio converted to PCM
📤 Streaming X chunks
📍 Mark event sent: greeting_done
```

### Step 2: Verify Environment Variables

Check in Render dashboard:
- `TTS_PROVIDER` is set
- API key is set (e.g., `OPENAI_API_KEY`)
- `GREETING_TEXT` is set (optional)

### Step 3: Test TTS Service

You can test if TTS is working by checking logs for:
- "🎙️ TTS synthesis using..."
- "✅ TTS synthesis complete: X bytes"

If you see errors, check API key is valid.

### Step 4: Check Audio Conversion

Look for:
- "✅ Audio converted to PCM: X bytes"
- If you see "ffmpeg not found", install ffmpeg

### Step 5: Verify Audio Streaming

Check logs for:
- "📤 Streaming X chunks"
- "Sent chunk 0, 1, 2..."
- "📍 Mark event sent"

## Quick Fix Checklist

- [ ] TTS_PROVIDER is set in Render environment
- [ ] API key (OPENAI_API_KEY, etc.) is set in Render
- [ ] ffmpeg is installed (or using alternative)
- [ ] WebSocket URL is correct in Exotel
- [ ] Exotel is connecting to WebSocket (check logs)
- [ ] stream_sid is being received (check logs)
- [ ] Greeting synthesis is completing (check logs)
- [ ] Audio chunks are being sent (check logs)

## Testing Locally

To test locally before deploying:

1. **Set environment variables:**
   ```bash
   export TTS_PROVIDER=openai
   export OPENAI_API_KEY=sk-...
   export GREETING_TEXT="Hello! Test greeting"
   ```

2. **Install ffmpeg:**
   ```bash
   # Windows
   choco install ffmpeg
   
   # macOS
   brew install ffmpeg
   
   # Linux
   apt-get install ffmpeg
   ```

3. **Start server:**
   ```bash
   npm start
   ```

4. **Make test call and check logs**

## Still Not Working?

If greeting still doesn't play:

1. **Check Render logs** for any errors
2. **Verify Exotel configuration** - WebSocket URL should be: `wss://kkbk-xjhf.onrender.com/voicebot/ws`
3. **Test WebSocket connection** - Use a WebSocket client to test
4. **Check Exotel documentation** - Verify audio format requirements

## Contact Support

If issue persists, provide:
- Render logs (full output)
- Environment variables (without sensitive keys)
- Exotel configuration
- Call SID that failed

