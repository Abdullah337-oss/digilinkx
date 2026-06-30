const { logCardActivity } = require('../utils/cardActivity');

const createCard = (db) => (req, res) => {
  const { list_id, listId, title, description, position, start_date, due_date, labels } = req.body;
  const resolvedListId = list_id || listId;
  if (!resolvedListId || !title) {
    return res.status(400).json({ error: 'List ID and title are required' });
  }
  db.run(
    `INSERT INTO cards (list_id, title, description, position, created_by_id) VALUES (?, ?, ?, ?, ?)`,
    [resolvedListId, title, description || '', position || 0, req.user.id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      const cardId = this.lastID;
      logCardActivity(db, {
        cardId,
        userId: req.user.id,
        actionType: 'card_created',
        message: 'Card created',
      }, (logErr) => {
        if (logErr) console.error('Failed to log card activity', logErr);
      });
      if (labels && Array.isArray(labels) && labels.length > 0) {
        let completed = 0;
        labels.forEach((label) => {
          db.run(
            `INSERT INTO labels (card_id, name, color) VALUES (?, ?, ?)`,
            [cardId, label.text, label.color],
            (err) => {
              if (err) return res.status(500).json({ error: err.message });
              completed++;
              if (completed === labels.length) {
                db.all(`SELECT * FROM labels WHERE card_id = ? ORDER BY id`, [cardId], (err, rows) => {
                  if (err) return res.status(500).json({ error: err.message });
                  res.status(201).json({
                    message: 'Card created',
                    card: {
                      id: cardId, list_id: resolvedListId, title,
                      description: description || '',
                      position: position || 0,
                      labels: rows, members: [], dates: null,
                      checklists: [], attachments: [], comments: [], activity: []
                    }
                  });
                });
              }
            }
          );
        });
      } else {
        res.status(201).json({
          message: 'Card created',
          card: {
            id: cardId, list_id: resolvedListId, title,
            description: description || '',
            position: position || 0,
            labels: [], members: [], dates: null,
            checklists: [], attachments: [], comments: [], activity: []
          }
        });
      }
    }
  );
};

const getCardById = (db) => (req, res) => {
  db.get(`SELECT * FROM cards WHERE id = ?`, [req.params.cardId], (err, card) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!card) return res.status(404).json({ error: 'Card not found' });

    const stepLabels = () => {
      db.all(`SELECT * FROM labels WHERE card_id = ? ORDER BY id`, [card.id], (err, labels) => {
        if (err) return res.status(500).json({ error: err.message });
        card.labels = labels;
        stepMembers();
      });
    };
    const stepMembers = () => {
      db.all(
        `SELECT u.id, u.username, u.email FROM card_members cm JOIN users u ON u.id = cm.user_id WHERE cm.card_id = ?`,
        [card.id], (err, members) => {
          if (err) return res.status(500).json({ error: err.message });
          card.members = members;
          stepDates();
        }
      );
    };
    const stepDates = () => {
      db.get(`SELECT * FROM card_dates WHERE card_id = ?`, [card.id], (err, dates) => {
        if (err) return res.status(500).json({ error: err.message });
        card.dates = dates || null;
        stepChecklists();
      });
    };
    const stepChecklists = () => {
      db.all(`SELECT * FROM checklists WHERE card_id = ? ORDER BY id`, [card.id], (err, checklists) => {
        if (err) return res.status(500).json({ error: err.message });
        let clCompleted = 0;
        if (checklists.length === 0) {
          card.checklists = [];
          stepAttachments();
        } else {
          checklists.forEach((cl) => {
            db.all(`SELECT * FROM checklist_items WHERE checklist_id = ? ORDER BY id`, [cl.id], (err, items) => {
              if (err) return res.status(500).json({ error: err.message });
              cl.items = items;
              clCompleted++;
              if (clCompleted === checklists.length) {
                card.checklists = checklists;
                stepAttachments();
              }
            });
          });
        }
      });
    };
    const stepAttachments = () => {
      db.all(`SELECT * FROM attachments WHERE card_id = ? ORDER BY uploaded_at DESC`, [card.id], (err, attachments) => {
        if (err) return res.status(500).json({ error: err.message });
        card.attachments = attachments;
        stepComments();
      });
    };
    const stepComments = () => {
      db.all(
        `SELECT cc.*, u.username FROM card_comments cc JOIN users u ON u.id = cc.user_id WHERE cc.card_id = ? ORDER BY cc.created_at ASC`,
        [card.id], (err, comments) => {
          if (err) return res.status(500).json({ error: err.message });
          card.comments = comments;
          stepActivity();
        }
      );
    };
    const stepActivity = () => {
      db.all(
        `SELECT ca.*, u.username, u.role AS role FROM card_activity ca JOIN users u ON u.id = ca.user_id WHERE ca.card_id = ? ORDER BY ca.created_at DESC LIMIT 50`,
        [card.id], (err, activity) => {
          if (err) return res.status(500).json({ error: err.message });
          card.activity = activity;
          res.json(card);
        }
      );
    };
    stepLabels();
  });
};

const updateCard = (db) => (req, res) => {
  const { title, description, position, start_date, due_date, list_id } = req.body;
  const fields = [];
  const values = [];
  if (title !== undefined) { fields.push('title = ?'); values.push(title); }
  if (description !== undefined) { fields.push('description = ?'); values.push(description); }
  if (position !== undefined) { fields.push('position = ?'); values.push(position); }
  if (start_date !== undefined) { fields.push('start_date = ?'); values.push(start_date); }
  if (due_date !== undefined) { fields.push('due_date = ?'); values.push(due_date); }
  if (list_id !== undefined) { fields.push('list_id = ?'); values.push(list_id); }
  if (fields.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }
  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(req.params.cardId);
  db.run(
    `UPDATE cards SET ${fields.join(', ')} WHERE id = ?`,
    values,
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Card not found' });
      db.get(`SELECT * FROM cards WHERE id = ?`, [req.params.cardId], (err, card) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Card updated', card });
      });
    }
  );
};

const deleteCard = (db) => (req, res) => {
  const cardId = req.params.cardId;
  db.get(`SELECT list_id FROM cards WHERE id = ?`, [cardId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Card not found' });
    db.serialize(() => {
      db.run('DELETE FROM card_members WHERE card_id = ?', cardId);
      db.run('DELETE FROM card_dates WHERE card_id = ?', cardId);
      db.run('DELETE FROM labels WHERE card_id = ?', cardId);
      db.run('DELETE FROM checklist_items WHERE checklist_id IN (SELECT id FROM checklists WHERE card_id = ?)', cardId);
      db.run('DELETE FROM checklists WHERE card_id = ?', cardId);
      db.run('DELETE FROM attachments WHERE card_id = ?', cardId);
      db.run('DELETE FROM card_comments WHERE card_id = ?', cardId);
      db.run('DELETE FROM card_activity WHERE card_id = ?', cardId);
      db.run('DELETE FROM cards WHERE id = ?', cardId, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Card deleted' });
      });
    });
  });
};

const moveCard = (db) => (req, res) => {
  const { list_id, listId, position } = req.body;
  const resolvedListId = list_id !== undefined ? list_id : listId;
  if (resolvedListId === undefined && position === undefined) {
    return res.status(400).json({ error: 'List ID or position required' });
  }

  const cardId = Number(req.params.cardId);
  const requestedPosition = Number.isInteger(Number(position)) ? Number(position) : 0;

  db.get('SELECT * FROM cards WHERE id = ?', [cardId], (err, currentCard) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!currentCard) return res.status(404).json({ error: 'Card not found' });

    const sourceListId = Number(currentCard.list_id);
    const targetListId = resolvedListId !== undefined ? Number(resolvedListId) : sourceListId;
    if (!Number.isInteger(targetListId)) {
      return res.status(400).json({ error: 'Valid list ID required' });
    }

    const logAndReturn = (listTitle) => {
      logCardActivity(db, {
        cardId,
        userId: req.user.id,
        actionType: 'card_moved',
        message: listTitle ? `Card moved to ${listTitle}` : 'Card moved',
      }, (logErr) => {
        if (logErr) console.error('Failed to log card activity', logErr);
        db.get(`SELECT * FROM cards WHERE id = ?`, [cardId], (err, card) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ message: 'Card moved', card });
        });
      });
    };

    const finishMove = () => {
      db.get('SELECT title FROM lists WHERE id = ?', [targetListId], (err, row) => {
        if (err) {
          console.error('Failed to read list title for move log', err);
          return logAndReturn();
        }
        logAndReturn(row?.title || 'Unknown list');
      });
    };

    const updateCardsInOrder = (cards, callback) => {
      if (cards.length === 0) return callback();
      let completed = 0;
      let sent = false;
      const done = (updateErr) => {
        if (sent) return;
        if (updateErr) {
          sent = true;
          return callback(updateErr);
        }
        completed++;
        if (completed === cards.length) callback();
      };

      cards.forEach((card, index) => {
        db.run(
          'UPDATE cards SET list_id = ?, position = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [card.list_id, index, card.id],
          done
        );
      });
    };

    if (sourceListId === targetListId) {
      db.all('SELECT * FROM cards WHERE list_id = ? ORDER BY position ASC, created_at ASC', [sourceListId], (err, cards) => {
        if (err) return res.status(500).json({ error: err.message });
        const withoutMoved = cards.filter((card) => Number(card.id) !== cardId);
        const insertAt = Math.max(0, Math.min(requestedPosition, withoutMoved.length));
        withoutMoved.splice(insertAt, 0, { ...currentCard, list_id: sourceListId });

        updateCardsInOrder(withoutMoved, (updateErr) => {
          if (updateErr) return res.status(500).json({ error: updateErr.message });
          finishMove();
        });
      });
      return;
    }

    db.all('SELECT * FROM cards WHERE list_id = ? ORDER BY position ASC, created_at ASC', [sourceListId], (err, sourceCards) => {
      if (err) return res.status(500).json({ error: err.message });
      db.all('SELECT * FROM cards WHERE list_id = ? ORDER BY position ASC, created_at ASC', [targetListId], (err, targetCards) => {
        if (err) return res.status(500).json({ error: err.message });

        const nextSourceCards = sourceCards.filter((card) => Number(card.id) !== cardId);
        const nextTargetCards = targetCards.filter((card) => Number(card.id) !== cardId);
        const insertAt = Math.max(0, Math.min(requestedPosition, nextTargetCards.length));
        nextTargetCards.splice(insertAt, 0, { ...currentCard, list_id: targetListId });

        updateCardsInOrder(nextSourceCards, (sourceUpdateErr) => {
          if (sourceUpdateErr) return res.status(500).json({ error: sourceUpdateErr.message });
          updateCardsInOrder(nextTargetCards, (targetUpdateErr) => {
            if (targetUpdateErr) return res.status(500).json({ error: targetUpdateErr.message });
            finishMove();
          });
        });
      });
    }
  });
};

module.exports = {
  createCard,
  getCardById,
  updateCard,
  deleteCard,
  moveCard,
};
