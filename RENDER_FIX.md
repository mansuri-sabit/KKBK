# 🔧 Render Deployment Fix

## If you get "Bad Request" error:

### Option 1: Use Render Dashboard (Recommended)

**Don't use render.yaml** - Instead, create service manually:

1. Go to https://dashboard.render.com
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure manually:
   - **Name**: `exotel-voicebot-caller`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: `Free`

5. Add Environment Variables in Dashboard:
   - `EXOTEL_API_KEY` = your_api_key
   - `EXOTEL_API_TOKEN` = your_api_token
   - `EXOTEL_SID` = your_sid
   - `EXOTEL_APP_ID` = your_app_id
   - `EXOTEL_CALLER_ID` = your_exophone_number
   - `EXOTEL_SUBDOMAIN` = `api.exotel.com`
   - `NODE_ENV` = `production`

6. Click **"Create Web Service"**

### Option 2: Fix render.yaml

If you want to use `render.yaml`, make sure:
- No comments in YAML (Render sometimes has issues)
- Proper indentation (2 spaces)
- Valid YAML syntax

Current `render.yaml` should work, but if it doesn't, use Option 1.

### Common Issues:

1. **Bad Request Error**
   - Use Dashboard method (Option 1) instead of Blueprint
   - Or remove comments from render.yaml

2. **Service Not Starting**
   - Check all environment variables are set
   - Verify `npm start` command works locally
   - Check logs in Render Dashboard

3. **Port Error**
   - Don't set `PORT` manually - Render sets it automatically
   - Server uses `process.env.PORT || 3000`

## Quick Deploy Steps:

```bash
# 1. Push to GitHub
git add .
git commit -m "Ready for Render deployment"
git push origin main

# 2. Go to Render Dashboard
# 3. Create Web Service manually
# 4. Add environment variables
# 5. Deploy!
```

## Verify Deployment:

After deployment, test:
```bash
curl https://your-app.onrender.com/health
```

Should return:
```json
{"status":"healthy","timestamp":"2024-01-01T12:00:00.000Z"}
```

