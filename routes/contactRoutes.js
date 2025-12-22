const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contact/contactController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/send', authMiddleware, contactController.sendContactMessage);

module.exports = router;
