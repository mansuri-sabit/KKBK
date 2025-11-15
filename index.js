import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Exotel Voicebot Caller
 * Makes a call using Exotel API with Voicebot Applet
 */
class ExotelVoicebotCaller {
  constructor(config) {
    this.apiKey = config.apiKey || process.env.EXOTEL_API_KEY;
    this.apiToken = config.apiToken || process.env.EXOTEL_API_TOKEN;
    this.sid = config.sid || process.env.EXOTEL_SID;
    
    // Default subdomain is api.exotel.com
    // Can also use 'api.in' which becomes 'api.in.exotel.com'
    let subdomain = config.subdomain || process.env.EXOTEL_SUBDOMAIN || 'api.exotel.com';
    if (subdomain === 'api') {
      this.subdomain = 'api.exotel.com';
    } else if (subdomain === 'api.in') {
      this.subdomain = 'api.in.exotel.com';
    } else {
      this.subdomain = subdomain;
    }
    
    this.appId = config.appId || process.env.EXOTEL_APP_ID;
    this.callerId = config.callerId || process.env.EXOTEL_CALLER_ID;
    
    if (!this.apiKey || !this.apiToken || !this.sid || !this.appId || !this.callerId) {
      throw new Error('Missing required Exotel configuration. Please set environment variables or pass config object.');
    }
  }

  /**
   * Make a call using Exotel Voicebot Applet
   * Based on backendRef implementation pattern
   * 
   * @param {string} toNumber - The customer number to call (e.g., +9324606985)
   * @param {string} fromNumber - Optional: The Exotel phone number to use (defaults to callerId)
   * @param {string} customField - Optional: Custom data to pass (e.g., callLogId for tracking)
   * @returns {Promise<Object>} - API response with call details
   */
  async makeCall(toNumber, fromNumber = null, customField = null) {
    // Exotel v1 API endpoint
    const url = `https://${this.apiKey}:${this.apiToken}@${this.subdomain}/v1/Accounts/${this.sid}/Calls/connect`;
    
    // Normalize numbers for comparison (remove +, spaces, dashes)
    const normalizeNumber = (num) => num ? num.replace(/[^0-9]/g, '') : '';
    const normalizedTo = normalizeNumber(toNumber);
    const normalizedCallerId = normalizeNumber(this.callerId);
    
    // Validate toNumber
    if (!toNumber || normalizedTo === normalizedCallerId) {
      throw new Error(`Invalid target number. To number (${toNumber}) cannot be same as CallerId (${this.callerId}).`);
    }
    
    // For Exotel v1 API with Voicebot:
    // - From: Customer number (who to call)
    // - CallerId: Exotel phone number (what shows on recipient's phone)
    // - To: Not used in v1 API for Voicebot calls
    const from = fromNumber || this.callerId;
    const normalizedFrom = normalizeNumber(from);
    
    // Ensure To and From are different
    if (normalizedFrom === normalizedTo) {
      throw new Error(`From (${from}) and To (${toNumber}) numbers cannot be the same.`);
    }
    
    // Exotel Voicebot Applet URL format (matches backendRef pattern)
    // Format: http://my.exotel.com/{sid}/exoml/start_voice/{appId}
    const voicebotUrl = `http://my.exotel.com/${this.sid}/exoml/start_voice/${this.appId}`;
    
    // v1 API uses form-encoded data (matches backendRef/src/services/exotelOutbound.service.ts)
    const params = new URLSearchParams({
      From: toNumber,  // Customer number to call (v1 API pattern from backendRef)
      CallerId: this.callerId,  // Display number
      Url: voicebotUrl,  // Voicebot applet URL
      ...(customField && { CustomField: customField })  // Optional tracking data
    });
    
    // Log the actual parameters being sent
    console.log(`   API Parameters:`, Object.fromEntries(params));

    try {
      console.log(`📞 Initiating call via Exotel Voicebot...`);
      console.log(`   Customer Number (From): ${toNumber}`);
      console.log(`   CallerId (Display): ${this.callerId}`);
      console.log(`   Voicebot Applet ID: ${this.appId}`);
      console.log(`   Voicebot URL: ${voicebotUrl}`);
      console.log(`   Account SID: ${this.sid}`);
      if (customField) {
        console.log(`   CustomField: ${customField}`);
      }
      
      // POST to Exotel API with form-encoded data
      const response = await axios.post(url, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      console.log('✅ Call initiated successfully!');
      console.log('📋 Call Details:', JSON.stringify(response.data, null, 2));
      
      return {
        success: true,
        data: response.data,
        callSid: response.data.Call?.Sid || response.data.Sid
      };
    } catch (error) {
      console.error('❌ Error initiating call:');
      
      if (error.response) {
        console.error('   Status:', error.response.status);
        console.error('   Response:', JSON.stringify(error.response.data, null, 2));
        return {
          success: false,
          error: error.response.data,
          status: error.response.status
        };
      } else {
        console.error('   Message:', error.message);
        return {
          success: false,
          error: error.message
        };
      }
    }
  }
}

// Main execution
async function main() {
  const targetNumber = '+9324606985';
  
  // Configuration - can be overridden via environment variables
  const config = {
    // These should be set in .env file or environment variables
    // apiKey: 'your_api_key',
    // apiToken: 'your_api_token',
    // sid: 'your_sid',
    // subdomain: 'api.exotel.com', // or 'api.in.exotel.com' for India
    // appId: 'your_voicebot_app_id',
    // callerId: 'your_exophone_number'
  };

  try {
    const caller = new ExotelVoicebotCaller(config);
    const result = await caller.makeCall(targetNumber);
    
    if (result.success) {
      console.log(`\n🎉 Call successfully initiated to ${targetNumber}`);
      console.log(`   Call SID: ${result.callSid}`);
    } else {
      console.error(`\n💥 Failed to initiate call to ${targetNumber}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('\n💥 Configuration Error:', error.message);
    console.error('\n📝 Please ensure you have set the following environment variables:');
    console.error('   - EXOTEL_API_KEY');
    console.error('   - EXOTEL_API_TOKEN');
    console.error('   - EXOTEL_SID');
    console.error('   - EXOTEL_APP_ID (Voicebot Applet ID)');
    console.error('   - EXOTEL_CALLER_ID (Your ExoPhone number)');
    console.error('\n   Optional:');
    console.error('   - EXOTEL_SUBDOMAIN (default: api.exotel.com)');
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { ExotelVoicebotCaller };

