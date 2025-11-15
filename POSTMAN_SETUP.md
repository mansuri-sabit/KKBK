# 📮 Postman Configuration Guide

## Quick Setup

### Step 1: Import Collection

1. Open Postman
2. Click **Import** button (top left)
3. Select `postman_collection.json` file
4. Collection will be imported as **"Exotel OpenAI Voicebot API"**

### Step 2: Set Environment Variable

The collection uses a variable `{{base_url}}` which is pre-set to:
```
https://kkbk-xjhf.onrender.com
```

**To change it:**
1. Click on collection name → **Variables** tab
2. Edit `base_url` value
3. Click **Save**

---

## Available Endpoints

### 1. Health Check
**GET** `{{base_url}}/`

**Description:** Check if server is running and get WebSocket endpoint URL

**Response:**
```json
{
  "status": "ok",
  "service": "OpenAI Voicebot (STT + LLM + TTS)",
  "message": "WebSocket server running on /was. Use POST /call to initiate calls.",
  "endpoint": "wss://kkbk-xjhf.onrender.com/was?sample-rate=16000",
  "baseUrl": "https://kkbk-xjhf.onrender.com"
}
```

---

### 2. Make Outbound Call
**POST** `{{base_url}}/call`

**Description:** Initiate an outbound call using Exotel Voicebot

**Request Body:**
```json
{
  "to": "+919324606985",
  "from": null
}
```

**Parameters:**
- `to` (required): Phone number to call (must start with +)
- `from` (optional): Exotel phone number (defaults to EXOTEL_CALLER_ID)

**Response (Success):**
```json
{
  "success": true,
  "message": "Call initiated successfully to +919324606985",
  "callSid": "63669fcf5ff6697176926937572919bd",
  "data": {
    "Call": {
      "Sid": "63669fcf5ff6697176926937572919bd",
      "Status": "queued"
    }
  }
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Missing Exotel configuration. Please set environment variables.",
  "required": [
    "EXOTEL_API_KEY",
    "EXOTEL_API_TOKEN",
    "EXOTEL_SID",
    "EXOTEL_APP_ID",
    "EXOTEL_CALLER_ID"
  ]
}
```

---

### 3. Make Call with Custom Parameters
**POST** `{{base_url}}/call`

**Description:** Make a call with custom persona, voice, and knowledgebase

**Request Body:**
```json
{
  "to": "+919324606985",
  "from": null,
  "custom_parameters": {
    "persona_name": "Parvati",
    "persona_age": "25",
    "tone": "friendly",
    "gender": "female",
    "city": "Mumbai",
    "language": "Hindi",
    "customer_name": "Rahul",
    "voice_id": "shimmer",
    "greeting": "Hello! How can I help you today?",
    "documents": "Our company offers WhatsApp marketing services with verified numbers and bulk messaging capabilities."
  }
}
```

**Custom Parameters:**
- `persona_name`: Name of the AI persona
- `persona_age`: Age of the persona (e.g., "25")
- `tone`: Tone of voice (e.g., "friendly", "professional")
- `gender`: Gender (e.g., "female", "male")
- `city`: City name (e.g., "Mumbai")
- `language`: Language (e.g., "Hindi", "English")
- `customer_name`: Customer's name
- `voice_id`: OpenAI TTS voice ("shimmer", "nova", "alloy", "echo", "fable", "onyx")
- `greeting`: Initial greeting message
- `documents`: Knowledgebase content for the AI

**Note:** Custom parameters are passed to Exotel and extracted in the WebSocket `start` event.

---

## Testing WebSocket (Not in Postman)

Postman doesn't support WebSocket testing. Use one of these alternatives:

### Option 1: WebSocket King (Chrome Extension)
1. Install "WebSocket King" from Chrome Web Store
2. Connect to: `wss://kkbk-xjhf.onrender.com/was?sample-rate=16000`
3. Send Exotel format messages:
```json
{
  "event": "start",
  "stream_sid": "test_stream_123",
  "start": {
    "custom_parameters": {
      "persona_name": "Parvati",
      "persona_age": "25",
      "tone": "friendly",
      "gender": "female",
      "city": "Mumbai",
      "language": "Hindi",
      "customer_name": "Rahul",
      "voice_id": "shimmer"
    }
  }
}
```

### Option 2: wscat (Command Line)
```bash
npm install -g wscat
wscat -c "wss://kkbk-xjhf.onrender.com/was?sample-rate=16000"
```

### Option 3: Online WebSocket Tester
- https://www.websocket.org/echo.html
- Connect to: `wss://kkbk-xjhf.onrender.com/was?sample-rate=16000`

---

## Example Test Flow

### 1. Check Server Status
```
GET {{base_url}}/
```
✅ Should return status "ok" and WebSocket endpoint

### 2. Make a Test Call
```
POST {{base_url}}/call
Body: {
  "to": "+919324606985"
}
```
✅ Should return `callSid` if Exotel is configured

### 3. Monitor WebSocket Connection
- Exotel will automatically connect to WebSocket when call is answered
- Check server logs in Render dashboard for connection events

---

## Environment Variables Required

For the `/call` endpoint to work, set these in Render Dashboard:

- `EXOTEL_API_KEY`
- `EXOTEL_API_TOKEN`
- `EXOTEL_SID`
- `EXOTEL_APP_ID`
- `EXOTEL_CALLER_ID`
- `OPENAI_API_KEY` (for STT/LLM/TTS)

---

## Troubleshooting

### Error: "Missing Exotel configuration"
- Check if all Exotel environment variables are set in Render
- Verify variable names are correct (case-sensitive)

### Error: "Invalid phone number"
- Phone number must start with `+` (e.g., `+919324606985`)
- Remove spaces, dashes, or parentheses

### Call not connecting
- Check Render logs for errors
- Verify Exotel App ID is correct
- Ensure WebSocket endpoint is accessible: `wss://kkbk-xjhf.onrender.com/was?sample-rate=16000`

---

## Postman Collection Variables

| Variable | Default Value | Description |
|----------|---------------|-------------|
| `base_url` | `https://kkbk-xjhf.onrender.com` | Base URL of the API server |

---

## Quick Test Script

You can also test using `curl`:

```bash
# Health check
curl https://kkbk-xjhf.onrender.com/

# Make a call
curl -X POST https://kkbk-xjhf.onrender.com/call \
  -H "Content-Type: application/json" \
  -d '{"to": "+919324606985"}'
```

