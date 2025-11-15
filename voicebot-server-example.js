/**
 * Example Voicebot WebSocket Server
 * This is a simple example showing how to set up a WebSocket server
 * that Exotel Voicebot Applet can connect to
 */

import { WebSocketServer } from 'ws';
import http from 'http';
import https from 'https';
import fs from 'fs';

// Configuration
const PORT = process.env.VOICEBOT_PORT || 8080;
const USE_HTTPS = process.env.USE_HTTPS === 'true';

/**
 * Simple Voicebot WebSocket Server
 * Handles Exotel Voicebot connections
 */
class VoicebotServer {
  constructor() {
    this.server = null;
    this.wss = null;
  }

  /**
   * Handle WebSocket connection from Exotel
   */
  handleConnection(ws, request) {
    const callId = new URL(request.url, `http://${request.headers.host}`).searchParams.get('call_id') || 'unknown';
    
    console.log(`📞 New Voicebot connection - Call ID: ${callId}`);
    console.log(`   Remote: ${request.socket.remoteAddress}`);
    
    // Send welcome message
    ws.on('open', () => {
      console.log(`✅ WebSocket connection opened for Call ID: ${callId}`);
    });

    // Handle incoming messages from Exotel
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log(`📨 Received message for Call ${callId}:`, message);
        
        // Process the message and send response
        this.handleVoicebotMessage(ws, callId, message);
      } catch (error) {
        console.error(`❌ Error parsing message for Call ${callId}:`, error);
      }
    });

    // Handle connection close
    ws.on('close', () => {
      console.log(`🔌 Connection closed for Call ID: ${callId}`);
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error(`❌ WebSocket error for Call ${callId}:`, error);
    });
  }

  /**
   * Handle voicebot messages and send responses
   */
  handleVoicebotMessage(ws, callId, message) {
    // Example: Echo back or process the message
    // You'll need to implement your actual voicebot logic here
    
    const response = {
      type: 'response',
      call_id: callId,
      message: 'Message received',
      timestamp: new Date().toISOString()
    };

    ws.send(JSON.stringify(response));
  }

  /**
   * Start the server
   */
  start() {
    // Create HTTP/HTTPS server
    if (USE_HTTPS) {
      // For HTTPS, you need SSL certificates
      const options = {
        key: fs.readFileSync(process.env.SSL_KEY_PATH || 'key.pem'),
        cert: fs.readFileSync(process.env.SSL_CERT_PATH || 'cert.pem')
      };
      this.server = https.createServer(options);
    } else {
      this.server = http.createServer();
    }

    // Create WebSocket server
    this.wss = new WebSocketServer({ 
      server: this.server,
      path: '/voicebot/ws'
    });

    this.wss.on('connection', (ws, request) => {
      this.handleConnection(ws, request);
    });

    this.server.listen(PORT, () => {
      const protocol = USE_HTTPS ? 'wss' : 'ws';
      console.log(`🚀 Voicebot WebSocket Server started`);
      console.log(`   Protocol: ${protocol}`);
      console.log(`   Port: ${PORT}`);
      console.log(`   URI: ${protocol}://localhost:${PORT}/voicebot/ws`);
      console.log(`\n📝 Use this URI in Exotel Voicebot Applet configuration:`);
      console.log(`   ${protocol}://your-domain.com/voicebot/ws`);
    });
  }
}

// Start server if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new VoicebotServer();
  server.start();
}

export { VoicebotServer };

