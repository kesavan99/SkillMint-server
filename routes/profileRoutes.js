const express = require('express');
const router = express.Router();
const { getProfile, updateProfile } = require('../controllers/profile/profileController');
const authMiddleware = require('../middleware/authMiddleware');

// Get user profile
router.get('/profile', authMiddleware, getProfile);

// Update user profile
router.put('/profile', authMiddleware, updateProfile);

module.exports = router;
