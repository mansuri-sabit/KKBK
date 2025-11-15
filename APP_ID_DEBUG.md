# 🔍 App ID Connection Debug Guide

## Problem: App ID 1116870 Not Connecting

### Possible Issues:

1. **App ID Not Active/Valid**
   - App ID might be incorrect
   - App might not be published/activated in Exotel Dashboard
   - App might be deleted or disabled

2. **Voicebot Applet Configuration**
   - Voicebot Applet might not be properly configured in the App
   - Endpoint URL might be incorrect
   - WebSocket URL format might be wrong

3. **App Flow Configuration**
   - App flow might not be properly set up
   - Voicebot Applet might not be in the correct position in flow

## Steps to Debug:

### 1. Verify App ID in Exotel Dashboard

Go to: https://my.exotel.com → **App Bazaar** → **Your Apps**

Check:
- ✅ App ID `1116870` exists
- ✅ App is **Published/Active**
- ✅ App is not deleted or disabled
- ✅ App has Voicebot Applet configured

### 2. Check Voicebot Applet Configuration

In App `1116870`:
- Go to **Voicebot Applet** settings
- Verify **Endpoint URL**: `https://kkbk-xjhf.onrender.com/voicebot/endpoint`
- Check if URL is accessible
- Verify WebSocket URL format in response

### 3. Test Voicebot Endpoint

```bash
curl "https://kkbk-xjhf.onrender.com/voicebot/endpoint?call_id=test123"
```

Should return:
```json
{
  "wss_url": "wss://echo.websocket.org?call_id=test123",
  "call_id": "test123",
  "timestamp": "..."
}
```

### 4. Check Render Logs

Go to: https://dashboard.render.com → Your Service → **Logs**

Look for:
- `/voicebot/endpoint` calls from Exotel
- Any error messages
- WebSocket URL being returned

### 5. Verify Environment Variables

In Render Dashboard → Environment:
- `EXOTEL_APP_ID=1116870` ✓
- `EXOTEL_SID=troikaplus1` ✓
- Other variables set correctly

### 6. Check Exotel Call Logs

Go to: https://my.exotel.com → **Calls** → **Recent Calls**

Look for:
- Call status
- Error messages
- App ID being used
- Voicebot connection attempts

## Common Solutions:

### Solution 1: Re-publish App
1. Go to App Bazaar → App `1116870`
2. Make sure Voicebot Applet is configured
3. Click **Publish** or **Save**
4. Verify App is active

### Solution 2: Verify Endpoint URL
1. Check if endpoint is accessible: `https://kkbk-xjhf.onrender.com/voicebot/endpoint`
2. Test with curl command
3. Verify response format matches Exotel requirements

### Solution 3: Check App Flow
1. Open App `1116870` in App Bazaar
2. Verify Voicebot Applet is in "Call Start" block
3. Check if there are any other applets blocking the flow
4. Ensure flow is properly connected

### Solution 4: Test with Different App ID
1. Create a new App in App Bazaar
2. Configure Voicebot Applet
3. Get new App ID
4. Update `EXOTEL_APP_ID` in Render

## Next Steps:

1. **Check Exotel Dashboard** - Verify App ID 1116870 exists and is active
2. **Test Endpoint** - Verify `/voicebot/endpoint` is working
3. **Check Logs** - Look for errors in Render and Exotel logs
4. **Re-configure** - If needed, recreate the App or update configuration

## Quick Test:

```bash
# Test endpoint
curl "https://kkbk-xjhf.onrender.com/voicebot/endpoint?call_id=test"

# Make a test call
curl -X POST https://kkbk-xjhf.onrender.com/call \
  -H "Content-Type: application/json" \
  -d '{"to": "+919324606985"}'
```

Then check:
- Render logs for `/voicebot/endpoint` calls
- Exotel Dashboard for call status
- App ID usage in call flow

