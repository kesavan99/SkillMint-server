const express = require('express');
const router = express.Router();
const jobController = require('../controllers/jobs/jobController');
const authMiddleware = require('../middleware/authMiddleware');

/**
 * Job Search Routes
 * Base path: /api/jobs
 */

// Health check (public)
router.get('/health', jobController.healthCheck);

// Search jobs (protected)
router.post('/search', authMiddleware, jobController.searchJobs);

// Get job details (protected)
router.post('/details', authMiddleware, jobController.getJobDetails);

module.exports = router;
