const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const os = require('os');
const bcrypt = require('bcryptjs');

const isElectronProduction = process.env.NODE_ENV === 'production' && !!process.versions.electron;
const appDataDirectory = process.env.APPDATA || process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
const defaultAppDataDbPath = path.join(appDataDirectory, 'Digilinkx Todo', 'todo.db');

// Priority: SHARED_DB_PATH (multi-exe network share) > DB_PATH (single-exe local) > production user app data > default local
const dbPath = process.env.SHARED_DB_PATH
  || process.env.DB_PATH
  || (isElectronProduction ? defaultAppDataDbPath : path.join(__dirname, 'todo.db'));

const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Create/connect to database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database at:', dbPath);
    // Enable WAL mode for better concurrent access when multiple exes share the DB
    db.run('PRAGMA journal_mode=WAL', (walErr) => {
      if (walErr) {
        console.error('Failed to set WAL mode:', walErr.message);
      }
    });
    db.run('PRAGMA busy_timeout=5000', (busyErr) => {
      if (busyErr) {
        console.error('Failed to set busy timeout:', busyErr.message);
      }
    });
    db.run('PRAGMA foreign_keys = ON', (pragmaErr) => {
      if (pragmaErr) {
        console.error('Failed to enable SQLite foreign keys:', pragmaErr.message);
      }
      initializeDatabase();
    });
  }
});

function initializeDatabase() {
  // Users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      plain_password TEXT,
      role TEXT DEFAULT 'viewer',
      status TEXT NOT NULL DEFAULT 'pending',
      approved_by INTEGER,
      approved_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.all(`PRAGMA table_info(users)`, (tableErr, columns) => {
    if (tableErr) {
      console.error('Failed to inspect users table:', tableErr.message);
      return;
    }

    const columnNames = new Set((columns || []).map((col) => col.name));

    if (!columnNames.has('status')) {
      db.run(`ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'`, (alterErr) => {
        if (alterErr) {
          console.error('Failed to add status column to users table:', alterErr.message);
          return;
        }

        db.run(`UPDATE users SET status = 'approved' WHERE status IS NULL OR status = ''`);
      });
    }

    if (!columnNames.has('approved_by')) {
      db.run(`ALTER TABLE users ADD COLUMN approved_by INTEGER`);
    }

    if (!columnNames.has('approved_at')) {
      db.run(`ALTER TABLE users ADD COLUMN approved_at DATETIME`);
    }

    if (!columnNames.has('reset_code')) {
      db.run(`ALTER TABLE users ADD COLUMN reset_code TEXT`);
    }

    if (!columnNames.has('reset_code_expires')) {
      db.run(`ALTER TABLE users ADD COLUMN reset_code_expires DATETIME`);
    }

    if (!columnNames.has('plain_password')) {
      db.run(`ALTER TABLE users ADD COLUMN plain_password TEXT`, (alterErr) => {
        if (!alterErr) {
          db.run(`UPDATE users SET plain_password = password WHERE plain_password IS NULL`);
        }
      });
    }

    db.run(
      `UPDATE users
       SET status = 'approved', approved_at = COALESCE(approved_at, CURRENT_TIMESTAMP)
       WHERE role = 'admin' AND status != 'approved'`
    );

    seedDefaultUsers();
  });

  // Boards table
  db.run(`
    CREATE TABLE IF NOT EXISTS boards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      owner_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_id) REFERENCES users(id)
    )
  `);

  db.all(`PRAGMA table_info(boards)`, (tableErr, columns) => {
    if (tableErr) {
      console.error('Failed to inspect boards table:', tableErr.message);
      return;
    }

    const columnNames = new Set((columns || []).map((col) => col.name));

    if (!columnNames.has('updated_at')) {
      db.run(`ALTER TABLE boards ADD COLUMN updated_at DATETIME`, (alterErr) => {
        if (alterErr) {
          console.error('Failed to add updated_at column to boards table:', alterErr.message);
        }
      });
    }

    if (!columnNames.has('position')) {
      db.run(`ALTER TABLE boards ADD COLUMN position INTEGER DEFAULT 0`, (alterErr) => {
        if (alterErr) {
          console.error('Failed to add position column to boards table:', alterErr.message);
        }
      });
    }
  });

  // Board members (for sharing boards with other users)
  db.run(`
    CREATE TABLE IF NOT EXISTS board_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      board_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      role TEXT DEFAULT 'viewer',
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (board_id) REFERENCES boards(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(board_id, user_id)
    )
  `);

  // Lists/Columns (Assigned, Working, Done, etc.)
  db.run(`
    CREATE TABLE IF NOT EXISTS lists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      board_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      position INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (board_id) REFERENCES boards(id)
    )
  `);

  // Cards
  db.run(`
    CREATE TABLE IF NOT EXISTS cards (
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
  `);

  // Labels for cards
  db.run(`
    CREATE TABLE IF NOT EXISTS labels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#808080',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (card_id) REFERENCES cards(id)
    )
  `);

  // Card members/assignments
  db.run(`
    CREATE TABLE IF NOT EXISTS card_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (card_id) REFERENCES cards(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(card_id, user_id)
    )
  `);

  // Due dates
  db.run(`
    CREATE TABLE IF NOT EXISTS card_dates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id INTEGER NOT NULL,
      start_date DATE,
      due_date DATE,
      due_time TEXT,
      reminder_enabled BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (card_id) REFERENCES cards(id)
    )
  `);

  db.all(`PRAGMA table_info(card_dates)`, (tableErr, columns) => {
    if (tableErr) {
      console.error('Failed to inspect card_dates table:', tableErr.message);
      return;
    }

    const columnNames = new Set((columns || []).map((col) => col.name));

    if (!columnNames.has('due_time')) {
      db.run(`ALTER TABLE card_dates ADD COLUMN due_time TEXT`, (alterErr) => {
        if (alterErr) {
          console.error('Failed to add due_time column to card_dates table:', alterErr.message);
        }
      });
    }
  });

  // Checklists
  db.run(`
    CREATE TABLE IF NOT EXISTS checklists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      items_total INTEGER DEFAULT 0,
      items_completed INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (card_id) REFERENCES cards(id)
    )
  `);

  // Checklist items
  db.run(`
    CREATE TABLE IF NOT EXISTS checklist_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      checklist_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      completed BOOLEAN DEFAULT 0,
      position INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (checklist_id) REFERENCES checklists(id)
    )
  `);

  // Attachments
  db.run(`
    CREATE TABLE IF NOT EXISTS attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id INTEGER NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER,
      uploaded_by_id INTEGER NOT NULL,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (card_id) REFERENCES cards(id),
      FOREIGN KEY (uploaded_by_id) REFERENCES users(id)
    )
  `);

  // Small built-in assets that should travel with the database/package.
  db.run(`
    CREATE TABLE IF NOT EXISTS app_assets (
      key TEXT PRIMARY KEY,
      file_name TEXT NOT NULL,
      content_type TEXT NOT NULL,
      data BLOB NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('Failed to create app_assets table:', err.message);
      return;
    }

    seedLogoAsset();
  });

  db.all(`PRAGMA table_info(attachments)`, (tableErr, columns) => {
    if (tableErr) {
      console.error('Failed to inspect attachments table:', tableErr.message);
      return;
    }

    const columnNames = new Set((columns || []).map((col) => col.name));

    if (!columnNames.has('attachment_type')) {
      db.run(`ALTER TABLE attachments ADD COLUMN attachment_type TEXT NOT NULL DEFAULT 'file'`, (alterErr) => {
        if (alterErr) {
          console.error('Failed to add attachment_type column to attachments table:', alterErr.message);
        }
      });
    }

    if (!columnNames.has('url')) {
      db.run(`ALTER TABLE attachments ADD COLUMN url TEXT`, (alterErr) => {
        if (alterErr) {
          console.error('Failed to add url column to attachments table:', alterErr.message);
        }
      });
    }

    if (!columnNames.has('is_cover')) {
      db.run(`ALTER TABLE attachments ADD COLUMN is_cover INTEGER NOT NULL DEFAULT 0`, (alterErr) => {
        if (alterErr) {
          console.error('Failed to add is_cover column to attachments table:', alterErr.message);
        }
      });
    }

    if (!columnNames.has('share_token')) {
      db.run(`ALTER TABLE attachments ADD COLUMN share_token TEXT`, (alterErr) => {
        if (alterErr) {
          console.error('Failed to add share_token column to attachments table:', alterErr.message);
        }
      });
    }
  });

  // Card comments
  db.run(`
    CREATE TABLE IF NOT EXISTS card_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Card activity log
  db.run(`
    CREATE TABLE IF NOT EXISTS card_activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id INTEGER NOT NULL,
      user_id INTEGER,
      action_type TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  console.log('Database tables initialized');
}

function seedDefaultUsers() {
  const defaultUsers = [
    { username: 'admin', email: 'admin@TodoApp.com', password: 'admin123', role: 'admin' },
    { username: 'user1', email: 'user1@TodoApp.com', password: 'user123', role: 'viewer' },
    { username: 'user2', email: 'user2@TodoApp.com', password: 'user123', role: 'viewer' },
    { username: 'user3', email: 'user3@TodoApp.com', password: 'user123', role: 'viewer' },
    { username: 'user4', email: 'user4@TodoApp.com', password: 'user123', role: 'viewer' },
  ];

  defaultUsers.forEach((user) => {
    const hashedPassword = bcrypt.hashSync(user.password, 10);
    db.run(
      `INSERT OR IGNORE INTO users (username, email, password, role, status, approved_at, plain_password)
       VALUES (?, ?, ?, ?, 'approved', CURRENT_TIMESTAMP, ?)`,
      [user.username, user.email, hashedPassword, user.role, user.password],
      (err) => {
        if (err) {
          console.error(`Failed to seed user ${user.username}:`, err.message);
        }
      }
    );
  });
}

function seedLogoAsset() {
  const logoFile = path.join(__dirname, '..', '..', 'tmp-logo.png');
  const dashboardLogoFile = path.join(__dirname, '..', '..', 'Digilinkx-Logo_Dashboard.png');

  const readAndSeed = (filePath, key, fileName) => {
    if (!fs.existsSync(filePath)) {
      console.warn(`Asset ${key} was not seeded because ${filePath} was not found.`);
      return;
    }

    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        console.error(`Failed to read ${key} asset:`, readErr.message);
        return;
      }

      db.run(
        `INSERT INTO app_assets (key, file_name, content_type, data, updated_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET
           file_name = excluded.file_name,
           content_type = excluded.content_type,
           data = excluded.data,
           updated_at = CURRENT_TIMESTAMP`,
        [key, fileName, 'image/png', data],
        (insertErr) => {
          if (insertErr) {
            console.error(`Failed to seed asset ${key}:`, insertErr.message);
          }
        }
      );
    });
  };

  readAndSeed(logoFile, 'logo', 'tmp-logo.png');
  readAndSeed(dashboardLogoFile, 'dashboard_logo', 'Digilinkx-Logo_Dashboard.png');
}

module.exports = db;
