/**
 * Example HTTP Endpoint that returns WebSocket URL
 * Exotel Voicebot Applet can use this HTTP endpoint
 * which returns a WebSocket URL for each call
 */

import http from 'http';
import https from 'https';
import { URL } from 'url';

const PORT = process.env.ENDPOINT_PORT || 3000;

/**
 * HTTP Endpoint Server
 * Returns WebSocket URL for Exotel Voicebot
 */
class VoicebotEndpointServer {
  constructor() {
    this.wssBaseUrl = process.env.WSS_BASE_URL || 'wss://your-server.com/voicebot/ws';
  }

  /**
   * Handle HTTP request and return WebSocket URL
   */
  handleRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const callId = url.searchParams.get('call_id') || `call_${Date.now()}`;
    
    // CORS headers (if needed)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'GET' && url.pathname === '/voicebot/endpoint') {
      // Return WebSocket URL
      const wssUrl = `${this.wssBaseUrl}?call_id=${callId}`;
      
      const response = {
        wss_url: wssUrl,
        call_id: callId,
        timestamp: new Date().toISOString()
      };

      console.log(`📞 Request for WebSocket URL - Call ID: ${callId}`);
      console.log(`   Returning: ${wssUrl}`);

      res.writeHead(200);
      res.end(JSON.stringify(response));
    } else {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  }

  start() {
    const server = http.createServer((req, res) => {
      this.handleRequest(req, res);
    });

    server.listen(PORT, () => {
      console.log(`🚀 Voicebot Endpoint Server started`);
      console.log(`   Port: ${PORT}`);
      console.log(`   Endpoint: http://localhost:${PORT}/voicebot/endpoint`);
      console.log(`\n📝 Use this URI in Exotel Voicebot Applet configuration:`);
      console.log(`   http://your-domain.com:${PORT}/voicebot/endpoint`);
      console.log(`\n   Or with HTTPS:`);
      console.log(`   https://your-domain.com/voicebot/endpoint`);
    });
  }
}

// Start server if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new VoicebotEndpointServer();
  server.start();
}

export { VoicebotEndpointServer };

