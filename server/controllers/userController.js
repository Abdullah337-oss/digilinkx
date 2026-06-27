const bcrypt = require('bcryptjs');
const jwt = require('jwt-simple');
const crypto = require('crypto');

const secret = process.env.JWT_SECRET || 'your_secret_key_change_this_in_production';

const generateToken = (user) => {
  const now = Math.floor(Date.now() / 1000);
  return jwt.encode(
    { id: user.id, username: user.username, email: user.email, role: user.role, iat: now, exp: now + 86400 },
    secret
  );
};

const register = (db) => (req, res) => {
  const rawUsername = req.body.username;
  const rawEmail = req.body.email;
  const password = req.body.password;
  const role = req.body.role;

  const username = rawUsername?.trim();
  const email = rawEmail?.trim().toLowerCase();

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  db.get('SELECT id, username FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)', [username, email], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (row) {
      const field = row.username.toLowerCase() === username.toLowerCase() ? 'Username' : 'Email';
      return res.status(400).json({ error: `${field} already taken` });
    }
    const hashedPassword = bcrypt.hashSync(password, 10);
    db.run(
      'INSERT INTO users (username, email, password, plain_password, role, status) VALUES (?, ?, ?, ?, ?, ?)',
      [username, email, hashedPassword, password, role || 'viewer', 'pending'],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ message: 'Registration successful. Wait for admin approval.', user: { id: this.lastID, username, email, role: role || 'viewer', status: 'pending' } });
      }
    );
  });
};

const login = (db) => (req, res) => {
  const rawUsername = req.body.username;
  const password = req.body.password;
  const username = rawUsername?.trim();

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  
  console.log('[LOGIN] Attempting login with username:', username);
  
  // Allow login using either username or email, matching case-insensitively
  db.get('SELECT * FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)', [username, username], (err, row) => {
    if (err) {
      console.error('[LOGIN] Database error:', err.message);
      return res.status(500).json({ error: err.message });
    }
    
    if (!row) {
      console.log('[LOGIN] User not found:', username);
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    console.log('[LOGIN] User found:', row.username, '| Status:', row.status);
    
    const passwordMatch = bcrypt.compareSync(password, row.password)
      || (row.plain_password && !String(row.plain_password).startsWith('$2') && password === row.plain_password);
    console.log('[LOGIN] Password match:', passwordMatch);
    
    if (!passwordMatch) {
      console.log('[LOGIN] Password mismatch for user:', row.username);
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    if (row.status !== 'approved') {
      console.log('[LOGIN] User not approved, status:', row.status);
      return res.status(403).json({ error: 'Account is not approved by admin' });
    }
    
    console.log('[LOGIN] Login successful for user:', row.username);
    const token = generateToken(row);
    res.json({ token, user: { id: row.id, username: row.username, email: row.email, role: row.role, status: row.status } });
  });
};

const refreshToken = (db) => (req, res) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(400).json({ error: 'Token required' });
  try {
    const decoded = jwt.decode(token, secret);
    const nowInSeconds = Math.floor(Date.now() / 1000);
    if (decoded.exp && decoded.exp > nowInSeconds + 3600) {
      return res.json({ token, message: 'Token still valid' });
    }
    db.get('SELECT * FROM users WHERE id = ? AND status = \'approved\'', [decoded.id], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(401).json({ error: 'User not found or not approved' });
      const newToken = generateToken(row);
      res.json({ token: newToken });
    });
  } catch (err) {
    res.status(403).json({ error: 'Invalid token' });
  }
};

const getAllUsers = (db) => (_req, res) => {
  db.all('SELECT id, username, email, role, status, created_at FROM users WHERE role != \'admin\' ORDER BY created_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

const getPendingUsers = (db) => (_req, res) => {
  db.all('SELECT id, username, email, role, status, created_at FROM users WHERE status = \'pending\' AND role != \'admin\' ORDER BY created_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

const getUserById = (db) => (req, res) => {
  db.get('SELECT id, username, email, role, status, created_at FROM users WHERE id = ?', [req.params.userId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'User not found' });
    res.json(row);
  });
};

const approveUser = (db) => (req, res) => {
  const { role: newRole, boardIds } = req.body;
  const userId = req.params.userId;
  db.run(
    'UPDATE users SET status = \'approved\', role = ?, approved_at = CURRENT_TIMESTAMP WHERE id = ? AND status = \'pending\'',
    [newRole || 'viewer', userId],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Pending user not found' });

      if (boardIds && Array.isArray(boardIds) && boardIds.length > 0) {
        let completed = 0;
        boardIds.forEach((boardId) => {
          db.run(
            'INSERT OR IGNORE INTO board_members (board_id, user_id, role) VALUES (?, ?, ?)',
            [boardId, userId, 'viewer'],
            (err) => {
              if (err) return res.status(500).json({ error: err.message });
              completed++;
              if (completed === boardIds.length) {
                db.get('SELECT id, username, email, role, status FROM users WHERE id = ?', [userId], (err, user) => {
                  if (err) return res.status(500).json({ error: err.message });
                  res.json({ message: 'User approved and added to boards', user: { id: user.id, username: user.username, email: user.email, role: user.role, status: user.status } });
                });
              }
            }
          );
        });
      } else {
        db.get('SELECT id, username, email, role, status FROM users WHERE id = ?', [userId], (err, user) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ message: 'User approved', user: { id: user.id, username: user.username, email: user.email, role: user.role, status: user.status } });
        });
      }
    }
  );
};

const rejectUser = (db) => (req, res) => {
  db.run('UPDATE users SET status = \'rejected\' WHERE id = ? AND (status = \'pending\' OR status = \'approved\')', [req.params.userId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User rejected' });
  });
};

const changePassword = (db) => (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'Old and new passwords are required' });
  }
  db.get('SELECT * FROM users WHERE id = ?', [req.user.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'User not found' });
    if (!bcrypt.compareSync(oldPassword, row.password)) {
      return res.status(400).json({ error: 'Old password is incorrect' });
    }
    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    db.run('UPDATE users SET password = ?, plain_password = ? WHERE id = ?', [hashedPassword, newPassword, req.user.id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Password changed successfully' });
    });
  });
};

const forgetPassword = (db) => (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  db.get('SELECT id, username FROM users WHERE email = ?', [email], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Email not found' });
    const code = crypto.randomBytes(3).toString('hex').toUpperCase();
    db.run('INSERT INTO password_resets (email, code, expires_at) VALUES (?, ?, DATETIME(\'now\', \'+15 minutes\'))', [email, code], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      console.log(`\nPassword reset code for ${email}: ${code}\n`);
      res.json({ message: 'Reset code sent to your email (check server console)' });
    });
  });
};

const verifyResetCode = (db) => (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: 'Email and code are required' });
  db.get('SELECT * FROM password_resets WHERE email = ? AND code = ? AND expires_at > CURRENT_TIMESTAMP ORDER BY created_at DESC LIMIT 1', [email, code], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(400).json({ error: 'Invalid or expired code' });
    res.json({ message: 'Code verified' });
  });
};

const resetPassword = (db) => (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  db.get('SELECT * FROM password_resets WHERE email = ? AND code = ? AND expires_at > CURRENT_TIMESTAMP ORDER BY created_at DESC LIMIT 1', [email, code], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(400).json({ error: 'Invalid or expired code' });
    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    db.run('UPDATE users SET password = ?, plain_password = ? WHERE email = ?', [hashedPassword, newPassword, email], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      db.run('DELETE FROM password_resets WHERE email = ?', [email], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Password reset successfully' });
      });
    });
  });
};

const addMember = (db) => (req, res) => {
  const rawUsername = req.body.username;
  const rawEmail = req.body.email;
  const password = req.body.password;
  const role = req.body.role;

  const username = rawUsername?.trim();
  const email = rawEmail?.trim().toLowerCase();

  console.log('[ADD_MEMBER] Attempting to add member:', { username, email, role });

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email, and password are required' });
  }
  db.get('SELECT id, username FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)', [username, email], (err, row) => {
    if (err) {
      console.error('[ADD_MEMBER] Database error:', err.message);
      return res.status(500).json({ error: err.message });
    }
    if (row) {
      console.log('[ADD_MEMBER] User already exists:', row.username);
      const field = row.username.toLowerCase() === username.toLowerCase() ? 'Username' : 'Email';
      return res.status(400).json({ error: `${field} already taken` });
    }
    
    console.log('[ADD_MEMBER] Hashing password for new user');
    const hashedPassword = bcrypt.hashSync(password, 10);
    console.log('[ADD_MEMBER] Password hashed. Length:', hashedPassword.length);
    
    db.run(
      'INSERT INTO users (username, email, password, plain_password, role, status, approved_at) VALUES (?, ?, ?, ?, ?, \'approved\', CURRENT_TIMESTAMP)',
      [username, email, hashedPassword, password, role || 'viewer'],
      function(err) {
        if (err) {
          console.error('[ADD_MEMBER] Insert error:', err.message);
          return res.status(500).json({ error: err.message });
        }
        const userId = this.lastID;
        console.log('[ADD_MEMBER] User created with ID:', userId);
        const user = { id: userId, username, email, role: role || 'viewer', status: 'approved' };

        // Add new user to all existing boards' board_members
        db.all('SELECT id FROM boards', [], (err, boards) => {
          if (err) {
            console.error('[ADD_MEMBER] Error fetching boards:', err.message);
            return res.status(500).json({ error: err.message });
          }
          if (boards && boards.length > 0) {
            console.log('[ADD_MEMBER] Adding user to', boards.length, 'boards');
            let completed = 0;
            boards.forEach((board) => {
              db.run(
                'INSERT OR IGNORE INTO board_members (board_id, user_id, role) VALUES (?, ?, ?)',
                [board.id, userId, 'viewer'],
                (err) => {
                  if (err) {
                    console.error('[ADD_MEMBER] Error adding to board:', err.message);
                    return res.status(500).json({ error: err.message });
                  }
                  completed++;
                  if (completed === boards.length) {
                    console.log('[ADD_MEMBER] Member added successfully');
                    res.status(201).json({ message: 'Member added successfully and granted access to all boards', user });
                  }
                }
              );
            });
          } else {
            console.log('[ADD_MEMBER] No boards to add user to');
            res.status(201).json({ message: 'Member added successfully', user });
          }
        });
      }
    );
  });
};

const getAllMembers = (db) => (_req, res) => {
  db.all('SELECT id, username, email, plain_password, role, status, created_at FROM users WHERE role != \'admin\' ORDER BY created_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

const removeMember = (db) => (req, res) => {
  const userId = req.params.userId;

  db.get('SELECT id, role FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role === 'admin') return res.status(403).json({ error: 'Cannot remove admin user' });

    // Delete all references first (FK constraint requires this order)
    db.run('DELETE FROM card_members WHERE user_id = ?', [userId]);
    db.run('DELETE FROM board_members WHERE user_id = ?', [userId]);
    db.run('UPDATE cards SET created_by_id = NULL WHERE created_by_id = ?', [userId]);
    db.run('UPDATE attachments SET uploaded_by_id = NULL WHERE uploaded_by_id = ?', [userId]);
    db.run('DELETE FROM card_comments WHERE user_id = ?', [userId]);
    db.run('DELETE FROM card_activity WHERE user_id = ?', [userId]);
    db.run('UPDATE boards SET owner_id = NULL WHERE owner_id = ?', [userId]);

    db.run('DELETE FROM users WHERE id = ?', [userId], function(deleteErr) {
      if (deleteErr) return res.status(500).json({ error: deleteErr.message });
      res.json({ message: 'Member removed completely from system' });
    });
  });
};

module.exports = {
  register, login, refreshToken, getAllUsers, getPendingUsers, getUserById,
  approveUser, rejectUser, changePassword, forgetPassword, verifyResetCode, resetPassword,
  addMember, getAllMembers, removeMember,
};
