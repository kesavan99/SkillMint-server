const tabManager = require('./tabManager');

/**
 * Job Scraper Service using Puppeteer
 * Uses user's dedicated tab to search for jobs on Naukri.com
 */
class JobScraperService {
  constructor() {
    this.baseUrl = 'https://www.naukri.com';
  }

  /**
   * Search for jobs using Puppeteer
   * @param {string} userId - User ID from JWT
   * @param {Object} params - Search parameters
   * @param {string} params.keyword - Job keyword/skill
   * @param {string} params.location - Job location
   * @param {string} params.experience - Experience level
   * @returns {Promise<Object>} Job search results
   */
  async searchJobs(userId, { keyword, location, experience }) {
    try {

      // Get or create user's tab
      const page = await tabManager.getUserTab(userId);

      // Build search URL
      const searchUrl = this.buildSearchUrl({ keyword, location, experience });

      // Navigate to search page
      await page.goto(searchUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Wait a bit more for dynamic content (using setTimeout since waitForTimeout is deprecated)
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Wait for job listings to load - use actual Naukri selector
      const jobListFound = await Promise.race([
        page.waitForSelector('.srp-jobtuple-wrapper', { timeout: 10000 }).then(() => 'srp-jobtuple-wrapper'),
        page.waitForSelector('.cust-job-tuple', { timeout: 10000 }).then(() => 'cust-job-tuple'),
        new Promise(resolve => setTimeout(() => resolve(null), 10000))
      ]);

      // Extract job data from the page using actual Naukri HTML structure
      const jobData = await page.evaluate(() => {
        const jobs = [];
        
        // Find all job wrappers - this is the actual class Naukri uses
        const jobWrappers = document.querySelectorAll('.srp-jobtuple-wrapper');
        
        jobWrappers.forEach((wrapper) => {
          try {
            const card = wrapper.querySelector('.cust-job-tuple');
            if (!card) return;

            // Extract using actual Naukri selectors from their HTML
            const titleElement = card.querySelector('a.title');
            const companyElement = card.querySelector('.comp-name');
            const locationElement = card.querySelector('.locWdth');
            const experienceElement = card.querySelector('.expwdth');
            const salaryElement = card.querySelector('.sal');
            const descriptionElement = card.querySelector('.job-desc');
            const tagsElements = card.querySelectorAll('.tags-gt .tag-li');
            const postedDateElement = card.querySelector('.job-post-day');

            const job = {
              title: titleElement?.textContent?.trim() || '',
              company: companyElement?.textContent?.trim() || '',
              location: locationElement?.getAttribute('title') || locationElement?.textContent?.trim() || '',
              experience: experienceElement?.getAttribute('title') || experienceElement?.textContent?.trim() || '',
              salary: salaryElement?.textContent?.trim() || 'Not disclosed',
              description: descriptionElement?.textContent?.trim().substring(0, 200) || '',
              url: titleElement?.href || titleElement?.getAttribute('href') || '',
              tags: Array.from(tagsElements).map(tag => tag.textContent.trim()).filter(Boolean),
              postedDate: postedDateElement?.textContent?.trim() || '',
              jobId: wrapper.getAttribute('data-job-id') || '',
              source: 'Naukri.com'
            };

            // Make URL absolute if relative
            if (job.url && !job.url.startsWith('http')) {
              job.url = `https://www.naukri.com${job.url}`;
            }

            if (job.title && job.company) {
              jobs.push(job);
            }
          } catch (err) {
            console.error('Error extracting job:', err);
          }
        });

        // Also try to get total job count
        const totalJobsElement = document.querySelector('.fleft.fs14.pt5');
        const totalJobs = totalJobsElement?.textContent?.match(/\d+/)?.[0] || jobs.length.toString();

        return {
          jobs,
          totalJobs: parseInt(totalJobs, 10) || jobs.length,
          pageUrl: window.location.href
        };
      });

      return {
        success: true,
        data: {
          jobs: jobData.jobs,
          totalJobs: jobData.totalJobs,
          count: jobData.jobs.length,
          searchUrl: jobData.pageUrl,
          keyword,
          location
        }
      };

    } catch (error) {
      console.error('❌ Job scraping error:', error);
      
      return {
        success: false,
        error: error.message,
        details: 'Failed to scrape jobs. The page structure may have changed or the site blocked the request.'
      };
    }
  }

  /**
   * Build Naukri search URL
   * @param {Object} params - Search parameters
   * @returns {string} Search URL
   */
  buildSearchUrl({ keyword, location, experience }) {
    const baseSearchUrl = `${this.baseUrl}/`;
    
    // Clean and format parameters
    const cleanKeyword = keyword.toLowerCase().replace(/\s+/g, '-');
    const cleanLocation = location.toLowerCase().replace(/\s+/g, '-');
    
    // Build SEO-friendly URL
    let url = `${baseSearchUrl}${cleanKeyword}-jobs`;
    
    if (location && location.toLowerCase() !== 'india') {
      url += `-in-${cleanLocation}`;
    }
    
    // Add experience as query parameter
    const params = new URLSearchParams();
    if (experience) {
      params.append('experience', experience);
    }
    params.append('k', keyword);
    if (location) {
      params.append('l', location);
    }
    
    const queryString = params.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
    
    return url;
  }

  /**
   * Get job details from a specific URL
   * @param {string} userId - User ID from JWT
   * @param {string} jobUrl - Job detail URL
   * @returns {Promise<Object>} Job details
   */
  async getJobDetails(userId, jobUrl) {
    try {
      const page = await tabManager.getUserTab(userId);
      
      await page.goto(jobUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      const jobDetails = await page.evaluate(() => {
        return {
          title: document.querySelector('.jd-header-title')?.textContent?.trim() || '',
          company: document.querySelector('.jd-header-comp-name')?.textContent?.trim() || '',
          description: document.querySelector('.jd-desc')?.textContent?.trim() || '',
          url: window.location.href
        };
      });

      return {
        success: true,
        data: jobDetails
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Singleton instance
const jobScraperService = new JobScraperService();

module.exports = jobScraperService;
