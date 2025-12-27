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

// Search jobs (protected) - calls Naukri API
router.post('/search', authMiddleware, jobController.searchJobs);

// Get job details (protected)
router.post('/details', authMiddleware, jobController.getJobDetails);

module.exports = router;
