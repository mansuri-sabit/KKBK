# Implementation Summary: Exotel Connection Flow

## Changes Made

### 1. Updated `index.js` - ExotelVoicebotCaller Class

**Key Changes:**
- ✅ Fixed API call parameters to match backendRef pattern
- ✅ Added `customField` parameter support for call tracking (callLogId)
- ✅ Updated comments to explain v1 API pattern
- ✅ Voicebot URL format matches backendRef: `http://my.exotel.com/{sid}/exoml/start_voice/{appId}`

**API Call Pattern (v1):**
```javascript
// Parameters sent to Exotel:
From: toNumber,        // Customer number to call
CallerId: callerId,    // Display number
Url: voicebotUrl,      // Voicebot applet URL
CustomField: callLogId // Optional tracking data
```

### 2. Updated `server.js` - Webhook Handling

**Key Changes:**
- ✅ Added `/api/v1/exotel/voice/connect` endpoint (matches backendRef)
- ✅ Handles both GET and POST requests
- ✅ Parses webhook data properly (CallSid, CallFrom, CallTo, CustomField)
- ✅ Returns WebSocket URL in correct format: `{ url: "wss://..." }`
- ✅ Supports CustomField (callLogId) for outbound call tracking
- ✅ Added support for passing callLogId in `/call` endpoint

**Webhook Endpoints:**
- `/voicebot/connect` (GET/POST)
- `/api/v1/exotel/voice/connect` (GET/POST) - **Matches backendRef pattern**

## How It Works Now

### Outbound Call Flow

1. **Client calls** `POST /call` with:
   ```json
   {
     "to": "+919876543210",
     "callLogId": "optional-tracking-id"
   }
   ```

2. **Server initiates call** via Exotel API:
   - Constructs Voicebot URL: `http://my.exotel.com/{sid}/exoml/start_voice/{appId}`
   - Sends `CustomField` with callLogId (if provided)
   - Exotel calls customer

3. **Exotel calls webhook** `/api/v1/exotel/voice/connect`:
   - Includes `CustomField` (callLogId) in webhook data
   - Backend returns WebSocket URL

4. **Exotel connects** to WebSocket for real-time audio

### Inbound Call Flow

1. **Customer calls** Exotel number
2. **Exotel routes** to Voicebot applet (configured in Exotel dashboard)
3. **Exotel calls webhook** `/api/v1/exotel/voice/connect`
4. **Backend returns** WebSocket URL
5. **Exotel connects** to WebSocket for real-time audio

## Configuration Required

### Environment Variables

```env
# Exotel API Credentials
EXOTEL_API_KEY=your_api_key
EXOTEL_API_TOKEN=your_api_token
EXOTEL_SID=your_sid
EXOTEL_SUBDOMAIN=api.exotel.com  # or api.in.exotel.com

# Voicebot Configuration
EXOTEL_APP_ID=your_voicebot_app_id
EXOTEL_CALLER_ID=your_exotel_phone_number

# Webhook Base URL
WEBHOOK_BASE_URL=https://your-domain.com
RENDER_EXTERNAL_URL=https://your-domain.com  # For Render
```

### Exotel Dashboard Configuration

1. **Voicebot Applet Setup:**
   - Go to: Applets > Voicebot Applets
   - Create/Edit your Voicebot applet
   - Set Webhook URL: `https://your-domain.com/api/v1/exotel/voice/connect`
   - Save App ID (use as `EXOTEL_APP_ID`)

2. **Phone Number Configuration:**
   - Assign Voicebot applet to your Exotel phone number
   - This enables incoming calls

## Testing

### Test Outbound Call

```bash
curl -X POST http://localhost:3000/call \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+919876543210",
    "callLogId": "test-call-123"
  }'
```

### Test Webhook (Simulate Exotel)

```bash
curl -X POST http://localhost:3000/api/v1/exotel/voice/connect \
  -H "Content-Type: application/json" \
  -d '{
    "CallSid": "test-sid-123",
    "CallFrom": "+919876543210",
    "CallTo": "+919999999999",
    "Direction": "outbound-api",
    "CustomField": "test-call-123"
  }'
```

## Differences from backendRef

Your implementation is now **simplified** compared to backendRef:

- ✅ **Same API call pattern** (v1 API with Voicebot URL)
- ✅ **Same webhook handling** (returns WebSocket URL)
- ❌ **No database integration** (no CallLog, Phone, Agent models)
- ❌ **No per-phone credentials** (uses global env vars)
- ❌ **No campaign management**
- ❌ **No concurrency control**

**This is fine** if you don't need those features. Your implementation is production-ready for basic Voicebot calls.

## Next Steps (Optional)

If you want to add database integration like backendRef:

1. Add MongoDB models (CallLog, Phone, Agent)
2. Implement per-phone credentials storage
3. Add call tracking and history
4. Implement campaign management
5. Add concurrency control

But for basic Voicebot functionality, your current implementation is complete! ✅

