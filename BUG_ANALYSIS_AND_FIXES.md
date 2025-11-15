# 🐛 Production Bug Analysis & Fixes

## Critical Issues Found

### 🔴 Issue #1: Webhook Response Timing & Format
**Problem**: Webhook might be slow or return wrong format
**Impact**: Exotel might timeout or reject the WebSocket URL
**Fix**: 
- Added comprehensive logging
- Ensured immediate response (no async work)
- Added fallback URL generation on error
- Never return 500 (always return valid URL)

### 🔴 Issue #2: Missing "connected" Event Handler
**Problem**: Exotel might send "connected" event that we're not handling
**Impact**: Greeting never triggers if Exotel sends "connected" instead of "start"
**Fix**: Added `handleConnectedEvent()` function

### 🔴 Issue #3: TTS/Audio Pipeline Crashes WebSocket
**Problem**: If TTS or ffmpeg fails, error might crash or close WebSocket
**Impact**: Call disconnects when greeting fails
**Fix**: 
- Wrapped in try-catch
- Added timeouts (10s TTS, 15s conversion)
- Send fallback silence if greeting fails
- Never throw errors that close WS

### 🔴 Issue #4: No Immediate Audio Response
**Problem**: Exotel expects audio quickly after connection
**Impact**: If greeting takes too long, Exotel might disconnect
**Fix**: 
- Send fallback silence immediately if TTS fails
- Added concurrent greeting prevention
- Better error recovery

### 🔴 Issue #5: WebSocket Connection Stability
**Problem**: No ping/pong handling, connection might timeout
**Impact**: Connection drops silently
**Fix**: 
- Added ping/pong handlers
- Better connection state tracking
- Comprehensive logging

### 🔴 Issue #6: Race Conditions in Greeting
**Problem**: Multiple events might trigger greeting simultaneously
**Impact**: Duplicate greetings or crashes
**Fix**: 
- Added `greetingInProgress` flag
- Proper state management
- Atomic flag setting

---

## Key Fixes Applied

### 1. Webhook Handler (`handleVoicebotConnect`)
```javascript
// BEFORE: Basic error handling
// AFTER: 
- Comprehensive logging (headers, query, body)
- Response time tracking
- Fallback URL on error
- Never returns 500
- Proper Content-Type headers
```

### 2. WebSocket Connection Handler
```javascript
// BEFORE: Basic connection handling
// AFTER:
- Ping/pong support
- "connected" event handler
- Better error logging
- Connection duration tracking
- Binary type configuration
```

### 3. Greeting Synthesis
```javascript
// BEFORE: Basic async, errors might crash
// AFTER:
- Timeout protection (10s TTS, 15s conversion)
- Fallback silence on failure
- Concurrent prevention
- Better state management
- Never throws errors that close WS
```

### 4. Fallback Silence
```javascript
// NEW FEATURE:
- Generates 1 second of silence (16-bit, 8kHz, mono)
- Sends if TTS fails
- Keeps call alive
- Prevents disconnection
```

---

## Testing Strategy

### Step 1: Bare WebSocket Test (No TTS)

**Goal**: Verify WebSocket connection stays alive

**Changes to make**:
```javascript
// In synthesizeAndStreamGreeting(), comment out TTS:
async function synthesizeAndStreamGreeting(ws, session) {
  console.log(`🎙️ [${session.callId}] TTS DISABLED FOR TESTING`);
  return; // Skip TTS
}
```

**What to watch**:
- WebSocket connects
- Receives "start" or "media" event
- Connection stays open
- No disconnection

**Expected logs**:
```
📞 [WS] New Exotel WebSocket connection
📨 [WS] Received start event
✅ [WS] WebSocket connection established
```

**Success criteria**: Call stays connected for 30+ seconds

---

### Step 2: Send Fixed PCM Beep

**Goal**: Verify Exotel plays audio we send

**Changes to make**:
```javascript
// In synthesizeAndStreamGreeting(), replace TTS with beep:
async function synthesizeAndStreamGreeting(ws, session) {
  console.log(`🔊 [${session.callId}] Sending test beep`);
  
  // Generate 0.5 second beep (440Hz sine wave)
  const sampleRate = 8000;
  const duration = 0.5;
  const frequency = 440; // A4 note
  const samples = sampleRate * duration;
  const buffer = Buffer.alloc(samples * 2); // 16-bit = 2 bytes per sample
  
  for (let i = 0; i < samples; i++) {
    const sample = Math.sin(2 * Math.PI * frequency * i / sampleRate);
    const intSample = Math.floor(sample * 32767);
    buffer.writeInt16LE(intSample, i * 2);
  }
  
  await streamPCMToExotel(ws, session, buffer);
  sendMarkEvent(ws, session, 'beep_done');
}
```

**What to watch**:
- Beep plays on phone
- Call stays connected
- No disconnection

**Expected logs**:
```
🔊 [callId] Sending test beep
📤 [callId] Streaming X chunks
📍 [callId] Mark event sent: beep_done
```

**Success criteria**: You hear beep on phone, call stays connected

---

### Step 3: Re-enable TTS + ffmpeg

**Goal**: Verify full greeting pipeline works

**Changes to make**:
- Restore original `synthesizeAndStreamGreeting()` function
- Ensure TTS_PROVIDER and API key are set
- Ensure ffmpeg is available

**What to watch**:
- TTS synthesis completes
- Audio conversion completes
- Chunks are sent
- Greeting plays on phone
- Call stays connected

**Expected logs**:
```
🎙️ [callId] Starting greeting synthesis...
✅ [callId] TTS synthesis complete: X bytes
✅ [callId] Audio converted to PCM: X bytes
📤 [callId] Streaming X chunks
📍 [callId] Mark event sent: greeting_done
✅ [callId] Greeting audio streamed successfully!
```

**Success criteria**: You hear greeting, call stays connected

---

## Log Analysis Guide

### Good Call Flow (Success):
```
📞 [WEBHOOK] Voicebot connect webhook received
   ✅ Returning WebSocket URL: wss://...
📞 [WS] New Exotel WebSocket connection
📨 [WS] Received start event
   ✅ Stream SID captured: MZ...
🎙️ [callId] Starting greeting synthesis...
✅ [callId] TTS synthesis complete
✅ [callId] Audio converted to PCM
📤 [callId] Streaming X chunks
📍 [callId] Mark event sent: greeting_done
✅ [callId] Greeting audio streamed successfully!
```

### Bad Call Flow (Failure):
```
📞 [WEBHOOK] Voicebot connect webhook received
   ❌ Error handling voicebot connect  <-- PROBLEM
   
OR

📞 [WS] New Exotel WebSocket connection
🔌 [WS] WebSocket connection closed  <-- TOO SOON
   Code: 1006  <-- Abnormal closure
   
OR

🎙️ [callId] Starting greeting synthesis...
❌ [callId] Error in greeting synthesis  <-- TTS FAILED
   Error: OPENAI_API_KEY not configured
```

---

## Environment Variables Checklist

**Required for Webhook**:
- `WEBHOOK_BASE_URL` or `RENDER_EXTERNAL_URL` (defaults to https://kkbk-xjhf.onrender.com)
- `WS_PATH` (defaults to /voicebot/ws)

**Required for TTS**:
- `TTS_PROVIDER` (openai, google, elevenlabs, deepgram)
- `OPENAI_API_KEY` (if using openai)
- `GREETING_TEXT` (optional, has default)

**Required for Audio Conversion**:
- `FFMPEG_PATH` (optional, defaults to 'ffmpeg')
- ffmpeg must be installed on server

**Optional**:
- `EXOTEL_WS_TOKEN` (for WebSocket authentication)

---

## Deployment Steps

1. **Backup current server.js**:
   ```bash
   cp server.js server.js.backup
   ```

2. **Replace with fixed version**:
   ```bash
   cp PRODUCTION_FIX_SERVER.js server.js
   ```

3. **Verify environment variables are set**

4. **Test Step 1** (bare WS) first

5. **Test Step 2** (beep) second

6. **Test Step 3** (full TTS) last

7. **Monitor logs** during each test

---

## Common Issues & Solutions

### Issue: "WebSocket connection closed immediately"
**Solution**: 
- Check webhook is returning valid URL
- Check WebSocket path is correct
- Check authentication token (if enabled)
- Check Exotel dashboard configuration

### Issue: "TTS timeout"
**Solution**:
- Check API key is valid
- Check network connectivity
- Increase timeout (currently 10s)
- Use fallback silence

### Issue: "ffmpeg not found"
**Solution**:
- Install ffmpeg on server
- Set FFMPEG_PATH environment variable
- Fallback silence will be used if TTS fails

### Issue: "No audio plays"
**Solution**:
- Check TTS completed successfully
- Check PCM conversion completed
- Check chunks are being sent (sequence numbers increment)
- Check Exotel is receiving media events
- Try Step 2 (beep test) to verify audio path

---

## Next Steps After Fix

1. ✅ Deploy fixed code
2. ✅ Test Step 1 (bare WS)
3. ✅ Test Step 2 (beep)
4. ✅ Test Step 3 (full greeting)
5. ✅ Monitor production logs
6. ✅ Add conversation logic (STT + AI) if needed

---

**Last Updated**: 2025-01-13
**Status**: Ready for testing

