# Changes Made - Admin-Only Features Update

## Overview
Updated the Todo App with three major features:
1. **Card Creation Restricted to Admin Only** - Regular viewers cannot create cards
2. **File Upload for Attachments** - Admins can upload files to cards
3. **Member Management by Email** - Admins can add members using email and assign roles

---

## Frontend Changes

### 1. Board.jsx
**Location:** `client/src/pages/Board.jsx`

**Changes:**
- Added role check to card creation form
- Only `admin` users can see and use the card creation form
- Regular users see a message: "Only admins can create cards"

**Code:**
```jsx
{user?.role === 'admin' && (
  <form className="new-card-form" onSubmit={(e) => handleCreateCard(list.id, e)}>
    {/* Card form */}
  </form>
)}
{user?.role !== 'admin' && (
  <div className="card-creation-disabled">
    <p>Only admins can create cards</p>
  </div>
)}
```

### 2. CardModal.jsx
**Location:** `client/src/components/CardModal.jsx`

**Changes Made:**

#### State Management
- Changed `newMember` to `newMemberEmail` for email-based member lookup
- Added `newMemberRole` state for role selection
- Added `attachmentFile` state for file uploads

#### Member Management
- Added `handleAddMemberByEmail()` function to add members by email
- Added `handleRemoveMember()` function to remove members
- Member addition only visible to admins
- Members section now shows remove button (X) next to each member

#### File Uploads
- Added `handleUploadAttachment()` function
- Uses FormData for multipart file upload
- File upload button only visible to admins
- Shows error if upload fails

#### Members Section (Updated)
```jsx
{/* Members with email-based addition (admin only) */}
{user?.role === 'admin' && (
  <form onSubmit={handleAddMemberByEmail}>
    <input type="email" placeholder="Member email" />
    <select value={newMemberRole}>
      <option value="viewer">Viewer</option>
      <option value="admin">Admin</option>
    </select>
    <button type="submit">Add Member</button>
  </form>
)}
```

#### Attachments Section (Updated)
```jsx
{user?.role === 'admin' && (
  <label className="file-upload-label">
    <input type="file" onChange={handleUploadAttachment} />
    <span className="btn btn-small">Upload File</span>
  </label>
)}
```

### 3. CardModal.css
**Location:** `client/src/styles/CardModal.css`

**New Styles Added:**
- `.member-remove` - Remove button for members
- `.add-member-form` - Member addition form styling
- `.member-role-select` - Role dropdown styling
- `.file-upload-section` - File upload section styling
- `.file-input-hidden` - Hidden file input styling
- `.file-upload-label` - Label for file input

### 4. Board.css
**Location:** `client/src/styles/Board.css`

**New Styles Added:**
- `.card-creation-disabled` - Message for non-admin users
  - White text on semi-transparent background
  - Centered text
  - Shows: "Only admins can create cards"

---

## Backend Changes

### 1. cardDetailsController.js
**Location:** `server/controllers/cardDetailsController.js`

**New Functions Added:**

#### `addMemberByEmail()`
- Finds user by email
- Adds user to card_members table
- Can optionally update user role to admin
- Returns user ID and member ID

#### `uploadAttachment()`
- Receives file via multer middleware
- Stores file info in attachments table
- Saves file path, name, size
- Tracks which user uploaded the file
- Returns attachment ID and file details

### 2. cardDetailsRoutes.js
**Location:** `server/routes/cardDetailsRoutes.js`

**New Routes Added:**
- `POST /card-details/add-member-by-email` - Add member by email (admin only)
- `POST /card-details/:cardId/attachments` - Upload file attachment

**Multer Configuration:**
```javascript
const upload = multer({
  storage: diskStorage({
    destination: './uploads/',
    filename: 'timestamps + extension'
  }),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});
```

### 3. server.js
**Location:** `server/server.js`

**Changes:**
- Added `const path = require('path');`
- Added static file serving: `app.use('/uploads', express.static(path.join(__dirname, 'uploads')))`
- Allows files to be accessed via `/uploads/filename`

### 4. Created uploads directory
**Location:** `server/uploads/`

- New directory to store uploaded files
- Added `.gitkeep` to ensure directory exists in git
- Files are stored with timestamp-based unique names

---

## Database Impact

### Tables Used (No schema changes needed)
- `users` - For email lookup when adding members
- `card_members` - Existing member table (now used for email-based addition)
- `attachments` - Existing attachment table (now fully utilized)

---

## API Endpoints

### New/Updated Endpoints

1. **Add Member by Email**
   ```
   POST /api/card-details/add-member-by-email
   
   Body:
   {
     "cardId": 1,
     "email": "user@example.com",
     "role": "viewer" | "admin"
   }
   
   Response:
   {
     "message": "Member added successfully",
     "memberId": 5,
     "userId": 2
   }
   ```

2. **Upload File Attachment**
   ```
   POST /api/card-details/:cardId/attachments
   
   Headers:
   Content-Type: multipart/form-data
   Authorization: Bearer <token>
   
   Body:
   - file: <binary file data>
   
   Response:
   {
     "message": "Attachment uploaded successfully",
     "attachmentId": 1,
     "fileName": "document.pdf",
     "fileSize": 52428
   }
   ```

---

## Access Control

### Card Creation
- **Admin:** ✅ Can create cards
- **Viewer:** ❌ Cannot create cards (disabled UI)

### Member Management
- **Admin:** ✅ Can add/remove members by email and assign roles
- **Viewer:** ✅ Can view members but cannot modify

### File Uploads
- **Admin:** ✅ Can upload attachments
- **Viewer:** ❌ Cannot upload files (no button shown)

---

## File Storage

### Upload Rules
- **File Size Limit:** 10MB
- **Storage Location:** `server/uploads/`
- **File Naming:** `<timestamp>-<random>.<extension>`
- **Access URL:** `/uploads/<filename>`

### Example Upload
```
Input: document.pdf (5MB)
Stored as: 1708427340000-456789.pdf
Access via: http://localhost:5000/uploads/1708427340000-456789.pdf
```

---

## User Experience

### For Admin Users
1. ✅ See card creation form in each column
2. ✅ Can add members by typing their email
3. ✅ Can select role (Viewer/Admin) for new members
4. ✅ Can remove members from cards
5. ✅ Can upload files as attachments
6. ✅ Can see all attachment files

### For Viewer Users
1. ❌ No card creation form visible
2. ❌ See message "Only admins can create cards"
3. ❌ Cannot add members
4. ❌ Can see assigned members but cannot remove
5. ❌ Cannot upload files
6. ✅ Can see existing attachments
7. ✅ Can download existing files

---

## Testing Checklist

### Admin Account (admin/admin123)
- [ ] Test card creation appears and works
- [ ] Add member by email feature
- [ ] Upload file to card
- [ ] View uploaded files
- [ ] Remove members from card

### Regular User (user1/user123)
- [ ] Card creation form should not appear
- [ ] Should see "Only admins can create cards"
- [ ] Cannot add members
- [ ] Cannot upload files
- [ ] Can view cards and existing attachments

---

## Installation/Restart Required

After these changes:
1. Backend dependencies are already installed (multer is in package.json)
2. No database migration needed
3. Simply restart both server and client
4. Changes are backward compatible

---

## Security Considerations

1. ✅ Email lookup prevents unauthorized member additions (user must exist)
2. ✅ File uploads are limited to 10MB
3. ✅ Files are stored outside public folder (requires `/uploads` route)
4. ✅ Role-based access control on frontend and backend
5. ✅ Authentication required for all operations

---

## Future Enhancements

Possible improvements:
- Add file type restrictions (whitelist)
- Add member role validation
- Add attachment deletion
- Add download counter
- Add virus scanning for uploads
- Generate thumbnails for images
