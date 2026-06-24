# Quick Start Guide - Todo App

## 🚀 Quick Setup (Windows)

### Step 1: Install Node.js
If you don't have Node.js installed, download it from: **https://nodejs.org/**

### Step 2: Navigate to Project Directory
Open PowerShell or Command Prompt:
```powershell
cd "c:\Users\Lenovo\Desktop\todo-app 3"
```

### Step 3: Automated Installation (Recommended)
Double-click on **install.bat** in the project folder. This will:
- Install all server dependencies
- Install all client dependencies
- Seed the database with 5 demo accounts
- Display your login credentials

### Step 4: Start the Application
Double-click on **start.bat** to automatically open:
- Backend server on `http://localhost:5000`
- Frontend on `http://localhost:3000`

---

## 📝 Manual Installation (Advanced)

### Backend Setup

1. Open PowerShell/Command Prompt
2. Navigate to server folder:
   ```powershell
   cd "c:\Users\Lenovo\Desktop\todo-app 3\server"
   ```

3. Install dependencies:
   ```powershell
   npm install
   ```

4. Seed database with demo accounts:
   ```powershell
   node seed.js
   ```

5. Start server:
   ```powershell
   npm start
   ```
   You should see: `Server running on http://localhost:5000`

### Frontend Setup (New Terminal Window)

1. Open another PowerShell/Command Prompt
2. Navigate to client folder:
   ```powershell
   cd "c:\Users\Lenovo\Desktop\todo-app 3\client"
   ```

3. Install dependencies:
   ```powershell
   npm install
   ```

4. Start frontend:
   ```powershell
   npm start
   ```
   Browser will automatically open at `http://localhost:3000`

---

## 🔐 Demo Account Credentials

| Username | Password | Role  |
|----------|----------|-------|
| admin    | admin123 | Admin |
| user1    | user123  | Viewer|
| user2    | user123  | Viewer|
| user3    | user123  | Viewer|
| user4    | user123  | Viewer|

---

## 🎯 Features Overview

### 📌 Boards
- Create new boards
- Delete boards you own
- View all your boards on dashboard

### 🃏 Cards
- Create cards in any column
- Drag & drop cards between columns
- Edit card details:
  - **Title & Description** - Detailed information
  - **Labels** - Categorize with colored tags
  - **Due Dates** - Set important deadlines
  - **Checklists** - Break down tasks
  - **Members** - Assign to team members
  - **Attachments** - Upload files

### 📊 Workflow Columns
Default columns in each board:
1. **Assigned** - New tasks
2. **Working** - In-progress tasks
3. **Done** - Completed tasks
4. **On Hold** - Paused tasks
5. **Revision** - Tasks under review
6. **Finished** - Final completed tasks

### 👥 User Roles

**Admin Access:**
- ✅ Create & manage boards
- ✅ Create cards
- ✅ Delete any card
- ✅ Full control

**Viewer Access:**
- ✅ Create & manage own boards
- ✅ Create & edit cards
- ❌ Can only delete own cards
- ❌ Limited to own created items

---

## 🐛 Troubleshooting

### Port Already in Use
If you see "EADDRINUSE: address already in use :::5000":
```powershell
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

Then restart the server.

### Node Modules Not Found
Delete and reinstall:
```powershell
# For server
cd server
rm -r node_modules
npm install
npm start

# For client
cd client
rm -r node_modules
npm install
npm start
```

### Database Issues
Reset database:
```powershell
cd server
rm todo.db
node seed.js
npm start
```

### Can't Connect to Server
- Ensure server is running on port 5000
- Check firewall settings
- Restart both server and client

---

## 📁 Project Structure
```
todo-app 3/
├── server/               ← Backend (Express.js)
│   ├── db/              ← Database setup
│   ├── controllers/     ← API logic
│   ├── routes/          ← API endpoints
│   ├── middleware/      ← Auth & validation
│   ├── server.js        ← Main server file
│   └── seed.js          ← Demo data
├── client/              ← Frontend (React)
│   ├── src/
│   │   ├── components/  ← UI components
│   │   ├── pages/       ← Page components
│   │   └── styles/      ← CSS files
│   └── package.json
├── start.bat            ← Start both servers
├── install.bat          ← Installation script
└── README.md            ← Full documentation
```

---

## 🌐 Browser Access

After starting both servers:
- **Application:** http://localhost:3000
- **API Server:** http://localhost:5000
- **Health Check:** http://localhost:5000/health

---

## 📖 Next Steps

1. ✅ Run install.bat to set up everything
2. ✅ Run start.bat to launch the app
3. ✅ Login with demo credentials
4. ✅ Create a new board
5. ✅ Create cards and drag them between columns
6. ✅ Add labels, due dates, and checklists to cards

---

## 💡 Tips

- **Admin Account Recommended:** For testing all features, use the admin account
- **Drag & Drop:** Click and hold a card to drag it to another column
- **Card Modal:** Click a card to open detailed view and edit information
- **Labels:** Add custom colored labels for better organization
- **Due Dates:** Set deadlines to keep track of important dates

---

## 🆘 Need Help?

If something doesn't work:
1. Check that Node.js is installed: `node --version`
2. Make sure both server and client are running
3. Check browser console for errors (F12)
4. Restart both servers
5. Try reinstalling dependencies

---

## 🎉 You're All Set!

Your Todo App is ready to use. Start by creating your first board and exploring the features!

Happy Task Management! 📋✨
