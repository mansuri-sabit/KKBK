# OpenAI Setup Guide

## ✅ Good News: System Already Uses OpenAI!

आपका system पहले से ही OpenAI use करने के लिए configure है। आपको **कोई code changes की जरूरत नहीं है!**

## 🔑 Required Environment Variables

आपको सिर्फ **environment variables** set करने होंगे:

### 1. OpenAI API Key (Required)
```env
OPENAI_API_KEY=sk-your-openai-api-key-here
```

### 2. OpenAI Model (Optional - Default: gpt-4o-mini)
```env
OPENAI_MODEL=gpt-4o-mini
# या
OPENAI_MODEL=gpt-4o
# या
OPENAI_MODEL=gpt-3.5-turbo
```

### 3. TTS Provider (Optional - Default: openai)
```env
TTS_PROVIDER=openai
```

## 📋 Complete .env File Example

```env
# OpenAI Configuration
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OPENAI_MODEL=gpt-4o-mini
TTS_PROVIDER=openai

# MongoDB (Required for persona/knowledgebase)
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/voicebot

# Exotel Configuration
EXOTEL_API_KEY=your-exotel-api-key
EXOTEL_API_TOKEN=your-exotel-api-token
EXOTEL_SID=your-exotel-sid
EXOTEL_APP_ID=your-exotel-app-id
EXOTEL_CALLER_ID=your-caller-id
```

## 🎯 What OpenAI Services Are Used?

### 1. **AI Conversation (ChatGPT)**
- **Service**: `utils/aiService.js`
- **Model**: `gpt-4o-mini` (default) या आपकी choice
- **Use**: User queries के लिए AI replies generate करने के लिए
- **API**: OpenAI ChatCompletion API

### 2. **Speech-to-Text (Whisper)**
- **Service**: `utils/sttService.js`
- **Model**: `whisper-1`
- **Use**: User की voice को text में convert करने के लिए
- **API**: OpenAI Whisper API

### 3. **Text-to-Speech (TTS)**
- **Service**: `utils/ttsService.js`
- **Model**: `tts-1` (fast) या `tts-1-hd` (high quality)
- **Voices**: `alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer`
- **Use**: AI replies को voice में convert करने के लिए
- **API**: OpenAI TTS API

## 🚀 Setup Steps

### Step 1: Get OpenAI API Key
1. Visit: https://platform.openai.com/api-keys
2. Login/Signup
3. Create new API key
4. Copy the key (starts with `sk-`)

### Step 2: Set Environment Variables

#### Local Development (.env file)
```bash
# Create .env file in project root
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4o-mini
TTS_PROVIDER=openai
```

#### Render Deployment
1. Go to Render Dashboard
2. Select your service
3. Go to "Environment" tab
4. Add environment variables:
   - `OPENAI_API_KEY` = `sk-your-key-here`
   - `OPENAI_MODEL` = `gpt-4o-mini` (optional)
   - `TTS_PROVIDER` = `openai` (optional)

### Step 3: Restart Server
```bash
# Local
npm start

# Render - Auto restarts when env vars are updated
```

## ⚙️ Configuration Options

### AI Model Selection
```env
# Fast & Cheap (Recommended for voice)
OPENAI_MODEL=gpt-4o-mini

# More Capable
OPENAI_MODEL=gpt-4o

# Legacy (Cheaper)
OPENAI_MODEL=gpt-3.5-turbo
```

### TTS Voice Selection
आप `utils/ttsService.js` में voice change कर सकते हैं:

```javascript
// Default voice: 'alloy'
// Available: 'alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'
const selectedVoice = 'nova'; // Change this
```

या environment variable add करें:
```env
OPENAI_TTS_VOICE=nova
```

## 💰 Cost Estimation

### GPT-4o-mini (Recommended)
- **Input**: $0.15 per 1M tokens
- **Output**: $0.60 per 1M tokens
- **Average call**: ~500 tokens = $0.0003 per call

### Whisper (STT)
- **Cost**: $0.006 per minute
- **Average call**: 2 minutes = $0.012 per call

### TTS
- **tts-1**: $15 per 1M characters
- **tts-1-hd**: $30 per 1M characters
- **Average reply**: 100 characters = $0.0015 per reply

### Total per Call
- **Average 5-minute call**: ~$0.02-0.03
- **100 calls**: ~$2-3
- **1000 calls**: ~$20-30

## ✅ Verification

### Test AI Service
```bash
# Check if OpenAI is configured
curl http://localhost:3000/health
```

### Test in Logs
Server start करने पर logs में दिखना चाहिए:
```
✅ OpenAI client initialized
🎙️ TTS synthesis using openai
📝 Transcribing audio with Whisper...
```

### Test in Browser Console
Admin panel में जाकर persona save करें - अगर सब कुछ OK है तो कोई error नहीं आएगा।

## 🔧 Troubleshooting

### Error: "OPENAI_API_KEY not configured"
**Solution**: 
- Check `.env` file exists
- Verify `OPENAI_API_KEY` is set
- Restart server after adding env vars

### Error: "Insufficient quota"
**Solution**:
- Check OpenAI account balance
- Verify billing is set up
- Check usage limits at https://platform.openai.com/usage

### Error: "Model not found"
**Solution**:
- Verify model name is correct
- Check if you have access to the model
- Try `gpt-4o-mini` (most accessible)

### TTS Not Working
**Solution**:
- Verify `TTS_PROVIDER=openai` is set
- Check `OPENAI_API_KEY` is valid
- Check OpenAI TTS API status

## 📝 Code Locations (No Changes Needed!)

### AI Service
- **File**: `utils/aiService.js`
- **Already configured**: ✅
- **Uses**: OpenAI ChatCompletion API

### STT Service
- **File**: `utils/sttService.js`
- **Already configured**: ✅
- **Uses**: OpenAI Whisper API

### TTS Service
- **File**: `utils/ttsService.js`
- **Already configured**: ✅
- **Uses**: OpenAI TTS API (when `TTS_PROVIDER=openai`)

## 🎉 Summary

**आपको कोई code changes की जरूरत नहीं है!**

सिर्फ:
1. ✅ OpenAI API key लें
2. ✅ `.env` file में `OPENAI_API_KEY` set करें
3. ✅ Server restart करें

बस! System automatically OpenAI use करेगा! 🚀

## 📞 Support

अगर issues हों:
1. Check server logs
2. Verify API key is correct
3. Check OpenAI dashboard for usage/quota
4. Test API key directly: `curl https://api.openai.com/v1/models -H "Authorization: Bearer sk-your-key"`

