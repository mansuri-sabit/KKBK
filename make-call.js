import axios from 'axios';

const targetNumber = '+919324606985';
const serverUrl = 'https://kkbk-xjhf.onrender.com';

async function makeCall() {
  try {
    console.log(`📞 Initiating call to ${targetNumber}...`);
    console.log(`   Server: ${serverUrl}`);
    
    const response = await axios.post(`${serverUrl}/call`, {
      to: targetNumber
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    console.log('\n✅ Call initiated successfully!');
    console.log('📋 Response:', JSON.stringify(response.data, null, 2));
    
    if (response.data.callSid) {
      console.log(`\n🎉 Call SID: ${response.data.callSid}`);
    }
  } catch (error) {
    console.error('\n❌ Error making call:');
    
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Response:`, JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('   No response from server. Server might be down or not deployed.');
      console.error('   Error:', error.message);
    } else {
      console.error('   Error:', error.message);
    }
    
    console.error('\n💡 Possible solutions:');
    console.error('   1. Check if server is deployed on Render');
    console.error('   2. Verify server is running and accessible');
    console.error('   3. Check Render deployment logs');
    process.exit(1);
  }
}

makeCall();

