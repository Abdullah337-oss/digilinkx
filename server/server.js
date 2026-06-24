const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const { startDiscoveryServer, stopDiscoveryServer } = require('./discovery');

const db = require('./db/database');
const userRoutes = require('./routes/userRoutes');
const boardRoutes = require('./routes/boardRoutes');
const listRoutes = require('./routes/listRoutes');
const cardRoutes = require('./routes/cardRoutes');
const cardDetailsRoutes = require('./routes/cardDetailsRoutes');
const { viewSharedAttachment } = require('./controllers/cardDetailsController');

const app = express();

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadsPath = process.env.UPLOADS_PATH || path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadsPath));

app.use('/api/users', userRoutes(db));
app.use('/api/boards', boardRoutes(db));
app.use('/api/lists', listRoutes(db));
app.use('/api/cards', cardRoutes(db));
app.use('/api/card-details', cardDetailsRoutes(db));
app.get('/share/attachments/:shareToken', viewSharedAttachment(db));

app.get('/api/health', (_req, res) => {
  res.json({
    app: 'Digilinkx Todo',
    status: 'ok',
    port: serverPort || Number(PORT),
  });
});

app.get('/api/assets/:key', (req, res) => {
  const { key } = req.params;
  db.get(
    'SELECT file_name, content_type, data FROM app_assets WHERE key = ?',
    [key],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (!row) {
        return res.status(404).json({ error: 'Asset not found' });
      }
      res.setHeader('Content-Type', row.content_type);
      res.setHeader('Content-Disposition', `inline; filename="${row.file_name}"`);
      res.setHeader('Cache-Control', 'no-cache');
      res.send(row.data);
    }
  );
});

if (process.env.NODE_ENV !== 'production') {
  app.get('/debug/attachments', (req, res) => {
    db.all('SELECT * FROM attachments', [], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ total_attachments: rows.length, attachments: rows });
    });
  });

  app.get('/debug/card/:cardId', (req, res) => {
    db.get('SELECT * FROM cards WHERE id = ?', [req.params.cardId], (err, card) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!card) return res.status(404).json({ error: 'Card not found' });
      db.all('SELECT * FROM attachments WHERE card_id = ?', [req.params.cardId], (err2, attachments) => {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json({ card, attachments });
      });
    });
  });
}

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });
}

let serverInstance = null;
let serverPort = null;

function startServer(port) {
  const server = app.listen(port, () => {
    serverInstance = server;
    serverPort = server.address().port;
    console.log(`Server running on http://localhost:${serverPort}`);
    if (serverPort !== PORT) {
      console.log(`(Port ${PORT} was in use, fell back to ${serverPort})`);
    }
    startDiscoveryServer(serverPort);
    if (serverReadyResolve) serverReadyResolve(serverPort);
  });
  server.on('error', (err) => {
    console.error('Failed to start server on port', port, ':', err.message);
    if (err.code === 'EADDRINUSE' && process.env.ALLOW_PORT_FALLBACK === 'true' && Number(port) !== 0) {
      console.log(`Port ${port} is in use. Starting standalone server on an available port instead.`);
      startServer(0);
      return;
    }
    if (serverReadyReject) serverReadyReject(err);
  });
}

let serverReadyResolve = null;
let serverReadyReject = null;
const serverReady = new Promise((resolve, reject) => {
  serverReadyResolve = resolve;
  serverReadyReject = reject;
});

startServer(PORT);

module.exports = { app, get serverPort() { return serverPort; }, serverReady };
