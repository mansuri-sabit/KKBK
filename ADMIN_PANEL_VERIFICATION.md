# Admin Panel Verification Guide

## ✅ Live URL Access

Your admin panel is accessible at:
- **Admin Panel**: https://kkbk-xjhf.onrender.com/admin
- **API Health Check**: https://kkbk-xjhf.onrender.com/health

## 🧪 Testing Checklist

### 1. Access Admin Panel
Open in browser: `https://kkbk-xjhf.onrender.com/admin`

**Expected Result:**
- Page loads with "VoiceBot Admin Panel" heading
- Persona editor textarea visible
- Document upload form visible
- No console errors

### 2. Test Persona Loading
**What to check:**
- On page load, persona should auto-load from MongoDB
- If persona exists, it appears in textarea
- If no persona, shows "No persona found. Create one above."

**If Error:**
- Check browser console (F12) for errors
- Verify MongoDB connection in server logs
- Check `/persona` API endpoint: `https://kkbk-xjhf.onrender.com/persona`

### 3. Test Persona Save
**Steps:**
1. Edit text in persona textarea
2. Click "Save Persona" button
3. Wait for success toast notification

**Expected Result:**
- Green toast: "Persona saved successfully!"
- Status shows "Last updated: [timestamp]"

**If Error:**
- Check browser console
- Verify POST `/persona/upload` endpoint
- Check MongoDB connection

### 4. Test Document Upload
**Steps:**
1. Click file input area
2. Select a .txt, .md, .docx, or .pdf file
3. Click "Upload Document" button
4. Wait for success message

**Expected Result:**
- Green toast: "Document '[filename]' uploaded successfully!"
- Document appears in list below
- File is parsed and chunked

**If Error:**
- Check file size (max 10MB)
- Verify file type is supported
- Check browser console for errors
- Verify POST `/documents/upload` endpoint

### 5. Test Document List
**What to check:**
- Documents list loads automatically
- Shows filename, upload date, file type
- "View Text" and "Delete" buttons visible

**If Empty:**
- Upload a test document first
- Check MongoDB documents collection

### 6. Test View Document
**Steps:**
1. Click "View Text" on any document
2. Modal opens with document content

**Expected Result:**
- Modal shows full extracted text
- Can scroll through content
- Close button works

### 7. Test Delete Document
**Steps:**
1. Click "Delete" on any document
2. Confirm deletion
3. Document disappears from list

**Expected Result:**
- Green toast: "Document '[filename]' deleted successfully"
- Document removed from list
- Removed from MongoDB

## 🔧 Troubleshooting

### Admin Panel Not Loading
1. **Check URL**: Ensure you're using `/admin` not `/admin.html`
2. **Check Static Files**: Verify `public/admin.html` exists in deployment
3. **Check Server Logs**: Look for errors in Render logs
4. **Check Build**: Ensure `public` folder is included in deployment

### API Calls Failing
1. **Check CORS**: CORS headers are enabled in server.js
2. **Check Routes**: Verify routes are registered:
   - `/persona` (GET)
   - `/persona/upload` (POST)
   - `/documents` (GET)
   - `/documents/upload` (POST)
   - `/documents/:id` (GET, DELETE)

3. **Check MongoDB**: 
   - Verify `MONGODB_URI` environment variable is set in Render
   - Check MongoDB connection in server logs
   - Test connection: `https://kkbk-xjhf.onrender.com/health`

### File Upload Not Working
1. **Check File Size**: Max 10MB
2. **Check File Type**: Only .txt, .md, .docx, .pdf
3. **Check Multer**: Verify multer middleware is working
4. **Check File Parser**: Verify file parsing utilities are working
5. **Check MongoDB**: Ensure documents are being saved

### MongoDB Connection Issues
1. **Check Environment Variable**: `MONGODB_URI` in Render dashboard
2. **Check Connection String**: Format: `mongodb+srv://user:pass@cluster.mongodb.net/dbname`
3. **Check Network**: MongoDB Atlas allows Render IP (or 0.0.0.0/0)
4. **Check Logs**: Server logs show MongoDB connection status

## 📝 API Endpoints Reference

### Persona Endpoints
- `GET /persona` - Get current persona
- `POST /persona/upload` - Upload/update persona
  ```json
  {
    "content": "Your persona text here..."
  }
  ```

### Document Endpoints
- `GET /documents` - List all documents
- `POST /documents/upload` - Upload document (multipart/form-data)
  - Field name: `file`
  - Max size: 10MB
  - Types: .txt, .md, .docx, .pdf
- `GET /documents/:id` - Get document by ID
- `DELETE /documents/:id` - Delete document

## 🚀 Quick Test Commands

### Test Persona API
```bash
# Get persona
curl https://kkbk-xjhf.onrender.com/persona

# Upload persona
curl -X POST https://kkbk-xjhf.onrender.com/persona/upload \
  -H "Content-Type: application/json" \
  -d '{"content": "Test persona"}'
```

### Test Document API
```bash
# List documents
curl https://kkbk-xjhf.onrender.com/documents

# Upload document
curl -X POST https://kkbk-xjhf.onrender.com/documents/upload \
  -F "file=@test.txt"
```

## ✅ Verification Steps for Live Deployment

1. ✅ **Static Files Served**: `app.use(express.static(join(__dirname, 'public')))`
2. ✅ **Admin Route**: `app.get('/admin', ...)` serves admin.html
3. ✅ **CORS Enabled**: CORS headers added for cross-origin requests
4. ✅ **API Routes**: All routes registered (`/persona`, `/documents`)
5. ✅ **MongoDB Connection**: Connects on server startup
6. ✅ **Error Handling**: Try-catch blocks in all async functions
7. ✅ **File Upload**: Multer configured with 10MB limit
8. ✅ **File Parsing**: Supports txt, md, docx, pdf

## 🎯 Expected Behavior

When you visit `https://kkbk-xjhf.onrender.com/admin`:

1. **Page loads** with admin interface
2. **Persona loads** automatically from MongoDB (if exists)
3. **Documents list** loads automatically
4. **You can edit** persona and save
5. **You can upload** documents (txt, docx, pdf)
6. **You can view** document content in modal
7. **You can delete** documents

All operations work **dynamically** without page refresh!

## 📞 Support

If issues persist:
1. Check Render deployment logs
2. Check browser console (F12)
3. Test API endpoints directly with curl/Postman
4. Verify MongoDB connection string
5. Check file permissions and paths

