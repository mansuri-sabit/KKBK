import { ExotelVoicebotCaller } from './index.js';
import dotenv from 'dotenv';

dotenv.config();

const targetNumber = '+919324606985';

// Configuration from environment variables
const config = {
  apiKey: process.env.EXOTEL_API_KEY,
  apiToken: process.env.EXOTEL_API_TOKEN,
  sid: process.env.EXOTEL_SID,
  subdomain: process.env.EXOTEL_SUBDOMAIN || 'api.exotel.com',
  appId: process.env.EXOTEL_APP_ID,
  callerId: process.env.EXOTEL_CALLER_ID
};

async function makeCall() {
  try {
    console.log(`📞 Initiating call to ${targetNumber}...\n`);
    
    // Check if config is available
    if (!config.apiKey || !config.apiToken || !config.sid || !config.appId || !config.callerId) {
      console.error('❌ Missing Exotel configuration!');
      console.error('\n📝 Required environment variables:');
      console.error('   - EXOTEL_API_KEY');
      console.error('   - EXOTEL_API_TOKEN');
      console.error('   - EXOTEL_SID');
      console.error('   - EXOTEL_APP_ID');
      console.error('   - EXOTEL_CALLER_ID');
      console.error('\n💡 Please set these in your .env file or environment variables.');
      process.exit(1);
    }

    const caller = new ExotelVoicebotCaller(config);
    const result = await caller.makeCall(targetNumber);
    
    if (result.success) {
      console.log(`\n🎉 Call successfully initiated to ${targetNumber}`);
      console.log(`   Call SID: ${result.callSid}`);
    } else {
      console.error(`\n💥 Failed to initiate call to ${targetNumber}`);
      console.error('   Error:', result.error);
      process.exit(1);
    }
  } catch (error) {
    console.error('\n💥 Error:', error.message);
    process.exit(1);
  }
}

makeCall();

