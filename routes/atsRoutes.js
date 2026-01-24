/**
 * ATS Routes
 * Routes for ATS analysis and skill matching
 */

const express = require('express');
const router = express.Router();
const atsController = require('../controllers/ats/atsController');
const authMiddleware = require('../middleware/authMiddleware');

// Full ATS analysis (requires auth)
router.post('/analyze', authMiddleware, atsController.analyzeResume);

// Quick score for single job (requires auth)
router.post('/quick-score', authMiddleware, atsController.quickScore);

// Batch score for multiple jobs (requires auth)
router.post('/batch-score', authMiddleware, atsController.batchScore);

// Extract skills from text (public)
router.post('/extract-skills', atsController.extractSkills);

// Match skills (public)
router.post('/match-skills', atsController.matchSkills);

module.exports = router;
