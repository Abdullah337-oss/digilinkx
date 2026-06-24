const createList = (db) => (req, res) => {
  const { board_id, title, position } = req.body;
  db.run(
    `INSERT INTO lists (board_id, title, position) VALUES (?, ?, ?)`,
    [board_id, title, position || 0],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      const list = { id: this.lastID, board_id, title, position: position || 0 };
      res.status(201).json({ message: 'List created', list });
    }
  );
};

const updateListTitle = (db) => (req, res) => {
  const { listId } = req.params;
  const { title, position } = req.body;
  const fields = [];
  const values = [];
  if (title !== undefined) { fields.push('title = ?'); values.push(title); }
  if (position !== undefined) { fields.push('position = ?'); values.push(position); }
  if (fields.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }
  values.push(listId);
  db.run(
    `UPDATE lists SET ${fields.join(', ')} WHERE id = ?`,
    values,
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'List not found' });
      db.get(`SELECT * FROM lists WHERE id = ?`, [listId], (err, list) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'List updated', list });
      });
    }
  );
};

module.exports = { createList, updateListTitle };
