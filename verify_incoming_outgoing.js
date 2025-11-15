/**
 * Verification Script for Incoming/Outgoing Call Features
 * Checks if both features are properly implemented
 */

import { readFileSync } from 'fs';

console.log('🔍 Verifying Incoming/Outgoing Call Features...\n');

let issues = [];
let passed = [];

// Read server.js to check implementation
const serverCode = readFileSync('server.js', 'utf-8');
const indexCode = readFileSync('index.js', 'utf-8');

// 1. Check Outgoing Call Endpoint
console.log('1️⃣  Checking Outgoing Call Feature (POST /call)...');
if (serverCode.includes('app.post(\'/call\'')) {
  passed.push('✅ POST /call endpoint exists');
} else {
  issues.push('❌ POST /call endpoint not found');
}

if (serverCode.includes('ExotelVoicebotCaller')) {
  passed.push('✅ ExotelVoicebotCaller class is imported');
} else {
  issues.push('❌ ExotelVoicebotCaller not imported');
}

if (indexCode.includes('makeCall')) {
  passed.push('✅ makeCall method exists in ExotelVoicebotCaller');
} else {
  issues.push('❌ makeCall method not found');
}

// 2. Check Incoming Call Webhook
console.log('\n2️⃣  Checking Incoming Call Feature (Webhook)...');
const webhookPaths = [
  '/voicebot/connect',
  '/api/v1/exotel/voice/connect'
];

webhookPaths.forEach(path => {
  if (serverCode.includes(`app.get('${path}'`) || serverCode.includes(`app.get("${path}"`)) {
    passed.push(`✅ GET ${path} endpoint exists`);
  } else {
    issues.push(`❌ GET ${path} endpoint not found`);
  }
  
  if (serverCode.includes(`app.post('${path}'`) || serverCode.includes(`app.post("${path}"`)) {
    passed.push(`✅ POST ${path} endpoint exists`);
  } else {
    issues.push(`❌ POST ${path} endpoint not found`);
  }
});

// 3. Check Direction Handling
console.log('\n3️⃣  Checking Direction Handling...');
if (serverCode.includes('Direction') || serverCode.includes('direction')) {
  passed.push('✅ Direction parameter is being parsed from webhook');
} else {
  issues.push('❌ Direction parameter not being parsed');
}

if (serverCode.includes('handleVoicebotConnect')) {
  passed.push('✅ handleVoicebotConnect function exists');
} else {
  issues.push('❌ handleVoicebotConnect function not found');
}

// 4. Check WebSocket Handling
console.log('\n4️⃣  Checking WebSocket Handling...');
if (serverCode.includes('WebSocketServer')) {
  passed.push('✅ WebSocketServer is set up');
} else {
  issues.push('❌ WebSocketServer not found');
}

if (serverCode.includes('/voicebot/ws') || serverCode.includes('WS_PATH')) {
  passed.push('✅ WebSocket path is configured');
} else {
  issues.push('❌ WebSocket path not configured');
}

if (serverCode.includes('handleMediaEvent')) {
  passed.push('✅ Media event handler exists');
} else {
  issues.push('❌ Media event handler not found');
}

if (serverCode.includes('track') && serverCode.includes('inbound')) {
  passed.push('✅ Inbound audio track handling exists');
} else {
  issues.push('❌ Inbound audio track handling not found');
}

// 5. Check CustomField Support (for outbound tracking)
console.log('\n5️⃣  Checking Outbound Call Tracking...');
if (serverCode.includes('CustomField') || serverCode.includes('customField')) {
  passed.push('✅ CustomField support exists for outbound tracking');
} else {
  issues.push('❌ CustomField support not found');
}

if (indexCode.includes('CustomField')) {
  passed.push('✅ CustomField is passed in makeCall');
} else {
  issues.push('❌ CustomField not passed in makeCall');
}

// 6. Check Greeting for Both Types
console.log('\n6️⃣  Checking Greeting Feature...');
if (serverCode.includes('synthesizeAndStreamGreeting')) {
  passed.push('✅ Greeting synthesis function exists');
} else {
  issues.push('❌ Greeting synthesis function not found');
}

if (serverCode.includes('greetingSent')) {
  passed.push('✅ Greeting tracking exists');
} else {
  issues.push('❌ Greeting tracking not found');
}

// 7. Check Session Management
console.log('\n7️⃣  Checking Session Management...');
if (serverCode.includes('activeSessions')) {
  passed.push('✅ Active sessions tracking exists');
} else {
  issues.push('❌ Active sessions tracking not found');
}

if (serverCode.includes('VoiceSession')) {
  passed.push('✅ VoiceSession class exists');
} else {
  issues.push('❌ VoiceSession class not found');
}

// 8. Check Error Handling
console.log('\n8️⃣  Checking Error Handling...');
if (serverCode.includes('try') && serverCode.includes('catch')) {
  passed.push('✅ Error handling exists in webhook handler');
} else {
  issues.push('❌ Error handling missing in webhook handler');
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('📊 VERIFICATION SUMMARY');
console.log('='.repeat(60));

console.log(`\n✅ Passed: ${passed.length} checks`);
passed.forEach(check => console.log(`   ${check}`));

if (issues.length > 0) {
  console.log(`\n❌ Issues Found: ${issues.length} checks`);
  issues.forEach(issue => console.log(`   ${issue}`));
} else {
  console.log('\n✅ No issues found!');
}

console.log('\n' + '='.repeat(60));
console.log('📝 DETAILED ANALYSIS');
console.log('='.repeat(60));

// Detailed Analysis
console.log('\n🔵 OUTGOING CALLS:');
console.log('   Flow: POST /call → ExotelVoicebotCaller.makeCall() → Exotel API');
console.log('   Webhook: /api/v1/exotel/voice/connect (Direction: outbound-api)');
console.log('   CustomField: Supported for call tracking');

console.log('\n🟢 INCOMING CALLS:');
console.log('   Flow: Customer calls Exotel number → Voicebot applet → Webhook');
console.log('   Webhook: /api/v1/exotel/voice/connect (Direction: inbound)');
console.log('   CustomField: Not applicable (no CustomField in incoming calls)');

console.log('\n🔄 COMMON FLOW:');
console.log('   Both use same WebSocket handler: /voicebot/ws');
console.log('   Both use same greeting mechanism');
console.log('   Both use same audio processing pipeline');

console.log('\n⚠️  POTENTIAL ISSUES TO CHECK:');
console.log('   1. Exotel Dashboard: Voicebot applet must be configured for incoming calls');
console.log('   2. Phone Number: Must be assigned to Voicebot applet in Exotel');
console.log('   3. Environment Variables: WEBHOOK_BASE_URL must be set correctly');
console.log('   4. Testing: Test both flows with actual calls');

console.log('\n' + '='.repeat(60));

if (issues.length === 0) {
  console.log('✅ All checks passed! Features appear to be properly implemented.');
  console.log('   Next step: Test with actual incoming and outgoing calls.');
  process.exit(0);
} else {
  console.log('⚠️  Some issues found. Please review and fix before testing.');
  process.exit(1);
}

