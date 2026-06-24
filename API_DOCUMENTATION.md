# API Documentation - Todo App

Base URL: `http://localhost:5000/api`

## Authentication

All API endpoints (except login/register) require a JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

---

## User Endpoints

### Register New User
**POST** `/users/register`

Request:
```json
{
  "username": "newuser",
  "email": "newuser@example.com",
  "password": "password123"
}
```

Response:
```json
{
  "message": "User created successfully",
  "userId": 1,
  "token": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

---

### Login User
**POST** `/users/login`

Request:
```json
{
  "username": "admin",
  "password": "admin123"
}
```

Response:
```json
{
  "message": "Login successful",
  "userId": 1,
  "username": "admin",
  "email": "admin@example.com",
  "role": "admin",
  "token": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

---

### Get All Users
**GET** `/users/all`

Headers: (requires auth token)
```
Authorization: Bearer <token>
```

Response:
```json
[
  {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "role": "admin"
  },
  {
    "id": 2,
    "username": "user1",
    "email": "user1@example.com",
    "role": "viewer"
  }
]
```

---

### Get User by ID
**GET** `/users/:userId`

Headers: (requires auth token)
```
Authorization: Bearer <token>
```

Response:
```json
{
  "id": 1,
  "username": "admin",
  "email": "admin@example.com",
  "role": "admin"
}
```

---

## Board Endpoints

### Create Board
**POST** `/boards`

Headers:
```
Authorization: Bearer <token>
Content-Type: application/json
```

Request:
```json
{
  "title": "My New Board"
}
```

Response:
```json
{
  "message": "Board created successfully",
  "boardId": 1
}
```

Note: Default lists are automatically created: Assigned, Working, Done, On Hold, Revision, Finished

---

### Get User's Boards
**GET** `/boards`

Headers:
```
Authorization: Bearer <token>
```

Response:
```json
[
  {
    "id": 1,
    "title": "My Board",
    "owner_id": 1,
    "created_at": "2024-02-20 10:30:00"
  }
]
```

---

### Get Board Details
**GET** `/boards/:boardId`

Headers:
```
Authorization: Bearer <token>
```

Response:
```json
{
  "id": 1,
  "title": "My Board",
  "owner_id": 1,
  "created_at": "2024-02-20 10:30:00",
  "lists": [
    {
      "id": 1,
      "board_id": 1,
      "title": "Assigned",
      "position": 0,
      "cards": [
        {
          "id": 1,
          "list_id": 1,
          "title": "Design homepage",
          "description": "Create mockup for homepage",
          "position": 0,
          "created_by_id": 1,
          "created_at": "2024-02-20 10:30:00"
        }
      ]
    }
  ]
}
```

---

### Delete Board
**DELETE** `/boards/:boardId`

Headers:
```
Authorization: Bearer <token>
```

Response:
```json
{
  "message": "Board deleted successfully"
}
```

Note: Only board owner can delete. All related data (lists, cards) is deleted automatically.

---

## Card Endpoints

### Create Card
**POST** `/cards`

Headers:
```
Authorization: Bearer <token>
Content-Type: application/json
```

Request:
```json
{
  "listId": 1,
  "title": "Task title",
  "description": "Optional description"
}
```

Response:
```json
{
  "message": "Card created successfully",
  "cardId": 1
}
```

---

### Get Card Details
**GET** `/cards/:cardId`

Headers:
```
Authorization: Bearer <token>
```

Response:
```json
{
  "id": 1,
  "list_id": 1,
  "title": "Task title",
  "description": "Description",
  "position": 0,
  "created_by_id": 1,
  "created_at": "2024-02-20 10:30:00",
  "labels": [
    {
      "id": 1,
      "card_id": 1,
      "name": "Bug",
      "color": "#ff0000"
    }
  ],
  "members": [
    {
      "id": 1,
      "username": "user1",
      "email": "user1@example.com"
    }
  ],
  "dates": {
    "id": 1,
    "card_id": 1,
    "start_date": null,
    "due_date": "2024-02-25",
    "reminder_enabled": 1
  },
  "checklists": [
    {
      "id": 1,
      "card_id": 1,
      "title": "Requirements",
      "items_total": 3,
      "items_completed": 2
    }
  ],
  "attachments": []
}
```

---

### Update Card
**PUT** `/cards/:cardId`

Headers:
```
Authorization: Bearer <token>
Content-Type: application/json
```

Request:
```json
{
  "title": "Updated title",
  "description": "Updated description"
}
```

Response:
```json
{
  "message": "Card updated successfully"
}
```

---

### Delete Card
**DELETE** `/cards/:cardId`

Headers:
```
Authorization: Bearer <token>
```

Response:
```json
{
  "message": "Card deleted successfully"
}
```

Note: Only card creator or admin can delete.

---

### Move Card
**PUT** `/cards/:cardId/move`

Headers:
```
Authorization: Bearer <token>
Content-Type: application/json
```

Request:
```json
{
  "listId": 2,
  "position": 0
}
```

Response:
```json
{
  "message": "Card moved successfully"
}
```

---

## Card Details Endpoints

### Add Label
**POST** `/card-details/:cardId/labels`

Headers:
```
Authorization: Bearer <token>
Content-Type: application/json
```

Request:
```json
{
  "name": "Bug",
  "color": "#ff0000"
}
```

Response:
```json
{
  "message": "Label added successfully",
  "labelId": 1
}
```

---

### Delete Label
**DELETE** `/card-details/labels/:labelId`

Headers:
```
Authorization: Bearer <token>
```

Response:
```json
{
  "message": "Label deleted successfully"
}
```

---

### Add Member to Card
**POST** `/card-details/:cardId/members`

Headers:
```
Authorization: Bearer <token>
Content-Type: application/json
```

Request:
```json
{
  "userId": 2
}
```

Response:
```json
{
  "message": "Member added successfully",
  "memberId": 1
}
```

---

### Remove Member from Card
**DELETE** `/card-details/:cardId/members/:userId`

Headers:
```
Authorization: Bearer <token>
```

Response:
```json
{
  "message": "Member removed successfully"
}
```

---

### Set Due Date
**POST** `/card-details/:cardId/dates`

Headers:
```
Authorization: Bearer <token>
Content-Type: application/json
```

Request:
```json
{
  "startDate": null,
  "dueDate": "2024-02-25",
  "reminderEnabled": 1
}
```

Response:
```json
{
  "message": "Dates updated successfully"
}
```

---

### Create Checklist
**POST** `/card-details/:cardId/checklists`

Headers:
```
Authorization: Bearer <token>
Content-Type: application/json
```

Request:
```json
{
  "title": "Requirements"
}
```

Response:
```json
{
  "message": "Checklist created successfully",
  "checklistId": 1
}
```

---

### Add Checklist Item
**POST** `/card-details/checklists/:checklistId/items`

Headers:
```
Authorization: Bearer <token>
Content-Type: application/json
```

Request:
```json
{
  "text": "Design mockup"
}
```

Response:
```json
{
  "message": "Checklist item added successfully",
  "itemId": 1
}
```

---

### Toggle Checklist Item
**PATCH** `/card-details/items/:itemId/toggle`

Headers:
```
Authorization: Bearer <token>
```

Response:
```json
{
  "message": "Item toggled successfully",
  "completed": 1
}
```

---

### Delete Checklist
**DELETE** `/card-details/checklists/:checklistId`

Headers:
```
Authorization: Bearer <token>
```

Response:
```json
{
  "message": "Checklist deleted successfully"
}
```

---

## Health Check

### Server Status
**GET** `/health`

Response:
```json
{
  "status": "Server is running"
}
```

---

## Error Responses

### Unauthorized (401)
```json
{
  "error": "Access token required"
}
```

### Forbidden (403)
```json
{
  "error": "Invalid or expired token"
}
```

### Not Found (404)
```json
{
  "error": "Resource not found"
}
```

### Bad Request (400)
```json
{
  "error": "Required field missing"
}
```

### Server Error (500)
```json
{
  "error": "Server error"
}
```

---

## Example Usage with cURL

### Login
```bash
curl -X POST http://localhost:5000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### Create Board (with token)
```bash
curl -X POST http://localhost:5000/api/boards \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"New Board"}'
```

### Get All Boards (with token)
```bash
curl -X GET http://localhost:5000/api/boards \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'viewer',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### Boards Table
```sql
CREATE TABLE boards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  owner_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id)
)
```

### Lists Table
```sql
CREATE TABLE lists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  board_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  position INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (board_id) REFERENCES boards(id)
)
```

### Cards Table
```sql
CREATE TABLE cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  list_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  position INTEGER DEFAULT 0,
  created_by_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (list_id) REFERENCES lists(id),
  FOREIGN KEY (created_by_id) REFERENCES users(id)
)
```

And more tables for labels, members, dates, checklists, checklist items, and attachments.

---

## Notes

- All timestamps are in ISO 8601 format
- Tokens expire based on server configuration (set in .env)
- Use `Content-Type: application/json` for POST/PUT requests
- All endpoints return JSON responses
- Role-based access control is enforced at the controller level
