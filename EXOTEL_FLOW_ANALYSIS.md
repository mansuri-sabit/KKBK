# Exotel Connection Flow Analysis

## Overview
This document explains how Exotel integration works in the `backendRef` folder and how to implement it in your main backend files.

## Key Components

### 1. Exotel Service (`backendRef/src/services/exotel.service.ts`)
- **Purpose**: Handles all Exotel API interactions
- **Authentication**: Basic Auth using `apiKey:apiToken`
- **Base URL Format**: `https://{apiKey}:{apiToken}@{subdomain}/v1/Accounts/{sid}`
- **Key Methods**:
  - `makeCall()`: Initiates outbound calls
  - `makeCallWithCredentials()`: Uses per-phone credentials
  - `parseWebhook()`: Parses Exotel webhook payloads

### 2. Exotel Outbound Service (`backendRef/src/services/exotelOutbound.service.ts`)
- **Purpose**: Specialized service for outbound calls with Voicebot applet
- **Voicebot URL Format**: `http://my.exotel.com/{sid}/exoml/start_voice/{appId}`
- **API Version**: Uses v1 API (`/Calls/connect.json`)
- **Request Format**: Form-encoded (`application/x-www-form-urlencoded`)
- **Key Parameters**:
  - `From`: Customer number to call
  - `CallerId`: Number to display
  - `Url`: Voicebot applet URL
  - `CustomField`: Optional data (e.g., callLogId)

### 3. Exotel Voice Controller (`backendRef/src/controllers/exotelVoice.controller.ts`)
- **Purpose**: Handles Voicebot webhooks from Exotel
- **Key Endpoints**:
  - `/api/v1/exotel/voice/connect`: Entry point (returns WebSocket URL)
  - `/api/v1/exotel/voice/greeting`: First message audio
  - `/api/v1/exotel/voice/input`: User audio input
  - `/api/v1/exotel/voice/end`: Call end cleanup

## Connection Flow

### Outbound Call Flow

```
1. User initiates call via API
   ↓
2. Create CallLog in database
   ↓
3. Get phone-specific Exotel credentials (encrypted in DB)
   ↓
4. Construct Voicebot URL: http://my.exotel.com/{sid}/exoml/start_voice/{appId}
   ↓
5. Call Exotel API:
   POST https://{apiKey}:{apiToken}@{subdomain}/v1/Accounts/{sid}/Calls/connect
   Body (form-encoded):
     From: {customer_number}
     CallerId: {exotel_phone}
     Url: {voicebot_url}
     CustomField: {callLogId}
   ↓
6. Exotel initiates call to customer
   ↓
7. Exotel calls Voicebot applet (configured in Exotel dashboard)
   ↓
8. Voicebot applet calls webhook: /api/v1/exotel/voice/connect?call_id=xxx
   ↓
9. Backend returns WebSocket URL: wss://your-domain.com/ws/exotel/voice/{callLogId}
   ↓
10. Exotel connects to WebSocket for real-time audio
```

### Inbound Call Flow

```
1. Customer calls Exotel number
   ↓
2. Exotel routes to Voicebot applet (configured on phone number)
   ↓
3. Voicebot applet calls webhook: /api/v1/exotel/voice/connect
   ↓
4. Backend finds phone by number in database
   ↓
5. Create CallLog for incoming call
   ↓
6. Return WebSocket URL: wss://your-domain.com/ws/exotel/voice/{callLogId}
   ↓
7. Exotel connects to WebSocket for real-time audio
```

## Key Differences: Your Current vs backendRef Implementation

### Your Current Implementation (`index.js` + `server.js`)
- ✅ Basic Exotel API call works
- ✅ Environment variables for credentials
- ❌ No per-phone credentials support
- ❌ No database integration
- ❌ Voicebot URL construction is incorrect
- ❌ Webhook handling is basic
- ❌ No CallLog tracking

### backendRef Implementation
- ✅ Per-phone encrypted credentials
- ✅ Database integration (CallLog, Phone, Agent models)
- ✅ Correct Voicebot URL format
- ✅ Proper webhook handling with CallLog tracking
- ✅ WebSocket integration for real-time audio
- ✅ Campaign call management
- ✅ Concurrency control

## Implementation Steps for Your Backend

### Step 1: Update `index.js` (ExotelVoicebotCaller class)
- Fix Voicebot URL construction
- Support per-phone credentials
- Add CustomField parameter for call tracking

### Step 2: Update `server.js`
- Add proper webhook endpoints
- Implement CallLog creation (if using database)
- Return correct WebSocket URL format
- Handle both incoming and outgoing calls

### Step 3: Voicebot URL Format
```javascript
// CORRECT (from backendRef):
const voicebotUrl = `http://my.exotel.com/${sid}/exoml/start_voice/${appId}`;

// Your current (WRONG):
const voicebotUrl = `http://my.exotel.com/${this.sid}/exoml/start_voice/${this.appId}`;
// This is actually correct format, but needs to be in the API call properly
```

### Step 4: API Call Parameters
```javascript
// v1 API uses form-encoded data
const params = new URLSearchParams({
  From: toNumber,  // Customer number
  CallerId: callerId,  // Display number
  Url: voicebotUrl,  // Voicebot applet URL
  CustomField: callLogId  // Optional tracking data
});

// POST to: /v1/Accounts/{sid}/Calls/connect
// Headers: Content-Type: application/x-www-form-urlencoded
```

## Environment Variables Needed

```env
# Global Exotel Config (fallback)
EXOTEL_API_KEY=your_api_key
EXOTEL_API_TOKEN=your_api_token
EXOTEL_SID=your_sid
EXOTEL_SUBDOMAIN=api.exotel.com  # or api.in.exotel.com

# Voicebot Config
EXOTEL_APP_ID=your_voicebot_app_id
EXOTEL_CALLER_ID=your_exotel_phone_number

# Webhook Base URL
WEBHOOK_BASE_URL=https://your-domain.com
RENDER_EXTERNAL_URL=https://your-domain.com  # For Render deployment
```

## Testing Checklist

- [ ] Outbound call initiates successfully
- [ ] Voicebot webhook receives call
- [ ] WebSocket URL is returned correctly
- [ ] CallLog is created (if using database)
- [ ] Incoming calls work
- [ ] Per-phone credentials work (if implemented)

