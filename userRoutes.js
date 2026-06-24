const express = require('express');
const {
  register, login, getAllUsers, getUserById, getPendingUsers,
  approveUser, rejectUser, changePassword,
  forgetPassword, verifyResetCode, resetPassword,
  addMember, getAllMembers, removeMember, refreshToken,
} = require('../controllers/userController');
const { authenticateToken, checkAdmin } = require('../middleware/auth');

module.exports = (db) => {
  const router = express.Router();

  router.post('/register', register(db));
  router.post('/login', login(db));
  router.post('/forget-password', forgetPassword(db));
  router.post('/verify-reset-code', verifyResetCode(db));
  router.post('/reset-password', resetPassword(db));
  router.post('/refresh-token', refreshToken(db));
  router.get('/all', authenticateToken, checkAdmin, getAllUsers(db));
  router.get('/pending', authenticateToken, checkAdmin, getPendingUsers(db));
  router.patch('/:userId/approve', authenticateToken, checkAdmin, approveUser(db));
  router.patch('/:userId/reject', authenticateToken, checkAdmin, rejectUser(db));
  router.post('/change-password', authenticateToken, changePassword(db));
  router.get('/all-members', authenticateToken, checkAdmin, getAllMembers(db));
  router.get('/:userId', authenticateToken, checkAdmin, getUserById(db));
  router.post('/add-member', authenticateToken, checkAdmin, addMember(db));
  router.delete('/:userId/remove', authenticateToken, checkAdmin, removeMember(db));

  return router;
};
