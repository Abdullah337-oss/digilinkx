# Digilinks Todo App - Full Stack Trello-like Application

A complete todo/task management application similar to Trello, built with React, Node.js, Express, and SQLite.

## Features

✅ **5 Demo Accounts** 
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

