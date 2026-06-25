const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const { schemaStatements } = require('../db/postgresAdapter');

const sqlitePath = process.env.SQLITE_DB_PATH || path.join(__dirname, '..', 'db', 'todo.db');
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}

const tables = [
  'users',
  'boards',
  'board_members',
  'lists',
  'cards',
  'labels',
  'card_members',
  'card_dates',
  'checklists',
  'checklist_items',
  'attachments',
  'app_assets',
  'card_comments',
  'card_activity',
  'password_resets',
];

const timestampColumns = new Set([
  'approved_at',
  'created_at',
  'updated_at',
  'added_at',
  'assigned_at',
  'uploaded_at',
  'expires_at',
  'reset_code_expires',
]);

const dateColumns = new Set([
  'start_date',
  'due_date',
]);

const requiredParentChecks = {
  board_members: [
    { column: 'board_id', table: 'boards' },
    { column: 'user_id', table: 'users' },
  ],
  lists: [{ column: 'board_id', table: 'boards' }],
  cards: [{ column: 'list_id', table: 'lists' }],
  labels: [{ column: 'card_id', table: 'cards' }],
  card_members: [
    { column: 'card_id', table: 'cards' },
    { column: 'user_id', table: 'users' },
  ],
  card_dates: [{ column: 'card_id', table: 'cards' }],
  checklists: [{ column: 'card_id', table: 'cards' }],
  checklist_items: [{ column: 'checklist_id', table: 'checklists' }],
  attachments: [{ column: 'card_id', table: 'cards' }],
  card_comments: [{ column: 'card_id', table: 'cards' }],
  card_activity: [{ column: 'card_id', table: 'cards' }],
};

const nullableParentChecks = {
  boards: [{ column: 'owner_id', table: 'users' }],
  cards: [{ column: 'created_by_id', table: 'users' }],
  attachments: [{ column: 'uploaded_by_id', table: 'users' }],
  card_comments: [{ column: 'user_id', table: 'users' }],
  card_activity: [{ column: 'user_id', table: 'users' }],
};

const sqlite = new sqlite3.Database(sqlitePath);
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false },
});

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

async function tableExists(table) {
  const rows = await all(sqlite, `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`, [table]);
  return rows.length > 0;
}

const sqliteIds = new Map();
const migratedIds = new Map();

async function getSqliteIds(table) {
  if (sqliteIds.has(table)) {
    return sqliteIds.get(table);
  }
  if (!(await tableExists(table))) {
    const empty = new Set();
    sqliteIds.set(table, empty);
    return empty;
  }
  const rows = await all(sqlite, `SELECT id FROM ${table}`);
  const ids = new Set(rows.map((row) => Number(row.id)));
  sqliteIds.set(table, ids);
  return ids;
}

function getMigratedIds(table) {
  if (!migratedIds.has(table)) {
    migratedIds.set(table, new Set());
  }
  return migratedIds.get(table);
}

async function insertRecoveredBoard(boardId) {
  await pool.query(
    `INSERT INTO boards (id, title, owner_id, created_at, updated_at)
     VALUES ($1, $2, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT (id) DO NOTHING`,
    [boardId, `Recovered Board ${boardId}`]
  );
  getMigratedIds('boards').add(Number(boardId));
}

async function insertRecoveredList(listId, boardId, title = null) {
  await insertRecoveredBoard(boardId);
  await pool.query(
    `INSERT INTO lists (id, board_id, title, position, created_at)
     VALUES ($1, $2, $3, 0, CURRENT_TIMESTAMP)
     ON CONFLICT (id) DO NOTHING`,
    [listId, boardId, title || `Recovered List ${listId}`]
  );
  getMigratedIds('lists').add(Number(listId));
}

async function insertRecoveredCard(cardId) {
  const recoveredBoardId = 900000 + Number(cardId);
  const recoveredListId = 900000 + Number(cardId);
  await insertRecoveredList(recoveredListId, recoveredBoardId, `Recovered Cards ${cardId}`);
  await pool.query(
    `INSERT INTO cards (id, list_id, title, description, position, created_by_id, created_at, updated_at)
     VALUES ($1, $2, $3, '', 0, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT (id) DO NOTHING`,
    [cardId, recoveredListId, `Recovered Card ${cardId}`]
  );
  getMigratedIds('cards').add(Number(cardId));
}

async function recoverRequiredParent(table, check, row) {
  const parentId = Number(row[check.column]);
  if (!Number.isFinite(parentId)) {
    return false;
  }

  if (table === 'lists' && check.table === 'boards') {
    await insertRecoveredBoard(parentId);
    console.warn(`Created Recovered Board ${parentId} for orphaned lists.`);
    return true;
  }

  if (check.table === 'cards') {
    await insertRecoveredCard(parentId);
    console.warn(`Created Recovered Card ${parentId} for orphaned ${table}.`);
    return true;
  }

  return false;
}

function normalizeDateValue(value, column) {
  if (value === null || value === undefined || value === '') {
    return value;
  }

  const numeric = typeof value === 'number'
    ? value
    : (typeof value === 'string' && /^\d{11,}$/.test(value.trim()) ? Number(value) : null);

  if (numeric !== null && Number.isFinite(numeric)) {
    const date = new Date(numeric);
    if (!Number.isNaN(date.getTime())) {
      return dateColumns.has(column)
        ? date.toISOString().slice(0, 10)
        : date.toISOString();
    }
  }

  return value;
}

function normalizeRowValue(row, column) {
  const value = row[column];
  if (timestampColumns.has(column) || dateColumns.has(column)) {
    return normalizeDateValue(value, column);
  }
  return value;
}

async function prepareRowForCopy(table, row) {
  const prepared = { ...row };

  for (const check of nullableParentChecks[table] || []) {
    if (prepared[check.column] === null || prepared[check.column] === undefined || prepared[check.column] === '') {
      continue;
    }
    const parentIds = getMigratedIds(check.table);
    if (!parentIds.has(Number(prepared[check.column]))) {
      prepared[check.column] = null;
    }
  }

  for (const check of requiredParentChecks[table] || []) {
    const parentIds = getMigratedIds(check.table);
    if (!parentIds.has(Number(prepared[check.column]))) {
      const recovered = await recoverRequiredParent(table, check, prepared);
      if (recovered) {
        continue;
      }
      return {
        skip: true,
        reason: `${check.column}=${prepared[check.column]} has no matching ${check.table}.id`,
      };
    }
  }

  return { skip: false, row: prepared };
}

async function copyTable(table) {
  if (!(await tableExists(table))) {
    console.log(`Skipping missing SQLite table: ${table}`);
    return;
  }

  const rows = await all(sqlite, `SELECT * FROM ${table}`);
  if (!rows.length) {
    console.log(`No rows in ${table}`);
    return;
  }

  const columns = Object.keys(rows[0]);
  const quotedColumns = columns.map((column) => `"${column}"`).join(', ');
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
  const updateColumns = columns.filter((column) => column !== 'id' && column !== 'key');
  const conflictTarget = table === 'app_assets' ? 'key' : 'id';
  const updateClause = updateColumns.length
    ? `DO UPDATE SET ${updateColumns.map((column) => `"${column}" = EXCLUDED."${column}"`).join(', ')}`
    : 'DO NOTHING';

  const sql = `INSERT INTO ${table} (${quotedColumns})
    VALUES (${placeholders})
    ON CONFLICT (${conflictTarget}) ${updateClause}`;

  let copied = 0;
  let skipped = 0;
  for (const row of rows) {
    const prepared = await prepareRowForCopy(table, row);
    if (prepared.skip) {
      skipped += 1;
      console.warn(`Skipping ${table} row ${row.id || ''}: ${prepared.reason}`);
      continue;
    }
    await pool.query(sql, columns.map((column) => normalizeRowValue(prepared.row, column)));
    if (prepared.row.id !== undefined && prepared.row.id !== null) {
      getMigratedIds(table).add(Number(prepared.row.id));
    }
    copied += 1;
  }

  if (columns.includes('id')) {
    await pool.query(
      `SELECT setval(pg_get_serial_sequence($1, 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1), true)`,
      [table]
    );
  }

  console.log(`Copied ${copied} rows into ${table}${skipped ? `; skipped ${skipped} orphaned rows` : ''}`);
}

async function resetSequences() {
  for (const table of tables) {
    if (table === 'app_assets') {
      continue;
    }
    await pool.query(
      `SELECT setval(pg_get_serial_sequence($1, 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1), true)`,
      [table]
    ).catch(() => {});
  }
}

async function ensurePostgresSchema() {
  for (const statement of schemaStatements) {
    await pool.query(statement);
  }
  console.log('PostgreSQL schema is ready.');
}

async function main() {
  console.log(`Migrating SQLite database: ${sqlitePath}`);
  await ensurePostgresSchema();
  for (const table of tables) {
    await copyTable(table);
  }
  await resetSequences();
  console.log('Migration complete.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    sqlite.close();
    await pool.end();
  });
