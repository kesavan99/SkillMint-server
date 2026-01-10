const express = require('express');
const router = express.Router();
const jobController = require('../controllers/jobs/jobController');
const authMiddleware = require('../middleware/authMiddleware');

/**
 * Job Search Routes
 * Base path: /api/jobs
 * 
 * Uses Naukri API directly - no browser automation
 */

// Health check (public)
router.get('/health', jobController.healthCheck);

// Get user's job search quota (protected)
router.get('/quota', authMiddleware, jobController.getUserQuota);

// Search jobs (protected) - returns task ID for polling
router.post('/search', authMiddleware, jobController.searchJobs);

// Poll job search progress (protected)
router.get('/search/poll/:taskId', authMiddleware, jobController.pollJobSearch);

// Get job details (protected)
router.post('/details', authMiddleware, jobController.getJobDetails);

module.exports = router;
