const express = require('express');
const { createList, updateListTitle } = require('../controllers/listController');
const { authenticateToken, checkAdmin, checkBoardAccess } = require('../middleware/auth');

module.exports = (db) => {
  const router = express.Router();

  router.post('/', authenticateToken, checkAdmin, createList(db));
  router.put('/:listId', authenticateToken, checkAdmin, updateListTitle(db));

  return router;
};
