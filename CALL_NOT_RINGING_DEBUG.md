# 📞 Call Not Ringing - Debug Guide

## Problem: Phone पर Ring नहीं हो रही

### Possible Causes:

1. **Exotel Account/Number Issues**
   - ExoPhone number not active
   - Account balance insufficient
   - Number not verified/activated
   - DND (Do Not Disturb) restrictions

2. **Target Number Issues**
   - Number switched off
   - Number in DND mode
   - Number not reachable
   - Network issues
   - Invalid number format

3. **API/Configuration Issues**
   - Wrong API credentials
   - App ID not active
   - Call flow configuration issue
   - Voicebot Applet blocking call

4. **Call Status Issues**
   - Calls failing silently
   - Calls being rejected
   - Calls not reaching target

## Debugging Steps:

### 1. Check Exotel Dashboard

Go to: https://my.exotel.com → **Calls** → **Recent Calls**

Check for:
- Call status: `failed`, `no-answer`, `busy`, `canceled`
- Error messages
- Call duration
- Call direction

### 2. Check Exotel Account

- **Balance**: Sufficient balance for calls?
- **ExoPhone Status**: Active and verified?
- **Account Status**: Account active and not suspended?

### 3. Verify API Credentials

In Render Dashboard → Environment:
- `EXOTEL_API_KEY` - Correct?
- `EXOTEL_API_TOKEN` - Correct and active?
- `EXOTEL_SID` - Correct account SID?
- `EXOTEL_APP_ID` - App exists and is active?
- `EXOTEL_CALLER_ID` - ExoPhone number correct?

### 4. Test Target Number

- Is the number active?
- Try calling from regular phone - does it ring?
- Check if number is in DND
- Verify number format: `+919324606985`

### 5. Check Render Logs

Go to: https://dashboard.render.com → Your Service → **Logs**

Look for:
- API errors
- Call initiation logs
- Error messages
- Exotel API responses

### 6. Test with Different Number

Try calling a different number to see if issue is:
- Specific to one number
- General issue with all calls

## Common Solutions:

### Solution 1: Check Exotel Account Balance
- Go to Exotel Dashboard
- Check account balance
- Add credits if needed

### Solution 2: Verify ExoPhone Number
- Ensure ExoPhone is active
- Check if number is verified
- Verify number format

### Solution 3: Check Call Status in Dashboard
- Look at recent calls
- Check error messages
- See if calls are being rejected

### Solution 4: Test API Directly
- Use Exotel API directly (not through our server)
- See if calls work from Exotel Dashboard
- Verify API credentials

### Solution 5: Check Number Format
- Ensure numbers are in correct format: `+919324606985`
- No spaces or special characters
- Country code included

## Quick Test:

1. **Check Exotel Dashboard** - See call status and errors
2. **Test from Exotel Dashboard** - Make a test call directly
3. **Check Account Balance** - Ensure sufficient credits
4. **Verify Number** - Test if number is reachable
5. **Check Logs** - Look for errors in Render logs

## Next Steps:

1. Check Exotel Dashboard for call status
2. Verify account balance and ExoPhone status
3. Test with a different number
4. Check Render logs for errors
5. Contact Exotel support if needed

