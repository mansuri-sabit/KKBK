# Exotel Voicebot Caller

Node.js application to make calls using Exotel's Voicebot Applet feature.

## Prerequisites

1. **Exotel Account**: You need an active Exotel account with KYC completed
2. **Voicebot Applet**: Voicebot Applet must be enabled in your Exotel account (contact Exotel support)
3. **App ID**: Create a Call Flow in Exotel Dashboard with Voicebot Applet and get the App ID

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy the example environment file and fill in your Exotel credentials:

```bash
cp .env.example .env
```

Edit `.env` and add your Exotel credentials:

**Required:**
- `EXOTEL_API_KEY`: Your Exotel API Key (from Dashboard → Settings → API)
- `EXOTEL_API_TOKEN`: Your Exotel API Token
- `EXOTEL_SID`: Your Exotel Account SID
- `EXOTEL_APP_ID`: Your Voicebot Applet App ID (from App Bazaar)
- `EXOTEL_CALLER_ID`: Your ExoPhone number (the number that will appear as caller)

**Optional:**
- `EXOTEL_SUBDOMAIN`: API subdomain (defaults to `api.exotel.com`)
  - Default: `api.exotel.com`
  - For India: `api.in.exotel.com` (or use `api.in` which becomes `api.in.exotel.com`)
  - Can also use just `api` (will become `api.exotel.com`)

### 3. Create Voicebot Applet in Exotel Dashboard

1. Go to Exotel Dashboard → **App Bazaar**
2. Create a new App
3. Add **Voicebot** Applet in the "Call Start" block
4. **Configure your Voicebot URI** (see URI options below)
5. Save and note the **App ID**

#### Voicebot URI Configuration

When configuring the Voicebot Applet, you need to provide a URI. You have two options:

**Option 1: Direct WebSocket URI (wss://)**
```
wss://your-server.com/voicebot/ws
```

**Option 2: HTTP/HTTPS Endpoint (returns WebSocket URL)**
```
https://your-server.com/voicebot/endpoint
```
This endpoint should return JSON: `{"wss_url": "wss://your-server.com/voicebot/ws?call_id=123"}`

**Example URIs:**
- For testing: `wss://echo.websocket.org`
- For production: `wss://your-production-server.com/exotel/voicebot`
- Using HTTP endpoint: `https://your-api.com/exotel/get-voicebot-url`

See `voicebot-uri-info.md` for detailed information and `voicebot-server-example.js` / `voicebot-endpoint-example.js` for example implementations.

## Usage

### Make a Call

**Production mode:**
```bash
npm start
```

**Development mode (with nodemon auto-restart):**
```bash
npm run dev
```

Or directly:
```bash
node index.js
```

This will call the number `+9324606985` using your configured Voicebot Applet.

### Programmatic Usage

```javascript
import { ExotelVoicebotCaller } from './index.js';

const caller = new ExotelVoicebotCaller({
  apiKey: 'your_api_key',
  apiToken: 'your_api_token',
  sid: 'your_sid',
  appId: 'your_app_id',
  callerId: 'your_exophone_number'
});

const result = await caller.makeCall('+9324606985');
```

## How It Works

1. The application uses Exotel's **Connect Call API** to initiate a call
2. The call flow is configured to use your **Voicebot Applet**
3. When the call connects, Exotel routes it through your Voicebot Applet
4. Your Voicebot handles the conversation via WebSocket connection

## API Response

On success, you'll receive a response with:
- `Call.Sid`: Unique Call SID for tracking
- Call status and details

## Troubleshooting

### Common Issues

1. **"Missing required Exotel configuration"**
   - Ensure all environment variables are set in `.env` file

2. **"401 Unauthorized"**
   - Check your API Key and Token are correct
   - Verify they're active in Exotel Dashboard

3. **"Voicebot Applet not found"**
   - Verify the App ID exists in your Exotel account
   - Ensure Voicebot Applet is enabled for your account

4. **"Invalid Caller ID"**
   - Verify your ExoPhone number is correct
   - Ensure the number is active in your Exotel account

## Exotel Documentation

- [Exotel API Documentation](https://developer.exotel.com/api-documentation)
- [Voicebot Applet Guide](https://developer.exotel.com/applet/voicebot)
- [Exotel Support](https://support.exotel.com)

## License

ISC

