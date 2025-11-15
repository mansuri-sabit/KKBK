/**
 * AI Conversation Service
 * Generates conversational replies using Google Gemini API
 */

import dotenv from 'dotenv';
import { loadPersonaFromMongo } from './personaService.js';
import { getRelevantChunks } from './knowledgebaseMongo.js';

dotenv.config();

class AIService {
  constructor() {
    // Gemini is now the primary (and only) provider
    this.geminiApiKey = process.env.GEMINI_API_KEY;
    this.geminiApiUrl = process.env.GEMINI_API_URL || 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
    // Streaming endpoint for real-time token streaming
    this.geminiStreamApiUrl = process.env.GEMINI_STREAM_API_URL || 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent';
    
    // Log configuration status
    if (!this.geminiApiKey) {
      console.error('❌ GEMINI_API_KEY not found in environment variables');
      console.error('   Please set GEMINI_API_KEY in your .env file or Render environment variables');
    } else {
      console.log('✅ GEMINI_API_KEY configured - Using Gemini 2.0 Flash as primary AI provider');
      console.log('   Streaming endpoint: streamGenerateContent');
    }
  }

  /**
   * Generate dynamic system prompt from custom_parameters
   * Format: You are {{persona_name}}, {{persona_age}} saal ki {{tone}} {{gender}} from {{city}}.
   * 
   * @param {Object} customParams - Custom parameters from start event
   * @returns {string} - Generated system prompt
   */
  generateSystemPrompt(customParams) {
    if (!customParams || Object.keys(customParams).length === 0) {
      // Fallback to MongoDB persona if no custom params
      return null; // Will load from MongoDB
    }

    const {
      persona_name,
      persona_age,
      tone,
      gender,
      city,
      language,
      documents,
      customer_name
    } = customParams;

    // Build dynamic system prompt
    let systemPrompt = '';

    // Persona introduction
    if (persona_name) {
      systemPrompt += `You are ${persona_name}`;
      if (persona_age) {
        systemPrompt += `, ${persona_age} years old`;
      }
      if (tone) {
        systemPrompt += `, a ${tone}`;
      }
      if (gender) {
        systemPrompt += ` ${gender}`;
      }
      if (city) {
        systemPrompt += ` from ${city}`;
      }
      systemPrompt += '.\n\n';
    }

    // Language instruction
    if (language) {
      const langInstruction = language.toLowerCase().includes('hindi') || language.toLowerCase().includes('hi')
        ? 'Baat karo Hinglish mein (mix of Hindi and English).'
        : `Speak in ${language}.`;
      systemPrompt += `${langInstruction}\n\n`;
    }

    // Documents/knowledgebase
    if (documents) {
      systemPrompt += `Sirf in documents se jawab do:\n${documents}\n\n`;
    }

    // Customer name
    if (customer_name) {
      systemPrompt += `Customer ka naam: ${customer_name}\n\n`;
    }

    // Default behavior if no custom params
    if (!systemPrompt.trim()) {
      systemPrompt = 'You are a helpful assistant.';
    }

    return systemPrompt.trim();
  }

  /**
   * Ensure system message is present in conversation history
   * Uses custom_parameters if available, otherwise loads from MongoDB
   * 
   * @param {Object} session - VoiceSession object
   */
  async ensureSystemMessage(session) {
    let personaContent = null;

    // Try to generate from custom_parameters first
    if (session.customParameters && Object.keys(session.customParameters).length > 0) {
      personaContent = this.generateSystemPrompt(session.customParameters);
      console.log(`📋 [${session?.callId || 'AI'}] Generated system prompt from custom_parameters`);
    }

    // Fallback to MongoDB if no custom params or generation failed
    if (!personaContent) {
      personaContent = await loadPersonaFromMongo();
      console.log(`📋 [${session?.callId || 'AI'}] Using persona from MongoDB`);
    }

    if (!session.conversationHistory || session.conversationHistory.length === 0) {
      session.conversationHistory = [
        {
          role: 'system',
          content: personaContent
        }
      ];
      return;
    }

    // Check if system message exists, if not add it
    const hasSystemMessage = session.conversationHistory.some(
      msg => msg.role === 'system' && !msg.content.includes('Relevant context')
    );
    
    if (!hasSystemMessage) {
      session.conversationHistory.unshift({
        role: 'system',
        content: personaContent
      });
    } else {
      // Update existing system message with latest persona
      const systemMsgIndex = session.conversationHistory.findIndex(
        msg => msg.role === 'system' && !msg.content.includes('Relevant context')
      );
      if (systemMsgIndex >= 0) {
        session.conversationHistory[systemMsgIndex].content = personaContent;
      }
    }
  }

  /**
   * Generate agent reply based on conversation history
   * Alias: generateReply (for compatibility)
   * 
   * @param {Object} session - VoiceSession object with conversationHistory
   * @param {string} userText - User's transcribed text
   * @returns {Promise<string|null>} - Agent reply text or null on failure
   */
  async generateReply(session, userText) {
    return await this.generateAgentReply(session, userText);
  }

  /**
   * Generate agent reply with token-by-token streaming
   * Calls onToken callback for each token as it arrives
   * 
   * @param {Object} session - VoiceSession object with conversationHistory
   * @param {string} userText - User's transcribed text
   * @param {Function} onToken - Callback function(token: string, isComplete: boolean) called for each token
   * @returns {Promise<string|null>} - Complete agent reply text or null on failure
   */
  async generateAgentReplyStreaming(session, userText, onToken) {
    // Directly use Gemini - no OpenAI fallback
    return await this.generateWithGeminiStreaming(session, userText, onToken);
  }

  /**
   * Generate agent reply based on conversation history (non-streaming, for backward compatibility)
   * Uses Gemini API directly
   * 
   * @param {Object} session - VoiceSession object with conversationHistory
   * @param {string} userText - User's transcribed text
   * @returns {Promise<string|null>} - Agent reply text or null on failure
   */
  async generateAgentReply(session, userText) {
    // Use Gemini directly - no OpenAI
    return await this.generateWithGemini(session, userText);
  }

  /**
   * Generate reply using Gemini API (non-streaming version)
   * 
   * @param {Object} session - VoiceSession object with conversationHistory
   * @param {string} userText - User's transcribed text
   * @returns {Promise<string|null>} - Agent reply text or null on failure
   */
  async generateWithGemini(session, userText) {
    if (!this.geminiApiKey) {
      console.error('❌ GEMINI_API_KEY not configured');
      return null;
    }

    if (!userText || userText.trim().length === 0) {
      console.warn('⚠️  Empty user text provided to Gemini');
      return null;
    }

    try {
      // Ensure persona system message is present
      await this.ensureSystemMessage(session);

      // Find relevant knowledgebase chunks
      const contextChunks = await getRelevantChunks(userText, 3);
      const contextText = contextChunks.length > 0 
        ? contextChunks.join('\n\n') 
        : null;

      // Build prompt from conversation history
      const systemMsg = session.conversationHistory.find(msg => msg.role === 'system' && !msg.content.includes('Relevant context'));
      const systemPrompt = systemMsg ? systemMsg.content : 'You are a helpful assistant.';
      
      // Build conversation context
      const recentMessages = session.conversationHistory
        .filter(msg => msg.role !== 'system' || msg.content.includes('Relevant context'))
        .slice(-10); // Last 10 messages
      
      let fullPrompt = systemPrompt + '\n\n';
      if (contextText) {
        fullPrompt += 'Relevant context:\n' + contextText + '\n\n';
      }
      
      // Add conversation history
      for (const msg of recentMessages) {
        if (msg.role === 'user') {
          fullPrompt += `User: ${msg.content}\n`;
        } else if (msg.role === 'assistant') {
          fullPrompt += `Assistant: ${msg.content}\n`;
        }
      }
      fullPrompt += `User: ${userText.trim()}\nAssistant:`;

      console.log(`📡 [${session?.callId || 'AI'}] Using Gemini API (primary provider - optimized for speed)...`);

      // Call Gemini API with optimized timeout (10 seconds instead of 30)
      const axios = (await import('axios')).default;
      const startTime = Date.now();
      const response = await axios.post(
        `${this.geminiApiUrl}?key=${this.geminiApiKey}`,
        {
          contents: [{
            parts: [{
              text: fullPrompt
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 150, // Keep responses short for voice
            topP: 1,
            topK: 40
          }
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000 // Reduced from 30s to 10s for faster failure detection
        }
      );

      const apiLatency = Date.now() - startTime;
      const replyText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;

      if (replyText) {
        console.log(`✅ [${session?.callId || 'AI'}] Gemini response received: ${replyText.length} characters (API latency: ${apiLatency}ms)`);
        
        // Post-process reply
        const processedReply = this.postProcessReply(replyText);

        // Add assistant reply to conversation history
        session.conversationHistory.push({
          role: 'assistant',
          content: processedReply
        });

        return processedReply;
      }

      return null;
    } catch (error) {
      let errorMessage = error.message || 'Unknown error';
      if (error.response?.data) {
        const errorData = error.response.data;
        if (Buffer.isBuffer(errorData)) {
          try {
            const parsed = JSON.parse(errorData.toString());
            errorMessage = parsed.err_msg || parsed.message || errorData.toString();
          } catch {
            errorMessage = errorData.toString();
          }
        } else if (typeof errorData === 'object') {
          errorMessage = errorData.err_msg || errorData.message || JSON.stringify(errorData);
        } else {
          errorMessage = String(errorData);
        }
      }
      console.error('❌ Gemini API error:', errorMessage);
      if (error.code === 'ECONNABORTED') {
        console.error('   ⚠️  Request timeout - Gemini API took too long to respond');
      }
      return null;
    }
  }

  /**
   * Generate reply using Gemini API with real streaming (Server-Sent Events)
   * 
   * @param {Object} session - VoiceSession object with conversationHistory
   * @param {string} userText - User's transcribed text
   * @param {Function} onToken - Callback function(token: string, isComplete: boolean) called for each token
   * @returns {Promise<string|null>} - Agent reply text or null on failure
   */
  async generateWithGeminiStreaming(session, userText, onToken) {
    if (!this.geminiApiKey) {
      console.error('❌ GEMINI_API_KEY not configured');
      return null;
    }

    if (!userText || userText.trim().length === 0) {
      console.warn('⚠️  Empty user text provided to Gemini');
      return null;
    }

    try {
      // Ensure persona system message is present
      await this.ensureSystemMessage(session);

      // Find relevant knowledgebase chunks
      const contextChunks = await getRelevantChunks(userText, 3);
      const contextText = contextChunks.length > 0 
        ? contextChunks.join('\n\n') 
        : null;

      // Build prompt from conversation history
      const systemMsg = session.conversationHistory.find(msg => msg.role === 'system' && !msg.content.includes('Relevant context'));
      const systemPrompt = systemMsg ? systemMsg.content : 'You are a helpful assistant.';
      
      // Build conversation context
      const recentMessages = session.conversationHistory
        .filter(msg => msg.role !== 'system' || msg.content.includes('Relevant context'))
        .slice(-10); // Last 10 messages
      
      let fullPrompt = systemPrompt + '\n\n';
      if (contextText) {
        fullPrompt += 'Relevant context:\n' + contextText + '\n\n';
      }
      
      // Add conversation history
      for (const msg of recentMessages) {
        if (msg.role === 'user') {
          fullPrompt += `User: ${msg.content}\n`;
        } else if (msg.role === 'assistant') {
          fullPrompt += `Assistant: ${msg.content}\n`;
        }
      }
      fullPrompt += `User: ${userText.trim()}\nAssistant:`;

      console.log(`📡 [${session?.callId || 'AI'}] Using Gemini 2.0 Flash streaming API...`);

      const startTime = Date.now();
      let fullReply = '';
      let tokenCount = 0;

      // Use native fetch for Server-Sent Events (SSE) streaming
      const response = await fetch(
        `${this.geminiStreamApiUrl}?key=${this.geminiApiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: fullPrompt
              }]
            }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 150, // Keep responses short for voice
              topP: 1,
              topK: 40
            }
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.text();
        let errorMessage = `HTTP ${response.status}: ${errorData}`;
        try {
          const parsed = JSON.parse(errorData);
          errorMessage = parsed.error?.message || parsed.message || errorMessage;
        } catch {
          // Keep original error message
        }
        throw new Error(errorMessage);
      }

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
                    continue; // Don't break, continue processing remaining chunks
                  }

                  // Extract incremental text (delta) from content parts
                  const parts = candidate.content?.parts;
                  if (parts && Array.isArray(parts)) {
                    for (const part of parts) {
                      const deltaText = part.text;
                      if (deltaText) {
                        fullReply += deltaText;
                        tokenCount++;

                        // Call onToken callback for each token/chunk as it arrives (real-time streaming)
                        if (onToken) {
                          onToken(deltaText, false);
                        }
                      }
                    }
                  }
                }
              } catch (parseError) {
                // Skip malformed JSON lines (can happen in SSE streams)
                // This is normal in SSE format, just log at debug level
                if (parseError.message.includes('JSON')) {
                  // Silent skip for JSON parse errors in SSE
                } else {
                  console.warn(`⚠️  [${session?.callId || 'AI'}] SSE parse warning:`, parseError.message);
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
                if (onToken) {
                  onToken(deltaText, false);
                }
              }
            } catch (e) {
              // Ignore parse errors in final buffer
            }
          }
        }

        // Signal completion if not already done
        if (onToken && fullReply) {
          onToken('', true);
        }

        const apiLatency = Date.now() - startTime;
        const replyText = fullReply.trim();

        if (replyText) {
          console.log(`✅ [${session?.callId || 'AI'}] Gemini streaming complete: ${replyText.length} chars, ${tokenCount} tokens (latency: ${apiLatency}ms)`);
          
          // Post-process reply
          const processedReply = this.postProcessReply(replyText);

          // Add assistant reply to conversation history
          session.conversationHistory.push({
            role: 'assistant',
            content: processedReply
          });

          return processedReply;
        }

        return null;
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      let errorMessage = error.message || 'Unknown error';
      console.error('❌ Gemini streaming API error:', errorMessage);
      
      // Signal completion even on error (if callback was provided)
      if (onToken) {
        onToken('', true);
      }
      
      return null;
    }
  }


  /**
   * Post-process AI reply to make it more suitable for voice
   * - Truncate if too long
   * - Remove markdown formatting
   * - Ensure it ends with proper punctuation
   * 
   * @param {string} reply - Raw AI reply
   * @returns {string} - Processed reply
   */
  postProcessReply(reply) {
    if (!reply) return reply;

    // Remove markdown formatting
    let processed = reply
      .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
      .replace(/\*(.*?)\*/g, '$1') // Italic
      .replace(/`(.*?)`/g, '$1') // Code
      .replace(/#{1,6}\s/g, '') // Headers
      .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Links
      .trim();

    // Limit length (approximately 300 characters for voice)
    if (processed.length > 300) {
      // Try to cut at sentence boundary
      const sentences = processed.match(/[^.!?]+[.!?]+/g);
      if (sentences && sentences.length > 0) {
        let truncated = '';
        for (const sentence of sentences) {
          if ((truncated + sentence).length <= 300) {
            truncated += sentence;
          } else {
            break;
          }
        }
        processed = truncated || processed.substring(0, 300);
      } else {
        processed = processed.substring(0, 300);
      }
    }

    // Ensure it ends with punctuation
    if (processed && !/[.!?]$/.test(processed)) {
      processed += '.';
    }

    return processed.trim();
  }
}

export const aiService = new AIService();

