const axios = require('axios');

/**
 * Naukri API Service
 * Calls Naukri.com's public job search API directly
 * No browser automation required - just HTTP requests
 */

class NaukriApiService {
  constructor() {
    this.baseUrl = 'https://www.naukri.com/jobapi/v3/search';
    this.defaultHeaders = {
      'accept': 'application/json',
      'accept-encoding': 'gzip, deflate, br',
      'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
      'appid': '109',
      'clientid': 'd3skt0p',
      'content-type': 'application/json',
      'gid': 'LOCATION,INDUSTRY,EDUCATION,FAREA_ROLE',
      'referer': 'https://www.naukri.com/',
      'sec-ch-ua': '"Not A(Brand";v="8", "Chromium";v="132", "Google Chrome";v="132"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'systemid': 'Naukri',
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
      'x-requested-with': 'XMLHttpRequest'
    };
  }

  /**
   * Search jobs using Naukri API
   * @param {Object} params - Search parameters
   * @param {string} params.keyword - Job keyword/skill (e.g., "java")
   * @param {string} params.location - Job location (e.g., "chennai")
   * @param {string} params.experience - Experience level (e.g., "1" for 1 year)
   * @param {number} params.pageNo - Page number (default: 1)
   * @param {number} params.noOfResults - Number of results per page (default: 20)
   * @returns {Promise<Object>} API response with job details
   */
  async searchJobs({ keyword, location, experience, pageNo = 1, noOfResults = 20 }) {
    try {
      // Build query parameters
      const params = {
        noOfResults: noOfResults || 20,
        urlType: 'search_by_key_loc',
        searchType: 'adv',
        keyword: keyword,
        location: location,
        pageNo: pageNo || 1,
        k: keyword,
        l: location
      };

      // Add experience if provided
      if (experience) {
        params.experience = experience;
      }

      // Build seoKey for the URL
      const seoKey = `${keyword.toLowerCase().replace(/\s+/g, '-')}-jobs-in-${location.toLowerCase().replace(/\s+/g, '-')}`;
      params.seoKey = seoKey;
      params.src = 'jobsearchDesk';
      params.latLong = '';


      // Make API request
      const response = await axios.get(this.baseUrl, {
        params: params,
        headers: this.defaultHeaders,
        timeout: 30000 // 30 second timeout
      });

      console.log(`✅ Naukri API success: ${response.data.noOfJobs} total jobs found`);
      console.log(`📄 Returned ${response.data.jobDetails?.length || 0} jobs in this page`);

      return {
        success: true,
        data: response.data
      };

    } catch (error) {
      console.error('❌ Naukri API error:', error.message);
      
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }

      return {
        success: false,
        error: error.message,
        details: error.response?.data
      };
    }
  }

  /**
   * Transform Naukri API response to match our expected format
   * @param {Object} apiResponse - Raw API response
   * @returns {Array} Transformed job list
   */
  transformJobData(apiResponse) {
    if (!apiResponse.jobDetails || !Array.isArray(apiResponse.jobDetails)) {
      return [];
    }

    return apiResponse.jobDetails.map((job, index) => ({
      id: job.jobId || `job_${index}`,
      title: job.title || 'N/A',
      company: job.companyName || 'N/A',
      location: job.placeholders?.find(p => p.type === 'location')?.label || 'Not specified',
      experience: job.placeholders?.find(p => p.type === 'experience')?.label || '',
      salary: job.placeholders?.find(p => p.type === 'salary')?.label || 'Not disclosed',
      description: job.jobDescription || '',
      url: job.jdURL ? `https://www.naukri.com${job.jdURL}` : null,
      source: 'Naukri',
      postedDate: job.footerPlaceholderLabel || '',
      type: 'Full-time',
      skills: job.tagsAndSkills ? job.tagsAndSkills.split(',').map(s => s.trim()) : [],
      companyId: job.companyId,
      logoUrl: job.logoPath || job.logoPathV3
    }));
  }

  /**
   * Get job statistics from API response
   * @param {Object} apiResponse - Raw API response
   * @returns {Object} Job statistics
   */
  getJobStats(apiResponse) {
    return {
      totalJobs: apiResponse.noOfJobs || 0,
      currentPage: apiResponse.pageNo || 1,
      salaryRanges: apiResponse.clusters?.salaryRange || [],
      topCompanies: apiResponse.clusters?.topGroupId || [],
      locations: apiResponse.clusters?.citiesGid || [],
      workFromHome: apiResponse.clusters?.wfhType || []
    };
  }
}

module.exports = new NaukriApiService();
