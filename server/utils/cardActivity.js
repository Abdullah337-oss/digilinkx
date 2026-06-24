const logCardActivity = (db, { cardId, userId, actionType, message }, callback) => {
  db.run(
    'INSERT INTO card_activity (card_id, user_id, action_type, message) VALUES (?, ?, ?, ?)',
    [cardId, userId, actionType, message],
    callback
  );
};
module.exports = { logCardActivity };
