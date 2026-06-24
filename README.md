# Digilinks Todo App - Full Stack Trello-like Application

A complete todo/task management application similar to Trello, built with React, Node.js, Express, and SQLite.

## Features

✅ **5 Demo Accounts** (1 Admin, 4 Viewers)
✅ **Board Management** - Create, view, and delete boards
✅ **Card Management** - Create cards with full details
✅ **Card Features:**
  - Title & Description
  - Labels with custom colors
  - Due dates
  - Checklists with items
  - Member assignments
  - File attachments (ready for implementation)

✅ **Workflow Columns:**
  - Assigned
  - Working
  - Done
  - On Hold
  - Revision
  - Finished

✅ **Drag & Drop** - Move cards between columns
✅ **Role-Based Access:**
  - Admin: Full control (can delete anything)
  - Viewer: Can create and edit but limited delete permissions
✅ **Authentication** - JWT-based login/register
✅ **Admin Approval Workflow**
   - New registrations stay pending
   - Admin reviews pending requests
   - Admin approves/rejects and assigns role (viewer/admin)

## Project Structure

```
todo-app/
├── client/                 (React Frontend)
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Card.jsx
│   │   │   └── CardModal.jsx
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   └── Board.jsx
│   │   ├── styles/
│   │   ├── App.jsx
│   │   └── index.js
│   └── package.json
│
├── server/                 (Node.js Backend)
│   ├── db/
│   │   └── database.js
│   ├── middleware/
│   │   └── auth.js
│   ├── controllers/
│   │   ├── userController.js
│   │   ├── boardController.js
│   │   ├── cardController.js
│   │   └── cardDetailsController.js
│   ├── routes/
│   │   ├── userRoutes.js
│   │   ├── boardRoutes.js
│   │   ├── cardRoutes.js
│   │   └── cardDetailsRoutes.js
│   ├── server.js
│   ├── seed.js
│   └── package.json
```

## Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- npm

### Backend Setup

1. Navigate to server directory:
   ```bash
   cd server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Seed demo accounts:
   ```bash
   node seed.js
   ```

4. Start the server:
   ```bash
   npm start
   ```
   Server runs on `http://localhost:5000`

### Frontend Setup

1. Navigate to client directory:
   ```bash
   cd client
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```
   App runs on `http://localhost:3000`

## Demo Accounts

Login with these credentials:

| Username | Password | Role  |
|----------|----------|-------|
| admin    | admin123 | Admin |
| user1    | user123  | Viewer|
| user2    | user123  | Viewer|
| user3    | user123  | Viewer|
| user4    | user123  | Viewer|

## API Endpoints

### Authentication
- `POST /api/users/register` - Register new user (creates pending request)
- `POST /api/users/login` - Login user
- `GET /api/users/all` - Get all users (admin only)
- `GET /api/users/pending` - Get pending user requests (admin only)
- `PATCH /api/users/:userId/approve` - Approve user and assign role (admin only)
- `PATCH /api/users/:userId/reject` - Reject user request (admin only)
- `GET /api/users/:userId` - Get user by ID (admin only)

### Boards
- `POST /api/boards` - Create board (protected)
- `GET /api/boards` - Get user's boards (protected)
- `GET /api/boards/:boardId` - Get board details (protected)
- `DELETE /api/boards/:boardId` - Delete board (protected)

### Cards
- `POST /api/cards` - Create card (protected)
- `GET /api/cards/:cardId` - Get card details (protected)
- `PUT /api/cards/:cardId` - Update card (protected)
- `DELETE /api/cards/:cardId` - Delete card (protected)
- `PUT /api/cards/:cardId/move` - Move card to different list (protected)

### Card Details
- `POST /api/card-details/:cardId/labels` - Add label
- `DELETE /api/card-details/labels/:labelId` - Delete label
- `POST /api/card-details/:cardId/members` - Add member
- `DELETE /api/card-details/:cardId/members/:userId` - Remove member
- `POST /api/card-details/:cardId/dates` - Set due date
- `POST /api/card-details/:cardId/checklists` - Create checklist
- `POST /api/card-details/checklists/:checklistId/items` - Add checklist item
- `PATCH /api/card-details/items/:itemId/toggle` - Toggle checklist item

## Features Implemented

✅ User Authentication (5 accounts)
✅ Board Management (CRUD)
✅ Card CRUD Operations
✅ Drag & Drop Card Movement
✅ Labels with Colors
✅ Due Dates
✅ Checklists
✅ Member Assignment Ready
✅ Role-Based Access Control (Admin/Viewer)
✅ Responsive UI

## Future Enhancements

- 📎 File attachment upload
- 👥 Improved member management & sharing
- 🔔 Activity timeline & notifications
- 💬 Comments on cards
- 🏆 Task completion statistics
- 📱 Mobile app (React Native)
- 🖥️ Desktop app (Electron)

## Technology Stack

**Frontend:**
- React 18
- React Router
- Axios
- React Beautiful DND (Drag & Drop)
- CSS3

**Backend:**
- Express.js
- SQLite3
- JWT Authentication
- Bcryptjs

## Notes

- The application uses SQLite for local database storage
- Authentication uses JWT tokens
- Passwords are hashed with bcryptjs
- All API routes (except login/register) require authentication
- Admin users have full control over all data
- Viewer users can create content but have limited delete permissions

## Support

For issues or questions, please check the project structure and ensure all dependencies are installed correctly.
