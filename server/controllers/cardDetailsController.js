const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { logCardActivity } = require('../utils/cardActivity');
const {
  isSupabaseStorageEnabled,
  getSupabaseStorageNotice,
  uploadToSupabaseStorage,
  deleteFromSupabaseStorage,
} = require('../utils/supabaseStorage');

const getUploadsPath = () => process.env.UPLOADS_PATH || path.join(__dirname, '../uploads');

const saveFileLocally = (file) => {
  const uploadsPath = getUploadsPath();
  if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
  }
  const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
  const safeName = `${uniqueSuffix}-${file.originalname}`;
  fs.writeFileSync(path.join(uploadsPath, safeName), file.buffer);
  return safeName;
};

const addLabel = (db) => (req, res) => {
  const { name, color } = req.body;
  if (!name) return res.status(400).json({ error: 'Label text is required' });
  db.run(
    `INSERT INTO labels (card_id, name, color) VALUES (?, ?, ?)`,
    [req.params.cardId, name, color || null],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ message: 'Label added', label: { id: this.lastID, card_id: Number(req.params.cardId), name, color: color || null } });
    }
  );
};

const deleteLabel = (db) => (req, res) => {
  db.get(`SELECT * FROM labels WHERE id = ?`, [req.params.labelId], (err, label) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!label) return res.status(404).json({ error: 'Label not found' });
    db.run(`DELETE FROM labels WHERE id = ?`, [req.params.labelId], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Label deleted' });
    });
  });
};

const addMember = (db) => (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  db.run(
    `INSERT OR IGNORE INTO card_members (card_id, user_id) VALUES (?, ?)`,
    [req.params.cardId, userId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      db.get(`SELECT id, username, email FROM users WHERE id = ?`, [userId], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        const memberLabel = (user?.username || user?.email || 'Member');
        logCardActivity(db, {
          cardId: Number(req.params.cardId),
          userId: req.user.id,
          actionType: 'member_added',
          message: `Added member ${memberLabel}`,
        }, (logErr) => {
          if (logErr) console.error('Failed to log member added activity', logErr);
          res.json({ message: 'Member added to card', user: user || null });
        });
      });
    }
  );
};

const removeMember = (db) => (req, res) => {
  db.get(`SELECT username, email FROM users WHERE id = ?`, [req.params.userId], (err, removedUser) => {
    if (err) return res.status(500).json({ error: err.message });
    db.run(
      `DELETE FROM card_members WHERE card_id = ? AND user_id = ?`,
      [req.params.cardId, req.params.userId],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        const memberLabel = (removedUser?.username || removedUser?.email || 'Member');
        logCardActivity(db, {
          cardId: Number(req.params.cardId),
          userId: req.user.id,
          actionType: 'member_removed',
          message: `Removed member ${memberLabel}`,
        }, (logErr) => {
          if (logErr) console.error('Failed to log member removed activity', logErr);
          res.json({ message: 'Member removed from card' });
        });
      }
    );
  });
};

const setDates = (db) => (req, res) => {
  const startDate = req.body.start_date ?? req.body.startDate ?? null;
  const dueDate = req.body.due_date ?? req.body.dueDate ?? null;
  const dueTime = req.body.due_time ?? req.body.dueTime ?? null;
  db.get(`SELECT id FROM card_dates WHERE card_id = ?`, [req.params.cardId], (err, existing) => {
    if (err) return res.status(500).json({ error: err.message });
    if (existing) {
      db.run(
        `UPDATE card_dates SET start_date = ?, due_date = ?, due_time = ? WHERE card_id = ?`,
        [startDate || null, dueDate || null, dueTime || null, req.params.cardId],
        function (err) {
          if (err) return res.status(500).json({ error: err.message });
          db.get(`SELECT * FROM card_dates WHERE card_id = ?`, [req.params.cardId], (err, dates) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Dates updated', dates });
          });
        }
      );
    } else {
      db.run(
        `INSERT INTO card_dates (card_id, start_date, due_date, due_time) VALUES (?, ?, ?, ?)`,
        [req.params.cardId, startDate || null, dueDate || null, dueTime || null],
        function (err) {
          if (err) return res.status(500).json({ error: err.message });
          db.get(`SELECT * FROM card_dates WHERE card_id = ?`, [req.params.cardId], (err, dates) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Dates updated', dates });
          });
        }
      );
    }
  });
};

const addMemberByEmail = (db) => (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  db.get(`SELECT id, username, email FROM users WHERE email = ? AND status = 'approved'`, [email], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(404).json({ error: 'Approved user with this email not found' });
    db.run(
      `INSERT OR IGNORE INTO card_members (card_id, user_id) VALUES (?, ?)`,
      [req.params.cardId, user.id],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Member added', user });
      }
    );
  });
};

const addChecklist = (db) => (req, res) => {
  const { title } = req.body;
  if (!title) return res.status(400).json({ error: 'Checklist title required' });
  db.run(
    `INSERT INTO checklists (card_id, title) VALUES (?, ?)`,
    [req.params.cardId, title],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      const checklist = { id: this.lastID, card_id: Number(req.params.cardId), title, items: [] };
      res.status(201).json({ message: 'Checklist added', checklist });
    }
  );
};

const addChecklistItem = (db) => (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Item text required' });
  db.run(
    `INSERT INTO checklist_items (checklist_id, text) VALUES (?, ?)`,
    [req.params.checklistId, text],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      const item = { id: this.lastID, checklist_id: Number(req.params.checklistId), text, completed: 0 };
      res.status(201).json({ message: 'Item added', item });
    }
  );
};

const uploadAttachment = (db) => async (req, res) => {
  const files = req.files;
  if (!files || !files.length) return res.status(400).json({ error: 'No files uploaded' });
  const attachments = [];
  let completed = 0;
  let failed = false;
  const storageNotice = getSupabaseStorageNotice();
  if (storageNotice) {
    console.warn(storageNotice);
  }
  for (const file of files) {
    let storedFilePath = '';
    let storedUrl = null;
    try {
      if (isSupabaseStorageEnabled()) {
        const uploaded = await uploadToSupabaseStorage({ cardId: req.params.cardId, file });
        storedFilePath = uploaded.objectPath;
        storedUrl = uploaded.publicUrl;
      } else {
        storedFilePath = saveFileLocally(file);
      }
    } catch (uploadErr) {
      failed = true;
      return res.status(500).json({ error: uploadErr.message });
    }

    db.run(
      `INSERT INTO attachments (card_id, file_name, file_path, file_size, uploaded_by_id, attachment_type, url, is_cover)
       VALUES (?, ?, ?, ?, ?, 'file', ?, 0)`,
      [req.params.cardId, file.originalname, storedFilePath, file.size, req.user.id, storedUrl],
      function (err) {
        if (failed) return;
        if (err) {
          failed = true;
          return res.status(500).json({ error: err.message });
        }
        attachments.push({
          id: this.lastID,
          card_id: Number(req.params.cardId),
          file_name: file.originalname,
          file_path: storedFilePath,
          file_size: file.size,
          uploaded_by_id: req.user.id,
          attachment_type: 'file',
          url: storedUrl,
          is_cover: 0,
        });
        logCardActivity(db, {
          cardId: Number(req.params.cardId),
          userId: req.user.id,
          actionType: 'attachment_uploaded',
          message: `Attachment uploaded: ${file.originalname}`,
        }, (logErr) => {
          if (logErr) console.error('Failed to log attachment uploaded activity', logErr);
        });
        completed++;
        if (completed === files.length) {
          res.status(201).json({ message: 'Files uploaded', attachments });
        }
      }
    );
  }
};

const addAttachmentLink = (db) => (req, res) => {
  const linkUrl = req.body.url || req.body.linkUrl;
  const linkName = req.body.title || req.body.linkName || linkUrl;
  if (!linkUrl) return res.status(400).json({ error: 'Link URL required' });
  db.run(
    `INSERT INTO attachments (card_id, file_name, file_path, file_size, uploaded_by_id, attachment_type, url, is_cover)
     VALUES (?, ?, '', NULL, ?, 'link', ?, 0)`,
    [req.params.cardId, linkName, req.user.id, linkUrl],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      const attachment = {
        id: this.lastID,
        card_id: Number(req.params.cardId),
        file_name: linkName,
        file_path: '',
        file_size: null,
        uploaded_by_id: req.user.id,
        attachment_type: 'link',
        url: linkUrl,
        is_cover: 0,
      };
      logCardActivity(db, {
        cardId: Number(req.params.cardId),
        userId: req.user.id,
        actionType: 'attachment_uploaded',
        message: `Attachment link added: ${linkName || linkUrl}`,
      }, (logErr) => {
        if (logErr) console.error('Failed to log attachment link activity', logErr);
      });
      res.status(201).json({ message: 'Link added', attachment });
    }
  );
};

const deleteAttachment = (db) => (req, res) => {
  db.get(`SELECT * FROM attachments WHERE id = ?`, [req.params.attachmentId], (err, attachment) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!attachment) return res.status(404).json({ error: 'Attachment not found' });
    if ((attachment.attachment_type || 'file') === 'file' && attachment.file_path) {
      if (attachment.url && isSupabaseStorageEnabled()) {
        deleteFromSupabaseStorage(attachment.file_path).catch((deleteErr) => {
          console.warn('Failed to delete Supabase attachment:', deleteErr.message);
        });
      } else {
        const filePath = path.join(getUploadsPath(), attachment.file_path);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
    }
    db.run(`DELETE FROM attachments WHERE id = ?`, [req.params.attachmentId], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Attachment deleted' });
    });
  });
};

const updateAttachment = (db) => (req, res) => {
  const fileName = req.body.fileName || req.body.linkName;
  const linkUrl = req.body.url || req.body.linkUrl;
  const params = [];
  const sets = [];
  if (fileName !== undefined) { sets.push('file_name = ?'); params.push(fileName); }
  if (linkUrl !== undefined) { sets.push('url = ?'); params.push(linkUrl); }
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
  params.push(req.params.attachmentId);
  db.run(
    `UPDATE attachments SET ${sets.join(', ')} WHERE id = ?`,
    params,
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (!this.changes) return res.status(404).json({ error: 'Attachment not found' });
      db.get(`SELECT * FROM attachments WHERE id = ?`, [req.params.attachmentId], (err, attachment) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Attachment updated', attachment });
      });
    }
  );
};

const makeAttachmentCover = (db) => (req, res) => {
  db.get(`SELECT * FROM attachments WHERE id = ?`, [req.params.attachmentId], (err, attachment) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!attachment) return res.status(404).json({ error: 'Attachment not found' });
    db.serialize(() => {
      db.run(
        `UPDATE attachments
         SET is_cover = 0
         WHERE card_id = ?`,
        [attachment.card_id]
      );
      db.run(
        `UPDATE attachments SET is_cover = 1 WHERE id = ?`,
        [req.params.attachmentId],
        function (updateErr) {
          if (updateErr) return res.status(500).json({ error: updateErr.message });
          db.get(`SELECT * FROM attachments WHERE id = ?`, [req.params.attachmentId], (fetchErr, updated) => {
            if (fetchErr) return res.status(500).json({ error: fetchErr.message });
            res.json({ message: 'Cover set', attachment: updated });
          });
        }
      );
    });
  });
};

const shareAttachment = (db) => (req, res) => {
  db.get(`SELECT * FROM attachments WHERE id = ?`, [req.params.attachmentId], (err, attachment) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!attachment) return res.status(404).json({ error: 'Attachment not found' });
    const baseUrl = process.env.REMOTE_API_URL || `http://localhost:${process.env.PORT || 3001}`;
    const shareToken = attachment.share_token || `${attachment.id}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    db.run(
      `UPDATE attachments SET share_token = ? WHERE id = ?`,
      [shareToken, req.params.attachmentId],
      (updateErr) => {
        if (updateErr) return res.status(500).json({ error: updateErr.message });
        res.json({ message: 'Share link generated', shareUrl: `${baseUrl}/share/attachments/${shareToken}` });
      }
    );
  });
};

const downloadAttachment = (db) => (req, res) => {
  db.get(`SELECT * FROM attachments WHERE id = ?`, [req.params.attachmentId], (err, attachment) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!attachment) return res.status(404).json({ error: 'Attachment not found' });
    if ((attachment.attachment_type || 'file') === 'link') {
      return res.redirect(attachment.url);
    }
    if (attachment.url && isSupabaseStorageEnabled()) {
      return res.redirect(attachment.url);
    }
    const filePath = path.join(getUploadsPath(), attachment.file_path);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on server' });
    }
    res.download(filePath, attachment.file_name);
  });
};

const addComment = (db) => (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Comment text required' });
  db.run(
    `INSERT INTO card_comments (card_id, user_id, text) VALUES (?, ?, ?)`,
    [req.params.cardId, req.user.id, text],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      db.get(
        `SELECT c.*, u.username FROM card_comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?`,
        [this.lastID],
        (err, comment) => {
          if (err) return res.status(500).json({ error: err.message });
          res.status(201).json({ message: 'Comment added', comment });
        }
      );
    }
  );
};

const viewSharedAttachment = (db) => (req, res) => {
  const { shareToken } = req.params;
  db.get(`SELECT * FROM attachments WHERE share_token = ? OR id = ?`, [shareToken, shareToken], (err, attachment) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!attachment) return res.status(404).json({ error: 'Attachment not found' });
    if ((attachment.attachment_type || 'file') === 'link') {
      return res.redirect(attachment.url);
    }
    if (attachment.url && isSupabaseStorageEnabled()) {
      return res.redirect(attachment.url);
    }
    const filePath = path.join(getUploadsPath(), attachment.file_path);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    res.download(filePath, attachment.file_name);
  });
};

module.exports = {
  addLabel, deleteLabel, addMember, removeMember, setDates, addMemberByEmail,
  addChecklist, addChecklistItem, uploadAttachment, addAttachmentLink,
  deleteAttachment, updateAttachment, makeAttachmentCover, shareAttachment,
  downloadAttachment, addComment, viewSharedAttachment,
};
