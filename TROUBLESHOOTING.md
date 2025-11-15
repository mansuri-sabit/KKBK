# 🔍 Call Troubleshooting Guide

## Problem: Call Initiated but Not Received

### Possible Issues:

1. **Voicebot Applet Configuration Issue**
   - Check if Voicebot Applet is properly configured
   - Verify the endpoint URL is correct
   - Check if WebSocket server is responding

2. **Call Status Check**
   - Check Exotel Dashboard → Calls → Recent Calls
   - Look for call status: `failed`, `no-answer`, `busy`, `completed`

3. **WebSocket Endpoint Issue**
   - Voicebot endpoint might be failing
   - Check Render logs for errors

4. **Phone Number Format**
   - Ensure numbers are in correct format: `+91XXXXXXXXXX`
   - Check if numbers are active and reachable

## Steps to Debug:

### 1. Check Exotel Dashboard
- Go to: https://my.exotel.com
- Navigate to: **Calls** → **Recent Calls**
- Check call status and error messages

### 2. Check Render Logs
- Go to: https://dashboard.render.com
- Select your service: `exotel-voicebot-caller`
- Go to: **Logs** tab
- Look for:
  - `/voicebot/endpoint` calls
  - Any error messages
  - WebSocket connection attempts

### 3. Test Voicebot Endpoint
```bash
curl "https://kkbk-xjhf.onrender.com/voicebot/endpoint?call_id=test"
```

Should return:
```json
{
  "wss_url": "wss://...",
  "call_id": "test"
}
```

### 4. Verify Environment Variables
In Render Dashboard → Environment, ensure:
- `EXOTEL_API_KEY` ✓
- `EXOTEL_API_TOKEN` ✓
- `EXOTEL_SID` ✓
- `EXOTEL_APP_ID` ✓ (Voicebot Applet ID)
- `EXOTEL_CALLER_ID` ✓
- `EXOTEL_SUBDOMAIN=api.exotel.com` ✓

### 5. Check Voicebot Applet Configuration
- App ID should match `EXOTEL_APP_ID`
- Endpoint URL: `https://kkbk-xjhf.onrender.com/voicebot/endpoint`
- Recording settings configured

## Common Call Statuses:

- **in-progress**: Call is connecting
- **completed**: Call was successful
- **failed**: Call failed (check reason)
- **no-answer**: Phone didn't answer
- **busy**: Phone was busy
- **canceled**: Call was canceled

## Next Steps:

1. Check Exotel Dashboard for call details
2. Check Render logs for errors
3. Verify Voicebot endpoint is working
4. Test with a simple call first

