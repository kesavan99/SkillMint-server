const jobScraperService = require('../../services/jobScraperService');

/**
 * Job Search Controller
 * Handles job search requests and web scraping
 */

/**
 * Search for jobs based on user criteria
 * POST /api/jobs/search
 */
const searchJobs = async (req, res) => {
  try {
    const { role, designation, experienceLevel, location, jobType } = req.body;

    // Validate required fields
    if (!role && !designation) {
      return res.status(400).json({
        success: false,
        message: 'Either role or designation is required'
      });
    }
    // Perform job search using scraper service
    const jobs = await jobScraperService.searchJobs({
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
    
    // Provide user-friendly error message for IP blocking
    let errorMessage = 'Failed to search for jobs';
    if (error.message && error.message.includes('blocking cloud hosting')) {
      errorMessage = 'Job search is temporarily unavailable. Naukri.com is blocking requests from this server.';
    } else if (error.message && error.message.includes('Navigation timeout')) {
      errorMessage = 'Job search is temporarily unavailable. Unable to connect to Naukri.com.';
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

    // This would scrape the specific job page
    // For now, return basic info
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
    return res.status(200).json({
      success: true,
      message: 'Job search service is running',
      timestamp: new Date().toISOString()
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
