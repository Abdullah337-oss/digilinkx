const bcrypt = require('bcryptjs');

const createBoard = (db) => (req, res) => {
  const { title } = req.body;
  if (!title) return res.status(400).json({ error: 'Board title is required' });
  db.run('INSERT INTO boards (title, owner_id) VALUES (?, ?)', [title, req.user.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    const boardId = this.lastID;
    const defaultLists = ['Assigned', 'Working', 'Done', 'On Hold', 'Revision', 'Finished'];
    let completed = 0;
    const respond = () => {
      completed++;
      if (completed === defaultLists.length) {
        db.all('SELECT * FROM lists WHERE board_id = ? ORDER BY position ASC', [boardId], (err, lists) => {
          if (err) return res.status(500).json({ error: err.message });
          const board = { id: boardId, title, owner_id: req.user.id, lists };
          res.status(201).json({ message: 'Board created', board });
        });
      }
    };
    defaultLists.forEach((listTitle, index) => {
      db.run('INSERT INTO lists (board_id, title, position) VALUES (?, ?, ?)', [boardId, listTitle, index], respond);
    });
  });
};

const getUserBoards = (db) => (req, res) => {
  const userId = req.user.id;
  db.all(
    `SELECT DISTINCT b.* FROM boards b
     LEFT JOIN board_members bm ON bm.board_id = b.id
     LEFT JOIN users u ON u.id = b.owner_id
     WHERE b.owner_id = ? OR bm.user_id = ? OR u.role = 'admin'
     ORDER BY b.created_at DESC`,
    [userId, userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
};

const getBoardById = (db) => (req, res) => {
  const boardId = req.params.boardId;
  let sent = false;
  const send = (status, data) => { if (!sent) { sent = true; if (status) res.status(status).json(data); else res.json(data); } };

  db.get('SELECT * FROM boards WHERE id = ?', [boardId], (err, board) => {
    if (err) return send(500, { error: err.message });
    if (!board) return send(404, { error: 'Board not found' });

    db.all('SELECT * FROM lists WHERE board_id = ? ORDER BY position ASC, created_at ASC', [boardId], (err, lists) => {
      if (err) return send(500, { error: err.message });
      board.lists = lists;

      let completed = 0;
      if (lists.length === 0) {
        fetchMembers();
      }
      for (const list of lists) {
        (function(list) {
          db.all('SELECT * FROM cards WHERE list_id = ? ORDER BY position ASC, created_at ASC', [list.id], (err, cards) => {
            if (err) return send(500, { error: err.message });
            list.cards = cards;

            let cardCompleted = 0;
            if (cards.length === 0) {
              cardDone(list);
            }
            for (const card of cards) {
              (function(card) {
                db.all('SELECT * FROM labels WHERE card_id = ? ORDER BY id', [card.id], (err, labels) => {
                  if (err) return send(500, { error: err.message });
                  card.labels = labels;

                  db.all(
                    `SELECT u.id, u.username, u.email FROM card_members cm
                     JOIN users u ON u.id = cm.user_id WHERE cm.card_id = ?`,
                    [card.id],
                    (err, members) => {
                      if (err) return send(500, { error: err.message });
                      card.members = members;

                      db.get('SELECT * FROM card_dates WHERE card_id = ?', [card.id], (err, dates) => {
                        if (err) return send(500, { error: err.message });
                        card.dates = dates || null;

                        db.all('SELECT * FROM checklists WHERE card_id = ? ORDER BY id', [card.id], (err, checklists) => {
                          if (err) return send(500, { error: err.message });

                          let clCompleted = 0;
                          if (checklists.length === 0) {
                            checklistDone(card, checklists);
                          }
                          for (const cl of checklists) {
                            (function(cl) {
                              db.all('SELECT * FROM checklist_items WHERE checklist_id = ? ORDER BY id', [cl.id], (err, items) => {
                                if (err) return send(500, { error: err.message });
                                cl.items = items;
                                clCompleted++;
                                if (clCompleted === checklists.length) {
                                  checklistDone(card, checklists);
                                }
                              });
                            })(cl);
                          }

                          function checklistDone(card, checklists) {
                            card.checklists = checklists;

                            db.all('SELECT * FROM attachments WHERE card_id = ? ORDER BY uploaded_at DESC', [card.id], (err, attachments) => {
                              if (err) return send(500, { error: err.message });
                              card.attachments = attachments;

                              db.all(
                                `SELECT cc.*, u.username FROM card_comments cc
                                 JOIN users u ON u.id = cc.user_id WHERE cc.card_id = ? ORDER BY cc.created_at ASC`,
                                [card.id],
                                (err, comments) => {
                                  if (err) return send(500, { error: err.message });
                                  card.comments = comments;
                                  card.activity = [];
                                  cardCompleted++;
                                  if (cardCompleted === cards.length) {
                                    cardDone(list);
                                  }
                                }
                              );
                            });
                          }
                        });
                      });
                    }
                  );
                });
              })(card);
            }

            function cardDone(list) {
              completed++;
              if (completed === lists.length) {
                fetchMembers();
              }
            }
          });
        })(list);
      }

      function fetchMembers() {
        db.all(
          `SELECT u.id, u.username, u.email, u.role AS user_role, bm.role AS board_role
           FROM board_members bm
           JOIN users u ON u.id = bm.user_id
           WHERE bm.board_id = ?`,
          [boardId],
          (err, members) => {
            if (err) return send(500, { error: err.message });
            board.members = members;
            send(null, board);
          }
        );
      }
    });
  });
};

const updateBoardTitle = (db) => (req, res) => {
  const { title } = req.body;
  db.run(
    'UPDATE boards SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [title, req.params.boardId],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Board not found' });
      db.get('SELECT * FROM boards WHERE id = ?', [req.params.boardId], (err, board) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Board updated', board });
      });
    }
  );
};

const deleteBoard = (db) => (req, res) => {
  const boardId = req.params.boardId;
  db.serialize(() => {
    db.run('DELETE FROM board_members WHERE board_id = ?', boardId);
    db.run('DELETE FROM card_members WHERE card_id IN (SELECT c.id FROM cards c JOIN lists l ON l.id = c.list_id WHERE l.board_id = ?)', boardId);
    db.run('DELETE FROM card_dates WHERE card_id IN (SELECT c.id FROM cards c JOIN lists l ON l.id = c.list_id WHERE l.board_id = ?)', boardId);
    db.run('DELETE FROM labels WHERE card_id IN (SELECT c.id FROM cards c JOIN lists l ON l.id = c.list_id WHERE l.board_id = ?)', boardId);
    db.run('DELETE FROM checklist_items WHERE checklist_id IN (SELECT cl.id FROM checklists cl JOIN cards c ON c.id = cl.card_id JOIN lists l ON l.id = c.list_id WHERE l.board_id = ?)', boardId);
    db.run('DELETE FROM checklists WHERE card_id IN (SELECT c.id FROM cards c JOIN lists l ON l.id = c.list_id WHERE l.board_id = ?)', boardId);
    db.run('DELETE FROM attachments WHERE card_id IN (SELECT c.id FROM cards c JOIN lists l ON l.id = c.list_id WHERE l.board_id = ?)', boardId);
    db.run('DELETE FROM card_comments WHERE card_id IN (SELECT c.id FROM cards c JOIN lists l ON l.id = c.list_id WHERE l.board_id = ?)', boardId);
    db.run('DELETE FROM card_activity WHERE card_id IN (SELECT c.id FROM cards c JOIN lists l ON l.id = c.list_id WHERE l.board_id = ?)', boardId);
    db.run('DELETE FROM cards WHERE list_id IN (SELECT id FROM lists WHERE board_id = ?)', boardId);
    db.run('DELETE FROM lists WHERE board_id = ?', boardId);
    db.run('DELETE FROM boards WHERE id = ?', boardId, function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Board not found' });
      res.json({ message: 'Board deleted' });
    });
  });
};

const getBoardMembers = (db) => (req, res) => {
  db.all(
    `SELECT u.id, u.username, u.email, bm.role FROM board_members bm
     JOIN users u ON u.id = bm.user_id WHERE bm.board_id = ?`,
    [req.params.boardId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
};

const removeBoardMember = (db) => (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  db.run(
    'DELETE FROM board_members WHERE board_id = ? AND user_id = ?',
    [req.params.boardId, userId],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Member not found in this board' });
      res.json({ message: 'Member removed from board' });
    }
  );
};

const createUserAndAddToBoard = (db) => (req, res) => {
  const { username, email, password, role } = req.body;
  const boardId = req.params.boardId;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email, and password are required' });
  }
  db.get('SELECT id FROM users WHERE username = ? OR email = ?', [username, email], (err, existing) => {
    if (err) return res.status(500).json({ error: err.message });
    if (existing) return res.status(400).json({ error: 'User already exists' });

    const hashedPassword = bcrypt.hashSync(password, 10);
    db.run(
      `INSERT INTO users (username, email, password, role, status, approved_at)
       VALUES (?, ?, ?, ?, 'approved', CURRENT_TIMESTAMP)`,
      [username, email, hashedPassword, role || 'viewer'],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        const user = { id: this.lastID, username, email, role: role || 'viewer' };
        db.run(
          'INSERT INTO board_members (board_id, user_id, role) VALUES (?, ?, ?)',
          [boardId, user.id, 'member'],
          function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({
              message: 'User created and added to board',
              user: { id: user.id, username: user.username, email: user.email, role: user.role }
            });
          }
        );
      }
    );
  });
};

module.exports = {
  createBoard, getUserBoards, getBoardById, updateBoardTitle, deleteBoard,
  getBoardMembers, removeBoardMember, createUserAndAddToBoard,
};
