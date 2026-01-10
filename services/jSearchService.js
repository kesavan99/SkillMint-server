const axios = require('axios');

/**
 * JSearch API Service
 * Documentation: https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch
 * 
 * Free BASIC plan: 200 requests/month (hard-limited, no credit card required)
 * Rate limit: 1000 requests/hour for free plans
 */

class JSearchService {
  constructor() {
    this.apiKey = process.env.JSEARCH_API_KEY;
    this.apiHost = 'jsearch.p.rapidapi.com';
    this.baseURL = 'https://jsearch.p.rapidapi.com';
    
    if (!this.apiKey) {
      console.warn('⚠️  JSEARCH_API_KEY not found in environment variables');
    }
  }

  /**
   * Get common headers for all JSearch API requests
   */
  getHeaders() {
    return {
      'X-RapidAPI-Key': this.apiKey,
      'X-RapidAPI-Host': this.apiHost
    };
  }

  /**
   * Search for jobs using JSearch API
   * @param {string} keyword - Job title or keyword (e.g., "python developer")
   * @param {string} location - Location (e.g., "chennai", "india", "remote")
   * @param {number} experience - Years of experience (optional)
   * @param {number} page - Page number for pagination (default: 1)
   * @param {number} numPages - Number of pages to fetch (default: 1, max: 10)
   * @param {string} company - Company name for company-specific search (optional)
   * @param {string} platform - Job platform to search on (optional: linkedin, indeed, glassdoor, etc.)
   * @returns {Promise<Array>} Array of job postings
   */
  async searchJobs(keyword, location = '', experience = 0, page = 1, numPages = 1, company = null, platform = null) {
    try {
      console.log(`\n🔍 JSearch API: Searching jobs...`);
      console.log(`📋 Keyword: ${keyword}`);
      console.log(`🏢 Company: ${company || 'Any'}`);
      console.log(`📍 Location: ${location || 'Any'}`);
      console.log(`🌐 Platform: ${platform || 'All'}`);
      console.log(`⏱️  Experience: ${experience} years`);
      console.log(`📄 Page: ${page}, Pages to fetch: ${numPages}`);

      // Build query string with company if provided
      let query = keyword;
      if (company) {
        query = `${keyword} at ${company}`;
      }
      if (location) {
        query = `${query} in ${location}`;
      }
      // Add platform filter using "via {platform}" as recommended by JSearch API
      if (platform && platform !== 'all') {
        query = `${query} via ${platform}`;
      }

      const params = {
        query: query,
        page: page.toString(),
        num_pages: Math.min(numPages, 10).toString(), // Max 10 pages per request
        date_posted: 'all', // all, today, 3days, week, month
      };

      console.log(`🔧 API Request params:`, JSON.stringify(params, null, 2));

      // Add employment type filter if needed
      // params.employment_types = 'FULLTIME,PARTTIME,CONTRACTOR'; // Optional

      const response = await axios.get(`${this.baseURL}/search`, {
        params: params,
        headers: this.getHeaders(),
        timeout: 30000 // 30 second timeout
      });

      console.log(`📦 API Response status:`, response.data.status);
      console.log(`📦 API Response data length:`, response.data.data?.length || 0);

      // Check response status
      if (response.data.status === 'ERROR') {
        throw new Error(response.data.error?.message || 'JSearch API returned error');
      }

      let jobs = response.data.data || [];
      console.log(`✅ Found ${jobs.length} jobs from JSearch API`);
      
      // Transform JSearch response to our internal format
      const transformedJobs = jobs.map(job => this.transformJobData(job, experience));
      
      return transformedJobs;

    } catch (error) {
      console.error('❌ JSearch API Error:', error.message);
      
      // Handle rate limiting
      if (error.response?.status === 429) {
        const resetTime = error.response.headers['x-ratelimit-requests-reset'];
        console.error(`⏰ Rate limit exceeded. Resets in ${resetTime} seconds`);
        throw new Error(`Rate limit exceeded. Try again in ${resetTime} seconds`);
      }

      // Handle authentication errors
      if (error.response?.status === 403) {
        console.error('🔑 Authentication failed. Check your JSEARCH_API_KEY');
        throw new Error('JSearch API authentication failed');
      }

      // Handle bad request
      if (error.response?.status === 400) {
        console.error('📝 Bad request:', error.response.data?.message);
        throw new Error(error.response.data?.message || 'Invalid request parameters');
      }

      throw error;
    }
  }

  /**
   * Get job details by job ID
   * @param {string} jobId - JSearch job ID
   * @returns {Promise<Object>} Job details
   */
  async getJobDetails(jobId) {
    try {
      console.log(`\n🔍 JSearch API: Fetching job details for ID: ${jobId}`);

      const response = await axios.get(`${this.baseURL}/job-details`, {
        params: { job_id: jobId },
        headers: this.getHeaders(),
        timeout: 15000
      });

      if (response.data.status === 'ERROR') {
        throw new Error(response.data.error?.message || 'Failed to fetch job details');
      }

      console.log(`✅ Job details retrieved successfully`);
      return response.data.data[0];

    } catch (error) {
      console.error('❌ Error fetching job details:', error.message);
      throw error;
    }
  }

  /**
   * Get estimated salary for a job title and location
   * @param {string} jobTitle - Job title (e.g., "Python Developer")
   * @param {string} location - Location (e.g., "Chennai, India")
   * @returns {Promise<Object>} Salary estimates
   */
  async getEstimatedSalary(jobTitle, location) {
    try {
      console.log(`\n💰 JSearch API: Getting salary estimates for ${jobTitle} in ${location}`);

      const response = await axios.get(`${this.baseURL}/estimated-salary`, {
        params: {
          job_title: jobTitle,
          location: location
        },
        headers: this.getHeaders(),
        timeout: 15000
      });

      if (response.data.status === 'ERROR') {
        throw new Error(response.data.error?.message || 'Failed to fetch salary data');
      }

      console.log(`✅ Salary data retrieved successfully`);
      return response.data.data[0];

    } catch (error) {
      console.error('❌ Error fetching salary data:', error.message);
      throw error;
    }
  }

  /**
   * Transform JSearch job data to our internal format
   * @param {Object} job - JSearch job object
   * @param {number} userExperience - User's years of experience
   * @returns {Object} Transformed job object
   */
  transformJobData(job, userExperience = 0) {
    // Extract company logo (use employer_logo or fallback to generic)
    const companyLogo = job.employer_logo || 
                       `https://logo.clearbit.com/${job.employer_website || job.employer_name?.toLowerCase().replace(/\s+/g, '')}.com`;

    // Calculate experience level
    const jobExperience = this.extractExperienceFromDescription(job.job_description);
    const experienceMatch = this.matchExperience(userExperience, jobExperience);

    // Extract salary information
    const salary = this.extractSalaryInfo(job);

    return {
      // Basic info
      id: job.job_id,
      title: job.job_title,
      company: job.employer_name,
      companyLogo: companyLogo,
      location: job.job_city && job.job_state 
        ? `${job.job_city}, ${job.job_state}, ${job.job_country}`
        : job.job_country,
      
      // Job details
      description: job.job_description,
      highlights: {
        qualifications: job.job_highlights?.Qualifications || [],
        responsibilities: job.job_highlights?.Responsibilities || [],
        benefits: job.job_highlights?.Benefits || []
      },
      
      // Employment info
      employmentType: job.job_employment_type, // FULLTIME, PARTTIME, CONTRACTOR, INTERN
      isRemote: job.job_is_remote || false,
      postedDate: job.job_posted_at_datetime_utc,
      expirationDate: job.job_offer_expiration_datetime_utc,
      
      // Experience & Salary
      experienceRequired: jobExperience,
      experienceMatch: experienceMatch,
      salary: salary,
      
      // Application
      applyLink: job.job_apply_link,
      applyQualityScore: job.apply_options?.length || 0,
      
      // Additional data
      requiredSkills: job.job_required_skills || [],
      requiredEducation: job.job_required_education || {},
      publisher: job.job_publisher,
      
      // Metadata
      source: 'jsearch',
      fetchedAt: new Date().toISOString()
    };
  }

  /**
   * Extract experience requirements from job description
   * @param {string} description - Job description text
   * @returns {Object} Min and max experience in years
   */
  extractExperienceFromDescription(description) {
    if (!description) return { min: 0, max: 0 };

    const text = description.toLowerCase();
    
    // Common patterns: "3+ years", "3-5 years", "5 to 7 years"
    const patterns = [
      /(\d+)\+?\s*(?:to|\-)\s*(\d+)\s*years?/i,
      /(\d+)\+\s*years?/i,
      /(\d+)\s*years?/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        if (pattern.source.includes('to|\\-')) {
          // Range: "3-5 years"
          return {
            min: parseInt(match[1]),
            max: parseInt(match[2])
          };
        } else if (pattern.source.includes('\\+')) {
          // Plus: "3+ years"
          return {
            min: parseInt(match[1]),
            max: parseInt(match[1]) + 10
          };
        } else {
          // Single: "3 years"
          return {
            min: parseInt(match[1]),
            max: parseInt(match[1])
          };
        }
      }
    }

    return { min: 0, max: 0 };
  }

  /**
   * Match user experience with job requirements
   * @param {number} userExp - User's years of experience
   * @param {Object} jobExp - Job experience requirements {min, max}
   * @returns {string} Match level: 'perfect', 'good', 'underqualified', 'overqualified'
   */
  matchExperience(userExp, jobExp) {
    if (!jobExp.min && !jobExp.max) return 'unknown';
    
    if (userExp >= jobExp.min && userExp <= jobExp.max) {
      return 'perfect';
    } else if (userExp >= jobExp.min - 1 && userExp <= jobExp.max + 1) {
      return 'good';
    } else if (userExp < jobExp.min) {
      return 'underqualified';
    } else {
      return 'overqualified';
    }
  }

  /**
   * Extract salary information from JSearch job data
   * @param {Object} job - JSearch job object
   * @returns {Object} Salary info
   */
  extractSalaryInfo(job) {
    if (!job.job_min_salary && !job.job_max_salary) {
      return null;
    }

    return {
      min: job.job_min_salary,
      max: job.job_max_salary,
      currency: job.job_salary_currency || 'USD',
      period: job.job_salary_period || 'YEAR'
    };
  }

  /**
   * Check API health and rate limits
   * @returns {Promise<Object>} API status info
   */
  async checkStatus() {
    try {
      // Make a minimal search request to check status
      const response = await axios.get(`${this.baseURL}/search`, {
        params: { query: 'test', page: '1', num_pages: '1' },
        headers: this.getHeaders(),
        timeout: 10000
      });

      return {
        status: 'OK',
        requestsLimit: response.headers['x-ratelimit-requests-limit'],
        requestsRemaining: response.headers['x-ratelimit-requests-remaining'],
        requestsReset: response.headers['x-ratelimit-requests-reset']
      };

    } catch (error) {
      return {
        status: 'ERROR',
        error: error.message
      };
    }
  }
}

module.exports = new JSearchService();
