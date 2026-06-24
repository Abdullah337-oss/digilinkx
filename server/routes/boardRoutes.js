const express = require('express');
const {
  createBoard, getUserBoards, getBoardById,
  updateBoardTitle, deleteBoard,
  removeBoardMember, getBoardMembers, createUserAndAddToBoard,
} = require('../controllers/boardController');
const { authenticateToken, checkAdmin, checkBoardAccess } = require('../middleware/auth');

module.exports = (db) => {
  const router = express.Router();

  router.get('/', authenticateToken, getUserBoards(db));
  router.post('/', authenticateToken, checkAdmin, createBoard(db));
  router.get('/:boardId', authenticateToken, checkBoardAccess(db), getBoardById(db));
  router.put('/:boardId', authenticateToken, checkAdmin, updateBoardTitle(db));
  router.delete('/:boardId', authenticateToken, deleteBoard(db));
  router.post('/:boardId/members', authenticateToken, createUserAndAddToBoard(db));
  router.get('/:boardId/members', authenticateToken, getBoardMembers(db));
  router.delete('/:boardId/members', authenticateToken, removeBoardMember(db));

  return router;
};
