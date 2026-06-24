const express = require('express');
const { createCard, getCardById, updateCard, deleteCard, moveCard } = require('../controllers/cardController');
const { authenticateToken, checkAdmin } = require('../middleware/auth');

module.exports = (db) => {
  const router = express.Router();

  router.post('/', authenticateToken, checkAdmin, createCard(db));
  router.get('/:cardId', authenticateToken, getCardById(db));
  router.put('/:cardId', authenticateToken, updateCard(db));
  router.delete('/:cardId', authenticateToken, checkAdmin, deleteCard(db));
  router.put('/:cardId/move', authenticateToken, moveCard(db));

  return router;
};
