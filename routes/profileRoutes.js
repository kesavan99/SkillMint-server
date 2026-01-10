const express = require('express');
const router = express.Router();
const { getProfile, updateProfile, requestJobSearchLimitExtension } = require('../controllers/profile/profileController');
const authMiddleware = require('../middleware/authMiddleware');

// Get user profile
router.get('/profile', authMiddleware, getProfile);

// Update user profile
router.put('/profile', authMiddleware, updateProfile);

// Request job search limit extension
router.post('/request-job-search-extension', authMiddleware, requestJobSearchLimitExtension);

module.exports = router;
