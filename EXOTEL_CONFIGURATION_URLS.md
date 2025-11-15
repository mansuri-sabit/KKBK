# Exotel Configuration URLs & Flow

## 🔗 Required URLs for Exotel Configuration

### 1. Voicebot Webhook URL (Primary Endpoint)

**URL Format:**
```
https://your-domain.com/api/v1/exotel/voice/connect
```

**Alternative URLs (also supported):**
```
https://your-domain.com/voicebot/connect
```

**What it does:**
- Exotel calls this URL when a call is initiated (inbound or outbound)
- Your server returns a WebSocket URL for real-time audio streaming
- This is the **main entry point** for Exotel Voicebot applet

**Configuration Location:**
- Exotel Dashboard → Applets → Voicebot Applets → Your Applet → Webhook URL

---

### 2. WebSocket Endpoint (Returned by Webhook)

**URL Format:**
```
wss://your-domain.com/voicebot/ws?call_id={callId}
```

**What it does:**
- Real-time bidirectional audio streaming
- Exotel connects to this WebSocket after receiving it from the webhook
- Handles audio chunks, events (start/media/stop)

**Note:** This URL is **returned by your webhook**, not configured directly in Exotel

---

### 3. Call Initiation Endpoint (Your API)

**URL Format:**
```
POST https://your-domain.com/call
```

**Request Body:**
```json
{
  "to": "+919876543210",
  "from": "+919999999999",
  "callLogId": "optional-tracking-id"
}
```

**What it does:**
- Your application calls this to initiate outbound calls
- Internally calls Exotel API to make the call

---

## 📋 Complete Configuration Flow

### Step 1: Configure Voicebot Applet in Exotel Dashboard

1. **Login to Exotel Dashboard:**
   ```
   https://my.exotel.com
   ```

2. **Navigate to Applets:**
   ```
   Dashboard → Applets → Voicebot Applets
   ```

3. **Create/Edit Voicebot Applet:**
   - Click "Create New Applet" or edit existing
   - **Applet Name:** Your applet name
   - **Webhook URL:** `https://your-domain.com/api/v1/exotel/voice/connect`
   - **Authentication Token (Optional):** Set if using `EXOTEL_WS_TOKEN`
   - **Save** and note the **App ID**

4. **Get App ID:**
   - After saving, copy the **App ID** (e.g., `app_1234567890`)
   - Use this as `EXOTEL_APP_ID` in your environment variables

---

### Step 2: Configure Phone Number

1. **Navigate to Phone Numbers:**
   ```
   Dashboard → Phone Numbers → Your Number
   ```

2. **Assign Voicebot Applet:**
   - Select your phone number
   - Under "Applet Configuration", select your Voicebot applet
   - Save changes

**This enables incoming calls to use your Voicebot**

---

### Step 3: Environment Variables

Set these in your `.env` file or deployment platform:

```env
# Exotel API Credentials
EXOTEL_API_KEY=your_api_key
EXOTEL_API_TOKEN=your_api_token
EXOTEL_SID=your_account_sid
EXOTEL_SUBDOMAIN=api.exotel.com  # or api.in.exotel.com for India

# Voicebot Configuration
EXOTEL_APP_ID=app_1234567890  # From Step 1
EXOTEL_CALLER_ID=+919999999999  # Your Exotel phone number

# Webhook Base URL (MUST be HTTPS for production)
WEBHOOK_BASE_URL=https://your-domain.com
RENDER_EXTERNAL_URL=https://your-domain.com  # For Render deployment

# WebSocket Authentication (Optional)
EXOTEL_WS_TOKEN=your_secret_token  # If you want to secure WebSocket

# WebSocket Path (Optional, default: /voicebot/ws)
WS_PATH=/voicebot/ws
```

---

## 🔄 Complete Call Flow with URLs

### Outbound Call Flow

```
1. Your App
   POST https://your-domain.com/call
   ↓
2. Your Server
   Calls Exotel API: https://api.exotel.com/v1/Accounts/{sid}/Calls/connect
   ↓
3. Exotel
   Initiates call to customer
   ↓
4. Exotel
   Calls your webhook: https://your-domain.com/api/v1/exotel/voice/connect
   ↓
5. Your Server
   Returns: { "url": "wss://your-domain.com/voicebot/ws?call_id=xxx" }
   ↓
6. Exotel
   Connects to: wss://your-domain.com/voicebot/ws?call_id=xxx
   ↓
7. Real-time audio streaming begins
```

### Inbound Call Flow

```
1. Customer
   Calls your Exotel number: +919999999999
   ↓
2. Exotel
   Routes to Voicebot applet (configured on phone number)
   ↓
3. Exotel
   Calls your webhook: https://your-domain.com/api/v1/exotel/voice/connect
   ↓
4. Your Server
   Returns: { "url": "wss://your-domain.com/voicebot/ws?call_id=xxx" }
   ↓
5. Exotel
   Connects to: wss://your-domain.com/voicebot/ws?call_id=xxx
   ↓
6. Real-time audio streaming begins
```

---

## 🌐 URL Examples by Environment

### Local Development (with ngrok)

```env
WEBHOOK_BASE_URL=https://abc123.ngrok.io
```

**Webhook URL:**
```
https://abc123.ngrok.io/api/v1/exotel/voice/connect
```

**WebSocket URL (returned):**
```
wss://abc123.ngrok.io/voicebot/ws?call_id=xxx
```

### Production (Render/Heroku/etc.)

```env
WEBHOOK_BASE_URL=https://your-app.onrender.com
```

**Webhook URL:**
```
https://your-app.onrender.com/api/v1/exotel/voice/connect
```

**WebSocket URL (returned):**
```
wss://your-app.onrender.com/voicebot/ws?call_id=xxx
```

### Custom Domain

```env
WEBHOOK_BASE_URL=https://voicebot.yourdomain.com
```

**Webhook URL:**
```
https://voicebot.yourdomain.com/api/v1/exotel/voice/connect
```

**WebSocket URL (returned):**
```
wss://voicebot.yourdomain.com/voicebot/ws?call_id=xxx
```

---

## 🔐 Security Considerations

### 1. HTTPS/WSS Required
- **Production MUST use HTTPS** (wss:// for WebSocket)
- Exotel requires secure connections
- Local testing: Use ngrok or Cloudflare Tunnel

### 2. WebSocket Authentication (Optional)
If you set `EXOTEL_WS_TOKEN`:
- Exotel must send: `Authorization: Bearer <token>`
- Configure this in Exotel Dashboard → Applet Settings

### 3. Webhook Validation
- Exotel can send webhook signatures (if configured)
- Validate webhook authenticity in production

---

## 📝 Quick Reference Checklist

- [ ] Voicebot Applet created in Exotel Dashboard
- [ ] Webhook URL configured: `https://your-domain.com/api/v1/exotel/voice/connect`
- [ ] App ID copied and set as `EXOTEL_APP_ID`
- [ ] Phone number assigned to Voicebot applet
- [ ] Environment variables configured
- [ ] `WEBHOOK_BASE_URL` set to HTTPS URL
- [ ] Server deployed and accessible
- [ ] Test webhook endpoint returns WebSocket URL
- [ ] Test WebSocket connection works

---

## 🧪 Testing URLs

### Test Webhook Endpoint
```bash
curl -X POST https://your-domain.com/api/v1/exotel/voice/connect \
  -H "Content-Type: application/json" \
  -d '{
    "CallSid": "test-123",
    "CallFrom": "+919876543210",
    "CallTo": "+919999999999",
    "Direction": "inbound"
  }'
```

**Expected Response:**
```json
{
  "url": "wss://your-domain.com/voicebot/ws?call_id=test-123"
}
```

### Test Call Initiation
```bash
curl -X POST https://your-domain.com/call \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+919876543210"
  }'
```

### Check Active Sessions
```bash
curl https://your-domain.com/voicebot/sessions
```

---

## 🔗 Exotel Dashboard URLs

- **Main Dashboard:** https://my.exotel.com
- **Applets:** https://my.exotel.com/applets
- **Voicebot Applets:** https://my.exotel.com/applets/voicebot
- **Phone Numbers:** https://my.exotel.com/phone-numbers
- **API Documentation:** https://developer.exotel.com/api

---

## ⚠️ Common Issues

### Issue: Webhook not being called
- ✅ Check webhook URL is HTTPS (not HTTP)
- ✅ Verify URL is accessible from internet
- ✅ Check Exotel applet is assigned to phone number
- ✅ Verify applet is active/enabled

### Issue: WebSocket connection fails
- ✅ Check WebSocket URL uses `wss://` (not `ws://`)
- ✅ Verify authentication token if configured
- ✅ Check firewall allows WebSocket connections
- ✅ Test WebSocket URL manually with wscat

### Issue: 404 on webhook
- ✅ Verify endpoint path: `/api/v1/exotel/voice/connect`
- ✅ Check server is running and accessible
- ✅ Test endpoint manually with curl

---

## 📞 Support

For Exotel-specific issues:
- **Exotel Support:** https://support.exotel.com
- **API Docs:** https://developer.exotel.com/api
- **Community:** https://community.exotel.com

