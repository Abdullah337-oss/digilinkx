# File Attachment Debugging Guide

## Issue
Users cannot see files uploaded by admins to cards.

## Root Cause Analysis

The system should work as follows:
1. Admin uploads file → File saved to `/server/uploads/` directory
2. File metadata stored in `attachments` table in database
3. User opens card → Frontend fetches card with attachments
4. Attachments displayed for all users (download available to all)

## Testing Steps

### Step 1: Check Browser Console Logs
1. Open DevTools (F12) in the browser
2. Go to **Console** tab
3. **Admin user:**
   - Open a card
   - Look for logs: `"Card details fetched:"` and `"Attachments:"` 
   - Check if attachments array shows any items
   - Upload a file to the card
   - Look for `"Card refreshed, attachments:"` after upload
   - Verify the attachments array is populated

4. **Viewer user (in separate browser/incognito):**
   - Open the SAME card where admin uploaded file
   - Look for `"Card details fetched:"` and `"Attachments:"`
   - Check if attachments array shows items (even if uploaded by admin)

### Step 2: Check Server Logs
1. Look at your **server terminal console**
2. When a file is uploaded, you should see:
   ```
   Upload attachment - cardId: X file: FILENAME
   Storing attachment - fileName: ORIGINALNAME storedFileName: TIMESTAMP-RANDOM.ext fileSize: SIZE
   Attachment stored with ID: X
   ```

3. When fetching card:
   ```
   Fetched attachments for card X : [    {      id: X,      card_id: Y,      file_name: "...",      file_path: "...",      ...    }  ]
   Card details complete: {...}
   ```

### Step 3: Check Files in Upload Directory
1. Navigate to: `server/uploads/`
2. You should see files like: `1771652474785-297734955.pdf`
3. Files should match timestamps from server logs

### Step 4: Check Database (if you have SQLite browser)
1. Open the database file: `server/db/todo.db`
2. Query the `attachments` table
3. Verify records are being inserted with correct `card_id`, `file_name`, and `file_path`

## Debug Endpoint
You can also check all attachments in the database:
```
GET http://localhost:5000/debug/attachments
```

This will show all attachments stored in the database regardless of which card they're on.

## Common Issues & Solutions

### Issue: "No attachments yet" shows even after upload
**Possible causes:**
1. File uploaded but not saved to database
   - Check server logs for errors
   - Check database INSERT logs

2. File saved but card_id doesn't match
   - Check server logs: ensure card_id being uploaded matches card_id in query
   - Check database: verify attachments exist with correct card_id

3. Response not including attachments
   - Check server logs for "Fetched attachments" log
   - If missing, database query might be failing silently

### Issue: File link works but download fails
**Possible causes:**
1. File not actually saved to disk
   - Check `/server/uploads/` directory
   - Look at file creation timestamps

2. File path stored incorrectly in database
   - Should store just filename: `1771652474785-297734955.pdf`
   - NOT full path: `server/uploads/1771652474785-297734955.pdf`
   - Check debug endpoint to see what's stored

3. Static file serving not configured
   - Verify `server.js` has: `app.use('/uploads', express.static(...))`

## Code Flow After File Upload

```
Admin clicks "Upload File"
    ↓
handleUploadAttachment() called
    ↓
POST /api/card-details/:cardId/attachments (with file)
    ↓
Server: multer saves file to /uploads/
Server: uploadAttachment() inserts into database
    ↓
Response: {message: "success", attachmentId: X}
    ↓
refreshCardData() called
    ↓
GET /api/cards/:cardId
    ↓
Server: getCardById() queries attachments
    ↓
Response includes: {attachments: [{id: X, file_name: "...", file_path: "..."}]}
    ↓
setCardData(response) - updates state with attachments
    ↓
CardModal rerenders
    ↓
Attachments section displays files
```

## Next Steps if Issue Persists

1. Share the console logs from both admin and viewer
2. Share the server logs when file is uploaded and fetched
3. Check the actual database to see if records exist
4. Verify the files actually exist in `/server/uploads/`

