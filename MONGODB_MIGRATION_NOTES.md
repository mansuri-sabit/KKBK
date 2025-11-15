# MongoDB Migration Notes

## Overview
This project has been upgraded to use MongoDB for storing persona text and knowledgebase documents instead of local files.

## Changes Made

### 1. New Dependencies
- `mongoose` - MongoDB ODM
- `multer` - File upload handling
- `pdf-parse` - PDF text extraction
- `docx` - Already installed (mammoth) for DOCX parsing

### 2. New Files Created

#### Configuration
- `config/db.js` - MongoDB connection management

#### Models
- `models/Persona.js` - Persona schema (name, content, updatedAt)
- `models/Document.js` - Document schema (filename, mimetype, content, chunks, uploadedAt)

#### Services
- `utils/personaService.js` - Replaces `personaLoader.js`, loads persona from MongoDB
- `utils/knowledgebaseMongo.js` - Replaces `knowledgebase.js`, loads documents from MongoDB with RAG chunking

#### Utilities
- `utils/fileParser.js` - Extracts text from txt, md, docx, pdf files

#### Routes
- `routes/personaRoutes.js` - Persona API endpoints
- `routes/documentRoutes.js` - Document API endpoints

### 3. Updated Files

#### `utils/aiService.js`
- Replaced `loadSystemPrompt()` from `personaLoader.js` with `loadPersonaFromMongo()` from `personaService.js`
- Replaced `findRelevantSections()` from `knowledgebase.js` with `getRelevantChunks()` from `knowledgebaseMongo.js`
- `ensureSystemMessage()` is now async and loads persona from MongoDB

#### `server.js`
- Added MongoDB connection on startup
- Added persona and document API routes

### 4. Deprecated Files (Still Present for Fallback)
- `utils/personaLoader.js` - Kept for fallback if MongoDB fails
- `utils/knowledgebase.js` - Kept for reference, not used anymore
- `parvati_persona.txt` - Used as fallback when creating initial persona in MongoDB
- `whatsapp_knowledgebase.txt` - Can be uploaded via API

## Environment Variables

Add to your `.env` file:

```env
MONGODB_URI=mongodb://localhost:27017/voicebot
# Or for MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/voicebot
```

## Initial Setup

### 1. Start MongoDB
Ensure MongoDB is running locally or have MongoDB Atlas connection string ready.

### 2. Start the Server
```bash
npm start
```

The server will:
- Connect to MongoDB on startup
- Create default persona from `parvati_persona.txt` if it doesn't exist

### 3. Upload Initial Persona (Optional)
```bash
curl -X POST http://localhost:3000/persona/upload \
  -H "Content-Type: application/json" \
  -d '{"content": "Your persona text here..."}'
```

### 4. Upload Knowledgebase Documents
```bash
# Upload a text file
curl -X POST http://localhost:3000/documents/upload \
  -F "file=@whatsapp_knowledgebase.txt"

# Upload a DOCX file
curl -X POST http://localhost:3000/documents/upload \
  -F "file=@WhatsApp_Knowledgebase.docx"

# Upload a PDF file
curl -X POST http://localhost:3000/documents/upload \
  -F "file=@knowledgebase.pdf"
```

## API Endpoints

### Persona Endpoints

#### POST /persona/upload
Upload or update persona text.

**Request:**
```json
{
  "content": "Your persona text here...",
  "name": "default" // optional, defaults to "default"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Persona \"default\" updated successfully",
  "persona": {
    "id": "...",
    "name": "default",
    "contentLength": 1234,
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### GET /persona
Get current persona.

**Query Params:**
- `name` (optional) - Persona name, defaults to "default"

**Response:**
```json
{
  "success": true,
  "persona": {
    "id": "...",
    "name": "default",
    "content": "Full persona text...",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### Document Endpoints

#### POST /documents/upload
Upload a document file (txt, md, docx, pdf).

**Request:**
- `multipart/form-data` with `file` field
- Max file size: 10MB

**Response:**
```json
{
  "success": true,
  "message": "Document \"filename.txt\" uploaded successfully",
  "document": {
    "id": "...",
    "filename": "filename.txt",
    "mimetype": "text/plain",
    "contentLength": 1234,
    "chunksCount": 5,
    "uploadedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### GET /documents
List all documents.

**Response:**
```json
{
  "success": true,
  "count": 2,
  "documents": [
    {
      "id": "...",
      "filename": "doc1.txt",
      "mimetype": "text/plain",
      "uploadedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

#### GET /documents/:id
Get document by ID (includes full parsed text).

**Response:**
```json
{
  "success": true,
  "document": {
    "id": "...",
    "filename": "doc1.txt",
    "mimetype": "text/plain",
    "content": "Full document text...",
    "chunksCount": 5,
    "uploadedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### DELETE /documents/:id
Delete document by ID.

**Response:**
```json
{
  "success": true,
  "message": "Document \"filename.txt\" deleted successfully"
}
```

## How It Works

### Persona Loading
1. On first AI request, `aiService.js` calls `loadPersonaFromMongo()`
2. Service checks MongoDB for persona with name "default"
3. If not found, creates one using fallback from `parvati_persona.txt`
4. Persona is cached in memory for 5 minutes
5. Cache is cleared when persona is updated via API

### Knowledgebase Loading
1. On each AI request, `aiService.js` calls `getRelevantChunks(userText)`
2. Service loads all documents from MongoDB
3. Combines all chunks from all documents
4. Scores chunks by keyword relevance to user query
5. Returns top 3 most relevant chunks
6. Chunks are cached in memory for 10 minutes
7. Cache is cleared when documents are uploaded/deleted

### Document Processing
1. File uploaded via API
2. Text extracted based on file type:
   - `.txt`, `.md` → Direct text extraction
   - `.docx` → Using `mammoth` library
   - `.pdf` → Using `pdf-parse` library
3. Text is chunked into ~1000 character pieces with 200 char overlap
4. Document saved to MongoDB with:
   - Original filename
   - MIME type
   - Full extracted text
   - Array of text chunks

## Migration from Local Files

### Option 1: Automatic (Recommended)
1. Start server with MongoDB connected
2. Server will auto-create default persona from `parvati_persona.txt` on first use
3. Upload knowledgebase files via API

### Option 2: Manual Migration Script
Create a script to migrate existing files:

```javascript
import { updatePersona } from './utils/personaService.js';
import { readFileSync } from 'fs';
import Document from './models/Document.js';
import { extractTextFromFile } from './utils/fileParser.js';
import { chunkText } from './utils/knowledgebaseMongo.js';
import { connectDB } from './config/db.js';

async function migrate() {
  await connectDB();
  
  // Migrate persona
  const personaText = readFileSync('parvati_persona.txt', 'utf8');
  await updatePersona(personaText);
  
  // Migrate knowledgebase
  const kbBuffer = readFileSync('whatsapp_knowledgebase.txt');
  const text = await extractTextFromFile(kbBuffer, 'text/plain', 'whatsapp_knowledgebase.txt');
  const chunks = chunkText(text);
  
  const doc = new Document({
    filename: 'whatsapp_knowledgebase.txt',
    mimetype: 'text/plain',
    content: text,
    chunks: chunks
  });
  await doc.save();
  
  console.log('Migration complete!');
}
```

## Troubleshooting

### MongoDB Connection Failed
- Check `MONGODB_URI` in `.env`
- Ensure MongoDB is running (if local)
- Check network/firewall (if remote)
- Server will continue but persona/knowledgebase features won't work

### Persona Not Loading
- Check MongoDB connection
- Verify persona exists: `GET /persona`
- Check server logs for errors
- Fallback to local file will be used if MongoDB fails

### Documents Not Found
- Verify documents exist: `GET /documents`
- Check if chunks were created (should see `chunksCount > 0`)
- Re-upload document if chunks are missing

### File Upload Fails
- Check file size (max 10MB)
- Verify file type is supported (txt, md, docx, pdf)
- Check server logs for parsing errors

## Future Enhancements

1. **Embeddings Support**: Replace keyword matching with vector embeddings for better relevance
2. **Multiple Personas**: Support multiple named personas for different use cases
3. **Document Versioning**: Track document versions and updates
4. **Admin UI**: Web interface for managing persona and documents
5. **Search API**: Dedicated search endpoint for knowledgebase
6. **Chunk Metadata**: Store additional metadata with chunks (source document, position, etc.)

