# 🚀 Render Deployment Guide

## Step-by-Step Deployment on Render

### Prerequisites
- GitHub account
- Render account (sign up at https://render.com)
- Exotel credentials ready

### Step 1: Push Code to GitHub

```bash
# Initialize git (if not already done)
git init
git add .
git commit -m "Initial commit - Exotel Voicebot Caller"

# Create repository on GitHub, then:
git remote add origin https://github.com/yourusername/exotel-voicebot-caller.git
git branch -M main
git push -u origin main
```

### Step 2: Create Render Web Service

1. **Login to Render Dashboard**
   - Go to https://dashboard.render.com
   - Sign in or create account

2. **Create New Web Service**
   - Click **"New +"** button
   - Select **"Web Service"**

3. **Connect GitHub Repository**
   - Click **"Connect account"** if not connected
   - Select your repository: `exotel-voicebot-caller`
   - Click **"Connect"**

### Step 3: Configure Service Settings

**Basic Settings:**
- **Name**: `exotel-voicebot-caller` (or your preferred name)
- **Region**: Choose closest to your users (e.g., `Mumbai (India)` or `Singapore`)
- **Branch**: `main` (or your default branch)
- **Root Directory**: Leave empty (or `.` if needed)
- **Runtime**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm start`

**Advanced Settings (Optional):**
- **Plan**: Free (or upgrade for better performance)
- **Auto-Deploy**: `Yes` (deploys on every push to main branch)

### Step 4: Set Environment Variables

In Render Dashboard → Your Service → **Environment** section, add:

**Required Variables:**
```
EXOTEL_API_KEY=your_api_key_here
EXOTEL_API_TOKEN=your_api_token_here
EXOTEL_SID=your_account_sid_here
EXOTEL_APP_ID=your_voicebot_app_id_here
EXOTEL_CALLER_ID=your_exophone_number_here
```

**Optional Variables:**
```
EXOTEL_SUBDOMAIN=api.exotel.com
NODE_ENV=production
```
Note: `PORT` is automatically set by Render, don't set it manually.

**How to Add:**
1. Go to **Environment** tab
2. Click **"Add Environment Variable"**
3. Add each variable one by one
4. Click **"Save Changes"**

### Step 5: Deploy

1. Click **"Create Web Service"**
2. Render will:
   - Clone your repository
   - Run `npm install`
   - Start the server with `npm start`
3. Wait for deployment to complete (2-5 minutes)
4. You'll get a URL like: `https://exotel-voicebot-caller.onrender.com`

### Step 6: Test Deployment

**Health Check:**
```bash
curl https://your-app-name.onrender.com/health
```

**Make a Call:**
```bash
curl -X POST https://your-app-name.onrender.com/call \
  -H "Content-Type: application/json" \
  -d '{"to": "+9324606985"}'
```

Or use Postman/Thunder Client:
- **Method**: POST
- **URL**: `https://your-app-name.onrender.com/call`
- **Body** (JSON):
```json
{
  "to": "+9324606985"
}
```

## API Endpoints

### 1. Health Check
```
GET /
GET /health
```

### 2. Make a Call
```
POST /call
Body: {
  "to": "+9324606985",  // Required (or defaults to +9324606985)
  "from": "optional"     // Optional
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Call initiated successfully to +9324606985",
  "callSid": "abc123xyz",
  "data": { ... }
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Error message",
  "status": 500
}
```

## Using render.yaml (Alternative Method)

If you prefer using `render.yaml`:

1. Push code with `render.yaml` to GitHub
2. In Render Dashboard → **New** → **Blueprint**
3. Connect your repository
4. Render will auto-detect `render.yaml` and create service

## Important Notes

### Free Tier Limitations
- Service sleeps after 15 minutes of inactivity
- First request after sleep takes ~30 seconds (cold start)
- Consider upgrading to paid plan for always-on service

### Keep Service Alive (Free Tier)
You can use a cron job or service like:
- UptimeRobot (free) - pings `/health` every 5 minutes
- Cron-job.org - schedule HTTP requests

### Environment Variables Security
- Never commit `.env` file to GitHub
- Always use Render's Environment Variables
- Mark sensitive variables as "Secret" in Render

### Monitoring
- Check **Logs** tab in Render Dashboard for real-time logs
- Check **Metrics** for CPU, Memory, Request count

## Troubleshooting

### Service Not Starting
1. Check **Logs** tab for errors
2. Verify all environment variables are set
3. Check `package.json` start command is correct

### Call Not Working
1. Verify Exotel credentials in Environment Variables
2. Check Exotel Dashboard for API limits
3. Verify Voicebot Applet is configured correctly

### 502 Bad Gateway
- Service might be sleeping (free tier)
- Wait 30 seconds and try again
- Check service status in Render Dashboard

## Update Deployment

After making code changes:

```bash
git add .
git commit -m "Update code"
git push origin main
```

Render will automatically redeploy if **Auto-Deploy** is enabled.

## Custom Domain (Optional)

1. Go to **Settings** → **Custom Domain**
2. Add your domain
3. Update DNS records as instructed
4. Wait for SSL certificate (automatic)

## Support

- Render Docs: https://render.com/docs
- Render Support: https://render.com/support
- Exotel Docs: https://developer.exotel.com

