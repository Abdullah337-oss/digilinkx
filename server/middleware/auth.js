const jwt = require('jwt-simple');
const db = require('../db/database');
const secret = process.env.JWT_SECRET || 'your_secret_key_change_this_in_production';

const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.decode(token, secret);
    const nowInSeconds = Math.floor(Date.now() / 1000);
    if (decoded?.exp && decoded.exp <= nowInSeconds) {
      return res.status(401).json({ error: 'Token expired' });
    }

    db.get(
      'SELECT id, username, email, role, status FROM users WHERE id = ?',
      [decoded.id],
      (err, row) => {
        if (err) {
          return res.status(500).json({ error: 'Server error' });
        }
        if (!row) {
          return res.status(401).json({ error: 'User not found' });
        }

        if (row.status !== 'approved') {
          return res.status(403).json({ error: 'Account is not approved by admin' });
        }

        req.user = {
          id: row.id,
          username: row.username,
          email: row.email,
          role: row.role,
          iat: decoded.iat,
          exp: decoded.exp,
        };
        next();
      }
    );
  } catch (err) {
    res.status(403).json({ error: 'Invalid or expired token' });
  }
};

const checkAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

const checkBoardAccess = (db) => {
  return (req, res, next) => {
    const boardId = req.params.boardId || req.body.boardId;
    const userId = req.user.id;

    if (req.user.role === 'admin') {
      req.isOwner = true;
      return next();
    }

    db.get(
      `SELECT b.owner_id, u.role AS owner_role
       FROM boards b
       LEFT JOIN users u ON u.id = b.owner_id
       WHERE b.id = ?`,
      [boardId],
      (err, row) => {
        if (err) {
          return res.status(500).json({ error: 'Server error' });
        }
        if (!row) {
          return res.status(404).json({ error: 'Board not found' });
        }

        if (row.owner_id === userId) {
          req.isOwner = true;
          return next();
        }

        if (row.owner_role === 'admin') {
          req.userRole = 'viewer';
          return next();
        }

        db.get(
          'SELECT role FROM board_members WHERE board_id = ? AND user_id = ?',
          [boardId, userId],
          (err, memberRow) => {
            if (err) {
              return res.status(500).json({ error: 'Server error' });
            }
            if (!memberRow) {
              return res.status(403).json({ error: 'Access denied to this board' });
            }

            req.userRole = memberRow.role;
            next();
          }
        );
      }
    );
  };
};

const checkListAccess = (db) => {
  return (req, res, next) => {
    const listId = req.params.listId || req.body.listId;
    const userId = req.user.id;

    if (!listId) {
      return res.status(400).json({ error: 'List ID required' });
    }

    if (req.user.role === 'admin') {
      return next();
    }

    db.get(
      `SELECT b.id AS board_id, b.owner_id, u.role AS owner_role
       FROM lists l
       JOIN boards b ON b.id = l.board_id
       LEFT JOIN users u ON u.id = b.owner_id
       WHERE l.id = ?`,
      [listId],
      (err, row) => {
        if (err) {
          return res.status(500).json({ error: 'Server error' });
        }
        if (!row) {
          return res.status(404).json({ error: 'List not found' });
        }

        if (row.owner_id === userId || row.owner_role === 'admin') {
          req.boardId = row.board_id;
          return next();
        }

        db.get(
          'SELECT role FROM board_members WHERE board_id = ? AND user_id = ?',
          [row.board_id, userId],
          (err, memberRow) => {
            if (err) {
              return res.status(500).json({ error: 'Server error' });
            }
            if (!memberRow) {
              return res.status(403).json({ error: 'Access denied to this list' });
            }

            req.userRole = memberRow.role;
            req.boardId = row.board_id;
            next();
          }
        );
      }
    );
  };
};

const checkCardAccess = (db) => {
  return (req, res, next) => {
    const cardId = req.params.cardId || req.body.cardId;
    const userId = req.user.id;

    if (!cardId) {
      return res.status(400).json({ error: 'Card ID required' });
    }

    if (req.user.role === 'admin') {
      return next();
    }

    db.get(
      `SELECT c.id AS card_id, b.id AS board_id, b.owner_id, u.role AS owner_role
       FROM cards c
       JOIN lists l ON l.id = c.list_id
       JOIN boards b ON b.id = l.board_id
       LEFT JOIN users u ON u.id = b.owner_id
       WHERE c.id = ?`,
      [cardId],
      (err, row) => {
        if (err) {
          return res.status(500).json({ error: 'Server error' });
        }
        if (!row) {
          return res.status(404).json({ error: 'Card not found' });
        }

        if (row.owner_id === userId || row.owner_role === 'admin') {
          req.boardId = row.board_id;
          return next();
        }

        db.get(
          'SELECT role FROM board_members WHERE board_id = ? AND user_id = ?',
          [row.board_id, userId],
          (err, memberRow) => {
            if (err) {
              return res.status(500).json({ error: 'Server error' });
            }
            if (!memberRow) {
              return res.status(403).json({ error: 'Access denied to this card' });
            }

            req.userRole = memberRow.role;
            req.boardId = row.board_id;
            next();
          }
        );
      }
    );
  };
};

const checkLabelAccess = (db) => {
  return (req, res, next) => {
    const { labelId } = req.params;
    const userId = req.user.id;

    if (req.user.role === 'admin') {
      return next();
    }

    db.get(
      `SELECT b.id AS board_id, b.owner_id, u.role AS owner_role
       FROM labels lb
       JOIN cards c ON c.id = lb.card_id
       JOIN lists l ON l.id = c.list_id
       JOIN boards b ON b.id = l.board_id
       LEFT JOIN users u ON u.id = b.owner_id
       WHERE lb.id = ?`,
      [labelId],
      (err, row) => {
        if (err) {
          return res.status(500).json({ error: 'Server error' });
        }
        if (!row) {
          return res.status(404).json({ error: 'Label not found' });
        }

        if (row.owner_id === userId || row.owner_role === 'admin') {
          req.boardId = row.board_id;
          return next();
        }

        db.get(
          'SELECT role FROM board_members WHERE board_id = ? AND user_id = ?',
          [row.board_id, userId],
          (err, memberRow) => {
            if (err) {
              return res.status(500).json({ error: 'Server error' });
            }
            if (!memberRow) {
              return res.status(403).json({ error: 'Access denied to this label' });
            }

            req.userRole = memberRow.role;
            req.boardId = row.board_id;
            next();
          }
        );
      }
    );
  };
};

const checkChecklistAccess = (db) => {
  return (req, res, next) => {
    const { checklistId } = req.params;
    const userId = req.user.id;

    if (req.user.role === 'admin') {
      return next();
    }

    db.get(
      `SELECT b.id AS board_id, b.owner_id, u.role AS owner_role
       FROM checklists cl
       JOIN cards c ON c.id = cl.card_id
       JOIN lists l ON l.id = c.list_id
       JOIN boards b ON b.id = l.board_id
       LEFT JOIN users u ON u.id = b.owner_id
       WHERE cl.id = ?`,
      [checklistId],
      (err, row) => {
        if (err) {
          return res.status(500).json({ error: 'Server error' });
        }
        if (!row) {
          return res.status(404).json({ error: 'Checklist not found' });
        }

        if (row.owner_id === userId || row.owner_role === 'admin') {
          req.boardId = row.board_id;
          return next();
        }

        db.get(
          'SELECT role FROM board_members WHERE board_id = ? AND user_id = ?',
          [row.board_id, userId],
          (err, memberRow) => {
            if (err) {
              return res.status(500).json({ error: 'Server error' });
            }
            if (!memberRow) {
              return res.status(403).json({ error: 'Access denied to this checklist' });
            }

            req.userRole = memberRow.role;
            req.boardId = row.board_id;
            next();
          }
        );
      }
    );
  };
};

const checkChecklistItemAccess = (db) => {
  return (req, res, next) => {
    const { itemId } = req.params;
    const userId = req.user.id;

    if (req.user.role === 'admin') {
      return next();
    }

    db.get(
      `SELECT b.id AS board_id, b.owner_id, u.role AS owner_role
       FROM checklist_items ci
       JOIN checklists cl ON cl.id = ci.checklist_id
       JOIN cards c ON c.id = cl.card_id
       JOIN lists l ON l.id = c.list_id
       JOIN boards b ON b.id = l.board_id
       LEFT JOIN users u ON u.id = b.owner_id
       WHERE ci.id = ?`,
      [itemId],
      (err, row) => {
        if (err) {
          return res.status(500).json({ error: 'Server error' });
        }
        if (!row) {
          return res.status(404).json({ error: 'Checklist item not found' });
        }

        if (row.owner_id === userId || row.owner_role === 'admin') {
          req.boardId = row.board_id;
          return next();
        }

        db.get(
          'SELECT role FROM board_members WHERE board_id = ? AND user_id = ?',
          [row.board_id, userId],
          (err, memberRow) => {
            if (err) {
              return res.status(500).json({ error: 'Server error' });
            }
            if (!memberRow) {
              return res.status(403).json({ error: 'Access denied to this checklist item' });
            }

            req.userRole = memberRow.role;
            req.boardId = row.board_id;
            next();
          }
        );
      }
    );
  };
};

const checkAttachmentAccess = (db) => {
  return (req, res, next) => {
    const { attachmentId } = req.params;
    const userId = req.user.id;

    if (req.user.role === 'admin') {
      return next();
    }

    db.get(
      `SELECT b.id AS board_id, b.owner_id, u.role AS owner_role
       FROM attachments a
       JOIN cards c ON c.id = a.card_id
       JOIN lists l ON l.id = c.list_id
       JOIN boards b ON b.id = l.board_id
       LEFT JOIN users u ON u.id = b.owner_id
       WHERE a.id = ?`,
      [attachmentId],
      (err, row) => {
        if (err) {
          return res.status(500).json({ error: 'Server error' });
        }
        if (!row) {
          return res.status(404).json({ error: 'Attachment not found' });
        }

        if (row.owner_id === userId || row.owner_role === 'admin') {
          req.boardId = row.board_id;
          return next();
        }

        db.get(
          'SELECT role FROM board_members WHERE board_id = ? AND user_id = ?',
          [row.board_id, userId],
          (err, memberRow) => {
            if (err) {
              return res.status(500).json({ error: 'Server error' });
            }
            if (!memberRow) {
              return res.status(403).json({ error: 'Access denied to this attachment' });
            }

            req.userRole = memberRow.role;
            req.boardId = row.board_id;
            next();
          }
        );
      }
    );
  };
};

module.exports = {
  authenticateToken,
  checkAdmin,
  checkBoardAccess,
  checkListAccess,
  checkCardAccess,
  checkLabelAccess,
  checkChecklistAccess,
  checkChecklistItemAccess,
  checkAttachmentAccess,
};
