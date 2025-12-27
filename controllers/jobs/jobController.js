const jobScraperService = require('../../services/jobScraperService');

/**
 * Job Search Controller
 * Handles job search requests using Puppeteer (browser automation)
 */

/**
 * Search for jobs based on user criteria
 * POST /api/jobs/search
 */
const searchJobs = async (req, res) => {
  try {
    const { role, designation, experienceLevel, location, jobType } = req.body;
    
    // Extract userId from JWT token (set by authMiddleware)
    const userId = req.user?.userId || req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    // Validate required fields
    if (!role && !designation) {
      return res.status(400).json({
        success: false,
        message: 'Either role or designation is required'
      });
    }

    const keyword = role || designation;
    const searchLocation = location || 'India';

    // Use Puppeteer to scrape jobs
    const result = await jobScraperService.searchJobs(userId.toString(), {
      keyword: keyword,
      location: searchLocation,
      experience: experienceLevel
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch jobs',
        error: result.error
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Jobs retrieved successfully',
      count: result.data.jobs.length,
      totalJobs: result.data.totalJobs,
      data: result.data.jobs,
      searchUrl: result.data.searchUrl
    });

  } catch (error) {
    console.error('❌ Error in searchJobs controller:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Failed to search for jobs',
      error: error.message
    });
  }
};

/**
 * Get job details by scraping a specific URL
 * POST /api/jobs/details
 */
const getJobDetails = async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'Job URL is required'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Job details retrieved',
      data: {
        url,
        note: 'Detailed scraping not implemented yet. Click the URL to view on the original site.'
      }
    });

  } catch (error) {
    console.error('Error in getJobDetails controller:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get job details',
      error: error.message
    });
  }
};

/**
 * Health check endpoint
 * GET /api/jobs/health
 */
const healthCheck = async (req, res) => {
  try {
    const tabManager = require('../../services/tabManager');
    const browserManager = require('../../services/browserManager');
    
    const tabStats = tabManager.getStats();
    const browserStatus = browserManager.getStatus();
    
    return res.status(200).json({
      success: true,
      message: 'Job search service is running (Puppeteer-based)',
      timestamp: new Date().toISOString(),
      browser: browserStatus,
      tabs: tabStats
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Service unavailable'
    });
  }
};

module.exports = {
  searchJobs,
  getJobDetails,
  healthCheck
};
