const { Pool } = require('pg');

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    plain_password TEXT,
    role TEXT DEFAULT 'viewer',
    status TEXT NOT NULL DEFAULT 'pending',
    approved_by INTEGER,
    approved_at TIMESTAMP,
    reset_code TEXT,
    reset_code_expires TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS boards (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS board_members (
    id SERIAL PRIMARY KEY,
    board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'viewer',
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(board_id, user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS lists (
    id SERIAL PRIMARY KEY,
    board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    position INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS cards (
    id SERIAL PRIMARY KEY,
    list_id INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    position INTEGER DEFAULT 0,
    created_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS labels (
    id SERIAL PRIMARY KEY,
    card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#808080',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS card_members (
    id SERIAL PRIMARY KEY,
    card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(card_id, user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS card_dates (
    id SERIAL PRIMARY KEY,
    card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    start_date DATE,
    due_date DATE,
    due_time TEXT,
    reminder_enabled INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS checklists (
    id SERIAL PRIMARY KEY,
    card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    items_total INTEGER DEFAULT 0,
    items_completed INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS checklist_items (
    id SERIAL PRIMARY KEY,
    checklist_id INTEGER NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    completed INTEGER DEFAULT 0,
    position INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS attachments (
    id SERIAL PRIMARY KEY,
    card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    uploaded_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    attachment_type TEXT NOT NULL DEFAULT 'file',
    url TEXT,
    is_cover INTEGER NOT NULL DEFAULT 0,
    share_token TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS app_assets (
    key TEXT PRIMARY KEY,
    file_name TEXT NOT NULL,
    content_type TEXT NOT NULL,
    data BYTEA NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS card_comments (
    id SERIAL PRIMARY KEY,
    card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    content TEXT,
    text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS card_activity (
    id SERIAL PRIMARY KEY,
    card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS password_resets (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
];

function normalizeArgs(params, callback) {
  if (typeof params === 'function') {
    return { params: [], callback: params };
  }
  if (!Array.isArray(params)) {
    return { params: params === undefined ? [] : [params], callback };
  }
  return { params, callback };
}

function convertPlaceholders(sql) {
  let index = 0;
  let inSingleQuote = false;
  let escaped = false;
  return sql.replace(/./g, (char) => {
    if (char === "'" && !escaped) {
      inSingleQuote = !inSingleQuote;
    }
    escaped = char === '\\' && !escaped;
    if (char === '?' && !inSingleQuote) {
      index += 1;
      return `$${index}`;
    }
    if (char !== '\\') {
      escaped = false;
    }
    return char;
  });
}

function convertSql(sql, { returning = false } = {}) {
  let converted = sql.trim();

  converted = converted.replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, 'INSERT INTO');
  converted = converted.replace(/DATETIME\s*\(\s*'now'\s*,\s*'\+15 minutes'\s*\)/gi, "CURRENT_TIMESTAMP + INTERVAL '15 minutes'");
  converted = converted.replace(/\bAUTOINCREMENT\b/gi, '');
  converted = converted.replace(/\bDATETIME\b/gi, 'TIMESTAMP');
  converted = convertPlaceholders(converted);

  const isInsert = /^INSERT\s+INTO\s+/i.test(converted);
  const hasConflictClause = /\bON\s+CONFLICT\b/i.test(converted);
  if (isInsert && /INSERT\s+OR\s+IGNORE/i.test(sql) && !hasConflictClause) {
    converted += ' ON CONFLICT DO NOTHING';
  }

  if (returning && isInsert && !/\bRETURNING\b/i.test(converted) && !/^INSERT\s+INTO\s+app_assets\b/i.test(converted)) {
    converted += ' RETURNING id';
  }

  return converted;
}

class PostgresAdapter {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false },
    });
    this.ready = this.initialize();
  }

  async initialize() {
    for (const statement of schemaStatements) {
      await this.pool.query(statement);
    }
    console.log('Connected to PostgreSQL database');
  }

  async tableInfo(tableName) {
    const result = await this.pool.query(
      `SELECT column_name AS name
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
       ORDER BY ordinal_position`,
      [tableName]
    );
    return result.rows;
  }

  run(sql, params, callback) {
    const args = normalizeArgs(params, callback);
    this.ready
      .then(async () => {
        if (/^PRAGMA\b/i.test(sql.trim())) {
          return { rows: [], rowCount: 0 };
        }
        const result = await this.pool.query(convertSql(sql, { returning: true }), args.params);
        const context = {
          lastID: result.rows?.[0]?.id,
          changes: result.rowCount,
        };
        if (args.callback) {
          args.callback.call(context, null);
        }
      })
      .catch((err) => {
        if (args.callback) return args.callback(err);
        console.error('PostgreSQL run error:', err.message);
      });
  }

  get(sql, params, callback) {
    const args = normalizeArgs(params, callback);
    this.ready
      .then(async () => {
        const result = await this.pool.query(convertSql(sql), args.params);
        if (args.callback) args.callback(null, result.rows[0]);
      })
      .catch((err) => {
        if (args.callback) return args.callback(err);
        console.error('PostgreSQL get error:', err.message);
      });
  }

  all(sql, params, callback) {
    const args = normalizeArgs(params, callback);
    this.ready
      .then(async () => {
        const pragmaMatch = sql.trim().match(/^PRAGMA\s+table_info\(([^)]+)\)/i);
        if (pragmaMatch) {
          const tableName = pragmaMatch[1].replace(/['"`]/g, '').trim();
          const rows = await this.tableInfo(tableName);
          if (args.callback) args.callback(null, rows);
          return;
        }

        const result = await this.pool.query(convertSql(sql), args.params);
        if (args.callback) args.callback(null, result.rows);
      })
      .catch((err) => {
        if (args.callback) return args.callback(err);
        console.error('PostgreSQL all error:', err.message);
      });
  }

  serialize(fn) {
    fn();
  }
}

module.exports = PostgresAdapter;
module.exports.schemaStatements = schemaStatements;
