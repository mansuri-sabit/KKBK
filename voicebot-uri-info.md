# Voicebot Applet URI Configuration

## URI Format for Exotel Voicebot Applet

When configuring the Voicebot Applet in Exotel Dashboard, you need to provide a URI. This can be:

### Option 1: Direct WebSocket URI (wss://)

```
wss://your-server.com/voicebot/ws
```

**Example:**
```
wss://api.yourdomain.com/exotel/voicebot
```

### Option 2: HTTP/HTTPS Endpoint (that returns WebSocket URL)

```
https://your-server.com/voicebot/endpoint
```

This endpoint should return a JSON response with a `wss` URL:
```json
{
  "wss_url": "wss://your-server.com/voicebot/ws?call_id=123"
}
```

## URI Examples

### For Development/Testing:
```
wss://echo.websocket.org
```

### For Production:
```
wss://your-production-server.com/exotel/voicebot
```

### Using HTTP Endpoint:
```
https://your-api.com/exotel/get-voicebot-url
```

## Important Notes

1. **Max length**: Custom params shouldn't exceed 256 characters
2. **Max custom params**: Maximum 3 custom parameters allowed
3. **Protocol**: Must be `wss://` (secure WebSocket) or `https://` (HTTP endpoint)
4. **Response format**: If using HTTP endpoint, it must return a JSON with `wss_url` field

## Next Steps

1. Set up your Voicebot WebSocket server OR HTTP endpoint
2. Enter the URI in Exotel Dashboard → App Bazaar → Voicebot Applet configuration
3. Test the connection

