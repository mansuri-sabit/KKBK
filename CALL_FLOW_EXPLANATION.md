# 📞 Call Flow Explanation - कॉल कैसे होगी?

## Complete Call Flow (Step by Step)

### Step 1: Node.js App से Call Initiate करना

जब आप `npm start` या `node index.js` run करते हैं:

```36:50:index.js
  async makeCall(toNumber, fromNumber = null) {
    const url = `https://${this.apiKey}:${this.apiToken}@${this.subdomain}/v1/Accounts/${this.sid}/Calls/connect`;
    
    // Use callerId as From if fromNumber not provided
    const from = fromNumber || this.callerId;
    
    // Exotel Voicebot Applet URL format
    const voicebotUrl = `http://my.exotel.com/${this.sid}/exoml/start_voice/${this.appId}`;
    
    const params = new URLSearchParams({
      From: from,
      To: toNumber,
      CallerId: this.callerId,
      Url: voicebotUrl
    });
```

**यहाँ क्या होता है:**
- Node.js app Exotel API को POST request भेजता है
- API Endpoint: `https://api.exotel.com/v1/Accounts/{SID}/Calls/connect`
- Parameters:
  - `From`: Caller number (आपका ExoPhone number)
  - `To`: `+9324606985` (जिस number पर call करनी है)
  - `CallerId`: Caller ID (जो number दिखेगा)
  - `Url`: Voicebot Applet का URL

### Step 2: Exotel Call Connect करता है

```
Node.js App → Exotel API → Exotel Platform
                              ↓
                    Call Connect होती है
                              ↓
                    Target Number: +9324606985
```

**Exotel क्या करता है:**
1. API request receive करता है
2. Call initiate करता है target number पर
3. Call flow execute करता है (आपके App ID के अनुसार)

### Step 3: Voicebot Applet Activate होता है

```
Exotel Platform
    ↓
Voicebot Applet (App ID से)
    ↓
Configured WebSocket URI पर connect
```

**Voicebot Applet क्या करता है:**
- Call connect होने पर Voicebot Applet activate होता है
- Applet में configured URI (wss:// या https://) को use करता है
- WebSocket connection establish करता है आपके server से

### Step 4: Voice Conversation Start होती है

```
Voicebot Applet ←→ WebSocket Server
         ↓
    Voice Media Stream
         ↓
    Real-time Conversation
```

**Conversation Flow:**
1. User phone उठाता है (+9324606985)
2. Voicebot Applet WebSocket से connect होता है
3. Voice data stream होता है:
   - User की आवाज → Exotel → WebSocket → आपका Voicebot
   - Voicebot की response → WebSocket → Exotel → User के phone पर
4. Real-time conversation चलती है

## Visual Flow Diagram

```
┌─────────────┐
│ Node.js App │
│  index.js   │
└──────┬──────┘
       │ POST Request
       │ (API Key, Token, To: +9324606985)
       ↓
┌──────────────────────┐
│   Exotel API         │
│   /Calls/connect     │
└──────┬───────────────┘
       │ Call Initiate
       ↓
┌──────────────────────┐
│   Exotel Platform    │
│   - Call Routing     │
│   - Voicebot Applet  │
└──────┬───────────────┘
       │
       ├──→ Phone Network
       │    (Call to +9324606985)
       │
       └──→ Voicebot Applet
            │
            ├──→ WebSocket Connection
            │    (wss://your-server.com/voicebot/ws)
            │
            └──→ Voice Media Stream
                 (Real-time conversation)
```

## Actual API Request Example

जब आप `npm start` करते हैं, यह request जाती है:

```http
POST https://api.exotel.com/v1/Accounts/YOUR_SID/Calls/connect
Authorization: Basic (API_KEY:API_TOKEN)
Content-Type: application/x-www-form-urlencoded

From=YOUR_EXOPHONE_NUMBER
To=+9324606985
CallerId=YOUR_EXOPHONE_NUMBER
Url=http://my.exotel.com/YOUR_SID/exoml/start_voice/YOUR_APP_ID
```

## Response Example

Success पर Exotel यह response देता है:

```json
{
  "Call": {
    "Sid": "abc123xyz",
    "Status": "queued",
    "From": "YOUR_EXOPHONE_NUMBER",
    "To": "+9324606985",
    "DateCreated": "2024-01-01T12:00:00Z"
  }
}
```

## Complete Timeline

```
Time    Action
─────────────────────────────────────────
00:00   npm start command run
00:01   Node.js app Exotel API को request भेजता है
00:02   Exotel call initiate करता है
00:03   Phone ring होता है (+9324606985 पर)
00:05   User phone उठाता है
00:06   Voicebot Applet activate होता है
00:07   WebSocket connection establish होता है
00:08   Voice conversation start होती है
00:30   Conversation चलती रहती है...
```

## Important Points

1. **Call Initiation**: Node.js app सिर्फ call initiate करता है, call automatically connect होती है
2. **Voicebot Handling**: Actual conversation Voicebot Applet handle करता है
3. **WebSocket Required**: Voicebot के लिए WebSocket server जरूरी है
4. **Real-time**: Voice data real-time में stream होता है

## Testing

Test करने के लिए:
1. `.env` file में सभी credentials set करें
2. Voicebot Applet में WebSocket URI configure करें
3. `npm start` run करें
4. Call automatically +9324606985 पर जाएगी

