const express = require('express');
const router = express.Router();
const jobController = require('../controllers/jobs/jobController');
const authMiddleware = require('../middleware/authMiddleware');

/**
 * Job Search Routes
 * Base path: /api/jobs
 * 
 * Each authenticated user gets ONE dedicated browser tab
 * The tab is reused for all their search requests
 */

// Health check (public) - shows active user tabs count
router.get('/health', jobController.healthCheck);

// Search jobs (protected) - uses user's dedicated tab
router.post('/search', authMiddleware, jobController.searchJobs);

// Get job details (protected)
router.post('/details', authMiddleware, jobController.getJobDetails);

// Close user's tab (protected) - optional cleanup
router.post('/close-tab', authMiddleware, jobController.closeUserTab);

module.exports = router;
