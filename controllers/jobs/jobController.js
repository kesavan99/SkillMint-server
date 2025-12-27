const jobScraperService = require('../../services/jobScraperService');

/**
 * Job Search Controller
 * Handles job search requests and web scraping
 * Each user gets a dedicated browser tab that is reused for all their searches
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

    console.log(`Job search request from user: ${userId.substring(0, 8)}...`);

    // Perform job search using scraper service with userId
    const jobs = await jobScraperService.searchJobs({
      userId,
      role,
      designation,
      experienceLevel,
      location,
      jobType
    });

    return res.status(200).json({
      success: true,
      message: 'Jobs retrieved successfully',
      count: jobs.length,
      data: jobs
    });

  } catch (error) {
    console.error('Error in searchJobs controller:', error);
    
    // Provide user-friendly error message
    let errorMessage = 'Failed to search for jobs';
    if (error.message && error.message.includes('blocking cloud hosting')) {
      errorMessage = 'Job search is temporarily unavailable. Naukri.com is blocking requests from this server.';
    } else if (error.message && error.message.includes('Navigation timeout')) {
      errorMessage = 'Job search is temporarily unavailable. Unable to connect to Naukri.com.';
    } else if (error.message && error.message.includes('User ID is required')) {
      errorMessage = 'User authentication required for job search';
    }
    
    return res.status(500).json({
      success: false,
      message: errorMessage,
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
 * Health check endpoint for job service
 * GET /api/jobs/health
 */
const healthCheck = async (req, res) => {
  try {
    const stats = jobScraperService.getStats();
    
    return res.status(200).json({
      success: true,
      message: 'Job search service is running',
      timestamp: new Date().toISOString(),
      stats: {
        activeUserTabs: stats.totalUsers,
        browserInitialized: stats.browserInitialized
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Service unavailable'
    });
  }
};

/**
 * Close user's tab (optional endpoint for cleanup)
 * POST /api/jobs/close-tab
 */
const closeUserTab = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }
    
    await jobScraperService.closeUserTab(userId);
    
    return res.status(200).json({
      success: true,
      message: 'User tab closed successfully'
    });
  } catch (error) {
    console.error('Error closing user tab:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to close tab',
      error: error.message
    });
  }
};

module.exports = {
  searchJobs,
  getJobDetails,
  healthCheck,
  closeUserTab
};
