const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/admin/adminController');
const authMiddleware = require('../middleware/authMiddleware');

// Admin routes - all require authentication
router.get('/users', authMiddleware, AdminController.getAllUsers);
router.get('/contact-messages', authMiddleware, AdminController.getAllContactMessages);
router.put('/contact-messages/:messageId/status', authMiddleware, AdminController.updateContactMessageStatus);
router.get('/job-search-extension-requests', authMiddleware, AdminController.getJobSearchExtensionRequests);
router.put('/job-search-limit/:userId', authMiddleware, AdminController.updateJobSearchLimit);

module.exports = router;
