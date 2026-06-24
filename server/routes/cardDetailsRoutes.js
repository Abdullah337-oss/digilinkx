const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const getUploadsPath = () => process.env.UPLOADS_PATH || path.join(__dirname, '../uploads');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = getUploadsPath();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

const {
  addLabel, deleteLabel, addMember, removeMember, setDates,
  addMemberByEmail, addChecklist, addChecklistItem,
  uploadAttachment, addAttachmentLink, deleteAttachment, updateAttachment,
  makeAttachmentCover, shareAttachment, addComment,
  downloadAttachment,
} = require('../controllers/cardDetailsController');

const { authenticateToken, checkCardAccess, checkBoardAccess } = require('../middleware/auth');

module.exports = (db) => {
  const router = express.Router();

  router.post('/:cardId/labels', authenticateToken, addLabel(db));
  router.delete('/labels/:labelId', authenticateToken, deleteLabel(db));
  router.post('/:cardId/members', authenticateToken, addMember(db));
  router.delete('/:cardId/members/:userId', authenticateToken, removeMember(db));
  router.post('/:cardId/dates', authenticateToken, setDates(db));
  router.post('/:cardId/members-by-email', authenticateToken, addMemberByEmail(db));
  router.post('/:cardId/checklists', authenticateToken, addChecklist(db));
  router.post('/checklists/:checklistId/items', authenticateToken, addChecklistItem(db));
  // Accept either "files" (current frontend) or "file" (some browsers/clients)
  router.post(
    '/:cardId/attachments',
    authenticateToken,
    upload.any(),
    (req, res) => {
      // If client uses "files" field name, Multer will populate req.files.
      // If client uses "file" or other field names, we still accept via upload.any().
      return uploadAttachment(db)(req, res);
    }
  );
  router.post(
    '/:cardId/attachments/upload',
    authenticateToken,
    upload.any(),
    (req, res) => {
      return uploadAttachment(db)(req, res);
    }
  );
  router.post('/:cardId/attachments/link', authenticateToken, addAttachmentLink(db));
  router.delete('/attachments/:attachmentId', authenticateToken, deleteAttachment(db));
  router.patch('/attachments/:attachmentId', authenticateToken, updateAttachment(db));
  router.put('/attachments/:attachmentId', authenticateToken, updateAttachment(db));
  router.post('/attachments/:attachmentId/cover', authenticateToken, makeAttachmentCover(db));
  router.put('/attachments/:attachmentId/cover', authenticateToken, makeAttachmentCover(db));
  router.post('/:cardId/attachments/:attachmentId/share', authenticateToken, shareAttachment(db));
  router.post('/attachments/:attachmentId/share', authenticateToken, shareAttachment(db));
  router.post('/:cardId/comments', authenticateToken, addComment(db));
  router.get('/attachments/:attachmentId/download', authenticateToken, downloadAttachment(db));

  return router;
};
