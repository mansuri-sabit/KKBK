/**
 * Simple Gemini Streaming API Test Script
 * Tests if Gemini streaming API is working correctly
 * 
 * Usage: node test-gemini-streaming.js
 */

import { readFileSync } from 'fs';

// Load .env file manually if it exists
try {
  const envFile = readFileSync('.env', 'utf8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      if (key && value) {
        process.env[key] = value;
      }
    }
  });
} catch (error) {
  // .env file not found, use environment variables
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_STREAM_API_URL = process.env.GEMINI_STREAM_API_URL || 
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent';

async function testGeminiStreaming() {
  if (!GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY not configured');
    process.exit(1);
  }

  console.log('🧪 Testing Gemini 2.0 Flash Streaming API...');
  console.log(`   API URL: ${GEMINI_STREAM_API_URL}`);
  console.log(`   API Key: ${GEMINI_API_KEY.substring(0, 10)}...`);
  console.log('');

  const testPrompt = 'Hello, how are you? Please respond in one sentence.';
  console.log(`📝 Test prompt: "${testPrompt}"`);
  console.log('');

  try {
    const startTime = Date.now();
    let fullReply = '';
    let tokenCount = 0;

    console.log('📡 Sending request to Gemini API...');

    const response = await fetch(
      `${GEMINI_STREAM_API_URL}?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: testPrompt
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 150,
            topP: 1,
            topK: 40
          }
        })
      }
    );

    console.log(`   Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`❌ HTTP Error: ${response.status}`);
      console.error(`   Response: ${errorData.substring(0, 500)}`);
      try {
        const parsed = JSON.parse(errorData);
        console.error(`   Error message: ${parsed.error?.message || parsed.message || 'Unknown error'}`);
      } catch {
        // Keep original error
      }
      process.exit(1);
    }

    console.log('✅ Response received, reading stream...');
    console.log('');

    // Read the streaming response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        // Decode chunk
        buffer += decoder.decode(value, { stream: true });
        
        // Process complete SSE lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            
            // Skip empty data lines and [DONE] marker
            if (!dataStr || dataStr === '[DONE]') {
              continue;
            }

            try {
              const data = JSON.parse(dataStr);
              
              // Extract text from candidate
              const candidate = data.candidates?.[0];
              if (candidate) {
                // Check for finish reason - stream is complete
                if (candidate.finishReason) {
                  console.log(`   ✅ Finish reason: ${candidate.finishReason}`);
                  continue;
                }

                // Extract incremental text (delta) from content parts
                const parts = candidate.content?.parts;
                if (parts && Array.isArray(parts)) {
                  for (const part of parts) {
                    const deltaText = part.text;
                    if (deltaText) {
                      fullReply += deltaText;
                      tokenCount++;
                      process.stdout.write(deltaText); // Print as it arrives
                    }
                  }
                }
              }
            } catch (parseError) {
              // Skip malformed JSON lines (can happen in SSE streams)
              if (!parseError.message.includes('JSON')) {
                console.warn(`   ⚠️  Parse warning: ${parseError.message}`);
              }
            }
          }
        }
      }

      // Ensure we process any remaining buffer
      if (buffer.trim() && buffer.startsWith('data: ')) {
        const dataStr = buffer.slice(6).trim();
        if (dataStr && dataStr !== '[DONE]') {
          try {
            const data = JSON.parse(dataStr);
            const candidate = data.candidates?.[0];
            const deltaText = candidate?.content?.parts?.[0]?.text;
            if (deltaText) {
              fullReply += deltaText;
              tokenCount++;
              process.stdout.write(deltaText);
            }
          } catch (e) {
            // Ignore parse errors in final buffer
          }
        }
      }

      const apiLatency = Date.now() - startTime;
      console.log('');
      console.log('');

      if (fullReply && fullReply.trim().length > 0) {
        console.log(`✅ SUCCESS!`);
        console.log(`   Total tokens received: ${tokenCount}`);
        console.log(`   Total characters: ${fullReply.length}`);
        console.log(`   Latency: ${apiLatency}ms`);
        console.log(`   Full reply: "${fullReply.trim()}"`);
      } else {
        console.error(`❌ FAILED: No tokens received`);
        console.error(`   Token count: ${tokenCount}`);
        console.error(`   Response was empty`);
        process.exit(1);
      }

    } finally {
      reader.releaseLock();
    }

  } catch (error) {
    console.error(`❌ ERROR: ${error.message}`);
    if (error.stack) {
      console.error(`   Stack: ${error.stack.substring(0, 300)}`);
    }
    process.exit(1);
  }
}

// Run the test
testGeminiStreaming().catch(error => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});

